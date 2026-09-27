import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type SessionPayload = { id?: string; role?: string; email?: string };

async function readVerifiedSession(value: string | undefined): Promise<SessionPayload | null> {
  if (!value) return null;
  const [encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return null;

  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const binaryPayload = atob(encodedPayload);
    const bytes = Uint8Array.from(binaryPayload, (character) => character.charCodeAt(0));
    const payloadText = new TextDecoder().decode(bytes);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signatureBytes = Uint8Array.from(signature.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(payloadText));
    if (!valid) return null;
    const payload = JSON.parse(payloadText) as SessionPayload;
    return typeof payload.id === 'string' && typeof payload.role === 'string' ? payload : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const session = await readVerifiedSession(request.cookies.get('promchid_session')?.value);
  const isAdminPath = path.startsWith('/admin');
  const isPrivatePath = isAdminPath || path.startsWith('/user');

  if (isPrivatePath && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (isAdminPath && session?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/user/dashboard', request.url));
  }
  if ((path === '/login' || path === '/register') && session) {
    return NextResponse.redirect(new URL(session.role === 'ADMIN' ? '/admin/dashboard' : '/user/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/user/:path*', '/admin/:path*', '/login', '/register'],
};
