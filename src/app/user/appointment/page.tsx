// src/app/user/appointment/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
        setMessage(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลเด็กได้');
        setLoading(false);
      });
  }, []);

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
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'ไม่สามารถโหลดนัดหมายได้');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedChildId]);

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('คุณต้องการยกเลิกการนัดหมายนี้ใช่หรือไม่?')) return;
    const response = await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: id, status: 'CANCELLED' }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'ไม่สามารถยกเลิกนัดหมายได้');
      return;
    }
    setAppointments((current) => current.map((appointment) => appointment.id === id ? data.appointment : appointment));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
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
        {message && (
          <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-100 text-teal-800 text-xs font-medium">
            {message}
          </div>
        )}

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
          ) : appointments.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">ไม่มีรายการนัดหมายในขณะนี้</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => (
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

                    {appt.status === 'PENDING' && (
                      <button
                        onClick={() => void handleCancelAppointment(appt.id)}
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
      </main>
    </div>
  );
}