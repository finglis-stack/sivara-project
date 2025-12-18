# Sivara - Architecture Numérique Souveraine

![Ecosystem Status](https://img.shields.io/badge/System-Operational-success) ![Compliance](https://img.shields.io/badge/Conformit%C3%A9-Loi%2025%20(QC)-blueviolet)

## 🌐 Vision Stratégique

Sivara redéfinit l'infrastructure numérique personnelle en proposant un écosystème unifié où la **souveraineté des données** est garantie par le code ("Code is Law"). Contrairement aux modèles traditionnels basés sur l'exploitation des données, Sivara déploie une architecture "Zero-Knowledge" où l'utilisateur reste le seul détenteur des clés de chiffrement de ses informations sensibles.

Cette plateforme intègre un moteur de recherche sémantique, une suite bureautique chiffrée et une gestion d'identité fédérée, le tout orchestré par une infrastructure micro-services haute performance.

---

## ⚙️ Ingénierie et Architecture Système

L'écosystème repose sur une architecture distribuée exploitant la puissance du **Edge Computing** et de bases de données relationnelles vectorielles.

### 1. Gestion d'Identité Fédérée (SSO) - `account.sivara.ca`
Le noyau de sécurité centralisant l'authentification via le protocole **Secure Remote Password (SRP)** implicite.
*   **Session Management :** Architecture *Stateful* via Cookies sécurisés (`Secure`, `HttpOnly`, `SameSite=Lax`) avec domaine wildcard (`.sivara.ca`), permettant une persistance de session fluide entre les sous-domaines.
*   **Row Level Security (RLS) :** Ségrégation stricte des données au niveau du moteur PostgreSQL. Chaque transaction database est signée avec le JWT de l'utilisateur, rendant mathématiquement impossible l'accès croisé aux données (Cross-Tenant Data Leaks).
*   **Gouvernance des Données :** Schémas de base de données stricts typés (TypeScript/Postgres) garantissant l'intégrité référentielle.

### 2. Moteur d'Indexation Vectoriel - `sivara.ca`
Un pipeline de recherche nouvelle génération combinant analyse lexicale et sémantique.
*   **Vector Embeddings :** Utilisation de l'extension `pgvector` pour transformer les contenus web en vecteurs mathématiques à haute dimension, permettant une recherche contextuelle (et non seulement par mots-clés).
*   **Distributed Crawling :** Flotte de crawlers autonomes exécutés sur **Deno Edge Functions**, optimisés pour une latence minimale et un respect strict des protocoles `robots.txt`.
*   **Algorithme de Ranking Hybride :** Combinaison de scores de similarité cosinus (Cosine Similarity) et de pondération par métadonnées pour des résultats d'une pertinence chirurgicale.

### 3. Coffre-fort Numérique "Zero-Knowledge" - `docs.sivara.ca`
Une suite collaborative temps réel où le serveur agit comme un simple stockage aveugle (Blind Storage).

*   **Synchronisation Temps Réel (Architecture Bi-Canal) :**
    *   **Canal "Présence" (Stateful) :** Utilise les WebSockets pour synchroniser les états lents (avatars dans le header, statut en ligne).
    *   **Canal "Broadcast" (Stateless) :** Transmission éphémère haute fréquence (60fps) pour les curseurs et la sélection de texte. Ces données ne touchent jamais la base de données (latence < 50ms).
*   **Autorisation & Sécurité (The Bouncer) :**
    *   Utilisation stricte des politiques **Row Level Security (RLS)**. L'application ne valide pas les accès, c'est le moteur SQL qui le fait. Si l'ID utilisateur n'est pas dans la table `document_access` ou n'est pas `owner_id`, la donnée n'existe tout simplement pas pour le requérant.
*   **Client-Side Encryption (E2EE) :**
    *   Chiffrement **AES-256-GCM** exécuté exclusivement dans le navigateur via l'API Web Crypto. Le serveur ne voit que des chaînes de caractères aléatoires.
*   **Dérivation de Clés (PBKDF2) :**
    *   Les clés de chiffrement sont dérivées localement garantissant que les clés ne transitent jamais en clair sur le réseau.

### 4. Infrastructure de Paiement et Souscription (Billing)
L'architecture de facturation délègue la complexité transactionnelle à Stripe tout en maintenant une synchronisation stricte.

*   **Source of Truth (SOT) :** Stripe est l'autorité absolue pour l'état des abonnements. La base de données locale agit uniquement comme un miroir en lecture seule pour les permissions applicatives.
*   **Edge Webhooks :** Un pipeline de webhooks sécurisé (`stripe-webhook`) intercepte les événements de paiement en temps réel pour mettre à jour les statuts `is_pro` via des fonctions serveur privilégiées.
*   **Syncronisation Forcée :** Mécanisme de vérification à la demande permettant à l'utilisateur de forcer la réconciliation des états entre Stripe et la base de données en cas de latence des webhooks.

### 5. Langage Propriétaire "SivaraScript" et Kernel v5.0
Au cœur de la portabilité sécurisée se trouve désormais **SivaraScript**, un langage de programmation Turing-complete propriétaire, interprété par le **Sivara Kernel** (Edge VM).

Contrairement aux formats passifs (JSON, XML), un fichier `.sivara` est un **programme exécutable**. Il ne se contente pas de stocker des données, il contient la logique algorithmique de sa propre sécurité.

#### A. Le Langage SivaraScript (Syntaxe FR)
Un langage de haut niveau, entièrement en français, permettant de définir des "Smart Contracts" cryptographiques complexes directement dans le fichier.
*   **Variables & Mémoire :** Allocation dynamique (`soit x = ...`) et manipulation de registres mémoire (Heap).
*   **Flux de Contrôle :** Structures conditionnelles complètes (`si ... alors ... sinon`) et sauts conditionnels.
*   **Mathématiques & Logique :** Opérateurs arithmétiques et booléens (`ET`, `OU`, `abs`, `<`).
*   **Introspection :** Accès aux variables d'environnement sécurisées (`env.geo.lat`, `env.temps`).

**Exemple de Contrat (Geofencing) :**
```sivara
soit cible_lat = 455017
soit rayon = 500

si ( abs(env.geo.lat - cible_lat) < rayon ) alors (
   exiger ( 1 )
)
```

#### B. Architecture de la Machine Virtuelle (VM)
Le code source est compilé à la volée en **Bytecode SBP (Sivara Binary Protocol)** avant d'être injecté dans le conteneur.
*   **Stack-Based Architecture :** La VM utilise une pile d'opérandes pour les calculs, garantissant une exécution rapide et isolée.
*   **Jeu d'Instructions Étendu (ISA) :**
    *   `0x60` (**STORE**) / `0x61` (**LOAD**) : Gestion de la mémoire vive.
    *   `0x70` (**JMP**) / `0x71` (**JMP_IF_FALSE**) : Gestion des branchements et boucles.
    *   `0x40` (**ASSERT**) : Instruction critique de sécurité. Si la pile ne contient pas `1` (VRAI), la VM déclenche un **Kernel Panic** et détruit les clés de déchiffrement en mémoire.

#### C. Structure du Conteneur (.sivara)
```
[MAGIC: SVR3] [OP: VM_EXEC] [LEN] [BYTECODE] [OP: IV] ... [OP: DATA] ... [OP: EOF]
```
Le bloc `VM_EXEC` est exécuté **avant** toute tentative de lecture du bloc `DATA`. Si le script ne se termine pas proprement, le contenu reste mathématiquement inaccessible (chiffré et obfusqué).

#### D. Mécanisme de "Bit-Shuffling" (Obfuscation)
Pour empêcher l'analyse statique, le Kernel applique une transformation binaire propriétaire :
*   **Rotation de Bits :** `((byte << 2) | (byte >> 6))` pour décaler la structure binaire.
*   **XOR Dynamique :** Application d'une clé dérivée de la position du byte (`seed + index`).

### 6. Centre d'Assistance Unifié - `help.sivara.ca`
Une plateforme de support hybride combinant base de connaissances publique et système de billetterie sécurisé.

*   **CMS Headless :** Gestion dynamique des articles et catégories d'aide. Les contenus sont servis via une API haute performance avec mise en cache.
*   **Ticketing System Omnicanal :**
    *   **Inbound Email Processing :** Les emails envoyés au support sont interceptés par des Webhooks Edge (Resend), analysés et convertis automatiquement en tickets structurés.
    *   **Outbound Transactionnel :** Les réponses des agents sont envoyées via une infrastructure SMTP réputée, avec injection de modèles HTML responsifs et signatures dynamiques.
*   **Interface Agent Temps Réel :** Dashboard administrateur permettant la gestion des tickets, la rédaction de réponses et le suivi des métriques clients, le tout synchronisé via WebSockets.

### 7. Infrastructure Matérielle (DaaS) - `device.sivara.ca`
Un service de "Device-as-a-Service" permettant la location d'ordinateurs optimisés pour la confidentialité.

*   **Gestion d'Inventaire "Smart Diversity" :**
    *   Algorithme de sélection stochastique (`Fisher-Yates Shuffle`) côté client pour présenter une variété de configurations (RAM/Stockage) disponibles en temps réel, évitant l'effet "First-Come, First-Served" sur les meilleurs modèles.
*   **Logistique Géospatiale (Google Maps Platform) :**
    *   Calcul dynamique des frais de livraison et des délais (Standard vs Express) basé sur la distance géodésique entre l'entrepôt (Montréal) et l'adresse client via l'API Google Places/Geometry.
*   **Intégration Hardware/Software :**
    *   Les appareils sont livrés avec **Zorin OS** pré-configuré, garantissant une stack 100% open-source et sans télémétrie dès le premier démarrage.
*   **Oracle Financier (Moteur Prédictif) :**
    *   Le DaaS n'est pas qu'une simple location, c'est un produit financier complexe nécessitant une gestion de risque algorithmique. L'Oracle est un système de modélisation en temps réel qui croise les données de **coût matériel**, de **risque client (KYC)** et de **dynamiques de marché** pour piloter la rentabilité de chaque contrat.
    *   **Simulation Monte-Carlo Dynamique :** Contrairement à un simple calcul linéaire, l'Oracle projette des milliers de scénarios de flux de trésorerie (Cashflow) sur 24 mois. Il prend en compte des variables stochastiques comme l'inflation, la volatilité du marché secondaire et le risque de défaut de paiement (Churn).
    *   **Scoring de Confiance (TrustScore) :** Le "TrustScore" généré lors du KYC biométrique (0-100) n'est pas juste binaire (Accept/Reject). Il alimente directement le modèle financier pour ajuster la **prime de risque** et prédire le "Point de Rupture" (moment probable de résiliation). Un score faible augmente automatiquement la provision pour risque, impactant la VAN (Valeur Actuelle Nette) projetée.
    *   **Stratégie de Sortie (Asset Valuation) :** L'Oracle calcule en permanence la valeur de liquidation de la flotte. Il détermine le "Flip Month" optimal : le moment précis où la valeur résiduelle du matériel + le cash accumulé maximise le profit avant que la dépréciation ne s'accélère. Cela permet une gestion proactive du cycle de vie des actifs (renouvellement anticipé vs maintien).

### 8. Protocole de Vérification Biométrique (KYC) - `id.sivara.ca`
Une forteresse de validation d'identité "Zero-Trust" requise pour l'accès aux infrastructures critiques (Device Rental) et la lutte contre la fraude.

*   **Analyse Documentaire Cognitive (Gemini 1.5 Pro) :**
    *   Pipeline d'ingestion visuelle traitant les pièces d'identité (Recto/Verso) en temps réel.
    *   Extraction OCR structurée et analyse forensique par IA pour la détection de falsifications, dates d'expiration, cohérence visuelle et tentatives de spoofing photo.
*   **Empreinte Numérique Avancée (Device Fingerprinting) :**
    *   Analyse profonde de la configuration matérielle via `FingerprintJS` couplée à une inspection des contextes de rendu WebGL.
    *   **Anti-Virtualisation :** Détection automatique des environnements émulés ou virtualisés (VMware, VirtualBox, Simulateurs headless) souvent utilisés pour l'automatisation frauduleuse.
*   **Moteur de Décision Heuristique :**
    *   **Comparaison Identitaire Stricte :** Algorithme de normalisation (NFD/Unicode) comparant les données extraites de la pièce d'identité avec le profil sécurisé en base de données. Tolérance zéro sur les discordances d'identité.
    *   **Risk Scoring Dynamique :** Agrégation des signaux (âge, validité document, cohérence IP/Device) pour générer un score de risque bloquant instantanément les transactions suspectes avant l'accès aux passerelles de paiement.

### 9. Sivara Text - Intelligence Rédactionnelle Personnalisée
Au-delà de la simple correction orthographique, **Sivara Text** est un moteur cognitif local qui s'adapte au style unique de l'utilisateur.

*   **Pourquoi ?**
    Les correcteurs standards imposent une norme rigide. Sivara Text reconnaît que le langage est personnel. Si un utilisateur utilise un argot spécifique, un jargon technique ou une tournure de phrase particulière, le système ne doit pas le "corriger" indéfiniment, mais l'apprendre.

*   **Comment ça fonctionne (Algorithme) :**
    L'analyse se fait en temps réel lors de la frappe, orchestrée par un moteur hybride à trois niveaux :
    1.  **Analyse Orthographique (LanguageTool) :** Fournit la base normative stricte.
    2.  **Analyse Phonétique (French Soundex) :** Un algorithme propriétaire transforme les mots en "signatures sonores". Il permet de suggérer "Salut" même si l'utilisateur écrit "Salu" (faute que les correcteurs basés sur la distance pure ratent souvent).
    3.  **Mémoire Neuronale Pondérée (User Memory) :**
        *   À chaque fois que l'utilisateur sélectionne une correction manuelle, le système enregistre la paire `(faute -> choix)`.
        *   **Formule de pondération :** `Score = Base + (log(Frequence + 1) * 30)`.
        *   L'utilisation d'une courbe logarithmique permet au système d'apprendre très vite une nouvelle préférence (1 ou 2 utilisations suffisent pour surpasser la suggestion par défaut), tout en plafonnant pour éviter de dériver totalement.

*   **Infrastructure de Synchronisation Sécurisée :**
    *   **Priorité Locale (0 Latence) :** Le modèle d'apprentissage est chargé en RAM et persisté dans le `localStorage`. L'analyse est instantanée et fonctionne hors-ligne.
    *   **Stockage Chiffré (Cloud) :** Pour permettre la continuité entre appareils, le modèle est synchronisé en base de données.
    *   **Confidentialité Absolue :** Avant de quitter le navigateur, le JSON du modèle d'apprentissage est chiffré en **AES-256-GCM** avec la clé maître de l'utilisateur. Le serveur reçoit un blob illisible `text_preferences`. Sivara ne peut techniquement pas savoir quels mots vous utilisez ou quelles fautes vous faites.

### 10. Plateforme Éducative Adaptative - `edu.sivara.ca`
Une infrastructure d'apprentissage personnalisée propulsée par l'IA, conçue pour maximiser la réussite scolaire sans compromettre la vie privée des étudiants.

*   **Tuteur IA Contextuel :**
    *   Analyse en temps réel des interactions de l'étudiant pour détecter les micro-lacunes conceptuelles.
    *   Génération dynamique de quiz et d'explications adaptées au niveau de compréhension courant (Scaffolding).
*   **Gamification Éthique :**
    *   Mécaniques d'engagement (XP, Séries) calibrées pour favoriser la constance (Habit Building) plutôt que l'addiction, avec un respect total de l'attention de l'utilisateur.
*   **Alignement Curriculaire :**
    *   Architecture de données structurée mappant précisément les compétences requises par le Ministère (ex: Science et Technologie Sec 4, Mathématiques TS).

---

## 🔬 Deep Dive : Architecture Moteur "Sivara Titanium"

Cette section détaille l'implémentation technique du moteur de recherche, conçue comme un système **Crypto-Search** propriétaire. Le principe fondateur est le **"Blind Indexing" (Indexation à l'Aveugle)** : l'infrastructure de stockage ne contient jamais de texte clair.

