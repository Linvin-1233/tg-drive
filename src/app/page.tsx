// src/app/page.tsx
import { Suspense } from 'react';
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

export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams;
    const currentDir = params.currentDir || null;
    const q = params.q || '';
    const previewId = params.preview || '';

    // 直读根目录的 _config.yml
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
                // 2. 确保这里的赋值字段和上面声明的类型完全对齐
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

    let selectedFile: any = null;
    if (previewId) {
        const results = await queryD1('SELECT * FROM files WHERE id = ? LIMIT 1', [previewId]);
        if (results && results.length > 0) selectedFile = results[0];
    }

    return (
        <>
            {/* 注入固定 BEM: pangu-breadcrumb */}
            <div
                className="pangu-dashboard p-6 bg-gray-50 min-h-screen text-gray-800 font-sans"
                data-theme={activeTheme}
            >
                {/* 注入固定 BEM: pangu-breadcrumb */}
                <div className="pangu-toolbar flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <form method="GET" className="w-full md:w-80">
                        <input type="text" name="q" defaultValue={q} placeholder="🔍 搜索文件..." className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                        {currentDir && <input type="hidden" name="currentDir" value={currentDir} />}
                    </form>
                    <div className="flex flex-wrap items-center gap-4">
                        <Uploader currentDir={currentDir} />

                        {/* 注入固定 BEM: pangu-breadcrumb */}
                        <form action={createFolder} className="pangu-create-folder-form flex gap-2">
                            <input type="text" name="name" required placeholder="新建文件夹名称" className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">新建文件夹</button>
                        </form>
                    </div>
                </div>

                {/* 注入固定 BEM: pangu-breadcrumb */}
                <div className="pangu-explorer-breadcrumbs flex items-center gap-2 text-sm text-gray-500 pl-1 font-mono">
                    <Link href="/" className="pangu-breadcrumb-item hover:text-blue-600 font-semibold transition">
                        ROOT
                    </Link>
                    {currentFolderData && (
                        <>
                            <span className="pangu-breadcrumb-separator text-gray-400 select-none">/</span>
                            <span className="pangu-breadcrumb-current text-gray-800 font-bold max-w-[200px] truncate">
                        {currentFolderData.name}
                    </span>
                        </>
                    )}
                </div>

                {/* 文件列表流式容器 */}
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

                {/* 预览弹窗 */}
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