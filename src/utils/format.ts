import {
  DatabaseState,
  HistoryPoint,
  Debt,
  MonthlyDebtPayment,
  MonthlyObligationRecord,
} from '../types';

/**
 * Parse số thập phân linh hoạt, hỗ trợ cả định dạng Việt Nam (phẩy/chấm) và Quốc tế
 * Ví dụ: "1,5", "1.5", "0.5", "1.000.000", "1,234.5", "8.650.000"
 */
export function parseFormattedDecimal(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = val.toString().trim();
  if (!str) return 0;

  // Chuỗi chứa cả . và , (VD: 1.234,56 hoặc 1,234.56)
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Kiểu VN: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Kiểu US: 1,234.56
      str = str.replace(/,/g, '');
    }
    const res = parseFloat(str);
    return isNaN(res) ? 0 : res;
  }

  // Chuỗi chỉ chứa dấu phẩy (VD: "1,5", "43,5", "0,25" hoặc "1,000,000")
  if (str.includes(',')) {
    const parts = str.split(',');
    // Nếu chỉ có 1 dấu phẩy VÀ phần sau chỉ có 1 hoặc 2 chữ số (như 1,5, 43,5, 0,25) -> số thập phân chuẩn tiếng Việt
    if (parts.length === 2 && (parts[1].length === 1 || parts[1].length === 2)) {
      str = str.replace(',', '.');
      const res = parseFloat(str);
      return isNaN(res) ? 0 : res;
    }
    // Nếu parts[1].length >= 3 hoặc nhiều dấu phẩy -> dấu phân cách hàng nghìn (kiểu US "1,000,000" hoặc "1,467")
    const clean = str.replace(/,/g, '');
    const res = parseFloat(clean);
    return isNaN(res) ? 0 : res;
  }

  // Chuỗi chỉ chứa dấu chấm (VD: "1.5" hoặc "1.000.000" hoặc "10.000")
  if (str.includes('.')) {
    const parts = str.split('.');
    // Nếu chỉ có 1 dấu chấm VÀ phần sau chỉ có 1 hoặc 2 chữ số (như 1.5, 0.5, 12.25) -> số thập phân (gõ từ numpad)
    if (parts.length === 2 && (parts[1].length === 1 || parts[1].length === 2)) {
      const res = parseFloat(str);
      return isNaN(res) ? 0 : res;
    }
    // Ngược lại, TẤT CẢ các dấu chấm đều là dấu phân cách hàng nghìn (VD: "1.000", "10.000", "1.000.000", hoặc đang gõ "1.4670")
    const clean = str.replace(/\./g, '');
    const res = parseFloat(clean);
    return isNaN(res) ? 0 : res;
  }

  const clean = str.replace(/[^0-9.-]/g, '');
  const res = parseFloat(clean);
  return isNaN(res) ? 0 : res;
}

export function parseFormattedNumber(val: any): number {
  return parseFormattedDecimal(val);
}

