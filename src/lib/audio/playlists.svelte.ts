// src/lib/audio/playlists.svelte.ts — Playlist Management Store
// Svelte 5 Runes

import { db } from '$lib/db/database.svelte';
import type { Track, Playlist } from '$lib/types';

export class PlaylistStore {
    // State
    allPlaylists = $state<any[]>([]);
    activePlaylist = $state<any | null>(null);
    activePlaylistTracks = $state<Track[]>([]);
    isLoading = $state(false);

    constructor() {
        if (typeof window !== 'undefined') {
            this.refresh();
        }
    }

    async refresh() {
        if (!db.isReady) return;
        this.allPlaylists = await db.getPlaylists();
    }

    async create(name: string, description?: string) {
        const id = await db.createPlaylist(name, description);
        await this.refresh();
        return id;
    }

    async delete(id: number) {
        await db.deletePlaylist(id);
        if (this.activePlaylist?.id === id) {
            this.activePlaylist = null;
            this.activePlaylistTracks = [];
        }
        await this.refresh();
    }

    async loadPlaylist(playlist: any) {
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

    async addTrack(playlistId: number, trackId: number) {
        await db.addTrackToPlaylist(playlistId, trackId);
        if (this.activePlaylist?.id === playlistId) {
            await this.loadPlaylist(this.activePlaylist);
        }
        await this.refresh(); // Update track counts
    }

    async removeTrack(playlistId: number, trackId: number) {
        await db.removeTrackFromPlaylist(playlistId, trackId);
        if (this.activePlaylist?.id === playlistId) {
            await this.loadPlaylist(this.activePlaylist);
        }
        await this.refresh();
    }
}

export const playlists = new PlaylistStore();
