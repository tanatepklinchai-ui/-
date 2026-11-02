import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { recordUserActivity } from '@/lib/userActivity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, notificationEmail: true },
    });

    return NextResponse.json({
      email: user?.notificationEmail || user?.email || '',
    });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดการตั้งค่าได้' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: unknown = await req.json();
    const email = typeof body === 'object' && body !== null && 'email' in body
      ? body.email
      : null;
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'อีเมลไม่ถูกต้อง' }, { status: 400 });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: session.userId },
        data: { notificationEmail: email },
      });
      await recordUserActivity(transaction, session.userId, 'NOTIFICATION_EMAIL_UPDATED');
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถบันทึกการตั้งค่าได้' }, { status: 500 });
  }
}