// src/lib/db/migrations.ts — Database Migrations
// Versioning system for the SQLite database

import { DB_SCHEMA_DDL, CURRENT_DB_VERSION } from './schema';

/**
 * Applies necessary migrations to the database.
 * @param db - The SQLite connection object from the worker
 */
export function migrateDatabase(db: any) {
    // Get current version
    let version = 0;
    try {
        const result = db.selectValue('PRAGMA user_version');
        version = typeof result === 'number' ? result : 0;
        console.log('[Migration] Current DB version:', version);
    } catch (err) {
        console.warn('[Migration] Could not read user_version, assuming 0');
    }

    if (version === 0) {
        // Fresh install — execute full DDL
        console.log('[Migration] Fresh install, executing full DDL schema...');
        db.exec(DB_SCHEMA_DDL);
        db.exec(`PRAGMA user_version = ${CURRENT_DB_VERSION}`);
        return;
    }

    if (version < CURRENT_DB_VERSION) {
        console.log(`[Migration] Upgrading from v${version} to v${CURRENT_DB_VERSION}...`);

        // v1 → v2: Extended ID3 tags
        if (version < 2) {
            console.log('[Migration] v1→v2: Adding extended tag columns...');
            const newColumns: [string, string][] = [
                ['composer', 'TEXT'],
                ['lyrics', 'TEXT'],
                ['isrc', 'TEXT'],
                ['label', 'TEXT'],
                ['comment', 'TEXT'],
                ['mood', 'TEXT'],
                ['replaygain_track_db', 'REAL'],
                ['keywords', 'TEXT'],
            ];
            for (const [col, type] of newColumns) {
                try {
                    db.exec(`ALTER TABLE tracks ADD COLUMN ${col} ${type}`);
                } catch (e) {
                    // Column may already exist if migration was partially run
                    console.warn(`[Migration] Skipping ${col} (may already exist):`, e);
                }
            }
        }

        // v2 → v3: playlists, playlist_tracks, favorites tables
        if (version < 3) {
            console.log('[Migration] v2→v3: Adding playlists, playlist_tracks, favorites tables...');
            db.exec(`
                CREATE TABLE IF NOT EXISTS playlists (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    name            TEXT NOT NULL,
                    description     TEXT,
                    date_created    DATETIME DEFAULT CURRENT_TIMESTAMP,
                    date_modified   DATETIME,
                    is_smart        BOOLEAN DEFAULT 0,
                    is_favorites    BOOLEAN DEFAULT 0
                );
            `);
            db.exec(`
                CREATE TABLE IF NOT EXISTS playlist_tracks (
                    playlist_id     INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
                    track_id        INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
                    position        INTEGER NOT NULL,
                    PRIMARY KEY (playlist_id, track_id)
                );
            `);
            db.exec(`
                CREATE TABLE IF NOT EXISTS favorites (
                    track_id        INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                    date_added      DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
            // Seed a "Favorites" built-in playlist
            try {
                const existing = db.selectValue('SELECT COUNT(*) FROM playlists WHERE is_favorites = 1');
                if (existing === 0) {
                    db.exec("INSERT INTO playlists (name, description, is_favorites) VALUES ('Favorites', 'Your favorite tracks', 1)");
                }
            } catch { }
        }

        // v3 → v4: File metadata columns
        if (version < 4) {
            console.log('[Migration] v3→v4: Adding file metadata columns...');
            const v4Columns: [string, string][] = [
                ['file_size', 'INTEGER'],
                ['file_format', 'TEXT'],
                ['codec', 'TEXT'],
                ['codec_profile', 'TEXT'],
                ['tag_types', 'TEXT'],
                ['date_modified', 'INTEGER'],
            ];
            for (const [col, type] of v4Columns) {
                try {
                    db.exec(`ALTER TABLE tracks ADD COLUMN ${col} ${type}`);
                } catch (e) {
                    console.warn(`[Migration] Skipping ${col} (may already exist):`, e);
                }
            }
        }

        // v4 → v5: Playlist cover_art column
        if (version < 5) {
            console.log('[Migration] v4→v5: Adding cover_art to playlists...');
            try {
                db.exec(`ALTER TABLE playlists ADD COLUMN cover_art TEXT`);
            } catch (e) {
                console.warn('[Migration] Skipping cover_art (may already exist):', e);
            }
        }

        // v5 → v6: Safety net — ensure all v2 extended columns exist.
        // Needed when a DB was created from an old schema.ts DDL that was missing
        // these columns, but user_version was already at 5 (skipping the v1→v2 migration).
        if (version < 6) {
            console.log('[Migration] v5→v6: Ensuring all extended track columns exist...');
            const ensureColumns: [string, string][] = [
                ['composer', 'TEXT'],
                ['lyrics', 'TEXT'],
                ['isrc', 'TEXT'],
                ['label', 'TEXT'],
                ['comment', 'TEXT'],
                ['mood', 'TEXT'],
                ['replaygain_track_db', 'REAL'],
                ['keywords', 'TEXT'],
                ['music_brainz_id', 'TEXT'],
                ['acoustid_id', 'TEXT'],
                ['bpm', 'REAL'],
            ];
            for (const [col, type] of ensureColumns) {
                try {
                    db.exec(`ALTER TABLE tracks ADD COLUMN ${col} ${type}`);
                    console.log(`[Migration] v5→v6: Added column ${col}`);
                } catch {
                    // Column already exists — expected for most installations
                }
            }
        }

        db.exec(`PRAGMA user_version = ${CURRENT_DB_VERSION}`);
        console.log('[Migration] Done.');
    } else {
        console.log('[Migration] Database is up to date.');
    }
}
