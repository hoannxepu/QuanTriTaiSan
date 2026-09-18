/**
 * Dữ liệu phân vị tài sản và thu nhập tại Việt Nam
 * Căn cứ theo:
 * 1. Báo cáo Tài sản Toàn cầu (Global Wealth Report - UBS / Credit Suisse)
 * 2. Knight Frank Wealth Report (Báo cáo Thịnh Vượng)
 * 3. Niên giám Thống kê & Khảo sát mức sống dân cư (VHLSS - Tổng cục Thống kê GSO)
 */

export interface WealthTier {
  topPercent: string;
  minAmount: number;
  maxAmount: number | null;
  rangeLabel: string;
  title: string;
  desc: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export interface IncomeTier {
  topPercent: string;
  minMonthly: number;
  maxMonthly: number | null;
  rangeLabel: string;
  title: string;
  desc: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

// Tài sản bình quân người trưởng thành tại Việt Nam (~14.500 USD ~ 370 triệu VNĐ)
export const VN_AVERAGE_WEALTH = 370_000_000;

// Thu nhập bình quân người lao động tại Việt Nam (~8.5 triệu VNĐ/tháng)
export const VN_AVERAGE_MONTHLY_INCOME = 8_500_000;

export const WEALTH_TIERS: WealthTier[] = [
  {
    topPercent: 'Top 0.1%',
    minAmount: 75_000_000_000,
    maxAmount: null,
    rangeLabel: 'Từ 75 Tỷ VNĐ trở lên (~3M+ USD)',
    title: 'Siêu Giàu (Ultra-HNWI)',
    desc: 'Nhóm tinh hoa siêu thịnh vượng, sở hữu danh mục tài sản đa quốc gia & đầu tư chiến lược.',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-400',
  },
  {
    topPercent: 'Top 1%',
    minAmount: 25_000_000_000,
    maxAmount: 75_000_000_000,
    rangeLabel: '25 Tỷ - 75 Tỷ VNĐ (~1M - 3M USD)',
    title: 'Triệu Phú USD (HNWI)',
    desc: 'Tầng lớp triệu phú tinh hoa, tự do tài chính tuyệt đối, nắm giữ BĐS và tài sản tạo dòng tiền lớn.',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    badgeText: 'text-emerald-700',
    borderColor: 'border-emerald-400',
  },
  {
    topPercent: 'Top 5%',
    minAmount: 8_000_000_000,
    maxAmount: 25_000_000_000,
    rangeLabel: '8 Tỷ - 25 Tỷ VNĐ',
    title: 'Thượng Lưu / Giàu Có',
    desc: 'Nhóm giàu có vững chắc, sở hữu nhiều BĐS giá trị, danh mục cổ phiếu và tích sản bền vững.',
    badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
    badgeText: 'text-blue-700',
    borderColor: 'border-blue-400',
  },
  {
    topPercent: 'Top 10%',
    minAmount: 3_500_000_000,
    maxAmount: 8_000_000_000,
    rangeLabel: '3.5 Tỷ - 8 Tỷ VNĐ',
    title: 'Cận Giàu / Trung Lưu Thượng Tầng',
    desc: 'Tầng lớp khá giả có nền tảng tích sản cao, sở hữu nhà ở ổn định và có danh mục đầu tư tăng trưởng.',
    badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    badgeText: 'text-indigo-700',
    borderColor: 'border-indigo-400',
  },
  {
    topPercent: 'Top 20%',
    minAmount: 1_500_000_000,
    maxAmount: 3_500_000_000,
    rangeLabel: '1.5 Tỷ - 3.5 Tỷ VNĐ',
    title: 'Trung Lưu Vững Vàng',
    desc: 'Đã tích lũy tài sản ròng đáng kể, vượt xa mức trung bình dân số, tài chính an toàn.',
    badgeBg: 'bg-teal-100 text-teal-900 border-teal-300',
    badgeText: 'text-teal-700',
    borderColor: 'border-teal-400',
  },
  {
    topPercent: 'Top 35%',
    minAmount: 600_000_000,
    maxAmount: 1_500_000_000,
    rangeLabel: '600 Triệu - 1.5 Tỷ VNĐ',
    title: 'Khá Giả Mới Nổi',
    desc: 'Nhóm tích lũy trên trung bình, có khoản tiết kiệm, tích sản hoặc đất nền/căn hộ giai đoạn đầu.',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
    badgeText: 'text-slate-700',
    borderColor: 'border-slate-300',
  },
  {
    topPercent: 'Top 50%',
    minAmount: 250_000_000,
    maxAmount: 600_000_000,
    rangeLabel: '250 Triệu - 600 Triệu VNĐ',
    title: 'Mức Trung Bình Xã Hội',
    desc: 'Tương đương tài sản bình quân người trưởng thành cả nước (~370 triệu VNĐ), đang trong giai đoạn gây dựng.',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    badgeText: 'text-slate-600',
    borderColor: 'border-slate-200',
  },
  {
    topPercent: 'Dưới Top 50%',
    minAmount: 0,
    maxAmount: 250_000_000,
    rangeLabel: 'Dưới 250 Triệu VNĐ',
    title: 'Giai Đoạn Bắt Đầu Tích Lũy',
    desc: 'Giai đoạn tập trung gia tăng thu nhập, xây dựng quỹ dự phòng và bắt đầu chu kỳ tích sản.',
    badgeBg: 'bg-slate-50 text-slate-600 border-slate-200',
    badgeText: 'text-slate-500',
    borderColor: 'border-slate-200',
  },
];

export const INCOME_TIERS: IncomeTier[] = [
  {
    topPercent: 'Top 0.1%',
    minMonthly: 250_000_000,
    maxMonthly: null,
    rangeLabel: 'Từ 250 Triệu VNĐ/tháng trở lên (~10,000+ USD)',
    title: 'Thu Nhập Tinh Hoa Cấp Cao',
    desc: 'Lãnh đạo tập đoàn, chủ doanh nghiệp lớn, nhà đầu tư chuyên nghiệp quy mô lớn.',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-400',
  },
  {
    topPercent: 'Top 1%',
    minMonthly: 120_000_000,
    maxMonthly: 250_000_000,
    rangeLabel: '120 Triệu - 250 Triệu VNĐ/tháng (~5,000 - 10,000 USD)',
    title: 'Thu Nhập Thượng Lưu',
    desc: 'Chuyên gia cấp cao, giám đốc điều hành, bác sĩ/chuyên gia đầu ngành hoặc kinh doanh xuất sắc.',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    badgeText: 'text-emerald-700',
    borderColor: 'border-emerald-400',
  },
  {
    topPercent: 'Top 5%',
    minMonthly: 60_000_000,
    maxMonthly: 120_000_000,
    rangeLabel: '60 Triệu - 120 Triệu VNĐ/tháng',
    title: 'Thu Nhập Rất Cao',
    desc: 'Quản lý cấp cao, nhân sự công nghệ/tài chính chất lượng cao, thu nhập đa nguồn vững mạnh.',
    badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
    badgeText: 'text-blue-700',
    borderColor: 'border-blue-400',
  },
  {
    topPercent: 'Top 10%',
    minMonthly: 35_000_000,
    maxMonthly: 60_000_000,
    rangeLabel: '35 Triệu - 60 Triệu VNĐ/tháng',
    title: 'Thu Nhập Cao Đô Thị',
    desc: 'Trưởng nhóm, chuyên viên senior, hộ kinh doanh có dòng tiền dương đều đặn.',
    badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    badgeText: 'text-indigo-700',
    borderColor: 'border-indigo-400',
  },
  {
    topPercent: 'Top 20%',
    minMonthly: 20_000_000,
    maxMonthly: 35_000_000,
    rangeLabel: '20 Triệu - 35 Triệu VNĐ/tháng',
    title: 'Thu Nhập Trung Lưu Khá',
    desc: 'Thu nhập vượt mức bình quân đô thị lớn, có dư địa tích lũy đầu tư hàng tháng.',
    badgeBg: 'bg-teal-100 text-teal-900 border-teal-300',
    badgeText: 'text-teal-700',
    borderColor: 'border-teal-400',
  },
  {
    topPercent: 'Top 35%',
    minMonthly: 12_000_000,
    maxMonthly: 20_000_000,
    rangeLabel: '12 Triệu - 20 Triệu VNĐ/tháng',
    title: 'Thu Nhập Khá',
    desc: 'Mức thu nhập phổ biến của lao động lành nghề tại Hà Nội và TP.HCM.',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
    badgeText: 'text-slate-700',
    borderColor: 'border-slate-300',
  },
  {
    topPercent: 'Top 50%',
    minMonthly: 7_500_000,
    maxMonthly: 12_000_000,
    rangeLabel: '7.5 Triệu - 12 Triệu VNĐ/tháng',
    title: 'Mức Bình Quân Lao Động',
    desc: 'Tương đương thu nhập bình quân cả nước (~8.5 triệu VNĐ/tháng theo GSO).',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    badgeText: 'text-slate-600',
    borderColor: 'border-slate-200',
  },
  {
    topPercent: 'Dưới Top 50%',
    minMonthly: 0,
    maxMonthly: 7_500_000,
    rangeLabel: 'Dưới 7.5 Triệu VNĐ/tháng',
    title: 'Thu Nhập Cơ Bản Ban Đầu',
    desc: 'Mức khởi điểm cho người mới đi làm hoặc khu vực nông thôn, cần ưu tiên nâng cao kỹ năng tăng thu nhập.',
    badgeBg: 'bg-slate-50 text-slate-600 border-slate-200',
    badgeText: 'text-slate-500',
    borderColor: 'border-slate-200',
  },
];

export function getVietnamWealthBenchmark(totalAssets: number) {
  const amount = Math.max(0, totalAssets || 0);
  const ratio = (amount / VN_AVERAGE_WEALTH);
  
  let currentTierIndex = WEALTH_TIERS.length - 1;
  for (let i = 0; i < WEALTH_TIERS.length; i++) {
    const tier = WEALTH_TIERS[i];
    if (amount >= tier.minAmount) {
      currentTierIndex = i;
      break;
    }
  }

  const currentTier = WEALTH_TIERS[currentTierIndex];

  let ratioText = '';
  if (ratio >= 1.1) {
    ratioText = `Gấp ${ratio.toFixed(1)}x mức bình quân VN (~370 Tr)`;
  } else if (ratio >= 0.9) {
    ratioText = `Tương đương mức bình quân VN (~370 Tr)`;
  } else {
    ratioText = `Bằng ${(ratio * 100).toFixed(0)}% mức bình quân VN (~370 Tr)`;
  }

  return {
    currentTier,
    currentTierIndex,
    allTiers: WEALTH_TIERS,
    ratio,
    ratioText,
    averageWealthVND: VN_AVERAGE_WEALTH,
  };
}

export function getVietnamIncomeBenchmark(monthlyIncome: number) {
  const amount = Math.max(0, monthlyIncome || 0);
  const ratio = (amount / VN_AVERAGE_MONTHLY_INCOME);
  
  let currentTierIndex = INCOME_TIERS.length - 1;
  for (let i = 0; i < INCOME_TIERS.length; i++) {
    const tier = INCOME_TIERS[i];
    if (amount >= tier.minMonthly) {
      currentTierIndex = i;
      break;
    }
  }

  const currentTier = INCOME_TIERS[currentTierIndex];

  let ratioText = '';
  if (ratio >= 1.1) {
    ratioText = `Gấp ${ratio.toFixed(1)}x bình quân cả nước (~8.5 Tr/tháng)`;
  } else if (ratio >= 0.9) {
    ratioText = `Tương đương bình quân cả nước (~8.5 Tr/tháng)`;
  } else {
    ratioText = `Bằng ${(ratio * 100).toFixed(0)}% bình quân cả nước (~8.5 Tr/tháng)`;
  }

  return {
    currentTier,
    currentTierIndex,
    allTiers: INCOME_TIERS,
    ratio,
    ratioText,
    averageIncomeMonthlyVND: VN_AVERAGE_MONTHLY_INCOME,
  };
}
