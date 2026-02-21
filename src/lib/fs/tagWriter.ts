// src/lib/fs/tagWriter.ts — File-level Audio Tag Write-Back
// Writes ID3v2.3 tags to MP3 files using browser-id3-writer.
// For FLAC/OGG: uses the music-metadata-aware approach with Vorbis comment rewrite.
// All operations go through FileSystemFileHandle (OPFS/real FS via fsManager).
// Rule 8: only create writer when needed, release immediately after.

import { fsManager } from '$lib/fs/fileSystemManager.svelte';

// ─── Supported formats and their tag strategies ─────────────────────────────
export type TagWritableFormat = 'mp3' | 'flac' | 'ogg' | 'opus' | 'm4a';

export interface TagFields {
    title?: string;
    artist?: string;
    album?: string;
    album_artist?: string;
    genre?: string;
    year?: number;
    track_number?: number;
    disc_number?: number;
    composer?: string;
    comment?: string;
    lyrics?: string;
    bpm?: number;
    label?: string;
    isrc?: string;
    mood?: string;
}

export interface TagWriteResult {
    success: boolean;
    format: string;
    error?: string;
}

// ─── Extension → format detection ────────────────────────────────────────────
function getFormat(filePath: string): TagWritableFormat | null {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext === 'mp3') return 'mp3';
    if (ext === 'flac') return 'flac';
    if (ext === 'ogg' || ext === 'oga') return 'ogg';
    if (ext === 'opus') return 'opus';
    if (ext === 'm4a' || ext === 'mp4') return 'm4a';
    return null;
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function writeTagsToFile(
    filePath: string,
    tags: TagFields
): Promise<TagWriteResult> {
    const format = getFormat(filePath);
    if (!format) {
        return { success: false, format: 'unknown', error: 'Unsupported file format' };
    }

    try {
        if (format === 'mp3') {
            return await writeMp3Tags(filePath, tags);
        } else if (format === 'flac' || format === 'ogg' || format === 'opus') {
            return await writeVorbisCommentTags(filePath, tags, format);
        } else {
            return {
                success: false,
                format,
                error: `Tag write-back for ${format.toUpperCase()} is not yet supported. Changes saved to database only.`
            };
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[TagWriter] Failed to write tags to ${filePath}:`, err);
        return { success: false, format, error: message };
    }
}

// ─── MP3: ID3v2.3 via browser-id3-writer ─────────────────────────────────────
async function writeMp3Tags(filePath: string, tags: TagFields): Promise<TagWriteResult> {
    const fileHandle = await fsManager.getFileHandle(filePath);
    if (!fileHandle) throw new Error('File handle not found for: ' + filePath);

    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();

    // Lazy import to avoid bundling at top-level
    const { ID3Writer } = await import('browser-id3-writer');
    const writer = new ID3Writer(arrayBuffer);

    // Standard fields
    if (tags.title) writer.setFrame('TIT2', tags.title);
    if (tags.artist) writer.setFrame('TPE1', [tags.artist]);
    if (tags.album) writer.setFrame('TALB', tags.album);
    if (tags.album_artist) writer.setFrame('TPE2', tags.album_artist);
    if (tags.genre) writer.setFrame('TCON', [tags.genre]);
    if (tags.year) writer.setFrame('TYER', tags.year);
    if (tags.track_number) writer.setFrame('TRCK', String(tags.track_number));
    if (tags.disc_number) writer.setFrame('TPOS', String(tags.disc_number));
    if (tags.composer) writer.setFrame('TCOM', [tags.composer]);
    if (tags.bpm) writer.setFrame('TBPM', tags.bpm);
    if (tags.isrc) writer.setFrame('TSRC', tags.isrc);
    if (tags.label) writer.setFrame('TPUB', tags.label);

    // Comment (COMM frame — language + description + text)
    if (tags.comment) {
        writer.setFrame('COMM', {
            description: '',
            text: tags.comment,
            language: 'eng'
        });
    }

    // Unsynchronised lyrics (USLT frame)
    if (tags.lyrics) {
        writer.setFrame('USLT', {
            description: '',
            lyrics: tags.lyrics,
            language: 'eng'
        });
    }

    // Custom TXXX frame for mood (not in ID3v2.3 standard frame list)
    if (tags.mood) {
        writer.setFrame('TXXX', {
            description: 'MOOD',
            value: tags.mood
        });
    }

    writer.addTag();
    const taggedArrayBuffer = writer.getBlob();

    // Write back to file via FileSystemFileHandle
    const writable = await (fileHandle as any).createWritable();
    await writable.write(taggedArrayBuffer);
    await writable.close();

    return { success: true, format: 'mp3' };
}

// ─── FLAC / OGG / OPUS: Vorbis Comment rewrite ───────────────────────────────
// Strategy: use music-metadata to re-parse, then manually patch Vorbis comment block.
// For FLAC: Comment block type = 4. For OGG: second packet in stream.
// This is a best-effort implementation — rewrites the comment block in-place.
async function writeVorbisCommentTags(
    filePath: string,
    tags: TagFields,
    format: 'flac' | 'ogg' | 'opus'
): Promise<TagWriteResult> {
    const fileHandle = await fsManager.getFileHandle(filePath);
    if (!fileHandle) throw new Error('File handle not found for: ' + filePath);

    if (format === 'flac') {
        return await writeFlacTags(fileHandle, tags);
    }

    // OGG/OPUS: complex bitstream format, requires proper Ogg framing
    // For now, return an informative message — full support planned
    return {
        success: false,
        format,
        error: `OGG/OPUS tag write-back not yet implemented. Changes saved to database only.`
    };
}

// ─── FLAC tag writer ──────────────────────────────────────────────────────────
// FLAC marker: fLaC (4 bytes) + metadata blocks
// Block type 4 = VORBIS_COMMENT, structured as:
//   [vendor_length 4LE][vendor][count 4LE][key=value × count]
async function writeFlacTags(
    fileHandle: FileSystemFileHandle,
    tags: TagFields
): Promise<TagWriteResult> {
    const file = await fileHandle.getFile();
    const buffer = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(buffer.buffer);

    // Verify FLAC marker
    const marker = String.fromCharCode(...Array.from(buffer.slice(0, 4)));
    if (marker !== 'fLaC') throw new Error('Not a valid FLAC file');

    // Build new Vorbis comment fields
    const comments = buildVorbisComments(tags);
    const vendor = 'HylstAudioPlayer/1.0';
    const newCommentBlock = buildVorbisCommentBlock(vendor, comments);

    // Locate existing VORBIS_COMMENT block (type 4)
    let offset = 4;
    let commentBlockStart = -1;
    let commentBlockLength = 0;
    let isLast = false;

    while (offset < buffer.length) {
        const blockHeader = view.getUint32(offset, false); // big-endian
        const isLastBlock = (blockHeader >>> 31) === 1;
        const blockType = (blockHeader >>> 24) & 0x7F;
        const blockLen = blockHeader & 0xFFFFFF;

        if (blockType === 4) { // VORBIS_COMMENT
            commentBlockStart = offset;
            commentBlockLength = 4 + blockLen;
            isLast = isLastBlock;
            break;
        }

        offset += 4 + blockLen;
        if (isLastBlock) break;
    }

    if (commentBlockStart === -1) {
        return {
            success: false,
            format: 'flac',
            error: 'No Vorbis comment block found in FLAC file'
        };
    }

    // Build new complete file: before + new comment block + after
    const before = buffer.slice(0, commentBlockStart);
    const after = buffer.slice(commentBlockStart + commentBlockLength);

    // Build new block header (preserve isLast flag, type 4)
    const newBlockHeader = new Uint8Array(4);
    const newBlockLen = newCommentBlock.length;
    const headerVal = ((isLast ? 1 : 0) << 31) | (4 << 24) | newBlockLen;
    new DataView(newBlockHeader.buffer).setUint32(0, headerVal, false);

    // Concatenate
    const newBuffer = new Uint8Array(
        before.length + 4 + newBlockLen + after.length
    );
    newBuffer.set(before, 0);
    newBuffer.set(newBlockHeader, before.length);
    newBuffer.set(newCommentBlock, before.length + 4);
    newBuffer.set(after, before.length + 4 + newBlockLen);

    // Write back
    const writable = await (fileHandle as any).createWritable();
    await writable.write(newBuffer.buffer);
    await writable.close();

    return { success: true, format: 'flac' };
}

// ─── Vorbis comment helpers ──────────────────────────────────────────────────

function buildVorbisComments(tags: TagFields): string[] {
    const pairs: string[] = [];
    if (tags.title) pairs.push(`TITLE=${tags.title}`);
    if (tags.artist) pairs.push(`ARTIST=${tags.artist}`);
    if (tags.album) pairs.push(`ALBUM=${tags.album}`);
    if (tags.album_artist) pairs.push(`ALBUMARTIST=${tags.album_artist}`);
    if (tags.genre) pairs.push(`GENRE=${tags.genre}`);
    if (tags.year) pairs.push(`DATE=${tags.year}`);
    if (tags.track_number) pairs.push(`TRACKNUMBER=${tags.track_number}`);
    if (tags.disc_number) pairs.push(`DISCNUMBER=${tags.disc_number}`);
    if (tags.composer) pairs.push(`COMPOSER=${tags.composer}`);
    if (tags.comment) pairs.push(`COMMENT=${tags.comment}`);
    if (tags.lyrics) pairs.push(`LYRICS=${tags.lyrics}`);
    if (tags.bpm) pairs.push(`BPM=${tags.bpm}`);
    if (tags.label) pairs.push(`ORGANIZATION=${tags.label}`);
    if (tags.isrc) pairs.push(`ISRC=${tags.isrc}`);
    if (tags.mood) pairs.push(`MOOD=${tags.mood}`);
    return pairs;
}

function buildVorbisCommentBlock(vendor: string, comments: string[]): Uint8Array {
    const enc = new TextEncoder();
    const vendorBytes = enc.encode(vendor);
    const commentBytesArr = comments.map(c => enc.encode(c));

    // Calculate total size
    let size = 4 + vendorBytes.length + 4; // vendor_length + vendor + count
    for (const cb of commentBytesArr) size += 4 + cb.length;

    const buf = new Uint8Array(size);
    const view = new DataView(buf.buffer);
    let offset = 0;

    // Vendor string
    view.setUint32(offset, vendorBytes.length, true); offset += 4;
    buf.set(vendorBytes, offset); offset += vendorBytes.length;

    // Comment count
    view.setUint32(offset, commentBytesArr.length, true); offset += 4;

    // Comments
    for (const cb of commentBytesArr) {
        view.setUint32(offset, cb.length, true); offset += 4;
        buf.set(cb, offset); offset += cb.length;
    }

    return buf;
}
