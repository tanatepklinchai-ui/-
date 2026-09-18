// src/app/user/appointment/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AppointmentItem {
  id: string;
  hospitalName: string;
  scheduledAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
}

export default function AppointmentPage() {
  const [hospitalName, setHospitalName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchAppointments = async () => {
    const res = await fetch('/api/appointments');
    if (res.ok) {
      const data = await res.json();
      setAppointments(data.appointments || []);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalName, scheduledAt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage('จองคิวนัดหมายสำเร็จแล้ว');
      setHospitalName('');
      setScheduledAt('');
      fetchAppointments();
    } catch (err: any) {
      setMessage(err.message || 'การจองล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmVaccinated = async (id: string) => {
    const vaccineName = prompt('ระบุชื่อวัคซีนที่ได้รับ (เว้นว่างได้):') || 'วัคซีนตามเกณฑ์กระทรวงฯ';
    try {
      const res = await fetch(`/api/appointments/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaccineName }),
      });
      if (res.ok) {
        alert('ยืนยันสำเร็จ ระบบได้บันทึกลงประวัติวัคซีนของคุณแล้ว');
        fetchAppointments();
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการยืนยัน');
    }
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

        {/* ฟอร์มการจอง */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">นัดหมายการรับวัคซีน</h2>
          <p className="text-xs text-slate-500 mb-6">
            ระบบจะส่งการแจ้งเตือนไปยังอีเมลของคุณล่วงหน้า 1 วัน และ 1 ชั่วโมงก่อนถึงเวลานัด
          </p>

          <form onSubmit={handleBooking} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">ชื่อสถานพยาบาล / ศูนย์บริการ</label>
              <input
                type="text"
                required
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="เช่น โรงพยาบาลศูนย์ชัยนาท หรือ ศูนย์บริการสาธารณสุข"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">วันและเวลาที่นัดหมาย</label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'ยืนยันการนัดหมาย'}
            </button>
          </form>
        </section>

        {/* รายการคิวนัดหมาย */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
          <h3 className="text-base font-semibold text-slate-800 mb-4">รายการนัดหมายของคุณ</h3>
          {appointments.length === 0 ? (
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
                        appt.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : appt.status === 'EXPIRED'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {appt.status === 'CONFIRMED'
                        ? 'ฉีดแล้ว'
                        : appt.status === 'EXPIRED'
                        ? 'หมดอายุ (ไม่ได้รับ)'
                        : 'รอรับบริการ'}
                    </span>

                    {appt.status === 'PENDING' && (
                      <button
                        onClick={() => handleConfirmVaccinated(appt.id)}
                        className="text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        ยืนยันว่าฉีดแล้ว
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