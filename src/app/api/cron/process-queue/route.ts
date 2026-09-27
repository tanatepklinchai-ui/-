import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const now = new Date();

    // 1. แจ้งเตือนล่วงหน้า 1 วัน (ช่วง 23 - 25 ชั่วโมงข้างหน้า)
    const oneDayStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const oneDayEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const appts1Day = await prisma.appointment.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        notified1Day: false,
        scheduledAt: { gte: oneDayStart, lte: oneDayEnd }, // แก้เป็น scheduledAt
      },
      include: { user: true },
    });

    for (const appt of appts1Day) {
      if (appt.user?.email) {
        try {
          await resend.emails.send({
            from: 'PromChid <onboarding@resend.dev>',
            to: appt.user.email,
            subject: 'แจ้งเตือนนัดหมายฉีดวัคซีน (ล่วงหน้า 1 วัน) - พร้อมฉีด',
            // ตัด vaccineName ออก และใช้ scheduledAt
            html: `<p>สวัสดีคุณ ${appt.user.username}</p><p>คุณมีนัดเข้ารับบริการวัคซีนตามเกณฑ์ ณ ${appt.hospitalName} ในวันที่ ${new Date(appt.scheduledAt).toLocaleString('th-TH')}</p>`,
          });
          
          await prisma.appointment.update({
            where: { id: appt.id },
            data: { notified1Day: true },
          });
        } catch (emailError) {
          console.error(`Failed to send 1-day alert to ${appt.user.email}:`, emailError);
        }
      }
    }

    // 2. แจ้งเตือนล่วงหน้า 1 ชั่วโมง (ช่วง 50 - 70 นาทีข้างหน้า)
    const oneHourStart = new Date(now.getTime() + 50 * 60 * 1000);
    const oneHourEnd = new Date(now.getTime() + 70 * 60 * 1000);
    const appts1Hour = await prisma.appointment.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        notified1Hour: false,
        scheduledAt: { gte: oneHourStart, lte: oneHourEnd }, // แก้เป็น scheduledAt
      },
      include: { user: true },
    });

    for (const appt of appts1Hour) {
      if (appt.user?.email) {
        try {
          await resend.emails.send({
            from: 'PromChid <onboarding@resend.dev>',
            to: appt.user.email,
            subject: 'แจ้งเตือนนัดหมายฉีดวัคซีนด่วน (อีก 1 ชั่วโมง) - พร้อมฉีด',
            html: `<p>สวัสดีคุณ ${appt.user.username}</p><p>คุณมีนัดเข้ารับบริการในอีก 1 ชั่วโมงข้างหน้า ณ ${appt.hospitalName}</p>`,
          });
          
          await prisma.appointment.update({
            where: { id: appt.id },
            data: { notified1Hour: true },
          });
        } catch (emailError) {
          console.error(`Failed to send 1-hour alert to ${appt.user.email}:`, emailError);
        }
      }
    }

    // 3. เคลียร์คิวที่เลยกำหนดเกิน 1 ชั่วโมง (ไม่บันทึกประวัติวัคซีน)
    const expiredThreshold = new Date(now.getTime() - 60 * 60 * 1000);
    const expiredAppointments = await prisma.appointment.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { lt: expiredThreshold }, // แก้เป็น scheduledAt
      },
    });
    let expiredCount = 0;
    for (const appointment of expiredAppointments) {
      const expired = await prisma.$transaction(async (transaction) => {
        const result = await transaction.appointment.updateMany({
          where: { id: appointment.id, status: appointment.status },
          data: { status: 'EXPIRED' },
        });
        if (result.count !== 1) return false;

        if (appointment.hospitalId) {
          const timeParts = new Intl.DateTimeFormat('en', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
          }).formatToParts(appointment.scheduledAt);
          const values = Object.fromEntries(timeParts.map(({ type, value }) => [type, value]));
          const slotDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
          await transaction.hospitalSlot.updateMany({
            where: {
              hospitalId: appointment.hospitalId,
              date: slotDate,
              time: `${values.hour}:${values.minute}`,
              booked: { gt: 0 },
            },
            data: { booked: { decrement: 1 } },
          });
        }
        return true;
      });
      if (expired) expiredCount += 1;
    }

    return NextResponse.json({
      success: true,
      notified1DayCount: appts1Day.length,
      notified1HourCount: appts1Hour.length,
      expiredCount,
    });

  } catch (error: unknown) {
    console.error('Process queue error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการรันคิวแจ้งเตือน' },
      { status: 500 }
    );
  }
}