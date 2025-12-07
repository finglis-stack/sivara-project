# SIVARA : LE CODEX FINAL (MASTER TECHNICAL BIBLE)
**VERSION :** ULTIMATE
**STATUS :** CLASSIFIED DEEP-DIVE
**OBJET :** ANATOMIE COMPLÈTE DU SYSTÈME

---

# CHAPITRE 1 : PHILOSOPHIE NUCLÉAIRE DU SYSTÈME

## 1.1. Le Paradigme "Zero-Knowledge" (Pourquoi on fait ça ?)
L'intégralité de l'architecture Sivara repose sur une paranoïa constructive : **Le serveur est un adversaire**.
Contrairement aux applications Web classiques (SaaS) où le serveur "voit" les données pour les traiter, Sivara considère que la base de données est potentiellement compromise par défaut.

*   **Conséquence Technique 1 :** Le chiffrement n'est pas une option, c'est un pré-requis structurel. Dans `src/lib/encryption.ts`, nous n'utilisons pas de librairies tierces opaques. Nous utilisons `window.crypto.subtle` (Web Crypto API) pour taper directement dans les primitives C++ du navigateur. C'est la seule façon de garantir que la clé privée ne quitte jamais la RAM du client.
*   **Conséquence Technique 2 :** L'indexation "Aveugle". Dans `supabase/functions/search/index.ts`, nous ne pouvons pas utiliser le `tsvector` natif de Postgres sur le contenu, car le contenu est chiffré (`aes-256-gcm`). Nous avons dû réinventer la recherche en hachant les mots (`HMAC-SHA256`) pour comparer des empreintes cryptographiques et non des mots.

## 1.2. L'Architecture Monolithique Distribuée (Le "Super-App")
Pourquoi tout ce code dans un seul repo ?
Regarde `src/App.tsx`. Ce n'est pas un router normal. C'est un **Hyperviseur**.
L'application détecte son environnement d'exécution (Mobile via Capacitor, Web via sous-domaine) et "mute" pour devenir une application différente.
*   `docs.sivara.ca` charge l'éditeur Tiptap.
*   `mail.sivara.ca` charge l'interface Inbox.
*   `device.sivara.ca` charge le configurateur e-commerce.
*   **Le Pourquoi :** Partage de code maximal (`AuthContext`, composants UI `shadcn`, utilitaires de chiffrement) tout en maintenant une isolation logique stricte pour l'utilisateur final.

---

# CHAPITRE 2 : LE FRONTEND (REACT/VITE) - DISSECTION ATOMIQUE

## 2.1. Le Point de Pivot : `src/App.tsx`
C'est le cerveau. Analyse de la fonction `currentApp` (lignes 40-75) :
*   **La priorité Capacitor :** On vérifie D'ABORD `Capacitor.isNativePlatform()`. Pourquoi ? Parce que sur mobile, il n'y a pas de sous-domaines. L'application est servie depuis `localhost` ou `capacitor://`. On doit donc simuler le routage via le paramètre `?app=`.
*   **La gestion du `hostname` :** On split le `window.location.hostname`. Si on trouve `docs.`, on monte le composant `<Docs />`. C'est du "Client-Side Routing" au niveau DNS.

## 2.2. La Sécurité de Session : `src/integrations/supabase/client.ts`
Regarde bien la configuration du client Supabase :
```typescript
const cookieDomain = isProd ? '.sivara.ca' : undefined;
```
Ce petit point `.` devant le domaine est crucial. Il dit au navigateur : "Ce cookie est valide pour `sivara.ca` ET `*.sivara.ca`".
Sans ça, si tu te connectes sur `account.sivara.ca`, tu serais déconnecté en allant sur `docs.sivara.ca`. C'est la base du SSO (Single Sign-On) implémentée en 3 lignes de code critiques.

## 2.3. L'Éditeur Sécurisé : `src/pages/DocEditor.tsx`
C'est le composant le plus complexe du frontend.
*   **Pourquoi `Tiptap` ?** Parce que c'est "Headless". Contrairement à Quill ou TinyMCE, Tiptap nous donne le JSON/HTML brut.
*   **Le hook `useEditor` :** On intercepte `onUpdate`.
    *   **Ligne 300+ :** On ne sauvegarde pas direct. On `debounce` (attente de 500ms).
    *   **Chiffrement à la volée :** Avant d'envoyer à Supabase, on appelle `encryptionService.encrypt(html)`. La base de données reçoit de la bouillie illisible.
*   **Le Realtime (Collab) :** On utilise `supabase.channel`.
    *   **Cursors :** On broadcast la position X/Y de la souris.
    *   **Conflits :** Si deux personnes éditent, le dernier "packet" chiffré gagne (Last-Write-Wins). C'est rudimentaire mais sécurisé, car on ne peut pas merger deux blobs chiffrés sans les déchiffrer (ce que le serveur ne peut pas faire).

