// src/lib/types.ts — Shared TypeScript types for Hylst Audio Player
// Source of truth: SPEC.md §8

/**
 * Represents a single audio track with all metadata and playback stats.
 */
export interface Track {
    id: number;
    file_path: string;
    file_hash?: string;
    title: string;
    artist: string;
    album: string;
    album_artist?: string;
    genre?: string;
    year?: number;
    track_number?: number;
    disc_number?: number;
    duration: number;
    bitrate?: number;
    sample_rate?: number;
    play_count: number;
    last_played?: Date;
    date_added: Date;
    rating: number;
    bpm?: number;
    artwork_hash?: string;
    musicbrainz_id?: string;
    acoustid_id?: string;
    // Extended tags (v2)
    composer?: string;
    lyrics?: string;
    isrc?: string;
    label?: string;
    comment?: string;
    mood?: string;
    replaygain_track_db?: number;
    keywords?: string[]; // stored as JSON, hydrated on read
}

/**
 * Filter criteria for querying tracks from the database.
 */
export interface TrackFilter {
    artist?: string;
    album?: string;
    genre?: string;
    yearFrom?: number;
    yearTo?: number;
    minRating?: number;
    search?: string;
    orderBy?: keyof Track;
    order?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
}

/**
 * Represents a single equalizer band.
 * Frequencies: 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz
 * Gain range: -12 dB to +12 dB
 */
export interface EQBand {
    frequency: number;
    gain: number;
    type: BiquadFilterType;
}

/**
 * Smart playlist criteria — dynamically generated SQL conditions.
 */
export interface SmartCriteria {
    conditions: Array<{
        field: keyof Track;
        operator: '=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';
        value: unknown;
    }>;
    logic?: 'AND' | 'OR';
    orderBy?: string;
    limit?: number;
}

/**
 * Result of a file reorganization preview or execution.
 */
export interface OrganizeResult {
    preview: Array<{ from: string; to: string }>;
    conflicts: Array<{ path: string; reason: string }>;
    totalFiles: number;
}

/**
 * Track metadata subset for tag editing operations.
 */
export interface TrackTags {
    title: string;
    artist: string;
    album: string;
    album_artist: string;
    genre: string;
    year: number;
    track_number: number;
    disc_number: number;
    bpm: number;
}

/** Playback repeat mode. */
export type RepeatMode = 'off' | 'one' | 'all';

/** Visualizer rendering mode. */
export type VisualizerMode = 'bars' | 'circular' | 'particles' | 'waveform';

/**
 * Discriminated union for Web Worker messages.
 * Pattern shared across all workers.
 */
export interface WorkerMessageBase {
    type: string;
}

/**
 * Represents a playlist entity.
 */
export interface Playlist {
    id: number;
    name: string;
    description?: string;
    date_created: Date;
    date_modified?: Date;
    is_smart: boolean;
    smart_criteria?: SmartCriteria;
}

/**
 * Represents a monitored folder.
 */
export interface MonitoredFolder {
    id: number;
    path: string;
    handle_id?: string;
    last_scanned?: Date;
    track_count: number;
}
