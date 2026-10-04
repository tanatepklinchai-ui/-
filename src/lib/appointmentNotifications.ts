import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { isExpiredWebPushError, isWebPushConfigured, sendWebPushNotification } from '@/lib/webPush';

type NotificationUser = {
  id: string;
  email: string;
  notificationEmail: string | null;
  username: string;
};

type AppointmentNotification = {
  hospitalName: string;
  scheduledAt: Date;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  return null;
}

export async function notifyAppointmentUpdate({
  user,
  appointment,
  title,
  message,
}: {
  user: NotificationUser;
  appointment: AppointmentNotification;
  title: string;
  message: string;
}) {
  const appUrl = getPublicAppUrl();
  const appointmentUrl = appUrl ? `${appUrl}/user/dashboard?tab=appointments` : null;
  const targetEmail = user.notificationEmail || user.email;
  let emailSent = false;

  if (targetEmail && appointmentUrl) {
    const formattedDate = new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(appointment.scheduledAt);
    emailSent = await sendEmail({
      to: targetEmail,
      subject: title,
      html: `<div style="font-family: sans-serif; padding: 20px; max-width: 520px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0d9488;">ระบบพร้อมฉีด (PromChid)</h2>
        <p>สวัสดีคุณ <strong>${escapeHtml(user.username)}</strong></p>
        <p>${escapeHtml(message)}</p>
        <p><strong>สถานพยาบาล:</strong> ${escapeHtml(appointment.hospitalName)}</p>
        <p><strong>วันและเวลา:</strong> ${escapeHtml(formattedDate)} น.</p>
        <p><a href="${escapeHtml(appointmentUrl)}" style="display: inline-block; padding: 12px 18px; color: #fff; background: #0d9488; border-radius: 8px; text-decoration: none;">ดูหรือจัดการนัดหมาย</a></p>
      </div>`,
    });
  }

  let webPushSent = false;
  if (isWebPushConfigured()) {
    try {
      const subscriptions = await prisma.webPushSubscription.findMany({
        where: { userId: user.id },
      });
      for (const subscription of subscriptions) {
        try {
          await sendWebPushNotification(subscription, {
            title,
            body: `${message} ${new Intl.DateTimeFormat('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Bangkok',
            }).format(appointment.scheduledAt)} น.`,
            url: '/user/dashboard?tab=appointments',
          });
          webPushSent = true;
        } catch (error) {
          console.error('Failed to send appointment Web Push notification:', error);
          if (isExpiredWebPushError(error)) {
            try {
              await prisma.webPushSubscription.deleteMany({ where: { id: subscription.id } });
            } catch (cleanupError) {
              console.error('Failed to remove expired Web Push subscription:', cleanupError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load Web Push subscriptions for appointment notification:', error);
    }
  }

  return { emailSent, webPushSent, delivered: emailSent || webPushSent };
}
