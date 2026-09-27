import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

class CompletionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const vaccineCatalogId = body?.vaccineCatalogId;
    if (typeof vaccineCatalogId !== 'string') {
      return NextResponse.json({ error: 'กรุณาเลือกวัคซีนจากรายการและตรวจสอบสต็อก' }, { status: 400 });
    }

    const appointment = await prisma.$transaction(async (transaction) => {
      const current = await transaction.appointment.findUnique({ where: { id } });
      if (!current || !['PENDING', 'CONFIRMED'].includes(current.status) || current.isWaitlisted) {
        throw new CompletionError('ไม่พบคิวหรือคิวนี้ไม่ได้อยู่ในสถานะรอมารับบริการ', 409);
      }

      const statusUpdate = await transaction.appointment.updateMany({
        where: { id, status: current.status },
        data: { status: 'COMPLETED' },
      });
      if (statusUpdate.count !== 1) throw new CompletionError('คิวมีการเปลี่ยนแปลง กรุณาโหลดใหม่', 409);

      const stockUpdate = await transaction.vaccineCatalog.updateMany({
        where: { id: vaccineCatalogId, isActive: true, stock: { gt: 0 } },
        data: { stock: { decrement: 1 } },
      });
      if (stockUpdate.count !== 1) throw new CompletionError('วัคซีนหมดสต็อกหรือปิดใช้งานแล้ว', 409);

      const vaccine = await transaction.vaccineCatalog.findUnique({ where: { id: vaccineCatalogId } });
      if (!vaccine) throw new CompletionError('ไม่พบวัคซีนที่เลือก', 404);

      await transaction.vaccineRecord.create({
        data: {
          userId: current.userId,
          childId: current.childId,
          vaccineCatalogId: vaccine.id,
          vaccineCode: vaccine.code,
          vaccineName: vaccine.name,
          administeredDate: new Date(),
          hospitalName: current.hospitalName,
          source: 'CLINICIAN_VERIFIED',
          verificationStatus: 'VERIFIED',
        },
      });
      return transaction.appointment.findUnique({ where: { id } });
    });

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    if (error instanceof CompletionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการยืนยันการฉีดและตัดสต็อก' }, { status: 500 });
  }
}
