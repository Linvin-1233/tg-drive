// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.startsWith('/themes') ||
        pathname.startsWith('/api/auth') || // ⚡ 必须完全放行这个前缀
        pathname === '/login' ||
        pathname === '/favicon.ico' ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    const sessionToken = request.cookies.get('pangu_session')?.value;
    if (!sessionToken || sessionToken !== 'authenticated_core_user') {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|themes|favicon.ico).*)',
    ],
};