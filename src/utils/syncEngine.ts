import { DatabaseState } from '../types';
import { deepMergeDatabaseState } from './dataMergeEngine';
import { getAuthToken, getAuthUser } from './storage';

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

export function getAccountStorageKey(accountKey?: string): string {
  if (accountKey && accountKey.trim()) {
    return accountKey.trim().toLowerCase();
  }
  const user = getAuthUser();
  if (user?.userId) return user.userId.toLowerCase();
  if (user?.identifier) return user.identifier.toLowerCase();
  return 'guest';
}

export function getLocalCachedAccountData(accountKey?: string): { data: DatabaseState | null; version: number } {
  const key = getAccountStorageKey(accountKey);
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`thaptaisan_local_db_${key}`);
      const verRaw = localStorage.getItem(`thaptaisan_local_ver_${key}`);
      if (raw) {
        return {
          data: JSON.parse(raw),
          version: verRaw ? Math.max(1, parseInt(verRaw, 10) || 1) : 1,
        };
      }
    }
  } catch (e) {}
  return { data: null, version: 1 };
}

class SyncEngine {
  private currentDb: DatabaseState | null = null;
  private currentVersion: number = 1;
  private accountKey: string = 'guest';
  private status: SyncStatus = 'synced';
  private pendingCount: number = 0;
  private lastSyncedAt: Date | null = null;
  private lastError: string | null = null;

  // Revision & In-flight tracking
  private revision: number = 0;
  private isSaving: boolean = false;
  private needsResave: boolean = false;
  private activeSavePromise: Promise<boolean> | null = null;

  private debounceTimer: any = null;
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

  public init(initialDb: DatabaseState, version: number = 1, accountKey?: string) {
    if (accountKey) {
      this.accountKey = getAccountStorageKey(accountKey);
    } else {
      this.accountKey = getAccountStorageKey();
    }

    this.currentDb = initialDb;
    this.currentVersion = Math.max(1, version || 1);
    this.pendingCount = 0;
    this.lastError = null;
    this.needsResave = false;
    this.status = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
    this.notifyStatus();

    // Cache verified data locally by account
    this.saveLocalCache(initialDb, this.currentVersion);

    // Initial check from remote
    this.fetchRemoteIfChanged();
  }

  public setAccountKey(key: string) {
    this.accountKey = getAccountStorageKey(key);
  }

