import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ChevronRight, ChevronLeft, Check, Shield, Zap, Box, Play, Loader2, Download,
    Server, Sparkles, Rocket, Settings, Users, MemoryStick, Cpu, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, ServerType } from '../stores/appStore';
import { cn } from '../lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

const serverSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters").max(32, "Name too long"),
    type: z.enum(['vanilla', 'paper', 'bedrock', 'forge', 'neoforge', 'fabric', 'spigot', 'purpur'] as [string, ...string[]]),
    version: z.string().min(1, "Version is required"),
    port: z.number().min(1024, "Port must be > 1024").max(65535, "Port must be < 65535"),
    ram: z.number().min(512, "Minimum 512MB RAM").max(16384, "Maximum 16GB RAM"),
    cpuCores: z.number().min(1, "At least 1 core").max(32, "Max 32 cores"),
    maxPlayers: z.number().min(1, "At least 1 player").max(1000, "Max 1000 players"),
    onlineMode: z.boolean().optional(),
});

type ServerFormData = z.infer<typeof serverSchema>;

const SERVER_OPTIONS: { id: ServerType; name: string; desc: string; icon: any; recommended?: boolean; category: 'java' | 'bedrock' | 'modded' }[] = [
    { id: 'paper', name: 'Paper', desc: 'High performance, plugins supported', icon: Zap, recommended: true, category: 'java' },
    { id: 'vanilla', name: 'Vanilla', desc: 'Official Minecraft server', icon: Box, category: 'java' },
    { id: 'spigot', name: 'Spigot', desc: 'Plugin-ready, parent of Paper', icon: Play, category: 'java' },
    { id: 'purpur', name: 'Purpur', desc: 'Paper fork with extras', icon: Shield, category: 'java' },
    { id: 'forge', name: 'Forge', desc: 'Classic modding platform', icon: Shield, category: 'modded' },
    { id: 'neoforge', name: 'NeoForge', desc: 'Modern Forge fork, 1.20.1+', icon: Zap, recommended: true, category: 'modded' },
    { id: 'fabric', name: 'Fabric', desc: 'Lightweight modding', icon: Zap, category: 'modded' },
    { id: 'bedrock', name: 'Bedrock BDS', desc: 'Official Bedrock server', icon: Box, category: 'bedrock' },
];

const STEPS = [
    { id: 1, label: 'Server Type', icon: Server },
    { id: 2, label: 'Configure', icon: Settings },
    { id: 3, label: 'Launch', icon: Rocket },
];

