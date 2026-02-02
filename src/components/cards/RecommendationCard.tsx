import { motion } from 'framer-motion';
import { Sparkles, Cpu, Users, HardDrive } from 'lucide-react';
import { Recommendation, ServerType } from '../../stores/appStore';

const serverTypeNames: Record<ServerType, string> = {
    vanilla: 'Vanilla',
    paper: 'Paper',
    forge: 'Forge',
    neoforge: 'NeoForge',
    fabric: 'Fabric',
    bedrock: 'Bedrock',
    spigot: 'Spigot',
    purpur: 'Purpur',
    nukkit: 'Nukkit',
};

interface RecommendationCardProps {
    recommendation: Recommendation;
    cpuName?: string;

}

export function RecommendationCard({ recommendation, cpuName }: RecommendationCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glass border-primary/30 relative overflow-hidden"
        >
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />

            <div className="relative">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-primary/20">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-text">Recommended for Your PC</h3>
                </div>

                {/* Recommendation */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 
            flex items-center justify-center">
                        <span className="text-3xl">
                            {recommendation.serverType === 'paper' ? '📄' :
                                recommendation.serverType === 'vanilla' ? '🟫' : '🔨'}
                        </span>
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-primary">
                            {serverTypeNames[recommendation.serverType]}
                        </h4>
                        <p className="text-sm text-text-secondary">
                            Best performance for your hardware
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-surface">
                        <div className="flex items-center gap-1 text-text-muted text-xs mb-1">
                            <Users className="w-3 h-3" />
                            <span>Players</span>
                        </div>
                        <span className="text-lg font-bold text-text">
                            {recommendation.maxPlayers}
                        </span>
                    </div>
                    <div className="p-3 rounded-lg bg-surface">
                        <div className="flex items-center gap-1 text-text-muted text-xs mb-1">
                            <HardDrive className="w-3 h-3" />
                            <span>RAM</span>
                        </div>
                        <span className="text-lg font-bold text-text">
                            {(recommendation.allocatedRam / 1024).toFixed(1)}GB
                        </span>
                    </div>
                    <div className="p-3 rounded-lg bg-surface">
                        <div className="flex items-center gap-1 text-text-muted text-xs mb-1">
                            <Cpu className="w-3 h-3" />
                            <span>CPU</span>
                        </div>
                        <span className="text-sm font-medium text-text truncate">
                            {cpuName?.split(' ').slice(0, 2).join(' ') || 'Detected'}
                        </span>
                    </div>
                </div>

                {/* Reasoning */}
                <p className="text-xs text-text-muted leading-relaxed">
                    {recommendation.reasoning}
                </p>
            </div>
        </motion.div>
    );
}
