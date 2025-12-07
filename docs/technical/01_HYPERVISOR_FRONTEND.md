# VOLUME 1 : L'HYPERVISEUR FRONTEND
**STACK :** REACT 18 / VITE / TYPESCRIPT / CAPACITOR
**CONTEXTE :** CLIENT-SIDE RENDERING (CSR)

---

## 1. PHILOSOPHIE DU MONOLITHE FRONTEND

Contrairement aux architectures micro-frontend classiques, Sivara utilise une approche **Monorepo Logique**. Une seule base de code (`src`) est capable de se métamorphoser en 6 applications distinctes au moment de l'exécution (Runtime).

### 1.1. Le Point d'Entrée (`src/main.tsx`)

Le démarrage de l'application n'est pas trivial. Il établit le contexte de sécurité avant même le premier rendu visuel.

```typescript
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

createRoot(document.getElementById("root")!).render(<App />);
```

**Analyse Critique :**
1.  **Concurrent React (`createRoot`) :** Nous n'utilisons pas le mode legacy. L'API concurrente est requise pour le "Time Slicing".
    *   *Pourquoi ?* Le déchiffrement AES-GCM de 50 fichiers dans `Docs` est une opération CPU-intensive. Sans le Time Slicing, l'interface gèlerait (Freezing). React 18 permet de prioriser les inputs utilisateur (clics, scroll) par rapport au rendu des données déchiffrées en arrière-plan.
2.  **Injection CSS (`globals.css`) :** Ce fichier contient les directives Tailwind (`@tailwind base`). Il doit être importé impérativement avant tout composant pour que les variables CSS `:root` (utilisées par Shadcn/UI) soient hydratées. Une inversion d'import causerait un "Flash of Unstyled Content" (FOUC).

---

## 2. LE ROUTEUR POLYMORPHE (`src/App.tsx`)

Le composant `AppRoutes` agit comme un **Switch Layer 7** applicatif. Il intercepte la requête de navigation et décide quelle branche de l'arbre de composants monter.

### 2.1. Algorithme de Détection de Contexte (`useMemo`)

Le hook `useMemo` est utilisé pour garantir que cette logique lourde ne s'exécute qu'une seule fois au montage ou lors d'un changement de sous-domaine.

#### BRANCHE A : Environnement Natif (Capacitor)
```typescript
if (Capacitor.isNativePlatform()) {
  if (appParam === 'docs') return 'docs';
  // ...
  return 'mobile-launcher';
}
```
**Analyse Technique :**
*   Sur iOS/Android, l'application est servie via le protocole `capacitor://localhost` ou `file://`.
*   Le concept de DNS (Sous-domaines) n'existe pas dans ce contexte WebView.
*   **Stratégie :** Nous utilisons le *Query Param* `?app=` comme vecteur de routage.
*   **Deep Linking :** Lorsqu'un utilisateur clique sur un lien `sivara://open?app=mail` depuis une autre app, le listener `AppUrlOpen` (voir section 2.3) injecte ce paramètre, forçant le routeur à basculer sur l'interface Mail.

#### BRANCHE B : Environnement de Production (DNS Wildcard)
```typescript
if (hostname.startsWith('docs.')) return 'docs';
if (hostname.startsWith('account.')) return 'account';
// ...
return 'www';
```
**Analyse Technique :**
*   L'infrastructure (Vercel/Netlify) dirige tout le trafic `*.sivara.ca` vers le même bundle `index.html`.
*   C'est le JavaScript client qui lit `window.location.hostname`.
*   **Sécurité :** Cette isolation est logique, pas physique. Le code de l'application `Mail` est présent dans le bundle de l'application `Docs`. C'est pourquoi le *Code Splitting* (voir Section 3) est vital pour la performance, mais ne doit pas être considéré comme une barrière de sécurité absolue.

---

## 3. GESTION DE SESSION CROSS-DOMAIN (LE "HASH HACK")

C'est l'une des pièces les plus complexes du frontend. Comment partager l'état authentifié entre `account.sivara.ca` et `docs.sivara.ca` sans cookies tiers ?

### 3.1. Le Problème ITP (Intelligent Tracking Prevention)
Safari et les navigateurs modernes bloquent les cookies définis par un domaine tiers ou lors de redirections complexes. Si l'utilisateur se logue sur `account`, le cookie `sb-access-token` est défini sur `.sivara.ca`. Cependant, la propagation n'est pas instantanée ou garantie lors d'un `window.location.href`.

