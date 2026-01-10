import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore, Server, ServerType } from '../../stores/appStore';
import { Play, RotateCcw, Cpu, Coffee, MemoryStick, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface StartupManagerProps {
    server: Server;
}

interface JavaInstall {
    path: string;
    version: string;
    arch: string;
}

const isJavaServer = (type: ServerType) => {
    return ['vanilla', 'paper', 'spigot', 'forge', 'fabric', 'purpur'].includes(type);
};

export function StartupManager({ server }: StartupManagerProps) {
    const { updateServer, systemInfo } = useAppStore();
    const [javaInstalls, setJavaInstalls] = useState<JavaInstall[]>([]);
    const [useAikars, setUseAikars] = useState(false);
    const [ram, setRam] = useState(server.allocatedRam || 2048);
    const [manualFlags, setManualFlags] = useState(server.startupFlags || "");

    const AIKARS_FLAGS = "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1";

    useEffect(() => {
        if (isJavaServer(server.type)) {
            invoke<JavaInstall[]>('get_java_versions').then(setJavaInstalls).catch(console.error);
        }

        // Detect if using Aikars
        if (server.startupFlags?.includes("UseG1GC")) {
            setUseAikars(true);
        }
        setRam(server.allocatedRam || 2048);
        setManualFlags(server.startupFlags || "");
    }, [server.id, server.type]);



    const handleAikarsToggle = (enabled: boolean) => {
        setUseAikars(enabled);
        if (enabled) {
            updateServer(server.id, { startupFlags: AIKARS_FLAGS });
            setManualFlags(AIKARS_FLAGS);
            toast.success("Optimized flags enabled (Aikar's)");
        } else {
            // Revert to basics or empty
            updateServer(server.id, { startupFlags: "" });
            setManualFlags("");
            toast.success("Startup flags cleared");
        }
    };

    const handleRamChange = (mb: number) => {
        setRam(mb);
        // Debounce update in real app, but here direct is okay for now or onMouseUp
        updateServer(server.id, { allocatedRam: mb });
    };

    const handleManualFlagsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setManualFlags(val);
        setUseAikars(val.includes("UseG1GC"));
        // Debounce needed ideally, but onBlur can work
    };

    const saveFlags = () => {
        updateServer(server.id, { startupFlags: manualFlags });
        toast.success("Startup flags saved");
    };

    const handleAutoRestartToggle = (enabled: boolean) => {
        updateServer(server.id, { autoRestart: enabled });
        toast.success(`Auto-restart ${enabled ? 'enabled' : 'disabled'}`);
    };

    const maxRam = systemInfo ? Math.floor(systemInfo.totalMemory / 1024 / 1024) : 16384; // Default 16GB if unknown

    if (!isJavaServer(server.type)) {
        return (
            <div className="flex flex-col gap-6 h-full bg-[#0d1117] p-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <Play className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Startup Configuration</h2>
                        <p className="text-xs text-text-muted">Settings for {server.type} server</p>
                    </div>
                </div>

                <div className="bg-[#161b22] border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <RotateCcw className="w-4 h-4 text-purple-400" /> Auto-Restart
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={server.autoRestart || false}
                                onChange={(e) => handleAutoRestartToggle(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                    <p className="text-xs text-text-muted">
                        Automatically attempt to restart the server if it crashes or stops unexpectedly.
                    </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3">
                    <Zap className="w-5 h-5 text-blue-400 shrink-0" />
                    <div className="text-xs text-blue-300/80 leading-relaxed">
                        <strong>Native Performance:</strong> Bedrock servers run natively and manage their own memory usage. No JVM configuration is required.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full bg-[#0d1117] p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Play className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Startup Configuration</h2>
                    <p className="text-xs text-text-muted">Java Runtime & performance settings</p>
                </div>
            </div>

            {/* RAM Allocation */}
            <div className="bg-[#161b22] border border-border rounded-xl p-6 shadow-lg">
                <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-pink-400" /> RAM Allocation
                </h3>

                <div className="mb-6 px-2">
                    <input
                        type="range"
                        min="1024"
                        max={maxRam}
                        step="512"
                        value={ram}
                        onChange={(e) => handleRamChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <div className="flex justify-between mt-2 text-xs text-text-muted font-mono">
                        <span>1 GB</span>
                        <span>{Math.floor(maxRam / 1024)} GB (Sys)</span>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-black/30 rounded-lg p-4">
                    <div className="text-xs text-text-muted">Allocated Memory (Xmx)</div>
                    <div className="text-xl font-bold text-white font-mono">
                        {(ram / 1024).toFixed(1)} <span className="text-sm text-text-muted">GB</span>
                    </div>
                </div>
            </div>

            {/* Java Version */}
            <div className="bg-[#161b22] border border-border rounded-xl p-6 shadow-lg">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-orange-400" /> Java Version
                </h3>
                <div className="grid gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {javaInstalls.map((java, i) => {
                        const isSelected = server.javaPath === java.path || (!server.javaPath && java.path === 'java');
                        return (
                            <label key={i} className={cn(
                                "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                                isSelected
                                    ? "bg-orange-500/10 border-orange-500/50 shadow-[0_0_15px_-5px_rgba(249,115,22,0.3)]"
                                    : "bg-black/20 border-border hover:bg-white/5"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                                        isSelected ? "border-orange-500 bg-orange-500" : "border-white/20")}>
                                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">Java {java.version}</div>
                                        <div className="text-[10px] text-text-muted font-mono truncate max-w-[200px]" title={java.path}>{java.path}</div>
                                    </div>
                                </div>
                                <div className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-text-secondary border border-white/10 uppercase tracking-wider font-bold">
                                    {java.arch}
                                </div>
                            </label>
                        );
                    })}
                    {javaInstalls.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-6 text-text-muted gap-2 opacity-50">
                            <Coffee className="w-8 h-8" />
                            <span className="text-sm">Scanning for Java...</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Flags Wrapper */}
                <div className="bg-[#161b22] border border-border rounded-xl p-6 md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-cyan-400" /> Startup Flags
                            </h3>
                            <button
                                onClick={() => handleAikarsToggle(!useAikars)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold transition-colors border",
                                    useAikars
                                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                        : "bg-white/5 text-text-muted border-white/10 hover:bg-white/10"
                                )}
                            >
                                {useAikars ? "Aikar's Flags Active" : "Apply Aikar's Flags"}
                            </button>
                        </div>
                    </div>

                    <textarea
                        value={manualFlags}
                        onChange={handleManualFlagsChange}
                        className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs font-mono text-cyan-300 h-24 focus:outline-none focus:border-cyan-500/50 resize-none mb-2"
                        placeholder="-Xms2G -Xmx2G -jar server.jar"
                        spellCheck={false}
                    />
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] text-text-muted">
                            Common flags: <code>-Xmx</code> (Max RAM) is handled by the slider above.
                        </p>
                        <button onClick={saveFlags} className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-cyan-900/20">
                            Save Flags
                        </button>
                    </div>
                </div>

                {/* Auto Restart */}
                <div className="bg-[#161b22] border border-border rounded-xl p-6 flex items-center justify-between md:col-span-2">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                            <RotateCcw className="w-4 h-4 text-purple-400" /> Auto-Restart
                        </h3>
                        <p className="text-xs text-text-muted">
                            Automatically restart if the server crashes.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={server.autoRestart || false}
                            onChange={(e) => handleAutoRestartToggle(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>
            </div>
        </div>
    );
}
