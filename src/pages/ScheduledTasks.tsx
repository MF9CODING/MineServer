import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Calendar, Clock, RefreshCw, Play, Pause, Trash2,
    Power, Database, Bell, Zap, CheckCircle
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/appStore';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface ScheduledTask {
    id: string;
    name: string;
    taskType: string;
    serverId: string;
    serverName: string;
    cronExpression: string;
    enabled: boolean;
    lastRun: string | null;
    command: string | null;
}

const taskTypes = [
    { id: 'restart', label: 'Auto Restart', icon: Power, color: 'text-orange-400 bg-orange-500/20' },
    { id: 'backup', label: 'Auto Backup', icon: Database, color: 'text-blue-400 bg-blue-500/20' },
    { id: 'command', label: 'Run Command', icon: Zap, color: 'text-purple-400 bg-purple-500/20' },
    { id: 'notification', label: 'Notification', icon: Bell, color: 'text-green-400 bg-green-500/20' },
];

export function ScheduledTasks() {
    const { servers } = useAppStore();
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        setIsLoading(true);
        try {
            const result = await invoke<ScheduledTask[]>('load_scheduled_tasks');
            setTasks(result);
        } catch (e) {
            console.error('Failed to load tasks:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveTasks = async (newTasks: ScheduledTask[]) => {
        try {
            await invoke('save_scheduled_tasks', { tasks: newTasks });
            setTasks(newTasks);
        } catch (e) {
            toast.error('Failed to save tasks: ' + e);
        }
    };



    const toggleTask = (id: string) => {
        const newTasks = tasks.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t);
        saveTasks(newTasks);
        const task = tasks.find(t => t.id === id);
        toast.success(`Task ${task?.enabled ? 'disabled' : 'enabled'}`);
    };

    const deleteTask = (id: string) => {
        if (!confirm("Delete this scheduled task?")) return;
        const newTasks = tasks.filter(t => t.id !== id);
        saveTasks(newTasks);
        toast.success("Task deleted");
    };

    const getTypeInfo = (type: string) => {
        return taskTypes.find(t => t.id === type) || taskTypes[0];
    };

    const enabledCount = tasks.filter(t => t.enabled).length;

    const [showModal, setShowModal] = useState(false);

    // Form States
    const [selectedType, setSelectedType] = useState('restart');
    const [selectedServerId, setSelectedServerId] = useState('');
    const [customCommand, setCustomCommand] = useState('');
    const [taskName, setTaskName] = useState('');
    const [cronValue, setCronValue] = useState('Every day at 4:00 AM');
    const [notifyOnRun, setNotifyOnRun] = useState(false);

    const openCreateModal = (type: string) => {
        if (servers.length === 0) {
            toast.error("Create a server first!");
            return;
        }
        setSelectedType(type);
        setSelectedServerId(servers[0].id);
        setCustomCommand(type === 'command' ? 'say Hello World' : '');
        setTaskName(`${taskTypes.find(t => t.id === type)?.label} Task`);
        setCronValue(type === 'backup' ? 'Every hour' : 'Every day at 4:00 AM');
        setNotifyOnRun(true);
        setShowModal(true);
    };

    const handleSaveTask = () => {
        const server = servers.find(s => s.id === selectedServerId);
        if (!server) return;

        const newTask: ScheduledTask = {
            id: Date.now().toString(),
            name: taskName,
            taskType: selectedType,
            serverId: server.id,
            serverName: server.name,
            cronExpression: cronValue,
            enabled: true,
            lastRun: null,
            command: selectedType === 'command' ? customCommand : null,
            // @ts-ignore - Adding notify prop dynamically if backend supports it or just for UI
            notifyOnRun: notifyOnRun
        };

        const newTasks = [...tasks, newTask];
        saveTasks(newTasks);
        setShowModal(false);
        toast.success("Scheduled Task Saved!");
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Calendar className="w-7 h-7 text-primary" />
                        Scheduled Tasks
                    </h1>
                    <p className="text-text-muted text-sm mt-1">Automate server restarts, backups, and more</p>
                </div>
                <button onClick={loadTasks} className="p-2 hover:bg-surface rounded-lg transition-colors">
                    <RefreshCw className={cn("w-5 h-5 text-text-muted", isLoading && "animate-spin")} />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{tasks.length}</p>
                            <p className="text-xs text-text-muted">Total Tasks</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{enabledCount}</p>
                            <p className="text-xs text-text-muted">Active Tasks</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <Power className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{tasks.filter(t => t.taskType === 'restart').length}</p>
                            <p className="text-xs text-text-muted">Auto Restarts</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Database className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{tasks.filter(t => t.taskType === 'backup').length}</p>
                            <p className="text-xs text-text-muted">Auto Backups</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Task Types Quick Create */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {taskTypes.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => openCreateModal(type.id)}
                        className="glass-card p-4 flex items-center gap-3 hover:border-primary/30 transition-colors group"
                    >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", type.color)}>
                            <type.icon className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-white text-sm group-hover:text-primary transition-colors">{type.label}</p>
                            <p className="text-[10px] text-text-muted">+ Create</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* Task List */}
            <div>
                <h2 className="text-lg font-bold text-white mb-4">All Tasks</h2>
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="glass-card p-12 text-center">
                            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
                            <p className="text-text-muted">Loading tasks...</p>
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="glass-card p-12 text-center">
                            <Calendar className="w-16 h-16 text-text-muted/30 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">No Scheduled Tasks</h3>
                            <p className="text-sm text-text-muted">Click a task type above to create your first task!</p>
                        </div>
                    ) : (
                        tasks.map((task) => {
                            const typeInfo = getTypeInfo(task.taskType);
                            return (
                                <div key={task.id} className={cn(
                                    "glass-card p-4 flex items-center gap-4 group transition-all",
                                    task.enabled ? "hover:border-primary/30" : "opacity-60"
                                )}>
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", typeInfo.color)}>
                                        <typeInfo.icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-white truncate">{task.name}</h4>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-surface border border-border text-text-muted">
                                                {task.serverName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-text-muted">
                                            <span className="flex items-center gap-1">
                                                <RefreshCw className="w-3 h-3" />
                                                {task.cronExpression}
                                            </span>
                                            {task.lastRun && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Last: {new Date(task.lastRun).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => toggleTask(task.id)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all",
                                                task.enabled
                                                    ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                    : "bg-surface text-text-muted hover:text-white"
                                            )}
                                        >
                                            {task.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                            {task.enabled ? 'Pause' : 'Enable'}
                                        </button>
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="p-2 rounded-lg hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Task Configuration Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#161b22] border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                            <span className={cn("p-2 rounded-lg bg-surface", getTypeInfo(selectedType).color)}>
                                {(() => {
                                    const Icon = getTypeInfo(selectedType).icon;
                                    return <Icon className="w-5 h-5" />;
                                })()}
                            </span>
                            Configure {getTypeInfo(selectedType).label}
                        </h2>

                        <div className="space-y-5">
                            {/* Task Name */}
                            <div>
                                <label className="text-sm font-medium text-text-muted mb-1 block">Task Name</label>
                                <input
                                    value={taskName}
                                    onChange={(e) => setTaskName(e.target.value)}
                                    className="w-full bg-black/20 border border-border rounded-lg px-3 py-2.5 text-white focus:border-primary outline-none"
                                />
                            </div>

                            {/* Target Server */}
                            <div>
                                <label className="text-sm font-medium text-text-muted mb-1 block">Target Server</label>
                                <select
                                    value={selectedServerId}
                                    onChange={(e) => setSelectedServerId(e.target.value)}
                                    className="w-full bg-black/20 border border-border rounded-lg px-3 py-2.5 text-white focus:border-primary outline-none"
                                >
                                    {servers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Command Input (Only for Command Type) */}
                            {selectedType === 'command' && (
                                <div>
                                    <label className="text-sm font-medium text-text-muted mb-1 block">Command to Run</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-mono text-xs">/</div>
                                        <input
                                            value={customCommand}
                                            onChange={(e) => setCustomCommand(e.target.value)}
                                            placeholder="say Hello World"
                                            className="w-full bg-black/20 border border-border rounded-lg pl-6 pr-3 py-2.5 text-white focus:border-primary outline-none font-mono text-sm"
                                        />
                                    </div>
                                    <p className="text-xs text-text-muted mt-1">Command will be executed as console.</p>
                                </div>
                            )}

                            {/* Schedule / Frequency */}
                            <div>
                                <label className="text-sm font-medium text-text-muted mb-1 block">Frequency / Schedule</label>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {['Every hour', 'Every 6 hours', 'Every 12 hours', 'Every day at 4:00 AM', 'Every Week'].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setCronValue(opt)}
                                            className={cn(
                                                "px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left",
                                                cronValue === opt
                                                    ? "bg-primary/20 border-primary text-primary"
                                                    : "bg-surface border-border text-text-muted hover:text-white"
                                            )}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    value={cronValue}
                                    onChange={(e) => setCronValue(e.target.value)}
                                    placeholder="Custom Cron (e.g. 0 4 * * *)"
                                    className="w-full bg-black/20 border border-border rounded-lg px-3 py-2.5 text-white focus:border-primary outline-none text-sm"
                                />
                            </div>

                            {/* Notifications Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg", notifyOnRun ? "bg-green-500/20 text-green-400" : "bg-white/5 text-text-muted")}>
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">Send Notification</p>
                                        <p className="text-xs text-text-muted">Notify me when this task completes</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setNotifyOnRun(!notifyOnRun)}
                                    className={cn("w-10 h-6 rounded-full transition-colors relative", notifyOnRun ? "bg-primary" : "bg-white/10")}
                                >
                                    <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", notifyOnRun ? "left-5" : "left-1")} />
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4 border-t border-border/50">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-border text-white hover:bg-surface-hover transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTask}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-black font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                                >
                                    Save Task
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
