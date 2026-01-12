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

// Plugin Manager Interface
// Supports Store (Modrinth/Hangar/Spigot) and Installed Plugins

export function PluginManager({ server }: PluginManagerProps) {
    const [activeTab, setActiveTab] = useState<'store' | 'installed'>('store');

    // Store State
    const [searchQuery, setSearchQuery] = useState('');
    const [plugins, setPlugins] = useState<PluginResult[]>([]);
    const [isLoading, setIsLoading] = useState(false); // Default false for Store until query
    const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);

    const [activeCategory, setActiveCategory] = useState('popular');
    const [activeSource, setActiveSource] = useState('modrinth');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Installed State
    const [installedPlugins, setInstalledPlugins] = useState<{ name: string, filename: string }[]>([]);
    const [loadingInstalled, setLoadingInstalled] = useState(false);

    // Version selection modal
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [selectedPlugin, setSelectedPlugin] = useState<PluginResult | null>(null);
    const [versions, setVersions] = useState<VersionInfo[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    const pluginsPerPage = 20;

    // Load Installed Plugins
    const loadInstalled = async () => {
        setLoadingInstalled(true);
        try {
            const list = await invoke<{ name: string, filename: string }[]>('list_plugins', { serverPath: server.path });
            setInstalledPlugins(list);
        } catch (e) {
            toast.error("Failed to load installed plugins: " + e);
        } finally {
            setLoadingInstalled(false);
        }
    };

    // Load Store Plugins
    useEffect(() => {
        if (activeTab === 'store') {
            loadPlugins(searchQuery || (activeCategory === 'popular' ? '' : activeCategory));
        } else {
            loadInstalled();
        }
    }, [activeSource, currentPage, activeTab]); // Reload when tab changes

    const loadPlugins = async (query: string = '') => {
        setIsLoading(true);
        try {
            let results: PluginResult[] = [];

            // ... (keep existing search logic) ...
            // We need to re-implement the search dispatch logic here from previous code
            // Or just copy-paste the body if it was cleaner.
            // Since this replacement content must match, I will include the full body logic.

            if (activeSource === 'modrinth') {
                interface PaginatedResult<T> { items: T[]; total: number; }
                const modrinthResults = await invoke<PaginatedResult<any>>('search_modrinth_plugins', {
                    query,
                    offset: (currentPage - 1) * pluginsPerPage
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
                setTotalPages(Math.ceil(modrinthResults.total / pluginsPerPage));
            } else if (activeSource === 'hangar') {
                results = await invoke<PluginResult[]>('search_hangar_plugins', { query });
                setTotalPages(1); // Hangar API pagination requires more work, limiting to search for now
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

    // ... (Keep existing helpers: searchPlugins, handleCategoryClick, openVersionModal, installVersion, formatDownloads, getSourceUrl, renderPagination) ...
    // Since I'm replacing the whole component body, I need to include them.

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
                await invoke('install_modrinth_plugin', { projectId: selectedPlugin.id, serverPath: server.path });
            } else if (selectedPlugin.source === 'hangar') {
                await invoke('install_hangar_plugin', { slug: selectedPlugin.slug, serverPath: server.path });
            } else if (selectedPlugin.source === 'spigot') {
                await invoke('install_spigot_plugin', { resourceId: selectedPlugin.id, serverPath: server.path });
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
        <div className="h-full flex flex-col overflow-hidden bg-[#0d1117]">
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
                        <div className="flex gap-1 mb-4 p-1 bg-black/30 rounded-xl">
                            {JAVA_SOURCES.map((source) => (
                                <button key={source.id} onClick={() => { setActiveSource(source.id); setCurrentPage(1); }} className={cn("flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all", activeSource === source.id ? `bg-gradient-to-r ${source.color} text-white shadow-lg` : "text-text-muted hover:text-white hover:bg-white/5")}>{source.name}</button>
                            ))}
                        </div>

                        {/* Search & Categories */}
                        <div className="flex flex-col gap-4">
                            <form onSubmit={(e) => { e.preventDefault(); searchPlugins(); }} className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search plugins..." className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-text-muted/50 outline-none focus:border-purple-500 focus:bg-black/60 transition-all" />
                                </div>
                                <button type="submit" disabled={isLoading} className="px-5 py-2.5 text-white font-bold text-sm rounded-xl disabled:opacity-50 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20">{isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}</button>
                            </form>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {CATEGORIES.map((cat) => (
                                    <button key={cat.id} onClick={() => handleCategoryClick(cat)} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border", activeCategory === cat.id ? `bg-gradient-to-r ${cat.color} border-transparent text-white` : "bg-white/5 border-white/10 text-text-muted hover:border-white/30 hover:text-white")}>
                                        <cat.icon className="w-3.5 h-3.5" />
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex justify-between items-center">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            Managing plugins in <code>/plugins</code> folder
                        </div>
                        <button onClick={loadInstalled} className="p-2 hover:bg-surface rounded-lg text-text-muted hover:text-white transition-colors" title="Refresh List">
                            <RefreshCw className={cn("w-5 h-5", loadingInstalled && "animate-spin")} />
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5">
                {activeTab === 'store' ? (
                    <>
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="bg-surface/30 rounded-xl p-4 animate-pulse"><div className="flex gap-4"><div className="w-12 h-12 rounded-xl bg-white/10" /><div className="flex-1"><div className="h-4 bg-white/10 rounded w-1/2 mb-2" /><div className="h-3 bg-white/5 rounded w-full" /></div></div></div>
                                ))}
                            </div>
                        ) : plugins.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center text-text-muted">
                                <Puzzle className="w-12 h-12 opacity-20 mb-4" />
                                <h3 className="text-lg font-bold text-white mb-1">No plugins found</h3>
                                <p className="text-sm">Try searching for something else.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {plugins.map((plugin) => (
                                    <div key={plugin.id} className="bg-surface/30 hover:bg-surface/50 border border-border/30 rounded-xl p-4 transition-all group hover:border-purple-500/30 flex flex-col">
                                        <div className="flex gap-3 mb-3">
                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white/5 bg-black/20">
                                                {plugin.icon_url ? <img src={plugin.icon_url} alt="" className="w-full h-full object-cover" /> : <Puzzle className="w-6 h-6 text-purple-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h4 className="font-bold text-white text-sm truncate" title={plugin.title}>{plugin.title}</h4>
                                                    <a href={getSourceUrl(plugin)} target="_blank" rel="noreferrer" className="text-text-muted hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100"><ExternalLink className="w-3 h-3" /></a>
                                                </div>
                                                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-9">{plugin.description}</p>
                                            </div>
                                        </div>
                                        <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                                            <span className="flex items-center gap-1.5 text-xs text-text-muted font-mono"><Download className="w-3 h-3" />{formatDownloads(plugin.downloads)}</span>
                                            <button
                                                onClick={() => openVersionModal(plugin)}
                                                disabled={!!installingPlugin}
                                                className="px-3 py-1.5 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600 shadow-lg shadow-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed">
                                                <Download className="w-3 h-3" /> Install
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!isLoading && plugins.length > 0 && renderPagination()}
                    </>
                ) : (
                    // Installed Tab Content
                    <div className="space-y-4">
                        {loadingInstalled ? (
                            <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 text-purple-500 animate-spin" /></div>
                        ) : installedPlugins.length === 0 ? (
                            <div className="text-center py-20 text-text-muted">
                                <Puzzle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <h3 className="text-xl font-bold text-white mb-2">No Plugins Installed</h3>
                                <p>Go to the <b>Store</b> tab to discover and install plugins.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {installedPlugins.map((p) => (
                                    <div key={p.filename} className="bg-surface/30 border border-border/50 rounded-xl p-4 flex flex-col group hover:border-white/20 transition-all">
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                                                <Puzzle className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-white text-sm truncate" title={p.filename}>{p.name}</h4>
                                                <p className="text-xs text-text-muted truncate font-mono mt-0.5">{p.filename}</p>
                                            </div>
                                        </div>
                                        <div className="mt-auto flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleDeletePlugin(p.filename)}
                                                className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
