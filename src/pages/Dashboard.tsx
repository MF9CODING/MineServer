import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
    Plus, Download, Activity, Cpu, HardDrive,
    MemoryStick, Terminal, Users, Sparkles, User,
    Server, Zap, Gauge, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../stores/appStore';
import { ServerCard } from '../components/cards/ServerCard';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export function Dashboard() {
    const navigate = useNavigate();
    const { servers, systemInfo, fetchSystemInfo, toggleServerStatus } = useAppStore();

    useEffect(() => {
        fetchSystemInfo();
        // Refresh every 5 seconds
        const interval = setInterval(fetchSystemInfo, 5000);
        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => {
        if (!systemInfo) return null;

        const totalMemGb = systemInfo.totalMemory / 1024 / 1024 / 1024;
        const usedMemGb = systemInfo.usedMemory / 1024 / 1024 / 1024;
        const freeMemGb = totalMemGb - usedMemGb;

        const safeRamBytes = Math.max(0, systemInfo.totalMemory - (4 * 1024 * 1024 * 1024));
        const maxPlayersEst = Math.floor((safeRamBytes / 1024 / 1024) / 80);

        const diskTotal = systemInfo.diskTotalGb || 512;
        const diskFree = systemInfo.diskFreeGb || 100;
        const diskUsed = diskTotal - diskFree;

        return {
            cpuUsage: Math.round(systemInfo.cpuUsage || 0),
            memUsage: Math.round((systemInfo.usedMemory / systemInfo.totalMemory) * 100),
            storageUsage: Math.round((diskUsed / diskTotal) * 100),
            ramData: [
                { name: 'Used', value: parseFloat(usedMemGb.toFixed(1)) },
                { name: 'Free', value: parseFloat(freeMemGb.toFixed(1)) },
            ],
            maxPlayersEst: Math.max(0, maxPlayersEst),
            safeRamGb: (safeRamBytes / 1024 / 1024 / 1024).toFixed(1),
            totalMemGb,
            usedMemGb,
            freeMemGb,
            diskTotal,
            diskFree,
            diskUsed
        };
    }, [systemInfo]);

    const runningServers = servers.filter(s => s.status === 'running').length;
    const totalPlayers = servers.reduce((acc, s) => acc + (s.playerCount || 0), 0);

    return (
        <div className="min-h-full">
            {/* Hero Section with Gradient */}
            <div className="relative overflow-hidden bg-gradient-to-br from-surface via-surface to-primary/5 border-b border-border">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative p-6 lg:p-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start justify-between gap-4 flex-wrap"
                    >
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                                    <Gauge className="w-7 h-7 text-black" />
                                </div>
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-bold text-white">Command Center</h1>
                                    <p className="text-text-secondary text-sm flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        All systems operational
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-white">Administrator</p>
                                <p className="text-xs text-text-muted">{systemInfo?.hostName || 'Localhost'}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center">
                                <User className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Quick Stats Row */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6"
                    >
                        <QuickStatCard
                            label="Total Servers"
                            value={servers.length}
                            icon={Server}
                            color="blue"
                        />
                        <QuickStatCard
                            label="Running"
                            value={runningServers}
                            icon={Activity}
                            color="emerald"
                            pulse={runningServers > 0}
                        />
                        <QuickStatCard
                            label="Players Online"
                            value={totalPlayers}
                            icon={Users}
                            color="purple"
                        />
                        <QuickStatCard
                            label="CPU Usage"
                            value={`${stats?.cpuUsage || 0}%`}
                            icon={Cpu}
                            color="orange"
                        />
                    </motion.div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-6 lg:p-8 space-y-8">
                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    <QuickActionCard
                        title="Deploy Server"
                        desc="Create a new Minecraft server"
                        icon={<Plus className="w-6 h-6" />}
                        gradient="from-primary to-emerald-500"
                        onClick={() => navigate('/create')}
                    />
                    <QuickActionCard
                        title="Import Backup"
                        desc="Restore from .zip or folder"
                        icon={<Download className="w-6 h-6" />}
                        gradient="from-blue-500 to-indigo-500"
                        onClick={() => toast.info("Import feature coming soon!")}
                    />
                    <QuickActionCard
                        title="Quick Start"
                        desc="Launch your last server"
                        icon={<Zap className="w-6 h-6" />}
                        gradient="from-purple-500 to-pink-500"
                        onClick={() => {
                            const lastServer = servers[0];
                            if (lastServer) navigate(`/servers/${lastServer.id}`);
                            else navigate('/create');
                        }}
                    />
                </motion.div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Left Col: Servers */}
                    <div className="xl:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Server className="w-5 h-5 text-primary" />
                                Active Servers
                            </h2>
                            <button
                                onClick={() => navigate('/servers')}
                                className="text-sm text-text-muted hover:text-primary transition-colors flex items-center gap-1 group"
                            >
                                View All <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </button>
                        </div>

                        {servers.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {servers.slice(0, 3).map((server, i) => (
                                    <motion.div
                                        key={server.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 + (i * 0.1) }}
                                    >
                                        <ServerCard
                                            server={server}
                                            onClick={() => navigate(`/servers/${server.id}`)}
                                            onStart={async () => {
                                                toast.success(`Starting ${server.name}...`);
                                                try {
                                                    const jarName = server.type === 'bedrock' ? 'bedrock_server.exe' : 'server.jar';
                                                    await invoke('start_server', {
                                                        id: server.id,
                                                        path: server.path,
                                                        jarFile: jarName,
                                                        ram: server.allocatedRam || 4096
                                                    });
                                                    toggleServerStatus(server.id);
                                                } catch (err) {
                                                    toast.error(`Failed to start: ${err}`);
                                                }
                                            }}
                                            onStop={async () => {
                                                toast.info(`Stopping ${server.name}...`);
                                                try {
                                                    await invoke('stop_server', { id: server.id });
                                                    toggleServerStatus(server.id);
                                                } catch (err) {
                                                    toast.error(`Failed to stop: ${err}`);
                                                }
                                            }}
                                            onSettings={() => navigate(`/servers/${server.id}`)}
                                            onDelete={async () => {
                                                if (confirm("⚠️ This server will be PERMANENTLY DELETED. Continue?")) {
                                                    try {
                                                        const store = useAppStore.getState();
                                                        await store.deleteServer(server.id);
                                                        toast.success("Server deleted");
                                                    } catch (e) {
                                                        toast.error("Failed to delete server");
                                                    }
                                                }
                                            }}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <EmptyServerState onCreateClick={() => navigate('/create')} />
                        )}
                    </div>

                    {/* Right Col: System Analysis */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="space-y-6"
                    >
                        <SystemAnalysisCard stats={stats} systemInfo={systemInfo} onRefresh={fetchSystemInfo} />
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

// Quick Stat Card Component
function QuickStatCard({ label, value, icon: Icon, color, pulse }: any) {
    const colors: Record<string, string> = {
        blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400',
        emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
        purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400',
        orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/20 text-orange-400',
    };

    return (
        <div className={cn(
            "glass-card p-4 flex items-center gap-3 bg-gradient-to-br border",
            colors[color]
        )}>
            <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center bg-white/5",
                pulse && "animate-pulse"
            )}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-text-secondary uppercase tracking-wider">{label}</p>
            </div>
        </div>
    );
}

// Quick Action Card Component
function QuickActionCard({ title, desc, icon, gradient, onClick }: any) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all"
        >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-20 group-hover:opacity-30 transition-opacity", gradient)} />
            <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm" />
            <div className="absolute inset-px rounded-2xl border border-white/10 group-hover:border-white/20 transition-colors" />

            <div className="relative flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg", gradient)}>
                    {icon}
                </div>
                <div>
                    <h3 className="font-bold text-white group-hover:text-primary transition-colors">{title}</h3>
                    <p className="text-xs text-text-secondary">{desc}</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-text-muted ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </div>
        </motion.button>
    );
}

