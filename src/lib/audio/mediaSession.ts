// src/lib/audio/mediaSession.ts
// OS Media Session API — keyboard shortcuts + lockscreen controls
// Called from player.svelte.ts each time track/state changes.

import type { Track } from '$lib/types';

export function updateMediaSession(
    track: Track,
    isPlaying: boolean,
    currentTime: number,
    duration: number,
    onPlay: () => void,
    onPause: () => void,
    onNext: () => void,
    onPrev: () => void,
    onSeek: (time: number) => void,
): void {
    if (!('mediaSession' in navigator)) return;

    // Metadata
    navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title ?? 'Unknown Track',
        artist: track.artist ?? 'Unknown Artist',
        album: track.album ?? '',
        artwork: [], // TODO: add track artwork when available
    });

    // Playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    // Position state
    if (duration > 0) {
        try {
            navigator.mediaSession.setPositionState({
                duration,
                playbackRate: 1,
                position: Math.min(currentTime, duration),
            });
        } catch {
            // Some browsers don't support setPositionState — fail silently
        }
    }

    // Action handlers (idempotent — OK to re-register each time)
    navigator.mediaSession.setActionHandler('play', onPlay);
    navigator.mediaSession.setActionHandler('pause', onPause);
    navigator.mediaSession.setActionHandler('nexttrack', onNext);
    navigator.mediaSession.setActionHandler('previoustrack', onPrev);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) onSeek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
        onSeek(Math.min(currentTime + (details.seekOffset ?? 10), duration));
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        onSeek(Math.max(currentTime - (details.seekOffset ?? 10), 0));
    });
}

export function clearMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
}