### 1. Pipeline d'Ingestion Chiffré (The Crawler)

L'ingestion est assurée par une flotte distribuée de micro-services "Serverless" autonomes.

#### A. La File d'Attente Opaque
Contrairement aux indexeurs standards, Sivara ne stocke pas les URLs cibles en clair.
1.  **Insertion :** L'utilisateur soumet une URL.
2.  **Chiffrement Immédiat :** L'URL est chiffrée en **AES-256-GCM** avec un vecteur d'initialisation (IV) unique avant même d'être insérée en base.
3.  **Stockage :** La base de données relationnelle reçoit un blob binaire illisible. L'administrateur système ne peut pas auditer les cibles du crawler.

#### B. Orchestration & Déchiffrement JIT
Un superviseur ("Watchdog") distribue la charge avec une gestion stricte de la concurrence (Semaphore Pattern). L'URL n'est déchiffrée qu'en mémoire volatile (RAM) au moment précis de l'exécution du job par le worker, puis immédiatement effacée (Zero-Persistence).

#### C. Extraction et Normalisation
Le worker télécharge le HTML et applique un nettoyage agressif :
*   Extraction des métadonnées via Regex haute performance.
*   Détection de langue heuristique.
*   **Mode Découverte :** Hachage cryptographique (SHA-256) des liens sortants pour dédoublonnage sans révéler l'URL originale.

