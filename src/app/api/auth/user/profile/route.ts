// src/app/api/user/profile/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth'; // นำเข้า getSession
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.userId },
  });

  const vaccines = await prisma.vaccineRecord.findMany({
    where: { userId: session.userId },
    orderBy: { administeredDate: 'desc' },
  });

  return NextResponse.json({ profile, vaccines });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'ข้อมูลโปรไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }

  const dob = typeof data.dob === 'string' ? new Date(data.dob) : null;
  if (!dob || !Number.isFinite(dob.getTime()) || dob > new Date()) {
    return NextResponse.json({ error: 'กรุณาระบุวันเกิดที่ถูกต้อง' }, { status: 400 });
  }

  const parseOptionalNumber = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
  };

  const firstName = typeof data.firstName === 'string' ? data.firstName.trim() : undefined;
  const lastName = typeof data.lastName === 'string' ? data.lastName.trim() : undefined;
  const gender = typeof data.gender === 'string' ? data.gender : undefined;
  const weight = parseOptionalNumber(data.weight);
  const height = parseOptionalNumber(data.height);

  const profile = await prisma.profile.upsert({
    where: { userId: session.userId },
    update: {
      firstName,
      lastName,
      gender,
      weight,
      height,
      dob,
    },
    create: {
      userId: session.userId,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      gender: gender ?? null,
      weight: weight ?? null,
      height: height ?? null,
      dob,
    },
  });

  return NextResponse.json({ success: true, profile });
}