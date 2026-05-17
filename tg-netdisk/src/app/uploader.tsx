'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Uploader({ currentDir }: { currentDir: string | null }) {
    const [status, setStatus] = useState('');
    const [progress, setProgress] = useState<number | null>(null);
    const router = useRouter();

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const MAX_FILE_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            alert(`单文件最大支持 500MB。\n您当前文件大小为: ${(file.size / 1024 / 1024).toFixed(1)}MB，请分卷压缩或更换小文件。`);
            // 清空选择框
            e.target.value = '';
            return;
        }

        setStatus('正在进行本地切片...');
        setProgress(0);

        const CHUNK_SIZE = 9 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const chunkUrls: string[] = new Array(totalChunks);

        let uploadedCount = 0;
        const CONCURRENCY = 2; // 2路并发
        let currentChunkIndex = 0;

        // 辅助工具：休眠器
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const uploadChunkWithRetry = async (index: number, retryCount = 0): Promise<void> => {
            const MAX_RETRIES = 5;
            const start = index * CHUNK_SIZE;
            const end = Math.min(file.size, start + CHUNK_SIZE);
            const chunkBlob = file.slice(start, end);

            // 主动出闸节拍器
            if (retryCount === 0) {
                await sleep((index % CONCURRENCY) * 500); // 稍微拉大到 500ms 错峰更稳健
            }

            const formData = new FormData();
            formData.append('file', chunkBlob, `${file.name}.part${index + 1}`);

            try {
                const res = await fetch(`/api/upload/chunk?part=${index + 1}&name=${encodeURIComponent(file.name)}`, {
                    method: 'POST',
                    body: formData
                });

                // 拦截重组：只要状态码是 429，一律无条件捕获并强制自愈
                if (res.status === 429) {
                    if (retryCount < MAX_RETRIES) {
                        const data = await res.json().catch(() => ({}));
                        // 如果后端传回了 retryAfter 就用它，没有就根据重试次数递增兜底（3s, 6s, 12s...）
                        const retryAfter = data.retryAfter || (Math.pow(2, retryCount) * 3);
                        const waitMs = (retryAfter * 1000) + 1500; // 遵循官方指示 + 1.5秒缓冲

                        console.warn(`[强行捕获 429] 块 ${index + 1} 踩雷。sleep ${(waitMs / 1000).toFixed(1)} 秒...`);
                        setStatus(`块 ${index + 1} 被限制`);

                        await sleep(waitMs);
                        return uploadChunkWithRetry(index, retryCount + 1);
                    } else {
                        throw new Error(`块 ${index + 1} 撞击 Discord 频控墙达到上限，拒绝传输`);
                    }
                }

                // 🎯 2. 解析正常响应
                const data = await res.json().catch(() => ({}));

                // 处理其他非 429 的异常（比如 500, 504 等）
                if (!res.ok) {
                    throw new Error(data.error || `HTTP ${res.status}`);
                }

                chunkUrls[index] = data.url;
                uploadedCount++;
                setProgress(Math.round((uploadedCount / totalChunks) * 100));
                setStatus(`并发传输中: ${uploadedCount}/${totalChunks} 块`);

            } catch (err: any) {
                // 非 429 的普通网络断流抖动兜底
                if (retryCount < MAX_RETRIES) {
                    const fallbackDelay = 3000;
                    console.warn(`[网络抖动] 块 ${index + 1} 失败 (${err.message})。3秒后重试...`);
                    await sleep(fallbackDelay);
                    return uploadChunkWithRetry(index, retryCount + 1);
                } else {
                    throw err; // 彻底放弃
                }
            }
        };

        // 线程池流控
        const pool = async () => {
            const workers = [];
            while (currentChunkIndex < totalChunks) {
                const taskIndex = currentChunkIndex++;
                const p = uploadChunkWithRetry(taskIndex).then(() => {
                    return pool();
                });
                workers.push(p);
                if (workers.length >= CONCURRENCY) {
                    await Promise.race(workers);
                }
            }
            await Promise.all(workers);
        };

        try {
            await pool();

            setStatus('正在向 D1 数据库登记索引...');
            const commitRes = await fetch('/api/upload/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    size: file.size,
                    folderId: currentDir,
                    urls: chunkUrls
                })
            });

            if (!commitRes.ok) throw new Error('提交 D1 失败');

            setStatus('🎉 大文件抗风控并发直传成功！');
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert('传输中断: ' + error.message);
            setStatus('传输失败');
        } finally {
            setTimeout(() => { setProgress(null); setStatus(''); }, 3000);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <input
                type="file"
                className="text-xs text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 file:cursor-pointer"
                onChange={handleUpload}
            />
            {status && (
                <div className="flex items-center gap-2">
                    {progress !== null && (
                        <div className="w-24 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full transition-all duration-150" style={{ width: `${progress}%` }}></div>
                        </div>
                    )}
                    <span className="text-xs text-blue-600 font-medium">{status}</span>
                </div>
            )}
        </div>
    );
}