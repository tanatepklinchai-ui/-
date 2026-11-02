import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  }

  try {
    const activities = await prisma.userActivity.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { username: true, email: true },
        },
      },
    });

    return NextResponse.json({ activities });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดประวัติกิจกรรมได้' }, { status: 500 });
  }
}
