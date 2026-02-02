import { useState, useEffect, useRef } from 'react';
import {
    Settings, Save, RefreshCw, Users, Gamepad2, Shield, Globe,
    Plane, Target, Package, AlertTriangle, Server, Zap, Upload, Image as ImageIcon,
    Bold, Italic, Underline, Strikethrough, Eraser, Type
} from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '../../lib/utils';
import { ServerType } from '../../stores/appStore';

interface PropertiesEditorProps {
    serverPath: string;
    serverType: ServerType;
    serverName: string;
}

interface PropertyField {
    key: string;
    label: string;
    description: string;
    type: 'number' | 'text' | 'boolean' | 'select';
    options?: { value: string; label: string }[];
    category: string;
    icon?: any;
    invert?: boolean;
    platforms?: ('java' | 'bedrock')[];
}

// Java server.properties fields
const JAVA_PROPERTIES: PropertyField[] = [
    // Gameplay
    { key: 'max-players', label: 'Max Players', description: 'Maximum players allowed', type: 'number', category: 'Gameplay', icon: Users, platforms: ['java'] },
    {
        key: 'gamemode', label: 'Gamemode', description: 'Default game mode', type: 'select', category: 'Gameplay', icon: Gamepad2, platforms: ['java'], options: [
            { value: 'survival', label: 'Survival' },
            { value: 'creative', label: 'Creative' },
            { value: 'adventure', label: 'Adventure' },
            { value: 'spectator', label: 'Spectator' },
        ]
    },
    {
        key: 'difficulty', label: 'Difficulty', description: 'Game difficulty', type: 'select', category: 'Gameplay', icon: Target, platforms: ['java'], options: [
            { value: 'peaceful', label: 'Peaceful' },
            { value: 'easy', label: 'Easy' },
            { value: 'normal', label: 'Normal' },
            { value: 'hard', label: 'Hard' },
        ]
    },
    { key: 'force-gamemode', label: 'Force Gamemode', description: 'Force players into default gamemode', type: 'boolean', category: 'Gameplay', platforms: ['java'] },
    { key: 'pvp', label: 'PvP', description: 'Allow player vs player', type: 'boolean', category: 'Gameplay', platforms: ['java'] },
    { key: 'hardcore', label: 'Hardcore', description: 'Permadeath mode', type: 'boolean', category: 'Gameplay', platforms: ['java'] },

    // Security
    { key: 'online-mode', label: 'Cracked', description: 'Allow offline/cracked players', type: 'boolean', category: 'Security', icon: Shield, invert: true, platforms: ['java'] },
    { key: 'white-list', label: 'Whitelist', description: 'Only whitelisted can join', type: 'boolean', category: 'Security', platforms: ['java'] },
    { key: 'enforce-whitelist', label: 'Enforce Whitelist', description: 'Kick non-whitelisted immediately', type: 'boolean', category: 'Security', platforms: ['java'] },
    { key: 'spawn-protection', label: 'Spawn Protection', description: 'Radius around spawn', type: 'number', category: 'Security', platforms: ['java'] },

    // World
    { key: 'level-name', label: 'World Name', description: 'World folder name', type: 'text', category: 'World', icon: Globe, platforms: ['java'] },
    { key: 'level-seed', label: 'World Seed', description: 'Generation seed', type: 'text', category: 'World', platforms: ['java'] },
    {
        key: 'level-type', label: 'World Type', description: 'Generation type', type: 'select', category: 'World', platforms: ['java'], options: [
            { value: 'minecraft:normal', label: 'Normal' },
            { value: 'minecraft:flat', label: 'Flat' },
            { value: 'minecraft:large_biomes', label: 'Large Biomes' },
            { value: 'minecraft:amplified', label: 'Amplified' },
        ]
    },
    { key: 'generate-structures', label: 'Generate Structures', description: 'Villages, temples, etc', type: 'boolean', category: 'World', platforms: ['java'] },
    { key: 'allow-nether', label: 'Allow Nether', description: 'Enable Nether dimension', type: 'boolean', category: 'World', platforms: ['java'] },
    { key: 'spawn-monsters', label: 'Spawn Monsters', description: 'Hostile mobs', type: 'boolean', category: 'World', platforms: ['java'] },
    { key: 'spawn-animals', label: 'Spawn Animals', description: 'Passive mobs', type: 'boolean', category: 'World', platforms: ['java'] },

    // Server
    { key: 'motd', label: 'MOTD', description: 'Server list message', type: 'text', category: 'Server', icon: Server, platforms: ['java'] },
    { key: 'server-port', label: 'Server Port', description: 'Listening port', type: 'number', category: 'Server', platforms: ['java'] },
    { key: 'view-distance', label: 'View Distance', description: 'Render distance (3-32)', type: 'number', category: 'Server', platforms: ['java'] },
    { key: 'simulation-distance', label: 'Simulation Distance', description: 'Entity simulation chunks', type: 'number', category: 'Server', platforms: ['java'] },
    { key: 'enable-command-block', label: 'Command Blocks', description: 'Enable command blocks', type: 'boolean', category: 'Server', platforms: ['java'] },

    // Resources
    { key: 'allow-flight', label: 'Allow Flight', description: 'Flight in survival', type: 'boolean', category: 'Resources', icon: Plane, platforms: ['java'] },
    { key: 'resource-pack', label: 'Resource Pack URL', description: 'Resource pack link', type: 'text', category: 'Resources', icon: Package, platforms: ['java'] },
    { key: 'require-resource-pack', label: 'Require Pack', description: 'Kick if declined', type: 'boolean', category: 'Resources', platforms: ['java'] },
];

