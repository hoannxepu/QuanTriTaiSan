import React, { useState, useEffect, useRef } from 'react';
import { Debt, DatabaseState, DebtCategory, MonthlyIncomeRecord, IncomeItem, IncomeCategory } from '../types';
import { formatVND, formatNumberString, parseFormattedNumber, formatDateVN, calculateMaturityDate, calculateMaturityDateISO, getStandardTimeline, getActualTimelinePoints, isNoTermDebt, repairDebtPeriodicAmount } from '../utils/format';
import { createPointValuePlugin } from '../utils/chartPlugin';
import { Chart, registerables } from 'chart.js';
import { Scale, PlusCircle, Pen, Check, Trash2, Eye, ChevronDown, ChevronUp, AlertTriangle, Calendar, X, TrendingUp, Award, Info, ChevronRight, Zap, Sparkles, Plus, CalendarCheck, ArrowUpRight, ArrowDownRight, DollarSign, Wallet, Tag } from 'lucide-react';
import { getVietnamIncomeBenchmark } from '../utils/benchmarkUtils';
import { BenchmarkModal } from './BenchmarkModal';
import { ConfirmModal } from './ConfirmModal';

Chart.register(...registerables);

interface TabDebtsProps {
  db: DatabaseState;
  isPrivacyMode: boolean;
  onUpdateDebt: (debt: Debt) => void;
  onRemoveDebt: (id: number) => void;
  onUpdateIncome: (salary: number, other: number) => void;
  onUpdateMonthlyIncomes?: (records: MonthlyIncomeRecord[]) => void;
  onUpdateIncomeItems?: (items: IncomeItem[]) => void;
  onDeleteMonths?: (months: string[]) => void;
  onSwitchTab?: (tab: 'pyramid' | 'debts' | 'goals' | 'market') => void;
  onOpenDebtSimulator?: () => void;
  onOpenFinancialCalendar?: () => void;
}

const debtCategoryDescriptions: Record<DebtCategory, string> = {
  type1: 'Loại 1 (Nợ vay có lãi): Có gốc, có lãi suất ưu đãi/thả nổi, thời hạn dài (Vay mua nhà, đất, ô tô...).',
  type2: 'Loại 2 (Nợ trả góp có kỳ hạn): Có tổng nợ gốc, 0% lãi, trừ tiền đều đặn hằng tháng.',
  type_free: 'Loại 3 (Mượn nợ người thân / Vay tự do): Có gốc, 0% lãi, trả linh hoạt không áp lực.',
  type3: 'Loại 4 (Chi phí định kỳ không có gốc): Dòng tiền đi ra định kỳ dài hạn không nợ gốc (Bảo hiểm, thuê nhà...).',
  type4: 'Loại 5 (Chi tiêu sinh hoạt thường xuyên): Ngân sách tiêu dùng hằng tháng (Điện, nước, ăn uống...).',
};

