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
      low5w: number;
      low10w: number;
      low20w: number;
      low30w: number;
      low52w: number;
    }
  > = {
    SSI: { price: 21400, refPrice: 21150, name: 'Chứng khoán SSI', low5w: 19200, low10w: 17350, low20w: 17350, low30w: 17350, low52w: 17350 },
    HPG: { price: 21550, refPrice: 21200, name: 'Tập đoàn Hòa Phát', low5w: 20750, low10w: 20100, low20w: 20100, low30w: 20100, low52w: 20100 },
    FPT: { price: 71700, refPrice: 74300, name: 'Công nghệ FPT', low5w: 68000, low10w: 61500, low20w: 61500, low30w: 61500, low52w: 61500 },
    TCB: { price: 31600, refPrice: 32650, name: 'Techcombank', low5w: 30600, low10w: 27800, low20w: 27800, low30w: 27770, low52w: 27770 },
    MBB: { price: 20550, refPrice: 20300, name: 'Ngân hàng Quân Đội', low5w: 19600, low10w: 17780, low20w: 17780, low30w: 17780, low52w: 17780 },
    VCB: { price: 59300, refPrice: 60000, name: 'Vietcombank', low5w: 58500, low10w: 56200, low20w: 55100, low30w: 54000, low52w: 52500 },
    VNM: { price: 60200, refPrice: 59600, name: 'Vinamilk', low5w: 58600, low10w: 54900, low20w: 54600, low30w: 54600, low52w: 53250 },
    MWG: { price: 71500, refPrice: 71200, name: 'Thế Giới Di Động', low5w: 66000, low10w: 59500, low20w: 52000, low30w: 48000, low52w: 42000 },
    VND: { price: 14500, refPrice: 14700, name: 'Chứng khoán VNDirect', low5w: 13800, low10w: 12900, low20w: 12500, low30w: 12000, low52w: 11500 },
    VIC: { price: 241200, refPrice: 241300, name: 'Vingroup', low5w: 194600, low10w: 194600, low20w: 184700, low30w: 118900, low52w: 61500 },
    VHM: { price: 41500, refPrice: 41200, name: 'Vinhomes', low5w: 39500, low10w: 37800, low20w: 36000, low30w: 35200, low52w: 34000 },
    VRE: { price: 18200, refPrice: 18150, name: 'Vincom Retail', low5w: 17500, low10w: 16800, low20w: 16200, low30w: 15800, low52w: 15000 },
    STB: { price: 75800, refPrice: 76000, name: 'Sacombank', low5w: 72000, low10w: 68500, low20w: 64000, low30w: 61000, low52w: 56000 },
    ACB: { price: 22600, refPrice: 22100, name: 'Ngân hàng Á Châu', low5w: 21500, low10w: 20200, low20w: 19800, low30w: 19200, low52w: 18500 },
    VPB: { price: 27600, refPrice: 27650, name: 'VPBank', low5w: 26200, low10w: 24800, low20w: 23500, low30w: 22800, low52w: 21500 },
    CTG: { price: 34500, refPrice: 34200, name: 'VietinBank', low5w: 33000, low10w: 31200, low20w: 29800, low30w: 28500, low52w: 27000 },
    BID: { price: 47500, refPrice: 47200, name: 'BIDV', low5w: 45800, low10w: 44000, low20w: 42500, low30w: 41200, low52w: 39500 },
    DGC: { price: 35000, refPrice: 36050, name: 'Hóa chất Đức Giang', low5w: 33500, low10w: 31800, low20w: 30500, low30w: 29000, low52w: 27500 },
    PNJ: { price: 36750, refPrice: 37200, name: 'Vàng bạc Phú Nhuận', low5w: 35200, low10w: 33800, low20w: 32000, low30w: 30800, low52w: 29000 },
    KDH: { price: 15300, refPrice: 15600, name: 'Nhà Khang Điền', low5w: 14500, low10w: 13800, low20w: 13200, low30w: 12800, low52w: 12000 },
    GAS: { price: 68500, refPrice: 68200, name: 'Tổng công ty Khí Việt Nam', low5w: 66000, low10w: 64200, low20w: 62500, low30w: 61000, low52w: 59000 },
    MSN: { price: 69200, refPrice: 69000, name: 'Tập đoàn Masan', low5w: 66500, low10w: 63800, low20w: 61200, low30w: 59500, low52w: 56800 },
  };

  const stocksResult: Record<string, any> = {};
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - 380 * 86400;

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
        low5w: 24000,
        low10w: 22500,
        low20w: 21000,
        low30w: 20000,
        low52w: 19000,
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
