import type { IAudioMetadata } from 'music-metadata';
import type { Track } from '$lib/types';

/**
 * Maps music-metadata IAudioMetadata to HAP Track interface.
 * Extracts all available extended tags (v2): composer, lyrics, ISRC,
 * label, comment, mood, ReplayGain.
 */
export function mapMetadataToTrack(
    metadata: IAudioMetadata,
    filePath: string,
    stats?: { size: number; mtime: Date }
): Partial<Track> {
    const common = metadata.common;
    const format = metadata.format;

    // ─── ReplayGain ───────────────────────────────────────────────────────────
    // music-metadata exposes replaygain_track_gain as a string like "-6.32 dB"
    let replaygainDb: number | undefined;
    const rgRaw = common.replaygain_track_gain;
    if (rgRaw !== undefined) {
        const parsed = typeof rgRaw === 'number'
            ? rgRaw
            : parseFloat(String(rgRaw).replace(/\s*dB/i, ''));
        if (!isNaN(parsed)) replaygainDb = parsed;
    }

    // ─── ISRC — may be on the recording or in native tags ─────────────────────
    const isrc = (common as any).isrc ?? undefined;

    // ─── Label (Publisher) ────────────────────────────────────────────────────
    const label = (common as any).label ?? (common as any).organization ?? undefined;

    const track: Partial<Track> = {
        file_path: filePath,
        title: common.title || filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown Title',
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        album_artist: common.albumartist || common.artist,
        genre: common.genre ? common.genre[0] : undefined,
        year: common.year,
        track_number: common.track.no ?? undefined,
        disc_number: common.disk.no ?? undefined,
        duration: format.duration ?? 0,
        bitrate: format.bitrate,
        sample_rate: format.sampleRate,
        play_count: 0,
        rating: 0,
        bpm: common.bpm,
        musicbrainz_id: common.musicbrainz_trackid,
        date_added: new Date(),
        // Extended tags (v2)
        composer: common.composer ? common.composer[0] : undefined,
        lyrics: common.lyrics ? common.lyrics[0]?.text ?? common.lyrics[0] as unknown as string : undefined,
        isrc,
        label: Array.isArray(label) ? label[0] : label,
        comment: common.comment ? (common.comment[0]?.text ?? String(common.comment[0])) : undefined,
        mood: (common as any).mood ?? undefined,
        replaygain_track_db: replaygainDb,
        keywords: [], // user-managed, not extracted from tags
    };

    return track;
}

/**
 * Generates a SHA-256 hash of a file for duplicate detection.
 * Uses Web Crypto API.
 */
export async function computeFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Extract artwork blob from metadata if present.
 * Returns the highest-quality (largest) picture found.
 */
export function extractArtwork(metadata: IAudioMetadata): Blob | null {
    const pictures = metadata.common.picture;
    if (!pictures || pictures.length === 0) return null;
    // Prefer front cover; fallback to first
    const cover = pictures.find(p => p.type === 'Cover (front)') ?? pictures[0];
    return new Blob([cover.data.buffer as ArrayBuffer], { type: cover.format });
}
