# SIVARA : SPÉCIFICATIONS TECHNIQUES DÉTAILLÉES ET MANUEL DE RÉFÉRENCE
**VERSION 1.0.0**

---

## TABLE DES MATIÈRES

**1. INTRODUCTION ET ARCHITECTURE SYSTÈME**
   1.1. Philosophie de l'Architecture (Monorepo Virtuel)
   1.2. Point d'Entrée Applicatif (main.tsx)
   1.3. Gestionnaire de Routage Intelligent (App.tsx)
      1.3.1. Logique de Détection de l'Environnement (Production vs Local)
      1.3.2. Routage par Sous-domaine
      1.3.3. Routage Hybride Mobile (Capacitor)
   1.4. Système de Design et Styles (Tailwind & Shadcn)
   1.5. Client Supabase et Persistance (client.ts)

**2. MODULE : SIVARA ACCOUNT (AUTHENTIFICATION)**
   2.1. Contexte de Sécurité (AuthContext.tsx)
      2.1.1. Initialisation de Session
      2.1.2. Gestion des Cookies Cross-Domain
   2.2. Interface de Connexion (Login.tsx)
      2.2.1. Mécanisme de Protection Brute-Force
      2.2.2. Flux de Récupération de Compte
   2.3. Processus d'Inscription (Onboarding.tsx)
      2.3.1. Création Atomique (Auth + Profil)
   2.4. Gestion de Profil (Profile.tsx)
      2.4.1. Édition des Données Civiles
      2.4.2. Upload et Recadrage d'Avatar (Canvas API)
      2.4.3. Synchronisation Stripe
   2.5. Réinitialisation de Mot de Passe (ResetPassword.tsx)

**3. MODULE : SIVARA WWW (MOTEUR DE RECHERCHE)**
   3.1. Algorithme de Recherche "Titanium" (Search Edge Function)
      3.1.1. Tokenisation et Normalisation Linguistique
      3.1.2. Hachage Cryptographique (Blind Indexing)
      3.1.3. Scoring et Classement Vectoriel
   3.2. Interface Utilisateur (Index.tsx)
      3.2.1. Barre de Recherche et Suggestions
      3.2.2. Affichage des Résultats et Groupement par Domaine
   3.3. Robot d'Indexation (Crawl Page Edge Function)
      3.3.1. Extraction et Nettoyage HTML
      3.3.2. Chiffrement du Contenu (AES-256)
      3.3.3. Mode Découverte et Suivi des Liens
   3.4. Gestionnaire de File d'Attente (Monitor.tsx & CrawlManager.tsx)
      3.4.1. Ingestion d'URLs
      3.4.2. Surveillance Temps Réel (WebSockets)
      3.4.3. Orchestrateur de Processus (Process Queue)

**4. MODULE : SIVARA DOCS (SUITE BUREAUTIQUE)**
   4.1. Système de Fichiers (Docs.tsx)
      4.1.1. Navigation et Fil d'Ariane
      4.1.2. Gestion du Glisser-Déposer (DnD Kit)
   4.2. Éditeur Collaboratif (DocEditor.tsx)
      4.2.1. Intégration Tiptap Headless
      4.2.2. Synchronisation Temps Réel (Supabase Realtime)
      4.2.3. Gestion des Curseurs Distants
   4.3. Cryptographie Côté Client (EncryptionService.ts)
      4.3.1. Dérivation de Clés (PBKDF2)
      4.3.2. Chiffrement Symétrique (AES-GCM)
   4.4. Machine Virtuelle SBP (Sivara VM)
      4.4.1. Structure du Format Binaire .sivara
      4.4.2. Compilation et Obfuscation (Kernel Edge Function)
      4.4.3. Géolocalisation et Restrictions d'Accès

