# TOME 8 : MOTEUR DE RECHERCHE "TITANIUM"
**CIBLE :** `supabase/functions/search/index.ts`, `supabase/functions/crawl-page/index.ts`

## 8.1. INDEXATION AVEUGLE (BLIND INDEXING)

Le serveur ne peut pas lire le contenu, mais doit pouvoir chercher dedans.
*   **Tokenisation :** Le texte est découpé en mots, racinisé (Stemming) et phonétisé.
*   **Hachage :** Chaque token est haché avec une clé secrète serveur (`HMAC-SHA256`).
    *   `pomme` -> `h(pomme)`.
*   **Stockage :** La DB stocke un tableau de hashs `['abc...', 'xyz...']`.

## 8.2. RECHERCHE (RETRIEVAL)

1.  L'utilisateur tape "pomme".
2.  Le client envoie "pomme".
3.  Le serveur calcule `h(pomme)`.
4.  Le serveur fait une requête SQL `&&` (Overlap) sur la colonne `blind_index`.
5.  Le serveur trouve les documents, mais ne peut toujours pas les lire.
6.  Il déchiffre (AES) *uniquement* le titre et l'URL en mémoire volatile avant de renvoyer le résultat JSON.

## 8.3. SCORING HYBRIDE

Le ranking combine :
*   **Score Lexical :** Nombre de matchs de hashs.
*   **Score Sémantique (Limité) :** Pondération selon le type de token (Exact > Phonétique).
*   **Boost Métier :** Les domaines "officiels" ou vérifiés ont un multiplicateur de score.