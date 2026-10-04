import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'PromChid <onboarding@resend.dev>',
        to,
        subject,
        html,
      });
      if (result.error) throw result.error;
      console.log('Email sent with Resend:', result.data?.id);
      return true;
    } catch (error) {
      console.error('Error sending email with Resend:', error);
      return false;
    }
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('Email is not configured. Set RESEND_API_KEY or both GMAIL_USER and GMAIL_APP_PASSWORD.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    const info = await transporter.sendMail({
      from: `"ระบบพร้อมฉีด (PromChid)" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('Email sent: ', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}