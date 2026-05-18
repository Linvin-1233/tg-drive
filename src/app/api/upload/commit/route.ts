// src/app/api/upload/commit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

/**
 * 从 Discord CDN 链接中解析 channel_id 和 message_id
 * 标准 URL 格式: https://cdn.discordapp.com/attachments/{channel_id}/{message_id}/{filename}
 */
function extractDiscordIdentifiers(urlStr: string) {
    try {
        const urlObj = new URL(urlStr.trim());
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        if (pathParts[0] === 'attachments' && pathParts.length >= 3) {
            return {
                channelId: pathParts[1],
                messageId: pathParts[2]
            };
        }
        return { channelId: null, messageId: null };
    } catch (e) {
        return { channelId: null, messageId: null };
    }
}

export async function POST(req: NextRequest) {
    try {
        const { name, size, folderId, urls } = await req.json();

        if (!name || !urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ success: false, error: '未收到合法的切片链接列表' }, { status: 400 });
        }

        // 规范化 folderId 字段，空值转换为 null 存储
        let cleanFolderId: string | null = folderId;
        if (folderId === 'null' || folderId === 'undefined' || !folderId || String(folderId).trim() === '') {
            cleanFolderId = null;
        }

        const fileId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const extension = name.includes('.') ? name.split('.').pop() : '';
        const allUrlsStr = urls.join(',');

        // 提取 Discord 消息标识符作为失效刷新锚点
        const { channelId, messageId } = extractDiscordIdentifiers(urls[0]);

        if (!channelId || !messageId) {
            console.warn(`[Upload Commit] Failed to extract Discord identifiers from URL: ${urls[0]}`);
        }

        // 计算过期时间戳（保留 4 小时余量，按 20 小时缓存计算）
        const nowInSeconds = Math.floor(Date.now() / 1000);
        const urlsExpiredAt = nowInSeconds + (20 * 60 * 60);

        // 数据入库
        await queryD1(
            'INSERT INTO files (id, name, extension, size, cdn_urls, folder_id, urls_expired_at, channel_id, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [fileId, name, extension, Number(size), allUrlsStr, cleanFolderId, urlsExpiredAt, channelId, messageId]
        );

        console.log(`[Upload Commit] File standard record created successfully. ID: ${fileId}, Name: ${name}, ChannelId: ${channelId}, MessageId: ${messageId}`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Upload Commit] Database insertion error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}