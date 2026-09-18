// src/app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface UserItem {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  profile: {
    firstName: string;
    lastName: string;
    gender: string;
    weight: number;
    height: number;
    dob: string;
  } | null;
}

interface AppointmentItem {
  id: string;
  hospitalName: string;
  scheduledAt: string;
  status: string;
  user: {
    username: string;
    email: string;
  };
}

interface VaccineStat {
  name: string;
  count: number;
}

interface ChartItem {
  time: string;
  count: number;
}

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [vaccineStats, setVaccineStats] = useState<VaccineStat[]>([]);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(true);

  // การคำนวณอายุตามเงื่อนไข: ต่ำกว่า 4 ขวบแสดงปีและเดือน
  const calculateAge = (dobString?: string) => {
    if (!dobString) return '-';
    const dob = new Date(dobString);
    const today = new Date();

    let years = today.getFullYear() - dob.getFullYear();
    let months = today.getMonth() - dob.getMonth();
    const days = today.getDate() - dob.getDate();

    if (days < 0) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years < 0) return '0 เดือน';
    if (years < 4) {
      return `${years} ปี ${months} เดือน`;
    }
    return `${years} ปี`;
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setAppointments(data.appointments || []);
        setVaccineStats(data.vaccineStats || []);
        setChartData(data.chartData || []);
      }
    } catch (err) {
      console.error('Failed to load admin stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // กรอง/เรียงลำดับวัคซีนตามปริมาณการใช้ (มากไปน้อย / น้อยไปมาก)
  const sortedVaccines = useMemo(() => {
    return [...vaccineStats].sort((a, b) => {
      return sortOrder === 'desc' ? b.count - a.count : a.count - b.count;
    });
  }, [vaccineStats, sortOrder]);

  // ฟังก์ชันแก้ไขสถานะแบบฟอร์มการนัดหมาย
  const handleUpdateAppointment = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id, status: newStatus }),
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      alert('แก้ไขไม่สำเร็จ');
    }
  };
const handleLogout = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
};
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        กำลังโหลดข้อมูลสถิติหลังบ้าน...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-3.5 h-3.5 rounded-full bg-teal-600"></div>
            <h1 className="font-semibold text-lg tracking-tight text-slate-800">
              พร้อมฉีด <span className="text-xs font-normal text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md ml-2">ผู้ดูแลระบบ</span>
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/user/dashboard"
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              มุมมองผู้ใช้
            </Link>
            <button
  onClick={handleLogout}
  className="text-xs text-red-500 hover:text-red-700 transition-colors"
>
  ออกจากระบบ
