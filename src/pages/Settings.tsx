import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../stores/appStore';
import {
    Settings as SettingsIcon,
    Monitor,
    Globe,
    Palette,
    Database,
    Info,
    ChevronRight,
    RotateCcw,
    Save,
    Check,
    ExternalLink,
    Github,
    MessageCircle,
    Download,
    Sparkles,
} from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const sections = [
    { id: 'general', icon: SettingsIcon, label: 'General', desc: 'App behavior' },
    { id: 'java', icon: Monitor, label: 'Java', desc: 'Runtime settings' },
    { id: 'network', icon: Globe, label: 'Network', desc: 'Ports & tunneling' },
    { id: 'appearance', icon: Palette, label: 'Appearance', desc: 'Colors & style' },
    { id: 'backups', icon: Database, label: 'Backups', desc: 'Auto-save worlds' },
    { id: 'about', icon: Info, label: 'About', desc: 'Version info' },
];

const accentColors = [
    { id: 'green', color: '#22c55e', label: 'Green' },
    { id: 'blue', color: '#3b82f6', label: 'Blue' },
    { id: 'purple', color: '#a855f7', label: 'Purple' },
    { id: 'orange', color: '#f97316', label: 'Orange' },
    { id: 'pink', color: '#ec4899', label: 'Pink' },
    { id: 'cyan', color: '#06b6d4', label: 'Cyan' },
];

function ToggleSetting({ label, description, value, onChange }: {
    label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-surface/50 border border-border/30 hover:border-border/50 transition-colors">
            <div>
                <h4 className="font-medium text-white">{label}</h4>
                <p className="text-xs text-text-muted mt-0.5">{description}</p>
            </div>
            <button
                onClick={() => onChange(!value)}
                className={cn(
                    "relative w-12 h-6 rounded-full transition-all duration-300",
                    value ? "bg-primary shadow-lg shadow-primary/30" : "bg-border"
                )}
            >
                <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md",
                    value ? "left-7" : "left-1"
                )} />
            </button>
        </div>
    );
}

