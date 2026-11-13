import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPreviousMonthKey,
  getMonthlyCashflowSummary,
  getMonthlyObligationSummary,
  copyObligationsFromNearestMonth,
} from '../src/utils/format';
import { deepMergeDatabaseState } from '../src/utils/dataMergeEngine';
import { normalizeDatabaseState } from '../src/utils/storage';
import { parseRawRowsToMonthlyObligations } from '../src/utils/excelEngine';
import { DatabaseState, Debt, MonthlyObligationRecord } from '../src/types';

function createBaseDb(overrides: Partial<DatabaseState> = {}): DatabaseState {
  return {
    assets: [],
    debts: [],
    goals: [],
    history: [],
    salaryIncome: 0,
    bonusIncome: 0,
    otherIncome: 0,
    monthlyIncomes: [],
    incomeItems: [],
    monthlyObligations: [],
    deletedMonths: [],
    deletedObligationMonths: [],
    lastUpdate: '01/11/2026',
    ...overrides,
  };
}

test('getPreviousMonthKey: handles mid-year and year-boundary transitions (Jan -> Dec of prev year)', () => {
  assert.equal(getPreviousMonthKey('2026-11'), '2026-10');
  assert.equal(getPreviousMonthKey('2026-12'), '2026-11');
  assert.equal(getPreviousMonthKey('2026-01'), '2025-12');
  assert.equal(getPreviousMonthKey('2025-02'), '2025-01');
});

test('getMonthlyCashflowSummary: M-1 with actual obligation data uses actual amount and labels (Thực tế)', () => {
  const db = createBaseDb({
    monthlyIncomes: [
      { id: 'inc-2026-10', month: '2026-10', salary: 55_000_000, bonus: 15_000_000, other: 10_000_000, updatedAt: 1000 },
    ],
    monthlyObligations: [
      {
        id: 'obl-2026-10',
        month: '2026-10',
        status: 'actual',
        payments: [
          { debtId: 1, debtName: 'Vay nhà', plannedAmount: 30_000_000, actualAmount: 32_500_000 },
          { debtId: 2, debtName: 'Sinh hoạt', plannedAmount: 20_000_000, actualAmount: 19_500_000 },
        ],
        updatedAt: 1000,
      },
    ],
  });

  const res = getMonthlyCashflowSummary(db, '2026-11');
  assert.equal(res.targetMonth, '2026-10');
  assert.equal(res.usedMonth, '2026-10');
  assert.equal(res.isFallbackMonth, false);
  assert.equal(res.hasData, true);
  assert.equal(res.inflow, 80_000_000);
  assert.equal(res.outflow, 52_000_000); // 32.5M + 19.5M actual
  assert.equal(res.netCashflow, 28_000_000);
  assert.equal(res.obligationStatus, 'actual');
  assert.equal(res.sourceLabel, 'Số liệu T10/2026 (Thực tế)');
});

test('getMonthlyCashflowSummary: M-1 with planned obligation data uses planned amount and labels (Dự kiến)', () => {
  const db = createBaseDb({
    monthlyIncomes: [
      { id: 'inc-2026-10', month: '2026-10', salary: 60_000_000, bonus: 0, other: 10_000_000, updatedAt: 1000 },
    ],
    monthlyObligations: [
      {
        id: 'obl-2026-10',
        month: '2026-10',
        status: 'planned',
        payments: [
          { debtId: 1, debtName: 'Vay nhà', plannedAmount: 30_000_000 },
          { debtId: 2, debtName: 'Sinh hoạt', plannedAmount: 15_000_000 },
        ],
        updatedAt: 1000,
      },
    ],
  });

  const res = getMonthlyCashflowSummary(db, '2026-11');
  assert.equal(res.usedMonth, '2026-10');
  assert.equal(res.inflow, 70_000_000);
  assert.equal(res.outflow, 45_000_000);
  assert.equal(res.netCashflow, 25_000_000);
  assert.equal(res.obligationStatus, 'planned');
  assert.equal(res.sourceLabel, 'Số liệu T10/2026 (Dự kiến)');
});

