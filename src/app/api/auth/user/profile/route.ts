// src/app/api/user/profile/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth'; // นำเข้า getSession
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
  }

  const childId = new URL(req.url).searchParams.get('childId');
  if (!childId) {
    return NextResponse.json({ error: 'กรุณาระบุ childId' }, { status: 400 });
  }

  const child = await prisma.child.findFirst({
    where: { id: childId, userId: session.userId },
    include: { vaccineRecords: { orderBy: { administeredDate: 'desc' } } },
  });
  if (!child) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });
  }

  const { vaccineRecords, ...profile } = child;
  return NextResponse.json({ profile, vaccines: vaccineRecords });
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

  const { childId, firstName, lastName, gender, dob, weight, height } = data;
  const birthDate = typeof dob === 'string' ? new Date(dob) : null;
  const parsedWeight = parseMeasurement(weight);
  const parsedHeight = parseMeasurement(height);
  if (
    typeof childId !== 'string' ||
    !birthDate || !Number.isFinite(birthDate.getTime()) || birthDate > new Date() ||
    parsedWeight === undefined || parsedHeight === undefined ||
    (firstName !== undefined && typeof firstName !== 'string') ||
    (lastName !== undefined && typeof lastName !== 'string') ||
    (gender !== undefined && typeof gender !== 'string')
  ) {
    return NextResponse.json({ error: 'ข้อมูลโปรไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }

  const child = await prisma.child.findFirst({
    where: { id: childId, userId: session.userId },
    select: { id: true },
  });
  if (!child) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });
  }

  const profile = await prisma.child.update({
    where: { id: childId },
    data: {
      firstName: typeof firstName === 'string' ? firstName.trim() || null : null,
      lastName: typeof lastName === 'string' ? lastName.trim() || null : null,
      gender: typeof gender === 'string' ? gender : null,
      weight: parsedWeight,
      height: parsedHeight,
      dob: birthDate,
    },
  });

  return NextResponse.json({ success: true, profile });
}

function parseMeasurement(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsedValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}