<script lang="ts">
    import { player } from "$lib/audio/player.svelte";
    import { goto } from "$app/navigation";
    import { formatTime } from "$lib/utils/format";

    // ─── Visualizer Mode ────────────────────────────────────────────────────────
    type VisMode = "bars" | "circular" | "scope" | "vu";
    let mode = $state<VisMode>("bars");

    // ─── Canvas refs ─────────────────────────────────────────────────────────────
    let canvas = $state<HTMLCanvasElement | null>(null);
    let vuCanvas = $state<HTMLCanvasElement | null>(null);
    let milkCanvas = $state<HTMLCanvasElement | null>(null);
    let milkContainer = $state<HTMLDivElement | null>(null);

    // ─── VU peak hold ────────────────────────────────────────────────────────────
    let peakL = $state(0);
    let peakR = $state(0);
    let peakLHold = 0;
    let peakRHold = 0;
    const PEAK_HOLD_MS = 1200;
    let peakLTimer = 0;
    let peakRTimer = 0;

    // ─── Smoothed FFT bars ────────────────────────────────────────────────────────
    const BAR_COUNT = 64;
    const smoothed = new Float32Array(BAR_COUNT).fill(0);
    const SMOOTH = 0.82;

    // ─── Animation loop ───────────────────────────────────────────────────────────
    let rafId = 0;

    function drawBars(
        ctx: CanvasRenderingContext2D,
        W: number,
        H: number,
        freq: Uint8Array<ArrayBuffer>,
    ) {
        const barW = W / BAR_COUNT - 1;

        for (let i = 0; i < BAR_COUNT; i++) {
            const binIdx = Math.floor((i / BAR_COUNT) * freq.length * 0.75);
            const raw = freq[binIdx] / 255;
            smoothed[i] = smoothed[i] * SMOOTH + raw * (1 - SMOOTH);

            const barH = smoothed[i] * H;
            const x = i * (W / BAR_COUNT);
            const y = H - barH;

            const alpha = 0.4 + smoothed[i] * 0.6;
            const grd = ctx.createLinearGradient(0, y, 0, H);
            grd.addColorStop(0, `rgba(100,103,242,${alpha})`);
            grd.addColorStop(0.5, `rgba(168,85,247,${alpha * 0.8})`);
            grd.addColorStop(1, `rgba(100,103,242,0.15)`);

            const r = Math.min(barW / 2, 4);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + barW - r, y);
            ctx.arcTo(x + barW, y, x + barW, y + r, r);
            ctx.lineTo(x + barW, H);
            ctx.lineTo(x, H);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
            ctx.fillStyle = grd;

            // Glow on loud bars
            if (smoothed[i] > 0.55) {
                ctx.shadowBlur = 12 + smoothed[i] * 20;
                ctx.shadowColor = `rgba(100,103,242,${smoothed[i]})`;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fill();

            // Peak dot
            if (smoothed[i] > 0.05) {
                ctx.fillStyle = `rgba(255,255,255,${smoothed[i] * 0.6})`;
                ctx.fillRect(x, y - 2, barW, 2);
            }
        }
        ctx.shadowBlur = 0;
    }

    function drawCircular(
        ctx: CanvasRenderingContext2D,
        W: number,
        H: number,
        freq: Uint8Array<ArrayBuffer>,
    ) {
        const cx = W / 2;
        const cy = H / 2;
        const baseR = Math.min(W, H) * 0.22;

        for (let i = 0; i < BAR_COUNT; i++) {
            const binIdx = Math.floor((i / BAR_COUNT) * freq.length * 0.75);
            const raw = freq[binIdx] / 255;
            smoothed[i] = smoothed[i] * SMOOTH + raw * (1 - SMOOTH);

            const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
            const barLen = smoothed[i] * Math.min(W, H) * 0.28;
            const innerR = baseR;
            const outerR = baseR + barLen;

            const x1 = cx + Math.cos(angle) * innerR;
            const y1 = cy + Math.sin(angle) * innerR;
            const x2 = cx + Math.cos(angle) * outerR;
            const y2 = cy + Math.sin(angle) * outerR;

            const hue = 240 + (i / BAR_COUNT) * 80; // indigo → purple
            const alpha = 0.4 + smoothed[i] * 0.6;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `hsla(${hue},80%,65%,${alpha})`;
            ctx.lineWidth = (W / BAR_COUNT) * 0.7;
            ctx.lineCap = "round";

            if (smoothed[i] > 0.5) {
                ctx.shadowBlur = 10 + smoothed[i] * 18;
                ctx.shadowColor = `hsla(${hue},80%,65%,0.7)`;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Inner glow ring
        const ringAlpha =
            0.1 + (smoothed.reduce((a, b) => a + b, 0) / BAR_COUNT) * 0.3;
        const grd = ctx.createRadialGradient(
            cx,
            cy,
            baseR * 0.5,
            cx,
            cy,
            baseR,
        );
        grd.addColorStop(0, `rgba(100,103,242,${ringAlpha})`);
        grd.addColorStop(1, `rgba(168,85,247,0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
    }

    function drawScope(
        ctx: CanvasRenderingContext2D,
        W: number,
        H: number,
        time: Uint8Array<ArrayBuffer>,
    ) {
        const avg =
            time.reduce((a, b) => a + Math.abs(b - 128), 0) / time.length / 128;
        const hue = 240 - avg * 60; // calm blue → energetic green
        const alpha = 0.7 + avg * 0.3;

        ctx.beginPath();
        for (let i = 0; i < time.length; i++) {
            const x = (i / time.length) * W;
            const y = H / 2 + ((time[i] - 128) / 128) * (H / 2 - 16);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = `hsla(${hue},85%,65%,${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = 12 + avg * 24;
        ctx.shadowColor = `hsla(${hue},85%,65%,0.6)`;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Zero line
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
    }

    function drawVU(
        ctx: CanvasRenderingContext2D,
        W: number,
        H: number,
        level: number,
    ) {
        const now = performance.now();
        const SEGMENTS = 28;
        const segW = W / (SEGMENTS + 1);
        const padY = 4;
        const barH = (H - padY * 2) / 2 - 2;

        // Simulate stereo from mono with slight offset
        const lv = Math.min(1, level * 1.5);
        const rv = Math.min(1, level * 1.35);

        // Peak logic
        if (lv >= peakLHold) {
            peakLHold = lv;
            peakLTimer = now + PEAK_HOLD_MS;
        }
        if (now > peakLTimer) peakLHold = Math.max(0, peakLHold - 0.01);
        if (rv >= peakRHold) {
            peakRHold = rv;
            peakRTimer = now + PEAK_HOLD_MS;
        }
        if (now > peakRTimer) peakRHold = Math.max(0, peakRHold - 0.01);

        peakL = peakLHold;
        peakR = peakRHold;

        for (let ch = 0; ch < 2; ch++) {
            const val = ch === 0 ? lv : rv;
            const peak = ch === 0 ? peakLHold : peakRHold;
            const y = padY + ch * (barH + 4);

            for (let s = 0; s < SEGMENTS; s++) {
                const threshold = s / SEGMENTS;
                const lit = threshold < val;
                const isPeak = Math.abs(threshold - peak) < 1 / SEGMENTS;

                let color: string;
                if (s < SEGMENTS * 0.65) {
                    color = lit ? "rgba(34,197,94,0.9)" : "rgba(34,197,94,0.1)";
                } else if (s < SEGMENTS * 0.85) {
                    color = lit ? "rgba(234,179,8,0.9)" : "rgba(234,179,8,0.1)";
                } else {
                    color = lit
                        ? "rgba(239,68,68,0.95)"
                        : "rgba(239,68,68,0.1)";
                }

                if (isPeak && peak > 0.05) {
                    color =
                        s >= SEGMENTS * 0.85
                            ? "rgba(239,68,68,1)"
                            : s >= SEGMENTS * 0.65
                              ? "rgba(250,204,21,1)"
                              : "rgba(74,222,128,1)";
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = color;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(s * (segW + 1) + 1, y, segW - 1, barH, 2);
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0;
    }

    // ─── Milkdrop Plasma + Particles ─────────────────────────────────────────────
    interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        r: number;
        hue: number;
        alpha: number;
        life: number;
    }
    const particles: Particle[] = [];
    const MAX_PARTICLES = 120;
    let plasmaTime = 0;

    function spawnParticles(W: number, H: number, energy: number) {
        const count = Math.floor(energy * 4);
        for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 1.5 * (1 + energy * 3),
                vy: (Math.random() - 0.5) * 1.5 * (1 + energy * 3),
                r: 2 + Math.random() * 6 * energy,
                hue: 220 + Math.random() * 120, // indigo → pink
                alpha: 0.6 + Math.random() * 0.4,
                life: 0.8 + Math.random() * 1.5,
            });
        }
    }

    function drawMilkdrop(
        ctx: CanvasRenderingContext2D,
        W: number,
        H: number,
        freq: Uint8Array<ArrayBuffer>,
        level: number,
        dt: number,
    ) {
        plasmaTime += dt;
        const energy = Math.min(1, level * 2.5);

        // ── 1. Plasma field (offline pixel operations via ImageData) ──────────────
        // Use a downscaled offscreen bitmap for performance, then scale up.
        const PW = Math.ceil(W / 3);
        const PH = Math.ceil(H / 3);
        const imgData = ctx.createImageData(PW, PH);
        const d = imgData.data;

        // Average energy across low / mid / high frequency bands
        const freqLen = freq.length;
        let bass = 0,
            mid = 0,
            high = 0;
        for (let i = 0; i < freqLen; i++) {
            const v = freq[i] / 255;
            if (i < freqLen * 0.1) bass += v;
            else if (i < freqLen * 0.5) mid += v;
            else high += v;
        }
        bass /= freqLen * 0.1;
        mid /= freqLen * 0.4;
        high /= freqLen * 0.5;

        const t = plasmaTime;
        for (let y = 0; y < PH; y++) {
            for (let x = 0; x < PW; x++) {
                const px = x / PW;
                const py = y / PH;
                // Plasma: sum of shifted sine waves modulated by audio bands
                const v =
                    Math.sin(px * 8 + t * 0.4 + bass * 6) +
                    Math.sin(py * 8 - t * 0.35 + mid * 5) +
                    Math.sin((px + py) * 6 + t * 0.3 + high * 4) +
                    Math.sin(
                        Math.sqrt(((px - 0.5) ** 2 + (py - 0.5) ** 2) * 12) *
                            3 -
                            t * 0.5,
                    );

                // Map v (–4 to +4) → hue (220°–360°+)
                const norm = (v + 4) / 8;
                const hue = (220 + norm * 150 + t * 15) % 360;
                const sat = 70 + energy * 30;
                const lig = 8 + norm * 20 + energy * 14;
                const alpha = 0.35 + energy * 0.4;

                // Fast HSL→RGB approximation
                const h = hue / 60;
                const c = ((1 - Math.abs((2 * lig) / 100 - 1)) * sat) / 100;
                const x2 = c * (1 - Math.abs((h % 2) - 1));
                const m = lig / 100 - c / 2;
                let r = 0,
                    g = 0,
                    b = 0;
                if (h < 1) {
                    r = c;
                    g = x2;
                } else if (h < 2) {
                    r = x2;
                    g = c;
                } else if (h < 3) {
                    g = c;
                    b = x2;
                } else if (h < 4) {
                    g = x2;
                    b = c;
                } else if (h < 5) {
                    r = x2;
                    b = c;
                } else {
                    r = c;
                    b = x2;
                }

                const idx = (y * PW + x) * 4;
                d[idx] = Math.round((r + m) * 255);
                d[idx + 1] = Math.round((g + m) * 255);
                d[idx + 2] = Math.round((b + m) * 255);
                d[idx + 3] = Math.round(alpha * 255);
            }
        }

        // Draw plasma scaled up to fill canvas
        const tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = PW;
        tmpCanvas.height = PH;
        const tmpCtx = tmpCanvas.getContext("2d")!;
        tmpCtx.putImageData(imgData, 0, 0);
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "low";
        ctx.drawImage(tmpCanvas, 0, 0, W, H);
        ctx.restore();

        // ── 2. Frequency ribbons ─────────────────────────────────────────────────
        // Draw translucent frequency arcs layered over the plasma
        const RIBBON_BANDS = 32;
        ctx.save();
        for (let i = 0; i < RIBBON_BANDS; i++) {
            const binIdx = Math.floor((i / RIBBON_BANDS) * freqLen * 0.7);
            const v = freq[binIdx] / 255;
            smoothed[i] = smoothed[i] * SMOOTH + v * (1 - SMOOTH);
            const bh = smoothed[i] * H * 0.35;
            const bx = (i / RIBBON_BANDS) * W;
            const bw = W / RIBBON_BANDS - 1;
            const hue2 = (240 + i * 4 + t * 20) % 360;
            ctx.fillStyle = `hsla(${hue2},90%,65%,${0.12 + smoothed[i] * 0.4})`;
            if (smoothed[i] > 0.5) {
                ctx.shadowBlur = 18;
                ctx.shadowColor = `hsla(${hue2},90%,65%,0.5)`;
            } else ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.roundRect(bx, H - bh, bw, bh, 3);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();

        // ── 3. Particles ─────────────────────────────────────────────────────────
        spawnParticles(W, H, energy);
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt * 0.7;
            p.alpha = Math.max(0, p.alpha - dt * 0.4);
            if (p.life <= 0 || p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }
            const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grd.addColorStop(0, `hsla(${p.hue},90%,75%,${p.alpha})`);
            grd.addColorStop(1, `hsla(${p.hue},90%,75%,0)`);
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            if (energy > 0.5) {
                ctx.shadowBlur = 14;
                ctx.shadowColor = `hsla(${p.hue},90%,65%,0.8)`;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // ── 4. Large stereo VU meter overlay ─────────────────────────────────────
        const VU_H = 56;
        const VU_Y = H - VU_H - 16;
        const VU_X = 16;
        const VU_W = W - 32;
        const SEGS = 40;
        const segW2 = VU_W / (SEGS + 0.5);
        const lv = Math.min(1, level * 1.5);
        const rv = Math.min(1, level * 1.35);
        if (lv >= peakLHold) {
            peakLHold = lv;
            peakLTimer = performance.now() + PEAK_HOLD_MS;
        }
        if (performance.now() > peakLTimer)
            peakLHold = Math.max(0, peakLHold - 0.008);
        if (rv >= peakRHold) {
            peakRHold = rv;
            peakRTimer = performance.now() + PEAK_HOLD_MS;
        }
        if (performance.now() > peakRTimer)
            peakRHold = Math.max(0, peakRHold - 0.008);
        peakL = peakLHold;
        peakR = peakRHold;

        const vuBarH = (VU_H - 6) / 2;
        ctx.save();
        // VU background card
        ctx.fillStyle = "rgba(5,5,15,0.6)";
        ctx.beginPath();
        ctx.roundRect(VU_X - 8, VU_Y - 8, VU_W + 16, VU_H + 16, 14);
        ctx.fill();
        for (let ch = 0; ch < 2; ch++) {
            const val = ch === 0 ? lv : rv;
            const peak = ch === 0 ? peakLHold : peakRHold;
            const vy = VU_Y + ch * (vuBarH + 6);
            // Channel label
            ctx.fillStyle =
                ch === 0 ? "rgba(100,103,242,0.7)" : "rgba(168,85,247,0.7)";
            ctx.font = "bold 9px sans-serif";
            ctx.fillText(ch === 0 ? "L" : "R", VU_X - 2, vy + vuBarH - 2);
            for (let s = 0; s < SEGS; s++) {
                const threshold = s / SEGS;
                const lit = threshold < val;
                const isPeak = Math.abs(threshold - peak) < 1.5 / SEGS;
                let color: string;
                if (s < SEGS * 0.65)
                    color = lit
                        ? "rgba(34,197,94,0.95)"
                        : "rgba(34,197,94,0.08)";
                else if (s < SEGS * 0.85)
                    color = lit
                        ? "rgba(234,179,8,0.95)"
                        : "rgba(234,179,8,0.08)";
                else
                    color = lit
                        ? "rgba(239,68,68,0.98)"
                        : "rgba(239,68,68,0.08)";
                if (isPeak && peak > 0.04) {
                    color =
                        s >= SEGS * 0.85
                            ? "rgba(255,100,100,1)"
                            : s >= SEGS * 0.65
                              ? "rgba(255,230,0,1)"
                              : "rgba(100,255,140,1)";
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = color;
                } else ctx.shadowBlur = 0;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(
                    VU_X + 10 + s * (segW2 + 0.5),
                    vy,
                    segW2 - 1,
                    vuBarH,
                    2,
                );
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    let lastRafTime = 0;

    function animate(now: number = 0) {
        if (!canvas || !vuCanvas) return;
        rafId = requestAnimationFrame(animate);
        const dt = Math.min((now - (lastRafTime || now)) / 1000, 0.05);
        lastRafTime = now;

        const vis = player.visualizer;
        if (!vis || !vis.getFrequencyData) return;

        const freq = vis.getFrequencyData();
        const time = vis.getTimeDomainData();
        const level = vis.getLevel();

        // Main canvas
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const W = canvas.width;
            const H = canvas.height;
            ctx.clearRect(0, 0, W, H);

            if (mode === "bars") drawBars(ctx, W, H, freq);
            else if (mode === "circular") drawCircular(ctx, W, H, freq);
            else if (mode === "scope") drawScope(ctx, W, H, time);
            else if (mode === "vu") drawMilkdrop(ctx, W, H, freq, level, dt);
        }

        // Mini VU canvas (only in non-vu modes)
        if (mode !== "vu") {
            const vctx = vuCanvas.getContext("2d");
            if (vctx) {
                vctx.clearRect(0, 0, vuCanvas.width, vuCanvas.height);
                drawVU(vctx, vuCanvas.width, vuCanvas.height, level);
            }
        }
    }

    $effect(() => {
        if (!canvas || !vuCanvas) return;
        rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId);
    });

    // Resize canvas to container
    let container = $state<HTMLDivElement | null>(null);
    $effect(() => {
        if (!container || !canvas) return;
        const obs = new ResizeObserver(() => {
            if (canvas && container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        });
        obs.observe(container);
        return () => obs.disconnect();
    });

    // Mode labels
    const modes: { id: VisMode; icon: string; label: string }[] = [
        { id: "bars", icon: "equalizer", label: "Bars" },
        { id: "circular", icon: "blur_circular", label: "Circular" },
        { id: "scope", icon: "show_chart", label: "Scope" },
        { id: "vu", icon: "graphic_eq", label: "VU" },
    ];
</script>

<!-- Full-screen ambient backdrop -->
{#if player.currentTrackArtworkUrl}
    <div class="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <img
            src={player.currentTrackArtworkUrl}
            alt=""
            class="w-full h-full object-cover scale-110"
            style="filter: blur(80px) saturate(1.4) brightness(0.25)"
        />
        <div
            class="absolute inset-0"
            style="background: rgba(5,5,15,0.65)"
        ></div>
    </div>
{:else}
    <div
        class="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style="background: radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.2) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(168,85,247,0.15) 0%, transparent 55%), #050510"
    ></div>
{/if}

<div class="relative z-10 flex flex-col h-dvh overflow-hidden">
    <!-- ─── Sticky Glass Header ─────────────────────────────────────────────── -->
    <header
        class="shrink-0 flex items-center gap-3 px-5 pt-safe pt-4 pb-3"
        style="background: rgba(5,5,15,0.6); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,0.06)"
    >
        <button
            onclick={() => history.back()}
            class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            aria-label="Go back"
        >
            <span class="material-symbols-rounded text-[22px]">arrow_back</span>
        </button>

        <div class="flex-1 min-w-0">
            {#if player.currentTrack}
                <p
                    class="text-xs font-bold text-white/40 uppercase tracking-widest"
                >
                    Now Visualizing
                </p>
                <p class="text-sm font-semibold text-white truncate">
                    {player.currentTrack.title ?? "Unknown Track"}
                </p>
            {:else}
                <p class="text-sm font-semibold text-white/50">
                    No track playing
                </p>
            {/if}
        </div>

        <!-- Mode switcher pills -->
        <div
            class="flex items-center gap-1 p-1 rounded-2xl"
            style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08)"
            role="group"
            aria-label="Visualization mode"
        >
            {#each modes as m}
                <button
                    onclick={() => (mode = m.id)}
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                    style={mode === m.id
                        ? `background: var(--hap-primary,#6467f2); color: white; box-shadow: 0 0 12px -2px rgba(100,103,242,0.6)`
                        : `color: rgba(255,255,255,0.45)`}
                    aria-pressed={mode === m.id}
                    aria-label="{m.label} mode"
                >
                    <span class="material-symbols-rounded text-[16px]"
                        >{m.icon}</span
                    >
                    <span class="hidden sm:inline">{m.label}</span>
                </button>
            {/each}
        </div>
    </header>

    <!-- ─── Main Visualizer Canvas ──────────────────────────────────────────── -->
    <div bind:this={container} class="flex-1 relative overflow-hidden">
        {#if !player.currentTrack}
            <!-- Empty state -->
            <div
                class="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center px-8"
            >
                <div
                    class="w-24 h-24 rounded-[2rem] flex items-center justify-center"
                    style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2)"
                >
                    <span
                        class="material-symbols-rounded text-5xl"
                        style="color: rgba(99,102,241,0.5)">graphic_eq</span
                    >
                </div>
                <p class="text-white/30 font-medium">
                    Play a track to see the visualizer
                </p>
            </div>
        {:else}
            <!-- Circular artwork in center (only in circular mode) -->
            {#if mode === "circular" && player.currentTrackArtworkUrl}
                <div
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                    style="width: min(40vw, 40vh); height: min(40vw, 40vh)"
                >
                    <div
                        class="w-full h-full rounded-full overflow-hidden"
                        style="box-shadow: 0 0 50px -5px rgba(99,102,241,0.6), 0 0 0 2px rgba(255,255,255,0.1)"
                    >
                        <img
                            src={player.currentTrackArtworkUrl}
                            alt="Album art"
                            class="w-full h-full object-cover"
                        />
                    </div>
                </div>
            {/if}

            <canvas
                bind:this={canvas}
                class="absolute inset-0 w-full h-full"
                aria-hidden="true"
            ></canvas>
        {/if}
    </div>

    <!-- ─── VU Meter strip (hidden when VU tab handles it in-canvas) ───────── -->
    {#if mode !== "vu"}
        <div
            class="shrink-0 px-5 pt-3 pb-2"
            style="background: rgba(5,5,15,0.5); backdrop-filter: blur(20px)"
        >
            <div class="flex items-center gap-3">
                <span
                    class="text-[10px] font-bold text-white/30 uppercase tracking-wider w-3"
                    >L</span
                >
                <div class="flex-1">
                    <canvas
                        bind:this={vuCanvas}
                        width={600}
                        height={44}
                        class="w-full h-[44px]"
                        aria-hidden="true"
                    ></canvas>
                </div>
                <span
                    class="text-[10px] font-bold text-white/30 uppercase tracking-wider w-3"
                    >R</span
                >
            </div>
        </div>
    {:else}
        <!-- Still bind vuCanvas but hidden (needed for peak state) -->
        <canvas
            bind:this={vuCanvas}
            width={1}
            height={1}
            class="sr-only"
            aria-hidden="true"
        ></canvas>
    {/if}

    <!-- ─── Mini Controls ───────────────────────────────────────────────────── -->
    {#if player.currentTrack}
        <div
            class="shrink-0 flex items-center gap-3 px-5 py-3 pb-safe pb-4"
            style="background: rgba(5,5,15,0.7); backdrop-filter: blur(24px); border-top: 1px solid rgba(255,255,255,0.06)"
        >
            <!-- Track info -->
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-white truncate">
                    {player.currentTrack.title ?? "Unknown"}
                </p>
                <p class="text-xs text-white/40 truncate">
                    {player.currentTrack.artist ?? "Unknown Artist"} • {player
                        .currentTrack.album ?? ""}
                </p>
            </div>

            <!-- Progress time -->
            <span class="text-xs font-mono text-white/30 tabular-nums shrink-0">
                {formatTime(player.currentTime)}<span class="text-white/15">
                    /
                </span>{formatTime(player.duration)}
            </span>

            <!-- Controls -->
            <div class="flex items-center gap-2 shrink-0">
                <button
                    onclick={() => player.previous()}
                    class="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Previous"
                >
                    <span class="material-symbols-rounded text-[22px]"
                        >skip_previous</span
                    >
                </button>

                <button
                    onclick={() => player.togglePlay()}
                    class="w-12 h-12 flex items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95"
                    style="background: var(--hap-primary,#6467f2); box-shadow: 0 0 20px -4px rgba(100,103,242,0.7)"
                    aria-label={player.isPlaying ? "Pause" : "Play"}
                >
                    <span class="material-symbols-rounded text-[26px]"
                        >{player.isPlaying ? "pause" : "play_arrow"}</span
                    >
                </button>

                <button
                    onclick={() => player.next()}
                    class="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Next"
                >
                    <span class="material-symbols-rounded text-[22px]"
                        >skip_next</span
                    >
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .pt-safe {
        padding-top: max(1rem, env(safe-area-inset-top));
    }
    .pb-safe {
        padding-bottom: max(1rem, env(safe-area-inset-bottom));
    }
</style>
