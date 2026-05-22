// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

// 🎯 1. 引入 YAML 和文件系统组件
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export const metadata: Metadata = {
    title: "tg-netdisk",
    description: "基于 Next.js 16 + Tailwind v4 的个人网盘",
    icons:{
        icon: '/icon/favicon.png',
        shortcut: '/icon/favicon.png',
        apple: '/icon/favicon.png',
    }
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    let activeTheme = "default";
    try {
        const configPath = path.join(process.cwd(), '_config.yml');
        if (fs.existsSync(configPath)) {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            const config = yaml.load(fileContents) as { theme?: string };
            activeTheme = config.theme || "default";
        }
    } catch (e) {
        activeTheme = "default";
    }

    return (
        <html lang="zh">
        <head>
            {activeTheme !== 'default' && (
                <link rel="stylesheet" href={`/themes/${activeTheme}/main.css`} />
            )}
        </head>
        <body>
        {children}
        </body>
        </html>
    );
}