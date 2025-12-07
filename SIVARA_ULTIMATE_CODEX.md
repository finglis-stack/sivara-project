# SIVARA : LE CODEX ULTIME
**DOCUMENTATION TECHNIQUE INTÉGRALE (NIVEAU KERNEL)**
**DATE DE COMPILATION :** 2025
**STATUT :** ARCHITECTURE DE RÉFÉRENCE

---

# LIVRE I : L'HYPERVISEUR ET LE NOYAU FRONTEND

Ce premier livre décortique comment une seule base de code React (Monorepo) parvient à se comporter comme six applications distinctes (Account, Mail, Docs, Device, Help, Search) selon le contexte d'exécution.

## CHAPITRE 1 : LE BOOTSTRAP (`src/main.tsx` & `index.html`)

### 1.1. Le Point d'Entrée DOM (`index.html`)
Le fichier `index.html` n'est pas passif.
*   **Méta-données Critiques :** `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` force le moteur de rendu mobile à utiliser la largeur physique de l'écran, empêchant le zoom automatique qui briserait l'UX "App-like".
*   **Injection du Script :** `<script type="module" src="/src/main.tsx"></script>` utilise le module ES natif. Vite n'a pas besoin de bundler tout en un seul fichier géant en mode DEV, il sert les modules à la volée.

### 1.2. L'Initialisation React (`src/main.tsx`)
*   **Concurrent Mode :** Utilisation de `createRoot` (API React 18). Cela permet le "Time Slicing", rendant l'interface réactive même pendant les calculs lourds (comme le déchiffrement AES dans `DocEditor`).
*   **Styles Globaux :** Import de `./globals.css` avant tout le reste pour garantir que les variables CSS Tailwind (`@layer base`) soient disponibles pour tous les composants enfants.

---

## CHAPITRE 2 : LE ROUTEUR POLYMORPHE (`src/App.tsx`)

C'est le composant le plus stratégique du frontend. Il agit comme un **Switch Layer 7** au niveau applicatif.

### 2.1. L'Algorithme de Détection de Contexte
Dans `AppRoutes`, le hook `useMemo` calcule la variable `currentApp`. Ce n'est pas un simple `switch/case`.

1.  **Détection Native (Capacitor) :**
    *   Code : `if (Capacitor.isNativePlatform())`
    *   **Pourquoi ?** Sur iOS/Android, l'application est servie via le protocole `capacitor://`. Il n'y a pas de sous-domaines (`mail.`, `docs.`). Le routeur *doit* ignorer le nom de domaine et se baser uniquement sur le paramètre URL `?app=`.
    *   **Fallback :** Si aucun paramètre n'est présent, il force l'affichage de `MobileLanding`, qui agit comme un "Springboard" (bureau d'applications) iOS.

2.  **Détection Environnement Local (Dev) :**
    *   Code : `if (hostname === 'localhost' || ...)`
    *   **Problème résolu :** En local, on ne peut pas facilement avoir `docs.localhost`.
    *   **Solution :** On simule les sous-domaines via `?app=docs`. Si aucun paramètre, on affiche le `DevPortal`, un outil interne pour naviguer entre les apps.

3.  **Détection Production (DNS Wildcard) :**
    *   Code : `if (hostname.startsWith('docs.')) return 'docs';`
    *   C'est ici que la magie opère. Le même déploiement Vercel/Netlify reçoit tout le trafic `*.sivara.ca`.
    *   Le code React décide quelle "App" monter. Cela permet de partager le `AuthContext` et les libs UI sans dupliquer le code dans 6 repos différents.

### 2.2. Gestionnaire de Session Cross-Domain (Le Hack du Hash)
Dans le composant `App`, un `useEffect` complexe gère l'authentification cross-domain.

*   **Le Problème :** Quand on redirige de `account.sivara.ca` vers `docs.sivara.ca` après le login, le cookie `SameSite=Lax` n'est pas toujours immédiatement disponible ou fiable sur Safari/Mobile.
*   **La Solution "Hash Injection" :**
    *   Le système de login redirige vers `docs.sivara.ca/#access_token=...&refresh_token=...`.
    *   L'App détecte ce hash au montage.
    *   Elle extrait les tokens.
    *   Elle appelle `supabase.auth.setSession()`.
    *   Elle nettoie l'URL via `window.history.replaceState` (pour que l'utilisateur ne voie pas le token).
    *   **Résultat :** Une session fluide et incassable, même si les cookies tiers sont bloqués.

