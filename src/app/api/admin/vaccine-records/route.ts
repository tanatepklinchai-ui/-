import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  }

  try {
    const records = await prisma.vaccineRecord.findMany({
      where: { verificationStatus: 'PENDING' },
      include: {
        user: { select: { username: true, email: true } },
        child: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถดึงรายการตรวจสอบได้' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { recordId, verificationStatus } = body;
    if (
      typeof recordId !== 'string' ||
      !['VERIFIED', 'REJECTED'].includes(verificationStatus)
    ) {
      return NextResponse.json({ error: 'ข้อมูลตรวจสอบไม่ถูกต้อง' }, { status: 400 });
    }

    const result = await prisma.vaccineRecord.updateMany({
      where: { id: recordId, verificationStatus: 'PENDING' },
      data: { verificationStatus },
    });
    if (result.count !== 1) {
      return NextResponse.json({ error: 'ไม่พบรายการที่รอตรวจสอบ' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถบันทึกผลตรวจสอบได้' }, { status: 500 });
  }
}