**5. MODULE : SIVARA DEVICE (LOCATION MATÉRIEL)**
   5.1. Vitrine Commerciale (DeviceLanding.tsx)
      5.1.1. Algorithme de Sélection Aléatoire "Smart Diversity"
      5.1.2. Système de Réservation Atomique
   5.2. Tunnel de Commande (DeviceCheckout.tsx)
      5.2.1. Intégration Google Maps Places API
      5.2.2. Calcul Logistique et Géodésique
   5.3. Vérification d'Identité (IdentityVerification.tsx)
      5.3.1. Capture Biométrique (Camera API)
      5.3.2. Analyse IA Gemini (Verify Identity Edge Function)
      5.3.3. Détection de Fraude et Fingerprinting
   5.4. Administration des Ventes (DeviceAdmin.tsx)
   5.5. Oracle Financier (DeviceCustomerDetails.tsx)
      5.5.1. Modélisation Monte-Carlo des Flux de Trésorerie
      5.5.2. Calcul de Dépréciation des Actifs
      5.5.3. Composant de Visualisation (OraclePanel.tsx)

**6. MODULE : SIVARA MAIL (MESSAGERIE)**
   6.1. Interface de Réception (MailInbox.tsx)
   6.2. Architecture de Réception (Inbound Mail Webhook)
   6.3. Architecture d'Envoi (Send Mail Edge Function)

**7. MODULE : SIVARA HELP (SUPPORT)**
   7.1. Base de Connaissances Publique (HelpLanding.tsx)
   7.2. Système de Tickets (HelpAdmin.tsx)
      7.2.1. Gestion des Files d'Attente
      7.2.2. Intégration Email Transactionnelle (Resend)

**8. INFRASTRUCTURE BACKEND ET BASE DE DONNÉES**
   8.1. Schéma de Base de Données PostgreSQL
   8.2. Politiques de Sécurité RLS (Row Level Security)
   8.3. Déclencheurs (Triggers) et Procédures Stockées

---

## 1. INTRODUCTION ET ARCHITECTURE SYSTÈME

### 1.1. Philosophie de l'Architecture
Sivara repose sur une architecture de type "Monorepo Virtuel". Bien que le code source soit contenu dans un unique dépôt Git, l'application se comporte comme une fédération de micro-services distincts (Search, Docs, Mail, etc.). Cette séparation est logique et non physique : le code est partagé, mais l'expérience utilisateur change radicalement en fonction du point d'entrée (URL). L'objectif est de maximiser la réutilisation des composants UI et des contextes (Authentification) tout en offrant des expériences dédiées.

### 1.2. Point d'Entrée Applicatif (main.tsx)
Le fichier `src/main.tsx` est le point d'amorçage strict de l'application React. Il est responsable de :
1.  L'importation des styles globaux (`globals.css`).
2.  L'initialisation de la racine React (`createRoot`) sur l'élément DOM ayant l'ID `root`.
3.  Le rendu du composant racine `App` en mode strict (`React.StrictMode`) n'est pas explicitement visible mais implicite dans les standards Vite.

### 1.3. Gestionnaire de Routage Intelligent (App.tsx)
Le fichier `src/App.tsx` contient le "cerveau" du routage. Il ne se contente pas de définir des routes statiques, il calcule dynamiquement quelle application doit être rendue.

**1.3.1. Mécanisme de Détection (Hook useMemo)**
La variable `currentApp` est calculée à chaque chargement ou changement d'URL.
*   **Mode Production :** Elle analyse le `window.location.hostname`. Si le nom d'hôte commence par `docs.`, l'application bascule en mode `docs`. Si c'est `account.`, elle bascule en mode `account`, etc.
*   **Mode Développement/Local :** Elle analyse les paramètres de requête de l'URL (`searchParams`). Si l'URL contient `?app=docs`, cela force le rendu de l'application Docs. Cela permet de simuler l'environnement de production en local sans configuration DNS complexe.
*   **Mode Natif (Capacitor) :** Elle utilise `Capacitor.isNativePlatform()` pour détecter si l'application tourne sur iOS ou Android. Dans ce cas, elle charge le `mobile-launcher`.

