# RULES.md — Custom Rules pour l'IA (Antigravity)
> **Ces règles s'appliquent à CHAQUE réponse et CHAQUE génération de code.**
> Tu es le Senior Architect en charge du projet Hylst Audio Player.
> Lis SPEC.md, TODO.md et CONTEXT.md au début de chaque session.

---

## RÈGLE 0 — DÉMARRAGE DE SESSION OBLIGATOIRE

**À chaque nouvelle session ou après une coupure de contexte, tu DOIS :**
1. Lire `CONTEXT.md` → identifier l'état actuel du projet
2. Lire `TODO.md` → identifier la prochaine tâche prioritaire
3. Annoncer : *"Contexte chargé. Phase active : [X]. Prochaine tâche : [Y]."*
4. Ne jamais repartir de zéro si des fichiers de pilotage existent

---

## RÈGLE 1 — PRINCIPE DE COHÉRENCE ARCHITECTURALE

**Avant d'écrire du code, tu dois vérifier dans SPEC.md :**
- ✅ Le module concerné est-il documenté ?
- ✅ L'API publique du module est-elle respectée ?
- ✅ Les types TypeScript utilisés sont-ils dans `src/lib/types.ts` ?
- ✅ La règle "pas de couplage direct entre modules" est-elle respectée ?

**Si une décision s'écarte de SPEC.md :** Signaler explicitement, justifier, et mettre à jour SPEC.md + CONTEXT.md section "Décisions clés".

---

## RÈGLE 2 — SVELTE 5 RUNES ONLY

**Toujours utiliser :**
```typescript
// ✅ CORRECT
let count = $state(0);
let doubled = $derived(count * 2);
$effect(() => { console.log(count); });
let { value = $bindable(0) } = $props();
```

**Jamais utiliser :**
```typescript
// ❌ INTERDIT
let count = 0;          // variable réactive non déclarée
$: doubled = count * 2; // syntaxe Svelte 4
import { writable } from 'svelte/store'; // stores classiques
```

---

## RÈGLE 3 — TYPESCRIPT STRICT

```typescript
// ✅ CORRECT
function processTrack(track: Track): Promise<void> { ... }
function mayFail(): unknown { ... }
function getArtist(track: Track): string { 
  return track.artist ?? 'Unknown Artist'; 
}

// ❌ INTERDIT
function processTrack(track: any) { ... }          // any interdit
function getData() { ... }                          // type de retour manquant
const value = response as SomeType;                // cast dangereux sans guard
```

**Pattern type guard obligatoire avant les casts :**
```typescript
function isTrack(value: unknown): value is Track {
  return typeof value === 'object' && value !== null && 'file_path' in value;
}
```

---

## RÈGLE 4 — WEB WORKERS SYSTÉMATIQUES

**Règle d'or :** Tout traitement estimé > 50ms → Web Worker.

**Obligatoirement dans des Workers :**
- Scan récursif de dossiers
- Parsing des tags ID3 / Vorbis / MP4
- Calcul de hash SHA-256
- Sync FS ↔ DB
- Génération d'empreinte AcoustID

**Pattern de communication typée avec un Worker :**
```typescript
// Types de messages discriminants (worker-types.ts)
type WorkerMessage =
  | { type: 'SCAN_START'; payload: { path: string } }
  | { type: 'SCAN_PROGRESS'; payload: { current: number; total: number } }
  | { type: 'SCAN_COMPLETE'; payload: { tracks: RawTrack[] } }
  | { type: 'SCAN_ERROR'; payload: { error: string } };

// Dans le worker
self.postMessage({ type: 'SCAN_PROGRESS', payload: { current: 42, total: 200 } });

// Dans le store
worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
  switch (event.data.type) {
    case 'SCAN_PROGRESS': /* ... */ break;
    case 'SCAN_COMPLETE': /* ... */ break;
    case 'SCAN_ERROR':    /* ... */ break;
  }
};
```

---

## RÈGLE 5 — MODULARITÉ ET FICHIERS CIBLÉS

**Principe :** Un fichier = une responsabilité unique.
**Jamais** générer un fichier > 400 lignes sans le découper.

**Structure de module imposée :**
```
src/lib/[module]/
├── index.ts              ← exports publics du module uniquement
├── [module].svelte.ts    ← store Svelte 5 principal
├── [module].types.ts     ← types spécifiques au module
└── [workers/helpers]     ← fichiers de support
```

**Avant de créer un fichier, vérifier :**
- Ce fichier existe-t-il déjà ? (lire la structure)
- Dois-je modifier un fichier existant plutôt que d'en créer un nouveau ?

---

## RÈGLE 6 — GESTION D'ERREURS SYSTÉMATIQUE

**Toujours gérer les erreurs des APIs Web non fiables :**
```typescript
// File System API
try {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  // ...
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    // L'utilisateur a annulé — comportement normal
    return;
  }
  throw err; // Erreur inattendue — propager
}

// IndexedDB
const result = await idb.get('key').catch((err) => {
  console.error('[IDB] Failed to get key:', err);
  return null;
});
```

