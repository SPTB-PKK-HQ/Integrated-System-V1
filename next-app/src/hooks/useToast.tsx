'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success', duration = 2800) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration + 400);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const icons: Record<ToastType, string> = {
    success: '✓', error: '✗', info: 'ℹ', warning: '⚠',
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2" id="toastContainer">
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg cursor-pointer
              transition-all duration-300 min-w-[280px] max-w-[400px]
              animate-[slideUp_0.3s_ease-out]
              ${toast.type === 'success' ? 'bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800' : ''}
              ${toast.type === 'error' ? 'bg-red-50 border-l-4 border-red-500 text-red-800' : ''}
              ${toast.type === 'info' ? 'bg-blue-50 border-l-4 border-blue-500 text-blue-800' : ''}
              ${toast.type === 'warning' ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-800' : ''}
            `}
          >
            <span className="text-lg font-bold w-6 h-6 flex items-center justify-center">
              {icons[toast.type]}
            </span>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
