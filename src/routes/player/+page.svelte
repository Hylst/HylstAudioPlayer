<script lang="ts">
    import { player } from "$lib/audio/player.svelte";
    import { playlists } from "$lib/audio/playlists.svelte";
    import { formatTime } from "$lib/utils/format";
    import VisualizerCanvas from "$lib/../components/player/VisualizerCanvas.svelte";

    let isDragging = $state(false);
    let dragTime = $state(0);
    let showMenu = $state(false);

    function handleSeekStart() {
        isDragging = true;
        dragTime = player.currentTime;
    }

    function handleSeekInput(e: Event) {
        dragTime = parseFloat((e.target as HTMLInputElement).value);
    }

    function handleSeekEnd(e: Event) {
        player.seek(parseFloat((e.target as HTMLInputElement).value));
        isDragging = false;
    }

    let displayTime = $derived(isDragging ? dragTime : player.currentTime);
    let duration = $derived(player.duration || 1);
    let progressPercent = $derived((displayTime / duration) * 100);

    function cycleRepeat(): void {
        const modes = ["off", "all", "one"] as const;
        const idx = modes.indexOf(player.repeatMode);
        player.repeatMode = modes[(idx + 1) % 3];
    }
</script>

<!-- ─── Dynamic Blurred Background ─── -->
<div
    class="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    aria-hidden="true"
