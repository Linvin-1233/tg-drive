// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import { queryD1 } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const TMP_DIR = path.join(process.cwd(), '.next', 'cache', 'tmp_mtproto');

export async function POST(req: NextRequest) {
    const apiId = parseInt(process.env.TG_API_ID || '0');
    const apiHash = process.env.TG_API_HASH || '';
    const botToken = process.env.TG_BOT_TOKEN || '';
    const chatId = process.env.TG_CHAT_ID || '';

    if (!botToken || apiId === 0 || !apiHash) {
        return NextResponse.json({ success: false, error: '存储密钥凭证未完全加载' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || 'unnamed_file';
    const size = parseInt(searchParams.get('size') || '0');
    const folderId = searchParams.get('folderId') === 'null' ? null : searchParams.get('folderId');

    if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
    }

    const tempFilePath = path.join(TMP_DIR, `${Date.now()}-${name}`);

    // 定义 client 引用以便在 finally 块中进行强力垃圾回收
    let client: TelegramClient | null = null;

    try {
        if (!req.body) throw new Error('请求体为空');

        // 安全流式落盘
        const fileStream = fs.createWriteStream(tempFilePath);
        const nodeReadable = Object.assign(
            require('stream').Readable.fromWeb(req.body as any)
        );
        await pipeline(nodeReadable, fileStream);

        // 初始化客户端模拟器
        client = new TelegramClient(new StringSession(""), apiId, apiHash, {
            connectionRetries: 3, // 降低重试次数，避免网络不好时死循环卡死 Node 进程
            timeout: 15000,       // 缩短超时界限
            useWSS: true,         // ✨ 核心调优：强制走加密 WSS 隧道，将所有数据与控制信号合流，彻底解决多通道 TIMEOUT 恶疾
        });

        await client.connect();

        // 纯底层 Bot 身份验证
        await client.invoke(
            new Api.auth.ImportBotAuthorization({
                flags: 0,
                apiId: apiId,
                apiHash: apiHash,
                botAuthToken: botToken,
            })
        );

        // 双线程极速直传
        const toUpload = new CustomFile(name, size, tempFilePath);
        const result = await client.sendFile(chatId, {
            file: toUpload,
            workers: 2,
        });

        // 提取大文件媒介 ID
        const media = result.media as any;
        const tgFileId = media?.document?.id?.toString() || 'mtproto_file';

        // 登记入库 D1
        const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const extension = name.includes('.') ? name.split('.').pop() : '';

        await queryD1(
            'INSERT INTO files (id, name, extension, size, tg_file_id, folder_id) VALUES (?, ?, ?, ?, ?, ?)',
            [id, name, extension, size, tgFileId, folderId]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('MTProto 大文件直传错误:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        // ✨ 强制销毁连接与清理物理残留
        if (client) {
            try {
                await client.disconnect();
                // 用 destroy 彻底抹除常驻内存中的所有后台定时器、心跳连接，让 TIMEOUT 永无翻身之日
                await client.destroy();
            } catch (e) {}
        }

        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}