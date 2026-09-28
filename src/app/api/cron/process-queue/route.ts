// src/app/api/cron/process-queue/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer'; // 👈 1. เปลี่ยนมานำเข้า sendEmail ของเรา

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // 1. แจ้งเตือนล่วงหน้า 3 วัน (ช่วง 71 - 73 ชั่วโมงข้างหน้า)
    const threeDaysStart = new Date(now.getTime() + 71 * 60 * 60 * 1000);
    const threeDaysEnd = new Date(now.getTime() + 73 * 60 * 60 * 1000);
    const appts3Days = await prisma.appointment.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        notified3Days: false,
        scheduledAt: { gte: threeDaysStart, lte: threeDaysEnd },
      },
      include: { user: true },
    });

    for (const appt of appts3Days) {
      const targetEmail = appt.user.notificationEmail || appt.user.email;
      if (targetEmail) {
        try {
          // 👉 2. เปลี่ยนมาใช้ sendEmail แทน resend.emails.send
          await sendEmail({
            to: targetEmail,
            subject: '🔔 แจ้งเตือน: อีก 3 วันคุณมีนัดฉีดวัคซีน - พร้อมฉีด',
            html: `<div style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #0d9488;">ระบบพร้อมฉีด (PromChid)</h2>
              <p>สวัสดีคุณ <strong>${appt.user.username}</strong></p>
              <p>คุณมีนัดหมายเข้ารับการฉีดวัคซีนในอีก <strong>3 วันข้างหน้า</strong></p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 10px; margin: 15px 0;">
                <p>🏥 <strong>สถานที่:</strong> ${appt.hospitalName}</p>
                <p>🗓️ <strong>วัน-เวลา:</strong> ${new Date(appt.scheduledAt).toLocaleString('th-TH')} น.</p>
              </div>
              <p style="color: #64748b; font-size: 13px;">กรุณาเตรียมสมุดวัคซีนสีชมพูให้พร้อม และเดินทางไปถึงก่อนเวลานัดหมาย 15 นาทีครับ</p>
            </div>`,
          });
          
          await prisma.appointment.update({
            where: { id: appt.id },
            data: { notified3Days: true },
          });
        } catch (err) {
          console.error(`Failed to send 3-day alert:`, err);
        }
      }
    }

    // 2. แจ้งเตือนล่วงหน้า 1 วัน (ช่วง 23 - 25 ชั่วโมงข้างหน้า)
    const oneDayStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const oneDayEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const appts1Day = await prisma.appointment.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        notified1Day: false,
        scheduledAt: { gte: oneDayStart, lte: oneDayEnd },
      },
      include: { user: true },
    });

    for (const appt of appts1Day) {
      const targetEmail = appt.user.notificationEmail || appt.user.email;
      if (targetEmail) {
        try {
          // 👉 3. เปลี่ยนมาใช้ sendEmail สำหรับแจ้งเตือน 1 วัน
          await sendEmail({
            to: targetEmail,
            subject: '⏰ พรุ่งนี้คุณมีนัดฉีดวัคซีน - พร้อมฉีด',
            html: `<div style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #0d9488;">ระบบพร้อมฉีด (PromChid)</h2>
              <p>สวัสดีคุณ <strong>${appt.user.username}</strong></p>
              <p>พรุ่งนี้คุณมีนัดเข้ารับการฉีดวัคซีนแล้วครับ!</p>
              <div style="background-color: #fffbeb; padding: 15px; border-radius: 10px; margin: 15px 0; border: 1px solid #fde68a;">
                <p>🏥 <strong>สถานที่:</strong> ${appt.hospitalName}</p>
                <p>🗓️ <strong>วัน-เวลา:</strong> ${new Date(appt.scheduledAt).toLocaleString('th-TH')} น.</p>
              </div>
              <p style="color: #64748b; font-size: 13px;">ขอให้เดินทางปลอดภัยครับ</p>
            </div>`,
          });
          
          await prisma.appointment.update({
            where: { id: appt.id },
            data: { notified1Day: true },
          });
        } catch (err) {
          console.error(`Failed to send 1-day alert:`, err);
        }
      }
    }

    // 3. เคลียร์คิวที่เลยกำหนดเกิน 1 ชั่วโมง
    const expiredThreshold = new Date(now.getTime() - 60 * 60 * 1000);
    const expiredAppointments = await prisma.appointment.findMany({
      where: { status: { in: ['PENDING', 'CONFIRMED'] }, scheduledAt: { lt: expiredThreshold } },
    });
    let expiredCount = 0;
    for (const appointment of expiredAppointments) {
      const expired = await prisma.$transaction(async (transaction) => {
        const result = await transaction.appointment.updateMany({
          where: { id: appointment.id, status: appointment.status },
          data: { status: 'EXPIRED' },
        });
        if (result.count !== 1) return false;
        if (appointment.hospitalId && !appointment.isWaitlisted) {
          const timeParts = new Intl.DateTimeFormat('en', {
            timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
          }).formatToParts(appointment.scheduledAt);
          const values = Object.fromEntries(timeParts.map(({ type, value }) => [type, value]));
          const slotDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
          await transaction.hospitalSlot.updateMany({
            where: { hospitalId: appointment.hospitalId, date: slotDate, time: `${values.hour}:${values.minute}`, booked: { gt: 0 } },
            data: { booked: { decrement: 1 } },
          });
        }
        return true;
      });
      if (expired) expiredCount += 1;
    }

    return NextResponse.json({ success: true, notified3DaysCount: appts3Days.length, notified1DayCount: appts1Day.length, expiredCount });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการรันคิวแจ้งเตือน' }, { status: 500 });
  }
}