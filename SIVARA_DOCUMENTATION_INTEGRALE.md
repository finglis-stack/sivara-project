# SIVARA : DOCUMENTATION TECHNIQUE INTÉGRALE ET ANALYSE DU CODE SOURCE
**TYPE DE DOCUMENT :** ANALYSE SYSTÈME COMPLETE (WHITE PAPER)
**ENTITÉ :** SIVARA CANADA INC.
**ARCHITECTURE :** MONOLITHE DISTRIBUÉ / ZERO-KNOWLEDGE
**DATE :** 2025

---

# PRÉAMBULE : ARCHITECTURE DE HAUT NIVEAU

Le projet Sivara n'est pas une simple application web. C'est un **écosystème multi-facettes** (Super-App) hébergé dans un monorepo unique, capable de muter son comportement selon le contexte d'exécution (Mobile Natif vs Web, Sous-domaine A vs Sous-domaine B).

Le système repose sur trois piliers fondamentaux que nous allons disséquer :
1.  **L'Hyperviseur Frontend (React/Vite) :** Un routeur polymorphe capable de servir 6 applications distinctes (`account`, `mail`, `docs`, `device`, `help`, `www`) depuis une seule base de code.
2.  **Le Noyau Cryptographique (Web Crypto API) :** Une couche de chiffrement côté client (E2EE) qui garantit que le serveur (Supabase) ne voit jamais les données en clair ("Blind Storage").
3.  **L'Infrastructure Edge (Deno) :** Des micro-services serverless qui agissent comme des passerelles sécurisées pour les opérations critiques (Paiement, IA, Manipulation de fichiers binaires).

---

# LIVRE I : LE CŒUR DU SYSTÈME (CORE)

Cette section analyse les fichiers fondateurs qui permettent à l'application de démarrer et de router les requêtes.

## 1. L'Orchestration du Démarrage (`src/main.tsx`)

Ce fichier est le point d'entrée JavaScript.
*   **Fonction `createRoot` :** Utilisation de l'API concurrente de React 18. Cela permet le "Time Slicing", essentiel pour que l'interface reste fluide pendant les opérations lourdes de chiffrement/déchiffrement AES qui bloquent normalement le thread principal.
*   **Import CSS :** `import "./globals.css"`. Ce fichier charge Tailwind. L'ordre est critique : il doit être chargé avant tout composant pour que les variables CSS (`:root`) soient disponibles.

## 2. Le Routeur Polymorphe (`src/App.tsx`)

C'est ici que réside l'intelligence de distribution. Le composant `AppRoutes` ne se contente pas de mapper des URL à des pages. Il détecte l'environnement.

### 2.1. Analyse de la logique `currentApp`
Le hook `useMemo` (lignes 42-85) détermine quelle "sous-application" charger.

*   **Branche 1 : Mobile Natif (`Capacitor.isNativePlatform()`)**
    *   Sur iOS/Android, l'application est servie localement (`capacitor://localhost`). Il n'y a pas de sous-domaines.
    *   **Solution :** Le routeur ignore le `hostname` et regarde le paramètre URL `?app=`.
    *   *Exemple :* `sivara://open?app=mail` ouvre l'interface Mail.
    *   *Fallback :* Si aucun paramètre n'est présent, il renvoie `mobile-launcher` (le tableau de bord tactile type iOS).

*   **Branche 2 : Développement Local (`localhost`)**
    *   Pour permettre aux développeurs de travailler sur toutes les apps sans configurer de DNS local complexe (`/etc/hosts`), le code permet de forcer l'app via `?app=docs`, `?app=account`, etc.
    *   Si aucun paramètre n'est fourni, il charge `DevPortal` (un menu de développement exclusif).

*   **Branche 3 : Production (DNS Wildcard)**
    *   C'est le comportement par défaut. Le code analyse le préfixe du `hostname`.
    *   `docs.sivara.ca` -> Charge l'application `docs`.
    *   `account.sivara.ca` -> Charge l'application `account`.
    *   `device.sivara.ca` -> Charge l'application `device`.
    *   `www` ou racine -> Charge le moteur de recherche.