  private saveLocalCache(data: DatabaseState, version: number) {
    const key = this.accountKey || getAccountStorageKey();
    try {
      if (typeof window !== 'undefined') {
        const json = JSON.stringify(data);
        localStorage.setItem(`thaptaisan_local_db_${key}`, json);
        localStorage.setItem(`thaptaisan_local_${key}`, json);
        localStorage.setItem('thaptaisan_local_db', json);
        localStorage.setItem(`thaptaisan_local_ver_${key}`, String(version));
      }
    } catch (e) {}
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
   * Tracks revision so edits happening while saving are never dropped.
   */
  public scheduleSave(newData: DatabaseState) {
    this.revision += 1;
    this.currentDb = newData;
    this.pendingCount += 1;
    this.lastError = null;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status = 'offline';
    } else {
      this.status = 'pending';
    }
    this.notifyStatus();

    // Cache locally immediately per account
    this.saveLocalCache(newData, this.currentVersion);

    // Clear previous debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.performSave();
    }, 1200);
  }

  /**
   * Immediately trigger save (e.g. from user "Đồng bộ ngay" button).
   * Awaits any in-progress save and returns the true result.
   */
  public async syncNow(): Promise<boolean> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.isSaving && this.activeSavePromise) {
      this.needsResave = true;
      await this.activeSavePromise;
      if (this.pendingCount > 0 || this.needsResave) {
        return this.performSave();
      }
      return true;
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

    // If currently saving, mark needsResave and return active promise
    if (this.isSaving) {
      this.needsResave = true;
      if (this.activeSavePromise) {
        return this.activeSavePromise;
      }
      return false;
    }

    this.isSaving = true;
    this.status = 'saving';
    this.notifyStatus();

    const runSaveExecution = async (): Promise<boolean> => {
      // Snapshot revision, version, and database at moment of sending
      const snapshotRev = this.revision;
      const snapshotDb = this.currentDb;
      const snapshotVersion = this.currentVersion;

      try {
        const payload = {
          version: snapshotVersion,
          data: snapshotDb,
        };

        const res = await fetch('/api/data', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        // 401: Unauthorized / expired token
        if (res.status === 401) {
          this.isSaving = false;
          this.needsResave = false;
          this.lastError = 'Phiên đăng nhập hết hạn, dữ liệu cục bộ vẫn được giữ';
          this.status = 'pending';
          this.notifyStatus();

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('auth-expired', {
                detail: { message: 'Phiên đăng nhập hết hạn, dữ liệu cục bộ vẫn được giữ' },
              })
            );
          }
          return false;
        }

        // 200: Successfully saved
        if (res.status === 200) {
          const body = await res.json().catch(() => ({}));
          this.currentVersion = body.newVersion || (snapshotVersion + 1);
          this.lastSyncedAt = new Date();
          this.lastError = null;

          if (snapshotDb) {
            this.saveLocalCache(snapshotDb, this.currentVersion);
          }

          // Only clear pendingCount if revision hasn't changed during the save
          if (this.revision === snapshotRev) {
            this.pendingCount = 0;
            this.status = 'synced';
            this.notifyStatus();
          } else {
            // Further edits occurred while save was in-flight: keep pending and trigger resave
            this.status = 'pending';
            this.notifyStatus();
            this.needsResave = true;
          }

          return true;
        }

        // 409: Optimistic concurrency conflict -> Read body ONCE
        if (res.status === 409) {
          const conflictBody = await res.json().catch(() => null);

          // Stop after max 5 attempts
          if (attempt >= 5) {
            this.lastError = 'Xung đột dữ liệu liên tục sau 5 lần thử. Vui lòng làm mới trang.';
            this.status = 'pending';
            this.notifyStatus();
            return false;
          }

          const serverData = conflictBody?.currentData;
          const serverVersion = conflictBody?.currentVersion || (this.currentVersion + 1);

          if (serverData && this.currentDb) {
            // Automatic 3-way merge using dataMergeEngine
            const merged = deepMergeDatabaseState(this.currentDb, serverData);
            this.currentDb = merged;
            this.currentVersion = serverVersion;

            this.saveLocalCache(merged, this.currentVersion);
            this.notifyRemoteUpdate(merged, this.currentVersion);

            // Exponential backoff
            const backoffMs = Math.min(3000, Math.pow(2, attempt) * 300);
            await new Promise((r) => setTimeout(r, backoffMs));

            this.isSaving = false;
            return this.performSave(attempt + 1);
          } else {
            this.lastError = 'Xung đột dữ liệu không thể tự động hợp nhất';
            this.status = 'pending';
            this.notifyStatus();
            return false;
          }
        }

        // Other HTTP errors (500, etc.) -> Read body ONCE
        const errText = await res.text().catch(() => 'Lỗi kết nối máy chủ');
        this.lastError = `Lỗi máy chủ (${res.status}): ${errText}`;
        this.status = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending';
        this.notifyStatus();
        return false;
      } catch (err: any) {
        this.lastError = err?.message || 'Lỗi kết nối mạng';
        this.status = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending';
        this.notifyStatus();
        return false;
      } finally {
        this.isSaving = false;
        this.activeSavePromise = null;
      }
    };

    this.activeSavePromise = runSaveExecution();
    const result = await this.activeSavePromise;

    // If new changes occurred during saving, save again immediately
    if (this.needsResave) {
      this.needsResave = false;
      return this.performSave();
    }

    return result;
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

      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('auth-expired', {
              detail: { message: 'Phiên đăng nhập hết hạn, dữ liệu cục bộ vẫn được giữ' },
            })
          );
        }
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
            this.saveLocalCache(remoteData, remoteVersion);
            this.notifyRemoteUpdate(remoteData, remoteVersion);
            this.notifyStatus();
            return true;
          } else if (this.currentDb) {
            // Local has pending changes -> merge remote into local
            const merged = deepMergeDatabaseState(this.currentDb, remoteData);
            this.currentDb = merged;
            this.currentVersion = Math.max(this.currentVersion, remoteVersion);
            this.saveLocalCache(merged, this.currentVersion);
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
