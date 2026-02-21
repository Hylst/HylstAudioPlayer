<script lang="ts">
    import { page } from "$app/stores";
    import { db } from "$lib/db/database.svelte";
    import { goto } from "$app/navigation";
    import { writeTagsToFile } from "$lib/fs/tagWriter";
    import type { Track } from "$lib/types";

    // ─── State ────────────────────────────────────────────────────────────────────
    let track = $state<Track | null>(null);
    let loading = $state(true);
    let saving = $state(false);
    let saveError = $state<string | null>(null);
    let saveSuccess = $state(false);
    let fileWriteSuccess = $state(false);
    let fileWriteError = $state<string | null>(null);

    // Editable form fields (separate from track to allow cancel)
    let form = $state({
        title: "",
        artist: "",
        album: "",
        album_artist: "",
        genre: "",
        year: "" as string | number,
        track_number: "" as string | number,
        composer: "",
        mood: "",
        comment: "",
        lyrics: "",
        bpm: "" as string | number,
        label: "",
        isrc: "",
    });

    // ─── Classification Presets ───────────────────────────────────────────────────
    const PRESETS: Record<string, { keywords: string[]; mood?: string }> = {
        Workout: {
            keywords: ["workout", "energy", "motivation"],
            mood: "energetic",
        },
        Sleep: {
            keywords: ["sleep", "ambient", "relaxing"],
            mood: "calm",
        },
        Focus: {
            keywords: ["focus", "study", "concentration"],
            mood: "focused",
        },
        Chill: {
            keywords: ["chill", "relax", "lofi"],
            mood: "relaxed",
        },
        Party: {
            keywords: ["party", "dance", "upbeat"],
            mood: "happy",
        },
        Sad: {
            keywords: ["sad", "melancholy", "emotional"],
            mood: "melancholic",
        },
    };

    // ─── ID from route ────────────────────────────────────────────────────────────
    const trackId = $derived(Number($page.params.id));

    // ─── Load track ───────────────────────────────────────────────────────────────
    $effect(() => {
        if (!trackId || !db.isReady) return;
        loading = true;
        db.getTrackById(trackId).then((t) => {
            track = t;
            if (t) {
                form.title = t.title ?? "";
                form.artist = t.artist ?? "";
                form.album = t.album ?? "";
                form.album_artist = t.album_artist ?? "";
                form.genre = t.genre ?? "";
                form.year = t.year ?? "";
                form.track_number = t.track_number ?? "";
                form.composer = t.composer ?? "";
                form.mood = t.mood ?? "";
                form.comment = t.comment ?? "";
                form.lyrics = t.lyrics ?? "";
                form.bpm = t.bpm ?? "";
                form.label = t.label ?? "";
                form.isrc = t.isrc ?? "";
            }
            loading = false;
        });
    });

    // ─── Apply preset ─────────────────────────────────────────────────────────────
    async function applyPreset(presetName: string): Promise<void> {
        if (!track) return;
        const preset = PRESETS[presetName];
        // Merge: add new keywords without duplicates
        const existingKws = track.keywords ?? [];
        const merged = Array.from(
            new Set([...existingKws, ...preset.keywords]),
        );
        if (preset.mood) form.mood = preset.mood;
        // Optimistic update keywords
        await db.updateTrack(track.id, { keywords: merged });
        track = { ...track, keywords: merged, mood: form.mood };
        saveSuccess = true;
        setTimeout(() => (saveSuccess = false), 1500);
    }

    // ─── Save ─────────────────────────────────────────────────────────────────────
    async function save(): Promise<void> {
        if (!track) return;
        saving = true;
        saveError = null;
        fileWriteError = null;
        fileWriteSuccess = false;

        const fields: Partial<Track> = {
            title: form.title || track.title,
            artist: form.artist || track.artist,
            album: form.album || track.album,
            album_artist: form.album_artist || undefined,
            genre: form.genre || undefined,
            year: form.year !== "" ? Number(form.year) : undefined,
            track_number:
                form.track_number !== ""
                    ? Number(form.track_number)
                    : undefined,
            composer: form.composer || undefined,
            mood: form.mood || undefined,
            comment: form.comment || undefined,
            lyrics: form.lyrics || undefined,
            bpm: form.bpm !== "" ? Number(form.bpm) : undefined,
            label: form.label || undefined,
            isrc: form.isrc || undefined,
        };

        try {
            // 1 — Save to SQLite database
            await db.updateTrack(track.id, fields);
            saveSuccess = true;

            // 2 — Write tags back to the actual audio file
            const writeResult = await writeTagsToFile(track.file_path, {
                title: fields.title,
                artist: fields.artist,
                album: fields.album,
                album_artist: fields.album_artist,
                genre: fields.genre,
                year: fields.year,
                track_number: fields.track_number,
                composer: fields.composer,
                comment: fields.comment,
                lyrics: fields.lyrics,
                bpm: fields.bpm,
                label: fields.label,
                isrc: fields.isrc,
                mood: fields.mood,
            });

            if (writeResult.success) {
                fileWriteSuccess = true;
            } else {
                // Non-blocking — DB was saved, just inform about file
                fileWriteError =
                    writeResult.error ??
                    `${writeResult.format.toUpperCase()} file write not supported`;
            }

            setTimeout(() => {
                saveSuccess = false;
                fileWriteSuccess = false;
                fileWriteError = null;
                goto(`/track/${track!.id}`);
            }, 2000);
        } catch (err: unknown) {
            saveError = err instanceof Error ? err.message : "Save failed";
        } finally {
            saving = false;
        }
    }

    // Field config for the form grid
    // NOTE: 'lyrics' and 'comment' are rendered as textarea, others as input
    const multilineKeys = new Set(["lyrics", "comment"]);
    const textFields = [
        { key: "title", label: "Title", icon: "music_note" },
        { key: "artist", label: "Artist", icon: "person" },
        { key: "album", label: "Album", icon: "album" },
        { key: "album_artist", label: "Album Artist", icon: "groups" },
        { key: "genre", label: "Genre", icon: "category" },
        { key: "composer", label: "Composer", icon: "piano" },
        { key: "label", label: "Label", icon: "label" },
        { key: "isrc", label: "ISRC", icon: "qr_code" },
        { key: "mood", label: "Mood", icon: "mood" },
        { key: "comment", label: "Comment", icon: "comment" },
        { key: "lyrics", label: "Lyrics", icon: "lyrics" },
    ] as const;

    const numberFields = [
        {
            key: "year",
            label: "Year",
            icon: "calendar_today",
            min: 1900,
            max: 2099,
        },
        {
            key: "track_number",
            label: "Track #",
            icon: "format_list_numbered",
            min: 1,
            max: 999,
        },
        { key: "bpm", label: "BPM", icon: "speed", min: 40, max: 250 },
    ] as const;
