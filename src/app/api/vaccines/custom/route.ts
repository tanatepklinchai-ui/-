import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: ดึงรายชื่อวัคซีนทางเลือกที่แอดมินเปิดใช้งานไว้
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalog = await prisma.vaccineCatalog.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json({ catalog });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลวัคซีนได้' }, { status: 500 });
  }
}

// POST: ส่งคำขอเพิ่มชื่อวัคซีนใหม่
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { requestedName } = await req.json();
    if (!requestedName || typeof requestedName !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุชื่อวัคซีน' }, { status: 400 });
    }

    const request = await prisma.vaccineRequest.create({
      data: {
        userId: session.userId,
        requestedName: requestedName.trim(),
        status: 'PENDING'
      }
    });
    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการส่งคำขอ' }, { status: 500 });
  }
}