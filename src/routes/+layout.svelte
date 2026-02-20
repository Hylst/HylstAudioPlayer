<script lang="ts">
	import "./layout.css";
	import PlayerBar from "../components/player/PlayerBar.svelte";
	import { player } from "$lib/audio/player.svelte";
	import { theme } from "$lib/theme/theme.svelte";
	import { registerShortcuts } from "$lib/keyboard/shortcuts";

	let { children } = $props();

	/** Navigation items matching Stitch mockups */
	const navItems = [
		{ icon: "home", label: "Home", href: "/" },
		{ icon: "search", label: "Search", href: "/search" },
		{ icon: "library_music", label: "Library", href: "/library" },
		{ icon: "person", label: "Profile", href: "/profile" },
	] as const;

	// Initialize theme reactive effect (must run in Svelte component context)
	theme.init();

	// Register global keyboard shortcuts; cleanup on destroy
	$effect(() => {
		const unregister = registerShortcuts();
		return unregister;
	});
</script>

<svelte:head>
	<title>Hylst Audio Player</title>
</svelte:head>

<div class="flex flex-col min-h-dvh bg-hap-bg relative">
	<!-- Main Content Area -->
	<!-- When a track plays: PlayerBar (80px) + NavBar (64px) = 144px → pb-36 -->
	<!-- No track: only NavBar (64px) → pb-16 -->
	<main
		class="flex-1 overflow-y-auto no-scrollbar"
		class:pb-36={!!player.currentTrack}
		class:pb-16={!player.currentTrack}
	>
		{@render children()}
	</main>

	<!-- Player Bar (Persistent) -->
	<PlayerBar />

	<!-- Bottom Navigation Bar (Visible only if no track playing, or if we decide to stack) 
       For now, let's hide it when player is active to avoid clutter on mobile 
       since PlayerBar provides controls.
       In a future iteration, we can make a MiniPlayer that sits above the Nav.
  -->
	<!-- Bottom Navigation Bar (persistent) -->
	<nav
		class="fixed bottom-0 left-0 right-0 z-40 glass-panel-strong border-t border-white/10"
		aria-label="Main navigation"
	>
		<div
			class="flex items-center justify-around max-w-md mx-auto h-16 px-4"
		>
			{#each navItems as item}
				<a
					href={item.href}
					class="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors group"
					aria-label={item.label}
				>
					<span
						class="material-symbols-rounded text-[26px] text-hap-text-muted group-hover:text-hap-primary transition-colors"
					>
						{item.icon}
					</span>
					<span
						class="text-[10px] font-medium text-hap-text-muted group-hover:text-hap-primary transition-colors"
					>
						{item.label}
					</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
