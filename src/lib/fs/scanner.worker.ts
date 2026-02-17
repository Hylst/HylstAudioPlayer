/// <reference lib="webworker" />
import { parseBlob } from 'music-metadata';
import { mapMetadataToTrack, extractArtwork } from './tagUtils';
import type { Track } from '$lib/types';

// Declare self scope
declare let self: ServiceWorkerGlobalScope;

const SUPPORTED_EXTENSIONS = new Set([
    'mp3', 'flac', 'ogg', 'opus', 'm4a', 'wav', 'wma'
]);

// Batch size for reporting tracks back to main thread
const BATCH_SIZE = 50;

let isScanning = false;
let shouldCancel = false;

self.onmessage = async (event) => {
    const { type, payload } = event.data;

    console.log('[Scanner Worker] Message received:', type);

    switch (type) {
        case 'START_SCAN':
            if (isScanning) {
                console.warn('[Scanner Worker] Already scanning');
                return;
            }
            isScanning = true;
            shouldCancel = false;
            try {
                console.log('[Scanner Worker] Starting scan...');
                await scanDirectory(payload.handle, payload.path || '');
                console.log('[Scanner Worker] Scan completed, sending SCAN_COMPLETE');
                postMessage({ type: 'SCAN_COMPLETE' });
            } catch (err: any) {
                console.error('[Scanner Worker] Scan error:', err);
                postMessage({ type: 'SCAN_ERROR', payload: { message: err.message } });
            } finally {
                isScanning = false;
            }
            break;

        case 'CANCEL_SCAN':
            console.log('[Scanner Worker] Cancelling scan');
            shouldCancel = true;
            break;
    }
};

/**
 * Recursively scans a Directory Handle.
 */
async function scanDirectory(dirHandle: FileSystemDirectoryHandle, parentPath: string) {
    if (shouldCancel) return;

    console.log('[Scanner Worker] Scanning directory:', parentPath || '(root)');

    const tracksBatch: Partial<Track>[] = [];
    let processedCount = 0;

    // Using 'for await...of' on dirHandle.values() standard iterator
    // @ts-ignore - TypeScript might not have full FileSystem types yet
    for await (const entry of dirHandle.values()) {
        if (shouldCancel) break;

        const entryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

        if (entry.kind === 'file') {
            const ext = entry.name.split('.').pop()?.toLowerCase();
            if (ext && SUPPORTED_EXTENSIONS.has(ext)) {
                try {
                    const fileHandle = entry as FileSystemFileHandle;
                    const file = await fileHandle.getFile();

                    // Parse metadata
                    const metadata = await parseBlob(file);
                    const track = mapMetadataToTrack(metadata, entryPath);

                    // Add extra file info
                    // track.file_handle = fileHandle; // Can't transfer handle easily indiscriminately, stick to path?
                    // Actually handles are transferable but better to re-request or store in IDB if needed.
                    // For DB, we store the path relative to ROOT.

                    tracksBatch.push(track);
                    processedCount++;

                    // Send batch if full
                    if (tracksBatch.length >= BATCH_SIZE) {
                        console.log('[Scanner Worker] Sending batch of', tracksBatch.length, 'tracks');
                        postMessage({ type: 'SCAN_BATCH', payload: { tracks: [...tracksBatch] } });
                        tracksBatch.length = 0;
                    }

                } catch (err) {
                    console.warn(`[Scanner Worker] Failed to parse ${entryPath}`, err);
                }
            }
        } else if (entry.kind === 'directory') {
            // Recursion
            await scanDirectory(entry as FileSystemDirectoryHandle, entryPath);
        }
    }

    // Flush remaining
    if (tracksBatch.length > 0) {
        console.log('[Scanner Worker] Sending final batch of', tracksBatch.length, 'tracks');
        postMessage({ type: 'SCAN_BATCH', payload: { tracks: tracksBatch } });
    }

    console.log('[Scanner Worker] Finished scanning directory:', parentPath || '(root)', '- Found', processedCount, 'tracks');
}
