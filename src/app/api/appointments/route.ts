// src/app/api/appointments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

class AppointmentRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function getBangkokSlot(date: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const partValues = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: new Date(Date.UTC(
      Number(partValues.year),
      Number(partValues.month) - 1,
      Number(partValues.day)
    )),
    time: `${partValues.hour}:${partValues.minute}`,
  };
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
      where: { id: childId, userId: session.userId },
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
    const { childId, hospitalId, scheduledAt } = body;
    const appointmentDate = new Date(scheduledAt);

    if (
      typeof hospitalId !== 'string' ||
      typeof childId !== 'string' ||
      !isValidAppointmentDate(scheduledAt)
    ) {
      return NextResponse.json({ error: 'ข้อมูลนัดหมายไม่ถูกต้อง' }, { status: 400 });
    }

    const { date, time } = getBangkokSlot(appointmentDate);
    const appointment = await prisma.$transaction(async (transaction) => {
      const child = await transaction.child.findFirst({
        where: { id: childId, userId: session.userId },
        select: { id: true },
      });
      if (!child) {
        throw new AppointmentRequestError('ไม่พบข้อมูลเด็ก', 404);
      }

      const hospital = await transaction.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, name: true },
      });
      if (!hospital) {
        throw new AppointmentRequestError('ไม่พบสถานพยาบาลที่เลือก', 404);
      }

      const slot = await transaction.hospitalSlot.findUnique({
        where: { hospitalId_date_time: { hospitalId, date, time } },
      });
      if (!slot) {
        throw new AppointmentRequestError('ช่วงเวลานี้ไม่ได้เปิดให้จองแล้ว', 409);
      }

      const reservation = await transaction.hospitalSlot.updateMany({
        where: { id: slot.id, booked: { lt: slot.capacity } },
        data: { booked: { increment: 1 } },
      });
      if (reservation.count !== 1) {
        throw new AppointmentRequestError('ช่วงเวลานี้เต็มแล้ว กรุณาเลือกเวลาอื่น', 409);
      }

      return transaction.appointment.create({
        data: {
          userId: session.userId,
          childId: child.id,
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          scheduledAt: appointmentDate,
          status: 'PENDING',
        },
        include: appointmentInclude(),
      });
    });

    return NextResponse.json({ success: true, appointment }, { status: 201 });
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
    const { appointmentId, scheduledAt, status } = body;

    if (
      typeof appointmentId !== 'string' ||
      (status !== 'CANCELLED' && !isValidAppointmentDate(scheduledAt)) ||
      (status !== undefined && status !== 'CANCELLED')
    ) {
      return NextResponse.json({ error: 'ข้อมูลนัดหมายไม่ถูกต้อง' }, { status: 400 });
    }

    const appointmentDate = status === 'CANCELLED' ? null : new Date(scheduledAt);
    const newSlot = appointmentDate ? getBangkokSlot(appointmentDate) : null;
    const appointment = await prisma.$transaction(async (transaction) => {
      const currentAppointment = await transaction.appointment.findFirst({
        where: { id: appointmentId, userId: session.userId },
      });
      if (!currentAppointment || currentAppointment.status !== 'PENDING') {
        throw new AppointmentRequestError('ไม่พบนัดหมายหรือไม่สามารถแก้ไขนัดหมายนี้ได้', 404);
      }

      if (status === 'CANCELLED') {
        if (currentAppointment.hospitalId) {
          const currentSlot = getBangkokSlot(currentAppointment.scheduledAt);
          await transaction.hospitalSlot.updateMany({
            where: {
              hospitalId: currentAppointment.hospitalId,
              date: currentSlot.date,
              time: currentSlot.time,
              booked: { gt: 0 },
            },
            data: { booked: { decrement: 1 } },
          });
        }

        return transaction.appointment.update({
          where: { id: appointmentId },
          data: { status: 'CANCELLED' },
          include: appointmentInclude(),
        });
      }

      if (!currentAppointment.hospitalId || !appointmentDate || !newSlot) {
        throw new AppointmentRequestError('ไม่สามารถเปลี่ยนเวลานัดหมายนี้ได้', 409);
      }

      const currentSlot = getBangkokSlot(currentAppointment.scheduledAt);
      const isSameSlot = currentSlot.date.getTime() === newSlot.date.getTime() &&
        currentSlot.time === newSlot.time;

      if (!isSameSlot) {
        const targetSlot = await transaction.hospitalSlot.findUnique({
          where: {
            hospitalId_date_time: {
              hospitalId: currentAppointment.hospitalId,
              date: newSlot.date,
              time: newSlot.time,
            },
          },
        });
        if (!targetSlot) {
          throw new AppointmentRequestError('ช่วงเวลาใหม่ไม่ได้เปิดให้จอง', 409);
        }

        const reservation = await transaction.hospitalSlot.updateMany({
          where: { id: targetSlot.id, booked: { lt: targetSlot.capacity } },
          data: { booked: { increment: 1 } },
        });
        if (reservation.count !== 1) {
          throw new AppointmentRequestError('ช่วงเวลาใหม่เต็มแล้ว กรุณาเลือกเวลาอื่น', 409);
        }

        await transaction.hospitalSlot.updateMany({
          where: {
            hospitalId: currentAppointment.hospitalId,
            date: currentSlot.date,
            time: currentSlot.time,
            booked: { gt: 0 },
          },
          data: { booked: { decrement: 1 } },
        });
      }

      return transaction.appointment.update({
        where: { id: appointmentId },
        data: { scheduledAt: appointmentDate },
        include: appointmentInclude(),
      });
    });

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    if (error instanceof AppointmentRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตข้อมูลนัดหมายได้' }, { status: 500 });
  }
}