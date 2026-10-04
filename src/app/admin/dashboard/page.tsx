'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'appointments' | 'slots' | 'vaccines' | 'records' | 'users';
type ManagedUser = {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
};
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
type Hospital = { id: string; name: string; isActive: boolean };
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
  { id: 'users', label: 'จัดการผู้ใช้งาน' },
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

function getBangkokDateTimeInput(date: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
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
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersNextCursor, setUsersNextCursor] = useState<string | null>(null);
  const [usersCurrentCursor, setUsersCurrentCursor] = useState<string | null>(null);
  const [usersPreviousCursors, setUsersPreviousCursors] = useState<(string | null)[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedVaccines, setSelectedVaccines] = useState<Record<string, string>>({});
  const [hospitalId, setHospitalId] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalNameEdits, setHospitalNameEdits] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
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
  const [noticeIsWarning, setNoticeIsWarning] = useState(false);

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

  const loadUsers = useCallback(async (cursor: string | null, signal?: AbortSignal) => {
    setUsersLoading(true);
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('q', searchTerm.trim());
    if (cursor) params.set('cursor', cursor);
    try {
      const response = await fetch(`/api/admin/users?${params}`, {
        cache: 'no-store',
        ...(signal ? { signal } : {}),
      });
      const data = await readJson<{ users: ManagedUser[]; nextCursor: string | null }>(response);
      setUsers(data.users);
      setUsersNextCursor(data.nextCursor);
      setUsersCurrentCursor(cursor);
    } catch (caught) {
      if (!signal?.aborted) {
        setError(caught instanceof Error ? caught.message : 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้');
      }
    } finally {
      if (!signal?.aborted) setUsersLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadUsers(null, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeTab, loadUsers]);

  async function performAction(
    key: string,
    action: () => Promise<string | { message: string; warning?: boolean } | void>,
    successMessage: string
  ) {
    setBusyKey(key);
    setError('');
    setNotice('');
    setNoticeIsWarning(false);
    try {
      const result = await action();
      setNotice(typeof result === 'string' ? result : result?.message || successMessage);
      setNoticeIsWarning(typeof result === 'object' && result !== null && result.warning === true);
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

    await performAction(`reschedule-${rescheduleTarget.id}`, async () => {
      const response = await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: rescheduleTarget.id,
          status: 'RESCHEDULED',
          newScheduledAt: new Date(`${newScheduledAt}:00+07:00`).toISOString()
        }),
      });
      const result = await readJson<{ emailSent: boolean; webPushSent: boolean; delivered: boolean }>(response);
      setRescheduleTarget(null);
      setNewScheduledAt('');
      if (!result.delivered) return { message: 'เลื่อนนัดแล้ว แต่ส่งการแจ้งเตือนไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือการตั้งค่า Push', warning: true };
      if (!result.emailSent) return { message: 'เลื่อนนัดแล้วและส่งแจ้งเตือนบนเว็บแล้ว แต่อีเมลส่งไม่สำเร็จ', warning: true };
      if (!result.webPushSent) return { message: 'เลื่อนนัดแล้วและส่งอีเมลแล้ว (ผู้ใช้ยังไม่ได้เปิด Push)', warning: true };
    }, 'กำหนดวันนัดใหม่และส่งอีเมลแจ้งผู้ปกครองแล้ว');
  }

  async function sendAppointmentNotification(appointmentId: string) {
    await performAction(`notify-${appointmentId}`, async () => {
      const response = await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, status: 'NOTIFY' }),
      });
      const result = await readJson<{ emailSent: boolean; webPushSent: boolean; delivered: boolean }>(response);
      if (!result.delivered) return { message: 'ส่งไม่สำเร็จ: ผู้ใช้ยังไม่มีช่องทางแจ้งเตือนที่พร้อมใช้งาน', warning: true };
      if (result.emailSent && result.webPushSent) return 'ส่งแจ้งเตือนทางอีเมลและเว็บแล้ว';
      return result.emailSent
        ? 'ส่งอีเมลแจ้งเตือนแล้ว (ผู้ใช้ยังไม่ได้เปิด Push)'
        : { message: 'ส่งแจ้งเตือนบนเว็บแล้ว แต่อีเมลส่งไม่สำเร็จ', warning: true };
    }, 'ส่งแจ้งเตือนแล้ว');
  }

  async function updateUserRole(user: ManagedUser, role: ManagedUser['role']) {
    const action = role === 'ADMIN' ? 'ให้สิทธิ์แอดมินแก่' : 'ลดสิทธิ์เป็นผู้ใช้ทั่วไปของ';
    if (!window.confirm(`ยืนยัน${action} ${user.username} (${user.email}) หรือไม่?`)) return;
    await performAction(`user-${user.id}`, async () => {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, role }),
      });
      await readJson(response);
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role } : item));
      return role === 'ADMIN'
        ? 'เปลี่ยนสิทธิ์เป็นแอดมินแล้ว ผู้ใช้ต้องออกจากระบบและเข้าสู่ระบบใหม่เพื่อรับสิทธิ์'
        : 'เปลี่ยนสิทธิ์เป็นผู้ใช้ทั่วไปแล้ว';
    }, 'บันทึกสิทธิ์ผู้ใช้แล้ว');
  }

  async function deleteHospital(hospital: Hospital) {
    if (!window.confirm(`ยืนยันลบสถานพยาบาล “${hospital.name}” และรอบเวลาทั้งหมดหรือไม่? นัดหมายเดิมจะยังคงอยู่ในประวัติ แต่จะไม่ผูกกับสถานพยาบาลนี้`)) return;
    await performAction(`hospital-${hospital.id}`, async () => {
      const response = await fetch('/api/admin/slots', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId: hospital.id }),
      });
      await readJson(response);
      if (hospitalId === hospital.id) setHospitalId('');
    }, 'ลบสถานพยาบาลแล้ว');
  }

  async function updateHospital(hospitalId: string, update: { name?: string; isActive?: boolean }) {
    await performAction(`hospital-${hospitalId}`, async () => {
      const response = await fetch('/api/admin/hospitals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId, ...update }),
      });
      await readJson(response);
    }, update.name !== undefined ? 'บันทึกชื่อสถานพยาบาลแล้ว' : update.isActive ? 'เปิดสถานพยาบาลแล้ว' : 'ปิดสถานพยาบาลแล้ว');
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
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const matchesSearch = (...values: (string | null | undefined)[]) =>
    !normalizedSearch || values.some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
  const filteredAppointments = appointments.filter((appointment) => matchesSearch(
    appointment.id,
    appointment.user.username,
    appointment.user.email,
    childName(appointment.child),
    appointment.hospitalName,
    appointment.requestedVaccine,
    appointment.status
  ));
  const filteredHospitals = hospitals.filter((hospital) => matchesSearch(hospital.name, hospital.id));
  const filteredSlots = slots.filter((slot) => matchesSearch(slot.hospital.name, slot.time));
  const filteredVaccines = vaccines.filter((vaccine) => matchesSearch(vaccine.code, vaccine.name));
  const filteredRecords = records.filter((record) => matchesSearch(
    record.user.username,
    record.user.email,
    childName(record.child),
    record.vaccineName,
    record.vaccineCode,
    record.hospitalName
  ));

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-semibold text-teal-300">พร้อมฉีด · ADMIN</p>
            <h1 className="mt-1 text-2xl font-extrabold">ระบบจัดการวัคซีนและผู้ใช้งาน</h1>
          </div>
          <button onClick={() => void logout()} className="text-sm font-semibold text-rose-300 hover:text-rose-200">ออกจากระบบ</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <nav className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm" aria-label="เมนูแอดมิน">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => {
              if (tab.id === 'users') setUsersPreviousCursors([]);
              setActiveTab(tab.id);
            }} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeTab === tab.id ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {tab.label}{tab.id === 'records' && records.length > 0 ? ` (${records.length})` : ''}
            </button>
          ))}
          <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 sm:max-w-sm">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => {
                setUsersPreviousCursors([]);
                setSearchTerm(event.target.value);
              }}
              placeholder="ค้นหาโรงพยาบาล วัคซีน ผู้ใช้ หรือการจอง"
              aria-label="ค้นหาโรงพยาบาล วัคซีน ผู้ใช้ หรือการจอง"
              className="min-w-0 flex-1 outline-none"
            />
          </label>
          <button onClick={() => void loadData()} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">รีเฟรชข้อมูล</button>
        </nav>

        {error && (
          <div role="alert" className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100%-2rem))] items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 shadow-xl">
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="ปิดข้อความ" className="shrink-0">✕</button>
          </div>
        )}
        {notice && (
          <div role="status" className={`fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100%-2rem))] items-start justify-between gap-3 rounded-xl border p-4 text-sm font-medium shadow-xl ${noticeIsWarning ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="ปิดข้อความ" className="shrink-0">✕</button>
          </div>
        )}
        {isLoading ? <p className="rounded-2xl bg-white p-10 text-center text-slate-500">กำลังโหลดข้อมูล...</p> : <>
          {activeTab === 'appointments' && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-1 border-b p-5 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-xl font-extrabold">รายการนัดหมายและคิวรับบริการ</h2><p className="mt-1 text-sm text-slate-500">คิวรอดำเนินการ {pendingAppointments.length} รายการ · พบ {filteredAppointments.length} รายการ</p></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">เด็ก / ผู้ปกครอง</th><th className="p-4">สถานพยาบาล</th><th className="p-4">วันและเวลา</th><th className="p-4">สถานะ</th><th className="p-4">จัดการ</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAppointments.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">{appointments.length ? 'ไม่พบรายการที่ตรงกับคำค้นหา' : 'ยังไม่มีรายการนัดหมาย'}</td></tr> : filteredAppointments.map((appointment) => {
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
                            <button
                              disabled={busyKey === `notify-${appointment.id}`}
                              onClick={() => void sendAppointmentNotification(appointment.id)}
                              className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                            >
                              {busyKey === `notify-${appointment.id}` ? 'กำลังส่ง...' : 'ส่งแจ้งเตือนตอนนี้'}
                            </button>
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
                  {filteredHospitals.length === 0 ? <li className="p-5 text-sm text-slate-500">{hospitals.length ? 'ไม่พบสถานพยาบาลที่ตรงกับคำค้นหา' : 'ยังไม่มีรายชื่อสถานพยาบาล'}</li> : filteredHospitals.map((hospital) => (
                    <li key={hospital.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <input
                        aria-label={`ชื่อสถานพยาบาล ${hospital.name}`}
                        value={hospitalNameEdits[hospital.id] ?? hospital.name}
                        onChange={(event) => setHospitalNameEdits((current) => ({ ...current, [hospital.id]: event.target.value }))}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busyKey === `hospital-${hospital.id}` || !(hospitalNameEdits[hospital.id] ?? hospital.name).trim()}
                          onClick={() => void updateHospital(hospital.id, { name: hospitalNameEdits[hospital.id] ?? hospital.name })}
                          className="rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 disabled:opacity-50"
                        >บันทึกชื่อ</button>
                        <button
                          disabled={busyKey === `hospital-${hospital.id}`}
                          onClick={() => void updateHospital(hospital.id, { isActive: !hospital.isActive })}
                          className={`rounded-lg px-3 py-2 text-xs font-bold ${hospital.isActive ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}
                        >{hospital.isActive ? 'ปิดรับจอง' : 'เปิดรับจอง'}</button>
                        <button disabled={busyKey === `hospital-${hospital.id}`} onClick={() => void deleteHospital(hospital)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">ลบชื่อ</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-extrabold">เปิดรอบเวลาและกำหนดความจุ</h2>
                <p className="mt-1 text-sm text-slate-500">ใช้จัดการความจุและรอบบริการเดิม; ผู้ใช้ยังส่งคำขอวันเวลาที่ต้องการได้โดยไม่ต้องมีรอบเปิดล่วงหน้า</p>
                <form onSubmit={(event) => void saveSlot(event)} className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6">
                  <select value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 md:col-span-2"><option value="">เพิ่มสถานพยาบาลใหม่ด้วยชื่อ...</option>{hospitals.filter((hospital) => hospital.isActive).map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</select>
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
                  <tbody className="divide-y divide-slate-100">{filteredSlots.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">{slots.length ? 'ไม่พบรอบเวลาที่ตรงกับคำค้นหา' : 'ยังไม่มีรอบเวลาในอนาคต'}</td></tr> : filteredSlots.map((slot) => <tr key={slot.id}>
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
              <section className="grid gap-4 md:grid-cols-2">{filteredVaccines.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-slate-500 md:col-span-2">{vaccines.length ? 'ไม่พบวัคซีนที่ตรงกับคำค้นหา' : 'ยังไม่มีข้อมูลวัคซีนในคลัง กรุณาเพิ่มรายการก่อนรับรองการฉีด'}</p> : filteredVaccines.map((vaccine) => <article key={vaccine.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                <tbody className="divide-y divide-slate-100">{filteredRecords.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">{records.length ? 'ไม่พบประวัติที่ตรงกับคำค้นหา' : 'ไม่มีประวัติค้างตรวจสอบ'}</td></tr> : filteredRecords.map((record) => <tr key={record.id}>
                  <td className="p-4"><p className="font-bold">{childName(record.child)}</p><p className="mt-1 text-xs text-slate-500">{record.user.username} · {record.user.email}</p></td><td className="p-4">{record.vaccineName}<span className="block text-xs text-slate-500">{record.vaccineCode ?? ''}</span></td><td className="whitespace-nowrap p-4">{formatDate(record.administeredDate)}</td><td className="p-4">{record.hospitalName}</td>
                  <td className="p-4"><div className="flex gap-2"><button disabled={busyKey === `record-${record.id}`} onClick={() => void reviewRecord(record.id, 'VERIFIED')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">อนุมัติยืนยัน</button><button disabled={busyKey === `record-${record.id}`} onClick={() => void reviewRecord(record.id, 'REJECTED')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">ปฏิเสธ</button></div></td>
                </tr>)}</tbody>
              </table></div>
            </section>
          )}

          {activeTab === 'users' && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-xl font-extrabold">จัดการผู้ใช้งาน</h2>
                <p className="mt-1 text-sm text-slate-500">เปลี่ยนสิทธิ์บัญชีผู้ใช้ได้โดยตรง ระบบจะป้องกันการลดสิทธิ์แอดมินบัญชีสุดท้าย</p>
              </div>
              {usersLoading ? (
                <p className="p-10 text-center text-sm text-slate-500">กำลังโหลดรายชื่อผู้ใช้...</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr><th className="p-4">ชื่อผู้ใช้</th><th className="p-4">อีเมล</th><th className="p-4">สมัครเมื่อ</th><th className="p-4">สิทธิ์</th><th className="p-4">จัดการสิทธิ์</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.length === 0 ? (
                          <tr><td colSpan={5} className="p-10 text-center text-slate-500">ไม่พบผู้ใช้ที่ตรงกับคำค้นหา</td></tr>
                        ) : users.map((user) => (
                          <tr key={user.id}>
                            <td className="p-4 font-semibold">{user.username}</td>
                            <td className="p-4">{user.email}</td>
                            <td className="whitespace-nowrap p-4">{formatDate(user.createdAt)}</td>
                            <td className="p-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>
                                {user.role === 'ADMIN' ? 'แอดมิน' : 'ผู้ใช้'}
                              </span>
                            </td>
                            <td className="p-4">
                              <button
                                disabled={busyKey === `user-${user.id}`}
                                onClick={() => void updateUserRole(user, user.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                                className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${user.role === 'ADMIN' ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                              >
                                {busyKey === `user-${user.id}` ? 'กำลังบันทึก...' : user.role === 'ADMIN' ? 'ลดสิทธิ์เป็นผู้ใช้' : 'กำหนดเป็นแอดมิน'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t p-4">
                    <button
                      disabled={usersPreviousCursors.length === 0 || usersLoading}
                      onClick={() => {
                        const previousCursors = [...usersPreviousCursors];
                        const cursor = previousCursors.pop() ?? null;
                        setUsersPreviousCursors(previousCursors);
                        void loadUsers(cursor);
                      }}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                    >ก่อนหน้า</button>
                    <span className="text-xs text-slate-500">{users.length} รายการในหน้านี้</span>
                    <button
                      disabled={!usersNextCursor || usersLoading}
                      onClick={() => {
                        setUsersPreviousCursors((current) => [...current, usersCurrentCursor]);
                        if (usersNextCursor) void loadUsers(usersNextCursor);
                      }}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                    >ถัดไป</button>
                  </div>
                </>
              )}
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
              วันและเวลาใหม่ <span className="text-rose-500">*</span>
              <input
                required
                type="datetime-local"
                min={getBangkokDateTimeInput(new Date())}
                value={newScheduledAt}
                onChange={(event) => setNewScheduledAt(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <span className="mt-2 block text-xs font-normal text-slate-500">กำหนดวันและเวลาได้โดยตรง ไม่จำเป็นต้องสร้างรอบคิวล่วงหน้า</span>
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
                {busyKey === `reschedule-${rescheduleTarget.id}` ? 'กำลังดำเนินการ...' : 'กำหนดวันและแจ้งผู้ปกครอง'}
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