import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  RotateCw,
  LogOut,
  Clock,
  ScanFace,
  Menu,
  X,
  ShieldCheck,
  CheckCircle2,
  User,
  Sparkles,
  TrendingUp,
  Mail,
  KeyRound,
  FileSpreadsheet,
  Layers,
  Scale,
  Target,
  FolderUp,
  FileJson,
  Calendar,
  FileText,
  Cloud,
} from 'lucide-react';
import { PyramidLogo } from './PyramidLogo';
import { ActiveTab } from '../types';
import { SyncEngineState } from '../utils/syncEngine';

interface HeaderProps {
  currentTab: ActiveTab;
  onSwitchTab: (tab: ActiveTab) => void;
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  userDisplay: string;
  onOpenImportExcel: () => void;
  onExportExcel: () => void;
  onLogout: () => void;
  syncState?: SyncEngineState;
  cloudSyncStatus?: string;
  onSyncDrive?: () => void;
  isSyncing?: boolean;
  lastUpdate?: string;
  lastSyncTime?: string;
  onOpenEmailReport?: () => void;
  onOpenChangePassword?: () => void;
  onRestoreJson?: () => void;
  onBackupJson?: () => void;
  onOpenFinancialCalendar?: () => void;
  onOpenHealthReport?: () => void;
  onOpenSyncDiagnostics?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSwitchTab,
  isPrivacyMode,
  onTogglePrivacy,
  userDisplay,
  onOpenImportExcel,
  onExportExcel,
  onLogout,
  syncState,
  cloudSyncStatus = 'synced',
  onSyncDrive,
  isSyncing = false,
  lastUpdate,
  lastSyncTime,
  onOpenEmailReport,
  onOpenChangePassword,
  onRestoreJson,
  onBackupJson,
  onOpenFinancialCalendar,
  onOpenHealthReport,
  onOpenSyncDiagnostics,
}) => {
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Real-time Digital Clock State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format real-time clock string: HH:mm:ss
  const timeString = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Format full date with 4-digit year: DD/MM/YYYY
  const dateString = currentTime.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Face ID state in localStorage
  const [faceIdActive, setFaceIdActive] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('thaptaisan_faceid_enabled') === '1';
  });

  // Format account greeting display (e.g., "Xin chào 0966***")
  const getGreetingText = (acc?: string) => {
    if (!acc) return 'Xin chào 0966***';
    const trimmed = acc.trim();
    if (trimmed.includes('***')) {
      return `Xin chào ${trimmed}`;
    }
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 7) {
      return `Xin chào ${digits.slice(0, 4)}***`;
    }
    if (trimmed.includes('@')) {
      const [u] = trimmed.split('@');
      return `Xin chào ${u.slice(0, 3)}***`;
    }
    if (trimmed.length > 4) {
      return `Xin chào ${trimmed.slice(0, 4)}***`;
    }
    return `Xin chào ${trimmed}`;
  };

  const handleToggleFaceId = () => {
    const next = !faceIdActive;
    setFaceIdActive(next);
    if (next) {
      localStorage.setItem('thaptaisan_faceid_enabled', '1');
    } else {
      localStorage.removeItem('thaptaisan_faceid_enabled');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSyncingActive = isSyncing || cloudSyncStatus === 'syncing' || cloudSyncStatus === 'conflict_merging';

  const handleSyncClick = () => {
    if (onSyncDrive) {
      onSyncDrive();
    }
  };

  return (
    <header className="w-full">
      {/* Top Fixed Header Bar */}
      <div className="h-12 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 min-w-0">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white p-0.5 sm:p-1 shadow-xs border border-slate-200/90 flex items-center justify-center shrink-0">
            <PyramidLogo className="w-full h-full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-black text-xs sm:text-sm md:text-base text-slate-900 tracking-tight block leading-tight truncate">
                Tháp Tài Sản
              </span>
              <span className="text-[7.5px] sm:text-[9.5px] bg-emerald-100 text-emerald-800 px-1 sm:px-1.5 py-0.2 rounded font-bold shrink-0">
                v5.2
              </span>
            </div>
            <span className="text-[8px] sm:text-[10px] text-slate-500 font-medium truncate leading-none mt-0.5 block">
              Hoạch Định & Quản Trị
            </span>
          </div>
        </div>

        {/* Center: Slogan Badge & Digital Clock (Theo đúng Ảnh 2 - Không đưa 4 tab lên đầu vì đã có ở thanh điều hướng dưới) */}
        <div className="hidden md:flex items-center space-x-2 lg:space-x-3">
          {/* Pill Slogan Tích Sản (Theo đúng ảnh 2) */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/90 rounded-full text-xs font-semibold shadow-2xs select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">Tích sản vững chắc • Quản trị bền vững • Tự do tài chính</span>
          </div>

          {/* REAL-TIME DIGITAL CLOCK WITH FULL YEAR (HH:mm:ss • DD/MM/YYYY) */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/80 rounded-lg sm:rounded-xl transition shadow-2xs shrink-0 select-none">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 animate-pulse shrink-0" />
            <div className="flex items-center space-x-1 font-mono text-[10px] sm:text-xs font-bold text-slate-800">
              <span className="tracking-tight">{timeString}</span>
              <span className="text-slate-300">•</span>
              <span className="text-[9.5px] sm:text-[11px] text-slate-600 font-medium">{dateString}</span>
            </div>
          </div>
        </div>

        {/* Right Action Cluster: Sync Badge, Privacy Eye, User Greeting + 3-Line Menu */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
          {/* Discreet Honest Sync Status Badge */}
          {syncState && onOpenSyncDiagnostics && (
            <button
              onClick={onOpenSyncDiagnostics}
              className="h-7 sm:h-8 px-2 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center space-x-1.5 text-slate-600 transition cursor-pointer shrink-0 border border-slate-200/60"
              title={`Trạng thái: ${syncState.statusLabel}. Nhấn để xem chi tiết.`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  syncState.status === 'synced'
                    ? 'bg-emerald-500'
                    : syncState.status === 'saving'
                    ? 'bg-amber-500 animate-pulse'
                    : syncState.status === 'pending'
                    ? 'bg-orange-500'
                    : 'bg-slate-400'
                }`}
              />
              <span className="hidden xl:inline text-[11px] font-medium text-slate-600">
                {syncState.status === 'synced' ? 'Đã đồng bộ' : syncState.statusLabel}
              </span>
            </button>
          )}

          {/* Privacy Toggle (Eye) */}
          <button
            onClick={onTogglePrivacy}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0"
            title={isPrivacyMode ? 'Hiện số tiền' : 'Ẩn số tiền'}
          >
            {isPrivacyMode ? (
              <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
            ) : (
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          {/* 3-Line Hamburger Menu Button with Greeting (3 gạch + Xin chào 0966***) */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`flex items-center space-x-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer shrink-0 border select-none ${
                showMenu
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'
              }`}
              title="Tài khoản & Menu tùy chọn"
            >
              {showMenu ? (
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
              ) : (
                <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 shrink-0" />
              )}
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 whitespace-nowrap">
                {getGreetingText(userDisplay)}
              </span>
            </button>

            {/* Hamburger Dropdown Action Menu */}
            {showMenu && (
              <div className="absolute right-0 top-9 sm:top-10 z-50 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 text-xs text-slate-700 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                {/* User Account Info Header */}
                <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                      <Menu className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-slate-400 font-medium">Tài khoản đăng nhập:</div>
                      <div className="font-bold text-slate-900 truncate text-xs">{getGreetingText(userDisplay)}</div>
                    </div>
                  </div>
                </div>

                {/* Email Report Action */}
                {onOpenEmailReport && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenEmailReport();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-center space-x-2 text-emerald-800 font-semibold cursor-pointer border-b border-slate-100"
                  >
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span>Báo Cáo & Nhắc Nhở Email</span>
                  </button>
                )}

                {/* 1-Page Financial Health Report PDF */}
                {onOpenHealthReport && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenHealthReport();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-blue-50 flex items-center space-x-2 text-blue-800 font-semibold cursor-pointer border-b border-slate-100"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Xuất Báo Cáo Sức Khỏe (PDF 1 Trang)</span>
                  </button>
                )}

                {/* Financial Calendar */}
                {onOpenFinancialCalendar && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenFinancialCalendar();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 flex items-center space-x-2 text-indigo-800 font-semibold cursor-pointer border-b border-slate-100"
                  >
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>Lịch Tài Chính & Dòng Tiền</span>
                  </button>
                )}

                {/* Tiện Ích & Đời Sống */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onSwitchTab('utilities');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-purple-50 flex items-center space-x-2 text-purple-900 font-semibold cursor-pointer border-b border-slate-100"
                >
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Tiện Ích (Lịch, Giỗ & Quán Ăn)</span>
                </button>

                {/* Cloud D1 Sync Diagnostics */}
                {onOpenSyncDiagnostics && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenSyncDiagnostics();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-sky-50 flex items-center space-x-2 text-sky-900 font-semibold cursor-pointer border-b border-slate-100"
                  >
                    <Cloud className="w-4 h-4 text-sky-600" />
                    <span>Trạng Thái Đồng Bộ Đám Mây</span>
                  </button>
                )}

                {/* Face ID Quick Settings Toggle */}
                <div
                  className="px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 cursor-pointer select-none"
                  onClick={handleToggleFaceId}
                >
                  <div className="flex items-center space-x-2">
                    <ScanFace className={`w-4 h-4 ${faceIdActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-700">Mở khóa Face ID</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      faceIdActive ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {faceIdActive ? 'Đang bật' : 'Đang tắt'}
                  </span>
                </div>

                {/* Change Password Button (Đổi mật khẩu tài khoản bên trong) */}
                {onOpenChangePassword && (
                  <div className="border-b border-slate-100 py-0.5">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenChangePassword();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-amber-50/70 flex items-center space-x-2 text-slate-700 hover:text-amber-800 transition cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold text-xs">Đổi mật khẩu tài khoản</span>
                    </button>
                  </div>
                )}

                {/* Excel Import & Export Action Buttons */}
                <div className="py-1 border-b border-slate-100 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenImportExcel();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50/70 flex items-center space-x-2 text-slate-700 hover:text-emerald-800 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-xs">Nhập dữ liệu từ Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onExportExcel();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50/70 flex items-center space-x-2 text-slate-700 hover:text-emerald-800 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-xs">Xuất toàn bộ danh mục ra Excel</span>
                  </button>
                </div>

                {/* JSON Backup & Restore Action Buttons */}
                <div className="py-1 border-b border-slate-100 space-y-0.5">
                  {onRestoreJson && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onRestoreJson();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-indigo-50/70 flex items-center space-x-2 text-slate-700 hover:text-indigo-800 transition cursor-pointer"
                    >
                      <FolderUp className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-semibold text-xs">Khôi phục từ tệp sao lưu JSON</span>
                    </button>
                  )}

                  {onBackupJson && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onBackupJson();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-indigo-50/70 flex items-center space-x-2 text-slate-700 hover:text-indigo-800 transition cursor-pointer"
                    >
                      <FileJson className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-semibold text-xs">Sao lưu dữ liệu ra tệp JSON</span>
                    </button>
                  )}
                </div>

                {/* Log Out Button (Đưa phần Thoát vào bên trong Menu 3 gạch) */}
                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-rose-50 flex items-center space-x-2 text-rose-600 font-bold cursor-pointer transition rounded-b-xl"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất / Thoát tài khoản</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
