import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export function usePlayerTracking(server: any) {
    const [players, setPlayers] = useState<string[]>([]);

    // Sync with /list command on startup/refresh if running
    useEffect(() => {
        if (server?.status === 'running') {
            const syncInterval = setInterval(() => {
                invoke('send_server_command', { id: server.id, command: 'list' }).catch(() => { });
            }, 60000); // Sync every minute just in case

            // Initial Sync
            setTimeout(() => {
                invoke('send_server_command', { id: server.id, command: 'list' }).catch(() => { });
            }, 2000); // Wait a bit for listener to be ready

            return () => clearInterval(syncInterval);
        }
    }, [server?.status, server?.id]);

    // Listen to logs directly
    useEffect(() => {
        if (!server?.id) return;

        let unlisten: () => void;

        const setupListener = async () => {
            unlisten = await listen(`server-log:${server.id}`, (event: any) => {
                const log = event.payload as string;
                processLog(log);
            });
        };

        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, [server?.id]);

    const processLog = (log: string) => {
        const cleanName = (name: string) => {
            // Remove ANSI codes
            let cleaned = name.replace(/\u001b\[[0-9;]*m/g, '');
            // Remove trailing dots/punctuation
            cleaned = cleaned.replace(/[.]+$/, '');
            return cleaned.trim();
        };

        // --- Bedrock Patterns ---
        const bedrockJoin = log.match(/Player connected: (.+), xuid:/);
        const bedrockLeave = log.match(/Player disconnected: (.+), xuid:/);

        // --- Java Patterns ---
        // Regex notes:
        // Match standard vanilla/spigot/paper join messages
        // Try to avoid matching chat messages (e.g. "<Player> joined the game" typed in chat)
        // Usually system messages don't have < > brackets at the start.
        const javaJoin = log.match(/(?<!<[^>]+>)(?:^|:\s)([\w_]+) joined the game/);
        const javaLeave = log.match(/(?<!<[^>]+>)(?:^|:\s)([\w_]+) left the game/);

        // --- Sync Patterns (/list) ---
        // Format 1: "There are 2 of a max of 20 players online: Name1, Name2"
        // Format 2: "Online players (2/20): Name1, Name2" (Essentials/Other plugins)
        const listMatch = log.match(/(?:players online|Online players).*?: (.*)/i);

        // --- UUID Auth Pattern ---
        const uuidMatch = log.match(/UUID of player (.+) is/);

        // --- Generic Fallbacks ---
        const simpleJoin = !javaJoin && !bedrockJoin && log.match(/: (.+) joined\./);
        const simpleLeave = !javaLeave && !bedrockLeave && log.match(/: (.+) left\./);

        if (bedrockJoin) {
            addPlayer(cleanName(bedrockJoin[1]), true);
        } else if (bedrockLeave) {
            removePlayer(cleanName(bedrockLeave[1]), true);
        } else if (javaJoin) {
            // Ensure we didn't match a chat message
            addPlayer(cleanName(javaJoin[1]), true);
        } else if (javaLeave) {
            removePlayer(cleanName(javaLeave[1]), true);
        } else if (simpleJoin) {
            addPlayer(cleanName(simpleJoin[1]), true);
        } else if (simpleLeave) {
            removePlayer(cleanName(simpleLeave[1]), true);
        } else if (uuidMatch) {
            addPlayer(cleanName(uuidMatch[1]), false);
        } else if (listMatch) {
            // Parse list: "Name1, Name2, Name3"
            const rawList = listMatch[1];
            if (!rawList || rawList.trim().length === 0) {
                setPlayers([]);
            } else {
                // Split by comma+space
                const names = rawList.split(/,\s*/).map(n => cleanName(n)).filter(n => n.length > 0);
                setPlayers(names);
            }
        }
    };

    const addPlayer = (name: string, notify: boolean) => {
        setPlayers(prev => {
            if (!prev.includes(name)) {
                if (notify) toast.success(`${name} joined!`);
                return [...prev, name];
            }
            return prev;
        });
    };

    const removePlayer = (name: string, notify: boolean) => {
        setPlayers(prev => {
            if (prev.includes(name)) {
                if (notify) toast.info(`${name} left.`);
                return prev.filter(p => p !== name);
            }
            return prev;
        });
    };

    return players;
}
