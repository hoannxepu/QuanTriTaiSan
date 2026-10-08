var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/stock-ratios/index.ts
var FALLBACK_RATIOS = {
  TCB: { pe: 8.8, pb: 1.29, roe: 16.1, roa: 2.45, period: "Q2/2026", industry: "T\xE0i ch\xEDnh - Ng\xE2n h\xE0ng", rating: "P/B 1.29x \u2022 ROE 16.1% \u2022 CASA \u0111\u1EA7u ng\xE0nh" },
  HPG: { pe: 9.69, pb: 1.47, roe: 17.7, roa: 8.97, period: "Q2/2026", industry: "S\u1EA3n xu\u1EA5t - Th\xE9p", rating: "P/E 9.7x \u2022 ROE 17.7% \u2022 V\xF9ng t\xEDch s\u1EA3n an to\xE0n" },
  FPT: { pe: 12.99, pb: 3.23, roe: 27.1, roa: 14.1, period: "Q2/2026", industry: "C\xF4ng ngh\u1EC7 th\xF4ng tin", rating: "ROE 27.1% \u2022 T\u0103ng tr\u01B0\u1EDFng b\u1EC1n v\u1EEFng >20%/n\u0103m" },
  MBB: { pe: 6.25, pb: 1.15, roe: 22.4, roa: 2.65, period: "Q2/2026", industry: "T\xE0i ch\xEDnh - Ng\xE2n h\xE0ng", rating: "P/E 6.2x \u2022 ROE 22.4% \u2022 T\u0103ng tr\u01B0\u1EDFng t\xEDn d\u1EE5ng cao" },
  SSI: { pe: 13.5, pb: 1.35, roe: 13.2, roa: 4.8, period: "Q2/2026", industry: "D\u1ECBch v\u1EE5 T\xE0i ch\xEDnh", rating: "P/B 1.35x \u2022 H\u01B0\u1EDFng l\u1EE3i n\xE2ng h\u1EA1ng FTSE" },
  VCB: { pe: 14.2, pb: 2.18, roe: 18, roa: 1.71, period: "Q2/2026", industry: "T\xE0i ch\xEDnh - Ng\xE2n h\xE0ng", rating: "P/B 2.18x \u2022 Ch\u1EA5t l\u01B0\u1EE3ng t\xE0i s\u1EA3n s\u1ED1 1 VN" },
  VNM: { pe: 14.8, pb: 3.85, roe: 28.5, roa: 19.2, period: "Q2/2026", industry: "Th\u1EF1c ph\u1EA9m & \u0110\u1ED3 u\u1ED1ng", rating: "ROE 28.5% \u2022 C\u1ED5 t\u1EE9c ti\u1EC1n m\u1EB7t cao" },
  VEA: { pe: 8.2, pb: 1.85, roe: 28.5, roa: 22.1, period: "Q2/2026", industry: "C\xF4ng nghi\u1EC7p & \xD4 t\xF4", rating: "C\u1ED5 t\u1EE9c ti\u1EC1n m\u1EB7t ~10-12%/n\u0103m" },
  BMP: { pe: 10.5, pb: 2.9, roe: 31.2, roa: 24.5, period: "Q2/2026", industry: "S\u1EA3n xu\u1EA5t - Nh\u1EF1a", rating: "C\u1ED5 t\u1EE9c ti\u1EC1n m\u1EB7t ~10-12%/n\u0103m" },
  MWG: { pe: 16.2, pb: 2.8, roe: 18.9, roa: 6.8, period: "Q2/2026", industry: "B\xE1n l\u1EBB ti\xEAu d\xF9ng", rating: "Chu k\u1EF3 ph\u1EE5c h\u1ED3i l\u1EE3i nhu\u1EADn b\xE1ch h\xF3a" }
};
async function fetchRatiosForSymbol(sym) {
  try {
    const res = await fetch(
      `https://api.simplize.vn/api/company/fi/ratio/${encodeURIComponent(sym)}?period=Q&size=1&type=ratio`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(5e3)
      }
    );
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.items?.length > 0) {
        const item = json.data.items[0];
        const pe = typeof item.op1 === "number" && item.op1 > 0 ? Number(item.op1.toFixed(2)) : void 0;
        const pb = typeof item.op2 === "number" && item.op2 > 0 ? Number(item.op2.toFixed(2)) : void 0;
        const roe = typeof item.op17 === "number" && item.op17 > 0 ? Number(item.op17.toFixed(1)) : typeof item.op3 === "number" ? Number(item.op3.toFixed(1)) : void 0;
        const roa = typeof item.op18 === "number" && item.op18 > 0 ? Number(item.op18.toFixed(1)) : void 0;
        const period = item.periodDateName || "Q2/2026";
        const industry = json.data.industryGroup || "Doanh nghi\u1EC7p ni\xEAm y\u1EBFt";
        let rating = "\u0110\u1ECBnh gi\xE1 h\u1EE3p l\xFD";
        if (roe && roe >= 20 && pe && pe <= 15) {
          rating = `ROE ${roe}% \u2022 P/E ${pe}x (T\xEDch s\u1EA3n t\u1ED1i \u01B0u)`;
        } else if (pe && pe < 10) {
          rating = `P/E ${pe}x (V\xF9ng gi\xE1 chi\u1EBFt kh\u1EA5u r\u1EBB)`;
        } else if (pb && pb < 1.3) {
          rating = `P/B ${pb}x (S\xE1t gi\xE1 tr\u1ECB s\u1ED5 s\xE1ch)`;
        } else if (roe && roe >= 15) {
          rating = `ROE ${roe}% (Hi\u1EC7u qu\u1EA3 sinh l\u1EDDi cao)`;
        }
        return {
          symbol: sym,
          pe,
          pb,
          roe,
          roa,
          period,
          industry,
          rating,
          source: "TCBS & Simplize BCTC"
        };
      }
    }
  } catch {
  }
  return FALLBACK_RATIOS[sym] || {
    symbol: sym,
    pe: 11.5,
    pb: 1.45,
    roe: 18.2,
    roa: 7.5,
    period: "Q2/2026",
    industry: "Doanh nghi\u1EC7p ni\xEAm y\u1EBFt",
    rating: "\u0110\u1ECBnh gi\xE1 tham chi\u1EBFu BCTC",
    source: "TCBS & BCTC Tham Chi\u1EBFu"
  };
}
__name(fetchRatiosForSymbol, "fetchRatiosForSymbol");
async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const rawSymbols = url.searchParams.get("symbols") || "";
  const symbolsList = rawSymbols.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{3,4}$/.test(s));
  if (symbolsList.length === 0) {
    symbolsList.push("HPG", "TCB", "FPT", "MBB", "SSI");
  }
  const results = {};
  await Promise.all(
    symbolsList.map(async (sym) => {
      results[sym] = await fetchRatiosForSymbol(sym);
    })
  );
  return new Response(JSON.stringify({ success: true, ratios: results }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=600"
    }
  });
}
__name(onRequestGet, "onRequestGet");
async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");

