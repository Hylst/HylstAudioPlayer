import { describe, it, expect } from 'vitest';
import { DB_SCHEMA_DDL, CURRENT_DB_VERSION } from '$lib/db/schema';
import { Q } from '$lib/db/queries';

describe('Database Schema', () => {
    it('should have a valid DDL string', () => {
        expect(typeof DB_SCHEMA_DDL).toBe('string');
        expect(DB_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS tracks');
        expect(DB_SCHEMA_DDL).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts');
    });

    it('should have a valid version number', () => {
        expect(typeof CURRENT_DB_VERSION).toBe('number');
        expect(CURRENT_DB_VERSION).toBeGreaterThan(0);
    });
});

describe('Database Queries', () => {
    it('should have valid query strings', () => {
        for (const [key, value] of Object.entries(Q)) {
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
            expect(key).toBeDefined();
        }
    });

    it('should have correct parameters in queries', () => {
        expect(Q.GET_TRACK_BY_PATH).toContain('$path');
        expect(Q.SEARCH_TRACKS).toContain('$query');
    });
});
