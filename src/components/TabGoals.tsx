import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Goal, DatabaseState, GoalGroup, GoalAssetType, Asset, Debt, AssetTransaction } from '../types';
import {
  formatVND,
  formatNumberString,
  parseFormattedNumber,
  parseFormattedDecimal,
  calculateDCADaysRemaining,
  calculateMilestoneDueDate,
  getStandardTimeline,
  getActualTimelinePoints,
} from '../utils/format';
import { createPointValuePlugin } from '../utils/chartPlugin';
import { Chart, registerables } from 'chart.js';
import { AssetHistoryModal } from './AssetHistoryModal';
import { fetchGoldRates, getRecommendedGoldPrice, getDojiPrices, GoldRateData } from '../utils/goldService';
import { ConfirmModal } from './ConfirmModal';
import {
  groupSavingsByBank,
  resolveGoalBankSavings,
  GoalBankResolution,
} from '../utils/bankUtils';
import {
  fetchStockRates,
  getStockQuote,
  extractStockTicker,
  isStockEntity,
  collectAllStockSymbols,
  StockRateData,
} from '../utils/stockService';
import {
  Target,
  PlusCircle,
  TrendingUp,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Clock,
  Pen,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  Filter,
  DollarSign,
  Layers,
  ArrowRight,
  X,
  History,
  Landmark,
  CreditCard,
  RefreshCw,
  Globe,
  Building2,
  Activity,
  Award,
  AlertTriangle,
} from 'lucide-react';

Chart.register(...registerables);

interface TabGoalsProps {
  db: DatabaseState;
  isPrivacyMode: boolean;
  onUpdateGoal: (goal: Goal) => void;
  onRemoveGoal: (id: number) => void;
  onUpdateAssetDirectly: (asset: Asset) => void;
  onUpdateDebtDirectly?: (debt: Debt) => void;
  onSaveTransactions?: (updatedTxs: AssetTransaction[], updatedAsset?: Asset, updatedGoal?: Goal) => void;
  onSwitchTab?: (tab: 'pyramid' | 'debts' | 'goals' | 'market') => void;
  goldData?: GoldRateData | null;
  stockData?: StockRateData | null;
  onSyncMarketPrices?: () => void;
}

const goalGroupLabels: Record<GoalGroup, { name: string; tagClass: string; icon: string; desc: string }> = {
  debt: {
    name: 'Nhóm 1: Trả Nợ & Giảm Đòn Bẩy',
    tagClass: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'fa-file-invoice-dollar',
    desc: 'Tập trung hạ nhanh dư nợ gốc, tối ưu chi phí lãi vay và giảm tải trọng nghĩa vụ.',
  },
  dca: {
    name: 'Nhóm 2: Tích Sản Định Kỳ (DCA)',
    tagClass: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'fa-coins',
    desc: 'Tích lũy tài sản chất lượng cao theo chu kỳ đều đặn (Cổ phiếu, Vàng, Tiền gửi tiết kiệm).',
  },
  runway: {
    name: 'Nhóm 3: Quỹ Dự Phòng (Runway)',
    tagClass: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: 'fa-shield-halved',
    desc: 'Dự phòng thanh khoản 3-6-12 tháng sinh hoạt phí và nghĩa vụ nợ, bảo vệ gia đình trước biến cố.',
  },
  milestone: {
    name: 'Nhóm 4: Cột Mốc Lớn / Quỹ BĐS / FIRE',
    tagClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: 'fa-landmark',
    desc: 'Các cột mốc quy mô vốn lớn (Mua nhà đất, mua xe, quỹ khởi nghiệp, tự do tài chính).',
  },
};

