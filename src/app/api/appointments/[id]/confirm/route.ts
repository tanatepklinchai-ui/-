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
    // รับค่าจากหน้าเว็บมา (เผื่อนำไปใช้ในอนาคตเมื่อฐานข้อมูลพร้อม)
    const body = await req.json();

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment || appointment.status !== 'PENDING') {
      return NextResponse.json({ error: 'ไม่พบรายการนัดหมายหรือคิวถูกปิดแล้ว' }, { status: 400 });
    }

    // อัปเดตแค่สถานะเป็นฉีดแล้ว (ตัดการบันทึก VaccineHistory ออกชั่วคราวเพราะ DB ยังไม่มีตารางนี้)
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    return NextResponse.json({ success: true, appointment: updatedAppointment });
  } catch (error) {
    console.error("Confirm error:", error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการยืนยัน' }, { status: 500 });
  }
}