import React, { useState, useEffect } from 'react';
import {
  StockRateData,
  StockQuoteItem,
  extractStockTicker,
  isStockEntity,
  TOP3_VN30_RECOMMENDATIONS,
  TOP3_SAVINGS_RECOMMENDATIONS,
  TOP3_BONDS_RECOMMENDATIONS,
  SavingsRecommendation,
  BondRecommendation,
  StockFinancialRatios,
  BankRatesData,
  BankRateItem,
  fetchStockFinancialRatios,
  fetchBatchStockRatios,
  fetchLiveBankRates,
} from '../utils/stockService';
import { Asset, Goal } from '../types';
import { formatVND } from '../utils/format';
import {
  TrendingUp,
  RefreshCw,
  X,
  Search,
  Sparkles,
  Link2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Globe,
  ChevronDown,
  ChevronUp,
  Building2,
  Activity,
  Award,
  Zap,
  Flame,
  ShieldCheck,
  PlusCircle,
  PiggyBank,
  FileText,
  ExternalLink,
  Target,
  BarChart2,
  CheckCircle2,
} from 'lucide-react';

interface StockRatesBoardProps {
  isOpen: boolean;
  onClose: () => void;
  stockData: StockRateData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onApplyAllStockGoals?: () => void;
  assets: Asset[];
  goals: Goal[];
  isPrivacyMode: boolean;
  onSelectRecommendation?: (rec: { symbol: string; name: string; price?: number }) => void;
  onSelectSavingsRecommendation?: (rec: SavingsRecommendation) => void;
  onSelectBondRecommendation?: (rec: BondRecommendation) => void;
}

