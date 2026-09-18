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

  const data = await req.json();

  const profile = await prisma.profile.upsert({
    where: { userId: session.userId },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      weight: parseFloat(data.weight),
      height: parseFloat(data.height),
      dob: new Date(data.dob),
    },
    create: {
      userId: session.userId,
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      weight: parseFloat(data.weight),
      height: parseFloat(data.height),
      dob: new Date(data.dob),
    },
  });

  return NextResponse.json({ success: true, profile });
}