<script lang="ts">
    import { player } from "$lib/audio/player.svelte";

    // ─── Feature sections ──────────────────────────────────────────────────────
    const features = [
        {
            icon: "folder_open",
            title: "Local Library",
            desc: "Scan any folder from your device. Your music stays on your device — no upload, no cloud.",
        },
        {
            icon: "graphic_eq",
            title: "Real-time Visualizer",
            desc: "3 modes: frequency bars, circular spectrogram, oscilloscope waveform with live VU meters.",
        },
        {
            icon: "equalizer",
            title: "10-Band EQ",
            desc: "Studio-grade equalizer with presets (Rock, Jazz, Pop, Electronic...) and full manual control.",
        },
        {
            icon: "album",
            title: "Artwork & Metadata",
            desc: "Reads embedded artwork and extended ID3 tags. Rate tracks, add keywords, view lyrics.",
        },
        {
            icon: "queue_music",
            title: "Smart Playlists",
            desc: "Create playlists manually or use smart filters by genre, mood, rating and more.",
        },
        {
            icon: "search",
            title: "Fast Search",
            desc: "Full-text search powered by SQLite FTS5 — finds tracks instantly across your whole library.",
        },
        {
            icon: "offline_pin",
            title: "100% Offline",
            desc: "PWA — installable, works fully offline. No subscription, no account, no tracking.",
        },
        {
            icon: "keyboard",
            title: "Keyboard Shortcuts",
            desc: "Space to play/pause, ← → to seek, ↑ ↓ for volume, N/P for next/previous.",
        },
    ];

    const userGuide = [
        {
            step: 1,
            title: "Import your music",
            icon: "add_circle",
            desc: 'Open Settings → tap "Add Music Folder". Select the folder containing your audio files. HAP scans recursively (MP3, FLAC, OGG, M4A, WAV).',
        },
        {
            step: 2,
            title: "Browse & play",
            icon: "touch_app",
            desc: "On the Home screen, tap a track card to play it. Filters at the top let you switch between All tracks, Albums, Artists, and Playlists.",
        },
        {
            step: 3,
            title: "Now Playing screen",
            icon: "play_circle",
            desc: "Tap the player bar at the bottom to open the full Now Playing screen with artwork, seek bar, and controls.",
        },
        {
            step: 4,
            title: "Visualizer",
            icon: "graphic_eq",
            desc: 'While a track is playing, a "Viz" button appears in the nav. Tap it for the full-screen visualizer with VU meters and switchable modes.',
        },
        {
            step: 5,
            title: "EQ & Settings",
            icon: "settings",
            desc: "The gear icon on the Home screen opens Settings: 10-band EQ with presets, library stats, and folder management.",
        },
        {
            step: 6,
            title: "Track details & keywords",
            icon: "info",
            desc: "Long-press / tap the ⓘ icon on any card to see full metadata: composer, ISRC, mood, lyrics, ReplayGain, and editable keywords.",
        },
    ];
</script>

<!-- Background -->
<div
    class="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    aria-hidden="true"
>
    <div
        class="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] opacity-10"
        style="background: radial-gradient(circle, #6467f2 0%, transparent 70%)"
    ></div>
    <div
        class="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-8"
        style="background: radial-gradient(circle, #a855f7 0%, transparent 70%)"
    ></div>
</div>

