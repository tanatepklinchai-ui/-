'use client';

import { useEffect } from 'react';

export type ToastMessage = {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
};

export default function NotificationToast({ 
  message, 
  onDismiss 
}: { 
  message: ToastMessage | null, 
  onDismiss: () => void 
}) {
  // สั่งให้ป๊อปอัปหายไปเองหลังจาก 4 วินาที
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 4000); 
      return () => clearTimeout(timer);
    }
  }, [message, onDismiss]);

  if (!message) return null;

  // ตั้งค่าธีมสีและไอคอนตามสถานะ
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100',
    error: 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100',
    info: 'bg-sky-50 border-sky-200 text-sky-800 shadow-sky-100',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 shadow-amber-100',
  };

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  return (
    <>
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 animate-toast-slide">
        <div className={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl ${styles[message.type]}`}>
          <span className="text-2xl shrink-0 mt-0.5" aria-hidden="true">
            {icons[message.type]}
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-sm truncate">{message.title}</h4>
            {message.description && (
              <p className="text-xs mt-1 opacity-90 leading-relaxed line-clamp-2">
                {message.description}
              </p>
            )}
          </div>
          <button 
            onClick={onDismiss} 
            className="text-current opacity-40 hover:opacity-100 hover:bg-black/5 transition-all p-1.5 rounded-full"
            aria-label="ปิดการแจ้งเตือน"
          >
            ✕
          </button>
        </div>
      </div>

      {/* แอนิเมชันสไลด์ลงมาอย่างนุ่มนวล */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes toastSlideDown {
          0% { opacity: 0; transform: translate(-50%, -20px) scale(0.95); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .animate-toast-slide {
          animation: toastSlideDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}} />
    </>
  );
}