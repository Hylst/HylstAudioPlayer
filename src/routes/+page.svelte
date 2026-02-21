<script lang="ts">
  import { db } from "$lib/db/database.svelte";
  import { player } from "$lib/audio/player.svelte";
  import { playlists } from "$lib/audio/playlists.svelte";
  import { fsManager } from "$lib/fs/fileSystemManager.svelte";
  import PlaylistCreateDialog from "../components/playlists/PlaylistCreateDialog.svelte";
  import type { Track } from "$lib/types";

  let activeFilter = $state("All");
  let items = $state<any[]>([]);
  let loading = $state(false);
  let showPlaylistCreate = $state(false);

  // ─── Artwork lazy-load ────────────────────────────────────────────────────────────
  // IMPORTANT — Svelte 5 Rule: NEVER mutate $state from template expressions,
  // {@const} blocks, or $derived. Only mutate from $effect or event handlers.
  const artUrlMap = $state<Record<number, string | null>>({});

  $effect(() => {
    if (activeFilter !== "All") return;
    const visible = items.slice(0, 50);
    for (const track of visible) {
      if (!track.artwork_hash) continue;
      if (track.id in artUrlMap) continue; // already requested
      artUrlMap[track.id] = null; // reserve slot
      player.getArtworkUrl(track.artwork_hash).then((url) => {
        artUrlMap[track.id] = url;
      });
    }
  });

  // ─── Palette ─────────────────────────────────────────────────────────────────
  const glowColors = [
    "shadow-[0_0_25px_-5px_rgba(168,85,247,0.5)] border-purple-500/30",
    "shadow-[0_0_25px_-5px_rgba(236,72,153,0.5)] border-pink-500/30",
    "shadow-[0_0_25px_-5px_rgba(6,182,212,0.5)] border-cyan-500/30",
    "shadow-[0_0_25px_-5px_rgba(99,102,241,0.5)] border-indigo-500/30",
    "shadow-[0_0_25px_-5px_rgba(255,255,255,0.2)] border-white/20",
    "shadow-[0_0_25px_-5px_rgba(249,115,22,0.5)] border-orange-500/30",
  ];
  const gradients = [
    "from-purple-900/60 to-indigo-900/60",
    "from-pink-900/60 to-rose-900/60",
    "from-cyan-900/60 to-blue-900/60",
    "from-indigo-900/60 to-violet-900/60",
    "from-slate-800/60 to-gray-900/60",
    "from-orange-900/60 to-red-900/60",
  ];

  // ─── Data loading ─────────────────────────────────────────────────────────────
  $effect(() => {
    const _ = db.lastUpdate;
    if (db.isReady) loadItems(activeFilter);
  });

  async function loadItems(filter: string) {
    if (!db.isReady) return;
    loading = true;
    try {
      if (filter === "All") {
        const result = await db.getTracks();
        items = Array.isArray(result) ? result : [];
      } else if (filter === "Albums") {
        const result = await db.getAlbums();
        items = Array.isArray(result) ? result : [];
      } else if (filter === "Artists") {
        const result = await db.getArtists();
        items = Array.isArray(result) ? result : [];
      } else if (filter === "Playlists") {
        await playlists.refresh();
        items = playlists.allPlaylists;
      }
    } catch (e) {
      console.error("[Home] Failed to load items:", e);
      items = [];
    } finally {
      loading = false;
    }
  }

  const filters = ["All", "Albums", "Artists", "Playlists"] as const;
</script>

<!-- Ambient Background Gradients -->
<div
  class="fixed inset-0 pointer-events-none z-0 overflow-hidden"
  aria-hidden="true"
>
  <div
    class="absolute top-[-10%] left-[-10%] w-[60%] h-[45%] rounded-full bg-indigo-600/20 blur-[120px]"
  ></div>
  <div
    class="absolute bottom-[-10%] right-[-10%] w-[55%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]"
  ></div>
</div>

