'use server';

import { queryD1 } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcrypt-ts';

// 创建文件夹
export async function createFolder(formData: FormData) {
    const name = formData.get('name') as string;
    const parentId = (formData.get('parentId') as string) || null;
    const password = formData.get('password') as string;

    if (!name) return;

    // 保持你原有的随机 ID 生成逻辑
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);

    let isLocked = 0;
    let passwordHash = null;

    // 如果用户输入了密码（非空字符串），则启用加锁并进行哈希
    if (password && password.trim() !== '') {
        isLocked = 1;
        passwordHash = await hash(password, 10);
    }

    try {
        // 同步写入密码状态和哈希密文
        await queryD1(
            'INSERT INTO folders (id, name, parent_id, is_locked, password_hash) VALUES (?, ?, ?, ?, ?)',
            [id, name, parentId, isLocked, passwordHash]
        );
    } catch (error) {
        console.error("D1 写入文件夹失败:", error);
        throw error;
    }

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