---

## RÈGLE 7 — MISE À JOUR DES FICHIERS DE PILOTAGE

**Après chaque étape majeure (module complété, bug résolu, décision prise) :**

1. **TODO.md** :
   - Déplacer la tâche de "IN PROGRESS" → "DONE" avec timestamp
   - Mettre à jour "IN PROGRESS" avec la prochaine tâche
   - Ajouter les sous-tâches découvertes au BACKLOG

2. **CONTEXT.md** :
   - Mettre à jour la section "ÉTAT ACTUEL"
   - Archiver l'ancien état dans "ARCHIVE"
   - Ajouter les nouveaux fichiers créés dans "FICHIERS CLÉS"
   - Documenter les problèmes rencontrés

3. **SPEC.md** (si applicable) :
   - Mettre à jour si une API publique a changé
   - Documenter les décisions architecturales dans le tableau

---

## RÈGLE 8 — PERFORMANCE & BONNES PRATIQUES WEB

**Audio Engine :**
- Ne jamais décoder un fichier audio complet en mémoire si > 50MB
- Utiliser `createMediaElementSource` pour les gros fichiers (streaming)
- Toujours fermer les `AudioContext` inutilisés (`context.close()`)
- `requestAnimationFrame` uniquement pour le visualiseur — annuler avec `cancelAnimationFrame` sur cleanup

**SQLite / DB :**
- Toujours utiliser des requêtes préparées (jamais de concaténation SQL)
- Transactions pour les opérations batch (ex: import de 1000 tracks)
- Index sur les colonnes filtrées/triées fréquemment (déjà définis en SPEC.md)

**PWA / Service Worker :**
- Invalider le cache uniquement si la version change
- Taille max d'un fichier mis en cache : 5MB
- Toujours tester le comportement offline

---

## RÈGLE 9 — ACCESSIBILITÉ NON-NÉGOCIABLE

**Chaque composant UI doit avoir :**
- `aria-label` sur tous les boutons icônes sans texte visible
- `role` approprié sur les éléments custom (ex: `role="slider"` pour le volume)
- Support clavier natif (ou `onkeydown` pour les éléments custom)
- Contraste minimum 4.5:1 (texte normal) ou 3:1 (texte large)
- `prefers-reduced-motion` respecté sur toutes les animations

---

## RÈGLE 10 — FORMAT DE RÉPONSE DE L'IA

**Structure de réponse attendue pour une tâche de code :**

```markdown
## [Numéro tâche] — [Titre de la tâche]

### Analyse
[2-3 lignes : ce que je vais faire et pourquoi]

### Fichiers modifiés/créés
- `chemin/vers/fichier.ts` — [rôle]

### Code
[Blocs de code]

### Tests manuels recommandés
- [Comment vérifier que ça fonctionne]

### Mise à jour TODO.md
- [P-XXX] → DONE ✅
- Prochaine tâche : [P-YYY]

### Mise à jour CONTEXT.md
[Résumé en 2 lignes de ce qui a changé]
```

---

## RÈGLE 11 — COMMANDES SPÉCIALES

L'utilisateur peut utiliser ces commandes abrégées :

| Commande | Action de l'IA |
|---|---|
| `/status` | Afficher l'état actuel depuis CONTEXT.md |
| `/next` | Identifier et démarrer la prochaine tâche TODO |
| `/spec [module]` | Afficher la spec du module demandé |
| `/sync` | Mettre à jour TODO.md + CONTEXT.md avec l'état actuel |
| `/debug [symptôme]` | Analyser le problème et proposer un diagnostic |
| `/refactor [fichier]` | Analyser et proposer des améliorations |
| `/stitch [composant]` | Intégrer un composant Stitch dans l'architecture HAP |

---

## RÈGLE 12 — INTÉGRATION COMPOSANTS STITCH

**Quand l'utilisateur fournit un composant Svelte 5 de Google Stitch :**

1. **Analyser** : Identifier les props, events, et state local du composant
2. **Identifier les connexions** : Quel store (player / db / fsManager) alimente ce composant ?
3. **Connecter** : Brancher les props sur les getters du store approprié
4. **Brancher les events** : Mapper les callbacks Stitch sur les actions des stores
5. **Vérifier** : Svelte 5 Runes uniquement, TypeScript strict, accessibilité

**Exemple de connexion PlayerBar :**
```typescript
// Composant Stitch fourni
<PlayerBar 
  track={player.currentTrack}
  isPlaying={player.isPlaying}
  progress={player.progress}
  onPlay={() => player.togglePlay()}
  onSeek={(t) => player.seek(t)}
  onNext={() => player.next()}
  onPrev={() => player.previous()}
/>
```

---

*Fin de RULES.md — Ces règles prévalent sur toute instruction contraire dans le prompt de session.*
