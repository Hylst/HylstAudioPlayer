<script lang="ts">
    import { db } from "$lib/db/database.svelte";
    import { player } from "$lib/audio/player.svelte";
    import { formatTime } from "$lib/utils/format";
    import type { Track } from "$lib/types";

    let stats = $state({ count: 0, totalDuration: 0 });
    let albums = $state<
        { album: string; artist: string; track_count: number }[]
    >([]);
    let artists = $state<{ artist: string; track_count: number }[]>([]);
    let recentTracks = $state<Track[]>([]);

    $effect(() => {
        if (db.isReady) loadStats();
    });

    async function loadStats(): Promise<void> {
        try {
            [stats, albums, artists] = await Promise.all([
                db.getLibraryStats(),
                db.getAlbums(),
                db.getArtists(),
            ]);
            // Recent tracks: fetch all and take last 3
            const all = await db.getTracks();
            recentTracks = all.slice(-3).reverse();
        } catch (e) {
            console.error("[Profile] Failed to load stats:", e);
        }
    }

    let totalHours = $derived(Math.floor(stats.totalDuration / 3600));
    let topArtistName = $derived(artists[0]?.artist ?? "—");
    let playlistCount = $derived(albums.length); // Albums count used as proxy — connect to playlists store when available
</script>

<!-- Ambient glows -->
<div
    class="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    aria-hidden="true"
>
    <div
        class="absolute top-[-20%] left-[-20%] w-[80%] h-[60%] rounded-full blur-[120px] opacity-20"
        style="background: var(--hap-primary, #6467f2)"
    ></div>
    <div
        class="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] rounded-full blur-[100px] opacity-10"
        style="background: #3b82f6"
    ></div>
</div>