export const TabGoals: React.FC<TabGoalsProps> = ({
  db,
  isPrivacyMode,
  onUpdateGoal,
  onRemoveGoal,
  onUpdateAssetDirectly,
  onUpdateDebtDirectly,
  onSaveTransactions,
  onSwitchTab,
  goldData: initialGoldData,
  stockData: initialStockData,
  onSyncMarketPrices,
}) => {
  // Filters
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<GoalGroup | 'all'>('all');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<'all' | 'month' | 'quarter' | '6months' | 'year' | 'longterm'>('all');
  const [goalChartRange, setGoalChartRange] = useState<'quarter' | 'year' | '3years' | '5years'>('year');

  // Form toggles
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showGoalStandards, setShowGoalStandards] = useState(false);
  const [formMode, setFormMode] = useState<'dca' | 'milestone'>('dca');
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);

  // History modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryGoal, setSelectedHistoryGoal] = useState<Goal | null>(null);
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState<Asset | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<{ id: number; name: string } | null>(null);
  const [goalToComplete, setGoalToComplete] = useState<Goal | null>(null);

  // Form refs for smooth auto-jump and focus
  const goalFormRef = useRef<HTMLFormElement | null>(null);
  const goalNameInputRef = useRef<HTMLInputElement | null>(null);

  // Form states
  const [goalGroup, setGoalGroup] = useState<GoalGroup>('dca');
  const [assetType, setAssetType] = useState<GoalAssetType>('stock');
  const [linkedAssetId, setLinkedAssetId] = useState<number | undefined>(undefined);
  const [linkedBankKey, setLinkedBankKey] = useState<string | undefined>(undefined);
  const [linkedDebtId, setLinkedDebtId] = useState<number | undefined>(undefined);
  const [goalName, setGoalName] = useState('');

  // Gom nhóm sổ tiết kiệm theo ngân hàng từ Tab 1 để lấy số tổng
  const savingAssets = useMemo(() => db.assets.filter((a) => a.type === 'saving'), [db.assets]);
  const savingBankGroups = useMemo(() => groupSavingsByBank(savingAssets), [savingAssets]);
  const [freqMonths, setFreqMonths] = useState(1);
  const [targetQtyStr, setTargetQtyStr] = useState('');
  const [unit, setUnit] = useState('CP');
  const [goalDay, setGoalDay] = useState(10);
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalYears, setGoalYears] = useState(2);
  const [goalNote, setGoalNote] = useState('');

  // Editable Accumulated Results & Backlog States
  const [editTotalBoughtStr, setEditTotalBoughtStr] = useState('');
  const [editBacklogQtyStr, setEditBacklogQtyStr] = useState('');
  const [editUnitPriceStr, setEditUnitPriceStr] = useState('');
  const [editCurrentPriceStr, setEditCurrentPriceStr] = useState('');
  const [editSyncToAsset, setEditSyncToAsset] = useState(true);
  const [editIsPaidThisPeriod, setEditIsPaidThisPeriod] = useState(false);

  // DCA Modal & Toast states
  const [dcaDepositGoal, setDcaDepositGoal] = useState<Goal | null>(null);
  const [depositAmountStr, setDepositAmountStr] = useState('');
  const [depositPriceStr, setDepositPriceStr] = useState('');
  const [depositAutoSyncAsset, setDepositAutoSyncAsset] = useState(true);

  const [dcaBacklogGoal, setDcaBacklogGoal] = useState<Goal | null>(null);
  const [backlogInputStr, setBacklogInputStr] = useState('');

  // Modal Mở Sổ Tiết Kiệm Mới (Tạo tài sản độc lập trong Tab 1 khi đạt mục tiêu hoặc hoàn thành)
  const [goalForNewSaving, setGoalForNewSaving] = useState<Goal | null>(null);
  const [savingName, setSavingName] = useState('');
  const [savingBank, setSavingBank] = useState('Vietcombank');
  const [savingCustomBank, setSavingCustomBank] = useState('');
  const [savingAmountStr, setSavingAmountStr] = useState('');
  const [savingTermMonths, setSavingTermMonths] = useState(12);
  const [savingRateStr, setSavingRateStr] = useState('5.5');
  const [savingStartDate, setSavingStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal Ghi Nhận Trả Nợ (Đồng bộ trực tiếp sang Tab 2)
  const [goalForPayDebt, setGoalForPayDebt] = useState<Goal | null>(null);
  const [payDebtAmountStr, setPayDebtAmountStr] = useState('');
  const [payDebtNote, setPayDebtNote] = useState('');

  const [toastBanner, setToastBanner] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastBanner({ text, type });
    setTimeout(() => {
      setToastBanner((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  // Real-time Gold Rates State
  const [goldData, setGoldData] = useState<GoldRateData | null>(initialGoldData || null);
  const [isLoadingGold, setIsLoadingGold] = useState(false);

  useEffect(() => {
    if (initialGoldData) setGoldData(initialGoldData);
  }, [initialGoldData]);

  // Hàm tự động cập nhật đơn giá bán DOJI vào mục tiêu Tab 3 và đơn giá mua DOJI vào tài sản Tab 1 để tính giá trị thực tế
  const applyDojiGoldRates = (data: GoldRateData | null, notify = false) => {
    if (!data || !data.summary) return;

    let updatedGoalCount = 0;
    let updatedAssetCount = 0;

    // 1. Tự động cập nhật đơn giá BÁN Doji vào mục tiêu ở Tab 3
    db.goals.forEach((g) => {
      const isGold =
        g.assetType === 'gold' ||
        g.unit === 'chỉ' ||
        g.unit === 'lượng' ||
        g.unit === 'cây' ||
        g.name.toLowerCase().includes('vàng') ||
        g.name.toLowerCase().includes('doji') ||
        g.name.toLowerCase().includes('gold');

      if (isGold) {
        const { sellPrice } = getDojiPrices(data, g.unit, g.name);
        if (g.currentPrice !== sellPrice) {
          const updatedGoal: Goal = {
            ...g,
            currentPrice: sellPrice,
          };
          onUpdateGoal(updatedGoal);
          updatedGoalCount++;
        }
      }
    });

    // 2. Tự động cập nhật đơn giá MUA Doji ở Tab tài sản 1 để tính giá trị thực tế
    db.assets.forEach((a) => {
      const isGold =
        a.type === 'gold' ||
        a.unit === 'chỉ' ||
        a.unit === 'lượng' ||
        a.unit === 'cây' ||
        a.name.toLowerCase().includes('vàng') ||
        a.name.toLowerCase().includes('doji') ||
        a.name.toLowerCase().includes('gold');

      if (isGold) {
        const { buyPrice } = getDojiPrices(data, a.unit, a.name);
        const qty = a.quantity || 0;
        const newActualAmount = qty > 0 ? Math.round(qty * buyPrice) : a.amount;

        if (a.currentPrice !== buyPrice || (qty > 0 && a.amount !== newActualAmount)) {
          const updatedAsset: Asset = {
            ...a,
            currentPrice: buyPrice,
            amount: newActualAmount,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          onUpdateAssetDirectly(updatedAsset);
          updatedAssetCount++;
        }
      }
    });

    if (notify) {
      const dojiBuyStr = formatVND(data.summary.dojiBuyPerChi || 14400000, isPrivacyMode);
      const dojiSellStr = formatVND(data.summary.dojiSellPerChi || 14800000, isPrivacyMode);
      if (updatedGoalCount > 0 || updatedAssetCount > 0) {
        showToast(
          `✓ Đã cập nhật giá DOJI: Bán ra ${dojiSellStr}/chỉ (mục tiêu Tab 3), Mua vào ${dojiBuyStr}/chỉ (tài sản Tab 1)!`,
          'success'
        );
      } else {
        showToast(
          `✓ Dữ liệu DOJI mới nhất: Mua vào ${dojiBuyStr}/chỉ, Bán ra ${dojiSellStr}/chỉ. Tất cả mục tiêu và tài sản đã khớp giá!`,
          'info'
        );
      }
    }
  };

  // Tải giá vàng khi khởi tạo và tự động cập nhật giá DOJI
  useEffect(() => {
    fetchGoldRates(false).then((data) => {
      if (data && data.success) {
        setGoldData(data);
        applyDojiGoldRates(data, false);
      }
    });
  }, []);

  // Tự động đối chiếu và cập nhật giá Doji khi có dữ liệu giá vàng mới
  const lastSyncedGoldTimestampRef = useRef<string>('');
  useEffect(() => {
    if (goldData && goldData.success && goldData.fetchedAt !== lastSyncedGoldTimestampRef.current) {
      lastSyncedGoldTimestampRef.current = goldData.fetchedAt || 'synced';
      applyDojiGoldRates(goldData, false);
    }
  }, [goldData]);

  const handleRefreshGoldRates = async () => {
    setIsLoadingGold(true);
    try {
      const data = await fetchGoldRates(true);
      setGoldData(data);
      applyDojiGoldRates(data, true);
    } catch {
      showToast('Không thể kết nối đến máy chủ giá vàng. Vui lòng thử lại sau.', 'warning');
    } finally {
      setIsLoadingGold(false);
    }
  };

  // Cập nhật giá Doji cho tất cả mục tiêu Vàng (Tab 3) và tài sản Vàng (Tab 1)
  const handleApplyAllGoldGoals = () => {
    if (!goldData) return;
    applyDojiGoldRates(goldData, true);
  };

  // Real-time Stock Rates State - Bảng giá cổ phiếu (Đã có & Mục tiêu)
  const [stockData, setStockData] = useState<StockRateData | null>(initialStockData || null);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);

  useEffect(() => {
    if (initialStockData) setStockData(initialStockData);
  }, [initialStockData]);

  // Hàm tự động cập nhật giá cổ phiếu vào mục tiêu Tab 3 và tài sản Tab 1
  const applyLiveStockRates = (data: StockRateData | null, notify = false) => {
    if (!data || !data.stocks) return;

    let updatedGoalCount = 0;
    let updatedAssetCount = 0;

    // 1. Tự động cập nhật đơn giá thị trường vào mục tiêu cổ phiếu ở Tab 3
    db.goals.forEach((g) => {
      if (isStockEntity(g)) {
        const sym = extractStockTicker(g.name, g.assetType, g.unit);
        const quote = sym ? getStockQuote(data, sym) : null;
        if (quote && quote.price > 0 && g.currentPrice !== quote.price) {
          const updatedGoal: Goal = {
            ...g,
            currentPrice: quote.price,
          };
          onUpdateGoal(updatedGoal);
          updatedGoalCount++;
        }
      }
    });

    // 2. Tự động cập nhật đơn giá thị trường và tính lại giá trị tài sản cổ phiếu ở Tab 1
    db.assets.forEach((a) => {
      if (isStockEntity(a)) {
        const sym = extractStockTicker(a.name, a.type, a.unit);
        const quote = sym ? getStockQuote(data, sym) : null;
        if (quote && quote.price > 0) {
          const qty = a.quantity || 0;
          const newActualAmount = qty > 0 ? Math.round(qty * quote.price) : a.amount;

          if (a.currentPrice !== quote.price || (qty > 0 && a.amount !== newActualAmount)) {
            const updatedAsset: Asset = {
              ...a,
              currentPrice: quote.price,
              amount: newActualAmount,
              updatedAt: new Date().toLocaleDateString('vi-VN'),
            };
            onUpdateAssetDirectly(updatedAsset);
            updatedAssetCount++;
          }
        }
      }
    });

    if (notify) {
      if (updatedGoalCount > 0 || updatedAssetCount > 0) {
        showToast(
          `✓ Đã tự động link giá cổ phiếu: Cập nhật ${updatedGoalCount} mục tiêu (Tab 3) và ${updatedAssetCount} tài sản (Tab 1)!`,
          'success'
        );
      } else {
        showToast(
          `✓ Bảng giá cổ phiếu thị trường đã khớp với toàn bộ mục tiêu và tài sản!`,
          'info'
        );
      }
    }
  };

  // Tải bảng giá cổ phiếu khi khởi tạo và tự động liên kết
  useEffect(() => {
    const symbols = collectAllStockSymbols(db.assets, db.goals);
    fetchStockRates(symbols, false).then((data) => {
      if (data && data.success) {
        setStockData(data);
        applyLiveStockRates(data, false);
      }
    });
  }, []);

  // Tự động đối chiếu và cập nhật giá cổ phiếu khi có dữ liệu bảng giá mới
  const lastSyncedStockTimestampRef = useRef<string>('');
  useEffect(() => {
    if (stockData && stockData.success && stockData.fetchedAt !== lastSyncedStockTimestampRef.current) {
      lastSyncedStockTimestampRef.current = stockData.fetchedAt || 'synced';
      applyLiveStockRates(stockData, false);
    }
  }, [stockData]);

  const handleRefreshStockRates = async () => {
    setIsLoadingStocks(true);
    try {
      const symbols = collectAllStockSymbols(db.assets, db.goals);
      const data = await fetchStockRates(symbols, true);
      setStockData(data);
      applyLiveStockRates(data, true);
    } catch {
      showToast('Không thể kết nối đến máy chủ giá cổ phiếu. Vui lòng thử lại sau.', 'warning');
    } finally {
      setIsLoadingStocks(false);
    }
  };

  const handleApplyAllStockGoals = () => {
    if (!stockData) return;
    applyLiveStockRates(stockData, true);
  };

  // Table & Stress test states
  const [showPillarList, setShowPillarList] = useState(false); // Mặc định là ẩn danh sách 4 trụ cột
  const [showGoalTable, setShowGoalTable] = useState(true);
  const [showStressTest, setShowStressTest] = useState(false);
  const [simTargetValStr, setSimTargetValStr] = useState('3.000.000.000');
  const [simMonthsLeft, setSimMonthsLeft] = useState(24);
  const [simCashValStr, setSimCashValStr] = useState('');
  const [simGoldValStr, setSimGoldValStr] = useState('');
  const [simStockValStr, setSimStockValStr] = useState('');
  const [simEmergencyFundStr, setSimEmergencyFundStr] = useState('150.000.000');
  const [simLoanYears, setSimLoanYears] = useState(20);
  const [simGraceYears, setSimGraceYears] = useState(0);
  const [simPromoMonths, setSimPromoMonths] = useState(24);
  const [simPromoRate, setSimPromoRate] = useState(6.5);
  const [simNormalRate, setSimNormalRate] = useState(10.5);
  const [simStressRate, setSimStressRate] = useState(12.5);

  const chartProgressRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Calculations from Tab 1 & Tab 2 for Cash Flow Alignment
  const totalAssets = db.assets.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalDebts = db.debts.reduce((sum, d) => {
    if (d.category === 'type1' || d.category === 'type2' || d.category === 'type_free') {
      return sum + Math.max(0, d.amount - (d.paidPrincipal || 0));
    }
    return sum;
  }, 0);
  const netWorth = totalAssets - totalDebts;

  const totalPassiveInflow = db.assets.reduce((sum, a) => {
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

  const totalMonthlyInflow = (db.salaryIncome || 0) + (db.otherIncome || 0) + totalPassiveInflow;

  let totalMonthlyDebtOutflow = 0;
  let totalPrincipalMonthlyDebt = 0;
  let totalInterestMonthlyDebt = 0;
  let totalPeriodicMonthlyDebt = 0;
  let totalLivingMonthlyDebt = 0;

  db.debts.forEach((d) => {
    if (d.status !== 'Đã tất toán' && d.category !== 'type_free') {
      let m = d.monthlyBefore || d.installmentAmount || d.periodicAmount || 0;
      if (d.frequency === 'annual') m = Math.round(m / 12);
      else if (d.frequency === 'biannual') m = Math.round(m / 6);
      else if (d.frequency === 'quarterly') m = Math.round(m / 3);
      totalMonthlyDebtOutflow += m;

      if (d.category === 'type1') {
        const principal = d.termMonths ? Math.round(d.amount / d.termMonths) : 0;
        totalPrincipalMonthlyDebt += principal;
        totalInterestMonthlyDebt += Math.max(0, m - principal);
      } else if (d.category === 'type2') {
        totalPrincipalMonthlyDebt += m;
      } else if (d.category === 'type3') {
        totalPeriodicMonthlyDebt += m;
      } else if (d.category === 'type4') {
        totalLivingMonthlyDebt += m;
      }
    }
  });

  // Net surplus available for goals
  const monthlySurplusAvailable = Math.max(0, totalMonthlyInflow - totalMonthlyDebtOutflow);

  // Calculate Monthly Allocation Required by All Active Goals
  const monthlyGoalAllocation = db.goals.reduce((sum, g) => {
    if (g.status === 'completed') return sum;
    if (g.goalType === 'dca') {
      const f = g.freqMonths || 1;
      if (g.assetType === 'saving' || g.unit === 'VNĐ') {
        const amt = g.targetAmountPerPeriod || g.targetQty || 0;
        return sum + Math.round(amt / f);
      } else if (g.assetType === 'stock') {
        // Estimate value from Tab 1 stock price if linked
        const linked = db.assets.find((a) => a.id === g.linkedAssetId || a.name.toLowerCase() === g.name.toLowerCase());
        const unitPrice = linked && linked.quantity && linked.quantity > 0 ? Math.round(linked.amount / linked.quantity) : 30000;
        const perPeriod = (g.targetQty || 1) * unitPrice;
        return sum + Math.round(perPeriod / f);
      } else if (g.assetType === 'gold') {
        const perPeriod = (g.targetQty || 1) * 8500000; // ~8.5M/chỉ
        return sum + Math.round(perPeriod / f);
      }
      return sum + Math.round((g.targetQty || 0) / f);
    } else {
      // Milestone
      const yrs = g.years || 1;
      const target = g.target || 0;
      return sum + Math.round(target / (yrs * 12));
    }
  }, 0);

  // Free cash buffer after goal allocation
  const remainingFreeBuffer = monthlySurplusAvailable - monthlyGoalAllocation;
  const allocationBurdenRatio =
    monthlySurplusAvailable > 0 ? Math.round((monthlyGoalAllocation / monthlySurplusAvailable) * 100) : 0;

  // 4 Pillar Progress Metrics
  const totalDebtOriginal = db.debts
    .filter((d) => d.category === 'type1' || d.category === 'type2' || d.category === 'type_free')
    .reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalDebtPaid = db.debts
    .filter((d) => d.category === 'type1' || d.category === 'type2' || d.category === 'type_free')
    .reduce((sum, d) => sum + (d.status === 'Đã tất toán' ? d.amount : d.paidPrincipal || 0), 0);
  const debtProgressPercent =
    totalDebtOriginal > 0 ? Math.min(100, Math.round((totalDebtPaid / totalDebtOriginal) * 100)) : 100;

  const dcaGoals = db.goals.filter((g) => g.group === 'dca' || g.goalType === 'dca');
  const dcaCount = dcaGoals.length;
  const currentDcaPct = Math.min(
    100,
    Math.round(
      dcaCount > 0
        ? (db.goals.filter((g) => (g.group === 'dca' || g.goalType === 'dca') && (g.totalBought || 0) >= (g.targetQty || 1)).length / dcaCount) * 100
        : 85
    )
  );

  const liquidAssets = db.assets
    .filter((a) => a.level === '1' && (a.type === 'cash' || a.type === 'saving' || a.type === 'gold'))
    .reduce((sum, a) => sum + a.amount, 0);
  const runwayMonths = totalMonthlyDebtOutflow > 0 ? (liquidAssets / totalMonthlyDebtOutflow).toFixed(1) : '0';
  const runwayPercent = Math.min(100, Math.round((Number(runwayMonths) / 6) * 100));

  const milestoneGoals = db.goals.filter((g) => g.group === 'milestone' || g.goalType === 'milestone');
  const totalMilestoneTarget = milestoneGoals.reduce((sum, g) => sum + (g.target || 0), 0);
  const milestoneProgressPercent =
    totalMilestoneTarget > 0 ? Math.min(100, Math.round((netWorth / totalMilestoneTarget) * 100)) : 0;

  // Filtered Goals
  const now = new Date();
  const currentPeriodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Danh sách các mục tiêu DCA đang có nợ (nợ dồn, dời nợ sang kỳ sau) hoặc quá hạn
  const overdueDcaGoals = useMemo(() => {
    return db.goals.filter((g) => {
      if (g.status === 'completed') return false;
      const isDCA = g.group === 'dca' || g.goalType === 'dca' || Boolean(g.day);
      if (!isDCA) return false;
      const isBought = g.lastBoughtPeriod === currentPeriodStr;
      const isDeferred = Boolean(
        g.lastBoughtPeriod &&
        (g.lastBoughtPeriod.startsWith('Chuyển nợ') || g.lastBoughtPeriod.startsWith('Chưa nạp')) &&
        g.lastBoughtPeriod.includes(currentPeriodStr)
      );
      const { isOverdue } = calculateDCADaysRemaining(g.day || 10, g.freqMonths || 1, isBought);
      const hasBacklog = (g.backlogQty || 0) > 0;
      // Mục tiêu đang nợ: hoặc có nợ dồn backlog, hoặc đã chuyển nợ kỳ này, hoặc quá hạn mà chưa nạp
      return hasBacklog || isDeferred || (!isBought && isOverdue);
    });
  }, [db.goals, currentPeriodStr]);

  const filteredGoals = db.goals.filter((g) => {
    // Filter by group
    if (selectedGroupFilter !== 'all' && g.group !== selectedGroupFilter) {
      return false;
    }

    // Filter by time horizon
    if (selectedTimeFilter === 'month') {
      // Due this month
      if (g.goalType === 'dca' && g.freqMonths !== 1) return false;
      if (g.goalType === 'milestone' && (g.years || 1) > 1) return false;
    } else if (selectedTimeFilter === 'quarter') {
      if (g.goalType === 'dca' && (g.freqMonths || 1) > 3) return false;
      if (g.goalType === 'milestone' && (g.years || 1) > 1) return false;
    } else if (selectedTimeFilter === '6months') {
      if (g.goalType === 'dca' && (g.freqMonths || 1) > 6) return false;
      if (g.goalType === 'milestone' && (g.years || 1) > 2) return false;
    } else if (selectedTimeFilter === 'year') {
      if (g.goalType === 'milestone' && (g.years || 1) > 1) return false;
    } else if (selectedTimeFilter === 'longterm') {
      if (g.goalType === 'milestone' && (g.years || 1) < 2) return false;
    }

    return true;
  });

  // Render chart - chỉ hiển thị các tháng thực tế có dữ liệu từ tháng bắt đầu
  useEffect(() => {
    if (!chartProgressRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const currentDcaPct = Math.min(
      100,
      Math.round(
        dcaCount > 0
          ? (db.goals.filter((g) => (g.group === 'dca' || g.goalType === 'dca') && (g.totalBought || 0) >= (g.targetQty || 1)).length / dcaCount) * 100
          : 85
      )
    );

    const points = getActualTimelinePoints(
      db,
      {
        netWorth: 0,
        totalAssets: 0,
        totalDebts: 0,
        inflow: 0,
        outflow: 0,
        netCashFlow: 0,
        debtProgressPercent,
        dcaProgressPercent: currentDcaPct,
        runwayPercent,
        milestoneProgressPercent,
      },
      goalChartRange
    );

    const labels = points.map((p) => p.label);
    const debtLine = points.map((p) => p.debtProgressPercent);
    const assetLine = points.map((p) => p.dcaProgressPercent);
    const runwayLine = points.map((p) => p.runwayPercent);
    const milestoneLine = points.map((p) => p.milestoneProgressPercent);

    const ctx = chartProgressRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Trả Nợ Vay',
            data: debtLine,
            borderColor: '#f43f5e',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#f43f5e',
            pointBorderWidth: 2,
          },
          {
            label: 'Tích Sản DCA',
            data: assetLine,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#10b981',
            pointBorderWidth: 2,
          },
          {
            label: 'Dự Phòng Runway',
            data: runwayLine,
            borderColor: '#3b82f6',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#3b82f6',
            pointBorderWidth: 2,
          },
          {
            label: 'Cột Mốc Lớn',
            data: milestoneLine,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#f59e0b',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 36,
            bottom: 16,
            left: 10,
            right: 10,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            min: 0,
            max: 115,
            ticks: {
              stepSize: 25,
              callback: (val) => (Number(val) <= 100 ? val + '%' : ''),
            },
          },
        },
      },
      plugins: [createPointValuePlugin({ valueType: 'percent' })],
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [
    db,
    debtProgressPercent,
    runwayPercent,
    totalMilestoneTarget,
    netWorth,
    totalAssets,
    goalChartRange,
  ]);

  // Tự động rà soát và tìm kiếm tài sản phù hợp nhất ở Tab 1 (Ưu tiên đúng loại tài sản)
  const findBestMatchingTab1Asset = (
    currentGoalName: string,
    currentAssetType: GoalAssetType | string,
    currentUnit?: string
  ): { assetId?: number; bankKey?: string; matchedAsset?: Asset } => {
    const rawName = (currentGoalName || '').trim().toLowerCase();

    // 1. Tiết kiệm / Ngân hàng: Rà soát theo số tổng ngân hàng trước, sau đó tới từng sổ
    if (currentAssetType === 'saving' || currentUnit === 'VNĐ' || rawName.includes('tiết kiệm') || rawName.includes('sổ') || rawName.includes('ngân hàng')) {
      if (rawName) {
        const matchedBankGroup = savingBankGroups.find(
          (bg) => rawName.includes(bg.bankKey) || rawName.includes(bg.bankName.toLowerCase())
        );
        if (matchedBankGroup) {
          return { bankKey: matchedBankGroup.bankKey };
        }
      }
      if (rawName) {
        const savingAsset = db.assets.find(
          (a) => a.type === 'saving' && (a.name.toLowerCase().includes(rawName) || rawName.includes(a.name.toLowerCase()))
        );
        if (savingAsset) return { assetId: savingAsset.id, matchedAsset: savingAsset };
      }
      if (currentAssetType === 'saving' && savingBankGroups.length === 1 && !rawName) {
        return { bankKey: savingBankGroups[0].bankKey };
      }
      const savingAssets = db.assets.filter((a) => a.type === 'saving');
      if (currentAssetType === 'saving' && savingAssets.length === 1 && !rawName) {
        return { assetId: savingAssets[0].id, matchedAsset: savingAssets[0] };
      }
    }

    // 2. Cổ phiếu: Rà soát Cổ phiếu ở Tab 1 (Ưu tiên đúng type === 'stock')
    if (currentAssetType === 'stock' || currentUnit === 'CP') {
      const ticker = extractStockTicker(currentGoalName, 'stock', 'CP');
      if (ticker) {
        const stockAsset = db.assets.find(
          (a) => a.type === 'stock' && (a.name.toUpperCase().includes(ticker) || ticker.includes(a.name.toUpperCase()))
        );
        if (stockAsset) return { assetId: stockAsset.id, matchedAsset: stockAsset };
      }
      if (rawName) {
        const stockByName = db.assets.find(
          (a) => a.type === 'stock' && (a.name.toLowerCase().includes(rawName) || rawName.includes(a.name.toLowerCase()))
        );
        if (stockByName) return { assetId: stockByName.id, matchedAsset: stockByName };
      }
      const stockAssets = db.assets.filter((a) => a.type === 'stock');
      if (currentAssetType === 'stock' && stockAssets.length === 1 && !rawName) {
        return { assetId: stockAssets[0].id, matchedAsset: stockAssets[0] };
      }
    }

    // 3. Vàng: Rà soát Vàng ở Tab 1 (Ưu tiên đúng type === 'gold')
    if (currentAssetType === 'gold' || currentUnit === 'chỉ' || currentUnit === 'lượng' || rawName.includes('vàng')) {
      if (rawName) {
        const goldAsset = db.assets.find(
          (a) => a.type === 'gold' && (a.name.toLowerCase().includes(rawName) || rawName.includes(a.name.toLowerCase()))
        );
        if (goldAsset) return { assetId: goldAsset.id, matchedAsset: goldAsset };
      }
      const goldAssets = db.assets.filter((a) => a.type === 'gold');
      if (goldAssets.length > 0) {
        return { assetId: goldAssets[0].id, matchedAsset: goldAssets[0] };
      }
    }

    // 4. Tiền mặt / Quỹ thanh khoản
    if (currentAssetType === 'cash') {
      if (rawName) {
        const cashAsset = db.assets.find(
          (a) => a.type === 'cash' && (a.name.toLowerCase().includes(rawName) || rawName.includes(a.name.toLowerCase()))
        );
        if (cashAsset) return { assetId: cashAsset.id, matchedAsset: cashAsset };
      }
      const cashAssets = db.assets.filter((a) => a.type === 'cash');
      if (cashAssets.length > 0) {
        return { assetId: cashAssets[0].id, matchedAsset: cashAssets[0] };
      }
    }

    // 5. Rà soát chung theo tên trong db.assets (ưu tiên type khớp nếu có)
    if (rawName) {
      const exactTypeAsset = db.assets.find(
        (a) => a.type === currentAssetType && (a.name.toLowerCase().includes(rawName) || rawName.includes(a.name.toLowerCase()))
      );
      if (exactTypeAsset) return { assetId: exactTypeAsset.id, matchedAsset: exactTypeAsset };

      const anyMatch = db.assets.find(
        (a) => a.name.toLowerCase().includes(rawName) || rawName.includes(a.name.toLowerCase())
      );
      if (anyMatch) return { assetId: anyMatch.id, matchedAsset: anyMatch };
    }

    return {};
  };

  // Handle Asset type change in DCA form: Tự động rà soát tài sản liên kết Tab 1 đúng loại
  const handleAssetTypeChange = (newType: GoalAssetType) => {
    setAssetType(newType);
    let newUnit = unit;
    if (newType === 'stock') {
      newUnit = 'CP';
      setUnit('CP');
      setGoalGroup('dca');
    } else if (newType === 'gold') {
      newUnit = 'chỉ';
      setUnit('chỉ');
      setGoalGroup('dca');
    } else if (newType === 'saving') {
      newUnit = 'VNĐ';
      setUnit('VNĐ');
      setGoalGroup('dca');
      if (targetQtyStr) setTargetQtyStr(formatNumberString(targetQtyStr, false));
      if (editTotalBoughtStr) setEditTotalBoughtStr(formatNumberString(editTotalBoughtStr, false));
      if (editBacklogQtyStr) setEditBacklogQtyStr(formatNumberString(editBacklogQtyStr, false));
    } else if (newType === 'cash') {
      newUnit = 'VNĐ';
      setUnit('VNĐ');
      setGoalGroup('runway');
      if (targetQtyStr) setTargetQtyStr(formatNumberString(targetQtyStr, false));
      if (editTotalBoughtStr) setEditTotalBoughtStr(formatNumberString(editTotalBoughtStr, false));
      if (editBacklogQtyStr) setEditBacklogQtyStr(formatNumberString(editBacklogQtyStr, false));
    }

    // Tự động rà soát và ưu tiên liên kết tài sản đúng loại ở Tab 1
    const match = findBestMatchingTab1Asset(goalName, newType, newUnit);
    if (match.bankKey) {
      setLinkedBankKey(match.bankKey);
      setLinkedAssetId(undefined);
    } else if (match.assetId) {
      setLinkedAssetId(match.assetId);
      setLinkedBankKey(undefined);
      if (match.matchedAsset) {
        if (!goalName) setGoalName(match.matchedAsset.name);
        const qty = match.matchedAsset.quantity || 0;
        const cost = match.matchedAsset.costPrice || 0;
        const val = match.matchedAsset.amount || 0;
        const avgPrice = qty > 0 ? Math.round((cost > 0 ? cost : val) / qty) : undefined;
        const curPrice = qty > 0 ? Math.round(val / qty) : undefined;
        if (avgPrice && !editUnitPriceStr) setEditUnitPriceStr(formatNumberString(avgPrice));
        if (curPrice && !editCurrentPriceStr) setEditCurrentPriceStr(formatNumberString(curPrice));
      }
    } else {
      setLinkedAssetId(undefined);
      setLinkedBankKey(undefined);
    }
  };

  // Xử lý khi người dùng gõ hoặc sửa tên mục tiêu: Tự động rà soát liên kết Tab 1
  const handleGoalNameChange = (val: string) => {
    setGoalName(val);
    const match = findBestMatchingTab1Asset(val, assetType, unit);
    if (match.bankKey) {
      setLinkedBankKey(match.bankKey);
      setLinkedAssetId(undefined);
    } else if (match.assetId) {
      setLinkedAssetId(match.assetId);
      setLinkedBankKey(undefined);
      if (match.matchedAsset) {
        const qty = match.matchedAsset.quantity || 0;
        const cost = match.matchedAsset.costPrice || 0;
        const val = match.matchedAsset.amount || 0;
        const avgPrice = qty > 0 ? Math.round((cost > 0 ? cost : val) / qty) : undefined;
        const curPrice = qty > 0 ? Math.round(val / qty) : undefined;
        if (avgPrice && !editUnitPriceStr) setEditUnitPriceStr(formatNumberString(avgPrice));
        if (curPrice && !editCurrentPriceStr) setEditCurrentPriceStr(formatNumberString(curPrice));
      }
    }
  };

  // When user selects a specific asset or bank group from Tab 1
  const handleSelectAssetFromTab1 = (assetIdStr: string) => {
    if (!assetIdStr) {
      setLinkedAssetId(undefined);
      setLinkedBankKey(undefined);
      return;
    }

    // Trường hợp liên kết vào SỐ TỔNG của cả ngân hàng (VD: 'bank:ncb')
    if (assetIdStr.startsWith('bank:')) {
      const bankKey = assetIdStr.replace('bank:', '').toLowerCase();
      setLinkedBankKey(bankKey);
      setLinkedAssetId(undefined);

      const bg = savingBankGroups.find((g) => g.bankKey === bankKey);
      const bankName = bg ? bg.bankName : bankKey.toUpperCase();
      setGoalName(`Gửi tiết kiệm ${bankName}`);
      setAssetType('saving');
      setUnit('VNĐ');
      setGoalGroup('dca');
      if (bg && bg.totalPrincipal > 0) {
        setEditTotalBoughtStr(formatNumberString(bg.totalPrincipal));
        if (!targetQtyStr || targetQtyStr === '0') {
          setTargetQtyStr(formatNumberString(Math.min(20000000, Math.round(bg.totalPrincipal / 10) || 5000000)));
        }
      }
      setEditUnitPriceStr('');
      setEditCurrentPriceStr('');
      return;
    }

    // Trường hợp liên kết vào 1 tài sản lẻ
    const idNum = Number(assetIdStr);
    setLinkedAssetId(idNum);
    setLinkedBankKey(undefined);
    const asset = db.assets.find((a) => a.id === idNum);
    if (asset) {
      setGoalName(asset.name);
      if (asset.type === 'saving') {
        setAssetType('saving');
        setUnit('VNĐ');
        setGoalGroup('dca');
        if (asset.amount && (!targetQtyStr || targetQtyStr === '0')) {
          setTargetQtyStr(formatNumberString(Math.min(20000000, Math.round(asset.amount / 10))));
        }
        setEditUnitPriceStr('');
        setEditCurrentPriceStr('');
      } else if (asset.type === 'stock') {
        setAssetType('stock');
        setUnit('CP');
        setGoalGroup('dca');
        if (!targetQtyStr || targetQtyStr === '0') {
          setTargetQtyStr('500');
        }
        const qty = asset.quantity || 0;
        const cost = asset.costPrice || 0;
        const val = asset.amount || 0;
        const avgPrice = qty > 0 ? Math.round((cost > 0 ? cost : val) / qty) : 30000;
        const curPrice = qty > 0 ? Math.round(val / qty) : 32000;
        setEditUnitPriceStr(formatNumberString(avgPrice));
        setEditCurrentPriceStr(formatNumberString(curPrice));
      } else if (asset.type === 'gold') {
        setAssetType('gold');
        setUnit('chỉ');
        setGoalGroup('dca');
        if (!targetQtyStr || targetQtyStr === '0') {
          setTargetQtyStr('2');
        }
        const qty = asset.quantity || 0;
        const cost = asset.costPrice || 0;
        const val = asset.amount || 0;
        const avgPrice = qty > 0 ? Math.round((cost > 0 ? cost : val) / qty) : 8200000;
        const curPrice = qty > 0 ? Math.round(val / qty) : 8650000;
        setEditUnitPriceStr(formatNumberString(avgPrice));
        setEditCurrentPriceStr(formatNumberString(curPrice));
      } else if (asset.type === 'cash') {
        setAssetType('cash');
        setUnit('VNĐ');
        setGoalGroup('runway');
        if (!targetQtyStr || targetQtyStr === '0') {
          setTargetQtyStr(formatNumberString(5000000));
        }
        setEditUnitPriceStr('');
        setEditCurrentPriceStr('');
      } else {
        setAssetType('other');
        setUnit('VNĐ');
        setGoalGroup('milestone');
        if (asset.amount) {
          setGoalTargetStr(formatNumberString(asset.amount));
        }
        setEditUnitPriceStr('');
        setEditCurrentPriceStr('');
      }
    }
  };

  // When user selects a debt from Tab 2 for Nhóm 1
  const handleSelectDebtFromTab2 = (debtIdStr: string) => {
    if (!debtIdStr) {
      setLinkedDebtId(undefined);
      return;
    }
    const idNum = Number(debtIdStr);
    setLinkedDebtId(idNum);
    const debt = db.debts.find((d) => d.id === idNum);
    if (debt) {
      setGoalName(`Tất toán: ${debt.name}`);
      setGoalGroup('debt');
      setFormMode('milestone');
      setGoalTargetStr(formatNumberString(Math.max(0, debt.amount - (debt.paidPrincipal || 0))));
    }
  };

  const handleOpenHistory = (g: Goal) => {
    const bankRes = resolveGoalBankSavings(g, savingAssets);
    let matchedAsset = g.linkedAssetId
      ? db.assets.find((a) => a.id === g.linkedAssetId)
      : db.assets.find((a) => a.name.toLowerCase() === g.name.toLowerCase());

    if (!matchedAsset && bankRes && bankRes.isBankLinked && bankRes.assets.length > 0) {
      matchedAsset = bankRes.assets[0];
    }

    setSelectedHistoryGoal(g);
    setSelectedHistoryAsset(matchedAsset || null);
    setShowHistoryModal(true);
  };

  const handleEditGoal = (g: Goal) => {
    setEditingGoalId(g.id);
    setGoalGroup(g.group || 'dca');
    const isDcaMode = g.goalType === 'dca' || (!g.goalType && (g.group === 'dca' || g.group === 'runway'));
    setFormMode(isDcaMode ? 'dca' : 'milestone');
    setAssetType(g.assetType || 'stock');

    const bankRes = resolveGoalBankSavings(g, savingAssets);
    if (g.linkedBankKey || (bankRes && bankRes.isBankLinked)) {
      setLinkedBankKey(g.linkedBankKey || bankRes?.bankKey);
      setLinkedAssetId(g.linkedBankKey ? undefined : g.linkedAssetId);
    } else if (g.linkedAssetId) {
      setLinkedBankKey(undefined);
      setLinkedAssetId(g.linkedAssetId);
    } else {
      // Tự động rà soát tài sản ở Tab 1 theo loại và tên mục tiêu
      const autoMatch = findBestMatchingTab1Asset(g.name || '', g.assetType || 'stock', g.unit);
      if (autoMatch.bankKey) {
        setLinkedBankKey(autoMatch.bankKey);
        setLinkedAssetId(undefined);
      } else if (autoMatch.assetId) {
        setLinkedAssetId(autoMatch.assetId);
        setLinkedBankKey(undefined);
      } else {
        setLinkedBankKey(undefined);
        setLinkedAssetId(undefined);
      }
    }
    setLinkedDebtId(g.linkedDebtId);
    setGoalName(g.name || '');
    setFreqMonths(g.freqMonths || 1);
    setTargetQtyStr(formatNumberString(g.targetQty || g.targetAmountPerPeriod || ''));
    setUnit(g.unit || (g.assetType === 'gold' ? 'chỉ' : g.assetType === 'saving' || g.assetType === 'cash' ? 'VNĐ' : 'CP'));
    setGoalDay(g.day || 10);
    setGoalTargetStr(g.target ? formatNumberString(g.target) : '');
    setGoalYears(g.years || 2);
    setGoalNote(g.note || '');

    // Trạng thái đã nạp kỳ hiện tại
    setEditIsPaidThisPeriod(g.lastBoughtPeriod === currentPeriodStr);

    // Nạp kết quả tích lũy thực tế & nợ kỳ trước để người dùng có thể sửa
    const matchedAsset = g.linkedAssetId
      ? db.assets.find((a) => a.id === g.linkedAssetId)
      : db.assets.find((a) => a.name.toLowerCase() === g.name.toLowerCase());

    let totalQty = g.totalBought !== undefined ? g.totalBought : (matchedAsset?.quantity || 0);
    if (bankRes && bankRes.isBankLinked && bankRes.totalPrincipal > 0) {
      totalQty = bankRes.totalPrincipal;
    }
    setEditTotalBoughtStr(totalQty > 0 ? formatNumberString(totalQty) : (g.totalBought !== undefined ? formatNumberString(g.totalBought) : ''));
    setEditBacklogQtyStr(g.backlogQty !== undefined ? formatNumberString(g.backlogQty) : '');

    // Nạp đơn giá vốn cũ / trung bình & đơn giá hiện tại
    if (g.assetType === 'gold' || g.assetType === 'stock' || g.unit === 'chỉ' || g.unit === 'CP' || g.unit === 'lượng') {
      const avgPrice = g.unitPrice || (matchedAsset?.quantity && matchedAsset?.costPrice ? Math.round(matchedAsset.costPrice / matchedAsset.quantity) : (matchedAsset?.quantity && matchedAsset?.amount ? Math.round(matchedAsset.amount / matchedAsset.quantity) : (g.assetType === 'gold' ? 8200000 : 30000)));
      let curPrice = g.currentPrice || (matchedAsset?.quantity && matchedAsset?.amount ? Math.round(matchedAsset.amount / matchedAsset.quantity) : (g.assetType === 'gold' ? 8650000 : 32000));
      // Tự động khôi phục nếu dữ liệu cũ từng bị lưu nhầm thành số thập phân bé do lỗi trước đây (VD: 1.467 đ/chỉ)
      if (curPrice > 0 && curPrice < 100000 && (g.assetType === 'gold' || g.unit === 'chỉ' || g.unit === 'lượng')) {
        curPrice = avgPrice && avgPrice >= 100000 ? avgPrice : 8650000;
      } else if (curPrice > 0 && curPrice < 100 && (g.assetType === 'stock' || g.unit === 'CP')) {
        curPrice = avgPrice && avgPrice >= 100 ? avgPrice : 32000;
      }
      setEditUnitPriceStr(formatNumberString(avgPrice, false));
      setEditCurrentPriceStr(formatNumberString(curPrice, false));
    } else {
      setEditUnitPriceStr('');
      setEditCurrentPriceStr('');
    }

    setEditSyncToAsset(true);
    setShowGoalForm(true);

    setTimeout(() => {
      goalFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      goalNameInputRef.current?.focus();
    }, 80);
  };

  const handleCancelForm = () => {
    setEditingGoalId(null);
    setGoalGroup('dca');
    setFormMode('dca');
    setAssetType('stock');
    setLinkedAssetId(undefined);
    setLinkedBankKey(undefined);
    setLinkedDebtId(undefined);
    setGoalName('');
    setFreqMonths(1);
    setTargetQtyStr('');
    setUnit('CP');
    setGoalDay(10);
    setGoalTargetStr('');
    setGoalYears(2);
    setGoalNote('');
    setEditTotalBoughtStr('');
    setEditBacklogQtyStr('');
    setEditUnitPriceStr('');
    setEditCurrentPriceStr('');
    setEditSyncToAsset(true);
    setEditIsPaidThisPeriod(false);
    setShowGoalForm(false);
  };

  const handleSelectRecommendation = (rec: { symbol: string; name: string; price?: number }) => {
    setEditingGoalId(null);
    setGoalGroup('dca');
    setFormMode('dca');
    setAssetType('stock');
    setLinkedBankKey(undefined);
    setGoalName(rec.symbol);
    setUnit('CP');
    setFreqMonths(1);
    setGoalDay(10);
    setTargetQtyStr('100'); // Khởi tạo định mức gợi ý 100 CP / tháng
    setEditTotalBoughtStr('');
    setEditBacklogQtyStr('');

    if (rec.price && rec.price > 0) {
      setEditUnitPriceStr(formatNumberString(rec.price, false));
      setEditCurrentPriceStr(formatNumberString(rec.price, false));
    } else {
      setEditUnitPriceStr('');
      setEditCurrentPriceStr('');
    }

    setGoalNote(`Khuyến nghị Top 3 VN30 - ${rec.name}`);
    setEditSyncToAsset(true);
    setEditIsPaidThisPeriod(false);

    // Kiểm tra xem đã có tài sản cùng tên ở Tab 1 chưa để tự liên kết
    const matchedAsset = db.assets.find(
      (a) => a.type === 'stock' && a.name.toUpperCase().includes(rec.symbol)
    );
    if (matchedAsset) {
      setLinkedAssetId(matchedAsset.id);
    } else {
      setLinkedAssetId(undefined);
    }

    setShowGoalForm(true);
    showToast(`Đã chọn ${rec.symbol}. Bạn có thể chỉnh định mức nạp rồi nhấn Lưu!`, 'info');

    setTimeout(() => {
      goalFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      goalNameInputRef.current?.focus();
    }, 100);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) {
      alert('Vui lòng nhập hoặc chọn tên mục tiêu!');
      return;
    }

    const isDca = formMode === 'dca' || (formMode !== 'milestone' && (goalGroup === 'dca' || goalGroup === 'runway'));

    if (isDca) {
      const qty = parseFormattedNumber(targetQtyStr);
      if (qty <= 0) {
        alert('Vui lòng nhập định mức mỗi kỳ lớn hơn 0!');
        return;
      }

      const existing = editingGoalId ? db.goals.find((g) => g.id === editingGoalId) : null;
      
      // Cho phép sửa trực tiếp kết quả tích lũy lũy kế và nợ kỳ trước
      const totalBoughtVal = editTotalBoughtStr !== '' ? parseFormattedNumber(editTotalBoughtStr) : (existing?.totalBought || 0);
      const backlogQtyVal = editBacklogQtyStr !== '' ? parseFormattedNumber(editBacklogQtyStr) : (existing?.backlogQty || 0);
      const unitPriceVal = editUnitPriceStr !== '' ? parseFormattedNumber(editUnitPriceStr) : (existing?.unitPrice || (assetType === 'gold' ? 8200000 : 30000));
      const currentPriceVal = editCurrentPriceStr !== '' ? parseFormattedNumber(editCurrentPriceStr) : (existing?.currentPrice || (assetType === 'gold' ? 8650000 : 32000));
      const totalCostVal = totalBoughtVal > 0 && unitPriceVal > 0 ? totalBoughtVal * unitPriceVal : undefined;

      // Xác định chính xác lastBoughtPeriod dựa trên lựa chọn người dùng (chỉ set khi chọn Đã nạp)
      let resolvedLastBought = '';
      if (editIsPaidThisPeriod) {
        resolvedLastBought = currentPeriodStr;
      } else if (existing?.lastBoughtPeriod && existing.lastBoughtPeriod !== currentPeriodStr) {
        resolvedLastBought = existing.lastBoughtPeriod;
      }

      const newGoal: Goal = {
        id: editingGoalId || Date.now(),
        group: goalGroup,
        goalType: 'dca',
        assetType,
        linkedAssetId: linkedBankKey ? undefined : linkedAssetId,
        linkedBankKey: linkedBankKey || undefined,
        name: goalName.trim(),
        freqMonths,
        targetQty: qty,
        targetAmountPerPeriod: assetType === 'saving' || unit === 'VNĐ' ? qty : undefined,
        unit,
        day: goalDay,
        backlogQty: backlogQtyVal,
        totalBought: totalBoughtVal,
        unitPrice: unitPriceVal > 0 ? unitPriceVal : undefined,
        currentPrice: currentPriceVal > 0 ? currentPriceVal : undefined,
        costPrice: totalCostVal,
        lastBoughtPeriod: resolvedLastBought,
        status: existing?.status || 'active',
        note: goalNote.trim() || undefined,
      };

      onUpdateGoal(newGoal);

      // Nếu người dùng chọn đồng bộ sang tài sản tương ứng ở Tab 1 (Áp dụng cho Cổ phiếu, Vàng, Tiền mặt; Sổ tiết kiệm là sổ mới riêng biệt)
      if (editSyncToAsset && assetType !== 'saving') {
        let matchedAsset = linkedAssetId
          ? db.assets.find((a) => a.id === linkedAssetId)
          : db.assets.find((a) => a.name.toLowerCase() === goalName.trim().toLowerCase());

        if (matchedAsset) {
          if (matchedAsset.type === 'cash' || assetType === 'cash') {
            onUpdateAssetDirectly({
              ...matchedAsset,
              amount: totalBoughtVal,
              updatedAt: new Date().toLocaleDateString('vi-VN'),
            });
          } else if (matchedAsset.type === 'stock' || matchedAsset.type === 'gold' || assetType === 'stock' || assetType === 'gold') {
            const finalMarketAmount = totalBoughtVal > 0 && currentPriceVal > 0 
              ? totalBoughtVal * currentPriceVal 
              : (unitPriceVal > 0 ? totalBoughtVal * unitPriceVal : matchedAsset.amount);
            
            onUpdateAssetDirectly({
              ...matchedAsset,
              quantity: totalBoughtVal,
              costPrice: totalCostVal || matchedAsset.costPrice,
              amount: finalMarketAmount,
              updatedAt: new Date().toLocaleDateString('vi-VN'),
            });
          }
        }
      }
    } else {
      const target = parseFormattedNumber(goalTargetStr);
      if (target <= 0) {
        alert('Vui lòng nhập tổng số tiền mục tiêu lớn hơn 0!');
        return;
      }

      const existing = editingGoalId ? db.goals.find((g) => g.id === editingGoalId) : null;
      const newGoal: Goal = {
        id: editingGoalId || Date.now(),
        group: goalGroup,
        goalType: 'milestone',
        linkedDebtId,
        linkedAssetId: linkedBankKey ? undefined : linkedAssetId,
        linkedBankKey: linkedBankKey || undefined,
        name: goalName.trim(),
        target,
        years: goalYears,
        createdAt: existing?.createdAt || currentPeriodStr,
        status: existing?.status || 'active',
        note: goalNote.trim() || undefined,
      };

      onUpdateGoal(newGoal);
    }

    handleCancelForm();
  };

  // Nhanh chóng chuyển đổi giữa "Đã hoàn thành kỳ này" và "Chờ nạp kỳ này"
  const handleTogglePaidThisPeriod = (goal: Goal) => {
    const isPaid = goal.lastBoughtPeriod === currentPeriodStr;
    if (isPaid) {
      // Tìm giao dịch gần nhất tương ứng với mục tiêu hoặc tài sản liên kết
      const allTxs = db.transactions || [];
      const matchedAsset = goal.linkedAssetId
        ? db.assets.find((a) => a.id === goal.linkedAssetId)
        : db.assets.find((a) => a.name.toLowerCase() === goal.name.toLowerCase());

      // Ưu tiên tìm giao dịch khớp với ghi chú kỳ hiện tại hoặc trong tháng hiện tại
      const txToRevert =
        allTxs.find(
          (t) =>
            (t.goalId === goal.id || (matchedAsset && t.assetId === matchedAsset.id)) &&
            (t.note?.includes(currentPeriodStr) || t.date.startsWith(new Date().toISOString().slice(0, 7)))
        ) ||
        allTxs.find((t) => t.goalId === goal.id || (matchedAsset && t.assetId === matchedAsset.id));

      const revertQty = txToRevert?.quantity || goal.targetQty || 0;
      const revertCost = txToRevert?.totalAmount || (revertQty * (goal.unitPrice || 0));
      const updatedTxs = txToRevert ? allTxs.filter((t) => t.id !== txToRevert.id) : allTxs;

      const newTotalBought = Math.max(0, (goal.totalBought || 0) - revertQty);
      const newGoalCost = goal.costPrice ? Math.max(0, goal.costPrice - revertCost) : undefined;
      const updatedGoal: Goal = {
        ...goal,
        totalBought: newTotalBought,
        costPrice: newGoalCost,
        lastBoughtPeriod: '',
      };

      let updatedAsset: Asset | undefined;
      if (matchedAsset) {
        if (matchedAsset.type === 'stock' || matchedAsset.type === 'gold') {
          const newQty = Math.max(0, (matchedAsset.quantity || 0) - revertQty);
          const newCost = Math.max(0, (matchedAsset.costPrice || 0) - revertCost);
          const newUnitPrice = newQty > 0 && newCost > 0 ? Math.round(newCost / newQty) : matchedAsset.unitPrice;
          const curPrice =
            matchedAsset.currentPrice ||
            (matchedAsset.quantity && matchedAsset.amount
              ? Math.round(matchedAsset.amount / matchedAsset.quantity)
              : (matchedAsset.type === 'gold' ? 8650000 : 32000));
          const newAmount = newQty > 0 ? newQty * curPrice : 0;
          updatedAsset = {
            ...matchedAsset,
            quantity: newQty,
            costPrice: newCost,
            unitPrice: newUnitPrice,
            amount: newAmount,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
        } else if (matchedAsset.type === 'saving' || matchedAsset.type === 'cash') {
          const newAmount = Math.max(0, (matchedAsset.amount || 0) - (revertCost > 0 ? revertCost : revertQty));
          updatedAsset = {
            ...matchedAsset,
            amount: newAmount,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
        }
      }

      if (onSaveTransactions) {
        onSaveTransactions(updatedTxs, updatedAsset, updatedGoal);
      } else {
        onUpdateGoal(updatedGoal);
        if (updatedAsset) onUpdateAssetDirectly(updatedAsset);
      }

      showToast(
        `⏳ Đã hoàn tác "${goal.name}" về trạng thái: Chờ nạp kỳ ${currentPeriodStr}${revertQty > 0 ? ` (Đã giảm ${formatNumberString(revertQty)} ${goal.unit || ''} ở Tab 1 & Tab 3)` : ''}!`,
        'info'
      );
    } else {
      // 1. XỬ LÝ CHO MỤC TIÊU TIẾT KIỆM (SAVING)
      const bankRes = resolveGoalBankSavings(goal, savingAssets);
      const isBankGoal = Boolean(
        goal.assetType === 'saving' ||
        bankRes?.isBankLinked ||
        (!goal.assetType && goal.unit === 'VNĐ' && goal.group === 'dca')
      );

      if (isBankGoal) {
        const dueThisPeriod = (goal.targetQty && goal.unit === 'VNĐ') 
          ? goal.targetQty 
          : (goal.targetAmountPerPeriod || (goal.targetQty || 10000000));
        const depositAmt = dueThisPeriod + (goal.backlogQty || 0);

        if (goal.linkedAssetId) {
          // LIÊN KẾT 1 SỔ CỐ ĐỊNH -> NẠP THÊM GỐC VÀO SỔ ĐÓ
          const matchedAsset = db.assets.find((a) => a.id === goal.linkedAssetId);
          if (matchedAsset) {
            const updatedAsset: Asset = {
              ...matchedAsset,
              amount: (matchedAsset.amount || 0) + depositAmt,
              updatedAt: new Date().toLocaleDateString('vi-VN'),
            };
            onUpdateAssetDirectly(updatedAsset);

            const updatedGoal: Goal = {
              ...goal,
              totalBought: (goal.totalBought || 0) + depositAmt,
              lastBoughtPeriod: currentPeriodStr,
              backlogQty: 0,
            };
            onUpdateGoal(updatedGoal);

            if (onSaveTransactions) {
              const newTx: AssetTransaction = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                assetId: matchedAsset.id,
                goalId: goal.id,
                assetName: matchedAsset.name,
                date: new Date().toISOString().split('T')[0],
                type: 'deposit',
                quantity: depositAmt,
                unit: 'VNĐ',
                pricePerUnit: 1,
                totalAmount: depositAmt,
                note: `Nạp thêm gốc vào ${matchedAsset.name} (Kỳ ${currentPeriodStr})`,
              };
              onSaveTransactions([newTx, ...(db.transactions || [])], updatedAsset, updatedGoal);
            }

            showToast(
              `✓ Đã nạp thêm gốc ${formatVND(depositAmt)} vào sổ "${matchedAsset.name}" ở Tab 1!`,
              'success'
            );
            return;
          }
        }

        // LIÊN KẾT SỐ TỔNG 1 NGÂN HÀNG (HOẶC CHƯA CỐ ĐỊNH SỔ) -> TỰ ĐỘNG MỞ SỔ MỚI VÀ CỘNG TỔNG
        const bankName = bankRes?.bankName || (goal.linkedBankKey ? goal.linkedBankKey.toUpperCase() : 'NCB');
        const bankKey = goal.linkedBankKey || bankRes?.bankKey || bankName.toLowerCase();
        const existingBankBooks = db.assets.filter(
          (a) => a.type === 'saving' && a.name.toLowerCase().includes(bankName.toLowerCase())
        );
        const newBookName = `${bankName} - Sổ ${existingBankBooks.length + 1}`;
        const startDateStr = new Date().toISOString().split('T')[0];

        const newAsset: Asset = {
          id: Date.now(),
          level: '1',
          type: 'saving',
          name: newBookName,
          amount: depositAmt,
          rate: 5.5,
          termMonths: 12,
          startDate: startDateStr,
          maturityDate: calculateMaturityDate(startDateStr, 12) || undefined,
          updatedAt: new Date().toLocaleDateString('vi-VN'),
          note: `Mở từ mục tiêu tích sản: "${goal.name}" (Kỳ ${currentPeriodStr})`,
        };

        onUpdateAssetDirectly(newAsset);

        const updatedGoal: Goal = {
          ...goal,
          linkedBankKey: bankKey,
          linkedAssetId: undefined, // Tiếp tục duy trì liên kết số tổng ngân hàng
          totalBought: (goal.totalBought || 0) + depositAmt,
          lastBoughtPeriod: currentPeriodStr,
          backlogQty: 0,
        };
        onUpdateGoal(updatedGoal);

        if (onSaveTransactions) {
          const newTx: AssetTransaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            assetId: newAsset.id,
            goalId: goal.id,
            assetName: newAsset.name,
            type: 'buy',
            date: startDateStr,
            quantity: 1,
            unit: 'sổ',
            pricePerUnit: depositAmt,
            totalAmount: depositAmt,
            note: `Mở ${newBookName} (Kỳ ${currentPeriodStr})`,
          };
          onSaveTransactions([newTx, ...(db.transactions || [])], newAsset, updatedGoal);
        }

        showToast(
          `✓ Đã tự động lập sổ mới "${newBookName}" (${formatVND(depositAmt)}) và cộng dồn vào số tổng ${bankName} ở Tab 1!`,
          'success'
        );
        return;
      }

      // 2. XỬ LÝ CHO CỔ PHIẾU / VÀNG / TIỀN MẶT
      const buyQty = (goal.targetQty || 1) + (goal.backlogQty || 0);
      const matchedAsset = goal.linkedAssetId
        ? db.assets.find((a) => a.id === goal.linkedAssetId)
        : db.assets.find((a) => a.name.toLowerCase() === goal.name.toLowerCase());

      const isStockOrGold = goal.assetType === 'stock' || goal.assetType === 'gold' || goal.unit === 'CP' || goal.unit === 'chỉ' || goal.unit === 'lượng';
      let unitPrice = goal.currentPrice || goal.unitPrice || (goal.assetType === 'gold' ? 8650000 : 32000);
      const totalCost = buyQty * unitPrice;

      let updatedAsset: Asset | undefined;
      if (matchedAsset) {
        if (matchedAsset.type === 'stock' || matchedAsset.type === 'gold') {
          const curQty = matchedAsset.quantity || 0;
          const newQty = curQty + buyQty;
          const oldCost = matchedAsset.costPrice || (curQty * (goal.unitPrice || unitPrice));
          const finalCost = oldCost + totalCost;
          const curPrice = unitPrice || (matchedAsset.amount && curQty > 0 ? Math.round(matchedAsset.amount / curQty) : unitPrice);
          updatedAsset = {
            ...matchedAsset,
            quantity: newQty,
            costPrice: finalCost,
            amount: newQty * curPrice,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          onUpdateAssetDirectly(updatedAsset);
        } else if (matchedAsset.type === 'cash') {
          updatedAsset = {
            ...matchedAsset,
            amount: (matchedAsset.amount || 0) + (goal.unit === 'VNĐ' ? buyQty : totalCost),
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          onUpdateAssetDirectly(updatedAsset);
        }
      }

      const currentTotalBought = goal.totalBought || 0;
      const newTotal = currentTotalBought + buyQty;
      const oldCost = goal.costPrice || (currentTotalBought * (goal.unitPrice || unitPrice));
      const newTotalCost = isStockOrGold ? oldCost + totalCost : undefined;
      const newAvgPrice = isStockOrGold && newTotal > 0 && newTotalCost ? Math.round(newTotalCost / newTotal) : goal.unitPrice;

      const updatedGoal: Goal = {
        ...goal,
        totalBought: newTotal,
        costPrice: newTotalCost,
        unitPrice: newAvgPrice,
        lastBoughtPeriod: currentPeriodStr,
        backlogQty: 0,
      };
      onUpdateGoal(updatedGoal);

      if (onSaveTransactions) {
        const newTx: AssetTransaction = {
          id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          assetId: updatedAsset?.id || goal.linkedAssetId,
          goalId: goal.id,
          assetName: updatedAsset?.name || goal.name,
          date: new Date().toISOString().split('T')[0],
          type: 'buy',
          quantity: buyQty,
          unit: goal.unit,
          pricePerUnit: unitPrice,
          totalAmount: totalCost,
          note: `Tích sản ${goal.name} (Kỳ ${currentPeriodStr})`,
        };
        onSaveTransactions([newTx, ...(db.transactions || [])], updatedAsset, updatedGoal);
      }

      showToast(
        `✓ Đã ghi nhận nạp ${formatNumberString(buyQty)} ${goal.unit} cho "${goal.name}" và cộng dồn vào Tab 1!`,
        'success'
      );
    }
  };

  // Mở modal Nạp kỳ này
  const handleOpenDepositModal = (goal: Goal) => {
    setDcaDepositGoal(goal);
    const dueThisMonth = (goal.targetQty || 0) + (goal.backlogQty || 0);
    setDepositAmountStr(formatNumberString(dueThisMonth > 0 ? dueThisMonth : (goal.targetQty || 1)));
    
    const isGold = goal.assetType === 'gold' || goal.unit === 'chỉ' || goal.unit === 'lượng' || goal.name.toLowerCase().includes('vàng');
    const isStock = goal.assetType === 'stock' || goal.unit === 'CP';
    if (isGold) {
      const rec = getRecommendedGoldPrice(goldData, goal.unit, goal.name);
      const defaultPrice = goal.currentPrice || rec.pricePerUnit;
      setDepositPriceStr(formatNumberString(defaultPrice));
    } else if (isStock) {
      const defaultPrice = goal.currentPrice || goal.unitPrice || 32000;
      setDepositPriceStr(formatNumberString(defaultPrice));
    } else {
      setDepositPriceStr('');
    }
    setDepositAutoSyncAsset(true);
  };

  // Mở modal Chuyển nợ sang kỳ sau
  const handleOpenBacklogModal = (goal: Goal) => {
    setDcaBacklogGoal(goal);
    setBacklogInputStr(formatNumberString(goal.targetQty || 1));
  };

  // Xác nhận chuyển nợ sang kỳ sau
  const handleConfirmBacklog = () => {
    if (!dcaBacklogGoal) return;
    const addBacklog = parseFormattedNumber(backlogInputStr);
    if (isNaN(addBacklog) || addBacklog <= 0) {
      showToast('Vui lòng nhập số lượng nợ hợp lệ lớn hơn 0!', 'warning');
      return;
    }
    const currentBacklog = dcaBacklogGoal.backlogQty || 0;
    const newBacklog = currentBacklog + addBacklog;
    const targetQty = dcaBacklogGoal.targetQty || 0;

    const updatedGoal: Goal = {
      ...dcaBacklogGoal,
      backlogQty: newBacklog,
      lastBoughtPeriod: `Chuyển nợ (${currentPeriodStr})`,
    };
    onUpdateGoal(updatedGoal);
    setDcaBacklogGoal(null);
    showToast(
      `✓ Đã ghi nhận nợ ${formatNumberString(addBacklog)} ${dcaBacklogGoal.unit} sang kỳ sau! Tổng cần nạp kỳ tới: ${formatNumberString(newBacklog + targetQty)} ${dcaBacklogGoal.unit}.`,
      'warning'
    );
  };

  // Tiện ích tính ngày đáo hạn dựa vào ngày gửi và số tháng
  const calculateMaturityDate = (startDateStr: string, termMonths: number): string => {
    try {
      const d = new Date(startDateStr);
      if (isNaN(d.getTime())) return '';
      d.setMonth(d.getMonth() + Number(termMonths));
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Mở modal tạo sổ tiết kiệm mới (Độc lập trong Tab 1)
  const handleOpenCreateSavingModal = (goal: Goal) => {
    setGoalForNewSaving(goal);
    const bankRes = resolveGoalBankSavings(goal, savingAssets);
    if (bankRes && bankRes.isBankLinked) {
      setSavingBank(bankRes.bankName);
      setSavingName(`Sổ ${bankRes.count + 1}`);
    } else {
      setSavingBank('NCB');
      setSavingName(`Sổ TK: ${goal.name}`);
    }
    setSavingCustomBank('');
    const defaultAmt = goal.targetAmountPerPeriod || (goal.targetQty && goal.unit === 'VNĐ' ? goal.targetQty : 10000000);
    setSavingAmountStr(formatNumberString(defaultAmt, false));
    setSavingTermMonths(12);
    setSavingRateStr('5.5');
    setSavingStartDate(new Date().toISOString().split('T')[0]);
  };

  // Thay đổi kỳ hạn gửi và gợi ý lãi suất tham chiếu thị trường
  const handleTermMonthsChange = (months: number) => {
    setSavingTermMonths(months);
    if (months <= 1) setSavingRateStr('3.2');
    else if (months <= 3) setSavingRateStr('3.5');
    else if (months <= 6) setSavingRateStr('4.8');
    else if (months <= 12) setSavingRateStr('5.5');
    else setSavingRateStr('5.8');
  };

  // Xác nhận tạo sổ tiết kiệm mới và ghi nhận sang Tab 1
  const handleConfirmCreateSavingBook = () => {
    if (!goalForNewSaving) return;
    const goal = goalForNewSaving;
    const amountVal = parseFormattedNumber(savingAmountStr);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast('Vui lòng nhập số tiền gửi tiết kiệm lớn hơn 0!', 'warning');
      return;
    }
    const rateVal = parseFormattedDecimal(savingRateStr) || 5.5;
    const finalBank = savingBank === 'Khác' ? savingCustomBank.trim() : savingBank;
    const finalName = finalBank ? `${finalBank} - ${savingName.trim()}` : savingName.trim();
    const maturityDate = calculateMaturityDate(savingStartDate, savingTermMonths);

    const newAsset: Asset = {
      id: Date.now(),
      level: '1',
      type: 'saving',
      name: finalName || `Sổ Tiết Kiệm: ${goal.name}`,
      amount: amountVal,
      rate: rateVal,
      termMonths: Number(savingTermMonths),
      startDate: savingStartDate,
      maturityDate: maturityDate || undefined,
      updatedAt: new Date().toLocaleDateString('vi-VN'),
      note: `Mở từ mục tiêu tích sản: "${goal.name}"`,
    };

    onUpdateAssetDirectly(newAsset);

    const bankRes = resolveGoalBankSavings(goal, savingAssets);
    const isBankGoal = Boolean(goal.linkedBankKey || bankRes?.isBankLinked);
    const bankKey = goal.linkedBankKey || bankRes?.bankKey || (finalBank ? finalBank.toLowerCase() : undefined);

    const updatedGoal: Goal = {
      ...goal,
      // Duy trì liên kết số tổng ngân hàng, không khóa cứng vào 1 sổ lẻ
      linkedBankKey: isBankGoal ? bankKey : goal.linkedBankKey,
      linkedAssetId: isBankGoal ? undefined : newAsset.id,
      totalBought: isBankGoal ? (bankRes ? bankRes.totalPrincipal + amountVal : amountVal) : amountVal,
      lastBoughtPeriod: goal.goalType === 'dca' ? currentPeriodStr : goal.lastBoughtPeriod,
      backlogQty: 0,
      status: goal.goalType === 'dca' ? (goal.status || 'active') : 'completed',
    };
    onUpdateGoal(updatedGoal);

    // Ghi nhận lịch sử giao dịch vào db.transactions nếu có
    if (onSaveTransactions) {
      const newTx: AssetTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        assetId: newAsset.id,
        goalId: goal.id,
        assetName: newAsset.name,
        type: 'buy',
        date: savingStartDate || new Date().toISOString().split('T')[0],
        quantity: 1,
        unit: 'sổ',
        pricePerUnit: amountVal,
        totalAmount: amountVal,
        note: `Mở sổ tiết kiệm ${finalName} (Kỳ ${currentPeriodStr})`,
      };
      onSaveTransactions([...(db.transactions || []), newTx]);
    }

    setGoalForNewSaving(null);
    showToast(
      `✓ Đã mở thành công Sổ tiết kiệm mới "${newAsset.name}" (${formatVND(amountVal)}) và ghi nhận hoàn thành kỳ ${currentPeriodStr}! Số tổng tại ${finalBank || 'ngân hàng'} đã tự động cập nhật trong Tab 1 & Tab 3.`,
      'success'
    );
  };

  // Mở modal trả nợ trực tiếp từ Mục Tiêu sang Tab 2
  const handleOpenPayDebtModal = (goal: Goal) => {
    const linkedDebt = goal.linkedDebtId ? db.debts.find((d) => d.id === goal.linkedDebtId) : undefined;
    if (!linkedDebt) {
      showToast('Không tìm thấy khoản nợ liên kết ở Tab 2!', 'warning');
      return;
    }
    setGoalForPayDebt(goal);
    const rem = Math.max(0, linkedDebt.amount - (linkedDebt.paidPrincipal || 0));
    const defaultPay = linkedDebt.installmentAmount || Math.min(rem, 10000000);
    setPayDebtAmountStr(formatNumberString(defaultPay > 0 ? defaultPay : rem, false));
    setPayDebtNote(`Trả nợ từ mục tiêu: ${goal.name}`);
  };

  // Xác nhận trả nợ và trừ dư nợ ở Tab 2
  const handleConfirmPayDebt = () => {
    if (!goalForPayDebt) return;
    const goal = goalForPayDebt;
    const linkedDebt = goal.linkedDebtId ? db.debts.find((d) => d.id === goal.linkedDebtId) : undefined;
    if (!linkedDebt) return;

    const payVal = parseFormattedNumber(payDebtAmountStr);
    if (isNaN(payVal) || payVal <= 0) {
      showToast('Vui lòng nhập số tiền trả nợ lớn hơn 0!', 'warning');
      return;
    }

    const currentPaid = linkedDebt.paidPrincipal || 0;
    const newPaid = currentPaid + payVal;
    const isSettled = newPaid >= linkedDebt.amount;

    const updatedDebt: Debt = {
      ...linkedDebt,
      paidPrincipal: Math.min(linkedDebt.amount, newPaid),
      status: isSettled ? 'Đã tất toán' : linkedDebt.status,
      settledDate: isSettled ? new Date().toLocaleDateString('vi-VN') : linkedDebt.settledDate,
    };
    if (onUpdateDebtDirectly) {
      onUpdateDebtDirectly(updatedDebt);
    }

    const updatedGoal: Goal = {
      ...goal,
      totalBought: (goal.totalBought || 0) + payVal,
      lastBoughtPeriod: currentPeriodStr,
      status: isSettled ? 'completed' : goal.status,
    };
    onUpdateGoal(updatedGoal);

    setGoalForPayDebt(null);
    showToast(
      `✓ Đã trả nợ thành công ${formatVND(payVal)} cho khoản nợ "${linkedDebt.name}" và cập nhật giảm dư nợ ở Tab 2!${isSettled ? ' (Khoản nợ đã được tất toán 🎉)' : ''}`,
      'success'
    );
  };

  // Xác nhận nạp kỳ này & đồng bộ Tab 1
  const handleConfirmDeposit = () => {
    if (!dcaDepositGoal) return;
    const goal = dcaDepositGoal;
    const boughtVal = parseFormattedNumber(depositAmountStr);
    if (isNaN(boughtVal) || boughtVal <= 0) {
      showToast('Vui lòng nhập số lượng/số tiền nạp lớn hơn 0!', 'warning');
      return;
    }

    const isGoldOrStock = goal.assetType === 'gold' || goal.assetType === 'stock' || goal.unit === 'chỉ' || goal.unit === 'CP' || goal.unit === 'lượng';
    let boughtPrice = 0;
    if (isGoldOrStock) {
      boughtPrice = parseFormattedNumber(depositPriceStr);
      if (isNaN(boughtPrice) || boughtPrice <= 0) {
        boughtPrice = goal.currentPrice || goal.unitPrice || (goal.assetType === 'gold' ? 8650000 : 32000);
      }
    }

    const dueThisMonth = (goal.targetQty || 0) + (goal.backlogQty || 0);
    const currentTotalBought = goal.totalBought || 0;
    const newTotal = currentTotalBought + boughtVal;
    const newBacklog = boughtVal >= dueThisMonth ? 0 : Math.max(0, dueThisMonth - boughtVal);

    // Xử lý riêng cho Sổ Tiết Kiệm
    const bankRes = resolveGoalBankSavings(goal, savingAssets);
    const isBankGoal = Boolean(
      goal.assetType === 'saving' ||
      bankRes?.isBankLinked ||
      (!goal.assetType && goal.unit === 'VNĐ' && goal.group === 'dca')
    );

    if (isBankGoal) {
      if (goal.linkedAssetId) {
        // LIÊN KẾT 1 SỔ CỐ ĐỊNH -> NẠP THÊM GỐC VÀO SỔ ĐÓ
        let matchedAsset = db.assets.find((a) => a.id === goal.linkedAssetId);
        let updatedAsset: Asset | undefined;
        if (matchedAsset && depositAutoSyncAsset) {
          updatedAsset = {
            ...matchedAsset,
            amount: (matchedAsset.amount || 0) + boughtVal,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          onUpdateAssetDirectly(updatedAsset);
        }

        const updatedGoal: Goal = {
          ...goal,
          totalBought: newTotal,
          lastBoughtPeriod: currentPeriodStr,
          backlogQty: newBacklog,
        };
        onUpdateGoal(updatedGoal);
        setDcaDepositGoal(null);

        // Ghi nhận lịch sử giao dịch vào db.transactions
        if (onSaveTransactions) {
          const newTx: AssetTransaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            assetId: updatedAsset?.id || goal.linkedAssetId,
            goalId: goal.id,
            assetName: updatedAsset?.name || goal.name,
            date: new Date().toISOString().split('T')[0],
            type: 'deposit',
            quantity: boughtVal,
            unit: 'VNĐ',
            pricePerUnit: 1,
            totalAmount: boughtVal,
            note: `Nạp thêm gốc vào ${updatedAsset?.name || goal.name} (Kỳ ${currentPeriodStr})`,
          };
          onSaveTransactions([newTx, ...(db.transactions || [])], updatedAsset, updatedGoal);
        }

        const targetAmt = goal.target || (goal.targetAmountPerPeriod ? goal.targetAmountPerPeriod * 12 : 0);
        showToast(
          `✓ Đã nạp thêm gốc ${formatVND(boughtVal)} vào "${matchedAsset?.name || goal.name}". Tổng đã gom: ${formatVND(newTotal)}${targetAmt > 0 ? ` / ${formatVND(targetAmt)}` : ''} (Đồng bộ Tab 1 & Tab 3)!`,
          'success'
        );
        return;
      } else {
        // LIÊN KẾT SỐ TỔNG 1 NGÂN HÀNG -> TỰ ĐỘNG MỞ SỔ MỚI VÀO TAB 1 VÀ CỘNG DỒN TỔNG
        const bankName = bankRes?.bankName || (goal.linkedBankKey ? goal.linkedBankKey.toUpperCase() : 'NCB');
        const bankKey = goal.linkedBankKey || bankRes?.bankKey || bankName.toLowerCase();
        const existingBankBooks = db.assets.filter(
          (a) => a.type === 'saving' && a.name.toLowerCase().includes(bankName.toLowerCase())
        );
        const newBookName = `${bankName} - Sổ ${existingBankBooks.length + 1}`;
        const startDateStr = new Date().toISOString().split('T')[0];

        const newAsset: Asset = {
          id: Date.now(),
          level: '1',
          type: 'saving',
          name: newBookName,
          amount: boughtVal,
          rate: 5.5,
          termMonths: 12,
          startDate: startDateStr,
          maturityDate: calculateMaturityDate(startDateStr, 12) || undefined,
          updatedAt: new Date().toLocaleDateString('vi-VN'),
          note: `Mở từ mục tiêu tích sản: "${goal.name}" (Kỳ ${currentPeriodStr})`,
        };

        if (depositAutoSyncAsset) {
          onUpdateAssetDirectly(newAsset);
        }

        const updatedGoal: Goal = {
          ...goal,
          linkedBankKey: bankKey,
          linkedAssetId: undefined, // Duy trì số tổng
          totalBought: newTotal,
          lastBoughtPeriod: currentPeriodStr,
          backlogQty: newBacklog,
        };
        onUpdateGoal(updatedGoal);
        setDcaDepositGoal(null);

        if (onSaveTransactions) {
          const newTx: AssetTransaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            assetId: newAsset.id,
            goalId: goal.id,
            assetName: newAsset.name,
            type: 'buy',
            date: startDateStr,
            quantity: 1,
            unit: 'sổ',
            pricePerUnit: boughtVal,
            totalAmount: boughtVal,
            note: `Mở ${newBookName} (Kỳ ${currentPeriodStr})`,
          };
          onSaveTransactions([newTx, ...(db.transactions || [])], newAsset, updatedGoal);
        }

        showToast(
          `✓ Đã lập sổ mới "${newBookName}" (${formatVND(boughtVal)}) và cộng dồn vào số tổng ${bankName} ở Tab 1!`,
          'success'
        );
        return;
      }
    }

    // Tính giá vốn bình quân mới cho Cổ phiếu / Vàng
    let newAvgPrice = goal.unitPrice || boughtPrice;
    let newTotalCost = 0;
    if (isGoldOrStock && boughtPrice > 0) {
      const oldCost = (goal.costPrice && goal.costPrice > 0) 
        ? goal.costPrice 
        : (currentTotalBought * (goal.unitPrice || boughtPrice));
      newTotalCost = oldCost + (boughtVal * boughtPrice);
      newAvgPrice = newTotal > 0 ? Math.round(newTotalCost / newTotal) : boughtPrice;
    }

    // Cập nhật Mục Tiêu
    const updatedGoal: Goal = {
      ...goal,
      totalBought: newTotal,
      unitPrice: isGoldOrStock ? newAvgPrice : undefined,
      currentPrice: isGoldOrStock ? (boughtPrice > 0 ? boughtPrice : goal.currentPrice) : undefined,
      costPrice: newTotalCost > 0 ? newTotalCost : undefined,
      lastBoughtPeriod: currentPeriodStr,
      backlogQty: newBacklog,
    };
    onUpdateGoal(updatedGoal);

    // Đồng bộ sang Tab 1 nếu được chọn (Cổ phiếu, Vàng, Tiền mặt)
    if (depositAutoSyncAsset) {
      let matchedAsset = goal.linkedAssetId
        ? db.assets.find((a) => a.id === goal.linkedAssetId)
        : db.assets.find((a) => a.name.toLowerCase() === goal.name.toLowerCase());

      let updatedAsset: Asset | undefined;
      const newAssetId = matchedAsset ? matchedAsset.id : Date.now();

      if (matchedAsset) {
        if (matchedAsset.type === 'stock') {
          const currentQty = matchedAsset.quantity || 0;
          const newQty = currentQty + boughtVal;
          const oldCost = matchedAsset.costPrice || (currentQty * (goal.unitPrice || 30000));
          const finalCost = oldCost + (boughtVal * (boughtPrice || 30000));
          const marketPrice = boughtPrice || (matchedAsset.amount && currentQty > 0 ? Math.round(matchedAsset.amount / currentQty) : 32000);

          updatedAsset = {
            ...matchedAsset,
            quantity: newQty,
            costPrice: finalCost,
            amount: newQty * marketPrice,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          onUpdateAssetDirectly(updatedAsset);
        } else if (matchedAsset.type === 'gold') {
          const currentQty = matchedAsset.quantity || 0;
          const newQty = currentQty + boughtVal;
          const oldCost = matchedAsset.costPrice || (currentQty * (goal.unitPrice || 8200000));
          const finalCost = oldCost + (boughtVal * (boughtPrice || 8650000));
          const marketPrice = boughtPrice || (matchedAsset.amount && currentQty > 0 ? Math.round(matchedAsset.amount / currentQty) : 8650000);

          updatedAsset = {
            ...matchedAsset,
            quantity: newQty,
            costPrice: finalCost,
            amount: newQty * marketPrice,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          onUpdateAssetDirectly(updatedAsset);
        } else if (matchedAsset.type === 'cash') {
          updatedAsset = {
            ...matchedAsset,
            amount: (matchedAsset.amount || 0) + boughtVal,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          onUpdateAssetDirectly(updatedAsset);
        }
      } else {
        // Tự tạo tài sản mới trong Tab 1 nếu chưa tồn tại
        if (goal.assetType === 'stock' || goal.unit === 'CP') {
          const price = boughtPrice || 32000;
          updatedAsset = {
            id: newAssetId,
            level: '2',
            type: 'stock',
            name: goal.name,
            amount: boughtVal * price,
            costPrice: boughtVal * price,
            quantity: boughtVal,
            unit: 'CP',
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
        } else if (goal.assetType === 'gold' || goal.unit === 'chỉ' || goal.unit === 'lượng') {
          const price = boughtPrice || 8650000;
          updatedAsset = {
            id: newAssetId,
            level: '1',
            type: 'gold',
            name: goal.name,
            amount: boughtVal * price,
            costPrice: boughtVal * price,
            quantity: boughtVal,
            unit: goal.unit || 'chỉ',
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
        } else if (goal.assetType === 'cash') {
          updatedAsset = {
            id: newAssetId,
            level: '1',
            type: 'cash',
            name: goal.name,
            amount: boughtVal,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          };
        }

        if (updatedAsset) {
          onUpdateAssetDirectly(updatedAsset);
          onUpdateGoal({
            ...updatedGoal,
            linkedAssetId: updatedAsset.id,
          });
        }
      }

      // Lưu bản ghi lịch sử giao dịch vào db.transactions nếu có
      if (updatedAsset && onSaveTransactions && isGoldOrStock) {
        const newTx: AssetTransaction = {
          id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          assetId: updatedAsset.id,
          goalId: goal.id,
          assetName: goal.name,
          date: new Date().toISOString().split('T')[0],
          type: 'buy',
          quantity: boughtVal,
          unit: goal.unit,
          pricePerUnit: boughtPrice,
          totalAmount: Math.round(boughtVal * boughtPrice),
          note: `Nạp tích sản định kỳ (${currentPeriodStr}) từ Mục Tiêu: ${goal.name}`,
          createdAt: new Date().toISOString(),
        };
        const currentTxs = db.transactions || [];
        onSaveTransactions([newTx, ...currentTxs], updatedAsset, updatedGoal);
      }
    }

    setDcaDepositGoal(null);
    showToast(
      `✓ Đã nạp thành công ${formatNumberString(boughtVal)} ${goal.unit} vào "${goal.name}"! Tự động cập nhật số dư Tháp Tài Sản (Tab 1).`,
      'success'
    );
  };

  // Complete Goal and Auto Sync with Tab 1 or Tab 2!
  const handleCompleteGoal = (goal: Goal) => {
    // 1. Nếu là mục tiêu Tiết kiệm: Mở modal tạo sổ mới riêng biệt
    if (goal.assetType === 'saving' || (!goal.assetType && goal.unit === 'VNĐ' && goal.group === 'dca')) {
      handleOpenCreateSavingModal(goal);
      return;
    }

    setGoalToComplete(goal);
  };

  const executeCompleteGoal = (goal: Goal) => {
    // 2. Nếu liên kết nợ Tab 2: tất toán nợ ở Tab 2
    if (goal.linkedDebtId && onUpdateDebtDirectly) {
      const linkedDebt = db.debts.find((d) => String(d.id) === String(goal.linkedDebtId));
      if (linkedDebt) {
        onUpdateDebtDirectly({
          ...linkedDebt,
          status: 'Đã tất toán',
          paidPrincipal: linkedDebt.amount,
          settledDate: new Date().toLocaleDateString('vi-VN'),
        });
      }
    }

    // 3. Nếu là DCA cổ phiếu/vàng: cập nhật hoàn thành
    if (goal.goalType === 'dca') {
      const linked = goal.linkedAssetId
        ? db.assets.find((a) => String(a.id) === String(goal.linkedAssetId))
        : db.assets.find((a) => a.name.toLowerCase() === goal.name.toLowerCase());

      if (linked) {
        if (linked.type === 'stock' || linked.type === 'gold') {
          const finalQty = Math.max(linked.quantity || 0, goal.totalBought || 0);
          onUpdateAssetDirectly({
            ...linked,
            quantity: finalQty,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
          });
        }
      }
    }

    // 4. Nếu là cột mốc lớn (BĐS, Nhà đất):
    if (goal.goalType === 'milestone' && goal.target && !goal.linkedDebtId) {
      const lower = goal.name.toLowerCase();
      let lvl: '1' | '2' | '3' = '2';
      let t: any = 'other';
      if (lower.includes('nhà') || lower.includes('chung cư')) {
        lvl = '2';
        t = 'realestate_live';
      } else if (lower.includes('đất')) {
        lvl = '2';
        t = 'realestate_land';
      } else if (lower.includes('vàng')) {
        lvl = '1';
        t = 'gold';
      } else if (lower.includes('tiết kiệm') || lower.includes('quỹ')) {
        lvl = '1';
        t = 'saving';
      }

      const newAsset: Asset = {
        id: Date.now(),
        level: lvl,
        type: t,
        name: goal.name,
        amount: goal.target,
        updatedAt: new Date().toLocaleDateString('vi-VN'),
      };
      onUpdateAssetDirectly(newAsset);
    }

    // 5. Cập nhật trạng thái hoàn thành
    const updatedGoal: Goal = {
      ...goal,
      status: 'completed',
    };
    onUpdateGoal(updatedGoal);
    showToast(`✓ Đã hoàn thành mục tiêu "${goal.name}" thành công! Dữ liệu đã đồng bộ xuyên suốt hệ thống.`, 'success');
  };

  // Stress-test simulation auto-fill
  const autoFillStressTest = () => {
    const cashAndSaving = db.assets
      .filter((a) => a.level === '1' && (a.type === 'cash' || a.type === 'saving'))
      .reduce((sum, a) => sum + a.amount, 0);
    const goldVal = db.assets.filter((a) => a.type === 'gold').reduce((sum, a) => sum + a.amount, 0);
    const stockVal = db.assets.filter((a) => a.type === 'stock').reduce((sum, a) => sum + a.amount, 0);
    const emergencyFund = totalMonthlyDebtOutflow > 0 ? totalMonthlyDebtOutflow * 6 : 150000000;

    setSimTargetValStr(formatNumberString(3000000000));
    setSimMonthsLeft(24);
    setSimCashValStr(formatNumberString(cashAndSaving));
    setSimGoldValStr(formatNumberString(goldVal));
    setSimStockValStr(formatNumberString(stockVal));
    setSimEmergencyFundStr(formatNumberString(emergencyFund));
    setSimLoanYears(20);
    setSimGraceYears(0);
    setSimPromoMonths(24);
    setSimPromoRate(6.5);
    setSimNormalRate(10.5);
    setSimStressRate(12.5);
  };

  // Simulation calculations
  const targetVal = parseFormattedNumber(simTargetValStr) || 3000000000;
  const cashVal = parseFormattedNumber(simCashValStr);
  const goldVal = parseFormattedNumber(simGoldValStr);
  const stockVal = parseFormattedNumber(simStockValStr);
  const emergencyFund = parseFormattedNumber(simEmergencyFundStr) || 150000000;

  const liquidAssetsReady = Math.max(0, cashVal + goldVal + stockVal - emergencyFund);
  const surplusAccumulated = monthlySurplusAvailable * simMonthsLeft;
  const totalOwnCapital = liquidAssetsReady + surplusAccumulated;

  const loanNeeded = Math.max(0, targetVal - totalOwnCapital);
  const totalLoanMonths = simLoanYears * 12;
  const graceMonths = simGraceYears * 12;
  const repayMonths = Math.max(1, totalLoanMonths - graceMonths);

  const principalMonthlyPromo = graceMonths >= simPromoMonths ? 0 : Math.round(loanNeeded / repayMonths);
  const interestMonthlyPromo = Math.round((loanNeeded * (simPromoRate / 100)) / 12);
  const totalPromoMonthlyDebt = principalMonthlyPromo + interestMonthlyPromo;

  const principalMonthlyNormal = Math.round(loanNeeded / repayMonths);
  const remainingPrincipalAfterPromo = Math.max(0, loanNeeded - principalMonthlyPromo * simPromoMonths);
  const interestMonthlyNormal = Math.round((remainingPrincipalAfterPromo * (simNormalRate / 100)) / 12);
  const totalNormalMonthlyDebt = principalMonthlyNormal + interestMonthlyNormal;

  const stressInterestMonthly = Math.round((remainingPrincipalAfterPromo * (simStressRate / 100)) / 12);
  const totalStressMonthlyDebt = principalMonthlyNormal + stressInterestMonthly;

  const netBuffer = monthlySurplusAvailable - totalNormalMonthlyDebt;
  const ltv = targetVal > 0 ? Math.round((loanNeeded / targetVal) * 100) : 0;
  const dsti = totalMonthlyInflow > 0 ? Math.round((totalNormalMonthlyDebt / totalMonthlyInflow) * 100) : 0;

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* 1. DEDICATED MOBILE VIEW (< md) - CHUẨN GIAO DIỆN ĐIỆN THOẠI */}
      <div className="md:hidden bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Row 1: Đệm Dòng Tiền Tự Do Còn Lại Banner */}
        <div
          className={`flex items-center justify-between rounded-xl p-3 border ${
            remainingFreeBuffer >= 0
              ? 'bg-blue-50/80 border-blue-200/90'
              : 'bg-rose-50/80 border-rose-200/90'
          }`}
        >
          <div className="min-w-0 flex-1 mr-2">
            <span
              className={`text-[11px] font-bold uppercase tracking-wide block truncate ${
                remainingFreeBuffer >= 0 ? 'text-blue-800' : 'text-rose-800'
              }`}
            >
              Dòng Tiền Tự Do Còn Lại
            </span>
            <span
              className={`text-lg font-black tracking-tight block truncate mt-0.5 ${
                remainingFreeBuffer >= 0 ? 'text-blue-700' : 'text-rose-600'
              }`}
            >
              {isPrivacyMode
                ? '•••••• ₫'
                : remainingFreeBuffer >= 0
                ? `+${formatVND(remainingFreeBuffer)}`
                : `${formatVND(remainingFreeBuffer)}`}
            </span>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border shrink-0 ${
              remainingFreeBuffer >= 0
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            {remainingFreeBuffer >= 0 ? '✓ An toàn' : '⚠️ Quá tải'}
          </span>
        </div>

        {/* Row 2: 2 Mini Columns side-by-side (Thặng Dư Khả Dụng vs Nhu Cầu Mục Tiêu) */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          {/* Cột 1: Thặng Dư Khả Dụng */}
          <div className="bg-emerald-50/80 border border-emerald-200/90 p-2.5 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wide block truncate">
                Thặng Dư Khả Dụng
              </span>
              <div className="text-sm font-black text-emerald-700 mt-0.5 truncate">
                {isPrivacyMode ? '•••••• ₫' : `+${formatVND(monthlySurplusAvailable)}`}
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-emerald-200/70 text-[10px] space-y-1 text-emerald-950 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Thu:</span>
                <span className="font-bold">{formatVND(totalMonthlyInflow, isPrivacyMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Nợ:</span>
                <span className="font-bold text-rose-600">-{formatVND(totalMonthlyDebtOutflow, isPrivacyMode)}</span>
              </div>
            </div>
          </div>

          {/* Cột 2: Ngân Sách Mục Tiêu */}
          <div className="bg-amber-50/80 border border-amber-200/90 p-2.5 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wide truncate">
                  Nhu Cầu Mục Tiêu
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border shrink-0 ${
                    allocationBurdenRatio <= 70
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : allocationBurdenRatio <= 100
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  Tải: {isPrivacyMode ? '••%' : `${allocationBurdenRatio}%`}
                </span>
              </div>
              <div className="text-sm font-black text-amber-700 mt-0.5 truncate">
                {isPrivacyMode ? '•••••• ₫' : `-${formatVND(monthlyGoalAllocation)}`}
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-amber-200/70 text-[10px] space-y-1 text-amber-950 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Quý:</span>
                <span className="font-bold">{formatVND(monthlyGoalAllocation * 3, isPrivacyMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Năm:</span>
                <span className="font-bold">{formatVND(monthlyGoalAllocation * 12, isPrivacyMode)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chú thích 4 trụ cột */}
        <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-xs gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setShowGoalStandards(!showGoalStandards)}
            className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center space-x-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition shrink-0"
          >
            <span>{showGoalStandards ? 'Ẩn Chuẩn Mực' : 'Xem 4 Trụ Cột'}</span>
            {showGoalStandards ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showGoalStandards && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] space-y-2 animate-in fade-in duration-150">
            <div className="font-bold text-slate-800 text-[10px]">
              4 Trụ Cột Hoạch Định Tài Chính:
            </div>
            <p className="text-slate-600 leading-relaxed">
              1. <strong>Giảm Nợ:</strong> Ưu tiên khi DTI &gt; 35% hoặc nợ lãi cao.<br/>
              2. <strong>DCA Tích Sản:</strong> Tích sản đều đặn vào ngày cố định hàng tháng.<br/>
              3. <strong>Quỹ Runway:</strong> Dự phòng 3-6 tháng sinh hoạt phí và nợ gốc lãi.<br/>
              4. <strong>Cột Mốc Lớn:</strong> Phân rã mục tiêu dài hạn (mua nhà, xe, FIRE).
            </p>
          </div>
        )}
      </div>

      {/* 2. DEDICATED DESKTOP VIEW (>= md) - PRESERVED 100% AS ORIGINAL */}
      <div className="hidden md:block bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center">
              <DollarSign className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
              <span>Cân Đối Dòng Tiền & Năng Lực Thực Hiện Mục Tiêu</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Đối chiếu thặng dư dòng tiền từ Tab 2 với tổng ngân sách tích sản và phân rã mục tiêu hằng tháng
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGoalStandards(!showGoalStandards)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition shrink-0"
            >
              <span>{showGoalStandards ? 'Ẩn Chú Thích' : 'Mở Chú Thích & Chuẩn Mực'}</span>
              {showGoalStandards ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Scientific Goals Standards Guide */}
        {showGoalStandards && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3 animate-in fade-in duration-150">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <i className="fa-solid fa-graduation-cap text-blue-600"></i>
              <span>4 Trụ Cột Hoạch Định Tài Chính & Kỷ Luật Tích Sản Chuẩn Quốc Tế</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-[11px] leading-relaxed">
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-rose-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>1. Giảm Đòn Bẩy / Nợ</span>
                </div>
                <p className="text-slate-600">
                  Ưu tiên số 1 khi DTI &gt; 35% hoặc có nợ lãi cao (thẻ tín dụng, vay tiêu dùng). Giảm nợ giúp lập tức giải phóng dòng tiền mặt hàng tháng.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-amber-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>2. Tích Sản Định Kỳ (DCA)</span>
                </div>
                <p className="text-slate-600">
                  Tích lũy bình quân giá tài sản có giá trị nội tại (Cổ phiếu top đầu, Vàng, Tiết kiệm) theo ngày chốt cố định mỗi tháng/quý.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-blue-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>3. Quỹ Runway Dự Phòng</span>
                </div>
                <p className="text-slate-600">
                  Duy trì tối thiểu 3 đến 6 tháng chi phí sinh hoạt và nợ gốc lãi để gia đình luôn đứng vững trước bất kỳ rủi ro công việc hay sức khỏe nào.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-emerald-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>4. Cột Mốc Lớn / FIRE</span>
                </div>
                <p className="text-slate-600">
                  Phân rã mục tiêu lớn (Mua nhà, xe, vốn đầu tư, tự do tài chính) thành các khoản tích lũy hàng tháng và kiểm định áp lực nợ trước khi quyết định.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 lg:gap-4">
          {/* Ô 1: Dòng Tiền Tự Do Còn Lại (Đưa lên đầu) */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between min-w-0 ${
              remainingFreeBuffer >= 0
                ? 'bg-blue-50/70 border-blue-200/80'
                : 'bg-rose-50/70 border-rose-200/80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={`text-xs font-bold uppercase tracking-wider block ${
                    remainingFreeBuffer >= 0 ? 'text-blue-800' : 'text-rose-800'
                  }`}
                >
                  Dòng Tiền Tự Do Còn Lại
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                    remainingFreeBuffer >= 0
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  {remainingFreeBuffer >= 0 ? '✓ Đệm an toàn' : '⚠️ Quá tải'}
                </span>
              </div>
              <div
                className={`text-xl lg:text-2xl font-black mt-1.5 leading-tight ${
                  remainingFreeBuffer >= 0 ? 'text-blue-700' : 'text-rose-600'
                }`}
              >
                {isPrivacyMode
                  ? '•••••• ₫'
                  : remainingFreeBuffer >= 0
                  ? `+${formatVND(remainingFreeBuffer)}`
                  : `${formatVND(remainingFreeBuffer)}`}
              </div>
            </div>

            <div
              className={`mt-2 pt-2 border-t text-[11px] font-medium ${
                remainingFreeBuffer >= 0
                  ? 'border-blue-200/60 text-blue-800/80'
                  : 'border-rose-200/60 text-rose-800/80'
              }`}
            >
              {remainingFreeBuffer >= 0
                ? 'Đệm thanh khoản tự do sau khi trừ mọi khoản nợ & trích lập mục tiêu'
                : 'Cảnh báo: Mục tiêu vượt quá thặng dư hàng tháng, cần giãn thời hạn!'}
            </div>
          </div>

          {/* Ô 2: Dòng Tiền Thặng Dư Khả Dụng */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 rounded-xl flex flex-col justify-between min-w-0">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Dòng Tiền Thặng Dư
              </span>
              <div className="text-xl lg:text-2xl font-black text-emerald-700 mt-1.5 leading-tight">
                {isPrivacyMode ? '•••••• ₫' : `+${formatVND(monthlySurplusAvailable)}`}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-emerald-200/60 text-[11px] space-y-1 text-emerald-900">
              <div className="flex justify-between">
                <span className="text-slate-600">Tổng thu:</span>
                <span className="font-bold">{formatVND(totalMonthlyInflow, isPrivacyMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Nợ Tab 2:</span>
                <span className="font-bold text-rose-600">-{formatVND(totalMonthlyDebtOutflow, isPrivacyMode)}</span>
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold pt-0.5 border-t border-emerald-100">
                Nguồn lực thực tế hàng tháng
              </div>
            </div>
          </div>

          {/* Ô 3: Ngân Sách Phân Bổ Cho Mục Tiêu */}
          <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-xl flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                  Ngân Sách Mục Tiêu Cần
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border shrink-0 ${
                    allocationBurdenRatio <= 70
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : allocationBurdenRatio <= 100
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  Tải: {isPrivacyMode ? '••%' : `${allocationBurdenRatio}%`}
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-amber-700 mt-1.5 leading-tight">
                {isPrivacyMode ? '•••••• ₫' : `-${formatVND(monthlyGoalAllocation)}`}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-amber-200/60 text-[11px] space-y-1 text-amber-900">
              <div className="flex justify-between">
                <span className="text-slate-600">Quý cần:</span>
                <span className="font-bold">{formatVND(monthlyGoalAllocation * 3, isPrivacyMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Năm cần:</span>
                <span className="font-bold">{formatVND(monthlyGoalAllocation * 12, isPrivacyMode)}</span>
              </div>
              <div className="text-[10px] text-amber-800 font-semibold pt-0.5 border-t border-amber-100">
                DCA + Quỹ cột mốc
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 PILLAR PROGRESS METRIC LIST - DẠNG DANH SÁCH RÕ RÀNG, TRỰC QUAN (HỖ TRỢ ẨN / HIỆN, MẶC ĐỊNH LÀ ẨN) */}
      <div className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs">
        <div
          onClick={() => setShowPillarList(!showPillarList)}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none group"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center group-hover:text-emerald-700 transition-colors">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 mr-1.5 sm:mr-2 shrink-0" />
              <span>Hoạch Định Mục Tiêu & Kế Hoạch Tích Sản</span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
              Kỷ luật tích sản định kỳ (DCA) • Cột mốc tài sản lớn • Thẩm định phương án vay
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
            {/* Tóm tắt nhanh khi đang ẩn */}
            {!showPillarList && (
              <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-[10px] text-slate-600 font-medium">
                <span className="font-bold text-rose-600">Nợ: {debtProgressPercent}%</span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-amber-600">DCA: {dcaCount} MT</span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-blue-600">Runway: {runwayMonths}th</span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-emerald-700">Quỹ: {milestoneProgressPercent}%</span>
              </div>
            )}

            {/* Nút Ẩn / Hiện */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowPillarList(!showPillarList);
              }}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[10.5px] sm:text-xs font-bold transition-all duration-150 cursor-pointer shadow-2xs ${
                showPillarList
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/90'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/90'
              }`}
            >
              <span>{showPillarList ? 'Ẩn danh sách' : 'Hiện danh sách (4 nhóm)'}</span>
              {showPillarList ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </button>
          </div>
        </div>

        {/* Danh sách 4 Nhóm Trụ Cột (Chỉ mở ra khi showPillarList === true) */}
        {showPillarList && (
          <div className="space-y-2 sm:space-y-2.5 pt-3 sm:pt-4 mt-3 border-t border-slate-100 animate-in fade-in duration-200">
            {/* Nhóm 1: Trả Nợ Vay */}
            <div
              onClick={() => setSelectedGroupFilter(selectedGroupFilter === 'debt' ? 'all' : 'debt')}
              className={`group p-2.5 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                selectedGroupFilter === 'debt'
                  ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200 shadow-2xs'
                  : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
              }`}
              title="Nhấn để lọc các mục tiêu thuộc Nhóm 1: Trả Nợ Vay"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                {/* Cột trái: Icon + Nhóm + Chi tiết */}
                <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                    <i className="fa-solid fa-file-invoice-dollar text-rose-500 text-sm sm:text-base"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                        Nhóm 1: Trả Nợ Vay & Giảm Đòn Bẩy
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9.5px] font-bold border bg-rose-100/70 text-rose-700 border-rose-200 shrink-0">
                        {totalDebtOriginal > 0 && debtProgressPercent >= 100 ? 'Đã tất toán' : 'Đang trả nợ'}
                      </span>
                      {selectedGroupFilter === 'debt' && (
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9px] font-bold bg-slate-900 text-white shrink-0">
                          Đang lọc
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-bold text-slate-700">
                        Đã trả: {formatVND(totalDebtPaid, isPrivacyMode)} / {formatVND(totalDebtOriginal, isPrivacyMode)}
                      </span>
                      <span className="hidden md:inline text-slate-300">•</span>
                      <span className="hidden md:inline text-slate-500 text-[10.5px]">
                        Hạ nhanh nợ gốc & tối ưu chi phí lãi vay
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cột phải: Thanh tiến độ + Chỉ số % */}
                <div className="flex items-center space-x-3 sm:space-x-4 shrink-0 sm:w-72 justify-between sm:justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <div className="flex-1 min-w-[110px] max-w-[160px] sm:max-w-[180px]">
                    <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] text-slate-500 mb-1">
                      <span className="font-medium text-slate-500">Tiến độ trả nợ</span>
                      <span className="font-bold text-rose-600">{debtProgressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${debtProgressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-right min-w-[65px] sm:min-w-[80px] shrink-0">
                    <div className="text-sm sm:text-base font-black text-rose-600 leading-tight">
                      {debtProgressPercent}%
                    </div>
                    <div className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-medium leading-none mt-0.5">
                      {selectedGroupFilter === 'debt' ? 'Đang chọn' : 'Nhấn để lọc'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nhóm 2: Tích Sản Định Kỳ */}
            <div
              onClick={() => setSelectedGroupFilter(selectedGroupFilter === 'dca' ? 'all' : 'dca')}
              className={`group p-2.5 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                selectedGroupFilter === 'dca'
                  ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                  : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
              }`}
              title="Nhấn để lọc các mục tiêu thuộc Nhóm 2: Tích Sản Định Kỳ (DCA)"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                {/* Cột trái */}
                <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                    <i className="fa-solid fa-coins text-amber-500 text-sm sm:text-base"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                        Nhóm 2: Tích Sản Định Kỳ (DCA)
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9.5px] font-bold border bg-amber-100/70 text-amber-800 border-amber-200 shrink-0">
                        Kỷ luật định kỳ
                      </span>
                      {overdueDcaGoals.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse shrink-0 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                          <span>{overdueDcaGoals.length} mục tiêu nợ/quá hạn</span>
                        </span>
                      )}
                      {selectedGroupFilter === 'dca' && (
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9px] font-bold bg-slate-900 text-white shrink-0">
                          Đang lọc
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-bold text-slate-700">
                        Theo dõi mua bù & nạp định kỳ (Cổ phiếu, Vàng, Tiết kiệm)
                      </span>
                      <span className="hidden md:inline text-slate-300">•</span>
                      <span className="hidden md:inline text-slate-500 text-[10.5px]">
                        {dcaCount} kế hoạch đang duy trì
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cột phải */}
                <div className="flex items-center space-x-3 sm:space-x-4 shrink-0 sm:w-72 justify-between sm:justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <div className="flex-1 min-w-[110px] max-w-[160px] sm:max-w-[180px]">
                    <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] text-slate-500 mb-1">
                      <span className="font-medium text-slate-500">Kế hoạch duy trì</span>
                      <span className="font-bold text-emerald-600">{dcaCount ? '100%' : '0%'}</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                        style={{ width: dcaCount ? '100%' : '0%' }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-right min-w-[65px] sm:min-w-[80px] shrink-0">
                    <div className="text-sm sm:text-base font-black text-emerald-700 leading-tight">
                      {dcaCount} Mục tiêu
                    </div>
                    <div className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-medium leading-none mt-0.5">
                      {selectedGroupFilter === 'dca' ? 'Đang chọn' : 'Nhấn để lọc'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nhóm 3: Dự Phòng (Runway) */}
            <div
              onClick={() => setSelectedGroupFilter(selectedGroupFilter === 'runway' ? 'all' : 'runway')}
              className={`group p-2.5 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                selectedGroupFilter === 'runway'
                  ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-200 shadow-2xs'
                  : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
              }`}
              title="Nhấn để lọc các mục tiêu thuộc Nhóm 3: Quỹ Dự Phòng (Runway)"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                {/* Cột trái */}
                <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                    <i className="fa-solid fa-shield-halved text-blue-600 text-sm sm:text-base"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                        Nhóm 3: Quỹ Dự Phòng (Runway)
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9.5px] font-bold border shrink-0 ${
                          Number(runwayMonths) >= 6
                            ? 'bg-blue-100/70 text-blue-800 border-blue-200'
                            : 'bg-amber-100/70 text-amber-800 border-amber-200'
                        }`}
                      >
                        {Number(runwayMonths) >= 6 ? 'Đạt chuẩn an toàn' : 'Cần củng cố'}
                      </span>
                      {selectedGroupFilter === 'runway' && (
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9px] font-bold bg-slate-900 text-white shrink-0">
                          Đang lọc
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-bold text-slate-700">
                        Thanh khoản: {formatVND(liquidAssets, isPrivacyMode)}
                      </span>
                      <span className="hidden md:inline text-slate-300">•</span>
                      <span className="hidden md:inline text-slate-500 text-[10.5px]">
                        Chuẩn an toàn: ≥ 6 tháng chi trả nghĩa vụ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cột phải */}
                <div className="flex items-center space-x-3 sm:space-x-4 shrink-0 sm:w-72 justify-between sm:justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <div className="flex-1 min-w-[110px] max-w-[160px] sm:max-w-[180px]">
                    <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] text-slate-500 mb-1">
                      <span className="font-medium text-slate-500">Mức độ đệm</span>
                      <span className="font-bold text-blue-600">{runwayPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${runwayPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-right min-w-[65px] sm:min-w-[80px] shrink-0">
                    <div className="text-sm sm:text-base font-black text-blue-700 leading-tight">
                      {runwayMonths} tháng
                    </div>
                    <div className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-medium leading-none mt-0.5">
                      {selectedGroupFilter === 'runway' ? 'Đang chọn' : 'Nhấn để lọc'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nhóm 4: Quỹ Lớn / BĐS */}
            <div
              onClick={() => setSelectedGroupFilter(selectedGroupFilter === 'milestone' ? 'all' : 'milestone')}
              className={`group p-2.5 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                selectedGroupFilter === 'milestone'
                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200 shadow-2xs'
                  : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
              }`}
              title="Nhấn để lọc các mục tiêu thuộc Nhóm 4: Cột Mốc Lớn / Quỹ BĐS / FIRE"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                {/* Cột trái */}
                <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                    <i className="fa-solid fa-landmark text-emerald-600 text-sm sm:text-base"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                        Nhóm 4: Cột Mốc Lớn / Quỹ BĐS / FIRE
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9.5px] font-bold border bg-emerald-100/70 text-emerald-800 border-emerald-200 shrink-0">
                        Quy mô vốn lớn
                      </span>
                      {selectedGroupFilter === 'milestone' && (
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9px] font-bold bg-slate-900 text-white shrink-0">
                          Đang lọc
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-bold text-slate-700">
                        Mục tiêu: {formatVND(totalMilestoneTarget, isPrivacyMode)}
                      </span>
                      <span className="hidden md:inline text-slate-300">•</span>
                      <span className="hidden md:inline text-slate-500 text-[10.5px]">
                        Phân rã kế hoạch mua nhà, xe, vốn đầu tư dài hạn
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cột phải */}
                <div className="flex items-center space-x-3 sm:space-x-4 shrink-0 sm:w-72 justify-between sm:justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <div className="flex-1 min-w-[110px] max-w-[160px] sm:max-w-[180px]">
                    <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] text-slate-500 mb-1">
                      <span className="font-medium text-slate-500">Mức tích lũy</span>
                      <span className="font-bold text-emerald-600">{milestoneProgressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${milestoneProgressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-right min-w-[65px] sm:min-w-[80px] shrink-0">
                    <div className="text-sm sm:text-base font-black text-emerald-700 leading-tight">
                      {milestoneProgressPercent}%
                    </div>
                    <div className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-medium leading-none mt-0.5">
                      {selectedGroupFilter === 'milestone' ? 'Đang chọn' : 'Nhấn để lọc'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACTION BUTTON, FILTERS & LIVE MARKET STRIP (GỌN GÀNG, CHUẨN ĐIỆN THOẠI, VỪA MẮT) */}
      <div className="flex flex-col gap-2">
        {/* HÀNG 1: Nút Tạo Mục Tiêu Mới & Bộ Lọc Nhóm / Thời Gian */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Nút Tạo Mục Tiêu */}
          <button
            onClick={() => {
              if (showGoalForm) handleCancelForm();
              else setShowGoalForm(true);
            }}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>{showGoalForm ? 'Đóng Khung Thiết Lập' : '+ Thiết Lập Mục Tiêu Mới'}</span>
          </button>

          {/* Hai bộ lọc thu gọn, chuẩn mobile */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto text-xs">
            {/* Bộ lọc Nhóm */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200/90 px-2 py-1.5 rounded-lg shadow-2xs">
              <Layers className="w-3 h-3 text-slate-500 shrink-0" />
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value as any)}
                className="bg-transparent text-[11px] font-bold text-slate-800 outline-none cursor-pointer w-full"
              >
                <option value="all">Tất cả nhóm</option>
                <option value="debt">Nhóm 1: Trả Nợ</option>
                <option value="dca">Nhóm 2: Tích Sản</option>
                <option value="runway">Nhóm 3: Dự Phòng</option>
                <option value="milestone">Nhóm 4: Cột Mốc</option>
              </select>
            </div>

            {/* Bộ lọc Thời gian */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200/90 px-2 py-1.5 rounded-lg shadow-2xs">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select
                value={selectedTimeFilter}
                onChange={(e) => setSelectedTimeFilter(e.target.value as any)}
                className="bg-transparent text-[11px] font-bold text-slate-800 outline-none cursor-pointer w-full"
              >
                <option value="all">Tất cả kỳ</option>
                <option value="month">Tháng này</option>
                <option value="quarter">Quý này</option>
                <option value="year">Trong 1 Năm</option>
                <option value="longterm">Dài hạn (&gt; 1N)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* GOAL FORM MODAL OVERLAY (Responsive Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {showGoalForm && (
        <div
          onClick={handleCancelForm}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto cursor-pointer"
        >
          <form
            ref={goalFormRef}
            onSubmit={handleSaveGoal}
            onClick={(e) => e.stopPropagation()}
            className={`bg-white p-3.5 sm:p-6 rounded-t-2xl sm:rounded-2xl border shadow-2xl space-y-2.5 sm:space-y-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto cursor-default ${
              editingGoalId ? 'border-amber-400 ring-4 ring-amber-100' : 'border-slate-200'
            }`}
          >
            {/* Mobile Drag Handle Indicator */}
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden"></div>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 sm:pb-3">
              <div className="min-w-0 flex-1 mr-2 sm:mr-3">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-base font-bold text-slate-900 flex items-center">
                    <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 mr-1.5 shrink-0" />
                    <span className="truncate">
                      {editingGoalId ? `Sửa: ${goalName || 'Mục tiêu'}` : 'Thiết Lập Mục Tiêu'}
                    </span>
                  </h3>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold border shrink-0 ${
                      formMode === 'dca'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    {formMode === 'dca' ? 'Tích Sản DCA' : 'Cột Mốc Lớn'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 truncate mt-0.5">
                  {editingGoalId
                    ? 'Định mức cam kết, lũy kế và liên kết tài sản'
                    : 'Đồng bộ liên kết Tab 1 & Tab 2 • Tùy biến chu kỳ'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelForm}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer shrink-0"
                title="Đóng khung nhập"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* When Creating New: Goal Mode Switcher & Group Select */}
            {!editingGoalId && (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex p-0.5 sm:p-1 bg-slate-100 rounded-xl max-w-md">
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode('dca');
                      setGoalGroup('dca');
                    }}
                    className={`flex-1 py-1 sm:py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      formMode === 'dca' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <i className="fa-solid fa-calendar-check text-amber-500 text-xs"></i>
                    <span>Tích Sản (DCA)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode('milestone');
                      if (goalGroup === 'dca') setGoalGroup('milestone');
                    }}
                    className={`flex-1 py-1 sm:py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      formMode === 'milestone' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <i className="fa-solid fa-flag-checkered text-blue-600 text-xs"></i>
                    <span>Cột Mốc Lớn</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">
                      Phân Nhóm Trụ Cột Mục Tiêu
                    </label>
                    <select
                      value={goalGroup}
                      onChange={(e) => setGoalGroup(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:border-blue-500"
                    >
                      <option value="dca">Nhóm 2: Tích Sản Định Kỳ (Cổ phiếu, Vàng, Tiền gửi...)</option>
                      <option value="runway">Nhóm 3: Quỹ Dự Phòng Thanh Khoản (Khẩn cấp 3-6-12T)</option>
                      <option value="debt">Nhóm 1: Trả Nợ Vay & Giảm Đòn Bẩy (Liên kết nợ Tab 2)</option>
                      <option value="milestone">Nhóm 4: Cột Mốc Lớn / Quỹ BĐS / FIRE</option>
                    </select>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[10.5px] sm:text-[11px] text-slate-600 flex items-center leading-snug">
                    {goalGroupLabels[goalGroup].desc}
                  </div>
                </div>
              </div>
            )}

            {/* DCA MODE FORM SECTION */}
            {formMode === 'dca' ? (
              <div className="space-y-2.5 sm:space-y-3.5">
                {/* Row 1: Loại tài sản & Liên kết Tab 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">Loại Tài Sản</label>
                    <select
                      value={assetType}
                      onChange={(e) => handleAssetTypeChange(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                    >
                      <option value="stock">Cổ Phiếu / ETF Tích Sản</option>
                      <option value="gold">Vàng Vật Chất (Nhẫn tròn / SJC)</option>
                      <option value="saving">Tiền Tiết Kiệm Định Kỳ</option>
                      <option value="cash">Tiền Mặt / Quỹ Thanh Khoản</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">
                      Liên Kết Tab 1 / Tên Mục Tiêu
                    </label>
                    <div className="space-y-1 sm:space-y-1.5">
                      {/* Huy hiệu hiển thị trạng thái tự động rà soát liên kết */}
                      {linkedBankKey ? (
                        <div className="p-1.5 sm:p-2 bg-indigo-50 border border-indigo-200 rounded-lg sm:rounded-xl text-[10.5px] sm:text-[11px] text-indigo-900 flex items-start gap-1.5">
                          <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold">✓ Liên kết: SỐ TỔNG {linkedBankKey.toUpperCase()} (Tab 1)</span>
                          </div>
                        </div>
                      ) : linkedAssetId ? (
                        (() => {
                          const linkedA = db.assets.find((a) => a.id === linkedAssetId);
                          return (
                            <div className="p-1.5 sm:p-2 bg-emerald-50 border border-emerald-200 rounded-lg sm:rounded-xl text-[10.5px] sm:text-[11px] text-emerald-900 flex items-start gap-1.5">
                              <LinkIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0 truncate">
                                <span className="font-bold">✓ Liên kết: {linkedA?.name || 'Tài sản Tab 1'}</span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="px-2 py-0.5 sm:py-1 bg-slate-100 border border-slate-200 rounded-lg text-[9.5px] sm:text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <span>⚪ Chưa liên kết vào Tab 1</span>
                        </div>
                      )}

                      <select
                        value={linkedBankKey ? `bank:${linkedBankKey}` : linkedAssetId ? String(linkedAssetId) : ''}
                        onChange={(e) => handleSelectAssetFromTab1(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-bold text-slate-800 outline-none truncate focus:border-emerald-500 focus:bg-white"
                        title="Chọn tài sản liên kết từ Tab 1"
                      >
                        <option value="">-- Không liên kết (Mục tiêu độc lập) --</option>
                        
                        {/* ƯU TIÊN HIỂN THỊ ĐÚNG LOẠI TÀI SẢN ĐANG CHỌN */}
                        {assetType === 'stock' && db.assets.some((a) => a.type === 'stock') && (
                          <optgroup label="⭐ CỔ PHIẾU (Tab 1)">
                            {db.assets
                              .filter((a) => a.type === 'stock')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  📈 {a.name} ({formatNumberString(a.quantity || 0)} CP)
                                </option>
                              ))}
                          </optgroup>
                        )}

                        {assetType === 'gold' && db.assets.some((a) => a.type === 'gold') && (
                          <optgroup label="⭐ VÀNG (Tab 1)">
                            {db.assets
                              .filter((a) => a.type === 'gold')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  🪙 {a.name} ({formatNumberString(a.quantity || 0)} chỉ)
                                </option>
                              ))}
                          </optgroup>
                        )}

                        {assetType === 'saving' && (
                          <>
                            {savingBankGroups.length > 0 && (
                              <optgroup label="⭐ SỐ TỔNG THEO NGÂN HÀNG (Tab 1)">
                                {savingBankGroups.map((bg) => (
                                  <option key={`bank:${bg.bankKey}`} value={`bank:${bg.bankKey}`}>
                                    🏛️ [TỔNG] {bg.bankName} — {bg.count} sổ ({formatVND(bg.totalPrincipal)})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {db.assets.some((a) => a.type === 'saving') && (
                              <optgroup label="🏦 Từng Sổ Tiết Kiệm (Tab 1)">
                                {db.assets
                                  .filter((a) => a.type === 'saving')
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      — {a.name} ({formatVND(a.amount)})
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                          </>
                        )}

                        {assetType === 'cash' && db.assets.some((a) => a.type === 'cash') && (
                          <optgroup label="⭐ TIỀN MẶT (Tab 1)">
                            {db.assets
                              .filter((a) => a.type === 'cash')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  💵 {a.name} ({formatVND(a.amount)})
                                </option>
                              ))}
                          </optgroup>
                        )}

                        {/* CÁC LOẠI TÀI SẢN KHÁC Ở TAB 1 */}
                        {assetType !== 'stock' && db.assets.some((a) => a.type === 'stock') && (
                          <optgroup label="Cổ Phiếu khác (Tab 1)">
                            {db.assets
                              .filter((a) => a.type === 'stock')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  📈 {a.name} ({formatNumberString(a.quantity || 0)} CP)
                                </option>
                              ))}
                          </optgroup>
                        )}

                        {assetType !== 'gold' && db.assets.some((a) => a.type === 'gold') && (
                          <optgroup label="Vàng khác (Tab 1)">
                            {db.assets
                              .filter((a) => a.type === 'gold')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  🪙 {a.name} ({formatNumberString(a.quantity || 0)} chỉ)
                                </option>
                              ))}
                          </optgroup>
                        )}

                        {assetType !== 'saving' && savingBankGroups.length > 0 && (
                          <optgroup label="Ngân hàng & Sổ khác (Tab 1)">
                            {savingBankGroups.map((bg) => (
                              <option key={`bank:${bg.bankKey}`} value={`bank:${bg.bankKey}`}>
                                🏛️ [TỔNG] {bg.bankName} ({formatVND(bg.totalPrincipal)})
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {assetType !== 'cash' && db.assets.some((a) => a.type === 'cash') && (
                          <optgroup label="Tiền Mặt khác (Tab 1)">
                            {db.assets
                              .filter((a) => a.type === 'cash')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  💵 {a.name} ({formatVND(a.amount)})
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>

                      <input
                        ref={formMode === 'dca' ? goalNameInputRef : undefined}
                        type="text"
                        value={goalName}
                        onChange={(e) => handleGoalNameChange(e.target.value)}
                        placeholder="Hoặc tự gõ tên mục tiêu..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:bg-white focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Kỳ hạn & Ngày chốt + Định mức mỗi kỳ & Đơn vị */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">Kỳ Hạn & Ngày Chốt</label>
                    <div className="flex gap-1.5">
                      <select
                        value={freqMonths}
                        onChange={(e) => setFreqMonths(Number(e.target.value) || 1)}
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500 min-w-0"
                        title="Kỳ hạn nạp lặp lại"
                      >
                        <option value="1">1 Tháng (Hàng tháng)</option>
                        <option value="2">2 Tháng một lần</option>
                        <option value="3">3 Tháng (Hàng quý)</option>
                        <option value="6">6 Tháng (Nửa năm)</option>
                        <option value="12">1 Năm (Hàng năm)</option>
                      </select>
                      <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl px-2 shrink-0 gap-1 focus-within:border-emerald-500 focus-within:bg-white transition">
                        <span className="text-[10.5px] font-bold text-slate-500 select-none">Ngày</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={goalDay || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (!val) setGoalDay(1);
                            else {
                              const num = parseInt(val, 10);
                              setGoalDay(num > 31 ? 31 : Math.max(1, num));
                            }
                          }}
                          placeholder="10"
                          className="w-7 sm:w-8 bg-transparent py-2 text-xs font-bold text-slate-900 outline-none text-center"
                          title="Ngày chốt định kỳ trong tháng (1-31)"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">
                      Định Mức Mỗi Kỳ & Đơn Vị
                    </label>
                    <div className="flex rounded-lg sm:rounded-xl border border-slate-300 bg-slate-50 overflow-hidden focus-within:border-emerald-500 focus-within:bg-white transition">
                      <input
                        type="text"
                        value={targetQtyStr}
                        onChange={(e) => {
                          const isVnd = unit === 'VNĐ' || assetType === 'saving' || assetType === 'cash';
                          setTargetQtyStr(formatNumberString(e.target.value, !isVnd));
                        }}
                        placeholder={unit === 'VNĐ' ? 'Nhập số tiền nạp...' : 'VD: 1.5 hoặc 0.5'}
                        className="flex-1 bg-transparent p-2 text-xs font-bold text-emerald-700 outline-none min-w-0"
                      />
                      <select
                        value={unit}
                        onChange={(e) => {
                          const newUnit = e.target.value;
                          setUnit(newUnit);
                          if (newUnit === 'VNĐ') {
                            if (targetQtyStr) setTargetQtyStr(formatNumberString(targetQtyStr, false));
                            if (editTotalBoughtStr) setEditTotalBoughtStr(formatNumberString(editTotalBoughtStr, false));
                            if (editBacklogQtyStr) setEditBacklogQtyStr(formatNumberString(editBacklogQtyStr, false));
                          }
                        }}
                        className="w-20 sm:w-24 bg-slate-100 border-l border-slate-300 px-2 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer shrink-0"
                        title="Đơn vị tính"
                      >
                        <option value="CP">CP</option>
                        <option value="chỉ">chỉ</option>
                        <option value="lượng">lượng</option>
                        <option value="VNĐ">VNĐ</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 3: Khối lượng lũy kế & Giá vốn & Giá thị trường */}
                <div className="bg-slate-50/80 border border-slate-200 p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] sm:text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <i className="fa-solid fa-calculator text-emerald-600 text-xs"></i>
                      <span>Khối Lượng Lũy Kế & Đơn Giá</span>
                    </label>
                    <span className="text-[9.5px] sm:text-[10px] text-slate-600 bg-white px-1.5 py-0.2 rounded-md font-semibold border border-slate-200">
                      Đồng bộ 2 chiều
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
                    <div>
                      <label className="block text-[10px] sm:text-[10.5px] font-bold text-slate-700 mb-0.5 sm:mb-1 truncate">
                        Lũy kế có ({unit})
                      </label>
                      <input
                        type="text"
                        value={editTotalBoughtStr}
                        onChange={(e) => {
                          const isVnd = unit === 'VNĐ' || assetType === 'saving' || assetType === 'cash';
                          setEditTotalBoughtStr(formatNumberString(e.target.value, !isVnd));
                        }}
                        placeholder={unit === 'VNĐ' ? '50.000.000' : '5.5'}
                        className="w-full bg-white border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-bold text-emerald-700 outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-[10.5px] font-bold text-slate-700 mb-0.5 sm:mb-1 truncate">
                        Nợ bù ({unit})
                      </label>
                      <input
                        type="text"
                        value={editBacklogQtyStr}
                        onChange={(e) => {
                          const isVnd = unit === 'VNĐ' || assetType === 'saving' || assetType === 'cash';
                          setEditBacklogQtyStr(formatNumberString(e.target.value, !isVnd));
                        }}
                        placeholder={unit === 'VNĐ' ? '10.000.000' : '1.5'}
                        className="w-full bg-white border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-bold text-rose-700 outline-none focus:border-rose-500"
                      />
                    </div>

                    {(assetType === 'stock' || assetType === 'gold' || unit === 'CP' || unit === 'chỉ' || unit === 'lượng') ? (
                      <>
                        <div className="bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500">Giá Vốn TB</span>
                            <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Lịch Sử
                            </span>
                          </div>
                          <div className="text-xs font-black text-slate-900 mt-0.5 truncate">
                            {formatVND(parseFormattedNumber(editUnitPriceStr) || 0, isPrivacyMode)}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingGoalId) {
                                const g = db.goals.find((item) => item.id === editingGoalId);
                                if (g) handleOpenHistory(g);
                              } else {
                                const tempGoal: Goal = {
                                  id: Date.now(),
                                  group: goalGroup,
                                  goalType: 'dca',
                                  assetType,
                                  linkedAssetId,
                                  name: goalName || 'Mục tiêu mới',
                                  unit,
                                };
                                handleOpenHistory(tempGoal);
                              }
                            }}
                            className="mt-0.5 text-[9.5px] sm:text-[10px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer truncate"
                          >
                            <History className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>Lịch sử</span>
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-[10.5px] font-bold text-slate-700 mb-0.5 sm:mb-1 truncate">
                            Giá thị trường
                          </label>
                          <input
                            type="text"
                            value={editCurrentPriceStr}
                            onChange={(e) => setEditCurrentPriceStr(formatNumberString(e.target.value, false))}
                            placeholder={assetType === 'gold' ? '14.540.000' : '32.000'}
                            className="w-full bg-white border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-bold text-blue-700 outline-none focus:border-blue-500"
                          />
                          {(assetType === 'gold' || unit === 'chỉ' || unit === 'lượng' || goalName.toLowerCase().includes('vàng')) && (
                            <button
                              type="button"
                              onClick={() => {
                                const rec = getRecommendedGoldPrice(goldData, unit, goalName);
                                setEditCurrentPriceStr(formatNumberString(rec.pricePerUnit));
                              }}
                              className="mt-0.5 text-[9px] sm:text-[10px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer truncate"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              <span className="truncate">Lấy DOJI ({formatVND(getRecommendedGoldPrice(goldData, unit, goalName).pricePerUnit, isPrivacyMode)})</span>
                            </button>
                          )}
                          {isStockEntity({ type: assetType, assetType, unit, name: goalName }) && (
                            (() => {
                              const sym = extractStockTicker(goalName, assetType, unit);
                              const quote = sym ? getStockQuote(stockData, sym) : null;
                              if (!quote) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditCurrentPriceStr(formatNumberString(quote.price));
                                  }}
                                  className="mt-0.5 text-[9px] sm:text-[10px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer truncate"
                                >
                                  <TrendingUp className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                  <span className="truncate">Lấy giá {quote.symbol} ({formatVND(quote.price, isPrivacyMode)})</span>
                                </button>
                              );
                            })()
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 flex items-center text-[10.5px] sm:text-[11px] text-slate-500 bg-white p-2 rounded-lg sm:rounded-xl border border-slate-200">
                        <span>Quản lý tích lũy VNĐ trực tiếp.</span>
                      </div>
                    )}
                  </div>

                  {(linkedAssetId || db.assets.some((a) => a.name.toLowerCase() === goalName.trim().toLowerCase())) && (
                    <label className="flex items-center space-x-2 pt-0.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editSyncToAsset}
                        onChange={(e) => setEditSyncToAsset(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-700">
                        Đồng bộ số lượng, đơn giá sang Tháp Tài Sản (Tab 1)
                      </span>
                    </label>
                  )}

                  {/* Trạng thái nạp kỳ hiện tại (currentPeriodStr) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-800 block truncate">
                        Kỳ Này ({currentPeriodStr})
                      </span>
                      <span className="text-[10px] sm:text-[10.5px] text-slate-500 block truncate">
                        {editIsPaidThisPeriod
                          ? 'Đã hoàn thành định mức nạp'
                          : 'Chưa nạp / Đang chờ'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditIsPaidThisPeriod(!editIsPaidThisPeriod)}
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                        editIsPaidThisPeriod
                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                      }`}
                    >
                      {editIsPaidThisPeriod ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Đã nạp</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>Chờ nạp</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* MILESTONE MODE FORM SECTION */
              <div className="space-y-2.5 sm:space-y-3.5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                  {goalGroup === 'debt' ? (
                    <div className="col-span-2 md:col-span-4 bg-rose-50 border border-rose-200 p-2 sm:p-3 rounded-lg sm:rounded-xl">
                      <label className="block text-[10.5px] sm:text-[11px] font-bold text-rose-900 mb-1">
                        Khoản Nợ Tất Toán Từ Tab 2
                      </label>
                      <select
                        value={linkedDebtId || ''}
                        onChange={(e) => handleSelectDebtFromTab2(e.target.value)}
                        className="w-full bg-white border border-rose-300 rounded-lg p-2 text-xs font-bold text-rose-800 outline-none"
                      >
                        <option value="">-- Chọn khoản nợ từ Tab 2 --</option>
                        {db.debts
                          .filter((d) => d.status !== 'Đã tất toán')
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} (Dư nợ: {formatVND(Math.max(0, d.amount - (d.paidPrincipal || 0)))})
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <div className="col-span-2 md:col-span-4 bg-slate-50 border border-slate-200 p-2 sm:p-2.5 rounded-lg sm:rounded-xl space-y-1">
                      <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700">
                        Liên Kết Tài Sản / Số Tổng Ngân Hàng (Tab 1)
                      </label>
                      <select
                        value={linkedBankKey ? `bank:${linkedBankKey}` : linkedAssetId ? String(linkedAssetId) : ''}
                        onChange={(e) => handleSelectAssetFromTab1(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none truncate"
                      >
                        <option value="">-- Không liên kết / Tự lập cột mốc độc lập --</option>
                        {savingBankGroups.length > 0 && (
                          <optgroup label="🏛️ SỐ TỔNG THEO NGÂN HÀNG (Tab 1)">
                            {savingBankGroups.map((bg) => (
                              <option key={`bank:${bg.bankKey}`} value={`bank:${bg.bankKey}`}>
                                🏛️ [TỔNG] {bg.bankName} — Tất cả {bg.count} sổ ({formatVND(bg.totalPrincipal)})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {db.assets.some((a) => a.type === 'saving') && (
                          <optgroup label="🏦 Từng Sổ Tiết Kiệm (Tab 1)">
                            {db.assets
                              .filter((a) => a.type === 'saving')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  — {a.name} ({formatVND(a.amount)})
                                </option>
                              ))}
                          </optgroup>
                        )}
                        {db.assets.some((a) => a.type !== 'saving') && (
                          <optgroup label="Tài Sản Khác (Tab 1)">
                            {db.assets
                              .filter((a) => a.type !== 'saving')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({formatVND(a.amount)})
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                      {linkedBankKey && (
                        <div className="text-[9.5px] sm:text-[10px] text-indigo-700 font-semibold flex items-center gap-1 truncate">
                          <Landmark className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="truncate">Liên kết số tổng ngân hàng {linkedBankKey.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">Tên Cột Mốc</label>
                    <input
                      ref={formMode === 'milestone' ? goalNameInputRef : undefined}
                      type="text"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      placeholder="VD: Mua nhà đất / Quỹ hưu trí..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">
                      Mục Tiêu (VNĐ)
                    </label>
                    <input
                      type="text"
                      value={goalTargetStr}
                      onChange={(e) => setGoalTargetStr(formatNumberString(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-bold text-blue-700 outline-none focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">
                      Thời Hạn (Năm)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={goalYears}
                      onChange={(e) => setGoalYears(Number(e.target.value) || 1)}
                      placeholder="3"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:bg-white"
                    />
                  </div>
                </div>

                {parseFormattedNumber(goalTargetStr) > 0 && goalYears > 0 && (
                  <div className="bg-blue-50 border border-blue-200 p-2.5 sm:p-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-blue-900 font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span>
                      📅 Trích lũy:{' '}
                      <b className="text-blue-700">
                        {formatVND(Math.round(parseFormattedNumber(goalTargetStr) / goalYears))} / năm
                      </b>{' '}
                      (≈{' '}
                      <b className="text-blue-700">
                        {formatVND(Math.round(parseFormattedNumber(goalTargetStr) / (goalYears * 12)))} / th
                      </b>
                      )
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-blue-600">
                      Hạn: {calculateMilestoneDueDate(currentPeriodStr, goalYears).targetPeriodStr}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 mb-0.5 sm:mb-1">Ghi Chú Kế Hoạch</label>
              <input
                type="text"
                value={goalNote}
                onChange={(e) => setGoalNote(e.target.value)}
                placeholder="VD: Điều kiện ưu tiên, ghi nhớ..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:bg-white"
              />
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end gap-2 pt-1.5 sm:pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
              >
                {editingGoalId ? '✓ Cập Nhật' : '+ Lưu Mục Tiêu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GOALS MANAGEMENT TABLE - REQUESTED BY USER */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3 bg-white">
          <div
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer select-none min-w-0 flex-1"
            onClick={() => setShowGoalTable(!showGoalTable)}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
              {showGoalTable ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                  Bảng Quản Trị Mục Tiêu & Kế Hoạch Tích Sản
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-blue-100 text-blue-800 shrink-0 whitespace-nowrap">
                  {filteredGoals.length} / {db.goals.length} mục tiêu
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                Theo dõi hạn chốt, lịch nạp định kỳ và liên kết Tab 1
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowGoalTable(!showGoalTable)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] sm:text-xs px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{showGoalTable ? 'Thu Gọn' : 'Xem Chi Tiết'}</span>
          </button>
        </div>

        {showGoalTable && (
          <div className="border-t border-slate-100 p-2.5 sm:p-5 pt-2 sm:pt-3 space-y-2 sm:space-y-4">
            {/* 1. DEDICATED MOBILE VIEW (< md) - COMPACT CLEAN CARD LIST */}
            <div className="md:hidden space-y-2">
              {filteredGoals.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Chưa có mục tiêu nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                filteredGoals.map((g, index) => {
                  const isDCA = g.goalType === 'dca';
                  const groupMeta = goalGroupLabels[g.group] || goalGroupLabels.dca;

                  const linkedAsset = g.linkedAssetId
                    ? db.assets.find((a) => a.id === g.linkedAssetId)
                    : db.assets.find((a) => a.name.toLowerCase() === g.name.toLowerCase());

                  const bankSavings = resolveGoalBankSavings(g, savingAssets);
                  const isBankGoal = Boolean(g.assetType === 'saving' || bankSavings?.isBankLinked || (!g.assetType && g.unit === 'VNĐ' && g.group === 'dca'));

                  const isBoughtThisPeriod = g.lastBoughtPeriod === currentPeriodStr;
                  const isDeferredThisPeriod = Boolean(
                    g.lastBoughtPeriod &&
                    (g.lastBoughtPeriod.startsWith('Chuyển nợ') || g.lastBoughtPeriod.startsWith('Chưa nạp')) &&
                    g.lastBoughtPeriod.includes(currentPeriodStr)
                  );
                  const isFulfilledThisPeriod = isBoughtThisPeriod || isDeferredThisPeriod;
                  const backlog = g.backlogQty || 0;
                  const dueThisPeriod = (g.targetQty || 0) + backlog;
                  const freqMonths = g.freqMonths || 1;
                  const freqLabel =
                    freqMonths === 1
                      ? 'Hàng tháng'
                      : freqMonths === 3
                      ? 'Hàng quý'
                      : freqMonths === 6
                      ? 'Nửa năm'
                      : `${freqMonths}T/lần`;

                  const { diffDays, nextDueDateStr, isOverdue, overdueDays } = calculateDCADaysRemaining(
                    g.day || 10,
                    freqMonths,
                    isFulfilledThisPeriod
                  );
                  const { targetPeriodStr, monthsLeft } = calculateMilestoneDueDate(
                    g.createdAt || currentPeriodStr,
                    g.years || 1
                  );

                  // Unit price and estimated period amount
                  const isGold = g.assetType === 'gold' || g.unit === 'chỉ' || g.unit === 'lượng';
                  const isStock = g.assetType === 'stock' || g.unit === 'CP';
                  const unitCostPrice = g.unitPrice || (g.costPrice && g.totalBought ? Math.round(g.costPrice / g.totalBought) : (isGold ? 8200000 : isStock ? 30000 : 0));
                  const unitMktPrice = g.currentPrice || (isGold ? 8650000 : isStock ? 32000 : 0);
                  const estPeriodCost = isDCA
                    ? isGold || isStock
                      ? (g.targetQty || 0) * (unitMktPrice || unitCostPrice)
                      : (g.targetAmountPerPeriod || g.targetQty || 0)
                    : 0;

                  return (
                    <div
                      key={g.id}
                      className={`bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200 p-3 space-y-2.5 transition shadow-xs ${
                        g.status === 'completed' ? 'opacity-75 bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Row 1: STT, Group Badge, Name & Tab 1/Tab 2 Link */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-200">
                            {index + 1}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${groupMeta.bg} ${groupMeta.color}`}
                          >
                            {groupMeta.label}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate block leading-tight">{g.name}</span>
                        </div>
                        {g.status === 'completed' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                            ✓ Đã đạt
                          </span>
                        )}
                      </div>

                      {/* Row 2: 2-Column Clean Info Grid (Định mức cam kết có Đơn Giá & Lịch hạn/Trạng thái) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                        {/* Cột Trái: Định mức cam kết, Đơn giá & Ước tính tiền nạp */}
                        <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 space-y-1">
                          <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-tight">Định mức & Đơn giá</span>
                          {isDCA ? (
                            <div className="space-y-1">
                              <div className="text-xs font-black text-slate-900 leading-tight">
                                {formatNumberString(g.targetQty)} {g.unit}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                ({freqLabel} • Ngày {g.day || 10})
                              </div>
                              {/* Hiển thị Đơn Giá Vốn TB & Giá Thị Trường */}
                              {(isGold || isStock) && (
                                <div className="mt-1 flex flex-wrap items-center gap-1 text-[9.5px]">
                                  {unitCostPrice > 0 && (
                                    <span className="inline-block bg-white text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                                      Vốn TB: {formatVND(unitCostPrice, isPrivacyMode)}
                                    </span>
                                  )}
                                  {unitMktPrice > 0 && (
                                    <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold border border-blue-200">
                                      Giá TT: {formatVND(unitMktPrice, isPrivacyMode)}
                                    </span>
                                  )}
                                </div>
                              )}
                              {estPeriodCost > 0 && (
                                <div className="text-[10px] text-emerald-700 font-bold">
                                  ≈ {formatVND(estPeriodCost, isPrivacyMode)} / kỳ
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="text-xs font-black text-blue-700">
                                {formatVND(g.target, isPrivacyMode)}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {g.years} Năm (~{formatVND(Math.round((g.target || 0) / ((g.years || 1) * 12)), isPrivacyMode)}/tháng)
                              </div>
                            </div>
                          )}
                          {bankSavings && bankSavings.isBankLinked ? (
                            <div className="mt-1.5 pt-1 border-t border-slate-200/60">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                                  <Landmark className="w-2.5 h-2.5 mr-1 text-indigo-600 shrink-0" />
                                  <span>
                                    Tab 1: Tổng {bankSavings.bankName} ({bankSavings.count} sổ):{' '}
                                    <strong className="text-indigo-950 font-black">{formatVND(bankSavings.totalPrincipal, isPrivacyMode)}</strong>
                                  </span>
                                </span>
                                {!g.linkedBankKey && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUpdateGoal({
                                        ...g,
                                        linkedBankKey: bankSavings.bankKey,
                                        linkedAssetId: undefined,
                                      });
                                      showToast(`✓ Đã ghim liên kết mục tiêu vào SỐ TỔNG ngân hàng ${bankSavings.bankName}!`, 'success');
                                    }}
                                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                    title="Ghim liên kết vào số tổng ngân hàng này"
                                  >
                                    Ghim số tổng
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : linkedAsset ? (
                            <div className="mt-1 flex items-center gap-1 text-[9.5px] text-blue-700 font-semibold truncate pt-0.5 border-t border-slate-200/60">
                              <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">Tab 1: {linkedAsset.name} ({formatVND(linkedAsset.amount, isPrivacyMode)})</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Cột Phải: Lịch hạn & Trạng thái rõ ràng */}
                        <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 flex flex-col justify-between space-y-1.5">
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-tight">Lịch hạn & Trạng thái</span>
                            {isDCA ? (
                              <div className="mt-1 space-y-1">
                                {isDeferredThisPeriod ? (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9.5px] font-bold bg-amber-50 text-amber-950 border border-amber-300 flex-wrap">
                                    <Clock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                    <span>⚠️ Đang nợ: {formatNumberString(backlog > 0 ? backlog : g.targetQty || 0)} {g.unit}</span>
                                    <span className="text-amber-800 font-semibold">(Dời kỳ sau)</span>
                                  </div>
                                ) : isBoughtThisPeriod ? (
                                  <div className="space-y-0.5">
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                                      <span>{isBankGoal ? 'Đã gửi' : 'Đã nạp'} kỳ {currentPeriodStr}</span>
                                    </div>
                                    {backlog > 0 && (
                                      <div className="text-[9px] font-bold text-rose-600">
                                        ⚠️ Còn nợ dồn: {formatNumberString(backlog)} {g.unit}
                                      </div>
                                    )}
                                  </div>
                                ) : isOverdue ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    <span>Quá hạn • Nợ {formatNumberString(dueThisPeriod)} {g.unit}</span>
                                  </span>
                                ) : backlog > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[9.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                    ⚠️ Nợ dồn: {formatNumberString(backlog)} {g.unit} (Cần nạp: {formatNumberString(dueThisPeriod)} {g.unit})
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    ⏳ Chờ nạp kỳ {currentPeriodStr}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-1">
                                <span className="inline-block px-2 py-0.5 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Hạn: {targetPeriodStr}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {isDCA ? (
                              isFulfilledThisPeriod ? (
                                <span>Hạn kỳ tới: {nextDueDateStr} (còn {diffDays} ngày)</span>
                              ) : isOverdue ? (
                                <span className="text-rose-600 font-bold flex items-center gap-1 flex-wrap">
                                  <span>Hạn chót: {nextDueDateStr}</span>
                                  <span className="bg-rose-600 text-white px-1.5 py-0.2 rounded text-[8.5px] font-black">
                                    Quá {overdueDays} ngày!
                                  </span>
                                </span>
                              ) : diffDays >= 0 && diffDays <= 3 ? (
                                <span className="text-rose-600 font-bold">⚠️ Hạn chót {nextDueDateStr} ({diffDays === 0 ? 'Hôm nay!' : `còn ${diffDays} ngày`})</span>
                              ) : (
                                <span>Hạn chót: {nextDueDateStr} (còn {diffDays} ngày)</span>
                              )
                            ) : (
                              <span>Còn ~{monthsLeft} tháng</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Action Buttons - Tinh gọn, khoa học, phân loại theo mục tiêu */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {g.status !== 'completed' && isDCA && (
                            <>
                              {isBankGoal ? (
                                // Mục tiêu Sổ Tiết Kiệm: Nếu đã link sổ -> Nạp thêm gốc; Nếu link tổng ngân hàng -> Tự động mở sổ mới
                                g.linkedAssetId ? (
                                  // Chế độ: Nạp thêm gốc vào sổ có sẵn
                                  isBoughtThisPeriod ? (
                                    <button
                                      onClick={() => handleOpenDepositModal(g)}
                                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                      title="Nạp thêm tiền gốc vào sổ tiết kiệm đã liên kết ở Tab 1"
                                    >
                                      <PlusCircle className="w-3 h-3 text-blue-600" />
                                      <span>+ Nạp thêm</span>
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleTogglePaidThisPeriod(g)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                        title="Nạp thêm gốc vào sổ cố định này ở Tab 1"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Đã nạp gốc</span>
                                      </button>
                                      <button
                                        onClick={() => handleOpenBacklogModal(g)}
                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                        title="Chưa gửi kịp, chuyển nợ định mức sang kỳ sau gửi bù"
                                      >
                                        <Clock className="w-3 h-3 text-amber-700" />
                                        <span>Nợ kỳ sau</span>
                                      </button>
                                    </>
                                  )
                                ) : (
                                  // Chế độ: Liên kết số tổng ngân hàng -> Tự động mở sổ mới
                                  isBoughtThisPeriod ? (
                                    <button
                                      onClick={() => handleOpenDepositModal(g)}
                                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                      title="Gửi thêm tiền vào ngân hàng này"
                                    >
                                      <PlusCircle className="w-3 h-3 text-emerald-600" />
                                      <span>+ Gửi thêm</span>
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleTogglePaidThisPeriod(g)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                        title="Tự động lập sổ mới và cộng dồn vào số tổng ngân hàng ở Tab 1"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Đã gửi</span>
                                      </button>
                                      <button
                                        onClick={() => handleOpenBacklogModal(g)}
                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                        title="Chưa gửi kịp, chuyển nợ định mức sang kỳ sau gửi bù"
                                      >
                                        <Clock className="w-3 h-3 text-amber-700" />
                                        <span>Nợ kỳ sau</span>
                                      </button>
                                    </>
                                  )
                                )
                              ) : (
                                // Mục tiêu Cổ phiếu / Vàng / Khác: Ghi nhận mua tích sản
                                isBoughtThisPeriod ? (
                                  <button
                                    onClick={() => handleOpenDepositModal(g)}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                    title="Nạp/mua thêm số lượng tích lũy cho kỳ này"
                                  >
                                    <PlusCircle className="w-3 h-3 text-emerald-600" />
                                    <span>+ Mua thêm</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleOpenDepositModal(g)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                      title="Xác nhận đã mua kỳ này (Tự động cộng Tab 1)"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Ghi nhận mua</span>
                                    </button>
                                    <button
                                      onClick={() => handleOpenBacklogModal(g)}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                      title="Chưa mua kịp, chuyển nợ định mức sang kỳ sau mua bù"
                                    >
                                      <Clock className="w-3 h-3 text-amber-700" />
                                      <span>Nợ kỳ sau</span>
                                    </button>
                                  </>
                                )
                              )}
                            </>
                          )}
                          {g.status !== 'completed' && g.linkedDebtId && (
                            <button
                              onClick={() => handleOpenPayDebtModal(g)}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                              title="Ghi nhận trả nợ và giảm dư nợ ở Tab 2"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Trả nợ Tab 2</span>
                            </button>
                          )}
                          {g.status !== 'completed' && !isDCA && (
                            <button
                              onClick={() => handleCompleteGoal(g)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Hoàn thành</span>
                            </button>
                          )}
                        </div>

                        {/* Standard Horizontal Action Group [📜 Lịch sử] [✏️ Sửa] [🗑️ Xóa] */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenHistory(g)}
                            className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1 text-[10px] font-bold border border-blue-200"
                            title="Lịch sử Mua/Gom"
                          >
                            <History className="w-3.5 h-3.5 text-blue-600" />
                            <span className="hidden xs:inline">Lịch sử</span>
                          </button>
                          <button
                            onClick={() => handleEditGoal(g)}
                            className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1 text-[10px] font-bold border border-amber-200"
                            title="Sửa mục tiêu"
                          >
                            <Pen className="w-3.5 h-3.5 text-amber-600" />
                            <span className="hidden xs:inline">Sửa</span>
                          </button>
                          <button
                            onClick={() => setGoalToDelete({ id: g.id, name: g.name })}
                            className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition active:scale-95 cursor-pointer border border-rose-200"
                            title="Xóa mục tiêu"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. DEDICATED DESKTOP VIEW (>= md) - FULL TABLE WITHOUT PROGRESS COLUMN */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3 text-center w-12 shrink-0">STT</th>
                    <th className="p-3 min-w-[120px]">Nhóm</th>
                    <th className="p-3 min-w-[180px]">Mục Tiêu & Liên Kết</th>
                    <th className="p-3 min-w-[190px]">Định Mức & Đơn Giá</th>
                    <th className="p-3 text-center min-w-[240px]">Lịch Hạn & Trạng Thái</th>
                    <th className="p-3 text-center min-w-[220px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {filteredGoals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Chưa có mục tiêu nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredGoals.map((g, index) => {
                      const isDCA = g.goalType === 'dca';
                      const groupMeta = goalGroupLabels[g.group] || goalGroupLabels.dca;

                      // Linked asset info from Tab 1
                      const linkedAsset = g.linkedAssetId
                        ? db.assets.find((a) => a.id === g.linkedAssetId)
                        : db.assets.find((a) => a.name.toLowerCase() === g.name.toLowerCase());

                      const bankSavings = resolveGoalBankSavings(g, savingAssets);
                      const isBankGoal = Boolean(g.assetType === 'saving' || bankSavings?.isBankLinked || (!g.assetType && g.unit === 'VNĐ' && g.group === 'dca'));

                      // DCA calculation
                      const isBoughtThisPeriod = g.lastBoughtPeriod === currentPeriodStr;
                      const isDeferredThisPeriod = Boolean(
                        g.lastBoughtPeriod &&
                        (g.lastBoughtPeriod.startsWith('Chuyển nợ') || g.lastBoughtPeriod.startsWith('Chưa nạp')) &&
                        g.lastBoughtPeriod.includes(currentPeriodStr)
                      );
                      const isFulfilledThisPeriod = isBoughtThisPeriod || isDeferredThisPeriod;
                      const backlog = g.backlogQty || 0;
                      const dueThisPeriod = (g.targetQty || 0) + backlog;
                      const freqMonths = g.freqMonths || 1;
                      const freqLabel =
                        freqMonths === 1
                          ? 'Hàng tháng'
                          : freqMonths === 3
                          ? 'Hàng quý'
                          : freqMonths === 6
                          ? 'Nửa năm'
                          : `${freqMonths}T/lần`;

                      const { diffDays, nextDueDateStr, isOverdue, overdueDays } = calculateDCADaysRemaining(
                        g.day || 10,
                        freqMonths,
                        isFulfilledThisPeriod
                      );

                      // Milestone calculation
                      const { targetPeriodStr, monthsLeft } = calculateMilestoneDueDate(
                        g.createdAt || currentPeriodStr,
                        g.years || 1
                      );

                      // Unit price and estimated period amount
                      const isGold = g.assetType === 'gold' || g.unit === 'chỉ' || g.unit === 'lượng';
                      const isStock = g.assetType === 'stock' || g.unit === 'CP';
                      const unitCostPrice = g.unitPrice || (g.costPrice && g.totalBought ? Math.round(g.costPrice / g.totalBought) : (isGold ? 8200000 : isStock ? 30000 : 0));
                      const unitMktPrice = g.currentPrice || (isGold ? 8650000 : isStock ? 32000 : 0);
                      const estPeriodCost = isDCA
                        ? isGold || isStock
                          ? (g.targetQty || 0) * (unitMktPrice || unitCostPrice)
                          : (g.targetAmountPerPeriod || g.targetQty || 0)
                        : 0;

                      return (
                        <tr key={g.id} className="hover:bg-slate-50/90 transition">
                          {/* STT */}
                          <td className="p-3 text-center font-bold text-slate-400">{index + 1}</td>

                          {/* Nhóm */}
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${groupMeta.tagClass}`}
                            >
                              <i className={`fa-solid ${groupMeta.icon} mr-1.5`}></i>
                              <span>{g.group === 'debt' ? '1. Trả Nợ' : g.group === 'dca' ? '2. Tích Sản' : g.group === 'runway' ? '3. Dự Phòng' : '4. Cột Mốc'}</span>
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                              {isDCA ? 'Tích sản DCA' : 'Cột mốc lớn'}
                            </div>
                          </td>

                          {/* Tên Mục Tiêu & Liên Kết */}
                          <td className="p-3">
                            <div className="font-bold text-slate-900 text-xs">{g.name}</div>
                            {bankSavings && bankSavings.isBankLinked ? (
                              <div className="mt-1.5 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-2xs">
                                    <Landmark className="w-2.5 h-2.5 mr-1 text-indigo-600 shrink-0" />
                                    <span>
                                      Tab 1: Tổng gửi {bankSavings.bankName} ({bankSavings.count} sổ):{' '}
                                      <strong className="text-indigo-950 font-black">{formatVND(bankSavings.totalPrincipal, isPrivacyMode)}</strong>
                                    </span>
                                  </span>
                                  {!g.linkedBankKey && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onUpdateGoal({
                                          ...g,
                                          linkedBankKey: bankSavings.bankKey,
                                          linkedAssetId: undefined,
                                        });
                                        showToast(`✓ Đã ghim liên kết mục tiêu vào SỐ TỔNG ngân hàng ${bankSavings.bankName}!`, 'success');
                                      }}
                                      className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                      title="Cố định liên kết vào số tổng ngân hàng này để luôn tự động nhận diện sổ mới"
                                    >
                                      Ghim link số tổng
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : linkedAsset ? (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <LinkIcon className="w-2.5 h-2.5 mr-1" />
                                  {linkedAsset.type === 'saving' ? (
                                    <span>Tab 1: Sổ {formatVND(linkedAsset.amount, isPrivacyMode)}</span>
                                  ) : linkedAsset.type === 'stock' ? (
                                    <span>Tab 1: {formatNumberString(linkedAsset.quantity || 0)} CP</span>
                                  ) : linkedAsset.type === 'gold' ? (
                                    <span>Tab 1: {formatNumberString(linkedAsset.quantity || 0)} chỉ</span>
                                  ) : (
                                    <span>Tab 1: {formatVND(linkedAsset.amount, isPrivacyMode)}</span>
                                  )}
                                </span>
                              </div>
                            ) : (
                              g.linkedDebtId && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    Link Nợ Tab 2
                                  </span>
                                </div>
                              )
                            )}
                            {g.note && <div className="text-[10px] text-slate-400 italic mt-0.5">"{g.note}"</div>}
                          </td>

                          {/* Định Mức & Đơn Giá */}
                          <td className="p-3">
                            {isDCA ? (
                              <div className="space-y-1">
                                <div className="font-black text-slate-900 text-xs whitespace-nowrap">
                                  {formatNumberString(g.targetQty)} {g.unit}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                  ({freqLabel} • Ngày {g.day || 10})
                                </div>
                                {(isGold || isStock) && (
                                  <div className="flex flex-wrap items-center gap-1 text-[9.5px]">
                                    {unitCostPrice > 0 && (
                                      <span className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200 whitespace-nowrap">
                                        Vốn TB: {formatVND(unitCostPrice, isPrivacyMode)}
                                      </span>
                                    )}
                                    {unitMktPrice > 0 && (
                                      <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold border border-blue-200 whitespace-nowrap">
                                        Giá TT: {formatVND(unitMktPrice, isPrivacyMode)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {estPeriodCost > 0 && (
                                  <div className="text-[10px] text-emerald-700 font-bold whitespace-nowrap">
                                    ≈ {formatVND(estPeriodCost, isPrivacyMode)} / kỳ
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="font-bold text-blue-700 text-xs whitespace-nowrap">
                                  {formatVND(g.target, isPrivacyMode)}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                  {g.years} Năm (~{formatVND(Math.round((g.target || 0) / ((g.years || 1) * 12)), isPrivacyMode)}/tháng)
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Lịch Hạn & Trạng Thái */}
                          <td className="p-3 text-center">
                            {isDCA ? (
                              <div className="space-y-1.5 flex flex-col items-center">
                                <div>
                                  {isDeferredThisPeriod ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-amber-50 text-amber-950 border border-amber-300 shadow-2xs whitespace-nowrap">
                                      <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                                      <span>⚠️ Đang nợ: {formatNumberString(backlog > 0 ? backlog : g.targetQty || 0)} {g.unit}</span>
                                      <span className="text-amber-800 font-semibold">(Dời kỳ sau)</span>
                                    </div>
                                  ) : isBoughtThisPeriod ? (
                                    <div className="space-y-0.5 flex flex-col items-center">
                                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                                        <span>{isBankGoal ? 'Đã gửi' : 'Đã nạp'} kỳ {currentPeriodStr}</span>
                                      </div>
                                      {backlog > 0 && (
                                        <div className="text-[9.5px] font-bold text-rose-600 whitespace-nowrap">
                                          ⚠️ Còn nợ dồn: {formatNumberString(backlog)} {g.unit}
                                        </div>
                                      )}
                                    </div>
                                  ) : isOverdue ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
                                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                      <span>Quá hạn • Nợ {formatNumberString(dueThisPeriod)} {g.unit}</span>
                                    </span>
                                  ) : backlog > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-rose-50 text-rose-800 border border-rose-300 animate-pulse whitespace-nowrap">
                                      <span>⚠️ Nợ dồn: {formatNumberString(backlog)} {g.unit}</span>
                                      <span className="text-[9.5px] text-rose-700 font-semibold">(Cần: {formatNumberString(dueThisPeriod)})</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
                                      <span>⏳ Chờ nạp kỳ {currentPeriodStr}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                  {isFulfilledThisPeriod ? (
                                    <span>Hạn kỳ tới: {nextDueDateStr} (còn {diffDays} ngày)</span>
                                  ) : isOverdue ? (
                                    <div className="text-rose-600 font-bold flex items-center justify-center gap-1 whitespace-nowrap">
                                      <span>Hạn: {nextDueDateStr}</span>
                                      <span className="bg-rose-600 text-white px-1.5 py-0.2 rounded text-[9px] font-black">
                                        Quá {overdueDays} ngày!
                                      </span>
                                    </div>
                                  ) : diffDays >= 0 && diffDays <= 3 ? (
                                    <span className="text-rose-600 font-bold whitespace-nowrap">⚠️ Hạn {nextDueDateStr} ({diffDays === 0 ? 'Hôm nay!' : `còn ${diffDays} ngày`})</span>
                                  ) : (
                                    <span>Hạn: {nextDueDateStr} (còn {diffDays} ngày)</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1 flex flex-col items-center">
                                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                  Hạn: {targetPeriodStr}
                                </span>
                                <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                  Còn ~{monthsLeft} tháng
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Thao Tác (Hàng ngang với khoảng cách và màu sắc hài hòa) */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {g.status === 'completed' ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  <span>Đã đạt</span>
                                </span>
                              ) : (
                                <>
                                  {isDCA && (
                                    <>
                                      {isBankGoal ? (
                                        // Mục tiêu Sổ Tiết Kiệm: Nếu đã link sổ -> Nạp thêm gốc; Nếu link tổng ngân hàng -> Tự động mở sổ mới
                                        g.linkedAssetId ? (
                                          // Chế độ: Nạp thêm gốc vào sổ có sẵn
                                          isBoughtThisPeriod ? (
                                            <button
                                              onClick={() => handleOpenDepositModal(g)}
                                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                              title="Nạp thêm tiền gốc vào sổ tiết kiệm đã liên kết ở Tab 1"
                                            >
                                              <PlusCircle className="w-3 h-3 text-blue-600" />
                                              <span>+ Nạp thêm</span>
                                            </button>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => handleTogglePaidThisPeriod(g)}
                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                                title="Nạp thêm gốc vào sổ cố định này ở Tab 1"
                                              >
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Đã nạp gốc</span>
                                              </button>
                                              <button
                                                onClick={() => handleOpenBacklogModal(g)}
                                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                                title="Chưa gửi kịp, chuyển nợ định mức sang kỳ sau gửi bù"
                                              >
                                                <Clock className="w-3 h-3 text-amber-700" />
                                                <span>Nợ kỳ sau</span>
                                              </button>
                                            </>
                                          )
                                        ) : (
                                          // Chế độ: Liên kết số tổng ngân hàng -> Tự động mở sổ mới
                                          isBoughtThisPeriod ? (
                                            <button
                                              onClick={() => handleOpenDepositModal(g)}
                                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                              title="Gửi thêm tiền vào ngân hàng này"
                                            >
                                              <PlusCircle className="w-3 h-3 text-emerald-600" />
                                              <span>+ Gửi thêm</span>
                                            </button>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => handleTogglePaidThisPeriod(g)}
                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                                title="Tự động lập sổ mới và cộng dồn vào số tổng ngân hàng ở Tab 1"
                                              >
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Đã gửi</span>
                                              </button>
                                              <button
                                                onClick={() => handleOpenBacklogModal(g)}
                                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                                title="Chưa gửi kịp, chuyển nợ định mức sang kỳ sau gửi bù"
                                              >
                                                <Clock className="w-3 h-3 text-amber-700" />
                                                <span>Nợ kỳ sau</span>
                                              </button>
                                            </>
                                          )
                                        )
                                      ) : (
                                        // Mục tiêu Cổ phiếu / Vàng / Khác: Ghi nhận mua tích sản
                                        isBoughtThisPeriod ? (
                                          <button
                                            onClick={() => handleOpenDepositModal(g)}
                                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                            title="Mua/nạp thêm số lượng tích lũy cho kỳ này"
                                          >
                                            <PlusCircle className="w-3 h-3 text-emerald-600" />
                                            <span>+ Mua thêm</span>
                                          </button>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => handleOpenDepositModal(g)}
                                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                              title="Xác nhận đã mua kỳ này (Tự động cộng Tab 1)"
                                            >
                                              <CheckCircle2 className="w-3 h-3" />
                                              <span>Ghi nhận mua</span>
                                            </button>
                                            <button
                                              onClick={() => handleOpenBacklogModal(g)}
                                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 active:scale-95 rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                              title="Chưa mua kịp, chuyển nợ định mức sang kỳ sau mua bù"
                                            >
                                              <Clock className="w-3 h-3 text-amber-700" />
                                              <span>Nợ kỳ sau</span>
                                            </button>
                                          </>
                                        )
                                      )}
                                    </>
                                  )}
                                    {g.status !== 'completed' && g.linkedDebtId && (
                                      <button
                                        onClick={() => handleOpenPayDebtModal(g)}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                        title="Ghi nhận trả nợ và giảm dư nợ ở Tab 2"
                                      >
                                        <CreditCard className="w-3 h-3" />
                                        <span>Trả nợ Tab 2</span>
                                      </button>
                                    )}
                                    {!isDCA && (
                                      <button
                                        onClick={() => handleCompleteGoal(g)}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                        title="Đánh dấu hoàn thành mục tiêu"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Hoàn thành</span>
                                      </button>
                                    )}
                                </>
                              )}
                              <button
                                onClick={() => handleOpenHistory(g)}
                                className="px-2 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer text-[10px] font-bold inline-flex items-center gap-1 border border-blue-200"
                                title="Lịch sử Mua/Gom & Thống kê"
                              >
                                <History className="w-3.5 h-3.5 text-blue-600" />
                                <span>Lịch sử</span>
                              </button>
                              <button
                                onClick={() => handleEditGoal(g)}
                                className="px-2 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition cursor-pointer text-[10px] font-bold inline-flex items-center gap-1 border border-amber-200"
                                title="Sửa mục tiêu"
                              >
                                <Pen className="w-3.5 h-3.5 text-amber-600" />
                                <span>Sửa</span>
                              </button>
                              <button
                                onClick={() => setGoalToDelete({ id: g.id, name: g.name })}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer border border-rose-200"
                                title="Xóa mục tiêu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
        </div>
      )}
      </div>

      {/* REAL ESTATE LOAN STRESS TEST SECTION */}
      <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 bg-white">
          <div
            className="flex items-start sm:items-center space-x-3 cursor-pointer select-none min-w-0 flex-1"
            onClick={() => setShowStressTest(!showStressTest)}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
              {showStressTest ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Thẩm Định Mua BĐS & Thử Tải Nợ
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 shrink-0 whitespace-nowrap">
                  Mô phỏng
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Khớp vốn tự có & thử tải dòng tiền trả góp qua các giai đoạn
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2">
            <button
              onClick={autoFillStressTest}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title="Tự động trích xuất vốn tự thân và dòng tiền khả dụng từ Tháp tài sản & Dòng tiền"
            >
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-emerald-600" />
              <span className="whitespace-nowrap">Tự động điền</span>
            </button>
            <button
              onClick={() => setShowStressTest(!showStressTest)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] sm:text-xs px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="whitespace-nowrap">{showStressTest ? 'Thu Gọn' : 'Xem Chi Tiết'}</span>
            </button>
          </div>
        </div>

        {showStressTest && (
          <div className="border-t border-slate-100 p-3 sm:p-6 space-y-4 sm:space-y-5">
            <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 text-xs">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                <span>Thông số giả định thẩm định</span>
                <span className="text-[9.5px] text-slate-400 font-normal lowercase">12 tiêu chí</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    1. Giá BĐS mua (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={simTargetValStr}
                    onChange={(e) => setSimTargetValStr(formatNumberString(e.target.value))}
                    placeholder="VD: 3.000.000.000"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-bold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    2. Mua sau (tháng)
                  </label>
                  <input
                    type="number"
                    value={simMonthsLeft}
                    onChange={(e) => setSimMonthsLeft(Number(e.target.value) || 1)}
                    placeholder="24"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    3. Tiền gửi bán (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={simCashValStr}
                    onChange={(e) => setSimCashValStr(formatNumberString(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-semibold text-emerald-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    4. Vàng bán (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={simGoldValStr}
                    onChange={(e) => setSimGoldValStr(formatNumberString(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-semibold text-amber-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    5. Cổ phiếu bán (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={simStockValStr}
                    onChange={(e) => setSimStockValStr(formatNumberString(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-semibold text-blue-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    6. Quỹ khẩn cấp giữ (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={simEmergencyFundStr}
                    onChange={(e) => setSimEmergencyFundStr(formatNumberString(e.target.value))}
                    placeholder="150.000.000"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-semibold text-rose-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    7. Hạn gói vay (Năm)
                  </label>
                  <input
                    type="number"
                    value={simLoanYears}
                    onChange={(e) => setSimLoanYears(Number(e.target.value) || 1)}
                    placeholder="20"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-purple-800 mb-1 text-[11px] truncate">
                    8. Ân hạn gốc (Năm)
                  </label>
                  <input
                    type="number"
                    value={simGraceYears}
                    onChange={(e) => setSimGraceYears(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white border border-purple-300 rounded-lg p-1.5 sm:p-2 text-xs font-bold text-purple-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    9. Lãi ưu đãi (Tháng)
                  </label>
                  <input
                    type="number"
                    value={simPromoMonths}
                    onChange={(e) => setSimPromoMonths(Number(e.target.value) || 0)}
                    placeholder="24"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-800 mb-1 text-[11px] truncate">
                    10. Lãi ưu đãi (%/n)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={simPromoRate}
                    onChange={(e) => setSimPromoRate(Number(e.target.value) || 0)}
                    placeholder="6.5"
                    className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 sm:p-2 text-xs font-bold text-emerald-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-rose-800 mb-1 text-[11px] truncate">
                    11. Sau ưu đãi (%/n)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={simNormalRate}
                    onChange={(e) => setSimNormalRate(Number(e.target.value) || 0)}
                    placeholder="10.5"
                    className="w-full bg-white border border-rose-300 rounded-lg p-1.5 sm:p-2 text-xs font-bold text-rose-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] truncate">
                    12. Sốc lãi suất (%/n)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={simStressRate}
                    onChange={(e) => setSimStressRate(Number(e.target.value) || 0)}
                    placeholder="12.5"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 sm:p-2 text-xs font-semibold text-rose-700 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  A. Nguồn Vốn Tự Có Tích Lũy
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-600">Vốn sẵn có ròng:</span>
                  <span className="font-bold text-slate-900">{formatVND(liquidAssetsReady, isPrivacyMode)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Thặng dư tích thêm:</span>
                  <span className="font-bold text-emerald-600">
                    +{formatVND(surplusAccumulated, isPrivacyMode)} ({simMonthsLeft}T)
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-bold text-slate-800">Tổng vốn tự thân:</span>
                  <span className="font-black text-emerald-700">
                    {formatVND(totalOwnCapital, isPrivacyMode)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  B. Chi Trả Từng Giai Đoạn
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-600">Vốn cần vay ngân hàng:</span>
                  <span className="font-bold text-rose-600">{formatVND(loanNeeded, isPrivacyMode)}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Giai đoạn ưu đãi:</span>
                  <span>
                    {formatVND(totalPromoMonthlyDebt, isPrivacyMode)}/tháng (Lãi: {simPromoRate}%)
                  </span>
                </div>
                <div className="flex justify-between text-rose-800 font-semibold">
                  <span>Sau ưu đãi (thả nổi):</span>
                  <span>
                    {formatVND(totalNormalMonthlyDebt, isPrivacyMode)}/tháng (Lãi: {simNormalRate}%)
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-bold text-slate-800">Đệm dòng tiền dư:</span>
                  <span
                    className={`font-black ${
                      netBuffer >= 0 ? 'text-blue-700' : 'text-rose-600'
                    }`}
                  >
                    {netBuffer >= 0 ? `+${formatVND(netBuffer, isPrivacyMode)}` : formatVND(netBuffer, isPrivacyMode)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  C. Thước Đo An Toàn (Stress-Test)
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Tỷ lệ vay (LTV):</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      ltv <= 50
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : ltv <= 70
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {ltv}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Gánh nặng nợ (DSTI sau ƯĐ):</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      dsti <= 35
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : dsti <= 45
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {dsti}%
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-600">Sốc lãi suất kiểm thử:</span>
                  <span className="font-bold text-rose-600">
                    {formatVND(totalStressMonthlyDebt, isPrivacyMode)}/tháng (Lãi {simStressRate}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Advisory feedback */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs space-y-2">
              <div className="font-bold text-blue-900 flex items-center">
                <Sparkles className="w-4 h-4 text-amber-500 mr-2" />
                <span>Khuyến Nghị Tài Chính Cụ Thể Cho Phương Án Này</span>
              </div>
              <div className="text-blue-800 leading-relaxed">
                {loanNeeded === 0 ? (
                  <span>
                    🎉 <b>Phương án an toàn tuyệt đối!</b> Tổng vốn tự có tích lũy ({formatVND(totalOwnCapital)}) đã bao phủ
                    100% giá trị tài sản mục tiêu. Bạn không cần vay vốn ngân hàng.
                  </span>
                ) : ltv <= 50 && dsti <= 35 ? (
                  <span>
                    ✅ <b>Phương án rất an toàn & khả thi!</b> Tỷ lệ vay LTV đạt <b>{ltv}%</b> (≤ 50%) và gánh nặng nợ DSTI sau
                    ưu đãi là <b>{dsti}%</b> (≤ 35%). Dù bước vào giai đoạn sau ưu đãi ({simNormalRate}%), đệm dòng tiền thặng
                    dư vẫn còn <b>{formatVND(netBuffer)}/tháng</b>.
                  </span>
                ) : ltv > 70 || dsti > 45 ? (
                  <span>
                    ⚠️ <b>Cảnh báo quá tải nghĩa vụ trả nợ!</b> Gánh nặng DSTI sau ưu đãi là <b>{dsti}%</b> (vượt trần an toàn
                    45%). Khi kiểm thử kịch bản sốc lãi suất ({simStressRate}%), chi trả lên đến{' '}
                    {formatVND(totalStressMonthlyDebt)}/tháng.
                    <br />
                    <b>Khuyến nghị:</b> 1. Kéo dài kỳ hạn vay lên 25–30 năm hoặc tăng số năm ân hạn nợ gốc. 2. Lùi thời điểm giải
                    ngân để tích lũy thêm thặng dư. 3. Bán thêm tài sản Tầng 2 để giảm quy mô nợ vay.
                  </span>
                ) : (
                  <span>
                    ⚖️ <b>Phương án vừa sức nhưng cần theo dõi chặt!</b> Tỷ lệ vay LTV là {ltv}%, DSTI ở mức {dsti}%. Cần bảo
                    toàn nguyên vẹn quỹ dự phòng {formatVND(emergencyFund)} và chuẩn bị sẵn nguồn bù dòng tiền khi hết thời gian
                    ưu đãi.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BIỂU ĐỒ XU HƯỚNG MỤC TIÊU */}
      <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-2 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 sm:pb-3 gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center truncate">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mr-1.5 sm:mr-2 shrink-0" />
            <span className="truncate">Biểu Đồ Xu Hướng Hoàn Thành Mục Tiêu Thực Tế</span>
          </h3>
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-2xs self-start sm:self-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={goalChartRange}
              onChange={(e) => setGoalChartRange(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
            >
              <option value="quarter">Kỳ hạn: Quý Này</option>
              <option value="year">Kỳ hạn: 1 Năm</option>
              <option value="3years">Kỳ hạn: 3 Năm</option>
              <option value="5years">Kỳ hạn: 5 Năm</option>
            </select>
          </div>
        </div>
        {/* RESPONSIVE CLEAN HTML LEGEND */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 pt-1">
          <div className="flex items-center space-x-1.5 px-2 py-1.5 bg-rose-50/80 border border-rose-200/90 rounded-lg text-[10px] sm:text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
            <span className="font-semibold text-rose-900 truncate">1. Trả Nợ:</span>
            <span className="font-black text-rose-700 ml-auto">{debtProgressPercent}%</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2 py-1.5 bg-emerald-50/80 border border-emerald-200/90 rounded-lg text-[10px] sm:text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="font-semibold text-emerald-900 truncate">2. Tích Sản:</span>
            <span className="font-black text-emerald-700 ml-auto">{currentDcaPct}%</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2 py-1.5 bg-blue-50/80 border border-blue-200/90 rounded-lg text-[10px] sm:text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
            <span className="font-semibold text-blue-900 truncate">3. Dự Phòng:</span>
            <span className="font-black text-blue-700 ml-auto">{runwayMonths}T ({runwayPercent}%)</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2 py-1.5 bg-amber-50/80 border border-amber-200/90 rounded-lg text-[10px] sm:text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
            <span className="font-semibold text-amber-900 truncate">4. Cột Mốc:</span>
            <span className="font-black text-amber-700 ml-auto">{milestoneProgressPercent}%</span>
          </div>
        </div>

        <div className="h-56 sm:h-72 pt-1">
          <canvas ref={chartProgressRef}></canvas>
        </div>
      </div>

      {/* Asset / Goal Transaction History Modal */}
      {showHistoryModal && (selectedHistoryGoal || selectedHistoryAsset) && (
        <AssetHistoryModal
          isOpen={showHistoryModal}
          goal={selectedHistoryGoal}
          asset={selectedHistoryAsset}
          db={db}
          isPrivacyMode={isPrivacyMode}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedHistoryGoal(null);
            setSelectedHistoryAsset(null);
          }}
          onSaveTransactions={(updatedTxs, updatedAsset, updatedGoal) => {
            if (onSaveTransactions) {
              onSaveTransactions(updatedTxs, updatedAsset, updatedGoal);
            } else {
              if (updatedGoal) onUpdateGoal(updatedGoal);
              if (updatedAsset) onUpdateAssetDirectly(updatedAsset);
            }
          }}
        />
      )}

      {/* MODAL NẠP KỲ NÀY (DCA DEPOSIT MODAL) */}
      {dcaDepositGoal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Xác Nhận Nạp Kỳ {currentPeriodStr}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mục tiêu: <span className="font-bold text-slate-800">{dcaDepositGoal.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDcaDepositGoal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông tin định mức kỳ này */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Định mức kỳ này:</span>
                <span className="font-bold text-slate-800">
                  {formatNumberString(dcaDepositGoal.targetQty || 0)} {dcaDepositGoal.unit}
                </span>
              </div>
              {(dcaDepositGoal.backlogQty || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Nợ kỳ trước dồn sang:</span>
                  <span className="font-bold">
                    +{formatNumberString(dcaDepositGoal.backlogQty || 0)} {dcaDepositGoal.unit}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-200 text-emerald-800 font-bold">
                <span>Tổng cần gom kỳ này:</span>
                <span>
                  {formatNumberString((dcaDepositGoal.targetQty || 0) + (dcaDepositGoal.backlogQty || 0))} {dcaDepositGoal.unit}
                </span>
              </div>
            </div>

            {/* Form nhập liệu */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số lượng / Số tiền nạp thực tế ({dcaDepositGoal.unit}):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={depositAmountStr}
                    onChange={(e) => {
                      const isVnd = dcaDepositGoal.unit === 'VNĐ' || dcaDepositGoal.assetType === 'saving' || dcaDepositGoal.assetType === 'cash';
                      setDepositAmountStr(formatNumberString(e.target.value, !isVnd));
                    }}
                    placeholder="Nhập số lượng..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    {dcaDepositGoal.unit}
                  </span>
                </div>
                {/* Shortcut buttons */}
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setDepositAmountStr(
                        formatNumberString(
                          (dcaDepositGoal.targetQty || 0) + (dcaDepositGoal.backlogQty || 0) || 1
                        )
                      )
                    }
                    className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200 cursor-pointer"
                  >
                    Đúng định mức
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDepositAmountStr(
                        formatNumberString(
                          ((dcaDepositGoal.targetQty || 0) + (dcaDepositGoal.backlogQty || 0)) * 2 || 2
                        )
                      )
                    }
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-300 cursor-pointer"
                  >
                    Gấp đôi (x2)
                  </button>
                </div>
              </div>

              {/* Đơn giá thực tế (nếu là Vàng / Cổ phiếu) */}
              {(dcaDepositGoal.assetType === 'gold' ||
                dcaDepositGoal.assetType === 'stock' ||
                dcaDepositGoal.unit === 'chỉ' ||
                dcaDepositGoal.unit === 'CP' ||
                dcaDepositGoal.unit === 'lượng') && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Đơn giá mua thực tế đợt này (VNĐ/{dcaDepositGoal.unit}):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={depositPriceStr}
                      onChange={(e) => setDepositPriceStr(formatNumberString(e.target.value, false))}
                      placeholder="Nhập đơn giá mua..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                      VNĐ/{dcaDepositGoal.unit}
                    </span>
                  </div>

                  {/* Gợi ý giá vàng live feed nếu là vàng */}
                  {(dcaDepositGoal.assetType === 'gold' || dcaDepositGoal.unit === 'chỉ' || dcaDepositGoal.unit === 'lượng' || dcaDepositGoal.name.toLowerCase().includes('vàng')) && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-900 min-w-0">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">
                          Thị trường: <b>{formatVND(getRecommendedGoldPrice(goldData, dcaDepositGoal.unit, dcaDepositGoal.name).pricePerUnit, isPrivacyMode)}</b>/{dcaDepositGoal.unit} ({getRecommendedGoldPrice(goldData, dcaDepositGoal.unit, dcaDepositGoal.name).brand})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const rec = getRecommendedGoldPrice(goldData, dcaDepositGoal.unit, dcaDepositGoal.name);
                          setDepositPriceStr(formatNumberString(rec.pricePerUnit));
                        }}
                        className="ml-2 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-md text-[10px] font-bold cursor-pointer transition shrink-0 shadow-2xs"
                      >
                        ⚡ Dùng giá này
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tùy chọn tự động đồng bộ sang Tab 1 */}
              {dcaDepositGoal.assetType === 'saving' || (!dcaDepositGoal.assetType && dcaDepositGoal.unit === 'VNĐ' && dcaDepositGoal.group === 'dca') ? (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <Landmark className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>Mục tiêu tích lũy mở Sổ Tiết Kiệm mới</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Tiền nạp kỳ này được tích lũy riêng trong mục tiêu. Khi đạt mục tiêu hoặc bấm <b>"Mở sổ mới"</b>, hệ thống sẽ tạo <b>Sổ Tiết Kiệm Mới Độc Lập</b> trong Tháp Tài Sản (Tab 1), hoàn toàn không cộng dồn ghi đè vào các sổ đã có.
                  </p>
                </div>
              ) : (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100/70 transition">
                  <input
                    type="checkbox"
                    checked={depositAutoSyncAsset}
                    onChange={(e) => setDepositAutoSyncAsset(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-400"
                  />
                  <span className="text-xs font-semibold text-blue-900">
                    Tự động cộng dồn số lượng & cập nhật giá vốn vào <b>Tháp Tài Sản (Tab 1)</b>
                  </span>
                </label>
              )}
            </div>

            {/* Nút hành động */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDcaDepositGoal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeposit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md cursor-pointer transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác Nhận Đã Nạp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NỢ KỲ SAU (CARRY OVER BACKLOG MODAL) */}
      {dcaBacklogGoal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Chuyển Nợ Định Mức Sang Kỳ Sau
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mục tiêu: <span className="font-bold text-slate-800">{dcaBacklogGoal.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDcaBacklogGoal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <p>
                Kỳ này chưa kịp nạp? Hệ thống sẽ ghi nhận số lượng này vào <b>Nợ dồn</b> để nhắc bạn mua bù vào kỳ tới.
              </p>
              <div className="flex justify-between pt-1 border-t border-amber-200 font-bold">
                <span>Nợ dồn hiện tại:</span>
                <span>{formatNumberString(dcaBacklogGoal.backlogQty || 0)} {dcaBacklogGoal.unit}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Số lượng chuyển nợ ({dcaBacklogGoal.unit}):
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={backlogInputStr}
                  onChange={(e) => {
                    const isVnd = dcaBacklogGoal.unit === 'VNĐ' || dcaBacklogGoal.assetType === 'saving' || dcaBacklogGoal.assetType === 'cash';
                    setBacklogInputStr(formatNumberString(e.target.value, !isVnd));
                  }}
                  placeholder="Nhập số lượng chuyển nợ..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  {dcaBacklogGoal.unit}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDcaBacklogGoal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmBacklog}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-md cursor-pointer transition flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4" />
                <span>Xác Nhận Chuyển Nợ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MỞ SỔ TIẾT KIỆM MỚI (TẠO TÀI SẢN ĐỘC LẬP VÀO TAB 1) */}
      {goalForNewSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Mở Sổ Tiết Kiệm Mới (Tab 1)</h3>
                  <p className="text-[11px] text-slate-600">
                    Tạo sổ tiết kiệm độc lập vào Tầng 1 Tháp Tài Sản từ mục tiêu: <b>{goalForNewSaving.name}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGoalForNewSaving(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sổ Tiết Kiệm Độc Lập</span>
                </div>
                <p className="text-[11.5px] text-blue-700 leading-relaxed">
                  Theo nguyên tắc quản lý tài chính, mỗi sổ tiết kiệm có kỳ hạn, lãi suất và ngân hàng phát hành riêng biệt. Hệ thống sẽ tạo một sổ mới trong Tab 1, không ghi đè hay cộng dồn vào các sổ tiết kiệm cũ.
                </p>
              </div>

              {/* Tên sổ tiết kiệm */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Sổ Tiết Kiệm / Mục Đích:
                </label>
                <input
                  type="text"
                  value={savingName}
                  onChange={(e) => setSavingName(e.target.value)}
                  placeholder="Ví dụ: Sổ TK Quỹ Khẩn Cấp, Sổ Mua Nhà..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                />
              </div>

              {/* Ngân hàng phát hành */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ngân Hàng Phát Hành:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={savingBank}
                    onChange={(e) => setSavingBank(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                  >
                    <option value="Vietcombank">Vietcombank</option>
                    <option value="BIDV">BIDV</option>
                    <option value="VietinBank">VietinBank</option>
                    <option value="Agribank">Agribank</option>
                    <option value="Techcombank">Techcombank</option>
                    <option value="MBBank">MBBank</option>
                    <option value="VPBank">VPBank</option>
                    <option value="ACB">ACB</option>
                    <option value="TPBank">TPBank</option>
                    <option value="HDBank">HDBank</option>
                    <option value="Sacombank">Sacombank</option>
                    <option value="Khác">Ngân hàng khác...</option>
                  </select>

                  {savingBank === 'Khác' && (
                    <input
                      type="text"
                      value={savingCustomBank}
                      onChange={(e) => setSavingCustomBank(e.target.value)}
                      placeholder="Nhập tên ngân hàng..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Số tiền gửi tiết kiệm */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Tiền Gửi Tiết Kiệm (VNĐ):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={savingAmountStr}
                    onChange={(e) => setSavingAmountStr(formatNumberString(e.target.value, false))}
                    placeholder="100.000.000"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-black text-blue-700 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">VNĐ</span>
                </div>
              </div>

              {/* Kỳ hạn & Lãi suất */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kỳ Hạn Gửi:
                  </label>
                  <select
                    value={savingTermMonths}
                    onChange={(e) => handleTermMonthsChange(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                  >
                    <option value="1">1 Tháng</option>
                    <option value="3">3 Tháng</option>
                    <option value="6">6 Tháng</option>
                    <option value="9">9 Tháng</option>
                    <option value="12">12 Tháng (1 năm)</option>
                    <option value="18">18 Tháng</option>
                    <option value="24">24 Tháng (2 năm)</option>
                    <option value="36">36 Tháng (3 năm)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lãi Suất (%/năm):
                  </label>
                  <input
                    type="text"
                    value={savingRateStr}
                    onChange={(e) => setSavingRateStr(e.target.value)}
                    placeholder="5.5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Ngày gửi & Ngày đáo hạn dự kiến */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày Bắt Đầu Gửi:
                  </label>
                  <input
                    type="date"
                    value={savingStartDate}
                    onChange={(e) => setSavingStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày Đáo Hạn Dự Kiến:
                  </label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                    {calculateMaturityDate(savingStartDate, savingTermMonths) || 'Chưa xác định'}
                  </div>
                </div>
              </div>

              {/* Preview Tiền Lãi Dự Kiến */}
              {parseFormattedNumber(savingAmountStr) > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">Tiền Lãi Dự Kiến Khi Đáo Hạn:</span>
                  <span className="text-xs font-black text-emerald-700">
                    {formatVND(
                      Math.round(
                        parseFormattedNumber(savingAmountStr) *
                          ((parseFormattedDecimal(savingRateStr) || 5.5) / 100) *
                          (savingTermMonths / 12)
                      ),
                      isPrivacyMode
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setGoalForNewSaving(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateSavingBook}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md cursor-pointer transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác Nhận Mở Sổ Mới</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GHI NHẬN TRẢ NỢ (ĐỒNG BỘ TRỰC TIẾP SANG TAB 2) */}
      {goalForPayDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-rose-50 to-amber-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Trả Nợ & Giảm Dư Nợ Tab 2</h3>
                  <p className="text-[11px] text-slate-600">
                    Đồng bộ trực tiếp trừ dư nợ cho mục tiêu: <b>{goalForPayDebt.name}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGoalForPayDebt(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Thông tin khoản nợ Tab 2 */}
              {(() => {
                const debt = goalForPayDebt.linkedDebtId ? db.debts.find((d) => d.id === goalForPayDebt.linkedDebtId) : undefined;
                if (!debt) return null;
                const rem = Math.max(0, debt.amount - (debt.paidPrincipal || 0));
                return (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-center font-bold text-slate-800">
                      <span>Khoản nợ Tab 2:</span>
                      <span className="text-rose-700 font-black">{debt.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600 text-[11.5px]">
                      <span>Tổng nợ gốc:</span>
                      <span className="font-semibold">{formatVND(debt.amount, isPrivacyMode)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600 text-[11.5px]">
                      <span>Đã thanh toán:</span>
                      <span className="font-semibold text-emerald-700">{formatVND(debt.paidPrincipal || 0, isPrivacyMode)}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-800 font-bold border-t border-slate-200 pt-1">
                      <span>Dư nợ còn lại:</span>
                      <span className="font-black text-rose-600">{formatVND(rem, isPrivacyMode)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Số tiền trả đợt này */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Tiền Trả Đợt Này (VNĐ):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={payDebtAmountStr}
                    onChange={(e) => setPayDebtAmountStr(formatNumberString(e.target.value, false))}
                    placeholder="Nhập số tiền trả..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-black text-rose-700 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">VNĐ</span>
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi Chú Trả Nợ:
                </label>
                <input
                  type="text"
                  value={payDebtNote}
                  onChange={(e) => setPayDebtNote(e.target.value)}
                  placeholder="Ghi chú đợt trả nợ..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-rose-500 outline-none"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setGoalForPayDebt(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmPayDebt}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md cursor-pointer transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác Nhận Trả Nợ Tab 2</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastBanner && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {toastBanner.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toastBanner.type === 'warning' && <Clock className="w-5 h-5 text-amber-400 shrink-0" />}
            {toastBanner.type === 'info' && <TrendingUp className="w-5 h-5 text-blue-400 shrink-0" />}
            <span>{toastBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Delete Goal Confirmation Modal */}
      <ConfirmModal
        isOpen={!!goalToDelete}
        title="Xác nhận xóa mục tiêu tích sản"
        message={`Bạn có chắc chắn muốn xóa mục tiêu "${goalToDelete?.name}"?`}
        subMessage="Kế hoạch dòng tiền và tiến độ tích sản sẽ được tính toán lại."
        confirmText="Xóa mục tiêu"
        onConfirm={() => {
          if (goalToDelete) {
            onRemoveGoal(goalToDelete.id);
            setGoalToDelete(null);
          }
        }}
        onClose={() => setGoalToDelete(null)}
      />

      {/* Complete Goal Confirmation Modal */}
      <ConfirmModal
        isOpen={!!goalToComplete}
        title="Xác nhận hoàn thành mục tiêu"
        message={`Xác nhận đánh dấu hoàn thành mục tiêu "${goalToComplete?.name}"?`}
        subMessage={
          goalToComplete?.goalType === 'milestone' && goalToComplete?.target && !goalToComplete?.linkedDebtId
            ? `Hệ thống sẽ đồng thời tự động ghi nhận tài sản "${goalToComplete.name}" trị giá ${formatVND(goalToComplete.target)} vào Tháp Tài Sản (Tab 1).`
            : 'Dữ liệu và tiến độ sẽ được cập nhật đồng bộ sang Tháp Tài Sản và Nghĩa Vụ Nợ.'
        }
        confirmText="Xác nhận hoàn thành"
        confirmVariant="primary"
        onConfirm={() => {
          if (goalToComplete) {
            executeCompleteGoal(goalToComplete);
            setGoalToComplete(null);
          }
        }}
        onClose={() => setGoalToComplete(null)}
      />
    </div>
  );
};
