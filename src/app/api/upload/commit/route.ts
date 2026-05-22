// src/app/api/upload/commit-tg/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        // 1. 承接前端传过来的全新分布式切片元数据
        const { fileId, name, size, folderId, chunks } = await req.json();

        // 2. 严格的参数校验熔断机制
        if (!fileId || !name || !chunks || !Array.isArray(chunks) || chunks.length === 0) {
            return NextResponse.json(
                { success: false, error: '未收到合法的 Telegram 切片元数据' },
                { status: 400 }
            );
        }

        // 验证首个分片，确保核心凭证字段没有丢
        const firstChunk = chunks[0];
        if (firstChunk.tg_group_id === undefined || firstChunk.tg_message_id === undefined) {
            return NextResponse.json(
                { success: false, error: '切片凭证(群组ID/消息ID)缺失，拒绝登记' },
                { status: 400 }
            );
        }

        // 3. 规范化文件夹归属
        let cleanFolderId: string | null = folderId;
        if (folderId === 'null' || folderId === 'undefined' || !folderId || String(folderId).trim() === '') {
            cleanFolderId = null;
        }

        // 4. 提取文件后缀名
        const extension = name.includes('.') ? name.split('.').pop() : '';

        // 5. 将前端的多群组切片数组序列化为 JSON 字符串
        // 结构类似于: [{"part_index":0,"tg_group_id":"-1001","tg_message_id":45}, ...]
        const allChunksStr = JSON.stringify(chunks);

        const urlsExpiredAt = 0; // Telegram 的服务器文件永不过期
        const channelId = null;  // 已经引入多群组轮询，单频道字段弃用，保留为 null
        const messageId = null;  // 单消息字段弃用，保留为 null

        // 6. 🚀 轰炸 D1 数据库，写入永久核心索引
        await queryD1(
            'INSERT INTO files (id, name, extension, size, cdn_urls, folder_id, urls_expired_at, channel_id, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                fileId,          // 前端生成的拟物化唯一文件 ID
                name,            // 原始文件名 (例如: my_photo.png)
                extension,       // 后缀名
                Number(size),    // 文件真实总大小 (Bytes)
                allChunksStr,    // 核心：分布式切片索引 JSON 字符串
                cleanFolderId,   // 文件夹层级归属
                urlsExpiredAt,   // 0 (永不过期)
                channelId,       // null
                messageId        // null
            ]
        );

        console.log(`[Telegram Upload Commit] 登记成功`);
        console.log(`ID: ${fileId} | Name: ${name} | 总大小: ${(size / 1024 / 1024).toFixed(1)}MB | 分布式切片数: ${chunks.length}`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Telegram Upload Commit] Database insertion error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}