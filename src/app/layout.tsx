// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

// 🎯 1. 引入 YAML 和文件系统组件
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export const metadata: Metadata = {
    title: "TG 私有网盘",
    description: "基于 Next.js 16 + Tailwind v4 的极客网盘",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {

    // 🎯 2. 自动化核心：在这里读取 _config.yml
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
            {/* 🎯 3. 终极一箭穿心：
            如果主题不是 default，我们就利用浏览器原生机制，直接去挂载对应文件夹下的 main.css。
            因为 Next.js 编译时会自动处理 src 目录下的静态映射，或者你可以把皮肤包放心大胆地丢回 public 目录！
        */}
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