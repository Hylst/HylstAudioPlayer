# SPEC.md — Hylst Audio Player (HAP)
> **Source de vérité technique. Ne jamais modifier sans validation explicite du Product Owner.**
> Dernière mise à jour : 2026-02-17 | Version : 1.0.0

---

## 0. VISION PRODUIT

**Hylst Audio Player** est une PWA de lecture audio professionnelle, 100% locale, sans abonnement, avec :
- Gestion complète du système de fichiers local (lecture, tag editing, réorganisation physique)
- Base de données SQLite embarquée (OPFS)
- Identification musicale via APIs gratuites (AcoustID, MusicBrainz)
- Synchronisation optionnelle LastFM

**Principe cardinal** : Toutes les données restent sur l'appareil de l'utilisateur. Aucune donnée personnelle n'est envoyée sans consentement explicite.

---

## 1. STACK TECHNIQUE (Février 2026)

### Frontend
| Technologie | Version | Usage |
|---|---|---|
| Svelte | 5.x | Framework UI (Runes obligatoires) |
| SvelteKit | 2.x | Routing, SSR désactivé (SPA) |
| TypeScript | 5.5+ | Mode strict, no `any` |
| Tailwind CSS | 4.0 | Styling, dark mode natif |

### Build & PWA
| Technologie | Version | Usage |
|---|---|---|
| Vite | 6.x | Build tool |
| vite-plugin-pwa | latest | Mode `injectManifest` |
| Workbox | 7+ | Cache strategies |

### Storage & Database
| Technologie | Usage |
|---|---|
| SQLite Wasm (`@sqlite.org/sqlite-wasm`) | Base de données principale via OPFS |
| IndexedDB (idb) | Persistence des FileSystemHandles, cache blobs |
| OPFS (Origin Private File System) | Stockage persistant SQLite |

### APIs Navigateur
| API | Usage |
|---|---|
| File System Access API | Sélection dossiers, lecture/écriture fichiers |
| Web Audio API | Playback, EQ, analyseur spectre, ReplayGain |
| Media Session API | Contrôles OS, lockscreen |
| Web Workers | Scan, parsing ID3, indexation |
| Idle Detection API | Indexation background optimisée |
| Canvas 2D / WebGL | Visualiseur audio, waveform |

### APIs Externes (optionnelles, gratuites)
| API | Rate limit | Usage |
|---|---|---|
| AcoustID | 3 req/s | Empreinte audio → MBID |
| MusicBrainz | 1 req/s | Métadonnées complètes |
| Cover Art Archive | illimité | Jaquettes HD |
| LastFM | 5 req/s | Scrobbling, recommandations |

---

## 2. ARCHITECTURE MODULAIRE

```
HylstAudioPlayer/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── lib/
│   │   ├── fs/              # Module File System
│   │   ├── db/              # Module Database
│   │   ├── audio/           # Module Audio Engine
│   │   ├── api/             # Module APIs Externes
│   │   └── utils/           # Helpers partagés
│   ├── components/
│   │   ├── player/
│   │   ├── library/
│   │   ├── playlists/
│   │   ├── settings/
│   │   └── ui/              # Composants atomiques
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +page.svelte
│   │   ├── library/
│   │   ├── playlists/
│   │   └── settings/
│   ├── app.html
│   └── app.css
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. MODULE FS — File System Manager

### Responsabilités
1. Sélection et persistence du dossier racine musique
2. Scan récursif des fichiers audio
3. Parsing et écriture des métadonnées (tags)
4. Réorganisation physique des fichiers
5. Watchdog d'intégrité

### Formats supportés
`.mp3`, `.flac`, `.ogg`, `.m4a`, `.wav`, `.opus`

### Tags supportés
- ID3v2.3 / ID3v2.4 (MP3)
- Vorbis Comments (FLAC, OGG, OPUS)
- MP4 Tags (M4A)

### Structure de code
```
src/lib/fs/
├── fileSystemManager.svelte.ts   # Store principal ($state Svelte 5)
├── scanner.worker.ts             # Web Worker — scan récursif
├── tagEditor.ts                  # Parser/Writer tags (ID3, Vorbis, MP4)
├── organizer.ts                  # Logique réorganisation physique
└── watchdog.ts                   # Polling intégrité fichiers
```

### API publique du module FS
```typescript
// fileSystemManager.svelte.ts
export const fsManager = {
  // State
  rootHandles: FileSystemDirectoryHandle[]
  isScanning: boolean
  scanProgress: { current: number; total: number }
  
  // Actions
  selectFolder(): Promise<void>
  removeFolder(path: string): Promise<void>
  startScan(handle: FileSystemDirectoryHandle): Promise<void>
  cancelScan(): void
  getFileHandle(path: string): Promise<FileSystemFileHandle>
  organizeFiles(pattern: string, preview?: boolean): Promise<OrganizeResult>
  editTags(fileHandle: FileSystemFileHandle, tags: Partial<TrackTags>): Promise<void>
}
```

### Pattern d'organisation configurable
```
/{AlbumArtist}/{Album} ({Year})/{TrackNumber} - {Title}.{ext}
/{Artist}/{Album}/{TrackNumber} - {Title}.{ext}
/{Genre}/{Artist} - {Album}/{TrackNumber} - {Title}.{ext}
```

---

## 4. MODULE DB — Database Layer

### Technologie
SQLite Wasm avec OPFS (Origin Private File System) pour persistence cross-sessions.

### Schéma complet

```sql
-- Table principale
CREATE TABLE tracks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path       TEXT UNIQUE NOT NULL,
  file_hash       TEXT,
  title           TEXT,
  artist          TEXT,
  album           TEXT,
  album_artist    TEXT,
  genre           TEXT,
  year            INTEGER,
  track_number    INTEGER,
  disc_number     INTEGER,
  duration        REAL,
  bitrate         INTEGER,
  sample_rate     INTEGER,
  play_count      INTEGER DEFAULT 0,
  last_played     DATETIME,
  date_added      DATETIME DEFAULT CURRENT_TIMESTAMP,
  rating          INTEGER CHECK(rating BETWEEN 0 AND 5),
  bpm             INTEGER,
  artwork_hash    TEXT,
  musicbrainz_id  TEXT,
  acoustid_id     TEXT
);

