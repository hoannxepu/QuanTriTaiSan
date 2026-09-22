import React, { useState, useMemo } from 'react';
import {
  X,
  Zap,
  TrendingDown,
  Calculator,
  ShieldCheck,
  Flame,
  Snowflake,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { DatabaseState, Debt } from '../types';
import { formatVND } from '../utils/format';

interface DebtPayoffSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseState;
  isPrivacyMode?: boolean;
}

interface SimulatedDebtItem {
  id: string;
  name: string;
  category: string;
  remainingPrincipal: number;
  interestRate: number; // %/year
  minMonthlyPayment: number;
}

interface StrategyResult {
  totalMonths: number;
  totalInterestPaid: number;
  totalPaid: number;
  savedMonths: number;
  savedInterest: number;
  payoffOrder: {
    debtId: string;
    debtName: string;
    payoffMonth: number;
    interestRate: number;
    remainingPrincipal: number;
  }[];
}

export const DebtPayoffSimulatorModal: React.FC<DebtPayoffSimulatorModalProps> = ({
  isOpen,
  onClose,
  db,
  isPrivacyMode = false,
}) => {
  // Extra monthly cashflow allocated for debt payoff
  const [extraMonthlyStr, setExtraMonthlyStr] = useState<string>('5000000');
  // One-time lump sum payoff
  const [lumpSumStr, setLumpSumStr] = useState<string>('0');
  // Active strategy tab: 'comparison' | 'snowball' | 'avalanche'
  const [activeStrategyTab, setActiveStrategyTab] = useState<'comparison' | 'snowball' | 'avalanche'>('comparison');

  // Dòng tiền thặng dư thực tế từ Tab 1 & Tab 2
  const actualMonthlySurplus = useMemo(() => {
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

    const totalInflow = (db.salaryIncome || 0) + (db.otherIncome || 0) + totalPassiveInflow;

    const totalOutflow = (db.debts || []).reduce((sum, d) => {
      if (d.status === 'Đã tất toán' || d.category === 'type_free') return sum;
      let m = d.monthlyBefore || d.installmentAmount || d.periodicAmount || 0;
      if (d.frequency === 'annual') m = Math.round(m / 12);
      else if (d.frequency === 'biannual') m = Math.round(m / 6);
      else if (d.frequency === 'quarterly') m = Math.round(m / 3);
      return sum + m;
    }, 0);

    return Math.max(0, totalInflow - totalOutflow);
  }, [db.assets, db.debts, db.salaryIncome, db.otherIncome]);

  // Extract active debts with positive balance (CHỈ TÍNH CÁC KHOẢN NỢ THỰC SỰ: Loại 1, Loại 2, Loại 3 tự do)
  const activeDebts: SimulatedDebtItem[] = useMemo(() => {
    return (db.debts || [])
      .filter((d) => {
        // Loại bỏ Chi phí định kỳ (Loại 4) và Sinh hoạt phí (Loại 5) vì đây là chi phí, không phải nợ gốc
        if (d.category !== 'type1' && d.category !== 'type2' && d.category !== 'type_free') return false;
        const remaining = Math.max(0, (d.amount || 0) - (d.paidPrincipal || 0));
        return remaining > 0 && d.status !== 'Đã tất toán';
      })
      .map((d) => {
        const remaining = Math.max(0, (d.amount || 0) - (d.paidPrincipal || 0));
        const rate = d.category === 'type2' || d.category === 'type_free' ? 0 : (d.promoRate || d.normalRate || 0);

        // Chi trả tối thiểu hàng tháng
        let minPay = 0;
        if (d.category === 'type1') {
          minPay = d.monthlyBefore || Math.max(Math.round((remaining * (rate / 100 / 12)) + (remaining * 0.01)), 200000);
        } else if (d.category === 'type2') {
          minPay = d.monthlyBefore || d.installmentAmount || (d.termMonths ? Math.round(remaining / d.termMonths) : 0);
        } else {
          // Vay người thân (tự do)
          minPay = 0;
        }

        return {
          id: d.id,
          name: d.name,
          category: d.category,
          remainingPrincipal: remaining,
          interestRate: rate,
          minMonthlyPayment: minPay,
        };
      });
  }, [db.debts]);

  const extraMonthly = useMemo(() => {
    const n = Number(extraMonthlyStr.replace(/\D/g, ''));
    return isNaN(n) ? 0 : n;
  }, [extraMonthlyStr]);

  const lumpSum = useMemo(() => {
    const n = Number(lumpSumStr.replace(/\D/g, ''));
    return isNaN(n) ? 0 : n;
  }, [lumpSumStr]);

  const totalCurrentDebt = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + d.remainingPrincipal, 0);
  }, [activeDebts]);

  const totalMinMonthly = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + d.minMonthlyPayment, 0);
  }, [activeDebts]);

  // Simulation Engine: Baseline, Snowball, Avalanche
  const simulationResults = useMemo(() => {
    if (activeDebts.length === 0) {
      return null;
    }

    // Helper simulation function
    const simulateStrategy = (
      debtsList: SimulatedDebtItem[],
      monthlyExtra: number,
      oneTimeLumpSum: number,
      sortFn?: (a: SimulatedDebtItem, b: SimulatedDebtItem) => number
    ): { totalMonths: number; totalInterestPaid: number; totalPaid: number; payoffOrder: any[] } => {
      // Deep copy debts
      let workingDebts = debtsList.map((d) => ({ ...d }));

      // Apply one-time lump sum first if any
      if (oneTimeLumpSum > 0) {
        let availableLump = oneTimeLumpSum;
        const sortedForLump = sortFn ? [...workingDebts].sort(sortFn) : [...workingDebts];
        for (const item of sortedForLump) {
          if (availableLump <= 0) break;
          const target = workingDebts.find((d) => d.id === item.id);
          if (target && target.remainingPrincipal > 0) {
            const pay = Math.min(target.remainingPrincipal, availableLump);
            target.remainingPrincipal -= pay;
            availableLump -= pay;
          }
        }
      }

      let month = 0;
      let totalInterestPaid = 0;
      let totalPaid = oneTimeLumpSum;
      const payoffOrder: any[] = [];
      const MAX_MONTHS = 480; // 40 years max safety cap

      while (month < MAX_MONTHS) {
        const remainingUnpaid = workingDebts.filter((d) => d.remainingPrincipal > 0);
        if (remainingUnpaid.length === 0) {
          break;
        }

        month++;

        // 1. Accrue monthly interest for all active debts
        for (const d of remainingUnpaid) {
          const monthlyRate = (d.interestRate / 100) / 12;
          const monthlyInterest = Math.round(d.remainingPrincipal * monthlyRate);
          d.remainingPrincipal += monthlyInterest;
          totalInterestPaid += monthlyInterest;
        }

        // 2. Pay minimum payments across all active debts
        let freedMonthlyFromPaidOff = 0;
        for (const d of workingDebts) {
          if (d.remainingPrincipal > 0) {
            const payment = Math.min(d.minMonthlyPayment, d.remainingPrincipal);
            d.remainingPrincipal -= payment;
            totalPaid += payment;

            if (d.remainingPrincipal <= 0) {
              d.remainingPrincipal = 0;
              payoffOrder.push({
                debtId: d.id,
                debtName: d.name,
                payoffMonth: month,
                interestRate: d.interestRate,
                remainingPrincipal: d.remainingPrincipal,
              });
            }
          } else {
            // This debt is already paid off, roll its minimum payment into the snowball pool
            freedMonthlyFromPaidOff += d.minMonthlyPayment;
          }
        }

        // 3. Snowball/Avalanche Pool = Extra monthly + rolled-over min payments from completed debts
        let extraPool = monthlyExtra + freedMonthlyFromPaidOff;

        // Sort candidates by strategy
        const candidates = workingDebts.filter((d) => d.remainingPrincipal > 0);
        if (sortFn && candidates.length > 0) {
          candidates.sort(sortFn);
        }

        // Apply extra pool to the highest priority candidate
        for (const priorityDebt of candidates) {
          if (extraPool <= 0) break;
          const pay = Math.min(extraPool, priorityDebt.remainingPrincipal);
          priorityDebt.remainingPrincipal -= pay;
          totalPaid += pay;
          extraPool -= pay;

          if (priorityDebt.remainingPrincipal <= 0) {
            priorityDebt.remainingPrincipal = 0;
            if (!payoffOrder.some((p) => p.debtId === priorityDebt.id)) {
              payoffOrder.push({
                debtId: priorityDebt.id,
                debtName: priorityDebt.name,
                payoffMonth: month,
                interestRate: priorityDebt.interestRate,
                remainingPrincipal: priorityDebt.remainingPrincipal,
              });
            }
          }
        }
      }

      return {
        totalMonths: month,
        totalInterestPaid,
        totalPaid,
        payoffOrder,
      };
    };

    // 1. Baseline: No extra payment, pay minimums only
    const baseline = simulateStrategy(activeDebts, 0, 0);

    // 2. Snowball: Smallest balance first
    const snowballRaw = simulateStrategy(
      activeDebts,
      extraMonthly,
      lumpSum,
      (a, b) => a.remainingPrincipal - b.remainingPrincipal
    );

    // 3. Avalanche: Highest interest rate first
    const avalancheRaw = simulateStrategy(
      activeDebts,
      extraMonthly,
      lumpSum,
      (a, b) => b.interestRate - a.interestRate
    );

    const snowball: StrategyResult = {
      ...snowballRaw,
      savedMonths: Math.max(0, baseline.totalMonths - snowballRaw.totalMonths),
      savedInterest: Math.max(0, baseline.totalInterestPaid - snowballRaw.totalInterestPaid),
    };

    const avalanche: StrategyResult = {
      ...avalancheRaw,
      savedMonths: Math.max(0, baseline.totalMonths - avalancheRaw.totalMonths),
      savedInterest: Math.max(0, baseline.totalInterestPaid - avalancheRaw.totalInterestPaid),
    };

    return {
      baseline,
      snowball,
      avalanche,
    };
  }, [activeDebts, extraMonthly, lumpSum]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                  Bộ Mô Phỏng Trả Nợ Sớm Thông Minh
                </h2>
                <span className="px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 text-[10px] font-bold border border-indigo-400/30">
                  Snowball vs Avalanche
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">
                Mô phỏng đòn bẩy thặng dư dòng tiền để rút ngắn thời gian và tối ưu hàng chục triệu tiền lãi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {activeDebts.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Chúc mừng! Bạn hiện không có khoản nợ nào cần thanh toán
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Toàn bộ các khoản nợ đã được tất toán hoặc chưa được ghi nhận trong Tab 2 (Quản trị nợ & Dòng tiền).
              </p>
            </div>
          ) : (
            <>
              {/* Input Control Box */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 sm:p-4.5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Thông Số Dòng Tiền Đẩy Nhanh Tiến Độ
                    </span>
                    <span className="text-[10.5px] text-slate-500">
                      Tổng dư nợ đang tính: <strong className="text-slate-800">{formatVND(totalCurrentDebt, isPrivacyMode)}</strong> ({activeDebts.length} khoản nợ)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shrink-0 font-medium">
                    Chi trả tối thiểu gốc + lãi: <strong className="text-rose-700">{formatVND(totalMinMonthly, isPrivacyMode)}/tháng</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                  {/* Cột 1: Dòng tiền dư thêm mỗi tháng */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Dư thêm hàng tháng (Monthly Extra)</span>
                      <span className="text-[10px] text-emerald-700 font-semibold">Trả dồn định kỳ</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={Number(extraMonthlyStr).toLocaleString('vi-VN')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setExtraMonthlyStr(val || '0');
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        placeholder="VD: 5.000.000"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">₫/tháng</span>
                    </div>

                    {/* Quick chips */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {actualMonthlySurplus > 0 && (
                        <button
                          type="button"
                          onClick={() => setExtraMonthlyStr(String(actualMonthlySurplus))}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 flex items-center gap-1"
                          title="Áp dụng 100% dòng tiền thặng dư thực tế từ Tab 1 & Tab 2"
                        >
                          <span>💡 Thặng dư thực tế:</span>
                          <span className="font-black">+{formatVND(actualMonthlySurplus, isPrivacyMode)}/th</span>
                        </button>
                      )}
                      {[2000000, 5000000, 10000000, 15000000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setExtraMonthlyStr(String(amt))}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                            extraMonthly === amt
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          +{amt / 1000000}Tr
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cột 2: Tiền cục nhàn rỗi trả ngay 1 lần */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Tiền nhàn rỗi trả ngay 1 lần (Lump-sum)</span>
                      <span className="text-[10px] text-indigo-700 font-semibold">Thưởng, bán tài sản...</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={Number(lumpSumStr).toLocaleString('vi-VN')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setLumpSumStr(val || '0');
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        placeholder="VD: 50.000.000"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">₫ 1 lần</span>
                    </div>

                    {/* Quick chips */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {[0, 20000000, 50000000, 100000000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setLumpSumStr(String(amt))}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                            lumpSum === amt
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {amt === 0 ? '0 ₫' : `+${amt / 1000000}Tr`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Strategy Tabs */}
              <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveStrategyTab('comparison')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeStrategyTab === 'comparison'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>So Sánh Tổng Thể (3 Kịch Bản)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStrategyTab('snowball')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeStrategyTab === 'snowball'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60'
                  }`}
                >
                  <Snowflake className="w-3.5 h-3.5 text-blue-300" />
                  <span>Chiến Lược Tuyết Lăn (Snowball)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStrategyTab('avalanche')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeStrategyTab === 'avalanche'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-rose-300" />
                  <span>Chiến Lược Lở Tuyết (Avalanche)</span>
                </button>
              </div>

              {/* 1. COMPARISON VIEW (SO SÁNH 3 KỊCH BẢN) */}
              {activeStrategyTab === 'comparison' && simulationResults && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {/* Cột 1: Kịch bản Hiện tại (Baseline) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Hiện Tại (Tối Thiểu)
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-600">
                            Không trả dồn
                          </span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
                          {Math.floor(simulationResults.baseline.totalMonths / 12)} năm {simulationResults.baseline.totalMonths % 12} th
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Tổng cộng {simulationResults.baseline.totalMonths} tháng để trả hết
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tổng lãi phải trả:</span>
                          <span className="font-bold text-rose-600">
                            {formatVND(simulationResults.baseline.totalInterestPaid, isPrivacyMode)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tổng tiền chi trả:</span>
                          <span className="font-bold text-slate-800">
                            {formatVND(simulationResults.baseline.totalPaid, isPrivacyMode)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cột 2: Tuyết Lăn (Snowball) */}
                    <div className="bg-gradient-to-b from-blue-50/70 to-white border-2 border-blue-300 rounded-2xl p-4 shadow-xs relative flex flex-col justify-between">
                      <div className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[9.5px] font-extrabold px-2 py-0.5 rounded-full uppercase shadow-xs">
                        Tâm lý thoải mái nhất
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5 mb-2">
                          <Snowflake className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">
                            Tuyết Lăn (Snowball)
                          </span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-blue-700 leading-tight">
                          {Math.floor(simulationResults.snowball.totalMonths / 12)} năm {simulationResults.snowball.totalMonths % 12} th
                        </div>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md text-[10.5px] font-bold mt-1.5">
                          <TrendingDown className="w-3 h-3 text-blue-700" />
                          <span>Rút ngắn {simulationResults.snowball.savedMonths} tháng ({((simulationResults.snowball.savedMonths / 12)).toFixed(1)} năm)</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-blue-200/60 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Tiết kiệm tiền lãi:</span>
                          <span className="font-extrabold text-emerald-700">
                            -{formatVND(simulationResults.snowball.savedInterest, isPrivacyMode)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Tổng lãi còn lại:</span>
                          <span className="font-bold text-slate-800">
                            {formatVND(simulationResults.snowball.totalInterestPaid, isPrivacyMode)}
                          </span>
                        </div>
                        <p className="text-[10px] text-blue-700 pt-1 leading-snug">
                          • Ưu tiên trả dứt điểm khoản nhỏ nhất trước ➔ Giảm nhanh số lượng chủ nợ.
                        </p>
                      </div>
                    </div>

                    {/* Cột 3: Lở Tuyết (Avalanche) */}
                    <div className="bg-gradient-to-b from-rose-50/70 to-white border-2 border-rose-300 rounded-2xl p-4 shadow-xs relative flex flex-col justify-between">
                      <div className="absolute -top-2.5 right-4 bg-rose-600 text-white text-[9.5px] font-extrabold px-2 py-0.5 rounded-full uppercase shadow-xs">
                        Tiết kiệm tiền nhất
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5 mb-2">
                          <Flame className="w-4 h-4 text-rose-600" />
                          <span className="text-xs font-extrabold text-rose-900 uppercase tracking-wider">
                            Lở Tuyết (Avalanche)
                          </span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-rose-700 leading-tight">
                          {Math.floor(simulationResults.avalanche.totalMonths / 12)} năm {simulationResults.avalanche.totalMonths % 12} th
                        </div>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-900 rounded-md text-[10.5px] font-bold mt-1.5">
                          <TrendingDown className="w-3 h-3 text-rose-700" />
                          <span>Rút ngắn {simulationResults.avalanche.savedMonths} tháng ({((simulationResults.avalanche.savedMonths / 12)).toFixed(1)} năm)</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-rose-200/60 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Tiết kiệm tiền lãi:</span>
                          <span className="font-extrabold text-emerald-700">
                            -{formatVND(simulationResults.avalanche.savedInterest, isPrivacyMode)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Tổng lãi còn lại:</span>
                          <span className="font-bold text-slate-800">
                            {formatVND(simulationResults.avalanche.totalInterestPaid, isPrivacyMode)}
                          </span>
                        </div>
                        <p className="text-[10px] text-rose-700 pt-1 leading-snug">
                          • Ưu tiên khoản có lãi suất cao nhất trước ➔ Tối ưu tối đa từng đồng tiền lãi.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Highlights & Financial Advice */}
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 sm:p-4 text-xs space-y-2">
                    <div className="flex items-center space-x-2 text-amber-900 font-bold">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Chiến Lược Nào Phù Hợp Nhất Với Bạn?</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-700 leading-relaxed">
                      <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                        <strong className="text-blue-800 block mb-0.5">Nên chọn Tuyết Lăn (Snowball) khi:</strong>
                        Bạn đang có nhiều khoản nợ lặt vặt (thẻ tín dụng, bạn bè, trả góp mua sắm) và cảm thấy mệt mỏi về mặt tâm lý. Khi xóa sổ được 1-2 khoản nợ đầu tiên nhanh chóng, bạn sẽ có niềm tin và năng lượng rất lớn để tiếp tục.
                      </div>
                      <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                        <strong className="text-rose-800 block mb-0.5">Nên chọn Lở Tuyết (Avalanche) khi:</strong>
                        Bạn là người có kỷ luật thép, thích toán học và tối ưu tài chính. Chiến lược này giúp bạn tiết kiệm nhiều hơn{' '}
                        <strong className="text-emerald-700">
                          {formatVND(
                            Math.abs(simulationResults.avalanche.savedInterest - simulationResults.snowball.savedInterest),
                            isPrivacyMode
                          )}
                        </strong>{' '}
                        so với Snowball.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. DETAIL ROADMAP VIEW FOR SNOWBALL OR AVALANCHE */}
              {(activeStrategyTab === 'snowball' || activeStrategyTab === 'avalanche') && simulationResults && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>
                        Lộ Trình Giải Quyết Từng Khoản Nợ Theo Chiến Lược{' '}
                        {activeStrategyTab === 'snowball' ? 'Tuyết Lăn (Snowball)' : 'Lở Tuyết (Avalanche)'}
                      </span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Sắp xếp theo thứ tự ưu tiên dồn lực
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(activeStrategyTab === 'snowball'
                      ? simulationResults.snowball.payoffOrder
                      : simulationResults.avalanche.payoffOrder
                    ).map((item, idx) => (
                      <div
                        key={item.debtId}
                        className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-indigo-300 transition shadow-2xs"
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                              idx === 0
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{item.debtName}</div>
                            <div className="text-[10.5px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>Lãi suất: <strong>{item.interestRate}%/năm</strong></span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">
                                Dư nợ: <strong>{formatVND(item.remainingPrincipal, isPrivacyMode)}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 self-end sm:self-center">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Dự kiến tất toán vào:</span>
                            <span className="font-extrabold text-xs text-indigo-700">
                              Tháng thứ {item.payoffMonth} ({((item.payoffMonth / 12)).toFixed(1)} năm)
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            Xóa sổ xong #{idx + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">Dữ liệu mô phỏng toán học chính xác theo dòng tiền thực tế của bạn.</span>
            <span className="sm:hidden">Mô phỏng toán học thực tế.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Đóng Mô Phỏng
          </button>
        </div>
      </div>
    </div>
  );
};