**1.3.2. Structure des Routes (AppRoutes)**
Le composant `AppRoutes` contient une série de conditions `if (currentApp === '...')`.
*   Si l'application est `account`, les routes `/login`, `/register`, `/profile` sont actives.
*   Si l'application est `docs`, la route racine `/` pointe vers le gestionnaire de fichiers, et `/:id` pointe vers l'éditeur.
*   Cette ségrégation assure qu'un utilisateur sur `docs.sivara.ca` ne peut pas accéder accidentellement à l'interface d'administration des appareils via l'URL.

### 1.4. Système de Design et Styles
L'application utilise Tailwind CSS configuré dans `tailwind.config.ts`.
*   **Thématisation :** Utilisation de variables CSS (`--primary`, `--background`, etc.) définies dans `globals.css`. Cela permet un basculement instantané entre les thèmes (clair/sombre) et une cohérence des couleurs sur tous les modules.
*   **Animations :** Des keyframes personnalisées (`accordion-down`, `wave-undulate`) sont définies pour les interactions UI complexes (ex: le fond animé de la page Device).

### 1.5. Client Supabase (client.ts)
Le fichier `src/integrations/supabase/client.ts` initialise la connexion à la base de données.
*   **Gestion des Cookies :** Il configure le stockage du token d'authentification dans les cookies du navigateur.
*   **Partage de Session :** Une configuration critique `domain: .sivara.ca` (en production) permet au cookie d'être lisible par tous les sous-domaines. Ainsi, un utilisateur connecté sur `account.sivara.ca` est automatiquement connecté sur `docs.sivara.ca`.

---

## 2. MODULE : SIVARA ACCOUNT (AUTHENTIFICATION)

### 2.1. Contexte de Sécurité (AuthContext.tsx)
Ce composant enveloppe l'intégralité de l'arbre React (`AuthProvider`).
*   **État Global :** Il maintient l'état de l'utilisateur (`user`), de la session (`session`) et du chargement (`loading`).
*   **Écouteur d'Événements :** Il s'abonne aux changements d'état Supabase (`onAuthStateChange`). Cela permet de réagir immédiatement à une déconnexion (nettoyage des états locaux) ou à un rafraîchissement de token.
*   **Fonction SignOut :** Gère la déconnexion en appelant l'API Supabase et en forçant le nettoyage des cookies locaux pour éviter les états fantômes.

### 2.2. Interface de Connexion (Login.tsx)
Page gérant l'entrée des identifiants.
*   **UX Progressive :** L'interface demande d'abord l'email, vérifie sa validité formelle, puis affiche le champ mot de passe.
*   **Anti-Brute-Force Client :** Un état `blockedUntil` empêche la soumission du formulaire si une tentative a échoué récemment, ajoutant un délai artificiel côté client.
*   **Redirection Contextuelle :** Utilise le paramètre d'URL `returnTo` pour renvoyer l'utilisateur vers l'application d'origine après une connexion réussie (ex: rediriger vers `docs.sivara.ca` après login sur `account.sivara.ca`).

### 2.3. Flux d'Inscription (Onboarding.tsx)
Page de création de compte multi-étapes.
1.  **Collecte Données :** Prénom, Nom, Téléphone.
2.  **Création Identifiants :** Email, Mot de passe.
3.  **Exécution Transactionnelle :** Appelle `supabase.auth.signUp` pour créer l'utilisateur Auth, puis insère immédiatement les détails dans la table publique `profiles`. Si la deuxième étape échoue, l'utilisateur est dans un état incohérent (géré par les politiques RLS).

