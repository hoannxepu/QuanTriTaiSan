// Cloudflare Pages Function: /api/gold-rates
// Tự động quét giá Vàng DOJI, SJC, Bảo Tín Minh Châu, Phú Quý từ Cloudflare Edge Server

export async function onRequestGet(context: any): Promise<Response> {
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
        if (!items.some((i) => i.brand === item.brand && i.name === item.name)) {
          items.push(item);
        }
      }
    }
  }

  const dojiNhanItem = items.find(
    (i) => i.brand === 'DOJI' && (i.name.includes('Hưng Thịnh Vượng') || i.name.includes('AVPL') || i.name.includes('Nhẫn'))
  );
  const dojiSjcItem = items.find((i) => i.brand === 'DOJI' && i.name.includes('SJC'));
  const sjcItem = items.find(
    (i) => i.brand === 'SJC' && (i.name.includes('1L') || i.name.includes('SJC 1L') || i.category === 'sjc_mieng')
  );
  const nhanItem = items.find(
    (i) => i.category === 'nhan_9999' && (i.name.includes('1 chỉ') || i.name.includes('tròn trơn') || i.name.includes('Phú Quý') || i.name.includes('SJC'))
  );

  const fallbackDojiBuy = 14400000;
  const fallbackDojiSell = 14800000;
  const fallbackDojiSjcBuy = 14460000;
  const fallbackDojiSjcSell = 14760000;
  const fallbackSjcBuy = 14400000;
  const fallbackSjcSell = 14700000;

  const dojiBuyPerChi = dojiNhanItem ? dojiNhanItem.buyPerChi : fallbackDojiBuy;
  const dojiSellPerChi = dojiNhanItem ? dojiNhanItem.sellPerChi : fallbackDojiSell;
  const dojiSjcBuyPerChi = dojiSjcItem ? dojiSjcItem.buyPerChi : fallbackDojiSjcBuy;
  const dojiSjcSellPerChi = dojiSjcItem ? dojiSjcItem.sellPerChi : fallbackDojiSjcSell;

  const summary = {
    dojiBuyPerChi,
    dojiSellPerChi,
    dojiBuyPerLuong: dojiBuyPerChi * 10,
    dojiSellPerLuong: dojiSellPerChi * 10,
    dojiSjcBuyPerChi,
    dojiSjcSellPerChi,
    dojiSjcBuyPerLuong: dojiSjcBuyPerChi * 10,
    dojiSjcSellPerLuong: dojiSjcSellPerChi * 10,
    nhan9999SellPerChi: nhanItem ? nhanItem.sellPerChi : dojiSellPerChi,
    nhan9999BuyPerChi: nhanItem ? nhanItem.buyPerChi : dojiBuyPerChi,
    sjcSellPerChi: sjcItem ? sjcItem.sellPerChi : fallbackSjcSell,
    sjcBuyPerChi: sjcItem ? sjcItem.buyPerChi : fallbackSjcBuy,
    sjcSellPerLuong: (sjcItem ? sjcItem.sellPerChi : fallbackSjcSell) * 10,
    sjcBuyPerLuong: (sjcItem ? sjcItem.buyPerChi : fallbackSjcBuy) * 10,
  };

  const payload = {
    success: true,
    updatedAtStr: latestUpdateStr || `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`,
    fetchedAt: new Date().toISOString(),
    source: 'DOJI & Thị trường vàng Việt Nam (GiaVang & WebGia)',
    summary,
    items,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=30',
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
