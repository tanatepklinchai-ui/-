import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, notificationEmail: true }
  });
  
  return NextResponse.json({ 
    email: user?.notificationEmail || user?.email || '' 
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { email } = await req.json();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'อีเมลไม่ถูกต้อง' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { notificationEmail: email }
  });

  return NextResponse.json({ success: true });
}