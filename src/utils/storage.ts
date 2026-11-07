import { DatabaseState } from '../types';
import { DEFAULT_LIFE_EVENTS, DEFAULT_FOOD_PLACES } from './utilityDefaultData';

export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxW6C9L4sDhKMLO28_iaxLrUS834iKCoYkkQJbxGz_e2vpGPf3KVJxzr2tvoY5EIZ0tbw/exec';

export const DEFAULT_DATABASE_STATE: DatabaseState = {
  assets: [
    {
      id: 1,
      level: '1',
      type: 'cash',
      name: 'Tiền gửi thanh toán VCB',
      amount: 150000000,
      updatedAt: '01/09/2026',
    },
    {
      id: 2,
      level: '1',
      type: 'saving',
      name: 'Sổ tiết kiệm BIDV 12 Tháng',
      amount: 400000000,
      rate: 5.6,
      startDate: '2026-01-15',
      termMonths: 12,
      maturityDate: '2027-01-15',
      updatedAt: '01/09/2026',
    },
    {
      id: 3,
      level: '1',
      type: 'gold',
      name: 'Vàng nhẫn trơn 9999 PNJ',
      amount: 350000000,
      quantity: 40,
      costPrice: 310000000,
      updatedAt: '05/09/2026',
    },
    {
      id: 4,
      level: '1',
      type: 'realestate_live',
      name: 'Căn hộ chung cư đang ở',
      amount: 3200000000,
      updatedAt: '01/09/2026',
    },
    {
      id: 5,
      level: '2',
      type: 'stock',
      name: 'HPG - Hòa Phát',
      amount: 280000000,
      quantity: 10000,
      costPrice: 260000000,
      divCash: 1200,
      updatedAt: '08/09/2026',
    },
    {
      id: 6,
      level: '2',
      type: 'stock',
      name: 'FPT - Công nghệ FPT',
      amount: 420000000,
      quantity: 3500,
      costPrice: 350000000,
      divCash: 2000,
      updatedAt: '10/09/2026',
    },
    {
      id: 7,
      level: '3',
      type: 'crypto',
      name: 'Bitcoin & Top Altcoins',
      amount: 180000000,
      costPrice: 150000000,
      updatedAt: '12/09/2026',
    },
  ],
  debts: [
    {
      id: 101,
      category: 'type1',
      name: 'Vay mua chung cư VCB',
      frequency: 'monthly',
      startDate: '2024-06-15',
      day: 20,
      amount: 1400000000,
      termMonths: 240,
      promoMonths: 24,
      promoEndDate: '2026-06-15',
      promoRate: 6.2,
      normalRate: 10.5,
      monthlyBefore: 13066667,
      monthlyAfter: 17200000,
      paidPrincipal: 175000000,
      status: 'Chưa tất toán',
      note: 'Ưu đãi lãi suất 24 tháng đầu',
    },
    {
      id: 102,
      category: 'type2',
      name: 'Trả góp Macbook M3 Max',
      frequency: 'monthly',
      startDate: '2026-03-10',
      day: 10,
      amount: 60000000,
      termMonths: 12,
      installmentAmount: 5000000,
      monthlyBefore: 5000000,
      monthlyAfter: 5000000,
      paidPrincipal: 30000000,
      status: 'Chưa tất toán',
      note: 'Trả qua thẻ tín dụng Techcombank 0%',
    },
    {
      id: 103,
      category: 'type4',
      name: 'Chi tiêu sinh hoạt gia đình & con học',
      frequency: 'monthly',
      day: 5,
      amount: 35000000,
      periodicAmount: 35000000,
      monthlyBefore: 35000000,
      monthlyAfter: 35000000,
      paidPrincipal: 0,
      status: 'Chưa tất toán',
      note: 'Ngân sách thiết yếu hàng tháng',
    },
  ],
  goals: [
    {
      id: 201,
      group: 'dca',
      goalType: 'dca',
      assetType: 'stock',
      linkedAssetId: 5,
      name: 'HPG - Hòa Phát',
      freqMonths: 1,
      targetQty: 500,
      unit: 'CP',
      day: 15,
      backlogQty: 0,
      totalBought: 3000,
      lastBoughtPeriod: '2026-08',
      status: 'active',
      note: 'DCA tích sản chu kỳ thép dài hạn',
    },
    {
      id: 202,
      group: 'dca',
      goalType: 'dca',
      assetType: 'saving',
      linkedAssetId: 2,
      name: 'Sổ tiết kiệm BIDV 12 Tháng',
      freqMonths: 1,
      targetQty: 20000000,
      targetAmountPerPeriod: 20000000,
      unit: 'VNĐ',
      day: 25,
      backlogQty: 0,
      totalBought: 80000000,
      lastBoughtPeriod: '2026-08',
      status: 'active',
      note: 'Gửi tích lũy bổ sung hàng tháng vào sổ',
    },
    {
      id: 203,
      group: 'dca',
      goalType: 'dca',
      assetType: 'gold',
      linkedAssetId: 3,
      name: 'Vàng nhẫn trơn 9999 PNJ',
      freqMonths: 3,
      targetQty: 2,
      unit: 'chỉ',
      day: 10,
      backlogQty: 0,
      totalBought: 6,
      lastBoughtPeriod: '2026-07',
      status: 'active',
      note: 'Mua tích trữ mỗi quý 2 chỉ',
    },
    {
      id: 204,
      group: 'milestone',
      goalType: 'milestone',
      name: 'Mua thêm BĐS đất nền ven đô',
      target: 2500000000,
      years: 3,
      createdAt: '2026-01',
      status: 'active',
      note: 'Chuẩn bị vốn tự có 50% trước khi vay',
    },
    {
      id: 205,
      group: 'runway',
      goalType: 'milestone',
      name: 'Quỹ dự phòng khẩn cấp 12 tháng',
      target: 500000000,
      years: 1,
      createdAt: '2026-01',
      status: 'active',
      note: 'Đảm bảo thanh khoản chi trả nợ và sinh hoạt',
    },
  ],
  transactions: [
    {
      id: 'tx_init_1',
      assetId: 3,
      goalId: 203,
      assetName: 'Vàng nhẫn trơn 9999 PNJ',
      date: '2026-01-10',
      type: 'buy',
      quantity: 2,
      unit: 'chỉ',
      pricePerUnit: 7600000,
      totalAmount: 15200000,
      note: 'Gom tích trữ đầu năm',
    },
    {
      id: 'tx_init_2',
      assetId: 3,
      goalId: 203,
      assetName: 'Vàng nhẫn trơn 9999 PNJ',
      date: '2026-04-10',
      type: 'buy',
      quantity: 2,
      unit: 'chỉ',
      pricePerUnit: 7850000,
      totalAmount: 15700000,
      note: 'DCA quý 2 - PNJ Cầu Giấy',
    },
    {
      id: 'tx_init_3',
      assetId: 3,
      goalId: 203,
      assetName: 'Vàng nhẫn trơn 9999 PNJ',
      date: '2026-07-10',
      type: 'buy',
      quantity: 2,
      unit: 'chỉ',
      pricePerUnit: 8100000,
      totalAmount: 16200000,
      note: 'DCA quý 3 - Bảo Tín Minh Châu',
    },
    {
      id: 'tx_init_4',
      assetId: 5,
      goalId: 201,
      assetName: 'HPG - Hòa Phát',
      date: '2026-06-15',
      type: 'buy',
      quantity: 1000,
      unit: 'CP',
      pricePerUnit: 25500,
      totalAmount: 25500000,
      note: 'Khớp lệnh phiên định kỳ tháng 6',
    },
    {
      id: 'tx_init_5',
      assetId: 5,
      goalId: 201,
      assetName: 'HPG - Hòa Phát',
      date: '2026-07-15',
      type: 'buy',
      quantity: 1000,
      unit: 'CP',
      pricePerUnit: 26000,
      totalAmount: 26000000,
      note: 'Khớp lệnh phiên định kỳ tháng 7',
    },
    {
      id: 'tx_init_6',
      assetId: 5,
      goalId: 201,
      assetName: 'HPG - Hòa Phát',
      date: '2026-08-15',
      type: 'buy',
      quantity: 1000,
      unit: 'CP',
      pricePerUnit: 26500,
      totalAmount: 26500000,
      note: 'Khớp lệnh phiên định kỳ tháng 8',
    },
  ],
  history: [
    {
      date: '01/03/2026',
      netWorth: 3100000000,
      totalAssets: 4600000000,
      totalDebts: 1500000000,
      totalInflow: 95000000,
      totalOutflow: 53066667,
      netCashFlow: 41933333,
      debtProgressPercent: 8,
      dcaProgressPercent: 50,
      runwayPercent: 60,
      milestoneProgressPercent: 10,
      timestamp: new Date('2026-03-01').getTime(),
    },
    {
      date: '01/06/2026',
      netWorth: 3320000000,
      totalAssets: 4790000000,
      totalDebts: 1470000000,
      totalInflow: 105000000,
      totalOutflow: 53066667,
      netCashFlow: 51933333,
      debtProgressPercent: 10,
      dcaProgressPercent: 70,
      runwayPercent: 75,
      milestoneProgressPercent: 14,
      timestamp: new Date('2026-06-01').getTime(),
    },
    {
      date: '01/09/2026',
      netWorth: 3510000000,
      totalAssets: 4980000000,
      totalDebts: 1470000000,
      totalInflow: 110000000,
      totalOutflow: 53066667,
      netCashFlow: 56933333,
      debtProgressPercent: 13,
      dcaProgressPercent: 85,
      runwayPercent: 90,
      milestoneProgressPercent: 18,
      timestamp: new Date('2026-09-01').getTime(),
    },
  ],
  salaryIncome: 85000000,
  otherIncome: 15000000,
  monthlyIncomes: [
    { id: 'inc-1', month: '2026-05', salary: 80000000, other: 10000000, note: 'Lương cố định + làm thêm' },
    { id: 'inc-2', month: '2026-06', salary: 80000000, other: 25000000, note: 'Thưởng KPI 6 tháng đầu năm' },
    { id: 'inc-3', month: '2026-07', salary: 85000000, other: 15000000, note: 'Tăng lương kỳ đánh giá' },
    { id: 'inc-4', month: '2026-08', salary: 85000000, other: 15000000, note: 'Lương & thu nhập kinh doanh' },
    { id: 'inc-5', month: '2026-09', salary: 85000000, other: 25000000, note: 'Hoa hồng tư vấn ngoài' },
    { id: 'inc-6', month: '2026-10', salary: 85000000, other: 15000000, note: 'Tháng hiện tại' },
  ],
  incomeItems: [
    { id: 'item-1', date: '2026-10-05', month: '2026-10', title: 'Lương chuyển khoản VCB', amount: 55000000, category: 'salary', note: 'Lương cố định sau thuế' },
    { id: 'item-2', date: '2026-10-10', month: '2026-10', title: 'Thưởng KPI quý 3', amount: 30000000, category: 'bonus', note: 'Đạt 120% chỉ tiêu' },
    { id: 'item-3', date: '2026-10-18', month: '2026-10', title: 'Hoa hồng tư vấn giải pháp', amount: 15000000, category: 'commission', note: 'Hợp đồng doanh nghiệp' },
    { id: 'item-4', date: '2026-09-05', month: '2026-09', title: 'Lương chuyển khoản VCB', amount: 55000000, category: 'salary', note: 'Lương cố định sau thuế' },
    { id: 'item-5', date: '2026-09-15', month: '2026-09', title: 'Thưởng dự án chuyển đổi số', amount: 30000000, category: 'bonus', note: 'Nghiệm thu giai đoạn 1' },
    { id: 'item-6', date: '2026-09-25', month: '2026-09', title: 'Thu nhập kinh doanh bán lẻ', amount: 25000000, category: 'business', note: 'Doanh thu cửa hàng phụ' },
    { id: 'item-7', date: '2026-08-05', month: '2026-08', title: 'Lương chuyển khoản VCB', amount: 55000000, category: 'salary', note: 'Lương cố định' },
    { id: 'item-8', date: '2026-08-16', month: '2026-08', title: 'Làm thêm freelance cuối tuần', amount: 30000000, category: 'commission', note: 'Thiết kế hệ thống' },
    { id: 'item-9', date: '2026-08-28', month: '2026-08', title: 'Thưởng nóng vượt tiến độ', amount: 15000000, category: 'bonus', note: 'Dự án trọng điểm' },
  ],
  lastUpdate: '12/09/2026',
  stockWatchlist: ['HPG', 'FPT', 'TCB', 'MBB', 'SSI', 'MWG', 'VNM', 'BMP', 'VEA'],
  lifeEvents: DEFAULT_LIFE_EVENTS,
  foodPlaces: DEFAULT_FOOD_PLACES,
};

