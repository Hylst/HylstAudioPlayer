// src/lib/keyboard/shortcuts.ts
// Global keyboard shortcut handler for HAP
// Call registerShortcuts() once in +layout.svelte, unregister on destroy.

import { player } from '$lib/audio/player.svelte';

function handleKeydown(e: KeyboardEvent): void {
    // Don't fire when user is typing in an input, textarea, or select
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (player.currentTrack) player.togglePlay();
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (player.currentTrack) player.seek(Math.min(player.currentTime + 5, player.duration));
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (player.currentTrack) player.seek(Math.max(player.currentTime - 5, 0));
            break;
        case 'KeyN':
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                player.next();
            }
            break;
        case 'KeyP':
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                player.previous();
            }
            break;
        case 'KeyM':
            e.preventDefault();
            if (player.volume > 0) {
                player.setVolume(0);
            } else {
                player.setVolume(1);
            }
            break;
    }
}

export function registerShortcuts(): () => void {
    if (typeof window === 'undefined') return () => { };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
}
