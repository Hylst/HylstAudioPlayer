<script lang="ts">
    import { db } from "$lib/db/database.svelte";
    import { player } from "$lib/audio/player.svelte";
    import type { Track } from "$lib/types";
    import { formatTime } from "$lib/utils/format";

    let query = $state("");
    let results = $state<Track[]>([]);
    let isSearching = $state(false);

    const recentSearches = ["Hans Zimmer", "Lo-Fi Beats", "Techno", "Jazz"];

    const moods = [
        {
            label: "Deep Focus",
            icon: "self_improvement",
            gradient: "from-indigo-500/30 to-purple-600/30",
        },
        {
            label: "High Energy",
            icon: "bolt",
            gradient: "from-orange-500/30 to-red-600/30",
        },
        {
            label: "Nature",
            icon: "nature",
            gradient: "from-emerald-500/30 to-teal-600/30",
        },
        {
            label: "Romance",
            icon: "favorite",
            gradient: "from-pink-500/30 to-rose-600/30",
        },
        {
            label: "Sleep",
            icon: "bedtime",
            gradient: "from-blue-500/30 to-cyan-600/30",
        },
        {
            label: "Summer",
            icon: "wb_sunny",
            gradient: "from-yellow-500/30 to-amber-600/30",
        },
    ];

    let debounceTimer: ReturnType<typeof setTimeout>;
    $effect(() => {
        const q = query;
        clearTimeout(debounceTimer);
        if (!q.trim()) {
            results = [];
            return;
        }
        isSearching = true;
        debounceTimer = setTimeout(async () => {
            try {
                const all = await db.getTracks();
                const lower = q.toLowerCase();
                results = all.filter(
                    (t) =>
                        t.title?.toLowerCase().includes(lower) ||
                        t.artist?.toLowerCase().includes(lower) ||
                        t.album?.toLowerCase().includes(lower),
                );
            } finally {
                isSearching = false;
            }
        }, 300);
    });

    function selectChip(chip: string): void {
        query = chip;
    }
</script>

<!-- Ambient background -->
<div class="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
    <div
        class="absolute top-0 left-0 w-full h-full"
        style="background: radial-gradient(circle at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(circle at 80% 30%, rgba(100,50,200,0.08) 0%, transparent 50%)"
    ></div>
</div>

