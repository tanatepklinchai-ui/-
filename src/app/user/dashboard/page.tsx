// src/app/user/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';


interface VaccineRecord {
  id: string;
  vaccineName: string;
  administeredDate: string;
  hospitalName: string;
  source: string;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  gender: string;
  weight: number | '';
  height: number | '';
  dob: string;
}

export default function UserDashboard() {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    gender: 'OTHER',
    weight: '',
    height: '',
    dob: '',
  });

  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingMoph, setSyncingMoph] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // โหลดข้อมูลโปรไฟล์และประวัติวัคซีน
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile({
              firstName: data.profile.firstName || '',
              lastName: data.profile.lastName || '',
              gender: data.profile.gender || 'OTHER',
              weight: data.profile.weight || '',
              height: data.profile.height || '',
              dob: data.profile.dob ? data.profile.dob.split('T')[0] : '',
            });
          } else {
            setIsEditing(true); // หากยังไม่เคยกรอก ให้เปิดโหมดแก้ไขทันที
          }
          setVaccines(data.vaccines || []);
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
  }, []);

  // บันทึกการแก้ไขข้อมูลส่วนตัว
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setStatusMessage('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
      setIsEditing(false);
    } catch (err: any) {
      setStatusMessage(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  // ดึงประวัติวัคซีนจาก MOPH API จำลอง
  const handleSyncMOPH = async () => {
    setSyncingMoph(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/moph/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setVaccines(data.vaccines);
        setStatusMessage('ซิงก์ข้อมูลประวัติวัคซีนจากกระทรวงสาธารณสุขสำเร็จ');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'ไม่สามารถเชื่อมต่อข้อมูลกระทรวงสาธารณสุขได้');
    } finally {
      setSyncingMoph(false);
    }
  };
// ฟังก์ชันออกจากระบบและล้าง Cookie Session
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        กำลังโหลดข้อมูลแดชบอร์ด...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Navbar มินิมอล */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-xs">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-teal-500"></div>
          <span className="font-semibold text-lg tracking-tight text-slate-800">พร้อมฉีด</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/user/appointment"
            className="text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition-all shadow-xs"
          >
            + นัดหมายฉีดวัคซีน
          </Link>
          <button
  onClick={handleLogout}
  className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
>
  ออกจากระบบ
</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
        {/* ข้อความแจ้งเตือนสถานะ */}
        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-100 text-teal-800 text-xs font-medium transition-all">
            {statusMessage}
          </div>
        )}

        {/* ส่วนที่ 1: ข้อมูลส่วนตัวและสรีระ */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">ข้อมูลส่วนตัวและสรีระ</h2>
              <p className="text-xs text-slate-500 mt-0.5">ใช้สำหรับการคำนวณสัดส่วนและปริมาณยาในการเข้ารับบริการ</p>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs font-medium text-teal-600 hover:text-teal-700 bg-teal-50 px-3.5 py-1.5 rounded-lg transition-all"
              >
                แก้ไขข้อมูล
              </button>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">ชื่อ</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  required
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-75 disabled:bg-slate-100/50"
                  placeholder="ชื่อจริง"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">นามสกุล</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  required
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-75 disabled:bg-slate-100/50"
                  placeholder="นามสกุล"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">เพศกำเนิด</label>
                <select
                  disabled={!isEditing}
                  value={profile.gender}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-75 disabled:bg-slate-100/50"
                >
                  <option value="MALE">ชาย</option>
                  <option value="FEMALE">หญิง</option>
                  <option value="OTHER">อื่นๆ / ไม่ระบุ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">น้ำหนัก (กก.)</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!isEditing}
                  required
                  value={profile.weight}
                  onChange={(e) => setProfile({ ...profile, weight: parseFloat(e.target.value) || '' })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-75 disabled:bg-slate-100/50"
                  placeholder="55"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">ส่วนสูง (ซม.)</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!isEditing}
                  required
                  value={profile.height}
                  onChange={(e) => setProfile({ ...profile, height: parseFloat(e.target.value) || '' })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-75 disabled:bg-slate-100/50"
                  placeholder="170"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">วันเดือนปีเกิด</label>
                <input
                  type="date"
                  disabled={!isEditing}
                  required
                  value={profile.dob}
                  onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-75 disabled:bg-slate-100/50"
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white transition-all disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            )}
          </form>
        </section>

        {/* ส่วนที่ 2: ประวัติวัคซีนที่เคยได้รับ */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">ประวัติการรับวัคซีน</h2>
              <p className="text-xs text-slate-500 mt-0.5">ข้อมูลที่ซิงก์จากฐานข้อมูลระบบสาธารณสุขและประวัติที่ยืนยันแล้ว</p>
            </div>
            <button
              onClick={handleSyncMOPH}
              disabled={syncingMoph}
              className="inline-flex items-center text-xs font-medium border border-teal-200 text-teal-700 hover:bg-teal-50 px-3.5 py-2 rounded-xl transition-all self-start sm:self-auto disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 mr-1.5 ${syncingMoph ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncingMoph ? 'กำลังซิงก์ MOPH API...' : 'ดึงข้อมูลจากกระทรวงสาธารณสุข'}
            </button>
          </div>

          {vaccines.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400">ยังไม่มีประวัติการรับวัคซีนในระบบ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/75 uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">ชื่อวัคซีน</th>
                    <th className="py-3 px-4">วันที่ได้รับ</th>
                    <th className="py-3 px-4">สถานที่ให้บริการ</th>
                    <th className="py-3 px-4">แหล่งที่มา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vaccines.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-800">{v.vaccineName}</td>
                      <td className="py-3.5 px-4">
                        {v.administeredDate ? new Date(v.administeredDate).toLocaleDateString('th-TH') : '-'}
                      </td>
                      <td className="py-3.5 px-4">{v.hospitalName}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]">
                          {v.source === 'MOPH_API' ? 'กระทรวงสาธารณสุข' : 'ยืนยันด้วยตนเอง'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
// ใส่ต่อท้ายใน src/app/user/dashboard/page.tsx
import { VACCINE_SCHEDULE } from '@/lib/vaccineSchedule';

// ฟังก์ชันจัดกลุ่มวัคซีนตามช่วงอายุ
const ageGroups = ['แรกเกิด', '2 เดือน', '4 เดือน', '6 เดือน', '9 เดือน', '12 เดือน', '18 เดือน', '4 ปี'];

<section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
  <div className="mb-6">
    <h2 className="text-lg font-semibold text-slate-800">ตารางวัคซีนสำหรับเด็กแรกเกิด – 5 ปี</h2>
    <p className="text-xs text-slate-500 mt-0.5">อ้างอิงตามเกณฑ์แผนงานสร้างเสริมภูมิคุ้มกันโรค กระทรวงสาธารณสุข</p>
  </div>

  <div className="space-y-4">
    {ageGroups.map((age) => {
      const groupVaccines = VACCINE_SCHEDULE.filter((v) => v.ageCriteria === age);
      return (
        <div key={age} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="w-28 shrink-0 font-medium text-sm text-teal-700 bg-teal-50 px-3 py-1 rounded-lg text-center">
            {age}
          </div>
          <div className="flex-1 space-y-1">
            {groupVaccines.map((item) => (
              <div key={item.code} className="text-xs text-slate-600 flex items-center justify-between">
                <span>• {item.name} {item.dose} <span className="text-slate-400">({item.description})</span></span>
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
</section>