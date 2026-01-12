import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Save, ChevronLeft, RefreshCw, Search, Plus, Trash2,
    Edit3, FolderPlus, Archive, FileText, FileCode,
    FileJson, Settings2, Image, File, Folder, MoreVertical,
    Copy, ExternalLink, Download, FolderOpen, ChevronRight, Home,
    LayoutGrid, List as ListIcon, Upload, Package, ArrowUpFromLine
} from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '../../lib/utils';
import { CodeEditor } from '../ui/CodeEditor';

interface FileManagerProps {
    serverPath: string;
}

interface FileEntry {
    name: string;
    is_dir: boolean;
    size: number;
}

// File type detection for icons and syntax
const getFileInfo = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const fileTypes: Record<string, { icon: any; color: string; editable: boolean; syntax: string }> = {
        // Config files
        'properties': { icon: Settings2, color: 'text-orange-400', editable: true, syntax: 'properties' },
        'yml': { icon: FileCode, color: 'text-yellow-400', editable: true, syntax: 'yaml' },
        'yaml': { icon: FileCode, color: 'text-yellow-400', editable: true, syntax: 'yaml' },
        'json': { icon: FileJson, color: 'text-green-400', editable: true, syntax: 'json' },
        'toml': { icon: FileCode, color: 'text-purple-400', editable: true, syntax: 'toml' },
        // Text files
        'txt': { icon: FileText, color: 'text-gray-400', editable: true, syntax: 'text' },
        'log': { icon: FileText, color: 'text-gray-500', editable: true, syntax: 'text' },
        'md': { icon: FileText, color: 'text-blue-400', editable: true, syntax: 'markdown' },
        'cfg': { icon: Settings2, color: 'text-orange-400', editable: true, syntax: 'text' },
        'conf': { icon: Settings2, color: 'text-orange-400', editable: true, syntax: 'text' },
        // Code
        'java': { icon: FileCode, color: 'text-red-400', editable: true, syntax: 'java' },
        'js': { icon: FileCode, color: 'text-yellow-400', editable: true, syntax: 'javascript' },
        'sh': { icon: FileCode, color: 'text-green-400', editable: true, syntax: 'bash' },
        'bat': { icon: FileCode, color: 'text-blue-400', editable: true, syntax: 'batch' },
        'cmd': { icon: FileCode, color: 'text-blue-400', editable: true, syntax: 'batch' },
        // Binary
        'jar': { icon: Archive, color: 'text-red-500', editable: false, syntax: '' },
        'zip': { icon: Archive, color: 'text-purple-500', editable: false, syntax: '' },
        'gz': { icon: Archive, color: 'text-purple-500', editable: false, syntax: '' },
        'tar': { icon: Archive, color: 'text-purple-500', editable: false, syntax: '' },
        // Images
        'png': { icon: Image, color: 'text-pink-400', editable: false, syntax: '' },
        'jpg': { icon: Image, color: 'text-pink-400', editable: false, syntax: '' },
        'jpeg': { icon: Image, color: 'text-pink-400', editable: false, syntax: '' },
        'gif': { icon: Image, color: 'text-pink-400', editable: false, syntax: '' },
        // Executables
        'exe': { icon: File, color: 'text-blue-500', editable: false, syntax: '' },
        'dll': { icon: File, color: 'text-gray-500', editable: false, syntax: '' },
    };
    return fileTypes[ext] || { icon: File, color: 'text-gray-400', editable: true, syntax: 'text' };
};

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const MAX_EDITABLE_SIZE = 5 * 1024 * 1024; // 5MB limit for editing

