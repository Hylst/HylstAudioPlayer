// src/lib/audio/player.svelte.ts — Global Audio Store
// Svelte 5 Runes

import type { Track, EQBand } from '$lib/types';
import { AudioEngine } from './audioEngine';
import { fsManager } from '$lib/fs/fileSystemManager.svelte';
import { Visualizer } from './visualizer';
import { updateMediaSession, clearMediaSession } from './mediaSession';

const DEFAULT_EQ_BANDS: EQBand[] = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map(f => ({
    frequency: f,
    gain: 0,
    type: 'peaking'
}));

class PlayerStore {
    // State
    currentTrack = $state<Track | null>(null);
    isPlaying = $state(false);
    currentTime = $state(0);
    duration = $state(0);
    volume = $state(1);
    queue = $state<Track[]>([]);
    queueIndex = $state(0);
    repeatMode = $state<'off' | 'one' | 'all'>('off');
    shuffleEnabled = $state(false);
    currentTrackArtworkUrl = $state<string | null>(null);

    // Internal
    private engine: AudioEngine;
    private timeInterval: any;

    // Public
    visualizer: any; // Type 'Visualizer' causing import issues? Using 'any' for now to unblock or need to import Visualizer class if not already.

    constructor() {
        if (typeof window !== 'undefined') {
            this.engine = new AudioEngine();
            this.visualizer = new Visualizer(this.engine.analyserNode);
            // Sync volume
            this.engine.setVolume(this.volume);
        } else {
            // SSR shim
            this.engine = {} as AudioEngine;
            this.visualizer = {} as Visualizer;
        }
    }

    // Derived
    get progress() {
        return this.duration > 0 ? this.currentTime / this.duration : 0;
    }

    // Actions
    async play(track: Track) {
        if (this.currentTrack?.id === track.id) {
            this.togglePlay();
            return;
        }
        // If no queue set yet, create a single-track queue
        if (this.queue.length === 0) {
            this.queue = [track];
            this.queueIndex = 0;
        } else {
            // Find in current queue
            const idx = this.queue.findIndex(t => t.id === track.id);
            if (idx >= 0) {
                this.queueIndex = idx;
            } else {
                // Not in queue, reset
                this.queue = [track];
                this.queueIndex = 0;
            }
        }
        await this._loadAndPlay(track);
    }

    /** Play a track from a given list (sets the queue) */
    async playFromList(tracks: Track[], index: number) {
        this.queue = [...tracks];
        this.queueIndex = Math.max(0, Math.min(index, tracks.length - 1));
        this.currentTrack = tracks[this.queueIndex];
        await this._loadAndPlay(this.currentTrack);
    }

    private async _loadAndPlay(track: Track) {
        this.currentTrack = track;
        try {
            const fileHandle = await fsManager.getFileHandle(track.file_path);
            if (!fileHandle) throw new Error('File not found: ' + track.file_path);
            const file = await fileHandle.getFile();
            const buffer = await file.arrayBuffer();
            await this.engine.loadTrack(buffer);
            this.engine.play();
            this.isPlaying = true;
            this.duration = this.engine.getDuration();

            // UPDATE ARTWORK URL — revoke previous to avoid memory leak
            if (this.currentTrackArtworkUrl) {
                URL.revokeObjectURL(this.currentTrackArtworkUrl);
                this.currentTrackArtworkUrl = null;
            }
            if (this.currentTrack.artwork_hash) {
                this.currentTrackArtworkUrl = await this.getArtworkUrl(this.currentTrack.artwork_hash);
            }

            this.startTimer();
        } catch (err) {
            console.error('[Player] Failed to play track:', err);
            this.isPlaying = false;
        }
    }

    private async getArtworkUrl(hash: string): Promise<string | null> {
        try {
            const root = await navigator.storage.getDirectory();
            const artDir = await root.getDirectoryHandle('art');

            // We don't know the extension exactly, but we can try common ones or list directory
            // For now, let's assume we saved it as .jpg or .png
            // A more robust way is to iterate the directory
            // @ts-ignore
            for await (const entry of artDir.values()) {
                if (entry.name.startsWith(hash)) {
                    const file = await entry.getFile();
                    return URL.createObjectURL(file);
                }
            }
            return null;
        } catch (err) {
            return null;
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.engine.pause();
            this.isPlaying = false;
            this.stopTimer();
        } else {
            this.engine.play();
            this.isPlaying = true;
            this.startTimer();
        }
    }

    seek(time: number) {
        this.engine.seek(time);
        this.currentTime = time;
    }

    setVolume(v: number) {
        this.volume = v;
        this.engine.setVolume(v);
    }

    setEQBand(index: number, gain: number) {
        this.engine.setEQBand(index, gain);
    }

    next() {
        if (this.queue.length === 0) return;
        if (this.shuffleEnabled) {
            const nextIndex = Math.floor(Math.random() * this.queue.length);
            this.queueIndex = nextIndex;
            this._loadAndPlay(this.queue[nextIndex]);
            return;
        }
        let nextIndex = this.queueIndex + 1;
        if (nextIndex >= this.queue.length) {
            if (this.repeatMode === 'all') nextIndex = 0;
            else return; // End of queue
        }
        this.queueIndex = nextIndex;
        this._loadAndPlay(this.queue[nextIndex]);
    }

    previous() {
        if (this.currentTime > 3) {
            this.seek(0);
            return;
        }
        if (this.queue.length === 0) return;
        let prevIndex = this.queueIndex - 1;
        if (prevIndex < 0) {
            if (this.repeatMode === 'all') prevIndex = this.queue.length - 1;
            else prevIndex = 0;
        }
        this.queueIndex = prevIndex;
        this._loadAndPlay(this.queue[prevIndex]);
    }

    addToQueue(track: Track) {
        this.queue.push(track);
    }

    private startTimer() {
        this.stopTimer();
        this.timeInterval = setInterval(() => {
            this.currentTime = this.engine.getCurrentTime();
            // Update OS media session position
            if (this.currentTrack) {
                updateMediaSession(
                    this.currentTrack,
                    this.isPlaying,
                    this.currentTime,
                    this.duration,
                    () => this.togglePlay(),
                    () => this.togglePlay(),
                    () => this.next(),
                    () => this.previous(),
                    (t) => this.seek(t),
                );
            }
            // Check end
            if (this.currentTime >= this.duration && this.duration > 0) {
                this.handleTrackEnd();
            }
        }, 500); // 500ms is sufficient for MediaSession position updates
    }

    private stopTimer() {
        if (this.timeInterval) clearInterval(this.timeInterval);
    }

    private handleTrackEnd() {
        if (this.repeatMode === 'one') {
            this.seek(0);
            this.engine.play();
        } else {
            this.next();
        }
    }
}

export const player = new PlayerStore();
