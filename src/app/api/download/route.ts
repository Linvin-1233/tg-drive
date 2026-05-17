// src/app/api/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('file_id');

    if (!fileId) return NextResponse.json({ error: '缺少参数 file_id' }, { status: 400 });

    try {
        // 从全新的 cdn_urls 字段中捞取数据
        const fileRecords = await queryD1('SELECT name, cdn_urls FROM files WHERE id = ? LIMIT 1', [fileId]) as any[];
        if (!fileRecords || fileRecords.length === 0) {
            return NextResponse.json({ error: '文件不存在或已被物理删除' }, { status: 404 });
        }

        const { name: realFileName, cdn_urls: allUrlsStr } = fileRecords[0];
        const urls = allUrlsStr.split(',');

        // 拼接转泵
        const responseStream = new ReadableStream({
            async start(controller) {
                try {
                    for (let i = 0; i < urls.length; i++) {
                        const chunkRes = await fetch(urls[i]);
                        if (!chunkRes.ok || !chunkRes.body) {
                            throw new Error(`Discord CDN 切片拉取失败: 第 ${i + 1} 块`);
                        }

                        const reader = chunkRes.body.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (value) controller.enqueue(value);
                            if (done) break;
                        }
                    }
                    controller.close();
                } catch (err: any) {
                    controller.error(err);
                }
            }
        });

        return new Response(responseStream, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(realFileName)}`,
                'Cache-Control': 'no-cache',
            },
        });

    } catch (error: any) {
        return NextResponse.json({ error: '流中转失败: ' + error.message }, { status: 500 });
    }
}