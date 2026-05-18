// src/app/api/video/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

// 线程级并发锁，防止同一 file_id 触发高并发重复刷新请求
const globalWashLock = new Set<string>();
function cleanDiscordUrl(rawUrl: string): string {
    try {
        let trimmed = rawUrl.trim();
        while (trimmed.endsWith('&') || trimmed.endsWith(',')) {
            trimmed = trimmed.slice(0, -1);
        }
        const urlObj = new URL(trimmed);
        const ex = urlObj.searchParams.get('ex');
        const is = urlObj.searchParams.get('is');
        const hm = urlObj.searchParams.get('hm');

        if (!ex || !is || !hm) return trimmed;
        return `${urlObj.origin}${urlObj.pathname}?ex=${ex}&is=${is}&hm=${hm}`;
    } catch (e) {
        return rawUrl.trim();
    }
}

async function refreshDiscordUrls(expiredUrls: string[]): Promise<string[] | null> {
    if (!expiredUrls || expiredUrls.length === 0) return [];
    const cleanedUrls = expiredUrls.map(cleanDiscordUrl).filter(Boolean);

    try {
        console.log(`[Stream API] Submitting ${cleanedUrls.length} chunks to Discord refresh-urls API...`);
        const res = await fetch('https://discord.com/api/v10/attachments/refresh-urls', {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ attachment_urls: cleanedUrls }),
            cache: 'no-store'
        });

        if (res.ok) {
            const data = await res.json();
            if (data?.updated_attachments && data.updated_attachments.length === cleanedUrls.length) {
                return data.updated_attachments.map((item: any) => item.url || item.proxy_url || '').filter(Boolean);
            }
        }
        return null;
    } catch (err) {
        console.error('[Stream API] Discord attachment refresh exception:', err);
        return null;
    }
}