export function FileManager({ serverPath }: FileManagerProps) {
    const [path, setPath] = useState(serverPath);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [editingFile, setEditingFile] = useState<{ name: string; content: string; originalContent: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState<'file' | 'folder' | null>(null);
    const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        return (localStorage.getItem('file_manager_view') as 'grid' | 'list') || 'grid';
    });

    // Persist view mode
    useEffect(() => {
        localStorage.setItem('file_manager_view', viewMode);
    }, [viewMode]);
    const [newItemName, setNewItemName] = useState('');

    // Refs for standard HTML upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileEntry } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadFiles(); }, [path]);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        window.addEventListener('click', handleClick);
        window.addEventListener('resize', () => setContextMenu(null));
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('resize', () => setContextMenu(null));
        };
    }, []);

    async function loadFiles() {
        if (!path) return;
        setLoading(true);
        try {
            const entries = await invoke<FileEntry[]>('get_server_files', { path });
            // Sort: folders first, then alphabetically
            entries.sort((a, b) => {
                if (a.is_dir && !b.is_dir) return -1;
                if (!a.is_dir && b.is_dir) return 1;
                return a.name.localeCompare(b.name);
            });
            setFiles(entries);
        } catch (e) {
            toast.error("Failed to load files: " + e);
        } finally {
            setLoading(false);
        }
    }

    const handleFileClick = async (file: FileEntry) => {
        if (file.is_dir) {
            setPath(`${path}\\${file.name}`);
            setSearchQuery('');
        } else {
            const fileInfo = getFileInfo(file.name);
            if (!fileInfo.editable) {
                toast.info(`Cannot edit ${fileInfo.syntax || 'binary'} files directly.`);
                return;
            }
            if (file.size > MAX_EDITABLE_SIZE) {
                toast.warning("File is too large to edit.");
                return;
            }

            try {
                const content = await invoke<string>('read_server_file', { path: `${path}\\${file.name}` });
                setEditingFile({ name: file.name, content, originalContent: content });
            } catch (e) {
                toast.error("Failed to read file: " + e);
            }
        }
    };

    const handleGoBack = () => {
        if (path === serverPath) return;
        const parentPath = path.substring(0, path.lastIndexOf('\\'));
        setPath(parentPath);
        setSearchQuery('');
    };

    const saveFile = async () => {
        if (!editingFile) return;
        setSaving(true);
        try {
            await invoke('write_server_file', {
                path: `${path}\\${editingFile.name}`,
                content: editingFile.content
            });

            // Update original content to match saved
            setEditingFile(prev => prev ? { ...prev, originalContent: prev.content } : null);
            toast.success("File saved successfully!");
        } catch (e) {
            toast.error("Failed to save: " + e);
        } finally {
            setSaving(false);
        }
    };

    const createItem = async () => {
        if (!newItemName.trim() || !showCreateModal) return;

        try {
            const fullPath = `${path}\\${newItemName}`;
            if (showCreateModal === 'folder') {
                await invoke('create_directory', { path: fullPath });
            } else {
                await invoke('write_server_file', { path: fullPath, content: '' });
            }
            toast.success(`${showCreateModal === 'folder' ? 'Folder' : 'File'} created!`);
            setShowCreateModal(null);
            setNewItemName('');
            loadFiles();
        } catch (e) {
            toast.error("Creation failed: " + e);
        }
    };

    const renameItem = async () => {
        if (!showRenameModal || !newItemName.trim() || newItemName === showRenameModal) return;

        try {
            await invoke('rename_file', {
                oldPath: `${path}\\${showRenameModal}`,
                newPath: `${path}\\${newItemName}`
            });
            toast.success("Renamed successfully!");
            setShowRenameModal(null);
            setNewItemName('');
            loadFiles();
        } catch (e) {
            toast.error("Failed to rename: " + e);
        }
    };

    const deleteItem = async () => {
        if (!showDeleteModal) return;

        try {
            const file = files.find(f => f.name === showDeleteModal);
            if (file?.is_dir) {
                await invoke('delete_directory', { path: `${path}\\${showDeleteModal}` });
            } else {
                await invoke('delete_file', { path: `${path}\\${showDeleteModal}` });
            }
            toast.success(`Deleted "${showDeleteModal}"`);
            setShowDeleteModal(null);
            loadFiles();
        } catch (e) {
            toast.error("Failed to delete: " + e);
        }
    };

    const copyPath = async (file: FileEntry) => {
        try {
            const fullPath = await invoke<string>('copy_file_path', { path: `${path}\\${file.name}` });
            await navigator.clipboard.writeText(fullPath);
            toast.success("Path copied to clipboard!");
            setContextMenu(null);
        } catch (e) {
            toast.error("Failed to copy path: " + e);
        }
    };

    const duplicateItem = async (file: FileEntry) => {
        try {
            const nameParts = file.name.split('.');
            let newName = '';
            if (nameParts.length > 1) {
                const ext = nameParts.pop();
                newName = `${nameParts.join('.')} (copy).${ext}`;
            } else {
                newName = `${file.name} (copy)`;
            }

            await invoke('duplicate_file', {
                path: `${path}\\${file.name}`,
                newPath: `${path}\\${newName}`
            });
            toast.success("Duplicated item!");
            loadFiles();
            setContextMenu(null);
        } catch (e) {
            toast.error("Failed to duplicate: " + e);
        }
    };

    const downloadFile = async (file: FileEntry) => {
        if (file.is_dir) {
            toast.error("Cannot download directories yet");
            return;
        }
        try {
            // Read file as binary/base64 or text?
            // For now, simpler to use existing read_server_file which likely returns string (utf8).
            // NOTE: If read_server_file fails on binary, this needs a binary reader command.
            // Assuming text for config/logs, might fail for jars.
            // A better way is to use tauri's fs API if available or use a specialized command.
            // Given current constraints, we'll try reading it.

            // To properly support binary download, we'd need a backend command 'read_file_binary'.
            // If the user wants to download a world zip or jar, this might be tricky without it.
            // Let's rely on copying path for external tools for big files, 
            // but for small configs we can try.

            const content = await invoke<string>('read_server_file', { path: `${path}\\${file.name}` });
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Download started");
            setContextMenu(null);
        } catch (e) {
            toast.error("Download failed (only text files supported): " + e);
        }
    };

    const archiveItem = async (file: FileEntry) => {
        const toastId = toast.loading("Archiving...");
        try {
            await invoke('archive_files', {
                serverPath: path,
                files: [file.name],
                archiveName: `${file.name}.zip`
            });
            toast.success("Archived successfully!", { id: toastId });
            loadFiles();
            setContextMenu(null);
        } catch (e) {
            toast.error("Archive failed: " + e, { id: toastId });
        }
    };

    const extractItem = async (file: FileEntry) => {
        const toastId = toast.loading("Extracting...");
        try {
            await invoke('extract_file', {
                serverPath: path,
                fileName: file.name
            });
            toast.success("Extracted successfully!", { id: toastId });
            loadFiles();
            setContextMenu(null);
        } catch (e) {
            toast.error("Extraction failed: " + e, { id: toastId });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        // 50MB limit for JS upload (browser memory constraint)
        if (file.size > 50 * 1024 * 1024) {
            toast.error("File too large for web upload (>50MB). Please use Drag & Drop.");
            return;
        }

        const toastId = toast.loading(`Uploading ${file.name}...`);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const byteNums = Array.from(bytes);

            await invoke('write_binary_file', {
                path: `${path}\\${file.name}`,
                content: byteNums
            });
            toast.success("Uploaded " + file.name, { id: toastId });
            loadFiles();
        } catch (err) {
            toast.error("Upload failed: " + err, { id: toastId });
        }

        // Reset
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (files.length > 100) {
            if (!confirm(`You are about to upload ${files.length} files. This process might take a while. Continue?`)) return;
        }

        const toastId = toast.loading(`Uploading folder (${files.length} files)...`);
        let errors = 0;

        // Naive iteration
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const relativePath = file.webkitRelativePath; // e.g. "MyWorld/folder/data.json"

            // We need to ensure directories exist.
            // On Windows, backend expects backslashes or handles forward? Rust std::path handles both usually.
            // But we are constructing path string.
            // relativePath includes the folder name itself as root? Yes.
            // "MyFolder/sub/file.txt"

            const targetPath = `${path}\\${relativePath.replace(/\//g, '\\')}`;
            const targetDir = targetPath.substring(0, targetPath.lastIndexOf('\\'));

            try {
                // Create dir (idempotent usually, but our command might error if exists? check server.rs)
                // server.rs create_directory uses create_dir_all, so it is OK if exists.
                await invoke('create_directory', { path: targetDir });

                const arrayBuffer = await file.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                const byteNums = Array.from(bytes);

                await invoke('write_binary_file', {
                    path: targetPath,
                    content: byteNums
                });

            } catch (err) {
                console.error("Failed to upload " + relativePath, err);
                errors++;
            }
        }

        if (errors > 0) {
            toast.error(`Completed with ${errors} errors. See console.`, { id: toastId });
        } else {
            toast.success("Folder uploaded successfully!", { id: toastId });
        }
        loadFiles();
        if (folderInputRef.current) folderInputRef.current.value = '';
    };

    const handleContextMenu = (e: React.MouseEvent, file: FileEntry) => {
        e.preventDefault();
        e.stopPropagation();

        // Smart positioning to prevent overflow
        let x = e.clientX;
        let y = e.clientY;
        const MENU_WIDTH = 200;
        const MENU_HEIGHT = 380; // Increased to accommodate Archive/Extract buttons

        if (x + MENU_WIDTH > window.innerWidth) {
            x = window.innerWidth - MENU_WIDTH - 10;
        }
        if (y + MENU_HEIGHT > window.innerHeight) {
            y = window.innerHeight - MENU_HEIGHT - 10;
        }

        setContextMenu({ x, y, file });
    };

    const hasUnsavedChanges = editingFile && editingFile.content !== editingFile.originalContent;

    // Filter files for search
    const displayedFiles = useMemo(() => {
        if (!searchQuery) return files;
        return files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [files, searchQuery]);



    if (editingFile) {
        const fileInfo = getFileInfo(editingFile.name);
        const FileIcon = fileInfo.icon;

        return (
            <div className="flex flex-col h-full bg-[#0d1117]">
                {/* Editor Header */}
                <div className="p-3 border-b border-border/50 flex justify-between items-center bg-[#161b22]">
                    <div className="flex items-center gap-3">
                        <FileIcon className={cn("w-4 h-4", fileInfo.color)} />
                        <span className="text-sm font-mono text-white">{editingFile.name}</span>
                        {hasUnsavedChanges && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Unsaved</span>
                        )}
                        <span className="text-xs text-text-muted bg-surface/50 px-2 py-0.5 rounded">{fileInfo.syntax}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (hasUnsavedChanges && !confirm("You have unsaved changes. Discard them?")) return;
                                setEditingFile(null);
                            }}
                            className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Back
                        </button>
                        <button
                            onClick={saveFile}
                            disabled={!hasUnsavedChanges || saving}
                            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                        </button>
                    </div>
                </div>

                {/* Editor Area - CodeMirror */}
                <div className="flex-1 overflow-hidden">
                    <CodeEditor
                        value={editingFile.content}
                        onChange={(newContent) => setEditingFile({ ...editingFile, content: newContent })}
                        language={
                            fileInfo.syntax === 'yaml' ? 'yaml' :
                                fileInfo.syntax === 'json' ? 'json' :
                                    fileInfo.syntax === 'properties' ? 'properties' :
                                        'text'
                        }
                    />
                </div>
            </div >
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1117]">
            {/* Context Menu */}
            {contextMenu && (
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        zIndex: 9999
                    }}
                    className="w-48 bg-[#161b22] border border-border shadow-2xl rounded-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 border-b border-white/5 mb-1">
                        <p className="text-xs font-bold text-white truncate">{contextMenu.file.name}</p>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider">{contextMenu.file.is_dir ? 'Folder' : 'File'}</p>
                    </div>

                    {!contextMenu.file.is_dir && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setContextMenu(null); handleFileClick(contextMenu.file); }}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-primary/10 hover:text-primary flex items-center gap-2"
                        >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                    )}

                    <button
                        onClick={(e) => { e.stopPropagation(); renameItem(); setShowRenameModal(contextMenu.file.name); setNewItemName(contextMenu.file.name); setContextMenu(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                        <FileText className="w-3.5 h-3.5" /> Rename
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); duplicateItem(contextMenu.file); }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                    </button>


                    {!contextMenu.file.is_dir && (
                        <button
                            onClick={(e) => { e.stopPropagation(); downloadFile(contextMenu.file); }}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 flex items-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> Download
                        </button>
                    )}

                    <div className="h-px bg-white/5 my-1" />

                    <button
                        onClick={(e) => { e.stopPropagation(); archiveItem(contextMenu.file); }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                        <Package className="w-3.5 h-3.5" /> Archive (Zip)
                    </button>

                    {(contextMenu.file.name.endsWith('.zip') || contextMenu.file.name.endsWith('.jar') || contextMenu.file.name.endsWith('.mcworld')) && (
                        <button
                            onClick={(e) => { e.stopPropagation(); extractItem(contextMenu.file); }}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 flex items-center gap-2"
                        >
                            <ArrowUpFromLine className="w-3.5 h-3.5" /> Extract Here
                        </button>
                    )}

                    <div className="h-px bg-white/5 my-1" />

                    <button
                        onClick={(e) => { e.stopPropagation(); copyPath(contextMenu.file); }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> Copy Path
                    </button>

                    <div className="h-px bg-white/5 my-1" />

                    <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteModal(contextMenu.file.name); setContextMenu(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                </div>
            )}

            {/* Toolbar */}
            <div className="p-3 border-b border-border/50 flex flex-col gap-3 bg-[#161b22]">
                <div className="flex items-center justify-between gap-3">
                    {/* Breadcrumbs */}
                    <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right">
                        <button
                            onClick={() => { setPath(serverPath); setSearchQuery(''); }}
                            className={cn(
                                "p-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center shrink-0",
                                path === serverPath ? "text-primary bg-primary/10" : "text-text-muted"
                            )}
                        >
                            <Home className="w-4 h-4" />
                        </button>

                        {path !== serverPath && (
                            <>
                                <ChevronRight className="w-4 h-4 text-text-muted/30 shrink-0" />
                                {path.replace(serverPath, '').split('\\').filter(Boolean).map((part, index, arr) => (
                                    <div key={index} className="flex items-center gap-1 shrink-0">
                                        <span onClick={() => {
                                            const newPath = serverPath + '\\' + arr.slice(0, index + 1).join('\\');
                                            setPath(newPath);
                                        }} className="text-sm font-medium text-text-muted hover:text-white cursor-pointer px-1 rounded hover:bg-white/5 transition-colors">
                                            {part}
                                        </span>
                                        {index < arr.length - 1 && (
                                            <ChevronRight className="w-4 h-4 text-text-muted/30" />
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                        <div className={cn(
                            "flex items-center bg-black/30 border border-border/50 rounded-lg overflow-hidden transition-all",
                            showSearch ? "w-48 pr-2" : "w-8 bg-transparent border-transparent"
                        )}>
                            <button
                                onClick={() => { setShowSearch(!showSearch); if (!showSearch) setSearchQuery(''); }}
                                className={cn("p-2 transition-colors", showSearch ? "text-primary" : "text-text-muted hover:bg-white/10 rounded-lg")}
                            >
                                <Search className="w-4 h-4" />
                            </button>
                            {showSearch && (
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search files..."
                                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-text-muted/50"
                                    autoFocus
                                />
                            )}
                        </div>

                        <div className="h-4 w-px bg-white/10 mx-1" />

                        <div className="flex bg-black/30 rounded-lg p-0.5 border border-border/50">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-white")}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-white")}
                            >
                                <ListIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="h-4 w-px bg-white/10 mx-1" />

                        <button onClick={() => { setShowCreateModal('file'); setNewItemName(''); }} className="p-2 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors" title="New File">
                            <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setShowCreateModal('folder'); setNewItemName(''); }} className="p-2 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors" title="New Folder">
                            <FolderPlus className="w-4 h-4" />
                        </button>
                        <button onClick={loadFiles} className="p-2 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors" title="Refresh">
                            <RefreshCw className="w-4 h-4" />
                        </button>

                        <div className="h-4 w-px bg-white/10 mx-1" />

                        {/* Hidden Inputs */}
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        {/*@ts-ignore*/}
                        <input type="file" ref={folderInputRef} onChange={handleFolderUpload} className="hidden" webkitdirectory="" />

                        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Upload File">
                            <Upload className="w-4 h-4" />
                        </button>
                        <button onClick={() => folderInputRef.current?.click()} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Upload Folder">
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-2" onClick={() => setContextMenu(null)}>
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-muted">
                        <RefreshCw className="w-8 h-8 animate-spin mb-2 text-primary" />
                        <p className="text-xs">Loading files...</p>
                    </div>
                ) : displayedFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                        <FolderOpen className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm font-medium">No files found</p>
                        {searchQuery && <p className="text-xs opacity-60">Try a different search term</p>}
                    </div>
                ) : (
                    <div className={cn(
                        viewMode === 'list' ? "flex flex-col gap-1" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                    )}>
                        {path !== serverPath && !searchQuery && (
                            <div
                                onClick={handleGoBack}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer text-text-muted group border border-transparent hover:border-white/5 transition-all",
                                    viewMode === 'list' ? "w-full" : "flex-col justify-center text-center aspect-square md:aspect-auto h-24 md:h-auto"
                                )}
                            >
                                <ChevronLeft className={cn("transition-colors group-hover:text-white", viewMode === 'list' ? "w-4 h-4" : "w-6 h-6 mb-1")} />
                                <span className="text-sm font-medium group-hover:text-white">Back</span>
                            </div>
                        )}

                        {displayedFiles.map((file) => {
                            const fileInfo = getFileInfo(file.name);
                            const Icon = file.is_dir ? Folder : fileInfo.icon;

                            return (
                                <div
                                    key={file.name}
                                    onClick={() => handleFileClick(file)}
                                    onContextMenu={(e) => handleContextMenu(e, file)}
                                    className={cn(
                                        "group relative rounded-xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/10 bg-surface/20",
                                        viewMode === 'list'
                                            ? "flex items-center justify-between p-2"
                                            : "flex flex-col p-4 hover:-translate-y-0.5 shadow-sm hover:shadow-lg"
                                    )}
                                >
                                    <div className={cn("flex items-center gap-3 min-w-0", viewMode === 'grid' && "flex-col text-center w-full")}>
                                        <div className={cn(
                                            "rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                                            file.is_dir ? "bg-blue-500/10 text-blue-400" : `bg-white/5 ${fileInfo.color}`,
                                            viewMode === 'list' ? "w-8 h-8" : "w-12 h-12 mb-2 p-2.5"
                                        )}>
                                            <Icon className="w-full h-full" />
                                        </div>
                                        <div className="min-w-0 w-full">
                                            <p className={cn("font-medium text-white truncate transition-colors group-hover:text-primary", viewMode === 'list' ? "text-sm" : "text-xs")}>
                                                {file.name}
                                            </p>
                                            <p className={cn("text-text-muted", viewMode === 'list' ? "text-[10px] flex items-center gap-2" : "text-[10px] mt-0.5")}>
                                                {file.is_dir ? 'Folder' : formatFileSize(file.size)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={(e) => handleContextMenu(e, file)}
                                        className={cn(
                                            "rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-all",
                                            viewMode === 'list' ? "p-1.5 opacity-0 group-hover:opacity-100" : "absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100"
                                        )}
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Rename Modal */}
            {showRenameModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#161b22] border border-border rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-white mb-4">Rename Item</h3>
                        <input
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-white outline-none focus:border-primary mb-4"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && renameItem()}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowRenameModal(null)} className="px-3 py-1.5 text-sm font-bold text-text-muted hover:text-white">Cancel</button>
                            <button onClick={renameItem} className="px-3 py-1.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90">Rename</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#161b22] border border-border rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-white mb-4">Create New {showCreateModal === 'file' ? 'File' : 'Folder'}</h3>
                        <input
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={showCreateModal === 'file' ? "config.yml" : "world_nether"}
                            className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-white outline-none focus:border-primary mb-4"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && createItem()}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowCreateModal(null)} className="px-3 py-1.5 text-sm font-bold text-text-muted hover:text-white">Cancel</button>
                            <button onClick={createItem} className="px-3 py-1.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#161b22] border border-red-500/30 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-white mb-2 text-red-400">Delete Item?</h3>
                        <p className="text-sm text-text-muted mb-6">
                            Are you sure you want to delete <span className="text-white font-mono bg-white/5 px-1 rounded">{showDeleteModal}</span>? This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowDeleteModal(null)} className="px-3 py-1.5 text-sm font-bold text-text-muted hover:text-white">Cancel</button>
                            <button onClick={deleteItem} className="px-3 py-1.5 bg-red-500/10 border border-red-500/50 text-red-500 text-sm font-bold rounded-lg hover:bg-red-500 hover:text-white transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
