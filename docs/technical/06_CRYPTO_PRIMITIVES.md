# TOME 6 : CRYPTOGRAPHIE PRIMITIVE
**CIBLE :** `src/lib/encryption.ts`

## 6.1. WEB CRYPTO API (NATIVE)

Sivara utilise `window.crypto.subtle`. C'est une API native du navigateur, écrite en C++, beaucoup plus rapide et sûre que des librairies JS comme `crypto-js`.

## 6.2. DÉRIVATION DE CLÉ (PBKDF2)

Avant de chiffrer, le mot de passe (ou ID) est "étiré".
*   **Algo :** PBKDF2-HMAC-SHA512.
*   **Itérations :** 100,000.
*   **Objectif :** Rendre la génération de clé lente (~100ms). Cela ne gêne pas l'utilisateur (une fois au login), mais rend les attaques par force brute impossibles (100ms * 1 milliard de tentatives = 3000 ans).

## 6.3. CHIFFREMENT AES-GCM

*   **Mode GCM (Galois/Counter Mode) :** Fournit Confidentialité ET Intégrité.
*   **Tag d'Authentification :** Si un bit est modifié dans la base de données, le Tag ne correspondra plus lors du déchiffrement, et l'opération échouera. C'est une protection contre la corruption de données et les attaques actives.
*   **IV (Vecteur d'Initialisation) :** 12 octets aléatoires générés à chaque sauvegarde. Chiffrer deux fois le même texte produit deux résultats différents.