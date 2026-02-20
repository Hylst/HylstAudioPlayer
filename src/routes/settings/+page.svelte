<script lang="ts">
    import { fsManager } from "$lib/fs/fileSystemManager.svelte";
    import { db } from "$lib/db/database.svelte";
    import { player } from "$lib/audio/player.svelte";

    let trackCount = $state(0);

    // EQ state: 10 bands in dB (-12 to +12)
    // Frequencies: 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz
    const eqFreqs = [
        "32",
        "64",
        "125",
        "250",
        "500",
        "1K",
        "2K",
        "4K",
        "8K",
        "16K",
    ];
    let eqBands = $state<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    let bassBoost = $state(false);
    let surroundSound = $state(false);
    let vocalBoost = $state(false);
    let preampGain = $state(0);

    // Active preset
    let activePreset = $state("Flat");
    const presets: Record<string, number[]> = {
        Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        Rock: [4, 3, -1, -1, 0, 2, 4, 5, 5, 4],
        Jazz: [3, 2, 0, 2, -2, -2, 0, 1, 3, 4],
        Pop: [-1, -1, 0, 2, 4, 4, 2, 0, -1, -2],
        Classic: [4, 3, 3, 2, -1, -1, 0, 2, 3, 4],
        Electronic: [5, 4, 1, 0, -2, 2, 1, 1, 5, 5],
    };

    function applyPreset(name: string): void {
        activePreset = name;
        eqBands = [...(presets[name] ?? presets["Flat"])];
    }

    function bandToPercent(val: number): number {
        return ((val + 12) / 24) * 100;
    }

    function handleBandInput(i: number, e: Event): void {
        const v = parseFloat((e.target as HTMLInputElement).value);
        eqBands = eqBands.map((b, idx) => (idx === i ? v : b));
        activePreset = "Custom";
    }

    // Poll for track count
    $effect(() => {
        const interval = setInterval(async () => {
            trackCount = await db.getTrackCount();
        }, 1000);
        return () => clearInterval(interval);
    });
</script>

<!-- Ambient background -->
<div
    class="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    aria-hidden="true"
>
    <div
        class="absolute top-[-20%] right-[-10%] w-[70%] h-[60%] rounded-full blur-[100px] opacity-15"
        style="background: radial-gradient(circle, var(--hap-primary, #6467f2) 0%, transparent 70%)"
    ></div>
</div>

