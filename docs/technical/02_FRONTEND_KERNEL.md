# TOME 2 : LE NOYAU FRONTEND (KERNEL)
**CIBLE :** `src/main.tsx`

## 2.1. BOOTSTRAPPING DE L'APPLICATION

Le fichier `src/main.tsx` est le "Big Bang" de l'application.

```typescript
createRoot(document.getElementById("root")!).render(<App />);
```

### 2.1.1. Mode Concurrent (React 18)
L'utilisation de `createRoot` active les fonctionnalités de **Concurrency**.
*   **Time Slicing :** Vital pour la cryptographie. Le déchiffrement de 50 fichiers dans l'explorateur de documents est une tâche lourde. React 18 permet de "pauser" le rendu de la liste pour répondre à un clic utilisateur, évitant la sensation de "freeze".
*   **Automatic Batching :** Regroupe les mises à jour d'état (ex: `setLoading(false)` et `setDocuments(data)`) en un seul cycle de rendu, optimisant les performances sur mobile.

## 2.2. INJECTION DES STYLES CRITIQUES

`import "./globals.css";` est la première ligne exécutée.
*   Elle injecte les directives `@tailwind` dans le Shadow DOM ou le Head.
*   Elle définit les variables CSS `:root` (couleurs HSL) utilisées par Shadcn.
*   Si cette ligne est déplacée ou retardée, l'application subira un FOUC (Flash of Unstyled Content) catastrophique.