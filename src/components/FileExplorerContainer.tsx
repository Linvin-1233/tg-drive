// src/components/FileExplorerContainer.tsx
import { queryD1 } from '@/lib/db';
import FileExplorer from './FileExplorer';

interface FileExplorerContainerProps {
    currentDir: string | null;
    q: string;
    currentFolder?: { id: any; name: any; parentId: any } | null;
}

export default async function FileExplorerContainer({
                                                        currentDir,
                                                        q,
                                                        currentFolder
                                                    }: FileExplorerContainerProps) {
    let folders: any[] = [];
    let files: any[] = [];

    if (q) {
        files = await queryD1('SELECT * FROM files WHERE name LIKE ?', [`%${q}%`]);
        folders = await queryD1('SELECT * FROM folders WHERE name LIKE ?', [`%${q}%`]);
    } else {
        folders = await queryD1('SELECT * FROM folders WHERE parent_id IS ?', [currentDir]);
        files = await queryD1('SELECT * FROM files WHERE folder_id IS ?', [currentDir]);
    }

    return (
        <FileExplorer
            folders={folders || []}
            files={files || []}
            currentFolder={currentFolder}
        />
    );
}