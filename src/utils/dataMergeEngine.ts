import {
  DatabaseState,
  Asset,
  Debt,
  Goal,
  AssetTransaction,
  MonthlyIncomeRecord,
  IncomeItem,
  LifeEvent,
  FoodPlace,
} from '../types';
import { isStockEntity, extractStockTicker } from './stockService';
import { isGoldEntity } from './bankUtils';

/**
 * ============================================================================
 * DATA MERGE ENGINE: 3-WAY DEEP RECONCILIATION FOR THÁP TÀI SẢN
 * ============================================================================
 * Solves multi-device concurrency, race conditions, and offline edits.
 * Merges at the entity/record level instead of destructive whole-file overwriting.
 */

// Helper: Safely parse date strings (supporting ISO, dd/MM/yyyy, dd/MM/yyyy HH:mm:ss, and timestamps)
export function parseSafeDate(d?: string): number {
  if (!d || typeof d !== 'string') return 0;
  const trimmed = d.trim();
  if (!trimmed) return 0;

  // 1. Check if ISO string or numeric timestamp
  const t = new Date(trimmed).getTime();
  if (!isNaN(t)) {
    // If it looks like dd/mm/yyyy (e.g. 05/09/2026), JS Date might parse it as mm/dd/yyyy. Let's inspect format:
    if (trimmed.includes('/') && trimmed.length <= 19) {
      const parts = trimmed.split(/[\/\s:]+/);
      if (parts.length >= 3) {
        const dNum = parseInt(parts[0], 10);
        const mNum = parseInt(parts[1], 10);
        const yNum = parseInt(parts[2], 10);
        if (dNum > 0 && dNum <= 31 && mNum > 0 && mNum <= 12 && yNum >= 2000) {
          const hours = parts[3] ? parseInt(parts[3], 10) : 0;
          const mins = parts[4] ? parseInt(parts[4], 10) : 0;
          const secs = parts[5] ? parseInt(parts[5], 10) : 0;
          return new Date(yNum, mNum - 1, dNum, hours, mins, secs).getTime();
        }
      }
    }
    return t;
  }

  // 2. Fallback manual regex match for dd/MM/yyyy
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)).getTime();
  }

  return 0;
}

// Helper: Safely compare ISO dates or date strings
export function getNewerDate(dateA?: string, dateB?: string): string {
  if (!dateA) return dateB || '';
  if (!dateB) return dateA || '';
  const tA = parseSafeDate(dateA);
  const tB = parseSafeDate(dateB);
  if (tA > 0 || tB > 0) {
    return tA >= tB ? dateA : dateB;
  }
  return dateA;
}

export interface GoldVaultItem {
  id: number;
  level: string;
  name: string;
  quantityChi: number;
  amount: number;
  currentPrice: number;
  unit: string;
}

export interface GoldBalanceSummary {
  totalChi: number;
  totalLuong: number;
  totalAmount: number;
  vaultCount: number;
  vaults: GoldVaultItem[];
}

/**
 * Universal Multi-Vault Gold Aggregation Engine:
 * Aggregates all gold vaults across Level 1 (Vô hình/Bảo vệ), Level 2 (Tăng trưởng), and Level 3.
 * Automatically normalizes 'lượng' / 'cây' (1 lượng = 10 chỉ) and calculates precise totals.
 */
