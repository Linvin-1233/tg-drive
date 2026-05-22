// src/app/api/config/telegram/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        // 读取浏览器强制携带的登录态 Cookie（例如 pangu_session）
        const sessionCookie = req.cookies.get('pangu_session')?.value;

        if (!sessionCookie) {
            return NextResponse.json(
                { success: false, error: '会话未登录或已过期，拒绝发放凭证' },
                { status: 401 }
            );
        }

        // 从环境变量中安全地捞出 Telegram 核心机密
        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgGroupsRaw = process.env.TELEGRAM_GROUP_IDS;

        if (!tgToken || !tgGroupsRaw) {
            return NextResponse.json(
                { success: false, error: '服务器端 Telegram 配置不完整，请检查环境变量' },
                { status: 500 }
            );
        }

        // 将群组 ID 字符串切分为干净的数组
        const groupIds = tgGroupsRaw.split(',').map(id => id.trim());

        if (groupIds.length === 0) {
            return NextResponse.json(
                { success: false, error: '未检测到合法的目标存储群组列表' },
                { status: 500 }
            );
        }
        return NextResponse.json({
            success: true,
            token: tgToken,
            groupIds: groupIds
        });

    } catch (error: any) {
        console.error('[Telegram Config Fetch] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}