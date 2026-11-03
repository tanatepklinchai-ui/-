import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { recordUserActivity } from '@/lib/userActivity';
import { permanentlyDeleteChild } from '@/lib/appointmentCapacity';

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
    if (body?.action === 'restore') {
      const restored = await prisma.$transaction(async (transaction) => {
        const result = await transaction.child.updateMany({
          where: { id, userId: session.userId, archivedAt: { not: null } },
          data: { archivedAt: null },
        });
        if (result.count !== 1) return false;
        await recordUserActivity(transaction, session.userId, 'CHILD_RESTORED');
        return true;
      });
      if (!restored) return NextResponse.json({ error: 'ไม่พบข้อมูลเด็กที่ถูกลบชั่วคราว' }, { status: 404 });
      return NextResponse.json({ success: true });
    }

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
      where: { id, userId: session.userId, archivedAt: null },
      select: { id: true },
    });
    if (!existingChild) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });
    }

    const child = await prisma.$transaction(async (transaction) => {
      const updatedChild = await transaction.child.update({
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
      await recordUserActivity(transaction, session.userId, 'CHILD_UPDATED');
      return updatedChild;
    });

    return NextResponse.json({ success: true, child });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถบันทึกข้อมูลเด็กได้' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนลบข้อมูลเด็ก' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const isPermanent = body?.permanent === true;
    const child = await prisma.child.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, archivedAt: true },
    });
    if (!child) return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });

    await prisma.$transaction(async (transaction) => {
      if (isPermanent) {
        await permanentlyDeleteChild(transaction, id);
        await recordUserActivity(transaction, session.userId, 'CHILD_PERMANENTLY_DELETED');
        return;
      }

      if (child.archivedAt) return;
      await transaction.child.update({ where: { id }, data: { archivedAt: new Date() } });
      await recordUserActivity(transaction, session.userId, 'CHILD_ARCHIVED');
    });

    return NextResponse.json({ success: true, permanent: isPermanent });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถลบข้อมูลเด็กได้' }, { status: 500 });
  }
}

function parseMeasurement(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsedValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}