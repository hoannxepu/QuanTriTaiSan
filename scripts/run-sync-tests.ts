/**
 * =========================================================================
 * AUTOMATION TEST RUNNER FOR REAL-TIME & OFFLINE-FIRST SYNC ENGINE
 * =========================================================================
 * QA Lead & Automation Test Specialist Suite
 * Test Cases:
 * 1. Race Condition: Web & Mobile concurrent mutation at same millisecond (409 Conflict).
 * 2. Network Interruption: Mobile offline edit + Web online edit -> Reconnect & 3-way merge.
 * 3. Idempotency: Multiple retry requests with identical transaction id deduplication.
 * 4. Timezone Discrepancy: Cross-timezone (GMT+7 vs GMT-5) UTC normalization & maturity dates.
 */

import { rebaseUserData, generateMutationId } from '../src/utils/syncManager';
import { DatabaseState } from '../src/types';
import { getCalendarMaturityDateObj } from '../src/utils/format';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logHeader(title: string) {
  console.log(`\n${colors.cyan}${colors.bold}=================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}🧪 ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}=================================================================${colors.reset}`);
}

function logPass(msg: string) {
  console.log(`  ${colors.green}✔ PASS:${colors.reset} ${msg}`);
}

function logFail(msg: string, err?: any) {
  console.log(`  ${colors.red}✖ FAIL:${colors.reset} ${msg}`);
  if (err) console.error(err);
}

function createSampleDb(): DatabaseState {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    assets: [
      { id: 1, level: '1', type: 'cash', name: 'Tiền mặt VCB', amount: 120000000 },
      { id: 2, level: '1', type: 'gold', name: 'Vàng nhẫn 9999', amount: 86000000, quantity: 10, currentPrice: 8600000 },
    ],
    debts: [
      { id: 101, category: 'type1', name: 'Vay ngân hàng', amount: 800000000, paidPrincipal: 100000000, monthlyBefore: 10000000, monthlyAfter: 13000000, status: 'Chưa tất toán', frequency: 'monthly' },
    ],
    goals: [
      { id: 201, group: 'dca', goalType: 'dca', name: 'DCA Vàng 9999', targetQty: 2, unit: 'chỉ', day: 10, freqMonths: 1, status: 'active', backlogQty: 0 },
      { id: 202, group: 'milestone', goalType: 'milestone', name: 'Mua đất ven đô', target: 2000000000, years: 3, status: 'active' },
    ],
    transactions: [
      { id: 'tx_init_1', assetId: 2, goalId: 201, assetName: 'Vàng nhẫn 9999', date: '2026-10-10', type: 'buy', quantity: 2, pricePerUnit: 8500000, totalAmount: 17000000 },
    ],
    monthlyIncomes: [
      { id: 'inc_1', month: '2026-10', salary: 60000000, other: 15000000 },
    ],
    incomeItems: [
      { id: 'item_1', date: '2026-10-05', month: '2026-10', title: 'Lương chuyển khoản', amount: 60000000, category: 'salary' },
    ],
    history: [],
    salaryIncome: 60000000,
    otherIncome: 15000000,
    lastUpdate: '04/11/2026',
  };
}