>
    {#if player.currentTrackArtworkUrl}
        <div
            class="absolute inset-0 scale-110"
            style="background-image: url('{player.currentTrackArtworkUrl}'); background-size: cover; background-position: center; filter: blur(80px) brightness(0.5); opacity: 0.7;"
        ></div>
    {:else}
        <div
            class="absolute top-0 left-0 w-[60%] h-[60%] rounded-full blur-[120px] opacity-30"
            style="background: var(--hap-primary, #6467f2)"
        ></div>
        <div
            class="absolute bottom-0 right-0 w-[50%] h-[50%] rounded-full blur-[100px] opacity-20"
            style="background: #a855f7"
        ></div>
    {/if}
    <div
        class="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80"
    ></div>
</div>

<div
    class="relative z-10 flex flex-col h-full w-full max-w-md mx-auto select-none"
>
    <!-- ─── Top Bar ─── -->
    <div class="flex items-center justify-between px-5 pt-12 pb-4">
        <button
            onclick={() => history.back()}
            class="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-md"
            aria-label="Go back"
        >
            <span class="material-symbols-rounded text-white/80 text-[24px]"
                >keyboard_arrow_down</span
            >
        </button>
        <div class="flex flex-col items-center">
            <span
                class="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase"
                >Now Playing</span
            >
            {#if player.currentTrack?.album}
                <span class="text-sm font-semibold text-white tracking-wide"
                    >{player.currentTrack.album}</span
                >
            {/if}
        </div>
        <button
            class="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-md"
            aria-label="More options"
            onclick={() => (showMenu = !showMenu)}
        >
            <span class="material-symbols-rounded text-white/80 text-[24px]"
                >more_horiz</span
            >
        </button>
    </div>

    {#if showMenu}
        <!-- ─── Track Options Sheet ─── -->
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-50"
            onclick={() => (showMenu = false)}
        ></div>
        <div
            class="fixed bottom-24 left-4 right-4 z-50 rounded-2xl overflow-hidden"
            style="background: rgba(15,15,25,0.97); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 -8px 40px rgba(0,0,0,0.6)"
        >
            {#if player.currentTrack}
                <div class="px-5 py-4 border-b border-white/5">
                    <p class="font-semibold text-white text-sm truncate">
                        {player.currentTrack.title ?? "Unknown"}
                    </p>
                    <p class="text-xs text-white/40 truncate mt-0.5">
                        {player.currentTrack.artist ?? ""}
                    </p>
                </div>
            {/if}
            <div class="py-1">
                <a
                    href="/track/{player.currentTrack?.id}"
                    onclick={() => (showMenu = false)}
                    class="flex items-center gap-3 px-5 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                    <span
                        class="material-symbols-rounded text-[20px] text-white/40"
                        >info</span
                    >
                    Track Details
                </a>
                <button
                    onclick={() => {
                        player.addToQueue(player.currentTrack!);
                        showMenu = false;
                    }}
                    class="w-full flex items-center gap-3 px-5 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                    <span
                        class="material-symbols-rounded text-[20px] text-white/40"
                        >playlist_add</span
                    >
                    Add to Queue
                </button>
                <button
                    onclick={() => {
                        playlists.toggleFavorite(player.currentTrack!.id);
                        showMenu = false;
                    }}
                    class="w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors"
                    style={playlists.isFavorite(player.currentTrack?.id ?? -1)
                        ? "color:#f43f5e"
                        : "color:rgba(255,255,255,0.8)"}
                >
                    <span
                        class="material-symbols-rounded text-[20px]"
                        style="font-variation-settings: 'FILL' {playlists.isFavorite(
                            player.currentTrack?.id ?? -1,
                        )
                            ? 1
                            : 0}">favorite</span
                    >
                    {playlists.isFavorite(player.currentTrack?.id ?? -1)
                        ? "Remove from Favorites"
                        : "Add to Favorites"}
                </button>
            </div>
        </div>
    {/if}

    {#if player.currentTrack}
        <!-- ─── Album Art ─── -->
        <div
            class="flex-1 flex items-center justify-center px-8 py-4 relative group"
        >
            <div
                class="relative w-full aspect-square max-w-[320px] rounded-[2.5rem] transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                style="box-shadow: 0 20px 60px -10px var(--hap-primary-glow, rgba(100,103,242,0.5));
                  animation: {player.isPlaying
                    ? 'vinyl-spin 20s linear infinite'
                    : 'none'}"
            >
                <!-- Glass border -->
                <div
                    class="absolute -inset-[1px] rounded-[2.5rem] bg-gradient-to-b from-white/30 to-white/5 opacity-100 z-20 pointer-events-none"
                ></div>
                <!-- Artwork -->
                <div
                    class="relative w-full h-full rounded-[2.5rem] overflow-hidden bg-[#191a33] z-10"
                >
                    {#if player.currentTrackArtworkUrl}
                        <img
                            src={player.currentTrackArtworkUrl}
                            alt="Album artwork"
                            class="w-full h-full object-cover"
                        />
                        <!-- Gloss overlay -->
                        <div
                            class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-60 pointer-events-none"
                        ></div>
                    {:else}
                        <div
                            class="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/2"
                        >
                            <span
                                class="material-symbols-rounded text-white/10 select-none"
                                style="font-size: 160px; line-height:1"
                                >album</span
                            >
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- ─── Track Info & Controls ─── -->
        <div class="flex flex-col px-6 pb-10 gap-6">
            <!-- Title + Like -->
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                    <h1
                        class="text-3xl font-bold text-white leading-none tracking-tight truncate"
                        style="text-shadow: 0 0 20px rgba(255,255,255,0.2)"
                    >
                        {player.currentTrack.title ?? "Unknown Track"}
                    </h1>
                    <p
                        class="text-base mt-1 truncate"
                        style="color: var(--hap-primary, #6467f2); opacity: 0.9; font-weight: 500"
                    >
                        {player.currentTrack.artist ?? "Unknown Artist"}
                    </p>
                </div>
                <button
                    class="w-10 h-10 flex items-center justify-center transition-colors flex-shrink-0 mt-1"
                    aria-label={playlists.isFavorite(
                        player.currentTrack?.id ?? -1,
                    )
                        ? "Remove from favorites"
                        : "Add to favorites"}
                    onclick={() =>
                        player.currentTrack &&
                        playlists.toggleFavorite(player.currentTrack.id)}
                    style={playlists.isFavorite(player.currentTrack?.id ?? -1)
                        ? "color: #f43f5e; filter: drop-shadow(0 0 8px rgba(244,63,94,0.5))"
                        : "color: rgba(255,255,255,0.35)"}
                >
                    <span
                        class="material-symbols-rounded text-[26px]"
                        style="font-variation-settings: 'FILL' {playlists.isFavorite(
                            player.currentTrack?.id ?? -1,
                        )
                            ? 1
                            : 0}, 'wght' 400">favorite</span
                    >
                </button>
            </div>

            <!-- ─── Waveform Seeker ─── -->
            <div class="flex flex-col gap-2">
                <!-- Visual waveform bars with seek overlay -->
                <div
                    class="relative h-12 w-full flex items-center gap-[2px] overflow-hidden"
                >
                    <VisualizerCanvas />
                    <!-- Playhead thumb -->
                    <div
                        class="absolute top-0 bottom-0 w-[2px] bg-white rounded-full pointer-events-none"
                        style="left: calc({progressPercent}% - 1px); box-shadow: 0 0 10px rgba(255,255,255,0.8)"
                    ></div>
                    <!-- Invisible range input overlay -->
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
                        aria-label="Seek position"
                    />
                </div>
                <!-- Timestamps -->
                <div
                    class="flex justify-between text-xs font-mono text-white/40 tracking-wider"
                >
                    <span>{formatTime(displayTime)}</span>
                    <span style="color: rgba(255,255,255,0.25)"
                        >-{formatTime(
                            Math.max(0, duration - displayTime),
                        )}</span
                    >
                </div>
            </div>

            <!-- ─── Main Controls ─── -->
            <div class="flex items-center justify-between">
                <!-- Shuffle -->
                <button
                    onclick={() =>
                        (player.shuffleEnabled = !player.shuffleEnabled)}
                    class="p-2 transition-colors {player.shuffleEnabled
                        ? ''
                        : 'text-white/30 hover:text-white/60'}"
                    style={player.shuffleEnabled
                        ? "color: var(--hap-primary, #6467f2)"
                        : ""}
                    aria-label="Shuffle"
                >
                    <span class="material-symbols-rounded text-[26px]"
                        >shuffle</span
                    >
                </button>

                <div class="flex items-center gap-4">
                    <!-- Previous -->
                    <button
                        onclick={() => player.previous()}
                        class="flex items-center justify-center w-14 h-14 rounded-full text-white hover:text-hap-primary transition-all active:scale-90"
                        style="background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04)); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(10px); box-shadow: 0 8px 32px 0 rgba(0,0,0,0.3)"
                        aria-label="Previous"
                    >
                        <span class="material-symbols-rounded text-[30px]"
                            >skip_previous</span
                        >
                    </button>

                    <!-- Play/Pause (big) -->
                    <button
                        onclick={() => player.togglePlay()}
                        class="flex items-center justify-center w-20 h-20 rounded-full transform active:scale-95 transition-all duration-200 hover:scale-105"
                        style="background: linear-gradient(135deg, var(--hap-primary, #6467f2), rgba(100,103,242,0.6)); box-shadow: 0 0 30px rgba(100,103,242,0.5), inset 0 0 20px rgba(255,255,255,0.15); border: 1px solid rgba(160,160,255,0.35)"
                        aria-label={player.isPlaying ? "Pause" : "Play"}
                    >
                        <span
                            class="material-symbols-rounded text-[44px] text-white"
                            >{player.isPlaying ? "pause" : "play_arrow"}</span
                        >
                    </button>

                    <!-- Next -->
                    <button
                        onclick={() => player.next()}
                        class="flex items-center justify-center w-14 h-14 rounded-full text-white hover:text-hap-primary transition-colors"
                        style="background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04)); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(10px); box-shadow: 0 8px 32px 0 rgba(0,0,0,0.3)"
                        aria-label="Next"
                    >
                        <span class="material-symbols-rounded text-[30px]"
                            >skip_next</span
                        >
                    </button>
                </div>

                <!-- Repeat -->
                <button
                    onclick={cycleRepeat}
                    class="p-2 relative transition-colors {player.repeatMode !==
                    'off'
                        ? ''
                        : 'text-white/30 hover:text-white/60'}"
                    style={player.repeatMode !== "off"
                        ? "color: var(--hap-primary, #6467f2)"
                        : ""}
                    aria-label="Repeat mode: {player.repeatMode}"
                >
                    <span class="material-symbols-rounded text-[26px]"
                        >{player.repeatMode === "one"
                            ? "repeat_one"
                            : "repeat"}</span
                    >
                    {#if player.repeatMode !== "off"}
                        <div
                            class="absolute bottom-0 right-1 w-1 h-1 rounded-full"
                            style="background: var(--hap-primary, #6467f2); box-shadow: 0 0 4px var(--hap-primary, #6467f2)"
                        ></div>
                    {/if}
                </button>
            </div>

            <!-- ─── Up Next handle ─── -->
            <div class="flex flex-col items-center gap-2 mt-2">
                {#if player.queue.length > 1}
                    <p
                        class="text-[10px] font-bold text-white/30 tracking-[0.2em] uppercase"
                    >
                        Up Next
                    </p>
                    <div
                        class="w-12 h-1.5 rounded-full bg-white/20"
                        style="box-shadow: 0 0 10px rgba(255,255,255,0.1)"
                    ></div>
                {/if}
            </div>
        </div>
    {:else}
        <!-- No track state -->
        <div
            class="flex flex-col items-center justify-center flex-1 gap-4 py-20 text-center px-6"
        >
            <span class="material-symbols-rounded text-6xl text-white/10"
                >music_off</span
            >
            <p class="text-white/40 text-sm">No track is currently playing.</p>
            <a
                href="/"
                class="px-6 py-2.5 rounded-full text-white text-sm font-semibold transition-colors"
                style="background: var(--hap-primary, #6467f2)"
            >
                Browse Library
            </a>
        </div>
    {/if}
</div>

<!-- Visualizer rings (decorative) -->
<div
    class="fixed bottom-0 left-1/2 -translate-x-1/2 pointer-events-none overflow-hidden"
    aria-hidden="true"
    style="width: 400px; height: 300px;"
>
    <div
        class="absolute bottom-[-120px] left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full visualizer-ring"
        style="border: 1px solid rgba(255,255,255,0.05); opacity: 0.5"
    ></div>
    <div
        class="absolute bottom-[-160px] left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full visualizer-ring-reverse"
        style="border: 1px dashed rgba(255,255,255,0.04); opacity: 0.3"
    ></div>
</div>

<style>
    @keyframes vinyl-spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
    @keyframes spin-slow {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
    @keyframes spin-slow-reverse {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(-360deg);
        }
    }
    .visualizer-ring {
        animation: spin-slow 12s linear infinite;
    }
    .visualizer-ring-reverse {
        animation: spin-slow-reverse 20s linear infinite;
    }
</style>
