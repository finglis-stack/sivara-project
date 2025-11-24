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

### 5. Protocole d'Échange Cryptographique (.sivara)
Un format de fichier conteneur propriétaire conçu pour la migration de données "Zero-Trust" et la résilience.

*   **Encapsulation Sécurisée :** Le fichier `.sivara` contient le payload chiffré (AES-256-GCM), l'IV unique, l'ID du propriétaire original ainsi que les métadonnées visuelles (icône, couleur). Le fichier ne contient **aucune** clé de déchiffrement.
*   **Transmutation à la Volée (Re-Encryption) :**
    *   Lors de l'importation, le client effectue une opération de **Transmutation Cryptographique** locale :
        1. Dérivation temporaire de la clé publique basée sur l'ID du créateur original (stocké dans le fichier).
        2. Déchiffrement du contenu en mémoire volatile.
        3. Rechiffrement immédiat avec la clé privée de l'utilisateur courant.
        4. Insertion d'un **nouveau** document en base de données.
    *   **Résilience :** Ce processus permet de restaurer des données même si l'enregistrement original a été supprimé des serveurs (Deep Backup), car le fichier contient tout le nécessaire pour reconstruire l'information de manière autonome et sécurisée.

### 6. Centre d'Assistance Unifié - `help.sivara.ca`
Une plateforme de support hybride combinant base de connaissances publique et système de billetterie sécurisé.

*   **CMS Headless :** Gestion dynamique des articles et catégories d'aide. Les contenus sont servis via une API haute performance avec mise en cache.
*   **Ticketing System Omnicanal :**
    *   **Inbound Email Processing :** Les emails envoyés au support sont interceptés par des Webhooks Edge (Resend), analysés et convertis automatiquement en tickets structurés.
    *   **Outbound Transactionnel :** Les réponses des agents sont envoyées via une infrastructure SMTP réputée, avec injection de modèles HTML responsifs et signatures dynamiques.
*   **Interface Agent Temps Réel :** Dashboard administrateur permettant la gestion des tickets, la rédaction de réponses et le suivi des métriques clients, le tout synchronisé via WebSockets.

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