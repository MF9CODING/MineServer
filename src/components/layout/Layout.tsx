import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
    return (
        <div className="flex h-screen bg-background text-text overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
                    <Outlet />
                </main>
            </div>
            <Toaster position="top-right" theme="dark" richColors closeButton />
        </div>
    );
}
