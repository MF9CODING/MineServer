import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, Server } from '../../stores/appStore';
import {
    Trash2, Edit2, FolderOpen, MemoryStick, Cpu, Save,
    RefreshCw, Download, Shield, Palette, Settings,
    ChevronRight, Database, Power, Globe, Copy, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '../../lib/utils';

interface SettingsManagerProps {
    server: Server;
}

const SERVER_ICONS = [
    { id: 'default', emoji: '🎮', label: 'Default' },
    { id: 'sword', emoji: '⚔️', label: 'PvP' },
    { id: 'pickaxe', emoji: '⛏️', label: 'Survival' },
    { id: 'tree', emoji: '🌲', label: 'Nature' },
    { id: 'castle', emoji: '🏰', label: 'Medieval' },
    { id: 'rocket', emoji: '🚀', label: 'Modded' },
    { id: 'star', emoji: '⭐', label: 'Premium' },
    { id: 'fire', emoji: '🔥', label: 'Hardcore' },
];

export function SettingsManager({ server }: SettingsManagerProps) {
    const { updateServer, deleteServer, systemInfo } = useAppStore();
    const navigate = useNavigate();
    const [name, setName] = useState(server.name);
    const [allocatedRam, setAllocatedRam] = useState(server.allocatedRam);
    const [allocatedCores, setAllocatedCores] = useState(server.allocatedCores || 2);
    const [maxPlayers, setMaxPlayers] = useState(server.maxPlayers);
    const [autoRestart, setAutoRestart] = useState(server.autoRestart || false);
    const [selectedIcon, setSelectedIcon] = useState(server.icon || 'default');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copiedPath, setCopiedPath] = useState(false);

    const hasChanges = name !== server.name ||
        allocatedRam !== server.allocatedRam ||
        allocatedCores !== (server.allocatedCores || 2) ||
        maxPlayers !== server.maxPlayers ||
        autoRestart !== (server.autoRestart || false) ||
        selectedIcon !== (server.icon || 'default');

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            await updateServer(server.id, {
                name,
                allocatedRam,
                allocatedCores,
                maxPlayers,
                autoRestart,
                icon: selectedIcon
            });
            toast.success("Settings saved!");
        } catch (e) {
            toast.error("Failed to save: " + e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you absolutely sure you want to delete "${server.name}"?\n\nThis will permanently remove all server files and cannot be undone.`)) return;

        setIsDeleting(true);
        try {
            await deleteServer(server.id);
            toast.success("Server deleted.");
            navigate('/servers');
        } catch (e) {
            toast.error("Failed to delete: " + e);
            setIsDeleting(false);
        }
    };

    const handleBackupNow = async () => {
        try {
            toast.loading("Creating backup...", { id: 'backup' });
            await invoke('create_backup', {
                serverPath: server.path,
                serverName: server.name,
                backupType: 'manual'
            });
            toast.success("Backup created!", { id: 'backup' });
        } catch (e) {
            toast.error("Backup failed: " + e, { id: 'backup' });
        }
    };

    const copyPath = () => {
        navigator.clipboard.writeText(server.path);
        setCopiedPath(true);
        setTimeout(() => setCopiedPath(false), 2000);
    };

    const formatRam = (mb: number) => {
        if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
        return `${mb} MB`;
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-primary to-primary/50 rounded-xl shadow-lg shadow-primary/20">
                            <Settings className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Server Settings</h2>
                            <p className="text-xs text-text-muted">Configure your server preferences</p>
                        </div>
                    </div>
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20"
                        >
                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    )}
                </div>

                {/* General Settings */}
                <div className="bg-surface/50 border border-border/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
                        <Edit2 className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-white">General</h3>
                    </div>
                    <div className="p-5 space-y-5">
                        {/* Server Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary">Display Name</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-black/20 border border-border rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="My Awesome Server"
                            />
                        </div>

                        {/* Server Icon */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                <Palette className="w-4 h-4" /> Server Icon
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {SERVER_ICONS.map((icon) => (
                                    <button
                                        key={icon.id}
                                        onClick={() => setSelectedIcon(icon.id)}
                                        className={cn(
                                            "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all group relative overflow-hidden",
                                            selectedIcon === icon.id
                                                ? "bg-primary/10 border-primary text-white"
                                                : "bg-surface/50 border-border text-text-muted hover:border-white/20 hover:text-white hover:bg-surface"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity",
                                            selectedIcon === icon.id ? "from-primary/20 to-transparent opacity-100" : "group-hover:opacity-10"
                                        )} />
                                        <span className={cn(
                                            "text-3xl transition-transform duration-300",
                                            selectedIcon === icon.id ? "scale-110" : "group-hover:scale-110"
                                        )}>{icon.emoji}</span>
                                        <span className="text-xs font-bold uppercase tracking-wider relative z-10">{icon.label}</span>

                                        {selectedIcon === icon.id && (
                                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Server Path */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                <FolderOpen className="w-4 h-4" /> Server Location
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-black/30 border border-border rounded-xl px-4 py-3 font-mono text-sm text-text-muted truncate">
                                    {server.path}
                                </div>
                                <button
                                    onClick={copyPath}
                                    className="px-4 bg-surface hover:bg-surface-hover border border-border rounded-xl transition-colors"
                                >
                                    {copiedPath ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-text-muted" />}
                                </button>
                            </div>
                        </div>

                        {/* Protect IP */}
                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <Shield className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white flex items-center gap-2">
                                        Protect IP
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">New</span>
                                    </h4>
                                    <p className="text-xs text-text-muted">Hide server IP address in the dashboard</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    // Optimistic update
                                    updateServer(server.id, { hideIp: !server.hideIp });
                                    toast.success(`IP Protection ${!server.hideIp ? 'Enabled' : 'Disabled'}`);
                                }}
                                className={cn(
                                    "relative w-14 h-7 rounded-full transition-colors",
                                    server.hideIp ? "bg-blue-500" : "bg-surface border border-border"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all",
                                    server.hideIp ? "left-8" : "left-1"
                                )} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Performance Settings */}
                <div className="bg-surface/50 border border-border/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-orange-400" />
                        <h3 className="font-bold text-white">Performance</h3>
                    </div>
                    <div className="p-5 space-y-6">
                        {/* RAM Allocation */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                    <MemoryStick className="w-4 h-4 text-purple-400" /> Allocated RAM
                                </label>
                                <span className="text-white font-mono font-bold bg-purple-500/20 px-3 py-1 rounded-lg border border-purple-500/30">
                                    {formatRam(allocatedRam)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="512"
                                max={systemInfo ? Math.min(16384, Math.floor(systemInfo.totalMemory / 1024 / 1024)) : 16384}
                                step="512"
                                value={allocatedRam}
                                onChange={(e) => setAllocatedRam(Number(e.target.value))}
                                className="w-full h-2.5 bg-purple-950/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                            <div className="flex justify-between text-xs text-text-muted">
                                <span>512 MB</span>
                                <span>{systemInfo ? Math.min(16, Math.round(systemInfo.totalMemory / 1024 / 1024 / 1024)) : 16} GB Max</span>
                            </div>
                        </div>

                        {/* CPU Cores */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                    <Cpu className="w-4 h-4 text-orange-400" /> CPU Cores
                                </label>
                                <span className="text-white font-mono font-bold bg-orange-500/20 px-3 py-1 rounded-lg border border-orange-500/30">
                                    {allocatedCores} Cores
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max={systemInfo ? systemInfo.cpuThreads : 8}
                                step="1"
                                value={allocatedCores}
                                onChange={(e) => setAllocatedCores(Number(e.target.value))}
                                className="w-full h-2.5 bg-orange-950/50 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                            <div className="flex justify-between text-xs text-text-muted">
                                <span>1 Core</span>
                                <span>{systemInfo ? systemInfo.cpuThreads : 8} Available</span>
                            </div>
                        </div>

                        {/* Max Players */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-blue-400" /> Max Players
                                </label>
                                <span className="text-white font-mono font-bold bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-500/30">
                                    {maxPlayers} Players
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                step="1"
                                value={maxPlayers}
                                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                                className="w-full h-2.5 bg-blue-950/50 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="flex justify-between text-xs text-text-muted">
                                <span>1 Player</span>
                                <span>100 Max</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Server Behavior */}
                <div className="bg-surface/50 border border-border/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
                        <Power className="w-5 h-5 text-green-400" />
                        <h3 className="font-bold text-white">Behavior</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        {/* Auto Restart */}
                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/20 rounded-lg">
                                    <RefreshCw className="w-4 h-4 text-green-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">Auto Restart</h4>
                                    <p className="text-xs text-text-muted">Automatically restart if the server crashes</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAutoRestart(!autoRestart)}
                                className={cn(
                                    "relative w-14 h-7 rounded-full transition-colors",
                                    autoRestart ? "bg-green-500" : "bg-surface border border-border"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all",
                                    autoRestart ? "left-8" : "left-1"
                                )} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-surface/50 border border-border/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
                        <Database className="w-5 h-5 text-cyan-400" />
                        <h3 className="font-bold text-white">Quick Actions</h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                            onClick={handleBackupNow}
                            className="flex items-center justify-between p-4 bg-black/20 hover:bg-black/30 rounded-xl border border-border/50 hover:border-cyan-500/30 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-500/20 rounded-lg">
                                    <Download className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-bold text-white">Create Backup</h4>
                                    <p className="text-xs text-text-muted">Save current server state</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
                        </button>

                        <button
                            onClick={() => navigate('/backups')}
                            className="flex items-center justify-between p-4 bg-black/20 hover:bg-black/30 rounded-xl border border-border/50 hover:border-blue-500/30 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <Database className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-bold text-white">View Backups</h4>
                                    <p className="text-xs text-text-muted">Manage all backups</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-red-500/20 flex items-center gap-3">
                        <Shield className="w-5 h-5 text-red-500" />
                        <h3 className="font-bold text-red-500">Danger Zone</h3>
                    </div>
                    <div className="p-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h4 className="font-bold text-white flex items-center gap-2">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                    Delete Server
                                </h4>
                                <p className="text-sm text-text-muted mt-1">
                                    Permanently remove this server and all its files. This cannot be undone.
                                </p>
                            </div>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors whitespace-nowrap shadow-lg shadow-red-900/30"
                            >
                                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                {isDeleting ? "Deleting..." : "Delete Server"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
