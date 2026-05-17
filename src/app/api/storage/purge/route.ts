// src/app/api/storage/purge/route.ts
import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db'; // 🎯 完美对接你写的高级 D1 桥接函数

export async function DELETE(req: Request) {
    try {
        const { id, type } = await req.json();

        if (!id) {
            return NextResponse.json(
                { message: 'BAD_REQUEST: 缺失核心凭证识别码 id' },
                { status: 400 }
            );
        }

        if (type === 'file') {
            // 🛑 1. 单个文件直接物理超度
            await queryD1('DELETE FROM files WHERE id = ?', [id]);
        } else if (type === 'folder') {
            // 🛑 2. 文件夹启动 D1 专属级联清理矩阵
            await purgeD1FolderRecursive(id);
        }

        return NextResponse.json({
            success: true,
            message: 'SIGNAL_TERMINATED // D1 映射矩阵已重置，数据已坠入虚无'
        });
    } catch (error: any) {
        console.error('[PURGE_D1_API_CRASH]:', error);
        return NextResponse.json(
            { message: error.message || '执行 D1 核心元数据熔断失败' },
            { status: 500 }
        );
    }
}

/**
 * 🟩 适配 Cloudflare D1 HTTP API 的迭代递归数据湮灭引擎
 * (使用一个“待销毁队列”层层向下收集所有子文件夹 ID)
 */
async function purgeD1FolderRecursive(targetFolderId: string) {
    // 1. 创建一个待删除的文件夹 ID 栈，初始把当前目标扔进去
    const foldersToPurge: string[] = [targetFolderId];
    // 2. 创建一个最终全量删除文件夹的收集池
    const allFolderIdsToDelete: string[] = [targetFolderId];

    // 🚀 核心：通过 D1 HTTP 桥接执行图层扫描，捞出所有子孙文件夹的 ID
    while (foldersToPurge.length > 0) {
        const currentId = foldersToPurge.pop();

        // 🎯 提示：如果你的表字段叫 parentId，请把这里的 parent_id 改掉
        const subFolders = await queryD1('SELECT id FROM folders WHERE parent_id = ?', [currentId]);

        for (const row of subFolders) {
            foldersToPurge.push(row.id);
            allFolderIdsToDelete.push(row.id); // 扩充终极抹杀池
        }
    }

    // 3. 一刀切：全量秒杀收集到的所有文件夹目录下的【全部文件】
    // 拼出形如 (?, ?, ?) 的占位符，D1 对 IN 语法的防注入支持非常完美
    const placeholders = allFolderIdsToDelete.map(() => '?').join(',');

    // 🎯 提示：如果你的文件表关联字段叫 folderId，请把这里的 folder_id 改掉
    await queryD1(
        `DELETE FROM files WHERE folder_id IN (${placeholders})`,
        allFolderIdsToDelete
    );

    // 4. 彻底斩草除根：批量抹去这批文件夹自身的所有元数据记录
    await queryD1(
        `DELETE FROM folders WHERE id IN (${placeholders})`,
        allFolderIdsToDelete
    );
}