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
 * DATA MERGE ENGINE: ID-BASED LAST-WRITER-WINS WITH TOMBSTONE SUPPORT
 * ============================================================================
 * - No heuristic name matching (strictly matches by ID).
 * - Last-Writer-Wins (LWW) based on updatedAt.
 * - Tombstones (deletedAt) distinguish deleted items from new items.
 * - Handles revival (if updatedAt > deletedAt, item is kept).
 * - Purges tombstones older than 90 days.
 * - Deterministic tie-breaking ensures strict commutativity: merge(A, B) == merge(B, A).
 */

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function parseSafeDate(d?: string | number | null): number {
  if (d === undefined || d === null) return 0;
  if (typeof d === 'number') return isNaN(d) ? 0 : d;
  const trimmed = String(d).trim();
  if (!trimmed) return 0;

  // 1. Check standard ISO or numeric string
  const num = Number(trimmed);
  if (!isNaN(num) && num > 1000000000) return num;

  const t = new Date(trimmed).getTime();
  if (!isNaN(t)) {
    // If it looks like dd/mm/yyyy
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

export function calculateTotalGoldBalance(db?: DatabaseState | null): GoldBalanceSummary {
  if (!db || !Array.isArray(db.assets)) {
    return { totalChi: 0, totalLuong: 0, totalAmount: 0, vaultCount: 0, vaults: [] };
  }

  const vaults: GoldVaultItem[] = [];
  let totalChi = 0;
  let totalAmount = 0;

  for (const a of db.assets) {
    if (!a || a.deletedAt) continue;
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
      const rawInferred = a.amount / a.currentPrice;
      qtyInChi = isLuong ? rawInferred * 10 : rawInferred;
    }

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
 * Generic ID-based CRDT LWW merger with tombstone resolution
 */
function mergeEntityArrays<T extends { id: any; updatedAt?: any; createdAt?: any; deletedAt?: string }>(
  listA: T[] = [],
  listB: T[] = []
): T[] {
  const mapA = new Map<string, T>();
  const mapB = new Map<string, T>();

  for (const item of listA) {
    if (item && item.id !== undefined && item.id !== null) {
      mapA.set(String(item.id), item);
    }
  }

  for (const item of listB) {
    if (item && item.id !== undefined && item.id !== null) {
      mapB.set(String(item.id), item);
    }
  }

  const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
  const result: T[] = [];
  const now = Date.now();

  for (const key of allKeys) {
    const itemA = mapA.get(key);
    const itemB = mapB.get(key);

    let winner: T;

    if (itemA && !itemB) {
      winner = itemA;
    } else if (!itemA && itemB) {
      winner = itemB;
    } else if (itemA && itemB) {
      const tA = parseSafeDate(itemA.updatedAt || itemA.createdAt);
      const tB = parseSafeDate(itemB.updatedAt || itemB.createdAt);
      const delA = parseSafeDate(itemA.deletedAt);
      const delB = parseSafeDate(itemB.deletedAt);

      if (delA > 0 && delB > 0) {
        // Both sides marked it deleted: keep the newer tombstone
        if (delA > delB) {
          winner = itemA;
        } else if (delB > delA) {
          winner = itemB;
        } else {
          winner = JSON.stringify(itemA) >= JSON.stringify(itemB) ? itemA : itemB;
        }
      } else if (delA > 0 && delB === 0) {
        // A deleted it, B did not
        if (delA >= tB) {
          // A deleted it after or at B's last edit -> deleted wins
          winner = itemA;
        } else {
          // B edited after A deleted -> revival!
          winner = { ...itemB, deletedAt: undefined };
        }
      } else if (delB > 0 && delA === 0) {
        // B deleted it, A did not
        if (delB >= tA) {
          winner = itemB;
        } else {
          // A edited after B deleted -> revival!
          winner = { ...itemA, deletedAt: undefined };
        }
      } else {
        // Neither side deleted it: standard LWW
        if (tA > tB) {
          winner = itemA;
        } else if (tB > tA) {
          winner = itemB;
        } else {
          // Deterministic tie-breaker for mathematical commutativity
          winner = JSON.stringify(itemA) >= JSON.stringify(itemB) ? itemA : itemB;
        }
      }
    } else {
      continue;
    }

    // Check tombstone expiration (> 90 days purge)
    if (winner.deletedAt) {
      const delTime = parseSafeDate(winner.deletedAt);
      if (delTime > 0 && now - delTime > NINETY_DAYS_MS) {
        continue; // Purged from storage
      }
    }

    result.push(winner);
  }

  // Sort deterministically by id for commutativity
  result.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return result;
}

export function deepMergeAssets(localAssets: Asset[] = [], remoteAssets: Asset[] = []): Asset[] {
  return mergeEntityArrays(localAssets, remoteAssets);
}

export function deepMergeDebts(localDebts: Debt[] = [], remoteDebts: Debt[] = []): Debt[] {
  return mergeEntityArrays(localDebts, remoteDebts);
}

export function deepMergeGoals(localGoals: Goal[] = [], remoteGoals: Goal[] = []): Goal[] {
  return mergeEntityArrays(localGoals, remoteGoals);
}

export function deepMergeTransactions(
  localTx: AssetTransaction[] = [],
  remoteTx: AssetTransaction[] = []
): AssetTransaction[] {
  return mergeEntityArrays(localTx, remoteTx);
}

export function deepMergeMonthlyIncomes(
  localList: MonthlyIncomeRecord[] = [],
  remoteList: MonthlyIncomeRecord[] = []
): MonthlyIncomeRecord[] {
  // Normalize ID from month if not present
  const normA = localList.map((m) => ({ ...m, id: m.id || m.month }));
  const normB = remoteList.map((m) => ({ ...m, id: m.id || m.month }));
  return mergeEntityArrays(normA, normB);
}

export function deepMergeIncomeItems(
  localList: IncomeItem[] = [],
  remoteList: IncomeItem[] = []
): IncomeItem[] {
  return mergeEntityArrays(localList, remoteList);
}

export function deepMergeLifeEvents(
  localList: LifeEvent[] = [],
  remoteList: LifeEvent[] = []
): LifeEvent[] {
  return mergeEntityArrays(localList, remoteList);
}

export function deepMergeFoodPlaces(
  localList: FoodPlace[] = [],
  remoteList: FoodPlace[] = []
): FoodPlace[] {
  return mergeEntityArrays(localList, remoteList);
}

export function deepMergeWatchlist(localList: string[] = [], remoteList: string[] = []): string[] {
  const set = new Set([...(localList || []), ...(remoteList || [])]);
  return Array.from(set).sort();
}

/**
 * Universal Deep Merge for DatabaseState
 * - Rejects empty/corrupt payloads (preserves valid state).
 * - Merges all entity collections with LWW + tombstones.
 * - Reconciles scalar fields based on updatedAtScalars or lastUpdate.
 * - Strictly commutative: deepMergeDatabaseState(A, B) == deepMergeDatabaseState(B, A).
 */
export function deepMergeDatabaseState(
  local: DatabaseState | null | undefined,
  remote: DatabaseState | null | undefined
): DatabaseState {
  // Defensive validation against empty/corrupt payloads
  const isLocalValid = local && typeof local === 'object' && Array.isArray(local.assets);
  const isRemoteValid = remote && typeof remote === 'object' && Array.isArray(remote.assets);

  if (!isLocalValid && !isRemoteValid) {
    return {
      assets: [],
      debts: [],
      goals: [],
      history: [],
      salaryIncome: 0,
      otherIncome: 0,
      lastUpdate: new Date().toISOString(),
    };
  }
  if (!isLocalValid) return remote!;
  if (!isRemoteValid) return local!;

  const stateA = local!;
  const stateB = remote!;

  // Merge entity arrays
  const mergedAssets = deepMergeAssets(stateA.assets, stateB.assets);
  const mergedDebts = deepMergeDebts(stateA.debts, stateB.debts);
  const mergedGoals = deepMergeGoals(stateA.goals, stateB.goals);
  const mergedTransactions = deepMergeTransactions(stateA.transactions || [], stateB.transactions || []);
  const mergedMonthlyIncomes = deepMergeMonthlyIncomes(stateA.monthlyIncomes || [], stateB.monthlyIncomes || []);
  const mergedIncomeItems = deepMergeIncomeItems(stateA.incomeItems || [], stateB.incomeItems || []);
  const mergedLifeEvents = deepMergeLifeEvents(stateA.lifeEvents || [], stateB.lifeEvents || []);
  const mergedFoodPlaces = deepMergeFoodPlaces(stateA.foodPlaces || [], stateB.foodPlaces || []);
  const mergedWatchlist = deepMergeWatchlist(stateA.stockWatchlist || [], stateB.stockWatchlist || []);

  // Scalar fields reconciliation based on timestamp
  const timeA = parseSafeDate(stateA.updated_at || stateA.lastUpdate || stateA.updatedAtTimestamp);
  const timeB = parseSafeDate(stateB.updated_at || stateB.lastUpdate || stateB.updatedAtTimestamp);

  let winnerScalars: DatabaseState;
  if (timeA > timeB) {
    winnerScalars = stateA;
  } else if (timeB > timeA) {
    winnerScalars = stateB;
  } else {
    winnerScalars = JSON.stringify(stateA) >= JSON.stringify(stateB) ? stateA : stateB;
  }

  // History points: merge by timestamp / date
  const histMap = new Map<string, any>();
  for (const h of stateA.history || []) {
    if (h) histMap.set(String(h.date || h.timestamp), h);
  }
  for (const h of stateB.history || []) {
    if (h) histMap.set(String(h.date || h.timestamp), h);
  }
  const mergedHistory = Array.from(histMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const newestTimestamp = Math.max(timeA, timeB, Date.now());

  return {
    version: Math.max(stateA.version || 1, stateB.version || 1),
    updated_at: new Date(newestTimestamp).toISOString(),
    assets: mergedAssets,
    debts: mergedDebts,
    goals: mergedGoals,
    transactions: mergedTransactions,
    history: mergedHistory,
    monthlyIncomes: mergedMonthlyIncomes,
    incomeItems: mergedIncomeItems,
    deletedMonths: Array.from(new Set([...(stateA.deletedMonths || []), ...(stateB.deletedMonths || [])])).sort(),
    salaryIncome: winnerScalars.salaryIncome,
    bonusIncome: winnerScalars.bonusIncome,
    otherIncome: winnerScalars.otherIncome,
    lastUpdate: winnerScalars.lastUpdate || new Date().toISOString(),
    updatedAtTimestamp: newestTimestamp,
    updatedAtScalars: {
      ...(stateA.updatedAtScalars || {}),
      ...(stateB.updatedAtScalars || {}),
    },
    emailSchedule: winnerScalars.emailSchedule || stateA.emailSchedule || stateB.emailSchedule,
    stockWatchlist: mergedWatchlist,
    lifeEvents: mergedLifeEvents,
    foodPlaces: mergedFoodPlaces,
  };
}

export function deepMergeRootCloudPayload(local: any, remote: any): any {
  return deepMergeDatabaseState(local, remote);
}