<div class="relative flex flex-col w-full max-w-md mx-auto min-h-full z-10">
  <!-- ═══════════════════════════════════════════
       STICKY HEADER
  ═══════════════════════════════════════════ -->
  <header
    class="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4
           bg-gradient-to-b from-[rgba(255,255,255,0.07)] to-[rgba(255,255,255,0.02)]
           backdrop-blur-[40px] border border-t-0 border-x-0 border-white/8
           rounded-b-[2rem]"
  >
    <a
      href="/settings"
      class="flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Settings"
    >
      <span class="material-symbols-rounded text-[26px]">settings</span>
    </a>
    <a
      href="/about"
      class="flex items-center justify-center w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="About"
    >
      <span class="material-symbols-rounded text-[20px]">info</span>
    </a>

    <!-- Branding: gradient "Hylst Music Player" -->
    <h1
      class="font-extrabold tracking-tight flex-1 text-center"
      style="font-size: 1.2rem; letter-spacing: -0.03em;
        background: linear-gradient(135deg, #fff 20%, rgba(99,102,241,0.85) 100%);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
    >
      Hylst Music Player
    </h1>

    <a
      href="/search"
      class="flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Search"
    >
      <span class="material-symbols-rounded text-[26px]">search</span>
    </a>
  </header>

  <!-- ═══════════════════════════════════════════
       SCROLLABLE CONTENT
  ═══════════════════════════════════════════ -->
  <main class="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-4">
    <!-- ─── Filter Tabs ─── -->
    <div
      class="flex gap-2.5 pb-6 overflow-x-auto no-scrollbar"
      style="mask-image: linear-gradient(to right, black 85%, transparent 100%)"
    >
      {#each filters as filter}
        <button
          class="px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 active:scale-95"
          style={activeFilter === filter
            ? "background: white; color: #000; box-shadow: 0 0 20px rgba(255,255,255,0.3)"
            : "background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.65); border: 1px solid rgba(255,255,255,0.10); backdrop-filter: blur(10px)"}
          onclick={() => (activeFilter = filter)}
        >
          {filter}
        </button>
      {/each}
    </div>

    <!-- ─── File Browser Shortcut ─── -->
    <a
      href="/browse"
      class="flex items-center gap-3 px-4 py-3 mb-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-95"
      style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 0 20px -8px rgba(99,102,241,0.25)"
    >
      <span
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style="background: linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.3))"
      >
        <span class="material-symbols-rounded text-[20px] text-indigo-300"
          >folder_open</span
        >
      </span>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold text-white/90">Browse Files</div>
        <div class="text-xs text-white/40">
          Navigate your music folders directly
        </div>
      </div>
      <span class="material-symbols-rounded text-[18px] text-white/30"
        >chevron_right</span
      >
    </a>

    {#if loading}
      <div class="grid grid-cols-2 gap-4 pb-4">
        {#each Array(6) as _}
          <div class="flex flex-col gap-3">
            <div
              class="aspect-square rounded-[1.5rem] animate-pulse"
              style="background: rgba(255,255,255,0.06)"
            ></div>
            <div class="flex flex-col gap-1.5 px-1">
              <div
                class="h-3 rounded-full w-3/4 animate-pulse"
                style="background: rgba(255,255,255,0.06)"
              ></div>
              <div
                class="h-2.5 rounded-full w-1/2 animate-pulse"
                style="background: rgba(255,255,255,0.04)"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if items.length === 0}
      <!-- Empty State -->
      <div class="flex flex-col items-center justify-center py-20 gap-6">
        <div
          class="w-28 h-28 rounded-[2rem] flex items-center justify-center"
          style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 0 40px -10px rgba(99,102,241,0.3)"
        >
          <span class="material-symbols-rounded text-5xl text-indigo-400"
            >library_music</span
          >
        </div>
        <div class="text-center">
          <p class="text-lg font-semibold text-white mb-2">Library is empty</p>
          <p class="text-sm text-white/40 max-w-[220px] leading-relaxed">
            Add a folder in Settings to discover your music.
          </p>
        </div>
        <button
          onclick={() => fsManager.addFolder()}
          class="px-6 py-3 rounded-full font-semibold text-sm text-white flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
          style="background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 0 24px rgba(99,102,241,0.4)"
        >
          <span class="material-symbols-rounded text-[20px]"
            >create_new_folder</span
          >
          Add Folder
        </button>
        <a
          href="/browse"
          class="px-6 py-3 rounded-full font-semibold text-sm text-white/70 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
          style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1)"
        >
          <span class="material-symbols-rounded text-[20px]">folder_open</span>
          Browse Files
        </a>
      </div>
    {:else if activeFilter === "All"}
      <!-- ─── Track Grid ─── -->
      <div class="flex items-baseline justify-between mb-4">
        <h2 class="font-bold text-xl text-white/90">Recently Added</h2>
        <span class="text-xs text-white/30 font-medium"
          >{items.length} tracks</span
        >
      </div>
      <div class="grid grid-cols-2 gap-4 pb-4">
        {#each items.slice(0, 50) as track, i}
          {@const isCurrent = player.currentTrack?.id === track.id}
          <div class="group flex flex-col gap-3">
            <!-- Artwork Card -->
            <div
              class="relative aspect-square rounded-[1.5rem] overflow-hidden border cursor-pointer transition-transform duration-100 active:scale-95 {glowColors[
                i % glowColors.length
              ]}"
              style="background: linear-gradient(135deg, rgba(20,20,35,0.9), rgba(10,10,20,1)); touch-action: manipulation"
              onclick={() => player.playFromList(items, i)}
              role="button"
              tabindex="0"
              aria-label="Play {track.title ?? 'track'}"
              onkeydown={(e) =>
                e.key === "Enter" && player.playFromList(items, i)}
            >
              <!-- Artwork or gradient placeholder -->
              {#if artUrlMap[track.id]}
                <img
                  src={artUrlMap[track.id]}
                  alt=""
                  class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  loading="lazy"
                />
                <!-- Dark overlay for text contrast -->
                <div
                  class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
                ></div>
              {:else}
                <div
                  class="absolute inset-0 bg-gradient-to-br {gradients[
                    i % gradients.length
                  ]} opacity-70"
                ></div>
                <div
                  class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
                ></div>
              {/if}

              <!-- Playing indicator or music note -->
              <div class="absolute inset-0 flex items-center justify-center">
                {#if isCurrent && player.isPlaying}
                  <div class="flex items-end gap-[3px] h-8 drop-shadow-lg">
                    {#each [0.6, 1, 0.4, 0.8, 0.3, 0.9, 0.5] as h, j}
                      <div
                        class="w-1 rounded-full bg-white"
                        style="height: {h * 28}px; animation: bounce {0.8 +
                          j *
                            0.15}s ease-in-out infinite alternate; box-shadow: 0 0 8px rgba(255,255,255,0.6)"
                      ></div>
                    {/each}
                  </div>
                {:else if !artUrlMap[track.id]}
                  <span
                    class="material-symbols-rounded text-4xl text-white/15 group-hover:text-white/25 transition-colors"
                  >
                    {isCurrent ? "pause_circle" : "music_note"}
                  </span>
                {/if}
              </div>

              <!-- Hover play button (desktop) -->
              {#if !isCurrent}
                <button
                  class="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white
                         opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-250"
                  style="background: rgba(255,255,255,0.2); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15)"
                  aria-label="Play"
                  tabindex="-1"
                >
                  <span class="material-symbols-rounded text-[22px] ml-0.5"
                    >play_arrow</span
                  >
                </button>
              {/if}

              <!-- Current ring -->
              {#if isCurrent}
                <div
                  class="absolute inset-0 rounded-[1.5rem] pointer-events-none"
                  style="border: 2px solid var(--hap-primary,#6467f2); box-shadow: inset 0 0 12px rgba(99,102,241,0.3)"
                ></div>
              {/if}
            </div>

            <!-- Track info -->
            <div class="px-1">
              <div class="flex items-start justify-between gap-1">
                <h3
                  class="font-semibold text-sm truncate leading-snug flex-1"
                  style={isCurrent
                    ? "color: var(--hap-primary,#6467f2); font-weight: 700"
                    : "color: rgba(255,255,255,0.9)"}
                >
                  {track.title ?? track.file_name ?? "Unknown"}
                </h3>
                <a
                  href="/track/{track.id}"
                  class="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white/25 hover:text-white/60 hover:bg-white/10 transition-all"
                  aria-label="Track details"
                  onclick={(e) => e.stopPropagation()}
                >
                  <span class="material-symbols-rounded text-[16px]">info</span>
                </a>
              </div>
              <div class="flex items-center justify-between gap-1 mt-0.5">
                <p class="text-white/45 text-xs truncate flex-1">
                  {track.artist ?? "Unknown Artist"}
                </p>
                <!-- Heart / Favorite button -->
                <button
                  class="shrink-0 w-6 h-6 flex items-center justify-center transition-all opacity-60 hover:opacity-100"
                  aria-label={playlists.isFavorite(track.id)
                    ? "Remove from favorites"
                    : "Add to favorites"}
                  onclick={(e) => {
                    e.stopPropagation();
                    playlists.toggleFavorite(track.id);
                  }}
                  style={playlists.isFavorite(track.id)
                    ? "color: #f43f5e"
                    : "color: rgba(255,255,255,0.35)"}
                >
                  <span
                    class="material-symbols-rounded text-[16px]"
                    style="font-variation-settings: 'FILL' {playlists.isFavorite(
                      track.id,
                    )
                      ? 1
                      : 0}, 'wght' 400">favorite</span
                  >
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if activeFilter === "Albums"}
      <div class="flex items-baseline justify-between mb-4">
        <h2 class="font-bold text-xl text-white/90">Albums</h2>
        <span class="text-xs text-white/30 font-medium"
          >{items.length} albums</span
        >
      </div>
      <div class="grid grid-cols-2 gap-4">
        {#each items as album, i}
          <div class="group flex flex-col gap-3">
            <div
              class="relative aspect-square rounded-[1.5rem] overflow-hidden border cursor-pointer transition-transform duration-100 active:scale-95 {glowColors[
                i % glowColors.length
              ]}"
              style="background: linear-gradient(135deg, rgba(20,20,35,0.9), rgba(10,10,20,1)); touch-action: manipulation"
            >
              <div
                class="absolute inset-0 bg-gradient-to-br {gradients[
                  i % gradients.length
                ]} opacity-70"
              ></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="material-symbols-rounded text-5xl text-white/10"
                  >album</span
                >
              </div>
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"
              ></div>
              <button
                class="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-250"
                style="background: rgba(255,255,255,0.2); backdrop-filter: blur(12px)"
                tabindex="-1"
              >
                <span class="material-symbols-rounded text-[22px] ml-0.5"
                  >play_arrow</span
                >
              </button>
            </div>
            <div class="px-1">
              <h3 class="text-white/90 font-semibold text-sm truncate">
                {album.album ?? "Unknown Album"}
              </h3>
              <p class="text-white/45 text-xs truncate">
                {album.artist || album.album_artist || "Unknown"}
              </p>
            </div>
          </div>
        {/each}
      </div>
    {:else if activeFilter === "Artists"}
      <div class="flex items-baseline justify-between mb-4">
        <h2 class="font-bold text-xl text-white/90">Artists</h2>
        <span class="text-xs text-white/30 font-medium"
          >{items.length} artists</span
        >
      </div>
      <div class="grid grid-cols-2 gap-3">
        {#each items as artist}
          <div
            class="flex flex-col items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-150 active:scale-95"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); touch-action: manipulation"
          >
            <div
              class="w-20 h-20 rounded-full flex items-center justify-center"
              style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1)"
            >
              <span class="material-symbols-rounded text-4xl text-white/25"
                >person</span
              >
            </div>
            <div class="text-center">
              <div
                class="font-semibold text-white/90 text-sm truncate max-w-[130px]"
              >
                {artist.artist}
              </div>
              <div class="text-xs text-white/40 mt-0.5">
                {artist.track_count}
                {artist.track_count === 1 ? "track" : "tracks"}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if activeFilter === "Playlists"}
      <div class="flex items-baseline justify-between mb-4">
        <h2 class="font-bold text-xl text-white/90">Playlists</h2>
        <span class="text-xs text-white/30 font-medium"
          >{items.length} playlists</span
        >
      </div>
      <div class="space-y-2">
        {#each items as pl}
          <a
            href="/playlists/{pl.id}"
            class="p-4 rounded-2xl flex items-center gap-4 transition-all duration-150 active:scale-[0.98] group"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); touch-action: manipulation"
          >
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-hap-primary/30"
              style="background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.25)"
            >
              <span class="material-symbols-rounded text-hap-primary"
                >queue_music</span
              >
            </div>
            <div class="min-w-0 flex-1">
              <div
                class="font-semibold text-white/90 group-hover:text-hap-primary transition-colors"
              >
                {pl.name}
              </div>
              <div class="text-xs text-white/40">
                {pl.track_count || 0} tracks
              </div>
            </div>
            <span
              class="material-symbols-rounded text-white/20 text-[20px] group-hover:text-white/40 transition-colors"
              >chevron_right</span
            >
          </a>
        {/each}
        <button
          class="w-full p-4 mt-2 rounded-2xl flex items-center justify-center gap-2 text-white/40 hover:text-white transition-all active:scale-95"
          style="border: 1px dashed rgba(255,255,255,0.15); touch-action: manipulation"
          onclick={() => (showPlaylistCreate = true)}
        >
          <span class="material-symbols-rounded">add</span>
          New Playlist
        </button>
      </div>
    {/if}
  </main>
</div>

<PlaylistCreateDialog
  bind:show={showPlaylistCreate}
  onCreated={() => loadItems("Playlists")}
/>

<style>
  @keyframes bounce {
    from {
      transform: scaleY(0.3);
    }
    to {
      transform: scaleY(1);
    }
  }
</style>
