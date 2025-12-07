# TOME 4 : SYSTÈME D'AUTHENTIFICATION
**CIBLE :** `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx`

## 4.1. GESTIONNAIRE D'ÉTAT (AUTHCONTEXT)

C'est le "Single Source of Truth" pour l'identité.

### 4.1.1. La Barrière `loading`
L'état `loading` est initialisé à `true`.
*   L'application affiche un `<Loader2 />` tant que la session n'est pas confirmée.
*   Cela empêche les fuites d'interface (voir des boutons "Admin" pendant 100ms avant d'être redirigé).

### 4.1.2. Stratégie de Cookies Globaux
Dans `supabase/client.ts`, le cookie est défini avec `domain: .sivara.ca`.
*   Le point `.` est crucial. Il permet au cookie d'être lu par `docs.`, `mail.`, `account.`.
*   Si ce paramètre est mal configuré, l'utilisateur doit se reconnecter à chaque changement d'application.

## 4.2. DÉCONNEXION AGRESSIVE ("SCORCHED EARTH")

La fonction `signOut` dans `AuthContext` ne fait pas confiance au serveur.
1.  Appel `supabase.auth.signOut()` (Révocation serveur).
2.  **Destruction Locale :** `document.cookie = 'sivara-auth-token=; expires=Thu, 01 Jan 1970...'`.
3.  **Reset Mémoire :** `setUser(null)`.
*   Cela garantit que même si le réseau est coupé, l'utilisateur est déconnecté localement et ne peut plus accéder aux données chiffrées en cache.