import { Prisma, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  }

  try {
    const searchParams = new URL(req.url).searchParams;
    const query = searchParams.get('q')?.trim().slice(0, 100) ?? '';
    const cursor = searchParams.get('cursor');
    if (cursor && !(await prisma.user.findUnique({ where: { id: cursor }, select: { id: true } }))) {
      return NextResponse.json({ error: 'ไม่พบหน้ารายชื่อผู้ใช้ที่ต้องการ' }, { status: 400 });
    }
    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: PAGE_SIZE + 1,
    });

    const hasMore = users.length > PAGE_SIZE;
    const pageUsers = hasMore ? users.slice(0, PAGE_SIZE) : users;
    return NextResponse.json({
      users: pageUsers,
      nextCursor: hasMore ? pageUsers[pageUsers.length - 1].id : null,
    });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
  }

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'ข้อมูลสิทธิ์ผู้ใช้ไม่ถูกต้อง' }, { status: 400 });
    }
    const { userId, role } = body as { userId?: unknown; role?: unknown };
    if (typeof userId !== 'string' || !userId || (role !== Role.USER && role !== Role.ADMIN)) {
      return NextResponse.json({ error: 'กรุณาระบุผู้ใช้และสิทธิ์ที่ถูกต้อง' }, { status: 400 });
    }
    if (userId === session.userId && role !== Role.ADMIN) {
      return NextResponse.json({ error: 'ไม่สามารถลดสิทธิ์บัญชีแอดมินที่กำลังใช้งานได้' }, { status: 409 });
    }

    const user = await prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!target) return null;

      if (target.role === Role.ADMIN && role === Role.USER) {
        const adminCount = await transaction.user.count({ where: { role: Role.ADMIN } });
        if (adminCount <= 1) throw new Error('LAST_ADMIN');
      }

      return transaction.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!user) return NextResponse.json({ error: 'ไม่พบผู้ใช้ที่ต้องการแก้ไข' }, { status: 404 });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_ADMIN') {
      return NextResponse.json({ error: 'ต้องมีแอดมินอย่างน้อยหนึ่งบัญชีในระบบ' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'มีการแก้ไขสิทธิ์พร้อมกัน กรุณาโหลดข้อมูลแล้วลองอีกครั้ง' }, { status: 409 });
    }
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขสิทธิ์ผู้ใช้ได้' }, { status: 500 });
  }
}