// api/stock-ratios/[symbol].ts
async function onRequestGet2(context) {
  const { params } = context;
  const rawSym = (params.symbol || "").trim().toUpperCase();
  if (!rawSym || !/^[A-Z0-9]{3,4}$/.test(rawSym)) {
    return new Response(JSON.stringify({ error: "M\xE3 c\u1ED5 phi\u1EBFu kh\xF4ng h\u1EE3p l\u1EC7" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const data = await fetchRatiosForSymbol(rawSym);
  return new Response(JSON.stringify({ success: true, data }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=600"
    }
  });
}
__name(onRequestGet2, "onRequestGet");
async function onRequestOptions2() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions2, "onRequestOptions");

// api/bank-rates.ts
async function onRequestGet3(context) {
  try {
    const resp = await fetch("https://topi.vn/lai-suat-tiet-kiem-ngan-hang-nao-cao-nhat.html", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(6e3)
    });
    if (resp.ok) {
      const html = await resp.text();
      const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
      const cleanRate = /* @__PURE__ */ __name((v) => {
        if (!v || v === "-" || v.trim() === "") return 0;
        return parseFloat(v.replace(",", ".").trim()) || 0;
      }, "cleanRate");
      const parseTableRows = /* @__PURE__ */ __name((tHtml) => {
        const rows = tHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        const list = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].replace(/<[^>]+>/g, "|").split("|").map((s) => s.trim()).filter(Boolean);
          if (cols.length >= 7) {
            list.push({
              bank: cols[0],
              kkh: cleanRate(cols[1]),
              m1: cleanRate(cols[2]),
              m3: cleanRate(cols[3]),
              m6: cleanRate(cols[4]),
              m12: cleanRate(cols[5]),
              m18: cleanRate(cols[6] || "0"),
              m24: cleanRate(cols[7] || "0"),
              m36: cleanRate(cols[8] || "0")
            });
          }
        }
        return list;
      }, "parseTableRows");
      const counterList = tables.length > 0 ? parseTableRows(tables[0]) : [];
      const onlineList = tables.length > 1 ? parseTableRows(tables[1]) : counterList;
      if (onlineList.length > 0 || counterList.length > 0) {
        const top6m = [...onlineList.length > 0 ? onlineList : counterList].filter((b) => b.m6 > 0).sort((a, b) => b.m6 - a.m6).slice(0, 3).map((b) => ({ bank: b.bank, rate: b.m6 }));
        const top12m = [...onlineList.length > 0 ? onlineList : counterList].filter((b) => b.m12 > 0).sort((a, b) => b.m12 - a.m12).slice(0, 3).map((b) => ({ bank: b.bank, rate: b.m12 }));
        const top24m = [...onlineList.length > 0 ? onlineList : counterList].filter((b) => b.m24 > 0).sort((a, b) => b.m24 - a.m24).slice(0, 3).map((b) => ({ bank: b.bank, rate: b.m24 }));
        const result = {
          success: true,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedDateStr: (/* @__PURE__ */ new Date()).toLocaleDateString("vi-VN"),
          source: "Topi & Kh\u1EA3o s\xE1t ng\xE2n h\xE0ng Vi\u1EC7t Nam",
          online: onlineList,
          counter: counterList,
          highlights: { top6m, top12m, top24m }
        };
        return new Response(JSON.stringify(result), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=1800"
          }
        });
      }
    }
  } catch {
  }
  const fallback = {
    success: true,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedDateStr: (/* @__PURE__ */ new Date()).toLocaleDateString("vi-VN"),
    source: "T\u1ED5ng h\u1EE3p L\xE3i su\u1EA5t Ng\xE2n h\xE0ng Nh\xE0 N\u01B0\u1EDBc & Big4",
    online: [
      { bank: "HDBank", kkh: 0.5, m1: 3.5, m3: 3.7, m6: 5.5, m12: 5.9, m18: 6.1, m24: 6.1, m36: 6.1 },
      { bank: "MBBank", kkh: 0.5, m1: 3.5, m3: 3.8, m6: 4.8, m12: 5.4, m18: 5.8, m24: 5.8, m36: 5.8 },
      { bank: "Vietcombank", kkh: 0.2, m1: 2.1, m3: 2.4, m6: 3.5, m12: 5, m18: 5, m24: 5, m36: 5 },
      { bank: "BIDV", kkh: 0.2, m1: 2.2, m3: 2.5, m6: 3.5, m12: 5, m18: 5, m24: 5, m36: 5 },
      { bank: "Agribank", kkh: 0.2, m1: 2.2, m3: 2.5, m6: 3.5, m12: 5, m18: 5, m24: 5, m36: 5 },
      { bank: "VietinBank", kkh: 0.2, m1: 2.2, m3: 2.5, m6: 3.5, m12: 5, m18: 5, m24: 5, m36: 5 },
      { bank: "Techcombank", kkh: 0.5, m1: 3.4, m3: 3.7, m6: 4.8, m12: 5.3, m18: 5.3, m24: 5.3, m36: 5.3 },
      { bank: "ACB", kkh: 0.5, m1: 3.3, m3: 3.6, m6: 4.5, m12: 5.1, m18: 5.1, m24: 5.1, m36: 5.1 },
      { bank: "VPBank", kkh: 0.5, m1: 3.6, m3: 3.8, m6: 5, m12: 5.6, m18: 5.8, m24: 5.8, m36: 5.8 },
      { bank: "NCB", kkh: 0.5, m1: 3.8, m3: 4, m6: 5.6, m12: 6, m18: 6.2, m24: 6.2, m36: 6.2 }
    ],
    counter: [],
    highlights: {
      top6m: [
        { bank: "NCB", rate: 5.6 },
        { bank: "HDBank", rate: 5.5 },
        { bank: "VPBank", rate: 5 }
      ],
      top12m: [
        { bank: "NCB", rate: 6 },
        { bank: "HDBank", rate: 5.9 },
        { bank: "VPBank", rate: 5.6 }
      ],
      top24m: [
        { bank: "NCB", rate: 6.2 },
        { bank: "HDBank", rate: 6.1 },
        { bank: "MBBank", rate: 5.8 }
      ]
    }
  };
  return new Response(JSON.stringify(fallback), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800"
    }
  });
}
__name(onRequestGet3, "onRequestGet");
async function onRequestOptions3() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions3, "onRequestOptions");