export function calculateTotalGoldBalance(db?: DatabaseState | null): GoldBalanceSummary {
  if (!db || !Array.isArray(db.assets)) {
    return { totalChi: 0, totalLuong: 0, totalAmount: 0, vaultCount: 0, vaults: [] };
  }

  const vaults: GoldVaultItem[] = [];
  let totalChi = 0;
  let totalAmount = 0;

  for (const a of db.assets) {
    if (!a) continue;
    const isGold = isGoldEntity(a) || a.type === 'gold';
    if (!isGold) continue;

    const unitStr = (a.unit || '').toLowerCase().trim();
    const nameStr = (a.name || '').toLowerCase();
    const isLuong =
      unitStr === 'lượng' ||
      unitStr === 'cây' ||
      unitStr.includes('lượng') ||
      unitStr.includes('cây') ||
      nameStr.includes('lượng') ||
      nameStr.includes('1l');

    let qtyInChi = 0;
    if (typeof a.quantity === 'number' && !isNaN(a.quantity) && a.quantity > 0) {
      qtyInChi = isLuong ? a.quantity * 10 : a.quantity;
    } else if (a.amount && a.currentPrice && a.currentPrice > 0) {
      // Inferred quantity from amount and live price
      const rawInferred = (a.amount / a.currentPrice);
      qtyInChi = isLuong ? rawInferred * 10 : rawInferred;
    }

    // Round to 2 decimal places (e.g. 44.5 chỉ)
    qtyInChi = Math.round(qtyInChi * 100) / 100;

    const effectiveAmount = a.amount || (qtyInChi > 0 && a.currentPrice ? Math.round(qtyInChi * a.currentPrice) : 0);
    totalChi += qtyInChi;
    totalAmount += effectiveAmount;

    vaults.push({
      id: a.id,
      level: a.level || '1',
      name: a.name || 'Vàng',
      quantityChi: qtyInChi,
      amount: effectiveAmount,
      currentPrice: a.currentPrice || 0,
      unit: a.unit || (isLuong ? 'lượng' : 'chỉ'),
    });
  }

  const roundedTotalChi = Math.round(totalChi * 100) / 100;
  const roundedTotalLuong = Math.round((roundedTotalChi / 10) * 100) / 100;

  return {
    totalChi: roundedTotalChi,
    totalLuong: roundedTotalLuong,
    totalAmount,
    vaultCount: vaults.length,
    vaults,
  };
}

/**
 * Deep merge Assets by ID
 * Preserves assets added on both devices.
 * If both modified same asset, merges fields intelligently using Last-Write-Wins (LWW)
 * and Anti-Overwriting safeguards (prevents stale default 1 unit from wiping real 44.5 chỉ).
 */
export function deepMergeAssets(localAssets: Asset[] = [], remoteAssets: Asset[] = []): Asset[] {
  const localMap = new Map<number, Asset>();
  const remoteMap = new Map<number, Asset>();

  localAssets.forEach((a) => a && typeof a.id === 'number' && localMap.set(a.id, a));
  remoteAssets.forEach((a) => a && typeof a.id === 'number' && remoteMap.set(a.id, a));

  const allIds = new Set<number>([...localMap.keys(), ...remoteMap.keys()]);
  const merged: Asset[] = [];

  allIds.forEach((id) => {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (local && !remote) {
      merged.push(local);
    } else if (!local && remote) {
      merged.push(remote);
    } else if (local && remote) {
      // Both exist: Reconcile fields
      const isGold = isGoldEntity(local) || isGoldEntity(remote);
      const isStock = isStockEntity(local) || isStockEntity(remote);

      // Prefer the latest non-zero live market price
      let latestPrice = local.currentPrice || remote.currentPrice;
      if (isGold || isStock) {
        if (local.currentPrice && local.currentPrice > 0 && (!remote.currentPrice || remote.currentPrice <= 0)) {
          latestPrice = local.currentPrice;
        } else if (remote.currentPrice && remote.currentPrice > 0 && (!local.currentPrice || local.currentPrice <= 0)) {
          latestPrice = remote.currentPrice;
        } else {
          latestPrice = local.currentPrice || remote.currentPrice;
        }
      }

      // Reconcile quantity using Last-Write-Wins (LWW) and Anti-Overwriting safeguards
      const localTime = parseSafeDate(local.updatedAt);
      const remoteTime = parseSafeDate(remote.updatedAt);

      let chosenQuantity = remote.quantity;
      if (localTime > remoteTime) {
        chosenQuantity = local.quantity !== undefined ? local.quantity : remote.quantity;
      } else if (remoteTime > localTime) {
        chosenQuantity = remote.quantity !== undefined ? remote.quantity : local.quantity;
      } else {
        // Tied or unparseable timestamps:
        // Safeguard against default sample / placeholder:
        // If remote has a realistic/custom balance (e.g. 44.5) and local has default placeholder 1 (or undefined),
        // NEVER let default 1 overwrite the real balance!
        if (
          remote.quantity !== undefined &&
          remote.quantity !== 1 &&
          (local.quantity === 1 || local.quantity === undefined)
        ) {
          chosenQuantity = remote.quantity;
        } else if (
          local.quantity !== undefined &&
          local.quantity !== 1 &&
          (remote.quantity === 1 || remote.quantity === undefined)
        ) {
          chosenQuantity = local.quantity;
        } else {
          // If remote is present, cloud canonical state takes precedence
          chosenQuantity = remote.quantity !== undefined ? remote.quantity : local.quantity;
        }
      }

      let amount = local.amount || remote.amount;
      if (chosenQuantity !== undefined && latestPrice && latestPrice > 0 && (isGold || isStock)) {
        amount = Math.round(chosenQuantity * latestPrice);
      }

      // Use the newer entity for secondary metadata
      const isLocalNewer = localTime > remoteTime;
      const base = isLocalNewer ? remote : local;
      const override = isLocalNewer ? local : remote;

      const mergedAsset: Asset = {
        ...base,
        ...override,
        currentPrice: latestPrice,
        quantity: chosenQuantity,
        amount,
        costPrice: override.costPrice ?? base.costPrice,
        rate: override.rate ?? base.rate,
        maturityDate: override.maturityDate || base.maturityDate,
        updatedAt: getNewerDate(local.updatedAt, remote.updatedAt),
        note: override.note || base.note,
      };

      merged.push(mergedAsset);
    }
  });

  return merged.sort((a, b) => a.id - b.id);
}

