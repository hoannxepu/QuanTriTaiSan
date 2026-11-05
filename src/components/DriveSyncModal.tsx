import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  FileJson,
  Database,
  Cloud,
  ShieldCheck,
  Layers,
  ArrowRight,
  Settings2,
  HardDrive,
  Info
} from 'lucide-react';
import { getActiveAppsScriptUrl, setActiveAppsScriptUrl } from '../utils/storage';

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReloadFromCloud?: () => void;
}

interface DiagnosticResult {
  ok: boolean;
  httpStatus?: number;
  errorType?: string | null;
  errorMessage?: string;
  message?: string;
  url: string;
  pingMs: number;
  connectionMode?: string;
  connectedFile?: {
    id?: string;
    name?: string;
    url?: string;
    sizeBytes?: number;
    lastUpdated?: string;
    isTrashed?: boolean;
  };
  duplicatesCount?: number;
  duplicateCandidates?: Array<{
    id: string;
    name: string;
    lastUpdated: string;
    size: number;
  }>;
  stats?: {
    usersCount?: number;
    usersList?: string[];
    hasPasswords?: boolean;
  };
}

export const DriveSyncModal: React.FC<DriveSyncModalProps> = ({
  isOpen,
  onClose,
  onReloadFromCloud,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'code' | 'help'>('status');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(true);
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Ready-to-copy Google Apps Script Code
  const appsScriptCode = `/**
 * GOOGLE APPS SCRIPT - BỘ ĐỒNG BỘ DỮ LIỆU ĐÁM MÂY THÁP TÀI SẢN (PRODUCTION)
 * Giải quyết triệt để lỗi:
 *  1. Có nhiều file JSON trùng lặp hoặc file rác (Trash) trên Google Drive.
 *  2. Tự động chọn file mới nhất hoặc ghim cố định 1 File ID duy nhất.
 *  3. Khóa chống xung đột ghi đè đồng thời (ScriptLock).
 *  4. Cung cấp API chẩn đoán kiểm tra tình trạng kết nối (?check=1).
 */

// Tùy chọn 1: Ghim cố định File ID chính xác trên Google Drive (KHUYÊN DÙNG ĐỂ CHỐNG KẾT NỐI SAI 100%)
// Ví dụ: const PINNED_FILE_ID = "1a2b3c4d5e6f7g8h9i0j...";
const PINNED_FILE_ID = "";

// Tên file mặc định trên Google Drive
const DATABASE_FILE_NAME = "thaptaisan_database.json";

function getTargetDatabaseFile() {
  var explicitId = PINNED_FILE_ID;
  if (!explicitId) {
    try {
      explicitId = PropertiesService.getScriptProperties().getProperty("DATABASE_FILE_ID");
    } catch (e) {}
  }

  if (explicitId && explicitId.trim() !== "") {
    try {
      var pinnedFile = DriveApp.getFileById(explicitId.trim());
      if (pinnedFile && !pinnedFile.isTrashed()) {
        return { file: pinnedFile, mode: "PINNED_ID", duplicates: [] };
      }
    } catch (err) {
      Logger.log("Không tìm thấy file theo PINNED_FILE_ID: " + err);
    }
  }

  var filesIterator = DriveApp.getFilesByName(DATABASE_FILE_NAME);
  var validFiles = [];

  while (filesIterator.hasNext()) {
    var f = filesIterator.next();
    if (!f.isTrashed()) {
      validFiles.push({
        file: f,
        id: f.getId(),
        name: f.getName(),
        lastUpdated: f.getLastUpdated().getTime(),
        lastUpdatedStr: f.getLastUpdated().toISOString(),
        size: f.getSize()
      });
    }
  }

  if (validFiles.length > 0) {
    validFiles.sort(function(a, b) {
      return b.lastUpdated - a.lastUpdated;
    });

    var primary = validFiles[0];
    var duplicatesList = validFiles.slice(1).map(function(item) {
      return {
        id: item.id,
        name: item.name,
        lastUpdated: item.lastUpdatedStr,
        size: item.size
      };
    });

    return {
      file: primary.file,
      mode: validFiles.length > 1 ? "SMART_DEDUPLICATED_LATEST" : "SINGLE_MATCH",
      duplicates: duplicatesList
    };
  }

  var defaultPayload = JSON.stringify({
    passwords: {},
    users: {},
    created_at: new Date().toISOString(),
    system: "Tháp Tài Sản Cloud Sync"
  }, null, 2);

  var createdFile = DriveApp.createFile(DATABASE_FILE_NAME, defaultPayload, "application/json");
  return { file: createdFile, mode: "INITIALIZED_NEW", duplicates: [] };
}

function doGet(e) {
  var isCheck = e && e.parameter && (e.parameter.check === "1" || e.parameter.diagnose === "1");

  try {
    var target = getTargetDatabaseFile();
    var file = target.file;
    var content = file.getBlob().getDataAsString("UTF-8");

    if (isCheck) {
      var parsedData = {};
      var usersCount = 0;
      var usernames = [];
      try {
        parsedData = JSON.parse(content);
        if (parsedData && parsedData.users) {
          usernames = Object.keys(parsedData.users);
          usersCount = usernames.length;
        }
      } catch (err) {}

      var diagResult = {
        status: "ok",
        message: "Kết nối Google Drive thành công!",
        connectionMode: target.mode,
        connectedFile: {
          id: file.getId(),
          name: file.getName(),
          url: file.getUrl(),
          sizeBytes: file.getSize(),
          lastUpdated: file.getLastUpdated().toISOString(),
          isTrashed: file.isTrashed()
        },
        duplicatesCount: target.duplicates.length,
        duplicateCandidates: target.duplicates,
        stats: {
          usersCount: usersCount,
          usersList: usernames,
          hasPasswords: !!(parsedData && parsedData.passwords)
        },
        serverTimestamp: new Date().toISOString()
      };

      return ContentService.createTextOutput(JSON.stringify(diagResult, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(content)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Lỗi đọc file: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(20000);
    if (!hasLock) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Server bận. Vui lòng thử lại sau vài giây."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var postData = e && e.postData && e.postData.contents ? e.postData.contents : "";
    var parsedTest = JSON.parse(postData);

    var target = getTargetDatabaseFile();
    var file = target.file;
    file.setContent(postData);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Đã lưu an toàn",
      savedFileId: file.getId(),
      savedFileName: file.getName(),
      lastUpdated: file.getLastUpdated().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Lỗi ghi dữ liệu: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}`;

  // Load current configuration on open
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/drive/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.currentUrl) {
          setCurrentUrl(data.currentUrl);
          setInputUrl(data.currentUrl);
          setIsDefault(!data.isCustom);
          // Run initial diagnosis
          runDiagnostic(data.currentUrl);
        } else {
          const clientUrl = getActiveAppsScriptUrl();
          setCurrentUrl(clientUrl);
          setInputUrl(clientUrl);
          runDiagnostic(clientUrl);
        }
      })
      .catch(() => {
        const clientUrl = getActiveAppsScriptUrl();
        setCurrentUrl(clientUrl);
        setInputUrl(clientUrl);
        runDiagnostic(clientUrl);
      });
  }, [isOpen]);

  const runDiagnostic = async (urlToTest?: string) => {
    const url = (urlToTest || inputUrl || currentUrl).trim();
    if (!url) return;

    setIsDiagnosing(true);
    setDiagnostic(null);

    try {
      const response = await fetch(`/api/drive/diagnose?url=${encodeURIComponent(url)}`);
      const data: DiagnosticResult = await response.json();
      setDiagnostic(data);
    } catch (err: any) {
      setDiagnostic({
        ok: false,
        errorType: 'NETWORK_ERROR',
        errorMessage: 'Không thể kết nối đến backend proxy để kiểm tra URL: ' + (err.message || String(err)),
        url,
        pingMs: 0,
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSaveUrl = async () => {
    const trimmed = inputUrl.trim();
    if (!trimmed.startsWith('https://script.google.com/macros/s/')) {
      alert('Vui lòng nhập đúng định dạng URL Google Apps Script Web App (bắt đầu bằng https://script.google.com/macros/s/...)');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Lưu trên backend server
      const res = await fetch('/api/drive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      if (res.ok) {
        // 2. Lưu đồng thời trên local storage client
        setActiveAppsScriptUrl(trimmed);
        setCurrentUrl(trimmed);
        setIsDefault(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // Chạy lại kiểm tra
        await runDiagnostic(trimmed);

        if (onReloadFromCloud) {
          onReloadFromCloud();
        }
      } else {
        const err = await res.json();
        alert('Lỗi lưu URL: ' + (err.error || 'Thao tác không thành công'));
      }
    } catch (e: any) {
      alert('Lỗi kết nối tới máy chủ khi lưu URL: ' + e?.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('Khôi phục về URL Google Apps Script mặc định của hệ thống?')) return;
    setActiveAppsScriptUrl('');
    try {
      const res = await fetch('/api/drive/config');
      const data = await res.json();
      const def = data.defaultUrl || '';
      setInputUrl(def);
      await fetch('/api/drive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: def }),
      });
      setCurrentUrl(def);
      setIsDefault(true);
      runDiagnostic(def);
    } catch (e) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold leading-tight flex items-center gap-1.5">
                Kiểm Tra & Cấu Hình Google Drive JSON
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded font-mono font-medium">
                  v5.2
                </span>
              </h3>
              <p className="text-[10.5px] sm:text-xs text-slate-300 leading-tight">
                Chẩn đoán kết nối, phát hiện file JSON trùng lặp và xác thực File ID
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 shrink-0 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-2.5 px-3 border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Chẩn Đoán Kết Nối</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`py-2.5 px-3 border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Mã Nguồn Code.gs (Chống Lỗi)</span>
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`py-2.5 px-3 border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'help'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Hướng Dẫn 4 Bước</span>
          </button>
        </div>

        {/* Modal Body Content (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          
          {/* TAB 1: STATUS & DIAGNOSTICS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              
              {/* URL Input & Quick Actions */}
              <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-indigo-600" />
                    <span>Google Apps Script Web App URL</span>
                  </label>
                  {!isDefault && (
                    <button
                      onClick={handleResetToDefault}
                      className="text-[11px] text-slate-500 hover:text-rose-600 underline cursor-pointer"
                    >
                      Khôi phục mặc định
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfy.../exec"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => runDiagnostic()}
                      disabled={isDiagnosing}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                      <span>{isDiagnosing ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveUrl}
                      disabled={isSaving || inputUrl.trim() === currentUrl}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      {saveSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã lưu!</span>
                        </>
                      ) : (
                        <>
                          <Settings2 className="w-3.5 h-3.5" />
                          <span>Lưu URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Diagnosis Report Result Card */}
              {isDiagnosing && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center gap-3 animate-pulse">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                  <div>
                    <div className="font-bold text-blue-900">Đang ping và xác thực Google Apps Script...</div>
                    <div className="text-xs text-blue-700 mt-0.5">
                      Đang phân tích cấu trúc phản hồi, kiểm tra mã HTTP và kiểm tra các file JSON trên Drive...
                    </div>
                  </div>
                </div>
              )}

              {!isDiagnosing && diagnostic && (
                <div className="space-y-3">
                  {/* Status Banner */}
                  {diagnostic.ok ? (
                    <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-300 bg-emerald-50 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                            <span>Kết Nối Google Drive Thành Công</span>
                            <span className="text-[10px] bg-emerald-200 text-emerald-900 font-mono px-1.5 py-0.2 rounded font-bold">
                              {diagnostic.pingMs}ms
                            </span>
                          </div>
                          <div className="text-xs text-emerald-800 mt-1">
                            {diagnostic.message || 'Dữ liệu được đọc và đồng bộ thông suốt.'}
                          </div>
                        </div>
                      </div>

                      {/* Connected File Metadata Details */}
                      {diagnostic.connectedFile && (
                        <div className="mt-2.5 p-2.5 bg-white/80 rounded-lg border border-emerald-200 text-xs space-y-1.5">
                          <div className="font-bold text-slate-800 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                              <span>File JSON đang kết nối:</span>
                            </span>
                            <span className="font-mono text-emerald-700 font-bold">
                              {diagnostic.connectedFile.name || 'thaptaisan_database.json'}
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-600 gap-1 text-[11px]">
                            <div>
                              <span>File ID chính xác: </span>
                              <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 select-all font-semibold">
                                {diagnostic.connectedFile.id || 'N/A'}
                              </code>
                            </div>
                            {diagnostic.connectedFile.lastUpdated && (
                              <div className="text-slate-500 font-mono">
                                Sửa đổi: {new Date(diagnostic.connectedFile.lastUpdated).toLocaleString('vi-VN')}
                              </div>
                            )}
                          </div>

                          {diagnostic.stats && (
                            <div className="pt-1.5 border-t border-emerald-100 flex items-center justify-between text-[11px] text-slate-700">
                              <span>Số tài khoản người dùng lưu trong file:</span>
                              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                {diagnostic.stats.usersCount || 0} tài khoản
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Duplicate Files Warning Notice */}
                      {diagnostic.duplicatesCount && diagnostic.duplicatesCount > 0 ? (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-amber-900 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              Cảnh báo: Tìm thấy {diagnostic.duplicatesCount} file JSON trùng tên khác trên Google Drive!
                            </span>
                          </div>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            Mã script mới đã tự động sắp xếp và kết nối vào file có thời gian chỉnh sửa mới nhất.
                            Tuy nhiên, để đảm bảo 100% không bao giờ bị nhầm sang file cũ khi ai đó upload bản backup, bạn nên mở Google Apps Script và dán File ID{' '}
                            <code className="font-bold font-mono bg-amber-100 px-1 rounded select-all">
                              {diagnostic.connectedFile?.id}
                            </code>{' '}
                            vào biến <code className="font-bold">PINNED_FILE_ID</code>.
                          </p>

                          {diagnostic.duplicateCandidates && diagnostic.duplicateCandidates.length > 0 && (
                            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                                Các file trùng lặp cũ được bỏ qua:
                              </div>
                              {diagnostic.duplicateCandidates.map((dup, i) => (
                                <div
                                  key={dup.id || i}
                                  className="text-[10.5px] font-mono bg-white/70 p-1.5 rounded border border-amber-200 flex items-center justify-between text-slate-700"
                                >
                                  <span className="truncate max-w-[200px]">{dup.id}</span>
                                  <span className="text-slate-500">
                                    {new Date(dup.lastUpdated).toLocaleDateString('vi-VN')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    /* Error Banner */
                    <div className="p-3.5 sm:p-4 rounded-xl border border-rose-300 bg-rose-50 space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-rose-900 text-sm">
                            {diagnostic.errorType === 'NOT_FOUND_404'
                              ? '❌ Lỗi: URL Không Tồn Tại (Page Not Found 404)'
                              : diagnostic.errorType === 'AUTH_REQUIRED'
                              ? '❌ Lỗi: Quyền Truy Cập Bị Chặn (Cần Anyone)'
                              : '❌ Lỗi Kết Nối Google Apps Script'}
                          </div>
                          <div className="text-xs text-rose-800 mt-1 leading-relaxed">
                            {diagnostic.errorMessage}
                          </div>
                        </div>
                      </div>

                      {/* Explanation & Action Recommendation */}
                      <div className="p-2.5 bg-white/80 rounded-lg border border-rose-200 text-xs space-y-2 text-slate-800">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Nguyên nhân và giải pháp khắc phục ngay:</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-slate-700">
                          {diagnostic.errorType === 'NOT_FOUND_404' && (
                            <>
                              <li>
                                Mã triển khai (Deployment ID) trong URL cũ đã bị thay thế hoặc xóa trên Google Apps Script.
                              </li>
                              <li>
                                <strong>Cách khắc phục:</strong> Chuyển sang tab <strong>"Hướng Dẫn 4 Bước"</strong> hoặc <strong>"Mã Nguồn Code.gs"</strong>, tạo dự án Apps Script mới, nhấn <strong>Triển khai (Deploy) &gt; Tùy chọn triển khai mới &gt; Ứng dụng web</strong>, copy URL mới tạo và dán vào ô bên trên.
                              </li>
                            </>
                          )}
                          {diagnostic.errorType === 'AUTH_REQUIRED' && (
                            <>
                              <li>
                                Quyền truy cập hiện tại đang yêu cầu đăng nhập tài khoản Google cá nhân.
                              </li>
                              <li>
                                <strong>Cách khắc phục:</strong> Khi bấm Triển khai (Deploy) trong Google Apps Script, mục <strong>"Who has access" (Ai có quyền truy cập)</strong> bắt buộc phải chọn là <strong>"Anyone" (Bất kỳ ai)</strong>.
                              </li>
                            </>
                          )}
                          {diagnostic.errorType !== 'NOT_FOUND_404' && diagnostic.errorType !== 'AUTH_REQUIRED' && (
                            <>
                              <li>Kiểm tra lại đường truyền internet hoặc xác thực lại đường dẫn Web App.</li>
                              <li>Đảm bảo mã nguồn trên Apps Script được lưu và đã cấp quyền truy cập Google Drive.</li>
                            </>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Safety Architecture Note */}
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11.5px] text-slate-600 space-y-1 leading-relaxed">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cơ chế bảo vệ dữ liệu Offline-First & Multi-Client</span>
                </div>
                <p>
                  Ứng dụng áp dụng cơ chế 3 lớp (Bộ nhớ máy LocalStorage + SSE Real-Time Sync + Google Drive Cloud Storage). Khi Google Drive gặp lỗi hoặc mất mạng, ứng dụng vẫn hoạt động 100% bình thường trên thiết bị của bạn và tự động đồng bộ bù ngay khi kết nối Drive được nối lại.
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: CODE.GS SCRIPT */}
          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Mã Nguồn Google Apps Script Mới (Chống Trùng Lặp & Ghi Đè)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Sao chép toàn bộ mã dưới đây và dán đè vào tệp <code className="font-mono font-bold text-slate-800">Code.gs</code> trong Google Apps Script của bạn.
                  </p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0 ${
                    copiedCode
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã sao chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép mã</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code Display Area */}
              <div className="relative">
                <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[380px] border border-slate-800 select-all">
                  {appsScriptCode}
                </pre>
              </div>

              {/* Explanation of New Safeguards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                  <span className="font-bold text-indigo-900 block mb-0.5">1. Khử trùng lặp file (Deduplication)</span>
                  <span className="text-slate-600 text-[11px]">
                    Tự động lọc bỏ các file rác trong Thùng rác (Trash) và luôn chọn file có thời gian sửa đổi gần nhất.
                  </span>
                </div>
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">2. Khóa ScriptLock (Chống Ghi Đè)</span>
                  <span className="text-slate-600 text-[11px]">
                    Ngăn chặn tình trạng 2 thiết bị Web và Điện thoại ghi cùng lúc dẫn tới làm rách hoặc lỗi file JSON.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STEP-BY-STEP HELP */}
          {activeTab === 'help' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">
                4 Bước Thiết Lập Hoặc Sửa Lỗi Kết Nối Google Drive
              </h4>

              <div className="space-y-2.5">
                {/* Step 1 */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900">
                      Mở Google Apps Script
                    </div>
                    <p className="text-slate-600 text-xs">
                      Truy cập{' '}
                      <a
                        href="https://script.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5"
                      >
                        script.google.com <ExternalLink className="w-3 h-3" />
                      </a>
                      , đăng nhập tài khoản Google của bạn và nhấn <strong>"Dự án mới" (New project)</strong>.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900">
                      Dán mã nguồn Code.gs
                    </div>
                    <p className="text-slate-600 text-xs">
                      Xóa toàn bộ mã mặc định trong tệp <code>Code.gs</code>, chuyển sang tab <strong>"Mã Nguồn Code.gs"</strong> ở trên, nhấn nút <strong>Sao chép mã</strong> và dán vào. Nhấn biểu tượng Đĩa mềm để Lưu (Ctrl + S).
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900">
                      Triển khai dưới dạng Ứng dụng Web (Web App)
                    </div>
                    <p className="text-slate-600 text-xs">
                      Nhấn nút <strong>Triển khai (Deploy) &gt; Tùy chọn triển khai mới (New deployment)</strong>:
                    </p>
                    <ul className="list-disc pl-4 text-xs text-slate-700 space-y-0.5 mt-1 font-medium">
                      <li>Loại triển khai: Chọn biểu tượng Bánh răng &gt; <strong>Ứng dụng web (Web app)</strong>.</li>
                      <li>Thực thi dưới tên: <strong>Tôi (Me - your_email@gmail.com)</strong>.</li>
                      <li>
                        Người có quyền truy cập: <strong>Bất kỳ ai (Anyone)</strong> (Bắt buộc để app kết nối được).
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900">
                      Dán URL vào ứng dụng & Nhấn "Kiểm tra ngay"
                    </div>
                    <p className="text-slate-600 text-xs">
                      Google sẽ cung cấp cho bạn một đường link dạng{' '}
                      <code className="bg-slate-200 px-1 rounded font-mono text-[11px]">
                        https://script.google.com/macros/s/AKfy.../exec
                      </code>
                      . Copy đường link này, dán vào ô URL tại Tab 1 và nhấn <strong>Lưu URL</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Hệ thống bảo toàn dữ liệu tự động</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>

      </div>
    </div>
  );
};
