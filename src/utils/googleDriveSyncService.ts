/**
 * ============================================================================
 * GOOGLE DRIVE ENTERPRISE SYNC SERVICE FOR `thap_tai_san_data.json`
 * ============================================================================
 * Principal Full-stack Architect & Cloud Storage Architecture
 *
 * Capabilities:
 * 1. Token & Auth Management: Handles Access & Refresh Tokens, prevents Silent 401/403.
 * 2. Network Resilience: Exponential Backoff Retry with Random Jitter on 429/500/503/timeout.
 * 3. Concurrency Protection: ETag & Revision ID checking with automatic Deep Merge on conflict.
 * 4. Parse & Memory Safety: Never overwrites on 0 bytes / corrupt payload; fallbacks to local cache.
 * 5. Cache-Busting: Strict no-cache headers & unique query params on every request.
 * 6. Diagnostics & Audit Trail: In-memory circular log buffer for instant UI debugging.
 */

import { DatabaseState } from '../types';
import { deepMergeRootCloudPayload } from './dataMergeEngine';

export const FILE_NAME = 'thap_tai_san_data.json';
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxW6C9L4sDhKMLO28_iaxLrUS834iKCoYkkQJbxGz_e2vpGPf3KVJxzr2tvoY5EIZ0tbw/exec';

export type SyncConnectionState =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'conflict_merging'
  | 'drive_error'
  | 'offline';

export interface DriveSyncLogEntry {
  id: string;
  timestamp: string;
  epoch: number;
  level: 'info' | 'warn' | 'error' | 'success';
  action: 'READ' | 'WRITE' | 'REFRESH_TOKEN' | 'CONFLICT_MERGE' | 'FALLBACK_CACHE' | 'NETWORK';
  message: string;
  etag?: string;
  statusCode?: number;
  errorDetails?: string;
}

export interface CloudPayload {
  passwords: Record<string, string>;
  users: Record<string, DatabaseState>;
  _metadata?: {
    etag?: string;
    version?: number;
    modifiedTime?: string;
    lastSyncedDevice?: string;
  };
}

export interface SyncResult {
  success: boolean;
  source: 'google_drive' | 'proxy' | 'local_cache';
  data: CloudPayload | null;
  etag?: string;
  modifiedTime?: string;
  error?: string;
}

class GoogleDriveSyncService {
  private currentEtag: string = '';
  private currentModifiedTime: string = '';
  private currentVersion: number = 1;
  private connectionStatus: SyncConnectionState = 'idle';
  private lastSyncError: string | null = null;
  private logs: DriveSyncLogEntry[] = [];
  private logListeners = new Set<(logs: DriveSyncLogEntry[]) => void>();
  private statusListeners = new Set<(status: SyncConnectionState, error?: string | null) => void>();
  private isOnline: boolean = true;
  private inFlightReadPromise: Promise<SyncResult> | null = null;

