/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Database } from '@sqlite.org/sqlite-wasm';

import { migrateDatabase } from './migrations';

// Declare self scope with correct type for Web Worker
declare const self: ServiceWorkerGlobalScope & {
    postMessage: (message: any) => void;
    onmessage: ((this: ServiceWorkerGlobalScope, ev: MessageEvent) => any) | null;
};

let db: Database | undefined;
let sqlite3: any;

const log = (...args: any[]) => console.log('[DB Worker]', ...args);
const error = (...args: any[]) => console.error('[DB Worker]', ...args);

// Initialize SQLite with OPFS backend
async function initDB() {
    try {
        log('Initializing SQLite3...');
        sqlite3 = await sqlite3InitModule();

        log('Running with CAPABILITIES:', sqlite3.capi.sqlite3_libversion(), sqlite3.version);

        if (sqlite3.opfs) {
            log('OPFS is available, creating persistent database...');
            // Use the OPFS VFS (Origin Private File System)
            db = new sqlite3.oo1.OpfsDb('/hylst_audio_player.db');
            log('Database opened successfully via OPFS.');
        } else {
            // Fallback to in-memory DB for dev (when COOP/COEP headers aren't working)
            log('⚠️ OPFS not available - using IN-MEMORY database (data will be lost on reload)');
            db = new sqlite3.oo1.DB(':memory:', 'c');
            log('In-memory database created successfully.');
        }

        // Run migrations
        if (db) migrateDatabase(db);

        // Notify main thread we are ready
        self.postMessage({ type: 'DB_READY' });
    } catch (err: any) {
        error('Initialization failed:', err);
        self.postMessage({ type: 'DB_ERROR', payload: { message: err.message } });
    }
}