import { googleDriveSyncService, CloudPayload } from './googleDriveSyncService';
import { deepMergeRootCloudPayload } from './dataMergeEngine';

let customAppsScriptUrl: string = '';

export function getActiveAppsScriptUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('thaptaisan_custom_script_url') || customAppsScriptUrl || APPS_SCRIPT_URL;
  }
  return customAppsScriptUrl || APPS_SCRIPT_URL;
}

export function setActiveAppsScriptUrl(url: string): void {
  customAppsScriptUrl = url;
  if (typeof window !== 'undefined') {
    if (url) {
      localStorage.setItem('thaptaisan_custom_script_url', url);
    } else {
      localStorage.removeItem('thaptaisan_custom_script_url');
    }
  }
}

export async function loadCloudData(): Promise<{ passwords: Record<string, string>; users: Record<string, DatabaseState> } | null> {
  try {
    const res = await googleDriveSyncService.readThapTaiSanFile();
    if (res.success && res.data) {
      return {
        passwords: res.data.passwords || {},
        users: res.data.users || {},
      };
    }
  } catch (err) {
    console.warn('[Storage] loadCloudData exception:', err);
  }

  // Fallback to local snapshot
  const fallback = googleDriveSyncService.getLocalFallbackCache();
  if (fallback) {
    return {
      passwords: fallback.passwords || {},
      users: fallback.users || {},
    };
  }

  return null;
}

