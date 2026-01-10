import { useLocation } from 'react-router-dom';
import { Bell, Search, User } from 'lucide-react';

const pageTitles: Record<string, string> = {
    '/': 'Dashboard',
    '/servers': 'Servers',
    '/files': 'Files',
    '/settings': 'Settings',
    '/create': 'Create Server',
};

export function Header() {
    const location = useLocation();
    const title = pageTitles[location.pathname] || 'Mineserver';

    return (
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface">
            {/* Page Title */}
            <div>
                <h1 className="text-xl font-semibold text-text">{title}</h1>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-64 pl-10 pr-4 py-2 bg-surface-light border border-border rounded-lg
              text-sm text-text placeholder:text-text-muted
              focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30
              transition-all"
                    />
                </div>

                {/* Notifications */}
                <button className="relative p-2 rounded-lg hover:bg-surface-light transition-colors">
                    <Bell className="w-5 h-5 text-text-secondary" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
                </button>

                {/* User */}
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-light transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-text">Admin</span>
                </button>
            </div>
        </header>
    );
}
