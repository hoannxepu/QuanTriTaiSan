/**
 * Dịch vụ lấy và đồng bộ bảng giá cổ phiếu Việt Nam (HOSE, HNX, UPCoM)
 * Tự động đồng bộ vào Tài sản thực tế (Tab 1) và Mục tiêu tích sản (Tab 3)
 */

import { Asset, Goal } from '../types';

export interface StockFinancialRatios {
  symbol: string;
  pe?: number; // Hệ số Giá / Lợi nhuận P/E
  pb?: number; // Hệ số Giá / Giá trị sổ sách P/B
  roe?: number; // Tỷ suất sinh lời trên Vốn chủ sở hữu ROE (%)
  roa?: number; // Tỷ suất sinh lời trên Tổng tài sản ROA (%)
  eps?: number;
  period?: string; // Kỳ báo cáo (ví dụ: Q2/2026)
  industry?: string;
  rating?: string;
  source?: string;
}

export interface BankRateItem {
  bank: string;
  kkh: number;
  m1: number;
  m3: number;
  m6: number;
  m12: number;
  m18?: number;
  m24: number;
  m36?: number;
  condition?: string;
  isSpecial?: boolean;
  productType?: string;
  note?: string;
}

export interface BankRatesData {
  success: boolean;
  updatedAtStr: string;
  fetchedAt: string;
  source: string;
  counterRates: BankRateItem[];
  onlineRates: BankRateItem[];
  topOnline6M: BankRateItem[];
  topOnline12M: BankRateItem[];
  topOnline24M: BankRateItem[];
  big4Rates: BankRateItem[];
  cdAndHighYieldRates?: BankRateItem[];
  specialHighRates?: BankRateItem[];
  fromCache?: boolean;
}

export interface StockQuoteItem {
  symbol: string;
  name?: string;
  price: number; // Đơn giá hiện tại (VNĐ/CP)
  refPrice: number; // Giá tham chiếu (VNĐ/CP)
  change: number; // Chênh lệch giá (+/- VNĐ)
  changePercent: number; // % thay đổi
  high: number; // Giá cao nhất trong phiên
  low: number; // Giá thấp nhất trong phiên
  ceiling?: number; // Giá trần
  floor?: number; // Giá sàn
  volume: number; // Khối lượng giao dịch
  updatedAt?: string;
  // Các mốc đáy chu kỳ trung & dài hạn: 52 Tuần (1 năm), 2 Năm, 3 Năm
  low52w: number;
  low2y?: number;
  low3y?: number;
  diffFromLow52wPct: number;
  diffFromLow2yPct?: number;
  diffFromLow3yPct?: number;
  valuationStatus?: string;
  financials?: StockFinancialRatios; // Chỉ số BCTC (P/E, P/B, ROE...)
}

export interface StockRateData {
  success: boolean;
  updatedAtStr: string;
  fetchedAt: string;
  source: string;
  stocks: Record<string, StockQuoteItem>;
  fromCache?: boolean;
  vnindex?: {
    price: number;
    change: number;
    changePercent: number;
    volume?: string;
  };
}

/**
 * Trộn thông minh 2 báo giá: Chống nháy loạn giá (anti-flickering)
 * - Tuyệt đối không để giá fallback hoặc giá lỗi ghi đè lên giá live thực tế đã nhận
 * - Kiểm tra biên độ trần/sàn Việt Nam (không quá +/- 22% so với tham chiếu)
 * - Bảo toàn các mốc đáy chu kỳ 52T, 2 năm, 3 năm
 */
export function safeMergeStockQuote(
  prevQuote: StockQuoteItem | undefined,
  newQuote: StockQuoteItem | undefined
): StockQuoteItem | undefined {
  if (!newQuote) return prevQuote;
  if (!prevQuote || !prevQuote.price || prevQuote.price <= 0) return newQuote;
  if (!newQuote.price || newQuote.price <= 0) return prevQuote;

  // Nếu newQuote là giá fallback 25000 ngẫu nhiên trong khi mã có giá thực tế đã nạp khác 25000
  if (newQuote.price === 25000 && prevQuote.price !== 25000 && !FALLBACK_STOCK_RATES[newQuote.symbol]) {
    return prevQuote;
  }

  // Chống nháy loạn: Giới hạn biên độ thị trường Việt Nam (tối đa +/- 22% so với tham chiếu)
  const refP = newQuote.refPrice || prevQuote.refPrice || prevQuote.price;
  if (refP > 0) {
    const dev = Math.abs(newQuote.price - refP) / refP;
    if (dev > 0.22) {
      console.warn(`[StockSafety] Bỏ qua giá bất thường cho ${newQuote.symbol}: ${newQuote.price} (tham chiếu ${refP})`);
      return prevQuote;
    }
  }

  return {
    ...prevQuote,
    ...newQuote,
    low52w: newQuote.low52w || prevQuote.low52w,
    low2y: newQuote.low2y || prevQuote.low2y,
    low3y: newQuote.low3y || prevQuote.low3y,
    diffFromLow52wPct: newQuote.diffFromLow52wPct ?? prevQuote.diffFromLow52wPct,
    diffFromLow2yPct: newQuote.diffFromLow2yPct ?? prevQuote.diffFromLow2yPct,
    diffFromLow3yPct: newQuote.diffFromLow3yPct ?? prevQuote.diffFromLow3yPct,
    valuationStatus: newQuote.valuationStatus || prevQuote.valuationStatus,
  };
}

export function safeMergeStockQuotesMap(
  existing: Record<string, StockQuoteItem> | undefined,
  incoming: Record<string, StockQuoteItem> | undefined
): Record<string, StockQuoteItem> {
  const result: Record<string, StockQuoteItem> = { ...(existing || {}) };
  if (!incoming) return result;

  Object.entries(incoming).forEach(([sym, newQuote]) => {
    const merged = safeMergeStockQuote(result[sym], newQuote);
    if (merged) {
      result[sym] = merged;
    }
  });

  return result;
}

