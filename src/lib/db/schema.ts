// src/lib/db/schema.ts — Database Schema Definition
// Source of truth: SPEC.md §4

/**
 * Full Database Definition Language (DDL) for HAP.
 * Includes tables for tracks, albums, artists, playlists, favorites, folders.
 */
export const DB_SCHEMA_DDL = `
-- Table principale
CREATE TABLE IF NOT EXISTS tracks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path       TEXT UNIQUE NOT NULL,
  file_hash       TEXT,
  title           TEXT,
  artist          TEXT,
  album           TEXT,
  album_artist    TEXT,
  genre           TEXT,
  year            INTEGER,
  track_number    INTEGER,
  disc_number     INTEGER,
  duration        REAL,
  bitrate         INTEGER,
  sample_rate     INTEGER,
  play_count      INTEGER DEFAULT 0,
  last_played     DATETIME,
  date_added      DATETIME DEFAULT CURRENT_TIMESTAMP,
  rating          INTEGER CHECK(rating BETWEEN 0 AND 5),
  bpm             INTEGER,
  artwork_hash    TEXT,
  musicbrainz_id  TEXT,
  acoustid_id     TEXT,
  -- Extended tags (v2)
  composer        TEXT,
  lyrics          TEXT,
  isrc            TEXT,
  label           TEXT,
  comment         TEXT,
  mood            TEXT,
  replaygain_track_db REAL,
  keywords        TEXT,  -- JSON array of user-defined tags
  -- File metadata (v4)
  file_size       INTEGER,        -- File.size in bytes
  file_format     TEXT,           -- mp3 | flac | ogg | opus | m4a | wav | wma
  codec           TEXT,           -- MPEG 1 Layer 3, FLAC, Vorbis, Opus…
  codec_profile   TEXT,           -- ID3v2.4, Vorbis 1.0, …
  tag_types       TEXT,           -- JSON: ["ID3v2.3","APEv2"]
  date_modified   INTEGER         -- File.lastModified (ms since epoch)
);

CREATE TABLE IF NOT EXISTS albums (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  artist          TEXT,
  year            INTEGER,
  artwork_path    TEXT,
  musicbrainz_id  TEXT,
  date_added      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artists (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT UNIQUE NOT NULL,
  musicbrainz_id  TEXT,
  bio             TEXT,
  image_url       TEXT
);

CREATE TABLE IF NOT EXISTS playlists (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  description     TEXT,
  date_created    DATETIME DEFAULT CURRENT_TIMESTAMP,
  date_modified   DATETIME,
  is_smart        BOOLEAN DEFAULT 0,
  is_favorites    BOOLEAN DEFAULT 0,
  smart_criteria  TEXT  -- JSON SQL-like criteria
);

-- Seed the built-in Favorites playlist (id=1)
INSERT OR IGNORE INTO playlists (id, name, description, is_favorites)
  VALUES (1, 'Favorites', 'Your favorite tracks', 1);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id     INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
  track_id        INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  track_id        INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  date_added      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS folders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  path            TEXT UNIQUE NOT NULL,
  handle_id       TEXT,
  last_scanned    DATETIME,
  track_count     INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tracks_artist      ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album       ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_genre       ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_year        ON tracks(year);
CREATE INDEX IF NOT EXISTS idx_tracks_play_count  ON tracks(play_count DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_last_played ON tracks(last_played DESC);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
  title, artist, album, content=tracks, content_rowid=id
);

-- Triggers to keep FTS updated
CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
  INSERT INTO tracks_fts(rowid, title, artist, album) VALUES (new.id, new.title, new.artist, new.album);
END;
CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
  INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album) VALUES('delete', old.id, old.title, old.artist, old.album);
END;
CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
  INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album) VALUES('delete', old.id, old.title, old.artist, old.album);
  INSERT INTO tracks_fts(rowid, title, artist, album) VALUES (new.id, new.title, new.artist, new.album);
END;
`;

/**
 * Current User Version of the database (for migrations).
 * Increment this number when adding new migrations.
 */
export const CURRENT_DB_VERSION = 4;

/**
 * Type guard to check if a DB row is a Track.
 */
export function isTrack(row: unknown): row is import('../types').Track {
  return typeof row === 'object' && row !== null && 'file_path' in row && 'id' in row;
}
