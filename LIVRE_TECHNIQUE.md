# LIVRE TECHNIQUE SIVARA
## DOCUMENTATION D'ARCHITECTURE ET DE FONCTIONNEMENT

**Version du système :** 1.0.0
**Date de génération :** 2024
**Classification :** CONFIDENTIEL / ARCHITECTURE INTERNE

---

## TABLE DES MATIÈRES

1. **ARCHITECTURE GLOBALE ET ROUTAGE**
    1.1. Point d'entrée (Main.tsx)
    1.2. Orchestrateur d'Applications (App.tsx)
    1.3. Logique de Routage Hybride (Web vs Mobile)
    1.4. Gestionnaire de Thème et Styles Globaux
2. **INFRASTRUCTURE D'AUTHENTIFICATION (SIVARA ACCOUNT)**
    2.1. Contexte d'Authentification (AuthContext.tsx)
    2.2. Page de Connexion (Login.tsx)
    2.3. Flux d'Inscription (Onboarding.tsx)
    2.4. Gestion de Profil (Profile.tsx)
    2.5. Réinitialisation de Mot de Passe
    2.6. Client Supabase et Gestion des Cookies
3. **MOTEUR DE RECHERCHE (SIVARA WWW)**
    3.1. Interface de Recherche (Index.tsx)
    3.2. Composant SearchBar
    3.3. Affichage des Résultats (SearchResult.tsx)
    3.4. Gestionnaire d'Indexation (CrawlManager.tsx)
    3.5. Console de Monitoring (Monitor.tsx)
    3.6. Edge Function : Search (Moteur Titanium)
    3.7. Edge Function : Crawl Page (Indexation Chiffrée)
    3.8. Edge Function : Process Queue (Orchestration)
4. **SUITE BUREAUTIQUE SÉCURISÉE (SIVARA DOCS)**
    4.1. Interface Principale (Docs.tsx)
    4.2. Système de Glisser-Déposer (DnD)
    4.3. Éditeur de Document (DocEditor.tsx)
    4.4. Service de Chiffrement Client (EncryptionService)
    4.5. Machine Virtuelle SBP (Sivara VM)
    4.6. Edge Function : Sivara Kernel
5. **SERVICE DE MESSAGERIE (SIVARA MAIL)**
    5.1. Page d'Accueil (MailLanding.tsx)
    5.2. Boîte de Réception (MailInbox.tsx)
    5.3. Edge Function : Send Mail
    5.4. Edge Function : Inbound Mail (Webhook)
6. **CENTRE D'ASSISTANCE (SIVARA HELP)**
    6.1. Portail Public (HelpLanding.tsx)
    6.2. Navigation par Catégorie et Article
    6.3. Interface Administrateur (HelpAdmin.tsx)
    6.4. Edge Function : Support Outbound (Resend)
    6.5. Edge Function : Support Inbound (Ticket Automation)
7. **LOCATION DE MATÉRIEL (SIVARA DEVICE)**
    7.1. Vitrine Commerciale (DeviceLanding.tsx)
    7.2. Tunnel de Commande (DeviceCheckout.tsx)
    7.3. Administration des Ventes (DeviceAdmin.tsx)
    7.4. Détail Client et Oracle Financier (DeviceCustomerDetails.tsx)
    7.5. Composant OraclePanel (Visualisation Financière)
    7.6. Page de Succès de Commande
8. **VÉRIFICATION D'IDENTITÉ (SIVARA ID)**
    8.1. Processus de Vérification (IdentityVerification.tsx)
    8.2. Capture Biométrique
    8.3. Edge Function : Verify Identity (IA Gemini)
9. **INFRASTRUCTURE DE PAIEMENT (BILLING)**
    9.1. Page de Tarification (Pricing.tsx)
    9.2. Tunnel de Paiement (Checkout.tsx)
    9.3. Edge Function : Stripe API
    9.4. Edge Function : Stripe Webhook
10. **APPLICATION MOBILE ET NATIVE**
    10.1. Configuration Capacitor
    10.2. Page d'Accueil Mobile (MobileLanding.tsx)
    10.3. Gestion des Deep Links

---

## 1. ARCHITECTURE GLOBALE ET ROUTAGE

### 1.1. Point d'entrée (Main.tsx)
Le fichier `src/main.tsx` est le point d'amorçage de l'application React. Il utilise `createRoot` de React 18 pour hydrater l'élément DOM `root`. Il importe les styles globaux (`globals.css`) qui définissent les variables CSS Tailwind et les polices.

