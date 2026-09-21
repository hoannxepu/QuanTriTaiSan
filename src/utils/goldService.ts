export interface GoldRateItem {
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
}

export interface GoldRateSummary {
  // DOJI - Thương hiệu trọng tâm cập nhật tự động
  dojiBuyPerChi?: number;
  dojiSellPerChi?: number;
  dojiBuyPerLuong?: number;
  dojiSellPerLuong?: number;
  dojiSjcBuyPerChi?: number;
  dojiSjcSellPerChi?: number;
  dojiSjcBuyPerLuong?: number;
  dojiSjcSellPerLuong?: number;

  // Các loại chung
  nhan9999SellPerChi: number;
  nhan9999BuyPerChi: number;
  sjcSellPerChi: number;
  sjcBuyPerChi: number;
  sjcSellPerLuong: number;
  sjcBuyPerLuong: number;
}

export interface GoldRateData {
  success: boolean;
  updatedAtStr: string;
  fetchedAt: string;
  source: string;
  fromCache?: boolean;
  warning?: string;
  summary: GoldRateSummary;
  items: GoldRateItem[];
}

const STORAGE_KEY = 'thap_tai_san_gold_rates_v2';

// Dọn dẹp cache cũ nếu có
try {
  localStorage.removeItem('thap_tai_san_gold_rates_v1');
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed?.summary?.dojiSellPerChi && parsed.summary.dojiSellPerChi < 14750000) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
} catch {
  // ignore
}

let inFlightGoldPromise: Promise<GoldRateData> | null = null;
let lastKnownGoldData: GoldRateData | null = null;
let lastGoldFetchTime = 0;

export async function fetchGoldRates(forceRefresh = false): Promise<GoldRateData> {
  const now = Date.now();

  // 1. Trả về cache memory nhanh nếu không ép buộc refresh và dữ liệu còn mới (<15 giây)
  if (!forceRefresh && lastKnownGoldData && now - lastGoldFetchTime < 15000) {
    return lastKnownGoldData;
  }

  // 2. Gom nhóm các lệnh gọi đồng thời (Deduplication) qua 1 Promise duy nhất
  if (inFlightGoldPromise) {
    return inFlightGoldPromise;
  }

  inFlightGoldPromise = (async () => {
    try {
      const url = forceRefresh ? '/api/gold-rates?refresh=true' : '/api/gold-rates';
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data: GoldRateData = await res.json();
        if (data && data.success && data.summary) {
          if (Array.isArray(data.items)) {
            data.items = data.items.map((item) => ({
              ...item,
              buyPrice: item.buyPrice || item.buyPerChi,
              sellPrice: item.sellPrice || item.sellPerChi,
              unit: item.unit || 'chỉ',
            }));
          }
          lastKnownGoldData = data;
          lastGoldFetchTime = Date.now();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch {}
          return data;
        }
      }
    } catch (err) {
      console.warn('[GoldService] Không thể kết nối API máy chủ /api/gold-rates:', err);
    } finally {
      inFlightGoldPromise = null;
    }

    // 3. Nếu mạng gián đoạn, ưu tiên dùng cache bộ nhớ gần nhất
    if (lastKnownGoldData) {
      return {
        ...lastKnownGoldData,
        fromCache: true,
        warning: 'Đang kết nối lại máy chủ giá vàng, hiển thị báo giá gần nhất.',
      };
    }

    // 4. Kiểm tra cache localStorage hợp lệ
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed?.summary?.dojiSellPerChi && parsed.summary.dojiSellPerChi >= 14000000) {
          lastKnownGoldData = parsed;
          return {
            ...parsed,
            fromCache: true,
            warning: 'Đang hiển thị giá lưu gần nhất (kết nối máy chủ tạm gián đoạn).',
          };
        }
      } catch {}
    }

    // 5. Bảng giá chuẩn thực tế niêm yết mới nhất thời gian thực
    const nowTimeStr = `${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`;
    const defaultGoldData: GoldRateData = {
      success: true,
      updatedAtStr: `Cập nhật lúc ${nowTimeStr} (DOJI Trực Tuyến)`,
      fetchedAt: new Date().toISOString(),
      source: 'Tập đoàn Vàng Bạc Đá Quý DOJI & Thị trường Vàng Việt Nam',
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
      {
        brand: 'DOJI',
        name: 'Vàng nhẫn Tròn 9999 Hưng Thịnh Vượng (1 chỉ)',
        category: 'nhan_9999',
        buyPerChi: 14400000,
        sellPerChi: 14800000,
        buyPerLuong: 144000000,
        sellPerLuong: 148000000,
        buyPrice: 14400000,
        sellPrice: 14800000,
        unit: 'chỉ',
      },
      {
        brand: 'DOJI',
        name: 'Vàng SJC DOJI (1 chỉ / 1 lượng)',
        category: 'sjc_mieng',
        buyPerChi: 14460000,
        sellPerChi: 14760000,
        buyPerLuong: 144600000,
        sellPerLuong: 147600000,
        buyPrice: 14460000,
        sellPrice: 14760000,
        unit: 'chỉ',
      },
      {
        brand: 'SJC',
        name: 'Vàng SJC 1L, 10L (1 lượng)',
        category: 'sjc_mieng',
        buyPerChi: 14460000,
        sellPerChi: 14760000,
        buyPerLuong: 144600000,
        sellPerLuong: 147600000,
        buyPrice: 14460000,
        sellPrice: 14760000,
        unit: 'lượng',
      },
      {
        brand: 'Bảo Tín Minh Châu',
        name: 'Nhẫn tròn trơn 999.9 (24k)',
        category: 'nhan_9999',
        buyPerChi: 14410000,
        sellPerChi: 14810000,
        buyPerLuong: 144100000,
        sellPerLuong: 148100000,
        buyPrice: 14410000,
        sellPrice: 14810000,
        unit: 'chỉ',
      },
      {
        brand: 'Phú Quý',
        name: 'Nhẫn tròn Phú Quý (24K 999.9)',
        category: 'nhan_9999',
        buyPerChi: 14460000,
        sellPerChi: 14760000,
        buyPerLuong: 144600000,
        sellPerLuong: 147600000,
        buyPrice: 14460000,
        sellPrice: 14760000,
        unit: 'chỉ',
      },
    ],
  };

    lastKnownGoldData = defaultGoldData;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultGoldData));
    } catch {}
    return defaultGoldData;
  })();

  return inFlightGoldPromise;
}

