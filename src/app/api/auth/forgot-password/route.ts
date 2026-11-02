import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const GENERIC_RESPONSE = {
  message: 'หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้',
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null || !('email' in body) || typeof body.email !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุอีเมลที่ถูกต้อง' }, { status: 400 });
    }

    const email = body.email.trim().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'กรุณาระบุอีเมลที่ถูกต้อง' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    if (!user) return NextResponse.json(GENERIC_RESPONSE);

    const siteUrl = process.env.NEXTAUTH_URL;
    if (!siteUrl) {
      console.error('Password reset email not sent because NEXTAUTH_URL is not configured.');
      return NextResponse.json(GENERIC_RESPONSE);
    }
    let resetUrl: URL;
    try {
      resetUrl = new URL('/reset-password', siteUrl);
    } catch (error) {
      console.error('Password reset email not sent because NEXTAUTH_URL is invalid:', error);
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    });
    if (recentToken) return NextResponse.json(GENERIC_RESPONSE);

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    await prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await transaction.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });
    });

    resetUrl.searchParams.set('token', token);
    const emailSent = await sendEmail({
      to: user.email,
      subject: 'ตั้งรหัสผ่านใหม่สำหรับพร้อมฉีด',
      html: `<p>มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีพร้อมฉีด</p><p><a href="${resetUrl.toString()}">ตั้งรหัสผ่านใหม่</a></p><p>ลิงก์นี้ใช้ได้ 30 นาที หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้</p>`,
    });
    if (!emailSent) {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('Unable to process password reset request:', error);
    return NextResponse.json({ error: 'ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}
