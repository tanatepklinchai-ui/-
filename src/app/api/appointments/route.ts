// src/app/api/appointments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ดึงรายการนัดหมาย
export async function GET() {
  try {
    const appointments = await prisma.appointment.findMany({
      orderBy: { scheduledAt: 'asc' }
    });
    return NextResponse.json({ appointments });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
  }
}

// สร้างนัดหมายใหม่
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { hospitalName, scheduledAt } = body;

    const newAppointment = await prisma.appointment.create({
      data: {
        hospitalName,
        scheduledAt: new Date(scheduledAt),
        status: 'PENDING',
        // สมมติฐาน: เชื่อมกับ user คนที่ล็อกอินอยู่ (ปรับแก้ userId ตามระบบ Auth ของคุณ)
        userId: "ID_ของผู้ใช้งาน" 
      },
    });

    return NextResponse.json({ success: true, appointment: newAppointment });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 });
  }
}