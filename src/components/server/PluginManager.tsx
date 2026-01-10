import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Server } from '../../stores/appStore';
import { Search, Download, RefreshCw, Puzzle, ExternalLink, Sparkles, Shield, Gamepad2, Wrench, MessageSquare, Star, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
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
    { id: 'economy', label: 'Economy', icon: Wrench, query: 'economy vault', color: 'from-amber-500 to-yellow-500' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, query: 'chat', color: 'from-indigo-500 to-blue-500' },
];

export function PluginManager({ server }: PluginManagerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [plugins, setPlugins] = useState<PluginResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);

    const [activeCategory, setActiveCategory] = useState('popular');
    const [activeSource, setActiveSource] = useState('modrinth');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Version selection modal
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [selectedPlugin, setSelectedPlugin] = useState<PluginResult | null>(null);
    const [versions, setVersions] = useState<VersionInfo[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    const pluginsPerPage = 20;

    useEffect(() => {
        loadPlugins();
    }, [activeSource, currentPage]);

    const loadPlugins = async (query: string = '') => {
        setIsLoading(true);
        try {
            let results: PluginResult[] = [];

            interface PaginatedResult<T> {
                items: T[];
                total: number;
            }

            // ... inside loadPlugins ...

            if (activeSource === 'modrinth') {
                const modrinthResults = await invoke<PaginatedResult<any>>('search_modrinth_plugins', {
                    query,
                    offset: (currentPage - 1) * pluginsPerPage
                });

                results = modrinthResults.items.map(p => ({
                    id: p.project_id,
                    slug: p.slug,
                    title: p.title,
                    description: p.description,
                    downloads: p.downloads,
                    icon_url: p.icon_url,
                    source: 'modrinth' as const
                }));
                // Real pagination logic!
                setTotalPages(Math.ceil(modrinthResults.total / pluginsPerPage));
            } else if (activeSource === 'hangar') {
                results = await invoke<PluginResult[]>('search_hangar_plugins', { query });
                setTotalPages(5);
            } else if (activeSource === 'spigot') {
                results = await invoke<PluginResult[]>('search_spigot_plugins', { query: query || '', page: currentPage });
                setTotalPages(10);
            } else if (activeSource === 'polymart') {
                results = await invoke<PluginResult[]>('search_polymart_plugins', { query: query || 'plugin', page: currentPage });
                setTotalPages(5);
            }

            setPlugins(results);
        } catch (e) {
            console.error('Failed to load plugins:', e);
            setPlugins([]);
        } finally {
            setIsLoading(false);
        }
    };

    const searchPlugins = async (query?: string) => {
        const q = query ?? searchQuery;
        setActiveCategory('');
        setCurrentPage(1);
        loadPlugins(q);
    };

    const handleCategoryClick = (category: typeof CATEGORIES[0]) => {
        setActiveCategory(category.id);
        setSearchQuery(category.query);
        setCurrentPage(1);
        loadPlugins(category.query);
    };

    const openVersionModal = async (plugin: PluginResult) => {
        setSelectedPlugin(plugin);
        setShowVersionModal(true);
        setLoadingVersions(true);

        try {
            // Fetch versions for this plugin
            const versionData = await invoke<VersionInfo[]>('get_plugin_versions', {
                source: plugin.source,
                projectId: plugin.id,
                slug: plugin.slug
            });
            setVersions(versionData);
        } catch (e) {
            console.error('Failed to load versions:', e);
            // Fallback: install latest directly
            setVersions([{
                id: 'latest',
                name: 'Latest',
                gameVersions: [server.version],
                loaders: ['paper', 'spigot', 'bukkit'],
                downloadUrl: ''
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
                await invoke('install_modrinth_plugin', {
                    projectId: selectedPlugin.id,
                    serverPath: server.path
                });
            } else if (selectedPlugin.source === 'hangar') {
                await invoke('install_hangar_plugin', {
                    slug: selectedPlugin.slug,
                    serverPath: server.path
                });
            } else if (selectedPlugin.source === 'spigot') {
                await invoke('install_spigot_plugin', {
                    resourceId: selectedPlugin.id,
                    serverPath: server.path
                });
                await invoke('install_spigot_plugin', {
                    resourceId: selectedPlugin.id,
                    serverPath: server.path
                });
            }
            toast.success(`${selectedPlugin.title} installed!`);
        } catch (e) {
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

    const renderPagination = () => {
        const pages = [];
        const maxVisible = 9;
        let start = Math.max(1, currentPage - 4);
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        return (
            <div className="flex flex-col items-center gap-2 py-4 border-t border-border/50">
                <span className="text-xs text-text-muted">
                    Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-surface hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                                    : "bg-surface hover:bg-surface-hover text-text-muted hover:text-white"
                            )}
                        >
                            {page}
                        </button>
                    ))}

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-surface hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#0d1117]">
            {/* Header */}
            <div className="p-5 border-b border-border/50 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/20">
                        <Puzzle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            Plugin Store
                        </h2>
                        <p className="text-xs text-text-muted">
                            Browse and install plugins from multiple sources
                        </p>
                    </div>
                </div>

                {/* Source Tabs */}
                <div className="flex gap-1 mb-4 p-1 bg-black/30 rounded-xl">
                    {JAVA_SOURCES.map((source) => (
                        <button
                            key={source.id}
                            onClick={() => { setActiveSource(source.id); setCurrentPage(1); }}
                            className={cn(
                                "flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all",
                                activeSource === source.id
                                    ? `bg-gradient-to-r ${source.color} text-white shadow-lg`
                                    : "text-text-muted hover:text-white hover:bg-white/5"
                            )}
                        >
                            {source.name}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <form onSubmit={(e) => { e.preventDefault(); searchPlugins(); }} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search plugins (e.g., EssentialsX, Vault, LuckPerms)"
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-text-muted/50 outline-none transition-all focus:border-purple-500 focus:bg-black/60"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-3 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20"
                    >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
                    </button>
                </form>

                {/* Categories */}
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => handleCategoryClick(cat)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                                activeCategory === cat.id
                                    ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                                    : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-white"
                            )}
                        >
                            <cat.icon className="w-4 h-4" />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Plugin Grid */}
                <div className="flex-1 overflow-y-auto p-5">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="bg-surface/30 rounded-xl p-4 animate-pulse">
                                    <div className="flex gap-4">
                                        <div className="w-14 h-14 rounded-xl bg-white/10" />
                                        <div className="flex-1">
                                            <div className="h-5 bg-white/10 rounded w-1/2 mb-2" />
                                            <div className="h-3 bg-white/5 rounded w-full mb-1" />
                                            <div className="h-3 bg-white/5 rounded w-3/4" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : plugins.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Puzzle className="w-16 h-16 text-text-muted/30 mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">No plugins found</h3>
                            <p className="text-sm text-text-muted">Try a different search term or source</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {plugins.map((plugin) => (
                                <div
                                    key={plugin.id}
                                    className="bg-surface/30 hover:bg-surface/50 border border-border/30 rounded-xl p-4 transition-all group hover:border-purple-500/30"
                                >
                                    <div className="flex gap-3">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white/5 bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                                            {plugin.icon_url ? (
                                                <img src={plugin.icon_url} alt="" className="w-full h-full object-cover rounded-xl" />
                                            ) : (
                                                <Puzzle className="w-6 h-6 text-purple-400" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-white text-sm truncate">{plugin.title}</h4>
                                                <a
                                                    href={getSourceUrl(plugin)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-text-muted hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                            <p className="text-xs text-text-muted line-clamp-2 mb-2 leading-relaxed">{plugin.description}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1 text-xs text-text-muted">
                                                    <Download className="w-3 h-3" />
                                                    {formatDownloads(plugin.downloads)}
                                                </span>
                                                <button
                                                    onClick={() => openVersionModal(plugin)}
                                                    disabled={installingPlugin === plugin.id}
                                                    className="px-3 py-1.5 text-white font-bold text-xs rounded-lg disabled:opacity-50 transition-all flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600"
                                                >
                                                    {installingPlugin === plugin.id ? (
                                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Download className="w-3 h-3" />
                                                    )}
                                                    Install
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {!isLoading && plugins.length > 0 && renderPagination()}
            </div>

            {/* Version Selection Modal */}
            {showVersionModal && selectedPlugin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#161b22] border border-border rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center overflow-hidden">
                                    {selectedPlugin.icon_url ? (
                                        <img src={selectedPlugin.icon_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Puzzle className="w-5 h-5 text-purple-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{selectedPlugin.title}</h3>
                                    <p className="text-xs text-text-muted">Select version to install</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowVersionModal(false)}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-text-muted" />
                            </button>
                        </div>

                        {/* Version List */}
                        <div className="max-h-80 overflow-y-auto p-4">
                            {loadingVersions ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {versions.map((version) => (
                                        <div
                                            key={version.id}
                                            className="flex items-center justify-between p-3 rounded-xl bg-surface/50 border border-border hover:bg-surface transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                    <span className="text-purple-400 font-bold text-xs">v</span>
                                                </div>
                                                <div className="text-left">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-white">{version.name}</div>
                                                        <span className={cn(
                                                            "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                                                            version.versionType === 'release' ? "bg-green-500/20 text-green-400" :
                                                                version.versionType === 'beta' ? "bg-orange-500/20 text-orange-400" :
                                                                    "bg-white/10 text-text-muted"
                                                        )}>
                                                            {version.versionType || 'Release'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-text-muted flex gap-2">
                                                        <span>MC: {version.gameVersions.slice(0, 4).join(', ')}{version.gameVersions.length > 4 && ` +${version.gameVersions.length - 4}`}</span>
                                                        {version.datePublished && (
                                                            <span>• {new Date(version.datePublished).toLocaleDateString()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => installVersion(version)}
                                                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm rounded-lg transition-colors"
                                            >
                                                <Download className="w-4 h-4" />
                                                Install
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border bg-black/20">
                            <p className="text-xs text-text-muted text-center">
                                Your server: {server.version} • {server.type.toUpperCase()}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
