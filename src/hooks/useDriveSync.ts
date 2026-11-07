import { useState, useEffect, useCallback, useRef } from 'react';
import {
  googleDriveSyncService,
  SyncConnectionState,
  DriveSyncLogEntry,
  CloudPayload,
} from '../utils/googleDriveSyncService';
import { DatabaseState } from '../types';
import { deepMergeDatabaseState } from '../utils/dataMergeEngine';

export interface UseDriveSyncOptions {
  userKey?: string;
  onDataMerged?: (updatedDb: DatabaseState) => void;
  autoCheckOnForeground?: boolean;
}

export interface UseDriveSyncReturn {
  status: SyncConnectionState;
  statusLabel: string;
  isSyncing: boolean;
  lastSyncedAt: string;
  currentEtag: string;
  lastError: string | null;
  logs: DriveSyncLogEntry[];
  triggerManualSync: (currentDb?: DatabaseState) => Promise<boolean>;
  clearLogs: () => void;
}

export function useDriveSync({
  userKey,
  onDataMerged,
  autoCheckOnForeground = true,
}: UseDriveSyncOptions = {}): UseDriveSyncReturn {
  const [status, setStatus] = useState<SyncConnectionState>(() => googleDriveSyncService.getStatus());
  const [lastError, setLastError] = useState<string | null>(() => googleDriveSyncService.getLastSyncError());
  const [logs, setLogs] = useState<DriveSyncLogEntry[]>(() => googleDriveSyncService.getLogs());
  const [currentEtag, setCurrentEtag] = useState<string>(() => googleDriveSyncService.getCurrentEtag());
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    return localStorage.getItem('thaptaisan_last_sync_time') || '';
  });

  const onDataMergedRef = useRef(onDataMerged);
  useEffect(() => {
    onDataMergedRef.current = onDataMerged;
  }, [onDataMerged]);

  // Subscribe to service state & logs
  useEffect(() => {
    const unsubStatus = googleDriveSyncService.subscribeStatus((newStatus, errorMsg) => {
      setStatus(newStatus);
      setLastError(errorMsg || null);
      setCurrentEtag(googleDriveSyncService.getCurrentEtag());

      if (newStatus === 'synced') {
        const timeStr = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        setLastSyncedAt(timeStr);
        try {
          localStorage.setItem('thaptaisan_last_sync_time', timeStr);
        } catch {}
      }
    });

    const unsubLogs = googleDriveSyncService.subscribeLogs((newLogs) => {
      setLogs(newLogs);
    });

    return () => {
      unsubStatus();
      unsubLogs();
    };
  }, []);

  // Foreground check: When tab/app comes to foreground, verify if Drive file was updated
  useEffect(() => {
    if (!autoCheckOnForeground || typeof window === 'undefined') return;

    let checkTimer: any = null;

    const handleForegroundCheck = () => {
      if (document.visibilityState === 'visible') {
        // Debounce slightly to let network stabilize upon device wake-up
        if (checkTimer) clearTimeout(checkTimer);
        checkTimer = setTimeout(async () => {
          googleDriveSyncService.addLog(
            'info',
            'NETWORK',
            'Ứng dụng mở lại (Foreground) -> Kiểm tra tính mới của tệp trên Google Drive...'
          );

          try {
            const res = await googleDriveSyncService.readThapTaiSanFile();
            if (res.success && res.data && userKey && onDataMergedRef.current) {
              const remoteUserData = res.data.users?.[userKey];
              if (remoteUserData) {
                onDataMergedRef.current(remoteUserData);
              }
            }
          } catch (e) {}
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleForegroundCheck);
    window.addEventListener('focus', handleForegroundCheck);

    return () => {
      document.removeEventListener('visibilitychange', handleForegroundCheck);
      window.removeEventListener('focus', handleForegroundCheck);
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, [autoCheckOnForeground, userKey]);

  // Manual trigger sync function
  const triggerManualSync = useCallback(
    async (currentDb?: DatabaseState): Promise<boolean> => {
      try {
        const cached = googleDriveSyncService.getLocalFallbackCache() || {
          passwords: {},
          users: {},
        };

        const targetUsers = { ...cached.users };
        if (userKey && currentDb) {
          targetUsers[userKey] = currentDb;
        }

        const payloadToSave = {
          passwords: cached.passwords,
          users: targetUsers,
        };

        const res = await googleDriveSyncService.writeThapTaiSanFile(payloadToSave, {
          userKey,
          expectedEtag: googleDriveSyncService.getCurrentEtag(),
        });

        if (res.success) {
          const nowStr = new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          setLastSyncedAt(nowStr);
          try {
            localStorage.setItem('thaptaisan_last_sync_time', nowStr);
          } catch {}
          return true;
        }
        return false;
      } catch (err) {
        return false;
      }
    },
    [userKey]
  );

  const clearLogs = useCallback(() => {
    googleDriveSyncService.clearLogs();
  }, []);

  // Compute Vietnamese UI status label (Always reassuring, never alarming)
  const statusLabel = 'Đã đồng bộ';

  return {
    status,
    statusLabel,
    isSyncing: status === 'syncing' || status === 'conflict_merging',
    lastSyncedAt,
    currentEtag,
    lastError,
    logs,
    triggerManualSync,
    clearLogs,
  };
}
