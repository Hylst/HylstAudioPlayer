<script lang="ts">
  import { player } from '$lib/audio/player.svelte';
  import { formatTime } from '$lib/utils/format';
  
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
  let duration = $derived(player.duration || 1); // Avoid div by zero
  let progressPercent = $derived((displayTime / duration) * 100);

</script>

{#if player.currentTrack}
  <div class="fixed bottom-0 left-0 right-0 z-50 bg-surface-900/95 backdrop-blur-xl border-t border-white/10 safe-area-bottom">
    
    <!-- Progress Bar (Absolute top) -->
    <div class="group relative h-1 w-full bg-surface-700 cursor-pointer">
       <div 
         class="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-400 to-secondary-400 pointer-events-none"
         style="width: {progressPercent}%"
       ></div>
       <!-- Hover target & Input -->
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

    <div class="flex items-center justify-between p-3 md:px-6 h-20 gap-4">
      
      <!-- Track Info -->
      <div class="flex items-center gap-4 w-1/3 min-w-0">
        <!-- Placeholder Artwork -->
        <div class="w-12 h-12 rounded-md bg-surface-700 flex items-center justify-center shrink-0 shadow-lg border border-white/5 relative overflow-hidden group">
          <span class="material-symbols-rounded text-white/20 text-2xl group-hover:scale-110 transition-transform">music_note</span>
          <!-- TODO: Real artwork blob -->
        </div>
        
        <div class="min-w-0 flex flex-col justify-center">
          <div class="font-bold text-white truncate text-sm md:text-base leading-tight">
            {player.currentTrack.title}
          </div>
          <div class="text-xs md:text-sm text-white/50 truncate leading-tight">
            {player.currentTrack.artist}
          </div>
        </div>
      </div>

      <!-- Controls (Center) -->
      <div class="flex flex-col items-center justify-center w-1/3 shrink-0">
        <div class="flex items-center gap-4 md:gap-6">
          <button 
            class="hidden md:flex btn-icon text-white/50 hover:text-white"
            onclick={() => player.shuffleEnabled = !player.shuffleEnabled}
            aria-label="Shuffle"
            class:text-primary-400={player.shuffleEnabled}
          >
            <span class="material-symbols-rounded text-[20px]">shuffle</span>
          </button>

          <button 
            class="btn-icon text-white hover:scale-110 transition-transform" 
            onclick={() => player.previous()}
            aria-label="Previous"
          >
            <span class="material-symbols-rounded text-[28px]">skip_previous</span>
          </button>

          <button 
            class="btn-icon bg-white text-surface-900 rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center hover:scale-105 transition-transform shadow-glow-white"
            onclick={() => player.togglePlay()}
            aria-label={player.isPlaying ? 'Pause' : 'Play'}
          >
            <span class="material-symbols-rounded text-[28px] md:text-[32px]">
              {player.isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button 
            class="btn-icon text-white hover:scale-110 transition-transform" 
            onclick={() => player.next()}
            aria-label="Next"
          >
            <span class="material-symbols-rounded text-[28px]">skip_next</span>
          </button>

          <button 
            class="hidden md:flex btn-icon text-white/50 hover:text-white"
            onclick={() => {
                const modes = ['off', 'all', 'one'] as const;
                const idx = modes.indexOf(player.repeatMode);
                player.repeatMode = modes[(idx + 1) % 3];
            }}
            aria-label="Repeat"
            class:text-primary-400={player.repeatMode !== 'off'}
          >
            <span class="material-symbols-rounded text-[20px]">
                {player.repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            </span>
          </button>
        </div>
        
        <!-- Time (Desktop only) -->
        <div class="hidden md:flex text-xs text-white/40 mt-1 gap-1 font-mono">
            <span>{formatTime(displayTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
        </div>
      </div>

      <!-- Volume & Extras (Right) -->
      <div class="flex items-center justify-end gap-4 w-1/3 min-w-0">
        <div class="hidden md:flex items-center gap-2 group">
          <button 
             class="btn-icon text-white/50 hover:text-white"
             onclick={() => player.setVolume(player.volume === 0 ? 1 : 0)}
          >
            <span class="material-symbols-rounded text-[20px]">
                {player.volume === 0 ? 'volume_off' : volumeIcon(player.volume)}
            </span>
          </button>
          <div class="w-24 h-1 bg-surface-700 rounded-full relative overflow-hidden">
             <div 
               class="absolute top-0 left-0 h-full bg-white group-hover:bg-primary-400 transition-colors"
               style="width: {player.volume * 100}%"
             ></div>
             <input 
               type="range" min="0" max="1" step="0.01"
               value={player.volume}
               oninput={(e) => player.setVolume(parseFloat(e.currentTarget.value))}
               class="absolute inset-0 opacity-0 cursor-pointer"
               aria-label="Volume"
             />
          </div>
        </div>
        
        <button 
           class="btn-icon text-white/50 hover:text-white" 
           aria-label="Queue"
        >
             <span class="material-symbols-rounded">queue_music</span>
        </button>
      </div>

    </div>
  </div>
{/if}

<script lang="ts">
  // Helper for volume icon
  function volumeIcon(v: number) {
      if (v < 0.3) return 'volume_mute';
      if (v < 0.7) return 'volume_down';
      return 'volume_up';
  }
</script>

<style>
    .safe-area-bottom {
        padding-bottom: env(safe-area-inset-bottom);
    }
</style>
