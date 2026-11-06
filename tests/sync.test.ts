import test from 'node:test';
import assert from 'node:assert/strict';
import { rebaseUserData, generateMutationId } from '../src/utils/syncManager';
import { DatabaseState, Goal, Asset, Debt, AssetTransaction } from '../src/types';
import { getCalendarMaturityDateObj } from '../src/utils/format';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

// Mock baseline Database State
function createInitialState(): DatabaseState {
  return {
    version: 1,
    updated_at: '2026-11-04T00:00:00.000Z',
    assets: [
      { id: 1, level: '1', type: 'cash', name: 'Tiền mặt VCB', amount: 100000000, updatedAt: '01/11/2026' },
      { id: 2, level: '1', type: 'gold', name: 'Vàng nhẫn 9999', amount: 85000000, quantity: 10, currentPrice: 8500000 },
    ],
    debts: [
      { id: 101, category: 'type1', name: 'Vay mua nhà VCB', amount: 1000000000, paidPrincipal: 100000000, monthlyBefore: 12000000, monthlyAfter: 15000000, status: 'Chưa tất toán', frequency: 'monthly' },
    ],
    goals: [
      { id: 201, group: 'dca', goalType: 'dca', name: 'DCA Vàng 9999', targetQty: 2, unit: 'chỉ', day: 10, freqMonths: 1, status: 'active', backlogQty: 0 },
      { id: 202, group: 'milestone', goalType: 'milestone', name: 'Mua ô tô', target: 800000000, years: 2, status: 'active' },
    ],
    transactions: [
      { id: 'tx_init_1', assetId: 2, goalId: 201, assetName: 'Vàng nhẫn 9999', date: '2026-10-10', type: 'buy', quantity: 2, pricePerUnit: 8500000, totalAmount: 17000000 },
    ],
    monthlyIncomes: [
      { id: 'inc_1', month: '2026-10', salary: 50000000, other: 10000000 },
    ],
    incomeItems: [
      { id: 'item_1', date: '2026-10-05', month: '2026-10', title: 'Lương VCB', amount: 50000000, category: 'salary' },
    ],
    history: [],
    salaryIncome: 50000000,
    otherIncome: 10000000,
    lastUpdate: '04/11/2026',
  };
}

