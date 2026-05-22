// src/components/FileExplorer.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
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
    const [dragOverParent, setDragOverParent] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null); // 当前展开“更多”的操作项 ID
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [movingItem, setMovingItem] = useState<{ id: string; type: 'file' | 'folder'; name: string } | null>(null);

    const activeFolderId = currentFolder?.id || searchParams?.get('currentDir') || null;

    const saveMovingItem = (item: typeof movingItem) => {
        setMovingItem(item);
        if (item) {
            localStorage.setItem('pangu_transfer_station', JSON.stringify(item));
        } else {
            localStorage.removeItem('pangu_transfer_station');
        }
    };

    useEffect(() => {
        const savedItem = localStorage.getItem('pangu_transfer_station');
        if (savedItem) {
            try {
                setMovingItem(JSON.parse(savedItem));
            } catch (e) {
                localStorage.removeItem('pangu_transfer_station');
            }
        }
    }, []);

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


    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 请求移动文件位置（适配拖拽与暂存架双渠道）
    const handleMoveFile = async (itemId: string, targetFolderId: string | null, type: 'file' | 'folder' = 'file') => {
        try {
            const res = await fetch('/api/storage/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: itemId,
                    id: itemId,
                    type,
                    targetFolderId
                }),
            });

            if (!res.ok) throw new Error('移动失败');

            // 移动成功后清除暂存状态并刷新
            saveMovingItem(null);
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

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-emerald-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1l-3-3m-2 3h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            );
        }
        if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-purple-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            );
        }
        if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-pink-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
            );
        }
        if (['js', 'ts', 'py', 'json', 'html', 'css', 'go', 'rust', 'sh'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-amber-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            );
        }
        if (['md', 'txt'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-sky-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            );
        }
        if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-indigo-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            );
        }
        if (['pdf'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-rose-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            );
        }
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-yellow-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            );
        }
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
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
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
            setActiveMenuId(null);
        }
    };

    return (
        <div className="pangu-explorer-container relative bg-white rounded-xl shadow-sm border border-gray-200">
            {movingItem && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 border border-slate-700 max-w-[92vw] w-full md:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="text-xs truncate flex-1">
                        正在移动 <span className="text-yellow-400 font-semibold">{movingItem.name}</span>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={() => handleMoveFile(movingItem.id, activeFolderId, movingItem.type)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition"
                        >
                            放入此目录
                        </button>
                        <button
                            onClick={() => saveMovingItem(null)}
                            className="bg-slate-700 hover:bg-slate-600 text-gray-300 text-xs px-2.5 py-1.5 rounded-lg transition"
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}

            {/* 表头响应式比例调整：Name(7) Size(3) Actions(2) */}
            <div className="pangu-explorer-header grid grid-cols-12 p-3 text-xs font-bold text-gray-400 bg-gray-50 border-b border-gray-100 rounded-t-xl">
                <div className="col-span-7 pl-2">名称</div>
                <div className="col-span-3">大小</div>
                <div className="col-span-2 text-right pr-4">操作</div>
            </div>

            <div className="pangu-explorer-list divide-y divide-gray-100">
                {currentFolder && (
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverParent(true);
                        }}
                        onDragLeave={() => setDragOverParent(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOverParent(false);
                            const rawData = e.dataTransfer.getData('text/plain');
                            if (!rawData) return;
                            try {
                                const parsed = JSON.parse(rawData);
                                if (parsed.id !== currentFolder.id) {
                                    handleMoveFile(parsed.id, currentFolder.parentId, parsed.type);
                                }
                            } catch {
                                handleMoveFile(rawData, currentFolder.parentId, 'file');
                            }
                        }}
                        className={`pangu-explorer-folder-row grid grid-cols-12 p-3 text-sm items-center transition-all duration-150 group border border-transparent
                            ${dragOverParent ? 'bg-amber-100/80 border-amber-400 border-dashed rounded-lg scale-[0.99] mx-1' : 'hover:bg-gray-50/40'}`}
                    >
                        <div className="col-span-7 flex items-center gap-3 pl-2 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-hover:-translate-x-1 duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <Link href={currentFolder.parentId ? `/?currentDir=${currentFolder.parentId}` : '/'} className="pangu-folder-link text-gray-400 group-hover:text-blue-600 hover:underline font-mono font-bold text-base pointer-events-auto">
                                ...
                            </Link>
                        </div>
                        <div className="col-span-3 text-gray-400 text-xs select-none">返回上一级</div>
                        <div className="col-span-2 text-right pr-4 select-none text-gray-300">--</div>
                    </div>
                )}

                {/* 文件夹列表 */}
                {folders?.map((folder: any) => {
                    const isDragOver = dragOverFolderId === folder.id;
                    return (
                        <div
                            key={folder.id}
                            draggable={true}
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', JSON.stringify({ id: folder.id, type: 'folder' }));
                                e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverFolderId(folder.id);
                            }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOverFolderId(null);
                                const rawData = e.dataTransfer.getData('text/plain');
                                if (!rawData) return;
                                try {
                                    const parsed = JSON.parse(rawData);
                                    if (parsed.id !== folder.id) handleMoveFile(parsed.id, folder.id, parsed.type);
                                } catch {
                                    if (rawData !== folder.id) handleMoveFile(rawData, folder.id, 'file');
                                }
                            }}
                            className={`pangu-explorer-folder-row grid grid-cols-12 p-3 text-sm items-center transition-all duration-150 group border border-transparent
                                ${isDragOver ? 'bg-blue-100/70 border-blue-400 border-dashed rounded-lg scale-[0.99] mx-1' : 'hover:bg-blue-50/50'}`}
                        >
                            <div className="col-span-7 flex items-center gap-3 pl-2 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-blue-500 transition-transform group-hover:scale-110 duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <Link href={`/?currentDir=${folder.id}`} className="pangu-folder-link text-blue-600 hover:underline font-semibold truncate pointer-events-auto">
                                    {folder.name}
                                </Link>
                            </div>
                            <div className="col-span-3 text-gray-400 select-none">--</div>

                            {/* 文件夹操作响应式适配 */}
                            <div className="col-span-2 text-right pr-4 relative flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
                                {/* PC 端明示按钮 */}
                                <div className="hidden md:flex items-center gap-2">
                                    <button
                                        onClick={() => saveMovingItem({ id: folder.id, type: 'folder', name: folder.name })}
                                        className="text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition font-medium"
                                    >
                                        移动
                                    </button>
                                    <button
                                        disabled={purgingId === folder.id}
                                        onClick={(e) => handlePurge(e, folder.id, 'folder', folder.name)}
                                        className="pangu-delete-btn text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition text-xs disabled:opacity-50 font-medium"
                                    >
                                        {purgingId === folder.id ? '⚡' : '删除'}
                                    </button>
                                </div>

                                {/* 移动端折叠菜单 (⋮) */}
                                <div className="md:hidden" ref={activeMenuId === folder.id ? menuRef : null}>
                                    <button
                                        onClick={() => setActiveMenuId(activeMenuId === folder.id ? null : folder.id)}
                                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-base font-bold transition"
                                    >
                                        ⋮
                                    </button>
                                    {activeMenuId === folder.id && (
                                        <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-100 rounded-xl shadow-xl z-30 py-1 text-sm font-medium text-left">
                                            <button
                                                onClick={() => { saveMovingItem({ id: folder.id, type: 'folder', name: folder.name }); setActiveMenuId(null); }}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-amber-600"
                                            >
                                                移动至...
                                            </button>
                                            <hr className="border-gray-100 my-1" />
                                            <button
                                                disabled={purgingId === folder.id}
                                                onClick={(e) => handlePurge(e, folder.id, 'folder', folder.name)}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600 disabled:opacity-50"
                                            >
                                                × 删除目录
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* 2. 文件列表 */}
                {files?.map((file: any) => {
                    const ext = getFileExt(file.name);
                    return (
                        <div
                            key={file.id}
                            onClick={() => handleFileClick(file)}
                            draggable={true}
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', JSON.stringify({ id: file.id, type: 'file' }));
                                e.dataTransfer.effectAllowed = "move";
                            }}
                            className="pangu-explorer-file-row grid grid-cols-12 p-3 text-sm hover:bg-gray-50/80 items-center transition cursor-grab active:cursor-grabbing group"
                            data-ext={ext}
                        >
                            <div className="col-span-7 flex items-center gap-3 pl-2 min-w-0">
                                <span className="pangu-row-icon text-xl select-none transition-transform group-hover:scale-110 duration-150">
                                    {getFileIcon(ext)}
                                </span>
                                <span className="pangu-file-name text-gray-700 font-medium truncate group-hover:text-blue-600 transition-colors">
                                    {file.name}
                                </span>
                            </div>
                            <div className="pangu-file-size col-span-3 text-gray-500 text-xs md:text-sm">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>

                            {/* 文件操作区域响应式适配 */}
                            <div className="col-span-2 text-right pr-4 relative flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
                                {/* PC 端操作铺开 */}
                                <div className="hidden md:flex items-center gap-2">
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
                                        onClick={() => saveMovingItem({ id: file.id, type: 'file', name: file.name })}
                                        className="text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition font-medium"
                                    >
                                        移动
                                    </button>
                                    <button
                                        disabled={purgingId === file.id}
                                        onClick={(e) => handlePurge(e, file.id, 'file', file.name)}
                                        className="pangu-delete-btn inline-flex items-center text-red-600 font-medium hover:text-red-700 hover:underline bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition text-xs disabled:opacity-50"
                                    >
                                        {purgingId === file.id ? '⚡' : '× 删除'}
                                    </button>
                                </div>

                                {/* 移动端折叠菜单 (⋮) */}
                                <div className="md:hidden" ref={activeMenuId === file.id ? menuRef : null}>
                                    <button
                                        onClick={() => setActiveMenuId(activeMenuId === file.id ? null : file.id)}
                                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-base font-bold transition"
                                    >
                                        ⋮
                                    </button>
                                    {activeMenuId === file.id && (
                                        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-30 py-1 text-sm font-medium text-left">
                                            <button
                                                onClick={(e) => { handleCopyLink(e, file.id); setActiveMenuId(null); }}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-blue-600"
                                            >
                                                {copiedId === file.id ? '已复制链接' : '复制下载链接'}
                                            </button>
                                            <a
                                                href={`/api/download?file_id=${file.id}`}
                                                className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-emerald-600"
                                            >
                                                ↓ 下载文件
                                            </a>
                                            <button
                                                onClick={() => { saveMovingItem({ id: file.id, type: 'file', name: file.name }); setActiveMenuId(null); }}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-amber-600"
                                            >
                                                移动至...
                                            </button>
                                            <hr className="border-gray-100 my-1" />
                                            <button
                                                disabled={purgingId === file.id}
                                                onClick={(e) => handlePurge(e, file.id, 'file', file.name)}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600 disabled:opacity-50"
                                            >
                                                × 删除文件
                                            </button>
                                        </div>
                                    )}
                                </div>
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