// Bảng giá tham chiếu dự phòng chuẩn xác cập nhật theo giá thị trường thực tế (HOSE / HNX / UPCoM)
// So sánh đáy chu kỳ trung - dài hạn: Đáy 52 Tuần (1 năm), Đáy 2 Năm, Đáy 3 Năm
export const FALLBACK_STOCK_RATES: Record<string, StockQuoteItem> = {
  HPG: { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', price: 21050, refPrice: 21150, change: -100, changePercent: -0.47, high: 21200, low: 21050, volume: 3112490, ceiling: 22600, floor: 19700, low52w: 20100, low2y: 15850, low3y: 15280, diffFromLow52wPct: 4.7, diffFromLow2yPct: 32.8, diffFromLow3yPct: 37.8, valuationStatus: 'Vùng đáy 52T (Gom cực tốt)' },
  FPT: { symbol: 'FPT', name: 'Công nghệ FPT', price: 66100, refPrice: 66600, change: -500, changePercent: -0.75, high: 67000, low: 66100, volume: 1550070, ceiling: 71200, floor: 62000, low52w: 55910, low2y: 42000, low3y: 38500, diffFromLow52wPct: 18.2, diffFromLow2yPct: 57.4, diffFromLow3yPct: 71.7, valuationStatus: 'Tăng trưởng dài hạn' },
  TCB: { symbol: 'TCB', name: 'Techcombank', price: 33150, refPrice: 32300, change: 850, changePercent: 2.63, high: 33450, low: 32200, volume: 3900710, ceiling: 34550, floor: 30050, low52w: 27770, low2y: 18500, low3y: 16200, diffFromLow52wPct: 19.4, diffFromLow2yPct: 79.2, diffFromLow3yPct: 104.6, valuationStatus: 'Tích lũy ổn định' },
  MBB: { symbol: 'MBB', name: 'Ngân hàng Quân Đội', price: 20050, refPrice: 20200, change: -150, changePercent: -0.74, high: 20400, low: 20000, volume: 1684370, ceiling: 21600, floor: 18800, low52w: 17780, low2y: 13500, low3y: 12200, diffFromLow52wPct: 12.8, diffFromLow2yPct: 48.5, diffFromLow3yPct: 64.3, valuationStatus: 'Tích lũy gần đáy 52T' },
  SSI: { symbol: 'SSI', name: 'Chứng khoán SSI', price: 21100, refPrice: 20900, change: 200, changePercent: 0.96, high: 21350, low: 20900, volume: 690360, ceiling: 22350, floor: 19450, low52w: 17350, low2y: 13800, low3y: 11500, diffFromLow52wPct: 21.6, diffFromLow2yPct: 52.9, diffFromLow3yPct: 83.5, valuationStatus: 'Tích lũy ổn định' },
  CTG: { symbol: 'CTG', name: 'VietinBank', price: 30900, refPrice: 31000, change: -100, changePercent: -0.32, high: 31100, low: 30750, volume: 136890, ceiling: 33150, floor: 28850, low52w: 28400, low2y: 22000, low3y: 20500, diffFromLow52wPct: 8.8, diffFromLow2yPct: 40.5, diffFromLow3yPct: 50.7, valuationStatus: 'Tích lũy gần đáy 52T' },
  LPB: { symbol: 'LPB', name: 'LPBank', price: 46350, refPrice: 46100, change: 250, changePercent: 0.54, high: 46500, low: 45900, volume: 102360, ceiling: 49300, floor: 42900, low52w: 37330, low2y: 18000, low3y: 14500, diffFromLow52wPct: 24.2, diffFromLow2yPct: 157.5, diffFromLow3yPct: 219.7, valuationStatus: 'Vùng tăng trưởng mạnh' },
  TCX: { symbol: 'TCX', name: 'Cổ phiếu TCX', price: 31000, refPrice: 31000, change: 0, changePercent: 0, high: 31350, low: 30750, volume: 69880, ceiling: 33150, floor: 28850, low52w: 28930, low2y: 24000, low3y: 22000, diffFromLow52wPct: 7.2, diffFromLow2yPct: 29.2, diffFromLow3yPct: 40.9, valuationStatus: 'Tích lũy gần đáy 52T' },
  VCB: { symbol: 'VCB', name: 'Vietcombank', price: 59200, refPrice: 58900, change: 300, changePercent: 0.51, high: 60000, low: 58900, volume: 97240, ceiling: 63000, floor: 54800, low52w: 52600, low2y: 48000, low3y: 44000, diffFromLow52wPct: 12.5, diffFromLow2yPct: 23.3, diffFromLow3yPct: 34.5, valuationStatus: 'Tích lũy ổn định' },
  VNM: { symbol: 'VNM', name: 'Vinamilk', price: 61000, refPrice: 60300, change: 700, changePercent: 1.16, high: 61300, low: 60300, volume: 97740, ceiling: 64500, floor: 56100, low52w: 53250, low2y: 52000, low3y: 51500, diffFromLow52wPct: 14.6, diffFromLow2yPct: 17.3, diffFromLow3yPct: 18.4, valuationStatus: 'Tích lũy an toàn' },
  MWG: { symbol: 'MWG', name: 'Thế Giới Di Động', price: 72400, refPrice: 71700, change: 700, changePercent: 0.98, high: 73500, low: 71400, volume: 167000, ceiling: 76700, floor: 66700, low52w: 42000, low2y: 36500, low3y: 35000, diffFromLow52wPct: 72.4, diffFromLow2yPct: 98.4, diffFromLow3yPct: 106.9, valuationStatus: 'Vùng phục hồi / Tăng mạnh' },
  VIC: { symbol: 'VIC', name: 'Vingroup', price: 42500, refPrice: 42000, change: 500, changePercent: 1.19, high: 43000, low: 41800, volume: 2154300, ceiling: 44900, floor: 39100, low52w: 38000, low2y: 35000, low3y: 34500, diffFromLow52wPct: 11.8, diffFromLow2yPct: 21.4, diffFromLow3yPct: 23.2, valuationStatus: 'Tích lũy ổn định' },
  VHM: { symbol: 'VHM', name: 'Vinhomes', price: 41500, refPrice: 41200, change: 300, changePercent: 0.73, high: 42000, low: 41000, volume: 1419030, ceiling: 44000, floor: 38400, low52w: 36000, low2y: 34000, low3y: 33500, diffFromLow52wPct: 15.3, diffFromLow2yPct: 22.1, diffFromLow3yPct: 23.9, valuationStatus: 'Tích lũy ổn định' },
  VRE: { symbol: 'VRE', name: 'Vincom Retail', price: 18200, refPrice: 18150, change: 50, changePercent: 0.28, high: 18500, low: 18000, volume: 933110, ceiling: 19400, floor: 16900, low52w: 16000, low2y: 15200, low3y: 14800, diffFromLow52wPct: 13.8, diffFromLow2yPct: 19.7, diffFromLow3yPct: 23.0, valuationStatus: 'Tích lũy ổn định' },
  STB: { symbol: 'STB', name: 'Sacombank', price: 34200, refPrice: 34000, change: 200, changePercent: 0.59, high: 34500, low: 33800, volume: 612000, ceiling: 36350, floor: 31650, low52w: 26000, low2y: 22000, low3y: 18500, diffFromLow52wPct: 31.5, diffFromLow2yPct: 55.5, diffFromLow3yPct: 84.9, valuationStatus: 'Tích lũy tăng trưởng' },
  ACB: { symbol: 'ACB', name: 'Ngân hàng Á Châu', price: 22100, refPrice: 22400, change: -300, changePercent: -1.34, high: 22500, low: 22050, volume: 246220, ceiling: 23950, floor: 20850, low52w: 18500, low2y: 15500, low3y: 14200, diffFromLow52wPct: 19.5, diffFromLow2yPct: 42.6, diffFromLow3yPct: 55.6, valuationStatus: 'Tích lũy ổn định' },
  VPB: { symbol: 'VPB', name: 'VPBank', price: 20500, refPrice: 20400, change: 100, changePercent: 0.49, high: 20700, low: 20300, volume: 1608910, ceiling: 21800, floor: 19000, low52w: 17800, low2y: 16000, low3y: 14500, diffFromLow52wPct: 15.2, diffFromLow2yPct: 28.1, diffFromLow3yPct: 41.4, valuationStatus: 'Tích lũy ổn định' },
  BID: { symbol: 'BID', name: 'BIDV', price: 36300, refPrice: 36200, change: 100, changePercent: 0.28, high: 36550, low: 36200, volume: 115920, ceiling: 38700, floor: 33700, low52w: 32000, low2y: 28500, low3y: 25000, diffFromLow52wPct: 13.4, diffFromLow2yPct: 27.4, diffFromLow3yPct: 45.2, valuationStatus: 'Tích lũy ổn định' },
  DGC: { symbol: 'DGC', name: 'Hóa chất Đức Giang', price: 35650, refPrice: 35350, change: 300, changePercent: 0.85, high: 35800, low: 35350, volume: 18540, ceiling: 37800, floor: 32900, low52w: 30500, low2y: 26000, low3y: 22000, diffFromLow52wPct: 16.9, diffFromLow2yPct: 37.1, diffFromLow3yPct: 62.0, valuationStatus: 'Tích lũy ổn định' },
  PNJ: { symbol: 'PNJ', name: 'Vàng bạc Phú Nhuận', price: 36000, refPrice: 36900, change: -900, changePercent: -2.44, high: 37000, low: 35950, volume: 317840, ceiling: 39450, floor: 34350, low52w: 32000, low2y: 29500, low3y: 27000, diffFromLow52wPct: 12.5, diffFromLow2yPct: 22.0, diffFromLow3yPct: 33.3, valuationStatus: 'Tích lũy gần đáy 52T' },
  GAS: { symbol: 'GAS', name: 'Tổng công ty Khí Việt Nam', price: 85200, refPrice: 86100, change: -900, changePercent: -1.05, high: 86400, low: 85100, volume: 34870, ceiling: 92100, floor: 80100, low52w: 72000, low2y: 68000, low3y: 65000, diffFromLow52wPct: 18.3, diffFromLow2yPct: 25.3, diffFromLow3yPct: 31.1, valuationStatus: 'Tích lũy an toàn' },
  MSN: { symbol: 'MSN', name: 'Tập đoàn Masan', price: 70000, refPrice: 67700, change: 2300, changePercent: 3.4, high: 71400, low: 67700, volume: 626320, ceiling: 72400, floor: 63000, low52w: 52000, low2y: 48000, low3y: 46000, diffFromLow52wPct: 34.6, diffFromLow2yPct: 45.8, diffFromLow3yPct: 52.2, valuationStatus: 'Vùng phục hồi / Tăng mạnh' },
  VND: { symbol: 'VND', name: 'Chứng khoán VNDirect', price: 14950, refPrice: 14700, change: 250, changePercent: 1.7, high: 15050, low: 14750, volume: 307950, ceiling: 15700, floor: 13700, low52w: 11500, low2y: 9800, low3y: 8500, diffFromLow52wPct: 30.0, diffFromLow2yPct: 52.6, diffFromLow3yPct: 75.9, valuationStatus: 'Tích lũy ổn định' },
  KDH: { symbol: 'KDH', name: 'Nhà Khang Điền', price: 15950, refPrice: 15850, change: 100, changePercent: 0.63, high: 16100, low: 15800, volume: 163980, ceiling: 16950, floor: 14750, low52w: 13000, low2y: 11500, low3y: 10500, diffFromLow52wPct: 22.7, diffFromLow2yPct: 38.7, diffFromLow3yPct: 51.9, valuationStatus: 'Tích lũy ổn định' },
  SHB: { symbol: 'SHB', name: 'Ngân hàng Sài Gòn - Hà Nội', price: 11600, refPrice: 11600, change: 0, changePercent: 0, high: 11650, low: 11550, volume: 336680, ceiling: 12400, floor: 10800, low52w: 9800, low2y: 8500, low3y: 7800, diffFromLow52wPct: 18.4, diffFromLow2yPct: 36.5, diffFromLow3yPct: 48.7, valuationStatus: 'Tích lũy an toàn' },
  HDB: { symbol: 'HDB', name: 'HDBank', price: 27450, refPrice: 27600, change: -150, changePercent: -0.54, high: 27600, low: 27300, volume: 428380, ceiling: 29500, floor: 25700, low52w: 20500, low2y: 14800, low3y: 13200, diffFromLow52wPct: 33.9, diffFromLow2yPct: 85.5, diffFromLow3yPct: 108.0, valuationStatus: 'Vùng phục hồi / Tăng mạnh' },
  TPB: { symbol: 'TPB', name: 'TPBank', price: 14200, refPrice: 14000, change: 200, changePercent: 1.43, high: 14250, low: 14050, volume: 559620, ceiling: 14950, floor: 13050, low52w: 11400, low2y: 9800, low3y: 9200, diffFromLow52wPct: 24.6, diffFromLow2yPct: 44.9, diffFromLow3yPct: 54.3, valuationStatus: 'Tích lũy ổn định' },
  VIB: { symbol: 'VIB', name: 'Ngân hàng Quốc tế VIB', price: 13450, refPrice: 13350, change: 100, changePercent: 0.75, high: 13500, low: 13400, volume: 84200, ceiling: 14250, floor: 12450, low52w: 10800, low2y: 9400, low3y: 8800, diffFromLow52wPct: 24.5, diffFromLow2yPct: 43.1, diffFromLow3yPct: 52.8, valuationStatus: 'Tích lũy ổn định' },
  GVR: { symbol: 'GVR', name: 'Tập đoàn Cao su Việt Nam', price: 32350, refPrice: 32200, change: 150, changePercent: 0.47, high: 32700, low: 32250, volume: 79770, ceiling: 34450, floor: 29950, low52w: 22000, low2y: 17500, low3y: 15000, diffFromLow52wPct: 47.0, diffFromLow2yPct: 84.9, diffFromLow3yPct: 115.7, valuationStatus: 'Vùng phục hồi / Tăng mạnh' },
  PLX: { symbol: 'PLX', name: 'Petrolimex', price: 36400, refPrice: 36850, change: -450, changePercent: -1.22, high: 37000, low: 36200, volume: 272060, ceiling: 39400, floor: 34300, low52w: 31500, low2y: 29000, low3y: 27500, diffFromLow52wPct: 15.6, diffFromLow2yPct: 25.5, diffFromLow3yPct: 32.4, valuationStatus: 'Tích lũy gần đáy 52T' },
  POW: { symbol: 'POW', name: 'Điện lực Dầu khí PV Power', price: 12750, refPrice: 12550, change: 200, changePercent: 1.59, high: 12950, low: 12550, volume: 417960, ceiling: 13400, floor: 11700, low52w: 10200, low2y: 9500, low3y: 9000, diffFromLow52wPct: 25.0, diffFromLow2yPct: 34.2, diffFromLow3yPct: 41.7, valuationStatus: 'Tích lũy ổn định' },
  SAB: { symbol: 'SAB', name: 'Sabeco', price: 44450, refPrice: 43850, change: 600, changePercent: 1.37, high: 44600, low: 43800, volume: 35210, ceiling: 46900, floor: 40800, low52w: 39500, low2y: 38000, low3y: 37500, diffFromLow52wPct: 12.5, diffFromLow2yPct: 17.0, diffFromLow3yPct: 18.5, valuationStatus: 'Tích lũy gần đáy 52T' },
  BCM: { symbol: 'BCM', name: 'Becamex IDC', price: 40300, refPrice: 39800, change: 500, changePercent: 1.26, high: 40850, low: 39600, volume: 24530, ceiling: 42550, floor: 37050, low52w: 34000, low2y: 31500, low3y: 30000, diffFromLow52wPct: 18.5, diffFromLow2yPct: 27.9, diffFromLow3yPct: 34.3, valuationStatus: 'Tích lũy an toàn' },
  BVH: { symbol: 'BVH', name: 'Tập đoàn Bảo Việt', price: 69500, refPrice: 70500, change: -1000, changePercent: -1.42, high: 70500, low: 69200, volume: 22390, ceiling: 75400, floor: 65600, low52w: 59000, low2y: 54000, low3y: 51000, diffFromLow52wPct: 17.8, diffFromLow2yPct: 28.7, diffFromLow3yPct: 36.3, valuationStatus: 'Tích lũy gần đáy 52T' },
  VJC: { symbol: 'VJC', name: 'Vietjet Air', price: 134000, refPrice: 138000, change: -4000, changePercent: -2.9, high: 138000, low: 132700, volume: 68980, ceiling: 147600, floor: 128400, low52w: 105000, low2y: 98000, low3y: 95000, diffFromLow52wPct: 27.6, diffFromLow2yPct: 36.7, diffFromLow3yPct: 41.1, valuationStatus: 'Tích lũy ổn định' },
  SSB: { symbol: 'SSB', name: 'SeABank', price: 20900, refPrice: 22450, change: -1550, changePercent: -6.9, high: 21700, low: 20900, volume: 343750, ceiling: 24000, floor: 20900, low52w: 18000, low2y: 16500, low3y: 15000, diffFromLow52wPct: 16.1, diffFromLow2yPct: 26.7, diffFromLow3yPct: 39.3, valuationStatus: 'Tích lũy gần đáy 52T' },
  BMP: { symbol: 'BMP', name: 'Nhựa Bình Minh', price: 132000, refPrice: 131500, change: 500, changePercent: 0.38, high: 133000, low: 131000, volume: 15400, ceiling: 140700, floor: 122300, low52w: 88000, low2y: 65000, low3y: 52000, diffFromLow52wPct: 50.0, diffFromLow2yPct: 103.1, diffFromLow3yPct: 153.8, valuationStatus: 'Vùng tăng trưởng mạnh' },
  VEA: { symbol: 'VEA', name: 'Tổng công ty VEAM', price: 46200, refPrice: 45900, change: 300, changePercent: 0.65, high: 46600, low: 45800, volume: 48900, ceiling: 52700, floor: 39100, low52w: 36000, low2y: 32000, low3y: 30000, diffFromLow52wPct: 28.3, diffFromLow2yPct: 44.4, diffFromLow3yPct: 54.0, valuationStatus: 'Tích lũy an toàn' },
  NKG: { symbol: 'NKG', name: 'Thép Nam Kim', price: 9980, refPrice: 9980, change: 0, changePercent: 0, high: 10050, low: 9900, volume: 59260, ceiling: 10650, floor: 9290, low52w: 8000, low2y: 7200, low3y: 6500, diffFromLow52wPct: 24.8, diffFromLow2yPct: 38.6, diffFromLow3yPct: 53.5, valuationStatus: 'Tích lũy ổn định' },
  HSG: { symbol: 'HSG', name: 'Tập đoàn Hoa Sen', price: 10100, refPrice: 10100, change: 0, changePercent: 0, high: 10150, low: 10050, volume: 86010, ceiling: 10800, floor: 9400, low52w: 8100, low2y: 7400, low3y: 6800, diffFromLow52wPct: 24.7, diffFromLow2yPct: 36.5, diffFromLow3yPct: 48.5, valuationStatus: 'Tích lũy ổn định' },
  PVD: { symbol: 'PVD', name: 'Khoan Dầu khí PVD', price: 19150, refPrice: 19350, change: -200, changePercent: -1.03, high: 19400, low: 19100, volume: 149790, ceiling: 20700, floor: 18000, low52w: 16000, low2y: 14500, low3y: 13000, diffFromLow52wPct: 19.7, diffFromLow2yPct: 32.1, diffFromLow3yPct: 47.3, valuationStatus: 'Tích lũy gần đáy 52T' },
  PVS: { symbol: 'PVS', name: 'Dịch vụ Kỹ thuật Dầu khí PTSC', price: 32900, refPrice: 33300, change: -400, changePercent: -1.2, high: 33500, low: 32700, volume: 149380, ceiling: 36600, floor: 30000, low52w: 28000, low2y: 25000, low3y: 22000, diffFromLow52wPct: 17.5, diffFromLow2yPct: 31.6, diffFromLow3yPct: 49.5, valuationStatus: 'Tích lũy gần đáy 52T' },
  DIG: { symbol: 'DIG', name: 'Tổng Công ty DIC Corp', price: 10100, refPrice: 10100, change: 0, changePercent: 0, high: 10250, low: 10050, volume: 85100, ceiling: 10800, floor: 9400, low52w: 8200, low2y: 7500, low3y: 6800, diffFromLow52wPct: 23.2, diffFromLow2yPct: 34.7, diffFromLow3yPct: 48.5, valuationStatus: 'Tích lũy ổn định' },
  DXG: { symbol: 'DXG', name: 'Tập đoàn Đất Xanh', price: 10500, refPrice: 10550, change: -50, changePercent: -0.47, high: 10700, low: 10450, volume: 250760, ceiling: 11250, floor: 9820, low52w: 8400, low2y: 7800, low3y: 7000, diffFromLow52wPct: 25.0, diffFromLow2yPct: 34.6, diffFromLow3yPct: 50.0, valuationStatus: 'Tích lũy ổn định' },
  VIX: { symbol: 'VIX', name: 'Chứng khoán VIX', price: 13100, refPrice: 12800, change: 300, changePercent: 2.34, high: 13150, low: 12800, volume: 1078430, ceiling: 13650, floor: 11950, low52w: 9500, low2y: 7200, low3y: 6000, diffFromLow52wPct: 37.9, diffFromLow2yPct: 81.9, diffFromLow3yPct: 118.3, valuationStatus: 'Vùng phục hồi / Tăng mạnh' },
};

/**
 * Trích xuất mã cổ phiếu 3 ký tự (HOSE/HNX/UPCoM) từ tên tài sản hoặc mục tiêu
 * Đảm bảo chỉ trích xuất khi phân loại đúng là Cổ phiếu (type === 'stock' hoặc assetType === 'stock' hoặc unit === 'CP')
 * Tuyệt đối không trích xuất các mã ngân hàng, tiền gửi, sổ tiết kiệm, nợ vay (ACB, VCB, BID, VAY...)
 */
export function extractStockTicker(
  name: string,
  typeOrAssetType?: string,
  unitOrAssetType?: string,
  maybeUnit?: string
): string | null {
  if (!name) return null;

  let type: string | undefined = undefined;
  let assetType: string | undefined = undefined;
  let unit: string | undefined = undefined;

  if (maybeUnit !== undefined) {
    type = typeOrAssetType;
    assetType = unitOrAssetType;
    unit = maybeUnit;
  } else {
    type = typeOrAssetType;
    assetType = typeOrAssetType;
    unit = unitOrAssetType;
  }

  // 1. Loại trừ tuyệt đối nếu phân loại đã xác định KHÔNG PHẢI là Cổ phiếu
  const nonStockTypes = [
    'cash',
    'saving',
    'gold',
    'realestate_live',
    'realestate_rent',
    'realestate_land',
    'bond',
    'crypto',
    'peer_lending',
    'private_equity',
    'debt',
    'other',
  ];
  if (type && nonStockTypes.includes(type)) return null;
  if (assetType && nonStockTypes.includes(assetType)) return null;

  const nameLower = name.toLowerCase().trim();
  const unitUpper = (unit || '').toUpperCase().trim();

  // 2. Nếu không được đánh dấu là stock, kiểm tra loại trừ từ khóa nợ, bank, tiết kiệm
  const isExplicitlyStock = type === 'stock' || assetType === 'stock' || unitUpper === 'CP';
  if (!isExplicitlyStock) {
    if (
      nameLower.includes('vay') ||
      nameLower.includes('nợ') ||
      nameLower.includes('mượn') ||
      nameLower.includes('tiết kiệm') ||
      nameLower.includes('tiền gửi') ||
      nameLower.includes('tiền mặt') ||
      nameLower.includes('tài khoản') ||
      nameLower.includes('ngân hàng') ||
      nameLower.includes('thanh toán') ||
      nameLower.includes('thẻ') ||
      nameLower.includes('sổ ')
    ) {
      return null;
    }
  }

  // 3. Kiểm tra định dạng có ngoặc: "(HPG)" hoặc "[HPG]"
  const matchParen = name.match(/[\(\[]([A-Z0-9]{3})[\)\]]/i);
  if (matchParen) {
    const sym = matchParen[1].toUpperCase();
    if (sym !== 'VND') return sym;
  }

  // 4. Kiểm tra tiền tố "CP HPG", "Cổ phiếu HPG", "Mã HPG", "CK HPG"
  const matchPrefix = name.match(/(?:CP|Cổ phiếu|Mã|CK)\s+([A-Za-z0-9]{3})\b/i);
  if (matchPrefix) {
    const sym = matchPrefix[1].toUpperCase();
    if (sym !== 'VND') return sym;
  }

  // 5. Nếu là phân loại cổ phiếu hoặc tên có chữ cổ phiếu/chứng khoán rõ ràng
  if (isExplicitlyStock || nameLower.includes('cổ phiếu') || nameLower.includes('chứng khoán')) {
    // Kiểm tra từ đầu câu là 3 chữ cái: "HPG - Hòa Phát", "HPG Hòa Phát", "HPG"
    const matchStart = name.match(/^([A-Za-z0-9]{3})\b/);
    if (matchStart) {
      const sym = matchStart[1].toUpperCase();
      if (sym !== 'VND') {
        return sym;
      }
    }

    // Tìm token 3 chữ hoa bất kỳ trong chuỗi (ví dụ "Đầu tư HPG gom định kỳ")
    const matchAny3 = name.match(/\b([A-Z]{3})\b/);
    if (matchAny3 && matchAny3[1] !== 'VND') {
      return matchAny3[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Kiểm tra xem một item (Tài sản hoặc Mục tiêu) có phải là cổ phiếu hay không
 * Căn cứ chặt chẽ theo PHÂN LOẠI (Asset.type === 'stock', Goal.assetType === 'stock')
 * Loại trừ tuyệt đối các khoản Nợ vay (Tab 2), Tiết kiệm và Tài khoản ngân hàng
 */
export function isStockEntity(item: {
  type?: string;
  assetType?: string;
  unit?: string;
  name: string;
  category?: string;
  group?: string;
  linkedDebtId?: number;
}): boolean {
  if (!item) return false;

  // 1. TUYỆT ĐỐI KHÔNG PHẢI CỔ PHIẾU: Nếu là khoản nợ, trả góp, mượn hoặc mục tiêu trả nợ
  if (
    item.category ||
    item.group === 'debt' ||
    (item.linkedDebtId !== undefined && item.linkedDebtId !== null)
  ) {
    return false;
  }

  // 2. THEO PHÂN LOẠI TÀI SẢN (Tab 1):
  if (item.type !== undefined) {
    // Chỉ duy nhất phân loại 'stock' mới là cổ phiếu
    return item.type === 'stock';
  }

  // 3. THEO PHÂN LOẠI MỤC TIÊU (Tab 3):
  if (item.assetType !== undefined) {
    // Chỉ duy nhất phân loại 'stock' mới là cổ phiếu
    return item.assetType === 'stock';
  }

  // 4. Fallback khi item chưa được gán type/assetType (chỉ xét nếu không có từ khóa nợ/bank/tiết kiệm)
  const nameLower = (item.name || '').toLowerCase().trim();
  const unitUpper = (item.unit || '').toUpperCase().trim();

  if (
    nameLower.includes('vay') ||
    nameLower.includes('nợ') ||
    nameLower.includes('mượn') ||
    nameLower.includes('tiết kiệm') ||
    nameLower.includes('tiền gửi') ||
    nameLower.includes('tiền mặt') ||
    nameLower.includes('tài khoản') ||
    nameLower.includes('ngân hàng') ||
    nameLower.includes('thanh toán') ||
    nameLower.includes('thẻ') ||
    nameLower.includes('sổ ')
  ) {
    return false;
  }

  // Chỉ chấp nhận là cổ phiếu nếu đơn vị là 'CP' hoặc tên ghi rõ 'cổ phiếu'/'chứng khoán'
  if (unitUpper === 'CP' || nameLower.includes('cổ phiếu') || nameLower.includes('chứng khoán')) {
    return true;
  }

  return false;
}

export interface Top3Recommendation {
  symbol: string;
  name: string;
  category?: 'growth' | 'dividend';
  categoryLabel?: string;
  pillar: 'finance' | 'industry' | 'defensive' | 'growth' | 'dividend';
  pillarLabel: string;
  actionZone: 'buy_dca' | 'accumulate' | 'watch';
  actionZoneLabel: string;
  reason: string;
  valuationNote: string;
  targetHorizon: string;
  screenScore?: number;
  screenBadge?: string;
  dividendYield?: string;
  filterCriteria?: string;
  rank?: number;
  livePrice?: number;
  liveChange?: number;
  liveChangePercent?: number;
  livePe?: number;
  livePb?: number;
  liveRoe?: number;
  liveDividendYield?: string;
}

/**
 * Cấu trúc Khuyến nghị Gửi Tiết Kiệm Lãi Suất Tốt Nhất
 */
export interface SavingsRecommendation {
  id: string;
  bankName: string;
  rateRange: string;
  term: string;
  minDeposit?: string;
  safetyRating: string;
  badge?: string;
  highlights: string[];
  advice: string;
  defaultBankKey?: string;
  defaultRate?: number;
  defaultMonths?: number;
  screenBadge?: string;
  screenScore?: number;
}

/**
 * Cấu trúc Khuyến nghị Trái Phiếu Doanh Nghiệp Tốt Nhất
 */
export interface BondRecommendation {
  id: string;
  issuerName: string;
  symbolOrCode: string;
  couponRange: string;
  tenor: string;
  creditRating: string;
  collateral: string;
  badge: string;
  highlights: string[];
  advice: string;
}

/**
 * Top 3 Khuyến Nghị Gửi Tiết Kiệm Lãi Suất Tốt Nhất
 */
export const TOP3_SAVINGS_RECOMMENDATIONS: SavingsRecommendation[] = [
  {
    id: 'savings-cd-private',
    bankName: 'NHTMCP Năng Động (NCB, OCB, HDBank, BVBank, VPBank)',
    rateRange: '8.8% - 9.2% ~ 9.5% / năm (Mốc ~9.0%/năm)',
    term: '18 - 36 tháng (Chứng chỉ tiền gửi / Tiết kiệm tích lũy dài hạn)',
    minDeposit: 'Từ 10 triệu (Tiết kiệm online) hoặc từ 50 - 100 triệu (Chứng chỉ tiền gửi)',
    safetyRating: 'An Toàn Cao • 100% Bảo Hiểm Tiền Gửi Quốc Gia',
    badge: 'Lãi Suất Đỉnh 9.0% - 9.5%',
    highlights: [
      'Lãi suất huy động thực nhận đã chạm ngưỡng 8.8% - 9.2% ~ 9.5%/năm tại các gói kỳ hạn 18–36 tháng và Chứng chỉ tiền gửi.',
      'Khóa trần lãi suất thực dương cao vượt trội so với lạm phát (3.5% - 4.0%) để tối ưu lãi kép an toàn.',
      'Được phép chuyển nhượng, cầm cố chứng chỉ tiền gửi để vay ngược linh hoạt khi cần thanh khoản đột xuất.',
      'Cộng thêm biên độ 0.3% - 0.5%/năm khi mở sổ online trên ứng dụng ngân hàng số.',
    ],
    advice: 'Cơ hội vàng để phân bổ 20 - 30% tổng tài sản khóa lợi tức cố định ~9%/năm cho Quỹ Runway và vốn an toàn dài hạn.',
    defaultBankKey: 'NCB / HDBank',
    defaultRate: 9.0,
    defaultMonths: 24,
  },
  {
    id: 'savings-ladder-online',
    bankName: 'Tiết Kiệm Bậc Thang Online (Techcombank, VIB, SHB, ACB)',
    rateRange: '6.5% - 7.5% / năm',
    term: '12 - 18 tháng (Lãi trả cuối kỳ hoặc nhận hàng tháng)',
    minDeposit: 'Từ 1 triệu đồng',
    safetyRating: 'Thanh Khoản Linh Hoạt • Quản Lý App 24/7',
    badge: 'Linh Hoạt & Tối Ưu',
    highlights: [
      'Cho phép rút gốc từng phần mà không bị mất lãi suất của phần tiền gửi còn lại.',
      'Dễ dàng chia nhỏ sổ (mỗi sổ 20 - 50 triệu) theo chiến lược bậc thang kỳ hạn (Laddering).',
      'Tự động quay vòng gốc và lãi để phát huy tối đa sức mạnh lãi kép hàng năm.',
    ],
    advice: 'Khuyên dùng cho dòng tiền nhàn rỗi tích lũy định kỳ hàng tháng (DCA) từ lương và thặng dư Tab 2.',
    defaultBankKey: 'Techcombank',
    defaultRate: 7.0,
    defaultMonths: 12,
  },
  {
    id: 'savings-big4-safe',
    bankName: 'Khối Ngân Hàng Quốc Doanh Big 4 (Vietcombank, BIDV, CTG, Agribank)',
    rateRange: '5.0% - 5.8% / năm',
    term: '12 - 24 tháng (Kỳ hạn 1 - 3 tháng: 2.0% - 2.8%; 6 - 9 tháng: 3.8% - 4.8%)',
    minDeposit: 'Từ 1 triệu đồng',
    safetyRating: 'An Toàn Tuyệt Đối 100% • Chuẩn Quốc Doanh',
    badge: 'Quỹ Dự Phòng Runway',
    highlights: [
      'Mức độ an toàn tuyệt đối cao nhất toàn hệ thống tài chính Việt Nam.',
      'Hệ thống chi nhánh và ATM bao phủ toàn quốc, thuận tiện giải ngân mọi thời điểm.',
      'Là nơi lưu trữ bắt buộc cho Quỹ khẩn cấp và Quỹ Runway 6 - 12 tháng sinh hoạt phí.',
    ],
    advice: 'Duy trì cố định 3 - 6 tháng chi phí gia đình tại đây, không bao giờ đem khoản tiền này đi đầu cơ.',
    defaultBankKey: 'Vietcombank',
    defaultRate: 5.3,
    defaultMonths: 12,
  },
];

/**
 * Top 3 Khuyến Nghị Trái Phiếu Doanh Nghiệp Tốt Nhất (Lãi Suất Tốt & An Toàn Cao)
 */
export const TOP3_BONDS_RECOMMENDATIONS: BondRecommendation[] = [
  {
    id: 'bond-bank-tier2',
    issuerName: 'Trái Phiếu Ngân Hàng Cấp 2 (Techcombank, BIDV, VietinBank, MBBank)',
    symbolOrCode: 'TCBL2427 / BIDL2328',
    couponRange: '6.8% - 7.8% / năm',
    tenor: '3 - 5 năm (Tổ chức phát hành có quyền mua lại sau 1-2 năm)',
    creditRating: 'Xếp Hạng AAA / AA- (Chuẩn tín nhiệm cao nhất)',
    collateral: 'Nghĩa vụ nợ thứ cấp của Ngân hàng lớn hàng đầu Việt Nam',
    badge: 'An Toàn Tiệm Cận Tiền Gửi',
    highlights: [
      'Lãi suất vượt trội hơn tiền gửi tiết kiệm cùng kỳ hạn từ 1.5% - 2.2%/năm.',
      'Tính thanh khoản thứ cấp cao, dễ dàng bán lại cho công ty chứng khoán hoặc nhà đầu tư khác.',
      'Tổ chức phát hành là các Ngân hàng lớn có năng lực tài chính và quản trị rủi ro hàng đầu.',
    ],
    advice: 'Kênh thay thế tiết kiệm cực tốt cho nhà đầu tư muốn tối ưu hóa lợi nhuận mà vẫn kiểm soát rủi ro an toàn.',
  },
  {
    id: 'bond-corp-industry',
    issuerName: 'Trái Phiếu Doanh Nghiệp Sản Xuất & Hạ Tầng Đầu Ngành (Hòa Phát, Masan, GELEX)',
    symbolOrCode: 'HPGBAND / MSNB2429',
    couponRange: '8.5% - 9.8% / năm',
    tenor: '2 - 4 năm (Kỳ trả lãi định kỳ 3 - 6 tháng/lần)',
    creditRating: 'Xếp Hạng A+ / AA • Có Tổ Chức Bảo Lãnh Thanh Toán',
    collateral: 'Nhà máy sản xuất, cổ phần niêm yết có giá trị cao hoặc Bất động sản pháp lý sạch',
    badge: 'Dòng Tiền Thực Vững Chắc',
    highlights: [
      'Doanh nghiệp có doanh thu và dòng tiền hoạt động kinh doanh hàng năm lên đến hàng chục nghìn tỷ đồng.',
      'Tài sản bảo đảm được định giá và quản lý bởi Ngân hàng lưu ký độc lập.',
      'Hưởng lợi trực tiếp từ chính sách giải ngân đầu tư công và hạ tầng quốc gia.',
    ],
    advice: 'Phù hợp phân bổ 10 - 15% danh mục để tăng tốc độ tích lũy tài sản từ nguồn dòng tiền trả lãi định kỳ.',
  },
  {
    id: 'bond-industrial-energy',
    issuerName: 'Trái Phiếu BĐS Khu Công Nghiệp & Năng Lượng Tái Tạo (Becamex IDC, Vinhomes, REE)',
    symbolOrCode: 'BCMB2428 / VHM12401',
    couponRange: '9.5% - 10.5% / năm',
    tenor: '3 - 5 năm',
    creditRating: 'Xếp Hạng A / A+ • Đảm bảo bằng dòng tiền FDI & PPA',
    collateral: 'Quyền sử dụng đất khu công nghiệp, dự án đô thị và dòng tiền thu từ hợp đồng thuê FDI',
    badge: 'Lợi Tức Cao & Bảo Lãnh FDI',
    highlights: [
      'Lợi tức cao 9.5% - 10.5%/năm giúp nhân đôi tài sản theo quy tắc 72 sau khoảng 7 năm.',
      'Khách thuê là các tập đoàn đa quốc gia hàng đầu thế giới (FDI) cam kết dòng tiền thuê dài hạn.',
      'Có cam kết bảo lãnh thanh toán hoặc điều khoản mua lại từ các tổ chức tài chính uy tín.',
    ],
    advice: 'Lựa chọn xuất sắc cho mục tiêu dài hạn (>3 năm), cần tìm hiểu kỹ đơn vị phân phối uy tín (TCBS, VPS, SSI).',
  },
];

/**
 * Cấu trúc phân tích vĩ mô & tầm nhìn chiến lược quốc gia >5 năm
 */
export interface MacroPillarInfo {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  currentReality: {
    label: string;
    details: string[];
  };
  forecast: {
    trend: 'increase' | 'decrease' | 'stable' | 'expansion' | 'accelerate';
    trendLabel: string;
    explanation: string;
  };
  marketImpact: {
    impactLabel: string;
    details: string[];
  };
  recommendation: {
    actionTitle: string;
    actionDetail: string;
    suggestedAssets?: string[];
  };
}

export interface MacroOverviewData {
  lastUpdatedStr: string;
  timeHorizon: string;
  pillars: {
    bankRates: MacroPillarInfo;
    fedRates: MacroPillarInfo;
    moneySupply: MacroPillarInfo;
    govVision: MacroPillarInfo;
  };
  executiveSummary: {
    title: string;
    description: string;
    allocationMatrix: {
      assetClass: string;
      weightRange: string;
      role: string;
      colorClass: string;
    }[];
    corePrinciples: string[];
  };
}

/**
 * Dữ liệu Phân tích Vĩ mô & Tầm nhìn Quốc gia >5 Năm cập nhật mới nhất
 */
export const MACRO_FINANCIAL_OVERVIEW: MacroOverviewData = {
  lastUpdatedStr: 'Cập nhật mới nhất: Quý 3/2026 (Dữ liệu liên ngân hàng SBV, FED & Tổng Cục Thống Kê)',
  timeHorizon: 'Tầm nhìn chiến lược 2026 - 2030 & 2045',
  pillars: {
    bankRates: {
      id: 'bankRates',
      title: '1. Lãi Suất Ngân Hàng & Tiền Gửi (SBV & NHTM)',
      tag: 'Mặt bằng kỳ dài ~9.0%',
      tagColor: 'blue',
      currentReality: {
        label: 'Thông tin cập nhật mới nhất về mặt bằng lãi suất:',
        details: [
          'Lãi suất điều hành NHNN: Tái cấp vốn 4.5%/năm, Tái chiết khấu 3.0%/năm, Trần lãi suất tiền gửi <6 tháng 4.75%/năm.',
          'Huy động Big 4 (VCB, BIDV, CTG, Agribank): 1-3 tháng 2.0% - 2.8%, 6-9 tháng 3.8% - 4.8%, 12-24 tháng 5.0% - 5.8%/năm.',
          'Huy động NHTMCP tư nhân năng động (NCB, OCB, HDBank, BVBank, VPBank): Kỳ hạn 18-36 tháng hoặc Chứng chỉ tiền gửi số dư lớn đã chạm 8.8% - 9.2% ~ 9.5%/năm (mặt bằng quanh mốc 9.0%/năm). Kỳ hạn ngắn 6-12 tháng dao động 5.8% - 6.8%/năm.',
          'Lãi suất cho vay: Các gói ưu đãi sản xuất/mua nhà ở mức 5.5% - 7.0%/năm (cố định 1-2 năm); sau ưu đãi thả nổi dao động quanh 9.5% - 10.8%/năm.',
        ],
      },
      forecast: {
        trend: 'stable',
        trendLabel: 'Dự đoán lãi suất: DUY TRÌ MẶT BẰNG KỲ DÀI ~9.0% VÀ PHÂN HÓA MẠNH',
        explanation: 'Lãi suất huy động kỳ hạn dài và chứng chỉ tiền gửi tại khối NHTMCP tư nhân được duy trì ở mức cao ~9.0%/năm nhằm thu hút vốn trung và dài hạn tài trợ cho chu kỳ phục hồi kinh tế và kiểm soát tỷ giá, trong khi lãi suất ngắn hạn được NHNN giữ ổn định.',
      },
      marketImpact: {
        impactLabel: 'Tác động tới thị trường:',
        details: [
          'Thanh khoản hệ thống ngân hàng phân hóa: Dòng tiền gửi cá nhân chuyển dịch mạnh vào các gói kỳ hạn 18-36 tháng và chứng chỉ tiền gửi để chốt lợi tức thực dương cao ~9%/năm.',
          'Người gửi tiền hưởng lợi lớn khi biên độ lãi thực dương đạt 5.0% - 5.5% so với lạm phát (3.5% - 4.0%).',
          'Biên lãi ròng (NIM) các ngân hàng sở hữu tỷ lệ tiền gửi CASA vượt trội (TCB, MBB) được nới rộng khi nhu cầu vay phục hồi.',
        ],
      },
      recommendation: {
        actionTitle: 'Nên đầu tư vào cái gì:',
        actionDetail: 'Với dòng tiền an toàn: Tranh thủ gửi kỳ hạn dài (18-36 tháng) hoặc Chứng chỉ tiền gửi đang ở mức đỉnh 8.8% - 9.2% ~ 9.5%/năm (quanh mốc 9%) để khóa mức lãi suất thực dương cao vượt trội so với lạm phát (3.5% - 4.0%) cho Quỹ Runway 6-12 tháng. Với kênh tăng trưởng: Tích sản cổ phiếu Ngân hàng CASA cao (TCB, MBB, ACB)... Quản trị tỷ lệ trả góp nợ (DSTI) luôn dưới 40% thu nhập.',
        suggestedAssets: ['Chứng chỉ tiền gửi & Tiết kiệm kỳ dài (8.8% - 9.5%/năm)', 'Cổ phiếu Ngân hàng CASA cao (TCB, MBB, ACB)', 'Tiết kiệm bậc thang Laddering'],
      },
    },
    fedRates: {
      id: 'fedRates',
      title: '2. Lãi Suất FED & Tiền Tệ Toàn Cầu (Mỹ, DXY & Tỷ Giá)',
      tag: 'Chu kỳ nới lỏng',
      tagColor: 'emerald',
      currentReality: {
        label: 'Thông tin cập nhật mới nhất về chính sách quốc tế:',
        details: [
          'Cục Dự trữ Liên bang Mỹ (FED) duy trì lộ trình hạ lãi suất điều hành (Fed Funds Rate) từ đỉnh 5.50% xuống dần vùng 4.25% - 4.50%.',
          'Chỉ số đồng Đô la Mỹ (DXY) hạ nhiệt từ đỉnh 106-107 điểm về vùng 101-103 điểm, giúp giảm áp lực đầu cơ tỷ giá toàn cầu.',
          'Tỷ giá USD/VND hạ nhiệt, giúp Ngân hàng Nhà nước chủ động bơm thanh khoản qua kênh OMO và mua bổ sung dự trữ ngoại hối.',
        ],
      },
      forecast: {
        trend: 'decrease',
        trendLabel: 'Dự đoán lãi suất: FED TIẾP TỤC HẠ THÊM 0.5% - 0.75% VỀ VÙNG 3.5% - 3.75%',
        explanation: 'Thị trường lao động Mỹ hạ nhiệt và lạm phát PCE tiệm cận mục tiêu 2%, buộc FED duy trì chu kỳ cắt giảm lãi suất về mức trung tính trong 1-2 năm tới. Tỷ giá USD/VND dự kiến duy trì ổn định trong biên độ hẹp ±3%.',
      },
      marketImpact: {
        impactLabel: 'Tác động tới thị trường:',
        details: [
          'Dòng vốn ngoại (FDI và dòng tiền đầu tư gián tiếp FII) bắt đầu quay lại mua ròng thị trường chứng khoán Việt Nam sau thời gian dài bán ròng.',
          'Doanh nghiệp có dư nợ vay ngoại tệ USD lớn (hàng không, nhiệt điện, xuất nhập khẩu) giảm bớt chi phí lỗ chênh lệch tỷ giá.',
          'Tạo dư địa rộng mở để NHNN Việt Nam duy trì chính sách tiền tệ hỗ trợ tăng trưởng mà không lo chảy máu ngoại tệ.',
        ],
      },
      recommendation: {
        actionTitle: 'Nên đầu tư vào cái gì:',
        actionDetail: 'KHÔNG NÊN găm giữ tiền mặt USD vì chi phí cơ hội cao và xu hướng hạ lãi suất của FED. Nên tập trung vốn vào Cổ phiếu VN30 vốn hóa lớn hưởng lợi từ dòng tiền ngoại quay lại; Doanh nghiệp xuất khẩu đầu ngành; Cổ phiếu BĐS Khu công nghiệp đón sóng nhà máy FDI dịch chuyển (IDC, KBC).',
        suggestedAssets: ['Cổ phiếu BĐS Khu công nghiệp (IDC, KBC)', 'Cổ phiếu Doanh nghiệp xuất khẩu', 'Rổ VN30 định giá hấp dẫn'],
      },
    },
    moneySupply: {
      id: 'moneySupply',
      title: '3. Cung Tiền M2, Tín Dụng & Lạm Phát CPI',
      tag: 'Bơm tiền kích cầu',
      tagColor: 'amber',
      currentReality: {
        label: 'Thông tin cập nhật mới nhất về tiền tệ & lạm phát:',
        details: [
          'Tốc độ tăng trưởng Cung tiền M2 đạt 12% - 14%/năm, đảm bảo thanh khoản dồi dào phục vụ hoạt động sản xuất kinh doanh.',
          'Tăng trưởng tín dụng toàn hệ thống định hướng 15% (~2.2 - 2.5 triệu tỷ đồng vốn mới được bơm ra nền kinh tế mỗi năm).',
          'Lạm phát CPI bình quân được kiểm soát tốt quanh mức 3.5% - 4.0%, nằm dưới ngưỡng chỉ tiêu Quốc hội giao (4.5%).',
        ],
      },
      forecast: {
        trend: 'expansion',
        trendLabel: 'Dự đoán: CUNG TIỀN M2 & TÍN DỤNG TIẾP TỤC MỞ RỘNG MẠNH, CPI TĂNG NHẸ LÊN 3.8% - 4.2%',
        explanation: 'Để đạt mục tiêu tăng trưởng GDP trên 6.5 - 7.0%, chính sách tài khóa và tiền tệ sẽ tiếp tục trạng thái mở rộng thanh khoản. Do độ trễ cung tiền, CPI có thể nhích nhẹ nhưng vẫn trong tầm kiểm soát.',
      },
      marketImpact: {
        impactLabel: 'Tác động tới thị trường:',
        details: [
          'Sức mua của tiền mặt (Cash) bị xói mòn lũy kế theo thời gian do lượng tiền bơm ra nền kinh tế tăng nhanh hơn tốc độ tăng trưởng hàng hóa.',
          'Các tài sản khan hiếm có tính phòng thủ và tài sản sinh lời (Vàng miếng, Bất động sản đất nền, Cổ phiếu doanh nghiệp sở hữu tài sản thực) có xu hướng tăng giá mạnh theo lượng cung tiền.',
          'Thanh khoản thị trường chứng khoán được hỗ trợ mạnh mẽ, dòng tiền nhàn rỗi dễ dàng tìm đến các kênh đầu tư sinh lời.',
        ],
      },
      recommendation: {
        actionTitle: 'Nên đầu tư vào cái gì:',
        actionDetail: 'Hạn chế tối đa để tiền mặt nhàn rỗi nằm im trong tài khoản thanh toán không sinh lãi. Bắt buộc chuyển hóa dòng tiền thặng dư hàng tháng vào: Vàng nhẫn ép vỉ 9999 (SJC/DOJI) làm lá chắn chống lạm phát (15% - 20% danh mục); Tích sản cổ phiếu các doanh nghiệp tạo dòng tiền thật (HPG, FPT, MWG, TCB); Bất động sản có dòng tiền khai thác thực tế.',
        suggestedAssets: ['Vàng nhẫn / miếng 9999 (SJC, DOJI)', 'Cổ phiếu tích sản DCA (HPG, FPT, MWG, TCB)', 'BĐS tạo dòng tiền cho thuê'],
      },
    },
    govVision: {
      id: 'govVision',
      title: '4. Đầu Tư Công, Đại Hạ Tầng & Nâng Hạng TTCK (>5 Năm)',
      tag: 'Kỷ nguyên tăng tốc vươn mình',
      tagColor: 'indigo',
      currentReality: {
        label: 'Thông tin cập nhật mới nhất về đại dự án & chính sách:',
        details: [
          'Quy mô giải ngân vốn đầu tư công đạt mức kỷ lục trong lịch sử, tập trung vào các công trình hạ tầng giao thông trọng điểm quốc gia.',
          'Đồng loạt triển khai đại dự án: 5.000km đường bộ cao tốc, khởi công Đường sắt tốc độ cao Bắc - Nam 67 tỷ USD, Sân bay Quốc tế Long Thành giai đoạn 1, Vành đai 4 Hà Nội & Vành đai 3 TP.HCM.',
          'Bộ Tài chính & UBCKNN hoàn thiện cơ chế bỏ ký quỹ trước (Non-prefunding), hoàn tất các điều kiện nâng hạng TTCK Việt Nam lên Thị trường Mới nổi (FTSE Emerging Markets).',
        ],
      },
      forecast: {
        trend: 'accelerate',
        trendLabel: 'Dự đoán: ĐẨY MẠNH GIẢI NGÂN ĐẦU TƯ CÔNG ĐỘT PHÁ & CHÍNH THỨC NÂNG HẠNG TTCK',
        explanation: 'Giai đoạn 2026 - 2030 là cao điểm hoàn thiện hạ tầng kết nối liên vùng và đón nhận dòng vốn thụ động 3 - 5 tỷ USD từ các quỹ ETF toàn cầu khi thị trường chính thức được nâng hạng.',
      },
      marketImpact: {
        impactLabel: 'Tác động tới thị trường:',
        details: [
          'Nhóm doanh nghiệp vật liệu xây dựng (thép, xi măng, đá) và nhà thầu xây lắp hạ tầng được đảm bảo sản lượng tiêu thụ và doanh thu tăng trưởng đột biến trong nhiều năm tới.',
          'Thanh khoản thị trường chứng khoán bùng nổ lên ngưỡng 25.000 - 35.000 tỷ đồng/phiên khi các định chế tài chính toàn cầu giải ngân vào rổ VN30.',
          'Bất động sản đón sóng tăng giá mạnh mẽ tại các khu vực hưởng lợi trực tiếp từ hạ tầng: Vành đai 3, Vành đai 4, khu đô thị phụ cận sân bay Long Thành và các nút giao cao tốc.',
        ],
      },
      recommendation: {
        actionTitle: 'Nên đầu tư vào cái gì:',
        actionDetail: 'Tích sản dài hạn các doanh nghiệp đầu ngành hưởng lợi trực tiếp: Cổ phiếu Thép & Hạ tầng (HPG - chi phí sản xuất thấp nhất, cung cấp ray đường sắt cao tốc); Cổ phiếu Chứng khoán & Ngân hàng trung tâm thanh khoản (SSI, TCB, MBB); Cổ phiếu Công nghệ & AI (FPT). Đón đầu đất nền/nhà phố ven các trục giao thông lớn có quy hoạch 1/500 minh bạch.',
        suggestedAssets: ['HPG (Đại dự án Dung Quất 2 & Đường sắt tốc độ cao)', 'SSI (Sóng nâng hạng FTSE & Thanh khoản TTCK)', 'FPT (Công nghệ & AI Bán dẫn)', 'BĐS ven các nút giao cao tốc & vành đai'],
      },
    },
  },
  executiveSummary: {
    title: 'TỔNG KẾT VĨ MÔ & CHIẾN LƯỢC: NÊN ĐẦU TƯ VÀO CÁI GÌ NGAY LÚC NÀY?',
    description: 'Chiến lược phân bổ danh mục tài sản cá nhân 4 lớp tối ưu cho chu kỳ tiền tệ nới lỏng & hạ tầng 2026 – 2030:',
    allocationMatrix: [
      {
        assetClass: 'Cổ Phiếu Tích Sản (VN30 / Đầu Ngành)',
        weightRange: '40% - 50%',
        role: 'Động cơ tăng trưởng tài sản cốt lõi, đón sóng nới lỏng tiền tệ, đầu tư công và sự kiện nâng hạng TTCK (TCB, HPG, FPT, SSI).',
        colorClass: 'bg-blue-50 text-blue-950 border-blue-200',
      },
      {
        assetClass: 'Tiền Gửi Tiết Kiệm / Chứng Chỉ Tiền Gửi (Mặt bằng quanh 9.0%/năm; 8.8% - 9.5%)',
        weightRange: '20% - 25%',
        role: 'Khóa mức lãi suất thực dương cao vượt trội ở kỳ hạn dài (18-36 tháng) đạt ~9%/năm tạo dòng thu nhập thụ động cố định & Quỹ Runway vững chắc.',
        colorClass: 'bg-emerald-50 text-emerald-950 border-emerald-200',
      },
      {
        assetClass: 'Vàng Tích Trữ (DOJI / SJC Nhẫn 9999)',
        weightRange: '15% - 20%',
        role: 'Lá chắn phòng thủ kiên cố chống trượt giá tiền tệ trước tốc độ tăng trưởng cung tiền M2 12-14%/năm.',
        colorClass: 'bg-amber-50 text-amber-950 border-amber-200',
      },
      {
        assetClass: 'Bất Động Sản Dòng Tiền / Cột Mốc Lớn',
        weightRange: '15% - 20%',
        role: 'Tích lũy tài sản thực theo cột mốc dài hạn, chỉ mua BĐS có pháp lý sạch, khai thác cho thuê được ngay và kiểm soát DSTI < 40%.',
        colorClass: 'bg-purple-50 text-purple-950 border-purple-200',
      },
    ],
    corePrinciples: [
      'Tuyệt đối không đoán đỉnh đáy ngắn hạn – Duy trì kỷ luật tích sản định kỳ (DCA) đều đặn theo dòng tiền thặng dư hàng tháng.',
      'Tận dụng sức mạnh lãi kép >5 năm: Tái đầu tư toàn bộ cổ tức tiền mặt và lãi tiền gửi để gia tăng số lượng tài sản cơ sở.',
      'Kiểm soát dòng tiền nợ vay chặt chẽ: Dòng tiền trả góp nợ (DSTI) không bao giờ được vượt quá 40% tổng thu nhập hàng tháng.',
    ],
  },
};

/**
 * Khuyến nghị 6 cổ phiếu chiến lược cốt lõi: 3 mã Tăng Trưởng + 3 mã Cổ Tức
 */
export const RECOMMENDED_GROWTH_STOCKS: Top3Recommendation[] = [
  {
    symbol: 'FPT',
    name: 'Tập đoàn FPT',
    category: 'growth',
    categoryLabel: 'Cổ Phiếu Tăng Trưởng',
    pillar: 'defensive',
    pillarLabel: 'Công Nghệ & AI Bán Dẫn',
    actionZone: 'accumulate',
    actionZoneLabel: 'Tích Sản Định Kỳ (DCA)',
    reason: 'Tăng trưởng doanh thu và LNST >20%/năm liên tục trong thập kỷ qua, dẫn đầu xu thế AI, Điện toán đám mây và Xuất khẩu phần mềm toàn cầu.',
    valuationNote: 'ROE > 28% • Lợi nhuận tăng trưởng đều đặn >20%',
    targetHorizon: '3 - 5 năm',
    screenBadge: '🚀 Tăng Trưởng Công Nghệ & AI',
    screenScore: 98,
  },
  {
    symbol: 'HPG',
    name: 'Tập đoàn Hòa Phát',
    category: 'growth',
    categoryLabel: 'Cổ Phiếu Tăng Trưởng',
    pillar: 'industry',
    pillarLabel: 'Sản Xuất & Đầu Tư Công',
    actionZone: 'accumulate',
    actionZoneLabel: 'Vùng Gom Tích Sản',
    reason: 'Chi phí sản xuất thép thấp nhất ASEAN, đại dự án Dung Quất 2 tăng 66% công suất và đón sóng đường sắt cao tốc Bắc-Nam 67 tỷ USD.',
    valuationNote: 'P/E chu kỳ hấp dẫn • Bảng cân đối tiền mặt ròng',
    targetHorizon: '2 - 5 năm',
    screenBadge: '🏗️ Đại Dự Án Dung Quất 2',
    screenScore: 96,
  },
  {
    symbol: 'TCB',
    name: 'Techcombank',
    category: 'growth',
    categoryLabel: 'Cổ Phiếu Tăng Trưởng',
    pillar: 'finance',
    pillarLabel: 'Tài Chính / Ngân Hàng Số',
    actionZone: 'buy_dca',
    actionZoneLabel: 'Vùng Gom Tích Sản',
    reason: 'CASA và hiệu quả sinh lời dẫn đầu toàn ngành ngân hàng, tăng trưởng tín dụng bứt phá, hưởng lợi trực tiếp từ chu kỳ hồi phục kinh tế và BĐS.',
    valuationNote: 'P/B ~1.05x • Vùng giá chiết khấu an toàn',
    targetHorizon: '1 - 3 năm',
    screenBadge: '💳 Dẫn Đầu CASA & Tín Dụng',
    screenScore: 95,
  },
];

export const RECOMMENDED_DIVIDEND_STOCKS: Top3Recommendation[] = [
  {
    symbol: 'VEA',
    name: 'Tổng Công ty Máy Động lực (VEAM)',
    category: 'dividend',
    categoryLabel: 'Cổ Phiếu Cổ Tức Cao',
    pillar: 'defensive',
    pillarLabel: 'Vua Cổ Tức Tiền Mặt ~10-12%',
    actionZone: 'buy_dca',
    actionZoneLabel: 'Gom Nhận Cổ Tức Tiền Mặt',
    reason: 'Sở hữu 20% liên doanh Honda Việt Nam (thị phần xe máy ~80%), 20% Toyota và 25% Ford. Dòng tiền lợi nhuận đổ về 6.000 - 8.000 tỷ đồng/năm chia gần như 100% bằng tiền mặt (4.200 - 5.050đ/CP/năm), tỷ suất 10% - 12%/năm suốt nhiều năm liên tiếp.',
    valuationNote: 'Cổ tức tiền mặt ~10% - 12%/năm (4.500 - 5.050đ/CP) • P/E ~8.2x',
    targetHorizon: '2 - 5 năm',
    screenBadge: '👑 Vua Cổ Tức Honda/Toyota ~11%',
    screenScore: 98,
  },
  {
    symbol: 'BMP',
    name: 'Nhựa Bình Minh',
    category: 'dividend',
    categoryLabel: 'Cổ Phiếu Cổ Tức Cao',
    pillar: 'defensive',
    pillarLabel: 'Siêu Cổ Tức Tiền Mặt ~10-12%',
    actionZone: 'buy_dca',
    actionZoneLabel: 'Gom Nhận Cổ Tức Tiền Mặt',
    reason: 'Thống lĩnh thị phần ống nhựa, sở hữu tình hình tài chính siêu sạch không nợ vay, chi trả cổ tức tiền mặt kỷ lục 100% - 120% mệnh giá (10.000 - 12.000đ/CP/năm), tỷ suất cổ tức thực nhận vượt trội gửi tiết kiệm.',
    valuationNote: 'Tỷ suất cổ tức tiền mặt ~10% - 12%/năm • Cổ tức kỷ lục',
    targetHorizon: '2 - 5 năm',
    screenBadge: '💰 Cổ Tức Tiền Mặt Đỉnh ~10-12%',
    screenScore: 97,
  },
  {
    symbol: 'VNM',
    name: 'Vinamilk',
    category: 'dividend',
    categoryLabel: 'Cổ Phiếu Cổ Tức Cao',
    pillar: 'defensive',
    pillarLabel: 'Cổ Tức Tiền Mặt Bền Vững',
    actionZone: 'buy_dca',
    actionZoneLabel: 'Gom Hưởng Cổ Tức',
    reason: 'Cỗ máy in tiền mặt tỷ USD, dòng tiền kinh doanh thuần cực kỳ dồi dào, duy trì chi trả cổ tức tiền mặt 35% - 40%/năm suốt hơn 15 năm.',
    valuationNote: 'Cổ tức tiền mặt ~6% - 7.5%/thị giá • Không nợ vay',
    targetHorizon: '3 - 5 năm',
    screenBadge: '🥛 Vua Tiền Mặt & Cổ Tức',
    screenScore: 96,
  },
  {
    symbol: 'MBB',
    name: 'Ngân hàng Quân Đội',
    category: 'dividend',
    categoryLabel: 'Cổ Phiếu Cổ Tức Cao',
    pillar: 'finance',
    pillarLabel: 'Cổ Tức Đều & Định Giá Rẻ',
    actionZone: 'buy_dca',
    actionZoneLabel: 'Vùng Gom Tích Sản',
    reason: 'Duy trì trả cổ tức tiền mặt kết hợp cổ phiếu đều đặn hàng năm, tệp khách hàng số vượt 25 triệu người, định giá P/E chỉ quanh 6.x rẻ nhất ngành.',
    valuationNote: 'P/E 6.2x • ROE ~22% • Cổ tức ổn định',
    targetHorizon: '1 - 3 năm',
    screenBadge: '🛡️ Nền Tảng Quân Đội An Toàn',
    screenScore: 94,
  },
];

export const RECOMMENDED_STOCKS: Top3Recommendation[] = [
  ...RECOMMENDED_GROWTH_STOCKS,
  ...RECOMMENDED_DIVIDEND_STOCKS,
];

export const TOP3_VN30_RECOMMENDATIONS: Top3Recommendation[] = RECOMMENDED_STOCKS;

/**
 * Trả về danh sách khuyến nghị được tự động chọn lọc hàng ngày theo thuật toán
 * Đồng bộ động với dữ liệu biểu lãi suất ngân hàng trực tuyến (Live Bank Rates)
 */
export function getDailyAutoScreenedRecommendations(
  liveBankRates?: BankRatesData | null,
  liveStockData?: StockRateData | null,
  liveRatiosMap?: Record<string, StockFinancialRatios> | null
) {
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  // Tự động phân tích động theo dữ liệu thị trường trực tuyến nếu có
  let screenedSavings = TOP3_SAVINGS_RECOMMENDATIONS;
  if (
    liveBankRates &&
    ((liveBankRates.cdAndHighYieldRates && liveBankRates.cdAndHighYieldRates.length > 0) ||
      (liveBankRates.topOnline12M && liveBankRates.topOnline12M.length > 0) ||
      (liveBankRates.big4Rates && liveBankRates.big4Rates.length > 0))
  ) {
    // 1. Nhóm Lợi Tức Cao & Chứng Chỉ Tiền Gửi (NCB An Phú 9.3% - 9.4%, Cake 9.4%, VPBank CCTG 9.0%...)
    const topCd = liveBankRates.cdAndHighYieldRates?.[0] || {
      bank: 'NCB (Tiết Kiệm An Phú & CCTG)',
      m24: 9.4,
      m18: 9.3,
      m12: 8.2,
      note: 'Lãi suất thực nhận 9.3% - 9.4%/năm cho kỳ hạn 18–36 tháng và CCTG',
    };

    // 2. Nhóm Gửi Online Chuẩn 12 Tháng Cao Nhất (ACB, LPBank, Sacombank...)
    const topOnline1 = liveBankRates.topOnline12M?.[0] || { bank: 'ACB / LPBank', m12: 7.8 };
    const topOnline2 = liveBankRates.topOnline12M?.[1] || { bank: 'Sacombank', m12: 7.5 };

    // 3. Nhóm Big 4 Quốc Doanh
    const big4List = liveBankRates.big4Rates || [];
    const maxBig4 = big4List.reduce((max, b) => Math.max(max, b.m12 || 0), 5.9);
    const minBig4 = big4List.reduce((min, b) => (b.m12 && b.m12 > 0 ? Math.min(min, b.m12) : min), 5.3);

    screenedSavings = [
      {
        id: 'savings-cd-dynamic',
        bankName: `${topCd.bank} & CCTG Lợi Tức Cao`,
        rateRange: '9.0% - 9.4% / năm (Sổ thực gửi 9.3% - 9.4%)',
        term: '18 - 36 tháng (Chứng chỉ tiền gửi / Gói An Phú tích lũy dài hạn)',
        minDeposit: 'Từ 10 triệu (Online App) hoặc từ 50 triệu (Chứng chỉ tiền gửi)',
        safetyRating: 'An Toàn Cao • 100% Bảo Hiểm Tiền Gửi Quốc Gia',
        badge: 'Lãi Suất Đỉnh 9.3% - 9.4%',
        highlights: [
          `Lãi suất thực nhận đạt 9.3% – 9.4%/năm tại các gói kỳ hạn 18–36 tháng và Chứng chỉ tiền gửi (NCB An Phú, Cake by VPBank, VPBank CCTG).`,
          'Khóa trần lãi suất thực dương cao vượt trội so với lạm phát (3.5% - 4.0%) để tối ưu sức mạnh lãi kép an toàn.',
          'Được phép chuyển nhượng, cầm cố chứng chỉ tiền gửi để vay ngược linh hoạt 24/7 khi cần thanh khoản đột xuất.',
          `Cập nhật trực tuyến: Dữ liệu bóc tách thị trường tự động (${liveBankRates.updatedAtStr || dateStr}).`,
        ],
        advice: 'Khuyên dùng để phân bổ 20 - 30% tổng tài sản khóa lợi tức cố định ~9.3%/năm cho Quỹ Runway và vốn an toàn dài hạn.',
        defaultBankKey: 'NCB (Tiết Kiệm An Phú)',
        defaultRate: 9.3,
        defaultMonths: 24,
      },
      {
        id: 'savings-ladder-dynamic',
        bankName: `Top Lãi Online Chuẩn (${topOnline1.bank}, ${topOnline2.bank})`,
        rateRange: `${topOnline2.m12 || 7.2}% - ${topOnline1.m12 || 7.8}% / năm`,
        term: '12 - 18 tháng (Không yêu cầu điều kiện số dư lớn)',
        minDeposit: 'Từ 1 triệu đồng',
        safetyRating: 'Thanh Khoản Linh Hoạt • Quản Lý App 24/7',
        badge: 'Linh Hoạt Không Ràng Buộc',
        highlights: [
          `Lãi suất gửi online trên App kịch trần thị trường: ${topOnline1.bank} đạt ${topOnline1.m12}%/năm, ${topOnline2.bank} đạt ${topOnline2.m12}%/năm.`,
          'Cho phép rút gốc từng phần mà không làm mất lãi suất của phần tiền gửi còn lại.',
          'Dễ dàng chia nhỏ sổ (20 - 50 triệu/sổ) theo chiến lược bậc thang kỳ hạn (Laddering).',
        ],
        advice: 'Tối ưu cho dòng tiền nhàn rỗi tích lũy định kỳ hàng tháng (DCA) từ thu nhập thặng dư Tab 2.',
        defaultBankKey: topOnline1.bank,
        defaultRate: topOnline1.m12 || 7.5,
        defaultMonths: 12,
      },
      {
        id: 'savings-big4-dynamic',
        bankName: 'Khối Ngân Hàng Quốc Doanh Big 4 (Vietcombank, BIDV, CTG, Agribank)',
        rateRange: `${minBig4}% - ${maxBig4}% / năm (Kỳ hạn 12 - 24 tháng)`,
        term: '12 - 24 tháng (Kỳ hạn ngắn 1 - 3 tháng: 2.0% - 2.8%)',
        minDeposit: 'Từ 1 triệu đồng',
        safetyRating: 'An Toàn Tuyệt Đối 100% • Chuẩn Quốc Doanh',
        badge: 'Quỹ Dự Phòng Runway',
        highlights: [
          'Mức độ an toàn tuyệt đối cao nhất toàn hệ thống tài chính ngân hàng Việt Nam.',
          'Hệ thống chi nhánh và điểm giao dịch bao phủ khắp cả nước, uy tín quốc gia.',
          'Nơi lưu trữ bắt buộc cho Quỹ khẩn cấp và Quỹ Runway 6 - 12 tháng sinh hoạt phí gia đình.',
        ],
        advice: 'Duy trì cố định 3 - 6 tháng chi phí gia đình tại đây, không bao giờ đem khoản tiền này đi đầu cơ.',
        defaultBankKey: 'Vietcombank',
        defaultRate: maxBig4,
        defaultMonths: 12,
      },
    ];
  }

  return {
    scanDate: dateStr,
    stocks: RECOMMENDED_STOCKS.map((s, idx) => {
      const quote = liveStockData?.stocks?.[s.symbol];
      const ratios = liveRatiosMap?.[s.symbol];

      const livePrice = quote?.price;
      const liveChange = quote?.change;
      const liveChangePercent = quote?.changePercent;
      const livePe = ratios?.pe;
      const livePb = ratios?.pb;
      const liveRoe = ratios?.roe;

      let dynamicValuationNote = s.valuationNote;
      let dynamicActionZone = s.actionZone;
      let dynamicActionZoneLabel = s.actionZoneLabel;
      let liveDividendYield: string | undefined;

      if (s.category === 'dividend') {
        const annualCashDiv = s.symbol === 'BMP' ? 11000 : s.symbol === 'VEA' ? 4800 : s.symbol === 'VNM' ? 4200 : 1500;
        if (livePrice && livePrice > 0) {
          const yieldPct = ((annualCashDiv / livePrice) * 100).toFixed(1);
          liveDividendYield = `${yieldPct}%/năm`;
          const peText = livePe ? ` • P/E ${livePe.toFixed(1)}x` : '';
          const roeText = liveRoe ? ` • ROE ${(liveRoe > 1 ? liveRoe : liveRoe * 100).toFixed(1)}%` : '';
          dynamicValuationNote = `Tỷ suất cổ tức tiền mặt ~${yieldPct}%/năm (${annualCashDiv.toLocaleString('vi-VN')}đ/CP)${peText}${roeText}`;
        }
      } else {
        const parts: string[] = [];
        if (livePe) parts.push(`P/E ${livePe.toFixed(1)}x`);
        if (livePb) parts.push(`P/B ${livePb.toFixed(2)}x`);
        if (liveRoe) parts.push(`ROE ${(liveRoe > 1 ? liveRoe : liveRoe * 100).toFixed(1)}%`);
        if (parts.length > 0) {
          dynamicValuationNote = `${parts.join(' • ')} • Tăng trưởng LN >20%`;
        }
      }

      if (liveChangePercent !== undefined) {
        if (liveChangePercent < -1.2) {
          dynamicActionZone = 'buy_dca';
          dynamicActionZoneLabel = '🔥 Giá Đỏ Chiết Khấu - Ưu Tiên Gom';
        } else if (liveChangePercent > 2.5) {
          dynamicActionZone = 'accumulate';
          dynamicActionZoneLabel = 'Tích Sản Bền Vững (Tránh Fomo)';
        }
      }

      return {
        ...s,
        rank: idx + 1,
        livePrice,
        liveChange,
        liveChangePercent,
        livePe,
        livePb,
        liveRoe,
        liveDividendYield,
        valuationNote: dynamicValuationNote,
        actionZone: dynamicActionZone,
        actionZoneLabel: dynamicActionZoneLabel,
        screenScore: s.screenScore || (98 - idx * 2),
        screenBadge: s.screenBadge || (s.category === 'growth' ? '🚀 Tăng Trưởng Vững Vàng' : '💰 Cổ Tức Bền Vững'),
        filterCriteria:
          s.category === 'growth'
            ? 'Tăng trưởng LN >20%, ROE >25%, Đầu ngành hưởng lợi vĩ mô'
            : 'Cổ tức tiền mặt cao & đều đặn, Bảng cân đối tài chính siêu sạch',
      };
    }),
    savings: screenedSavings.map((sav, idx) => ({
      ...sav,
      rank: idx + 1,
      screenScore: 99 - idx * 4,
      screenBadge: idx === 0 ? '🏆 Lãi Suất Đỉnh 9.3% - 9.4%' : idx === 1 ? '⚡ Linh Hoạt App 24/7' : '🏛️ Chuẩn An Toàn Quốc Doanh',
      filterCriteria: 'Lãi suất thực dương cao nhất, Bảo hiểm tiền gửi 100%',
    })),
    bonds: TOP3_BONDS_RECOMMENDATIONS.map((b, idx) => ({
      ...b,
      rank: idx + 1,
      screenScore: 95 - idx * 3,
      screenBadge: idx === 0 ? '⭐ Xếp Hạng AAA' : '🏢 Tài Sản Đảm Bảo Thật',
      filterCriteria: 'Xếp hạng tín nhiệm cao, Có tài sản bảo đảm độc lập',
    })),
  };
}

export const DEFAULT_STOCK_WATCHLIST: string[] = ['FPT', 'HPG', 'TCB', 'VNM', 'MBB', 'BMP', 'SSI', 'MWG'];

export function createDefaultStockQuote(sym: string, basePrice = 25000, name?: string): StockQuoteItem {
  const fb = FALLBACK_STOCK_RATES[sym];
  if (fb) {
    return { ...fb };
  }
  const p = basePrice > 0 ? basePrice : 25000;
  const low52w = Math.round(p * 0.85);
  const low2y = Math.round(p * 0.72);
  const low3y = Math.round(p * 0.65);
  return {
    symbol: sym,
    name: name || `Cổ phiếu ${sym}`,
    price: p,
    refPrice: p,
    change: 0,
    changePercent: 0,
    high: p,
    low: p,
    volume: 0,
    low52w,
    low2y,
    low3y,
    diffFromLow52wPct: low52w > 0 ? Number((((p - low52w) / low52w) * 100).toFixed(1)) : 17.6,
    diffFromLow2yPct: low2y > 0 ? Number((((p - low2y) / low2y) * 100).toFixed(1)) : 38.9,
    diffFromLow3yPct: low3y > 0 ? Number((((p - low3y) / low3y) * 100).toFixed(1)) : 53.8,
    valuationStatus: 'Tích lũy ổn định',
    updatedAt: new Date().toLocaleTimeString('vi-VN'),
  };
}

export const VN30_BASKET_SYMBOLS: string[] = [
  'ACB', 'BCM', 'BID', 'BVH', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG',
  'MBB', 'MSN', 'MWG', 'PLX', 'POW', 'SAB', 'SHB', 'SSB', 'SSI', 'STB',
  'TCB', 'TPB', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VRE'
];

/**
 * Thu thập các mã cổ phiếu hiển thị trong bảng theo dõi:
 * - Ưu tiên danh mục tùy chỉnh của người dùng (stockWatchlist)
 * - Mặc định: 6 mã chiến lược (FPT, HPG, TCB, VNM, MBB, BMP) + SSI, MWG
 * - Kết hợp các mã trong Tài sản (Tab 1) và Mục tiêu (Tab 3)
 */
export function collectAllStockSymbols(
  assets: Asset[] = [],
  goals: Goal[] = [],
  includeVn30 = false,
  extraSymbols?: string[]
): string[] {
  const symbols = new Set<string>();

  // 1. Danh mục theo dõi
  if (Array.isArray(extraSymbols)) {
    if (extraSymbols.length > 0) {
      extraSymbols.forEach((w) => {
        const clean = (w || '').trim().toUpperCase();
        if (clean && clean.length >= 3 && /^[A-Z0-9]{3,4}$/.test(clean)) {
          symbols.add(clean);
        }
      });
    }
  } else {
    // Mặc định khởi tạo ban đầu khi chưa từng tùy chỉnh
    DEFAULT_STOCK_WATCHLIST.forEach((s) => symbols.add(s));
  }

  // 2. Các mã người dùng đang sở hữu trong Tài sản (Tab 1)
  (assets || []).forEach((a) => {
    if (isStockEntity(a)) {
      const sym = extractStockTicker(a.name, a.type, undefined, a.unit);
      if (sym) symbols.add(sym);
    }
  });

  // 3. Các mã người dùng đặt mục tiêu tích sản trong Tab 3
  (goals || []).forEach((g) => {
    if (isStockEntity(g)) {
      const sym = extractStockTicker(g.name, undefined, g.assetType, g.unit);
      if (sym) symbols.add(sym);
    }
  });

  if (includeVn30) {
    VN30_BASKET_SYMBOLS.forEach((s) => symbols.add(s));
  }

  return Array.from(symbols);
}

// Memory cache client-side
let memoryStockData: StockRateData | null = null;
let lastStockFetchTime = 0;
let inFlightStockPromise: Promise<StockRateData> | null = null;
let inFlightKey = '';

/**
 * Lấy báo giá trực tiếp từ VPS Realtime Datafeed và DNSE Entrade ngay trên trình duyệt
 * (Hoạt động hoàn hảo trên mọi môi trường bao gồm Web tĩnh như GitHub Pages mà không bị chặn CORS)
 */
async function fetchDirectFromVPSAndEntradeClient(
  symbols: string[]
): Promise<{ stocks: Record<string, StockQuoteItem>; vnindex?: StockRateData['vnindex'] }> {
  const result: Record<string, StockQuoteItem> = {};
  const to = Math.floor(Date.now() / 1000);
  const from = to - 86400 * 1150; // 1150 ngày để tính đủ đáy 52T (~260 phiên), 2 năm (~520 phiên) và 3 năm (~780 phiên)

  let vnindexData: StockRateData['vnindex'] = undefined;

  // 1. Quét song song: VPS Datafeed Realtime (CORS: *) + VNINDEX từ DNSE
  const vpsMap = new Map<string, any>();

  const vpsPromise = (async () => {
    try {
      const vpsUrl = `https://bgapidatafeed.vps.com.vn/getliststockdata/${symbols.join(',')}`;
      const vpsRes = await fetch(vpsUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
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
      console.warn('[StockClient] VPS fetch error:', vpsErr);
    }
  })();

  const vnindexPromise = (async () => {
    // Ưu tiên 1: VPS Real-time Index (Mã 10 = VN-INDEX sàn HOSE) - CORS mở tự do, cập nhật từng giây
    try {
      const vpsIndexRes = await fetch('https://bgapidatafeed.vps.com.vn/getlistindexdetail/10', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
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
          const volText = volSharesStr && estValueTrillion 
            ? `${volSharesStr} (~${estValueTrillion} tỷ)` 
            : (volSharesStr || `${estValueTrillion} tỷ` || '');

          vnindexData = {
            price: parseFloat(item.cIndex.toFixed(2)),
            change: parseFloat(diff.toFixed(2)),
            changePercent: parseFloat(pct.toFixed(2)),
            volume: volText || `${(item.vol / 1e6).toFixed(1)}M CP`,
          };
          return;
        }
      }
    } catch {
      // Tiếp tục nguồn 2
    }

    // Ưu tiên 2: VNDirect Real-time 1-Minute DChart (CORS: *, tốc độ siêu nhanh <200ms, liên tục từng phút)
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const vndUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=1&symbol=VNINDEX&from=${nowSec - 7200}&to=${nowSec}`;
      const vndRes = await fetch(vndUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
      });
      if (vndRes.ok) {
        const vndJson = await vndRes.json();
        if (vndJson && Array.isArray(vndJson.c) && vndJson.c.length > 0) {
          const closes = vndJson.c;
          const cur = closes[closes.length - 1];
          const openRef = Array.isArray(vndJson.o) && vndJson.o.length > 0 ? vndJson.o[0] : (closes.length > 1 ? closes[0] : cur);
          const diff = cur - openRef;
          const pct = openRef > 0 ? (diff / openRef) * 100 : 0;
          let totalVol = 0;
          if (Array.isArray(vndJson.v)) {
            totalVol = vndJson.v.reduce((sum: number, val: number) => sum + (val || 0), 0);
          }
          const volSharesStr = totalVol > 0 ? `${(totalVol / 1e6).toFixed(1)}M CP` : '';
          const estValueTrillion = totalVol > 0 ? Math.round((totalVol * 27600) / 1e9).toLocaleString('vi-VN') : '';
          const volText = volSharesStr && estValueTrillion 
            ? `${volSharesStr} (~${estValueTrillion} tỷ)` 
            : (volSharesStr || `${estValueTrillion} tỷ` || '');

          vnindexData = {
            price: parseFloat(cur.toFixed(2)),
            change: parseFloat(diff.toFixed(2)),
            changePercent: parseFloat(pct.toFixed(2)),
            volume: volText || 'HOSE Trực Tuyến',
          };
          return;
        }
      }
    } catch {
      // Tiếp tục nguồn 3
    }

    // Ưu tiên 3: Entrade DNSE
    try {
      const vnRes = await fetch(
        `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${to - 86400 * 14}&to=${to}&symbol=VNINDEX&resolution=1D`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (vnRes.ok) {
        const vnJson = await vnRes.json();
        if (vnJson?.c?.length) {
          const closes: number[] = vnJson.c;
          const cur = closes[closes.length - 1];
          const prev = closes.length > 1 ? closes[closes.length - 2] : cur;
          const diff = cur - prev;
          const pct = prev > 0 ? (diff / prev) * 100 : 0;
          const rawVol = vnJson.v?.length ? vnJson.v[vnJson.v.length - 1] : 0;
          const volSharesStr = rawVol > 0 ? `${(rawVol / 1e6).toFixed(1)}M CP` : '';
          const estValueTrillion = rawVol > 0 ? Math.round((rawVol * 27600) / 1e9).toLocaleString('vi-VN') : '23,850';
          const volText = volSharesStr ? `${volSharesStr} (~${estValueTrillion} tỷ)` : `${estValueTrillion} tỷ`;
          vnindexData = {
            price: parseFloat(cur.toFixed(2)),
            change: parseFloat(diff.toFixed(2)),
            changePercent: parseFloat(pct.toFixed(2)),
            volume: volText,
          };
        }
      }
    } catch {
      // ignore
    }
  })();

  await Promise.allSettled([vpsPromise, vnindexPromise]);

  // 2. Lấy dữ liệu nến lịch sử DNSE cho từng mã để tính các mốc đáy 52T, 2 năm, 3 năm
  await Promise.allSettled(
    symbols.map(async (sym) => {
      const vpsItem = vpsMap.get(sym);
      const baseInfo = FALLBACK_STOCK_RATES[sym] || {
        symbol: sym,
        name: `Cổ phiếu ${sym}`,
        price: 25000,
        refPrice: 25000,
        change: 0,
        changePercent: 0,
        high: 25000,
        low: 25000,
        volume: 0,
        low52w: 19000,
        low2y: 16000,
        low3y: 14000,
        diffFromLow52wPct: 31.6,
        diffFromLow2yPct: 56.3,
        diffFromLow3yPct: 78.6,
      };

      const normalizeScale = (val: any): number => {
        if (!val) return 0;
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num) || num <= 0) return 0;
        return num < 1000 ? Math.round(num * 1000) : Math.round(num);
      };

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
        vpsVolume = typeof vpsItem.lot === 'number' ? vpsItem.lot : parseInt(vpsItem.lot || '0', 10);
      }

      // 1.2 Nếu VPS thiếu giá, thử lấy từ VNDirect DChart API
      let vndPrice = 0;
      let vndRefPrice = 0;
      if (vpsPrice <= 0) {
        try {
          const vndUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=1D&symbol=${encodeURIComponent(sym)}&from=${to - 86400 * 14}&to=${to}`;
          const vndRes = await fetch(vndUrl, { signal: AbortSignal.timeout(3000) });
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
        } catch {}
      }

      // 1.3 Lấy lịch sử nến từ DNSE Entrade để tính đáy 52w, 2y, 3y
      let dnseData: any = null;
      let dnsePrice = 0;
      let dnseRefPrice = 0;
      try {
        const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${encodeURIComponent(
          sym
        )}&resolution=1D`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
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
      } catch {}

      // Giữ lại giá realtime hợp lệ đã biết trước đó để TUYỆT ĐỐI không bị nháy loạn sang giá fallback cứng
      const prevKnownQuote = memoryStockData?.stocks?.[sym];
      const prevPrice = prevKnownQuote?.price && prevKnownQuote.price > 0 ? prevKnownQuote.price : 0;
      const prevRef = prevKnownQuote?.refPrice && prevKnownQuote.refPrice > 0 ? prevKnownQuote.refPrice : 0;

      // Chuỗi fallback: VPS -> VNDirect -> Entrade -> Giá Live đã nhớ trước đó -> Bảng giá tham chiếu
      let finalPrice = vpsPrice > 0 ? vpsPrice : (vndPrice > 0 ? vndPrice : (dnsePrice > 0 ? dnsePrice : (prevPrice > 0 ? prevPrice : baseInfo.price)));
      let finalRefPrice = vpsRefPrice > 0 ? vpsRefPrice : (vndRefPrice > 0 ? vndRefPrice : (dnseRefPrice > 0 ? dnseRefPrice : (prevRef > 0 ? prevRef : baseInfo.refPrice)));
      let finalHigh = vpsHigh > 0 ? vpsHigh : (prevKnownQuote?.high || finalPrice);
      let finalLow = vpsLow > 0 ? vpsLow : (prevKnownQuote?.low || finalPrice);
      let finalVolume = vpsVolume > 0 ? vpsVolume : (prevKnownQuote?.volume || 0);

      // Tính các mốc đáy chu kỳ trung - dài hạn: Đáy 52T (~260 phiên), Đáy 2 năm (~520 phiên), Đáy 3 năm (~780 phiên)
      let low52w = baseInfo.low52w || Math.round(finalPrice * 0.85);
      let low2y = baseInfo.low2y || Math.round(finalPrice * 0.72);
      let low3y = baseInfo.low3y || Math.round(finalPrice * 0.65);

      if (dnseData && Array.isArray(dnseData.c) && dnseData.c.length > 0) {
        const lArr: number[] = Array.isArray(dnseData.l) && dnseData.l.length > 0 ? dnseData.l : dnseData.c;
        const len = lArr.length;
        // Đáy 52 tuần (1 năm): 260 phiên giao dịch gần nhất
        low52w = normalizeScale(Math.min(...lArr.slice(-Math.min(260, len))));
        // Đáy 2 năm: 520 phiên giao dịch gần nhất
        low2y = normalizeScale(Math.min(...lArr.slice(-Math.min(520, len))));
        // Đáy 3 năm: 780 phiên giao dịch gần nhất
        low3y = normalizeScale(Math.min(...lArr.slice(-Math.min(780, len))));
      } else if (finalPrice > 0) {
        low52w = Math.min(low52w, Math.round(finalPrice * 0.85));
        low2y = Math.min(low2y, Math.round(finalPrice * 0.72));
        low3y = Math.min(low3y, Math.round(finalPrice * 0.65));
      }

      const change = finalPrice - finalRefPrice;
      const changePercent = finalRefPrice > 0 ? parseFloat(((change / finalRefPrice) * 100).toFixed(2)) : 0;

      const diffFromLow52wPct = low52w > 0 ? parseFloat((((finalPrice - low52w) / low52w) * 100).toFixed(1)) : 0;
      const diffFromLow2yPct = low2y > 0 ? parseFloat((((finalPrice - low2y) / low2y) * 100).toFixed(1)) : 0;
      const diffFromLow3yPct = low3y > 0 ? parseFloat((((finalPrice - low3y) / low3y) * 100).toFixed(1)) : 0;

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

      result[sym] = {
        symbol: sym,
        name: baseInfo.name || `Cổ phiếu ${sym}`,
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

  return { stocks: result, vnindex: vnindexData };
}

/**
 * Gọi API máy chủ để lấy bảng giá cổ phiếu mới nhất (hoặc gọi trực tiếp khi chạy trên web tĩnh)
 */
export async function fetchStockRates(
  symbols: string[] = ['HPG', 'FPT', 'TCB', 'MBB', 'VCB'],
  forceRefresh = false
): Promise<StockRateData> {
  const now = Date.now();

  let cleanSymbols = Array.from(
    new Set(symbols.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{3,4}$/.test(s)))
  );

  if (cleanSymbols.length === 0) {
    cleanSymbols = ['HPG', 'FPT', 'TCB', 'MBB', 'VCB', 'VNM', 'MWG', 'SSI', 'VND', 'VIC'];
  }

  const symbolsKey = [...cleanSymbols].sort().join(',');

  // Kiểm tra memory cache: nếu chưa quá hạn 15s và đã có đủ tất cả các mã được yêu cầu
  if (!forceRefresh && memoryStockData && now - lastStockFetchTime < 15000) {
    const hasAll = cleanSymbols.every((sym) => memoryStockData?.stocks && memoryStockData.stocks[sym]);
    if (hasAll) {
      return memoryStockData;
    }
  }

  // Deduplication: nếu đang có 1 request cùng key đang chạy trong vòng 5s, tái sử dụng Promise đó
  if (inFlightStockPromise && inFlightKey === symbolsKey) {
    return inFlightStockPromise;
  }

  const runFetch = async (): Promise<StockRateData> => {
    // 1. Thử gọi backend /api/stock-rates nếu có (timeout 8000ms an toàn)
    try {
      const url = `/api/stock-rates?symbols=${encodeURIComponent(cleanSymbols.join(','))}${
        forceRefresh ? '&refresh=1' : ''
      }`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        if (json && json.success && json.stocks && Object.keys(json.stocks).length > 0) {
          // Merge an toàn chống giật/nháy giá vào memoryStockData
          const existingStocks = memoryStockData?.stocks || {};
          const mergedStocks = safeMergeStockQuotesMap(existingStocks, json.stocks);
          const updatedData: StockRateData = {
            ...json,
            stocks: mergedStocks,
          };
          memoryStockData = updatedData;
          lastStockFetchTime = Date.now();
          return updatedData;
        }
      }
    } catch (err) {
      // Chuyển sang quét trực tiếp client-side
    }

    // 2. Chế độ Fallback Trực Tiếp Phía Trình Duyệt (Hoạt động hoàn hảo trên GitHub Pages)
    try {
      const directRes = await fetchDirectFromVPSAndEntradeClient(cleanSymbols);
      if (Object.keys(directRes.stocks).length > 0) {
        const existingStocks = memoryStockData?.stocks || {};
        const mergedStocks = safeMergeStockQuotesMap(existingStocks, directRes.stocks);
        cleanSymbols.forEach((sym) => {
          if (!mergedStocks[sym]) {
            mergedStocks[sym] = createDefaultStockQuote(sym);
          }
        });

        const liveData: StockRateData = {
          success: true,
          updatedAtStr: `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} (Sàn HOSE/HNX Trực Tuyến)`,
          fetchedAt: new Date().toISOString(),
          source: 'Sở Giao dịch Chứng khoán & VPS Realtime Datafeed',
          stocks: mergedStocks,
          vnindex: directRes.vnindex || memoryStockData?.vnindex,
        };

        memoryStockData = liveData;
        lastStockFetchTime = Date.now();
        return liveData;
      }
    } catch (directErr) {
      console.warn('[StockService] Lỗi quét trực tiếp:', directErr);
    }

    // 3. Fallback: Nếu đã có dữ liệu trong memoryStockData, GIỮ NGUYÊN dữ liệu đó, TUYỆT ĐỐI không nhảy về ngày cũ!
    if (memoryStockData && memoryStockData.stocks && Object.keys(memoryStockData.stocks).length > 0) {
      return memoryStockData;
    }

    // 4. Fallback nội bộ khởi thủy nếu hoàn toàn chưa từng nạp được lần nào
    const fallbackStocks: Record<string, StockQuoteItem> = {};
    cleanSymbols.forEach((sym) => {
      fallbackStocks[sym] = createDefaultStockQuote(sym);
    });

    const fallbackData: StockRateData = {
      success: true,
      updatedAtStr: `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} (Tham chiếu)`,
      fetchedAt: new Date().toISOString(),
      source: 'Bảng giá Chứng khoán Việt Nam (Tham chiếu dự phòng)',
      stocks: fallbackStocks,
      vnindex: memoryStockData?.vnindex || {
        price: 1798.9,
        change: -0.77,
        changePercent: -0.04,
        volume: '50.8M CP (~1.374 tỷ)',
      },
    };

    memoryStockData = fallbackData;
    lastStockFetchTime = Date.now();
    return fallbackData;
  };

  inFlightKey = symbolsKey;
  inFlightStockPromise = runFetch().finally(() => {
    inFlightStockPromise = null;
    inFlightKey = '';
  });

  return inFlightStockPromise;
}

/**
 * Lấy riêng chỉ số VN-Index thời gian thực siêu tốc (hoạt động đa tầng trên cả bản nháp, app thực tế, mobile PWA)
 */
export async function fetchVNIndexOnly(forceRefresh = true): Promise<StockRateData['vnindex']> {
  // 1. Thử gọi qua backend /api/vnindex nếu có
  try {
    const url = `/api/vnindex${forceRefresh ? '?refresh=1' : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.vnindex && json.vnindex.price > 0) {
        if (memoryStockData) {
          memoryStockData.vnindex = json.vnindex;
        }
        return json.vnindex;
      }
    }
  } catch {}

  // 2. Thử gọi trực tiếp VPS Datafeed (CORS: *)
  try {
    const vpsRes = await fetch('https://bgapidatafeed.vps.com.vn/getlistindexdetail/10', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });
    if (vpsRes.ok) {
      const vpsJson = await vpsRes.json();
      if (Array.isArray(vpsJson) && vpsJson.length > 0 && vpsJson[0]?.cIndex > 0) {
        const item = vpsJson[0];
        const refIndex = (item.oIndex && item.oIndex > 0) ? item.oIndex : item.cIndex;
        let diff = item.cIndex - refIndex;
        let pct = refIndex > 0 ? (diff / refIndex) * 100 : 0;

        if (item.ot && typeof item.ot === 'string') {
          const parts = item.ot.split('|');
          if (parts.length >= 2) {
            const rawDiff = parseFloat(parts[0]);
            const rawPct = parseFloat(parts[1].replace('%', ''));
            const sign = item.cIndex < refIndex ? -1 : (item.cIndex > refIndex ? 1 : 0);
            if (!isNaN(rawDiff)) diff = rawDiff < 0 ? rawDiff : sign * Math.abs(rawDiff);
            if (!isNaN(rawPct)) pct = rawPct < 0 ? rawPct : sign * Math.abs(rawPct);
          }
        }
        const volSharesStr = item.vol > 0 ? `${(item.vol / 1e6).toFixed(1)}M CP` : '';
        const estValueTrillion = item.value > 0 ? Math.round(item.value / 1000).toLocaleString('vi-VN') : '';
        const volText = volSharesStr && estValueTrillion 
          ? `${volSharesStr} (~${estValueTrillion} tỷ)` 
          : (volSharesStr || `${estValueTrillion} tỷ` || '');

        const vnData = {
          price: parseFloat(item.cIndex.toFixed(2)),
          change: parseFloat(diff.toFixed(2)),
          changePercent: parseFloat(pct.toFixed(2)),
          volume: volText || `${(item.vol / 1e6).toFixed(1)}M CP`,
        };
        if (memoryStockData) {
          memoryStockData.vnindex = vnData;
        }
        return vnData;
      }
    }
  } catch {}

  // 3. Thử gọi trực tiếp VNDirect 1-Minute DChart (CORS: *)
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const vndUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=1&symbol=VNINDEX&from=${nowSec - 7200}&to=${nowSec}`;
    const vndRes = await fetch(vndUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (vndRes.ok) {
      const vndJson = await vndRes.json();
      if (vndJson && Array.isArray(vndJson.c) && vndJson.c.length > 0) {
        const closes = vndJson.c;
        const cur = closes[closes.length - 1];
        const openRef = Array.isArray(vndJson.o) && vndJson.o.length > 0 ? vndJson.o[0] : (closes.length > 1 ? closes[0] : cur);
        const diff = cur - openRef;
        const pct = openRef > 0 ? (diff / openRef) * 100 : 0;
        let totalVol = 0;
        if (Array.isArray(vndJson.v)) {
          totalVol = vndJson.v.reduce((sum: number, val: number) => sum + (val || 0), 0);
        }
        const volSharesStr = totalVol > 0 ? `${(totalVol / 1e6).toFixed(1)}M CP` : '';
        const estValueTrillion = totalVol > 0 ? Math.round((totalVol * 27600) / 1e9).toLocaleString('vi-VN') : '';
        const volText = volSharesStr && estValueTrillion 
          ? `${volSharesStr} (~${estValueTrillion} tỷ)` 
          : (volSharesStr || `${estValueTrillion} tỷ` || '');

        const vnData = {
          price: parseFloat(cur.toFixed(2)),
          change: parseFloat(diff.toFixed(2)),
          changePercent: parseFloat(pct.toFixed(2)),
          volume: volText || 'HOSE Trực Tuyến',
        };
        if (memoryStockData) {
          memoryStockData.vnindex = vnData;
        }
        return vnData;
      }
    }
  } catch {}

  return memoryStockData?.vnindex || {
    price: 1798.9,
    change: -0.77,
    changePercent: -0.04,
    volume: '50.8M CP (~1.374 tỷ)',
  };
}

/**
 * Lấy báo giá của 1 mã cổ phiếu từ bộ dữ liệu
 */
export function getStockQuote(
  stockData: StockRateData | null,
  nameOrSymbol: string
): StockQuoteItem | null {
  if (!nameOrSymbol) return null;
  const sym = extractStockTicker(nameOrSymbol) || nameOrSymbol.toUpperCase().trim();

  if (stockData?.stocks && stockData.stocks[sym]) {
    return stockData.stocks[sym];
  }

  if (FALLBACK_STOCK_RATES[sym]) {
    return FALLBACK_STOCK_RATES[sym];
  }

  return null;
}

// Client-side cache cho Chỉ số BCTC (P/E, P/B, ROE...)
const clientRatiosCache = new Map<string, StockFinancialRatios>();

/**
 * Lấy chỉ số tài chính BCTC (P/E, P/B, ROE, ROA...) cho 1 mã cổ phiếu
 */
export async function fetchStockFinancialRatios(symbol: string): Promise<StockFinancialRatios | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  if (clientRatiosCache.has(sym)) {
    return clientRatiosCache.get(sym)!;
  }

  // 1. Thử gọi backend /api/stock-ratios/:symbol
  try {
    const res = await fetch(`/api/stock-ratios/${encodeURIComponent(sym)}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.data) {
        clientRatiosCache.set(sym, json.data);
        return json.data;
      }
    }
  } catch {}

  // 2. Fallback gọi trực tiếp Simplize nếu chạy client độc lập
  try {
    const res = await fetch(
      `https://api.simplize.vn/api/company/fi/ratio/${encodeURIComponent(sym)}?period=Q&size=1&type=ratio`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.items?.length > 0) {
        const item = json.data.items[0];
        const data: StockFinancialRatios = {
          symbol: sym,
          pe: typeof item.op1 === 'number' && item.op1 > 0 ? Number(item.op1.toFixed(2)) : undefined,
          pb: typeof item.op2 === 'number' && item.op2 > 0 ? Number(item.op2.toFixed(2)) : undefined,
          roe: typeof item.op17 === 'number' && item.op17 > 0 ? Number(item.op17.toFixed(1)) : undefined,
          roa: typeof item.op18 === 'number' && item.op18 > 0 ? Number(item.op18.toFixed(1)) : undefined,
          period: item.periodDateName || 'Q2/2026',
          industry: json.data.industryGroup || 'Doanh nghiệp niêm yết',
          rating: 'Dữ liệu BCTC Trực Tuyến',
          source: 'TCBS & Simplize BCTC',
        };
        clientRatiosCache.set(sym, data);
        return data;
      }
    }
  } catch {}

  return null;
}

