// src/app/api/proxy-text/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const targetUrl = searchParams.get('url');

        if (!targetUrl) {
            return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
        }

        // 1. 发起拉取：使用标准商业浏览器 Head，并彻底禁用 Next.js 的 fetch 缓存机制
        const response = await fetch(targetUrl, {
            method: 'GET',
            cache: 'no-store', // 🎯 核心修正 1：防止 Next.js 缓存引擎因处理 Discord 复杂参数时发生二次内部爆栈
            headers: {
                // 🎯 核心修正 2：伪装成最纯净的标准 Chrome，防止被 Discord 防盗链策略直接拦截阻断
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/plain,text/html,application/json,application/javascript,*/*',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        // 2. 拦截非正常响应：不要信任第三方状态，防止其返回诡异头信息
        if (!response.ok) {
            console.error(`[Proxy Text Engine] 远程节点返回拒绝状态码: ${response.status}`);
            return NextResponse.json(
                { error: `远程资源库拒绝访问 [Status: ${response.status}]` },
                { status: response.status }
            );
        }

        // 3. 铁血提取纯正文本
        const textContent = await response.text();

        // 4. 构建无污染的纯 ASCII 基础安全响应头
        const safeHeaders = new Headers();
        safeHeaders.set('Content-Type', 'text/plain; charset=utf-8');
        safeHeaders.set('Content-Disposition', 'inline');
        safeHeaders.set('Access-Control-Allow-Origin', '*');
        safeHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

        return new NextResponse(textContent, {
            status: 200,
            headers: safeHeaders
        });

    } catch (error: any) {
        // 即使出现不可抗力的物理断开，也绝不把带特殊字符的 error.message 往外部 Header 吐
        console.error('[Proxy Text Node Crashed]:', error);
        return NextResponse.json(
            { error: `服务器文本中转流物理断开，异常已被沙盒拦截` },
            { status: 500 }
        );
    }
}