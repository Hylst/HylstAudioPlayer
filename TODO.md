# TODO.md — Hylst Audio Player
> **Ce fichier est la mémoire de travail du projet.**
> L'IA doit le mettre à jour AVANT et APRÈS chaque session de travail.
> Format : `[YYYY-MM-DD HH:MM]` pour les timestamps.

---

## 🎯 CURRENT SPRINT
> Sprint actuel, objectif et date de fin estimée.

**Sprint :** Phase 3 — File System Manager (Part 2)
**Objectif :** Parsing tags écriture, Réorganisation, Watchdog
**Deadline estimée :** À définir

---

## 🔄 IN PROGRESS
> Tâches en cours. Maximum 3 simultanées.

- [ ] **[P3-005]** `src/lib/fs/tagEditor.ts` — écriture tags + artwork APIC
  - Assigné à : IA
  - Démarré le : —
  - Blockers : Recherche librairie écriture (music-metadata est read-only)

---

## 📋 BACKLOG

### PHASE 3 — File System Manager (Suite)
- [ ] **[P3-005]** `src/lib/fs/tagEditor.ts` — écriture tags + artwork APIC
- [ ] **[P3-006]** `src/lib/fs/organizer.ts` — patterns de réorganisation
- [ ] **[P3-007]** `src/lib/fs/watchdog.ts` — polling intégrité
- [ ] **[P3-008]** Détection de doublons (hash SHA-256) (Partiel : helper créé)
- [ ] **[P3-009]** Batch tag editing (édition multiple simultanée)

### PHASE 4 — Audio Engine
- [ ] **[P4-001]** `src/lib/audio/player.svelte.ts` — store global (Runes)
- [ ] **[P4-002]** `src/lib/audio/audioEngine.ts` — Web Audio API graph
- [ ] **[P4-003]** Playback gapless (double buffer, crossfade)
- [ ] **[P4-004]** `src/lib/audio/equalizer.ts` — EQ 10 bandes
- [ ] **[P4-005]** `src/lib/audio/visualizer.ts` — FFT + modes d'affichage
- [ ] **[P4-006]** `src/lib/audio/mediaSession.ts` — OS Media Controls
- [ ] **[P4-007]** `src/lib/audio/replayGain.ts` — normalisation volume
- [ ] **[P4-008]** `src/lib/audio/lyricsParser.ts` — LRC synchronisé
- [ ] **[P4-009]** `src/lib/audio/scrobbler.ts` — LastFM (optionnel)

### PHASE 5 — External APIs
- [ ] **[P5-001]** `src/lib/api/rateLimiter.ts` — rate limiting + cache IndexedDB
- [ ] **[P5-002]** `src/lib/api/acoustid.ts` — client AcoustID
- [ ] **[P5-003]** Intégration chromaprint.js (WASM) pour empreintes
- [ ] **[P5-004]** `src/lib/api/musicbrainz.ts` — client MusicBrainz
- [ ] **[P5-005]** `src/lib/api/coverArt.ts` — Cover Art Archive
- [ ] **[P5-006]** `src/lib/api/lastfm.ts` — LastFM scrobbling
- [ ] **[P5-007]** `src/lib/api/musicIdentification.ts` — orchestrateur
- [ ] **[P5-008]** UI de progression d'identification en masse

### PHASE 6 — UI Components
- [x] **[P6-001]** Home Page Redesign (Stitch style)
- [x] **[P6-002]** Library Page Redesign (Stitch style)
- [x] **[P6-003]** Fullscreen Player View
- [x] **[P6-004]** Thème dynamique (Artwork color extraction)
- [x] **[P6-005]** Playlist Management UI
- [ ] **[P6-006]** Visualiseur de spectre audio (Canvas)
- [ ] **[P6-007]** Animations de transitions de pages
- [ ] **[P6-008]** Menu contextuel global
- [ ] **[P6-009]** Keyboard shortcuts
- [ ] **[P6-010]** Accessibilité WCAG 2.1 AA

### PHASE 7 — Tests & Optimisation
- [ ] **[P7-001]** Tests Vitest (modules FS, Audio)
- [ ] **[P7-002]** Playwright E2E (flux principaux)
- [ ] **[P7-003]** Audit Lighthouse (PWA 100, Perf, A11y)
- [ ] **[P7-004]** Profiling performance (scan, search, playback)
- [ ] **[P7-005]** Optimisation bundle (code splitting, lazy loading)

---

## ✅ DONE
> Tâches terminées avec date et notes de validation.

