// src/app/api/cron/process-queue/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAppointmentReminder } from '@/lib/mailer';

export async function GET() {
  const now = new Date();

  // 1. แจ้งเตือนล่วงหน้า 1 วัน (23.5 - 24.5 ชม. ก่อนนัด)
  const oneDayStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const oneDayEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  const dueOneDay = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: oneDayStart, lte: oneDayEnd },
      notified1Day: false,
      status: 'PENDING',
    },
    include: { user: true },
  });

  for (const appt of dueOneDay) {
    await sendAppointmentReminder({
      to: appt.user.email,
      userName: appt.user.username,
      hospitalName: appt.hospitalName,
      scheduledAt: appt.scheduledAt,
      type: '1_DAY',
    });
    await prisma.appointment.update({ where: { id: appt.id }, data: { notified1Day: true } });
  }

  // 2. แจ้งเตือนล่วงหน้า 1 ชั่วโมง (50 - 70 นาที ก่อนนัด)
  const oneHourStart = new Date(now.getTime() + 50 * 60 * 1000);
  const oneHourEnd = new Date(now.getTime() + 70 * 60 * 1000);

  const dueOneHour = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: oneHourStart, lte: oneHourEnd },
      notified1Hour: false,
      status: 'PENDING',
    },
    include: { user: true },
  });

  for (const appt of dueOneHour) {
    await sendAppointmentReminder({
      to: appt.user.email,
      userName: appt.user.username,
      hospitalName: appt.hospitalName,
      scheduledAt: appt.scheduledAt,
      type: '1_HOUR',
    });
    await prisma.appointment.update({ where: { id: appt.id }, data: { notified1Hour: true } });
  }

  // 3. เคลียร์คิวอัตโนมัติ: เลยเวลานัดเกิน 1 ชั่วโมง และยังไม่ได้รับการยืนยัน
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const expiredCount = await prisma.appointment.updateMany({
    where: {
      scheduledAt: { lt: oneHourAgo },
      status: 'PENDING',
    },
    data: {
      status: 'EXPIRED', // ไม่บันทึกประวัติวัคซีน
    },
  });

  return NextResponse.json({
    success: true,
    sent1Day: dueOneDay.length,
    sent1Hour: dueOneHour.length,
    expiredQueues: expiredCount.count,
  });
}