import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Server } from '../../stores/appStore';
import { Search, Download, RefreshCw, Package, Sparkles, Gamepad2, Wrench, Star, Box, Layers, Zap, Globe, Puzzle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface ModManagerProps {
    server: Server;
}

interface Addon {
    id: string;
    slug: string;
    title: string;
    description: string;
    downloads: number;
    icon_url: string | null;
    source: 'modrinth' | 'spigot' | 'hangar' | 'polymart' | 'poggit' | 'curseforge';
    project_id?: string;
    author?: string;
}

interface PaginatedResult<T> {
    items: T[];
    total: number;
}

interface VersionInfo {
    id: string;
    name: string;
    gameVersions: string[];
    loaders: string[];
    downloadUrl: string;
    datePublished: string;
    versionType: string;
}

const SOURCES = [
    { id: 'modrinth', name: 'Modrinth', icon: Package, color: 'from-green-500 to-emerald-500' },
    { id: 'spigot', name: 'SpigotMC', icon: Layers, color: 'from-orange-500 to-amber-500' },
    { id: 'hangar', name: 'Hangar', icon: Box, color: 'from-blue-500 to-cyan-500' },
    { id: 'polymart', name: 'Polymart', icon: Globe, color: 'from-pink-500 to-rose-500' },
    { id: 'poggit', name: 'Poggit', icon: Zap, color: 'from-red-500 to-orange-500', bedrockOnly: true },
];

const CATEGORIES = [
    { id: 'popular', label: 'Trending', icon: Sparkles, query: '' },
    { id: 'new', label: 'New', icon: Zap, query: 'new' },
    { id: 'updated', label: 'Updated', icon: RefreshCw, query: 'updated' },
    { id: 'technology', label: 'Tech', icon: Wrench, query: 'technology' },
    { id: 'adventure', label: 'Adventure', icon: Gamepad2, query: 'adventure' },
    { id: 'magic', label: 'Magic', icon: Star, query: 'magic' },
];

export function ModManager({ server }: ModManagerProps) {
    const [activeView, setActiveView] = useState('modrinth');
    const [activeCategory, setActiveCategory] = useState('popular');
    const [searchQuery, setSearchQuery] = useState('');

    // Cache State
    const [cachedAddons, setCachedAddons] = useState<Record<string, { items: Addon[], total: number }>>({});
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Version Modal
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [selectedAddon, setSelectedAddon] = useState<Addon | null>(null);
    const [versions, setVersions] = useState<VersionInfo[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [installingVersion, setInstallingVersion] = useState<string | null>(null);

    // Server Type Logic
    const isBedrock = ['bedrock', 'nukkit'].includes(server.type.toLowerCase());
    const isPluginServer = ['spigot', 'paper', 'purpur', 'bungeecord', 'velocity', 'nukkit'].includes(server.type.toLowerCase());
    const addonType = isPluginServer ? 'Plugins' : 'Mods';
    const loaderType = server.type === 'forge' ? 'forge' : 'fabric';

    const availableSources = SOURCES.filter(s => {
        if (s.bedrockOnly && !isBedrock) return false;
        if (!s.bedrockOnly && isBedrock) return false;
        return true;
    });

    // Helper to update cache
    const updateCache = (source: string, items: Addon[], total: number) => {
        setCachedAddons(prev => ({ ...prev, [source]: { items, total } }));
    };

    // Initial Load - Fetch all sources in background
    useEffect(() => {
        availableSources.forEach(source => {
            if (!cachedAddons[source.id]) {
                loadSourceData(source.id, '', 1, 'popular');
            }
        });
    }, [server.path]);

    // Update active view when params change
    useEffect(() => {
        loadSourceData(activeView, searchQuery, currentPage, activeCategory);
    }, [activeView, activeCategory, currentPage]); // Only reload active if params change

    // Search trigger
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        loadSourceData(activeView, searchQuery, 1, activeCategory);
    };

    const loadSourceData = async (sourceId: string, query: string, page: number, category: string) => {
        setLoadingStates(prev => ({ ...prev, [sourceId]: true }));
        try {
            let results: any[] = [];
            let effectiveQuery = query;

            // Append category to query if not 'popular'/empty
            if (category !== 'popular' && category !== 'new' && category !== 'updated') {
                effectiveQuery = `${query} ${CATEGORIES.find(c => c.id === category)?.query || ''}`.trim();
            }

            let totalHits = 0;

            if (sourceId === 'modrinth') {
                if (isPluginServer) {
                    const res = await invoke<PaginatedResult<any>>('search_modrinth_plugins', {
                        query: effectiveQuery,
                        offset: (page - 1) * 20
                    });
                    results = res.items;
                    totalHits = res.total;
                } else {
                    const res = await invoke<PaginatedResult<any>>('search_modrinth_mods', {
                        query: effectiveQuery,
                        loader: loaderType,
                        offset: (page - 1) * 20
                    });
                    results = res.items;
                    totalHits = res.total;
                }
            } else if (sourceId === 'spigot') {
                results = await invoke('search_spigot_plugins', { query: effectiveQuery, page: page });
                totalHits = 100;
            } else if (sourceId === 'hangar') {
                results = await invoke('search_hangar_plugins', { query: effectiveQuery });
                totalHits = 50;
            } else if (sourceId === 'polymart') {
                results = await invoke('search_polymart_plugins', { query: effectiveQuery, page: page });
                totalHits = 50;
            } else if (sourceId === 'poggit') {
                results = await invoke('search_poggit_plugins', { query: effectiveQuery });
                totalHits = 20;
            }

            // Map results to unified interface
            const mapped: Addon[] = results.map(r => ({
                id: r.project_id || r.id || r.slug,
                slug: r.slug || r.id,
                title: r.title || r.name,
                description: r.description,
                downloads: r.downloads,
                icon_url: r.icon_url,
                source: (sourceId as any),
                project_id: r.project_id || r.id
            }));

            updateCache(sourceId, mapped, Math.ceil(totalHits / 20));

            // Update main pagination only if active
            if (sourceId === activeView) {
                setTotalPages(Math.ceil(totalHits / 20)); // Approximate or exact
            }

        } catch (e) {
            console.error(e);
            toast.error(`Failed to fetch from ${sourceId}`);
            updateCache(sourceId, [], 0);
        } finally {
            setLoadingStates(prev => ({ ...prev, [sourceId]: false }));
        }
    };

    // Derived state for UI
    const addons = cachedAddons[activeView]?.items || [];
    const isLoading = loadingStates[activeView] || false;

    // Open Modal
    const handleInstallClick = async (addon: Addon) => {
        setSelectedAddon(addon);
        setShowVersionModal(true);
        setLoadingVersions(true);
        setVersions([]);

        try {
            // Use the universal 'get_plugin_versions' command which dispatches based on source string
            const versionData = await invoke<VersionInfo[]>('get_plugin_versions', {
                source: addon.source,
                projectId: addon.project_id || addon.id,
                slug: addon.slug
            });
            setVersions(versionData);
        } catch (e) {
            console.error("Failed to load versions:", e);
            // Fallback: allow installing "Latest" without version selection
            setVersions([{
                id: 'latest',
                name: 'Latest Version',
                gameVersions: [server.version],
                loaders: [server.type, loaderType],
                downloadUrl: '',
                datePublished: new Date().toISOString(),
                versionType: 'release'
            }]);
        } finally {
            setLoadingVersions(false);
        }
    };

    const installVersion = async (version: VersionInfo) => {
        if (!selectedAddon) return;
        setInstallingVersion(version.id);

        try {
            // Dispatch install command based on source
            if (selectedAddon.source === 'modrinth') {
                if (isPluginServer) {
                    await invoke('install_modrinth_plugin', {
                        serverPath: server.path,
                        projectId: selectedAddon.project_id || selectedAddon.id
                    });
                } else {
                    await invoke('install_modrinth_mod', {
                        serverPath: server.path,
                        projectId: selectedAddon.project_id || selectedAddon.id,
                        slug: selectedAddon.slug,
                        loader: loaderType,
                        gameVersion: server.version
                    });
                }
            } else if (selectedAddon.source === 'spigot') {
                await invoke('install_spigot_plugin', {
                    serverPath: server.path,
                    resourceId: selectedAddon.id
                });
            } else if (selectedAddon.source === 'hangar') {
                await invoke('install_hangar_plugin', {
                    serverPath: server.path,
                    slug: selectedAddon.id
                });
            } else if (selectedAddon.source === 'poggit') {
                await invoke('install_poggit_plugin', {
                    serverPath: server.path,
                    pluginName: selectedAddon.title
                });
            }

            toast.success(`Installed ${selectedAddon.title}`);
            setShowVersionModal(false);
        } catch (e) {
            toast.error("Installation failed: " + e);
        } finally {
            setInstallingVersion(null);
        }
    };

    // Render Pagination
    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        return (
            <div className="flex items-center justify-center gap-2 py-4 mt-auto border-t border-border/10">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-text-muted" />
                </button>

                {pages.map(page => (
                    <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                            "w-9 h-9 rounded-lg font-bold text-sm transition-all",
                            currentPage === page
                                ? "bg-primary text-black shadow-lg shadow-primary/20"
                                : "bg-white/5 hover:bg-white/10 text-text-muted hover:text-white"
                        )}
                    >
                        {page}
                    </button>
                ))}

                <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                </button>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-white">
            {/* Header Area */}
            <div className={cn(
                "p-5 border-b border-border/50",
                isPluginServer
                    ? "bg-gradient-to-r from-blue-600/10 to-cyan-600/10"
                    : "bg-gradient-to-r from-purple-600/10 to-pink-600/10"
            )}>
                <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                        "p-2.5 rounded-xl shadow-lg",
                        isPluginServer
                            ? "bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-500/20"
                            : "bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/20"
                    )}>
                        <Puzzle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            {addonType} Manager
                        </h2>
                        <p className="text-xs text-text-muted">
                            {isPluginServer
                                ? 'Browse and install plugins from multiple sources'
                                : 'Manage and install mods for your server'}
                        </p>
                    </div>
                </div>

                {/* Source Selection Bar */}
                <div className="flex gap-1 mb-4 p-1 bg-black/30 rounded-xl">
                    {availableSources.map((source) => (
                        <button
                            key={source.id}
                            onClick={() => { setActiveView(source.id); setSearchQuery(''); setCurrentPage(1); }}
                            className={cn(
                                "flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                activeView === source.id
                                    ? `bg-gradient-to-r ${source.color} text-white shadow-lg`
                                    : "text-text-muted hover:text-white hover:bg-white/5"
                            )}
                        >
                            <source.icon className="w-4 h-4" />
                            {source.name}
                        </button>
                    ))}
                </div>

                {/* Search & Categories */}
                <div className="space-y-4">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`Search ${availableSources.find(s => s.id === activeView)?.name}...`}
                                className={cn(
                                    "w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-text-muted/50 outline-none transition-all",
                                    "focus:border-primary focus:bg-black/60"
                                )}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                "px-6 py-3 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]",
                                isPluginServer
                                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/20"
                                    : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20"
                            )}
                        >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
                        </button>
                    </form>

                    {/* Categories List (Similar to PluginManager) */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => { setActiveCategory(cat.id); setCurrentPage(1); }}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                                    activeCategory === cat.id
                                        ? "bg-white text-black shadow-lg shadow-white/10"
                                        : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-white"
                                )}
                            >
                                <cat.icon className="w-3.5 h-3.5" />
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] relative">
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* Browse View */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {isLoading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="bg-[#161b22] border border-white/10 rounded-xl p-4 h-48 animate-pulse" />
                            ))
                        ) : addons.length === 0 ? (
                            <div className="col-span-full text-center py-20 text-text-muted">
                                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>No results found for "{searchQuery}"</p>
                            </div>
                        ) : (
                            addons.map((addon) => (
                                <div key={addon.id} className="bg-[#161b22] border border-white/10 rounded-xl p-4 flex flex-col gap-3 group hover:border-white/20 hover:bg-[#1c2128] transition-all">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-black/40 overflow-hidden border border-white/10 shrink-0">
                                                {addon.icon_url ? (
                                                    <img src={addon.icon_url} alt={addon.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                                                        <Package className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-white line-clamp-1" title={addon.title}>{addon.title}</h3>
                                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                                    <span className="flex items-center gap-1">
                                                        <Download className="w-3 h-3" />
                                                        {addon.downloads > 1000 ? (addon.downloads / 1000).toFixed(1) + 'k' : addon.downloads}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-text-muted line-clamp-2 h-8">{addon.description}</p>

                                    <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                                        <div className="text-xs text-text-muted flex items-center gap-1">
                                            <Globe className="w-3 h-3" /> {availableSources.find(s => s.id === activeView)?.name}
                                        </div>
                                        <button
                                            onClick={() => handleInstallClick(addon)}
                                            className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-black rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                        >
                                            <Download className="w-3 h-3" />
                                            Install
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pagination */}
                {!isLoading && addons.length > 0 && renderPagination()}
            </div>

            {/* Version Selection Modal */}
            {showVersionModal && selectedAddon && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-start">
                            <div className="flex gap-4">
                                <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 overflow-hidden">
                                    {selectedAddon.icon_url ? (
                                        <img src={selectedAddon.icon_url} alt={selectedAddon.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                                            <Package className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">{selectedAddon.title}</h3>
                                    <p className="text-sm text-text-muted line-clamp-2 max-w-md">{selectedAddon.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowVersionModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Available Versions</h4>

                            {loadingVersions ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : versions.length === 0 ? (
                                <div className="text-center py-10 text-text-muted">
                                    <p>No versions found for your server software.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {versions.map((version) => (
                                        <div key={version.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-primary/50 transition-all group">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-white">{version.name}</span>
                                                    <span className={cn(
                                                        "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                                                        version.versionType === 'release' ? "bg-green-500/20 text-green-400" :
                                                            version.versionType === 'beta' ? "bg-orange-500/20 text-orange-400" :
                                                                "bg-red-500/20 text-red-400"
                                                    )}>
                                                        {version.versionType}
                                                    </span>
                                                    <span className="text-xs text-text-muted">
                                                        • {new Date(version.datePublished).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-text-muted">
                                                        {version.loaders.join(', ')}
                                                    </span>
                                                    <p className="text-xs text-text-muted">
                                                        MC: {version.gameVersions.join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => installVersion(version)}
                                                disabled={installingVersion === version.id}
                                                className="px-4 py-2 bg-white/10 hover:bg-primary hover:text-black text-white font-bold rounded-lg text-sm transition-all flex items-center gap-2 group-hover:shadow-lg disabled:opacity-50"
                                            >
                                                {installingVersion === version.id ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Download className="w-4 h-4" />
                                                )}
                                                {installingVersion === version.id ? 'Installing...' : 'Install'}
                                            </button>
                                        </div>
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


