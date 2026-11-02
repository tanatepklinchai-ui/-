import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

class ResetRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('token' in body) ||
      typeof body.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.token) ||
      !('password' in body) ||
      typeof body.password !== 'string' ||
      body.password.length < 8 ||
      body.password.length > 128
    ) {
      return NextResponse.json({ error: 'ลิงก์หรือรหัสผ่านไม่ถูกต้อง (รหัสผ่านต้องมี 8-128 ตัวอักษร)' }, { status: 400 });
    }

    const tokenHash = createHash('sha256').update(body.token).digest('hex');
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true },
    });
    const now = new Date();
    if (!resetToken || resetToken.expiresAt <= now) {
      throw new ResetRequestError('ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่', 400);
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: resetToken.id, tokenHash, expiresAt: { gt: new Date() } },
        data: { expiresAt: now },
      });
      if (consumed.count !== 1) {
        throw new ResetRequestError('ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่', 400);
      }

      await transaction.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      await transaction.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } });
    });

    return NextResponse.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง' });
  } catch (error) {
    if (error instanceof ResetRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to reset password:', error);
    return NextResponse.json({ error: 'ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}
