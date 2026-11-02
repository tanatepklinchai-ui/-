import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <Link href="/login" className="text-sm font-semibold text-teal-700 hover:underline">กลับหน้าเข้าสู่ระบบ</Link>
        <h1 className="mt-5 text-3xl font-extrabold">ประกาศความเป็นส่วนตัว</h1>
        <p className="mt-2 text-sm text-slate-500">สำหรับบริการพร้อมฉีด (PromChid)</p>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">ข้อมูลที่ระบบใช้</h2>
          <p>ระบบใช้ข้อมูลบัญชีและข้อมูลติดต่อ รวมถึงข้อมูลโปรไฟล์เด็ก เช่น วันเกิด เพศ น้ำหนัก ส่วนสูง ประวัติวัคซีน และข้อมูลนัดหมาย เพื่อจัดการตารางวัคซีน บันทึกประวัติ และส่งการแจ้งเตือนตามการตั้งค่าของผู้ใช้</p>
          <p>หากผู้ใช้เลือกค้นหาสถานพยาบาลใกล้เคียง เบราว์เซอร์อาจขอใช้ตำแหน่งอุปกรณ์ ผู้ใช้สามารถปฏิเสธได้และยังค้นหาจากรายชื่อหรือข้อความได้</p>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-bold">การเข้าถึงและการส่งข้อมูล</h2>
          <p>ข้อมูลบัญชีและข้อมูลที่เกี่ยวข้องกับการนัดหมายอาจถูกเข้าถึงโดยผู้ดูแลระบบที่ได้รับอนุญาตเพื่อให้บริการและจัดการคำขอ ระบบอาจส่งอีเมลผ่านผู้ให้บริการอีเมลที่ผู้ดูแลระบบกำหนด และส่งการแจ้งเตือนผ่านเบราว์เซอร์เมื่อผู้ใช้เปิดใช้งาน</p>
          <p>ข้อมูลสุขภาพในระบบมีไว้เพื่อช่วยติดตามและจัดการนัดหมาย ไม่ใช้แทนคำแนะนำ การวินิจฉัย หรือการรักษาจากบุคลากรทางการแพทย์</p>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-bold">การขอเข้าถึงหรือขอลบข้อมูล</h2>
          <p>หากต้องการสอบถาม แก้ไข หรือขอลบข้อมูล โปรดติดต่อผู้ดูแลข้อมูลที่อีเมลด้านล่าง ระบบจะดำเนินการตามคำขอที่ยืนยันตัวตนแล้วภายใน 90 วันนับจากได้รับคำขอ ทั้งนี้อาจต้องเก็บข้อมูลบางส่วนต่อไปเมื่อกฎหมายกำหนด</p>
          <p><a className="font-semibold text-teal-700 hover:underline" href="mailto:poomg900@gmail.com">poomg900@gmail.com</a></p>
        </section>

        <p className="mt-8 border-t pt-5 text-xs text-slate-500">ประกาศนี้อธิบายการใช้ข้อมูลในบริการตามฟังก์ชันปัจจุบัน หากมีการเปลี่ยนแปลงการใช้ข้อมูล ระบบควรปรับปรุงประกาศให้สอดคล้องก่อนใช้งาน</p>
      </article>
    </main>
  );
}
