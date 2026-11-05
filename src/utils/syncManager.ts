import { DatabaseState, RealtimeSyncStatus, SyncEventPayload, MutatePayloadRequest, MutatePayloadResponse, Asset, Debt, Goal, IncomeItem, MonthlyIncomeRecord } from '../types';
import { isStockEntity } from './stockService';
import { isGoldEntity } from './bankUtils';

// Helper: Generate robust UUID for idempotent mutation tracking
export function generateMutationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

import { deepMergeDatabaseState } from './dataMergeEngine';

// 3-WAY REBASE ENGINE: Merge concurrent changes from Server & Local without data loss
export function rebaseUserData(localData: DatabaseState, serverData: DatabaseState): DatabaseState {
  if (!serverData) return localData;
  if (!localData) return serverData;
  return deepMergeDatabaseState(localData, serverData);
}

export type SyncSubscriber = (updatedDb: DatabaseState, source: 'realtime' | 'pull' | 'rebase') => void;
export type StatusSubscriber = (status: RealtimeSyncStatus, detail?: string) => void;

class RealtimeSyncManager {
  private userKey: string = '';
  private currentVersion: number = 1;
  private currentUpdatedAt: string = '';
  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;
  private isOnline: boolean = true;
  private subscribers = new Set<SyncSubscriber>();
  private statusSubscribers = new Set<StatusSubscriber>();
  private lastMutationId: string = '';
  private offlineMutationQueue: Array<{
    data: DatabaseState;
    resolve: (res: any) => void;
    reject: (err: any) => void;
  }> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      // Listen for network connectivity changes
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyStatus('connected', 'Đã kết nối lại mạng');
        this.connectSSE();
        this.flushOfflineQueue();
        this.syncPendingChanges();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyStatus('offline', 'Mất kết nối mạng - Đang lưu cục bộ');
      });

      // Background Sync on Tab/App Resume (Foreground Active)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncPendingChanges();
        }
      });

      window.addEventListener('focus', () => {
        this.syncPendingChanges();
      });
    }
  }

  public init(userKey: string, initialVersion?: number, initialUpdatedAt?: string) {
    const normalized = (userKey || '').toLowerCase().trim();
    if (!normalized) return;

    const hasChanged = this.userKey !== normalized;
    this.userKey = normalized;
    if (typeof initialVersion === 'number' && initialVersion > 0) {
      this.currentVersion = initialVersion;
    }
    if (initialUpdatedAt) {
      this.currentUpdatedAt = initialUpdatedAt;
    }

    if (hasChanged || !this.eventSource) {
      this.connectSSE();
    }
  }

  public subscribe(cb: SyncSubscriber): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  public subscribeStatus(cb: StatusSubscriber): () => void {
    this.statusSubscribers.add(cb);
    return () => this.statusSubscribers.delete(cb);
  }

  public getVersion(): number {
    return this.currentVersion;
  }

  public getUpdatedAt(): string {
    return this.currentUpdatedAt;
  }

  private notifyStatus(status: RealtimeSyncStatus, detail?: string) {
    this.statusSubscribers.forEach((cb) => cb(status, detail));
  }

  private notifyData(data: DatabaseState, source: 'realtime' | 'pull' | 'rebase') {
    if (typeof data.version === 'number' && data.version > 0) {
      this.currentVersion = Math.max(this.currentVersion, data.version);
    }
    if (data.updated_at) {
      this.currentUpdatedAt = data.updated_at;
    }
    this.subscribers.forEach((cb) => cb(data, source));
  }

  // Connect Server-Sent Events (SSE) Real-time Stream
  private connectSSE() {
    if (!this.userKey || typeof window === 'undefined') return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      this.notifyStatus('connecting', 'Đang thiết lập kênh Real-time...');
      const sseUrl = `/api/sync/events?userKey=${encodeURIComponent(this.userKey)}&t=${Date.now()}`;
      const es = new EventSource(sseUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.notifyStatus('connected', 'Real-time đã sẵn sàng');
      };

      es.addEventListener('CONNECTED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (typeof payload.serverVersion === 'number') {
            this.currentVersion = Math.max(this.currentVersion, payload.serverVersion);
          }
          if (payload.updated_at) {
            this.currentUpdatedAt = payload.updated_at;
          }
          this.notifyStatus('synced', `Đã đồng bộ v${this.currentVersion}`);
        } catch (err) {}
      });

      es.addEventListener('ENTITY_UPDATED', (e: MessageEvent) => {
        try {
          const payload: SyncEventPayload = JSON.parse(e.data);

          // Avoid echo loop if this client generated the mutation
          if (payload.mutationSource && payload.mutationSource === this.lastMutationId) {
            return;
          }

          // Trigger immediate delta pull & re-render
          this.notifyStatus('syncing', `Phát hiện cập nhật từ thiết bị khác (v${payload.version})...`);
          this.pullLatestState('realtime');
        } catch (err) {
          console.warn('[RealtimeSync] Error parsing ENTITY_UPDATED event:', err);
        }
      });

      es.addEventListener('HEARTBEAT', () => {
        // Heartbeat received - connection is alive
      });

      es.onerror = () => {
        es.close();
        this.eventSource = null;
        this.notifyStatus('offline', 'Mất kết nối Real-time, tự động kết nối lại sau 4s...');

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (this.isOnline) {
            this.connectSSE();
          }
        }, 4000);
      };
    } catch (err) {
      console.warn('[RealtimeSync] EventSource initialization failed:', err);
    }
  }

  // Pull latest data on Reconnect or Background Resume
  public async syncPendingChanges(): Promise<void> {
    if (!this.userKey || !this.isOnline) return;
    await this.pullLatestState('pull');
  }

  private async pullLatestState(source: 'realtime' | 'pull' = 'pull'): Promise<void> {
    if (!this.userKey) return;

    try {
      const res = await fetch(
        `/api/sync/pull?userKey=${encodeURIComponent(this.userKey)}&sinceVersion=${this.currentVersion}&t=${Date.now()}`
      );
      if (!res.ok) return;

      const result = await res.json();
      if (result.isLatest) {
        if (typeof result.version === 'number') {
          this.currentVersion = result.version;
        }
        this.notifyStatus('synced', `Dữ liệu mới nhất (v${this.currentVersion})`);
        return;
      }

      if (result.data) {
        this.currentVersion = result.version || this.currentVersion + 1;
        this.currentUpdatedAt = result.updated_at || new Date().toISOString();
        this.notifyData(result.data, source);
        this.notifyStatus('synced', `Đã đồng bộ tức thì v${this.currentVersion}`);
      }
    } catch (err) {
      console.warn('[RealtimeSync] Pull error:', err);
    }
  }

  // OPTIMISTIC LOCKING MUTATION WITH EXPONENTIAL BACKOFF RETRY
  public async mutate(
    data: DatabaseState,
    entityName: string = 'database',
    maxRetries: number = 3
  ): Promise<MutatePayloadResponse> {
    if (!this.userKey) {
      throw new Error('User key not set in RealtimeSyncManager');
    }

    const mutationId = generateMutationId();
    this.lastMutationId = mutationId;

    // If offline, queue for background sync
    if (!this.isOnline) {
      this.notifyStatus('offline', 'Đang lưu cục bộ (ngoại tuyến)');
      return new Promise((resolve, reject) => {
        this.offlineMutationQueue.push({ data, resolve, reject });
      });
    }

    this.notifyStatus('syncing', 'Đang đẩy cập nhật lên máy chủ...');

    let attempt = 0;
    let expectedVer = this.currentVersion;
    let currentPayloadData = data;

    while (attempt <= maxRetries) {
      try {
        const body: MutatePayloadRequest = {
          userKey: this.userKey,
          expectedVersion: expectedVer,
          data: currentPayloadData,
          clientMutationId: mutationId,
          entityName,
        };

        const res = await fetch('/api/sync/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        // 1. SUCCESS: 200 OK
        if (res.ok) {
          const json: MutatePayloadResponse = await res.json();
          this.currentVersion = json.version;
          this.currentUpdatedAt = json.updated_at;
          this.notifyStatus('synced', `Đã lưu v${json.version}`);
          return json;
        }

        // 2. CONFLICT: 409 Conflict Detected!
        if (res.status === 409) {
          const conflictData: MutatePayloadResponse = await res.json();
          console.warn(
            `[OptimisticLock] 409 Conflict at attempt ${attempt + 1}. Server Version: ${conflictData.serverVersion}, Expected: ${expectedVer}`
          );

          if (conflictData.currentData) {
            // Intelligent 3-Way Rebase: Merge local changes on top of Server's latest data
            this.notifyStatus('conflict', 'Phát hiện xung đột - Đang tự động gộp (Rebase)...');
            const rebased = rebaseUserData(currentPayloadData, conflictData.currentData);
            currentPayloadData = rebased;
            expectedVer = conflictData.serverVersion || expectedVer + 1;
            this.currentVersion = expectedVer;

            // Notify UI of the rebased state
            this.notifyData(rebased, 'rebase');

            // Exponential backoff delay: 200ms, 500ms, 1200ms
            const delay = Math.min(200 * Math.pow(2.5, attempt), 3000);
            await new Promise((r) => setTimeout(r, delay));
            attempt++;
            continue;
          }
        }

        // 3. Other HTTP Errors
        throw new Error(`Server returned HTTP ${res.status}`);
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries) {
          this.notifyStatus('error', 'Đồng bộ thất bại sau 3 lần thử');
          console.error('[RealtimeSync] Mutation failed permanently:', err);
          throw err;
        }
        const delay = Math.min(300 * Math.pow(2, attempt), 4000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error('Mutation exhausted retries');
  }

  // Flush offline queue when reconnected
  private async flushOfflineQueue() {
    if (this.offlineMutationQueue.length === 0) return;

    this.notifyStatus('syncing', `Đang tải ${this.offlineMutationQueue.length} thay đổi chưa lưu...`);
    const queue = [...this.offlineMutationQueue];
    this.offlineMutationQueue = [];

    for (const item of queue) {
      try {
        const res = await this.mutate(item.data, 'offline_flush');
        item.resolve(res);
      } catch (e) {
        item.reject(e);
      }
    }
  }

  public destroy() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }
}

// Global Singleton Instance
export const syncManager = new RealtimeSyncManager();