### 1.2. Orchestrateur d'Applications (App.tsx)
Sivara fonctionne comme une "Super-App" ou un Monorepo simulé. Le fichier `App.tsx` ne contient pas de routes statiques simples, mais un moteur de décision intelligent.
*   **Hook useMemo (currentApp) :** Analyse l'URL courante pour déterminer quelle "sous-application" charger.
*   **Détection par Sous-domaine :** Si l'URL commence par `docs.`, l'application bascule en mode `docs`. Idem pour `mail.`, `account.`, etc.
*   **Détection par Paramètre (Mode Local/Dev) :** Si l'URL contient `?app=docs`, cela force le mode, permettant le développement local sans configuration DNS complexe.
*   **Détection Native (Capacitor) :** Si l'application tourne dans un conteneur mobile iOS/Android, elle utilise une logique spécifique pour afficher le lanceur mobile (`MobileLanding`).

### 1.3. Logique de Routage Hybride
Le composant `AppRoutes` divise les routes par blocs conditionnels.
*   **Routes Account :** `/login`, `/register`, `/profile`.
*   **Routes Docs :** `/` (Liste), `/:id` (Éditeur).
*   **Routes Device :** `/checkout`, `/admin`.
Chaque bloc est isolé. Une route `/admin` dans l'application `Docs` ne mènera pas à l'administration de `Device`.

### 1.4. Gestionnaire de Thème et Styles Globaux
Le fichier `globals.css` et `tailwind.config.ts` définissent l'identité visuelle.
*   Utilisation de variables CSS (`--primary`, `--background`) pour le support natif du mode sombre.
*   Configuration d'animations personnalisées (`accordion-down`, `wave-undulate`) dans Tailwind.
*   Typographie normalisée via la police Inter.

---

## 2. INFRASTRUCTURE D'AUTHENTIFICATION (SIVARA ACCOUNT)

### 2.1. Contexte d'Authentification (AuthContext.tsx)
Ce contexte React enveloppe toute l'application.
*   **Initialisation :** Au montage, il interroge `supabase.auth.getSession()` pour récupérer le JWT stocké.
*   **Écouteur d'événements :** S'abonne à `onAuthStateChange`. Si le token est rafraîchi ou si l'utilisateur se déconnecte, l'état global React est mis à jour instantanément.
*   **Sécurité Cross-Domain :** Gère la logique complexe de partage de session entre `sivara.ca` et `docs.sivara.ca` via des cookies configurés avec `domain: .sivara.ca`.

### 2.2. Page de Connexion (Login.tsx)
Interface utilisateur pour l'entrée des identifiants.
*   **États Multiples :** Gère les vues "Email", "Mot de passe", et "Récupération".
*   **Protection Brute-Force (Simulée) :** Un état `blockedUntil` empêche la soumission rapide et répétée.
*   **Redirection Intelligente :** Utilise le paramètre `returnTo` pour renvoyer l'utilisateur vers l'application d'origine (ex: Docs ou Mail) après une connexion réussie.

### 2.3. Flux d'Inscription (Onboarding.tsx)
Processus multi-étapes pour la création de compte.
*   **Étape 1 :** Collecte des données civiles (Nom, Prénom, Téléphone).
*   **Étape 2 :** Création des identifiants (Email, Mot de passe).
*   **Transaction Atomique :** Crée l'utilisateur dans `auth.users` via l'API Supabase, puis insère immédiatement le profil détaillé dans la table `public.profiles`.

### 2.4. Gestion de Profil (Profile.tsx)
Tableau de bord utilisateur centralisé.
*   **Upload d'Avatar :** Utilise un `input type="file"`, lit le fichier en Base64, permet un recadrage via Canvas HTML5, puis upload vers Supabase Storage dans le bucket `avatars`.
*   **Modification de Données :** Formulaires liés à la table `profiles`.
*   **État de l'Abonnement :** Affiche le statut Pro/Free et la date de renouvellement en se basant sur les champs synchronisés depuis Stripe.

---

## 3. MOTEUR DE RECHERCHE (SIVARA WWW)

### 3.1. Interface de Recherche (Index.tsx)
Page d'accueil minimaliste inspirée des moteurs de recherche modernes.
*   **Gestion d'État :** Bascule entre la vue "Landing" (barre au centre, grand logo) et la vue "Résultats" (barre en haut) dès qu'une recherche est lancée.
*   **Appel API :** Envoie la requête JSON à l'Edge Function `search`.

### 3.2. Composant SearchBar
Composant réutilisable contenant l'input et le bouton de recherche. Gère l'état de chargement (spinner) et la soumission du formulaire.

### 3.3. Affichage des Résultats (SearchResult.tsx)
Carte affichant un résultat individuel.
*   **Favicon :** Utilise l'API Google S2 pour récupérer l'icône du domaine.
*   **Groupement :** Logique pour afficher les "sous-résultats" indentés si plusieurs pages proviennent du même domaine.