### 2.4. Gestion de Profil (Profile.tsx)
Tableau de bord de l'utilisateur.
*   **Manipulation d'Image :** Le composant permet l'upload d'un avatar. Il utilise un élément `<input type="file">` caché.
*   **Traitement Canvas :** L'image sélectionnée est dessinée sur un `canvas` HTML5 pour permettre le recadrage et la compression en JPEG avant l'envoi au serveur (optimisation de bande passante).
*   **Stockage :** L'image binaire est envoyée dans le bucket Supabase Storage `avatars`.
*   **Synchronisation Stripe :** Un bouton permet d'invoquer l'Edge Function `stripe-api` avec l'action `sync_subscription` pour forcer la mise à jour du statut `is_pro` dans la base de données locale depuis Stripe.

---

## 3. MODULE : SIVARA WWW (MOTEUR DE RECHERCHE)

### 3.1. Algorithme de Recherche "Titanium"
Implémenté dans l'Edge Function `supabase/functions/search/index.ts`.
*   **Approche Zero-Knowledge :** Le moteur ne stocke pas le texte des pages web en clair pour éviter l'analyse de contenu par l'opérateur.
*   **Tokenisation (TitaniumTokenizer) :** Le texte de requête est normalisé (suppression accents NFD), filtré (Stopwords FR/EN), racinisé (Stemming Porter) et phonétisé (Double Metaphone).
*   **Hachage HMAC :** Chaque token généré est haché avec une clé secrète (`SEARCH_KEY`). Exemple : "Pomme" devient `HMAC("EX:pomme")`.
*   **Recherche Vectorielle :** La base de données contient une colonne `blind_index` (tableau de hashs). La requête SQL cherche les correspondances exactes entre les hashs de la requête utilisateur et les hashs stockés.
*   **Déchiffrement JIT (Just-In-Time) :** Seuls les résultats correspondants sont déchiffrés (AES-256) avant d'être renvoyés au client React.

### 3.2. Interface Utilisateur (Index.tsx)
*   **Barre de Recherche :** Composant centré (`SearchBar.tsx`) avec animation CSS.
*   **Affichage des Résultats :** Le composant `SearchResult.tsx` affiche le titre, l'URL, la description et le score de pertinence.
*   **Groupement :** Une logique JavaScript regroupe les résultats provenant du même domaine principal pour éviter de polluer la liste (Site Links).

### 3.3. Robot d'Indexation (Crawl Page Edge Function)
Fonction serverless `supabase/functions/crawl-page/index.ts`.
*   **Fetch :** Récupère le HTML de l'URL cible.
*   **Nettoyage :** Utilise des Regex pour supprimer les scripts, styles et commentaires.
*   **Chiffrement :** Chiffre le contenu brut (AES-256-GCM) et génère l'index aveugle (Tableau de Hashs).
*   **Mode Découverte :** Si activé, extrait les liens de la page, les hache, et vérifie s'ils existent déjà en base avant de les ajouter à la file d'attente `crawl_queue`.

### 3.4. Gestionnaire de File d'Attente
*   **CrawlManager.tsx :** Interface admin pour ajouter des URLs manuellement ou par import CSV.
*   **Monitor.tsx :** Tableau de bord temps réel. Utilise `supabase.channel` pour écouter les événements `INSERT` et `UPDATE` sur la table `crawl_logs` et `crawl_queue`, affichant une vue dynamique de l'activité du crawler.

---

## 4. MODULE : SIVARA DOCS (SUITE BUREAUTIQUE)

### 4.1. Système de Fichiers (Docs.tsx)
Gestionnaire de documents.
*   **Navigation :** Utilise un état `currentFolderId` pour filtrer la liste des documents affichés. Un tableau `breadcrumbs` maintient l'historique de navigation pour la barre supérieure.
*   **Glisser-Déposer :** Intègre la librairie `@dnd-kit`. Les composants `DraggableItem` (fichiers) et `Droppable` (dossiers) permettent de déplacer des éléments. L'événement `onDragEnd` déclenche une mise à jour SQL de la colonne `parent_id`.