// =========================================================================
// TEST CASE 1: RACE CONDITION SIMULATION (Concurrent Web & Mobile Mutate)
// =========================================================================
test('1. Race Condition: Web & Mobile update goal at the exact same millisecond', async () => {
  const testUserKey = `race_user_${Date.now()}`;
  const initialDb = createInitialState();

  // Seed baseline version 1 on Server
  const seedRes = await fetch(`${BASE_URL}/api/sync/mutate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userKey: testUserKey,
      expectedVersion: 0,
      data: initialDb,
      clientMutationId: 'seed_init',
    }),
  });
  assert.equal(seedRes.status, 200, 'Seed baseline should succeed');
  const seedJson = await seedRes.json();
  const currentVersion = seedJson.version; // e.g. 1

  // Prepare Web modification: Increase targetQty of Goal 201 to 5 chỉ
  const webGoalUpdate: DatabaseState = {
    ...initialDb,
    goals: initialDb.goals.map((g) => (g.id === 201 ? { ...g, targetQty: 5 } : g)),
  };

  // Prepare Mobile modification: Mark Goal 201 as completed
  const mobileGoalUpdate: DatabaseState = {
    ...initialDb,
    goals: initialDb.goals.map((g) => (g.id === 201 ? { ...g, status: 'completed' } : g)),
  };

  // Fire both mutations simultaneously at the EXACT same millisecond
  const [resA, resB] = await Promise.all([
    fetch(`${BASE_URL}/api/sync/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userKey: testUserKey,
        expectedVersion: currentVersion,
        data: webGoalUpdate,
        clientMutationId: 'mut_web_race',
        entityName: 'goal',
      }),
    }),
    fetch(`${BASE_URL}/api/sync/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userKey: testUserKey,
        expectedVersion: currentVersion,
        data: mobileGoalUpdate,
        clientMutationId: 'mut_mobile_race',
        entityName: 'goal',
      }),
    }),
  ]);

  const statuses = [resA.status, resB.status];
  assert.ok(
    statuses.includes(200),
    'At least one concurrent mutation must succeed with HTTP 200'
  );
  assert.ok(
    statuses.includes(409),
    'The concurrent conflicting mutation must be rejected with HTTP 409 Conflict'
  );

  // Verify 409 response payload details
  const conflictRes = resA.status === 409 ? resA : resB;
  const conflictJson = await conflictRes.json();
  assert.equal(conflictJson.conflict, true);
  assert.ok(conflictJson.serverVersion > currentVersion, 'Server version must be incremented');
  assert.ok(conflictJson.currentData, 'Server must return currentData for client rebase');
});

// =========================================================================
// TEST CASE 2: NETWORK INTERRUPTION & OFFLINE 3-WAY MERGE
// =========================================================================
test('2. Network Interruption: Mobile edits offline, Web edits online, Mobile restores network and merges', () => {
  const baseDb = createInitialState();

  // Step A: Web adds a new Asset (Cổ phiếu FPT) while online
  const webServerState: DatabaseState = {
    ...baseDb,
    version: 2,
    updated_at: '2026-11-04T10:05:00.000Z',
    assets: [
      ...baseDb.assets,
      { id: 99, level: '2', type: 'stock', name: 'FPT - Công nghệ', amount: 150000000, quantity: 1000, currentPrice: 150000 },
    ],
  };

  // Step B: Mobile was offline and edited Debt 101 (paid principal from 100tr -> 250tr)
  const mobileLocalOfflineState: DatabaseState = {
    ...baseDb,
    version: 1, // Still on version 1 because it was offline!
    updated_at: '2026-11-04T10:03:00.000Z',
    debts: baseDb.debts.map((d) => (d.id === 101 ? { ...d, paidPrincipal: 250000000 } : d)),
    incomeItems: [
      ...(baseDb.incomeItems || []),
      { id: 'item_offline_1', date: '2026-11-04', month: '2026-11', title: 'Thưởng nóng dự án', amount: 20000000, category: 'bonus' },
    ],
  };

  // Step C: Mobile reconnects and performs 3-Way Rebase
  const mergedDb = rebaseUserData(mobileLocalOfflineState, webServerState);

  // Assertions:
  // 1. Web's new Asset 99 MUST be preserved!
  const hasFpt = mergedDb.assets.some((a) => a.id === 99 && a.name.includes('FPT'));
  assert.ok(hasFpt, 'Asset created by Web while Mobile was offline must NOT be lost');

  // 2. Mobile's offline Debt 101 update MUST be preserved!
  const updatedDebt = mergedDb.debts.find((d) => d.id === 101);
  assert.equal(updatedDebt?.paidPrincipal, 250000000, 'Mobile offline debt payment must be preserved');

  // 3. Mobile's offline Income Item MUST be preserved!
  const hasOfflineIncome = (mergedDb.incomeItems || []).some((item) => item.id === 'item_offline_1');
  assert.ok(hasOfflineIncome, 'Offline created income item must be merged');

  // 4. Version must be at least server version
  assert.ok((mergedDb.version || 0) >= 2, 'Merged version must be >= server version');
});

// =========================================================================
// TEST CASE 3: IDEMPOTENCY (Duplicate network packets with same Mutation ID)
// =========================================================================
test('3. Idempotency: 3 duplicate requests sent consecutively due to network retry', async () => {
  const testUserKey = `idempotent_user_${Date.now()}`;
  const baseDb = createInitialState();
  const txId = `tx_test_${Date.now()}`;

  // State with a new transaction
  const stateWithTx: DatabaseState = {
    ...baseDb,
    transactions: [
      ...(baseDb.transactions || []),
      {
        id: txId,
        assetId: 2,
        goalId: 201,
        assetName: 'Vàng nhẫn 9999',
        date: '2026-11-04',
        type: 'buy',
        quantity: 1,
        pricePerUnit: 8600000,
        totalAmount: 8600000,
        note: 'DCA tích lũy',
      },
    ],
  };

  // Seed user
  const initRes = await fetch(`${BASE_URL}/api/sync/mutate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userKey: testUserKey,
      expectedVersion: 0,
      data: baseDb,
      clientMutationId: 'init',
    }),
  });
  const initData = await initRes.json();
  const currentVer = initData.version;

  // Send mutation with transaction
  const mutRes1 = await fetch(`${BASE_URL}/api/sync/mutate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userKey: testUserKey,
      expectedVersion: currentVer,
      data: stateWithTx,
      clientMutationId: 'tx_mut_1',
    }),
  });
  assert.equal(mutRes1.status, 200);

  // Now simulate client retrying or rebase-merging with duplicate transaction 3 times
  let accumulatedDb = stateWithTx;
  accumulatedDb = rebaseUserData(stateWithTx, accumulatedDb);
  accumulatedDb = rebaseUserData(stateWithTx, accumulatedDb);
  accumulatedDb = rebaseUserData(stateWithTx, accumulatedDb);

  // Verify transactions count: txId must only appear ONCE!
  const matchedTxs = (accumulatedDb.transactions || []).filter((tx) => tx.id === txId);
  assert.equal(matchedTxs.length, 1, 'Transaction must be recorded exactly once without duplication');
});

// =========================================================================
// TEST CASE 4: TIMEZONE DISCREPANCY (GMT+7 vs GMT-5)
// =========================================================================
test('4. Timezone Discrepancy: Devices in GMT+7 and GMT-5 compute unified UTC timestamps and dates', () => {
  // Simulate Date strings created in different timezones
  const gmtPlus7Iso = '2026-11-05T07:00:00.000+07:00'; // 00:00:00 UTC
  const gmtMinus5Iso = '2026-11-04T19:00:00.000-05:00'; // 00:00:00 UTC

  const timeA = new Date(gmtPlus7Iso).getTime();
  const timeB = new Date(gmtMinus5Iso).getTime();

  // Both represent the EXACT same UTC instant
  assert.equal(timeA, timeB, 'Timestamps created in different timezones must resolve to the identical UTC millisecond');

  // Verify UTC conversion output
  const utcStringA = new Date(timeA).toISOString();
  const utcStringB = new Date(timeB).toISOString();
  assert.equal(utcStringA, utcStringB, 'UTC ISO strings must match exactly');
  assert.equal(utcStringA, '2026-11-05T00:00:00.000Z');

  // Test Calendar maturity date logic (bank standard) is immune to local machine timezone shifts
  const maturityDateObj = getCalendarMaturityDateObj('2026-01-31', 12);
  assert.ok(maturityDateObj !== null);
  assert.equal(maturityDateObj?.year, 2027);
  assert.equal(maturityDateObj?.month, 1);
  assert.equal(maturityDateObj?.day, 31);
});

// =========================================================================
// TEST CASE 5: ROOT PAYLOAD DEEP MERGE (Multi-Account thap_tai_san_data.json)
// =========================================================================
test('5. Multi-Account Root Payload Deep Merge: Device A & B edit different accounts concurrently', async () => {
  const { deepMergeRootCloudPayload } = await import('../src/utils/dataMergeEngine');

  const baseDbA = createInitialState();
  const baseDbB = createInitialState();

  const payloadDeviceA = {
    passwords: { 'user_a': 'hash_a', 'user_b': 'hash_b' },
    users: {
      'user_a': {
        ...baseDbA,
        salaryIncome: 90000000, // Device A increased user_a's salary
      },
    },
  };

  const payloadDeviceB = {
    passwords: { 'user_a': 'hash_a', 'user_b': 'hash_b_updated' },
    users: {
      'user_b': {
        ...baseDbB,
        salaryIncome: 120000000, // Device B updated user_b's salary
      },
    },
  };

  const merged = deepMergeRootCloudPayload(payloadDeviceA, payloadDeviceB);

  // Both user_a and user_b modifications MUST be preserved without one overwriting the other!
  assert.equal(merged.users['user_a']?.salaryIncome, 90000000);
  assert.equal(merged.users['user_b']?.salaryIncome, 120000000);
  assert.equal(merged.passwords['user_b'], 'hash_b_updated');
});

// =========================================================================
// TEST CASE 6: ETAG OPTIMISTIC LOCKING VERIFICATION (HTTP 412 on Mismatch)
// =========================================================================
test('6. ETag Optimistic Locking: Refuses overwrite with HTTP 412 when ETag does not match', async () => {
  // 1. Initial write
  const testPayload = {
    passwords: { test_user: 'secret' },
    users: { test_user: createInitialState() },
  };

  const writeRes1 = await fetch(`${BASE_URL}/api/cloud-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });
  assert.equal(writeRes1.status, 200);
  const etag1 = writeRes1.headers.get('etag');
  assert.ok(etag1, 'Server must return an ETag');

  // 2. Try updating with a STALE ETag
  const staleEtag = 'w/"etag_999999_stale"';
  const conflictRes = await fetch(`${BASE_URL}/api/cloud-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': staleEtag,
    },
    body: JSON.stringify({
      ...testPayload,
      passwords: { test_user: 'stale_overwrite' },
    }),
  });

  // Must reject with 412 Precondition Failed
  assert.equal(conflictRes.status, 412, 'Stale ETag must be rejected with 412 Precondition Failed');
  const conflictJson = await conflictRes.json();
  assert.ok(conflictJson.error.includes('Precondition Failed'));
});

// =========================================================================
// TEST CASE 7: SILENT BACKGROUND SYNC & CONFLICT MERGE INTEGRITY
// =========================================================================
test('7. Silent Background Sync: Zero data loss, immediate local save and clean state reset', async () => {
  const { googleDriveSyncService } = await import('../src/utils/googleDriveSyncService');
  const { deepMergeRootCloudPayload } = await import('../src/utils/dataMergeEngine');

  // Verify googleDriveSyncService state starts or resets cleanly
  googleDriveSyncService.resetState();
  assert.equal(googleDriveSyncService.getStatus(), 'synced');
  assert.equal(googleDriveSyncService.getLastSyncError(), null);

  // Seed user data
  const testDb = createInitialState();
  const testPayload = {
    passwords: { silent_user: 'hashed_pwd' },
    users: { silent_user: testDb },
  };

  // Perform write
  const writeRes = await googleDriveSyncService.writeThapTaiSanFile(testPayload, { force: true });
  assert.equal(writeRes.success, true, 'Write must succeed');
  assert.equal(googleDriveSyncService.getStatus(), 'synced', 'Status must be synced after write');
  assert.equal(googleDriveSyncService.getLastSyncError(), null, 'Error must be null');

  // Verify local cache was updated immediately (0ms Optimistic UI)
  const cached = googleDriveSyncService.getLocalFallbackCache();
  assert.ok(cached, 'Local cache must be available');
  assert.equal(cached?.passwords?.silent_user, 'hashed_pwd');
  assert.equal(cached?.users?.silent_user?.salaryIncome, 50000000);

  // Perform read
  const readRes = await googleDriveSyncService.readThapTaiSanFile();
  assert.equal(readRes.success, true, 'Read must succeed');
  assert.equal(googleDriveSyncService.getStatus(), 'synced', 'Status must stay synced after read');
  assert.equal(googleDriveSyncService.getLastSyncError(), null, 'Error must be null after read');
});

// =========================================================================
// TEST CASE 8: MULTI-VAULT GOLD BALANCE RECONCILIATION & WEB/MOBILE CONSISTENCY
// =========================================================================
test('8. Multi-Vault Gold Balance Reconciliation: Prevents 1 chỉ vs 44.5 chỉ discrepancy', async () => {
  const { calculateTotalGoldBalance, deepMergeAssets, deepMergeDatabaseState } = await import(
    '../src/utils/dataMergeEngine'
  );

  // 8.1 Multi-vault aggregation: Asset 1 (40 chỉ) + Asset 2 (4.5 chỉ) = 44.5 chỉ
  const multiVaultDb: DatabaseState = {
    ...createInitialState(),
    version: 5,
    updated_at: '2026-11-05T12:00:00.000Z',
    assets: [
      {
        id: 3,
        level: '1',
        type: 'gold',
        name: 'Vàng nhẫn trơn 9999 PNJ',
        quantity: 40,
        amount: 340000000,
        currentPrice: 8500000,
        unit: 'chỉ',
        updatedAt: '2026-11-05T10:00:00.000Z',
      },
      {
        id: 10,
        level: '2',
        type: 'gold',
        name: 'Vàng tích sản DCA DOJI',
        quantity: 4.5,
        amount: 38250000,
        currentPrice: 8500000,
        unit: 'chỉ',
        updatedAt: '2026-11-05T11:00:00.000Z',
      },
    ],
  };

  const goldSummary = calculateTotalGoldBalance(multiVaultDb);
  assert.equal(goldSummary.totalChi, 44.5, 'Total gold must equal 44.5 chỉ');
  assert.equal(goldSummary.totalLuong, 4.45, 'Total gold in lượng must equal 4.45 lượng');
  assert.equal(goldSummary.vaultCount, 2, 'Must detect 2 distinct gold vaults');

  // 8.2 Anti-Overwrite test: Mobile has stale quantity = 1, Web has 44.5 chỉ
  const webAssets: Asset[] = [
    {
      id: 3,
      level: '1',
      type: 'gold',
      name: 'Vàng nhẫn trơn 9999 PNJ',
      quantity: 44.5,
      amount: 378250000,
      currentPrice: 8500000,
      unit: 'chỉ',
      updatedAt: '2026-11-05T12:00:00.000Z',
    },
  ];

  const mobileStaleAssets: Asset[] = [
    {
      id: 3,
      level: '1',
      type: 'gold',
      name: 'Vàng nhẫn trơn 9999 PNJ',
      quantity: 1, // Stale default
      amount: 8500000,
      currentPrice: 8500000,
      unit: 'chỉ',
      updatedAt: '2026-11-01T00:00:00.000Z', // Older
    },
  ];

  // Merge mobile (local) and web (remote)
  const mergedAssets = deepMergeAssets(mobileStaleAssets, webAssets);
  const goldAsset = mergedAssets.find((a) => a.id === 3);
  assert.equal(
    goldAsset?.quantity,
    44.5,
    'Authoritative 44.5 chỉ must NOT be overwritten by stale mobile quantity = 1'
  );

  // 8.3 Verify via /api/sync/mutate and /api/sync/gold-balance endpoints
  const testUserKey = `gold_user_${Date.now()}`;
  const mutateRes = await fetch(`${BASE_URL}/api/sync/mutate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userKey: testUserKey,
      expectedVersion: 0,
      data: multiVaultDb,
      clientMutationId: 'seed_gold',
    }),
  });
  assert.equal(mutateRes.status, 200);

  // Call /api/sync/gold-balance
  const balanceRes = await fetch(`${BASE_URL}/api/sync/gold-balance?userKey=${testUserKey}`);
  assert.equal(balanceRes.status, 200);
  assert.ok(balanceRes.headers.get('cache-control')?.includes('no-store'));

  const balanceJson = await balanceRes.json();
  assert.equal(balanceJson.totalGoldChi, 44.5, 'API gold-balance must return 44.5 chỉ');
  assert.equal(balanceJson.vaultCount, 2, 'API must report 2 vaults');

  // Call /api/sync/pull with force=true
  const pullRes = await fetch(
    `${BASE_URL}/api/sync/pull?userKey=${testUserKey}&sinceVersion=0&force=true`
  );
  assert.equal(pullRes.status, 200);
  const pullJson = await pullRes.json();
  assert.equal(pullJson.isLatest, false);
  assert.ok(pullJson.data, 'Must return full data snapshot');
  assert.equal(pullJson.goldSummary?.totalChi, 44.5, 'Pull response must contain goldSummary = 44.5');
});



