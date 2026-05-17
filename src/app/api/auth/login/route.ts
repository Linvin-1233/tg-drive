// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        // 从环境变量读取凭证
        const envUser = process.env.ADMIN_USERNAME;
        const envPass = process.env.ADMIN_PASSWORD;

        // 服务器熔断保护
        if (!envUser || !envPass) {
            return NextResponse.json(
                { message: 'SYS_FATAL: 服务器未配置安全环境变量，拒绝连接' },
                { status: 500 }
            );
        }

        // 断层扫描
        if (username !== envUser || password !== envPass) {
            return NextResponse.json(
                { message: 'SECURITY_VIOLATION: 凭证不匹配，会话已强制拦截' },
                { status: 401 }
            );
        }

        // 🔓 凭证合规！下发专属 Auth Cookie
        const response = NextResponse.json({
            success: true,
            message: 'HANDSHAKE_SUCCESS: 凭证核验通过，信道已建立'
        });

        response.cookies.set('pangu_session', 'authenticated_core_user', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 7 天
            path: '/',
        });

        return response;

    } catch (error) {
        return NextResponse.json(
            { message: 'SYS_ERROR: 网络崩溃' },
            { status: 500 }
        );
    }
}