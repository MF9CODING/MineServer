import { useState, useEffect } from 'react';
import { Server, useAppStore, ServerType, UpdatePolicy } from '../../stores/appStore';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import {
    RefreshCw, Download, Settings, AlertTriangle,
    Check, Server as ServerIcon, Globe, Box,
    Layers, Archive, Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SoftwareManagerProps {
    server: Server;
}

const SOFTWARE_TYPES: { id: ServerType; name: string; description: string; icon: any; color: string; optimized?: boolean }[] = [
    {
        id: 'vanilla',
        name: 'Vanilla',
        description: 'The official Minecraft server software by Mojang. Standard experience.',
        icon: Box,
        color: 'text-green-500'
    },
    {
        id: 'paper',
        name: 'Paper',
        description: 'High-performance fork of Spigot. Recommended for most servers.',
        icon: Zap,
        color: 'text-blue-500',
        optimized: true
    },
    {
        id: 'purpur',
        name: 'Purpur',
        description: 'Fork of Paper focused on customization and fun features.',
        icon: Layers,
        color: 'text-purple-500',
        optimized: true
    },
    {
        id: 'spigot',
        name: 'Spigot',
        description: 'The original plugin-compatible server software.',
        icon: ServerIcon,
        color: 'text-orange-500'
    },
    {
        id: 'forge',
        name: 'Forge',
        description: 'Mod loader for heavy modpacks and content mods.',
        icon: Globe,
        color: 'text-yellow-600'
    },
    {
        id: 'fabric',
        name: 'Fabric',
        description: 'Lightweight mod loader for modern version mods.',
        icon: Globe,
        color: 'text-cyan-500'
    },
    {
        id: 'bedrock',
        name: 'Bedrock (BDS)',
        description: 'Official Bedrock Dedicated Server for MCPE/Consoles.',
        icon: Globe,
        color: 'text-emerald-500'
    },
    {
        id: 'nukkit',
        name: 'NukkitX',
        description: 'Java-based server software for Bedrock Edition.',
        icon: Zap,
        color: 'text-blue-400',
        optimized: true
    },
];

export default function SoftwareManager({ server }: SoftwareManagerProps) {
    const { updateServer } = useAppStore();

    // Policy
    const [policy, setPolicy] = useState<UpdatePolicy>(server.updatePolicy || 'manual');

    // Software Selection
    const [targetType, setTargetType] = useState<ServerType>(server.type);
    const [targetVersion, setTargetVersion] = useState<string>(server.version);
    const [availableVersions, setAvailableVersions] = useState<string[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Install State
    const [installing, setInstalling] = useState(false);
    const [backupBeforeUpdate, setBackupBeforeUpdate] = useState(true);

    // Persist policy change
    const handlePolicyChange = (newPolicy: UpdatePolicy) => {
        setPolicy(newPolicy);
        updateServer(server.id, { updatePolicy: newPolicy });
        toast.success(`Update policy set to: ${newPolicy}`);
    };

    // Fetch versions when type changes
    useEffect(() => {
        let isMounted = true;

        async function fetchVersions() {
            setLoadingVersions(true);
            try {
                let versions: string[] = [];
                // Dynamic invoke based on type
                const commandMap: Record<string, string> = {
                    'vanilla': 'get_vanilla_versions',
                    'paper': 'get_paper_versions',
                    'spigot': 'get_spigot_versions',
                    'purpur': 'get_purpur_versions',
                    'forge': 'get_forge_versions',
                    'fabric': 'get_fabric_versions',
                    'bedrock': 'get_bedrock_versions',
                    'nukkit': 'get_nukkit_versions',
                };

                const cmd = commandMap[targetType];
                if (cmd) {
                    // Some might fail if backend not perfect, handle gracefully
                    try {
                        versions = await invoke<string[]>(cmd);
                    } catch (err) {
                        console.warn(`Command ${cmd} failed`, err);
                        versions = [];
                    }
                }

                if (isMounted) {
                    setAvailableVersions(versions || []);
                    // Auto-select logic
                    if (versions && versions.length > 0) {
                        if (targetType === server.type && versions.includes(server.version)) {
                            setTargetVersion(server.version);
                        } else {
                            setTargetVersion(versions[0]);
                        }
                    } else {
                        setTargetVersion("");
                    }
                }
            } catch (e) {
                console.error("Failed to fetch versions", e);
                toast.error("Failed to load versions");
            } finally {
                if (isMounted) setLoadingVersions(false);
            }
        }

        fetchVersions();
        return () => { isMounted = false; };
    }, [targetType, server.type, server.version]);

    // Install/Update Handler
    const handleInstall = async () => {
        const isCrossPlatform = (server.type === 'bedrock' && targetType !== 'bedrock') ||
            (server.type !== 'bedrock' && (targetType === 'bedrock'));

        if (isCrossPlatform) {
            if (!confirm("WARNING: Switching between Java and Bedrock platforms allows you to run a different server, but existing worlds/plugins will likely be INCOMPATIBLE. Proceed?")) {
                return;
            }
        }

        setInstalling(true);
        const toastId = toast.loading("Processing installation...", { description: "Please wait while we download and configure your server." });

        try {
            await invoke('download_server', {
                serverPath: server.path,
                serverType: targetType,
                version: targetVersion,
                preserveConfig: server.type === targetType // Preserve config if same type
            });

            updateServer(server.id, {
                type: targetType,
                version: targetVersion,
                startupFlags: targetType === 'paper' || targetType === 'purpur' ? server.startupFlags : "" // Keep flags for paper/purpur, reset for others maybe?
            });

            toast.success(`${targetType} ${targetVersion} installed successfully!`, { id: toastId });
        } catch (e) {
            toast.error("Installation failed: " + e, { id: toastId });
        } finally {
            setInstalling(false);
        }
    };

    const targetSoftware = SOFTWARE_TYPES.find(s => s.id === targetType);
    const filteredVersions = availableVersions.filter(v => v.includes(searchTerm));

    return (
        <div className="flex flex-col gap-6 h-full bg-[#0d1117] p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Download className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Software & Updates</h2>
                    <p className="text-xs text-text-muted">Manage server version and distribution</p>
                </div>
            </div>

            {/* Current Version Card */}
            <div className="bg-[#161b22] border border-border rounded-xl p-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Ideally Running</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 font-bold">Stable</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-2xl font-bold text-white capitalize">{server.type}</h3>
                            <span className="text-xl text-text-muted">{server.version}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Software Selection Grid */}
            <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Select Software
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {SOFTWARE_TYPES.map((software) => (
                        <button
                            key={software.id}
                            onClick={() => setTargetType(software.id)}
                            className={cn(
                                "flex flex-col items-start text-left p-4 rounded-xl border transition-all h-full relative group",
                                targetType === software.id
                                    ? "bg-primary/5 border-primary shadow-lg shadow-primary/5"
                                    : "bg-[#161b22] border-border hover:bg-white/5 hover:border-white/10"
                            )}
                        >
                            <div className="flex items-center justify-between w-full mb-3">
                                <software.icon className={cn("w-6 h-6", software.color)} />
                                {targetType === software.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                            </div>
                            <h4 className="font-bold text-white text-sm mb-1">{software.name}</h4>
                            <p className="text-[10px] text-text-muted leading-relaxed line-clamp-2">{software.description}</p>

                            {software.optimized && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded uppercase font-bold border border-green-500/20">Fast</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Update Policy & Settings */}
            <div className="bg-[#161b22] border border-border rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-gray-400" /> Update Policy
                        </h3>
                        <p className="text-xs text-text-muted">
                            Choose how the server handles software updates.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {(['manual', 'ask', 'always'] as UpdatePolicy[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => handlePolicyChange(p)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors border",
                                    policy === p
                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                        : "bg-black/20 text-text-muted border-white/5 hover:bg-white/5"
                                )}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Version Selection & Install */}
            <div className="bg-[#161b22] border border-border rounded-xl p-6">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Archive className="w-4 h-4 text-orange-400" /> Select Version
                        </h3>

                        <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden flex flex-col h-64">
                            <div className="p-2 border-b border-white/10">
                                <input
                                    type="text"
                                    placeholder="Search version..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-transparent text-sm text-white px-2 py-1 outline-none placeholder:text-text-muted/50"
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                {loadingVersions ? (
                                    <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        <span className="text-xs">Fetching versions...</span>
                                    </div>
                                ) : filteredVersions.length === 0 ? (
                                    <div className="text-center p-4 text-text-muted text-xs">No versions found</div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2">
                                        {filteredVersions.map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => setTargetVersion(v)}
                                                className={cn(
                                                    "px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all truncate text-center",
                                                    targetVersion === v
                                                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                                                        : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-white"
                                                )}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-80 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-white mb-4">Installation Options</h3>

                            <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 cursor-pointer hover:bg-black/30 transition-colors mb-3">
                                <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors",
                                    backupBeforeUpdate ? "bg-primary border-primary text-white" : "border-white/20 text-transparent")}>
                                    <Check className="w-3 h-3" />
                                </div>
                                <input type="checkbox" className="hidden" checked={backupBeforeUpdate} onChange={e => setBackupBeforeUpdate(e.target.checked)} />
                                <div>
                                    <div className="text-xs font-bold text-white">Create Backup</div>
                                    <div className="text-[10px] text-text-muted">Recommended before updating</div>
                                </div>
                            </label>

                            <div className="text-xs text-text-muted bg-yellow-500/5 border border-yellow-500/10 p-3 rounded-lg mb-4">
                                <div className="flex items-center gap-1.5 text-yellow-500 font-bold mb-1">
                                    <AlertTriangle className="w-3 h-3" /> Notice
                                </div>
                                Installing <strong>{targetSoftware?.name} {targetVersion}</strong> will overwrite your existing server jar. Configs will be preserved.
                            </div>
                        </div>

                        <button
                            onClick={handleInstall}
                            disabled={installing || !targetVersion}
                            className={cn(
                                "w-full py-3 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all",
                                installing
                                    ? "bg-white/10 text-white/50 cursor-not-allowed"
                                    : "bg-white text-black hover:bg-white/90 hover:scale-[1.02]"
                            )}
                        >
                            {installing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {server.type === targetType && server.version === targetVersion ? 'Reinstall Software' : 'Install Software'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
