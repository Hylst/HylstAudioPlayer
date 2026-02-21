<script lang="ts">
    import { page } from "$app/stores";
    import { db } from "$lib/db/database.svelte";
    import { player } from "$lib/audio/player.svelte";
    import { formatTime } from "$lib/utils/format";
    import type { Track } from "$lib/types";

    let playlistId = $derived(parseInt($page.params.id ?? "0"));
    let playlist = $state<{
        id: number;
        name: string;
        description?: string;
        track_count?: number;
        cover_art?: string | null;
        is_favorites?: boolean;
    } | null>(null);
    let tracks = $state<Track[]>([]);
    let loading = $state(true);

    // ─── Rename modal ───────────────────────────────────────────────
    let showRenameModal = $state(false);
    let renameValue = $state("");
    let renameSaving = $state(false);

    // ─── Cover art modal ────────────────────────────────────────────
    let showCoverModal = $state(false);

    // ─── Drag-to-reorder ────────────────────────────────────────────
    let dragFromIdx = $state<number | null>(null);
    let dragOverIdx = $state<number | null>(null);

    // ─── More menu (per track) ──────────────────────────────────────
    let openMenuTrackId = $state<number | null>(null);

    // ─── 10 Placeholder designs ─────────────────────────────────────
    const PLACEHOLDERS = [
        {
            bg: "linear-gradient(135deg, #6366f2 0%, #a855f7 100%)",
            icon: "queue_music",
        },
        {
            bg: "linear-gradient(135deg, #06b6d4 0%, #6366f2 100%)",
            icon: "music_note",
        },
        {
            bg: "linear-gradient(135deg, #f43f5e 0%, #f97316 100%)",
            icon: "favorite",
        },
        {
            bg: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
            icon: "headphones",
        },
        {
            bg: "linear-gradient(135deg, #f97316 0%, #eab308 100%)",
            icon: "star",
        },
        {
            bg: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
            icon: "album",
        },
        {
            bg: "linear-gradient(135deg, #14b8a6 0%, #6366f2 100%)",
            icon: "library_music",
        },
        {
            bg: "linear-gradient(135deg, #f43f5e 0%, #8b5cf6 100%)",
            icon: "piano",
        },
        {
            bg: "linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)",
            icon: "equalizer",
        },
        {
            bg: "linear-gradient(135deg, #eab308 0%, #f43f5e 100%)",
            icon: "local_fire_department",
        },
    ];

    function getPlaceholder(id: number) {
        return PLACEHOLDERS[id % PLACEHOLDERS.length];
    }

    $effect(() => {
        const id = playlistId;
        if (db.isReady && id) loadPlaylist(id);
    });

    async function loadPlaylist(id: number): Promise<void> {
        loading = true;
        try {
            const all = await db.getPlaylists();
            playlist = all.find((p: any) => p.id === id) ?? null;
            tracks = await db.getTracksByPlaylist(id);
        } catch (e) {
            console.error("[PlaylistDetail] Failed:", e);
        } finally {
            loading = false;
        }
    }

    function playAll(): void {
        if (tracks.length === 0) return;
        player.playFromList(tracks, 0);
    }

    function shufflePlay(): void {
        if (tracks.length === 0) return;
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        player.playFromList(shuffled, 0);
    }

    let totalDurationSec = $derived(
        tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0),
    );

    // ─── Rename ──────────────────────────────────────────────────────
    function openRename() {
        renameValue = playlist?.name ?? "";
        showRenameModal = true;
    }

    async function saveRename(): Promise<void> {
        if (!playlist || !renameValue.trim() || renameSaving) return;
        renameSaving = true;
        try {
            await db.renamePlaylist(playlist.id, renameValue.trim());
            playlist = { ...playlist, name: renameValue.trim() };
            showRenameModal = false;
        } catch (e) {
            console.error("[Rename] Failed:", e);
        } finally {
            renameSaving = false;
        }
    }

    // ─── Cover art ───────────────────────────────────────────────────
    async function selectPlaceholder(idx: number): Promise<void> {
        if (!playlist) return;
        const key = `placeholder:${idx}`;
        await db.updatePlaylistCover(playlist.id, key);
        playlist = { ...playlist, cover_art: key };
        showCoverModal = false;
    }

    async function clearCover(): Promise<void> {
        if (!playlist) return;
        await db.updatePlaylistCover(playlist.id, null);
        playlist = { ...playlist, cover_art: null };
        showCoverModal = false;
    }

    function parseCover(
        coverArt: string | null | undefined,
    ): { type: "placeholder"; idx: number } | { type: "none" } {
        if (!coverArt) return { type: "none" };
        if (coverArt.startsWith("placeholder:")) {
            return {
                type: "placeholder",
                idx: parseInt(coverArt.split(":")[1]),
            };
        }
        return { type: "none" };
    }

    // $derived avoids {@const} in invalid template placement
    let coverInfo = $derived(parseCover(playlist?.cover_art));

    // ─── Drag-to-reorder ─────────────────────────────────────────────
    function onDragStart(i: number) {
        dragFromIdx = i;
    }

    function onDragOver(e: DragEvent, i: number) {
        e.preventDefault();
        dragOverIdx = i;
    }

    async function onDrop(e: DragEvent, toIdx: number): Promise<void> {
        e.preventDefault();
        if (dragFromIdx === null || dragFromIdx === toIdx) {
            dragFromIdx = null;
            dragOverIdx = null;
            return;
        }
        // Reorder local state
        const newTracks = [...tracks];
        const [moved] = newTracks.splice(dragFromIdx, 1);
        newTracks.splice(toIdx, 0, moved);
        tracks = newTracks;
        dragFromIdx = null;
        dragOverIdx = null;
        // Persist new order
        if (playlist) {
            await db.reorderPlaylistTracks(
                playlist.id,
                newTracks.map((t) => t.id),
            );
        }
    }

    function onDragEnd() {
        dragFromIdx = null;
        dragOverIdx = null;
    }

    // ─── Remove from playlist ────────────────────────────────────────
    async function removeTrack(trackId: number): Promise<void> {
        if (!playlist) return;
        tracks = tracks.filter((t) => t.id !== trackId);
        openMenuTrackId = null;
        await db.removeTrackFromPlaylist(playlist.id, trackId);
    }
