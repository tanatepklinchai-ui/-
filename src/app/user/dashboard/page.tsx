// src/app/user/dashboard/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { VACCINE_SCHEDULE } from '@/lib/vaccineSchedule';
import { calculateAgeDisplay } from '@/lib/utils/formatAge';
import NotificationToast from '@/components/NotificationToast';
import type { ToastMessage } from '@/components/NotificationToast';

type HospitalOption = {
  id: string;
  name: string;
  distance: string;
  availableDates: {
    date: string;
    dateString: string;
    slots: string[];
    fullSlots: string[];
  }[];
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
  archivedAt?: string | null;
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

export default function ColorfulDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'schedule'>('overview');
  
  // States: Appointments & Hospitals
  const [isLocating, setIsLocating] = useState(false);
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState('');
  const [hospitalSearchMode, setHospitalSearchMode] = useState<'directory' | 'text' | 'nearby'>('directory');
  const [hospitalSearchStatus, setHospitalSearchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [hospitalSearchError, setHospitalSearchError] = useState('');
  const [hospitalSearchNotice, setHospitalSearchNotice] = useState('');
  const [hospitalSearchRetry, setHospitalSearchRetry] = useState(0);
  const hospitalSearchRequestRef = useRef(0);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [bookingDateTime, setBookingDateTime] = useState('');
  const [selectedBookingDate, setSelectedBookingDate] = useState('');
  const [vaccineToBook, setVaccineToBook] = useState<{ name: string; age: string } | null>(null);
  const [realHospitals, setRealHospitals] = useState<HospitalOption[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cancellationTarget, setCancellationTarget] = useState<Appointment | null>(null);
  const [isCancellingAppointment, setIsCancellingAppointment] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentError, setAppointmentError] = useState('');
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [requestingRescheduleId, setRequestingRescheduleId] = useState<string | null>(null);

  // States: Child Profile
  const [childProfile, setChildProfile] = useState<ChildProfile | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [archivedChildren, setArchivedChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', dob: '', weight: '', height: '' });
  const [profileLoading, setProfileLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [childActionId, setChildActionId] = useState('');

  // States: Standard Vaccines
  const [vaccineRecords, setVaccineRecords] = useState<VaccineRecord[]>([]);
  const [vaccineLoading, setVaccineLoading] = useState(true);
  const [recordingVaccineCode, setRecordingVaccineCode] = useState<string | null>(null);
  const [vaccineRecordForm, setVaccineRecordForm] = useState({ administeredDate: '', hospitalName: '' });
  const [isSavingVaccineRecord, setIsSavingVaccineRecord] = useState(false);
  const [vaccineError, setVaccineError] = useState('');
  
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const notify = (type: ToastMessage['type'], title: string, description?: string) => {
    setToast({ type, title, description });
  };
  
  useEffect(() => {
    if (activeTab !== 'appointments' || hospitalSearchMode === 'nearby') return;

    const controller = new AbortController();
    const searchTerm = hospitalSearchQuery.trim();
    const useTextSearch = hospitalSearchMode === 'text' && searchTerm.length >= 2;
    const searchUrl = useTextSearch
      ? `/api/hospitals?search=${encodeURIComponent(searchTerm)}`
      : '/api/hospitals?directory=1';

    const loadHospitals = async () => {
      setHospitalSearchStatus('loading');
      setHospitalSearchError('');
      try {
        const response = await fetch(searchUrl, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดรายชื่อสถานพยาบาลได้');
        setRealHospitals(data.hospitals ?? []);
        setHospitalSearchStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;
        setHospitalSearchError(error instanceof Error ? error.message : 'กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
        setHospitalSearchStatus('error');
      }
    };

    const timeoutId = window.setTimeout(() => void loadHospitals(), useTextSearch ? 350 : 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeTab, hospitalSearchMode, hospitalSearchQuery, hospitalSearchRetry]);

  const handleSearchHospitals = (keyword: string) => {
    hospitalSearchRequestRef.current += 1;
    setIsLocating(false);
    setHospitalSearchStatus('loading');
    setHospitalSearchError('');
    setHospitalSearchQuery(keyword);
    setHospitalSearchMode(keyword.trim() ? 'text' : 'directory');
    setHospitalSearchNotice('');
    setRealHospitals([]);
    setSelectedHospital(null);
    setBookingDateTime('');
    setSelectedBookingDate('');
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
        setArchivedChildren(data.archivedChildren ?? []);
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
    let isFetching = false;
    let isInitialFetch = true;
    const loadVaccineRecords = async () => {
      if (isFetching || controller.signal.aborted) return;
      isFetching = true;
      if (isInitialFetch) setVaccineLoading(true);
      try {
        const response = await fetch(`/api/vaccines/records?childId=${encodeURIComponent(selectedChildId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดประวัติวัคซีนได้');
        setVaccineRecords(data.records ?? []);
        setVaccineError('');
      } catch (error) {
        if (!controller.signal.aborted) {
          setVaccineError(error instanceof Error ? error.message : 'ไม่สามารถโหลดประวัติวัคซีนได้');
        }
      } finally {
        isFetching = false;
        if (!controller.signal.aborted && isInitialFetch) {
          isInitialFetch = false;
          setVaccineLoading(false);
        }
      }
    };
    void loadVaccineRecords();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadVaccineRecords();
    }, 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void loadVaccineRecords();
    };
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedChildId]);

  const vaccineRows = childProfile?.dob
    ? VACCINE_SCHEDULE.map((vaccine) => {
      const dueDate = getDueDate(childProfile.dob!, vaccine.ageInMonths);
      const record = vaccineRecords.find((item) => item.vaccineCode === vaccine.code);
      const isDue = getBangkokDateKey(dueDate) <= getBangkokDateKey(new Date());
      return { vaccine, dueDate, record, isDue };
    })
    : [];
  const supplementaryVaccineRecords = vaccineRecords.filter((record) =>
    record.vaccineCode === 'CUSTOM' ||
    (record.vaccineCatalogId && !VACCINE_SCHEDULE.some((vaccine) => vaccine.code === record.vaccineCode))
  );
  const visibleAppointments = appointments.filter((appointment) => appointment.status !== 'CANCELLED');
  const verifiedVaccineCount = vaccineRows.filter(({ record }) => record?.verificationStatus === 'VERIFIED').length;
  const vaccineProgress = vaccineRows.length > 0 ? Math.round((verifiedVaccineCount / vaccineRows.length) * 100) : 0;
  const nextVaccine = vaccineRows.find(({ record }) => record?.verificationStatus !== 'VERIFIED') ?? null;
  const todayKey = getBangkokDateKey(new Date());
  const daysUntilNextVaccine = nextVaccine
    ? Math.ceil((Date.parse(getBangkokDateKey(nextVaccine.dueDate)) - Date.parse(todayKey)) / 86_400_000)
    : null;
  const nextAppointment = appointments.find((appointment) =>
    ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(appointment.status) && new Date(appointment.scheduledAt) > new Date()
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
        : appointment.status === 'RESCHEDULE_REQUESTED'
          ? 'ส่งคำขอเลื่อนนัดแล้ว'
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

  const refreshChildLists = async () => {
    const response = await fetch('/api/children', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดข้อมูลเด็กได้');
    const activeChildren: ChildProfile[] = data.children ?? [];
    setChildren(activeChildren);
    setArchivedChildren(data.archivedChildren ?? []);
    return activeChildren;
  };

  const handleDeleteChild = async (child: ChildProfile, permanent: boolean) => {
    const childLabel = child.firstName || 'เด็กคนนี้';
    const confirmation = permanent
      ? `ลบข้อมูล${childLabel}ถาวรหรือไม่? นัดหมายและประวัติวัคซีนที่ผูกอยู่จะถูกลบด้วย และกู้คืนไม่ได้`
      : `ซ่อนข้อมูล${childLabel}ชั่วคราวหรือไม่? คุณสามารถกู้คืนได้ภายหลัง`;
    if (!window.confirm(confirmation)) return;

    setChildActionId(child.id);
    setProfileError('');
    try {
      const response = await fetch(`/api/children/${encodeURIComponent(child.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permanent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถลบข้อมูลเด็กได้');
      const activeChildren = await refreshChildLists();
      if (selectedChildId === child.id) {
        if (activeChildren.length > 0) handleSelectChild(activeChildren[0].id);
        else handleAddChild();
      }
      notify('success', permanent ? 'ลบข้อมูลเด็กถาวรแล้ว' : 'ซ่อนข้อมูลเด็กชั่วคราวแล้ว');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'ไม่สามารถลบข้อมูลเด็กได้');
    } finally {
      setChildActionId('');
    }
  };

  const handleRestoreChild = async (child: ChildProfile) => {
    setChildActionId(child.id);
    setProfileError('');
    try {
      const response = await fetch(`/api/children/${encodeURIComponent(child.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถกู้คืนข้อมูลเด็กได้');
      const activeChildren = await refreshChildLists();
      if (activeChildren.length === 1) {
        const restoredChild = activeChildren.find((item) => item.id === child.id) ?? child;
        setChildProfile(restoredChild);
        setSelectedChildId(restoredChild.id);
        setAppointments([]);
        setVaccineRecords([]);
        setAppointmentsLoading(true);
        setVaccineLoading(true);
        setIsAddingChild(false);
        setProfileForm({
          firstName: restoredChild.firstName ?? '',
          dob: restoredChild.dob ? restoredChild.dob.slice(0, 10) : '',
          weight: restoredChild.weight?.toString() ?? '',
          height: restoredChild.height?.toString() ?? '',
        });
      }
      notify('success', 'กู้คืนข้อมูลเด็กแล้ว');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'ไม่สามารถกู้คืนข้อมูลเด็กได้');
    } finally {
      setChildActionId('');
    }
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
    const requestId = hospitalSearchRequestRef.current + 1;
    hospitalSearchRequestRef.current = requestId;
    setIsLocating(true);
    setHospitalSearchStatus('loading');
    setHospitalSearchQuery('');
    setHospitalSearchMode('directory');
    setHospitalSearchError('');
    setHospitalSearchNotice('');
    if (hospitalSearchMode !== 'directory') setRealHospitals([]);
    setSelectedHospital(null);
    setBookingDateTime('');
    setSelectedBookingDate('');

    const showDirectoryFallback = (notice: string) => {
      if (hospitalSearchRequestRef.current !== requestId) return;
      setIsLocating(false);
      setHospitalSearchMode('directory');
      setHospitalSearchNotice(notice);
      setHospitalSearchRetry((current) => current + 1);
    };

    if (!navigator.geolocation) {
      showDirectoryFallback('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง แต่ยังเลือกจากรายชื่อหรือค้นหาด้วยชื่อได้');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (hospitalSearchRequestRef.current !== requestId) return;
        setHospitalSearchStatus('loading');
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/hospitals?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'ค้นหาสถานพยาบาลไม่สำเร็จ');
          if (hospitalSearchRequestRef.current !== requestId) return;
          
          const hospitals = data.hospitals ?? [];
          if (hospitals.length === 0) {
            showDirectoryFallback('ยังไม่พบจุดบริการจากตำแหน่งนี้ กำลังแสดงรายชื่อสถานพยาบาลที่ค้นหาได้แทน');
            return;
          }

          setHospitalSearchMode('nearby');
          setRealHospitals(hospitals);
          setHospitalSearchStatus('success');
          setHospitalSearchNotice(`พบสถานพยาบาลใกล้ตำแหน่งของคุณ ${hospitals.length} แห่ง`);
        } catch (error) {
          const detail = error instanceof Error ? error.message : '';
          showDirectoryFallback(
            `การค้นหาใกล้ตำแหน่งใช้เวลานานหรือแผนที่ตอบกลับไม่สำเร็จ${detail ? ` (${detail})` : ''} รายชื่อด้านล่างยังเลือกได้ หรือค้นหาด้วยชื่อ`
          );
        } finally {
          if (hospitalSearchRequestRef.current === requestId) setIsLocating(false);
        }
      },
      (error) => {
        if (hospitalSearchRequestRef.current !== requestId) return;
        const description = error.code === error.PERMISSION_DENIED
          ? 'ไม่ได้อนุญาตการเข้าถึงตำแหน่ง รายชื่อสถานพยาบาลยังใช้งานได้โดยไม่ต้องเปิดตำแหน่ง'
          : error.code === error.TIMEOUT
            ? 'ระบุตำแหน่งใช้เวลานานเกินไป กำลังแสดงรายชื่อให้เลือกแทน'
            : 'ยังระบุตำแหน่งไม่ได้ แต่ค้นหาสถานพยาบาลจากชื่อหรือรายการด้านล่างได้';
        showDirectoryFallback(description);
      },
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 }
    );
  };
  const handleBooking = async () => {
    if (!selectedChildId) {
      setAppointmentError('กรุณาเลือกเด็กก่อนจองนัดหมาย');
      return;
    }
    if (!selectedHospital || !bookingDateTime) {
      notify('info', 'เลือกสถานพยาบาลและวันนัดก่อน', 'เลือกสถานพยาบาล แล้วกำหนดวันและเวลาที่ต้องการ');
      return;
    }

    if (!vaccineToBook) {
      notify('info', 'กรุณาเลือกวัคซีนที่ต้องการ', 'โปรดระบุวัคซีนที่จะรับบริการในรอบนี้');
      return;
    }

    const hospital = realHospitals.find((item) => item.id === selectedHospital);
    if (!hospital) return;

    setIsSavingAppointment(true);
    setAppointmentError('');
    try {
      const scheduledAt = new Date(`${bookingDateTime}:00+07:00`);
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          childId: selectedChildId, 
          hospitalId: hospital.id, 
          scheduledAt: scheduledAt.toISOString(),
          requestedVaccine: vaccineToBook ? `${vaccineToBook.name} (${vaccineToBook.age})` : null 
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถบันทึกนัดหมายได้');

      setAppointments((current) => [...current, data.appointment].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      ));
      setSelectedHospital(null);
      setBookingDateTime('');
      setSelectedBookingDate('');
      setVaccineToBook(null);
      notify(
        'success',
        'ส่งคำขอนัดหมายแล้ว',
        `${hospital.name} · ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(scheduledAt)} เวลา ${bookingDateTime.slice(11)} น.`
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

  const handleRequestReschedule = async (appointmentId: string) => {
    setRequestingRescheduleId(appointmentId);
    try {
      const response = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, status: 'RESCHEDULE_REQUESTED' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถส่งคำขอเลื่อนนัดได้');
      setAppointments((current) => current.map((appointment) =>
        appointment.id === appointmentId ? data.appointment : appointment
      ));
      setAppointmentError('');
      notify('success', 'ส่งคำขอเลื่อนนัดแล้ว', 'เจ้าหน้าที่จะกำหนดวันใหม่และส่งอีเมลแจ้งกลับ');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถส่งคำขอเลื่อนนัดได้';
      setAppointmentError(message);
      notify('error', 'ส่งคำขอไม่สำเร็จ', message);
    } finally {
      setRequestingRescheduleId(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

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
            <Link href="/user/guidelines" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50"><span>🧸</span> คำแนะนำก่อน-หลังฉีด</Link>
          </nav>
        </div>
        <div className="space-y-2">
          <Link href="/user/settings" className="flex items-center justify-center gap-2 rounded-2xl bg-teal-50 p-3.5 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-100">
            <span>🔔</span> ตั้งค่าการแจ้งเตือน
          </Link>
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-50 p-3.5 text-xs font-bold text-pink-500 transition-colors hover:bg-pink-100"><span>🚪</span> ออกจากระบบ</button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar สำหรับมือถือ และแสดง Header ด้านบน */}
        <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-indigo-50 flex justify-between items-center sticky top-0 z-20 shadow-sm md:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-teal-400 to-teal-300 rounded-xl flex items-center justify-center text-white font-bold shadow-md">พ</div>
            <span className="font-extrabold text-lg text-teal-800">พร้อมฉีด</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/user/settings" className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700">🔔 แจ้งเตือน</Link>
            <button onClick={handleLogout} className="rounded-full bg-pink-50 px-3 py-1.5 text-xs font-bold text-pink-500">ออกจากระบบ</button>
          </div>
        </header>

        {/* 3. TOP NAVIGATION TABS (สำหรับสลับหน้าจอในมือถือ) */}
        <div className="bg-white/50 backdrop-blur-sm border-b border-indigo-50 px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar md:hidden">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>ภาพรวม</button>
          <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>ตารางวัคซีน</button>
          <button onClick={() => setActiveTab('appointments')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'appointments' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>จองคิว</button>
          <Link href="/user/guidelines" className="rounded-xl bg-white px-4 py-2 text-xs font-bold whitespace-nowrap text-slate-600">คำแนะนำ</Link>
        </div>

        <main className="flex-1 p-4 md:p-10 max-w-5xl mx-auto w-full space-y-8">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <section aria-labelledby="getting-started-title" className="overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-sky-50 p-6 shadow-lg shadow-teal-100/50 md:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-teal-700">เริ่มต้นใช้งาน</p>
                    <h1 id="getting-started-title" className="mt-1 text-xl font-extrabold text-slate-900">พร้อมฉีดช่วยดูแลเรื่องวัคซีนของลูกอย่างไร?</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                      บันทึกข้อมูลเด็กเพื่อดูวัคซีนตามช่วงอายุ จัดการประวัติ และจองนัดกับสถานพยาบาลได้ในที่เดียว
                    </p>
                  </div>
                  <Link href="/user/guidelines" className="shrink-0 text-sm font-bold text-teal-700 underline decoration-teal-300 underline-offset-4 hover:text-teal-900">
                    อ่านคำแนะนำก่อน-หลังฉีด
                  </Link>
                </div>
                <ol className="mt-6 grid gap-3 md:grid-cols-3">
                  <li className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-extrabold text-teal-800">1</span>
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-800">เพิ่มข้อมูลเด็ก</h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">กรอกวันเกิดเพื่อคำนวณกำหนดวัคซีน</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => document.getElementById('child-profile')?.scrollIntoView({ behavior: 'smooth' })}
                      className="mt-3 text-xs font-bold text-teal-700 hover:text-teal-900"
                    >
                      {childProfile?.dob ? 'ตรวจสอบข้อมูลเด็ก ↓' : 'กรอกข้อมูลด้านล่าง ↓'}
                    </button>
                  </li>
                  <li className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-extrabold text-sky-800">2</span>
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-800">ตรวจตารางวัคซีน</h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">ดูวัคซีนตามอายุและอัปเดตประวัติ</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setActiveTab('schedule')} className="mt-3 text-xs font-bold text-sky-700 hover:text-sky-900">
                      ไปที่ตารางวัคซีน →
                    </button>
                  </li>
                  <li className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-extrabold text-rose-800">3</span>
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-800">จองและติดตามนัด</h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">เลือกสถานพยาบาลและติดตามสถานะการจอง</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setActiveTab('appointments')} className="mt-3 text-xs font-bold text-rose-700 hover:text-rose-900">
                      ไปที่หน้าจองคิว →
                    </button>
                  </li>
                </ol>
              </section>

              <section id="child-profile" className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-blue-100/50 border border-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center text-3xl">👶🏻</div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-blue-900">{isAddingChild ? 'เพิ่มข้อมูลเด็ก' : childProfile?.firstName || 'ข้อมูลเด็ก'}</h2>
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
                    <button type="submit" disabled={isSavingProfile || profileLoading || Boolean(childProfile && childActionId === childProfile.id)} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">
                      {isSavingProfile ? 'กำลังบันทึก...' : isAddingChild ? 'เพิ่มเด็ก' : 'บันทึกข้อมูลเด็ก'}
                    </button>
                    {!isAddingChild && childProfile && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          disabled={childActionId === childProfile.id}
                          onClick={() => void handleDeleteChild(childProfile, false)}
                          className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                        >ลบชั่วคราว</button>
                        <button
                          type="button"
                          disabled={childActionId === childProfile.id}
                          onClick={() => void handleDeleteChild(childProfile, true)}
                          className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >ลบถาวร</button>
                      </div>
                    )}
                  </div>
                </form>
                {archivedChildren.length > 0 && (
                  <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <h3 className="font-bold text-amber-950">ข้อมูลเด็กที่ลบชั่วคราว ({archivedChildren.length})</h3>
                    <ul className="mt-3 space-y-2">
                      {archivedChildren.map((child) => (
                        <li key={child.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
                          <span className="text-sm font-semibold text-slate-700">{child.firstName || 'ไม่ระบุชื่อเด็ก'}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={childActionId === child.id}
                              onClick={() => void handleRestoreChild(child)}
                              className="rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 disabled:opacity-50"
                            >กู้คืน</button>
                            <button
                              type="button"
                              disabled={childActionId === child.id}
                              onClick={() => void handleDeleteChild(child, true)}
                              className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >ลบถาวร</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
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
                      <p className="mt-2 text-sm font-bold text-slate-700">{verifiedVaccineCount} จาก {vaccineRows.length} รายการ</p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="ความคืบหน้าการรับวัคซีน" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vaccineProgress}>
                          <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500" style={{ width: `${vaccineProgress}%` }} />
                        </div>
                        <span className="min-w-10 text-right text-sm font-extrabold text-teal-800">{vaccineProgress}%</span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">เปอร์เซ็นต์คำนวณจากรายการที่เจ้าหน้าที่ยืนยันแล้ว</p>
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

                  {supplementaryVaccineRecords.length > 0 && (
                    <section className="mt-10 border-t border-dashed border-slate-200 pt-8">
                      <h3 className="text-lg font-extrabold text-slate-800">ประวัติวัคซีนอื่นที่บันทึกไว้</h3>
                      <p className="mt-1 text-xs text-slate-500">รายการเดิมแสดงไว้สำหรับตรวจสอบย้อนหลัง การเลือกวัคซีนและการเพิ่มรายการใหม่ทำได้โดยปรึกษาบุคลากรทางการแพทย์</p>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {supplementaryVaccineRecords.map((record) => {
                          const isVerified = record.verificationStatus === 'VERIFIED';
                          const isRejected = record.verificationStatus === 'REJECTED';
                          return (
                            <article key={record.id} className={`rounded-2xl border p-4 ${isVerified ? 'border-emerald-100 bg-emerald-50/30' : isRejected ? 'border-rose-100 bg-rose-50/30' : 'border-amber-100 bg-amber-50/30'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-slate-900">{record.vaccineName}</h4>
                                <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold ${isVerified ? 'bg-emerald-100 text-emerald-700' : isRejected ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {isVerified ? '✓ ยืนยันแล้ว' : isRejected ? '! ไม่ยืนยัน' : '⏳ รอตรวจ'}
                                </span>
                              </div>
                              <p className="mt-3 border-t border-slate-100/80 pt-3 text-[11px] text-slate-500">
                                ฉีดเมื่อ: <strong className="text-slate-700">{new Date(record.administeredDate).toLocaleDateString('th-TH')}</strong>
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  )}
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
                  <p className="text-sm text-slate-500 mt-1">เลือกวัคซีนตามกำหนดของเด็ก ค้นหาสถานพยาบาล และเลือกรอบเวลาที่สะดวก</p>
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    วันและเวลาที่เลือกเป็นคำขอนัดหมายเท่านั้น คิวจะยังไม่ยืนยันจนกว่าเจ้าหน้าที่จะอนุมัติ โปรดรอการแจ้งผลก่อนเดินทาง
                  </p>

                  {/* กล่อง Dropdown ที่เชื่อมกับข้อมูลตารางวัคซีน */}
                  <label className="mt-5 block text-sm font-bold text-slate-700">
                    วัคซีนตามกำหนดที่ต้องการรับบริการ <span className="text-rose-500">*</span>
                    <select
                      required
                      value={vaccineToBook ? `${vaccineToBook.name}|${vaccineToBook.age}` : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const [name, age] = val.split('|');
                          setVaccineToBook({ name, age });
                        } else {
                          setVaccineToBook(null);
                        }
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 bg-slate-50 transition-all"
                    >
                      <option value="">-- กรุณาเลือกวัคซีน --</option>
                      
                      {/* ดึงรายการวัคซีนที่ "ยังไม่ได้ฉีด" จากตารางมาเป็นตัวเลือกอัตโนมัติ */}
                      {vaccineRows.filter(v => v.record?.verificationStatus !== 'VERIFIED').map((v, idx) => (
                        <option key={idx} value={`${v.vaccine.name} (${v.vaccine.dose})|${v.vaccine.ageCriteria}`}>
                          {v.vaccine.name} ({v.vaccine.dose}) - สำหรับอายุ {v.vaccine.ageCriteria}
                        </option>
                      ))}
                    </select>
                  </label>
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

                <p className="mb-4 text-xs text-slate-500">
                  เลือกจากรายชื่อหรือพิมพ์ค้นหาได้เลย ไม่จำเป็นต้องเปิดตำแหน่ง การค้นหาใกล้ฉันเป็นตัวเลือกเพิ่มเติม
                </p>
                {hospitalSearchNotice && (
                  <p role="status" className="mb-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                    📍 {hospitalSearchNotice}
                  </p>
                )}
                {hospitalSearchMode === 'text' && hospitalSearchQuery.trim().length === 1 && (
                  <p className="mb-4 text-xs text-slate-500">พิมพ์เพิ่มอีกอย่างน้อย 1 ตัวอักษรเพื่อค้นหา หรือเลือกจากรายชื่อทั้งหมดด้านล่าง</p>
                )}
                {hospitalSearchStatus === 'loading' && (
                  <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-rose-500" />
                    {isLocating
                      ? 'กำลังค้นหาใกล้ตำแหน่งของคุณ รายชื่อสถานพยาบาลยังใช้งานได้ระหว่างรอ'
                      : 'กำลังค้นหารายชื่อสถานพยาบาล กรุณารอสักครู่'}
                  </p>
                )}
                {hospitalSearchStatus === 'error' && (
                  <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-bold">ยังโหลดผลค้นหาไม่สำเร็จ อาจเป็นเพราะการเชื่อมต่อใช้เวลานาน</p>
                    <p className="mt-1">ไม่ได้หมายความว่าไม่มีสถานพยาบาล ลองค้นหาอีกครั้งหรือค้นหาด้วยชื่อได้</p>
                    {hospitalSearchError && <p className="mt-1 text-xs">{hospitalSearchError}</p>}
                    <button
                      type="button"
                      onClick={() => {
                        setHospitalSearchStatus('loading');
                        setHospitalSearchRetry((current) => current + 1);
                      }}
                      className="mt-2 font-bold underline underline-offset-2"
                    >
                      ลองโหลดรายชื่ออีกครั้ง
                    </button>
                  </div>
                )}

                {realHospitals.length === 0 ? (
                  hospitalSearchStatus !== 'success' ? null : (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <div className="text-4xl mb-3">🏥</div>
                      <p className="text-slate-600 font-bold text-sm">
                        {hospitalSearchMode === 'text' && hospitalSearchQuery.trim().length >= 2
                          ? `ยังไม่พบรายชื่อที่ตรงกับ “${hospitalSearchQuery.trim()}”`
                          : 'ขณะนี้ยังไม่มีรายชื่อสถานพยาบาลให้เลือก'}
                      </p>
                      <p className="text-slate-500 text-xs mt-2">
                        ลองใช้คำค้นหาที่สั้นลง หรือค้นหาใกล้ฉันเพื่อดูสถานพยาบาลรอบตำแหน่งของคุณ
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {realHospitals.map((hospital) => (
                      <div
                        key={hospital.id}
                        className={`border-2 rounded-2xl p-5 transition-all cursor-pointer ${selectedHospital === hospital.id ? 'border-rose-400 bg-rose-50/40 shadow-md' : 'border-slate-100 bg-white hover:border-rose-200'}`}
                        onClick={() => {
                          if (isLocating) {
                            hospitalSearchRequestRef.current += 1;
                            setIsLocating(false);
                            setHospitalSearchMode('directory');
                            setHospitalSearchStatus('success');
                            setHospitalSearchNotice('เลือกจากรายชื่อได้เลย โดยไม่ต้องรอการค้นหาใกล้ตำแหน่ง');
                          }
                          if (selectedHospital !== hospital.id) {
                            setBookingDateTime('');
                            setSelectedBookingDate('');
                          }
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
                          <div className="mt-5 space-y-3 border-t border-rose-100 pt-5 animate-fade-in-up">
                            {hospital.availableDates.length > 0 ? (
                              <>
                                <p className="text-xs font-bold text-slate-700">เลือกรอบที่ยังว่าง ระบบจะส่งคำขอให้เจ้าหน้าที่อนุมัติ</p>
                                <div>
                                  <p className="mb-2 text-xs font-semibold text-slate-600">1. เลือกวัน</p>
                                  <div className="flex flex-wrap gap-2">
                                    {hospital.availableDates.map((date) => (
                                      <button
                                        key={date.dateString}
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSelectedBookingDate(date.dateString);
                                          setBookingDateTime('');
                                        }}
                                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${selectedBookingDate === date.dateString ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300'}`}
                                      >
                                        {date.date}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {selectedBookingDate && (
                                  <div>
                                    <p className="mb-2 text-xs font-semibold text-slate-600">2. เลือกเวลา</p>
                                    <div className="flex flex-wrap gap-2">
                                      {hospital.availableDates.find((date) => date.dateString === selectedBookingDate)?.slots.map((time) => (
                                        <button
                                          key={time}
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setBookingDateTime(`${selectedBookingDate}T${time}`);
                                          }}
                                          className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${bookingDateTime === `${selectedBookingDate}T${time}` ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300'}`}
                                        >
                                          {time} น.
                                        </button>
                                      ))}
                                      {hospital.availableDates.find((date) => date.dateString === selectedBookingDate)?.fullSlots.map((time) => (
                                        <span key={time} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-400" aria-label={`เวลา ${time} น. เต็มแล้ว`}>
                                          {time} น. · เต็ม
                                        </span>
                                      ))}
                                      {hospital.availableDates.find((date) => date.dateString === selectedBookingDate)?.slots.length === 0 && (
                                        <p className="text-xs text-slate-500">รอบวันนี้เต็มแล้ว กรุณาเลือกวันอื่น</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-xs font-bold text-slate-700">ยังไม่มีรอบเวลาที่สถานพยาบาลกำหนด เลือกวันและเวลาที่สะดวกเพื่อส่งคำขอ</p>
                                <label className="block text-xs font-semibold text-slate-600" onClick={(event) => event.stopPropagation()}>
                                  วันและเวลา
                                  <input
                                    type="datetime-local"
                                    required
                                    min={getBangkokDateTimeInput(new Date())}
                                    value={bookingDateTime}
                                    onChange={(event) => setBookingDateTime(event.target.value)}
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800"
                                  />
                                </label>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedHospital && bookingDateTime && (
                  <div className="mt-8 animate-fade-in-up">
                    <button
                      onClick={handleBooking}
                      disabled={isSavingAppointment}
                      className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-extrabold text-sm transition-all shadow-lg shadow-pink-200 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isSavingAppointment ? (
                         <><svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> กำลังส่งคำขอ...</>
                      ) : (
                         <>📨 ส่งคำขอนัดหมายเพื่อรออนุมัติ</>
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
                      const canManage = ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'RESCHEDULE_REQUESTED', 'EXPIRED'].includes(appointment.status);
                      const statusLabel = appointment.status === 'PENDING'
  ? appointment.isWaitlisted ? 'รอคิว' : 'รอการยืนยัน'
  : appointment.status === 'CANCELLED'
    ? 'ยกเลิกแล้ว'
    : appointment.status === 'COMPLETED'
      ? 'ฉีดวัคซีนแล้ว'
      : appointment.status === 'EXPIRED'
        ? 'หมดอายุ/เลยกำหนด'
        : appointment.status === 'RESCHEDULED'
          ? 'ถูกเลื่อนนัด'
          : appointment.status === 'RESCHEDULE_REQUESTED'
            ? 'รอเจ้าหน้าที่กำหนดวันใหม่'
          : appointment.status;
                      return (
                        <article key={appointment.id} className="p-4 rounded-2xl border-2 border-indigo-50 bg-indigo-50/20">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
  appointment.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
  appointment.status === 'CONFIRMED' ? 'bg-sky-100 text-sky-700' :
  appointment.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' :
  appointment.status === 'EXPIRED' ? 'bg-rose-100 text-rose-700' :
  appointment.status === 'RESCHEDULED' ? 'bg-orange-100 text-orange-700' :
  appointment.status === 'RESCHEDULE_REQUESTED' ? 'bg-indigo-100 text-indigo-700' :
  'bg-emerald-100 text-emerald-700'
}`}>
  {statusLabel}
                              </span>
                              <h4 className="font-bold text-slate-800 text-base mt-2">{appointment.hospitalName}</h4>
                              <p className="text-xs text-slate-500 mt-1">
                                📅 {new Date(appointment.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.
                              </p>
                            </div>
                            {canManage && (
                              <div className="flex items-center gap-2 w-full sm:w-auto">
  {!['EXPIRED', 'RESCHEDULE_REQUESTED'].includes(appointment.status) && (
    <button
      disabled={requestingRescheduleId === appointment.id}
      onClick={() => void handleRequestReschedule(appointment.id)}
      className="flex-1 sm:flex-none px-3.5 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
    >
      {requestingRescheduleId === appointment.id ? 'กำลังส่งคำขอ...' : 'ขอเลื่อนนัด'}
    </button>
  )}
  <button
    onClick={() => setCancellationTarget(appointment)}
    className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl transition-all"
  >
    {appointment.status === 'EXPIRED' ? 'ลบรายการ' : 'ยกเลิกนัด'}
  </button>
</div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
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