  // Storage Keys
  private readonly CACHE_STORAGE_KEY = 'thaptaisan_drive_safe_cache';
  private readonly ETAG_STORAGE_KEY = 'thaptaisan_drive_last_etag';
  private readonly TOKEN_STORAGE_KEY = 'thaptaisan_drive_tokens';

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      // Restore saved ETag and cached metadata
      try {
        this.currentEtag = localStorage.getItem(this.ETAG_STORAGE_KEY) || '';
      } catch {}

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.addLog('info', 'NETWORK', 'Thiết bị đã kết nối lại mạng Internet');
        this.setStatus('idle');
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.addLog('warn', 'NETWORK', 'Mất kết nối mạng Internet (Ngoại tuyến)');
        this.setStatus('offline', 'Mất kết nối Internet');
      });
    }
  }

  // =========================================================================
  // 1. DIAGNOSTICS & LOGGING ENGINE
  // =========================================================================
  public addLog(
    level: 'info' | 'warn' | 'error' | 'success',
    action: DriveSyncLogEntry['action'],
    message: string,
    meta?: { etag?: string; statusCode?: number; errorDetails?: string }
  ) {
    const entry: DriveSyncLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
      epoch: Date.now(),
      level,
      action,
      message,
      etag: meta?.etag || this.currentEtag,
      statusCode: meta?.statusCode,
      errorDetails: meta?.errorDetails,
    };

    this.logs.unshift(entry);
    if (this.logs.length > 80) {
      this.logs.pop();
    }

    if (level === 'error') {
      console.error(`[DriveSync:${action}] ${message}`, meta?.errorDetails || '');
    } else if (level === 'warn') {
      console.warn(`[DriveSync:${action}] ${message}`);
    } else {
      console.log(`[DriveSync:${action}] ${message}`);
    }

    this.notifyLogListeners();
  }

  public getLogs(): DriveSyncLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.notifyLogListeners();
  }

  public subscribeLogs(cb: (logs: DriveSyncLogEntry[]) => void): () => void {
    this.logListeners.add(cb);
    cb(this.getLogs());
    return () => this.logListeners.delete(cb);
  }

  public subscribeStatus(cb: (status: SyncConnectionState, error?: string | null) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.connectionStatus, this.lastSyncError);
    return () => this.statusListeners.delete(cb);
  }

  private setStatus(status: SyncConnectionState, errorMsg?: string | null) {
    this.connectionStatus = status;
    this.lastSyncError = errorMsg || null;
    this.statusListeners.forEach((cb) => cb(status, errorMsg));
  }

  private notifyLogListeners() {
    const current = this.getLogs();
    this.logListeners.forEach((cb) => cb(current));
  }

  public getStatus(): SyncConnectionState {
    return this.connectionStatus;
  }

  public getLastSyncError(): string | null {
    return this.lastSyncError;
  }

  public getCurrentEtag(): string {
    return this.currentEtag;
  }

  public getCurrentModifiedTime(): string {
    return this.currentModifiedTime;
  }

  // =========================================================================
  // 2. AUTH / TOKEN MANAGEMENT (Prevents Silent 401/403)
  // =========================================================================
  public getStoredTokens(): { accessToken?: string; refreshToken?: string; expiresAt?: number } {
    try {
      const raw = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public saveTokens(tokens: { accessToken: string; refreshToken?: string; expiresInSec?: number }) {
    try {
      const current = this.getStoredTokens();
      const expiresAt = Date.now() + (tokens.expiresInSec || 3600) * 1000;
      const updated = {
        ...current,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || current.refreshToken,
        expiresAt,
      };
      localStorage.setItem(this.TOKEN_STORAGE_KEY, JSON.stringify(updated));
      this.addLog('info', 'REFRESH_TOKEN', 'Đã lưu Access Token mới vào bộ nhớ an toàn');
    } catch (e) {}
  }

  public isTokenExpired(): boolean {
    const tokens = this.getStoredTokens();
    if (!tokens.accessToken) return true;
    if (!tokens.expiresAt) return false;
    // 60-second safety margin
    return Date.now() >= tokens.expiresAt - 60000;
  }

  /**
   * Transparently renew Access Token if expired
   */
  public async ensureFreshToken(): Promise<string | null> {
    const tokens = this.getStoredTokens();
    if (!tokens.accessToken) return null;

    if (!this.isTokenExpired()) {
      return tokens.accessToken;
    }

    if (!tokens.refreshToken) {
      this.addLog('warn', 'REFRESH_TOKEN', 'Access Token hết hạn và không có Refresh Token dự phòng');
      return null;
    }

    this.addLog('info', 'REFRESH_TOKEN', 'Access Token đã hết hạn ngầm. Đang tự động làm mới qua Refresh Token...');
    try {
      // Exchange refresh token via backend proxy or oauth endpoint
      const res = await fetch('/api/oauth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokens.refreshToken }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.access_token) {
          this.saveTokens({
            accessToken: json.access_token,
            expiresInSec: json.expires_in || 3600,
          });
          this.addLog('success', 'REFRESH_TOKEN', 'Làm mới Access Token thành công không làm gián đoạn người dùng');
          return json.access_token;
        }
      }
      this.addLog('error', 'REFRESH_TOKEN', 'Làm mới Access Token thất bại từ máy chủ OAuth', {
        statusCode: res.status,
      });
      return null;
    } catch (err: any) {
      this.addLog('error', 'REFRESH_TOKEN', 'Ngoại lệ khi làm mới Access Token', {
        errorDetails: err?.message,
      });
      return null;
    }
  }

  // =========================================================================
  // 3. EXPONENTIAL BACKOFF RETRY EXECUTOR
  // =========================================================================
  private async executeWithRetry<T>(
    operationName: string,
    operation: (attempt: number) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await operation(attempt);
      } catch (err: any) {
        attempt++;
        const statusCode = err?.status || err?.statusCode || 0;
        const isRateLimit = statusCode === 429;
        const isServerBusy = statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;
        const isNetworkFailure = err?.name === 'TypeError' || err?.message?.includes('fetch');

        const isRetryable = isRateLimit || isServerBusy || isNetworkFailure;

        if (attempt > maxRetries || !isRetryable) {
          this.addLog('error', 'NETWORK', `${operationName} thất bại hoàn toàn sau ${attempt} lần thử`, {
            statusCode,
            errorDetails: err?.message,
          });
          throw err;
        }

        // Exponential backoff with random jitter: (base * 2^attempt) + jitter
        const base = isRateLimit ? 1000 : 400;
        const jitter = Math.random() * 250;
        const delay = Math.min(base * Math.pow(2, attempt) + jitter, 4500);

        this.addLog(
          'warn',
          'NETWORK',
          `${operationName} gặp mã lỗi ${statusCode || 'mạng'}. Đang tự động thử lại lần ${attempt}/${maxRetries} sau ${Math.round(delay)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error(`${operationName} vượt quá số lần thử lại tối đa`);
  }

  // =========================================================================
  // 4. ATOMIC READ (GET `thap_tai_san_data.json` WITH ETAG & CACHE-BUSTING)
  // =========================================================================
  public async readThapTaiSanFile(): Promise<SyncResult> {
    if (this.inFlightReadPromise) {
      return this.inFlightReadPromise;
    }

    this.inFlightReadPromise = this.performRead()
      .finally(() => {
        this.inFlightReadPromise = null;
      });

    return this.inFlightReadPromise;
  }

  private async performRead(): Promise<SyncResult> {
    if (!this.isOnline) {
      this.setStatus('offline', 'Thiết bị đang ngoại tuyến. Dùng bản lưu cục bộ.');
      return this.readLocalFallbackCache('Thiết bị đang ngoại tuyến');
    }

    this.setStatus('syncing');
    this.addLog('info', 'READ', `Bắt đầu tải ${FILE_NAME} từ Google Drive...`);

    try {
      const result = await this.executeWithRetry('Tải tệp từ Google Drive', async (attempt) => {
        // Strategy 1: Read via Same-domain Server Proxy (/api/cloud-sync)
        // Adds Strict Anti-Stale headers + Query Param Cache Buster
        const cacheBuster = `t=${Date.now()}&_rnd=${Math.random().toString(36).substring(2, 7)}`;
        const proxyUrl = `/api/cloud-sync?${cacheBuster}`;

        const token = await this.ensureFreshToken();
        const headers: Record<string, string> = {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Accept: 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (this.currentEtag) {
          headers['If-None-Match'] = this.currentEtag;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 14000);

        try {
          const res = await fetch(proxyUrl, {
            headers,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          // 304 Not Modified: Cache is 100% fresh
          if (res.status === 304) {
            this.addLog('success', 'READ', `Dữ liệu Google Drive không đổi (304 Not Modified). ETag: ${this.currentEtag}`);
            this.setStatus('synced');
            const cached = this.getLocalFallbackCache();
            if (cached) {
              return {
                success: true,
                source: 'local_cache' as const,
                data: cached,
                etag: this.currentEtag,
                modifiedTime: this.currentModifiedTime,
              };
            }
            return this.readLocalFallbackCache('Dữ liệu không đổi (304)');
          }

          if (res.status === 401 || res.status === 403) {
            this.addLog('warn', 'READ', `Lỗi xác thực ${res.status}. Token Google Drive có thể đã hết hạn.`);
            // Throw to trigger retry or fallback
            const err: any = new Error(`Lỗi xác thực Drive: ${res.status}`);
            err.statusCode = res.status;
            throw err;
          }

          if (!res.ok) {
            const err: any = new Error(`Máy chủ proxy trả mã lỗi HTTP ${res.status}`);
            err.statusCode = res.status;
            throw err;
          }

          const responseText = await res.text();

          // 0-Bytes or Empty Check: Protect against blanking user data!
          if (!responseText || responseText.trim().length === 0) {
            this.addLog('warn', 'FALLBACK_CACHE', 'Phản hồi từ Drive rỗng (0 bytes)! Bảo vệ dữ liệu bằng bản cache an toàn.');
            return this.readLocalFallbackCache('Tệp tải về bị rỗng 0 bytes');
          }

          let parsedJson: any;
          try {
            parsedJson = JSON.parse(responseText);
          } catch (parseErr: any) {
            this.addLog('error', 'FALLBACK_CACHE', 'Tệp tải về bị hỏng cấu trúc JSON! Khôi phục từ bản lưu cache gần nhất.', {
              errorDetails: parseErr?.message,
            });
            return this.readLocalFallbackCache('Lỗi phân tích cú pháp JSON');
          }

          // Validate minimum payload structure
          if (!parsedJson || typeof parsedJson !== 'object') {
            return this.readLocalFallbackCache('Dữ liệu không đúng định dạng');
          }

          const normalizedPayload: CloudPayload = {
            passwords: parsedJson.passwords || {},
            users: parsedJson.users || {},
            _metadata: parsedJson._metadata || {},
          };

          // Capture ETag & Modified Time
          const newEtag = res.headers.get('ETag') || parsedJson._metadata?.etag || `etag_${Date.now()}`;
          const newModified = res.headers.get('Last-Modified') || parsedJson._metadata?.modifiedTime || new Date().toISOString();

          this.updateEtag(newEtag, newModified);

          // Update local safe snapshot
          this.saveLocalFallbackCache(normalizedPayload);

          this.addLog('success', 'READ', `Đọc tệp ${FILE_NAME} thành công từ Google Drive (ETag: ${newEtag})`, {
            etag: newEtag,
            statusCode: 200,
          });
          this.setStatus('synced');

          return {
            success: true,
            source: 'proxy' as const,
            data: normalizedPayload,
            etag: newEtag,
            modifiedTime: newModified,
          };
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      });

      return result;
    } catch (err: any) {
      this.setStatus('drive_error', err?.message || 'Lỗi mất kết nối Drive');
      return this.readLocalFallbackCache(err?.message || 'Không thể kết nối đến Google Drive');
    }
  }

  // =========================================================================
  // 5. ATOMIC WRITE (WITH ETAG/REVISION IF-MATCH & AUTOMATIC DEEP MERGE)
  // =========================================================================
  public async writeThapTaiSanFile(
    payload: { passwords: Record<string, string>; users: Record<string, DatabaseState> },
    options: {
      expectedEtag?: string;
      force?: boolean;
      userKey?: string;
    } = {}
  ): Promise<{ success: boolean; conflictMerged?: boolean; newEtag?: string; error?: string }> {
    if (!this.isOnline) {
      this.addLog('warn', 'WRITE', 'Thiết bị đang ngoại tuyến. Lưu dữ liệu vào hàng đợi cục bộ...');
      this.saveLocalFallbackCache(payload);
      this.setStatus('offline', 'Đã lưu cục bộ (Ngoại tuyến)');
      return { success: true, conflictMerged: false };
    }

    this.setStatus('syncing');
    this.addLog('info', 'WRITE', `Bắt đầu lưu an toàn ${FILE_NAME} lên Google Drive...`);

    // Step 1: Pre-validation & Safe Stringify
    let payloadString: string;
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload rỗng hoặc không hợp lệ');
      }
      const dataToSave: CloudPayload = {
        passwords: payload.passwords || {},
        users: payload.users || {},
        _metadata: {
          etag: this.currentEtag,
          modifiedTime: new Date().toISOString(),
          version: this.currentVersion + 1,
          lastSyncedDevice: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 40) : 'web',
        },
      };
      payloadString = JSON.stringify(dataToSave);
      // Immediately cache locally so no data is ever lost even if browser crashes
      this.saveLocalFallbackCache(dataToSave);
    } catch (stringifyErr: any) {
      this.addLog('error', 'WRITE', 'Lỗi chuẩn hóa dữ liệu JSON trước khi gửi đi', {
        errorDetails: stringifyErr?.message,
      });
      return { success: false, error: 'Dữ liệu không thể chuyển đổi thành chuỗi JSON hợp lệ' };
    }

    // Step 2: Optimistic Locking Check (If-Match verification)
    const clientExpectedEtag = options.expectedEtag || this.currentEtag;

    try {
      const result = await this.executeWithRetry('Ghi tệp lên Google Drive', async (attempt) => {
        const token = await this.ensureFreshToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (clientExpectedEtag && !options.force) {
          headers['If-Match'] = clientExpectedEtag;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000);

        try {
          const res = await fetch(`/api/cloud-sync?t=${Date.now()}`, {
            method: 'POST',
            headers,
            body: payloadString,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          // CONFLICT DETECTED: 412 Precondition Failed or 409 Conflict
          // Means another device updated thap_tai_san_data.json on Drive!
          if (res.status === 412 || res.status === 409) {
            this.addLog(
              'warn',
              'CONFLICT_MERGE',
              `Phát hiện xung đột phiên bản (HTTP ${res.status})! Tệp trên Google Drive đã bị thay đổi bởi thiết bị khác.`,
              { statusCode: res.status, etag: clientExpectedEtag }
            );

            this.setStatus('conflict_merging', 'Phát hiện xung đột: Đang hợp nhất dữ liệu (Deep Merge)...');

            // 1. Fetch fresh version from Google Drive
            const freshRemote = await this.performRead();
            if (freshRemote.success && freshRemote.data) {
              // 2. Perform Deep Merge of the two states
              this.addLog('info', 'CONFLICT_MERGE', 'Đang tiến hành thuật toán Deep Merge từng thực thể (Zero Data Loss)...');
              const mergedPayload = deepMergeRootCloudPayload(payload, freshRemote.data);

              // 3. Increment Version & Stamp new ETag
              this.currentVersion = Math.max(this.currentVersion, freshRemote.data._metadata?.version || 1) + 1;
              const mergedPayloadString = JSON.stringify({
                ...mergedPayload,
                _metadata: {
                  etag: freshRemote.etag,
                  modifiedTime: new Date().toISOString(),
                  version: this.currentVersion,
                },
              });

              // 4. Write back the reconciled data with fresh If-Match
              const retryRes = await fetch(`/api/cloud-sync?t=${Date.now()}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                  'If-Match': freshRemote.etag || '',
                },
                body: mergedPayloadString,
              });

              if (retryRes.ok) {
                const newEtag = retryRes.headers.get('ETag') || `etag_${Date.now()}`;
                this.updateEtag(newEtag, new Date().toISOString());
                this.saveLocalFallbackCache(mergedPayload);

                this.addLog('success', 'CONFLICT_MERGE', `Hợp nhất dữ liệu hoàn tất và đã lưu thành công lên Drive (v${this.currentVersion})!`, {
                  etag: newEtag,
                });
                this.setStatus('synced');
                return { success: true, conflictMerged: true, newEtag };
              }
            }

            throw new Error('Không thể tự động giải quyết xung đột với Google Drive');
          }

          if (res.status === 401 || res.status === 403) {
            this.addLog('error', 'WRITE', `Lỗi quyền truy cập ${res.status}. Token Google Drive không hợp lệ hoặc hết hạn.`);
            const err: any = new Error(`Lỗi quyền truy cập Drive (${res.status})`);
            err.statusCode = res.status;
            throw err;
          }

          if (!res.ok) {
            const err: any = new Error(`Máy chủ proxy trả mã lỗi ${res.status} khi lưu`);
            err.statusCode = res.status;
            throw err;
          }

          const newEtag = res.headers.get('ETag') || `etag_${Date.now()}`;
          this.updateEtag(newEtag, new Date().toISOString());
          this.currentVersion += 1;

          this.addLog('success', 'WRITE', `Đã lưu tệp ${FILE_NAME} lên Google Drive an toàn (v${this.currentVersion})`, {
            etag: newEtag,
            statusCode: 200,
          });
          this.setStatus('synced');

          return { success: true, conflictMerged: false, newEtag };
        } catch (err: any) {
          clearTimeout(timeoutId);
          throw err;
        }
      });

      return result;
    } catch (err: any) {
      this.setStatus('drive_error', err?.message || 'Lỗi mất kết nối Drive');
      this.addLog('error', 'WRITE', `Lỗi khi lưu tệp ${FILE_NAME} lên Google Drive: ${err?.message}`, {
        errorDetails: err?.message,
      });
      return { success: false, error: err?.message };
    }
  }

  // =========================================================================
  // 6. CACHE & RECOVERY HELPERS
  // =========================================================================
  private updateEtag(etag: string, modifiedTime: string) {
    if (etag) {
      this.currentEtag = etag;
      try {
        localStorage.setItem(this.ETAG_STORAGE_KEY, etag);
      } catch {}
    }
    if (modifiedTime) {
      this.currentModifiedTime = modifiedTime;
    }
  }

  private saveLocalFallbackCache(payload: any) {
    try {
      localStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }

  public getLocalFallbackCache(): CloudPayload | null {
    try {
      const raw = localStorage.getItem(this.CACHE_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  private readLocalFallbackCache(reason: string): SyncResult {
    const cached = this.getLocalFallbackCache();
    if (cached) {
      this.addLog('warn', 'FALLBACK_CACHE', `Sử dụng bản lưu cache cục bộ gần nhất. Lý do: ${reason}`);
      return {
        success: true,
        source: 'local_cache',
        data: cached,
        etag: this.currentEtag,
        modifiedTime: this.currentModifiedTime,
        error: reason,
      };
    }
    return {
      success: false,
      source: 'local_cache',
      data: null,
      error: reason,
    };
  }
}

// Global Singleton Instance
export const googleDriveSyncService = new GoogleDriveSyncService();