### 2.2. Le Système de Session Cross-Domain
Un problème majeur des architectures multi-domaines est le partage de la session (cookies).
Dans `src/App.tsx`, un `useEffect` (lignes 230+) implémente une solution robuste : **L'injection de Hash**.

1.  Lorsque l'utilisateur se connecte sur `account.sivara.ca`, Supabase redirige vers `docs.sivara.ca`.
2.  Les cookies `SameSite=Lax` peuvent être bloqués ou lents à se propager.
3.  La redirection inclut donc les tokens dans l'URL : `https://docs.sivara.ca/#access_token=XY...&refresh_token=ZB...`.
4.  Le code React détecte ce hash au montage.
5.  Il extrait les tokens via `URLSearchParams`.
6.  Il force l'hydratation de la session locale via `supabase.auth.setSession()`.
7.  Il nettoie l'URL via `window.history.replaceState` pour que l'utilisateur ne voie rien.

## 3. Le Client Supabase (`src/integrations/supabase/client.ts`)

Ce fichier initialise la connexion à la base de données. Une configuration spécifique est cruciale ici :

```typescript
const isProd = hostname.includes('sivara.ca');
const cookieDomain = isProd ? '.sivara.ca' : undefined;
```

*   **Le point `.` avant le domaine :** C'est un détail technique vital. Il indique au navigateur que le cookie d'authentification doit être envoyé à `sivara.ca` ET à tous ses sous-domaines (`*.sivara.ca`). Sans ce point, le SSO (Single Sign-On) est impossible.
*   **Stockage Personnalisé :** Le client utilise `js-cookie` au lieu du `localStorage` par défaut. Pourquoi ? Pour permettre (potentiellement) le SSR (Server-Side Rendering) dans le futur et pour une meilleure sécurité (les cookies HttpOnly sont plus sûrs que le LocalStorage contre les failles XSS, bien qu'ici nous utilisions des cookies JS pour la compatibilité client).

## 4. Le Contexte d'Authentification (`src/contexts/AuthContext.tsx`)

Ce composant React (`AuthProvider`) enveloppe toute l'application.

*   **État `loading` :** Il est initialisé à `true`. Tant que Supabase n'a pas confirmé si l'utilisateur est connecté ou non (via un appel réseau asynchrone `getSession`), l'application affiche un écran de chargement. Cela évite l'effet de scintillement ("Flash of Unauthenticated Content") où l'utilisateur voit brièvement la page de login avant d'être connecté.
*   **Écouteur `onAuthStateChange` :** Il s'abonne aux événements du SDK Supabase.
    *   `TOKEN_REFRESHED` : Met à jour le token en mémoire silencieusement.
    *   `SIGNED_OUT` : Déclenche un nettoyage complet.
*   **Fonction `signOut` Durcie :** Elle ne se contente pas d'appeler l'API. Elle force la suppression du cookie `sivara-auth-token` en définissant sa date d'expiration dans le passé (`Thu, 01 Jan 1970`). C'est une sécurité supplémentaire pour garantir la déconnexion sur les navigateurs capricieux.

---

# LIVRE II : CRYPTOGRAPHIE ET SÉCURITÉ (ZERO-KNOWLEDGE)

Sivara se distingue par son approche de sécurité : le serveur est considéré comme non fiable ("Untrusted Server").

## 5. Le Service de Chiffrement (`src/lib/encryption.ts`)

Ce fichier est une wrapper autour de l'API **Web Crypto** native du navigateur.

### 5.1. Initialisation (Key Derivation)
La méthode `initialize(secret)` transforme un secret (ID utilisateur ou mot de passe) en une clé cryptographique robuste.
*   **Algorithme :** PBKDF2 (Password-Based Key Derivation Function 2).
*   **Hash :** SHA-512.
*   **Itérations :** 100 000. Ce nombre élevé rend le calcul de la clé coûteux en CPU (environ 100-200ms). Cela rend les attaques par force brute (essayer des milliards de mots de passe) impossibles en un temps raisonnable.
*   **Salt :** Un sel cryptographique est ajouté pour empêcher l'utilisation de "Rainbow Tables" (tables de hachage pré-calculées).

### 5.2. Chiffrement (Encryption)
La méthode `encrypt(plaintext)` utilise l'algorithme **AES-GCM** (Advanced Encryption Standard - Galois/Counter Mode).
*   **Pourquoi GCM ?** C'est un mode "authentifié". Il chiffre les données ET génère une signature d'intégrité (Tag).
*   **Intégrité des données :** Si un attaquant modifie un seul bit des données chiffrées dans la base de données, la vérification du Tag échouera lors du déchiffrement et la fonction lèvera une erreur. Cela empêche les attaques par "Bit-Flipping".
*   **IV (Vecteur d'Initialisation) :** Un IV unique de 12 octets est généré aléatoirement pour chaque chiffrement. Ainsi, chiffrer deux fois le même texte ("Bonjour") produira deux résultats totalement différents en base de données.

## 6. Le Format Binaire Propriétaire (`.sivara`) et la VM (`src/lib/sivara-vm.ts`)

Sivara utilise un format de fichier personnalisé pour l'export de données.

### 6.1. Le Kernel (`supabase/functions/sivara-kernel/index.ts`)
Ce n'est pas une simple API, c'est une machine virtuelle binaire hébergée sur le Edge.

*   **Structure du fichier SBP (Sivara Binary Protocol) :**
    *   `HEADER` (4 bytes) : `0x53, 0x56, 0x52, 0x03` ("SVR3"). Signature magique.
    *   `OP_CODES` : Le fichier est une suite d'instructions (`0xB2` pour définir l'IV, `0xD4` pour les métadonnées, `0xC3` pour les données).
*   **Obfuscation (Bit Shuffling) :**
    *   Fonction `sivaraShuffle` : Elle applique une rotation de bits (`<< 2 | >> 6`) et un XOR dynamique sur chaque octet.
    *   **But :** Rendre le fichier illisible pour les outils d'analyse statistique standard (entropie). Même si on extrait la chaîne chiffrée AES, elle est "brouillée" au niveau binaire. Seul le Kernel possède l'algorithme de "Unshuffle".

### 6.2. Les "Smart Contracts" de Sécurité
Lors de la décompilation (`decompile`), le Kernel lit le bloc de métadonnées. Il contient un objet `security`.
*   **Geofencing :** Si `security.geofence` est défini, le Kernel appelle une API de géolocalisation IP. Si l'IP du demandeur est hors du rayon autorisé (ex: 50km autour de Montréal), le Kernel refuse de renvoyer les données chiffrées.
*   **Fingerprinting :** Il peut vérifier l'empreinte du navigateur (`visitorId`) pour restreindre l'ouverture à un appareil spécifique.

---

# LIVRE III : LES APPLICATIONS ET MODULES MÉTIER

Analysons maintenant le code spécifique à chaque "sous-application".

## 7. Sivara Docs (Le Coffre-fort)

### 7.1. L'Éditeur (`src/pages/DocEditor.tsx`)
*   **Moteur :** Utilise **Tiptap**, un éditeur "headless" basé sur ProseMirror.
*   **Sauvegarde Sécurisée :**
    *   Hook `useEditor` -> `onUpdate`.
    *   Le contenu HTML est extrait (`editor.getHTML()`).
    *   Il est passé à `encryptionService.encrypt()`.
    *   Le résultat (chiffré) est envoyé à Supabase. Le serveur ne reçoit jamais le texte clair.
*   **Collaboration Temps Réel (Broadcast) :**
    *   Utilise `supabase.channel` pour émettre des événements éphémères (`cursor-pos`).
    *   Ces données (position de la souris) ne sont pas stockées en base, elles transitent via WebSocket P2P (relayé par le serveur).
    *   Pour le contenu, c'est un modèle "Last-Write-Wins" chiffré.

### 7.2. Le Système de Fichiers (`src/pages/Docs.tsx`)
*   **Structure :** Une table plate `documents` avec une colonne `parent_id` (Adjacency List) pour simuler des dossiers.
*   **Drag & Drop :** Implémenté avec `@dnd-kit`.
    *   `useDraggable` sur les fichiers.
    *   `useDroppable` sur les dossiers et le fil d'ariane (breadcrumbs).
    *   Au "drop", une requête SQL met à jour le `parent_id` du document déplacé.

## 8. Sivara Device (Le Configurateur Matériel)

### 8.1. L'Algorithme de Sélection (`src/pages/DeviceLanding.tsx`)
La fonction `getSmartUnits` résout un problème d'inventaire complexe.
*   **Problème :** Si on affiche simplement `SELECT * FROM units LIMIT 5`, tous les clients voient (et essaient d'acheter) le même ordinateur.
*   **Solution :**
    1.  Récupération de toutes les unités disponibles.
    2.  Application d'un mélange aléatoire (Fisher-Yates Shuffle).
    3.  Sélection intelligente : L'algo essaie de trouver 5 unités ayant des spécifications (RAM/SSD) *différentes* pour offrir de la variété à l'utilisateur.
    4.  Résultat : Une répartition naturelle de la demande sur tout le stock.

### 8.2. L'Oracle Financier (`src/components/OraclePanel.tsx`)
Un outil de visualisation pour les administrateurs (`DeviceCustomerDetails.tsx`).
*   **Simulation Monte-Carlo :** Le hook `useMemo` calcule 3 scénarios de rentabilité (Optimiste, Probable, Pessimiste) sur 24 mois.
*   **Variables :** Il prend en compte l'inflation, la dépréciation du matériel, et surtout le **TrustScore** du client.
*   **Impact du Risque :** Si le client a un faible TrustScore (issu de la vérification d'identité), la courbe "Probable" est pondérée vers le bas (risque de défaut de paiement), alertant l'admin visuellement via un graphique `Recharts`.

### 8.3. Le Checkout (`src/pages/DeviceCheckout.tsx`)
*   **Géolocalisation Google Maps :**
    *   Charge le script Maps API dynamiquement.
    *   Utilise `Places Autocomplete` pour l'adresse.
    *   Utilise `Geometry Library` pour calculer la distance (à vol d'oiseau) entre l'entrepôt (Montréal) et le client.
    *   Si distance < 35km -> Active l'option "Livraison Flash" (Coursier). Sinon -> "Postes Canada".

## 9. Sivara ID (Vérification d'Identité)

### 9.1. L'Analyse IA (`supabase/functions/verify-identity/index.ts`)
*   **Modèle :** Google Gemini 1.5 Flash (Vision).
*   **Prompt Engineering :** Le prompt système est très strict. Il demande à l'IA d'agir comme un "expert forensique". Il demande explicitement de vérifier :
    *   `isScreen` : Est-ce une photo d'un écran ? (Tentative de fraude courante).
    *   `visualAgeEstimation` : L'âge apparent de la personne correspond-il à la date de naissance ?
*   **Validation Algorithmique (RAMQ) :**
    *   Le code ne fait pas confiance aveuglément à l'IA.
    *   Il implémente l'algorithme de checksum du Numéro d'Assurance Maladie du Québec (Nom + Prénom + Date -> Code alphanumérique).
    *   Si le numéro lu par l'OCR correspond au numéro calculé mathématiquement -> Le score de confiance augmente drastiquement.

---

# LIVRE IV : BACKEND ET BASE DE DONNÉES

## 10. Le Schéma de Données (PostgreSQL)

### 10.1. Table `profiles`
*   Pivot central. Lié à `auth.users` via une clé étrangère.
*   Contient les données publiques (Nom, Avatar).
*   **Trigger `handle_new_user` :** Une fonction PL/PGSQL qui s'exécute automatiquement à chaque nouvelle inscription pour créer une ligne vide dans `profiles`. Sans ça, les `JOIN` échoueraient.

### 10.2. Table `crawled_pages` (Moteur de Recherche)
*   **Problème :** Comment rechercher dans du texte chiffré ?
*   **Solution :** Colonne `blind_index` (Tableau de Textes).
*   L'Edge Function `crawl-page` génère des tokens hachés (`HMAC-SHA256`) pour chaque mot clé du document (ex: "pomme" -> `x8f9...`).
*   Ces hashs sont stockés dans `blind_index`.
*   Lors de la recherche, on hache la requête utilisateur et on cherche le hash correspondant. Le contenu reste chiffré (`aes-256-gcm`).

### 10.3. Table `device_units`
*   Utilisation du type `JSONB` pour la colonne `specific_specs`.
*   Cela permet de stocker des configurations matérielles hétérogènes (ex: un Mac a "Unified Memory", un PC a "DDR5") sans créer 50 colonnes nullables. PostgreSQL permet d'indexer et de requêter efficacement ce JSON.

## 11. Les Webhooks (`supabase/functions/stripe-webhook`)

Ce fichier gère la logique métier critique asynchrone.
*   **Sécurité :** Vérifie la signature cryptographique de Stripe (`stripe-signature`) pour s'assurer que la requête vient bien de leurs serveurs.
*   **Idempotence :** Le code est conçu pour gérer le cas où Stripe envoie le même événement deux fois (ce qui arrive).
*   **Logique Métier :**
    *   Si `checkout.session.completed` avec metadata `type: device_rental` :
    *   Met à jour le statut de l'unité de `reserved` à `sold`.
    *   Assigne le `sold_to_user_id`.
    *   Déclenche la préparation de la commande.

---

# LIVRE V : INFRASTRUCTURE MOBILE (CAPACITOR)

## 12. Configuration Native

### 12.1. `capacitor.config.ts`
*   `webDir: 'dist'` : Indique à Capacitor d'embarquer le dossier de build généré par Vite. L'application tourne donc en local sur le téléphone (file://), pas sur un serveur distant, ce qui améliore la vitesse et permet le fonctionnement hors-ligne partiel.

### 12.2. Deep Linking
Dans `App.tsx`, l'écouteur `CapacitorApp.addListener('appUrlOpen')` est essentiel.
*   Quand l'utilisateur clique sur un lien de vérification d'email ou termine un paiement 3DSecure, il est redirigé vers l'app.
*   L'OS ouvre l'app via le schéma `com.example.sivara://`.
*   Le code React intercepte cette URL, parse les paramètres (`access_token`, `refresh_token`) et restaure la session Supabase, permettant une expérience fluide "Web-to-App".

---

# LIVRE VI : DÉPLOIEMENT ET OUTILLAGE

## 13. Le Pipeline de Build (Vite)

*   `vite.config.ts` : Utilise `@vitejs/plugin-react-swc` pour une compilation ultra-rapide (basée sur Rust).
*   **Code Splitting :** Vite découpe automatiquement le bundle. Le code de l'éditeur (lourd) n'est chargé que lorsque l'utilisateur va sur `/docs`. Le code de la caméra n'est chargé que sur `/id`. Cela garantit un chargement initial instantané.

## 14. Le Portail Développeur (`src/pages/DevPortal.tsx`)

Une page cachée, accessible uniquement en `localhost`.
*   Elle simule le routage DNS de production.
*   Elle permet de "monter" les différentes applications (`Docs`, `Mail`) dans le navigateur sans avoir à déployer ou modifier les fichiers hosts. C'est un outil de productivité interne majeur.

---

# CONCLUSION

L'analyse intégrale du code source de Sivara révèle une ingénierie de haute précision. Ce n'est pas un assemblage de librairies, mais une architecture délibérée pour contourner les limitations du Web standard (sécurité, isolation, performance) et offrir une souveraineté numérique réelle. Chaque fonction, du "Bit-Shuffling" du Kernel à l'injection de Hash dans le routeur, sert cet objectif unique.