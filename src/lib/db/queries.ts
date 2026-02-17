// src/lib/db/queries.ts — Prepared SQL Queries
// Optimization: constants for commonly used SQL

export const Q = {
    // Tracks
    GET_ALL_TRACKS: `SELECT * FROM tracks ORDER BY date_added DESC`,
    GET_TRACK_BY_PATH: `SELECT * FROM tracks WHERE file_path = $path`,

    // FTS
    SEARCH_TRACKS: `
    SELECT t.* 
    FROM tracks_fts f 
    JOIN tracks t ON f.rowid = t.id 
    WHERE tracks_fts MATCH $query 
    ORDER BY rank
  `,

    // Stats
    COUNT_TRACKS: `SELECT COUNT(*) as count FROM tracks`,
};
