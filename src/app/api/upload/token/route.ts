// src/app/api/upload/token/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
    if (!webhookUrl) {
        return NextResponse.json({ success: false, error: 'Webhook 未配置' }, { status: 500 });
    }
    // 把 Webhook 地址安全地借给前端
    return NextResponse.json({ webhookUrl });
}