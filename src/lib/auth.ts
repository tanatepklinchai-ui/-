// src/lib/auth.ts
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET;

// สร้าง Signature เพื่อป้องกันไม่ให้ผู้ใช้แอบแก้ไขข้อมูลใน Cookie เอง
function sign(value: string): string {
  if (!SECRET) throw new Error('NEXTAUTH_SECRET must be configured');
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

// 1. สั่งสร้างและฝัง Cookie ตอนล็อกอินสำเร็จ
export async function setSession(user: { id: string; role: string; email: string }) {
  const cookieStore = await Promise.resolve(cookies());
  const payload = JSON.stringify({ id: user.id, role: user.role, email: user.email });
  const signature = sign(payload);
  const sessionValue = Buffer.from(payload).toString('base64') + '.' + signature;

  cookieStore.set('promchid_session', sessionValue, {
    httpOnly: true, // ป้องกัน XSS (JavaScript ฝั่งหน้าบ้านอ่านไม่ได้)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // มีอายุ 7 วัน
    path: '/',
  });
}

// 2. ฟังก์ชันดึงข้อมูล User ปัจจุบัน (ใช้แทน getUserIdFromSession)
export async function getSession(): Promise<{ userId: string; role: string; email: string } | null> {
  const cookieStore = await Promise.resolve(cookies());
  const sessionCookie = cookieStore.get('promchid_session')?.value;

  if (!sessionCookie) return null;

  const [base64Payload, signature] = sessionCookie.split('.');
  if (!base64Payload || !signature) return null;

  try {
    const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
    const expectedSignature = sign(payload);

    // ตรวจสอบว่าข้อมูลถูกดัดแปลงหรือไม่
    if (signature !== expectedSignature) {
      return null;
    }

    const data = JSON.parse(payload);
    return { userId: data.id, role: data.role, email: data.email };
  } catch {
    return null;
  }
}

// 3. สั่งลบ Cookie เมื่อกดออกจากระบบ
export async function clearSession() {
  const cookieStore = await Promise.resolve(cookies());
  cookieStore.delete('promchid_session');
}