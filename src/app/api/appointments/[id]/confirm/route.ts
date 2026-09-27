// src/app/api/appointments/[id]/confirm/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // รับค่าชื่อวัคซีนที่ผู้ใช้กรอกเข้ามาตอนกดยืนยัน (ถ้ามี)
    const body = await req.json().catch(() => ({}));

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment || appointment.status !== 'PENDING') {
      return NextResponse.json({ error: 'ไม่พบรายการนัดหมายหรือคิวถูกปิดแล้ว' }, { status: 400 });
    }

    // 1. อัปเดตสถานะนัดหมายเป็น COMPLETED (ฉีดเรียบร้อย)
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    // 2. บันทึกข้อมูลลงตาราง VaccineRecord ตามโครงสร้างฐานข้อมูลของคุณ
    await prisma.vaccineRecord.create({
      data: {
        userId: appointment.userId,
        vaccineName: body.vaccineName || 'วัคซีนตามเกณฑ์กระทรวงฯ',
        administeredDate: new Date(),
        hospitalName: appointment.hospitalName,
        source: 'APP_CONFIRM', // ระบุแหล่งที่มาว่ามาจากการกดยืนยันในแอปพลิเคชัน
      },
    });

    return NextResponse.json({ success: true, appointment: updatedAppointment });
  } catch (error) {
    console.error("Confirm error:", error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการยืนยันและบันทึกประวัติ' }, { status: 500 });
  }
}