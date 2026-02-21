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
    lastUpdate = $state(0);
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
        return result?.[0]?.count || 0;
    }

    async getLibraryStats(): Promise<{ count: number; totalDuration: number }> {
        const result = await this.exec('SELECT COUNT(*) as count, SUM(duration) as totalDuration FROM tracks');
        return {
            count: result?.[0]?.count || 0,
            totalDuration: result?.[0]?.totalDuration || 0
        };
    }

    async getTracksDetailed(orderBy = 'date_added', order = 'DESC'): Promise<Track[]> {
        // Basic protection against SQL injection for orderBy/order since they are strings
        const validCols = ['date_added', 'title', 'artist', 'album', 'duration'];
        const safeOrderBy = validCols.includes(orderBy) ? orderBy : 'date_added';
        const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

        return this.exec(`SELECT * FROM tracks ORDER BY ${safeOrderBy} ${safeOrder}`);
    }

    async upsertTrack(track: Partial<Track>): Promise<void> {
        return this.upsertTracks([track]);
    }

    async upsertTracks(tracks: Partial<Track>[]): Promise<void> {
        await this.send('UPSERT_TRACKS', { tracks });
        this.lastUpdate++;
        console.log('[DB] lastUpdate incremented to:', this.lastUpdate);
    }

    /** Fetch a single track with all extended tags (keywords hydrated from JSON). */
    async getTrackById(id: number): Promise<Track | null> {
        const result = await this.send('GET_TRACK_BY_ID', { id });
        // Note: send() already resolves with payload.result from the worker CMD_SUCCESS handler.
        // The worker for GET_TRACK_BY_ID sends { result: track } in the payload,
        // so payload.result IS the track object. No extra .result dereference needed.
        if (!result) return null;
        // Handle both shapes: direct Track object OR { result: Track } wrapper
        const track = (result && typeof result === 'object' && 'id' in result)
            ? result as Track
            : ((result as any)?.result as Track ?? null);
        return track;
    }

    /**
     * Partially update a track's fields (e.g. keywords, rating, mood).
     * Only the provided fields will be changed. Triggers a reactive lastUpdate.
     */
    async updateTrack(trackId: number, fields: Partial<Track>): Promise<void> {
        await this.send('UPDATE_TRACK', { trackId, fields });
        this.lastUpdate++;
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

    async createPlaylist(name: string, description?: string): Promise<number> {
        const id = await this.send('CREATE_PLAYLIST', { name, description });
        this.lastUpdate++;
        return id;
    }

    async deletePlaylist(id: number): Promise<void> {
        await this.send('DELETE_PLAYLIST', { id });
        this.lastUpdate++;
    }

    async addTrackToPlaylist(playlistId: number, trackId: number): Promise<void> {
        await this.send('ADD_TRACK_TO_PLAYLIST', { playlistId, trackId });
        this.lastUpdate++;
    }

    async removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<void> {
        await this.send('REMOVE_TRACK_FROM_PLAYLIST', { playlistId, trackId });
        this.lastUpdate++;
    }

    async getTracksByPlaylist(playlistId: number): Promise<Track[]> {
        return this.send('GET_PLAYLIST_TRACKS', { playlistId });
    }

    async renamePlaylist(id: number, name: string): Promise<void> {
        await this.send('RENAME_PLAYLIST', { id, name });
        this.lastUpdate++;
    }

    async reorderPlaylistTracks(playlistId: number, order: number[]): Promise<void> {
        await this.send('REORDER_PLAYLIST_TRACKS', { playlistId, order });
        this.lastUpdate++;
    }

    async updatePlaylistCover(id: number, coverArt: string | null): Promise<void> {
        await this.send('UPDATE_PLAYLIST_COVER', { id, coverArt });
        this.lastUpdate++;
    }

    async resetLibrary(): Promise<void> {
        await this.send('RESET_LIBRARY', {});
        this.lastUpdate++;
    }

    // ─── Favorites ─────────────────────────────────────────────────────────────

    async addFavorite(trackId: number): Promise<void> {
        await this.send('ADD_FAVORITE', { trackId });
        this.lastUpdate++;
    }

    async removeFavorite(trackId: number): Promise<void> {
        await this.send('REMOVE_FAVORITE', { trackId });
        this.lastUpdate++;
    }

    async isFavorite(trackId: number): Promise<boolean> {
        return this.send('IS_FAVORITE', { trackId });
    }

    async getFavorites(): Promise<Track[]> {
        try {
            const result = await this.send('GET_FAVORITES', {});
            return Array.isArray(result) ? result : [];
        } catch {
            return [];
        }
    }

    async getFavoriteIds(): Promise<number[]> {
        try {
            const result = await this.send('GET_FAVORITE_IDS', {});
            return Array.isArray(result) ? result : [];
        } catch {
            return [];
        }
    }
}

// Singleton instance
export const db = new DatabaseManager();
