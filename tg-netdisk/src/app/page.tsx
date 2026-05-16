// src/app/page.tsx
import { queryD1 } from '@/lib/db';
import { createFolder } from './actions';
import Uploader from './uploader'; // 👈 补上这行
import Link from 'next/link';

export default async function Page({ searchParams }: { searchParams: Promise<{ currentDir?: string; q?: string }> }) {
    let folders = [];
    let files = [];
    let currentDir: string | null = null;
    let q = '';
    let dbError = '';

    try {
        const params = await searchParams;
        currentDir = params.currentDir || null;
        q = params.q || '';

        if (q) {
            files = await queryD1('SELECT * FROM files WHERE name LIKE ?', [`%${q}%`]);
            folders = await queryD1('SELECT * FROM folders WHERE name LIKE ?', [`%${q}%`]);
        } else {
            folders = await queryD1('SELECT * FROM folders WHERE parent_id IS ?', [currentDir]);
            files = await queryD1('SELECT * FROM files WHERE folder_id IS ?', [currentDir]);
        }
    } catch (err: any) {
        dbError = err.message || '数据库连接失败';
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen text-gray-800 font-sans">
            {dbError && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm">
                    <h3 className="font-bold">⚠️ 数据库连接失败</h3>
                    <p className="text-sm font-mono mt-1 text-red-600">{dbError}</p>
                </div>
            )}

            {/* 顶部工具栏 */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                {/* 搜索框 */}
                <form method="GET" className="w-full md:w-80">
                    <input
                        type="text"
                        name="q"
                        defaultValue={q}
                        placeholder="🔍 搜索文件..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                    {currentDir && <input type="hidden" name="currentDir" value={currentDir} />}
                </form>

                {/* 右侧操作区：上传 + 新建文件夹 */}
                <div className="flex flex-wrap items-center gap-4">
                    {/* 客户端纯前端直传 TG 组件 */}
                    <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                        <Uploader
                            currentDir={currentDir}
                            botToken={process.env.TG_BOT_TOKEN || ''}
                            chatId={process.env.TG_CHAT_ID || ''}
                        />
                        <span id="upload-status" className="text-xs text-blue-600 font-medium"></span>
                    </div>

                    {/* 新建文件夹 */}
                    <form action={createFolder} className="flex gap-2">
                        <input type="hidden" name="parentId" value={currentDir || ''} />
                        <input
                            type="text"
                            name="name"
                            required
                            placeholder="新建文件夹名称"
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                            + 新建文件夹
                        </button>
                    </form>
                </div>
            </div>

            {/* 面包屑导航 */}
            <div className="mb-4 text-sm text-gray-500 flex items-center gap-1.5 px-1">
                <Link href="/" className="hover:text-blue-600 transition font-medium">我的网盘</Link>
                {q && <span className="text-gray-400"> &gt; 搜索结果: "{q}"</span>}
            </div>

            {/* 数据列表 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-12 p-3 text-xs font-bold text-gray-400 bg-gray-50 border-b border-gray-100">
                    <div className="col-span-6 md:col-span-7 pl-2">名称</div>
                    <div className="col-span-3 md:col-span-2">大小</div>
                    <div className="col-span-3 text-right pr-4">操作</div>
                </div>

                <div className="divide-y divide-gray-100">
                    {/* 文件夹列表 */}
                    {folders?.map((folder: any) => (
                        <div key={folder.id} className="grid grid-cols-12 p-3 text-sm hover:bg-blue-50/50 items-center transition group">
                            <div className="col-span-6 md:col-span-7 flex items-center gap-3 pl-2">
                                <span className="text-xl">📁</span>
                                <Link href={`/?currentDir=${folder.id}`} className="text-blue-600 hover:underline font-semibold truncate">
                                    {folder.name}
                                </Link>
                            </div>
                            <div className="col-span-3 md:col-span-2 text-gray-400">--</div>
                            <div className="col-span-3 text-right pr-4 text-gray-400">-</div>
                        </div>
                    ))}

                    {/* 文件列表 */}
                    {files?.map((file: any) => (
                        <div key={file.id} className="grid grid-cols-12 p-3 text-sm hover:bg-gray-50 items-center transition">
                            <div className="col-span-6 md:col-span-7 flex items-center gap-3 pl-2">
                                <span className="text-xl">📄</span>
                                <span className="text-gray-700 font-medium truncate">{file.name}</span>
                            </div>
                            <div className="col-span-3 md:col-span-2 text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                            <div className="col-span-3 text-right pr-4">
                                <a
                                    href={`/api/download?file_id=${file.tg_file_id}`}
                                    target="_blank"
                                    className="inline-flex items-center text-emerald-600 font-medium hover:text-emerald-700 hover:underline"
                                >
                                    下载
                                </a>
                            </div>
                        </div>
                    ))}

                    {(!folders || !files || (folders.length === 0 && files.length === 0)) && (
                        <div className="p-12 text-center text-gray-400 text-sm">
                            <p className="text-3xl mb-2">📥</p>
                            空空如也，赶快上传一个大文件吧
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}