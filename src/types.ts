export type AssetLevel = '1' | '2' | '3';

export type AssetType =
  | 'cash'
  | 'saving'
  | 'gold'
  | 'realestate_live'
  | 'realestate_rent'
  | 'stock'
  | 'realestate_land'
  | 'bond'
  | 'crypto'
  | 'private_equity'
  | 'peer_lending';

export interface Asset {
  id: number;
  level: AssetLevel;
  type: AssetType;
  name: string;
  amount: number; // Giá trị hiện tại (VNĐ)
  costPrice?: number; // Tổng giá vốn ban đầu (VNĐ)
  unitPrice?: number; // Đơn giá vốn trung bình (VNĐ/đơn vị)
  currentPrice?: number; // Đơn giá thị trường hiện tại (VNĐ/đơn vị)
  unit?: string; // Đơn vị: CP, chỉ, lượng, VNĐ...
  rate?: number; // Lãi suất (%/năm)
  startDate?: string;
  termMonths?: number;
  maturityDate?: string; // Ngày đáo hạn (cho sổ tiết kiệm, trái phiếu)
  quantity?: number; // Số lượng (CP, Chỉ, Lượng...)
  cashflow?: number; // Dòng tiền thu về hàng tháng (VNĐ)
  divCash?: number; // Cổ tức tiền mặt (VNĐ/CP/năm)
  updatedAt?: string;
  note?: string;
  isNoTerm?: boolean; // Không kỳ hạn (cho sổ tiết kiệm/tiền gửi không kỳ hạn)
}

export interface AssetTransaction {
  id: string; // ID duy nhất của đợt giao dịch
  assetId?: number; // ID tài sản liên kết ở Tab 1
  goalId?: number; // ID mục tiêu liên kết ở Tab 3
  assetName?: string; // Tên tài sản/mục tiêu tại thời điểm giao dịch
  date: string; // YYYY-MM-DD
  type: 'buy' | 'deposit' | 'sell' | 'withdraw'; // Mua gom, nạp thêm, bán, rút
  quantity: number; // Số lượng mua/nạp (chỉ, CP, VNĐ...)
  unit?: string; // CP, chỉ, lượng, VNĐ...
  pricePerUnit: number; // Đơn giá mua đợt này (VNĐ/đơn vị)
  totalAmount: number; // Thành tiền = quantity * pricePerUnit (hoặc số tiền nạp)
  rate?: number; // Lãi suất tiền gửi tiết kiệm (%/năm)
  termMonths?: number; // Kỳ hạn tiền gửi tiết kiệm (tháng)
  note?: string; // Ghi chú (tiệm vàng, sàn GD, số GD...)
  createdAt?: string; // ISO string
}

export type DebtCategory = 'type1' | 'type2' | 'type_free' | 'type3' | 'type4';

export interface Debt {
  id: number;
  category: DebtCategory;
  name: string;
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'flexible';
  startDate?: string;
  day?: number;
  amount: number; // Tổng nợ gốc / hạn mức
  termMonths?: number;
  installmentAmount?: number;
  periodicAmount?: number;
  promoMonths?: number;
  promoEndDate?: string; // Mốc kết thúc ưu đãi lãi suất
  promoRate?: number;
  normalRate?: number;
  monthlyBefore: number;
  monthlyAfter: number;
  paidPrincipal: number;
  note?: string;
  status: 'Chưa tất toán' | 'Đã tất toán';
  settledDate?: string;
  isNoTerm?: boolean; // Không kỳ hạn (trả linh hoạt, không có hạn thanh toán tiếp theo)
}

export type GoalGroup = 'debt' | 'dca' | 'runway' | 'milestone';

export type GoalAssetType = 'stock' | 'gold' | 'saving' | 'bond' | 'cash' | 'other';

export interface Goal {
  id: number;
  group: GoalGroup; // 1: Trả nợ, 2: Tích sản DCA, 3: Dự phòng Runway, 4: Cột mốc lớn / BĐS
  goalType: 'dca' | 'milestone';
  assetType?: GoalAssetType;
  linkedAssetId?: number; // ID tài sản liên kết chuẩn xác từ Tab 1
  linkedBankKey?: string; // Khóa ngân hàng liên kết để lấy số tổng từ Tab 1 (VD: 'ncb', 'vietcombank')
  linkedDebtId?: number; // ID khoản nợ liên kết từ Tab 2 (nếu là nhóm trả nợ)
  name: string;
  freqMonths?: number; // Chu kỳ (1: hàng tháng, 3: hàng quý, etc.)
  targetQty?: number; // Định mức SL (CP, chỉ) hoặc số tiền định mức kỳ
  targetAmountPerPeriod?: number; // Số tiền nạp định kỳ (cho tiết kiệm / quỹ)
  unit?: string; // CP, chỉ, lượng, VNĐ
  day?: number; // Ngày chốt mua / nạp trong tháng
  backlogQty?: number; // Nợ chỉ tiêu chưa mua bù
  totalBought?: number; // Tổng số lượng hoặc tiền đã tích lũy qua các kỳ
  unitPrice?: number; // Đơn giá vốn trung bình (đ/chỉ hoặc đ/CP)
  currentPrice?: number; // Đơn giá thị trường hiện tại (đ/chỉ hoặc đ/CP)
  costPrice?: number; // Tổng giá vốn ban đầu (VNĐ)
  lastBoughtPeriod?: string; // Kỳ đã mua gần nhất (VD: 2026-09)
  target?: number; // Tổng số tiền mục tiêu (cho milestone)
  years?: number; // Thời hạn hoàn thành (năm)
  createdAt?: string; // YYYY-MM
  status?: 'active' | 'completed' | 'pending';
  note?: string;
}

export interface HistoryPoint {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
  totalInflow?: number;
  totalOutflow?: number;
  netCashFlow?: number;
  debtProgressPercent?: number;
  dcaProgressPercent?: number;
  runwayPercent?: number;
  milestoneProgressPercent?: number;
  timestamp: number;
}

export interface CustomSmtpConfig {
  host?: string;
  port?: number;
  user: string;
  pass: string;
  secure?: boolean;
}

export type ScheduleFrequency = 'weekly' | 'monthly' | '2months' | 'quarterly' | '6months' | 'yearly';

export type ActiveTab = 'pyramid' | 'debts' | 'goals' | 'market';

export interface EmailScheduleSettings {
  enabled: boolean;
  email: string;
  emails?: string[]; // Hỗ trợ nhiều địa chỉ email nhận cùng lúc
  frequency?: ScheduleFrequency; // 'weekly' | 'monthly' | '2months' | 'quarterly' | '6months' | 'yearly'
  sendWeekday?: number; // 0 = Chủ Nhật, 1 = Thứ Hai, ..., 6 = Thứ Bảy (khi frequency === 'weekly')
  sendDay: number; // 1 - 31 (ngày gửi trong tháng)
  sendHour: number; // 0 - 23 (giờ gửi)
  includeMonthlyGoals: boolean;
  includeNetWorthOverview: boolean;
  includeDebts: boolean;
  includeCashFlow: boolean;
  includeAssetPyramid: boolean;
  lastSentMonth?: string; // e.g. "2026-09"
  lastSavedAt?: string; // e.g. "18:50 - 14/09/2026"
}

export interface DatabaseState {
  assets: Asset[];
  debts: Debt[];
  goals: Goal[];
  transactions?: AssetTransaction[];
  history: HistoryPoint[];
  salaryIncome: number;
  otherIncome: number;
  lastUpdate: string;
  updatedAtTimestamp?: number;
  emailSchedule?: EmailScheduleSettings;
  stockWatchlist?: string[];
}

