// src/app/api/cron/process-queue/route.ts
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer'; // 👈 1. เปลี่ยนมานำเข้า sendEmail ของเรา
import { isExpiredWebPushError, isWebPushConfigured, sendWebPushNotification } from '@/lib/webPush';
import { getPublicAppUrl } from '@/lib/appointmentNotifications';

export const dynamic = 'force-dynamic';

function getBangkokReminderWindow(daysBefore: number, now: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const targetDate = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) - daysBefore
  ));
  const start = new Date(targetDate.getTime() - 7 * 60 * 60 * 1000);
  return { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

async function promoteWaitlistedAppointment(transaction: Prisma.TransactionClient, hospitalId: string, scheduledAt: Date) {
  const slotKey = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(scheduledAt);
  const values = Object.fromEntries(slotKey.map(({ type, value }) => [type, value]));
  const slotDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const slotTime = `${values.hour}:${values.minute}`;
  const slot = await transaction.hospitalSlot.findUnique({
    where: { hospitalId_date_time: { hospitalId, date: slotDate, time: slotTime } },
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

async function sendAppointmentReminders(now: Date) {
  const reminders = [
    { days: 7, flag: 'notified7Days', title: '🔔 แจ้งเตือน: อีก 7 วันคุณมีนัดฉีดวัคซีน - พร้อมฉีด' },
    { days: 3, flag: 'notified3Days', title: '🔔 แจ้งเตือน: อีก 3 วันคุณมีนัดฉีดวัคซีน - พร้อมฉีด' },
    { days: 1, flag: 'notified1Day', title: '⏰ พรุ่งนี้คุณมีนัดฉีดวัคซีน - พร้อมฉีด' },
  ] as const;
  const counts = { notified7DaysCount: 0, notified3DaysCount: 0, notified1DayCount: 0 };

  for (const reminder of reminders) {
    const appointments = await prisma.appointment.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        [reminder.flag]: false,
        scheduledAt: getBangkokReminderWindow(reminder.days, now),
      },
      include: { user: { include: { pushSubscriptions: true } } },
    });
    let notifiedCount = 0;

    for (const appointment of appointments) {
      const targetEmail = appointment.user.notificationEmail || appointment.user.email;
      const appUrl = getPublicAppUrl();
      let delivered = false;

      if (targetEmail && appUrl) {
        try {
          const emailDelivered = await sendEmail({
            to: targetEmail,
            subject: reminder.title,
            html: `<div style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #0d9488;">ระบบพร้อมฉีด (PromChid)</h2>
              <p>สวัสดีคุณ <strong>${appointment.user.username}</strong></p>
              <p>คุณมีนัดหมายเข้ารับการฉีดวัคซีนในอีก <strong>${reminder.days} วัน</strong></p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 10px; margin: 15px 0;">
                <p>🏥 <strong>สถานที่:</strong> ${appointment.hospitalName}</p>
                <p>🗓️ <strong>วัน-เวลา:</strong> ${new Date(appointment.scheduledAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} น.</p>
              </div>
              <p style="color: #64748b; font-size: 13px;">กรุณาเตรียมสมุดวัคซีนและเดินทางไปถึงก่อนเวลานัดหมาย 15 นาที</p>
              <p><a href="${appUrl}/user/dashboard?tab=appointments">ดูหรือจัดการนัดหมาย</a></p>
            </div>`,
          });
          delivered = emailDelivered;
        } catch (error) {
          console.error(`Failed to send ${reminder.days}-day appointment email reminder:`, error);
        }
      }

      if (isWebPushConfigured()) {
        for (const subscription of appointment.user.pushSubscriptions) {
          try {
            await sendWebPushNotification(subscription, {
              title: reminder.title,
              body: `คุณมีนัดรับวัคซีนในอีก ${reminder.days} วัน`,
              url: '/user/dashboard?tab=appointments',
            });
            delivered = true;
          } catch (error) {
            console.error(`Failed to send ${reminder.days}-day appointment push reminder:`, error);
            if (isExpiredWebPushError(error)) {
              try {
                await prisma.webPushSubscription.deleteMany({ where: { id: subscription.id } });
              } catch (cleanupError) {
                console.error('Failed to remove expired Web Push subscription:', cleanupError);
              }
            }
          }
        }
      }

      if (delivered) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { [reminder.flag]: true },
        });
        notifiedCount += 1;
      }
    }

    if (reminder.days === 7) counts.notified7DaysCount = notifiedCount;
    if (reminder.days === 3) counts.notified3DaysCount = notifiedCount;
    if (reminder.days === 1) counts.notified1DayCount = notifiedCount;
  }

  return counts;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const reminderCounts = await sendAppointmentReminders(now);

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
        if (appointment.hospitalId && appointment.usesCapacity && !appointment.isWaitlisted) {
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
          await promoteWaitlistedAppointment(transaction, appointment.hospitalId, appointment.scheduledAt);
        }
        return true;
      });
      if (expired) expiredCount += 1;
    }

    return NextResponse.json({ success: true, ...reminderCounts, expiredCount });
  } catch {
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการรันคิวแจ้งเตือน' }, { status: 500 });
  }
}