// src/lib/db.ts
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const DB_ID = process.env.CF_D1_DATABASE_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

export async function queryD1(sql: string, params: any[] = []) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${DB_ID}/query`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
        next: { revalidate: 0 } // 确保 SSR 每次都是最新数据
    });

    const json = await res.json();
    if (!json.success) {
        throw new Error(`D1 Error: ${json.errors?.[0]?.message || 'Unknown error'}`);
    }
    return json.result[0]?.results || [];
}