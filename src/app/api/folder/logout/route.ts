import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id');
        const res = NextResponse.json({ success: true });

        if (id) {
            res.cookies.set(`access_folder_${id}`, '', {
                path: '/',
                expires: new Date(0),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });
        }
        return res;
    } catch {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}