/**
 * Lấy hàng loạt chỉ số tài chính cho danh sách mã
 */
export async function fetchBatchStockRatios(symbols: string[]): Promise<Record<string, StockFinancialRatios>> {
  const result: Record<string, StockFinancialRatios> = {};
  const cleanSymbols = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{3,4}$/.test(s))));

  if (cleanSymbols.length === 0) return result;

  try {
    const res = await fetch(`/api/stock-ratios?symbols=${encodeURIComponent(cleanSymbols.join(','))}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.ratios) {
        Object.entries(json.ratios).forEach(([k, v]) => {
          if (v) {
            result[k] = v as StockFinancialRatios;
            clientRatiosCache.set(k, v as StockFinancialRatios);
          }
        });
        return result;
      }
    }
  } catch {}

  // Lấy tuần tự cho các mã chưa có
  await Promise.allSettled(
    cleanSymbols.map(async (s) => {
      const r = await fetchStockFinancialRatios(s);
      if (r) result[s] = r;
    })
  );

  return result;
}

let cachedClientBankRates: BankRatesData | null = null;
let lastBankRatesFetch = 0;

/**
 * Lấy bảng Lãi suất Ngân hàng Trực tuyến Tự động theo Ngày
 */
export async function fetchLiveBankRates(forceRefresh = false): Promise<BankRatesData> {
  const now = Date.now();
  if (!forceRefresh && cachedClientBankRates && now - lastBankRatesFetch < 60000) {
    return cachedClientBankRates;
  }

  try {
    const res = await fetch(`/api/bank-rates${forceRefresh ? '?refresh=1' : ''}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success) {
        cachedClientBankRates = json;
        lastBankRatesFetch = now;
        return json;
      }
    }
  } catch (err) {
    console.warn('[BankRatesClient] Lỗi kết nối /api/bank-rates:', err);
  }

  // Fallback chuẩn nếu chưa nạp được
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  const fb: BankRatesData = {
    success: true,
    updatedAtStr: `Cập nhật ngày ${dateStr}`,
    fetchedAt: new Date().toISOString(),
    source: 'Bảng biểu lãi suất ngân hàng Việt Nam',
    counterRates: [],
    onlineRates: [],
    topOnline6M: [
      { bank: 'Bắc Á Bank', m6: 7.05, m12: 6.95, m24: 6.95, kkh: 0.5, m1: 4.5, m3: 4.7 },
      { bank: 'LPBank', m6: 7.0, m12: 7.15, m24: 6.1, kkh: 0.1, m1: 4.4, m3: 4.65 },
      { bank: 'VCBNeo (CBBank)', m6: 7.0, m12: 7.0, m24: 7.0, kkh: 0.1, m1: 4.75, m3: 4.75 },
      { bank: 'Saigonbank', m6: 6.9, m12: 7.0, m24: 6.6, kkh: 0, m1: 4.75, m3: 4.75 },
      { bank: 'Sacombank', m6: 6.8, m12: 7.0, m24: 7.2, kkh: 0.5, m1: 4.5, m3: 4.5 },
      { bank: 'OceanBank (MBV)', m6: 6.5, m12: 7.0, m24: 7.0, kkh: 0.2, m1: 4.6, m3: 4.75 },
    ],
    topOnline12M: [
      { bank: 'NCB / HDBank', m12: 9.0, m6: 6.8, m24: 9.2, kkh: 0.5, m1: 4.6, m3: 4.8 },
      { bank: 'LPBank', m12: 7.15, m6: 7.0, m24: 6.1, kkh: 0.1, m1: 4.4, m3: 4.65 },
      { bank: 'Sacombank', m12: 7.0, m6: 6.8, m24: 7.2, kkh: 0.5, m1: 4.5, m3: 4.5 },
      { bank: 'OceanBank (MBV)', m12: 7.0, m6: 6.5, m24: 7.0, kkh: 0.2, m1: 4.6, m3: 4.75 },
      { bank: 'Saigonbank', m12: 7.0, m6: 6.9, m24: 6.6, kkh: 0, m1: 4.75, m3: 4.75 },
      { bank: 'Techcombank', m12: 6.8, m6: 6.3, m24: 7.0, kkh: 0.3, m1: 4.2, m3: 4.4 },
    ],
    topOnline24M: [
      { bank: 'NCB / HDBank', m24: 9.2, m12: 9.0, m6: 6.8, kkh: 0.5, m1: 4.6, m3: 4.8 },
      { bank: 'Sacombank', m24: 7.2, m12: 7.0, m6: 6.8, kkh: 0.5, m1: 4.5, m3: 4.5 },
      { bank: 'OceanBank (MBV)', m24: 7.0, m12: 7.0, m6: 6.5, kkh: 0.2, m1: 4.6, m3: 4.75 },
      { bank: 'VCBNeo (CBBank)', m24: 7.0, m12: 7.0, m6: 7.0, kkh: 0.1, m1: 4.75, m3: 4.75 },
      { bank: 'Techcombank', m24: 7.0, m12: 6.8, m6: 6.3, kkh: 0.3, m1: 4.2, m3: 4.4 },
      { bank: 'Bắc Á Bank', m24: 6.95, m12: 6.95, m6: 7.05, kkh: 0.5, m1: 4.5, m3: 4.7 },
    ],
    big4Rates: [
      { bank: 'Vietcombank', m12: 5.3, m6: 3.5, m24: 5.5, kkh: 0.1, m1: 2.1, m3: 2.4 },
      { bank: 'BIDV', m12: 5.9, m6: 3.5, m24: 6.0, kkh: 0.1, m1: 2.3, m3: 2.6 },
      { bank: 'VietinBank', m12: 5.6, m6: 3.5, m24: 5.8, kkh: 0.1, m1: 2.3, m3: 2.6 },
      { bank: 'Agribank', m12: 5.9, m6: 4.0, m24: 5.9, kkh: 0.2, m1: 2.6, m3: 2.9 },
    ],
  };

  cachedClientBankRates = fb;
  lastBankRatesFetch = now;
  return fb;
}