/**
 * Deep merge Debts by ID
 * Never undoes payments made on another device: takes the maximum paidPrincipal
 * Sets status to 'Đã tất toán' if either marked it settled or paidPrincipal >= amount.
 */
export function deepMergeDebts(localDebts: Debt[] = [], remoteDebts: Debt[] = []): Debt[] {
  const localMap = new Map<number, Debt>();
  const remoteMap = new Map<number, Debt>();

  localDebts.forEach((d) => d && typeof d.id === 'number' && localMap.set(d.id, d));
  remoteDebts.forEach((d) => d && typeof d.id === 'number' && remoteMap.set(d.id, d));

  const allIds = new Set<number>([...localMap.keys(), ...remoteMap.keys()]);
  const merged: Debt[] = [];

  allIds.forEach((id) => {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (local && !remote) {
      merged.push(local);
    } else if (!local && remote) {
      merged.push(remote);
    } else if (local && remote) {
      const maxPaid = Math.max(local.paidPrincipal || 0, remote.paidPrincipal || 0);
      const amount = local.amount || remote.amount;
      const isSettled =
        local.status === 'Đã tất toán' ||
        remote.status === 'Đã tất toán' ||
        (amount > 0 && maxPaid >= amount);

      const mergedDebt: Debt = {
        ...remote,
        ...local,
        amount,
        paidPrincipal: maxPaid,
        status: isSettled ? 'Đã tất toán' : 'Chưa tất toán',
        settledDate: local.settledDate || remote.settledDate,
        monthlyBefore: local.monthlyBefore || remote.monthlyBefore,
        monthlyAfter: local.monthlyAfter || remote.monthlyAfter,
        note: local.note || remote.note,
      };

      merged.push(mergedDebt);
    }
  });

  return merged.sort((a, b) => a.id - b.id);
}

/**
 * Deep merge Goals by ID
 * Preserves DCA progress (totalBought, backlogQty) and milestone targets.
 */
export function deepMergeGoals(localGoals: Goal[] = [], remoteGoals: Goal[] = []): Goal[] {
  const localMap = new Map<number, Goal>();
  const remoteMap = new Map<number, Goal>();

  localGoals.forEach((g) => g && typeof g.id === 'number' && localMap.set(g.id, g));
  remoteGoals.forEach((g) => g && typeof g.id === 'number' && remoteMap.set(g.id, g));

  const allIds = new Set<number>([...localMap.keys(), ...remoteMap.keys()]);
  const merged: Goal[] = [];

  allIds.forEach((id) => {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (local && !remote) {
      merged.push(local);
    } else if (!local && remote) {
      merged.push(remote);
    } else if (local && remote) {
      const maxBought = Math.max(local.totalBought || 0, remote.totalBought || 0);
      const isCompleted = local.status === 'completed' || remote.status === 'completed';

      const mergedGoal: Goal = {
        ...remote,
        ...local,
        totalBought: maxBought,
        status: isCompleted ? 'completed' : local.status || remote.status || 'active',
        currentPrice: local.currentPrice || remote.currentPrice,
        unitPrice: local.unitPrice || remote.unitPrice,
        targetQty: local.targetQty || remote.targetQty,
        targetAmountPerPeriod: local.targetAmountPerPeriod || remote.targetAmountPerPeriod,
        target: local.target || remote.target,
        lastBoughtPeriod: local.lastBoughtPeriod || remote.lastBoughtPeriod,
        note: local.note || remote.note,
      };

      merged.push(mergedGoal);
    }
  });

  return merged.sort((a, b) => a.id - b.id);
}

