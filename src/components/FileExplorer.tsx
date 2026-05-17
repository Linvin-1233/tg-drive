// src/components/FileExplorer.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface FileExplorerProps {
    folders: any[];
    files: any[];
}

export default function FileExplorer({ folders, files }: FileExplorerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const getFileExt = (fileName: string) => {
        return fileName.split('.').pop()?.toLowerCase() || 'unknown';
    };

    const getFileIcon = (ext: string) => {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
        if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return '🎬';
        if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) return '🎵';
        if (['md', 'txt'].includes(ext)) return '📝';
        if (['js', 'ts', 'py', 'json', 'html', 'css'].includes(ext)) return '💻';
        if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) return '📊';
        if (['pdf'].includes(ext)) return '📕';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
        return '📄';
    };

    const handleFileClick = (file: any) => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.set('preview', file.id);
        router.push(`/?${params.toString()}`);
    };

    return (
        // 外部钩子: pangu-explorer-container
        <div className="pangu-explorer-container bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

            {/* 表头 - 外部钩子: pangu-explorer-header */}
            <div className="pangu-explorer-header grid grid-cols-12 p-3 text-xs font-bold text-gray-400 bg-gray-50 border-b border-gray-100">
                <div className="col-span-6 md:col-span-7 pl-2">名称</div>
                <div className="col-span-3 md:col-span-2">大小</div>
                <div className="col-span-3 text-right pr-4">操作</div>
            </div>

            {/* 列表大合集 - 外部钩子: pangu-explorer-list */}
            <div className="pangu-explorer-list divide-y divide-gray-100">

                {/* 1. 文件夹列表 - 外部钩子: pangu-explorer-folder-row */}
                {folders?.map((folder: any) => (
                    <div key={folder.id} className="pangu-explorer-folder-row grid grid-cols-12 p-3 text-sm hover:bg-blue-50/50 items-center transition group">
                        <div className="col-span-6 md:col-span-7 flex items-center gap-3 pl-2">
                            <span className="pangu-row-icon text-xl select-none">📁</span>
                            <Link href={`/?currentDir=${folder.id}`} className="pangu-folder-link text-blue-600 hover:underline font-semibold truncate">
                                {folder.name}
                            </Link>
                        </div>
                        <div className="col-span-3 md:col-span-2 text-gray-400">--</div>
                        <div className="col-span-3 text-right pr-4 text-gray-400">-</div>
                    </div>
                ))}

                {/* 2. 文件列表 - 外部钩子: pangu-explorer-file-row + data-ext 状态透传 */}
                {files?.map((file: any) => {
                    const ext = getFileExt(file.name);
                    return (
                        <div
                            key={file.id}
                            onClick={() => handleFileClick(file)}
                            // 带上 data-ext 标签，外部开发者可以针对不同的文件类型写差异化高亮样式
                            className="pangu-explorer-file-row grid grid-cols-12 p-3 text-sm hover:bg-gray-50/80 items-center transition cursor-pointer group"
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
                            <div className="col-span-3 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                <a
                                    href={`/api/download?file_id=${file.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="pangu-download-btn inline-flex items-center text-emerald-600 font-medium hover:text-emerald-700 hover:underline bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded transition text-xs"
                                >
                                    ↓ 下载
                                </a>
                            </div>
                        </div>
                    );
                })}

                {(!folders || !files || (folders.length === 0 && files.length === 0)) && (
                    <div className="pangu-explorer-empty p-12 text-center text-gray-400 text-sm">
                        <p className="text-3xl mb-2">📥</p>
                        空空如也，赶快上传一个大文件吧
                    </div>
                )}
            </div>
        </div>
    );
}