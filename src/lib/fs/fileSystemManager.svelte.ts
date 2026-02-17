// src/lib/fs/fileSystemManager.svelte.ts — File System Store
// Coordinates directory selection and scanning.
// Svelte 5 Runes.

import { get, set, del } from 'idb-keyval';
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
            console.log('[FS] Worker message received:', type, payload);

            switch (type) {
                case 'SCAN_BATCH':
                    // Insert tracks into DB (batch upsert)
                    console.log('[FS] Inserting batch of', payload.tracks.length, 'tracks');
                    await db.upsertTracks(payload.tracks);
                    console.log('[FS] Batch inserted successfully');
                    break;

                case 'SCAN_COMPLETE':
                    this.isScanning = false;
                    console.log('[FS] Scan complete');
                    // Terminate worker to free memory? Or keep for re-scan?
                    // Keeping it is fine.
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
     * Verify read permission for a handle.
     */
    private async verifyPermission(handle: FileSystemDirectoryHandle, readWrite = false) {
        const opts: FileSystemHandlePermissionDescriptor = {
            mode: readWrite ? 'readwrite' : 'read'
        };
        if ((await handle.queryPermission(opts)) === 'granted') {
            return true;
        }
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