// Handle messages from main thread
// @ts-ignore - Type conflict between MessageEvent and ExtendableMessageEvent
self.onmessage = async (event: any) => {
    const { type, payload, id } = event.data;

    // Basic command dispatcher
    switch (type) {
        case 'INIT_DB':
            await initDB();
            break;

        case 'EXEC_SQL':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const result: any[] = [];
                db.exec({
                    sql: payload.sql,
                    bind: payload.params,
                    rowMode: 'object',
                    callback: (row: any) => {
                        result.push(row);
                    }
                });
                log(`EXEC_SQL Success: ${payload.sql.substring(0, 50)}... Returns ${result.length} rows`);
                if (result.length > 0) log('First row sample:', JSON.stringify(result[0]));
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'EXPORT_DB':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                // @ts-ignore - internal API
                const byteArray = sqlite3.capi.sqlite3_js_db_export(db.pointer);
                const blob = new Blob([byteArray], { type: 'application/x-sqlite3' });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: blob } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'IMPORT_DB':
            try {
                // Close current DB
                if (db) {
                    db.close();
                    db = undefined;
                }

                // Write file to OPFS
                const root = await navigator.storage.getDirectory();
                const fileHandle = await root.getFileHandle('hylst_audio_player.db', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(payload.file);
                await writable.close();

                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: true } });

            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'UPSERT_TRACKS':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const { tracks } = payload;
                const localDb = db;
                localDb.transaction(() => {
                    const stmt = localDb.prepare(`
                        INSERT OR REPLACE INTO tracks (
                            file_path, title, artist, album, album_artist, genre, year,
                            track_number, disc_number, duration, bitrate, sample_rate,
                            play_count, rating, bpm, artwork_hash, musicbrainz_id, date_added,
                            composer, lyrics, isrc, label, comment, mood, replaygain_track_db, keywords
                        ) VALUES (
                            $file_path, $title, $artist, $album, $album_artist, $genre, $year,
                            $track_number, $disc_number, $duration, $bitrate, $sample_rate,
                            $play_count, $rating, $bpm, $artwork_hash, $musicbrainz_id, $date_added,
                            $composer, $lyrics, $isrc, $label, $comment, $mood, $replaygain_track_db, $keywords
                        )
                    `);
                    try {
                        log(`Starting transaction for ${tracks.length} tracks`);
                        for (const track of tracks) {
                            stmt.bind({
                                $file_path: track.file_path,
                                $title: track.title,
                                $artist: track.artist,
                                $album: track.album,
                                $album_artist: track.album_artist,
                                $genre: track.genre,
                                $year: track.year,
                                $track_number: track.track_number,
                                $disc_number: track.disc_number,
                                $duration: track.duration,
                                $bitrate: track.bitrate,
                                $sample_rate: track.sample_rate,
                                $play_count: track.play_count || 0,
                                $rating: track.rating || 0,
                                $bpm: track.bpm,
                                $artwork_hash: track.artwork_hash,
                                $musicbrainz_id: track.musicbrainz_id,
                                $date_added: track.date_added ? new Date(track.date_added).getTime() : Date.now(),
                                // Extended tags (v2)
                                $composer: track.composer,
                                $lyrics: track.lyrics,
                                $isrc: track.isrc,
                                $label: track.label,
                                $comment: track.comment,
                                $mood: track.mood,
                                $replaygain_track_db: track.replaygain_track_db,
                                $keywords: track.keywords ? JSON.stringify(track.keywords) : null,
                            });
                            stmt.step();
                            stmt.reset();
                        }
                        log(`Finished inner loop for ${tracks.length} tracks`);
                    } finally {
                        stmt.finalize();
                    }
                });
                log(`UPSERT_TRACKS transaction committed for ${tracks.length} tracks`);
                // Verify
                const countResult: any[] = [];
                localDb.exec({
                    sql: 'SELECT COUNT(*) as count FROM tracks',
                    rowMode: 'object',
                    callback: (row: any) => { countResult.push(row); }
                });
                log(`Verification: tracks table now has ${countResult[0]?.count} rows`);
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: countResult[0]?.count } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'GET_TRACK_BY_ID':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const result: any[] = [];
                db.exec({
                    sql: 'SELECT * FROM tracks WHERE id = ?',
                    bind: [payload.id],
                    rowMode: 'object',
                    callback: (row: any) => {
                        // Hydrate keywords JSON
                        if (row.keywords) {
                            try { row.keywords = JSON.parse(row.keywords); } catch { row.keywords = []; }
                        } else {
                            row.keywords = [];
                        }
                        result.push(row);
                    }
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: result[0] ?? null } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'UPDATE_TRACK':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const { trackId, fields } = payload as { trackId: number; fields: Record<string, unknown> };
                // Serialize keywords if present
                if (Array.isArray(fields.keywords)) {
                    fields.keywords = JSON.stringify(fields.keywords);
                }
                const setClauses = Object.keys(fields).map(k => `${k} = $${k}`).join(', ');
                const bindings: Record<string, unknown> = { $id: trackId };
                for (const [k, v] of Object.entries(fields)) bindings[`$${k}`] = v;
                // @ts-ignore - sqlite-wasm bind accepts Record<string,unknown> at runtime
                db.exec({ sql: `UPDATE tracks SET ${setClauses} WHERE id = $id`, bind: bindings });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: true } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'GET_ALBUMS':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const result: any[] = [];
                db.exec({
                    sql: `SELECT album, album_artist, artist, year, artwork_hash, COUNT(*) as track_count 
                          FROM tracks 
                          WHERE album IS NOT NULL AND album != '' 
                          GROUP BY album 
                          ORDER BY album`,
                    rowMode: 'object',
                    callback: (row: any) => { result.push(row); }
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'GET_ARTISTS':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const result: any[] = [];
                db.exec({
                    sql: `SELECT artist, COUNT(*) as track_count 
                          FROM tracks 
                          WHERE artist IS NOT NULL AND artist != '' 
                          GROUP BY artist 
                          ORDER BY artist`,
                    rowMode: 'object',
                    callback: (row: any) => { result.push(row); }
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'GET_PLAYLISTS':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const result: any[] = [];
                db.exec({
                    sql: `SELECT p.*, COUNT(pt.track_id) as track_count 
                          FROM playlists p 
                          LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id 
                          GROUP BY p.id 
                          ORDER BY p.name`,
                    rowMode: 'object',
                    callback: (row: any) => { result.push(row); }
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'CREATE_PLAYLIST':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const { name, description } = payload;
                db.exec({
                    sql: 'INSERT INTO playlists (name, description, date_created) VALUES (?, ?, ?)',
                    bind: [name, description || '', Date.now()]
                });
                const lastId = db.selectValue('SELECT last_insert_rowid()');
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: lastId } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'DELETE_PLAYLIST':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                db.exec({
                    sql: 'DELETE FROM playlists WHERE id = ?',
                    bind: [payload.id]
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: true } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'ADD_TRACK_TO_PLAYLIST':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const { playlistId, trackId } = payload;
                // Get current max position
                const maxPos = db.selectValue('SELECT COALESCE(MAX(position), 0) FROM playlist_tracks WHERE playlist_id = ?', [playlistId]) as number;
                db.exec({
                    sql: 'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
                    bind: [playlistId, trackId, maxPos + 1]
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: true } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'REMOVE_TRACK_FROM_PLAYLIST':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const { playlistId, trackId } = payload;
                db.exec({
                    sql: 'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
                    bind: [playlistId, trackId]
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: true } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        case 'GET_PLAYLIST_TRACKS':
            if (!db) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: 'DB not initialized' } });
                return;
            }
            try {
                const { playlistId } = payload;
                const result: any[] = [];
                db.exec({
                    sql: `SELECT t.* FROM tracks t 
                          JOIN playlist_tracks pt ON t.id = pt.track_id 
                          WHERE pt.playlist_id = ? 
                          ORDER BY pt.position`,
                    bind: [playlistId],
                    rowMode: 'object',
                    callback: (row: any) => { result.push(row); }
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result } });
            } catch (err: any) {
                self.postMessage({ type: 'CMD_ERROR', id, payload: { message: err.message } });
            }
            break;

        default:
            log('Unknown message type:', type);
    }
};
