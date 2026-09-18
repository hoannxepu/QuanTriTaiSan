import React from 'react';
import {
  Landmark,
  Building2,
  Globe,
  Activity,
  Award,
  Sparkles,
  ChevronUp,
  TrendingUp,
  ArrowRight,
  TrendingDown,
  ShieldCheck,
  Target,
  Zap,
} from 'lucide-react';
import {
  MACRO_FINANCIAL_OVERVIEW,
  MacroOverviewData,
  MacroPillarInfo,
} from '../utils/stockService';

interface MacroOverviewSectionProps {
  macroData?: MacroOverviewData;
  isOpen?: boolean;
  onToggle?: () => void;
  onOpenStockBoard?: () => void;
  className?: string;
}

export const MacroOverviewSection: React.FC<MacroOverviewSectionProps> = ({
  macroData = MACRO_FINANCIAL_OVERVIEW,
  isOpen = true,
  onToggle,
  onOpenStockBoard,
  className = '',
}) => {
  const macro = macroData || MACRO_FINANCIAL_OVERVIEW;

  if (!isOpen) {
    return null;
  }

  const renderPillarCard = (
    pillar: MacroPillarInfo,
    icon: React.ReactNode,
    theme: {
      border: string;
      iconBg: string;
      tagBg: string;
      tagText: string;
      forecastBg: string;
      forecastBorder: string;
      forecastText: string;
      impactBg: string;
      impactBorder: string;
      actionBg: string;
      actionBorder: string;
      actionText: string;
      chipBg: string;
      chipText: string;
    }
  ) => {
    return (
      <div
        key={pillar.id}
        className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-3 shadow-2xs flex flex-col justify-between hover:shadow-xs transition"
      >
        <div className="space-y-3">
          {/* Header Card */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <span className={`p-1 rounded-md ${theme.iconBg}`}>{icon}</span>
              <span>{pillar.title}</span>
            </div>
            <span
              className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${theme.tagBg} ${theme.tagText}`}
            >
              {pillar.tag}
            </span>
          </div>

          {/* 1. Thông Tin Cập Nhật Mới Nhất */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-800 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span>{pillar.currentReality.label}</span>
            </div>
            <ul className="text-[10.5px] text-slate-600 space-y-1 leading-snug pl-1">
              {pillar.currentReality.details.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2. Dự Đoán Tình Hình Sắp Tới (Lãi suất tăng hay giảm...) */}
          <div
            className={`p-2.5 rounded-lg border space-y-1 ${theme.forecastBg} ${theme.forecastBorder}`}
          >
            <div className="flex items-center gap-1 font-black text-[11px]">
              {pillar.forecast.trend === 'increase' || pillar.forecast.trend === 'accelerate' ? (
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              ) : pillar.forecast.trend === 'decrease' ? (
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Activity className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className={theme.forecastText}>
                {pillar.forecast.trendLabel}
              </span>
            </div>
            <p className="text-[10px] text-slate-700 leading-relaxed">
              {pillar.forecast.explanation}
            </p>
          </div>

          {/* 3. Tác Động Tới Thị Trường Ra Sao */}
          <div
            className={`p-2.5 rounded-lg border space-y-1.5 ${theme.impactBg} ${theme.impactBorder}`}
          >
            <div className="flex items-center gap-1.5 font-bold text-[10.5px] text-slate-900">
              <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{pillar.marketImpact.impactLabel}</span>
            </div>
            <ul className="text-[10px] text-slate-700 space-y-1 leading-snug">
              {pillar.marketImpact.details.map((imp, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <ArrowRight className="w-2.5 h-2.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 4. Nên Đầu Tư Vào Cái Gì */}
        <div
          className={`mt-2 pt-2.5 border-t border-slate-100 rounded-lg p-2.5 space-y-2 ${theme.actionBg} ${theme.actionBorder}`}
        >
          <div className="flex items-center gap-1 font-black text-[11px]">
            <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className={theme.actionText}>
              {pillar.recommendation.actionTitle}
            </span>
          </div>

          <p className="text-[10px] text-slate-800 leading-relaxed font-medium">
            {pillar.recommendation.actionDetail}
          </p>

          {/* Suggested Asset Chips */}
          {pillar.recommendation.suggestedAssets &&
            pillar.recommendation.suggestedAssets.length > 0 && (
              <div className="pt-1.5 border-t border-slate-200/60 flex items-center gap-1 flex-wrap">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Gợi ý:
                </span>
                {pillar.recommendation.suggestedAssets.map((asset, aIdx) => (
                  <span
                    key={aIdx}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${theme.chipBg} ${theme.chipText} border border-slate-200/80 shadow-2xs`}
                  >
                    {asset}
                  </span>
                ))}
              </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/90 border border-indigo-200 rounded-xl p-3 sm:p-4 text-xs space-y-3.5 shadow-sm animate-in fade-in duration-200 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="font-black text-indigo-950 flex items-center gap-2 text-xs sm:text-sm flex-wrap">
              <span>Toàn Cảnh Tài Chính Vĩ Mô & Chỉ Đạo Tầm Nhìn Chiến Lược Quốc Gia &gt; 5 Năm</span>
              <span className="text-[9.5px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                {macro.timeHorizon}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{macro.lastUpdatedStr}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenStockBoard && (
            <button
              type="button"
              onClick={onOpenStockBoard}
              className="text-[10.5px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition cursor-pointer border border-blue-200 flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Bảng Giá CP & Gợi Ý Top 3</span>
            </button>
          )}

          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="text-[10.5px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition cursor-pointer border border-indigo-200 flex items-center gap-1"
            >
              <span>Thu gọn</span>
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 4 Trụ Cột Vĩ Mô Cụ Thể (Mỗi mục gồm: Cập nhật mới nhất, Dự đoán tình hình, Tác động thị trường, Nên đầu tư vào cái gì) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Cột 1: Lãi Suất Ngân Hàng & Tiền Gửi (SBV & NHTM) */}
        {renderPillarCard(
          macro.pillars.bankRates,
          <Building2 className="w-3.5 h-3.5 text-blue-600" />,
          {
            border: 'border-blue-200',
            iconBg: 'bg-blue-50 text-blue-700',
            tagBg: 'bg-blue-50',
            tagText: 'text-blue-700 border-blue-200',
            forecastBg: 'bg-blue-50/90',
            forecastBorder: 'border-blue-200/80',
            forecastText: 'text-blue-950',
            impactBg: 'bg-slate-50',
            impactBorder: 'border-slate-200/80',
            actionBg: 'bg-emerald-50/70',
            actionBorder: 'border-emerald-200/80',
            actionText: 'text-emerald-950',
            chipBg: 'bg-white',
            chipText: 'text-emerald-800',
          }
        )}

        {/* Cột 2: Lãi Suất FED & Tiền Tệ Toàn Cầu */}
        {renderPillarCard(
          macro.pillars.fedRates,
          <Globe className="w-3.5 h-3.5 text-emerald-600" />,
          {
            border: 'border-emerald-200',
            iconBg: 'bg-emerald-50 text-emerald-700',
            tagBg: 'bg-emerald-50',
            tagText: 'text-emerald-700 border-emerald-200',
            forecastBg: 'bg-emerald-50/90',
            forecastBorder: 'border-emerald-200/80',
            forecastText: 'text-emerald-950',
            impactBg: 'bg-slate-50',
            impactBorder: 'border-slate-200/80',
            actionBg: 'bg-blue-50/70',
            actionBorder: 'border-blue-200/80',
            actionText: 'text-blue-950',
            chipBg: 'bg-white',
            chipText: 'text-blue-800',
          }
        )}

        {/* Cột 3: Cung Tiền M2, Tín Dụng & Lạm Phát CPI */}
        {renderPillarCard(
          macro.pillars.moneySupply,
          <Activity className="w-3.5 h-3.5 text-amber-600" />,
          {
            border: 'border-amber-200',
            iconBg: 'bg-amber-50 text-amber-700',
            tagBg: 'bg-amber-50',
            tagText: 'text-amber-700 border-amber-200',
            forecastBg: 'bg-amber-50/90',
            forecastBorder: 'border-amber-200/80',
            forecastText: 'text-amber-950',
            impactBg: 'bg-slate-50',
            impactBorder: 'border-slate-200/80',
            actionBg: 'bg-amber-50/70',
            actionBorder: 'border-amber-200/80',
            actionText: 'text-amber-950',
            chipBg: 'bg-white',
            chipText: 'text-amber-800',
          }
        )}

        {/* Cột 4: Đầu Tư Công, Đại Hạ Tầng & Nâng Hạng TTCK */}
        {renderPillarCard(
          macro.pillars.govVision,
          <Award className="w-3.5 h-3.5 text-indigo-600" />,
          {
            border: 'border-indigo-200',
            iconBg: 'bg-indigo-50 text-indigo-700',
            tagBg: 'bg-indigo-50',
            tagText: 'text-indigo-700 border-indigo-200',
            forecastBg: 'bg-indigo-50/90',
            forecastBorder: 'border-indigo-200/80',
            forecastText: 'text-indigo-950',
            impactBg: 'bg-slate-50',
            impactBorder: 'border-slate-200/80',
            actionBg: 'bg-indigo-50/70',
            actionBorder: 'border-indigo-200/80',
            actionText: 'text-indigo-950',
            chipBg: 'bg-white',
            chipText: 'text-indigo-800',
          }
        )}
      </div>

      {/* MỤC TỔNG: TỔNG KẾT VĨ MÔ & CHIẾN LƯỢC: NÊN ĐẦU TƯ VÀO CÁI GÌ NGAY LÚC NÀY? */}
      <div className="bg-indigo-950 text-white rounded-xl p-3 sm:p-4 space-y-3.5 shadow-lg border border-indigo-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-900/90 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs sm:text-sm font-black text-amber-300">
                {macro.executiveSummary.title}
              </h5>
              <p className="text-[10.5px] text-indigo-200">
                {macro.executiveSummary.description}
              </p>
            </div>
          </div>
        </div>

        {/* Ma trận phân bổ 4 lớp tài sản */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {macro.executiveSummary.allocationMatrix.map((item, idx) => (
            <div
              key={idx}
              className="bg-indigo-900/60 border border-indigo-800 rounded-lg p-2.5 space-y-1.5 hover:bg-indigo-900/80 transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-indigo-100">
                  {item.assetClass}
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 bg-amber-400 text-slate-950 rounded shadow-2xs">
                  {item.weightRange}
                </span>
              </div>
              <p className="text-[10px] text-indigo-200/90 leading-snug">
                {item.role}
              </p>
            </div>
          ))}
        </div>

        {/* 3 Nguyên tắc cốt lõi */}
        <div className="pt-2 border-t border-indigo-900/80 text-[10.5px] text-indigo-200 space-y-1">
          <span className="font-bold text-amber-300 block text-[11px] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>3 Nguyên Tắc Kỷ Luật Tích Sản Bất Biến (&gt; 5 Năm):</span>
          </span>
          <ul className="space-y-1 text-[10.5px]">
            {macro.executiveSummary.corePrinciples.map((p, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
