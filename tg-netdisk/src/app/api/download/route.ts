// src/app/api/download/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tgFileId = searchParams.get('file_id');

    if (!tgFileId) {
        return NextResponse.json({ error: '缺少参数 file_id' }, { status: 400 });
    }

    try {
        const botToken = process.env.TG_BOT_TOKEN;

        // 1. 请求 TG 服务器换取文件路径 (File Path)
        const getFileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${tgFileId}`);
        const fileData = await getFileResponse.json();

        if (!fileData.ok) {
            return NextResponse.json({ error: '无法从 Telegram 换取文件路径' }, { status: 500 });
        }

        const filePath = fileData.result.file_path;
        // 2. 组装最终的高速物理下载直链
        const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

        // 3. 抓取远程文件流
        const fileStreamResponse = await fetch(downloadUrl);

        // 4. 以流（Stream）的形式实时泵给用户浏览器，不占用 Vercel 内存
        return new Response(fileStreamResponse.body, {
            headers: {
                'Content-Type': fileStreamResponse.headers.get('Content-Type') || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="download-${Date.now()}"`, // 浏览器直接弹出下载
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: '中转下载失败: ' + err.message }, { status: 500 });
    }
}