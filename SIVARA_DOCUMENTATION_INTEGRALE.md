# SIVARA OMNIBUS : ANALYSE SYSTÈME TOTALE
**TYPE :** WHITE PAPER D'INGÉNIERIE (NIVEAU KERNEL)
**ENTITÉ :** SIVARA CANADA INC.
**ARCHITECTURE :** MONOLITHE DISTRIBUÉ / ZERO-KNOWLEDGE / EDGE-NATIVE
**DATE :** 2025

---

# TABLE DES MATIÈRES ET ARCHITECTURE

1.  **L'HYPERVISEUR FRONTEND (REACT/VITE)**
    *   Analyse du Routage Contextuel (`App.tsx`)
    *   Gestion de Session Cross-Domain (Injection de Hash)
    *   Contexte d'Authentification (`AuthContext.tsx`)
2.  **LE NOYAU CRYPTOGRAPHIQUE (ZERO-KNOWLEDGE)**
    *   Implémentation Web Crypto API (`encryption.ts`)
    *   Machine Virtuelle et Protocole Binaire SBP (`sivara-kernel`)
3.  **L'INFRASTRUCTURE EDGE (SERVERLESS)**
    *   Moteur d'Indexation Aveugle ("Titanium")
    *   Vérification d'Identité Biométrique (IA & Algorithmes)
    *   Passerelle de Paiement et Abonnements Matériels
4.  **L'ORACLE FINANCIER (DAAS)**
    *   Modélisation Monte-Carlo et Gestion des Risques
    *   Logique de Rentabilité et Churn
5.  **BASE DE DONNÉES ET SÉCURITÉ (POSTGRESQL)**
    *   Schéma, RLS et Triggers
6.  **INTERFACE MOBILE (CAPACITOR)**
    *   Pont Natif et Deep Linking

---

# LIVRE I : L'HYPERVISEUR FRONTEND (REACT/VITE)

L'application SIVARA n'est pas un site web classique. C'est une **Super-App** qui utilise une seule base de code pour servir 6 applications distinctes.

## 1. Le Routeur Polymorphe (`src/App.tsx`)

Le fichier `src/App.tsx` contient le cerveau du routage. Il ne se contente pas de regarder l'URL, il analyse l'environnement d'exécution.

### 1.1. L'Algorithme de Détection (`useMemo`)

Le hook `useMemo` (lignes 40-90) calcule la variable `currentApp` qui détermine quelle interface charger. C'est un *Switch Layer 7* implémenté côté client.

#### A. La Priorité Native (Capacitor)
```typescript
if (Capacitor.isNativePlatform()) {
  if (appParam === 'docs') return 'docs';
  // ...
  return 'mobile-launcher';
}
```
**Analyse Technique :**
Sur iOS et Android, l'application est servie via le protocole `capacitor://` ou `file://`. Le concept de "sous-domaine" n'existe pas. Le routeur intercepte donc le paramètre de requête `?app=` pour simuler la navigation entre les modules.
*   **Pourquoi ?** Cela permet de partager 100% du code JS entre le web et le mobile sans utiliser React Native. C'est du "Web Native".
*   **Le Launcher :** Si aucun paramètre n'est fourni, l'application charge `MobileLanding`, un tableau de bord tactile conçu spécifiquement pour le mobile (pas de header desktop, gros boutons tactiles).

#### B. La Détection de Production (DNS Wildcard)
```typescript
if (hostname.startsWith('docs.')) return 'docs';
if (hostname.startsWith('account.')) return 'account';
```
**Analyse Technique :**
L'infrastructure DNS (Vercel/Netlify) est configurée en Wildcard (`*.sivara.ca`). Tout le trafic arrive sur la même instance React.
*   Le code analyse le préfixe du `window.location.hostname`.
*   Cela permet une **isolation logique** totale pour l'utilisateur (il a l'impression de changer de site) tout en conservant un **état partagé** (AuthContext, Cache React Query) si on navigue via `window.history`.

### 1.2. Le Hack de Session Cross-Domain (Injection de Hash)

Comment partager une session entre `account.sivara.ca` et `docs.sivara.ca` si les cookies tiers sont bloqués (Safari ITP) ?

**Le Code (Lignes 230-270) :**
```typescript
const hash = window.location.hash;
if (hash && hash.includes('access_token')) {
    // Parsing manuel
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    
    // Injection forcée
    await supabase.auth.setSession({ ... });
    
    // Nettoyage furtif
    window.history.replaceState(null, '', window.location.pathname);
}
```

