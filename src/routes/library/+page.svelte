<script lang="ts">
    import { db } from "$lib/db/database.svelte";
    import { player } from "$lib/audio/player.svelte";
    import { playlists } from "$lib/audio/playlists.svelte";
    import { fsManager } from "$lib/fs/fileSystemManager.svelte";
    import TrackContextMenu from "../../components/player/TrackContextMenu.svelte";
    import type { Track } from "$lib/types";

    let tracks = $state<Track[]>([]);
    let stats = $state({ count: 0, totalDuration: 0 });
    let loading = $state(true);
    let sortBy = $state("date_added");
    let sortOrder = $state("DESC");
    let favoriteTracks = $derived(
        tracks.filter((t) => playlists.favoriteIds.has(t.id)),
    );

    // Context Menu State
    let showMenu = $state(false);
    let menuX = $state(0);
    let menuY = $state(0);
    let selectedTrack = $state<Track | null>(null);

    $effect(() => {
        const _ = db.lastUpdate;
        if (db.isReady) loadLibrary();
    });

    async function loadLibrary() {
        loading = true;
        try {
            tracks = await db.getTracksDetailed(sortBy, sortOrder);
            stats = await db.getLibraryStats();
        } catch (e) {
            console.error("[Library] Failed to load:", e);
        } finally {
            loading = false;
        }
    }

    function formatDuration(seconds: number) {
        if (!seconds) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0)
            return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    function formatLibraryTime(seconds: number) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    const sortOptions = [
        { label: "Date Added", value: "date_added" },
        { label: "Title", value: "title" },
        { label: "Artist", value: "artist" },
        { label: "Album", value: "album" },
        { label: "Duration", value: "duration" },
    ];

    function toggleSort(val: string) {
        if (sortBy === val) {
            sortOrder = sortOrder === "ASC" ? "DESC" : "ASC";
        } else {
            sortBy = val;
            sortOrder = "ASC";
        }
        loadLibrary();
    }

    function openMenu(e: MouseEvent, track: Track) {
        e.stopPropagation();
        selectedTrack = track;
        menuX = e.clientX;
        menuY = e.clientY;
        showMenu = true;
    }
</script>

<!-- Ambient Background -->
<div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
    <div
        class="absolute top-[-20%] right-[-10%] w-[70%] h-[50%] rounded-full bg-indigo-600/10 blur-[150px]"
    ></div>
</div>

