// src/components/FileExplorer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface FileExplorerProps {
    folders: any[];
    files: any[];
    currentFolder?: { id: any; name: any; parentId: any } | null;
}

export default function FileExplorer({ folders, files, currentFolder }: FileExplorerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [purgingId, setPurgingId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    const activeFolderId = currentFolder?.id || searchParams?.get('currentDir') || null;

    // 离开当前文件夹、刷新、或关闭网页时自动擦除 Cookie
    useEffect(() => {
        if (!activeFolderId) return;

        const clearFolderAccess = () => {
            fetch(`/api/folder/logout?id=${activeFolderId}`, {
                method: 'POST',
                keepalive: true
            });
        };

        window.addEventListener('beforeunload', clearFolderAccess);
        return () => {
            window.removeEventListener('beforeunload', clearFolderAccess);
            clearFolderAccess();
        };
    }, [activeFolderId]);

    // 请求移动文件位置
    const handleMoveFile = async (fileId: string, targetFolderId: string) => {
        try {
            const res = await fetch('/api/storage/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId, targetFolderId }),
            });

            if (!res.ok) throw new Error('移动文件失败');

            // 成功后无刷新重载当前服务器组件数据
            router.refresh();
        } catch (err: any) {
            alert(`[MOVE_ERROR] >> ${err.message}`);
        }
    };

    const getFileExt = (fileName: string) => {
        return fileName.split('.').pop()?.toLowerCase() || 'unknown';
    };

    const getFileIcon = (ext: string) => {
        const baseClass = "h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110 duration-150";

        // 图片类
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-emerald-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1l-3-3m-2 3h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            );
        }

        // 视频类
        if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-purple-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            );
        }

        // 音频类
        if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-pink-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
            );
        }

        // 代码类
        if (['js', 'ts', 'py', 'json', 'html', 'css', 'go', 'rust', 'sh'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-amber-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            );
        }

        // 文档类
        if (['md', 'txt'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-sky-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            );
        }

        // 办公类
        if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-indigo-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            );
        }

        // PDF 类
        if (['pdf'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-rose-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            );
        }

        // 压缩包类
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-yellow-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            );
        }

        // 默认兜底
        return (
            <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        );
    };

    const handleFileClick = (file: any) => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.set('preview', file.id);
        router.push(`/?${params.toString()}`);
    };

    const handleCopyLink = async (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();
        const downloadUrl = `${window.location.origin}/api/download?file_id=${fileId}`;
        try {
            await navigator.clipboard.writeText(downloadUrl);
            setCopiedId(fileId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            alert('复制失败');
        }
    };

    const handlePurge = async (e: React.MouseEvent, id: string, type: 'file' | 'folder', name: string) => {
        e.stopPropagation();

        const confirmMsg = type === 'folder'
            ? `是否确认删除文件夹 [${name}]？\n这将导致文件夹内所有文件将永久删除`
            : `确认删除文件 [${name}] 吗？`;

        if (!window.confirm(confirmMsg)) return;

        setPurgingId(id);
        try {
            const res = await fetch('/api/storage/purge', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, type }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || '删除请求被拒绝');
            }

            router.refresh();
        } catch (err: any) {
            alert(`[PURGE_ERROR] >> ${err.message}`);
        } finally {
            setPurgingId(null);
        }
    };

    return (
        <div className="pangu-explorer-container bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="pangu-explorer-header grid grid-cols-12 p-3 text-xs font-bold text-gray-400 bg-gray-50 border-b border-gray-100">
                <div className="col-span-6 md:col-span-7 pl-2">名称</div>
                <div className="col-span-3 md:col-span-2">大小</div>
                <div className="col-span-3 text-right pr-4">操作</div>
            </div>

            <div className="pangu-explorer-list divide-y divide-gray-100">
                {/* 1. 文件夹列表 - 作为投放接收端 (Drop Target) */}
                {folders?.map((folder: any) => {
                    const isDragOver = dragOverFolderId === folder.id;
                    return (
                        <div
                            key={folder.id}
                            // ⚡ 挂载 HTML5 拖拽目标核心事件监听器
                            onDragOver={(e) => {
                                e.preventDefault(); // 阻止浏览器默认拦截行为，允许拖放投放
                                setDragOverFolderId(folder.id);
                            }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOverFolderId(null);
                                const fileId = e.dataTransfer.getData('text/plain');
                                if (fileId) handleMoveFile(fileId, folder.id);
                            }}
                            // ⚡ 配合拖拽激活样式：边框变深蓝虚线、背景微调、微缩营造微弱重力触觉
                            className={`pangu-explorer-folder-row grid grid-cols-12 p-3 text-sm items-center transition-all duration-150 group border border-transparent
                                ${isDragOver ? 'bg-blue-100/70 border-blue-400 border-dashed rounded-lg scale-[0.99] mx-1' : 'hover:bg-blue-50/50'}`}
                        >
                            <div className="col-span-6 md:col-span-7 flex items-center gap-3 pl-2 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-blue-500 transition-transform group-hover:scale-110 duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <Link href={`/?currentDir=${folder.id}`} className="pangu-folder-link text-blue-600 hover:underline font-semibold truncate pointer-events-auto">
                                    {folder.name}
                                </Link>
                            </div>
                            <div className="col-span-3 md:col-span-2 text-gray-400 select-none">--</div>
                            <div className="col-span-3 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                <button
                                    disabled={purgingId === folder.id}
                                    onClick={(e) => handlePurge(e, folder.id, 'folder', folder.name)}
                                    className="pangu-delete-btn inline-flex items-center text-red-600 font-medium hover:text-red-700 hover:underline bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition text-xs disabled:opacity-50"
                                >
                                    {purgingId === folder.id ? '⚡' : '× 删除'}
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* 2. 文件列表 - 作为拖拽输出端 (Drag Source) */}
                {files?.map((file: any) => {
                    const ext = getFileExt(file.name);
                    return (
                        <div
                            key={file.id}
                            onClick={() => handleFileClick(file)}
                            // ⚡ 启用 HTML5 原生可拖拽容器属性
                            draggable={true}
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', file.id);
                                e.dataTransfer.effectAllowed = "move";
                            }
                        }
                            className="pangu-explorer-file-row grid grid-cols-12 p-3 text-sm hover:bg-gray-50/80 items-center transition cursor-grab active:cursor-grabbing group"
                            data-ext={ext}
                        >
                            <div className="col-span-6 md:col-span-7 flex items-center gap-3 pl-2">
                                <span className="pangu-row-icon text-xl select-none transition-transform group-hover:scale-110 duration-150">
                                    {getFileIcon(ext)}
                                </span>
                                <span className="pangu-file-name text-gray-700 font-medium truncate group-hover:text-blue-600 transition-colors">
                                    {file.name}
                                </span>
                            </div>
                            <div className="pangu-file-size col-span-3 md:col-span-2 text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                            <div className="col-span-3 text-right pr-4 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={(e) => handleCopyLink(e, file.id)}
                                    className="pangu-copy-btn text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition font-medium"
                                >
                                    {copiedId === file.id ? '✓ 已复制' : '复制下载链接'}
                                </button>
                                <a
                                    href={`/api/download?file_id=${file.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="pangu-download-btn inline-flex items-center text-emerald-600 font-medium hover:text-emerald-700 hover:underline bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded transition text-xs"
                                >
                                    ↓ 下载
                                </a>
                                <button
                                    disabled={purgingId === file.id}
                                    onClick={(e) => handlePurge(e, file.id, 'file', file.name)}
                                    className="pangu-delete-btn inline-flex items-center text-red-600 font-medium hover:text-red-700 hover:underline bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition text-xs disabled:opacity-50"
                                >
                                    {purgingId === file.id ? '⚡' : '× 删除'}
                                </button>
                            </div>
                        </div>
                    );
                })}

                {(!folders || !files || (folders.length === 0 && files.length === 0)) && (
                    <div className="pangu-explorer-empty p-12 text-center text-gray-400 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        空空如也，赶快上传一个大文件吧
                    </div>
                )}
            </div>
        </div>
    );
}