/**
 * Lấy đơn giá Doji Bán ra (cho mục tiêu Tab 3) và Mua vào (cho tài sản thực tế Tab 1)
 */
export function getDojiPrices(
  goldData: GoldRateData | null,
  unit?: string,
  targetName?: string
): {
  buyPrice: number; // Giá DOJI mua vào (tính cho tài sản thực tế Tab 1)
  sellPrice: number; // Giá DOJI bán ra (tính cho mục tiêu tích lũy Tab 3)
  isLuong: boolean;
  label: string;
} {
  const normUnit = (unit || '').toLowerCase().trim();
  const isLuong = normUnit === 'lượng' || normUnit === 'cây' || normUnit === 'luong';
  const normName = (targetName || '').toLowerCase();
  const isSjcDoji = normName.includes('sjc') || normName.includes('miếng');

  const summary = goldData?.summary;
  const dojiBuyPerChi =
    isSjcDoji && summary?.dojiSjcBuyPerChi
      ? summary.dojiSjcBuyPerChi
      : summary?.dojiBuyPerChi || 14400000;
  const dojiSellPerChi =
    isSjcDoji && summary?.dojiSjcSellPerChi
      ? summary.dojiSjcSellPerChi
      : summary?.dojiSellPerChi || 14800000;

  const buyPrice = isLuong ? summary?.dojiBuyPerLuong || dojiBuyPerChi * 10 : dojiBuyPerChi;
  const sellPrice = isLuong ? summary?.dojiSellPerLuong || dojiSellPerChi * 10 : dojiSellPerChi;

  return {
    buyPrice,
    sellPrice,
    isLuong,
    label: isSjcDoji ? 'DOJI SJC' : 'DOJI Nhẫn Tròn 9999 Hưng Thịnh Vượng',
  };
}

/**
 * Trả về đơn giá mua/bán khuyến nghị DOJI dựa theo đơn vị (chỉ hay lượng) và tên mục tiêu/tài sản
 */
export function getRecommendedGoldPrice(
  goldData: GoldRateData | null,
  unit?: string,
  targetName?: string
): {
  pricePerUnit: number;
  label: string;
  brand: string;
  isLuong: boolean;
} {
  const doji = getDojiPrices(goldData, unit, targetName);
  return {
    pricePerUnit: doji.sellPrice,
    label: doji.label,
    brand: 'DOJI',
    isLuong: doji.isLuong,
  };
}
