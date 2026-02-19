// src/lib/db/database.svelte.ts — Database Store
// Main entry point for the UI to interact with SQLite
// Uses Svelte 5 Runes for reactivity

import type { Track } from '$lib/types';
// Import worker constructor directly for Vite to process it
// import DBWorker from './worker?worker';

interface WorkerRequest {
    id: string;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
}

export class DatabaseManager {
    // Svelte 5 state
    isReady = $state(false);
    error = $state<string | null>(null);

    private worker: Worker | null = null;
    private pendingRequests = new Map<string, WorkerRequest>();

    constructor() {
        // Auto-init on client-side only
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    /**
     * Initialize the DB worker and connection.
     */
    async init() {
        if (this.worker) return;

        try {
            // Standard Vite/ESM Worker instantiation
            this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
                type: 'module'
            });

            this.worker.onmessage = (event) => {
                const { type, id, payload } = event.data;

                if (type === 'DB_READY') {
                    this.isReady = true;
                    console.log('[DatabaseManager] DB Ready');
                } else if (type === 'DB_ERROR') {
                    this.error = payload.message;
                    console.error('[DatabaseManager] DB Error:', payload.message);
                } else if (type === 'CMD_SUCCESS') {
                    const req = this.pendingRequests.get(id);
                    if (req) {
                        req.resolve(payload.result);
                        this.pendingRequests.delete(id);
                    }
                } else if (type === 'CMD_ERROR') {
                    const req = this.pendingRequests.get(id);
                    if (req) {
                        req.reject(new Error(payload.message));
                        this.pendingRequests.delete(id);
                    }
                }
            };

            // Send INIT command
            this.worker.postMessage({ type: 'INIT_DB' });

        } catch (err: any) {
            this.error = err.message;
            console.error('[DatabaseManager] Failed to spawn worker:', err);
        }
    }

    /**
     * Generic method to send commands to the worker.
     */
    private async send(type: string, payload: any = {}): Promise<any> {
        if (!this.worker) {
            console.error('[DB] Worker not initialized');
            throw new Error('DB Worker not initialized');
        }

        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            this.pendingRequests.set(id, { id, resolve, reject });
            console.log(`[DB] Sending command: ${type}`);
            this.worker!.postMessage({
                type,
                id,
                payload
            });
        });
    }

    /**
     * Exec SQL query.
     */
    private async exec(sql: string, params: object = {}): Promise<any[]> {
        const rows = await this.send('EXEC_SQL', { sql, params });
        return rows;
    }

    // --- Public API ---

    async getTracks(): Promise<Track[]> {
        return this.exec('SELECT * FROM tracks ORDER BY date_added DESC');
    }

    async getTrackCount(): Promise<number> {
        const result = await this.exec('SELECT COUNT(*) as count FROM tracks');
        if (!result || !Array.isArray(result) || result.length === 0) {
            return 0;
        }
        return result[0].count as number;
    }

    async upsertTrack(track: Partial<Track>): Promise<void> {
        return this.upsertTracks([track]);
    }

    async upsertTracks(tracks: Partial<Track>[]): Promise<void> {
        await this.send('UPSERT_TRACKS', { tracks });
    }

    /**
     * Export the current database as a binary Blob.
     */
    async exportDatabase(): Promise<Blob> {
        const res = await this.send('EXPORT_DB');
        return res.result as Blob;
    }

    /**
     * Import a database file, overwriting the current one.
     * WARNING: This operation is destructive and triggers a reload.
     */
    async importDatabase(file: File | Blob): Promise<void> {
        try {
            return await this.send('IMPORT_DB', { file });
        } catch (err) {
            console.error('[DB] importDatabase failed:', err);
            throw err;
        }
    }
    async getAlbums(): Promise<any[]> {
        try {
            const result = await this.send('GET_ALBUMS', {});
            return Array.isArray(result) ? result : [];
        } catch (err) {
            console.error('[DB] getAlbums failed:', err);
            return [];
        }
    }

    async getArtists(): Promise<any[]> {
        try {
            const result = await this.send('GET_ARTISTS', {});
            return Array.isArray(result) ? result : [];
        } catch (err) {
            console.error('[DB] getArtists failed:', err);
            return [];
        }
    }

    async getPlaylists(): Promise<any[]> {
        try {
            const result = await this.send('GET_PLAYLISTS', {});
            return Array.isArray(result) ? result : [];
        } catch (err) {
            console.error('[DB] getPlaylists failed:', err);
            return [];
        }
    }
}

// Singleton instance
export const db = new DatabaseManager();
