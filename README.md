# Hylst Audio Player (HAP)

> **Professional Local Audio Player PWA** — 100% Local, Privacy-First, High Performance.

**Hylst Audio Player** est une application web progressive (PWA) conçue pour gérer de grandes bibliothèques musicales locales directement dans le navigateur, sans cloud, sans abonnement, et sans compromis sur la performance.

![Svelte 5](https://img.shields.io/badge/Svelte-5.x-orange)
![SvelteKit](https://img.shields.io/badge/SvelteKit-2.x-red)
![SQLite Wasm](https://img.shields.io/badge/SQLite-Wasm-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-cyan)
![PWA](https://img.shields.io/badge/PWA-Installable-purple)

## 🚀 Fonctionnalités Clés

- **100% Local** : Vos fichiers restent sur votre machine. Aucune donnée n'est envoyée dans le cloud.
- **Base de Données Embarquée** : Moteur SQL complet (SQLite) stocké dans l'Origin Private File System (OPFS) pour des recherches instantanées parmi des milliers de pistes.
- **Scan Haute Performance** : Analyse récursive de dossiers et extraction de métadonnées via Web Workers (non-bloquant).
- **Audio Engine (WIP)** : Lecture gapless, EQ 10 bandes, ReplayGain.
- **PWA Installable** : Fonctionne hors-ligne, supporte les contrôles média de l'OS.

## 🛠 Stack Technique

- **Framework** : SvelteKit 2 (SPA mode) + Svelte 5 (Runes)
- **Langage** : TypeScript 5.5+ (Strict)
- **Database** : SQLite Wasm (`@sqlite.org/sqlite-wasm`) + OPFS
- **Styling** : Tailwind CSS 4.0 (Variables CSS natives)
- **Build** : Vite 6 + vite-plugin-pwa

## 📦 Installation & Développement

1. **Pré-requis** : Node.js 20+

2. **Installation** :
   ```bash
   git clone https://github.com/votre-user/HylstAudioPlayer.git
   cd HylstAudioPlayer
   npm install
   ```

3. **Lancer le serveur de dev** :
   ```bash
   npm run dev
   ```

4. **Build Production** :
   ```bash
   npm run build
   ```

## 🧪 Tests

```bash
# Tests unitaires (Vitest)
npx vitest run
```

---

*Créé par Geoffroy — Février 2026*
