// src/app/api/video/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('file_id');
    if (!fileId) return new Response('缺少 file_id 参数', { status: 400 });

    try {
        const rows: any = await queryD1('SELECT cdn_urls, size, name FROM files WHERE id = ?', [fileId]);
        if (!rows || rows.length === 0) return new Response('文件不存在', { status: 404 });

        const { cdn_urls, size: totalSize, name } = rows[0];

        // 1. 洗净所有残存空链接
        const urlsArray = cdn_urls.split(',').map((url: string) => url.trim()).filter((url: string) => url.length > 0);

        const CHUNK_SIZE = 9 * 1024 * 1024;
        const ext = name.split('.').pop()?.toLowerCase() || 'mp4';

        const isAudio = ['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext);
        const contentType = isAudio ? `audio/${ext === 'm4a' ? 'mp4' : ext}` : (ext === 'mkv' ? 'video/mp4' : `video/${ext}`);

        // 2. 精准解析 Range
        const rangeHeader = req.headers.get('range');
        let startByte = 0;
        let endByte = totalSize - 1;

        // 记录浏览器是否显式要了一个截断的局部区间（比如 bytes=0-1）
        let isExplicitPartialRange = false;

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            startByte = parseInt(parts[0], 10);
            if (parts[1]) {
                endByte = parseInt(parts[1], 10);
                isExplicitPartialRange = true; // 浏览器明确要拿某一段就结束
            }
        }

        if (startByte >= totalSize) startByte = totalSize - 1;
        if (endByte >= totalSize) endByte = totalSize - 1;

        const contentLength = endByte - startByte + 1;
        const startChunkIndex = Math.floor(startByte / CHUNK_SIZE);
        const byteOffsetInStartChunk = startByte % CHUNK_SIZE;

        // 3. 纯流式零内存中转管道
        const stream = new ReadableStream({
            async start(controller) {
                let currentBytePointer = startByte;

                for (let i = startChunkIndex; i < urlsArray.length; i++) {
                    // 只有当浏览器明确指定了终点（如局部切片请求），且当前指针超过了终点，才允许退出
                    if (isExplicitPartialRange && currentBytePointer > endByte) {
                        break;
                    }

                    const chunkUrl = urlsArray[i];
                    const chunkGlobalStart = i * CHUNK_SIZE;
                    const chunkGlobalEnd = Math.min(totalSize, chunkGlobalStart + CHUNK_SIZE) - 1;

                    if (currentBytePointer <= chunkGlobalEnd) {
                        try {
                            const targetStartInChunk = i === startChunkIndex ? byteOffsetInStartChunk : 0;

                            // 给 Discord 的 Range 发送全量后缀，确保流能够连续流出
                            const discordRes = await fetch(chunkUrl, {
                                headers: { 'Range': `bytes=${targetStartInChunk}-` }
                            });
                            if (!discordRes.ok && discordRes.status !== 206) throw new Error('Discord 直连流拒绝');

                            const reader = discordRes.body?.getReader();
                            if (!reader) continue;

                            let shouldStopCurrentChunk = false;
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;

                                // 如果是明确的局部请求，严格限制边界
                                if (isExplicitPartialRange && currentBytePointer + value.length > endByte) {
                                    const allowedLength = endByte - currentBytePointer + 1;
                                    if (allowedLength > 0) {
                                        controller.enqueue(value.slice(0, allowedLength));
                                        currentBytePointer += allowedLength;
                                    }
                                    shouldStopCurrentChunk = true;
                                    break;
                                }

                                controller.enqueue(value);
                                currentBytePointer += value.length;
                            }

                            if (shouldStopCurrentChunk) break;

                        } catch (err) {
                            console.error(`[流媒体故障] Part ${i + 1} 遭遇断流:`, err);
                            controller.error(err);
                            return;
                        }
                    }
                }
                // 所有的切片真正跑完后，才闭闸，保证流的完整性
                controller.close();
            }
        });

        return new NextResponse(stream, {
            status: rangeHeader ? 206 : 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': contentLength.toString(),
                'Content-Range': `bytes ${startByte}-${endByte}/${totalSize}`,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"`
            }
        });

    } catch (error: any) {
        return new Response(`流中转异常: ${error.message}`, { status: 500 });
    }
}