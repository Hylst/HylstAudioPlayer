<script lang="ts">
    import { player } from "$lib/audio/player.svelte";

    let canvas: HTMLCanvasElement | null = $state(null);
    let ctx: CanvasRenderingContext2D | null = null;
    let animationId = 0;

    // ─── Configuration ───
    const BAR_COUNT = 48; // Number of frequency bars
    const BAR_GAP = 2; // px gap between bars
    const MIN_DB = -80; // AnalyserNode minDecibels
    const SMOOTHING = 0.8; // Temporal smoothing
    const MIRROR = true; // Mirror bars from center

    // ─── Smoothed values for animation ───
    let smoothBars = new Float32Array(BAR_COUNT).fill(0);

    function draw(): void {
        if (!canvas || !ctx || !player.visualizer) {
            animationId = requestAnimationFrame(draw);
            return;
        }

        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const rawData = player.visualizer.getFrequencyData(); // Uint8Array [0-255]
        const binCount = rawData.length;
        const step = Math.floor(binCount / BAR_COUNT);
        const barW = (W - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;

        // Smooth and draw bars
        for (let i = 0; i < BAR_COUNT; i++) {
            // Average a range of bins for better visual
            let sum = 0;
            for (let b = 0; b < step; b++) {
                sum += rawData[i * step + b] ?? 0;
            }
            const avg = sum / step;
            const normalized = avg / 255;

            // Temporal smoothing
            smoothBars[i] =
                smoothBars[i] * SMOOTHING + normalized * (1 - SMOOTHING);

            const barH = smoothBars[i] * H;
            const x = i * (barW + BAR_GAP);
            const y = H - barH;

            // Primary color gradient with alpha based on amplitude
            const alpha = 0.3 + smoothBars[i] * 0.7;
            const grd = ctx.createLinearGradient(0, y, 0, H);
            grd.addColorStop(0, `rgba(100, 103, 242, ${alpha})`);
            grd.addColorStop(0.5, `rgba(139, 92, 246, ${alpha * 0.8})`);
            grd.addColorStop(1, `rgba(100, 103, 242, 0.2)`);

            // Rounded top bar
            ctx.beginPath();
            const radius = Math.min(barW / 2, 3);
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + barW - radius, y);
            ctx.arcTo(x + barW, y, x + barW, y + radius, radius);
            ctx.lineTo(x + barW, H);
            ctx.lineTo(x, H);
            ctx.lineTo(x, y + radius);
            ctx.arcTo(x, y, x + radius, y, radius);
            ctx.closePath();
            ctx.fillStyle = grd;
            ctx.fill();

            // Glow for tall bars
            if (smoothBars[i] > 0.5) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = `rgba(100, 103, 242, 0.6)`;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // Soft peak line
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < BAR_COUNT; i++) {
            const barH = smoothBars[i] * H;
            const x = i * (barW + BAR_GAP) + barW / 2;
            const y = H - barH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        animationId = requestAnimationFrame(draw);
    }

    function stopDraw(): void {
        cancelAnimationFrame(animationId);
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        smoothBars.fill(0);
    }

    // React to play/pause state
    $effect(() => {
        if (player.isPlaying) {
            cancelAnimationFrame(animationId);
            draw();
        } else {
            stopDraw();
        }

        return () => {
            cancelAnimationFrame(animationId);
        };
    });

    // Bind canvas and get context
    $effect(() => {
        if (canvas) {
            ctx = canvas.getContext("2d");
        }
    });
</script>

<canvas
    bind:this={canvas}
    width={280}
    height={48}
    class="w-full h-12 rounded-lg"
    style="opacity: 0.9"
    aria-hidden="true"
></canvas>