### 3.4. Gestionnaire d'Indexation (CrawlManager.tsx)
Interface administrative pour soumettre des URLs au moteur.
*   **Import CSV :** Utilise `FileReader` pour parser un fichier texte local contenant une liste d'URLs.
*   **Appel Queue :** Pour chaque URL, appelle la fonction `add-to-queue`.

### 3.5. Edge Function : Search (Moteur Titanium)
Le cœur du moteur de recherche.
*   **Tokenizer :** Utilise la librairie `natural` pour normaliser le texte (stemming, phonétique).
*   **Crypto-Search :** Génère des tokens HMAC (Hash-based Message Authentication Code) à partir des mots-clés.
*   **Comparaison Vectorielle :** Interroge la base de données PostgreSQL pour trouver les lignes dont le champ `blind_index` (tableau de hashs) correspond aux tokens de la requête.
*   **Déchiffrement JIT :** Déchiffre le titre et la description (AES-256) uniquement pour les résultats correspondants avant de les renvoyer au client.

### 3.6. Edge Function : Crawl Page
Le robot d'indexation.
*   **Fetch & Parse :** Télécharge le HTML de la page cible. Nettoie le DOM pour extraire le texte utile.
*   **Chiffrement :** Chiffre le contenu brut, le titre et l'URL avec une clé AES serveur.
*   **Indexation Aveugle :** Génère les tokens de recherche (HMAC) à partir du texte clair et les stocke dans la colonne `blind_index`. Le texte clair est détruit de la mémoire.

---

## 4. SUITE BUREAUTIQUE SÉCURISÉE (SIVARA DOCS)

### 4.1. Interface Principale (Docs.tsx)
Gestionnaire de fichiers (Drive).
*   **Arborescence :** Gère la navigation dans les dossiers via `parent_id` et un fil d'ariane (`breadcrumbs`).
*   **Drag & Drop :** Utilise `@dnd-kit` pour permettre le déplacement visuel des fichiers dans des dossiers. Met à jour `parent_id` en base de données lors du `onDragEnd`.

### 4.2. Éditeur de Document (DocEditor.tsx)
L'éditeur de texte riche collaboratif.
*   **Tiptap :** Framework d'édition headless basé sur ProseMirror.
*   **Realtime :** Utilise les `Realtime Channels` de Supabase.
    *   **Broadcast Cursors :** Envoie les coordonnées X/Y de la souris des autres utilisateurs 60 fois par seconde.
    *   **Broadcast Content :** Envoie les deltas de contenu chiffrés aux autres pairs.

