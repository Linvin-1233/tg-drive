// src/app/uploader.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UploadFile {
    id: string;
    file: File;
    name: string;
    size: number;
    progress: number;
    status: 'waiting' | 'uploading' | 'success' | 'error';
    statusText: string;
}

export default function Uploader({ currentDir }: { currentDir: string | null }) {
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [showOverlay, setShowOverlay] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const fileListRef = useRef<UploadFile[]>([]);
    const isProcessingQueue = useRef(false);
    const router = useRouter();
    const dragCounter = useRef(0);

    const setFileListSynchronized = (updater: UploadFile[] | ((prev: UploadFile[]) => UploadFile[])) => {
        setFileList(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            fileListRef.current = next;
            return next;
        });
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const updateFileState = (id: string, updates: Partial<Pick<UploadFile, 'progress' | 'status' | 'statusText'>>) => {
        setFileListSynchronized(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const uploadSingleFile = async (targetId: string): Promise<boolean> => {
        const currentItem = fileListRef.current.find(f => f.id === targetId);
        if (!currentItem) return false;

        const file = currentItem.file;
        const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

        if (file.size > MAX_FILE_SIZE) {
            updateFileState(targetId, { status: 'error', statusText: '体积超限，最大支持 2GB' });
            return false;
        }

        try {
            updateFileState(targetId, { status: 'uploading', statusText: '获取云端凭证...' });

            const configRes = await fetch('/api/config/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (!configRes.ok) {
                const errData = await configRes.json().catch(() => ({}));
                updateFileState(targetId, { status: 'error', statusText: errData.error || '会话过期' });
                return false;
            }

            const { token, groupIds } = await configRes.json();
            if (!token || !groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
                throw new Error('云端配置不完整');
            }

            updateFileState(targetId, { statusText: '规划本地切片...' });

            const CHUNK_SIZE = 20 * 1024 * 1024;
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            const fileId = `file_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;

            const uploadedChunksInfo: Array<{ part_index: number; tg_group_id: string; tg_message_id: number; tg_file_id: string; }> = [];

            for (let i = 0; i < totalChunks; i++) {
                const partNumber = i + 1;
                const targetGroupId = groupIds[i % groupIds.length];

                if (!targetGroupId || targetGroupId === 'undefined') {
                    throw new Error(`第 ${partNumber} 块路由映射失败`);
                }

                updateFileState(targetId, { statusText: `直传中: ${partNumber}/${totalChunks} 块` });

                const start = i * CHUNK_SIZE;
                const end = Math.min(file.size, start + CHUNK_SIZE);
                const chunkBlob = file.slice(start, end);

                const formData = new FormData();
                formData.append('chat_id', targetGroupId);
                formData.append('document', chunkBlob, `${file.name}.part_${partNumber}`);

                let success = false;
                let retryCount = 0;
                const MAX_RETRIES = 3;

                while (!success && retryCount < MAX_RETRIES) {
                    try {
                        const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!res.ok) {
                            const rawErrorText = await res.text().catch(() => '无法读取报错');
                            if (res.status === 429) {
                                try {
                                    const errObj = JSON.parse(rawErrorText);
                                    if (errObj.parameters?.retry_after) {
                                        const waitTime = errObj.parameters.retry_after * 1000;
                                        updateFileState(targetId, { statusText: `频控冷却: ${(waitTime / 1000).toFixed(1)}s` });
                                        await sleep(waitTime);
                                    }
                                } catch (_) {}
                            }
                            throw new Error(`TG_HTTP_${res.status}`);
                        }

                        const resData = await res.json();
                        const tgMessageId = resData.result.message_id;
                        const tgFileId = resData.result.document?.file_id || resData.result.video?.file_id || resData.result.audio?.file_id;

                        uploadedChunksInfo.push({
                            part_index: i,
                            tg_group_id: String(targetGroupId),
                            tg_message_id: Number(tgMessageId),
                            tg_file_id: String(tgFileId)
                        });

                        success = true;
                    } catch (err: any) {
                        retryCount++;
                        updateFileState(targetId, { statusText: `块 ${partNumber} 重试 (${retryCount}/3)...` });
                        await sleep(3000);
                    }
                }

                if (!success) throw new Error(`块 ${partNumber} 连续重试失败，熔断`);

                updateFileState(targetId, { progress: Math.round((partNumber / totalChunks) * 100) });

                if (i < totalChunks - 1) await sleep(1200);
            }

            updateFileState(targetId, { statusText: '登记索引至D1...' });
            const commitRes = await fetch('/api/upload/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: fileId,
                    name: file.name,
                    size: file.size,
                    folderId: currentDir,
                    chunks: uploadedChunksInfo
                })
            });

            if (!commitRes.ok) {
                const errorData = await commitRes.json().catch(() => ({}));
                throw new Error(errorData.error || `D1错误: ${commitRes.status}`);
            }

            updateFileState(targetId, { status: 'success', statusText: '传输成功', progress: 100 });

            setTimeout(() => {
                setFileListSynchronized(prev => prev.filter(f => f.id !== targetId));
            }, 3000);

            return true;
        } catch (error: any) {
            console.error(error);
            updateFileState(targetId, { status: 'error', statusText: `失败: ${error.message}` });
            return false;
        }
    };

    const processQueue = async () => {
        if (isProcessingQueue.current) return;
        isProcessingQueue.current = true;
        try {
            while (true) {
                const nextFile = fileListRef.current.find(f => f.status === 'waiting');
                if (!nextFile) break;
                await uploadSingleFile(nextFile.id);
                router.refresh();
                await sleep(1000);
            }
        } catch (queueErr) {
            console.error("队列异常中断:", queueErr);
        } finally {
            isProcessingQueue.current = false;
            const doubleCheckNext = fileListRef.current.find(f => f.status === 'waiting');
            if (doubleCheckNext) {
                processQueue();
            }
        }
    };

    const addFilesToQueue = (files: File[]) => {
        const newUploadFiles: UploadFile[] = files.map(file => ({
            id: `file_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`,
            file: file,
            name: file.name,
            size: file.size,
            progress: 0,
            status: 'waiting',
            statusText: '排队中...'
        }));
        setFileListSynchronized(prev => [...prev, ...newUploadFiles]);
        setIsMinimized(false);
        setTimeout(() => { processQueue(); }, 30);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFilesToQueue(Array.from(e.target.files));
            e.target.value = '';
        }
    };

    useEffect(() => {
        const handleWindowDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current++;
            if (e.dataTransfer && e.dataTransfer.items.length > 0) {
                setShowOverlay(true);
            }
        };
        const handleWindowDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current--;
            if (dragCounter.current === 0) {
                setShowOverlay(false);
            }
        };
        const handleWindowDragOver = (e: DragEvent) => { e.preventDefault(); };
        const handleWindowDrop = (e: DragEvent) => {
            e.preventDefault();
            setShowOverlay(false);
            dragCounter.current = 0;
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                addFilesToQueue(Array.from(e.dataTransfer.files));
            }
        };

        window.addEventListener('dragenter', handleWindowDragEnter);
        window.addEventListener('dragleave', handleWindowDragLeave);
        window.addEventListener('dragover', handleWindowDragOver);
        window.addEventListener('drop', handleWindowDrop);
        return () => {
            window.removeEventListener('dragenter', handleWindowDragEnter);
            window.removeEventListener('dragleave', handleWindowDragLeave);
            window.removeEventListener('dragover', handleWindowDragOver);
            window.removeEventListener('drop', handleWindowDrop);
        };
    }, [currentDir]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const successCount = fileList.filter(f => f.status === 'success').length;
    const activeFile = fileList.find(f => f.status === 'uploading');

    return (
        <>
            <div className="relative inline-block w-full sm:w-auto">
                <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <button type="button" className="pangu-upload-input text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2.5 rounded-lg transition-colors cursor-pointer w-full sm:w-auto text-center block">
                    🚀 上传文件
                </button>
            </div>

            {fileList.length > 0 && (
                /* ⚡ 响应式重构核心：移动端下自动切换为通宽，靠底贴紧，完美阻断侧向溢出 */
                <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-40 w-auto md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 flex flex-col max-w-full">
                    <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between select-none">
                        <div className="text-xs font-medium truncate flex-1 pr-2">
                            {activeFile
                                ? `上传中: ${activeFile.name} (${activeFile.progress}%)`
                                : `任务绪 (${successCount}/${fileList.length})`
                            }
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() => setIsMinimized(!isMinimized)}
                                className="text-gray-400 hover:text-white transition-colors text-sm font-bold w-4 h-4 flex items-center justify-center"
                            >
                                {isMinimized ? "＋" : "－"}
                            </button>
                            <button
                                onClick={() => setFileListSynchronized([])}
                                className="text-gray-400 hover:text-red-400 transition-colors text-xs"
                            >
                                关闭
                            </button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <div className="max-h-52 md:max-h-64 overflow-y-auto p-2 space-y-1.5 bg-gray-50/50">
                            {fileList.map((item) => (
                                <div key={item.id} className="p-2 bg-white rounded-lg border border-gray-100 flex flex-col gap-1">
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <div className="min-w-0 flex-1 flex items-center gap-1">
                                            <span className="text-gray-400 flex-shrink-0">📄</span>
                                            <span className="text-gray-700 font-medium truncate">{item.name}</span>
                                            <span className="text-[10px] text-gray-400 flex-shrink-0">({formatSize(item.size)})</span>
                                        </div>
                                        <div className="flex-shrink-0 font-mono text-[10px]">
                                            {item.status === 'waiting' && <span className="text-gray-400 bg-gray-100 px-1 py-0.5 rounded">排队</span>}
                                            {item.status === 'uploading' && <span className="text-blue-600 bg-blue-50 font-medium px-1 py-0.5 rounded truncate max-w-[80px] inline-block">{item.statusText}</span>}
                                            {item.status === 'success' && <span className="text-green-600 bg-green-50 font-medium px-1 py-0.5 rounded">成功</span>}
                                            {item.status === 'error' && <span className="text-red-600 bg-red-50 font-medium px-1 py-0.5 rounded" title={item.statusText}>失败</span>}
                                        </div>
                                    </div>
                                    {item.status === 'uploading' && (
                                        <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden mt-1">
                                            <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}