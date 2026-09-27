// src/app/api/appointments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
  }

  try {
    const appointments = await prisma.appointment.findMany({
      where: { userId: session.userId },
      orderBy: { scheduledAt: 'asc' },
    });
    return NextResponse.json({ appointments });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลนัดหมายได้' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนจองคิว' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { hospitalName, scheduledAt } = body;
    const appointmentDate = new Date(scheduledAt);

    if (
      typeof hospitalName !== 'string' ||
      !hospitalName.trim() ||
      typeof scheduledAt !== 'string' ||
      !Number.isFinite(appointmentDate.getTime()) ||
      appointmentDate <= new Date()
    ) {
      return NextResponse.json({ error: 'ข้อมูลนัดหมายไม่ถูกต้อง' }, { status: 400 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId: session.userId,
        hospitalName: hospitalName.trim(),
        scheduledAt: appointmentDate,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกนัดหมาย' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนจัดการนัดหมาย' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { appointmentId, scheduledAt, status } = body;

    if (typeof appointmentId !== 'string' || (!scheduledAt && status !== 'CANCELLED')) {
      return NextResponse.json({ error: 'ข้อมูลนัดหมายไม่ถูกต้อง' }, { status: 400 });
    }

    const currentAppointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, userId: session.userId },
    });

    if (!currentAppointment || currentAppointment.status !== 'PENDING') {
      return NextResponse.json({ error: 'ไม่พบนัดหมายหรือไม่สามารถแก้ไขนัดหมายนี้ได้' }, { status: 404 });
    }

    const updateData: { scheduledAt?: Date; status?: string } = {};
    if (status === 'CANCELLED') {
      updateData.status = 'CANCELLED';
    } else if (scheduledAt) {
      const appointmentDate = new Date(scheduledAt);
      if (
        typeof scheduledAt !== 'string' ||
        !Number.isFinite(appointmentDate.getTime()) ||
        appointmentDate <= new Date()
      ) {
        return NextResponse.json({ error: 'วันและเวลานัดหมายไม่ถูกต้อง' }, { status: 400 });
      }
      updateData.scheduledAt = appointmentDate;
    }

    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
    });

    return NextResponse.json({ success: true, appointment });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตข้อมูลนัดหมายได้' }, { status: 500 });
  }
}