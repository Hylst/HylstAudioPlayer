<script lang="ts">
    import { playlists, type PlaylistMeta } from "$lib/audio/playlists.svelte";
    import { player } from "$lib/audio/player.svelte";
    import { db } from "$lib/db/database.svelte";
    import { formatTime } from "$lib/utils/format";
    import type { Track } from "$lib/types";

    // ─── View state ──────────────────────────────────────────────────────────────
    type View = "list" | "detail";
    let view = $state<View>("list");

    // ─── Create modal ────────────────────────────────────────────────────────────
    let showCreateModal = $state(false);
    let newPlaylistName = $state("");
    let newPlaylistDesc = $state("");
    let isCreating = $state(false);

    // ─── Rename modal ────────────────────────────────────────────────────────────
    let renamingPlaylist = $state<PlaylistMeta | null>(null);
    let renameValue = $state("");

    // ─── Delete confirm ──────────────────────────────────────────────────────────
    let deletingPlaylist = $state<PlaylistMeta | null>(null);

    // ─── Detail view ─────────────────────────────────────────────────────────────
    async function openPlaylist(pl: PlaylistMeta) {
        if (pl.is_favorites) {
            // Load favorites as tracks
            playlists.isLoading = true;
            playlists.activePlaylist = pl;
            try {
                playlists.activePlaylistTracks = await db.getFavorites();
            } finally {
                playlists.isLoading = false;
            }
        } else {
            await playlists.loadPlaylist(pl);
        }
        view = "detail";
    }

    function goBack() {
        view = "list";
        playlists.activePlaylist = null;
        playlists.activePlaylistTracks = [];
    }

    // ─── Create ──────────────────────────────────────────────────────────────────
    async function createPlaylist() {
        if (!newPlaylistName.trim()) return;
        isCreating = true;
        try {
            await playlists.create(
                newPlaylistName.trim(),
                newPlaylistDesc.trim() || undefined,
            );
            newPlaylistName = "";
            newPlaylistDesc = "";
            showCreateModal = false;
        } finally {
            isCreating = false;
        }
    }

    // ─── Rename ──────────────────────────────────────────────────────────────────
    function startRename(pl: PlaylistMeta) {
        renamingPlaylist = pl;
        renameValue = pl.name;
    }

    async function confirmRename() {
        if (!renamingPlaylist || !renameValue.trim()) return;
        await playlists.rename(renamingPlaylist.id, renameValue.trim());
        renamingPlaylist = null;
    }

    // ─── Delete ──────────────────────────────────────────────────────────────────
    async function confirmDelete() {
        if (!deletingPlaylist) return;
        await playlists.delete(deletingPlaylist.id);
        deletingPlaylist = null;
        if (view === "detail") goBack();
    }

    // ─── Track actions ───────────────────────────────────────────────────────────
    function playPlaylist(tracks: Track[]) {
        if (!tracks.length) return;
        player.setQueue(tracks, 0);
    }

    function playTrack(track: Track, trackList: Track[]) {
        const idx = trackList.indexOf(track);
        player.setQueue(trackList, idx >= 0 ? idx : 0);
    }

    async function removeFromPlaylist(track: Track) {
        if (!playlists.activePlaylist) return;
        if (playlists.activePlaylist.is_favorites) {
            await playlists.toggleFavorite(track.id);
            playlists.activePlaylistTracks = await db.getFavorites();
        } else {
            await playlists.removeTrack(playlists.activePlaylist.id, track.id);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────
    function totalDuration(tracks: Track[]): string {
        const secs = tracks.reduce((s, t) => s + (t.duration ?? 0), 0);
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
</script>

<!-- ─── Full-screen bg gradient ──────────────────────────────────────────────── -->
<div
    class="fixed inset-0 z-0 pointer-events-none"
    style="background: radial-gradient(ellipse at 20% 10%, rgba(99,102,241,0.18) 0%, transparent 55%),
                        radial-gradient(ellipse at 80% 85%, rgba(168,85,247,0.13) 0%, transparent 55%), #080810"
    aria-hidden="true"
></div>

<div class="relative z-10 flex flex-col h-dvh overflow-hidden">
    <!-- ─── Header ──────────────────────────────────────────────────────────── -->
    <header
        class="shrink-0 flex items-center gap-3 px-5 pt-safe pt-4 pb-3"
        style="background: rgba(5,5,15,0.65); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,0.06)"
    >
        {#if view === "detail"}
            <button
                onclick={goBack}
                class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                aria-label="Back to playlists"
            >
                <span class="material-symbols-rounded text-[22px]"
                    >arrow_back</span
                >
            </button>
            <div class="flex-1 min-w-0">
                <p
                    class="text-[10px] font-bold text-white/30 uppercase tracking-widest"
                >
                    {playlists.activePlaylist?.is_favorites
                        ? "♥ Favorites"
                        : "Playlist"}
                </p>
                <p class="text-lg font-bold text-white truncate">
                    {playlists.activePlaylist?.name}
                </p>
            </div>
            {#if playlists.activePlaylistTracks.length > 0}
                <button
                    onclick={() => playPlaylist(playlists.activePlaylistTracks)}
                    class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
                    style="background: var(--hap-primary, #6467f2); box-shadow: 0 0 16px -4px rgba(100,103,242,0.6)"
                >
                    <span class="material-symbols-rounded text-[18px]"
                        >play_arrow</span
                    >
                    Play all
                </button>
            {/if}
            {#if playlists.activePlaylist && !playlists.activePlaylist.is_favorites}
                <button
                    onclick={() =>
                        (deletingPlaylist = playlists.activePlaylist)}
                    class="w-9 h-9 flex items-center justify-center rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    aria-label="Delete playlist"
                >
                    <span class="material-symbols-rounded text-[20px]"
                        >delete</span
                    >
                </button>
            {/if}
        {:else}
            <div class="flex-1">
                <h1 class="text-xl font-bold text-white">Playlists</h1>
                <p class="text-xs text-white/30">
                    {playlists.allPlaylists.length} playlist{playlists
                        .allPlaylists.length !== 1
                        ? "s"
                        : ""}
                </p>
            </div>
            <button
                onclick={() => (showCreateModal = true)}
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
                style="background: var(--hap-primary, #6467f2); box-shadow: 0 0 14px -4px rgba(100,103,242,0.5)"
                aria-label="Create new playlist"
            >
                <span class="material-symbols-rounded text-[18px]">add</span>
                <span class="hidden sm:inline">New</span>
            </button>
        {/if}
    </header>

    <!-- ─── Content ─────────────────────────────────────────────────────────── -->
    <main class="flex-1 overflow-y-auto px-4 py-4 pb-32">
        {#if view === "list"}
            <!-- Playlists grid -->
            {#if playlists.allPlaylists.length === 0}
                <div
                    class="flex flex-col items-center justify-center gap-4 mt-20 text-center px-8"
                >
                    <div
                        class="w-20 h-20 rounded-[1.5rem] flex items-center justify-center"
                        style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2)"
                    >
                        <span
                            class="material-symbols-rounded text-4xl"
                            style="color: rgba(99,102,241,0.5)"
                            >queue_music</span
                        >
                    </div>
                    <p class="text-white/40 font-medium text-sm">
                        No playlists yet.<br />Create your first playlist!
                    </p>
                    <button
                        onclick={() => (showCreateModal = true)}
                        class="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                        style="background: var(--hap-primary,#6467f2)"
                    >
                        Create playlist
                    </button>
                </div>
            {:else}
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {#each playlists.allPlaylists as pl (pl.id)}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            class="relative rounded-2xl overflow-hidden cursor-pointer group transition-transform hover:scale-[1.02] active:scale-[0.98]"
                            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
                            onclick={() => openPlaylist(pl)}
                        >
                            <!-- Thumbnail/icon block -->
                            <div
                                class="aspect-square flex items-center justify-center"
                                style={pl.is_favorites
                                    ? "background: linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(236,72,153,0.20) 100%)"
                                    : "background: linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.15) 100%)"}
                            >
                                <span
                                    class="material-symbols-rounded text-5xl"
                                    style={pl.is_favorites
                                        ? "color: rgba(239,68,68,0.8)"
                                        : "color: rgba(99,102,241,0.7)"}
                                >
                                    {pl.is_favorites
                                        ? "favorite"
                                        : "queue_music"}
                                </span>
                            </div>

                            <!-- Info -->
                            <div class="p-3">
                                <p
                                    class="text-sm font-semibold text-white truncate"
                                >
                                    {pl.name}
                                </p>
                                <p class="text-xs text-white/40 mt-0.5">
                                    {pl.track_count ?? 0} track{(pl.track_count ??
                                        0) !== 1
                                        ? "s"
                                        : ""}
                                </p>
                            </div>

                            <!-- Actions overlay (non-favorites playlists only) -->
                            {#if !pl.is_favorites}
                                <div
                                    class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1"
                                >
                                    <button
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            startRename(pl);
                                        }}
                                        class="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white"
                                        style="background: rgba(5,5,15,0.7); backdrop-filter: blur(8px)"
                                        aria-label="Rename playlist"
                                    >
                                        <span
                                            class="material-symbols-rounded text-[14px]"
                                            >edit</span
                                        >
                                    </button>
                                    <button
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            deletingPlaylist = pl;
                                        }}
                                        class="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-red-400"
                                        style="background: rgba(5,5,15,0.7); backdrop-filter: blur(8px)"
                                        aria-label="Delete playlist"
                                    >
                                        <span
                                            class="material-symbols-rounded text-[14px]"
                                            >delete</span
                                        >
                                    </button>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        {:else}
            <!-- ─── Detail view: track list ───────────────────────────────── -->
            {#if playlists.isLoading}
                <div class="flex justify-center mt-16">
                    <div
                        class="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin"
                    ></div>
                </div>
            {:else if playlists.activePlaylistTracks.length === 0}
                <div
                    class="flex flex-col items-center justify-center gap-3 mt-20 text-center px-8"
                >
                    <span
                        class="material-symbols-rounded text-5xl text-white/20"
                    >
                        {playlists.activePlaylist?.is_favorites
                            ? "heart_broken"
                            : "music_off"}
                    </span>
                    <p class="text-white/40 text-sm">
                        {playlists.activePlaylist?.is_favorites
                            ? "No favorites yet. Tap ♥ on any track!"
                            : "This playlist is empty. Add tracks from the Library."}
                    </p>
                </div>
            {:else}
                <!-- Stats bar -->
                <div class="flex items-center gap-4 mb-4 px-1">
                    <span class="text-xs text-white/30">
                        {playlists.activePlaylistTracks.length} tracks
                    </span>
                    <span class="text-xs text-white/20">•</span>
                    <span class="text-xs text-white/30">
                        {totalDuration(playlists.activePlaylistTracks)}
                    </span>
                </div>

                <!-- Track rows -->
                <div class="flex flex-col gap-1">
                    {#each playlists.activePlaylistTracks as track, i (track.id)}
                        <div
                            class="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/05 cursor-pointer"
                            onclick={() =>
                                playTrack(
                                    track,
                                    playlists.activePlaylistTracks,
                                )}
                            role="button"
                            tabindex="0"
                            aria-label={`Play ${track.title ?? "Unknown track"}`}
                            onkeydown={(e) =>
                                e.key === "Enter" &&
                                playTrack(
                                    track,
                                    playlists.activePlaylistTracks,
                                )}
                        >
                            <!-- Index or playing indicator -->
                            <div class="w-6 shrink-0 text-center">
                                {#if player.currentTrack?.id === track.id && player.isPlaying}
                                    <span
                                        class="material-symbols-rounded text-[16px]"
                                        style="color: var(--hap-primary,#6467f2)"
                                        >volume_up</span
                                    >
                                {:else}
                                    <span
                                        class="text-[11px] text-white/25 tabular-nums"
                                        >{i + 1}</span
                                    >
                                {/if}
                            </div>

                            <!-- Info -->
                            <div class="flex-1 min-w-0">
                                <p
                                    class="text-sm font-medium text-white truncate
                                    {player.currentTrack?.id === track.id
                                        ? 'text-hap-primary'
                                        : ''}"
                                >
                                    {track.title ?? "Unknown Title"}
                                </p>
                                <p class="text-xs text-white/40 truncate">
                                    {track.artist ?? "Unknown Artist"}
                                    {#if track.album}
                                        · {track.album}{/if}
                                </p>
                            </div>

                            <!-- Duration -->
                            <span
                                class="text-xs font-mono text-white/30 tabular-nums shrink-0"
                            >
                                {formatTime(track.duration ?? 0)}
                            </span>

                            <!-- Favorite toggle -->
                            <button
                                onclick={(e) => {
                                    e.stopPropagation();
                                    playlists.toggleFavorite(track.id);
                                }}
                                class="w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0
                                    opacity-0 group-hover:opacity-100 {playlists.isFavorite(
                                    track.id,
                                )
                                    ? '!opacity-100'
                                    : ''}"
                                aria-label={playlists.isFavorite(track.id)
                                    ? "Remove from favorites"
                                    : "Add to favorites"}
                            >
                                <span
                                    class="material-symbols-rounded text-[18px] transition-colors"
                                    style={playlists.isFavorite(track.id)
                                        ? 'color: rgba(239,68,68,0.9); font-variation-settings: "FILL" 1'
                                        : "color: rgba(255,255,255,0.4)"}
                                    >favorite</span
                                >
                            </button>

                            <!-- Remove from playlist -->
                            <button
                                onclick={(e) => {
                                    e.stopPropagation();
                                    removeFromPlaylist(track);
                                }}
                                class="w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0
                                    opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400"
                                aria-label="Remove from playlist"
                            >
                                <span
                                    class="material-symbols-rounded text-[18px]"
                                    >remove_circle</span
                                >
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}
    </main>
</div>

<!-- ─── Create Playlist Modal ─────────────────────────────────────────────────── -->
{#if showCreateModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.7); backdrop-filter: blur(12px)"
        onclick={(e) => {
            if (e.target === e.currentTarget) showCreateModal = false;
        }}
    >
        <div
            class="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style="background: rgba(12,12,28,0.95); border: 1px solid rgba(255,255,255,0.1)"
        >
            <h2 class="text-lg font-bold text-white">New Playlist</h2>

            <div class="flex flex-col gap-3">
                <div>
                    <label
                        for="pl-name"
                        class="text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5 block"
                        >Name</label
                    >
                    <input
                        id="pl-name"
                        type="text"
                        bind:value={newPlaylistName}
                        placeholder="My playlist..."
                        class="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:ring-1"
                        style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); --tw-ring-color: var(--hap-primary,#6467f2)"
                        onkeydown={(e) => e.key === "Enter" && createPlaylist()}
                    />
                </div>
                <div>
                    <label
                        for="pl-desc"
                        class="text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5 block"
                        >Description <span class="text-white/20 normal-case"
                            >(optional)</span
                        ></label
                    >
                    <input
                        id="pl-desc"
                        type="text"
                        bind:value={newPlaylistDesc}
                        placeholder="A short description..."
                        class="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:ring-1"
                        style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); --tw-ring-color: var(--hap-primary,#6467f2)"
                    />
                </div>
            </div>

            <div class="flex gap-2 mt-1">
                <button
                    onclick={() => (showCreateModal = false)}
                    class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white hover:bg-white/08 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onclick={createPlaylist}
                    disabled={!newPlaylistName.trim() || isCreating}
                    class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                    style="background: var(--hap-primary,#6467f2)"
                >
                    {isCreating ? "Creating…" : "Create"}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ─── Rename Modal ───────────────────────────────────────────────────────────── -->
{#if renamingPlaylist}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.7); backdrop-filter: blur(12px)"
        onclick={(e) => {
            if (e.target === e.currentTarget) renamingPlaylist = null;
        }}
    >
        <div
            class="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style="background: rgba(12,12,28,0.95); border: 1px solid rgba(255,255,255,0.1)"
        >
            <h2 class="text-lg font-bold text-white">Rename Playlist</h2>
            <input
                type="text"
                bind:value={renameValue}
                class="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none focus:ring-1"
                style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10)"
                onkeydown={(e) => e.key === "Enter" && confirmRename()}
            />
            <div class="flex gap-2">
                <button
                    onclick={() => (renamingPlaylist = null)}
                    class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white hover:bg-white/08 transition-colors"
                    >Cancel</button
                >
                <button
                    onclick={confirmRename}
                    disabled={!renameValue.trim()}
                    class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style="background: var(--hap-primary,#6467f2)">Save</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- ─── Delete Confirm Modal ──────────────────────────────────────────────────── -->
{#if deletingPlaylist}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.7); backdrop-filter: blur(12px)"
        onclick={(e) => {
            if (e.target === e.currentTarget) deletingPlaylist = null;
        }}
    >
        <div
            class="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style="background: rgba(12,12,28,0.95); border: 1px solid rgba(255,255,255,0.1)"
        >
            <h2 class="text-lg font-bold text-white">
                Delete "{deletingPlaylist.name}"?
            </h2>
            <p class="text-sm text-white/50">
                This will permanently delete the playlist. Tracks won't be
                deleted.
            </p>
            <div class="flex gap-2">
                <button
                    onclick={() => (deletingPlaylist = null)}
                    class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white hover:bg-white/08 transition-colors"
                    >Cancel</button
                >
                <button
                    onclick={confirmDelete}
                    class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style="background: rgba(239,68,68,0.8)">Delete</button
                >
            </div>
        </div>
    </div>
{/if}

<style>
    .pt-safe {
        padding-top: max(1rem, env(safe-area-inset-top));
    }
    .hover\:bg-white\/05:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }
    .hover\:bg-white\/08:hover {
        background-color: rgba(255, 255, 255, 0.08);
    }
    .text-hap-primary {
        color: var(--hap-primary, #6467f2);
    }
    .animate-spin {
        animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
