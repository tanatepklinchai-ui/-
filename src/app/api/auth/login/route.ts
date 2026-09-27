// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth'; // 1. นำเข้า setSession
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้นี้ในระบบ' }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // 2. สร้าง Session และบันทึกลงใน HTTP-Only Cookie
    await setSession({
      id: user.id,
      role: user.role,
      email: user.email,
    });

    return NextResponse.json({
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 });
  }
}