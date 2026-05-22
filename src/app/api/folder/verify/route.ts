import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

interface D1Row { password_hash: string; }

export async function POST(request: NextRequest) {
    try {
        const { folderId, password } = await request.json();

        const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sql: "SELECT password_hash FROM folders WHERE id = ?",
                params: [folderId]
            })
        });

        const data = await response.json();
        const folder = data.result?.[0]?.results?.[0] as D1Row | undefined;

        if (!folder?.password_hash) {
            console.warn(`[Verify] 找不到文件夹或未加锁。ID: ${folderId}`);
            return NextResponse.json({ error: '文件夹未受保护或不存在' }, { status: 404 });
        }
        const isValid = await bcrypt.compare(password, folder.password_hash);

        if (isValid) {
            const res = NextResponse.json({ success: true });
            res.cookies.set(`access_folder_${folderId}`, 'true', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/'
            });
            return res;
        }
        return NextResponse.json({ error: '密码错误' }, { status: 401 });
    } catch {
        return NextResponse.json({ error: '系统异常' }, { status: 500 });
    }
}