import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
  }

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'ข้อมูลสถานพยาบาลไม่ถูกต้อง' }, { status: 400 });
    }

    const { hospitalId, name, isActive } = body as {
      hospitalId?: unknown;
      name?: unknown;
      isActive?: unknown;
    };
    const data: { name?: string; isActive?: boolean } = {};
    if (typeof name === 'string') {
      if (!name.trim() || name.trim().length > 200) {
        return NextResponse.json({ error: 'ชื่อสถานพยาบาลต้องมี 1 ถึง 200 ตัวอักษร' }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (typeof hospitalId !== 'string' || !hospitalId || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข' }, { status: 400 });
    }

    const result = await prisma.hospital.updateMany({
      where: { id: hospitalId },
      data,
    });
    if (result.count !== 1) {
      return NextResponse.json({ error: 'ไม่พบสถานพยาบาลที่ต้องการแก้ไข' }, { status: 404 });
    }
    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    return NextResponse.json({ success: true, hospital });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขข้อมูลสถานพยาบาลได้' }, { status: 500 });
  }
}
