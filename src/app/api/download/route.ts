// src/app/api/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

const globalWashLock = new Set<string>();

// 🎯 超强防御性清洗：利用标准 URL 解析器提取纯净的 Discord CDN 链接，杜绝一切 &, 尾巴污染
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

// 官方标准洗白 API
async function refreshDiscordUrls(expiredUrls: string[]): Promise<string[] | null> {
    if (!expiredUrls || expiredUrls.length === 0) return [];
    const cleanedUrls = expiredUrls.map(cleanDiscordUrl).filter(Boolean);

    try {
        console.log(`[下载端洗白] 正在提交 ${cleanedUrls.length} 个切片给 Discord 官方接口翻新...`);
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
        console.error('[下载端洗白] 灾难性错误:', err);
        return null;
    }
}

// 🎯 终极救援机制（兼容单消息多切片、多消息多切片组合场景）
async function tryResurrectViaChannel(channelId: string, messageId: string, oldUrls: string[]): Promise<string[] | null> {
    try {
        console.log(`[终极救援] 官方洗白接口失效，尝试直接去频道 ${channelId} 重新拉取锚点消息 ${messageId}...`);
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` },
            cache: 'no-store'
        });

        if (!res.ok) {
            console.error(`[终极救援失败] 机器人也无法读取该消息，状态码: ${res.status}`);
            return null;
        }

        const msgData = await res.json();
        if (!msgData?.attachments || msgData.attachments.length === 0) return null;

        const freshlyFetchedUrls = msgData.attachments.map((att: any) => att.url).filter(Boolean);

        // 情况 A：如果你上传时把所有切片存在了这一条消息里，直接返回
        if (freshlyFetchedUrls.length === oldUrls.length) {
            console.log(`[终极救援成功] 🎉 完美匹配！此消息内包含全部 ${freshlyFetchedUrls.length} 个最新切片链接。`);
            return freshlyFetchedUrls;
        }

        // 情况 B：如果是分多条消息发的切片（数据库里存了第一个分片的 msg_id），启动混合翻新池
        console.log(`[终极救援混血模式] 锚点消息回吐了 ${freshlyFetchedUrls.length} 个最新切片。开始尝试全量混合翻新...`);

        const mixedUrls = oldUrls.map(oldUrl => {
            const oldPath = new URL(oldUrl).pathname;
            const matchedFresh = freshlyFetchedUrls.find((freshUrl: string) => new URL(freshUrl).pathname === oldPath);
            return matchedFresh ? matchedFresh : oldUrl;
        });

        // 再次尝试用官方接口洗一次（此时池子里至少有一个分片已经满血复活，能直接带活剩下的分片）
        const secondTry = await refreshDiscordUrls(mixedUrls);
        if (secondTry && secondTry.length === oldUrls.length) {
            return secondTry;
        }

        return null;
    } catch (e) {
        console.error(`[终极救援异常]:`, e);
        return null;
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('file_id');

    if (!fileId) return NextResponse.json({ error: '缺少参数 file_id' }, { status: 400 });

    try {
        // 从全新的 cdn_urls 字段以及补齐的生命周期、ID 字段中捞取数据
        const fileRecords = await queryD1(
            'SELECT name, cdn_urls, size, urls_expired_at, channel_id, message_id FROM files WHERE id = ? LIMIT 1',
            [fileId]
        ) as any[];

        if (!fileRecords || fileRecords.length === 0) {
            return NextResponse.json({ error: '文件不存在或已被物理删除' }, { status: 404 });
        }

        let { name: realFileName, cdn_urls: allUrlsStr, size: totalSize, urls_expired_at, channel_id, message_id } = fileRecords[0];

        // 增加对老数据的规范化清洗，防止干扰
        let urls = allUrlsStr.split(',').map(cleanDiscordUrl).filter(Boolean);
        const now = Math.floor(Date.now() / 1000);

        // 🛡️ 巡逻队：20 小时到期主动检测洗白机制
        if ((!urls_expired_at || now > (urls_expired_at - 600)) && !globalWashLock.has(fileId)) {
            globalWashLock.add(fileId);
            try {
                let freshUrls = await refreshDiscordUrls(urls);

                // 如果常规批量洗白因为过期太久被拒绝，且有频道坐标，触发特种兵救援
                if (!freshUrls && channel_id && message_id) {
                    freshUrls = await tryResurrectViaChannel(channel_id, message_id, urls);
                }

                if (freshUrls && freshUrls.length === urls.length) {
                    urls = freshUrls;
                    const nextExpiredAt = now + 20 * 60 * 60; // 顺延 20 小时
                    await queryD1('UPDATE files SET cdn_urls = ?, urls_expired_at = ? WHERE id = ?', [urls.join(','), nextExpiredAt, fileId]);
                    console.log(`[下载端] 日常寿命亮红灯，链接成功借尸还魂，回填成功。`);
                }
            } catch (dbErr) {
                console.error('[下载端] 数据库定时回填失败:', dbErr);
            } finally {
                globalWashLock.delete(fileId);
            }
        }

        // 拼接转泵（纯流式拼接传输）
        const responseStream = new ReadableStream({
            async start(controller) {
                try {
                    for (let i = 0; i < urls.length; i++) {
                        let chunkRes = await fetch(urls[i], {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                        });

                        // 🛡️ 医疗兵：现场下载遭遇 404（意味着发生突发性过期）
                        if (!chunkRes.ok) {
                            console.warn(`[现场救援] 第 ${i + 1} 块拉取触发 404，启动紧急现场复活逻辑...`);

                            let emergencyFreshUrls = await refreshDiscordUrls(urls);
                            if (!emergencyFreshUrls && channel_id && message_id) {
                                emergencyFreshUrls = await tryResurrectViaChannel(channel_id, message_id, urls);
                            }

                            if (!emergencyFreshUrls) {
                                console.error(`[下载崩溃] 彻底无药可救。文件可能被人在 Discord 频道内真正手动删除了。`);
                                controller.error(new Error(`Discord CDN 切片拉取失败且无法复活: 第 ${i + 1} 块`));
                                return;
                            }

                            // 现场替换链接，保持下载不中断
                            urls = emergencyFreshUrls;
                            const nextExpiredAt = Math.floor(Date.now() / 1000) + 20 * 60 * 60;
                            queryD1('UPDATE files SET cdn_urls = ?, urls_expired_at = ? WHERE id = ?', [urls.join(','), nextExpiredAt, fileId]).catch(() => {});

                            // 用新的合法链接重新拉取当前切片
                            chunkRes = await fetch(urls[i], { headers: { 'User-Agent': 'Mozilla/5.0' } });
                        }

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
                // 如果数据库记录了 size，最好附带 Content-Length 让浏览器能显示下载进度条（若没有值则默认不传）
                ...(totalSize ? { 'Content-Length': totalSize.toString() } : {}),
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });

    } catch (error: any) {
        return NextResponse.json({ error: '流中转失败: ' + error.message }, { status: 500 });
    }
}