// Bedrock server.properties fields
const BEDROCK_PROPERTIES: PropertyField[] = [
    // Gameplay
    { key: 'max-players', label: 'Max Players', description: 'Maximum players allowed', type: 'number', category: 'Gameplay', icon: Users, platforms: ['bedrock'] },
    {
        key: 'gamemode', label: 'Gamemode', description: 'Default game mode', type: 'select', category: 'Gameplay', icon: Gamepad2, platforms: ['bedrock'], options: [
            { value: 'survival', label: 'Survival' },
            { value: 'creative', label: 'Creative' },
            { value: 'adventure', label: 'Adventure' },
        ]
    },
    {
        key: 'difficulty', label: 'Difficulty', description: 'Game difficulty', type: 'select', category: 'Gameplay', icon: Target, platforms: ['bedrock'], options: [
            { value: 'peaceful', label: 'Peaceful' },
            { value: 'easy', label: 'Easy' },
            { value: 'normal', label: 'Normal' },
            { value: 'hard', label: 'Hard' },
        ]
    },
    { key: 'allow-cheats', label: 'Allow Cheats', description: 'Enable cheats/commands', type: 'boolean', category: 'Gameplay', platforms: ['bedrock'] },

    // Security
    { key: 'online-mode', label: 'Xbox Auth', description: 'Require Xbox Live auth', type: 'boolean', category: 'Security', icon: Shield, platforms: ['bedrock'] },
    { key: 'allow-list', label: 'Allowlist', description: 'Only allowed players can join', type: 'boolean', category: 'Security', platforms: ['bedrock'] },

    // World
    { key: 'level-name', label: 'World Name', description: 'World folder name', type: 'text', category: 'World', icon: Globe, platforms: ['bedrock'] },
    { key: 'level-seed', label: 'World Seed', description: 'Generation seed', type: 'text', category: 'World', platforms: ['bedrock'] },
    {
        key: 'level-type', label: 'World Type', description: 'Generation type', type: 'select', category: 'World', platforms: ['bedrock'], options: [
            { value: 'DEFAULT', label: 'Default' },
            { value: 'FLAT', label: 'Flat' },
        ]
    },

    // Server
    { key: 'server-name', label: 'Server Name', description: 'Displayed in server list', type: 'text', category: 'Server', icon: Server, platforms: ['bedrock'] },
    { key: 'server-port', label: 'IPv4 Port', description: 'Main server port', type: 'number', category: 'Server', platforms: ['bedrock'] },
    { key: 'server-portv6', label: 'IPv6 Port', description: 'IPv6 server port', type: 'number', category: 'Server', platforms: ['bedrock'] },
    { key: 'view-distance', label: 'View Distance', description: 'Render distance', type: 'number', category: 'Server', platforms: ['bedrock'] },
    { key: 'tick-distance', label: 'Tick Distance', description: 'Simulation distance (4-12)', type: 'number', category: 'Server', platforms: ['bedrock'] },
    { key: 'player-idle-timeout', label: 'Idle Timeout', description: 'Minutes before kick (0=disabled)', type: 'number', category: 'Server', platforms: ['bedrock'] },
    { key: 'max-threads', label: 'Max Threads', description: 'Server threads (0=auto)', type: 'number', category: 'Server', platforms: ['bedrock'] },

    // Movement
    { key: 'player-movement-score-threshold', label: 'Movement Threshold', description: 'Anti-cheat sensitivity', type: 'number', category: 'Anti-Cheat', icon: Plane, platforms: ['bedrock'] },
    { key: 'player-movement-action-direction-threshold', label: 'Direction Threshold', description: 'Direction check sensitivity', type: 'number', category: 'Anti-Cheat', platforms: ['bedrock'] },
    { key: 'correct-player-movement', label: 'Correct Movement', description: 'Server-authoritative movement', type: 'boolean', category: 'Anti-Cheat', platforms: ['bedrock'] },
];

