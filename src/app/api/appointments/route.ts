import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!appointment || appointment.status !== 'PENDING') {
      return NextResponse.json({ error: 'ไม่พบรายการนัดหมายหรือคิวถูกปิดแล้ว' }, { status: 400 });
    }

    // 1. เปลี่ยนสถานะนัดหมายเป็น COMPLETED
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    // 2. บันทึกลงตารางประวัติวัคซีน (VaccineHistory)
    // The generated Prisma client does not expose this delegate in the current schema.
    // Keep the operation typed locally until the client is regenerated with VaccineHistory.
    const vaccineHistory = (prisma as unknown as {
      vaccineHistory: {
        create: (args: {
          data: {
            userId: string;
            vaccineName: string;
            vaccineType: string;
            hospitalName: string;
            vaccinatedAt: Date;
          };
        }) => Promise<unknown>;
      };
    }).vaccineHistory;

    await vaccineHistory.create({
      data: {
        userId: appointment.userId,
        vaccineName: body.vaccineName || 'วัคซีนทั่วไป',
        vaccineType: body.vaccineType || 'วัคซีนทั่วไป',
        hospitalName: appointment.hospitalName,
        vaccinatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, appointment: updatedAppointment });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการยืนยัน' }, { status: 500 });
  }
}