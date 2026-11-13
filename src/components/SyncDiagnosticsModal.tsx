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
  ShieldCheck,
  HardDrive,
  Info,
} from 'lucide-react';
import { syncEngine, SyncEngineState } from '../utils/syncEngine';

interface SyncDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: SyncEngineState;
  onRetrySync: () => Promise<boolean>;
}

export const SyncDiagnosticsModal: React.FC<SyncDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  syncState,
  onRetrySync,
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

  const handleCopy = () => {
    const text = JSON.stringify(
      {
        status: syncState.status,
        version: syncState.version,
        pendingCount: syncState.pendingCount,
        lastSyncedAt: syncState.lastSyncedAt?.toISOString() || null,
        lastError: syncState.lastError,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
      },
      null,
      2
    );
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Trạng Thái Đồng Bộ Đám Mây</h3>
              <p className="text-xs text-slate-500">Cloudflare D1 • Versioned Storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 flex items-center justify-center rounded-lg hover:bg-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600">
          {/* Status Box */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Trạng thái:</span>
              <span
                className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                  syncState.status === 'synced'
                    ? 'bg-emerald-100 text-emerald-800'
                    : syncState.status === 'saving'
                    ? 'bg-amber-100 text-amber-800'
                    : syncState.status === 'pending'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {syncState.statusLabel}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Phiên bản dữ liệu (Version):</span>
              <span className="font-mono font-bold text-slate-800">v{syncState.version}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Thay đổi đang chờ lưu:</span>
              <span className="font-bold text-slate-800">{syncState.pendingCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Lần đồng bộ gần nhất:</span>
              <span className="font-medium text-slate-800">
                {syncState.lastSyncedAt
                  ? syncState.lastSyncedAt.toLocaleTimeString('vi-VN') +
                    ' - ' +
                    syncState.lastSyncedAt.toLocaleDateString('vi-VN')
                  : 'Chưa đồng bộ phiên này'}
              </span>
            </div>

            {syncState.lastError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-caption leading-relaxed">{syncState.lastError}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50/60 border border-blue-200/70 rounded-xl p-3 text-blue-900 text-caption leading-relaxed flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              Hệ thống tự động đồng bộ mỗi khi bạn chỉnh sửa, tự giải quyết xung đột khi dùng đồng thời nhiều thiết bị, và
              tự nạp dữ liệu mới khi mở lại ứng dụng.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600 font-medium text-xs transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép nhật ký'}</span>
          </button>

          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Đang lưu…' : 'Đồng bộ ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
