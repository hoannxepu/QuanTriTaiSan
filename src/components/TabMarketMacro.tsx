import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DatabaseState, Goal, Asset } from '../types';
import { formatVND, formatNumberString } from '../utils/format';
import {
  GoldRateData,
  GoldRateItem,
  fetchGoldRates,
  getDojiPrices,
} from '../utils/goldService';
import {
  StockRateData,
  StockQuoteItem,
  fetchStockRates,
  collectAllStockSymbols,
  getStockQuote,
  isStockEntity,
  extractStockTicker,
  getDailyAutoScreenedRecommendations,
  MACRO_FINANCIAL_OVERVIEW,
  Top3Recommendation,
  SavingsRecommendation,
  BondRecommendation,
  StockFinancialRatios,
  BankRatesData,
  BankRateItem,
  fetchStockFinancialRatios,
  fetchBatchStockRatios,
  fetchLiveBankRates,
} from '../utils/stockService';
import {
  TrendingUp,
  RefreshCw,
  Sparkles,
  Target,
  ShieldCheck,
  PiggyBank,
  CheckCircle2,
  Landmark,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Zap,
  Flame,
  Award,
  ChevronDown,
  ChevronUp,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  ExternalLink,
  Layers,
  Scale,
  Link as LinkIcon,
} from 'lucide-react';

interface TabMarketMacroProps {
  db: DatabaseState;
  isPrivacyMode: boolean;
  onUpdateGoal: (goal: Goal) => void;
  onUpdateAssetDirectly: (asset: Asset) => void;
  onSwitchTab: (tab: 'pyramid' | 'debts' | 'goals' | 'market') => void;
  goldData?: GoldRateData | null;
  stockData?: StockRateData | null;
  onSyncMarketPrices?: () => void;
}

