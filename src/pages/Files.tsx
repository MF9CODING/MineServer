import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Folder, File, ChevronRight, ChevronDown, FilePlus, FolderPlus,
    Upload, RefreshCw, Download, Trash2, Edit, Copy, Save,
} from 'lucide-react';

interface FileNode {
    name: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    size?: string;
    modified?: string;
}

const mockFileTree: FileNode[] = [
    {
        name: 'My Survival Server',
        type: 'folder',
        children: [
            {
                name: 'world',
                type: 'folder',
                children: [
                    { name: 'level.dat', type: 'file', size: '2.3 KB' },
                    { name: 'region', type: 'folder', children: [] },
                ],
            },
            {
                name: 'plugins',
                type: 'folder',
                children: [
                    { name: 'EssentialsX.jar', type: 'file', size: '1.2 MB' },
                    { name: 'WorldEdit.jar', type: 'file', size: '3.4 MB' },
                ],
            },
            { name: 'server.properties', type: 'file', size: '1.1 KB', modified: 'Today' },
            { name: 'bukkit.yml', type: 'file', size: '0.8 KB' },
            { name: 'spigot.yml', type: 'file', size: '2.1 KB' },
            { name: 'paper.yml', type: 'file', size: '1.5 KB' },
        ],
    },
];

const mockFileContent = `# Minecraft server properties
motd=A Minecraft Server
server-port=25565
max-players=20
online-mode=true
difficulty=normal
gamemode=survival
view-distance=10
spawn-protection=16`;

function FileTreeItem({ node, depth = 0, onSelect }: {
    node: FileNode; depth?: number; onSelect: (node: FileNode) => void;
}) {
    const [expanded, setExpanded] = useState(depth === 0);
    const isFolder = node.type === 'folder';

    return (
        <div>
            <button
                onClick={() => { isFolder ? setExpanded(!expanded) : onSelect(node); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm
          hover:bg-surface-light transition-colors text-left`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
                {isFolder && (expanded ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />)}
                {isFolder ? <Folder className="w-4 h-4 text-warning" /> : <File className="w-4 h-4 text-text-muted" />}
                <span className="text-text truncate">{node.name}</span>
                {node.size && <span className="ml-auto text-xs text-text-muted">{node.size}</span>}
            </button>
            {isFolder && expanded && node.children?.map((child, i) => (
                <FileTreeItem key={i} node={child} depth={depth + 1} onSelect={onSelect} />
            ))}
        </div>
    );
}

export function Files() {
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [fileContent, setFileContent] = useState(mockFileContent);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 h-[calc(100vh-180px)]">
            {/* File Tree */}
            <div className="w-72 flex-shrink-0 card overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-text">Files</h3>
                    <div className="flex gap-1">
                        <button className="p-1.5 rounded hover:bg-surface-light"><FilePlus className="w-4 h-4 text-text-muted" /></button>
                        <button className="p-1.5 rounded hover:bg-surface-light"><FolderPlus className="w-4 h-4 text-text-muted" /></button>
                        <button className="p-1.5 rounded hover:bg-surface-light"><Upload className="w-4 h-4 text-text-muted" /></button>
                        <button className="p-1.5 rounded hover:bg-surface-light"><RefreshCw className="w-4 h-4 text-text-muted" /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {mockFileTree.map((node, i) => (
                        <FileTreeItem key={i} node={node} onSelect={setSelectedFile} />
                    ))}
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 card overflow-hidden flex flex-col">
                {selectedFile ? (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <File className="w-4 h-4 text-text-muted" />
                                <span className="font-medium text-text">{selectedFile.name}</span>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn btn-secondary text-sm py-1.5">
                                    <Download className="w-4 h-4" />Download
                                </button>
                                <button className="btn btn-primary text-sm py-1.5">
                                    <Save className="w-4 h-4" />Save
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-surface-light rounded-lg p-4 overflow-auto">
                            <textarea
                                value={fileContent}
                                onChange={(e) => setFileContent(e.target.value)}
                                className="w-full h-full bg-transparent text-text font-mono text-sm resize-none focus:outline-none"
                                spellCheck={false}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-text-muted">
                        <div className="text-center">
                            <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Select a file to edit</p>
                        </div>
                    </div>
                )}
            </div>

            {/* File Info */}
            {selectedFile && (
                <div className="w-56 flex-shrink-0 card">
                    <h3 className="font-semibold text-text mb-4">File Info</h3>
                    <div className="space-y-3 text-sm">
                        <div><span className="text-text-muted">Name:</span><p className="text-text">{selectedFile.name}</p></div>
                        <div><span className="text-text-muted">Type:</span><p className="text-text">{selectedFile.name.split('.').pop()?.toUpperCase()}</p></div>
                        <div><span className="text-text-muted">Size:</span><p className="text-text">{selectedFile.size || 'Unknown'}</p></div>
                    </div>
                    <div className="mt-6 space-y-2">
                        <button className="w-full btn btn-secondary text-sm"><Edit className="w-4 h-4" />Rename</button>
                        <button className="w-full btn btn-secondary text-sm"><Copy className="w-4 h-4" />Duplicate</button>
                        <button className="w-full btn btn-danger text-sm"><Trash2 className="w-4 h-4" />Delete</button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
