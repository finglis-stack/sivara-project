# SIVARA : ARCHITECTURE, INGÉNIERIE ET CODE SOURCE
## MANUEL DE RÉFÉRENCE TECHNIQUE INTÉGRAL (VOLUME 1)

**Entité :** SIVARA CANADA INC.
**Système :** ECOSYSTEM V1
**Classification :** DOCUMENTATION CRITIQUE
**Date :** 2024

---

# TABLE DES MATIÈRES DÉTAILLÉE

## PARTIE I : FONDATIONS ET NOYAU SYSTÈME

**1. INITIALISATION ET POINT D'ENTRÉE**
   1.1. Le Fichier `src/main.tsx` : Amorçage React
      1.1.1. Importation des Styles Globaux
      1.1.2. Injection dans le DOM (Root)
   1.2. Configuration de Construction (Vite & TypeScript)
      1.2.1. `vite.config.ts` : Alias et Proxies
      1.2.2. `tsconfig.json` : Règles de Typage Strictes
      1.2.3. `tailwind.config.ts` : Système de Design Atomique

**2. LE ROUTEUR INTELLIGENT (APP.TSX)**
   2.1. Philosophie du Monorepo Virtuel
   2.2. Algorithme de Détection d'Application (Hook `useMemo`)
      2.2.1. Branche Mobile (Capacitor Native)
      2.2.2. Branche Développement (Localhost & Paramètres URL)
      2.2.3. Branche Production (Analyse de Sous-domaine)
   2.3. Cartographie des Routes (`AppRoutes`)
      2.3.1. Sous-système `account` (Identity Provider)
      2.3.2. Sous-système `docs` (Suite Bureautique)
      2.3.3. Sous-système `device` (Location Matériel)
      2.3.4. Sous-système `www` (Moteur de Recherche)
   2.4. Gestion de la Session Cross-Domain
      2.4.1. Récupération des Hashs d'URL (Access Tokens)
      2.4.2. Injection de Session Supabase Manuelle

**3. COUCHE DE PERSISTANCE ET RÉSEAU**
   3.1. Client Supabase (`src/integrations/supabase/client.ts`)
      3.1.1. Configuration de l'URL et Clé Anonyme
      3.1.2. Stratégie de Stockage des Cookies (Wildcard Domain)
      3.1.3. Gestion du Rafraîchissement de Token (Auto-Refresh)

---

## PARTIE II : SÉCURITÉ ET CRYPTOGRAPHIE

**4. GESTION D'IDENTITÉ ET SESSION**
   4.1. Le Contexte d'Authentification (`AuthContext.tsx`)
      4.1.1. État Global User/Session
      4.1.2. Écouteurs d'Événements Auth (`onAuthStateChange`)
      4.1.3. Procédure de Déconnexion et Nettoyage
   4.2. Interface de Connexion (`Login.tsx`)
      4.2.1. UX : Séparation Email/Password
      4.2.2. Sécurité : Anti-Brute Force Client (BlockedUntil)
      4.2.3. Logique de Redirection (`returnTo`)
   4.3. Création de Compte (`Onboarding.tsx`)
      4.3.1. Collecte de Données Civiles
      4.3.2. Transaction Atomique (Auth + Profile Insert)

**5. MOTEUR DE CHIFFREMENT CLIENT (`EncryptionService.ts`)**
   5.1. Architecture Zero-Knowledge
   5.2. Initialisation et Dérivation de Clé (PBKDF2)
      5.2.1. Utilisation de l'ID Utilisateur comme Sel
      5.2.2. Paramètres : 100 000 Itérations, SHA-512
   5.3. Primitives Cryptographiques (Web Crypto API)
      5.3.1. Chiffrement Symétrique AES-GCM 256 bits
      5.3.2. Génération de Vecteur d'Initialisation (IV) Aléatoire
   5.4. Encodage et Transport (ArrayBuffer vers Base64)