<div class="relative z-10 flex flex-col min-h-full">
    <!-- Header -->
    <header
        class="sticky top-0 z-20 px-5 pt-12 pb-4"
        style="background: rgba(10,10,20,0.8); backdrop-filter: blur(20px)"
    >
        <div class="flex items-center gap-3 max-w-lg mx-auto">
            <a
                href="/"
                class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/60"
                aria-label="Back to home"
            >
                <span class="material-symbols-rounded text-[22px]"
                    >arrow_back</span
                >
            </a>
            <h1 class="text-lg font-bold text-white flex-1">About Hylst</h1>
        </div>
    </header>

    <div class="px-5 pb-10 flex flex-col gap-8 max-w-lg mx-auto w-full">
        <!-- ─── Creator card ─────────────────────────────────────────────────────── -->
        <section
            class="rounded-3xl p-6 flex flex-col items-center text-center gap-4 mt-2"
            style="background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1)); border: 1px solid rgba(99,102,241,0.25)"
        >
            <!-- App icon -->
            <div
                class="w-20 h-20 rounded-[1.75rem] flex items-center justify-center shadow-xl"
                style="background: linear-gradient(135deg, #6467f2, #a855f7); box-shadow: 0 12px 40px -8px rgba(100,103,242,0.5)"
            >
                <span
                    class="material-symbols-rounded text-white text-[44px]"
                    style="font-variation-settings: 'FILL' 1">headphones</span
                >
            </div>

            <div>
                <h2 class="text-2xl font-black text-white">
                    Hylst Audio Player
                </h2>
                <p class="text-sm text-white/40 mt-1">Version 0.1 · 2025</p>
            </div>

            <p class="text-sm text-white/60 leading-relaxed max-w-xs">
                A premium, privacy-first PWA music player for your local
                collection. No cloud. No tracking. Just great audio.
            </p>

            <!-- Creator info -->
            <div
                class="rounded-2xl px-5 py-3 w-full"
                style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08)"
            >
                <p
                    class="text-xs text-white/35 uppercase tracking-widest font-semibold mb-2"
                >
                    Creator
                </p>
                <p class="text-base font-bold text-white">Geoffroy Streit</p>
                <p class="text-sm text-white/50 mt-0.5">
                    aka <span
                        style="color: var(--hap-primary,#6467f2)"
                        class="font-semibold">Hylst</span
                    >
                </p>
                <p class="text-xs text-white/35 mt-2 leading-relaxed">
                    French developer & music enthusiast. Built with ❤️ +
                    SvelteKit, SQLite WASM & Web Audio API.
                </p>
                <div class="flex items-center justify-center gap-3 mt-3">
                    <a
                        href="https://github.com/Hylst"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-white/10"
                        style="border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.6)"
                    >
                        <span class="material-symbols-rounded text-[14px]"
                            >code</span
                        >
                        GitHub
                    </a>
                </div>
            </div>
        </section>

        <!-- ─── Tech stack ───────────────────────────────────────────────────────── -->
        <section>
            <h3
                class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
            >
                Built with
            </h3>
            <div class="flex flex-wrap gap-2">
                {#each ["SvelteKit 5 Runes", "SQLite WASM", "Web Audio API", "OPFS", "music-metadata", "Tailwind CSS", "Material Symbols", "TypeScript"] as tech}
                    <span
                        class="px-3 py-1.5 rounded-full text-xs font-medium"
                        style="background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); color: rgba(180,182,255,0.9)"
                    >
                        {tech}
                    </span>
                {/each}
            </div>
        </section>

        <!-- ─── Features grid ────────────────────────────────────────────────────── -->
        <section>
            <h3
                class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-4"
            >
                Features
            </h3>
            <div class="grid grid-cols-2 gap-3">
                {#each features as feat}
                    <div
                        class="rounded-2xl p-4 flex flex-col gap-2"
                        style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
                    >
                        <span
                            class="material-symbols-rounded text-[22px]"
                            style="color: var(--hap-primary,#6467f2); font-variation-settings: 'FILL' 1"
                        >
                            {feat.icon}
                        </span>
                        <p
                            class="text-sm font-semibold text-white leading-tight"
                        >
                            {feat.title}
                        </p>
                        <p class="text-xs text-white/40 leading-relaxed">
                            {feat.desc}
                        </p>
                    </div>
                {/each}
            </div>
        </section>

        <!-- ─── User Guide ───────────────────────────────────────────────────────── -->
        <section>
            <h3
                class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-4"
            >
                User Guide
            </h3>
            <div class="flex flex-col gap-3">
                {#each userGuide as guide}
                    <div
                        class="flex gap-4 rounded-2xl p-4"
                        style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07)"
                    >
                        <!-- Step number + icon -->
                        <div
                            class="flex-shrink-0 flex flex-col items-center gap-1"
                        >
                            <div
                                class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white"
                                style="background: var(--hap-primary,#6467f2)"
                            >
                                {guide.step}
                            </div>
                        </div>
                        <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-2">
                                <span
                                    class="material-symbols-rounded text-[16px] text-white/50"
                                    >{guide.icon}</span
                                >
                                <p class="text-sm font-semibold text-white">
                                    {guide.title}
                                </p>
                            </div>
                            <p class="text-xs text-white/45 leading-relaxed">
                                {guide.desc}
                            </p>
                        </div>
                    </div>
                {/each}
            </div>
        </section>

        <!-- ─── Keyboard shortcuts ──────────────────────────────────────────────── -->
        <section>
            <h3
                class="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3"
            >
                Keyboard Shortcuts
            </h3>
            <div
                class="rounded-2xl overflow-hidden"
                style="border: 1px solid rgba(255,255,255,0.07)"
            >
                {#each [{ key: "Space", action: "Play / Pause" }, { key: "← →", action: "Seek −5s / +5s" }, { key: "↑ ↓", action: "Volume +5% / −5%" }, { key: "N", action: "Next track" }, { key: "P", action: "Previous track" }, { key: "M", action: "Mute / Unmute" }, { key: "S", action: "Toggle shuffle" }, { key: "R", action: "Cycle repeat mode" }] as shortcut, idx}
                    <div
                        class="flex items-center justify-between px-4 py-3"
                        style="{idx > 0
                            ? 'border-top: 1px solid rgba(255,255,255,0.05);'
                            : ''} background: rgba(255,255,255,{idx % 2 === 0
                            ? '0.03'
                            : '0.015'})"
                    >
                        <kbd
                            class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
                            style="background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: rgba(180,182,255,1)"
                        >
                            {shortcut.key}
                        </kbd>
                        <span class="text-sm text-white/65"
                            >{shortcut.action}</span
                        >
                    </div>
                {/each}
            </div>
        </section>

        <!-- ─── Footer ───────────────────────────────────────────────────────────── -->
        <div class="text-center py-4">
            <p class="text-xs text-white/20">
                Hylst Audio Player · Open Source · MIT License
            </p>
            <p class="text-xs text-white/15 mt-1">
                Made with passion for music & code
            </p>
        </div>
    </div>
</div>