**Explication du Mécanisme :**
1.  L'utilisateur se logue sur `account`.
2.  Le serveur redirige vers `docs` en ajoutant le token dans le fragment URL (`#access_token=...`). Le fragment n'est **jamais** envoyé au serveur HTTP, il reste dans le navigateur.
3.  Le code React se réveille, détecte le hash, extrait le token, initialise la session Supabase, et supprime le hash de la barre d'adresse en moins de 100ms.
4.  **Résultat :** Une authentification transparente et incassable, indépendante des politiques de cookies des navigateurs.

## 2. Le Contexte d'Authentification (`src/contexts/AuthContext.tsx`)

Ce fichier est le "Système Nerveux" de l'application.

### 2.1. Gestion de l'État `loading`
L'état `loading` est initialisé à `true`.
*   **Pourquoi ?** Pour éviter le "Flash of Unauthenticated Content". L'application n'affiche **rien** (ou un loader) tant que Supabase n'a pas répondu (via `getSession` ou stockage local).
*   C'est crucial pour la sécurité UX : on ne veut pas montrer le Dashboard Admin une milliseconde avant de rediriger vers le Login.

### 2.2. La Déconnexion Durcie (`signOut`)
La fonction `signOut` ne fait pas confiance à l'API `supabase.auth.signOut()`.
```typescript
document.cookie = 'sivara-auth-token=; path=/; domain=.sivara.ca; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
```
**Analyse :**
Elle force l'écrasement manuel du cookie au niveau du navigateur en définissant une date d'expiration dans le passé (Epoch 1970). Le paramètre `domain=.sivara.ca` (avec le point initial) assure que le cookie est tué sur **tous** les sous-domaines simultanément.

---

# LIVRE II : LE NOYAU CRYPTOGRAPHIQUE (ZERO-KNOWLEDGE)

C'est ici que Sivara se différencie d'un SaaS standard. Le serveur est considéré comme **hostile**.

## 1. Le Service de Chiffrement (`src/lib/encryption.ts`)

Ce fichier est une wrapper autour de l'API native **Web Crypto** (`window.crypto.subtle`). Il n'utilise aucune librairie JS tierce pour la crypto pure (performance et sécurité).

### 1.1. Dérivation de Clé (PBKDF2)
La méthode `initialize` transforme un secret (ID utilisateur ou mot de passe) en matériel cryptographique.
*   **Algorithme :** `PBKDF2` (Password-Based Key Derivation Function 2).
*   **Hash :** `SHA-512` (Le plus robuste actuellement).
*   **Itérations :** `100 000`. Ce chiffre est choisi pour imposer un coût CPU d'environ 100ms par tentative. Cela rend les attaques par force brute (Brute Force) ou Rainbow Tables économiquement non viables pour un attaquant qui volerait la base de données.
*   **Salt :** Utilise un sel statique dérivé de l'ID utilisateur si aucun sel n'est fourni, garantissant que deux utilisateurs avec le même mot de passe auront des clés maîtresses différentes.

