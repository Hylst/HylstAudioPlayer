// src/lib/meta/musicbrainz.ts
// Online music identification via MusicBrainz API + Cover Art Archive
// RULE 6: Proper error handling throughout
// RULE 3: Strict TypeScript

const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org';
const USER_AGENT = 'HylstAudioPlayer/0.1 (https://github.com/Hylst)';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MBRecording {
    id: string;
    title: string;
    length?: number;
    score: number;
    'artist-credit'?: Array<{
        name?: string;
        artist: { id: string; name: string };
    }>;
    releases?: Array<{
        id: string;
        title: string;
        date?: string;
        'release-group'?: { id: string; 'primary-type'?: string };
        'label-info'?: Array<{ label?: { name: string }; 'catalog-number'?: string }>;
    }>;
    isrcs?: string[];
    tags?: Array<{ name: string; count: number }>;
}

export interface MBSearchResult {
    recordings: MBRecording[];
    count: number;
}

export interface TrackIdentification {
    mbid: string;
    title: string;
    artist: string;
    album?: string;
    year?: number;
    label?: string;
    isrc?: string;
    artworkUrl?: string;
    score: number;
    releaseId?: string;
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Search MusicBrainz for a recording by title and artist.
 * Returns up to 5 best matches sorted by score.
 */
export async function searchMusicBrainz(
    title: string,
    artist: string
): Promise<TrackIdentification[]> {
    const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    const url = `${MB_BASE}/recording?query=${query}&limit=5&inc=artist-credits+releases+isrcs+tags&fmt=json`;

    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as MBSearchResult;

    if (!data.recordings?.length) return [];

    return data.recordings.map((rec): TrackIdentification => {
        const artistName = rec['artist-credit']?.[0]?.artist?.name ?? artist;
        const release = rec.releases?.[0];
        const labelInfo = release?.['label-info']?.[0];
        const year = release?.date ? parseInt(release.date.split('-')[0], 10) : undefined;

        return {
            mbid: rec.id,
            title: rec.title,
            artist: artistName,
            album: release?.title,
            year: isNaN(year ?? NaN) ? undefined : year,
            label: labelInfo?.label?.name,
            isrc: rec.isrcs?.[0],
            score: rec.score,
            releaseId: release?.id,
        };
    });
}

// ─── Cover Art ────────────────────────────────────────────────────────────────

/**
 * Fetch the front cover art URL from Cover Art Archive for a given release ID.
 * Returns null if no artwork is found.
 */
export async function fetchCoverArt(releaseId: string): Promise<string | null> {
    try {
        const url = `${CAA_BASE}/release/${releaseId}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
        });

        if (!response.ok) return null;

        const data = await response.json() as {
            images?: Array<{ front: boolean; image: string; thumbnails: { 250?: string; 500?: string } }>;
        };

        const front = data.images?.find((img) => img.front);
        if (!front) return null;

        // Prefer 500px thumbnail, fallback to full image
        return front.thumbnails['500'] ?? front.thumbnails['250'] ?? front.image;
    } catch {
        return null;
    }
}

/**
 * Full identification: search MB then fetch cover art for the best match.
 */
export async function identifyTrack(
    title: string,
    artist: string
): Promise<TrackIdentification[]> {
    const results = await searchMusicBrainz(title, artist);

    // Try to get cover art for the top result
    if (results.length > 0 && results[0].releaseId) {
        const artUrl = await fetchCoverArt(results[0].releaseId);
        if (artUrl) results[0].artworkUrl = artUrl;
    }

    return results;
}