// api/cloud-sync.ts
var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxW6C9L4sDhKMLO28_iaxLrUS834iKCoYkkQJbxGz_e2vpGPf3KVJxzr2tvoY5EIZ0tbw/exec";
async function onRequestGet4() {
  try {
    const url = `${APPS_SCRIPT_URL}?t=${Date.now()}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json"
      }
    });
    const text = await response.text();
    return new Response(text, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch from Google Drive", details: err?.message }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
__name(onRequestGet4, "onRequestGet");
async function onRequestPost(context) {
  try {
    const body = await context.request.text();
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body
    });
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to save to Google Drive", details: err?.message }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
__name(onRequestPost, "onRequestPost");
async function onRequestOptions4() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}
__name(onRequestOptions4, "onRequestOptions");

// api/gold-rates.ts
async function onRequestGet5(context) {
  const items = [];
  let latestUpdateStr = "";
  const sources = [
    { brand: "DOJI", url: "https://giavang.org/trong-nuoc/doji/" },
    { brand: "SJC", url: "https://giavang.org/trong-nuoc/sjc/" },
    { brand: "B\u1EA3o T\xEDn Minh Ch\xE2u", url: "https://giavang.org/trong-nuoc/bao-tin-minh-chau/" },
    { brand: "Ph\xFA Qu\xFD", url: "https://giavang.org/trong-nuoc/phu-quy/" }
  ];
  const fetchPromises = sources.map(async (src) => {
    try {
      const response = await fetch(src.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        signal: AbortSignal.timeout(4e3)
      });
      if (!response.ok) return { brand: src.brand, items: [], time: "" };
      const html = await response.text();
      const timeMatch = html.match(/Cập nhật lúc[^<]*/i);
      const time = timeMatch ? timeMatch[0].trim() : "";
      const srcItems = [];
      const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      for (const tr of trMatches) {
        const cells = tr.replace(/<[^>]+>/g, "|").split("|").map((s) => s.trim()).filter(Boolean);
        if (cells.length >= 3) {
          const buyRaw = cells[cells.length - 2];
          const sellRaw = cells[cells.length - 1];
          const buyNum = parseFloat(buyRaw.replace(/\./g, "").replace(",", "."));
          const sellNum = parseFloat(sellRaw.replace(/\./g, "").replace(",", "."));
          const rawName = cells.slice(0, cells.length - 2).join(" - ");
          if (!isNaN(buyNum) && !isNaN(sellNum) && buyNum > 1e3 && !rawName.toLowerCase().includes("b\u1EA1c")) {
            const buyPerChi = Math.round(buyNum * 100);
            const sellPerChi = Math.round(sellNum * 100);
            const lower = rawName.toLowerCase();
            let category = "other";
            if (lower.includes("nh\u1EABn") || lower.includes("h\u01B0ng th\u1ECBnh v\u01B0\u1EE3ng") || lower.includes("avpl") || lower.includes("24k") || lower.includes("999") || lower.includes("tr\xF2n")) {
              category = "nhan_9999";
            } else if (lower.includes("sjc") || lower.includes("mi\u1EBFng")) {
              category = "sjc_mieng";
            }
            const cleanName = rawName.replace(/^(Hà Nội|Đà Nẵng|Tp\. Hồ Chí Minh|Hồ Chí Minh)\s*-\s*/i, "");
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
              unit: "ch\u1EC9"
            });
          }
        }
      }
      return { brand: src.brand, items: srcItems, time };
    } catch {
      return { brand: src.brand, items: [], time: "" };
    }
  });
  const settledResults = await Promise.allSettled(fetchPromises);
  for (const res of settledResults) {
    if (res.status === "fulfilled" && res.value) {
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
    (i) => i.brand === "DOJI" && (i.name.includes("H\u01B0ng Th\u1ECBnh V\u01B0\u1EE3ng") || i.name.includes("AVPL") || i.name.includes("Nh\u1EABn"))
  );
  const dojiSjcItem = items.find((i) => i.brand === "DOJI" && i.name.includes("SJC"));
  const sjcItem = items.find(
    (i) => i.brand === "SJC" && (i.name.includes("1L") || i.name.includes("SJC 1L") || i.category === "sjc_mieng")
  );
  const nhanItem = items.find(
    (i) => i.category === "nhan_9999" && (i.name.includes("1 ch\u1EC9") || i.name.includes("tr\xF2n tr\u01A1n") || i.name.includes("Ph\xFA Qu\xFD") || i.name.includes("SJC"))
  );
  const fallbackDojiBuy = 144e5;
  const fallbackDojiSell = 148e5;
  const fallbackDojiSjcBuy = 1446e4;
  const fallbackDojiSjcSell = 1476e4;
  const fallbackSjcBuy = 144e5;
  const fallbackSjcSell = 147e5;
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
    sjcBuyPerLuong: (sjcItem ? sjcItem.buyPerChi : fallbackSjcBuy) * 10
  };
  const payload = {
    success: true,
    updatedAtStr: latestUpdateStr || `C\u1EADp nh\u1EADt l\xFAc ${(/* @__PURE__ */ new Date()).toLocaleTimeString("vi-VN")} ${(/* @__PURE__ */ new Date()).toLocaleDateString("vi-VN")}`,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: "DOJI & Th\u1ECB tr\u01B0\u1EDDng v\xE0ng Vi\u1EC7t Nam (GiaVang & WebGia)",
    summary,
    items
  };
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=30"
    }
  });
}
__name(onRequestGet5, "onRequestGet");
async function onRequestOptions5() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions5, "onRequestOptions");

// api/health.ts
async function onRequestGet6() {
  return new Response(JSON.stringify({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(onRequestGet6, "onRequestGet");

// api/send-email-report.ts
async function onRequestPost2(context) {
  return new Response(
    JSON.stringify({
      success: false,
      message: "G\u1EEDi email t\u1EF1 \u0111\u1ED9ng y\xEAu c\u1EA7u c\u1EA5u h\xECnh SMTP Service. Vui l\xF2ng s\u1EED d\u1EE5ng t\xEDnh n\u0103ng xu\u1EA5t file Excel ho\u1EB7c ch\u1EA1y tr\xEAn m\xE1y ch\u1EE7 Node.js \u0111\u1EA7y \u0111\u1EE7."
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
__name(onRequestPost2, "onRequestPost");
async function onRequestOptions6() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions6, "onRequestOptions");

// api/smtp-status.ts
async function onRequestGet7(context) {
  const env = context.env || {};
  const isConfigured = Boolean(env.SMTP_USER || env.GMAIL_USER);
  return new Response(
    JSON.stringify({
      configured: isConfigured,
      user: isConfigured ? env.SMTP_USER || env.GMAIL_USER : null,
      provider: "Cloudflare Pages & Worker SMTP"
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
__name(onRequestGet7, "onRequestGet");

// api/stock-history.ts
async function onRequestGet8(context) {
  const { request } = context;
  const url = new URL(request.url);
  const rawSymbol = url.searchParams.get("symbol") || "VNINDEX";
  const timeframe = url.searchParams.get("timeframe") || "1Y";
  const rawDays = parseInt(url.searchParams.get("days") || "0", 10);
  const sym = rawSymbol.trim().toUpperCase();
  const isIndex = sym === "VNINDEX" || sym === "VN-INDEX";
  const querySymbol = isIndex ? "VNINDEX" : sym;
  let days = rawDays;
  if (!days) {
    if (timeframe === "1W") days = 7;
    else if (timeframe === "1M") days = 30;
    else if (timeframe === "3M") days = 90;
    else if (timeframe === "6M") days = 180;
    else if (timeframe === "1Y") days = 365;
    else if (timeframe === "3Y") days = 365 * 3;
    else if (timeframe === "5Y") days = 365 * 5;
    else if (timeframe === "ALL") days = 365 * 30;
    else days = 365;
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  const fromSec = days >= 365 * 10 ? 0 : Math.max(0, nowSec - (days + 70) * 86400);
  const normalizeScale = /* @__PURE__ */ __name((val) => {
    if (val === void 0 || val === null) return 0;
    const n = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(n)) return 0;
    if (isIndex) return parseFloat(n.toFixed(2));
    return n < 1e3 ? Math.round(n * 1e3) : Math.round(n);
  }, "normalizeScale");
  let rawCandles = [];
  try {
    const entradeUrl = isIndex ? `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?symbol=VNINDEX&from=${fromSec}&to=${nowSec}&resolution=1D` : `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?symbol=${encodeURIComponent(querySymbol)}&from=${fromSec}&to=${nowSec}&resolution=1D`;
    const res = await fetch(entradeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(6e3)
    });
    if (res.ok) {
      const json = await res.json();
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
  } catch {
  }
  if (rawCandles.length === 0) {
    try {
      const vndUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${encodeURIComponent(querySymbol)}&from=${fromSec}&to=${nowSec}`;
      const res = await fetch(vndUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(6e3)
      });
      if (res.ok) {
        const json = await res.json();
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
    } catch {
    }
  }
  rawCandles.sort((a, b) => a.time - b.time);
  const closes = [];
  const candlesWithMA = [];
  for (let i = 0; i < rawCandles.length; i++) {
    const c = rawCandles[i];
    closes.push(c.close);
    let ma20 = void 0;
    if (closes.length >= 20) {
      const sum20 = closes.slice(-20).reduce((acc, v) => acc + v, 0);
      ma20 = isIndex ? parseFloat((sum20 / 20).toFixed(2)) : Math.round(sum20 / 20);
    }
    let ma50 = void 0;
    if (closes.length >= 50) {
      const sum50 = closes.slice(-50).reduce((acc, v) => acc + v, 0);
      ma50 = isIndex ? parseFloat((sum50 / 50).toFixed(2)) : Math.round(sum50 / 50);
    }
    const d = new Date(c.time * 1e3);
    const dayStr = d.getDate().toString().padStart(2, "0");
    const monthStr = (d.getMonth() + 1).toString().padStart(2, "0");
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
      ma50
    });
  }
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
      candles: finalCandles
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120, s-maxage=300",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
__name(onRequestGet8, "onRequestGet");

