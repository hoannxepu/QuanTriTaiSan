import { DatabaseState } from '../types';

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
  lastUpdate: '12/09/2026',
};

export async function loadCloudData(): Promise<{ passwords: Record<string, string>; users: Record<string, DatabaseState> } | null> {
  // Chiến lược 1: Thử tải qua Proxy cùng domain (/api/cloud-sync)
  // Giúp vượt qua triệt để chính sách chặn CORS Preflight trên trình duyệt di động (iOS Safari, Android Chrome)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`/api/cloud-sync?t=${Date.now()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && (data.passwords || data.users)) {
        if (!data.passwords) data.passwords = {};
        if (!data.users) data.users = {};
        try {
          localStorage.setItem('thaptaisan_cloud_cache', JSON.stringify(data));
        } catch (e) {}
        return data;
      }
    }
  } catch (err) {
    // Nếu môi trường không có backend proxy hoặc timeout, chuyển sang chiến lược 2
  }

  // Chiến lược 2: Gọi trực tiếp Google Apps Script bằng Simple GET Request
  // Không thêm custom headers để tránh kích hoạt CORS OPTIONS preflight
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const cacheBusterUrl = `${APPS_SCRIPT_URL}${APPS_SCRIPT_URL.includes('?') ? '&' : '?'}t=${Date.now()}`;
    const res = await fetch(cacheBusterUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        if (!data.passwords) data.passwords = {};
        if (!data.users) data.users = {};
        try {
          localStorage.setItem('thaptaisan_cloud_cache', JSON.stringify(data));
        } catch (e) {}
        return data;
      }
    }
  } catch (err) {
    // ignore
  }

  // Chiến lược 3: Sử dụng bản lưu cache trên máy nếu mất mạng
  try {
    const cached = localStorage.getItem('thaptaisan_cloud_cache');
    if (cached) {
      const data = JSON.parse(cached);
      if (data && typeof data === 'object' && (data.passwords || data.users)) {
        return data;
      }
    }
  } catch (e) {}

  return null;
}

export async function saveCloudData(
  payload: { passwords: Record<string, string>; users: Record<string, DatabaseState> },
  useKeepAlive: boolean = false
): Promise<boolean> {
  try {
    try {
      localStorage.setItem('thaptaisan_cloud_cache', JSON.stringify(payload));
    } catch (e) {}

    const payloadString = JSON.stringify(payload);

    // 1. Khi người dùng tắt web, chuyển app hoặc đăng xuất -> Dùng sendBeacon
    if (useKeepAlive) {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payloadString], { type: 'text/plain;charset=utf-8' });
        const sentProxy = navigator.sendBeacon('/api/cloud-sync', blob);
        if (sentProxy) return true;
        const sentDirect = navigator.sendBeacon(APPS_SCRIPT_URL, blob);
        if (sentDirect) return true;
      }

      fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadString,
        keepalive: true,
      }).catch(() => {});

      return true;
    }

    // 2. Thử lưu trước qua Proxy cùng domain (/api/cloud-sync)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadString,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return true;
      }
    } catch (proxyErr) {
      // Nếu proxy lỗi hoặc môi trường thuần static, chuyển sang gửi trực tiếp tới Google Apps Script
    }

    // 3. Dự phòng gửi trực tiếp tới Google Apps Script
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payloadString,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch (err) {
    return false;
  }
}
