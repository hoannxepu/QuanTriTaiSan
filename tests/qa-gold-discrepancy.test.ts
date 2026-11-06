import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseState } from '../src/types';
import { calculateTotalGoldBalance, deepMergeAssets } from '../src/utils/dataMergeEngine';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

function createMultiVaultGoldState(): DatabaseState {
  return {
    version: 10,
    updated_at: '2026-11-05T20:00:00.000Z',
    assets: [
      {
        id: 1,
        level: '1',
        type: 'cash',
        name: 'Tiền mặt VCB',
        amount: 50000000,
        updatedAt: '2026-11-05T10:00:00.000Z',
      },
      {
        id: 3,
        level: '1',
        type: 'gold',
        name: 'Vàng nhẫn trơn 9999 PNJ (Kho Phòng Thân)',
        quantity: 40, // 40 chỉ
        amount: 340000000,
        currentPrice: 8500000,
        unit: 'chỉ',
        updatedAt: '2026-11-05T19:00:00.000Z',
      },
      {
        id: 15,
        level: '2',
        type: 'gold',
        name: 'Vàng tích sản DCA DOJI (Kho Tăng Trưởng)',
        quantity: 4.5, // 4.5 chỉ
        amount: 38250000,
        currentPrice: 8500000,
        unit: 'chỉ',
        updatedAt: '2026-11-05T19:30:00.000Z',
      },
    ],
    debts: [],
    goals: [
      {
        id: 201,
        group: 'dca',
        goalType: 'dca',
        assetType: 'gold',
        linkedAssetId: 15,
        name: 'Vàng tích sản DCA DOJI',
        targetQty: 1, // Định mức mỗi kỳ là 1 chỉ (nguồn gốc nhầm lẫn nếu query nhầm vào goal targetQty!)
        unit: 'chỉ',
        day: 10,
        freqMonths: 1,
        totalBought: 4.5,
        status: 'active',
      },
    ],
    transactions: [
      {
        id: 'tx_gold_1',
        assetId: 3,
        assetName: 'Vàng nhẫn trơn 9999 PNJ',
        date: '2026-10-01',
        type: 'buy',
        quantity: 40,
        pricePerUnit: 8500000,
        totalAmount: 340000000,
      },
      {
        id: 'tx_gold_2',
        assetId: 15,
        goalId: 201,
        assetName: 'Vàng tích sản DCA DOJI',
        date: '2026-11-01',
        type: 'buy',
        quantity: 4.5,
        pricePerUnit: 8500000,
        totalAmount: 38250000,
      },
    ],
    history: [],
    salaryIncome: 60000000,
    otherIncome: 10000000,
    lastUpdate: '05/11/2026',
  };
}

