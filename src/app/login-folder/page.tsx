"use client";
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginFolder() {
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
        <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center h-screen">
            <h2 className="mb-4">此文件夹受密码保护</h2>
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border p-2 mb-4"
                placeholder="请输入密码"
            />
            <button type="submit" className="bg-blue-500 text-white px-4 py-2">解锁</button>
        </form>
    );
}