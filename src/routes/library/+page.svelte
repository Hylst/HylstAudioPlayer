<script lang="ts">
    import { db } from "$lib/db/database.svelte";
    import { player } from "$lib/audio/player.svelte";
    import type { Track } from "$lib/types";

    let tracks = $state<Track[]>([]);
    let loading = $state(true);

    $effect(() => {
        loadLibrary();
    });

    async function loadLibrary() {
        loading = true;
        try {
            tracks = await db.getTracks();
        } catch (e) {
            console.error(e);
        }
        loading = false;
    }
</script>

<div class="p-6 max-w-7xl mx-auto space-y-6">
    <header
        class="flex justify-between items-center pb-4 border-b border-white/10"
    >
        <h1 class="text-3xl font-bold text-white">Library</h1>
        <div class="text-sm text-white/50">{tracks.length} tracks</div>
    </header>

    {#if loading}
        <div class="flex justify-center p-12">
            <span
                class="material-symbols-rounded animate-spin text-4xl text-primary-400"
                >sync</span
            >
        </div>
    {:else if tracks.length === 0}
        <div class="text-center p-12 bg-surface-800/50 rounded-xl">
            <span class="material-symbols-rounded text-6xl text-white/20 mb-4"
                >library_music</span
            >
            <h3 class="text-xl font-medium text-white">
                Your library is empty
            </h3>
            <p class="text-white/50 mt-2 mb-6">
                Import your local music folder to get started.
            </p>
            <a
                href="/settings"
                class="btn-primary inline-flex items-center gap-2"
            >
                <span class="material-symbols-rounded">folder_open</span>Go to
                Settings
            </a>
        </div>
    {:else}
        <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
            {#each tracks as track}
                <button
                    class="text-left group bg-surface-800/40 hover:bg-surface-700/60 p-3 rounded-lg flex items-center gap-4 transition-colors w-full"
                    onclick={() => player.play(track)}
                >
                    <div
                        class="w-12 h-12 rounded bg-surface-700 flex items-center justify-center shrink-0"
                    >
                        <span
                            class="material-symbols-rounded text-white/30 group-hover:text-primary-400 transition-colors"
                        >
                            music_note
                        </span>
                    </div>
                    <div class="min-w-0 flex-1">
                        <h4
                            class="font-medium text-white truncate group-hover:text-primary-300 transition-colors"
                        >
                            {track.title || "Unknown Title"}
                        </h4>
                        <p class="text-sm text-white/50 truncate">
                            {track.artist || "Unknown Artist"}
                        </p>
                    </div>
                    {#if player.currentTrack?.id === track.id}
                        <div class="text-primary-400">
                            <span class="material-symbols-rounded">
                                {player.isPlaying ? "pause" : "play_arrow"}
                            </span>
                        </div>
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>