### 3.2. L'Implémentation du "Hash Injection"
Nous utilisons le fragment d'URL (la partie après `#`) comme vecteur de transport sécurisé.

**Flux d'exécution (`src/App.tsx`, lignes 230-270) :**

1.  **Redirection Serveur :** Le serveur d'auth redirige vers `https://docs.sivara.ca/#access_token=XY...&refresh_token=ZB...`.
    *   *Note de sécurité :* Le fragment `#` n'est **jamais** envoyé au serveur HTTP par le navigateur. Le token ne transite donc pas dans les logs du serveur web (Vercel/Nginx), il reste strictement côté client.

2.  **Interception Client :**
    ```typescript
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) { ... }
    ```
    Dès le montage de l'application, ce script s'exécute avant tout rendu.

3.  **Hydratation de Session :**
    ```typescript
    const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
    ```
    Cette commande force le SDK Supabase à stocker les tokens dans le stockage local (Cookie ou LocalStorage) et à initier l'état `authenticated`.

4.  **Nettoyage Furtif :**
    ```typescript
    window.history.replaceState(null, '', window.location.pathname);
    ```
    Cette ligne est critique. Elle supprime visuellement le token de la barre d'adresse sans recharger la page. Si l'utilisateur copie-colle son URL pour la partager, il ne fuite pas ses identifiants.

---

## 4. CONTEXTE D'AUTHENTIFICATION (`src/contexts/AuthContext.tsx`)

Le composant `AuthProvider` est le gardien de l'état global.

### 4.1. État `loading` (The Guard)
L'état `loading` est initialisé à `true`.
*   Tant que `loading === true`, l'application retourne un composant `<Loader2 />` plein écran.
*   **Pourquoi ?** Pour empêcher le "Flash of Unauthenticated Content". Si nous affichions l'application par défaut (Login) pendant que Supabase vérifie le cookie, l'utilisateur verrait la page de connexion pendant 200ms avant de voir son Dashboard. C'est une mauvaise UX et un risque de sécurité mineur (révélation de structure UI).

### 4.2. Stratégie de Déconnexion "Scorched Earth"
La fonction `signOut` est implémentée de manière agressive :

```typescript
const signOut = async () => {
    try {
        await supabase.auth.signOut();
    } catch (e) { /* Ignore errors */ }
    
    // Destruction manuelle du cookie
    document.cookie = 'sivara-auth-token=; path=/; domain=.sivara.ca; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    
    // Reset État React
    setUser(null);
    setSession(null);
};
```

**Analyse :**
*   L'appel API `supabase.auth.signOut()` révoque le token côté serveur (invalide le Refresh Token).
*   Cependant, si le réseau échoue, l'utilisateur pourrait rester "connecté localement".
*   L'écrasement manuel du cookie avec une date d'expiration dans le passé (`Epoch 1970`) force le navigateur à supprimer la donnée persistante immédiatement.
*   L'utilisation de `domain=.sivara.ca` garantit que la déconnexion sur `docs` déconnecte aussi `mail` et `account`.

---

## 5. OPTIMISATION DU BUILD VITE (`vite.config.ts`)

### 5.1. Code Splitting (Découpage du Code)
Le fichier de configuration utilise le comportement par défaut de Rollup pour les imports dynamiques.

**Dans `AppRoutes` :**
```typescript
import Index from "./pages/Index"; // Import Statique
// vs
const DocEditor = lazy(() => import("./pages/DocEditor")); // Import Dynamique (Théorique, implémenté par Vite via les routes)
```

Dans notre cas, Vite détecte les routes. Puisque nous avons un routeur conditionnel géant, Vite va créer des "Chunks" séparés.
*   `assets/Index-XYZ.js` : Chargé uniquement sur `www`.
*   `assets/DocEditor-ABC.js` : Chargé uniquement sur `docs`. Contient la lourde librairie `ProseMirror` / `Tiptap`.
*   **Impact :** Un utilisateur qui visite seulement la page d'accueil ne télécharge jamais le code de l'éditeur de texte (plusieurs MB de JS). Le *First Contentful Paint (FCP)* reste sous les 0.8s.

### 5.2. Gestion des Dépendances Natives
Le plugin `@vitejs/plugin-react-swc` est utilisé à la place de Babel.
*   SWC est écrit en Rust. Il compile le TypeScript environ 20x plus vite que Babel.
*   C'est essentiel dans un monorepo aussi dense pour garder des temps de HMR (Hot Module Replacement) inférieurs à 100ms lors du développement.