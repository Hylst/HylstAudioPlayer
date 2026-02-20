<script lang="ts">
  import { player } from "$lib/audio/player.svelte";
  import { formatTime } from "$lib/utils/format";

  // Local state for dragging progress bar to avoid jitter
  let isDraggingConfig = $state(false);
  let dragTime = $state(0);

  function handleSeekStart() {
    isDraggingConfig = true;
    dragTime = player.currentTime;
  }

  function handleSeekInput(e: Event) {
    const target = e.target as HTMLInputElement;
    dragTime = parseFloat(target.value);
  }

  function handleSeekEnd(e: Event) {
    const target = e.target as HTMLInputElement;
    const time = parseFloat(target.value);
    player.seek(time);
    isDraggingConfig = false;
  }

  // Derived display time
  let displayTime = $derived(isDraggingConfig ? dragTime : player.currentTime);
  let duration = $derived(player.duration || 1);
  let progressPercent = $derived((displayTime / duration) * 100);

  function volumeIcon(v: number): string {
    if (v < 0.3) return "volume_mute";
    if (v < 0.7) return "volume_down";
    return "volume_up";
  }
</script>

{#if player.currentTrack}
  <!-- Player bar sits above the nav bar (nav = 4rem / 64px high) -->
  <div
    class="fixed bottom-16 left-0 right-0 z-50 glass-panel border-t border-white/10"
    style="padding-bottom: env(safe-area-inset-bottom, 0px)"
  >
    <!-- Progress Bar -->
    <div class="relative h-1 w-full bg-white/10 cursor-pointer group">
      <div
        class="absolute inset-y-0 left-0 bg-hap-primary pointer-events-none transition-all"
        style="width: {progressPercent}%"
      ></div>
      <!-- Thumb visible on hover -->
      <div
        class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-hap-primary shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all"
        style="left: calc({progressPercent}% - 6px)"
      ></div>
      <input
        type="range"
        min="0"
        max={duration}
        step="0.1"
        value={displayTime}
        onmousedown={handleSeekStart}
        oninput={handleSeekInput}
        onchange={handleSeekEnd}
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label="Seek"
      />
    </div>

    <div class="flex items-center justify-between px-4 md:px-6 h-20 gap-4">
      <!-- Track Info — tap to open fullscreen player -->
      <a
        href="/player"
        class="flex items-center gap-3 w-5/12 min-w-0 group"
        aria-label="Ouvrir le lecteur"
      >
        <!-- Artwork -->
        <div
          class="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-lg relative"
        >
          {#if player.currentTrackArtworkUrl}
            <img
              src={player.currentTrackArtworkUrl}
              alt="Artwork"
              class="w-full h-full object-cover"
            />
          {:else}
            <span
              class="material-symbols-rounded text-white/20 text-2xl"
              style="animation: {player.isPlaying
                ? 'spin 4s linear infinite'
                : 'none'}">album</span
            >
          {/if}
        </div>

        <div class="min-w-0 flex flex-col">
          <div
            class="font-bold text-white truncate text-sm group-hover:text-hap-primary transition-colors"
          >
            {player.currentTrack.title}
          </div>
          <div class="text-xs text-white/50 truncate">
            {player.currentTrack.artist}
          </div>
        </div>
      </a>

      <!-- Controls (Center) -->
      <div class="flex flex-col items-center justify-center gap-1 grow">
        <div class="flex items-center gap-3 md:gap-5">
          <!-- Shuffle (desktop only) -->
          <button
            class="hidden md:flex w-8 h-8 items-center justify-center rounded-full transition-all hover:bg-white/10 {player.shuffleEnabled
              ? 'text-hap-primary'
              : 'text-white/40 hover:text-white'}"
            onclick={() => (player.shuffleEnabled = !player.shuffleEnabled)}
            aria-label="Aléatoire"
          >
            <span class="material-symbols-rounded text-[20px]">shuffle</span>
          </button>

          <!-- Previous -->
          <button
            class="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 hover:scale-110 transition-all"
            onclick={() => player.previous()}
            aria-label="Précédent"
          >
            <span class="material-symbols-rounded text-[26px]"
              >skip_previous</span
            >
          </button>

          <!-- Play/Pause (primary action) -->
          <button
            class="w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white text-hap-bg shadow-lg hover:scale-105 transition-transform"
            onclick={() => player.togglePlay()}
            aria-label={player.isPlaying ? "Pause" : "Lire"}
          >
            <span class="material-symbols-rounded text-[28px] md:text-[30px]">
              {player.isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>

          <!-- Next -->
          <button
            class="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 hover:scale-110 transition-all"
            onclick={() => player.next()}
            aria-label="Suivant"
          >
            <span class="material-symbols-rounded text-[26px]">skip_next</span>
          </button>

          <!-- Repeat (desktop only) -->
          <button
            class="hidden md:flex w-8 h-8 items-center justify-center rounded-full transition-all hover:bg-white/10 {player.repeatMode !==
            'off'
              ? 'text-hap-primary'
              : 'text-white/40 hover:text-white'}"
            onclick={() => {
              const modes = ["off", "all", "one"] as const;
              const idx = modes.indexOf(player.repeatMode);
              player.repeatMode = modes[(idx + 1) % 3];
            }}
            aria-label="Répéter"
          >
            <span class="material-symbols-rounded text-[20px]">
              {player.repeatMode === "one" ? "repeat_one" : "repeat"}
            </span>
          </button>
        </div>

        <!-- Time (Desktop only) -->
        <div class="hidden md:flex text-[11px] text-white/30 gap-1 font-mono">
          <span>{formatTime(displayTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <!-- Volume (Right, desktop only) -->
      <div class="hidden md:flex items-center justify-end gap-3 w-5/12 min-w-0">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
          onclick={() => player.setVolume(player.volume === 0 ? 1 : 0)}
          aria-label="Volume"
        >
          <span class="material-symbols-rounded text-[20px]">
            {player.volume === 0 ? "volume_off" : volumeIcon(player.volume)}
          </span>
        </button>

        <div
          class="relative w-24 h-1 bg-white/10 rounded-full overflow-visible group cursor-pointer"
        >
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-white group-hover:bg-hap-primary transition-colors"
            style="width: {player.volume * 100}%"
          ></div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={player.volume}
            oninput={(e) => player.setVolume(parseFloat(e.currentTarget.value))}
            class="absolute inset-y-0 -top-2 w-full h-5 opacity-0 cursor-pointer"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
