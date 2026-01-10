import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore, Server } from '../../stores/appStore';
import { Globe, Wifi, Shield, Copy, Check, AlertTriangle, RefreshCw, Activity, Zap, Pencil, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface NetworkManagerProps {
    server: Server;
}

export function NetworkManager({ server }: NetworkManagerProps) {
    const { updateServer } = useAppStore();
    const [lanIp, setLanIp] = useState("Loading...");
    const [publicIp, setPublicIp] = useState<string | null>(null);
    const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'checking'>('checking');

    // Playit State
    const [playitStatus, setPlayitStatus] = useState<string>("");
    const [playitClaimUrl, setPlayitClaimUrl] = useState<string | null>(null);
    const [playitTunnelAddress, setPlayitTunnelAddress] = useState<string | null>(null);
    const [showFirewallModal, setShowFirewallModal] = useState(false);

    // Add this ref for the input
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Initial Checks
        invoke<string>('get_local_ip').then(setLanIp).catch(() => setLanIp("Unknown"));
        checkConnection();
    }, []);

    const checkConnection = async () => {
        setNetworkStatus('checking');
        try {
            const online = await invoke<boolean>('check_internet_connection');
            setNetworkStatus(online ? 'online' : 'offline');
            if (online && !publicIp) {
                // Background fetch public IP for info
                invoke<string>('get_public_ip').then(setPublicIp).catch(() => { });
            }
        } catch (e) {
            setNetworkStatus('offline');
        }
    };

    // Listen for Playit events
    useEffect(() => {
        let unlistenLog: () => void;
        let unlistenClaim: () => void;

        async function setup() {
            unlistenLog = await listen(`tunnel-log:${server.id}`, (e: any) => {
                const line = e.payload as string;

                // Parse tunnel address
                const tunnelMatch = line.match(/([\w-]+\.(?:gl\.at\.)?ply\.gg:\d+)\s*=>/i);
                if (tunnelMatch) {
                    setPlayitTunnelAddress(tunnelMatch[1]);
                    setPlayitStatus("Connected");
                }

                // Parse status
                if (line.includes("tunnel running")) setPlayitStatus("Running");
                if (line.includes("Program approved")) setPlayitStatus("Approved");
            });
            unlistenClaim = await listen(`tunnel-claim:${server.id}`, (e: any) => {
                const msg = e.payload as string;
                const match = msg.match(/https?:\/\/[^\s"']+/);
                if (match && match[0].includes("playit.gg/claim/")) {
                    setPlayitClaimUrl(match[0]);
                    toast.message("Action Required", {
                        description: "Click the claim link to setup your tunnel.",
                        action: { label: "Claim", onClick: () => window.open(match[0], '_blank') }
                    });
                }
            });
        }
        setup();
        return () => {
            if (unlistenLog) unlistenLog();
            if (unlistenClaim) unlistenClaim();
        };
    }, [server.id]);

    const [guideMode, setGuideMode] = useState<'none' | 'playit' | 'upnp'>('none');

    const handlePlayitClick = () => {
        if (server.publicAccess === 'playit') {
            handleTogglePlayit();
        } else {
            setGuideMode('playit');
        }
    };

    const handleUpnpClick = () => {
        if (server.publicAccess === 'upnp') {
            handleToggleUPnP();
        } else {
            setGuideMode('upnp');
        }
    };

    const handleToggleUPnP = async () => {
        setGuideMode('none');
        if (server.publicAccess === 'upnp') {
            try {
                await invoke('upnp_remove_port', { port: server.port, protocol_str: server.type === 'bedrock' ? 'UDP' : 'TCP' });
                updateServer(server.id, { publicAccess: 'none' });
                setPublicIp(null); // Clear manual IP
                toast.success("Public access disabled.");
            } catch (e) {
                toast.error("Failed to unmap port: " + e);
            }
        } else {
            try {
                const ip = await invoke<string>('upnp_map_port', { port: server.port, protocol_str: server.type === 'bedrock' ? 'UDP' : 'TCP' });
                setPublicIp(ip);
                updateServer(server.id, { publicAccess: 'upnp' });
                toast.success("Port forwarded successfully!", { description: `Public IP: ${ip}` });
            } catch (e) {
                console.error(e);
                toast.error("Direct Connection Failed (UPnP)", {
                    description: "Your router didn't respond. Try 'Tunnel (Playit)' instead.",
                    duration: 5000
                });
            }
        }
    };

    const handleTogglePlayit = async () => {
        if (guideMode === 'playit') setGuideMode('none');

        if (server.publicAccess === 'playit') {
            try {
                await invoke('stop_playit_tunnel', { id: server.id });
                updateServer(server.id, { publicAccess: 'none' });
                setPlayitStatus("Stopped");
                setPlayitClaimUrl(null);
            } catch (e) {
                console.error(e);
            }
        } else {
            setPlayitStatus("Starting Agent...");
            try {
                await invoke('install_playit', { server_path: server.path });
                await invoke('start_playit_tunnel', { id: server.id, server_path: server.path });
                updateServer(server.id, { publicAccess: 'playit' });
            } catch (e) {
                toast.error("Failed to start Playit: " + e);
                setPlayitStatus("Failed");
            }
        }
    };

    const handleResetPlayit = async () => {
        if (!confirm("IMPORTANT: Before you click OK, go to play.it/agents and DELETE the old agent for this server.\n\nThen click OK here to reset the local files.\n\nThis is required to create a new, working tunnel.")) return;

        try {
            updateServer(server.id, { publicAccess: 'none', displayIp: undefined });
            setPlayitStatus("Resetting...");
            await invoke('reset_playit_tunnel', { id: server.id, server_path: server.path });
            setPlayitStatus("Reset Complete");
            setPlayitClaimUrl(null);
            setPlayitTunnelAddress(null);
            toast.success("Agent reset! Now click 'Start Tunnel' to claim a new one.");
        } catch (e) {
            toast.error("Reset failed: " + e);
        }
    };

    const handleSaveDisplayIp = (val: string) => {
        const trimmed = val.trim();
        updateServer(server.id, { displayIp: trimmed || undefined });
        if (trimmed) toast.success("Public IP updated manually");
        else toast.info("Restored auto-detection");
    };

    // Helper to parse Bedrock IP/Port
    const getBedrockDetails = (addr: string) => {
        const parts = addr.split(':');
        if (parts.length === 2) return { ip: parts[0], port: parts[1] };
        return null;
    };

    const displayedAddress = server.displayIp || playitTunnelAddress || (publicIp ? `${publicIp}:${server.port}` : null);
    const bedrockDetails = (server.type === 'bedrock') && displayedAddress ? getBedrockDetails(displayedAddress) : null;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    // Derived Visibility States
    // Default to HIDDEN (true) if undefined (first empty logic)
    // User requested to ISOLATE from streamerMode so manual toggle always works.
    const isLocalHidden = server.hideLocalIp ?? true;
    const isPublicHidden = server.hidePublicIp ?? true;

    return (
        <div className="flex flex-col gap-6 h-full bg-[#0d1117] p-6 overflow-y-auto">
            {/* Network Status Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#161b22] border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center border",
                        networkStatus === 'online' ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-text-muted font-bold uppercase tracking-wider">Internet Status</div>
                        <div className="flex items-center gap-2">
                            <span className={cn("font-bold", networkStatus === 'online' ? "text-white" : "text-red-400")}>
                                {networkStatus === 'checking' ? 'Checking...' : networkStatus === 'online' ? 'Connected' : 'Offline'}
                            </span>
                            {networkStatus === 'online' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                        </div>
                    </div>
                </div>

                <div className="bg-[#161b22] border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Wifi className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-text-muted font-bold uppercase tracking-wider">Local IP</div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateServer(server.id, { hideLocalIp: !(server.hideLocalIp ?? true) });
                                }}
                                className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-white transition-colors"
                            >
                                {(server.hideLocalIp ?? true) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => !isLocalHidden && copyToClipboard(lanIp)}>
                            <span className={cn("font-bold text-white truncate", isLocalHidden && "tracking-widest")}>
                                {isLocalHidden ? "*.*.*.*" : lanIp}
                            </span>
                            {!isLocalHidden && <Copy className="w-3 h-3 text-text-muted group-hover:text-white transition-colors" />}
                        </div>
                    </div>
                </div>

                <div className="bg-[#161b22] border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-text-muted font-bold uppercase tracking-wider">Public IP (Info)</div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateServer(server.id, { hidePublicIp: !(server.hidePublicIp ?? true) });
                                }}
                                className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-white transition-colors"
                            >
                                {(server.hidePublicIp ?? true) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => (server.displayIp || publicIp) && !isPublicHidden && copyToClipboard(server.displayIp || publicIp!)}>
                            <span className={cn("font-bold text-white truncate", isPublicHidden && "tracking-widest")}>
                                {isPublicHidden ? "Hidden" : (server.displayIp || publicIp || "Unknown")}
                            </span>
                            {!isPublicHidden && (server.displayIp || publicIp) && <Copy className="w-3 h-3 text-text-muted group-hover:text-white transition-colors" />}
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Local Connection Card */}
                <div className="bg-[#161b22] border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-colors shadow-lg">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />

                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Wifi className="w-5 h-5 text-blue-400" /> Local Connection
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => updateServer(server.id, { hideLocalIp: !(server.hideLocalIp ?? true) })}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                                title={isLocalHidden ? "Show IP" : "Hide IP"}
                            >
                                {(server.hideLocalIp ?? true) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex items-center justify-between relative z-10">
                        <div>
                            <div className="text-xs text-text-muted mb-1">Server Address</div>
                            <code className="text-blue-400 font-mono text-xl font-bold tracking-widest">
                                {isLocalHidden ? "***.***.***.***:*****" : `${lanIp}:${server.port}`}
                            </code>
                        </div>
                        <button
                            onClick={() => copyToClipboard(`${lanIp}:${server.port}`)}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white"
                            disabled={isLocalHidden}
                        >
                            <Copy className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Public Access Card */}
                <div className={cn(
                    "bg-[#161b22] border rounded-2xl p-6 relative overflow-hidden group transition-all shadow-lg",
                    server.publicAccess !== 'none' ? "border-green-500/30" : "border-border hover:border-green-500/20"
                )}>
                    {server.publicAccess === 'playit' && <div className="absolute -right-6 -top-6 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />}
                    {server.publicAccess === 'upnp' && <div className="absolute -right-6 -top-6 w-32 h-32 bg-green-500/10 rounded-full blur-2xl" />}

                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Globe className="w-5 h-5 text-green-400" /> Public Access
                        </h3>
                    </div>

                    {/* Mode Selection Buttons */}
                    <div className="flex gap-2 mb-6 bg-black/30 p-1 rounded-lg relative z-10">
                        <button
                            onClick={handleUpnpClick}
                            disabled={server.publicAccess === 'playit'}
                            className={cn(
                                "flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed",
                                server.publicAccess === 'upnp' ? "bg-green-600 text-white shadow" : "hover:bg-white/5 text-text-muted hover:text-white"
                            )}
                        >
                            {server.publicAccess === 'upnp' ? <Check className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                            Direct (UPnP)
                        </button>
                        <button
                            onClick={handlePlayitClick}
                            disabled={server.publicAccess === 'upnp'}
                            className={cn(
                                "flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed",
                                server.publicAccess === 'playit' ? "bg-purple-600 text-white shadow" : "hover:bg-white/5 text-text-muted hover:text-white"
                            )}
                        >
                            {server.publicAccess === 'playit' ? <Check className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                            Playit Tunnel
                        </button>
                    </div>

                    {/* DYNAMIC DISPLAY AREA */}
                    {server.publicAccess !== 'none' && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 relative z-10">

                            {/* Manual Edit Input */}
                            <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-bold text-text-muted uppercase tracking-wide">
                                        {bedrockDetails ? "Bedrock Connection" : "Public Address"}
                                    </div>
                                    <div className="text-[10px] text-text-muted/60 bg-white/5 px-1.5 rounded">
                                        {server.displayIp ? 'Manually Set' : 'Auto-Detected'}
                                    </div>
                                </div>

                                <div className="flex gap-2 relative group/field">
                                    <div className="flex-1 relative">
                                        <input
                                            ref={inputRef}
                                            type={isPublicHidden ? "password" : "text"}
                                            placeholder="e.g. 147.185.x.x:53131"
                                            className={cn(
                                                "w-full bg-transparent border-none text-white font-mono font-bold focus:ring-0 p-0 placeholder:text-white/20 transition-all",
                                                !server.displayIp && "opacity-80 group-hover/field:opacity-100"
                                            )}
                                            defaultValue={displayedAddress || ""}
                                            onBlur={(e) => handleSaveDisplayIp(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleSaveDisplayIp(e.currentTarget.value);
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            disabled={isPublicHidden}
                                        />
                                        {/* Underline indicator */}
                                        <div className="absolute bottom-0 left-0 w-full h-px bg-white/10 group-hover/field:bg-white/30 transition-colors" />
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => updateServer(server.id, { hidePublicIp: !(server.hidePublicIp ?? true) })}
                                            className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                                            title={isPublicHidden ? "Show Address" : "Hide Address"}
                                        >
                                            {(server.hidePublicIp ?? true) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                            onClick={() => inputRef.current?.focus()}
                                            className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                                            title="Edit Address"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        {displayedAddress && !isPublicHidden && (
                                            <button onClick={() => copyToClipboard(displayedAddress)} className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors">
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Bedrock Split View */}
                            {bedrockDetails && (
                                <div className="grid grid-cols-5 gap-2">
                                    <div className="col-span-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                                        <div className="text-[10px] text-purple-400 font-bold mb-1">SERVER ADDRESS</div>
                                        <div className="flex justify-between items-center">
                                            <code className={cn("text-white font-mono font-bold truncate", isPublicHidden && "tracking-widest")}>
                                                {isPublicHidden ? "**.**.**.**" : bedrockDetails.ip}
                                            </code>
                                            <button onClick={() => !isPublicHidden && copyToClipboard(bedrockDetails.ip)} disabled={isPublicHidden}>
                                                <Copy className="w-3 h-3 text-purple-400" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="col-span-2 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                                        <div className="text-[10px] text-purple-400 font-bold mb-1">PORT</div>
                                        <div className="flex justify-between items-center">
                                            <code className="text-white font-mono font-bold truncate">
                                                {isPublicHidden ? "*****" : bedrockDetails.port}
                                            </code>
                                            <button onClick={() => !isPublicHidden && copyToClipboard(bedrockDetails.port)} disabled={isPublicHidden}>
                                                <Copy className="w-3 h-3 text-purple-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Playit Logs & Actions */}
                            {server.publicAccess === 'playit' && (
                                <>
                                    <div className="flex items-center justify-between bg-black/30 p-2 rounded-lg mb-2">
                                        <span className="text-xs text-text-muted">Tunnel Status</span>
                                        <span className={cn("text-xs font-bold",
                                            playitStatus === 'Connected' ? "text-green-400" :
                                                playitStatus === 'Failed' ? "text-red-400" : "text-yellow-400"
                                        )}>
                                            {playitStatus || "Unknown"}
                                        </span>
                                    </div>
                                    {playitClaimUrl && !playitTunnelAddress && !server.displayIp && (
                                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center justify-between animate-pulse">
                                            <div className="text-xs text-orange-400 font-bold flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" /> Action Required
                                            </div>
                                            <button
                                                onClick={() => window.open(playitClaimUrl!, '_blank')}
                                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
                                            >
                                                Authorize Tunnel
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleResetPlayit}
                                        className="w-full py-2 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/10 text-yellow-400/80 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Reset Agent (Fix Issues)
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {server.publicAccess === 'none' && (
                        <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl mt-4">
                            <p className="text-sm font-bold text-text-muted mb-1">Access Disabled</p>
                        </div>
                    )}
                </div>
            </div>

            {/* NEW: Custom Domain & Connectivity Section */}
            <div className="bg-[#161b22] border border-border rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                    <Globe className="w-5 h-5 text-blue-400" /> Custom Domain & Direct Connect
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Custom Domain Instructions */}
                    <div className="space-y-4">
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                            <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs">1</span>
                                Choose your method
                            </h4>
                            <p className="text-xs text-text-muted mb-3">
                                Connect a real domain (e.g., <code className="text-blue-400">play.myserver.com</code>) to your server.
                            </p>

                            <div className="space-y-3">
                                {/* CNAME Method (Playit) */}
                                <div className={cn("p-3 rounded-lg border transition-colors", server.publicAccess === 'playit' ? "bg-purple-500/10 border-purple-500/30" : "bg-black/20 border-white/5 opacity-50")}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-purple-400">Method A: Public Tunnel (Playit)</span>
                                        {server.publicAccess === 'playit' && <span className="text-[10px] bg-purple-500 text-white px-1.5 rounded">Active</span>}
                                    </div>
                                    <div className="text-[10px] font-mono text-text-muted/80 bg-black/40 p-2 rounded">
                                        Type: <span className="text-white">CNAME</span><br />
                                        Target: <span className={cn("text-white select-all", isPublicHidden && "blur-sm")}>
                                            {isPublicHidden ? "**.**.**" : (playitTunnelAddress || 'agent-address.playit.gg')}
                                        </span>
                                    </div>
                                </div>

                                {/* A Record Method (Local) */}
                                <div className="p-3 rounded-lg border bg-green-500/5 border-green-500/10">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-green-400">Method B: Direct IP (A Record)</span>
                                    </div>
                                    <div className="text-[10px] font-mono text-text-muted/80 bg-black/40 p-2 rounded relative group">
                                        Type: <span className="text-white">A</span><br />
                                        Value: <span className={cn("text-white transition-all select-all", isPublicHidden && "blur-sm")}>
                                            {isPublicHidden ? "***.***.***.***" : (publicIp || 'YOUR_PUBLIC_IP')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Direct Connection (Admin View) */}
                    <div className="space-y-4">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 h-full">
                            <h4 className="font-bold text-white text-sm mb-4 flex items-center justify-between">
                                <span>Direct Connection Info</span>
                                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/20">ADMIN ONLY</span>
                            </h4>

                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs text-text-muted mb-1.5 flex justify-between">
                                        <span>Local IPv4 (LAN)</span>
                                        <button
                                            onClick={() => updateServer(server.id, { hideLocalIp: !(server.hideLocalIp ?? true) })}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            {isLocalHidden ? <><Eye className="w-3 h-3" /> Reveal</> : <><EyeOff className="w-3 h-3" /> Hide</>}
                                        </button>
                                    </div>
                                    <div className="relative group">
                                        <div className={cn(
                                            "bg-black p-3 rounded-lg font-mono text-sm border border-white/10 flex justify-between items-center transition-all",
                                            isLocalHidden ? "blur-none select-none opacity-80" : "opacity-100"
                                        )}>
                                            <span className="text-white">
                                                {isLocalHidden ? "192.168.*.*:*****" : `${lanIp}:${server.port}`}
                                            </span>
                                            <Copy className="w-4 h-4 text-text-muted" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-text-muted mt-2">
                                        Use this IP to connect from other devices in your house (TV, iPad, Console).
                                        <br /><span className="text-red-400/80">Never share this with strangers.</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Firewall Modal */}
            {
                showFirewallModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-[#161b22] border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                                <h3 className="font-bold text-white flex items-center gap-2"><Shield className="w-5 h-5 text-red-400" /> Windows Firewall Fix</h3>
                                <button onClick={() => setShowFirewallModal(false)} className="p-1 hover:bg-white/10 rounded transition-colors"><X2Icon className="w-5 h-5 text-text-muted" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-text-muted">
                                    If your friends can't join, Windows Firewall might be blocking the connection.
                                    Run this command in <strong>PowerShell as Administrator</strong> to allow the port.
                                </p>

                                <div className="bg-black border border-white/10 rounded-xl p-4 relative group">
                                    <code className="text-xs font-mono text-green-400 break-all block pr-8">
                                        New-NetFirewallRule -DisplayName "Minecraft Server" -Direction Inbound -LocalPort {server.port} -Protocol TCP -Action Allow
                                    </code>
                                    <button
                                        onClick={() => copyToClipboard(`New-NetFirewallRule -DisplayName "Minecraft Server" -Direction Inbound -LocalPort ${server.port} -Protocol TCP -Action Allow`)}
                                        className="absolute top-2 right-2 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                                    <div className="text-xs text-yellow-500/80">
                                        <strong>Access Denied?</strong> Make sure you right-click PowerShell and select "Run as Administrator".
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t border-white/5 flex justify-end">
                                <button onClick={() => setShowFirewallModal(false)} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold text-sm rounded-xl transition-colors">Done</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Wizard Modal */}
            {
                guideMode !== 'none' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                        <WizardModal
                            mode={guideMode}
                            onClose={() => setGuideMode('none')}
                            onProcess={{ playit: handleTogglePlayit, upnp: handleToggleUPnP }}
                            serverPort={server.port}
                        />
                    </div>
                )
            }
        </div >
    );
}

function X2Icon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
}

// Re-using WizardModal logic but keeping it cleaner for file length.
function WizardModal({ mode, onClose, onProcess, serverPort }: any) {
    const [step, setStep] = useState(1);

    // UPnP View
    if (mode === 'upnp') {
        return (
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="h-1 w-full bg-gradient-to-r from-green-500 to-emerald-400" />
                <div className="p-6">
                    <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Globe className="w-5 h-5 text-green-400" /> Direct Access (UPnP)</h2>
                    <p className="text-sm text-slate-400 mb-6">Attempts to auto-configure your router to open port {serverPort}.</p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-300 font-bold">Cancel</button>
                        <button onClick={onProcess.upnp} className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm text-white font-bold shadow-lg shadow-green-900/20">Connect</button>
                    </div>
                </div>
            </div>
        )
    }

    // Playit View
    return (
        <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-cyan-500" />

            <div className="p-5 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur relative z-10 flex justify-between">
                <h2 className="font-bold text-white flex items-center gap-2"><Shield className="w-4 h-4 text-purple-400" /> Playit Setup</h2>
                <div className="flex gap-1 items-center">
                    {[1, 2, 3].map(i => <div key={i} className={cn("h-1 rounded-full transition-all", step === i ? "w-6 bg-cyan-400" : "w-1.5 bg-white/20")} />)}
                </div>
            </div>

            <div className="p-6 min-h-[160px] relative z-10">
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <h3 className="font-bold text-white mb-1">Download Agent</h3>
                        <p className="text-sm text-slate-400">We'll download and run the background tunnel program.</p>
                    </div>
                )}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <h3 className="font-bold text-white mb-1">Wait for Link</h3>
                        <p className="text-sm text-slate-400">A claim link will appear in the dashboard logs shortly.</p>
                    </div>
                )}
                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <h3 className="font-bold text-white mb-1">Authorize</h3>
                        <p className="text-sm text-slate-400">Click the link and approve the connection on Playit.gg.</p>
                    </div>
                )}
            </div>

            <div className="p-5 border-t border-white/5 flex gap-3 relative z-10 bg-white/5">
                <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)} className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm text-slate-400 font-bold transition-colors">
                    {step === 1 ? 'Cancel' : 'Back'}
                </button>
                <button onClick={step < 3 ? () => setStep(s => s + 1) : onProcess.playit} className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white font-bold shadow-lg shadow-purple-900/20">
                    {step < 3 ? 'Next' : 'Start Tunnel'}
                </button>
            </div>
        </div>
    );
}
