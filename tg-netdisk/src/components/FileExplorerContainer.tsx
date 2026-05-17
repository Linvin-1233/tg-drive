// src/components/FileExplorerContainer.tsx
import { queryD1 } from '@/lib/db';
import FileExplorer from './FileExplorer';

export default async function FileExplorerContainer({ currentDir, q }: { currentDir: string | null; q: string }) {
    let folders: any[] = [];
    let files: any[] = [];

    // 数据库查询被隔离到了这个独立的服务端组件中
    if (q) {
        files = await queryD1('SELECT * FROM files WHERE name LIKE ?', [`%${q}%`]);
        folders = await queryD1('SELECT * FROM folders WHERE name LIKE ?', [`%${q}%`]);
    } else {
        folders = await queryD1('SELECT * FROM folders WHERE parent_id IS ?', [currentDir]);
        files = await queryD1('SELECT * FROM files WHERE folder_id IS ?', [currentDir]);
    }

    return <FileExplorer folders={folders || []} files={files || []} />;
}