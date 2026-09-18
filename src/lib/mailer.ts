// src/lib/mailer.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// 1. อีเมลแจ้งเตือนล่วงหน้า (1 วัน / 1 ชั่วโมง)
export async function sendAppointmentReminder({
  to,
  userName,
  hospitalName,
  scheduledAt,
  type,
}: {
  to: string;
  userName: string;
  hospitalName: string;
  scheduledAt: Date;
  type: '1_DAY' | '1_HOUR';
}) {
  const formattedDate = new Date(scheduledAt).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const subject =
    type === '1_DAY'
      ? '🔔 แจ้งเตือนล่วงหน้า 1 วัน: นัดหมายฉีดวัคซีน - พร้อมฉีด'
      : '⚠️ แจ้งเตือนด่วน 1 ชั่วโมง: เตรียมนัดหมายฉีดวัคซีน - พร้อมฉีด';

  return await resend.emails.send({
    from: 'พร้อมฉีด <onboarding@resend.dev>',
    to: [to],
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #f1f5f9; border-radius: 16px; background-color: #ffffff;">
        <h2 style="color: #0d9488; margin-top: 0;">ระบบพร้อมฉีด (PromChid)</h2>
        <p style="color: #334155; font-size: 15px;">สวัสดีคุณ <strong>${userName}</strong></p>
        <p style="color: #475569; font-size: 14px;">
          คุณมีนัดหมายเข้ารับการฉีดวัคซีนในอีก <strong>${type === '1_DAY' ? '1 วัน' : '1 ชั่วโมง'}</strong>
        </p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 14px; color: #1e293b;">🏥 <strong>สถานพยาบาล:</strong> ${hospitalName}</p>
          <p style="margin: 4px 0; font-size: 14px; color: #1e293b;">🗓️ <strong>วัน-เวลานัด:</strong> ${formattedDate} น.</p>
        </div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
          * กรุณาเดินทางไปถึงก่อนเวลานัดหมาย และกดยืนยันการรับวัคซีนในระบบหลังรับบริการ<br/>
          * ระบบจะตัดคิวนัดอัตโนมัติหากเลยเวลานัดเกิน 1 ชั่วโมงโดยไม่มีการยืนยัน
        </p>
      </div>
    `,
  });
}

// 2. อีเมลยืนยันทันทีหลังกดจองสำเร็จ
export async function sendBookingConfirmation({
  to,
  userName,
  hospitalName,
  scheduledAt,
}: {
  to: string;
  userName: string;
  hospitalName: string;
  scheduledAt: Date;
}) {
  const formattedDate = new Date(scheduledAt).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return await resend.emails.send({
    from: 'พร้อมฉีด <onboarding@resend.dev>',
    to: [to],
    subject: '✅ ยืนยันการนัดหมายฉีดวัคซีนสำเร็จ - พร้อมฉีด',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <h2 style="color: #0d9488; margin-top: 0;">นัดหมายสำเร็จ</h2>
        <p style="color: #334155;">สวัสดีคุณ <strong>${userName}</strong></p>
        <p style="color: #475569;">ระบบได้รับการนัดหมายฉีดวัคซีนของคุณเรียบร้อยแล้ว รายละเอียดดังนี้:</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #1e293b;">🏥 <strong>สถานที่:</strong> ${hospitalName}</p>
          <p style="margin: 4px 0; color: #1e293b;">🗓️ <strong>วัน-เวลานัด:</strong> ${formattedDate} น.</p>
        </div>
        <p style="font-size: 12px; color: #64748b;">ระบบจะส่งการแจ้งเตือนล่วงหน้าให้อีกครั้งก่อนถึงเวลานัด 24 ชั่วโมง และ 1 ชั่วโมง</p>
      </div>
    `,
  });
}