---

# LIVRE II : LE COFFRE-FORT DE DONNÉES (SUPABASE & POSTGRES)

L'architecture backend repose sur le principe de **Moindre Privilège**. L'application cliente n'a *jamais* les droits d'administration.

## CHAPITRE 3 : MODÉLISATION DES DONNÉES (`schema.sql` implicite)

### 3.1. Table `profiles` (Extension d'Identité)
*   **Relation :** `id` est une FK (Foreign Key) vers `auth.users(id)`.
*   **Contrainte :** `ON DELETE CASCADE`. Si l'utilisateur supprime son compte Auth, son profil disparaît instantanément. Conformité RGPD/Loi 25 native.
*   **Champs Métier :** `is_pro` (Boolean), `stripe_customer_id` (Text). Ces champs ne sont modifiables *que* par le Webhook Stripe (Service Role), jamais par l'utilisateur via l'API publique.

### 3.2. Table `documents` (Le Stockage Aveugle)
*   **Colonnes Chiffrées :** `title`, `content` sont de type `TEXT` mais contiennent des chaînes Base64 (résultat de l'AES).
*   **Colonnes Métadonnées :** `owner_id`, `parent_id`, `type` sont en clair. Cela permet de construire l'arborescence de fichiers (Dossiers/Fichiers) sans avoir besoin de déchiffrer le contenu.
*   **Sécurité RLS :**
    *   Policy `SELECT` : `auth.uid() = owner_id OR EXISTS (SELECT 1 FROM document_access...)`.
    *   Cette requête SQL est exécutée par le moteur Postgres *avant* de renvoyer les données. Il est physiquement impossible de lire un document qui ne nous appartient pas, même en injectant du SQL.

### 3.3. Table `crawled_pages` (Vecteurs de Recherche)
*   **`blind_index` (Array of Text) :** Contient les tokens HMAC. C'est ici que la recherche se fait.
*   **`content_vector` (TSVECTOR) :** Utilisé pour la recherche full-text *si* le contenu n'était pas chiffré (legacy ou public).
*   **`search_hash` :** Hash SHA-256 de l'URL. Sert d'index unique pour éviter de crawler deux fois la même page (Dédoublonnage O(1)).

---

# LIVRE III : CRYPTOGRAPHIE & SÉCURITÉ APPLICATIVE

## CHAPITRE 4 : LE SERVICE DE CHIFFREMENT (`src/lib/encryption.ts`)

Ce fichier est le gardien de la confidentialité. Il utilise l'API **Web Crypto** (W3C standard).

### 4.1. Dérivation de Clé (PBKDF2)
La méthode `initialize` ne stocke pas le mot de passe. Elle dérive une clé.
*   **Algorithme :** PBKDF2-HMAC-SHA512.
*   **Itérations :** 100 000. C'est un coût CPU imposé volontairement pour rendre les attaques par force brute (Brute Force) impossibles en temps raisonnable.
*   **Salt :** Si l'utilisateur n'a pas de mot de passe spécifique, on utilise son `user.id` comme sel statique + une constante système.

### 4.2. Chiffrement Symétrique (AES-GCM)
La méthode `encrypt` utilise **AES-256-GCM** (Galois/Counter Mode).
*   **Pourquoi GCM ?** C'est un mode "Authentifié". Il génère un "Tag" d'intégrité en plus du texte chiffré.
*   **Sécurité :** Si un attaquant modifie un seul bit du texte chiffré dans la base de données, le déchiffrement échouera (`Integrity Check Failed`) au lieu de produire un texte corrompu. Cela protège contre les attaques par "Bit-Flipping".
*   **IV (Vecteur d'Initialisation) :** 12 octets aléatoires générés à chaque sauvegarde. Chiffrer deux fois le mot "Secret" produira deux chaînes totalement différentes.

---

## CHAPITRE 5 : LE KERNEL SIVARA (`supabase/functions/sivara-kernel`)

Cette Edge Function Deno est une machine virtuelle binaire.

### 5.1. Le Protocole SBP (Sivara Binary Protocol)
Le code définit des OpCodes (`0xB2`, `0xC3`...).
*   Ce n'est pas du JSON. C'est un flux de bytes.
*   **Structure :** `[HEADER] [IV] [METADATA] [PAYLOAD]`.
*   **Utilité :** Cela permet de créer des fichiers `.sivara` qui sont "autoportants". Ils contiennent les données chiffrées ET les règles de sécurité nécessaires pour les ouvrir.

### 5.2. Obfuscation "Bit-Shuffling"
La fonction `sivaraShuffle` applique une transformation réversible mais non-standard.
*   `((buffer[i] << 2) | (buffer[i] >> 6)) ^ key`
*   Cela mélange les bits à l'intérieur de chaque octet. Un fichier `.sivara` ressemble à du bruit blanc pur pour un analyseur d'entropie standard. C'est une couche de défense en profondeur (Security through Obscurity) qui s'ajoute au chiffrement AES.

### 5.3. Les "Smart Contracts" de Sécurité
Lors de la décompilation (`action === 'decompile'`), le Kernel lit le bloc `META_TAG`.
*   Il vérifie `security.allowed_emails` : Est-ce que l'utilisateur qui demande l'ouverture est dans la liste ?
*   Il vérifie `security.geofence` : Appelle l'API `ipgeolocation.io` pour vérifier si l'IP du client est dans le rayon autorisé (Geofencing).
*   Si une condition échoue, le Kernel lève une exception et ne renvoie *jamais* le payload chiffré. La clé de déchiffrement locale est inutile sans ce payload.

---

# LIVRE IV : L'ORACLE ET L'IA (LOGIQUE MÉTIER AVANCÉE)

## CHAPITRE 6 : VÉRIFICATION D'IDENTITÉ (`supabase/functions/verify-identity`)

Ce micro-service est le point d'entrée critique pour la location de matériel.

### 6.1. Ingestion et Analyse IA
*   Réception : Images Base64 (Front/Back) + Empreinte navigateur (`fingerprint`).
*   **Gemini Vision Pro :** Le prompt système est conçu pour agir comme un expert forensique. Il ne demande pas juste de lire le texte, il demande de détecter les anomalies ("IsScreen", "VisualAgeEstimation").
    *   *Exemple :* Si la date de naissance dit 20 ans mais que la photo ressemble à une personne de 50 ans, l'IA flag `VisualAgeEstimation` avec un écart.

### 6.2. Algorithme de Validation NAM (Québec)
Le code implémente la logique de checksum de la RAMQ.
*   `generateTheoreticalNAM` : Recrée le numéro de sécu théorique à partir du nom/prénom/date.
*   **Comparaison :** Si le NAM lu sur la carte (OCR) est identique au NAM théorique, le `trustScore` reçoit un bonus massif (+60). C'est une validation mathématique de la cohérence du document qui est très difficile à falsifier pour un faussaire amateur.

---

## CHAPITRE 7 : L'ORACLE FINANCIER (`src/pages/DeviceCustomerDetails.tsx`)

Utilisé dans le dashboard admin pour évaluer la rentabilité d'un client.

### 7.1. Simulation Monte-Carlo (Client-Side)
Le hook `useMemo` calcule 3 scénarios de cashflow sur 24 mois.
*   **Variables :** Taux d'inflation, Volatilité marché, Dépréciation matériel.
*   **Risque Client :** Le `trustScore` (0-100) est inversé pour devenir une probabilité de défaut de paiement (`churnRisk`).
*   **Projection :**
    *   Chaque mois `i`, le code calcule `flowProbable = netMonthly * retentionRate`.
    *   Si le risque est élevé, la courbe s'effondre prématurément.
*   **Résultat :** L'admin voit instantanément si un contrat est rentable (`ROI > 0`) ou toxique, et à quel mois le "Break Even" (Rentabilité) est atteint.

---

# LIVRE V : INTERFACES ET UX (LE RENDU)

## CHAPITRE 8 : L'ÉDITEUR DE DOCUMENTS (`src/pages/DocEditor.tsx`)

### 8.1. Intégration Tiptap
*   `useEditor` initialise l'éditeur en mode `editable: false` par défaut pour éviter toute modification accidentelle avant la vérification des permissions.
*   **Extensions :** `StarterKit`, `Underline`, `TextAlign` sont chargés.
*   **Sécurité :** Lors de la sauvegarde, le HTML brut (`editor.getHTML()`) est passé à `encryptionService`. Le serveur ne reçoit jamais de texte clair.

### 8.2. Collaboration Temps Réel (Curseurs)
*   **Broadcast :** L'événement `cursor-pos` est envoyé via Supabase Realtime (WebSocket).
*   **Optimisation :** Pour éviter de saturer le réseau, l'envoi de la position est limité ("throttled") à toutes les 30ms environ.
*   **Rendu :** Les curseurs distants sont des `div` absolues superposées à l'éditeur, avec une transition CSS `duration-100` pour lisser les mouvements saccadés du réseau.

## CHAPITRE 9 : LE CONFIGURATEUR MATÉRIEL (`src/pages/DeviceLanding.tsx`)

### 9.1. Algorithme "Smart Diversity"
Le sélecteur de produit n'affiche pas bêtement la liste des unités disponibles.
*   **Problème :** Si on affiche tout, les utilisateurs cliquent tous sur le premier item.
*   **Solution (`getSmartUnits`) :**
    1.  Filtre les unités du modèle choisi.
    2.  Mélange aléatoirement (`shuffleArray`).
    3.  Sélectionne 5 unités ayant des spécifications (RAM/SSD) *différentes* pour offrir du choix.
    4.  Si pas assez de diversité, complète avec des unités aléatoires.
*   **Résultat :** Une répartition de charge naturelle sur le stock et une meilleure expérience utilisateur.

### 9.2. Réservation Atomique
Lors du clic sur "Continuer" :
*   Appel RPC `reserve_device` (PostgreSQL function).
*   Cette fonction utilise une transaction SQL pour vérifier `status = 'available'` et passer à `reserved` en une seule opération atomique.
*   Cela empêche deux utilisateurs de réserver le même ordinateur à la milliseconde près (Race Condition).

---

# LIVRE VI : INFRASTRUCTURE MOBILE ET PAIEMENT

## CHAPITRE 10 : LE PONT NATIF CAPACITOR

### 10.1. Deep Linking (`src/App.tsx`)
Le listener `CapacitorApp.addListener('appUrlOpen')` est vital.
*   Quand l'utilisateur fait un paiement Stripe ou un login Google sur mobile, il sort de l'application vers Safari/Chrome.
*   Le "callback" de retour est une URL custom : `com.example.sivara://...`.
*   Le listener intercepte cette URL, extrait les paramètres, et réinjecte l'état dans l'application React sans recharger la page.

## CHAPITRE 11 : INTÉGRATION STRIPE (`supabase/functions/stripe-api`)

### 11.1. Création d'Abonnement Complexe
L'action `create_device_checkout` ne fait pas qu'un simple paiement.
1.  Elle calcule le prix total avec les taxes du Québec (14.975%).
2.  Elle calcule le dépôt initial (20%).
3.  Elle crée un `InvoiceItem` ponctuel pour le dépôt.
4.  Elle crée une `Subscription` récurrente pour le reste, avec une date de fin programmée (`cancel_at`) dans 16 mois.
5.  Elle lie l'ID de l'appareil (`unit_id`) aux métadonnées de la souscription pour que le Webhook puisse finaliser l'attribution du matériel.

---

**CONCLUSION DU CODEX**

Ce document prouve que Sivara n'est pas un assemblage de scripts, mais une architecture logicielle cohérente, sécurisée par design ("Security by Design") et optimisée pour la performance et la confidentialité. Chaque composant, du bit-shuffling binaire au rendu React, sert un but précis dans la chaîne de valeur de la souveraineté numérique.