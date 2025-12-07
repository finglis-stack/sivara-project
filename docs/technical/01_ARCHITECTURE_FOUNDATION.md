# TOME 1 : ARCHITECTURE FONDATIONNELLE & BUILD SYSTEM
**CLASSIFICATION :** ENGINEERING / CORE
**TARGET ARTIFACTS :** `vite.config.ts`, `package.json`, `tsconfig.json`, `src/`
**VERSION :** 2.0 (EXPANDED)

---

## 1. PHILOSOPHIE DU "MONOLITHE VIRTUEL"

Sivara rompt avec les architectures conventionnelles. Nous n'utilisons ni Micro-Frontends (trop de complexité réseau), ni un Monorepo classique (Nx/Turborepo - trop de complexité CI/CD).

Nous avons implémenté un **Monolithe Virtuel**.

### 1.1. Définition du Paradigme
Une seule base de code source (`src/`) compile vers un seul bundle JavaScript, mais se comporte comme 6 applications distinctes au moment de l'exécution (Runtime).

*   **Code Partagé (Nucleus) :** ~60% du code. (Auth, Crypto, UI Kit, Supabase Client).
*   **Code Spécifique (App Modules) :** ~40% du code. (Éditeur Tiptap, Configurateur 3D, Dashboard Admin).

### 1.2. Avantages Critiques
1.  **Atomicité des Types :** L'interface TypeScript `Profile` est définie une seule fois. Si un champ `is_pro` est ajouté en base de données, il est instantanément disponible dans l'application Mail, Docs et Admin sans mise à jour de paquets npm privés.
2.  **Sécurité Unifiée :** La classe `EncryptionService` (AES-GCM) est un singleton global. Il est mathématiquement impossible qu'une application utilise une version obsolète de l'algorithme de chiffrement, car il n'y a qu'une seule source de vérité.
3.  **Hot-Fix Instantané :** Corriger un bug dans le composant `Button` le corrige simultanément sur les 6 plateformes.

---

## 2. LE PIPELINE DE BUILD (VITE & ROLLUP)

Le moteur de construction est **Vite 5**, configuré pour une performance extrême.

### 2.1. Configuration Détaillée (`vite.config.ts`)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger"; // Outil Dev interne