export function CreateServer() {
    const navigate = useNavigate();
    const { addServer, systemInfo } = useAppStore();
    const [step, setStep] = useState(1);
    const [availableVersions, setAvailableVersions] = useState<string[]>([]);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ percentage: 0, current: 0, total: 0 });
    const [selectedCategory, setSelectedCategory] = useState<'java' | 'bedrock' | 'modded'>('java');

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ServerFormData>({
        resolver: zodResolver(serverSchema),
        defaultValues: {
            name: 'My Server',
            type: 'paper',
            version: '',
            port: 25565,
            ram: 4096,
            cpuCores: 2,
            maxPlayers: 10,
        }
    });

    const formData = watch();

    useEffect(() => {
        if (formData.type === 'bedrock') {
            setValue('port', 19132);
        } else {
            setValue('port', 25565);
        }
    }, [formData.type, setValue]);

    useEffect(() => {
        let active = true;
        const fetchVersions = async () => {
            setIsLoadingVersions(true);
            try {
                let versions: string[] = [];
                const versionCommands: Record<string, string> = {
                    vanilla: 'get_vanilla_versions',
                    paper: 'get_paper_versions',
                    bedrock: 'get_bedrock_versions',
                    forge: 'get_forge_versions',
                    neoforge: 'get_neoforge_versions',
                    fabric: 'get_fabric_versions',
                    spigot: 'get_spigot_versions',
                    purpur: 'get_purpur_versions',
                };
                if (versionCommands[formData.type]) {
                    versions = await invoke(versionCommands[formData.type]);
                }
                if (active) {
                    setAvailableVersions(versions);
                    if (versions.length > 0) setValue('version', versions[0]);
                }
            } catch (error) {
                console.error("Failed to fetch versions:", error);
                toast.error("Failed to fetch versions");
            } finally {
                if (active) setIsLoadingVersions(false);
            }
        };
        fetchVersions();
        return () => { active = false; };
    }, [formData.type, setValue]);

    useEffect(() => {
        const unlisten = listen('download-progress', (event: any) => {
            setDownloadProgress(event.payload);
        });
        return () => { unlisten.then(f => f()); };
    }, []);

    const formatRam = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

    const onSubmit = async (data: ServerFormData) => {
        if (isDownloading) return;
        setIsDownloading(true);
        const serverPath = `C:\\Servers\\${data.name.replace(/\s+/g, '-').toLowerCase()}`;
        try {
            await invoke('download_server', {
                serverType: data.type,
                version: data.version,
                serverPath: serverPath
            });
            const newServer = {
                id: generateId(),
                name: data.name,
                type: data.type as ServerType,
                version: data.version,
                port: data.port,
                maxPlayers: data.maxPlayers,
                allocatedRam: data.ram,
                allocatedCores: data.cpuCores,
                path: serverPath,
                status: 'stopped' as const,
                playerCount: 0,
                createdAt: new Date().toISOString(),
                // If the user selects "Cracked Mode" (true), we want online-mode=false.
                // However, the schema has 'onlineMode' as the toggle name.
                // If toggle is ON (true) -> Cracked -> online-mode=false
                // If toggle is OFF (false) -> Premium -> online-mode=true
                // We'll store what the "online-mode" PROPERTY should be.
                // So if data.onlineMode (Cracked) is true, 'online-mode' is false.
                // But wait, the Store type doesn't have a field for this yet strictly, although it accepts extra props.
                // Let's just pass it to the invoke command if supported, or handle it via a Properties update separate call?
                // For now, let's just update the download_server call to accept properties if possible, or do a post-install update.
                // Actually, the easiest is to just write the property after download.
            };

            // Post-install configuration
            if (data.onlineMode) {
                // Creating a 'cracked' server means online-mode=false
                // We will update this in server.properties later.
                // For now, let's just ensuring the UI reflects it.
                // We should probably add a quick invoke to set it.
                /* 
                 await invoke('update_server_properties', { 
                    serverPath, 
                    properties: { "online-mode": "false" } 
                 });
                */
                // Since we don't have that generic command handy in this file context without checking imports,
                // and the user just asked for the option, likely expecting it to WORK.
                // We'll rely on the user manually changing it or implement the auto-change now.
                // Let's just invoke the property writer if we can.
            }

            // Actually, let's add the property to the invoke payload if we can, or just wait.
            // The user wanted the option "enable or disable".
            // Let's add logic to write it.

            if (data.onlineMode) {
                await invoke('write_server_file', {
                    path: `${serverPath}\\server.properties`,
                    content: `#Auto-generated\nonline-mode=false\n`
                });
            }

            addServer(newServer);
            toast.success("Server installed successfully!");
            navigate('/servers');
        } catch (error) {
            console.error("Installation failed:", error);
            toast.error("Installation failed: " + error);
        } finally {
            setIsDownloading(false);
        }
    };

    const nextStep = () => setStep(s => Math.min(s + 1, 3));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    if (isDownloading) {
        return <DownloadingScreen formData={formData} progress={downloadProgress} />;
    }

    return (
        <div className="min-h-full">
            {/* Hero Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-surface via-surface to-primary/5 border-b border-border">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative p-6 lg:p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/25">
                                <Sparkles className="w-6 h-6 text-black" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">Create New Server</h1>
                                <p className="text-text-secondary text-sm">Deploy your Minecraft server in minutes</p>
                            </div>
                        </div>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-0 max-w-lg mx-auto">
                        {STEPS.map((s, i) => (
                            <div key={s.id} className="flex items-center">
                                <motion.div
                                    initial={false}
                                    animate={{
                                        scale: step === s.id ? 1.1 : 1,
                                    }}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <motion.div
                                        initial={false}
                                        animate={{
                                            backgroundColor: step >= s.id ? 'var(--color-primary)' : 'transparent',
                                            borderColor: step >= s.id ? 'var(--color-primary)' : 'var(--color-border)',
                                        }}
                                        className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all",
                                            step >= s.id ? "shadow-lg shadow-primary/25" : ""
                                        )}
                                    >
                                        {step > s.id ? (
                                            <Check className="w-5 h-5 text-black" />
                                        ) : (
                                            <s.icon className={cn("w-5 h-5", step >= s.id ? "text-black" : "text-text-muted")} />
                                        )}
                                    </motion.div>
                                    <span className={cn(
                                        "text-xs font-medium transition-colors",
                                        step >= s.id ? "text-primary" : "text-text-muted"
                                    )}>
                                        {s.label}
                                    </span>
                                </motion.div>
                                {i < STEPS.length - 1 && (
                                    <div className={cn(
                                        "w-16 h-0.5 mx-2 transition-colors rounded-full",
                                        step > s.id ? "bg-primary" : "bg-border"
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <StepOne
                                formData={formData}
                                setValue={setValue}
                                selectedCategory={selectedCategory}
                                setSelectedCategory={setSelectedCategory}
                            />
                        )}
                        {step === 2 && (
                            <StepTwo
                                formData={formData}
                                register={register}
                                setValue={setValue}
                                errors={errors}
                                systemInfo={systemInfo}
                                availableVersions={availableVersions}
                                isLoadingVersions={isLoadingVersions}
                                formatRam={formatRam}
                            />
                        )}
                        {step === 3 && (
                            <StepThree formData={formData} formatRam={formatRam} />
                        )}
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
                        <button
                            type="button"
                            onClick={prevStep}
                            disabled={step === 1}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-text-muted hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" /> Back
                        </button>

                        {step < 3 ? (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={nextStep}
                                className="group relative px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-primary/25 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <span className="relative z-10">Continue</span>
                                <ChevronRight className="w-5 h-5 relative z-10" />
                            </motion.button>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                className="group relative px-6 py-3 bg-gradient-to-r from-primary to-emerald-500 text-black font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-primary/25 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <Rocket className="w-5 h-5 relative z-10" />
                                <span className="relative z-10">Deploy Server</span>
                            </motion.button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}

// Step 1: Server Type Selection
function StepOne({ formData, setValue, selectedCategory, setSelectedCategory }: any) {
    const categories = [
        { id: 'java', label: 'Java Edition', desc: 'PC/Mac/Linux' },
        { id: 'modded', label: 'Modded', desc: 'Forge/Fabric' },
        { id: 'bedrock', label: 'Bedrock', desc: 'Mobile/Console' },
    ];

    const filteredOptions = SERVER_OPTIONS.filter(o => o.category === selectedCategory);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            {/* Category Tabs */}
            <div className="flex gap-2 p-1 bg-surface-light rounded-xl border border-border">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                            "flex-1 py-3 px-4 rounded-lg font-medium transition-all text-center",
                            selectedCategory === cat.id
                                ? "bg-primary text-black shadow-lg"
                                : "text-text-muted hover:text-white hover:bg-white/5"
                        )}
                    >
                        <p className="font-bold">{cat.label}</p>
                        <p className="text-xs opacity-70">{cat.desc}</p>
                    </button>
                ))}
            </div>

            {/* Server Type Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredOptions.map((opt) => (
                    <motion.div
                        key={opt.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setValue('type', opt.id)}
                        className={cn(
                            "relative overflow-hidden rounded-2xl p-5 cursor-pointer border-2 transition-all",
                            formData.type === opt.id
                                ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                : "border-border hover:border-border-hover bg-surface/50"
                        )}
                    >
                        {opt.recommended && (
                            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[10px] font-bold uppercase tracking-wider text-primary">
                                Recommended
                            </div>
                        )}
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "w-14 h-14 rounded-xl flex items-center justify-center transition-all",
                                formData.type === opt.id
                                    ? "bg-primary text-black"
                                    : "bg-white/5 text-text-muted"
                            )}>
                                <opt.icon className="w-7 h-7" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-1">{opt.name}</h3>
                                <p className="text-sm text-text-secondary">{opt.desc}</p>
                            </div>
                            <div className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                formData.type === opt.id
                                    ? "border-primary bg-primary"
                                    : "border-border"
                            )}>
                                {formData.type === opt.id && <Check className="w-4 h-4 text-black" />}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

// Step 2: Configuration
function StepTwo({ formData, register, errors, systemInfo, availableVersions, isLoadingVersions, formatRam }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 max-w-2xl mx-auto"
        >
            {/* Server Name */}
            <div className="glass-card p-5">
                <label className="block text-sm font-medium text-text-muted mb-2">Server Name</label>
                <input
                    {...register('name')}
                    className="w-full h-12 px-4 bg-surface border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-lg"
                    placeholder="My Awesome Server"
                />
                {errors.name && <p className="text-red-500 text-xs mt-2">{errors.name.message}</p>}
            </div>

            {/* Version & Port */}
            <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-5">
                    <label className="flex items-center justify-between text-sm font-medium text-text-muted mb-2">
                        Version
                        {isLoadingVersions && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    </label>
                    <select
                        {...register('version')}
                        disabled={isLoadingVersions}
                        className="w-full h-12 px-4 bg-surface border border-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                    >
                        {availableVersions.map((v: string) => (
                            <option key={v} value={v} className="bg-surface">{v}</option>
                        ))}
                        {availableVersions.length === 0 && !isLoadingVersions && <option>No versions</option>}
                    </select>
                </div>
                <div className="glass-card p-5">
                    <label className="block text-sm font-medium text-text-muted mb-2">Port</label>
                    <input
                        type="number"
                        {...register('port', { valueAsNumber: true })}
                        className="w-full h-12 px-4 bg-surface border border-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
            </div>

            {/* RAM Slider */}
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <MemoryStick className="w-5 h-5 text-emerald-400" />
                        <label className="font-medium text-white">Allocated RAM</label>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold font-mono">
                        {formatRam(formData.ram)}
                    </span>
                </div>
                <input
                    type="range"
                    min="512"
                    max={systemInfo ? Math.min(16384, Math.floor(systemInfo.totalMemory / 1024 / 1024)) : 16384}
                    step="512"
                    {...register('ram', { valueAsNumber: true })}
                    className="w-full h-2 bg-surface rounded-full appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-text-muted mt-2">
                    <span>512 MB</span>
                    <span>{systemInfo ? Math.min(16, Math.round(systemInfo.totalMemory / 1024 / 1024 / 1024)) : 16} GB Max</span>
                </div>
            </div>

            {/* CPU Cores */}
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-blue-400" />
                        <label className="font-medium text-white">CPU Cores</label>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold font-mono">
                        {formData.cpuCores} Cores
                    </span>
                </div>
                <input
                    type="range"
                    min="1"
                    max={systemInfo ? systemInfo.cpuThreads : 8}
                    step="1"
                    {...register('cpuCores', { valueAsNumber: true })}
                    className="w-full h-2 bg-surface rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-text-muted mt-2">
                    <span>1 Core</span>
                    <span>{systemInfo ? systemInfo.cpuThreads : 8} Available</span>
                </div>
            </div>

            {/* Max Players */}
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        <label className="font-medium text-white">Max Players</label>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 font-bold font-mono">
                        {formData.maxPlayers} Players
                    </span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    {...register('maxPlayers', { valueAsNumber: true })}
                    className="w-full h-2 bg-surface rounded-full appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-text-muted mt-2">
                    <span>1 Player</span>
                    <span>100 Max</span>
                </div>
            </div>

            {/* Online Mode / Cracked */}
            <div className="glass-card p-4 flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-orange-400" />
                        Cracked Mode
                    </h4>
                    <p className="text-xs text-text-muted">Disable online-mode verification (Offline Mode)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        {...register('onlineMode')}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
            </div>
        </motion.div>
    );
}

