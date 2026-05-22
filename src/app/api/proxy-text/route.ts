import { NextRequest, NextResponse } from 'next/server';

// 替换此处的获取逻辑，确保返回正确的 Telegram Bot Token
async function getTelegramToken(): Promise<string> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN 未设置至环境变量');
    }
    return token;
}

async function handleDistributedChunks(request: NextRequest, fileId: string) {
    try {
        const cleanFileId = fileId.trim().replace(/['"`;]/g, '');

        const cfAccountId = process.env.CF_ACCOUNT_ID;
        const cfDatabaseId = process.env.CF_D1_DATABASE_ID;
        const cfApiToken = process.env.CF_API_TOKEN;

        if (!cfAccountId || !cfDatabaseId || !cfApiToken) {
            return NextResponse.json({ error: '数据库环境配置不完整' }, { status: 500 });
        }

        const d1HttpUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/d1/database/${cfDatabaseId}/query`;

        const d1Response = await fetch(d1HttpUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cfApiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sql: "SELECT cdn_urls FROM files WHERE id = ?1",
                params: [cleanFileId]
            }),
            cache: 'no-store'
        });

        if (!d1Response.ok) {
            const errorDetails = await d1Response.text().catch(() => '');
            console.error(`[D1 Error] Status: ${d1Response.status}, Details: ${errorDetails}`);
            throw new Error(`Cloudflare D1 网关拒绝查询`);
        }

        const d1Data = await d1Response.json();
        const rows = d1Data?.result?.[0]?.results;

        if (!rows || rows.length === 0 || !rows[0].cdn_urls) {
            return NextResponse.json({ error: '未找到文件拓扑元数据' }, { status: 404 });
        }

        const chunks = typeof rows[0].cdn_urls === 'string' ? JSON.parse(rows[0].cdn_urls) : rows[0].cdn_urls;
        const token = await getTelegramToken();

        const sortedChunks = [...chunks].sort((a: any, b: any) => (a.part_index || 0) - (b.part_index || 0));

        const partPromises = sortedChunks.map(async (chunk: any) => {
            const chunkFileId = chunk.tg_file_id || chunk.file_id || chunk.id;
            const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${chunkFileId}`, { cache: 'no-store' });
            const fileInfo = await fileInfoRes.json();
            const filePath = fileInfo.result?.file_path;

            const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
                cache: 'no-store',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            return await downloadRes.text();
        });

        const textParts = await Promise.all(partPromises);
        const combinedText = textParts.join('');

        const safeHeaders = new Headers();
        safeHeaders.set('Content-Type', 'text/plain; charset=utf-8');
        return new NextResponse(combinedText, { status: 200, headers: safeHeaders });

    } catch (err: any) {
        return NextResponse.json({ error: `Processing failed: ${err.message}` }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        let targetUrl = searchParams.get('url');
        const previewParam = searchParams.get('preview');

        if (!targetUrl || (targetUrl.includes('part_index')) || previewParam) {
            const referer = request.headers.get('referer') || '';
            const previewMatch = previewParam || referer.match(/preview=([^&]+)/)?.[1] || request.url.match(/preview=([^&]+)/)?.[1];

            if (previewMatch) return await handleDistributedChunks(request, previewMatch);
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const response = await fetch(targetUrl, { method: 'GET', cache: 'no-store' });
        const textContent = await response.text();

        const safeHeaders = new Headers();
        safeHeaders.set('Content-Type', 'text/plain; charset=utf-8');
        return new NextResponse(textContent, { status: 200, headers: safeHeaders });
    } catch (error: any) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const fileId = body.fileId || new URL(request.url).searchParams.get('preview');
    if (!fileId) return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
    return await handleDistributedChunks(request, fileId);
}