import { useState, useEffect } from 'react';
import { Server, useAppStore } from '../../stores/appStore';
import { Shield, ShieldAlert, Lock, Activity, AlertTriangle, Zap, Check, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { invoke } from '@tauri-apps/api/core';

interface SecurityManagerProps {
    server: Server;
}

export function SecurityManager({ server }: SecurityManagerProps) {
    const { updateServer } = useAppStore();
    const [panicMode, setPanicMode] = useState(false);
    const [firewallStatus, setFirewallStatus] = useState<'active' | 'inactive' | 'unknown'>('unknown');

    useEffect(() => {
        checkFirewall();
    }, [server.port]);

    const checkFirewall = async () => {
        try {
            const active = await invoke<boolean>('check_firewall_rule', { port: server.port });
            setFirewallStatus(active ? 'active' : 'inactive');
        } catch (e) {
            console.error("Firewall check failed:", e);
        }
    };

    const handleFixFirewall = async () => {
        const toastId = toast.loading("Configuring Windows Firewall...");
        try {
            await invoke('add_firewall_rule', { port: server.port });
            toast.success("Firewall rule added successfully!", { id: toastId });
            checkFirewall();
        } catch (e: any) {
            toast.error("Failed to add firewall rule: " + e, { id: toastId });
        }
    };

    const handleTunnelGuard = async () => {
        const newState = !server.tunnelGuard;
        // Optimistic update
        updateServer(server.id, { tunnelGuard: newState });

        try {
            // Real implementation
            await invoke('set_tunnel_guard', { id: server.id, port: server.port, enabled: newState });
            toast.success(newState ? "Tunnel Guard ACTIVE: Direct connections blocked." : "Tunnel Guard Disabled.");
        } catch (e) {
            updateServer(server.id, { tunnelGuard: !newState }); // Revert
            toast.error("Failed to toggle Tunnel Guard via Firewall: " + e);
        }
    };

    const handleInstallBotProtection = async () => {
        const toastId = toast.loading("Installing Grim Anti-Cheat...");
        try {
            await invoke('install_grimac', { serverPath: server.path });
            toast.success("GrimAC Installed! Restart server to apply.", { id: toastId });
        } catch (e) {
            toast.error("Installation Failed: " + e, { id: toastId });
        }
    };

    const handlePanicButton = async () => {
        if (!confirm("⚠️ ACTIVATE PANIC MODE?\n\n1. Whitelist will be ENABLED.\n2. All non-whitelisted players will be KICKED.\n3. View distance set to 4.")) return;

        setPanicMode(true);
        try {
            if (server.status === 'running') {
                // Java/PocketMine uses 'whitelist', Bedrock uses 'allowlist'
                const whitelistCmd = server.type === 'bedrock' ? 'allowlist on' : 'whitelist on';

                await invoke('send_server_command', { id: server.id, command: whitelistCmd });
                await invoke('send_server_command', { id: server.id, command: 'kick @a[tag=!trusted] 🛡️_SECURITY_LOCKDOWN_🛡️' });
                await invoke('send_server_command', { id: server.id, command: 'view-distance 4' });

                // Title command syntax differs slightly or is universal enough
                const titleCmd = server.type === 'bedrock'
                    ? 'title @a title §cLOCKDOWN ACTIVE'
                    : 'title @a title {"text":"LOCKDOWN ACTIVE","color":"red"}';

                await invoke('send_server_command', { id: server.id, command: titleCmd });
                toast.success("PANIC MODE EXECUTED!");
            } else {
                toast.warning("Server is not running. Commands queued.");
            }
        } catch (e) {
            toast.error("Panic Failed: " + e);
        } finally {
            setTimeout(() => setPanicMode(false), 3000);
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full bg-[#0d1117] p-6 overflow-y-auto">
            {/* Header / Threat Level */}
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-2xl p-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Shield className="w-6 h-6 text-green-400" /> Security Center
                    </h2>
                    <p className="text-sm text-text-muted mt-1">Protect your server from bots, DDoS, and griefers.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs font-bold text-text-muted uppercase">Threat Level</div>
                        <div className="text-green-400 font-bold text-lg">SAFE</div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center animate-pulse">
                        <Activity className="w-6 h-6 text-green-400" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Windows Firewall */}
                <div className={cn(
                    "border rounded-2xl p-6 relative overflow-hidden transition-all group",
                    firewallStatus === 'active'
                        ? "bg-gradient-to-br from-orange-500/5 to-red-500/5 border-orange-500/30"
                        : "bg-[#161b22] border-red-500/50 shadow-lg shadow-red-500/5"
                )}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Flame className={cn("w-5 h-5", firewallStatus === 'active' ? "text-orange-400" : "text-red-500")} />
                            Windows Firewall
                        </h3>
                        {firewallStatus === 'active' ? (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
                                <Check className="w-3 h-3" /> Public Access Open
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                                <AlertTriangle className="w-3 h-3" /> Action Required
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-text-muted mb-6 h-12 leading-relaxed">
                        {firewallStatus === 'active'
                            ? <span>Your server port (<span className="text-white font-mono bg-white/5 px-1 rounded">{server.port}</span>) is allowed through the firewall. Friends can now join using your public IP.</span>
                            : <span>Your server port (<span className="text-white font-mono bg-white/5 px-1 rounded">{server.port}</span>) is currently <strong className="text-red-400">BLOCKED</strong>. Friends cannot join until you allow this rule.</span>
                        }
                    </p>

                    {firewallStatus !== 'active' && (
                        <div className="space-y-3">
                            <button
                                onClick={handleFixFirewall}
                                className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group-hover:shadow-red-500/30"
                            >
                                <Zap className="w-4 h-4 fill-white animate-pulse" />
                                Fix Firewall Rules
                            </button>
                            <p className="text-[10px] text-center text-text-muted opacity-60">
                                This will add an inbound rule for TCP Port {server.port}
                            </p>
                        </div>
                    )}
                    {firewallStatus === 'active' && (
                        <div className="flex gap-2">
                            <div className="flex-1 py-2.5 bg-white/5 border border-white/5 text-text-muted font-bold rounded-xl flex items-center justify-center text-sm cursor-default">
                                <Check className="w-4 h-4 mr-2 text-green-500" />
                                Rule Active
                            </div>
                            <button
                                onClick={checkFirewall}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-text-muted hover:text-white rounded-xl transition-colors"
                                title="Re-check Status"
                            >
                                <Activity className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Tunnel Guard */}
                <div className={cn(
                    "border rounded-2xl p-6 relative overflow-hidden transition-all",
                    server.tunnelGuard ? "bg-blue-500/5 border-blue-500/30" : "bg-[#161b22] border-border"
                )}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Lock className="w-5 h-5 text-blue-400" /> Tunnel Guard
                        </h3>
                        <div onClick={handleTunnelGuard} className={cn(
                            "w-12 h-6 rounded-full cursor-pointer transition-colors p-0.5",
                            server.tunnelGuard ? "bg-blue-500" : "bg-white/10"
                        )}>
                            <div className={cn(
                                "w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                                server.tunnelGuard ? "translate-x-6" : "translate-x-0"
                            )} />
                        </div>
                    </div>
                    <p className="text-sm text-text-muted mb-4 h-10">
                        Closes your PC's ports to the public internet. Only allows connections via <strong>Playit.gg</strong> or <strong>Localhost</strong>.
                        <br /><span className="text-blue-400 text-xs mt-1 block">Prevents direct IP attacks/DDoS on your home router.</span>
                    </p>

                    {server.tunnelGuard && (
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-400 bg-blue-500/10 p-2 rounded-lg">
                            <Check className="w-4 h-4" />
                            <span>Active: Direct Ports Closed</span>
                        </div>
                    )}
                </div>

                {/* Panic Button */}
                <div className="bg-[#161b22] border border-red-500/20 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors" />

                    <h3 className="font-bold text-white flex items-center gap-2 mb-2 relative z-10">
                        <ShieldAlert className="w-5 h-5 text-red-500" /> Panic Mode
                    </h3>
                    <p className="text-sm text-text-muted mb-6 relative z-10">
                        Under attack? Instantly lockdown the server.
                        <ul className="list-disc list-inside mt-2 text-xs text-text-muted/70">
                            <li>Enable Whitelist</li>
                            <li>Kick non-trusted players</li>
                            <li>Reduce View Distance</li>
                        </ul>
                    </p>

                    <button
                        onClick={handlePanicButton}
                        disabled={panicMode}
                        className="w-full relative z-10 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disable:opacity-50"
                    >
                        {panicMode ? <Activity className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
                        {panicMode ? "SECURING SERVER..." : "ACTIVATE LOCKDOWN"}
                    </button>
                </div>
            </div>

            {/* Anti-Bot Section */}
            {/* Platform Specific Modules */}
            {['paper', 'spigot', 'purpur', 'vanilla', 'forge', 'fabric'].includes(server.type) && (
                <div className="bg-[#161b22] border border-border rounded-2xl p-6">
                    <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-yellow-400" /> Bot Protection (GrimAC)
                    </h3>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-500">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-text-muted mb-3">
                                Automatically install and configure <strong>GrimAC</strong>, the best open-source anti-cheat/anti-bot for Java Edition.
                            </p>
                            <button onClick={handleInstallBotProtection} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-lg border border-white/10 transition-colors">
                                Check Compatibility & Install
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {['bedrock'].includes(server.type) && (
                <div className="bg-[#161b22] border border-border rounded-2xl p-6">
                    <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-green-400" /> XBOX Auth Guard
                    </h3>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-500/10 rounded-xl text-green-500">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-text-muted mb-3">
                                Enforce <strong>Xbox Live Authentication</strong> (online-mode) to prevent spoofed logins and bots.
                            </p>
                            <div className="text-xs text-blue-400 bg-blue-500/10 p-2 rounded border border-blue-500/20 mb-3">
                                Tip: Enable "Panic Mode" above to instantly turn on the AllowList.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
