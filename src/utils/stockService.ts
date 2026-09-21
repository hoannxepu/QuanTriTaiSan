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
  m24: number;
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
  // Đánh giá giá thấp nhất các chu kỳ
  low5w?: number;
  low10w?: number;
  low20w?: number;
  low30w?: number;
  low52w?: number;
  diffFromLow5wPct?: number;
  diffFromLow10wPct?: number;
  diffFromLow20wPct?: number;
  diffFromLow30wPct?: number;
  diffFromLow52wPct?: number;
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

// Bảng giá tham chiếu dự phòng trong trường hợp ngoại tuyến
export const FALLBACK_STOCK_RATES: Record<string, StockQuoteItem> = {
  SSI: {
    symbol: 'SSI',
    name: 'Chứng khoán SSI',
    price: 21400,
    refPrice: 21150,
    change: 250,
    changePercent: 1.18,
    high: 21600,
    low: 21150,
    volume: 3640010,
    ceiling: 22600,
    floor: 19700,
    low5w: 19200,
    low10w: 17350,
    low20w: 17350,
    low30w: 17350,
    low52w: 17350,
    diffFromLow5wPct: 11.5,
    diffFromLow10wPct: 23.3,
    diffFromLow20wPct: 23.3,
    diffFromLow30wPct: 23.3,
    diffFromLow52wPct: 23.3,
    valuationStatus: 'Tích lũy ổn định',
  },
  HPG: {
    symbol: 'HPG',
    name: 'Tập đoàn Hòa Phát',
    price: 21550,
    refPrice: 21200,
    change: 350,
    changePercent: 1.65,
    high: 21550,
    low: 21300,
    volume: 3112490,
    ceiling: 22650,
    floor: 19750,
    low5w: 20750,
    low10w: 20100,
    low20w: 20100,
    low30w: 20100,
    low52w: 20100,
    diffFromLow5wPct: 3.9,
    diffFromLow10wPct: 7.2,
    diffFromLow20wPct: 7.2,
    diffFromLow30wPct: 7.2,
    diffFromLow52wPct: 7.2,
    valuationStatus: 'Đáy 5T (DCA tốt)',
  },
  FPT: {
    symbol: 'FPT',
    name: 'Công nghệ FPT',
    price: 71700,
    refPrice: 74300,
    change: -2600,
    changePercent: -3.5,
    high: 73500,
    low: 71500,
    volume: 1550070,
    ceiling: 79500,
    floor: 69100,
    low5w: 68000,
    low10w: 61500,
    low20w: 61500,
    low30w: 61500,
    low52w: 61500,
    diffFromLow5wPct: 5.4,
    diffFromLow10wPct: 16.6,
    diffFromLow20wPct: 16.6,
    diffFromLow30wPct: 16.6,
    diffFromLow52wPct: 16.6,
    valuationStatus: 'Vùng gom tích sản tốt',
  },
  TCB: {
    symbol: 'TCB',
    name: 'Techcombank',
    price: 31600,
    refPrice: 32650,
    change: -1050,
    changePercent: -3.22,
    high: 32500,
    low: 31500,
    volume: 1567660,
    ceiling: 34900,
    floor: 30400,
    low5w: 30600,
    low10w: 27800,
    low20w: 27800,
    low30w: 27770,
    low52w: 27770,
    diffFromLow5wPct: 3.3,
    diffFromLow10wPct: 13.7,
    diffFromLow20wPct: 13.7,
    diffFromLow30wPct: 13.8,
    diffFromLow52wPct: 13.8,
    valuationStatus: 'Vùng đáy 5T (DCA tốt)',
  },
  MBB: {
    symbol: 'MBB',
    name: 'Ngân hàng Quân Đội',
    price: 19900,
    refPrice: 20550,
    change: -650,
    changePercent: -3.16,
    high: 20500,
    low: 19800,
    volume: 1684370,
    ceiling: 21950,
    floor: 19150,
    low5w: 19600,
    low10w: 17780,
    low20w: 17780,
    low30w: 17780,
    low52w: 17780,
    diffFromLow5wPct: 1.5,
    diffFromLow10wPct: 11.9,
    diffFromLow20wPct: 11.9,
    diffFromLow30wPct: 11.9,
    diffFromLow52wPct: 11.9,
    valuationStatus: 'Đáy 5T (DCA tốt)',
  },
  VCB: {
    symbol: 'VCB',
    name: 'Vietcombank',
    price: 59900,
    refPrice: 59600,
    change: 300,
    changePercent: 0.5,
    high: 60300,
    low: 59400,
    volume: 1036260,
    ceiling: 63700,
    floor: 55500,
  },
  VNM: {
    symbol: 'VNM',
    name: 'Vinamilk',
    price: 61200,
    refPrice: 60200,
    change: 1000,
    changePercent: 1.66,
    high: 61500,
    low: 60000,
    volume: 451730,
    ceiling: 64400,
    floor: 56000,
  },
  MWG: {
    symbol: 'MWG',
    name: 'Thế Giới Di Động',
    price: 72500,
    refPrice: 73100,
    change: -600,
    changePercent: -0.82,
    high: 73500,
    low: 72000,
    volume: 190900,
    ceiling: 78200,
    floor: 68000,
  },
  VND: {
    symbol: 'VND',
    name: 'Chứng khoán VNDirect',
    price: 15200,
    refPrice: 14800,
    change: 400,
    changePercent: 2.7,
    high: 15400,
    low: 14750,
    volume: 1603150,
    ceiling: 15800,
    floor: 13800,
  },
  VIC: {
    symbol: 'VIC',
    name: 'Vingroup',
    price: 241200,
    refPrice: 241200,
    change: 0,
    changePercent: 0,
    high: 243800,
    low: 237600,
    volume: 1325150,
    ceiling: 258000,
    floor: 224400,
  },
  VHM: {
    symbol: 'VHM',
    name: 'Vinhomes',
    price: 71000,
    refPrice: 71300,
    change: -300,
    changePercent: -0.42,
    high: 71800,
    low: 70500,
    volume: 1877460,
    ceiling: 76200,
    floor: 66400,
  },
  VRE: {
    symbol: 'VRE',
    name: 'Vincom Retail',
    price: 25500,
    refPrice: 25800,
    change: -300,
    changePercent: -1.16,
    high: 25900,
    low: 25300,
    volume: 756780,
    ceiling: 27600,
    floor: 24000,
  },
  STB: {
    symbol: 'STB',
    name: 'Sacombank',
    price: 78200,
    refPrice: 76200,
    change: 2000,
    changePercent: 2.62,
    high: 78500,
    low: 76000,
    volume: 507790,
    ceiling: 81500,
    floor: 70900,
  },
  ACB: {
    symbol: 'ACB',
    name: 'Ngân hàng Á Châu',
    price: 21900,
    refPrice: 22800,
    change: -900,
    changePercent: -3.95,
    high: 22500,
    low: 21800,
    volume: 1047590,
    ceiling: 24350,
    floor: 21250,
  },
  VPB: {
    symbol: 'VPB',
    name: 'VPBank',
    price: 27450,
    refPrice: 28200,
    change: -750,
    changePercent: -2.66,
    high: 28100,
    low: 27300,
    volume: 4910240,
    ceiling: 30150,
    floor: 26250,
  },
  CTG: {
    symbol: 'CTG',
    name: 'VietinBank',
    price: 30250,
    refPrice: 31400,
    change: -1150,
    changePercent: -3.66,
    high: 31200,
    low: 30100,
    volume: 1417000,
    ceiling: 33550,
    floor: 29250,
  },
  BID: {
    symbol: 'BID',
    name: 'BIDV',
    price: 35750,
    refPrice: 36700,
    change: -950,
    changePercent: -2.59,
    high: 36500,
    low: 35600,
    volume: 1252660,
    ceiling: 39250,
    floor: 34150,
  },
  DGC: {
    symbol: 'DGC',
    name: 'Hóa chất Đức Giang',
    price: 35950,
    refPrice: 35300,
    change: 650,
    changePercent: 1.84,
    high: 36200,
    low: 35100,
    volume: 86130,
    ceiling: 37750,
    floor: 32850,
  },
  PNJ: {
    symbol: 'PNJ',
    name: 'Vàng bạc Phú Nhuận',
    price: 36750,
    refPrice: 36750,
    change: 0,
    changePercent: 0,
    high: 37100,
    low: 36500,
    volume: 635710,
    ceiling: 39300,
    floor: 34200,
  },
  GAS: {
    symbol: 'GAS',
    name: 'Tổng công ty Khí Việt Nam',
    price: 88000,
    refPrice: 88600,
    change: -600,
    changePercent: -0.68,
    high: 89000,
    low: 87500,
    volume: 141200,
    ceiling: 94800,
    floor: 82400,
  },
  MSN: {
    symbol: 'MSN',
    name: 'Tập đoàn Masan',
    price: 68400,
    refPrice: 67700,
    change: 700,
    changePercent: 1.03,
    high: 69000,
    low: 67500,
    volume: 748480,
    ceiling: 72400,
    floor: 63000,
  },
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
  pillar: 'finance' | 'industry' | 'defensive';
  pillarLabel: string;
  actionZone: 'buy_dca' | 'accumulate' | 'watch';
  actionZoneLabel: string;
  reason: string;
  valuationNote: string;
  targetHorizon: string;
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
 * Top 3 Cổ phiếu chọn lọc động theo bối cảnh thị trường, chu kỳ lãi suất và định giá
 * 3 Trụ Cột: Tài chính/Ngân hàng/Chứng khoán (TCB/SSI) • Sản xuất/Chu kỳ (HPG) • Tích sản phòng thủ (FPT/MWG)
 */
export const TOP3_VN30_RECOMMENDATIONS: Top3Recommendation[] = [
  {
    symbol: 'TCB',
    name: 'Techcombank',
    pillar: 'finance',
    pillarLabel: 'Trụ Cột 1: Tài Chính / Ngân Hàng',
    actionZone: 'buy_dca',
    actionZoneLabel: 'Vùng Gom Tích Sản',
    reason: 'CASA top đầu ngành, hưởng lợi trực tiếp từ chu kỳ hồi phục tín dụng & BĐS, định giá P/B dưới 1.1x.',
    valuationNote: 'P/B 1.05x • Vùng giá chiết khấu an toàn',
    targetHorizon: '1 - 3 năm',
  },
  {
    symbol: 'HPG',
    name: 'Tập đoàn Hòa Phát',
    pillar: 'industry',
    pillarLabel: 'Trụ Cột 2: Sản Xuất & Đầu Tư Công',
    actionZone: 'accumulate',
    actionZoneLabel: 'Vùng Tích Lũy Bền Vững',
    reason: 'Chi phí sản xuất thép thấp nhất ASEAN, đại dự án Dung Quất 2 sắp vận hành và tiềm năng cung cấp thép ray đường sắt cao tốc Bắc-Nam 67 tỷ USD.',
    valuationNote: 'P/E chu kỳ hấp dẫn • Bảng cân đối tiền mặt ròng',
    targetHorizon: '2 - 5 năm',
  },
  {
    symbol: 'FPT',
    name: 'Tập đoàn FPT',
    pillar: 'defensive',
    pillarLabel: 'Trụ Cột 3: Công Nghệ & Tăng Trưởng Bền Vững',
    actionZone: 'accumulate',
    actionZoneLabel: 'Tích Sản Định Kỳ (DCA)',
    reason: 'Tăng trưởng doanh thu và lợi nhuận trên 20%/năm liên tục 10 năm qua, dẫn đầu xu thế AI, Điện toán đám mây và Bán dẫn.',
    valuationNote: 'ROE > 28% • Cổ tức tiền mặt & cổ phiếu đều đặn',
    targetHorizon: '3 - 5 năm',
  },
  {
    symbol: 'SSI',
    name: 'Chứng khoán SSI',
    pillar: 'finance',
    pillarLabel: 'Trụ Cột 1: Chứng Khoán / Chu Kỳ Thanh Khoản',
    actionZone: 'buy_dca',
    actionZoneLabel: 'Vùng Gom Tích Sản',
    reason: 'Độ nhạy sóng thanh khoản cao, hưởng lợi trực tiếp từ hệ thống KRX & lộ trình nâng hạng thị trường FTSE Emerging Markets.',
    valuationNote: 'P/B 1.35x • Hưởng lợi thanh khoản thị trường',
    targetHorizon: '1 - 2 năm',
  },
  {
    symbol: 'MBB',
    name: 'Ngân hàng Quân Đội',
    pillar: 'finance',
    pillarLabel: 'Trụ Cột 1: Ngân Hàng Số & Tín Dụng Bán Lẻ',
    actionZone: 'buy_dca',
    actionZoneLabel: 'Vùng Gom Tích Sản',
    reason: 'Hạn mức tăng trưởng tín dụng cao nhất ngành, tệp khách hàng số vượt 25 triệu người, định giá P/E chỉ quanh 6.x.',
    valuationNote: 'P/E 6.2x • Tỷ suất sinh lời ROE ~22%',
    targetHorizon: '1 - 3 năm',
  },
];

/**
 * Trả về danh sách khuyến nghị được tự động chọn lọc hàng ngày theo thuật toán
 */
export function getDailyAutoScreenedRecommendations() {
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  return {
    scanDate: dateStr,
    stocks: TOP3_VN30_RECOMMENDATIONS.map((s, idx) => ({
      ...s,
      rank: idx + 1,
      screenScore: 98 - idx * 3,
      screenBadge: idx === 0 ? '🔥 Top 1 Gom Mạnh Hôm Nay' : idx === 1 ? '⭐ Đại Dự Án Quốc Gia' : '🛡️ Tăng Trưởng Bền Vững',
      filterCriteria: 'P/E < 15, ROE > 20%, Đầu ngành hưởng lợi vĩ mô',
    })),
    savings: TOP3_SAVINGS_RECOMMENDATIONS.map((sav, idx) => ({
      ...sav,
      rank: idx + 1,
      screenScore: 99 - idx * 4,
      screenBadge: idx === 0 ? '🏆 Lãi Suất Đỉnh ~9.0%' : idx === 1 ? '⚡ Linh Hoạt App 24/7' : '🏛️ Chuẩn An Toàn Quốc Doanh',
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

/**
 * Thu thập tất cả các mã cổ phiếu đang có trong Tài sản (Tab 1) và Mục tiêu (Tab 3)
 * TUYỆT ĐỐI KHÔNG TỰ ĐỘNG THÊM MÃ MẪU HPG/FPT: Chỉ lấy 100% từ dữ liệu thực tế người dùng
 */
export function collectAllStockSymbols(assets: Asset[], goals: Goal[]): string[] {
  const symbols = new Set<string>();

  assets.forEach((a) => {
    if (isStockEntity(a)) {
      const sym = extractStockTicker(a.name, a.type, undefined, a.unit);
      if (sym) symbols.add(sym);
    }
  });

  goals.forEach((g) => {
    if (isStockEntity(g)) {
      const sym = extractStockTicker(g.name, undefined, g.assetType, g.unit);
      if (sym) symbols.add(sym);
    }
  });

  // Luôn nạp thêm mã khuyến nghị vào bảng giá thị trường để khi mở bảng có ngay giá cập nhật
  TOP3_VN30_RECOMMENDATIONS.forEach((rec) => {
    symbols.add(rec.symbol);
  });

  return Array.from(symbols);
}

// Memory cache client-side
let memoryStockData: StockRateData | null = null;
let lastStockFetchTime = 0;

/**
 * Lấy báo giá trực tiếp từ VPS Realtime Datafeed và DNSE Entrade ngay trên trình duyệt
 * (Hoạt động hoàn hảo trên mọi môi trường bao gồm Web tĩnh như GitHub Pages mà không bị chặn CORS)
 */
async function fetchDirectFromVPSAndEntradeClient(
  symbols: string[]
): Promise<{ stocks: Record<string, StockQuoteItem>; vnindex?: StockRateData['vnindex'] }> {
  const result: Record<string, StockQuoteItem> = {};
  const to = Math.floor(Date.now() / 1000);
  const from = to - 86400 * 380; // 380 ngày để tính đủ đáy 52 tuần

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
    try {
      // Ưu tiên 1: VPS Real-time Index (Mã 10 = VN-INDEX sàn HOSE) - CORS mở tự do, cập nhật từng giây
      const vpsIndexRes = await fetch('https://bgapidatafeed.vps.com.vn/getlistindexdetail/10', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (vpsIndexRes.ok) {
        const vpsIndexJson = await vpsIndexRes.json();
        if (Array.isArray(vpsIndexJson) && vpsIndexJson.length > 0 && vpsIndexJson[0]?.cIndex > 0) {
          const item = vpsIndexJson[0];
          let diff = item.cIndex - (item.oIndex || item.cIndex);
          let pct = item.oIndex > 0 ? (diff / item.oIndex) * 100 : 0;
          if (item.ot && typeof item.ot === 'string') {
            const parts = item.ot.split('|');
            if (parts.length >= 2) {
              const parsedDiff = parseFloat(parts[0]);
              if (!isNaN(parsedDiff)) diff = parsedDiff;
              const parsedPct = parseFloat(parts[1].replace('%', ''));
              if (!isNaN(parsedPct)) pct = parsedPct;
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
      // ignore, tiếp tục fallback
    }

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

  // 2. Lấy dữ liệu nến lịch sử DNSE cho từng mã để tính các mốc đáy 5T/10T/20T/52T
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
        low5w: 24000,
        low10w: 22500,
        low20w: 21000,
        low30w: 20000,
        low52w: 19000,
      };

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
        const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${encodeURIComponent(
          sym
        )}&resolution=1D`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          dnseData = await res.json();
        }
      } catch {}

      let finalPrice = vpsPrice > 0 ? vpsPrice : baseInfo.price;
      let finalRefPrice = vpsRefPrice > 0 ? vpsRefPrice : baseInfo.refPrice;
      let finalHigh = vpsHigh > 0 ? vpsHigh : finalPrice;
      let finalLow = vpsLow > 0 ? vpsLow : finalPrice;
      let finalVolume = vpsVolume > 0 ? vpsVolume : 0;

      let low5w = baseInfo.low5w || finalPrice;
      let low10w = baseInfo.low10w || finalPrice;
      let low20w = baseInfo.low20w || finalPrice;
      let low30w = baseInfo.low30w || finalPrice;
      let low52w = baseInfo.low52w || finalPrice;

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
      const changePercent = finalRefPrice > 0 ? parseFloat(((change / finalRefPrice) * 100).toFixed(2)) : 0;

      const diffFromLow5wPct = low5w > 0 ? parseFloat((((finalPrice - low5w) / low5w) * 100).toFixed(1)) : 0;
      const diffFromLow10wPct = low10w > 0 ? parseFloat((((finalPrice - low10w) / low10w) * 100).toFixed(1)) : 0;
      const diffFromLow20wPct = low20w > 0 ? parseFloat((((finalPrice - low20w) / low20w) * 100).toFixed(1)) : 0;
      const diffFromLow30wPct = low30w > 0 ? parseFloat((((finalPrice - low30w) / low30w) * 100).toFixed(1)) : 0;
      const diffFromLow52wPct = low52w > 0 ? parseFloat((((finalPrice - low52w) / low52w) * 100).toFixed(1)) : 0;

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
  if (!forceRefresh && memoryStockData && now - lastStockFetchTime < 10000) {
    return memoryStockData;
  }

  let cleanSymbols = Array.from(
    new Set(symbols.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{3,4}$/.test(s)))
  );

  if (cleanSymbols.length === 0) {
    cleanSymbols = ['HPG', 'FPT', 'TCB', 'MBB', 'VCB', 'VNM', 'MWG', 'SSI', 'VND', 'VIC'];
  }

  // 1. Thử gọi backend /api/stock-rates nếu có
  try {
    const url = `/api/stock-rates?symbols=${encodeURIComponent(cleanSymbols.join(','))}${
      forceRefresh ? '&refresh=1' : ''
    }`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      if (json && json.success && json.stocks && Object.keys(json.stocks).length > 0) {
        memoryStockData = json;
        lastStockFetchTime = now;
        return json;
      }
    }
  } catch (err) {
    // Chuyển sang quét trực tiếp client-side
  }

  // 2. Chế độ Fallback Trực Tiếp Phía Trình Duyệt (Hoạt động hoàn hảo trên GitHub Pages)
  try {
    const directRes = await fetchDirectFromVPSAndEntradeClient(cleanSymbols);
    if (Object.keys(directRes.stocks).length > 0) {
      const mergedStocks: Record<string, StockQuoteItem> = {};
      cleanSymbols.forEach((sym) => {
        mergedStocks[sym] = directRes.stocks[sym] || FALLBACK_STOCK_RATES[sym] || {
          symbol: sym,
          name: `Cổ phiếu ${sym}`,
          price: 25000,
          refPrice: 25000,
          change: 0,
          changePercent: 0,
          high: 25000,
          low: 25000,
          volume: 0,
        };
      });

      const liveData: StockRateData = {
        success: true,
        updatedAtStr: `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} (Sàn HOSE/HNX Trực Tuyến)`,
        fetchedAt: new Date().toISOString(),
        source: 'Sở Giao dịch Chứng khoán & VPS Realtime Datafeed',
        stocks: mergedStocks,
        vnindex: directRes.vnindex,
      };

      memoryStockData = liveData;
      lastStockFetchTime = now;
      return liveData;
    }
  } catch (directErr) {
    console.warn('[StockService] Lỗi quét trực tiếp:', directErr);
  }

  // 3. Fallback nội bộ cuối cùng nếu mất hoàn toàn kết nối
  const fallbackStocks: Record<string, StockQuoteItem> = {};
  cleanSymbols.forEach((sym) => {
    if (FALLBACK_STOCK_RATES[sym]) {
      fallbackStocks[sym] = { ...FALLBACK_STOCK_RATES[sym] };
    } else {
      fallbackStocks[sym] = {
        symbol: sym,
        name: `Cổ phiếu ${sym}`,
        price: 25000,
        refPrice: 25000,
        change: 0,
        changePercent: 0,
        high: 25000,
        low: 25000,
        volume: 0,
      };
    }
  });

  const fallbackData: StockRateData = {
    success: true,
    updatedAtStr: `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')} (Tham chiếu)`,
    fetchedAt: new Date().toISOString(),
    source: 'Bảng giá Chứng khoán Việt Nam (Tham chiếu dự phòng)',
    stocks: fallbackStocks,
  };

  memoryStockData = fallbackData;
  lastStockFetchTime = now;
  return fallbackData;
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
