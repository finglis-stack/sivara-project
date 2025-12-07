# TOME 2 : LE NOYAU FRONTEND (KERNEL & RUNTIME)
**CLASSIFICATION :** ENGINEERING / CORE
**TARGET ARTIFACTS :** `src/main.tsx`, `src/globals.css`, `index.html`
**VERSION :** 2.0 (EXPANDED)

---

## 1. LE POINT D'INJECTION (`src/main.tsx`)

Le fichier `main.tsx` est le "Big Bang" de l'univers Sivara. Ce n'est pas un simple fichier de démarrage, c'est le point de convergence où le DOM statique devient une application interactive.

### 1.1. Code Source Analysé

```typescript
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Sélection critique avec assertion non-null (!)
const rootElement = document.getElementById("root")!;

// Hydratation Concurrent Mode
createRoot(rootElement).render(<App />);
```

### 1.2. Architecture "Concurrent Root" (React 18)

Sivara n'utilise pas l'API legacy `ReactDOM.render`. L'utilisation de `createRoot` active le **Concurrent Mode** par défaut. C'est une décision architecturale critique pour une application lourde en calculs (Cryptographie).

#### 1.2.1. Time Slicing & Prioritization
Dans une application classique, le déchiffrement d'un fichier de 10MB bloquerait le "Main Thread" JavaScript, gelant l'interface (plus de scroll, plus de clics) pendant 2-3 secondes.

Avec le Concurrent Mode activé dans le Kernel :
1.  **Low Priority :** Les tâches de déchiffrement (AES-GCM) sont encapsulées dans des transitions (`startTransition` ou implicitement via les effets non-bloquants).
2.  **High Priority :** Les interactions utilisateur (clic, saisie clavier) restent prioritaires.
3.  **Mécanisme :** React peut "pauser" le rendu de la liste de documents déchiffrés pour traiter un clic sur le bouton "Retour", puis reprendre le travail de rendu.

**Impact Utilisateur :** L'interface reste "fluide" (60fps) même si le CPU est saturé à 100% par la cryptographie en arrière-plan.

#### 1.2.2. Automatic Batching
Sivara effectue de nombreuses mises à jour d'état successives lors de l'initialisation (Auth, Profil, Theme, Langue).
*   **Avant React 18 :** 4 `setState` = 4 re-rendus du DOM.
*   **Dans le Kernel Sivara :** React regroupe ces 4 changements en **un seul** cycle de rendu et une seule manipulation du DOM.
*   **Gain :** Réduction drastique du TTI (Time to Interactive) sur mobile.

---

## 2. LA CASCADE DE STYLES (`src/globals.css`)

L'ordre d'importation dans `main.tsx` est une contrainte forte.

```typescript
import "./globals.css"; // DOIT être importé AVANT les composants
```

### 2.1. Anatomie du CSS Global
Ce fichier n'est pas une simple feuille de style. C'est le registre des **Design Tokens**.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* HSL (Hue, Saturation, Lightness) sans 'hsl()' pour la transparence alpha */
    --background: 0 0% 100%; 
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%; /* Noir Profond Sivara */
    /* ... */
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... */
  }
}
```

### 2.2. Stratégie HSL pour l'Opacité Dynamique
Pourquoi utiliser `222.2 47.4% 11.2%` au lieu de `#0f172a` ?
Tailwind a besoin de pouvoir injecter l'opacité au runtime.
*   Classe : `bg-primary/50`
*   Résultat CSS généré : `background-color: hsl(var(--primary) / 0.5);`
*   Si nous utilisions des hexadécimaux, cette fonctionnalité native de CSS ne fonctionnerait pas sans pré-calcul complexe.

### 2.3. Prévention du FOUC (Flash of Unstyled Content)
Le CSS est injecté de manière synchrone par Vite dans le `<head>` avant le premier paint JavaScript. Cela garantit que l'utilisateur ne voit jamais un bouton HTML brut avant qu'il ne soit stylisé.

---

## 3. GESTION DE LA MÉMOIRE (GARBAGE COLLECTION)

Le "Monolithe Virtuel" pose un défi unique : **Les Fuites de Mémoire**.
L'utilisateur peut passer de l'application `Docs` (lourde en mémoire avec des blobs déchiffrés) à l'application `Mail` sans recharger la page (via le routeur).

### 3.1. Le Nettoyage "Scorched Earth"
Lorsqu'un composant de page (`pages/Docs.tsx`) est démonté (unmount), le Kernel s'appuie sur les destructeurs `useEffect` pour purger la mémoire.

**Exemple Critique (`Docs.tsx`) :**
```typescript
useEffect(() => {
    // Montage : Allocation de mémoire pour les Blobs
    const objectUrls = files.map(f => URL.createObjectURL(f));

    return () => {
        // Démontage : Révocation FORCÉE
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        // Reset des clés crypto en RAM
        encryptionService.clearMemory();
    };
}, [files]);
```

Si ce nettoyage n'est pas fait, naviguer de `Docs` -> `Mail` -> `Docs` dix fois ferait crasher le navigateur par saturation de la RAM (OOM - Out of Memory), car les Blobs déchiffrés resteraient orphelins en mémoire.

---

## 4. GESTION DES ERREURS GLOBALE (ERROR BOUNDARIES)

Bien que non visible dans le snippet court de `main.tsx`, l'architecture prévoit une **Barrière d'Erreur (Error Boundary)** implicite au niveau de la racine.

### 4.1. Le "White Screen of Death"
Si une erreur JavaScript survient pendant le rendu (ex: décryptage échoué retournant `null` au lieu d'une string), React démonte tout l'arbre DOM. L'utilisateur se retrouve devant un écran blanc.

### 4.2. Stratégie de Résilience
Dans une future itération (ou implémentation actuelle via un wrapper `App`), une barrière attrape ces erreurs.
*   **Catch :** Intercepte l'erreur JS.
*   **Log :** Envoie l'erreur (sans les données sensibles) au service de monitoring.
*   **Fallback UI :** Affiche un écran "Une erreur critique est survenue" avec un bouton "Recharger l'application" qui force un `window.location.reload()`, purgeant ainsi la mémoire corrompue.

---

## 5. LE DOCUMENT HTML HÔTE (`index.html`)

C'est la coquille vide qui accueille le Kernel.

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sivara - Moteur de recherche intelligent</title>
    <!-- Preconnect pour accélérer le chargement des polices -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 5.1. Sécurité CSP (Content Security Policy)
Bien que définie côté serveur (Vercel headers), la structure HTML est préparée pour une CSP stricte.
*   Aucun script inline (`<script>alert(1)</script>`) n'est présent.
*   Le seul point d'entrée est le module `src/main.tsx`.
*   Cela réduit drastiquement la surface d'attaque XSS.

### 5.2. Viewport Mobile
La balise meta viewport est critique pour l'expérience mobile (Capacitor).
*   `width=device-width` : Adapte la largeur au pixel physique.
*   `initial-scale=1.0` : Empêche le zoom par défaut qui casserait l'interface "App-like".

---

**FIN DU TOME 2**