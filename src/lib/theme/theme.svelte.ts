// src/lib/theme/theme.svelte.ts — Dynamic Theme Store
// Svelte 5 Runes

import { player } from '$lib/audio/player.svelte';

export class ThemeStore {
    // State
    primaryColor = $state('rgba(99, 102, 241, 1)'); // Default indigo-500
    isDark = $state(true);

    constructor() {
        // $effect must NOT be called here — call init() from a Svelte component instead
    }

    /**
     * Must be called from within a Svelte component lifecycle (e.g. +layout.svelte).
     * Sets up the reactive effect that watches artwork changes.
     */
    init() {
        if (typeof window !== 'undefined') {
            $effect(() => {
                const url = player.currentTrackArtworkUrl;
                if (url) {
                    this.updateThemeFromArtwork(url);
                } else {
                    this.resetTheme();
                }
            });
        }
    }

    private async updateThemeFromArtwork(url: string) {
        try {
            const color = await this.extractDominantColor(url);
            if (color) {
                this.applyColor(color);
            }
        } catch (err) {
            console.error('[Theme] Failed to extract color:', err);
            this.resetTheme();
        }
    }

    private extractDominantColor(url: string): Promise<string | null> {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = url;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(null);

                // Sample at a reasonable size for performance
                canvas.width = 50;
                canvas.height = 50;
                ctx.drawImage(img, 0, 0, 50, 50);

                const data = ctx.getImageData(0, 0, 50, 50).data;

                // Find the most SATURATED pixel (HSL model)
                // rather than a flat average that produces muddy grays
                let bestR = 99, bestG = 102, bestB = 241; // fallback indigo
                let bestSaturation = -1;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i] / 255;
                    const g = data[i + 1] / 255;
                    const b = data[i + 2] / 255;

                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const l = (max + min) / 2;

                    // Skip very dark or very bright pixels
                    if (l < 0.1 || l > 0.92) continue;

                    const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));

                    if (saturation > bestSaturation) {
                        bestSaturation = saturation;
                        bestR = Math.round(r * 255);
                        bestG = Math.round(g * 255);
                        bestB = Math.round(b * 255);
                    }
                }

                // Boost brightness if too dark (ensure good contrast on dark bg)
                const lum = 0.2126 * bestR + 0.7152 * bestG + 0.0722 * bestB;
                if (lum < 60) {
                    const factor = 80 / Math.max(lum, 1);
                    bestR = Math.min(255, Math.round(bestR * factor));
                    bestG = Math.min(255, Math.round(bestG * factor));
                    bestB = Math.min(255, Math.round(bestB * factor));
                }

                resolve(`rgb(${bestR}, ${bestG}, ${bestB})`);
            };
            img.onerror = () => resolve(null);
        });
    }

    private applyColor(color: string) {
        this.primaryColor = color;
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.style.setProperty('--hap-primary', color);

            // Generate lighter/darker variants or glows
            // This is a bit simplistic, but works for the glow effect
            root.style.setProperty('--hap-primary-glow', color.replace('rgb', 'rgba').replace(')', ', 0.4)'));

            console.log('[Theme] Primary color updated:', color);
        }
    }

    private resetTheme() {
        this.applyColor('rgb(99, 102, 241)'); // Back to default
    }
}

export const theme = new ThemeStore();
