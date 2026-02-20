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
    } | null>(null);
    let tracks = $state<Track[]>([]);
    let loading = $state(true);

    $effect(() => {
        const id = playlistId;
        if (db.isReady && id) loadPlaylist(id);
    });

    async function loadPlaylist(id: number): Promise<void> {
        loading = true;
        try {
            const all = await db.getPlaylists();
            playlist = all.find((p: { id: number }) => p.id === id) ?? null;
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
        class="absolute top-[20%] right-[-20%] w-[80%] h-[60%] rounded-full blur-[100px] opacity-20"
        style="background: radial-gradient(ellipse at center, rgba(56,189,248,0.2) 0%, transparent 70%)"
    ></div>
    <div
        class="absolute bottom-0 left-0 right-0 h-1/2"
        style="background: linear-gradient(to top, #0a0a12 0%, transparent 100%)"
    ></div>
</div>

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
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px)"
            aria-label="Go back"
        >
            <span class="material-symbols-rounded text-[22px]">arrow_back</span>
        </button>
        <div
            class="text-sm font-semibold tracking-widest uppercase text-white/50"
        >
            Playlist
        </div>
        <button
            class="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px)"
            aria-label="More options"
        >
            <span class="material-symbols-rounded text-[22px]">more_horiz</span>
        </button>
    </header>

    <!-- ─── Scrollable Content ─── -->
    <main
        class="flex-1 overflow-y-auto pb-32 px-4 space-y-6"
        style="scrollbar-width: none; -ms-overflow-style: none"
    >
        <!-- ─── Playlist Hero ─── -->
        <div class="flex flex-col items-center pt-2">
            <!-- Artwork with glow -->
            <div class="relative w-48 h-48 mb-6 group">
                <div
                    class="absolute inset-0 rounded-full blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-700"
                    style="background: var(--hap-primary-glow, rgba(99,102,241,0.4))"
                ></div>
                <div
                    class="relative w-full h-full rounded-[2rem] overflow-hidden flex items-center justify-center"
                    style="border: 1px solid rgba(255,255,255,0.1); background: radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(10,10,18,0.9) 100%)"
                >
                    <span
                        class="material-symbols-rounded text-[80px]"
                        style="color: var(--hap-primary, #6467f2); opacity: 0.6"
                        >queue_music</span
                    >
                    <!-- Shine overlay -->
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
                    style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px)"
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
        <div class="space-y-2 pt-2">
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
                {#each tracks as track, i}
                    {@const isCurrent = player.currentTrack?.id === track.id}
                    <div
                        role="button"
                        tabindex="0"
                        class="group relative w-full flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer text-left"
                        style={isCurrent
                            ? `background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); box-shadow: 0 0 15px -5px var(--hap-primary-glow, rgba(99,102,241,0.3))`
                            : `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(12px)`}
                        onclick={() => player.playFromList(tracks, i)}
                        onkeydown={(e) =>
                            e.key === "Enter" && player.playFromList(tracks, i)}
                        aria-label="Play {track.title}"
                    >
                        <!-- Artwork/index -->
                        <div
                            class="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative"
                            style="background: rgba(255,255,255,0.05)"
                        >
                            <div
                                class="w-full h-full flex items-center justify-center"
                            >
                                {#if isCurrent}
                                    <span
                                        class="material-symbols-rounded animate-pulse"
                                        style="color: var(--hap-primary, #6467f2); font-size: 24px"
                                        >equalizer</span
                                    >
                                {:else}
                                    <span
                                        class="text-xs font-mono text-white/20 group-hover:hidden"
                                        >{i + 1}</span
                                    >
                                    <span
                                        class="material-symbols-rounded text-white/40 hidden group-hover:block text-[20px]"
                                        >play_arrow</span
                                    >
                                {/if}
                            </div>
                        </div>
                        <!-- Track info -->
                        <div
                            class="flex-1 min-w-0 flex flex-col justify-center"
                        >
                            <h3
                                class="font-semibold truncate text-base leading-tight transition-colors {isCurrent
                                    ? ''
                                    : 'text-white group-hover:text-white'}"
                                style={isCurrent
                                    ? "color: var(--hap-primary, #6467f2); font-weight: 700"
                                    : ""}
                            >
                                {track.title ?? "Unknown Track"}
                            </h3>
                            <p
                                class="text-xs truncate mt-0.5 {isCurrent
                                    ? ''
                                    : 'text-white/40'}"
                                style={isCurrent
                                    ? "color: rgba(99,102,241,0.6)"
                                    : ""}
                            >
                                {track.artist ?? "Unknown Artist"}
                            </p>
                        </div>
                        <!-- Duration -->
                        <div
                            class="text-xs font-mono tabular-nums {isCurrent
                                ? ''
                                : 'text-white/30'}"
                            style={isCurrent
                                ? "color: var(--hap-primary, #6467f2); font-weight: bold"
                                : ""}
                        >
                            {formatTime(track.duration)}
                        </div>
                        <!-- More button -->
                        <button
                            class="text-white/30 hover:text-white transition-colors"
                            onclick={(e) => e.stopPropagation()}
                            aria-label="More options for {track.title}"
                        >
                            <span class="material-symbols-rounded text-[18px]"
                                >more_vert</span
                            >
                        </button>
                    </div>
                {/each}
            {/if}
        </div>
    </main>
</div>
