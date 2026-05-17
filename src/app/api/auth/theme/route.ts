// src/app/api/auth/theme/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export const dynamic = 'force-dynamic';

export async function GET() {
    let activeTheme = "default";
    try {
        const configPath = path.resolve(process.cwd(), '_config.yml');
        if (fs.existsSync(configPath)) {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            const config = yaml.load(fileContents) as { theme?: string };
            if (config && config.theme) activeTheme = config.theme.trim();
        }
    } catch (e) {
        activeTheme = "default";
    }
    return NextResponse.json({ theme: activeTheme });
}