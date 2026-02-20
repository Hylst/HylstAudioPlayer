<script lang="ts">
  import { db } from "$lib/db/database.svelte";
  import { player } from "$lib/audio/player.svelte";
  import { playlists } from "$lib/audio/playlists.svelte";
  import PlaylistCreateDialog from "../components/playlists/PlaylistCreateDialog.svelte";
  import type { Track } from "$lib/types";

  let activeFilter = $state("All");
  let items = $state<any[]>([]);
  let loading = $state(false);
  let showPlaylistCreate = $state(false);

  // Palette of glow colors for cards (cycles through)
  const glowColors = [
    "shadow-[0_0_25px_-5px_rgba(168,85,247,0.5)] border-purple-500/30",
    "shadow-[0_0_25px_-5px_rgba(236,72,153,0.5)] border-pink-500/30",
    "shadow-[0_0_25px_-5px_rgba(6,182,212,0.5)] border-cyan-500/30",
    "shadow-[0_0_25px_-5px_rgba(99,102,241,0.5)] border-indigo-500/30",
    "shadow-[0_0_25px_-5px_rgba(255,255,255,0.2)] border-white/20",
    "shadow-[0_0_25px_-5px_rgba(249,115,22,0.5)] border-orange-500/30",
  ];

  // Background gradient colors for artwork placeholders
  const gradients = [
    "from-purple-900/60 to-indigo-900/60",
    "from-pink-900/60 to-rose-900/60",
    "from-cyan-900/60 to-blue-900/60",
    "from-indigo-900/60 to-violet-900/60",
    "from-slate-800/60 to-gray-900/60",
    "from-orange-900/60 to-red-900/60",
  ];

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

<!-- Ambient Background Gradients (fixed, behind everything) -->
<div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
  <div
    class="absolute top-[-10%] left-[-10%] w-[60%] h-[45%] rounded-full bg-indigo-600/20 blur-[120px]"
  ></div>
  <div
    class="absolute bottom-[-10%] right-[-10%] w-[55%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]"
  ></div>
</div>

