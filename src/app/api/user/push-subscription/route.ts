import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWebPushPublicKey, isWebPushConfigured } from '@/lib/webPush';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });

  try {
    const subscriptionCount = await prisma.webPushSubscription.count({
      where: { userId: session.userId },
    });
    return NextResponse.json({
      available: isWebPushConfigured(),
      publicKey: getWebPushPublicKey(),
      subscriptionCount,
    });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถโหลดสถานะ Push ได้' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: 'ระบบแจ้งเตือน Push ยังไม่ได้ตั้งค่า' }, { status: 503 });
  }

  try {
    const body: unknown = await req.json();
    if (!isObject(body) || !isObject(body.keys)) {
      return NextResponse.json({ error: 'ข้อมูลการสมัครรับ Push ไม่ถูกต้อง' }, { status: 400 });
    }

    const { endpoint } = body;
    const { p256dh, auth } = body.keys;
    if (
      typeof endpoint !== 'string' ||
      endpoint.length > 2048 ||
      typeof p256dh !== 'string' ||
      p256dh.length < 16 ||
      p256dh.length > 512 ||
      typeof auth !== 'string' ||
      auth.length < 8 ||
      auth.length > 512
    ) {
      return NextResponse.json({ error: 'ข้อมูลการสมัครรับ Push ไม่ถูกต้อง' }, { status: 400 });
    }

    let endpointUrl: URL;
    try {
      endpointUrl = new URL(endpoint);
    } catch {
      return NextResponse.json({ error: 'ที่อยู่ Push ไม่ถูกต้อง' }, { status: 400 });
    }
    if (endpointUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'ที่อยู่ Push ต้องใช้ HTTPS' }, { status: 400 });
    }

    const existing = await prisma.webPushSubscription.findUnique({ where: { endpoint } });
    if (existing && existing.userId !== session.userId) {
      return NextResponse.json({ error: 'อุปกรณ์นี้เชื่อมกับบัญชีอื่นอยู่' }, { status: 409 });
    }

    if (existing) {
      await prisma.webPushSubscription.update({
        where: { id: existing.id },
        data: { p256dh, auth },
      });
    } else {
      await prisma.webPushSubscription.create({
        data: { userId: session.userId, endpoint, p256dh, auth },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'อุปกรณ์นี้เพิ่งเชื่อมกับบัญชีอื่น กรุณาลองใหม่' }, { status: 409 });
    }
    return NextResponse.json({ error: 'ไม่สามารถบันทึกการสมัครรับ Push ได้' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });

  try {
    const body: unknown = await req.json();
    const endpoint = isObject(body) ? body.endpoint : null;
    if (typeof endpoint !== 'string' || endpoint.length > 2048) {
      return NextResponse.json({ error: 'ข้อมูลอุปกรณ์ไม่ถูกต้อง' }, { status: 400 });
    }

    await prisma.webPushSubscription.deleteMany({
      where: { userId: session.userId, endpoint },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถยกเลิกการสมัครรับ Push ได้' }, { status: 500 });
  }
}
