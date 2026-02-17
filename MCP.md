# MCP.md — MCPs Gratuits & Outils Antigravity pour HAP
> Configuration recommandée pour maximiser l'autonomie de l'IA sur ce projet.
> Mis à jour : Février 2026

---

## 1. QU'EST-CE QU'UN MCP DANS ANTIGRAVITY ?

Les **Model Context Protocol (MCP) servers** permettent à l'IA dans Antigravity d'interagir directement avec des outils externes : filesystem, terminal, navigateur, APIs, bases de données, etc. — sans avoir besoin de copier-coller manuellement du code ou des résultats.

**Pour HAP, l'objectif est que l'IA puisse :**
- Lire/écrire des fichiers de projet directement
- Exécuter des commandes npm/vite
- Vérifier des erreurs TypeScript en temps réel
- Accéder à la doc officielle des APIs utilisées

---

## 2. MCPS RECOMMANDÉS (Gratuits / Open Source)

### 🔧 MCP Filesystem (Anthropic officiel)
**Repo :** `@modelcontextprotocol/server-filesystem`
**Utilité pour HAP :** Lecture/écriture directe de tous les fichiers du projet
**Config :**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/chemin/vers/HylstAudioPlayer"
      ]
    }
  }
}
```
**Capacités :** `read_file`, `write_file`, `list_directory`, `search_files`, `move_file`
**Priorité : ⭐⭐⭐ INDISPENSABLE**

---

### 💻 MCP Shell / Terminal
**Repo :** `@modelcontextprotocol/server-shell` ou `mcp-server-commands`
**Utilité pour HAP :**
- Exécuter `npm run build`, `npm run dev`, `npm run check` (TypeScript)
- Lancer les tests Vitest
- Générer la structure de dossiers

**Config :**
```json
{
  "mcpServers": {
    "shell": {
      "command": "npx",
      "args": ["-y", "mcp-server-commands"],
      "env": {
        "ALLOWED_COMMANDS": "npm,npx,node,git,mkdir,cp,mv"
      }
    }
  }
}
```
**⚠️ Restreindre les commandes autorisées pour la sécurité.**
**Priorité : ⭐⭐⭐ INDISPENSABLE**

---

### 🌐 MCP Fetch (Anthropic officiel)
**Repo :** `@modelcontextprotocol/server-fetch`
**Utilité pour HAP :**
- Lire la doc officielle MDN (Web Audio API, File System API)
- Consulter la doc Svelte 5 / SvelteKit
- Tester les APIs externes (MusicBrainz, AcoustID)

**Config :**
```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```
**Priorité : ⭐⭐⭐ TRÈS UTILE**

---

### 🗄️ MCP SQLite
**Repo :** `@modelcontextprotocol/server-sqlite`
**Utilité pour HAP :**
- Tester les requêtes SQL du schéma HAP avant de les intégrer
- Valider les migrations
- Débugger les requêtes FTS5

**Config :**
```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sqlite",
        "--db-path",
        "/tmp/hap-test.db"
      ]
    }
  }
}
```
**Priorité : ⭐⭐ UTILE pour Phase 2**

---

### 📝 MCP Memory (Anthropic officiel)
**Repo :** `@modelcontextprotocol/server-memory`
**Utilité pour HAP :**
- Maintenir un graphe de connaissances du projet entre sessions
- Stocker les décisions architecturales
- Mémoriser les patterns de code préférés du projet

**Config :**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```
**Note :** Complémente les fichiers CONTEXT.md / TODO.md pour la persistance cross-session.
**Priorité : ⭐⭐ UTILE**

---

### 🔍 MCP GitHub (optionnel)
**Repo :** `@modelcontextprotocol/server-github`
**Utilité pour HAP :**
- Rechercher des exemples de code (SQLite Wasm + OPFS, chromaprint.js)
- Consulter les issues des librairies utilisées
- Gérer les commits du projet

**Nécessite :** Token GitHub (gratuit)
**Priorité : ⭐ OPTIONNEL**

---

### 🧪 MCP Playwright (tests)
**Repo :** `@playwright/mcp`  (officiel Playwright)
**Utilité pour HAP :**
- Tests E2E automatisés de l'UI
- Vérifier le comportement PWA (offline, install prompt)
- Screenshots de validation des composants

**Config :**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    }
  }
}
```
**Priorité : ⭐⭐ UTILE pour Phase 7**

---

## 3. CONFIGURATION COMPLÈTE RECOMMANDÉE

**Fichier `antigravity.config.json` (ou équivalent dans Antigravity) :**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"],
      "description": "Accès complet aux fichiers du projet HAP"
    },
    "shell": {
      "command": "npx",
      "args": ["-y", "mcp-server-commands"],
      "env": {
        "ALLOWED_COMMANDS": "npm,npx,node,git,mkdir"
      },
      "description": "Exécution de commandes de build et test"
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"],
      "description": "Consultation documentation et APIs externes"
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "/tmp/hap-dev.db"],
      "description": "Test et validation du schéma SQLite"
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "description": "Graphe de connaissances du projet"
    }
  }
}
```

---

## 4. AUTRES ATOUTS ANTIGRAVITY À ACTIVER

### A. System Prompt Persistant (Custom Instructions)
Coller le contenu de `RULES.md` comme system prompt ou custom instruction d'Antigravity. Cela garantit que les règles s'appliquent même sans que l'utilisateur les mentionne.

### B. Fichiers de Contexte Auto-Injectés
Dans Antigravity, configurer l'injection automatique de :
- `@SPEC.md` — toujours présent en contexte
- `@CONTEXT.md` — mis à jour en temps réel
- `@TODO.md` — tâches courantes

**Si Antigravity supporte les `@mentions` de fichiers :**
```
Commencer chaque session avec :
"Je reprends le projet HAP. @CONTEXT.md @TODO.md"
```

### C. Mode Agent avec Boucle d'Exécution
Si Antigravity supporte un mode agent autonome :
- Activer la **boucle plan → code → test → commit**
- L'IA peut générer du code, l'exécuter via MCP Shell, voir les erreurs TypeScript, corriger, et committer

### D. Snippets / Templates Rapides
Créer des templates dans Antigravity pour :
- `svelte-store` → Template de store Svelte 5 Runes
- `web-worker` → Template Worker typé
- `db-query` → Template requête SQLite préparée

---

## 5. WORKFLOW RECOMMANDÉ PAR SESSION

```
1. Ouvrir Antigravity dans le dossier HylstAudioPlayer/
2. Charger le contexte : "Reprends le projet. Lis CONTEXT.md et TODO.md"
3. L'IA annonce la phase active et la prochaine tâche
4. Valider ou corriger le plan
5. L'IA exécute (MCP Filesystem + Shell)
6. Review du code généré
7. L'IA met à jour TODO.md + CONTEXT.md
8. Commit git (optionnel via MCP GitHub)
```

---

## 6. MCPS POUR LES APIs EXTERNES DE HAP

### Test AcoustID directement depuis l'IA
```
Utiliser MCP Fetch pour requêter :
GET https://api.acoustid.org/v2/lookup?client=TEST&fingerprint=XXX&duration=240
```

### Test MusicBrainz
```
GET https://musicbrainz.org/ws/2/recording/[mbid]?fmt=json
```

### Cover Art Archive
```
GET https://coverartarchive.org/release/[mbid]
```

L'IA peut ainsi tester et débugger les intégrations API directement, sans avoir besoin d'un frontend.

---

*Fin de MCP.md*