test('getMonthlyCashflowSummary: M-1 missing data falls back to nearest earlier month with clear label', () => {
  const db = createBaseDb({
    monthlyIncomes: [
      { id: 'inc-2026-09', month: '2026-09', salary: 50_000_000, bonus: 5_000_000, other: 5_000_000, updatedAt: 1000 },
    ],
    monthlyObligations: [
      {
        id: 'obl-2026-09',
        month: '2026-09',
        status: 'actual',
        payments: [{ debtId: 1, debtName: 'Chi phí T9', plannedAmount: 25_000_000, actualAmount: 24_000_000 }],
        updatedAt: 1000,
      },
    ],
  });

  const res = getMonthlyCashflowSummary(db, '2026-11');
  assert.equal(res.targetMonth, '2026-10');
  assert.equal(res.usedMonth, '2026-09');
  assert.equal(res.isFallbackMonth, true);
  assert.equal(res.hasData, true);
  assert.equal(res.inflow, 60_000_000);
  assert.equal(res.outflow, 24_000_000);
  assert.equal(res.netCashflow, 36_000_000);
  assert.equal(res.sourceLabel, 'Lấy từ T09/2026 (chưa có dữ liệu T10)');
});

test('getMonthlyCashflowSummary: completely empty data returns hasData=false and "Chưa có dữ liệu"', () => {
  const emptyDb = createBaseDb();
  const res = getMonthlyCashflowSummary(emptyDb, '2026-11');
  assert.equal(res.hasData, false);
  assert.equal(res.inflow, 0);
  assert.equal(res.outflow, 0);
  assert.equal(res.netCashflow, 0);
  assert.equal(res.sourceLabel, 'Chưa có dữ liệu');
  assert.equal(res.shortBadgeLabel, 'Chưa có dữ liệu');
});

test('getMonthlyCashflowSummary: prioritizes incomeItems of M-1 over monthlyIncomes of M-1', () => {
  const db = createBaseDb({
    monthlyIncomes: [
      { id: 'inc-2026-10', month: '2026-10', salary: 50_000_000, bonus: 0, other: 0, updatedAt: 1000 },
    ],
    incomeItems: [
      { id: 'it-1', date: '2026-10-05', month: '2026-10', title: 'Lương T10', amount: 65_000_000, category: 'salary', createdAt: 2000 },
      { id: 'it-2', date: '2026-10-15', month: '2026-10', title: 'Thưởng dự án', amount: 25_000_000, category: 'bonus', createdAt: 2000 },
    ],
    monthlyObligations: [
      {
        id: 'obl-2026-10',
        month: '2026-10',
        status: 'actual',
        payments: [{ debtId: 1, debtName: 'Chi phí T10', plannedAmount: 40_000_000, actualAmount: 40_000_000 }],
        updatedAt: 2000,
      },
    ],
  });

  const res = getMonthlyCashflowSummary(db, '2026-11');
  assert.equal(res.inflow, 90_000_000); // 65M + 25M from incomeItems (ignores 50M in monthlyIncomes)
  assert.equal(res.outflow, 40_000_000);
  assert.equal(res.netCashflow, 50_000_000);
});

