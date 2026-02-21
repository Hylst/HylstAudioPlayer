// src/lib/meta/itunes.ts — iTunes Search API (no API key required)
// Apple's iTunes Search API is free, no key needed, CORS-enabled.
// Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/

import type { TrackIdentification } from './musicbrainz';

const ITUNES_BASE = 'https://itunes.apple.com/search';

export interface ItunesTrack {
    trackId: number;
    trackName: string;
    artistName: string;
    collectionName?: string;
    releaseDate?: string;
    primaryGenreName?: string;
    artworkUrl100?: string;
    artworkUrl60?: string;
    trackNumber?: number;
    discCount?: number;
    trackCount?: number;
    collectionArtistName?: string;
    kind: string;
}

/**
 * Search iTunes for a song by title + artist.
 * Returns best matches as TrackIdentification[] for compatibility with MB results.
 * Note: CORS is open for iTunes API; no User-Agent header is needed.
 */
export async function searchItunes(
    title: string,
    artist: string,
    limit = 5
): Promise<TrackIdentification[]> {
    const term = encodeURIComponent(`${title} ${artist}`);
    const url = `${ITUNES_BASE}?term=${term}&entity=song&limit=${limit}&media=music`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`iTunes API error: ${response.status}`);
    }

    const data = await response.json() as { results: ItunesTrack[] };

    return data.results
        .filter((r) => r.kind === 'song')
        .map((r, idx): TrackIdentification => {
            const year = r.releaseDate
                ? parseInt(r.releaseDate.split('-')[0], 10)
                : undefined;

            // Upgrade artwork to 500px
            const artworkUrl = r.artworkUrl100?.replace('100x100bb', '500x500bb');

            return {
                mbid: `itunes:${r.trackId}`,  // virtual MBID — prefixed so we know the source
                title: r.trackName,
                artist: r.artistName,
                album: r.collectionName,
                year: isNaN(year ?? NaN) ? undefined : year,
                artworkUrl,
                score: Math.max(100 - idx * 15, 10), // decreasing score for ranking
            };
        });
}
