import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { VACCINE_SCHEDULE } from '@/lib/vaccineSchedule';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
  }

  try {
    const childId = new URL(req.url).searchParams.get('childId');
    if (!childId) {
      return NextResponse.json({ error: 'กรุณาเลือกเด็กเพื่อดูประวัติวัคซีน' }, { status: 400 });
    }

    const child = await prisma.child.findFirst({
      where: { id: childId, userId: session.userId },
      select: { id: true },
    });
    if (!child) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });
    }

    const records = await prisma.vaccineRecord.findMany({
      where: { userId: session.userId, childId },
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
    const { childId, vaccineCode, administeredDate, hospitalName } = body;
    const vaccine = VACCINE_SCHEDULE.find((item) => item.code === vaccineCode);
    const date = new Date(administeredDate);

    if (
      !vaccine ||
      typeof childId !== 'string' ||
      typeof administeredDate !== 'string' ||
      !Number.isFinite(date.getTime()) ||
      date > new Date() ||
      (hospitalName !== undefined && typeof hospitalName !== 'string')
    ) {
      return NextResponse.json({ error: 'ข้อมูลประวัติวัคซีนไม่ถูกต้อง' }, { status: 400 });
    }

    const child = await prisma.child.findFirst({
      where: { id: childId, userId: session.userId },
      select: { id: true, dob: true },
    });
    if (!child?.dob) {
      return NextResponse.json({ error: 'กรุณาบันทึกวันเกิดของเด็กก่อนเพิ่มประวัติวัคซีน' }, { status: 400 });
    }
    if (date < child.dob) {
      return NextResponse.json({ error: 'วันที่รับวัคซีนต้องไม่ก่อนวันเกิด' }, { status: 400 });
    }

    const existingRecord = await prisma.vaccineRecord.findFirst({
      where: {
        userId: session.userId,
        childId: child.id,
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
        childId: child.id,
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