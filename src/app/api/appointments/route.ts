import { Prisma } from '@prisma/client';
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

async function promoteWaitlistedAppointment(transaction: Prisma.TransactionClient, hospitalId: string, scheduledAt: Date) {
  const slotKey = getBangkokSlot(scheduledAt);
  const slot = await transaction.hospitalSlot.findUnique({
    where: { hospitalId_date_time: { hospitalId, date: slotKey.date, time: slotKey.time } },
  });

  if (!slot || slot.isClosed || slot.booked >= slot.capacity) {
    return false;
  }

  const nextWaitlisted = await transaction.appointment.findFirst({
    where: {
      hospitalId,
      scheduledAt,
      status: 'PENDING',
      isWaitlisted: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  if (!nextWaitlisted) {
    return false;
  }

  const updateResult = await transaction.appointment.updateMany({
    where: { id: nextWaitlisted.id, status: 'PENDING', isWaitlisted: true },
    data: {
      status: 'CONFIRMED',
      isWaitlisted: false,
      usesCapacity: true,
      notified7Days: false,
      notified3Days: false,
      notified1Day: false,
      notified1Hour: false,
    },
  });

  if (updateResult.count !== 1) {
    return false;
  }

  await transaction.hospitalSlot.updateMany({
    where: { id: slot.id, isClosed: false, booked: { lt: slot.capacity } },
    data: { booked: { increment: 1 } },
  });

  return true;
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
        where: { id: childId, userId: session.userId },
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

      return transaction.appointment.create({
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
        return transaction.appointment.update({
          where: { id: appointmentId },
          data: { status: 'RESCHEDULE_REQUESTED' },
          include: appointmentInclude(),
        });
      }

      if (status === 'CANCELLED') {
        if (currentAppointment.hospitalId && currentAppointment.usesCapacity && !currentAppointment.isWaitlisted) {
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
          await promoteWaitlistedAppointment(transaction, currentAppointment.hospitalId, currentAppointment.scheduledAt);
        }

        return transaction.appointment.update({
          where: { id: appointmentId },
          data: { status: 'CANCELLED' },
          include: appointmentInclude(),
        });
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