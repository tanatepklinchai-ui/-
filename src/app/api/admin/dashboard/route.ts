// src/app/api/admin/dashboard/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  }

  try {
    // 1. ดึงรายชื่อผู้ใช้พร้อมโปรไฟล์
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      include: {
        profile: true,
        children: {
          select: { id: true, firstName: true, lastName: true, dob: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. ดึงรายการนัดหมายทั้งหมด
    const appointments = await prisma.appointment.findMany({
      include: {
        user: {
          select: { username: true, email: true },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    // 3. รวมสถิติวัคซีนที่ได้รับการยืนยันแล้ว แยกตามประเภท
    const confirmedVaccines = await prisma.vaccineRecord.groupBy({
      where: { verificationStatus: 'VERIFIED' },
      by: ['vaccineName'],
      _count: {
        vaccineName: true,
      },
    });

    const vaccineStats = confirmedVaccines.map((v) => ({
      name: v.vaccineName,
      count: v._count.vaccineName,
    }));

    // 4. จัดกลุ่มสถิติผู้เข้าใช้งาน/ลงทะเบียนตามวันและชั่วโมง (สำหรับกราฟแท่ง)
    const userTimeMap: { [key: string]: number } = {};
    users.forEach((u) => {
      const date = new Date(u.createdAt);
      // รูปแบบ: วว/ดด/ปป ชม:00 น.
      const timeKey = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${date.getFullYear() % 100} ${date.getHours().toString().padStart(2, '0')}:00`;
      userTimeMap[timeKey] = (userTimeMap[timeKey] || 0) + 1;
    });

    const chartData = Object.keys(userTimeMap).map((key) => ({
      time: key,
      count: userTimeMap[key],
    }));

    return NextResponse.json({
      users,
      appointments,
      vaccineStats,
      chartData: chartData.length > 0 ? chartData : [{ time: 'วันนี้', count: users.length }],
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูล Admin ได้' }, { status: 500 });
  }
}

// Appointment changes belong to /api/admin/appointments to preserve slot capacity.
// Admin access is enforced by the session role on this route.
// This handler intentionally exposes read-only dashboard data.
