<script lang="ts">
    import { onMount } from "svelte";
    import { player } from "$lib/audio/player.svelte";

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null;
    let animationId: number;

    const BAR_COUNT = 32;
    const BAR_WIDTH = 4;
    const BAR_GAP = 2;

    function draw() {
        if (!ctx || !player.visualizer) return;

        // Check if we should draw
        if (!player.isPlaying) {
            // Clear canvas or draw idle state
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // animationId = requestAnimationFrame(draw);
            // Don't loop if paused to save battery?
            // Maybe loop slowly or just stop.
            // Let keeps it running for fade out?
            // For now, stop loop if paused?
            // But "isPlaying" might toggle.
            // We should animate if playing.
            // And maybe once to clear.
            return;
        }

        const data = player.visualizer.getFrequencyData();
        // data is 0-255, 1024 bins usually.
        // We want 32 bars.
        // We can sample or average.

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const step = Math.floor(data.length / BAR_COUNT);

        for (let i = 0; i < BAR_COUNT; i++) {
            const value = data[i * step]; // simple sampling
            const percent = value / 255;
            const height = percent * canvas.height;

            const x = i * (BAR_WIDTH + BAR_GAP);
            const y = canvas.height - height;

            ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + percent * 0.8})`;
            ctx.fillRect(x, y, BAR_WIDTH, height);
        }

        animationId = requestAnimationFrame(draw);
    }

    $effect(() => {
        if (player.isPlaying) {
            draw();
        } else {
            cancelAnimationFrame(animationId);
            // clear
            if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });

    onMount(() => {
        ctx = canvas.getContext("2d");
        return () => cancelAnimationFrame(animationId);
    });
</script>

<canvas
    bind:this={canvas}
    width={BAR_COUNT * (BAR_WIDTH + BAR_GAP)}
    height="40"
    class="opacity-50"
></canvas>
