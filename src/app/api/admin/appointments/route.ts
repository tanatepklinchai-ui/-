// src/app/api/admin/appointments/route.ts
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { notifyAppointmentUpdate } from '@/lib/appointmentNotifications';

class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function getBangkokSlot(date: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day))),
    time: `${values.hour}:${values.minute}`,
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

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        user: { select: { username: true, email: true } },
        child: { select: { firstName: true, lastName: true, dob: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      take: 1000,
    });
    return NextResponse.json({ appointments });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายการนัดหมายได้' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
  
  try {
    const body = await req.json();
    const { appointmentId, status, newScheduledAt } = body;

    if (typeof appointmentId !== 'string') {
      return NextResponse.json({ error: 'ข้อมูลการจัดการคิวไม่ถูกต้อง' }, { status: 400 });
    }

    if (status === 'NOTIFY') {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { user: true },
      });
      if (!appointment) return NextResponse.json({ error: 'ไม่พบนัดหมายที่ต้องการแจ้งเตือน' }, { status: 404 });
      const notification = await notifyAppointmentUpdate({
        user: appointment.user,
        appointment,
        title: 'แจ้งเตือนนัดหมายวัคซีน - พร้อมฉีด',
        message: 'มีการแจ้งเตือนเกี่ยวกับนัดหมายวัคซีนของคุณ',
      });
      return NextResponse.json({ success: true, ...notification });
    }

    if (!['CONFIRMED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'].includes(status)) {
      return NextResponse.json({ error: 'ข้อมูลการจัดการคิวไม่ถูกต้อง' }, { status: 400 });
    }

    const newAppointmentDate = typeof newScheduledAt === 'string' ? new Date(newScheduledAt) : null;
    if (status === 'RESCHEDULED' && (
      !newAppointmentDate ||
      !Number.isFinite(newAppointmentDate.getTime()) ||
      newAppointmentDate <= new Date() ||
      newAppointmentDate.getSeconds() !== 0 ||
      newAppointmentDate.getMilliseconds() !== 0
    )) {
      return NextResponse.json({ error: 'กรุณาระบุวันและเวลาใหม่สำหรับการเลื่อนนัด' }, { status: 400 });
    }

    const appointment = await prisma.$transaction(async (transaction) => {
      const current = await transaction.appointment.findUnique({ 
        where: { id: appointmentId },
        include: { user: true }
      });
      
      if (!current || !['PENDING', 'CONFIRMED', 'RESCHEDULED', 'RESCHEDULE_REQUESTED'].includes(current.status)) {
        throw new RequestError('ไม่พบคิวหรือไม่สามารถเปลี่ยนสถานะคิวนี้ได้', 409);
      }

      if (status === 'CONFIRMED' && current.status === 'CONFIRMED') return current;

      if (status === 'RESCHEDULED') {
        if (!newAppointmentDate) throw new RequestError('กรุณาระบุวันและเวลาใหม่', 400);
        const currentKey = getBangkokSlot(current.scheduledAt);
        const targetKey = getBangkokSlot(newAppointmentDate);
        const isSameSlot = currentKey.date.getTime() === targetKey.date.getTime() && currentKey.time === targetKey.time;
        if (!isSameSlot && current.usesCapacity && current.hospitalId && !current.isWaitlisted) {
          await transaction.hospitalSlot.updateMany({
            where: {
              hospitalId: current.hospitalId,
              date: currentKey.date,
              time: currentKey.time,
              booked: { gt: 0 },
            },
            data: { booked: { decrement: 1 } },
          });
          await promoteWaitlistedAppointment(transaction, current.hospitalId, current.scheduledAt);
        }

        const updated = await transaction.appointment.updateMany({
          where: { id: appointmentId, status: current.status },
          data: {
            scheduledAt: newAppointmentDate,
            status: 'CONFIRMED',
            isWaitlisted: false,
            usesCapacity: isSameSlot && current.usesCapacity,
            notified7Days: false,
            notified3Days: false,
            notified1Day: false,
            notified1Hour: false,
          },
        });
        if (updated.count !== 1) throw new RequestError('คิวมีการเปลี่ยนแปลง กรุณาโหลดใหม่', 409);
        return transaction.appointment.findUnique({ where: { id: appointmentId }, include: { user: true } });
      }

      if (status === 'CONFIRMED' && current.isWaitlisted) {
        if (!current.hospitalId) throw new RequestError('คิวรออนุมัตินี้ไม่มีสถานพยาบาล', 409);
        const slotKey = getBangkokSlot(current.scheduledAt);
        const slot = await transaction.hospitalSlot.findUnique({
          where: { hospitalId_date_time: { hospitalId: current.hospitalId, date: slotKey.date, time: slotKey.time } },
        });
        if (!slot || slot.isClosed) throw new RequestError('รอบเวลานี้ปิดรับจองแล้ว', 409);
        const reservation = await transaction.hospitalSlot.updateMany({
          where: { id: slot.id, isClosed: false, booked: { lt: slot.capacity } },
          data: { booked: { increment: 1 } },
        });
        if (reservation.count !== 1) throw new RequestError('รอบเวลายังเต็ม ไม่สามารถอนุมัติคิวได้', 409);
      }

      const dataToUpdate = {
        status, 
        ...(status === 'CONFIRMED' ? {
          isWaitlisted: false,
          usesCapacity: current.isWaitlisted ? true : current.usesCapacity,
        } : {})
      };

      const statusUpdate = await transaction.appointment.updateMany({
        where: { id: appointmentId, status: current.status },
        data: dataToUpdate,
      });
      if (statusUpdate.count !== 1) throw new RequestError('คิวมีการเปลี่ยนแปลง กรุณาโหลดใหม่', 409);

      if (['CANCELLED', 'NO_SHOW'].includes(status) && current.hospitalId && current.usesCapacity && !current.isWaitlisted) {
        const slotKey = getBangkokSlot(current.scheduledAt);
        await transaction.hospitalSlot.updateMany({
          where: { hospitalId: current.hospitalId, date: slotKey.date, time: slotKey.time, booked: { gt: 0 } },
          data: { booked: { decrement: 1 } },
        });
        await promoteWaitlistedAppointment(transaction, current.hospitalId, current.scheduledAt);
      }

      return transaction.appointment.findUnique({ 
        where: { id: appointmentId },
        include: { user: true }
      });
    });

    if (status === 'RESCHEDULED' && appointment?.user) {
      const notification = await notifyAppointmentUpdate({
        user: appointment.user,
        appointment,
        title: 'แจ้งวันนัดฉีดวัคซีนใหม่ - พร้อมฉีด',
        message: 'เจ้าหน้าที่กำหนดวันนัดหมายใหม่ให้คุณแล้ว',
      });
      return NextResponse.json({ success: true, appointment, ...notification });
    }

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตสถานะนัดหมายได้' }, { status: 500 });
  }
}