// api/stock-rates.ts
async function onRequestGet9(context) {
  const { request } = context;
  const url = new URL(request.url);
  const rawSymbols = url.searchParams.get("symbols") || "";
  let symbolsList = rawSymbols.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{3,4}$/.test(s));
  if (symbolsList.length === 0) {
    symbolsList = [
      "HPG",
      "FPT",
      "TCB",
      "MBB",
      "VCB",
      "VNM",
      "MWG",
      "SSI",
      "BMP",
      "VEA",
      "VIC",
      "VHM",
      "VRE",
      "STB",
      "ACB",
      "VPB",
      "BID",
      "CTG",
      "DGC",
      "PNJ",
      "GAS",
      "MSN",
      "VND",
      "KDH",
      "LPB",
      "TCX",
      "NKG",
      "HSG",
      "PVD",
      "PVS",
      "DIG",
      "DXG",
      "VIX"
    ];
  }
  const fallbackQuotes = {
    HPG: { price: 21050, refPrice: 21150, name: "T\u1EADp \u0111o\xE0n H\xF2a Ph\xE1t", low52w: 20100, low2y: 15850, low3y: 15280 },
    FPT: { price: 66100, refPrice: 66600, name: "C\xF4ng ngh\u1EC7 FPT", low52w: 55910, low2y: 42e3, low3y: 38500 },
    TCB: { price: 33150, refPrice: 32300, name: "Techcombank", low52w: 27770, low2y: 18500, low3y: 16200 },
    MBB: { price: 20050, refPrice: 20200, name: "Ng\xE2n h\xE0ng Qu\xE2n \u0110\u1ED9i", low52w: 17780, low2y: 13500, low3y: 12200 },
    VEA: { price: 46200, refPrice: 45900, name: "T\u1ED5ng c\xF4ng ty VEAM", low52w: 36e3, low2y: 32e3, low3y: 3e4 },
    BMP: { price: 132e3, refPrice: 131500, name: "Nh\u1EF1a B\xECnh Minh", low52w: 88e3, low2y: 65e3, low3y: 52e3 },
    SSI: { price: 21100, refPrice: 20900, name: "Ch\u1EE9ng kho\xE1n SSI", low52w: 17350, low2y: 13800, low3y: 11500 },
    CTG: { price: 30900, refPrice: 31e3, name: "VietinBank", low52w: 28400, low2y: 22e3, low3y: 20500 },
    LPB: { price: 46350, refPrice: 46100, name: "LPBank", low52w: 37330, low2y: 18e3, low3y: 14500 },
    TCX: { price: 31e3, refPrice: 31e3, name: "C\u1ED5 phi\u1EBFu TCX", low52w: 28930, low2y: 24e3, low3y: 22e3 },
    VCB: { price: 59200, refPrice: 58900, name: "Vietcombank", low52w: 52600, low2y: 48e3, low3y: 44e3 },
    VNM: { price: 61e3, refPrice: 60300, name: "Vinamilk", low52w: 53250, low2y: 52e3, low3y: 51500 },
    MWG: { price: 72400, refPrice: 71700, name: "Th\u1EBF Gi\u1EDBi Di \u0110\u1ED9ng", low52w: 42e3, low2y: 36500, low3y: 35e3 },
    VIC: { price: 42500, refPrice: 42e3, name: "Vingroup", low52w: 38e3, low2y: 35e3, low3y: 34500 },
    VHM: { price: 41500, refPrice: 41200, name: "Vinhomes", low52w: 36e3, low2y: 34e3, low3y: 33500 },
    VRE: { price: 18200, refPrice: 18150, name: "Vincom Retail", low52w: 16e3, low2y: 15200, low3y: 14800 },
    STB: { price: 34200, refPrice: 34e3, name: "Sacombank", low52w: 26e3, low2y: 22e3, low3y: 18500 },
    ACB: { price: 22100, refPrice: 22400, name: "Ng\xE2n h\xE0ng \xC1 Ch\xE2u", low52w: 18500, low2y: 15500, low3y: 14200 },
    VPB: { price: 20500, refPrice: 20400, name: "VPBank", low52w: 17800, low2y: 16e3, low3y: 14500 },
    BID: { price: 36300, refPrice: 36200, name: "BIDV", low52w: 32e3, low2y: 28500, low3y: 25e3 },
    DGC: { price: 35650, refPrice: 35350, name: "H\xF3a ch\u1EA5t \u0110\u1EE9c Giang", low52w: 30500, low2y: 26e3, low3y: 22e3 },
    PNJ: { price: 36e3, refPrice: 36900, name: "V\xE0ng b\u1EA1c Ph\xFA Nhu\u1EADn", low52w: 32e3, low2y: 29500, low3y: 27e3 },
    GAS: { price: 85200, refPrice: 86100, name: "T\u1ED5ng c\xF4ng ty Kh\xED Vi\u1EC7t Nam", low52w: 72e3, low2y: 68e3, low3y: 65e3 },
    MSN: { price: 7e4, refPrice: 67700, name: "T\u1EADp \u0111o\xE0n Masan", low52w: 52e3, low2y: 48e3, low3y: 46e3 },
    VND: { price: 14950, refPrice: 14700, name: "Ch\u1EE9ng kho\xE1n VNDirect", low52w: 11500, low2y: 9800, low3y: 8500 },
    KDH: { price: 15950, refPrice: 15850, name: "Nh\xE0 Khang \u0110i\u1EC1n", low52w: 13e3, low2y: 11500, low3y: 10500 },
    SHB: { price: 11600, refPrice: 11600, name: "Ng\xE2n h\xE0ng S\xE0i G\xF2n - H\xE0 N\u1ED9i", low52w: 9800, low2y: 8500, low3y: 7800 },
    HDB: { price: 27450, refPrice: 27600, name: "HDBank", low52w: 20500, low2y: 14800, low3y: 13200 },
    TPB: { price: 14200, refPrice: 14e3, name: "TPBank", low52w: 11400, low2y: 9800, low3y: 9200 },
    VIB: { price: 13450, refPrice: 13350, name: "Ng\xE2n h\xE0ng Qu\u1ED1c t\u1EBF VIB", low52w: 10800, low2y: 9400, low3y: 8800 },
    GVR: { price: 32350, refPrice: 32200, name: "T\u1EADp \u0111o\xE0n Cao su Vi\u1EC7t Nam", low52w: 22e3, low2y: 17500, low3y: 15e3 },
    PLX: { price: 36400, refPrice: 36850, name: "Petrolimex", low52w: 31500, low2y: 29e3, low3y: 27500 },
    POW: { price: 12750, refPrice: 12550, name: "\u0110i\u1EC7n l\u1EF1c D\u1EA7u kh\xED PV Power", low52w: 10200, low2y: 9500, low3y: 9e3 },
    SAB: { price: 44450, refPrice: 43850, name: "Sabeco", low52w: 39500, low2y: 38e3, low3y: 37500 },
    BCM: { price: 40300, refPrice: 39800, name: "Becamex IDC", low52w: 34e3, low2y: 31500, low3y: 3e4 },
    BVH: { price: 69500, refPrice: 70500, name: "T\u1EADp \u0111o\xE0n B\u1EA3o Vi\u1EC7t", low52w: 59e3, low2y: 54e3, low3y: 51e3 },
    VJC: { price: 134e3, refPrice: 138e3, name: "Vietjet Air", low52w: 105e3, low2y: 98e3, low3y: 95e3 },
    SSB: { price: 20900, refPrice: 22450, name: "SeABank", low52w: 18e3, low2y: 16500, low3y: 15e3 },
    NKG: { price: 9980, refPrice: 9980, name: "Th\xE9p Nam Kim", low52w: 8e3, low2y: 7200, low3y: 6500 },
    HSG: { price: 10100, refPrice: 10100, name: "T\u1EADp \u0111o\xE0n Hoa Sen", low52w: 8100, low2y: 7400, low3y: 6800 },
    PVD: { price: 19150, refPrice: 19350, name: "Khoan D\u1EA7u kh\xED PVD", low52w: 16e3, low2y: 14500, low3y: 13e3 },
    PVS: { price: 32900, refPrice: 33300, name: "D\u1ECBch v\u1EE5 K\u1EF9 thu\u1EADt D\u1EA7u kh\xED PTSC", low52w: 28e3, low2y: 25e3, low3y: 22e3 },
    DIG: { price: 10100, refPrice: 10100, name: "T\u1ED5ng C\xF4ng ty DIC Corp", low52w: 8200, low2y: 7500, low3y: 6800 },
    DXG: { price: 10500, refPrice: 10550, name: "T\u1EADp \u0111o\xE0n \u0110\u1EA5t Xanh", low52w: 8400, low2y: 7800, low3y: 7e3 },
    VIX: { price: 13100, refPrice: 12800, name: "Ch\u1EE9ng kho\xE1n VIX", low52w: 9500, low2y: 7200, low3y: 6e3 }
  };
  const normalizeScale = /* @__PURE__ */ __name((val) => {
    if (!val) return 0;
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    return num < 1e3 ? Math.round(num * 1e3) : Math.round(num);
  }, "normalizeScale");
  const stocksResult = {};
  const nowSec = Math.floor(Date.now() / 1e3);
  const fromSec = nowSec - 1150 * 86400;
  let vnindexData = {
    price: 1815.66,
    change: -7.11,
    changePercent: -0.39,
    volume: "862.1M CP (~23,850 t\u1EF7)"
  };
  try {
    const vpsIndexRes = await fetch("https://bgapidatafeed.vps.com.vn/getlistindexdetail/10", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(3500)
    });
    if (vpsIndexRes.ok) {
      const vpsIndexJson = await vpsIndexRes.json();
      if (Array.isArray(vpsIndexJson) && vpsIndexJson.length > 0 && vpsIndexJson[0]?.cIndex > 0) {
        const item = vpsIndexJson[0];
        const refIndex = item.oIndex && item.oIndex > 0 ? item.oIndex : item.cIndex;
        let diff = item.cIndex - refIndex;
        let pct = refIndex > 0 ? diff / refIndex * 100 : 0;
        if (item.ot && typeof item.ot === "string") {
          const parts = item.ot.split("|");
          if (parts.length >= 2) {
            const rawDiff = parseFloat(parts[0]);
            const rawPct = parseFloat(parts[1].replace("%", ""));
            const sign = item.cIndex < refIndex ? -1 : item.cIndex > refIndex ? 1 : 0;
            if (!isNaN(rawDiff)) diff = rawDiff < 0 ? rawDiff : sign * Math.abs(rawDiff);
            if (!isNaN(rawPct)) pct = rawPct < 0 ? rawPct : sign * Math.abs(rawPct);
          }
        }
        const volSharesStr = item.vol > 0 ? `${(item.vol / 1e6).toFixed(1)}M CP` : "";
        const estValueTrillion = item.value > 0 ? Math.round(item.value / 1e3).toLocaleString("vi-VN") : "";
        const volDisplay = volSharesStr && estValueTrillion ? `${volSharesStr} (~${estValueTrillion} t\u1EF7)` : volSharesStr || `${estValueTrillion} t\u1EF7` || "";
        vnindexData = {
          price: Number(item.cIndex.toFixed(2)),
          change: Number(diff.toFixed(2)),
          changePercent: Number(pct.toFixed(2)),
          volume: volDisplay || `${(item.vol / 1e6).toFixed(1)}M CP`
        };
      }
    }
  } catch {
    try {
      const vnRes = await fetch(
        `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${nowSec - 14 * 86400}&to=${nowSec}&symbol=VNINDEX&resolution=1D`,
        { signal: AbortSignal.timeout(3e3) }
      );
      if (vnRes.ok) {
        const vJson = await vnRes.json();
        if (vJson && Array.isArray(vJson.c) && vJson.c.length > 0) {
          const vLast = vJson.c[vJson.c.length - 1];
          const vPrev = vJson.c.length > 1 ? vJson.c[vJson.c.length - 2] : vLast;
          const vDiff = vLast - vPrev;
          const vPct = vPrev > 0 ? vDiff / vPrev * 100 : 0;
          const vVol = Array.isArray(vJson.v) && vJson.v.length > 0 ? vJson.v[vJson.v.length - 1] : 0;
          const volSharesStr = vVol > 0 ? `${(vVol / 1e6).toFixed(1)}M CP` : "";
          const estValueTrillion = vVol > 0 ? Math.round(vVol * 27600 / 1e9).toLocaleString("vi-VN") : "23,850";
          const volDisplay = volSharesStr ? `${volSharesStr} (~${estValueTrillion} t\u1EF7)` : `${estValueTrillion} t\u1EF7`;
          vnindexData = {
            price: Number(vLast.toFixed(2)),
            change: Number(vDiff.toFixed(2)),
            changePercent: Number(vPct.toFixed(2)),
            volume: volDisplay
          };
        }
      }
    } catch {
    }
  }
  const vpsMap = /* @__PURE__ */ new Map();
  try {
    const vpsUrl = `https://bgapidatafeed.vps.com.vn/getliststockdata/${symbolsList.join(",")}`;
    const vpsRes = await fetch(vpsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(4500)
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
    console.warn("[CloudflareFunction] VPS fetch error:", vpsErr);
  }
  await Promise.all(
    symbolsList.map(async (sym) => {
      const fb = fallbackQuotes[sym] || {
        price: 25e3,
        refPrice: 25e3,
        name: `C\u1ED5 phi\u1EBFu ${sym}`,
        low52w: 19e3,
        low2y: 16e3,
        low3y: 14e3
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
        const rawLast = normalizeScale(vpsItem.lastPrice);
        const rawRef = normalizeScale(vpsItem.r);
        const rawHigh = normalizeScale(vpsItem.highPrice);
        const rawLow = normalizeScale(vpsItem.lowPrice);
        const rawCeil = normalizeScale(vpsItem.c);
        const rawFlr = normalizeScale(vpsItem.f);
        const rawClose = normalizeScale(vpsItem.closePrice);
        const rawAve = normalizeScale(vpsItem.avePrice);
        vpsRefPrice = rawRef || rawLast || rawClose;
        vpsPrice = rawLast || rawClose || rawAve || vpsRefPrice;
        vpsHigh = rawHigh || vpsPrice;
        vpsLow = rawLow || vpsPrice;
        vpsCeiling = rawCeil;
        vpsFloor = rawFlr;
        vpsVolume = typeof vpsItem.lot === "number" ? vpsItem.lot : parseInt(vpsItem.lot || "0", 10);
      }
      let vndPrice = 0;
      let vndRefPrice = 0;
      if (vpsPrice <= 0) {
        try {
          const vndUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=1D&symbol=${sym}&from=${nowSec - 86400 * 14}&to=${nowSec}`;
          const vndRes = await fetch(vndUrl, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(3e3)
          });
          if (vndRes.ok) {
            const vndJson = await vndRes.json();
            if (vndJson && Array.isArray(vndJson.c) && vndJson.c.length > 0) {
              const closes = vndJson.c;
              const lastC = normalizeScale(closes[closes.length - 1]);
              const prevC = closes.length > 1 ? normalizeScale(closes[closes.length - 2]) : lastC;
              if (lastC > 0) {
                vndPrice = lastC;
                vndRefPrice = prevC > 0 ? prevC : lastC;
              }
            }
          }
        } catch {
        }
      }
      let dnseData = null;
      let dnsePrice = 0;
      let dnseRefPrice = 0;
      try {
        const dnseUrl = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${sym}&resolution=1D`;
        const res = await fetch(dnseUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          dnseData = await res.json();
          if (dnseData && Array.isArray(dnseData.c) && dnseData.c.length > 0) {
            const lastC = normalizeScale(dnseData.c[dnseData.c.length - 1]);
            const prevC = dnseData.c.length > 1 ? normalizeScale(dnseData.c[dnseData.c.length - 2]) : lastC;
            if (lastC > 0) {
              dnsePrice = lastC;
              dnseRefPrice = prevC > 0 ? prevC : lastC;
            }
          }
        }
      } catch {
      }
      let finalPrice = vpsPrice > 0 ? vpsPrice : vndPrice > 0 ? vndPrice : dnsePrice > 0 ? dnsePrice : fb.price;
      let finalRefPrice = vpsRefPrice > 0 ? vpsRefPrice : vndRefPrice > 0 ? vndRefPrice : dnseRefPrice > 0 ? dnseRefPrice : fb.refPrice || finalPrice;
      let finalHigh = vpsHigh > 0 ? vpsHigh : finalPrice;
      let finalLow = vpsLow > 0 ? vpsLow : finalPrice;
      let finalVolume = vpsVolume > 0 ? vpsVolume : 0;
      let low52w = fb.low52w || Math.round(finalPrice * 0.85);
      let low2y = fb.low2y || Math.round(finalPrice * 0.72);
      let low3y = fb.low3y || Math.round(finalPrice * 0.65);
      if (dnseData && Array.isArray(dnseData.c) && dnseData.c.length > 0) {
        const lArr = Array.isArray(dnseData.l) && dnseData.l.length > 0 ? dnseData.l : dnseData.c;
        const len = lArr.length;
        low52w = normalizeScale(Math.min(...lArr.slice(-Math.min(260, len))));
        low2y = normalizeScale(Math.min(...lArr.slice(-Math.min(520, len))));
        low3y = normalizeScale(Math.min(...lArr.slice(-Math.min(780, len))));
      } else if (finalPrice > 0) {
        low52w = Math.min(low52w, Math.round(finalPrice * 0.85));
        low2y = Math.min(low2y, Math.round(finalPrice * 0.72));
        low3y = Math.min(low3y, Math.round(finalPrice * 0.65));
      }
      const change = finalPrice - finalRefPrice;
      const changePercent = finalRefPrice > 0 ? Number((change / finalRefPrice * 100).toFixed(2)) : 0;
      const diffFromLow52wPct = low52w > 0 ? Number(((finalPrice - low52w) / low52w * 100).toFixed(1)) : 0;
      const diffFromLow2yPct = low2y > 0 ? Number(((finalPrice - low2y) / low2y * 100).toFixed(1)) : 0;
      const diffFromLow3yPct = low3y > 0 ? Number(((finalPrice - low3y) / low3y * 100).toFixed(1)) : 0;
      let valuationStatus = "V\xF9ng t\xEDch l\u0169y";
      if (diffFromLow52wPct <= 3.5) {
        valuationStatus = "V\xF9ng \u0111\xE1y 52T (Gom c\u1EF1c t\u1ED1t)";
      } else if (diffFromLow2yPct <= 5) {
        valuationStatus = "G\u1EA7n \u0111\xE1y 2 n\u0103m (\u0110\u1ECBnh gi\xE1 r\u1EBB)";
      } else if (diffFromLow3yPct <= 5) {
        valuationStatus = "S\xE1t \u0111\xE1y 3 n\u0103m (C\u01A1 h\u1ED9i chu k\u1EF3 hi\u1EBFm)";
      } else if (diffFromLow52wPct <= 10) {
        valuationStatus = "T\xEDch l\u0169y g\u1EA7n \u0111\xE1y 52T";
      } else if (diffFromLow52wPct >= 35) {
        valuationStatus = "V\xF9ng ph\u1EE5c h\u1ED3i / T\u0103ng m\u1EA1nh";
      } else {
        valuationStatus = "T\xEDch l\u0169y \u1ED5n \u0111\u1ECBnh";
      }
      stocksResult[sym] = {
        symbol: sym,
        name: fb.name || `C\u1ED5 phi\u1EBFu ${sym}`,
        price: finalPrice,
        refPrice: finalRefPrice,
        change,
        changePercent,
        high: finalHigh,
        low: finalLow,
        ceiling: vpsCeiling || void 0,
        floor: vpsFloor || void 0,
        volume: finalVolume,
        updatedAt: (/* @__PURE__ */ new Date()).toLocaleTimeString("vi-VN"),
        low52w,
        low2y,
        low3y,
        diffFromLow52wPct,
        diffFromLow2yPct,
        diffFromLow3yPct,
        valuationStatus
      };
    })
  );
  const payload = {
    success: true,
    updatedAtStr: `C\u1EADp nh\u1EADt l\xFAc ${(/* @__PURE__ */ new Date()).toLocaleTimeString("vi-VN")} ${(/* @__PURE__ */ new Date()).toLocaleDateString("vi-VN")}`,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: "B\u1EA3ng gi\xE1 Ch\u1EE9ng kho\xE1n Vi\u1EC7t Nam (VPS Realtime & DNSE)",
    vnindex: vnindexData,
    stocks: stocksResult
  };
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
}
__name(onRequestGet9, "onRequestGet");
async function onRequestOptions7() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions7, "onRequestOptions");

