<script lang="ts">
	import "./layout.css";
	import PlayerBar from "../components/player/PlayerBar.svelte";
	import { player } from "$lib/audio/player.svelte";
	import { theme } from "$lib/theme/theme.svelte";
	import { registerShortcuts } from "$lib/keyboard/shortcuts";
	import { page } from "$app/stores";
	import { onNavigate } from "$app/navigation";

	let { children } = $props();

	/** Navigation items */
	const navItems = [
		{ icon: "home", label: "Home", href: "/" },
		{ icon: "search", label: "Search", href: "/search" },
		{ icon: "library_music", label: "Library", href: "/library" },
		{ icon: "queue_music", label: "Playlists", href: "/playlists" },
		{ icon: "person", label: "Profile", href: "/profile" },
	] as const;

	let showVisualizer = $derived(!!player.currentTrack);

	// ─── AudioContext pre-warm ─────────────────────────────────────────────────
	// The Web Audio API requires a user gesture before AudioContext can run.
	// We unlock it on the FIRST touch/click anywhere so first-play is instant.
	let audioWarmed = false;
	function warmAudio() {
		if (audioWarmed) return;
		audioWarmed = true;
		try {
			(player as any).engine?.context?.resume?.();
		} catch {}
	}

	// Register warm on first user interaction via window (avoids a11y div-click violation)
	$effect(() => {
		const handler = () => warmAudio();
		window.addEventListener("click", handler, {
			once: true,
			passive: true,
		});
		window.addEventListener("touchstart", handler, {
			once: true,
			passive: true,
		});
		return () => {
			window.removeEventListener("click", handler);
			window.removeEventListener("touchstart", handler);
		};
	});

	theme.init();

	$effect(() => {
		const unregister = registerShortcuts();
		return unregister;
	});

	// ─── View Transitions — smooth page transitions ───────────────────────────
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<title>Hylst Audio Player</title>
</svelte:head>

<div
	class="flex flex-col min-h-dvh bg-hap-bg relative"
	onclick={warmAudio}
	ontouchstart={warmAudio}
>
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
		style="view-transition-name: persistent-ui"
		aria-label="Main navigation"
	>
		<div
			class="flex items-center justify-around max-w-md mx-auto h-16 px-2"
		>
			{#each navItems as item}
				{@const isActive =
					$page.url.pathname === item.href ||
					($page.url.pathname.startsWith(item.href) &&
						item.href !== "/")}
				<a
					href={item.href}
					class="relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors group"
					aria-label={item.label}
					aria-current={isActive ? "page" : undefined}
				>
					<span
						class="material-symbols-rounded transition-all duration-200"
						style="font-size: {isActive ? '28px' : '24px'};
							font-variation-settings: 'FILL' {isActive
							? 1
							: 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24;
							color: {isActive ? 'var(--hap-primary, #6467f2)' : 'rgba(255,255,255,0.4)'}"
					>
						{item.icon}
					</span>
					<span
						class="text-[10px] font-medium transition-all duration-200"
						style="{isActive
							? 'font-weight: 700'
							: ''}; color: {isActive
							? 'var(--hap-primary, #6467f2)'
							: 'rgba(255,255,255,0.4)'}"
					>
						{item.label}
					</span>
					{#if isActive}
						<div
							class="absolute -bottom-0.5 w-1 h-1 rounded-full"
							style="background: var(--hap-primary, #6467f2); box-shadow: 0 0 6px var(--hap-primary, #6467f2)"
						></div>
					{/if}
				</a>
			{/each}

			<!-- Visualizer nav item — shown contextually when a track is loaded -->
			{#if showVisualizer}
				{@const isVizActive = $page.url.pathname === "/visualizer"}
				<a
					href="/visualizer"
					class="relative flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all group"
					aria-label="Visualizer"
					aria-current={isVizActive ? "page" : undefined}
				>
					<!-- Animated pulse ring when playing -->
					{#if player.isPlaying && !isVizActive}
						<div
							class="absolute inset-0 rounded-xl opacity-30"
							style="border: 1px solid var(--hap-primary,#6467f2); animation: ping 2s ease-in-out infinite"
						></div>
					{/if}
					<span
						class="material-symbols-rounded transition-all duration-200"
						style="font-size: {isVizActive ? '28px' : '24px'};
							font-variation-settings: 'FILL' {isVizActive
							? 1
							: 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24;
							color: {isVizActive ? 'var(--hap-primary, #6467f2)' : 'rgba(255,255,255,0.55)'}"
						>graphic_eq</span
					>
					<span
						class="text-[10px] font-medium transition-colors"
						style={isVizActive
							? "color: var(--hap-primary, #6467f2)"
							: "color: rgba(255,255,255,0.55)"}>Viz</span
					>
					{#if isVizActive}
						<div
							class="absolute -bottom-0.5 w-1 h-1 rounded-full"
							style="background: var(--hap-primary, #6467f2); box-shadow: 0 0 6px var(--hap-primary, #6467f2)"
						></div>
					{/if}
				</a>
			{/if}
		</div>
	</nav>
</div>
