import React, { useRef } from 'react';
import {
  X,
  Printer,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Award,
  TrendingUp,
  Scale,
  Calendar,
  Layers,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { DatabaseState } from '../types';
import { formatVND } from '../utils/format';
import { PyramidLogo } from './PyramidLogo';

interface FinancialHealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseState;
  userDisplay?: string;
  isPrivacyMode?: boolean;
}

export const FinancialHealthReportModal: React.FC<FinancialHealthReportModalProps> = ({
  isOpen,
  onClose,
  db,
  userDisplay = 'Chủ Tài Khoản',
  isPrivacyMode = false,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // 1. Calculations: Assets & Net Worth
  const totalAssets = (db.assets || []).reduce((sum, a) => {
    const val = a.currentValue !== undefined ? a.currentValue : (a.amount || 0);
    return sum + val;
  }, 0);

  const totalDebts = (db.debts || []).reduce((sum, d) => {
    const remaining = d.amountRemaining !== undefined ? d.amountRemaining : (d.amount || 0);
    return sum + (d.status !== 'Đã tất toán' ? remaining : 0);
  }, 0);

  const netWorth = totalAssets - totalDebts;
  const debtToAssetRatio = totalAssets > 0 ? Number(((totalDebts / totalAssets) * 100).toFixed(1)) : 0;

  // 2. Pyramid Layers
  const layer1Assets = (db.assets || []).filter((a) => a.layer === 1).reduce((s, a) => s + (a.currentValue ?? a.amount ?? 0), 0);
  const layer2Assets = (db.assets || []).filter((a) => a.layer === 2).reduce((s, a) => s + (a.currentValue ?? a.amount ?? 0), 0);
  const layer3Assets = (db.assets || []).filter((a) => a.layer === 3).reduce((s, a) => s + (a.currentValue ?? a.amount ?? 0), 0);
  const layer4Assets = (db.assets || []).filter((a) => a.layer === 4).reduce((s, a) => s + (a.currentValue ?? a.amount ?? 0), 0);

  const layer1Pct = totalAssets > 0 ? Math.round((layer1Assets / totalAssets) * 100) : 0;
  const layer2Pct = totalAssets > 0 ? Math.round((layer2Assets / totalAssets) * 100) : 0;
  const layer3Pct = totalAssets > 0 ? Math.round((layer3Assets / totalAssets) * 100) : 0;
  const layer4Pct = totalAssets > 0 ? Math.round((layer4Assets / totalAssets) * 100) : 0;

  // 3. Cashflow & Debt Servicing
  const totalPassiveInflow = (db.assets || []).reduce((sum, a) => {
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

  const totalMonthlyIncome = (db.salaryIncome || 0) + (db.otherIncome || 0) + totalPassiveInflow;

  let totalMonthlyDebtOutflow = 0;
  let totalLivingOutflow = 0;

  (db.debts || []).forEach((d) => {
    if (d.status === 'Đã tất toán' || d.category === 'type_free') return;
    let m = d.monthlyBefore || d.installmentAmount || d.periodicAmount || 0;
    if (d.frequency === 'annual') m = Math.round(m / 12);
    else if (d.frequency === 'biannual') m = Math.round(m / 6);
    else if (d.frequency === 'quarterly') m = Math.round(m / 3);

    if (d.category === 'type4') {
      totalLivingOutflow += m;
    } else {
      totalMonthlyDebtOutflow += m;
    }
  });

  const totalMonthlyOutflow = totalMonthlyDebtOutflow + totalLivingOutflow;
  const netMonthlyCashflow = totalMonthlyIncome - totalMonthlyOutflow;

  // DTI (Debt to income)
  const dti = totalMonthlyIncome > 0 ? Math.round((totalMonthlyDebtOutflow / totalMonthlyIncome) * 100) : 0;

  // Emergency Runway months
  const emergencyCash = layer1Assets;
  const runwayMonths = totalMonthlyOutflow > 0 ? Number((emergencyCash / totalMonthlyOutflow).toFixed(1)) : 0;

  // 4. Goals and DCA progress
  const activeGoals = db.goals || [];
  const totalDcaMonthly = activeGoals.reduce((sum, g) => {
    if (g.status === 'completed') return sum;
    if (g.goalType === 'dca') {
      const f = g.freqMonths || 1;
      let periodAmt = 0;
      if (g.assetType === 'saving' || g.unit === 'VNĐ') {
        periodAmt = g.targetAmountPerPeriod || g.targetQty || 0;
      } else if (g.assetType === 'stock') {
        periodAmt = (g.targetQty || 1) * (g.currentPrice || 30000);
      } else if (g.assetType === 'gold') {
        periodAmt = (g.targetQty || 1) * (g.currentPrice || 8500000);
      } else {
        periodAmt = g.targetAmountPerPeriod || g.targetQty || 0;
      }
      return sum + Math.round(periodAmt / f);
    }
    return sum;
  }, 0);
  const achievedGoalsCount = activeGoals.filter((g) => (g.currentAmount || 0) >= (g.targetAmount || 1)).length;

  // 5. Composite Financial Health Score (100 pts)
  let healthScore = 70;
  if (dti <= 35) healthScore += 10;
  else if (dti > 50) healthScore -= 15;

  if (runwayMonths >= 6) healthScore += 10;
  else if (runwayMonths < 3) healthScore -= 10;

  if (debtToAssetRatio <= 30) healthScore += 10;
  else if (debtToAssetRatio > 50) healthScore -= 10;

  healthScore = Math.max(20, Math.min(98, healthScore));

  const healthGrade =
    healthScore >= 85
      ? 'Rất Vững Vàng (A+)'
      : healthScore >= 70
      ? 'An Toàn Tốt (B+)'
      : healthScore >= 50
      ? 'Cần Thận Trọng (C)'
      : 'Cảnh Báo Áp Lực (D)';

  const currentDateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Print-specific style to ensure strictly 1 clean A4 page without modal backdrop or buttons */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-health-report, #printable-health-report * {
            visibility: visible;
          }
          #printable-health-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top Action Bar (No Print) */}
        <div className="no-print px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">
                Báo Cáo Sức Khỏe Tài Chính (Executive Snapshot)
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-300">
                Tóm lược 1 trang A4 chuẩn Wealth Management • Tiện lưu trữ hoặc in PDF
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In / Lưu PDF (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Container for Preview */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
          {/* Printable 1-Page A4 Sheet Canvas */}
          <div
            id="printable-health-report"
            ref={printRef}
            className="bg-white mx-auto max-w-[800px] p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-md text-slate-800 space-y-4 sm:space-y-5"
          >
            {/* Header Document */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white p-2 flex items-center justify-center shadow-xs">
                  <PyramidLogo className="w-full h-full" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none">
                    EXECUTIVE WEALTH REPORT
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                    BÁO CÁO SỨC KHỎE TÀI CHÍNH
                  </h1>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Hệ thống Quản Trị & Hoạch Định Tháp Tài Sản Toàn Diện
                  </p>
                </div>
              </div>

              <div className="text-right text-xs space-y-0.5">
                <div className="text-slate-400 text-[10.5px]">Chủ sở hữu:</div>
                <div className="font-extrabold text-slate-900">{userDisplay}</div>
                <div className="text-[10.5px] text-slate-500 font-mono">Ngày lập: {currentDateStr}</div>
              </div>
            </div>

            {/* Top 3 Core Metrics Highlight */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tổng Tài Sản (Gross)
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {formatVND(totalAssets, isPrivacyMode)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {db.assets?.length || 0} hạng mục đầu tư
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Nghĩa Vụ Nợ Vay
                </span>
                <div className="text-base sm:text-lg font-black text-rose-600 mt-0.5">
                  {formatVND(totalDebts, isPrivacyMode)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Đòn bẩy: <strong>{debtToAssetRatio}%</strong> TTS
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tài Sản Ròng (Net Worth)
                </span>
                <div className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                  {formatVND(netWorth, isPrivacyMode)}
                </div>
                <span className="text-[10px] text-emerald-800 font-semibold mt-0.5 block">
                  Giá trị thặng dư thực tế
                </span>
              </div>
            </div>

            {/* Block 1: Tháp Tài Sản & Cơ Cấu Danh Mục */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-700" />
                  <span>1. Cơ Cấu Phân Bổ Tháp Tài Sản</span>
                </h3>
                <span className="text-[10.5px] text-slate-500">
                  Chuẩn mực quản trị rủi ro đa lớp
                </span>
              </div>

              {/* Visual Progress Bar of 4 Layers */}
              <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden border border-slate-200">
                <div style={{ width: `${layer1Pct}%` }} className="bg-emerald-500 h-full" title={`Tầng 1: ${layer1Pct}%`}></div>
                <div style={{ width: `${layer2Pct}%` }} className="bg-amber-500 h-full" title={`Tầng 2: ${layer2Pct}%`}></div>
                <div style={{ width: `${layer3Pct}%` }} className="bg-blue-600 h-full" title={`Tầng 3: ${layer3Pct}%`}></div>
                <div style={{ width: `${layer4Pct}%` }} className="bg-purple-600 h-full" title={`Tầng 4: ${layer4Pct}%`}></div>
              </div>

              {/* 4 Layers breakdown grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 text-xs">
                  <div className="font-bold text-emerald-900">Tầng 1: Phòng Thủ ({layer1Pct}%)</div>
                  <div className="text-[11px] font-extrabold text-emerald-700 mt-0.5">
                    {formatVND(layer1Assets, isPrivacyMode)}
                  </div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">Tiền mặt, tiết kiệm</div>
                </div>

                <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 text-xs">
                  <div className="font-bold text-amber-900">Tầng 2: Tài Sản Thực ({layer2Pct}%)</div>
                  <div className="text-[11px] font-extrabold text-amber-700 mt-0.5">
                    {formatVND(layer2Assets, isPrivacyMode)}
                  </div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">BĐS, vàng tích lũy</div>
                </div>

                <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/40 text-xs">
                  <div className="font-bold text-blue-900">Tầng 3: Tăng Trưởng ({layer3Pct}%)</div>
                  <div className="text-[11px] font-extrabold text-blue-700 mt-0.5">
                    {formatVND(layer3Assets, isPrivacyMode)}
                  </div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">Cổ phiếu, quỹ đầu tư</div>
                </div>

                <div className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/40 text-xs">
                  <div className="font-bold text-purple-900">Tầng 4: Mạo Hiểm ({layer4Pct}%)</div>
                  <div className="text-[11px] font-extrabold text-purple-700 mt-0.5">
                    {formatVND(layer4Assets, isPrivacyMode)}
                  </div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">Startup, tài sản số</div>
                </div>
              </div>
            </div>

            {/* Block 2: Sức Khỏe Dòng Tiền & Tỷ Lệ An Toàn DTI */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-slate-700" />
                  <span>2. Sức Khỏe Dòng Tiền & An Toàn Thanh Khoản</span>
                </h3>
                <span className="text-[10.5px] text-slate-500">
                  Dự báo lưu chuyển tiền tệ hàng tháng
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Thu Nhập Hàng Tháng</span>
                  <div className="font-black text-slate-900 mt-0.5">
                    {formatVND(totalMonthlyIncome, isPrivacyMode)}
                  </div>
                  <span className="text-[9.5px] text-slate-400">{db.incomes?.length || 0} nguồn thu</span>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Nghĩa Vụ Trả Nợ Gốc + Lãi</span>
                  <div className="font-black text-rose-600 mt-0.5">
                    {formatVND(totalMonthlyDebtOutflow, isPrivacyMode)}
                  </div>
                  <span className="text-[9.5px] text-slate-400">Chi trả định kỳ</span>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Gánh Nặng Nợ (DTI)</span>
                  <div
                    className={`font-black mt-0.5 ${
                      dti <= 35 ? 'text-emerald-700' : dti <= 50 ? 'text-amber-700' : 'text-rose-600'
                    }`}
                  >
                    {dti}% {dti <= 35 ? '• An toàn' : dti <= 50 ? '• Cảnh báo' : '• Nguy hiểm'}
                  </div>
                  <span className="text-[9.5px] text-slate-400">Chuẩn mực: ≤ 35%</span>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Runway Sinh Tồn</span>
                  <div className="font-black text-blue-700 mt-0.5">
                    {runwayMonths} tháng
                  </div>
                  <span className="text-[9.5px] text-slate-400">Dự phòng khẩn cấp</span>
                </div>
              </div>
            </div>

            {/* Block 3: Tiến Độ Kế Hoạch Trả Nợ & Tích Sản DCA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-700" />
                  <span>3. Tiến Độ Trả Nợ & Kỷ Luật Tích Sản DCA</span>
                </h3>
                <span className="text-[10.5px] text-slate-500">
                  {activeGoals.length} mục tiêu đang theo dõi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="flex justify-between items-center font-bold text-slate-800">
                    <span>Quản Trị Nghĩa Vụ Nợ Vay:</span>
                    <span className="text-rose-600">{db.debts?.length || 0} khoản nợ</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Dư nợ gốc còn lại:</span>
                      <strong>{formatVND(totalDebts, isPrivacyMode)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Chi trả nợ hàng tháng:</span>
                      <strong>{formatVND(totalMonthlyDebtOutflow, isPrivacyMode)}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="flex justify-between items-center font-bold text-slate-800">
                    <span>Kỷ Luật Tích Sản Định Kỳ (DCA):</span>
                    <span className="text-emerald-700">{formatVND(totalDcaMonthly, isPrivacyMode)}/th</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Mục tiêu đã hoàn thành:</span>
                      <strong>{achievedGoalsCount} / {activeGoals.length} mục tiêu</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Thặng dư dòng tiền sau DCA:</span>
                      <strong className={netMonthlyCashflow - totalDcaMonthly >= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                        {formatVND(netMonthlyCashflow - totalDcaMonthly, isPrivacyMode)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Block 4: Đánh Giá Tổng Thể & Khuyến Nghị Chuyên Gia */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                      ĐIỂM SỨC KHỎE TÀI CHÍNH TỔNG QUAN
                    </div>
                    <div className="text-base sm:text-lg font-black">{healthGrade}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 leading-none">
                    {healthScore}
                    <span className="text-xs text-slate-400 font-normal">/100</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-[11px] text-slate-300 space-y-1 leading-relaxed">
                <p>
                  • <strong>Đòn bẩy:</strong> {debtToAssetRatio <= 35 ? 'Tỷ lệ an toàn cao, biên độ phòng vệ vững chắc.' : 'Cần ưu tiên trả nợ sớm theo chiến lược Avalanche/Snowball để giảm chi phí lãi vay.'}
                </p>
                <p>
                  • <strong>Thanh khoản:</strong> Quỹ đệm thanh khoản hiện tại duy trì {runwayMonths} tháng chi tiêu {runwayMonths >= 6 ? '(Đạt chuẩn tối ưu 6-12 tháng).' : '(Nên gia cố thêm lên tối thiểu 6 tháng sinh hoạt).'}
                </p>
              </div>
            </div>

            {/* Signature & Disclaimer Footer */}
            <div className="pt-2 border-t border-slate-200 text-[9.5px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1 leading-tight">
              <div>
                Báo cáo được tổng hợp tự động từ phần mềm <strong>Tháp Tài Sản v5.2</strong>. Dành riêng cho mục đích hoạch định cá nhân và gia đình.
              </div>
              <div className="font-mono text-slate-400 shrink-0">
                Xác thực nội bộ • Mã: WLT-{new Date().getFullYear()}-{Math.floor(Math.random() * 9000 + 1000)}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (No Print) */}
        <div className="no-print px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Khổ in được tối ưu hoàn hảo cho 1 trang giấy A4 tiêu chuẩn.
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In Ngay</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
