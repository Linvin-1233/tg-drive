// src/app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function LoginPage() {
    const [theme, setTheme] = useState('default');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/auth/theme')
            .then(res => res.json())
            .then(data => setTheme(data.theme || 'default'))
            .catch(() => setTheme('default'));
    }, []);

    const isDefault = theme === 'default';

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(formData)),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || '协议握手失败');
            window.location.href = '/';
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {!isDefault && <link rel="stylesheet" href={`/themes/${theme}/login.css`} />}

            <style jsx global>{`
                body {
                    background-color: ${theme === 'cyberpunk' ? '#000000' : '#f9fafb'} !important;
                }
            `}</style>


            <div className="pangu-login-page min-h-screen flex items-center justify-center p-4 bg-gray-50 text-gray-900" data-theme={theme}>


                {theme === 'cyberpunk' && (
                    <>
                        <div className="crt-screen-scanlines"></div>
                        <div className="ambient-glitch-overlay"></div>
                    </>
                )}


                <div className="login-card max-w-md w-full p-8 bg-white rounded-xl shadow-md border border-gray-200 transition-all duration-300">

                    <div className="terminal-corner-deco"></div>

                    <h2 className="login-title text-2xl font-bold text-gray-900 mb-6 text-center">
                        {theme === 'cyberpunk' ? '身份审计终端' : '登录'}
                    </h2>

                    {error && (
                        <div className="auth-error-alert mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {theme === 'cyberpunk' ? `[ERROR] >> ${error}` : error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="form-label block text-sm font-medium text-gray-700 mb-1">
                                {theme === 'cyberpunk' ? 'SYS_ACCESS_IDENTITY // 主控账号' : '管理账号'}
                            </label>
                            <input
                                type="text"
                                name="username"
                                disabled={loading}
                                className="form-input w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-900"
                                placeholder={theme === 'cyberpunk' ? 'ENTER_OPERATOR_ID...' : '请输入管理员账号'}
                                autoComplete="off"
                                required
                            />
                        </div>

                        <div>
                            <label className="form-label block text-sm font-medium text-gray-700 mb-1">
                                {theme === 'cyberpunk' ? 'CIPHER_STREAM_TOKEN // 密钥流' : '安全密码'}
                            </label>
                            <input
                                type="password"
                                name="password"
                                disabled={loading}
                                className="form-input w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-900"
                                placeholder="●●●●●●●●●"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="login-submit-btn w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                            {loading
                                ? (theme === 'cyberpunk' ? 'CONNECTING_MATRIX...' : '正在建立信道...')
                                : (theme === 'cyberpunk' ? 'ESTABLISH_SESSION // 注入凭证' : '确认登录')
                            }
                        </button>
                    </form>

                    <div className="login-footer mt-6 text-xs text-gray-400 text-center">
                        {theme === 'cyberpunk'
                            ? ''
                            : '提示：请在vercel后台设置您的密码和用户名'
                        }
                    </div>
                </div>
            </div>
        </>
    );
}