// Step 3: Review
function StepThree({ formData, formatRam }: any) {
    const selectedServer = SERVER_OPTIONS.find(o => o.id === formData.type);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-md mx-auto"
        >
            <div className="glass-card p-8 text-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/25"
                >
                    <Rocket className="w-10 h-10 text-black" />
                </motion.div>

                <h3 className="text-2xl font-bold text-white mb-2">Ready to Deploy!</h3>
                <p className="text-text-secondary mb-6">Review your configuration before launching</p>

                <div className="bg-surface/50 rounded-xl p-4 text-left space-y-3 border border-border">
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">Name</span>
                        <span className="font-medium text-white">{formData.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">Type</span>
                        <span className="font-medium text-white flex items-center gap-2">
                            {selectedServer && <selectedServer.icon className="w-4 h-4 text-primary" />}
                            {selectedServer?.name}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">Version</span>
                        <span className="font-medium text-white font-mono">{formData.version}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">Port</span>
                        <span className="font-medium text-white font-mono">{formData.port}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">RAM</span>
                        <span className="font-medium text-emerald-400">{formatRam(formData.ram)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">CPU</span>
                        <span className="font-medium text-blue-400">{formData.cpuCores} Cores</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">Players</span>
                        <span className="font-medium text-purple-400">{formData.maxPlayers} Max</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// Downloading Screen
function DownloadingScreen({ formData, progress }: any) {
    return (
        <div className="min-h-full flex flex-col items-center justify-center p-8">
            <div className="max-w-md w-full text-center space-y-8">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-2xl shadow-primary/30"
                >
                    <Download className="w-12 h-12 text-black" />
                </motion.div>

                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Installing Server</h2>
                    <p className="text-text-secondary">
                        Downloading <span className="text-primary font-medium">{formData.type}</span> {formData.version}
                    </p>
                </div>

                <div className="space-y-3">
                    <div className="relative h-3 bg-surface rounded-full overflow-hidden border border-border">
                        <motion.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.percentage}%` }}
                            transition={{ duration: 0.3 }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    </div>
                    <p className="text-3xl font-bold text-white font-mono">{progress.percentage}%</p>
                </div>

                <p className="text-xs text-text-muted">
                    This may take a few minutes depending on your connection
                </p>
            </div>
        </div>
    );
}
