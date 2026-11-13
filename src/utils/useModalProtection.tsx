import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface UseModalProtectionOptions {
  isOpen: boolean;
  isDirty?: boolean;
  onClose: () => void;
  autoFocus?: boolean;
}

export function useModalProtection({
  isOpen,
  isDirty = false,
  onClose,
  autoFocus = true,
}: UseModalProtectionOptions) {
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const isDirtyRef = useRef(isDirty);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      setShowConfirmDiscard(false);
    }
  }, [isOpen]);

  const requestClose = useCallback(() => {
    if (isDirtyRef.current) {
      setShowConfirmDiscard(true);
    } else {
      onCloseRef.current();
    }
  }, []);

  const confirmDiscard = useCallback(() => {
    setShowConfirmDiscard(false);
    onCloseRef.current();
  }, []);

  const cancelDiscard = useCallback(() => {
    setShowConfirmDiscard(false);
  }, []);

  // Khóa cuộn trang nền (body scroll lock) và tự focus vào ô nhập đầu tiên
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    if (autoFocus) {
      focusTimer = setTimeout(() => {
        const container = modalContainerRef.current;
        if (!container) return;
        const active = document.activeElement;
        if (active && container.contains(active) && active !== container) return;
        const firstInput = container.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([type="file"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
        }
      }, 40);
    }

    return () => {
      if (focusTimer) clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, autoFocus]);

  // Xử lý phím Esc: nếu chưa sửa gì thì đóng, nếu đã sửa thì hỏi xác nhận "Bỏ thay đổi?"
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showConfirmDiscard) {
          setShowConfirmDiscard(false);
        } else {
          requestClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirmDiscard, requestClose]);

  return {
    modalContainerRef,
    containerRef: modalContainerRef,
    requestClose,
    showConfirmDiscard,
    showConfirmClose: showConfirmDiscard,
    confirmDiscard,
    cancelDiscard,
  };
}

export const UnsavedChangesConfirmModal: React.FC<{
  isOpen: boolean;
  onConfirm?: () => void;
  onConfirmDiscard?: () => void;
  onCancel: () => void;
}> = ({ isOpen, onConfirm, onConfirmDiscard, onCancel }) => {
  if (!isOpen) return null;
  const handleConfirm = onConfirm || onConfirmDiscard || (() => {});

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1.5">Bỏ thay đổi đang nhập?</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Bạn đang có thông tin chưa lưu trong biểu mẫu. Nếu đóng hộp thoại bây giờ, các thay đổi vừa nhập sẽ bị hủy.
          </p>
        </div>
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
          >
            Tiếp tục nhập
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition cursor-pointer"
          >
            Bỏ thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};
