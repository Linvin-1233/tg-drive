// src/app/api/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('file_id');

    if (!fileId) return NextResponse.json({ error: '缺少参数 file_id' }, { status: 400 });

    try {
        // 从 D1 中捞出资产
        const fileRecords = await queryD1(
            'SELECT name, cdn_urls, size FROM files WHERE id = ? LIMIT 1',
            [fileId]
        ) as any[];

        if (!fileRecords || fileRecords.length === 0) {
            return NextResponse.json({ error: '文件不存在或已被删除' }, { status: 404 });
        }

        const { name: realFileName, cdn_urls: allChunksStr, size: totalSize } = fileRecords[0];

        // 解构 Telegram 分布式清单
        let chunksArray: Array<{
            part_index: number;
            tg_group_id: string;
            tg_message_id: number;
            tg_file_id?: string;
        }> = [];

        try {
            chunksArray = JSON.parse(allChunksStr);
            chunksArray.sort((a, b) => a.part_index - b.part_index);
        } catch (e) {
            return NextResponse.json({ error: '解析 Telegram 切片资产链失败' }, { status: 500 });
        }

        const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

        const responseStream = new ReadableStream({
            async start(controller) {
                try {
                    for (const chunk of chunksArray) {
                        const targetFileId = chunk.tg_file_id || String(chunk.tg_message_id);

                        // 换取具体分片的真实文件物理路径 (file_path)
                        const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${targetFileId}`;
                        const pathRes = await fetch(getFileUrl);

                        if (!pathRes.ok) {
                            throw new Error(`TG 拒绝了块 ${chunk.part_index + 1} 的路径查询 (HTTP_${pathRes.status})`);
                        }

                        const pathData = await pathRes.json();
                        if (!pathData.ok) {
                            throw new Error(`TG 寻址失败: ${pathData.description} (请尝试上传新文件测试)`);
                        }

                        const filePath = pathData.result.file_path;

                        // 直接通过物理路径拉取原生的二进制文件流
                        const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
                        const fileRes = await fetch(downloadUrl);
                        if (!fileRes.ok) throw new Error(`TG 拒绝了块 ${chunk.part_index + 1} 的二进制拉取`);

                        const reader = fileRes.body?.getReader();
                        if (!reader) throw new Error(`块 ${chunk.part_index + 1} 无法建立流读取器`);

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            controller.enqueue(value);
                        }
                    }
                    controller.close();
                } catch (err: any) {
                    console.error('[TG 下载流中断]:', err);
                    controller.error(err);
                }
            }
        });

        return new NextResponse(responseStream, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(realFileName)}`,
                'Content-Length': totalSize.toString(),
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });

    } catch (error: any) {
        return NextResponse.json({ error: '流中转失败: ' + error.message }, { status: 500 });
    }
}