### 1.2. Le Chiffrement Authentifié (AES-GCM)
La méthode `encrypt` utilise **AES-256-GCM** (Galois/Counter Mode).
*   **Pourquoi GCM ?** C'est un mode de chiffrement authentifié (AEAD). Il produit non seulement un texte chiffré, mais aussi un "Tag" d'authentification.
*   **Protection contre la Malléabilité :** Si un attaquant (ou le serveur) modifie un seul bit du blob chiffré dans la base de données, la vérification du Tag échouera lors du déchiffrement (`Integrity check failed`). Cela empêche les attaques par "Bit-Flipping" qui pourraient corrompre les données de manière subtile.
*   **IV (Vecteur d'Initialisation) :** Un IV unique de 12 octets est généré pour chaque opération (`crypto.getRandomValues`). Chiffrer deux fois le mot "Secret" produira deux blobs binaires totalement différents.

## 2. Le Kernel SIVARA (`supabase/functions/sivara-kernel/index.ts`)

Cette Edge Function est une machine virtuelle binaire qui gère le format de fichier propriétaire `.sivara`.

### 2.1. Le Protocole SBP (Sivara Binary Protocol)
Le fichier `.sivara` n'est pas du JSON. C'est un flux de bytes structuré.
*   **Magic Header :** `0x53, 0x56, 0x52, 0x03` (ASCII "SVR3"). Permet d'identifier le fichier.
*   **OpCodes :**
    *   `0xB2` : Bloc IV (Initialization Vector).
    *   `0xD4` : Bloc Méta-données (Contrats de sécurité).
    *   `0xC3` : Bloc Données (Payload AES chiffré).
    *   `0xFF` : Fin de fichier (EOF).

### 2.2. Obfuscation par "Bit-Shuffling"
Avant d'écrire les données, le Kernel applique une transformation binaire propriétaire : `sivaraShuffle`.
```typescript
result[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ key;
```
1.  **Rotation de Bits :** Décale les bits de 2 positions vers la gauche (circulaire).
2.  **XOR Dynamique :** Applique un OU Exclusif avec une clé dérivée de la position (`seed + i`).
**Objectif :** Détruire l'entropie statistique du fichier. Un analyseur de fichiers standard ne verra que du bruit blanc, rendant l'identification du contenu (même chiffré) impossible sans connaître l'algorithme de "Unshuffle".

### 2.3. Les "Smart Contracts" de Sécurité
Lors de la décompilation (`decompile`), le Kernel agit comme un gardien. Il lit le bloc `META_TAG` qui contient un objet JSON de sécurité.
*   **Geofencing :** Si le fichier a été restreint géographiquement, le Kernel appelle une API de géolocalisation IP (`ipgeolocation.io`). Il calcule la distance géodésique entre l'IP du client et le centre autorisé. Si `distance > radius`, le Kernel lève une exception et **ne renvoie jamais** le payload chiffré.
*   **Fingerprinting :** Il compare l'empreinte navigateur (`visitorId`) stockée dans le fichier avec celle du demandeur.
**Conséquence :** Même si un attaquant vole le fichier `.sivara` et le mot de passe, il ne peut pas l'ouvrir s'il n'est pas physiquement au bon endroit ou sur la bonne machine.

---

# LIVRE III : L'INFRASTRUCTURE EDGE (SERVERLESS)

Sivara délègue la logique critique à des fonctions Deno exécutées en bordure de réseau (Edge), proches de l'utilisateur.

## 1. Le Moteur de Recherche "Titanium" (`supabase/functions/search/index.ts`)

Comment rechercher dans des données chiffrées sans les déchiffrer ? C'est le défi du "Blind Indexing".

### 1.1. Tokenisation et Hachage (Blind Index)
Au moment de l'indexation (`crawl-page`), le texte est décomposé en tokens (mots).
Chaque token subit une transformation irréversible : `HMAC-SHA256(SEARCH_KEY, token)`.
*   Le mot "Pomme" devient `a94b8...`.
*   La racine "Pomm" devient `b2c3d...` (Stemming).
*   La phonétique "PM" devient `f5e6...` (Double Metaphone).

Ces hashs sont stockés dans la colonne `blind_index` (Array) de la base de données. Le serveur ne voit que des hashs.

### 1.2. Algorithme de Recherche (Retrieval)
1.  L'utilisateur tape "Pomme".
2.  L'Edge Function reçoit "Pomme", calcule les mêmes hashs (`a94b8...`, etc.) avec la `SEARCH_KEY` (qui n'est jamais envoyée au client).
3.  Elle exécute une requête SQL `&&` (Array Overlap) pour trouver les documents contenant ces hashs.
4.  **Scoring :** Elle pondère les résultats (Match Exact = 100pts, Phonétique = 50pts).
5.  Elle déchiffre le titre/URL (AES) *uniquement* pour les résultats trouvés avant de les renvoyer.

## 2. Vérification d'Identité (`supabase/functions/verify-identity/index.ts`)

Ce service est le pare-feu contre la fraude matérielle.

### 2.1. Analyse Visuelle (Gemini Vision)
Le code envoie les images brutes des pièces d'identité à l'API Google Gemini.
**Prompt Engineering Critique :** Le prompt ne demande pas juste de lire. Il demande d'agir comme un expert forensique.
*   Il demande de vérifier les "artefacts de compression" (signe de Photoshop).
*   Il demande de vérifier si c'est une "photo d'écran" (Screen Detection).
*   Il demande une "Visual Age Estimation" pour comparer avec la date de naissance.

### 2.2. Algorithme de Validation NAM (Québec)
Le code implémente l'algorithme officiel de checksum de la RAMQ (Régie de l'assurance maladie du Québec).
*   Il prend le Nom, Prénom, Sexe et Date de Naissance extraits par l'IA.
*   Il génère le code alphanumérique théorique (ex: `DUJP12345678`).
*   Il compare avec le code lu sur la carte.
*   Si ça matche : **TrustScore +60**. C'est une preuve mathématique de cohérence.

---

# LIVRE IV : L'ORACLE FINANCIER (DAAS)

Le module "Device" n'est pas un simple e-commerce. C'est un produit financier de location (Leasing) géré par un moteur de risque.

## 1. Simulation Monte-Carlo (`src/components/OraclePanel.tsx`)

Dans le dashboard administrateur, le composant `OraclePanel` exécute une simulation financière complexe en temps réel.

