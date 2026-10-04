import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            gender: true,
            dob: true,
            weight: true,
            height: true,
          },
        },
        children: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            dob: true,
            weight: true,
            height: true,
            vaccineRecords: {
              orderBy: { administeredDate: 'desc' },
              select: {
                id: true,
                vaccineCode: true,
                vaccineName: true,
                administeredDate: true,
                hospitalName: true,
                verificationStatus: true,
              },
            },
          },
        },
        appointments: {
          orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            hospitalName: true,
            scheduledAt: true,
            requestedVaccine: true,
            status: true,
            child: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!user) return NextResponse.json({ error: 'ไม่พบผู้ใช้งานนี้' }, { status: 404 });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดโปรไฟล์ผู้ใช้ได้' }, { status: 500 });
  }
}
