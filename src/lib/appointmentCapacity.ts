import { Prisma, type Appointment } from '@prisma/client';

export function getBangkokSlot(date: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day))),
    time: `${values.hour}:${values.minute}`,
  };
}

export async function promoteWaitlistedAppointment(
  transaction: Prisma.TransactionClient,
  hospitalId: string,
  scheduledAt: Date
) {
  const slotKey = getBangkokSlot(scheduledAt);
  const slot = await transaction.hospitalSlot.findUnique({
    where: { hospitalId_date_time: { hospitalId, date: slotKey.date, time: slotKey.time } },
  });

  if (!slot || slot.isClosed || slot.booked >= slot.capacity) return false;

  const nextWaitlisted = await transaction.appointment.findFirst({
    where: { hospitalId, scheduledAt, status: 'PENDING', isWaitlisted: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  if (!nextWaitlisted) return false;

  const updateResult = await transaction.appointment.updateMany({
    where: { id: nextWaitlisted.id, status: 'PENDING', isWaitlisted: true },
    data: {
      status: 'CONFIRMED',
      isWaitlisted: false,
      usesCapacity: true,
      notified7Days: false,
      notified3Days: false,
      notified1Day: false,
      notified1Hour: false,
    },
  });

  if (updateResult.count !== 1) return false;

  await transaction.hospitalSlot.updateMany({
    where: { id: slot.id, isClosed: false, booked: { lt: slot.capacity } },
    data: { booked: { increment: 1 } },
  });

  return true;
}

export async function releaseAppointmentCapacity(
  transaction: Prisma.TransactionClient,
  appointment: Pick<Appointment, 'hospitalId' | 'scheduledAt' | 'usesCapacity' | 'isWaitlisted'>
) {
  if (!appointment.hospitalId || !appointment.usesCapacity || appointment.isWaitlisted) return;

  const slotKey = getBangkokSlot(appointment.scheduledAt);
  await transaction.hospitalSlot.updateMany({
    where: {
      hospitalId: appointment.hospitalId,
      date: slotKey.date,
      time: slotKey.time,
      booked: { gt: 0 },
    },
    data: { booked: { decrement: 1 } },
  });
  await promoteWaitlistedAppointment(transaction, appointment.hospitalId, appointment.scheduledAt);
}

export async function permanentlyDeleteChild(transaction: Prisma.TransactionClient, childId: string) {
  const child = await transaction.child.findUnique({
    where: { id: childId },
    select: {
      userId: true,
      appointments: {
        select: {
          id: true,
          hospitalId: true,
          scheduledAt: true,
          status: true,
          isWaitlisted: true,
          usesCapacity: true,
        },
      },
    },
  });

  if (!child) return null;

  for (const appointment of child.appointments) {
    if (['PENDING', 'CONFIRMED', 'RESCHEDULED', 'RESCHEDULE_REQUESTED'].includes(appointment.status)) {
      await releaseAppointmentCapacity(transaction, appointment);
    }
  }

  await transaction.appointment.deleteMany({ where: { childId } });
  await transaction.vaccineRecord.deleteMany({ where: { childId } });
  await transaction.child.delete({ where: { id: childId } });
  return child.userId;
}
