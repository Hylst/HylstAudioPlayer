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

        // Example: if (version < 2) { db.exec('ALTER TABLE ...'); }
        // For now, we are at version 1, so no upgrades logic needed yet apart from future ones.

        db.exec(`PRAGMA user_version = ${CURRENT_DB_VERSION}`);
    } else {
        console.log('[Migration] Database is up to date.');
    }
}