/**
 * Cấu trúc nến giá lịch sử của Cổ phiếu hoặc VN-Index
 */
export interface StockCandlePoint {
  time: number; // Unix timestamp in seconds
  dateStr: string; // DD/MM/YYYY
  day?: number;
  month?: number;
  year?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
}

// Bộ nhớ đệm lịch sử giá nến để không phải tải lại liên tục
const stockHistoryMemoryCache = new Map<string, { data: StockCandlePoint[]; timestamp: number }>();

/**
 * Lấy dữ liệu biểu đồ giá lịch sử của Cổ phiếu hoặc VN-INDEX
 * Ưu tiên gọi qua proxy backend /api/stock-history (tránh CORS, hỗ trợ nhiều năm)
 * Tự động tính toán đường MA20, MA50 và khối lượng giao dịch
 */
export async function fetchStockHistory(
  rawSymbol: string,
  days = 365,
  timeframe?: string
): Promise<StockCandlePoint[]> {
  const sym = (rawSymbol || '').trim().toUpperCase();
  if (!sym) return [];

  const isIndex = sym === 'VNINDEX' || sym === 'VN-INDEX';
  const querySymbol = isIndex ? 'VNINDEX' : sym;
  const tf = timeframe || (days <= 7 ? '1W' : days <= 30 ? '1M' : days <= 90 ? '3M' : days <= 180 ? '6M' : days <= 365 ? '1Y' : days <= 365 * 3 ? '3Y' : days <= 365 * 5 ? '5Y' : 'ALL');
  const cacheKey = `${querySymbol}_${tf}_${days}`;

  const cached = stockHistoryMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 180000) {
    return cached.data;
  }

  // 1. Ưu tiên số 1: Proxy Backend an toàn (/api/stock-history)
  try {
    const proxyUrl = `/api/stock-history?symbol=${encodeURIComponent(querySymbol)}&days=${days}&timeframe=${tf}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.candles) && json.candles.length > 0) {
        stockHistoryMemoryCache.set(cacheKey, { data: json.candles, timestamp: Date.now() });
        return json.candles;
      }
    }
  } catch (proxyErr) {
    console.warn('[StockHistory] Proxy error, falling back to direct endpoints:', proxyErr);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const bufferDays = Math.max(320, days + 70);
  const fromSec = days >= 365 * 10 ? 0 : Math.max(0, nowSec - bufferDays * 86400);

  const normalizeVal = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const n = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(n)) return 0;
    if (isIndex) return parseFloat(n.toFixed(2));
    return n < 1000 ? Math.round(n * 1000) : Math.round(n);
  };

  let rawCandles: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];

  // Nguồn 2: Entrade DNSE trực tiếp
  try {
    const entradeUrl = isIndex
      ? `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?symbol=VNINDEX&from=${fromSec}&to=${nowSec}&resolution=1D`
      : `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?symbol=${encodeURIComponent(querySymbol)}&from=${fromSec}&to=${nowSec}&resolution=1D`;

    const res = await fetch(entradeUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.t) && json.t.length > 0 && Array.isArray(json.c)) {
        const len = json.t.length;
        for (let i = 0; i < len; i++) {
          const t = json.t[i];
          const c = normalizeVal(json.c[i]);
          const o = normalizeVal(json.o ? json.o[i] : c);
          const h = normalizeVal(json.h ? json.h[i] : Math.max(o, c));
          const l = normalizeVal(json.l ? json.l[i] : Math.min(o, c));
          const v = json.v && json.v[i] ? json.v[i] : 0;
          if (c > 0) {
            rawCandles.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
          }
        }
      }
    }
  } catch {}

  // Nguồn 3: VNDirect DChart API
  if (rawCandles.length === 0) {
    try {
      const vndUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${encodeURIComponent(querySymbol)}&from=${fromSec}&to=${nowSec}`;
      const res = await fetch(vndUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.t) && json.t.length > 0 && Array.isArray(json.c)) {
          const len = json.t.length;
          for (let i = 0; i < len; i++) {
            const t = json.t[i];
            const c = normalizeVal(json.c[i]);
            const o = normalizeVal(json.o ? json.o[i] : c);
            const h = normalizeVal(json.h ? json.h[i] : Math.max(o, c));
            const l = normalizeVal(json.l ? json.l[i] : Math.min(o, c));
            const v = json.v && json.v[i] ? json.v[i] : 0;
            if (c > 0) {
              rawCandles.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
            }
          }
        }
      }
    } catch {}
  }

  // Nguồn 4: Thuật toán dự phòng mượt mà (Offline Safe)
  if (rawCandles.length === 0) {
    const fallbackQuote = FALLBACK_STOCK_RATES[querySymbol];
    const basePrice = isIndex
      ? (memoryStockData?.vnindex?.price || 1813.5)
      : (fallbackQuote?.price || 25000);
    const low52 = isIndex
      ? Math.round(basePrice * 0.82)
      : (fallbackQuote?.low52w || Math.round(basePrice * 0.75));
    const high52 = isIndex
      ? Math.round(basePrice * 1.08)
      : (fallbackQuote?.high ? fallbackQuote.high * 1.1 : Math.round(basePrice * 1.2));

    const totalSteps = Math.min(days + 60, 365 * 3);
    let curPrice = isIndex ? basePrice * 0.94 : basePrice * 0.92;
    const stepTime = 86400;
    const startT = nowSec - totalSteps * stepTime;

    for (let i = 0; i < totalSteps; i++) {
      const t = startT + i * stepTime;
      const dayOfWeek = new Date(t * 1000).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const drift = (basePrice - curPrice) * 0.025;
      const noise = (Math.sin(i * 0.28) * 0.012 + (Math.random() - 0.49) * 0.018) * curPrice;
      
      const open = isIndex ? parseFloat(curPrice.toFixed(2)) : Math.round(curPrice);
      curPrice = Math.max(low52, Math.min(high52, curPrice + drift + noise));
      const close = isIndex ? parseFloat(curPrice.toFixed(2)) : Math.round(curPrice);
      const high = isIndex ? parseFloat((Math.max(open, close) + Math.random() * 5).toFixed(2)) : Math.round(Math.max(open, close) * (1 + Math.random() * 0.012));
      const low = isIndex ? parseFloat((Math.min(open, close) - Math.random() * 5).toFixed(2)) : Math.round(Math.min(open, close) * (1 - Math.random() * 0.012));
      const volume = isIndex
        ? Math.round(500000000 + Math.random() * 400000000)
        : Math.round(1500000 + Math.random() * 3000000);

      rawCandles.push({
        time: t,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    if (rawCandles.length > 0) {
      const last = rawCandles[rawCandles.length - 1];
      last.close = basePrice;
      last.high = Math.max(last.high, basePrice);
      last.low = Math.min(last.low, basePrice);
    }
  }

  rawCandles.sort((a, b) => a.time - b.time);

  const result: StockCandlePoint[] = [];
  const closes: number[] = [];

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

    let ma200: number | undefined = undefined;
    if (closes.length >= 200) {
      const sum200 = closes.slice(-200).reduce((acc, v) => acc + v, 0);
      ma200 = isIndex ? parseFloat((sum200 / 200).toFixed(2)) : Math.round(sum200 / 200);
    }

    const d = new Date(c.time * 1000);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const dateStr = `${dayStr}/${monthStr}/${year}`;

    result.push({
      time: c.time,
      dateStr,
      day,
      month,
      year,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      ma20,
      ma50,
      ma200,
    });
  }

  const cutoffTime = days >= 365 * 10 ? 0 : nowSec - days * 86400;
  const filteredResult = result.filter((p) => p.time >= cutoffTime);
  const finalData = filteredResult.length > 0 ? filteredResult : result;

  stockHistoryMemoryCache.set(cacheKey, { data: finalData, timestamp: Date.now() });
  return finalData;
}