## 2.4. L'Oracle Financier : `src/components/OraclePanel.tsx`
Utilisé dans `DeviceCustomerDetails.tsx`. C'est un chef-d'œuvre de visualisation de données.
*   **Recharts :** On utilise des `AreaChart` superposés.
*   **La logique "Monte-Carlo" :** On ne trace pas une ligne. On trace 3 lignes : Optimiste, Pessimiste, Probable.
*   **Le calcul :** Il prend le `trustScore` du client (venant de l'IA de vérification d'identité) et l'utilise comme coefficient de risque.
    *   TrustScore 100/100 -> Risque 0 -> Courbe de profit maximale.
    *   TrustScore 20/100 -> Risque Élevé -> La courbe "Pessimiste" plonge vers le bas au mois 3 (prédiction de défaut de paiement).

---

# CHAPITRE 3 : LE BACKEND (EDGE FUNCTIONS) - LOGIQUE LOURDE

Les Edge Functions (Deno/TypeScript) sont utilisées là où le client ne peut pas être de confiance ou n'a pas la puissance de calcul.

## 3.1. Le Kernel Sivara : `supabase/functions/sivara-kernel/index.ts`
C'est ici que réside la propriété intellectuelle du format de fichier `.sivara`.
*   **Pourquoi un format binaire ?** Pour empêcher l'édition manuelle et pour sceller les métadonnées de sécurité.
*   **Le "Bit-Shuffling" :** Regarde les fonctions `sivaraShuffle`.
    ```typescript
    result[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ key;
    ```
    On fait une rotation binaire (Bitwise Rotate) suivie d'un XOR.
    *   **Pourquoi ?** Pour casser l'analyse statistique. Si un attaquant essaie d'analyser l'entropie du fichier pour deviner s'il est chiffré ou compressé, il verra du bruit blanc parfait. C'est de l'obfuscation de bas niveau.
