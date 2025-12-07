# SIVARA : ENCYCLOPÉDIE TECHNIQUE DU CODE SOURCE
## VOLUME 1 : ARCHITECTURE NUCLÉAIRE, SÉCURITÉ ET NOYAU

**CONFIDENTIEL - PROPRIÉTÉ DE SIVARA CANADA INC.**
**AUTEUR :** SYSTEM ARCHITECT (AI)
**VERSION CODEBASE :** 1.0.0
**DATE :** 2024

---

# SOMMAIRE GÉNÉRAL DU VOLUME 1

**SECTION 1 : FONDATIONS DE L'APPLICATION (FRONTEND)**
   1.1. Analyse du Point d'Entrée (`src/main.tsx`)
   1.2. Orchestration du Routage Polymorphe (`src/App.tsx`)
      1.2.1. Détection d'Environnement (Algorithme `useMemo`)
      1.2.2. Gestion des Sous-domaines (DNS Wildcard)
      1.2.3. Gestion du Contexte Mobile (Capacitor Bridge)
   1.3. Architecture des Routes (`AppRoutes`)
   1.4. Gestionnaire de Session Cross-Domain (Injection de Hash)

**SECTION 2 : COUCHE DE PERSISTANCE ET RÉSEAU (SUPABASE)**
   2.1. Configuration du Client (`src/integrations/supabase/client.ts`)
   2.2. Stratégie de Cookies Globaux (`.sivara.ca`)
   2.3. Gestion du Token PKCE

**SECTION 3 : NOYAU DE SÉCURITÉ (AUTHENTIFICATION)**
   3.1. Le Provider d'Authentification (`src/contexts/AuthContext.tsx`)
      3.1.1. État Global et Hydratation
      3.1.2. Écouteur d'Événements (AuthStateChange)
      3.1.3. Procédure de Déconnexion (Nettoyage Forcé)
   3.2. Interface de Connexion (`src/pages/Login.tsx`)
      3.2.1. Logique UX Progressive (Email -> Password)
      3.2.2. Protection Anti-Spam Client (Throttle)
   3.3. Inscription Atomique (`src/pages/Onboarding.tsx`)

**SECTION 4 : CRYPTOGRAPHIE APPLICATIVE (ZERO-KNOWLEDGE)**
   4.1. Service de Chiffrement (`src/lib/encryption.ts`)
      4.1.1. Initialisation PBKDF2 (Dérivation de Clé)
      4.1.2. Chiffrement AES-256-GCM (Processus)
      4.1.3. Déchiffrement et Intégrité
   4.2. Machine Virtuelle SBP (`src/lib/sivara-vm.ts`)
   4.3. Kernel Serveur (`supabase/functions/sivara-kernel/index.ts`)
      4.3.1. OpCodes et Structure Binaire
      4.3.2. Obfuscation par Bit-Shuffling

**SECTION 5 : MOTEUR DE RECHERCHE "TITANIUM"**
   5.1. Algorithme de Recherche (`supabase/functions/search/index.ts`)
      5.1.1. Tokenisation NLP (Natural Language Processing)
      5.1.2. Indexation Aveugle (Blind Indexing)
      5.1.3. Scoring et Pondération
   5.2. Robot d'Indexation (`supabase/functions/crawl-page/index.ts`)
      5.2.1. Extraction DOM
      5.2.2. Chiffrement des Données Crawlées

**SECTION 6 : LOCATION MATÉRIEL ET ORACLE FINANCIER**
   6.1. Oracle de Rentabilité (`src/pages/DeviceCustomerDetails.tsx`)
      6.1.1. Simulation Monte-Carlo
      6.1.2. Calcul de Dépréciation
   6.2. Vérification d'Identité (`supabase/functions/verify-identity/index.ts`)
      6.2.1. Analyse IA (Gemini Vision)
      6.2.2. Algorithme de Validation NAM

---

# SECTION 1 : FONDATIONS DE L'APPLICATION (FRONTEND)

## 1.1. Analyse du Point d'Entrée (`src/main.tsx`)

Le fichier `main.tsx` est le premier fichier exécuté par le navigateur. Il ne contient aucune logique métier mais établit le contexte d'exécution React.

*   **Importations :**
    *   `createRoot` depuis `react-dom/client` : Utilise l'API concurrente de React 18.
    *   `./globals.css` : Charge les directives Tailwind (`@tailwind base`, etc.) et les variables CSS critiques (`:root`).