<div class="relative flex flex-col w-full max-w-md mx-auto min-h-full z-10">
  <!-- ═══════════════════════════════════════════
       STICKY HEADER — Glass panel with rounded bottom
  ═══════════════════════════════════════════ -->
  <header
    class="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4
           bg-gradient-to-b from-[rgba(255,255,255,0.07)] to-[rgba(255,255,255,0.02)]
           backdrop-blur-[40px] border border-t-0 border-x-0 border-white/8
           rounded-b-[2rem]"
  >
    <a
      href="/settings"
      class="flex items-center justify-center w-10 h-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Settings"
    >
      <span class="material-symbols-rounded text-[28px]">settings</span>
    </a>

    <h1
      class="font-bold text-2xl tracking-wide"
      style="background: linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.55)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
    >
      HAP
    </h1>

    <a
      href="/search"
      class="flex items-center justify-center w-10 h-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Search"
    >
      <span class="material-symbols-rounded text-[28px]">search</span>
    </a>
  </header>

  <!-- ═══════════════════════════════════════════
       SCROLLABLE CONTENT
  ═══════════════════════════════════════════ -->
  <main class="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-4">
    <!-- ─── Filter Tabs ─── -->
    <div
      class="flex gap-3 pb-6 overflow-x-auto no-scrollbar"
      style="mask-image: linear-gradient(to right, black 85%, transparent 100%)"
    >
      {#each filters as filter}
        <button
          class="px-5 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all flex-shrink-0
            {activeFilter === filter
            ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.35)]'
            : 'text-white/70 border border-white/10 hover:bg-white/10'}"
          style={activeFilter === filter
            ? ""
            : "backdrop-filter: blur(10px); background: rgba(255,255,255,0.04)"}
          onclick={() => (activeFilter = filter)}
        >
          {filter}
        </button>
      {/each}
    </div>

    {#if loading}
      <!-- Loading -->
      <div class="flex flex-col items-center justify-center py-24 gap-4">
        <div
          class="w-10 h-10 rounded-full border-2 border-white/10 border-t-indigo-400 animate-spin"
        ></div>
        <p class="text-xs text-white/30 tracking-widest uppercase">Loading…</p>
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
        <a
          href="/settings"
          class="px-6 py-2.5 rounded-full font-semibold text-sm text-white flex items-center gap-2 transition-all"
          style="background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 0 24px rgba(99,102,241,0.4)"
        >
          <span class="material-symbols-rounded text-[20px]"
            >create_new_folder</span
          >
          Add Folder
        </a>
      </div>
    {:else if activeFilter === "All"}
      <!-- ─── Track Grid (Stitch style: 2-col card grid) ─── -->
      <h2 class="font-semibold text-xl text-white/90 mb-4">Recently Added</h2>
      <div class="grid grid-cols-2 gap-4 pb-4">
        {#each items.slice(0, 50) as track, i}
          {@const isPlaying =
            player.currentTrack?.id === track.id && player.isPlaying}
          {@const isCurrent = player.currentTrack?.id === track.id}
          <div class="group flex flex-col gap-3">
            <!-- Artwork Card -->
            <div
              class="relative aspect-square rounded-[1.5rem] overflow-hidden border cursor-pointer {glowColors[
                i % glowColors.length
              ]}"
              style="background: linear-gradient(135deg, rgba(20,20,35,0.9), rgba(10,10,20,1))"
              onclick={() => player.playFromList(items, i)}
              role="button"
              tabindex="0"
              aria-label="Play {track.title ?? 'track'}"
              onkeydown={(e) =>
                e.key === "Enter" && player.playFromList(items, i)}
            >
              <!-- Placeholder gradient art -->
              <div
                class="absolute inset-0 bg-gradient-to-br {gradients[
                  i % gradients.length
                ]} opacity-70"
              ></div>

              <!-- Music note placeholder -->
              <div class="absolute inset-0 flex items-center justify-center">
                {#if isCurrent && player.isPlaying}
                  <!-- Animated bars when playing -->
                  <div class="flex items-end gap-[3px] h-8">
                    {#each [0.6, 1, 0.4, 0.8, 0.3, 0.9, 0.5] as h, j}
                      <div
                        class="w-1 rounded-full bg-indigo-400"
                        style="height: {h * 28}px; animation: bounce {0.8 +
                          j *
                            0.15}s ease-in-out infinite alternate; box-shadow: 0 0 8px rgba(99,102,241,0.8)"
                      ></div>
                    {/each}
                  </div>
                {:else}
                  <span
                    class="material-symbols-rounded text-4xl text-white/10 group-hover:text-white/20 transition-colors"
                  >
                    {isCurrent ? "pause_circle" : "music_note"}
                  </span>
                {/if}
              </div>

              <!-- Gradient overlay -->
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
              ></div>

              <!-- Hover Play button -->
              {#if !isCurrent}
                <button
                  class="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white
                         opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                  style="background: rgba(255,255,255,0.2); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15)"
                  aria-label="Play"
                >
                  <span class="material-symbols-rounded text-[22px] ml-0.5"
                    >play_arrow</span
                  >
                </button>
              {/if}
            </div>

            <!-- Track info -->
            <div class="px-1">
              <h3
                class="text-white font-medium text-sm truncate leading-snug
                {isCurrent ? 'text-indigo-300' : ''}"
              >
                {track.title ?? track.file_name ?? "Unknown"}
              </h3>
              <p class="text-white/50 text-xs truncate mt-0.5">
                {track.artist ?? "Unknown Artist"}
              </p>
            </div>
          </div>
        {/each}
      </div>
    {:else if activeFilter === "Albums"}
      <h2 class="font-semibold text-xl text-white/90 mb-4">Albums</h2>
      <div class="grid grid-cols-2 gap-4">
        {#each items as album, i}
          <div class="group flex flex-col gap-3">
            <div
              class="relative aspect-square rounded-[1.5rem] overflow-hidden border cursor-pointer {glowColors[
                i % glowColors.length
              ]}"
              style="background: linear-gradient(135deg, rgba(20,20,35,0.9), rgba(10,10,20,1))"
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
                class="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                style="background: rgba(255,255,255,0.2); backdrop-filter: blur(12px)"
              >
                <span class="material-symbols-rounded text-[22px] ml-0.5"
                  >play_arrow</span
                >
              </button>
            </div>
            <div class="px-1">
              <h3 class="text-white font-medium text-sm truncate">
                {album.album ?? "Unknown Album"}
              </h3>
              <p class="text-white/50 text-xs truncate">
                {album.artist || album.album_artist || "Unknown"}
              </p>
            </div>
          </div>
        {/each}
      </div>
    {:else if activeFilter === "Artists"}
      <h2 class="font-semibold text-xl text-white/90 mb-4">Artists</h2>
      <div class="grid grid-cols-2 gap-3">
        {#each items as artist}
          <div
            class="flex flex-col items-center gap-3 p-4 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
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
                class="font-semibold text-white text-sm truncate max-w-[130px]"
              >
                {artist.artist}
              </div>
              <div class="text-xs text-white/40">
                {artist.track_count}
                {artist.track_count === 1 ? "track" : "tracks"}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if activeFilter === "Playlists"}
      <h2 class="font-semibold text-xl text-white/90 mb-4">Playlists</h2>
      <div class="space-y-2">
        {#each items as pl}
          <a
            href="/playlists/{pl.id}"
            class="p-4 rounded-2xl flex items-center gap-4 hover:bg-white/5 transition-all group"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
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
                class="font-semibold text-white group-hover:text-hap-primary transition-colors"
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
          class="w-full p-4 mt-2 rounded-2xl flex items-center justify-center gap-2 text-white/40 hover:text-white transition-colors"
          style="border: 1px dashed rgba(255,255,255,0.15)"
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