const JAVA_CATEGORIES = ['Gameplay', 'Security', 'World', 'Server', 'Resources'];
const BEDROCK_CATEGORIES = ['Gameplay', 'Security', 'World', 'Server', 'Anti-Cheat'];



function MotdEditor({ value, onChange, label, description, icon: Icon, isBedrock }: any) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Robust Minecraft MOTD Parser
    const parseMotd = (text: string) => {
        if (!text) return '<span class="opacity-50 italic">A Minecraft Server</span>';

        // 1. Normalize formatting codes
        // Replace literal "\u00A7" or "&" with actual § character for parsing
        let normalized = text
            .replace(/\\u00A7/g, '§')
            .replace(/&/g, '§')
            .replace(/§(?![0-9a-fk-or])/g, ''); // Remove invalid codes

        // 2. Handle newlines (escaped \n)
        const lines = normalized.split(/\\n|\n/);

        // Color Map
        const colorMap: Record<string, string> = {
            '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
            '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
            '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
            'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
            'g': '#DDD605', // Minecoin Gold
        };

        const escapeHtml = (str: string) => str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return lines.map(line => {
            const parts = line.split('§');
            let html = "";
            let styles = {
                color: '', bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false
            };

            parts.forEach((part, index) => {
                // The first part (index 0) is text before any color code. 
                // Subsequent parts start with the char that matches the code.

                if (index === 0) {
                    if (part) html += `<span style="color: #AAAAAA">${escapeHtml(part)}</span>`; // Default gray
                    return;
                }

                if (part.length === 0) return;

                const code = part.charAt(0).toLowerCase();
                const content = part.slice(1);

                // Update Style
                if (colorMap[code]) {
                    styles = {
                        color: colorMap[code],
                        bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false
                    };
                } else {
                    switch (code) {
                        case 'l': styles.bold = true; break;
                        case 'm': styles.strikethrough = true; break;
                        case 'n': styles.underline = true; break;
                        case 'o': styles.italic = true; break;
                        case 'k': styles.obfuscated = true; break;
                        case 'r': styles = { color: '', bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false }; break;
                    }
                }

                if (content) {
                    const decorations = [];
                    if (styles.underline) decorations.push('underline');
                    if (styles.strikethrough) decorations.push('line-through');
                    const decorationStyle = decorations.length ? `text-decoration: ${decorations.join(' ')}` : '';

                    const styleStr = [
                        styles.color ? `color: ${styles.color}` : (index === 0 ? 'color: #AAAAAA' : ''), // Keep previous color if not reset
                        // Wait, if code was a format (l), color persists. If code was color, styles.color updated.
                        // But if index > 0, we just applied a code.
                        // If it was a color code, styles.color is set.
                        // If it was a format code, styles.color retains previous.
                        // So we just use styles.color. If empty, default?
                        // Minecraft default is usually white or gray depending on client. Server list often defaults to gray/white.
                        styles.color ? `color: ${styles.color}` : 'color: #AAAAAA',
                        styles.bold ? 'font-weight: bold' : '',
                        styles.italic ? 'font-style: italic' : '',
                        decorationStyle,
                        styles.obfuscated ? 'opacity: 0.8; filter: blur(1px)' : '' // Poor man's obfuscation
                    ].filter(Boolean).join('; ');

                    html += `<span style="${styleStr}">${escapeHtml(content)}</span>`;
                }
            });
            return html || '<br/>';
        }).join('<br/>');
    };

    const insertCode = (code: string) => {
        if (!inputRef.current) return;
        const start = inputRef.current.selectionStart || 0;
        const end = inputRef.current.selectionEnd || 0;
        // Insert standard valid code. Using \u00A7 (section sign) directly
        // User reports issues updating. Maybe they need escaped unicode key "\u00A7"? 
        // Or simple "&"? Most server jars support "&" via plugins, but converting to "\u00A7" creates valid properties.
        // Let's Insert literal "\u00A7" char for visibility in input?
        // Actually, user likely sees "A" "A" "A" because I rendered text "A" inside button.

        const textToInsert = `\\u00A7${code}`;
        const newValue = value.substring(0, start) + textToInsert + value.substring(end);

        onChange(newValue);

        setTimeout(() => {
            if (inputRef.current) {
                const newCursor = start + textToInsert.length;
                inputRef.current.selectionStart = inputRef.current.selectionEnd = newCursor;
                inputRef.current.focus();
            }
        }, 0);
    };

    return (
        <div className="bg-[#161b22] rounded-xl p-4 border border-border/30 hover:border-border/50 transition-colors">
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg", isBedrock ? "bg-green-500/10 text-green-400" : "bg-primary/10 text-primary")}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white">{label}</h3>
                        <p className="text-xs text-text-muted">{description}</p>
                    </div>
                </div>

                {/* Editor Toolbar */}
                <div className="bg-black/40 rounded-t-xl border border-border/50 p-2 flex flex-col gap-2">
                    {/* Colors */}
                    <div className="flex flex-wrap gap-1">
                        {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'].map(code => (
                            <button
                                key={code}
                                type="button"
                                onClick={() => insertCode(code)}
                                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold hover:scale-110 transition-transform bg-surface border border-white/10 font-mono shadow-sm"
                                style={{
                                    color: { '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA', '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA', '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF', 'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF' }[code],
                                    backgroundColor: code === 'f' ? '#333' : 'rgba(0,0,0,0.5)'
                                }}
                                title={`Color §${code}`}
                            >
                                {code}
                            </button>
                        ))}
                    </div>

                    {/* Formatting */}
                    <div className="flex flex-wrap gap-1 border-t border-white/5 pt-2">
                        <button onClick={() => insertCode('l')} type="button" className="h-7 px-2 rounded flex items-center gap-1 bg-surface hover:bg-white/10 text-xs font-bold text-white border border-white/5" title="Bold (§l)">
                            <Bold className="w-3 h-3" /> Bold
                        </button>
                        <button onClick={() => insertCode('o')} type="button" className="h-7 px-2 rounded flex items-center gap-1 bg-surface hover:bg-white/10 text-xs italic text-white border border-white/5" title="Italic (§o)">
                            <Italic className="w-3 h-3" /> Italic
                        </button>
                        <button onClick={() => insertCode('n')} type="button" className="h-7 px-2 rounded flex items-center gap-1 bg-surface hover:bg-white/10 text-xs underline text-white border border-white/5" title="Underline (§n)">
                            <Underline className="w-3 h-3" /> Underline
                        </button>
                        <button onClick={() => insertCode('m')} type="button" className="h-7 px-2 rounded flex items-center gap-1 bg-surface hover:bg-white/10 text-xs line-through text-white border border-white/5" title="Strikethrough (§m)">
                            <Strikethrough className="w-3 h-3" /> Strike
                        </button>
                        <button onClick={() => insertCode('k')} type="button" className="h-7 px-2 rounded flex items-center gap-1 bg-surface hover:bg-white/10 text-xs text-white border border-white/5" title="Obfuscated (§k)">
                            <Type className="w-3 h-3" /> Magic
                        </button>
                        <div className="w-[1px] h-6 bg-white/10 mx-1" />
                        <button onClick={() => onChange('')} type="button" className="h-7 px-2 rounded flex items-center gap-1 bg-white/10 hover:bg-white/20 text-xs font-bold text-red-300 border border-white/5" title="Clear All Text">
                            <Eraser className="w-3 h-3" /> Clear
                        </button>
                    </div>
                </div>

                {/* Input */}
                <textarea
                    ref={inputRef as any}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-surface border-x border-b border-border/50 rounded-b-xl px-3 py-3 text-sm text-white outline-none focus:border-primary font-mono rounded-t-none resize-y min-h-[80px]"
                    placeholder="A Minecraft Server"
                    spellCheck={false}
                />

                {/* Live Preview */}
                <div className="mt-2">
                    <div className="text-[10px] font-bold text-text-muted uppercase mb-1 ml-1 flex items-center gap-2">
                        Live Preview
                        <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded">Server List</span>
                    </div>
                    <div className="bg-[#0d1117] p-3 rounded-lg border border-border/30 flex items-center gap-3 shadow-inner">
                        <img src="/src/assets/server-icon-placeholder.png" className="w-12 h-12 rounded opacity-90" alt="icon" />
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                                <div className="text-sm text-white font-bold truncate">Minecraft Server</div>
                                <div className="text-[10px] text-text-muted font-mono">14ms</div>
                            </div>
                            <div className="text-xs font-mono whitespace-pre-wrap leading-snug break-words" dangerouslySetInnerHTML={{
                                __html: parseMotd(value)
                            }} />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="text-[10px] text-text-muted flex items-center gap-1">
                                <div className="w-3 h-3 relative">
                                    <div className="absolute bottom-0 left-0 w-0.5 h-1 bg-green-500"></div>
                                    <div className="absolute bottom-0 left-1 w-0.5 h-2 bg-green-500"></div>
                                    <div className="absolute bottom-0 left-2 w-0.5 h-3 bg-green-500"></div>
                                </div>
                                20/100
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function PropertiesEditor({ serverPath, serverType, serverName }: PropertiesEditorProps) {
    const [properties, setProperties] = useState<Record<string, string>>({});
    const [originalProperties, setOriginalProperties] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const isBedrock = serverType === 'bedrock' || serverType === 'nukkit';
    const PROPERTY_FIELDS = isBedrock ? BEDROCK_PROPERTIES : JAVA_PROPERTIES;
    const CATEGORIES = isBedrock ? BEDROCK_CATEGORIES : JAVA_CATEGORIES;
    const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);

    useEffect(() => {
        loadProperties();
    }, [serverPath]);

    async function loadProperties() {
        setLoading(true);
        try {
            // Check if file exists first or handle specific error
            const content = await invoke<string>('read_server_file', { path: `${serverPath}\\server.properties` });
            const props: Record<string, string> = {};
            content.split('\n').forEach(line => {
                if (line.startsWith('#') || !line.includes('=')) return;
                const eqIndex = line.indexOf('=');
                const key = line.substring(0, eqIndex).trim();
                const val = line.substring(eqIndex + 1).trim();
                props[key] = val;
            });
            setProperties(props);
            setOriginalProperties(props);
        } catch (err) {
            // If file doesn't exist, we just show empty properties, not an error
            // The UI will likely show "No options found", so we might want to set a flag
            console.log("Server properties not found:", err);
            // We can optionally set default properties here if we want users to be able to configure before first run
            // setProperties(DEFAULT_PROPS...);
        } finally {
            setLoading(false);
        }
    }

    const hasChanges = JSON.stringify(properties) !== JSON.stringify(originalProperties);

    async function saveAllProperties() {
        setSaving(true);
        try {
            let content = `#Minecraft ${isBedrock ? 'Bedrock' : 'Java'} server properties\n#Modified by Mineserver\n`;
            Object.entries(properties).forEach(([k, v]) => {
                // Escape newlines for proper file formatting
                // We do NOT escape backslashes automatically to allow manual unicode escapes (like \u00A7)
                const escapedValue = String(v)
                    .replace(/\r/g, '')
                    .replace(/\n/g, '\\n');
                content += `${k}=${escapedValue}\n`;
            });

            await invoke('write_server_file', { path: `${serverPath}\\server.properties`, content });
            setOriginalProperties({ ...properties });
            toast.success("Settings saved! Restart server to apply.");
        } catch (err) {
            toast.error("Failed to save: " + err);
        } finally {
            setSaving(false);
        }
    }

    function updateProperty(key: string, value: string) {
        setProperties(prev => ({ ...prev, [key]: value }));
    }

    const filteredFields = PROPERTY_FIELDS.filter(f => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return f.label.toLowerCase().includes(query) || f.key.toLowerCase().includes(query);
        }
        return f.category === activeCategory;
    });

    if (loading) {
        return (
            <div className="flex flex-col h-full items-center justify-center bg-[#0d1117]">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-text-muted mt-4">Loading server.properties...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1117]">
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-[#161b22]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-lg",
                            isBedrock ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"
                        )}>
                            <Settings className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {serverName}
                                <span className={cn(
                                    "text-xs px-2 py-0.5 rounded font-medium",
                                    isBedrock ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"
                                )}>
                                    {isBedrock ? 'BEDROCK' : 'JAVA'}
                                </span>
                            </h2>
                            <p className="text-xs text-text-muted">server.properties</p>
                        </div>
                        {hasChanges && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Unsaved</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={loadProperties} className="p-2 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={saveAllProperties}
                            disabled={saving || !hasChanges}
                            className={cn(
                                "px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all",
                                hasChanges ? "bg-green-500 text-white hover:bg-green-600" : "bg-surface text-text-muted cursor-not-allowed"
                            )}
                        >
                            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
                        </button>
                    </div>
                </div>

                {/* Search */}
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${isBedrock ? 'Bedrock' : 'Java'} options...`}
                    className="w-full bg-black/30 border border-border/50 rounded-lg px-4 py-2 text-sm text-white placeholder:text-text-muted/50 focus:border-primary outline-none mb-3"
                />

                {/* Category Tabs */}
                {!searchQuery && (
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                                    activeCategory === cat
                                        ? (isBedrock ? "bg-green-500 text-black" : "bg-primary text-black")
                                        : "bg-surface/50 text-text-muted hover:text-white hover:bg-surface"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Properties List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Server Icon / Branding (Added based on user request) */}
                <div className="bg-[#161b22] border border-border/30 rounded-xl p-4 flex items-center gap-4 hover:border-border/50 transition-colors">
                    <div className="w-16 h-16 bg-black/40 rounded-lg border border-border/50 flex items-center justify-center relative group overflow-hidden shrink-0">
                        <img
                            src="https://api.mineskin.org/render/head?url=http://textures.minecraft.net/texture/292009a4925b58f02c77d69bf69792a105ce624692e4065292437367ce7a5"
                            className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-all"
                            alt="Server Icon"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="w-6 h-6 text-white" />
                        </div>
                        <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            accept="image/png"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                if (file.type !== 'image/png') {
                                    toast.error("Server icon must be a PNG image.");
                                    return;
                                }
                                if (file.size > 100 * 1024) toast.warning("Icon is large. Minecraft requires 64x64px.");

                                try {
                                    toast.loading("Uploading icon...", { id: 'icon-upload' });
                                    const buf = await file.arrayBuffer();
                                    await invoke('write_binary_file', {
                                        path: `${serverPath}\\server-icon.png`,
                                        content: Array.from(new Uint8Array(buf))
                                    });
                                    toast.success("Server icon updated!", { id: 'icon-upload' });
                                } catch (err) {
                                    toast.error("Failed to upload: " + err, { id: 'icon-upload' });
                                }
                            }}
                        />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            Server Icon <ImageIcon className="w-3.5 h-3.5 text-text-muted" />
                        </h3>
                        <p className="text-xs text-text-muted mt-1 max-w-lg">
                            Upload a <strong className="text-white">64x64 PNG</strong> image to be displayed in the multiplayer server list.
                            This will replace `server-icon.png`.
                        </p>
                    </div>
                    <button className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-bold transition-colors whitespace-nowrap">
                        Upload PNG
                    </button>
                </div>

                {Object.keys(properties).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-muted">
                        <div className="w-16 h-16 bg-surface/30 rounded-full flex items-center justify-center mb-4">
                            <Settings className="w-8 h-8 opacity-50" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Server Not Initialized</h3>
                        <p className="text-sm text-center max-w-xs mb-6">
                            Start the server once to generate the configuration files.
                        </p>
                        <button
                            onClick={loadProperties}
                            className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Check Again
                        </button>
                    </div>
                ) : filteredFields.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-muted">
                        <AlertTriangle className="w-12 h-12 mb-4 opacity-30" />
                        <p>No options match your search</p>
                    </div>
                ) : (
                    filteredFields.map(field => {
                        const Icon = field.icon || Zap;
                        const currentValue = properties[field.key] || '';
                        const displayValue = field.invert ? (currentValue === 'true' ? 'false' : 'true') : currentValue;

                        if (field.key === 'motd') {
                            return (
                                <MotdEditor
                                    key={field.key}
                                    value={currentValue}
                                    onChange={(val: string) => updateProperty(field.key, val)}
                                    label={field.label}
                                    description={field.description}
                                    icon={Icon}
                                    isBedrock={isBedrock}
                                />
                            );
                        }

                        return (
                            <div key={field.key} className="bg-[#161b22] rounded-xl p-4 border border-border/30 hover:border-border/50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className={cn(
                                            "p-2 rounded-lg",
                                            isBedrock ? "bg-green-500/10 text-green-400" : "bg-primary/10 text-primary"
                                        )}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-medium text-white">{field.label}</h3>
                                                <span className="text-[10px] text-text-muted font-mono bg-surface/50 px-1.5 rounded">{field.key}</span>
                                            </div>
                                            <p className="text-xs text-text-muted mt-0.5">{field.description}</p>
                                        </div>
                                    </div>

                                    <div className="flex-shrink-0">
                                        {field.type === 'boolean' ? (
                                            <button
                                                onClick={() => {
                                                    updateProperty(field.key, currentValue === 'true' ? 'false' : 'true');
                                                }}
                                                className={cn(
                                                    "w-14 h-7 rounded-full relative transition-all duration-200",
                                                    displayValue === 'true'
                                                        ? (isBedrock ? "bg-green-500" : "bg-green-500")
                                                        : "bg-surface border border-border"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200",
                                                    displayValue === 'true' ? "left-8" : "left-1"
                                                )} />
                                            </button>
                                        ) : field.type === 'select' ? (
                                            <select
                                                value={currentValue}
                                                onChange={(e) => updateProperty(field.key, e.target.value)}
                                                className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white min-w-[140px] outline-none focus:border-primary"
                                            >
                                                {field.options?.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'number' ? (
                                            <input
                                                type="number"
                                                value={currentValue}
                                                onChange={(e) => updateProperty(field.key, e.target.value)}
                                                className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-24 text-right outline-none focus:border-primary"
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={currentValue}
                                                onChange={(e) => updateProperty(field.key, e.target.value)}
                                                placeholder="Enter value..."
                                                className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white min-w-[200px] outline-none focus:border-primary"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-[#161b22] border-t border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                    <span>Restart server for changes to take effect</span>
                </div>
                <span className="text-xs text-text-muted">
                    {Object.keys(properties).length} properties • {isBedrock ? 'Bedrock' : 'Java'} Edition
                </span>
            </div>
        </div>
    );
}
