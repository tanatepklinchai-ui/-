import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { permanentlyDeleteChild } from '@/lib/appointmentCapacity';
import { recordUserActivity } from '@/lib/userActivity';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    if (body?.action !== 'archive' && body?.action !== 'restore') {
      return NextResponse.json({ error: 'คำสั่งจัดการข้อมูลเด็กไม่ถูกต้อง' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (transaction) => {
      const child = await transaction.child.findUnique({
        where: { id },
        select: { userId: true, archivedAt: true },
      });
      if (!child) return false;

      const shouldArchive = body.action === 'archive';
      if (shouldArchive === Boolean(child.archivedAt)) return true;

      await transaction.child.update({
        where: { id },
        data: { archivedAt: shouldArchive ? new Date() : null },
      });
      await recordUserActivity(
        transaction,
        child.userId,
        shouldArchive ? 'CHILD_ARCHIVED' : 'CHILD_RESTORED'
      );
      return true;
    });

    if (!updated) return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตข้อมูลเด็กได้' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });

  try {
    const { id } = await params;
    const deleted = await prisma.$transaction(async (transaction) => {
      const userId = await permanentlyDeleteChild(transaction, id);
      if (!userId) return false;
      await recordUserActivity(transaction, userId, 'CHILD_PERMANENTLY_DELETED');
      return true;
    });

    if (!deleted) return NextResponse.json({ error: 'ไม่พบข้อมูลเด็ก' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถลบข้อมูลเด็กได้' }, { status: 500 });
  }
}
