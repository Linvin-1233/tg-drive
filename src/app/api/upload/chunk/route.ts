// src/app/api/upload/chunk/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
    const { searchParams } = new URL(req.url);
    const part = searchParams.get('part');

    try {
        const formData = await req.formData();
        const fileBlob = formData.get('file') as Blob;

        if (!fileBlob) throw new Error('未检测到切片二进制数据');

        // 重新包装透传给 Discord
        const discordForm = new FormData();
        discordForm.append('files[0]', fileBlob, 'blob'); // 纯二进制透传
        discordForm.append('payload_json', JSON.stringify({ content: `Part ${part} 传输` }));

        const response = await fetch(webhookUrl, { method: 'POST', body: discordForm });
        if (!response.ok) throw new Error(`Discord 拒收了分片: ${response.statusText}`);

        const resData = await response.json();
        const cUrl = resData.attachments?.[0]?.url;

        if (!cUrl) throw new Error('Discord 未返回有效的 CDN 链接');

        return NextResponse.json({ success: true, url: cUrl });
    } catch (error: any) {
        console.error(`[Chunk ${part}] 转发失败:`, error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}