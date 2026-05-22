// src/app/api/video/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('file_id');
    if (!fileId) return new Response('Required parameter file_id is missing', { status: 400 });

    try {
        const rows: any = await queryD1('SELECT cdn_urls, size, name FROM files WHERE id = ?', [fileId]);
        const fileRecord = Array.isArray(rows) ? rows[0] : (rows?.results ? rows.results[0] : null);

        if (!fileRecord) return new Response('File record not found in D1', { status: 404 });

        const { cdn_urls, size: totalSize, name } = fileRecord;

        let chunksArray: Array<{ part_index: number; tg_group_id: string; tg_message_id: number; tg_file_id: string }> = [];
        try {
            chunksArray = JSON.parse(cdn_urls);
            chunksArray.sort((a, b) => a.part_index - b.part_index);
        } catch (e) {
            return new Response('Failed to parse cdn_urls', { status: 500 });
        }

        const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB 黄金切片规格

        const ext = name.split('.').pop()?.toLowerCase() || 'mp4';
        const isAudio = ['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext);
        const contentType = isAudio ? `audio/${ext === 'm4a' ? 'mp4' : ext}` : (ext === 'mkv' ? 'video/mp4' : `video/${ext}`);

        // 解析浏览器的 HTTP Range 头部
        const rangeHeader = req.headers.get('range');
        let startByte = 0;
        let endByte = totalSize - 1;

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            startByte = parseInt(parts[0], 10);
            if (parts[1]) {
                endByte = parseInt(parts[1], 10);
            }
        }

        if (startByte >= totalSize) startByte = totalSize - 1;
        if (endByte >= totalSize) endByte = totalSize - 1;
        if (startByte > endByte) startByte = endByte;

        const contentLength = endByte - startByte + 1;

        // 根据播放器快进点精确制导：落在哪块切片上，以及切片内相对起始位置
        const targetChunkIndex = Math.floor(startByte / CHUNK_SIZE);
        const chunk = chunksArray[targetChunkIndex];

        if (!chunk) return new Response('Chunk index out of bounds', { status: 416 });
        if (!chunk.tg_file_id) return new Response('Legacy record missing tg_file_id. Please re-upload.', { status: 400 });

        const relativeStartInChunk = startByte % CHUNK_SIZE;

        // 使用 tg_file_id 寻址物理路径
        const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${chunk.tg_file_id}`;
        const pathRes = await fetch(getFileUrl);
        if (!pathRes.ok) return new Response(`TG Path API Error: ${pathRes.status}`, { status: 500 });

        const pathData = await pathRes.json();
        if (!pathData.ok) return new Response(`TG Find Path Failed: ${pathData.description}`, { status: 500 });

        const filePath = pathData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

        // 纯流式拉取
        const tgFileRes = await fetch(downloadUrl);
        if (!tgFileRes.ok) return new Response(`TG File Stream Refused: ${tgFileRes.status}`, { status: 500 });

        const rawTgStream = tgFileRes.body;
        if (!rawTgStream) return new Response('Telegram response body stream is empty', { status: 500 });

        // 原生 Reader 级零积压裁剪器
        let bytesRead = 0;
        let bytesSent = 0;
        const reader = rawTgStream.getReader();

        const slicedVideoStream = new ReadableStream({
            async start(controller) {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunkLength = value.length;
                        const chunkStart = bytesRead;
                        const chunkEnd = bytesRead + chunkLength - 1;
                        bytesRead += chunkLength;

                        // 放行数据已足够，提前跳过后续数据
                        if (bytesSent >= contentLength) continue;

                        const wantedStart = Math.max(relativeStartInChunk, chunkStart);
                        const wantedEnd = Math.min(relativeStartInChunk + contentLength - 1, chunkEnd);

                        if (wantedStart <= wantedEnd) {
                            const offsetStart = wantedStart - chunkStart;
                            const offsetEnd = wantedEnd - chunkStart + 1;
                            const slicedData = value.subarray(offsetStart, offsetEnd);
                            controller.enqueue(slicedData);
                            bytesSent += slicedData.length;
                        }
                    }
                    controller.close();
                } catch (streamErr: any) {
                    controller.error(streamErr);
                }
            },
            cancel() {
                reader.cancel();
            }
        });

        // 4. 返回标准的 206 局部内容响应
        return new NextResponse(slicedVideoStream, {
            status: rangeHeader ? 206 : 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': contentLength.toString(),
                'Content-Range': `bytes ${startByte}-${endByte}/${totalSize}`,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=3600',
                'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"`
            }
        });

    } catch (error: any) {
        console.error('[Telegram Stream Gateway Critical Error]:', error);
        return new Response(`Streaming media gateway exception: ${error.message}`, { status: 500 });
    }
}