// Empty Server State Component
function EmptyServerState({ onCreateClick }: { onCreateClick: () => void }) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-gradient-to-br from-surface via-surface to-primary/5 p-8 text-center">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

            <div className="relative">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center"
                >
                    <Server className="w-10 h-10 text-primary" />
                </motion.div>

                <h3 className="text-xl font-bold text-white mb-2">No Servers Yet</h3>
                <p className="text-text-secondary mb-6 max-w-sm mx-auto">
                    Create your first Minecraft server and start your adventure!
                </p>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCreateClick}
                    className="group relative px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl inline-flex items-center gap-2 transition-all shadow-lg shadow-primary/25"
                >
                    <Plus className="w-5 h-5" />
                    Create Server
                    <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>
            </div>
        </div>
    );
}

// Enhanced System Analysis Card
function SystemAnalysisCard({ stats, systemInfo, onRefresh }: any) {
    const GAUGE_COLORS = ['#3b82f6', 'rgba(255,255,255,0.05)'];

    return (
        <div className="glass-card overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-surface to-surface/50 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">System Analysis</h3>
                        <p className="text-xs text-text-muted">Live hardware metrics</p>
                    </div>
                </div>
                <button
                    onClick={onRefresh}
                    className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-primary transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {stats && systemInfo ? (
                <div className="p-5 space-y-6">
                    {/* RAM Donut Chart */}
                    <div className="relative h-40 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.ramData}
                                    innerRadius={55}
                                    outerRadius={70}
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                    startAngle={90}
                                    endAngle={-270}
                                    cornerRadius={4}
                                >
                                    {stats.ramData.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={GAUGE_COLORS[index]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-3xl font-bold text-white">{stats.memUsage}%</div>
                            <span className="text-xs text-text-muted uppercase tracking-wider">RAM</span>
                        </div>
                    </div>

                    {/* Resource Bars */}
                    <div className="space-y-4">
                        <ResourceBar
                            label="CPU"
                            value={stats.cpuUsage}
                            icon={Cpu}
                            color="blue"
                            sub={`${systemInfo.cpuCores} cores / ${systemInfo.cpuThreads} threads`}
                        />
                        <ResourceBar
                            label="Memory"
                            value={stats.memUsage}
                            icon={MemoryStick}
                            color="emerald"
                            sub={`${stats.usedMemGb.toFixed(1)} / ${stats.totalMemGb.toFixed(1)} GB`}
                        />
                        <ResourceBar
                            label="Storage"
                            value={stats.storageUsage}
                            icon={HardDrive}
                            color="orange"
                            sub={`${stats.diskUsed.toFixed(0)} / ${stats.diskTotal} GB`}
                        />
                    </div>

                    {/* System Info Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                        <InfoChip label="Platform" value={systemInfo.osName || 'Unknown'} icon={Terminal} />
                        <InfoChip label="Version" value={systemInfo.osVersion || 'N/A'} icon={Activity} />
                    </div>

                    {/* AI Recommendation */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4">
                        <div className="absolute inset-0 bg-primary/5 blur-3xl" />
                        <div className="relative flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-emerald-500 shadow-lg shadow-primary/20 shrink-0">
                                <Zap className="w-4 h-4 text-black" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                                    Optimized Config
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[10px] text-primary uppercase tracking-wider">AI</span>
                                </h4>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Your system can support up to <strong className="text-primary">{stats.maxPlayersEst} players</strong> with <strong className="text-primary">{stats.safeRamGb} GB</strong> RAM allocation.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
                        <div className="w-16 h-16 rounded-full bg-surface/50 border border-border flex items-center justify-center relative z-10">
                            <Activity className="w-8 h-8 text-primary animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-medium text-white">Analyzing Hardware</h3>
                        <p className="text-sm text-text-muted">Gathering metrics...</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// Resource Bar Component
function ResourceBar({ label, value, icon: Icon, color, sub }: any) {
    const colors: Record<string, { bar: string; text: string }> = {
        blue: { bar: 'bg-blue-500', text: 'text-blue-400' },
        emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
        orange: { bar: 'bg-orange-500', text: 'text-orange-400' },
        purple: { bar: 'bg-purple-500', text: 'text-purple-400' },
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", colors[color].text)} />
                    <span className="text-sm font-medium text-white">{label}</span>
                </div>
                <span className={cn("text-sm font-bold", colors[color].text)}>{value}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={cn("h-full rounded-full", colors[color].bar)}
                />
            </div>
            {sub && <p className="text-xs text-text-muted">{sub}</p>}
        </div>
    );
}

// Info Chip Component
function InfoChip({ label, value, icon: Icon }: any) {
    return (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/5">
            <Icon className="w-4 h-4 text-text-muted" />
            <div className="min-w-0">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
                <p className="text-sm font-medium text-white truncate">{value}</p>
            </div>
        </div>
    );
}