---

### 2. Le Moteur NLP "Titanium"

C'est le cœur algorithmique du système. Au lieu d'indexer des mots, le système indexe des concepts linguistiques transformés en preuves cryptographiques via le `TitaniumTokenizer` :

1.  **Normalisation (NFD) :** Suppression des accents et diacritiques (`été` -> `ete`).
2.  **Filtrage Stopwords :** Nettoyage multilingue (FR/EN) des bruits syntaxiques.
3.  **Stemming (Racine) :** Algorithme de **Porter** pour réduire les mots à leur racine (`manger`, `mangé` -> `mang`).
4.  **Empreinte Phonétique :** Algorithme **Double Metaphone**. Encode la *sonorité* du mot, permettant une tolérance aux fautes d'orthographe (ex: "Sivara" match "Sivarra" ou "Civara").
5.  **N-Grams :** Découpage en trigrammes pour la recherche floue.

---

### 3. Stratégie d'Indexation à l'Aveugle (Blind Index)

C'est l'aspect unique du système. Pour chaque token généré par le NLP, le système génère un **HMAC-SHA256** avec une clé secrète de recherche, distincte de la clé de chiffrement du contenu.

*   Le mot "Pomme" devient -> `hmac(SEARCH_KEY, "EX:pomme")` -> `x8f9...`
*   La racine "Pomm" devient -> `hmac(SEARCH_KEY, "ST:pomm")` -> `a1b2...`
*   Le son "PM" devient -> `hmac(SEARCH_KEY, "PH:PM")` -> `z9y8...`

