// src/app/actions.ts
'use server';

import { queryD1 } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// 创建文件夹
export async function createFolder(formData: FormData) {
    const name = formData.get('name') as string;
    const parentId = (formData.get('parentId') as string) || null;
    if (!name) return;

    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await queryD1('INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)', [id, name, parentId]);

    revalidatePath('/');
}

// 注册文件元数据入库
export async function registerFile(data: { name: string; size: number; tgFileId: string; folderId: string | null }) {
    const { name, size, tgFileId, folderId } = data;

    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const extension = name.includes('.') ? name.split('.').pop() : '';

    await queryD1(
        'INSERT INTO files (id, name, extension, size, tg_file_id, folder_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, extension, size, tgFileId, folderId]
    );

    revalidatePath('/');
}