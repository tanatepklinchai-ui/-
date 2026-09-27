import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูลเด็ก' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { firstName, lastName, gender, dob, weight, height } = body;
    const birthDate = typeof dob === 'string' ? new Date(dob) : null;
    const parsedWeight = parseMeasurement(weight);
    const parsedHeight = parseMeasurement(height);

    if (
      !birthDate || !Number.isFinite(birthDate.getTime()) || birthDate > new Date() ||
      parsedWeight === undefined || parsedHeight === undefined ||
      (firstName !== undefined && typeof firstName !== 'string') ||
      (lastName !== undefined && typeof lastName !== 'string') ||
      (gender !== undefined && typeof gender !== 'string')
    ) {
      return NextResponse.json({ error: 'ข้อมูลเด็กไม่ถูกต้อง' }, { status: 400 });
    }

    const existingChild = await prisma.child.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });
    if (!existingChild) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });
    }

    const child = await prisma.child.update({
      where: { id },
      data: {
        firstName: typeof firstName === 'string' ? firstName.trim() || null : null,
        lastName: typeof lastName === 'string' ? lastName.trim() || null : null,
        gender: typeof gender === 'string' ? gender : null,
        dob: birthDate,
        weight: parsedWeight,
        height: parsedHeight,
      },
    });

    return NextResponse.json({ success: true, child });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถบันทึกข้อมูลเด็กได้' }, { status: 500 });
  }
}

function parseMeasurement(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsedValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}