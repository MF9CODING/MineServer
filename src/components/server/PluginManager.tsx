import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Server } from '../../stores/appStore';
import { toast } from 'sonner';
import { Search, Download, RefreshCw, X, ChevronLeft, ChevronRight, ExternalLink, Puzzle, Sparkles, Trash2, Star, Shield, Gamepad2, Wrench, MessageSquare, Zap } from "lucide-react";
import { cn } from '../../lib/utils';

interface PluginManagerProps {
    server: Server;
}

interface PluginResult {
    id: string;
    slug: string;
    title: string;
    description: string;
    downloads: number;
    icon_url: string | null;
    source: 'modrinth' | 'hangar' | 'spigot' | 'polymart' | 'poggit';
}

interface VersionInfo {
    id: string;
    name: string;
    gameVersions: string[];
    loaders: string[];
    downloadUrl: string;
    datePublished?: string;
    versionType?: string;
}

// Plugin sources for Java servers
const JAVA_SOURCES = [
    { id: 'modrinth', name: 'Modrinth', color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-500' },
    { id: 'hangar', name: 'Hangar', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500' },
    { id: 'spigot', name: 'SpigotMC', color: 'from-orange-500 to-amber-500', bgColor: 'bg-orange-500' },
    { id: 'polymart', name: 'Polymart', color: 'from-purple-500 to-indigo-500', bgColor: 'bg-purple-500' },
];

const CATEGORIES = [
    { id: 'popular', label: 'Trending', icon: Sparkles, query: '', color: 'from-yellow-500 to-orange-500' },
    { id: 'essentials', label: 'Essentials', icon: Star, query: 'essentials', color: 'from-blue-500 to-cyan-500' },
    { id: 'protection', label: 'Protection', icon: Shield, query: 'protection worldguard', color: 'from-green-500 to-emerald-500' },
    { id: 'games', label: 'Minigames', icon: Gamepad2, query: 'minigame bedwars', color: 'from-purple-500 to-pink-500' },
    { id: 'performance', label: 'Performance', icon: Zap, query: 'performance optimization lithium sodium ferrite', color: 'from-red-500 to-orange-500' },
    { id: 'economy', label: 'Economy', icon: Wrench, query: 'economy vault', color: 'from-amber-500 to-yellow-500' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, query: 'chat', color: 'from-indigo-500 to-blue-500' },
];

// Plugin Manager Interface
// Supports Store (Modrinth/Hangar/Spigot) and Installed Plugins

export function PluginManager({ server }: PluginManagerProps) {
    const [activeTab, setActiveTab] = useState<'store' | 'installed'>('store');

    // Store State
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('popular');
    const [activeSource, setActiveSource] = useState('modrinth');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);

    const [installedSearch, setInstalledSearch] = useState("");
    const [installedPlugins, setInstalledPlugins] = useState<{ name: string, filename: string, enabled: boolean, size: number }[]>([]);
    const [loadingInstalled, setLoadingInstalled] = useState(false);

    // Version selection modal
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [selectedPlugin, setSelectedPlugin] = useState<PluginResult | null>(null);
    const [versions, setVersions] = useState<VersionInfo[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    // Cache State for Background Loading
    const [cachedResults, setCachedResults] = useState<Record<string, { items: PluginResult[], total: number }>>({});
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    const pluginsPerPage = 20;

    // Helper to update specific result
    const updateCache = (source: string, items: PluginResult[], total: number) => {
        setCachedResults(prev => ({
            ...prev,
            [source]: { items, total }
        }));
    };

    // Load Installed Plugins
    const loadInstalled = async () => {
        setLoadingInstalled(true);
        try {
            const list = await invoke<{ name: string, filename: string, enabled: boolean, size: number }[]>('list_plugins', { serverPath: server.path });
            setInstalledPlugins(list);
        } catch (e) {
            toast.error("Failed to load installed plugins: " + e);
        } finally {
            setLoadingInstalled(false);
        }
    };

    // Initial Load - Fetch all sources in background
    useEffect(() => {
        if (activeTab === 'store') {
            // If cache is empty for a source, fetch it
            JAVA_SOURCES.forEach(source => {
                if (!cachedResults[source.id]) {
                    loadSourceData(source.id, searchQuery || (activeCategory === 'popular' ? '' : activeCategory), 1);
                }
            });
        } else {
            loadInstalled();
        }
    }, [activeTab]); // Run on mount/tab switch

    // When query/category changes, we only reload the ACTIVE source
    // (User expects search to apply to current view, not necessarily background ones immediately)
    // When query/category changes, we only reload the ACTIVE source
    useEffect(() => {
        if (activeTab === 'store') {
            const effectiveQuery = searchQuery || (activeCategory === 'popular' ? '' : activeCategory);
            const isStandardView = currentPage === 1 && !effectiveQuery;
            const hasCachedData = cachedResults[activeSource]?.items?.length > 0;

            if (isStandardView && hasCachedData) {
                return;
            }

            loadSourceData(activeSource, effectiveQuery, currentPage);
        }
    }, [activeSource, currentPage, activeCategory, searchQuery]);

    const loadSourceData = async (source: string, query: string, page: number) => {
        setLoadingStates(prev => ({ ...prev, [source]: true }));
        try {
            let results: PluginResult[] = [];
            let totalHits = 0;

            // Clean query logic
            const effectiveQuery = query.trim();

            if (source === 'modrinth') {
                interface PaginatedResult<T> { items: T[]; total: number; }
                const modrinthResults = await invoke<PaginatedResult<any>>('search_modrinth_plugins', {
                    query: effectiveQuery,
                    offset: (page - 1) * pluginsPerPage
                });

                results = modrinthResults.items.map((p: any) => ({
                    id: p.project_id,
                    slug: p.slug,
                    title: p.title,
                    description: p.description,
                    downloads: p.downloads,
                    icon_url: p.icon_url,
                    source: 'modrinth' as const
                }));
                totalHits = modrinthResults.total;
                setTotalPages(Math.ceil(totalHits / pluginsPerPage)); // Update UI pagination for active
            } else if (source === 'hangar') {
                results = await invoke<PluginResult[]>('search_hangar_plugins', { query: effectiveQuery });
                totalHits = results.length; // Hangar search is limited
            } else if (source === 'spigot') {
                results = await invoke<PluginResult[]>('search_spigot_plugins', { query: effectiveQuery, page: page });
                totalHits = 100; // Mock total for Spigot
            } else if (source === 'polymart') {
                results = await invoke<PluginResult[]>('search_polymart_plugins', { query: effectiveQuery || 'plugin', page: page });
                totalHits = 50; // Mock total for Polymart
            }

            updateCache(source, results, totalHits);

            // If this is the active source, ensure pagination state is correct
            if (source === activeSource) {
                // For Spigot/Others fixed pages
                if (source !== 'modrinth') setTotalPages(5);
            }

        } catch (e) {
            console.error(`Failed to load ${source}:`, e);
            updateCache(source, [], 0);
        } finally {
            setLoadingStates(prev => ({ ...prev, [source]: false }));
        }
    };

    // Derived state for UI
    const plugins = cachedResults[activeSource]?.items || [];
    const isLoading = loadingStates[activeSource] || false;

    const handleDeletePlugin = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
        try {
            await invoke('delete_plugin', { serverPath: server.path, filename });
            toast.success("Plugin deleted.");
            loadInstalled();
        } catch (e) {
            toast.error("Delete failed: " + e);
        }
    };

    const handleTogglePlugin = async (filename: string) => {
        try {
            await invoke('toggle_plugin', { serverPath: server.path, filename });
            loadInstalled();
            toast.success("Plugin status updated");
        } catch (e) {
            toast.error("Failed to toggle plugin: " + e);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // ... (Keep existing helpers: searchPlugins, handleCategoryClick, openVersionModal, installVersion, formatDownloads, getSourceUrl, renderPagination) ...
    // Since I'm replacing the whole component body, I need to include them.

    const searchPlugins = async (query?: string) => {
        const q = query ?? searchQuery;
        setActiveCategory('');
        setCurrentPage(1);
        loadSourceData(activeSource, q, 1);
    };

    const handleCategoryClick = (category: typeof CATEGORIES[0]) => {
        setActiveCategory(category.id);
        setSearchQuery(category.query);
        setCurrentPage(1);
        loadSourceData(activeSource, category.query, 1);
    };

    const openVersionModal = async (plugin: PluginResult) => {
        setSelectedPlugin(plugin);
        setShowVersionModal(true);
        setLoadingVersions(true);
        try {
            const versionData = await invoke<VersionInfo[]>('get_plugin_versions', {
                source: plugin.source,
                projectId: plugin.id,
                slug: plugin.slug
            });
            setVersions(versionData);
        } catch (e) {
            console.error('Failed to load versions:', e);
            setVersions([{
                id: 'latest', name: 'Latest', gameVersions: [server.version], loaders: ['paper'], downloadUrl: ''
            }]);
        } finally {
            setLoadingVersions(false);
        }
    };

    const installVersion = async (_version: VersionInfo) => {
        if (!selectedPlugin) return;
        setInstallingPlugin(selectedPlugin.id);
        setShowVersionModal(false);

        try {
            if (selectedPlugin.source === 'modrinth') {
                if (['fabric', 'forge'].includes(server.type)) {
                    await invoke('install_modrinth_mod', {
                        projectId: selectedPlugin.id,
                        serverPath: server.path,
                        loader: server.type,
                        gameVersion: server.version
                    });
                } else {
                    await invoke('install_modrinth_plugin', { projectId: selectedPlugin.id, serverPath: server.path });
                }
            } else if (selectedPlugin.source === 'hangar') {
                await invoke('install_hangar_plugin', { slug: selectedPlugin.slug, serverPath: server.path });
            } else if (selectedPlugin.source === 'spigot') {
                await invoke('install_spigot_plugin', { resourceId: selectedPlugin.id, serverPath: server.path });
            } else if (selectedPlugin.source === 'polymart') {
                await invoke('install_polymart_plugin', { resourceId: selectedPlugin.id, serverPath: server.path });
            }
            toast.success(`${selectedPlugin.title} installed!`);
        } catch (e) {
            console.error(e);
            toast.error('Install failed: ' + e);
        } finally {
            setInstallingPlugin(null);
            setSelectedPlugin(null);
        }
    };

    const formatDownloads = (count: number) => {
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
        return count.toString();
    };

    const getSourceUrl = (plugin: PluginResult) => {
        switch (plugin.source) {
            case 'modrinth': return `https://modrinth.com/plugin/${plugin.slug}`;
            case 'hangar': return `https://hangar.papermc.io/${plugin.slug}`;
            case 'spigot': return `https://www.spigotmc.org/resources/${plugin.id}`;
            case 'polymart': return `https://polymart.org/resource/${plugin.id}`;
            default: return '#';
        }
    };

    // Pagination render logic
    const renderPagination = () => {
        const pages = [];
        const maxVisible = 9;
        let start = Math.max(1, currentPage - 4);
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) pages.push(i);

        return (
            <div className="flex flex-col items-center gap-2 py-4 border-t border-border/50">
                <span className="text-xs text-text-muted">Page {currentPage} of {totalPages}</span>
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-surface hover:bg-surface-hover disabled:opacity-50 transition-colors"><ChevronLeft className="w-4 h-4 text-text-muted" /></button>
                    {pages.map(page => (
                        <button key={page} onClick={() => setCurrentPage(page)} className={cn("w-9 h-9 rounded-lg font-bold text-sm transition-all", currentPage === page ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-surface hover:bg-surface-hover text-text-muted hover:text-white")}>{page}</button>
                    ))}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-surface hover:bg-surface-hover disabled:opacity-50 transition-colors"><ChevronRight className="w-4 h-4 text-text-muted" /></button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#0d1117] rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative backdrop-blur-3xl">
            {/* Header Gradient - subtle */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500/50 via-pink-500/50 to-blue-500/50 opacity-20" />
            {/* Main Header / Tab Switcher */}
            <div className="p-5 border-b border-border/50 bg-gradient-to-r from-purple-500/10 to-pink-500/10 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/20">
                            <Puzzle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Plugin Manager</h2>
                            <p className="text-xs text-text-muted">Manage server extensions</p>
                        </div>
                    </div>

                    {/* Tab Toggles */}
                    <div className="flex bg-black/40 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('store')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                                activeTab === 'store' ? "bg-surface shadow text-white" : "text-text-muted hover:text-white"
                            )}
                        >
                            <Download className="w-4 h-4" />
                            Plugin Store
                        </button>
                        <button
                            onClick={() => setActiveTab('installed')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                                activeTab === 'installed' ? "bg-surface shadow text-white" : "text-text-muted hover:text-white"
                            )}
                        >
                            <Puzzle className="w-4 h-4" />
                            Installed ({installedPlugins.length})
                        </button>
                    </div>
                </div>

                {/* Sub-header logic based on tab */}
                {activeTab === 'store' ? (
                    <>
                        {/* Source Tabs */}
                        <div className="flex gap-2 mb-6 p-1.5 bg-black/40 rounded-2xl border border-white/5">
                            {JAVA_SOURCES.map((source) => (
                                <button key={source.id} onClick={() => { setActiveSource(source.id); setCurrentPage(1); }}
                                    className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 relative overflow-hidden group",
                                        activeSource === source.id ? "text-white shadow-lg" : "text-text-muted hover:text-white hover:bg-white/5")}
                                >
                                    {activeSource === source.id && (
                                        <div className={cn("absolute inset-0 opacity-100 bg-gradient-to-r", source.color)} />
                                    )}
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        {source.name}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Search & Categories */}
                        <div className="flex flex-col gap-5 mb-8">
                            <form onSubmit={(e) => { e.preventDefault(); searchPlugins(); }} className="relative group z-10">
                                <div className={cn("absolute -inset-0.5 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur",
                                    activeSource === 'modrinth' ? "bg-gradient-to-r from-green-500 to-emerald-500" :
                                        activeSource === 'hangar' ? "bg-gradient-to-r from-blue-500 to-cyan-500" :
                                            "bg-gradient-to-r from-purple-500 to-pink-500"
                                )}></div>
                                <div className="relative flex items-center bg-[#0d1117] rounded-xl border border-white/10 group-focus-within:border-transparent transition-all">
                                    <Search className="absolute left-4 w-5 h-5 text-text-muted group-focus-within:text-white transition-colors" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={`Search ${activeSource.charAt(0).toUpperCase() + activeSource.slice(1)} plugins...`}
                                        className="w-full bg-transparent border-none py-4 pl-12 pr-4 text-white placeholder:text-text-muted/50 outline-none font-medium"
                                    />
                                    <button type="submit" disabled={isLoading} className="absolute right-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white text-xs font-bold transition-all">
                                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
                                    </button>
                                </div>
                            </form>

                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => (
                                    <button key={cat.id} onClick={() => handleCategoryClick(cat)}
                                        className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2",
                                            activeCategory === cat.id
                                                ? `bg-gradient-to-r ${cat.color} border-transparent text-white shadow-lg`
                                                : "bg-surface/50 border-white/5 text-text-muted hover:bg-surface hover:text-white hover:border-white/20")}
                                    >
                                        <cat.icon className="w-3.5 h-3.5" />
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Results Grid */}
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                                    <div key={i} className="bg-surface/30 rounded-2xl p-5 h-40 animate-pulse border border-white/5"><div className="flex gap-4"><div className="w-12 h-12 rounded-xl bg-white/5" /><div className="flex-1 space-y-2"><div className="h-4 bg-white/5 rounded w-2/3" /><div className="h-3 bg-white/5 rounded w-full" /><div className="h-3 bg-white/5 rounded w-4/5" /></div></div></div>
                                ))}
                            </div>
                        ) : plugins.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                                <Puzzle className="w-16 h-16 text-text-muted mb-4 opacity-20" />
                                <h3 className="text-xl font-bold text-white mb-2">No plugins found</h3>
                                <p className="text-text-muted max-w-md">We couldn't find any plugins matching your search. Try adjusting keywords or switching sources.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 pb-10">
                                {plugins.map((plugin) => (
                                    <div key={plugin.id} className="group relative bg-[#161b22]/80 hover:bg-[#1c2128] backdrop-blur border border-white/5 hover:border-purple-500/30 rounded-2xl p-4 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 flex flex-col">
                                        <div className="flex gap-4 mb-3">
                                            <div className="w-14 h-14 rounded-xl shrink-0 overflow-hidden bg-black/40 border border-white/5 p-0.5 shadow-inner">
                                                {plugin.icon_url ? (
                                                    <img src={plugin.icon_url} alt="" className="w-full h-full object-cover rounded-[10px]" loading="lazy" />
                                                ) : (
                                                    <div className="w-full h-full rounded-[10px] bg-white/5 flex items-center justify-center"><Puzzle className="w-6 h-6 text-white/20" /></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <a href={getSourceUrl(plugin)} target="_blank" rel="noreferrer" className="group/link flex items-center gap-1.5 min-w-0 max-w-[80%]">
                                                        <h4 className="font-bold text-white text-[15px] truncate leading-tight group-hover/link:text-purple-400 transition-colors" title={plugin.title}>{plugin.title}</h4>
                                                        <ExternalLink className="w-3 h-3 text-text-muted opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                                                    </a>
                                                    {/* Source Icon/Badge */}
                                                    <div className="shrink-0" title={plugin.source}>
                                                        {plugin.source === 'modrinth' && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />}
                                                        {plugin.source === 'spigot' && <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />}
                                                        {plugin.source === 'hangar' && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                                                        {plugin.source === 'polymart' && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-text-muted line-clamp-2 mt-1.5 leading-relaxed opacity-80 h-8">{plugin.description}</p>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-3 flex items-center justify-between border-t border-white/5">
                                            <div className="flex items-center gap-3 text-xs text-text-muted font-medium">
                                                <span className="flex items-center gap-1.5"><Download className="w-3.5 h-3.5 opacity-70" /> {formatDownloads(plugin.downloads)}</span>
                                            </div>
                                            <button
                                                onClick={() => openVersionModal(plugin)}
                                                disabled={!!installingPlugin}
                                                className="px-4 py-2 bg-white/5 hover:bg-purple-600 hover:text-white text-text-muted rounded-lg text-xs font-bold transition-all flex items-center gap-2 group-focus:ring-2 disabled:opacity-50"
                                            >
                                                Install <Download className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!isLoading && plugins.length > 0 && renderPagination()}
                    </>
                ) : (
                    <div className="flex flex-col h-full animate-in fade-in duration-500">
                        {/* Installed Toolbar */}
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <div className="relative flex-1 max-w-md group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-purple-400 transition-colors" />
                                <input
                                    type="text"
                                    value={installedSearch}
                                    onChange={(e) => setInstalledSearch(e.target.value)}
                                    placeholder="Filter installed plugins..."
                                    className="w-full bg-[#161b22] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-text-muted/50 outline-none focus:border-purple-500/50 focus:bg-[#1c2128] transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300 flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{installedPlugins.length} Installed</span>
                                </div>
                                <button onClick={loadInstalled} className="p-2.5 bg-surface hover:bg-white/5 border border-white/5 rounded-xl text-text-muted hover:text-white transition-all group" title="Refresh List">
                                    <RefreshCw className={cn("w-4 h-4 group-active:rotate-180 transition-transform", loadingInstalled && "animate-spin")} />
                                </button>
                            </div>
                        </div>

                        {/* Installed List */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                            {installedPlugins.filter(p => p.name.toLowerCase().includes(installedSearch.toLowerCase())).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                    <Puzzle className="w-16 h-16 text-text-muted mb-4 opacity-20" />
                                    <h3 className="text-lg font-bold text-white">No plugins found</h3>
                                    <p className="text-sm text-text-muted">No installed plugins match your search.</p>
                                </div>
                            ) : (
                                installedPlugins
                                    .filter(p => p.name.toLowerCase().includes(installedSearch.toLowerCase()))
                                    .map((p) => (
                                        <div key={p.filename} className={cn("group flex items-center gap-4 p-4 rounded-xl border transition-all duration-300",
                                            p.enabled
                                                ? "bg-[#161b22]/60 hover:bg-[#161b22] border-white/5 hover:border-white/10"
                                                : "bg-red-500/5 hover:bg-red-500/10 border-red-500/10 hover:border-red-500/20"
                                        )}>
                                            {/* Icon */}
                                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-inner",
                                                p.enabled ? "bg-black/40 text-purple-400" : "bg-red-900/20 text-red-400"
                                            )}>
                                                <Puzzle className="w-6 h-6" />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <h4 className={cn("font-bold text-sm truncate", p.enabled ? "text-white group-hover:text-purple-300 transition-colors" : "text-text-muted line-through opacity-80 decoration-2 decoration-red-500/50")}>{p.name}</h4>
                                                    {!p.enabled && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider">Disabled</span>}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted font-mono">
                                                    <span className="truncate max-w-[300px]" title={p.filename}>{p.filename}</span>
                                                    <span className="w-1 h-1 rounded-full bg-white/10" />
                                                    <span>{formatSize(p.size)}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleTogglePlugin(p.filename)}
                                                    className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border",
                                                        p.enabled
                                                            ? "bg-amber-500/5 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white hover:border-transparent"
                                                            : "bg-green-500/5 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white hover:border-transparent"
                                                    )}
                                                >
                                                    {p.enabled ? 'Disable' : 'Enable'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePlugin(p.filename)}
                                                    className="p-2 rounded-lg bg-red-500/5 text-red-400 border border-red-500/10 hover:bg-red-500 hover:text-white hover:border-transparent transition-all"
                                                    title="Delete Plugin"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Version Selection Modal (Same as before) */}
            {showVersionModal && selectedPlugin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#161b22] border border-border rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center overflow-hidden">
                                    {selectedPlugin.icon_url ? <img src={selectedPlugin.icon_url} alt="" className="w-full h-full object-cover" /> : <Puzzle className="w-5 h-5 text-purple-400" />}
                                </div>
                                <div><h3 className="font-bold text-white">{selectedPlugin.title}</h3><p className="text-xs text-text-muted">Select version</p></div>
                            </div>
                            <button onClick={() => setShowVersionModal(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors"><X className="w-5 h-5 text-text-muted" /></button>
                        </div>
                        {/* List */}
                        <div className="max-h-80 overflow-y-auto p-2">
                            {loadingVersions ? (
                                <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-purple-400 animate-spin" /></div>
                            ) : (
                                <div className="space-y-1">
                                    {versions.map((v) => (
                                        <button key={v.id} onClick={() => installVersion(v)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group text-left">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-sm">{v.name}</span>
                                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase", v.versionType === 'release' ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400")}>{v.versionType}</span>
                                                </div>
                                                <div className="text-xs text-text-muted mt-0.5">{v.gameVersions.slice(0, 3).join(', ')}{v.gameVersions.length > 3 && '...'}</div>
                                            </div>
                                            <div className="p-2 rounded-lg bg-surface group-hover:bg-purple-500 group-hover:text-white text-text-muted transition-colors"><Download className="w-4 h-4" /></div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