**6. MACHINE VIRTUELLE PROPRIÉTAIRE (SIVARA VM & KERNEL)**
   6.1. Le Format de Fichier `.sivara` (SBP)
   6.2. Interface VM Client (`sivara-vm.ts`)
      6.2.1. Capture d'Empreinte (FingerprintJS)
      6.2.2. Communication avec le Kernel
   6.3. Le Kernel Serveur (`supabase/functions/sivara-kernel`)
      6.3.1. OpCodes et Structure Binaire
      6.3.2. Algorithme de Mélange de Bits (Bit Shuffling)
      6.3.3. Validation des Contrats de Sécurité (Geofencing, IP Lock)

---

## PARTIE III : APPLICATIONS MÉTIER

**7. MOTEUR DE RECHERCHE (SIVARA WWW)**
   7.1. Interface Utilisateur (`Index.tsx`)
      7.1.1. Barre de Recherche Animée
      7.1.2. Affichage des Résultats et Favicons
   7.2. Algorithme de Recherche (`functions/search`)
      7.2.1. Tokenisation NLP (Natural Language Processing)
      7.2.2. Indexation Aveugle (Blind Indexing via HMAC)
      7.2.3. Scoring Vectoriel et Pondération
   7.3. Robot d'Indexation (`functions/crawl-page`)
      7.3.1. Extraction HTML et Nettoyage
      7.3.2. Chiffrement des Données avant Stockage
      7.3.3. Mode Découverte Récursif

**8. SUITE BUREAUTIQUE (SIVARA DOCS)**
   8.1. Gestionnaire de Fichiers (`Docs.tsx`)
      8.1.1. Navigation Hiérarchique et Fil d'Ariane
      8.1.2. Drag & Drop (DnD Kit)
   8.2. Éditeur Collaboratif (`DocEditor.tsx`)
      8.2.1. Moteur Tiptap Headless
      8.2.2. Synchronisation Temps Réel (WebSockets)
      8.2.3. Diffusion des Curseurs Distants
   8.3. Gestion des Permissions et Partage

**9. LOCATION DE MATÉRIEL (SIVARA DEVICE)**
   9.1. Catalogue et Algorithme de Sélection (`DeviceLanding.tsx`)
   9.2. Tunnel de Commande et Logistique (`DeviceCheckout.tsx`)
      9.2.1. Intégration Google Maps API
      9.2.2. Calcul des Frais de Port Dynamiques
   9.3. Oracle Financier (`DeviceCustomerDetails.tsx`)
      9.3.1. Modélisation Monte-Carlo des Flux
      9.3.2. Calcul de ROI et Point de Rupture
   9.4. Intégration Stripe (`functions/stripe-api`)

**10. VÉRIFICATION D'IDENTITÉ (SIVARA ID)**
    10.1. Interface de Capture Biométrique (`IdentityVerification.tsx`)
    10.2. Analyse IA (`functions/verify-identity`)
       10.2.1. OCR Cognitif via Gemini 1.5 Pro
       10.2.2. Détection de Fraude (Anti-Spoofing)
       10.2.3. Comparaison Fuzzy Matching avec la Base de Données

---

# DÉTAILS TECHNIQUES ET ANALYSE DE CODE

## 1. ARCHITECTURE GLOBALE

### 1.3. Gestionnaire de Routage Intelligent (App.tsx)

Le fichier `App.tsx` est le cœur décisionnel de l'interface. Contrairement à une application React standard qui définit des routes statiques (`/about`, `/contact`), Sivara utilise un **Routeur Polymorphe**.

**Analyse du Code : Détection de l'Application Courante**
L'application utilise le hook `useMemo` pour calculer la variable `currentApp`. Ce calcul est effectué à chaque chargement de page pour déterminer quel "micro-frontend" doit être monté.