<div class="relative z-10 flex flex-col min-h-full">
    <!-- ─── Sticky glass header with search input ─── -->
    <div
        class="sticky top-0 z-40 px-5 pt-8 pb-4 backdrop-blur-2xl"
        style="background: rgba(10,10,18,0.7); border-bottom: 1px solid rgba(255,255,255,0.05)"
    >
        <!-- Search input -->
        <div
            class="flex w-full h-14 items-center rounded-2xl px-4 overflow-hidden transition-all"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2)"
        >
            <span
                class="material-symbols-rounded text-white/50 text-[24px] mr-3 flex-shrink-0"
                >search</span
            >
            <input
                id="search-input"
                type="search"
                bind:value={query}
                placeholder="Tracks, artists, albums..."
                class="flex-1 bg-transparent border-none text-white placeholder:text-white/30 focus:outline-none focus:ring-0 text-base h-full py-0 px-0"
                style="caret-color: var(--hap-primary, #6467f2)"
            />
            {#if query}
                <button
                    onclick={() => (query = "")}
                    class="text-white/40 hover:text-white transition-colors ml-2"
                    aria-label="Clear search"
                >
                    <span class="material-symbols-rounded text-[20px]"
                        >close</span
                    >
                </button>
            {/if}
        </div>

        <!-- Recent search chips -->
        {#if !query}
            <div
                class="flex gap-2 mt-4 overflow-x-auto pb-1"
                style="scrollbar-width: none; -ms-overflow-style: none"
            >
                {#each recentSearches as chip}
                    <button
                        onclick={() => selectChip(chip)}
                        class="flex h-9 shrink-0 items-center gap-2 rounded-full px-4 transition-all hover:bg-white/10 active:bg-white/20 text-sm font-medium text-white/80"
                        style="border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05)"
                    >
                        <span
                            class="material-symbols-rounded text-white/50"
                            style="font-size: 15px">history</span
                        >
                        {chip}
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    <!-- ─── Main Content ─── -->
    <div class="flex-1 px-5 pb-8 mt-6">
        {#if isSearching}
            <div class="flex flex-col gap-3">
                {#each { length: 4 } as _}
                    <div
                        class="h-14 rounded-2xl bg-white/5 animate-pulse"
                    ></div>
                {/each}
            </div>
        {:else if results.length > 0}
            <!-- Results -->
            <p
                class="text-xs text-white/30 mb-4 uppercase font-bold tracking-widest px-1"
            >
                {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            <div class="flex flex-col gap-1">
                {#each results as track, i}
                    {@const isCurrent = player.currentTrack?.id === track.id}
                    <button
                        class="group flex items-center gap-4 p-3 rounded-xl transition-all hover:bg-white/5 text-left cursor-pointer {isCurrent
                            ? 'border-l-2'
                            : 'border-l-2 border-l-transparent'}"
                        style={isCurrent
                            ? `background: rgba(99,102,241,0.1); border-left-color: var(--hap-primary, #6467f2)`
                            : ""}
                        onclick={() => player.playFromList(results, i)}
                    >
                        <div
                            class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                            style={isCurrent
                                ? "background: var(--hap-primary, #6467f2)"
                                : "background: rgba(255,255,255,0.05)"}
                        >
                            <span
                                class="material-symbols-rounded text-[20px] {isCurrent
                                    ? 'text-white'
                                    : 'text-white/30'}"
                            >
                                {isCurrent && player.isPlaying
                                    ? "pause"
                                    : "music_note"}
                            </span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div
                                class="font-semibold text-sm truncate {isCurrent
                                    ? ''
                                    : 'text-white'}"
                                style={isCurrent
                                    ? "color: var(--hap-primary, #6467f2)"
                                    : ""}
                            >
                                {track.title}
                            </div>
                            <div class="text-xs text-white/40 truncate mt-0.5">
                                {track.artist ?? "Unknown Artist"}
                                {#if track.album}· {track.album}{/if}
                            </div>
                        </div>
                        <span class="text-xs text-white/30 shrink-0 font-mono"
                            >{formatTime(track.duration)}</span
                        >
                    </button>
                {/each}
            </div>
        {:else if query.trim()}
            <div class="flex flex-col items-center py-20 gap-4 text-center">
                <span class="material-symbols-rounded text-5xl text-white/10"
                    >search_off</span
                >
                <p class="text-white/40 text-sm">
                    No results for "<span class="text-white/60">{query}</span>"
                </p>
            </div>
        {:else}
            <!-- Explore Vibes grid -->
            <div class="mb-8">
                <h2 class="text-2xl font-bold text-white mb-5">
                    Explore Vibes
                </h2>
                <div class="grid grid-cols-2 gap-3">
                    {#each moods as mood}
                        <button
                            class="group relative h-28 rounded-2xl overflow-hidden text-left cursor-pointer"
                            style="background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px)"
                            onclick={() => selectChip(mood.label)}
                            aria-label="Explore {mood.label}"
                        >
                            <div
                                class="absolute inset-0 bg-gradient-to-br {mood.gradient} opacity-40 group-hover:opacity-70 transition-opacity"
                            ></div>
                            <div
                                class="absolute inset-0 flex flex-col justify-end p-4"
                            >
                                <span
                                    class="material-symbols-rounded text-white/80 mb-1 text-[24px]"
                                    >{mood.icon}</span
                                >
                                <h3 class="font-bold text-base text-white">
                                    {mood.label}
                                </h3>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>
