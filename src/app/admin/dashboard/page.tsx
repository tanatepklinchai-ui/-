'use client';

import { useState, useEffect } from 'react';
import { calculateAgeDisplay } from '@/lib/utils/formatAge';

interface UserData {
  id: string;
  username: string;
  email: string;
  children: { id: string; firstName: string | null; lastName: string | null; dob: string | null }[];
}

interface AppointmentData {
  id: string;
  hospitalName: string;
  vaccineName: string;
  vaccineType: string;
  appointmentDate: string;
  status: string;
  userName?: string;
}

interface VaccineStat {
  name: string;
  type: string;
  count: number;
}

interface PendingVaccineRecord {
  id: string;
  vaccineCode: string | null;
  vaccineName: string;
  administeredDate: string;
  hospitalName: string;
  user: { username: string; email: string };
  child: { firstName: string | null; lastName: string | null };
}

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [vaccineStats, setVaccineStats] = useState<VaccineStat[]>([]);
  const [pendingVaccineRecords, setPendingVaccineRecords] = useState<PendingVaccineRecord[]>([]);
  const [reviewError, setReviewError] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [editModalAppt, setEditModalAppt] = useState<AppointmentData | null>(null);

  // ข้อมูลกราฟจำลองระยะเวลาตาม วัน-เดือน-ปี-ชั่วโมง
  const trafficData = [
    { time: '18/09 15:00', count: 8 },
    { time: '18/09 16:00', count: 14 },
    { time: '18/09 17:00', count: 22 },
    { time: '18/09 18:00', count: 35 },
    { time: '18/09 19:00', count: 19 },
  ];

  useEffect(() => {
    // โหลดข้อมูล Dashboard
    fetch('/api/admin/dashboard')
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
        if (data.appointments) setAppointments(data.appointments);
        if (data.vaccineStats) setVaccineStats(data.vaccineStats);
      })
      .catch(() => {});

    fetch('/api/admin/vaccine-records')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'ไม่สามารถโหลดประวัติวัคซีนที่รอตรวจได้');
        setPendingVaccineRecords(data.records ?? []);
      })
      .catch((error) => setReviewError(error.message));
  }, []);

  const handleReviewVaccineRecord = async (recordId: string, verificationStatus: 'VERIFIED' | 'REJECTED') => {
    setReviewError('');
    try {
      const response = await fetch('/api/admin/vaccine-records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, verificationStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถบันทึกผลตรวจสอบได้');
      setPendingVaccineRecords((records) => records.filter((record) => record.id !== recordId));
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'ไม่สามารถบันทึกผลตรวจสอบได้');
    }
  };

  const handleSaveEdit = async () => {
    if (!editModalAppt) return;
    await fetch(`/api/admin/appointments/${editModalAppt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editModalAppt),
    });
    setAppointments((prev) =>
      prev.map((item) => (item.id === editModalAppt.id ? editModalAppt : item))
    );
    setEditModalAppt(null);
  };

  const sortedVaccineStats = [...vaccineStats].sort((a, b) =>
    sortOrder === 'desc' ? b.count - a.count : a.count - b.count
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 space-y-8 font-sans">
      <div className="flex justify-between items-center border-b pb-4 border-gray-200">
        <h1 className="text-2xl font-bold text-teal-700">แดชบอร์ดผู้ดูแลระบบ &quot;พร้อมฉีด&quot;</h1>
        <span className="bg-teal-100 text-teal-800 text-xs px-3 py-1 rounded-full font-semibold">
          Role: Admin (poomg900@gmail.com)
        </span>
      </div>

      <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold mb-4 text-gray-800">ตรวจสอบประวัติวัคซีนที่ผู้ปกครองรายงาน</h2>
        {reviewError && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{reviewError}</p>}
        {pendingVaccineRecords.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">ไม่มีประวัติรอตรวจสอบ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b">
                  <th className="p-3">ผู้รายงาน</th>
                  <th className="p-3">เด็ก</th>
                  <th className="p-3">วัคซีน</th>
                  <th className="p-3">วันที่ได้รับ</th>
                  <th className="p-3">สถานพยาบาลในสมุด</th>
                  <th className="p-3 text-center">ตรวจสอบ</th>
                </tr>
              </thead>
              <tbody>
                {pendingVaccineRecords.map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="p-3">{record.user.username}<span className="block text-xs text-gray-500">{record.user.email}</span></td>
                    <td className="p-3">{[record.child.firstName, record.child.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ'}</td>
                    <td className="p-3">{record.vaccineName}<span className="block text-xs text-gray-500">{record.vaccineCode}</span></td>
                    <td className="p-3 whitespace-nowrap">{new Date(record.administeredDate).toLocaleDateString('th-TH')}</td>
                    <td className="p-3">{record.hospitalName}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => void handleReviewVaccineRecord(record.id, 'VERIFIED')} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">ยืนยัน</button>
                        <button onClick={() => void handleReviewVaccineRecord(record.id, 'REJECTED')} className="rounded bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-200">ปฏิเสธ</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 1. กราฟแท่งจำนวนผู้ใช้งานตาม วัน-เดือน-ปี-ชั่วโมง */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold mb-4 text-gray-800">1. สถิติจำนวนผู้เข้าใช้งานระบบตามช่วงเวลา</h2>
        <div className="flex items-end gap-6 h-48 pt-8 px-4 border-b border-l border-gray-300">
          {trafficData.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-teal-700">{item.count}</span>
              <div
                className="w-full max-w-[40px] bg-teal-500 hover:bg-teal-600 rounded-t-md transition-all"
                style={{ height: `${(item.count / 40) * 100}%` }}
              />
              <span className="text-[11px] text-gray-600 whitespace-nowrap">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. บัญชีผู้ใช้และข้อมูลเด็ก */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold mb-4 text-gray-800">2. ผู้ปกครองและเด็กในบัญชี</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 border-b">
                <th className="p-3">บัญชีผู้ปกครอง</th>
                <th className="p-3">เด็กและวันเกิด</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{u.username}<span className="block text-xs text-gray-500">{u.email}</span></td>
                  <td className="p-3">
                    {u.children.length === 0 ? (
                      <span className="text-gray-500">ยังไม่มีข้อมูลเด็ก</span>
                    ) : (
                      <ul className="space-y-1">
                        {u.children.map((child, index) => (
                          <li key={child.id}>
                            <span className="font-medium">{[child.firstName, child.lastName].filter(Boolean).join(' ') || `เด็กคนที่ ${index + 1}`}</span>
                            <span className="ml-2 text-xs text-gray-500">
                              {child.dob ? `${new Date(child.dob).toLocaleDateString('th-TH')} (${calculateAgeDisplay(child.dob)})` : 'ยังไม่ระบุวันเกิด'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. จัดการแบบฟอร์มการนัดหมาย */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold mb-4 text-gray-800">3. รายการแบบฟอร์มนัดหมาย (แอดมินแก้ไขได้)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-700 border-b">
                <th className="p-3">โรงพยาบาล</th>
                <th className="p-3">วัคซีน</th>
                <th className="p-3">วัน-เวลานัด</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{a.hospitalName}</td>
                  <td className="p-3">{a.vaccineName}</td>
                  <td className="p-3">{new Date(a.appointmentDate).toLocaleString('th-TH')}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${a.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setEditModalAppt(a)}
                      className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded"
                    >
                      แก้ไขแบบฟอร์ม
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. สถิติวัคซีนแยกตามประเภทและการกรอง */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">4. สถิติวัคซีนที่ยืนยันการฉีดแล้ว (ดึงจากกระทรวงสาธารณสุข)</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">เรียงตามการใช้งาน:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
            >
              <option value="desc">ใช้มากที่สุด → น้อยที่สุด</option>
              <option value="asc">ใช้น้อยที่สุด → มากที่สุด</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sortedVaccineStats.map((v, i) => (
            <div key={i} className="p-4 border rounded-lg bg-teal-50/50 border-teal-100">
              <span className="text-xs text-teal-700 font-medium">{v.type}</span>
              <h3 className="font-bold text-gray-800 mt-1">{v.name}</h3>
              <p className="text-2xl font-bold text-teal-900 mt-2">{v.count} <span className="text-xs font-normal">โดส</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* โมดอลแก้ไขแบบฟอร์ม */}
      {editModalAppt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-800">แก้ไขข้อมูลแบบฟอร์มนัดหมาย</h3>
            <div>
              <label className="text-xs text-gray-600">ชื่อโรงพยาบาล</label>
              <input
                type="text"
                value={editModalAppt.hospitalName}
                onChange={(e) => setEditModalAppt({ ...editModalAppt, hospitalName: e.target.value })}
                className="w-full border p-2 rounded mt-1 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">ชื่อวัคซีน</label>
              <input
                type="text"
                value={editModalAppt.vaccineName}
                onChange={(e) => setEditModalAppt({ ...editModalAppt, vaccineName: e.target.value })}
                className="w-full border p-2 rounded mt-1 text-sm bg-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditModalAppt(null)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded hover:bg-teal-700"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}