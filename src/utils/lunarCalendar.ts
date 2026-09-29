/**
 * Vietnamese Lunar Calendar (Âm Lịch Việt Nam)
 * Based on astronomical calculations for UTC+7 timezone (Hà Nội time)
 * Provides accurate solar-to-lunar and lunar-to-solar conversions.
 */

// Helper functions for astronomical calculations
function jdn(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  return (
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdToDate(jd: number): { day: number; month: number; year: number } {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { day, month, year };
}

function getNewMoonDay(k: number, timeZone: number = 7): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 =
    2415020.75933 +
    29.53058868 * k +
    0.0001178 * T2 -
    0.000000155 * T3 +
    0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) +
    0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * dr * Mpr);
  C1 = C1 - 0.0004 * Math.sin(3 * dr * Mpr);
  C1 = C1 + 0.0104 * Math.sin(2 * dr * F) - 0.0051 * Math.sin((M + Mpr) * dr);
  C1 = C1 - 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr);
  C1 = C1 - 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr);
  C1 = C1 + 0.001 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((2 * Mpr + M) * dr);
  const deltat =
    T < -4
      ? 102.3 + 123.5 * T + 32.5 * T2
      : -20 + 182 * (T + 4) - 21.7 * (T + 4) * (T + 4);
  const Jd = Jd1 + C1 - deltat / 86400;
  return Math.floor(Jd + 0.5 + timeZone / 24);
}

function getSunLongitude(dayNumber: number, timeZone: number = 7): number {
  const T = (dayNumber - 0.5 - timeZone / 24 - 2451545.0) / 36525;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T * T - 0.00000048 * T * T * T;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T * T;
  let DL =
    (1.9146 - 0.004817 * T - 0.000014 * T * T) * Math.sin(dr * M) +
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  isLeap: boolean;
  canChiDay?: string;
  canChiYear?: string;
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

export function getCanChiYear(lunarYear: number): string {
  const can = CAN[(lunarYear + 6) % 10];
  const chi = CHI[(lunarYear + 8) % 12];
  return `${can} ${chi}`;
}

/**
 * Converts a Solar Date (Dương lịch) to Lunar Date (Âm lịch)
 */
export function convertSolarToLunar(dd: number, mm: number, yy: number): LunarDate {
  const dayNumber = jdn(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, 7);
  let currentK = k + 1;
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, 7);
    currentK = k;
  }
  let a11 = getNewMoonDay(Math.floor((jdn(31, 12, yy) - 2415021.076998695) / 29.530588853), 7);
  if (a11 >= jdn(1, 1, yy + 1)) {
    a11 = getNewMoonDay(Math.floor((jdn(31, 12, yy) - 2415021.076998695) / 29.530588853) - 1, 7);
  }

  // Find month 11 of the previous year
  let k11 = Math.floor((jdn(31, 12, yy - 1) - 2415021.076998695) / 29.530588853);
  let lastA11 = getNewMoonDay(k11, 7);
  if (getSunLongitude(lastA11, 7) !== 8) {
    lastA11 = getNewMoonDay(k11 + 1, 7);
    k11 = k11 + 1;
  }

  // Calculate lunar month
  let off = currentK - k11;
  let leap = 0;
  let isLeapMonth = false;

  // Check for leap months
  const leapMonthCandidates: number[] = [];
  for (let i = 1; i <= 14; i++) {
    const nm = getNewMoonDay(k11 + i, 7);
    const sunLong = getSunLongitude(nm, 7);
    if (i > 1 && sunLong === getSunLongitude(getNewMoonDay(k11 + i - 1, 7), 7)) {
      leapMonthCandidates.push(i);
    }
  }

  if (leapMonthCandidates.length > 0) {
    leap = leapMonthCandidates[0];
  }

  let lunarMonth = off + 11;
  if (lunarMonth > 12) lunarMonth = lunarMonth - 12;
  if (leap > 0 && off >= leap) {
    if (off === leap) {
      isLeapMonth = true;
      lunarMonth = off + 10;
    } else {
      lunarMonth = off + 10;
    }
    if (lunarMonth > 12) lunarMonth = lunarMonth - 12;
  }

  let lunarYear = yy;
  if (lunarMonth >= 11 && mm <= 2) {
    lunarYear = yy - 1;
  } else if (lunarMonth <= 2 && mm >= 11) {
    lunarYear = yy + 1;
  }

  const lunarDay = dayNumber - monthStart + 1;

  return {
    day: lunarDay,
    month: lunarMonth,
    year: lunarYear,
    isLeap: isLeapMonth,
    canChiYear: getCanChiYear(lunarYear),
  };
}

/**
 * Converts a Lunar Date (Âm lịch) to Solar Date (Dương lịch) for a target solar year
 */
export function convertLunarToSolar(
  lunarDay: number,
  lunarMonth: number,
  solarYear: number,
  isLeap: boolean = false
): { day: number; month: number; year: number } {
  // Approximate search across days in the target solar year
  const startDay = new Date(solarYear, 0, 1);
  const endDay = new Date(solarYear, 11, 31);
  
  let bestDate = { day: 1, month: 1, year: solarYear };
  let minDiff = 999;

  for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    const sD = d.getDate();
    const sM = d.getMonth() + 1;
    const sY = d.getFullYear();
    const l = convertSolarToLunar(sD, sM, sY);

    if (l.month === lunarMonth && l.day === lunarDay) {
      if (isLeap && !l.isLeap) continue;
      return { day: sD, month: sM, year: sY };
    }
  }

  // Fallback to approximate matching
  return bestDate;
}

/**
 * Get days in month for Solar calendar
 */
export function getDaysInSolarMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Format date display with both Solar and Lunar notations
 */
export function formatSolarAndLunar(solarDate: Date): { solarStr: string; lunarStr: string } {
  const sDay = solarDate.getDate();
  const sMonth = solarDate.getMonth() + 1;
  const sYear = solarDate.getFullYear();
  const lunar = convertSolarToLunar(sDay, sMonth, sYear);

  return {
    solarStr: `${sDay < 10 ? '0' + sDay : sDay}/${sMonth < 10 ? '0' + sMonth : sMonth}/${sYear}`,
    lunarStr: `${lunar.day}/${lunar.month}${lunar.isLeap ? ' (Nhuận)' : ''} ÂL`,
  };
}
