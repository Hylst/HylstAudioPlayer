// src/hooks.server.ts — SvelteKit Server Hooks
// Adds COOP/COEP headers required for SharedArrayBuffer + OPFS (SQLite Wasm)

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    return response;
};
