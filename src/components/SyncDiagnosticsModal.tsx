import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  FileCode2,
  HardDrive,
  Info,
} from 'lucide-react';
import {
  googleDriveSyncService,
  DriveSyncLogEntry,
  SyncConnectionState,
  FILE_NAME,
} from '../utils/googleDriveSyncService';

interface SyncDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SyncConnectionState;
  statusLabel: string;
  lastSyncedAt: string;
  currentEtag: string;
  lastError: string | null;
  logs: DriveSyncLogEntry[];
  onRetrySync: () => Promise<boolean>;
  onForceRebase?: () => Promise<void>;
}

export const SyncDiagnosticsModal: React.FC<SyncDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  status,
  statusLabel,
  lastSyncedAt,
  currentEtag,
  lastError,
  logs,
  onRetrySync,
  onForceRebase,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetrySync();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.action}] ${l.message} ${
            l.etag ? `(ETag: ${l.etag})` : ''
          } ${l.statusCode ? `(HTTP ${l.statusCode})` : ''} ${
            l.errorDetails ? `\nDetails: ${l.errorDetails}` : ''
          }`
      )
      .join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isErrorState = status === 'drive_error' || status === 'offline';
  const isSyncingState = status === 'syncing' || status === 'conflict_merging';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isErrorState
                  ? 'bg-rose-100 text-rose-700'
                  : isSyncingState
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isErrorState ? (
                <CloudOff className="w-5 h-5" />
              ) : isSyncingState ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Cloud className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                Chẩn Đoán Kết Nối & Đồng Bộ Google Drive
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Quản lý tệp <code className="font-mono bg-slate-200/80 px-1 py-0.5 rounded text-[11px] text-slate-800">{FILE_NAME}</code> & Khóa phiên bản
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isErrorState
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : isSyncingState
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="shrink-0">
                {isErrorState ? (
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                ) : isSyncingState ? (
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm">{statusLabel}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isErrorState
                        ? 'bg-rose-200 text-rose-800'
                        : isSyncingState
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-emerald-200 text-emerald-800'
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <p className="text-[11px] mt-0.5 opacity-90">
                  {lastError ? (
                    <span className="font-semibold text-rose-700">Nguyên nhân: {lastError}</span>
                  ) : status === 'synced' ? (
                    'Dữ liệu Web & Mobile đã đồng nhất hoàn hảo trên Google Drive.'
                  ) : (
                    'Đang xử lý kết nối và gửi nhận gói tin...'
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Đang thử lại...' : 'Thử lại ngay'}</span>
            </button>
          </div>

          {/* Metadata Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <div className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1">
                <HardDrive className="w-3 h-3 text-slate-400" />
                <span>Tên tệp Drive</span>
              </div>
              <div className="font-mono font-bold text-slate-800 mt-1 truncate">{FILE_NAME}</div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <div className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1">
                <FileCode2 className="w-3 h-3 text-slate-400" />
                <span>Khóa ETag</span>
              </div>
              <div className="font-mono font-bold text-slate-800 mt-1 truncate" title={currentEtag || 'Chưa cấp'}>
                {currentEtag ? currentEtag.slice(0, 14) + '...' : 'Tự động tạo'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <div className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                <span>Đồng bộ gần nhất</span>
              </div>
              <div className="font-bold text-slate-800 mt-1">{lastSyncedAt || 'Vừa xong'}</div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <div className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1">
                <Info className="w-3 h-3 text-slate-400" />
                <span>Cơ chế bảo vệ</span>
              </div>
              <div className="font-bold text-emerald-700 mt-1">Deep 3-Way Merge</div>
            </div>
          </div>

          {/* Architecture Resilience Notice */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
            <span className="font-bold">🛡️ Cơ chế chống mất dữ liệu đa thiết bị:</span> Hệ thống sử dụng khóa phiên bản <strong>ETag & If-Match</strong>. Nếu bạn thao tác trên cả điện thoại và máy tính cùng lúc, hệ thống <strong>từ chối ghi đè</strong> và tự động chạy thuật toán <strong>Deep Merge</strong> để hợp nhất từng giao dịch, khoản nợ và tài sản mà không làm mất bất kỳ thay đổi nào.
          </div>

          {/* Diagnostic Event Logs */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-700 flex items-center space-x-1.5">
                <span>Nhật Ký Chẩn Đoán Đồng Bộ (Live Trace)</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                  {logs.length}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleCopyLogs}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 flex items-center space-x-1 transition cursor-pointer text-[10px] font-semibold"
                  title="Sao chép toàn bộ log để gửi hỗ trợ kỹ thuật"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép log'}</span>
                </button>
                <button
                  onClick={() => googleDriveSyncService.clearLogs()}
                  className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title="Xóa nhật ký"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-2 font-mono text-[11px] space-y-1.5 bg-slate-950 text-slate-200">
              {logs.length === 0 ? (
                <div className="py-6 text-center text-slate-500 italic">Chưa có sự kiện nào được ghi lại</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-1.5 rounded transition ${
                      log.level === 'error'
                        ? 'bg-rose-950/60 border border-rose-900/60 text-rose-300'
                        : log.level === 'warn'
                        ? 'bg-amber-950/60 border border-amber-900/60 text-amber-300'
                        : log.level === 'success'
                        ? 'bg-emerald-950/60 border border-emerald-900/60 text-emerald-300'
                        : 'bg-slate-900/80 border border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 text-[10px] opacity-80">
                      <span className="text-slate-400 font-bold">{log.timestamp}</span>
                      <span
                        className={`px-1 py-0.2 rounded font-bold ${
                          log.action === 'WRITE'
                            ? 'bg-blue-900 text-blue-200'
                            : log.action === 'READ'
                            ? 'bg-indigo-900 text-indigo-200'
                            : log.action === 'CONFLICT_MERGE'
                            ? 'bg-amber-900 text-amber-200'
                            : log.action === 'REFRESH_TOKEN'
                            ? 'bg-purple-900 text-purple-200'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {log.action}
                      </span>
                      {log.statusCode && <span>HTTP {log.statusCode}</span>}
                    </div>
                    <div className="mt-0.5 leading-relaxed">{log.message}</div>
                    {log.errorDetails && (
                      <div className="text-[10px] text-rose-400/90 mt-0.5 bg-black/40 p-1 rounded">
                        Chi tiết: {log.errorDetails}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-[11px] text-slate-500 font-medium">
            Tự động đồng bộ ngầm khi đổi tab hoặc sửa đổi
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 transition cursor-pointer text-xs"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