export async function saveCloudData(
  payload: { passwords: Record<string, string>; users: Record<string, DatabaseState> },
  useKeepAlive: boolean = false,
  options: { expectedEtag?: string; userKey?: string; force?: boolean } = {}
): Promise<boolean> {
  try {
    // 1. KeepAlive when closing tab / app exit
    if (useKeepAlive && typeof navigator !== 'undefined') {
      const payloadString = JSON.stringify({
        ...payload,
        _metadata: {
          modifiedTime: new Date().toISOString(),
          lastSyncedDevice: navigator.userAgent.slice(0, 40),
        },
      });

      if (typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payloadString], { type: 'text/plain;charset=utf-8' });
        navigator.sendBeacon('/api/cloud-sync', blob);
      }

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadString,
        keepalive: true,
      }).catch(() => {});

      return true;
    }

    // 2. Standard Safe Save with ETag Validation & Exponential Backoff
    const result = await googleDriveSyncService.writeThapTaiSanFile(payload, {
      expectedEtag: options.expectedEtag,
      userKey: options.userKey,
      force: options.force,
    });

    return result.success;
  } catch (err) {
    console.warn('[Storage] saveCloudData failed:', err);
    return false;
  }
}

/**
 * Cookie helpers for iOS Safari <-> Standalone WebClip (Add to Home Screen) synchronization
 */
export function setAuthCookie(name: string, value: string, days: number = 365): void {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {}
}

export function getAuthCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  try {
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)')
    );
    return match ? decodeURIComponent(match[1]) : '';
  } catch (e) {
    return '';
  }
}

export function removeAuthCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  } catch (e) {}
}


