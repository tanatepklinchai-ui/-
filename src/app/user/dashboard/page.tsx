// src/app/user/dashboard/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { VACCINE_SCHEDULE } from '@/lib/vaccineSchedule';
import { calculateAgeDisplay } from '@/lib/utils/formatAge';
import NotificationToast from '@/components/NotificationToast';
import type { ToastMessage } from '@/components/NotificationToast';

type HospitalOption = {
  id: string;
  name: string;
  distance: string;
  availableDates: { date: string; dateString: string; slots: string[]; fullSlots: string[] }[];
};

type Appointment = {
  id: string;
  hospitalName: string;
  hospitalId: string | null;
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  isWaitlisted: boolean;
  hospital: { slots: { date: string; time: string; booked: number; capacity: number }[] } | null;
};

type ChildProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  weight: number | null;
  height: number | null;
};

type VaccineRecord = {
  id: string;
  vaccineCode: string | null;
  vaccineName: string;
  administeredDate: string;
  hospitalName: string;
  source: string;
  verificationStatus: string;
  createdAt: string;
  vaccineCatalogId?: string | null;
};

type RecentActivity = {
  id: string;
  title: string;
  description: string;
  date: string;
  kind: 'appointment' | 'vaccine';
};

function getDueDate(birthDate: string, ageInMonths: number) {
  const dueDate = new Date(birthDate);
  const birthDay = dueDate.getUTCDate();
  dueDate.setUTCDate(1);
  dueDate.setUTCMonth(dueDate.getUTCMonth() + ageInMonths);
  const lastDay = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 0)).getUTCDate();
  dueDate.setUTCDate(Math.min(birthDay, lastDay));
  return dueDate;
}

function getBangkokDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const partValues = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${partValues.year}-${partValues.month}-${partValues.day}`;
}

function getBangkokSlotKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const partValues = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${partValues.year}-${partValues.month}-${partValues.day}|${partValues.hour}:${partValues.minute}`;
}

