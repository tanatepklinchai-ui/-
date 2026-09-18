// src/app/api/moph/sync/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
const VACCINE_SCHEDULE = [
  { code: 'BCG', name: 'BCG', dose: 'เข็มที่ 1' },
  { code: 'HB1', name: 'ไวรัสตับอักเสบบี', dose: 'เข็มที่ 1' },
  { code: 'DTP-HB-HIB1', name: 'DTP-HB-HIB', dose: 'เข็มที่ 1' },
  { code: 'IPV1', name: 'IPV', dose: 'เข็มที่ 1' },
  { code: 'ROTA1', name: 'โรต้า', dose: 'เข็มที่ 1' },
  { code: 'DTP-HB-HIB2', name: 'DTP-HB-HIB', dose: 'เข็มที่ 2' },
  { code: 'IPV2', name: 'IPV', dose: 'เข็มที่ 2' },
  { code: 'ROTA2', name: 'โรต้า', dose: 'เข็มที่ 2' },
] as const;

export async function POST() {
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ error: 'ไม่พบผู้ใช้ในระบบ' }, { status: 404 });

  // ตัวอย่างบันทึกประวัติวัคซีนช่วงแรกเกิด - 4 เดือน ที่ได้รับแล้ว
  const completedCodes = ['BCG', 'HB1', 'DTP-HB-HIB1', 'IPV1', 'ROTA1', 'DTP-HB-HIB2', 'IPV2', 'ROTA2'];

  for (const item of VACCINE_SCHEDULE) {
    if (completedCodes.includes(item.code)) {
      const exists = await prisma.vaccineRecord.findFirst({
        where: { userId: user.id, vaccineName: `${item.name} ${item.dose}` },
      });

      if (!exists) {
        await prisma.vaccineRecord.create({
          data: {
            userId: user.id,
            vaccineName: `${item.name} ${item.dose}`,
            vaccineCode: item.code,
            administeredDate: new Date('2026-03-20'),
            hospitalName: 'ศูนย์บริการสาธารณสุขกระทรวงสาธารณสุข',
            source: 'MOPH_API',
          },
        });
      }
    }
  }

  const allVaccines = await prisma.vaccineRecord.findMany({
    where: { userId: user.id },
    orderBy: { administeredDate: 'desc' },
  });

  return NextResponse.json({ success: true, vaccines: allVaccines });
}