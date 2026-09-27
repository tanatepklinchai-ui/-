import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
    const { appointmentId, status } = body;
    if (typeof appointmentId !== 'string' || !['CONFIRMED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'ข้อมูลการจัดการคิวไม่ถูกต้อง' }, { status: 400 });
    }
    const appointment = await prisma.$transaction(async (transaction) => {
      const current = await transaction.appointment.findUnique({ where: { id: appointmentId } });
      if (!current || !['PENDING', 'CONFIRMED'].includes(current.status)) {
        throw new RequestError('ไม่พบคิวหรือไม่สามารถเปลี่ยนสถานะคิวนี้ได้', 409);
      }

      if (status === 'CONFIRMED' && current.status === 'CONFIRMED') return current;

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

      const statusUpdate = await transaction.appointment.updateMany({
        where: { id: appointmentId, status: current.status, isWaitlisted: current.isWaitlisted },
        data: { status, ...(status === 'CONFIRMED' ? { isWaitlisted: false } : {}) },
      });
      if (statusUpdate.count !== 1) throw new RequestError('คิวมีการเปลี่ยนแปลง กรุณาโหลดใหม่', 409);

      if (status === 'CANCELLED' && current.hospitalId && !current.isWaitlisted) {
        if (!current.isWaitlisted) {
          const slotKey = getBangkokSlot(current.scheduledAt);
          await transaction.hospitalSlot.updateMany({
            where: { hospitalId: current.hospitalId, date: slotKey.date, time: slotKey.time, booked: { gt: 0 } },
            data: { booked: { decrement: 1 } },
          });
        }
      }
      return transaction.appointment.findUnique({ where: { id: appointmentId } });
    });
    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตสถานะนัดหมายได้' }, { status: 500 });
  }
}