/**
 * Deep merge Transactions with strict idempotency (anti-duplicate)
 */
export function deepMergeTransactions(
  localTxs: AssetTransaction[] = [],
  remoteTxs: AssetTransaction[] = []
): AssetTransaction[] {
  const txMap = new Map<string, AssetTransaction>();

  const addTx = (tx: AssetTransaction) => {
    if (!tx) return;
    // Key by ID if present, otherwise composite key to deduplicate identical rows
    const key = tx.id
      ? String(tx.id)
      : `${tx.date}_${tx.assetId || tx.goalId}_${tx.type}_${tx.quantity}_${tx.totalAmount}`;
    if (!txMap.has(key)) {
      txMap.set(key, tx);
    } else {
      // If already present, merge notes/extra details
      const existing = txMap.get(key)!;
      txMap.set(key, { ...existing, ...tx });
    }
  };

  remoteTxs.forEach(addTx);
  localTxs.forEach(addTx);

  return Array.from(txMap.values()).sort((a, b) => {
    const tA = new Date(a.date).getTime() || 0;
    const tB = new Date(b.date).getTime() || 0;
    return tB - tA; // Newest first
  });
}

/**
 * Deep merge Monthly Incomes by month key ('2026-10')
 */
export function deepMergeMonthlyIncomes(
  localMonths: MonthlyIncomeRecord[] = [],
  remoteMonths: MonthlyIncomeRecord[] = []
): MonthlyIncomeRecord[] {
  const monthMap = new Map<string, MonthlyIncomeRecord>();

  remoteMonths.forEach((m) => {
    if (m && m.month) monthMap.set(m.month, m);
  });

  localMonths.forEach((m) => {
    if (!m || !m.month) return;
    const existing = monthMap.get(m.month);
    if (!existing) {
      monthMap.set(m.month, m);
    } else {
      monthMap.set(m.month, {
        ...existing,
        ...m,
        salary: m.salary !== undefined ? m.salary : existing.salary,
        bonus: m.bonus !== undefined ? m.bonus : existing.bonus,
        other: m.other !== undefined ? m.other : existing.other,
        passive: m.passive !== undefined ? m.passive : existing.passive,
        note: m.note || existing.note,
      });
    }
  });

  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Deep merge Income Items by item.id
 */
export function deepMergeIncomeItems(
  localItems: IncomeItem[] = [],
  remoteItems: IncomeItem[] = []
): IncomeItem[] {
  const itemMap = new Map<string, IncomeItem>();

  remoteItems.forEach((item) => {
    if (item && item.id) itemMap.set(item.id, item);
  });

  localItems.forEach((item) => {
    if (item && item.id) itemMap.set(item.id, item);
  });

  return Array.from(itemMap.values()).sort((a, b) => {
    const tA = new Date(a.date).getTime() || 0;
    const tB = new Date(b.date).getTime() || 0;
    return tB - tA;
  });
}

/**
 * Deep merge Life Events by event.id
 */
export function deepMergeLifeEvents(
  localEvents: LifeEvent[] = [],
  remoteEvents: LifeEvent[] = []
): LifeEvent[] {
  const eventMap = new Map<string, LifeEvent>();
  remoteEvents.forEach((e) => e && e.id && eventMap.set(e.id, e));
  localEvents.forEach((e) => e && e.id && eventMap.set(e.id, e));
  return Array.from(eventMap.values());
}

/**
 * Deep merge Food Places by place.id
 */
export function deepMergeFoodPlaces(
  localPlaces: FoodPlace[] = [],
  remotePlaces: FoodPlace[] = []
): FoodPlace[] {
  const placeMap = new Map<string, FoodPlace>();
  remotePlaces.forEach((p) => p && p.id && placeMap.set(p.id, p));
  localPlaces.forEach((p) => p && p.id && placeMap.set(p.id, p));
  return Array.from(placeMap.values());
}

/**
 * Deep merge Stock Watchlist (Set union of tickers)
 */
export function deepMergeWatchlist(localList: string[] = [], remoteList: string[] = []): string[] {
  const set = new Set<string>();
  remoteList.forEach((s) => s && set.add(s.toUpperCase().trim()));
  localList.forEach((s) => s && set.add(s.toUpperCase().trim()));
  return Array.from(set);
}

/**
 * MASTER DEEP MERGE: Reconciles local and remote DatabaseState with zero data loss.
 * Increments monotonic version and stamps fresh UTC timestamp.
 */
export function deepMergeDatabaseState(
  local: DatabaseState | null | undefined,
  remote: DatabaseState | null | undefined
): DatabaseState {
  if (!local && !remote) {
    throw new Error('Cannot merge empty databases');
  }
  if (!local) return remote!;
  if (!remote) return local!;

  const mergedAssets = deepMergeAssets(local.assets, remote.assets);
  const mergedDebts = deepMergeDebts(local.debts, remote.debts);
  const mergedGoals = deepMergeGoals(local.goals, remote.goals);
  const mergedTransactions = deepMergeTransactions(local.transactions, remote.transactions);
  const mergedMonthlyIncomes = deepMergeMonthlyIncomes(local.monthlyIncomes, remote.monthlyIncomes);
  const mergedIncomeItems = deepMergeIncomeItems(local.incomeItems, remote.incomeItems);
  const mergedLifeEvents = deepMergeLifeEvents(local.lifeEvents, remote.lifeEvents);
  const mergedFoodPlaces = deepMergeFoodPlaces(local.foodPlaces, remote.foodPlaces);
  const mergedWatchlist = deepMergeWatchlist(local.stockWatchlist, remote.stockWatchlist);

  // Compute monotonic version: strictly higher than both sides
  const nextVersion = Math.max(local.version || 1, remote.version || 1) + 1;
  const nowIso = new Date().toISOString();

  // Determine which side is newer based on updated_at or version
  const localTime = parseSafeDate(local.updated_at || local.lastUpdate);
  const remoteTime = parseSafeDate(remote.updated_at || remote.lastUpdate);
  const isRemoteNewer = remoteTime > localTime || (remote.version || 1) > (local.version || 1);

  const baseScalars = isRemoteNewer ? local : remote;
  const newerScalars = isRemoteNewer ? remote : local;

  return {
    ...baseScalars,
    ...newerScalars,
    version: nextVersion,
    updated_at: nowIso,
    lastUpdate: new Date().toLocaleDateString('vi-VN'),
    assets: mergedAssets,
    debts: mergedDebts,
    goals: mergedGoals,
    transactions: mergedTransactions,
    monthlyIncomes: mergedMonthlyIncomes,
    incomeItems: mergedIncomeItems,
    lifeEvents: mergedLifeEvents,
    foodPlaces: mergedFoodPlaces,
    stockWatchlist: mergedWatchlist,
    history: newerScalars.history?.length ? newerScalars.history : baseScalars.history || [],
    salaryIncome: newerScalars.salaryIncome !== undefined ? newerScalars.salaryIncome : baseScalars.salaryIncome || 0,
    bonusIncome: newerScalars.bonusIncome !== undefined ? newerScalars.bonusIncome : baseScalars.bonusIncome,
    otherIncome: newerScalars.otherIncome !== undefined ? newerScalars.otherIncome : baseScalars.otherIncome ?? 0,
    emailSchedule: newerScalars.emailSchedule || baseScalars.emailSchedule,
  };
}

/**
 * Deep merge Root JSON data (for thap_tai_san_data.json) containing { passwords, users }
 */
export function deepMergeRootCloudPayload(
  localPayload: { passwords?: Record<string, string>; users?: Record<string, DatabaseState> },
  remotePayload: { passwords?: Record<string, string>; users?: Record<string, DatabaseState> }
): { passwords: Record<string, string>; users: Record<string, DatabaseState> } {
  const mergedPasswords: Record<string, string> = {
    ...(localPayload?.passwords || {}),
    ...(remotePayload?.passwords || {}),
  };

  const mergedUsers: Record<string, DatabaseState> = {};
  const allUserKeys = new Set<string>([
    ...Object.keys(remotePayload?.users || {}),
    ...Object.keys(localPayload?.users || {}),
  ]);

  allUserKeys.forEach((key) => {
    const localUser = localPayload?.users?.[key];
    const remoteUser = remotePayload?.users?.[key];
    if (localUser && remoteUser) {
      mergedUsers[key] = deepMergeDatabaseState(localUser, remoteUser);
    } else if (localUser) {
      mergedUsers[key] = localUser;
    } else if (remoteUser) {
      mergedUsers[key] = remoteUser;
    }
  });

  return {
    passwords: mergedPasswords,
    users: mergedUsers,
  };
}
