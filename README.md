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

---

## 🛡️ Conformité Légale et Loi 25 (Québec)

Sivara intègre nativement les exigences de la **Loi modernisant des dispositions législatives en matière de protection des renseignements personnels** (Loi 25).

### Mesures Techniques de Conformité
*   **Privacy by Design :** L'architecture empêche techniquement l'accès aux données utilisateur par les administrateurs de la plateforme (grâce au chiffrement client).
*   **Minimisation des Données :** Collecte strictement limitée aux métadonnées essentielles au fonctionnement du service. Aucune donnée comportementale n'est stockée.
*   **Droit à l'Effacement (Right to be Forgotten) :** Procédures automatisées (`ON DELETE CASCADE` au niveau SQL) assurant la destruction totale et irréversible des données utilisateur lors de la suppression du compte.
*   **Traçabilité et Audit :** Journaux d'accès cryptographiques permettant de détecter toute anomalie sans compromettre la confidentialité des contenus.

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