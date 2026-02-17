// src/lib/audio/player.svelte.ts — Global Audio Store
// Svelte 5 Runes

import type { Track, EQBand } from '$lib/types';
import { AudioEngine } from './audioEngine';
import { fsManager } from '$lib/fs/fileSystemManager.svelte';

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

    // Internal
    private engine: AudioEngine;
    private timeInterval: any;

    constructor() {
        if (typeof window !== 'undefined') {
            this.engine = new AudioEngine();
            // Sync volume
            this.engine.setVolume(this.volume);
        } else {
            // SSR shim
            this.engine = {} as AudioEngine;
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

        this.currentTrack = track;
        try {
            // Get file handle
            // Helper needed to resolve path -> handle
            // For now assuming path match in FS Manager or direct retrieval if we stored handle in DB?
            // DB does NOT store handles. We need to ask FS Manager.
            // But FS Manager stores Root Handle.
            // We need to traverse or simpler: we only support playing if we can get file.
            // fsManager.getFileHandle(path) logic needed.

            const fileHandle = await fsManager.getFileHandle(track.file_path);
            if (!fileHandle) throw new Error('File not found');

            const file = await fileHandle.getFile();
            const buffer = await file.arrayBuffer();

            await this.engine.loadTrack(buffer);
            this.engine.play();
            this.isPlaying = true;
            this.duration = this.engine.getDuration();

            this.startTimer();

        } catch (err) {
            console.error('Failed to play track', err);
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
        // Logic for queue
        if (this.queue.length === 0) return;
        let nextIndex = this.queueIndex + 1;
        if (nextIndex >= this.queue.length) {
            if (this.repeatMode === 'all') nextIndex = 0;
            else return; // End of queue
        }
        this.queueIndex = nextIndex;
        this.play(this.queue[nextIndex]);
    }

    previous() {
        if (this.currentTime > 3) {
            this.seek(0);
            return;
        }
        let prevIndex = this.queueIndex - 1;
        if (prevIndex < 0) {
            if (this.repeatMode === 'all') prevIndex = this.queue.length - 1;
            else prevIndex = 0;
        }
        this.queueIndex = prevIndex;
        this.play(this.queue[prevIndex]);
    }

    addToQueue(track: Track) {
        this.queue.push(track);
    }

    // Timer for UI updates
    private startTimer() {
        this.stopTimer();
        this.timeInterval = setInterval(() => {
            this.currentTime = this.engine.getCurrentTime();
            // Check end
            if (this.currentTime >= this.duration && this.duration > 0) {
                this.handleTrackEnd();
            }
        }, 100);
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
