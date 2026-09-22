import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowDownRight,
  CreditCard,
  Target,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Sliders,
  DollarSign,
  TrendingUp,
  Landmark,
  ShieldCheck,
  Info,
  CalendarDays,
} from 'lucide-react';
import { DatabaseState, Debt, Goal, Asset } from '../types';
import { formatVND } from '../utils/format';

interface FinancialCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseState;
  isPrivacyMode?: boolean;
}

export interface CalendarEvent {
  id: string;
  type: 'income' | 'debt' | 'dca' | 'living';
  title: string;
  amount: number;
  day: number;
  category?: string;
  subType?: 'salary' | 'other_income' | 'passive' | 'maturity' | 'type1' | 'type2' | 'type3' | 'type4' | 'type_free' | 'dca';
  frequencyNote?: string;
  note?: string;
  isConvertedMonthly?: boolean;
}

export const FinancialCalendarModal: React.FC<FinancialCalendarModalProps> = ({
  isOpen,
  onClose,
  db,
  isPrivacyMode = false,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed (0 = Jan, 11 = Dec)
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');

  // Cấu hình ngày nhận lương & thu nhập khác (lưu tạm trong session, có thể tùy chỉnh)
  const [salaryDay, setSalaryDay] = useState<number>(5);
  const [otherIncomeDay, setOtherIncomeDay] = useState<number>(15);

  // Chế độ tính chi phí cố định dài hạn (như bảo hiểm đóng theo năm/quý)
  // 'smooth_monthly': Quy đổi chia đều ra 12 tháng để trích lập quỹ dự phòng
  // 'actual_due': Chỉ ghi nhận chi trả vào đúng tháng và chu kỳ thanh toán thực tế
  const [recurringCostMode, setRecurringCostMode] = useState<'smooth_monthly' | 'actual_due'>('smooth_monthly');

  // Toggle bảng tùy chỉnh chu kỳ
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  // Filter filterType: 'all' | 'income' | 'debt' | 'dca'
  const [filterType, setFilterType] = useState<'all' | 'income' | 'debt' | 'dca'>('all');

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat). Adjusted to Monday start (0 = Mon, ..., 6 = Sun)
  const startDayOfWeek = useMemo(() => {
    const raw = new Date(currentYear, currentMonth, 1).getDay();
    return raw === 0 ? 6 : raw - 1;
  }, [currentYear, currentMonth]);

  // Compile all monthly financial events
  const monthEvents: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = [];

    // ==========================================
    // 1. DÒNG TIỀN VÀO (INFLOWS)
    // ==========================================
    // 1.1. Lương & Thu nhập chính hàng tháng
    const salary = db.salaryIncome || 0;
    if (salary > 0) {
      const validDay = Math.min(Math.max(salaryDay, 1), daysInMonth);
      list.push({
        id: 'inc-salary',
        type: 'income',
        subType: 'salary',
        title: 'Lương & Thu nhập chính',
        amount: salary,
        day: validDay,
        category: 'Nguồn thu chính',
        note: `Nhận định kỳ ngày ${validDay} hàng tháng`,
      });
    }

    // 1.2. Thu nhập phụ & kinh doanh khác
    const otherInc = db.otherIncome || 0;
    if (otherInc > 0) {
      const validDay = Math.min(Math.max(otherIncomeDay, 1), daysInMonth);
      list.push({
        id: 'inc-other',
        type: 'income',
        subType: 'other_income',
        title: 'Thu nhập khác / Kinh doanh',
        amount: otherInc,
        day: validDay,
        category: 'Nguồn thu phụ',
        note: `Thu nhập bổ sung ngày ${validDay} hàng tháng`,
      });
    }

    // 1.3. Dòng tiền thụ động định kỳ từ Tài sản Tab 1
    (db.assets || []).forEach((a) => {
      // Bất động sản cho thuê (dòng tiền nhận ngày mùng 1 hàng tháng)
      if (a.type === 'realestate_rent' && a.cashflow && a.cashflow > 0) {
        list.push({
          id: `inc-asset-rent-${a.id}`,
          type: 'income',
          subType: 'passive',
          title: `Tiền thuê: ${a.name}`,
          amount: a.cashflow,
          day: 1,
          category: 'Thu nhập BĐS',
          note: 'Dòng tiền cho thuê BĐS ngày đầu tháng',
        });
      }

      // Cho vay P2P / PE nhận lợi nhuận (ngày 15 hàng tháng)
      if ((a.type === 'peer_lending' || a.type === 'private_equity') && a.cashflow && a.cashflow > 0) {
        list.push({
          id: `inc-asset-cf-${a.id}`,
          type: 'income',
          subType: 'passive',
          title: `Lợi tức: ${a.name}`,
          amount: a.cashflow,
          day: Math.min(15, daysInMonth),
          category: 'Thu nhập đầu tư',
          note: 'Lợi nhuận cổ phần / cho vay định kỳ',
        });
      }

      // Cổ tức cổ phiếu định kỳ hàng tháng
      if (a.type === 'stock' && a.quantity && a.divCash && a.divCash > 0) {
        const monthlyDiv = Math.round((a.quantity * a.divCash) / 12);
        if (monthlyDiv > 0) {
          list.push({
            id: `inc-asset-div-${a.id}`,
            type: 'income',
            subType: 'passive',
            title: `Cổ tức CP: ${a.name}`,
            amount: monthlyDiv,
            day: Math.min(20, daysInMonth),
            category: 'Cổ tức cổ phiếu',
            note: 'Quy đổi cổ tức tiền mặt trung bình tháng',
          });
        }
      }

      // Tiền gửi tiết kiệm sinh lãi định kỳ hàng tháng
      if (a.type === 'saving' && a.rate && a.termMonths && a.amount > 0) {
        const monthlyInterest = Math.round((a.amount * (a.rate / 100) * (a.termMonths / 12)) / a.termMonths);
        if (monthlyInterest > 0) {
          list.push({
            id: `inc-asset-interest-${a.id}`,
            type: 'income',
            subType: 'passive',
            title: `Lãi tiết kiệm: ${a.name}`,
            amount: monthlyInterest,
            day: Math.min(25, daysInMonth),
            category: 'Lãi tiền gửi',
            note: `Lãi suất ${a.rate}%/năm tích lũy theo tháng`,
          });
        }
      }

      // 1.4. ĐẶC BIỆT: Sổ Tiết Kiệm / Trái Phiếu Đáo Hạn Trong Tháng Đang Xem
      if (a.maturityDate) {
        try {
          const matDate = new Date(a.maturityDate);
          if (
            !isNaN(matDate.getTime()) &&
            matDate.getMonth() === currentMonth &&
            matDate.getFullYear() === currentYear
          ) {
            const matDay = Math.min(Math.max(matDate.getDate(), 1), daysInMonth);
            const totalInterest = Math.round(
              (a.amount || 0) * ((a.rate || 5.5) / 100) * ((a.termMonths || 12) / 12)
            );
            const totalPayout = (a.amount || 0) + totalInterest;

            list.push({
              id: `inc-asset-mat-${a.id}`,
              type: 'income',
              subType: 'maturity',
              title: `🎉 Đáo hạn sổ: ${a.name}`,
              amount: totalPayout,
              day: matDay,
              category: 'Tài sản đáo hạn',
              note: `Nhận gốc ${formatVND(a.amount || 0)} + lãi ${formatVND(totalInterest)} (${matDate.toLocaleDateString('vi-VN')})`,
            });
          }
        } catch {
          // ignore date parse errors
        }
      }
    });

    // ==========================================
    // 2. NGHĨA VỤ CHI TRẢ NỢ & CHI PHÍ (OUTFLOWS)
    // ==========================================
    (db.debts || []).forEach((d) => {
      if (d.status === 'Đã tất toán') return;

      const debtDay = d.day ? Math.min(Math.max(d.day, 1), daysInMonth) : 20;

      // Loại 1: Vay ngân hàng có lãi (thế chấp / tín chấp)
      if (d.category === 'type1') {
        const remaining = Math.max(0, (d.amount || 0) - (d.paidPrincipal || 0));
        if (remaining > 0 || d.monthlyBefore > 0) {
          const amt = d.monthlyBefore || 0;
          list.push({
            id: `debt-${d.id}`,
            type: 'debt',
            subType: 'type1',
            title: d.name,
            amount: amt,
            day: debtDay,
            category: 'Nợ vay có lãi (Loại 1)',
            frequencyNote: '/tháng',
            note: d.note || `Dư nợ gốc còn: ${formatVND(remaining)}`,
          });
        }
      }

      // Loại 2: Trả góp 0%
      else if (d.category === 'type2') {
        const remaining = Math.max(0, (d.amount || 0) - (d.paidPrincipal || 0));
        if (remaining > 0 || d.monthlyBefore > 0 || d.installmentAmount) {
          const amt = d.monthlyBefore || d.installmentAmount || 0;
          list.push({
            id: `debt-${d.id}`,
            type: 'debt',
            subType: 'type2',
            title: d.name,
            amount: amt,
            day: debtDay,
            category: 'Nợ trả góp 0% (Loại 2)',
            frequencyNote: '/tháng',
            note: d.note || `Dư nợ trả góp còn: ${formatVND(remaining)}`,
          });
        }
      }

      // Loại 3: Vay người thân / vay tự do (trả linh hoạt, không lãi)
      else if (d.category === 'type_free') {
        const remaining = Math.max(0, (d.amount || 0) - (d.paidPrincipal || 0));
        if (remaining > 0) {
          list.push({
            id: `debt-${d.id}`,
            type: 'debt',
            subType: 'type_free',
            title: `${d.name} (Vay người thân)`,
            amount: 0, // Trả linh hoạt không áp lực
            day: Math.min(28, daysInMonth),
            category: 'Vay tự do (Loại 3)',
            frequencyNote: 'Linh hoạt',
            note: `Dư nợ cần hoàn trả: ${formatVND(remaining)} (Không bắt buộc định kỳ)`,
          });
        }
      }

      // Loại 4: Chi phí định kỳ cố định dài hạn (Bảo hiểm, thuê nhà, học phí...)
      else if (d.category === 'type3') {
        const baseAmount = d.periodicAmount || d.monthlyBefore || 0;
        const freq = d.frequency || 'monthly';

        if (recurringCostMode === 'smooth_monthly') {
          // CHẾ ĐỘ 1: QUY ĐỔI CHIA ĐỀU RA 12 THÁNG (TRÍCH LẬP QUỸ)
          let monthlyEquivalent = baseAmount;
          let freqLabel = 'Hàng tháng';
          if (freq === 'annual') {
            monthlyEquivalent = Math.round(baseAmount / 12);
            freqLabel = `Quy đổi từ ${formatVND(baseAmount)}/năm`;
          } else if (freq === 'biannual') {
            monthlyEquivalent = Math.round(baseAmount / 6);
            freqLabel = `Quy đổi từ ${formatVND(baseAmount)}/6T`;
          } else if (freq === 'quarterly') {
            monthlyEquivalent = Math.round(baseAmount / 3);
            freqLabel = `Quy đổi từ ${formatVND(baseAmount)}/quý`;
          }

          if (monthlyEquivalent > 0) {
            list.push({
              id: `debt-${d.id}`,
              type: 'debt',
              subType: 'type3',
              title: d.name,
              amount: monthlyEquivalent,
              day: debtDay,
              category: 'Chi phí định kỳ (Loại 4)',
              frequencyNote: freqLabel,
              isConvertedMonthly: freq !== 'monthly',
              note: d.note || `Trích lập quỹ đều tháng: ${formatVND(monthlyEquivalent)}/th`,
            });
          }
        } else {
          // CHẾ ĐỘ 2: ĐÚNG KỲ HẠN VÀ THÁNG PHÁT SINH THỰC TẾ
          let isDueThisMonth = false;
          let startMonth = 0;
          if (d.startDate) {
            const sDate = new Date(d.startDate);
            if (!isNaN(sDate.getTime())) {
              startMonth = sDate.getMonth();
            }
          }

          if (freq === 'monthly') {
            isDueThisMonth = true;
          } else if (freq === 'quarterly') {
            // Cứ 3 tháng 1 lần tính từ startMonth
            isDueThisMonth = (currentMonth - startMonth + 12) % 3 === 0;
          } else if (freq === 'biannual') {
            // Cứ 6 tháng 1 lần tính từ startMonth
            isDueThisMonth = (currentMonth - startMonth + 12) % 6 === 0;
          } else if (freq === 'annual') {
            // 1 lần trong năm vào đúng tháng startMonth
            isDueThisMonth = currentMonth === startMonth;
          }

          if (isDueThisMonth && baseAmount > 0) {
            list.push({
              id: `debt-${d.id}`,
              type: 'debt',
              subType: 'type3',
              title: `${d.name} (${freq === 'annual' ? 'Kỳ Hàng Năm' : freq === 'quarterly' ? 'Kỳ Hàng Quý' : 'Đến Hạn Đóng'})`,
              amount: baseAmount,
              day: debtDay,
              category: 'Chi phí định kỳ (Loại 4)',
              frequencyNote: freq === 'annual' ? '/năm' : freq === 'quarterly' ? '/quý' : '/kỳ',
              isConvertedMonthly: false,
              note: d.note || `Thanh toán thực tế kỳ ${freq}: ${formatVND(baseAmount)}`,
            });
          }
        }
      }

      // Loại 5: Chi phí sinh hoạt thường xuyên
      else if (d.category === 'type4') {
        const amt = d.periodicAmount || d.monthlyBefore || 0;
        if (amt > 0) {
          list.push({
            id: `debt-${d.id}`,
            type: 'debt',
            subType: 'type4',
            title: d.name,
            amount: amt,
            day: debtDay,
            category: 'Sinh hoạt phí (Loại 5)',
            frequencyNote: '/tháng',
            note: d.note || 'Chi phí sinh hoạt cố định tháng',
          });
        }
      }
    });

    // ==========================================
    // 3. TÍCH SẢN ĐỊNH KỲ DCA (TAB 3)
    // ==========================================
    (db.goals || []).forEach((g) => {
      if (g.status === 'completed') return;
      if (g.goalType === 'dca') {
        const f = g.freqMonths || 1;
        let periodAmt = 0;

        if (g.assetType === 'saving' || g.unit === 'VNĐ') {
          periodAmt = g.targetAmountPerPeriod || g.targetQty || 0;
        } else if (g.assetType === 'stock') {
          const linked = db.assets.find(
            (a) => a.id === g.linkedAssetId || a.name.toLowerCase() === g.name.toLowerCase()
          );
          const price =
            g.currentPrice ||
            (linked && linked.quantity && linked.quantity > 0
              ? Math.round(linked.amount / linked.quantity)
              : 30000);
          periodAmt = (g.targetQty || 1) * price;
        } else if (g.assetType === 'gold') {
          const price = g.currentPrice || 8500000;
          periodAmt = (g.targetQty || 1) * price;
        } else {
          periodAmt = g.targetAmountPerPeriod || g.targetQty || 0;
        }

        const monthlyDca = Math.round(periodAmt / f);
        if (monthlyDca > 0) {
          const dcaDay = g.day ? Math.min(Math.max(g.day, 1), daysInMonth) : 10;
          list.push({
            id: `goal-${g.id}`,
            type: 'dca',
            subType: 'dca',
            title: `Tích sản: ${g.name}`,
            amount: monthlyDca,
            day: dcaDay,
            category: 'Tích sản DCA (Tab 3)',
            frequencyNote: f === 1 ? '/tháng' : `/${f} tháng`,
            note: g.note || `Mục tiêu ${g.targetQty ? `${g.targetQty} ${g.unit || ''}` : formatVND(periodAmt)}`,
          });
        }
      }
    });

    return list;
  }, [
    db.salaryIncome,
    db.otherIncome,
    db.assets,
    db.debts,
    db.goals,
    salaryDay,
    otherIncomeDay,
    recurringCostMode,
    currentMonth,
    currentYear,
    daysInMonth,
  ]);

  // Filtered Events
  const filteredMonthEvents = useMemo(() => {
    if (filterType === 'all') return monthEvents;
    return monthEvents.filter((e) => e.type === filterType);
  }, [monthEvents, filterType]);

  // Map events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (let d = 1; d <= daysInMonth; d++) {
      map.set(d, []);
    }
    filteredMonthEvents.forEach((ev) => {
      const existing = map.get(ev.day) || [];
      existing.push(ev);
      map.set(ev.day, existing);
    });
    return map;
  }, [filteredMonthEvents, daysInMonth]);

  // Monthly summary calculations
  const totalMonthlyInflow = useMemo(() => {
    return monthEvents.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  }, [monthEvents]);

  const totalMonthlyDebt = useMemo(() => {
    return monthEvents.filter((e) => e.type === 'debt').reduce((sum, e) => sum + e.amount, 0);
  }, [monthEvents]);

  const totalMonthlyDCA = useMemo(() => {
    return monthEvents.filter((e) => e.type === 'dca').reduce((sum, e) => sum + e.amount, 0);
  }, [monthEvents]);

  const netSurplus = totalMonthlyInflow - totalMonthlyDebt - totalMonthlyDCA;

  // Selected Day events
  const selectedDayEvents = useMemo(() => {
    return eventsByDay.get(selectedDay) || [];
  }, [eventsByDay, selectedDay]);

  const monthNames = [
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                  Lịch Tài Chính & Dòng Tiền Trực Quan
                </h2>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                  Thu Vào • Chi Ra • Tích Sản DCA
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">
                Đồng bộ tự động thu nhập lương, hạn trả nợ thẻ/ngân hàng, chi phí định kỳ và ngày gom tài sản
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setShowConfigPanel((prev) => !prev)}
              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                showConfigPanel
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-white/10 hover:bg-white/20 border-white/10 text-slate-200 hover:text-white'
              }`}
              title="Cài đặt ngày nhận lương & chế độ quy đổi chi phí"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cài đặt</span>
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

        {/* Collapsible Config Panel: Salary Day & Debt Smoothing Mode */}
        {showConfigPanel && (
          <div className="bg-slate-900/95 text-white px-4 py-3 border-b border-slate-700/80 animate-in slide-in-from-top-2 duration-150 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Cột 1: Cài đặt ngày nhận tiền vào */}
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 space-y-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Ngày Nhận Dòng Tiền Vào (Inflows)</span>
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-slate-300 block mb-1">Ngày nhận lương:</label>
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400">Mùng</span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={salaryDay}
                        onChange={(e) => setSalaryDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-14 bg-slate-950 border border-slate-600 rounded px-2 py-1 text-center font-bold text-emerald-400 outline-none focus:border-emerald-500"
                      />
                      <span className="text-slate-400">hàng tháng</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Thu nhập khác:</label>
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400">Mùng</span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={otherIncomeDay}
                        onChange={(e) => setOtherIncomeDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-14 bg-slate-950 border border-slate-600 rounded px-2 py-1 text-center font-bold text-emerald-400 outline-none focus:border-emerald-500"
                      />
                      <span className="text-slate-400">hàng tháng</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cột 2: Chế độ hiển thị nợ cố định (Quy đổi vs Thực tế) */}
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 space-y-2">
                <span className="font-bold text-blue-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Chế Độ Hiển Thị Chi Phí Cố Định / Bảo Hiểm (Loại 4)</span>
                </span>
                <div className="flex items-center space-x-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setRecurringCostMode('smooth_monthly')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[10.5px] font-bold border transition text-center cursor-pointer ${
                      recurringCostMode === 'smooth_monthly'
                        ? 'bg-blue-600 border-blue-400 text-white shadow-xs'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div>Trích Lập Quỹ Đều Tháng</div>
                    <div className="text-[9px] opacity-75 font-normal">Quy đổi năm/quý chia đều cho 12 tháng</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurringCostMode('actual_due')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[10.5px] font-bold border transition text-center cursor-pointer ${
                      recurringCostMode === 'actual_due'
                        ? 'bg-blue-600 border-blue-400 text-white shadow-xs'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div>Thanh Toán Thực Tế</div>
                    <div className="text-[9px] opacity-75 font-normal">Chỉ phát sinh đúng tháng đến hạn nộp</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Month Controls & Stats Bar */}
        <div className="p-3 sm:p-5 bg-slate-50 border-b border-slate-200 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Month & Year Switcher */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm sm:text-base font-black text-slate-900 px-2 min-w-[130px] text-center">
                {monthNames[currentMonth]} {currentYear}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMonth(today.getMonth());
                  setCurrentYear(today.getFullYear());
                  setSelectedDay(today.getDate());
                }}
                className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
              >
                Hôm Nay
              </button>
            </div>

            {/* Quick Filter: All | Incomes | Debts | DCA */}
            <div className="flex items-center space-x-1 bg-white border border-slate-200 p-0.5 rounded-xl self-start sm:self-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất Cả ({monthEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('income')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  filterType === 'income'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span>Thu Vào</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('debt')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  filterType === 'debt'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <span>Chi Trả Nợ</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('dca')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  filterType === 'dca'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <span>Tích Sản DCA</span>
              </button>
            </div>

            {/* View Mode Toggle: Calendar vs Timeline */}
            <div className="flex items-center space-x-1 bg-white border border-slate-200 p-0.5 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'calendar'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Lưới Lịch</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'timeline'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Lộ Trình</span>
              </button>
            </div>
          </div>

          {/* 4 Metric Pills: Inflow, Outflow, DCA, Surplus */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-white border border-emerald-200/90 p-2.5 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Tổng Thu Nhập Vào
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
                +{formatVND(totalMonthlyInflow, isPrivacyMode)}
              </div>
              <span className="text-[9.5px] text-slate-400 block mt-0.5">
                Lương, thu phụ, BĐS & lãi
              </span>
            </div>

            <div className="bg-white border border-rose-200/90 p-2.5 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                  Nghĩa Vụ Trả Nợ & Chi Phí
                </span>
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              </div>
              <div className="text-xs sm:text-sm font-black text-rose-700 mt-0.5">
                -{formatVND(totalMonthlyDebt, isPrivacyMode)}
              </div>
              <span className="text-[9.5px] text-slate-400 block mt-0.5">
                {recurringCostMode === 'smooth_monthly' ? 'Đã quy đổi đều tháng' : 'Theo kỳ thực tế'}
              </span>
            </div>

            <div className="bg-white border border-amber-200/90 p-2.5 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Tích Sản Định Kỳ (DCA)
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              </div>
              <div className="text-xs sm:text-sm font-black text-amber-800 mt-0.5">
                -{formatVND(totalMonthlyDCA, isPrivacyMode)}
              </div>
              <span className="text-[9.5px] text-slate-400 block mt-0.5">
                Cổ phiếu, vàng, tích lũy
              </span>
            </div>

            <div className="bg-white border border-blue-200/90 p-2.5 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Thặng Dư Dòng Tiền Ròng
                </span>
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              </div>
              <div
                className={`text-xs sm:text-sm font-black mt-0.5 ${
                  netSurplus >= 0 ? 'text-blue-800' : 'text-rose-600'
                }`}
              >
                {netSurplus >= 0 ? '+' : ''}
                {formatVND(netSurplus, isPrivacyMode)}
              </div>
              <span className="text-[9.5px] text-slate-400 block mt-0.5">
                Khả dụng tái đầu tư / tự do
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1">
          {viewMode === 'calendar' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Cột trái: Lưới lịch 7 ngày */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs">
                {/* Thứ trong tuần */}
                <div className="grid grid-cols-7 text-center font-bold text-[10.5px] sm:text-xs text-slate-500 pb-2 border-b border-slate-100">
                  <span>T2</span>
                  <span>T3</span>
                  <span>T4</span>
                  <span>T5</span>
                  <span>T6</span>
                  <span className="text-blue-600">T7</span>
                  <span className="text-rose-600">CN</span>
                </div>

                {/* Grid các ngày */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-2">
                  {/* Empty placeholders before start of month */}
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[50px] sm:min-h-[70px] bg-slate-50/50 rounded-xl"></div>
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const evs = eventsByDay.get(dayNum) || [];
                    const isToday =
                      dayNum === today.getDate() &&
                      currentMonth === today.getMonth() &&
                      currentYear === today.getFullYear();
                    const isSelected = dayNum === selectedDay;

                    return (
                      <div
                        key={dayNum}
                        onClick={() => setSelectedDay(dayNum)}
                        className={`min-h-[55px] sm:min-h-[72px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/20 shadow-xs'
                            : isToday
                            ? 'border-blue-400 bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold leading-none ${
                              isToday
                                ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10.5px]'
                                : 'text-slate-800'
                            }`}
                          >
                            {dayNum}
                          </span>
                          {evs.length > 0 && (
                            <span className="text-[9px] font-extrabold px-1 rounded-full bg-slate-100 text-slate-700">
                              {evs.length}
                            </span>
                          )}
                        </div>

                        {/* Dot indicator or mini badges */}
                        <div className="space-y-0.5 mt-1">
                          {evs.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              className={`text-[8px] sm:text-[9px] font-bold px-1 py-0.2 rounded truncate leading-tight ${
                                ev.type === 'income'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ev.type === 'debt'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                              title={`${ev.title}: ${formatVND(ev.amount)}`}
                            >
                              {ev.type === 'income' ? '+' : '-'}
                              {ev.title}
                            </div>
                          ))}
                          {evs.length > 2 && (
                            <div className="text-[8px] text-slate-400 font-bold leading-none">
                              +{evs.length - 2} mục nữa
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cột phải: Chi tiết các sự kiện của ngày đang chọn */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Chi Tiết Sự Kiện Trong Ngày
                      </span>
                      <h4 className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                        Ngày {selectedDay} / {currentMonth + 1} / {currentYear}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-white border border-slate-200 text-slate-700">
                      {selectedDayEvents.length} mốc
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {selectedDayEvents.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        Không có mốc dòng tiền thu/chi nào vào ngày này.
                      </div>
                    ) : (
                      selectedDayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2 min-w-0">
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                                  ev.type === 'income'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : ev.type === 'debt'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {ev.type === 'income' ? (
                                  <ArrowDownRight className="w-4 h-4" />
                                ) : ev.type === 'debt' ? (
                                  <CreditCard className="w-4 h-4" />
                                ) : (
                                  <Target className="w-4 h-4" />
                                )}
                              </span>
                              <div className="min-w-0 truncate">
                                <span className="font-bold text-xs text-slate-900 block truncate">
                                  {ev.title}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {ev.category}
                                  </span>
                                  {ev.frequencyNote && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      {ev.frequencyNote}
                                    </span>
                                  )}
                                  {ev.isConvertedMonthly && (
                                    <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      Trích lập tháng
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div
                              className={`text-right text-xs font-black shrink-0 ${
                                ev.type === 'income'
                                  ? 'text-emerald-700'
                                  : ev.amount === 0
                                  ? 'text-purple-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {ev.amount === 0
                                ? 'Linh hoạt'
                                : `${ev.type === 'income' ? '+' : '-'}${formatVND(ev.amount, isPrivacyMode)}`}
                            </div>
                          </div>

                          {ev.note && (
                            <p className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded-md border border-slate-100">
                              "{ev.note}"
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Bottom Tip */}
                <div className="mt-4 pt-3 border-t border-slate-200/80 text-[10.5px] text-slate-500 leading-relaxed">
                  💡 <strong>Chiến lược thanh khoản:</strong> Nên sắp xếp ngày thanh toán các khoản nợ vay (Loại 1, 2) sau ngày nhận lương 3–5 ngày để số dư luôn sẵn sàng, tránh bị trừ trễ hạn.
                </div>
              </div>
            </div>
          ) : (
            /* 2. TIMELINE LIST VIEW */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700">
                  Lộ Trình Dòng Tiền Theo Thứ Tự Ngày Trong Tháng {currentMonth + 1}/{currentYear}
                </span>
                <span className="text-[11px] text-slate-500">
                  {filteredMonthEvents.length} mốc dòng tiền
                </span>
              </div>

              {filteredMonthEvents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Chưa có dữ liệu lịch tài chính phù hợp với bộ lọc trong tháng này.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...filteredMonthEvents]
                    .sort((a, b) => a.day - b.day)
                    .map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs hover:border-slate-300 transition"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">
                              Ngày
                            </span>
                            <span className="text-sm font-black text-slate-900 leading-tight">
                              {ev.day}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-900">{ev.title}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  ev.type === 'income'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ev.type === 'debt'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {ev.type === 'income'
                                  ? 'Tiền vào'
                                  : ev.type === 'debt'
                                  ? 'Nghĩa vụ trả'
                                  : 'Tích sản DCA'}
                              </span>
                              {ev.frequencyNote && (
                                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  {ev.frequencyNote}
                                </span>
                              )}
                              {ev.isConvertedMonthly && (
                                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Trích lập tháng
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-500 mt-0.5">
                              {ev.category}
                              {ev.note ? ` • "${ev.note}"` : ''}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`text-right text-xs sm:text-sm font-black ${
                            ev.type === 'income'
                              ? 'text-emerald-700'
                              : ev.amount === 0
                              ? 'text-purple-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {ev.amount === 0
                            ? 'Linh hoạt'
                            : `${ev.type === 'income' ? '+' : '-'}${formatVND(ev.amount, isPrivacyMode)}`}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              Đồng bộ dữ liệu trực tiếp từ Tab 1 (Tài sản thụ động), Tab 2 (Lương, nợ & chi phí) và Tab 3 (Mục tiêu DCA).
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer w-full sm:w-auto"
          >
            Đóng Lịch
          </button>
        </div>
      </div>
    </div>
  );
};
