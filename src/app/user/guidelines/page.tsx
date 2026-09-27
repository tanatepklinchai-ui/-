// src/app/user/guidelines/page.tsx
'use client';

import Link from 'next/link';

export default function GuidelinesPage() {
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-xs">
        <Link href="/user/dashboard" className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-teal-500"></div>
          <span className="font-semibold text-lg tracking-tight text-slate-800">PromChid</span>
        </Link>
        <Link
          href="/user/dashboard"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          กลับสู่หน้าหลัก
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">คำแนะนำก่อนและหลังได้รับวัคซีน</h1>
          <p className="text-sm text-slate-500 mt-2">ข้อควรปฏิบัติเพื่อความปลอดภัยและสุขภาพที่ดีของเด็ก</p>
        </div>

        {/* Section 1: ก่อนรับวัคซีน */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-lg">
              1
            </div>
            <h2 className="text-lg font-semibold text-slate-800">คำแนะนำก่อนได้รับวัคซีน</h2>
          </div>
          <ul className="space-y-4">
            {preVaccineTips.map((tip, index) => (
              <li key={index} className="flex items-start bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-600 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 2: หลังรับวัคซีน */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-lg">
              2
            </div>
            <h2 className="text-lg font-semibold text-slate-800">คำแนะนำในการดูแลเด็กหลังฉีดวัคซีน</h2>
          </div>
          <ul className="space-y-4">
            {postVaccineTips.map((tip, index) => (
              <li key={index} className="flex items-start bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-600 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}