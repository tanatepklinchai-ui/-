// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

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

    // 2. มอบสิทธิ์ ADMIN ตามเงื่อนไขที่กำหนด
    const role = (email === 'poomg900@gmail.com' && adminCode === 'admin0399')
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน' }, { status: 500 });
  }
}