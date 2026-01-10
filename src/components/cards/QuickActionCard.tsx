import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface QuickActionCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    onClick?: () => void;
    gradient?: string;
    children?: ReactNode;
}

export function QuickActionCard({
    icon: Icon,
    title,
    description,
    onClick,
    gradient = 'from-primary/20 to-secondary/20',
}: QuickActionCardProps) {
    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`
        w-full p-6 rounded-2xl text-left transition-all duration-300
        bg-gradient-to-br ${gradient}
        border border-border hover:border-primary/50
        group cursor-pointer
      `}
        >
            <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-surface/60 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h3 className="font-semibold text-text group-hover:text-primary transition-colors">
                        {title}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                        {description}
                    </p>
                </div>
            </div>
        </motion.button>
    );
}
