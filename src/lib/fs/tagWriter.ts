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

    // OGG Vorbis / OPUS: locate comment header page, replace comment packet
    return await writeOggVorbisTags(fileHandle, tags, format);
}

// ─── OGG Vorbis / OPUS tag writer ────────────────────────────────────────────
// Ogg format: stream of pages, each starting with 'OggS' magic.
// For Vorbis: 2nd logical bitstream packet (page) = Vorbis comment header.
// For Opus:   2nd page = OpusTags header.
// Strategy: find the 2nd Page (serial#, page_seq=1), replace its packet data.
async function writeOggVorbisTags(
    fileHandle: FileSystemFileHandle,
    tags: TagFields,
    format: 'ogg' | 'opus'
): Promise<TagWriteResult> {
    const file = await fileHandle.getFile();
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer);

    // Parse all Ogg pages and find the comment header page
    let offset = 0;
    let commentPageStart = -1;
    let commentPageEnd = -1;
    let serialNo = -1;
    let pageIdx = 0;

    while (offset + 27 <= buf.length) {
        // OggS magic
        if (buf[offset] !== 0x4F || buf[offset + 1] !== 0x67 || buf[offset + 2] !== 0x67 || buf[offset + 3] !== 0x53) {
            break; // not an Ogg page
        }

        const headerType = buf[offset + 5];
        const sn = dv.getInt32(offset + 14, true); // serial number LE
        const pageSeq = dv.getUint32(offset + 18, true);
        const nseg = buf[offset + 26]; // number of lace segments
        let pageDataLen = 0;
        for (let i = 0; i < nseg; i++) pageDataLen += buf[offset + 27 + i];
        const pageLen = 27 + nseg + pageDataLen;

        // The comment page is always pageSeq=1 (second page, 0-indexed)
        // It contains the Vorbis comment header (packet type 0x03 for Vorbis, "OpusTags" for Opus)
        if (pageSeq === 1) {
            const dataStart = offset + 27 + nseg;
            const isVorbisComment = format === 'ogg' && buf[dataStart] === 0x03;
            const isOpusTags = format === 'opus' && buf[dataStart] === 0x4F; // 'O' in OpusTags
            if (isVorbisComment || isOpusTags) {
                commentPageStart = offset;
                commentPageEnd = offset + pageLen;
                serialNo = sn;
            }
        }

        offset += pageLen;
        pageIdx++;
    }

    if (commentPageStart === -1) {
        return { success: false, format, error: `No ${format === 'opus' ? 'OpusTags' : 'Vorbis comment'} header found in OGG file. File may be corrupt or non-standard.` };
    }

    // Build new comment packet
    const comments = buildVorbisComments(tags);
    const vendor = 'HylstAudioPlayer/1.0';
    let commentPacket: Uint8Array;

    if (format === 'opus') {
        // OpusTags format: "OpusTags" + vendor_len(4LE) + vendor + count(4LE) + [len(4LE)+comment ...]
        commentPacket = buildOpusTagsPacket(vendor, comments);
    } else {
        // Vorbis comment format: 0x03 + "vorbis" + vendor_len(4LE) + vendor + count(4LE) + [len(4LE)+comment ...]
        commentPacket = buildVorbisCommentPacket(vendor, comments);
    }

    // Re-assemble the OGG page with the new packet
    const newPage = buildOggPage(commentPacket, serialNo, 1, 0, false, false);

    // Build new file buffer: before + new page + after old page
    const before = buf.slice(0, commentPageStart);
    const after = buf.slice(commentPageEnd);
    const newBuf = new Uint8Array(before.length + newPage.length + after.length);
    newBuf.set(before, 0);
    newBuf.set(newPage, before.length);
    newBuf.set(after, before.length + newPage.length);

    const writable = await (fileHandle as any).createWritable();
    await writable.write(newBuf.buffer);
    await writable.close();

    return { success: true, format };
}

// ─── Ogg page builder ──────────────────────────────────────────────────────────
function buildOggPage(
    packet: Uint8Array,
    serialNo: number,
    pageSeq: number,
    granulePos: number,
    isBOS: boolean,
    isEOS: boolean
): Uint8Array {
    // Build lace table (255-byte segments)
    const lace: number[] = [];
    let remaining = packet.length;
    while (remaining >= 255) { lace.push(255); remaining -= 255; }
    lace.push(remaining);

    const headerSize = 27 + lace.length;
    const page = new Uint8Array(headerSize + packet.length);
    const dv = new DataView(page.buffer);

    // Magic
    page[0] = 0x4F; page[1] = 0x67; page[2] = 0x67; page[3] = 0x53;
    page[4] = 0; // version
    page[5] = (isBOS ? 0x02 : 0) | (isEOS ? 0x04 : 0); // header type
    dv.setBigInt64(6, BigInt(granulePos), true); // granule position
    dv.setInt32(14, serialNo, true); // serial number
    dv.setUint32(18, pageSeq, true); // page sequence number
    dv.setUint32(22, 0, true); // checksum placeholder
    page[26] = lace.length; // number of segments
    for (let i = 0; i < lace.length; i++) page[27 + i] = lace[i];
    page.set(packet, headerSize);

    // Compute CRC32 over whole page (checksum at bytes 22-25)
    const crc = oggCRC32(page);
    dv.setUint32(22, crc, true);

    return page;
}

// CRC32 for Ogg (polynomial 0x04c11db7, initial value 0)
function oggCRC32(data: Uint8Array): number {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 24;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x80000000) ? (crc << 1) ^ 0x04c11db7 : crc << 1;
            crc |= 0; // keep 32-bit
        }
    }
    return crc >>> 0;
}

// ─── Vorbis comment packet builder ────────────────────────────────────────────
function buildVorbisCommentPacket(vendor: string, comments: string[]): Uint8Array {
    const head = new TextEncoder().encode('\x03vorbis');
    const body = buildVorbisCommentBlock(vendor, comments);
    // Append framing bit (0x01) required by Vorbis spec
    const packet = new Uint8Array(head.length + body.length + 1);
    packet.set(head, 0);
    packet.set(body, head.length);
    packet[head.length + body.length] = 0x01;
    return packet;
}

// ─── OpusTags packet builder ───────────────────────────────────────────────────
function buildOpusTagsPacket(vendor: string, comments: string[]): Uint8Array {
    const head = new TextEncoder().encode('OpusTags');
    const body = buildVorbisCommentBlock(vendor, comments);
    const packet = new Uint8Array(head.length + body.length);
    packet.set(head, 0);
    packet.set(body, head.length);
    return packet;
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