</script>

<!-- Ambient background -->
<div
    class="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    aria-hidden="true"
>
    <div
        class="absolute top-[-20%] left-[-10%] w-[140%] h-[80%] rounded-full blur-[80px] opacity-30"
        style="background: radial-gradient(ellipse at center, var(--hap-primary, rgba(99,102,241,0.4)) 0%, transparent 70%)"
    ></div>
    <div
        class="absolute bottom-0 left-0 right-0 h-1/2"
        style="background: linear-gradient(to top, #0a0a12 0%, transparent 100%)"
    ></div>
</div>

<!-- ─── Rename Modal ─────────────────────────────────────────────────── -->
{#if showRenameModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center px-6"
        style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px)"
        onclick={(e) => {
            if (e.target === e.currentTarget) showRenameModal = false;
        }}
    >
        <div
            class="w-full max-w-sm rounded-3xl p-6 space-y-4"
            style="background: rgba(20,20,35,0.95); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 0 40px rgba(99,102,241,0.2)"
        >
            <h2 class="text-lg font-bold text-white">Rename Playlist</h2>
            <input
                type="text"
                bind:value={renameValue}
                placeholder="Playlist name"
                class="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: white"
                onkeydown={(e) => e.key === "Enter" && saveRename()}
            />
            <div class="flex gap-3">
                <button
                    onclick={() => (showRenameModal = false)}
                    class="flex-1 py-3 rounded-2xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Cancel rename">Cancel</button
                >
                <button
                    onclick={saveRename}
                    disabled={!renameValue.trim() || renameSaving}
                    class="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40 active:scale-95"
                    style="background: var(--hap-primary, #6467f2); box-shadow: 0 0 16px -4px rgba(100,103,242,0.5)"
                    aria-label="Save playlist name"
                >
                    {renameSaving ? "Saving…" : "Save"}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ─── Cover Art Modal ──────────────────────────────────────────────── -->
{#if showCoverModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-end justify-center"
        style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px)"
        onclick={(e) => {
            if (e.target === e.currentTarget) showCoverModal = false;
        }}
    >
        <div
            class="w-full max-w-md rounded-t-3xl p-6 space-y-5"
            style="background: rgba(14,14,26,0.98); border-top: 1px solid rgba(255,255,255,0.08)"
        >
            <div class="flex items-center justify-between">
                <h2 class="text-base font-bold text-white">Choose Cover Art</h2>
                <button
                    onclick={() => (showCoverModal = false)}
                    class="text-white/40 hover:text-white"
                    aria-label="Close"
                >
                    <span class="material-symbols-rounded text-[20px]"
                        >close</span
                    >
                </button>
            </div>
            <!-- 10 placeholder grid -->
            <div class="grid grid-cols-5 gap-3">
                {#each PLACEHOLDERS as ph, idx}
                    <button
                        onclick={() => selectPlaceholder(idx)}
                        class="relative w-full aspect-square rounded-2xl overflow-hidden transition-transform hover:scale-105 active:scale-95"
                        style="background: {ph.bg}"
                        aria-label="Use placeholder {idx + 1}"
                    >
                        <div
                            class="absolute inset-0 flex items-center justify-center"
                        >
                            <span
                                class="material-symbols-rounded text-white text-[28px] opacity-80"
                                >{ph.icon}</span
                            >
                        </div>
                        {#if playlist?.cover_art === `placeholder:${idx}`}
                            <div
                                class="absolute inset-0 flex items-center justify-center"
                                style="background: rgba(0,0,0,0.35)"
                            >
                                <span
                                    class="material-symbols-rounded text-white text-[22px]"
                                    >check_circle</span
                                >
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>
            {#if playlist?.cover_art}
                <button
                    onclick={clearCover}
                    class="w-full py-3 rounded-2xl text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >Remove cover</button
                >
            {/if}
        </div>
    </div>
{/if}

<div
    class="relative z-10 flex flex-col h-full max-w-md mx-auto w-full overflow-hidden"
>
    <!-- ─── Header ─── -->
    <header
        class="flex items-center justify-between px-5 pt-12 pb-4 w-full z-20"
    >
        <button
            onclick={() => history.back()}
            class="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1)"
            aria-label="Go back"
        >
            <span class="material-symbols-rounded text-[22px]">arrow_back</span>
        </button>
        <div
            class="text-sm font-semibold tracking-widest uppercase text-white/50"
        >
            Playlist
        </div>
        {#if !playlist?.is_favorites}
            <button
                onclick={openRename}
                class="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1)"
                aria-label="Rename playlist"
            >
                <span class="material-symbols-rounded text-[20px]">edit</span>
            </button>
        {:else}
            <div class="w-10"></div>
        {/if}
    </header>

    <!-- ─── Scrollable Content ─── -->
    <main
        class="flex-1 overflow-y-auto pb-32 px-4 space-y-6"
        style="scrollbar-width: none; -ms-overflow-style: none"
    >
        <!-- ─── Playlist Hero ─── -->
        <div class="flex flex-col items-center pt-2">
            <!-- Artwork -->
            <div class="relative w-48 h-48 mb-6 group">
                <div
                    class="absolute inset-0 rounded-full blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-700"
                    style="background: var(--hap-primary-glow, rgba(99,102,241,0.4))"
                ></div>
                <!-- Cover art display -->
                <div
                    class="relative w-full h-full rounded-[2rem] overflow-hidden flex items-center justify-center cursor-pointer"
                    style={coverInfo.type === "placeholder"
                        ? `background: ${PLACEHOLDERS[(coverInfo as { type: "placeholder"; idx: number }).idx].bg}; border: 1px solid rgba(255,255,255,0.15)`
                        : `border: 1px solid rgba(255,255,255,0.1); background: radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(10,10,18,0.9) 100%)`}
                    onclick={() => {
                        if (!playlist?.is_favorites) showCoverModal = true;
                    }}
                    role="button"
                    tabindex={playlist?.is_favorites ? -1 : 0}
                    onkeydown={(e) =>
                        e.key === "Enter" &&
                        !playlist?.is_favorites &&
                        (showCoverModal = true)}
                    aria-label="Change playlist cover"
                >
                    {#if coverInfo.type === "placeholder"}
                        <span
                            class="material-symbols-rounded text-white text-[80px] opacity-80"
                            >{PLACEHOLDERS[
                                (
                                    coverInfo as {
                                        type: "placeholder";
                                        idx: number;
                                    }
                                ).idx
                            ].icon}</span
                        >
                    {:else}
                        <span
                            class="material-symbols-rounded text-[80px]"
                            style="color: var(--hap-primary, #6467f2); opacity: 0.6"
                            >queue_music</span
                        >
                    {/if}
                    <!-- Edit overlay on hover -->
                    {#if !playlist?.is_favorites}
                        <div
                            class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style="background: rgba(0,0,0,0.4)"
                        >
                            <span
                                class="material-symbols-rounded text-white text-[32px]"
                                >edit</span
                            >
                        </div>
                    {/if}
                    <!-- Shine -->
                    <div
                        class="absolute inset-0 pointer-events-none"
                        style="background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)"
                    ></div>
                </div>
            </div>

            <!-- Text info -->
            <div class="text-center space-y-2 mb-6">
                <h1
                    class="text-3xl font-bold tracking-tight text-white leading-tight"
                    style="text-shadow: 0 0 20px rgba(99,102,241,0.4)"
                >
                    {playlist?.name ?? "…"}
                </h1>
                {#if playlist?.description}
                    <p class="text-sm text-white/50">{playlist.description}</p>
                {/if}
                <div
                    class="flex items-center justify-center gap-2 text-sm font-medium"
                    style="color: rgba(99,102,241,0.8)"
                >
                    <span
                        class="text-xs uppercase tracking-wider px-2 py-0.5 rounded"
                        style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2)"
                        >Hylst</span
                    >
                    <span class="text-white/30">•</span>
                    <span class="text-white/50">{tracks.length} songs</span>
                    {#if totalDurationSec > 0}
                        <span class="text-white/30">•</span>
                        <span class="text-white/50"
                            >{formatTime(totalDurationSec)}</span
                        >
                    {/if}
                </div>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-4 w-full max-w-xs">
                <button
                    class="flex-1 h-12 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-40"
                    style="background: var(--hap-primary, #6366f2); color: white; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 0 20px -5px var(--hap-primary-glow, rgba(99,102,241,0.6))"
                    onclick={playAll}
                    disabled={tracks.length === 0}
                >
                    <span class="material-symbols-rounded text-[20px]"
                        >play_arrow</span
                    >
                    Play All
                </button>
                <button
                    class="flex-1 h-12 rounded-2xl font-semibold flex items-center justify-center gap-2 text-white hover:bg-white/10 transition-all transform active:scale-95 disabled:opacity-40"
                    style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1)"
                    onclick={shufflePlay}
                    disabled={tracks.length === 0}
                >
                    <span class="material-symbols-rounded text-[20px]"
                        >shuffle</span
                    >
                    Shuffle
                </button>
            </div>
        </div>

        <!-- ─── Track List ─── -->
        <div class="space-y-1 pt-2">
            {#if tracks.length > 0 && !playlist?.is_favorites}
                <p
                    class="text-[10px] text-white/25 uppercase tracking-wider px-2 pb-1"
                >
                    Drag ↕ to reorder
                </p>
            {/if}

            {#if loading}
                {#each { length: 4 } as _}
                    <div class="h-16 rounded-xl bg-white/5 animate-pulse"></div>
                {/each}
            {:else if tracks.length === 0}
                <div class="flex flex-col items-center py-16 gap-4 text-center">
                    <span
                        class="material-symbols-rounded text-5xl text-white/10"
                        >queue_music</span
                    >
                    <p class="text-white/40 text-sm">
                        No tracks in this playlist
                    </p>
                    <p class="text-white/25 text-xs">
                        Go to the Library and add tracks using the ⋮ menu
                    </p>
                </div>
            {:else}
                {#each tracks as track, i (track.id)}
                    {@const isCurrent = player.currentTrack?.id === track.id}
                    {@const isDragging = dragFromIdx === i}
                    {@const isDragTarget =
                        dragOverIdx === i && dragFromIdx !== i}

                    <!-- Track row (draggable) -->
                    <div
                        class="group relative w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-grab active:cursor-grabbing"
                        style={isDragTarget
                            ? `background: rgba(99,102,241,0.08); border: 1px dashed rgba(99,102,241,0.5); opacity: 1`
                            : isDragging
                              ? `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); opacity: 0.4`
                              : isCurrent
                                ? `background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); box-shadow: 0 0 15px -5px rgba(99,102,241,0.3)`
                                : `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05)`}
                        draggable="true"
                        ondragstart={() => onDragStart(i)}
                        ondragover={(e) => onDragOver(e, i)}
                        ondrop={(e) => onDrop(e, i)}
                        ondragend={onDragEnd}
                        role="listitem"
                    >
                        <!-- Drag handle -->
                        {#if !playlist?.is_favorites}
                            <span
                                class="material-symbols-rounded text-[16px] text-white/20 flex-shrink-0 select-none"
                                >drag_indicator</span
                            >
                        {/if}

                        <!-- Artwork/index — click area -->
                        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                        <div
                            class="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                            style="background: rgba(255,255,255,0.05)"
                            onclick={() => player.playFromList(tracks, i)}
                        >
                            {#if isCurrent}
                                <span
                                    class="material-symbols-rounded animate-pulse"
                                    style="color: var(--hap-primary, #6467f2); font-size: 22px"
                                    >equalizer</span
                                >
                            {:else}
                                <span
                                    class="text-xs font-mono text-white/20 group-hover:hidden"
                                    >{i + 1}</span
                                >
                                <span
                                    class="material-symbols-rounded text-white/40 hidden group-hover:flex text-[20px]"
                                    >play_arrow</span
                                >
                            {/if}
                        </div>

                        <!-- Track info — click area -->
                        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                        <div
                            class="flex-1 min-w-0 cursor-pointer"
                            onclick={() => player.playFromList(tracks, i)}
                        >
                            <h3
                                class="font-semibold truncate text-sm leading-tight"
                                style={isCurrent
                                    ? "color: var(--hap-primary, #6467f2)"
                                    : "color: white"}
                            >
                                {track.title ?? "Unknown Track"}
                            </h3>
                            <p
                                class="text-xs truncate mt-0.5"
                                style={isCurrent
                                    ? "color: rgba(99,102,241,0.6)"
                                    : "color: rgba(255,255,255,0.4)"}
                            >
                                {track.artist ?? "Unknown Artist"}
                            </p>
                        </div>

                        <!-- Duration -->
                        <span
                            class="text-xs font-mono tabular-nums flex-shrink-0"
                            style={isCurrent
                                ? "color: var(--hap-primary, #6467f2)"
                                : "color: rgba(255,255,255,0.3)"}
                            >{formatTime(track.duration)}</span
                        >

                        <!-- Per-track menu -->
                        <div class="relative">
                            <button
                                class="w-8 h-8 flex items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    openMenuTrackId =
                                        openMenuTrackId === track.id
                                            ? null
                                            : track.id;
                                }}
                                aria-label="Track options"
                                aria-expanded={openMenuTrackId === track.id}
                            >
                                <span
                                    class="material-symbols-rounded text-[18px]"
                                    >more_vert</span
                                >
                            </button>

                            {#if openMenuTrackId === track.id}
                                <div
                                    class="absolute right-0 top-9 z-30 py-1 rounded-xl min-w-[160px]"
                                    style="background: rgba(20,20,35,0.98); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 24px rgba(0,0,0,0.4)"
                                >
                                    <button
                                        class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                        onclick={() => {
                                            player.playFromList(tracks, i);
                                            openMenuTrackId = null;
                                        }}
                                    >
                                        <span
                                            class="material-symbols-rounded text-[18px]"
                                            >play_arrow</span
                                        > Play
                                    </button>
                                    <button
                                        class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                                        onclick={() => player.addToQueue(track)}
                                    >
                                        <span
                                            class="material-symbols-rounded text-[18px]"
                                            >playlist_add</span
                                        > Add to Queue
                                    </button>
                                    {#if !playlist?.is_favorites}
                                        <div
                                            class="border-t border-white/5 my-1"
                                        ></div>
                                        <button
                                            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                            onclick={() =>
                                                removeTrack(track.id)}
                                        >
                                            <span
                                                class="material-symbols-rounded text-[18px]"
                                                >remove_circle</span
                                            > Remove
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </main>
</div>

<!-- Close track menu on outside click -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
{#if openMenuTrackId !== null}
    <div
        class="fixed inset-0 z-20"
        onclick={() => (openMenuTrackId = null)}
    ></div>
{/if}
