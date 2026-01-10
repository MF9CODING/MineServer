import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: LucideIcon;
    label: string;
    desc: string;
}

export function TabButton({ active, onClick, icon: Icon, label, desc }: TabButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden",
                active
                    ? "bg-primary/10 border-primary/50 shadow-[0_0_20px_-10px_var(--color-primary)]"
                    : "bg-surface/50 border-border hover:bg-surface hover:border-border/80"
            )}
        >
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 transition-colors", active ? "bg-primary" : "bg-transparent")} />
            <div className="flex items-center gap-3">
                <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    active ? "bg-primary text-black" : "bg-white/5 text-text-muted group-hover:text-white"
                )}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <p className={cn("font-bold transition-colors", active ? "text-white" : "text-text-secondary group-hover:text-white")}>{label}</p>
                    <p className="text-xs text-text-muted">{desc}</p>
                </div>
            </div>
        </button>
    );
}
