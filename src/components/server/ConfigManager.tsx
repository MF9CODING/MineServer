import { useState, useEffect } from 'react';
import { Server } from '../../stores/appStore';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import {
    Settings, Shield, Gamepad2, Globe, Users, Skull, Zap,
    MapPin, Sun, Moon, Clock, Flame, Snowflake, RefreshCw,
    Save, AlertTriangle, Check
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfigManagerProps {
    server: Server;
    isRunning: boolean;
    sendCommand: (e?: React.FormEvent, cmdStr?: string) => Promise<void>;
}

interface GameRule {
    id: string;
    name: string;
    description: string;
    type: 'boolean' | 'number';
    value: boolean | number;
    category: 'survival' | 'world' | 'player' | 'safety';
    icon: typeof Settings;
}

const GAME_RULES: Omit<GameRule, 'value'>[] = [
    // Survival Rules
    { id: 'keepInventory', name: 'Keep Inventory', description: 'Players keep items after death', type: 'boolean', category: 'survival', icon: Shield },
    { id: 'naturalRegeneration', name: 'Natural Regeneration', description: 'Players regenerate health naturally', type: 'boolean', category: 'survival', icon: Zap },
    { id: 'doImmediateRespawn', name: 'Immediate Respawn', description: 'Skip death screen and respawn instantly', type: 'boolean', category: 'survival', icon: RefreshCw },
    { id: 'showDeathMessages', name: 'Death Messages', description: 'Show player death messages in chat', type: 'boolean', category: 'survival', icon: Skull },

    // World Rules
    { id: 'doDaylightCycle', name: 'Daylight Cycle', description: 'Time progresses naturally', type: 'boolean', category: 'world', icon: Sun },
    { id: 'doWeatherCycle', name: 'Weather Cycle', description: 'Weather changes naturally', type: 'boolean', category: 'world', icon: Snowflake },
    { id: 'doFireTick', name: 'Fire Spread', description: 'Fire spreads and burns blocks', type: 'boolean', category: 'world', icon: Flame },
    { id: 'randomTickSpeed', name: 'Tick Speed', description: 'Speed of random events (crops, etc)', type: 'number', category: 'world', icon: Clock },

    // Player Rules
    { id: 'announceAdvancements', name: 'Announce Advancements', description: 'Show advancement messages in chat', type: 'boolean', category: 'player', icon: Check },
    { id: 'reducedDebugInfo', name: 'Reduced Debug Info', description: 'Hide coordinates in F3 screen', type: 'boolean', category: 'player', icon: MapPin },
    { id: 'doLimitedCrafting', name: 'Limited Crafting', description: 'Players can only craft unlocked recipes', type: 'boolean', category: 'player', icon: Gamepad2 },
    { id: 'playersSleepingPercentage', name: 'Sleep Percentage', description: 'Percentage of players needed to skip night (0-100)', type: 'number', category: 'player', icon: Moon },

    // Safety Rules
    { id: 'mobGriefing', name: 'Mob Griefing', description: 'Mobs can destroy/change blocks', type: 'boolean', category: 'safety', icon: AlertTriangle },
    { id: 'doMobSpawning', name: 'Mob Spawning', description: 'Mobs spawn naturally in the world', type: 'boolean', category: 'safety', icon: Users },
    { id: 'pvp', name: 'PvP Combat', description: 'Players can damage each other', type: 'boolean', category: 'safety', icon: Skull },
    { id: 'spawnProtection', name: 'Spawn Protection', description: 'Radius around spawn that is protected (0-100)', type: 'number', category: 'safety', icon: Shield },
];

const CATEGORIES = [
    { id: 'survival', name: 'Survival', icon: Shield, color: 'from-green-500 to-emerald-500' },
    { id: 'world', name: 'World', icon: Globe, color: 'from-blue-500 to-cyan-500' },
    { id: 'player', name: 'Player', icon: Users, color: 'from-purple-500 to-pink-500' },
    { id: 'safety', name: 'Safety', icon: AlertTriangle, color: 'from-orange-500 to-red-500' },
];

export function ConfigManager({ server, isRunning, sendCommand }: ConfigManagerProps) {
    const [gameRules, setGameRules] = useState<GameRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeCategory, setActiveCategory] = useState('survival');

    useEffect(() => {
        loadGameRules();
    }, [server.path]);

    const loadGameRules = async () => {
        setIsLoading(true);
        try {
            // 1. Read propertis for pvp/spawn-protection
            const props = await invoke<Record<string, string>>('read_server_properties', { serverPath: server.path });

            // 2. Read custom sidecar for gamerules persistence
            let savedRules: Record<string, any> = {};
            try {
                const content = await invoke<string>('read_server_file', { path: `${server.path}\\gamerules.json` });
                savedRules = JSON.parse(content);
            } catch (e) {
                // No sidecar yet, ignore
            }

            const rules: GameRule[] = GAME_RULES.map(rule => {
                let value: boolean | number;

                // Priority: 1. server.properties (hard overrides for pvp/spawn), 2. Sidecar, 3. Defaults
                if (rule.id === 'pvp' && props['pvp']) {
                    value = props['pvp'] === 'true';
                } else if (rule.id === 'spawnProtection' && props['spawn-protection']) {
                    value = parseInt(props['spawn-protection'], 10);
                } else if (savedRules[rule.id] !== undefined) {
                    value = savedRules[rule.id];
                } else {
                    // Defaults
                    if (rule.type === 'boolean') {
                        value = !(rule.id === 'keepInventory' || rule.id === 'doImmediateRespawn');
                    } else {
                        value = rule.id === 'randomTickSpeed' ? 3 : rule.id === 'playersSleepingPercentage' ? 100 : 16;
                    }
                }
                return { ...rule, value };
            });

            setGameRules(rules);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load config");
        } finally {
            setIsLoading(false);
        }
    };

    const updateRule = (ruleId: string, newValue: boolean | number) => {
        setGameRules(prev => prev.map(rule =>
            rule.id === ruleId ? { ...rule, value: newValue } : rule
        ));
        setHasChanges(true);
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            // 1. Prepare commands and sidecar data
            const sidecarData: Record<string, any> = {};
            const propsToSave: Record<string, string> = {};

            for (const rule of gameRules) {
                sidecarData[rule.id] = rule.value;

                if (rule.id === 'pvp') propsToSave['pvp'] = String(rule.value);
                else if (rule.id === 'spawnProtection') propsToSave['spawn-protection'] = String(rule.value);
                else if (isRunning) {
                    // Execute command if running
                    await sendCommand(undefined, `gamerule ${rule.id} ${rule.value}`);
                }
            }

            // 2. Save server.properties
            await invoke('update_server_properties', {
                serverPath: server.path,
                properties: propsToSave
            });

            // 3. Save sidecar persistence
            await invoke('write_server_file', {
                path: `${server.path}\\gamerules.json`,
                content: JSON.stringify(sidecarData, null, 2)
            });

            toast.success(isRunning ? 'Settings applied & saved!' : 'Settings saved! (Will apply on start if you add a startup script, otherwise set manually)');
            setHasChanges(false);
        } catch (e) {
            toast.error('Failed to save: ' + e);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredRules = gameRules.filter(r => r.category === activeCategory);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#0d1117]">
            {/* Header */}
            <div className="p-5 border-b border-border/50 bg-gradient-to-r from-primary/10 to-purple-500/10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-primary to-purple-500 rounded-xl shadow-lg shadow-primary/20">
                            <Settings className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Game Rules & Config</h2>
                            <p className="text-xs text-text-muted">Customize world behavior and player settings</p>
                        </div>
                    </div>
                    {hasChanges && (
                        <button
                            onClick={saveChanges}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20"
                        >
                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    )}
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                                activeCategory === cat.id
                                    ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                                    : "bg-surface/50 text-text-muted hover:bg-surface hover:text-white border border-border"
                            )}
                        >
                            <cat.icon className="w-4 h-4" />
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Rules Grid */}
            <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredRules.map((rule) => (
                        <div
                            key={rule.id}
                            className="bg-surface/30 hover:bg-surface/50 border border-border/30 rounded-xl p-4 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "p-2 rounded-lg shrink-0",
                                        CATEGORIES.find(c => c.id === rule.category)?.id === 'survival' && "bg-green-500/20",
                                        CATEGORIES.find(c => c.id === rule.category)?.id === 'world' && "bg-blue-500/20",
                                        CATEGORIES.find(c => c.id === rule.category)?.id === 'player' && "bg-purple-500/20",
                                        CATEGORIES.find(c => c.id === rule.category)?.id === 'safety' && "bg-orange-500/20"
                                    )}>
                                        <rule.icon className={cn(
                                            "w-4 h-4",
                                            rule.category === 'survival' && "text-green-400",
                                            rule.category === 'world' && "text-blue-400",
                                            rule.category === 'player' && "text-purple-400",
                                            rule.category === 'safety' && "text-orange-400"
                                        )} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{rule.name}</h4>
                                        <p className="text-xs text-text-muted mt-0.5">{rule.description}</p>
                                    </div>
                                </div>

                                {/* Toggle or Input */}
                                {rule.type === 'boolean' ? (
                                    <button
                                        onClick={() => updateRule(rule.id, !rule.value)}
                                        className={cn(
                                            "relative w-14 h-7 rounded-full transition-colors shrink-0",
                                            rule.value ? "bg-green-500" : "bg-surface border border-border"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all",
                                            rule.value ? "left-8" : "left-1"
                                        )} />
                                    </button>
                                ) : (
                                    <input
                                        type="number"
                                        value={rule.value as number}
                                        onChange={(e) => updateRule(rule.id, parseInt(e.target.value) || 0)}
                                        className="w-20 bg-black/30 border border-border rounded-lg px-3 py-2 text-white text-center font-mono focus:border-primary outline-none"
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick Presets */}
                <div className="mt-6 pt-6 border-t border-border/30">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        Quick Presets
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button
                            onClick={() => {
                                updateRule('keepInventory', true);
                                updateRule('mobGriefing', false);
                                updateRule('pvp', false);
                            }}
                            className="p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl transition-all text-left"
                        >
                            <Shield className="w-5 h-5 text-green-400 mb-2" />
                            <h4 className="font-bold text-white text-sm">Peaceful</h4>
                            <p className="text-xs text-text-muted">Safe building mode</p>
                        </button>

                        <button
                            onClick={() => {
                                updateRule('keepInventory', false);
                                updateRule('mobGriefing', true);
                                updateRule('pvp', true);
                                updateRule('naturalRegeneration', true);
                            }}
                            className="p-4 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl transition-all text-left"
                        >
                            <Skull className="w-5 h-5 text-orange-400 mb-2" />
                            <h4 className="font-bold text-white text-sm">Survival</h4>
                            <p className="text-xs text-text-muted">Classic gameplay</p>
                        </button>

                        <button
                            onClick={() => {
                                updateRule('keepInventory', false);
                                updateRule('mobGriefing', true);
                                updateRule('pvp', true);
                                updateRule('naturalRegeneration', false);
                            }}
                            className="p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all text-left"
                        >
                            <Flame className="w-5 h-5 text-red-400 mb-2" />
                            <h4 className="font-bold text-white text-sm">Hardcore</h4>
                            <p className="text-xs text-text-muted">Maximum challenge</p>
                        </button>

                        <button
                            onClick={() => {
                                updateRule('doDaylightCycle', false);
                                updateRule('doWeatherCycle', false);
                                updateRule('doFireTick', false);
                                updateRule('mobGriefing', false);
                            }}
                            className="p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-all text-left"
                        >
                            <Globe className="w-5 h-5 text-blue-400 mb-2" />
                            <h4 className="font-bold text-white text-sm">Creative</h4>
                            <p className="text-xs text-text-muted">Build freely</p>
                        </button>
                    </div>
                </div>

                {/* Server Properties Info */}
                <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-white text-sm">Note</h4>
                            <p className="text-xs text-text-muted mt-1">
                                Game rules are applied via commands when the server starts. Some settings (PvP, Spawn Protection)
                                require a server restart to take effect. For Bedrock servers, not all game rules may be available.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
