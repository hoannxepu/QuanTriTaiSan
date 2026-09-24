// Cloudflare Pages Function: /api/stock-rates
// Tự động chạy tại Cloudflare Edge Server khi deploy lên Cloudflare Pages
// Bỏ qua hoàn toàn rào cản CORS & CORP của trình duyệt

export async function onRequestGet(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const rawSymbols = url.searchParams.get('symbols') || '';

  // Parse danh sách mã
  let symbolsList = rawSymbols
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{3,4}$/.test(s));

  if (symbolsList.length === 0) {
    symbolsList = ['HPG', 'FPT', 'TCB', 'MBB', 'VCB', 'VNM', 'MWG', 'SSI', 'VND', 'VIC'];
  }

  const fallbackQuotes: Record<
    string,
    {
      price: number;
      refPrice: number;
      name: string;
      low52w: number;
      low2y: number;
      low3y: number;
    }
  > = {
    SSI: { price: 21100, refPrice: 20900, name: 'Chứng khoán SSI', low52w: 17350, low2y: 13800, low3y: 11500 },
    HPG: { price: 21050, refPrice: 21150, name: 'Tập đoàn Hòa Phát', low52w: 20100, low2y: 15850, low3y: 15280 },
    FPT: { price: 66100, refPrice: 66600, name: 'Công nghệ FPT', low52w: 55910, low2y: 42000, low3y: 38500 },
    TCB: { price: 33150, refPrice: 32300, name: 'Techcombank', low52w: 27770, low2y: 18500, low3y: 16200 },
    MBB: { price: 20050, refPrice: 20200, name: 'Ngân hàng Quân Đội', low52w: 17780, low2y: 13500, low3y: 12200 },
    VCB: { price: 59200, refPrice: 58900, name: 'Vietcombank', low52w: 52600, low2y: 48000, low3y: 44000 },
    VNM: { price: 61000, refPrice: 60300, name: 'Vinamilk', low52w: 53250, low2y: 52000, low3y: 51500 },
    MWG: { price: 72400, refPrice: 71700, name: 'Thế Giới Di Động', low52w: 42000, low2y: 36500, low3y: 35000 },
    VND: { price: 14950, refPrice: 14700, name: 'Chứng khoán VNDirect', low52w: 11500, low2y: 9800, low3y: 8500 },
    VIC: { price: 42500, refPrice: 42000, name: 'Vingroup', low52w: 38000, low2y: 35000, low3y: 34500 },
    VHM: { price: 41500, refPrice: 41200, name: 'Vinhomes', low52w: 36000, low2y: 34000, low3y: 33500 },
    VRE: { price: 18200, refPrice: 18150, name: 'Vincom Retail', low52w: 16000, low2y: 15200, low3y: 14800 },
    STB: { price: 34200, refPrice: 34000, name: 'Sacombank', low52w: 26000, low2y: 22000, low3y: 18500 },
    ACB: { price: 22100, refPrice: 22400, name: 'Ngân hàng Á Châu', low52w: 18500, low2y: 15500, low3y: 14200 },
    VPB: { price: 20500, refPrice: 20400, name: 'VPBank', low52w: 17800, low2y: 16000, low3y: 14500 },
    CTG: { price: 30900, refPrice: 31000, name: 'VietinBank', low52w: 28400, low2y: 22000, low3y: 20500 },
    BID: { price: 36300, refPrice: 36200, name: 'BIDV', low52w: 32000, low2y: 28500, low3y: 25000 },
    DGC: { price: 35650, refPrice: 35350, name: 'Hóa chất Đức Giang', low52w: 30500, low2y: 26000, low3y: 22000 },
    PNJ: { price: 36000, refPrice: 36900, name: 'Vàng bạc Phú Nhuận', low52w: 32000, low2y: 29500, low3y: 27000 },
    KDH: { price: 15950, refPrice: 15850, name: 'Nhà Khang Điền', low52w: 13000, low2y: 11500, low3y: 10500 },
    GAS: { price: 85200, refPrice: 86100, name: 'Tổng công ty Khí Việt Nam', low52w: 72000, low2y: 68000, low3y: 65000 },
    MSN: { price: 70000, refPrice: 67700, name: 'Tập đoàn Masan', low52w: 52000, low2y: 48000, low3y: 46000 },
  };

  const stocksResult: Record<string, any> = {};
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - 1150 * 86400; // 1150 ngày để tính đáy 52T, 2 năm, 3 năm

  // VNINDEX
  let vnindexData = {
    price: 1815.66,
    change: -7.11,
    changePercent: -0.39,
    volume: '862.1M CP (~23,850 tỷ)',
  };

  try {
    const vnRes = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${nowSec - 14 * 86400}&to=${nowSec}&symbol=VNINDEX&resolution=1D`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (vnRes.ok) {
      const vJson: any = await vnRes.json();
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
      }
    }
  } catch {}

  // Lấy dữ liệu VPS Realtime từ Cloudflare Edge Server
  const vpsMap = new Map<string, any>();
  try {
    const vpsUrl = `https://bgapidatafeed.vps.com.vn/getliststockdata/${symbolsList.join(',')}`;
    const vpsRes = await fetch(vpsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (vpsRes.ok) {
      const vpsList: any = await vpsRes.json();
      if (Array.isArray(vpsList)) {
        for (const item of vpsList) {
          if (item && item.sym) {
            vpsMap.set(item.sym.toUpperCase(), item);
          }
        }
      }
    }
  } catch (vpsErr) {
    console.warn('[CloudflareFunction] VPS fetch error:', vpsErr);
  }

  // Kết hợp VPS Realtime + DNSE lịch sử nến
  await Promise.all(
    symbolsList.map(async (sym) => {
      const fb = fallbackQuotes[sym] || {
        price: 25000,
        refPrice: 25000,
        name: `Cổ phiếu ${sym}`,
        low52w: 19000,
        low2y: 16000,
        low3y: 14000,
      };

      const vpsItem = vpsMap.get(sym);

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

      let dnseData: any = null;
      try {
        const dnseUrl = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${sym}&resolution=1D`;
        const res = await fetch(dnseUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          dnseData = await res.json();
        }
      } catch {}

      let finalPrice = vpsPrice > 0 ? vpsPrice : 0;
      let finalRefPrice = vpsRefPrice > 0 ? vpsRefPrice : 0;

      if (dnseData && Array.isArray(dnseData.c) && dnseData.c.length > 0) {
        const dnseLast = dnseData.c[dnseData.c.length - 1] * 1000;
        const dnsePrev = (dnseData.c.length > 1 ? dnseData.c[dnseData.c.length - 2] : dnseData.c[dnseData.c.length - 1]) * 1000;

        if (finalPrice <= 0 && dnseLast > 0) finalPrice = Math.round(dnseLast);
        if (finalRefPrice <= 0 && dnsePrev > 0) finalRefPrice = Math.round(dnsePrev);
      }

      if (finalPrice <= 0) finalPrice = fb.price;
      if (finalRefPrice <= 0) finalRefPrice = fb.refPrice || finalPrice;
      let finalHigh = vpsHigh > 0 ? vpsHigh : finalPrice;
      let finalLow = vpsLow > 0 ? vpsLow : finalPrice;
      let finalVolume = vpsVolume > 0 ? vpsVolume : 0;

      let low52w = fb.low52w || Math.round(finalPrice * 0.85);
      let low2y = fb.low2y || Math.round(finalPrice * 0.72);
      let low3y = fb.low3y || Math.round(finalPrice * 0.65);

      if (dnseData && Array.isArray(dnseData.c) && dnseData.c.length > 0) {
        const lArr: number[] = Array.isArray(dnseData.l) && dnseData.l.length > 0 ? dnseData.l : dnseData.c;
        const len = lArr.length;
        // Đáy 52 tuần: 260 phiên
        low52w = Math.round(Math.min(...lArr.slice(-Math.min(260, len))) * 1000);
        // Đáy 2 năm: 520 phiên
        low2y = Math.round(Math.min(...lArr.slice(-Math.min(520, len))) * 1000);
        // Đáy 3 năm: 780 phiên
        low3y = Math.round(Math.min(...lArr.slice(-Math.min(780, len))) * 1000);
      } else if (finalPrice > 0) {
        low52w = Math.min(low52w, Math.round(finalPrice * 0.85));
        low2y = Math.min(low2y, Math.round(finalPrice * 0.72));
        low3y = Math.min(low3y, Math.round(finalPrice * 0.65));
      }

      const change = finalPrice - finalRefPrice;
      const changePercent = finalRefPrice > 0 ? Number(((change / finalRefPrice) * 100).toFixed(2)) : 0;

      const diffFromLow52wPct = low52w > 0 ? Number((((finalPrice - low52w) / low52w) * 100).toFixed(1)) : 0;
      const diffFromLow2yPct = low2y > 0 ? Number((((finalPrice - low2y) / low2y) * 100).toFixed(1)) : 0;
      const diffFromLow3yPct = low3y > 0 ? Number((((finalPrice - low3y) / low3y) * 100).toFixed(1)) : 0;

      let valuationStatus = 'Vùng tích lũy';
      if (diffFromLow52wPct <= 3.5) {
        valuationStatus = 'Vùng đáy 52T (Gom cực tốt)';
      } else if (diffFromLow2yPct <= 5.0) {
        valuationStatus = 'Gần đáy 2 năm (Định giá rẻ)';
      } else if (diffFromLow3yPct <= 5.0) {
        valuationStatus = 'Sát đáy 3 năm (Cơ hội chu kỳ hiếm)';
      } else if (diffFromLow52wPct <= 10.0) {
        valuationStatus = 'Tích lũy gần đáy 52T';
      } else if (diffFromLow52wPct >= 35.0) {
        valuationStatus = 'Vùng phục hồi / Tăng mạnh';
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
        low52w,
        low2y,
        low3y,
        diffFromLow52wPct,
        diffFromLow2yPct,
        diffFromLow3yPct,
        valuationStatus,
      };
    })
  );

  const payload = {
    success: true,
    updatedAtStr: `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`,
    fetchedAt: new Date().toISOString(),
    source: 'Bảng giá Chứng khoán Việt Nam (VPS Realtime & DNSE)',
    vnindex: vnindexData,
    stocks: stocksResult,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=15',
    },
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