**PHASE 1 — Setup**
- [x] **[P1-001]** Init projet SvelteKit 2 + Svelte 5 + TypeScript strict — `[2026-02-17 19:35]`
- [x] **[P1-002]** Config Vite 6 + vite-plugin-pwa (injectManifest) — `[2026-02-17 19:35]`
- [x] **[P1-003]** Config Tailwind 4.0 (dark mode, variables CSS custom) — `[2026-02-17 19:35]`
- [x] **[P1-004]** Création manifest.json PWA (file handlers, share target) — `[2026-02-17 19:35]`
- [x] **[P1-005]** Service Worker de base (Workbox 7) — `[2026-02-17 19:35]`
- [x] **[P1-006]** Structure de dossiers complète selon SPEC.md §2 — `[2026-02-17 19:35]`
- [x] **[P1-007]** Fichier `src/lib/types.ts` — tous les types partagés — `[2026-02-17 19:35]`
- [x] **[P1-008]** Layout SvelteKit de base (app.html, +layout.svelte) — `[2026-02-17 19:35]`

**PHASE 2 — Database Layer**
- [x] **[P2-001]** Intégration `@sqlite.org/sqlite-wasm` avec OPFS & Worker — `[2026-02-17 22:15]`
- [x] **[P2-002]** `src/lib/db/schema.ts` — DDL complet selon SPEC.md §4 — `[2026-02-17 22:15]`
- [x] **[P2-003]** `src/lib/db/migrations.ts` — système de migration versionné — `[2026-02-17 22:15]`
- [x] **[P2-004]** `src/lib/db/database.svelte.ts` — store principal Svelte 5 — `[2026-02-17 22:15]`
- [x] **[P2-005]** `src/lib/db/queries.ts` — requêtes préparées (CRUD + FTS) — `[2026-02-17 22:15]`
- [x] **[P2-006]** `src/lib/db/sync.worker.ts` — placeholder — `[2026-02-17 22:15]`
- [x] **[P2-007]** Export/Import DB (Blob / OPFS overwrite) — `[2026-02-17 22:15]`
- [x] **[P2-008]** Tests unitaires DB (Verification DDL + Queries avec Vitest) — `[2026-02-17 22:15]`

**PHASE 3 — File System Manager**
- [x] **[P3-001]** `src/lib/fs/fileSystemManager.svelte.ts` — store FS, selections, persistence IDB — `[2026-02-17 22:20]`
- [x] **[P3-002]** Sélection dossier + permissions — `[2026-02-17 22:20]`
- [x] **[P3-003]** `src/lib/fs/scanner.worker.ts` — scan récursif (Web Worker) — `[2026-02-17 22:20]`
- [x] **[P3-004]** Parsing ID3v2 / Vorbis / MP4 tags (lecture avec music-metadata) — `[2026-02-17 22:20]`

---

## 🚫 BLOCKED
> Tâches bloquées avec raison et dépendance.

- **[P3-005]** Écriture tags : `music-metadata` est read-only. Besoin d'investigation pour l'écriture (browser-id3-writer ?).

---

## 📝 DECISIONS LOG

| Date | Décision | Raison | Alternatives rejetées |
|---|---|---|---|
| 2026-02-17 | SQLite Wasm via OPFS | Performance + persistence native | IndexedDB (trop limité pour SQL) |
| 2026-02-17 | Svelte 5 Runes obligatoires | Réactivité granulaire | Svelte 4 (obsolète) |
| 2026-02-17 | Modules découplés via DB | Évite le couplage FS↔Audio | Event bus |
| 2026-02-17 | @vite-pwa/sveltekit | Package dédié SvelteKit PWA | vite-plugin-pwa seul |
| 2026-02-17 | SharedArrayBuffer (COOP/COEP) | Requis pour OPFS sync | Filesystem classique (lent) |
| 2026-02-17 | `music-metadata` pour parsing | Standard robuste et maintained | jsmediatags (vieux) |
| 2026-02-17 | Batch Upsert (50 tracks) | Performance IPC Worker↔Main | Upsert unitaire (trop lent) |

---

## ⚡ QUICK NOTES
> Notes temporaires de l'IA.

- **Phase 3 (Scan)** : Le système de scan fonctionne. `ScannerWorker` lit les fichiers, parse les tags, et envoie des batchs à `fileSystemManager`, qui les envoie à `DatabaseManager` pour batch insert transactionnel.
- **UI Settings** : Page de settings basique créée pour tester le scan (`/settings`).
