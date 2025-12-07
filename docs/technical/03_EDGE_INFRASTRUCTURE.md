# VOLUME 3 : L'INFRASTRUCTURE EDGE (SERVERLESS)
**RUNTIME :** DENO (V8 ISOLATE)
**LOCALISATION :** GLOBAL EDGE NETWORK

---

## 1. LE MOTEUR DE RECHERCHE "TITANIUM" (`supabase/functions/search`)

Rechercher dans des données chiffrées est le Saint Graal de la cryptographie. Sivara utilise une approche pragmatique appelée **Indexation Aveugle (Blind Indexing)**.

### 1.1. Tokenisation NLP (Natural Language Processing)

L'Edge Function utilise la librairie `natural` pour décomposer le texte *avant* chiffrement/hachage.

1.  **Normalisation :** `TitaniumTokenizer.normalize`. Convertit en minuscules, supprime les accents (NFD normalization), élimine la ponctuation.
2.  **Stopwords :** Supprime les mots vides (le, la, de, pour) en Français et Anglais pour réduire le bruit.
3.  **Stemming (Racination) :** Utilise l'algorithme de Porter pour réduire les mots à leur racine.
    *   `manger`, `mangé`, `mangeons` -> `mang`.
    *   Cela permet de trouver un document contenant "mangé" si on cherche "manger".
4.  **Phonétique (Double Metaphone) :** Génère un code basé sur la sonorité.
    *   `Sivara` -> `SFR`.
    *   `Civara` -> `SFR`.
    *   Permet une tolérance aux fautes d'orthographe.

### 1.2. Hachage Cryptographique (HMAC)

Une fois les tokens générés (ex: `['mang', 'SFR', ...]`), ils ne sont pas stockés en clair.
Le serveur utilise une clé secrète `SEARCH_KEY` (distincte de la clé de chiffrement des données) pour générer un HMAC-SHA256 de chaque token.

*   `HMAC(SEARCH_KEY, "ST:mang")` -> `a94b8f...`
*   `HMAC(SEARCH_KEY, "PH:SFR")` -> `c3d2e1...`

Ces hashs sont stockés dans la colonne `blind_index` (Array of Text) de la base de données.

**Sécurité :**
*   Si la base est volée, l'attaquant voit une liste de hashs.
*   Il ne peut pas inverser les hashs (One-way function).
*   Il ne peut pas utiliser une attaque par fréquence (ex: le mot "le" est fréquent) car les stopwords sont retirés et les tokens sont salés par la clé HMAC.

### 1.3. Algorithme de Recherche (Retrieval)

Lorsqu'un utilisateur effectue une recherche :
1.  Il envoie sa requête ("manger pomme") à l'Edge Function.
2.  L'Edge Function applique la même Tokenisation + HMAC sur la requête.
3.  Elle génère les hashs cibles : `H(ST:mang)`, `H(EX:pomme)`, etc.
4.  Elle exécute une requête SQL utilisant l'opérateur d'overlap de tableau PostgreSQL (`&&`).
    ```sql
    SELECT * FROM crawled_pages WHERE blind_index && ARRAY['hash1', 'hash2']
    ```
5.  **Scoring :** Les résultats sont pondérés. Un match sur le token "Exact" vaut 100pts, sur la "Racine" 80pts, sur la "Phonétique" 50pts.
6.  **Déchiffrement :** Les résultats pertinents sont déchiffrés (AES) *en mémoire* dans l'Edge Function avant d'être renvoyés au client. Le client ne reçoit jamais de données chiffrées brutes pour la recherche publique.

---

## 2. L'ORACLE FINANCIER (DAAS) (`src/components/OraclePanel.tsx`)

Ce module transforme l'application de gestion de parc informatique en un outil FinTech de gestion de risque.

### 2.1. Modélisation Monte-Carlo

L'Oracle ne prédit pas l'avenir, il calcule des probabilités. Il exécute une simulation sur 24 mois pour chaque contrat de location.