### 4.3. Service de Chiffrement (EncryptionService - encryption.ts)
Classe singleton gérant la cryptographie Web Crypto API.
*   **PBKDF2 :** Dérive une clé AES-GCM 256 bits à partir de l'ID utilisateur (ou d'un mot de passe).
*   **Encrypt/Decrypt :** Méthodes asynchrones prenant du texte clair et retournant du Base64 (et inversement). Gère la génération aléatoire des IV (Vecteurs d'Initialisation).

### 4.4. Machine Virtuelle SBP (Sivara VM - sivara-vm.ts)
Couche d'abstraction pour l'export de fichiers `.sivara`.
*   **Compile :** Prépare un payload JSON contenant les clés chiffrées et les métadonnées de sécurité, puis l'envoie au Kernel.
*   **Decompile :** Envoie un fichier binaire au Kernel et reçoit le JSON structuré si les conditions de sécurité sont remplies.

### 4.5. Edge Function : Sivara Kernel
Le gardien du protocole propriétaire.
*   **OpCodes :** Manipule les données au niveau binaire (Byte array). Ajoute des en-têtes magiques (`SVR3`).
*   **Bit-Shuffling :** Applique une rotation de bits propriétaire pour obfusquer le contenu du fichier et empêcher sa lecture par des outils standards.
*   **Vérification de Sécurité :** Lors de la décompilation, vérifie l'IP du client (Geofencing) et l'empreinte navigateur (Fingerprint) avant d'autoriser l'accès au contenu chiffré.

---

## 5. SERVICE DE MESSAGERIE (SIVARA MAIL)

### 5.1. Boîte de Réception (MailInbox.tsx)
Interface utilisateur simulant un webmail moderne.
*   **Liste Virtuelle :** Affiche les emails stockés en base de données.
*   **Chiffrement E2EE :** Les corps des emails sont stockés chiffrés en base et déchiffrés à la volée côté client.

### 5.2. Edge Function : Send Mail
Envoi d'emails sortants.
*   Utilise l'API Resend pour l'expédition SMTP réelle.
*   Sauvegarde une copie dans la table `emails` (dossier Sent) de l'utilisateur.

### 5.3. Edge Function : Inbound Mail
Webhook recevant les emails entrants (configuré sur le provider DNS/Email).
*   Parse le JSON entrant (expéditeur, sujet, corps).
*   Identifie l'utilisateur destinataire dans la table `profiles`.
*   Insère l'email dans la table `emails` (dossier Inbox).

---

## 6. CENTRE D'ASSISTANCE (SIVARA HELP)

### 6.1. Système de Tickets
Modèle de données relationnel : `support_tickets` (Sujet, Statut) -> `support_messages` (Corps, Auteur).
*   **Admin (HelpAdmin.tsx) :** Interface pour les agents de support. Permet de voir la liste des tickets, filtrer par statut, et répondre.
*   **Vue Client :** Intégrée dans le profil ou via email.

### 6.2. Edge Function : Support Outbound
Envoie la réponse d'un agent au client par email via Resend. Génère un template HTML propre avec le logo Sivara.

### 6.3. Edge Function : Support Inbound
Reçoit les réponses par email des clients et les injecte comme nouveaux messages dans le ticket existant en base de données, permettant une conversation fluide par email côté client et par interface web côté agent.

---

## 7. LOCATION DE MATÉRIEL (SIVARA DEVICE)

### 7.1. Vitrine (DeviceLanding.tsx)
Catalogue des ordinateurs disponibles.
*   **Algorithme de Sélection :** Pour éviter que tout le monde ne réserve le même appareil, le client mélange aléatoirement les unités disponibles ayant les mêmes spécifications techniques.
*   **Réservation Atomique :** Appelle une fonction RPC PostgreSQL `reserve_device` qui pose un verrou temporaire sur l'unité pour éviter les doubles commandes.

### 7.2. Tunnel de Commande (DeviceCheckout.tsx)
Formulaire de paiement.
*   **Google Maps API :** Autocomplétion de l'adresse et calcul de la distance géodésique pour déterminer les frais de livraison (Express vs Standard).
*   **Stripe Elements :** Intégration du formulaire de carte bancaire sécurisé.

### 7.3. Oracle Financier (OraclePanel.tsx)
Tableau de bord de visualisation de données financières (D3.js / Recharts).
*   **Simulation Monte-Carlo :** Calcule des milliers de scénarios de rentabilité pour un client donné en fonction de son score de risque, de l'amortissement du matériel et de l'inflation.
*   **Calcul de ROI :** Affiche le "Point de Flip" (moment optimal pour revendre le matériel).

---

## 8. VÉRIFICATION D'IDENTITÉ (SIVARA ID)

### 8.1. Processus KYC (IdentityVerification.tsx)
Interface critique pour la validation des clients.
*   **Accès Caméra :** Utilise `navigator.mediaDevices.getUserMedia` pour prendre des photos recto/verso de la pièce d'identité.
*   **Canvas :** Dessine le flux vidéo sur un canvas caché pour capturer une image statique en JPEG.

### 8.2. Edge Function : Verify Identity
Cerveau de l'analyse d'identité.
*   **Google Gemini AI :** Envoie les images à l'IA multimodale de Google avec un prompt spécifique pour extraire les données OCR (Nom, Date de naissance, Numéro de document).
*   **Validation Algorithmique :** Compare le nom extrait avec le nom du profil (Fuzzy Matching). Vérifie la validité mathématique du numéro d'assurance maladie (Algorithme RAMQ).
*   **Détection de Fraude :** Analyse les métadonnées pour détecter les photos d'écrans (Moiré pattern) ou les montages.

---

## 9. INFRASTRUCTURE DE PAIEMENT (BILLING)

### 9.1. Intégration Stripe (stripe-api.ts)
Fonction serveur gérant toutes les interactions Stripe.
*   **Création de Client :** Crée un `Customer` Stripe lié à l'UUID Supabase.
*   **Création d'Abonnement :** Génère un `PaymentIntent` ou une `Subscription` selon le produit (Logiciel vs Matériel).
*   **Portail Client :** Génère une URL temporaire vers le portail de facturation Stripe hébergé.

### 9.2. Webhooks (stripe-webhook.ts)
Point de terminaison public écoutant les événements Stripe.
*   Sécurisé par signature cryptographique Stripe.
*   Met à jour la table `profiles` (champs `is_pro`, `subscription_status`) en temps réel lors des paiements réussis ou échoués.

---

## 10. APPLICATION MOBILE

### 10.1. Capacitor
Wrapper natif transformant l'application React en binaire iOS (.ipa) et Android (.apk).
*   **capacitor.config.ts :** Configuration du Bundle ID et des permissions.
*   **Plugins :** Utilise `@capacitor/camera`, `@capacitor/app` pour les fonctionnalités natives.

### 10.2. Page d'Accueil Mobile (MobileLanding.tsx)
Interface tactile optimisée ("Launcher").
*   Remplace le routeur web standard sur mobile.
*   Affiche des grosses cartes tactiles pour lancer les sous-applications (Mail, Docs, etc.).

---

**FIN DU DOCUMENT**