### 4.2. Éditeur Collaboratif (DocEditor.tsx)
L'éditeur de texte riche.
*   **Moteur Tiptap :** Utilise Tiptap (basé sur ProseMirror) pour la gestion du contenu riche (Gras, Italique, Listes).
*   **Collaboration Temps Réel :** Utilise `supabase.channel`.
    *   **Broadcast de Contenu :** À chaque frappe, le delta de contenu est chiffré localement et envoyé aux autres clients connectés via WebSockets. Le serveur ne voit que du bruit chiffré.
    *   **Curseurs :** Les coordonnées X/Y de la souris et le nom de l'utilisateur sont diffusés via un événement `cursor-pos` pour afficher les curseurs des collaborateurs en temps réel.

### 4.3. Cryptographie Côté Client (EncryptionService.ts)
Classe utilitaire gérant la sécurité.
*   **Initialisation :** Dérive une clé maître (Master Key) à partir de l'ID utilisateur (ou d'un mot de passe) via PBKDF2 (100,000 itérations).
*   **Opérations :** Expose les méthodes `encrypt` et `decrypt` utilisant l'API native `crypto.subtle` du navigateur (AES-GCM 256 bits).

### 4.4. Machine Virtuelle SBP (Sivara VM)
Système d'exportation/importation de fichiers sécurisés `.sivara`.
*   **Format Binaire :** Le fichier généré n'est pas du texte, mais une séquence d'octets structurée avec des OpCodes propriétaires.
*   **Sivara Kernel (Edge Function) :** Le service de compilation/décompilation.
    *   **Compile :** Reçoit le JSON (clés chiffrées + métadonnées), applique un "Bit Shuffling" (rotation de bits) pour l'obfuscation, et retourne le binaire.
    *   **Decompile :** Reçoit le binaire, vérifie les règles de sécurité intégrées (Geofencing IP, Fingerprint Navigateur), et si valide, inverse le shuffling pour retourner le JSON chiffré au client.

---

## 5. MODULE : SIVARA DEVICE (LOCATION MATÉRIEL)

### 5.1. Vitrine Commerciale (DeviceLanding.tsx)
*   **Algorithme de Sélection :** Le client récupère la liste des unités disponibles. Une fonction `shuffleArray` mélange les résultats pour présenter des unités différentes à chaque visiteur, évitant la contention sur les mêmes articles.
*   **Réservation :** Lors du clic sur "Commander", une fonction RPC PostgreSQL `reserve_device` est appelée. Elle change le statut de l'unité en `reserved` pour 5 minutes, empêchant tout autre utilisateur de la commander.

### 5.2. Tunnel de Commande (DeviceCheckout.tsx)
*   **Géolocalisation :** Utilise l'API Google Maps Places pour l'autocomplétion de l'adresse.
*   **Logistique :** Calcule la distance entre l'entrepôt (coordonnées fixes) et l'adresse client (Haversine Formula). Si distance < 35km, propose la livraison "Express". Sinon, livraison standard.

