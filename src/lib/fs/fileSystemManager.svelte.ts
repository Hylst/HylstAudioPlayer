// src/lib/fs/fileSystemManager.svelte.ts — File System Store
// Coordinates directory selection and scanning.
// Svelte 5 Runes.

import { get, set } from 'idb-keyval';
import { db } from '$lib/db/database.svelte';
// import ScannerWorker from './scanner.worker?worker'; // Now using standard Worker pattern

export class FileSystemManager {
    // State
    rootHandle = $state<FileSystemDirectoryHandle | null>(null);
    isScanning = $state(false);

    // Private
    private worker: Worker | null = null;
    private readonly IDB_KEY = 'hap_root_handle';

    constructor() {
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    /**
     * Initialize: load handle from IDB.
     */
    async init() {
        try {
            const handle = await get<FileSystemDirectoryHandle>(this.IDB_KEY);
            if (handle) {
                this.rootHandle = handle;
                console.log('[FS] Loaded root handle from IDB');
                // Optional: verify permission here or lazily
            }
        } catch (err) {
            console.error('[FS] Failed to load handle from IDB', err);
        }
    }

    /**
     * Open directory picker and set as root.
     */
    async selectRootFolder() {
        try {
            // @ts-ignore
            const handle = await window.showDirectoryPicker({
                mode: 'read',
                id: 'hap_music_root'
            });

            // Verify permission (implied by selection, but good practice for persistence)
            // await this.verifyPermission(handle, true);

            this.rootHandle = handle;
            await set(this.IDB_KEY, handle);

            // Start scanning automatically
            this.startScan();

        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('[FS] Error selecting folder:', err);
            }
        }
    }

    /**
     * Start the scan worker.
     */
    async startScan() {
        if (!this.rootHandle) {
            console.warn('[FS] No root handle, cannot scan');
            return;
        }
        if (this.isScanning) {
            console.warn('[FS] Already scanning');
            return;
        }

        // Verify permission before scanning (needed if handle loaded from IDB)
        const hasPerm = await this.verifyPermission(this.rootHandle, true);
        if (!hasPerm) {
            console.warn('[FS] Permission denied for root handle');
            // Ask user to re-request permission? 
            // In a real app we might show a UI prompt.
            // For now, try to proceed.
            // If permission is prompted and declined, hasPerm is false.
        }

        this.isScanning = true;
        console.log('[FS] Starting scan for folder:', this.rootHandle.name);

        // Init worker if needed
        if (!this.worker) {
            console.log('[FS] Creating scanner worker...');
            this.worker = new Worker(new URL('./scanner.worker.ts', import.meta.url), {
                type: 'module'
            });
            this.setupWorkerListeners();
        }

        this.worker.postMessage({
            type: 'START_SCAN',
            payload: { handle: this.rootHandle }
        });
        console.log('[FS] Scan message sent to worker');
    }

    private setupWorkerListeners() {
        if (!this.worker) return;

        this.worker.onmessage = async (event) => {
            const { type, payload } = event.data;
            // console.log('[FS] Worker message received:', type);

            switch (type) {
                case 'SCAN_BATCH':
                    // Process tracks and their artwork
                    const tracks: any[] = payload.tracks;
                    for (const track of tracks) {
                        if (track.artwork_blob) {
                            try {
                                const hash = await this.saveArtwork(track.artwork_blob);
                                track.artwork_hash = hash;
                                delete track.artwork_blob; // Clean up before DB
                            } catch (err) {
                                console.error('[FS] Failed to save artwork for', track.file_path, err);
                                delete track.artwork_blob;
                            }
                        }
                    }

                    // Insert tracks into DB (batch upsert)
                    console.log('[FS] Inserting batch of', tracks.length, 'tracks');
                    await db.upsertTracks(tracks);
                    break;

                case 'SCAN_PROGRESS':
                    console.log(`[FS] Scan Progress: ${payload.count} tracks in ${payload.folder}`);
                    break;

                case 'SCAN_COMPLETE':
                    this.isScanning = false;
                    console.log('[FS] Scan complete');
                    break;

                case 'SCAN_ERROR':
                    console.error('[FS] Scan error:', payload.message);
                    this.isScanning = false;
                    break;
            }
        };

        this.worker.onerror = (error) => {
            console.error('[FS] Worker error:', error);
            this.isScanning = false;
        };
    }

    /**
     * Saves an artwork Blob to OPFS /art/ folder with a content-based hash name.
     * Returns the hash string.
     */
    private async saveArtwork(blob: Blob): Promise<string> {
        // Compute hash
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Try to save to OPFS
        try {
            const root = await navigator.storage.getDirectory();
            const artDir = await root.getDirectoryHandle('art', { create: true });

            // Format: <hash>.jpg (or whatever format it is)
            const extension = blob.type.split('/')[1] || 'jpg';
            const fileName = `${hashHex}.${extension}`;

            const fileHandle = await artDir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            return hashHex;
        } catch (err) {
            console.error('[FS] Error saving artwork to OPFS:', err);
            return hashHex; // Return hash anyway even if save fails? Maybe better not.
        }
    }

    /**
     * Verify permission for a handle (read or readwrite).
     */
    private async verifyPermission(
        handle: FileSystemDirectoryHandle,
        withWrite: boolean
    ): Promise<boolean> {
        // @ts-ignore - FileSystem API permissions are experimental
        const opts: FileSystemHandlePermissionDescriptor = { mode: withWrite ? 'readwrite' : 'read' };

        // @ts-ignore - queryPermission is experimental
        if ((await handle.queryPermission(opts)) === 'granted') {
            return true;
        }
        // @ts-ignore - requestPermission is experimental
        if ((await handle.requestPermission(opts)) === 'granted') {
            return true;
        }
        return false;
    }

    /**
     * Retrieve a file handle from a path string relative to root.
     * e.g. "Music/Artist/Album/Song.mp3"
     */
    async getFileHandle(path: string): Promise<FileSystemFileHandle | null> {
        if (!this.rootHandle) return null;

        const parts = path.split('/');
        let currentDir = this.rootHandle;

        try {
            for (let i = 0; i < parts.length - 1; i++) {
                currentDir = await currentDir.getDirectoryHandle(parts[i]);
            }
            return await currentDir.getFileHandle(parts[parts.length - 1]);
        } catch (err) {
            console.error(`[FS] File not found: ${path}`, err);
            return null;
        }
    }
}

export const fsManager = new FileSystemManager();
