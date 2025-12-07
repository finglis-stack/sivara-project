# TOME 15 : PONT MOBILE & NATIF
**CIBLE :** `capacitor.config.ts`, `android/`, `ios/`

## 15.1. CONFIGURATION CAPACITOR

*   `webDir: 'dist'` : L'application est embarquée localement.
*   `server.url` : Désactivé en prod. L'app tourne en `file://`, ce qui garantit une vitesse native et un fonctionnement hors-ligne partiel.

## 15.2. PLUGINS NATIFS

*   **Camera :** Utilise l'interface native iOS/Android pour la capture d'identité (meilleure qualité que l'input HTML5).
*   **App :** Gère les événements de cycle de vie (Background/Foreground) pour verrouiller l'app (FaceID) si elle est inactive trop longtemps.

## 15.3. DEEP LINKING

Gestion des liens universels (`https://sivara.ca/...`) qui ouvrent l'application native directement au bon endroit, bypassant le navigateur.