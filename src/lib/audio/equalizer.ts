// src/lib/audio/equalizer.ts
// Svelte 5 store — bridges the EQ UI in /settings to the AudioEngine's BiquadFilterNodes
// Rule 2: Svelte 5 Runes only. Rule 3: strict TypeScript.

import { player } from './player.svelte';

// Preset definitions: 10 bands (32Hz → 16kHz), values in dB (-12 to +12)
export const EQ_PRESETS: Record<string, number[]> = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Rock: [4, 3, -1, -1, 0, 2, 4, 5, 5, 4],
    Jazz: [3, 2, 0, 2, -2, -2, 0, 1, 3, 4],
    Pop: [-1, -1, 0, 2, 4, 4, 2, 0, -1, -2],
    Classic: [4, 3, 3, 2, -1, -1, 0, 2, 3, 4],
    Electronic: [5, 4, 1, 0, -2, 2, 1, 1, 5, 5],
} as const;

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

class EqualizerStore {
    bands = $state<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    activePreset = $state('Flat');
    preampGain = $state(0);

    /** Apply a named preset */
    applyPreset(name: string): void {
        const values = EQ_PRESETS[name];
        if (!values) return;
        this.activePreset = name;
        this.bands = [...values];
        values.forEach((gain, i) => this.applyBand(i, gain));
    }

    /** Update a single band (0-indexed) and route to the engine */
    setBand(index: number, gainDb: number): void {
        this.bands = this.bands.map((b, i) => (i === index ? gainDb : b));
        this.activePreset = 'Custom';
        this.applyBand(index, gainDb);
    }

    private applyBand(index: number, gainDb: number): void {
        // Use the public setEQBand() method already exposed by PlayerStore
        if (typeof window !== 'undefined') {
            player.setEQBand(index, gainDb);
        }
    }

    /** Flat / reset */
    reset(): void {
        this.applyPreset('Flat');
        this.activePreset = 'Flat';
    }
}

export const eq = new EqualizerStore();
