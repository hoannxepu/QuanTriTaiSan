import React, { useState } from 'react';
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

          {/* TAB 2: TOP 3 KHUYẾN NGHỊ GỬI TIẾT KIỆM LÃI SUẤT TỐT NHẤT */}
          {recTab === 'savings' && (
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

        <div className="relative w-36 sm:w-48">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm mã CP..."
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            className="w-full pl-6 pr-2 py-0.8 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 mt-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] sm:text-[11px] whitespace-nowrap">
              <th className="py-1.5 px-2">Mã CP</th>
              <th className="py-1.5 px-2 hidden sm:table-cell">Doanh Nghiệp</th>
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

                    {/* Tên Doanh Nghiệp (Desktop) */}
                    <td className="py-2 px-2 hidden sm:table-cell">
                      <div className="font-semibold text-slate-800 text-[11px] sm:text-xs line-clamp-1 max-w-[160px]">
                        {quote?.name || row.name}
                      </div>
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
