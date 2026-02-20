# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

## [Unreleased]
### Planned
- **Phase 4** : moteur audio (Playback, EQ, Visualizer).
- **Phase 5** : APIs externes (AcoustID, MusicBrainz).

## [0.4.0] - 2026-02-18
### Ajouté (Phase 6 - UI Robustness)
- **Home Page Fix** : Correction d'un crash critique lié au chargement asynchrone des données.
- **DB Error Handling** : Ajout de blocs try-catch systématiques dans `DatabaseManager`.
- **Worker IPC Fix** : Résolution d'un bug dans le tunneling des résultats SQL (double accès à `.result`).
- **Debug Logging** : Ajout de logs détaillés dans la console pour le suivi du cycle de vie de la DB.
- **OPFS Fallback** : Support automatique du mode `in-memory` en dev si les headers COOP/COEP manquent.

## [0.3.0] - 2026-02-17
### Ajouté (Phase 3 - File System Manager)
- **Scan de Bibliothèque** : Support de l'ajout de dossiers locaux via `showDirectoryPicker`.
- **Worker Scanning** : Web Worker dédié pour le parcours récursif de dossiers.
- **Extraction Métadonnées** : Intégration de `music-metadata` pour lire ID3, Vorbis, MP4 tags.
- **UI Settings** : Page de configuration pour gérer les sources de la bibliothèque.
- **Batch Performance** : Insertion en base de données par lots transactionnels.
- **Persistence** : Sauvegarde du handle de dossier via IndexedDB (`idb-keyval`).

## [0.2.0] - 2026-02-17
### Ajouté (Phase 2 - Database Layer)
- **SQLite Wasm** : Intégration du moteur SQL complet dans le navigateur.
- **OPFS Storage** : Stockage persistant haute performance (`Origin Private File System`).
- **Architecture Worker** : Isolation de toutes les opérations DB dans un thread séparé.
- **Schema & Migrations** : Définition des tables Tracks, Albums, Playlists et gestion de version.
- **Store Svelte 5** : `database.svelte.ts` utilisant les Runes pour la réactivité.
- **Export/Import** : Fonctionnalités de sauvegarde et restauration de la base de données binaire.

## [0.1.0] - 2026-02-17
### Ajouté (Phase 1 - Initialization)
- **Initialisation Projet** : SvelteKit 2 + Svelte 5 + TypeScript.
- **Design System** : Configuration Tailwind CSS 4.0 avec thème sombre.
- **PWA** : Configuration `vite-plugin-pwa`, Manifest, et Service Worker (Workbox).
- **SharedArrayBuffer** : Activation des headers COOP/COEP pour le support SQLite.
- **Layout** : Structure de base de l'interface utilisateur.