Ces hashs sont stockés dans une colonne vectorielle en base de données. **Le moteur SQL ne voit que des suites de caractères aléatoires** et ne peut pas effectuer d'analyse sémantique inverse. Le contenu brut (titre, description) est stocké chiffré (AES-256-GCM) et est mathématiquement illisible sans la clé `ENCRYPTION_KEY`.

---

### 4. Algorithme de Recherche et Ranking (Retrieval)

Lorsqu'un utilisateur lance une recherche :

1.  **Tokenisation de la Requête :** La requête utilisateur subit le même traitement NLP "Titanium" (Stemming, Phonétique, etc.).
2.  **Transmutation Cryptographique :** Les tokens de la requête sont convertis en leurs équivalents HMAC côté serveur (Edge).
3.  **Intersection Vectorielle :** La requête SQL effectue une intersection d'ensembles (`Array Overlap`) sur les hashs. C'est une opération mathématique pure, extrêmement rapide sur PostgreSQL.
4.  **Scoring Pondéré (In-Memory) :**
    L'Edge Function récupère les candidats et calcule un score de pertinence localement :
    *   Match Exact (Token `EX`) : **100 points**
    *   Match Racine (Token `ST`) : **80 points**
    *   Match Phonétique (Token `PH`) : **50 points**
    *   Match Partiel (Token `TG`) : **5 points**
