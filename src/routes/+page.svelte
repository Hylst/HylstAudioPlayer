<script lang="ts">
  import { db } from "$lib/db/database.svelte";
  import { player } from "$lib/audio/player.svelte";
  import type { Track } from "$lib/types";

  let activeFilter = $state("All");
  let items = $state<any[]>([]);
  let loading = $state(false);

  // Load items when filter changes
  $effect(() => {
    loadItems(activeFilter);
  });

  async function loadItems(filter: string) {
    if (!db.isReady) {
      console.log("[Home] DB not ready yet");
      return;
    }
    loading = true;
    console.log("[Home] Loading items for filter:", filter);
    try {
      if (filter === "All") {
        const result = await db.getTracks();
        console.log("[Home] getTracks returned:", result);
        items = Array.isArray(result) ? result : [];
      } else if (filter === "Albums") {
        const result = await db.getAlbums();
        console.log("[Home] getAlbums returned:", result);
        items = Array.isArray(result) ? result : [];
      } else if (filter === "Artists") {
        const result = await db.getArtists();
        console.log("[Home] getArtists returned:", result);
        items = Array.isArray(result) ? result : [];
      } else if (filter === "Playlists") {
        const result = await db.getPlaylists();
        console.log("[Home] getPlaylists returned:", result);
        items = Array.isArray(result) ? result : [];
      }
      console.log("[Home] Final items:", items);
    } catch (e) {
      console.error("[Home] Failed to load items:", e);
      items = []; // Force empty array on error
    } finally {
      loading = false;
    }
  }

  // Reload when DB is ready
  $effect(() => {
    if (db.isReady) {
      console.log("[Home] DB became ready, loading items");
      loadItems(activeFilter);
    }
  });
</script>

<div class="px-5 pt-6 w-full max-w-md mx-auto pb-32">
  <!-- Header -->
  <header class="flex items-center justify-between mb-8">
    <button
      class="flex items-center justify-center w-10 h-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Open menu"
    >
      <span class="material-symbols-rounded text-[28px]">menu</span>
    </button>

    <h1 class="text-xl font-bold tracking-wider text-white">HAP</h1>

    <button
      class="flex items-center justify-center w-10 h-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Search"
    >
      <span class="material-symbols-rounded text-[28px]">search</span>
    </button>
  </header>

  <!-- Filter Tabs -->
  <div class="flex gap-3 pb-6 overflow-x-auto no-scrollbar mask-gradient-r">
    {#each ["All", "Albums", "Artists", "Playlists"] as filter}
      <button
        class="px-5 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap {activeFilter ===
        filter
          ? 'bg-white text-black shadow-glow-white'
          : 'glass text-white/70 hover:bg-white/10'}"
        onclick={() => (activeFilter = filter)}
      >
        {filter}
      </button>
    {/each}
  </div>

  <!-- Content -->
  {#if loading}
    <div class="flex justify-center py-20">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"
      ></div>
    </div>
  {:else if items.length === 0}
    <!-- Empty State -->
    <div class="flex flex-col items-center justify-center py-16 gap-6">
      <div
        class="w-24 h-24 rounded-3xl bg-surface-800 flex items-center justify-center shadow-lg border border-white/5"
      >
        <span class="material-symbols-rounded text-5xl text-primary-400"
          >library_music</span
        >
      </div>
      <div class="text-center">
        <p class="text-lg font-semibold text-white mb-2">
          No {activeFilter} found
        </p>
        <p class="text-sm text-white/50 max-w-xs">
          Add a music folder to start building your library.
        </p>
      </div>
      <a
        href="/settings"
        class="px-8 py-3 bg-primary-500 hover:bg-primary-400 rounded-full text-white font-semibold text-sm transition-colors flex items-center gap-2 shadow-lg"
      >
        <span class="material-symbols-rounded text-xl">create_new_folder</span>
        Add Folder
      </a>
    </div>
  {:else if activeFilter === "All"}
    <h2 class="text-xl font-bold mb-4">Recently Added</h2>
    <div class="space-y-2">
      {#each items.slice(0, 20) as track}
        <button
          class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
          onclick={() => player.play(track)}
        >
          <div
            class="w-12 h-12 rounded bg-surface-800 flex items-center justify-center text-white/20 group-hover:text-white/40"
          >
            <span class="material-symbols-rounded">music_note</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium text-white truncate">{track.title}</div>
            <div class="text-xs text-white/50 truncate">{track.artist}</div>
          </div>
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-primary-400 opacity-0 group-hover:opacity-100 bg-white/10"
          >
            <span class="material-symbols-rounded">play_arrow</span>
          </div>
        </button>
      {/each}
    </div>
  {:else if activeFilter === "Albums"}
    <div class="grid grid-cols-2 gap-4">
      {#each items as album}
        <div
          class="group flex flex-col gap-2 p-2 rounded-2xl hover:bg-white/5 transition-colors"
        >
          <div
            class="aspect-square rounded-xl bg-surface-800 relative overflow-hidden shadow-lg border border-white/5"
          >
            <div
              class="w-full h-full flex items-center justify-center text-white/20"
            >
              <span class="material-symbols-rounded text-4xl">album</span>
            </div>
            <!-- Play overlay -->
            <div
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <button
                class="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-all"
              >
                <span class="material-symbols-rounded text-3xl">play_arrow</span
                >
              </button>
            </div>
          </div>
          <div>
            <div class="font-bold text-white truncate">{album.album}</div>
            <div class="text-xs text-white/50 truncate">
              {album.artist || album.album_artist || "Unknown"}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if activeFilter === "Artists"}
    <div class="grid grid-cols-2 gap-4">
      {#each items as artist}
        <div
          class="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-surface-800/50 border border-white/5 hover:bg-surface-800 transition-colors"
        >
          <div
            class="w-24 h-24 rounded-full bg-surface-700 flex items-center justify-center text-white/20 shadow-lg"
          >
            <span class="material-symbols-rounded text-4xl">person</span>
          </div>
          <div class="text-center">
            <div class="font-bold text-white truncate max-w-[140px]">
              {artist.artist}
            </div>
            <div class="text-xs text-white/50">{artist.track_count} tracks</div>
          </div>
        </div>
      {/each}
    </div>
  {:else if activeFilter === "Playlists"}
    <div class="space-y-2">
      {#each items as pl}
        <div class="p-4 rounded-xl bg-surface-800/50 border border-white/5">
          <div class="font-bold">{pl.name}</div>
          <div class="text-xs text-white/50">{pl.track_count || 0} tracks</div>
        </div>
      {/each}
      <button
        class="w-full p-4 rounded-xl border border-dashed border-white/20 flex items-center justify-center gap-2 text-white/50 hover:text-white hover:border-white/40 transition-colors"
      >
        <span class="material-symbols-rounded">add</span>
        Create Playlist
      </button>
    </div>
  {/if}
</div>
