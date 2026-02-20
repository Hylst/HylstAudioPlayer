<script lang="ts">
    import { playlists } from "$lib/audio/playlists.svelte";

    let { show = $bindable(false), onCreated } = $props();

    let name = $state("");
    let description = $state("");
    let isSaving = $state(false);

    async function handleCreate() {
        if (!name.trim()) return;
        isSaving = true;
        try {
            const id = await playlists.create(name, description);
            show = false;
            name = "";
            description = "";
            onCreated?.(id);
        } catch (err) {
            console.error("[PlaylistCreate] Failed:", err);
        } finally {
            isSaving = false;
        }
    }
</script>

{#if show}
    <div
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onclick={() => (show = false)}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Escape" && (show = false)}
    >
        <div
            class="w-full max-w-sm glass-panel-strong rounded-3xl p-8 shadow-2xl space-y-6"
            onclick={(e) => e.stopPropagation()}
            role="none"
        >
            <div class="space-y-2">
                <h2 class="text-2xl font-bold text-white">New Playlist</h2>
                <p class="text-sm text-white/40">
                    Give your collection a name and a vibe.
                </p>
            </div>

            <div class="space-y-4">
                <div class="space-y-1.5">
                    <label
                        for="pl-name"
                        class="text-xs font-bold text-white/30 uppercase tracking-widest px-1"
                        >Name</label
                    >
                    <input
                        id="pl-name"
                        type="text"
                        bind:value={name}
                        placeholder="Chill Mix, Workout..."
                        class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-hap-primary focus:ring-1 focus:ring-hap-primary/30 transition-all"
                    />
                </div>

                <div class="space-y-1.5">
                    <label
                        for="pl-desc"
                        class="text-xs font-bold text-white/30 uppercase tracking-widest px-1"
                        >Description (Optional)</label
                    >
                    <textarea
                        id="pl-desc"
                        bind:value={description}
                        placeholder="A short description..."
                        class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-hap-primary focus:ring-1 focus:ring-hap-primary/30 transition-all resize-none h-24"
                    ></textarea>
                </div>
            </div>

            <div class="flex gap-3 pt-2">
                <button
                    class="flex-1 py-3 rounded-2xl font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all"
                    onclick={() => (show = false)}
                >
                    Cancel
                </button>
                <button
                    class="flex-1 py-3 rounded-2xl font-bold bg-hap-primary text-white shadow-lg shadow-hap-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
                    onclick={handleCreate}
                    disabled={!name.trim() || isSaving}
                >
                    {isSaving ? "Creating..." : "Create"}
                </button>
            </div>
        </div>
    </div>
{/if}
