import { motion } from 'framer-motion';
import { Cpu, MemoryStick, HardDrive } from 'lucide-react';

interface CircularProgressProps {
    value: number;
    max: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
}

function CircularProgress({
    value,
    max,
    size = 60,
    strokeWidth = 6,
    color = 'var(--color-primary)'
}: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const percentage = Math.min(value / max, 1);
    const offset = circumference - (percentage * circumference);

    return (
        <div className="relative" style={{ width: size, height: size }}>
            {/* Background Circle */}
            <svg className="absolute inset-0" width={size} height={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth={strokeWidth}
                />
            </svg>

            {/* Progress Circle */}
            <svg
                className="absolute inset-0 -rotate-90"
                width={size}
                height={size}
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: 'stroke-dashoffset 0.5s ease-in-out',
                        filter: `drop-shadow(0 0 6px ${color})`
                    }}
                />
            </svg>

            {/* Percentage Text */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-semibold text-text">
                    {Math.round(percentage * 100)}%
                </span>
            </div>
        </div>
    );
}

interface SystemResourceCardProps {
    cpuUsage: number;
    memoryUsed: number;
    memoryTotal: number;
    diskUsed: number;
    diskTotal: number;
}

export function SystemResourceCard({
    cpuUsage,
    memoryUsed,
    memoryTotal,
    diskUsed,
    diskTotal,
}: SystemResourceCardProps) {
    const resources = [
        {
            icon: Cpu,
            label: 'CPU',
            value: cpuUsage,
            max: 100,
            unit: '%',
            color: cpuUsage > 80 ? 'var(--color-error)' : cpuUsage > 60 ? 'var(--color-warning)' : 'var(--color-primary)',
        },
        {
            icon: MemoryStick,
            label: 'Memory',
            value: memoryUsed,
            max: memoryTotal,
            unit: 'GB',
            color: (memoryUsed / memoryTotal) > 0.8 ? 'var(--color-error)' : 'var(--color-secondary)',
        },
        {
            icon: HardDrive,
            label: 'Disk',
            value: diskUsed,
            max: diskTotal,
            unit: 'GB',
            color: 'var(--color-info)',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
        >
            <h3 className="font-semibold text-text mb-4">System Resources</h3>

            <div className="flex justify-around">
                {resources.map((resource) => (
                    <div key={resource.label} className="flex flex-col items-center gap-2">
                        <CircularProgress
                            value={resource.value}
                            max={resource.max}
                            color={resource.color}
                        />
                        <div className="flex items-center gap-1 text-text-secondary">
                            <resource.icon className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">{resource.label}</span>
                        </div>
                        <span className="text-xs text-text-muted">
                            {resource.value.toFixed(1)}/{resource.max.toFixed(1)} {resource.unit}
                        </span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