// =========================================================================
// QA TEST 1: WEB VS MOBILE HEADERS PAYLOAD COMPARISON (PARITY CHECK)
// =========================================================================
test('QA-01: API parity check between Desktop Chrome Web and Mobile App Headers', async () => {
  const userKey = `qa_parity_${Date.now()}`;
  const initialDb = createMultiVaultGoldState();

  // 1. Seed user data with 44.5 chỉ gold
  const seedRes = await fetch(`${BASE_URL}/api/sync/mutate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userKey,
      expectedVersion: 0,
      data: initialDb,
      clientMutationId: 'qa_seed_init',
    }),
  });
  assert.equal(seedRes.status, 200, 'Must seed user state successfully');

  // 2. Client Web: Desktop Chrome
  const webHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
  };

  // 3. Client Mobile: Native iOS / Android OkHttp Client
  const mobileHeaders = {
    'User-Agent': 'ThapTaiSanMobile/2.4.0 (iPhone; iOS 17.4; Scale/3.00)',
    Accept: 'application/json',
    'X-Client-Platform': 'iOS',
    'X-App-Version': '2.4.0',
  };

  // 4. Send parallel requests to /api/sync/pull
  const [webPullRes, mobilePullRes] = await Promise.all([
    fetch(`${BASE_URL}/api/sync/pull?userKey=${userKey}&sinceVersion=0&force=true`, {
      headers: webHeaders,
    }),
    fetch(`${BASE_URL}/api/sync/pull?userKey=${userKey}&sinceVersion=0&force=true`, {
      headers: mobileHeaders,
    }),
  ]);

  assert.equal(webPullRes.status, 200);
  assert.equal(mobilePullRes.status, 200);

  const webJson = await webPullRes.json();
  const mobileJson = await mobilePullRes.json();

  // Assert exact data equivalence
  assert.deepEqual(
    webJson.goldSummary,
    mobileJson.goldSummary,
    'Gold summary must be strictly identical between Web and Mobile'
  );
  assert.equal(webJson.goldSummary.totalChi, 44.5, 'Web gold total must be 44.5 chỉ');
  assert.equal(mobileJson.goldSummary.totalChi, 44.5, 'Mobile gold total must be 44.5 chỉ');
  assert.equal(mobileJson.goldSummary.vaultCount, 2, 'Mobile must pull all 2 vaults, not just 1');
});

// =========================================================================
// QA TEST 2: MULTI-IP / MULTI-PROXY CDN EDGE CACHE RESILIENCE
// =========================================================================
test('QA-02: Multi-Proxy / Multi-Region Edge Caching Data Consistency', async () => {
  const userKey = `qa_proxy_${Date.now()}`;
  const initialDb = createMultiVaultGoldState();

  await fetch(`${BASE_URL}/api/sync/mutate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userKey,
      expectedVersion: 0,
      data: initialDb,
      clientMutationId: 'qa_proxy_seed',
    }),
  });

  // Simulated Proxy IPs from different regions & telco ISPs
  const proxyLocations = [
    { name: 'Hanoi_VNPT', ip: '14.238.10.25' },
    { name: 'HCMC_Viettel', ip: '115.78.220.12' },
    { name: 'DaNang_FPT', ip: '118.69.180.45' },
    { name: 'Singapore_Edge', ip: '13.229.80.100' },
    { name: 'Tokyo_Cloudflare', ip: '172.68.25.10' },
  ];

  // Fire requests simultaneously through distinct simulated CDN Edge/Proxy IPs
  const edgeRequests = proxyLocations.map(async (loc) => {
    const res = await fetch(`${BASE_URL}/api/sync/gold-balance?userKey=${userKey}&t=${Date.now()}`, {
      headers: {
        'X-Forwarded-For': loc.ip,
        'CF-Connecting-IP': loc.ip,
        'True-Client-IP': loc.ip,
        'User-Agent': `MobileClient_${loc.name}`,
      },
    });

    assert.equal(res.status, 200);
    const cc = res.headers.get('cache-control') || '';
    assert.ok(
      cc.includes('no-store') || cc.includes('no-cache'),
      `Edge node ${loc.name} must return no-store/no-cache headers`
    );

    const json = await res.json();
    return { location: loc.name, ...json };
  });

  const results = await Promise.all(edgeRequests);

  // Verify all 5 simulated regional edges returned identical 44.5 chỉ
  for (const r of results) {
    assert.equal(
      r.totalGoldChi,
      44.5,
      `Location ${r.location} returned ${r.totalGoldChi} instead of 44.5 chỉ`
    );
    assert.equal(r.vaultCount, 2, `Location ${r.location} missed gold vaults`);
  }
});

// =========================================================================
// QA TEST 3: REPRODUCING & PREVENTING SINGLE-VAULT LIMIT / TARGET_QTY CONFUSION
// =========================================================================
test('QA-03: Multi-Vault vs Single-Vault Query - Verifies aggregation avoids 1 chỉ limit trap', () => {
  const db = createMultiVaultGoldState();

  // Root Cause Simulation:
  // If a mobile engineer wrote `db.goals.find(g => g.assetType === 'gold').targetQty`:
  const flawedMobileSingleQuery = db.goals.find((g) => g.assetType === 'gold')?.targetQty || 0;
  assert.equal(
    flawedMobileSingleQuery,
    1,
    'Simulates flawed query picking DCA target definition (1 chỉ) instead of total balance'
  );

  // Production Engine Fix:
  // Must sum all gold assets across all vaults:
  const canonicalSummary = calculateTotalGoldBalance(db);
  assert.equal(
    canonicalSummary.totalChi,
    44.5,
    'Engine must accurately aggregate across all vaults to 44.5 chỉ'
  );
  assert.equal(
    canonicalSummary.totalLuong,
    4.45,
    'Engine must accurately convert to 4.45 lượng'
  );
});