1.  **Contexte Mobile (Capacitor) :**
    Le code vérifie d'abord `Capacitor.isNativePlatform()`. Si cette condition est vraie, cela signifie que l'application tourne dans une WebView iOS ou Android. Le routage par sous-domaine est impossible dans ce contexte (car l'application est servie depuis `localhost` ou `file://`).
    *   *Logique :* Le code regarde le paramètre d'URL `?app=...`. Si `app=mail`, il charge le module Mail. Si aucun paramètre n'est présent, il charge le `mobile-launcher` (une interface tactile avec de grosses icônes).

2.  **Contexte Développement (Localhost) :**
    Pour permettre aux développeurs de travailler sur `docs` sans modifier leur fichier `/etc/hosts`, le système détecte si `hostname` est `localhost` ou `127.0.0.1`.
    *   *Logique :* Il priorise le paramètre `?app=...`. `http://localhost:8080/?app=docs` forcera l'affichage de l'interface Docs.

3.  **Contexte Production (DNS Wildcard) :**
    C'est le comportement par défaut. Le code analyse le préfixe du `window.location.hostname`.
    *   `docs.sivara.ca` -> Charge `Docs`.
    *   `account.sivara.ca` -> Charge `Account` (Login/Profile).
    *   `mail.sivara.ca` -> Charge `Mail`.
    *   `help.sivara.ca` -> Charge `Help`.
    *   `device.sivara.ca` -> Charge `Device`.
    *   Tout autre sous-domaine (ou racine) -> Charge `www` (Moteur de recherche).

**Analyse du Code : Gestion de la Session Cross-Domain**
Le composant `App` contient un `useEffect` critique pour l'authentification unifiée (SSO).
Lorsqu'un utilisateur se connecte sur `account.sivara.ca`, Supabase place un cookie. Cependant, pour que ce cookie soit lu par `docs.sivara.ca`, il doit être défini sur le domaine racine `.sivara.ca`.
En cas d'échec des cookies (bloqueurs tiers), le système utilise un mécanisme de repli via Hash URL (`#access_token=...`).
Le code intercepte ce hash, extrait les tokens, et appelle `supabase.auth.setSession()` manuellement pour hydrater le client local.

---

## 2. INFRASTRUCTURE D'AUTHENTIFICATION

### 2.1. Contexte de Sécurité (AuthContext.tsx)

Ce fichier implémente le pattern **Provider** de React. Il est la source unique de vérité pour l'état de l'utilisateur.

**Variables d'État :**
*   `user` : Objet User de Supabase (UUID, Email, Métadonnées).
*   `session` : Le JWT (JSON Web Token) actif.
*   `loading` : Booléen bloquant le rendu de l'interface tant que l'auth n'est pas résolue.

**Cycle de Vie :**
Au montage (`useEffect`), le contexte exécute deux actions parallèles :
1.  `supabase.auth.getSession()` : Tente de récupérer une session existante depuis le LocalStorage ou les Cookies.
2.  `supabase.auth.onAuthStateChange()` : Ouvre un écouteur (Listener) sur le client Supabase. Si le token expire, est rafraîchi, ou si l'utilisateur se déconnecte, cet écouteur se déclenche.

**Fonction SignOut :**
La fonction de déconnexion ne se contente pas d'appeler l'API. Elle force le nettoyage de l'état local (`setUser(null)`) et supprime manuellement les cookies pour éviter les états incohérents ("Zombie Sessions").

### 2.3. Processus d'Inscription (Onboarding.tsx)

Ce composant gère la complexité de la création d'un utilisateur dans un système à deux étages (Auth + Data).

**Le Problème :** Supabase sépare les utilisateurs (table système `auth.users`) des données métier (table publique `profiles`).
**La Solution (Code) :**
1.  Appel à `supabase.auth.signUp()` : Crée l'entrée sécurisée dans le système d'authentification.
2.  Vérification immédiate de l'objet `data.user`.
3.  Si succès, appel à `supabase.from('profiles').insert()` : Utilise l'ID retourné par l'étape 1 comme clé primaire (`id`).
4.  Si l'étape 3 échoue (ex: violation de contrainte SQL), l'interface affiche une erreur mais l'utilisateur Auth existe déjà. C'est un point critique géré par des Triggers SQL côté serveur (voir section Base de Données) pour l'auto-réparation.

---

## 3. MOTEUR DE RECHERCHE (SIVARA WWW)

### 3.1. Algorithme de Recherche "Titanium"

Ce module est une prouesse d'ingénierie "Privacy-First". Il permet de chercher dans des données chiffrées sans jamais les déchiffrer côté serveur.

**Le Fichier :** `supabase/functions/search/index.ts`

**Le Concept : Indexation Aveugle (Blind Indexing)**
Au lieu de stocker "chat" en clair, le système stocke un HMAC déterministe de "chat".
`HMAC(Clé_Recherche, "chat")` = `a1b2c3d4...`

**Le Processus de Recherche (Code) :**
1.  **Réception :** L'API reçoit la requête utilisateur (ex: "ordinateur portable").
2.  **Tokenisation (Classe TitaniumTokenizer) :**
    *   Normalisation : `ordinateur portable` -> `ordinateur portable` (minuscules, sans accents).
    *   Stopwords : Retire les mots vides si nécessaire.
    *   Stemming : `ordinateur` -> `ordin`.
    *   Phonétique : `ordinateur` -> `ORDNTR` (Code Double Metaphone).
3.  **Transmutation :** Ces tokens sont hashés avec la même clé secrète que lors de l'indexation.
4.  **Requête SQL Vectorielle :**
    Le code exécute une requête PostgreSQL utilisant l'opérateur de chevauchement de tableau (`&&` ou `overlaps`).
    `SELECT * FROM crawled_pages WHERE blind_index && [hash1, hash2, hash3]`
    Le serveur de base de données ne voit que des hashs. Il ne sait pas ce qu'il cherche.
5.  **Scoring en Mémoire :**
    Une fois les lignes candidates récupérées, l'Edge Function calcule un score de pertinence en comparant les hashs trouvés avec les hashs demandés.
    *   Match Exact (`EX:...`) : 100 points.
    *   Match Racine (`ST:...`) : 80 points.
    *   Match Phonétique (`PH:...`) : 50 points.
6.  **Déchiffrement JIT :**
    Le titre et la description sont stockés chiffrés (AES-256). L'Edge Function utilise la `CryptoService` pour les déchiffrer *uniquement* pour les résultats qui vont être renvoyés, puis oublie la clé.

---

## 4. SUITE BUREAUTIQUE (SIVARA DOCS)

### 4.3. Cryptographie Côté Client (EncryptionService.ts)

Ce fichier est le gardien de la confidentialité. Il s'exécute *uniquement* dans le navigateur de l'utilisateur.

**Initialisation (`initialize`) :**
La fonction prend un secret (généralement l'ID utilisateur) et dérive une clé maîtresse.
*   **Algorithme :** PBKDF2 (Password-Based Key Derivation Function 2).
*   **Hash :** SHA-512.
*   **Itérations :** 100 000 (Standard de sécurité élevé pour ralentir les attaques par force brute).
*   **Résultat :** Une clé `CryptoKey` non-exportable stockée en mémoire volatile.

**Chiffrement (`encrypt`) :**
1.  Génère un IV (Vecteur d'Initialisation) aléatoire de 12 octets via `crypto.getRandomValues`. C'est crucial : chiffrer deux fois le même texte avec la même clé mais des IV différents produira deux résultats totalement différents.
2.  Encode le texte en `Uint8Array` (UTF-8).
3.  Appelle `crypto.subtle.encrypt` avec l'algorithme `AES-GCM` (Galois/Counter Mode). Ce mode assure à la fois la confidentialité et l'intégrité des données.
4.  Retourne un objet `{ encrypted, iv }` converti en Base64 pour le transport JSON.

**Déchiffrement (`decrypt`) :**
Inverse le processus. Nécessite impérativement l'IV original stocké avec le document. Si l'IV est perdu ou corrompu, le document est mathématiquement irrécupérable.

### 4.5. Machine Virtuelle SBP (Sivara VM)

Le format `.sivara` n'est pas un simple fichier texte, c'est un conteneur binaire structuré.

**Structure du Fichier Binaire (Hexadécimal) :**
*   **Header (4 octets) :** `53 56 52 03` (ASCII: "SVR3"). Signature magique validant le type de fichier.
*   **Bloc IV (Variable) :** OpCode `0xB2`, suivi de la longueur, suivi des octets de l'IV.
*   **Bloc Méta (Variable) :** OpCode `0xD4`. Contient les règles de sécurité (qui a le droit d'ouvrir ce fichier) en format JSON obfusqué.
*   **Bloc Données (Variable) :** OpCode `0xC3`. Contient le titre et le contenu du document, concaténés avec un séparateur nul (`0x00`), puis chiffrés et "mélangés".

**Le Kernel (`supabase/functions/sivara-kernel`) :**
C'est la seule entité capable de lire/écrire ce format.
*   **Bit Shuffling :** La fonction `sivaraShuffle` applique une transformation binaire réversible (XOR + Bit Rotation) sur les données. Cela rend le fichier illisible par des outils d'analyse standard, même si on extrait la chaîne AES. C'est une couche d'obfuscation supplémentaire.
*   **Validation de Sécurité :** Lors de la demande de lecture (`decompile`), le Kernel lit d'abord le bloc Méta.
    *   Si `geofence` est défini : Il vérifie l'IP du requérant.
    *   Si `fingerprint` est défini : Il vérifie l'empreinte navigateur envoyée.
    *   Si une condition échoue, le Kernel renvoie une erreur et *ne décode pas* le bloc de données. L'utilisateur reçoit un refus, et le contenu reste chiffré.

---

## 5. LOCATION DE MATÉRIEL (SIVARA DEVICE)

### 5.5. Oracle Financier (DeviceCustomerDetails.tsx)

Ce composant (`OraclePanel`) est un outil d'aide à la décision pour l'administrateur. Il ne se base pas sur des données statiques mais simule le futur.

**Moteur de Simulation Monte-Carlo (Code) :**
Le hook `useMemo` calcule `financialProjection`.
Il itère sur 24 mois (M0 à M24). Pour chaque mois, il calcule trois scénarios :
1.  **Optimiste :** Le client paie à l'heure, aucune panne. Cashflow = `(Loyer - Frais)`.
2.  **Probable :** Applique un taux de rétention (`retentionRate`) basé sur le `TrustScore` du client. Plus le score est bas, plus la probabilité que le client arrête de payer augmente chaque mois.
3.  **Pessimiste :** Simule un défaut de paiement (Churn) à un mois critique calculé par l'IA (`crashMonth`). Intègre la perte de valeur du matériel non récupéré.

**Calcul de la Valeur d'Actif (Asset Valuation) :**
En parallèle du cashflow, l'Oracle calcule la dépréciation du matériel (Hardware).
*   Formule : `Valeur_Initiale * (1 - Taux_Depreciation)^Mois`.
*   Le "Point de Flip" est l'intersection où `Cash_Cumulé + Valeur_Residuelle_Hardware` est à son maximum absolu. C'est le moment mathématiquement optimal pour proposer au client de changer d'appareil (Upsell) et revendre l'ancien sur le marché secondaire.

---

## 6. VÉRIFICATION D'IDENTITÉ (SIVARA ID)

### 8.3. Edge Function : Verify Identity

Cette fonction est le rempart contre la fraude.

**Pipeline de Traitement :**
1.  **Réception :** Reçoit les images (Base64) du recto et du verso de la carte d'identité.
2.  **Vision IA (Gemini Pro) :** Envoie les images à l'API Google Gemini avec un prompt d'ingénierie très spécifique ("You are a forensic document expert..."). L'IA est instruite pour extraire les champs texte mais aussi pour analyser les micro-détails (reflets de flash, trames d'impression, cohérence des polices) pour détecter les faux.
3.  **Algorithme de Validation (Logique TypeScript) :**
    *   **NAM Check (Québec) :** Vérifie si le numéro d'assurance maladie ou de permis correspond mathématiquement au nom et à la date de naissance (Algorithme modulo/séquentiel).
    *   **Fuzzy Matching :** Compare le nom extrait avec le nom du profil utilisateur via la distance de Levenshtein (tolérance aux fautes de frappe ou erreurs OCR).
4.  **Scoring de Confiance :**
    *   Démarre à 0.
    *   +60 pts si le NAM est mathématiquement valide par rapport à la DB.
    *   +40 pts si le nom correspond à > 85%.
    *   -100 pts (Ban) si l'IA détecte une photo d'écran (Screen Spoofing).
5.  **Décision :** Si le score final >= 50, le statut passe à `approved`. Sinon `rejected`.

---

## 7. INFRASTRUCTURE DE PAIEMENT (BILLING)

### 9.4. Edge Function : Stripe Webhook

Ce point de terminaison est critique car il est la seule source de vérité pour l'état de l'abonnement.

**Sécurité :**
La première ligne de code vérifie la signature `stripe-signature` avec le secret d'endpoint. Si la signature est invalide, la requête est rejetée (400 Bad Request). Cela empêche quiconque de forger un événement de paiement réussi.

**Logique Métier (Switch Case) :**
*   `customer.subscription.created/updated` :
    *   Récupère l'ID client Stripe (`sub.customer`).
    *   Cherche l'utilisateur correspondant dans la table `profiles`.
    *   Met à jour les champs `is_pro` (booléen) et `subscription_end_date`.
    *   **Spécificité Device :** Si les métadonnées de l'abonnement contiennent `type: device_rental` et `unit_id`, le webhook met à jour la table `device_units` pour marquer l'unité comme `sold` et l'assigner à l'utilisateur. C'est l'automatisation de la gestion de stock.

*   `customer.subscription.deleted` :
    *   Révoque immédiatement l'accès Pro.
    *   Si c'était une location, libère l'unité (`status: available`) dans l'inventaire (ou la marque comme à récupérer).

---

## 8. BASE DE DONNÉES ET SÉCURITÉ DES DONNÉES (RLS)

La sécurité de Sivara ne repose pas sur le code JavaScript (qui peut être contourné), mais sur le moteur de base de données PostgreSQL lui-même.

### Structure des Tables (Extrait)

**Table `documents`**
*   `id` (UUID, Primary Key)
*   `owner_id` (UUID, FK -> auth.users) : Le propriétaire.
*   `title` (Text) : Chiffré.
*   `content` (Text) : Chiffré.
*   `encryption_iv` (Text) : Le vecteur unique.
*   `visibility` (Enum) : 'private', 'public', 'limited'.

### Politiques RLS (Row Level Security)

Ces politiques sont appliquées par PostgreSQL à chaque requête.

**Politique SELECT (Lecture) :**
```sql
CREATE POLICY "Access via document_access" ON documents
FOR SELECT
USING (
  (owner_id = auth.uid()) -- Le propriétaire peut toujours lire
  OR
  (visibility = 'public') -- Tout le monde peut lire si public
  OR
  (EXISTS ( -- Ou si l'utilisateur est dans la liste d'accès
    SELECT 1 FROM document_access da
    WHERE da.document_id = documents.id
    AND lower(da.email) = lower(auth.jwt() ->> 'email')
  ))
);
```
**Analyse :** Même si un hacker tente un `SELECT * FROM documents` via l'API, PostgreSQL filtrera silencieusement les lignes pour ne retourner que celles où la condition `USING` est vraie. Il est impossible de "voler" des données auxquelles on n'a pas droit.

**Politique INSERT (Écriture) :**
```sql
CREATE POLICY "documents_insert_policy" ON documents
FOR INSERT
WITH CHECK (auth.uid() = owner_id);
```
**Analyse :** Empêche un utilisateur de créer un document au nom de quelqu'un d'autre.

---

## 9. CONFIGURATION ET DÉPLOIEMENT

### Gestion des Variables d'Environnement
L'application dépend de secrets critiques stockés dans le Vault Supabase (pour les Edge Functions) et dans `.env` (pour le build local).
*   `SUPABASE_URL` / `ANON_KEY` : Accès API.
*   `SERVICE_ROLE_KEY` : Accès Admin (Server-side uniquement).
*   `ENCRYPTION_KEY` : Clé maître serveur pour les opérations `blind_index` et `crawl`.
*   `STRIPE_SECRET_KEY` : Gestion des paiements.
*   `GEMINI_API_KEY` : IA et Vision.
*   `RESEND_API_KEY` : Envoi d'emails.

Cette architecture distribuée assure qu'aucune clé critique n'est exposée côté client (Browser), garantissant l'intégrité du système même en cas de compromission du frontend.

---

**FIN DU VOLUME 1**