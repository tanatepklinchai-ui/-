// src/app/user/dashboard/page.tsx
'use client';

import { useState } from 'react';

export default function ColorfulDashboard() {
  const [hospitalName, setHospitalName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  // 1. ข้อมูลตารางวัคซีน อ้างอิงจากแผนงานสร้างเสริมภูมิคุ้มกันโรค สธ. ปี 2569
  const vaccineHistory = [
    { id: 1, age: 'แรกเกิด', name: 'HB1 (ตับอักเสบบี), BCG (วัณโรค)', status: 'ได้รับวัคซีนแล้ว' },
    { id: 2, age: '1 เดือน', name: 'HB2 (ตับอักเสบบี - เฉพาะมารดาเป็นพาหะ)', status: 'ได้รับวัคซีนแล้ว' },
    { id: 3, age: '2 เดือน', name: 'DTP-HB-Hib1 (คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี-ฮิบ), IPV1 (โปลิโอแบบฉีด), Rota1 (โรต้า)', status: 'ได้รับวัคซีนแล้ว' },
    { id: 4, age: '4 เดือน', name: 'DTP-HB-Hib2, IPV2, Rota2', status: 'ได้รับวัคซีนแล้ว' },
    { id: 5, age: '6 เดือน', name: 'DTP-HB-Hib3, OPV3 (โปลิโอแบบหยอด), Rota3', status: 'รอรับวัคซีน' },
    { id: 6, age: '9 เดือน', name: 'MMR1 (หัด-คางทูม-หัดเยอรมัน)', status: 'รอรับวัคซีน' },
    { id: 7, age: '1 ปี', name: 'LAJE1 (ไข้สมองอักเสบเจอี)', status: 'รอรับวัคซีน' },
    { id: 8, age: '1 ปี 6 เดือน', name: 'DTP4, OPV4, MMR2', status: 'รอรับวัคซีน' },
    { id: 9, age: '2 ปี 6 เดือน', name: 'LAJE2', status: 'รอรับวัคซีน' },
    { id: 10, age: '4 ปี', name: 'DTP5, OPV5', status: 'รอรับวัคซีน' },
  ];

  const preVaccineTips = [
    "สังเกตอาการเจ็บป่วยของเด็ก หากมีไข้สูงหรือเจ็บป่วยรุนแรง ควรแจ้งเจ้าหน้าที่ก่อนฉีดวัคซีน",
    "ให้เด็กพักผ่อนให้เพียงพอ ก่อนมารับวัคซีน",
    "ให้เด็กกินอาหารรับประทานอาหารและดื่มนมตามปกติ",
    "เตรียมข้อมูลสุขภาพของเด็ก เช่น ประวัติแพ้ยา แพ้อาหาร การเจ็บป่วย และประวัติการได้รับวัคซีนครั้งที่ผ่านมา เพื่อแจ้งแก่เจ้าหน้าที่ก่อนฉีด"
  ];

  const postVaccineTips = [
    "สังเกตอาการหลังฉีดวัคซีน อย่างน้อย 30 นาทีที่สถานพยาบาล เพื่อดูอาการแพ้รุนแรง เช่น หายใจลำบาก หน้าบวม ปากบวม หรือมีผื่นทั่วตัว",
    "บริเวณที่ฉีดอาจมีอาการปวด บวม แดง หรือกดเจ็บเล็กน้อย สามารถประคบเย็นบริเวณที่ฉีดเพื่อลดอาการได้ และหลีกเลี่ยงการนวดหรือกดแรง ๆ",
    "หากมีไข้หรือไม่สบายตัว ให้เด็กพักผ่อนและดื่มน้ำหรือนมให้เพียงพอ หากไข้สูงหรือเด็กไม่สบายมาก ควรปรึกษาบุคลากรทางการแพทย์เรื่องการใช้ยาลดไข้",
    "ให้เด็กรับประทานอาหารและนมตามปกติ ไม่จำเป็นต้องงดอาหารหลังฉีดวัคซีน",
    "ติดตามอาการในช่วง 1–2 วันแรก อาการปวด บวม แดง หรือมีไข้เล็กน้อยมักเกิดขึ้นชั่วคราวและค่อย ๆ ดีขึ้น",
    "รีบพาเด็กไปโรงพยาบาล หากมีอาการผิดปกติรุนแรง เช่น หายใจลำบาก ซึมมาก ชัก หมดสติ หน้าหรือคอบวม ไข้สูงมาก หรือร้องกวนผิดปกติและปลอบไม่หยุด",
    "เก็บสมุดวัคซีนไว้และตรวจสอบวันนัดครั้งต่อไป เพื่อให้เด็กได้รับวัคซีนครบตามกำหนด"
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`ระบบบันทึกการนัดหมายที่ ${hospitalName} สำเร็จ!`);
    setHospitalName('');
    setScheduledAt('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-slate-800 font-sans pb-12">
      
      <nav className="bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-teal-400 to-teal-300 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-teal-200">
            พ
          </div>
          <span className="font-extrabold text-xl text-teal-800 tracking-tight">พร้อมฉีด</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-bold text-pink-500 hover:text-pink-600 bg-pink-50 hover:bg-pink-100 px-4 py-2 rounded-full transition-colors"
        >
          ออกจากระบบ
        </button>
      </nav>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-blue-100/50 flex items-center gap-6 border-4 border-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100 rounded-full -mr-10 -mt-10 opacity-50"></div>
          <div className="absolute bottom-0 right-20 w-16 h-16 bg-blue-100 rounded-full -mb-5 opacity-50"></div>
          
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-300 to-blue-200 rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-md z-10 shrink-0">
            👦🏻
          </div>
          <div className="z-10">
            <h1 className="text-2xl font-extrabold text-blue-900">น้องอุ่นใจ</h1>
            <p className="text-sm text-blue-600 font-medium mt-1 bg-blue-50 inline-block px-3 py-1 rounded-full">อายุ 6 เดือน 12 วัน • น้ำหนัก 7.5 กก.</p>
          </div>
        </div>

        <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-indigo-100/50 border border-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-xl">💉</div>
            <div>
              <h2 className="text-xl font-bold text-indigo-900">ตารางประวัติการรับวัคซีน</h2>
              <p className="text-xs text-indigo-500 mt-1">อ้างอิงตามแผนงาน สธ. ปี 2569</p>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-2xl border border-indigo-50">
            <table className="w-full text-left text-sm">
              <thead className="bg-indigo-50 text-indigo-800">
                <tr>
                  <th className="py-4 px-4 font-bold rounded-tl-2xl whitespace-nowrap w-24">อายุ</th>
                  <th className="py-4 px-4 font-bold">ชื่อวัคซีน</th>
                  <th className="py-4 px-4 font-bold text-center rounded-tr-2xl w-36">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50">
                {vaccineHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-4 px-4 font-semibold text-indigo-900 whitespace-nowrap">{item.age}</td>
                    <td className="py-4 px-4 text-slate-600 leading-relaxed">{item.name}</td>
                    <td className="py-4 px-4 text-center">
                      {item.status === 'ได้รับวัคซีนแล้ว' ? (
                        <span className="inline-flex items-center justify-center w-full max-w-[120px] gap-1 bg-emerald-100 text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold shadow-sm">
                          ✅ ได้รับแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-full max-w-[120px] gap-1 bg-amber-100 text-amber-600 px-3 py-2 rounded-xl text-xs font-bold shadow-sm">
                          ⏳ รอรับวัคซีน
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <section className="bg-gradient-to-br from-pink-400 to-rose-400 rounded-3xl p-6 md:p-10 shadow-xl shadow-pink-200 relative overflow-hidden mt-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full mix-blend-overlay opacity-10 blur-3xl translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full mix-blend-overlay opacity-10 blur-3xl -translate-x-1/2 translate-y-1/2"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 text-center md:text-left text-white">
              <h2 className="text-3xl font-extrabold mb-2">📅 จองคิวฉีดวัคซีน</h2>
              <p className="text-pink-100 text-sm leading-relaxed mb-6">
                สะดวก รวดเร็ว ไม่พลาดทุกเข็มสำคัญ <br className="hidden md:block" />
                ระบบจะส่งการแจ้งเตือนไปยังอีเมลของคุณล่วงหน้า
              </p>
            </div>
            
            <form onSubmit={handleBooking} className="bg-white/95 backdrop-blur-sm p-6 rounded-3xl shadow-2xl w-full max-w-md space-y-4">
              <div>
                <label className="block text-xs font-bold text-rose-800 mb-1">ชื่อสถานพยาบาล</label>
                <input
                  type="text"
                  required
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="เช่น โรงพยาบาลศูนย์ชัยนาท"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-rose-50 bg-rose-50/30 text-sm focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100 transition-all text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-rose-800 mb-1">วันและเวลาที่นัดหมาย</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-rose-50 bg-rose-50/30 text-sm focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100 transition-all text-slate-700"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm transition-all shadow-lg shadow-pink-200 mt-2"
              >
                ยืนยันการนัดหมาย
              </button>
            </form>
          </div>
        </section>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}} />
    </div>
  );
}