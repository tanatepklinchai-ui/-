// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const { email, username, password, adminCode } = await req.json();

    // 1. ตรวจสอบว่ามีอีเมลหรือชื่อผู้ใช้นี้ในระบบแล้วหรือไม่
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'อีเมลหรือชื่อผู้ใช้นี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Admin registration requires deployment-only environment configuration.
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const configuredAdminCode = process.env.ADMIN_REGISTRATION_CODE;
    const role = configuredAdminEmail && configuredAdminCode &&
      email.trim().toLowerCase() === configuredAdminEmail && adminCode === configuredAdminCode
      ? 'ADMIN'
      : 'USER';

    // 3. แฮชรหัสผ่านเพื่อความปลอดภัย
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. บันทึกข้อมูลลงในฐานข้อมูล
    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role,
      },
    });

    return NextResponse.json(
      {
        message: 'ลงทะเบียนสำเร็จ',
        user: { id: newUser.id, email: newUser.email, username: newUser.username, role: newUser.role },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลงทะเบียน' },
      { status: 500 }
    );
  }
}