5.  **Déchiffrement à la Volée :** Seuls les résultats pertinents sont déchiffrés (AES-Decrypt) avant d'être renvoyés au client JSON.

---

### 5. Stack Technique "Titanium"

*   **Compute :** Deno Edge Functions (V8 Isolate). Temps de démarrage < 400ms.
*   **Database :** PostgreSQL 15 avec extensions `pg_trgm` et types `JSONB` pour le stockage vectoriel opaque.
*   **Crypto Libs :**
    *   `Web Crypto API` (Native SubtleCrypto) pour des performances proches du C++.
    *   `natural` (Node module via ESM) pour les algorithmes linguistiques avancés.
*   **Sécurité :** Architecture "Defense in Depth". Même en cas de fuite complète de la base de données (`SQL Dump`), un attaquant ne récupérerait que du bruit binaire et des hashs irréversibles, rendant les données totalement inexploitables.

---

## 🛡️ Conformité Légale et Loi 25 (Québec)

Sivara intègre nativement les exigences de la **Loi modernisant des dispositions législatives en matière de protection des renseignements personnels** (Loi 25).

### Mesures Techniques de Conformité
*   **Privacy by Design :** L'architecture empêche techniquement l'accès aux données utilisateur par les administrateurs de la plateforme (grâce au chiffrement client).
*   **Minimisation des Données :** Collecte strictement limitée aux métadonnées essentielles au fonctionnement du service. Aucune donnée comportementale n'est stockée.
*   **Droit à l'Effacement (Right to be Forgotten) :** Procédures automatisées (`ON DELETE CASCADE` au niveau SQL) assurant la destruction totale et irréversible des données utilisateur lors de la suppression du compte.
*   **Traçabilité et Audit :** Journaux d'accès cryptographiques permettant de détecter toute anomalie sans compromettre la confidentialité des contenus.

