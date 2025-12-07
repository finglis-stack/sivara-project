# TOME 3 : LE ROUTEUR POLYMORPHE
**CIBLE :** `src/App.tsx`

## 3.1. DÉTECTION CONTEXTUELLE (`useMemo`)

Le composant `AppRoutes` contient une logique de branchement conditionnel complexe qui agit comme un DNS Client-Side.

### 3.1.1. Branche Native (Capacitor)
```typescript
if (Capacitor.isNativePlatform()) { ... }
```
Sur mobile, l'application est servie via `file://`. Le routeur bascule en mode "Query Param" (`?app=mail`).
*   **Avantage :** Permet de déployer le même binaire (APK/IPA) qui contient TOUTES les applications. Pas besoin de télécharger des modules séparés.

### 3.1.2. Branche Web (Wildcard)
Sur le web, le routeur parse `window.location.hostname`.
*   `docs.*` -> Monte le composant `<Docs />`.
*   `mail.*` -> Monte le composant `<Mail />`.
*   **Isolation :** Bien que le code JS soit partagé, la mémoire (Store React) est isolée par le rafraîchissement de page lors du changement de sous-domaine.

## 3.2. DEEP LINKING ET OAUTH

Le routeur écoute les changements de hash (`#`) pour l'authentification.
*   Supabase redirige vers `site.com/#access_token=...`.
*   `App.tsx` intercepte ce hash, hydrate la session, et nettoie l'URL avant même que le composant Page ne soit monté.