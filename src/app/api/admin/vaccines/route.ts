import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function isAdmin() {
  const session = await getSession();
  return session?.role === 'ADMIN';
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  try {
    const vaccines = await prisma.vaccineCatalog.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { records: true } } },
    });
    return NextResponse.json({ vaccines });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายการวัคซีนได้' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
  try {
    const body = await req.json();
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const stock = body.stock;
    if (!code || code.length > 40 || !name || name.length > 120 || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
      return NextResponse.json({ error: 'รหัส ชื่อวัคซีน หรือจำนวนสต็อกไม่ถูกต้อง' }, { status: 400 });
    }
    const vaccine = await prisma.vaccineCatalog.create({ data: { code, name, stock } });
    return NextResponse.json({ success: true, vaccine }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'บันทึกวัคซีนไม่สำเร็จ (รหัสวัคซีนอาจซ้ำ)' }, { status: 409 });
  }
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
  try {
    const body = await req.json();
    const { id, stock, isActive } = body;
    if (typeof id !== 'string' || (stock === undefined && typeof isActive !== 'boolean')) {
      return NextResponse.json({ error: 'ข้อมูลวัคซีนไม่ถูกต้อง' }, { status: 400 });
    }
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000)) {
      return NextResponse.json({ error: 'จำนวนสต็อกต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' }, { status: 400 });
    }
    const vaccine = await prisma.vaccineCatalog.update({
      where: { id },
      data: { ...(stock !== undefined ? { stock } : {}), ...(typeof isActive === 'boolean' ? { isActive } : {}) },
    });
    return NextResponse.json({ success: true, vaccine });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขรายการวัคซีนได้' }, { status: 404 });
  }
}
