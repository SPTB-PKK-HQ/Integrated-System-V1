'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  iconBg?: string;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}

export default function CustomModal({ open, onClose, title, icon, iconBg, children, actions, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref}
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn ${wide ? 'w-full max-w-4xl' : 'w-full max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}>
        {icon && (
          <div className={`flex items-center justify-center pt-6 ${iconBg || ''}`}>
            <span className="text-4xl">{icon}</span>
          </div>
        )}
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 text-center">{title}</h3>
        </div>
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">{children}</div>
        {actions && <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">{actions}</div>}
        <button onClick={onClose} className="absolute top-3 right-4 text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
      </div>
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
