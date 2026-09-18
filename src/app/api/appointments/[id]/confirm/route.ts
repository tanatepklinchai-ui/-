// src/app/api/appointments/[id]/confirm/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { vaccineName } = await req.json();

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!appointment || appointment.status !== 'PENDING') {
      return NextResponse.json({ error: 'ไม่พบคิวที่รอดำเนินการ' }, { status: 404 });
    }

    // 1. อัปเดตสถานะคิวนัดเป็น CONFIRMED
    await prisma.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });

    // 2. บันทึกเข้าตาราง VaccineRecord อัตโนมัติ
    await prisma.vaccineRecord.create({
      data: {
        userId: appointment.userId,
        vaccineName: vaccineName || 'วัคซีนตามนัดหมาย',
        administeredDate: new Date(),
        hospitalName: appointment.hospitalName,
        source: 'USER_CONFIRMED',
      },
    });

    return NextResponse.json({ success: true, message: 'บันทึกประวัติการฉีดสำเร็จ' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}