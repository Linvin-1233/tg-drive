import { NextResponse } from 'next/server';

interface StreamProxyOptions {
    targetUrl: string;
    allowedOrigin?: string;
    customHeaders?: Record<string, string>;
}

export async function createMemorySafeProxy({
                                                targetUrl,
                                                allowedOrigin = '*',
                                                customHeaders = {}
                                            }: StreamProxyOptions): Promise<NextResponse> {
    try {
        // 流式拉取
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) 安全内核',
                ...customHeaders
            }
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `云端资源拉取失败: ${response.statusText}` },
                { status: response.status }
            );
        }

        const stream = response.body;
        if (!stream) {
            throw new Error('未能捕获到合法的云端数据流');
        }

        // 动态捕获并重写媒体头
        let contentType = response.headers.get('Content-Type') || 'application/octet-stream';

        // 剔除 Content-Type 后面可能携带的 name="中文" 等非标准 ASCII 尾巴
        // 示例：将 "text/markdown; charset=utf-8; name="说明.md"" 清洗为 "text/markdown; charset=utf-8"
        if (contentType.includes(';')) {
            const parts = contentType.split(';').map(p => p.trim());
            // 只保留不包含 name 或 filename 描述的纯净参数
            const safeParts = parts.filter(part => !part.startsWith('name=') && !part.startsWith('filename='));
            contentType = safeParts.join('; ');
        }

        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Content-Disposition', 'inline'); // 强制浏览器内联平铺，拒绝原地弹下载
        headers.set('Access-Control-Allow-Origin', allowedOrigin);
        headers.set('Cache-Control', 'public, max-age=86400, must-revalidate'); // 1天本地强缓存，省服务器带宽

        // 兜底检查所有即将发送的 Header，一旦发现残存的非 ASCII 字符，立即执行安全 URL 编码
        headers.forEach((value, key) => {
            if (/[^\x00-\x7F]/.test(value)) {
                headers.set(key, encodeURIComponent(value));
            }
        });

        // 直接封装进 NextResponse 吐回前端
        return new NextResponse(stream, {
            status: 200,
            headers: headers,
        });

    } catch (error: any) {
        console.error('[Server Stream Proxy Error]:', error.message);
        return NextResponse.json(
            { error: `服务器中转流崩溃: ${error.message}` },
            { status: 500 }
        );
    }
}