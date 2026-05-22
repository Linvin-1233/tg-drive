"use client";

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginFolderContent() {
    const [password, setPassword] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const folderId = searchParams.get('folderId');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch('/api/folder/verify', {
            method: 'POST',
            body: JSON.stringify({ folderId, password }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            router.push(`/?currentDir=${folderId}`);
        } else {
            alert('密码错误');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center h-screen bg-gray-50">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">此文件夹受密码保护</h2>
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border p-2 mb-4 rounded-lg outline-none focus:border-blue-500 bg-white text-gray-800 shadow-sm"
                placeholder="请输入密码"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white px-6 py-2 rounded-lg font-medium shadow">
                解锁进入
            </button>
        </form>
    );
}


export default function LoginFolder() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-sm text-gray-500 font-mono">
                正在初始化安全通道...
            </div>
        }>
            <LoginFolderContent />
        </Suspense>
    );
}