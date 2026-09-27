import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { VACCINE_SCHEDULE } from '@/lib/vaccineSchedule';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
  }

  try {
    const records = await prisma.vaccineRecord.findMany({
      where: { userId: session.userId },
      orderBy: { administeredDate: 'desc' },
    });
    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถดึงประวัติวัคซีนได้' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนบันทึกประวัติวัคซีน' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { vaccineCode, administeredDate, hospitalName } = body;
    const vaccine = VACCINE_SCHEDULE.find((item) => item.code === vaccineCode);
    const date = new Date(administeredDate);

    if (
      !vaccine ||
      typeof administeredDate !== 'string' ||
      !Number.isFinite(date.getTime()) ||
      date > new Date() ||
      (hospitalName !== undefined && typeof hospitalName !== 'string')
    ) {
      return NextResponse.json({ error: 'ข้อมูลประวัติวัคซีนไม่ถูกต้อง' }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: session.userId },
      select: { dob: true },
    });
    if (!profile?.dob) {
      return NextResponse.json({ error: 'กรุณาบันทึกวันเกิดของเด็กก่อนเพิ่มประวัติวัคซีน' }, { status: 400 });
    }
    if (date < profile.dob) {
      return NextResponse.json({ error: 'วันที่รับวัคซีนต้องไม่ก่อนวันเกิด' }, { status: 400 });
    }

    const existingRecord = await prisma.vaccineRecord.findFirst({
      where: {
        userId: session.userId,
        vaccineCode,
        verificationStatus: { in: ['PENDING', 'VERIFIED'] },
      },
    });
    if (existingRecord) {
      return NextResponse.json({ error: 'ประวัติวัคซีนรายการนี้ถูกรายงานหรือยืนยันแล้ว' }, { status: 409 });
    }

    const record = await prisma.vaccineRecord.create({
      data: {
        userId: session.userId,
        vaccineCode,
        vaccineName: `${vaccine.name} ${vaccine.dose}`,
        administeredDate: date,
        hospitalName: hospitalName?.trim() || 'ไม่ระบุในสมุดวัคซีน',
        source: 'PARENT_REPORTED',
        verificationStatus: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกประวัติวัคซีน' }, { status: 500 });
  }
}