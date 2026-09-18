import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ShieldCheck,
  RotateCw,
  ScanFace,
  Check,
  KeyRound,
  AlertTriangle,
  LogIn,
  X,
  ArrowLeft,
  Monitor,
} from 'lucide-react';
import { PyramidLogo } from './PyramidLogo';
import { normalizeAccountKey } from '../utils/format';
import {
  getRegisteredAccountsList,
  recordRegisteredAccount,
  isPlatformBiometricAvailable,
  hasPlatformBiometricEnrolled,
  registerPlatformBiometric,
  authenticatePlatformBiometric,
} from '../utils/faceIdEngine';

interface AuthModalProps {
  isOpen: boolean;
  onLogin: (account: string, pass: string, remember: boolean) => Promise<{ success: boolean; reason?: string } | boolean>;
  onRegister?: (account: string, pass: string, remember: boolean) => Promise<{ success: boolean; reason?: string } | boolean>;
  onResetPassword?: (account: string, newPass: string) => Promise<{ success: boolean; reason?: string } | boolean>;
  onFaceIdUnlock?: (accountName?: string) => Promise<boolean>;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onLogin,
  onRegister,
  onResetPassword,
  onFaceIdUnlock,
  onClose,
}) => {
  // Always default to password login
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');

  // Login inputs
  const [account, setAccount] = useState(() => localStorage.getItem('thaptaisan_saved_account') || '');
  const [pass, setPass] = useState(() => localStorage.getItem('thaptaisan_saved_pass') || '');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  // Register inputs
  const [regAccount, setRegAccount] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);

  // Forgot / Reset pass inputs
  const [forgotAccount, setForgotAccount] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [isResetSuccess, setIsResetSuccess] = useState(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPlatformSupported, setIsPlatformSupported] = useState<boolean>(true);
  const [showDesktopNoticeModal, setShowDesktopNoticeModal] = useState(false);

  // Helper detection for Desktop / PC vs Mobile
  const isDesktopDevice = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileOrTablet =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
    return !isMobileOrTablet;
  };

  useEffect(() => {
    isPlatformBiometricAvailable().then((avail) => setIsPlatformSupported(avail));
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const currentAcc = account.trim() || localStorage.getItem('thaptaisan_saved_account') || '';

  // Initialize inputs on open
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      setIsResetSuccess(false);
      const savedAcc = localStorage.getItem('thaptaisan_saved_account') || '';
      if (savedAcc) setAccount(savedAcc);
      const savedP = localStorage.getItem('thaptaisan_saved_pass') || '';
      if (savedP) setPass(savedP);

      const registeredList = getRegisteredAccountsList();
      if (registeredList.length === 0 && !savedAcc) {
        setActiveTab('register');
      } else {
        setActiveTab('login');
      }
    }
  }, [isOpen]);

  // Standard Password Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanAccount = account.trim();
    if (!cleanAccount) {
      setError('Vui lòng nhập Số điện thoại hoặc Gmail!');
      return;
    }
    if (!pass) {
      setError('Vui lòng nhập Mật khẩu bảo mật!');
      return;
    }

    setLoading(true);
    try {
      const res = await onLogin(cleanAccount, pass, remember);
      const isSuccess = typeof res === 'boolean' ? res : res.success;
      if (isSuccess) {
        recordRegisteredAccount(cleanAccount);
        if (remember) {
          localStorage.setItem('thaptaisan_saved_account', cleanAccount);
          localStorage.setItem('thaptaisan_saved_pass', pass);
        } else {
          localStorage.setItem('thaptaisan_saved_account', cleanAccount);
          localStorage.removeItem('thaptaisan_saved_pass');
        }
        setSuccessMsg('Đăng nhập thành công!');
        if (onClose) setTimeout(onClose, 200);
      } else {
        const msg = typeof res === 'object' && res.reason ? res.reason : 'Tài khoản hoặc mật khẩu không chính xác!';
        setError(msg);
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi xác thực tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  // Native Platform Hardware Biometrics (Face ID / Touch ID / Windows Hello)
  const handleNativeBiometricUnlock = async (overrideAccount?: string) => {
    setError('');
    setSuccessMsg('');

    // 1. Nếu là thiết bị máy tính không có phần cứng sinh trắc học
    if (isDesktopDevice()) {
      setShowDesktopNoticeModal(true);
      return;
    }

    // 2. Trên điện thoại / máy tính bảng:
    const targetAccount = (overrideAccount || account.trim() || currentAcc || localStorage.getItem('thaptaisan_saved_account') || '').trim();
    if (!targetAccount) {
      setError('Vui lòng nhập Số điện thoại hoặc Gmail tài khoản trước khi quét Face ID!');
      return;
    }

    setLoading(true);
    setSuccessMsg('Đang kích hoạt Face ID / Cảm biến hồng ngoại...');
    try {
      // 1. Gọi xác thực phần cứng thật qua WebAuthn API
      const authRes = await authenticatePlatformBiometric(targetAccount);
      if (!authRes.success) {
        // KHÔNG BYPASS: Báo lỗi chính xác và yêu cầu người dùng xác thực lại hoặc nhập mật khẩu
        setError(authRes.error || 'Xác thực Face ID không thành công. Vui lòng thử lại hoặc đăng nhập bằng Mật khẩu.');
        setLoading(false);
        return;
      }

      // 2. Xác thực phần cứng thành công -> Mở khóa phiên làm việc
      setSuccessMsg('✓ Xác thực Face ID thành công!');
      if (onFaceIdUnlock) {
        const ok = await onFaceIdUnlock(targetAccount);
        if (ok) {
          if (onClose) setTimeout(onClose, 200);
          return;
        }
      }

      const savedP = localStorage.getItem('thaptaisan_saved_pass');
      if (savedP) {
        await onLogin(targetAccount, savedP, true);
        if (onClose) setTimeout(onClose, 200);
        return;
      }

      setError('Xác thực Face ID thành công nhưng chưa tìm thấy phiên lưu. Vui lòng đăng nhập mật khẩu lần đầu.');
    } catch (err: any) {
      setError(err?.message || 'Không thể xác thực sinh trắc học.');
    } finally {
      setLoading(false);
    }
  };

  const validateRegisterInputs = () => {
    const cleanAccount = regAccount.trim();
    if (!cleanAccount) {
      setError('Vui lòng nhập Số điện thoại hoặc Gmail!');
      return null;
    }
    if (regPass.length < 4) {
      setError('Mật khẩu bảo mật phải có ít nhất 4 ký tự!');
      return null;
    }
    if (regPass !== regConfirmPass) {
      setError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại!');
      return null;
    }
    return cleanAccount;
  };

  // Register & Activate Native Device Biometrics
  const handleRegisterWithNativeBio = async () => {
    setError('');
    const cleanAccount = validateRegisterInputs();
    if (!cleanAccount) return;

    if (isDesktopDevice()) {
      setShowDesktopNoticeModal(true);
      return;
    }

    setLoading(true);
    setSuccessMsg('Đang kích hoạt cảm biến Face ID / Vân tay của thiết bị...');
    try {
      // 1. Tạo và đăng ký khóa sinh trắc học phần cứng WebAuthn
      const bioReg = await registerPlatformBiometric(cleanAccount);
      if (!bioReg.success) {
        setError(bioReg.error || 'Không thể kích hoạt Face ID phần cứng của thiết bị.');
        setLoading(false);
        return;
      }

      // 2. Tạo tài khoản trong hệ thống
      if (onRegister) {
        const regRes = await onRegister(cleanAccount, regPass, true);
        const isSuccess = typeof regRes === 'boolean' ? regRes : regRes.success;
        if (!isSuccess) {
          setError(typeof regRes === 'object' && regRes.reason ? regRes.reason : 'Không thể đăng ký tài khoản');
          setLoading(false);
          return;
        }
      }
      recordRegisteredAccount(cleanAccount);
      localStorage.setItem('thaptaisan_faceid_enabled', '1');
      localStorage.setItem('thaptaisan_faceid_account', cleanAccount);
      localStorage.setItem('thaptaisan_saved_account', cleanAccount);
      localStorage.setItem('thaptaisan_saved_pass', regPass);

      setSuccessMsg('✓ Đăng ký & Kích hoạt Face ID / Vân tay thành công!');
      setTimeout(async () => {
        await onLogin(cleanAccount, regPass, true);
        if (onClose) setTimeout(onClose, 200);
      }, 300);
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi kích hoạt sinh trắc học');
    } finally {
      setLoading(false);
    }
  };

  // Register with Password only
  const handleRegisterPasswordOnly = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    const cleanAccount = validateRegisterInputs();
    if (!cleanAccount) return;

    setLoading(true);
    try {
      if (onRegister) {
        const regRes = await onRegister(cleanAccount, regPass, true);
        const isSuccess = typeof regRes === 'boolean' ? regRes : regRes.success;
        if (!isSuccess) {
          setError(typeof regRes === 'object' && regRes.reason ? regRes.reason : 'Không thể đăng ký tài khoản');
          setLoading(false);
          return;
        }
      }
      recordRegisteredAccount(cleanAccount);
      setSuccessMsg('✓ Đăng ký tài khoản thành công!');
      setTimeout(async () => {
        await onLogin(cleanAccount, regPass, true);
      }, 300);
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi đăng ký tài khoản');
    } finally {
      setLoading(false);
    }
  };

  // Helper to transition cleanly from reset back to login tab
  const transitionToLoginAfterReset = (targetAccount: string) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setAccount(targetAccount);
    setPass(''); // Ô mật khẩu để trống để người dùng tự nhập mật khẩu mới
    setForgotNewPass('');
    setForgotConfirmPass('');
    setIsResetSuccess(false);
    setError('');
    setSuccessMsg('');
    setActiveTab('login');
  };

  // Reset Password from Outside (Quên / Đổi mật khẩu bên ngoài)
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const target = forgotAccount.trim() || account.trim();
    if (!target) {
      setError('Vui lòng nhập Số điện thoại hoặc Gmail tài khoản!');
      return;
    }
    if (forgotNewPass.length < 4) {
      setError('Mật khẩu mới phải có ít nhất 4 ký tự!');
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setError('Mật khẩu xác nhận không trùng khớp. Vui lòng kiểm tra lại!');
      return;
    }

    setLoading(true);
    try {
      if (onResetPassword) {
        const res = await onResetPassword(target, forgotNewPass);
        const isSuccess = typeof res === 'boolean' ? res : res.success;
        if (isSuccess) {
          setSuccessMsg('✓ Đổi mật khẩu thành công!');
          setIsResetSuccess(true);

          // Tự động chuyển về tab Đăng nhập sau 2 giây nếu người dùng không bấm nút
          resetTimerRef.current = setTimeout(() => {
            transitionToLoginAfterReset(target);
          }, 2000);
          return;
        } else {
          setError(typeof res === 'object' && res.reason ? res.reason : 'Không thể cập nhật mật khẩu.');
          setLoading(false);
          return;
        }
      } else {
        setError('Tính năng đổi mật khẩu chưa khả dụng.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi đổi mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        id="auth-modal-card"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative p-5 space-y-4"
      >
        {/* Close Button if permissible */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center relative pt-1">
          {activeTab === 'forgot' ? (
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-amber-200/90 shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-2 p-1 shadow-xs border border-slate-200/90 relative">
              <PyramidLogo className="w-full h-full" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-2.5 h-2.5" />
              </span>
            </div>
          )}
          <h2 className="text-base font-black text-slate-900 tracking-tight">
            {activeTab === 'login'
              ? 'Đăng Nhập Tài Khoản'
              : activeTab === 'register'
              ? 'Đăng Ký Tài Khoản Mới'
              : 'Thiết Lập / Đổi Mật Khẩu'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            {activeTab === 'login'
              ? 'Quản trị Tháp Tài Sản Cá Nhân'
              : activeTab === 'register'
              ? 'Bảo vệ dữ liệu tài chính của bạn'
              : 'Đặt lại mật khẩu bảo mật mới cho tài khoản'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2.5 rounded-xl font-semibold flex items-start gap-1.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && !isResetSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* VIEW 1: LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handlePasswordLogin} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Số Điện Thoại / Gmail
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="0901234567 hoặc user@gmail.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 text-base sm:text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white transition text-slate-900"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Mật Khẩu Riêng Tư
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMsg('');
                    setIsResetSuccess(false);
                    setForgotAccount(account.trim());
                    setActiveTab('forgot');
                  }}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Quên / Đổi mật khẩu?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 pr-10 text-base sm:text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white transition text-slate-900"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Checkbox */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700">Ghi nhớ đăng nhập</span>
              </label>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3 rounded-xl text-sm transition cursor-pointer flex items-center justify-center space-x-2 shadow-xs disabled:opacity-70 mt-1"
            >
              {loading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Đang kiểm tra tài khoản...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Đăng Nhập Vào Ứng Dụng</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-2 text-slate-400 text-[11px] font-medium">hoặc tùy chọn</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Native Hardware Face ID / Biometrics Button */}
            <button
              type="button"
              onClick={() => handleNativeBiometricUnlock(account.trim())}
              disabled={loading}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <ScanFace className="w-4 h-4 text-emerald-100 shrink-0" />
              <span>Đăng nhập bằng Face ID / Vân tay</span>
            </button>

            {/* Switch to Register */}
            <div className="text-center pt-2 text-xs text-slate-500">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMsg('');
                  setIsResetSuccess(false);
                  if (account) setRegAccount(account);
                  setActiveTab('register');
                }}
                className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer hover:underline"
              >
                Đăng ký tài khoản mới
              </button>
            </div>
          </form>
        )}

        {/* VIEW 2: REGISTER FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterPasswordOnly} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Số Điện Thoại / Gmail Tạo Mới
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  value={regAccount}
                  onChange={(e) => setRegAccount(e.target.value)}
                  placeholder="0901234567 hoặc user@gmail.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 text-base sm:text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition text-slate-900"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật Khẩu Thiết Lập
              </label>
              <div className="relative">
                <input
                  type={showRegPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  placeholder="Tối thiểu 4 ký tự"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 pr-10 text-base sm:text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition text-slate-900"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowRegPass(!showRegPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Xác Nhận Lại Mật Khẩu
              </label>
              <div className="relative">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={regConfirmPass}
                  onChange={(e) => setRegConfirmPass(e.target.value)}
                  placeholder="Nhập lại chính xác mật khẩu"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 text-base sm:text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition text-slate-900"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {/* Option 1: Hardware native biometrics (Face ID / Vân tay của máy) */}
              <button
                type="button"
                onClick={handleRegisterWithNativeBio}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-xs disabled:opacity-50"
              >
                <ScanFace className="w-4 h-4" />
                <span>Kích Hoạt Face ID / Vân Tay & Đăng Ký</span>
              </button>

              {/* Option 2: Password only */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Đăng Ký Bằng Mật Khẩu</span>
              </button>
            </div>

            <div className="text-center pt-1 text-xs text-slate-500">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsResetSuccess(false);
                  setActiveTab('login');
                }}
                className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer hover:underline"
              >
                Đăng nhập ngay
              </button>
            </div>
          </form>
        )}

        {/* VIEW 3: FORGOT / RESET PASSWORD FORM (Đổi mật khẩu bên ngoài) */}
        {activeTab === 'forgot' && (
          <div className="pt-1">
            {isResetSuccess ? (
              <div className="space-y-4 py-2 text-center animate-in fade-in">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-2xl font-semibold leading-relaxed">
                  <Check className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                  <div className="text-sm font-black text-emerald-900">✓ Đổi mật khẩu thành công!</div>
                  <p className="text-slate-600 text-xs mt-1">
                    Tự động chuyển về đăng nhập sau 2 giây...
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => transitionToLoginAfterReset(forgotAccount.trim() || account.trim())}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Quay lại Đăng nhập ngay</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số Điện Thoại / Gmail Cần Đổi
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      value={forgotAccount}
                      onChange={(e) => setForgotAccount(e.target.value)}
                      placeholder="0901234567 hoặc user@gmail.com"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 text-base sm:text-xs font-medium outline-none focus:border-amber-500 focus:bg-white transition text-slate-900"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật Khẩu Mới Thiết Lập
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={forgotNewPass}
                      onChange={(e) => setForgotNewPass(e.target.value)}
                      placeholder="Tối thiểu 4 ký tự"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 pr-10 text-base sm:text-xs font-medium outline-none focus:border-amber-500 focus:bg-white transition text-slate-900"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowForgotPass(!showForgotPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {showForgotPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Xác Nhận Lại Mật Khẩu Mới
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={forgotConfirmPass}
                      onChange={(e) => setForgotConfirmPass(e.target.value)}
                      placeholder="Nhập lại chính xác mật khẩu mới"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 pl-9 text-base sm:text-xs font-medium outline-none focus:border-amber-500 focus:bg-white transition text-slate-900"
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-xs disabled:opacity-50 mt-1"
                >
                  {loading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Đang cập nhật mật khẩu...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Xác Nhận Đổi Mật Khẩu</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-2 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setSuccessMsg('');
                      setActiveTab('login');
                    }}
                    className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer hover:underline inline-flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại đăng nhập</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Hộp thoại thông báo máy tính không hỗ trợ Face ID / Vân tay */}
      {showDesktopNoticeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 text-center space-y-3.5 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Thiết Bị Không Hỗ Trợ
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-1.5 px-2">
                Trình duyệt trên máy tính hiện không hỗ trợ cảm biến sinh trắc học Face ID / Vân tay trực tiếp. Vui lòng đăng nhập bằng <strong>Mật khẩu</strong> hoặc sử dụng ứng dụng trên <strong>Điện thoại</strong> để trải nghiệm tính năng này.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDesktopNoticeModal(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
            >
              Đã hiểu, đăng nhập bằng Mật khẩu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
