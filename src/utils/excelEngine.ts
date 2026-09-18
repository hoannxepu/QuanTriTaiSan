import XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import { Asset, AssetLevel, AssetType, Debt, DebtCategory, Goal, GoalGroup, DatabaseState, AssetTransaction } from '../types';
import {
  normalizeDateStr,
  formatDateVN,
  parseFormattedDecimal,
  calculateMaturityDateISO,
  isNoTermDebt,
  isNoTermAsset,
  repairDebtPeriodicAmount,
} from './format';

export interface ParsedAssetItem {
  id?: number;
  level: AssetLevel;
  type: AssetType;
  typeName: string;
  name: string;
  amount: number;
  costPrice?: number;
  unitPrice?: number;
  currentPrice?: number;
  unit?: string;
  rate?: number;
  startDate?: string;
  termMonths?: number;
  maturityDate?: string;
  quantity?: number;
  cashflow?: number;
  divCash?: number;
  note?: string;
  isNoTerm?: boolean;
}

export interface ParsedDebtItem {
  id?: number;
  category: DebtCategory;
  categoryName: string;
  name: string;
  frequency?: 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'flexible';
  startDate?: string;
  amount: number;
  paidPrincipal: number;
  termMonths?: number;
  promoRate?: number;
  normalRate?: number;
  promoMonths?: number;
  promoEndDate?: string;
  monthlyBefore: number;
  monthlyAfter: number;
  installmentAmount?: number;
  periodicAmount?: number;
  day?: number;
  status: 'Chưa tất toán' | 'Đã tất toán';
  settledDate?: string;
  note?: string;
  isNoTerm?: boolean;
}

export interface ParsedGoalItem {
  id?: number;
  group: GoalGroup;
  groupName: string;
  name: string;
  goalType: 'dca' | 'milestone';
  assetType?: 'stock' | 'gold' | 'saving' | 'cash' | 'other';
  linkedAssetId?: number;
  linkedBankKey?: string;
  linkedDebtId?: number;
  freqMonths?: number;
  day?: number;
  targetQty?: number;
  targetAmountPerPeriod?: number;
  unit?: string;
  totalBought?: number;
  backlogQty?: number;
  unitPrice?: number;
  currentPrice?: number;
  costPrice?: number;
  lastBoughtPeriod?: string;
  target?: number;
  years?: number;
  status?: 'active' | 'completed' | 'pending';
  note?: string;
}

export interface ParsedFullDatabase {
  assets: ParsedAssetItem[];
  debts: ParsedDebtItem[];
  goals: ParsedGoalItem[];
  transactions?: AssetTransaction[];
  salaryIncome?: number;
  otherIncome?: number;
}

// Map internal AssetType to Vietnamese display name
export const getAssetTypeLabel = (type: AssetType): string => {
  switch (type) {
    case 'cash':
      return 'Tiền mặt & TK thanh toán';
    case 'saving':
      return 'Tiền gửi tiết kiệm';
    case 'gold':
      return 'Vàng vật chất';
    case 'realestate_live':
      return 'Bất động sản để ở';
    case 'realestate_rent':
      return 'Bất động sản cho thuê';
    case 'realestate_land':
      return 'Bất động sản đất nền';
    case 'stock':
      return 'Cổ phiếu niêm yết';
    case 'bond':
      return 'Trái phiếu doanh nghiệp';
    case 'crypto':
      return 'Tiền mã hóa (Crypto)';
    case 'private_equity':
      return 'Góp vốn kinh doanh';
    case 'peer_lending':
      return 'Cho vay P2P / Cho vay ngoài';
    default:
      return 'Tài sản khác';
  }
};

// Map layer string to internal AssetLevel
export const parseLevelString = (val: string): AssetLevel => {
  const s = String(val || '').toLowerCase().trim();
  if (s.includes('1') || s.includes('bảo vệ') || s.includes('bao ve') || s.includes('an toàn') || s.includes('phòng thủ')) {
    return '1';
  }
  if (s.includes('3') || s.includes('rủi ro') || s.includes('rui ro') || s.includes('mạo hiểm') || s.includes('đầu cơ')) {
    return '3';
  }
  return '2'; // Default to Tăng trưởng
};

// Map raw category string to internal AssetType
export const parseAssetTypeString = (val: string, level: AssetLevel): AssetType => {
  const s = String(val || '').toLowerCase().trim();
  if (s.includes('vàng') || s.includes('gold') || s.includes('sjc') || s.includes('nhẫn')) return 'gold';
  if (s.includes('tiết kiệm') || s.includes('saving') || s.includes('sổ') || s.includes('gửi')) return 'saving';
  if (
    s.includes('tiền mặt') ||
    s.includes('cash') ||
    s.includes('thanh toán') ||
    s.includes('ngân hàng') ||
    s.includes('tk ') ||
    s.startsWith('tk') ||
    s.includes('tài khoản')
  ) {
    return 'cash';
  }
  if (s.includes('cổ phiếu') || s.includes('stock') || s.includes('chứng khoán') || /\bcp\b/i.test(s)) return 'stock';
  if (s.includes('trái phiếu') || s.includes('bond')) return 'bond';
  if (s.includes('cho thuê') || s.includes('dòng tiền')) return 'realestate_rent';
  if (s.includes('đất nền') || s.includes('đất') || s.includes('mb') || s.includes('lô')) return 'realestate_land';
  if (s.includes('bất động sản') || s.includes('bđs') || s.includes('nhà') || s.includes('căn hộ') || s.includes('cc') || s.includes('chung cư')) return 'realestate_live';
  if (s.includes('crypto') || s.includes('mã hóa') || s.includes('btc') || s.includes('eth') || s.includes('coin')) return 'crypto';
  if (s.includes('góp vốn') || s.includes('kinh doanh') || s.includes('doanh nghiệp')) return 'private_equity';
  if (s.includes('cho vay') || s.includes('lending') || s.includes('p2p')) return 'peer_lending';

  // Nhận diện theo tên ngân hàng phổ biến (nếu chưa gán loại)
  const bankNames = ['acb', 'vcb', 'vietcombank', 'tcb', 'techcombank', 'bidv', 'mbb', 'mbbank', 'vpb', 'vpbank', 'ctg', 'vietinbank', 'stb', 'sacombank', 'tpbank', 'shb', 'hdbank', 'msb', 'vib', 'ocb'];
  const isBankMention = bankNames.some((b) => s.includes(b));
  if (isBankMention && !s.includes('cổ phiếu') && !s.includes('chứng khoán') && !/\bcp\b/i.test(s)) {
    return level === '1' ? 'cash' : 'saving';
  }

  if (level === '1') return 'saving';
  if (level === '3') return 'crypto';
  return 'saving'; // Mặc định an toàn cho Tầng 2 nếu không có từ khóa cổ phiếu
};

// Map Debt category string
export const parseDebtCategoryString = (val: string): DebtCategory => {
  const s = String(val || '').toLowerCase().trim();
  if (
    s.includes('người thân') ||
    s.includes('nguoi than') ||
    s.includes('tự do') ||
    s.includes('tu do') ||
    s.includes('mượn') ||
    s.includes('muon') ||
    s.includes('bạn bè') ||
    s.includes('ban be') ||
    s.includes('chị ') ||
    s.includes('anh ') ||
    s.includes('bố ') ||
    s.includes('mẹ ') ||
    s.includes('ông bà') ||
    s.includes('không kỳ hạn') ||
    s.includes('khong ky han') ||
    s.includes('loại 3') ||
    s.includes('loai 3') ||
    s === '3'
  ) {
    return 'type_free';
  }
  if (s.includes('1') || s.includes('có lãi') || s.includes('ngân hàng') || s.includes('thế chấp') || s.includes('bđs')) return 'type1';
  if (s.includes('2') || s.includes('trả góp') || s.includes('0%')) return 'type2';
  if (s.includes('4') || s.includes('định kỳ') || s.includes('bảo hiểm') || s.includes('thuê nhà')) return 'type3';
  if (s.includes('5') || s.includes('sinh hoạt') || s.includes('chi tiêu') || s.includes('tiêu dùng')) return 'type4';
  return 'type1';
};

export const getDebtCategoryLabel = (cat: DebtCategory): string => {
  switch (cat) {
    case 'type1': return 'Loại 1: Vay có lãi';
    case 'type2': return 'Loại 2: Trả góp 0%';
    case 'type_free': return 'Loại 3: Mượn người thân 0%';
    case 'type3': return 'Loại 4: Chi phí định kỳ';
    case 'type4': return 'Loại 5: Chi tiêu sinh hoạt';
    default: return 'Khoản nợ';
  }
};

// Map Goal group string
export const parseGoalGroupString = (val: string): GoalGroup => {
  const s = String(val || '').toLowerCase().trim();
  if (s.includes('1') || s.includes('nợ') || s.includes('trả nợ') || s.includes('đòn bẩy')) return 'debt';
  if (s.includes('2') || s.includes('dca') || s.includes('tích sản')) return 'dca';
  if (s.includes('3') || s.includes('runway') || s.includes('dự phòng') || s.includes('khẩn cấp')) return 'runway';
  if (s.includes('4') || s.includes('cột mốc') || s.includes('bđs') || s.includes('nhà') || s.includes('đất')) return 'milestone';
  return 'dca';
};

export const getGoalGroupLabel = (group: GoalGroup): string => {
  switch (group) {
    case 'debt': return 'Nhóm 1: Trả nợ & giảm đòn bẩy';
    case 'dca': return 'Nhóm 2: Tích sản định kỳ (DCA)';
    case 'runway': return 'Nhóm 3: Dự phòng Runway';
    case 'milestone': return 'Nhóm 4: Cột mốc tài chính / BĐS';
    default: return 'Mục tiêu tài chính';
  }
};

// Parse ID helper: extracts numeric ID from "TS-1710123456", "NO-102", "1710123456", etc.
export const parseIdValue = (val: any): number | undefined => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return isNaN(val) || val <= 0 ? undefined : Math.round(val);
  const s = String(val).trim();
  if (!s) return undefined;
  const digitsOnly = s.replace(/[^0-9]/g, '');
  if (!digitsOnly) return undefined;
  const num = parseInt(digitsOnly, 10);
  return isNaN(num) || num <= 0 ? undefined : num;
};