CREATE TABLE albums (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  artist          TEXT,
  year            INTEGER,
  artwork_path    TEXT,
  musicbrainz_id  TEXT,
  date_added      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artists (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT UNIQUE NOT NULL,
  musicbrainz_id  TEXT,
  bio             TEXT,
  image_url       TEXT
);

CREATE TABLE playlists (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  description     TEXT,
  date_created    DATETIME DEFAULT CURRENT_TIMESTAMP,
  date_modified   DATETIME,
  is_smart        BOOLEAN DEFAULT 0,
  smart_criteria  TEXT  -- JSON SQL-like criteria
);

CREATE TABLE playlist_tracks (
  playlist_id     INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
  track_id        INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE favorites (
  track_id        INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  date_added      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  path            TEXT UNIQUE NOT NULL,
  handle_id       TEXT,
  last_scanned    DATETIME,
  track_count     INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_tracks_artist      ON tracks(artist);
CREATE INDEX idx_tracks_album       ON tracks(album);
CREATE INDEX idx_tracks_genre       ON tracks(genre);
CREATE INDEX idx_tracks_year        ON tracks(year);
CREATE INDEX idx_tracks_play_count  ON tracks(play_count DESC);
CREATE INDEX idx_tracks_last_played ON tracks(last_played DESC);

-- Full-text search
CREATE VIRTUAL TABLE tracks_fts USING fts5(
  title, artist, album, content=tracks, content_rowid=id
);
```

### Structure de code
```
src/lib/db/
├── database.svelte.ts     # Store SQLite principal ($state)
├── schema.ts              # DDL + types TypeScript
├── migrations.ts          # Système de migration versionné
├── queries.ts             # Requêtes préparées optimisées
└── sync.worker.ts         # Worker — sync FS ↔ DB
```

### API publique du module DB
```typescript
export const db = {
  // Tracks
  upsertTrack(track: Partial<Track>): Promise<number>
  getTracks(filter?: TrackFilter): Promise<Track[]>
  searchTracks(query: string): Promise<Track[]>
  updatePlayCount(id: number): Promise<void>
  deleteTrack(id: number): Promise<void>
  
  // Playlists
  createPlaylist(name: string, smart?: SmartCriteria): Promise<number>
  addToPlaylist(playlistId: number, trackIds: number[]): Promise<void>
  getSmartPlaylistTracks(criteria: SmartCriteria): Promise<Track[]>
  
  // Export/Import
  exportDatabase(): Promise<Blob>         // .db binaire
  exportJSON(): Promise<string>           // JSON complet
  exportM3U(playlistId: number): Promise<string>
  importDatabase(file: File): Promise<void>
}
```

### Smart Playlists — Critères SQL dynamiques
```typescript
// Exemple de critères
const recentlyAdded: SmartCriteria = {
  conditions: [
    { field: 'date_added', operator: '>', value: 'NOW(-7 days)' }
  ],
  orderBy: 'date_added DESC',
  limit: 50
}

const topRated: SmartCriteria = {
  conditions: [
    { field: 'rating', operator: '>=', value: 4 },
    { field: 'play_count', operator: '>', value: 5 }
  ],
  orderBy: 'play_count DESC'
}
```

---

## 5. MODULE AUDIO — Media Engine

### Responsabilités
1. Playback gapless (crossfade optionnel, 0-12s)
2. Queue intelligente (shuffle, repeat: off/one/all)
3. Égaliseur 10 bandes (Web Audio API)
4. Analyseur de spectre FFT temps réel
5. ReplayGain / normalisation de volume
6. Media Session API (contrôles OS)
7. Extraction et cache des artworks
8. Support paroles LRC (synchronisation)
9. Scrobbling LastFM (optionnel)

### Store Global Svelte 5 (Runes)
```typescript
// src/lib/audio/player.svelte.ts
export const player = (() => {
  // --- State ---
  let currentTrack    = $state<Track | null>(null);
  let isPlaying       = $state(false);
  let currentTime     = $state(0);
  let duration        = $state(0);
  let volume          = $state(1);
  let queue           = $state<Track[]>([]);
  let queueIndex      = $state(0);
  let repeatMode      = $state<'off' | 'one' | 'all'>('off');
  let shuffleEnabled  = $state(false);
  let isLoading       = $state(false);
  let eqBands         = $state<EQBand[]>(DEFAULT_EQ_BANDS);

  // --- Derived ---
  let progress        = $derived(duration > 0 ? currentTime / duration : 0);
  let nextTrack       = $derived(queue[queueIndex + 1] ?? null);
  let prevTrack       = $derived(queue[queueIndex - 1] ?? null);
  let hasQueue        = $derived(queue.length > 0);

  // --- Public API ---
  return {
    // Getters
    get currentTrack()   { return currentTrack },
    get isPlaying()      { return isPlaying },
    get currentTime()    { return currentTime },
    get duration()       { return duration },
    get progress()       { return progress },
    get volume()         { return volume },
    get queue()          { return queue },
    get queueIndex()     { return queueIndex },
    get repeatMode()     { return repeatMode },
    get shuffleEnabled() { return shuffleEnabled },
    get nextTrack()      { return nextTrack },
    get eqBands()        { return eqBands },

    // Actions
    play(track?: Track): Promise<void>,
    pause(): void,
    togglePlay(): void,
    seek(time: number): void,
    setVolume(v: number): void,
    next(): void,
    previous(): void,
    setQueue(tracks: Track[], startIndex?: number): void,
    addToQueue(track: Track): void,
    removeFromQueue(index: number): void,
    reorderQueue(from: number, to: number): void,
    setRepeatMode(mode: 'off' | 'one' | 'all'): void,
    toggleShuffle(): void,
    setEQBand(bandIndex: number, gain: number): void,
    getAnalyzer(): AnalyserNode,
  };
})();
```

### Graph Audio Web Audio API
```
FileSystemFileHandle
  → ArrayBuffer
    → AudioContext.decodeAudioData()
      → SourceNode
        → GainNode (volume)
          → EQ (10x BiquadFilterNode)
            → AnalyserNode (FFT → visualizer)
              → DynamicsCompressorNode (ReplayGain)
                → AudioContext.destination
```

### Structure de code
```
src/lib/audio/
├── player.svelte.ts      # Store global
├── audioEngine.ts        # Web Audio API wrapper
├── equalizer.ts          # EQ 10 bandes
├── visualizer.ts         # Spectrum analyzer / waveform
├── mediaSession.ts       # OS integration
├── replayGain.ts         # Normalisation volume
├── lyricsParser.ts       # Parse LRC files
└── scrobbler.ts          # LastFM integration
```

---

## 6. MODULE API — External Services

### AcoustID (identification audio)
```typescript
// src/lib/api/acoustid.ts
interface AcoustIDResult {
  score: number;
  id: string;
  recordings: Array<{
    id: string;  // MusicBrainz Recording ID
    title: string;
    artists: Array<{ id: string; name: string }>;
  }>;
}

class AcoustIDClient {
  // Génération empreinte via chromaprint.js (WASM)
  async generateFingerprint(buffer: ArrayBuffer, duration: number): Promise<string>
  async lookup(fingerprint: string, duration: number): Promise<AcoustIDResult[]>
}
```

### MusicBrainz
```typescript
// src/lib/api/musicbrainz.ts
class MusicBrainzClient {
  async getRecording(mbid: string): Promise<MBRecording>
  async getRelease(mbid: string): Promise<MBRelease>
  async getArtist(mbid: string): Promise<MBArtist>
  async search(query: string, type: 'recording'|'release'|'artist'): Promise<any[]>
}
```

### Rate Limiter (partagé)
```typescript
// src/lib/api/rateLimiter.ts
const LIMITS = {
  acoustid:     { rps: 3,  minInterval: 334 },
  musicbrainz:  { rps: 1,  minInterval: 1000 },
  lastfm:       { rps: 5,  minInterval: 200 },
}

class RateLimiter {
  async throttle(api: keyof typeof LIMITS): Promise<void>
  // Cache IndexedDB — TTL: 30 jours
  async getCached<T>(key: string): Promise<T | null>
  async setCached<T>(key: string, value: T): Promise<void>
}
```

### Structure de code
```
src/lib/api/
├── musicIdentification.ts   # Orchestrateur principal
├── acoustid.ts
├── musicbrainz.ts
├── coverArt.ts
├── lastfm.ts
└── rateLimiter.ts
```

---

## 7. CONFIGURATION PWA

### Manifest (`public/manifest.json`)
```json
{
  "name": "Hylst Audio Player",
  "short_name": "HAP",
  "description": "Professional audio player with advanced library management",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#6366f1",
  "orientation": "any",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "file_handlers": [
    {
      "action": "/",
      "accept": {
        "audio/mpeg":  [".mp3"],
        "audio/flac":  [".flac"],
        "audio/ogg":   [".ogg", ".opus"],
        "audio/mp4":   [".m4a"],
        "audio/wav":   [".wav"]
      }
    }
  ],
  "shortcuts": [
    { "name": "Library",   "url": "/library" },
    { "name": "Playlists", "url": "/playlists" }
  ],
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": { "files": [{ "name": "audio", "accept": ["audio/*"] }] }
  }
}
```

### Service Worker — Stratégies de cache
| Ressource | Stratégie | TTL |
|---|---|---|
| App Shell (JS/CSS/HTML) | Network First → Cache fallback | Indéfini |
| Artworks (Cover Art Archive) | Cache First | 30 jours |
| Fichiers audio locaux | Bypass (File System API) | — |
| Réponses API | Network First → Cache | 30 jours |
| Icônes / Assets statiques | Cache First | Indéfini |

### `vite.config.ts`
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}']
      },
      manifest: false,
      devOptions: { enabled: true, type: 'module' },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/coverartarchive\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cover-art-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 2592000 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' }
});
```

---

## 8. TYPES TYPESCRIPT PARTAGÉS

```typescript
// src/lib/types.ts
export interface Track {
  id: number;
  file_path: string;
  file_hash?: string;
  title: string;
  artist: string;
  album: string;
  album_artist?: string;
  genre?: string;
  year?: number;
  track_number?: number;
  disc_number?: number;
  duration: number;
  bitrate?: number;
  sample_rate?: number;
  play_count: number;
  last_played?: Date;
  date_added: Date;
  rating: number;
  bpm?: number;
  artwork_hash?: string;
  musicbrainz_id?: string;
  acoustid_id?: string;
}

export interface TrackFilter {
  artist?: string;
  album?: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  search?: string;
  orderBy?: keyof Track;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface EQBand {
  frequency: number;  // Hz: 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k
  gain: number;       // dB: -12 à +12
  type: BiquadFilterType;
}

export interface SmartCriteria {
  conditions: Array<{
    field: keyof Track;
    operator: '=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';
    value: unknown;
  }>;
  logic?: 'AND' | 'OR';
  orderBy?: string;
  limit?: number;
}

export interface OrganizeResult {
  preview: Array<{ from: string; to: string }>;
  conflicts: Array<{ path: string; reason: string }>;
  totalFiles: number;
}

export type RepeatMode = 'off' | 'one' | 'all';
export type VisualizerMode = 'bars' | 'circular' | 'particles' | 'waveform';
```

---

## 9. PERFORMANCE TARGETS

| Métrique | Cible |
|---|---|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3.0s |
| Lighthouse PWA Score | 100 / 100 |
| Scan 10 000 fichiers | < 30s (Web Worker) |
| Recherche full-text | < 50ms |
| Latence playback | < 100ms |
| Mémoire peak (10k tracks) | < 200MB |

---

## 10. RÈGLES DE CODE OBLIGATOIRES

### Svelte 5 Runes
- ❌ INTERDIT : `let` réactif bare, `$:`, stores classiques `writable()`
- ✅ OBLIGATOIRE : `$state`, `$derived`, `$effect`, `$props`, `$bindable`

### TypeScript
- Mode strict activé, `noImplicitAny: true`
- Pas de `any` → utiliser `unknown` + type guards
- Interfaces pour tous les objets de données
- Types de retour explicites sur toutes les fonctions publiques

### Web Workers
- Tout traitement estimé > 50ms → Web Worker
- Communication via `postMessage` avec types discriminants
- Gestion d'erreurs systématique (`onerror` + `try/catch`)

### Modules
- Chaque module est indépendant et testable isolément
- Pas de couplage direct entre modules FS ↔ Audio ↔ API
- Communication via le module DB comme source de vérité unique

---

*Fin de SPEC.md*