export default function ColorfulDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'schedule' | 'tips'>('overview');
  
  // States: Appointments & Hospitals
  const [isLocating, setIsLocating] = useState(false);
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [selectedDateSlot, setSelectedDateSlot] = useState<{date: string, dateString: string, time: string, isWaitlistRequest?: boolean} | null>(null);
  const [vaccineToBook, setVaccineToBook] = useState<{ name: string; age: string } | null>(null);
  const [realHospitals, setRealHospitals] = useState<HospitalOption[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cancellationTarget, setCancellationTarget] = useState<Appointment | null>(null);
  const [isCancellingAppointment, setIsCancellingAppointment] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentError, setAppointmentError] = useState('');
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [editSlotKey, setEditSlotKey] = useState('');

  // States: Child Profile
  const [childProfile, setChildProfile] = useState<ChildProfile | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', dob: '', weight: '', height: '' });
  const [profileLoading, setProfileLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // States: Standard Vaccines
  const [vaccineRecords, setVaccineRecords] = useState<VaccineRecord[]>([]);
  const [vaccineLoading, setVaccineLoading] = useState(true);
  const [recordingVaccineCode, setRecordingVaccineCode] = useState<string | null>(null);
  const [vaccineRecordForm, setVaccineRecordForm] = useState({ administeredDate: '', hospitalName: '' });
  const [isSavingVaccineRecord, setIsSavingVaccineRecord] = useState(false);
  const [vaccineError, setVaccineError] = useState('');
  
  // States: Custom Vaccines
  const [catalogVaccines, setCatalogVaccines] = useState<{id: string, code: string, name: string}[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customSearch, setCustomSearch] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [customHospital, setCustomHospital] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  // --- States: Email Notification ---
  const [notificationEmail, setNotificationEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const notify = (type: ToastMessage['type'], title: string, description?: string) => {
    setToast({ type, title, description });
  };
useEffect(() => {
    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => { if (data.email) setNotificationEmail(data.email); })
      .catch(() => {});
  }, []);

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmail(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: notificationEmail })
      });
      if (!res.ok) throw new Error('บันทึกอีเมลไม่สำเร็จ');
      notify('success', 'บันทึกอีเมลสำเร็จ', 'ระบบจะส่งการแจ้งเตือน 3 วัน และ 1 วัน ล่วงหน้า');
    } catch (err: any) {
      notify('error', 'ข้อผิดพลาด', err.message);
    } finally {
      setIsSavingEmail(false);
    }
  };
  // ดึงรายการวัคซีนทางเลือก
  useEffect(() => {
    fetch('/api/vaccines/custom')
      .then(res => res.json())
      .then(data => setCatalogVaccines(data.catalog ?? []))
      .catch(() => {});
  }, []);

  const filteredCatalog = catalogVaccines.filter(v => v.name.toLowerCase().includes(customSearch.toLowerCase()));

  // ฟังก์ชันค้นหาโรงพยาบาลจากข้อความ
  const handleSearchHospitals = async (keyword: string) => {
    setHospitalSearchQuery(keyword);
    if (keyword.length > 2) {
      try {
        const res = await fetch(`/api/hospitals?search=${encodeURIComponent(keyword)}`);
        const data = await res.json();
        if (res.ok) setRealHospitals(data.hospitals ?? []);
      } catch (err) {
        console.error('Search failed', err);
      }
    } else if (keyword.length === 0) {
      setRealHospitals([]);
    }
  };

  const handleSubmitCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId) return;
    setIsSavingVaccineRecord(true);
    try {
      if (selectedCatalogId) {
        const res = await fetch('/api/vaccines/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: selectedChildId,
            vaccineCatalogId: selectedCatalogId,
            administeredDate: new Date(`${customDate}T12:00:00+07:00`).toISOString(),
            hospitalName: customHospital,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setVaccineRecords(curr => [data.record, ...curr]);
        notify('success', 'บันทึกประวัติสำเร็จ', 'รอเจ้าหน้าที่ตรวจสอบยืนยัน');
      } else {
        const res = await fetch('/api/vaccines/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestedName: customSearch }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        notify('info', 'ส่งคำขอเพิ่มวัคซีนสำเร็จ', 'ระบบจะส่งให้เจ้าหน้าที่ตรวจสอบและเพิ่มชื่อวัคซีนในเร็วๆ นี้');
      }
      setIsAddingCustom(false);
      setCustomSearch(''); setSelectedCatalogId(''); setCustomDate(''); setCustomHospital('');
    } catch (err: any) {
      notify('error', 'ผิดพลาด', err.message);
    } finally {
      setIsSavingVaccineRecord(false);
    }
  };

  useEffect(() => {
    if (!selectedChildId) return;
    const controller = new AbortController();
    const loadAppointments = async () => {
      setAppointmentsLoading(true);
      try {
        const response = await fetch(`/api/appointments?childId=${encodeURIComponent(selectedChildId)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'ไม่สามารถดึงข้อมูลนัดหมายได้');
        setAppointments(data.appointments);
      } catch (error) {
        if (!controller.signal.aborted) {
          setAppointmentError(error instanceof Error ? error.message : 'ไม่สามารถดึงข้อมูลนัดหมายได้');
        }
      } finally {
        if (!controller.signal.aborted) setAppointmentsLoading(false);
      }
    };
    void loadAppointments();
    return () => controller.abort();
  }, [selectedChildId]);

  useEffect(() => {
    const loadChildren = async () => {
      try {
        const response = await fetch('/api/children');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดข้อมูลเด็กได้');
        const loadedChildren: ChildProfile[] = data.children ?? [];
        setChildren(loadedChildren);
        if (loadedChildren.length > 0) {
          const query = new URLSearchParams(window.location.search);
          const requestedChildId = query.get('childId');
          const firstChild = loadedChildren.find((child) => child.id === requestedChildId) ?? loadedChildren[0];
          if (query.get('tab') === 'appointments') setActiveTab('appointments');
          setAppointmentsLoading(true);
          setVaccineLoading(true);
          setChildProfile(firstChild);
          setSelectedChildId(firstChild.id);
          setProfileForm({
            firstName: firstChild.firstName ?? '',
            dob: firstChild.dob ? firstChild.dob.slice(0, 10) : '',
            weight: firstChild.weight?.toString() ?? '',
            height: firstChild.height?.toString() ?? '',
          });
        } else {
          setIsAddingChild(true);
          setAppointmentsLoading(false);
          setVaccineLoading(false);
        }
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลเด็กได้');
        setAppointmentsLoading(false);
        setVaccineLoading(false);
      } finally {
        setProfileLoading(false);
      }
    };
    void loadChildren();
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const controller = new AbortController();
    const loadVaccineRecords = async () => {
      setVaccineLoading(true);
      try {
        const response = await fetch(`/api/vaccines/records?childId=${encodeURIComponent(selectedChildId)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดประวัติวัคซีนได้');
        setVaccineRecords(data.records ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setVaccineError(error instanceof Error ? error.message : 'ไม่สามารถโหลดประวัติวัคซีนได้');
        }
      } finally {
        if (!controller.signal.aborted) setVaccineLoading(false);
      }
    };
    void loadVaccineRecords();
    return () => controller.abort();
  }, [selectedChildId]);

  const vaccineRows = childProfile?.dob
    ? VACCINE_SCHEDULE.map((vaccine) => {
      const dueDate = getDueDate(childProfile.dob!, vaccine.ageInMonths);
      const record = vaccineRecords.find((item) => item.vaccineCode === vaccine.code);
      const isDue = getBangkokDateKey(dueDate) <= getBangkokDateKey(new Date());
      return { vaccine, dueDate, record, isDue };
    })
    : [];
  const visibleAppointments = appointments.filter((appointment) => appointment.status !== 'CANCELLED');
  const verifiedVaccineCount = vaccineRows.filter(({ record }) => record?.verificationStatus === 'VERIFIED').length;
  const vaccineProgress = vaccineRows.length > 0 ? Math.round((verifiedVaccineCount / vaccineRows.length) * 100) : 0;
  const nextVaccine = vaccineRows.find(({ record }) => record?.verificationStatus !== 'VERIFIED') ?? null;
  const todayKey = getBangkokDateKey(new Date());
  const daysUntilNextVaccine = nextVaccine
    ? Math.ceil((Date.parse(getBangkokDateKey(nextVaccine.dueDate)) - Date.parse(todayKey)) / 86_400_000)
    : null;
  const nextAppointment = appointments.find((appointment) =>
    ['PENDING', 'CONFIRMED'].includes(appointment.status) && new Date(appointment.scheduledAt) > new Date()
  );
  
  const recentActivity: RecentActivity[] = [
    ...vaccineRecords.map((record) => ({
      id: `vaccine-${record.id}`,
      title: record.verificationStatus === 'VERIFIED'
        ? 'ยืนยันประวัติวัคซีนแล้ว'
        : record.verificationStatus === 'REJECTED'
          ? 'ประวัติวัคซีนต้องตรวจสอบอีกครั้ง'
          : 'ส่งประวัติวัคซีนให้ตรวจสอบ',
      description: `${record.vaccineName} · ${new Date(record.administeredDate).toLocaleDateString('th-TH')}`,
      date: record.createdAt,
      kind: 'vaccine' as const,
    })),
    ...appointments.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      title: appointment.status === 'COMPLETED'
        ? 'บันทึกการฉีดวัคซีนแล้ว'
        : appointment.status === 'CANCELLED'
          ? 'ยกเลิกนัดหมายแล้ว'
          : appointment.status === 'EXPIRED'
            ? 'นัดหมายหมดอายุ'
            : appointment.isWaitlisted
              ? 'ส่งคำขอเข้าคิวรออนุมัติ'
              : appointment.status === 'CONFIRMED'
                ? 'ยืนยันการจองแล้ว'
                : 'บันทึกการจองแล้ว',
      description: `${appointment.hospitalName} · ${new Date(appointment.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`,
      date: appointment.updatedAt || appointment.createdAt,
      kind: 'appointment' as const,
    })),
  ].sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()).slice(0, 5);

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError('');
    try {
      const response = await fetch(isAddingChild || !selectedChildId ? '/api/children' : `/api/children/${selectedChildId}`, {
        method: isAddingChild || !selectedChildId ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถบันทึกข้อมูลเด็กได้');
      const savedChild: ChildProfile = data.child;
      setChildProfile(savedChild);
      setChildren((current) => current.some((child) => child.id === savedChild.id)
        ? current.map((child) => child.id === savedChild.id ? savedChild : child)
        : [...current, savedChild]);
      setSelectedChildId(savedChild.id);
      setIsAddingChild(false);
      notify('success', isAddingChild ? 'เพิ่มข้อมูลเด็กแล้ว' : 'บันทึกข้อมูลเด็กแล้ว');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'ไม่สามารถบันทึกข้อมูลเด็กได้');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSelectChild = (childId: string) => {
    const child = children.find((item) => item.id === childId);
    if (!child) return;
    setSelectedChildId(child.id);
    setChildProfile(child);
    setAppointments([]);
    setVaccineRecords([]);
    setAppointmentsLoading(true);
    setVaccineLoading(true);
    setIsAddingChild(false);
    setProfileForm({
      firstName: child.firstName ?? '',
      dob: child.dob ? child.dob.slice(0, 10) : '',
      weight: child.weight?.toString() ?? '',
      height: child.height?.toString() ?? '',
    });
    setRecordingVaccineCode(null);
  };

  const handleAddChild = () => {
    setSelectedChildId(null);
    setChildProfile(null);
    setAppointments([]);
    setVaccineRecords([]);
    setAppointmentsLoading(false);
    setVaccineLoading(false);
    setIsAddingChild(true);
    setProfileForm({ firstName: '', dob: '', weight: '', height: '' });
    setRecordingVaccineCode(null);
    setProfileError('');
  };

  const handleReportVaccine = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recordingVaccineCode || !selectedChildId) return;
    setIsSavingVaccineRecord(true);
    setVaccineError('');
    try {
      const administeredDate = new Date(`${vaccineRecordForm.administeredDate}T12:00:00+07:00`);
      const response = await fetch('/api/vaccines/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: selectedChildId,
          vaccineCode: recordingVaccineCode,
          administeredDate: administeredDate.toISOString(),
          hospitalName: vaccineRecordForm.hospitalName,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถบันทึกประวัติวัคซีนได้');
      setVaccineRecords((current) => [data.record, ...current]);
      setRecordingVaccineCode(null);
      setVaccineRecordForm({ administeredDate: '', hospitalName: '' });
      notify('success', 'ส่งประวัติวัคซีนให้ตรวจสอบแล้ว', 'รายการจะแสดงว่า “รอตรวจ” จนกว่าเจ้าหน้าที่จะยืนยัน');
    } catch (error) {
      setVaccineError(error instanceof Error ? error.message : 'ไม่สามารถบันทึกประวัติวัคซีนได้');
    } finally {
      setIsSavingVaccineRecord(false);
    }
  };

  const handleFindNearby = () => {
    setIsLocating(true);
    setHospitalSearchQuery(''); // เคลียร์ช่องค้นหาถ้าใช้ GPS
    if (!navigator.geolocation) {
      notify('error', 'อุปกรณ์นี้ไม่รองรับ GPS', 'ลองค้นหาสถานพยาบาลจากอุปกรณ์ที่เปิดใช้ตำแหน่งได้');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/hospitals?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'ค้นหาสถานพยาบาลไม่สำเร็จ');
          setRealHospitals(data.hospitals ?? []);
          setSelectedHospital(null);
          setSelectedDateSlot(null);
        } catch (error) {
          notify('error', 'ค้นหาสถานพยาบาลไม่สำเร็จ', error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        const description = error.code === error.PERMISSION_DENIED
          ? 'อนุญาตการเข้าถึงตำแหน่งจากการตั้งค่าเบราว์เซอร์ก่อนค้นหา'
          : error.code === error.TIMEOUT
            ? 'การค้นหาตำแหน่งใช้เวลานานเกินไป กรุณาลองอีกครั้ง'
            : 'ตรวจสอบการตั้งค่าตำแหน่งของอุปกรณ์แล้วลองใหม่';
        notify('error', 'ระบุตำแหน่งไม่ได้', description);
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleBooking = async () => {
    if (!selectedChildId) {
      setAppointmentError('กรุณาเลือกเด็กก่อนจองนัดหมาย');
      return;
    }
    if (!selectedHospital || !selectedDateSlot) {
      notify('info', 'เลือกสถานพยาบาลและรอบเวลาก่อน', 'เลือกสถานพยาบาลใกล้คุณ แล้วแตะเวลาที่ต้องการจอง');
      return;
    }

    const hospital = realHospitals.find((item) => item.id === selectedHospital);
    if (!hospital) return;

    setIsSavingAppointment(true);
    setAppointmentError('');
    try {
      const scheduledAt = new Date(`${selectedDateSlot.dateString}T${selectedDateSlot.time}:00+07:00`);
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: selectedChildId, hospitalId: hospital.id, scheduledAt: scheduledAt.toISOString(),requestedVaccine: vaccineToBook ? `${vaccineToBook.name} (${vaccineToBook.age})` : null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถบันทึกนัดหมายได้');

      setAppointments((current) => [...current, data.appointment].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      ));
      setSelectedHospital(null);
      setSelectedDateSlot(null);
      setVaccineToBook(null);
      notify(
        data.waitlisted ? 'info' : 'success',
        data.waitlisted ? 'คิวเต็ม กำลังรออนุมัติ' : 'ยืนยันการจองแล้ว',
        `${hospital.name} · ${selectedDateSlot.date} เวลา ${selectedDateSlot.time} น.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถบันทึกนัดหมายได้';
      setAppointmentError(message);
      notify('error', 'จองนัดหมายไม่สำเร็จ', message);
    } finally {
      setIsSavingAppointment(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    setIsCancellingAppointment(true);
    setAppointmentError('');
    try {
      const response = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, status: 'CANCELLED' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถยกเลิกนัดหมายได้');
      setAppointments((current) => current.filter((appointment) => appointment.id !== appointmentId));
      setCancellationTarget(null);
      notify('success', 'ยกเลิกนัดหมายแล้ว', 'คืนที่นั่งให้รอบเวลาเรียบร้อย');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถยกเลิกนัดหมายได้';
      setAppointmentError(message);
      notify('error', 'ยกเลิกนัดหมายไม่สำเร็จ', message);
    } finally {
      setIsCancellingAppointment(false);
    }
  };

  const handleRescheduleAppointment = async (appointmentId: string) => {
    const [date, time] = editSlotKey.split('|');
    if (!date || !time) {
      setAppointmentError('กรุณาเลือกช่วงเวลาใหม่');
      notify('info', 'ยังไม่ได้เลือกเวลาใหม่', 'เลือกหนึ่งในรอบเวลาที่ยังว่าง');
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00+07:00`);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      setAppointmentError('กรุณาเลือกวันและเวลาในอนาคต');
      notify('error', 'เวลาใหม่นี้ใช้ไม่ได้', 'กรุณาเลือกวันและเวลาในอนาคต');
      return;
    }

    try {
      const response = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, scheduledAt: scheduledAt.toISOString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถเปลี่ยนเวลานัดหมายได้');
      setAppointments((current) => current.map((appointment) =>
        appointment.id === appointmentId ? data.appointment : appointment
      ));
      setEditingAppointmentId(null);
      setEditSlotKey('');
      setAppointmentError('');
      notify('success', 'เปลี่ยนเวลานัดแล้ว');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถเปลี่ยนเวลานัดหมายได้';
      setAppointmentError(message);
      notify('error', 'เปลี่ยนเวลานัดไม่สำเร็จ', message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const preVaccineTips = [
    "สังเกตอาการเจ็บป่วยของเด็ก หากมีไข้สูงหรือเจ็บป่วยรุนแรง ควรแจ้งเจ้าหน้าที่ก่อนฉีดวัคซีน",
    "ให้เด็กพักผ่อนให้เพียงพอ ก่อนมารับวัคซีน",
    "ให้เด็กกินอาหารรับประทานอาหารและดื่มนมตามปกติ",
    "เตรียมข้อมูลสุขภาพของเด็ก เช่น ประวัติแพ้ยา แพ้อาหาร เพื่อแจ้งแก่เจ้าหน้าที่ก่อนฉีด"
  ];

  const postVaccineTips = [
    "สังเกตอาการหลังฉีดวัคซีน อย่างน้อย 30 นาทีที่สถานพยาบาล เพื่อดูอาการแพ้รุนแรง เช่น หายใจลำบาก หน้าบวม ปากบวม หรือมีผื่นทั่วตัว",
    "บริเวณที่ฉีดอาจมีอาการปวด บวม แดง หรือกดเจ็บเล็กน้อย สามารถประคบเย็นเพื่อลดอาการได้ และหลีกเลี่ยงการนวดหรือกดแรง ๆ",
    "หากมีไข้หรือไม่สบายตัว ให้เด็กพักผ่อนและดื่มน้ำหรือนมให้เพียงพอ หากไข้สูงหรือเด็กไม่สบายมาก ควรปรึกษาบุคลากรทางการแพทย์เรื่องการใช้ยาลดไข้",
    "ให้เด็กรับประทานอาหารและนมตามปกติ ไม่จำเป็นต้องงดอาหารหลังฉีดวัคซีน",
    "ติดตามอาการในช่วง 1–2 วันแรก อาการปวด บวม แดง หรือมีไข้เล็กน้อยมักเกิดขึ้นชั่วคราวและค่อย ๆ ดีขึ้น",
    "รีบพาเด็กไปโรงพยาบาล หากมีอาการผิดปกติรุนแรง เช่น หายใจลำบาก ซึมมาก ชัก หมดสติ หน้าหรือคอบวม ไข้สูงมาก หรือร้องกวนผิดปกติและปลอบไม่หยุด",
    "เก็บสมุดวัคซีนไว้และตรวจสอบวันนัดครั้งต่อไป เพื่อให้เด็กได้รับวัคซีนครบตามกำหนด"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-slate-800 font-sans flex flex-col md:flex-row">
      <NotificationToast message={toast} onDismiss={dismissToast} />
      
      {/* 1. SIDEBAR (สำหรับหน้าจอคอมพิวเตอร์ - ซ่อนในมือถือ) */}
      <aside className="hidden md:flex w-72 bg-white/80 backdrop-blur-xl border-r border-indigo-50 flex-col justify-between p-6 sticky top-0 h-screen shadow-sm z-30">
        <div>
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-10 px-2">
            <div className="w-12 h-12 bg-gradient-to-tr from-teal-400 to-teal-300 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-teal-200">
              พ
            </div>
            <div>
              <span className="font-extrabold text-xl text-teal-800 tracking-tight">พร้อมฉีด</span>
              <p className="text-xs text-slate-400 font-medium">ระบบบริหารวัคซีน</p>
            </div>
          </div>

          {/* Sidebar Menu Links */}
          <nav className="space-y-2">
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'overview' ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}><span>📊</span> ภาพรวมโปรไฟล์</button>
            <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'schedule' ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}><span>💉</span> ตารางประวัติวัคซีน</button>
            <button onClick={() => setActiveTab('appointments')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'appointments' ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}><span>📅</span> จองคิวฉีดวัคซีน</button>
            <button onClick={() => setActiveTab('tips')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'tips' ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}><span>🧸</span> คำแนะนำก่อน-หลังฉีด</button>
          </nav>
        </div>
        <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-xs font-bold text-pink-500 hover:text-pink-600 bg-pink-50 hover:bg-pink-100 p-3.5 rounded-2xl transition-colors w-full"><span>🚪</span> ออกจากระบบ</button>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar สำหรับมือถือ และแสดง Header ด้านบน */}
        <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-indigo-50 flex justify-between items-center sticky top-0 z-20 shadow-sm md:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-teal-400 to-teal-300 rounded-xl flex items-center justify-center text-white font-bold shadow-md">พ</div>
            <span className="font-extrabold text-lg text-teal-800">พร้อมฉีด</span>
          </div>
          <button onClick={handleLogout} className="text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1.5 rounded-full">ออกจากระบบ</button>
        </header>

        {/* 3. TOP NAVIGATION TABS (สำหรับสลับหน้าจอในมือถือ) */}
        <div className="bg-white/50 backdrop-blur-sm border-b border-indigo-50 px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar md:hidden">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>ภาพรวม</button>
          <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>ตารางวัคซีน</button>
          <button onClick={() => setActiveTab('appointments')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'appointments' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>จองคิว</button>
          <button onClick={() => setActiveTab('tips')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'tips' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>คำแนะนำ</button>
        </div>

        <main className="flex-1 p-4 md:p-10 max-w-5xl mx-auto w-full space-y-8">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-blue-100/50 border border-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center text-3xl">👶🏻</div>
                  <div>
                    <h1 className="text-2xl font-extrabold text-blue-900">{isAddingChild ? 'เพิ่มข้อมูลเด็ก' : childProfile?.firstName || 'ข้อมูลเด็ก'}</h1>
                    <p className="text-sm text-blue-600 mt-1">
                      {childProfile?.dob ? `อายุ ${calculateAgeDisplay(childProfile.dob)}` : 'เพิ่มวันเกิดเพื่อสร้างตารางวัคซีนตามอายุ'}
                    </p>
                  </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {children.length > 0 && (
                      <select
                        value={isAddingChild ? '' : selectedChildId ?? ''}
                        onChange={(event) => handleSelectChild(event.target.value)}
                        className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 sm:min-w-48"
                        aria-label="เลือกเด็ก"
                      >
                        {children.map((child, index) => (
                          <option key={child.id} value={child.id}>{child.firstName || `เด็กคนที่ ${index + 1}`}</option>
                        ))}
                        {isAddingChild && <option value="">เพิ่มเด็กใหม่</option>}
                      </select>
                    )}
                    {!isAddingChild && (
                      <button onClick={handleAddChild} className="rounded-xl bg-sky-100 px-4 py-2.5 text-xs font-bold text-sky-800 hover:bg-sky-200">
                        + เพิ่มเด็ก
                      </button>
                    )}
                    {isAddingChild && children.length > 0 && (
                      <button onClick={() => handleSelectChild(children[0].id)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200">
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </div>
                {profileError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{profileError}</p>}
                <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="text-xs font-bold text-slate-600">
                    ชื่อเด็ก
                    <input value={profileForm.firstName} onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800" placeholder="ชื่อเล่นหรือชื่อจริง" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    วันเดือนปีเกิด
                    <input type="date" required value={profileForm.dob} max={getBangkokDateKey(new Date())} onChange={(event) => setProfileForm((current) => ({ ...current, dob: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    น้ำหนัก (กก.)
                    <input type="number" min="0" step="0.1" value={profileForm.weight} onChange={(event) => setProfileForm((current) => ({ ...current, weight: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    ส่วนสูง (ซม.)
                    <input type="number" min="0" step="0.1" value={profileForm.height} onChange={(event) => setProfileForm((current) => ({ ...current, height: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800" />
                  </label>
                  <div className="sm:col-span-2">
                    <button type="submit" disabled={isSavingProfile || profileLoading} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">
                      {isSavingProfile ? 'กำลังบันทึก...' : isAddingChild ? 'เพิ่มเด็ก' : 'บันทึกข้อมูลเด็ก'}
                    </button>
                  </div>
                </form>
              </section>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold text-slate-500">ประวัติที่ยืนยันแล้ว</p>
                  <p className="mt-2 text-2xl font-extrabold text-emerald-800">{verifiedVaccineCount}<span className="ml-1 text-sm font-semibold text-slate-500">/ {vaccineRows.length} รายการ</span></p>
                </section>
                <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold text-slate-500">ความคืบหน้าการรับวัคซีน</p>
                  {vaccineRows.length > 0 ? (
                    <>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="ความคืบหน้าการรับวัคซีน" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vaccineProgress}>
                          <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500" style={{ width: `${vaccineProgress}%` }} />
                        </div>
                        <span className="min-w-10 text-right text-sm font-extrabold text-teal-800">{vaccineProgress}%</span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">นับเฉพาะรายการที่เจ้าหน้าที่ยืนยันแล้ว</p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-slate-500">เพิ่มวันเกิดเพื่อคำนวณกำหนดวัคซีน</p>
                  )}
                </section>
                <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold text-slate-500">นัดหมายถัดไป</p>
                  {nextAppointment ? (
                    <>
                      <p className="mt-2 truncate text-base font-extrabold text-indigo-900">{nextAppointment.hospitalName}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(nextAppointment.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.</p>
                      {nextAppointment.isWaitlisted && <p className="mt-1 text-xs font-bold text-amber-700">คิวเต็ม · รออนุมัติ</p>}
                    </>
                  ) : <p className="mt-2 text-base font-bold text-slate-400">ยังไม่มีนัดหมาย</p>}
                </section>
              </div>

              <section className={`overflow-hidden rounded-2xl border shadow-sm ${nextVaccine && nextVaccine.record?.verificationStatus !== 'PENDING' && nextVaccine.isDue ? 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50' : 'border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50'}`}>
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${nextVaccine?.record?.verificationStatus === 'PENDING' ? 'bg-sky-100' : 'bg-amber-100'}`} aria-hidden="true">{nextVaccine?.record?.verificationStatus === 'PENDING' ? '⌛' : nextVaccine ? '💉' : '✓'}</div>
                    <div>
                      <p className="text-xs font-extrabold uppercase text-slate-500">วัคซีนเข็มถัดไป</p>
                      {nextVaccine ? (
                        <>
                          <h2 className="mt-1 text-lg font-extrabold text-slate-900">{nextVaccine.vaccine.name} · {nextVaccine.vaccine.dose}</h2>
                          <p className="mt-1 text-sm text-slate-600">กำหนดอายุ {nextVaccine.vaccine.ageCriteria} · {new Date(nextVaccine.dueDate).toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'UTC' })}</p>
                          <p className={`mt-2 text-sm font-bold ${nextVaccine.record?.verificationStatus === 'PENDING' ? 'text-sky-800' : nextVaccine.isDue ? 'text-rose-700' : 'text-amber-800'}`}>
                            {nextVaccine.record?.verificationStatus === 'PENDING'
                              ? 'ได้รับข้อมูลจากผู้ปกครองแล้ว · รอเจ้าหน้าที่ตรวจสอบ'
                              : nextVaccine.record?.verificationStatus === 'REJECTED'
                                ? 'ประวัติเดิมต้องตรวจสอบอีกครั้ง'
                                : daysUntilNextVaccine !== null && daysUntilNextVaccine <= 0
                                  ? 'ถึงกำหนดแล้ว · ตรวจสมุดวัคซีนก่อนจอง'
                                  : daysUntilNextVaccine !== null && daysUntilNextVaccine <= 30
                                    ? `ใกล้ถึงกำหนดใน ${daysUntilNextVaccine} วัน`
                                    : 'ยังไม่ถึงกำหนดรับวัคซีน'}
                          </p>
                        </>
                      ) : childProfile?.dob ? (
                        <>
                          <h2 className="mt-1 text-lg font-extrabold text-emerald-900">ยืนยันครบทุกเข็มในตารางแล้ว</h2>
                          <p className="mt-1 text-sm text-slate-600">หากมีวัคซีนเพิ่มเติม สามารถตรวจสอบกับบุคลากรทางการแพทย์ได้</p>
                        </>
                      ) : (
                        <>
                          <h2 className="mt-1 text-lg font-extrabold text-slate-800">เพิ่มวันเกิดเพื่อสร้างกำหนดวัคซีน</h2>
                          <p className="mt-1 text-sm text-slate-600">ระบบยังไม่มีข้อมูลพอที่จะระบุวัคซีนเข็มถัดไป</p>
                        </>
                      )}
                    </div>
                  </div>
                  {nextVaccine && (
                    <button
                      onClick={() => {
                        if (nextVaccine.record?.verificationStatus === 'PENDING') {
                          setActiveTab('schedule');
                          return;
                        }
                        if (nextVaccine.record?.verificationStatus === 'REJECTED') {
                          setRecordingVaccineCode(nextVaccine.vaccine.code);
                          setVaccineError('');
                          setActiveTab('schedule');
                          return;
                        }
                        setVaccineToBook({ name: `${nextVaccine.vaccine.name} (${nextVaccine.vaccine.dose})`, age: nextVaccine.vaccine.ageCriteria });
                        setActiveTab('appointments');
                      }}
                      className="shrink-0 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700"
                    >
                      {nextVaccine.record?.verificationStatus === 'PENDING' ? 'ดูสถานะตรวจสอบ' : nextVaccine.record?.verificationStatus === 'REJECTED' ? 'แก้ไขประวัติ' : 'ค้นหารอบเวลาว่าง'}
                    </button>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">กิจกรรมล่าสุด</h2>
                    <p className="mt-1 text-xs text-slate-500">รายการจากนัดหมายและประวัติวัคซีนของเด็กคนนี้</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{recentActivity.length} รายการ</span>
                </div>
                {recentActivity.length === 0 ? (
                  <p className="mt-5 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">ยังไม่มีกิจกรรม เมื่อมีการจองหรือบันทึกวัคซีน รายการจะแสดงที่นี่</p>
                ) : (
                  <ol className="mt-5 divide-y divide-slate-100">
                    {recentActivity.map((activity) => (
                      <li key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm ${activity.kind === 'vaccine' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`} aria-hidden="true">{activity.kind === 'vaccine' ? '✓' : '•'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800">{activity.title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{activity.description}</p>
                        </div>
                        <time className="shrink-0 text-[11px] text-slate-400">{new Date(activity.date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</time>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}

          {/* TAB 2: SCHEDULE (ตารางประวัติวัคซีน แบบ Timeline & Cards) */}
          {activeTab === 'schedule' && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-indigo-100/50 border border-white animate-fade-in">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl shadow-sm">💉</div>
                  <div>
                    <h2 className="text-xl font-extrabold text-indigo-900">สมุดวัคซีนดิจิทัล</h2>
                    <p className="text-xs text-indigo-500 mt-1">กำหนดการตามอายุ และบันทึกประวัติ</p>
                  </div>
                </div>
              </div>

              {profileLoading || vaccineLoading ? (
                <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div></div>
              ) : !childProfile?.dob ? (
                <div className="rounded-2xl bg-sky-50 border border-sky-100 p-6 text-center">
                  <span className="text-3xl mb-3 block">📅</span>
                  <h3 className="text-base font-bold text-sky-900">ยังไม่มีข้อมูลวันเกิด</h3>
                  <p className="text-sm text-sky-700 mt-1 mb-4">เพิ่มวันเกิดเพื่อสร้างตารางวัคซีนส่วนตัวสำหรับเด็ก</p>
                  <button onClick={() => setActiveTab('overview')} className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700 shadow-sm transition">
                    เพิ่มข้อมูลเด็ก
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
                    <span className="shrink-0">💡</span>
                    <p>หากน้องเคยรับวัคซีนแล้วแต่สถานะยังเป็นสีเทา กรุณากด <strong>"บันทึกประวัติ"</strong> โดยอ้างอิงจากสมุดสีชมพู เพื่อให้เจ้าหน้าที่ยืนยันข้อมูล</p>
                  </div>
                  
                  {vaccineError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm font-medium text-rose-700">{vaccineError}</p>}

                  {/* --- ไทม์ไลน์วัคซีนจัดกลุ่มตามอายุ --- */}
                  <div className="relative border-l-2 border-slate-100 ml-3 md:ml-4 space-y-10 pb-8">
                    {Object.entries(
                      vaccineRows.reduce((acc, row) => {
                        const group = row.vaccine.ageCriteria;
                        if (!acc[group]) acc[group] = [];
                        acc[group].push(row);
                        return acc;
                      }, {} as Record<string, typeof vaccineRows>)
                    ).map(([ageGroup, rows], index) => {
                      
                      const isAllVerified = rows.every(r => r.record?.verificationStatus === 'VERIFIED');
                      const groupDueDate = rows[0].dueDate;
                      const isGroupPastDue = getBangkokDateKey(groupDueDate) <= getBangkokDateKey(new Date());

                      return (
                        <div key={ageGroup} className="relative pl-6 md:pl-8">
                          <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm ${isAllVerified ? 'bg-emerald-500' : isGroupPastDue ? 'bg-amber-400' : 'bg-slate-300'}`} />
                          
                          <div className="mb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4">
                            <h3 className="text-lg font-extrabold text-slate-800">อายุ {ageGroup}</h3>
                            <span className="text-xs font-semibold text-slate-500">
                              ครบกำหนด: {groupDueDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {rows.map(({ vaccine, dueDate, record, isDue }) => {
                              const isVerified = record?.verificationStatus === 'VERIFIED';
                              const isPending = record?.verificationStatus === 'PENDING';
                              const isRejected = record?.verificationStatus === 'REJECTED';
                              
                              return (
                                <article key={vaccine.code} className={`rounded-2xl border p-4 transition-all hover:shadow-md ${isVerified ? 'border-emerald-100 bg-emerald-50/30' : isPending ? 'border-amber-100 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
                                  <div className="flex justify-between items-start gap-2 mb-3">
                                    <div>
                                      <h4 className="font-bold text-slate-900">{vaccine.name}</h4>
                                      <p className="text-xs font-medium text-slate-500 mt-0.5">{vaccine.dose}</p>
                                    </div>
                                    <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isVerified ? 'bg-emerald-100 text-emerald-700' : isPending ? 'bg-amber-100 text-amber-700' : isRejected ? 'bg-rose-100 text-rose-700' : isDue ? 'bg-slate-100 text-slate-600' : 'bg-sky-50 text-sky-600'}`}>
                                      {isVerified ? '✓ ยืนยันแล้ว' : isPending ? '⏳ รอตรวจ' : isRejected ? '! ต้องแก้ไข' : isDue ? 'ถึงกำหนด' : 'ยังไม่ถึงกำหนด'}
                                    </span>
                                  </div>
                                  
                                  <p className="text-xs text-slate-500 mb-4 line-clamp-2 h-8">{vaccine.description}</p>

                                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100/80">
                                    <div className="text-[11px] text-slate-500">
                                      {record ? (
                                        <span>ฉีดเมื่อ: <strong className="text-slate-700">{new Date(record.administeredDate).toLocaleDateString('th-TH')}</strong></span>
                                      ) : (
                                        <span>กำหนด: {dueDate.toLocaleDateString('th-TH', { dateStyle: 'short', timeZone: 'UTC' })}</span>
                                      )}
                                    </div>

                                    {!isVerified && !isPending && (
                                      <button
                                        onClick={() => {
                                          if (isDue || isRejected) {
                                            setRecordingVaccineCode(vaccine.code);
                                            setVaccineRecordForm({ administeredDate: '', hospitalName: '' });
                                            setVaccineError('');
                                          } else {
                                            setVaccineToBook({ name: `${vaccine.name} (${vaccine.dose})`, age: vaccine.ageCriteria });
                                            setActiveTab('appointments');
                                          }
                                        }}
                                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-transform active:scale-95 ${isDue || isRejected ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                                      >
                                        {isDue || isRejected ? 'บันทึกประวัติ' : 'จองคิวฉีด'}
                                      </button>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* --- ส่วนวัคซีนทางเลือก / วัคซีนเสริม --- */}
                  <div className="mt-10 pt-8 border-t-2 border-dashed border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                          <span>⭐</span> วัคซีนทางเลือก / วัคซีนเสริม
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">เช่น ไข้หวัดใหญ่, ไอพีดี, โรต้า ฯลฯ</p>
                      </div>
                      {!isAddingCustom && (
                        <button 
                          onClick={() => setIsAddingCustom(true)} 
                          className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition active:scale-95 shadow-sm"
                        >
                          + เพิ่มประวัติวัคซีนเสริม
                        </button>
                      )}
                    </div>

                    {vaccineRecords.filter(r => r.vaccineCode === 'CUSTOM' || (r.vaccineCatalogId && !VACCINE_SCHEDULE.find(v => v.code === r.vaccineCode))).length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {vaccineRecords
                          .filter(r => r.vaccineCode === 'CUSTOM' || (r.vaccineCatalogId && !VACCINE_SCHEDULE.find(v => v.code === r.vaccineCode)))
                          .map(record => {
                            const isVerified = record.verificationStatus === 'VERIFIED';
                            return (
                              <article key={record.id} className={`rounded-2xl border p-4 transition-all hover:shadow-md ${isVerified ? 'border-emerald-100 bg-emerald-50/30' : 'border-amber-100 bg-amber-50/30'}`}>
                                <div className="flex justify-between items-start gap-2 mb-3">
                                  <div>
                                    <h4 className="font-bold text-slate-900">{record.vaccineName}</h4>
                                    <p className="text-xs font-medium text-slate-500 mt-0.5">วัคซีนเสริม</p>
                                  </div>
                                  <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isVerified ? '✓ ยืนยันแล้ว' : '⏳ รอตรวจ'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100/80">
                                  <div className="text-[11px] text-slate-500">
                                    ฉีดเมื่อ: <strong className="text-slate-700">{new Date(record.administeredDate).toLocaleDateString('th-TH')}</strong>
                                  </div>
                                </div>
                              </article>
                            );
                        })}
                      </div>
                    )}

                    {isAddingCustom && (
                      <form onSubmit={handleSubmitCustom} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6 animate-fade-in-up shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="relative sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อวัคซีน <span className="text-rose-500">*</span></label>
                            <input 
                              type="text" required value={customSearch}
                              onChange={(e) => {
                                setCustomSearch(e.target.value);
                                setSelectedCatalogId('');
                                setIsDropdownOpen(true);
                              }}
                              onFocus={() => setIsDropdownOpen(true)}
                              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                              placeholder="พิมพ์ค้นหาวัคซีน เช่น ไข้หวัดใหญ่..."
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                            />
                            {isDropdownOpen && customSearch && (
                              <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-50">
                                {filteredCatalog.length > 0 ? (
                                  filteredCatalog.map(v => (
                                    <li key={v.id} onMouseDown={() => { setCustomSearch(v.name); setSelectedCatalogId(v.id); setIsDropdownOpen(false); }} className="px-4 py-3 hover:bg-indigo-50 cursor-pointer text-sm font-medium text-slate-700 transition-colors">
                                      {v.name}
                                    </li>
                                  ))
                                ) : (
                                  <li className="px-4 py-5 text-center bg-slate-50 rounded-xl">
                                    <p className="text-sm text-slate-600 font-medium">ไม่พบในระบบ</p>
                                    <p className="text-xs font-bold text-indigo-600 mt-1">กด "ส่งคำขอเพิ่มวัคซีน" เพื่อเสนอชื่อนี้ให้เจ้าหน้าที่</p>
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                          {selectedCatalogId && (
                            <>
                              <label className="block text-xs font-bold text-slate-700">
                                วันที่ได้รับ <span className="text-rose-500">*</span>
                                <input type="date" required max={getBangkokDateKey(new Date())} value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                              </label>
                              <label className="block text-xs font-bold text-slate-700">
                                สถานพยาบาล <span className="text-slate-400 font-normal">(ถ้าทราบ)</span>
                                <input type="text" value={customHospital} onChange={(e) => setCustomHospital(e.target.value)} placeholder="คลินิก/โรงพยาบาล" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                              </label>
                            </>
                          )}
                        </div>
                        <div className="mt-6 flex gap-3 pt-5 border-t border-slate-200">
                          <button type="button" onClick={() => setIsAddingCustom(false)} className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">ยกเลิก</button>
                          <button type="submit" disabled={isSavingVaccineRecord} className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-60 transition">
                            {isSavingVaccineRecord ? 'กำลังประมวลผล...' : selectedCatalogId ? 'บันทึกประวัติ' : 'ส่งคำขอเพิ่มวัคซีน'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TAB 3: APPOINTMENTS (ระบบจองคิว พร้อม Search และ GPS) */}
          {activeTab === 'appointments' && (
            <div className="space-y-8 animate-fade-in">
              <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-rose-100/50 border-t-4 border-rose-400">
                <div className="mb-6">
                  <h2 className="text-2xl font-extrabold text-rose-900">📅 นัดหมายรับวัคซีน</h2>
                  <p className="text-sm text-slate-500 mt-1">ค้นหาสถานพยาบาลใกล้ฉัน หรือพิมพ์ชื่อโรงพยาบาลที่ต้องการจองคิว</p>
                  {vaccineToBook && (
                    <p className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200 shadow-sm">
                      <span className="mr-1">🎯</span> กำลังจองสำหรับ: {vaccineToBook.name} ({vaccineToBook.age})
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      placeholder="พิมพ์ชื่อโรงพยาบาล หรือ รพ.สต..." 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
                      onChange={(e) => handleSearchHospitals(e.target.value)}
                      value={hospitalSearchQuery}
                    />
                    <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </div>
                  
                  <button
                    onClick={handleFindNearby}
                    disabled={isLocating}
                    className="shrink-0 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 px-5 py-3 rounded-xl font-bold text-sm transition-all border border-rose-200 disabled:opacity-60 shadow-sm"
                  >
                    {isLocating ? (
                      <><svg className="animate-spin w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> กำลังค้นหา...</>
                    ) : (
                      <>📍 ค้นหาจุดใกล้ฉัน</>
                    )}
                  </button>
                </div>

                {realHospitals.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="text-4xl mb-3">🏥</div>
                    <p className="text-slate-600 font-bold text-sm">ยังไม่ได้เลือกสถานพยาบาล</p>
                    <p className="text-slate-400 text-xs mt-1">พิมพ์ชื่อโรงพยาบาล หรือกดปุ่มค้นหาด้วย GPS เพื่อดูรอบเวลาว่าง</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {realHospitals.map((hospital) => (
                      <div
                        key={hospital.id}
                        className={`border-2 rounded-2xl p-5 transition-all cursor-pointer ${selectedHospital === hospital.id ? 'border-rose-400 bg-rose-50/40 shadow-md' : 'border-slate-100 bg-white hover:border-rose-200'}`}
                        onClick={() => {
                          if (selectedHospital !== hospital.id) setSelectedDateSlot(null);
                          setSelectedHospital(hospital.id);
                        }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <h3 className="font-extrabold text-slate-800 text-base">{hospital.name}</h3>
                            {hospital.distance && (
                              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-1">
                                <span className="text-rose-500">📍</span> ห่างจากคุณ {hospital.distance}
                              </p>
                            )}
                          </div>
                          {selectedHospital === hospital.id && (
                            <div className="bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">กำลังเลือก</div>
                          )}
                        </div>

                        {selectedHospital === hospital.id && (
                          <div className="mt-5 pt-5 border-t border-rose-100 animate-fade-in-up">
                            {hospital.availableDates.length === 0 ? (
                              <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                                <p className="text-sm font-bold text-slate-600">ไม่มีช่วงเวลาว่างในขณะนี้</p>
                                <p className="text-xs text-slate-400 mt-1">โปรดตรวจสอบใหม่ในภายหลัง หรือเลือกสถานพยาบาลอื่น</p>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2"><span>🗓️</span> เลือกรอบเวลาที่ต้องการนัดหมาย:</p>
                                <div className="space-y-5">
                                  {hospital.availableDates.map((availableDate) => (
                                    <div key={availableDate.dateString}>
                                      <p className="text-sm font-extrabold text-rose-700 mb-2.5">{availableDate.date}</p>
                                      <div className="flex flex-wrap gap-2.5">
                                        {availableDate.slots.map((time) => {
                                          const isSelected = selectedDateSlot?.dateString === availableDate.dateString && selectedDateSlot?.time === time;
                                          return (
                                            <button
                                              key={time}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedDateSlot({ date: availableDate.date, dateString: availableDate.dateString, time, isWaitlistRequest: false });
                                              }}
                                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${isSelected ? 'bg-rose-600 text-white shadow-md shadow-rose-200 ring-2 ring-rose-600 ring-offset-1' : 'bg-white border border-slate-200 text-slate-700 hover:border-rose-400 hover:text-rose-600'}`}
                                            >
                                              {time} น.
                                            </button>
                                          );
                                        })}
                                        {availableDate.fullSlots.map((time) => {
                                          const isSelected = selectedDateSlot?.dateString === availableDate.dateString && selectedDateSlot?.time === time;
                                          return (
                                            <button
                                              key={`waitlist-${time}`}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedDateSlot({ date: availableDate.date, dateString: availableDate.dateString, time, isWaitlistRequest: true });
                                              }}
                                              className={`flex flex-col items-center px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all active:scale-95 ${isSelected ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200 ring-2 ring-amber-500 ring-offset-1' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
                                              title="รอบนี้เต็ม แตะเพื่อส่งคำขอรออนุมัติ"
                                            >
                                              <span className="text-xs">{time} น.</span>
                                              <span className="opacity-80">เต็ม • จองคิวสำรอง</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedHospital && selectedDateSlot && (
                  <div className="mt-8 animate-fade-in-up">
                    <button
                      onClick={handleBooking}
                      disabled={isSavingAppointment}
                      className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-extrabold text-sm transition-all shadow-lg shadow-pink-200 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isSavingAppointment ? (
                         <><svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> กำลังส่งคำขอ...</>
                      ) : selectedDateSlot.isWaitlistRequest ? (
                         <>📝 ส่งคำขอจองคิวสำรอง (รออนุมัติ)</>
                      ) : (
                         <>✅ ยืนยันการจองคิว</>
                      )}
                    </button>
                  </div>
                )}
              </section>

              <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-indigo-100/50 border border-white">
                <h3 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <span>📋</span> รายการนัดหมายของคุณ
                </h3>
                {appointmentError && (
                  <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{appointmentError}</p>
                )}
                {appointmentsLoading ? (
                  <p className="py-8 text-center text-sm text-slate-500">กำลังโหลดรายการนัดหมาย...</p>
                ) : visibleAppointments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีรายการนัดหมาย</p>
                ) : (
                  <div className="space-y-4">
                    {visibleAppointments.map((appointment) => {
                      const canManage = ['PENDING', 'CONFIRMED'].includes(appointment.status);
                      const currentSlotKey = getBangkokSlotKey(appointment.scheduledAt);
                      const editableSlots = appointment.hospital?.slots.filter((slot) =>
                        slot.booked < slot.capacity ||
                        `${new Date(slot.date).toISOString().slice(0, 10)}|${slot.time}` === currentSlotKey
                      ) ?? [];
                      const statusLabel = appointment.status === 'PENDING'
                        ? appointment.isWaitlisted ? 'คิวเต็ม • รออนุมัติ' : 'รอยืนยัน'
                        : appointment.status === 'CANCELLED'
                          ? 'ยกเลิกแล้ว'
                          : appointment.status === 'COMPLETED'
                            ? 'เสร็จสิ้น'
                            : appointment.status;

                      return (
                        <article key={appointment.id} className="p-4 rounded-2xl border-2 border-indigo-50 bg-indigo-50/20">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <span className={`text-xs font-bold px-3 py-1 rounded-full ${appointment.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : appointment.status === 'CONFIRMED' ? 'bg-sky-100 text-sky-700' : appointment.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                {statusLabel}
                              </span>
                              <h4 className="font-bold text-slate-800 text-base mt-2">{appointment.hospitalName}</h4>
                              <p className="text-xs text-slate-500 mt-1">
                                📅 {new Date(appointment.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.
                              </p>
                            </div>
                            {canManage && editingAppointmentId !== appointment.id && (
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                  onClick={() => {
                                    setEditingAppointmentId(appointment.id);
                                    setEditSlotKey(currentSlotKey);
                                    setAppointmentError('');
                                  }}
                                  className="flex-1 sm:flex-none px-3.5 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold rounded-xl transition-all"
                                >
                                  ✏️ เปลี่ยนเวลา
                                </button>
                                <button
                                  onClick={() => setCancellationTarget(appointment)}
                                  className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl transition-all"
                                >
                                  ยกเลิกคิว
                                </button>
                              </div>
                            )}
                          </div>
                          {editingAppointmentId === appointment.id && canManage && (
                            <div className="mt-4 flex flex-col sm:flex-row gap-2">
                              <select
                                value={editSlotKey}
                                onChange={(event) => setEditSlotKey(event.target.value)}
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                aria-label="เลือกช่วงเวลาใหม่"
                              >
                                {editableSlots.length === 0 && <option value="">ไม่มีช่วงเวลาว่าง</option>}
                                {editableSlots.map((slot) => {
                                  const dateString = new Date(slot.date).toISOString().slice(0, 10);
                                  const slotKey = `${dateString}|${slot.time}`;
                                  const dateLabel = new Date(slot.date).toLocaleDateString('th-TH', {
                                    dateStyle: 'medium',
                                    timeZone: 'UTC',
                                  });
                                  return (
                                    <option key={slotKey} value={slotKey}>
                                      {dateLabel} เวลา {slot.time} น.
                                    </option>
                                  );
                                })}
                              </select>
                              <button
                                onClick={() => void handleRescheduleAppointment(appointment.id)}
                                disabled={!editSlotKey || editableSlots.length === 0}
                                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                              >
                                บันทึกเวลาใหม่
                              </button>
                              <button
                                onClick={() => {
                                  setEditingAppointmentId(null);
                                  setEditSlotKey('');
                                }}
                                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 4: TIPS (คำแนะนำก่อนและหลังฉีด) */}
          {activeTab === 'tips' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-amber-100/50 border-t-4 border-amber-400">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl">📝</span>
                  <h2 className="text-lg font-bold text-amber-900">คำแนะนำก่อนรับวัคซีน</h2>
                </div>
                <ul className="space-y-3">
                  {preVaccineTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-3 bg-amber-50/50 p-3 rounded-2xl">
                      <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                      <p className="text-sm text-slate-700 leading-relaxed">{tip}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-teal-100/50 border-t-4 border-teal-400">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl">🧸</span>
                  <h2 className="text-lg font-bold text-teal-900">การดูแลหลังรับวัคซีน</h2>
                </div>
                <ul className="space-y-3 h-full max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {postVaccineTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-3 bg-teal-50/50 p-3 rounded-2xl">
                      <div className="w-6 h-6 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                      <p className="text-sm text-slate-700 leading-relaxed">{tip}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

        </main>
      </div>

      {/* --- MODALS (ย้ายมาไว้ข้างนอกสุดเพื่อแก้บั๊ก Fixed/Transform) --- */}

      {/* 1. Modal ฟอร์มกรอกประวัติวัคซีนหลัก */}
      {recordingVaccineCode && (() => {
        const vaccine = VACCINE_SCHEDULE.find((item) => item.code === recordingVaccineCode);
        if (!vaccine) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
               onMouseDown={(event) => {
                 if (event.target === event.currentTarget && !isSavingVaccineRecord) setRecordingVaccineCode(null);
               }}>
            <form onSubmit={handleReportVaccine} className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-fade-in-up border border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">บันทึกประวัติวัคซีน</h3>
                  <p className="text-sm font-semibold text-indigo-600 mt-1">{vaccine.name} ({vaccine.dose})</p>
                </div>
                <button type="button" onClick={() => setRecordingVaccineCode(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>
              
              <p className="text-xs text-slate-500 mb-5 pb-4 border-b border-slate-100">ระบุข้อมูลตามสมุดสีชมพู สถานะจะขึ้นเป็น "รอตรวจสอบ" จนกว่าเจ้าหน้าที่จะยืนยัน</p>
              
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                  วันที่ได้รับวัคซีน <span className="text-rose-500">*</span>
                  <input type="date" required min={childProfile?.dob?.slice(0, 10)} max={getBangkokDateKey(new Date())} value={vaccineRecordForm.administeredDate} onChange={(event) => setVaccineRecordForm((current) => ({ ...current, administeredDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  สถานพยาบาลที่ฉีด <span className="text-slate-400 font-normal">(ถ้าทราบ)</span>
                  <input type="text" value={vaccineRecordForm.hospitalName} onChange={(event) => setVaccineRecordForm((current) => ({ ...current, hospitalName: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="เช่น รพ.สต. สรรพยา" />
                </label>
              </div>
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setRecordingVaccineCode(null)} className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">ยกเลิก</button>
                <button type="submit" disabled={isSavingVaccineRecord} className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-60 transition">
                  {isSavingVaccineRecord ? 'กำลังส่งข้อมูล...' : 'ส่งประวัติให้ตรวจสอบ'}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* 2. Modal ยกเลิกนัดหมาย */}
      {cancellationTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isCancellingAppointment) setCancellationTarget(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-appointment-title"
            aria-describedby="cancel-appointment-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-2xl shadow-slate-950/20"
          >
            <div className="h-1.5 bg-gradient-to-r from-rose-400 via-pink-500 to-rose-400" />
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600" aria-hidden="true">!</div>
                <div>
                  <p className="text-xs font-bold uppercase text-rose-600">ยืนยันการยกเลิก</p>
                  <h2 id="cancel-appointment-title" className="mt-1 text-xl font-extrabold text-slate-900">ยกเลิกนัดหมายนี้?</h2>
                  <p id="cancel-appointment-description" className="mt-2 text-sm leading-relaxed text-slate-600">
                    ระบบจะคืนที่นั่งให้รอบเวลานี้ และนำรายการออกจากนัดหมายของคุณ
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="font-bold text-slate-800">{cancellationTarget.hospitalName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(cancellationTarget.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.
                </p>
              </div>
              {appointmentError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{appointmentError}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={isCancellingAppointment}
                  onClick={() => setCancellationTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  กลับไปดูนัดหมาย
                </button>
                <button
                  type="button"
                  disabled={isCancellingAppointment}
                  onClick={() => void handleCancelAppointment(cancellationTarget.id)}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isCancellingAppointment ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกนัด'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}} />
    </div>
  );
}