import { DatabaseState, HistoryPoint } from '../types';

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
  range: 'quarter' | 'year' | '3years' | '5years'
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

    // Nếu trong cùng tháng có nhiều bản ghi, lấy bản ghi có timestamp mới nhất
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
          (h.totalDebts ? Math.max(5, Math.min(100, Math.round(((1635000000 - h.totalDebts) / 1635000000) * 100))) : 0),
        dcaProgressPercent: h.dcaProgressPercent ?? 50,
        runwayPercent: h.runwayPercent ?? Math.min(100, Math.round(((h.totalAssets * 0.15) / 500000000) * 100)),
        milestoneProgressPercent: h.milestoneProgressPercent ?? 10,
      });
    }
  });

  // 2. Điểm mốc thời gian hiện tại: lấy số liệu tính toán thực tế tại thời điểm này
  const currentKey = `${currYear}-${pad(currMonth)}`;
  const currentLabel = `T${pad(currMonth)}/${currYear} (Hiện tại)`;
  pointsMap.set(currentKey, {
    key: currentKey,
    label: currentLabel,
    timestamp: now.getTime(),
    year: currYear,
    month: currMonth,
    quarter: currQuarter,
    isCurrent: true,
    ...currentValues,
  });

  // 3. Sắp xếp các mốc thực tế theo thứ tự thời gian tăng dần
  let points = Array.from(pointsMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  // 4. Lọc theo phạm vi thời gian (chỉ lấy các mốc thực tế nằm trong khoảng, không tự ý bịa thêm mốc giả)
  if (range === 'quarter') {
    const inQuarter = points.filter((p) => p.year === currYear && p.quarter === currQuarter);
    if (inQuarter.length > 0) {
      points = inQuarter;
    }
  } else if (range === 'year') {
    const inYear = points.filter((p) => p.year === currYear);
    if (inYear.length > 0) {
      points = inYear;
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

export function getStandardTimeline(range: 'quarter' | 'year' | '3years' | '5years'): TimelinePoint[] {
  const now = new Date();
  const currYear = now.getFullYear();
  const currMonth = now.getMonth() + 1; // 1-12
  const currQuarter = Math.floor((currMonth - 1) / 3) + 1; // 1-4
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

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


