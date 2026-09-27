import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function isAdmin() {
  const session = await getSession();
  return session?.role === 'ADMIN';
}

function parseDateOnly(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  try {
    const [hospitals, slots] = await Promise.all([
      prisma.hospital.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.hospitalSlot.findMany({
        where: { date: { gte: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`) } },
        include: { hospital: { select: { name: true } } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        take: 500,
      }),
    ]);
    return NextResponse.json({ hospitals, slots });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดรอบเวลาได้' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
  try {
    const body = await req.json();
    const date = parseDateOnly(body.date);
    const time = typeof body.time === 'string' ? body.time : '';
    const capacity = body.capacity;
    if (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      return NextResponse.json({ error: 'วันที่ เวลา หรือจำนวนคิวไม่ถูกต้อง' }, { status: 400 });
    }

    let hospitalId = typeof body.hospitalId === 'string' ? body.hospitalId : '';
    if (hospitalId) {
      const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
      if (!hospital) return NextResponse.json({ error: 'ไม่พบสถานพยาบาล' }, { status: 404 });
    } else if (typeof body.hospitalName === 'string' && body.hospitalName.trim()) {
      const hospital = await prisma.hospital.create({ data: { name: body.hospitalName.trim() }, select: { id: true } });
      hospitalId = hospital.id;
    } else {
      return NextResponse.json({ error: 'กรุณาเลือกหรือระบุสถานพยาบาล' }, { status: 400 });
    }

    const slot = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.hospitalSlot.findUnique({
        where: { hospitalId_date_time: { hospitalId, date, time } },
      });
      if (existing && capacity < existing.booked) {
        throw new Error('CAPACITY_BELOW_BOOKED');
      }
      if (existing) {
        return transaction.hospitalSlot.update({
          where: { id: existing.id },
          data: { capacity, isClosed: false },
        });
      }
      return transaction.hospitalSlot.create({ data: { hospitalId, date, time, capacity } });
    });
    return NextResponse.json({ success: true, slot }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'CAPACITY_BELOW_BOOKED') {
      return NextResponse.json({ error: 'จำนวนคิวต้องไม่น้อยกว่าจำนวนที่จองแล้ว' }, { status: 409 });
    }
    return NextResponse.json({ error: 'ไม่สามารถบันทึกรอบเวลาได้' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
  try {
    const body = await req.json();
    const { slotId, capacity, isClosed } = body;
    if (typeof slotId !== 'string' || (capacity === undefined && typeof isClosed !== 'boolean')) {
      return NextResponse.json({ error: 'ข้อมูลรอบเวลาไม่ถูกต้อง' }, { status: 400 });
    }
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) {
      return NextResponse.json({ error: 'จำนวนคิวต้องอยู่ระหว่าง 1 ถึง 500' }, { status: 400 });
    }
    const current = await prisma.hospitalSlot.findUnique({ where: { id: slotId } });
    if (!current) return NextResponse.json({ error: 'ไม่พบรอบเวลานี้' }, { status: 404 });
    if (capacity !== undefined && capacity < current.booked) {
      return NextResponse.json({ error: 'จำนวนคิวต้องไม่น้อยกว่าจำนวนที่จองแล้ว' }, { status: 409 });
    }
    const result = await prisma.hospitalSlot.updateMany({
      where: { id: slotId, booked: { lte: capacity ?? current.capacity } },
      data: { ...(capacity !== undefined ? { capacity } : {}), ...(typeof isClosed === 'boolean' ? { isClosed } : {}) },
    });
    if (result.count !== 1) return NextResponse.json({ error: 'รอบเวลามีการจองเปลี่ยนแปลง กรุณาลองอีกครั้ง' }, { status: 409 });
    const slot = await prisma.hospitalSlot.findUnique({ where: { id: slotId }, include: { hospital: { select: { name: true } } } });
    return NextResponse.json({ success: true, slot });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขรอบเวลาได้' }, { status: 500 });
  }
}