*   **Exécution :**
    *   `document.getElementById("root")!` : Sélectionne la `div` vide dans `index.html`. Le `!` (Non-null assertion operator) indique à TypeScript que cet élément existe obligatoirement.
    *   `.render(<App />)` : Injecte le composant racine. Notez l'absence de `React.StrictMode` visible dans l'extrait fourni, ce qui peut être un choix pour éviter les doubles invocations d'effets en développement, ou une omission.

## 1.2. Orchestration du Routage Polymorphe (`src/App.tsx`)

C'est le fichier le plus complexe structurellement du Frontend. Il transforme une SPA (Single Page Application) classique en une "Super-App" multi-facettes.

### 1.2.1. Détection d'Environnement (Algorithme `useMemo`)

Le composant `AppRoutes` utilise un hook `useMemo` pour calculer la variable `currentApp`. Ce calcul est "coûteux" (parsing d'URL, vérifications natives) et ne doit être réexécuté que si `searchParams` ou `hostname` changent.

**Logique Détaillée :**

1.  **Branche Mobile (Capacitor) :**
    *   `if (Capacitor.isNativePlatform())` : Vérifie si l'app tourne dans une WebView native via l'injection du bridge Capacitor.
    *   Si Vrai : Le routage par sous-domaine est impossible (l'app est servie via `capacitor://` ou `http://localhost`).
    *   Mécanisme de repli : Utilise le paramètre de requête `?app=...`.
    *   Défaut : Renvoie `mobile-launcher`, déclenchant l'affichage de l'interface tactile `MobileLanding`.

2.  **Branche Développement (Localhost) :**
    *   `if (hostname === 'localhost' || hostname === '127.0.0.1')` : Détecte l'environnement développeur.
    *   Priorité : Le paramètre `?app=` écrase tout. Cela permet au développeur de tester l'interface "Mail" (`/?app=mail`) sans configurer de DNS local.
    *   Défaut : Renvoie `dev-portal`, une page spéciale (`DevPortal.tsx`) listant toutes les applications disponibles.

3.  **Branche Production (DNS Wildcard) :**
    *   C'est le cas par défaut (`else`).
    *   Analyse : `hostname.startsWith('prefix.')`.
    *   `docs.` -> App `docs`.
    *   `account.` -> App `account`.
    *   `mail.` -> App `mail`.
    *   `help.` -> App `help`.
    *   `device.` -> App `device`.
    *   `id.` -> App `id` (Vérification d'identité).
    *   Défaut : `www` (Le moteur de recherche).

### 1.3. Architecture des Routes (`AppRoutes`)

Le composant retourne un ensemble de `<Routes>` conditionnel basé sur `currentApp`. C'est une forme de "Lazy Loading" logique.

**Bloc `account` :**
*   Routes : `/login`, `/reset-password`, `/onboarding`, `/pricing`, `/checkout`, `/profile`.
*   Sécurité : Les routes `/pro-onboarding` et `/profile` sont enveloppées dans `<ProtectedRoute>`. Ce composant (défini ailleurs) vérifie l'existence de `user` dans le contexte et redirige vers `/login` si absent.

**Bloc `device` :**
*   Routes : `/` (Landing), `/checkout`, `/admin`.
*   Spécificité : La route `/admin` est protégée. `DeviceAdmin` contient une vérification supplémentaire (`isVendor`) pour s'assurer que l'utilisateur a le rôle vendeur.

**Bloc `docs` :**
*   Routes : `/` (Liste fichiers), `/:id` (Éditeur).
*   Fallback : Si un utilisateur tente d'accéder à une route inexistante, et qu'il est sur mobile, il est redirigé vers le launcher (`/?app=mobile`). Sinon, page 404.

### 1.4. Gestionnaire de Session Cross-Domain (Injection de Hash)

Le composant `App` contient un `useEffect` critique (lignes 228-270 dans le fichier fourni).

**Problème à résoudre :**
Les cookies `SameSite=Lax` ne sont pas toujours partagés immédiatement ou fiablement entre sous-domaines dans certains navigateurs stricts, ou lors de redirections OAuth complexes.

**Solution Implémentée :**
1.  Le code écoute le chargement de la page.
2.  Il vérifie `window.location.hash` (la partie après `#`).
3.  Si le hash contient `access_token` :
    *   Cela signifie que Supabase (ou le SSO) a redirigé l'utilisateur avec les credentials dans l'URL.
    *   Parsing : `new URLSearchParams(hash.substring(1))` extrait le token.
    *   Injection : `supabase.auth.setSession(...)` force le client local à utiliser ce token immédiatement.
    *   Nettoyage : `window.history.replaceState` retire le token de l'URL pour qu'il ne soit pas visible par l'utilisateur ou l'historique.
    *   Revalidation : `await supabase.auth.getUser()` vérifie que le token est bien valide côté serveur.

---

# SECTION 2 : COUCHE DE PERSISTANCE ET RÉSEAU (SUPABASE)

## 2.1. Configuration du Client (`src/integrations/supabase/client.ts`)

Ce fichier initialise l'unique instance du client Supabase utilisée par toute l'application. C'est un Singleton.

**Variables :**
*   `supabaseUrl` : L'endpoint API (`https://asctcqyupjwjifxidegq.supabase.co`).
*   `supabaseAnonKey` : La clé publique. Elle permet d'initier des connexions, mais ne donne aucun droit d'admin. La sécurité repose sur le RLS (Row Level Security) côté serveur, pas sur cette clé.

## 2.2. Stratégie de Cookies Globaux

La configuration `auth.storage` est personnalisée pour utiliser la librairie `js-cookie`.

**Code Critique :**
```typescript
const isProd = hostname.includes('sivara.ca');
const cookieDomain = isProd ? '.sivara.ca' : undefined;
```
*   Le point devant `.sivara.ca` est vital. Il indique au navigateur que le cookie est valide pour `sivara.ca` ET tous ses sous-domaines (`docs.sivara.ca`, `mail.sivara.ca`).
*   Sans ce point, la connexion sur `account` ne serait pas reconnue sur `docs`.

**Sécurité du Cookie :**
*   `sameSite: 'Lax'` : Protège contre les attaques CSRF tout en permettant la navigation top-level.
*   `secure: isProd` : Force HTTPS en production.

---

# SECTION 3 : NOYAU DE SÉCURITÉ (AUTHENTIFICATION)

## 3.1. Le Provider d'Authentification (`src/contexts/AuthContext.tsx`)

C'est le "Système Nerveux" de l'application.

### 3.1.1. État Global
*   `user` : L'objet utilisateur (contient l'UUID `user.id` utilisé partout).
*   `session` : Contient le `access_token` (JWT) utilisé pour signer les requêtes API.
*   `loading` : Un booléen `true` par défaut. Il empêche l'application d'afficher quoi que ce soit ("Flash of Unauthenticated Content") tant que Supabase n'a pas confirmé si l'utilisateur est connecté ou non.

### 3.1.2. Écouteur d'Événements (`onAuthStateChange`)
Supabase émet des événements en temps réel. Le contexte s'y abonne :
*   `SIGNED_IN` : Met à jour l'état `user` et `session`.
*   `SIGNED_OUT` : Appelle le nettoyage.
*   `TOKEN_REFRESHED` : Met à jour la session avec le nouveau JWT (les tokens expirent généralement après 1h).

### 3.1.3. Procédure de Déconnexion (`signOut`)
La fonction `signOut` est durcie :
1.  Appel serveur `supabase.auth.signOut()` pour révoquer le refresh token côté serveur.
2.  `catch` silencieux : Si l'utilisateur est déjà déconnecté (session invalide), on ne bloque pas le processus.
3.  **Nettoyage manuel des cookies :** En production, le script écrase explicitement le cookie `sivara-auth-token` avec une date d'expiration dans le passé (`Thu, 01 Jan 1970`) pour forcer le navigateur à le supprimer, garantissant une déconnexion propre cross-domain.

## 3.2. Interface de Connexion (`src/pages/Login.tsx`)

### 3.2.1. Logique UX Progressive
L'interface est divisée en étapes (`email` -> `password`).
1.  L'utilisateur entre son email.
2.  Le système ne vérifie pas le mot de passe tout de suite.
3.  Transition vers l'étape mot de passe.
*   *Pourquoi ?* Cela permet d'ajouter à l'avenir une étape intermédiaire (SSO, 2FA, ou détection si le compte existe) sans changer l'UI.

### 3.2.2. Protection Anti-Spam Client
Une variable d'état `blockedUntil` (timestamp) est utilisée.
*   Si l'utilisateur échoue ou soumet trop vite, `blockedUntil` est défini dans le futur (ex: Date.now() + 5000).
*   Le bouton "Se connecter" est désactivé tant que `Date.now() < blockedUntil`.
*   C'est une protection UX (User Experience) pour éviter le spam de clics, bien que la vraie sécurité soit côté serveur (Rate Limiting Supabase).

## 3.3. Inscription Atomique (`src/pages/Onboarding.tsx`)

La création de compte est une opération en deux temps qui doit réussir ou échouer totalement.

1.  **Auth (Identity) :** `supabase.auth.signUp({ email, password })`. Crée l'entrée dans la table système `auth.users`. Retourne un `user.id`.
2.  **Profil (Data) :** `supabase.from('profiles').insert({ id: user.id, ... })`. Crée l'entrée dans la table publique `public.profiles` avec les données métier (Prénom, Nom).
3.  **Gestion d'Erreur :** Si l'étape 2 échoue (ex: erreur réseau), l'utilisateur a un compte Auth mais pas de profil. *Note Technique :* Idéalement, un Trigger PostgreSQL (`handle_new_user`) devrait être utilisé en backup pour créer un profil vide automatiquement si l'insertion manuelle échoue, garantissant l'intégrité des données.

---

# SECTION 4 : CRYPTOGRAPHIE APPLICATIVE (ZERO-KNOWLEDGE)

## 4.1. Service de Chiffrement (`src/lib/encryption.ts`)

C'est la classe la plus critique de l'application Docs. Elle assure que le serveur ne peut jamais lire les données.

### 4.1.1. Initialisation PBKDF2
La méthode `initialize(secret, saltString)` génère la clé de chiffrement (Master Key).
*   **Entrée :** `secret` (ID utilisateur ou mot de passe document).
*   **Sel (Salt) :** Si non fourni, utilise une chaîne dérivée de l'ID + une constante statique (`sivara-docs-persistent-key-v2`).
*   **Algorithme :** PBKDF2 (Password-Based Key Derivation Function 2).
*   **Paramètres :** `SHA-512`, `100 000` itérations. C'est un standard élevé pour rendre les attaques par force brute (GPU cracking) trop coûteuses en temps.
*   **Sortie :** Une `CryptoKey` stockée en mémoire (variable privée de la classe `EncryptionService`). Elle n'est jamais écrite sur le disque ou dans `localStorage`.

### 4.1.2. Chiffrement AES-256-GCM
La méthode `encrypt(plaintext)` :
1.  **IV (Vecteur d'Initialisation) :** Génère 12 octets aléatoires via `crypto.getRandomValues`. L'IV garantit que chiffrer deux fois "Bonjour" donnera deux résultats différents.
2.  **Encodage :** Convertit le texte en `Uint8Array` (UTF-8).
3.  **Chiffrement :** Appelle `crypto.subtle.encrypt` (API native du navigateur, très rapide car codée en C++ dans le moteur JS).
    *   Mode : AES-GCM (Galois/Counter Mode). Ce mode fournit confidentialité ET intégrité (on ne peut pas modifier le texte chiffré sans casser la signature interne).
4.  **Retour :** Un objet `{ encrypted, iv }`, tous deux convertis en chaînes Base64 pour le transport JSON.

### 4.1.3. Déchiffrement
La méthode `decrypt(encrypted, ivBase64)` :
1.  Reconvertit les Base64 en `ArrayBuffer`.
2.  Appelle `crypto.subtle.decrypt`.
3.  Si la clé est mauvaise ou si les données ont été altérées, cette fonction lance une exception (erreur d'intégrité GCM).

## 4.3. Kernel Serveur (`supabase/functions/sivara-kernel/index.ts`)

Cette Edge Function Deno est le gardien du format de fichier propriétaire `.sivara`.

### 4.3.1. OpCodes et Structure Binaire
Le fichier `.sivara` n'est pas du JSON. C'est un flux binaire structuré par des codes opérations (OpCodes).
*   `0x53, 0x56, 0x52, 0x03` (SVR3) : Magic Header. Identifie le fichier.
*   `0xB2` : Indique le début du bloc IV.
*   `0xD4` : Indique le début des métadonnées (Sécurité).
*   `0xC3` : Indique le début des données (Payload chiffré).
*   `0xFF` : Fin de fichier.

### 4.3.2. Obfuscation par Bit-Shuffling
Pour empêcher l'analyse du fichier par des outils standards, une fonction `sivaraShuffle` est appliquée sur les données avant l'écriture.
*   Algorithme : Pour chaque octet, applique une rotation de bits (`<< 2 | >> 6`) puis un XOR avec une clé dérivée de la position (`seed + index`).
*   Résultat : Même si on extrait la chaîne AES, elle est illisible sans passer par le `unshuffle`. C'est une sécurité par obscurité qui s'ajoute au chiffrement AES fort.

---

# SECTION 5 : MOTEUR DE RECHERCHE "TITANIUM"

## 5.1. Algorithme de Recherche (`supabase/functions/search/index.ts`)

Cette fonction permet de rechercher dans des données chiffrées sans les déchiffrer (Privacy-Preserving Search).

### 5.1.1. Indexation Aveugle (Blind Indexing)
Le concept est de transformer les mots en hashs irréversibles.
1.  Le mot "Pomme" est tokenisé.
2.  Il est signé via HMAC-SHA256 avec une `SEARCH_KEY` (stockée sur le serveur, jamais envoyée au client).
3.  Résultat : `hmac("Pomme")` -> `a94b8...`
4.  La base de données stocke `a94b8...` dans un tableau `blind_index`.

Lors de la recherche :
1.  L'utilisateur tape "Pomme".
2.  Le serveur calcule `hmac("Pomme")` -> `a94b8...`.
3.  La requête SQL cherche `a94b8...`.
4.  Si trouvé, le serveur renvoie l'ID du document. Le contenu reste chiffré.

### 5.1.3. Scoring et Pondération
La fonction génère plusieurs tokens pour un même mot pour améliorer la pertinence :
*   `EX:mot` (Exact) : Poids 100.
*   `ST:racine` (Stemming) : Poids 80.
*   `PH:phonetique` (Phonétique) : Poids 50.
*   `TG:trigramme` (Partiel) : Poids 5.

L'algorithme de classement additionne ces poids pour chaque document trouvé et trie par score descendant.

---

# SECTION 6 : LOCATION MATÉRIEL ET ORACLE FINANCIER

## 6.1. Oracle de Rentabilité (`src/pages/DeviceCustomerDetails.tsx`)

Ce module, utilisé dans le dashboard admin `DeviceCustomerDetails`, est un outil d'aide à la décision financière (FinTech).

### 6.1.1. Simulation Monte-Carlo
Le hook `useMemo` (lignes 100-200) exécute une simulation sur 24 mois.
*   **Inputs :** Coût matériel, Prix vente, Taxe, TrustScore client.
*   **Variables Aléatoires :**
    *   `churnRisk` : Probabilité que le client arrête de payer. Elle est inversement proportionnelle au `trustScore` (score de confiance).
    *   `marketVolatility` : Impacte la valeur de revente du matériel.
*   **Scénarios :**
    *   *Optimiste :* Paiements parfaits, revente matériel au prix fort.
    *   *Probable :* Applique le taux de rétention statistique.
    *   *Pessimiste :* Simule un défaut de paiement (Crash) à un mois critique calculé par l'IA.

### 6.2. Vérification d'Identité (`supabase/functions/verify-identity/index.ts`)

### 6.2.1. Analyse IA (Gemini Vision)
L'Edge Function reçoit les images Base64 des pièces d'identité.
Elle appelle l'API Google Generative AI (Gemini 1.5 Flash ou Pro) avec un prompt d'ingénierie système très précis ("You are a forensic document expert...").
*   Le prompt demande d'extraire le JSON strict : Nom, Prénom, Date de Naissance, Numéro de Document, Expiration.
*   Il demande aussi une analyse de fraude : "IsScreen" (est-ce une photo d'écran ?), "VisualAge" (l'âge visuel correspond-il à la date de naissance ?).

### 6.2.2. Algorithme de Validation NAM (Québec)
Une fonction `generateTheoreticalNAM` implémente l'algorithme officiel de la RAMQ (Régie de l'assurance maladie du Québec).
*   Prend Nom, Prénom, Date de naissance.
*   Génère le code alphanumérique attendu (ex: `DUJP12345678`).
*   Compare avec le numéro lu par l'OCR sur la carte.
*   Si ça matche : **TrustScore +60**. C'est une preuve mathématique de cohérence forte.

---

# SECTION 7 : MODULE SIVARA MAIL

## 7.1. Interface de Réception
Le composant `MailInbox` interroge la table `emails`.
Particularité : Le champ `body` est chiffré. L'affichage nécessite l'instanciation d'`EncryptionService` pour déchiffrer le contenu à la volée.

## 7.2. Webhook Inbound (`supabase/functions/inbound-mail`)
Ce webhook est la cible configurée dans les enregistrements DNS MX (via un service comme AWS SES ou Resend).
*   Reçoit un JSON brut de l'email entrant.
*   Parse l'expéditeur et le destinataire.
*   **Resolution d'Identité :** Cherche le `user_id` correspondant à l'adresse email destinataire dans `profiles`.
*   **Insertion :** Insère le message dans la table `emails` liée à cet utilisateur.

---

**FIN DU VOLUME 1**
*La suite de la documentation (Volume 2 : Frontend Avancé et Design System) est disponible sur demande.*