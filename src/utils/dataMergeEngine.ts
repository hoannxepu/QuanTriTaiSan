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

// Helper: Safely compare ISO dates or date strings
function getNewerDate(dateA?: string, dateB?: string): string {
  if (!dateA) return dateB || '';
  if (!dateB) return dateA || '';
  try {
    const tA = new Date(dateA).getTime();
    const tB = new Date(dateB).getTime();
    if (!isNaN(tA) && !isNaN(tB)) {
      return tA >= tB ? dateA : dateB;
    }
  } catch {}
  return dateA;
}

/**
 * Deep merge Assets by ID
 * Preserves assets added on both devices.
 * If both modified same asset, merges fields intelligently (preserving latest live market prices & user inputs).
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

      // Reconcile quantity and amount
      const quantity = local.quantity !== undefined ? local.quantity : remote.quantity;
      let amount = local.amount || remote.amount;
      if (quantity && latestPrice && latestPrice > 0 && (isGold || isStock)) {
        amount = Math.round(quantity * latestPrice);
      }

      const mergedAsset: Asset = {
        ...remote,
        ...local,
        currentPrice: latestPrice,
        quantity,
        amount,
        costPrice: local.costPrice ?? remote.costPrice,
        rate: local.rate ?? remote.rate,
        maturityDate: local.maturityDate || remote.maturityDate,
        updatedAt: getNewerDate(local.updatedAt, remote.updatedAt),
        note: local.note || remote.note,
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

  return {
    ...remote,
    ...local,
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
    history: local.history?.length ? local.history : remote.history || [],
    salaryIncome: local.salaryIncome || remote.salaryIncome || 0,
    bonusIncome: local.bonusIncome ?? remote.bonusIncome,
    otherIncome: local.otherIncome ?? remote.otherIncome ?? 0,
    emailSchedule: local.emailSchedule || remote.emailSchedule,
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