function InputSetting({ label, description, value, onChange, type = 'text', placeholder }: {
    label: string; description: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
    return (
        <div className="p-4 rounded-xl bg-surface/50 border border-border/30">
            <h4 className="font-medium text-white mb-1">{label}</h4>
            <p className="text-xs text-text-muted mb-3">{description}</p>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none transition-colors"
            />
        </div>
    );
}

function SliderSetting({ label, description, value, onChange, min, max, step, unit }: {
    label: string; description: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string;
}) {
    return (
        <div className="p-4 rounded-xl bg-surface/50 border border-border/30">
            <div className="flex justify-between mb-1">
                <h4 className="font-medium text-white">{label}</h4>
                <span className="text-primary font-bold">{value} {unit}</span>
            </div>
            <p className="text-xs text-text-muted mb-3">{description}</p>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-text-muted mt-1">
                <span>{min} {unit}</span>
                <span>{max} {unit}</span>
            </div>
        </div>
    );
}

export function Settings() {
    const { streamerMode, toggleStreamerMode, settings, setSettings } = useAppStore();
    const [activeSection, setActiveSection] = useState('general');
    const [saved, setSaved] = useState(false);

    // Removed local settings state, using useAppStore directly

    const [checkingUpdate, setCheckingUpdate] = useState(false);

    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);
        try {
            const update = await check();
            if (update) {
                toast.message(`Update Available: v${update.version}`, {
                    description: `A new version is available. Install now?`,
                    action: {
                        label: 'Install & Restart',
                        onClick: async () => {
                            let toastId = toast.loading("Downloading update...");
                            try {
                                await update.downloadAndInstall();
                                toast.dismiss(toastId);
                                toast.success("Update installed! Restarting...");
                                await relaunch();
                            } catch (e) {
                                toast.error("Update failed: " + e);
                            }
                        }
                    }
                });
            } else {
                toast.success("You are on the latest version.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to check for updates: " + e);
        } finally {
            setCheckingUpdate(false);
        }
    };

    const handleChange = (key: string, value: any) => {
        setSettings({ [key]: value });
        setSaved(false);
    };

    const handleSave = () => {
        // TODO: Persist settings to file
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-6 h-full p-6">
            {/* Sidebar */}
            <div className="w-60 shrink-0">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                    <p className="text-xs text-text-muted">Configure Mineserver</p>
                </div>
                <nav className="space-y-1">
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                                activeSection === section.id
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "text-text-muted hover:bg-surface/50 hover:text-white"
                            )}
                        >
                            <section.icon className="w-5 h-5" />
                            <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm block">{section.label}</span>
                                <span className="text-[10px] opacity-60">{section.desc}</span>
                            </div>
                            {activeSection === section.id && <ChevronRight className="w-4 h-4" />}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="flex-1 bg-surface/30 border border-border/50 rounded-2xl p-6 overflow-y-auto">
                {activeSection === 'general' && (
                    <div className="space-y-4">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-white">General Settings</h3>
                            <p className="text-xs text-text-muted">Application behavior and defaults</p>
                        </div>
                        <ToggleSetting label="Start with Windows" description="Launch Mineserver when your PC starts" value={settings.startWithWindows} onChange={(v) => handleChange('startWithWindows', v)} />
                        <ToggleSetting label="Minimize to System Tray" description="Keep running in background when closed" value={settings.minimizeToTray} onChange={(v) => handleChange('minimizeToTray', v)} />
                        <ToggleSetting label="Check for Updates" description="Automatically check for new versions" value={settings.checkUpdates} onChange={(v) => handleChange('checkUpdates', v)} />
                        <ToggleSetting label="Confirm Before Stopping" description="Show confirmation dialog before stopping servers" value={settings.confirmBeforeStop} onChange={(v) => handleChange('confirmBeforeStop', v)} />
                        <ToggleSetting label="Auto-Stop on Exit" description="Stop all running servers when closing the app" value={settings.autoStopOnExit} onChange={(v) => handleChange('autoStopOnExit', v)} />
                        <InputSetting label="Default Server Location" description="Where new servers are created by default" value={settings.defaultServerPath} onChange={(v) => handleChange('defaultServerPath', v)} placeholder="C:\Mineserver\Servers" />
                    </div>
                )}

                {activeSection === 'java' && (
                    <div className="space-y-4">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-white">Java Configuration</h3>
                            <p className="text-xs text-text-muted">Runtime settings for your servers</p>
                        </div>
                        <ToggleSetting label="Auto-Detect Java" description="Automatically find Java installations on your system" value={settings.autoDetectJava} onChange={(v) => handleChange('autoDetectJava', v)} />
                        <SliderSetting
                            label="Default RAM Allocation"
                            description="Amount of memory allocated to new servers"
                            value={settings.defaultRam}
                            onChange={(v) => handleChange('defaultRam', v)}
                            min={1} max={16} step={1} unit="GB"
                        />
                        <InputSetting
                            label="Default JVM Arguments"
                            description="Java flags for performance optimization"
                            value={settings.jvmArgs}
                            onChange={(v) => handleChange('jvmArgs', v)}
                        />
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <div className="flex items-center gap-3">
                                <Download className="w-5 h-5 text-blue-400" />
                                <div className="flex-1">
                                    <h4 className="font-medium text-blue-400">Need Java?</h4>
                                    <p className="text-xs text-text-muted">Download and install the recommended JDK</p>
                                </div>
                                <a href="https://adoptium.net" target="_blank" rel="noreferrer" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                                    <ExternalLink className="w-3 h-3" />
                                    Download
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'network' && (
                    <div className="space-y-4">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-white">Network Settings</h3>
                            <p className="text-xs text-text-muted">Port forwarding and public access</p>
                        </div>
                        <ToggleSetting label="Auto Port Forward (UPnP)" description="Automatically configure your router for public access" value={settings.autoPortForward} onChange={(v) => handleChange('autoPortForward', v)} />
                        <ToggleSetting label="Playit.gg Fallback" description="Use tunneling service if UPnP fails" value={settings.playitEnabled} onChange={(v) => handleChange('playitEnabled', v)} />
                        <SliderSetting
                            label="Default Minecraft Port"
                            description="Port number for new servers"
                            value={settings.defaultPort}
                            onChange={(v) => handleChange('defaultPort', v)}
                            min={25565} max={25600} step={1} unit=""
                        />
                    </div>
                )}

                {activeSection === 'appearance' && (
                    <div className="space-y-4">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-white">Appearance</h3>
                            <p className="text-xs text-text-muted">Customize the look and feel</p>
                        </div>

                        <div className="p-4 rounded-xl bg-surface/50 border border-border/30">
                            <h4 className="font-medium text-white mb-3">Accent Color</h4>
                            <div className="grid grid-cols-6 gap-3">
                                {accentColors.map((color) => (
                                    <button
                                        key={color.id}
                                        onClick={() => handleChange('accentColor', color.id)}
                                        className={cn(
                                            "aspect-square rounded-xl transition-all flex items-center justify-center",
                                            settings.accentColor === color.id
                                                ? "ring-2 ring-offset-2 ring-offset-[#0d1117] scale-110"
                                                : "hover:scale-105"
                                        )}
                                        style={{
                                            backgroundColor: color.color
                                        }}
                                        title={color.label}
                                    >
                                        {settings.accentColor === color.id && <Check className="w-5 h-5 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ToggleSetting label="Enable Animations" description="Smooth transitions and effects throughout the app" value={settings.animations} onChange={(v) => handleChange('animations', v)} />
                        <ToggleSetting label="Compact Mode" description="Smaller UI elements for more screen space" value={settings.compactMode} onChange={(v) => handleChange('compactMode', v)} />

                        <div className="pt-4 border-t border-border/30">
                            <ToggleSetting
                                label="Streamer Mode"
                                description="Hides all IP addresses (Local & Public) for privacy while broadcasting"
                                value={streamerMode}
                                onChange={toggleStreamerMode}
                            />
                        </div>
                    </div>
                )}

                {activeSection === 'backups' && (
                    <div className="space-y-4">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-white">Backup Settings</h3>
                            <p className="text-xs text-text-muted">Keep your worlds safe</p>
                        </div>
                        <ToggleSetting label="Enable Auto-Backup" description="Automatically backup worlds while servers are running" value={settings.autoBackup} onChange={(v) => handleChange('autoBackup', v)} />
                        <ToggleSetting label="Backup Before Updates" description="Create a backup before updating server software" value={settings.backupBeforeUpdate} onChange={(v) => handleChange('backupBeforeUpdate', v)} />
                        <SliderSetting
                            label="Backup Interval"
                            description="How often to create automatic backups"
                            value={settings.backupInterval}
                            onChange={(v) => handleChange('backupInterval', v)}
                            min={15} max={120} step={15} unit="min"
                        />
                        <SliderSetting
                            label="Max Backups to Keep"
                            description="Older backups will be automatically deleted"
                            value={settings.maxBackups}
                            onChange={(v) => handleChange('maxBackups', v)}
                            min={1} max={20} step={1} unit=""
                        />
                        <InputSetting label="Backup Location" description="Where backup files are stored" value={settings.backupPath} onChange={(v) => handleChange('backupPath', v)} placeholder="C:\Mineserver\Backups" />
                    </div>
                )}

                {activeSection === 'about' && (
                    <div className="space-y-6">
                        <div className="text-center py-8">
                            <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-2xl shadow-primary/30">
                                <Sparkles className="w-12 h-12 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Mineserver</h3>
                            <p className="text-text-muted mt-1">Version 1.0.0</p>
                            <p className="text-xs text-text-muted mt-2">The Ultimate Minecraft Server Manager</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <a href="https://github.com/MF9CODING/MineServer" target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface/50 border border-border/30 hover:border-primary/30 transition-colors">
                                <Github className="w-6 h-6 text-white" />
                                <span className="text-sm text-text-muted">GitHub</span>
                            </a>
                            <button
                                onClick={() => toast.info("Discord Community Coming Soon!", { description: "Join us later for support and giveaways." })}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface/50 border border-border/30 hover:border-primary/30 transition-colors"
                            >
                                <MessageCircle className="w-6 h-6 text-indigo-400" />
                                <span className="text-sm text-text-muted">Discord</span>
                            </button>
                            <button
                                onClick={handleCheckUpdate}
                                disabled={checkingUpdate}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface/50 border border-border/30 hover:border-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                            >
                                <Download className={cn("w-6 h-6 text-blue-400", checkingUpdate && "animate-bounce")} />
                                <span className="text-sm text-text-muted">
                                    {checkingUpdate ? "Checking..." : "Check Updates"}
                                </span>
                            </button>
                        </div>

                        <div className="p-4 rounded-xl bg-surface/50 border border-border/30 text-center">
                            <p className="text-xs text-text-muted">Made with ❤️ for the Minecraft community</p>
                            <p className="text-[10px] text-text-muted mt-1">© 2024 Mineserver. All rights reserved.</p>
                        </div>
                    </div>
                )}

                {/* Save/Reset Buttons */}
                {activeSection !== 'about' && (
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border/30">
                        <button className="px-4 py-2 rounded-lg bg-surface border border-border text-text-muted hover:text-white hover:border-white/20 transition-colors flex items-center gap-2 text-sm">
                            <RotateCcw className="w-4 h-4" />
                            Reset to Defaults
                        </button>
                        <button
                            onClick={handleSave}
                            className={cn(
                                "px-5 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
                                saved
                                    ? "bg-green-500 text-white"
                                    : "bg-primary hover:bg-primary-hover text-black"
                            )}
                        >
                            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {saved ? "Saved!" : "Save Changes"}
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