<div class="relative z-10 flex flex-col min-h-full">
    <!-- Sticky header -->
    <header
        class="sticky top-0 z-20 flex items-center gap-3 px-5 pt-10 pb-4"
        style="background: rgba(10,10,18,0.8); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05)"
    >
        <button
            onclick={() => history.back()}
            class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            aria-label="Go back"
        >
            <span class="material-symbols-rounded text-[22px]">arrow_back</span>
        </button>
        <h1 class="text-xl font-bold text-white tracking-tight flex-1">
            Settings & Equalizer
        </h1>
    </header>

    <main class="flex-1 pb-32 space-y-8 px-4 pt-6">
        <!-- ─── EQ Presets ─── -->
        <section>
            <h2
                class="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 px-1"
            >
                Eq Preset
            </h2>
            <div
                class="flex overflow-x-auto gap-2 pb-2"
                style="scrollbar-width: none"
            >
                {#each Object.keys(presets) as preset}
                    <button
                        class="shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all {activePreset ===
                        preset
                            ? ''
                            : 'text-white/60 hover:text-white hover:bg-white/10'}"
                        style={activePreset === preset
                            ? `background: var(--hap-primary, #6467f2); color: white; box-shadow: 0 0 16px -4px var(--hap-primary-glow, rgba(100,103,242,0.5))`
                            : `background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08)`}
                        onclick={() => applyPreset(preset)}>{preset}</button
                    >
                {/each}
                {#if activePreset === "Custom"}
                    <span
                        class="shrink-0 px-4 py-2 rounded-full text-sm font-semibold"
                        style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.1); color: rgba(255,255,255,0.3)"
                        >Custom</span
                    >
                {/if}
            </div>
        </section>

        <!-- ─── 10-Band EQ ─── -->
        <section>
            <div
                class="rounded-2xl p-5 relative overflow-hidden"
                style="background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%); border: 1px solid rgba(255,255,255,0.07)"
            >
                <!-- Top glow -->
                <div
                    class="absolute top-0 left-0 w-full h-[1px]"
                    style="background: linear-gradient(to right, transparent, var(--hap-primary, #6467f2), transparent); opacity: 0.3"
                ></div>

                <div
                    class="grid grid-cols-10 gap-1 h-52 items-end justify-items-center"
                >
                    {#each eqBands as band, i}
                        {@const heightPct = bandToPercent(band)}
                        <div
                            class="flex flex-col items-center gap-2 h-full justify-end group w-full"
                        >
                            <!-- Slider track + thumb -->
                            <div
                                class="relative w-full h-full flex justify-center items-end py-1"
                            >
                                <!-- Ghost track -->
                                <div
                                    class="absolute w-[3px] h-full rounded-full overflow-hidden"
                                    style="background: rgba(255,255,255,0.04)"
                                >
                                    <!-- Fill indicator -->
                                    <div
                                        class="absolute w-full rounded-full transition-all duration-200"
                                        style="bottom: 0; height: {heightPct}%; background: linear-gradient(to top, var(--hap-primary, #6467f2), rgba(100,103,242,0.4))"
                                    ></div>
                                </div>
                                <!-- Thumb -->
                                <div
                                    class="absolute w-4 h-4 rounded-full transition-all duration-200 z-10 -ml-[1px] group-hover:scale-125"
                                    style="bottom: calc({heightPct}% - 8px); background: var(--hap-primary, #6467f2); border: 2px solid rgba(255,255,255,0.3); box-shadow: 0 0 8px var(--hap-primary-glow, rgba(100,103,242,0.6))"
                                ></div>
                                <!-- Invisible range input -->
                                <input
                                    type="range"
                                    min="-12"
                                    max="12"
                                    step="0.5"
                                    value={band}
                                    oninput={(e) => handleBandInput(i, e)}
                                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    style="writing-mode: vertical-rl; direction: rtl"
                                    aria-label="EQ band {eqFreqs[
                                        i
                                    ]}Hz: {band}dB"
                                />
                            </div>
                            <!-- Frequency label -->
                            <span
                                class="text-[9px] font-medium text-white/30 tracking-tight text-center"
                                >{eqFreqs[i]}</span
                            >
                        </div>
                    {/each}
                </div>

                <div
                    class="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs text-white/30 font-mono"
                >
                    <span>-12 dB</span>
                    <span>0 dB</span>
                    <span>+12 dB</span>
                </div>
            </div>
        </section>

        <!-- ─── Audio Enhancements ─── -->
        <section>
            <h2
                class="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 px-1"
            >
                Audio Enhancements
            </h2>
            <div
                class="rounded-2xl overflow-hidden divide-y"
                style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); divide-color: rgba(255,255,255,0.05)"
            >
                <!-- Bass Boost toggle -->
                <div class="flex items-center gap-4 px-5 py-4">
                    <div
                        class="w-10 h-10 rounded-xl flex items-center justify-center"
                        style="background: rgba(251,146,60,0.15)"
                    >
                        <span
                            class="material-symbols-rounded text-[20px]"
                            style="color: #fb923c">graphic_eq</span
                        >
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-semibold text-white">
                            Bass Boost
                        </div>
                        <div class="text-xs text-white/40">
                            Enhance low-frequency response
                        </div>
                    </div>
                    <button
                        onclick={() => (bassBoost = !bassBoost)}
                        class="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                        style={bassBoost
                            ? `background: var(--hap-primary, #6467f2); box-shadow: 0 0 12px var(--hap-primary-glow, rgba(100,103,242,0.4))`
                            : `background: rgba(255,255,255,0.1)`}
                        role="switch"
                        aria-checked={bassBoost}
                        aria-label="Bass Boost"
                    >
                        <div
                            class="absolute top-1 transition-all duration-300 w-4 h-4 rounded-full bg-white shadow-sm"
                            style="left: {bassBoost ? '26px' : '4px'}"
                        ></div>
                    </button>
                </div>

                <!-- 3D Surround -->
                <div class="flex items-center gap-4 px-5 py-4">
                    <div
                        class="w-10 h-10 rounded-xl flex items-center justify-center"
                        style="background: rgba(139,92,246,0.15)"
                    >
                        <span
                            class="material-symbols-rounded text-[20px]"
                            style="color: #8b5cf6">surround_sound</span
                        >
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-semibold text-white">
                            3D Surround
                        </div>
                        <div class="text-xs text-white/40">
                            Virtual spatial audio effect
                        </div>
                    </div>
                    <button
                        onclick={() => (surroundSound = !surroundSound)}
                        class="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                        style={surroundSound
                            ? `background: var(--hap-primary, #6467f2); box-shadow: 0 0 12px var(--hap-primary-glow, rgba(100,103,242,0.4))`
                            : `background: rgba(255,255,255,0.1)`}
                        role="switch"
                        aria-checked={surroundSound}
                        aria-label="3D Surround"
                    >
                        <div
                            class="absolute top-1 transition-all duration-300 w-4 h-4 rounded-full bg-white shadow-sm"
                            style="left: {surroundSound ? '26px' : '4px'}"
                        ></div>
                    </button>
                </div>

                <!-- Vocal Boost -->
                <div class="flex items-center gap-4 px-5 py-4">
                    <div
                        class="w-10 h-10 rounded-xl flex items-center justify-center"
                        style="background: rgba(34,211,238,0.12)"
                    >
                        <span
                            class="material-symbols-rounded text-[20px]"
                            style="color: #22d3ee">mic</span
                        >
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-semibold text-white">
                            Vocal Boost
                        </div>
                        <div class="text-xs text-white/40">
                            Enhance mid-range clarity
                        </div>
                    </div>
                    <button
                        onclick={() => (vocalBoost = !vocalBoost)}
                        class="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                        style={vocalBoost
                            ? `background: var(--hap-primary, #6467f2); box-shadow: 0 0 12px var(--hap-primary-glow, rgba(100,103,242,0.4))`
                            : `background: rgba(255,255,255,0.1)`}
                        role="switch"
                        aria-checked={vocalBoost}
                        aria-label="Vocal Boost"
                    >
                        <div
                            class="absolute top-1 transition-all duration-300 w-4 h-4 rounded-full bg-white shadow-sm"
                            style="left: {vocalBoost ? '26px' : '4px'}"
                        ></div>
                    </button>
                </div>
            </div>
        </section>

        <!-- ─── Pre-amp Gain ─── -->
        <section>
            <h2
                class="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 px-1"
            >
                Pre-amp Gain
            </h2>
            <div
                class="rounded-2xl p-5"
                style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06)"
            >
                <div class="flex justify-between mb-3">
                    <span class="text-sm text-white/60">Volume Headroom</span>
                    <span
                        class="text-sm font-bold tabular-nums"
                        style="color: var(--hap-primary, #6467f2)"
                        >{preampGain > 0 ? "+" : ""}{preampGain} dB</span
                    >
                </div>
                <div
                    class="relative h-2 rounded-full"
                    style="background: rgba(255,255,255,0.08)"
                >
                    <div
                        class="absolute top-0 left-0 h-full rounded-full"
                        style="width: {((preampGain + 12) / 24) *
                            100}%; background: linear-gradient(to right, var(--hap-primary, #6467f2), rgba(100,103,242,0.5))"
                    ></div>
                    <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        bind:value={preampGain}
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="Pre-amp gain: {preampGain}dB"
                    />
                    <!-- Thumb -->
                    <div
                        class="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white pointer-events-none"
                        style="left: calc({((preampGain + 12) / 24) *
                            100}% - 10px); box-shadow: 0 0 12px var(--hap-primary-glow, rgba(100,103,242,0.6))"
                    ></div>
                </div>
            </div>
        </section>

        <!-- ─── Library Settings ─── -->
        <section>
            <h2
                class="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 px-1"
            >
                Library
            </h2>
            <div
                class="rounded-2xl overflow-hidden"
                style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06)"
            >
                <!-- Music folder -->
                <div class="flex items-center gap-4 px-5 py-4">
                    <div
                        class="w-10 h-10 rounded-xl flex items-center justify-center"
                        style="background: rgba(99,102,241,0.15)"
                    >
                        <span
                            class="material-symbols-rounded text-[20px]"
                            style="color: var(--hap-primary, #6467f2)"
                            >folder_open</span
                        >
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-semibold text-white">
                            Music Folder
                        </div>
                        <div class="text-xs text-white/40 truncate">
                            {fsManager.rootHandle
                                ? fsManager.rootHandle.name
                                : "No folder selected"}
                        </div>
                    </div>
                    <button
                        onclick={() => fsManager.selectRootFolder()}
                        class="px-4 py-2 rounded-full text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                        style="background: var(--hap-primary, #6467f2); box-shadow: 0 0 12px -2px var(--hap-primary-glow, rgba(100,103,242,0.4))"
                    >
                        {fsManager.rootHandle ? "Change" : "Select"}
                    </button>
                </div>

                {#if fsManager.isScanning}
                    <div
                        class="flex items-center gap-4 px-5 py-3 border-t"
                        style="border-color: rgba(255,255,255,0.05); background: rgba(99,102,241,0.08)"
                    >
                        <span
                            class="material-symbols-rounded text-[20px] animate-spin"
                            style="color: var(--hap-primary, #6467f2)"
                            >sync</span
                        >
                        <div class="flex-1">
                            <div class="text-sm font-medium text-white">
                                Scanning library...
                            </div>
                            <div class="text-xs text-white/40">
                                Adding tracks to database
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Stats row -->
                <div
                    class="flex items-center justify-between px-5 py-4 border-t"
                    style="border-color: rgba(255,255,255,0.05)"
                >
                    <span class="text-sm text-white/50"
                        >{trackCount} tracks indexed</span
                    >
                    <div class="flex gap-2">
                        <button
                            class="px-3 py-1.5 rounded-full text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            onclick={() =>
                                db.exportDatabase().then((blob) => {
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `hap_backup_${new Date().toISOString().split("T")[0]}.db`;
                                    a.click();
                                })}
                        >
                            Export DB
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- ─── Save preset ─── -->
        <div class="px-1">
            <button
                class="w-full h-14 rounded-2xl font-bold text-white transition-all active:scale-95 hover:brightness-110"
                style="background: linear-gradient(135deg, var(--hap-primary, #6366f2), rgba(100,103,242,0.6)); border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 0 30px -8px var(--hap-primary-glow, rgba(99,102,241,0.5))"
            >
                Save Preset
            </button>
        </div>
    </main>
</div>
