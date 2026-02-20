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

        db.exec(`PRAGMA user_version = ${CURRENT_DB_VERSION}`);
        console.log('[Migration] Done.');
    } else {
        console.log('[Migration] Database is up to date.');
    }
}