test('copyObligationsFromNearestMonth: skips settled debts, adds new debts, and switches expired promo loans to monthlyAfter', () => {
  const debts: Debt[] = [
    {
      id: 1,
      category: 'type1',
      name: 'Vay mua nhà BIDV',
      frequency: 'monthly',
      startDate: '2024-10-01',
      amount: 2_400_000_000,
      paidPrincipal: 100_000_000,
      termMonths: 240,
      promoMonths: 24,
      promoEndDate: '2026-10-01', // Expires at 2026-10 -> by 2026-11 promo is expired!
      promoRate: 6.5,
      normalRate: 10.5,
      monthlyBefore: 23_000_000,
      monthlyAfter: 31_000_000,
      status: 'Chưa tất toán',
    },
    {
      id: 2,
      category: 'type2',
      name: 'Trả góp Laptop đã xong',
      frequency: 'monthly',
      startDate: '2025-01-01',
      amount: 36_000_000,
      paidPrincipal: 36_000_000,
      termMonths: 12,
      monthlyBefore: 3_000_000,
      monthlyAfter: 3_000_000,
      status: 'Đã tất toán',
      settledDate: '15/10/2026',
    },
    {
      id: 3,
      category: 'type2',
      name: 'Trả góp iPad mới phát sinh T11',
      frequency: 'monthly',
      startDate: '2026-11-02',
      amount: 24_000_000,
      paidPrincipal: 0,
      termMonths: 12,
      installmentAmount: 2_000_000,
      monthlyBefore: 2_000_000,
      monthlyAfter: 2_000_000,
      status: 'Chưa tất toán',
    },
  ];

  const sourceRecord: MonthlyObligationRecord = {
    id: 'obl-2026-10',
    month: '2026-10',
    status: 'actual',
    payments: [
      { debtId: 1, debtName: 'Vay mua nhà BIDV', category: 'type1', plannedAmount: 23_000_000, actualAmount: 23_000_000 },
      { debtId: 2, debtName: 'Trả góp Laptop đã xong', category: 'type2', plannedAmount: 3_000_000, actualAmount: 3_000_000 },
    ],
    updatedAt: 1000,
  };

  const db = createBaseDb({
    debts,
    monthlyObligations: [sourceRecord],
  });

  const copyResult = copyObligationsFromNearestMonth(db, '2026-11');
  assert.equal(copyResult.sourceMonth, '2026-10');
  assert.equal(copyResult.record.status, 'planned');
  assert.equal(copyResult.skippedSettledCount, 1);
  assert.equal(copyResult.addedNewDebtsCount, 1);
  assert.deepEqual(copyResult.promoExpiredDebts, ['Vay mua nhà BIDV']);

  const paymentIds = copyResult.record.payments.map((p) => p.debtId);
  assert.ok(!paymentIds.includes(2), 'Settled debt (id=2) must be excluded');
  assert.ok(paymentIds.includes(1), 'Active mortgage (id=1) must be included');
  assert.ok(paymentIds.includes(3), 'Newly added debt (id=3) must be included');

  const mortgagePayment = copyResult.record.payments.find((p) => p.debtId === 1)!;
  assert.equal(mortgagePayment.plannedAmount, 31_000_000, 'Promo-expired loan must switch to monthlyAfter');
  assert.equal(mortgagePayment.isPromoExpired, true);
});

