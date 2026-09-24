// Cloudflare Pages Function: /api/vnindex
// Tự động chạy tại Cloudflare Edge Server khi deploy lên Cloudflare Pages

export async function onRequestGet(context: any): Promise<Response> {
  let vnindexData = {
    price: 1815.66,
    change: -7.11,
    changePercent: -0.39,
    volume: '862.1M CP (~23,850 tỷ)',
  };

  // 1. Thử VPS
  try {
    const vpsRes = await fetch('https://bgapidatafeed.vps.com.vn/getlistindexdetail/10', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (vpsRes.ok) {
      const json: any = await vpsRes.json();
      if (Array.isArray(json) && json.length > 0 && json[0]?.cIndex > 0) {
        const item = json[0];
        const refIndex = item.oIndex && item.oIndex > 0 ? item.oIndex : item.cIndex;
        let diff = item.cIndex - refIndex;
        let pct = refIndex > 0 ? (diff / refIndex) * 100 : 0;

        if (item.ot && typeof item.ot === 'string') {
          const parts = item.ot.split('|');
          if (parts.length >= 2) {
            const rawDiff = parseFloat(parts[0]);
            const rawPct = parseFloat(parts[1].replace('%', ''));
            const sign = item.cIndex < refIndex ? -1 : item.cIndex > refIndex ? 1 : 0;
            if (!isNaN(rawDiff)) diff = rawDiff < 0 ? rawDiff : sign * Math.abs(rawDiff);
            if (!isNaN(rawPct)) pct = rawPct < 0 ? rawPct : sign * Math.abs(rawPct);
          }
        }
        const volSharesStr = item.vol > 0 ? `${(item.vol / 1e6).toFixed(1)}M CP` : '';
        const estValueTrillion = item.value > 0 ? Math.round(item.value / 1000).toLocaleString('vi-VN') : '';
        const volDisplay = volSharesStr && estValueTrillion ? `${volSharesStr} (~${estValueTrillion} tỷ)` : volSharesStr || `${estValueTrillion} tỷ` || '';

        vnindexData = {
          price: Number(item.cIndex.toFixed(2)),
          change: Number(diff.toFixed(2)),
          changePercent: Number(pct.toFixed(2)),
          volume: volDisplay || `${(item.vol / 1e6).toFixed(1)}M CP`,
        };

        return new Response(
          JSON.stringify({ success: true, vnindex: vnindexData, source: 'VPS Realtime' }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=10',
            },
          }
        );
      }
    }
  } catch {}

  // 2. Dự phòng Entrade (DNSE)
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const vnRes = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${nowSec - 14 * 86400}&to=${nowSec}&symbol=VNINDEX&resolution=1D`,
      { signal: AbortSignal.timeout(3500) }
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

  return new Response(
    JSON.stringify({ success: true, vnindex: vnindexData, source: 'DNSE & Fallback' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=15',
      },
    }
  );
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