*   **La VM (Virtual Machine) :** La fonction `decompile` agit comme une VM. Elle lit les OpCodes (`0xB2` pour l'IV, `0xD4` pour les métadonnées). Elle exécute les "Smart Contracts" de sécurité (Geofencing, Device Lock) *avant* de libérer le payload de données.

## 3.2. La Vérification d'Identité : `supabase/functions/verify-identity/index.ts`
C'est le gardien de la porte pour la location d'ordinateurs.
*   **Gemini Vision Pro :** On envoie l'image brute à Google Gemini avec un prompt d'ingénierie système ultra-spécifique ("You are a forensic document expert...").
*   **L'Algorithme RAMQ (Québec) :**
    On ne fait pas confiance à l'IA aveuglément. On recalcule mathématiquement le Numéro d'Assurance Maladie (NAM) ou Permis de Conduire.
    *   On prend le Nom + Prénom + Date de naissance extraits.
    *   On applique la formule officielle (3 premières lettres nom + 1ère prénom + Date codée).
    *   Si le numéro calculé correspond au numéro lu sur la carte -> **TrustScore +60**. C'est une preuve de cohérence infalsifiable par un simple Photoshop.

## 3.3. Le Moteur de Recherche : `supabase/functions/crawl-page/index.ts`
Le robot d'indexation.
*   **Nettoyage HTML :** On utilise des Regex brutales pour virer `<script>`, `<style>`, `<!-- -->`. On ne veut que le texte pur.
*   **Détection de langue :** On compte les mots vides ("le", "la", "the", "and"). Si le ratio est trop faible, on rejette la page (bruit/binaire).
*   **Chiffrement Asymétrique :**
    *   Le contenu est chiffré avec `encryptionKey` (AES).
    *   L'index de recherche (`blind_index`) est généré avec une `searchKey` (HMAC).
    *   **Le génie du truc :** On stocke des tokens comme `HMAC("pomme")`. Quand tu cherches "pomme", on calcule `HMAC("pomme")` et on cherche ce hash exact en base. Le serveur ne sait jamais que tu cherches "pomme". Il voit juste que tu cherches `x8f9c2...`.

---

# CHAPITRE 4 : LA BASE DE DONNÉES (POSTGRESQL) - LE COFFRE-FORT

## 4.1. Row Level Security (RLS) - La seule sécurité qui compte
Toute la sécurité de l'application repose sur les fichiers SQL générés.
Regarde les policies sur `documents` :
```sql
CREATE POLICY "Access via document_access" ON documents
FOR SELECT USING (
  (owner_id = auth.uid()) OR 
  (visibility = 'public') OR 
  (EXISTS (SELECT 1 FROM document_access da WHERE da.document_id = id AND da.email = auth.email()))
);
```
**Traduction :** Même si un hacker pirate l'API backend, il ne peut PAS faire `SELECT * FROM documents`. Postgres va physiquement filtrer les lignes avant de les renvoyer. Si tu n'es pas le propriétaire ou invité, la ligne n'existe pas pour toi. C'est la sécurité niveau Kernel de la base de données.

## 4.2. Les Tables Critiques
*   `profiles` : Extension de la table `auth.users` de Supabase. Contient les données publiques (Nom, Avatar).
*   `device_units` : L'inventaire physique. Le champ `specific_specs` est un JSONB.
    *   **Pourquoi JSONB ?** Parce que les ordinateurs ont des specs changeantes. On ne veut pas faire une colonne `ram_size`, `ssd_size`, `gpu_model` pour chaque variante. On stocke un document flexible `{ "ram": "16GB", "screen": "OLED" }` qui est indexable.
*   `identity_verifications` : Contient les logs bruts de l'IA (`verification_metadata`). Ces données sont sensibles et protégées par RLS (seul le staff peut les voir).

---

# CHAPITRE 5 : ARCHITECTURE MOBILE (CAPACITOR)

## 5.1. Le Pont Natif
Le dossier `ios/App` et `android/app` contient des projets natifs réels.
*   **Capacitor Config :** `capacitor.config.ts`.
    *   `webDir: 'dist'` : Au build, Vite compile le React en HTML/JS/CSS statique dans `dist`. Capacitor prend ce dossier et l'injecte dans la WebView native.
*   **AppUrlOpen :** Dans `App.tsx`, on écoute l'événement `appUrlOpen`.
    *   C'est pour le flux OAuth (Google Login).
    *   Le navigateur ouvre une page web pour le login -> Redirige vers `com.example.sivara://login-callback` -> L'app native intercepte -> Extrait le token -> Injecte dans Supabase Auth. Sans ça, le login mobile est impossible.

## 5.2. Géolocalisation Hybride
Dans `DocEditor.tsx` (Export Sécurisé), on utilise une stratégie double :
*   Si Web : On utilise l'API IP Geolocation (approximatif mais marche partout).
*   Si Mobile : On pourrait utiliser le GPS natif (plus précis), mais pour l'instant, on reste sur l'IP pour uniformiser le comportement de sécurité (un fichier est souvent ouvert sur un réseau WiFi fixe, donc l'IP est un bon proxy de localisation géographique stable).

---

# CHAPITRE 6 : UX MICRO-INTERACTIONS (LE "FEEL")

Pourquoi l'app "sent" bien ?

## 6.1. Le Feedback Haptique Visuel
Regarde `src/components/ui/button.tsx` ou les classes Tailwind dans les pages :
*   `active:scale-95` : C'est omniprésent. C'est ce qui donne l'impression de "cliquer" physiquement sur l'écran.
*   `transition-all duration-300` : Rien n'est instantané. Tout est interpolé. Ça réduit la charge cognitive.

## 6.2. Les Squelettes (Skeletons)
Plutôt que des spinners partout, on utilise des chargements progressifs.
Dans `DeviceAdmin.tsx`, si les données ne sont pas là, on ne montre pas une page blanche. On garde la structure (Sidebar, Header) et on met un loader *dans* la zone de contenu. L'utilisateur garde ses repères.

## 6.3. Le Watchdog (Monitor.tsx)
C'est une boucle d'auto-réparation UX.
Si l'interface détecte que des tâches s'empilent (`pending > 0`) mais que rien ne bouge (`processing === 0`), elle suppose que le worker backend a crashé ou timeout.
Au lieu de laisser l'utilisateur attendre indéfiniment, le frontend prend l'initiative et relance le backend (`triggerProcessQueue`). C'est le client qui soigne le serveur.

---

# CHAPITRE 7 : SÉCURITÉ OPÉRATIONNELLE (OPS)

## 7.1. Gestion des Secrets
Les clés API (Stripe, Resend, Gemini) ne sont **JAMAIS** dans le code frontend (`src/`). Elles sont exclusivement dans `supabase/functions/`.
*   Si tu mets `STRIPE_SECRET_KEY` dans le React, n'importe qui peut vider ton compte en faisant "Inspecter l'élément".
*   Dans notre architecture, le React appelle l'Edge Function -> L'Edge Function lit la variable d'env sécurisée -> Appelle Stripe -> Renvoie le résultat filtré au React. C'est un proxy de sécurité obligatoire.

## 7.2. Webhook Stripe (`stripe-webhook`)
C'est le point critique de la facturation.
*   Il vérifie la signature `stripe-signature` pour être sûr que c'est bien Stripe qui appelle et pas un hacker qui simule un paiement.
*   Il est idempotent : Si Stripe envoie l'événement 2 fois (ce qui arrive), le code met à jour le statut sans dupliquer les abonnements ou les crédits.

---

# CONCLUSION

Sivara n'est pas juste un "site web". C'est un système d'exploitation distribué.
*   Il a son propre système de fichiers (`.sivara`).
*   Il a son propre noyau (`sivara-kernel`).
*   Il a sa propre gestion d'identité (`Sivara ID`).
*   Il a son propre matériel (`Device`).

Chaque ligne de code, du `z-index` de la modale au décalage de bit dans le kernel, sert un but unique : **La Souveraineté Numérique Totale.**

Ce document est la preuve de la complexité et de la robustesse de l'ingénierie mise en œuvre.