// Safe number parser for Vietnamese currency and number formats (e.g. "500.000.000", "500,000,000", "500 tr", "5 tỷ")
export const parseAmountValue = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (!val) return 0;

  let s = String(val).trim().toLowerCase();

  // Handle shorthand words
  if (s.includes('tỷ') || s.includes('ty')) {
    const num = parseFloat(s.replace(/[^0-9.,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : Math.round(num * 1_000_000_000);
  }
  if (s.includes('tr') || s.includes('triệu') || s.includes('trieu')) {
    const num = parseFloat(s.replace(/[^0-9.,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : Math.round(num * 1_000_000);
  }

  s = s.replace(/đ|vnđ|vnd|đồng/gi, '').trim();

  // Detect decimal vs thousand separators
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  }

  s = s.replace(/[^0-9.]/g, '');
  const res = parseFloat(s);
  return isNaN(res) ? 0 : Math.round(res);
};

// Safe percentage parser (supports "5.5%", "0.055", "5,5%", 5.5)
export const parseRateValue = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    if (val > 0 && val <= 1) {
      return Number((val * 100).toFixed(2));
    }
    return Number(val.toFixed(2));
  }
  let s = String(val).trim().replace(',', '.');
  if (s.includes('%')) {
    s = s.replace(/%/g, '').trim();
  }
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  if (num > 0 && num <= 1 && !String(val).includes('%')) {
    return Number((num * 100).toFixed(2));
  }
  return Number(num.toFixed(2));
};

// Safe quantity parser (preserves decimal quantities e.g. 1.5 lượng, 0.5 chỉ)
export const parseQuantityValue = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = String(val).trim();
  s = s.replace(/cp|cổ phiếu|lượng|chỉ|đơn vị|căn/gi, '').trim();
  const num = parseFormattedDecimal(s);
  return isNaN(num) ? 0 : Number(num.toFixed(4));
};

// Safe date string parser - output standardized YYYY-MM-DD
export const parseDateValue = (val: any): string => {
  if (val === undefined || val === null || val === '') return '';
  return normalizeDateStr(val);
};

// Check if a row is a header row
const isHeaderRow = (row: any[]): boolean => {
  const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
  return (
    rowStr.includes('báo cáo danh mục') ||
    rowStr.includes('tổng giá trị') ||
    rowStr.includes('tổng nợ') ||
    rowStr.includes('hướng dẫn nhập') ||
    rowStr.includes('lưu ý:') ||
    rowStr.includes('chủ tài khoản') ||
    (rowStr.includes('tầng') && (rowStr.includes('giá trị') || rowStr.includes('tên') || rowStr.includes('phân loại'))) ||
    (rowStr.includes('phân loại') && (rowStr.includes('nợ') || rowStr.includes('tên'))) ||
    (rowStr.includes('nhóm') && rowStr.includes('mục tiêu')) ||
    rowStr.includes('[phần 1') ||
    rowStr.includes('[phần 2')
  );
};

// Check if a row is a summary row
const isSummaryRow = (row: any[]): boolean => {
  const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
  return (
    rowStr.includes('tổng cộng') ||
    rowStr.includes('tong cong') ||
    rowStr.includes('tổng nợ') ||
    rowStr.includes('tong no') ||
    rowStr.includes('đã tính toán tự động') ||
    rowStr.includes('tính toán tự động')
  );
};

// Helper to format currency number
const formatCurrency = (val: number) => {
  return val.toLocaleString('vi-VN') + ' đ';
};

// ExcelJS Borders
const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

const BORDER_HEADER_REQUIRED: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'medium', color: { argb: 'FFDC2626' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

const BORDER_HEADER_OPTIONAL: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'medium', color: { argb: 'FF64748B' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

// Helper to trigger browser download from ExcelJS Workbook
const saveWorkbookToBrowser = async (wb: ExcelJS.Workbook, fileName: string) => {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// Sheet 1 Builder & Stylist
const buildSheet1 = (ws: ExcelJS.Worksheet, rows: any[][]) => {
  ws.columns = [
    { width: 24 }, // A: Mã ID
    { width: 8 },  // B: STT
    { width: 26 }, // C: Tầng Tháp (*)
    { width: 32 }, // D: Phân Loại Tài Sản (*)
    { width: 42 }, // E: Tên Tài Sản (*)
    { width: 32 }, // F: Giá Trị Hiện Tại (*) (Rộng rãi tránh ###)
    { width: 32 }, // G: Giá Vốn Ban Đầu (*)
    { width: 22 }, // H: Lãi Suất %
    { width: 22 }, // I: Ngày Bắt Đầu
    { width: 18 }, // J: Kỳ Hạn
    { width: 20 }, // K: Ngày Đáo Hạn
    { width: 18 }, // L: Số Lượng
    { width: 32 }, // M: Dòng Tiền
    { width: 28 }, // N: Cổ Tức
    { width: 50 }, // O: Ghi Chú
  ];

  rows.forEach((r) => ws.addRow(r));

  // Row 1: Title
  const r1 = ws.getRow(1);
  r1.height = 26;
  const cA1 = r1.getCell(1);
  cA1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  cA1.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 2: Summary
  const r2 = ws.getRow(2);
  r2.height = 24;
  const cA2 = r2.getCell(1);
  cA2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  cA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cA2.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 3: Guide
  const r3 = ws.getRow(3);
  r3.height = 24;
  const cA3 = r3.getCell(1);
  cA3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
  cA3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  cA3.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 4: Table Headers
  const r4 = ws.getRow(4);
  r4.height = 28;
  for (let c = 1; c <= 15; c++) {
    const cell = r4.getCell(c);
    const val = String(cell.value || '');
    const isReq = val.includes('(*)');
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: isReq ? 'FFDC2626' : 'FF1E293B' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FFFEE2E2' : 'FFF1F5F9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = isReq ? BORDER_HEADER_REQUIRED : BORDER_HEADER_OPTIONAL;
  }

  // Row 5+: Data rows
  for (let rIdx = 5; rIdx <= rows.length; rIdx++) {
    const row = ws.getRow(rIdx);
    row.height = 22;
    for (let cIdx = 1; cIdx <= 15; cIdx++) {
      const cell = row.getCell(cIdx);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = BORDER_THIN;

      if (cIdx === 1 || cIdx === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (cIdx === 9 || cIdx === 11) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '@';
      } else if (cIdx === 6 || cIdx === 7 || cIdx === 10 || cIdx === 12 || cIdx === 13 || cIdx === 14) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      } else if (cIdx === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '0.0%';
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  }

  // Freeze 4 top rows natively & set autofilter
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5', activeCell: 'A5', showGridLines: true }];
  ws.autoFilter = 'A4:O4';
};

// Sheet 2 Builder & Stylist
const buildSheet2 = (ws: ExcelJS.Worksheet, rows: any[][]) => {
  ws.columns = [
    { width: 36 }, // A: Mã ID / Khoản Thu Nhập
    { width: 32 }, // B: STT / Số Tiền (VNĐ/tháng) (*) (Rộng 32 ký tự, xử lý triệt để lỗi ###)
    { width: 34 }, // C: Phân Loại Khoản Nợ (*) / Ghi Chú
    { width: 40 }, // D: Tên Khoản Nợ (*)
    { width: 22 }, // E: Ngày Vay
    { width: 32 }, // F: Tổng Nợ Gốc (*)
    { width: 28 }, // G: Đã Trả Gốc
    { width: 20 }, // H: Kỳ Hạn Vay
    { width: 22 }, // I: Kỳ Chi Trả (*)
    { width: 32 }, // J: Tiền Trả Trong Ưu Đãi (*)
    { width: 24 }, // K: Lãi Suất Ưu Đãi
    { width: 22 }, // L: Thời Hạn Ưu Đãi
    { width: 22 }, // M: Ngày Hết Ưu Đãi
    { width: 26 }, // N: Lãi Suất Thả Nổi
    { width: 32 }, // O: Tiền Trả Sau Ưu Đãi
    { width: 26 }, // P: Ngày Trả Hàng Tháng
    { width: 20 }, // Q: Trạng Thái
    { width: 48 }, // R: Ghi Chú
  ];

  rows.forEach((r) => ws.addRow(r));

  // Row 1: Title
  const r1 = ws.getRow(1);
  r1.height = 26;
  const cA1 = r1.getCell(1);
  cA1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  cA1.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 2: Summary
  const r2 = ws.getRow(2);
  r2.height = 24;
  const cA2 = r2.getCell(1);
  cA2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  cA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cA2.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 3: Guide
  const r3 = ws.getRow(3);
  r3.height = 24;
  const cA3 = r3.getCell(1);
  cA3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
  cA3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  cA3.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 4: Section 1 Header
  const r4 = ws.getRow(4);
  r4.height = 24;
  const cA4 = r4.getCell(1);
  cA4.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
  cA4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  cA4.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 5: Income Table Headers
  const r5 = ws.getRow(5);
  r5.height = 26;
  for (let c = 1; c <= 3; c++) {
    const cell = r5.getCell(c);
    const val = String(cell.value || '');
    const isReq = val.includes('(*)');
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: isReq ? 'FFDC2626' : 'FF1E293B' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FFFEE2E2' : 'FFF1F5F9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = isReq ? BORDER_HEADER_REQUIRED : BORDER_HEADER_OPTIONAL;
  }

  // Rows 6 & 7: Income Data Rows
  for (let rIdx = 6; rIdx <= 7; rIdx++) {
    const row = ws.getRow(rIdx);
    row.height = 22;
    for (let cIdx = 1; cIdx <= 3; cIdx++) {
      const cell = row.getCell(cIdx);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = BORDER_THIN;
      if (cIdx === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  }

  // Row 9: Section 2 Header
  const r9 = ws.getRow(9);
  r9.height = 24;
  const cA9 = r9.getCell(1);
  cA9.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
  cA9.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  cA9.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 10: Debt Table Headers (18 cols)
  const r10 = ws.getRow(10);
  r10.height = 28;
  for (let c = 1; c <= 18; c++) {
    const cell = r10.getCell(c);
    const val = String(cell.value || '');
    const isReq = val.includes('(*)');
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: isReq ? 'FFDC2626' : 'FF1E293B' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FFFEE2E2' : 'FFF1F5F9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = isReq ? BORDER_HEADER_REQUIRED : BORDER_HEADER_OPTIONAL;
  }

  // Rows 11+: Debt Data rows
  for (let rIdx = 11; rIdx <= rows.length; rIdx++) {
    const row = ws.getRow(rIdx);
    row.height = 22;
    for (let cIdx = 1; cIdx <= 18; cIdx++) {
      const cell = row.getCell(cIdx);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = BORDER_THIN;

      if (cIdx === 1 || cIdx === 2 || cIdx === 16 || cIdx === 17) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (cIdx === 5 || cIdx === 13) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '@';
      } else if (cIdx === 6 || cIdx === 7 || cIdx === 8 || cIdx === 10 || cIdx === 12 || cIdx === 15) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      } else if (cIdx === 11 || cIdx === 14) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '0.0%';
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  }

  // Freeze 10 top rows natively & set autofilter on row 10
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 10, topLeftCell: 'A11', activeCell: 'A11', showGridLines: true }];
  ws.autoFilter = 'A10:R10';
};

// Sheet 3 Builder & Stylist
const buildSheet3 = (ws: ExcelJS.Worksheet, rows: any[][]) => {
  ws.columns = [
    { width: 24 }, // A: Mã ID
    { width: 8 },  // B: STT
    { width: 36 }, // C: Nhóm Mục Tiêu (*)
    { width: 40 }, // D: Tên Mục Tiêu (*)
    { width: 22 }, // E: Loại Mục Tiêu (*)
    { width: 22 }, // F: Kênh Tài Sản
    { width: 20 }, // G: Chu Kỳ Gom
    { width: 28 }, // H: Ngày Chốt Mua
    { width: 24 }, // I: Định Mức SL
    { width: 14 }, // J: Đơn Vị
    { width: 32 }, // K: Tiền Nạp Mỗi Kỳ
    { width: 26 }, // L: Đã Tích Lũy
    { width: 26 }, // M: Nợ Chỉ Tiêu
    { width: 30 }, // N: Liên Kết (TS-... / Ngân Hàng)
    { width: 32 }, // O: Tổng Tiền Mục Tiêu
    { width: 18 }, // P: Thời Hạn
    { width: 18 }, // Q: Trạng Thái
    { width: 50 }, // R: Ghi Chú
  ];

  rows.forEach((r) => ws.addRow(r));

  // Row 1: Title
  const r1 = ws.getRow(1);
  r1.height = 26;
  const cA1 = r1.getCell(1);
  cA1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  cA1.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 2: Summary
  const r2 = ws.getRow(2);
  r2.height = 24;
  const cA2 = r2.getCell(1);
  cA2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  cA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cA2.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 3: Guide
  const r3 = ws.getRow(3);
  r3.height = 24;
  const cA3 = r3.getCell(1);
  cA3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
  cA3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  cA3.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 4: Table Headers
  const r4 = ws.getRow(4);
  r4.height = 28;
  for (let c = 1; c <= 18; c++) {
    const cell = r4.getCell(c);
    const val = String(cell.value || '');
    const isReq = val.includes('(*)');
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: isReq ? 'FFDC2626' : 'FF1E293B' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FFFEE2E2' : 'FFF1F5F9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = isReq ? BORDER_HEADER_REQUIRED : BORDER_HEADER_OPTIONAL;
  }

  // Row 5+: Data rows
  for (let rIdx = 5; rIdx <= rows.length; rIdx++) {
    const row = ws.getRow(rIdx);
    row.height = 22;
    for (let cIdx = 1; cIdx <= 18; cIdx++) {
      const cell = row.getCell(cIdx);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = BORDER_THIN;

      if (cIdx === 1 || cIdx === 2 || cIdx === 7 || cIdx === 8 || cIdx === 10 || cIdx === 16 || cIdx === 17) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (cIdx === 9 || cIdx === 11 || cIdx === 12 || cIdx === 13 || cIdx === 15) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = (cIdx === 9 || cIdx === 12 || cIdx === 13) ? '#,##0.##' : '#,##0';
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  }

  // Freeze 4 top rows natively & set autofilter
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5', activeCell: 'A5', showGridLines: true }];
  ws.autoFilter = 'A4:R4';
};

// Sheet 4 Builder & Stylist (Lịch Sử Giao Dịch Tích Sản & Mua Gom)
const buildSheet4 = (ws: ExcelJS.Worksheet, rows: any[][]) => {
  ws.columns = [
    { width: 22 }, // A: Mã ID Giao Dịch
    { width: 8 },  // B: STT
    { width: 22 }, // C: Mã ID Tài Sản Liên Kết (TS-...)
    { width: 38 }, // D: Tên Tài Sản / Mục Tiêu (*)
    { width: 20 }, // E: Ngày Giao Dịch (YYYY-MM-DD) (*)
    { width: 22 }, // F: Loại Giao Dịch (*)
    { width: 20 }, // G: Số Lượng (*)
    { width: 14 }, // H: Đơn Vị
    { width: 26 }, // I: Đơn Giá (VNĐ)
    { width: 30 }, // J: Thành Tiền (VNĐ) (*)
    { width: 45 }, // K: Ghi Chú
  ];

  rows.forEach((r) => ws.addRow(r));

  // Row 1: Title
  const r1 = ws.getRow(1);
  r1.height = 26;
  const cA1 = r1.getCell(1);
  cA1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  cA1.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 2: Summary
  const r2 = ws.getRow(2);
  r2.height = 24;
  const cA2 = r2.getCell(1);
  cA2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  cA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cA2.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 3: Guide
  const r3 = ws.getRow(3);
  r3.height = 24;
  const cA3 = r3.getCell(1);
  cA3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
  cA3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  cA3.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 4: Table Headers
  const r4 = ws.getRow(4);
  r4.height = 28;
  for (let c = 1; c <= 11; c++) {
    const cell = r4.getCell(c);
    const val = String(cell.value || '');
    const isReq = val.includes('(*)');
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: isReq ? 'FFDC2626' : 'FF1E293B' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FFFEE2E2' : 'FFF1F5F9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = isReq ? BORDER_HEADER_REQUIRED : BORDER_HEADER_OPTIONAL;
  }

  // Row 5+: Data rows
  for (let rIdx = 5; rIdx <= rows.length; rIdx++) {
    const row = ws.getRow(rIdx);
    row.height = 22;
    for (let cIdx = 1; cIdx <= 11; cIdx++) {
      const cell = row.getCell(cIdx);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = BORDER_THIN;

      if (cIdx === 1 || cIdx === 2 || cIdx === 3 || cIdx === 5 || cIdx === 6 || cIdx === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (cIdx === 5) cell.numFmt = '@';
      } else if (cIdx === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.##';
        }
      } else if (cIdx === 9 || cIdx === 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  }

  // Freeze 4 top rows natively & set autofilter
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5', activeCell: 'A5', showGridLines: true }];
  ws.autoFilter = 'A4:K4';
};

// =========================================================================
// 1. TẢI FILE EXCEL MẪU CHUẨN (TOP SUMMARY + BỘ LỌC + NHẬP VÔ TẬN Ở DƯỚI)
// =========================================================================
export const downloadStandardExcelTemplate = async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tháp Tài Sản';
  wb.lastModifiedBy = 'Tháp Tài Sản';
  wb.created = new Date();
  wb.modified = new Date();

  // SHEET 1: 1_Tai_San
  const ws1Data: any[][] = [
    ['BÁO CÁO DANH MỤC THÁP TÀI SẢN 3 TẦNG (FILE MẪU CHUẨN)'],
    ['[TỔNG HỢP]: Tổng Giá Trị = 5.290.000.000 đ | Tổng Vốn Ban Đầu = 4.490.000.000 đ | Số Lượng Mục = 7 | App tự động tính toán'],
    ['* HƯỚNG DẪN: Cột có (*) là BẮT BUỘC. Giữ nguyên Mã ID khi sửa dòng cũ. Để trống Mã ID khi thêm mới. Ngày tháng định dạng YYYY-MM-DD hoặc DD/MM/YYYY.'],
    [
      'Mã ID (Trống=Thêm mới)',
      'STT',
      'Tầng Tháp (*)',
      'Phân Loại Tài Sản (*)',
      'Tên Tài Sản / Danh Mục (*)',
      'Giá Trị Hiện Tại (VNĐ) (*)',
      'Giá Vốn Ban Đầu (VNĐ) (*)',
      'Lãi Suất (%/năm)',
      'Ngày Bắt Đầu / Mua',
      'Kỳ Hạn (Tháng)',
      'Ngày Đáo Hạn',
      'Số Lượng',
      'Dòng Tiền Thu Về (VNĐ/tháng)',
      'Cổ Tức (VNĐ/CP/năm)',
      'Ghi Chú / Kỳ Vọng',
    ],
    ['TS-101', 1, 'Tầng 1: Bảo vệ', 'Tiền gửi tiết kiệm', 'Sổ tiết kiệm Vietcombank 12T', 300000000, 300000000, 0.055, '2025-06-15', 12, '2026-06-15', 1, 0, 0, 'Lãi suất 5.5%/năm, kỳ hạn 12 tháng'],
    ['TS-102', 2, 'Tầng 1: Bảo vệ', 'Tiền mặt & TK thanh toán', 'Tài khoản Techcombank (Quỹ khẩn cấp)', 50000000, 50000000, 0, '2025-01-01', 0, '', 1, 0, 0, 'Dự phòng sinh hoạt 6 tháng'],
    ['TS-103', 3, 'Tầng 1: Bảo vệ', 'Vàng vật chất', 'Vàng miếng SJC 9999', 170000000, 150000000, 0.12, '2024-08-10', 0, '', 1.5, 0, 0, '1.5 lượng vàng tích trữ phòng vệ lạm phát'],
    ['TS-104', 4, 'Tầng 2: Tăng trưởng', 'Cổ phiếu niêm yết', 'Cổ phiếu FPT Technology', 650000000, 500000000, 0.18, '2024-03-15', 0, '', 5000, 0, 2000, '5.000 CP, cổ tức 2.000 đ/CP/năm'],
    ['TS-105', 5, 'Tầng 2: Tăng trưởng', 'Bất động sản cho thuê', 'Căn hộ chung cư Vinhomes', 3800000000, 3200000000, 0.056, '2023-11-20', 0, '', 1, 18000000, 0, 'Cho thuê 18 triệu/tháng, tỷ suất 5.6%/năm'],
    ['TS-106', 6, 'Tầng 2: Tăng trưởng', 'Trái phiếu doanh nghiệp', 'Trái phiếu Masan Group', 200000000, 200000000, 0.092, '2024-05-10', 24, '2026-05-10', 200, 0, 0, 'Trái phiếu kỳ hạn 2 năm lãi 9.2%/năm'],
    ['TS-107', 7, 'Tầng 3: Rủi ro', 'Tiền mã hóa (Crypto)', 'Bitcoin (BTC) & Ethereum (ETH)', 120000000, 90000000, 0.25, '2024-10-01', 0, '', 1, 0, 0, 'Danh mục mạo hiểm chu kỳ mới'],
  ];

  const ws1 = wb.addWorksheet('1_Tai_San');
  buildSheet1(ws1, ws1Data);

  // SHEET 2: 2_Dong_Tien_Va_No
  const ws2Data: any[][] = [
    ['THU NHẬP DÒNG TIỀN VÀ NGHĨA VỤ NỢ (FILE MẪU CHUẨN)'],
    ['[TỔNG HỢP]: Tổng Nợ Gốc = 1.436.000.000 đ | Lương = 35.000.000 đ/tháng | Thu nhập khác = 15.000.000 đ/tháng | Tổng nợ: 5 khoản'],
    ['* HƯỚNG DẪN: Cột có (*) là BẮT BUỘC. Điền thu nhập ở phần 1, các khoản nợ ở phần 2. Giữ nguyên Mã ID khi sửa nợ cũ.'],
    ['[PHẦN 1: THU NHẬP HÀNG THÁNG]'],
    ['Khoản Thu Nhập (*)', 'Số Tiền (VNĐ/tháng) (*)', 'Ghi Chú'],
    ['Lương chủ động hằng tháng', 35000000, 'Thu nhập chính sau thuế'],
    ['Thu nhập thụ động / ngoài khác', 15000000, 'Dòng tiền cho thuê + freelance'],
    [],
    ['[PHẦN 2: DANH SÁCH CÁC KHOẢN NỢ & CHI PHÍ ĐỊNH KỲ]'],
    [
      'Mã ID (Trống=Thêm mới)',
      'STT',
      'Phân Loại Khoản NỢ (*)',
      'Tên Khoản Nợ / Chi Phí (*)',
      'Ngày Vay / Bắt Đầu',
      'Tổng Nợ Gốc (VNĐ) (*)',
      'Đã Trả Gốc (VNĐ)',
      'Kỳ Hạn Vay (Tháng)',
      'Kỳ Chi Trả (*)',
      'Tiền Trả Hàng Tháng / Trong Ưu Đãi (VNĐ) (*)',
      'Lãi Suất Ưu Đãi (%/năm)',
      'Thời Hạn Ưu Đãi (Tháng)',
      'Ngày Hết Ưu Đãi Lãi',
      'Lãi Suất Sau Ưu Đãi (%/năm)',
      'Tiền Trả Sau Ưu Đãi (VNĐ)',
      'Ngày Trả Hàng Tháng (1-31)',
      'Trạng Thái',
      'Ghi Chú',
    ],
    ['NO-201', 1, 'Loại 1: Vay có lãi', 'Vay mua nhà BIDV', '2024-03-15', 1200000000, 200000000, 120, 'Hàng tháng', 15500000, 0.065, 24, '2026-03-15', 0.105, 19800000, 15, 'Chưa tất toán', 'Cố định 2 năm đầu 6.5%'],
    ['NO-202', 2, 'Loại 2: Trả góp 0%', 'Trả góp Laptop Macbook', '2025-01-10', 36000000, 18000000, 12, 'Hàng tháng', 3000000, 0, 0, '', 0, 3000000, 20, 'Chưa tất toán', 'Trả góp 0% qua thẻ tín dụng'],
    ['NO-203', 3, 'Loại 3: Mượn người thân 0%', 'Vay người thân mua đất', '2024-06-01', 200000000, 50000000, 24, 'Linh hoạt', 0, 0, 0, '', 0, 0, 1, 'Chưa tất toán', 'Mượn 0% không tính lãi'],
    ['NO-204', 4, 'Loại 4: Chi phí định kỳ', 'Bảo hiểm nhân thọ Dai-ichi', '2023-08-01', 0, 0, 12, 'Hàng tháng', 2500000, 0, 0, '', 0, 2500000, 10, 'Chưa tất toán', 'Đóng định kỳ bảo vệ gia đình'],
    ['NO-205', 5, 'Loại 5: Chi tiêu sinh hoạt', 'Chi tiêu sinh hoạt gia đình', '2025-01-01', 0, 0, 1, 'Hàng tháng', 16000000, 0, 0, '', 0, 16000000, 1, 'Chưa tất toán', 'Ngân sách sinh hoạt tối thiểu'],
  ];

  const ws2 = wb.addWorksheet('2_Dong_Tien_Va_No');
  buildSheet2(ws2, ws2Data);

  // SHEET 3: 3_Muc_Tieu
  const ws3Data: any[][] = [
    ['KẾ HOẠCH MỤC TIÊU TÀI CHÍNH 4 NHÓM (FILE MẪU CHUẨN)'],
    ['[TỔNG HỢP]: Tổng số 4 mục tiêu | Tích sản DCA & Cột mốc tích lũy tài chính lớn | App tự động tính toán'],
    ['* HƯỚNG DẪN: Cột có (*) là BẮT BUỘC. Giữ nguyên Mã ID khi sửa mục tiêu cũ. Để trống Mã ID khi thêm mới.'],
    [
      'Mã ID (Trống=Thêm mới)',
      'STT',
      'Nhóm Mục Tiêu (*)',
      'Tên Mục Tiêu (*)',
      'Loại Mục Tiêu (*)',
      'Kênh Tài Sản',
      'Chu Kỳ Gom (Tháng)',
      'Ngày Chốt Mua Trong Tháng',
      'Định Mức SL Mỗi Kỳ',
      'Đơn Vị',
      'Tiền Nạp Mỗi Kỳ (VNĐ)',
      'Đã Tích Lũy Đến Nay',
      'Nợ Chỉ Tiêu Chưa Mua',
      'Liên Kết (TS-... / Ngân Hàng)',
      'Tổng Tiền Mục Tiêu (VNĐ)',
      'Thời Hạn (Năm)',
      'Trạng Thái',
      'Ghi Chú / Chiến Lược',
    ],
    ['MT-301', 1, 'Nhóm 2: Tích sản định kỳ (DCA)', 'Tích sản cổ phiếu FPT', 'DCA', 'Cổ phiếu', 1, 20, 200, 'CP', 0, 1500, 0, 'TS-104', 0, 3, 'active', 'Mua định kỳ 200 CP ngày 20 hằng tháng'],
    ['MT-302', 2, 'Nhóm 2: Tích sản định kỳ (DCA)', 'Tích sản Vàng nhẫn 9999', 'DCA', 'Vàng', 1, 25, 1.5, 'Chỉ', 0, 8.5, 0, 'TS-103', 0, 2, 'active', 'Mua tích trữ mỗi tháng 1.5 chỉ'],
    ['MT-303', 3, 'Nhóm 1: Tích sản tiết kiệm', 'Tích sản tiết kiệm Vietcombank', 'DCA', 'Tiết kiệm', 1, 10, 0, 'VNĐ', 10000000, 50000000, 0, 'Bank: VCB', 200000000, 2, 'active', 'Gửi góp tiết kiệm ngân hàng VCB'],
    ['MT-304', 4, 'Nhóm 3: Dự phòng Runway', 'Quỹ khẩn cấp 6 tháng', 'Cột mốc', 'Tiền mặt', 1, 1, 0, 'VNĐ', 5000000, 50000000, 0, 'TS-102', 120000000, 1, 'active', 'Quỹ dự phòng an toàn'],
    ['MT-305', 5, 'Nhóm 4: Cột mốc tài chính / BĐS', 'Mua đất nền ven đô', 'Cột mốc', 'Khác', 3, 15, 0, 'VNĐ', 30000000, 300000000, 0, '', 1500000000, 4, 'active', 'Tích lũy vốn tự có chuẩn bị đầu tư'],
  ];

  const ws3 = wb.addWorksheet('3_Muc_Tieu');
  buildSheet3(ws3, ws3Data);

  // SHEET 4: 4_Lich_Su_Giao_Dich (Lịch sử giao dịch tích sản & mua gom)
  const ws4Data: any[][] = [
    ['LỊCH SỬ GIAO DỊCH TÍCH SẢN & BIẾN ĐỘNG DANH MỤC (FILE MẪU CHUẨN)'],
    ['[TỔNG HỢP]: Lịch sử các lần mua gom, nạp thêm, bán tài sản | Tự động đồng bộ với danh mục và mục tiêu DCA'],
    ['* HƯỚNG DẪN: Cột có (*) là BẮT BUỘC. Điền Mã ID Tài sản (ví dụ TS-103) để tự động khớp nối. Định dạng ngày YYYY-MM-DD.'],
    [
      'Mã ID Giao Dịch',
      'STT',
      'Mã ID Tài Sản (TS-...)',
      'Tên Tài Sản / Mục Tiêu (*)',
      'Ngày Giao Dịch (YYYY-MM-DD) (*)',
      'Loại Giao Dịch (*)',
      'Số Lượng (*)',
      'Đơn Vị',
      'Đơn Giá (VNĐ)',
      'Thành Tiền (VNĐ) (*)',
      'Ghi Chú',
    ],
    ['GD-01', 1, 'TS-103', 'Vàng miếng SJC 9999', '2026-08-10', 'Mua gom', 1.5, 'Lượng', 86000000, 129000000, 'Mua gom tích sản định kỳ đợt 1'],
    ['GD-02', 2, 'TS-104', 'Cổ phiếu FPT Technology', '2026-08-20', 'Mua gom', 200, 'CP', 135000, 27000000, 'Khớp lệnh tích sản phiên ATC'],
  ];

  const ws4 = wb.addWorksheet('4_Lich_Su_Giao_Dich');
  buildSheet4(ws4, ws4Data);

  await saveWorkbookToBrowser(wb, 'Mau_Nhap_Thap_Tai_San_Chuan.xlsx');
};

// =========================================================================
// 2. XUẤT TOÀN BỘ CƠ SỞ DỮ LIỆU RA EXCEL (TOP SUMMARY + BỘ LỌC + DỮ LIỆU VÔ TẬN)
// =========================================================================
export const exportFullDatabaseToExcel = async (db: DatabaseState, accountName?: string) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tháp Tài Sản';
  wb.lastModifiedBy = 'Tháp Tài Sản';
  wb.created = new Date();
  wb.modified = new Date();

  const dateStr = new Date().toLocaleDateString('vi-VN');

  // SHEET 1: TÀI SẢN
  const totalAssetValue = db.assets.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalCostPrice = db.assets.reduce((sum, a) => sum + (Number(a.costPrice || a.amount) || 0), 0);

  const rows1: any[][] = [
    ['BÁO CÁO DANH MỤC THÁP TÀI SẢN 3 TẦNG'],
    [`[TỔNG HỢP]: Tổng Giá Trị = ${formatCurrency(totalAssetValue)} | Tổng Giá Vốn = ${formatCurrency(totalCostPrice)} | Tổng Số Mục = ${db.assets.length} | Chủ TK: ${accountName || 'Cá nhân'} | Ngày: ${dateStr}`],
    ['* HƯỚNG DẪN: Cột có (*) là BẮT BUỘC. Giữ nguyên Mã ID khi sửa dòng cũ. Để trống Mã ID khi thêm mới. Phía dưới có thể nhập vô tận mà không bị vướng tổng.'],
    [
      'Mã ID (Trống=Thêm mới)',
      'STT',
      'Tầng Tháp (*)',
      'Phân Loại Tài Sản (*)',
      'Tên Tài Sản / Danh Mục (*)',
      'Giá Trị Hiện Tại (VNĐ) (*)',
      'Giá Vốn Ban Đầu (VNĐ) (*)',
      'Lãi Suất (%/năm)',
      'Ngày Bắt Đầu / Mua',
      'Kỳ Hạn (Tháng)',
      'Ngày Đáo Hạn',
      'Số Lượng',
      'Dòng Tiền Thu Về (VNĐ/tháng)',
      'Cổ Tức (VNĐ/CP/năm)',
      'Ghi Chú / Kỳ Vọng',
    ],
  ];

  const sortedAssets = [...db.assets].sort((a, b) => {
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    return (b.amount || 0) - (a.amount || 0);
  });

  sortedAssets.forEach((item, idx) => {
    const levelLabel =
      item.level === '1'
        ? 'Tầng 1: Bảo vệ'
        : item.level === '2'
        ? 'Tầng 2: Tăng trưởng'
        : 'Tầng 3: Rủi ro';

    const isNoTerm = isNoTermAsset(item);
    rows1.push([
      `TS-${item.id}`,
      idx + 1,
      levelLabel,
      getAssetTypeLabel(item.type),
      item.name,
      item.amount || 0,
      item.costPrice || item.amount || 0,
      item.rate ? item.rate / 100 : 0,
      item.startDate ? formatDateVN(item.startDate) : '',
      isNoTerm ? 'Không kỳ hạn' : item.termMonths || 0,
      isNoTerm ? 'Không kỳ hạn' : item.maturityDate ? formatDateVN(item.maturityDate) : '',
      item.quantity || 1,
      item.cashflow || 0,
      item.divCash || 0,
      item.note || (item.updatedAt ? `Cập nhật: ${item.updatedAt}` : ''),
    ]);
  });

  const ws1 = wb.addWorksheet('1_Tai_San');
  buildSheet1(ws1, rows1);

  // SHEET 2: DÒNG TIỀN VÀ NỢ
  const totalDebtAmount = db.debts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalMonthlyDebt = db.debts.reduce((sum, d) => sum + (Number(d.monthlyBefore) || 0), 0);

  const rows2: any[][] = [
    ['BÁO CÁO DÒNG TIỀN VÀ NGHĨA VỤ NỢ'],
    [`[TỔNG HỢP]: Tổng Nợ Gốc = ${formatCurrency(totalDebtAmount)} | Tổng Trả/Tháng = ${formatCurrency(totalMonthlyDebt)} | Lương = ${formatCurrency(db.salaryIncome || 0)} | Thu Nhập Khác = ${formatCurrency(db.otherIncome || 0)} | Số Khoản = ${db.debts.length}`],
    ['* HƯỚNG DẪN: Cột có (*) là BẮT BUỘC. Điền thu nhập ở phần 1, các khoản nợ ở phần 2. Giữ nguyên Mã ID khi sửa nợ cũ.'],
    ['[PHẦN 1: THU NHẬP HÀNG THÁNG]'],
    ['Khoản Thu Nhập (*)', 'Số Tiền (VNĐ/tháng) (*)', 'Ghi Chú'],
    ['Lương chủ động hằng tháng', db.salaryIncome || 0, 'Thu nhập chính sau thuế'],
    ['Thu nhập thụ động / ngoài khác', db.otherIncome || 0, 'Dòng tiền kinh doanh, cho thuê, freelance'],
    [],
    ['[PHẦN 2: DANH SÁCH CÁC KHOẢN NỢ & CHI PHÍ ĐỊNH KỲ]'],
    [
      'Mã ID (Trống=Thêm mới)',
      'STT',
      'Phân Loại Khoản Nợ (*)',
      'Tên Khoản Nợ / Chi Phí (*)',
      'Ngày Vay / Bắt Đầu',
      'Tổng Nợ Gốc (VNĐ) (*)',
      'Đã Trả Gốc (VNĐ)',
      'Kỳ Hạn Vay (Tháng)',
      'Kỳ Chi Trả (*)',
      'Tiền Trả Hàng Tháng / Trong Ưu Đãi (VNĐ) (*)',
      'Lãi Suất Ưu Đãi (%/năm)',
      'Thời Hạn Ưu Đãi (Tháng)',
      'Ngày Hết Ưu Đãi Lãi',
      'Lãi Suất Sau Ưu Đãi (%/năm)',
      'Tiền Trả Sau Ưu Đãi (VNĐ)',
      'Ngày Trả Hàng Tháng (1-31)',
      'Trạng Thái',
      'Ghi Chú',
    ],
  ];

  db.debts.forEach((item, idx) => {
    const isNoTerm = isNoTermDebt(item);
    const freqName = isNoTerm
      ? 'Linh hoạt'
      : item.frequency === 'quarterly'
      ? 'Hàng quý'
      : item.frequency === 'biannual'
      ? '6 tháng'
      : item.frequency === 'annual'
      ? 'Hàng năm'
      : item.frequency === 'flexible'
      ? 'Linh hoạt'
      : 'Hàng tháng';

    rows2.push([
      `NO-${item.id}`,
      idx + 1,
      getDebtCategoryLabel(item.category),
      item.name,
      item.startDate ? formatDateVN(item.startDate) : '',
      item.amount || 0,
      item.paidPrincipal || 0,
      isNoTerm ? 'Không kỳ hạn' : item.termMonths || 0,
      freqName,
      isNoTerm ? 0 : item.monthlyBefore || 0,
      item.promoRate ? item.promoRate / 100 : 0,
      item.promoMonths || 0,
      item.promoEndDate ? formatDateVN(item.promoEndDate) : '',
      item.normalRate ? item.normalRate / 100 : 0,
      isNoTerm ? 0 : item.monthlyAfter || item.monthlyBefore || 0,
      isNoTerm ? '' : (item.day !== undefined && item.day !== null ? item.day : 20),
      item.status || 'Chưa tất toán',
      item.note || '',
    ]);
  });

  const ws2 = wb.addWorksheet('2_Dong_Tien_Va_No');
  buildSheet2(ws2, rows2);

  // SHEET 3: MỤC TIÊU TÀI CHÍNH
  const rows3: any[][] = [
    ['BÁO CÁO MỤC TIÊU TÀI CHÍNH 4 NHÓM'],
    [`[TỔNG HỢP]: Tổng Số Mục Tiêu = ${db.goals.length} | Tích sản DCA & Cột mốc tích lũy tài chính lớn | Chủ TK: ${accountName || 'Cá nhân'} | Ngày: ${dateStr}`],
    ['* HƯỚNG DẪN: Cột có (*) là BẮT BUỘC. Giữ nguyên Mã ID khi sửa mục tiêu cũ. Để trống Mã ID khi thêm mới.'],
    [
      'Mã ID (Trống=Thêm mới)',
      'STT',
      'Nhóm Mục Tiêu (*)',
      'Tên Mục Tiêu (*)',
      'Loại Mục Tiêu (*)',
      'Kênh Tài Sản',
      'Chu Kỳ Gom (Tháng)',
      'Ngày Chốt Mua Trong Tháng',
      'Định Mức SL Mỗi Kỳ',
      'Đơn Vị',
      'Tiền Nạp Mỗi Kỳ (VNĐ)',
      'Đã Tích Lũy Đến Nay',
      'Nợ Chỉ Tiêu Chưa Mua',
      'Liên Kết (TS-... / Ngân Hàng)',
      'Tổng Tiền Mục Tiêu (VNĐ)',
      'Thời Hạn (Năm)',
      'Trạng Thái',
      'Ghi Chú / Chiến Lược',
    ],
  ];

  db.goals.forEach((item, idx) => {
    const assetTypeName =
      item.assetType === 'stock'
        ? 'Cổ phiếu'
        : item.assetType === 'gold'
        ? 'Vàng'
        : item.assetType === 'saving'
        ? 'Tiết kiệm'
        : item.assetType === 'cash'
        ? 'Tiền mặt'
        : 'Khác';

    const linkStr = item.linkedAssetId
      ? `TS-${item.linkedAssetId}`
      : item.linkedBankKey
      ? `Bank: ${item.linkedBankKey.toUpperCase()}`
      : item.linkedDebtId
      ? `NO-${item.linkedDebtId}`
      : '';

    rows3.push([
      `MT-${item.id}`,
      idx + 1,
      getGoalGroupLabel(item.group),
      item.name,
      item.goalType === 'dca' ? 'DCA tích sản' : 'Cột mốc tích lũy',
      assetTypeName,
      item.freqMonths || 1,
      item.day || 1,
      item.targetQty || 0,
      item.unit || 'VNĐ',
      item.targetAmountPerPeriod || 0,
      item.totalBought || 0,
      item.backlogQty || 0,
      linkStr,
      item.target || 0,
      item.years || 1,
      item.status || 'active',
      item.note || '',
    ]);
  });

  const ws3 = wb.addWorksheet('3_Muc_Tieu');
  buildSheet3(ws3, rows3);

  // SHEET 4: LỊCH SỬ GIAO DỊCH TÍCH SẢN & MUA GOM
  const txList = db.transactions || [];
  const rows4: any[][] = [
    ['BÁO CÁO LỊCH SỬ GIAO DỊCH TÍCH SẢN & BIẾN ĐỘNG'],
    [`[TỔNG HỢP]: Tổng Số Giao Dịch = ${txList.length} | Lịch sử mua gom, nạp thêm, bán tài sản | Chủ TK: ${accountName || 'Cá nhân'} | Ngày: ${dateStr}`],
    ['* HƯỚNG DẪN: Cột có (*) là BẮT BUỘC. Điền Mã ID Tài sản (ví dụ TS-103) để tự động khớp nối. Định dạng ngày YYYY-MM-DD.'],
    [
      'Mã ID Giao Dịch',
      'STT',
      'Mã ID Tài Sản (TS-...)',
      'Tên Tài Sản / Mục Tiêu (*)',
      'Ngày Giao Dịch (YYYY-MM-DD) (*)',
      'Loại Giao Dịch (*)',
      'Số Lượng (*)',
      'Đơn Vị',
      'Đơn Giá (VNĐ)',
      'Thành Tiền (VNĐ) (*)',
      'Ghi Chú',
    ],
  ];

  if (txList.length === 0) {
    rows4.push(['GD-01', 1, 'TS-103', 'Vàng miếng SJC 9999', '2026-08-10', 'Mua gom', 1.5, 'Lượng', 86000000, 129000000, 'Mua gom mẫu']);
  } else {
    txList.forEach((tx, idx) => {
      const typeLabel =
        tx.type === 'buy'
          ? 'Mua gom'
          : tx.type === 'deposit'
          ? 'Nạp thêm'
          : tx.type === 'sell'
          ? 'Bán bớt'
          : 'Rút vốn';

      rows4.push([
        tx.id ? (String(tx.id).startsWith('GD-') || String(tx.id).startsWith('tx-') ? tx.id : `GD-${tx.id}`) : `GD-${idx + 1}`,
        idx + 1,
        tx.assetId ? `TS-${tx.assetId}` : '',
        tx.assetName || '',
        tx.date ? formatDateVN(tx.date) : '',
        typeLabel,
        tx.quantity || 0,
        tx.unit || '',
        tx.pricePerUnit || 0,
        tx.totalAmount || 0,
        tx.note || '',
      ]);
    });
  }

  const ws4 = wb.addWorksheet('4_Lich_Su_Giao_Dich');
  buildSheet4(ws4, rows4);

  const safeName = (accountName || 'User').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Bao_Cao_Thap_Tai_San_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  await saveWorkbookToBrowser(wb, fileName);
};

export const exportAssetsToExcel = async (assetsOrDb: Asset[] | DatabaseState, accountName?: string) => {
  if ('assets' in (assetsOrDb as any) && 'debts' in (assetsOrDb as any)) {
    await exportFullDatabaseToExcel(assetsOrDb as DatabaseState, accountName);
  } else {
    const miniDb: DatabaseState = {
      assets: assetsOrDb as Asset[],
      debts: [],
      goals: [],
      history: [],
      salaryIncome: 0,
      otherIncome: 0,
      lastUpdate: '',
    };
    await exportFullDatabaseToExcel(miniDb, accountName);
  }
};

// =========================================================================
// 3. PARSER THÔNG MINH (LIÊN THÔNG GIÁ TRỊ - GIÁ VỐN & ĐỒNG BỘ MÃ ID)
// =========================================================================

// Parse Sheet 1: Assets
export const parseRawRowsToAssets = (rawRows: any[][]): ParsedAssetItem[] => {
  const results: ParsedAssetItem[] = [];

  // 1. Detect header row & column index mapping
  const colMap: Record<string, number> = {};
  let headerFound = false;

  for (const row of rawRows) {
    if (!row || row.length === 0) continue;
    const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
    if (rowStr.includes('tầng') && (rowStr.includes('giá trị') || rowStr.includes('tên') || rowStr.includes('phân loại') || rowStr.includes('mã'))) {
      row.forEach((cell, idx) => {
        const lower = String(cell || '').toLowerCase().trim();
        if (lower.includes('mã id') || lower === 'id' || lower.includes('trống=thêm')) colMap.id = idx;
        else if (lower === 'stt' || lower === 'tt') colMap.stt = idx;
        else if (lower.includes('tầng') || lower.includes('tháp')) colMap.level = idx;
        else if (lower.includes('phân loại') || (lower.includes('mã') && !lower.includes('id'))) colMap.type = idx;
        else if (lower.includes('tên')) colMap.name = idx;
        else if (lower.includes('hiện tại') || lower.includes('giá trị')) colMap.amount = idx;
        else if (lower.includes('vốn') || lower.includes('ban đầu')) colMap.costPrice = idx;
        else if (lower.includes('lãi')) colMap.rate = idx;
        else if (lower.includes('bắt đầu') || lower.includes('ngày gửi') || lower.includes('ngày mua')) colMap.startDate = idx;
        else if (lower.includes('kỳ hạn')) colMap.termMonths = idx;
        else if (lower.includes('đáo hạn')) colMap.maturityDate = idx;
        else if (lower.includes('số lượng') || lower === 'sl') colMap.quantity = idx;
        else if (lower.includes('dòng tiền')) colMap.cashflow = idx;
        else if (lower.includes('cổ tức')) colMap.divCash = idx;
        else if (lower.includes('ghi chú')) colMap.note = idx;
      });
      headerFound = true;
      break;
    }
  }

  for (const row of rawRows) {
    if (!row || row.length === 0) continue;
    const nonEmpties = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonEmpties.length === 0) continue;
    if (isHeaderRow(row) || isSummaryRow(row)) continue;

    let colId: any = undefined;
    let colLevel = '';
    let colType = '';
    let colName = '';
    let colAmount: any = 0;
    let colCostPrice: any = 0;
    let colRate: any = 0;
    let colStartDate: any = '';
    let colTerm: any = 0;
    let colMaturityDate: any = '';
    let colQty: any = 1;
    let colCashflow: any = 0;
    let colDivCash: any = 0;
    let colNote = '';

    if (headerFound && (colMap.name !== undefined || colMap.amount !== undefined || colMap.costPrice !== undefined)) {
      colId = colMap.id !== undefined ? row[colMap.id] : undefined;
      colLevel = colMap.level !== undefined ? String(row[colMap.level] || '') : '';
      colType = colMap.type !== undefined ? String(row[colMap.type] || '') : '';
      colName = colMap.name !== undefined ? String(row[colMap.name] || '') : '';
      colAmount = colMap.amount !== undefined ? row[colMap.amount] : 0;
      colCostPrice = colMap.costPrice !== undefined ? row[colMap.costPrice] : 0;
      colRate = colMap.rate !== undefined ? row[colMap.rate] : 0;
      colStartDate = colMap.startDate !== undefined ? row[colMap.startDate] : '';
      colTerm = colMap.termMonths !== undefined ? row[colMap.termMonths] : 0;
      colMaturityDate = colMap.maturityDate !== undefined ? row[colMap.maturityDate] : '';
      colQty = colMap.quantity !== undefined ? row[colMap.quantity] : 1;
      colCashflow = colMap.cashflow !== undefined ? row[colMap.cashflow] : 0;
      colDivCash = colMap.divCash !== undefined ? row[colMap.divCash] : 0;
      colNote = colMap.note !== undefined ? String(row[colMap.note] || '') : '';
    } else {
      // Positional parsing fallback
      let cleanRow = [...row];
      // Check if col 0 is ID (e.g. "TS-123")
      if (String(cleanRow[0] || '').toLowerCase().startsWith('ts-') || (typeof cleanRow[0] === 'string' && /^ts-\d+/i.test(cleanRow[0]))) {
        colId = cleanRow.shift();
      }
      // Check if next col is STT
      if (typeof cleanRow[0] === 'number' && cleanRow.length >= 4) {
        cleanRow.shift();
      } else if (/^\d+$/.test(String(cleanRow[0]).trim()) && cleanRow.length >= 4 && String(cleanRow[0]).trim().length <= 3) {
        cleanRow.shift();
      }

      if (cleanRow.length >= 12) {
        colLevel = String(cleanRow[0] || '');
        colType = String(cleanRow[1] || '');
        colName = String(cleanRow[2] || '');
        colAmount = cleanRow[3];
        colCostPrice = cleanRow[4];
        colRate = cleanRow[5];
        colStartDate = cleanRow[6];
        colTerm = cleanRow[7];
        colMaturityDate = cleanRow[8];
        colQty = cleanRow[9];
        colCashflow = cleanRow[10];
        colDivCash = cleanRow[11];
        colNote = String(cleanRow[12] || '');
      } else if (cleanRow.length >= 4) {
        colLevel = String(cleanRow[0] || '');
        colType = String(cleanRow[1] || '');
        colName = String(cleanRow[2] || '');
        colAmount = cleanRow[3];
        colCostPrice = cleanRow[4];
        colNote = String(cleanRow[5] || '');
      } else if (cleanRow.length >= 2) {
        colName = String(cleanRow[0] || '');
        colAmount = cleanRow[1];
      }
    }

    const cleanName = colName.trim();
    let rawAmountNum = parseAmountValue(colAmount);
    let rawCostPriceNum = parseAmountValue(colCostPrice);

    // KEY IMPROVEMENT: Smart Fallback between Current Value and Cost Price
    if (rawAmountNum === 0 && rawCostPriceNum > 0) {
      rawAmountNum = rawCostPriceNum;
    } else if (rawCostPriceNum === 0 && rawAmountNum > 0) {
      rawCostPriceNum = rawAmountNum;
    }

    if (!cleanName && rawAmountNum <= 0) continue;
    if (cleanName.toLowerCase().includes('tổng cộng') || cleanName.toLowerCase().includes('tong cong')) continue;

    const parsedId = parseIdValue(colId);
    const level = parseLevelString(colLevel || colType || cleanName);
    const assetType = parseAssetTypeString(colType || colName, level);

    const rateNum = colRate ? parseRateValue(colRate) : 0;
    const qtyNum = colQty ? parseQuantityValue(colQty) : 1;
    const cashflowNum = colCashflow ? parseAmountValue(colCashflow) : 0;
    const divCashNum = colDivCash ? parseAmountValue(colDivCash) : 0;
    const colTermStr = String(colTerm || '').toLowerCase().trim();
    const isNoTerm =
      colTermStr.includes('không') ||
      colTermStr.includes('khong') ||
      colTermStr.includes('kkh') ||
      colTermStr.includes('linh hoạt') ||
      colTermStr === '0';
    const termNum = isNoTerm ? undefined : parseInt(colTermStr, 10) || undefined;
    const startDateVal = parseDateValue(colStartDate);
    let maturityVal = isNoTerm ? undefined : parseDateValue(colMaturityDate);
    if (!isNoTerm && (assetType === 'saving' || assetType === 'bond' || assetType === 'peer_lending') && startDateVal && termNum && termNum > 0) {
      maturityVal = calculateMaturityDateISO(startDateVal, termNum);
    }

    results.push({
      id: parsedId,
      level,
      type: assetType,
      typeName: getAssetTypeLabel(assetType),
      name: cleanName || `Tài sản ${results.length + 1}`,
      amount: rawAmountNum,
      costPrice: rawCostPriceNum,
      rate: rateNum > 0 ? rateNum : undefined,
      startDate: startDateVal || undefined,
      termMonths: termNum,
      maturityDate: maturityVal || undefined,
      quantity: qtyNum > 0 ? qtyNum : undefined,
      cashflow: cashflowNum > 0 ? cashflowNum : undefined,
      divCash: divCashNum > 0 ? divCashNum : undefined,
      note: colNote.trim() || undefined,
      isNoTerm: isNoTerm || undefined,
    });
  }

  return results;
};

// Parse Sheet 2: Debts & Cashflow
export const parseRawRowsToDebtsAndIncome = (rawRows: any[][]): { debts: ParsedDebtItem[]; salaryIncome: number; otherIncome: number } => {
  const debts: ParsedDebtItem[] = [];
  let salaryIncome = 0;
  let otherIncome = 0;

  const colMap: Record<string, number> = {};
  let headerFound = false;

  for (const row of rawRows) {
    if (!row || row.length === 0) continue;
    const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
    if (rowStr.includes('phân loại') && (rowStr.includes('nợ') || rowStr.includes('tên') || rowStr.includes('mã'))) {
      row.forEach((cell, idx) => {
        const lower = String(cell || '').toLowerCase().trim();
        if (lower.includes('mã id') || lower === 'id' || lower.includes('trống=thêm')) colMap.id = idx;
        else if (lower === 'stt' || lower === 'tt') colMap.stt = idx;
        else if (lower.includes('phân loại')) colMap.category = idx;
        else if (lower.includes('tên')) colMap.name = idx;
        else if (lower.includes('ngày vay') || lower.includes('bắt đầu') || lower.includes('giải ngân')) colMap.startDate = idx;
        else if (lower.includes('tổng nợ') || lower.includes('nợ gốc')) colMap.amount = idx;
        else if (lower.includes('đã trả')) colMap.paidPrincipal = idx;
        else if (lower.includes('kỳ hạn')) colMap.termMonths = idx;
        else if (lower.includes('kỳ chi trả') || lower.includes('chu kỳ')) colMap.frequency = idx;
        else if (lower.includes('ngày trả') || lower.includes('ngày chốt') || lower.includes('ngày đến hạn') || lower.includes('(1-31)')) colMap.day = idx;
        else if (lower.includes('trong ưu đãi') || lower.includes('tiền trả') || lower.includes('chi trả/kỳ') || lower.includes('chi trả mỗi kỳ') || (lower.includes('hàng tháng') && !lower.includes('ngày'))) colMap.monthlyBefore = idx;
        else if (lower.includes('lãi suất ưu đãi') || lower.includes('ưu đãi (%')) colMap.promoRate = idx;
        else if (lower.includes('thời hạn ưu đãi') || lower.includes('tháng ưu đãi')) colMap.promoMonths = idx;
        else if (lower.includes('hết ưu đãi')) colMap.promoEndDate = idx;
        else if (lower.includes('sau ưu đãi (%') || lower.includes('thả nổi')) colMap.normalRate = idx;
        else if (lower.includes('sau ưu đãi (vnđ') || lower.includes('tiền trả sau ưu đãi')) colMap.monthlyAfter = idx;
        else if (lower.includes('trạng thái')) colMap.status = idx;
        else if (lower.includes('ghi chú')) colMap.note = idx;
      });
      headerFound = true;
      break;
    }
  }

  for (const row of rawRows) {
    if (!row || row.length === 0) continue;
    const nonEmpties = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonEmpties.length === 0) continue;

    const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');

    // Check income rows in Section 1
    if (rowStr.includes('lương chủ động') || rowStr.includes('luong')) {
      const val = row.find((c, i) => i > 0 && parseAmountValue(c) > 0);
      if (val) salaryIncome = parseAmountValue(val);
      continue;
    }
    if (rowStr.includes('thu nhập thụ động') || rowStr.includes('thu nhập khác') || rowStr.includes('freelance')) {
      const val = row.find((c, i) => i > 0 && parseAmountValue(c) > 0);
      if (val) otherIncome = parseAmountValue(val);
      continue;
    }

    if (isHeaderRow(row) || isSummaryRow(row)) continue;

    let colId: any = undefined;
    let colCat = '';
    let colName = '';
    let colStartDate: any = '';
    let colAmount: any = 0;
    let colPaid: any = 0;
    let colTerm: any = 0;
    let colFreq = 'monthly';
    let colMonthlyBefore: any = 0;
    let colPromoRate: any = 0;
    let colPromoMonths: any = 0;
    let colPromoEndDate: any = '';
    let colNormalRate: any = 0;
    let colMonthlyAfter: any = 0;
    let colDay: any = 1;
    let colStatus = 'Chưa tất toán';
    let colNote = '';

    if (headerFound && (colMap.name !== undefined || colMap.amount !== undefined || colMap.monthlyBefore !== undefined)) {
      colId = colMap.id !== undefined ? row[colMap.id] : undefined;
      colCat = colMap.category !== undefined ? String(row[colMap.category] || '') : '';
      colName = colMap.name !== undefined ? String(row[colMap.name] || '') : '';
      colStartDate = colMap.startDate !== undefined ? row[colMap.startDate] : '';
      colAmount = colMap.amount !== undefined ? row[colMap.amount] : 0;
      colPaid = colMap.paidPrincipal !== undefined ? row[colMap.paidPrincipal] : 0;
      colTerm = colMap.termMonths !== undefined ? row[colMap.termMonths] : 0;
      colFreq = colMap.frequency !== undefined ? String(row[colMap.frequency] || '') : 'monthly';
      colMonthlyBefore = colMap.monthlyBefore !== undefined ? row[colMap.monthlyBefore] : 0;
      colPromoRate = colMap.promoRate !== undefined ? row[colMap.promoRate] : 0;
      colPromoMonths = colMap.promoMonths !== undefined ? row[colMap.promoMonths] : 0;
      colPromoEndDate = colMap.promoEndDate !== undefined ? row[colMap.promoEndDate] : '';
      colNormalRate = colMap.normalRate !== undefined ? row[colMap.normalRate] : 0;
      colMonthlyAfter = colMap.monthlyAfter !== undefined ? row[colMap.monthlyAfter] : colMonthlyBefore;
      colDay = colMap.day !== undefined ? row[colMap.day] : 1;
      colStatus = colMap.status !== undefined ? String(row[colMap.status] || 'Chưa tất toán') : 'Chưa tất toán';
      colNote = colMap.note !== undefined ? String(row[colMap.note] || '') : '';
    } else {
      let cleanRow = [...row];
      if (String(cleanRow[0] || '').toLowerCase().startsWith('no-') || (typeof cleanRow[0] === 'string' && /^no-\d+/i.test(cleanRow[0]))) {
        colId = cleanRow.shift();
      }
      if (typeof cleanRow[0] === 'number' && cleanRow.length >= 4) {
        cleanRow.shift();
      } else if (/^\d+$/.test(String(cleanRow[0]).trim()) && cleanRow.length >= 4 && String(cleanRow[0]).trim().length <= 3) {
        cleanRow.shift();
      }

      if (cleanRow.length >= 15) {
        colCat = String(cleanRow[0] || '');
        colName = String(cleanRow[1] || '');
        colStartDate = cleanRow[2];
        colAmount = cleanRow[3];
        colPaid = cleanRow[4];
        colTerm = cleanRow[5];
        colFreq = String(cleanRow[6] || 'monthly');
        colMonthlyBefore = cleanRow[7];
        colPromoRate = cleanRow[8];
        colPromoMonths = cleanRow[9];
        colPromoEndDate = cleanRow[10];
        colNormalRate = cleanRow[11];
        colMonthlyAfter = cleanRow[12];
        colDay = cleanRow[13];
        colStatus = String(cleanRow[14] || 'Chưa tất toán');
        colNote = String(cleanRow[15] || '');
      } else if (cleanRow.length >= 4) {
        colCat = String(cleanRow[0] || '');
        colName = String(cleanRow[1] || '');
        colAmount = cleanRow[2];
        colMonthlyBefore = cleanRow[3];
        colMonthlyAfter = cleanRow[3];
      } else if (cleanRow.length >= 2) {
        colName = String(cleanRow[0] || '');
        colAmount = cleanRow[1];
      }
    }

    const cleanName = colName.trim();
    const amountNum = parseAmountValue(colAmount);
    const monthlyBeforeNum = parseAmountValue(colMonthlyBefore);
    const monthlyAfterNum = colMonthlyAfter ? parseAmountValue(colMonthlyAfter) : monthlyBeforeNum;

    if (!cleanName && amountNum <= 0 && monthlyBeforeNum <= 0) continue;
    if (cleanName.toLowerCase().includes('tổng cộng') || cleanName.toLowerCase().includes('tổng nợ')) continue;

    const parsedId = parseIdValue(colId);
    const category = parseDebtCategoryString(colCat || cleanName);
    const paidNum = parseAmountValue(colPaid);
    const colTermStr = String(colTerm || '').toLowerCase().trim();
    const colFreqStr = String(colFreq || '').toLowerCase().trim();
    const colNoteStr = String(colNote || '').toLowerCase().trim();

    // Nhận diện khoản không kỳ hạn
    const isNoTerm =
      category === 'type_free' ||
      colFreqStr.includes('linh hoạt') ||
      colFreqStr.includes('không kỳ hạn') ||
      colFreqStr.includes('khong ky han') ||
      colTermStr.includes('không') ||
      colTermStr.includes('khong') ||
      colTermStr.includes('kkh') ||
      colTermStr === '0' ||
      (category === 'type2' && (!colTerm || colTerm === '0' || colTerm === 0)) ||
      colNoteStr.includes('khi nào có') ||
      colNoteStr.includes('khi nao co') ||
      colNoteStr.includes('không kỳ hạn') ||
      colNoteStr.includes('khong ky han');

    let freq: 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'flexible' = isNoTerm ? 'flexible' : 'monthly';
    if (!isNoTerm) {
      if (colFreqStr.includes('quý')) freq = 'quarterly';
      else if (colFreqStr.includes('6 tháng') || colFreqStr.includes('nửa năm')) freq = 'biannual';
      else if (colFreqStr.includes('năm')) freq = 'annual';
    }

    const termNum = isNoTerm ? undefined : (parseInt(colTermStr, 10) || undefined);
    const pRate = parseRateValue(colPromoRate);
    const nRate = parseRateValue(colNormalRate);
    const pMonths = parseInt(String(colPromoMonths || 0), 10) || undefined;
    // Đã không có kỳ hạn thì không có ngày đến hạn (day = undefined)
    const dayNum = isNoTerm ? undefined : (colDay ? parseInt(String(colDay), 10) || 20 : 20);
    const statusVal: 'Chưa tất toán' | 'Đã tất toán' =
      String(colStatus).toLowerCase().includes('đã') ? 'Đã tất toán' : 'Chưa tất toán';

    const startDateVal = parseDateValue(colStartDate);
    let promoEndDateVal = parseDateValue(colPromoEndDate);
    if (category === 'type1' && startDateVal && pMonths && pMonths > 0) {
      promoEndDateVal = calculateMaturityDateISO(startDateVal, pMonths);
    }

    // Tự động sửa lỗi 1đ do cột Excel map nhầm
    let finalMonthlyBefore = isNoTerm ? 0 : monthlyBeforeNum;
    let finalMonthlyAfter = isNoTerm ? 0 : monthlyAfterNum;
    if (!isNoTerm && finalMonthlyBefore === 1 && amountNum > 1000) {
      if (category === 'type3' || category === 'type4') {
        finalMonthlyBefore = amountNum;
        finalMonthlyAfter = amountNum;
      } else if (category === 'type1') {
        const pPart = termNum ? Math.round(amountNum / termNum) : 0;
        const pInt = pRate ? Math.round((amountNum * (pRate / 100)) / 12) : 0;
        finalMonthlyBefore = pPart + pInt > 0 ? pPart + pInt : amountNum;
      } else if (category === 'type2') {
        finalMonthlyBefore = termNum && termNum > 1 ? Math.round(amountNum / termNum) : 0;
        finalMonthlyAfter = finalMonthlyBefore;
      }
    }

    // Đối với chi phí định kỳ/sinh hoạt, nếu amountNum = 0 nhưng finalMonthlyBefore > 0
    let finalAmount = amountNum;
    if ((category === 'type3' || category === 'type4') && finalAmount <= 0 && finalMonthlyBefore > 0) {
      finalAmount = finalMonthlyBefore;
    }

    debts.push({
      id: parsedId,
      category,
      categoryName: getDebtCategoryLabel(category),
      name: cleanName || `Khoản nợ ${debts.length + 1}`,
      frequency: freq,
      startDate: startDateVal || undefined,
      amount: finalAmount,
      paidPrincipal: paidNum,
      termMonths: termNum,
      promoRate: pRate > 0 ? pRate : undefined,
      normalRate: nRate > 0 ? nRate : undefined,
      promoMonths: pMonths,
      promoEndDate: promoEndDateVal || undefined,
      monthlyBefore: finalMonthlyBefore,
      monthlyAfter: finalMonthlyAfter,
      installmentAmount: category === 'type2' && !isNoTerm ? (finalMonthlyBefore > 0 ? finalMonthlyBefore : (termNum && termNum > 0 ? Math.round(finalAmount / termNum) : undefined)) : undefined,
      periodicAmount: (category === 'type3' || category === 'type4') ? (finalMonthlyBefore > 0 ? finalMonthlyBefore : finalAmount) : undefined,
      day: dayNum,
      status: statusVal,
      note: colNote.trim() || undefined,
      isNoTerm: isNoTerm ? true : undefined,
    });
  }

  return { debts, salaryIncome, otherIncome };
};

// Parse Sheet 3: Goals
export const parseRawRowsToGoals = (rawRows: any[][]): ParsedGoalItem[] => {
  const goals: ParsedGoalItem[] = [];

  const colMap: Record<string, number> = {};
  let headerFound = false;

  for (const row of rawRows) {
    if (!row || row.length === 0) continue;
    const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
    if (rowStr.includes('mục tiêu') && (rowStr.includes('nhóm') || rowStr.includes('tên') || rowStr.includes('mã'))) {
      row.forEach((cell, idx) => {
        const lower = String(cell || '').toLowerCase().trim();
        if (lower.includes('mã id') || lower === 'id' || lower.includes('trống=thêm')) colMap.id = idx;
        else if (lower === 'stt' || lower === 'tt') colMap.stt = idx;
        else if (lower.includes('nhóm')) colMap.group = idx;
        else if (lower.includes('tên')) colMap.name = idx;
        else if (lower.includes('loại')) colMap.goalType = idx;
        else if (lower.includes('kênh')) colMap.assetType = idx;
        else if (lower.includes('chu kỳ')) colMap.freqMonths = idx;
        else if (lower.includes('ngày chốt') || lower.includes('ngày mua')) colMap.day = idx;
        else if (lower.includes('định mức')) colMap.targetQty = idx;
        else if (lower.includes('đơn vị')) colMap.unit = idx;
        else if (lower.includes('tiền nạp') || lower.includes('mỗi kỳ')) colMap.targetAmountPerPeriod = idx;
        else if (lower.includes('đã tích lũy')) colMap.totalBought = idx;
        else if (lower.includes('nợ chỉ tiêu') || lower.includes('chưa mua')) colMap.backlogQty = idx;
        else if (lower.includes('liên kết') || lower.includes('ngân hàng liên kết') || lower.includes('tài sản liên kết') || lower === 'link' || lower.includes('link')) colMap.link = idx;
        else if (lower.includes('tổng tiền') || lower.includes('mục tiêu (vnđ)')) colMap.target = idx;
        else if (lower.includes('thời hạn') || lower.includes('năm')) colMap.years = idx;
        else if (lower.includes('trạng thái')) colMap.status = idx;
        else if (lower.includes('ghi chú') || lower.includes('chiến lược')) colMap.note = idx;
      });
      headerFound = true;
      break;
    }
  }

  for (const row of rawRows) {
    if (!row || row.length === 0) continue;
    const nonEmpties = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonEmpties.length === 0) continue;
    if (isHeaderRow(row) || isSummaryRow(row)) continue;

    let colId: any = undefined;
    let colGroup = '';
    let colName = '';
    let colType = 'DCA';
    let colAssetType = '';
    let colFreqMonths: any = 1;
    let colDay: any = 1;
    let colTargetQty: any = 0;
    let colUnit = 'VNĐ';
    let colPeriodAmount: any = 0;
    let colAccum: any = 0;
    let colBacklog: any = 0;
    let colLink: any = '';
    let colTarget: any = 0;
    let colYears: any = 1;
    let colStatus = 'active';
    let colNote = '';

    if (headerFound && (colMap.name !== undefined || colMap.target !== undefined || colMap.targetQty !== undefined)) {
      colId = colMap.id !== undefined ? row[colMap.id] : undefined;
      colGroup = colMap.group !== undefined ? String(row[colMap.group] || '') : '';
      colName = colMap.name !== undefined ? String(row[colMap.name] || '') : '';
      colType = colMap.goalType !== undefined ? String(row[colMap.goalType] || 'DCA') : 'DCA';
      colAssetType = colMap.assetType !== undefined ? String(row[colMap.assetType] || '') : '';
      colFreqMonths = colMap.freqMonths !== undefined ? row[colMap.freqMonths] : 1;
      colDay = colMap.day !== undefined ? row[colMap.day] : 1;
      colTargetQty = colMap.targetQty !== undefined ? row[colMap.targetQty] : 0;
      colUnit = colMap.unit !== undefined ? String(row[colMap.unit] || 'VNĐ') : 'VNĐ';
      colPeriodAmount = colMap.targetAmountPerPeriod !== undefined ? row[colMap.targetAmountPerPeriod] : 0;
      colAccum = colMap.totalBought !== undefined ? row[colMap.totalBought] : 0;
      colBacklog = colMap.backlogQty !== undefined ? row[colMap.backlogQty] : 0;
      colLink = colMap.link !== undefined ? row[colMap.link] : '';
      colTarget = colMap.target !== undefined ? row[colMap.target] : 0;
      colYears = colMap.years !== undefined ? row[colMap.years] : 1;
      colStatus = colMap.status !== undefined ? String(row[colMap.status] || 'active') : 'active';
      colNote = colMap.note !== undefined ? String(row[colMap.note] || '') : '';
    } else {
      let cleanRow = [...row];
      if (String(cleanRow[0] || '').toLowerCase().startsWith('mt-') || (typeof cleanRow[0] === 'string' && /^mt-\d+/i.test(cleanRow[0]))) {
        colId = cleanRow.shift();
      }
      if (typeof cleanRow[0] === 'number' && cleanRow.length >= 4) {
        cleanRow.shift();
      } else if (/^\d+$/.test(String(cleanRow[0]).trim()) && cleanRow.length >= 4 && String(cleanRow[0]).trim().length <= 3) {
        cleanRow.shift();
      }

      if (cleanRow.length >= 15) {
        colGroup = String(cleanRow[0] || '');
        colName = String(cleanRow[1] || '');
        colType = String(cleanRow[2] || 'DCA');
        colAssetType = String(cleanRow[3] || '');
        colFreqMonths = cleanRow[4];
        colDay = cleanRow[5];
        colTargetQty = cleanRow[6];
        colUnit = String(cleanRow[7] || 'VNĐ');
        colPeriodAmount = cleanRow[8];
        colAccum = cleanRow[9];
        colBacklog = cleanRow[10];
        colLink = cleanRow[11];
        colTarget = cleanRow[12];
        colYears = cleanRow[13];
        colStatus = String(cleanRow[14] || 'active');
        colNote = String(cleanRow[15] || '');
      } else if (cleanRow.length >= 14) {
        colGroup = String(cleanRow[0] || '');
        colName = String(cleanRow[1] || '');
        colType = String(cleanRow[2] || 'DCA');
        colAssetType = String(cleanRow[3] || '');
        colFreqMonths = cleanRow[4];
        colDay = cleanRow[5];
        colTargetQty = cleanRow[6];
        colUnit = String(cleanRow[7] || 'VNĐ');
        colPeriodAmount = cleanRow[8];
        colAccum = cleanRow[9];
        colBacklog = cleanRow[10];
        colTarget = cleanRow[11];
        colYears = cleanRow[12];
        colStatus = String(cleanRow[13] || 'active');
        colNote = String(cleanRow[14] || '');
      } else if (cleanRow.length >= 4) {
        colGroup = String(cleanRow[0] || '');
        colName = String(cleanRow[1] || '');
        colTarget = cleanRow[2];
        colNote = String(cleanRow[3] || '');
      } else if (cleanRow.length >= 2) {
        colName = String(cleanRow[0] || '');
        colTarget = cleanRow[1];
      }
    }

    const cleanName = colName.trim();
    const targetQtyNum = parseQuantityValue(colTargetQty);
    const targetNum = parseAmountValue(colTarget);
    const periodAmtNum = parseAmountValue(colPeriodAmount);
    const accumNum = parseQuantityValue(colAccum);
    const backlogNum = parseQuantityValue(colBacklog);

    if (!cleanName && targetQtyNum <= 0 && targetNum <= 0 && periodAmtNum <= 0) continue;
    if (cleanName.toLowerCase().includes('tổng cộng')) continue;

    const parsedId = parseIdValue(colId);
    const group = parseGoalGroupString(colGroup || cleanName);
    const isDCA = String(colType).toLowerCase().includes('dca') || group === 'dca';
    const yearsNum = parseInt(String(colYears || 1), 10) || 1;
    const freqNum = parseInt(String(colFreqMonths || 1), 10) || 1;
    const dayNum = parseInt(String(colDay || 1), 10) || 1;

    let parsedAssetType: 'stock' | 'gold' | 'saving' | 'cash' | 'other' | undefined;
    if (group === 'debt') {
      parsedAssetType = undefined;
    } else if (colAssetType) {
      const lowerAsset = colAssetType.toLowerCase().trim();
      if (lowerAsset.includes('cổ phiếu') || lowerAsset.includes('stock') || lowerAsset.includes('chứng khoán') || /\bcp\b/i.test(lowerAsset)) {
        parsedAssetType = 'stock';
      } else if (lowerAsset.includes('vàng') || lowerAsset.includes('gold') || lowerAsset.includes('sjc')) {
        parsedAssetType = 'gold';
      } else if (lowerAsset.includes('tiết kiệm') || lowerAsset.includes('saving') || lowerAsset.includes('sổ')) {
        parsedAssetType = 'saving';
      } else if (lowerAsset.includes('tiền mặt') || lowerAsset.includes('cash') || lowerAsset.includes('ngân hàng')) {
        parsedAssetType = 'cash';
      } else {
        parsedAssetType = 'other';
      }
    } else {
      const lowerName = cleanName.toLowerCase();
      const upperUnit = String(colUnit || '').toUpperCase().trim();
      if (upperUnit === 'CP' || lowerName.includes('cổ phiếu') || lowerName.includes('chứng khoán')) {
        parsedAssetType = 'stock';
      } else if (upperUnit.includes('CHỈ') || upperUnit.includes('LƯỢNG') || upperUnit.includes('CÂY') || lowerName.includes('vàng') || lowerName.includes('gold')) {
        parsedAssetType = 'gold';
      } else if (lowerName.includes('tiết kiệm') || lowerName.includes('sổ')) {
        parsedAssetType = 'saving';
      } else if (lowerName.includes('tiền mặt')) {
        parsedAssetType = 'cash';
      }
    }

    let parsedLinkedAssetId: number | undefined = undefined;
    let parsedLinkedBankKey: string | undefined = undefined;
    let parsedLinkedDebtId: number | undefined = undefined;

    const linkStr = String(colLink || '').trim();
    if (linkStr) {
      const tsMatch = linkStr.match(/^TS-(\d+)/i) || linkStr.match(/TS-(\d+)/i);
      const noMatch = linkStr.match(/^NO-(\d+)/i) || linkStr.match(/NO-(\d+)/i);
      const bankMatch = linkStr.match(/(?:bank|ngân hàng|nh)[:\s]+([a-zA-Z0-9_-]+)/i);

      if (tsMatch) {
        parsedLinkedAssetId = parseInt(tsMatch[1], 10);
      } else if (noMatch) {
        parsedLinkedDebtId = parseInt(noMatch[1], 10);
      } else if (bankMatch) {
        parsedLinkedBankKey = bankMatch[1].toLowerCase();
      } else if (/^\d+$/.test(linkStr)) {
        parsedLinkedAssetId = parseInt(linkStr, 10);
      } else {
        const lowerLink = linkStr.toLowerCase();
        const commonBanks = ['vcb', 'vietcombank', 'tcb', 'techcombank', 'bidv', 'mbb', 'mbbank', 'vpb', 'vpbank', 'ctg', 'vietinbank', 'acb', 'stb', 'sacombank', 'tpbank', 'shb', 'hdbank', 'msb', 'vib', 'ocb', 'ncb', 'scb', 'bacabank', 'vietbank', 'abbank', 'pvcombank', 'baovietbank', 'pgbank', 'kienlongbank', 'saigonbank', 'coopbank', 'nama'];
        const foundBank = commonBanks.find((b) => lowerLink.includes(b));
        if (foundBank) {
          parsedLinkedBankKey = foundBank;
        }
      }
    }

    // Auto-detect bank key if assetType is saving and still empty
    if (!parsedLinkedAssetId && !parsedLinkedBankKey && (parsedAssetType === 'saving' || (group === 'dca' && cleanName.toLowerCase().includes('tiết kiệm')))) {
      const lowerName = cleanName.toLowerCase();
      const commonBanks = ['vcb', 'vietcombank', 'tcb', 'techcombank', 'bidv', 'mbb', 'mbbank', 'vpb', 'vpbank', 'ctg', 'vietinbank', 'acb', 'stb', 'sacombank', 'tpbank', 'shb', 'hdbank', 'msb', 'vib', 'ocb', 'ncb', 'scb', 'bacabank', 'vietbank', 'abbank', 'pvcombank', 'baovietbank', 'pgbank', 'kienlongbank', 'saigonbank', 'coopbank', 'nama'];
      const foundBank = commonBanks.find((b) => lowerName.includes(b));
      if (foundBank) {
        parsedLinkedBankKey = foundBank;
      }
    }

    const statusClean: 'active' | 'completed' | 'pending' =
      String(colStatus).toLowerCase().includes('completed') || String(colStatus).toLowerCase().includes('hoàn thành')
        ? 'completed'
        : String(colStatus).toLowerCase().includes('pending') || String(colStatus).toLowerCase().includes('tạm dừng')
        ? 'pending'
        : 'active';

    goals.push({
      id: parsedId,
      group,
      groupName: getGoalGroupLabel(group),
      name: cleanName || `Mục tiêu ${goals.length + 1}`,
      goalType: isDCA ? 'dca' : 'milestone',
      assetType: parsedAssetType,
      linkedAssetId: parsedLinkedAssetId,
      linkedBankKey: parsedLinkedBankKey,
      linkedDebtId: parsedLinkedDebtId,
      freqMonths: freqNum,
      day: dayNum,
      targetQty: targetQtyNum > 0 ? targetQtyNum : undefined,
      targetAmountPerPeriod: periodAmtNum > 0 ? periodAmtNum : undefined,
      unit: colUnit.trim() || (isDCA ? 'CP' : 'VNĐ'),
      totalBought: accumNum > 0 ? accumNum : undefined,
      backlogQty: backlogNum > 0 ? backlogNum : undefined,
      target: targetNum > 0 ? targetNum : undefined,
      years: yearsNum,
      status: statusClean,
      note: colNote.trim() || undefined,
    });
  }

  return goals;
};

// Parse Sheet 4: Transaction History (Lịch sử tích sản, mua gom, nạp/rút)
export const parseRawRowsToTransactions = (rawRows: any[][]): AssetTransaction[] => {
  const transactions: AssetTransaction[] = [];
  const colMap: Record<string, number> = {};
  let headerFound = false;

  for (const row of rawRows) {
    if (!row || row.length === 0) continue;
    const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
    if (
      (rowStr.includes('giao dịch') || rowStr.includes('tích sản') || rowStr.includes('biến động')) &&
      (rowStr.includes('ngày') || rowStr.includes('thành tiền') || rowStr.includes('số lượng') || rowStr.includes('đơn giá'))
    ) {
      row.forEach((cell, idx) => {
        const lower = String(cell || '').toLowerCase().trim();
        if (lower.includes('mã id') || lower === 'id' || lower.includes('mã gd')) colMap.id = idx;
        else if (lower === 'stt' || lower === 'tt') colMap.stt = idx;
        else if (lower.includes('mã id tài sản') || (lower.includes('tài sản') && lower.includes('ts-'))) colMap.assetId = idx;
        else if (lower.includes('tên') || lower.includes('danh mục')) colMap.assetName = idx;
        else if (lower.includes('ngày')) colMap.date = idx;
        else if (lower.includes('loại')) colMap.type = idx;
        else if (lower.includes('số lượng') || lower.includes('khối lượng') || lower === 'sl') colMap.quantity = idx;
        else if (lower.includes('đơn vị') || lower === 'đvt') colMap.unit = idx;
        else if (lower.includes('đơn giá') || lower.includes('giá mua')) colMap.pricePerUnit = idx;
        else if (lower.includes('thành tiền') || lower.includes('tổng tiền') || lower.includes('giá trị')) colMap.totalAmount = idx;
        else if (lower.includes('ghi chú')) colMap.note = idx;
      });
      headerFound = true;
      break;
    }
  }

  for (const row of rawRows) {
    if (!row || row.length === 0) continue;
    const nonEmpties = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonEmpties.length === 0) continue;
    if (isHeaderRow(row) || isSummaryRow(row)) continue;

    let colId: any = undefined;
    let colAssetId: any = undefined;
    let colAssetName = '';
    let colDate: any = '';
    let colType = 'buy';
    let colQty: any = 0;
    let colUnit = '';
    let colPrice: any = 0;
    let colTotal: any = 0;
    let colNote = '';

    if (headerFound && (colMap.date !== undefined || colMap.totalAmount !== undefined || colMap.assetName !== undefined)) {
      colId = colMap.id !== undefined ? row[colMap.id] : undefined;
      colAssetId = colMap.assetId !== undefined ? row[colMap.assetId] : undefined;
      colAssetName = colMap.assetName !== undefined ? String(row[colMap.assetName] || '') : '';
      colDate = colMap.date !== undefined ? row[colMap.date] : '';
      colType = colMap.type !== undefined ? String(row[colMap.type] || '') : 'buy';
      colQty = colMap.quantity !== undefined ? row[colMap.quantity] : 0;
      colUnit = colMap.unit !== undefined ? String(row[colMap.unit] || '') : '';
      colPrice = colMap.pricePerUnit !== undefined ? row[colMap.pricePerUnit] : 0;
      colTotal = colMap.totalAmount !== undefined ? row[colMap.totalAmount] : 0;
      colNote = colMap.note !== undefined ? String(row[colMap.note] || '') : '';
    } else {
      let cleanRow = [...row];
      if (typeof cleanRow[0] === 'string' && /^(gd|tx)-\w+/i.test(cleanRow[0])) {
        colId = cleanRow.shift();
      }
      if (typeof cleanRow[0] === 'number' && cleanRow.length >= 4) {
        cleanRow.shift();
      }
      if (cleanRow.length >= 8) {
        colAssetId = cleanRow[0];
        colAssetName = String(cleanRow[1] || '');
        colDate = cleanRow[2];
        colType = String(cleanRow[3] || 'buy');
        colQty = cleanRow[4];
        colUnit = String(cleanRow[5] || '');
        colPrice = cleanRow[6];
        colTotal = cleanRow[7];
        colNote = String(cleanRow[8] || '');
      }
    }

    const qtyNum = parseQuantityValue(colQty);
    const priceNum = parseAmountValue(colPrice);
    let totalNum = parseAmountValue(colTotal);
    if (totalNum === 0 && qtyNum > 0 && priceNum > 0) {
      totalNum = Math.round(qtyNum * priceNum);
    }
    if (totalNum <= 0 && qtyNum <= 0) continue;

    const parsedAssetId = parseIdValue(colAssetId);
    const cleanDate = parseDateValue(colDate) || new Date().toISOString().split('T')[0];

    let txType: 'buy' | 'deposit' | 'sell' | 'withdraw' = 'buy';
    const lowerType = String(colType).toLowerCase();
    if (lowerType.includes('bán') || lowerType.includes('sell')) txType = 'sell';
    else if (lowerType.includes('nạp') || lowerType.includes('deposit')) txType = 'deposit';
    else if (lowerType.includes('rút') || lowerType.includes('withdraw')) txType = 'withdraw';

    const txId = colId ? String(colId).trim() : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    transactions.push({
      id: txId,
      assetId: parsedAssetId,
      assetName: colAssetName.trim() || undefined,
      date: cleanDate,
      type: txType,
      quantity: qtyNum > 0 ? qtyNum : undefined,
      unit: colUnit.trim() || undefined,
      pricePerUnit: priceNum > 0 ? priceNum : undefined,
      totalAmount: totalNum,
      note: colNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
  }

  return transactions;
};

// =========================================================================
// 4. BỘ PHÂN TÍCH TOÀN BỘ FILE EXCEL UPLOAD
// =========================================================================
export const parseExcelFile = async (file: File): Promise<ParsedFullDatabase> => {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const result: ParsedFullDatabase = {
    assets: [],
    debts: [],
    goals: [],
    transactions: [],
    salaryIncome: 0,
    otherIncome: 0,
  };

  if (!wb.SheetNames || wb.SheetNames.length === 0) return result;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (!rawData || rawData.length === 0) continue;

    const lowerName = sheetName.toLowerCase().trim();

    if (lowerName.includes('tai_san') || lowerName.includes('tài sản') || lowerName.includes('asset') || lowerName === 'sheet1') {
      const parsed = parseRawRowsToAssets(rawData);
      if (parsed.length > 0) {
        result.assets.push(...parsed);
      }
    } else if (lowerName.includes('dong_tien') || lowerName.includes('dòng tiền') || lowerName.includes('no') || lowerName.includes('nợ') || lowerName.includes('debt') || lowerName.includes('cashflow')) {
      const parsed = parseRawRowsToDebtsAndIncome(rawData);
      if (parsed.debts.length > 0) result.debts.push(...parsed.debts);
      if (parsed.salaryIncome > 0) result.salaryIncome = parsed.salaryIncome;
      if (parsed.otherIncome > 0) result.otherIncome = parsed.otherIncome;
    } else if (lowerName.includes('muc_tieu') || lowerName.includes('mục tiêu') || lowerName.includes('goal')) {
      const parsed = parseRawRowsToGoals(rawData);
      if (parsed.length > 0) result.goals.push(...parsed);
    } else if (lowerName.includes('lich_su') || lowerName.includes('giao_dich') || lowerName.includes('giao dịch') || lowerName.includes('transaction') || lowerName.includes('history')) {
      const parsed = parseRawRowsToTransactions(rawData);
      if (parsed.length > 0) {
        if (!result.transactions) result.transactions = [];
        result.transactions.push(...parsed);
      }
    } else {
      // Fallback if single generic sheet
      if (wb.SheetNames.length === 1) {
        const parsedAssets = parseRawRowsToAssets(rawData);
        if (parsedAssets.length > 0) result.assets.push(...parsedAssets);

        const parsedDebts = parseRawRowsToDebtsAndIncome(rawData);
        if (parsedDebts.debts.length > 0) result.debts.push(...parsedDebts.debts);
        if (parsedDebts.salaryIncome > 0) result.salaryIncome = parsedDebts.salaryIncome;
        if (parsedDebts.otherIncome > 0) result.otherIncome = parsedDebts.otherIncome;

        const parsedGoals = parseRawRowsToGoals(rawData);
        if (parsedGoals.length > 0) result.goals.push(...parsedGoals);

        const parsedTx = parseRawRowsToTransactions(rawData);
        if (parsedTx.length > 0) {
          if (!result.transactions) result.transactions = [];
          result.transactions.push(...parsedTx);
        }
      }
    }
  }

  // Fallback: If no assets found, parse sheet 0 as assets
  if (result.assets.length === 0 && wb.SheetNames[0]) {
    const ws0 = wb.Sheets[wb.SheetNames[0]];
    const rawData0 = XLSX.utils.sheet_to_json<any[]>(ws0, { header: 1 });
    result.assets = parseRawRowsToAssets(rawData0);
  }

  return result;
};
