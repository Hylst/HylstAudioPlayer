// src/lib/audio/playlists.svelte.ts — Playlist & Favorites Management Store
// Svelte 5 Runes — Full reactive store with favorites support

import { db } from '$lib/db/database.svelte';
import type { Track } from '$lib/types';

export interface PlaylistMeta {
    id: number;
    name: string;
    description: string | null;
    is_favorites: number; // 0 = normal, 1 = built-in Favorites
    track_count: number;
    date_created: number;
}

export class PlaylistStore {
    // ─── State ──────────────────────────────────────────────────────────────────
    allPlaylists = $state<PlaylistMeta[]>([]);
    activePlaylist = $state<PlaylistMeta | null>(null);
    activePlaylistTracks = $state<Track[]>([]);
    favoriteIds = $state<Set<number>>(new Set());
    isLoading = $state(false);

    // ─── Derived ─────────────────────────────────────────────────────────────────
    // $derived.by ensures Svelte tracks allPlaylists reads even in nested filters
    customPlaylists = $derived.by(() => this.allPlaylists.filter(p => !p.is_favorites));
    favoritesPlaylist = $derived.by(() => this.allPlaylists.find(p => p.is_favorites === 1));

    constructor() {
        // $effect.root is required for effects created outside a Svelte component
        // (module-level singleton). Bare $effect() here would throw at import time.
        $effect.root(() => {
            $effect(() => {
                const ready = db.isReady;
                const _update = db.lastUpdate; // tracks mutations
                if (ready) {
                    void this.refresh();
                    void this.refreshFavoriteIds();
                }
            });
        });
    }

    isFavorite(trackId: number): boolean {
        return this.favoriteIds.has(trackId);
    }

    // ─── Data loading ─────────────────────────────────────────────────────────────

    async refresh(): Promise<void> {
        if (!db.isReady) return;
        try {
            const raw = await db.getPlaylists();
            this.allPlaylists = Array.isArray(raw) ? (raw as PlaylistMeta[]) : [];
        } catch (e) {
            console.error('[Playlists] refresh failed:', e);
        }
    }

    async refreshFavoriteIds(): Promise<void> {
        if (!db.isReady) return;
        try {
            const ids = await db.getFavoriteIds();
            this.favoriteIds = new Set(Array.isArray(ids) ? ids : []);
        } catch (e) {
            console.error('[Playlists] refreshFavoriteIds failed:', e);
        }
    }

    // ─── Playlist CRUD ────────────────────────────────────────────────────────────

    async create(name: string, description?: string): Promise<number> {
        const id = await db.createPlaylist(name, description);
        await this.refresh();
        return id as number;
    }

    async rename(id: number, name: string): Promise<void> {
        await db.renamePlaylist(id, name);
        await this.refresh();
        if (this.activePlaylist?.id === id) {
            this.activePlaylist = { ...this.activePlaylist, name };
        }
    }

    async delete(id: number): Promise<void> {
        await db.deletePlaylist(id);
        if (this.activePlaylist?.id === id) {
            this.activePlaylist = null;
            this.activePlaylistTracks = [];
        }
        await this.refresh();
    }

    async loadPlaylist(playlist: PlaylistMeta): Promise<void> {
        this.isLoading = true;
        this.activePlaylist = playlist;
        try {
            this.activePlaylistTracks = await db.getTracksByPlaylist(playlist.id);
        } catch (e) {
            console.error('[Playlists] Failed to load tracks:', e);
            this.activePlaylistTracks = [];
        } finally {
            this.isLoading = false;
        }
    }

    async addTrack(playlistId: number, trackId: number): Promise<void> {
        await db.addTrackToPlaylist(playlistId, trackId);
        await this.refresh(); // updates track_count
        if (this.activePlaylist?.id === playlistId) {
            await this.loadPlaylist(this.activePlaylist);
        }
    }

    async removeTrack(playlistId: number, trackId: number): Promise<void> {
        await db.removeTrackFromPlaylist(playlistId, trackId);
        await this.refresh();
        if (this.activePlaylist?.id === playlistId) {
            await this.loadPlaylist(this.activePlaylist);
        }
    }

    // ─── Favorites ────────────────────────────────────────────────────────────────

    async toggleFavorite(trackId: number): Promise<void> {
        const wasFavorite = this.favoriteIds.has(trackId);

        // Optimistic update first (instant UI feedback)
        const newSet = new Set(this.favoriteIds);
        if (wasFavorite) {
            newSet.delete(trackId);
        } else {
            newSet.add(trackId);
        }
        this.favoriteIds = newSet;

        // Write to DB
        try {
            if (wasFavorite) {
                await db.removeFavorite(trackId);
            } else {
                await db.addFavorite(trackId);
            }
            // Reload to confirm with DB state
            await this.refreshFavoriteIds();
        } catch (e) {
            // Rollback optimistic update on error
            const rollback = new Set(this.favoriteIds);
            if (wasFavorite) rollback.add(trackId);
            else rollback.delete(trackId);
            this.favoriteIds = rollback;
            console.error('[Playlists] toggleFavorite failed:', e);
        }

        // Refresh the active favorites playlist if open
        if (this.activePlaylist?.is_favorites) {
            const fav = this.favoritesPlaylist;
            if (fav) await this.loadPlaylist(fav);
        }
    }
}

export const playlists = new PlaylistStore();
