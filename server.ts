import express from 'express';
import path from 'path';
import nodemailer, { type Transporter } from 'nodemailer';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.text({ type: ['text/*', 'application/json'], limit: '15mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Google Drive Cloud Sync Proxy with In-Memory Caching & Request Coalescing
  const APPS_SCRIPT_SYNC_URL =
    'https://script.google.com/macros/s/AKfycbxW6C9L4sDhKMLO28_iaxLrUS834iKCoYkkQJbxGz_e2vpGPf3KVJxzr2tvoY5EIZ0tbw/exec';

  let cachedCloudData: { data: any; timestamp: number } | null = null;
  let inFlightGetPromise: Promise<any> | null = null;
  let pendingPostPayload: string | null = null;
  let isFlushingPost = false;

  const fetchCloudFromAppsScript = async (): Promise<any> => {
    const url = `${APPS_SCRIPT_SYNC_URL}?t=${Date.now()}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      throw new Error(`Apps Script responded with status ${response.status}`);
    }
    const data = await response.json();
    cachedCloudData = { data, timestamp: Date.now() };
    return data;
  };

  const flushPostQueue = async () => {
    if (isFlushingPost || !pendingPostPayload) return;
    isFlushingPost = true;
    const bodyToSend = pendingPostPayload;
    pendingPostPayload = null;

    try {
      await fetch(APPS_SCRIPT_SYNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'User-Agent': 'Mozilla/5.0',
        },
        body: bodyToSend,
        signal: AbortSignal.timeout(25000),
      });
    } catch (err: any) {
      console.warn('[CloudSync Proxy] Background sync retry queued:', err?.message);
    } finally {
      isFlushingPost = false;
      if (pendingPostPayload) {
        setTimeout(flushPostQueue, 1000);
      }
    }
  };

  app.get('/api/cloud-sync', async (req, res) => {
    try {
      // Nếu có cache còn mới (< 10 giây), trả về ngay lập tức không cần đợi Apps Script
      if (cachedCloudData && Date.now() - cachedCloudData.timestamp < 10000) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.json(cachedCloudData.data);
      }

      // Ghép chung các request đồng thời (Request Coalescing) để không gọi Google Apps Script nhiều lần cùng lúc
      if (!inFlightGetPromise) {
        inFlightGetPromise = fetchCloudFromAppsScript().finally(() => {
          inFlightGetPromise = null;
        });
      }

      const data = await inFlightGetPromise;
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.json(data);
    } catch (err: any) {
      // Nếu Apps Script tạm thời chậm hoặc timeout nhưng ta đã có cache trước đó, trả về cache dự phòng
      if (cachedCloudData) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.json(cachedCloudData.data);
      }
      return res.status(200).json({ passwords: {}, users: {} });
    }
  });

  app.post('/api/cloud-sync', async (req, res) => {
    try {
      const payloadString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      // Cập nhật ngay vào in-memory cache để mọi thao tác đọc kế tiếp có dữ liệu mới tức thì (< 1ms)
      try {
        const parsed = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(payloadString);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.passwords) parsed.passwords = {};
          if (!parsed.users) parsed.users = {};
          cachedCloudData = { data: parsed, timestamp: Date.now() };
        }
      } catch (e) {}

      // Đưa vào hàng đợi ghi nền để tuần tự hóa các lệnh ghi, tránh nghẽn khóa file trên Google Drive
      pendingPostPayload = payloadString;
      flushPostQueue();

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(200).json({ success: true, cachedOnly: true });
    }
  });

  // Cached Gold Rates in-memory
  let cachedGoldData: {
    data: {
      success: boolean;
      updatedAtStr: string;
      fetchedAt: string;
      source: string;
      summary: {
        nhan9999SellPerChi: number;
        nhan9999BuyPerChi: number;
        sjcSellPerChi: number;
        sjcBuyPerChi: number;
        sjcSellPerLuong: number;
        sjcBuyPerLuong: number;
      };
      items: Array<{
        brand: string;
        name: string;
        category: 'nhan_9999' | 'sjc_mieng' | 'other';
        buyPerChi: number;
        sellPerChi: number;
        buyPerLuong: number;
        sellPerLuong: number;
      }>;
    };
    expiresAt: number;
  } | null = null;

  // Gold Rates API - Lấy giá vàng mới nhất hôm nay từ thị trường Việt Nam (SJC, BTMC, Phú Quý, PNJ)
  app.get('/api/gold-rates', async (req, res) => {
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();

    if (!forceRefresh && cachedGoldData && cachedGoldData.expiresAt > now) {
      return res.json({ ...cachedGoldData.data, fromCache: true });
    }

    try {
      const items: Array<{
        brand: string;
        name: string;
        category: 'nhan_9999' | 'sjc_mieng' | 'other';
        buyPerChi: number;
        sellPerChi: number;
        buyPerLuong: number;
        sellPerLuong: number;
        buyPrice?: number;
        sellPrice?: number;
        unit?: string;
      }> = [];

      let latestUpdateStr = '';

      // 1. Quét song song bảng giá vàng từ các nguồn uy tín hàng đầu (DOJI, SJC, Bảo Tín Minh Châu, Phú Quý)
      const sources = [
        { brand: 'DOJI', url: 'https://giavang.org/trong-nuoc/doji/' },
        { brand: 'SJC', url: 'https://giavang.org/trong-nuoc/sjc/' },
        { brand: 'Bảo Tín Minh Châu', url: 'https://giavang.org/trong-nuoc/bao-tin-minh-chau/' },
        { brand: 'Phú Quý', url: 'https://giavang.org/trong-nuoc/phu-quy/' },
      ];

      const fetchPromises = sources.map(async (src) => {
        try {
          const response = await fetch(src.url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(4000),
          });

          if (!response.ok) return { brand: src.brand, items: [], time: '' };
          const html = await response.text();

          const timeMatch = html.match(/Cập nhật lúc[^<]*/i);
          const time = timeMatch ? timeMatch[0].trim() : '';

          const srcItems: typeof items = [];
          const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

          for (const tr of trMatches) {
            const cells = tr
              .replace(/<[^>]+>/g, '|')
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean);

            if (cells.length >= 3) {
              const buyRaw = cells[cells.length - 2];
              const sellRaw = cells[cells.length - 1];
              const buyNum = parseFloat(buyRaw.replace(/\./g, '').replace(',', '.'));
              const sellNum = parseFloat(sellRaw.replace(/\./g, '').replace(',', '.'));
              const rawName = cells.slice(0, cells.length - 2).join(' - ');

              if (!isNaN(buyNum) && !isNaN(sellNum) && buyNum > 1000 && !rawName.toLowerCase().includes('bạc')) {
                const buyPerChi = Math.round(buyNum * 100);
                const sellPerChi = Math.round(sellNum * 100);
                const lower = rawName.toLowerCase();
                let category: 'nhan_9999' | 'sjc_mieng' | 'other' = 'other';
                if (
                  lower.includes('nhẫn') ||
                  lower.includes('hưng thịnh vượng') ||
                  lower.includes('avpl') ||
                  lower.includes('24k') ||
                  lower.includes('999') ||
                  lower.includes('tròn')
                ) {
                  category = 'nhan_9999';
                } else if (lower.includes('sjc') || lower.includes('miếng')) {
                  category = 'sjc_mieng';
                }

                // Chuẩn hóa tên bỏ tiền tố tỉnh thành nếu có
                const cleanName = rawName.replace(/^(Hà Nội|Đà Nẵng|Tp\. Hồ Chí Minh|Hồ Chí Minh)\s*-\s*/i, '');
                srcItems.push({
                  brand: src.brand,
                  name: cleanName,
                  category,
                  buyPerChi,
                  sellPerChi,
                  buyPerLuong: buyPerChi * 10,
                  sellPerLuong: sellPerChi * 10,
                  buyPrice: buyPerChi,
                  sellPrice: sellPerChi,
                  unit: 'chỉ',
                });
              }
            }
          }
          return { brand: src.brand, items: srcItems, time };
        } catch {
          // Bắt và bỏ qua lỗi timeout êm xuôi không làm gián đoạn hệ thống
          return { brand: src.brand, items: [], time: '' };
        }
      });

      const settledResults = await Promise.allSettled(fetchPromises);
      for (const res of settledResults) {
        if (res.status === 'fulfilled' && res.value) {
          if (res.value.time && !latestUpdateStr) {
            latestUpdateStr = res.value.time;
          }
          for (const item of res.value.items) {
            // Không lặp lại cùng thương hiệu và tên
            if (!items.some((i) => i.brand === item.brand && i.name === item.name)) {
              items.push(item);
            }
          }
        }
      }

      // Xác định giá tóm tắt tham chiếu mặc định (ưu tiên DOJI cho nhẫn và miếng)
      const dojiNhanItem = items.find(i => i.brand === 'DOJI' && (i.name.includes('Hưng Thịnh Vượng') || i.name.includes('AVPL') || i.name.includes('Nhẫn')));
      const dojiSjcItem = items.find(i => i.brand === 'DOJI' && i.name.includes('SJC'));

      const sjcItem = items.find(i => i.brand === 'SJC' && (i.name.includes('1L') || i.name.includes('SJC 1L') || i.category === 'sjc_mieng'));
      const nhanItem = items.find(i => i.category === 'nhan_9999' && (i.name.includes('1 chỉ') || i.name.includes('tròn trơn') || i.name.includes('Phú Quý') || i.name.includes('SJC')));

      const fallbackDojiBuy = 14400000;
      const fallbackDojiSell = 14800000;
      const fallbackDojiSjcBuy = 14460000;
      const fallbackDojiSjcSell = 14760000;

      const fallbackNhanSell = 14800000;
      const fallbackNhanBuy = 14400000;
      const fallbackSjcSell = 14760000;
      const fallbackSjcBuy = 14460000;

      const dojiBuyPerChi = dojiNhanItem ? dojiNhanItem.buyPerChi : fallbackDojiBuy;
      const dojiSellPerChi = dojiNhanItem ? dojiNhanItem.sellPerChi : fallbackDojiSell;
      const dojiSjcBuyPerChi = dojiSjcItem ? dojiSjcItem.buyPerChi : fallbackDojiSjcBuy;
      const dojiSjcSellPerChi = dojiSjcItem ? dojiSjcItem.sellPerChi : fallbackDojiSjcSell;

      const summary = {
        // DOJI - Thương hiệu trọng tâm cập nhật tự động
        dojiBuyPerChi,
        dojiSellPerChi,
        dojiBuyPerLuong: dojiBuyPerChi * 10,
        dojiSellPerLuong: dojiSellPerChi * 10,
        dojiSjcBuyPerChi,
        dojiSjcSellPerChi,
        dojiSjcBuyPerLuong: dojiSjcBuyPerChi * 10,
        dojiSjcSellPerLuong: dojiSjcSellPerChi * 10,

        // Các hãng khác phục vụ tham khảo
        nhan9999SellPerChi: nhanItem ? nhanItem.sellPerChi : dojiSellPerChi,
        nhan9999BuyPerChi: nhanItem ? nhanItem.buyPerChi : dojiBuyPerChi,
        sjcSellPerChi: sjcItem ? sjcItem.sellPerChi : fallbackSjcSell,
        sjcBuyPerChi: sjcItem ? sjcItem.buyPerChi : fallbackSjcBuy,
        sjcSellPerLuong: (sjcItem ? sjcItem.sellPerChi : fallbackSjcSell) * 10,
        sjcBuyPerLuong: (sjcItem ? sjcItem.buyPerChi : fallbackSjcBuy) * 10,
      };

      const result = {
        success: true,
        updatedAtStr: latestUpdateStr || `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`,
        fetchedAt: new Date().toISOString(),
        source: 'DOJI & Thị trường vàng Việt Nam (GiaVang & WebGia)',
        summary,
        items,
      };

      // Lưu cache 30 giây (30,000 ms) thay vì 10 phút để luôn cập nhật trực tuyến mới nhất
      cachedGoldData = {
        data: result,
        expiresAt: now + 30 * 1000,
      };

      return res.json({ ...result, fromCache: false });
    } catch (err: any) {
      console.error('[GoldAPI] Lỗi khi xử lý giá vàng:', err);
      // Nếu có cache cũ thì trả về cache cũ
      if (cachedGoldData) {
        return res.json({ ...cachedGoldData.data, fromCache: true, warning: 'Không thể kết nối trực tiếp, dùng dữ liệu đã lưu gần nhất.' });
      }

      // Hoặc fallback dự phòng hợp lý
      return res.json({
        success: true,
        updatedAtStr: `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} (Tham chiếu)`,
        fetchedAt: new Date().toISOString(),
        source: 'DOJI & Thị trường vàng Việt Nam (Tham chiếu dự phòng)',
        summary: {
          dojiBuyPerChi: 14400000,
          dojiSellPerChi: 14800000,
          dojiBuyPerLuong: 144000000,
          dojiSellPerLuong: 148000000,
          dojiSjcBuyPerChi: 14460000,
          dojiSjcSellPerChi: 14760000,
          dojiSjcBuyPerLuong: 144600000,
          dojiSjcSellPerLuong: 147600000,
          nhan9999SellPerChi: 14800000,
          nhan9999BuyPerChi: 14400000,
          sjcSellPerChi: 14760000,
          sjcBuyPerChi: 14460000,
          sjcSellPerLuong: 147600000,
          sjcBuyPerLuong: 144600000,
        },
        items: [
          { brand: 'DOJI', name: 'Nhẫn tròn 999 Hưng Thịnh Vượng', category: 'nhan_9999', buyPerChi: 14400000, sellPerChi: 14800000, buyPerLuong: 144000000, sellPerLuong: 148000000, buyPrice: 14400000, sellPrice: 14800000, unit: 'chỉ' },
          { brand: 'DOJI', name: 'Âu Vàng Phúc Long (AVPL)', category: 'nhan_9999', buyPerChi: 14400000, sellPerChi: 14800000, buyPerLuong: 144000000, sellPerLuong: 148000000, buyPrice: 14400000, sellPrice: 14800000, unit: 'chỉ' },
          { brand: 'DOJI', name: 'SJC Lẻ tại DOJI', category: 'sjc_mieng', buyPerChi: 14460000, sellPerChi: 14760000, buyPerLuong: 144600000, sellPerLuong: 147600000, buyPrice: 14460000, sellPrice: 14760000, unit: 'chỉ' },
          { brand: 'SJC', name: 'Vàng SJC 1L, 10L (1 lượng)', category: 'sjc_mieng', buyPerChi: 14400000, sellPerChi: 14700000, buyPerLuong: 144000000, sellPerLuong: 147000000, buyPrice: 14400000, sellPrice: 14700000, unit: 'chỉ' },
          { brand: 'SJC', name: 'Vàng nhẫn SJC 99,99% (1 chỉ)', category: 'nhan_9999', buyPerChi: 14350000, sellPerChi: 14650000, buyPerLuong: 143500000, sellPerLuong: 146500000, buyPrice: 14350000, sellPrice: 14650000, unit: 'chỉ' },
        ],
      });
    }
  });

  // In-memory per-symbol cache cho dữ liệu bảng giá cổ phiếu (cache 30 giây để siêu nhạy, không nghẽn mạng)
  interface CachedStockQuote {
    quote: any;
    expiresAt: number;
  }
  const stockQuotesCache = new Map<string, CachedStockQuote>();
  let cachedVnIndex: { data: any; expiresAt: number } | null = null;

  // Endpoint API lấy bảng giá cổ phiếu Việt Nam (VPS & VNDirect & DNSE Entrade)
  app.get('/api/stock-rates', async (req, res) => {
    const rawSymbols = (req.query.symbols as string) || '';
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    // Parse và chuẩn hóa danh sách mã cổ phiếu
    const symbolsList = rawSymbols
      .split(/[,;\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z0-9]{3,4}$/.test(s));

    // Nếu không truyền mã nào, mặc định nạp các mã tiêu biểu
    if (symbolsList.length === 0) {
      symbolsList.push('HPG', 'FPT', 'TCB', 'MBB', 'VCB', 'VNM', 'MWG', 'SSI', 'VND', 'VIC');
    }

    const now = Date.now();

    // Kiểm tra xem các mã nào đã có trong cache và còn hạn
    const missingSymbols = symbolsList.filter((sym) => {
      if (forceRefresh) return true;
      const cached = stockQuotesCache.get(sym);
      return !cached || cached.expiresAt <= now;
    });

    const fallbackQuotes: Record<
      string,
      {
        price: number;
        refPrice: number;
        name: string;
        low5w: number;
        low10w: number;
        low20w: number;
        low30w: number;
        low52w: number;
      }
    > = {
      SSI: { price: 21200, refPrice: 21400, name: 'Chứng khoán SSI', low5w: 19200, low10w: 17350, low20w: 17350, low30w: 17350, low52w: 17350 },
      HPG: { price: 21200, refPrice: 21550, name: 'Tập đoàn Hòa Phát', low5w: 20750, low10w: 20100, low20w: 20100, low30w: 20100, low52w: 20100 },
      FPT: { price: 66200, refPrice: 65200, name: 'Công nghệ FPT', low5w: 61820, low10w: 55910, low20w: 55910, low30w: 55910, low52w: 55910 },
      TCB: { price: 31850, refPrice: 31600, name: 'Techcombank', low5w: 30600, low10w: 27800, low20w: 27800, low30w: 27770, low52w: 27770 },
      MBB: { price: 20150, refPrice: 19900, name: 'Ngân hàng Quân Đội', low5w: 19600, low10w: 17780, low20w: 17780, low30w: 17780, low52w: 17780 },
      VCB: { price: 59300, refPrice: 59900, name: 'Vietcombank', low5w: 57200, low10w: 52600, low20w: 52600, low30w: 52600, low52w: 52600 },
      VNM: { price: 61200, refPrice: 60200, name: 'Vinamilk', low5w: 58600, low10w: 54900, low20w: 54600, low30w: 54600, low52w: 53250 },
      MWG: { price: 72500, refPrice: 73100, name: 'Thế Giới Di Động', low5w: 66000, low10w: 59500, low20w: 52000, low30w: 48000, low52w: 42000 },
      VND: { price: 15200, refPrice: 14800, name: 'Chứng khoán VNDirect', low5w: 13800, low10w: 12900, low20w: 12500, low30w: 12000, low52w: 11500 },
      VIC: { price: 42500, refPrice: 42800, name: 'Vingroup', low5w: 41200, low10w: 40500, low20w: 39500, low30w: 38200, low52w: 37000 },
      VHM: { price: 43200, refPrice: 43500, name: 'Vinhomes', low5w: 39500, low10w: 37800, low20w: 36000, low30w: 35200, low52w: 34000 },
      VRE: { price: 18500, refPrice: 18800, name: 'Vincom Retail', low5w: 17500, low10w: 16800, low20w: 16200, low30w: 15800, low52w: 15000 },
      STB: { price: 33200, refPrice: 33000, name: 'Sacombank', low5w: 31000, low10w: 29500, low20w: 28500, low30w: 27500, low52w: 26000 },
      ACB: { price: 25400, refPrice: 25200, name: 'Ngân hàng Á Châu', low5w: 24200, low10w: 23500, low20w: 22800, low30w: 21800, low52w: 21000 },
      VPB: { price: 19800, refPrice: 19600, name: 'VPBank', low5w: 18800, low10w: 18200, low20w: 17800, low30w: 17200, low52w: 16800 },
      CTG: { price: 30600, refPrice: 30250, name: 'VietinBank', low5w: 29700, low10w: 28400, low20w: 28400, low30w: 28400, low52w: 28400 },
      BID: { price: 47800, refPrice: 48200, name: 'BIDV', low5w: 46200, low10w: 44500, low20w: 43500, low30w: 42000, low52w: 40500 },
      DGC: { price: 112000, refPrice: 113500, name: 'Hóa chất Đức Giang', low5w: 108000, low10w: 102000, low20w: 98000, low30w: 92000, low52w: 86000 },
      PNJ: { price: 96500, refPrice: 97000, name: 'Vàng bạc Phú Nhuận', low5w: 94000, low10w: 91500, low20w: 88500, low30w: 85000, low52w: 82000 },
      KDH: { price: 32500, refPrice: 32800, name: 'Nhà Khang Điền', low5w: 31200, low10w: 29800, low20w: 28500, low30w: 27800, low52w: 26500 },
      GAS: { price: 72000, refPrice: 72500, name: 'Tổng công ty Khí Việt Nam', low5w: 70000, low10w: 68500, low20w: 66800, low30w: 65000, low52w: 63000 },
      MSN: { price: 74200, refPrice: 74800, name: 'Tập đoàn Masan', low5w: 71500, low10w: 69200, low20w: 67000, low30w: 65500, low52w: 63000 },
      LPB: { price: 47500, refPrice: 48000, name: 'LPBank', low5w: 45700, low10w: 45700, low20w: 42660, low30w: 37330, low52w: 37330 },
      TCX: { price: 31700, refPrice: 31500, name: 'Cổ phiếu TCX', low5w: 31120, low10w: 30420, low20w: 30420, low30w: 30420, low52w: 28930 },
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const fromSec = nowSec - 380 * 86400; // 380 ngày để tính đủ 52 tuần lịch sử giá thấp nhất (260 phiên)

    // Nếu tất cả các mã đã có trong cache và VN-Index còn hạn -> Trả về siêu tốc từ memory
    if (missingSymbols.length === 0 && cachedVnIndex && cachedVnIndex.expiresAt > now) {
      const cachedStocks: Record<string, any> = {};
      for (const sym of symbolsList) {
        const item = stockQuotesCache.get(sym);
        if (item) cachedStocks[sym] = item.quote;
      }
      return res.json({
        success: true,
        updatedAtStr: `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`,
        fetchedAt: new Date().toISOString(),
        source: 'Bảng giá Chứng khoán Việt Nam (DNSE & VPS Realtime Cache)',
        vnindex: cachedVnIndex.data,
        stocks: cachedStocks,
        fromCache: true,
      });
    }

    // Lấy dữ liệu VNINDEX trực tiếp thời gian thực từ VPS Realtime Datafeed nếu chưa có cache
    let vnindexData = cachedVnIndex?.data || {
      price: 1819.67,
      change: 4.01,
      changePercent: 0.22,
      volume: '56.2M CP (~1.543 tỷ)',
    };

    if (!cachedVnIndex || cachedVnIndex.expiresAt <= now || forceRefresh) {
      try {
        // Ưu tiên số 1: VPS Real-time Index Detail (Mã 10 = VN-INDEX sàn HOSE) - cập nhật từng giây từ Sở GDCK
        const vpsIndexRes = await fetch('https://bgapidatafeed.vps.com.vn/getlistindexdetail/10', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(3000),
        });

        if (vpsIndexRes.ok) {
          const vpsIndexJson = await vpsIndexRes.json();
          if (Array.isArray(vpsIndexJson) && vpsIndexJson.length > 0 && vpsIndexJson[0]?.cIndex > 0) {
            const item = vpsIndexJson[0];
            const refIndex = (item.oIndex && item.oIndex > 0) ? item.oIndex : item.cIndex;
            let diff = item.cIndex - refIndex;
            let pct = refIndex > 0 ? (diff / refIndex) * 100 : 0;

            if (item.ot && typeof item.ot === 'string') {
              const parts = item.ot.split('|');
              if (parts.length >= 2) {
                const rawDiff = parseFloat(parts[0]);
                const rawPct = parseFloat(parts[1].replace('%', ''));
                // Chuỗi ot trong VPS API chỉ trả về giá trị độ lớn tuyệt đối (ví dụ: "18.55|1.02%").
                // Hướng tăng/giảm (+/-) bắt buộc phải xác định chuẩn xác dựa trên tương quan giá hiện tại (cIndex) và giá tham chiếu (oIndex).
                const sign = item.cIndex < refIndex ? -1 : (item.cIndex > refIndex ? 1 : 0);
                if (!isNaN(rawDiff)) {
                  diff = rawDiff < 0 ? rawDiff : sign * Math.abs(rawDiff);
                }
                if (!isNaN(rawPct)) {
                  pct = rawPct < 0 ? rawPct : sign * Math.abs(rawPct);
                }
              }
            }
            const volSharesStr = item.vol > 0 ? `${(item.vol / 1e6).toFixed(1)}M CP` : '';
            const estValueTrillion = item.value > 0 ? Math.round(item.value / 1000).toLocaleString('vi-VN') : '';
            const volDisplay = volSharesStr && estValueTrillion 
              ? `${volSharesStr} (~${estValueTrillion} tỷ)` 
              : (volSharesStr || `${estValueTrillion} tỷ` || '');

            vnindexData = {
              price: Number(item.cIndex.toFixed(2)),
              change: Number(diff.toFixed(2)),
              changePercent: Number(pct.toFixed(2)),
              volume: volDisplay || `${(item.vol / 1e6).toFixed(1)}M CP`,
            };
            cachedVnIndex = { data: vnindexData, expiresAt: now + 30000 };
          }
        }
      } catch (vpsIndexErr) {
        console.warn('[StockAPI] Lỗi lấy VN-Index realtime từ VPS, chuyển sang Entrade:', vpsIndexErr);
        try {
          const vnRes = await fetch(
            `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${nowSec - 14 * 86400}&to=${nowSec}&symbol=VNINDEX&resolution=1D`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                Accept: 'application/json',
              },
              signal: AbortSignal.timeout(3000),
            }
          );
          if (vnRes.ok) {
            const vJson = await vnRes.json();
            if (vJson && Array.isArray(vJson.c) && vJson.c.length > 0) {
              const vLast = vJson.c[vJson.c.length - 1];
              const vPrev = vJson.c.length > 1 ? vJson.c[vJson.c.length - 2] : vLast;
              const vDiff = vLast - vPrev;
              const vPct = vPrev > 0 ? (vDiff / vPrev) * 100 : 0;
              const vVol = Array.isArray(vJson.v) && vJson.v.length > 0 ? vJson.v[vJson.v.length - 1] : 0;
              const volSharesStr = vVol > 0 ? `${(vVol / 1e6).toFixed(1)}M CP` : '';
              const estValueTrillion = vVol > 0 ? Math.round((vVol * 27600) / 1e9).toLocaleString('vi-VN') : '23,850';
              const volDisplay = volSharesStr ? `${volSharesStr} (~${estValueTrillion} tỷ)` : `${estValueTrillion} tỷ`;
              vnindexData = {
                price: Number(vLast.toFixed(2)),
                change: Number(vDiff.toFixed(2)),
                changePercent: Number(vPct.toFixed(2)),
                volume: volDisplay,
              };
              cachedVnIndex = { data: vnindexData, expiresAt: now + 30000 };
            }
          }
        } catch (e) {}
      }
    }

    // 1. Quét song song siêu tốc cho các mã cần cập nhật: VPS Board Realtime
    const fetchTargets = missingSymbols.length > 0 ? missingSymbols : symbolsList;
    const vpsMap = new Map<string, any>();
    try {
      const vpsUrl = `https://bgapidatafeed.vps.com.vn/getliststockdata/${fetchTargets.join(',')}`;
      const vpsRes = await fetch(vpsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });
      if (vpsRes.ok) {
        const vpsList = await vpsRes.json();
        if (Array.isArray(vpsList)) {
          for (const item of vpsList) {
            if (item && item.sym) {
              vpsMap.set(item.sym.toUpperCase(), item);
            }
          }
        }
      }
    } catch (vpsErr) {
      console.warn('[StockAPI] VPS fetch error:', vpsErr);
    }

    // 2. Lấy dữ liệu từng mã: kết hợp VPS Real-time + DNSE Lịch sử
    const stocksResult: Record<string, any> = {};
    await Promise.all(
      symbolsList.map(async (sym) => {
        const fb = fallbackQuotes[sym] || {
          price: 25000,
          refPrice: 25000,
          name: `Cổ phiếu ${sym}`,
          low5w: 24000,
          low10w: 22500,
          low20w: 21000,
          low30w: 20000,
          low52w: 19000,
        };

        const vpsItem = vpsMap.get(sym);

        // Giá khớp realtime từ VPS
        let vpsPrice = 0;
        let vpsRefPrice = 0;
        let vpsHigh = 0;
        let vpsLow = 0;
        let vpsVolume = 0;
        let vpsCeiling = 0;
        let vpsFloor = 0;

        if (vpsItem) {
          const rawLast = typeof vpsItem.lastPrice === 'number' ? vpsItem.lastPrice : parseFloat(vpsItem.lastPrice || '0');
          const rawRef = typeof vpsItem.r === 'number' ? vpsItem.r : parseFloat(vpsItem.r || '0');
          const rawHigh = typeof vpsItem.highPrice === 'number' ? vpsItem.highPrice : parseFloat(vpsItem.highPrice || '0');
          const rawLow = typeof vpsItem.lowPrice === 'number' ? vpsItem.lowPrice : parseFloat(vpsItem.lowPrice || '0');
          const rawCeil = typeof vpsItem.c === 'number' ? vpsItem.c : parseFloat(vpsItem.c || '0');
          const rawFlr = typeof vpsItem.f === 'number' ? vpsItem.f : parseFloat(vpsItem.f || '0');

          vpsRefPrice = Math.round((rawRef > 0 ? rawRef : rawLast) * 1000);
          vpsPrice = Math.round((rawLast > 0 ? rawLast : rawRef) * 1000);
          vpsHigh = Math.round((rawHigh > 0 ? rawHigh : rawLast || rawRef) * 1000);
          vpsLow = Math.round((rawLow > 0 ? rawLow : rawLast || rawRef) * 1000);
          vpsCeiling = Math.round((rawCeil > 0 ? rawCeil : 0) * 1000);
          vpsFloor = Math.round((rawFlr > 0 ? rawFlr : 0) * 1000);
          vpsVolume = typeof vpsItem.lot === 'number' ? vpsItem.lot : parseInt(vpsItem.lot || '0', 10);
        }

        // Lấy lịch sử nến từ DNSE để tính đáy 5w, 10w, 20w, 30w, 52w
        let dnseData: any = null;
        try {
          const dnseUrl = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${sym}&resolution=1D`;
          const res = await fetch(dnseUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(3500),
          });

          if (res.ok) {
            dnseData = await res.json();
          }
        } catch {}

        // Tính toán các mốc giá
        let finalPrice = vpsPrice > 0 ? vpsPrice : fb.price;
        let finalRefPrice = vpsRefPrice > 0 ? vpsRefPrice : fb.refPrice;
        let finalHigh = vpsHigh > 0 ? vpsHigh : finalPrice;
        let finalLow = vpsLow > 0 ? vpsLow : finalPrice;
        let finalVolume = vpsVolume > 0 ? vpsVolume : 0;

        let low5w = fb.low5w;
        let low10w = fb.low10w;
        let low20w = fb.low20w;
        let low30w = fb.low30w;
        let low52w = fb.low52w;

        if (dnseData && Array.isArray(dnseData.c) && dnseData.c.length > 0) {
          const dnseLast = dnseData.c[dnseData.c.length - 1] * 1000;
          const dnsePrev = (dnseData.c.length > 1 ? dnseData.c[dnseData.c.length - 2] : dnseData.c[dnseData.c.length - 1]) * 1000;

          // Nếu VPS chưa có thì lấy từ DNSE
          if (finalPrice <= 0) finalPrice = Math.round(dnseLast);
          if (finalRefPrice <= 0) finalRefPrice = Math.round(dnsePrev);

          const lArr: number[] = Array.isArray(dnseData.l) && dnseData.l.length > 0 ? dnseData.l : dnseData.c;
          const len = lArr.length;
          low5w = Math.round(Math.min(...lArr.slice(-Math.min(25, len))) * 1000);
          low10w = Math.round(Math.min(...lArr.slice(-Math.min(50, len))) * 1000);
          low20w = Math.round(Math.min(...lArr.slice(-Math.min(100, len))) * 1000);
          low30w = Math.round(Math.min(...lArr.slice(-Math.min(150, len))) * 1000);
          low52w = Math.round(Math.min(...lArr.slice(-Math.min(260, len))) * 1000);
        } else if (finalPrice > 0) {
          // Dự phóng gần đúng nếu không có lịch sử
          low5w = Math.min(low5w, Math.round(finalPrice * 0.95));
          low10w = Math.min(low10w, Math.round(finalPrice * 0.90));
          low20w = Math.min(low20w, Math.round(finalPrice * 0.85));
          low30w = Math.min(low30w, Math.round(finalPrice * 0.82));
          low52w = Math.min(low52w, Math.round(finalPrice * 0.78));
        }

        const change = finalPrice - finalRefPrice;
        const changePercent = finalRefPrice > 0 ? Number(((change / finalRefPrice) * 100).toFixed(2)) : 0;

        const diffFromLow5wPct = low5w > 0 ? Number((((finalPrice - low5w) / low5w) * 100).toFixed(1)) : 0;
        const diffFromLow10wPct = low10w > 0 ? Number((((finalPrice - low10w) / low10w) * 100).toFixed(1)) : 0;
        const diffFromLow20wPct = low20w > 0 ? Number((((finalPrice - low20w) / low20w) * 100).toFixed(1)) : 0;
        const diffFromLow30wPct = low30w > 0 ? Number((((finalPrice - low30w) / low30w) * 100).toFixed(1)) : 0;
        const diffFromLow52wPct = low52w > 0 ? Number((((finalPrice - low52w) / low52w) * 100).toFixed(1)) : 0;

        let valuationStatus = 'Vùng tích lũy';
        if (diffFromLow52wPct <= 3.5) {
          valuationStatus = 'Vùng đáy 52T (Gom cực tốt)';
        } else if (diffFromLow20wPct <= 5.0) {
          valuationStatus = 'Gần đáy 20T (Vùng gom tốt)';
        } else if (diffFromLow10wPct <= 3.5) {
          valuationStatus = 'Sát đáy 10T (Hấp dẫn)';
        } else if (diffFromLow5wPct <= 2.5) {
          valuationStatus = 'Đáy 5T (DCA tốt)';
        } else if (diffFromLow52wPct >= 35) {
          valuationStatus = 'Vùng tăng trưởng mạnh';
        } else {
          valuationStatus = 'Tích lũy ổn định';
        }

        stocksResult[sym] = {
          symbol: sym,
          name: fb.name || `Cổ phiếu ${sym}`,
          price: finalPrice,
          refPrice: finalRefPrice,
          change,
          changePercent,
          high: finalHigh,
          low: finalLow,
          ceiling: vpsCeiling || undefined,
          floor: vpsFloor || undefined,
          volume: finalVolume,
          updatedAt: new Date().toLocaleTimeString('vi-VN'),
          low5w,
          low10w,
          low20w,
          low30w,
          low52w,
          diffFromLow5wPct,
          diffFromLow10wPct,
          diffFromLow20wPct,
          diffFromLow30wPct,
          diffFromLow52wPct,
          valuationStatus,
        };
      })
    );

    // Lưu từng mã vào per-symbol cache (30 giây TTL)
    for (const [sym, quote] of Object.entries(stocksResult)) {
      stockQuotesCache.set(sym, {
        quote,
        expiresAt: now + 30000,
      });
    }

    // Đảm bảo kết quả trả về đầy đủ tất cả các mã được yêu cầu
    const finalStocks: Record<string, any> = {};
    for (const sym of symbolsList) {
      if (stocksResult[sym]) {
        finalStocks[sym] = stocksResult[sym];
      } else {
        const cached = stockQuotesCache.get(sym);
        if (cached) {
          finalStocks[sym] = cached.quote;
        } else if (fallbackQuotes[sym]) {
          finalStocks[sym] = {
            symbol: sym,
            ...fallbackQuotes[sym],
            change: 0,
            changePercent: 0,
            high: fallbackQuotes[sym].price,
            low: fallbackQuotes[sym].price,
            volume: 0,
            valuationStatus: 'Tích lũy',
          };
        }
      }
    }

    const payload = {
      success: true,
      updatedAtStr: `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`,
      fetchedAt: new Date().toISOString(),
      source: 'Bảng giá Chứng khoán Việt Nam (DNSE & VPS Realtime)',
      vnindex: vnindexData,
      stocks: finalStocks,
    };

    return res.json({ ...payload, fromCache: false });
  });

  // In-memory cache cho chỉ số tài chính BCTC (P/E, P/B, ROE, ROA...)
  const cachedStockRatios = new Map<string, { data: any; expiresAt: number }>();

  const FALLBACK_RATIOS: Record<string, any> = {
    TCB: { pe: 8.8, pb: 1.29, roe: 16.1, roa: 2.45, period: 'Q2/2026', industry: 'Tài chính - Ngân hàng', rating: 'P/B 1.29x • ROE 16.1% • CASA đầu ngành' },
    HPG: { pe: 9.69, pb: 1.47, roe: 17.7, roa: 8.97, period: 'Q2/2026', industry: 'Sản xuất - Thép', rating: 'P/E 9.7x • ROE 17.7% • Vùng tích sản an toàn' },
    FPT: { pe: 12.99, pb: 3.23, roe: 27.1, roa: 14.1, period: 'Q2/2026', industry: 'Công nghệ thông tin', rating: 'ROE 27.1% • Tăng trưởng bền vững >20%/năm' },
    MBB: { pe: 6.25, pb: 1.15, roe: 22.4, roa: 2.65, period: 'Q2/2026', industry: 'Tài chính - Ngân hàng', rating: 'P/E 6.2x • ROE 22.4% • Tăng trưởng tín dụng cao' },
    SSI: { pe: 13.5, pb: 1.35, roe: 13.2, roa: 4.8, period: 'Q2/2026', industry: 'Dịch vụ Tài chính', rating: 'P/B 1.35x • Hưởng lợi nâng hạng FTSE' },
    VCB: { pe: 14.2, pb: 2.18, roe: 18.0, roa: 1.71, period: 'Q2/2026', industry: 'Tài chính - Ngân hàng', rating: 'P/B 2.18x • Chất lượng tài sản số 1 VN' },
    VNM: { pe: 14.8, pb: 3.85, roe: 28.5, roa: 19.2, period: 'Q2/2026', industry: 'Thực phẩm & Đồ uống', rating: 'ROE 28.5% • Cổ tức tiền mặt cao' },
    MWG: { pe: 16.2, pb: 2.8, roe: 18.9, roa: 6.8, period: 'Q2/2026', industry: 'Bán lẻ tiêu dùng', rating: 'Chu kỳ phục hồi lợi nhuận bách hóa' },
  };

  async function fetchRatiosForSymbol(sym: string) {
    const cached = cachedStockRatios.get(sym);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const res = await fetch(`https://api.simplize.vn/api/company/fi/ratio/${encodeURIComponent(sym)}?period=Q&size=1&type=ratio`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.data?.items?.length > 0) {
          const item = json.data.items[0];
          const pe = typeof item.op1 === 'number' && item.op1 > 0 ? Number(item.op1.toFixed(2)) : undefined;
          const pb = typeof item.op2 === 'number' && item.op2 > 0 ? Number(item.op2.toFixed(2)) : undefined;
          const roe = typeof item.op17 === 'number' && item.op17 > 0 ? Number(item.op17.toFixed(1)) : (typeof item.op3 === 'number' ? Number(item.op3.toFixed(1)) : undefined);
          const roa = typeof item.op18 === 'number' && item.op18 > 0 ? Number(item.op18.toFixed(1)) : undefined;
          const period = item.periodDateName || 'Q2/2026';
          const industry = json.data.industryGroup || 'Doanh nghiệp niêm yết';

          let rating = 'Định giá hợp lý';
          if (roe && roe >= 20 && pe && pe <= 15) {
            rating = `ROE ${roe}% • P/E ${pe}x (Tích sản tối ưu)`;
          } else if (pe && pe < 10) {
            rating = `P/E ${pe}x (Vùng giá chiết khấu rẻ)`;
          } else if (pb && pb < 1.3) {
            rating = `P/B ${pb}x (Sát giá trị sổ sách)`;
          } else if (roe && roe >= 15) {
            rating = `ROE ${roe}% (Hiệu quả sinh lời cao)`;
          }

          const ratioData = {
            symbol: sym,
            pe,
            pb,
            roe,
            roa,
            period,
            industry,
            rating,
            source: 'TCBS & Simplize BCTC',
          };

          cachedStockRatios.set(sym, { data: ratioData, expiresAt: Date.now() + 15 * 60 * 1000 });
          return ratioData;
        }
      }
    } catch (err: any) {
      console.warn(`[StockRatios] Lỗi lấy BCTC cho ${sym}:`, err?.message);
    }

    const fb = FALLBACK_RATIOS[sym] || {
      symbol: sym,
      pe: 11.5,
      pb: 1.45,
      roe: 18.2,
      roa: 7.5,
      period: 'Q2/2026',
      industry: 'Doanh nghiệp niêm yết',
      rating: 'Định giá tham chiếu BCTC',
      source: 'TCBS & BCTC Tham Chiếu',
    };
    return fb;
  }

  // API lấy chỉ số tài chính P/E, P/B, ROE cho từng mã cổ phiếu
  app.get('/api/stock-ratios/:symbol', async (req, res) => {
    const rawSym = (req.params.symbol || '').trim().toUpperCase();
    if (!rawSym || !/^[A-Z0-9]{3,4}$/.test(rawSym)) {
      return res.status(400).json({ error: 'Mã cổ phiếu không hợp lệ' });
    }

    const data = await fetchRatiosForSymbol(rawSym);
    return res.json({ success: true, data });
  });

  // API lấy hàng loạt chỉ số tài chính BCTC cho danh sách mã
  app.get('/api/stock-ratios', async (req, res) => {
    const rawSymbols = (req.query.symbols as string) || '';
    const symbolsList = rawSymbols
      .split(/[,;\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z0-9]{3,4}$/.test(s));

    if (symbolsList.length === 0) {
      symbolsList.push('HPG', 'TCB', 'FPT', 'MBB', 'SSI');
    }

    const results: Record<string, any> = {};
    await Promise.all(
      symbolsList.map(async (sym) => {
        results[sym] = await fetchRatiosForSymbol(sym);
      })
    );

    return res.json({ success: true, ratios: results });
  });

  // In-memory cache cho Lãi suất Ngân hàng (cache 30 phút)
  let cachedBankRatesData: { data: any; expiresAt: number } | null = null;

  // API Lãi suất Ngân hàng trực tuyến theo ngày
  app.get('/api/bank-rates', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const now = Date.now();

    if (!forceRefresh && cachedBankRatesData && now < cachedBankRatesData.expiresAt) {
      return res.json({ ...cachedBankRatesData.data, fromCache: true });
    }

    try {
      const resp = await fetch('https://topi.vn/lai-suat-tiet-kiem-ngan-hang-nao-cao-nhat.html', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!resp.ok) throw new Error(`Topi HTTP error ${resp.status}`);
      const html = await resp.text();
      const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];

      const cleanRate = (v: string) => {
        if (!v || v === '-' || v.trim() === '') return 0;
        return parseFloat(v.replace(',', '.').trim()) || 0;
      };

      const parseTableRows = (tHtml: string) => {
        const rows = tHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        const list: Array<{
          bank: string;
          kkh: number;
          m1: number;
          m3: number;
          m6: number;
          m12: number;
          m18: number;
          m24: number;
          m36: number;
        }> = [];

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].replace(/<[^>]+>/g, '|').split('|').map((s) => s.trim()).filter(Boolean);
          if (cols.length >= 7) {
            list.push({
              bank: cols[0],
              kkh: cleanRate(cols[1]),
              m1: cleanRate(cols[2]),
              m3: cleanRate(cols[3]),
              m6: cleanRate(cols[4]),
              m12: cleanRate(cols[5]),
              m18: cleanRate(cols[6] || cols[5]),
              m24: cleanRate(cols[7] || cols[6] || cols[5]),
              m36: cleanRate(cols[8] || cols[7] || cols[6] || cols[5]),
            });
          }
        }
        return list;
      };

      const counterRates = tables.length > 0 ? parseTableRows(tables[0]) : [];
      const onlineRates = tables.length > 1 ? parseTableRows(tables[1]) : [];

      const topOnline6M = [...onlineRates].filter((b) => b.m6 > 0).sort((a, b) => b.m6 - a.m6).slice(0, 8);
      const topOnline12M = [...onlineRates].filter((b) => b.m12 > 0).sort((a, b) => b.m12 - a.m12).slice(0, 8);
      const topOnline24M = [...onlineRates].filter((b) => b.m24 > 0).sort((a, b) => b.m24 - a.m24).slice(0, 8);

      const big4Names = ['Vietcombank', 'BIDV', 'Agribank', 'VietinBank'];
      const big4Rates = counterRates.filter((b) => big4Names.some((name) => b.bank.toLowerCase().includes(name.toLowerCase())));

      // Danh mục Chứng Chỉ Tiền Gửi & Gói Lãi Suất Sinh Lời Cao (8.0% - 9.4%)
      const cdAndHighYieldRates = [
        {
          bank: 'NCB (Tiết Kiệm An Phú & CCTG)',
          kkh: 0.5,
          m1: 4.7,
          m3: 4.75,
          m6: 6.2,
          m12: 8.2,
          m18: 9.3,
          m24: 9.4,
          m36: 9.4,
          isSpecial: true,
          productType: 'Chứng Chỉ Tiền Gửi / Tiết Kiệm An Phú',
          condition: 'Gửi tích lũy dài hạn hoặc Chứng chỉ tiền gửi từ 10 - 50 triệu',
          note: 'Lãi suất thực nhận 9.3% - 9.4%/năm cho kỳ hạn 18–36 tháng và CCTG, chuyển nhượng tự do trên app',
        },
        {
          bank: 'Cake by VPBank (Ưu Đãi Trực Tuyến)',
          kkh: 0.2,
          m1: 5.5,
          m3: 6.0,
          m6: 9.0,
          m12: 9.2,
          m18: 9.3,
          m24: 9.4,
          m36: 9.4,
          isSpecial: true,
          productType: 'Tiết Kiệm Online Tích Lũy',
          condition: 'Khách hàng mới / Tiền gửi tích lũy trên ứng dụng Cake by VPBank',
          note: 'Cộng thêm tới 2.0%/năm kỳ hạn 10-24 tháng theo chương trình ưu đãi độc quyền',
        },
        {
          bank: 'VPBank (Chứng Chỉ Tiền Gửi)',
          kkh: 0.5,
          m1: 0,
          m3: 0,
          m6: 7.8,
          m12: 8.5,
          m18: 8.8,
          m24: 9.0,
          m36: 9.0,
          isSpecial: true,
          productType: 'Chứng Chỉ Tiền Gửi (CCTG)',
          condition: 'Mệnh giá từ 50 triệu đồng, kỳ hạn 24 - 36 tháng',
          note: 'Lãi suất cố định 9.0%/năm, được phép chuyển nhượng, cho tặng hoặc cầm cố vay linh hoạt',
        },
        {
          bank: 'Timo by BVBank (Ưu Đãi Trực Tuyến)',
          kkh: 0.3,
          m1: 4.75,
          m3: 4.75,
          m6: 7.5,
          m12: 8.0,
          m18: 8.2,
          m24: 8.2,
          m36: 8.2,
          isSpecial: true,
          productType: 'Tiết Kiệm Trực Tuyến Timo',
          condition: 'Mở sổ online trên ứng dụng Timo (kỳ hạn dài)',
          note: 'Ưu đãi lãi suất bậc thang cho dòng tiền tích sản mới',
        },
        {
          bank: 'ACB (Tiết Kiệm Online Phúc An Sinh)',
          kkh: 0.5,
          m1: 4.5,
          m3: 4.7,
          m6: 7.6,
          m12: 7.8,
          m18: 7.8,
          m24: 7.8,
          m36: 7.8,
          isSpecial: true,
          productType: 'Tiết Kiệm Online',
          condition: 'Gửi online trên ACB ONE từ 1 triệu đồng',
          note: 'Lãi suất kịch trần kỳ hạn 12 tháng không yêu cầu số dư lớn',
        },
        {
          bank: 'Sacombank (Tiết Kiệm Trực Tuyến)',
          kkh: 0.5,
          m1: 4.5,
          m3: 4.5,
          m6: 6.8,
          m12: 7.5,
          m18: 7.5,
          m24: 7.5,
          m36: 7.5,
          isSpecial: true,
          productType: 'Tiết Kiệm Trực Tuyến',
          condition: 'Gửi từ 1 triệu đồng trên Sacombank Pay',
          note: 'Cộng thêm biên độ lãi suất khi mở trực tuyến',
        },
      ];

      // Danh mục Gói Lãi Suất Đặc Biệt (9.0% - 10.0%) kèm điều kiện số tiền lớn
      const specialHighRates = [
        {
          bank: 'PVcomBank (Gói Siêu VIP)',
          kkh: 0.5,
          m1: 0,
          m3: 0,
          m6: 9.5,
          m12: 10.0,
          m24: 10.0,
          isSpecial: true,
          condition: 'Gửi từ 2.000 tỷ đồng trở lên (kỳ hạn 12-13 tháng)',
          note: 'Lĩnh lãi cuối kỳ, chỉ áp dụng tại quầy cho khoản tiền siêu khủng',
        },
        {
          bank: 'HDBank (Gói Khách Hàng Lớn)',
          kkh: 0.5,
          m1: 0,
          m3: 0,
          m6: 8.1,
          m12: 9.0,
          m24: 8.8,
          isSpecial: true,
          condition: 'Gửi từ 500 tỷ đồng trở lên (kỳ hạn 13 tháng)',
          note: 'Duy trì số dư tối thiểu từ 500 tỷ',
        },
        {
          bank: 'MSB (Gói Tiền Gửi Lớn)',
          kkh: 0.5,
          m1: 0,
          m3: 0,
          m6: 8.5,
          m12: 9.0,
          m24: 9.0,
          isSpecial: true,
          condition: 'Sổ mở mới hoặc gia hạn từ 500 tỷ đồng (kỳ hạn 12-13T)',
          note: 'Số dư tối thiểu 500 tỷ VNĐ',
        },
        {
          bank: 'Nam A Bank / CCTG Doanh Nghiệp',
          kkh: 0.5,
          m1: 0,
          m3: 0,
          m6: 8.0,
          m12: 8.3,
          m24: 8.5,
          isSpecial: true,
          condition: 'Gửi từ 500 tỷ (cần TGĐ phê duyệt) hoặc CCTG tổ chức',
          note: 'Áp dụng cho kỳ hạn 24-36T hoặc chứng chỉ tiền gửi tổ chức',
        },
      ];

      const today = new Date();
      const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

      const payload = {
        success: true,
        updatedAtStr: `Cập nhật ngày ${dateStr}`,
        fetchedAt: new Date().toISOString(),
        source: 'Topi & Bảng biểu lãi suất ngân hàng Việt Nam',
        counterRates,
        onlineRates,
        topOnline6M,
        topOnline12M,
        topOnline24M,
        big4Rates,
        cdAndHighYieldRates,
        specialHighRates,
      };

      cachedBankRatesData = {
        data: payload,
        expiresAt: now + 15 * 60 * 1000,
      };

      return res.json({ ...payload, fromCache: false });
    } catch (err: any) {
      console.warn('[BankRatesAPI] Lỗi quét bảng lãi suất:', err?.message);
      if (cachedBankRatesData) {
        return res.json({ ...cachedBankRatesData.data, fromCache: true });
      }

      const today = new Date();
      const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      return res.json({
        success: true,
        updatedAtStr: `Cập nhật ngày ${dateStr} (Tham chiếu)`,
        fetchedAt: new Date().toISOString(),
        source: 'Ngân hàng Nhà nước & Bảng lãi suất tổng hợp',
        topOnline12M: [
          { bank: 'NCB / HDBank', m12: 9.0, m6: 6.8, m24: 9.2, kkh: 0.5 },
          { bank: 'ACB', m12: 7.8, m6: 7.6, m24: 7.8, kkh: 0.5 },
          { bank: 'Sacombank', m12: 7.5, m6: 6.8, m24: 7.5, kkh: 0.5 },
          { bank: 'LPBank', m12: 7.15, m6: 7.0, m24: 6.1, kkh: 0.1 },
          { bank: 'OceanBank (MBV)', m12: 7.0, m6: 6.5, m24: 7.0, kkh: 0.2 },
          { bank: 'Techcombank', m12: 6.8, m6: 6.3, m24: 7.0, kkh: 0.3 },
          { bank: 'Bắc Á Bank', m12: 6.95, m6: 7.05, m24: 6.95, kkh: 0.5 },
        ],
        counterRates: [],
        onlineRates: [],
        cdAndHighYieldRates: [
          {
            bank: 'NCB (Tiết Kiệm An Phú & CCTG)',
            kkh: 0.5,
            m1: 4.7,
            m3: 4.75,
            m6: 6.2,
            m12: 8.2,
            m18: 9.3,
            m24: 9.4,
            m36: 9.4,
            isSpecial: true,
            productType: 'Chứng Chỉ Tiền Gửi / Tiết Kiệm An Phú',
            condition: 'Gửi tích lũy dài hạn hoặc Chứng chỉ tiền gửi từ 10 - 50 triệu',
            note: 'Lãi suất thực nhận 9.3% - 9.4%/năm cho kỳ hạn 18–36 tháng và CCTG, chuyển nhượng tự do trên app',
          },
          {
            bank: 'Cake by VPBank (Ưu Đãi Trực Tuyến)',
            kkh: 0.2,
            m1: 5.5,
            m3: 6.0,
            m6: 9.0,
            m12: 9.2,
            m18: 9.3,
            m24: 9.4,
            m36: 9.4,
            isSpecial: true,
            productType: 'Tiết Kiệm Online Tích Lũy',
            condition: 'Khách hàng mới / Tiền gửi tích lũy trên ứng dụng Cake by VPBank',
            note: 'Cộng thêm tới 2.0%/năm kỳ hạn 10-24 tháng theo chương trình ưu đãi độc quyền',
          },
          {
            bank: 'VPBank (Chứng Chỉ Tiền Gửi)',
            kkh: 0.5,
            m1: 0,
            m3: 0,
            m6: 7.8,
            m12: 8.5,
            m18: 8.8,
            m24: 9.0,
            m36: 9.0,
            isSpecial: true,
            productType: 'Chứng Chỉ Tiền Gửi (CCTG)',
            condition: 'Mệnh giá từ 50 triệu đồng, kỳ hạn 24 - 36 tháng',
            note: 'Lãi suất cố định 9.0%/năm, được phép chuyển nhượng, cho tặng hoặc cầm cố vay linh hoạt',
          },
        ],
        big4Rates: [
          { bank: 'Vietcombank', m12: 5.3, m6: 3.5, m24: 5.5, kkh: 0.1 },
          { bank: 'BIDV', m12: 5.9, m6: 3.5, m24: 6.0, kkh: 0.1 },
          { bank: 'VietinBank', m12: 5.6, m6: 3.5, m24: 5.8, kkh: 0.1 },
          { bank: 'Agribank', m12: 5.9, m6: 4.0, m24: 5.9, kkh: 0.2 },
        ],
        specialHighRates: [
          {
            bank: 'PVcomBank (Gói Siêu VIP)',
            kkh: 0.5,
            m1: 0,
            m3: 0,
            m6: 9.5,
            m12: 10.0,
            m24: 10.0,
            isSpecial: true,
            condition: 'Gửi từ 2.000 tỷ đồng trở lên (kỳ hạn 12-13 tháng)',
            note: 'Lĩnh lãi cuối kỳ, chỉ áp dụng tại quầy cho khoản tiền siêu khủng',
          },
          {
            bank: 'HDBank (Gói Khách Hàng Lớn)',
            kkh: 0.5,
            m1: 0,
            m3: 0,
            m6: 8.1,
            m12: 9.0,
            m24: 8.8,
            isSpecial: true,
            condition: 'Gửi từ 500 tỷ đồng trở lên (kỳ hạn 13 tháng)',
            note: 'Duy trì số dư tối thiểu từ 500 tỷ',
          },
          {
            bank: 'MSB (Gói Tiền Gửi Lớn)',
            kkh: 0.5,
            m1: 0,
            m3: 0,
            m6: 8.5,
            m12: 9.0,
            m24: 9.0,
            isSpecial: true,
            condition: 'Sổ mở mới hoặc gia hạn từ 500 tỷ đồng (kỳ hạn 12-13T)',
            note: 'Số dư tối thiểu 500 tỷ VNĐ',
          },
        ],
      });
    }
  });

  // Check SMTP server configuration status
  app.get('/api/smtp-status', (req, res) => {
    const envUser = process.env.SMTP_USER || process.env.GMAIL_USER;
    const envPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
    const configured = Boolean(envUser && envPass);

    res.json({
      configured,
      user: envUser ? envUser.trim() : null,
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
    });
  });

  // Direct Send Email Report Endpoint - Thực hiện gửi thư thực sự
  app.post('/api/send-email-report', async (req, res) => {
    try {
      const { email, emails, subject, htmlContent, textSummary, senderName, customSmtp } = req.body;

      // 1. Phân tích danh sách email nhận (hỗ trợ nhiều email cùng lúc)
      const rawRecipients: string[] = [];
      if (Array.isArray(emails)) {
        rawRecipients.push(...emails);
      }
      if (typeof email === 'string') {
        rawRecipients.push(...email.split(/[,;\n\r\t ]+/));
      } else if (Array.isArray(email)) {
        rawRecipients.push(...email);
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const validRecipients: string[] = [];
      for (const item of rawRecipients) {
        const clean = String(item).trim().toLowerCase();
        if (clean && emailRegex.test(clean) && !validRecipients.includes(clean)) {
          validRecipients.push(clean);
        }
      }

      if (validRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng nhập ít nhất một địa chỉ email nhận hợp lệ (ví dụ: hoannx.epu@gmail.com).',
        });
      }

      console.log(`[Email Dispatcher] Yêu cầu gửi tới ${validRecipients.length} hòm thư:`, validRecipients);

      // 2. Xác định thông tin tài khoản SMTP gửi thư
      const smtpUser = (customSmtp?.user || process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
      const smtpPass = (customSmtp?.pass || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').trim().replace(/\s+/g, '');
      const smtpHost = (customSmtp?.host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const smtpPort = Number(customSmtp?.port) || Number(process.env.SMTP_PORT) || (smtpHost.includes('gmail') ? 465 : 587);
      const smtpSecure = customSmtp?.secure !== undefined ? Boolean(customSmtp.secure) : (process.env.SMTP_SECURE === 'true' || smtpPort === 465);
      const fromDisplayName = senderName || process.env.SMTP_FROM_NAME || 'Tháp Tài Sản 3 Tầng';

      // 3. Nếu chưa cấu hình thông tin gửi email thật: BÁO RÕ RÀNG để người dùng không bị nhầm lẫn
      if (!smtpUser || !smtpPass) {
        console.warn('[Email Dispatcher] Chưa cấu hình SMTP_USER và SMTP_PASS');
        return res.status(400).json({
          success: false,
          requiresConfig: true,
          error: 'CHƯA_CẤU_HÌNH_SMTP',
          message: 'Chưa cấu hình Mật khẩu ứng dụng Gmail (App Password 16 ký tự). Thư thật chưa thể gửi tới hòm thư Gmail của bạn.',
          recipients: validRecipients,
          guidance: {
            title: 'Các bước 1 phút để gửi thư thật về Gmail của bạn:',
            steps: [
              '1. Truy cập https://myaccount.google.com/apppasswords (bật Xác minh 2 bước nếu chưa bật)',
              '2. Đặt tên ứng dụng là "Tháp Tài Sản" rồi bấm Tạo (Create)',
              '3. Google sẽ cấp cho bạn Mật khẩu ứng dụng gồm 16 chữ cái (ví dụ: abcd efgh ijkl mnop)',
              '4. Nhập email và mật khẩu 16 chữ cái này vào mục "Cấu hình gửi email thật" hoặc khai báo biến môi trường SMTP_USER / SMTP_PASS'
            ],
          },
        });
      }

      // 4. Khởi tạo kết nối SMTP thật sự với Google / Mail Server
      const transporter: Transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 12000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });

      console.log(`[Email Dispatcher] Đang gửi thư thật qua ${smtpHost}:${smtpPort} (Sender: ${smtpUser})...`);

      const sendResult = await transporter.sendMail({
        from: `"${fromDisplayName}" <${smtpUser}>`,
        to: validRecipients,
        subject: subject || 'Báo Cáo & Nhắc Nhở Mục Tiêu Tài Chính',
        text: textSummary,
        html: htmlContent,
      });

      console.log('[Email Dispatcher] Gửi thư thật thành công! Message ID:', sendResult.messageId);

      return res.json({
        success: true,
        message: `Đã gửi báo cáo tài chính thật thành công tới ${validRecipients.length} hòm thư (${validRecipients.join(', ')})! Vui lòng kiểm tra hộp thư đến.`,
        details: {
          recipients: validRecipients,
          sender: smtpUser,
          subject,
          dispatchedAt: new Date().toISOString(),
          sentVia: 'gmail_smtp',
          messageId: sendResult.messageId,
        },
      });
    } catch (error: any) {
      console.error('[Email Dispatcher] Lỗi trong quá trình gửi email thật:', error);

      let userFriendlyError = error?.message || 'Có lỗi xảy ra khi kết nối máy chủ gửi email.';
      if (
        userFriendlyError.includes('EAUTH') ||
        userFriendlyError.includes('535') ||
        userFriendlyError.includes('Username and Password not accepted')
      ) {
        userFriendlyError =
          'Google từ chối đăng nhập (Mã lỗi 535): Vui lòng kiểm tra lại: Bạn cần dùng "Mật khẩu ứng dụng" (App Password 16 ký tự) tạo tại https://myaccount.google.com/apppasswords, KHÔNG dùng mật khẩu đăng nhập tài khoản Google thông thường.';
      } else if (userFriendlyError.includes('ETIMEDOUT') || userFriendlyError.includes('ECONNREFUSED')) {
        userFriendlyError = 'Không thể kết nối đến máy chủ SMTP. Vui lòng kiểm tra lại cấu hình cổng mạng (Port 465 / 587) hoặc kết nối internet.';
      }

      return res.status(500).json({
        success: false,
        error: userFriendlyError,
        rawError: error?.message,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
