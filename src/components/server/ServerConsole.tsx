import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Terminal, Trash2, ArrowDown, X, Search, Eye, EyeOff, Download, Power, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { invoke } from '@tauri-apps/api/core';

interface ServerConsoleProps {
    logs: string[];
    setLogs: React.Dispatch<React.SetStateAction<string[]>>;
    isRunning: boolean;
    onSendCommand: (cmd: string) => void;
    hideIp?: boolean;
    onToggleIp?: () => void;
    ipAddress?: string;
    serverPath: string;
}

export function ServerConsole({ logs, setLogs, isRunning, onSendCommand, hideIp, onToggleIp, ipAddress, serverPath }: ServerConsoleProps) {
    const [autoScroll, setAutoScroll] = useState(() => {
        const saved = localStorage.getItem('console_autoscroll');
        return saved !== null ? saved === 'true' : true;
    });

    // Persist auto-scroll preference
    useEffect(() => {
        localStorage.setItem('console_autoscroll', String(autoScroll));
    }, [autoScroll]);
    const [commandInput, setCommandInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Memoize filtered logs to prevent unnecessary effects
    const filteredLogs = useMemo(() => {
        return searchTerm
            ? logs.filter(l => l.toLowerCase().includes(searchTerm.toLowerCase()))
            : logs;
    }, [logs, searchTerm]);

    const [showSearch, setShowSearch] = useState(false);
    const consoleRef = useRef<HTMLDivElement>(null);
    const consoleEndRef = useRef<HTMLDivElement>(null);

    // Command History
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useEffect(() => {
        if (autoScroll) {
            // Instant scroll to bottom when logs change
            // Using timeout to ensure DOM update is complete
            const timeoutId = setTimeout(() => {
                if (consoleEndRef.current) {
                    consoleEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
                }
            }, 10);
            return () => clearTimeout(timeoutId);
        }
    }, [filteredLogs, autoScroll]);

    // Handle manual scroll - disable auto-scroll if user scrolls up
    const handleScroll = () => {
        if (!consoleRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // Tolerant "at bottom" check (50px buffer)
        const isAtBottom = distanceFromBottom < 50;

        if (!autoScroll && isAtBottom) {
            // Re-enable if user scrolls back to bottom manually
            setAutoScroll(true);
        } else if (autoScroll && distanceFromBottom > 150) {
            // Only disable if user explicitly scrolls up significantly (>150px)
            // This prevents jitter from disabling it
            setAutoScroll(false);
        }
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commandInput.trim()) return;

        onSendCommand(commandInput);
        setHistory(prev => [commandInput, ...prev.slice(0, 49)]); // Store last 50
        setHistoryIndex(-1);
        setCommandInput("");
        // Force scroll to bottom on send
        setAutoScroll(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < history.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setCommandInput(history[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCommandInput(history[newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setCommandInput("");
            }
        }
    };

    const clearLogs = async () => {
        try {
            await invoke('clear_log_file', { path: serverPath });
            setLogs([]);
            toast.success("Console logs cleared permanently");
        } catch (e) {
            console.error(e);
            setLogs([]);
            toast.error("Failed to clear backend logs: " + e);
        }
        setAutoScroll(true);
    };

    const downloadLogs = () => {
        try {
            const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `server-logs-${new Date().toISOString().split('T')[0]}.log`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Logs downloaded");
        } catch (e) {
            toast.error("Failed to download logs");
        }
    };



    return (
        <div className="flex flex-col h-full bg-[#0d1117] rounded-xl overflow-hidden border border-border/50 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#161b22]">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
                        isRunning ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
                    )}>
                        <Terminal className={cn("w-4 h-4", isRunning ? "text-green-500" : "text-red-500")} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white leading-none">Console</h3>
                        <div className="text-[10px] text-text-muted font-mono mt-1 flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full border border-black", isRunning ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500")} />
                            {isRunning ? "Running" : "Offline"} • {logs.length} lines
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* IP Protection Display */}
                    {onToggleIp && ipAddress && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-black/20 rounded-lg border border-white/5 mr-2 group hover:border-white/10 transition-colors">
                            <div className="font-mono text-xs text-text-muted select-text">
                                {hideIp ? "***.***.***.***" : ipAddress}
                            </div>
                            <button
                                onClick={onToggleIp}
                                className="text-text-muted hover:text-white transition-colors"
                                title={hideIp ? "Show IP" : "Hide IP"}
                            >
                                {hideIp ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    )}

                    <div className="h-4 w-px bg-white/10 mx-1 hidden md:block" />

                    <button
                        onClick={() => setShowSearch(!showSearch)}
                        className={cn("p-2 rounded-lg transition-colors", showSearch ? "bg-primary/20 text-primary" : "hover:bg-white/5 text-text-muted hover:text-white")}
                        title="Search Logs"
                    >
                        <Search className="w-4 h-4" />
                    </button>

                    <button
                        onClick={downloadLogs}
                        className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors"
                        title="Download Logs"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    <button
                        onClick={clearLogs}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                        title="Clear Console"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Auto-Scroll Toggle */}
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={cn(
                            "p-2 rounded-lg transition-colors flex items-center gap-1",
                            autoScroll ? "bg-primary/20 text-primary" : "hover:bg-white/5 text-text-muted hover:text-white"
                        )}
                        title={autoScroll ? "Auto-Scroll: ON" : "Auto-Scroll: OFF"}
                    >
                        <ScrollText className="w-4 h-4" />
                    </button>

                    {isRunning && (
                        <button
                            onClick={() => onSendCommand("stop")}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 ml-2"
                            title="Stop Server (Graceful)"
                        >
                            <Power className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="p-2 bg-black/40 border-b border-white/5 flex gap-2 animate-in slide-in-from-top-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Filter logs..."
                            className="w-full bg-[#0d1117] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-primary/50 outline-none placeholder:text-text-muted/50"
                            autoFocus
                        />
                    </div>
                    <button onClick={() => { setSearchTerm(""); setShowSearch(false); }} className="p-1.5 hover:bg-white/10 rounded text-text-muted hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Output Area - Independent scrollbar */}
            <div
                className="flex-1 bg-[#0a0a0a] p-4 font-mono text-sm overflow-y-auto overflow-x-hidden relative group selection:bg-primary/30"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#3b82f6 #0a0a0a' }}
                ref={consoleRef}
                onScroll={handleScroll}
            >
                {filteredLogs.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted/20 select-none pointer-events-none">
                        <Terminal className="w-16 h-16 opacity-10 mb-2" />
                        <p className="text-xs font-medium opacity-50">Waiting for logs...</p>
                    </div>
                )}

                {filteredLogs.map((log, i) => (
                    <div key={i} className="py-0.5 hover:bg-white/5 rounded px-2 -mx-2 leading-relaxed break-words whitespace-pre-wrap transition-colors">
                        <span className="text-white/10 select-none mr-3 text-[10px] tabular-nums inline-block w-8 text-right font-sans opacity-50 group-hover:opacity-100 transition-opacity">
                            {String(i + 1)}
                        </span>
                        <span className={cn(
                            "font-medium",
                            log.startsWith(">") ? "text-cyan-400 font-bold" :
                                log.includes("[Error]") || log.includes("ERROR") || log.includes("Fail") || log.includes("Exception") ? "text-red-400" :
                                    log.includes("[WARN]") || log.includes("WARN") ? "text-yellow-400" :
                                        log.includes("[INFO]") ? "text-blue-300" :
                                            log.includes("[Mineserver]") ? "text-primary font-bold" :
                                                log.includes("joined") ? "text-green-400" :
                                                    log.includes("left") ? "text-orange-400" :
                                                        "text-gray-300"
                        )}>
                            {log.replace(/\u001b\[[0-9;]*m/g, '')}
                        </span>
                    </div>
                ))}
                <div ref={consoleEndRef} />

                {/* Scroll to bottom button if user scrolled up */}
                {!autoScroll && (
                    <button
                        onClick={() => { setAutoScroll(true); if (consoleRef.current) consoleRef.current.scrollTo({ top: consoleRef.current.scrollHeight, behavior: 'smooth' }); }}
                        className="absolute bottom-4 right-4 bg-primary text-black rounded-full p-2 shadow-lg shadow-black/50 hover:bg-primary-hover transition-all animate-in fade-in zoom-in-95 duration-200"
                        title="Scroll to Bottom & Enable Auto-Scroll"
                    >
                        <ArrowDown className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Command Input Area */}
            <form onSubmit={handleSend} className="p-3 bg-[#161b22] border-t border-white/10 relative z-10">
                <div className="relative flex items-center gap-2">
                    <div className={cn(
                        "absolute left-3 font-bold font-mono text-lg select-none transition-colors",
                        isRunning ? "text-primary" : "text-text-muted"
                    )}>›</div>
                    <input
                        type="text"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isRunning ? "Type a command or /help..." : "Start server to send commands"}
                        disabled={!isRunning}
                        className={cn(
                            "w-full bg-[#0d1117] border border-white/10 rounded-xl pl-8 pr-24 py-3 text-sm font-mono text-white placeholder:text-text-muted/50 outline-none transition-all shadow-inner",
                            isRunning ? "focus:border-primary/50 focus:ring-1 focus:ring-primary/20" : "opacity-50 cursor-not-allowed bg-black/40"
                        )}
                        spellCheck={false}
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                        <button
                            type="submit"
                            disabled={!isRunning || !commandInput.trim()}
                            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-black font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
