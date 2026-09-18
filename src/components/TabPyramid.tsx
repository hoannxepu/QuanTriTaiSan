import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, DatabaseState, AssetTransaction } from '../types';
import { formatVND, formatNumberString, parseFormattedNumber, formatDateVN, calculateMaturityDate, calculateMaturityDateISO, getStandardTimeline, getActualTimelinePoints } from '../utils/format';
import { createPointValuePlugin } from '../utils/chartPlugin';
import { Chart, registerables } from 'chart.js';
import { Layers, PlusCircle, RotateCw, Check, Sliders, ChevronDown, ChevronUp, Eye, Pen, Trash2, TrendingUp, TrendingDown, AlertCircle, Calendar, X, Award, Info, ChevronRight, Clock, Cloud, Landmark, Building2, FolderOpen, FolderClosed, ArrowUpDown, ListFilter, History, Sparkles, Calculator, RefreshCw } from 'lucide-react';
import { getVietnamWealthBenchmark } from '../utils/benchmarkUtils';
import { BenchmarkModal } from './BenchmarkModal';
import { groupSavingsByBank, BankGroup, extractBankFromAssetName } from '../utils/bankUtils';
import { AssetHistoryModal } from './AssetHistoryModal';
import { ConfirmModal } from './ConfirmModal';
import { fetchGoldRates, getDojiPrices, GoldRateData } from '../utils/goldService';
import { fetchStockRates, getStockQuote, extractStockTicker, collectAllStockSymbols, isStockEntity, StockRateData } from '../utils/stockService';

Chart.register(...registerables);

interface TabPyramidProps {
  db: DatabaseState;
  isPrivacyMode: boolean;
  onUpdateAsset: (asset: Asset) => void;
  onRemoveAsset: (id: number) => void;
  onSyncDrive: () => Promise<void>;
  isSyncing: boolean;
  cloudSyncStatus?: 'synced' | 'syncing' | 'offline';
  onSaveTransactions?: (updatedTxs: AssetTransaction[], updatedAsset?: Asset) => void;
  onSwitchTab?: (tab: 'pyramid' | 'debts' | 'goals' | 'market') => void;
  goldData?: GoldRateData | null;
  stockData?: StockRateData | null;
  onSyncMarketPrices?: () => void;
}

const assetTypeLabels: Record<string, string> = {
  cash: 'Tiền Mặt / Thanh Toán',
  saving: 'Sổ Tiết Kiệm Kỳ Hạn',
  gold: 'Vàng Tích Trữ (SJC / Nhẫn)',
  realestate_live: 'BĐS Để Ở (An Cư)',
  realestate_rent: 'BĐS Cho Thuê (Dòng Tiền)',
  stock: 'Cổ Phiếu / ETF',
  realestate_land: 'BĐS Đất Nền Dự Án',
  bond: 'Trái Phiếu',
  crypto: 'Crypto / FX Mạo Hiểm',
  private_equity: 'Góp Vốn Đầu Tư',
  peer_lending: 'Cho Vay Tín Dụng',
};

const levelDescriptions: Record<string, string> = {
  '1': 'Tầng 1 (Bảo Vệ & Nền Tảng): Tiền mặt, tiết kiệm, vàng, BĐS để ở. Thanh khoản cao, bảo toàn vốn.',
  '2': 'Tầng 2 (Tăng Trưởng): Cổ phiếu, đất nền, trái phiếu. Gia tăng quy mô tài sản theo chu kỳ.',
  '3': 'Tầng 3 (Mạo Hiểm): Crypto, FX, góp vốn tư nhân. Tỷ suất sinh lời cao đi kèm rủi ro lớn.',
};

