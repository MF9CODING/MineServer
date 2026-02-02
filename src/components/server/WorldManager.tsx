import { useState, useEffect, useRef } from 'react';
import { Server } from '../../stores/appStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { save, open } from '@tauri-apps/plugin-dialog';
import {
    Globe, Upload, Trash2, RefreshCw, AlertTriangle,
    HardDrive, Flame, Ghost, FolderOpen,
    Mountain, Trees, Download,
    Layers, X, Check, Edit2, Map as MapIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Dimension {
    name: string;
    id: string;
    size_bytes: number;
}

interface WorldGroup {
    level_name: string;
    dimensions: Dimension[];
    total_size: number;
    exists: boolean;
    path_debug?: string;
}

interface WorldManagerProps {
    server: Server;
}

// Dimension metadata
const DIMENSION_INFO: Record<string, { name: string; icon: any; color: string; bgColor: string; textColor: string; borderColor: string; description: string }> = {
    overworld: {
        name: 'Overworld',
        icon: Globe,
        color: 'from-green-500 to-emerald-500',
        bgColor: 'bg-green-500/20',
        textColor: 'text-green-400',
        borderColor: 'border-green-500/30',
        description: 'The main survival world with biomes, villages, and structures'
    },
    nether: {
        name: 'The Nether',
        icon: Flame,
        color: 'from-red-500 to-orange-500',
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/30',
        description: 'Dangerous dimension with lava, fortresses, and bastions'
    },
    end: {
        name: 'The End',
        icon: Ghost,
        color: 'from-purple-500 to-pink-500',
        bgColor: 'bg-purple-500/20',
        textColor: 'text-purple-400',
        borderColor: 'border-purple-500/30',
        description: 'Home of the Ender Dragon, End Cities, and rare Shulkers'
    }
};

// World types for regeneration
const WORLD_TYPES = [
    { id: 'default', name: 'Default', icon: Mountain, description: 'Normal world generation' },
    { id: 'flat', name: 'Superflat', icon: Layers, description: 'Flat terrain, good for building' },
    { id: 'large_biomes', name: 'Large Biomes', icon: Trees, description: 'Biomes 16x larger than normal' },
    { id: 'amplified', name: 'Amplified', icon: Mountain, description: 'Extreme terrain heights' },
    { id: 'single_biome', name: 'Single Biome', icon: MapIcon, description: 'One biome across the world' },
];

export default function WorldManager({ server }: WorldManagerProps) {
    const [info, setInfo] = useState<WorldGroup | null>(null);
    const [allWorlds, setAllWorlds] = useState<string[]>([]);
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Modal State
    const [showRegenModal, setShowRegenModal] = useState(false);
    const [regenTarget, setRegenTarget] = useState<'all' | 'overworld' | 'nether' | 'end'>('all');
    const [seed, setSeed] = useState("");
    const [levelType, setLevelType] = useState("default");
    const [structures, setStructures] = useState(true);
    const [difficulty, setDifficulty] = useState("normal");
    const [hardcore, setHardcore] = useState(false);
    const [spawnAnimals, setSpawnAnimals] = useState(true);
    const [spawnMonsters, setSpawnMonsters] = useState(true);
    const [allowNether, setAllowNether] = useState(true);

    // Import State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importPath, setImportPath] = useState('');
    const [importName, setImportName] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    // Upload refs for each dimension
    const overworldInputRef = useRef<HTMLInputElement>(null);
    const netherInputRef = useRef<HTMLInputElement>(null);
    const endInputRef = useRef<HTMLInputElement>(null);

    // Progress
    const [uploadProgress, setUploadProgress] = useState<{ percentage: number; details: string } | null>(null);

    const fetchInfo = async () => {
        try {
            const data = await invoke<WorldGroup>('get_world_info', { server_path: server.path });
            setInfo(data);

            const files = await invoke<any[]>('get_server_files', { path: server.path });
            const folders = files
                .filter(f => f.is_dir)
                .map(f => f.name)
                .filter(name =>
                    !['logs', 'plugins', 'mods', 'crash-reports', 'libraries', 'versions', 'cache', 'config'].includes(name) &&
                    !name.startsWith('.')
                );
            setAllWorlds(folders);

        } catch (e) {
            console.error("Failed to get world info", e);
        }
    };

    const handleImportClick = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'World Archive', extensions: ['zip', 'mcworld'] }]
            });

            if (selected && typeof selected === 'string') {
                // Extract filename as default import name
                const filename = selected.split(/[\\/]/).pop()?.replace(/\.(zip|mcworld)$/i, '') || 'imported-world';
                setImportPath(selected);
                setImportName(filename);
                setShowImportModal(true);
            }
        } catch (e) {
            toast.error("Failed to open file dialog");
        }
    };

    const handleImportConfirm = async () => {
        if (!importPath || !importName.trim()) {
            toast.error("Please provide a valid world name");
            return;
        }

        // Basic validation
        if (allWorlds.includes(importName)) {
            toast.error("A world with this name already exists");
            return;
        }

        setIsImporting(true);
        const toastId = toast.loading("Importing world...");
        setShowImportModal(false);

        try {
            await invoke('import_world', {
                serverPath: server.path,
                zipPath: importPath,
                newLevelName: importName
            });
            toast.success("Domination! World imported successfully.", { id: toastId });
            fetchInfo();
        } catch (e: any) {
            toast.error("Import failed: " + (e.message || e), { id: toastId });
        } finally {
            setIsImporting(false);
            setImportPath('');
            setImportName('');
        }
    };

    useEffect(() => {
        fetchInfo();
        const interval = setInterval(fetchInfo, 10000);
        return () => clearInterval(interval);
    }, [server.path]);

    const handleUploadDimension = async (dimension: 'overworld' | 'nether' | 'end', file: File) => {
        if (!file) return;

        // Validate file type
        if (!file.name.endsWith('.zip') && !file.name.endsWith('.mcworld')) {
            toast.error("Please upload a .zip or .mcworld file");
            return;
        }

        const toastId = toast.loading(`Preparing ${dimension} upload...`);

        try {
            setUploadProgress({ percentage: 0, details: "Reading file..." });

            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            // write_binary_file expects number[]
            const byteNums = Array.from(bytes);

            // Write to temp location in server directory
            const tempZipPath = `${server.path}\\__temp_upload_${Date.now()}.zip`;

            setUploadProgress({ percentage: 10, details: "Saving to disk..." });

            await invoke('write_binary_file', {
                path: tempZipPath,
                content: byteNums
            });

            setUploadProgress({ percentage: 20, details: "Starting extraction..." });

            // Setup progress listener
            const unlisten = await listen<{ percentage: number; details: string }>('world_upload_progress', (event) => {
                // Scale 20-100 for the extraction phase
                const scaled = 20 + (event.payload.percentage * 0.8);
                setUploadProgress({ percentage: Math.round(scaled), details: event.payload.details });
            });

            // Call backend
            await invoke('upload_dimension', {
                serverPath: server.path,
                zipPath: tempZipPath,
                dimension: dimension
            });

            unlisten();

            // Cleanup temp file
            try {
                await invoke('delete_file', { path: tempZipPath });
            } catch (e) {
                // Ignore cleanup errors
            }

            toast.success(`${DIMENSION_INFO[dimension].name} uploaded successfully!`, { id: toastId });
            fetchInfo();

        } catch (e) {
            toast.error("Upload failed: " + e, { id: toastId });
        } finally {
            setUploadProgress(null);
        }
    };

    const handleDelete = async (dimension?: string) => {
        const target = dimension || 'all dimensions';
        if (!confirm(`Are you sure you want to DELETE ${target}? This cannot be undone.`)) return;

        try {
            if (dimension) {
                await invoke('delete_dimension_folder', { server_path: server.path, dimension });
            } else {
                await invoke('delete_world', { server_path: server.path });
            }
            toast.success(`${dimension ? dimension : 'World'} deleted.`);
            fetchInfo();
        } catch (e) {
            toast.error("Delete failed: " + e);
        }
    };

    const handleSwitchWorld = async (worldName: string) => {
        if (server.status === 'running') {
            toast.error("Stop the server to switch worlds.");
            return;
        }
        try {
            await invoke('update_server_properties', {
                server_path: server.path,
                properties: { 'level-name': worldName }
            });
            toast.success(`Active world switched to: ${worldName}`);
            fetchInfo();
        } catch (e) {
            toast.error("Failed to switch world: " + e);
        }
    };

    const handleRename = async (oldName: string) => {
        const newName = prompt("Enter new world name:", oldName);
        if (!newName || newName === oldName) return;

        try {
            await invoke('rename_file', {
                oldPath: `${server.path}\\${oldName}`,
                newPath: `${server.path}\\${newName}`
            });
            toast.success(`Renamed to ${newName}`);
            fetchInfo();
        } catch (e) {
            toast.error("Rename failed: " + e);
        }
    };

    const handleExportWorld = async (worldName: string = info?.level_name || 'world') => {
        try {
            const filePath = await save({
                defaultPath: `${worldName}.zip`,
                filters: [{
                    name: 'Zip Archive',
                    extensions: ['zip']
                }]
            });

            if (!filePath) return;

            const toastId = toast.loading("Archiving world...");
            setUploadProgress({ percentage: 0, details: "Starting archive..." });

            const unlisten = await listen<{ percentage: number; details: string }>('world_archive_progress', (event) => {
                setUploadProgress({ percentage: event.payload.percentage, details: event.payload.details });
            });

            await invoke('archive_world', {
                serverPath: server.path,
                savePath: filePath
            });

            unlisten();
            toast.success("World exported successfully!", { id: toastId });
        } catch (e) {
            toast.error("Export failed: " + e);
        } finally {
            setUploadProgress(null);
        }
    };

    const handleOpenFolder = async (worldName: string) => {
        toast.info(`World folder is located at: ${server.path}\\${worldName}`);
        try {
            await invoke('open_folder', { path: `${server.path}\\${worldName}` });
        } catch (e) {
            // Ignore if command doesn't exist
        }
    };

    const handleRegenerate = async () => {
        setShowRegenModal(false);
        setIsRegenerating(true);
        const toastId = toast.loading("Regenerating world...");

        try {
            if (server.status === 'running') {
                throw new Error("Server must be stopped to regenerate world.");
            }

            await invoke('regenerate_world', {
                server_path: server.path,
                seed,
                level_type: levelType,
                generate_structures: structures,
                hardcore,
                difficulty,
                spawn_animals: spawnAnimals,
                spawn_monsters: spawnMonsters,
                allow_nether: allowNether,
                target: regenTarget
            });

            toast.success("World regenerated!", { id: toastId });
            fetchInfo();
        } catch (e: any) {
            toast.error("Regeneration failed: " + (e.message || e), { id: toastId });
        } finally {
            setIsRegenerating(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getDimensionType = (id: string): 'overworld' | 'nether' | 'end' => {
        if (id.includes('nether') || id.endsWith('_nether')) return 'nether';
        if (id.includes('end') || id.endsWith('_the_end')) return 'end';
        return 'overworld';
    };

    const openRegenModal = (target: 'all' | 'overworld' | 'nether' | 'end') => {
        setRegenTarget(target);
        setShowRegenModal(true);
    };

    // Check which dimensions exist
    const hasOverworld = info?.dimensions.some(d => getDimensionType(d.id) === 'overworld');
    const hasNether = info?.dimensions.some(d => getDimensionType(d.id) === 'nether');
    const hasEnd = info?.dimensions.some(d => getDimensionType(d.id) === 'end');

    const getDimensionSize = (type: 'overworld' | 'nether' | 'end') => {
        const dim = info?.dimensions.find(d => getDimensionType(d.id) === type);
        return dim ? dim.size_bytes : 0;
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#0d1117]">
            {/* Upload Progress Overlay */}
            {uploadProgress && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8">
                    <div className="w-full max-w-md space-y-4">
                        <div className="text-center">
                            <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-bounce" />
                            <h3 className="text-xl font-bold text-white mb-1">
                                {uploadProgress.details.startsWith("Archiving") ? "Archiving World" : "Uploading World"}
                            </h3>
                            <p className="text-text-muted text-sm">{uploadProgress.details}</p>
                        </div>

                        <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress.percentage}%` }}
                            />
                        </div>
                        <div className="text-right text-xs font-mono text-blue-300">
                            {uploadProgress.percentage}%
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden file inputs */}
            <input
                type="file"
                ref={overworldInputRef}
                accept=".zip,.mcworld"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadDimension('overworld', file);
                    e.target.value = '';
                }}
            />
            <input
                type="file"
                ref={netherInputRef}
                accept=".zip,.mcworld"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadDimension('nether', file);
                    e.target.value = '';
                }}
            />
            <input
                type="file"
                ref={endInputRef}
                accept=".zip,.mcworld"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadDimension('end', file);
                    e.target.value = '';
                }}
            />

            {/* Header */}
            <div className="p-5 border-b border-border/50 bg-gradient-to-r from-blue-500/10 to-green-500/10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl shadow-lg shadow-blue-500/20">
                            <Globe className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                World Management
                                {info?.exists && (
                                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
                                        Active
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-text-muted">
                                {info?.level_name || 'world'} - {info?.exists ? formatSize(info.total_size) : 'Pending Generation'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleImportClick}
                            disabled={isRegenerating || isImporting || server.status === 'running'}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            <Upload className={cn("w-4 h-4", isImporting && "animate-spin")} />
                            Import
                        </button>
                        <button
                            onClick={() => openRegenModal('all')}
                            disabled={isRegenerating || isImporting || server.status === 'running'}
                            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            <RefreshCw className={cn("w-4 h-4", isRegenerating && "animate-spin")} />
                            New World
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-8">

                {/* Dimensions Grid - Always show all 3 */}
                <section>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                        <Layers className="w-4 h-4 text-primary" />
                        Dimensions
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Overworld Card */}
                        <DimensionCard
                            type="overworld"
                            exists={hasOverworld || false}
                            size={getDimensionSize('overworld')}
                            server={server}
                            onUpload={() => overworldInputRef.current?.click()}
                            onReset={() => openRegenModal('overworld')}
                            onDelete={() => handleDelete('overworld')}
                            onDownload={() => handleExportWorld()}
                            formatSize={formatSize}
                        />

                        {/* Nether Card */}
                        <DimensionCard
                            type="nether"
                            exists={hasNether || false}
                            size={getDimensionSize('nether')}
                            server={server}
                            onUpload={() => netherInputRef.current?.click()}
                            onReset={() => openRegenModal('nether')}
                            onDelete={() => handleDelete('nether')}
                            onDownload={() => handleExportWorld()}
                            formatSize={formatSize}
                        />

                        {/* End Card */}
                        <DimensionCard
                            type="end"
                            exists={hasEnd || false}
                            size={getDimensionSize('end')}
                            server={server}
                            onUpload={() => endInputRef.current?.click()}
                            onReset={() => openRegenModal('end')}
                            onDelete={() => handleDelete('end')}
                            onDownload={() => handleExportWorld()}
                            formatSize={formatSize}
                        />
                    </div>
                </section>

                {/* Available Worlds List */}
                {allWorlds.length > 0 && (
                    <section>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                            <FolderOpen className="w-4 h-4 text-primary" />
                            Available Worlds
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {allWorlds.map(w => {
                                const isActive = w === info?.level_name;
                                return (
                                    <div key={w} className={cn(
                                        "group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                        isActive ? "bg-primary/10 border-primary shadow-lg shadow-primary/5" : "bg-surface/30 border-border hover:bg-surface hover:border-white/20"
                                    )}>
                                        <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                            isActive ? "bg-primary text-black" : "bg-black/30 text-text-muted"
                                        )}>
                                            <Globe className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={cn("font-bold truncate", isActive ? "text-primary" : "text-white")}>{w}</h4>
                                            <p className="text-xs text-text-muted truncate">{isActive ? "Currently Active" : "Click to load"}</p>
                                        </div>
                                        {isActive ? (
                                            <Check className="w-5 h-5 text-primary" />
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleSwitchWorld(w)}
                                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/60 flex items-center justify-center text-white font-bold backdrop-blur-sm transition-all rounded-xl z-20"
                                                >
                                                    Load World
                                                </button>
                                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 flex flex-col gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRename(w); }}
                                                        className="p-1.5 hover:bg-white/20 bg-black/40 rounded-lg text-text-muted hover:text-white"
                                                        title="Rename World"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleExportWorld(w); }}
                                                        className="p-1.5 hover:bg-white/20 bg-black/40 rounded-lg text-text-muted hover:text-white"
                                                        title="Download World (Zip)"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenFolder(w); }}
                                                        className="p-1.5 hover:bg-white/20 bg-black/40 rounded-lg text-text-muted hover:text-white"
                                                        title="Open Folder"
                                                    >
                                                        <FolderOpen className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>



            {/* Import Modal */}
            {
                showImportModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-[#161b22] border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-blue-400" />
                                    Import World
                                </h2>
                                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-surface rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-text-muted" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">File Path</label>
                                    <div className="p-3 bg-black/30 rounded-lg border border-white/5 text-xs font-mono text-text-muted break-all">
                                        {importPath}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">New World Name</label>
                                    <input
                                        value={importName}
                                        onChange={(e) => setImportName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))} // Basic sanitation
                                        placeholder="my_imported_world"
                                        className="w-full bg-[#0d1117] border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-blue-500 transition-colors"
                                        autoFocus
                                    />
                                    <p className="text-[10px] text-text-muted mt-1">Only alphanumeric, dashes, and underscores allowed.</p>
                                </div>

                                <div className="pt-2 flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowImportModal(false)}
                                        className="px-4 py-2 rounded-lg font-bold text-sm bg-surface hover:bg-surface-hover text-text-muted hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleImportConfirm}
                                        className="px-6 py-2 rounded-lg font-bold text-sm bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all"
                                    >
                                        Import World
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Regeneration Modal */}
            {
                showRegenModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-[#161b22] border border-border rounded-2xl w-full max-w-xl p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <RefreshCw className="w-5 h-5 text-orange-400" />
                                    {regenTarget === 'all' ? 'Create New World' : `Reset ${DIMENSION_INFO[regenTarget]?.name || regenTarget}`}
                                </h2>
                                <button onClick={() => setShowRegenModal(false)} className="p-2 hover:bg-surface rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-text-muted" />
                                </button>
                            </div>

                            <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto">
                                {/* Seed */}
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">World Seed</label>
                                    <input
                                        value={seed}
                                        onChange={(e) => setSeed(e.target.value)}
                                        placeholder="Leave empty for random seed"
                                        className="w-full bg-[#0d1117] border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-primary"
                                    />
                                </div>

                                {/* World Type */}
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-2 block">World Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {WORLD_TYPES.map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => setLevelType(type.id)}
                                                className={cn(
                                                    "p-3 rounded-xl border text-left transition-all",
                                                    levelType === type.id
                                                        ? "bg-primary/20 border-primary"
                                                        : "bg-surface/50 border-border hover:border-white/20"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <type.icon className={cn("w-4 h-4", levelType === type.id ? "text-primary" : "text-text-muted")} />
                                                    <span className="font-bold text-white text-sm">{type.name}</span>
                                                </div>
                                                <p className="text-xs text-text-muted">{type.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Difficulty */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">Difficulty</label>
                                        <select
                                            value={difficulty}
                                            onChange={(e) => setDifficulty(e.target.value)}
                                            className="w-full bg-[#0d1117] border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-primary appearance-none cursor-pointer"
                                        >
                                            <option value="peaceful">Peaceful</option>
                                            <option value="easy">Easy</option>
                                            <option value="normal">Normal</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                                            <input
                                                type="checkbox"
                                                checked={hardcore}
                                                onChange={e => setHardcore(e.target.checked)}
                                                className="w-4 h-4 rounded accent-red-500"
                                            />
                                            <span className="text-sm text-red-400 font-bold">Hardcore Mode</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Feature Toggles */}
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-3 p-3 bg-surface/50 border border-border rounded-xl cursor-pointer hover:border-white/20 transition-colors">
                                        <input type="checkbox" checked={structures} onChange={e => setStructures(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                                        <div>
                                            <span className="text-sm text-white font-bold block">Structures</span>
                                            <span className="text-xs text-text-muted">Villages, Temples, etc</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-surface/50 border border-border rounded-xl cursor-pointer hover:border-white/20 transition-colors">
                                        <input type="checkbox" checked={spawnAnimals} onChange={e => setSpawnAnimals(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                                        <div>
                                            <span className="text-sm text-white font-bold block">Spawn Animals</span>
                                            <span className="text-xs text-text-muted">Passive mobs</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-surface/50 border border-border rounded-xl cursor-pointer hover:border-white/20 transition-colors">
                                        <input type="checkbox" checked={spawnMonsters} onChange={e => setSpawnMonsters(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                                        <div>
                                            <span className="text-sm text-white font-bold block">Spawn Monsters</span>
                                            <span className="text-xs text-text-muted">Hostile mobs</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-surface/50 border border-border rounded-xl cursor-pointer hover:border-white/20 transition-colors">
                                        <input type="checkbox" checked={allowNether} onChange={e => setAllowNether(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                                        <div>
                                            <span className="text-sm text-white font-bold block">Allow Nether</span>
                                            <span className="text-xs text-text-muted">Nether portals work</span>
                                        </div>
                                    </label>
                                </div>

                                {/* Warning */}
                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex gap-3 items-center">
                                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                                    <p className="text-xs text-orange-400">
                                        This will permanently DELETE {regenTarget === 'all' ? 'the current world and all dimensions' : `the ${DIMENSION_INFO[regenTarget]?.name}`}.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowRegenModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-text font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRegenerate}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    {regenTarget === 'all' ? 'Create World' : 'Reset Dimension'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

// Dimension Card Component
interface DimensionCardProps {
    type: 'overworld' | 'nether' | 'end';
    exists: boolean;
    size: number;
    server: Server;
    onUpload: () => void;
    onReset: () => void;
    onDelete: () => void;
    onDownload: () => void;
    formatSize: (bytes: number) => string;
}

function DimensionCard({ type, exists, size, server, onUpload, onReset, onDelete, onDownload, formatSize }: DimensionCardProps) {
    const dimInfo = DIMENSION_INFO[type];
    const DimIcon = dimInfo.icon;
    const isRunning = server.status === 'running';

    // Logic for Bedrock detection
    const isBedrock = server.type?.toLowerCase().includes('bedrock');
    const isIntegrated = isBedrock && type !== 'overworld';

    // Status Display Logic
    let statusDisplay = null;
    if (exists) {
        statusDisplay = (
            <>
                <HardDrive className="w-3 h-3" />
                {formatSize(size)}
            </>
        );
    } else if (isIntegrated) {
        statusDisplay = <span className="text-blue-400 font-medium">Integrated</span>;
    } else {
        statusDisplay = <span className="text-yellow-400 font-medium animate-pulse">Pending Generation</span>;
    }

    return (
        <div className={cn(
            "relative rounded-xl border overflow-hidden transition-all hover:shadow-lg",
            dimInfo.borderColor,
            exists ? "bg-surface/30" : "bg-surface/10 border-dashed"
        )}>
            {/* Gradient Header */}
            <div className={cn("p-4 bg-gradient-to-r", dimInfo.color, "bg-opacity-20")}>
                <div className="flex items-center gap-3">
                    <div className={cn("p-3 rounded-xl", dimInfo.bgColor)}>
                        <DimIcon className={cn("w-6 h-6", dimInfo.textColor)} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-white text-lg">{dimInfo.name}</h4>
                        <p className="text-xs text-text-muted flex items-center gap-1.5">
                            {statusDisplay}
                        </p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                <p className="text-xs text-text-muted">{dimInfo.description}</p>

                {/* Actions */}
                <div className="grid grid-cols-4 gap-2">
                    <button
                        onClick={onUpload}
                        disabled={isRunning || isIntegrated}
                        className={cn(
                            "py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50",
                            "bg-primary/20 text-primary hover:bg-primary/30"
                        )}
                        title="Upload"
                    >
                        <Upload className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={onDownload}
                        disabled={isRunning || !exists || isIntegrated}
                        className={cn(
                            "py-2.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50",
                            "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                        )}
                        title="Download"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={onReset}
                        disabled={isRunning || isIntegrated}
                        className={cn(
                            "py-2.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50",
                            dimInfo.bgColor,
                            dimInfo.textColor,
                            "hover:opacity-80"
                        )}
                        title="Reset"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onDelete}
                        disabled={isRunning || !exists || isIntegrated}
                        className="py-2.5 rounded-lg font-bold text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center disabled:opacity-50"
                        title="Delete"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
