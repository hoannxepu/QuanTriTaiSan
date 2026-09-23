// Cloudflare Pages Function: /api/stock-history
// Proxy lấy nến lịch sử nhiều năm cho Cổ phiếu Việt Nam & VN-Index
// Không bị chặn CORS, hỗ trợ đầy đủ các năm từ nguồn Entrade & VNDirect

export async function onRequestGet(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const rawSymbol = url.searchParams.get('symbol') || 'VNINDEX';
  const timeframe = url.searchParams.get('timeframe') || '1Y';
  const rawDays = parseInt(url.searchParams.get('days') || '0', 10);

  const sym = rawSymbol.trim().toUpperCase();
  const isIndex = sym === 'VNINDEX' || sym === 'VN-INDEX';
  const querySymbol = isIndex ? 'VNINDEX' : sym;

  let days = rawDays;
  if (!days) {
    if (timeframe === '1W') days = 7;
    else if (timeframe === '1M') days = 30;
    else if (timeframe === '3M') days = 90;
    else if (timeframe === '6M') days = 180;
    else if (timeframe === '1Y') days = 365;
    else if (timeframe === '3Y') days = 365 * 3;
    else if (timeframe === '5Y') days = 365 * 5;
    else if (timeframe === 'ALL') days = 365 * 30; // 30 năm (lấy toàn bộ)
    else days = 365;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  // Lấy thêm ngày dự phòng để tính MA20, MA50
  const fromSec = days >= 365 * 10 ? 0 : Math.max(0, nowSec - (days + 70) * 86400);

  const normalizeScale = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const n = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(n)) return 0;
    if (isIndex) return parseFloat(n.toFixed(2));
    return n < 1000 ? Math.round(n * 1000) : Math.round(n);
  };

  let rawCandles: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];

  // Nguồn 1: Entrade DNSE
  try {
    const entradeUrl = isIndex
      ? `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?symbol=VNINDEX&from=${fromSec}&to=${nowSec}&resolution=1D`
      : `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?symbol=${encodeURIComponent(querySymbol)}&from=${fromSec}&to=${nowSec}&resolution=1D`;

    const res = await fetch(entradeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const json: any = await res.json();
      if (json && Array.isArray(json.t) && json.t.length > 0 && Array.isArray(json.c)) {
        const len = json.t.length;
        for (let i = 0; i < len; i++) {
          const t = json.t[i];
          const c = normalizeScale(json.c[i]);
          const o = normalizeScale(json.o ? json.o[i] : c);
          const h = normalizeScale(json.h ? json.h[i] : Math.max(o, c));
          const l = normalizeScale(json.l ? json.l[i] : Math.min(o, c));
          const v = json.v && json.v[i] ? json.v[i] : 0;
          if (c > 0) {
            rawCandles.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
          }
        }
      }
    }
  } catch {}

  // Nguồn 2: VNDirect DChart
  if (rawCandles.length === 0) {
    try {
      const vndUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${encodeURIComponent(querySymbol)}&from=${fromSec}&to=${nowSec}`;
      const res = await fetch(vndUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const json: any = await res.json();
        if (json && Array.isArray(json.t) && json.t.length > 0 && Array.isArray(json.c)) {
          const len = json.t.length;
          for (let i = 0; i < len; i++) {
            const t = json.t[i];
            const c = normalizeScale(json.c[i]);
            const o = normalizeScale(json.o ? json.o[i] : c);
            const h = normalizeScale(json.h ? json.h[i] : Math.max(o, c));
            const l = normalizeScale(json.l ? json.l[i] : Math.min(o, c));
            const v = json.v && json.v[i] ? json.v[i] : 0;
            if (c > 0) {
              rawCandles.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
            }
          }
        }
      }
    } catch {}
  }

  // Sắp xếp thời gian tăng dần
  rawCandles.sort((a, b) => a.time - b.time);

  // Tính toán MA20 và MA50
  const closes: number[] = [];
  const candlesWithMA: any[] = [];

  for (let i = 0; i < rawCandles.length; i++) {
    const c = rawCandles[i];
    closes.push(c.close);

    let ma20: number | undefined = undefined;
    if (closes.length >= 20) {
      const sum20 = closes.slice(-20).reduce((acc, v) => acc + v, 0);
      ma20 = isIndex ? parseFloat((sum20 / 20).toFixed(2)) : Math.round(sum20 / 20);
    }

    let ma50: number | undefined = undefined;
    if (closes.length >= 50) {
      const sum50 = closes.slice(-50).reduce((acc, v) => acc + v, 0);
      ma50 = isIndex ? parseFloat((sum50 / 50).toFixed(2)) : Math.round(sum50 / 50);
    }

    const d = new Date(c.time * 1000);
    const dayStr = d.getDate().toString().padStart(2, '0');
    const monthStr = (d.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = d.getFullYear();

    candlesWithMA.push({
      time: c.time,
      dateStr: `${dayStr}/${monthStr}/${yearStr}`,
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: yearStr,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      ma20,
      ma50,
    });
  }

  // Cắt bớt phần đệm để trả về đúng khoảng thời gian yêu cầu
  const cutoffTime = days >= 365 * 10 ? 0 : nowSec - days * 86400;
  const filtered = candlesWithMA.filter((p) => p.time >= cutoffTime);
  const finalCandles = filtered.length > 0 ? filtered : candlesWithMA;

  return new Response(
    JSON.stringify({
      success: true,
      symbol: querySymbol,
      isIndex,
      timeframe,
      count: finalCandles.length,
      candles: finalCandles,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