async function tryResurrectViaChannel(channelId: string, messageId: string, oldUrls: string[]): Promise<string[] | null> {
    try {
        console.log(`[Stream API] Standard refresh failed. Attempting backup fetch via channel ${channelId}, message ${messageId}...`);
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` },
            cache: 'no-store'
        });

        if (!res.ok) return null;

        const msgData = await res.json();
        if (!msgData?.attachments || msgData.attachments.length === 0) return null;

        const freshlyFetchedUrls = msgData.attachments.map((att: any) => att.url).filter(Boolean);

        // 情况 A：切片完全存储于单条消息上下文中，直接返回当前数据
        if (freshlyFetchedUrls.length === oldUrls.length) {
            return freshlyFetchedUrls;
        }

        // 情况 B：混合覆盖模式，利用当前捞回的有效分片组合失效分片，交由官方接口联动刷新
        const mixedUrls = oldUrls.map(oldUrl => {
            const oldPath = new URL(oldUrl).pathname;
            const matchedFresh = freshlyFetchedUrls.find((freshUrl: string) => new URL(freshUrl).pathname === oldPath);
            return matchedFresh ? matchedFresh : oldUrl;
        });

        const secondTry = await refreshDiscordUrls(mixedUrls);
        if (secondTry && secondTry.length === oldUrls.length) return secondTry;

        return null;
    } catch (e) {
        console.error(`[Stream API] Backup recovery execution exception:`, e);
        return null;
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('file_id');
    if (!fileId) return new Response('Required parameter file_id is missing', { status: 400 });

    try {
        // 检索存储元数据
        const rows: any = await queryD1(
            'SELECT cdn_urls, size, name, urls_expired_at, channel_id, message_id FROM files WHERE id = ?',
            [fileId]
        );
        if (!rows || rows.length === 0) return new Response('File not found', { status: 404 });

        let { cdn_urls, size: totalSize, name, urls_expired_at, channel_id, message_id } = rows[0];

        let urlsArray = cdn_urls.split(',').map(cleanDiscordUrl).filter(Boolean);
        const now = Math.floor(Date.now() / 1000);

        // 时间戳生命周期主动拦截检查（临界点前 10 分钟触发）
        if ((!urls_expired_at || now > (urls_expired_at - 600)) && !globalWashLock.has(fileId)) {
            globalWashLock.add(fileId);
            try {
                let freshUrls = await refreshDiscordUrls(urlsArray);

                // 若批量洗白接口失效，则向下路由触发消息回溯应急层
                if (!freshUrls && channel_id && message_id) {
                    freshUrls = await tryResurrectViaChannel(channel_id, message_id, urlsArray);
                }

                if (freshUrls && freshUrls.length === urlsArray.length) {
                    urlsArray = freshUrls;
                    const nextExpiredAt = now + 20 * 60 * 60; // 顺延 20 小时有效缓存
                    await queryD1('UPDATE files SET cdn_urls = ?, urls_expired_at = ? WHERE id = ?', [urlsArray.join(','), nextExpiredAt, fileId]);
                    console.log(`[Stream API] Cache lifecycle updated successfully for file: ${name}`);
                }
            } catch (dbErr) {
                console.error('[Stream API] Failed to persistence updated URLs to database:', dbErr);
            } finally {
                globalWashLock.delete(fileId);
            }
        }

        const CHUNK_SIZE = 9 * 1024 * 1024; // 切片标准体积：9MB
        const ext = name.split('.').pop()?.toLowerCase() || 'mp4';
        const isAudio = ['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext);
        const contentType = isAudio ? `audio/${ext === 'm4a' ? 'mp4' : ext}` : (ext === 'mkv' ? 'video/mp4' : `video/${ext}`);

        // HTTP Range 头部处理解析
        const rangeHeader = req.headers.get('range');
        let startByte = 0;
        let endByte = totalSize - 1;
        let isExplicitPartialRange = false;

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            startByte = parseInt(parts[0], 10);
            if (parts[1]) {
                endByte = parseInt(parts[1], 10);
                isExplicitPartialRange = true;
            }
        }

        if (startByte >= totalSize) startByte = totalSize - 1;
        if (endByte >= totalSize) endByte = totalSize - 1;

        const contentLength = endByte - startByte + 1;
        const startChunkIndex = Math.floor(startByte / CHUNK_SIZE);
        const byteOffsetInStartChunk = startByte % CHUNK_SIZE;

        // 实例化高性能流式传输管道，支持零内存中转和断点快进
        const stream = new ReadableStream({
            async start(controller) {
                let currentBytePointer = startByte;

                for (let i = startChunkIndex; i < urlsArray.length; i++) {
                    if (isExplicitPartialRange && currentBytePointer > endByte) {
                        break;
                    }

                    let chunkUrl = urlsArray[i];
                    const chunkGlobalStart = i * CHUNK_SIZE;
                    const chunkGlobalEnd = Math.min(totalSize, chunkGlobalStart + CHUNK_SIZE) - 1;

                    if (currentBytePointer <= chunkGlobalEnd) {
                        try {
                            const targetStartInChunk = i === startChunkIndex ? byteOffsetInStartChunk : 0;

                            let discordRes = await fetch(chunkUrl, {
                                headers: {
                                    'Range': `bytes=${targetStartInChunk}-`,
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            });

                            // 媒体播放中途的突发失效性重试机制 (HTTP 非 2xx 响应处理)
                            if (discordRes.status !== 200 && discordRes.status !== 206) {
                                console.warn(`[Stream API] Fetch chunk ${i + 1} failed with status ${discordRes.status}. Retrying recovery...`);

                                let emergencyUrls = await refreshDiscordUrls(urlsArray);
                                if (!emergencyUrls && channel_id && message_id) {
                                    emergencyUrls = await tryResurrectViaChannel(channel_id, message_id, urlsArray);
                                }

                                if (!emergencyUrls) {
                                    throw new Error(`Chunk ${i + 1} is corrupted and cannot be resurrected.`);
                                }

                                // 现场覆写当前分片地址信息，并异步通知 D1 修正历史记录
                                urlsArray = emergencyUrls;
                                chunkUrl = urlsArray[i];
                                const nextExpiredAt = Math.floor(Date.now() / 1000) + 20 * 60 * 60;
                                queryD1('UPDATE files SET cdn_urls = ?, urls_expired_at = ? WHERE id = ?', [urlsArray.join(','), nextExpiredAt, fileId]).catch(() => {});

                                // 对修复后的 URL 重新注入请求
                                discordRes = await fetch(chunkUrl, {
                                    headers: {
                                        'Range': `bytes=${targetStartInChunk}-`,
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                                    }
                                });
                            }

                            if (discordRes.status !== 200 && discordRes.status !== 206) {
                                throw new Error(`Discord CDN rejected connection after link renewal. Status: ${discordRes.status}`);
                            }

                            const reader = discordRes.body?.getReader();
                            if (!reader) continue;

                            let shouldStopCurrentChunk = false;
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;

                                // 严格限制并裁剪流出区间，以严格顺应客户端 Range 规定
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
                            console.error(`[Stream API] Pipeline broken at chunk ${i + 1}:`, err);
                            controller.error(err);
                            return;
                        }
                    }
                }
                controller.close();
            }
        });

        // 返回 206 Partial Content 流媒体响应
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
        return new Response(`Streaming media gateway exception: ${error.message}`, { status: 500 });
    }
}