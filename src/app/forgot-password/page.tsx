'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถส่งคำขอได้');
      setMessage(data.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ไม่สามารถส่งคำขอได้');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-extrabold text-slate-800">ลืมรหัสผ่าน</h1>
        <p className="mt-2 text-sm text-slate-600">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้หากพบบัญชี</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label htmlFor="reset-email" className="block text-sm font-bold text-slate-700">อีเมล</label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-teal-700 px-4 py-3 font-bold text-white disabled:opacity-60">
            {loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่าน'}
          </button>
        </form>
        <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-teal-700 hover:underline">กลับไปเข้าสู่ระบบ</Link>
      </section>
    </main>
  );
}