<div class="relative flex flex-col w-full min-h-full z-10">
    <!-- ─── Header ─── -->
    <header class="p-6 pb-4">
        <div class="flex items-end justify-between mb-8">
            <div>
                <h1 class="text-4xl font-bold text-white tracking-tight mb-2">
                    Library
                </h1>
                <div
                    class="flex items-center gap-4 text-sm text-white/40 uppercase tracking-widest font-medium"
                >
                    <span class="flex items-center gap-1.5"
                        ><span class="material-symbols-rounded text-base"
                            >music_note</span
                        >
                        {stats.count} tracks</span
                    >
                    <span class="flex items-center gap-1.5"
                        ><span class="material-symbols-rounded text-base"
                            >schedule</span
                        >
                        {formatLibraryTime(stats.totalDuration)}</span
                    >
                </div>
            </div>

            <div class="flex gap-2">
                <button
                    class="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
                >
                    <span class="material-symbols-rounded">filter_list</span>
                </button>
                <button
                    onclick={() => {
                        player.shuffleEnabled = true;
                        player.playFromList(tracks, 0);
                    }}
                    class="px-5 h-10 rounded-full flex items-center gap-2 bg-hap-primary text-white font-semibold text-sm shadow-lg shadow-hap-primary/20"
                    aria-label="Shuffle all tracks"
                >
                    <span class="material-symbols-rounded text-[20px]"
                        >shuffle</span
                    >
                    Shuffle All
                </button>
            </div>
        </div>

        <!-- Sort Bar -->
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            <span
                class="text-xs font-bold text-white/30 uppercase tracking-wider mr-2"
                >Sort by</span
            >
            {#each sortOptions as opt}
                <button
                    class="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
            {sortBy === opt.value
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10'}"
                    onclick={() => toggleSort(opt.value)}
                >
                    {opt.label}
                    {#if sortBy === opt.value}
                        <span
                            class="material-symbols-rounded text-[14px] ml-1 align-middle"
                        >
                            {sortOrder === "ASC"
                                ? "expand_less"
                                : "expand_more"}
                        </span>
                    {/if}
                </button>
            {/each}
        </div>
    </header>

    <!-- ─── Content ─── -->
    <main class="flex-1 px-4 pb-32">
        {#if loading}
            <div class="flex flex-col items-center justify-center py-32 gap-4">
                <div
                    class="w-12 h-12 rounded-full border-2 border-white/5 border-t-hap-primary animate-spin"
                ></div>
                <p class="text-xs text-white/30 uppercase tracking-widest">
                    Loading Library…
                </p>
            </div>
        {:else if tracks.length === 0}
            <div
                class="flex flex-col items-center justify-center py-24 gap-6 text-center"
            >
                <div
                    class="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center mb-2"
                >
                    <span
                        class="material-symbols-rounded text-5xl text-white/20"
                        >library_music</span
                    >
                </div>
                <h2 class="text-xl font-bold text-white">No tracks found</h2>
                <p class="text-white/40 max-w-xs mx-auto leading-relaxed">
                    Your library is empty. Add a folder in Settings to start
                    listening.
                </p>
                <button
                    onclick={() => fsManager.addFolder()}
                    class="mt-4 px-8 py-3 rounded-full bg-white text-black font-bold transition-transform hover:scale-105"
                >
                    Add Folder
                </button>
            </div>
        {:else}
            <!-- ─── Favorites Section ─── -->
            {#if favoriteTracks.length > 0}
                <section class="mb-6">
                    <div class="flex items-center justify-between mb-3">
                        <h2
                            class="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2"
                        >
                            <span
                                class="material-symbols-rounded text-[18px] text-rose-400"
                                style="font-variation-settings: 'FILL' 1"
                                >favorite</span
                            >
                            Favorites
                        </h2>
                        {#if playlists.favoritesPlaylist}
                            <a
                                href="/playlists/{playlists.favoritesPlaylist
                                    .id}"
                                class="text-xs text-white/30 hover:text-white/60 transition-colors"
                                >See all</a
                            >
                        {/if}
                    </div>
                    <div class="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {#each favoriteTracks as track}
                            {@const isCurrent =
                                player.currentTrack?.id === track.id}
                            <button
                                onclick={() => player.play(track)}
                                class="flex-shrink-0 w-36 flex flex-col gap-1.5 p-2.5 rounded-xl text-left transition-all hover:bg-white/5 active:scale-[0.97]"
                                style={isCurrent
                                    ? "background:rgba(99,102,241,0.15)"
                                    : ""}
                            >
                                <div
                                    class="w-full aspect-square rounded-lg bg-white/5 flex items-center justify-center mb-1"
                                >
                                    <span
                                        class="material-symbols-rounded text-3xl"
                                        style="color: {isCurrent
                                            ? 'var(--hap-primary,#6467f2)'
                                            : 'rgba(255,255,255,0.15)'}"
                                    >
                                        {isCurrent ? "equalizer" : "music_note"}
                                    </span>
                                </div>
                                <p
                                    class="text-xs font-semibold text-white/85 truncate"
                                >
                                    {track.title ?? "Unknown"}
                                </p>
                                <p class="text-[10px] text-white/40 truncate">
                                    {track.artist ?? ""}
                                </p>
                            </button>
                        {/each}
                    </div>
                </section>
            {/if}

            <!-- Track Table -->
            <div class="w-full">
                <!-- Table Header (Hidden on small mobile) -->
                <div
                    class="hidden md:grid grid-cols-[1fr_200px_200px_80px_40px] gap-4 px-4 py-3 text-[11px] font-bold text-white/30 uppercase tracking-wider border-b border-white/5"
                >
                    <div>Title</div>
                    <div>Artist</div>
                    <div>Album</div>
                    <div class="text-right">Time</div>
                    <div></div>
                </div>

                <!-- Tracks -->
                <div class="mt-2 space-y-1">
                    {#each tracks as track, i}
                        {@const isCurrent =
                            player.currentTrack?.id === track.id}
                        <div
                            class="group grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_200px_80px_40px] items-center gap-4 px-4 py-2.5 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer"
                            role="button"
                            tabindex="0"
                            onclick={() => player.playFromList(tracks, i)}
                            onkeydown={(e) =>
                                e.key === "Enter" &&
                                player.playFromList(tracks, i)}
                        >
                            <!-- Title Column -->
                            <div class="flex items-center gap-4 min-w-0">
                                <div
                                    class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 overflow-hidden relative border border-white/5"
                                >
                                    <!-- Simplified art placeholder -->
                                    <span
                                        class="material-symbols-rounded text-white/10 group-hover:text-hap-primary transition-colors"
                                    >
                                        {isCurrent
                                            ? "pause_circle"
                                            : "music_note"}
                                    </span>
                                </div>
                                <div class="min-w-0">
                                    <div
                                        class="font-semibold text-sm text-white truncate {isCurrent
                                            ? 'text-hap-primary'
                                            : ''}"
                                    >
                                        {track.title ||
                                            track.file_path.split("/").pop() ||
                                            "Unknown Title"}
                                    </div>
                                    <div
                                        class="md:hidden text-xs text-white/40 truncate mt-0.5"
                                    >
                                        {track.artist || "Unknown Artist"} • {track.album ||
                                            "Unknown Album"}
                                    </div>
                                </div>
                            </div>

                            <!-- Artist (desktop) -->
                            <div
                                class="hidden md:block text-sm text-white/50 truncate"
                            >
                                {track.artist || "Unknown Artist"}
                            </div>

                            <!-- Album (desktop) -->
                            <div
                                class="hidden md:block text-sm text-white/50 truncate"
                            >
                                {track.album || "Unknown Album"}
                            </div>

                            <!-- Duration -->
                            <div
                                class="hidden md:block text-sm text-white/30 text-right tabular-nums"
                            >
                                {formatDuration(track.duration)}
                            </div>

                            <!-- Actions -->
                            <div class="flex justify-end">
                                <button
                                    class="w-8 h-8 rounded-full flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                                    onclick={(e) => openMenu(e, track)}
                                >
                                    <span
                                        class="material-symbols-rounded text-[20px]"
                                        >more_vert</span
                                    >
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </main>
</div>

<!-- ─── Context Menu (rendered at root so it can escape overflow clipping) ─── -->
{#if selectedTrack}
    <TrackContextMenu
        track={selectedTrack}
        bind:show={showMenu}
        x={menuX}
        y={menuY}
        trackDetailHref="/track/{selectedTrack.id}"
        trackEditHref="/track/{selectedTrack.id}/edit"
    />
{/if}
