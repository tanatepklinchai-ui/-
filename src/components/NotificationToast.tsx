'use client';

import { useEffect } from 'react';

export type ToastMessage = {
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
};

type Props = {
  message: ToastMessage | null;
  onDismiss: () => void;
};

const styles = {
  success: {
    icon: '✓',
    iconStyle: 'bg-emerald-100 text-emerald-700',
    borderStyle: 'border-emerald-200',
    label: 'สำเร็จ',
  },
  error: {
    icon: '!',
    iconStyle: 'bg-rose-100 text-rose-700',
    borderStyle: 'border-rose-200',
    label: 'ไม่สำเร็จ',
  },
  info: {
    icon: 'i',
    iconStyle: 'bg-sky-100 text-sky-700',
    borderStyle: 'border-sky-200',
    label: 'แจ้งให้ทราบ',
  },
};

export default function NotificationToast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;
  const style = styles[message.type];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4 sm:justify-end sm:px-6">
      <section
        role={message.type === 'error' ? 'alert' : 'status'}
        aria-live={message.type === 'error' ? 'assertive' : 'polite'}
        className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border ${style.borderStyle} bg-white p-4 shadow-xl shadow-slate-900/10 animate-[toast-in_180ms_ease-out]`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-extrabold ${style.iconStyle}`} aria-hidden="true">
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase text-slate-400">{style.label}</p>
          <h2 className="mt-0.5 text-sm font-bold text-slate-900">{message.title}</h2>
          {message.description && <p className="mt-1 text-xs leading-relaxed text-slate-600">{message.description}</p>}
        </div>
        <button type="button" onClick={onDismiss} aria-label="ปิดข้อความแจ้งเตือน" className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          ×
        </button>
      </section>
      <style jsx>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
