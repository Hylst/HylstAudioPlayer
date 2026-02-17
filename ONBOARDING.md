# ONBOARDING.md — Démarrage Rapide HAP
> Lis ce fichier en premier si tu découvres ce projet.

---

## Pour l'IA (Antigravity)

Tu travailles sur **Hylst Audio Player (HAP)**, une PWA audio professionnelle locale.

**Lis dans cet ordre :**
1. `CONTEXT.md` → État actuel du projet + prochaine action critique
2. `TODO.md` → Tâches en cours et backlog
3. `SPEC.md` → Spécifications techniques détaillées
4. `RULES.md` → Règles de code que tu dois suivre absolument

**Puis annonce :**
> "Contexte chargé. Phase active : [X]. Prochaine tâche : [ID] — [Description]."

---

## Pour un Développeur Humain

### Commandes de base
```bash
npm install          # Installer les dépendances
npm run dev          # Lancer le serveur de développement
npm run build        # Build production
npm run check        # Vérification TypeScript
npm run test         # Lancer les tests Vitest
npm run lint         # ESLint
```

### Stack en bref
- **Svelte 5** + SvelteKit 2 (Runes obligatoires)
- **TypeScript 5.5+** mode strict
- **Tailwind 4** + CSS custom properties
- **SQLite Wasm** via OPFS
- **Vite 6** + PWA plugin (injectManifest)

### Modules principaux
| Module | Entrée | Rôle |
|---|---|---|
| `src/lib/fs/` | `fileSystemManager.svelte.ts` | Gestion fichiers locaux |
| `src/lib/db/` | `database.svelte.ts` | SQLite Wasm + OPFS |
| `src/lib/audio/` | `player.svelte.ts` | Playback + Web Audio |
| `src/lib/api/` | `musicIdentification.ts` | APIs externes gratuites |

### Règles critiques
- ❌ Jamais `let` réactif sans `$state` en Svelte 5
- ❌ Jamais `any` en TypeScript
- ❌ Jamais de traitement > 50ms sur le thread principal → Web Worker
- ✅ Toujours mettre à jour `TODO.md` + `CONTEXT.md` après une étape majeure

---

## Fichiers de pilotage du projet

| Fichier | Rôle | Qui le maintient |
|---|---|---|
| `SPEC.md` | Source de vérité technique | PO + IA (modifications validées) |
| `TODO.md` | Gestionnaire de tâches | IA (mise à jour continue) |
| `CONTEXT.md` | État vivant du projet | IA (après chaque étape) |
| `RULES.md` | Custom rules pour l'IA | PO |
| `MCP.md` | Config MCPs et outils | PO |
| `ONBOARDING.md` | Ce fichier | PO |
