import type { IAudioMetadata } from 'music-metadata';
import type { Track } from '$lib/types';

/**
 * Maps music-metadata IAudioMetadata to HAP Track interface.
 */
export function mapMetadataToTrack(
    metadata: IAudioMetadata,
    filePath: string,
    stats?: { size: number; mtime: Date }
): Partial<Track> {
    const common = metadata.common;
    const format = metadata.format;

    // Best effort mapping
    const track: Partial<Track> = {
        file_path: filePath,
        title: common.title || filePath.split('/').pop() || 'Unknown Title',
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
        date_added: new Date(), // Will be overwritten by DB default or preserved
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
 */
export function extractArtwork(metadata: IAudioMetadata): Blob | null {
    const picture = metadata.common.picture?.[0];
    if (picture) {
        return new Blob([picture.data], { type: picture.format });
    }
    return null;
}