<div class="relative z-10 flex flex-col min-h-full">
    <!-- ─── Header ─── -->
    <header
        class="flex items-center justify-between px-5 pt-12 pb-4 sticky top-0 z-20"
        style="background: rgba(10,10,18,0.6); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05)"
    >
        <button
            onclick={() => history.back()}
            class="text-white/70 hover:text-white transition-colors p-2 -ml-2 rounded-full hover:bg-white/5"
            aria-label="Go back"
        >
            <span class="material-symbols-rounded text-[24px]">arrow_back</span>
        </button>
        <h1
            class="text-sm font-semibold tracking-widest uppercase text-white/60"
        >
            Profile
        </h1>
        <a
            href="/settings"
            class="text-white/70 hover:text-white transition-colors p-2 -mr-2 rounded-full hover:bg-white/5"
            aria-label="Settings"
        >
            <span class="material-symbols-rounded text-[24px]">settings</span>
        </a>
    </header>

    <main class="flex-1 overflow-y-auto pb-8">
        <!-- ─── Profile Hero ─── -->
        <section class="flex flex-col items-center pt-8 pb-8 px-6">
            <!-- Avatar with aura -->
            <div class="relative w-32 h-32 mb-6 group cursor-pointer">
                <!-- Aura glow -->
                <div
                    class="absolute inset-0 rounded-full blur-xl opacity-40 group-hover:opacity-70 transition-all duration-500"
                    style="background: radial-gradient(circle, var(--hap-primary, #6467f2) 0%, transparent 70%); transform: scale(1.2)"
                ></div>
                <!-- Ring border -->
                <div
                    class="absolute -inset-[3px] rounded-full opacity-30"
                    style="border: 1px solid var(--hap-primary, #6467f2)"
                ></div>
                <!-- Avatar icon -->
                <div
                    class="relative w-full h-full rounded-full flex items-center justify-center z-10"
                    style="background: radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(10,10,18,0.8) 100%); border: 2px solid rgba(255,255,255,0.1)"
                >
                    <span
                        class="material-symbols-rounded text-[52px]"
                        style="color: var(--hap-primary, #6467f2)">person</span
                    >
                </div>
                <!-- Online dot -->
                <div
                    class="absolute bottom-1 right-1 z-20 bg-black rounded-full p-0.5 border border-white/20"
                >
                    <div
                        class="w-3 h-3 bg-green-400 rounded-full animate-pulse"
                        style="box-shadow: 0 0 8px rgba(74,222,128,0.6)"
                    ></div>
                </div>
            </div>

            <!-- Name -->
            <div class="text-center space-y-1 mb-6">
                <h2 class="text-3xl font-bold text-white tracking-tight">
                    My Library
                </h2>
                <p
                    class="text-sm font-medium"
                    style="color: var(--hap-primary, #6467f2); opacity: 0.8"
                >
                    Hylst Audio Player
                </p>
            </div>

            <!-- Edit button -->
            <a
                href="/settings"
                class="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white hover:bg-white/10 transition-all group"
                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px)"
            >
                <span>Settings</span>
                <span
                    class="material-symbols-rounded text-[16px] group-hover:translate-x-1 transition-transform"
                    >arrow_forward</span
                >
            </a>
        </section>

        <!-- ─── Stats Bar ─── -->
        <section class="px-4 mb-8">
            <div
                class="rounded-2xl p-6 flex justify-between items-center relative overflow-hidden"
                style="background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(40px)"
            >
                <!-- Top accent line -->
                <div
                    class="absolute top-0 left-0 w-full h-[1px]"
                    style="background: linear-gradient(to right, transparent, var(--hap-primary, #6467f2), transparent); opacity: 0.4"
                ></div>

                <div
                    class="flex flex-col items-center gap-1 flex-1 border-r border-white/5"
                >
                    <span
                        class="text-xs text-white/50 uppercase tracking-wider font-medium"
                        >Hours</span
                    >
                    <span
                        class="text-2xl font-bold text-white tabular-nums tracking-tight"
                        >{totalHours > 0
                            ? totalHours.toLocaleString()
                            : stats.count}</span
                    >
                    <span class="text-[10px] text-white/30"
                        >{totalHours > 0 ? "listened" : "tracks"}</span
                    >
                </div>
                <div
                    class="flex flex-col items-center gap-1 flex-1 border-r border-white/5 px-2"
                >
                    <span
                        class="text-xs text-white/50 uppercase tracking-wider font-medium"
                        >Top Artist</span
                    >
                    <span
                        class="text-sm font-bold truncate max-w-full text-center"
                        style="color: var(--hap-primary, #6467f2)"
                        >{topArtistName}</span
                    >
                </div>
                <div class="flex flex-col items-center gap-1 flex-1">
                    <span
                        class="text-xs text-white/50 uppercase tracking-wider font-medium"
                        >Albums</span
                    >
                    <span
                        class="text-2xl font-bold text-white tabular-nums tracking-tight"
                        >{albums.length}</span
                    >
                </div>
            </div>
        </section>

        <!-- ─── Top Artists Scroller ─── -->
        {#if artists.length > 0}
            <section class="mb-8">
                <div class="flex justify-between items-end px-5 mb-4">
                    <h3 class="text-lg font-bold text-white">Top Artists</h3>
                    <span class="text-xs text-white/30"
                        >{artists.length} in library</span
                    >
                </div>
                <div
                    class="flex overflow-x-auto gap-4 px-5 pb-4"
                    style="scrollbar-width: none; -ms-overflow-style: none"
                >
                    {#each artists.slice(0, 8) as artist}
                        <div
                            class="flex flex-col items-center gap-2 min-w-[72px]"
                        >
                            <div class="w-16 h-16 rounded-full relative group">
                                <div
                                    class="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-md"
                                    style="background: var(--hap-primary, #6467f2); opacity: 0.2"
                                ></div>
                                <div
                                    class="relative w-full h-full rounded-full flex items-center justify-center"
                                    style="background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.1)"
                                >
                                    <span
                                        class="material-symbols-rounded text-[28px] text-white/30"
                                        >person</span
                                    >
                                </div>
                            </div>
                            <span
                                class="text-xs font-medium text-white/70 text-center truncate w-full"
                                >{artist.artist}</span
                            >
                        </div>
                    {/each}
                </div>
            </section>
        {/if}

        <!-- ─── Listening Activity Timeline ─── -->
        {#if recentTracks.length > 0}
            <section class="px-5 mb-8">
                <h3 class="text-lg font-bold text-white mb-4">
                    Recent Activity
                </h3>
                <div class="space-y-3 relative">
                    <!-- Timeline vertical line -->
                    <div
                        class="absolute left-[23px] top-4 bottom-4 w-[2px] rounded-full"
                        style="background: linear-gradient(to bottom, var(--hap-primary, #6467f2), transparent); opacity: 0.4"
                    ></div>

                    {#each recentTracks as track, i}
                        <div class="relative z-10 pl-14 group">
                            <!-- Timeline dot -->
                            <div
                                class="absolute left-0 top-1/2 -translate-y-1/2 w-[46px] h-[46px] flex items-center justify-center"
                            >
                                <div
                                    class="rounded-full transition-colors {i ===
                                    0
                                        ? 'w-3 h-3'
                                        : 'w-2 h-2 bg-white/20 group-hover:bg-white/40'}"
                                    style={i === 0
                                        ? `background: var(--hap-primary, #6467f2); box-shadow: 0 0 12px var(--hap-primary, #6467f2)0.8); border: 1px solid rgba(255,255,255,0.2)`
                                        : ""}
                                ></div>
                            </div>
                            <!-- Track card -->
                            <button
                                class="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer text-left {i ===
                                0
                                    ? 'border-l-2'
                                    : 'border-l-2 border-l-transparent'}"
                                style={i === 0
                                    ? `background: rgba(99,102,241,0.08); border-left-color: var(--hap-primary, #6467f2); box-shadow: 0 0 15px -5px var(--hap-primary-glow, rgba(99,102,241,0.3))`
                                    : `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05)`}
                                onclick={() =>
                                    player.playFromList(recentTracks, i)}
                                aria-label="Play {track.title}"
                            >
                                <div
                                    class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative"
                                    style="background: rgba(255,255,255,0.05)"
                                >
                                    <span
                                        class="material-symbols-rounded text-[22px] text-white/20"
                                        >music_note</span
                                    >
                                    {#if i === 0}
                                        <div
                                            class="absolute inset-0 flex items-center justify-center"
                                            style="background: rgba(0,0,0,0.4); backdrop-filter: blur(2px)"
                                        >
                                            <span
                                                class="material-symbols-rounded text-sm"
                                                style="color: var(--hap-primary, #6467f2)"
                                                >equalizer</span
                                            >
                                        </div>
                                    {/if}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4
                                        class="text-white font-medium truncate text-sm {i ===
                                        0
                                            ? ''
                                            : 'text-white/80'}"
                                    >
                                        {track.title ?? "Unknown"}
                                    </h4>
                                    <p class="text-white/40 text-xs truncate">
                                        {track.artist ?? "Unknown Artist"}
                                    </p>
                                </div>
                                {#if i === 0}
                                    <span
                                        class="text-xs font-medium px-2 py-1 rounded-full border"
                                        style="color: var(--hap-primary, #6467f2); background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.2)"
                                        >Recent</span
                                    >
                                {/if}
                            </button>
                        </div>
                    {/each}
                </div>
            </section>
        {/if}

        <!-- ─── PWA install hint ─── -->
        <div
            class="mx-5 rounded-2xl p-5 flex items-start gap-4"
            style="background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(20px)"
        >
            <span
                class="material-symbols-rounded shrink-0 mt-0.5"
                style="color: var(--hap-primary, #6467f2)">install_mobile</span
            >
            <div>
                <div class="text-sm font-semibold text-white">
                    Install as App
                </div>
                <div class="text-xs text-white/40 mt-0.5">
                    Add Hylst to your home screen for a native-like experience.
                </div>
            </div>
        </div>
    </main>
</div>
