<script lang="ts">
    import { page } from "$app/stores";
    import { db } from "$lib/db/database.svelte";
    import { player } from "$lib/audio/player.svelte";
    import {
        identifyTrack,
        type TrackIdentification,
    } from "$lib/meta/musicbrainz";
    import type { Track } from "$lib/types";

    // ─── State ────────────────────────────────────────────────────────────────────
    let track = $state<Track | null>(null);
    let artworkUrl = $state<string | null>(null);
    let loading = $state(true);
    let newKeyword = $state("");
    let savingKeyword = $state(false);

    // ─── ID from route param ─────────────────────────────────────────────────────
    const trackId = $derived(Number($page.params.id));

    // ─── Load track on mount / id change ─────────────────────────────────────────
    $effect(() => {
        if (!trackId || !db.isReady) return;
        loading = true;
        db.getTrackById(trackId).then((t) => {
            track = t;
            loading = false;
        });
    });

    // ─── Load artwork ─────────────────────────────────────────────────────────────
    $effect(() => {
        if (!track?.artwork_hash) {
            artworkUrl = null;
            return;
        }
        player.getArtworkUrl(track.artwork_hash).then((url) => {
            artworkUrl = url;
        });
    });

    // ─── Helpers ──────────────────────────────────────────────────────────────────
    function fmt(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }
    function fmtBitrate(b?: number): string {
        if (!b) return "—";
        return `${Math.round(b / 1000)} kbps`;
    }
    function fmtHz(hz?: number): string {
        if (!hz) return "—";
        return `${(hz / 1000).toFixed(1)} kHz`;
    }
    function formatDate(d: Date | string | number | undefined): string {
        if (!d) return "—";
        return new Date(d).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    // ─── Keywords ────────────────────────────────────────────────────────────────
    async function addKeyword() {
        const kw = newKeyword.trim().toLowerCase();
        if (!kw || !track) return;
        if (track.keywords?.includes(kw)) {
            newKeyword = "";
            return;
        }
        savingKeyword = true;
        const updated = [...(track.keywords ?? []), kw];
        await db.updateTrack(track.id, { keywords: updated });
        track = { ...track, keywords: updated };
        newKeyword = "";
        savingKeyword = false;
    }
    async function removeKeyword(kw: string) {
        if (!track) return;
        const updated = (track.keywords ?? []).filter((k) => k !== kw);
        await db.updateTrack(track.id, { keywords: updated });
        track = { ...track, keywords: updated };
    }
    async function updateRating(r: number) {
        if (!track) return;
        await db.updateTrack(track.id, { rating: r });
        track = { ...track, rating: r };
    }

    // ─── Is current track? ────────────────────────────────────────────────────────
    const isCurrent = $derived(player.currentTrack?.id === trackId);

    // ─── Online Identification (Phase 3) ─────────────────────────────────────────
    let identifyOpen = $state(false);
    let identifying = $state(false);
    let identifyError = $state<string | null>(null);
    let identifyResults = $state<TrackIdentification[]>([]);
    let applyingResult = $state<string | null>(null); // mbid being applied

    async function runIdentify(): Promise<void> {
        if (!track) return;
        identifyOpen = true;
        identifying = true;
        identifyError = null;
        identifyResults = [];
        try {
            identifyResults = await identifyTrack(
                track.title ?? "",
                track.artist ?? "",
            );
        } catch (err: unknown) {
            identifyError =
                err instanceof Error ? err.message : "Identification failed";
        } finally {
            identifying = false;
        }
    }

    async function applyIdentification(
        result: TrackIdentification,
    ): Promise<void> {
        if (!track) return;
        applyingResult = result.mbid;
        try {
            const fields: Partial<Track> = {
                musicbrainz_id: result.mbid,
            };
            if (result.album && !track.album) fields.album = result.album;
            if (result.year && !track.year) fields.year = result.year;
            if (result.label && !track.label) fields.label = result.label;
            if (result.isrc && !track.isrc) fields.isrc = result.isrc;
            await db.updateTrack(track.id, fields);
            track = { ...track, ...fields };
            identifyOpen = false;
        } catch (err: unknown) {
            identifyError = err instanceof Error ? err.message : "Apply failed";
        } finally {
            applyingResult = null;
        }
    }
</script>

<!-- Blurred artwork backdrop -->
{#if artworkUrl}
    <div
        class="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style="background: url({artworkUrl}) center/cover; filter: blur(60px) brightness(0.3) saturate(1.4); transform: scale(1.1)"
    ></div>
    <div
        class="fixed inset-0 z-0 pointer-events-none"
        style="background: rgba(10,10,20,0.7)"
    ></div>
{:else}
    <div
        class="fixed inset-0 z-0 pointer-events-none"
        style="background: linear-gradient(160deg, rgba(99,102,241,0.12) 0%, rgba(10,10,20,1) 50%)"
    ></div>
{/if}

<div
    class="relative z-10 flex flex-col w-full max-w-md mx-auto min-h-full pb-32"
>
    <!-- Header -->
    <header class="flex items-center justify-between px-5 pt-12 pb-4">
        <a
            href="/"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Back"
        >
            <span class="material-symbols-rounded text-white/80 text-[24px]"
                >arrow_back</span
            >
        </a>
        <h1
            class="text-sm font-semibold text-white/60 uppercase tracking-widest"
        >
            Track Info
        </h1>
        <a
            href="/track/{trackId}/edit"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Edit tags"
        >
            <span class="material-symbols-rounded text-white/80 text-[24px]"
                >edit</span
            >
        </a>
    </header>

    {#if loading}
        <!-- Skeleton -->
        <div class="px-5 pt-2 flex flex-col gap-6 animate-pulse">
            <div
                class="aspect-square rounded-[2rem] bg-white/6 max-w-[280px] mx-auto w-full"
            ></div>
            <div class="space-y-3">
                <div class="h-7 rounded-full bg-white/6 w-3/4"></div>
                <div class="h-4 rounded-full bg-white/4 w-1/2"></div>
            </div>
        </div>
    {:else if !track}
        <div
            class="flex flex-col items-center justify-center flex-1 py-20 gap-4"
        >
            <span class="material-symbols-rounded text-5xl text-white/20"
                >music_off</span
            >
            <p class="text-white/40">Track not found</p>
        </div>
    {:else}
        <!-- ─── Artwork ─── -->
        <div class="px-5 pt-2 flex flex-col items-center gap-4">
            <div
                class="relative w-full max-w-[260px] aspect-square rounded-[2rem] overflow-hidden shadow-2xl"
                style="box-shadow: 0 20px 60px -10px rgba(99,102,241,0.4)"
            >
                {#if artworkUrl}
                    <img
                        src={artworkUrl}
                        alt="Album artwork"
                        class="w-full h-full object-cover"
                    />
                    <div
                        class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-60 pointer-events-none"
                    ></div>
                {:else}
                    <div
                        class="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/60 to-purple-900/60"
                    >
                        <span
                            class="material-symbols-rounded text-white/15"
                            style="font-size: 100px">album</span
                        >
                    </div>
                {/if}
            </div>

            <!-- Title + rating + play -->
            <div class="w-full text-center">
                <h2
                    class="text-2xl font-bold text-white leading-tight truncate"
                    style="text-shadow: 0 0 20px rgba(255,255,255,0.15)"
                >
                    {track.title ?? "Unknown Track"}
                </h2>
                <p
                    class="mt-1 text-base font-medium"
                    style="color: var(--hap-primary, #6467f2)"
                >
                    {track.artist ?? "Unknown Artist"}
                </p>
                <p class="text-sm text-white/40 mt-0.5">
                    {track.album ?? "Unknown Album"}{track.year
                        ? ` · ${track.year}`
                        : ""}
                </p>
            </div>

            <!-- Star rating -->
            <div
                class="flex items-center gap-1"
                role="group"
                aria-label="Rating"
            >
                {#each [1, 2, 3, 4, 5] as star}
                    <button
                        class="text-[28px] transition-all active:scale-90"
                        style={star <= (track.rating ?? 0)
                            ? "color: #fbbf24"
                            : "color: rgba(255,255,255,0.15)"}
                        onclick={() =>
                            updateRating(star === track!.rating ? 0 : star)}
                        aria-label="Rate {star} star{star > 1 ? 's' : ''}"
                    >
                        <span
                            class="material-symbols-rounded"
                            style="font-variation-settings: 'FILL' {star <=
                            (track.rating ?? 0)
                                ? 1
                                : 0}">star</span
                        >
                    </button>
                {/each}
            </div>

            <!-- Play button -->
            <button
                onclick={() => track && player.play(track)}
                class="flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm transition-all active:scale-95 hover:scale-105"
                style="background: linear-gradient(135deg, var(--hap-primary,#6467f2), rgba(100,103,242,0.6)); box-shadow: 0 0 24px rgba(99,102,241,0.35)"
                aria-label={isCurrent && player.isPlaying ? "Pause" : "Play"}
            >
                <span class="material-symbols-rounded text-[22px]"
                    >{isCurrent && player.isPlaying
                        ? "pause"
                        : "play_arrow"}</span
                >
                {isCurrent && player.isPlaying ? "Playing" : "Play"}
            </button>
        </div>

        <!-- ─── Metadata sections ─── -->
        <div class="px-5 mt-6 flex flex-col gap-4">
            <!-- Core metadata -->
            <section>
                <h3
                    class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
                >
                    Details
                </h3>
                <div
                    class="rounded-2xl overflow-hidden"
                    style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
                >
                    {#each [{ label: "Duration", value: fmt(track.duration) }, { label: "Genre", value: track.genre }, { label: "Composer", value: track.composer }, { label: "Album Artist", value: track.album_artist }, { label: "Track #", value: track.track_number != null ? `${track.track_number}${track.disc_number ? " · Disc " + track.disc_number : ""}` : undefined }, { label: "BPM", value: track.bpm }, { label: "Mood", value: track.mood }, { label: "Label", value: track.label }, { label: "ISRC", value: track.isrc }].filter((r) => r.value != null && r.value !== "") as row, idx}
                        <div
                            class="flex items-center justify-between px-4 py-3"
                            style={idx > 0
                                ? "border-top: 1px solid rgba(255,255,255,0.05)"
                                : ""}
                        >
                            <span
                                class="text-xs text-white/35 font-medium w-28 flex-shrink-0"
                                >{row.label}</span
                            >
                            <span
                                class="text-sm text-white/85 text-right truncate"
                                >{String(row.value)}</span
                            >
                        </div>
                    {/each}
                </div>
            </section>

            <!-- Audio technical -->
            <section>
                <h3
                    class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
                >
                    Audio
                </h3>
                <div
                    class="rounded-2xl overflow-hidden"
                    style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
                >
                    {#each [{ label: "Bitrate", value: fmtBitrate(track.bitrate) }, { label: "Sample Rate", value: fmtHz(track.sample_rate) }, { label: "Format", value: track.file_format?.toUpperCase() }, { label: "Codec", value: track.codec ? (track.codec_profile ? `${track.codec} (${track.codec_profile})` : track.codec) : undefined }, { label: "Tags", value: (() => {
                                try {
                                    return track.tag_types ? (JSON.parse(track.tag_types) as string[]).join(", ") : undefined;
                                } catch {
                                    return track.tag_types;
                                }
                            })() }, { label: "File Size", value: track.file_size ? (track.file_size > 1_048_576 ? `${(track.file_size / 1_048_576).toFixed(1)} MB` : `${(track.file_size / 1024).toFixed(0)} KB`) : undefined }, { label: "ReplayGain", value: track.replaygain_track_db != null ? `${track.replaygain_track_db.toFixed(2)} dB` : undefined }, { label: "MusicBrainz", value: track.musicbrainz_id }, { label: "Comment", value: track.comment }].filter((r) => r.value != null && r.value !== "—") as row, idx}
                        <div
                            class="flex items-start justify-between px-4 py-3"
                            style={idx > 0
                                ? "border-top: 1px solid rgba(255,255,255,0.05)"
                                : ""}
                        >
                            <span
                                class="text-xs text-white/35 font-medium w-28 flex-shrink-0 mt-0.5"
                                >{row.label}</span
                            >
                            <span
                                class="text-sm text-white/85 text-right break-all"
                                >{String(row.value)}</span
                            >
                        </div>
                    {/each}
                    <div
                        class="flex items-center justify-between px-4 py-3"
                        style="border-top: 1px solid rgba(255,255,255,0.05)"
                    >
                        <span
                            class="text-xs text-white/35 font-medium w-28 flex-shrink-0"
                            >Added</span
                        >
                        <span class="text-sm text-white/85"
                            >{formatDate(track.date_added)}</span
                        >
                    </div>
                    <div
                        class="flex items-center justify-between px-4 py-3"
                        style="border-top: 1px solid rgba(255,255,255,0.05)"
                    >
                        <span
                            class="text-xs text-white/35 font-medium w-28 flex-shrink-0"
                            >Plays</span
                        >
                        <span class="text-sm text-white/85"
                            >{track.play_count}</span
                        >
                    </div>
                    <div
                        class="flex items-start justify-between px-4 py-3"
                        style="border-top: 1px solid rgba(255,255,255,0.05)"
                    >
                        <span
                            class="text-xs text-white/35 font-medium w-28 flex-shrink-0 mt-0.5"
                            >File</span
                        >
                        <span
                            class="text-[11px] text-white/45 text-right break-all leading-relaxed"
                            >{track.file_path}</span
                        >
                    </div>
                    {#if track.date_modified}
                        <div
                            class="flex items-center justify-between px-4 py-3"
                            style="border-top: 1px solid rgba(255,255,255,0.05)"
                        >
                            <span
                                class="text-xs text-white/35 font-medium w-28 flex-shrink-0"
                                >Modified</span
                            >
                            <span class="text-sm text-white/85"
                                >{new Date(
                                    track.date_modified,
                                ).toLocaleDateString(undefined, {
                                    dateStyle: "medium",
                                })}</span
                            >
                        </div>
                    {/if}
                </div>
            </section>

            <!-- Lyrics -->
            {#if track.lyrics}
                <section>
                    <h3
                        class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
                    >
                        Lyrics
                    </h3>
                    <div
                        class="rounded-2xl px-4 py-4 max-h-64 overflow-y-auto no-scrollbar"
                        style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
                    >
                        <p
                            class="text-sm text-white/70 leading-7 whitespace-pre-wrap"
                        >
                            {track.lyrics}
                        </p>
                    </div>
                </section>
            {/if}

            <!-- Keywords / Classification -->
            <section>
                <h3
                    class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
                >
                    Keywords
                </h3>
                <div
                    class="rounded-2xl px-4 py-4 flex flex-col gap-3"
                    style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
                >
                    <!-- Chips -->
                    <div class="flex flex-wrap gap-2 min-h-[28px]">
                        {#if (track.keywords ?? []).length === 0}
                            <span class="text-sm text-white/25 italic"
                                >No keywords yet</span
                            >
                        {:else}
                            {#each track.keywords ?? [] as kw}
                                <span
                                    class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                                    style="background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.3); color: rgba(99,102,241,1)"
                                >
                                    {kw}
                                    <button
                                        onclick={() => removeKeyword(kw)}
                                        class="opacity-60 hover:opacity-100 transition-opacity"
                                        aria-label="Remove {kw}"
                                    >
                                        <span
                                            class="material-symbols-rounded text-[14px]"
                                            >close</span
                                        >
                                    </button>
                                </span>
                            {/each}
                        {/if}
                    </div>
                    <!-- Input -->
                    <form
                        onsubmit={(e) => {
                            e.preventDefault();
                            addKeyword();
                        }}
                        class="flex items-center gap-2"
                    >
                        <input
                            type="text"
                            bind:value={newKeyword}
                            placeholder="Add keyword…"
                            maxlength={30}
                            class="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none border-b border-white/15 focus:border-white/40 transition-colors pb-1"
                        />
                        <button
                            type="submit"
                            disabled={!newKeyword.trim() || savingKeyword}
                            class="flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-90 disabled:opacity-30"
                            style="background: var(--hap-primary, #6467f2)"
                            aria-label="Add keyword"
                        >
                            <span
                                class="material-symbols-rounded text-white text-[18px]"
                                >add</span
                            >
                        </button>
                    </form>
                </div>
            </section>

            <!-- ─── Identify Online (Phase 3) ─────────────────────────────────── -->
            <section>
                <h3
                    class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
                >
                    Online Identification
                </h3>
                <button
                    onclick={runIdentify}
                    disabled={identifying}
                    class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98] disabled:opacity-50"
                    style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25)"
                    aria-label="Identify track online via MusicBrainz"
                >
                    {#if identifying}
                        <span
                            class="material-symbols-rounded text-[22px] animate-spin"
                            style="color: var(--hap-primary,#6467f2)"
                            >autorenew</span
                        >
                    {:else}
                        <span
                            class="material-symbols-rounded text-[22px]"
                            style="color: var(--hap-primary,#6467f2); font-variation-settings: 'FILL' 1"
                            >travel_explore</span
                        >
                    {/if}
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-white">
                            {identifying
                                ? "Searching MusicBrainz…"
                                : "Identify Online"}
                        </p>
                        <p class="text-xs text-white/40">
                            MusicBrainz · Cover Art Archive
                        </p>
                    </div>
                    <span
                        class="material-symbols-rounded text-[18px] text-white/20"
                        >chevron_right</span
                    >
                </button>

                {#if identifyError}
                    <div
                        class="mt-3 px-4 py-3 rounded-2xl flex items-center gap-2"
                        style="background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.25)"
                    >
                        <span
                            class="material-symbols-rounded text-[18px] text-red-400"
                            >error</span
                        >
                        <p class="text-xs text-red-300">{identifyError}</p>
                    </div>
                {/if}
            </section>
        </div>
    {/if}
</div>

<!-- ─── Identify Results Bottom Sheet ───────────────────────────────────────── -->
{#if identifyOpen && !identifying}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-50"
        style="background: rgba(0,0,0,0.7); backdrop-filter: blur(4px)"
        role="dialog"
        aria-modal="true"
        aria-label="Identification results"
    >
        <!-- Sheet -->
        <div
            class="absolute bottom-0 left-0 right-0 rounded-t-[2rem] flex flex-col max-h-[80vh]"
            style="background: #0e0e1e; border-top: 1px solid rgba(255,255,255,0.10)"
        >
            <!-- Sheet handle -->
            <div class="flex justify-center pt-3 pb-1">
                <div
                    class="w-10 h-1 rounded-full"
                    style="background: rgba(255,255,255,0.15)"
                ></div>
            </div>

            <!-- Sheet header -->
            <div class="flex items-center justify-between px-5 py-3">
                <h2 class="text-base font-bold text-white">
                    Results from MusicBrainz
                </h2>
                <button
                    onclick={() => (identifyOpen = false)}
                    class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50"
                    aria-label="Close"
                >
                    <span class="material-symbols-rounded text-[20px]"
                        >close</span
                    >
                </button>
            </div>

            <!-- Results list -->
            <div class="overflow-y-auto flex-1 px-5 pb-8 flex flex-col gap-3">
                {#if identifyResults.length === 0}
                    <div class="py-12 text-center">
                        <span
                            class="material-symbols-rounded text-5xl text-white/15"
                            >search_off</span
                        >
                        <p class="text-white/40 mt-3">No results found</p>
                        <p class="text-xs text-white/25 mt-1">
                            Try editing the title/artist and searching again
                        </p>
                    </div>
                {:else}
                    {#each identifyResults as result}
                        <div
                            class="flex gap-4 rounded-2xl p-4"
                            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08)"
                        >
                            <!-- Artwork -->
                            <div
                                class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                                style="background: rgba(99,102,241,0.1)"
                            >
                                {#if result.artworkUrl}
                                    <img
                                        src={result.artworkUrl}
                                        alt="Cover art"
                                        class="w-full h-full object-cover"
                                    />
                                {:else}
                                    <div
                                        class="w-full h-full flex items-center justify-center"
                                    >
                                        <span
                                            class="material-symbols-rounded text-[28px] text-white/20"
                                            >album</span
                                        >
                                    </div>
                                {/if}
                            </div>

                            <!-- Info -->
                            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                                <div
                                    class="flex items-start justify-between gap-2"
                                >
                                    <p
                                        class="text-sm font-semibold text-white truncate"
                                    >
                                        {result.title}
                                    </p>
                                    <span
                                        class="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                                        style="background: rgba(99,102,241,0.2); color: rgba(180,182,255,1)"
                                    >
                                        {result.score}%
                                    </span>
                                </div>
                                <p class="text-xs text-white/60 truncate">
                                    {result.artist}
                                </p>
                                {#if result.album}
                                    <p class="text-xs text-white/40 truncate">
                                        {result.album}{result.year
                                            ? ` · ${result.year}`
                                            : ""}
                                    </p>
                                {/if}
                                {#if result.label}
                                    <p class="text-xs text-white/30">
                                        {result.label}
                                    </p>
                                {/if}

                                <button
                                    onclick={() => applyIdentification(result)}
                                    disabled={applyingResult === result.mbid}
                                    class="mt-2 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                                    style="background: var(--hap-primary,#6467f2); color: white"
                                    aria-label="Apply this identification"
                                >
                                    {#if applyingResult === result.mbid}
                                        <span
                                            class="material-symbols-rounded text-[14px] animate-spin"
                                            >autorenew</span
                                        >
                                    {:else}
                                        <span
                                            class="material-symbols-rounded text-[14px]"
                                            >check</span
                                        >
                                    {/if}
                                    Apply
                                </button>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    </div>
{/if}