---

## 💎 Sivara Pro : Infrastructure Étendue

Pour les utilisateurs exigeant une capacité industrielle, l'offre Pro débloque les verrous de l'infrastructure :

*   **Identité Personnalisée (CNAME/MX) :** Routage DNS géré pour connecter votre propre nom de domaine. Vos emails et documents sous votre marque (`@votre-entreprise.com`).
*   **Stockage Haute Capacité :** Allocation de **30 Go** sur des clusters de stockage NVMe répliqués.
*   **Gouvernance Avancée :** Historique de versions illimité ("Time Travel") sur tous les documents chiffrés et support prioritaire dédié.

---

## 💻 Stack Technologique

Une pile technique moderne choisie pour sa robustesse, sa typologie stricte et sa scalabilité.

*   **Frontend :** React 18, TypeScript, Vite (Compilation optimisée SWC).
*   **UI System :** Shadcn/UI sur base Radix Primitives (Accessibilité WCAG 2.1 AA).
*   **Backend Infrastructure :** Supabase (PostgreSQL 15+).
*   **Compute :** Edge Functions (Deno runtime) pour les micro-services serverless.
*   **Cryptographie :** Web Crypto API (Standard natif browser).
*   **CI/CD :** Déploiement continu avec vérification statique du code.

---

*Reprenez le contrôle de votre vie numérique.*