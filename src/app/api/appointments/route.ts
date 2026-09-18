// src/app/api/appointments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth'; // นำเข้า getSession
// ในฟังก์ชัน POST ของ src/app/api/appointments/route.ts
import { sendBookingConfirmation } from '@/lib/mailer';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำนัดหมาย' }, { status: 401 });
    }

    const { hospitalName, scheduledAt } = await req.json();

    if (!hospitalName || !scheduledAt) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId: session.userId, // บันทึกด้วย User ID จริงจาก Session
        hospitalName,
        scheduledAt: new Date(scheduledAt),
        status: 'PENDING',
      },
    });
sendBookingConfirmation({
  to: session.email,
  userName: session.email.split('@')[0],
  hospitalName,
  scheduledAt: new Date(scheduledAt),
}).catch((err) => console.error('Email confirmation error:', err));

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'บันทึกนัดหมายไม่สำเร็จ' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ดึงเฉพาะคิวที่เป็นของ User คนนี้เท่านั้น
    const appointments = await prisma.appointment.findMany({
      where: { userId: session.userId },
      orderBy: { scheduledAt: 'desc' },
    });

    return NextResponse.json({ appointments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}