test('dataMergeEngine & storage: LWW merge, tombstone deletion, and legacy backward compatibility for monthlyObligations', () => {
  // 1. Legacy data without monthlyObligations
  const legacyRaw = {
    assets: [],
    debts: [
      {
        id: 10,
        category: 'type4',
        name: 'Sinh hoạt phí',
        frequency: 'monthly',
        amount: 15_000_000,
        periodicAmount: 15_000_000,
        monthlyBefore: 15_000_000,
        monthlyAfter: 15_000_000,
        status: 'Chưa tất toán',
      },
    ],
    goals: [],
    history: [],
    salaryIncome: 50_000_000,
    otherIncome: 0,
  };

  const normalizedLegacy = normalizeDatabaseState(legacyRaw);
  assert.ok(Array.isArray(normalizedLegacy.monthlyObligations));
  // Even with empty monthlyObligations, getMonthlyObligationSummary falls back to active debts cleanly
  const fallbackSummary = getMonthlyObligationSummary(normalizedLegacy, '2026-10');
  assert.equal(fallbackSummary.hasData, true);
  assert.equal(fallbackSummary.effectiveTotal, 15_000_000);
  assert.equal(fallbackSummary.status, 'planned');

  // 2. Two-device conflict resolution (LWW) + tombstone deletion
  const baseNow = Date.now();
  const t1000 = baseNow - 30_000;
  const t2500 = baseNow - 15_000;
  const t3000 = baseNow - 5_000;

  const deviceA = createBaseDb({
    monthlyObligations: [
      {
        id: 'obl-2026-09',
        month: '2026-09',
        status: 'planned',
        payments: [{ debtId: 1, debtName: 'Chi T9', plannedAmount: 20_000_000 }],
        updatedAt: t1000,
      },
      {
        id: 'obl-2026-10',
        month: '2026-10',
        status: 'planned',
        payments: [{ debtId: 1, debtName: 'Chi T10 (cũ)', plannedAmount: 20_000_000 }],
        updatedAt: t1000,
      },
    ],
  });

  const deviceB = createBaseDb({
    monthlyObligations: [
      // Device B deleted 2026-09 at t2500
      {
        id: 'obl-2026-09',
        month: '2026-09',
        status: 'planned',
        payments: [],
        updatedAt: t2500,
        deletedAt: t2500,
      },
      // Device B finalized 2026-10 as actual at t3000
      {
        id: 'obl-2026-10',
        month: '2026-10',
        status: 'actual',
        payments: [{ debtId: 1, debtName: 'Chi T10 (đã chốt)', plannedAmount: 20_000_000, actualAmount: 22_000_000 }],
        updatedAt: t3000,
      },
    ],
    deletedObligationMonths: ['2026-09'],
  });

  const merged = deepMergeDatabaseState(deviceA, deviceB);
  assert.ok(merged.monthlyObligations);
  const rec09 = merged.monthlyObligations!.find((m) => m.month === '2026-09');
  assert.ok(rec09?.deletedAt, 'Tombstone on 2026-09 must win because t2500 > t1000');
  assert.ok(merged.deletedObligationMonths?.includes('2026-09'));

  const rec10 = merged.monthlyObligations!.find((m) => m.month === '2026-10');
  assert.equal(rec10?.status, 'actual');
  assert.equal(rec10?.payments[0].actualAmount, 22_000_000);
});

test('Excel Engine: parseRawRowsToMonthlyObligations parses Sheet 5 rows accurately', () => {
  const sampleSheetRows = [
    ['THÁP TÀI SẢN - SỔ NGHĨA VỤ TÀI CHÍNH THEO THÁNG'],
    ['STT', 'Kỳ Tháng (YYYY-MM)', 'Mã Khoản Nợ (ID)', 'Tên Khoản Nghĩa Vụ / Chi Phí', 'Phân Loại', 'Số Tiền Dự Kiến (VNĐ)', 'Số Tiền Thực Tế (VNĐ)', 'Chênh Lệch', 'Trạng Thái Tháng', 'Ghi Chú'],
    [1, '2026-10', 1, 'Vay thế chấp BIDV', 'type1', 35_866_667, 35_866_667, 0, 'Thực tế', 'Đúng hạn'],
    [2, '2026-10', 4, 'Sinh hoạt phí gia đình', 'type4', 15_000_000, 16_200_000, 1_200_000, 'Thực tế', 'Phát sinh tiệc'],
    [3, '2026-11', 1, 'Vay thế chấp BIDV', 'type1', 35_866_667, 35_866_667, 0, 'Dự kiến', ''],
  ];

  const parsed = parseRawRowsToMonthlyObligations(sampleSheetRows);
  assert.equal(parsed.length, 2);

  const oct = parsed.find((r) => r.month === '2026-10')!;
  assert.ok(oct);
  assert.equal(oct.status, 'actual');
  assert.equal(oct.payments.length, 2);
  assert.equal(oct.payments[0].plannedAmount, 35_866_667);
  assert.equal(oct.payments[1].actualAmount, 16_200_000);

  const nov = parsed.find((r) => r.month === '2026-11')!;
  assert.ok(nov);
  assert.equal(nov.status, 'planned');
  assert.equal(nov.payments.length, 1);
});
