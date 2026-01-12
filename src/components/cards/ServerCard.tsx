import { Play, Square, Settings, Component, Scroll, Hammer, Layers, Box, Globe, Cpu, Trash2, Users } from 'lucide-react';
import { Server, ServerType } from '../../stores/appStore';
import { cn } from '../../lib/utils';

interface ServerCardProps {
    server: Server;
    onStart?: () => void;
    onStop?: () => void;
    onSettings?: () => void;
    onDelete?: () => void;
    onClick?: () => void;
}

const ServerIcon = ({ type }: { type: ServerType }) => {
    switch (type) {
        case 'vanilla': return <Box className="w-10 h-10 text-emerald-400" />;
        case 'paper': return <Scroll className="w-10 h-10 text-blue-400" />;
        case 'forge': return <Hammer className="w-10 h-10 text-orange-400" />;
        case 'fabric': return <Layers className="w-10 h-10 text-amber-300" />;
        case 'bedrock': return <Globe className="w-10 h-10 text-purple-400" />;
        case 'spigot': return <Component className="w-10 h-10 text-orange-500" />;
        case 'purpur': return <Cpu className="w-10 h-10 text-indigo-400" />;
        default: return <Box className="w-10 h-10 text-gray-400" />;
    }
};

export function ServerCard({ server, onStart, onStop, onSettings, onDelete, onClick }: ServerCardProps) {
    const isOnline = server.status === 'running';

    return (
        <div
            onClick={onClick}
            className="glass-card p-4 group relative overflow-visible hover:border-primary/40 transition-all duration-300 cursor-pointer"
        >
            <div className="flex items-center gap-4 relative z-10">

                {/* 1. Icon (Left) - Reduced size */}
                <div className={cn(
                    "w-16 h-16 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden transition-all duration-500 shrink-0",
                    isOnline ? "bg-primary/10 ring-1 ring-primary/50 shadow-[0_0_20px_-5px_var(--color-primary-glow)]" : "bg-surface/50 border border-border"
                )}>
                    {/* Inner glowing core for online state */}
                    <div className={cn("absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-transparent transition-opacity", isOnline ? "opacity-100" : "opacity-0")} />
                    <ServerIcon type={server.type} />
                </div>

                {/* 2. Main Info (Middle) */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <h3 className="text-lg font-bold text-white tracking-tight truncate">{server.name}</h3>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Badge */}
                        <span className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm",
                            isOnline
                                ? "bg-primary/10 text-primary border-primary/20 shadow-primary/10"
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                        )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-primary animate-pulse" : "bg-red-500")} />
                            {server.status}
                        </span>

                        {/* Version Pill */}
                        <span className="text-xs text-text-secondary font-mono bg-surface/50 px-1.5 py-0.5 rounded border border-border">
                            {server.version}
                        </span>
                    </div>
                </div>

                {/* 3. Actions (Right) */}
                <div className="flex items-center gap-3">

                    {/* Player Count */}
                    <div className="hidden xl:flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1 text-text-secondary">
                            <Users className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Players</span>
                        </div>
                        <p className="text-sm font-bold text-white">
                            <span className={isOnline ? "text-primary" : ""}>{server.playerCount}</span>
                            <span className="text-text-muted"> / {server.maxPlayers}</span>
                        </p>
                    </div>

                    <div className="hidden xl:block w-px h-8 bg-white/5 mx-1" />

                    {/* Action Button - Reduced Width */}
                    {isOnline ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStop?.(); }}
                            className="h-10 w-28 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black border border-red-500/50 hover:border-red-500 rounded-lg flex items-center justify-center gap-2 transition-all font-bold tracking-wide shadow-lg shadow-red-500/10 active:scale-95 group"
                        >
                            <Square className="w-4 h-4 fill-current" />
                            STOP
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStart?.(); }}
                            className="h-10 w-28 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <Play className="w-4 h-4 fill-black relative z-10" />
                            <span className="relative z-10 text-sm">START</span>
                        </button>
                    )}

                    {/* Small Icons Stack */}
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onSettings?.(); }}
                            className="p-1.5 rounded-md text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                            title="Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                            className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-white/5 transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Premium Glow Effect */}
            <div className={cn(
                "absolute -inset-px rounded-xl border border-primary/20 opacity-0 transition-opacity duration-300 pointer-events-none",
                isOnline && "opacity-100"
            )} />
        </div>
    );
}
