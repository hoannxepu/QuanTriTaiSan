import React, { useState } from 'react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  X,
  ShieldCheck,
  RotateCw,
  LogIn,
} from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  accountName: string;
  onClose: () => void;
  onChangePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; reason?: string }>;
  onSuccessRelogin: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  accountName,
  onClose,
  onChangePassword,
  onSuccessRelogin,
}) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  // Password strength logic
  const getStrength = (p: string): { label: string; color: string; width: string } => {
    if (!p) return { label: '', color: 'bg-slate-200', width: '0%' };
    if (p.length < 6) return { label: 'Yếu', color: 'bg-rose-500', width: '33%' };
    const hasLetters = /[a-zA-Z]/.test(p);
    const hasNumbers = /[0-9]/.test(p);
    const hasSpecial = /[^a-zA-Z0-9]/.test(p);
    if (p.length >= 8 && hasLetters && (hasNumbers || hasSpecial)) {
      return { label: 'Mạnh', color: 'bg-emerald-500', width: '100%' };
    }
    return { label: 'Trung bình', color: 'bg-amber-500', width: '66%' };
  };

  const strength = getStrength(newPass);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPass) {
      setError('Vui lòng nhập mật khẩu hiện tại!');
      return;
    }
    if (newPass.length < 4) {
      setError('Mật khẩu mới phải có ít nhất 4 ký tự!');
      return;
    }
    if (newPass === oldPass) {
      setError('Mật khẩu mới không được trùng với mật khẩu cũ!');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    setLoading(true);
    try {
      const res = await onChangePassword(oldPass, newPass);
      if (res.success) {
        setSuccess('✓ Đổi mật khẩu thành công! Vui lòng đăng nhập lại bằng mật khẩu mới.');
        setIsDone(true);
        setOldPass('');
        setNewPass('');
        setConfirmPass('');
      } else {
        setError(res.reason || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ!');
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi cập nhật mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const handleReloginClick = () => {
    setIsDone(false);
    setSuccess('');
    onSuccessRelogin();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        id="change-password-modal"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative p-5 space-y-4"
      >
        {/* Close Button */}
        {!isDone && (
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="text-center relative pt-1">
          <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-amber-200/80 shadow-xs">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="text-base font-black text-slate-900 tracking-tight">
            Đổi Mật Khẩu Tài Khoản
          </h2>
          <div className="inline-flex items-center space-x-1.5 bg-slate-100 px-2.5 py-0.5 rounded-full mt-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span className="text-[11px] font-semibold text-slate-700">{accountName}</span>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2.5 rounded-xl font-semibold flex items-start gap-1.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* SUCCESS VIEW AFTER PASSWORD CHANGE */}
        {isDone ? (
          <div className="space-y-4 py-2 text-center animate-in fade-in">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl font-semibold leading-relaxed">
              <Check className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
              {success}
            </div>

            <button
              type="button"
              onClick={handleReloginClick}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập lại</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            {/* Old Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật Khẩu Hiện Tại
              </label>
              <div className="relative">
                <input
                  type={showOldPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)}
                  placeholder="Nhập mật khẩu đang dùng"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 pr-10 text-base sm:text-xs font-medium outline-none focus:border-amber-500 focus:bg-white transition text-slate-900"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowOldPass(!showOldPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Mật Khẩu Mới
                </label>
                {newPass && (
                  <span className="text-[10px] font-bold text-slate-500">
                    Độ mạnh: <span className={strength.color.replace('bg-', 'text-')}>{strength.label}</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Tối thiểu 4 ký tự"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 pr-10 text-base sm:text-xs font-medium outline-none focus:border-amber-500 focus:bg-white transition text-slate-900"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPass && (
                <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${strength.color} transition-all duration-300`}
                    style={{ width: strength.width }}
                  />
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Xác Nhận Mật Khẩu Mới
              </label>
              <div className="relative">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Nhập lại chính xác mật khẩu mới"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 text-base sm:text-xs font-medium outline-none focus:border-amber-500 focus:bg-white transition text-slate-900"
                />
                <Check className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Cập Nhật Mật Khẩu</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