export function formatNumberString(val: any, allowDecimal: boolean = true): string {
  if (val === undefined || val === null || val === '') return '';

  // Chế độ số nguyên thuần (tiền tệ VNĐ, đơn giá VNĐ, nợ, lương): loại bỏ mọi ký tự không phải số
  if (!allowDecimal) {
    const raw = val.toString().trim();
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const clean = digits.replace(/^0+(?=\d)/, ''); // Giữ lại đúng 1 số '0' nếu là '0'
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // Chế độ cho phép số thập phân (số lượng chỉ vàng, CP, DCA lẻ)
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    if (Number.isInteger(val)) {
      return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    const str = Number(val.toFixed(4)).toString();
    const parts = str.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decPart = parts[1];
    return decPart !== undefined ? `${intPart},${decPart}` : intPart;
  }

  const rawStr = val.toString().trim();
  if (!rawStr) return '';

  // Người dùng đang gõ dấu phẩy hoặc chấm ở cuối (VD: "43," hoặc "43.")
  if (rawStr.endsWith(',') || rawStr.endsWith('.')) {
    const intPart = rawStr.slice(0, -1).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '0';
    return `${intFmt},`;
  }

  // Có dấu phẩy thập phân (chuẩn VN: "43,5")
  if (rawStr.includes(',')) {
    const [intPart, ...decParts] = rawStr.split(',');
    const decPart = decParts.join('').replace(/\D/g, '').slice(0, 4);
    const intDigits = intPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const intFmt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '0';
    return decPart ? `${intFmt},${decPart}` : intFmt;
  }

  // Có dấu chấm (từ bàn phím số numpad gõ "43.5")
  if (rawStr.includes('.')) {
    const parts = rawStr.split('.');
    if (parts.length === 2 && (parts[1].length === 1 || parts[1].length === 2)) {
      const intDigits = parts[0].replace(/\D/g, '').replace(/^0+(?=\d)/, '');
      const intFmt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '0';
      const decPart = parts[1].replace(/\D/g, '').slice(0, 4);
      return decPart ? `${intFmt},${decPart}` : intFmt;
    }
    // Ngược lại các dấu chấm là phân cách nghìn (VD: "1.000", hoặc đang gõ "1.0000")
    const digits = rawStr.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  }

  // Số nguyên thông thường
  const digits = rawStr.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

export function formatVND(val: number | undefined | null, isPrivacyMode: boolean = false): string {
  if (isPrivacyMode) return '•••••• ₫';
  const num = val || 0;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

// Helper chuyển đổi số Serial Date của Excel (ví dụ 45847 -> 09/07/2025)
export function excelSerialToDate(serial: number): Date {
  // Excel base: 1899-12-30 (due to 1900 leap year bug in Lotus/Excel)
  const wholeDays = Math.floor(serial);
  const fractionalDay = serial - wholeDays;
  const utcMillis = Math.round((wholeDays - 25569) * 86400 * 1000 + fractionalDay * 86400 * 1000);
  return new Date(utcMillis);
}

// Hàm chuẩn hóa chuỗi ngày tháng, nhận diện và sửa lỗi số Serial Date của Excel
export function normalizeDateStr(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    // SheetJS reads Excel dates into Date objects as UTC midnight (00:00:00.000Z).
    // Using local getFullYear()/getDate() in environments behind UTC drops 1 day (e.g. July 9 becomes July 8).
    // Reading UTC components preserves the exact calendar date entered in Excel.
    let y = val.getUTCFullYear();
    let m = String(val.getUTCMonth() + 1).padStart(2, '0');
    let d = String(val.getUTCDate()).padStart(2, '0');

    // If it was created explicitly as local midnight (hours=0, minutes=0, but non-zero UTC hours)
    if (val.getHours() === 0 && val.getMinutes() === 0 && val.getUTCHours() !== 0) {
      y = val.getFullYear();
      m = String(val.getMonth() + 1).padStart(2, '0');
      d = String(val.getDate()).padStart(2, '0');
    }
    return `${y}-${m}-${d}`;
  }

  // Nếu là số nguyên hoặc chuỗi số thuần túy dạng Excel serial (từ 25000 đến 90000)
  if (typeof val === 'number' && val >= 25000 && val <= 90000) {
    const dObj = excelSerialToDate(val);
    const y = dObj.getUTCFullYear();
    const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dObj.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(val).trim();
  if (!str) return '';

  // Kiểm tra chuỗi số thuần túy (e.g. "45847" hoặc "46396")
  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    if (num >= 25000 && num <= 90000) {
      const dObj = excelSerialToDate(num);
      const y = dObj.getUTCFullYear();
      const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Kiểm tra lỗi bị parse thành 1/1/45847 hoặc 01/01/45847 hoặc 45847-01-01
  const corruptedExcel = str.match(/^(?:0?1[/-]0?1[/-]|)(\d{5})(?:[/-]0?1[/-]0?1)?$/);
  if (corruptedExcel && corruptedExcel[1]) {
    const num = parseInt(corruptedExcel[1], 10);
    if (num >= 25000 && num <= 90000) {
      const dObj = excelSerialToDate(num);
      const y = dObj.getUTCFullYear();
      const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // DD/MM/YYYY hoặc D/M/YYYY hoặc DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4,5})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const yearNum = parseInt(ddmmyyyy[3], 10);
    if (yearNum >= 25000 && yearNum <= 90000) {
      const dObj = excelSerialToDate(yearNum);
      const y = dObj.getUTCFullYear();
      const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return `${yearNum}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2].padStart(2, '0');
    const d = yyyymmdd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    if (y >= 25000 && y <= 90000) {
      const dObj = excelSerialToDate(y);
      const dy = dObj.getFullYear();
      const dm = String(dObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dObj.getDate()).padStart(2, '0');
      return `${dy}-${dm}-${dd}`;
    }
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return str;
}

export function formatDateVN(dateStr?: string | Date | number): string {
  if (!dateStr) return '';
  const normalized = normalizeDateStr(dateStr);
  if (!normalized) return '';
  
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  const d = new Date(normalized);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('vi-VN');
}

export function nowStamp(): string {
  return new Date().toISOString();
}

export function getCurrentTimestampVN(): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dateStr = now.toLocaleDateString('vi-VN');
  return `${timeStr} - ${dateStr}`;
}

export function getCurrentTimeOnlyVN(): string {
  const now = new Date();
  return now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function getDbTimestamp(d?: DatabaseState | null): number {
  if (!d) return 0;
  if (typeof d.updatedAtTimestamp === 'number' && d.updatedAtTimestamp > 0) {
    return d.updatedAtTimestamp;
  }
  if (d.lastUpdate) {
    const parts = d.lastUpdate.split(' - ');
    if (parts.length === 2) {
      const [timePart, datePart] = parts;
      const timeSegments = timePart.split(':').map((x) => parseInt(x, 10) || 0);
      const dateSegments = datePart.split('/').map((x) => parseInt(x, 10) || 0);
      const hh = timeSegments[0] || 0;
      const mm = timeSegments[1] || 0;
      const ss = timeSegments[2] || 0;
      const day = dateSegments[0] || 0;
      const month = dateSegments[1] || 0;
      const year = dateSegments[2] || 0;
      if (year && month && day) {
        const parsed = new Date(year, month - 1, day, hh, mm, ss).getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    const dObj = new Date(d.lastUpdate);
    if (!isNaN(dObj.getTime())) return dObj.getTime();
  }
  return 0;
}

// Hàm tính ngày đáo hạn theo chuẩn tháng dương lịch ngân hàng (không bị trôi ngày do độ dài tháng)
export function getCalendarMaturityDateObj(startDateStr?: string, months?: number): { year: number; month: number; day: number } | null {
  if (!startDateStr || !months) return null;
  const normalized = normalizeDateStr(startDateStr);
  if (!normalized) return null;

  // Parse YYYY-MM-DD
  const parts = normalized.split('-');
  let startYear = 0;
  let startMonth = 0;
  let startDay = 0;

  if (parts.length === 3) {
    startYear = parseInt(parts[0], 10);
    startMonth = parseInt(parts[1], 10); // 1-12
    startDay = parseInt(parts[2], 10);
  } else {
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return null;
    startYear = d.getFullYear();
    startMonth = d.getMonth() + 1;
    startDay = d.getDate();
  }

  if (!startYear || !startMonth || !startDay) return null;

  const totalMonths = (startYear * 12) + (startMonth - 1) + Number(months);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1; // 1-12

  // Số ngày tối đa của tháng đáo hạn
  const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(startDay, maxDaysInTargetMonth);

  return { year: targetYear, month: targetMonth, day: targetDay };
}

export function calculateMaturityDate(startDateStr?: string, months?: number): string {
  const result = getCalendarMaturityDateObj(startDateStr, months);
  if (!result) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(result.day)}/${pad(result.month)}/${result.year}`;
}

export function calculateMaturityDateISO(startDateStr?: string, months?: number): string {
  const result = getCalendarMaturityDateObj(startDateStr, months);
  if (!result) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${result.year}-${pad(result.month)}-${pad(result.day)}`;
}

export function calculateDCADaysRemaining(
  targetDay: number = 10,
  freqMonths: number = 1,
  isFulfilledThisPeriod: boolean = false
): { diffDays: number; nextDueDateStr: string; isOverdue: boolean; overdueDays: number } {
  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (isFulfilledThisPeriod) {
    // Đã nạp hoặc dời nợ kỳ này -> Tính hạn cho kỳ kế tiếp
    const targetMonth = now.getMonth() + Number(freqMonths || 1);
    const daysInTargetMonth = new Date(now.getFullYear(), targetMonth + 1, 0).getDate();
    const effectiveDay = Math.min(targetDay, daysInTargetMonth);
    const nextDue = new Date(now.getFullYear(), targetMonth, effectiveDay);
    const diffDays = Math.round((nextDue.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24));
    return {
      diffDays,
      nextDueDateStr: nextDue.toLocaleDateString('vi-VN'),
      isOverdue: false,
      overdueDays: 0,
    };
  }

  // Kỳ này CHƯA nạp: Hạn chót chính là ngày targetDay của tháng hiện tại
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const effectiveCurrentDay = Math.min(targetDay, daysInCurrentMonth);
  const currentMonthDue = new Date(now.getFullYear(), now.getMonth(), effectiveCurrentDay);
  const diffDays = Math.round((currentMonthDue.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // Đã qua ngày hạn của tháng hiện tại mà chưa nạp -> ĐÃ QUÁ HẠN / BÁO NỢ
    return {
      diffDays,
      nextDueDateStr: currentMonthDue.toLocaleDateString('vi-VN'),
      isOverdue: true,
      overdueDays: Math.abs(diffDays),
    };
  }

  return {
    diffDays,
    nextDueDateStr: currentMonthDue.toLocaleDateString('vi-VN'),
    isOverdue: false,
    overdueDays: 0,
  };
}

export function calculateMilestoneDueDate(createdAt?: string, years: number = 1): { targetPeriodStr: string; monthsLeft: number } {
  let created = new Date((createdAt || '') + '-01');
  if (isNaN(created.getTime())) created = new Date();
  const dueYear = created.getFullYear() + Number(years);
  const dueMonth = created.getMonth() + 1;
  const formattedMonth = String(dueMonth).padStart(2, '0');

  const now = new Date();
  const totalMonthsLeft = Math.max(0, (dueYear - now.getFullYear()) * 12 + (dueMonth - (now.getMonth() + 1)));
  return {
    targetPeriodStr: `Tháng ${formattedMonth}/${dueYear}`,
    monthsLeft: totalMonthsLeft,
  };
}

export async function hashString(str: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeAccountKey(input: string): string {
  if (!input) return '';
  const val = input.trim().toLowerCase();
  if (val.includes('@')) {
    return 'mail_' + val.replace(/[^a-z0-9_]/g, '_');
  }

  // Xử lý chuẩn hóa số điện thoại:
  // Chấp nhận các định dạng phổ biến: 0966203310, +84966203310, 84966203310, 0966 203 310, 0966.203.310
  const digitsOnly = val.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 8 && /^[+0-9\s.-]+$/.test(val)) {
    let cleanPhone = digitsOnly;
    // Chuyển +84xxx hoặc 84xxx thành 0xxx (chuẩn di động Việt Nam)
    if (cleanPhone.startsWith('84') && cleanPhone.length >= 10) {
      cleanPhone = '0' + cleanPhone.slice(2);
    } else if (!cleanPhone.startsWith('0') && cleanPhone.length === 9) {
      cleanPhone = '0' + cleanPhone;
    }
    return 'phone_' + cleanPhone;
  }

  // Với username thông thường (ví dụ: hoannx, admin, phongvien...)
  return 'user_' + val.replace(/[^a-z0-9_]/g, '_');
}

export function parseHistoryDate(h: HistoryPoint): { timestamp: number; year: number; month: number; quarter: number } {
  if (h.timestamp && !isNaN(h.timestamp)) {
    const d = new Date(h.timestamp);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return { timestamp: h.timestamp, year: y, month: m, quarter: Math.floor((m - 1) / 3) + 1 };
  }
  if (h.date) {
    if (h.date.includes('/')) {
      const parts = h.date.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        const dt = new Date(y, m - 1, d);
        return { timestamp: dt.getTime(), year: y, month: m, quarter: Math.floor((m - 1) / 3) + 1 };
      }
    } else if (h.date.includes('-')) {
      const parts = h.date.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parts.length >= 3 ? parseInt(parts[2], 10) : 1;
        const dt = new Date(y, m - 1, d);
        return { timestamp: dt.getTime(), year: y, month: m, quarter: Math.floor((m - 1) / 3) + 1 };
      }
    }
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return { timestamp: now.getTime(), year: y, month: m, quarter: Math.floor((m - 1) / 3) + 1 };
}

export interface ActualChartPoint {
  key: string;
  label: string;
  timestamp: number;
  year: number;
  month: number;
  quarter: number;
  isCurrent: boolean;
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
  inflow: number;
  outflow: number;
  netCashFlow: number;
  debtProgressPercent: number;
  dcaProgressPercent: number;
  runwayPercent: number;
  milestoneProgressPercent: number;
}

/**
 * Lấy danh sách các mốc thời gian thực tế đã có dữ liệu.
 * Bắt đầu từ tháng đầu tiên có thông tin trong hệ thống đến thời điểm hiện tại.
 * Tuyệt đối không tự bịa thêm mốc quá khứ không có dữ liệu và không dự phóng tương lai.
 */
export function getActualTimelinePoints(
  db: DatabaseState,
  currentValues: {
    netWorth: number;
    totalAssets: number;
    totalDebts: number;
    inflow: number;
    outflow: number;
    netCashFlow: number;
    debtProgressPercent: number;
    dcaProgressPercent: number;
    runwayPercent: number;
    milestoneProgressPercent: number;
  },
  range: 'month' | 'quarter' | 'halfyear' | 'year' | '3years' | '5years'
): ActualChartPoint[] {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const now = new Date();
  const currYear = now.getFullYear();
  const currMonth = now.getMonth() + 1;
  const currQuarter = Math.floor((currMonth - 1) / 3) + 1;

  const pointsMap = new Map<string, ActualChartPoint>();

  // 1. Duyệt qua tất cả các bản ghi lịch sử thực tế trong db.history
  (db.history || []).forEach((h) => {
    const { timestamp, year, month, quarter } = parseHistoryDate(h);
    const key = `${year}-${pad(month)}`;
    const label = `T${pad(month)}/${year}`;

    const totalInitialDebts = (db.debts || []).reduce((s, d) => s + (d.amount || 0), 0);
    const existing = pointsMap.get(key);
    if (!existing || timestamp > existing.timestamp) {
      pointsMap.set(key, {
        key,
        label,
        timestamp,
        year,
        month,
        quarter,
        isCurrent: false,
        netWorth: h.netWorth ?? ((h.totalAssets ?? 0) - (h.totalDebts ?? 0)),
        totalAssets: h.totalAssets ?? 0,
        totalDebts: h.totalDebts ?? 0,
        inflow: h.totalInflow ?? 0,
        outflow: h.totalOutflow ?? 0,
        netCashFlow: h.netCashFlow ?? ((h.totalInflow ?? 0) - (h.totalOutflow ?? 0)),
        debtProgressPercent:
          h.debtProgressPercent ??
          (h.totalDebts && totalInitialDebts > 0
            ? Math.max(0, Math.min(100, Math.round(((totalInitialDebts - h.totalDebts) / totalInitialDebts) * 100)))
            : 0),
        dcaProgressPercent: h.dcaProgressPercent ?? currentValues.dcaProgressPercent ?? 0,
        runwayPercent: h.runwayPercent ?? currentValues.runwayPercent ?? 0,
        milestoneProgressPercent: h.milestoneProgressPercent ?? currentValues.milestoneProgressPercent ?? 0,
      });
    }
  });

  // 1.4. Nhóm các món kê khai chi tiết từ db.incomeItems theo tháng (nếu có)
  const deletedMonthsSet = new Set(db.deletedMonths || []);
  const deletedOblMonthsSet = new Set(db.deletedObligationMonths || []);
  const itemInflowsByMonth = new Map<string, number>();
  (db.incomeItems || []).forEach((item) => {
    const mKey = item.month || item.date?.slice(0, 7);
    if (!mKey || deletedMonthsSet.has(mKey)) return;
    itemInflowsByMonth.set(mKey, (itemInflowsByMonth.get(mKey) || 0) + (item.amount || 0));
  });

  // 1.5. Bổ sung các mốc dòng tiền thu về & nghĩa vụ thực tế/dự kiến theo từng tháng
  const allMonthsSet = new Set<string>();
  (db.monthlyIncomes || []).forEach((m) => {
    if (m.month && !deletedMonthsSet.has(m.month)) allMonthsSet.add(m.month);
  });
  Array.from(itemInflowsByMonth.keys()).forEach((m) => allMonthsSet.add(m));
  (db.monthlyObligations || []).forEach((o) => {
    if (o.month && !o.deletedAt && !deletedOblMonthsSet.has(o.month)) allMonthsSet.add(o.month);
  });

  const passiveFromAssets = calculatePassiveInflow(db);

  allMonthsSet.forEach((monthKey) => {
    const parts = monthKey.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!year || !month) return;
    const quarter = Math.floor((month - 1) / 3) + 1;
    const key = `${year}-${pad(month)}`;
    const isCurrent = year === currYear && month === currMonth;
    const label = isCurrent ? `T${pad(month)}/${year} (Hiện tại)` : `T${pad(month)}/${year}`;
    const timestamp = new Date(year, month - 1, 1).getTime();

    const mRec = !deletedMonthsSet.has(monthKey)
      ? (db.monthlyIncomes || []).find((m) => m.month === monthKey)
      : undefined;
    const itemTotal = itemInflowsByMonth.get(monthKey);

    const monthPassive = mRec?.passive !== undefined ? mRec.passive : passiveFromAssets;

    // Ưu tiên incomeItems của tháng đó; nếu không có thì lấy từ monthlyIncomes
    let monthInflow = 0;
    if (itemTotal !== undefined && itemTotal > 0) {
      monthInflow = itemTotal + monthPassive;
    } else if (mRec) {
      monthInflow = (mRec.salary || 0) + (mRec.bonus || 0) + (mRec.other || 0) + monthPassive;
    } else {
      monthInflow = currentValues.inflow;
    }

    const oblSummary = getMonthlyObligationSummary(db, monthKey);
    const monthOutflow = oblSummary.effectiveTotal > 0 ? oblSummary.effectiveTotal : currentValues.outflow;
    const netCashFlow = monthInflow - monthOutflow;

    const existing = pointsMap.get(key);
    if (existing) {
      existing.inflow = monthInflow;
      existing.outflow = monthOutflow;
      existing.netCashFlow = netCashFlow;
    } else {
      pointsMap.set(key, {
        key,
        label,
        timestamp,
        year,
        month,
        quarter,
        isCurrent,
        netWorth: currentValues.netWorth || 0,
        totalAssets: currentValues.totalAssets || 0,
        totalDebts: currentValues.totalDebts || 0,
        inflow: monthInflow,
        outflow: monthOutflow,
        netCashFlow,
        debtProgressPercent: currentValues.debtProgressPercent || 0,
        dcaProgressPercent: currentValues.dcaProgressPercent || 0,
        runwayPercent: currentValues.runwayPercent || 0,
        milestoneProgressPercent: currentValues.milestoneProgressPercent || 0,
      });
    }
  });

  // 2. Điểm mốc thời gian hiện tại: lấy số liệu tính toán thực tế tại thời điểm này
  const currentKey = `${currYear}-${pad(currMonth)}`;
  const currentLabel = `T${pad(currMonth)}/${currYear} (Hiện tại)`;
  const existingCurrent = pointsMap.get(currentKey);
  const currentOblSummary = getMonthlyObligationSummary(db, currentKey);
  const resolvedCurrentOutflow =
    currentOblSummary.hasRecord && currentOblSummary.effectiveTotal > 0
      ? currentOblSummary.effectiveTotal
      : currentValues.outflow > 0
      ? currentValues.outflow
      : existingCurrent?.outflow || 0;
  const resolvedCurrentInflow =
    existingCurrent?.inflow && existingCurrent.inflow > 0 ? existingCurrent.inflow : currentValues.inflow;

  pointsMap.set(currentKey, {
    key: currentKey,
    label: currentLabel,
    timestamp: now.getTime(),
    year: currYear,
    month: currMonth,
    quarter: currQuarter,
    isCurrent: true,
    ...currentValues,
    inflow: resolvedCurrentInflow,
    outflow: resolvedCurrentOutflow,
    netCashFlow: resolvedCurrentInflow - resolvedCurrentOutflow,
  });

  // 3. Sắp xếp các mốc thực tế theo thứ tự thời gian tăng dần
  let points = Array.from(pointsMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  // 4. Lọc theo phạm vi thời gian (chỉ lấy các mốc thực tế nằm trong khoảng, không tự ý bịa thêm mốc giả)
  if (range === 'month') {
    // 12 tháng gần nhất có dữ liệu thực tế
    const inMonthWindow = points.slice(-12);
    if (inMonthWindow.length > 0) {
      points = inMonthWindow;
    }
  } else if (range === 'quarter') {
    const inQuarter = points.filter((p) => p.year === currYear && p.quarter === currQuarter);
    if (inQuarter.length > 0) {
      points = inQuarter;
    } else {
      points = points.slice(-3);
    }
  } else if (range === 'halfyear') {
    // Nửa năm: 6 tháng gần nhất
    const inHalfYear = points.slice(-6);
    if (inHalfYear.length > 0) {
      points = inHalfYear;
    }
  } else if (range === 'year') {
    const inYear = points.filter((p) => p.year === currYear);
    if (inYear.length > 0) {
      points = inYear;
    } else {
      points = points.slice(-12);
    }
  } else if (range === '3years') {
    const in3Years = points.filter((p) => p.year >= currYear - 2);
    if (in3Years.length > 0) {
      points = in3Years;
    }
  } else if (range === '5years') {
    const in5Years = points.filter((p) => p.year >= currYear - 4);
    if (in5Years.length > 0) {
      points = in5Years;
    }
  }

  return points;
}

export interface TimelinePoint {
  key: string;
  label: string;
  isCurrent?: boolean;
  isFuture?: boolean;
  filterFn?: (timestamp: number) => boolean;
}

export function getStandardTimeline(range: 'month' | 'quarter' | 'halfyear' | 'year' | '3years' | '5years'): TimelinePoint[] {
  const now = new Date();
  const currYear = now.getFullYear();
  const currMonth = now.getMonth() + 1; // 1-12
  const currQuarter = Math.floor((currMonth - 1) / 3) + 1; // 1-4
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (range === 'month' || range === 'halfyear') {
    // Theo Tháng (12 tháng gần nhất) hoặc Nửa Năm (6 tháng gần nhất)
    const count = range === 'halfyear' ? 6 : 12;
    const list: TimelinePoint[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(currYear, currMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const isCur = y === currYear && m === currMonth;
      list.push({
        key: `m_${y}_${pad(m)}`,
        label: `T${pad(m)}/${y}${isCur ? ' (Hiện tại)' : ''}`,
        isCurrent: isCur,
        filterFn: (ts) => {
          const check = new Date(ts);
          return check.getFullYear() === y && check.getMonth() + 1 === m;
        },
      });
    }
    return list;
  }

  if (range === 'quarter') {
    // Chỉ lấy các tháng đã hình thành trong quý hiện tại (<= currMonth), không dự phóng
    const startMonth = (currQuarter - 1) * 3 + 1;
    const months: number[] = [];
    for (let m = startMonth; m <= currMonth; m++) {
      months.push(m);
    }

    // Nếu mới ở đầu quý (ví dụ tháng đầu tiên của quý), hiển thị 3 tháng gần nhất đã hình thành đến nay
    if (months.length === 1) {
      const p1 = currMonth === 1 ? 11 : currMonth === 2 ? 12 : currMonth - 2;
      const y1 = currMonth <= 2 ? currYear - 1 : currYear;
      const p2 = currMonth === 1 ? 12 : currMonth - 1;
      const y2 = currMonth === 1 ? currYear - 1 : currYear;
      return [
        {
          key: `m_${y1}_${p1}`,
          label: `T${pad(p1)}/${y1}`,
          filterFn: (ts) => {
            const d = new Date(ts);
            return d.getFullYear() === y1 && d.getMonth() + 1 === p1;
          },
        },
        {
          key: `m_${y2}_${p2}`,
          label: `T${pad(p2)}/${y2}`,
          filterFn: (ts) => {
            const d = new Date(ts);
            return d.getFullYear() === y2 && d.getMonth() + 1 === p2;
          },
        },
        {
          key: `m_${currYear}_${currMonth}`,
          label: `T${pad(currMonth)}/${currYear} (Hiện tại)`,
          isCurrent: true,
          filterFn: (ts) => {
            const d = new Date(ts);
            return d.getFullYear() === currYear && d.getMonth() + 1 === currMonth;
          },
        },
      ];
    }

    return months.map((m) => {
      const isCurrent = m === currMonth;
      return {
        key: `m_${m}`,
        label: `T${pad(m)}/${currYear}${isCurrent ? ` (Hiện tại - Q${currQuarter})` : ''}`,
        isCurrent,
        filterFn: (ts) => {
          const d = new Date(ts);
          return d.getFullYear() === currYear && d.getMonth() + 1 === m;
        },
      };
    });
  }

  if (range === 'year') {
    // Chỉ lấy các Quý đã hình thành trong năm nay (<= currQuarter), loại bỏ các quý tương lai chưa tới
    const quarters = [1, 2, 3, 4].filter((q) => q <= currQuarter);

    return quarters.map((q) => {
      const isCurrent = q === currQuarter;
      const months = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];
      return {
        key: `q${q}`,
        label: `Q${q}/${currYear}${isCurrent ? ' (Hiện tại)' : ''}`,
        isCurrent,
        filterFn: (ts) => {
          const d = new Date(ts);
          return d.getFullYear() === currYear && months.includes(d.getMonth() + 1);
        },
      };
    });
  }

  if (range === '3years') {
    // 3 năm đã hình thành đến nay, không lấy năm kế hoạch tương lai
    return [
      {
        key: 'y_prev2',
        label: `Năm ${currYear - 2}`,
        filterFn: (ts) => new Date(ts).getFullYear() === currYear - 2,
      },
      {
        key: 'y_prev1',
        label: `Năm ${currYear - 1}`,
        filterFn: (ts) => new Date(ts).getFullYear() === currYear - 1,
      },
      {
        key: 'y_curr',
        label: `Năm ${currYear} (Hiện tại)`,
        isCurrent: true,
        filterFn: (ts) => new Date(ts).getFullYear() === currYear,
      },
    ];
  }

  // 5years: 5 năm đã hình thành đến nay
  return [
    {
      key: 'y5_1',
      label: `Năm ${currYear - 4}`,
      filterFn: (ts) => new Date(ts).getFullYear() === currYear - 4,
    },
    {
      key: 'y5_2',
      label: `Năm ${currYear - 3}`,
      filterFn: (ts) => new Date(ts).getFullYear() === currYear - 3,
    },
    {
      key: 'y5_3',
      label: `Năm ${currYear - 2}`,
      filterFn: (ts) => new Date(ts).getFullYear() === currYear - 2,
    },
    {
      key: 'y5_4',
      label: `Năm ${currYear - 1}`,
      filterFn: (ts) => new Date(ts).getFullYear() === currYear - 1,
    },
    {
      key: 'y5_5',
      label: `Năm ${currYear} (Hiện tại)`,
      isCurrent: true,
      filterFn: (ts) => new Date(ts).getFullYear() === currYear,
    },
  ];
}

/**
 * Kiểm tra xem một khoản nợ có phải là khoản không có kỳ hạn hay không
 * (Bao gồm: loại mượn tự do type_free, chu kỳ linh hoạt flexible, kỳ hạn 0/undefined, hoặc ghi chú trả khi có tiền)
 */
export function isNoTermDebt(d: any): boolean {
  if (!d) return false;
  if (d.isNoTerm === true) return true;
  if (d.category === 'type_free') return true;
  if (d.frequency === 'flexible') return true;
  if (d.category === 'type2' && (!d.termMonths || d.termMonths === 0)) return true;
  if (typeof d.termMonths === 'number' && d.termMonths <= 0) return true;
  const noteLower = String(d.note || '').toLowerCase();
  if (
    noteLower.includes('khi nào có') ||
    noteLower.includes('khi nao co') ||
    noteLower.includes('không kỳ hạn') ||
    noteLower.includes('khong ky han') ||
    noteLower.includes('không có kỳ hạn') ||
    noteLower.includes('khong co ky han') ||
    noteLower.includes('trả tự do') ||
    noteLower.includes('tra tu do')
  ) {
    return true;
  }
  return false;
}

/**
 * Kiểm tra xem tài sản có phải là không kỳ hạn hay không (sổ tiết kiệm/tiền gửi không kỳ hạn)
 */
export function isNoTermAsset(a: any): boolean {
  if (!a) return false;
  if (a.isNoTerm === true) return true;
  if (a.type === 'saving' && (!a.termMonths || a.termMonths === 0)) return true;
  if (typeof a.termMonths === 'number' && a.termMonths <= 0) return true;
  const noteLower = String(a.note || '').toLowerCase();
  if (
    noteLower.includes('không kỳ hạn') ||
    noteLower.includes('khong ky han') ||
    noteLower.includes('kkh') ||
    noteLower.includes('linh hoạt') ||
    noteLower.includes('linh hoat')
  ) {
    return true;
  }
  return false;
}

/**
 * Tự động sửa chữa dữ liệu nợ nếu bị lỗi lệch 1đ do cột Excel map nhầm
 */
export function repairDebtPeriodicAmount(d: any): any {
  if (!d) return d;
  const noTerm = isNoTermDebt(d);
  if (noTerm) {
    return {
      ...d,
      isNoTerm: true,
      frequency: 'flexible',
      day: undefined,
      monthlyBefore: 0,
      monthlyAfter: 0,
    };
  }

  // Nếu bị lỗi 1 đ do cột Excel map nhầm với số ngày (day = 1)
  if (d.monthlyBefore === 1 && d.amount > 1000) {
    if (d.category === 'type3' || d.category === 'type4') {
      const fixed = d.periodicAmount && d.periodicAmount > 1 ? d.periodicAmount : d.amount;
      return { ...d, monthlyBefore: fixed, monthlyAfter: fixed, periodicAmount: fixed };
    }
    if (d.category === 'type1') {
      const pPart = d.termMonths ? Math.round(d.amount / d.termMonths) : 0;
      const pInt = d.promoRate ? Math.round((d.amount * (d.promoRate / 100)) / 12) : 0;
      const computed = pPart + pInt;
      return { ...d, monthlyBefore: computed > 0 ? computed : d.amount };
    }
    if (d.category === 'type2') {
      const fixed =
        d.installmentAmount && d.installmentAmount > 1
          ? d.installmentAmount
          : d.termMonths && d.termMonths > 1
          ? Math.round(d.amount / d.termMonths)
          : 0;
      return { ...d, monthlyBefore: fixed, monthlyAfter: fixed };
    }
  }

  return d;
}

// ============================================================================
// NHÓM 2 & NHÓM 3: TIỆN ÍCH DÒNG TIỀN THÁNG TRƯỚC (M-1) & NGHĨA VỤ THEO THÁNG
// ============================================================================

/**
 * Lấy mã tháng hiện tại theo định dạng YYYY-MM
 */
export function getCurrentMonthKey(refDate?: Date | string): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (typeof refDate === 'string' && /^\d{4}-\d{2}$/.test(refDate.trim())) {
    return refDate.trim();
  }
  const dt = refDate ? new Date(refDate) : new Date();
  if (isNaN(dt.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

/**
 * Lấy mã tháng liền trước (M-1) theo định dạng YYYY-MM.
 * Ví dụ: '2026-11' -> '2026-10', '2026-01' -> '2025-12'
 */
export function getPreviousMonthKey(refDateOrMonthKey?: Date | string): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  let year: number;
  let month: number; // 1..12

  if (typeof refDateOrMonthKey === 'string' && /^\d{4}-\d{1,2}$/.test(refDateOrMonthKey.trim())) {
    const parts = refDateOrMonthKey.trim().split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else {
    const dt = refDateOrMonthKey ? new Date(refDateOrMonthKey) : new Date();
    const safeDt = isNaN(dt.getTime()) ? new Date() : dt;
    year = safeDt.getFullYear();
    month = safeDt.getMonth() + 1;
  }

  if (month <= 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${pad(month - 1)}`;
}

/**
 * Định dạng YYYY-MM sang TMM/YYYY (ví dụ '2026-10' -> 'T10/2026')
 */
export function formatMonthVN(monthKey?: string | null): string {
  if (!monthKey || typeof monthKey !== 'string') return '';
  const parts = monthKey.trim().split('-');
  if (parts.length < 2) return monthKey;
  const y = parts[0];
  const m = parseInt(parts[1], 10);
  if (isNaN(m)) return monthKey;
  const pad = m < 10 ? `0${m}` : `${m}`;
  return `T${pad}/${y}`;
}

/**
 * Chuyển chuỗi ngày (DD/MM/YYYY, YYYY-MM-DD, YYYY-MM) hoặc timestamp sang YYYY-MM
 */
export function parseAnyDateToMonthKey(dateVal?: string | number | null): string | null {
  if (dateVal === undefined || dateVal === null) return null;
  if (typeof dateVal === 'number') {
    if (dateVal <= 0 || isNaN(dateVal)) return null;
    const dt = new Date(dateVal);
    if (isNaN(dt.getTime())) return null;
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    return `${y}-${m < 10 ? `0${m}` : m}`;
  }
  if (typeof dateVal !== 'string') return null;
  const trimmed = dateVal.trim();
  if (!trimmed) return null;

  const ymMatch = trimmed.match(/^(\d{4})-(\d{1,2})/);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10);
    if (y >= 1900 && m >= 1 && m <= 12) {
      return `${y}-${m < 10 ? `0${m}` : m}`;
    }
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (y >= 1900 && m >= 1 && m <= 12) {
      return `${y}-${m < 10 ? `0${m}` : m}`;
    }
  }

  const myMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (myMatch) {
    const m = parseInt(myMatch[1], 10);
    const y = parseInt(myMatch[2], 10);
    if (y >= 1900 && m >= 1 && m <= 12) {
      return `${y}-${m < 10 ? `0${m}` : m}`;
    }
  }

  return null;
}

export function compareMonthKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function getObligationRecordItems(r?: MonthlyObligationRecord | null): MonthlyDebtPayment[] {
  if (!r) return [];
  if (Array.isArray(r.payments) && r.payments.length > 0) return r.payments;
  if (Array.isArray(r.items) && r.items.length > 0) return r.items;
  if (Array.isArray(r.payments)) return r.payments;
  if (Array.isArray(r.items)) return r.items;
  return [];
}

/**
 * Tính tổng thu nhập thụ động hàng tháng từ danh mục Tài sản
 */
export function calculatePassiveInflow(db?: DatabaseState | null): number {
  if (!db || !Array.isArray(db.assets)) return 0;
  return db.assets.reduce((sum, a) => {
    if (!a || a.deletedAt) return sum;
    if (a.type === 'realestate_rent' || a.type === 'private_equity' || a.type === 'peer_lending') {
      return sum + (a.cashflow || 0);
    }
    if (a.type === 'stock' && a.quantity && a.divCash) {
      return sum + Math.round((a.quantity * a.divCash) / 12);
    }
    if (a.type === 'saving' && a.rate && a.termMonths) {
      return sum + Math.round((a.amount * (a.rate / 100) * (a.termMonths / 12)) / a.termMonths);
    }
    return sum;
  }, 0);
}

/**
 * Kiểm tra xem khoản nợ có hết thời gian ưu đãi lãi suất tại tháng targetMonthKey hay chưa
 */
export function isDebtPromoExpiredAtMonth(d: Debt, targetMonthKey?: string): boolean {
  if (!targetMonthKey || d.category !== 'type1') return false;
  if (!d.monthlyAfter || d.monthlyAfter <= 0 || d.monthlyAfter === d.monthlyBefore) return false;

  // 1. Kiểm tra theo promoEndDate trực tiếp
  const promoEndMonth = parseAnyDateToMonthKey(d.promoEndDate);
  if (promoEndMonth) {
    return compareMonthKeys(targetMonthKey, promoEndMonth) > 0;
  }

  // 2. Kiểm tra theo startDate + promoMonths
  if (d.promoMonths && d.promoMonths > 0 && d.startDate) {
    const startMonth = parseAnyDateToMonthKey(d.startDate);
    if (startMonth) {
      const [yStr, mStr] = startMonth.split('-');
      const startTotalMonths = parseInt(yStr, 10) * 12 + (parseInt(mStr, 10) - 1);
      const endTotalMonths = startTotalMonths + d.promoMonths - 1;
      const [tyStr, tmStr] = targetMonthKey.split('-');
      const targetTotalMonths = parseInt(tyStr, 10) * 12 + (parseInt(tmStr, 10) - 1);
      return targetTotalMonths > endTotalMonths;
    }
  }

  return false;
}

/**
 * Kiểm tra xem khoản nợ đã tất toán trước hoặc trong tháng targetMonthKey hay chưa
 */
export function isDebtSettledForMonth(d: Debt, targetMonthKey?: string): boolean {
  if (!d || d.deletedAt) return true;
  if (d.status === 'Đã tất toán') {
    if (!targetMonthKey) return true;
    const settledMonth = parseAnyDateToMonthKey(d.settledDate || d.updatedAt);
    if (!settledMonth) return true;
    // Nếu tất toán vào các tháng trước hoặc trong tháng đang xét (settledMonth <= targetMonthKey) thì loại bỏ
    return compareMonthKeys(settledMonth, targetMonthKey) <= 0;
  }
  return false;
}

/**
 * Tính số tiền nghĩa vụ hàng tháng của 1 khoản nợ cho một tháng cụ thể
 */
export function calculateDebtMonthlyAmountForMonth(
  rawDebt: Debt,
  targetMonthKey?: string
): {
  amount: number;
  isPromoExpired: boolean;
  previousPromoAmount?: number;
} {
  const d = repairDebtPeriodicAmount(rawDebt);
  if (!d || isNoTermDebt(d)) {
    return { amount: 0, isPromoExpired: false };
  }

  const promoExpired = isDebtPromoExpiredAtMonth(d, targetMonthKey);
  let baseAmount = d.monthlyBefore || d.installmentAmount || d.periodicAmount || 0;
  let previousPromoAmount: number | undefined;

  if (promoExpired && d.monthlyAfter && d.monthlyAfter > 0) {
    previousPromoAmount = baseAmount;
    baseAmount = d.monthlyAfter;
  }

  let monthlyEquivalent = baseAmount;
  if (d.frequency === 'annual') monthlyEquivalent = Math.round(baseAmount / 12);
  else if (d.frequency === 'biannual') monthlyEquivalent = Math.round(baseAmount / 6);
  else if (d.frequency === 'quarterly') monthlyEquivalent = Math.round(baseAmount / 3);

  return {
    amount: monthlyEquivalent,
    isPromoExpired: promoExpired,
    previousPromoAmount,
  };
}

export interface MonthlyObligationSummaryResult {
  month: string;
  hasRecord: boolean;
  hasData: boolean;
  isActual: boolean;
  status: 'actual' | 'planned' | 'estimated';
  totalPlanned: number;
  plannedTotal: number;
  totalActual: number;
  actualTotal: number;
  effectiveTotal: number;
  diffActualVsPlanned: number;
  payments: MonthlyDebtPayment[];
  items: MonthlyDebtPayment[];
  record?: MonthlyObligationRecord;
}

/**
 * Tổng hợp nghĩa vụ tài chính của một tháng cụ thể (YYYY-MM).
 * - Nếu tháng có bản ghi trong db.monthlyObligations:
 *   + Ưu tiên tổng Thực tế (nếu status === 'actual' hoặc có dòng đã nhập actualAmount),
 *   + Ngược lại dùng tổng Dự kiến (plannedAmount).
 * - Nếu tháng chưa có bản ghi: tự động ước tính từ danh sách db.debts đang hoạt động (tương thích ngược).
 */
export function getMonthlyObligationSummary(
  db: DatabaseState | null | undefined,
  monthKey: string
): MonthlyObligationSummaryResult {
  if (!db) {
    return {
      month: monthKey,
      hasRecord: false,
      hasData: false,
      isActual: false,
      status: 'planned',
      totalPlanned: 0,
      plannedTotal: 0,
      totalActual: 0,
      actualTotal: 0,
      effectiveTotal: 0,
      diffActualVsPlanned: 0,
      payments: [],
      items: [],
    };
  }

  const deletedOblSet = new Set(db.deletedObligationMonths || []);
  const record = !deletedOblSet.has(monthKey)
    ? (db.monthlyObligations || []).find((r) => r && !r.deletedAt && r.month === monthKey)
    : undefined;

  const rawRecordItems = getObligationRecordItems(record);
  if (record && rawRecordItems.length > 0) {
    const activeItems = rawRecordItems.filter(Boolean).map((item) => {
      const plannedAmount = Number(item.plannedAmount ?? item.planned) || 0;
      const actualAmount =
        item.actualAmount !== undefined && item.actualAmount !== null
          ? Number(item.actualAmount)
          : item.actual !== undefined && item.actual !== null
          ? Number(item.actual)
          : undefined;
      return {
        ...item,
        debtName: item.debtName || item.name || 'Khoản nghĩa vụ',
        plannedAmount,
        actualAmount,
      };
    });
    const totalPlanned = activeItems.reduce((sum, item) => sum + (Number(item.plannedAmount) || 0), 0);
    const hasAnyExplicitActual = activeItems.some(
      (item) => item.actualAmount !== undefined && item.actualAmount !== null
    );
    const isActual = record.status === 'actual' || hasAnyExplicitActual;
    const totalActual = activeItems.reduce((sum, item) => {
      const val =
        item.actualAmount !== undefined && item.actualAmount !== null
          ? Number(item.actualAmount)
          : Number(item.plannedAmount) || 0;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const effectiveTotal = isActual ? totalActual : totalPlanned;
    const resolvedActual = isActual ? totalActual : totalPlanned;
    return {
      month: monthKey,
      hasRecord: true,
      hasData: true,
      isActual,
      status: isActual ? 'actual' : 'planned',
      totalPlanned,
      plannedTotal: totalPlanned,
      totalActual: resolvedActual,
      actualTotal: resolvedActual,
      effectiveTotal,
      diffActualVsPlanned: resolvedActual - totalPlanned,
      payments: activeItems,
      items: activeItems,
      record: {
        ...record,
        payments: activeItems,
        items: activeItems,
      },
    };
  }

  // Tương thích ngược: tính từ danh sách db.debts hiện hành
  const estimatedItems: MonthlyDebtPayment[] = [];
  (db.debts || []).forEach((rawD) => {
    if (!rawD || rawD.deletedAt) return;
    if (isDebtSettledForMonth(rawD, monthKey)) return;
    const d = repairDebtPeriodicAmount(rawD);
    if (isNoTermDebt(d)) return;

    // Nếu nợ có ngày bắt đầu sau tháng đang xét thì bỏ qua
    const startMonth = parseAnyDateToMonthKey(d.startDate);
    if (startMonth && compareMonthKeys(startMonth, monthKey) > 0) return;

    const { amount, isPromoExpired, previousPromoAmount } = calculateDebtMonthlyAmountForMonth(d, monthKey);
    if (amount > 0) {
      estimatedItems.push({
        debtId: d.id,
        debtName: d.name,
        category: d.category,
        plannedAmount: amount,
        isPromoExpired: isPromoExpired || undefined,
        previousPromoAmount,
        note: d.note || undefined,
      });
    }
  });

  const totalPlanned = estimatedItems.reduce((sum, it) => sum + (it.plannedAmount || 0), 0);
  const hasEstimatedData = estimatedItems.length > 0 && totalPlanned > 0;
  return {
    month: monthKey,
    hasRecord: false,
    hasData: hasEstimatedData,
    isActual: false,
    status: 'planned',
    totalPlanned,
    plannedTotal: totalPlanned,
    totalActual: totalPlanned,
    actualTotal: totalPlanned,
    effectiveTotal: totalPlanned,
    diffActualVsPlanned: 0,
    payments: estimatedItems,
    items: estimatedItems,
  };
}

export interface PromoRateWarning {
  debtId: number | string;
  debtName: string;
  oldAmount: number;
  newAmount: number;
}

export interface CopyObligationsResult {
  record: MonthlyObligationRecord;
  sourceMonth: string | null;
  promoWarnings: PromoRateWarning[];
  promoExpiredDebts: string[];
  skippedSettledCount: number;
  addedNewDebtsCount: number;
}

/**
 * Sao chép nghĩa vụ từ tháng gần nhất trước đó có dữ liệu sang tháng đang chọn (targetMonthKey),
 * đặt trạng thái "Dự kiến" (status: 'planned') để người dùng chỉ cần sửa vài chỗ khác biệt.
 * - Tự động loại bỏ các khoản nợ đã tất toán (status === 'Đã tất toán' hoặc settledDate <= targetMonthKey).
 * - Tự động thêm các khoản nợ mới phát sinh sau tháng nguồn (startDate > sourceMonth && startDate <= targetMonthKey).
 * - Nếu khoản vay ưu đãi đã qua promoEndDate / promoMonths thì tự đề xuất chuyển sang monthlyAfter và trả về cảnh báo.
 * - Nếu chưa có tháng nào trước đó: khởi tạo danh sách từ các khoản nợ đang hoạt động trong db.debts.
 */
export function copyObligationsFromNearestMonth(
  db: DatabaseState,
  targetMonthKey: string
): CopyObligationsResult {
  const deletedOblSet = new Set(db.deletedObligationMonths || []);
  const activeRecords = (db.monthlyObligations || [])
    .filter(
      (r) =>
        r &&
        !r.deletedAt &&
        !deletedOblSet.has(r.month) &&
        getObligationRecordItems(r).length > 0 &&
        compareMonthKeys(r.month, targetMonthKey) < 0
    )
    .sort((a, b) => compareMonthKeys(b.month, a.month)); // Mới nhất trước

  const sourceRecord = activeRecords[0] || null;
  const debtsById = new Map<number, Debt>();
  (db.debts || []).forEach((d) => {
    if (d && !d.deletedAt) {
      debtsById.set(Number(d.id), repairDebtPeriodicAmount(d));
    }
  });

  const promoWarnings: PromoRateWarning[] = [];
  const nextItems: MonthlyDebtPayment[] = [];
  const includedDebtIds = new Set<number>();
  let skippedSettledCount = 0;
  let addedNewDebtsCount = 0;

  if (sourceRecord) {
    const srcItems = getObligationRecordItems(sourceRecord);
    for (const srcItem of srcItems) {
      if (!srcItem) continue;
      const numericDebtId = typeof srcItem.debtId === 'number' ? srcItem.debtId : Number(srcItem.debtId);
      if (!isNaN(numericDebtId) && numericDebtId > 0) {
        const linkedDebt = debtsById.get(numericDebtId);
        // Nếu khoản nợ đã bị xóa hoặc đã tất toán tính đến tháng targetMonthKey -> tự động loại bỏ
        if (!linkedDebt || isDebtSettledForMonth(linkedDebt, targetMonthKey) || isNoTermDebt(linkedDebt)) {
          skippedSettledCount++;
          continue;
        }
        includedDebtIds.add(linkedDebt.id);

        const calc = calculateDebtMonthlyAmountForMonth(linkedDebt, targetMonthKey);
        const prevAmount =
          srcItem.actualAmount ?? srcItem.actual ?? srcItem.plannedAmount ?? srcItem.planned ?? calc.amount;
        let plannedAmount = prevAmount;

        if (calc.isPromoExpired && calc.amount > 0 && calc.amount !== prevAmount) {
          plannedAmount = calc.amount;
          promoWarnings.push({
            debtId: linkedDebt.id,
            debtName: linkedDebt.name,
            oldAmount: prevAmount,
            newAmount: calc.amount,
          });
        }

        nextItems.push({
          debtId: linkedDebt.id,
          debtName: linkedDebt.name || srcItem.debtName || srcItem.name || 'Khoản nghĩa vụ',
          category: linkedDebt.category || srcItem.category,
          plannedAmount,
          actualAmount: undefined,
          isPaid: false,
          isPromoExpired: calc.isPromoExpired || undefined,
          isPromoExpiredWarning: calc.isPromoExpired || undefined,
          previousPromoAmount: calc.previousPromoAmount,
          note: srcItem.note || linkedDebt.note || undefined,
        });
      } else {
        // Khoản chi phát sinh / tùy chỉnh ngoài danh sách nợ cố định: giữ nguyên sang tháng mới dưới dạng Dự kiến
        const baseAmt = srcItem.actualAmount ?? srcItem.actual ?? srcItem.plannedAmount ?? srcItem.planned ?? 0;
        nextItems.push({
          debtId: srcItem.debtId || 0,
          debtName: srcItem.debtName || srcItem.name || 'Khoản nghĩa vụ',
          category: srcItem.category,
          plannedAmount: baseAmt,
          actualAmount: undefined,
          isPaid: false,
          isCustom: srcItem.isCustom,
          note: srcItem.note,
        });
      }
    }

    // Kiểm tra các khoản nợ mới phát sinh sau tháng nguồn (hoặc chưa có trong tháng nguồn)
    for (const d of debtsById.values()) {
      if (includedDebtIds.has(d.id)) continue;
      if (isDebtSettledForMonth(d, targetMonthKey) || isNoTermDebt(d)) continue;

      const startMonth = parseAnyDateToMonthKey(d.startDate || d.createdAt);
      // Nếu có startMonth sau targetMonthKey thì chưa phát sinh ở targetMonthKey
      if (startMonth && compareMonthKeys(startMonth, targetMonthKey) > 0) continue;

      const calc = calculateDebtMonthlyAmountForMonth(d, targetMonthKey);
      if (calc.amount > 0) {
        if (calc.isPromoExpired && calc.previousPromoAmount && calc.previousPromoAmount !== calc.amount) {
          promoWarnings.push({
            debtId: d.id,
            debtName: d.name,
            oldAmount: calc.previousPromoAmount,
            newAmount: calc.amount,
          });
        }
        nextItems.push({
          debtId: d.id,
          debtName: d.name,
          category: d.category,
          plannedAmount: calc.amount,
          actualAmount: undefined,
          isPaid: false,
          isPromoExpired: calc.isPromoExpired || undefined,
          isPromoExpiredWarning: calc.isPromoExpired || undefined,
          previousPromoAmount: calc.previousPromoAmount,
          note: d.note || undefined,
        });
        includedDebtIds.add(d.id);
        addedNewDebtsCount++;
      }
    }
  } else {
    // Chưa có tháng nào trước đó: khởi tạo từ danh sách db.debts đang hoạt động
    for (const d of debtsById.values()) {
      if (isDebtSettledForMonth(d, targetMonthKey) || isNoTermDebt(d)) continue;
      const startMonth = parseAnyDateToMonthKey(d.startDate);
      if (startMonth && compareMonthKeys(startMonth, targetMonthKey) > 0) continue;

      const calc = calculateDebtMonthlyAmountForMonth(d, targetMonthKey);
      if (calc.amount > 0) {
        if (calc.isPromoExpired && calc.previousPromoAmount && calc.previousPromoAmount !== calc.amount) {
          promoWarnings.push({
            debtId: d.id,
            debtName: d.name,
            oldAmount: calc.previousPromoAmount,
            newAmount: calc.amount,
          });
        }
        nextItems.push({
          debtId: d.id,
          debtName: d.name,
          category: d.category,
          plannedAmount: calc.amount,
          actualAmount: undefined,
          isPaid: false,
          isPromoExpired: calc.isPromoExpired || undefined,
          isPromoExpiredWarning: calc.isPromoExpired || undefined,
          previousPromoAmount: calc.previousPromoAmount,
          note: d.note || undefined,
        });
      }
    }
  }

  const nowIso = new Date().toISOString();
  return {
    record: {
      id: `obl-${targetMonthKey}`,
      month: targetMonthKey,
      payments: nextItems,
      items: nextItems,
      status: 'planned',
      note: sourceRecord
        ? `Sao chép từ ${formatMonthVN(sourceRecord.month)}`
        : 'Khởi tạo từ danh mục nghĩa vụ hiện hành',
      updatedAt: nowIso,
    },
    sourceMonth: sourceRecord ? sourceRecord.month : null,
    promoWarnings,
    promoExpiredDebts: promoWarnings.map((w) => w.debtName),
    skippedSettledCount,
    addedNewDebtsCount,
  };
}

export interface MonthlyCashflowSummaryResult {
  requestedMonth: string; // Tháng M-1 được yêu cầu (ví dụ '2026-10')
  targetMonth: string; // Alias của requestedMonth ('2026-10')
  resolvedMonth: string | null; // Tháng thực tế lấy dữ liệu (ví dụ '2026-10' hoặc '2026-09' nếu lùi, hoặc null nếu trống hoàn toàn)
  usedMonth: string | null; // Alias của resolvedMonth
  hasData: boolean;
  isFallbackMonth: boolean;
  dataType: 'actual' | 'planned' | 'empty';
  inflowSource: 'incomeItems' | 'monthlyIncomes' | 'globalFallback' | 'empty';
  obligationSource: 'actual' | 'planned' | 'estimated' | 'empty';
  obligationStatus: 'actual' | 'planned' | 'estimated' | 'empty';
  inflow: number;
  activeInflow: number;
  passiveInflow: number;
  outflow: number;
  netCashFlow: number;
  netCashflow: number; // Alias của netCashFlow
  sourceLabel: string; // Nhãn hiển thị: "Số liệu T10/2026 (Thực tế)", "Số liệu T10/2026 (Dự kiến)", "Lấy từ T09/2026 (chưa có dữ liệu T10)", hoặc "Chưa có dữ liệu"
  shortBadgeLabel: string; // "Thực tế" | "Dự kiến" | "Chưa có dữ liệu"
  obligationSummary: MonthlyObligationSummaryResult;
}

/**
 * Tính dòng tiền ròng của tháng liền trước (M-1) tính từ currentMonthKey (hoặc ngày hiện tại).
 * Đáp ứng đầy đủ Nhóm 2.1 - 2.4:
 * - Tổng thu của tháng M-1 (ưu tiên incomeItems của tháng đó; nếu không có thì lấy monthlyIncomes gồm salary + bonus + other + thụ động)
 * - Trừ Tổng nghĩa vụ tài chính của tháng M-1 (ưu tiên Thực tế, nếu chưa có Thực tế thì lấy Dự kiến).
 * - Nếu tháng M-1 hoàn toàn chưa có dữ liệu thu và nghĩa vụ, tự động lùi về tháng gần nhất trước đó có dữ liệu
 *   và ghi rõ "Lấy từ T09/2026 (chưa có dữ liệu T10)".
 * - Nếu chưa có tháng nào có dữ liệu thì trả về hasData: false và sourceLabel: "Chưa có dữ liệu".
 */
export function getMonthlyCashflowSummary(
  db: DatabaseState | null | undefined,
  currentMonthKeyOrRefDate?: string | Date,
  options?: {
    allowFallbackToEarlierMonth?: boolean;
    refDate?: Date | string;
    isExactTargetMonth?: boolean;
  }
): MonthlyCashflowSummaryResult {
  const requestedMonth =
    options?.isExactTargetMonth && typeof currentMonthKeyOrRefDate === 'string'
      ? currentMonthKeyOrRefDate
      : getPreviousMonthKey(currentMonthKeyOrRefDate || options?.refDate);
  const allowFallback = options?.allowFallbackToEarlierMonth !== false;

  const emptyObligation = getMonthlyObligationSummary(null, requestedMonth);
  if (!db) {
    return {
      requestedMonth,
      targetMonth: requestedMonth,
      resolvedMonth: null,
      usedMonth: null,
      hasData: false,
      isFallbackMonth: false,
      dataType: 'empty',
      inflowSource: 'empty',
      obligationSource: 'empty',
      obligationStatus: 'empty',
      inflow: 0,
      activeInflow: 0,
      passiveInflow: 0,
      outflow: 0,
      netCashFlow: 0,
      netCashflow: 0,
      sourceLabel: 'Chưa có dữ liệu',
      shortBadgeLabel: 'Chưa có dữ liệu',
      obligationSummary: emptyObligation,
    };
  }

  const deletedMonthsSet = new Set(db.deletedMonths || []);
  const deletedOblSet = new Set(db.deletedObligationMonths || []);
  const passiveFromAssets = calculatePassiveInflow(db);

  // Hàm kiểm tra và tính dữ liệu cho 1 tháng cụ thể
  const evaluateMonth = (mKey: string) => {
    const monthItems = !deletedMonthsSet.has(mKey)
      ? (db.incomeItems || []).filter(
          (it) => it && !it.deletedAt && (it.month === mKey || it.date?.slice(0, 7) === mKey)
        )
      : [];
    const hasIncomeItems = monthItems.length > 0;
    const itemsSum = monthItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);

    const mIncomeRec = !deletedMonthsSet.has(mKey)
      ? (db.monthlyIncomes || []).find((m) => m && !m.deletedAt && m.month === mKey)
      : undefined;
    const hasMonthlyIncomeRec =
      !!mIncomeRec &&
      ((mIncomeRec.salary || 0) + (mIncomeRec.bonus || 0) + (mIncomeRec.other || 0) > 0 ||
        (mIncomeRec.passive !== undefined && mIncomeRec.passive > 0));

    const oblRecord = !deletedOblSet.has(mKey)
      ? (db.monthlyObligations || []).find(
          (r) => r && !r.deletedAt && r.month === mKey && getObligationRecordItems(r).length > 0
        )
      : undefined;
    const hasOblRecord = !!oblRecord;

    const hasExplicitMonthData = hasIncomeItems || hasMonthlyIncomeRec || hasOblRecord;
    return {
      mKey,
      hasIncomeItems,
      itemsSum,
      mIncomeRec,
      hasMonthlyIncomeRec,
      hasOblRecord,
      hasExplicitMonthData,
    };
  };

  let chosenEval = evaluateMonth(requestedMonth);
  let isFallbackMonth = false;

  if (!chosenEval.hasExplicitMonthData && allowFallback) {
    // Tìm tất cả các tháng < requestedMonth có dữ liệu thực sự
    const candidateMonths = new Set<string>();
    (db.incomeItems || []).forEach((it) => {
      const m = it?.month || it?.date?.slice(0, 7);
      if (m && !it.deletedAt && !deletedMonthsSet.has(m) && compareMonthKeys(m, requestedMonth) < 0) {
        candidateMonths.add(m);
      }
    });
    (db.monthlyIncomes || []).forEach((m) => {
      if (
        m &&
        m.month &&
        !m.deletedAt &&
        !deletedMonthsSet.has(m.month) &&
        compareMonthKeys(m.month, requestedMonth) < 0 &&
        ((m.salary || 0) + (m.bonus || 0) + (m.other || 0) > 0 ||
          (m.passive !== undefined && m.passive > 0))
      ) {
        candidateMonths.add(m.month);
      }
    });
    (db.monthlyObligations || []).forEach((r) => {
      if (
        r &&
        r.month &&
        !r.deletedAt &&
        !deletedOblSet.has(r.month) &&
        getObligationRecordItems(r).length > 0 &&
        compareMonthKeys(r.month, requestedMonth) < 0
      ) {
        candidateMonths.add(r.month);
      }
    });

    const sortedCandidates = Array.from(candidateMonths).sort((a, b) => compareMonthKeys(b, a));
    if (sortedCandidates.length > 0) {
      chosenEval = evaluateMonth(sortedCandidates[0]);
      isFallbackMonth = true;
    }
  }

  // Nếu không có bất kỳ tháng lịch sử nào có dữ liệu
  if (!chosenEval.hasExplicitMonthData) {
    return {
      requestedMonth,
      targetMonth: requestedMonth,
      resolvedMonth: null,
      usedMonth: null,
      hasData: false,
      isFallbackMonth: false,
      dataType: 'empty',
      inflowSource: 'empty',
      obligationSource: 'empty',
      obligationStatus: 'empty',
      inflow: 0,
      activeInflow: 0,
      passiveInflow: 0,
      outflow: 0,
      netCashFlow: 0,
      netCashflow: 0,
      sourceLabel: 'Chưa có dữ liệu',
      shortBadgeLabel: 'Chưa có dữ liệu',
      obligationSummary: getMonthlyObligationSummary(db, requestedMonth),
    };
  }

  const resolvedMonth = chosenEval.mKey;
  const oblSummary = getMonthlyObligationSummary(db, resolvedMonth);
  const passiveInflow =
    chosenEval.mIncomeRec?.passive !== undefined ? chosenEval.mIncomeRec.passive : passiveFromAssets;

  let activeInflow = 0;
  let inflowSource: 'incomeItems' | 'monthlyIncomes' | 'globalFallback' = 'monthlyIncomes';

  if (chosenEval.hasIncomeItems) {
    activeInflow = chosenEval.itemsSum;
    inflowSource = 'incomeItems';
  } else if (chosenEval.hasMonthlyIncomeRec && chosenEval.mIncomeRec) {
    activeInflow =
      (chosenEval.mIncomeRec.salary || 0) +
      (chosenEval.mIncomeRec.bonus || 0) +
      (chosenEval.mIncomeRec.other || 0);
    inflowSource = 'monthlyIncomes';
  } else {
    activeInflow = (db.salaryIncome || 0) + (db.bonusIncome || 0) + (db.otherIncome || 0);
    inflowSource = 'globalFallback';
  }

  const inflow = activeInflow + passiveInflow;
  const outflow = oblSummary.effectiveTotal;
  const netCashFlow = inflow - outflow;

  const isActualData = oblSummary.hasRecord
    ? oblSummary.isActual
    : oblSummary.effectiveTotal === 0 && (chosenEval.hasIncomeItems || chosenEval.hasMonthlyIncomeRec);

  const dataType: 'actual' | 'planned' = isActualData ? 'actual' : 'planned';
  const typeText = isActualData ? 'Thực tế' : 'Dự kiến';
  const reqMonthParts = requestedMonth.split('-');
  const reqShortMonth = reqMonthParts.length >= 2 ? `T${reqMonthParts[1]}` : formatMonthVN(requestedMonth);

  const sourceLabel = isFallbackMonth
    ? `Lấy từ ${formatMonthVN(resolvedMonth)} (chưa có dữ liệu ${reqShortMonth})`
    : `Số liệu ${formatMonthVN(resolvedMonth)} (${typeText})`;

  return {
    requestedMonth,
    targetMonth: requestedMonth,
    resolvedMonth,
    usedMonth: resolvedMonth,
    hasData: true,
    isFallbackMonth,
    dataType,
    inflowSource,
    obligationSource: oblSummary.status,
    obligationStatus: oblSummary.status,
    inflow,
    activeInflow,
    passiveInflow,
    outflow,
    netCashFlow,
    netCashflow: netCashFlow,
    sourceLabel,
    shortBadgeLabel: typeText,
    obligationSummary: oblSummary,
  };
}



