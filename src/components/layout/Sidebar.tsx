import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Server, Database, Calendar, Settings, ChevronsLeft, ChevronsRight, Pickaxe } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { cn } from '../../lib/utils';

const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/servers', icon: Server, label: 'Servers' },
    { path: '/backups', icon: Database, label: 'Backups' },
    { path: '/tasks', icon: Calendar, label: 'Tasks' },
    { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
    const { sidebarCollapsed, toggleSidebar } = useAppStore();
    const location = useLocation();

    return (
        <motion.aside
            initial={false}
            animate={{ width: sidebarCollapsed ? 80 : 260 }}
            className="h-screen flex flex-col border-r border-border bg-surface/30 backdrop-blur-xl relative z-50"
        >
            {/* Branding */}
            <div className="h-20 flex items-center px-6 border-b border-border/50">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-dark flex items-center justify-center shadow-[0_0_15px_-3px_var(--color-primary-glow)]">
                        <Pickaxe className="w-5 h-5 text-black fill-black" strokeWidth={2.5} />
                    </div>
                    {!sidebarCollapsed && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h1 className="font-bold text-xl tracking-tight text-white">Mineserver</h1>
                            <span className="text-xs text-primary font-medium tracking-wider uppercase">Manager</span>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-8 px-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                                isActive
                                    ? "bg-primary/10 text-primary shadow-[0_0_20px_-10px_var(--color-primary-glow)]"
                                    : "text-text-muted hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-text-muted group-hover:text-white")} />

                            {!sidebarCollapsed && (
                                <span className="font-medium">{item.label}</span>
                            )}

                            {isActive && (
                                <motion.div
                                    layoutId="active-nav"
                                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
                                />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Collapse Toggle */}
            <div className="p-4 border-t border-border/50">
                <button
                    onClick={toggleSidebar}
                    className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-white/5 text-text-muted transition-all bg-surface/50 border border-border"
                >
                    {sidebarCollapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
                </button>
            </div>
        </motion.aside>
    );
}
