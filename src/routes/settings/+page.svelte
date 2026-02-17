<script lang="ts">
    import { fsManager } from "$lib/fs/fileSystemManager.svelte";
    import { db } from "$lib/db/database.svelte";

    let trackCount = $state(0);

    // Poll for track count (temporary until we have reactive live queries)
    $effect(() => {
        const interval = setInterval(async () => {
            trackCount = await db.getTrackCount();
        }, 1000);
        return () => clearInterval(interval);
    });
</script>

<div class="p-6 max-w-4xl mx-auto space-y-8">
    <header class="border-b border-white/10 pb-4">
        <h1
            class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-secondary-400"
        >
            Settings
        </h1>
        <p class="text-white/60 mt-1">Manage your library and preferences</p>
    </header>

    <!-- Library Management -->
    <section class="space-y-4">
        <h2 class="text-xl font-semibold flex items-center gap-2">
            <span class="material-symbols-rounded text-primary-400"
                >library_music</span
            >
            Library
        </h2>

        <div class="glass p-6 rounded-xl space-y-4">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="font-medium">Music Folder</h3>
                    <p class="text-sm text-white/50">
                        {fsManager.rootHandle
                            ? fsManager.rootHandle.name
                            : "No folder selected"}
                    </p>
                </div>
                <button
                    class="btn-primary flex items-center gap-2"
                    onclick={() => fsManager.selectRootFolder()}
                >
                    <span class="material-symbols-rounded">folder_open</span>
                    {fsManager.rootHandle ? "Change Folder" : "Select Folder"}
                </button>
            </div>

            {#if fsManager.isScanning}
                <div
                    class="bg-primary-500/10 p-4 rounded-lg flex items-center gap-4 animate-pulse"
                >
                    <span class="material-symbols-rounded text-primary-400 spin"
                        >sync</span
                    >
                    <div class="flex-1">
                        <p class="text-sm font-medium text-primary-300">
                            Scanning library...
                        </p>
                        <p class="text-xs text-white/40">
                            Adding tracks to database
                        </p>
                    </div>
                </div>
            {/if}

            <div
                class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5"
            >
                <div class="text-center p-4 bg-surface-800 rounded-lg">
                    <div class="text-2xl font-bold text-white">
                        {trackCount}
                    </div>
                    <div class="text-xs text-white/50 uppercase tracking-wider">
                        Tracks
                    </div>
                </div>
                <div class="text-center p-4 bg-surface-800 rounded-lg">
                    <div class="text-2xl font-bold text-white">
                        {fsManager.rootHandle ? "Local" : "-"}
                    </div>
                    <div class="text-xs text-white/50 uppercase tracking-wider">
                        Source
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Database Actions -->
    <section class="space-y-4">
        <h2 class="text-xl font-semibold flex items-center gap-2">
            <span class="material-symbols-rounded text-secondary-400"
                >database</span
            >
            Database
        </h2>

        <div class="glass p-6 rounded-xl space-y-4">
            <div class="flex gap-2">
                <button
                    class="btn-ghost text-sm text-white/70 hover:text-white"
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
                <button
                    class="btn-ghost text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                    Reset Library
                </button>
            </div>
        </div>
    </section>
</div>

<style>
    .spin {
        animation: spin 2s linear infinite;
    }
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