</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
        {/* สรุปสถิติภาพรวม */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">ผู้ลงทะเบียนทั้งหมด</p>
            <p className="text-3xl font-semibold text-slate-800 mt-2">{users.length} <span className="text-sm font-normal text-slate-500">คน</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">คิวนัดหมายทั้งหมด</p>
            <p className="text-3xl font-semibold text-teal-600 mt-2">{appointments.length} <span className="text-sm font-normal text-slate-500">รายการ</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">ยอดวัคซีนที่ยืนยันแล้ว</p>
            <p className="text-3xl font-semibold text-slate-800 mt-2">
              {vaccineStats.reduce((acc, curr) => acc + curr.count, 0)}{' '}
              <span className="text-sm font-normal text-slate-500">เข็ม</span>
            </p>
          </div>
        </section>

        {/* กราฟแท่งสถิติผู้เข้าใช้ระบบ */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-xs">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-800">จำนวนผู้เข้าใช้ระบบตามช่วงเวลา</h2>
            <p className="text-xs text-slate-400 mt-0.5">แสดงปริมาณการลงทะเบียน/การใช้งานจำแนกตาม วัน เดือน ปี และชั่วโมง</p>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="count" name="จำนวนผู้ใช้" fill="#0d9488" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ข้อมูลสถิติวัคซีน + ตัวกรอง */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-800">สถิติวัคซีนที่ได้รับการยืนยัน</h2>
              <p className="text-xs text-slate-400 mt-0.5">แบ่งตามประเภทวัคซีนมาตรฐานของกระทรวงสาธารณสุข</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">เรียงตามการใช้งาน:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                className="text-xs border border-slate-200 bg-slate-50/60 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="desc">ใช้มากที่สุด → น้อยที่สุด</option>
                <option value="asc">ใช้น้อยที่สุด → มากที่สุด</option>
              </select>
            </div>
          </div>

          {sortedVaccines.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-100 rounded-xl">
              ยังไม่มีข้อมูลการฉีดวัคซีนที่ยืนยัน
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sortedVaccines.map((item) => (
                <div key={item.name} className="p-4 rounded-xl border border-slate-100 bg-slate-50/40 flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-800">{item.name}</h3>
                    <span className="text-[11px] text-teal-600 font-medium mt-0.5 inline-block">กระทรวงสาธารณสุข</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-800">{item.count}</span>
                    <span className="text-xs text-slate-400 ml-1">ครั้ง</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ตารางข้อมูลผู้ใช้และอายุที่คำนวณ */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">ชุดข้อมูลผู้ใช้งานในระบบ</h2>
            <p className="text-xs text-slate-400 mt-0.5">ข้อมูลสรีระและอายุที่คำนวณไดนามิก (เด็กต่ำกว่า 4 ปีจะนับเดือนประกอบ)</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-6">ชื่อ - นามสกุล</th>
                  <th className="py-3.5 px-6">เพศ</th>
                  <th className="py-3.5 px-6">น้ำหนัก</th>
                  <th className="py-3.5 px-6">ส่วนสูง</th>
                  <th className="py-3.5 px-6">วันเดือนปีเกิด</th>
                  <th className="py-3.5 px-6">อายุที่คำนวณ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-800">
                      {u.profile?.firstName ? `${u.profile.firstName} ${u.profile.lastName}` : u.username}
                    </td>
                    <td className="py-3.5 px-6">
                      {u.profile?.gender === 'MALE' ? 'ชาย' : u.profile?.gender === 'FEMALE' ? 'หญิง' : 'อื่นๆ/ไม่ระบุ'}
                    </td>
                    <td className="py-3.5 px-6">{u.profile?.weight ? `${u.profile.weight} กก.` : '-'}</td>
                    <td className="py-3.5 px-6">{u.profile?.height ? `${u.profile.height} ซม.` : '-'}</td>
                    <td className="py-3.5 px-6">
                      {u.profile?.dob ? new Date(u.profile.dob).toLocaleDateString('th-TH') : '-'}
                    </td>
                    <td className="py-3.5 px-6 text-teal-700 font-medium">
                      {calculateAge(u.profile?.dob)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ตารางจัดการและแก้ไขแบบฟอร์มนัดหมาย */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">จัดการข้อมูลแบบฟอร์มนัดหมาย</h2>
            <p className="text-xs text-slate-400 mt-0.5">แอดมินสามารถตรวจสอบและแก้ไขสถานะแบบฟอร์มการฉีดวัคซีนได้</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-6">ผู้ขอนัดหมาย</th>
                  <th className="py-3.5 px-6">สถานพยาบาล</th>
                  <th className="py-3.5 px-6">วันและเวลา</th>
                  <th className="py-3.5 px-6">สถานะปัจจุบัน</th>
                  <th className="py-3.5 px-6">จัดการสถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-800">
                      {appt.user.username} <span className="text-slate-400 font-normal">({appt.user.email})</span>
                    </td>
                    <td className="py-3.5 px-6">{appt.hospitalName}</td>
                    <td className="py-3.5 px-6">
                      {new Date(appt.scheduledAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} น.
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${
                          appt.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : appt.status === 'EXPIRED'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <select
                        value={appt.status}
                        onChange={(e) => handleUpdateAppointment(appt.id, e.target.value)}
                        className="text-[11px] border border-slate-200 bg-white rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="PENDING">PENDING (รอรับบริการ)</option>
                        <option value="CONFIRMED">CONFIRMED (ฉีดแล้ว)</option>
                        <option value="EXPIRED">EXPIRED (หมดอายุ)</option>
                        <option value="CANCELLED">CANCELLED (ยกเลิก)</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}