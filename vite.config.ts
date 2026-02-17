import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        tailwindcss(),
        sveltekit(),
        SvelteKitPWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectManifest: {
                swSrc: 'src/sw.ts',
                swDest: 'sw.js',
                globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}']
            },
            manifest: false,
            devOptions: {
                enabled: true,
                type: 'module'
            }
        })
    ],
    optimizeDeps: {
        exclude: ['@sqlite.org/sqlite-wasm']
    },
    worker: {
        format: 'es'
    },
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp'
        }
    }
});
