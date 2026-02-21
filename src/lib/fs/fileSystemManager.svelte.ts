// src/lib/fs/fileSystemManager.svelte.ts — File System Store
// Supports MULTIPLE root folders (stored as indexed array in idb-keyval).
// Svelte 5 Runes.

import { get, set } from 'idb-keyval';
import { db } from '$lib/db/database.svelte';

const IDB_HANDLES_KEY = 'hap_root_handles_v2'; // v2: array instead of single

export class FileSystemManager {
    // State — array of all registered root folder handles
    rootHandles = $state<FileSystemDirectoryHandle[]>([]);
    isScanning = $state(false);
    scanProgress = $state({ current: 0, total: 0, folder: '' });

    // Private
    private worker: Worker | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            void this.init();
        }
    }

    // ─── Derived: first handle (backward compat with player.svelte.ts) ─────────
    get rootHandle(): FileSystemDirectoryHandle | null {
        return this.rootHandles[0] ?? null;
    }

    // ─── Persist & load ──────────────────────────────────────────────────────────

    async init() {
        try {
            // Try new multi-folder key first
            const handles = await get<FileSystemDirectoryHandle[]>(IDB_HANDLES_KEY);
            if (Array.isArray(handles) && handles.length > 0) {
                this.rootHandles = handles;
                console.log('[FS] Loaded', handles.length, 'root handle(s) from IDB');
                return;
            }
            // Migrate from legacy single-folder key
            const legacy = await get<FileSystemDirectoryHandle>('hap_root_handle');
            if (legacy) {
                this.rootHandles = [legacy];
                await set(IDB_HANDLES_KEY, this.rootHandles);
                console.log('[FS] Migrated legacy single root handle to multi-handle array');
            }
        } catch (err) {
            console.error('[FS] Failed to load handles from IDB', err);
        }
    }

    private async saveHandles() {
        await set(IDB_HANDLES_KEY, this.rootHandles);
    }

    // ─── Folder management ───────────────────────────────────────────────────────

    /**
     * Open directory picker and ADD the selected folder to the list.
     * Does not replace existing folders.
     */
    async addFolder() {
        try {
            // @ts-ignore
            const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
                mode: 'read',
                id: 'hap_music_folder'
            });

            // Check for duplicates (by name, best we can do without isSameEntry in all browsers)
            const alreadyAdded = this.rootHandles.some(h => h.name === handle.name);
            if (alreadyAdded) {
                console.warn('[FS] Folder already in library:', handle.name);
                return;
            }

            this.rootHandles = [...this.rootHandles, handle];
            await this.saveHandles();

            // Scan just the new folder
            await this.scanFolder(handle);

        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('[FS] Error adding folder:', err);
            }
        }
    }

    /**
     * Remove a folder from the library by index.
     */
    async removeFolder(index: number) {
        const updated = [...this.rootHandles];
        updated.splice(index, 1);
        this.rootHandles = updated;
        await this.saveHandles();
    }

    /**
     * Rescan all registered folders.
     */
    async rescanAll() {
        if (this.isScanning) {
            console.warn('[FS] Already scanning');
            return;
        }
        for (const handle of this.rootHandles) {
            await this.scanFolder(handle);
        }
    }

    /**
     * Scan a single folder handle. Legacy alias: startScan().
     */
    async startScan() {
        if (this.rootHandle) await this.scanFolder(this.rootHandle);
    }

    async scanFolder(handle: FileSystemDirectoryHandle) {
        if (this.isScanning) {
            console.warn('[FS] Already scanning, queuing not yet supported');
            return;
        }
        this.isScanning = true;
        this.scanProgress = { current: 0, total: 0, folder: handle.name };

        const hasPerm = await this.verifyPermission(handle, false);
        if (!hasPerm) {
            console.warn('[FS] Permission denied for handle:', handle.name);
            this.isScanning = false;
            return;
        }

        console.log('[FS] Starting scan for folder:', handle.name);

        if (!this.worker) {
            this.worker = new Worker(new URL('./scanner.worker.ts', import.meta.url), {
                type: 'module'
            });
            this.setupWorkerListeners();
        }

        this.worker.postMessage({ type: 'START_SCAN', payload: { handle } });
    }

    // ─── Worker message handling ─────────────────────────────────────────────────

    private setupWorkerListeners() {
        if (!this.worker) return;

        this.worker.onmessage = async (event) => {
            const { type, payload } = event.data;

            switch (type) {
                case 'SCAN_BATCH': {
                    const tracks: any[] = payload.tracks;
                    for (const track of tracks) {
                        if (track.artwork_blob) {
                            try {
                                const hash = await this.saveArtwork(track.artwork_blob);
                                track.artwork_hash = hash;
                            } catch { /* ignore artwork errors */ }
                            delete track.artwork_blob;
                        }
                    }
                    await db.upsertTracks(tracks);
                    this.scanProgress = { ...this.scanProgress, current: this.scanProgress.current + tracks.length };
                    break;
                }
                case 'SCAN_PROGRESS':
                    this.scanProgress = { current: payload.count ?? 0, total: payload.total ?? 0, folder: payload.folder ?? '' };
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

    // ─── Artwork storage (OPFS) ──────────────────────────────────────────────────

    private async saveArtwork(blob: Blob): Promise<string> {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashHex = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        try {
            const root = await navigator.storage.getDirectory();
            const artDir = await root.getDirectoryHandle('art', { create: true });
            const ext = blob.type.split('/')[1] || 'jpg';
            const fileHandle = await artDir.getFileHandle(`${hashHex}.${ext}`, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (err) {
            console.error('[FS] Error saving artwork to OPFS:', err);
        }

        return hashHex;
    }

    // ─── Permission helper ───────────────────────────────────────────────────────

    private async verifyPermission(
        handle: FileSystemDirectoryHandle,
        withWrite: boolean
    ): Promise<boolean> {
        // @ts-ignore
        const opts = { mode: withWrite ? 'readwrite' : 'read' };
        // @ts-ignore
        if ((await handle.queryPermission(opts)) === 'granted') return true;
        // @ts-ignore
        if ((await handle.requestPermission(opts)) === 'granted') return true;
        return false;
    }

    // ─── File retrieval (searches ALL folders) ───────────────────────────────────

    /**
     * Resolve a relative file path across ALL registered root folders.
     * Tries each root in order until the file is found.
     */
    async getFileHandle(path: string): Promise<FileSystemFileHandle | null> {
        const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
        const filename = parts[parts.length - 1];
        const dirs = parts.slice(0, -1);

        for (const root of this.rootHandles) {
            try {
                let currentDir = root;
                for (const dir of dirs) {
                    currentDir = await currentDir.getDirectoryHandle(dir);
                }
                const fileHandle = await currentDir.getFileHandle(filename);
                return fileHandle;
            } catch {
                continue; // try next root
            }
        }

        console.error(`[FS] File not found in any root: ${path}`);
        return null;
    }

    /**
     * Get direct subdirectory handles of all root folders (for folder browser).
     */
    async getRootEntries(): Promise<Array<{ root: FileSystemDirectoryHandle; name: string; handle: FileSystemDirectoryHandle | FileSystemFileHandle; kind: 'file' | 'directory' }>> {
        const entries: Array<{ root: FileSystemDirectoryHandle; name: string; handle: any; kind: 'file' | 'directory' }> = [];
        for (const root of this.rootHandles) {
            try {
                // @ts-ignore
                for await (const entry of root.values()) {
                    entries.push({ root, name: entry.name, handle: entry, kind: entry.kind });
                }
            } catch (err) {
                console.error('[FS] Error reading root entries:', err);
            }
        }
        return entries;
    }
}

export const fsManager = new FileSystemManager();