### 5.3. Vérification d'Identité (IdentityVerification.tsx)
Étape obligatoire avant le paiement.
*   **Capture :** Utilise `navigator.mediaDevices.getUserMedia` pour accéder à la caméra du téléphone/PC. Un élément `<video>` affiche le flux, et un `<canvas>` capture l'image fixe.
*   **Analyse IA :** Les images (Recto/Verso) sont envoyées à l'Edge Function `verify-identity`. Cette fonction utilise l'API Google Gemini 1.5 Pro avec un prompt spécifique pour extraire les données OCR (Nom, Date, Numéro) et détecter les fraudes (photos d'écrans).
*   **Validation :** Les données extraites sont comparées (Fuzzy Matching) avec les données du profil utilisateur Supabase.

### 5.4. Oracle Financier (DeviceCustomerDetails.tsx & OraclePanel.tsx)
Système d'analyse de rentabilité pour l'administrateur.
*   **Calculs :** Utilise les données de l'unité (Prix d'achat, Prix de vente) et le score de confiance du client (issu de la vérification d'identité).
*   **Simulation Monte-Carlo :** Projette les flux de trésorerie sur 24 mois en appliquant des variables aléatoires (volatilité du marché, risque de défaut de paiement).
*   **Visualisation :** Affiche les courbes de rentabilité (Optimiste, Probable, Pessimiste) via la librairie `Recharts`. Indique le "Point de Rupture" (moment où le contrat devient rentable).

---

## 6. MODULE : SIVARA MAIL (MESSAGERIE)

### 6.1. Interface (MailInbox.tsx)
Interface type Webmail.
*   Affiche la liste des emails stockés dans la table `emails`.
*   Le corps des messages est stocké chiffré en base de données et déchiffré à la volée par le client React lors de l'ouverture.

### 6.2. Backend (Edge Functions)
*   **Send Mail :** Reçoit le destinataire et le corps, utilise l'API Resend pour l'expédition SMTP, et sauvegarde une copie dans le dossier "Sent" de l'utilisateur.
*   **Inbound Mail :** Webhook configuré chez le fournisseur DNS. Reçoit le JSON de l'email entrant, identifie l'utilisateur destinataire via la table `profiles`, et insère le message dans la table `emails`.

---

## 7. MODULE : SIVARA HELP (SUPPORT)

### 7.1. Base de Connaissances (HelpLanding.tsx)
*   Affiche les catégories (`help_categories`) et les articles (`help_articles`).
*   Barre de recherche filtrant les articles par titre/contenu via une requête ILIKE SQL.

### 7.2. Système de Tickets (HelpAdmin.tsx)
*   **Modèle de Données :** Relation `support_tickets` (1) -> `support_messages` (N).
*   **Vue Admin :** Interface permettant aux agents de voir la liste des tickets, de filtrer par statut, et de répondre.
*   **Réponse :** L'envoi d'une réponse déclenche l'Edge Function `support-outbound` qui envoie un email formaté au client et enregistre le message en base.

---

## 8. INFRASTRUCTURE BACKEND

### 8.1. Base de Données (PostgreSQL)
Le système repose sur un schéma relationnel strict.
*   **Tables Principales :** `profiles`, `documents`, `emails`, `device_units`, `support_tickets`.
*   **Types Avancés :** Utilisation de `JSONB` pour les métadonnées flexibles (ex: spécifications techniques des ordinateurs) et `TSVECTOR` pour la recherche plein texte native (fallback).

### 8.2. Sécurité RLS (Row Level Security)
Toute la sécurité des données repose sur les politiques RLS de PostgreSQL. L'API ne filtre pas manuellement les données ; c'est le moteur de base de données qui le fait.
*   **Exemple Politique Documents :** `CREATE POLICY "Users can only see their own documents" ON documents FOR SELECT USING (auth.uid() = owner_id)`.
*   Cela garantit que même en cas de faille dans l'API, un utilisateur ne peut techniquement pas récupérer les données d'un autre (la requête SQL renverrait 0 résultat).

---

## 9. INFRASTRUCTURE DE PAIEMENT

### 9.1. Stripe Integration
*   **API (stripe-api.ts) :** Gère la création des clients Stripe, des sessions de paiement (Checkout) et du portail de facturation.
*   **Webhooks (stripe-webhook.ts) :** Point d'entrée public sécurisé par signature. Écoute les événements `customer.subscription.created/updated/deleted`. Met à jour la table `profiles` (statut abonnement) et la table `device_units` (attribution du matériel au client après paiement réussi).

---

## 10. APPLICATION MOBILE ET NATIVE

### 10.1. Configuration Capacitor
Le projet utilise Capacitor pour envelopper l'application React web dans un conteneur natif (WebView).
*   **Deep Links :** Configuration du schéma d'URL `com.example.sivara://` pour gérer les retours d'authentification OAuth (Google/Apple) directement dans l'application.
*   **Plugins :** Utilisation de `@capacitor/camera` pour l'accès matériel lors de la vérification d'identité sur mobile.

---

**FIN DU DOCUMENT TECHNIQUE**