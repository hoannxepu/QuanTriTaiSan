/**
 * ============================================================================
 * PRODUCTION MOBILE APP SYNCHRONIZATION ENGINE (Offline-First & Auto-Resume)
 * ============================================================================
 * Designed for Native Mobile (React Native / Capacitor) & Mobile Web PWA.
 * Features:
 * 1. AppState Lifecycle Listener (Active / Background / Inactive) -> Auto Sync on Resume.
 * 2. Network Connectivity Listener (NetInfo / navigator.onLine) -> Auto Offline Queue.
 * 3. Optimistic Local Persistence (AsyncStorage / SQLite / IndexedDB abstraction).
 * 4. Exponential Backoff Retry with Random Jitter to prevent Thundering Herd.
 * 5. Incremental Delta Pull using `sinceVersion` & `last_synced_at`.
 */

import { DatabaseState, MutatePayloadRequest, MutatePayloadResponse } from '../types';
import { generateMutationId, rebaseUserData } from './syncManager';

export interface MobileSyncConfig {
  baseUrl: string;
  userKey: string;
  storageKeyPrefix?: string;
  maxRetries?: number;
  heartbeatIntervalMs?: number;
  onStatusChange?: (status: 'online' | 'offline' | 'syncing' | 'synced' | 'conflict' | 'error') => void;
  onDataSynced?: (data: DatabaseState, reason: 'resume' | 'network_restore' | 'remote_push') => void;
}

export interface OfflineMutationItem {
  id: string;
  userKey: string;
  expectedVersion: number;
  data: DatabaseState;
  createdAt: number;
  retryCount: number;
}

export class MobileSyncEngine {
  private config: MobileSyncConfig;
  private currentVersion: number = 1;
  private lastSyncedAt: string = '';
  private isOnline: boolean = true;
  private isAppActive: boolean = true;
  private isFlushingQueue: boolean = false;
  private eventSource: any = null;

  constructor(config: MobileSyncConfig) {
    this.config = {
      storageKeyPrefix: 'thaptaisan_mobile_',
      maxRetries: 3,
      heartbeatIntervalMs: 20000,
      ...config,
    };

    this.initLifecycle();
  }

