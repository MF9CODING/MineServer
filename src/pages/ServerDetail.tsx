import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import {
    Terminal, Play, Square, RefreshCw, Cpu,
    ChevronLeft, Check, Trash2, Sliders,
    MonitorPlay, Users, Clock, Files, Zap, MemoryStick, AlertTriangle, Box, Globe, Wifi, Settings as SettingsIcon, Puzzle, Gamepad2,
    Shield, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Components
import { PropertiesEditor } from '../components/server/PropertiesEditor';
import { FileManager } from '../components/server/FileManager';
import { PlayerManager } from '../components/server/PlayerManager';
import { TabButton } from '../components/server/TabButton';
import { usePlayerTracking } from '../hooks/usePlayerTracking';
import { ErrorBoundary } from '../components/ErrorBoundary';
import SoftwareManager from '../components/server/SoftwareManager';
import WorldManager from '../components/server/WorldManager';
import { NetworkManager } from '../components/server/NetworkManager';
import { StartupManager } from '../components/server/StartupManager';
import { SettingsManager } from '../components/server/SettingsManager';
import { PluginManager } from '../components/server/PluginManager';
import { ModManager } from '../components/server/ModManager';
import { ConfigManager } from '../components/server/ConfigManager';
import { SecurityManager } from '../components/server/SecurityManager';
import { ServerConsole } from '../components/server/ServerConsole';
import { Package } from 'lucide-react';

export function ServerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { servers, setServerStatus, fetchSystemInfo, deleteServer, updateServer, streamerMode } = useAppStore();
    const server = servers.find(s => s.id === id);
    const [activeTab, setActiveTab] = useState<'console' | 'options' | 'files' | 'players' | 'software' | 'world' | 'network' | 'startup' | 'settings' | 'plugins' | 'mods' | 'gamerules' | 'security'>('console');
    const [logs, setLogs] = useState<string[]>([]);
    const [commandInput, setCommandInput] = useState("");
    const [copiedIp, setCopiedIp] = useState(false);
    const [uptime, setUptime] = useState<string>("00:00:00");
    const [lanIp, setLanIp] = useState<string>("");
    const [isRestarting, setIsRestarting] = useState(false);
    const [revealIp, setRevealIp] = useState(false);

    // Custom Hook for Player Tracking
    const players = usePlayerTracking(server);

    // Fetch system info periodically for resource monitoring
    useEffect(() => {
        fetchSystemInfo();
        const interval = setInterval(fetchSystemInfo, 5000);
        return () => clearInterval(interval);
    }, [fetchSystemInfo]);

    useEffect(() => {
        invoke<string>('get_local_ip').then(setLanIp).catch(console.error);
    }, []);

    // Start Time Tracking
    useEffect(() => {
        let interval: any;
        if (server?.status === 'running') {
            const startTime = Date.now();
            interval = setInterval(() => {
                const diff = Math.floor((Date.now() - startTime) / 1000);
                const h = Math.floor(diff / 3600).toString().padStart(2, '0');
                const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
                const s = (diff % 60).toString().padStart(2, '0');
                setUptime(`${h}:${m}:${s}`);
            }, 1000);
        } else {
            setUptime("00:00:00");
        }
        return () => clearInterval(interval);
    }, [server?.status]);

    // Initial logs
    // Initial logs - Read from Persistence
    useEffect(() => {
        const loadLogs = async () => {
            if (server && logs.length === 0) {
                try {
                    // Try reading our custom persistent log
                    const content = await invoke<string>('read_server_file', { path: `${server.path}\\server_console.log` });
                    if (content) {
                        const lines = content.split('\n').slice(-1000); // Last 1000 lines
                        setLogs(lines);
                    }
                } catch (e) {
                    // File might not exist yet, regular init
                    setLogs([
                        `[Mineserver] Ready to manage: ${server.name}`,
                        `[Mineserver] Type: ${server.type.toUpperCase()} v${server.version}`,
                        `[Mineserver] Waiting for start command...`
                    ]);
                }
            }
        };
        loadLogs();
    }, [server]);

    // Handle missing server
    if (!server) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-4">
                <div className="p-4 rounded-full bg-red-500/10 text-red-500">
                    <MonitorPlay className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-bold text-white">Server Not Found</h2>
                <button
                    onClick={() => navigate('/servers')}
                    className="px-6 py-2 rounded-lg bg-surface hover:bg-surface-hover text-white transition-colors"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const isRunning = server.status === 'running';
    const isStarting = server.status === 'starting';

    const [resources, setResources] = useState({ cpu: 0, ram: 0 });

    // Poll server-specific resources
    useEffect(() => {
        let statsInterval: any;
        if (isRunning && server) {
            const fetchStats = async () => {
                try {
                    const stats = await invoke<{ cpu: number, ram: number }>('get_server_resource_usage', { id: server.id });
                    setResources(stats);
                } catch (e) {
                    console.warn("Stats fetch failed:", e);
                }
            };
            fetchStats();
            statsInterval = setInterval(fetchStats, 1500);
        } else {
            setResources({ cpu: 0, ram: 0 });
        }
        return () => clearInterval(statsInterval);
    }, [isRunning, server?.id]);

    const handleCopyIp = () => {
        if (streamerMode || (server.hideIp && !revealIp)) {
            // If strictly hidden, maybe don't copy? But user might want to copy to friends.
            // Let's allow copy but show visual feedback
        }

        // Prioritize: Custom Manual IP -> Local IP -> Localhost
        const ipToCopy = server.displayIp || (lanIp ? `${lanIp}:${server.port}` : `localhost:${server.port}`);
        navigator.clipboard.writeText(ipToCopy);
        setCopiedIp(true);
        toast.success(`Copied: ${ipToCopy}`);
        setTimeout(() => setCopiedIp(false), 2000);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Live logs from Backend
    useEffect(() => {
        let unlisten: () => void;
        async function setupListener() {
            if (server) {
                unlisten = await listen(`server-log:${server.id}`, (event: any) => {
                    setLogs(prev => [...prev.slice(-500), event.payload]);
                });
            }
        }
        setupListener();
        return () => {
            if (unlisten) unlisten();
        };
    }, [server]);

    const sendCommand = async (e?: React.FormEvent, cmdStr?: string) => {
        e?.preventDefault();
        const cmd = cmdStr || commandInput;
        if (!cmd.trim()) return;

        if (!cmdStr) setCommandInput("");
        setLogs(prev => [...prev, `> ${cmd}`]);

        try {
            if (isRunning) {
                await invoke('send_server_command', { id: server.id, command: cmd });
            } else {
                setLogs(prev => [...prev, `[Error] Server is not running.`]);
            }
        } catch (err) {
            toast.error("Failed to send command: " + err);
            setLogs(prev => [...prev, `[Error] ${err}`]);
        }
    };

    const handleStart = async () => {
        if (isRunning || isStarting) return;
        toast.info(`Starting ${server.name}...`);
        setServerStatus(server.id, 'starting');
        setLogs(prev => [...prev, `[Mineserver] Starting server...`]);

        try {
            const jarName = server.type === 'bedrock' ? 'bedrock_server.exe' : 'server.jar';
            await invoke('start_server', {
                id: server.id,
                path: server.path,
                jarFile: jarName,
                ram: server.allocatedRam || 4096
            });

            setServerStatus(server.id, 'running');
            setLogs(prev => [...prev, `[Mineserver] Server started successfully!`]);
            toast.success(`${server.name} is now running!`);

            if (server.publicAccess === 'playit') {
                setLogs(prev => [...prev, `[Mineserver] Auto-starting Playit tunnel...`]);
                try {
                    await invoke('install_playit', { serverPath: server.path });
                    await invoke('start_playit_tunnel', { id: server.id, serverPath: server.path });
                    toast.success("Playit tunnel auto-started!");
                } catch (e) {
                    console.error("Failed to auto-start tunnel:", e);
                }
            }
        } catch (err) {
            setServerStatus(server.id, 'stopped');
            toast.error("Failed to start: " + err);
            setLogs(prev => [...prev, `[Error] Start failed: ${err}`]);
        }
    };

    const handleStop = async () => {
        if (!isRunning) return;

        toast.info(`Stopping ${server.name}...`);
        setLogs(prev => [...prev, `[Mineserver] Stopping server...`]);

        if (server.publicAccess === 'playit') {
            try {
                await invoke('stop_playit_tunnel', { id: server.id });
            } catch (e) {
                console.error("Failed to stop tunnel:", e);
            }
        }

        try {
            await invoke('stop_server', { id: server.id });
            setServerStatus(server.id, 'stopped');
            setLogs(prev => [...prev, `[Mineserver] Server stopped.`]);
            toast.success(`${server.name} stopped.`);
        } catch (err: any) {
            setServerStatus(server.id, 'stopped');
            if (err.toString().toLowerCase().includes("not running")) {
                toast.warning("Server was already stopped.");
            } else {
                toast.error("Stop failed: " + err);
            }
        }
    };

    const handleRestart = async () => {
        if (!isRunning || isRestarting) return;
        setIsRestarting(true);
        toast.info(`Restarting ${server.name}...`);

        try {
            await invoke('stop_server', { id: server.id });
            await new Promise(resolve => setTimeout(resolve, 2000));

            const jarName = server.type === 'bedrock' ? 'bedrock_server.exe' : 'server.jar';
            await invoke('start_server', {
                id: server.id,
                path: server.path,
                jarFile: jarName,
                ram: server.allocatedRam || 4096
            });

            setServerStatus(server.id, 'running');
            toast.success(`${server.name} restarted!`);
        } catch (err) {
            setServerStatus(server.id, 'stopped');
            toast.error("Restart failed: " + err);
        } finally {
            setIsRestarting(false);
        }
    };

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [confirmName, setConfirmName] = useState("");

    const handleDeleteServer = async () => {
        if (!server) return;
        if (confirmName !== server.name) {
            toast.error("Please type the server name correctly to confirm.");
            return;
        }

        try {
            await deleteServer(server.id);
            toast.success(`Server deleted successfully.`);
            navigate('/servers');
        } catch (err) {
            toast.error(`Failed to delete server: ${err}`);
        }
    };

    // Calculate Scaled CPU Usage
    // If allocatedCores is 4, max % is 400%.
    // Bar should be user% / (cores * 100)
    const maxCpuPercent = (server.allocatedCores || 2) * 100;
    const scaledCpuBar = Math.min((resources.cpu / maxCpuPercent) * 100, 100);

    return (
        <div className="flex flex-col min-h-full max-w-[1800px] mx-auto p-4 lg:p-6 gap-4 pb-8 relative">
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#161b22] border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-500 left-0" />
                        <div className="flex items-center gap-3 mb-4 text-red-500">
                            <div className="p-3 bg-red-500/10 rounded-xl"><AlertTriangle className="w-8 h-8" /></div>
                            <h2 className="text-xl font-bold">Delete Server?</h2>
                        </div>
                        <div className="space-y-4">
                            <p className="text-red-400 text-sm">Type <strong>{server.name}</strong> to confirm deletion:</p>
                            <input
                                value={confirmName}
                                onChange={(e) => setConfirmName(e.target.value)}
                                placeholder={server.name}
                                className="w-full bg-[#0d1117] border border-border rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-border text-white transition-colors">Cancel</button>
                                <button onClick={handleDeleteServer} disabled={confirmName !== server.name} className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-bold transition-colors disabled:opacity-50">Delete Forever</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface/30 rounded-2xl p-4 border border-border/50">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/servers')} className="w-10 h-10 rounded-xl bg-surface hover:bg-surface-hover flex items-center justify-center text-text-muted hover:text-white transition-colors border border-border">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl lg:text-2xl font-bold text-white">{server.name}</h1>

                            <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", isRunning ? "bg-green-500/10 text-green-500 border-green-500/20" : isStarting ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", isRunning ? "bg-green-500 animate-pulse" : isStarting ? "bg-yellow-500" : "bg-red-500")} />
                                {server.status}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs font-mono text-text-secondary">
                            <div className="flex items-center gap-2 bg-black/20 rounded-md px-2 py-0.5 border border-white/5 group relative">
                                {server.hideIp ? (
                                    <>
                                        <div className="flex items-center gap-1.5 px-1 cursor-pointer hover:text-white transition-colors" title="Click to reveal temporarily" onClick={() => setRevealIp(!revealIp)}>
                                            <Globe className="w-3.5 h-3.5 text-text-muted" />
                                            <span className="font-mono">{revealIp ? (server.displayIp || (lanIp ? `${lanIp}:${server.port}` : `localhost:${server.port}`)) : "***.***.***.***"}</span>
                                        </div>
                                        <button onClick={() => updateServer(server.id, { hideIp: false })} className="p-1 hover:text-white text-text-muted transition-colors" title="Show IP permanently">
                                            <EyeOff className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={handleCopyIp} className="flex items-center gap-1.5 px-1 hover:text-primary transition-colors" title="Click to Copy">
                                            <Globe className="w-3.5 h-3.5 text-text-muted" />
                                            <span className="font-mono">{server.displayIp || (lanIp ? `${lanIp}:${server.port}` : `localhost:${server.port}`)}</span>
                                            {copiedIp && <Check className="w-3.5 h-3.5 text-green-500" />}
                                        </button>
                                        <button onClick={() => updateServer(server.id, { hideIp: true })} className="p-1 hover:text-white text-text-muted transition-colors" title="Hide IP">
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                )}
                            </div>
                            <span className="text-border">•</span>
                            <span className="capitalize">{server.type} {server.version}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isRunning ? (
                        <>
                            <button onClick={handleRestart} disabled={isRestarting} className="h-10 px-4 rounded-xl bg-yellow-500/10 hover:bg-yellow-500 text-yellow-500 hover:text-black border border-yellow-500/20 font-medium flex items-center gap-2 transition-all">
                                <RefreshCw className={cn("w-4 h-4", isRestarting && "animate-spin")} /> Restart
                            </button>
                            <button onClick={handleStop} className="h-10 px-4 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 font-bold flex items-center gap-2 transition-all">
                                <Square className="w-4 h-4 fill-current" /> Stop
                            </button>
                        </>
                    ) : (
                        <button onClick={handleStart} disabled={isStarting} className="h-10 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40">
                            <Play className="w-4 h-4 fill-current" /> {isStarting ? "Starting..." : "Start Server"}
                        </button>
                    )}
                </div>
            </div>

            {/* Enhanced Stats Row */}
            <div className={cn(
                "grid gap-4",
                server.type === 'bedrock' ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-5"
            )}>
                <StatsCard
                    label="Players Online"
                    value={<span>{players?.length || 0}<span className="text-sm text-text-muted font-medium ml-1">/ {server.maxPlayers}</span></span>}
                    sub="Active Now"
                    icon={Users}
                    color="blue"
                    percent={Math.min(((players?.length || 0) / server.maxPlayers) * 100, 100)}
                    isActive={isRunning}
                />
                <StatsCard
                    label="Uptime"
                    value={uptime}
                    sub={isRunning ? "Running smoothly" : "Offline"}
                    icon={Clock}
                    color="green"
                    percent={isRunning ? 100 : 0}
                    isActive={isRunning}
                    isMonospace
                />

                {/* TPS (Java Only) */}
                {server.type !== 'bedrock' && (
                    <StatsCard
                        label="TPS"
                        value={isRunning ? "~20.0" : "--"}
                        sub={isRunning ? "Server Performance" : "Offline"}
                        icon={Zap}
                        color="emerald"
                        percent={isRunning ? 100 : 0}
                        isActive={isRunning}
                    />
                )}

                <StatsCard
                    label="RAM Usage"
                    value={<span>{isRunning ? formatBytes(resources.ram) : "0 B"}<span className="text-sm text-text-muted font-medium ml-1">/ {formatBytes(server.allocatedRam * 1024 * 1024)}</span></span>}
                    sub={isRunning ? "Memory Used" : "Offline"}
                    icon={MemoryStick}
                    color="purple"
                    percent={isRunning ? Math.min((Math.round(resources.ram / 1024 / 1024) / server.allocatedRam) * 100, 100) : 0}
                    isActive={isRunning}
                />

                <StatsCard
                    label="CPU Load"
                    value={<span>{isRunning ? resources.cpu.toFixed(0) : 0}%<span className="text-sm text-text-muted font-medium ml-1">/ {(server.allocatedCores || 2) * 100}%</span></span>}
                    sub={`${server.allocatedCores || 2} Cores Allocated`}
                    icon={Cpu}
                    color="orange"
                    percent={isRunning ? scaledCpuBar : 0}
                    isActive={isRunning}
                />
            </div>

            {/* Main Content Tabs */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
                <div className="lg:col-span-1 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 h-fit lg:sticky lg:top-4">
                    <TabButton active={activeTab === 'console'} onClick={() => setActiveTab('console')} icon={Terminal} label="Console" desc="Live logs" />
                    <TabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} icon={Users} label="Players" desc="Manage" />
                    <TabButton active={activeTab === 'files'} onClick={() => setActiveTab('files')} icon={Files} label="Files" desc="Manage files" />

                    {(server.type === 'paper' || server.type === 'spigot' || server.type === 'purpur' || server.type === 'nukkit') && (
                        <TabButton active={activeTab === 'plugins'} onClick={() => setActiveTab('plugins')} icon={Puzzle} label="Plugins" desc="Browse & Install" />
                    )}
                    {(server.type === 'forge' || server.type === 'fabric') && (
                        <TabButton active={activeTab === 'mods'} onClick={() => setActiveTab('mods')} icon={Package} label="Mods" desc="Browse & Install" />
                    )}

                    <TabButton active={activeTab === 'world'} onClick={() => setActiveTab('world')} icon={Globe} label="Worlds" desc="Manage World" />
                    <TabButton active={activeTab === 'options'} onClick={() => setActiveTab('options')} icon={Sliders} label="Config" desc="server.properties" />
                    <TabButton active={activeTab === 'gamerules'} onClick={() => setActiveTab('gamerules')} icon={Gamepad2} label="Game Rules" desc="World settings" />
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <TabButton active={activeTab === 'network'} onClick={() => setActiveTab('network')} icon={Wifi} label="Network" desc="Public & LAN" />
                    <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={Shield} label="Security" desc="Firewall & Anti-Bot" />
                    <TabButton active={activeTab === 'startup'} onClick={() => setActiveTab('startup')} icon={Zap} label="Startup" desc="Flags & Java" />
                    <TabButton active={activeTab === 'software'} onClick={() => setActiveTab('software')} icon={Box} label="Software" desc="Updates & Versions" />
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={SettingsIcon} label="Settings" desc="General & Delete" />
                </div>

                <div className="lg:col-span-4 bg-surface/30 border border-border/50 rounded-2xl flex flex-col overflow-hidden flex-1">
                    {activeTab === 'console' && (
                        <ServerConsole
                            logs={logs}
                            setLogs={setLogs}
                            isRunning={isRunning}
                            onSendCommand={(cmd) => sendCommand(undefined, cmd)}
                            hideIp={server.hideIp}
                            onToggleIp={() => {
                                updateServer(server.id, { hideIp: !server.hideIp });
                                toast.success(server.hideIp ? "IP is now Visible" : "IP is now Hidden");
                            }}
                            ipAddress={server.displayIp || (lanIp ? `${lanIp}:${server.port}` : `localhost:${server.port}`)}
                            serverPath={server.path}
                        />
                    )}
                    {activeTab === 'options' && server?.path && (
                        <div className="flex flex-col h-full bg-[#0d1117]">
                            <div className="flex-1 overflow-y-auto">
                                <ErrorBoundary><PropertiesEditor serverPath={server.path} serverType={server.type} serverName={server.name} /></ErrorBoundary>
                                <div className="p-6 border-t border-border/50 mt-4">
                                    <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-6">
                                        <h3 className="text-red-500 font-bold mb-2 flex items-center gap-2 text-lg"><AlertTriangle className="w-6 h-6" /> Danger Zone</h3>
                                        <p className="text-sm text-text-muted mb-6 max-w-2xl">Permanently delete this server and all its contents.</p>
                                        <button onClick={() => setShowDeleteModal(true)} className="px-6 py-3 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/50 text-red-500 rounded-xl font-bold text-sm transition-all flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Server</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'files' && <FileManager serverPath={server.path} />}
                    {activeTab === 'players' && <PlayerManager sendCommand={sendCommand} isRunning={isRunning} activePlayers={players || []} serverType={server.type} serverName={server.name} serverPath={server.path} />}
                    {activeTab === 'software' && <SoftwareManager server={server} />}
                    {activeTab === 'world' && <WorldManager server={server} />}
                    {activeTab === 'network' && <NetworkManager server={server} />}
                    {activeTab === 'security' && <SecurityManager server={server} />}
                    {activeTab === 'startup' && <StartupManager server={server} />}
                    {activeTab === 'settings' && <SettingsManager server={server} />}
                    {activeTab === 'plugins' && <ErrorBoundary><PluginManager server={server} /></ErrorBoundary>}
                    {activeTab === 'mods' && <ErrorBoundary><ModManager server={server} /></ErrorBoundary>}
                    {activeTab === 'gamerules' && <ErrorBoundary><ConfigManager server={server} isRunning={isRunning} sendCommand={sendCommand} /></ErrorBoundary>}
                </div>
            </div>
        </div>
    );
}

function StatsCard({ label, value, sub, icon: Icon, color, percent, isMonospace }: any) {
    const colors: any = {
        blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400 bg-blue-500',
        green: 'from-green-500/20 to-green-500/5 border-green-500/20 text-green-400 bg-green-500',
        emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400 bg-emerald-500',
        purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400 bg-purple-500',
        orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/20 text-orange-400 bg-orange-500',
    };

    return (
        <div className={cn(
            "glass-card p-4 relative overflow-hidden group hover:border-opacity-50 transition-all border",
            colors[color].replace('bg-', 'border-').split(' ')[2]
        )}>
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", colors[color].split(' ')[0], colors[color].split(' ')[1])} />
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                        <Icon className={cn("w-4 h-4", colors[color].split(' ')[3])} />
                        {label}
                    </div>
                </div>

                <div>
                    <div className={cn("text-2xl font-bold text-white leading-none mb-1", isMonospace && "font-mono")}>
                        {value}
                    </div>
                    <div className="text-xs text-text-secondary font-medium truncate">{sub}</div>
                </div>

                <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-1000", colors[color].split(' ')[4])}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
