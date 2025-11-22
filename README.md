# Sivara - L'Écosystème Numérique Souverain et Sécurisé

![Sivara Ecosystem](https://img.shields.io/badge/Status-Production-green) ![Security](https://img.shields.io/badge/Security-AES--256--GCM-blue) ![Compliance](https://img.shields.io/badge/Compliance-Loi%2025%20(QC)-important)

## 🌐 Vision & Mission

**Sivara** n'est pas simplement une suite d'applications web ; c'est une infrastructure numérique unifiée conçue autour d'un principe fondamental : **la souveraineté des données de l'utilisateur.**

Dans un monde numérique où la confidentialité est souvent compromise, Sivara propose une alternative robuste, intégrant un moteur de recherche impartial, une suite bureautique chiffrée de bout en bout et une gestion d'identité centralisée. Notre architecture "Privacy-First" garantit que la technologie sert l'utilisateur, et non l'inverse.

---

## 🏗 Architecture Technique de l'Écosystème

Sivara repose sur une architecture micro-services distribuée via des sous-domaines interconnectés, partageant une couche d'authentification unique (SSO - Single Sign-On).

### 1. Le Noyau : Sivara Account (`account.sivara.ca`)
Le centre de commande de l'identité numérique.
*   **Authentification Unifiée (SSO) :** Utilisation de cookies sécurisés (`Secure`, `SameSite=Lax`, `Domain=.sivara.ca`) permettant une navigation fluide entre les services sans reconnexion.
*   **Gestion de Profil :** Stockage sécurisé des métadonnées utilisateur (Avatar, Contact) avec des politiques RLS (Row Level Security) strictes.
*   **Sécurité :** Protection contre les attaques par force brute et validation stricte des entrées.

### 2. L'Exploration : Sivara Search (`sivara.ca`)
Un moteur de recherche propriétaire et éthique.
*   **Indexation Intelligente :** Crawlers autonomes déployés sur des Edge Functions pour une latence minimale.
*   **Traitement Vectoriel :** Utilisation de `pgvector` pour une pertinence sémantique supérieure.
*   **Confidentialité des Requêtes :** Aucune trace persistante des recherches associées à l'identité de l'utilisateur.

### 3. La Productivité : Sivara Docs (`docs.sivara.ca`)
Un espace de travail "Zero-Knowledge".
*   **Chiffrement Côté Client (E2EE) :** Les documents sont chiffrés dans le navigateur de l'utilisateur via l'algorithme **AES-256-GCM** avant même d'être envoyés au serveur.
*   **Clés de Chiffrement :** Les clés sont dérivées localement et ne transitent jamais en clair. Même nos administrateurs système ne peuvent pas lire vos documents.
*   **Éditeur Riche :** Basé sur Tiptap, offrant une expérience fluide et moderne.

---

## 🛡️ Sécurité, Conformité et Loi 25

Sivara s'engage à respecter les normes les plus strictes en matière de protection des renseignements personnels, en conformité directe avec la **Loi 25 du Québec** (Loi modernisant des dispositions législatives en matière de protection des renseignements personnels).

### Conformité Loi 25
*   **Transparence & Consentement :** Nos processus d'onboarding (`src/pages/Onboarding.tsx`) requièrent un consentement explicite et éclairé avant toute collecte de données.
*   **Responsabilité :** Un Responsable de la Protection des Renseignements Personnels (RPRP) est désigné pour superviser la gouvernance des données.
*   **Droit à l'Effacement :** L'architecture de notre base de données permet la suppression complète et irréversible des données d'un utilisateur sur simple demande (Droit à l'oubli).
*   **Portabilité :** Les données sont structurées pour être exportables dans des formats standards.
*   **Notification d'Incidents :** Un protocole de détection d'intrusion est en place pour notifier la Commission d'accès à l'information et les utilisateurs concernés en cas de fuite (bien que notre architecture chiffrée rende les données volées inutilisables).

### Protocoles de Sécurité Avancés
1.  **Row Level Security (RLS) :** Chaque requête vers la base de données est filtrée au niveau du moteur SQL. Un utilisateur ne peut physiquement accéder qu'aux lignes qui lui appartiennent.
2.  **Isolation des Environnements :** Les environnements de production et de développement sont strictement cloisonnés.
3.  **Chiffrement au Repos et en Transit :** Toutes les communications se font via TLS 1.3. Les données sensibles sont chiffrées en base de données.

---

## 💻 Stack Technologique (Enterprise Grade)

Nous utilisons des technologies éprouvées pour assurer stabilité, performance et pérennité.

*   **Frontend :** React 18, TypeScript, Vite (Performance native et typage strict pour réduire les bugs).
*   **UI/UX :** Tailwind CSS, Radix UI, Shadcn/UI (Accessibilité WAI-ARIA native et Responsive Design).
*   **Backend as a Service :** Supabase (PostgreSQL, Auth, Storage, Edge Functions).
*   **Cryptographie :** Web Crypto API (Standard W3C pour les opérations cryptographiques natives dans le navigateur).

---

## 🚀 Pour les Investisseurs

Sivara représente une opportunité unique sur le marché de la "Privacy Tech" :

1.  **Scalabilité Horizontale :** L'architecture Serverless permet de supporter des millions d'utilisateurs sans refonte majeure de l'infrastructure.
2.  **Souveraineté :** Nous répondons à la demande croissante des entreprises et particuliers pour des solutions locales, conformes aux lois québécoises et canadiennes.
3.  **Propriété Intellectuelle :** Nos algorithmes d'indexation et notre implémentation de chiffrement client constituent une barrière à l'entrée technologique significative.

---

*Sivara Inc. - Reprenez le contrôle de votre vie numérique.*