### 1.1. Les Variables Stochastiques
*   **Inputs :** Coût du matériel, Prix de l'abonnement, Dépôt initial.
*   **Risque (TrustScore) :** Le score issu de la vérification d'identité (0-100) est inversé pour devenir une probabilité de "Churn" (Défaut de paiement).
*   **Volatilité :** Un curseur permet de simuler la variation de la valeur de revente du matériel sur le marché secondaire.

### 1.2. La Projection des Flux (Cashflow)
L'algorithme projette sur 24 mois :
*   **Courbe Optimiste :** Le client paie tous les mois, le matériel garde sa valeur.
*   **Courbe Probable :** Applique le taux de rétention basé sur le TrustScore. Chaque mois, la probabilité que le client continue de payer diminue légèrement (`retentionRate`).
*   **Courbe Pessimiste :** Simule un "Crash" (arrêt des paiements et perte du matériel) à un mois critique calculé par l'IA.

**Résultat :** L'admin voit instantanément le ROI (Retour sur Investissement) et le "Break Even Point" (le mois où le contrat devient rentable).

---

# LIVRE V : BASE DE DONNÉES (POSTGRESQL)

## 1. Row Level Security (RLS)

C'est la barrière de sécurité ultime. Même si le serveur Node.js est compromis, il ne peut pas lire les données sans le bon contexte utilisateur.

### 1.1. Politique d'Accès aux Documents
```sql
CREATE POLICY "Access via document_access" ON documents
FOR SELECT USING (
  (owner_id = auth.uid()) OR 
  (visibility = 'public') OR 
  (EXISTS (SELECT 1 FROM document_access da WHERE da.document_id = id AND da.email = auth.email()))
);
```
**Analyse :** Cette requête est injectée par le moteur Postgres dans *chaque* `SELECT` fait sur la table `documents`. Elle vérifie mathématiquement si l'utilisateur est le propriétaire OU s'il a été explicitement invité via la table de jointure `document_access`.

## 2. Le Modèle de Données Hybride (`device_units`)

La table `device_units` utilise une colonne `specific_specs` de type `JSONB`.
*   **Pourquoi ?** Le parc informatique est hétérogène. Un MacBook a de la "Mémoire Unifiée", un PC a de la "DDR5". Un écran est "Retina" ou "OLED".
*   Plutôt que de créer 50 colonnes nullables, on stocke un document JSON flexible. Postgres permet d'indexer ce JSON (`GIN Index`) pour faire des recherches ultra-rapides comme `specific_specs->>'ram_size' = '16'`.

---

# LIVRE VI : INTERFACES ET MICRO-INTERACTIONS

## 1. L'Éditeur (`src/pages/DocEditor.tsx`)

### 1.1. La Collaboration Temps Réel (Broadcast)
L'éditeur utilise les **Channels Supabase** pour la collaboration.
*   **Curseurs :** La position de la souris est envoyée via un événement `broadcast` éphémère (`cursor-pos`). Ces données ne sont **pas** stockées en base de données pour ne pas saturer le disque (haute fréquence).
*   **Contenu :** Les mises à jour de contenu sont chiffrées *avant* d'être envoyées au canal. Les autres clients reçoivent le blob chiffré, le déchiffrent et mettent à jour leur éditeur localement.

## 2. Le Configurateur Matériel (`src/pages/DeviceLanding.tsx`)

### 2.1. Algorithme "Smart Diversity"
Pour éviter que tous les clients ne cliquent sur le premier ordinateur de la liste (Race Condition), l'affichage est manipulé côté client.
1.  L'API renvoie tout le stock disponible.
2.  Le frontend applique un mélange aléatoire (`Fisher-Yates Shuffle`).
3.  Il filtre pour afficher 5 unités avec des specs *différentes* (RAM/SSD) pour maximiser le choix.
4.  **Résultat :** Une répartition naturelle de la charge sur l'inventaire.

### 2.2. Réservation Atomique
Lors du clic sur "Commander", le frontend appelle une fonction RPC `reserve_device`.
Cette fonction SQL utilise une **Transaction**. Elle vérifie si le statut est `available` et le passe à `reserved` en une seule opération atomique. Cela empêche physiquement deux utilisateurs de réserver le même appareil à la milliseconde près.

---

# CONCLUSION

Cette documentation prouve que Sivara est une architecture logicielle de haute précision. Chaque couche, du bit-shuffling binaire dans le Kernel à l'injection de hash dans le routeur React, est conçue pour servir un objectif unique : **La Souveraineté Numérique Totale** dans un environnement hostile (Zero-Trust).