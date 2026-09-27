// src/app/(auth)/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', username: '', password: '', adminCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลงทะเบียน');
    } finally {
      setLoading(false);
    }
  };

  return (
    // พื้นหลังไล่สีพาสเทลสอดคล้องกับหน้า Login และ Dashboard
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 px-4 py-10 relative overflow-hidden font-sans">
      
      {/* วงกลมสีเบลอตกแต่งพื้นหลัง (Blob effects) */}
      <div className="absolute top-[-5%] left-[-10%] w-96 h-96 bg-blue-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-pink-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
      <div className="absolute top-[20%] right-[20%] w-72 h-72 bg-purple-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>

      {/* การ์ด Register */}
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white/50 p-8 sm:p-10 shadow-2xl shadow-purple-100/50 relative z-10">
        
        {/* ส่วนหัวของฟอร์ม */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-teal-400 to-teal-300 rounded-2xl flex items-center justify-center text-white font-extrabold text-3xl shadow-lg shadow-teal-200 mb-5 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
            พ
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">สร้างบัญชี &quot;พร้อมฉีด&quot;</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">ระบบบันทึกและแจ้งเตือนการรับวัคซีน</p>
        </div>

        {/* กล่องแจ้งเตือน Error */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {/* ฟอร์มสมัครสมาชิก */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              อีเมล
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/50 transition-all"
              placeholder="example@mail.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              ชื่อผู้ใช้ (Username)
            </label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/50 transition-all"
              placeholder="ตั้งชื่อผู้ใช้งานของคุณ"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              รหัสผ่าน
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/50 transition-all"
              placeholder="สร้างรหัสผ่านอย่างน้อย 8 ตัวอักษร"
            />
          </div>

          <div className="animate-fade-in-up">
            <label className="block text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
              รหัสผู้ดูแลระบบ (ถ้ามี)
            </label>
            <input
              type="password"
              value={form.adminCode}
              onChange={(e) => setForm({ ...form, adminCode: e.target.value })}
              className="w-full px-5 py-3.5 rounded-2xl border-2 border-amber-200 bg-amber-50/50 text-slate-800 text-sm font-medium placeholder:text-amber-300 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100/50 transition-all"
              placeholder="ใช้ได้เฉพาะผู้ดูแลระบบที่ได้รับอนุญาต"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-600 hover:to-teal-500 text-white font-bold text-base transition-all shadow-lg shadow-teal-200 disabled:opacity-60 disabled:hover:from-teal-500 disabled:hover:to-teal-400"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  กำลังลงทะเบียน...
                </span>
              ) : (
                'สมัครสมาชิก'
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-slate-500 mt-8 font-medium">
          มีบัญชีอยู่แล้วใช่หรือไม่?{' '}
          <Link href="/login" className="text-teal-600 font-bold hover:text-teal-700 hover:underline underline-offset-2 transition-all">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}