export default defineConfig(({ mode }) => ({
  // SERVEUR DE DÉVELOPPEMENT
  server: {
    host: "::", // Écoute sur toutes les interfaces (IPv4/IPv6)
    port: 8080,
    hmr: {
        overlay: false // Désactive l'overlay d'erreur intrusif en dev
    }
  },
  
  // PLUGIN STACK
  plugins: [
    // Utilisation de SWC (Speedy Web Compiler) écrit en Rust.
    // Remplace Babel. Compilation 20x plus rapide.
    react(),
    
    // Tagger optionnel pour le debugging visuel
    mode === 'development' && componentTagger(),
  ].filter(Boolean),

  // RÉSOLUTION & ALIAS
  resolve: {
    alias: {
      // Mappe "@" vers "src". Permet des imports absolus propres.
      // Evite les "../../../components/ui/button".
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // OPTIMISATION DE BUILD (PRODUCTION)
  build: {
    target: "esnext", // Cible les navigateurs modernes (support natif BigInt pour la crypto)
    minify: "esbuild", // Minification ultra-rapide
    cssCodeSplit: true, // Sépare le CSS par chunk JS
    rollupOptions: {
        output: {
            // STRATÉGIE DE CHUNKING MANUELLE
            // Force la séparation des grosses librairies pour éviter
            // de charger Tiptap sur la page de Login.
            manualChunks: {
                'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
                'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit'], // ~1MB
                'vendor-charts': ['recharts'], // ~500KB
                'vendor-crypto': ['@fingerprintjs/fingerprintjs'],
            }
        }
    }
  }
}));
```

### 2.2. Analyse du SWC (Speedy Web Compiler)
Nous n'utilisons pas `@vitejs/plugin-react` (Babel) mais `@vitejs/plugin-react-swc`.
*   **Langage :** Rust.
*   **Impact :** Le temps de transpilation à froid passe de ~4s à ~200ms.
*   **Fast Refresh :** Le remplacement de module à chaud (HMR) est atomique. Modifier un hook ne rechargera pas toute l'application, préservant l'état local (ex: texte tapé dans l'éditeur) pendant le développement.

---

## 3. ANATOMIE DU RÉPERTOIRE `SRC`

La structure de dossiers est normée pour supporter la croissance du monolithe.

```text
src/
├── components/         # Composants React
│   ├── ui/             # Design System (Boutons, Inputs, Cards) - Code "Dumb"
│   └── [Features]/     # Composants Métier (CrawlManager, OraclePanel) - Code "Smart"
│
├── contexts/           # Gestion d'État Global
│   └── AuthContext.tsx # Le gardien de l'identité
│
├── hooks/              # Logique Réutilisable (Custom Hooks)
│   ├── use-mobile.tsx  # Détection responsive
│   └── use-toast.ts    # Système de notification
│
├── integrations/       # Ponts vers l'extérieur
│   └── supabase/       # Client Supabase & Types générés
│
├── lib/                # CŒUR DU SYSTÈME (Agnostique au Framework)
│   ├── encryption.ts   # Logique Crypto AES-GCM pure
│   ├── sivara-vm.ts    # Interface avec le Kernel SBP
│   └── utils.ts        # Helpers (cn, formatters)
│
├── pages/              # Les Applications (Route Components)
│   ├── Docs.tsx        # App: Coffre-fort
│   ├── Mail.tsx        # App: Messagerie
│   ├── Index.tsx       # App: Moteur de recherche
│   └── ...
│
├── App.tsx             # Routeur & Orchestrateur
└── main.tsx            # Point d'entrée
```

### 3.1. Distinction `components/ui` vs `components`
*   **`ui/` (Shadcn) :** Ces composants sont considérés comme des **primitives**. Ils n'ont aucune logique métier. Ils ne savent pas ce qu'est un "Utilisateur" ou un "Document". Ils ne font que du rendu visuel et de l'accessibilité.
*   **`components/` (Racine) :** Composants complexes comme `OraclePanel`. Ils importent des données, font des calculs, et utilisent les primitives UI pour l'affichage.

### 3.2. Le Dossier `lib/` (Zone Critique)
C'est ici que réside la propriété intellectuelle technique.
*   Le code dans `lib/` doit être pur (ou presque).
*   Il ne doit pas dépendre de React.
*   Il doit pouvoir être testé unitairement hors du navigateur (via Vitest/Jest).
*   *Exemple :* `encryption.ts` peut être exécuté dans un Worker ou une extension Chrome sans modification.

---

## 4. ANALYSE DES DÉPENDANCES (`package.json`)

Le choix des librairies est minimaliste pour réduire la surface d'attaque.

### 4.1. Dépendances Critiques (Production)
*   `@supabase/supabase-js` : Client WebSocket et HTTP.
*   `@tanstack/react-query` : Gestionnaire de cache serveur asynchrone. Remplace Redux pour tout ce qui vient de la DB. Gère le cache, le refetch on focus, et la déduplication des requêtes.
*   `react-router-dom` : Version 6. Gère le routage virtuel.
*   `lucide-react` : Icônes vectorielles légères (SVG). Tree-shakable (seules les icônes utilisées sont incluses dans le bundle).
*   `zod` : Validation de schéma au runtime. Utilisé pour valider que les données déchiffrées correspondent bien à la structure attendue (Intégrité des types).

### 4.2. L'Écosystème Mobile (Capacitor)
*   `@capacitor/core` : Le pont JS <-> Natif.
*   `@capacitor/ios` & `@capacitor/android` : Les plateformes cibles.
*   **Stratégie :** Ces paquets ne sont actifs que si l'app détecte l'environnement natif. Sur le web, ils sont des coquilles vides (Mock/No-op) grâce au Tree-Shaking, n'alourdissant pas le site web.

---

## 5. CONFIGURATION TYPESCRIPT (`tsconfig.json`)

Sivara utilise le mode strict de TypeScript pour garantir la robustesse du code crypto.

```json
{
  "compilerOptions": {
    "target": "ES2020", // Support BigInt natif requis pour la crypto
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true, // Optimisation vitesse build

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true, // Vite fait le emit, tsc fait juste le check
    "jsx": "react-jsx",

    /* Linting Strict */
    "strict": true, // null checks, any checks, etc.
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    /* Alias */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Points Clés :**
1.  **`target: ES2020` :** Impératif. Les versions antérieures de JS (ES5) nécessitent des polyfills pour `BigInt` et `Uint8Array`, qui sont catastrophiques pour les performances cryptographiques. Nous ciblons les navigateurs modernes.
2.  **`strict: true` :** Interdit le `any` implicite. Dans une app gérant des données chiffrées, confondre une `string` (Base64) et un `Uint8Array` (Buffer) est une erreur fatale. TypeScript agit comme première ligne de défense.

---

## 6. SÉCURITÉ DE L'ENVIRONNEMENT

### 6.1. Variables d'Environnement
Vite expose les variables via `import.meta.env`.
*   Seules les variables préfixées par `VITE_` sont exposées au client.
*   **Règle d'Or :** Aucune clé privée (`SERVICE_ROLE_KEY`, `STRIPE_SECRET`, `OPENAI_KEY`) ne doit jamais apparaître dans le code frontend ou les fichiers `.env` commis. Ces clés vivent exclusivement dans les Edge Functions (Backend).
*   La clé `SUPABASE_ANON_KEY` est publique par design (RLS-protected), elle peut donc être hardcodée ou dans le `.env` frontend.

### 6.2. Headers de Sécurité (Vercel/Netlify)
Bien que hors du code source JS, l'architecture requiert des headers HTTP spécifiques configurés dans `vercel.json` :
*   `Cross-Origin-Opener-Policy: same-origin` : Nécessaire pour isoler la mémoire du processus et activer `SharedArrayBuffer` si nécessaire pour la crypto avancée.
*   `X-Content-Type-Options: nosniff` : Empêche l'exécution de fichiers non-JS.

---

**FIN DU TOME 1**