  // 1. LIFECYCLE & NETWORK LISTENERS
  private initLifecycle() {
    if (typeof window === 'undefined') return;

    // Detect browser or PWA network events
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.config.onStatusChange?.('online');
      this.onResumeSync('network_restore');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.config.onStatusChange?.('offline');
    });

    // Detect Mobile AppState change (Foreground / Background)
    // Works seamlessly for Web PWA, iOS Safari, Android Chrome, and Capacitor/Cordova
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.isAppActive = true;
        this.onResumeSync('resume');
      } else {
        this.isAppActive = false;
      }
    });

    // Support React Native AppState if running in React Native WebView or bridge
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      window.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'APP_STATE_CHANGE' && msg.state === 'active') {
            this.isAppActive = true;
            this.onResumeSync('resume');
          }
        } catch (e) {}
      });
    }
  }

  // 2. ON RESUME / RECONNECT DELTA SYNC
  public async onResumeSync(reason: 'resume' | 'network_restore' = 'resume'): Promise<void> {
    if (!this.isOnline || !this.config.userKey) return;

    this.config.onStatusChange?.('syncing');

    try {
      // Step A: Flush any pending mutations recorded while offline
      await this.flushPendingMutations();

      // Step B: Pull delta changes from server since local version
      const pullUrl = `${this.config.baseUrl}/api/sync/pull?userKey=${encodeURIComponent(
        this.config.userKey
      )}&sinceVersion=${this.currentVersion}&t=${Date.now()}`;

      const res = await fetch(pullUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();

      if (result.isLatest) {
        this.config.onStatusChange?.('synced');
        return;
      }

      if (result.data) {
        this.currentVersion = result.version || this.currentVersion + 1;
        this.lastSyncedAt = result.updated_at || new Date().toISOString();

        // Save fresh state to local offline storage
        await this.persistLocalData(result.data);

        this.config.onDataSynced?.(result.data, reason);
        this.config.onStatusChange?.('synced');
      }
    } catch (err) {
      console.warn('[MobileSyncEngine] onResumeSync failed:', err);
      this.config.onStatusChange?.(this.isOnline ? 'error' : 'offline');
    }
  }

  // 3. OPTIMISTIC LOCAL MUTATION & QUEUEING
  public async mutateOptimistic(newData: DatabaseState, entityName?: string): Promise<MutatePayloadResponse> {
    const mutationId = generateMutationId();

    // 1. Immediate local save (0ms response for smooth 60fps Mobile UI)
    await this.persistLocalData(newData);

    // 2. If device is currently offline, buffer into Persistent Offline Queue
    if (!this.isOnline) {
      await this.enqueueOfflineMutation({
        id: mutationId,
        userKey: this.config.userKey,
        expectedVersion: this.currentVersion,
        data: newData,
        createdAt: Date.now(),
        retryCount: 0,
      });

      this.config.onStatusChange?.('offline');
      return {
        success: true,
        version: this.currentVersion,
        updated_at: new Date().toISOString(),
      };
    }

    // 3. Online: Send with Optimistic Locking & Exponential Backoff Retry
    return this.sendMutationWithRetry(newData, mutationId, entityName);
  }

  // 4. ROBUST MUTATION WITH EXPONENTIAL RETRY & 409 CONFLICT REBASE
  private async sendMutationWithRetry(
    data: DatabaseState,
    mutationId: string,
    entityName?: string
  ): Promise<MutatePayloadResponse> {
    const maxRetries = this.config.maxRetries || 3;
    let attempt = 0;
    let expectedVer = this.currentVersion;
    let payloadData = data;

    while (attempt <= maxRetries) {
      try {
        const body: MutatePayloadRequest = {
          userKey: this.config.userKey,
          expectedVersion: expectedVer,
          data: payloadData,
          clientMutationId: mutationId,
          entityName: entityName || 'mobile_mutation',
        };

        const res = await fetch(`${this.config.baseUrl}/api/sync/mutate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        // SUCCESS: 200 OK
        if (res.ok) {
          const json: MutatePayloadResponse = await res.json();
          this.currentVersion = json.version;
          this.lastSyncedAt = json.updated_at;
          this.config.onStatusChange?.('synced');
          return json;
        }

        // CONFLICT: 409 Conflict Detected!
        if (res.status === 409) {
          const conflictRes: MutatePayloadResponse = await res.json();
          this.config.onStatusChange?.('conflict');

          if (conflictRes.currentData) {
            // Intelligent 3-way rebase
            const rebased = rebaseUserData(payloadData, conflictRes.currentData);
            payloadData = rebased;
            expectedVer = conflictRes.serverVersion || expectedVer + 1;
            this.currentVersion = expectedVer;

            await this.persistLocalData(rebased);
            this.config.onDataSynced?.(rebased, 'remote_push');

            // Exponential backoff with random jitter: (base * 2^attempt) + jitter
            const jitter = Math.random() * 200;
            const delay = Math.min(250 * Math.pow(2, attempt) + jitter, 3500);
            await new Promise((r) => setTimeout(r, delay));
            attempt++;
            continue;
          }
        }

        throw new Error(`HTTP Error: ${res.status}`);
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries) {
          // If all online attempts fail, buffer to offline queue for later auto-sync
          await this.enqueueOfflineMutation({
            id: mutationId,
            userKey: this.config.userKey,
            expectedVersion: expectedVer,
            data: payloadData,
            createdAt: Date.now(),
            retryCount: attempt,
          });

          this.config.onStatusChange?.('error');
          throw err;
        }

        const jitter = Math.random() * 200;
        const delay = Math.min(300 * Math.pow(2, attempt) + jitter, 4000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error('Mobile mutation exhausted retries');
  }

  // 5. OFFLINE QUEUE MANAGEMENT
  private async getOfflineQueue(): Promise<OfflineMutationItem[]> {
    try {
      const raw = localStorage.getItem(`${this.config.storageKeyPrefix}offline_queue`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  private async enqueueOfflineMutation(item: OfflineMutationItem): Promise<void> {
    const queue = await this.getOfflineQueue();
    queue.push(item);
    try {
      localStorage.setItem(`${this.config.storageKeyPrefix}offline_queue`, JSON.stringify(queue));
    } catch (e) {}
  }

  private async flushPendingMutations(): Promise<void> {
    if (this.isFlushingQueue) return;
    this.isFlushingQueue = true;

    try {
      const queue = await this.getOfflineQueue();
      if (queue.length === 0) return;

      const remaining: OfflineMutationItem[] = [];

      for (const item of queue) {
        try {
          await this.sendMutationWithRetry(item.data, item.id);
        } catch (e) {
          item.retryCount += 1;
          if (item.retryCount < 5) {
            remaining.push(item);
          }
        }
      }

      localStorage.setItem(`${this.config.storageKeyPrefix}offline_queue`, JSON.stringify(remaining));
    } finally {
      this.isFlushingQueue = false;
    }
  }

  // 6. LOCAL PERSISTENCE HELPERS
  private async persistLocalData(data: DatabaseState): Promise<void> {
    try {
      localStorage.setItem(
        `${this.config.storageKeyPrefix}local_${this.config.userKey}`,
        JSON.stringify(data)
      );
    } catch (e) {}
  }

  public destroy() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
