// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordUserActivity } from '@/lib/userActivity';

export async function POST() {
  const session = await getSession();
  if (session) {
    await prisma.$transaction((transaction) =>
      recordUserActivity(transaction, session.userId, 'ACCOUNT_LOGOUT')
    );
  }
  await clearSession();
  return NextResponse.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
}