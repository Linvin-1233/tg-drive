// src/app/api/upload/commit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { name, size, folderId, urls } = await req.json();

        if (!name || !urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ success: false, error: '未收到合法的切片链接列表' }, { status: 400 });
        }

        // 强行清洗 folderId
        let cleanFolderId: string | null = folderId;
        if (folderId === 'null' || folderId === 'undefined' || !folderId || String(folderId).trim() === '') {
            cleanFolderId = null;
        }

        const fileId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const extension = name.includes('.') ? name.split('.').pop() : '';
        const allUrlsStr = urls.join(',');

        await queryD1(
            'INSERT INTO files (id, name, extension, size, cdn_urls, folder_id) VALUES (?, ?, ?, ?, ?, ?)',
            [fileId, name, extension, Number(size), allUrlsStr, cleanFolderId]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('SQL错误:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}