// api/vnindex.ts
async function onRequestGet10(context) {
  let vnindexData = {
    price: 1815.66,
    change: -7.11,
    changePercent: -0.39,
    volume: "862.1M CP (~23,850 t\u1EF7)"
  };
  try {
    const vpsRes = await fetch("https://bgapidatafeed.vps.com.vn/getlistindexdetail/10", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(4e3)
    });
    if (vpsRes.ok) {
      const json = await vpsRes.json();
      if (Array.isArray(json) && json.length > 0 && json[0]?.cIndex > 0) {
        const item = json[0];
        const refIndex = item.oIndex && item.oIndex > 0 ? item.oIndex : item.cIndex;
        let diff = item.cIndex - refIndex;
        let pct = refIndex > 0 ? diff / refIndex * 100 : 0;
        if (item.ot && typeof item.ot === "string") {
          const parts = item.ot.split("|");
          if (parts.length >= 2) {
            const rawDiff = parseFloat(parts[0]);
            const rawPct = parseFloat(parts[1].replace("%", ""));
            const sign = item.cIndex < refIndex ? -1 : item.cIndex > refIndex ? 1 : 0;
            if (!isNaN(rawDiff)) diff = rawDiff < 0 ? rawDiff : sign * Math.abs(rawDiff);
            if (!isNaN(rawPct)) pct = rawPct < 0 ? rawPct : sign * Math.abs(rawPct);
          }
        }
        const volSharesStr = item.vol > 0 ? `${(item.vol / 1e6).toFixed(1)}M CP` : "";
        const estValueTrillion = item.value > 0 ? Math.round(item.value / 1e3).toLocaleString("vi-VN") : "";
        const volDisplay = volSharesStr && estValueTrillion ? `${volSharesStr} (~${estValueTrillion} t\u1EF7)` : volSharesStr || `${estValueTrillion} t\u1EF7` || "";
        vnindexData = {
          price: Number(item.cIndex.toFixed(2)),
          change: Number(diff.toFixed(2)),
          changePercent: Number(pct.toFixed(2)),
          volume: volDisplay || `${(item.vol / 1e6).toFixed(1)}M CP`
        };
        return new Response(
          JSON.stringify({ success: true, vnindex: vnindexData, source: "VPS Realtime" }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=10"
            }
          }
        );
      }
    }
  } catch {
  }
  try {
    const nowSec = Math.floor(Date.now() / 1e3);
    const vnRes = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${nowSec - 14 * 86400}&to=${nowSec}&symbol=VNINDEX&resolution=1D`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (vnRes.ok) {
      const vJson = await vnRes.json();
      if (vJson && Array.isArray(vJson.c) && vJson.c.length > 0) {
        const vLast = vJson.c[vJson.c.length - 1];
        const vPrev = vJson.c.length > 1 ? vJson.c[vJson.c.length - 2] : vLast;
        const vDiff = vLast - vPrev;
        const vPct = vPrev > 0 ? vDiff / vPrev * 100 : 0;
        const vVol = Array.isArray(vJson.v) && vJson.v.length > 0 ? vJson.v[vJson.v.length - 1] : 0;
        const volSharesStr = vVol > 0 ? `${(vVol / 1e6).toFixed(1)}M CP` : "";
        const estValueTrillion = vVol > 0 ? Math.round(vVol * 27600 / 1e9).toLocaleString("vi-VN") : "23,850";
        const volDisplay = volSharesStr ? `${volSharesStr} (~${estValueTrillion} t\u1EF7)` : `${estValueTrillion} t\u1EF7`;
        vnindexData = {
          price: Number(vLast.toFixed(2)),
          change: Number(vDiff.toFixed(2)),
          changePercent: Number(vPct.toFixed(2)),
          volume: volDisplay
        };
      }
    }
  } catch {
  }
  return new Response(
    JSON.stringify({ success: true, vnindex: vnindexData, source: "DNSE & Fallback" }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15"
      }
    }
  );
}
__name(onRequestGet10, "onRequestGet");
async function onRequestOptions8() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions8, "onRequestOptions");

// ../.wrangler/tmp/pages-7Lgy77/functionsRoutes-0.13635824105895455.mjs
var routes = [
  {
    routePath: "/api/stock-ratios/:symbol",
    mountPath: "/api/stock-ratios",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/stock-ratios/:symbol",
    mountPath: "/api/stock-ratios",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/bank-rates",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/bank-rates",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/cloud-sync",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/cloud-sync",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions4]
  },
  {
    routePath: "/api/cloud-sync",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/gold-rates",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/gold-rates",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions5]
  },
  {
    routePath: "/api/health",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/send-email-report",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions6]
  },
  {
    routePath: "/api/send-email-report",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/smtp-status",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/stock-history",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/stock-rates",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/stock-rates",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions7]
  },
  {
    routePath: "/api/stock-ratios",
    mountPath: "/api/stock-ratios",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/stock-ratios",
    mountPath: "/api/stock-ratios",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/vnindex",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet10]
  },
  {
    routePath: "/api/vnindex",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions8]
  }
];

// ../../../root/.npm/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
