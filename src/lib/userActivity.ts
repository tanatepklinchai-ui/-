import type { Prisma } from '@prisma/client';

export type UserActivityAction =
  | 'ACCOUNT_REGISTERED'
  | 'ACCOUNT_LOGIN'
  | 'ACCOUNT_LOGOUT'
  | 'CHILD_ADDED'
  | 'CHILD_UPDATED'
  | 'APPOINTMENT_BOOKED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_RESCHEDULE_REQUESTED'
  | 'VACCINE_RECORD_ADDED'
  | 'VACCINE_REQUEST_SUBMITTED'
  | 'NOTIFICATION_EMAIL_UPDATED'
  | 'PUSH_NOTIFICATIONS_ENABLED'
  | 'PUSH_NOTIFICATIONS_DISABLED';

export async function recordUserActivity(
  transaction: Prisma.TransactionClient,
  userId: string,
  action: UserActivityAction
) {
  await transaction.userActivity.create({
    data: { userId, action },
  });
}
