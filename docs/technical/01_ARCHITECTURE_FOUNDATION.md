# TOME 1 : ARCHITECTURE FONDATIONNELLE
**CIBLE :** `vite.config.ts`, `tsconfig.json`, `package.json`

## 1.1. PHILOSOPHIE DU MONOREPO VIRTUEL

Sivara utilise une architecture unique de **"Monolithe Distribué"**. Contrairement à une architecture micro-services classique où chaque application a son propre repo, Sivara héberge 6 applications complètes (`Docs`, `Mail`, `Account`, `Help`, `Device`, `Search`) dans un seul arbre de source React.

### 1.1.1. Avantages Structurels
*   **Partage de Code Atomique :** Le composant `Button` ou le service `EncryptionService` sont importés nativement par toutes les apps sans passer par un package npm privé.
*   **Typage Unifié :** Les interfaces TypeScript (`User`, `Profile`, `Document`) sont globales. Une modification de la DB se répercute instantanément sur le typage de toutes les apps.

## 1.2. CONFIGURATION DE BUILD (VITE)

Le fichier `vite.config.ts` est le moteur de cette architecture.

```typescript
export default defineConfig(() => ({
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
```

### 1.2.1. Compilation SWC
Nous utilisons `@vitejs/plugin-react-swc` au lieu de Babel. SWC est écrit en Rust.
*   **Vitesse :** Compilation 20x plus rapide en dev.
*   **Hot Module Replacement (HMR) :** Instantané, même avec 500+ composants.

### 1.2.2. Stratégie de Chunking (Rollup)
Vite découpe automatiquement le bundle final.
*   Le code de `Tiptap` (Éditeur lourd) n'est jamais chargé si l'utilisateur est sur `mail.sivara.ca`.
*   Le code de `Three.js` (si utilisé) est isolé.
*   L'arbre de dépendances est analysé statiquement pour créer des "Common Chunks" (React, Supabase Client) et des "App Chunks" spécifiques.