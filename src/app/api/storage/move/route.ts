import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { fileId, targetFolderId } = await request.json();

        if (!fileId) {
            return NextResponse.json({ success: false, message: '缺少文件 ID' }, { status: 400 });
        }

        // ⚡ 将文件的 folder_id 更新为目标文件夹的 ID（如果移到根目录则为 null）
        await queryD1(
            'UPDATE files SET folder_id = ? WHERE id = ?',
            [targetFolderId || null, fileId]
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[MOVE_FILE_ERROR] >>', err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}