</script>

<!-- Background -->
<div
    class="fixed inset-0 z-0 pointer-events-none"
    aria-hidden="true"
    style="background: linear-gradient(160deg, rgba(99,102,241,0.10) 0%, rgba(10,10,20,1) 50%)"
></div>

<div
    class="relative z-10 flex flex-col w-full max-w-md mx-auto min-h-full pb-32"
>
    <!-- Header -->
    <header
        class="sticky top-0 z-20 flex items-center justify-between px-5 pt-12 pb-4"
        style="background: rgba(10,10,20,0.85); backdrop-filter: blur(20px)"
    >
        <a
            href="/track/{trackId}"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Cancel"
        >
            <span class="material-symbols-rounded text-white/80 text-[24px]"
                >arrow_back</span
            >
        </a>
        <h1
            class="text-sm font-semibold text-white/60 uppercase tracking-widest"
        >
            Edit Tags
        </h1>
        <button
            onclick={save}
            disabled={saving || !track}
            class="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
            style="background: var(--hap-primary,#6467f2); box-shadow: 0 0 16px -2px rgba(100,103,242,0.5)"
            aria-label="Save tags"
        >
            {#if saving}
                <span class="material-symbols-rounded text-[18px] animate-spin"
                    >autorenew</span
                >
            {:else if saveSuccess}
                <span class="material-symbols-rounded text-[18px]">check</span>
            {:else}
                <span class="material-symbols-rounded text-[18px]">save</span>
            {/if}
            {saving ? "Saving…" : saveSuccess ? "Saved!" : "Save"}
        </button>
    </header>

    <!-- ─── Status banners ─────────────────────────────────────────────────── -->
    {#if saveError}
        <div
            class="mx-5 mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl text-red-300 text-sm font-medium"
            style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.25)"
        >
            <span class="material-symbols-rounded text-[18px] text-red-400"
                >error</span
            >
            {saveError}
        </div>
    {/if}
    {#if fileWriteError}
        <div
            class="mx-5 mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl text-amber-300 text-sm font-medium"
            style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.25)"
        >
            <span class="material-symbols-rounded text-[18px] text-amber-400"
                >info</span
            >
            <span>{fileWriteError}</span>
        </div>
    {/if}
    {#if fileWriteSuccess}
        <div
            class="mx-5 mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl text-emerald-300 text-sm font-medium"
            style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25)"
        >
            <span class="material-symbols-rounded text-[18px] text-emerald-400"
                >check_circle</span
            >
            Saved to database and audio file ✓
        </div>
    {/if}

    {#if loading}
        <div class="px-5 pt-8 flex flex-col gap-4 animate-pulse">
            {#each [1, 2, 3, 4, 5] as _}
                <div class="h-14 rounded-2xl bg-white/5"></div>
            {/each}
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
        <div class="px-5 pt-4 flex flex-col gap-6">
            <!-- ─── Classification Presets ─────────────────────────────────────────── -->
            <section>
                <h2
                    class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
                >
                    Classification Presets
                </h2>
                <p class="text-xs text-white/35 mb-3 leading-relaxed">
                    One tap adds relevant keywords & mood to this track.
                </p>
                <div class="flex flex-wrap gap-2">
                    {#each Object.entries(PRESETS) as [name, preset]}
                        {@const icons: Record<string, string> = {
                            Workout: 'fitness_center',
                            Sleep: 'bedtime',
                            Focus: 'psychology',
                            Chill: 'spa',
                            Party: 'celebration',
                            Sad: 'sentiment_dissatisfied',
                        }}
                        <button
                            onclick={() => applyPreset(name)}
                            class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 hover:bg-white/10"
                            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.75)"
                            aria-label="Apply {name} preset"
                        >
                            <span
                                class="material-symbols-rounded text-[18px]"
                                style="color: var(--hap-primary,#6467f2); font-variation-settings: 'FILL' 1"
                            >
                                {icons[name] ?? "label"}
                            </span>
                            {name}
                        </button>
                    {/each}
                </div>

                <!-- Current keywords preview -->
                {#if (track.keywords ?? []).length > 0}
                    <div class="flex flex-wrap gap-1.5 mt-3">
                        {#each track.keywords ?? [] as kw}
                            <span
                                class="px-2.5 py-1 rounded-full text-xs font-medium"
                                style="background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.25); color: rgba(180,182,255,0.9)"
                            >
                                {kw}
                            </span>
                        {/each}
                    </div>
                {/if}
            </section>

            <!-- ─── Text fields ───────────────────────────────────────────────────── -->
            <section>
                <h2
                    class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
                >
                    Metadata
                </h2>
                <div class="flex flex-col gap-3">
                    {#each textFields as field}
                        <div
                            class="flex items-center gap-3 rounded-2xl px-4 py-3"
                            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08)"
                        >
                            <span
                                class="material-symbols-rounded text-[20px] text-white/30 flex-shrink-0"
                                style="font-variation-settings: 'FILL' 0"
                            >
                                {field.icon}
                            </span>
                            <div class="flex flex-col flex-1 min-w-0">
                                <label
                                    class="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1"
                                    for="field-{field.key}"
                                >
                                    {field.label}
                                </label>
                                {#if multilineKeys.has(field.key)}
                                    <textarea
                                        id="field-{field.key}"
                                        bind:value={form[field.key]}
                                        rows="3"
                                        class="bg-transparent text-sm text-white/90 outline-none resize-none w-full placeholder:text-white/20"
                                        placeholder="—"
                                    ></textarea>
                                {:else}
                                    <input
                                        id="field-{field.key}"
                                        type="text"
                                        bind:value={form[field.key]}
                                        class="bg-transparent text-sm text-white/90 outline-none w-full placeholder:text-white/20"
                                        placeholder="—"
                                    />
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </section>

            <!-- ─── Numeric fields ────────────────────────────────────────────────── -->
            <section>
                <h2
                    class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
                >
                    Numbers
                </h2>
                <div class="flex flex-col gap-3">
                    {#each numberFields as field}
                        <div
                            class="flex items-center gap-3 rounded-2xl px-4 py-3"
                            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08)"
                        >
                            <span
                                class="material-symbols-rounded text-[20px] text-white/30 flex-shrink-0"
                            >
                                {field.icon}
                            </span>
                            <div class="flex flex-col flex-1 min-w-0">
                                <label
                                    class="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1"
                                    for="field-{field.key}"
                                >
                                    {field.label}
                                </label>
                                <input
                                    id="field-{field.key}"
                                    type="number"
                                    bind:value={form[field.key]}
                                    min={field.min}
                                    max={field.max}
                                    class="bg-transparent text-sm text-white/90 outline-none w-full placeholder:text-white/20"
                                    placeholder="—"
                                />
                            </div>
                        </div>
                    {/each}
                </div>
            </section>

            <!-- ─── Write-back note ───────────────────────────────────────────────── -->
            <div
                class="rounded-2xl px-4 py-3 flex items-start gap-3"
                style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.18)"
            >
                <span
                    class="material-symbols-rounded text-[18px] mt-0.5"
                    style="color: var(--hap-primary,#6467f2)">info</span
                >
                <p
                    class="text-xs leading-relaxed"
                    style="color: rgba(180,182,255,0.8)"
                >
                    Changes are saved to the <strong
                        >Hylst library database</strong
                    >. File-level tag write-back (editing the actual MP3/FLAC)
                    will be available in a future update.
                </p>
            </div>

            <!-- ─── Error ─────────────────────────────────────────────────────────── -->
            {#if saveError}
                <div
                    class="rounded-2xl px-4 py-3 flex items-center gap-3"
                    style="background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.25)"
                >
                    <span
                        class="material-symbols-rounded text-[18px] text-red-400"
                        >error</span
                    >
                    <p class="text-sm text-red-300">{saveError}</p>
                </div>
            {/if}

            <!-- Bottom save button -->
            <button
                onclick={save}
                disabled={saving || !track}
                class="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-40"
                style="background: linear-gradient(135deg, var(--hap-primary,#6467f2), rgba(168,85,247,0.9)); box-shadow: 0 8px 32px -8px rgba(100,103,242,0.5)"
            >
                {saving ? "Saving…" : saveSuccess ? "✓ Saved!" : "Save Changes"}
            </button>
        </div>
    {/if}
</div>
