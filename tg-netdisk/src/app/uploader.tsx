// src/app/Uploader.tsx
'use client';

import React, { useState } from 'react';

export default function Uploader({ currentDir }: { currentDir: string | null }) {
    const [status, setStatus] = useState('');
    const [progress, setProgress] = useState<number | null>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus('正在打通 2GB MTProto 极速隧道...');
        setProgress(0);

        // 使用 XMLHttpRequest 来完美捕获原生的流式上传进度
        const xhr = new XMLHttpRequest();

        // 拼装带有文件元数据的 API 路由直链
        const url = `/api/upload?name=${encodeURIComponent(file.name)}&size=${file.size}&folderId=${currentDir}`;
        xhr.open('POST', url, true);

        // 监听真实现场网速进度
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setProgress(percent);
                setStatus(`模拟客户端直传中: ${percent}%`);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                setStatus('🎉 2GB 级别大文件瞬间同步成功！');
            } else {
                const res = JSON.parse(xhr.responseText);
                alert('上传遭遇中断: ' + (res.error || '服务器拒绝'));
                setStatus('❌ 传输失败');
            }
            setTimeout(() => { setProgress(null); setStatus(''); }, 3000);
        };

        xhr.onerror = () => {
            alert('网络隧道中断，请检查物理连接或代理设置。');
            setStatus('❌ 传输失败');
            setProgress(null);
        };

        // 🚀 零内存开销：把整个文件对象作为纯二进制数据流直接 send 过去！
        xhr.send(file);
    };

    return (
        <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
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