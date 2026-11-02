'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center">กำลังโหลด...</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้');
      setMessage(data.message);
      window.setTimeout(() => router.replace('/login'), 1500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ไม่สามารถตั้งรหัสผ่านใหม่ได้');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-extrabold text-slate-800">ตั้งรหัสผ่านใหม่</h1>
        <p className="mt-2 text-sm text-slate-600">ลิงก์นี้ใช้ได้ 30 นาที และใช้ได้ครั้งเดียว</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label htmlFor="new-password" className="block text-sm font-bold text-slate-700">รหัสผ่านใหม่</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
          <button disabled={!token || loading || Boolean(message)} className="w-full rounded-xl bg-teal-700 px-4 py-3 font-bold text-white disabled:opacity-60">
            {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
          {!token && <p role="alert" className="text-sm text-rose-700">ไม่พบลิงก์ตั้งรหัสผ่าน กรุณาขอลิงก์ใหม่</p>}
        </form>
        <Link href="/forgot-password" className="mt-5 block text-center text-sm font-semibold text-teal-700 hover:underline">ขอลิงก์ใหม่</Link>
      </section>
    </main>
  );
}
