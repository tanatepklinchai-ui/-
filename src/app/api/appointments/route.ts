import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { recordUserActivity } from '@/lib/userActivity';
import { releaseAppointmentCapacity } from '@/lib/appointmentCapacity';

export const dynamic = 'force-dynamic';

class AppointmentRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function isValidAppointmentDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date > new Date() &&
    date.getSeconds() === 0 && date.getMilliseconds() === 0;
}

function appointmentInclude() {
  return {
    hospital: {
      include: {
        slots: {
          where: { date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          orderBy: [{ date: 'asc' as const }, { time: 'asc' as const }],
        },
      },
    },
  };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
  }

  try {
    const childId = new URL(req.url).searchParams.get('childId');
    if (!childId) {
      return NextResponse.json({ error: 'กรุณาเลือกเด็กเพื่อดูนัดหมาย' }, { status: 400 });
    }

    const child = await prisma.child.findFirst({
      where: { id: childId, userId: session.userId, archivedAt: null },
      select: { id: true },
    });
    if (!child) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });
    }

    const appointments = await prisma.appointment.findMany({
      where: { userId: session.userId, childId },
      orderBy: { scheduledAt: 'asc' },
      include: appointmentInclude(),
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
    const { childId, hospitalId, scheduledAt, requestedVaccine } = body;
    const appointmentDate = new Date(scheduledAt);

    if (
      typeof hospitalId !== 'string' ||
      typeof childId !== 'string' ||
      !isValidAppointmentDate(scheduledAt)
    ) {
      return NextResponse.json({ error: 'ข้อมูลนัดหมายไม่ถูกต้อง' }, { status: 400 });
    }

    const appointment = await prisma.$transaction(async (transaction) => {
      const child = await transaction.child.findFirst({
        where: { id: childId, userId: session.userId, archivedAt: null },
        select: { id: true },
      });
      if (!child) {
        throw new AppointmentRequestError('ไม่พบข้อมูลเด็ก', 404);
      }

      const hospital = await transaction.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, name: true, isActive: true },
      });
      if (!hospital || !hospital.isActive) {
        throw new AppointmentRequestError('สถานพยาบาลนี้ไม่เปิดให้จองในขณะนี้', 404);
      }

      if (requestedVaccine !== undefined && requestedVaccine !== null &&
          (typeof requestedVaccine !== 'string' || requestedVaccine.length > 200)) {
        throw new AppointmentRequestError('ชื่อวัคซีนไม่ถูกต้อง', 400);
      }

      const appointment = await transaction.appointment.create({
        data: {
          userId: session.userId,
          childId: child.id,
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          scheduledAt: appointmentDate,
          status: 'PENDING',
          isWaitlisted: false,
          usesCapacity: false,
          requestedVaccine,
        },
        include: appointmentInclude(),
      });
      await recordUserActivity(transaction, session.userId, 'APPOINTMENT_BOOKED');
      return appointment;
    });

    return NextResponse.json({ success: true, appointment, waitlisted: false }, { status: 201 });
  } catch (error) {
    if (error instanceof AppointmentRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
    const { appointmentId, status } = body;

    if (
      typeof appointmentId !== 'string' ||
      !['CANCELLED', 'RESCHEDULE_REQUESTED'].includes(status)
    ) {
      return NextResponse.json({ error: 'ข้อมูลนัดหมายไม่ถูกต้อง' }, { status: 400 });
    }

    const appointment = await prisma.$transaction(async (transaction) => {
      const currentAppointment = await transaction.appointment.findFirst({
        where: { id: appointmentId, userId: session.userId },
      });

      if (!currentAppointment || !['PENDING', 'CONFIRMED', 'EXPIRED', 'RESCHEDULED', 'RESCHEDULE_REQUESTED'].includes(currentAppointment.status)) {
        throw new AppointmentRequestError('ไม่พบนัดหมายหรือไม่สามารถแก้ไขนัดหมายนี้ได้', 404);
      }

      if (status === 'RESCHEDULE_REQUESTED') {
        if (!['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(currentAppointment.status)) {
          throw new AppointmentRequestError('นัดหมายนี้ไม่สามารถส่งคำขอเลื่อนได้', 409);
        }
        const appointment = await transaction.appointment.update({
          where: { id: appointmentId },
          data: { status: 'RESCHEDULE_REQUESTED' },
          include: appointmentInclude(),
        });
        await recordUserActivity(transaction, session.userId, 'APPOINTMENT_RESCHEDULE_REQUESTED');
        return appointment;
      }

      if (status === 'CANCELLED') {
        await releaseAppointmentCapacity(transaction, currentAppointment);

        const appointment = await transaction.appointment.update({
          where: { id: appointmentId },
          data: { status: 'CANCELLED' },
          include: appointmentInclude(),
        });
        await recordUserActivity(transaction, session.userId, 'APPOINTMENT_CANCELLED');
        return appointment;
      }
      throw new AppointmentRequestError('ข้อมูลนัดหมายไม่ถูกต้อง', 400);
    });

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    if (error instanceof AppointmentRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตข้อมูลนัดหมายได้' }, { status: 500 });
  }
}