<script lang="ts">
  // Home page — Library view placeholder
  // Will be connected to database.svelte.ts store in Phase 2
</script>

<div class="px-5 pt-6 w-full max-w-md mx-auto">
  <!-- Header -->
  <header class="flex items-center justify-between mb-8">
    <button
      class="flex items-center justify-center w-10 h-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Open menu"
    >
      <span class="material-symbols-outlined text-[28px]">menu</span>
    </button>

    <h1 class="text-xl font-bold tracking-wider text-white">HAP</h1>

    <button
      class="flex items-center justify-center w-10 h-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Search"
    >
      <span class="material-symbols-outlined text-[28px]">search</span>
    </button>
  </header>

  <!-- Filter Tabs -->
  <div class="flex gap-3 pb-6 overflow-x-auto no-scrollbar mask-gradient-r">
    <button class="px-5 py-2 rounded-full text-sm font-medium bg-white text-black whitespace-nowrap">
      All
    </button>
    <button class="px-5 py-2 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15 whitespace-nowrap transition-colors">
      Albums
    </button>
    <button class="px-5 py-2 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15 whitespace-nowrap transition-colors">
      Artists
    </button>
    <button class="px-5 py-2 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15 whitespace-nowrap transition-colors">
      Playlists
    </button>
  </div>

  <!-- Recently Added Section -->
  <h2 class="text-2xl font-bold mb-5">Recently Added</h2>

  <!-- Empty State -->
  <div class="flex flex-col items-center justify-center py-16 gap-6">
    <div class="w-24 h-24 rounded-3xl bg-hap-surface-light flex items-center justify-center glow-card-purple">
      <span class="material-symbols-outlined text-5xl text-hap-accent-purple">library_music</span>
    </div>
    <div class="text-center">
      <p class="text-lg font-semibold text-white mb-2">Your library is empty</p>
      <p class="text-sm text-hap-text-muted max-w-xs">
        Add a music folder to start building your library. All files stay on your device.
      </p>
    </div>
    <button
      class="px-8 py-3 bg-hap-primary hover:bg-hap-primary-dark rounded-full text-white font-semibold text-sm transition-colors flex items-center gap-2"
      aria-label="Add music folder"
    >
      <span class="material-symbols-outlined text-xl">create_new_folder</span>
      Add Folder
    </button>
  </div>
</div>
