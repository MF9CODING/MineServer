import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Grid, List, Server, Zap, Users, Activity, Sparkles } from 'lucide-react';
import { useAppStore, ServerType } from '../stores/appStore';
import { ServerCard } from '../components/cards/ServerCard';

const serverTypeFilters: { value: ServerType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'vanilla', label: 'Vanilla' },
    { value: 'paper', label: 'Paper' },
    { value: 'forge', label: 'Forge' },
    { value: 'fabric', label: 'Fabric' },
    { value: 'bedrock', label: 'Bedrock' },
    { value: 'spigot', label: 'Spigot' },
    { value: 'purpur', label: 'Purpur' },
];

export function Servers() {
    const navigate = useNavigate();
    const { servers } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<ServerType | 'all'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    const displayServers = servers;

    const filteredServers = displayServers.filter((server) => {
        const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'all' || server.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const runningCount = filteredServers.filter((s) => s.status === 'running').length;
    const totalPlayers = filteredServers.reduce((acc, s) => acc + s.playerCount, 0);
    const totalServers = filteredServers.length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-full"
        >
            {/* Hero Header with Gradient */}
            <div className="relative overflow-hidden bg-gradient-to-br from-surface via-surface to-primary/5 border-b border-border">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative p-6 lg:p-8">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                                    <Server className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-bold text-white">Server Manager</h1>
                                    <p className="text-text-secondary text-sm">Deploy and manage your Minecraft servers</p>
                                </div>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/create')}
                            className="group relative px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <Plus className="w-5 h-5 relative z-10" />
                            <span className="relative z-10">New Server</span>
                            <Sparkles className="w-4 h-4 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="glass-card p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                <Server className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{totalServers}</p>
                                <p className="text-xs text-text-secondary uppercase tracking-wider">Total Servers</p>
                            </div>
                        </div>

                        <div className="glass-card p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{runningCount}</p>
                                <p className="text-xs text-text-secondary uppercase tracking-wider">Running</p>
                            </div>
                        </div>

                        <div className="glass-card p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                <Users className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{totalPlayers}</p>
                                <p className="text-xs text-text-secondary uppercase tracking-wider">Players Online</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6 lg:p-8 space-y-6">
                {/* Filters Bar */}
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Search servers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 bg-surface-light border border-border rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                        />
                    </div>

                    {/* Type Filter */}
                    <div className="flex items-center gap-2 bg-surface-light border border-border rounded-lg px-3 h-10">
                        <Filter className="w-4 h-4 text-text-muted" />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as ServerType | 'all')}
                            className="bg-transparent text-white text-sm focus:outline-none cursor-pointer"
                        >
                            {serverTypeFilters.map((filter) => (
                                <option key={filter.value} value={filter.value} className="bg-surface text-white">
                                    {filter.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 p-1 bg-surface-light border border-border rounded-lg">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list'
                                    ? 'bg-primary/20 text-primary shadow-sm'
                                    : 'text-text-muted hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid'
                                    ? 'bg-primary/20 text-primary shadow-sm'
                                    : 'text-text-muted hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Server List */}
                <AnimatePresence mode="wait">
                    {filteredServers.length > 0 ? (
                        <motion.div
                            key="servers"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-3'}
                        >
                            {filteredServers.map((server, index) => (
                                <motion.div
                                    key={server.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <ServerCard
                                        server={server}
                                        onClick={() => navigate(`/servers/${server.id}`)}
                                        onStart={() => console.log('Start', server.id)}
                                        onStop={() => console.log('Stop', server.id)}
                                        onSettings={() => navigate(`/servers/${server.id}`)}
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative"
                        >
                            {/* Premium Empty State */}
                            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-primary/5">
                                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

                                <div className="relative p-12 text-center">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', delay: 0.1 }}
                                        className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center"
                                    >
                                        <Zap className="w-12 h-12 text-primary" />
                                    </motion.div>

                                    <h3 className="text-2xl font-bold text-white mb-2">
                                        {searchQuery || typeFilter !== 'all'
                                            ? 'No servers match your filters'
                                            : 'No servers yet'}
                                    </h3>
                                    <p className="text-text-secondary mb-8 max-w-md mx-auto">
                                        {searchQuery || typeFilter !== 'all'
                                            ? 'Try adjusting your search or filter to find what you\'re looking for.'
                                            : 'Create your first Minecraft server and start your adventure. It only takes a few clicks!'}
                                    </p>

                                    {!searchQuery && typeFilter === 'all' && (
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => navigate('/create')}
                                            className="group relative px-8 py-4 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl flex items-center gap-3 mx-auto transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                            <Plus className="w-5 h-5 relative z-10" />
                                            <span className="relative z-10">Create Your First Server</span>
                                            <Sparkles className="w-4 h-4 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </motion.button>
                                    )}

                                    {(searchQuery || typeFilter !== 'all') && (
                                        <button
                                            onClick={() => {
                                                setSearchQuery('');
                                                setTypeFilter('all');
                                            }}
                                            className="px-6 py-3 bg-surface-light hover:bg-white/10 text-white font-medium rounded-xl border border-border transition-all"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