export const TabPyramid: React.FC<TabPyramidProps> = ({
  db,
  isPrivacyMode,
  onUpdateAsset,
  onRemoveAsset,
  onSyncDrive,
  isSyncing,
  cloudSyncStatus = 'synced',
  onSaveTransactions,
  onSwitchTab,
  goldData,
  stockData,
  onSyncMarketPrices,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showWealthBenchmarkModal, setShowWealthBenchmarkModal] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [sortMode, setSortMode] = useState<'default' | 'value-desc' | 'value-asc' | 'name-asc' | 'level'>('default');
  const [netWorthRange, setNetWorthRange] = useState<'quarter' | 'year' | '3years' | '5years'>('quarter');

  // History modal states
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState<Asset | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<{ id: number; name: string } | null>(null);

  // Form states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [level, setLevel] = useState<'1' | '2' | '3'>('1');
  const [type, setType] = useState<Asset['type']>('cash');
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [costPriceStr, setCostPriceStr] = useState('');
  const [rateStr, setRateStr] = useState('');
  const [startDate, setStartDate] = useState('');
  const [termMonthsStr, setTermMonthsStr] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [quantityStr, setQuantityStr] = useState('');
  const [cashflowStr, setCashflowStr] = useState('');
  const [divCashStr, setDivCashStr] = useState('');

  // Market live data states
  const [localGoldRates, setLocalGoldRates] = useState<GoldRateData | null>(goldData || null);
  const [localStockRates, setLocalStockRates] = useState<StockRateData | null>(stockData || null);
  const [autoSyncMarketPrice, setAutoSyncMarketPrice] = useState<boolean>(true);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState<boolean>(false);

  useEffect(() => {
    if (goldData) setLocalGoldRates(goldData);
  }, [goldData]);

  useEffect(() => {
    if (stockData) setLocalStockRates(stockData);
  }, [stockData]);

  useEffect(() => {
    if (!localGoldRates) {
      fetchGoldRates(false).then((data) => setLocalGoldRates(data)).catch(() => {});
    }
    if (!localStockRates) {
      const syms = collectAllStockSymbols(db.assets, db.goals);
      fetchStockRates(syms, false).then((data) => setLocalStockRates(data)).catch(() => {});
    }
  }, []);

  const handleRefreshMarketData = async () => {
    setIsRefreshingMarket(true);
    try {
      if (onSyncMarketPrices) {
        await onSyncMarketPrices();
      }
      const syms = collectAllStockSymbols(db.assets, db.goals);
      const [g, s] = await Promise.all([fetchGoldRates(true), fetchStockRates(syms, true)]);
      if (g) setLocalGoldRates(g);
      if (s) setLocalStockRates(s);
    } catch {
      // ignore
    } finally {
      setIsRefreshingMarket(false);
    }
  };

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Totals calculations
  const totalAssets = db.assets.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalDebts = db.debts.reduce((sum, d) => {
    if (d.category === 'type1' || d.category === 'type2' || d.category === 'type_free') {
      return sum + Math.max(0, d.amount - (d.paidPrincipal || 0));
    }
    return sum;
  }, 0);
  const netWorth = totalAssets - totalDebts;

  const p1 = db.assets.filter((a) => a.level === '1').reduce((sum, a) => sum + a.amount, 0);
  const p2 = db.assets.filter((a) => a.level === '2').reduce((sum, a) => sum + a.amount, 0);
  const p3 = db.assets.filter((a) => a.level === '3').reduce((sum, a) => sum + a.amount, 0);

  const wealthBenchmark = getVietnamWealthBenchmark(totalAssets);

  const r1 = totalAssets > 0 ? Math.round((p1 / totalAssets) * 100) : 0;
  const r2 = totalAssets > 0 ? Math.round((p2 / totalAssets) * 100) : 0;
  const r3 = totalAssets > 0 ? Math.round((p3 / totalAssets) * 100) : 0;

  // Sorting
  const sortedAssets = [...db.assets].sort((a, b) => {
    if (sortMode === 'value-desc') return b.amount - a.amount;
    if (sortMode === 'value-asc') return a.amount - b.amount;
    if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
    if (sortMode === 'level') return Number(a.level) - Number(b.level);
    return 0;
  });

  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [isSavingsOpen, setIsSavingsOpen] = useState<boolean>(true);
  const [savingsRowMode, setSavingsRowMode] = useState<'byBank' | 'flat'>('byBank');
  const [expandedBankKeys, setExpandedBankKeys] = useState<Record<string, boolean>>({});
  const [groupSavingsInFlat, setGroupSavingsInFlat] = useState<boolean>(true);
  const [expandedFlatBanks, setExpandedFlatBanks] = useState<Record<string, boolean>>({});

  const toggleFlatBankExpand = (bankKey: string) => {
    setExpandedFlatBanks((prev) => ({
      ...prev,
      [bankKey]: !prev[bankKey],
    }));
  };

  const savingAssets = useMemo(() => sortedAssets.filter((a) => a.type === 'saving'), [sortedAssets]);
  const nonSavingAssets = useMemo(() => sortedAssets.filter((a) => a.type !== 'saving'), [sortedAssets]);
  const bankGroups = useMemo(() => groupSavingsByBank(savingAssets), [savingAssets]);

  const flatItems = useMemo(() => {
    if (!groupSavingsInFlat) {
      return sortedAssets.map((a) => ({ kind: 'asset' as const, asset: a }));
    }

    const bankMap = new Map<string, BankGroup>();
    bankGroups.forEach((bg) => {
      bankMap.set(bg.bankKey, bg);
    });

    const seenBanks = new Set<string>();
    const items: ({ kind: 'asset'; asset: Asset } | { kind: 'bank'; bankGroup: BankGroup })[] = [];

    sortedAssets.forEach((a) => {
      if (a.type !== 'saving') {
        items.push({ kind: 'asset', asset: a });
      } else {
        const { bankName } = extractBankFromAssetName(a.name);
        const key = bankName.toLowerCase();
        if (!seenBanks.has(key)) {
          seenBanks.add(key);
          const bg = bankMap.get(key);
          if (bg) {
            items.push({ kind: 'bank', bankGroup: bg });
          }
        }
      }
    });

    return items;
  }, [sortedAssets, groupSavingsInFlat, bankGroups]);

  const toggleBankExpand = (bankKey: string) => {
    setExpandedBankKeys((prev) => ({
      ...prev,
      [bankKey]: !prev[bankKey],
    }));
  };

  const toggleAllBanks = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    bankGroups.forEach((bg) => {
      nextState[bg.bankKey] = expand;
    });
    setExpandedBankKeys(nextState);
  };

  const totalSavingPrincipal = useMemo(() => savingAssets.reduce((sum, a) => sum + a.amount, 0), [savingAssets]);
  const totalSavingInterest = useMemo(() => {
    return savingAssets.reduce((sum, a) => {
      const interest = a.rate && a.termMonths ? Math.round(a.amount * (a.rate / 100) * (a.termMonths / 12)) : 0;
      return sum + interest;
    }, 0);
  }, [savingAssets]);
  const totalSavingMonthly = useMemo(() => {
    return savingAssets.reduce((sum, a) => {
      const interest = a.rate && a.termMonths ? Math.round(a.amount * (a.rate / 100) * (a.termMonths / 12)) : 0;
      const monthly = a.termMonths ? Math.round(interest / a.termMonths) : 0;
      return sum + monthly;
    }, 0);
  }, [savingAssets]);

  // Render chart - chỉ hiển thị các tháng thực tế có dữ liệu từ tháng bắt đầu
  useEffect(() => {
    if (!chartCanvasRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const points = getActualTimelinePoints(
      db,
      {
        netWorth,
        totalAssets,
        totalDebts,
        inflow: 0,
        outflow: 0,
        netCashFlow: 0,
        debtProgressPercent: 0,
        dcaProgressPercent: 0,
        runwayPercent: 0,
        milestoneProgressPercent: 0,
      },
      netWorthRange
    );

    const labels = points.map((p) => p.label);
    const dataValues: number[] = points.map((p) => p.netWorth);

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Tài Sản Ròng',
            data: dataValues,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#059669',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 26,
            bottom: 10,
            left: 14,
            right: 14,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `Tài Sản Ròng: ${formatVND(Number(item.raw), isPrivacyMode)}`,
            },
          },
        },
        scales: {
          y: {
            ticks: {
              callback: (val) =>
                isPrivacyMode
                  ? '***'
                  : Number(val) >= 1e9
                  ? (Number(val) / 1e9).toFixed(1) + ' Tỷ'
                  : (Number(val) / 1e6).toFixed(0) + ' Tr',
            },
          },
        },
      },
      plugins: [createPointValuePlugin({ isPrivacyMode, valueType: 'currency' })],
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [db, netWorthRange, isPrivacyMode, netWorth, totalAssets, totalDebts]);

  const handleTypeChange = (newType: Asset['type']) => {
    setType(newType);
    if (newType === 'cash' || newType === 'saving' || newType === 'gold' || newType === 'realestate_live' || newType === 'realestate_rent') {
      setLevel('1');
    } else if (newType === 'stock' || newType === 'realestate_land' || newType === 'bond') {
      setLevel('2');
    } else if (newType === 'crypto' || newType === 'private_equity' || newType === 'peer_lending') {
      setLevel('3');
    }
  };

  const handleEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setLevel(asset.level);
    setType(asset.type);
    setName(asset.name);
    setAmountStr(formatNumberString(asset.amount));
    setCostPriceStr(asset.costPrice ? formatNumberString(asset.costPrice) : '');
    setRateStr(asset.rate ? String(asset.rate) : '');
    setStartDate(asset.startDate || '');
    setTermMonthsStr(asset.termMonths ? String(asset.termMonths) : '');
    setMaturityDate(asset.maturityDate || calculateMaturityDateISO(asset.startDate, asset.termMonths));
    setQuantityStr(asset.quantity ? formatNumberString(asset.quantity) : '');
    setCashflowStr(asset.cashflow ? formatNumberString(asset.cashflow) : '');
    setDivCashStr(asset.divCash ? formatNumberString(asset.divCash) : '');
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setEditingId(null);
    setName('');
    setAmountStr('');
    setCostPriceStr('');
    setRateStr('');
    setStartDate('');
    setTermMonthsStr('');
    setMaturityDate('');
    setQuantityStr('');
    setCashflowStr('');
    setDivCashStr('');
    setShowForm(false);
  };

  // Form Market Auto-Calculations
  const isStockType = type === 'stock';
  const detectedStockTicker = isStockType ? extractStockTicker(name, 'stock', 'CP') : null;
  const currentStockQuote = detectedStockTicker
    ? getStockQuote(localStockRates || stockData, detectedStockTicker)
    : null;
  const stockMarketUnitPrice = currentStockQuote ? currentStockQuote.price : 0;

  const isGoldType =
    type === 'gold' ||
    name.toLowerCase().includes('vàng') ||
    name.toLowerCase().includes('doji') ||
    name.toLowerCase().includes('sjc');
  const isGoldLuong =
    quantityStr.toLowerCase().includes('lượng') ||
    quantityStr.toLowerCase().includes('cây') ||
    name.toLowerCase().includes('1l') ||
    name.toLowerCase().includes('lượng');
  const goldUnitName = isGoldLuong ? 'lượng' : 'chỉ';
  const goldPriceInfo = isGoldType ? getDojiPrices(localGoldRates || goldData, goldUnitName, name) : null;
  const goldMarketUnitPrice = goldPriceInfo ? goldPriceInfo.buyPrice : 14400000;

  const formQty = parseFormattedNumber(quantityStr);
  const formRawCost = parseFormattedNumber(costPriceStr);
  const formEffectiveUnitPrice = isStockType
    ? stockMarketUnitPrice
    : isGoldType
    ? goldMarketUnitPrice
    : 0;
  const formMarketTotalValue =
    formQty > 0 && formEffectiveUnitPrice > 0 ? Math.round(formQty * formEffectiveUnitPrice) : 0;

  // Intelligent Cost Basis detection (supports both Total Cost vs Unit Cost entry)
  let formTotalCost = formRawCost;
  let formUnitCost = formQty > 0 ? Math.round(formRawCost / formQty) : 0;
  if (isStockType && formRawCost > 0 && formRawCost <= 500000 && formQty > 1) {
    formTotalCost = Math.round(formRawCost * formQty);
    formUnitCost = formRawCost;
  } else if (isGoldType && formRawCost > 0 && formRawCost <= 35000000 && formQty > 1) {
    formTotalCost = Math.round(formRawCost * formQty);
    formUnitCost = formRawCost;
  }

  // Auto-sync amountStr when autoSyncMarketPrice is active and quantity or market price changes
  useEffect(() => {
    if (showForm && autoSyncMarketPrice && (isStockType || isGoldType) && formMarketTotalValue > 0) {
      setAmountStr(formatNumberString(formMarketTotalValue));
    }
  }, [showForm, autoSyncMarketPrice, isStockType, isGoldType, formMarketTotalValue]);

  const currentAssetAmount = parseFormattedNumber(amountStr) || formMarketTotalValue;
  const formPnlDiff = formTotalCost > 0 && currentAssetAmount > 0 ? currentAssetAmount - formTotalCost : 0;
  const formPnlPct = formTotalCost > 0 && currentAssetAmount > 0 ? (formPnlDiff / formTotalCost) * 100 : 0;
  const isFormGain = formPnlDiff >= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = parseFormattedNumber(amountStr) || formMarketTotalValue;
    if (!name.trim() || finalAmount <= 0) {
      alert('Vui lòng nhập tên tài sản và giá trị (hoặc nhập số lượng & đơn giá thị trường)!');
      return;
    }

    const calculatedMaturity =
      (type === 'saving' || type === 'bond' || type === 'peer_lending') && startDate && termMonthsStr
        ? calculateMaturityDateISO(startDate, Number(termMonthsStr))
        : maturityDate || undefined;

    const newAsset: Asset = {
      id: editingId || Date.now(),
      level,
      type,
      name: name.trim(),
      amount: finalAmount,
      costPrice: formTotalCost > 0 ? formTotalCost : undefined,
      unitPrice: formUnitCost > 0 ? formUnitCost : undefined,
      currentPrice: formEffectiveUnitPrice > 0 ? formEffectiveUnitPrice : undefined,
      unit: isStockType ? 'CP' : isGoldType ? goldUnitName : undefined,
      rate: rateStr ? Number(rateStr) : undefined,
      startDate: startDate || undefined,
      termMonths: termMonthsStr ? Number(termMonthsStr) : undefined,
      maturityDate: calculatedMaturity,
      quantity: formQty > 0 ? formQty : undefined,
      cashflow: cashflowStr ? parseFormattedNumber(cashflowStr) : undefined,
      divCash: divCashStr ? parseFormattedNumber(divCashStr) : undefined,
      updatedAt: new Date().toLocaleDateString('vi-VN'),
    };

    onUpdateAsset(newAsset);
    handleCancelForm();
  };

  // Preview calculations
  const parsedAmt = parseFormattedNumber(amountStr);
  const parsedRate = Number(rateStr) || 0;
  const parsedTerm = Number(termMonthsStr) || 0;
  const savingMaturityInterest =
    type === 'saving' && parsedAmt > 0 && parsedRate > 0 && parsedTerm > 0
      ? Math.round(parsedAmt * (parsedRate / 100) * (parsedTerm / 12))
      : 0;

  const parsedQty = parseFormattedNumber(quantityStr);
  const parsedDivCash = parseFormattedNumber(divCashStr);
  const stockYearlyDiv =
    type === 'stock' && parsedQty > 0 && parsedDivCash > 0 ? parsedQty * parsedDivCash : 0;

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* 1. DEDICATED MOBILE VIEW (< md) - COMPACT, SLEEK, BANKING APP STYLE */}
      <div className="md:hidden bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
        {/* Row 1: Tài Sản Ròng (Net Worth) - Trọng tâm tài chính, vừa mắt */}
        <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200/70 rounded-lg px-2.5 py-1.5">
          <div className="min-w-0 flex-1 mr-2">
            <span className="text-[9.5px] font-bold text-emerald-800 uppercase tracking-wide block">
              Tài Sản Ròng (Net Worth)
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-700 tracking-tight block">
              {formatVND(netWorth, isPrivacyMode)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowWealthBenchmarkModal(true)}
            className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${wealthBenchmark.currentTier.badgeBg} flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0`}
            title="Xem bảng mốc phân tầng tài sản tại Việt Nam"
          >
            <Award className="w-2.5 h-2.5 shrink-0 text-amber-600" />
            <span className="whitespace-nowrap">{wealthBenchmark.currentTier.topPercent} VN</span>
          </button>
        </div>

        {/* Row 2: Hai cột nhỏ gọn song song - Tổng tài sản & Nợ */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Cột trái: Tổng tài sản */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">
                Tổng Tài Sản
              </span>
              <span className="text-xs font-black text-slate-900 block mt-0.5">
                {formatVND(totalAssets, isPrivacyMode)}
              </span>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-200/60 text-[8.5px] text-slate-500 font-medium">
              <div>{isPrivacyMode ? '••••••' : wealthBenchmark.ratioText}</div>
              <div className="text-emerald-700 font-semibold mt-0.5">
                {db.assets.length} Danh mục • {db.goals.length} Mục tiêu
              </div>
            </div>
          </div>

          {/* Cột phải: Nghĩa vụ nợ */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">
                Nghĩa Vụ Nợ
              </span>
              <span className="text-xs font-black text-rose-600 block mt-0.5">
                {formatVND(totalDebts, isPrivacyMode)}
              </span>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-200/60 text-[8.5px] text-slate-500 font-medium">
              <div>Đòn bẩy: {totalAssets > 0 ? ((totalDebts / totalAssets) * 100).toFixed(1) : 0}% TTS</div>
              <div className="text-rose-700 font-semibold mt-0.5">
                {db.debts.length} Khoản nợ đang quản lý
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED DESKTOP VIEW (>= md) */}
      <div className="hidden md:block bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 lg:gap-4">
          {/* Card 1: Tổng Tài Sản */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Tổng Tài Sản
                </span>
                {/* Vị thế tài sản */}
                <button
                  type="button"
                  onClick={() => setShowWealthBenchmarkModal(true)}
                  className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border ${wealthBenchmark.currentTier.badgeBg} flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0`}
                  title="Xem bảng mốc phân tầng tài sản tại Việt Nam"
                >
                  <Award className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span className="whitespace-nowrap">{wealthBenchmark.currentTier.topPercent} VN</span>
                </button>
              </div>

              <div className="text-xl lg:text-2xl font-black text-slate-900 block mt-2 tracking-tight">
                {formatVND(totalAssets, isPrivacyMode)}
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 font-medium leading-relaxed">
              <div>{isPrivacyMode ? 'So với VN: ••••••' : wealthBenchmark.ratioText}</div>
              <div className="text-emerald-700 font-semibold mt-0.5 flex items-center space-x-1.5">
                <span>{db.assets.length} Danh mục tài sản</span>
                <span className="text-slate-300">•</span>
                <span>{db.goals.length} Mục tiêu</span>
              </div>
            </div>
          </div>

          {/* Card 2: Nghĩa Vụ Tài Chính */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between min-w-0">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Nghĩa Vụ Nợ
              </span>
              <div className="text-xl lg:text-2xl font-black text-rose-600 block mt-2 tracking-tight">
                {formatVND(totalDebts, isPrivacyMode)}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 font-medium">
              <div>Đòn bẩy: {totalAssets > 0 ? ((totalDebts / totalAssets) * 100).toFixed(1) : 0}% TTS</div>
              <div className="text-rose-700 font-semibold mt-0.5">
                {db.debts.length} Khoản nợ đang quản lý
              </div>
            </div>
          </div>

          {/* Card 3: Giá Trị Tài Sản Ròng */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80 flex flex-col justify-between min-w-0">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Tài Sản Ròng (Net Worth)
              </span>
              <div className="text-xl lg:text-2xl font-black text-emerald-700 block mt-2 tracking-tight">
                {formatVND(netWorth, isPrivacyMode)}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-800/90 font-medium">
              Thực có sau khi trừ hết mọi khoản nợ
            </div>
          </div>
        </div>

        {/* Quick Link sang Tab 4: Thị Trường & Vĩ Mô */}
        {onSwitchTab && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Định giá cổ phiếu & vàng trong Tháp được cập nhật tự động theo thị trường.</span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('market')}
              className="px-3 py-1 bg-gradient-to-r from-amber-50 to-emerald-50 hover:from-amber-100 hover:to-emerald-100 text-slate-800 border border-amber-300/80 rounded-lg text-xs font-bold transition flex items-center justify-between sm:justify-start gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <div className="flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <span>Xem Bảng Giá DOJI, VN30 & Vĩ Mô (Tab 4)</span>
              </div>
              <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded font-black">
                Tab 4 ➔
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 1. DEDICATED MOBILE DUAL PYRAMID: 2 THÁP SONG SONG SIÊU GỌN (< md) */}
      <div className="md:hidden bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs">
          <span className="font-bold text-slate-900 flex items-center gap-1.5">
            <i className="fa-solid fa-pyramid text-emerald-600"></i>
            <span>Đối Chiếu 2 Tháp Tài Sản</span>
          </span>
          <span className="text-[10px] font-semibold text-slate-500">Thực Tế vs Mục Tiêu</span>
        </div>

        {/* 2 Tháp đặt song song nhau trên màn hình điện thoại */}
        <div className="grid grid-cols-2 gap-2 items-end">
          {/* Cột trái: Tháp Thực Tế Của Bạn */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-1.5 flex flex-col justify-between">
            <div className="text-center font-extrabold text-[10px] text-slate-800 border-b border-slate-200/60 pb-1 mb-1.5 truncate">
              1. Tháp Thực Tế
            </div>
            <div className="flex flex-col items-center space-y-1">
              {/* T3: Mạo hiểm */}
              <div className="w-[62%] bg-rose-50 border border-rose-200/90 rounded px-1 py-0.5 text-center shadow-2xs">
                <div className="text-[8.5px] font-extrabold text-rose-900 leading-tight">
                  T3: {isPrivacyMode ? '••' : `${r3}%`}
                </div>
                <div className="text-[7.5px] text-rose-700 font-semibold leading-tight truncate">
                  {isPrivacyMode ? '••••' : formatVND(p3, false)}
                </div>
                <div className="w-full bg-rose-200 h-1 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-rose-600 h-full transition-all duration-500" style={{ width: `${Math.min(100, r3)}%` }} />
                </div>
              </div>

              {/* T2: Tăng trưởng */}
              <div className="w-[82%] bg-blue-50 border border-blue-200/90 rounded px-1 py-0.5 text-center shadow-2xs">
                <div className="text-[8.5px] font-extrabold text-blue-900 leading-tight">
                  T2: {isPrivacyMode ? '••' : `${r2}%`}
                </div>
                <div className="text-[7.5px] text-blue-700 font-semibold leading-tight truncate">
                  {isPrivacyMode ? '••••' : formatVND(p2, false)}
                </div>
                <div className="w-full bg-blue-200 h-1 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${Math.min(100, r2)}%` }} />
                </div>
              </div>

              {/* T1: Nền tảng */}
              <div className="w-full bg-emerald-50 border border-emerald-200/90 rounded px-1 py-1 text-center shadow-2xs">
                <div className="text-[9px] font-extrabold text-emerald-900 leading-tight">
                  T1: {isPrivacyMode ? '••' : `${r1}%`}
                </div>
                <div className="text-[8px] text-emerald-700 font-semibold leading-tight truncate">
                  {isPrivacyMode ? '••••' : formatVND(p1, false)}
                </div>
                <div className="w-full bg-emerald-200 h-1 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-emerald-600 h-full transition-all duration-500" style={{ width: `${Math.min(100, r1)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải: Tháp Tiêu Chuẩn Mục Tiêu */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-1.5 flex flex-col justify-between">
            <div className="text-center font-extrabold text-[10px] text-blue-700 border-b border-slate-200/60 pb-1 mb-1.5 truncate">
              2. Tháp Mục Tiêu
            </div>
            <div className="flex flex-col items-center space-y-1">
              {/* T3 Mục Tiêu */}
              <div className="w-[62%] bg-white border border-slate-200 rounded px-1 py-0.5 text-center">
                <div className="text-[8.5px] font-bold text-slate-700 leading-tight">T3: 10%</div>
                <div className="text-[7.5px] text-rose-600 font-semibold leading-tight truncate">Mạo hiểm</div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-rose-500 h-full w-[10%]" />
                </div>
              </div>

              {/* T2 Mục Tiêu */}
              <div className="w-[82%] bg-white border border-slate-200 rounded px-1 py-0.5 text-center">
                <div className="text-[8.5px] font-bold text-slate-700 leading-tight">T2: 30%</div>
                <div className="text-[7.5px] text-blue-600 font-semibold leading-tight truncate">Tăng trưởng</div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-blue-500 h-full w-[30%]" />
                </div>
              </div>

              {/* T1 Mục Tiêu */}
              <div className="w-full bg-white border border-slate-200 rounded px-1 py-1 text-center">
                <div className="text-[9px] font-bold text-slate-700 leading-tight">T1: 60%</div>
                <div className="text-[8px] text-emerald-600 font-semibold leading-tight truncate">Nền tảng</div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-emerald-500 h-full w-[60%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED DESKTOP COMPARISON (>= md) - PRESERVED 100% AS ORIGINAL */}
      <div className="hidden md:grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Tháp Thực Tế */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-pyramid text-emerald-600"></i>
              <span>1. Tháp Thực Tế Của Bạn</span>
            </span>
            <span className="text-xs font-bold text-slate-500">Phân Bổ Hiện Tại</span>
          </h3>

          <div className="flex flex-col items-center space-y-2 pt-2">
            {/* Tầng 3 */}
            <div className="w-[60%] sm:w-[38%] bg-rose-50 border border-rose-200 px-2.5 py-2 rounded-lg shadow-2xs">
              <div className="text-center text-[10px] font-bold text-rose-900 leading-normal mb-1">
                <span className="block truncate pb-0.5">T3: Mạo Hiểm (Crypto, FX...)</span>
                <span className="text-[9px] font-semibold text-rose-700 block">
                  {isPrivacyMode ? '••••••' : `${r3}% (${formatVND(p3)})`}
                </span>
              </div>
              <div className="w-full bg-rose-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, r3)}%` }}
                ></div>
              </div>
            </div>

            {/* Tầng 2 */}
            <div className="w-[85%] sm:w-[68%] bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl shadow-2xs">
              <div className="flex justify-between text-[11px] font-bold text-blue-900 mb-1">
                <span className="truncate">T2: Tăng Trưởng (Cổ phiếu, Đất...)</span>
                <span>{isPrivacyMode ? '••••••' : `${r2}% (${formatVND(p2)})`}</span>
              </div>
              <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, r2)}%` }}
                ></div>
              </div>
            </div>

            {/* Tầng 1 */}
            <div className="w-full sm:w-[98%] bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-xl shadow-2xs">
              <div className="flex justify-between text-[11px] font-bold text-emerald-900 mb-1">
                <span className="truncate">T1: Nền Tảng (Tiền, Vàng, BĐS ở...)</span>
                <span>{isPrivacyMode ? '••••••' : `${r1}% (${formatVND(p1)})`}</span>
              </div>
              <div className="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, r1)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tháp Tiêu Chuẩn */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-square-check text-blue-600"></i>
              <span>2. Tháp Tiêu Chuẩn (Mục Tiêu)</span>
            </span>
            <span className="text-xs font-bold text-blue-600">Tỷ Lệ Chuẩn</span>
          </h3>

          <div className="flex flex-col items-center space-y-2 pt-2">
            <div className="w-[60%] sm:w-[38%] bg-slate-50 border border-slate-200 px-2.5 py-2 rounded-lg opacity-85">
              <div className="text-center text-[10px] font-bold text-slate-700 leading-normal mb-1">
                <span className="block truncate pb-0.5">T3: Mạo Hiểm (Crypto, FX...)</span>
                <span className="text-[9px] font-semibold text-rose-600 block">10% (Mục tiêu)</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full">
                <div className="bg-rose-500 h-full w-[10%]"></div>
              </div>
            </div>

            <div className="w-[85%] sm:w-[68%] bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl opacity-85">
              <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span className="truncate">T2: Tăng Trưởng (Cổ phiếu, Đất...)</span>
                <span className="text-blue-600">30% (Mục tiêu)</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full">
                <div className="bg-blue-500 h-full w-[30%]"></div>
              </div>
            </div>

            <div className="w-full sm:w-[98%] bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl opacity-85">
              <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span className="truncate">T1: Nền Tảng (Tiền, Vàng, BĐS ở...)</span>
                <span className="text-emerald-600">60% (Mục tiêu)</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full">
                <div className="bg-emerald-500 h-full w-[60%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations Box & Scientific Annotations */}
      {/* 1. MOBILE COMPACT RECOMMENDATIONS (< md) */}
      <div className="md:hidden bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-amber-500" />
            <span>Đánh Giá Tỷ Lệ Tháp</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowAnnotations(!showAnnotations)}
            className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-0.5"
          >
            <span>{showAnnotations ? 'Ẩn' : 'Chuẩn mực'}</span>
            {showAnnotations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* 3 micro badges for T1, T2, T3 */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {/* T1 */}
          <div
            className={`p-1.5 rounded-lg border text-[9.5px] flex flex-col justify-between ${
              r1 > 65
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : r1 < 55
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="font-extrabold truncate">T1 (60%)</div>
            <div className="font-bold text-xs mt-0.5">{r1}%</div>
            <div className="text-[8px] font-semibold truncate mt-0.5">
              {r1 > 65 ? `Thừa +${r1 - 60}%` : r1 < 55 ? `Thiếu ${60 - r1}%` : '✓ Chuẩn'}
            </div>
          </div>

          {/* T2 */}
          <div
            className={`p-1.5 rounded-lg border text-[9.5px] flex flex-col justify-between ${
              r2 > 35
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : r2 < 25
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="font-extrabold truncate">T2 (30%)</div>
            <div className="font-bold text-xs mt-0.5">{r2}%</div>
            <div className="text-[8px] font-semibold truncate mt-0.5">
              {r2 > 35 ? `Thừa +${r2 - 30}%` : r2 < 25 ? `Thiếu ${30 - r2}%` : '✓ Chuẩn'}
            </div>
          </div>

          {/* T3 */}
          <div
            className={`p-1.5 rounded-lg border text-[9.5px] flex flex-col justify-between ${
              r3 > 15
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : r3 > 10
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="font-extrabold truncate">T3 (≤10%)</div>
            <div className="font-bold text-xs mt-0.5">{r3}%</div>
            <div className="text-[8px] font-semibold truncate mt-0.5">
              {r3 > 10 ? `⚠️ Thừa +${r3 - 10}%` : '✓ An toàn'}
            </div>
          </div>
        </div>

        {/* 1-sentence quick advice on mobile */}
        <div className="bg-slate-50 border border-slate-200/70 rounded-lg px-2 py-1 text-[9.5px] text-slate-700 font-medium leading-tight">
          💡 {r3 > 12 ? 'Hạ bớt tỷ trọng Tầng 3 (Mạo hiểm) để bảo toàn vốn.' : r1 < 55 ? 'Nên tăng Tiết kiệm/Vàng củng cố Tầng 1 nền móng.' : 'Tháp tài sản đang có tỷ trọng cân đối an toàn.'}
        </div>

        {showAnnotations && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] space-y-1.5 text-slate-600">
            <p><strong>T1 (60%):</strong> Tiền mặt, tiết kiệm, vàng, BĐS ở - mỏ neo an toàn gia đình.</p>
            <p><strong>T2 (30%):</strong> Cổ phiếu, đất nền tiềm năng - động cơ nhân tài sản.</p>
            <p><strong>T3 (≤10%):</strong> Crypto, FX, cho vay - rủi ro cao, khống chế chặt chẽ.</p>
          </div>
        )}
      </div>

      {/* 2. DESKTOP DETAILED RECOMMENDATIONS (>= md) - PRESERVED 100% */}
      <div className="hidden md:block bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center">
            <Sliders className="w-4 h-4 text-amber-500 mr-2" />
            <span>Hướng Dẫn Điều Chỉnh Tỷ Lệ (Đối Chiếu)</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowAnnotations(!showAnnotations)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
          >
            <span>{showAnnotations ? 'Ẩn Chú Thích' : 'Mở Chú Thích & Chuẩn Mực'}</span>
            {showAnnotations ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Scientific Annotations Guide */}
        {showAnnotations && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <i className="fa-solid fa-graduation-cap text-blue-600"></i>
              <span>Quy Chuẩn Khoa Học Phân Bổ Tháp Tài Sản (Asset Allocation Framework)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-emerald-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Tầng 1: Nền Tảng Phòng Vệ (60%)</span>
                </div>
                <p className="text-slate-600">
                  Gồm Tiền mặt, Tiết kiệm ngân hàng, Vàng vật chất và BĐS ở thực. Vai trò là "mỏ neo" bảo đảm cuộc sống không bị đứt gãy tài chính trước mọi khủng hoảng kinh tế hoặc biến cố gia đình.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-blue-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>Tầng 2: Tăng Trưởng Quy Mô (30%)</span>
                </div>
                <p className="text-slate-600">
                  Gồm Cổ phiếu doanh nghiệp đầu ngành, Đất nền đón đầu quy hoạch, Trái phiếu doanh nghiệp uy tín. Đóng vai trò là động cơ sinh lời vượt lạm phát để nhân tài sản dài hạn.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-rose-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Tầng 3: Tăng Tốc & Khám Phá (≤10%)</span>
                </div>
                <p className="text-slate-600">
                  Gồm Crypto, Ngoại hối, Cho vay cá nhân, Góp vốn mạo hiểm. Có tiềm năng sinh lời đột biến nhưng rủi ro mất trắng, tuyệt đối khống chế tỷ trọng không vượt quá 10%.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {totalAssets === 0 ? (
            <div className="col-span-3 text-center py-2 text-slate-400">
              Hãy bắt đầu thêm tài sản để xem hướng dẫn điều chỉnh tỷ lệ.
            </div>
          ) : (
            <>
              <div
                className={`p-3 rounded-xl border ${
                  r1 > 65
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : r1 < 55
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex justify-between font-bold mb-1">
                  <span>Tầng 1 (Nền Tảng)</span>
                  <span>{r1 > 65 ? `Thừa +${r1 - 60}%` : r1 < 55 ? `Thiếu ${60 - r1}%` : 'Chuẩn (60%)'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {r1 > 65
                    ? 'Chân đế an toàn vững chắc. Nên tích lũy thêm kênh Tầng 2 để tăng sinh lời quy mô.'
                    : r1 < 55
                    ? 'Nên tăng Tiền tiết kiệm, Vàng hoặc BĐS để củng cố nền móng Tầng 1 an toàn.'
                    : 'Tỷ lệ nền tảng đạt chuẩn cân bằng bảo vệ.'}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  r2 > 35
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : r2 < 25
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex justify-between font-bold mb-1">
                  <span>Tầng 2 (Tăng Trưởng)</span>
                  <span>{r2 > 35 ? `Thừa +${r2 - 30}%` : r2 < 25 ? `Thiếu ${30 - r2}%` : 'Chuẩn (30%)'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {r2 < 25
                    ? 'Có thể gia tăng Cổ phiếu hoặc Đất nền tiềm năng để tăng tốc gia tăng quy mô tài sản.'
                    : r2 > 35
                    ? 'Có thể chốt lời bớt để củng cố chân đế Tầng 1 hoặc cơ cấu lại danh mục.'
                    : 'Tỷ trọng tăng trưởng tối ưu.'}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  r3 > 15
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex justify-between font-bold mb-1">
                  <span>Tầng 3 (Mạo Hiểm)</span>
                  <span>{r3 > 10 ? `Cảnh báo: Thừa +${r3 - 10}%` : 'Chuẩn (≤10%)'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {r3 > 10
                    ? 'Rủi ro cao! Hãy hạ bớt tỷ trọng Crypto, FX, Góp vốn rủi ro hoặc Cho vay tín dụng.'
                    : 'Nằm trong vùng quản trị an toàn tối ưu.'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Button Open Asset Form */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (showForm) handleCancelForm();
            else setShowForm(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center space-x-2 shadow-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>{showForm ? 'Đóng Khung Nhập' : '+ Thêm Tài Sản Vào Tháp'}</span>
        </button>
      </div>

      {/* Asset Form Modal (Responsive Bottom-Sheet on Mobile, Click outside backdrop to exit) */}
      {showForm && (
        <div
          onClick={handleCancelForm}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-3xl rounded-t-2xl sm:rounded-2xl p-3.5 sm:p-6 shadow-2xl border border-slate-200 space-y-2.5 sm:space-y-4 max-h-[90vh] overflow-y-auto cursor-default"
          >
            {/* Mobile Drag Handle Indicator */}
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden"></div>
            <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 sm:pb-3">
                <h3 className="text-xs sm:text-base font-bold text-slate-900 flex items-center min-w-0 flex-1 mr-2">
                  <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 mr-1.5 shrink-0" />
                  <span className="truncate">{editingId ? `Sửa: ${name}` : 'Thêm Tài Sản Mới Vào Tháp'}</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer shrink-0"
                  title="Đóng"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div>
              <label className="block text-[10.5px] sm:text-xs font-bold text-slate-700 mb-0.5 sm:mb-1">
                1. Phân Nhóm Tầng Tháp Tài Sản
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
              >
                <option value="1">Tầng 1: Bảo Vệ (Tiền mặt, Tiết kiệm, Vàng, BĐS ở...)</option>
                <option value="2">Tầng 2: Tăng Trưởng (Cổ phiếu, BĐS đất nền, Trái phiếu...)</option>
                <option value="3">Tầng 3: Mạo Hiểm (Crypto, FX, Góp vốn, Cho vay...)</option>
              </select>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-emerald-800 flex items-center leading-snug">
              {levelDescriptions[level]}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-0.5 sm:pt-2">
            <div>
              <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">Loại Tài Sản</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none"
              >
                <optgroup label="Tầng 1: Bảo Vệ & Nền Tảng">
                  <option value="cash">Tiền Mặt / Tiền Gửi Thanh Toán</option>
                  <option value="saving">Sổ Tiết Kiệm Kỳ Hạn</option>
                  <option value="gold">Vàng Tích Trữ (SJC, Nhẫn Trơn)</option>
                  <option value="realestate_live">BĐS Để Ở (An Cư)</option>
                  <option value="realestate_rent">BĐS Cho Thuê (Dòng Tiền)</option>
                </optgroup>
                <optgroup label="Tầng 2: Tăng Trưởng & Sinh Lời">
                  <option value="stock">Cổ Phiếu / Chứng Chỉ Quỹ (ETF)</option>
                  <option value="realestate_land">BĐS Đất Nền / Đầu Tư Tăng Trưởng</option>
                  <option value="bond">Trái Phiếu (Doanh Nghiệp / Chính Phủ)</option>
                </optgroup>
                <optgroup label="Tầng 3: Mạo Hiểm & Dòng Tiền Cao">
                  <option value="crypto">Crypto / Forex / Mạo Hiểm</option>
                  <option value="private_equity">Góp Vốn Đầu Tư Tư Nhân</option>
                  <option value="peer_lending">Cho Vay Cá Nhân / Tín Dụng</option>
                </optgroup>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-600">
                  {type === 'stock' ? 'Mã Cổ Phiếu / Tên' : type === 'gold' ? 'Loại Vàng / Thương Hiệu' : 'Tên Tài Sản / Mã'}
                </label>
                {type === 'stock' && (
                  <span className="text-[9.5px] font-bold text-blue-600">⚡ HOSE/HNX</span>
                )}
                {type === 'gold' && (
                  <span className="text-[9.5px] font-bold text-amber-600">⚡ DOJI Online</span>
                )}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'stock' ? 'VD: HPG, FPT, MBB...' : type === 'gold' ? 'VD: DOJI Nhẫn 9999, SJC...' : 'VD: Tiết kiệm BIDV...'}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white"
              />
              {/* Quick suggestions for Stock and Gold */}
              {type === 'stock' && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {['HPG', 'FPT', 'MBB', 'TCB', 'SSI', 'MWG', 'VND', 'VCB'].map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setName(sym)}
                      className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition ${
                        name.toUpperCase().trim() === sym
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              )}
              {type === 'gold' && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {[
                    { label: 'DOJI Nhẫn 9999', val: 'DOJI Nhẫn Tròn 9999 Hưng Thịnh Vượng' },
                    { label: 'DOJI SJC 1L', val: 'DOJI SJC 1 Lượng' },
                    { label: 'Vàng SJC Miếng', val: 'Vàng SJC Miếng' },
                  ].map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setName(g.val)}
                      className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition ${
                        name.includes(g.label) || name === g.val
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-600">
                  Giá Trị Hiện Tại (VNĐ)
                </label>
                {(type === 'stock' || type === 'gold') && (
                  <label className="inline-flex items-center gap-1 cursor-pointer text-[9.5px] text-emerald-700 font-bold">
                    <input
                      type="checkbox"
                      checked={autoSyncMarketPrice}
                      onChange={(e) => setAutoSyncMarketPrice(e.target.checked)}
                      className="w-3 h-3 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span>Tự tính TT</span>
                  </label>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={amountStr}
                  onChange={(e) => {
                    setAutoSyncMarketPrice(false);
                    setAmountStr(formatNumberString(e.target.value));
                  }}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-bold text-emerald-700 outline-none focus:bg-white"
                />
                {autoSyncMarketPrice && (isStockType || isGoldType) && formMarketTotalValue > 0 && (
                  <span className="absolute right-2 top-2.5 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold pointer-events-none">
                    ⚡ Auto TT
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Conditional Extra Fields: Grid 2 cols on mobile, 3-4 cols on tablet/desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 border-t border-slate-100 pt-2 sm:pt-3">
            {(type === 'stock' || type === 'crypto' || type === 'realestate_land' || type === 'realestate_rent' || type === 'realestate_live' || type === 'gold' || type === 'private_equity') && (
              <div>
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 truncate">
                    Giá Vốn (VNĐ)
                  </label>
                  {formUnitCost > 0 && formQty > 1 && (
                    <span className="text-[9px] text-slate-500 font-semibold truncate">
                      {formatVND(formUnitCost)}/{isStockType ? 'CP' : goldUnitName}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={costPriceStr}
                  onChange={(e) => setCostPriceStr(formatNumberString(e.target.value))}
                  placeholder={
                    type === 'stock'
                      ? 'Tổng vốn hoặc giá/CP (VD: 25.000)'
                      : type === 'gold'
                      ? 'Tổng vốn hoặc giá/chỉ (VD: 13.500.000)'
                      : '0'
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:bg-white"
                />
              </div>
            )}

            {(type === 'realestate_land' || type === 'realestate_rent' || type === 'realestate_live' || type === 'private_equity' || type === 'crypto') && (
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1 truncate">
                  Ngày Mua / Sở Hữu
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none"
                />
              </div>
            )}

            {(type === 'stock' || type === 'gold') && (
              <div>
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 truncate">
                    {type === 'stock' ? 'Số Lượng (CP)' : 'Số Lượng (Chỉ/Lượng)'}
                  </label>
                  {type === 'gold' && (
                    <span className="text-[9px] text-amber-700 font-bold uppercase">{goldUnitName}</span>
                  )}
                </div>
                <input
                  type="text"
                  value={quantityStr}
                  onChange={(e) => setQuantityStr(e.target.value)}
                  placeholder={type === 'gold' ? 'VD: 2 hoặc 0.5' : 'VD: 1000'}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:bg-white"
                />
              </div>
            )}

            {(type === 'saving' || type === 'bond' || type === 'peer_lending') && (
              <>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1 truncate">
                    Lãi Suất (%/năm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={rateStr}
                    onChange={(e) => setRateStr(e.target.value)}
                    placeholder="VD: 5.8"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1 truncate">
                    Ngày Gửi / Bắt Đầu
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1 truncate">
                    Kỳ Hạn (Tháng)
                  </label>
                  <input
                    type="number"
                    value={termMonthsStr}
                    onChange={(e) => setTermMonthsStr(e.target.value)}
                    placeholder="VD: 6, 12, 24"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-amber-800 mb-0.5 sm:mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1 truncate">
                      <span>{type === 'saving' ? 'Đáo Hạn Sổ' : 'Tất Toán'}</span>
                      <span className="text-[8.5px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-bold">🔒 Tự tính</span>
                    </span>
                  </label>
                  <input
                    type="date"
                    readOnly={true}
                    value={
                      startDate && termMonthsStr
                        ? calculateMaturityDateISO(startDate, Number(termMonthsStr))
                        : (maturityDate || '')
                    }
                    className="w-full bg-slate-100 text-slate-700 font-bold border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs cursor-not-allowed select-none outline-none shadow-2xs"
                    title="Ngày hết hạn / đáo hạn được hệ thống tự động tính toán từ Ngày gửi và Kỳ hạn."
                  />
                  <div className="text-[9px] sm:text-[9.5px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium truncate">
                    <span>⚡:</span>
                    <span className="text-amber-700 font-bold truncate">
                      {startDate && termMonthsStr
                        ? calculateMaturityDate(startDate, Number(termMonthsStr))
                        : 'Chờ ngày gửi & kỳ hạn'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {(type === 'realestate_rent' || type === 'private_equity' || type === 'peer_lending') && (
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1 truncate">
                  Dòng Tiền / Tháng (VNĐ)
                </label>
                <input
                  type="text"
                  value={cashflowStr}
                  onChange={(e) => setCashflowStr(formatNumberString(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none"
                />
              </div>
            )}

            {type === 'stock' && (
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1 truncate">
                  Cổ Tức Tiền Mặt (VNĐ/CP)
                </label>
                <input
                  type="text"
                  value={divCashStr}
                  onChange={(e) => setDivCashStr(formatNumberString(e.target.value))}
                  placeholder="VD: 1.500"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none"
                />
              </div>
            )}
          </div>

          {/* BẢNG THÔNG SỐ TỰ TÍNH THEO THỊ TRƯỜNG DÀNH CHO CỔ PHIẾU & GIÁ VÀNG */}
          {(isStockType || isGoldType) && (
            <div className={`p-2.5 sm:p-3.5 rounded-xl border transition-all ${
              isStockType
                ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-1.5">
                  <Calculator size={14} className={isStockType ? 'text-blue-600' : 'text-amber-600'} />
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">
                    ⚡ Bảng Thông Số Tự Tính Theo Thị Trường
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshMarketData}
                  disabled={isRefreshingMarket}
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
                >
                  <RefreshCw size={10} className={isRefreshingMarket ? 'animate-spin text-blue-600' : ''} />
                  <span>{isRefreshingMarket ? 'Đang tải...' : 'Làm mới giá'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* 1. Đơn giá thị trường */}
                <div className="bg-white/90 p-2 sm:p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-semibold mb-0.5 truncate">
                    Đơn giá TT ({isStockType ? detectedStockTicker || 'Mã CP' : isGoldLuong ? 'DOJI/Lượng' : 'DOJI/Chỉ'})
                  </div>
                  <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 truncate">
                    {formEffectiveUnitPrice > 0 ? formatVND(formEffectiveUnitPrice) : 'Chưa có giá'}
                  </div>
                  <div className="text-[9px] sm:text-[9.5px] text-slate-400 font-medium">
                    {isStockType ? 'HOSE/HNX trực tuyến' : 'DOJI Thu mua'}
                  </div>
                </div>

                {/* 2. Giá trị thị trường thực tế */}
                <div className="bg-white/90 p-2 sm:p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-semibold mb-0.5 truncate">
                    Giá trị TT (SL × Giá)
                  </div>
                  <div className="text-xs sm:text-[13px] font-extrabold text-emerald-700 truncate">
                    {formatVND(formMarketTotalValue || currentAssetAmount)}
                  </div>
                  <div className="text-[9px] sm:text-[9.5px] text-slate-400 font-medium truncate">
                    {formQty > 0 ? `${formatNumberString(formQty)} ${isStockType ? 'CP' : goldUnitName}` : 'Chờ số lượng'}
                  </div>
                </div>

                {/* 3. Giá vốn ban đầu */}
                <div className="bg-white/90 p-2 sm:p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-semibold mb-0.5 truncate">
                    Tổng giá vốn
                  </div>
                  <div className="text-xs sm:text-[13px] font-extrabold text-slate-800 truncate">
                    {formTotalCost > 0 ? formatVND(formTotalCost) : '0 đ'}
                  </div>
                  <div className="text-[9px] sm:text-[9.5px] text-slate-400 font-medium truncate">
                    {formUnitCost > 0 ? `Vốn TB: ${formatVND(formUnitCost)}` : 'Chưa nhập vốn'}
                  </div>
                </div>

                {/* 4. Lãi / Lỗ ròng (P&L) */}
                <div className={`p-2 sm:p-2.5 rounded-lg border shadow-2xs ${
                  formTotalCost > 0 && currentAssetAmount > 0
                    ? isFormGain
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-rose-50 border-rose-300'
                    : 'bg-white/90 border-slate-200/70'
                }`}>
                  <div className="text-[10px] text-slate-500 font-semibold mb-0.5 truncate">
                    Lợi nhuận (P&L)
                  </div>
                  {formTotalCost > 0 && currentAssetAmount > 0 ? (
                    <>
                      <div className={`text-xs sm:text-[13px] font-extrabold flex items-center gap-0.5 truncate ${
                        isFormGain ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {isFormGain ? <TrendingUp size={12} className="shrink-0" /> : <TrendingDown size={12} className="shrink-0" />}
                        <span className="truncate">{isFormGain ? '+' : ''}{formatVND(formPnlDiff)}</span>
                      </div>
                      <div className={`text-[9.5px] sm:text-[10px] font-bold ${isFormGain ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isFormGain ? '+' : ''}{formPnlPct.toFixed(2)}%
                      </div>
                    </>
                  ) : (
                    <div className="text-[10.5px] font-semibold text-slate-400 pt-0.5">
                      Nhập vốn & SL
                    </div>
                  )}
                </div>
              </div>

              {/* Quick apply button if auto-calc was toggled off */}
              {!autoSyncMarketPrice && formMarketTotalValue > 0 && (
                <div className="mt-2 flex items-center justify-between bg-white/95 p-2 rounded-lg border border-slate-200">
                  <span className="text-[10.5px] sm:text-[11px] font-semibold text-slate-700">
                    Giá trị tính theo thị trường: <strong className="text-emerald-700">{formatVND(formMarketTotalValue)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAmountStr(formatNumberString(formMarketTotalValue));
                      setAutoSyncMarketPrice(true);
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] sm:text-[10.5px] rounded-lg shadow-2xs cursor-pointer"
                  >
                    ⚡ Áp dụng giá trị này
                  </button>
                </div>
              )}
            </div>
          )}

          {savingMaturityInterest > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-emerald-800 font-semibold leading-snug">
              💡 Lãi dự kiến nhận khi đáo hạn: <span className="font-bold">{formatVND(savingMaturityInterest)}</span>
            </div>
          )}

          {stockYearlyDiv > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-blue-900 font-semibold leading-snug">
              💰 Cổ tức tiền mặt dự kiến: <span className="font-bold">{formatVND(stockYearlyDiv)} / năm</span> (≈{' '}
              {formatVND(Math.round(stockYearlyDiv / 12))} / tháng)
            </div>
          )}

          <div className="flex items-center space-x-2 sm:space-x-3 pt-1.5 sm:pt-2">
            <button
              type="submit"
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 sm:py-3 rounded-xl transition cursor-pointer shadow-sm"
            >
              {editingId ? '✓ Cập Nhật Thay Đổi' : '+ Thêm Vào Danh Mục'}
            </button>
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-4 sm:px-5 py-2.5 sm:py-3 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </form>
          </div>
        </div>
      )}

      {/* Asset Table Container */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3 bg-white">
          <div
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer select-none min-w-0 flex-1"
            onClick={() => setShowTable(!showTable)}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
              {showTable ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                  Danh Mục Tài Sản Quản Lý
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0 whitespace-nowrap">
                  {db.assets.length} mục
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                Kiểm soát lãi suất, kỳ hạn và dòng tiền định kỳ
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowTable(!showTable)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] sm:text-xs px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{showTable ? 'Thu Gọn' : 'Xem Chi Tiết'}</span>
          </button>
        </div>

        {showTable && (
          <div className="border-t border-slate-100 p-2.5 sm:p-5 pt-2 sm:pt-3 space-y-3 sm:space-y-4">
            {/* Toolbar: Chế độ hiển thị, Mở/Thu gọn tất cả & Sắp xếp */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* View Mode Toggle */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'grouped'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Gom Theo Ngân Hàng</span>
                  {bankGroups.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-bold">
                      {bankGroups.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setViewMode('flat')}
                  className={`px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'flat'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Danh Sách Toàn Bộ</span>
                </button>
              </div>

              {/* Right controls: Group Savings toggle in flat mode & Sort */}
              <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 flex-wrap">
                {viewMode === 'flat' && savingAssets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGroupSavingsInFlat(!groupSavingsInFlat)}
                    className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10.5px] sm:text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      groupSavingsInFlat
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800'
                    }`}
                    title="Gom các sổ tiết kiệm cùng ngân hàng thành 1 dòng như dòng bình thường"
                  >
                    <Landmark className="w-3 h-3 text-blue-600" />
                    <span>Gom TK cùng ngân hàng</span>
                    <span
                      className={`px-1 rounded text-[9px] font-bold ${
                        groupSavingsInFlat ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {bankGroups.length} bank
                    </span>
                  </button>
                )}

                <div className="flex items-center space-x-1">
                  <span className="text-[10.5px] font-semibold text-slate-600 hidden sm:inline">Sắp xếp:</span>
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as any)}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="default">Mặc định</option>
                    <option value="value-desc">Giá trị giảm dần</option>
                    <option value="value-asc">Giá trị tăng dần</option>
                    <option value="name-asc">Tên tài sản (A → Z)</option>
                    <option value="level">Tầng tháp (Tầng 1 → 3)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CHẾ ĐỘ 1: GOM NHÓM THEO NGÂN HÀNG & LỚP TÀI SẢN */}
            {viewMode === 'grouped' && (
              <div className="space-y-3">
                {/* 1.1. PHẦN SỔ TIẾT KIỆM (GOM 1 MỤC DUY NHẤT - MẶC ĐỊNH THU GỌN) */}
                {savingAssets.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden transition-all duration-150 hover:border-blue-300">
                    {/* Header đơn gom 1 dòng: Click để mở/đóng */}
                    <div
                      onClick={() => setIsSavingsOpen(!isSavingsOpen)}
                      className="py-2 px-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-white hover:bg-slate-100/80 transition cursor-pointer select-none flex flex-wrap items-center justify-between gap-2 border-b border-transparent"
                      style={{ borderBottomColor: isSavingsOpen ? '#e2e8f0' : 'transparent' }}
                    >
                      {/* Left: Tên mục + Huy hiệu tổng số sổ */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">🏛️</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-xs sm:text-[13px] font-black text-slate-900 tracking-tight">
                            Sổ Tiết Kiệm Theo Ngân Hàng
                          </h4>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200/60 shrink-0">
                            {savingAssets.length} sổ
                          </span>
                        </div>
                      </div>

                      {/* Right: Tổng gốc & Tổng lãi hết hạn + Nút mũi tên */}
                      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 ml-auto">
                        <div className="text-right">
                          <div className="text-[9.5px] text-slate-400 font-medium leading-none">Tổng gốc</div>
                          <div className="text-xs sm:text-[13px] font-black text-slate-900 mt-0.5 leading-tight">
                            {formatVND(totalSavingPrincipal, isPrivacyMode)}
                          </div>
                        </div>

                        <div className="text-right pl-2 sm:pl-3 border-l border-slate-200">
                          <div className="text-[9.5px] text-blue-600 font-bold leading-none">Lãi hết hạn</div>
                          <div className="text-xs sm:text-[13px] font-black text-blue-600 mt-0.5 leading-tight">
                            +{formatVND(totalSavingInterest, isPrivacyMode)}
                          </div>
                          <span className="text-[9px] text-slate-400 font-normal hidden lg:inline">
                            (≈ +{formatVND(totalSavingMonthly, isPrivacyMode)}/th)
                          </span>
                        </div>

                        <div className="p-1 rounded-md bg-blue-100/70 text-blue-700 hover:bg-blue-200 transition ml-0.5 flex items-center gap-1 text-[11px] font-bold">
                          <span className="hidden sm:inline text-[10px]">{isSavingsOpen ? 'Thu gọn' : 'Xem chi tiết'}</span>
                          {isSavingsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>

                    {/* Danh sách chi tiết các sổ tiết kiệm khi mở */}
                    {isSavingsOpen && (
                      <div className="bg-slate-50/50 border-t border-slate-200">
                        {/* Control toolbar: Chuyển đổi giữa Gom theo Ngân Hàng và Xem từng sổ */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-100/80 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-700">Chế độ xem:</span>
                            <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => setSavingsRowMode('byBank')}
                                className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                                  savingsRowMode === 'byBank'
                                    ? 'bg-white text-blue-900 shadow-2xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <span>🏛️ Gom theo Ngân Hàng ({bankGroups.length} bank)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSavingsRowMode('flat')}
                                className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                                  savingsRowMode === 'flat'
                                    ? 'bg-white text-blue-900 shadow-2xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <span>📄 Xem từng sổ ({savingAssets.length})</span>
                              </button>
                            </div>
                          </div>

                          {savingsRowMode === 'byBank' && (
                            <div className="flex items-center gap-2 text-[10.5px]">
                              <button
                                type="button"
                                onClick={() => toggleAllBanks(true)}
                                className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                              >
                                Mở tất cả sổ
                              </button>
                              <span className="text-slate-300">•</span>
                              <button
                                type="button"
                                onClick={() => toggleAllBanks(false)}
                                className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                              >
                                Thu gọn tất cả
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="p-1.5 sm:p-2.5">
                          {/* MOBILE VIEW (< md) */}
                          <div className="md:hidden space-y-2">
                            {savingsRowMode === 'byBank' ? (
                              bankGroups.map((bg, bIdx) => {
                                const isExpanded = !!expandedBankKeys[bg.bankKey];
                                return (
                                  <div
                                    key={bg.bankKey}
                                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs"
                                  >
                                    {/* Dòng tóm tắt ngân hàng - như dòng bình thường */}
                                    <div
                                      onClick={() => toggleBankExpand(bg.bankKey)}
                                      className="p-2.5 bg-gradient-to-r from-blue-50/60 via-white to-white cursor-pointer select-none space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span className="text-base shrink-0">{bg.bankIcon}</span>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-xs font-black text-slate-900 truncate">
                                                {bg.bankName}
                                              </span>
                                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 shrink-0">
                                                {bg.count} sổ
                                              </span>
                                            </div>
                                            <div className="text-[9.5px] text-emerald-700 font-bold">
                                              TB: {bg.weightedRate}%/năm
                                            </div>
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <div className="text-xs font-black text-slate-900">
                                            {formatVND(bg.totalPrincipal, isPrivacyMode)}
                                          </div>
                                          {bg.totalMaturityInterest > 0 && (
                                            <div className="text-[10px] font-bold text-blue-600">
                                              +{formatVND(bg.totalMaturityInterest, isPrivacyMode)}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[9.5px]">
                                        {bg.nearestMaturityDate ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                            <Calendar className="w-2.5 h-2.5 text-amber-700" />
                                            <span>Đáo hạn gần nhất: {bg.nearestMaturityDate}</span>
                                            {bg.daysToNearestMaturity !== undefined && (
                                              <span className="font-normal text-amber-700">
                                                ({bg.daysToNearestMaturity > 0 ? `còn ${bg.daysToNearestMaturity} ngày` : 'đến hạn'})
                                              </span>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">Chưa có ngày đáo hạn</span>
                                        )}

                                        <button
                                          type="button"
                                          className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5"
                                        >
                                          <span>{isExpanded ? 'Thu gọn' : `Xem ${bg.count} sổ`}</span>
                                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Các sổ chi tiết khi mở rộng ngân hàng */}
                                    {isExpanded && (
                                      <div className="p-2 bg-slate-50 border-t border-slate-200 space-y-1.5">
                                        {bg.assets.map((a, sIdx) => {
                                          const totalInterest =
                                            a.rate && a.termMonths
                                              ? Math.round(a.amount * (a.rate / 100) * (a.termMonths / 12))
                                              : 0;
                                          const avgMonthly =
                                            a.rate && a.termMonths ? Math.round(totalInterest / a.termMonths) : 0;
                                          const matDate =
                                            formatDateVN(a.maturityDate) ||
                                            calculateMaturityDate(a.startDate, a.termMonths);

                                          return (
                                            <div
                                              key={a.id}
                                              className="bg-white rounded-lg border border-slate-200 p-2 space-y-1 shadow-2xs text-xs"
                                            >
                                              <div className="flex items-center justify-between gap-1">
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                  <span className="w-3.5 h-3.5 rounded bg-blue-50 text-blue-700 text-[8.5px] font-black flex items-center justify-center shrink-0">
                                                    {sIdx + 1}
                                                  </span>
                                                  <span className="text-xs font-bold text-slate-900 truncate">
                                                    {a.name}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <button
                                                    onClick={() => {
                                                      setSelectedHistoryAsset(a);
                                                      setShowHistoryModal(true);
                                                    }}
                                                    className="p-1 text-blue-600 bg-blue-50/80 hover:bg-blue-100 rounded-md transition cursor-pointer"
                                                    title="Lịch sử Mua/Gom/Gửi"
                                                  >
                                                    <History className="w-3 h-3" />
                                                  </button>
                                                  <button
                                                    onClick={() => handleEdit(a)}
                                                    className="p-1 text-amber-600 bg-amber-50/80 hover:bg-amber-100 rounded-md transition cursor-pointer"
                                                    title="Sửa"
                                                  >
                                                    <Pen className="w-3 h-3" />
                                                  </button>
                                                  <button
                                                    onClick={() => setAssetToDelete({ id: a.id, name: a.name })}
                                                    className="p-1 text-rose-500 bg-rose-50/80 hover:bg-rose-100 rounded-md transition cursor-pointer"
                                                    title="Xóa"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                                <div>
                                                  <div className="text-xs font-black text-slate-900">
                                                    {formatVND(a.amount, isPrivacyMode)}
                                                  </div>
                                                  <div className="text-[9.5px] text-slate-500 font-medium">
                                                    {a.termMonths ? `${a.termMonths}T` : '—'} • {a.rate ? `${a.rate}%/n` : '—'}
                                                  </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                  {totalInterest > 0 && (
                                                    <div className="text-[10.5px] font-black text-blue-600">
                                                      +{formatVND(totalInterest, isPrivacyMode)}
                                                    </div>
                                                  )}
                                                  {avgMonthly > 0 && (
                                                    <div className="text-[9px] text-slate-400">
                                                      ≈ +{formatVND(avgMonthly, isPrivacyMode)}/th
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {(a.startDate || matDate) && (
                                                <div className="pt-0.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[8.5px] text-slate-500">
                                                  {a.startDate && (
                                                    <span className="inline-flex items-center gap-1">
                                                      <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                                      Gửi: <span className="font-semibold text-slate-700">{formatDateVN(a.startDate)}</span>
                                                    </span>
                                                  )}
                                                  {matDate && (
                                                    <span className="font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                                      Đáo hạn: {matDate}
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              savingAssets.map((a, idx) => {
                                const totalInterest =
                                  a.rate && a.termMonths
                                    ? Math.round(a.amount * (a.rate / 100) * (a.termMonths / 12))
                                    : 0;
                                const avgMonthly =
                                  a.rate && a.termMonths ? Math.round(totalInterest / a.termMonths) : 0;
                                const matDate =
                                  formatDateVN(a.maturityDate) || calculateMaturityDate(a.startDate, a.termMonths);

                                return (
                                  <div
                                    key={a.id}
                                    className="bg-white rounded-md border border-slate-200 p-2 space-y-1 shadow-2xs text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="w-3.5 h-3.5 rounded bg-blue-50 text-blue-700 text-[8.5px] font-black flex items-center justify-center shrink-0">
                                          {idx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-slate-900 truncate">{a.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => {
                                            setSelectedHistoryAsset(a);
                                            setShowHistoryModal(true);
                                          }}
                                          className="p-1 text-blue-600 bg-blue-50/80 hover:bg-blue-100 rounded-md transition cursor-pointer"
                                          title="Lịch sử Mua/Gom/Gửi"
                                        >
                                          <History className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleEdit(a)}
                                          className="p-1 text-amber-600 bg-amber-50/80 hover:bg-amber-100 rounded-md transition cursor-pointer"
                                          title="Sửa"
                                        >
                                          <Pen className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setAssetToDelete({ id: a.id, name: a.name })}
                                          className="p-1 text-rose-500 bg-rose-50/80 hover:bg-rose-100 rounded-md transition cursor-pointer"
                                          title="Xóa"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                      <div>
                                        <div className="text-xs font-black text-slate-900">
                                          {formatVND(a.amount, isPrivacyMode)}
                                        </div>
                                        <div className="text-[9.5px] text-slate-500 font-medium">
                                          {a.termMonths ? `${a.termMonths}T` : '—'} • {a.rate ? `${a.rate}%/n` : '—'}
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        {totalInterest > 0 && (
                                          <div className="text-[10.5px] font-black text-blue-600">
                                            +{formatVND(totalInterest, isPrivacyMode)}
                                          </div>
                                        )}
                                        {avgMonthly > 0 && (
                                          <div className="text-[9px] text-slate-400">
                                            ≈ +{formatVND(avgMonthly, isPrivacyMode)}/th
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {(a.startDate || matDate) && (
                                      <div className="pt-0.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[8.5px] text-slate-500">
                                        {a.startDate && (
                                          <span className="inline-flex items-center gap-1">
                                            <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                            Gửi: <span className="font-semibold text-slate-700">{formatDateVN(a.startDate)}</span>
                                          </span>
                                        )}
                                        {matDate && (
                                          <span className="font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                            Đáo hạn: {matDate}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* DESKTOP TABLE (>= md) */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                                  <th className="py-2 px-2 text-center w-10">STT</th>
                                  <th className="py-2 px-2">
                                    {savingsRowMode === 'byBank' ? 'Ngân Hàng & Sổ Tiết Kiệm' : 'Tên Sổ Tiết Kiệm'}
                                  </th>
                                  <th className="py-2 px-2 text-center">Ngày Gửi</th>
                                  <th className="py-2 px-2 text-center">Kỳ Hạn & Lãi Suất</th>
                                  <th className="py-2 px-2 text-center">
                                    {savingsRowMode === 'byBank' ? 'Ngày Đáo Hạn Gần Nhất' : 'Ngày Đáo Hạn'}
                                  </th>
                                  <th className="py-2 px-2 text-right">Tổng Tiền Gốc</th>
                                  <th className="py-2 px-2 text-right">Lãi Hết Hạn & Tháng</th>
                                  <th className="py-2 px-2 text-center w-24">Thao Tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 text-slate-700 bg-white text-[11px]">
                                {savingsRowMode === 'byBank' ? (
                                  bankGroups.map((bg, bIdx) => {
                                    const isExpanded = !!expandedBankKeys[bg.bankKey];
                                    return (
                                      <React.Fragment key={bg.bankKey}>
                                        {/* Dòng ngân hàng tóm tắt - như dòng bình thường thôi */}
                                        <tr
                                          onClick={() => toggleBankExpand(bg.bankKey)}
                                          className={`cursor-pointer transition border-b border-slate-200 ${
                                            isExpanded
                                              ? 'bg-blue-50/80 font-semibold'
                                              : 'hover:bg-blue-50/30'
                                          }`}
                                        >
                                          <td className="py-2 px-2 text-center font-bold text-slate-500">
                                            {bIdx + 1}
                                          </td>
                                          <td className="py-2 px-2">
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleBankExpand(bg.bankKey);
                                                }}
                                                className="p-1 rounded hover:bg-blue-100 text-blue-700 transition"
                                                title={isExpanded ? 'Thu gọn' : 'Xem các sổ'}
                                              >
                                                {isExpanded ? (
                                                  <ChevronUp className="w-3.5 h-3.5" />
                                                ) : (
                                                  <ChevronDown className="w-3.5 h-3.5" />
                                                )}
                                              </button>
                                              <span className="text-base">{bg.bankIcon}</span>
                                              <div>
                                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                                  <span>{bg.bankName}</span>
                                                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200/60">
                                                    {bg.count} sổ
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-2 px-2 text-center text-slate-600">
                                            <span className="inline-flex items-center gap-1 font-medium text-slate-700 text-[10.5px]">
                                              <Landmark className="w-3 h-3 text-blue-500" />
                                              <span>{bg.count} sổ</span>
                                            </span>
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            <div className="font-bold text-emerald-700 text-xs">
                                              TB: {bg.weightedRate}%/năm
                                            </div>
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            {bg.nearestMaturityDate ? (
                                              <div className="inline-flex flex-col items-center">
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-900 border border-amber-300 text-[10.5px]">
                                                  <Calendar className="w-2.5 h-2.5 text-amber-700" />
                                                  <span>Gần nhất: {bg.nearestMaturityDate}</span>
                                                </span>
                                                {bg.daysToNearestMaturity !== undefined && (
                                                  <span
                                                    className={`text-[9px] font-medium mt-0.5 ${
                                                      bg.daysToNearestMaturity <= 30
                                                        ? 'text-rose-600 font-bold'
                                                        : 'text-slate-500'
                                                    }`}
                                                  >
                                                    {bg.daysToNearestMaturity > 0
                                                      ? `(còn ${bg.daysToNearestMaturity} ngày)`
                                                      : '(đến hạn)'}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              '—'
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-right font-black text-slate-900 text-xs">
                                            {formatVND(bg.totalPrincipal, isPrivacyMode)}
                                          </td>
                                          <td className="py-2 px-2 text-right">
                                            {bg.totalMaturityInterest > 0 ? (
                                              <div>
                                                <div className="font-bold text-blue-600 text-xs">
                                                  +{formatVND(bg.totalMaturityInterest, isPrivacyMode)}
                                                </div>
                                                {bg.avgMonthlyInterest > 0 && (
                                                  <div className="text-[9.5px] text-slate-400">
                                                    ≈ +{formatVND(bg.avgMonthlyInterest, isPrivacyMode)}/th
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              '—'
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleBankExpand(bg.bankKey);
                                              }}
                                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                                            >
                                              <span>{isExpanded ? 'Thu gọn' : `Chi tiết (${bg.count})`}</span>
                                              {isExpanded ? (
                                                <ChevronUp className="w-3 h-3" />
                                              ) : (
                                                <ChevronDown className="w-3 h-3" />
                                              )}
                                            </button>
                                          </td>
                                        </tr>

                                        {/* Các dòng con khi người dùng mở rộng ngân hàng */}
                                        {isExpanded &&
                                          bg.assets.map((a, sIdx) => {
                                            const totalInterest =
                                              a.rate && a.termMonths
                                                ? Math.round(a.amount * (a.rate / 100) * (a.termMonths / 12))
                                                : 0;
                                            const avgMonthly =
                                              a.rate && a.termMonths
                                                ? Math.round(totalInterest / a.termMonths)
                                                : 0;
                                            const matDate =
                                              formatDateVN(a.maturityDate) ||
                                              calculateMaturityDate(a.startDate, a.termMonths);

                                            return (
                                              <tr
                                                key={a.id}
                                                className="bg-slate-50/70 hover:bg-blue-50/40 transition border-l-4 border-l-blue-400"
                                              >
                                                <td className="py-1.5 px-2 text-center font-medium text-[10px] text-slate-400">
                                                  {bIdx + 1}.{sIdx + 1}
                                                </td>
                                                <td className="py-1.5 px-2 pl-6">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-slate-300 text-xs">└─</span>
                                                    <div className="font-semibold text-slate-800 text-[11px]">
                                                      {a.name}
                                                    </div>
                                                  </div>
                                                  {a.note && (
                                                    <div className="text-[9.5px] text-slate-400 pl-4">{a.note}</div>
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2 text-center text-slate-600">
                                                  {a.startDate ? (
                                                    <span className="inline-flex items-center gap-1 font-medium text-slate-700 text-[10.5px]">
                                                      <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                                      {formatDateVN(a.startDate)}
                                                    </span>
                                                  ) : (
                                                    '—'
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2 text-center text-[10.5px]">
                                                  <span className="font-semibold text-slate-800">
                                                    {a.termMonths ? `${a.termMonths} tháng` : '—'}
                                                  </span>
                                                  {a.rate && (
                                                    <span className="text-emerald-700 font-bold ml-1">
                                                      ({a.rate}%/n)
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2 text-center">
                                                  {matDate ? (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-semibold bg-amber-50 text-amber-900 border border-amber-200 text-[10px]">
                                                      <Calendar className="w-2.5 h-2.5 text-amber-700" />
                                                      {matDate}
                                                    </span>
                                                  ) : (
                                                    '—'
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2 text-right font-bold text-slate-900 text-[11px]">
                                                  {formatVND(a.amount, isPrivacyMode)}
                                                </td>
                                                <td className="py-1.5 px-2 text-right">
                                                  {totalInterest > 0 ? (
                                                    <div>
                                                      <div className="font-bold text-blue-600 text-[10.5px]">
                                                        +{formatVND(totalInterest, isPrivacyMode)}
                                                      </div>
                                                      <div className="text-[9px] text-slate-400">
                                                        ≈ +{formatVND(avgMonthly, isPrivacyMode)}/th
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    '—'
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2 text-center">
                                                  <div className="flex items-center justify-center gap-1">
                                                    <button
                                                      onClick={() => {
                                                        setSelectedHistoryAsset(a);
                                                        setShowHistoryModal(true);
                                                      }}
                                                      className="p-1 text-blue-600 bg-blue-50/80 hover:bg-blue-100 rounded-md transition cursor-pointer"
                                                      title="Lịch sử Mua/Gom/Gửi"
                                                    >
                                                      <History className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      onClick={() => handleEdit(a)}
                                                      className="p-1 text-amber-600 bg-amber-50/80 hover:bg-amber-100 rounded-md transition cursor-pointer"
                                                      title="Sửa"
                                                    >
                                                      <Pen className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      onClick={() => setAssetToDelete({ id: a.id, name: a.name })}
                                                      className="p-1 text-rose-500 bg-rose-50/80 hover:bg-rose-100 rounded-md transition cursor-pointer"
                                                      title="Xóa"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                      </React.Fragment>
                                    );
                                  })
                                ) : (
                                  savingAssets.map((a, idx) => {
                                    const totalInterest =
                                      a.rate && a.termMonths
                                        ? Math.round(a.amount * (a.rate / 100) * (a.termMonths / 12))
                                        : 0;
                                    const avgMonthly =
                                      a.rate && a.termMonths ? Math.round(totalInterest / a.termMonths) : 0;
                                    const matDate =
                                      formatDateVN(a.maturityDate) ||
                                      calculateMaturityDate(a.startDate, a.termMonths);

                                    return (
                                      <tr key={a.id} className="hover:bg-blue-50/40 transition">
                                        <td className="py-1 px-2 text-center font-bold text-slate-400">
                                          {idx + 1}
                                        </td>
                                        <td className="py-1 px-2">
                                          <div className="font-bold text-slate-900">{a.name}</div>
                                          {a.note && <div className="text-[9.5px] text-slate-400">{a.note}</div>}
                                        </td>
                                        <td className="py-1 px-2 text-center text-slate-600">
                                          {a.startDate ? (
                                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                              <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                              {formatDateVN(a.startDate)}
                                            </span>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="py-1 px-2 text-center">
                                          <span className="font-semibold text-slate-800">
                                            {a.termMonths ? `${a.termMonths} tháng` : '—'}
                                          </span>
                                          {a.rate && (
                                            <span className="text-emerald-700 font-bold ml-1">
                                              ({a.rate}%/n)
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-1 px-2 text-center">
                                          {matDate ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-900 border border-amber-300 text-[10.5px]">
                                              <Calendar className="w-2.5 h-2.5 text-amber-700" />
                                              {matDate}
                                            </span>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="py-1 px-2 text-right font-black text-slate-900">
                                          {formatVND(a.amount, isPrivacyMode)}
                                        </td>
                                        <td className="py-1 px-2 text-right">
                                          {totalInterest > 0 ? (
                                            <div>
                                              <div className="font-bold text-blue-600">
                                                +{formatVND(totalInterest, isPrivacyMode)}
                                              </div>
                                              <div className="text-[9.5px] text-slate-400">
                                                ≈ +{formatVND(avgMonthly, isPrivacyMode)}/th
                                              </div>
                                            </div>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="py-1 px-2 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              onClick={() => {
                                                setSelectedHistoryAsset(a);
                                                setShowHistoryModal(true);
                                              }}
                                              className="p-1 text-blue-600 bg-blue-50/80 hover:bg-blue-100 rounded-md transition cursor-pointer"
                                              title="Lịch sử Mua/Gom/Gửi"
                                            >
                                              <History className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => handleEdit(a)}
                                              className="p-1 text-amber-600 bg-amber-50/80 hover:bg-amber-100 rounded-md transition cursor-pointer"
                                              title="Sửa"
                                            >
                                              <Pen className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => setAssetToDelete({ id: a.id, name: a.name })}
                                              className="p-1 text-rose-500 bg-rose-50/80 hover:bg-rose-100 rounded-md transition cursor-pointer"
                                              title="Xóa"
                                            >
                                              <Trash2 className="w-3 h-3" />
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
                      </div>
                    )}
                  </div>
                )}

                {/* 1.2. PHẦN CÁC LỚP TÀI SẢN KHÁC (CỔ PHIẾU, BĐS, VÀNG, TIỀN MẶT, V.V.) */}
                {nonSavingAssets.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                      <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Các Danh Mục Tài Sản Khác</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700">
                          {nonSavingAssets.length} mục
                        </span>
                      </h4>
                    </div>

                    {/* Mobile Cards for Non-Saving Assets - Ultra-compact with Start Date */}
                    <div className="md:hidden space-y-1.5">
                      {nonSavingAssets.map((a, index) => {
                        const levelBadge =
                          a.level === '1'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.level === '2'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800';
                        const categoryName = assetTypeLabels[a.type] || 'Tài Sản Khác';

                        let pnlMobile = null;
                        if (a.costPrice && a.costPrice > 0) {
                          const diff = a.amount - a.costPrice;
                          const pct = ((diff / a.costPrice) * 100).toFixed(1);
                          const isGain = diff >= 0;
                          pnlMobile = (
                            <span className={`text-[9.5px] font-bold ${isGain ? 'text-emerald-600' : 'text-rose-600'}`}>
                              ({isGain ? '+' : ''}{pct}%)
                            </span>
                          );
                        }

                        let leftSubDetail = null;
                        if (a.type === 'stock') {
                          const qty = a.quantity || 0;
                          const avgCost = a.costPrice && qty > 0 ? Math.round(a.costPrice / qty) : (a.unitPrice || 0);
                          const mktPrice = a.amount && qty > 0 ? Math.round(a.amount / qty) : 0;
                          leftSubDetail = (
                            <div className="text-[9.5px] text-slate-500 font-medium mt-0.5 space-y-0.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                {qty > 0 && <span className="font-bold text-slate-800">{formatNumberString(qty)} CP</span>}
                                {avgCost > 0 && <span className="text-slate-600">• Vốn TB: <strong className="text-slate-900">{formatVND(avgCost)}/CP</strong></span>}
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-blue-700 font-semibold">
                                {mktPrice > 0 && <span>Giá TT: {formatVND(mktPrice)}/CP</span>}
                                {pnlMobile}
                              </div>
                            </div>
                          );
                        } else if (a.type === 'gold') {
                          const qty = a.quantity || 0;
                          const avgCost = a.costPrice && qty > 0 ? Math.round(a.costPrice / qty) : (a.unitPrice || 0);
                          const mktPrice = a.amount && qty > 0 ? Math.round(a.amount / qty) : 0;
                          leftSubDetail = (
                            <div className="text-[9.5px] text-slate-500 font-medium mt-0.5 space-y-0.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                {qty > 0 && <span className="font-bold text-amber-900">{formatNumberString(qty)} chỉ</span>}
                                {avgCost > 0 && <span className="text-slate-600">• Vốn TB: <strong className="text-slate-900">{formatVND(avgCost)}/chỉ</strong></span>}
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-blue-700 font-semibold">
                                {mktPrice > 0 && <span>Giá TT: {formatVND(mktPrice)}/chỉ</span>}
                                {pnlMobile}
                              </div>
                            </div>
                          );
                        } else if (a.type === 'bond' || a.type === 'peer_lending') {
                          leftSubDetail = (
                            <div className="text-[9.5px] text-slate-500 font-medium mt-0.5 space-y-0.5">
                              <div>{a.termMonths ? `Hạn: ${a.termMonths}T • ` : ''}{a.rate ? `Lãi: ${a.rate}%/n` : ''}</div>
                              {a.startDate && (
                                <div className="text-slate-600 font-semibold flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Bắt đầu: <strong className="text-slate-900">{formatDateVN(a.startDate)}</strong></span>
                                </div>
                              )}
                            </div>
                          );
                        } else if (a.type === 'realestate_land' || a.type === 'realestate_rent' || a.type === 'realestate_live' || a.type === 'realestate_accumulate') {
                          leftSubDetail = (
                            <div className="text-[9.5px] text-slate-500 font-medium mt-0.5 space-y-0.5">
                              {a.startDate ? (
                                <div className="text-slate-700 font-semibold flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Ngày mua/sở hữu: <strong className="text-slate-900">{formatDateVN(a.startDate)}</strong></span>
                                </div>
                              ) : <div>Bất động sản</div>}
                              {a.costPrice && a.costPrice > 0 && <div>Giá vốn mua: <strong className="text-slate-800">{formatVND(a.costPrice)}</strong> {pnlMobile}</div>}
                            </div>
                          );
                        } else if (a.type === 'private_equity' || a.type === 'crypto') {
                          leftSubDetail = (
                            <div className="text-[9.5px] text-slate-500 font-medium mt-0.5 space-y-0.5">
                              {a.startDate && (
                                <div className="text-slate-700 font-semibold flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Bắt đầu: <strong className="text-slate-900">{formatDateVN(a.startDate)}</strong></span>
                                </div>
                              )}
                              {a.costPrice && a.costPrice > 0 && <div>Giá vốn: <strong className="text-slate-800">{formatVND(a.costPrice)}</strong> {pnlMobile}</div>}
                            </div>
                          );
                        }

                        let rightCol = null;
                        if (a.type === 'realestate_rent' || a.type === 'private_equity' || a.type === 'peer_lending') {
                          if (a.cashflow) {
                            rightCol = (
                              <div className="text-right shrink-0">
                                <div className="text-xs font-black text-emerald-600 leading-tight">
                                  +{formatVND(a.cashflow, isPrivacyMode)}/th
                                </div>
                                <div className="text-[9px] text-slate-400 font-medium mt-0.5">Dòng tiền thu</div>
                              </div>
                            );
                          }
                        } else if (a.type === 'stock' && a.quantity && a.divCash) {
                          const mDiv = Math.round((a.quantity * a.divCash) / 12);
                          rightCol = (
                            <div className="text-right shrink-0">
                              <div className="text-xs font-black text-emerald-600 leading-tight">
                                +{formatVND(mDiv, isPrivacyMode)}/th
                              </div>
                              <div className="text-[9px] text-slate-400 font-medium mt-0.5">Cổ tức tiền</div>
                            </div>
                          );
                        }

                        return (
                          <div key={a.id} className="bg-white hover:bg-slate-50/80 rounded-lg border border-slate-200/90 p-2.5 space-y-1.5 transition shadow-2xs text-xs">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="w-3.5 h-3.5 rounded bg-slate-100 text-slate-600 text-[8.5px] font-black flex items-center justify-center shrink-0">
                                  {index + 1}
                                </span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${levelBadge}`}>
                                  T{a.level}
                                </span>
                                <span className="text-xs font-bold text-slate-900 truncate">{a.name}</span>
                                <span className="text-[9.5px] text-slate-400 font-normal truncate">({categoryName})</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setSelectedHistoryAsset(a);
                                    setShowHistoryModal(true);
                                  }}
                                  className="p-1 text-blue-600 bg-blue-50/80 hover:bg-blue-100 rounded-md transition cursor-pointer"
                                  title="Lịch sử Mua/Gom"
                                >
                                  <History className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleEdit(a)}
                                  className="p-1 text-amber-600 bg-amber-50/80 hover:bg-amber-100 rounded-md transition cursor-pointer"
                                  title="Sửa"
                                >
                                  <Pen className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setAssetToDelete({ id: a.id, name: a.name })}
                                  className="p-1 text-rose-500 bg-rose-50/80 hover:bg-rose-100 rounded-md transition cursor-pointer"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 tracking-tight leading-tight">
                                  {formatVND(a.amount, isPrivacyMode)}
                                </div>
                                {leftSubDetail}
                              </div>
                              {rightCol}
                            </div>

                            {/* Ngày gửi / Ngày bắt đầu / Ngày sở hữu - Gọn gàng thanh nhã */}
                            {a.startDate && (
                              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500">
                                <span className="inline-flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/80 font-medium">
                                  <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Bắt đầu/Mua:</span>
                                  <span className="font-bold text-slate-800">{formatDateVN(a.startDate)}</span>
                                </span>
                                {a.updatedAt && (
                                  <span className="text-slate-400 text-[8.5px]">Cập nhật: {a.updatedAt}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table for Non-Saving Assets - With Start Date Column */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/90 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                            <th className="py-1 px-2.5 text-center w-10">STT</th>
                            <th className="py-1 px-2.5">Tài Sản & Phân Loại</th>
                            <th className="py-1 px-2.5 text-center">Tầng</th>
                            <th className="py-1 px-2.5 text-center">Ngày Bắt Đầu / Mua</th>
                            <th className="py-1 px-2.5 text-right">Giá Trị & Hiệu Suất</th>
                            <th className="py-1 px-2.5 text-right">Dòng Tiền Chi Tiết</th>
                            <th className="py-1 px-2.5 text-center">Ngày Cập Nhật</th>
                            <th className="py-1 px-2.5 text-center w-20">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 bg-white text-[11px]">
                          {nonSavingAssets.map((a, index) => {
                            const levelBadge =
                              a.level === '1'
                                ? 'bg-emerald-100 text-emerald-800'
                                : a.level === '2'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800';
                            const categoryName = assetTypeLabels[a.type] || 'Tài Sản Khác';

                            const detailsList: string[] = [];
                            if (a.type === 'bond' || a.type === 'peer_lending') {
                              if (a.termMonths) detailsList.push(`Kỳ hạn: ${a.termMonths}T`);
                              if (a.rate) detailsList.push(`Lãi: ${a.rate}%/năm`);
                            } else if (a.type === 'stock') {
                              const qty = a.quantity || 0;
                              const avgCost = a.costPrice && qty > 0 ? Math.round(a.costPrice / qty) : (a.unitPrice || 0);
                              const mktPrice = a.amount && qty > 0 ? Math.round(a.amount / qty) : 0;
                              if (qty > 0) detailsList.push(`SL: ${formatNumberString(qty)} CP`);
                              if (avgCost > 0) detailsList.push(`Vốn TB: ${formatVND(avgCost)}/CP`);
                              if (mktPrice > 0) detailsList.push(`Giá TT: ${formatVND(mktPrice)}/CP`);
                            } else if (a.type === 'gold') {
                              const qty = a.quantity || 0;
                              const avgCost = a.costPrice && qty > 0 ? Math.round(a.costPrice / qty) : (a.unitPrice || 0);
                              const mktPrice = a.amount && qty > 0 ? Math.round(a.amount / qty) : 0;
                              if (qty > 0) detailsList.push(`SL: ${formatNumberString(qty)} chỉ`);
                              if (avgCost > 0) detailsList.push(`Vốn TB: ${formatVND(avgCost)}/chỉ`);
                              if (mktPrice > 0) detailsList.push(`Giá TT: ${formatVND(mktPrice)}/chỉ`);
                            } else if (a.type === 'realestate_rent') {
                              if (a.cashflow) detailsList.push(`Dòng tiền: +${formatVND(a.cashflow)}/th`);
                            }

                            let pnlHTML = null;
                            if (a.costPrice && a.costPrice > 0) {
                              const diff = a.amount - a.costPrice;
                              const pct = ((diff / a.costPrice) * 100).toFixed(1);
                              const isGain = diff >= 0;
                              pnlHTML = (
                                <div className={`text-[9.5px] font-bold ${isGain ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {isGain ? '+' : ''}
                                  {pct}% ({formatVND(diff)})
                                </div>
                              );
                            }

                            let cashflowDetail = <span className="text-slate-400">—</span>;
                            if (a.type === 'realestate_rent' || a.type === 'private_equity' || a.type === 'peer_lending') {
                              if (a.cashflow) {
                                cashflowDetail = (
                                  <div>
                                    <div className="font-bold text-emerald-600">+{formatVND(a.cashflow)}/tháng</div>
                                    <div className="text-[9.5px] text-slate-400">
                                      ≈ +{formatVND(Math.round(a.cashflow / 30))}/ngày
                                    </div>
                                  </div>
                                );
                              }
                            } else if (a.type === 'stock' && a.quantity && a.divCash) {
                              const mDiv = Math.round((a.quantity * a.divCash) / 12);
                              cashflowDetail = (
                                <div>
                                  <div className="font-bold text-emerald-600">+{formatVND(mDiv)}/tháng</div>
                                  <div className="text-[9.5px] text-slate-400">
                                    Năm: +{formatVND(a.quantity * a.divCash)}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <tr key={a.id} className="hover:bg-slate-50 transition">
                                <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{index + 1}</td>
                                <td className="py-1.5 px-2.5">
                                  <div className="font-bold text-slate-900">{a.name}</div>
                                  <div className="text-[9.5px] text-slate-500">{categoryName}</div>
                                  {detailsList.length > 0 && (
                                    <div className="text-[9.5px] text-slate-600 mt-1 flex flex-wrap items-center gap-1">
                                      {detailsList.map((item, i) => (
                                        <span key={i} className="inline-block bg-slate-100/90 text-slate-700 px-1.5 py-0.5 rounded font-medium border border-slate-200/60">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${levelBadge}`}>
                                    T{a.level}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  {a.startDate ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-slate-50 text-slate-700 border border-slate-200 text-[10.5px]">
                                      <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                                      {formatDateVN(a.startDate)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">—</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2.5 text-right">
                                  <div className="font-black text-slate-900">{formatVND(a.amount, isPrivacyMode)}</div>
                                  {pnlHTML}
                                </td>
                                <td className="py-1.5 px-2.5 text-right">{cashflowDetail}</td>
                                <td className="py-1.5 px-2.5 text-center text-[10px] text-slate-500">{a.updatedAt || 'Mới'}</td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => {
                                        setSelectedHistoryAsset(a);
                                        setShowHistoryModal(true);
                                      }}
                                      className="p-1 text-blue-600 bg-blue-50/80 hover:bg-blue-100 rounded-md transition cursor-pointer"
                                      title="Lịch sử Mua/Gom"
                                    >
                                      <History className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleEdit(a)}
                                      className="p-1 text-amber-600 bg-amber-50/80 hover:bg-amber-100 rounded-md transition cursor-pointer"
                                      title="Sửa"
                                    >
                                      <Pen className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => setAssetToDelete({ id: a.id, name: a.name })}
                                      className="p-1 text-rose-500 bg-rose-50/80 hover:bg-rose-100 rounded-md transition cursor-pointer"
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {db.assets.length === 0 && (
                  <div className="p-3 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Chưa có tài sản nào. Vui lòng thêm ở khung trên.
                  </div>
                )}
              </div>
            )}

            {/* CHẾ ĐỘ 2: DANH SÁCH TOÀN BỘ PHẲNG (FLAT LIST) - Compact */}
            {viewMode === 'flat' && (
              <div className="space-y-2">
                {/* 1. DEDICATED MOBILE VIEW (< md) - CLEAN COMPACT CARD LIST */}
                <div className="md:hidden space-y-1.5">
                  {flatItems.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      Chưa có tài sản nào. Vui lòng thêm ở khung trên.
                    </div>
                  ) : (
                    flatItems.map((item, index) => {
                      if (item.kind === 'bank') {
                        const bg = item.bankGroup;
                        const isExpanded = !!expandedFlatBanks[bg.bankKey];
                        return (
                          <div key={`bank-${bg.bankKey}`} className="bg-white rounded-lg border border-blue-200 overflow-hidden shadow-2xs text-xs">
                            {/* Bank Row Header */}
                            <div
                              onClick={() => toggleFlatBankExpand(bg.bankKey)}
                              className="p-2.5 bg-gradient-to-r from-blue-50/70 via-white to-white cursor-pointer select-none space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="w-3.5 h-3.5 rounded bg-blue-100 text-blue-800 text-[8.5px] font-black flex items-center justify-center shrink-0">
                                    {index + 1}
                                  </span>
                                  <span className="text-sm shrink-0">{bg.bankIcon}</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-black text-slate-900 truncate">{bg.bankName}</span>
                                      <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                                        {bg.count} sổ
                                      </span>
                                    </div>
                                    <div className="text-[9.5px] text-emerald-700 font-bold">
                                      TB lãi: {bg.weightedRate}%/năm
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="text-xs font-black text-slate-900 tracking-tight">
                                    {formatVND(bg.totalPrincipal, isPrivacyMode)}
                                  </div>
                                  {bg.totalMaturityInterest > 0 && (
                                    <div className="text-[10px] font-bold text-blue-600">
                                      +{formatVND(bg.totalMaturityInterest, isPrivacyMode)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9px]">
                                {bg.nearestMaturityDate ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                    <Calendar className="w-2.5 h-2.5 text-amber-700" />
                                    <span>Đáo hạn gần nhất: {bg.nearestMaturityDate}</span>
                                    {bg.daysToNearestMaturity !== undefined && (
                                      <span className="font-normal text-amber-800">
                                        ({bg.daysToNearestMaturity > 0 ? `còn ${bg.daysToNearestMaturity} ngày` : 'đến hạn'})
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Tiết kiệm ngân hàng</span>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFlatBankExpand(bg.bankKey);
                                  }}
                                  className="text-blue-600 font-bold text-[9.5px] flex items-center gap-0.5 hover:underline"
                                >
                                  <span>{isExpanded ? 'Thu gọn' : `Xem ${bg.count} sổ`}</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>

                            {/* Sub accounts if expanded */}
                            {isExpanded && (
                              <div className="p-2 bg-slate-50/80 border-t border-blue-100 space-y-1.5">
                                {bg.assets.map((subA) => {
                                  const subInterest = subA.rate && subA.termMonths ? Math.round(subA.amount * (subA.rate / 100) * (subA.termMonths / 12)) : 0;
                                  const subMat = formatDateVN(subA.maturityDate) || calculateMaturityDate(subA.startDate, subA.termMonths);
                                  return (
                                    <div key={subA.id} className="p-2 bg-white rounded border border-slate-200 text-[10.5px] space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800 truncate">{subA.name}</span>
                                        <span className="font-bold text-slate-900">{formatVND(subA.amount, isPrivacyMode)}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[9.5px] text-slate-500">
                                        <span>{subA.termMonths ? `${subA.termMonths}T` : ''} • {subA.rate ? `${subA.rate}%/n` : ''}</span>
                                        {subMat && <span className="font-semibold text-amber-800">Đáo hạn: {subMat}</span>}
                                      </div>
                                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9px]">
                                        {subInterest > 0 ? (
                                          <span className="text-blue-600 font-bold">Lãi: +{formatVND(subInterest, isPrivacyMode)}</span>
                                        ) : <span />}
                                        <div className="flex items-center gap-2">
                                          <button onClick={() => { setSelectedHistoryAsset(subA); setShowHistoryModal(true); }} className="text-blue-600 hover:underline">Lịch sử</button>
                                          <span className="text-slate-300">•</span>
                                          <button onClick={() => handleEdit(subA)} className="text-amber-600 hover:underline">Sửa</button>
                                          <span className="text-slate-300">•</span>
                                          <button onClick={() => setAssetToDelete({ id: subA.id, name: subA.name })} className="text-rose-600 hover:underline">Xóa</button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const a = item.asset;
                      const levelBadge =
                        a.level === '1'
                          ? 'bg-emerald-100 text-emerald-800'
                          : a.level === '2'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800';
                      const categoryName = assetTypeLabels[a.type] || 'Tài Sản Khác';

                      let pnlMobile = null;
                      if (a.costPrice && a.costPrice > 0) {
                        const diff = a.amount - a.costPrice;
                        const pct = ((diff / a.costPrice) * 100).toFixed(1);
                        const isGain = diff >= 0;
                        pnlMobile = (
                          <span className={`text-[9.5px] font-bold ${isGain ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ({isGain ? '+' : ''}{pct}%)
                          </span>
                        );
                      }

                      // Sub-details under total amount (Left Column)
                      let leftSubDetail = null;
                      if (a.type === 'saving') {
                        leftSubDetail = (
                          <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5">
                            {a.termMonths ? `${a.termMonths}T` : '—'} • {a.rate ? `${a.rate}%/n` : '—'}
                          </div>
                        );
                      } else if (a.type === 'stock') {
                        const qty = a.quantity || 0;
                        const avgCost = a.costPrice && qty > 0 ? Math.round(a.costPrice / qty) : (a.unitPrice || 0);
                        const mktPrice = a.amount && qty > 0 ? Math.round(a.amount / qty) : 0;
                        leftSubDetail = (
                          <div className="text-[9.5px] text-slate-500 font-medium mt-0.5 space-y-0.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              {qty > 0 && <span className="font-bold text-slate-800">{formatNumberString(qty)} CP</span>}
                              {avgCost > 0 && <span className="text-slate-600">• Vốn TB: <strong className="text-slate-900">{formatVND(avgCost)}/CP</strong></span>}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-blue-700 font-semibold">
                              {mktPrice > 0 && <span>Giá TT: {formatVND(mktPrice)}/CP</span>}
                              {pnlMobile}
                            </div>
                          </div>
                        );
                      } else if (a.type === 'gold') {
                        const qty = a.quantity || 0;
                        const avgCost = a.costPrice && qty > 0 ? Math.round(a.costPrice / qty) : (a.unitPrice || 0);
                        const mktPrice = a.amount && qty > 0 ? Math.round(a.amount / qty) : 0;
                        leftSubDetail = (
                          <div className="text-[9.5px] text-slate-500 font-medium mt-0.5 space-y-0.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              {qty > 0 && <span className="font-bold text-amber-900">{formatNumberString(qty)} chỉ</span>}
                              {avgCost > 0 && <span className="text-slate-600">• Vốn TB: <strong className="text-slate-900">{formatVND(avgCost)}/chỉ</strong></span>}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-blue-700 font-semibold">
                              {mktPrice > 0 && <span>Giá TT: {formatVND(mktPrice)}/chỉ</span>}
                              {pnlMobile}
                            </div>
                          </div>
                        );
                      } else if (a.type === 'bond' || a.type === 'peer_lending') {
                        leftSubDetail = (
                          <div className="text-[9.5px] text-slate-500 font-medium mt-0.5">
                            {a.termMonths ? `Hạn: ${a.termMonths}T • ` : ''}{a.rate ? `Lãi: ${a.rate}%/n` : ''}
                          </div>
                        );
                      } else if (a.type === 'realestate_accumulate' || a.type === 'realestate_rent') {
                        leftSubDetail = (
                          <div className="text-[9.5px] text-slate-500 font-medium mt-0.5">
                            {a.startDate ? `Sở hữu từ: ${formatDateVN(a.startDate)}` : 'Bất động sản'}
                          </div>
                        );
                      }

                      // Right Column (Lãi / Dòng tiền / Ngày đáo hạn)
                      let rightCol = null;
                      if (a.type === 'saving') {
                        const totalInterest = a.rate && a.termMonths ? Math.round(a.amount * (a.rate / 100) * (a.termMonths / 12)) : 0;
                        const matDate = formatDateVN(a.maturityDate) || calculateMaturityDate(a.startDate, a.termMonths);
                        rightCol = (
                          <div className="text-right shrink-0">
                            {totalInterest > 0 && (
                              <div className="text-[10.5px] font-black text-blue-600 leading-tight">
                                +{formatVND(totalInterest, isPrivacyMode)}
                              </div>
                            )}
                            {matDate && (
                              <div className="text-[9.5px] text-slate-600 font-medium mt-0.5">
                                Đáo hạn: <span className="font-bold text-slate-800">{matDate}</span>
                              </div>
                            )}
                          </div>
                        );
                      } else if (a.type === 'realestate_rent' || a.type === 'private_equity' || a.type === 'peer_lending') {
                        if (a.cashflow) {
                          rightCol = (
                            <div className="text-right shrink-0">
                              <div className="text-[10.5px] font-black text-emerald-600 leading-tight">
                                +{formatVND(a.cashflow, isPrivacyMode)}/th
                              </div>
                              <div className="text-[9px] text-slate-400 font-medium mt-0.5">Dòng tiền thu</div>
                            </div>
                          );
                        }
                      } else if (a.type === 'stock' && a.quantity && a.divCash) {
                        const mDiv = Math.round((a.quantity * a.divCash) / 12);
                        rightCol = (
                          <div className="text-right shrink-0">
                            <div className="text-[10.5px] font-black text-emerald-600 leading-tight">
                              +{formatVND(mDiv, isPrivacyMode)}/th
                            </div>
                            <div className="text-[9px] text-slate-400 font-medium mt-0.5">Cổ tức tiền</div>
                          </div>
                        );
                      }

                      return (
                        <div key={a.id} className="bg-white hover:bg-slate-50/80 rounded-lg border border-slate-200/90 p-2.5 space-y-1.5 transition shadow-2xs text-xs">
                          {/* Row 1: STT, Tầng, Tên tài sản, Phân loại & Nút Thao tác */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="w-3.5 h-3.5 rounded bg-slate-100 text-slate-600 text-[8.5px] font-black flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${levelBadge}`}>
                                T{a.level}
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate">{a.name}</span>
                              <span className="text-[9.5px] text-slate-400 font-normal truncate">({categoryName})</span>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                onClick={() => {
                                  setSelectedHistoryAsset(a);
                                  setShowHistoryModal(true);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                title="Lịch sử Mua/Gom/Gửi"
                              >
                                <History className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={() => handleEdit(a)}
                                className="p-1 text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                                title="Sửa tài sản"
                              >
                                <Pen className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={() => setAssetToDelete({ id: a.id, name: a.name })}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Xóa tài sản"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Bố cục 2 Cột khoa học (Tổng giá trị & Lãi/Đáo hạn) */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <div className="min-w-0">
                              <div className="text-xs font-black text-slate-900 tracking-tight leading-tight">
                                {formatVND(a.amount, isPrivacyMode)}
                              </div>
                              {leftSubDetail}
                            </div>
                            {rightCol}
                          </div>

                          {/* Row 3: Footer ngày gửi & ngày cập nhật tinh gọn (nếu có) */}
                          {(a.startDate || a.updatedAt) && (
                            <div className="pt-0.5 border-t border-slate-100 flex items-center justify-between text-[8.5px] text-slate-400">
                              <span>
                                {a.startDate && (
                                  <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                                    <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                    {a.type === 'saving' ? `Gửi: ${formatDateVN(a.startDate)}` : `Bắt đầu: ${formatDateVN(a.startDate)}`}
                                  </span>
                                )}
                              </span>
                              {a.updatedAt && <span>CN: {a.updatedAt}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 2. DEDICATED DESKTOP VIEW (>= md) - FULL COMPACT TABLE */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-1 px-2.5 text-center w-10">STT</th>
                        <th className="py-1 px-2.5">Tài Sản & Phân Loại</th>
                        <th className="py-1 px-2.5 text-center">Tầng</th>
                        <th className="py-1 px-2.5 text-center">Ngày Bắt Đầu / Gửi</th>
                        <th className="py-1 px-2.5 text-right">Giá Trị & Hiệu Suất</th>
                        <th className="py-1 px-2.5 text-right">Dòng Tiền Chi Tiết</th>
                        <th className="py-1 px-2.5 text-center">Ngày Cập Nhật</th>
                        <th className="py-1 px-2.5 text-center w-20">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 bg-white text-[11px]">
                      {flatItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-400">
                            Chưa có tài sản nào. Vui lòng thêm ở khung trên.
                          </td>
                        </tr>
                      ) : (
                        flatItems.map((item, index) => {
                          if (item.kind === 'bank') {
                            const bg = item.bankGroup;
                            const isExpanded = !!expandedFlatBanks[bg.bankKey];
                            return (
                              <React.Fragment key={`bank-${bg.bankKey}`}>
                                <tr
                                  onClick={() => toggleFlatBankExpand(bg.bankKey)}
                                  className={`cursor-pointer transition border-b border-slate-100 ${
                                    isExpanded ? 'bg-blue-50/70 font-semibold' : 'hover:bg-blue-50/30'
                                  }`}
                                >
                                  <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">
                                    {index + 1}
                                  </td>
                                  <td className="py-1.5 px-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFlatBankExpand(bg.bankKey);
                                        }}
                                        className="p-1 rounded hover:bg-blue-100 text-blue-700 transition cursor-pointer"
                                        title={isExpanded ? 'Thu gọn' : `Xem ${bg.count} sổ`}
                                      >
                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      </button>
                                      <span className="text-base">{bg.bankIcon}</span>
                                      <div>
                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                          <span>{bg.bankName}</span>
                                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200/60">
                                            {bg.count} sổ
                                          </span>
                                        </div>
                                        <div className="text-[9.5px] text-slate-500">Tiết kiệm ngân hàng • Nhóm gom tự động</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-2.5 text-center">
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                                      T1
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2.5 text-center">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-slate-50 text-slate-700 border border-slate-200 text-[10px]">
                                      <Landmark className="w-2.5 h-2.5 text-blue-600" />
                                      <span>{bg.count} sổ tiết kiệm</span>
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right">
                                    <div className="font-black text-slate-900">{formatVND(bg.totalPrincipal, isPrivacyMode)}</div>
                                    <div className="text-[10px] font-bold text-emerald-700">TB: {bg.weightedRate}%/năm</div>
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right">
                                    {bg.totalMaturityInterest > 0 ? (
                                      <div>
                                        <div className="font-semibold text-blue-600">Đáo hạn: +{formatVND(bg.totalMaturityInterest, isPrivacyMode)}</div>
                                        {bg.avgMonthlyInterest > 0 && (
                                          <div className="text-[9.5px] text-slate-400">Quy đổi: ≈ +{formatVND(bg.avgMonthlyInterest, isPrivacyMode)}/th</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-center">
                                    {bg.nearestMaturityDate ? (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-900 border border-amber-300 text-[10px]">
                                          <Calendar className="w-2.5 h-2.5 text-amber-700" />
                                          <span>Gần nhất: {bg.nearestMaturityDate}</span>
                                        </span>
                                        {bg.daysToNearestMaturity !== undefined && (
                                          <span
                                            className={`text-[9px] font-medium mt-0.5 ${
                                              bg.daysToNearestMaturity <= 30 ? 'text-rose-600 font-bold' : 'text-slate-500'
                                            }`}
                                          >
                                            {bg.daysToNearestMaturity > 0 ? `(còn ${bg.daysToNearestMaturity} ngày)` : '(đến hạn)'}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">—</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFlatBankExpand(bg.bankKey);
                                      }}
                                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <span>{isExpanded ? 'Thu gọn' : `Chi tiết (${bg.count})`}</span>
                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                  </td>
                                </tr>

                                {/* Sub rows when expanded */}
                                {isExpanded &&
                                  bg.assets.map((subA, subIdx) => {
                                    const subInterest =
                                      subA.rate && subA.termMonths
                                        ? Math.round(subA.amount * (subA.rate / 100) * (subA.termMonths / 12))
                                        : 0;
                                    const subMonthly = subA.termMonths ? Math.round(subInterest / subA.termMonths) : 0;
                                    const subMat = formatDateVN(subA.maturityDate) || calculateMaturityDate(subA.startDate, subA.termMonths);

                                    return (
                                      <tr key={subA.id} className="bg-blue-50/20 hover:bg-blue-50/50 transition text-[10.5px]">
                                        <td className="py-1 px-2.5 text-center text-slate-400 text-[10px] pl-4">
                                          ↳ {subIdx + 1}
                                        </td>
                                        <td className="py-1 px-2.5 pl-6">
                                          <div className="font-semibold text-slate-800">{subA.name}</div>
                                          {subA.note && <div className="text-[9px] text-slate-400 italic">"{subA.note}"</div>}
                                        </td>
                                        <td className="py-1 px-2.5 text-center">
                                          <span className="text-[8.5px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">T1</span>
                                        </td>
                                        <td className="py-1 px-2.5 text-center text-slate-600 text-[10px]">
                                          {subA.startDate ? formatDateVN(subA.startDate) : '—'}
                                        </td>
                                        <td className="py-1 px-2.5 text-right">
                                          <div className="font-bold text-slate-800">{formatVND(subA.amount, isPrivacyMode)}</div>
                                          <div className="text-[9.5px] text-slate-500">
                                            {subA.termMonths ? `${subA.termMonths}T • ` : ''}{subA.rate ? `${subA.rate}%/n` : ''}
                                          </div>
                                        </td>
                                        <td className="py-1 px-2.5 text-right">
                                          {subInterest > 0 ? (
                                            <div>
                                              <div className="font-semibold text-blue-600">+{formatVND(subInterest, isPrivacyMode)}</div>
                                              <div className="text-[9px] text-slate-400">≈ +{formatVND(subMonthly, isPrivacyMode)}/th</div>
                                            </div>
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="py-1 px-2.5 text-center">
                                          {subMat ? (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9.5px] font-medium bg-amber-50 text-amber-900 border border-amber-200">
                                              <Calendar className="w-2.5 h-2.5 text-amber-600" />
                                              {subMat}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 text-[10px]">—</span>
                                          )}
                                        </td>
                                        <td className="py-1 px-2.5 text-center space-x-1">
                                          <button
                                            onClick={() => {
                                              setSelectedHistoryAsset(subA);
                                              setShowHistoryModal(true);
                                            }}
                                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition cursor-pointer"
                                            title="Lịch sử"
                                          >
                                            <History className="w-2.5 h-2.5" />
                                          </button>
                                          <button
                                            onClick={() => handleEdit(subA)}
                                            className="p-1 text-amber-600 hover:bg-amber-100 rounded transition cursor-pointer"
                                            title="Sửa"
                                          >
                                            <Pen className="w-2.5 h-2.5" />
                                          </button>
                                          <button
                                            onClick={() => setAssetToDelete({ id: subA.id, name: subA.name })}
                                            className="p-1 text-rose-500 hover:bg-rose-100 rounded transition cursor-pointer"
                                            title="Xóa"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          }

                          const a = item.asset;
                          const levelBadge =
                            a.level === '1'
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.level === '2'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800';
                          const categoryName = assetTypeLabels[a.type] || 'Tài Sản Khác';

                          const detailsList: string[] = [];
                          if (a.type === 'saving') {
                            if (a.termMonths) detailsList.push(`Kỳ hạn: ${a.termMonths}T`);
                            if (a.rate) detailsList.push(`Lãi: ${a.rate}%/năm`);
                          } else if (a.type === 'bond' || a.type === 'peer_lending') {
                            if (a.termMonths) detailsList.push(`Kỳ hạn: ${a.termMonths}T`);
                            if (a.rate) detailsList.push(`Lãi: ${a.rate}%/năm`);
                          } else if (a.type === 'stock') {
                            const qty = a.quantity || 0;
                            const avgCost = a.costPrice && qty > 0 ? Math.round(a.costPrice / qty) : (a.unitPrice || 0);
                            const mktPrice = a.amount && qty > 0 ? Math.round(a.amount / qty) : 0;
                            if (qty > 0) detailsList.push(`SL: ${formatNumberString(qty)} CP`);
                            if (avgCost > 0) detailsList.push(`Vốn TB: ${formatVND(avgCost)}/CP`);
                            if (mktPrice > 0) detailsList.push(`Giá TT: ${formatVND(mktPrice)}/CP`);
                          } else if (a.type === 'gold') {
                            const qty = a.quantity || 0;
                            const avgCost = a.costPrice && qty > 0 ? Math.round(a.costPrice / qty) : (a.unitPrice || 0);
                            const mktPrice = a.amount && qty > 0 ? Math.round(a.amount / qty) : 0;
                            if (qty > 0) detailsList.push(`SL: ${formatNumberString(qty)} chỉ`);
                            if (avgCost > 0) detailsList.push(`Vốn TB: ${formatVND(avgCost)}/chỉ`);
                            if (mktPrice > 0) detailsList.push(`Giá TT: ${formatVND(mktPrice)}/chỉ`);
                          } else if (a.type === 'realestate_rent') {
                            if (a.cashflow) detailsList.push(`Dòng tiền: +${formatVND(a.cashflow)}/th`);
                          }

                          let pnlHTML = null;
                          if (a.costPrice && a.costPrice > 0) {
                            const diff = a.amount - a.costPrice;
                            const pct = ((diff / a.costPrice) * 100).toFixed(1);
                            const isGain = diff >= 0;
                            pnlHTML = (
                              <div className={`text-[9.5px] font-bold ${isGain ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isGain ? '+' : ''}
                                {pct}% ({formatVND(diff)})
                              </div>
                            );
                          }

                          let cashflowDetail = <span className="text-slate-400">—</span>;
                          if (a.type === 'realestate_rent' || a.type === 'private_equity' || a.type === 'peer_lending') {
                            if (a.cashflow) {
                              cashflowDetail = (
                                <div>
                                  <div className="font-bold text-emerald-600">+{formatVND(a.cashflow)}/tháng</div>
                                  <div className="text-[9.5px] text-slate-400">
                                    ≈ +{formatVND(Math.round(a.cashflow / 30))}/ngày
                                  </div>
                                </div>
                              );
                            }
                          } else if (a.type === 'stock' && a.quantity && a.divCash) {
                            const mDiv = Math.round((a.quantity * a.divCash) / 12);
                            cashflowDetail = (
                              <div>
                                <div className="font-bold text-emerald-600">+{formatVND(mDiv)}/tháng</div>
                                <div className="text-[9.5px] text-slate-400">
                                  Năm: +{formatVND(a.quantity * a.divCash)}
                                </div>
                              </div>
                            );
                          } else if (a.type === 'saving' && a.rate && a.termMonths) {
                            const totalInterest = Math.round(a.amount * (a.rate / 100) * (a.termMonths / 12));
                            const avgMonthly = Math.round(totalInterest / a.termMonths);
                            cashflowDetail = (
                              <div>
                                <div className="font-semibold text-blue-600">Đáo hạn: +{formatVND(totalInterest)}</div>
                                <div className="text-[9.5px] text-slate-400">Quy đổi: +{formatVND(avgMonthly)}/th</div>
                              </div>
                            );
                          }

                          const matDate = a.type === 'saving' ? (formatDateVN(a.maturityDate) || calculateMaturityDate(a.startDate, a.termMonths)) : null;

                          return (
                            <tr key={a.id} className="hover:bg-slate-50 transition">
                              <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{index + 1}</td>
                              <td className="py-1.5 px-2.5">
                                <div className="font-bold text-slate-900">{a.name}</div>
                                <div className="text-[9.5px] text-slate-500">{categoryName}</div>
                                {matDate && (
                                  <div className="mt-0.5">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-900 border border-amber-300 text-[9.5px]">
                                      <Calendar className="w-2.5 h-2.5 text-amber-700" />
                                      <span>Đáo hạn: {matDate}</span>
                                    </span>
                                  </div>
                                )}
                                {detailsList.length > 0 && (
                                  <div className="text-[9.5px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-1">
                                    {detailsList.map((item, i) => (
                                      <React.Fragment key={i}>
                                        <span>{item}</span>
                                        {i < detailsList.length - 1 && <span className="text-slate-300">•</span>}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5 text-center">
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${levelBadge}`}>
                                  T{a.level}
                                </span>
                              </td>
                              <td className="py-1.5 px-2.5 text-center">
                                {a.startDate ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-slate-50 text-slate-700 border border-slate-200 text-[10.5px]">
                                    <Calendar className="w-2.5 h-2.5 text-blue-600" />
                                    {formatDateVN(a.startDate)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">—</span>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5 text-right">
                                <div className="font-black text-slate-900">{formatVND(a.amount, isPrivacyMode)}</div>
                                {pnlHTML}
                              </td>
                              <td className="py-1.5 px-2.5 text-right">{cashflowDetail}</td>
                              <td className="py-1.5 px-2.5 text-center text-[10px] text-slate-500">{a.updatedAt || 'Mới'}</td>
                              <td className="py-1.5 px-2.5 text-center space-x-1">
                                <button
                                  onClick={() => {
                                    setSelectedHistoryAsset(a);
                                    setShowHistoryModal(true);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                  title="Lịch sử Mua/Gom/Gửi"
                                >
                                  <History className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleEdit(a)}
                                  className="p-1 text-amber-600 hover:bg-amber-50 rounded transition cursor-pointer"
                                  title="Sửa"
                                >
                                  <Pen className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setAssetToDelete({ id: a.id, name: a.name })}
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded transition cursor-pointer"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
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
        )}
      </div>

      {/* Net Worth Chart */}
      <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-2 gap-1.5 sm:gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 mr-1.5 sm:mr-2" />
            <span>Biến Động Tài Sản Ròng Thực Tế</span>
          </h3>
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={netWorthRange}
              onChange={(e) => setNetWorthRange(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
            >
              <option value="quarter">Kỳ hạn: Quý Này</option>
              <option value="year">Kỳ hạn: 1 Năm</option>
              <option value="3years">Kỳ hạn: 3 Năm</option>
              <option value="5years">Kỳ hạn: 5 Năm</option>
            </select>
          </div>
        </div>
        <div className="h-44 sm:h-72">
          <canvas ref={chartCanvasRef}></canvas>
        </div>
      </div>

      {/* Asset History / Transactions Modal */}
      {showHistoryModal && selectedHistoryAsset && (
        <AssetHistoryModal
          isOpen={showHistoryModal}
          asset={selectedHistoryAsset}
          db={db}
          isPrivacyMode={isPrivacyMode}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedHistoryAsset(null);
          }}
          onSaveTransactions={(updatedTxs, updatedAsset, updatedGoal) => {
            if (onSaveTransactions) {
              onSaveTransactions(updatedTxs, updatedAsset, updatedGoal);
            } else if (updatedAsset) {
              onUpdateAsset(updatedAsset);
            }
          }}
        />
      )}

      {/* Vietnam Wealth Benchmark Modal */}
      <BenchmarkModal
        isOpen={showWealthBenchmarkModal}
        onClose={() => setShowWealthBenchmarkModal(false)}
        type="wealth"
        currentValue={totalAssets}
        isPrivacyMode={isPrivacyMode}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!assetToDelete}
        title="Xác nhận xóa tài sản"
        message={`Bạn có chắc chắn muốn xóa tài sản "${assetToDelete?.name}" khỏi Tháp tài sản?`}
        subMessage="Dữ liệu tài sản sẽ được cập nhật đồng bộ tức thì trên toàn bộ hệ thống."
        confirmText="Xóa tài sản"
        onConfirm={() => {
          if (assetToDelete) {
            onRemoveAsset(assetToDelete.id);
            setAssetToDelete(null);
          }
        }}
        onClose={() => setAssetToDelete(null)}
      />
    </div>
  );
};