export const TabMarketMacro: React.FC<TabMarketMacroProps> = ({
  db,
  isPrivacyMode,
  onUpdateGoal,
  onUpdateAssetDirectly,
  onSwitchTab,
  goldData: initialGoldData,
  stockData: initialStockData,
  onSyncMarketPrices,
}) => {
  // Navigation inside Market Tab
  const [activeSection, setActiveSection] = useState<'all' | 'gold_stock' | 'recommendations' | 'macro'>('all');

  // Gold Data State
  const [goldData, setGoldData] = useState<GoldRateData | null>(initialGoldData || null);
  const [isLoadingGold, setIsLoadingGold] = useState(false);
  const [goldFilter, setGoldFilter] = useState<'doji' | 'nhan' | 'sjc' | 'all'>('doji');

  // Stock Data State
  const [stockData, setStockData] = useState<StockRateData | null>(initialStockData || null);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);
  const [searchTicker, setSearchTicker] = useState('');

  useEffect(() => {
    if (initialGoldData) setGoldData(initialGoldData);
  }, [initialGoldData]);

  useEffect(() => {
    if (initialStockData) setStockData(initialStockData);
  }, [initialStockData]);

  // BCTC TCBS & Lãi Suất Ngân Hàng Theo Ngày
  const [ratiosMap, setRatiosMap] = useState<Record<string, StockFinancialRatios>>({});
  const [searchedRatio, setSearchedRatio] = useState<StockFinancialRatios | null>(null);
  const [isSearchingRatio, setIsSearchingRatio] = useState(false);
  const [bankRates, setBankRates] = useState<BankRatesData | null>(null);
  const [isLoadingBankRates, setIsLoadingBankRates] = useState(false);
  const [bankRateSubTab, setBankRateSubTab] = useState<'topOnline' | 'cdHighYield' | 'special' | 'big4' | 'allOnline'>('topOnline');

  // Daily Screened Recommendations State
  const [recCategory, setRecCategory] = useState<'all' | 'stocks' | 'savings' | 'bonds'>('all');
  const dailyRecs = useMemo(() => getDailyAutoScreenedRecommendations(bankRates), [bankRates]);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  // Live real-time polling state (15s)
  const [lastLiveUpdated, setLastLiveUpdated] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState<number>(15);

  // Navigation handlers for pinned cards
  const handleNavigateToGold = () => {
    if (activeSection !== 'all' && activeSection !== 'gold_stock') {
      setActiveSection('gold_stock');
    }
    setTimeout(() => {
      const el = document.getElementById('gold-rates-board');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-4', 'ring-amber-400', 'transition-all');
        setTimeout(() => el.classList.remove('ring-4', 'ring-amber-400'), 1600);
      }
    }, 60);
  };

  const handleNavigateToStocks = () => {
    if (activeSection !== 'all' && activeSection !== 'gold_stock') {
      setActiveSection('gold_stock');
    }
    setTimeout(() => {
      const el = document.getElementById('stock-rates-board');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-4', 'ring-blue-400', 'transition-all');
        setTimeout(() => el.classList.remove('ring-4', 'ring-blue-400'), 1600);
      }
    }, 60);
  };

  const handleNavigateToSavings = () => {
    if (activeSection !== 'all' && activeSection !== 'recommendations') {
      setActiveSection('recommendations');
    }
    setRecCategory('savings');
    setTimeout(() => {
      const el = document.getElementById('savings-rec-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-4', 'ring-emerald-400', 'transition-all');
        setTimeout(() => el.classList.remove('ring-4', 'ring-emerald-400'), 1600);
      }
    }, 60);
  };

  // Fetch Gold Rates
  const handleRefreshGold = async (silent = false) => {
    if (!silent) setIsLoadingGold(true);
    try {
      const data = await fetchGoldRates(true);
      setGoldData(data);
      setLastLiveUpdated(new Date());
    } catch {
      if (!silent) showToast('Không thể kết nối máy chủ giá vàng.', 'info');
    } finally {
      if (!silent) setIsLoadingGold(false);
    }
  };

  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // Fetch Stock Rates
  const handleRefreshStocks = async (silent = false) => {
    if (!silent) setIsLoadingStocks(true);
    try {
      const symbols = collectAllStockSymbols(dbRef.current.assets, dbRef.current.goals);
      const data = await fetchStockRates(symbols, true);
      setStockData(data);
      setLastLiveUpdated(new Date());
    } catch {
      if (!silent) showToast('Không thể kết nối máy chủ cổ phiếu.', 'info');
    } finally {
      if (!silent) setIsLoadingStocks(false);
    }
  };

  // Silent Refresh both Gold and Stocks continuously
  const handleSilentRefreshBoth = async () => {
    try {
      const symbols = collectAllStockSymbols(dbRef.current.assets, dbRef.current.goals);
      const [gData, sData] = await Promise.all([
        fetchGoldRates(true),
        fetchStockRates(symbols, true),
      ]);
      if (gData) setGoldData(gData);
      if (sData) setStockData(sData);
      setLastLiveUpdated(new Date());
      setCountdown(15);
    } catch (err) {
      console.warn('Lỗi cập nhật trực tuyến Tab 4:', err);
    }
  };

  // Refresh All (Manual click)
  const handleRefreshAll = async () => {
    await Promise.all([handleRefreshGold(false), handleRefreshStocks(false)]);
    setCountdown(15);
    showToast('Đã cập nhật dữ liệu Vàng & Chứng khoán mới nhất!', 'success');
  };

  // Initial Load & Continuous Real-time Polling (Mỗi 15 giây tự động cập nhật trực tuyến)
  useEffect(() => {
    handleRefreshGold();
    handleRefreshStocks();

    // Đồng hồ đếm ngược 15s
    const secondTimer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 15 : prev - 1));
    }, 1000);

    // Polling tự động mỗi 15 giây
    const pollInterval = setInterval(() => {
      handleSilentRefreshBoth();
    }, 15000);

    // Tự động kiểm tra cập nhật mới nhất khi người dùng chuyển lại tab trình duyệt
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleSilentRefreshBoth();
      }
    };
    const handleFocus = () => {
      handleSilentRefreshBoth();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(secondTimer);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // TỰ ĐỘNG ĐỒNG BỘ: Tự động cập nhật đơn giá thị trường sang Tab 1 và Tab 3 mà không cần người dùng phải bấm nút thủ công
  useEffect(() => {
    if (!goldData) return;
    if (onSyncMarketPrices) {
      onSyncMarketPrices();
      return;
    }
    // Auto sync gold to Tab 3 goals
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
        const { sellPrice } = getDojiPrices(goldData, g.unit, g.name);
        if (sellPrice > 0 && g.currentPrice !== sellPrice) {
          onUpdateGoal({
            ...g,
            currentPrice: sellPrice,
          });
        }
      }
    });

    // Auto sync gold to Tab 1 assets
    db.assets.forEach((a) => {
      const isGold =
        a.type === 'gold' ||
        a.unit === 'chỉ' ||
        a.unit === 'lượng' ||
        a.name.toLowerCase().includes('vàng');
      if (isGold) {
        const { buyPrice } = getDojiPrices(goldData, a.unit, a.name);
        if (buyPrice > 0) {
          const qty = a.quantity || 0;
          const newAmount = qty > 0 ? Math.round(qty * buyPrice) : a.amount;
          if (a.currentPrice !== buyPrice || (qty > 0 && a.amount !== newAmount)) {
            onUpdateAssetDirectly({
              ...a,
              currentPrice: buyPrice,
              amount: newAmount,
            });
          }
        }
      }
    });
  }, [goldData, onSyncMarketPrices]);

  useEffect(() => {
    if (!stockData) return;
    if (onSyncMarketPrices) {
      onSyncMarketPrices();
      return;
    }
    // Auto sync stock to Tab 3 goals
    db.goals.forEach((g) => {
      if (isStockEntity(g)) {
        const sym = extractStockTicker(g.name, g.assetType, g.unit);
        const quote = sym ? getStockQuote(stockData, sym) : null;
        if (quote && quote.price > 0 && g.currentPrice !== quote.price) {
          onUpdateGoal({
            ...g,
            currentPrice: quote.price,
          });
        }
      }
    });

    // Auto sync stock to Tab 1 assets
    db.assets.forEach((a) => {
      if (isStockEntity(a)) {
        const sym = extractStockTicker(a.name, a.type, a.unit);
        const quote = sym ? getStockQuote(stockData, sym) : null;
        if (quote && quote.price > 0) {
          const qty = a.quantity || 0;
          const newAmount = qty > 0 ? Math.round(qty * quote.price) : a.amount;
          if (a.currentPrice !== quote.price || (qty > 0 && a.amount !== newAmount)) {
            onUpdateAssetDirectly({
              ...a,
              currentPrice: quote.price,
              amount: newAmount,
            });
          }
        }
      }
    });
  }, [stockData, onSyncMarketPrices]);

  // Tự động tải BCTC & các chỉ số P/E, P/B, ROE cho danh mục cổ phiếu
  useEffect(() => {
    const symbols = collectAllStockSymbols(db.assets, db.goals);
    if (symbols.length > 0) {
      fetchBatchStockRatios(symbols).then((res) => {
        if (res && Object.keys(res).length > 0) {
          setRatiosMap((prev) => ({ ...prev, ...res }));
        }
      });
    }
  }, [db.assets, db.goals]);

  // Tra cứu BCTC TCBS trực tuyến cho bất kỳ mã CP nào người dùng nhập
  useEffect(() => {
    const q = searchTicker.trim().toUpperCase();
    if (q.length >= 3 && /^[A-Z0-9]{3,4}$/.test(q)) {
      if (ratiosMap[q]) {
        setSearchedRatio(ratiosMap[q]);
        return;
      }
      setIsSearchingRatio(true);
      fetchStockFinancialRatios(q)
        .then((res) => {
          if (res) {
            setSearchedRatio(res);
            setRatiosMap((prev) => ({ ...prev, [q]: res }));
          } else {
            setSearchedRatio(null);
          }
        })
        .finally(() => {
          setIsSearchingRatio(false);
        });
    } else {
      setSearchedRatio(null);
    }
  }, [searchTicker, ratiosMap]);

  // Quét biểu lãi suất ngân hàng tự động trực tuyến theo ngày
  const handleRefreshLiveBankRates = () => {
    setIsLoadingBankRates(true);
    fetchLiveBankRates(true)
      .then((data) => {
        setBankRates(data);
        showToast('Đã làm mới bảng lãi suất ngân hàng trực tuyến theo ngày!', 'success');
      })
      .finally(() => {
        setIsLoadingBankRates(false);
      });
  };

  useEffect(() => {
    setIsLoadingBankRates(true);
    fetchLiveBankRates()
      .then((data) => {
        setBankRates(data);
      })
      .finally(() => {
        setIsLoadingBankRates(false);
      });
  }, []);

  // Đếm số lượng thực thể liên kết với các Tab khác
  const ownedStocksCount = useMemo(() => db.assets.filter((a) => a.type === 'stock').length, [db.assets]);
  const ownedGoldCount = useMemo(() => db.assets.filter((a) => a.type === 'gold').length, [db.assets]);
  const debtsCount = useMemo(() => db.debts.length, [db.debts]);
  const goalsCount = useMemo(() => db.goals.length, [db.goals]);
  const dcaGoalsCount = useMemo(() => db.goals.filter((g) => g.group === 'dca').length, [db.goals]);

  // 1. Áp giá bán Doji vào Mục Tiêu Vàng Tab 3
  const handleApplyGoldToGoals = () => {
    if (!goldData) return;
    let count = 0;
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
        const { sellPrice } = getDojiPrices(goldData, g.unit, g.name);
        if (g.currentPrice !== sellPrice) {
          onUpdateGoal({
            ...g,
            currentPrice: sellPrice,
          });
          count++;
        }
      }
    });
    showToast(`Đã đồng bộ đơn giá thị trường cho ${count} mục tiêu Vàng tại Tab 3!`, 'success');
  };

  // 2. Áp giá cổ phiếu khớp lệnh vào Mục Tiêu Cổ Phiếu Tab 3
  const handleApplyStockToGoals = () => {
    if (!stockData) return;
    let count = 0;
    db.goals.forEach((g) => {
      if (isStockEntity(g)) {
        const sym = extractStockTicker(g.name, g.assetType, g.unit);
        const quote = sym ? getStockQuote(stockData, sym) : null;
        if (quote && quote.price > 0 && g.currentPrice !== quote.price) {
          onUpdateGoal({
            ...g,
            currentPrice: quote.price,
          });
          count++;
        }
      }
    });
    showToast(`Đã đồng bộ đơn giá thị trường cho ${count} mục tiêu Cổ Phiếu tại Tab 3!`, 'success');
  };

  // 3. Đồng bộ vào cả Tài Sản (Tab 1) & Mục Tiêu (Tab 3)
  const handleSyncAllPrices = () => {
    handleApplyGoldToGoals();
    handleApplyStockToGoals();

    // Đồng bộ sang Tab 1
    if (goldData) {
      db.assets.forEach((a) => {
        const isGold =
          a.type === 'gold' ||
          a.unit === 'chỉ' ||
          a.unit === 'lượng' ||
          a.name.toLowerCase().includes('vàng');
        if (isGold) {
          const { buyPrice } = getDojiPrices(goldData, a.unit, a.name);
          const qty = a.quantity || 0;
          const newAmount = qty > 0 ? Math.round(qty * buyPrice) : a.amount;
          if (a.currentPrice !== buyPrice || (qty > 0 && a.amount !== newAmount)) {
            onUpdateAssetDirectly({
              ...a,
              currentPrice: buyPrice,
              amount: newAmount,
            });
          }
        }
      });
    }

    if (stockData) {
      db.assets.forEach((a) => {
        if (isStockEntity(a)) {
          const sym = extractStockTicker(a.name, a.type, a.unit);
          const quote = sym ? getStockQuote(stockData, sym) : null;
          if (quote && quote.price > 0) {
            const qty = a.quantity || 0;
            const newAmount = qty > 0 ? Math.round(qty * quote.price) : a.amount;
            if (a.currentPrice !== quote.price || (qty > 0 && a.amount !== newAmount)) {
              onUpdateAssetDirectly({
                ...a,
                currentPrice: quote.price,
                amount: newAmount,
              });
            }
          }
        }
      });
    }

    showToast('Hoàn tất đồng bộ giá thị trường sang toàn bộ Tài sản (Tab 1) và Mục tiêu (Tab 3)!', 'success');
  };

  // 4. Thêm nhanh Mục Tiêu từ Khuyến Nghị Cổ Phiếu
  const handleAddStockGoalFromRec = (rec: Top3Recommendation) => {
    const quote = stockData ? getStockQuote(stockData, rec.symbol) : null;
    const price = quote?.price || 28000;
    const existing = db.goals.find((g) => g.name.toLowerCase().includes(rec.symbol.toLowerCase()));

    if (existing) {
      showToast(`Mục tiêu tích sản ${rec.symbol} đã có trong Kế Hoạch Tab 3!`, 'info');
      onSwitchTab('goals');
      return;
    }

    const newGoal: Goal = {
      id: Date.now(),
      name: `Tích sản Cổ phiếu ${rec.symbol} (${rec.name})`,
      goalType: 'dca',
      group: 'dca',
      assetType: 'stock',
      unit: 'CP',
      targetQty: 100,
      totalBought: 0,
      currentPrice: price,
      targetAmountPerPeriod: 100 * price,
      freqMonths: 1,
      day: 5,
      note: `Khuyến nghị tự động ngày ${dailyRecs.scanDate}: ${rec.pillarLabel}. ${rec.reason}`,
      status: 'active',
    };

    onUpdateGoal(newGoal);
    showToast(`Đã thêm mục tiêu tích sản ${rec.symbol} (100 CP/tháng) vào Tab 3 thành công!`, 'success');
  };

  // 5. Thêm nhanh Mục Tiêu từ Khuyến Nghị Tiết Kiệm (Phản ánh mốc 9%)
  const handleAddSavingsGoalFromRec = (rec: SavingsRecommendation) => {
    const newGoal: Goal = {
      id: Date.now(),
      name: `Mục tiêu mở Sổ Tiết Kiệm ${rec.defaultBankKey || 'Ngân Hàng'} (Lãi suất ~${rec.defaultRate || 9.0}%/năm)`,
      goalType: 'dca',
      group: 'dca',
      assetType: 'saving',
      unit: 'VNĐ',
      targetQty: 5000000,
      totalBought: 0,
      currentPrice: 1,
      targetAmountPerPeriod: 5000000,
      freqMonths: 1,
      day: 10,
      note: `Gói khuyến nghị: ${rec.bankName}. Kỳ hạn: ${rec.term}. Lãi suất kỳ vọng: ${rec.rateRange}. ${rec.advice}`,
      status: 'active',
    };

    onUpdateGoal(newGoal);
    showToast(`Đã thêm mục tiêu mở sổ tiết kiệm (${rec.defaultRate}%/năm) vào Tab 3 thành công!`, 'success');
  };

  // 6. Thêm nhanh Mục Tiêu từ Khuyến Nghị Trái Phiếu
  const handleAddBondGoalFromRec = (rec: BondRecommendation) => {
    const newGoal: Goal = {
      id: Date.now(),
      name: `Tích lũy Trái Phiếu ${rec.symbolOrCode} (${rec.issuerName.split('(')[0].trim()})`,
      goalType: 'dca',
      group: 'dca',
      assetType: 'bond',
      unit: 'TP',
      targetQty: 10,
      totalBought: 0,
      currentPrice: 100000,
      targetAmountPerPeriod: 1000000,
      freqMonths: 3,
      day: 15,
      note: `Trái phiếu khuyến nghị: ${rec.issuerName}. Lợi tức: ${rec.couponRange}. ${rec.creditRating}`,
      status: 'active',
    };

    onUpdateGoal(newGoal);
    showToast(`Đã thêm mục tiêu tích lũy trái phiếu ${rec.symbolOrCode} vào Tab 3!`, 'success');
  };

  // 7. Thêm nhanh Mục Tiêu Vàng Doji 9999
  const handleAddGoldGoal = () => {
    const dojiSell = goldData?.summary.dojiSellPerChi || 14800000;
    const newGoal: Goal = {
      id: Date.now(),
      name: 'Tích sản Vàng nhẫn ép vỉ 9999 DOJI Hưng Thịnh Vượng',
      goalType: 'dca',
      group: 'dca',
      assetType: 'gold',
      unit: 'chỉ',
      targetQty: 1,
      totalBought: 0,
      currentPrice: dojiSell,
      targetAmountPerPeriod: dojiSell,
      freqMonths: 1,
      day: 1,
      note: `Tích sản định kỳ vàng nhẫn chống trượt giá tiền tệ theo chu kỳ M2. Đơn giá thị trường: ${formatVND(dojiSell)} đ/chỉ.`,
      status: 'active',
    };

    onUpdateGoal(newGoal);
    showToast('Đã thêm mục tiêu tích sản Vàng 9999 (1 chỉ/tháng) vào Tab 3 thành công!', 'success');
  };

  // Lọc danh sách vàng
  const goldItems = goldData?.items || [];
  const filteredGoldItems = goldItems.filter((item) => {
    if (goldFilter === 'doji') return item.brand === 'DOJI' || item.name.includes('DOJI');
    if (goldFilter === 'nhan') return item.category === 'nhan_9999';
    if (goldFilter === 'sjc') return item.category === 'sjc_mieng';
    return true;
  });

  const dojiBuy = goldData?.summary.dojiBuyPerChi || 14400000;
  const dojiSell = goldData?.summary.dojiSellPerChi || 14800000;

  // Lọc danh sách cổ phiếu
  const allStockSymbols = useMemo(() => {
    return collectAllStockSymbols(db.assets, db.goals);
  }, [db.assets, db.goals]);

  const stockRows = useMemo(() => {
    return allStockSymbols
      .filter((sym) => {
        if (!searchTicker) return true;
        const q = searchTicker.toLowerCase();
        return (
          sym.toLowerCase().includes(q) ||
          (stockData?.stocks[sym]?.name || '').toLowerCase().includes(q)
        );
      })
      .map((symbol) => {
        const quote = stockData?.stocks[symbol];
        const ownedAssets = db.assets.filter((a) => {
          if (!isStockEntity(a)) return false;
          const s = extractStockTicker(a.name, a.type, a.unit);
          return s === symbol;
        });
        const targetGoals = db.goals.filter((g) => {
          if (!isStockEntity(g)) return false;
          const s = extractStockTicker(g.name, g.assetType, g.unit);
          return s === symbol;
        });

        return {
          symbol,
          name: quote?.name || symbol,
          quote,
          ownedCount: ownedAssets.reduce((s, a) => s + (a.quantity || 0), 0),
          targetCount: targetGoals.reduce((s, g) => s + (g.targetQty || 0), 0),
        };
      });
  }, [allStockSymbols, stockData, db.assets, db.goals, searchTicker]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 animate-in fade-in duration-200">
      {/* 1. TOP HERO HEADER & MACRO STATS BAR */}
      {/* 1. HERO BANNER: THỊ TRƯỜNG & VĨ MÔ THỜI GIAN THỰC (OPTIMIZED FOR MOBILE & DESKTOP) */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-3.5 sm:p-5 text-white shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[9.5px] sm:text-[10px] font-bold text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                </span>
                <span>CẬP NHẬT TRỰC TUYẾN LIÊN TỤC</span>
                <span className="text-emerald-200 font-mono">({countdown}s)</span>
              </div>
              <span className="text-[10px] text-indigo-300 font-medium hidden sm:inline">
                • Lúc {lastLiveUpdated.toLocaleTimeString('vi-VN')}
              </span>
              <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 shrink-0">
                Quét: {dailyRecs.scanDate}
              </span>
            </div>
            <h1 className="text-base sm:text-xl lg:text-2xl font-black tracking-tight text-white flex items-center gap-1.5 sm:gap-2 leading-tight">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0" />
              <span>Thị Trường & Phân Tích Vĩ Mô</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-1 max-w-2xl leading-normal">
              Bảng giá Vàng & Cổ phiếu trực tuyến liên tục • Nhấp vào ô ghim để chuyển nhanh tới bảng tương ứng.
            </p>
          </div>

          {/* Action & Auto-Sync Status */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Tự Động Đồng Bộ Với Tab 1 & Tab 3</span>
              <span className="sm:hidden">Tự động đồng bộ T1, T3</span>
            </div>

            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isLoadingGold || isLoadingStocks}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-indigo-600/90 hover:bg-indigo-600 active:scale-95 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-md border border-indigo-400/30 shrink-0 whitespace-nowrap"
              title="Làm mới ngay lập tức bảng giá vàng và cổ phiếu"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isLoadingGold || isLoadingStocks ? 'animate-spin' : ''}`} />
              <span>{isLoadingGold || isLoadingStocks ? 'Đang tải...' : 'Làm Mới Ngay'}</span>
            </button>
          </div>
        </div>

        {/* Real-time Ticker Ribbon (CÁC Ô GHI GHIM TƯƠNG TÁC CHUYỂN BẢNG THEO YÊU CẦU) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mt-3 pt-3 border-t border-indigo-900/60 text-xs">
          {/* Ticker 1: Vàng Doji -> Click chuyển về Bảng giá vàng */}
          <button
            type="button"
            onClick={handleNavigateToGold}
            className="bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-amber-400/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between text-left transition cursor-pointer group shadow-xs"
            title="Nhấp vào đây để chuyển nhanh về Bảng Giá Vàng"
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-[10.5px]">
              <span className="group-hover:text-amber-300 font-bold truncate transition">Vàng Nhẫn Doji</span>
              <span className="flex items-center text-amber-400 font-bold text-[9px] bg-amber-500/20 px-1 py-0.2 rounded border border-amber-400/30">
                Xem Bảng →
              </span>
            </div>
            <div className="text-xs sm:text-sm font-black text-amber-300 mt-1 truncate">
              {isPrivacyMode ? '••••••' : formatVND(dojiSell)} <span className="text-[9px] sm:text-[10px] font-normal text-slate-400">/chỉ</span>
            </div>
            <div className="text-[9.5px] sm:text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-0.5 truncate">
              <ArrowUpRight className="w-2.5 h-2.5 shrink-0" /> Mua: {isPrivacyMode ? '••••••' : formatVND(dojiBuy)}
            </div>
          </button>

          {/* Ticker 2: Lãi Suất Tiền Gửi ~9% -> Click chuyển về Khu khuyến nghị tiết kiệm */}
          <button
            type="button"
            onClick={handleNavigateToSavings}
            className="bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-blue-400/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between text-left transition cursor-pointer group shadow-xs"
            title="Nhấp vào đây để chuyển nhanh về Khu Khuyến Nghị Tiết Kiệm (~9.0%)"
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-[10.5px]">
              <span className="group-hover:text-blue-300 font-bold truncate transition">Lãi Suất Tiết Kiệm</span>
              <span className="flex items-center text-blue-400 font-bold text-[9px] bg-blue-500/20 px-1 py-0.2 rounded border border-blue-400/30">
                Gợi Ý ~9% →
              </span>
            </div>
            <div className="text-xs sm:text-sm font-black text-blue-300 mt-1 truncate">
              8.8% - 9.5% <span className="text-[9px] sm:text-[10px] font-normal text-slate-400">/năm</span>
            </div>
            <div className="text-[9.5px] sm:text-[10px] text-blue-200 font-semibold mt-0.5 truncate">
              Kỳ dài ~9.0% (NCB/HDB)
            </div>
          </button>

          {/* Ticker 3: VN-Index -> Click chuyển về Bảng chứng khoán */}
          <button
            type="button"
            onClick={handleNavigateToStocks}
            className="bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-emerald-400/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between text-left transition cursor-pointer group shadow-xs"
            title="Nhấp vào đây để chuyển nhanh về Bảng Chứng Khoán"
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-[10.5px]">
              <span className="group-hover:text-emerald-300 font-bold truncate transition">VN-Index</span>
              <span className="flex items-center text-emerald-400 font-bold text-[9px] bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-400/30">
                Bảng CP →
              </span>
            </div>
            {(() => {
              const vn = stockData?.vnindex;
              if (!vn) {
                return (
                  <>
                    <div className="text-xs sm:text-sm font-black mt-1 text-slate-300 animate-pulse">
                      Đang cập nhật...
                    </div>
                    <div className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
                      Sở GDCK HOSE
                    </div>
                  </>
                );
              }
              const isVnUp = (vn.change || 0) > 0;
              const isVnDown = (vn.change || 0) < 0;
              const colorText = isVnUp ? 'text-emerald-400' : isVnDown ? 'text-rose-400' : 'text-amber-300';
              const headColor = isVnUp ? 'text-emerald-300' : isVnDown ? 'text-rose-400' : 'text-amber-200';
              const arrowIcon = isVnUp ? '▲ ' : isVnDown ? '▼ ' : '';
              const plusPrefix = isVnUp ? '+' : '';

              return (
                <>
                  <div className={`text-xs sm:text-sm font-black mt-1 truncate ${headColor}`}>
                    {vn.price.toLocaleString('vi-VN')} <span className={`text-[9.5px] sm:text-[10px] font-bold ${colorText}`}>
                      {arrowIcon}{plusPrefix}{vn.changePercent}% ({plusPrefix}{vn.change})
                    </span>
                  </div>
                  <div className="text-[9.5px] sm:text-[10px] text-slate-300 mt-0.5 truncate" title="Khối lượng giao dịch và Giá trị giao dịch toàn sàn">
                    Thanh khoản: {vn.volume || 'Đang cập nhật'}
                  </div>
                </>
              );
            })()}
          </button>

          {/* Ticker 4: Top Tích Sản -> Click chuyển về Bảng chứng khoán */}
          <button
            type="button"
            onClick={handleNavigateToStocks}
            className="bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-rose-400/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between text-left transition cursor-pointer group shadow-xs"
            title="Nhấp vào đây để chuyển nhanh về Bảng Chứng Khoán"
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-[10.5px]">
              <span className="group-hover:text-rose-300 font-bold truncate transition">Top Tích Sản CP</span>
              <span className="flex items-center text-rose-400 font-bold text-[9px] bg-rose-500/20 px-1 py-0.2 rounded border border-rose-400/30">
                Đáy 52T →
              </span>
            </div>
            <div className="text-xs sm:text-sm font-black text-slate-100 mt-1 truncate">
              TCB • HPG • FPT
            </div>
            <div className="text-[9.5px] sm:text-[10px] text-indigo-300 font-semibold mt-0.5 truncate">
              Định giá đáy chu kỳ • DCA tốt
            </div>
          </button>
        </div>
      </div>

      {/* 1.5. TRUNG TÂM KẾT NỐI LIÊN TAB (INTER-TAB SYNCHRONIZATION HUB) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
              <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 truncate">
                <span>Liên Kết Đồng Bộ 2 Chiều Giữa Các Tab</span>
                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] sm:text-[9.5px] font-black rounded-md shrink-0">
                  Đã Kết Nối
                </span>
              </h3>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                Tự động liên thông số liệu và định giá với Tháp Tài Sản (Tab 1), Quản Lý Nợ (Tab 2) và Mục Tiêu (Tab 3)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 mt-2.5">
          {/* Link sang Tab 1 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                <Layers className="w-3 h-3 text-emerald-700 shrink-0" />
                <span className="truncate">Tab 1: Tháp Tài Sản</span>
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5 truncate">
                {ownedStocksCount} CP • {ownedGoldCount} Vàng Sở Hữu
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-500 truncate">Tự động đồng bộ định giá</div>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('pyramid')}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <span>Xem Tab 1</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Link sang Tab 2 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-rose-800 uppercase flex items-center gap-1">
                <Scale className="w-3 h-3 text-rose-700 shrink-0" />
                <span className="truncate">Tab 2: Nợ & Dòng Tiền</span>
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5 truncate">
                {debtsCount} Khoản Nợ • DSTI &lt; 40%
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-500 truncate">Đối chiếu lãi suất vay BĐS</div>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('debts')}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <span>Xem Tab 2</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Link sang Tab 3 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-blue-800 uppercase flex items-center gap-1">
                <Target className="w-3 h-3 text-blue-700 shrink-0" />
                <span className="truncate">Tab 3: Mục Tiêu</span>
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5 truncate">
                {goalsCount} Mục Tiêu ({dcaGoalsCount} DCA)
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-500 truncate">Đẩy đơn giá & khuyến nghị live</div>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('goals')}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <span>Xem Tab 3</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION SEGMENT SWITCHER */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeSection === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất Cả
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('gold_stock')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeSection === 'gold_stock'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">Bảng Giá Vàng & Cổ Phiếu</span>
            <span className="sm:hidden">Giá Vàng & CP</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('recommendations')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeSection === 'recommendations'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">Khuyến Nghị Tự Động Hàng Ngày</span>
            <span className="sm:hidden">Khuyến Nghị</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('macro')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeSection === 'macro'
                ? 'bg-white text-indigo-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="hidden sm:inline">Vĩ Mô 4 Trụ Cột (&gt;5 Năm)</span>
            <span className="sm:hidden">Vĩ Mô &gt;5 Năm</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-medium shrink-0 hidden sm:block">
          Dữ liệu liên kết đồng bộ sang <b>Tab 1</b> và <b>Tab 3</b>
        </div>
      </div>

      {/* 3. SECTION: BẢNG GIÁ VÀNG & BẢNG GIÁ CỔ PHIẾU THỜI GIAN THỰC */}
      {(activeSection === 'all' || activeSection === 'gold_stock') && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* CỘT TRÁI (5 phần): BẢNG GIÁ VÀNG TRỰC TIẾP */}
            <div id="gold-rates-board" className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between transition-all duration-300">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Bảng Giá Vàng Thời Gian Thực</h2>
                      <p className="text-[11px] text-slate-500">Hệ thống DOJI, SJC & Chênh lệch Thế giới</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddGoldGoal}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Tạo mục tiêu tích sản Vàng tại Tab 3"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>+ Mục Tiêu Vàng</span>
                  </button>
                </div>

                {/* Sub-filter tabs */}
                <div className="flex items-center gap-1.5 my-3 text-[11px] font-bold">
                  {(['doji', 'nhan', 'sjc', 'all'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setGoldFilter(tab)}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        goldFilter === tab
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab === 'doji' ? 'Hệ Thống DOJI' : tab === 'nhan' ? 'Nhẫn 9999' : tab === 'sjc' ? 'SJC Miếng' : 'Tất Cả'}
                    </button>
                  ))}
                </div>

                {/* Bảng giá vàng chi tiết */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10.5px]">
                        <th className="py-2 px-2.5">Sản Phẩm Vàng</th>
                        <th className="py-2 px-2 text-right">Mua Vào (đ/chỉ)</th>
                        <th className="py-2 px-2.5 text-right">Bán Ra (đ/chỉ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredGoldItems.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-5 text-center text-slate-400 text-xs italic">
                            Chưa có dữ liệu cho phân loại này.
                          </td>
                        </tr>
                      ) : (
                        filteredGoldItems.slice(0, 6).map((item, idx) => {
                          const buy = item.buyPerChi || item.buyPrice || 0;
                          const sell = item.sellPerChi || item.sellPrice || 0;
                          const unit = item.unit || 'chỉ';
                          return (
                            <tr key={`${item.brand}-${item.name}-${idx}`} className="hover:bg-amber-50/40 transition">
                              <td className="py-2 px-2.5">
                                <div className="font-bold text-slate-800 text-[11px] leading-snug">{item.name}</div>
                                <div className="text-[9.5px] text-slate-400 font-medium">
                                  {item.brand} • {unit}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-semibold text-emerald-700 text-[11px] whitespace-nowrap">
                                {isPrivacyMode ? '••••••' : formatVND(buy)}
                              </td>
                              <td className="py-2 px-2.5 text-right font-black text-amber-700 text-[11px] whitespace-nowrap">
                                {isPrivacyMode ? '••••••' : formatVND(sell)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Thế giới & chênh lệch */}
                {goldData?.world && (
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1 text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>Giá Vàng Thế Giới (Spot):</span>
                      <span className="font-bold text-slate-900">${goldData.world.usdPerOunce.toLocaleString()} /oz</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Quy đổi tỷ giá VNĐ:</span>
                      <span className="font-bold text-slate-900">~{formatVND(goldData.world.convertedVndPerChi)} /chỉ</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-800 font-bold pt-1 border-t border-slate-200 text-[11.5px]">
                      <span>Chênh lệch DOJI vs Thế Giới:</span>
                      <span>+{formatVND(goldData.world.diffVsDojiSell)} /chỉ</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Nút thao tác nhanh áp giá */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Tự động cập nhật giá bán DOJI vào mục tiêu Tab 3</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                  Tự Động Kết Nối
                </span>
              </div>
            </div>

            {/* CỘT PHẢI (7 phần): BẢNG GIÁ CỔ PHIẾU VN30 & MỤC TIÊU SỞ HỮU */}
            <div id="stock-rates-board" className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between transition-all duration-300">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Bảng Giá Cổ Phiếu & Tích Sản</h2>
                      <p className="text-[11px] text-slate-500">Rổ VN30, danh mục sở hữu (Tab 1) & mục tiêu (Tab 3)</p>
                    </div>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm / gõ mã CP (VD: TCB, HPG)..."
                      value={searchTicker}
                      onChange={(e) => setSearchTicker(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* THẺ TRA CỨU BCTC TCBS KHI GÕ MÃ CỔ PHIẾU */}
                {isSearchingRatio && (
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-blue-800 animate-pulse my-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Đang tra cứu BCTC và chỉ số P/E, P/B, ROE từ TCBS cho <b>{searchTicker.toUpperCase()}</b>...</span>
                  </div>
                )}

                {searchedRatio && !isSearchingRatio && (
                  <div className="p-3 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200 rounded-xl shadow-2xs space-y-2 my-2.5">
                    <div className="flex items-center justify-between gap-2 border-b border-blue-100 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                          {searchedRatio.symbol}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">{searchedRatio.symbol}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">
                              {searchedRatio.industry || 'Niêm yết'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">Kỳ: {searchedRatio.period}</span>
                          </div>
                          <span className="text-[9.5px] text-slate-500">Nguồn: {searchedRatio.source || 'TCBS BCTC'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const quote = stockData ? getStockQuote(stockData, searchedRatio.symbol) : null;
                          const price = quote?.price || 28000;
                          handleAddStockGoalFromRec({
                            symbol: searchedRatio.symbol,
                            name: searchedRatio.industry || searchedRatio.symbol,
                            pillar: 'finance',
                            pillarLabel: 'Tra cứu BCTC TCBS',
                            actionZone: 'buy_dca',
                            actionZoneLabel: 'Tích Sản Định Kỳ',
                            reason: `Chỉ số P/E: ${searchedRatio.pe || '--'}x, P/B: ${searchedRatio.pb || '--'}x, ROE: ${searchedRatio.roe || '--'}%`,
                            valuationNote: searchedRatio.rating || 'Định giá cập nhật trực tuyến',
                            targetHorizon: '1 - 3 năm',
                          } as Top3Recommendation);
                        }}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-md text-[10px] font-bold transition flex items-center gap-1 shadow-2xs"
                      >
                        <PlusCircle className="w-3 h-3" />
                        <span>+ Mục Tiêu (Tab 3)</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                      <div className="bg-white p-1 rounded border border-blue-100">
                        <span className="text-slate-400 text-[8px] block">P/E</span>
                        <span className="font-black text-slate-900 font-mono">{searchedRatio.pe ? `${searchedRatio.pe}x` : 'N/A'}</span>
                      </div>
                      <div className="bg-white p-1 rounded border border-blue-100">
                        <span className="text-slate-400 text-[8px] block">P/B</span>
                        <span className="font-black text-slate-900 font-mono">{searchedRatio.pb ? `${searchedRatio.pb}x` : 'N/A'}</span>
                      </div>
                      <div className="bg-white p-1 rounded border border-blue-100">
                        <span className="text-slate-400 text-[8px] block">ROE</span>
                        <span className="font-black text-emerald-700 font-mono">{searchedRatio.roe ? `${searchedRatio.roe}%` : 'N/A'}</span>
                      </div>
                      <div className="bg-white p-1 rounded border border-blue-100">
                        <span className="text-slate-400 text-[8px] block">ROA</span>
                        <span className="font-black text-indigo-700 font-mono">{searchedRatio.roa ? `${searchedRatio.roa}%` : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bảng giá cổ phiếu - Đã tinh gọn: gộp biến động & số lượng đã có vào Mã CP, bỏ cột Biến Động và T1/T3 */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 mt-3 max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="text-slate-600 font-bold border-b border-slate-200 text-[10px] sm:text-[10.5px]">
                        <th className="py-2 px-2.5 min-w-[170px]">Mã CP & BCTC TCBS</th>
                        <th className="py-2 px-2 text-right whitespace-nowrap min-w-[90px]">Giá Khớp</th>
                        <th className="py-2 px-2 text-center min-w-[210px] sm:min-w-[240px]">
                          <div className="flex flex-col items-center">
                            <span className="text-slate-800 font-extrabold flex items-center gap-1">
                              <Target className="w-3 h-3 text-indigo-600 inline" />
                              Đáy 5T • 10T • 20T • 30T • 52T
                            </span>
                            <span className="text-[8.5px] text-slate-400 font-normal">Giá thấp nhất & Vùng gom</span>
                          </div>
                        </th>
                        <th className="py-2 px-2 text-center whitespace-nowrap">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {stockRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 font-medium text-xs">
                            Không tìm thấy mã cổ phiếu nào.
                          </td>
                        </tr>
                      ) : (
                        stockRows.map((row) => {
                          const quote: StockQuoteItem | undefined = row.quote;
                          const price = quote?.price || 20000;
                          const change = quote?.change || 0;
                          const changePct = quote?.changePercent || 0;
                          const isUp = change > 0;
                          const isDown = change < 0;
                          const r = ratiosMap[row.symbol];

                          return (
                            <tr key={row.symbol} className="hover:bg-blue-50/40 transition">
                              {/* Cột 1: Mã CP, Biến Động, Doanh nghiệp & Chỉ số BCTC TCBS */}
                              <td className="py-2 px-2.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-black text-slate-900 text-xs sm:text-[13px] tracking-tight">
                                    {row.symbol}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded leading-none ${
                                      isUp
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : isDown
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {isUp && <ArrowUpRight className="w-2.5 h-2.5" />}
                                    {isDown && <ArrowDownRight className="w-2.5 h-2.5" />}
                                    {change > 0 ? `+${change}` : change} ({changePct > 0 ? `+${changePct}` : changePct}%)
                                  </span>
                                </div>

                                <div className="text-[10px] text-slate-500 font-medium truncate max-w-[150px] mt-0.5">
                                  {quote?.name || row.name}
                                </div>

                                {/* BCTC TCBS trực tuyến */}
                                {r ? (
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono">
                                    <span className="text-slate-400">P/E: <b className="text-slate-700">{r.pe ? `${r.pe}x` : '--'}</b></span>
                                    <span className="text-slate-400">P/B: <b className="text-slate-700">{r.pb ? `${r.pb}x` : '--'}</b></span>
                                    <span className="text-emerald-700">ROE: <b>{r.roe ? `${r.roe}%` : '--'}</b></span>
                                  </div>
                                ) : (
                                  <div className="text-[8px] text-slate-400 mt-0.5">Đang quét BCTC TCBS...</div>
                                )}

                                <div className="text-[9.5px] text-slate-500 font-medium truncate max-w-[160px] sm:max-w-[200px] mt-0.5">
                                  {row.name}
                                </div>

                                {/* Số lượng đã có (Tab 1) */}
                                <div className="flex items-center gap-1.5 mt-1 text-[9.5px]">
                                  <span className="text-slate-400 font-medium">Đã có:</span>
                                  <span
                                    className={`font-bold px-1.5 py-0.2 rounded text-[9.5px] ${
                                      row.ownedCount > 0
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {row.ownedCount > 0 ? `${row.ownedCount.toLocaleString('vi-VN')} CP` : '0 CP'}
                                  </span>
                                </div>
                              </td>

                              {/* Cột 2: Giá khớp lệnh */}
                              <td className="py-2 px-2 text-right whitespace-nowrap">
                                <div className="font-black text-slate-900 text-xs sm:text-[13px]">
                                  {isPrivacyMode ? '••••••' : formatVND(price)}
                                </div>
                                {quote?.high && quote?.low ? (
                                  <div className="text-[8.5px] text-slate-400 font-mono mt-0.5">
                                    {(quote.low / 1000).toFixed(1)}k - {(quote.high / 1000).toFixed(1)}k
                                  </div>
                                ) : (
                                  <div className="text-[8.5px] text-slate-400 font-mono mt-0.5">
                                    {quote?.volume ? `${Math.round(quote.volume / 1000).toLocaleString('vi-VN')}k CP` : ''}
                                  </div>
                                )}
                              </td>

                              {/* Cột 3: Đánh giá đáy chu kỳ 5T, 10T, 20T, 30T, 52T & Vùng gom */}
                              <td className="py-2 px-2">
                                <div className="flex flex-col gap-1 min-w-[200px] sm:min-w-[230px]">
                                  {/* Dải 5 mốc đáy thấp nhất */}
                                  <div className="grid grid-cols-5 gap-1 text-[8.5px] sm:text-[9px] font-mono text-center">
                                    <div
                                      className="bg-slate-50 hover:bg-blue-50 border border-slate-200/90 rounded px-0.5 py-0.5 transition"
                                      title={`Đáy 5 tuần: ${formatVND(quote?.low5w || price)} (Cách đáy: +${quote?.diffFromLow5wPct ?? 0}%)`}
                                    >
                                      <div className="text-[7.5px] text-slate-400 font-sans font-bold">5T</div>
                                      <div className="font-bold text-slate-800 leading-tight">
                                        {((quote?.low5w || price) / 1000).toFixed(1)}k
                                      </div>
                                      <div className="text-[7px] text-slate-500 leading-none">
                                        +{quote?.diffFromLow5wPct ?? 0}%
                                      </div>
                                    </div>
                                    <div
                                      className="bg-slate-50 hover:bg-blue-50 border border-slate-200/90 rounded px-0.5 py-0.5 transition"
                                      title={`Đáy 10 tuần: ${formatVND(quote?.low10w || price)} (Cách đáy: +${quote?.diffFromLow10wPct ?? 0}%)`}
                                    >
                                      <div className="text-[7.5px] text-slate-400 font-sans font-bold">10T</div>
                                      <div className="font-bold text-slate-800 leading-tight">
                                        {((quote?.low10w || price) / 1000).toFixed(1)}k
                                      </div>
                                      <div className="text-[7px] text-slate-500 leading-none">
                                        +{quote?.diffFromLow10wPct ?? 0}%
                                      </div>
                                    </div>
                                    <div
                                      className="bg-slate-50 hover:bg-blue-50 border border-slate-200/90 rounded px-0.5 py-0.5 transition"
                                      title={`Đáy 20 tuần: ${formatVND(quote?.low20w || price)} (Cách đáy: +${quote?.diffFromLow20wPct ?? 0}%)`}
                                    >
                                      <div className="text-[7.5px] text-slate-400 font-sans font-bold">20T</div>
                                      <div className="font-bold text-slate-800 leading-tight">
                                        {((quote?.low20w || price) / 1000).toFixed(1)}k
                                      </div>
                                      <div className="text-[7px] text-slate-500 leading-none">
                                        +{quote?.diffFromLow20wPct ?? 0}%
                                      </div>
                                    </div>
                                    <div
                                      className="bg-slate-50 hover:bg-blue-50 border border-slate-200/90 rounded px-0.5 py-0.5 transition"
                                      title={`Đáy 30 tuần: ${formatVND(quote?.low30w || price)} (Cách đáy: +${quote?.diffFromLow30wPct ?? 0}%)`}
                                    >
                                      <div className="text-[7.5px] text-slate-400 font-sans font-bold">30T</div>
                                      <div className="font-bold text-slate-800 leading-tight">
                                        {((quote?.low30w || price) / 1000).toFixed(1)}k
                                      </div>
                                      <div className="text-[7px] text-slate-500 leading-none">
                                        +{quote?.diffFromLow30wPct ?? 0}%
                                      </div>
                                    </div>
                                    <div
                                      className="bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200 rounded px-0.5 py-0.5 shadow-2xs transition"
                                      title={`Đáy 52 tuần: ${formatVND(quote?.low52w || price)} (Cách đáy 52T: +${quote?.diffFromLow52wPct ?? 0}%)`}
                                    >
                                      <div className="text-[7.5px] text-indigo-700 font-sans font-black">52T</div>
                                      <div className="font-black text-indigo-900 leading-tight">
                                        {((quote?.low52w || price) / 1000).toFixed(1)}k
                                      </div>
                                      <div className="text-[7px] font-bold text-indigo-700 leading-none">
                                        +{quote?.diffFromLow52wPct ?? 0}%
                                      </div>
                                    </div>
                                  </div>

                                  {/* Đánh giá trạng thái định giá */}
                                  <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[9.5px]">
                                    <span className="inline-flex items-center gap-1 font-bold text-slate-700 truncate">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                          (quote?.diffFromLow52wPct ?? 10) <= 5
                                            ? 'bg-emerald-500'
                                            : (quote?.diffFromLow20wPct ?? 10) <= 5
                                            ? 'bg-blue-500'
                                            : (quote?.diffFromLow5wPct ?? 10) <= 3
                                            ? 'bg-amber-500'
                                            : 'bg-slate-400'
                                        }`}
                                      />
                                      <span className="truncate">{quote?.valuationStatus || 'Vùng tích lũy'}</span>
                                    </span>
                                    <span className="text-[8px] sm:text-[8.5px] font-extrabold px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                                      +{(quote?.diffFromLow52wPct ?? 0)}% đáy 52T
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Cột 4: Nút Thao Tác thêm vào mục tiêu */}
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rec = dailyRecs.stocks.find((s) => s.symbol === row.symbol) || {
                                      symbol: row.symbol,
                                      name: row.name,
                                      pillar: 'finance',
                                      pillarLabel: 'Cổ phiếu Bluechip',
                                      actionZone: 'buy_dca',
                                      actionZoneLabel: 'Gom Tích Sản',
                                      reason: 'Tích sản cổ phiếu đầu ngành',
                                      valuationNote: 'Định giá hợp lý',
                                      targetHorizon: '1 - 3 năm',
                                    };
                                    handleAddStockGoalFromRec(rec as Top3Recommendation);
                                  }}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-[10px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs whitespace-nowrap"
                                  title="Thêm mã này vào mục tiêu tích sản Tab 3"
                                >
                                  <PlusCircle className="w-3 h-3" />
                                  <span>+ Mục Tiêu</span>
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

              {/* Trạng thái tự động đồng bộ giá cổ phiếu */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Tự động cập nhật giá khớp lệnh vào mục tiêu Tab 3</span>
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                  Tự Động Kết Nối
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SECTION: HỆ THỐNG KHUYẾN NGHỊ TỰ ĐỘNG CHỌN LỌC HÀNG NGÀY (DAILY AUTO-SCREENED) */}
      {(activeSection === 'all' || activeSection === 'recommendations') && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                  <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Khuyến Nghị Chọn Lọc Hàng Ngày</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Cập nhật: {dailyRecs.scanDate}
                    </span>
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Thuật toán chọn lọc danh mục an toàn, lãi suất cao nhất ~9.0% và đón sóng vĩ mô &gt;5 năm.
                  </p>
                </div>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.8 rounded-xl text-xs font-bold shrink-0 overflow-x-auto">
              {(['all', 'stocks', 'savings', 'bonds'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setRecCategory(cat)}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] whitespace-nowrap ${
                    recCategory === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'all'
                    ? 'Tất Cả'
                    : cat === 'stocks'
                    ? 'Cổ Phiếu DCA'
                    : cat === 'savings'
                    ? 'Tiết Kiệm (~9%)'
                    : 'Trái Phiếu'}
                </button>
              ))}
            </div>
          </div>

          {/* GRID CÁC KHUYẾN NGHỊ */}
          <div id="savings-rec-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 transition-all duration-300">
            {/* NHÓM 1: TIẾT KIỆM LÃI SUẤT CAO NHẤT (~9.0%) */}
            {(recCategory === 'all' || recCategory === 'savings') &&
              dailyRecs.savings.map((sav) => (
                <div
                  key={sav.id}
                  className="rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-white p-3 sm:p-4 flex flex-col justify-between hover:shadow-md transition relative"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                        {sav.screenBadge}
                      </span>
                      <span className="text-[9.5px] sm:text-[10px] text-emerald-700 font-extrabold bg-emerald-100/80 px-1.5 py-0.5 rounded-full">
                        Điểm: {sav.screenScore}/100
                      </span>
                    </div>

                    <h3 className="font-black text-slate-900 text-xs sm:text-sm leading-snug">
                      {sav.bankName}
                    </h3>

                    <div className="mt-2 p-2 rounded-lg bg-white border border-emerald-200/70 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-medium">Lãi suất thực nhận:</div>
                      <div className="text-sm sm:text-base font-black text-emerald-700">{sav.rateRange}</div>
                      <div className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 font-medium">{sav.term}</div>
                    </div>

                    <ul className="mt-2 space-y-1 text-[10.5px] sm:text-[11px] text-slate-600">
                      {sav.highlights.slice(0, 2).map((h, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-medium truncate max-w-[110px]">
                      {sav.safetyRating.split('•')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddSavingsGoalFromRec(sav)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>Đưa Vào Tab 3</span>
                    </button>
                  </div>
                </div>
              ))}

            {/* NHÓM 2: CỔ PHIẾU TÍCH SẢN DCA */}
            {(recCategory === 'all' || recCategory === 'stocks') &&
              dailyRecs.stocks.map((stock) => (
                <div
                  key={stock.symbol}
                  className="rounded-xl border border-blue-200/80 bg-gradient-to-b from-blue-50/50 to-white p-3 sm:p-4 flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-black bg-blue-600 text-white shadow-2xs">
                        {stock.screenBadge}
                      </span>
                      <span className="text-[9.5px] sm:text-[10px] text-blue-700 font-extrabold bg-blue-100/80 px-1.5 py-0.5 rounded-full">
                        Điểm: {stock.screenScore}/100
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base sm:text-lg font-black text-slate-900">{stock.symbol}</span>
                      <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">{stock.name}</span>
                    </div>

                    <div className="mt-2 p-2 rounded-lg bg-white border border-blue-200/70 shadow-2xs text-[10.5px] sm:text-[11px] space-y-0.5">
                      <div className="text-blue-800 font-bold">{stock.pillarLabel}</div>
                      <div className="text-emerald-700 font-semibold">{stock.valuationNote}</div>
                    </div>

                    <p className="mt-2 text-[10.5px] sm:text-[11px] text-slate-600 leading-snug">
                      {stock.reason}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-medium truncate max-w-[110px]">
                      Tầm nhìn: {stock.targetHorizon}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddStockGoalFromRec(stock as Top3Recommendation)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>Đưa Vào Tab 3</span>
                    </button>
                  </div>
                </div>
              ))}

            {/* NHÓM 3: TRÁI PHIẾU DOANH NGHIỆP AN TOÀN */}
            {(recCategory === 'all' || recCategory === 'bonds') &&
              dailyRecs.bonds.map((bond) => (
                <div
                  key={bond.id}
                  className="rounded-xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-white p-3 sm:p-4 flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-black bg-indigo-600 text-white shadow-2xs">
                        {bond.screenBadge}
                      </span>
                      <span className="text-[9.5px] sm:text-[10px] text-indigo-700 font-extrabold bg-indigo-100/80 px-1.5 py-0.5 rounded-full">
                        Điểm: {bond.screenScore}/100
                      </span>
                    </div>

                    <h3 className="font-black text-slate-900 text-xs sm:text-sm leading-snug">
                      {bond.issuerName}
                    </h3>

                    <div className="mt-2 p-2 rounded-lg bg-white border border-indigo-200/70 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-medium">Lãi suất coupon:</div>
                      <div className="text-sm sm:text-base font-black text-indigo-700">{bond.couponRange}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">{bond.creditRating}</div>
                    </div>

                    <ul className="mt-2 space-y-1 text-[10.5px] sm:text-[11px] text-slate-600">
                      {bond.highlights.slice(0, 2).map((h, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <CheckCircle2 className="w-3 h-3 text-indigo-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-medium truncate max-w-[110px]">
                      Kỳ hạn: {bond.tenor.split('(')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddBondGoalFromRec(bond)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>Đưa Vào Tab 3</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* BẢNG LÃI SUẤT NGÂN HÀNG TRỰC TUYẾN THEO NGÀY (LIVE BANK RATES TABLE) */}
          {(recCategory === 'all' || recCategory === 'savings') && (
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2.5 mt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      <span>Bảng Lãi Suất Ngân Hàng Trực Tuyến Tự Động Theo Ngày</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {bankRates?.updatedAtStr || 'Đang cập nhật'}
                      </span>
                    </h3>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500">
                      Nguồn: Topi & Biểu phí ngân hàng • Khảo sát lãi suất gửi trực tuyến (Online) và tại quầy
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setBankRateSubTab('topOnline')}
                      className={`px-2 py-0.8 rounded transition cursor-pointer ${
                        bankRateSubTab === 'topOnline'
                          ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Top Lãi Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankRateSubTab('cdHighYield')}
                      className={`px-2 py-0.8 rounded transition cursor-pointer flex items-center gap-1 ${
                        bankRateSubTab === 'cdHighYield'
                          ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                          : 'text-emerald-800 hover:text-emerald-950 bg-emerald-50/80 font-bold'
                      }`}
                      title="Chứng chỉ tiền gửi & Gói sinh lời cao trực tuyến (NCB An Phú 9.3% - 9.4%, Cake 9.4%, VPBank CCTG 9.0%)"
                    >
                      <span>CCTG & Siêu Lãi (8.5 - 9.4%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankRateSubTab('special')}
                      className={`px-2 py-0.8 rounded transition cursor-pointer flex items-center gap-1 ${
                        bankRateSubTab === 'special'
                          ? 'bg-amber-500 text-white shadow-2xs font-bold'
                          : 'text-amber-700 hover:text-amber-900 bg-amber-50/60'
                      }`}
                      title="Các gói lãi suất 9.0% - 10.0% với điều kiện số dư khủng (500 tỷ - 2.000 tỷ)"
                    >
                      <span>Gói &gt;500 Tỷ (9 - 10%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankRateSubTab('big4')}
                      className={`px-2 py-0.8 rounded transition cursor-pointer ${
                        bankRateSubTab === 'big4'
                          ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Big 4 Quốc Doanh
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankRateSubTab('allOnline')}
                      className={`px-2 py-0.8 rounded transition cursor-pointer ${
                        bankRateSubTab === 'allOnline'
                          ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Toàn Bộ Online
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefreshLiveBankRates}
                    disabled={isLoadingBankRates}
                    className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition cursor-pointer shadow-2xs"
                    title="Quét lại lãi suất ngân hàng mới nhất"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBankRates ? 'animate-spin text-emerald-600' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Banner minh bạch: Phân loại 3 cấp độ lãi suất */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5 text-slate-700 text-xs shadow-2xs">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  💡
                </div>
                <div className="space-y-1 text-[11px] sm:text-xs leading-relaxed">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Phân loại các nhóm lãi suất thực tế trên thị trường:</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold">
                      Cập nhật trực tuyến liên tục theo ngày
                    </span>
                  </div>
                  <p className="text-slate-600">
                    • <b>CCTG &amp; Gói Tích Lũy Dài Hạn (8.5% – 9.4%/năm):</b> Áp dụng tại tab <i>"CCTG &amp; Siêu Lãi (8.5 - 9.4%)"</i> như <b>NCB (Tiết kiệm An Phú &amp; Chứng chỉ tiền gửi 9.3% – 9.4%)</b>, Cake by VPBank (ưu đãi tích lũy tới 9.4%), VPBank CCTG (9.0%). Vốn linh hoạt từ 10 – 50 triệu, chuyển nhượng tự do.<br />
                    • <b>Sổ Online Chuẩn 12 Tháng (6.8% – 7.8%/năm):</b> Tab <i>"Top Lãi Online"</i> (ACB, LPBank, Sacombank, MBV...) cho mọi khoản tiền từ 1 triệu đồng không ràng buộc.<br />
                    • <b>Gói Siêu Khủng 9.0% – 10.0%/năm:</b> Yêu cầu số dư tối thiểu từ <b>500 tỷ đến 2.000 tỷ đồng</b> tại quầy (PVcomBank, HDBank, MSB).
                  </p>
                </div>
              </div>

              {/* Table hiển thị lãi suất ngân hàng */}
              <div className="overflow-x-auto max-h-[280px] overflow-y-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 z-10 text-[9.5px] sm:text-[10px] font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5">Ngân Hàng</th>
                      {bankRateSubTab === 'cdHighYield' ? (
                        <>
                          <th className="py-1.5 px-2 text-center bg-emerald-50 text-emerald-900 font-bold">6 Tháng</th>
                          <th className="py-1.5 px-2 text-center bg-emerald-100 text-emerald-950 font-bold">12 Tháng</th>
                          <th className="py-1.5 px-2 text-center bg-amber-100 text-amber-950 font-black">18 - 36T / CCTG</th>
                          <th className="py-1.5 px-2.5 text-left text-slate-800 font-bold">Hình Thức &amp; Điều Kiện Áp Dụng</th>
                          <th className="py-1.5 px-2.5 text-center">Hành Động</th>
                        </>
                      ) : bankRateSubTab === 'special' ? (
                        <>
                          <th className="py-1.5 px-2 text-center bg-amber-50 text-amber-900 font-black">6 Tháng</th>
                          <th className="py-1.5 px-2 text-center bg-amber-100 text-amber-950 font-black">12 Tháng</th>
                          <th className="py-1.5 px-2 text-center bg-amber-50 text-amber-900 font-black">24 Tháng</th>
                          <th className="py-1.5 px-2.5 text-left text-amber-950 font-bold">Điều Kiện Bắt Buộc (Lý Do Có Lãi Suất 9-10%)</th>
                          <th className="py-1.5 px-2.5 text-center">Hành Động</th>
                        </>
                      ) : (
                        <>
                          <th className="py-1.5 px-2 text-center">KKH</th>
                          <th className="py-1.5 px-2 text-center">1 Tháng</th>
                          <th className="py-1.5 px-2 text-center">3 Tháng</th>
                          <th className="py-1.5 px-2 text-center bg-emerald-50 text-emerald-800">6 Tháng</th>
                          <th className="py-1.5 px-2 text-center bg-emerald-100 text-emerald-900 font-black">12 Tháng</th>
                          <th className="py-1.5 px-2 text-center">24 Tháng</th>
                          <th className="py-1.5 px-2.5 text-center">Hành Động</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10.5px]">
                    {(() => {
                      let displayList: BankRateItem[] = [];
                      if (bankRateSubTab === 'cdHighYield') {
                        displayList = bankRates?.cdAndHighYieldRates || [];
                      } else if (bankRateSubTab === 'special') {
                        displayList = bankRates?.specialHighRates || [];
                      } else if (bankRateSubTab === 'topOnline') {
                        displayList = bankRates?.topOnline12M || [];
                      } else if (bankRateSubTab === 'big4') {
                        displayList = bankRates?.big4Rates || [];
                      } else {
                        displayList =
                          bankRates?.onlineRates && bankRates.onlineRates.length > 0
                            ? bankRates.onlineRates
                            : bankRates?.topOnline12M || [];
                      }

                      if (displayList.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="py-5 text-center text-slate-400 text-xs">
                              Đang tải dữ liệu biểu lãi suất ngân hàng...
                            </td>
                          </tr>
                        );
                      }

                      if (bankRateSubTab === 'cdHighYield') {
                        return displayList.map((item, idx) => (
                          <tr key={`${item.bank}-${idx}`} className="hover:bg-emerald-50/50 transition">
                            <td className="py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                                <span>{item.bank}</span>
                              </div>
                              {item.productType && (
                                <div className="text-[9.5px] text-emerald-700 font-medium mt-0.5">{item.productType}</div>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center font-semibold text-slate-700 font-mono text-[11px]">
                              {item.m6 ? `${item.m6}%` : '--'}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-emerald-800 font-mono text-[11px]">
                              {item.m12 ? `${item.m12}%` : '--'}
                            </td>
                            <td className="py-2 px-2 text-center font-black text-rose-700 bg-emerald-50/80 font-mono text-xs">
                              {item.m24 || item.m18 ? `${item.m24 || item.m18}%` : '--'}
                            </td>
                            <td className="py-2 px-2.5 text-left">
                              <div className="text-slate-800 font-medium text-[10.5px]">
                                {item.condition || 'Từ 10 - 50 triệu đồng'}
                              </div>
                              {item.note && (
                                <div className="text-[9.5px] text-slate-500 mt-0.5">{item.note}</div>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  handleAddSavingsGoalFromRec({
                                    id: `cd-${item.bank}`,
                                    bankName: item.bank,
                                    rateRange: `${item.m24 || item.m18 || item.m12 || 9.3}%/năm`,
                                    term: 'Kỳ hạn 18 - 36T / Chứng Chỉ Tiền Gửi',
                                    safetyRating: 'Bảo hiểm tiền gửi NHNN 100%',
                                    highlights: [
                                      `Lãi suất thực nhận: ${item.m24 || item.m18 || 9.3}%/năm`,
                                      item.condition || 'Được phép chuyển nhượng linh hoạt',
                                      item.note || 'Tối ưu cho Quỹ Runway an toàn',
                                    ],
                                    advice: 'Khuyên dùng để khóa trần lãi suất thực dương cao cho quỹ an toàn.',
                                    screenBadge: 'CCTG Siêu Lãi',
                                    screenScore: 99,
                                    defaultRate: item.m24 || item.m18 || 9.3,
                                    defaultBankKey: item.bank,
                                    defaultMonths: 24,
                                  })
                                }
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer shadow-2xs"
                              >
                                + Chọn gửi
                              </button>
                            </td>
                          </tr>
                        ));
                      }

                      if (bankRateSubTab === 'special') {
                        return displayList.map((item, idx) => (
                          <tr key={`${item.bank}-${idx}`} className="hover:bg-amber-50/50 transition">
                            <td className="py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                <span>{item.bank}</span>
                              </div>
                              {item.note && (
                                <div className="text-[9.5px] text-slate-500 font-normal mt-0.5">{item.note}</div>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-amber-800 bg-amber-50/40 font-mono text-[11px]">
                              {item.m6 ? `${item.m6}%` : '--'}
                            </td>
                            <td className="py-2 px-2 text-center font-black text-rose-700 bg-amber-100/60 font-mono text-xs">
                              {item.m12 ? `${item.m12}%` : '--'}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-amber-800 bg-amber-50/40 font-mono text-[11px]">
                              {item.m24 ? `${item.m24}%` : '--'}
                            </td>
                            <td className="py-2 px-2.5 text-left">
                              <span className="inline-block px-2 py-0.8 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-medium text-[10.5px]">
                                ⚠️ {item.condition || 'Yêu cầu số dư khủng từ 500 tỷ trở lên'}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  handleAddSavingsGoalFromRec({
                                    id: `bank-special-${item.bank}`,
                                    bankName: item.bank,
                                    rateRange: `${item.m12 || 9.0}%/năm`,
                                    term: 'Gói đặc biệt (Điều kiện lớn)',
                                    safetyRating: 'Bảo hiểm tiền gửi NHNN',
                                    highlights: [
                                      `Lãi suất niêm yết: ${item.m12 || 9.0}%/năm`,
                                      item.condition || 'Yêu cầu số dư lớn',
                                    ],
                                    advice: 'Cần liên hệ trực tiếp hội sở ngân hàng để xác nhận điều kiện số dư.',
                                    screenBadge: 'Gói Đặc Biệt',
                                    screenScore: 95,
                                    defaultRate: item.m12 || 9.0,
                                    defaultBankKey: item.bank,
                                  })
                                }
                                className="px-2 py-0.8 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] transition cursor-pointer"
                              >
                                + Tham khảo
                              </button>
                            </td>
                          </tr>
                        ));
                      }

                      return displayList.map((item, idx) => (
                        <tr key={`${item.bank}-${idx}`} className="hover:bg-emerald-50/40 transition">
                          <td className="py-1.5 px-2.5 font-bold text-slate-800 whitespace-nowrap">
                            {item.bank}
                          </td>
                          <td className="py-1.5 px-2 text-center text-slate-500 font-mono text-[10px]">
                            {item.kkh ? `${item.kkh}%` : '--'}
                          </td>
                          <td className="py-1.5 px-2 text-center text-slate-600 font-mono text-[10px]">
                            {item.m1 ? `${item.m1}%` : '--'}
                          </td>
                          <td className="py-1.5 px-2 text-center text-slate-600 font-mono text-[10px]">
                            {item.m3 ? `${item.m3}%` : '--'}
                          </td>
                          <td className="py-1.5 px-2 text-center font-bold text-emerald-700 bg-emerald-50/50 font-mono">
                            {item.m6 ? `${item.m6}%` : '--'}
                          </td>
                          <td className="py-1.5 px-2 text-center font-black text-emerald-800 bg-emerald-100/50 font-mono text-[11px]">
                            {item.m12 ? `${item.m12}%` : '--'}
                          </td>
                          <td className="py-1.5 px-2 text-center text-slate-700 font-mono">
                            {item.m24 ? `${item.m24}%` : '--'}
                          </td>
                          <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                handleAddSavingsGoalFromRec({
                                  id: `bank-${item.bank}`,
                                  bankName: item.bank,
                                  rateRange: `${item.m12 || item.m6 || 6.8}%/năm`,
                                  term: '12 Tháng (Trực tuyến)',
                                  safetyRating: 'An toàn bảo hiểm tiền gửi NHNN',
                                  highlights: [
                                    `Lãi suất 12 tháng: ${item.m12 || 7.0}%/năm`,
                                    `Lãi suất 6 tháng: ${item.m6 || 6.5}%/năm`,
                                    'Gửi trực tuyến trên App ngân hàng nhận lãi suất tối ưu',
                                  ],
                                  advice: 'Lập sổ tích lũy dự phòng tài chính hoặc chia nhỏ dòng tiền an toàn.',
                                  screenBadge: 'Lãi Suất Ngày',
                                  screenScore: 92,
                                  defaultRate: item.m12 || 6.8,
                                  defaultBankKey: item.bank,
                                })
                              }
                              className="px-2 py-0.8 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px] transition cursor-pointer"
                            >
                              + Chọn gửi
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. SECTION: TOÀN CẢNH PHÂN TÍCH VĨ MÔ & 4 TRỤ CỘT (>5 NĂM) */}
      {(activeSection === 'all' || activeSection === 'macro') && (
        <div className="space-y-3.5">
          <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
            <div className="border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold shrink-0">
                  <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-700" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Phân Tích Vĩ Mô & Tầm Nhìn &gt;5 Năm
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    4 Trụ Cột Hoạch Định • Chu kỳ tiền tệ, Lãi suất ~9.0%, Hạ tầng 67 tỷ USD & Kỷ luật tích sản
                  </p>
                </div>
              </div>
            </div>

            {/* Grid 4 Trụ Cột Vĩ Mô */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* TRỤ CỘT 1: LÃI SUẤT NGÂN HÀNG & TIỀN GỬI */}
              <div className="p-3 sm:p-4 rounded-xl border border-blue-200/80 bg-blue-50/40 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-blue-900 text-xs sm:text-sm">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.bankRates.title}
                    </span>
                    <span className="px-1.5 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 shrink-0">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.bankRates.tag}
                    </span>
                  </div>

                  <div className="mt-1.5 space-y-1 text-[11px] text-slate-700">
                    <p className="font-bold text-slate-900 text-[11.5px]">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.bankRates.currentReality.label}
                    </p>
                    <ul className="space-y-0.5 pl-3 list-disc text-slate-600">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.bankRates.currentReality.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-2 p-2 rounded-lg bg-white border border-blue-200 text-[10.5px] sm:text-[11px] text-blue-950 font-medium">
                    <span className="font-bold text-blue-700 block">Dự đoán & Tác động:</span>
                    {MACRO_FINANCIAL_OVERVIEW.pillars.bankRates.forecast.explanation}
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200/60 text-[10.5px] sm:text-[11px] text-slate-800 space-y-2">
                  <div>
                    <span className="font-bold text-emerald-800">Khuyến nghị phân bổ: </span>
                    {MACRO_FINANCIAL_OVERVIEW.pillars.bankRates.recommendation.actionDetail}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSwitchTab('debts')}
                    className="w-full py-1.5 sm:py-2 px-2.5 sm:px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Scale className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="hidden sm:inline">Kiểm Tra DSTI & Thẩm Định Phương Án Vay (Tab 2) ➔</span>
                    <span className="sm:hidden">Kiểm Tra DSTI & Vay BĐS (Tab 2) ➔</span>
                  </button>
                </div>
              </div>

              {/* TRỤ CỘT 2: FED & TIỀN TỆ TOÀN CẦU */}
              <div className="p-3 sm:p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/40 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-emerald-900 text-xs sm:text-sm">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.fedRates.title}
                    </span>
                    <span className="px-1.5 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.fedRates.tag}
                    </span>
                  </div>

                  <div className="mt-1.5 space-y-1 text-[11px] text-slate-700">
                    <p className="font-bold text-slate-900 text-[11.5px]">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.fedRates.currentReality.label}
                    </p>
                    <ul className="space-y-0.5 pl-3 list-disc text-slate-600">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.fedRates.currentReality.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-2 p-2 rounded-lg bg-white border border-emerald-200 text-[10.5px] sm:text-[11px] text-emerald-950 font-medium">
                    <span className="font-bold text-emerald-700 block">Dự đoán & Tác động:</span>
                    {MACRO_FINANCIAL_OVERVIEW.pillars.fedRates.forecast.explanation}
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 text-[10.5px] sm:text-[11px] text-slate-800">
                  <span className="font-bold text-emerald-800">Khuyến nghị phân bổ: </span>
                  {MACRO_FINANCIAL_OVERVIEW.pillars.fedRates.recommendation.actionDetail}
                </div>
              </div>

              {/* TRỤ CỘT 3: CUNG TIỀN M2 & LẠM PHÁT */}
              <div className="p-3 sm:p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-amber-900 text-xs sm:text-sm">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.moneySupply.title}
                    </span>
                    <span className="px-1.5 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.moneySupply.tag}
                    </span>
                  </div>

                  <div className="mt-1.5 space-y-1 text-[11px] text-slate-700">
                    <p className="font-bold text-slate-900 text-[11.5px]">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.moneySupply.currentReality.label}
                    </p>
                    <ul className="space-y-0.5 pl-3 list-disc text-slate-600">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.moneySupply.currentReality.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-2 p-2 rounded-lg bg-white border border-amber-200 text-[10.5px] sm:text-[11px] text-amber-950 font-medium">
                    <span className="font-bold text-amber-700 block">Dự đoán & Tác động:</span>
                    {MACRO_FINANCIAL_OVERVIEW.pillars.moneySupply.forecast.explanation}
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/60 text-[10.5px] sm:text-[11px] text-slate-800">
                  <span className="font-bold text-amber-800">Khuyến nghị phân bổ: </span>
                  {MACRO_FINANCIAL_OVERVIEW.pillars.moneySupply.recommendation.actionDetail}
                </div>
              </div>

              {/* TRỤ CỘT 4: ĐẦU TƯ CÔNG, ĐƯỜNG SẮT CAO TỐC & NÂNG HẠNG */}
              <div className="p-3 sm:p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/40 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-indigo-900 text-xs sm:text-sm">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.govVision.title}
                    </span>
                    <span className="px-1.5 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 shrink-0">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.govVision.tag}
                    </span>
                  </div>

                  <div className="mt-1.5 space-y-1 text-[11px] text-slate-700">
                    <p className="font-bold text-slate-900 text-[11.5px]">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.govVision.currentReality.label}
                    </p>
                    <ul className="space-y-0.5 pl-3 list-disc text-slate-600">
                      {MACRO_FINANCIAL_OVERVIEW.pillars.govVision.currentReality.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-2 p-2 rounded-lg bg-white border border-indigo-200 text-[10.5px] sm:text-[11px] text-indigo-950 font-medium">
                    <span className="font-bold text-indigo-700 block">Dự đoán & Tác động:</span>
                    {MACRO_FINANCIAL_OVERVIEW.pillars.govVision.forecast.explanation}
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-200/60 text-[10.5px] sm:text-[11px] text-slate-800">
                  <span className="font-bold text-indigo-800">Khuyến nghị phân bổ: </span>
                  {MACRO_FINANCIAL_OVERVIEW.pillars.govVision.recommendation.actionDetail}
                </div>
              </div>
            </div>

            {/* TỔNG KẾT VÀ MA TRẬN PHÂN BỔ 4 LỚP TÀI SẢN */}
            <div className="mt-3.5 p-3.5 sm:p-4 rounded-xl bg-slate-900 text-white space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                <h3 className="font-black text-xs sm:text-sm text-yellow-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 shrink-0" />
                  <span>Ma Trận Phân Bổ 4 Lớp Tài Sản Tối Ưu (2026 – 2030)</span>
                </h3>
                <span className="text-[10px] text-slate-400">Chu kỳ lãi suất nới lỏng & hạ tầng</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                {MACRO_FINANCIAL_OVERVIEW.executiveSummary.allocationMatrix.map((item, idx) => (
                  <div key={idx} className="bg-white/10 p-2.5 rounded-lg border border-white/10 space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-yellow-200 text-[10.5px]">{item.assetClass}</span>
                      <span className="font-black text-emerald-400 text-[11px] sm:text-xs">{item.weightRange}</span>
                    </div>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-300 leading-snug">{item.role}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 text-[10.5px] sm:text-[11px] text-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <span className="leading-snug">
                  <b className="text-yellow-300">3 Nguyên Tắc:</b> Tích sản DCA đều • Tái đầu tư cổ tức & lãi • Kiểm soát DSTI &lt; 40%.
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSwitchTab('pyramid')}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs whitespace-nowrap"
                  >
                    <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300" />
                    <span className="hidden sm:inline">Xem Tháp Tài Sản (Tab 1)</span>
                    <span className="sm:hidden">Tháp TS (T1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchTab('goals')}
                    className="px-2.5 py-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs whitespace-nowrap"
                  >
                    <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-950" />
                    <span className="hidden sm:inline">Kế Hoạch Mục Tiêu (Tab 3)</span>
                    <span className="sm:hidden">Mục Tiêu (T3)</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION BANNER */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab('goals')}
            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10.5px] font-bold shrink-0 transition"
          >
            Xem Tab 3
          </button>
        </div>
      )}
    </div>
  );
};
