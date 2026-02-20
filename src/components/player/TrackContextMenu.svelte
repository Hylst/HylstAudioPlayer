<script lang="ts">
    import { playlists } from "$lib/audio/playlists.svelte";
    import type { Track } from "$lib/types";

    let {
        track,
        show = $bindable(false),
        x,
        y,
    } = $props<{ track: Track; show: boolean; x: number; y: number }>();

    let showPlaylistSubmenu = $state(false);

    async function addToPlaylist(playlistId: number) {
        if (!track) return;
        await playlists.addTrack(playlistId, track.id);
        show = false;
    }

    function handleOutsideClick() {
        show = false;
    }
</script>

{#if show}
    <div
        class="fixed inset-0 z-[110]"
        onclick={handleOutsideClick}
        role="none"
    ></div>

    <div
        class="fixed z-[120] w-56 glass-panel-strong rounded-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in duration-200"
        role="menu"
        tabindex="-1"
        style="left: {Math.min(
            x,
            typeof window !== 'undefined' ? window.innerWidth - 240 : x,
        )}px; top: {Math.min(
            y,
            typeof window !== 'undefined' ? window.innerHeight - 300 : y,
        )}px"
    >
        <div class="flex flex-col" role="none">
            <button
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-sm font-medium transition-colors"
                role="menuitem"
                onclick={() => {
                    /* TODO: Play Next */ show = false;
                }}
            >
                <span class="material-symbols-rounded text-[20px] text-white/40"
                    >queue_play_next</span
                >
                Play Next
            </button>

            <div class="relative group" role="none">
                <button
                    class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-sm font-medium transition-colors"
                    role="menuitem"
                    onmouseenter={() => (showPlaylistSubmenu = true)}
                >
                    <div class="flex items-center gap-3" role="none">
                        <span
                            class="material-symbols-rounded text-[20px] text-white/40"
                            >playlist_add</span
                        >
                        Add to Playlist
                    </div>
                    <span
                        class="material-symbols-rounded text-[18px] text-white/20"
                        >chevron_right</span
                    >
                </button>

                {#if showPlaylistSubmenu && playlists.allPlaylists.length > 0}
                    <div
                        class="absolute left-full top-0 ml-1 w-56 glass-panel-strong rounded-2xl p-1.5 shadow-2xl"
                        role="menu"
                        tabindex="-1"
                        onmouseleave={() => (showPlaylistSubmenu = false)}
                    >
                        <div
                            class="max-h-60 overflow-y-auto no-scrollbar"
                            role="none"
                        >
                            {#each playlists.allPlaylists as pl}
                                <button
                                    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-white text-sm font-medium transition-colors text-left"
                                    role="menuitem"
                                    onclick={() => addToPlaylist(pl.id)}
                                >
                                    <span
                                        class="material-symbols-rounded text-[18px] text-white/30"
                                        >queue_music</span
                                    >
                                    <span class="truncate">{pl.name}</span>
                                </button>
                            {/each}
                        </div>
                    </div>
                {:else if showPlaylistSubmenu}
                    <div
                        class="absolute left-full top-0 ml-1 w-56 glass-panel-strong rounded-2xl p-4 shadow-2xl text-center"
                        role="presentation"
                        onmouseleave={() => (showPlaylistSubmenu = false)}
                    >
                        <p
                            class="text-[11px] text-white/40 uppercase font-bold tracking-widest"
                        >
                            No Playlists
                        </p>
                    </div>
                {/if}
            </div>

            <div class="my-1 h-px bg-white/5 mx-2" role="separator"></div>

            <button
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors"
                role="menuitem"
                onclick={() => {
                    /* TODO: Remove from Library */ show = false;
                }}
            >
                <span
                    class="material-symbols-rounded text-[20px] text-red-500/40"
                    >delete</span
                >
                Remove from Library
            </button>
        </div>
    </div>
{/if}
