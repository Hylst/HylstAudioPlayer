<script lang="ts">
    import { playlists } from "$lib/audio/playlists.svelte";
    import { player } from "$lib/audio/player.svelte";
    import { goto } from "$app/navigation";
    import type { Track } from "$lib/types";

    let {
        track,
        show = $bindable(false),
        x,
        y,
        trackDetailHref = undefined,
        trackEditHref = undefined,
    } = $props<{
        track: Track;
        show: boolean;
        x: number;
        y: number;
        trackDetailHref?: string;
        trackEditHref?: string;
    }>();

    let showPlaylistSubmenu = $state(false);

    // ─── Play Next ──────────────────────────────────────────────────────────────
    function playNext() {
        if (!track) return;
        player.addToQueueNext(track);
        show = false;
    }

    // ─── Add to playlist ────────────────────────────────────────────────────────
    async function addToPlaylist(playlistId: number) {
        if (!track) return;
        await playlists.addTrack(playlistId, track.id);
        show = false;
    }

    // ─── Favorite toggle ────────────────────────────────────────────────────────
    async function toggleFavorite() {
        if (!track) return;
        await playlists.toggleFavorite(track.id);
        show = false;
    }

    function handleOutsideClick() {
        show = false;
        showPlaylistSubmenu = false;
    }
</script>

{#if show}
    <div
        class="fixed inset-0 z-[110]"
        onclick={handleOutsideClick}
        role="none"
    ></div>

    <div
        class="fixed z-[120] w-56 glass-panel-strong rounded-2xl p-1.5 shadow-2xl"
        role="menu"
        tabindex="-1"
        style="left: {Math.min(
            x,
            typeof window !== 'undefined' ? window.innerWidth - 240 : x,
        )}px;
               top: {Math.min(
            y,
            typeof window !== 'undefined' ? window.innerHeight - 340 : y,
        )}px"
    >
        <div class="flex flex-col" role="none">
            <!-- Navigate: View Details -->
            {#if trackDetailHref}
                <a
                    href={trackDetailHref}
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-sm font-medium transition-colors"
                    role="menuitem"
                    onclick={() => {
                        show = false;
                    }}
                >
                    <span
                        class="material-symbols-rounded text-[20px] text-white/40"
                        >info</span
                    >
                    View Details
                </a>
            {/if}

            <!-- Navigate: Edit Tags -->
            {#if trackEditHref}
                <a
                    href={trackEditHref}
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-sm font-medium transition-colors"
                    role="menuitem"
                    onclick={() => {
                        show = false;
                    }}
                >
                    <span
                        class="material-symbols-rounded text-[20px] text-white/40"
                        >edit</span
                    >
                    Edit Tags
                </a>
            {/if}

            {#if trackDetailHref || trackEditHref}
                <div class="my-1 h-px bg-white/5 mx-2" role="separator"></div>
            {/if}

            <!-- Play Next -->
            <button
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-sm font-medium transition-colors"
                role="menuitem"
                onclick={playNext}
            >
                <span class="material-symbols-rounded text-[20px] text-white/40"
                    >queue_play_next</span
                >
                Play Next
            </button>

            <!-- Favorite toggle -->
            <button
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm font-medium transition-colors"
                class:text-red-400={playlists.isFavorite(track?.id ?? -1)}
                class:text-white={!playlists.isFavorite(track?.id ?? -1)}
                role="menuitem"
                onclick={toggleFavorite}
            >
                <span
                    class="material-symbols-rounded text-[20px] transition-colors"
                    style={playlists.isFavorite(track?.id ?? -1)
                        ? 'color: rgba(239,68,68,0.8); font-variation-settings: "FILL" 1'
                        : "color: rgba(255,255,255,0.4)"}>favorite</span
                >
                {playlists.isFavorite(track?.id ?? -1)
                    ? "Remove from Favorites"
                    : "Add to Favorites"}
            </button>

            <!-- Add to Playlist (with submenu) -->
            <div
                class="relative"
                role="none"
                onmouseenter={() => (showPlaylistSubmenu = true)}
                onmouseleave={() => (showPlaylistSubmenu = false)}
            >
                <button
                    class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-sm font-medium transition-colors"
                    role="menuitem"
                    onclick={() => (showPlaylistSubmenu = !showPlaylistSubmenu)}
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

                {#if showPlaylistSubmenu}
                    <div
                        class="absolute left-full top-0 ml-1 w-56 glass-panel-strong rounded-2xl p-1.5 shadow-2xl"
                        role="menu"
                        tabindex="-1"
                    >
                        {#if playlists.customPlaylists.length === 0}
                            <div class="px-4 py-3 text-center">
                                <p
                                    class="text-[11px] text-white/40 uppercase font-bold tracking-widest"
                                >
                                    No playlists
                                </p>
                                <button
                                    onclick={() => {
                                        show = false;
                                        goto("/playlists");
                                    }}
                                    class="mt-2 text-xs text-white/50 hover:text-white underline underline-offset-2"
                                    >Create one →</button
                                >
                            </div>
                        {:else}
                            <div
                                class="max-h-60 overflow-y-auto no-scrollbar"
                                role="none"
                            >
                                {#each playlists.customPlaylists as pl}
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
                                        {#if pl.track_count}
                                            <span
                                                class="ml-auto text-xs text-white/20 shrink-0"
                                                >{pl.track_count}</span
                                            >
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="my-1 h-px bg-white/5 mx-2" role="separator"></div>

            <!-- Remove from Library (placeholder) -->
            <button
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors"
                role="menuitem"
                onclick={() => {
                    show = false;
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
