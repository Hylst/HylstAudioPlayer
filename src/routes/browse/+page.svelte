<script lang="ts">
  import { fsManager } from '$lib/fs/fileSystemManager.svelte';
  import { player } from '$lib/audio/player.svelte';
  import { formatTime } from '$lib/utils/format';

  const AUDIO_EXTS = new Set(['mp3', 'flac', 'ogg', 'opus', 'm4a', 'wav', 'wma', 'aac']);

  type Entry = {
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemFileHandle | FileSystemDirectoryHandle;
    ext?: string;
    isAudio?: boolean;
  };

  // Breadcrumb stack: each item = { name, handle }
  let stack = $state<Array<{ name: string; handle: FileSystemDirectoryHandle }>>([]);
  let entries = $state<Entry[]>([]);
  let loading = $state(false);
  let error = $state('');

  // Current directory is top of stack, or null for root view
  let currentDir = $derived(stack.length > 0 ? stack[stack.length - 1] : null);
  let currentName = $derived(currentDir?.name ?? 'My Music');

  // Load root folders on mount
  $effect(() => {
    if (stack.length === 0) loadRoot();
  });

  async function loadRoot() {
    loading = true;
    error = '';
    try {
      const roots = fsManager.rootHandles;
      if (roots.length === 0) {
        entries = [];
      } else if (roots.length === 1) {
        // Auto-enter the single root
        await enterDir(roots[0]);
        return;
      } else {
        // Show multiple roots as top-level items
        entries = roots.map(h => ({
          name: h.name,
          kind: 'directory' as const,
          handle: h
        }));
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function enterDir(handle: FileSystemDirectoryHandle) {
    loading = true;
    error = '';
    try {
      // Request permission if needed
      // @ts-ignore
      const perm = await handle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') {
        // @ts-ignore
        const req = await handle.requestPermission({ mode: 'read' });
        if (req !== 'granted') throw new Error('Permission denied');
      }

      const items: Entry[] = [];
      // @ts-ignore
      for await (const entry of handle.values()) {
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        items.push({
          name: entry.name,
          kind: entry.kind,
          handle: entry,
          ext,
          isAudio: entry.kind === 'file' && AUDIO_EXTS.has(ext)
        });
      }
      // Sort: directories first, then alphabetical
      items.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      stack = [...stack, { name: handle.name, handle }];
      entries = items;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function goBack() {
    if (stack.length === 0) return;
    const newStack = stack.slice(0, -1);
    stack = newStack;
    if (newStack.length === 0) {
      loadRoot();
    } else {
      // Re-enter the parent (bypass adding to stack again)
      const parent = newStack[newStack.length - 1].handle;
      reloadDir(parent);
    }
  }

  async function reloadDir(handle: FileSystemDirectoryHandle) {
    loading = true;
    error = '';
    try {
      const items: Entry[] = [];
      // @ts-ignore
      for await (const entry of handle.values()) {
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        items.push({ name: entry.name, kind: entry.kind, handle: entry, ext, isAudio: entry.kind === 'file' && AUDIO_EXTS.has(ext) });
      }
      items.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      entries = items;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function playFile(entry: Entry) {
    if (!entry.isAudio) return;
    const fh = entry.handle as FileSystemFileHandle;
    try {
      const file = await fh.getFile();
      // Build a minimal Track object for the player
      const track = {
        id: 0,
        file_path: entry.name,
        title: entry.name.replace(/\.[^.]+$/, ''),
        artist: null,
        album: null,
        duration: 0,
        artwork_hash: null,
        // Provide a direct getFile hook so player can load it
        _fileHandle: fh
      } as any;

      // Read as ArrayBuffer and decode directly
      const buf = await file.arrayBuffer();
      player.isPlaying && (await player.togglePlay()); // stop current
      // Temporarily hijack the engine
      (player as any).currentTrack = track;
      await (player as any).engine.loadTrack(buf);
      await (player as any).engine.play();
      player.isPlaying = true;
      player.duration = (player as any).engine.getDuration();
      player.currentTime = 0;
      (player as any).startTimer();
    } catch (e: any) {
      console.error('[Browse] Failed to play file:', e);
    }
  }

  function iconFor(entry: Entry): string {
    if (entry.kind === 'directory') return 'folder';
    if (entry.isAudio) return 'audio_file';
    const ext = entry.ext ?? '';
    if (['jpg','jpeg','png','gif','webp','avif'].includes(ext)) return 'image';
    return 'draft';
  }

  function colorFor(entry: Entry): string {
    if (entry.kind === 'directory') return '#f59e0b'; // amber
    if (entry.isAudio) return 'var(--hap-primary, #6467f2)';
    return 'rgba(255,255,255,0.3)';
  }

  const audioCount = $derived(entries.filter(e => e.isAudio).length);
  const dirCount = $derived(entries.filter(e => e.kind === 'directory').length);
</script>

<svelte:head>
  <title>Browse Files — Hylst Music Player</title>
</svelte:head>

<div class="flex flex-col min-h-full bg-transparent">
  <!-- Header -->
  <header class="sticky top-0 z-30 flex items-center gap-3 px-4 pt-12 pb-4
                 bg-gradient-to-b from-[rgba(255,255,255,0.07)] to-transparent
                 backdrop-blur-[30px] border-b border-white/8">
    {#if stack.length > 0}
      <button
        onclick={goBack}
        class="flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Go back"
      >
        <span class="material-symbols-rounded text-[22px]">arrow_back</span>
      </button>
    {:else}
      <a href="/" class="flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors" aria-label="Home">
        <span class="material-symbols-rounded text-[22px]">arrow_back</span>
      </a>
    {/if}

    <div class="flex-1 min-w-0">
      <h1 class="font-bold text-[1.1rem] text-white truncate">{currentName}</h1>
      {#if !loading && entries.length > 0}
        <p class="text-xs text-white/35">{dirCount} folders · {audioCount} audio files</p>
      {/if}
    </div>

    {#if fsManager.rootHandles.length === 0}
      <button
        onclick={() => fsManager.addFolder()}
        class="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
        style="background: linear-gradient(135deg,#6366f1,#8b5cf6)"
      >
        Add Folder
      </button>
    {/if}
  </header>

  <!-- Breadcrumb -->
  {#if stack.length > 1}
    <div class="flex items-center gap-1 px-4 py-2 overflow-x-auto no-scrollbar">
      <button onclick={loadRoot} class="text-xs text-white/40 hover:text-white/70 transition-colors shrink-0">Root</button>
      {#each stack as crumb, i}
        <span class="material-symbols-rounded text-[14px] text-white/20 shrink-0">chevron_right</span>
        {#if i === stack.length - 1}
          <span class="text-xs text-white/80 font-semibold truncate shrink-0">{crumb.name}</span>
        {:else}
          <button
            onclick={() => {
              stack = stack.slice(0, i + 1);
              reloadDir(crumb.handle);
            }}
            class="text-xs text-white/40 hover:text-white/70 transition-colors shrink-0"
          >{crumb.name}</button>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Content -->
  <main class="flex-1 px-4 py-2 pb-6">
    {#if error}
      <div class="flex flex-col items-center gap-3 py-16 text-center">
        <span class="material-symbols-rounded text-4xl text-red-400">error</span>
        <p class="text-sm text-white/60">{error}</p>
        <button onclick={loadRoot} class="text-xs text-indigo-400 underline">Go to root</button>
      </div>
    {:else if loading}
      <div class="flex flex-col gap-2 pt-4">
        {#each Array(8) as _}
          <div class="flex items-center gap-3 px-3 py-3 rounded-xl" style="background:rgba(255,255,255,0.03)">
            <div class="w-9 h-9 rounded-lg animate-pulse" style="background:rgba(255,255,255,0.07)"></div>
            <div class="flex-1">
              <div class="h-3 rounded-full w-2/3 animate-pulse" style="background:rgba(255,255,255,0.06)"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if entries.length === 0 && fsManager.rootHandles.length === 0}
      <div class="flex flex-col items-center gap-5 py-20 text-center">
        <span class="material-symbols-rounded text-6xl" style="color:rgba(255,255,255,0.15)">folder_off</span>
        <p class="text-sm text-white/40">No music folders added yet.</p>
        <button
          onclick={() => fsManager.addFolder()}
          class="px-5 py-2.5 rounded-full text-sm font-semibold text-white"
          style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"
        >Add Folder</button>
      </div>
    {:else if entries.length === 0}
      <div class="flex flex-col items-center gap-4 py-20 text-center">
        <span class="material-symbols-rounded text-5xl" style="color:rgba(255,255,255,0.15)">folder_open</span>
        <p class="text-sm text-white/40">This folder is empty.</p>
      </div>
    {:else}
      <div class="flex flex-col gap-1">
        {#each entries as entry}
          {#if entry.kind === 'directory'}
            <button
              onclick={() => enterDir(entry.handle as FileSystemDirectoryHandle)}
              class="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left transition-all hover:bg-white/5 active:scale-[0.98]"
            >
              <span
                class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style="background:rgba(245,158,11,0.12)"
              >
                <span class="material-symbols-rounded text-[20px]" style="color:{colorFor(entry)}">
                  {iconFor(entry)}
                </span>
              </span>
              <span class="flex-1 min-w-0 text-sm font-medium text-white/85 truncate">{entry.name}</span>
              <span class="material-symbols-rounded text-[18px] text-white/20">chevron_right</span>
            </button>
          {:else if entry.isAudio}
            <button
              onclick={() => playFile(entry)}
              class="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left transition-all hover:bg-white/5 active:scale-[0.98] group"
              class:bg-white/8={player.currentTrack?.title === entry.name.replace(/\.[^.]+$/, '')}
            >
              <span
                class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style="background:rgba(99,102,241,0.12)"
              >
                <span class="material-symbols-rounded text-[20px] group-hover:text-indigo-300 transition-colors" style="color:{colorFor(entry)}">
                  {iconFor(entry)}
                </span>
              </span>
              <span class="flex-1 min-w-0 text-sm font-medium text-white/85 truncate">{entry.name}</span>
              <span class="material-symbols-rounded text-[16px] text-white/20 group-hover:text-white/50 transition-colors">play_arrow</span>
            </button>
          {:else}
            <!-- Non-audio file — greyed out, not interactive -->
            <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-40">
              <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background:rgba(255,255,255,0.04)">
                <span class="material-symbols-rounded text-[18px] text-white/40">{iconFor(entry)}</span>
              </span>
              <span class="flex-1 min-w-0 text-sm text-white/50 truncate">{entry.name}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </main>
</div>
