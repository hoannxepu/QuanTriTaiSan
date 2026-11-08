import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepMergeDatabaseState } from '../src/utils/dataMergeEngine';
import { DatabaseState, Asset } from '../src/types';

const baseState: DatabaseState = {
  version: 1,
  updated_at: '2026-09-01T10:00:00.000Z',
  assets: [
    {
      id: 1,
      level: '1',
      type: 'cash',
      name: 'Tiền mặt ban đầu',
      amount: 10000000,
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ],
  debts: [],
  goals: [],
  history: [],
  salaryIncome: 20000000,
  otherIncome: 5000000,
  lastUpdate: '2026-09-01T10:00:00.000Z',
};

test('T1: Thêm mới offline trên 2 máy -> sau merge cả 2 máy đều có đủ item', () => {
  const machineA: DatabaseState = {
    ...baseState,
    version: 2,
    updated_at: '2026-09-02T10:00:00.000Z',
    assets: [
      ...baseState.assets,
      {
        id: 2,
        level: '1',
        type: 'saving',
        name: 'Sổ tiết kiệm máy A',
        amount: 50000000,
        updatedAt: '2026-09-02T10:00:00.000Z',
      },
    ],
  };

  const machineB: DatabaseState = {
    ...baseState,
    version: 2,
    updated_at: '2026-09-02T11:00:00.000Z',
    assets: [
      ...baseState.assets,
      {
        id: 3,
        level: '2',
        type: 'stock',
        name: 'HPG máy B',
        amount: 30000000,
        updatedAt: '2026-09-02T11:00:00.000Z',
      },
    ],
  };

  const merged = deepMergeDatabaseState(machineA, machineB);
  assert.equal(merged.assets.length, 3);
  const ids = merged.assets.map((a) => a.id).sort();
  assert.deepEqual(ids, [1, 2, 3]);
});

test('T2: Sửa cùng 1 tài sản trên 2 máy ở thời điểm khác nhau -> item có updatedAt mới hơn thắng', () => {
  const machineA: DatabaseState = {
    ...baseState,
    version: 2,
    assets: [
      {
        id: 1,
        level: '1',
        type: 'cash',
        name: 'Tiền mặt sửa máy A (cũ hơn)',
        amount: 15000000,
        updatedAt: '2026-09-02T08:00:00.000Z',
      },
    ],
  };

  const machineB: DatabaseState = {
    ...baseState,
    version: 2,
    assets: [
      {
        id: 1,
        level: '1',
        type: 'cash',
        name: 'Tiền mặt sửa máy B (mới hơn)',
        amount: 25000000,
        updatedAt: '2026-09-02T12:00:00.000Z',
      },
    ],
  };

  const merged = deepMergeDatabaseState(machineA, machineB);
  assert.equal(merged.assets.length, 1);
  assert.equal(merged.assets[0].name, 'Tiền mặt sửa máy B (mới hơn)');
  assert.equal(merged.assets[0].amount, 25000000);
});

test('T3.1: Xoá sau khi sửa -> bị xoá', () => {
  // Machine B modified at 09:00
  const machineB: DatabaseState = {
    ...baseState,
    assets: [
      {
        id: 1,
        level: '1',
        type: 'cash',
        name: 'Sửa ở máy B lúc 09:00',
        amount: 20000000,
        updatedAt: '2026-09-02T09:00:00.000Z',
      },
    ],
  };

  // Machine A deleted at 10:00
  const machineA: DatabaseState = {
    ...baseState,
    assets: [
      {
        id: 1,
        level: '1',
        type: 'cash',
        name: 'Tiền mặt',
        amount: 10000000,
        updatedAt: '2026-09-01T10:00:00.000Z',
        deletedAt: '2026-09-02T10:00:00.000Z',
      },
    ],
  };

  const merged = deepMergeDatabaseState(machineA, machineB);
  assert.equal(merged.assets.length, 1);
  assert.ok(merged.assets[0].deletedAt, 'Tài sản phải có tombstone deletedAt');
});

test('T3.2: Sửa sau khi xoá (hồi sinh) -> giữ lại bản sửa', () => {
  // Machine A deleted at 08:00
  const machineA: DatabaseState = {
    ...baseState,
    assets: [
      {
        id: 1,
        level: '1',
        type: 'cash',
        name: 'Tiền mặt',
        amount: 10000000,
        deletedAt: '2026-09-02T08:00:00.000Z',
      },
    ],
  };

  // Machine B modified at 11:00 (after deletion)
  const machineB: DatabaseState = {
    ...baseState,
    assets: [
      {
        id: 1,
        level: '1',
        type: 'cash',
        name: 'Hồi sinh và cập nhật mới ở máy B',
        amount: 30000000,
        updatedAt: '2026-09-02T11:00:00.000Z',
      },
    ],
  };

  const merged = deepMergeDatabaseState(machineA, machineB);
  assert.equal(merged.assets.length, 1);
  assert.equal(merged.assets[0].name, 'Hồi sinh và cập nhật mới ở máy B');
  assert.equal(merged.assets[0].deletedAt, undefined);
});

test('T4: Ghi đè rỗng: payload rỗng từ client bị từ chối, không xoá dữ liệu trên server', () => {
  const emptyClientPayload = {} as any;
  const merged1 = deepMergeDatabaseState(baseState, emptyClientPayload);
  assert.equal(merged1.assets.length, 1);
  assert.equal(merged1.assets[0].id, 1);

  const nullClientPayload = null as any;
  const merged2 = deepMergeDatabaseState(baseState, nullClientPayload);
  assert.equal(merged2.assets.length, 1);
  assert.equal(merged2.assets[0].id, 1);
});

test('T5: Giao hoán: merge(A, B) và merge(B, A) phải cho kết quả tương đương', () => {
  const stateA: DatabaseState = {
    version: 3,
    updated_at: '2026-09-02T14:00:00.000Z',
    assets: [
      { id: 1, level: '1', type: 'cash', name: 'Item 1', amount: 100, updatedAt: '2026-09-02T10:00:00.000Z' },
      { id: 2, level: '1', type: 'gold', name: 'Vàng A', amount: 500, updatedAt: '2026-09-02T12:00:00.000Z' },
      { id: 4, level: '2', type: 'stock', name: 'CP A', amount: 300, updatedAt: '2026-09-02T14:00:00.000Z' },
    ],
    debts: [
      {
        id: 101,
        category: 'type1',
        name: 'Vay mua xe',
        frequency: 'monthly',
        amount: 200000000,
        monthlyBefore: 5000000,
        monthlyAfter: 5000000,
        paidPrincipal: 20000000,
        status: 'Chưa tất toán',
        updatedAt: '2026-09-02T08:00:00.000Z',
      },
    ],
    goals: [],
    history: [],
    salaryIncome: 30000000,
    otherIncome: 2000000,
    lastUpdate: '2026-09-02T14:00:00.000Z',
  };

  const stateB: DatabaseState = {
    version: 4,
    updated_at: '2026-09-02T15:00:00.000Z',
    assets: [
      { id: 2, level: '1', type: 'gold', name: 'Vàng B sửa sau', amount: 600, updatedAt: '2026-09-02T13:00:00.000Z' },
      { id: 3, level: '1', type: 'saving', name: 'Tiết kiệm B', amount: 400, updatedAt: '2026-09-02T11:00:00.000Z' },
      { id: 4, level: '2', type: 'stock', name: 'CP A', amount: 300, updatedAt: '2026-09-02T14:00:00.000Z' },
    ],
    debts: [
      {
        id: 101,
        category: 'type1',
        name: 'Vay mua xe (đã tất toán)',
        frequency: 'monthly',
        amount: 200000000,
        monthlyBefore: 5000000,
        monthlyAfter: 5000000,
        paidPrincipal: 200000000,
        status: 'Đã tất toán',
        updatedAt: '2026-09-02T15:00:00.000Z',
      },
    ],
    goals: [],
    history: [],
    salaryIncome: 35000000,
    otherIncome: 3000000,
    lastUpdate: '2026-09-02T15:00:00.000Z',
  };

  const resAB = deepMergeDatabaseState(stateA, stateB);
  const resBA = deepMergeDatabaseState(stateB, stateA);

  assert.deepEqual(resAB.assets, resBA.assets);
  assert.deepEqual(resAB.debts, resBA.debts);
  assert.equal(resAB.salaryIncome, resBA.salaryIncome);
  assert.equal(resAB.otherIncome, resBA.otherIncome);
});
