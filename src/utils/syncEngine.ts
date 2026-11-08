import { DatabaseState } from '../types';
import { deepMergeDatabaseState } from './dataMergeEngine';
import { getAuthToken } from './storage';

export type SyncStatus = 'synced' | 'saving' | 'pending' | 'offline';

export interface SyncEngineState {
  status: SyncStatus;
  statusLabel: string;
  pendingCount: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
  version: number;
}

type StatusListener = (state: SyncEngineState) => void;
type RemoteUpdateListener = (updatedDb: DatabaseState, version: number) => void;

class SyncEngine {
  private currentDb: DatabaseState | null = null;
  private currentVersion: number = 1;
  private status: SyncStatus = 'synced';
  private pendingCount: number = 0;
  private lastSyncedAt: Date | null = null;
  private lastError: string | null = null;

  private debounceTimer: any = null;
  private retryTimer: any = null;
  private isSaving: boolean = false;
  private statusListeners = new Set<StatusListener>();
  private remoteUpdateListeners = new Set<RemoteUpdateListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      // Foreground sync
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.fetchRemoteIfChanged();
        }
      });
      window.addEventListener('focus', () => this.fetchRemoteIfChanged());

      // Before unload / pagehide keepalive
      window.addEventListener('pagehide', () => this.flushBeforeUnload());
      window.addEventListener('beforeunload', () => this.flushBeforeUnload());
    }
  }

  public init(initialDb: DatabaseState, version: number = 1) {
    this.currentDb = initialDb;
    this.currentVersion = Math.max(1, version || 1);
    this.pendingCount = 0;
    this.lastError = null;
    this.status = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
    this.notifyStatus();

    // Initial check from remote
    this.fetchRemoteIfChanged();
  }

  public getDb(): DatabaseState | null {
    return this.currentDb;
  }

  public getVersion(): number {
    return this.currentVersion;
  }

  public getState(): SyncEngineState {
    let statusLabel = 'Đã đồng bộ';
    if (this.status === 'saving') {
      statusLabel = 'Đang lưu…';
    } else if (this.status === 'pending') {
      statusLabel = `Chưa đồng bộ (${this.pendingCount} thay đổi chờ)`;
    } else if (this.status === 'offline') {
      statusLabel = 'Ngoại tuyến';
    }

    return {
      status: this.status,
      statusLabel,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      version: this.currentVersion,
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getState());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribeRemoteUpdate(listener: RemoteUpdateListener): () => void {
    this.remoteUpdateListeners.add(listener);
    return () => {
      this.remoteUpdateListeners.delete(listener);
    };
  }

  private notifyStatus() {
    const state = this.getState();
    this.statusListeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {}
    });
  }

  private notifyRemoteUpdate(db: DatabaseState, version: number) {
    this.remoteUpdateListeners.forEach((fn) => {
      try {
        fn(db, version);
      } catch (e) {}
    });
  }

  private handleNetworkChange(online: boolean) {
    if (!online) {
      this.status = 'offline';
      this.notifyStatus();
    } else {
      if (this.pendingCount > 0) {
        this.status = 'pending';
        this.performSave();
      } else {
        this.status = 'synced';
        this.fetchRemoteIfChanged();
      }
      this.notifyStatus();
    }
  }

  /**
   * Schedule debounced save (1.2s debounce)
   */
  public scheduleSave(newData: DatabaseState) {
    this.currentDb = newData;
    this.pendingCount += 1;
    this.lastError = null;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status = 'offline';
    } else {
      this.status = 'pending';
    }
    this.notifyStatus();

    // Cache locally immediately
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('thaptaisan_local_db', JSON.stringify(newData));
        localStorage.setItem('thaptaisan_local_version', String(this.currentVersion));
      }
    } catch (e) {}

    // Clear previous debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.performSave();
    }, 1200);
  }

  /**
   * Immediately trigger save (e.g. from user "Đồng bộ ngay" button)
   */
  public async syncNow(): Promise<boolean> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    return this.performSave();
  }

  private async performSave(attempt: number = 0): Promise<boolean> {
    const token = getAuthToken();
    if (!token || !this.currentDb) {
      // Offline / guest mode - cannot sync to D1
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status = 'offline';
      this.notifyStatus();
      return false;
    }

    if (this.isSaving) {
      return false;
    }

    this.isSaving = true;
    this.status = 'saving';
    this.notifyStatus();

    try {
      const payload = {
        version: this.currentVersion,
        data: this.currentDb,
      };

      const res = await fetch('/api/data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 200) {
        const body = await res.json();
        this.currentVersion = body.newVersion || this.currentVersion + 1;
        this.pendingCount = 0;
        this.lastSyncedAt = new Date();
        this.lastError = null;
        this.status = 'synced';
        this.notifyStatus();
        this.isSaving = false;
        return true;
      }

      if (res.status === 409) {
        // Optimistic concurrency conflict: server has newer data!
        const body = await res.json().catch(() => ({}));
        const serverVersion = body.currentVersion || this.currentVersion + 1;
        const serverData = body.currentData;

        if (serverData && this.currentDb) {
          // Automatic 3-way merge using dataMergeEngine
          const merged = deepMergeDatabaseState(this.currentDb, serverData);
          this.currentDb = merged;
          this.currentVersion = serverVersion;

          // Notify UI to render merged state
          this.notifyRemoteUpdate(merged, this.currentVersion);

          // Retry with exponential backoff (max 5 attempts)
          this.isSaving = false;
          if (attempt < 5) {
            const backoffMs = Math.min(5000, Math.pow(2, attempt) * 400);
            await new Promise((r) => setTimeout(r, backoffMs));
            return this.performSave(attempt + 1);
          }
        }
      }

      // Other HTTP errors (401, 500, etc.)
      const errText = await res.text().catch(() => 'Lỗi kết nối máy chủ');
      this.lastError = `Lỗi máy chủ (${res.status}): ${errText}`;
      this.status = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending';
      this.notifyStatus();
      this.isSaving = false;
      return false;
    } catch (err: any) {
      this.lastError = err?.message || 'Lỗi kết nối mạng';
      this.status = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending';
      this.notifyStatus();
      this.isSaving = false;
      return false;
    }
  }

  /**
   * Foreground pull with If-None-Match
   */
  public async fetchRemoteIfChanged(): Promise<boolean> {
    const token = getAuthToken();
    if (!token) return false;

    try {
      const res = await fetch('/api/data', {
        headers: {
          Authorization: `Bearer ${token}`,
          'If-None-Match': `"${this.currentVersion}"`,
        },
      });

      if (res.status === 304) {
        // No changes on remote
        return false;
      }

      if (res.status === 200) {
        const body = await res.json();
        if (body.success && body.data) {
          const remoteVersion = body.version;
          const remoteData = body.data;

          if (this.pendingCount === 0) {
            // Local has no uncommitted edits -> adopt remote data cleanly
            this.currentDb = remoteData;
            this.currentVersion = remoteVersion;
            this.lastSyncedAt = new Date();
            this.notifyRemoteUpdate(remoteData, remoteVersion);
            this.notifyStatus();
            return true;
          } else if (this.currentDb) {
            // Local has pending changes -> merge remote into local
            const merged = deepMergeDatabaseState(this.currentDb, remoteData);
            this.currentDb = merged;
            this.currentVersion = Math.max(this.currentVersion, remoteVersion);
            this.notifyRemoteUpdate(merged, this.currentVersion);
            this.scheduleSave(merged);
            return true;
          }
        }
      }
    } catch (e) {}

    return false;
  }

  private flushBeforeUnload() {
    if (this.pendingCount > 0 && this.currentDb) {
      const token = getAuthToken();
      if (!token) return;

      const payload = JSON.stringify({
        version: this.currentVersion,
        data: this.currentDb,
      });

      try {
        fetch('/api/data', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      } catch (e) {}
    }
  }
}

export const syncEngine = new SyncEngine();
