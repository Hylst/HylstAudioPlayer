// src/lib/meta/deezer.ts — Deezer Public API (no API key required)
// Deezer's public search API is free for basic search, no key or OAuth needed.
// Docs: https://developers.deezer.com/api/search
// NOTE: Deezer API lacks CORS headers for browser requests — use a proxy or
//       the app must handle CORS errors gracefully. We attempt and silently fail.

import type { TrackIdentification } from './musicbrainz';

// Deezer blocks direct browser CORS. We use their unofficial /search endpoint.
// In production a proxy (e.g. allorigins.win) can be used; for now we try directly.
const DEEZER_BASE = 'https://api.deezer.com/search';
const CORS_PROXY = 'https://corsproxy.io/?';

export interface DeezerTrack {
    id: number;
    title: string;
    duration: number;
    artist: { name: string };
    album: { title: string; cover_medium?: string };
    release_date?: string;
    rank: number;
}

/**
 * Search Deezer for a song.
 * Uses corsproxy.io as a CORS bridge since Deezer blocks direct browser requests.
 * Silently returns [] if the API is unavailable.
 */
export async function searchDeezer(
    title: string,
    artist: string,
    limit = 5
): Promise<TrackIdentification[]> {
    const q = encodeURIComponent(`track:"${title}" artist:"${artist}"`);
    const target = encodeURIComponent(`${DEEZER_BASE}?q=${q}&limit=${limit}`);
    const url = `${CORS_PROXY}${target}`;

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000),  // 6s timeout
        });

        if (!response.ok) return [];

        const data = await response.json() as { data?: DeezerTrack[]; error?: unknown };
        if (data.error || !Array.isArray(data.data)) return [];

        return data.data.slice(0, limit).map((r, idx): TrackIdentification => {
            const year = r.release_date
                ? parseInt(r.release_date.split('-')[0], 10)
                : undefined;

            return {
                mbid: `deezer:${r.id}`,  // virtual MBID — prefixed with source
                title: r.title,
                artist: r.artist.name,
                album: r.album.title,
                year: isNaN(year ?? NaN) ? undefined : year,
                artworkUrl: r.album.cover_medium,
                score: Math.max(100 - idx * 15, 10),
            };
        });
    } catch {
        // CORS error or timeout — silently return empty
        return [];
    }
}
