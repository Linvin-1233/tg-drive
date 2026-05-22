import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            // ⚡ 必须返回 NextResponse.json
            return NextResponse.json({ isLocked: false });
        }

        const rows = await queryD1('SELECT is_locked FROM folders WHERE id = ? LIMIT 1', [id]);
        const isLocked = rows?.[0]?.is_locked === 1;

        // ⚡ 必须返回 NextResponse.json
        return NextResponse.json({ isLocked }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (e) {
        console.error("D1 check error:", e);
        // ⚡ 哪怕报错分支，也绝对不能漏掉 NextResponse.json，否则就会报 "received 'Object'" 错误
        return NextResponse.json({ isLocked: false, error: String(e) }, { status: 500 });
    }
}