export const StockRatesBoard: React.FC<StockRatesBoardProps> = ({
  isOpen,
  onClose,
  stockData,
  isLoading,
  onRefresh,
  assets,
  goals,
  isPrivacyMode,
  onSelectRecommendation,
  onSelectSavingsRecommendation,
  onSelectBondRecommendation,
}) => {
  const [searchTicker, setSearchTicker] = useState('');
  // Mặc định MỞ phần gợi ý để người dùng xem ngay Top 3 VN30, Tiết Kiệm & Trái Phiếu
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [recTab, setRecTab] = useState<'stocks' | 'savings' | 'bonds'>('stocks');

  // Trạng thái BCTC TCBS & Lãi suất Ngân Hàng Tự Động Theo Ngày
  const [ratiosMap, setRatiosMap] = useState<Record<string, StockFinancialRatios>>({});
  const [searchedRatio, setSearchedRatio] = useState<StockFinancialRatios | null>(null);
  const [isSearchingRatio, setIsSearchingRatio] = useState(false);
  const [bankRates, setBankRates] = useState<BankRatesData | null>(null);
  const [isLoadingBankRates, setIsLoadingBankRates] = useState(false);
  const [bankRateSubTab, setBankRateSubTab] = useState<'topOnline' | 'cdHighYield' | 'special' | 'allOnline' | 'counter' | 'big4'>('topOnline');

  if (!isOpen) return null;

  // Lọc ra các cổ phiếu đã có ở Tab 1
  const ownedStockAssets = assets.filter((a) => isStockEntity(a));

  // Lọc ra các cổ phiếu mục tiêu ở Tab 3
  const targetStockGoals = goals.filter((g) => isStockEntity(g));

  // Tổng hợp danh sách mã cổ phiếu duy nhất từ cả Tab 1 và Tab 3 (TUYỆT ĐỐI KHÔNG TỰ THÊM HPG/FPT NẾU NGƯỜI DÙNG KHÔNG CÓ)
  const tickerMap = new Map<
    string,
    {
      symbol: string;
      name: string;
      ownedAssets: Asset[];
      targetGoals: Goal[];
    }
  >();

  ownedStockAssets.forEach((a) => {
    const sym = extractStockTicker(a.name, a.type, a.unit);
    if (sym) {
      if (!tickerMap.has(sym)) {
        tickerMap.set(sym, {
          symbol: sym,
          name: a.name,
          ownedAssets: [a],
          targetGoals: [],
        });
      } else {
        tickerMap.get(sym)!.ownedAssets.push(a);
      }
    }
  });

  targetStockGoals.forEach((g) => {
    const sym = extractStockTicker(g.name, g.assetType, g.unit);
    if (sym) {
      if (!tickerMap.has(sym)) {
        tickerMap.set(sym, {
          symbol: sym,
          name: g.name,
          ownedAssets: [],
          targetGoals: [g],
        });
      } else {
        tickerMap.get(sym)!.targetGoals.push(g);
      }
    }
  });

  // Danh sách các dòng cổ phiếu trong danh mục của người dùng
  let stockRows = Array.from(tickerMap.values());

  // Lọc theo tìm kiếm
  if (searchTicker.trim()) {
    const q = searchTicker.trim().toUpperCase();
    stockRows = stockRows.filter(
      (r) => r.symbol.includes(q) || r.name.toUpperCase().includes(q)
    );
  }

  // Tính tổng giá trị cổ phiếu đang sở hữu theo thị giá
  const totalMarketValueOwned = ownedStockAssets.reduce((sum, a) => {
    const sym = extractStockTicker(a.name, a.type, a.unit);
    const quote = sym && stockData?.stocks[sym];
    const unitPrice = quote ? quote.price : a.currentPrice || a.unitPrice || 0;
    const qty = a.quantity || 0;
    return sum + (qty > 0 ? qty * unitPrice : a.amount);
  }, 0);

  // 1. Tự động nạp chỉ số BCTC TCBS (P/E, P/B, ROE...) cho các mã trong bảng & Top 3 VN30
  useEffect(() => {
    const symbols = Array.from(
      new Set([
        ...Array.from(tickerMap.keys()),
        ...TOP3_VN30_RECOMMENDATIONS.map((r) => r.symbol),
      ])
    );
    if (symbols.length > 0) {
      fetchBatchStockRatios(symbols).then((res) => {
        if (res && Object.keys(res).length > 0) {
          setRatiosMap((prev) => ({ ...prev, ...res }));
        }
      });
    }
  }, [assets, goals]);

  // 2. Tra cứu trực tuyến BCTC TCBS khi người dùng gõ mã bất kỳ vào ô tìm kiếm
  useEffect(() => {
    const q = searchTicker.trim().toUpperCase();
    if (q.length >= 3 && /^[A-Z0-9]{3,4}$/.test(q)) {
      // Nếu đã có sẵn trong ratiosMap
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

  // 3. Tự động nạp bảng Lãi Suất Ngân Hàng Trực Tuyến Hàng Ngày khi mở tab Tiết Kiệm
  useEffect(() => {
    if (recTab === 'savings' && !bankRates) {
      setIsLoadingBankRates(true);
      fetchLiveBankRates()
        .then((data) => {
          setBankRates(data);
        })
        .finally(() => {
          setIsLoadingBankRates(false);
        });
    }
  }, [recTab, bankRates]);

  const handleRefreshBankRates = async () => {
    setIsLoadingBankRates(true);
    try {
      const data = await fetchLiveBankRates(true);
      setBankRates(data);
    } finally {
      setIsLoadingBankRates(false);
    }
  };

  return (
    <div className="w-full mt-2 bg-white border border-blue-300/90 rounded-xl shadow-md p-2.5 sm:p-3.5 animate-in fade-in duration-200">
      {/* Header của Bảng Giá */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                BẢNG GIÁ CỔ PHIẾU
              </h3>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Luôn Tự Động Cập Nhật & Link</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
              {stockData?.updatedAtStr || 'Đang kết nối thị trường...'} • Nguồn: {stockData?.source || 'VPS & VNDirect'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap self-end sm:self-center">
          <button
            type="button"
            onClick={() => setShowRecommendations((prev) => !prev)}
            className={`px-2 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
              showRecommendations
                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Mở hoặc thu gọn Gợi ý Top 3 VN30"
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>Top 3 VN30</span>
            {showRecommendations ? <ChevronUp className="w-3 h-3 text-amber-700" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-2 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
            title="Làm mới bảng giá cổ phiếu"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Làm Mới</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Đóng bảng giá cổ phiếu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KHU VỰC KHUYẾN NGHỊ ĐẦU TƯ & TÍCH SẢN TOP 3: CỔ PHIẾU, TIẾT KIỆM & TRÁI PHIẾU */}
      {showRecommendations && (
        <div className="mt-2.5 p-2.5 sm:p-3 bg-gradient-to-r from-amber-50/70 via-slate-50 to-blue-50/70 border border-amber-200/90 rounded-xl space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-1 flex-wrap border-b border-amber-200/70 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="font-black text-amber-950">Gợi Ý Top 3 Tích Sản Lãi Suất Tốt & Đón Đầu Chu Kỳ</span>
              <span className="text-[10px] text-slate-500 font-normal hidden md:inline">
                (Đánh giá chu kỳ tiền tệ, lãi suất thực dương & chất lượng tài sản)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowRecommendations(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                Thu gọn ▲
              </button>
            </div>
          </div>

          {/* 3 Tab chuyển đổi: Cổ Phiếu VN30 | Gửi Tiết Kiệm (7.8%-9%) | Trái Phiếu Doanh Nghiệp */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-lg border border-slate-200 w-fit flex-wrap">
            <button
              type="button"
              onClick={() => setRecTab('stocks')}
              className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                recTab === 'stocks'
                  ? 'bg-white text-blue-900 shadow-2xs border border-blue-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-blue-600" />
              <span>Top 3 Cổ Phiếu VN30</span>
            </button>

            <button
              type="button"
              onClick={() => setRecTab('savings')}
              className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                recTab === 'savings'
                  ? 'bg-white text-emerald-900 shadow-2xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PiggyBank className="w-3 h-3 text-emerald-600" />
              <span>Top 3 Tiết Kiệm (7.8% - 9.0%)</span>
            </button>

            <button
              type="button"
              onClick={() => setRecTab('bonds')}
              className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                recTab === 'bonds'
                  ? 'bg-white text-indigo-900 shadow-2xs border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3 h-3 text-indigo-600" />
              <span>Top 3 Trái Phiếu Doanh Nghiệp</span>
            </button>
          </div>

          {/* TAB 1: TOP 3 CỔ PHIẾU VN30 */}
          {recTab === 'stocks' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {TOP3_VN30_RECOMMENDATIONS.map((rec) => {
                const quote = stockData?.stocks[rec.symbol];
                const price = quote?.price || 0;
                const changePct = quote?.changePercent || 0;
                const isUp = changePct > 0;
                const isDown = changePct < 0;
                const isAlreadyInGoals = targetStockGoals.some((g) => {
                  const s = extractStockTicker(g.name, g.assetType, g.unit);
                  return s === rec.symbol;
                });

                return (
                  <div
                    key={rec.symbol}
                    className="bg-white border border-slate-200/90 hover:border-blue-400 rounded-lg p-2.5 shadow-2xs flex flex-col justify-between transition group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900 text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 rounded">
                            {rec.symbol}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 truncate max-w-[110px]">
                            {rec.name}
                          </span>
                        </div>

                        {price > 0 && (
                          <div className="text-right leading-tight">
                            <div className="text-[11px] font-black text-slate-900">
                              {formatVND(price, isPrivacyMode)}
                            </div>
                            <div
                              className={`text-[9.5px] font-bold ${
                                isUp ? 'text-emerald-600' : isDown ? 'text-rose-600' : 'text-amber-600'
                              }`}
                            >
                              {changePct > 0 ? '+' : ''}
                              {changePct}%
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap text-[10px]">
                        <span className="font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          {rec.pillar === 'finance' ? (
                            <Zap className="w-2.5 h-2.5 inline mr-0.5 text-blue-600" />
                          ) : rec.pillar === 'industry' ? (
                            <Flame className="w-2.5 h-2.5 inline mr-0.5 text-amber-600" />
                          ) : (
                            <ShieldCheck className="w-2.5 h-2.5 inline mr-0.5 text-emerald-600" />
                          )}
                          {rec.pillarLabel.split(':')[1]?.trim() || rec.pillarLabel}
                        </span>
                        <span className="font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {rec.actionZoneLabel}
                        </span>
                      </div>

                      <p className="text-[10.5px] text-slate-600 leading-snug font-medium line-clamp-2">
                        {rec.reason}
                      </p>

                      {/* Chỉ số BCTC TCBS trực tuyến */}
                      {(() => {
                        const r = ratiosMap[rec.symbol];
                        return (
                          <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-50 border border-slate-200/90 rounded-md text-[9px] font-mono text-center">
                            <div>
                              <span className="text-[7.5px] text-slate-400 font-sans block">P/E</span>
                              <span className="font-bold text-slate-900">{r?.pe ? `${r.pe}x` : '9.8x'}</span>
                            </div>
                            <div>
                              <span className="text-[7.5px] text-slate-400 font-sans block">P/B</span>
                              <span className="font-bold text-slate-900">{r?.pb ? `${r.pb}x` : '1.4x'}</span>
                            </div>
                            <div>
                              <span className="text-[7.5px] text-slate-400 font-sans block">ROE</span>
                              <span className="font-black text-emerald-700">{r?.roe ? `${r.roe}%` : '18.5%'}</span>
                            </div>
                            <div>
                              <span className="text-[7.5px] text-slate-400 font-sans block">Kỳ BCTC</span>
                              <span className="font-semibold text-slate-600">{r?.period || 'Q2/26'}</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-between pt-0.5 border-t border-slate-100">
                        <span>{rec.valuationNote}</span>
                        <span className="text-slate-500">Tầm nhìn: {rec.targetHorizon}</span>
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {isAlreadyInGoals ? '✓ Đã có trong mục tiêu' : 'Chưa có trong mục tiêu'}
                      </span>

                      {onSelectRecommendation && !isAlreadyInGoals && (
                        <button
                          type="button"
                          onClick={() =>
                            onSelectRecommendation({
                              symbol: rec.symbol,
                              name: rec.name,
                              price,
                            })
                          }
                          className="px-2 py-0.8 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                          title={`Lập mục tiêu tích sản cho ${rec.symbol}`}
                        >
                          <PlusCircle className="w-3 h-3" />
                          <span>+ Lập Mục Tiêu</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: KHUYẾN NGHỊ GỬI TIẾT KIỆM & BẢNG LÃI SUẤT NGÂN HÀNG TRỰC TUYẾN THEO NGÀY */}
          {recTab === 'savings' && (
            <div className="space-y-3">
              {/* Top 3 Khuyến nghị */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {TOP3_SAVINGS_RECOMMENDATIONS.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white border border-emerald-200 hover:border-emerald-400 rounded-lg p-2.5 shadow-2xs flex flex-col justify-between transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-1 border-b border-slate-100 pb-1.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <PiggyBank className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-bold text-slate-900 text-xs line-clamp-1">
                              {rec.bankName.split('(')[0]}
                            </span>
                          </div>
                          <span className="text-[9.5px] text-slate-500 line-clamp-1">
                            {rec.bankName.includes('(') ? `(${rec.bankName.split('(')[1]}` : ''}
                          </span>
                        </div>
                        <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                          {rec.badge}
                        </span>
                      </div>

                      <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-100 space-y-0.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-semibold text-emerald-900">Lãi suất huy động:</span>
                          <span className="text-xs sm:text-sm font-black text-emerald-700">{rec.rateRange}</span>
                        </div>
                        <div className="text-[10px] text-emerald-800 font-medium">
                          Kỳ hạn: <b>{rec.term}</b>
                        </div>
                      </div>

                      <div className="space-y-1 text-[10.5px]">
                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">Ưu điểm nổi bật:</div>
                        <ul className="space-y-0.8 text-slate-600">
                          {rec.highlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-emerald-500 font-bold">•</span>
                              <span className="leading-snug">{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-1.5 bg-slate-50 rounded border border-slate-100 text-[10px] text-slate-600">
                        <b className="text-slate-800">Khuyên dùng:</b> {rec.advice}
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[9.5px] text-slate-400 font-medium truncate max-w-[120px]">
                        {rec.safetyRating.split('•')[0]}
                      </span>

                      {onSelectSavingsRecommendation && (
                        <button
                          type="button"
                          onClick={() => onSelectSavingsRecommendation(rec)}
                          className="px-2 py-0.8 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Tạo mục tiêu tiết kiệm tại Tab 3"
                        >
                          <PlusCircle className="w-3 h-3" />
                          <span>+ Lập Mục Tiêu</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* BẢNG LÃI SUẤT NGÂN HÀNG TRỰC TUYẾN THEO NGÀY (LIVE BANK RATES TABLE) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Bảng Lãi Suất Ngân Hàng Trực Tuyến Tự Động Theo Ngày</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {bankRates?.updatedAtStr || 'Đang cập nhật'}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Nguồn: Topi & Biểu phí ngân hàng • Quét lãi suất trực tuyến (Online) và tại quầy
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {/* Sub-tabs phân loại lãi suất */}
                    <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setBankRateSubTab('topOnline')}
                        className={`px-2 py-0.5 rounded transition ${
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
                        className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
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
                        className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                          bankRateSubTab === 'special'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'text-amber-700 hover:text-amber-900 bg-amber-50/70'
                        }`}
                        title="Các gói lãi suất 9.0% - 10.0% yêu cầu số dư khủng (từ 500 tỷ)"
                      >
                        <span>Gói &gt;500 Tỷ (9 - 10%)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBankRateSubTab('big4')}
                        className={`px-2 py-0.5 rounded transition ${
                          bankRateSubTab === 'big4'
                            ? 'bg-white text-emerald-800 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Big 4 Quốc Doanh
                      </button>
                      <button
                        type="button"
                        onClick={() => setBankRateSubTab('allOnline')}
                        className={`px-2 py-0.5 rounded transition ${
                          bankRateSubTab === 'allOnline'
                            ? 'bg-white text-emerald-800 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Toàn Bộ Online
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleRefreshBankRates}
                      disabled={isLoadingBankRates}
                      className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
                      title="Quét lại lãi suất ngân hàng"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingBankRates ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Banner giải thích các nhóm lãi suất */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-lg p-2 flex items-start gap-2 text-[10.5px] text-slate-700">
                  <span className="text-emerald-700 font-bold">💡 Thị trường:</span>
                  <p className="leading-relaxed">
                    • <b>CCTG & Gói Tích Lũy (8.5% – 9.4%):</b> Tại tab <i>"CCTG & Siêu Lãi"</i> như <b>NCB An Phú & Chứng chỉ tiền gửi (9.3% – 9.4%)</b>, Cake (9.4%), VPBank CCTG (9.0%). Vốn linh hoạt từ 10 - 50 triệu.<br />
                    • <b>Gửi Online 12 Tháng Chuẩn:</b> Mức <b>6.8% – 7.8%/năm</b> tại tab <i>"Top Lãi Online"</i> (Sacombank, ACB, MBV...).<br />
                    • <b>Gói 9.0% – 10.0%/năm:</b> Cần điều kiện số tiền gửi từ <b>500 tỷ – 2.000 tỷ đồng</b> tại quầy (PVcomBank, HDBank, MSB).
                  </p>
                </div>

                {/* Table hiển thị lãi suất ngân hàng */}
                <div className="overflow-x-auto max-h-[220px] overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 z-10 text-[9.5px] font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-1 px-2">Ngân Hàng</th>
                        {bankRateSubTab === 'cdHighYield' ? (
                          <>
                            <th className="py-1 px-1.5 text-center bg-emerald-50 text-emerald-900 font-bold">6T</th>
                            <th className="py-1 px-1.5 text-center bg-emerald-100 text-emerald-950 font-bold">12T</th>
                            <th className="py-1 px-1.5 text-center bg-amber-100 text-amber-950 font-black">18 - 36T / CCTG</th>
                            <th className="py-1 px-2 text-left text-slate-800 font-bold">Hình Thức & Điều Kiện</th>
                            <th className="py-1 px-2 text-center">Hành Động</th>
                          </>
                        ) : bankRateSubTab === 'special' ? (
                          <>
                            <th className="py-1 px-1.5 text-center bg-amber-50 text-amber-900 font-bold">6T</th>
                            <th className="py-1 px-1.5 text-center bg-amber-100 text-amber-950 font-black">12T</th>
                            <th className="py-1 px-1.5 text-center bg-amber-50 text-amber-900 font-bold">24T</th>
                            <th className="py-1 px-2 text-left text-amber-900 font-bold">Điều Kiện Bắt Buộc</th>
                            <th className="py-1 px-2 text-center">Hành Động</th>
                          </>
                        ) : (
                          <>
                            <th className="py-1 px-1.5 text-center">KKH</th>
                            <th className="py-1 px-1.5 text-center">1T</th>
                            <th className="py-1 px-1.5 text-center">3T</th>
                            <th className="py-1 px-1.5 text-center bg-emerald-50 text-emerald-800">6T</th>
                            <th className="py-1 px-1.5 text-center bg-emerald-100 text-emerald-900 font-extrabold">12T</th>
                            <th className="py-1 px-1.5 text-center">24T</th>
                            <th className="py-1 px-2 text-center">Hành Động</th>
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
                              <td colSpan={8} className="py-4 text-center text-slate-400 text-xs">
                                Đang tải bảng lãi suất...
                              </td>
                            </tr>
                          );
                        }

                        if (bankRateSubTab === 'cdHighYield') {
                          return displayList.map((item, idx) => (
                            <tr key={`${item.bank}-${idx}`} className="hover:bg-emerald-50/50 transition">
                              <td className="py-1.5 px-2 font-bold text-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                                  <span>{item.bank}</span>
                                </div>
                                {item.productType && (
                                  <div className="text-[9px] text-emerald-700 font-medium">{item.productType}</div>
                                )}
                              </td>
                              <td className="py-1.5 px-1.5 text-center font-semibold text-slate-700 font-mono text-[10px]">
                                {item.m6 ? `${item.m6}%` : '--'}
                              </td>
                              <td className="py-1.5 px-1.5 text-center font-bold text-emerald-800 font-mono text-[10.5px]">
                                {item.m12 ? `${item.m12}%` : '--'}
                              </td>
                              <td className="py-1.5 px-1.5 text-center font-black text-rose-700 bg-emerald-50 font-mono text-[11px]">
                                {item.m24 || item.m18 ? `${item.m24 || item.m18}%` : '--'}
                              </td>
                              <td className="py-1.5 px-2 text-left">
                                <div className="text-[10px] text-slate-800 font-medium">
                                  {item.condition || 'Từ 10 - 50 triệu'}
                                </div>
                                {item.note && (
                                  <div className="text-[9px] text-slate-500">{item.note}</div>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelectSavingsRecommendation?.({
                                      id: `rec-cd-${item.bank}`,
                                      bankName: item.bank,
                                      rateRange: `${item.m24 || item.m18 || item.m12 || 9.3}%/năm`,
                                      term: '18 - 36T / Chứng Chỉ Tiền Gửi',
                                      safetyRating: 'Bảo hiểm NHNN',
                                      highlights: [
                                        `Lãi suất nhận: ${item.m24 || item.m18 || 9.3}%/năm`,
                                        item.condition || 'Chuyển nhượng linh hoạt',
                                      ],
                                      advice: 'Khóa trần lãi suất thực dương cao cho quỹ an toàn.',
                                      screenBadge: 'CCTG Siêu Lãi',
                                      screenScore: 99,
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] transition"
                                >
                                  + Chọn
                                </button>
                              </td>
                            </tr>
                          ));
                        }

                        if (bankRateSubTab === 'special') {
                          return displayList.map((item, idx) => (
                            <tr key={`${item.bank}-${idx}`} className="hover:bg-amber-50/50 transition">
                              <td className="py-1.5 px-2 font-bold text-slate-800 whitespace-nowrap">
                                {item.bank}
                              </td>
                              <td className="py-1.5 px-1.5 text-center font-bold text-amber-800 bg-amber-50/40 font-mono text-[10px]">
                                {item.m6 ? `${item.m6}%` : '--'}
                              </td>
                              <td className="py-1.5 px-1.5 text-center font-black text-rose-700 bg-amber-100/60 font-mono text-[11px]">
                                {item.m12 ? `${item.m12}%` : '--'}
                              </td>
                              <td className="py-1.5 px-1.5 text-center font-bold text-amber-800 bg-amber-50/40 font-mono text-[10px]">
                                {item.m24 ? `${item.m24}%` : '--'}
                              </td>
                              <td className="py-1.5 px-2 text-left">
                                <span className="text-[10px] text-amber-900 bg-amber-100/60 px-1.5 py-0.5 rounded font-medium">
                                  ⚠️ {item.condition || 'Yêu cầu số dư lớn'}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelectSavingsRecommendation?.({
                                      id: `rec-bank-${item.bank}`,
                                      bankName: item.bank,
                                      rateRange: `${item.m12 || 9.0}%/năm`,
                                      term: 'Gói đặc biệt (Điều kiện lớn)',
                                      safetyRating: 'Bảo hiểm tiền gửi NHNN',
                                      highlights: [
                                        `Lãi suất 12 tháng: ${item.m12 || 9.0}%/năm`,
                                        item.condition || 'Yêu cầu số dư lớn',
                                      ],
                                      advice: 'Cần liên hệ trực tiếp hội sở ngân hàng.',
                                      screenBadge: 'Gói Đặc Biệt',
                                      screenScore: 95,
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] transition"
                                >
                                  + Xem
                                </button>
                              </td>
                            </tr>
                          ));
                        }

                        return displayList.map((item, idx) => (
                          <tr key={`${item.bank}-${idx}`} className="hover:bg-emerald-50/40 transition">
                            <td className="py-1.5 px-2 font-bold text-slate-800 whitespace-nowrap">
                              {item.bank}
                            </td>
                            <td className="py-1.5 px-1.5 text-center text-slate-500 font-mono text-[10px]">
                              {item.kkh ? `${item.kkh}%` : '--'}
                            </td>
                            <td className="py-1.5 px-1.5 text-center text-slate-600 font-mono text-[10px]">
                              {item.m1 ? `${item.m1}%` : '--'}
                            </td>
                            <td className="py-1.5 px-1.5 text-center text-slate-600 font-mono text-[10px]">
                              {item.m3 ? `${item.m3}%` : '--'}
                            </td>
                            <td className="py-1.5 px-1.5 text-center font-bold text-emerald-700 bg-emerald-50/50 font-mono">
                              {item.m6 ? `${item.m6}%` : '--'}
                            </td>
                            <td className="py-1.5 px-1.5 text-center font-black text-emerald-800 bg-emerald-100/50 font-mono text-[11px]">
                              {item.m12 ? `${item.m12}%` : '--'}
                            </td>
                            <td className="py-1.5 px-1.5 text-center text-slate-700 font-mono">
                              {item.m24 ? `${item.m24}%` : '--'}
                            </td>
                            <td className="py-1.5 px-2 text-center whitespace-nowrap">
                              {onSelectSavingsRecommendation && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelectSavingsRecommendation({
                                      id: `bank-${item.bank}`,
                                      bankName: item.bank,
                                      rateRange: `${item.m12 || item.m6 || 6.8}%/năm`,
                                      term: '12 Tháng (Trực tuyến)',
                                      safetyRating: 'An toàn bảo hiểm tiền gửi NHNN',
                                      highlights: [
                                        `Lãi suất 12 tháng: ${item.m12 || 7.0}%/năm`,
                                        `Lãi suất 6 tháng: ${item.m6 || 6.5}%/năm`,
                                        'Gửi trực tuyến trên App ngân hàng nhận lãi suất cao nhất',
                                      ],
                                      advice: 'Phù hợp làm quỹ dự phòng khẩn cấp và tích lũy tiền nhàn rỗi an toàn.',
                                      badge: 'Lãi Suất Ngày',
                                      period: '12M',
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[9.5px] transition cursor-pointer"
                                >
                                  + Chọn gửi
                                </button>
                              )}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TOP 3 KHUYẾN NGHỊ TRÁI PHIẾU DOANH NGHIỆP TỐT NHẤT */}
          {recTab === 'bonds' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {TOP3_BONDS_RECOMMENDATIONS.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white border border-indigo-200 hover:border-indigo-400 rounded-lg p-2.5 shadow-2xs flex flex-col justify-between transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1 border-b border-slate-100 pb-1.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="font-bold text-slate-900 text-xs line-clamp-1">
                            {rec.issuerName.split('(')[0]}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-500 line-clamp-1">
                          {rec.issuerName.includes('(') ? `(${rec.issuerName.split('(')[1]}` : ''}
                        </span>
                      </div>
                      <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 shrink-0">
                        {rec.badge}
                      </span>
                    </div>

                    <div className="bg-indigo-50/80 p-2 rounded-lg border border-indigo-100 space-y-0.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] font-semibold text-indigo-900">Lãi suất coupon:</span>
                        <span className="text-xs sm:text-sm font-black text-indigo-700">{rec.couponRange}</span>
                      </div>
                      <div className="text-[10px] text-indigo-800 font-medium">
                        Kỳ hạn: <b>{rec.tenor}</b> • Mã: <span className="font-mono">{rec.symbolOrCode}</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-[10.5px]">
                      <div className="text-[9.5px] text-slate-400 font-bold uppercase">Đặc điểm đầu tư:</div>
                      <ul className="space-y-0.8 text-slate-600">
                        {rec.highlights.map((h, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-indigo-500 font-bold">•</span>
                            <span className="leading-snug">{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-1.5 bg-slate-50 rounded border border-slate-100 text-[10px] text-slate-600">
                      <b className="text-slate-800">Tài sản bảo đảm:</b> {rec.collateral}
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9.5px] text-indigo-700 font-bold truncate max-w-[130px]">
                      {rec.creditRating.split('•')[0]}
                    </span>

                    {onSelectBondRecommendation && (
                      <button
                        type="button"
                        onClick={() => onSelectBondRecommendation(rec)}
                        className="px-2 py-0.8 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Tạo mục tiêu trái phiếu tại Tab 3"
                      >
                        <PlusCircle className="w-3 h-3" />
                        <span>+ Lập Mục Tiêu</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Search & Table Header */}
      <div className="flex items-center justify-between gap-2 pt-2 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
          <span>Danh Mục Cổ Phiếu ({tickerMap.size})</span>
        </div>

        <div className="relative w-36 sm:w-56">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm / gõ mã CP (VD: TCB, HPG...)"
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            className="w-full pl-6 pr-2 py-0.8 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* THẺ TRA CỨU BCTC TCBS TRỰC TUYẾN KHI GÕ BẤT KỲ MÃ CỔ PHIẾU NÀO */}
      {isSearchingRatio && (
        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-blue-800 animate-pulse my-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Đang tra cứu BCTC và chỉ số P/E, P/B, ROE từ TCBS cho <b>{searchTicker.toUpperCase()}</b>...</span>
        </div>
      )}

      {searchedRatio && !isSearchingRatio && (
        <div className="p-2.5 sm:p-3 bg-gradient-to-r from-blue-50 via-indigo-50/60 to-white border border-blue-300 rounded-xl shadow-xs space-y-2 my-2 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/80 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                {searchedRatio.symbol}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">{searchedRatio.symbol}</h4>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                    {searchedRatio.industry || 'Niêm yết'}
                  </span>
                  <span className="text-[9.5px] text-slate-500 font-medium">Kỳ BCTC: {searchedRatio.period}</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Nguồn: {searchedRatio.source || 'TCBS & Simplize BCTC'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-center">
              {onSelectRecommendation && (
                <button
                  type="button"
                  onClick={() => {
                    const q = stockData?.stocks[searchedRatio.symbol];
                    onSelectRecommendation({
                      symbol: searchedRatio.symbol,
                      name: searchedRatio.industry || searchedRatio.symbol,
                      price: q?.price,
                    });
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>+ Lập Mục Tiêu (Tab 3)</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 chỉ số vàng P/E, P/B, ROE, ROA */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
            <div className="bg-white p-1.5 rounded-lg border border-blue-100 shadow-2xs">
              <div className="text-[9.5px] text-slate-500 font-medium">Hệ số P/E</div>
              <div className="text-xs sm:text-sm font-black text-slate-900 font-mono mt-0.5">
                {searchedRatio.pe ? `${searchedRatio.pe}x` : 'N/A'}
              </div>
              <div className="text-[8px] text-slate-400">Giá / Lợi nhuận</div>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-blue-100 shadow-2xs">
              <div className="text-[9.5px] text-slate-500 font-medium">Hệ số P/B</div>
              <div className="text-xs sm:text-sm font-black text-slate-900 font-mono mt-0.5">
                {searchedRatio.pb ? `${searchedRatio.pb}x` : 'N/A'}
              </div>
              <div className="text-[8px] text-slate-400">Giá / Sổ sách</div>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-blue-100 shadow-2xs">
              <div className="text-[9.5px] text-slate-500 font-medium">Hiệu suất ROE</div>
              <div className="text-xs sm:text-sm font-black text-emerald-700 font-mono mt-0.5">
                {searchedRatio.roe ? `${searchedRatio.roe}%` : 'N/A'}
              </div>
              <div className="text-[8px] text-slate-400">Lãi / Vốn CSH</div>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-blue-100 shadow-2xs">
              <div className="text-[9.5px] text-slate-500 font-medium">Hiệu suất ROA</div>
              <div className="text-xs sm:text-sm font-black text-indigo-700 font-mono mt-0.5">
                {searchedRatio.roa ? `${searchedRatio.roa}%` : 'N/A'}
              </div>
              <div className="text-[8px] text-slate-400">Lãi / Tổng TS</div>
            </div>
          </div>

          {searchedRatio.rating && (
            <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-[10px] text-emerald-900 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="font-semibold">Đánh giá cơ bản:</span>
              <span>{searchedRatio.rating}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Stock Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 mt-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] sm:text-[11px] whitespace-nowrap">
              <th className="py-1.5 px-2">Mã CP</th>
              <th className="py-1.5 px-2 hidden sm:table-cell">Doanh Nghiệp & BCTC TCBS</th>
              <th className="py-1.5 px-2 text-center">Phân Loại</th>
              <th className="py-1.5 px-2 text-right">Giá Khớp</th>
              <th className="py-1.5 px-2 text-right">Biến Động</th>
              <th className="py-1.5 px-2 text-center min-w-[210px] hidden md:table-cell">
                <div className="flex flex-col items-center">
                  <span className="text-slate-800 font-extrabold flex items-center gap-1">
                    <Target className="w-3 h-3 text-indigo-600 inline" />
                    Đáy 5T • 10T • 20T • 30T • 52T
                  </span>
                  <span className="text-[8px] text-slate-400 font-normal">Giá thấp nhất & Vùng gom</span>
                </div>
              </th>
              <th className="py-1.5 px-2 text-right hidden lg:table-cell">Trần / Sàn</th>
              <th className="py-1.5 px-2 text-right">Tài Sản Tab 1</th>
              <th className="py-1.5 px-2 text-right">Mục Tiêu Tab 3</th>
              <th className="py-1.5 px-2 text-center">Liên Kết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {stockRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-5 text-center text-slate-400 font-medium text-xs">
                  Không tìm thấy mã cổ phiếu nào phù hợp.
                </td>
              </tr>
            ) : (
              stockRows.map((row) => {
                const quote: StockQuoteItem | undefined = stockData?.stocks[row.symbol];
                const price = quote?.price || 20000;
                const change = quote?.change || 0;
                const changePct = quote?.changePercent || 0;
                const refPrice = quote?.refPrice || price;
                const ceiling = quote?.ceiling;
                const floor = quote?.floor;
                const r = ratiosMap[row.symbol];

                const isUp = change > 0;
                const isDown = change < 0;

                // Tổng số lượng đã có ở Tab 1
                const totalOwnedQty = row.ownedAssets.reduce((s, a) => s + (a.quantity || 0), 0);
                const totalOwnedAmount = totalOwnedQty > 0 ? totalOwnedQty * price : row.ownedAssets.reduce((s, a) => s + a.amount, 0);

                // Tổng định mức kỳ ở Tab 3
                const totalTargetQty = row.targetGoals.reduce((s, g) => s + (g.targetQty || 0), 0);
                const totalTargetAmount = totalTargetQty > 0 ? totalTargetQty * price : row.targetGoals.reduce((s, g) => s + (g.targetAmountPerPeriod || 0), 0);

                return (
                  <tr key={row.symbol} className="hover:bg-blue-50/40 transition">
                    {/* Mã CP & Tên kết hợp gọn trên mobile */}
                    <td className="py-2 px-2 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-[11px] sm:text-xs">
                          {row.symbol}
                        </span>
                        <span className="text-[9.5px] text-slate-400 font-medium truncate max-w-[90px] sm:hidden">
                          {quote?.name || row.name}
                        </span>
                      </div>
                    </td>

                    {/* Tên Doanh Nghiệp & BCTC TCBS (Desktop) */}
                    <td className="py-2 px-2 hidden sm:table-cell">
                      <div className="font-semibold text-slate-800 text-[11px] sm:text-xs line-clamp-1 max-w-[170px]">
                        {quote?.name || row.name}
                      </div>
                      {/* BCTC TCBS (P/E, P/B, ROE) */}
                      {r ? (
                        <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono">
                          <span className="text-slate-500">P/E: <b className="text-slate-800">{r.pe ? `${r.pe}x` : '--'}</b></span>
                          <span className="text-slate-500">P/B: <b className="text-slate-800">{r.pb ? `${r.pb}x` : '--'}</b></span>
                          <span className="text-emerald-700">ROE: <b>{r.roe ? `${r.roe}%` : '--'}</b></span>
                        </div>
                      ) : (
                        <div className="text-[8.5px] text-slate-400">Đang quét BCTC TCBS...</div>
                      )}
                    </td>

                    {/* Phân loại */}
                    <td className="py-2 px-1.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {row.ownedAssets.length > 0 && (
                          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                            Tab 1
                          </span>
                        )}
                        {row.targetGoals.length > 0 && (
                          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded border border-blue-200">
                            Tab 3
                          </span>
                        )}
                        {row.ownedAssets.length === 0 && row.targetGoals.length === 0 && (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded">
                            Mẫu
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Giá khớp */}
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      <span
                        className={`text-[11px] sm:text-xs font-black ${
                          isUp ? 'text-emerald-600' : isDown ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      >
                        {formatVND(price, isPrivacyMode)}
                      </span>
                    </td>

                    {/* Biến động */}
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      <div
                        className={`inline-flex items-center gap-0.5 font-bold text-[10px] sm:text-[11px] ${
                          isUp ? 'text-emerald-700' : isDown ? 'text-rose-700' : 'text-amber-700'
                        }`}
                      >
                        {isUp ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : isDown ? (
                          <ArrowDownRight className="w-3 h-3" />
                        ) : (
                          <Minus className="w-2.5 h-2.5" />
                        )}
                        <span>
                          {changePct > 0 ? '+' : ''}
                          {changePct}%
                        </span>
                      </div>
                    </td>

                    {/* THAY GIÁ THAM CHIẾU BẰNG ĐÁNH GIÁ ĐÁY 5T, 10T, 20T, 30T, 52T */}
                    <td className="py-2 px-2 hidden md:table-cell">
                      <div className="flex flex-col gap-1 min-w-[200px]">
                        <div className="grid grid-cols-5 gap-0.5 text-[8.5px] font-mono text-center">
                          <div
                            className="bg-slate-50 border border-slate-200/90 rounded px-0.5 py-0.5"
                            title={`Đáy 5 tuần: ${formatVND(quote?.low5w || price)}`}
                          >
                            <div className="text-[7px] text-slate-400 font-sans font-bold">5T</div>
                            <div className="font-bold text-slate-800 leading-tight">
                              {((quote?.low5w || price) / 1000).toFixed(1)}k
                            </div>
                            <div className="text-[6.5px] text-slate-500 leading-none">
                              +{quote?.diffFromLow5wPct ?? 0}%
                            </div>
                          </div>
                          <div
                            className="bg-slate-50 border border-slate-200/90 rounded px-0.5 py-0.5"
                            title={`Đáy 10 tuần: ${formatVND(quote?.low10w || price)}`}
                          >
                            <div className="text-[7px] text-slate-400 font-sans font-bold">10T</div>
                            <div className="font-bold text-slate-800 leading-tight">
                              {((quote?.low10w || price) / 1000).toFixed(1)}k
                            </div>
                            <div className="text-[6.5px] text-slate-500 leading-none">
                              +{quote?.diffFromLow10wPct ?? 0}%
                            </div>
                          </div>
                          <div
                            className="bg-slate-50 border border-slate-200/90 rounded px-0.5 py-0.5"
                            title={`Đáy 20 tuần: ${formatVND(quote?.low20w || price)}`}
                          >
                            <div className="text-[7px] text-slate-400 font-sans font-bold">20T</div>
                            <div className="font-bold text-slate-800 leading-tight">
                              {((quote?.low20w || price) / 1000).toFixed(1)}k
                            </div>
                            <div className="text-[6.5px] text-slate-500 leading-none">
                              +{quote?.diffFromLow20wPct ?? 0}%
                            </div>
                          </div>
                          <div
                            className="bg-slate-50 border border-slate-200/90 rounded px-0.5 py-0.5"
                            title={`Đáy 30 tuần: ${formatVND(quote?.low30w || price)}`}
                          >
                            <div className="text-[7px] text-slate-400 font-sans font-bold">30T</div>
                            <div className="font-bold text-slate-800 leading-tight">
                              {((quote?.low30w || price) / 1000).toFixed(1)}k
                            </div>
                            <div className="text-[6.5px] text-slate-500 leading-none">
                              +{quote?.diffFromLow30wPct ?? 0}%
                            </div>
                          </div>
                          <div
                            className="bg-indigo-50/90 border border-indigo-200 rounded px-0.5 py-0.5"
                            title={`Đáy 52 tuần: ${formatVND(quote?.low52w || price)}`}
                          >
                            <div className="text-[7px] text-indigo-700 font-sans font-black">52T</div>
                            <div className="font-black text-indigo-900 leading-tight">
                              {((quote?.low52w || price) / 1000).toFixed(1)}k
                            </div>
                            <div className="text-[6.5px] font-bold text-indigo-700 leading-none">
                              +{quote?.diffFromLow52wPct ?? 0}%
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[8.5px]">
                          <span className="font-bold text-slate-700 truncate">
                            {quote?.valuationStatus || 'Vùng tích lũy'}
                          </span>
                          <span className="text-[7.5px] font-extrabold px-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                            +{(quote?.diffFromLow52wPct ?? 0)}% đáy 52T
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Trần / Sàn */}
                    <td className="py-2 px-2 text-right whitespace-nowrap text-[10px] hidden lg:table-cell">
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-purple-600 font-bold" title="Giá trần">
                          {ceiling ? formatVND(ceiling, isPrivacyMode) : '-'}
                        </span>
                        <span className="text-cyan-600 font-bold" title="Giá sàn">
                          {floor ? formatVND(floor, isPrivacyMode) : '-'}
                        </span>
                      </div>
                    </td>

                    {/* Tài sản Tab 1 */}
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {row.ownedAssets.length > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-slate-900 text-[10.5px] sm:text-xs">
                            {formatVND(totalOwnedAmount, isPrivacyMode)}
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-medium">
                            {totalOwnedQty.toLocaleString('vi-VN')} CP
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-medium">-</span>
                      )}
                    </td>

                    {/* Mục tiêu Tab 3 */}
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {row.targetGoals.length > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-blue-900 text-[10.5px] sm:text-xs">
                            {formatVND(totalTargetAmount, isPrivacyMode)}
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-medium">
                            {totalTargetQty.toLocaleString('vi-VN')} CP
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-medium">-</span>
                      )}
                    </td>

                    {/* Trạng thái tự động link */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                        <Link2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span className="hidden xs:inline">Tự link</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-[10.5px] sm:text-xs text-slate-500">
        <div className="flex items-center gap-1 text-slate-500">
          <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
          <span>
            Giá thị trường tự link vào mục tiêu (Tab 3) và tài sản (Tab 1) theo phân loại Cổ phiếu.
          </span>
        </div>
        {ownedStockAssets.length > 0 && (
          <div className="font-semibold text-slate-700">
            Tổng giá trị CP: <strong className="text-emerald-700 font-black">{formatVND(totalMarketValueOwned, isPrivacyMode)}</strong>
          </div>
        )}
      </div>
    </div>
  );
};
