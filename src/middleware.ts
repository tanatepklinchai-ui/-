// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('promchid_session');
  const path = request.nextUrl.pathname;

  // 1. ถ้ายังไม่ล็อกอิน แล้วพยายามเข้าหน้า Dashboard
  if (!session && (path.startsWith('/user') || path.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. ถ้าล็อกอินแล้ว พยายามกลับไปหน้า Login หรือ Register
  if (session && (path === '/login' || path === '/register')) {
    return NextResponse.redirect(new URL('/user/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/user/:path*', '/admin/:path*', '/login', '/register'],
};