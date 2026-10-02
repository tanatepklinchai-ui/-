// src/app/user/schedule/page.tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ScheduleWebAppPage() {
  const [activeTab, setActiveTab] = useState<'age' | 'date'>('age');

  // ข้อมูลจำลองอ้างอิงจากภาพตารางวัคซีน
  const scheduleData = [
    {
      ageGroup: 'แรกเกิด',
      icon: '👶🏻',
      status: 'success', // รับครบแล้ว
      vaccines: [
        { name: 'BCG', desc: 'ป้องกันวัณโรค', status: 'รับแล้ว' },
        { name: 'Hepatitis B (HB เข็ม 1)', desc: 'ป้องกันโรคตับอักเสบบี', status: 'รับแล้ว' },
      ],
    },
    {
      ageGroup: '2 เดือน',
      icon: '👶🏼',
      status: 'success',
      vaccines: [
        { name: 'DTP-HB-Hib เข็ม 1', desc: 'คอตีบ ไอกรน บาดทะยัก ตับอักเสบบี ฮิบ', status: 'รับแล้ว' },
        { name: 'IPV เข็ม 1', desc: 'โปลิโอแบบฉีด', status: 'รับแล้ว' },
        { name: 'Rotavirus เข็ม 1', desc: 'ป้องกันท้องร่วงจากไวรัสโรต้า', status: 'รับแล้ว' },
      ],
    },
    {
      ageGroup: '6 เดือน',
      icon: '🧒🏻',
      status: 'pending', // รอรับ
      vaccines: [
        { name: 'DTP-HB-Hib เข็ม 3', desc: '', status: 'รับแล้ว' },
        { name: 'OPV เข็ม 1', desc: 'โปลิโอแบบหยอด', status: 'รับแล้ว' },
        { name: 'Influenza เข็ม 1', desc: 'ไข้หวัดใหญ่', status: 'นัด 20 พ.ค. 67', date: '20 พ.ค. 67' },
        { name: 'Influenza เข็ม 2', desc: 'ไข้หวัดใหญ่', status: 'นัด 20 มิ.ย. 67', date: '20 มิ.ย. 67' },
      ],
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Web Navbar (Top Navigation) */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50 shadow-sm flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
            พ
          </div>
          <span className="font-bold text-xl text-blue-900 tracking-tight">พร้อมฉีด</span>
        </div>
        
        {/* เมนูสำหรับ Desktop */}
        <div className="hidden md:flex items-center space-x-6">
          <Link href="/user/dashboard" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition">หน้าหลัก</Link>
          <Link href="/user/schedule" className="text-sm font-bold text-blue-600 border-b-2 border-blue-600 pb-1">ตารางวัคซีน</Link>
          <Link href="/user/settings" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition">การแจ้งเตือน</Link>
          <Link href="/user/settings" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition">ตั้งค่า</Link>
        </div>

        <button className="md:hidden text-2xl text-slate-600">☰</button>
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* Profile Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-md overflow-hidden">
            👦🏻
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-2xl font-bold text-blue-900">น้องอุ่นใจ</h1>
            <p className="text-sm text-blue-600 font-medium mt-1">อายุ 6 เดือน 12 วัน • เพศชาย</p>
          </div>
          <button className="bg-white text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm">
            + เพิ่มข้อมูลเด็ก
          </button>
        </div>

        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">ตารางวัคซีน</h2>
            <p className="text-xs text-slate-500 mt-1">อ้างอิงจากกระทรวงสาธารณสุข</p>
          </div>
          
          <div className="flex bg-slate-200/50 rounded-xl p-1 w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('age')}
              className={`flex-1 md:w-32 text-sm py-2 rounded-lg font-semibold transition-all ${activeTab === 'age' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ตามช่วงอายุ
            </button>
            <button 
              onClick={() => setActiveTab('date')}
              className={`flex-1 md:w-32 text-sm py-2 rounded-lg font-semibold transition-all ${activeTab === 'date' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ตามวันที่นัด
            </button>
          </div>
        </div>

        {/* Timeline / Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scheduleData.map((group, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
              {/* Card Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                    {group.icon}
                  </div>
                  <h3 className="font-bold text-blue-900 text-lg">{group.ageGroup}</h3>
                </div>
                {group.status === 'success' ? (
                  <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[11px] font-bold">รับครบแล้ว</span>
                ) : (
                  <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-[11px] font-bold">รอรับ 2 รายการ</span>
                )}
              </div>

              {/* Card Body (Vaccines) */}
              <div className="p-4 flex-1 space-y-3">
                {group.vaccines.map((vac, vIdx) => (
                  <div key={vIdx} className="flex justify-between items-start pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">• {vac.name}</p>
                      {vac.desc && <p className="text-[11px] text-slate-400 pl-3 mt-0.5">{vac.desc}</p>}
                    </div>
                    
                    {vac.status === 'รับแล้ว' ? (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        รับแล้ว
                      </span>
                    ) : (
                      <div className="text-right">
                        <span className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">นัด {vac.date}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Card Footer Action */}
              <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
                <button className="text-xs font-semibold text-blue-600 hover:text-blue-800">ดูรายละเอียดเพิ่มเติม ›</button>
              </div>
            </div>
          ))}
        </div>
        
      </main>
    </div>
  );
}