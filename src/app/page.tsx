// src/app/page.tsx
import React, { Suspense } from 'react';
import { queryD1 } from '@/lib/db';
import { createFolder } from './actions';
import Uploader from './uploader';
import Link from 'next/link';
import FileExplorerContainer from '@/components/FileExplorerContainer';
import PreviewModal from '@/components/PreviewModal';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface PageProps {
    searchParams: Promise<{ currentDir?: string; q?: string; preview?: string }>;
}

async function getPathAncestors(currentFolderId: string | null) {
    const ancestors: { id: string; name: string }[] = [];
    let currentId = currentFolderId;

    while (currentId) {
        try {
            const folderResult = await queryD1(
                'SELECT id, name, parent_id FROM folders WHERE id = ? LIMIT 1',
                [currentId]
            );
            if (folderResult && folderResult.length > 0) {
                const folder = folderResult[0];
                ancestors.unshift({ id: folder.id, name: folder.name });
                currentId = folder.parent_id;
            } else {
                break;
            }
        } catch (e) {
            console.error("追溯面包屑路径失败:", e);
            break;
        }
    }
    if (ancestors.length > 0) {
        ancestors.pop();
    }
    return ancestors;
}

export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams;
    const currentDir = params.currentDir || null;
    const q = params.q || '';
    const previewId = params.preview || '';

    let activeTheme = "default";
    try {
        const configPath = path.join(process.cwd(), '_config.yml');
        if (fs.existsSync(configPath)) {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            const config = yaml.load(fileContents) as { theme?: string };
            activeTheme = config.theme || "default";
        }
    } catch (e) {
        console.error("读取 _config.yml 失败，降级为 default 主题:", e);
    }

    let currentFolderData: { id: any; name: any; parentId: any } | null = null;
    if (currentDir) {
        try {
            const folderResult = await queryD1(
                'SELECT id, name, parent_id FROM folders WHERE id = ? LIMIT 1',
                [currentDir]
            );
            if (folderResult && folderResult.length > 0) {
                currentFolderData = {
                    id: folderResult[0].id,
                    name: folderResult[0].name,
                    parentId: folderResult[0].parent_id
                };
            }
        } catch (e) {
            console.error("获取当前目录元数据失败:", e);
        }
    }

    const pathAncestors = currentDir ? await getPathAncestors(currentDir) : [];

    let selectedFile: any = null;
    if (previewId) {
        const results = await queryD1('SELECT * FROM files WHERE id = ? LIMIT 1', [previewId]);
        if (results && results.length > 0) selectedFile = results[0];
    }

    return (
        <>
            <div
                className="pangu-dashboard p-4 md:p-6 bg-gray-50 min-h-screen text-gray-800 font-sans"
                data-theme={activeTheme}
            >
                {/* 工具栏：完美适配各种移动终端与折叠屏 */}
                <div className="pangu-toolbar flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <form method="GET" className="w-full lg:w-80">
                        <input
                            type="text"
                            name="q"
                            defaultValue={q}
                            placeholder="🔍 搜索文件..."
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                        {currentDir && <input type="hidden" name="currentDir" value={currentDir} />}
                    </form>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                        <Uploader currentDir={currentDir} />

                        <form action={createFolder} className="pangu-create-folder-form flex flex-col sm:flex-row gap-2 flex-1 sm:flex-initial">
                            <input type="hidden" name="parentId" value={currentDir || ''} />
                            <input
                                type="text"
                                name="name"
                                required
                                placeholder="新建文件夹名称"
                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 flex-1 sm:w-40 lg:w-44"
                            />
                            <input
                                type="password"
                                name="password"
                                placeholder="访问密码 (可选)"
                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 flex-1 sm:w-36 lg:w-40"
                            />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap active:scale-95 text-center">
                                新建文件夹
                            </button>
                        </form>
                    </div>
                </div>

                {/* 面包屑：避免长路径撑破移动端屏幕 */}
                <div className="pangu-explorer-breadcrumbs flex items-center gap-1.5 text-xs md:text-sm text-gray-500 pl-1 font-mono mb-4 flex-wrap overflow-hidden whitespace-nowrap">
                    <Link href="/" className="pangu-breadcrumb-item hover:text-blue-600 font-semibold transition text-gray-400">
                        ROOT
                    </Link>

                    {pathAncestors.map((ancestor) => (
                        <React.Fragment key={ancestor.id}>
                            <span className="pangu-breadcrumb-separator text-gray-400 select-none">/</span>
                            <Link
                                href={`/?currentDir=${ancestor.id}`}
                                className="pangu-breadcrumb-item hover:text-blue-600 transition text-gray-500 max-w-[80px] md:max-w-[150px] truncate hover:underline"
                            >
                                {ancestor.name}
                            </Link>
                        </React.Fragment>
                    ))}

                    {currentFolderData && (
                        <>
                            <span className="pangu-breadcrumb-separator text-gray-400 select-none">/</span>
                            <span className="pangu-breadcrumb-current text-gray-800 font-bold max-w-[120px] md:max-w-[200px] truncate">
                                {currentFolderData.name}
                            </span>
                        </>
                    )}
                </div>

                {/* 文件流列表 */}
                <Suspense key={currentDir + q} fallback={
                    <div className="space-y-2 animate-pulse bg-white p-4 rounded-xl border">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-10 bg-gray-100 rounded"></div>
                    </div>
                }>
                    <FileExplorerContainer
                        currentDir={currentDir}
                        q={q}
                        currentFolder={currentFolderData}
                    />
                </Suspense>

                {/* 全功能多媒体预览弹窗 */}
                {previewId && selectedFile && (
                    <Suspense fallback={
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                            <div className="bg-white rounded-xl p-8 shadow-2xl text-center text-sm text-gray-500">
                                正在构建预览通道...
                            </div>
                        </div>
                    }>
                        <PreviewModal
                            fileId={selectedFile.id}
                            fileName={selectedFile.name}
                            fileUrl={selectedFile.cdn_urls?.split(',')[0] || ''}
                            currentDir={currentDir}
                        />
                    </Suspense>
                )}
            </div>
        </>
    );
}