// src/app/api/storage/purge/route.ts
import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export async function DELETE(req: Request) {
    try {
        const { id, type } = await req.json();

        if (!id) {
            return NextResponse.json(
                { message: 'BAD_REQUEST: 缺失凭证识别 id' },
                { status: 400 }
            );
        }

        if (type === 'file') {
            await queryD1('DELETE FROM files WHERE id = ?', [id]);
        } else if (type === 'folder') {
            await purgeD1FolderRecursive(id);
        }

        return NextResponse.json({
            success: true,
            message: '已重置SQL数据库'
        });
    } catch (error: any) {
        console.error('[PURGE_D1_API_CRASH]:', error);
        return NextResponse.json(
            { message: error.message || '删除失败' },
            { status: 500 }
        );
    }
}

async function purgeD1FolderRecursive(targetFolderId: string) {
    const foldersToPurge: string[] = [targetFolderId];
    const allFolderIdsToDelete: string[] = [targetFolderId];

    while (foldersToPurge.length > 0) {
        const currentId = foldersToPurge.pop();
        const subFolders = await queryD1('SELECT id FROM folders WHERE parent_id = ?', [currentId]);

        for (const row of subFolders) {
            foldersToPurge.push(row.id);
            allFolderIdsToDelete.push(row.id);
        }
    }
    const placeholders = allFolderIdsToDelete.map(() => '?').join(',');
    await queryD1(
        `DELETE FROM files WHERE folder_id IN (${placeholders})`,
        allFolderIdsToDelete
    );

    await queryD1(
        `DELETE FROM folders WHERE id IN (${placeholders})`,
        allFolderIdsToDelete
    );
}