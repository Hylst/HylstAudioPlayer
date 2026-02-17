/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// SvelteKit's build artifacts for precaching
const precacheList = [
    ...build,
    ...files,
].map(url => ({
    url,
    revision: version
}));

// Instant activation
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    // @ts-ignore
    self.clients.claim();
});

// Precache SvelteKit build assets
precacheAndRoute(precacheList);

// Clean up old caches from previous versions
cleanupOutdatedCaches();

// Cache Cover Art Archive images — CacheFirst, 30 days, max 500 entries
registerRoute(
    /^https:\/\/coverartarchive\.org\/.*/i,
    new CacheFirst({
        cacheName: 'cover-art-cache',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
            }),
            new CacheableResponsePlugin({
                statuses: [0, 200]
            })
        ]
    })
);

// Cache API responses (MusicBrainz, AcoustID) — NetworkFirst, 30 days fallback
registerRoute(
    /^https:\/\/(musicbrainz\.org|api\.acoustid\.org)\/.*/i,
    new NetworkFirst({
        cacheName: 'api-cache',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
            }),
            new CacheableResponsePlugin({
                statuses: [0, 200]
            })
        ]
    })
);
