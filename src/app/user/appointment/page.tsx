// src/app/user/appointment/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import NotificationToast from '@/components/NotificationToast';
import type { ToastMessage } from '@/components/NotificationToast';

interface ChildOption {
  id: string;
  firstName: string | null;
}

interface AppointmentItem {
  id: string;
  hospitalName: string;
  scheduledAt: string;
  status: string;
}

export default function AppointmentPage() {
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [cancellationTarget, setCancellationTarget] = useState<AppointmentItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const notify = useCallback((type: ToastMessage['type'], title: string, description?: string) => {
    setToast({ type, title, description });
  }, []);
  const visibleAppointments = appointments.filter((appointment) => appointment.status !== 'CANCELLED');

  useEffect(() => {
    fetch('/api/children')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดข้อมูลเด็กได้');
        const loadedChildren: ChildOption[] = data.children ?? [];
        setChildren(loadedChildren);
        setLoading(loadedChildren.length > 0);
        setSelectedChildId(loadedChildren[0]?.id ?? '');
      })
      .catch((error) => {
        notify('error', 'โหลดข้อมูลเด็กไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง');
        setLoading(false);
      });
  }, [notify]);

  useEffect(() => {
    if (!selectedChildId) {
      return;
    }

    const controller = new AbortController();
    fetch(`/api/appointments?childId=${encodeURIComponent(selectedChildId)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดนัดหมายได้');
        setAppointments(data.appointments ?? []);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify('error', 'โหลดนัดหมายไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [notify, selectedChildId]);

  const handleCancelAppointment = async (id: string) => {
    setIsCancelling(true);
    try {
      const response = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id, status: 'CANCELLED' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถยกเลิกนัดหมายได้');
      setAppointments((current) => current.filter((appointment) => appointment.id !== id));
      setCancellationTarget(null);
      notify('success', 'ยกเลิกนัดหมายแล้ว', 'คืนที่นั่งให้รอบเวลาเรียบร้อย');
    } catch (error) {
      notify('error', 'ยกเลิกนัดหมายไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <NotificationToast message={toast} onDismiss={dismissToast} />
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-xs">
        <Link href="/user/dashboard" className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-teal-500"></div>
          <span className="font-semibold text-lg tracking-tight text-slate-800">พร้อมฉีด</span>
        </Link>
        <Link
          href="/user/dashboard"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← กลับแดชบอร์ด
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
        {/* เลือกเด็กและไปยังระบบจอง */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">นัดหมายรับวัคซีน</h2>
          <p className="text-xs text-slate-500 mb-5">เลือกเด็กเพื่อดูรายการนัดหมาย หรือไปค้นหาสถานพยาบาลและรอบเวลาว่าง</p>
          {children.length > 0 ? (
            <label className="block max-w-md text-xs font-medium text-slate-600">
              เด็ก
              <select
                value={selectedChildId}
                onChange={(event) => {
                  setAppointments([]);
                  setLoading(true);
                  setSelectedChildId(event.target.value);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
              >
                {children.map((child, index) => (
                  <option key={child.id} value={child.id}>{child.firstName || `เด็กคนที่ ${index + 1}`}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mb-4 text-sm text-slate-500">เพิ่มข้อมูลเด็กก่อนเริ่มจองนัดหมาย</p>
          )}
          <Link
            href={selectedChildId ? `/user/dashboard?tab=appointments&childId=${encodeURIComponent(selectedChildId)}` : '/user/dashboard'}
            className="mt-4 inline-flex rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            ไปค้นหาและจองคิว
          </Link>
        </section>

        {/* รายการคิวนัดหมาย */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
          <h3 className="text-base font-semibold text-slate-800 mb-4">รายการนัดหมายของคุณ</h3>
          {loading ? (
            <p className="text-xs text-slate-400 py-6 text-center">กำลังโหลดรายการนัดหมาย...</p>
          ) : visibleAppointments.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">ไม่มีรายการนัดหมายในขณะนี้</p>
          ) : (
            <div className="space-y-3">
              {visibleAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/40 gap-3"
                >
                  <div>
                    <h4 className="font-medium text-sm text-slate-800">{appt.hospitalName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(appt.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        appt.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : appt.status === 'CANCELLED'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {appt.status === 'COMPLETED' ? 'เสร็จสิ้น' : appt.status === 'CANCELLED' ? 'ยกเลิกแล้ว' : 'รอรับบริการ'}
                    </span>

                    {['PENDING', 'CONFIRMED'].includes(appt.status) && (
                      <button
                        onClick={() => setCancellationTarget(appt)}
                        className="text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        ยกเลิกนัด
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {cancellationTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isCancelling) setCancellationTarget(null);
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="appointment-cancel-title"
              aria-describedby="appointment-cancel-description"
              className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-2xl shadow-slate-950/20"
            >
              <div className="h-1.5 bg-gradient-to-r from-rose-400 via-pink-500 to-rose-400" />
              <div className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600" aria-hidden="true">!</div>
                  <div>
                    <p className="text-xs font-bold uppercase text-rose-600">ยืนยันการยกเลิก</p>
                    <h2 id="appointment-cancel-title" className="mt-1 text-xl font-extrabold text-slate-900">ยกเลิกนัดหมายนี้?</h2>
                    <p id="appointment-cancel-description" className="mt-2 text-sm leading-relaxed text-slate-600">เมื่อยืนยัน ระบบจะคืนที่นั่งและนำรายการนี้ออกจากรายการนัดหมาย</p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="font-bold text-slate-800">{cancellationTarget.hospitalName}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(cancellationTarget.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.</p>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" disabled={isCancelling} onClick={() => setCancellationTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">กลับไปดูนัดหมาย</button>
                  <button type="button" disabled={isCancelling} onClick={() => void handleCancelAppointment(cancellationTarget.id)} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60">{isCancelling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกนัด'}</button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}