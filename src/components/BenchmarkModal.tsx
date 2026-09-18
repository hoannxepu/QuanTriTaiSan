import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Award, TrendingUp, Info, CheckCircle2 } from 'lucide-react';
import {
  getVietnamWealthBenchmark,
  getVietnamIncomeBenchmark,
} from '../utils/benchmarkUtils';
import { formatVND } from '../utils/format';

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'wealth' | 'income';
  currentValue: number;
  isPrivacyMode?: boolean;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  type,
  currentValue,
  isPrivacyMode = false,
}) => {
  // Listen for Escape key to close effortlessly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isWealth = type === 'wealth';
  const wealthData = getVietnamWealthBenchmark(currentValue);
  const incomeData = getVietnamIncomeBenchmark(currentValue);

  const currentTier = isWealth ? wealthData.currentTier : incomeData.currentTier;
  const currentTierIndex = isWealth ? wealthData.currentTierIndex : incomeData.currentTierIndex;
  const ratioText = isWealth ? wealthData.ratioText : incomeData.ratioText;

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-slate-900/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto cursor-pointer"
      title="Bấm vào vùng tối bên ngoài để đóng nhanh"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] my-0 sm:my-6 animate-in slide-in-from-bottom-6 sm:fade-in duration-200 cursor-default"
      >
        {/* Header - Fixed at top of modal */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 text-white p-3 sm:p-6 shrink-0 relative border-b border-slate-700/50">
          {/* Mobile Handle Drag Indicator */}
          <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-2 sm:hidden" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                {isWealth ? <Award className="w-4 h-4 sm:w-5 sm:h-5" /> : <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs sm:text-base lg:text-lg font-black text-white tracking-tight leading-snug truncate">
                  {isWealth
                    ? 'Đánh Giá Vị Thế Tài Sản Tại Việt Nam'
                    : 'Đánh Giá Phân Vị Thu Nhập Tại Việt Nam'}
                </h2>
                <p className="text-[9.5px] sm:text-xs text-slate-300 truncate leading-none mt-0.5">
                  {isWealth
                    ? 'Chuẩn Báo cáo Tài sản Toàn cầu (UBS) & Knight Frank'
                    : 'Chuẩn Niên giám Thống kê & Mức sống Dân cư (GSO)'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-auto sm:px-3 sm:py-1.5 bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white rounded-full transition-all cursor-pointer flex items-center justify-center sm:gap-1 text-xs font-bold border border-slate-700 shadow-xs shrink-0"
              title="Đóng cửa sổ"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Đóng</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-6 space-y-3 sm:space-y-4">
          {/* Current Standing Highlight Banner */}
          <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-slate-200 shadow-2xs space-y-2.5 sm:space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                  {isWealth ? 'Tổng Giá Trị Tài Sản' : 'Tổng Thu Nhập / Tháng'}
                </span>
                <span className="text-base sm:text-2xl font-black text-slate-900 block mt-0.5 tracking-tight truncate">
                  {formatVND(currentValue, isPrivacyMode)}
                </span>
              </div>

              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black border shadow-2xs ${currentTier.badgeBg}`}
                >
                  <Award className="w-3 h-3 shrink-0" />
                  <span>{currentTier.topPercent} Dân Số VN</span>
                </span>
              </div>
            </div>

            {/* Comparison Metrics */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-xs">
              <div className="bg-emerald-50/70 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-emerald-200/70 space-y-0.5">
                <span className="text-[9.5px] sm:text-[11px] font-bold text-emerald-800 block truncate">
                  So với bình quân VN:
                </span>
                <span className="font-extrabold text-emerald-950 text-xs sm:text-sm block truncate">
                  {ratioText}
                </span>
                <span className="text-[8.5px] sm:text-[10px] text-emerald-700 block leading-tight truncate">
                  {isWealth ? 'BQ trưởng thành: ~370 Tr' : 'BQ cả nước: ~8.5 Tr/th'}
                </span>
              </div>

              <div className="bg-blue-50/70 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-blue-200/70 space-y-0.5">
                <span className="text-[9.5px] sm:text-[11px] font-bold text-blue-800 block truncate">
                  Phân khúc xã hội:
                </span>
                <span className="font-extrabold text-blue-950 text-xs sm:text-sm block truncate">
                  {currentTier.title}
                </span>
                <span className="text-[8.5px] sm:text-[10px] text-blue-700 block leading-tight truncate">
                  {currentTier.desc}
                </span>
              </div>
            </div>
          </div>

          {/* Full Benchmark Reference Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-1">
              <h3 className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3 h-3 text-blue-600 shrink-0" />
                <span>Mốc Phân Tầng {isWealth ? 'Tài Sản' : 'Thu Nhập'}</span>
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-emerald-700 font-semibold flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span>Viền xanh = Vị thế của bạn</span>
              </span>
            </div>

            {/* 1. DEDICATED MOBILE VIEW (< md) - COMPACT CARD TIERS WITHOUT OVERFLOW */}
            <div className="md:hidden space-y-1.5">
              {(isWealth ? wealthData.allTiers : incomeData.allTiers).map((tier, idx) => {
                const isUserTier = idx === currentTierIndex;
                return (
                  <div
                    key={tier.topPercent}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isUserTier
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-200/70 shadow-xs'
                        : 'bg-white border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border shrink-0 ${
                            isUserTier
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : tier.badgeBg
                          }`}
                        >
                          {tier.topPercent}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {tier.title}
                        </span>
                      </div>

                      {isUserTier ? (
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Bạn ở đây</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {tier.rangeLabel}
                        </span>
                      )}
                    </div>

                    {isUserTier && (
                      <div className="text-xs font-black text-emerald-900 mt-1">
                        Khoảng: {tier.rangeLabel}
                      </div>
                    )}

                    <p className="text-[9.5px] text-slate-500 mt-0.5 leading-snug">
                      {tier.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* 2. DEDICATED DESKTOP VIEW (>= md) - PRESERVED 100% UNTOUCHED */}
            <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="py-2.5 px-3 whitespace-nowrap">Phân tầng</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">
                        {isWealth ? 'Khoảng Tổng Tài Sản' : 'Khoảng Thu Nhập / Tháng'}
                      </th>
                      <th className="py-2.5 px-3">Định vị & Phân khúc</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(isWealth ? wealthData.allTiers : incomeData.allTiers).map((tier, idx) => {
                      const isUserTier = idx === currentTierIndex;
                      return (
                        <tr
                          key={tier.topPercent}
                          className={`transition-colors ${
                            isUserTier
                              ? 'bg-emerald-50/90 font-semibold text-emerald-950 border-l-4 border-l-emerald-600'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                                isUserTier
                                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                  : tier.badgeBg
                              }`}
                            >
                              {tier.topPercent}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                            {tier.rangeLabel}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[11px] text-slate-900">{tier.title}</div>
                            <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">
                              {tier.desc}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {isUserTier ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Vị trí của bạn</span>
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Methodology Note Box */}
            <div className="p-2.5 sm:p-3.5 bg-slate-50/90 rounded-xl text-[10px] sm:text-[11px] text-slate-600 space-y-1 border border-slate-200/80">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Info className="w-3 h-3 text-blue-600 shrink-0" />
                <span>Cơ sở phương pháp luận & thống kê chuẩn:</span>
              </div>
              <p className="leading-relaxed pl-4 sm:pl-5 text-[9.5px] sm:text-[10.5px]">
                Dữ liệu đối chiếu từ Báo cáo Tài sản Toàn cầu (UBS / Credit Suisse), Knight Frank Wealth Model và Khảo sát Mức sống Dân cư GSO Việt Nam.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            *Bấm <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-mono">Esc</kbd> hoặc chạm ra ngoài để đóng
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Đóng lại</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
