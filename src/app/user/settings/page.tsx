'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type SettingsResponse = { email: string };
type PushResponse = {
  available: boolean;
  publicKey: string | null;
  subscriptionCount: number;
};

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function getErrorMessage(response: Response, fallback: string) {
  const data: unknown = await response.json().catch(() => null);
  if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  return fallback;
}

export default function UserSettingsPage() {
  const [email, setEmail] = useState('');
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const [settingsResponse, pushResponse] = await Promise.all([
        fetch('/api/user/settings'),
        fetch('/api/user/push-subscription'),
      ]);
      if (!settingsResponse.ok) throw new Error(await getErrorMessage(settingsResponse, 'โหลดการตั้งค่าไม่สำเร็จ'));
      if (!pushResponse.ok) throw new Error(await getErrorMessage(pushResponse, 'โหลดสถานะ Push ไม่สำเร็จ'));

      const settings = await settingsResponse.json() as SettingsResponse;
      const push = await pushResponse.json() as PushResponse;
      setEmail(settings.email);
      setPushAvailable(push.available);
      setPushPublicKey(push.publicKey);

      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setPushSupported(supported);
      if (supported) {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.getSubscription();
        setPushSubscribed(Boolean(subscription));
      } else {
        setPushSubscribed(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดการตั้งค่าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadSettings]);

  const saveEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'บันทึกอีเมลไม่สำเร็จ'));
      setMessage('บันทึกอีเมลสำหรับแจ้งเตือนแล้ว');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกอีเมลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const togglePush = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const currentSubscription = await registration.pushManager.getSubscription();

      if (currentSubscription) {
        const response = await fetch('/api/user/push-subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: currentSubscription.endpoint }),
        });
        if (!response.ok) throw new Error(await getErrorMessage(response, 'ยกเลิก Push ไม่สำเร็จ'));
        await currentSubscription.unsubscribe();
        setPushSubscribed(false);
        setMessage('ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว');
        return;
      }

      if (!pushPublicKey || !pushAvailable) throw new Error('ระบบ Push ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('กรุณาอนุญาตการแจ้งเตือนจากการตั้งค่าเบราว์เซอร์');

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushPublicKey),
      });
      const response = await fetch('/api/user/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error(await getErrorMessage(response, 'เปิดการแจ้งเตือน Push ไม่สำเร็จ'));
      }
      setPushSubscribed(true);
      setMessage('เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ตั้งค่าการแจ้งเตือนไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/user/dashboard" className="text-sm font-semibold text-teal-700 hover:text-teal-900">
          ← กลับหน้าหลัก
        </Link>

        <header>
          <h1 className="text-2xl font-bold">ตั้งค่าการแจ้งเตือน</h1>
          <p className="mt-2 text-sm text-slate-600">เลือกช่องทางรับแจ้งเตือนนัดหมายวัคซีน</p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">กำลังโหลดการตั้งค่า...</div>
        ) : (
          <>
            <form onSubmit={saveEmail} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="font-bold">อีเมล</h2>
                <p className="mt-1 text-sm text-slate-600">รับอีเมลแจ้งเตือนล่วงหน้า 7 วัน 3 วัน และ 1 วัน</p>
              </div>
              <label className="block text-sm font-medium">
                อีเมลสำหรับแจ้งเตือน
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                />
              </label>
              <button disabled={busy} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
                {busy ? 'กำลังบันทึก...' : 'บันทึกอีเมล'}
              </button>
            </form>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="font-bold">การแจ้งเตือนบนอุปกรณ์ (Web Push)</h2>
                <p className="mt-1 text-sm text-slate-600">
                  รับการแจ้งเตือนบนเบราว์เซอร์นี้ แม้ไม่ได้เปิดหน้าเว็บอยู่ โดยต้องอนุญาตการแจ้งเตือนจากเบราว์เซอร์
                </p>
              </div>
              {!pushSupported ? (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">เบราว์เซอร์นี้ไม่รองรับ Web Push</p>
              ) : !pushAvailable ? (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Web Push ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    สถานะอุปกรณ์นี้: <strong>{pushSubscribed ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</strong>
                  </p>
                  {Notification.permission === 'denied' && !pushSubscribed && (
                    <p className="text-sm text-amber-800">เบราว์เซอร์บล็อกการแจ้งเตือนอยู่ กรุณาอนุญาตในตั้งค่าเว็บไซต์ก่อน</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void togglePush()}
                    disabled={busy || (!pushSubscribed && Notification.permission === 'denied')}
                    className="rounded-xl border border-teal-700 px-5 py-3 text-sm font-bold text-teal-800 disabled:opacity-50"
                  >
                    {busy ? 'กำลังดำเนินการ...' : pushSubscribed ? 'ปิดการแจ้งเตือนบนอุปกรณ์นี้' : 'เปิดการแจ้งเตือนบนอุปกรณ์นี้'}
                  </button>
                </>
              )}
            </section>
          </>
        )}

        {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      </div>
    </main>
  );
}