const INCOME_CATEGORY_CONFIG: Record<IncomeCategory, { label: string; icon: string; bg: string; text: string; border: string }> = {
  salary: { label: 'Lương cố định', icon: '💼', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  bonus: { label: 'Thưởng & KPI', icon: '🎁', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  commission: { label: 'Hoa hồng / Làm thêm', icon: '⚡', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  business: { label: 'Kinh doanh / Bán lẻ', icon: '🏪', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  passive: { label: 'Thụ động / Đầu tư', icon: '📈', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  other: { label: 'Khác', icon: '💰', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

export const TabDebts: React.FC<TabDebtsProps> = ({
  db,
  isPrivacyMode,
  onUpdateDebt,
  onRemoveDebt,
  onUpdateIncome,
  onUpdateMonthlyIncomes,
  onUpdateIncomeItems,
  onDeleteMonths,
  onSwitchTab,
  onOpenDebtSimulator,
  onOpenFinancialCalendar,
}) => {
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showDebtTable, setShowDebtTable] = useState(false);
  const [showBreakdownTable, setShowBreakdownTable] = useState(false);
  const [showIncomeBenchmarkModal, setShowIncomeBenchmarkModal] = useState(false);
  const [showCashflowStandards, setShowCashflowStandards] = useState(false);
  const [cashflowRange, setCashflowRange] = useState<'month' | 'quarter' | 'halfyear' | 'year' | '3years' | '5years'>('month');
  const [debtToDelete, setDebtToDelete] = useState<{ id: number; name: string } | null>(null);

  // Income editing
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState(formatNumberString(db.salaryIncome));
  const [isEditingOther, setIsEditingOther] = useState(false);
  const [otherInput, setOtherInput] = useState(formatNumberString(db.otherIncome));

  // Monthly Income Log state (Nhập tiền thu về hàng tháng)
  const nowForInit = new Date();
  const padMonth = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const currentMonthKey = `${nowForInit.getFullYear()}-${padMonth(nowForInit.getMonth() + 1)}`;
  const [showMonthlyIncomeManager, setShowMonthlyIncomeManager] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [monthSalaryInput, setMonthSalaryInput] = useState<string>(() => {
    const existing = (db.monthlyIncomes || []).find((m) => m.month === currentMonthKey);
    return formatNumberString(existing ? existing.salary : db.salaryIncome);
  });
  const [monthOtherInput, setMonthOtherInput] = useState<string>(() => {
    const existing = (db.monthlyIncomes || []).find((m) => m.month === currentMonthKey);
    return formatNumberString(existing ? existing.other : db.otherIncome);
  });
  const [monthNoteInput, setMonthNoteInput] = useState<string>(() => {
    const existing = (db.monthlyIncomes || []).find((m) => m.month === currentMonthKey);
    return existing?.note || '';
  });
  const [editingMonthKey, setEditingMonthKey] = useState<string | null>(null);
  const [monthToDelete, setMonthToDelete] = useState<string | null>(null);

  // Itemized Inflows State ("Tiền về món nào, kê ngay món đó")
  const todayISO = new Date().toISOString().slice(0, 10);
  const [entryDate, setEntryDate] = useState<string>(todayISO);
  const [entryTitle, setEntryTitle] = useState<string>('');
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryCategory, setEntryCategory] = useState<IncomeCategory>('salary');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState<boolean>(false);
  const [entryNote, setEntryNote] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<IncomeItem | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(() => ({
    [currentMonthKey]: true,
  }));
  const [itemsPage, setItemsPage] = useState<number>(1);
  const [monthlyPage, setMonthlyPage] = useState<number>(1);
  const [incomeInputMode, setIncomeInputMode] = useState<'itemized' | 'monthly'>('itemized');
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>([]);
  const [monthsToDelete, setMonthsToDelete] = useState<string[] | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);
  const entryAmountInputRef = useRef<HTMLInputElement | null>(null);

  const handleConfirmDeleteMonths = () => {
    if (!monthsToDelete || monthsToDelete.length === 0) return;
    if (onDeleteMonths) {
      onDeleteMonths(monthsToDelete);
    } else {
      const keySet = new Set(monthsToDelete);
      if (onUpdateIncomeItems) {
        const remainingItems = (db.incomeItems || []).filter(
          (it) => !keySet.has(it.month) && !keySet.has(it.date?.slice(0, 7))
        );
        onUpdateIncomeItems(remainingItems);
      }
      if (onUpdateMonthlyIncomes) {
        const remainingMonthly = (db.monthlyIncomes || []).filter((m) => !keySet.has(m.month));
        onUpdateMonthlyIncomes(remainingMonthly);
      }
    }
    setSelectedMonthKeys((prev) => prev.filter((k) => !monthsToDelete.includes(k)));
    setMonthsToDelete(null);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  // Debt form states
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);
  const [debtCat, setDebtCat] = useState<DebtCategory>('type1');
  const [debtName, setDebtName] = useState('');
  const [debtFreq, setDebtFreq] = useState<Debt['frequency']>('monthly');
  const [debtDayStr, setDebtDayStr] = useState('20');
  const [debtStartDate, setDebtStartDate] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [debtIsNoTerm, setDebtIsNoTerm] = useState(false);

  const [debtAmountStr, setDebtAmountStr] = useState('');
  const [debtTermMonthsStr, setDebtTermMonthsStr] = useState('');
  const [installmentAmountStr, setInstallmentAmountStr] = useState('');
  const [periodicAmountStr, setPeriodicAmountStr] = useState('');
  const [promoMonthsStr, setPromoMonthsStr] = useState('');
  const [promoRateStr, setPromoRateStr] = useState('');
  const [normalRateStr, setNormalRateStr] = useState('');
  const [debtPromoEndDate, setDebtPromoEndDate] = useState('');

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const debtFormRef = useRef<HTMLFormElement | null>(null);
  const debtNameInputRef = useRef<HTMLInputElement | null>(null);

  // Sync income inputs when db updates
  useEffect(() => {
    if (!isEditingSalary) setSalaryInput(formatNumberString(db.salaryIncome));
  }, [db.salaryIncome, isEditingSalary]);

  useEffect(() => {
    if (!isEditingOther) setOtherInput(formatNumberString(db.otherIncome));
  }, [db.otherIncome, isEditingOther]);

  // Passive Income Calculation from Tab 1 Assets
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
  const incomeBenchmark = getVietnamIncomeBenchmark(totalMonthlyInflow);

  // Categorize debts & calculate monthly outflows & total outstanding debt
  const catStats = {
    type1: { label: 'Loại 1', name: 'Nợ vay có lãi (Ngân hàng, mua nhà...)', count: 0, monthly: 0, tag: 'bg-rose-50 text-rose-700 border-rose-200', outstanding: 0 },
    type2: { label: 'Loại 2', name: 'Nợ trả góp định kỳ (0% lãi)', count: 0, monthly: 0, tag: 'bg-amber-50 text-amber-700 border-amber-200', outstanding: 0 },
    type_free: { label: 'Loại 3', name: 'Mượn nợ người thân / Vay tự do (Linh hoạt)', count: 0, monthly: 0, tag: 'bg-purple-50 text-purple-700 border-purple-200', outstanding: 0 },
    type3: { label: 'Loại 4', name: 'Chi phí định kỳ không có gốc (Bảo hiểm, thuê nhà...)', count: 0, monthly: 0, tag: 'bg-blue-50 text-blue-700 border-blue-200', outstanding: 0 },
    type4: { label: 'Loại 5', name: 'Chi phí sinh hoạt thường xuyên', count: 0, monthly: 0, tag: 'bg-slate-100 text-slate-600 border-slate-200', outstanding: 0 },
  };

  let totalMonthlyOutflow = 0;
  let totalPrincipalMonthly = 0;
  let totalInterestMonthly = 0;
  let totalPeriodicMonthly = 0;
  let totalLivingMonthly = 0;
  let totalOutstandingDebt = 0;
  let activeDebtCount = 0;

  db.debts.forEach((rawD) => {
    const d = repairDebtPeriodicAmount(rawD);
    if (d.status !== 'Đã tất toán') {
      const remaining = Math.max(0, (d.amount || 0) - (d.paidPrincipal || 0));
      if (d.category === 'type1' || d.category === 'type2' || d.category === 'type_free') {
        totalOutstandingDebt += remaining;
        activeDebtCount += 1;
        if (catStats[d.category]) {
          catStats[d.category].outstanding += remaining;
        }
      }

      if (isNoTermDebt(d)) {
        if (d.category === 'type_free') {
          catStats.type_free.count += 1;
        } else if (catStats[d.category]) {
          catStats[d.category].count += 1;
        }
      } else {
        let m = d.monthlyBefore || d.installmentAmount || d.periodicAmount || 0;
        if (d.frequency === 'annual') m = Math.round(m / 12);
        else if (d.frequency === 'biannual') m = Math.round(m / 6);
        else if (d.frequency === 'quarterly') m = Math.round(m / 3);

        if (catStats[d.category]) {
          catStats[d.category].count += 1;
          catStats[d.category].monthly += m;
        }
        totalMonthlyOutflow += m;

        if (d.category === 'type1') {
          const principal = d.termMonths ? Math.round(d.amount / d.termMonths) : 0;
          totalPrincipalMonthly += principal;
          totalInterestMonthly += Math.max(0, m - principal);
        } else if (d.category === 'type2') {
          totalPrincipalMonthly += m;
        } else if (d.category === 'type3') {
          totalPeriodicMonthly += m;
        } else if (d.category === 'type4') {
          totalLivingMonthly += m;
        }
      }
    }
  });

  const totalQuarterlyOutflow = totalMonthlyOutflow * 3;
  const totalAnnualOutflow = totalMonthlyOutflow * 12;
  const netMonthlyCashflow = totalMonthlyInflow - totalMonthlyOutflow;
  const burdenRatio = totalMonthlyInflow > 0 ? Math.round((totalMonthlyOutflow / totalMonthlyInflow) * 100) : 0;

  // Render Cashflow Chart - chỉ hiển thị các tháng thực tế có dữ liệu từ tháng bắt đầu
  useEffect(() => {
    if (!chartCanvasRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const points = getActualTimelinePoints(
      db,
      {
        netWorth: 0,
        totalAssets: 0,
        totalDebts: 0,
        inflow: totalMonthlyInflow,
        outflow: totalMonthlyOutflow,
        netCashFlow: netMonthlyCashflow,
        debtProgressPercent: 0,
        dcaProgressPercent: 0,
        runwayPercent: 0,
        milestoneProgressPercent: 0,
      },
      cashflowRange
    );

    const labels = points.map((p) => p.label);
    const inflowData = points.map((p) => p.inflow);
    const outflowData = points.map((p) => p.outflow);
    const netData = points.map((p) => p.netCashFlow);

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Tổng Thu Nhập',
            data: inflowData,
            borderColor: '#059669',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#059669',
            pointBorderWidth: 2,
          },
          {
            label: 'Tổng Nghĩa Vụ Chi Trả',
            data: outflowData,
            borderColor: '#e11d48',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#e11d48',
            pointBorderWidth: 2,
          },
          {
            label: 'Dòng Tiền Ròng',
            data: netData,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#2563eb',
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
            bottom: 20,
            left: 14,
            right: 14,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.dataset.label}: ${formatVND(Number(item.raw), isPrivacyMode)}`,
            },
          },
        },
        scales: {
          y: {
            ticks: {
              callback: (val) =>
                isPrivacyMode
                  ? '***'
                  : (Number(val) / 1e6).toFixed(1) + ' Tr',
            },
          },
        },
      },
      plugins: [createPointValuePlugin({ isPrivacyMode, valueType: 'currency' })],
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [db, cashflowRange, isPrivacyMode, totalMonthlyInflow, totalMonthlyOutflow, netMonthlyCashflow]);

  const handleSaveIncome = (type: 'salary' | 'other') => {
    if (type === 'salary') {
      const val = parseFormattedNumber(salaryInput);
      onUpdateIncome(val, db.otherIncome);
      setIsEditingSalary(false);
    } else {
      const val = parseFormattedNumber(otherInput);
      onUpdateIncome(db.salaryIncome, val);
      setIsEditingOther(false);
    }
  };

  const handleSelectMonth = (mStr: string) => {
    setSelectedMonth(mStr);
    const existing = (db.monthlyIncomes || []).find((m) => m.month === mStr);
    if (existing) {
      setMonthSalaryInput(formatNumberString(existing.salary));
      setMonthOtherInput(formatNumberString(existing.other));
      setMonthNoteInput(existing.note || '');
      setEditingMonthKey(existing.month);
    } else {
      setMonthSalaryInput(formatNumberString(db.salaryIncome));
      setMonthOtherInput(formatNumberString(db.otherIncome));
      setMonthNoteInput('');
      setEditingMonthKey(null);
    }
  };

  const handleSaveMonthlyRecord = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const salary = parseFormattedNumber(monthSalaryInput);
    const other = parseFormattedNumber(monthOtherInput);
    const now = Date.now();
    const currentList = [...(db.monthlyIncomes || [])];
    const idx = currentList.findIndex((m) => m.month === selectedMonth);

    const record: MonthlyIncomeRecord = {
      id: idx >= 0 ? currentList[idx].id || `inc-${now}` : `inc-${now}`,
      month: selectedMonth,
      salary,
      other,
      passive: totalPassiveInflow,
      note: monthNoteInput.trim(),
      updatedAt: now,
    };

    let updatedList: MonthlyIncomeRecord[];
    if (idx >= 0) {
      updatedList = [...currentList];
      updatedList[idx] = record;
    } else {
      updatedList = [...currentList, record];
    }

    updatedList.sort((a, b) => a.month.localeCompare(b.month));

    if (onUpdateMonthlyIncomes) {
      onUpdateMonthlyIncomes(updatedList);
    }

    const currYear = new Date().getFullYear();
    const currMonth = new Date().getMonth() + 1;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const currMonthKey = `${currYear}-${pad(currMonth)}`;
    if (selectedMonth === currMonthKey) {
      onUpdateIncome(salary, other);
    }

    setEditingMonthKey(null);
  };

  const handleDeleteMonthlyRecord = (monthKey: string) => {
    const updatedList = (db.monthlyIncomes || []).filter((m) => m.month !== monthKey);
    if (onUpdateMonthlyIncomes) {
      onUpdateMonthlyIncomes(updatedList);
    }
    if (editingMonthKey === monthKey) {
      setEditingMonthKey(null);
    }
    setMonthToDelete(null);
  };

  const handleSaveIncomeItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amount = parseFormattedNumber(entryAmount);
    if (!entryTitle.trim() || amount <= 0) return;
    const now = Date.now();
    const targetMonth = entryDate ? entryDate.slice(0, 7) : currentMonthKey;

    const currentItems = [...(db.incomeItems || [])];
    let updatedItems: IncomeItem[];

    if (editingItemId) {
      const idx = currentItems.findIndex((it) => it.id === editingItemId);
      if (idx >= 0) {
        updatedItems = [...currentItems];
        updatedItems[idx] = {
          ...updatedItems[idx],
          date: entryDate,
          month: targetMonth,
          title: entryTitle.trim(),
          amount,
          category: entryCategory,
          note: entryNote.trim(),
        };
      } else {
        updatedItems = [
          ...currentItems,
          {
            id: `item-${now}`,
            date: entryDate,
            month: targetMonth,
            title: entryTitle.trim(),
            amount,
            category: entryCategory,
            note: entryNote.trim(),
            createdAt: now,
          },
        ];
      }
    } else {
      updatedItems = [
        ...currentItems,
        {
          id: `item-${now}`,
          date: entryDate,
          month: targetMonth,
          title: entryTitle.trim(),
          amount,
          category: entryCategory,
          note: entryNote.trim(),
          createdAt: now,
        },
      ];
    }

    updatedItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (onUpdateIncomeItems) {
      onUpdateIncomeItems(updatedItems);
    }

    // Reset entry inputs
    setEntryTitle('');
    setEntryAmount('');
    setEntryNote('');
    setEditingItemId(null);
    setExpandedMonths((prev) => ({ ...prev, [targetMonth]: true }));
  };

  const handleEditIncomeItem = (item: IncomeItem) => {
    setEditingItemId(item.id);
    setEntryDate(item.date || todayISO);
    setEntryTitle(item.title);
    setEntryAmount(formatNumberString(item.amount));
    setEntryCategory(item.category);
    setEntryNote(item.note || '');
    setIncomeInputMode('itemized');
    document.getElementById('monthly-incomes-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteIncomeItem = (id: string) => {
    const updated = (db.incomeItems || []).filter((it) => it.id !== id);
    if (onUpdateIncomeItems) {
      onUpdateIncomeItems(updated);
    }
    if (editingItemId === id) {
      setEditingItemId(null);
      setEntryTitle('');
      setEntryAmount('');
      setEntryNote('');
    }
    setItemToDelete(null);
  };

  const handleEditDebt = (rawD: Debt) => {
    const d = repairDebtPeriodicAmount(rawD);
    const noTerm = isNoTermDebt(d);
    setDebtIsNoTerm(noTerm);
    setEditingDebtId(d.id);
    setDebtCat(d.category);
    setDebtName(d.name);
    setDebtFreq(noTerm ? 'flexible' : d.frequency);
    setDebtDayStr(d.day !== undefined && d.day !== null ? String(d.day) : '20');
    setDebtStartDate(d.startDate || '');
    setDebtNote(d.note || '');

    setDebtAmountStr(d.amount ? formatNumberString(d.amount) : '');
    setDebtTermMonthsStr(noTerm ? '' : (d.termMonths ? String(d.termMonths) : ''));
    setInstallmentAmountStr(d.installmentAmount && d.installmentAmount > 0 ? formatNumberString(d.installmentAmount) : '');
    setPeriodicAmountStr(d.periodicAmount && d.periodicAmount > 0 ? formatNumberString(d.periodicAmount) : (d.monthlyBefore && d.monthlyBefore > 0 ? formatNumberString(d.monthlyBefore) : ''));
    setPromoMonthsStr(d.promoMonths ? String(d.promoMonths) : '');
    setPromoRateStr(d.promoRate ? String(d.promoRate) : '');
    setNormalRateStr(d.normalRate ? String(d.normalRate) : '');
    setDebtPromoEndDate(d.promoEndDate || (d.startDate && d.promoMonths ? calculateMaturityDateISO(d.startDate, d.promoMonths) : ''));

    setShowDebtForm(true);
    setTimeout(() => {
      debtNameInputRef.current?.focus();
    }, 80);
  };

  const handleCancelDebtForm = () => {
    setEditingDebtId(null);
    setDebtCat('type1');
    setDebtName('');
    setDebtFreq('monthly');
    setDebtDayStr('20');
    setDebtStartDate('');
    setDebtNote('');
    setDebtIsNoTerm(false);
    setDebtAmountStr('');
    setDebtTermMonthsStr('');
    setInstallmentAmountStr('');
    setPeriodicAmountStr('');
    setPromoMonthsStr('');
    setPromoRateStr('');
    setNormalRateStr('');
    setDebtPromoEndDate('');
    setShowDebtForm(false);
  };

  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName.trim()) {
      alert('Vui lòng nhập tên nghĩa vụ tài chính!');
      return;
    }

    const isActuallyNoTerm = debtIsNoTerm || debtCat === 'type_free' || debtFreq === 'flexible';

    let amount = 0;
    let termMonths = 0;
    let installmentAmount = 0;
    let periodicAmount = 0;
    let promoMonths = 0;
    let promoRate = 0;
    let normalRate = 0;
    let computedMonthlyBefore = 0;
    let computedMonthlyAfter = 0;

    if (isActuallyNoTerm) {
      amount = parseFormattedNumber(debtAmountStr);
      computedMonthlyBefore = 0;
      computedMonthlyAfter = 0;
    } else if (debtCat === 'type1') {
      amount = parseFormattedNumber(debtAmountStr);
      termMonths = Number(debtTermMonthsStr) || 0;
      promoMonths = Number(promoMonthsStr) || 0;
      promoRate = Number(promoRateStr) || 0;
      normalRate = Number(normalRateStr) || 0;

      if (amount > 0 && termMonths > 0) {
        const principalPart = Math.round(amount / termMonths);
        const interestBefore = Math.round((amount * (promoRate / 100)) / 12);
        const principalAtPromoEnd = Math.max(0, amount - principalPart * promoMonths);
        const interestAfter = Math.round((principalAtPromoEnd * (normalRate / 100)) / 12);
        computedMonthlyBefore = principalPart + interestBefore;
        computedMonthlyAfter = principalPart + interestAfter;
      }
    } else if (debtCat === 'type2') {
      amount = parseFormattedNumber(debtAmountStr);
      termMonths = Number(debtTermMonthsStr) || 0;
      installmentAmount = parseFormattedNumber(installmentAmountStr);
      computedMonthlyBefore =
        installmentAmount > 0
          ? installmentAmount
          : termMonths > 0
          ? Math.round(amount / termMonths)
          : 0;
      computedMonthlyAfter = computedMonthlyBefore;
    } else if (debtCat === 'type_free') {
      amount = parseFormattedNumber(debtAmountStr);
      computedMonthlyBefore = 0;
      computedMonthlyAfter = 0;
    } else if (debtCat === 'type3' || debtCat === 'type4') {
      periodicAmount = parseFormattedNumber(periodicAmountStr);
      computedMonthlyBefore = periodicAmount;
      computedMonthlyAfter = periodicAmount;
      amount = periodicAmount;
    }

    if (amount <= 0 && computedMonthlyBefore <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ!');
      return;
    }

    const existingDebt = editingDebtId ? db.debts.find((d) => d.id === editingDebtId) : null;
    const parsedDay = debtDayStr.trim() === '' ? 20 : Math.min(31, Math.max(1, parseInt(debtDayStr, 10) || 20));

    const newDebt: Debt = {
      id: editingDebtId || Date.now(),
      category: debtCat,
      name: debtName.trim(),
      frequency: isActuallyNoTerm ? 'flexible' : debtFreq,
      startDate: debtCat !== 'type4' ? debtStartDate : undefined,
      day: isActuallyNoTerm ? undefined : parsedDay,
      amount,
      termMonths: isActuallyNoTerm ? undefined : (termMonths || undefined),
      installmentAmount: isActuallyNoTerm ? undefined : (installmentAmount || undefined),
      periodicAmount: isActuallyNoTerm ? undefined : (periodicAmount || undefined),
      promoMonths: isActuallyNoTerm ? undefined : (promoMonths || undefined),
      promoEndDate: (!isActuallyNoTerm && debtCat === 'type1' && debtStartDate && promoMonths ? calculateMaturityDateISO(debtStartDate, promoMonths) : debtPromoEndDate) || undefined,
      promoRate: promoRate || undefined,
      normalRate: normalRate || undefined,
      monthlyBefore: computedMonthlyBefore,
      monthlyAfter: computedMonthlyAfter,
      paidPrincipal: existingDebt?.paidPrincipal || 0,
      note: debtNote.trim() || undefined,
      status: existingDebt?.status || 'Chưa tất toán',
      settledDate: existingDebt?.settledDate || undefined,
      isNoTerm: isActuallyNoTerm ? true : undefined,
    };

    onUpdateDebt(newDebt);
    handleCancelDebtForm();
  };

  const handlePayPeriod = (d: Debt) => {
    let principalPart = 0;
    if (d.category === 'type1' && d.termMonths) {
      principalPart = Math.round(d.amount / d.termMonths);
    } else if (d.category === 'type2') {
      principalPart = d.installmentAmount || (d.termMonths ? Math.round(d.amount / d.termMonths) : 0);
    }

    if (principalPart > 0) {
      const newPaid = Math.min(d.amount, (d.paidPrincipal || 0) + principalPart);
      const isSettled = newPaid >= d.amount;
      onUpdateDebt({
        ...d,
        paidPrincipal: newPaid,
        status: isSettled ? 'Đã tất toán' : 'Chưa tất toán',
        settledDate: isSettled ? new Date().toLocaleDateString('vi-VN') : undefined,
      });
    }
  };

  const handlePayCustom = (d: Debt) => {
    const currentRemain = Math.max(0, d.amount - (d.paidPrincipal || 0));
    const input = prompt(
      `Nhập số tiền muốn trả cho khoản "${d.name}"\n(Dư nợ hiện tại: ${formatVND(currentRemain)}):`,
      ''
    );
    if (!input) return;
    const paidVal = parseFormattedNumber(input);
    if (isNaN(paidVal) || paidVal <= 0) {
      alert('Số tiền nhập không hợp lệ!');
      return;
    }

    const newPaid = Math.min(d.amount, (d.paidPrincipal || 0) + paidVal);
    const isSettled = newPaid >= d.amount;
    onUpdateDebt({
      ...d,
      paidPrincipal: newPaid,
      status: isSettled ? 'Đã tất toán' : 'Chưa tất toán',
      settledDate: isSettled ? new Date().toLocaleDateString('vi-VN') : undefined,
    });
  };

  const handleToggleSettled = (d: Debt) => {
    if (d.status === 'Đã tất toán') {
      onUpdateDebt({
        ...d,
        status: 'Chưa tất toán',
        paidPrincipal: 0,
        settledDate: undefined,
      });
    } else {
      onUpdateDebt({
        ...d,
        status: 'Đã tất toán',
        paidPrincipal: d.amount,
        settledDate: new Date().toLocaleDateString('vi-VN'),
      });
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* 1. DEDICATED MOBILE VIEW (< md) - COMPACT CASHFLOW DASHBOARD */}
      <div className="md:hidden bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        {/* Row 1: Dòng Tiền Ròng (Net Cash Flow) Banner */}
        <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/80 rounded-lg px-2.5 py-1.5">
          <div className="min-w-0 flex-1 mr-2">
            <span className="text-[9.5px] font-bold text-blue-800 uppercase tracking-wide block truncate">
              Dòng Tiền Ròng (Net Cashflow)
            </span>
            <span className="text-base font-black text-blue-700 tracking-tight block truncate">
              {isPrivacyMode ? '•••••• ₫' : netMonthlyCashflow >= 0 ? `+${formatVND(netMonthlyCashflow)}` : formatVND(netMonthlyCashflow)}
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
              netMonthlyCashflow >= 0
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            {netMonthlyCashflow >= 0 ? '✓ Thặng dư' : '⚠️ Thâm hụt'}
          </span>
        </div>

        {/* Row 2: 2 Mini Columns side-by-side (Tổng Thu vs Nghĩa Vụ Chi) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Cột 1: Thu Nhập */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 p-2 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wide truncate">
                  Tổng Thu
                </span>
                <button
                  type="button"
                  onClick={() => setShowIncomeBenchmarkModal(true)}
                  className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded border ${incomeBenchmark.currentTier.badgeBg} flex items-center gap-0.5 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0`}
                  title="Xem mốc thu nhập"
                >
                  <TrendingUp className="w-2.5 h-2.5 shrink-0 text-emerald-700" />
                  <span className="whitespace-nowrap">{incomeBenchmark.currentTier.topPercent}</span>
                </button>
              </div>
              <div className="text-xs font-black text-emerald-700 mt-0.5 truncate">
                {isPrivacyMode ? '•••••• ₫' : `+${formatVND(totalMonthlyInflow)}`}
              </div>
            </div>

            <div className="mt-1.5 pt-1 border-t border-emerald-200/60 text-[9px] space-y-0.5 text-emerald-950">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Lương:</span>
                <div className="flex items-center space-x-0.5">
                  <span className="font-bold text-emerald-800 truncate">
                    {isPrivacyMode ? '••••••' : formatVND(db.salaryIncome)}
                  </span>
                  <button
                    onClick={() => setIsEditingSalary(true)}
                    className="p-0.5 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    title="Sửa lương"
                  >
                    <Pen className="w-2 h-2" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Thụ động:</span>
                <span className="font-bold text-emerald-800 truncate">{formatVND(totalPassiveInflow, isPrivacyMode)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  document.getElementById('monthly-incomes-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full mt-1 pt-1 border-t border-emerald-200/50 text-[8.5px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center justify-center gap-0.5 cursor-pointer"
              >
                <CalendarCheck className="w-2.5 h-2.5 text-emerald-600" />
                <span>Nhập theo tháng ({(db.monthlyIncomes || []).length})</span>
              </button>
            </div>
          </div>

          {/* Cột 2: Nghĩa Vụ Chi Trả */}
          <div className="bg-rose-50/70 border border-rose-200/80 p-2 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-bold text-rose-800 uppercase tracking-wide truncate">
                  Nghĩa Vụ Chi
                </span>
                <span
                  className={`px-1 py-0.2 rounded text-[8.5px] font-bold border shrink-0 ${
                    burdenRatio <= 35
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : burdenRatio <= 65
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  DTI: {isPrivacyMode ? '••%' : `${burdenRatio}%`}
                </span>
              </div>
              <div className="text-xs font-black text-rose-700 mt-0.5 truncate">
                {isPrivacyMode ? '•••••• ₫' : `-${formatVND(totalMonthlyOutflow)}`}
              </div>
            </div>

            <div className="mt-1.5 pt-1 border-t border-rose-200/60 text-[9px] space-y-0.5 text-rose-950">
              <div className="flex items-center justify-between bg-white/90 border border-rose-200/90 px-1.5 py-0.5 rounded font-bold text-rose-900 shadow-2xs">
                <span className="truncate text-[8.5px]">Tổng dư nợ:</span>
                <span className="truncate text-[8.5px] font-black text-rose-700">{formatVND(totalOutstandingDebt, isPrivacyMode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 truncate">Gốc + lãi:</span>
                <span className="font-bold text-rose-700 truncate">{formatVND(totalPrincipalMonthly + totalInterestMonthly, isPrivacyMode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 truncate">Sinh hoạt:</span>
                <span className="font-bold text-rose-700 truncate">{formatVND(totalLivingMonthly + totalPeriodicMonthly, isPrivacyMode)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chú thích khoa học nút nhỏ */}
        <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[10px]">
          <span className="text-slate-500 text-[9.5px]">Quản trị đòn bẩy DTI ≤ 35%</span>
          <button
            type="button"
            onClick={() => setShowCashflowStandards(!showCashflowStandards)}
            className="text-[9.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer bg-blue-50 px-2 py-0.5 rounded transition shrink-0"
          >
            <span>{showCashflowStandards ? 'Ẩn Chú Thích' : 'Xem Chuẩn Mực'}</span>
            {showCashflowStandards ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
        </div>

        {showCashflowStandards && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] space-y-2">
            <div className="font-bold text-slate-800 text-[10px]">
              Chuẩn Mực Dòng Tiền:
            </div>
            <p className="text-slate-600 leading-relaxed">
              • <strong>DTI (≤35%):</strong> Dưới 35% là an toàn cao, 35-50% áp lực, trên 50% nguy hiểm.<br/>
              • <strong>Thặng dư ròng:</strong> Số tiền dư ra sau khi trả hết nợ và sinh hoạt để đầu tư tích sản.
            </p>
          </div>
        )}
      </div>

      {/* 2. DEDICATED DESKTOP VIEW (>= md) - PRESERVED 100% AS ORIGINAL */}
      <div className="hidden md:block bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center">
              <Scale className="w-4 h-4 text-slate-800 mr-2 shrink-0" />
              <span>Báo Cáo Lưu Chuyển Dòng Tiền Dự Báo</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Đối chiếu trực tiếp nguồn thu nhập tổng hợp với tổng nghĩa vụ chi trả định kỳ
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCashflowStandards(!showCashflowStandards)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition shrink-0"
          >
            <span>{showCashflowStandards ? 'Ẩn Chú Thích' : 'Mở Chú Thích & Chuẩn Mực'}</span>
            {showCashflowStandards ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Scientific Cashflow Standards Guide */}
        {showCashflowStandards && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <i className="fa-solid fa-graduation-cap text-blue-600"></i>
              <span>Thước Đo Khoa Học Dòng Tiền & Quản Trị Đòn Bẩy (Cashflow & Leverage Metrics)</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-[11px] leading-relaxed">
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-emerald-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Tỷ Lệ Tải Trọng DTI (≤35%)</span>
                </div>
                <p className="text-slate-600">
                  DTI = (Tổng nghĩa vụ chi trả / Tổng thu nhập). Dưới 35% là vùng an toàn cao chuẩn ngân hàng quốc tế; 35%–50% cần kiểm soát chi tiêu; trên 50% là vùng áp lực nguy hiểm, dễ vỡ nợ nếu mất việc hoặc biến cố.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-blue-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>Dòng Tiền Ròng Thặng Dư (Net Cashflow)</span>
                </div>
                <p className="text-slate-600">
                  Phần tiền dư ra hàng tháng sau khi đã trừ hết toàn bộ tiền gốc + lãi vay, chi phí định kỳ và sinh hoạt phí. Đây là nguồn lực cốt lõi để đầu tư DCA tích sản hoặc dự phòng khẩn cấp.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                <div className="font-bold text-rose-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>5 Phân Nhóm Nghĩa Vụ Tài Chính</span>
                </div>
                <p className="text-slate-600">
                  Bao gồm: Loại 1 (Vay có lãi định kỳ), Loại 2 (Trả góp tiêu dùng), Loại 3 (Vay tự do người thân), Loại 4 (Chi phí dài hạn định kỳ như học phí, bảo hiểm), Loại 5 (Sinh hoạt phí duy trì cuộc sống).
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 lg:gap-4">
          {/* Ô 1: Tổng Thu Nhập */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 rounded-xl flex flex-col justify-between relative min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                  Tổng Thu Nhập
                </span>
                {/* Vị thế thu nhập */}
                <button
                  type="button"
                  onClick={() => setShowIncomeBenchmarkModal(true)}
                  className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border ${incomeBenchmark.currentTier.badgeBg} flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0`}
                  title="Xem bảng mốc phân tầng thu nhập tại Việt Nam"
                >
                  <TrendingUp className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                  <span className="whitespace-nowrap">{incomeBenchmark.currentTier.topPercent} VN</span>
                </button>
              </div>

              <div className="text-xl lg:text-2xl font-black text-emerald-700 mt-1.5 leading-tight">
                {isPrivacyMode ? '•••••• ₫' : `+${formatVND(totalMonthlyInflow)}`}
              </div>
            </div>

            <div className="mt-2 pt-1.5 text-[11px] text-emerald-900 border-t border-emerald-200/60 font-medium">
              {isPrivacyMode ? 'So với VN: ••••••' : incomeBenchmark.ratioText}
            </div>

            <div className="mt-2 pt-2 border-t border-emerald-200/60 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-emerald-900">
                <span className="text-slate-600 font-medium text-[11px]">Lương thưởng:</span>
                <div className="flex items-center space-x-1">
                  {isEditingSalary ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={salaryInput}
                        onChange={(e) => setSalaryInput(formatNumberString(e.target.value, false))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveIncome('salary')}
                        className="w-24 bg-white border border-emerald-400 rounded px-1 py-0.5 text-[11px] font-bold text-emerald-800 text-right outline-none shadow-2xs"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveIncome('salary')}
                        className="w-5 h-5 rounded flex items-center justify-center bg-emerald-600 text-white cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-emerald-800 text-[11px]">
                        {isPrivacyMode ? '••••••' : formatVND(db.salaryIncome)}
                      </span>
                      <button
                        onClick={() => setIsEditingSalary(true)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition cursor-pointer"
                      >
                        <Pen className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-emerald-900">
                <span className="text-slate-600 font-medium text-[11px]">Thu nhập khác:</span>
                <div className="flex items-center space-x-1">
                  {isEditingOther ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={otherInput}
                        onChange={(e) => setOtherInput(formatNumberString(e.target.value, false))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveIncome('other')}
                        className="w-24 bg-white border border-emerald-400 rounded px-1 py-0.5 text-[11px] font-bold text-emerald-800 text-right outline-none shadow-2xs"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveIncome('other')}
                        className="w-5 h-5 rounded flex items-center justify-center bg-emerald-600 text-white cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-emerald-800 text-[11px]">
                        {isPrivacyMode ? '••••••' : formatVND(db.otherIncome)}
                      </span>
                      <button
                        onClick={() => setIsEditingOther(true)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition cursor-pointer"
                      >
                        <Pen className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-emerald-800/90 text-[10px] pt-0.5 border-t border-emerald-100">
                <span className="font-medium text-slate-500">Thụ động T1:</span>
                <span className="font-bold text-emerald-700">{formatVND(totalPassiveInflow, isPrivacyMode)}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  document.getElementById('monthly-incomes-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full mt-2 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-98 cursor-pointer"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Sổ nhập thu theo tháng ({(db.monthlyIncomes || []).length} mốc)</span>
                <ChevronDown className="w-3 h-3 ml-auto opacity-75" />
              </button>
            </div>
          </div>

          {/* Ô 2: Tổng Nghĩa Vụ Chi Trả */}
          <div className="bg-rose-50/70 border border-rose-200/80 p-4 rounded-xl flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">
                  Nghĩa Vụ Chi Trả
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border shrink-0 ${
                    burdenRatio <= 35
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : burdenRatio <= 65
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  DTI: {isPrivacyMode ? '••%' : `${burdenRatio}%`}
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-rose-700 mt-1.5 leading-tight">
                {isPrivacyMode ? '•••••• ₫' : `-${formatVND(totalMonthlyOutflow)}`}
              </div>
            </div>

            {/* Thống kê Tổng Dư Nợ */}
            <div className="mt-2.5 py-1.5 px-3 bg-white/85 border border-rose-200/90 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-rose-950">Tổng Dư Nợ:</span>
                <span className="text-[10px] font-medium text-slate-500">({activeDebtCount} khoản)</span>
              </div>
              <span className="text-xs lg:text-[13px] font-black text-rose-700 tracking-tight">
                {formatVND(totalOutstandingDebt, isPrivacyMode)}
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-rose-200/60 text-[11px] space-y-1 text-rose-900">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Gốc & góp:</span>
                <span className="font-bold text-rose-700">{formatVND(totalPrincipalMonthly, isPrivacyMode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Lãi dự tính:</span>
                <span className="font-bold text-rose-700">{formatVND(totalInterestMonthly, isPrivacyMode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Định kỳ & sinh hoạt:</span>
                <span className="font-bold text-rose-700">{formatVND(totalPeriodicMonthly + totalLivingMonthly, isPrivacyMode)}</span>
              </div>
              <div className="pt-0.5 border-t border-rose-200/50 text-[10px] text-rose-800 font-semibold flex justify-between">
                <span>Năm:</span>
                <span>{formatVND(totalAnnualOutflow, isPrivacyMode)}</span>
              </div>
            </div>
          </div>

          {/* Ô 3: Dòng Tiền Ròng */}
          <div className="bg-blue-50/70 border border-blue-200/80 p-4 rounded-xl flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">
                  Dòng Tiền Ròng (Net Cash Flow)
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                    netMonthlyCashflow >= 0
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  {netMonthlyCashflow >= 0 ? '✓ Thặng dư ròng' : '⚠️ Thâm hụt'}
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-blue-700 mt-1.5 leading-tight">
                {isPrivacyMode ? '•••••• ₫' : netMonthlyCashflow >= 0 ? `+${formatVND(netMonthlyCashflow)}` : formatVND(netMonthlyCashflow)}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-blue-200/60 text-[11px] text-blue-800/80 font-medium">
              {netMonthlyCashflow >= 0
                ? 'Khả năng tích lũy thanh khoản tốt cho mục tiêu'
                : 'Cảnh báo dòng tiền âm, cần cắt giảm chi tiêu'}
            </div>
          </div>
        </div>

        {/* Quick Link sang Tab 4: Thị Trường & Vĩ Mô (Lãi Suất Vay Ngân Hàng & DSTI) */}
        {onSwitchTab && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span>Đối chiếu lãi suất vay mua nhà, gói vay BĐS và chu kỳ lãi suất điều hành.</span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('market')}
              className="px-3 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-slate-800 border border-blue-300/80 rounded-lg text-xs font-bold transition flex items-center justify-between sm:justify-start gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <div className="flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Xem Lãi Suất Vay Ngân Hàng & Chu Kỳ Vĩ Mô (Tab 4)</span>
              </div>
              <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-black">
                Tab 4 ➔
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* KHU VỰC NHẬP TIỀN THU VỀ THỰC TẾ HÀNG THÁNG & ĐỐI CHIẾU DÒNG TIỀN */}
      {/* ========================================================= */}
      <div id="monthly-incomes-section" className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-emerald-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
              <span>Sổ Nhật Ký Tiền Thu Về Thực Tế Hàng Tháng</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {(db.monthlyIncomes || []).length} mốc đã ghi nhận
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Nhập thực nhận từng tháng (Lương, thưởng, hoa hồng, kinh doanh) • Chi phí tính trung bình theo nghĩa vụ • Dòng tiền Ròng = Thu - Chi
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowMonthlyIncomeManager(!showMonthlyIncomeManager)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center space-x-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition shrink-0 self-start sm:self-auto"
          >
            <span>{showMonthlyIncomeManager ? 'Thu Gọn Sổ' : 'Mở Sổ Nhập Thu'}</span>
            {showMonthlyIncomeManager ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showMonthlyIncomeManager && (
          <div className="space-y-4">
            {/* Chuyển đổi phương thức nhập */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <button
                type="button"
                onClick={() => setIncomeInputMode('itemized')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  incomeInputMode === 'itemized'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Kê Khai Từng Món Tiền Về (Ưu Tiên)</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${incomeInputMode === 'itemized' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {(db.incomeItems || []).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIncomeInputMode('monthly')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  incomeInputMode === 'monthly'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Nhập Tổng Cục Cả Tháng</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${incomeInputMode === 'monthly' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {(db.monthlyIncomes || []).length}
                </span>
              </button>
            </div>

            {/* CHẾ ĐỘ 1: KÊ KHAI TỪNG MÓN TIỀN VỀ */}
            {incomeInputMode === 'itemized' && (
              <div className="space-y-4">
                {/* Form kê nhanh từng món - Chuẩn 1 hàng ngang: Tên nguồn (kick chọn phân loại) -> Số tiền -> Ghi chú -> Nút kê */}
                <form onSubmit={handleSaveIncomeItem} className="bg-emerald-50/50 border border-emerald-200/90 rounded-xl p-3 sm:p-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{editingItemId ? 'Chỉnh sửa khoản thu đã kê:' : 'Tiền về món nào – Kê ngay món đó:'}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-600">Ngày nhận:</span>
                        <input
                          type="date"
                          value={entryDate}
                          onChange={(e) => setEntryDate(e.target.value)}
                          required
                          className="text-[11px] font-extrabold text-emerald-800 outline-none bg-transparent cursor-pointer"
                          title="Chọn ngày nhận tiền"
                        />
                      </div>
                      {editingItemId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(null);
                            setEntryTitle('');
                            setEntryAmount('');
                            setEntryNote('');
                            setShowCategoryDropdown(false);
                          }}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-white border border-rose-200 rounded-lg px-2 py-0.5 cursor-pointer"
                        >
                          Hủy sửa
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1 HÀNG DUY NHẤT: Tên nguồn (kick chọn phân loại) -> Số tiền thực nhận -> Ghi chú -> Nút Kê Khoản Này */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                    {/* 1. Tên nguồn / Phân loại (4 cols) - Kích vào ô là hiện menu phân loại để chọn */}
                    <div className="md:col-span-4 relative" ref={categoryDropdownRef}>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Tên nguồn / Phân loại:</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          (Kích chọn loại ▾)
                        </span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-sm z-10 cursor-pointer"
                          title="Kích để chọn phân loại"
                        >
                          {INCOME_CATEGORY_CONFIG[entryCategory]?.icon || '🏷️'}
                        </button>

                        <input
                          type="text"
                          value={entryTitle}
                          onChange={(e) => setEntryTitle(e.target.value)}
                          onClick={() => setShowCategoryDropdown(true)}
                          onFocus={() => setShowCategoryDropdown(true)}
                          placeholder="Kích chọn loại hoặc tự gõ tên..."
                          required
                          className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 shadow-2xs cursor-pointer"
                        />

                        <button
                          type="button"
                          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180 text-emerald-600' : ''}`} />
                        </button>

                        {/* Menu Popup Phân Loại Hiện Ra Khi Kích Vào Ô */}
                        {showCategoryDropdown && (
                          <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 animate-fadeIn space-y-1.5">
                            <div className="text-[10.5px] font-bold text-slate-500 px-2 py-0.5 border-b border-slate-100 flex items-center justify-between">
                              <span>Chọn phân loại nguồn tiền:</span>
                              <button
                                type="button"
                                onClick={() => setShowCategoryDropdown(false)}
                                className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-1">
                              {(Object.keys(INCOME_CATEGORY_CONFIG) as IncomeCategory[]).map((catKey) => {
                                const cfg = INCOME_CATEGORY_CONFIG[catKey];
                                const isSelected = entryCategory === catKey;
                                return (
                                  <button
                                    key={catKey}
                                    type="button"
                                    onClick={() => {
                                      setEntryCategory(catKey);
                                      setEntryTitle(cfg.label);
                                      setShowCategoryDropdown(false);
                                      entryAmountInputRef.current?.focus();
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition text-left flex items-center justify-between gap-2 cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                        : `${cfg.bg} ${cfg.text} ${cfg.border} hover:scale-101`
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-base shrink-0">{cfg.icon}</span>
                                      <span>{cfg.label}</span>
                                    </div>
                                    <span className="text-[10px] opacity-75 font-normal">Chọn</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Tiếp đến ô số tiền thực nhận (VNĐ) (3 cols) */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Số tiền thực nhận (VNĐ):
                      </label>
                      <input
                        ref={entryAmountInputRef}
                        type="text"
                        value={entryAmount}
                        onChange={(e) => setEntryAmount(formatNumberString(e.target.value, false))}
                        placeholder="VD: 45.000.000"
                        required
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-emerald-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 shadow-2xs text-right"
                      />
                    </div>

                    {/* 3. Ô ghi chú cùng 1 hàng (3 cols) */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Ghi chú:
                      </label>
                      <input
                        type="text"
                        value={entryNote}
                        onChange={(e) => setEntryNote(e.target.value)}
                        placeholder="VD: Dự án số 2, Đợt 1..."
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 shadow-2xs"
                      />
                    </div>

                    {/* 4. Nút Kê Khoản Này (2 cols) */}
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{editingItemId ? 'Cập Nhật' : '+ Kê Khoản Này'}</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* BẢNG THỐNG KÊ TỔNG HỢP CÁC THÁNG (DẠNG HÀNG NGANG GỌN GÀNG, PHÂN TRANG 5 THÁNG/TRANG) */}
                {(() => {
                  const deletedSet = new Set(db.deletedMonths || []);
                  // Đảm bảo luôn có ít nhất 15 tháng (3 trang x 5 tháng/trang) từ tháng hiện tại lùi dần (loại trừ các tháng người dùng đã xóa)
                  const monthsSet = new Set<string>();
                  const curDate = new Date();
                  for (let i = 0; i < 15; i++) {
                    const d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const key = `${y}-${m}`;
                    if (!deletedSet.has(key)) {
                      monthsSet.add(key);
                    }
                  }
                  (db.incomeItems || []).forEach((it) => {
                    const m = it.month || it.date?.slice(0, 7);
                    if (m && !deletedSet.has(m)) monthsSet.add(m);
                  });
                  (db.monthlyIncomes || []).forEach((m) => {
                    if (m.month && !deletedSet.has(m.month)) monthsSet.add(m.month);
                  });
                  if (!deletedSet.has(currentMonthKey)) {
                    monthsSet.add(currentMonthKey);
                  }

                  const allSortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
                  const pageSize = 5;
                  const totalPages = Math.max(1, Math.ceil(allSortedMonths.length / pageSize));
                  const currentPage = Math.min(Math.max(itemsPage, 1), totalPages);
                  const startIndex = (currentPage - 1) * pageSize;

                  // Dữ liệu tổng hợp theo tháng
                  const monthsSummary = allSortedMonths.map((mKey) => {
                    const parts = mKey.split('-');
                    const y = parts[0];
                    const m = parts[1];
                    const isCur = mKey === currentMonthKey;
                    const monthItems = (db.incomeItems || []).filter(
                      (it) => it.month === mKey || it.date?.slice(0, 7) === mKey
                    );
                    const itemsTotal = monthItems.reduce((sum, it) => sum + (it.amount || 0), 0);
                    // Nếu tháng chưa có kê khai chi tiết mà có ở monthlyIncomes thì lấy từ monthlyIncomes
                    const mRec = (db.monthlyIncomes || []).find((rec) => rec.month === mKey);
                    const effectiveInflow = monthItems.length > 0
                      ? itemsTotal + totalPassiveInflow
                      : (mRec ? (mRec.salary || 0) + (mRec.other || 0) + totalPassiveInflow : totalPassiveInflow);

                    const netMonthCashflow = effectiveInflow - totalMonthlyOutflow;
                    return {
                      mKey,
                      y,
                      m,
                      isCur,
                      monthItems,
                      itemsTotal,
                      totalMonthInflow: effectiveInflow,
                      totalMonthlyOutflow,
                      netMonthCashflow,
                    };
                  });

                  const paginatedSummary = monthsSummary.slice(startIndex, startIndex + pageSize);

                  const currentPageMonthKeys = paginatedSummary.map((item) => item.mKey);
                  const isAllCurrentPageSelected =
                    currentPageMonthKeys.length > 0 &&
                    currentPageMonthKeys.every((key) => selectedMonthKeys.includes(key));
                  const isSomeCurrentPageSelected =
                    currentPageMonthKeys.some((key) => selectedMonthKeys.includes(key)) && !isAllCurrentPageSelected;

                  const handleToggleSelectAllPage = () => {
                    if (isAllCurrentPageSelected) {
                      setSelectedMonthKeys((prev) => prev.filter((k) => !currentPageMonthKeys.includes(k)));
                    } else {
                      setSelectedMonthKeys((prev) => Array.from(new Set([...prev, ...currentPageMonthKeys])));
                    }
                  };

                  const handleToggleSelectMonth = (mKey: string) => {
                    setSelectedMonthKeys((prev) =>
                      prev.includes(mKey) ? prev.filter((k) => k !== mKey) : [...prev, mKey]
                    );
                  };

                  return (
                    <div className="space-y-3">
                      {/* Thanh thao tác xóa nhanh nhiều tháng đã tick */}
                      {selectedMonthKeys.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 animate-fadeIn shadow-2xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                            <span className="text-xs font-bold text-rose-950">
                              Đã chọn <strong className="bg-rose-200/90 text-rose-900 px-1.5 py-0.5 rounded font-black text-xs">{selectedMonthKeys.length}</strong> tháng
                            </span>
                            <span className="text-[11px] text-rose-700 hidden sm:inline">
                              ({selectedMonthKeys.map((k) => `T${k.split('-')[1]}/${k.split('-')[0]}`).join(', ')})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            <button
                              type="button"
                              onClick={() => setSelectedMonthKeys([])}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer shadow-2xs transition"
                            >
                              Bỏ chọn
                            </button>
                            <button
                              type="button"
                              onClick={() => setMonthsToDelete(selectedMonthKeys)}
                              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa nhanh {selectedMonthKeys.length} tháng</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Bảng thống kê ngang 5 tháng gọn gàng */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span>📊 Bảng Thống Kê Dòng Tiền 5 Tháng</span>
                              <span className="text-[10px] font-semibold text-slate-500">
                                (Trang {currentPage}/{totalPages} • {allSortedMonths.length} tháng)
                              </span>
                            </span>
                          </div>

                          {/* Bộ phân trang ở Header: Trang 1, Trang 2, Trang 3... */}
                          <div className="flex items-center gap-1 self-end sm:self-auto bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-[11px] font-bold text-slate-600 mr-1">Trang:</span>
                            {Array.from({ length: totalPages }).map((_, idx) => {
                              const pageNum = idx + 1;
                              const isCurrent = pageNum === currentPage;
                              return (
                                <button
                                  key={pageNum}
                                  type="button"
                                  onClick={() => setItemsPage(pageNum)}
                                  className={`px-2 py-0.5 rounded text-xs font-black transition cursor-pointer flex items-center justify-center ${
                                    isCurrent
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                  title={`Xem Trang ${pageNum} (5 tháng tiếp theo)`}
                                >
                                  Trang {pageNum}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bảng dạng hàng ngang thật gọn gàng, dễ nhìn */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                                <th className="p-2.5 w-10 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isAllCurrentPageSelected}
                                    ref={(el) => {
                                      if (el) el.indeterminate = isSomeCurrentPageSelected;
                                    }}
                                    onChange={handleToggleSelectAllPage}
                                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                    title="Chọn / bỏ chọn tất cả các tháng trên trang này"
                                  />
                                </th>
                                <th className="p-2.5 whitespace-nowrap">Kỳ Tháng</th>
                                <th className="p-2.5 text-center whitespace-nowrap">Khoản Đã Kê</th>
                                <th className="p-2.5 text-right font-black text-emerald-800 whitespace-nowrap">Tổng Thu Gộp</th>
                                <th className="p-2.5 text-right font-bold text-rose-700 whitespace-nowrap">Chi Nghĩa Vụ</th>
                                <th className="p-2.5 text-right font-black text-blue-800 whitespace-nowrap">Dòng Tiền Ròng</th>
                                <th className="p-2.5 text-center whitespace-nowrap">Chi Tiết Đã Kê</th>
                                <th className="p-2.5 text-center whitespace-nowrap w-16">Thao Tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paginatedSummary.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                                    Không có tháng nào trong danh sách. Hãy kê khai khoản thu ở form bên trên!
                                  </td>
                                </tr>
                              ) : (
                                paginatedSummary.map((item) => {
                                  const isExpanded = expandedMonths[item.mKey] ?? false;
                                  const isSelected = selectedMonthKeys.includes(item.mKey);
                                  return (
                                    <tr
                                      key={item.mKey}
                                      className={`hover:bg-emerald-50/30 transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-rose-50/60 hover:bg-rose-50/80'
                                          : item.isCur
                                          ? 'bg-emerald-50/40'
                                          : ''
                                      }`}
                                      onClick={() =>
                                        setExpandedMonths((prev) => ({
                                          ...prev,
                                          [item.mKey]: !isExpanded,
                                        }))
                                      }
                                      title="Kích để mở/đóng chi tiết các khoản thu đã kê của tháng này"
                                    >
                                      {/* Checkbox chọn từng tháng */}
                                      <td className="p-2.5 text-center w-10" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleToggleSelectMonth(item.mKey)}
                                          className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                          title={`Chọn Tháng ${item.m}/${item.y} để xóa nhanh`}
                                        />
                                      </td>
                                      <td className="p-2.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-extrabold text-slate-900 text-xs sm:text-[13px]">
                                            Tháng {item.m}/{item.y}
                                          </span>
                                          {item.isCur && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                              Hiện tại
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-2.5 text-center whitespace-nowrap">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                          {item.monthItems.length} khoản
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-right font-black text-emerald-700 whitespace-nowrap text-xs sm:text-[13px]">
                                        +{formatVND(item.totalMonthInflow, isPrivacyMode)}
                                      </td>
                                      <td className="p-2.5 text-right font-bold text-rose-700 whitespace-nowrap">
                                        -{formatVND(item.totalMonthlyOutflow, isPrivacyMode)}
                                      </td>
                                      <td className="p-2.5 text-right whitespace-nowrap">
                                        <span
                                          className={`px-2 py-0.5 rounded font-black text-xs ${
                                            item.netMonthCashflow >= 0
                                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                                          }`}
                                        >
                                          {item.netMonthCashflow >= 0
                                            ? `+${formatVND(item.netMonthCashflow, isPrivacyMode)}`
                                            : formatVND(item.netMonthCashflow, isPrivacyMode)}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-center whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedMonths((prev) => ({
                                              ...prev,
                                              [item.mKey]: !isExpanded,
                                            }));
                                          }}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 mx-auto transition cursor-pointer ${
                                            isExpanded
                                              ? 'bg-emerald-600 text-white shadow-2xs'
                                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                          }`}
                                        >
                                          <span>{isExpanded ? 'Đóng chi tiết' : 'Xem chi tiết'}</span>
                                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </button>
                                      </td>
                                      {/* Cột thao tác: Xóa từng tháng */}
                                      <td className="p-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={() => setMonthsToDelete([item.mKey])}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                          title={`Xóa Tháng ${item.m}/${item.y}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* THANH PHÂN TRANG FOOTER RÕ RÀNG VÀ NỔI BẬT Ở DƯỚI BẢNG */}
                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                          <div className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                            <span>Mỗi trang thống kê 5 tháng • Đang xem <span className="font-bold text-slate-900">Trang {currentPage}</span> / <span className="font-bold text-slate-900">{totalPages}</span> (Tổng {allSortedMonths.length} tháng)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={currentPage <= 1}
                              onClick={() => setItemsPage((prev) => Math.max(1, prev - 1))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                currentPage <= 1
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs'
                              }`}
                            >
                              « Trang trước
                            </button>
                            {Array.from({ length: totalPages }).map((_, idx) => {
                              const pageNum = idx + 1;
                              const isCurrent = pageNum === currentPage;
                              return (
                                <button
                                  key={pageNum}
                                  type="button"
                                  onClick={() => setItemsPage(pageNum)}
                                  className={`min-w-8 px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center ${
                                    isCurrent
                                      ? 'bg-emerald-600 text-white shadow-2xs scale-105'
                                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  Trang {pageNum}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              disabled={currentPage >= totalPages}
                              onClick={() => setItemsPage((prev) => Math.min(totalPages, prev + 1))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                currentPage >= totalPages
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs'
                              }`}
                            >
                              Trang sau »
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* KHU VỰC CHI TIẾT CÁC KHOẢN TIỀN VÀO ĐÃ KÊ (HIỂN THỊ KHI KÍCH VÀO MỖI THÁNG) */}
                      <div className="space-y-3 pt-1">
                        {paginatedSummary.map((item) => {
                          const isExpanded = expandedMonths[item.mKey] ?? false;
                          if (!isExpanded) return null;

                          return (
                            <div
                              key={item.mKey}
                              className="bg-white rounded-xl border-2 border-emerald-300 shadow-sm overflow-hidden animate-fadeIn"
                            >
                              {/* Header chi tiết tháng */}
                              <div
                                onClick={() =>
                                  setExpandedMonths((prev) => ({
                                    ...prev,
                                    [item.mKey]: false,
                                  }))
                                }
                                className="p-3 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <span className="font-black text-xs sm:text-sm text-emerald-950">
                                      Chi Tiết Các Khoản Thu Vào Tháng {item.m}/{item.y}
                                    </span>
                                    <span className="text-[11px] text-emerald-700 ml-2 font-medium">
                                      ({item.monthItems.length} khoản đã kê • Tổng: +{formatVND(item.totalMonthInflow, isPrivacyMode)})
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEntryDate(`${item.mKey}-05`);
                                      setShowCategoryDropdown(true);
                                    }}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-2xs transition cursor-pointer"
                                  >
                                    + Kê thêm cho tháng này
                                  </button>
                                  <span className="text-[11px] font-bold text-emerald-800 underline">
                                    Thu gọn ✕
                                  </span>
                                </div>
                              </div>

                              {/* Danh sách các món trong tháng */}
                              <div className="p-3 sm:p-4 space-y-2 bg-white">
                                {item.monthItems.length === 0 ? (
                                  <div className="p-4 bg-slate-50 rounded-xl text-center space-y-2 border border-slate-200">
                                    <p className="text-xs text-slate-500 italic">
                                      Chưa có khoản kê riêng lẻ trong tháng {item.m}/{item.y} (Tổng thu gộp tính theo định mức lương).
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEntryDate(`${item.mKey}-05`);
                                        setShowCategoryDropdown(true);
                                      }}
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Kê ngay khoản thu cho Tháng {item.m}/{item.y}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                                    {item.monthItems.map((itemEntry) => {
                                      const cfg = INCOME_CATEGORY_CONFIG[itemEntry.category] || INCOME_CATEGORY_CONFIG.other;
                                      const formattedDate = itemEntry.date ? formatDateVN(itemEntry.date) : '—';
                                      return (
                                        <div
                                          key={itemEntry.id}
                                          className="p-2.5 sm:p-3 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 transition"
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border shrink-0 ${cfg.bg} ${cfg.border}`}>
                                              {cfg.icon}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-xs text-slate-900 truncate">
                                                  {itemEntry.title}
                                                </span>
                                                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                  {cfg.label}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-0.5">
                                                <span>{formattedDate}</span>
                                                {itemEntry.note && (
                                                  <>
                                                    <span>•</span>
                                                    <span className="truncate italic text-slate-600">{itemEntry.note}</span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="font-black text-xs sm:text-sm text-emerald-700">
                                              +{formatVND(itemEntry.amount, isPrivacyMode)}
                                            </span>
                                            <div className="flex items-center gap-0.5 ml-1">
                                              <button
                                                type="button"
                                                onClick={() => handleEditIncomeItem(itemEntry)}
                                                className="p-1 text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                                title="Sửa khoản này"
                                              >
                                                <Pen className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setItemToDelete(itemEntry)}
                                                className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                                title="Xóa khoản này"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* Dòng thụ động tự động từ Tab 1 */}
                                    {totalPassiveInflow > 0 && (
                                      <div className="p-2.5 sm:p-3 bg-teal-50/40 flex items-center justify-between text-xs text-teal-900 font-medium">
                                        <div className="flex items-center gap-2">
                                          <span>📈</span>
                                          <span>Thu nhập thụ động từ Tab 1 (BĐS cho thuê, cổ tức, lãi tiết kiệm):</span>
                                        </div>
                                        <span className="font-black text-teal-700">
                                          +{formatVND(totalPassiveInflow, isPrivacyMode)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* CHẾ ĐỘ 2: NHẬP TỔNG THU CẢ THÁNG (TRUYỀN THỐNG) */}
            {incomeInputMode === 'monthly' && (
              <div className="space-y-4">
                <form onSubmit={handleSaveMonthlyRecord} className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{editingMonthKey ? `Đang chỉnh sửa thu nhập Tháng ${editingMonthKey}:` : 'Nhập số tiền thu về trong tháng:'}</span>
                    </span>
                    {/* Phím tắt chọn nhanh tháng */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                      {(() => {
                        const shortcuts = [];
                        const d = new Date();
                        for (let i = 0; i < 4; i++) {
                          const temp = new Date(d.getFullYear(), d.getMonth() - i, 1);
                          const y = temp.getFullYear();
                          const m = temp.getMonth() + 1;
                          const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                          const key = `${y}-${pad(m)}`;
                          const label = i === 0 ? `Tháng này (T${pad(m)})` : `T${pad(m)}/${y}`;
                          shortcuts.push({ key, label });
                        }
                        return shortcuts.map((sc) => (
                          <button
                            key={sc.key}
                            type="button"
                            onClick={() => handleSelectMonth(sc.key)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition whitespace-nowrap cursor-pointer ${
                              selectedMonth === sc.key
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                            }`}
                          >
                            {sc.label}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    {/* Chọn tháng */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tháng ghi nhận:
                      </label>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => handleSelectMonth(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-2xs"
                      />
                    </div>

                    {/* Tiền lương & thưởng */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Lương & Thưởng (VNĐ):
                      </label>
                      <input
                        type="text"
                        value={monthSalaryInput}
                        onChange={(e) => setMonthSalaryInput(formatNumberString(e.target.value, false))}
                        placeholder="VD: 85.000.000"
                        required
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-800 outline-none focus:border-emerald-500 shadow-2xs text-right"
                      />
                    </div>

                    {/* Thu nhập khác / Kinh doanh */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Thu nhập khác / Hoa hồng (VNĐ):
                      </label>
                      <input
                        type="text"
                        value={monthOtherInput}
                        onChange={(e) => setMonthOtherInput(formatNumberString(e.target.value, false))}
                        placeholder="VD: 15.000.000"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-800 outline-none focus:border-emerald-500 shadow-2xs text-right"
                      />
                    </div>

                    {/* Ghi chú */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Ghi chú chi tiết:
                      </label>
                      <input
                        type="text"
                        value={monthNoteInput}
                        onChange={(e) => setMonthNoteInput(e.target.value)}
                        placeholder="VD: Thưởng KPI Q3, hoa hồng..."
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Thống kê tính toán tức thời */}
                  {(() => {
                    const curSalary = parseFormattedNumber(monthSalaryInput);
                    const curOther = parseFormattedNumber(monthOtherInput);
                    const curInflow = curSalary + curOther + totalPassiveInflow;
                    const curNet = curInflow - totalMonthlyOutflow;
                    return (
                      <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px]">
                          <span className="text-slate-600">
                            Thụ động Tab 1: <strong className="text-emerald-700">+{formatVND(totalPassiveInflow)}</strong>
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600">
                            Tổng thu về: <strong className="text-emerald-800 text-xs font-black">+{formatVND(curInflow)}</strong>
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600">
                            Chi ra (TB): <strong className="text-rose-700">-{formatVND(totalMonthlyOutflow)}</strong>
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 flex items-center gap-1">
                            Dòng tiền ròng:
                            <span className={`px-2 py-0.5 rounded font-black text-xs ${curNet >= 0 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'}`}>
                              {curNet >= 0 ? `+${formatVND(curNet)} (Thặng dư)` : `${formatVND(curNet)} (Thâm hụt)`}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          {editingMonthKey && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMonthKey(null);
                                handleSelectMonth(selectedMonth);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                            >
                              Hủy sửa
                            </button>
                          )}
                          <button
                            type="submit"
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{editingMonthKey ? 'Cập Nhật Tháng Này' : 'Lưu Thu Nhập Tháng'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </form>

                {/* Bảng Danh Sách Các Tháng Đã Ghi Nhận */}
                {(() => {
                  const allMonthly = [...(db.monthlyIncomes || [])].slice().reverse();
                  const pageSize = 5;
                  const totalPages = Math.ceil(allMonthly.length / pageSize) || 1;
                  const curPage = Math.min(Math.max(monthlyPage, 1), totalPages);
                  const startIdx = (curPage - 1) * pageSize;
                  const paginatedMonthly = allMonthly.slice(startIdx, startIdx + pageSize);

                  return (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      {totalPages > 1 && (
                        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">
                            Danh sách các tháng đã ghi nhận ({allMonthly.length} tháng)
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold text-slate-500 mr-1">Trang:</span>
                            {Array.from({ length: totalPages }).map((_, idx) => {
                              const p = idx + 1;
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setMonthlyPage(p)}
                                  className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    p === curPage
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {p}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                              <th className="p-2.5 whitespace-nowrap">Kỳ Tháng</th>
                              <th className="p-2.5 text-right whitespace-nowrap">Lương & Thưởng</th>
                              <th className="p-2.5 text-right whitespace-nowrap">Thu Khác</th>
                              <th className="p-2.5 text-right whitespace-nowrap">Thụ Động</th>
                              <th className="p-2.5 text-right font-black text-emerald-800 whitespace-nowrap">Tổng Thu Về</th>
                              <th className="p-2.5 text-right font-bold text-rose-700 whitespace-nowrap">Chi Nghĩa Vụ</th>
                              <th className="p-2.5 text-right font-black text-blue-800 whitespace-nowrap">Dòng Tiền Ròng</th>
                              <th className="p-2.5 whitespace-nowrap">Ghi Chú</th>
                              <th className="p-2.5 text-center whitespace-nowrap">Thao Tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {allMonthly.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="p-4 text-center text-slate-400 italic">
                                  Chưa có tháng nào được ghi nhận. Hãy nhập tháng đầu tiên ở form bên trên!
                                </td>
                              </tr>
                            ) : (
                              paginatedMonthly.map((item) => {
                                const parts = item.month.split('-');
                                const y = parts[0];
                                const m = parts[1];
                                const isCur = item.month === currentMonthKey;
                                const passive = item.passive !== undefined ? item.passive : totalPassiveInflow;
                                const totalInflow = (item.salary || 0) + (item.other || 0) + passive;
                                const net = totalInflow - totalMonthlyOutflow;

                                return (
                                  <tr
                                    key={item.month}
                                    className={`hover:bg-slate-50/80 transition ${isCur ? 'bg-emerald-50/30' : ''}`}
                                  >
                                    <td className="p-2.5 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-extrabold text-slate-900">
                                          T{m}/{y}
                                        </span>
                                        {isCur && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                            Hiện tại
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                                      {formatVND(item.salary, isPrivacyMode)}
                                    </td>
                                    <td className="p-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                                      {formatVND(item.other, isPrivacyMode)}
                                    </td>
                                    <td className="p-2.5 text-right text-emerald-700 whitespace-nowrap">
                                      {formatVND(passive, isPrivacyMode)}
                                    </td>
                                    <td className="p-2.5 text-right font-black text-emerald-700 whitespace-nowrap">
                                      +{formatVND(totalInflow, isPrivacyMode)}
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-rose-700 whitespace-nowrap">
                                      -{formatVND(totalMonthlyOutflow, isPrivacyMode)}
                                    </td>
                                    <td className="p-2.5 text-right whitespace-nowrap">
                                      <span
                                        className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                          net >= 0
                                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                                        }`}
                                      >
                                        {net >= 0 ? `+${formatVND(net, isPrivacyMode)}` : formatVND(net, isPrivacyMode)}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-500 max-w-[160px] truncate text-[11px]">
                                      {item.note || '—'}
                                    </td>
                                    <td className="p-2.5 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleSelectMonth(item.month)}
                                          className="p-1 rounded text-amber-600 hover:bg-amber-50 cursor-pointer"
                                          title="Chỉnh sửa tháng này"
                                        >
                                          <Pen className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setMonthToDelete(item.month)}
                                          className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                                          title="Xóa bản ghi tháng này"
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
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
        {/* Bảng Cơ Cấu Chi Trả */}
        <div className="border border-slate-200/80 rounded-xl overflow-hidden mt-3 bg-white">
          <div
            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none bg-slate-50 hover:bg-slate-100/80 transition"
            onClick={() => setShowBreakdownTable(!showBreakdownTable)}
          >
            <div className="flex items-start sm:items-center space-x-2.5 min-w-0 flex-1">
              <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
                {showBreakdownTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 leading-snug">
                  Bảng Chi Tiết Cơ Cấu Chi Trả Nghĩa Vụ & Chi Phí
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 shrink-0 whitespace-nowrap">
                  5 phân nhóm
                </span>
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{showBreakdownTable ? 'Thu Gọn' : 'Xem Chi Tiết'}</span>
            </button>
          </div>

          {showBreakdownTable && (
            <div className="border-t border-slate-100">
              {/* 1. DEDICATED MOBILE VIEW (< sm) - COMPACT BREAKDOWN CARDS */}
              <div className="sm:hidden p-2.5 space-y-2 bg-slate-50/50">
                {(['type1', 'type2', 'type_free', 'type3', 'type4'] as const).map((key) => {
                  const item = catStats[key];
                  const m = item.monthly;
                  const q = m * 3;
                  const y = m * 12;
                  const share = totalMonthlyOutflow > 0 ? Math.round((m / totalMonthlyOutflow) * 100) : 0;

                  if (key === 'type_free') {
                    if (item.count > 0) {
                      return (
                        <div key={key} className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${item.tag}`}>
                                {item.label}
                              </span>
                              <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal shrink-0">({item.count})</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-purple-50 text-purple-700 border-purple-200 shrink-0">
                              Trả tự do
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                            <span className="text-[10px] text-slate-500">Dư nợ mượn:</span>
                            <span className="font-bold text-purple-700 text-xs">{formatVND(item.outstanding, isPrivacyMode)}</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="bg-white/60 px-2.5 py-1.5 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs opacity-60">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            {item.label}
                          </span>
                          <span className="text-slate-500 text-[11px]">{item.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 italic">Chưa phát sinh</span>
                      </div>
                    );
                  }

                  if (m > 0) {
                    const statusLabel = share >= 60 ? 'Tải trọng chính' : share >= 30 ? 'Trung bình' : 'Thấp';
                    const statusClass = share >= 60 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200';

                    return (
                      <div key={key} className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${item.tag}`}>
                              {item.label}
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal shrink-0">({item.count} khoản)</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-bold text-slate-700 text-[10.5px]">
                              {isPrivacyMode ? '••%' : `${share}%`}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>

                        {item.outstanding > 0 && (
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 px-0.5">
                            <span>Dư nợ gốc còn lại:</span>
                            <span className="font-bold text-rose-600">{formatVND(item.outstanding, isPrivacyMode)}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-[9px] text-slate-400 block leading-tight">Chi trả / tháng</span>
                            <span className="font-extrabold text-rose-600 text-xs block leading-tight mt-0.5">
                              {formatVND(m, isPrivacyMode)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 block leading-tight">Dự phóng năm</span>
                            <span className="font-semibold text-slate-700 text-[11px] block leading-tight mt-0.5">
                              {formatVND(y, isPrivacyMode)}
                            </span>
                            <span className="text-[9px] text-slate-400 block leading-tight">
                              Quý: {formatVND(q, isPrivacyMode)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={key} className="bg-white/60 px-2.5 py-1.5 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs opacity-60">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          {item.label}
                        </span>
                        <span className="text-slate-500 text-[11px]">{item.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 italic">Chưa phát sinh</span>
                    </div>
                  );
                })}
              </div>

              {/* 2. DEDICATED DESKTOP VIEW (>= sm) - FULL TABLE */}
              <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-white text-slate-400 font-semibold border-b border-slate-100 text-[11px]">
                    <th className="py-2.5 px-3.5">Phân Nhóm Nghĩa Vụ</th>
                    <th className="py-2.5 px-3.5 text-right">Chi Trả / Tháng</th>
                    <th className="py-2.5 px-3.5 text-right">Dự Phóng Quý & Năm</th>
                    <th className="py-2.5 px-3.5 text-center w-36">Tỷ Trọng & Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(['type1', 'type2', 'type_free', 'type3', 'type4'] as const).map((key) => {
                    const item = catStats[key];
                    const m = item.monthly;
                    const q = m * 3;
                    const y = m * 12;
                    const share = totalMonthlyOutflow > 0 ? Math.round((m / totalMonthlyOutflow) * 100) : 0;

                    if (key === 'type_free') {
                      if (item.count > 0) {
                        return (
                          <tr key={key} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3.5 font-bold text-slate-800">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border ${item.tag}`}>
                                  {item.label}
                                </span>
                                <span>{item.name}</span>
                                <span className="text-[11px] text-slate-400 font-normal">({item.count} khoản)</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-bold text-purple-700 whitespace-nowrap">
                              0 ₫ (Linh hoạt)
                            </td>
                            <td className="py-2.5 px-3.5 text-right text-slate-500 font-medium whitespace-nowrap text-[11px]">
                              Dư nợ mượn: <span className="font-bold text-purple-700">{formatVND(item.outstanding, isPrivacyMode)}</span>
                            </td>
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold border bg-purple-50 text-purple-700 border-purple-200">
                                Trả tự do
                              </span>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={key} className="opacity-40 hover:opacity-70 transition">
                          <td className="py-2 px-3.5 text-slate-400 flex items-center gap-2">
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-400 border border-slate-200">
                              {item.label}
                            </span>
                            <span>{item.name}</span>
                          </td>
                          <td className="py-2 px-3.5 text-right text-slate-300 font-normal">—</td>
                          <td className="py-2 px-3.5 text-right text-slate-300 text-[11px] font-normal">—</td>
                          <td className="py-2 px-3.5 text-center text-slate-300 text-[11px]">Chưa phát sinh</td>
                        </tr>
                      );
                    }

                    if (m > 0) {
                      const statusLabel = share >= 60 ? 'Tải trọng chính' : share >= 30 ? 'Trung bình' : 'Thấp';
                      const statusClass = share >= 60 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200';

                      return (
                        <tr key={key} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3.5 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border ${item.tag}`}>
                                {item.label}
                              </span>
                              <span>{item.name}</span>
                              <span className="text-[11px] text-slate-400 font-normal">({item.count} khoản)</span>
                            </div>
                            {item.outstanding > 0 && (
                              <div className="text-[10.5px] text-slate-500 font-normal mt-0.5 ml-8">
                                Dư nợ gốc: <span className="font-bold text-rose-600">{formatVND(item.outstanding, isPrivacyMode)}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-extrabold text-rose-600 whitespace-nowrap">
                            {formatVND(m, isPrivacyMode)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right text-slate-500 font-medium whitespace-nowrap text-[11px]">
                            Quý: <span className="font-semibold text-slate-700">{formatVND(q, isPrivacyMode)}</span> • Năm:{' '}
                            <span className="font-semibold text-slate-700">{formatVND(y, isPrivacyMode)}</span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            <span className="inline-block font-bold text-slate-800 text-[11px] mr-1.5">
                              {isPrivacyMode ? '••%' : `${share}%`}
                            </span>
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold border ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={key} className="opacity-40 hover:opacity-70 transition">
                        <td className="py-2 px-3.5 text-slate-400 flex items-center gap-2">
                          <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-400 border border-slate-200">
                            {item.label}
                          </span>
                          <span>{item.name}</span>
                        </td>
                        <td className="py-2 px-3.5 text-right text-slate-300 font-normal">—</td>
                        <td className="py-2 px-3.5 text-right text-slate-300 text-[11px] font-normal">—</td>
                        <td className="py-2 px-3.5 text-center text-slate-300 text-[11px]">Chưa phát sinh</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>

      {/* Button Open Debt Form, Simulator, and Calendar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => {
            if (showDebtForm) handleCancelDebtForm();
            else setShowDebtForm(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center space-x-2 shadow-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-rose-400" />
          <span>{showDebtForm ? 'Đóng Khung Thiết Lập' : '+ Thêm Nghĩa Vụ Tài Chính Mới'}</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenDebtSimulator && (
            <button
              type="button"
              onClick={onOpenDebtSimulator}
              className="bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-900 border border-indigo-300/80 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              title="Mô phỏng trả nợ sớm theo chiến lược Tuyết Lăn (Snowball) hoặc Lở Tuyết (Avalanche)"
            >
              <Zap className="w-4 h-4 text-indigo-600" />
              <span>⚡ Mô Phỏng Trả Nợ Sớm (Snowball / Avalanche)</span>
            </button>
          )}

          {onOpenFinancialCalendar && (
            <button
              type="button"
              onClick={onOpenFinancialCalendar}
              className="bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-900 border border-blue-300/80 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              title="Xem lịch hạn trả nợ, chu kỳ nhận lương và các mốc dòng tiền trong tháng"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>📅 Lịch Dòng Tiền</span>
            </button>
          )}
        </div>
      </div>

      {/* Debt Form Modal (Responsive Bottom-Sheet on Mobile, Click outside backdrop to exit) */}
      {showDebtForm && (
        <div
          onClick={handleCancelDebtForm}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-3xl rounded-t-2xl sm:rounded-2xl p-3.5 sm:p-6 shadow-2xl border border-slate-200 space-y-2.5 sm:space-y-4 max-h-[90vh] overflow-y-auto cursor-default"
          >
            {/* Mobile Drag Handle Indicator */}
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden"></div>
            <form
              ref={debtFormRef}
              onSubmit={handleSaveDebt}
              className="space-y-2.5 sm:space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 sm:pb-3">
                <h2 className="text-xs sm:text-base font-bold text-slate-900 flex items-center min-w-0 flex-1 mr-2">
                  <i className="fa-solid fa-file-invoice-dollar text-rose-600 mr-1.5 shrink-0"></i>
                  <span className="truncate">{editingDebtId ? `Sửa: ${debtName}` : 'Khởi Tạo Nghĩa Vụ Nợ'}</span>
                </h2>
                <button
                  type="button"
                  onClick={handleCancelDebtForm}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
                  title="Đóng"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

          {/* 1. Phân loại và tên khoản nợ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3.5">
            <div>
              <label className="block text-[10.5px] sm:text-xs font-bold text-slate-700 mb-0.5 sm:mb-1">
                1. Phân Loại Nhóm Nghĩa Vụ
              </label>
              <select
                value={debtCat}
                onChange={(e) => {
                  const nextCat = e.target.value as DebtCategory;
                  setDebtCat(nextCat);
                  if (nextCat === 'type_free') {
                    setDebtIsNoTerm(true);
                    setDebtFreq('flexible');
                    setDebtTermMonthsStr('');
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:border-rose-500 focus:bg-white"
              >
                <option value="type1">Loại 1: Nghĩa vụ nợ vay có lãi (Ngân hàng, mua nhà, xe...)</option>
                <option value="type2">Loại 2: Nợ trả góp định kỳ (0% lãi, trừ đều hàng tháng...)</option>
                <option value="type_free">Loại 3: Mượn nợ người thân / Vay tự do (0% lãi, trả linh hoạt)</option>
                <option value="type3">Loại 4: Chi phí định kỳ không có gốc (Bảo hiểm, thuê nhà...)</option>
                <option value="type4">Loại 5: Chi phí sinh hoạt thường xuyên (Điện, nước, tiêu dùng...)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] sm:text-xs font-bold text-slate-700 mb-0.5 sm:mb-1">
                2. Tên Khoản Nợ / Chi Phí
              </label>
              <input
                ref={debtNameInputRef}
                type="text"
                value={debtName}
                onChange={(e) => setDebtName(e.target.value)}
                placeholder="VD: Vay mua nhà VCB / Trả góp..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
              />
            </div>
          </div>

          {/* Banner mô tả phân loại */}
          <div className="bg-rose-50/80 border border-rose-200/90 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-rose-900 leading-snug">
            {debtCategoryDescriptions[debtCat]}
          </div>

          {/* Segmented Toggle: Chọn Có kỳ hạn vs Không kỳ hạn cho Loại 1 & Loại 2 */}
          {(debtCat === 'type1' || debtCat === 'type2') && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5 p-2 sm:p-2.5 bg-slate-50/90 border border-slate-200 rounded-lg sm:rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-800">Hình Thức Kỳ Hạn</span>
                <p className="text-[10px] sm:text-[11px] text-slate-500">Trả định kỳ cố định hoặc trả tự do không ép hạn</p>
              </div>
              <div className="inline-flex p-0.5 sm:p-1 bg-slate-200/80 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDebtIsNoTerm(false);
                    if (debtFreq === 'flexible') setDebtFreq('monthly');
                  }}
                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg transition cursor-pointer ${
                    !debtIsNoTerm
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Có kỳ hạn định kỳ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDebtIsNoTerm(true);
                    setDebtFreq('flexible');
                    setDebtTermMonthsStr('');
                  }}
                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg transition cursor-pointer ${
                    debtIsNoTerm
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✨ Không kỳ hạn
                </button>
              </div>
            </div>
          )}

          {/* Khi KHÔNG KỲ HẠN (Loại 1 / Loại 2 bật không kỳ hạn, hoặc Loại 3 vay tự do) */}
          {(debtIsNoTerm || debtCat === 'type_free') && (
            <div className="space-y-2 sm:space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    {debtCat === 'type_free' ? 'Tổng Tiền Mượn Gốc (VNĐ)' : 'Tổng Tiền Gốc / Hạn Mức (VNĐ)'}
                  </label>
                  <input
                    type="text"
                    value={debtAmountStr}
                    onChange={(e) => setDebtAmountStr(formatNumberString(e.target.value, false))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-bold text-rose-600 outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Ngày Bắt Đầu / Vay
                  </label>
                  <input
                    type="date"
                    value={debtStartDate}
                    onChange={(e) => setDebtStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              </div>
              <div className="bg-purple-50/90 border border-purple-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-[11px] sm:text-xs text-purple-900 flex items-center gap-2">
                <span className="text-sm sm:text-base shrink-0">✨</span>
                <span className="leading-snug">
                  <strong>Khoản nợ không kỳ hạn:</strong> Không có hạn tiếp theo cần đóng tiền. Bạn có thể thanh toán linh hoạt bất kỳ lúc nào.
                </span>
              </div>
            </div>
          )}

          {/* Khi CÓ KỲ HẠN - LOẠI 2: Nợ trả góp định kỳ 0% lãi */}
          {debtCat === 'type2' && !debtIsNoTerm && (
            <div className="space-y-2 sm:space-y-3">
              {/* Hàng 1: Grid 2 cols on mobile, 3 cols on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Tổng Tiền Gốc (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={debtAmountStr}
                    onChange={(e) => setDebtAmountStr(formatNumberString(e.target.value, false))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-bold text-rose-600 outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Thời Hạn (Tháng)
                  </label>
                  <input
                    type="number"
                    value={debtTermMonthsStr}
                    onChange={(e) => setDebtTermMonthsStr(e.target.value)}
                    placeholder="VD: 12"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                  {debtStartDate && debtTermMonthsStr && (
                    <div className="mt-0.5 text-[8.5px] sm:text-[9.5px] text-slate-500 font-medium truncate flex items-center gap-1">
                      <span>🔒 Hạn:</span>
                      <span className="font-bold text-slate-800">{calculateMaturityDate(debtStartDate, Number(debtTermMonthsStr))}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Trả Mỗi Kỳ (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={installmentAmountStr}
                    onChange={(e) => {
                      const formatted = formatNumberString(e.target.value, false);
                      setInstallmentAmountStr(formatted === '0' ? '' : formatted);
                    }}
                    placeholder="Tự chia theo hạn"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-bold text-rose-600 outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Hàng 2: Grid 2 cols on mobile, 3 cols on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">Chu Kỳ</label>
                  <select
                    value={debtFreq}
                    onChange={(e) => setDebtFreq(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="monthly">Hàng tháng (Monthly)</option>
                    <option value="quarterly">Hàng quý (Quarterly)</option>
                    <option value="biannual">6 tháng / Nửa năm</option>
                    <option value="annual">Hàng năm (Annual)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">Ngày Hạn (1-31)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={debtDayStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (!raw) {
                        setDebtDayStr('');
                        return;
                      }
                      const n = parseInt(raw, 10);
                      if (n > 31) setDebtDayStr('31');
                      else setDebtDayStr(String(n));
                    }}
                    placeholder="VD: 20"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Ngày Bắt Đầu
                  </label>
                  <input
                    type="date"
                    value={debtStartDate}
                    onChange={(e) => setDebtStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Khi CÓ KỲ HẠN - LOẠI 1: Vay ngân hàng có lãi */}
          {debtCat === 'type1' && !debtIsNoTerm && (
            <div className="space-y-2 sm:space-y-3">
              {/* Hàng 1: Grid 2 cols on mobile, 3 cols on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Tổng Tiền Gốc / Hạn Mức (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={debtAmountStr}
                    onChange={(e) => setDebtAmountStr(formatNumberString(e.target.value, false))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-bold text-rose-600 outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Thời Hạn (Tháng)
                  </label>
                  <input
                    type="number"
                    value={debtTermMonthsStr}
                    onChange={(e) => setDebtTermMonthsStr(e.target.value)}
                    placeholder="VD: 240"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                  {debtStartDate && debtTermMonthsStr && (
                    <div className="mt-0.5 text-[8.5px] sm:text-[9.5px] text-slate-500 font-medium truncate flex items-center gap-1">
                      <span>🔒 Hạn:</span>
                      <span className="font-bold text-slate-800">{calculateMaturityDate(debtStartDate, Number(debtTermMonthsStr))}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Ưu Đãi (Tháng)
                  </label>
                  <input
                    type="number"
                    value={promoMonthsStr}
                    onChange={(e) => setPromoMonthsStr(e.target.value)}
                    placeholder="VD: 24"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Hàng 2: Grid 2 cols on mobile, 3 cols on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">Chu Kỳ</label>
                  <select
                    value={debtFreq}
                    onChange={(e) => setDebtFreq(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="monthly">Hàng tháng (Monthly)</option>
                    <option value="quarterly">Hàng quý (Quarterly)</option>
                    <option value="biannual">6 tháng / Nửa năm</option>
                    <option value="annual">Hàng năm (Annual)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">Ngày Hạn (1-31)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={debtDayStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (!raw) {
                        setDebtDayStr('');
                        return;
                      }
                      const n = parseInt(raw, 10);
                      if (n > 31) setDebtDayStr('31');
                      else setDebtDayStr(String(n));
                    }}
                    placeholder="VD: 20"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Ngày Giải Ngân
                  </label>
                  <input
                    type="date"
                    value={debtStartDate}
                    onChange={(e) => setDebtStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Hàng 3: Khối lãi suất (Grid 2 cols on mobile, 3 cols on desktop) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-orange-800 mb-0.5 sm:mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>Hết Ưu Đãi</span>
                      <span className="text-[8.5px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-bold">🔒 Tự động</span>
                    </span>
                  </label>
                  <input
                    type="date"
                    readOnly={true}
                    value={
                      debtStartDate && promoMonthsStr
                        ? calculateMaturityDateISO(debtStartDate, Number(promoMonthsStr))
                        : (debtPromoEndDate || '')
                    }
                    className="w-full bg-slate-100 text-slate-700 font-bold border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs cursor-not-allowed select-none outline-none shadow-2xs"
                    title="Mốc hết hạn ưu đãi được tự động tính theo ngày giải ngân và số tháng ưu đãi."
                  />
                  <div className="text-[8.5px] sm:text-[9.5px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium truncate">
                    <span>⚡:</span>
                    <span className="font-bold text-orange-700 truncate">
                      {debtStartDate && promoMonthsStr
                        ? calculateMaturityDate(debtStartDate, Number(promoMonthsStr))
                        : 'Chờ giải ngân & ưu đãi'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1 truncate">
                    Lãi Ưu Đãi (%/năm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={promoRateStr}
                    onChange={(e) => setPromoRateStr(e.target.value)}
                    placeholder="VD: 6.5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1 truncate">
                    Lãi Sau Ưu Đãi (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={normalRateStr}
                    onChange={(e) => setNormalRateStr(e.target.value)}
                    placeholder="VD: 10.5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LOẠI 4 & 5: Chi phí định kỳ & Chi phí sinh hoạt */}
          {(debtCat === 'type3' || debtCat === 'type4') && (
            <div className="space-y-2 sm:space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Số Tiền Mỗi Kỳ (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={periodicAmountStr}
                    onChange={(e) => setPeriodicAmountStr(formatNumberString(e.target.value, false))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-bold text-rose-600 outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">Chu Kỳ</label>
                  <select
                    value={debtFreq}
                    onChange={(e) => setDebtFreq(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="monthly">Hàng tháng (Monthly)</option>
                    <option value="quarterly">Hàng quý (Quarterly)</option>
                    <option value="biannual">6 tháng / Nửa năm</option>
                    <option value="annual">Hàng năm (Annual)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">Ngày Hạn (1-31)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={debtDayStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (!raw) {
                        setDebtDayStr('');
                        return;
                      }
                      const n = parseInt(raw, 10);
                      if (n > 31) setDebtDayStr('31');
                      else setDebtDayStr(String(n));
                    }}
                    placeholder="VD: 20"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              </div>
              {debtCat === 'type3' && (
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">
                    Ngày Bắt Đầu Áp Dụng
                  </label>
                  <input
                    type="date"
                    value={debtStartDate}
                    onChange={(e) => setDebtStartDate(e.target.value)}
                    className="w-full sm:max-w-xs bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* 3. Ghi Chú Thỏa Thuận - Full Width */}
          <div>
            <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-600 mb-0.5 sm:mb-1">Ghi Chú Thỏa Thuận</label>
            <input
              type="text"
              value={debtNote}
              onChange={(e) => setDebtNote(e.target.value)}
              placeholder="VD: Số hợp đồng vay, điều kiện tất toán..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-rose-500"
            />
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 pt-1.5 sm:pt-2">
            <button
              type="submit"
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 sm:py-3 rounded-xl transition cursor-pointer shadow-sm"
            >
              {editingDebtId ? '✓ Cập Nhật Nghĩa Vụ Nợ' : '+ Cập Nhật Nghĩa Vụ'}
            </button>
            <button
              type="button"
              onClick={handleCancelDebtForm}
              className="px-4 sm:px-5 py-2.5 sm:py-3 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </form>
          </div>
        </div>
      )}

      {/* Bảng Master Schedule Nợ */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3 bg-white">
          <div
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer select-none min-w-0 flex-1"
            onClick={() => setShowDebtTable(!showDebtTable)}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
              {showDebtTable ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                  Kế Hoạch Thanh Toán & Tiến Độ Nợ Vay
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-rose-100 text-rose-800 shrink-0 whitespace-nowrap">
                  {db.debts.length} khoản
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowDebtTable(!showDebtTable)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] sm:text-xs px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{showDebtTable ? 'Thu Gọn' : 'Xem Chi Tiết'}</span>
          </button>
        </div>

        {showDebtTable && (
          <div className="border-t border-slate-100 p-2.5 sm:p-5 pt-2 sm:pt-3 space-y-2 sm:space-y-4">
            {/* 1. DEDICATED MOBILE VIEW (< md) - COMPACT CARD LIST */}
            <div className="md:hidden space-y-1.5">
              {db.debts.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  Chưa có nghĩa vụ tài chính nào.
                </div>
              ) : (
                db.debts.map((rawD, index) => {
                  const d = repairDebtPeriodicAmount(rawD);
                  const isNoTerm = isNoTermDebt(d);
                  const today = new Date();
                  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), d.day || 20);
                  const nextDue =
                    thisMonthDue >= todayDateOnly
                      ? thisMonthDue
                      : new Date(today.getFullYear(), today.getMonth() + 1, d.day || 20);
                  const diffDays = Math.round((nextDue.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24));

                  const shortCatTag: Record<DebtCategory, string> = {
                    type1: isNoTerm ? 'L1 • Không kỳ hạn' : 'L1 • Vay lãi',
                    type2: isNoTerm ? 'L2 • Không kỳ hạn' : 'L2 • Trả góp',
                    type_free: 'L3 • Vay tự do',
                    type3: 'L4 • Định kỳ',
                    type4: 'L5 • Sinh hoạt',
                  };

                  const totalPrincipal = d.amount || 0;
                  const paidPrincipal = d.status === 'Đã tất toán' ? totalPrincipal : d.paidPrincipal || 0;
                  const remainingPrincipal = Math.max(0, totalPrincipal - paidPrincipal);
                  const percentPaid =
                    totalPrincipal > 0 ? Math.min(100, Math.round((paidPrincipal / totalPrincipal) * 100)) : 0;

                  const nextDueDateFormatted =
                    isNoTerm || d.category === 'type_free' ? 'Linh hoạt' : nextDue.toLocaleDateString('vi-VN');
                  const finalMaturity =
                    !isNoTerm && d.startDate && d.termMonths ? calculateMaturityDate(d.startDate, d.termMonths) : '';

                  const freqLabel =
                    d.frequency === 'annual'
                      ? '/năm'
                      : d.frequency === 'biannual'
                      ? '/6T'
                      : d.frequency === 'quarterly'
                      ? '/quý'
                      : '/th';

                  const payAmount =
                    isNoTerm
                      ? 0
                      : d.category === 'type1'
                      ? d.monthlyBefore
                      : d.category === 'type2'
                      ? d.monthlyBefore || d.installmentAmount || 0
                      : d.periodicAmount || d.monthlyBefore || 0;

                  return (
                    <div
                      key={d.id}
                      className={`bg-slate-50/70 hover:bg-slate-50 rounded-lg border border-slate-200 p-2 space-y-1.5 transition shadow-2xs ${
                        d.status === 'Đã tất toán' ? 'opacity-65' : ''
                      }`}
                    >
                      {/* Row 1: STT, Category Tag, Name, Actions */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="w-4 h-4 rounded bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            {shortCatTag[d.category] || 'Khác'}
                          </span>
                          <div className="min-w-0 flex-1 truncate">
                            <span className="text-xs font-bold text-slate-900 truncate block leading-tight">{d.name}</span>
                            {d.note && (
                              <div className="text-[9.5px] text-slate-400 italic truncate mt-0.5">"{d.note}"</div>
                            )}
                          </div>
                        </div>

                        {/* Status & Action buttons */}
                        <div className="flex items-center space-x-0.5 shrink-0">
                          <button
                            onClick={() => handleToggleSettled(d)}
                            className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold transition cursor-pointer ${
                              d.status === 'Đã tất toán'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                          >
                            {d.status === 'Đã tất toán' ? '✓ Đã xong' : 'Chưa xong'}
                          </button>
                          <button
                            onClick={() => handleEditDebt(d)}
                            className="p-1 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition active:scale-95 cursor-pointer"
                            title="Sửa"
                          >
                            <Pen className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDebtToDelete({ id: d.id, name: d.name })}
                            className="p-1 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition active:scale-95 cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Chi trả / kỳ & Hạn tiếp theo */}
                      <div className="flex items-baseline justify-between pt-1 border-t border-slate-200/70 text-xs">
                        <div>
                          <span className="text-[8.5px] text-slate-400 block font-medium leading-tight">Chi trả định kỳ</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-black text-rose-600">
                              {isNoTerm || d.category === 'type_free' ? 'Linh hoạt' : `-${formatVND(payAmount, isPrivacyMode)}`}
                            </span>
                            {!isNoTerm && d.category !== 'type_free' && (
                              <span className="text-[8.5px] text-slate-400">{freqLabel}</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[8.5px] text-slate-400 block font-medium leading-tight">Kỳ hạn kế tiếp</span>
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[11px] font-bold text-slate-800">{nextDueDateFormatted}</span>
                            {!isNoTerm && d.category !== 'type_free' && d.status !== 'Đã tất toán' && (
                              <span
                                className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                  diffDays === 0
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : diffDays <= 3
                                    ? 'bg-amber-100 text-amber-800 font-bold'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {diffDays === 0 ? 'Hôm nay' : diffDays > 0 ? `Còn ${diffDays}N` : 'Quá hạn'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Dư nợ & Tiến độ trả nợ (nếu có gốc) */}
                      {(d.category === 'type1' || d.category === 'type2' || d.category === 'type_free') && (
                        <div className="pt-1 border-t border-slate-200/70 space-y-0.5">
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-500 font-medium">
                              Dư nợ gốc: <b className="text-rose-600">{formatVND(remainingPrincipal, isPrivacyMode)}</b>
                            </span>
                            <span className="text-emerald-700 font-bold">
                              Đã trả {percentPaid}% ({formatVND(paidPrincipal, isPrivacyMode)})
                            </span>
                          </div>
                          <div className="w-full bg-slate-200/80 rounded-full h-1 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1 rounded-full transition-all duration-500"
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Row 4: Action đóng nhanh (nếu chưa tất toán) */}
                      {d.status !== 'Đã tất toán' && (
                        <div className="pt-1 border-t border-slate-200/70 flex items-center justify-end gap-1.5">
                          {isNoTerm || d.category === 'type_free' ? (
                            <button
                              onClick={() => handlePayCustom(d)}
                              className="px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded text-[9.5px] font-bold transition cursor-pointer"
                            >
                              + Trả bớt tiền
                            </button>
                          ) : (
                            (d.category === 'type1' || d.category === 'type2') && (
                              <button
                                onClick={() => handlePayPeriod(d)}
                                className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[9.5px] font-bold transition cursor-pointer"
                              >
                                ✓ Đóng kỳ này
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. DEDICATED DESKTOP VIEW (>= md) - FULL TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3 text-center w-12">STT</th>
                    <th className="p-3">Hạng Mục</th>
                    <th className="p-3 min-w-[230px]">Kỳ Thanh Toán</th>
                    <th className="p-3 text-right min-w-[210px]">Chi Trả / Kỳ</th>
                    <th className="p-3 text-right min-w-[170px]">Tiến Độ & Dư Nợ</th>
                    <th className="p-3 text-center min-w-[130px]">Trạng Thái</th>
                    <th className="p-3 text-center w-20">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {db.debts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        Chưa có nghĩa vụ tài chính nào.
                      </td>
                    </tr>
                  ) : (
                    db.debts.map((rawD, index) => {
                      const d = repairDebtPeriodicAmount(rawD);
                      const isNoTerm = isNoTermDebt(d);
                      const today = new Date();
                      const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                      const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), d.day || 20);
                      const nextDue =
                        thisMonthDue >= todayDateOnly
                          ? thisMonthDue
                          : new Date(today.getFullYear(), today.getMonth() + 1, d.day || 20);
                      const diffDays = Math.round((nextDue.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24));

                      const shortCatTag: Record<DebtCategory, string> = {
                        type1: isNoTerm ? 'Loại 1 • Không kỳ hạn' : 'Loại 1 • Vay có lãi',
                        type2: isNoTerm ? 'Loại 2 • Không kỳ hạn' : 'Loại 2 • Trả góp',
                        type_free: 'Loại 3 • Vay tự do',
                        type3: 'Loại 4 • Chi phí dài hạn',
                        type4: 'Loại 5 • Sinh hoạt phí',
                      };

                      const totalPrincipal = d.amount || 0;
                      const paidPrincipal = d.status === 'Đã tất toán' ? totalPrincipal : d.paidPrincipal || 0;
                      const remainingPrincipal = Math.max(0, totalPrincipal - paidPrincipal);
                      const percentPaid =
                        totalPrincipal > 0 ? Math.min(100, Math.round((paidPrincipal / totalPrincipal) * 100)) : 0;

                      const nextDueDateFormatted =
                        isNoTerm || d.category === 'type_free' ? 'Linh hoạt' : nextDue.toLocaleDateString('vi-VN');
                      const finalMaturity =
                        !isNoTerm && d.startDate && d.termMonths ? calculateMaturityDate(d.startDate, d.termMonths) : '';

                      const freqLabel =
                        d.frequency === 'annual'
                          ? '/năm'
                          : d.frequency === 'biannual'
                          ? '/6 tháng'
                          : d.frequency === 'quarterly'
                          ? '/quý'
                          : '/tháng';

                      return (
                        <tr
                          key={d.id}
                          className={`hover:bg-slate-50/80 transition ${
                            d.status === 'Đã tất toán' ? 'opacity-60 bg-slate-50/50' : ''
                          }`}
                        >
                          <td className="p-3 text-center font-bold text-slate-400">{index + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 text-xs">{d.name}</div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold border bg-slate-100 text-slate-700">
                                {shortCatTag[d.category] || 'Khác'}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-semibold text-slate-700">
                                {formatVND(totalPrincipal, isPrivacyMode)}
                              </span>
                            </div>
                            {d.note && (
                              <div className="text-[10px] text-slate-400 italic mt-0.5">"{d.note}"</div>
                            )}
                          </td>
                          <td className="p-3 min-w-[230px]">
                            <div className="text-[11px] text-slate-800 flex items-center gap-1 whitespace-nowrap mb-1">
                              <span className="text-slate-400 font-medium">Hạn tiếp:</span>
                              <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                                {nextDueDateFormatted}
                              </span>
                              {!isNoTerm && d.category !== 'type_free' && d.status !== 'Đã tất toán' && (
                                <>
                                  {diffDays >= 0 && diffDays <= 3 && (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-300 ml-1 animate-pulse">
                                      ⚠️ Còn {diffDays} ngày
                                    </span>
                                  )}
                                  {diffDays > 3 && diffDays <= 7 && (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 ml-1">
                                      ⏳ Còn {diffDays} ngày
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right min-w-[210px]">
                            {isNoTerm ? (
                              <div>
                                <span className="font-black text-purple-700 text-xs">Trả linh hoạt</span>
                                <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                                  0% Lãi
                                </span>
                              </div>
                            ) : d.category === 'type1' ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-end space-x-1.5 leading-tight">
                                  <span className="font-black text-emerald-700 text-xs">
                                    {formatVND(d.monthlyBefore, isPrivacyMode)}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{freqLabel}</span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                    ƯĐ {d.promoRate || 0}%
                                  </span>
                                </div>
                                {d.monthlyAfter > 0 && d.monthlyAfter !== d.monthlyBefore && (
                                  <div className="flex items-center justify-end space-x-1.5 leading-tight text-rose-700">
                                    <span className="font-bold text-xs">
                                      {formatVND(d.monthlyAfter, isPrivacyMode)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{freqLabel}</span>
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                      Sau ƯĐ {d.normalRate || 0}%
                                    </span>
                                  </div>
                                )}
                                <div className="text-[9px] text-slate-500 text-right leading-tight">
                                  Gốc: {formatVND(d.termMonths ? Math.round(d.amount / d.termMonths) : 0, isPrivacyMode)} + Lãi: {formatVND(Math.max(0, d.monthlyBefore - (d.termMonths ? Math.round(d.amount / d.termMonths) : 0)), isPrivacyMode)}
                                </div>
                              </div>
                            ) : d.category === 'type2' ? (
                              <div>
                                <span className="font-black text-slate-900 text-xs">
                                  {formatVND(d.monthlyBefore || d.installmentAmount || 0, isPrivacyMode)}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold ml-1">{freqLabel}</span>
                                <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                  0% Lãi
                                </span>
                              </div>
                            ) : d.category === 'type_free' ? (
                              <div>
                                <span className="font-black text-purple-700 text-xs">Trả linh hoạt</span>
                                <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                                  0% Lãi
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-black text-slate-900 text-xs">
                                  {formatVND(d.periodicAmount || d.monthlyBefore || 0, isPrivacyMode)}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold ml-1">{freqLabel}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right min-w-[170px]">
                            {d.category === 'type1' || d.category === 'type2' || d.category === 'type_free' ? (
                              <div>
                                <div className="text-[11px] text-slate-500">
                                  Đã trả:{' '}
                                  <span className="font-bold text-emerald-600">
                                    {formatVND(paidPrincipal, isPrivacyMode)}
                                  </span>
                                  <span className="font-bold text-emerald-700 ml-1">({percentPaid}%)</span>
                                </div>
                                <div className="text-xs mt-0.5">
                                  <span className="text-slate-500">Dư nợ:</span>
                                  <span className="font-black text-rose-600 ml-1">
                                    {formatVND(remainingPrincipal, isPrivacyMode)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Không tính dư nợ</span>
                            )}
                          </td>
                          <td className="p-3 text-center space-y-1 whitespace-nowrap">
                            <div>
                              <button
                                onClick={() => handleToggleSettled(d)}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                  d.status === 'Đã tất toán'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                }`}
                              >
                                {d.status === 'Đã tất toán' ? '✓ Đã tất toán' : 'Chưa tất toán'}
                              </button>
                            </div>
                            {d.status !== 'Đã tất toán' && (
                              <div>
                                {isNoTerm || d.category === 'type_free' ? (
                                  <button
                                    onClick={() => handlePayCustom(d)}
                                    className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded text-[10px] font-bold transition cursor-pointer"
                                  >
                                    Trả bớt
                                  </button>
                                ) : (
                                  (d.category === 'type1' || d.category === 'type2') && (
                                    <button
                                      onClick={() => handlePayPeriod(d)}
                                      className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[10px] font-bold transition cursor-pointer"
                                    >
                                      Đóng kỳ
                                    </button>
                                  )
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleEditDebt(d)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Sửa"
                            >
                              <Pen className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDebtToDelete({ id: d.id, name: d.name })}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* BIỂU ĐỒ BIẾN ĐỘNG 3 DÒNG TIỀN (KÉO XUỐNG DƯỚI CÙNG TAB 2) */}
      <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center">
              <TrendingUp className="w-4 h-4 text-blue-600 mr-2 shrink-0" />
              <span>Biểu Đồ Xu Hướng & Biến Động 3 Dòng Tiền</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              So sánh Tổng thu nhập, Nghĩa vụ chi trả nợ và Dòng tiền ròng khả dụng theo từng kỳ hạn
            </p>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={cashflowRange}
              onChange={(e) => setCashflowRange(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
            >
              <option value="month">Kỳ hạn: Theo Tháng (12T)</option>
              <option value="quarter">Kỳ hạn: Theo Quý</option>
              <option value="halfyear">Kỳ hạn: Nửa Năm (6T)</option>
              <option value="year">Kỳ hạn: 1 Năm</option>
              <option value="3years">Kỳ hạn: 3 Năm</option>
              <option value="5years">Kỳ hạn: 5 Năm</option>
            </select>
          </div>
        </div>

        {/* Chú thích màu trực quan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="font-semibold text-emerald-900">Tổng Thu Nhập:</span>
            </div>
            <span className="font-black text-emerald-700">{formatVND(totalMonthlyInflow, isPrivacyMode)}/th</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 bg-rose-50/80 border border-rose-200 rounded-lg text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
              <span className="font-semibold text-rose-900">Nghĩa Vụ Chi Trả:</span>
            </div>
            <span className="font-black text-rose-700">-{formatVND(totalMonthlyOutflow, isPrivacyMode)}/th</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
              <span className="font-semibold text-blue-900">Dòng Tiền Ròng:</span>
            </div>
            <span className={`font-black ${netMonthlyCashflow >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
              {netMonthlyCashflow >= 0 ? `+${formatVND(netMonthlyCashflow, isPrivacyMode)}` : formatVND(netMonthlyCashflow, isPrivacyMode)}/th
            </span>
          </div>
        </div>

        <div className="h-56 sm:h-72 bg-white pt-1">
          <canvas ref={chartCanvasRef}></canvas>
        </div>
      </div>

      {/* Vietnam Income Benchmark Modal */}
      <BenchmarkModal
        isOpen={showIncomeBenchmarkModal}
        onClose={() => setShowIncomeBenchmarkModal(false)}
        type="income"
        currentValue={totalMonthlyInflow}
        isPrivacyMode={isPrivacyMode}
      />

      {/* Delete Debt Confirmation Modal */}
      <ConfirmModal
        isOpen={!!debtToDelete}
        title="Xác nhận xóa nghĩa vụ nợ/chi phí"
        message={`Bạn có chắc chắn muốn xóa nghĩa vụ "${debtToDelete?.name}"?`}
        subMessage="Dữ liệu dòng tiền và kế hoạch tài chính sẽ được tính toán lại ngay lập tức."
        confirmText="Xóa nghĩa vụ"
        onConfirm={() => {
          if (debtToDelete) {
            onRemoveDebt(debtToDelete.id);
            setDebtToDelete(null);
          }
        }}
        onClose={() => setDebtToDelete(null)}
      />

      {/* Delete Month Income Confirmation Modal */}
      <ConfirmModal
        isOpen={!!monthToDelete}
        title="Xác nhận xóa thu nhập tháng"
        message={`Bạn có chắc muốn xóa bản ghi thu nhập tháng ${monthToDelete}?`}
        subMessage="Biểu đồ dòng tiền và các chỉ số lịch sử sẽ được tính toán lại ngay lập tức."
        confirmText="Xóa bản ghi"
        onConfirm={() => {
          if (monthToDelete) {
            handleDeleteMonthlyRecord(monthToDelete);
          }
        }}
        onClose={() => setMonthToDelete(null)}
      />

      {/* Delete Income Item Confirmation Modal */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title="Xác nhận xóa khoản thu"
        message={`Bạn có chắc muốn xóa khoản thu "${itemToDelete?.title}" (+${formatVND(itemToDelete?.amount || 0)}) ngày ${itemToDelete?.date}?`}
        subMessage="Tổng thu của tháng và biểu đồ dòng tiền sẽ được tính toán lại ngay lập tức."
        confirmText="Xóa khoản thu"
        onConfirm={() => {
          if (itemToDelete) {
            handleDeleteIncomeItem(itemToDelete.id);
          }
        }}
        onClose={() => setItemToDelete(null)}
      />

      {/* Modal Xác nhận Xóa Tháng (Xóa từng tháng hoặc Xóa nhanh nhiều tháng đã tick) */}
      <ConfirmModal
        isOpen={!!monthsToDelete && monthsToDelete.length > 0}
        title={
          monthsToDelete && monthsToDelete.length > 1
            ? `Xác nhận xóa nhanh ${monthsToDelete.length} tháng đã chọn`
            : `Xác nhận xóa Tháng ${monthsToDelete?.[0] ? `${monthsToDelete[0].split('-')[1]}/${monthsToDelete[0].split('-')[0]}` : ''}`
        }
        message={
          monthsToDelete && monthsToDelete.length > 1
            ? `Bạn có chắc muốn xóa toàn bộ ${monthsToDelete.length} tháng đã chọn (${monthsToDelete.map((k) => `Tháng ${k.split('-')[1]}/${k.split('-')[0]}`).join(', ')})? Mọi khoản tiền thu về đã kê trong các tháng này sẽ bị xóa khỏi hệ thống.`
            : `Bạn có chắc muốn xóa dữ liệu của Tháng ${monthsToDelete?.[0] ? `${monthsToDelete[0].split('-')[1]}/${monthsToDelete[0].split('-')[0]}` : ''}? Mọi khoản tiền thu về đã kê trong tháng này sẽ bị xóa.`
        }
        subMessage="Bảng thống kê dòng tiền và biểu đồ sẽ được tính toán lại ngay lập tức."
        confirmText={
          monthsToDelete && monthsToDelete.length > 1
            ? `Xóa ${monthsToDelete.length} tháng đã chọn`
            : 'Xóa tháng này'
        }
        confirmVariant="danger"
        onConfirm={handleConfirmDeleteMonths}
        onClose={() => setMonthsToDelete(null)}
      />
    </div>
  );
};
