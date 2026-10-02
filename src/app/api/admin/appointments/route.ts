// src/app/api/admin/appointments/route.ts
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mailer'; // 👈 1. เปลี่ยนมานำเข้า sendEmail ของเรา

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
    
    if (typeof appointmentId !== 'string' || !['CONFIRMED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'].includes(status)) {
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
        if (!current.hospitalId || !newAppointmentDate) {
          throw new RequestError('นัดหมายนี้ไม่มีสถานพยาบาลสำหรับกำหนดวันใหม่', 409);
        }

        const targetKey = getBangkokSlot(newAppointmentDate);
        const targetSlot = await transaction.hospitalSlot.findUnique({
          where: { hospitalId_date_time: { hospitalId: current.hospitalId, date: targetKey.date, time: targetKey.time } },
        });
        if (!targetSlot || targetSlot.isClosed || !targetSlot.isAdminDefined) {
          throw new RequestError('วันและเวลานี้ไม่ได้เปิดรับจอง', 409);
        }

        const currentKey = getBangkokSlot(current.scheduledAt);
        const isSameSlot = currentKey.date.getTime() === targetKey.date.getTime() && currentKey.time === targetKey.time;
        const retainsCurrentSeat = !current.isWaitlisted && current.status !== 'RESCHEDULED';
        if (!(isSameSlot && retainsCurrentSeat)) {
          const reservation = await transaction.hospitalSlot.updateMany({
            where: { id: targetSlot.id, isClosed: false, booked: { lt: targetSlot.capacity } },
            data: { booked: { increment: 1 } },
          });
          if (reservation.count !== 1) throw new RequestError('รอบเวลาใหม่เต็มแล้ว กรุณาเลือกเวลาอื่น', 409);
        }

        if (!isSameSlot && retainsCurrentSeat) {
          await transaction.hospitalSlot.updateMany({
            where: {
              hospitalId: current.hospitalId,
              date: currentKey.date,
              time: currentKey.time,
              booked: { gt: 0 },
            },
            data: { booked: { decrement: 1 } },
          });
        }

        const updated = await transaction.appointment.updateMany({
          where: { id: appointmentId, status: current.status },
          data: {
            scheduledAt: newAppointmentDate,
            status: 'CONFIRMED',
            isWaitlisted: false,
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
        ...(status === 'CONFIRMED' ? { isWaitlisted: false } : {}) 
      };

      const statusUpdate = await transaction.appointment.updateMany({
        where: { id: appointmentId, status: current.status },
        data: dataToUpdate,
      });
      if (statusUpdate.count !== 1) throw new RequestError('คิวมีการเปลี่ยนแปลง กรุณาโหลดใหม่', 409);

      if (['CANCELLED', 'NO_SHOW'].includes(status) && current.hospitalId && !current.isWaitlisted) {
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
      const targetEmail = appointment.user.notificationEmail || appointment.user.email;
      if (targetEmail) {
        const formattedDate = new Date(appointment.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
        try {
          await sendEmail({
            to: targetEmail,
            subject: '🗓️ แจ้งวันนัดฉีดวัคซีนใหม่ - พร้อมฉีด',
            html: `
              <div style="font-family: sans-serif; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #0d9488; margin-top: 0;">ระบบพร้อมฉีด (PromChid)</h2>
                <p>สวัสดีคุณ <strong>${appointment.user.username}</strong></p>
                <p>เจ้าหน้าที่กำหนดวันนัดหมายใหม่ของคุณที่ <strong>${appointment.hospitalName}</strong> เรียบร้อยแล้ว:</p>
                <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 4px 0;">🗓️ <strong>วัน-เวลานัดใหม่:</strong> ${formattedDate} น.</p>
                </div>
                <p style="font-size: 13px; color: #64748b;">หากมีข้อสงสัย กรุณาติดต่อสถานพยาบาลตามข้อมูลนัดหมาย</p>
              </div>
            `
          });
        } catch (err) {
          console.error('Failed to send reschedule email:', err);
        }
      }
    }

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตสถานะนัดหมายได้' }, { status: 500 });
  }
}