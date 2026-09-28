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
    const { childId, vaccineCode, vaccineCatalogId, administeredDate, hospitalName } = body;
    const date = new Date(administeredDate);

    if (!childId || !administeredDate || !Number.isFinite(date.getTime()) || date > new Date()) {
      return NextResponse.json({ error: 'ข้อมูลประวัติวัคซีนไม่ถูกต้อง' }, { status: 400 });
    }

    let finalVaccineCode = vaccineCode;
    let finalVaccineName = '';
    
    // ตรวจสอบว่าเป็นวัคซีนตามตาราง หรือ วัคซีนทางเลือก
    if (vaccineCode) {
      const vaccine = VACCINE_SCHEDULE.find((item) => item.code === vaccineCode);
      if (!vaccine) return NextResponse.json({ error: 'ไม่พบวัคซีนในระบบ' }, { status: 400 });
      finalVaccineName = `${vaccine.name} ${vaccine.dose}`;
    } else if (vaccineCatalogId) {
      const catalog = await prisma.vaccineCatalog.findUnique({ where: { id: vaccineCatalogId } });
      if (!catalog) return NextResponse.json({ error: 'ไม่พบวัคซีนทางเลือกในระบบ' }, { status: 400 });
      finalVaccineCode = catalog.code;
      finalVaccineName = catalog.name;
    } else {
      return NextResponse.json({ error: 'กรุณาระบุวัคซีน' }, { status: 400 });
    }

    const child = await prisma.child.findFirst({
      where: { id: childId, userId: session.userId },
      select: { id: true, dob: true },
    });
    
    if (!child?.dob) return NextResponse.json({ error: 'กรุณาบันทึกวันเกิดของเด็กก่อน' }, { status: 400 });
    if (date < child.dob) return NextResponse.json({ error: 'วันที่รับวัคซีนต้องไม่ก่อนวันเกิด' }, { status: 400 });

    const record = await prisma.vaccineRecord.create({
      data: {
        userId: session.userId,
        childId: child.id,
        vaccineCode: finalVaccineCode,
        vaccineCatalogId: vaccineCatalogId || null,
        vaccineName: finalVaccineName,
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