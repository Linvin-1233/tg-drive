import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.startsWith('/themes') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/folder/') ||
        pathname === '/login' ||
        pathname === '/login-folder' ||
        pathname === '/favicon.ico' ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    const sessionToken = request.cookies.get('pangu_session')?.value;
    if (!sessionToken || sessionToken !== 'authenticated_core_user') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 文件夹权限拦截
    const folderId = searchParams.get('currentDir');
    if (folderId) {
        // 先检查是否有对应的访问 Cookie
        const hasAccess = request.cookies.has(`access_folder_${folderId}`);

        if (!hasAccess) {
            const checkRes = await fetch(`${request.nextUrl.origin}/api/folder/check?id=${folderId}`);
            const { isLocked } = await checkRes.json();

            if (isLocked) {
                return NextResponse.redirect(new URL(`/login-folder?folderId=${folderId}`, request.url));
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|themes|favicon.ico).*)',
    ],
};