// src/app/user/dashboard/page.tsx
'use client';

import { useState } from 'react';

export default function ColorfulDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'schedule' | 'tips'>('overview');
  const [isLocating, setIsLocating] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [selectedDateSlot, setSelectedDateSlot] = useState<{date: string, time: string} | null>(null);
  const [realHospitals, setRealHospitals] = useState<any[]>([]);

  // ข้อมูลตารางวัคซีน อ้างอิงจากแผนงาน สธ. ปี 2569
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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const handleFindNearby = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/hospitals?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (data.hospitals) setRealHospitals(data.hospitals);
        } catch (error) {
          alert('เกิดข้อผิดพลาดในการดึงข้อมูลโรงพยาบาล');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        alert('กรุณาเปิดใช้งาน GPS และอนุญาตการเข้าถึงตำแหน่งที่ตั้ง');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospital || !selectedDateSlot) {
      alert('กรุณาเลือกโรงพยาบาลและเวลาที่ต้องการนัดหมาย');
      return;
    }
    alert(`🎉 นัดหมายสำเร็จ! ระบบได้บันทึกคิวและส่งการแจ้งเตือนไปยังอีเมลของคุณเรียบร้อยแล้ว`);
    setSelectedHospital(null);
    setSelectedDateSlot(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-slate-800 font-sans flex flex-col md:flex-row">
      
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
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'overview' ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span>📊</span> ภาพรวมโปรไฟล์
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'schedule' ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span>💉</span> ตารางประวัติวัคซีน
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'appointments' ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span>📅</span> จองคิวฉีดวัคซีน
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'tips' ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span>🧸</span> คำแนะนำก่อน-หลังฉีด
            </button>
          </nav>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 text-xs font-bold text-pink-500 hover:text-pink-600 bg-pink-50 hover:bg-pink-100 p-3.5 rounded-2xl transition-colors w-full"
        >
          <span>🚪</span> ออกจากระบบ
        </button>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar สำหรับมือถือ และแสดง Header ด้านบน */}
        <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-indigo-50 flex justify-between items-center sticky top-0 z-20 shadow-sm md:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-teal-400 to-teal-300 rounded-xl flex items-center justify-center text-white font-bold shadow-md">พ</div>
            <span className="font-extrabold text-lg text-teal-800">พร้อมฉีด</span>
          </div>
          <button onClick={handleLogout} className="text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1.5 rounded-full">
            ออกจากระบบ
          </button>
        </header>

        {/* 3. TOP NAVIGATION TABS (สำหรับสลับหน้าจอในมือถือ และเพิ่มความสมบูรณ์บนเดสก์ท็อป) */}
        <div className="bg-white/50 backdrop-blur-sm border-b border-indigo-50 px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar md:hidden">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>ภาพรวม</button>
          <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>ตารางวัคซีน</button>
          <button onClick={() => setActiveTab('appointments')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'appointments' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>จองคิว</button>
          <button onClick={() => setActiveTab('tips')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'tips' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>คำแนะนำ</button>
        </div>

        {/* Dynamic Content Container */}
        <main className="flex-1 p-4 md:p-10 max-w-5xl mx-auto w-full space-y-8">
          
          {/* TAB 1: OVERVIEW (ภาพรวมโปรไฟล์) */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-blue-100/50 flex items-center gap-6 border-4 border-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100 rounded-full -mr-10 -mt-10 opacity-50"></div>
                <div className="w-20 h-20 bg-gradient-to-tr from-blue-300 to-blue-200 rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-md z-10 shrink-0">👦🏻</div>
                <div className="z-10">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-blue-900">น้องอุ่นใจ</h1>
                  <p className="text-sm text-blue-600 font-medium mt-1 bg-blue-50 inline-block px-3 py-1 rounded-full">อายุ 6 เดือน 12 วัน • น้ำหนัก 7.5 กก.</p>
                </div>
              </div>

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-lg shadow-indigo-50 border border-white flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-xl">✅</div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold">ได้รับวัคซีนแล้ว</p>
                    <h3 className="text-xl font-extrabold text-slate-800">4 เข็ม</h3>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-lg shadow-indigo-50 border border-white flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-xl">⏳</div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold">รอรับวัคซีนรอบถัดไป</p>
                    <h3 className="text-xl font-extrabold text-slate-800">6 เข็ม</h3>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-lg shadow-indigo-50 border border-white flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-xl">📅</div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold">นัดหมายถัดไป</p>
                    <h3 className="text-xl font-extrabold text-slate-800">ยังไม่มีคิว</h3>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULE (ตารางประวัติวัคซีน) */}
          {activeTab === 'schedule' && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-indigo-100/50 border border-white animate-fade-in">
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
                            <span className="inline-flex items-center justify-center w-full max-w-[120px] gap-1 bg-emerald-100 text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold shadow-sm">✅ ได้รับแล้ว</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-full max-w-[120px] gap-1 bg-amber-100 text-amber-600 px-3 py-2 rounded-xl text-xs font-bold shadow-sm">⏳ รอรับวัคซีน</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 3: APPOINTMENTS (ระบบจองคิว & โรงพยาบาลใกล้ฉัน) */}
          {activeTab === 'appointments' && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-rose-100/50 border-t-4 border-rose-400 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-rose-900">📅 นัดหมายรับวัคซีน</h2>
                  <p className="text-sm text-slate-500 mt-1">ค้นหาโรงพยาบาลใกล้ฉันด้วย GPS และเลือกช่วงเวลาที่สะดวก</p>
                </div>
                <button 
                  onClick={handleFindNearby}
                  disabled={isLocating}
                  className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-rose-200 w-full md:w-auto justify-center"
                >
                  {isLocating ? (
                    <><svg className="animate-spin w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> กำลังค้นหาพิกัด...</>
                  ) : (
                    <>📍 ค้นหาโรงพยาบาลใกล้ฉัน</>
                  )}
                </button>
              </div>

              {realHospitals.length === 0 ? (
                <div className="text-center py-12 bg-rose-50/50 rounded-2xl border-2 border-dashed border-rose-100">
                  <p className="text-slate-500 font-medium text-sm">ยังไม่ได้โหลดรายชื่อโรงพยาบาล</p>
                  <p className="text-slate-400 text-xs mt-1">กดปุ่ม "ค้นหาโรงพยาบาลใกล้ฉัน" ด้านบนเพื่อเริ่มดึงพิกัด GPS</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {realHospitals.map((hospital) => (
                    <div 
                      key={hospital.id} 
                      className={`border-2 rounded-2xl p-4 transition-all cursor-pointer ${selectedHospital === hospital.id ? 'border-rose-400 bg-rose-50/30 shadow-md' : 'border-slate-100 hover:border-rose-200'}`}
                      onClick={() => setSelectedHospital(hospital.id)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">{hospital.name}</h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <span className="text-rose-500">📍</span> ห่างจากคุณ {hospital.distance}
                          </p>
                        </div>
                        {selectedHospital === hospital.id && (
                          <div className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-lg">เลือกแล้ว</div>
                        )}
                      </div>

                      {selectedHospital === hospital.id && (
                        <div className="mt-4 pt-4 border-t border-rose-100 animate-fade-in-up">
                          <p className="text-xs font-bold text-slate-600 mb-3">เลือกวันและเวลาที่ต้องการนัดหมาย:</p>
                          <div className="space-y-4">
                            {hospital.availableDates.map((d: any, idx: number) => (
                              <div key={idx}>
                                <p className="text-sm font-semibold text-rose-700 mb-2">{d.date}</p>
                                <div className="flex flex-wrap gap-2">
                                  {d.slots.map((time: string) => {
                                    const isSelected = selectedDateSlot?.date === d.date && selectedDateSlot?.time === time;
                                    return (
                                      <button
                                        key={time}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDateSlot({ date: d.date, time });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected ? 'bg-rose-500 text-white shadow-md shadow-rose-200' : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600'}`}
                                      >
                                        {time} น.
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedHospital && selectedDateSlot && (
                <div className="mt-6 animate-fade-in-up">
                  <button
                    onClick={handleBooking}
                    className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-base transition-all shadow-lg shadow-pink-200"
                  >
                    ยืนยันการนัดหมาย
                  </button>
                </div>
              )}
            </section>
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