'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'appointments' | 'slots' | 'vaccines' | 'records';
type Appointment = {
  id: string;
  hospitalName: string;
  hospitalId: string | null;
  scheduledAt: string;
  status: string;
  isWaitlisted: boolean;
  requestedVaccine?: string | null; // <--- เพิ่มบรรทัดนี้
  user: { username: string; email: string };
  child: { firstName: string | null; lastName: string | null; dob: string | null };
};
type Hospital = { id: string; name: string };
type HospitalSlot = {
  id: string;
  hospitalId: string;
  date: string;
  time: string;
  capacity: number;
  booked: number;
  isClosed: boolean;
  isAdminDefined: boolean;
  hospital: { id: string; name: string };
};
type Vaccine = { id: string; code: string; name: string; stock: number; isActive: boolean; _count: { records: number } };
type PendingRecord = {
  id: string;
  vaccineCode: string | null;
  vaccineName: string;
  administeredDate: string;
  hospitalName: string;
  user: { username: string; email: string };
  child: { firstName: string | null; lastName: string | null };
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'appointments', label: 'จัดการคิว' },
  { id: 'slots', label: 'รอบเวลา' },
  { id: 'vaccines', label: 'สต็อกวัคซีน' },
  { id: 'records', label: 'ตรวจประวัติ' },
];

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  return data as T;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function formatSlotDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'UTC' });
}

