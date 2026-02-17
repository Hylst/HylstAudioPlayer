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

            // Run migrations
            if (db) migrateDatabase(db);

            // Notify main thread we are ready
            self.postMessage({ type: 'DB_READY' });
        } else {
            error('OPFS is NOT available in this environment.');
            self.postMessage({ type: 'DB_ERROR', payload: { message: 'OPFS not available' } });
        }
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
                const localDb = db; // Capture for transaction closure
                localDb.transaction(() => {
                    const stmt = localDb.prepare(`
                        INSERT OR REPLACE INTO tracks (
                            file_path, title, artist, album, album_artist, genre, year, 
                            track_number, disc_number, duration, bitrate, sample_rate, 
                            play_count, rating, bpm, musicbrainz_id, date_added
                        ) VALUES (
                            $file_path, $title, $artist, $album, $album_artist, $genre, $year,
                            $track_number, $disc_number, $duration, $bitrate, $sample_rate,
                            $play_count, $rating, $bpm, $musicbrainz_id, $date_added
                        )
                    `);
                    try {
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
                                $musicbrainz_id: track.musicbrainz_id,
                                $date_added: track.date_added ? new Date(track.date_added).getTime() : Date.now()
                            });
                            stmt.step();
                            stmt.reset();
                        }
                    } finally {
                        stmt.finalize();
                    }
                });
                self.postMessage({ type: 'CMD_SUCCESS', id, payload: { result: tracks.length } });
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
                    sql: `SELECT * FROM playlists ORDER BY name`,
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
