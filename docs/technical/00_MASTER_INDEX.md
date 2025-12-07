# SIVARA : ARCHITECTURE REFERENCE (MASTER INDEX)
**CLASSIFICATION :** TOP SECRET / ENGINEERING ONLY
**VOLUME TOTAL :** 4 TOMES (INITIAL)
**DATE :** 2025

---

## INTRODUCTION
Ce référentiel contient l'analyse technique intégrale de l'écosystème Sivara. Il est conçu pour les ingénieurs principaux, les auditeurs de sécurité et les architectes système. Il ne contient aucune simplification.

## SOMMAIRE DES VOLUMES

### [VOLUME 1 : L'HYPERVISEUR FRONTEND](./01_HYPERVISOR_FRONTEND.md)
*   **Cible :** `src/App.tsx`, `src/main.tsx`, `vite.config.ts`
*   **Contenu :** Analyse du routeur polymorphe, gestion de la mémoire, hacks de session cross-domain, et optimisation du bundle React.

### [VOLUME 2 : LE NOYAU CRYPTOGRAPHIQUE](./02_CRYPTOGRAPHY_CORE.md)
*   **Cible :** `src/lib/encryption.ts`, `src/lib/sivara-vm.ts`
*   **Contenu :** Implémentation AES-GCM, dérivation de clés PBKDF2, protocole binaire SBP, vecteurs d'attaque et mitigation.

### [VOLUME 3 : INFRASTRUCTURE EDGE & SERVERLESS](./03_EDGE_INFRASTRUCTURE.md)
*   **Cible :** `supabase/functions/*`
*   **Contenu :** Moteur de recherche aveugle "Titanium", Oracle financier Monte-Carlo, Pipeline de vérification d'identité IA.

### [VOLUME 4 : GOUVERNANCE DES DONNÉES](./04_DATABASE_SCHEMA.md)
*   **Cible :** PostgreSQL, RLS Policies
*   **Contenu :** Schéma relationnel complet, triggers d'automatisation, politiques de sécurité Row-Level, stratégies d'indexation.

---
**MAINTENANCE DU DOCUMENT**
Toute modification du code source critique doit être reflétée dans ce corpus documentaire sous peine de révocation des accès git.