function childName(child: { firstName: string | null; lastName: string | null }) {
  return [child.firstName, child.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อเด็ก';
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [slots, setSlots] = useState<HospitalSlot[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [records, setRecords] = useState<PendingRecord[]>([]);
  const [selectedVaccines, setSelectedVaccines] = useState<Record<string, string>>({});
  const [hospitalId, setHospitalId] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [slotDate, setSlotDate] = useState('');
  const [slotTime, setSlotTime] = useState('09:00');
  const [slotCapacity, setSlotCapacity] = useState(10);
  const [vaccineCode, setVaccineCode] = useState('');
  const [vaccineName, setVaccineName] = useState('');
  const [vaccineStock, setVaccineStock] = useState(0);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // States สำหรับเลื่อนนัดหมาย
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [newScheduledAt, setNewScheduledAt] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [appointmentResponse, slotResponse, vaccineResponse, recordResponse] = await Promise.all([
        fetch('/api/admin/appointments', { cache: 'no-store' }),
        fetch('/api/admin/slots', { cache: 'no-store' }),
        fetch('/api/admin/vaccines', { cache: 'no-store' }),
        fetch('/api/admin/vaccine-records', { cache: 'no-store' }),
      ]);
      const [appointmentData, slotData, vaccineData, recordData] = await Promise.all([
        readJson<{ appointments: Appointment[] }>(appointmentResponse),
        readJson<{ hospitals: Hospital[]; slots: HospitalSlot[] }>(slotResponse),
        readJson<{ vaccines: Vaccine[] }>(vaccineResponse),
        readJson<{ records: PendingRecord[] }>(recordResponse),
      ]);
      setAppointments(appointmentData.appointments);
      setHospitals(slotData.hospitals);
      setSlots(slotData.slots);
      setVaccines(vaccineData.vaccines);
      setRecords(recordData.records);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ไม่สามารถโหลดข้อมูลหลังบ้านได้');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const [appointmentResponse, slotResponse, vaccineResponse, recordResponse] = await Promise.all([
          fetch('/api/admin/appointments', { cache: 'no-store' }),
          fetch('/api/admin/slots', { cache: 'no-store' }),
          fetch('/api/admin/vaccines', { cache: 'no-store' }),
          fetch('/api/admin/vaccine-records', { cache: 'no-store' }),
        ]);
        const [appointmentData, slotData, vaccineData, recordData] = await Promise.all([
          readJson<{ appointments: Appointment[] }>(appointmentResponse),
          readJson<{ hospitals: Hospital[]; slots: HospitalSlot[] }>(slotResponse),
          readJson<{ vaccines: Vaccine[] }>(vaccineResponse),
          readJson<{ records: PendingRecord[] }>(recordResponse),
        ]);
        if (!isMounted) return;
        setAppointments(appointmentData.appointments);
        setHospitals(slotData.hospitals);
        setSlots(slotData.slots);
        setVaccines(vaccineData.vaccines);
        setRecords(recordData.records);
      } catch (caught) {
        if (isMounted) setError(caught instanceof Error ? caught.message : 'ไม่สามารถโหลดข้อมูลหลังบ้านได้');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void loadInitialData();
    return () => { isMounted = false; };
  }, []);

  async function performAction(key: string, action: () => Promise<void>, successMessage: string) {
    setBusyKey(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusyKey('');
    }
  }

  async function updateAppointment(appointmentId: string, status: 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW') {
    await performAction(`appointment-${appointmentId}`, async () => {
      const response = await fetch('/api/admin/appointments', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, status }),
      });
      await readJson(response);
    }, status === 'CONFIRMED' ? 'อนุมัติการจองแล้ว' : status === 'CANCELLED' ? 'ยกเลิกคิวและคืนที่นั่งแล้ว' : 'บันทึกสถานะไม่มาตามนัดแล้ว');
  }

  async function completeAppointment(appointmentId: string) {
    const selectedId = selectedVaccines[appointmentId];
    if (!selectedId) { setError('กรุณาเลือกวัคซีนก่อนยืนยันการฉีด'); return; }
    await performAction(`complete-${appointmentId}`, async () => {
      const response = await fetch(`/api/appointments/${appointmentId}/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaccineCatalogId: selectedId }),
      });
      await readJson(response);
    }, 'ยืนยันการฉีดแล้ว บันทึกประวัติเด็กและตัดสต็อกเรียบร้อย');
  }

  async function submitReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rescheduleTarget || !newScheduledAt) return;
    const selectedSlot = slots.find((slot) => slot.id === newScheduledAt);
    if (!selectedSlot) return;
    const dateString = new Date(selectedSlot.date).toISOString().slice(0, 10);

    await performAction(`reschedule-${rescheduleTarget.id}`, async () => {
      const response = await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: rescheduleTarget.id,
          status: 'RESCHEDULED',
          newScheduledAt: new Date(`${dateString}T${selectedSlot.time}:00+07:00`).toISOString()
        }),
      });
      await readJson(response);
      setRescheduleTarget(null);
      setNewScheduledAt('');
    }, 'กำหนดวันนัดใหม่และส่งอีเมลแจ้งผู้ปกครองแล้ว');
  }

  async function deleteHospital(hospital: Hospital) {
    if (!window.confirm(`ยืนยันลบชื่อสถานพยาบาล “${hospital.name}” และรอบเวลาทั้งหมดหรือไม่?`)) return;
    await performAction(`hospital-${hospital.id}`, async () => {
      const response = await fetch('/api/admin/slots', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId: hospital.id }),
      });
      await readJson(response);
      if (hospitalId === hospital.id) setHospitalId('');
    }, 'ลบสถานพยาบาลแล้ว');
  }

  async function saveSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await performAction('new-slot', async () => {
      const response = await fetch('/api/admin/slots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: hospitalId || undefined,
          hospitalName: hospitalId ? undefined : hospitalName,
          date: slotDate,
          time: slotTime,
          capacity: slotCapacity,
        }),
      });
      await readJson(response);
      setHospitalName('');
    }, 'บันทึกรอบเวลาแล้ว');
  }

  async function updateSlot(slotId: string, update: { capacity?: number; isClosed?: boolean; isAdminDefined?: boolean }) {
    await performAction(`slot-${slotId}`, async () => {
      const response = await fetch('/api/admin/slots', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, ...update }),
      });
      await readJson(response);
    }, update.isAdminDefined !== undefined
      ? update.isAdminDefined ? 'เปิดรอบนี้ให้ผู้ใช้แล้ว' : 'ซ่อนรอบนี้จากผู้ใช้แล้ว'
      : update.isClosed === undefined ? 'ปรับจำนวนคิวแล้ว' : update.isClosed ? 'ปิดรอบแล้ว' : 'เปิดรอบแล้ว');
  }

  async function createVaccine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await performAction('new-vaccine', async () => {
      const response = await fetch('/api/admin/vaccines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: vaccineCode, name: vaccineName, stock: vaccineStock }),
      });
      await readJson(response);
      setVaccineCode(''); setVaccineName(''); setVaccineStock(0);
    }, 'เพิ่มรายการวัคซีนแล้ว');
  }

  async function updateVaccine(vaccineId: string, update: { stock?: number; isActive?: boolean }) {
    await performAction(`vaccine-${vaccineId}`, async () => {
      const response = await fetch('/api/admin/vaccines', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vaccineId, ...update }),
      });
      await readJson(response);
    }, update.isActive === undefined ? 'บันทึกสต็อกแล้ว' : update.isActive ? 'เปิดใช้งานวัคซีนแล้ว' : 'ปิดใช้งานวัคซีนแล้ว');
  }

  async function reviewRecord(recordId: string, verificationStatus: 'VERIFIED' | 'REJECTED') {
    await performAction(`record-${recordId}`, async () => {
      const response = await fetch('/api/admin/vaccine-records', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, verificationStatus }),
      });
      await readJson(response);
    }, verificationStatus === 'VERIFIED' ? 'ยืนยันประวัติย้อนหลังแล้ว' : 'ปฏิเสธประวัติที่รายงานแล้ว');
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  const availableVaccines = vaccines.filter((vaccine) => vaccine.isActive && vaccine.stock > 0);
  const pendingAppointments = appointments.filter((appointment) => ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'RESCHEDULE_REQUESTED'].includes(appointment.status));
  const rescheduleSlots = rescheduleTarget
    ? slots.filter((slot) => {
      const scheduledAt = new Date(`${new Date(slot.date).toISOString().slice(0, 10)}T${slot.time}:00+07:00`);
      return slot.hospitalId === rescheduleTarget.hospitalId && slot.isAdminDefined && !slot.isClosed && slot.booked < slot.capacity && scheduledAt > new Date();
    })
    : [];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-semibold text-teal-300">พร้อมฉีด · ADMIN</p>
            <h1 className="mt-1 text-2xl font-extrabold">ระบบจัดการสถานพยาบาล</h1>
          </div>
          <button onClick={() => void logout()} className="text-sm font-semibold text-rose-300 hover:text-rose-200">ออกจากระบบ</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <nav className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm" aria-label="เมนูแอดมิน">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeTab === tab.id ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {tab.label}{tab.id === 'records' && records.length > 0 ? ` (${records.length})` : ''}
            </button>
          ))}
          <button onClick={() => void loadData()} className="ml-auto rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">รีเฟรชข้อมูล</button>
        </nav>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{notice}</p>}
        {isLoading ? <p className="rounded-2xl bg-white p-10 text-center text-slate-500">กำลังโหลดข้อมูล...</p> : <>
          {activeTab === 'appointments' && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-1 border-b p-5 sm:flex-row sm:items-end sm:justify-between">
                <div><h2 className="text-xl font-extrabold">รายการนัดหมายและคิวรับบริการ</h2><p className="mt-1 text-sm text-slate-500">คิวรอดำเนินการ {pendingAppointments.length} รายการ</p></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">เด็ก / ผู้ปกครอง</th><th className="p-4">สถานพยาบาล</th><th className="p-4">วันและเวลา</th><th className="p-4">สถานะ</th><th className="p-4">จัดการ</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {appointments.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">ยังไม่มีรายการนัดหมาย</td></tr> : appointments.map((appointment) => {
                      const isPast = new Date(appointment.scheduledAt) < new Date();
                      
                      return (
                        <tr key={appointment.id} className={isPast && ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(appointment.status) ? 'bg-amber-50/50' : ''}>
                          <td className="p-4"><p className="font-bold">{childName(appointment.child)}</p>
                          {appointment.requestedVaccine && (
    <p className="mt-1 inline-block rounded bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700 border border-teal-100">
      ต้องการ: {appointment.requestedVaccine}
    </p>
  )}
                          <p className="mt-1 text-xs text-slate-500">ผู้ปกครอง: {appointment.user.username} · {appointment.user.email}</p></td>
                          <td className="p-4">{appointment.hospitalName}</td>
                          <td className="whitespace-nowrap p-4">{formatDate(appointment.scheduledAt)} {isPast && ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(appointment.status) && <span className="ml-2 rounded text-[10px] font-bold text-rose-500">(เลยกำหนด)</span>}</td>
                          <td className="p-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${appointment.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : appointment.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' : appointment.status === 'NO_SHOW' ? 'bg-rose-100 text-rose-700' : appointment.status === 'RESCHEDULED' ? 'bg-indigo-100 text-indigo-700' : appointment.status === 'RESCHEDULE_REQUESTED' ? 'bg-orange-100 text-orange-700' : appointment.status === 'CONFIRMED' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                              {appointment.status === 'COMPLETED' ? 'ฉีดแล้ว' : appointment.status === 'CANCELLED' ? 'ยกเลิก' : appointment.status === 'NO_SHOW' ? 'ไม่มาตามนัด' : appointment.status === 'RESCHEDULED' ? 'เลื่อนนัด' : appointment.status === 'RESCHEDULE_REQUESTED' ? 'ขอเลื่อนนัด' : appointment.status === 'CONFIRMED' ? 'ยืนยันคิว' : appointment.isWaitlisted ? 'คิวเต็ม · รออนุมัติ' : appointment.status === 'PENDING' ? 'รออนุมัติ' : appointment.status}
                            </span>
                          </td>
                          <td className="min-w-[310px] p-4">
                            {['PENDING', 'CONFIRMED', 'RESCHEDULED', 'RESCHEDULE_REQUESTED'].includes(appointment.status) ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {/* ปุ่มสำหรับอนุมัติและฉีดวัคซีน */}
                                {appointment.status === 'PENDING' && <button disabled={busyKey === `appointment-${appointment.id}`} onClick={() => void updateAppointment(appointment.id, 'CONFIRMED')} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{appointment.isWaitlisted ? 'รับคิวเข้ารอบ' : 'อนุมัติคิว'}</button>}
                                {!appointment.isWaitlisted && <>
                                  <select aria-label={`เลือกวัคซีนสำหรับ${childName(appointment.child)}`} value={selectedVaccines[appointment.id] ?? ''} onChange={(event) => setSelectedVaccines((current) => ({ ...current, [appointment.id]: event.target.value }))} className="max-w-44 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                                    <option value="">เลือกวัคซีน</option>{availableVaccines.map((vaccine) => <option key={vaccine.id} value={vaccine.id}>{vaccine.name} (คงเหลือ {vaccine.stock})</option>)}
                                  </select>
                                  <button disabled={!selectedVaccines[appointment.id] || busyKey === `complete-${appointment.id}`} onClick={() => void completeAppointment(appointment.id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">ยืนยันฉีดแล้ว</button>
                                </>}

                                {/* ปุ่มยกเลิกของเดิม และปุ่มจัดการกรณีไม่มาตามนัด */}
                                <div className="mt-1 flex w-full gap-2">
                                  <button disabled={busyKey === `appointment-${appointment.id}`} onClick={() => { if (window.confirm('ยืนยันยกเลิกคิวนี้หรือไม่? ระบบจะคืนที่นั่งให้รอบเวลา')) void updateAppointment(appointment.id, 'CANCELLED'); }} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">ยกเลิก</button>
                                  <button disabled={busyKey === `appointment-${appointment.id}`} onClick={() => { if (window.confirm('ยืนยันว่าคนไข้ไม่มาตามนัด?')) void updateAppointment(appointment.id, 'NO_SHOW'); }} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50">❌ ไม่มาตามนัด</button>
                                  <button disabled={busyKey === `reschedule-${appointment.id}`} onClick={() => { setRescheduleTarget(appointment); setNewScheduledAt(''); }} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">{appointment.status === 'RESCHEDULE_REQUESTED' ? 'กำหนดวันใหม่' : 'เลื่อนนัด'}</button>
                                </div>
                              </div>
                            ) : <span className="text-xs text-slate-400">ไม่มีการดำเนินการ</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'slots' && (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b p-5"><h3 className="font-extrabold">รายชื่อสถานพยาบาล</h3></div>
                <ul className="divide-y divide-slate-100">
                  {hospitals.length === 0 ? <li className="p-5 text-sm text-slate-500">ยังไม่มีรายชื่อสถานพยาบาล</li> : hospitals.map((hospital) => (
                    <li key={hospital.id} className="flex items-center justify-between gap-3 p-4">
                      <span className="font-semibold">{hospital.name}</span>
                      <button disabled={busyKey === `hospital-${hospital.id}`} onClick={() => void deleteHospital(hospital)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">ลบชื่อ</button>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-extrabold">เปิดรอบเวลาและกำหนดความจุ</h2>
                <p className="mt-1 text-sm text-slate-500">รอบที่สร้างจะถูกใช้จริงในการจอง ระบบไม่สร้างรอบจำลองให้เอง</p>
                <form onSubmit={(event) => void saveSlot(event)} className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6">
                  <select value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 md:col-span-2"><option value="">เพิ่มสถานพยาบาลใหม่ด้วยชื่อ...</option>{hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</select>
                  {!hospitalId && <input required value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} placeholder="ชื่อโรงพยาบาล/รพ.สต." className="rounded-xl border border-slate-300 px-3 py-2.5 md:col-span-2" />}
                  <input required type="date" value={slotDate} onChange={(event) => setSlotDate(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5" />
                  <input required type="time" value={slotTime} onChange={(event) => setSlotTime(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5" />
                  <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2">รับได้ <input required type="number" min={1} max={500} value={slotCapacity} onChange={(event) => setSlotCapacity(Number(event.target.value))} className="w-20 rounded border border-slate-200 px-2 py-1" /> คน</label>
                  <button disabled={busyKey === 'new-slot'} className="rounded-xl bg-teal-600 px-4 py-2.5 font-bold text-white hover:bg-teal-700 disabled:opacity-50 md:col-span-2">เปิด/บันทึกรอบเวลา</button>
                </form>
              </section>
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b p-5"><h3 className="font-extrabold">รอบเวลาที่บันทึกไว้</h3></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">วัน / เวลา</th><th className="p-4">สถานพยาบาล</th><th className="p-4">คิว</th><th className="p-4">สถานะ</th><th className="p-4">จัดการ</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{slots.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">ยังไม่มีรอบเวลาในอนาคต</td></tr> : slots.map((slot) => <tr key={slot.id}>
                    <td className="p-4">{formatSlotDate(slot.date)} · {slot.time}</td><td className="p-4">{slot.hospital.name}</td><td className="p-4">{slot.booked} / {slot.capacity}</td>
                    <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${!slot.isAdminDefined ? 'bg-slate-100 text-slate-600' : slot.isClosed ? 'bg-rose-100 text-rose-700' : slot.booked >= slot.capacity ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{!slot.isAdminDefined ? 'ยังไม่แสดงผู้ใช้' : slot.isClosed ? 'ปิดรอบ' : slot.booked >= slot.capacity ? 'เต็ม' : 'เปิดรับ'}</span></td>
                    <td className="p-4"><div className="flex gap-2"><button onClick={() => { const value = window.prompt('กำหนดจำนวนคิวทั้งหมด (ต้องไม่น้อยกว่าจำนวนที่จองแล้ว)', String(slot.capacity)); if (value !== null && /^\d+$/.test(value)) void updateSlot(slot.id, { capacity: Number(value) }); }} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">แก้ความจุ</button><button onClick={() => void updateSlot(slot.id, { isClosed: !slot.isClosed })} className={`rounded-lg px-3 py-2 text-xs font-bold ${slot.isClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{slot.isClosed ? 'เปิดรอบ' : 'ปิดฉุกเฉิน'}</button><button onClick={() => void updateSlot(slot.id, { isAdminDefined: !slot.isAdminDefined })} className={`rounded-lg px-3 py-2 text-xs font-bold ${slot.isAdminDefined ? 'bg-slate-100 text-slate-700' : 'bg-teal-50 text-teal-700'}`}>{slot.isAdminDefined ? 'ซ่อนผู้ใช้' : 'แสดงผู้ใช้'}</button></div></td>
                  </tr>)}</tbody>
                </table></div>
              </section>
            </div>
          )}

          {activeTab === 'vaccines' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-extrabold">จัดการประเภทและสต็อกวัคซีน</h2>
                <p className="mt-1 text-sm text-slate-500">เมื่อตรวจยืนยันว่าฉีดแล้ว ระบบจะตัดสต็อกหนึ่งโดสและบันทึกประวัติให้เด็กโดยอัตโนมัติ</p>
                <form onSubmit={(event) => void createVaccine(event)} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input required value={vaccineCode} onChange={(event) => setVaccineCode(event.target.value)} placeholder="รหัสวัคซีน เช่น MMR1" className="rounded-xl border border-slate-300 px-3 py-2.5" />
                  <input required value={vaccineName} onChange={(event) => setVaccineName(event.target.value)} placeholder="ชื่อวัคซีน" className="rounded-xl border border-slate-300 px-3 py-2.5 sm:col-span-2" />
                  <input required type="number" min={0} value={vaccineStock} onChange={(event) => setVaccineStock(Number(event.target.value))} aria-label="จำนวนสต็อกเริ่มต้น" className="rounded-xl border border-slate-300 px-3 py-2.5" />
                  <button disabled={busyKey === 'new-vaccine'} className="rounded-xl bg-teal-600 px-4 py-2.5 font-bold text-white sm:col-span-4">เพิ่มวัคซีน</button>
                </form>
              </section>
              <section className="grid gap-4 md:grid-cols-2">{vaccines.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-slate-500 md:col-span-2">ยังไม่มีข้อมูลวัคซีนในคลัง กรุณาเพิ่มรายการก่อนรับรองการฉีด</p> : vaccines.map((vaccine) => <article key={vaccine.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-teal-700">{vaccine.code}</p><h3 className="mt-1 font-extrabold">{vaccine.name}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${vaccine.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{vaccine.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></div>
                <p className="mt-3 text-sm text-slate-600">ประวัติที่เชื่อมอยู่ {vaccine._count.records} รายการ</p>
                <div className="mt-4 flex flex-wrap items-center gap-2"><label className="text-sm">คงเหลือ <input type="number" min={0} value={stockEdits[vaccine.id] ?? vaccine.stock} onChange={(event) => setStockEdits((current) => ({ ...current, [vaccine.id]: Number(event.target.value) }))} className="ml-1 w-24 rounded-lg border border-slate-300 px-2 py-1.5" /> โดส</label><button onClick={() => void updateVaccine(vaccine.id, { stock: stockEdits[vaccine.id] ?? vaccine.stock })} className="rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700">บันทึกสต็อก</button><button onClick={() => void updateVaccine(vaccine.id, { isActive: !vaccine.isActive })} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{vaccine.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button></div>
              </article>)}</section>
            </div>
          )}

          {activeTab === 'records' && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b p-5"><h2 className="text-xl font-extrabold">ตรวจสอบประวัติวัคซีนย้อนหลัง</h2><p className="mt-1 text-sm text-slate-500">รายการที่ผู้ปกครองรายงานจากสมุดวัคซีนจะยังไม่ถือว่าได้รับการยืนยันจนกว่าเจ้าหน้าที่ตรวจสอบ</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">ผู้ปกครอง / เด็ก</th><th className="p-4">วัคซีน</th><th className="p-4">วันที่ฉีดตามสมุด</th><th className="p-4">สถานพยาบาลในสมุด</th><th className="p-4">ผลตรวจ</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{records.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">ไม่มีประวัติค้างตรวจสอบ</td></tr> : records.map((record) => <tr key={record.id}>
                  <td className="p-4"><p className="font-bold">{childName(record.child)}</p><p className="mt-1 text-xs text-slate-500">{record.user.username} · {record.user.email}</p></td><td className="p-4">{record.vaccineName}<span className="block text-xs text-slate-500">{record.vaccineCode ?? ''}</span></td><td className="whitespace-nowrap p-4">{formatDate(record.administeredDate)}</td><td className="p-4">{record.hospitalName}</td>
                  <td className="p-4"><div className="flex gap-2"><button disabled={busyKey === `record-${record.id}`} onClick={() => void reviewRecord(record.id, 'VERIFIED')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">อนุมัติยืนยัน</button><button disabled={busyKey === `record-${record.id}`} onClick={() => void reviewRecord(record.id, 'REJECTED')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">ปฏิเสธ</button></div></td>
                </tr>)}</tbody>
              </table></div>
            </section>
          )}
        </>}
      </div>

      {/* ป๊อปอัพสำหรับเลื่อนนัดหมาย */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitReschedule} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-fade-in-up">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><span>🗓️</span> เลื่อนนัดหมาย</h3>
            <p className="mt-1 text-sm text-slate-500">
              กำลังเลื่อนนัดของ: <strong>{childName(rescheduleTarget.child)}</strong>
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-700">
              เลือกรอบที่เปิดรับ <span className="text-rose-500">*</span>
              <select required value={newScheduledAt} onChange={(event) => setNewScheduledAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all">
                <option value="">เลือกวันที่และเวลา</option>
                {rescheduleSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>{formatSlotDate(slot.date)} · {slot.time} น. · ว่าง {slot.capacity - slot.booked} คิว</option>
                ))}
              </select>
              {rescheduleSlots.length === 0 && <p className="mt-2 text-xs text-rose-600">ไม่มีรอบว่างของสถานพยาบาลนี้ กรุณาเปิดรอบใหม่ก่อน</p>}
            </label>
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                type="button" 
                onClick={() => setRescheduleTarget(null)} 
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                disabled={busyKey === `reschedule-${rescheduleTarget.id}`} 
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
              >
                {busyKey === `reschedule-${rescheduleTarget.id}` ? 'กำลังดำเนินการ...' : 'กำหนดวันและส่งอีเมล'}
              </button>
            </div>
          </form>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.2s ease-out forwards;
        }
      `}} />
    </main>
  );
}