**Variables d'Entrée :**
*   **Hardware Cost :** Coût d'achat de l'équipement.
*   **Monthly Price :** Revenu récurrent.
*   **TrustScore :** Score de fiabilité du client (dérivé de l'identité).

**Moteur de Simulation :**
Le hook `useMemo` génère 3 courbes de flux de trésorerie (Cashflow) :

1.  **Optimiste :**
    *   Hypothèse : Le client paie 100% des mensualités.
    *   La valeur résiduelle du matériel suit une courbe de dépréciation standard (2.5%/mois).
2.  **Probable (Pondérée par le Risque) :**
    *   Utilise un taux de rétention (`retentionRate`) calculé à partir du `TrustScore`.
    *   `ProbabilitéPaiement(Mois N) = TrustScore * (0.98 ^ N)`.
    *   Le cashflow espéré diminue chaque mois, reflétant le risque croissant de défaut avec le temps.
3.  **Pessimiste (VaR - Value at Risk) :**
    *   Simule un scénario de "Crash" (Défaut de paiement + Vol du matériel).
    *   Le mois du crash est déterminé par l'IA lors du KYC (si l'IA détecte des signaux faibles de fraude, le crash est simulé tôt, ex: Mois 3).

### 2.2. Indicateurs de Performance (KPIs)
*   **Break-Even Point (BEP) :** Le mois exact où le cumul des paiements + le dépôt initial couvre le coût du matériel.
*   **Point de Flip :** Le moment optimal pour proposer au client de changer de machine (renouvellement). C'est le point où `ValeurRésiduelle + CashAccumulé` est maximal par rapport à la courbe de dépréciation.

---

## 3. VÉRIFICATION D'IDENTITÉ BIOMÉTRIQUE (`supabase/functions/verify-identity`)

### 3.1. Ingestion Multimodale
L'Edge Function reçoit un payload JSON contenant :
*   `frontImage` / `backImage` : Base64 des photos de la pièce d'identité.
*   `fingerprint` : Empreinte numérique du navigateur.
*   `userId` : ID de l'utilisateur à vérifier.

### 3.2. Analyse Visuelle Cognitive (Gemini 1.5 Pro)
Nous n'utilisons pas d'OCR classique (Tesseract). Nous utilisons un LLM Multimodal.
Le prompt système est conçu pour l'analyse forensique :

> "You are a forensic document expert. Analyze this image. Detect if it's a screen photo (moiré pattern). Extract the Date of Birth and estimate the visual age of the person in the photo. Flag any inconsistency."

L'IA retourne un JSON structuré contenant les données extraites ET des indicateurs de fraude (`isScreen`, `isExpired`, `visualAgeMismatch`).

### 3.3. Algorithme de Validation NAM (Québec)
Pour les cartes RAMQ (Québec), le système effectue une validation mathématique croisée.
Le Numéro d'Assurance Maladie (NAM) est construit selon une logique stricte :
*   3 premières lettres du Nom.
*   1ère lettre du Prénom.
*   2 derniers chiffres de l'année de naissance.
*   Mois (+50 pour les femmes).
*   Jour.

**Le Code (`generateTheoreticalNAM`) :**
1.  Prend le Nom/Prénom/Date extraits par l'IA.
2.  Génère le NAM théorique attendu.
3.  Compare avec le NAM lu sur la carte (OCR).
4.  **Si Match :** Le document est mathématiquement cohérent -> TrustScore +60.
5.  **Si Mismatch :** Potentielle carte falsifiée ou erreur OCR -> Flag pour révision manuelle.

---

## 4. PASSERELLE DE PAIEMENT (`supabase/functions/stripe-api`)

### 4.1. Orchestration d'Abonnement Complexe
La location de matériel n'est pas un abonnement SaaS standard. C'est un contrat hybride.

**Logique de la fonction `create_device_checkout` :**
1.  **Calcul Fiscal :** Applique la taxe combinée TPS+TVQ (14.975%) sur le matériel.
2.  **Split Paiement :**
    *   **Dépôt (Upfront) :** Création d'un `InvoiceItem` ponctuel pour 20% du total TTC.
    *   **Financement (Recurring) :** Création d'une `Subscription` pour les 80% restants divisés par 16 mois.
3.  **Liaison Matérielle :** L'ID de l'unité (`unit_id`) est injecté dans les métadonnées Stripe. Cela permet au Webhook de savoir *quel* ordinateur débloquer dans l'inventaire une fois le paiement validé.
4.  **Auto-Termination :** L'abonnement est configuré avec `cancel_at` réglé à `Now + 16 months`. Le contrat s'arrête automatiquement à terme, évitant la surfacturation accidentelle.