import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Database, Download, Trash2, RefreshCw, FolderOpen, Clock,
    HardDrive, Archive, CheckCircle, Plus
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/appStore';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface BackupInfo {
    id: string;
    serverName: string;
    serverPath: string;
    createdAt: string;
    sizeBytes: number;
    backupType: string;
    filePath: string;
}

export function Backups() {
    const { servers } = useAppStore();
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [selectedServer, setSelectedServer] = useState<string>('all');

    useEffect(() => {
        loadBackups();
    }, []);

    const loadBackups = async () => {
        setIsLoading(true);
        try {
            const result = await invoke<BackupInfo[]>('list_backups');
            setBackups(result);
        } catch (e) {
            console.error('Failed to load backups:', e);
            toast.error('Failed to load backups');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredBackups = selectedServer === 'all'
        ? backups
        : backups.filter(b => b.serverName === selectedServer);

    const totalSize = backups.reduce((acc, b) => acc + b.sizeBytes, 0);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [targetServerId, setTargetServerId] = useState<string>("");

    const handleCreateClick = () => {
        if (servers.length === 0) {
            toast.error("No servers to backup!");
            return;
        }
        // Default to first if none selected, or keep previous selection
        if (!targetServerId && servers.length > 0) {
            setTargetServerId(servers[0].id);
        }
        setShowCreateModal(true);
    };

    const createBackup = async () => {
        const server = servers.find(s => s.id === targetServerId);
        if (!server) return;

        setIsCreating(true);
        setShowCreateModal(false);
        toast.info(`Creating backup of ${server.name}...`);

        try {
            await invoke('create_backup', {
                serverPath: server.path,
                serverName: server.name,
                backupType: 'manual'
            });
            toast.success("Backup created successfully!");
            loadBackups();
        } catch (e) {
            toast.error('Backup failed: ' + e);
        } finally {
            setIsCreating(false);
        }
    };

    const deleteBackup = async (id: string) => {
        if (!confirm("Delete this backup? This cannot be undone.")) return;

        try {
            await invoke('delete_backup', { backupId: id });
            toast.success("Backup deleted");
            loadBackups();
        } catch (e) {
            toast.error('Delete failed: ' + e);
        }
    };

    const restoreBackup = async (backup: BackupInfo) => {
        if (!confirm(`Restore this backup to ${backup.serverPath}? This will overwrite existing files.`)) return;

        toast.info('Restoring backup...');
        try {
            await invoke('restore_backup', { backupId: backup.id, targetPath: backup.serverPath });
            toast.success("Backup restored successfully!");
        } catch (e) {
            toast.error('Restore failed: ' + e);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return date.toLocaleDateString();
    };

    const formatSize = (bytes: number) => {
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'auto': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'manual': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'pre-update': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            default: return 'bg-surface text-text-muted border-border';
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Database className="w-7 h-7 text-primary" />
                        Backup Center
                    </h1>
                    <p className="text-text-muted text-sm mt-1">Manage backups across all your servers</p>
                </div>
                <button
                    onClick={handleCreateClick}
                    disabled={isCreating || servers.length === 0}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                >
                    {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Backup
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Archive className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{backups.length}</p>
                            <p className="text-xs text-text-muted">Total Backups</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <HardDrive className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{formatSize(totalSize)}</p>
                            <p className="text-xs text-text-muted">Storage Used</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{backups.filter(b => b.backupType === 'auto').length}</p>
                            <p className="text-xs text-text-muted">Auto Backups</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{backups[0] ? formatDate(backups[0].createdAt) : 'N/A'}</p>
                            <p className="text-xs text-text-muted">Last Backup</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-4">
                <span className="text-sm text-text-muted">Filter by server:</span>
                <select
                    value={selectedServer}
                    onChange={(e) => setSelectedServer(e.target.value)}
                    className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                >
                    <option value="all">All Servers</option>
                    {[...new Set(backups.map(b => b.serverName))].map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                <button onClick={loadBackups} className="p-2 hover:bg-surface rounded-lg transition-colors">
                    <RefreshCw className={cn("w-4 h-4 text-text-muted", isLoading && "animate-spin")} />
                </button>
            </div>

            {/* Backup List */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="glass-card p-12 text-center">
                        <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
                        <p className="text-text-muted">Loading backups...</p>
                    </div>
                ) : filteredBackups.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Database className="w-16 h-16 text-text-muted/30 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">No Backups Found</h3>
                        <p className="text-sm text-text-muted">Create your first backup to protect your worlds!</p>
                    </div>
                ) : (
                    filteredBackups.map((backup) => (
                        <div key={backup.id} className="glass-card p-4 flex items-center gap-4 group hover:border-primary/30 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center">
                                <Archive className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-white truncate">{backup.serverName}</h4>
                                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", getTypeColor(backup.backupType))}>
                                        {backup.backupType}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-text-muted">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDate(backup.createdAt)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <HardDrive className="w-3 h-3" />
                                        {formatSize(backup.sizeBytes)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => restoreBackup(backup)}
                                    className="p-2 rounded-lg hover:bg-surface text-text-muted hover:text-white transition-colors"
                                    title="Restore"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button className="p-2 rounded-lg hover:bg-surface text-text-muted hover:text-white transition-colors" title="Open Folder">
                                    <FolderOpen className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => deleteBackup(backup.id)}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {/* Create Backup Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#161b22] border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <h2 className="text-xl font-bold text-white mb-4">Create New Backup</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-text-muted mb-1 block">Select Server</label>
                                <select
                                    value={targetServerId}
                                    onChange={(e) => setTargetServerId(e.target.value)}
                                    className="w-full bg-black/20 border border-border rounded-lg px-3 py-2.5 text-white focus:border-primary outline-none"
                                >
                                    {servers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                                This will create a full zip archive of the selected server's directory.
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-border text-white hover:bg-surface-hover transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createBackup}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-black font-bold hover:bg-primary/90 transition-colors"
                                >
                                    Start Backup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
