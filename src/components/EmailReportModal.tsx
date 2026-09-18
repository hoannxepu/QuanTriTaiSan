import React, { useState, useEffect } from 'react';
import { DatabaseState, EmailScheduleSettings, CustomSmtpConfig, ScheduleFrequency } from '../types';
import {
  DEFAULT_EMAIL_SCHEDULE,
  getEmailScheduleSettings,
  saveEmailScheduleSettings,
  parseEmailList,
  generateEmailHtml,
  generatePlainTextSummary,
  formatScheduleLabel,
} from '../utils/emailReportGenerator';
import {
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  Send,
  Copy,
  Eye,
  Settings,
  X,
  Target,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  Layers,
  ExternalLink,
  Check,
  Loader2,
  AlertCircle,
  Save,
  Plus,
  Key,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Bell,
} from 'lucide-react';

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseState;
  userDisplay?: string;
  onSaveSchedule?: (newSchedule: EmailScheduleSettings) => void;
}

export const EmailReportModal: React.FC<EmailReportModalProps> = ({
  isOpen,
  onClose,
  db,
  userDisplay,
  onSaveSchedule,
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'preview'>('schedule');
  const [settings, setSettings] = useState<EmailScheduleSettings>(() =>
    getEmailScheduleSettings(db)
  );
  const [emailInput, setEmailInput] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [savedTimeStr, setSavedTimeStr] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSent, setIsSent] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Cấu hình SMTP thực tế (Google App Password)
  const [serverSmtpStatus, setServerSmtpStatus] = useState<{
    configured: boolean;
    user: string | null;
    host: string;
    port: number;
  } | null>(null);

  const [showSmtpGuide, setShowSmtpGuide] = useState<boolean>(false);
  const [customSmtp, setCustomSmtp] = useState<CustomSmtpConfig>(() => {
    try {
      const saved = localStorage.getItem('thaptaisan_custom_smtp');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      user: '',
      pass: '',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
    };
  });
  const [smtpSavedToast, setSmtpSavedToast] = useState<string>('');

  // Kiểm tra trạng thái máy chủ gửi thư
  const checkSmtpStatus = async () => {
    try {
      const res = await fetch('/api/smtp-status');
      if (res.ok) {
        const data = await res.json();
        setServerSmtpStatus(data);
      }
    } catch (e) {
      console.warn('Không thể kiểm tra trạng thái SMTP máy chủ:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const initial = getEmailScheduleSettings(db);
      const parsedEmails = parseEmailList(
        initial.emails && initial.emails.length > 0 ? initial.emails : initial.email
      );

      // Tự động điền email nếu chưa có và userDisplay là dạng email
      if (parsedEmails.length === 0 && userDisplay && userDisplay.includes('@')) {
        parsedEmails.push(userDisplay.trim().toLowerCase());
      }

      initial.emails = parsedEmails;
      initial.email = parsedEmails.join(', ');
      initial.frequency = initial.frequency || 'monthly';
      initial.sendWeekday = initial.sendWeekday ?? 1;

      const savedTime = initial.lastSavedAt || localStorage.getItem('thaptaisan_email_schedule_last_saved') || '';

      setSettings(initial);
      setEmailInput('');
      setIsSaved(Boolean(savedTime));
      setSavedTimeStr(savedTime);
      setIsSending(false);
      setIsSent(false);
      setSaveSuccessMessage('');
      setSendSuccessMessage('');
      setErrorMessage('');

      // Nạp cấu hình SMTP đã lưu
      try {
        const savedSmtp = localStorage.getItem('thaptaisan_custom_smtp');
        if (savedSmtp) {
          setCustomSmtp(JSON.parse(savedSmtp));
        } else if (userDisplay?.includes('@')) {
          setCustomSmtp((prev) => ({ ...prev, user: userDisplay }));
        }
      } catch (e) {}

      checkSmtpStatus();
    }
  }, [isOpen, db, userDisplay]);

  if (!isOpen) return null;

  // Thêm tất cả email sau khi người dùng gõ toàn bộ chuỗi (với dấu phẩy, chấm phẩy, v.v.)
  const handleAddEmail = (rawText?: string) => {
    const textToAdd = (rawText !== undefined ? rawText : emailInput).trim();
    if (!textToAdd) return;

    const newFound = parseEmailList(textToAdd);
    if (newFound.length === 0) {
      setErrorMessage(`Địa chỉ "${textToAdd}" không hợp lệ. Vui lòng nhập đúng định dạng email (vd: name@gmail.com).`);
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    const currentList = settings.emails || [];
    const combined = Array.from(new Set([...currentList, ...newFound]));

    setSettings({
      ...settings,
      emails: combined,
      email: combined.join(', '),
    });
    setEmailInput('');
    setErrorMessage('');
  };

  // Chỉ thêm khi nhấn Enter, KHÔNG ngắt khi đang gõ dấu phẩy hay chấm phẩy
  const handleKeyDownEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleRemoveEmail = (indexToRemove: number) => {
    const currentList = settings.emails || [];
    const updated = currentList.filter((_, idx) => idx !== indexToRemove);
    setSettings({
      ...settings,
      emails: updated,
      email: updated.join(', '),
    });
  };

  const handleClearAllEmails = () => {
    setSettings({
      ...settings,
      emails: [],
      email: '',
    });
  };

  // Lưu cấu hình lịch gửi + HIỆN XÁC NHẬN NGAY CHỖ LƯU
  const handleSave = () => {
    // Nếu trong ô nhập còn email chưa nhấn Thêm, tự động gom vào
    let finalEmails = settings.emails || [];
    if (emailInput.trim()) {
      const extra = parseEmailList(emailInput.trim());
      if (extra.length > 0) {
        finalEmails = Array.from(new Set([...finalEmails, ...extra]));
        setEmailInput('');
      }
    }

    if (finalEmails.length === 0) {
      setErrorMessage('Vui lòng nhập ít nhất một địa chỉ email nhận báo cáo trước khi lưu lịch.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    const now = new Date();
    const timeFormatted = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} - ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

    const updatedSettings: EmailScheduleSettings = {
      ...settings,
      emails: finalEmails,
      email: finalEmails.join(', '),
      lastSavedAt: timeFormatted,
    };

    setSettings(updatedSettings);
    setErrorMessage('');
    setSendSuccessMessage('');

    // Lưu vào Local Storage
    saveEmailScheduleSettings(updatedSettings);
    try {
      localStorage.setItem('thaptaisan_email_schedule_last_saved', timeFormatted);
    } catch (e) {}

    // Lưu vào Main DB / Cloud state via callback
    if (onSaveSchedule) {
      onSaveSchedule(updatedSettings);
    }

    setIsSaved(true);
    setSavedTimeStr(timeFormatted);
    setSaveSuccessMessage(
      `✓ ĐÃ LƯU CÀI ĐẶT LỊCH THÀNH CÔNG: ${formatScheduleLabel(updatedSettings)} • Gửi tới ${finalEmails.length} email (${finalEmails.join(', ')})`
    );
  };

  // Lưu cấu hình SMTP cá nhân vào localStorage
  const handleSaveCustomSmtp = () => {
    if (!customSmtp.user || !customSmtp.user.includes('@')) {
      setErrorMessage('Vui lòng nhập địa chỉ Gmail gửi thư hợp lệ.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    if (!customSmtp.pass || customSmtp.pass.length < 8) {
      setErrorMessage('Vui lòng nhập Mật khẩu ứng dụng 16 ký tự tạo từ Google.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    const cleanedSmtp = {
      ...customSmtp,
      user: customSmtp.user.trim().toLowerCase(),
      pass: customSmtp.pass.trim().replace(/\s+/g, ''),
      host: customSmtp.host || 'smtp.gmail.com',
      port: Number(customSmtp.port) || 465,
      secure: true,
    };

    localStorage.setItem('thaptaisan_custom_smtp', JSON.stringify(cleanedSmtp));
    setCustomSmtp(cleanedSmtp);
    setSmtpSavedToast('✓ Đã lưu thông tin xác thực Gmail SMTP! Bạn có thể gửi thư thật ngay.');
    setTimeout(() => setSmtpSavedToast(''), 4500);
  };

  // Thực hiện gửi email thực sự tới hòm thư
  const handleSendNow = async () => {
    let finalEmails = settings.emails || [];
    if (emailInput.trim()) {
      const extra = parseEmailList(emailInput.trim());
      if (extra.length > 0) {
        finalEmails = Array.from(new Set([...finalEmails, ...extra]));
        setEmailInput('');
        setSettings({
          ...settings,
          emails: finalEmails,
          email: finalEmails.join(', '),
        });
      }
    }

    if (finalEmails.length === 0) {
      setErrorMessage('Vui lòng nhập ít nhất một địa chỉ email nhận báo cáo.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    setErrorMessage('');
    setSaveSuccessMessage('');
    setIsSent(false);
    setIsSending(true);
    setSendSuccessMessage('');

    // Tự động lưu cài đặt
    const currentSettings = {
      ...settings,
      emails: finalEmails,
      email: finalEmails.join(', '),
    };
    saveEmailScheduleSettings(currentSettings);
    if (onSaveSchedule) {
      onSaveSchedule(currentSettings);
    }

    const currentMonthYear = new Date().toLocaleDateString('vi-VN', {
      month: '2-digit',
      year: 'numeric',
    });
    const subject = `[Tháp Tài Sản] Báo Cáo & Nhắc Nhở Mục Tiêu Tháng ${currentMonthYear}`;
    const htmlContent = generateEmailHtml(db, currentSettings, userDisplay);
    const textSummary = generatePlainTextSummary(db, currentSettings, userDisplay);

    // Chuẩn bị payload gửi thư
    const payload: any = {
      email: finalEmails.join(', '),
      emails: finalEmails,
      subject,
      htmlContent,
      textSummary,
      senderName: userDisplay || 'Tháp Tài Sản 3 Tầng',
    };

    // Nếu người dùng có nhập Mật khẩu ứng dụng custom SMTP
    if (customSmtp.user && customSmtp.pass) {
      payload.customSmtp = {
        user: customSmtp.user.trim(),
        pass: customSmtp.pass.trim().replace(/\s+/g, ''),
        host: customSmtp.host || 'smtp.gmail.com',
        port: Number(customSmtp.port) || 465,
        secure: true,
      };
    }

    try {
      const response = await fetch('/api/send-email-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsSent(true);
        setSendSuccessMessage(
          `✓ THÀNH CÔNG: Đã gửi email thật tới ${finalEmails.length} hòm thư (${finalEmails.join(', ')})! Hãy mở Gmail để kiểm tra.`
        );
        checkSmtpStatus();
      } else {
        setIsSent(false);
        if (result.error === 'CHƯA_CẤU_HÌNH_SMTP' || result.requiresConfig) {
          setShowSmtpGuide(true);
          setErrorMessage(
            '⚠️ Chưa cấu hình Mật khẩu ứng dụng Gmail (16 ký tự). Vui lòng xem khung hướng dẫn bên dưới để kích hoạt gửi thư thật.'
          );
        } else {
          setErrorMessage(result.error || 'Không thể gửi email. Vui lòng kiểm tra lại kết nối.');
        }
      }
    } catch (err: any) {
      setIsSent(false);
      console.warn('Lỗi khi gửi email:', err);
      setErrorMessage(`Lỗi mạng khi kết nối máy chủ: ${err?.message || 'Không thể gửi'}`);
    } finally {
      setIsSending(false);
    }
  };

  // Mở trình duyệt soạn thư Gmail Web trực tiếp (1-Click Fallback)
  const handleOpenGmailWeb = () => {
    const finalEmails = (settings.emails && settings.emails.length > 0)
      ? settings.emails
      : parseEmailList(settings.email);

    const currentMonthYear = new Date().toLocaleDateString('vi-VN', {
      month: '2-digit',
      year: 'numeric',
    });
    const subject = `[Tháp Tài Sản] Báo Cáo & Nhắc Nhở Mục Tiêu Tháng ${currentMonthYear}`;
    const textSummary = generatePlainTextSummary(db, settings, userDisplay);

    const toStr = encodeURIComponent(finalEmails.join(','));
    const suStr = encodeURIComponent(subject);
    const bodyStr = encodeURIComponent(textSummary);

    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toStr}&su=${suStr}&body=${bodyStr}`;
    window.open(gmailComposeUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyContent = () => {
    const plain = generatePlainTextSummary(db, settings, userDisplay);
    navigator.clipboard.writeText(plain);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const htmlPreview = generateEmailHtml(db, settings, userDisplay);

  const recipientList = settings.emails && settings.emails.length > 0
    ? settings.emails
    : parseEmailList(settings.email);

  const isRealSmtpReady = Boolean(
    serverSmtpStatus?.configured || (customSmtp.user && customSmtp.pass)
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] cursor-default"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight flex items-center gap-1.5">
                <span>Báo Cáo & Nhắc Nhở Email</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                  Gmail SMTP
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Lập lịch gửi tự động theo chu kỳ tuần, tháng, quý hoặc nửa năm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 bg-slate-50/80 text-xs font-bold shrink-0">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'schedule'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài Đặt Lịch & Email Nhận</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'preview'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem Trước Báo Cáo ({recipientList.length} email)</span>
            </button>
          </div>

          {/* SMTP Status Indicator Badge */}
          <div className="hidden sm:flex items-center space-x-1.5 text-[11px]">
            {isRealSmtpReady ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Sẵn sàng gửi thư thật</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowSmtpGuide(true)}
                className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full font-medium transition cursor-pointer"
              >
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span>Cần Mật khẩu ứng dụng Gmail</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {activeTab === 'schedule' ? (
            <div className="space-y-4">
              {/* 1. MỤC ĐIỀN NHIỀU EMAIL NHẬN BÁO CÁO CÙNG LÚC */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span>1. Danh Sách Email Nhận Báo Cáo</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ({recipientList.length} địa chỉ đã chọn)
                    </span>
                  </label>
                  <div className="flex items-center space-x-2">
                    {userDisplay && userDisplay.includes('@') && !recipientList.includes(userDisplay.toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => handleAddEmail(userDisplay)}
                        className="text-[10.5px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition"
                      >
                        + Thêm {userDisplay}
                      </button>
                    )}
                    {recipientList.length > 1 && (
                      <button
                        type="button"
                        onClick={handleClearAllEmails}
                        className="text-[10.5px] text-slate-500 hover:text-rose-600 transition cursor-pointer"
                      >
                        Xóa tất cả
                      </button>
                    )}
                  </div>
                </div>

                {/* Danh sách Tags/Chips email đã thêm */}
                {recipientList.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-200 rounded-lg min-h-[40px] items-center">
                    {recipientList.map((em, idx) => (
                      <span
                        key={`${em}-${idx}`}
                        className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium px-2.5 py-1 rounded-md shadow-xs animate-in fade-in"
                      >
                        <Mail className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{em}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(idx)}
                          className="text-emerald-700 hover:text-rose-600 hover:bg-emerald-100 rounded p-0.5 ml-0.5 transition cursor-pointer"
                          title="Xóa email này"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-amber-50/70 border border-dashed border-amber-300 rounded-lg text-amber-800 text-[11px]">
                    Chưa có email nào trong danh sách nhận. Vui lòng gõ hoặc dán email vào ô bên dưới rồi nhấn Thêm.
                  </div>
                )}

                {/* Input nhập nhiều email: Gõ tự do toàn bộ email kèm dấu phẩy/chấm phẩy, chỉ thêm khi nhấn Enter hoặc bấm Thêm */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Gõ toàn bộ email kèm dấu phẩy (,), chấm phẩy (;) rồi nhấn Thêm hoặc Enter..."
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={handleKeyDownEmail}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddEmail()}
                    className="px-4 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer shrink-0 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm</span>
                  </button>
                </div>

                <p className="text-[10.5px] text-slate-500 leading-relaxed">
                  💡 <strong>Tiện lợi:</strong> Bạn có thể gõ hoặc dán cùng lúc nhiều email (ngăn cách bởi dấu phẩy <code className="bg-slate-200 px-1 rounded text-slate-700">,</code> hoặc chấm phẩy <code className="bg-slate-200 px-1 rounded text-slate-700">;</code>). Sau khi gõ xong toàn bộ, chỉ cần nhấn <strong>Enter</strong> hoặc bấm nút <strong>Thêm</strong> 1 lần duy nhất!
                </p>
              </div>

              {/* 2. CẤU HÌNH LỊCH GỬI NHẮC NHỞ ĐỊNH KỲ (TUẦN, THÁNG, 2 THÁNG, 3 THÁNG, 6 THÁNG, NĂM...) */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>2. Thiết Lập Lịch Nhắc Nhở & Chu Kỳ Gửi</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={(e) =>
                        setSettings({ ...settings, enabled: e.target.checked })
                      }
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-[11px]">
                      {settings.enabled ? 'Đang Bật Tự Động' : 'Tắt Tự Động'}
                    </span>
                  </label>
                </div>

                {/* 3 Cột cấu hình: Kì gửi, Ngày/Thứ, Khung giờ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Chọn kì / Chu kỳ gửi */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Kì / Chu kỳ gửi:
                    </label>
                    <select
                      value={settings.frequency || 'monthly'}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          frequency: e.target.value as ScheduleFrequency,
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="weekly">Hàng tuần (1 tuần / lần)</option>
                      <option value="monthly">Hàng tháng (1 tháng / lần)</option>
                      <option value="2months">Định kỳ 2 tháng / lần</option>
                      <option value="quarterly">Định kỳ 3 tháng / lần (Mỗi Quý)</option>
                      <option value="6months">Định kỳ 6 tháng / lần (Nửa năm)</option>
                      <option value="yearly">Định kỳ hàng năm (1 năm / lần)</option>
                    </select>
                  </div>

                  {/* 2. Chọn Ngày trong tháng HOẶC Thứ trong tuần */}
                  <div>
                    {settings.frequency === 'weekly' ? (
                      <>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Chọn thứ trong tuần:
                        </label>
                        <select
                          value={settings.sendWeekday ?? 1}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              sendWeekday: Number(e.target.value),
                            })
                          }
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                        >
                          <option value={1}>Thứ Hai (Khởi đầu tuần mới)</option>
                          <option value={2}>Thứ Ba</option>
                          <option value={3}>Thứ Tư (Giữa tuần)</option>
                          <option value={4}>Thứ Năm</option>
                          <option value={5}>Thứ Sáu (Tổng kết tuần làm việc)</option>
                          <option value={6}>Thứ Bảy (Cuối tuần thảnh thơi)</option>
                          <option value={0}>Chủ Nhật (Kế hoạch tuần tới)</option>
                        </select>
                      </>
                    ) : (
                      <>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Chọn ngày gửi:
                        </label>
                        <select
                          value={settings.sendDay}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              sendDay: Number(e.target.value),
                            })
                          }
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                        >
                          <option value={1}>Ngày 1 (Đầu kỳ)</option>
                          <option value={5}>Ngày 5</option>
                          <option value={10}>Ngày 10 (Kỳ nhận lương)</option>
                          <option value={15}>Ngày 15 (Giữa kỳ)</option>
                          <option value={20}>Ngày 20</option>
                          <option value={25}>Ngày 25</option>
                          <option value={28}>Ngày 28 (Cuối kỳ)</option>
                          <option value={30}>Ngày 30</option>
                          <optgroup label="Tất cả các ngày khác">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={d}>
                                Ngày {d}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </>
                    )}
                  </div>

                  {/* 3. Khung giờ gửi */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Khung giờ gửi nhắc nhở:
                    </label>
                    <select
                      value={settings.sendHour}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          sendHour: Number(e.target.value),
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value={6}>06:00 Sáng sớm</option>
                      <option value={7}>07:00 Sáng (Bắt đầu ngày mới)</option>
                      <option value={8}>08:00 Sáng (Khởi động công việc)</option>
                      <option value={9}>09:00 Sáng</option>
                      <option value={10}>10:00 Sáng</option>
                      <option value={11}>11:00 Trưa</option>
                      <option value={12}>12:00 Trưa (Nghỉ trưa)</option>
                      <option value={14}>14:00 Chiều</option>
                      <option value={17}>17:00 Chiều</option>
                      <option value={18}>18:00 Chiều (Tan sở)</option>
                      <option value={19}>19:00 Tối</option>
                      <option value={20}>20:00 Tối (Thảnh thơi xem tài chính)</option>
                      <option value={21}>21:00 Buổi tối</option>
                      <option value={22}>22:00 Trước khi ngủ</option>
                    </select>
                  </div>
                </div>

                {/* Tóm tắt lịch gửi trực quan */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between flex-wrap gap-2 text-[11px]">
                  <div className="flex items-center space-x-1.5 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Lịch gửi đã chọn:</span>
                    <strong className="text-emerald-900 font-bold">
                      {formatScheduleLabel(settings)}
                    </strong>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10.5px] ${
                      settings.enabled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {settings.enabled ? '✓ Đang kích hoạt' : 'Đang tạm dừng'}
                  </span>
                </div>
              </div>

              {/* 3. CẤU HÌNH GỬI EMAIL THẬT VỀ GMAIL (MẬT KHẨU ỨNG DỤNG) */}
              <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <Key className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-slate-900 text-xs">
                      3. Cấu Hình Gửi Email Thật Về Gmail (Mật Khẩu Ứng Dụng)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSmtpGuide(!showSmtpGuide)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showSmtpGuide ? 'Thu gọn hướng dẫn' : 'Xem hướng dẫn 1 phút'}</span>
                    {showSmtpGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Status Banner */}
                <div className="p-2.5 rounded-lg border text-xs flex items-start gap-2 bg-white">
                  {isRealSmtpReady ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-emerald-900">
                          ✓ Đã kết nối Gmail SMTP ({serverSmtpStatus?.user || customSmtp.user})
                        </p>
                        <p className="text-[10.5px] text-slate-500">
                          Hệ thống đã sẵn sàng gửi email thật trực tiếp vào hộp thư Gmail của người nhận.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-amber-900">
                          Chưa thiết lập Mật khẩu ứng dụng 16 ký tự của Google
                        </p>
                        <p className="text-[10.5px] text-slate-600">
                          Để bảo mật, Google chặn gửi thư bằng mật khẩu đăng nhập thông thường. Bạn chỉ cần tạo một <strong>Mật khẩu ứng dụng (16 chữ cái)</strong> để gửi thư thật tới Gmail.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Expandable Guide & Input */}
                {(showSmtpGuide || !isRealSmtpReady) && (
                  <div className="space-y-3 pt-1 animate-in fade-in">
                    {/* Step by step box */}
                    <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-amber-950 text-[11px] space-y-1.5 leading-relaxed">
                      <p className="font-bold text-xs text-amber-900 flex items-center gap-1">
                        <span>📌 3 Bước Lấy Mật Khẩu Ứng Dụng Google (Rất Nhanh):</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                        <li>
                          Truy cập trang Google App Passwords:{' '}
                          <a
                            href="https://myaccount.google.com/apppasswords"
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 font-bold underline inline-flex items-center gap-0.5 hover:text-blue-800"
                          >
                            <span>myaccount.google.com/apppasswords</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>{' '}
                          (Đảm bảo tài khoản đã bật Xác minh 2 bước).
                        </li>
                        <li>
                          Tại ô <em>Tên ứng dụng</em>, nhập: <strong className="text-slate-900">Tháp Tài Sản</strong> → Bấm <strong>Tạo (Create)</strong>.
                        </li>
                        <li>
                          Google sẽ hiện một chuỗi 16 chữ cái (ví dụ: <code className="bg-white px-1 py-0.5 border rounded text-emerald-800 font-mono font-bold">abcd efgh ijkl mnop</code>). Hãy sao chép chuỗi này và điền vào ô bên dưới.
                        </li>
                      </ol>
                    </div>

                    {/* Custom SMTP Input Form */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white p-3 border border-slate-200 rounded-lg">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                          Địa chỉ Gmail gửi thư (Sender Gmail):
                        </label>
                        <input
                          type="email"
                          placeholder="ví dụ: hoannx.epu@gmail.com"
                          value={customSmtp.user}
                          onChange={(e) =>
                            setCustomSmtp({ ...customSmtp, user: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                          Mật khẩu ứng dụng Google (16 ký tự):
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="password"
                            placeholder="16 chữ cái (ví dụ: abcd efgh ijkl mnop)"
                            value={customSmtp.pass}
                            onChange={(e) =>
                              setCustomSmtp({ ...customSmtp, pass: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleSaveCustomSmtp}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded transition cursor-pointer shrink-0"
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    </div>

                    {smtpSavedToast && (
                      <p className="text-[11px] font-semibold text-emerald-700 animate-in fade-in">
                        {smtpSavedToast}
                      </p>
                    )}

                    {/* Alternative: 1-Click Gmail Web */}
                    <div className="flex items-center justify-between bg-slate-100/80 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-600">
                        Hoặc mở giao diện soạn thư Gmail Web để tự bấm gửi ngay:
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenGmailWeb}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded font-bold text-[11px] flex items-center space-x-1 transition cursor-pointer shadow-2xs"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Mở Gmail Soạn & Gửi Ngay</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. TÙY CHỌN NỘI DUNG BÁO CÁO */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2.5">
                <label className="block font-bold text-slate-800 text-xs">
                  4. Nội Dung Tùy Chọn Trong Báo Cáo
                </label>

                {/* 1. Monthly Goals */}
                <label className="flex items-start space-x-2.5 p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeMonthlyGoals}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeMonthlyGoals: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-emerald-900 block text-xs flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-emerald-600" />
                      <span>1. Mục Tiêu Tích Sản Tháng (Ưu tiên hàng đầu)</span>
                    </span>
                    <span className="text-[10.5px] text-emerald-700">
                      Bảng theo dõi định mức tháng, % hoàn thành và ngày gom từng tài sản.
                    </span>
                  </div>
                </label>

                {/* 2. Net Worth */}
                <label className="flex items-start space-x-2.5 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={settings.includeNetWorthOverview}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeNetWorthOverview: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>2. Tổng Quan Tài Sản Ròng (Net Worth) & Vị Thế Việt Nam</span>
                    </span>
                    <span className="text-[10.5px] text-slate-500">
                      Tổng tài sản, nợ phải trả, tỷ lệ đòn bẩy và đối chiếu phân tầng tài sản VN.
                    </span>
                  </div>
                </label>

                {/* 3. Debts */}
                <label className="flex items-start space-x-2.5 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={settings.includeDebts}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeDebts: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                      <span>3. Nghĩa Vụ Nợ & Lịch Thanh Toán Định Kỳ</span>
                    </span>
                    <span className="text-[10.5px] text-slate-500">
                      Chi tiết từng khoản nợ, dư nợ còn lại, tiền gốc + lãi mỗi tháng và hạn trả.
                    </span>
                  </div>
                </label>

                {/* 4. Cash Flow */}
                <label className="flex items-start space-x-2.5 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={settings.includeCashFlow}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeCashFlow: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                      <span>4. Dòng Tiền & Kế Hoạch Thặng Dư Ngân Sách</span>
                    </span>
                    <span className="text-[10.5px] text-slate-500">
                      Thu nhập lương, chi phí trả nợ và số tiền thặng dư đầu tư tháng.
                    </span>
                  </div>
                </label>

                {/* 5. Asset Pyramid Details */}
                <label className="flex items-start space-x-2.5 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={settings.includeAssetPyramid}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        includeAssetPyramid: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      <span>5. Danh Sách Chi Tiết Theo Từng Tầng Tháp Tài Sản (1 - 2 - 3)</span>
                    </span>
                    <span className="text-[10.5px] text-slate-500">
                      Bảng kê chi tiết tài sản Tầng Bảo đảm, Tăng trưởng, Rủi ro kèm giá trị cụ thể.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            /* Live HTML Preview Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>
                  Xem trước định dạng email sẽ gửi tới <strong>{recipientList.length}</strong> người nhận:
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyContent}
                    className="flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isCopied ? 'Đã sao chép!' : 'Sao chép văn bản'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenGmailWeb}
                    className="flex items-center space-x-1 text-blue-700 hover:text-blue-800 font-bold cursor-pointer ml-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở trong Gmail</span>
                  </button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-100 p-2 sm:p-4 max-h-[480px] overflow-y-auto">
                <div
                  className="email-rendered-preview bg-white rounded-xl shadow-xs"
                  dangerouslySetInnerHTML={{ __html: htmlPreview }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions: CỐ ĐỊNH Ở ĐÁY, KHÔNG BỊ CUỘN MẤT - CHỖ LƯU HIỆN XÁC NHẬN VÀ TRẠNG THÁI VĨNH VIỄN (PHƯƠNG ÁN B) */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2.5">
          {/* 1. KHỐI TÍN HIỆU XOAY KHI ĐANG GỬI THƯ THẬT */}
          {isSending && (
            <div className="p-3 bg-blue-50 border-2 border-blue-400 text-blue-950 rounded-xl text-xs flex items-center justify-between gap-2.5 animate-in fade-in shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-blue-950 text-xs">
                      Đang gửi email báo cáo thật qua máy chủ Gmail SMTP...
                    </span>
                    <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-mono font-bold animate-pulse">
                      Đang kết nối & gửi thư
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 mt-0.5 truncate">
                    Vui lòng chờ giây lát, hệ thống đang gửi tới {recipientList.length} địa chỉ email ({recipientList.join(', ')})...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. KHỐI XÁC NHẬN GỬI THƯ THÀNH CÔNG (HIỆN NGAY CHỖ NÚT BẤM KHI HOÀN TẤT) */}
          {sendSuccessMessage && !isSending && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-500 text-emerald-950 rounded-xl text-xs flex items-start justify-between gap-2.5 animate-in fade-in shadow-xs">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-emerald-900 text-xs tracking-tight">
                      ✓ XÁC NHẬN: ĐÃ GỬI EMAIL BÁO CÁO THÀNH CÔNG!
                    </span>
                    <span className="text-[10.5px] bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded font-mono font-bold">
                      Đã hoàn tất
                    </span>
                  </div>
                  <p className="text-[11.5px] text-emerald-800 mt-1 leading-relaxed">
                    {sendSuccessMessage}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSendSuccessMessage('')}
                className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-200/60 transition cursor-pointer shrink-0"
                title="Đóng xác nhận này"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 3. THÔNG BÁO LỖI / CHƯA CẤU HÌNH GỬI THƯ (HIỆN NGAY CHỖ NÚT BẤM) */}
          {errorMessage && !isSending && (
            <div className="p-3 bg-rose-50 border-2 border-rose-400 text-rose-950 rounded-xl text-xs flex items-start justify-between gap-2.5 animate-in fade-in shadow-xs">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs font-semibold text-rose-900 leading-relaxed">
                  {errorMessage}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-rose-700 hover:text-rose-950 p-1 rounded-lg hover:bg-rose-100 transition cursor-pointer shrink-0"
                title="Đóng thông báo lỗi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 4. KHỐI XÁC NHẬN ĐÃ LƯU LỊCH THÀNH CÔNG (HIỆN NGAY TRÊN HÀNG NÚT BẤM, KHÔNG TỰ TẮT NHANH) */}
          {saveSuccessMessage && !isSending && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-500 text-emerald-950 rounded-xl text-xs flex items-start justify-between gap-2.5 animate-in fade-in shadow-xs">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-emerald-900 text-xs tracking-tight">
                      ✓ XÁC NHẬN: ĐÃ LƯU CÀI ĐẶT LỊCH THÀNH CÔNG!
                    </span>
                    {(savedTimeStr || settings.lastSavedAt) && (
                      <span className="text-[10.5px] bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded font-mono font-bold">
                        Lúc: {savedTimeStr || settings.lastSavedAt}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-emerald-800 mt-1 leading-relaxed">
                    • <strong>Lịch định kỳ:</strong> {formatScheduleLabel(settings)}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-0.5 truncate">
                    • <strong>Email nhận ({recipientList.length}):</strong> {recipientList.join(', ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveSuccessMessage('')}
                className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-200/60 transition cursor-pointer shrink-0"
                title="Đóng xác nhận này"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 5. HÀNG NÚT HÀNH ĐỘNG VÀ DÒNG TRẠNG THÁI VĨNH VIỄN (PHƯƠNG ÁN B) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyContent}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isCopied ? '✓ Đã sao chép' : 'Sao chép tóm tắt'}</span>
              </button>

              {/* DÒNG TRẠNG THÁI XOAY KHI GỬI HOẶC TRẠNG THÁI LƯU VĨNH VIỄN */}
              {isSending ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-100/80 border border-blue-300 text-blue-900 text-[11px] font-bold animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                  <span>Đang kết nối gửi thư thật...</span>
                </div>
              ) : (savedTimeStr || settings.lastSavedAt) ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-100/70 border border-emerald-300 text-emerald-900 text-[11px] font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 animate-pulse"></span>
                  <span>Đã lưu:</span>
                  <span className="font-black font-mono">{savedTimeStr || settings.lastSavedAt}</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 italic">Chưa lưu cấu hình</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* NÚT LƯU CÀI ĐẶT LỊCH */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSending}
                className={`px-4 py-2 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center space-x-1.5 shadow-sm ${
                  isSaved
                    ? 'bg-emerald-700 hover:bg-emerald-800 shadow-md shadow-emerald-700/20'
                    : 'bg-slate-900 hover:bg-black'
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-200" />
                    <span>✓ Đã Lưu Cài Đặt!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-slate-300" />
                    <span>Lưu Cài Đặt Lịch</span>
                  </>
                )}
              </button>

              {/* NÚT GỬI EMAIL THẬT NGAY */}
              <button
                type="button"
                onClick={handleSendNow}
                disabled={isSending}
                className={`px-4 py-2 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-md ${
                  isSending
                    ? 'bg-blue-600 hover:bg-blue-600 shadow-blue-600/30 cursor-wait'
                    : isSent
                    ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-600/20'
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
                    <span>Đang gửi thư ({recipientList.length})...</span>
                  </>
                ) : isSent ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-200" />
                    <span>✓ Đã Gửi Thư Xong!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi Thư Thật Ngay ({recipientList.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