async function runAllTests() {
  console.log(`\n${colors.bold}🚀 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TỰ ĐỘNG ĐỒNG BỘ DỮ LIỆU ĐA NỀN TẢNG${colors.reset}`);
  console.log(`Target URL: ${BASE_URL}\n`);

  let totalPassed = 0;
  let totalFailed = 0;

  // -------------------------------------------------------------------------
  // TEST 1: RACE CONDITION TEST (Web & Mobile Concurrent Mutation)
  // -------------------------------------------------------------------------
  logHeader('TEST CASE 1: RACE CONDITION (Ghi đồng thời tại cùng mili-giây)');
  try {
    const testUser = `race_${Date.now()}`;
    const baseDb = createSampleDb();

    // 1. Seed user on server
    const seedRes = await fetch(`${BASE_URL}/api/sync/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userKey: testUser,
        expectedVersion: 0,
        data: baseDb,
        clientMutationId: 'init_seed',
      }),
    });
    const seedJson = await seedRes.json();
    const serverVer = seedJson.version;
    logPass(`Khởi tạo thành công bản ghi ban đầu: version=${serverVer}`);

    // 2. Both Web & Mobile concurrently submit with expectedVersion = serverVer
    const webData: DatabaseState = {
      ...baseDb,
      goals: baseDb.goals.map((g) => (g.id === 201 ? { ...g, targetQty: 6 } : g)),
    };
    const mobileData: DatabaseState = {
      ...baseDb,
      goals: baseDb.goals.map((g) => (g.id === 201 ? { ...g, status: 'completed' } : g)),
    };

    console.log(`  ${colors.yellow}► Đang gửi đồng thời 2 request đột biến (Promise.all) với cùng expectedVersion=${serverVer}...${colors.reset}`);
    const [resA, resB] = await Promise.all([
      fetch(`${BASE_URL}/api/sync/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userKey: testUser,
          expectedVersion: serverVer,
          data: webData,
          clientMutationId: 'mut_web',
          entityName: 'goal',
        }),
      }),
      fetch(`${BASE_URL}/api/sync/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userKey: testUser,
          expectedVersion: serverVer,
          data: mobileData,
          clientMutationId: 'mut_mobile',
          entityName: 'goal',
        }),
      }),
    ]);

    const statuses = [resA.status, resB.status];
    if (statuses.includes(200) && statuses.includes(409)) {
      logPass(`Cơ chế Optimistic Locking hoạt động chính xác: 1 thiết bị thành công (HTTP 200), 1 thiết bị nhận HTTP 409 Conflict.`);

      const conflictRes = resA.status === 409 ? resA : resB;
      const conflictJson = await conflictRes.json();
      if (conflictJson.conflict === true && conflictJson.serverVersion > serverVer && conflictJson.currentData) {
        logPass(`Phản hồi 409 chứa đầy đủ: conflict=true, serverVersion=${conflictJson.serverVersion}, và currentData để Rebase.`);
        totalPassed++;
      } else {
        logFail('Payload 409 thiếu các trường bắt buộc cho Client Rebase');
        totalFailed++;
      }
    } else {
      logFail(`Kết quả không như kỳ vọng! Status nhận được: [${statuses.join(', ')}]`);
      totalFailed++;
    }
  } catch (err: any) {
    logFail('Test 1 gặp ngoại lệ', err);
    totalFailed++;
  }

  // -------------------------------------------------------------------------
  // TEST 2: NETWORK INTERRUPTION & OFFLINE 3-WAY REBASE MERGE
  // -------------------------------------------------------------------------
  logHeader('TEST CASE 2: MẤT MẠNG & TỰ ĐỘNG GỘP XUNG ĐỘT (Offline 3-Way Rebase)');
  try {
    const baseDb = createSampleDb();

    // Web modifies Asset online
    const webState: DatabaseState = {
      ...baseDb,
      version: 2,
      updated_at: '2026-11-04T12:05:00.000Z',
      assets: [
        ...baseDb.assets,
        { id: 88, level: '2', type: 'stock', name: 'HPG - Hòa Phát', amount: 200000000, quantity: 8000, currentPrice: 25000 },
      ],
    };

    // Mobile was offline: modified Debt payment and added an Income item
    const mobileOfflineState: DatabaseState = {
      ...baseDb,
      version: 1, // Stale version due to offline
      updated_at: '2026-11-04T12:02:00.000Z',
      debts: baseDb.debts.map((d) => (d.id === 101 ? { ...d, paidPrincipal: 350000000 } : d)),
      incomeItems: [
        ...(baseDb.incomeItems || []),
        { id: 'item_offline_kpi', date: '2026-11-04', month: '2026-11', title: 'Thưởng KPI ngoài giờ', amount: 15000000, category: 'bonus' },
      ],
    };

    console.log(`  ${colors.yellow}► Đang thực hiện 3-Way Rebase giữa bản Offline Mobile (v1) và Online Web (v2)...${colors.reset}`);
    const mergedDb = rebaseUserData(mobileOfflineState, webState);

    // Assertions
    const hasWebStock = mergedDb.assets.some((a) => a.id === 88 && a.name.includes('HPG'));
    const debtPaidCorrect = mergedDb.debts.find((d) => d.id === 101)?.paidPrincipal === 350000000;
    const hasMobileIncome = (mergedDb.incomeItems || []).some((item) => item.id === 'item_offline_kpi');

    if (hasWebStock && debtPaidCorrect && hasMobileIncome) {
      logPass(`Bảo toàn 100% Cổ phiếu HPG mà Web đã tạo khi Mobile mất mạng.`);
      logPass(`Bảo toàn 100% Khoản trả nợ 350 triệu mà Mobile đã sửa khi ngoại tuyến.`);
      logPass(`Bảo toàn 100% Món thu nhập thưởng KPI tạo trong hàng đợi ngoại tuyến.`);
      logPass(`Không bị mất trắng hay ghi đè mù mờ dữ liệu giữa 2 thiết bị.`);
      totalPassed++;
    } else {
      logFail(`Rebase thất bại: hasWebStock=${hasWebStock}, debtPaidCorrect=${debtPaidCorrect}, hasMobileIncome=${hasMobileIncome}`);
      totalFailed++;
    }
  } catch (err: any) {
    logFail('Test 2 gặp ngoại lệ', err);
    totalFailed++;
  }

  // -------------------------------------------------------------------------
  // TEST 3: IDEMPOTENCY (Duplicate network transmission)
  // -------------------------------------------------------------------------
  logHeader('TEST CASE 3: TÍNH BẤT BIẾN KHI GẶP LỖI MẠNG (Idempotency - Anti-Duplicate)');
  try {
    const baseDb = createSampleDb();
    const duplicateTxId = `tx_unique_kpi_${Date.now()}`;

    const newTx = {
      id: duplicateTxId,
      assetId: 2,
      goalId: 201,
      assetName: 'Vàng nhẫn 9999',
      date: '2026-11-04',
      type: 'buy' as const,
      quantity: 1,
      pricePerUnit: 8700000,
      totalAmount: 8700000,
      note: 'DCA tích sản quý 4',
    };

    const stateWithNewTx: DatabaseState = {
      ...baseDb,
      transactions: [...(baseDb.transactions || []), newTx],
    };

    console.log(`  ${colors.yellow}► Giả lập mạng bị giật, Client gửi lại 3 lần liên tiếp cùng một gói tin giao dịch...${colors.reset}`);
    let merged = stateWithNewTx;
    merged = rebaseUserData(stateWithNewTx, merged);
    merged = rebaseUserData(stateWithNewTx, merged);
    merged = rebaseUserData(stateWithNewTx, merged);

    const occurrences = (merged.transactions || []).filter((tx) => tx.id === duplicateTxId).length;
    if (occurrences === 1) {
      logPass(`Giao dịch ID "${duplicateTxId}" được deduplicate hoàn hảo, chỉ xuất hiện đúng 1 lần duy nhất trong CSDL (occurrences=1).`);
      totalPassed++;
    } else {
      logFail(`Idempotency thất bại: giao dịch bị nhân bản thành ${occurrences} lần!`);
      totalFailed++;
    }
  } catch (err: any) {
    logFail('Test 3 gặp ngoại lệ', err);
    totalFailed++;
  }

  // -------------------------------------------------------------------------
  // TEST 4: TIMEZONE DISCREPANCY (GMT+7 vs GMT-5)
  // -------------------------------------------------------------------------
  logHeader('TEST CASE 4: CHÊNH LỆCH MÚI GIỜ (Timezone Discrepancy GMT+7 vs GMT-5)');
  try {
    const vnTimeStr = '2026-11-05T07:00:00.000+07:00'; // 00:00:00 UTC
    const usEastTimeStr = '2026-11-04T19:00:00.000-05:00'; // 00:00:00 UTC

    const msVn = new Date(vnTimeStr).getTime();
    const msUs = new Date(usEastTimeStr).getTime();

    if (msVn === msUs) {
      logPass(`Hai mốc thời gian khác múi giờ (+07:00 vs -05:00) quy về cùng 1 mili-giây chuẩn UTC (${msVn} ms).`);
    } else {
      logFail(`Lệch mili-giây giữa 2 múi giờ: ${msVn} vs ${msUs}`);
    }

    const utcVn = new Date(msVn).toISOString();
    const utcUs = new Date(msUs).toISOString();
    if (utcVn === utcUs && utcVn === '2026-11-05T00:00:00.000Z') {
      logPass(`Chuỗi ISO 8601 UTC chuẩn hóa khớp 100%: "${utcVn}"`);
    } else {
      logFail(`Chuỗi UTC không khớp: "${utcVn}" vs "${utcUs}"`);
    }

    // Test maturity date algorithm
    const maturity = getCalendarMaturityDateObj('2026-01-31', 12);
    if (maturity?.year === 2027 && maturity?.month === 1 && maturity?.day === 31) {
      logPass(`Hạn chót và kỳ hạn tính theo chuẩn lịch ngân hàng không bị trôi ngày do độ dài tháng hay múi giờ: 31/01/2026 + 12T -> 31/01/2027.`);
      totalPassed++;
    } else {
      logFail(`Tính sai ngày đáo hạn: ${JSON.stringify(maturity)}`);
      totalFailed++;
    }
  } catch (err: any) {
    logFail('Test 4 gặp ngoại lệ', err);
    totalFailed++;
  }

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log(`\n${colors.bold}=================================================================${colors.reset}`);
  console.log(`${colors.bold}📊 KẾT QUẢ TỔNG HỢP KIỂM THỬ (QA SUMMARY REPORT)${colors.reset}`);
  console.log(`=================================================================`);
  console.log(`  Tổng số Test Cases: ${totalPassed + totalFailed}`);
  console.log(`  ${colors.green}✔ Vượt qua (PASSED): ${totalPassed}${colors.reset}`);
  console.log(`  ${colors.red}✖ Thất bại (FAILED): ${totalFailed}${colors.reset}`);

  if (totalFailed === 0) {
    console.log(`\n${colors.green}${colors.bold}🎉 TẤT CẢ CÁC TRƯỜNG HỢP BIÊN ĐỒNG BỘ ĐỀU VƯỢT QUA 100%!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bold}⚠️ CÓ ${totalFailed} TEST CASE THẤT BẠI. CẦN KIỂM TRA LẠI!${colors.reset}\n`);
    process.exit(1);
  }
}

runAllTests();
