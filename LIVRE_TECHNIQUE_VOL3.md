# SIVARA : ENCYCLOPÉDIE TECHNIQUE DU CODE SOURCE
## VOLUME 3 : UX MICRO-SCOPIQUE, DONNÉES ET SYSTÈMES CRITIQUES

**Entité :** SIVARA CANADA INC.
**Système :** ECOSYSTEM V1
**Classification :** DOCUMENTATION CRITIQUE (NIVEAU GRANULAIRE)
**Date :** 2024

---

# SOMMAIRE GÉNÉRAL DU VOLUME 3

**SECTION 17 : ANATOMIE DU DESIGN SYSTEM (ATOMIC UI)**
   17.1. La Palette Sémantique (`tailwind.config.ts`)
   17.2. Typographie et Hiérarchie Visuelle
   17.3. Bibliothèque de Composants Interactifs
      17.3.1. Le Bouton "Action" (États, Loading, Feedback)
      17.3.2. Les Cartes "Glassmorphism" et Bordures
      17.3.3. Les Inputs et Formulaires (Validation Visuelle)

**SECTION 18 : DISSECTION DES INTERFACES CRITIQUES**
   18.1. La Console de Supervision (`Monitor.tsx`)
      18.1.1. Architecture du "Live Feed" (Auto-Scroll)
      18.1.2. Système de Badges d'État (Codes Couleur)
      18.1.3. Le "Watchdog" Frontend (Logique d'Auto-Kick)
   18.2. L'Interface Mail (`MailInbox.tsx`)
      18.2.1. Mise en page Responsive (Sidebar Glissante)
      18.2.2. Micro-interactions de Liste (Hover Actions)
   18.3. Le Dashboard Profil (`Profile.tsx`)
      18.3.1. Bannière Dynamique "Pro vs Free"
      18.3.2. Grille de Navigation "App Launcher"

**SECTION 19 : RÉFÉRENCE COMPLÈTE DU SCHÉMA DE DONNÉES**
   19.1. Diagramme Entité-Relation (ERD) Textuel
   19.2. Dictionnaire des Tables Critiques
      19.2.1. `profiles` (Le Pivot Central)
      19.2.2. `device_units` (Inventaire et États)
      19.2.3. `crawled_pages` (Vecteurs et Recherche)
      19.2.4. `identity_verifications` (Données Sensibles)
   19.3. Triggers et Automatisation SQL

**SECTION 20 : GESTION DES ERREURS ET FEEDBACK UTILISATEUR**
   20.1. Le Système de "Toast" (`sonner`)
   20.2. Écrans de Chargement et Skeleton Screens
   20.3. Pages d'Erreur (404 et Barrières de Sécurité)

---

# DÉTAILS TECHNIQUES ET ANALYSE DE CODE

## 17. ANATOMIE DU DESIGN SYSTEM (ATOMIC UI)

Sivara ne se contente pas d'utiliser des composants par défaut. Chaque élément est une décision d'ingénierie visuelle codée en dur.

### 17.1. La Palette Sémantique

Le fichier `tailwind.config.ts` ne définit pas seulement des couleurs, mais des *intentions*. L'application utilise une approche **Noir & Blanc (Monochrome)** rehaussée par des accents fonctionnels.

*   **L'Obsidienne (`bg-black`, `text-white`) :** Utilisé exclusivement pour les actions primaires "Critiques" ou "Premium".
    *   *Exemple :* Le bouton "Payer" dans `Checkout.tsx` ou "Générer le fichier" dans `DocEditor.tsx`. Cela crée un point focal inratable.
*   **Le Gris Fonctionnel (`slate-50` à `slate-900`) :**
    *   `bg-gray-50` : Utilisé pour les fonds de page et les sidebars (`HelpAdmin.tsx`, `MailInbox.tsx`) pour différencier le "contenu" (blanc pur) du "conteneur" (gris très pâle).
    *   `border-gray-200` : La limite subtile. Utilisée sur toutes les `Card` pour définir la structure sans alourdir l'œil.
*   **Le Bleu Système (`blue-600`) :** La couleur de l'interaction active et de la sélection.
    *   Utilisé dans `DocEditor.tsx` pour les icônes de fichiers, les boutons de partage, et les anneaux de focus (`ring-blue-500`).
*   **Le Code Sémaphore (États du système) :**
    *   **Vert (`green-500`/`bg-green-50`) :** Succès, Validation, Connexion sécurisée (`IdentityVerification.tsx`, Badge "Vérifié").
    *   **Rouge (`red-500`/`bg-red-50`) :** Erreur, Danger, Suppression, Annulation (`Monitor.tsx` état "Failed").
    *   **Orange (`amber-500`) :** Attention, En attente, État "Pending" ou "Trial".

### 17.3. Bibliothèque de Composants Interactifs

**17.3.1. Le Bouton "Action" (`src/components/ui/button.tsx`)**
Ce n'est pas une simple balise `<button>`. C'est un composant polymorphe géré par `class-variance-authority`.
*   **Micro-interaction "Scale" :** Sur la plupart des boutons d'action (ex: Landing Pages), la classe `active:scale-95` est appliquée. Au clic, le bouton rétrécit de 5% pour donner une sensation tactile de "pression".
*   **État de Chargement :** Lorsqu'une action async est en cours (ex: `isSaving` dans `Profile.tsx`), le bouton remplace son icône par `<Loader2 className="animate-spin" />`. L'utilisateur sait immédiatement que le système travaille.

**17.3.2. Les Cartes "Glassmorphism"**
Dans `MobileLanding.tsx` ou `Pricing.tsx`, les cartes utilisent des classes Tailwind spécifiques pour créer de la profondeur :
*   `backdrop-blur-md` : Floute l'arrière-plan.
*   `bg-white/80` (ou `/10` sur fond sombre) : Transparence alpha.
*   `shadow-sm` à `shadow-2xl` : Élévation dynamique au survol (`group-hover:shadow-xl`).

---

## 18. DISSECTION DES INTERFACES CRITIQUES

### 18.1. La Console de Supervision (`Monitor.tsx`)

C'est le cockpit du moteur de recherche. Il doit afficher beaucoup d'informations en temps réel sans saturer le navigateur.

**18.1.1. Architecture du "Live Feed"**
*   **Structure :** Une mise en page "Split View". À gauche la liste des tâches (Queue), à droite les détails (Logs).
*   **Composant `ScrollArea` :** Encapsule la liste des logs.
*   **L'Astuce du `logsEndRef` :**
    ```typescript
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    ```
    À chaque fois qu'un nouveau log arrive via WebSocket (Supabase Realtime), cet effet force le défilement vers le bas. Le `setTimeout` de 50ms laisse le temps au DOM de se mettre à jour avant de scroller.

**18.1.2. Système de Badges (Fonction `getLogBadge`)**
Pour rendre les logs lisibles, chaque étape du processus de crawl a sa propre couleur calculée dynamiquement :
*   `INIT` : Gris (Neutre).
*   `FETCH_DIRECT` : Bleu (Action réseau standard).
*   `FETCH_PROXY` : Orange (Action réseau complexe/coûteuse).
*   `AI_ANALYSIS` : Violet (Coût CPU/GPU élevé).
*   `ERROR` : Rouge (Critique).
Cela permet à l'opérateur de scanner visuellement la santé du système en une fraction de seconde.

**18.1.3. Le "Watchdog" Frontend**
Un `useEffect` tourne toutes les 5 secondes (`setInterval`).
*   Il compte les tâches en attente (`pending`).
*   Il compte les tâches en cours (`processing`).
*   **Logique de survie :** Si `pending > 0` et `processing === 0`, le Frontend déduit que le Backend est "bloqué" ou endormi. Il envoie alors une requête HTTP forcée (`triggerProcessQueue`) à l'Edge Function pour "réveiller" le worker. C'est un mécanisme d'auto-guérison initié par le client.

### 18.2. L'Interface Mail (`MailInbox.tsx`)

**18.2.1. Mise en page Responsive**
L'interface Mail imite une application native iOS/macOS.
*   **Sidebar Glissante :** Sur mobile, la sidebar a la classe `absolute h-full z-10`.
*   **État `isSidebarOpen` :**
    *   Si `true` : `translate-x-0` (Visible).
    *   Si `false` : `-translate-x-full` (Cachée à gauche).
*   **Transition CSS :** `transition-all duration-300` rend l'animation fluide.

**18.2.2. Micro-interactions de Liste**
Chaque ligne d'email (`div` avec `key={email.id}`) est un `group`.
*   Les boutons d'action (Archive, Delete) ont la classe `opacity-0 group-hover:opacity-100`.
*   **Résultat :** L'interface est épurée par défaut. Les outils n'apparaissent que lorsque l'utilisateur survole un email spécifique, réduisant la charge cognitive.

### 18.3. Le Dashboard Profil (`Profile.tsx`)

**18.3.1. Bannière Dynamique "Pro vs Free"**
Le code rend conditionnellement deux interfaces radicalement différentes selon `profile.is_pro`.
*   **Mode Free :** Affiche une bannière promotionnelle (`background-image: url(/pro-banner.jpg)`) avec un appel à l'action clair. C'est du "Growth Hacking" intégré à l'UI.
*   **Mode Pro :** Affiche une carte sobre, blanche, avec un badge vert "Actif" et les dates de renouvellement. Le bouton change de "Voir les offres" à "Gérer mon abonnement" (lien vers le portail Stripe).

**18.3.2. Grille de Navigation "App Launcher"**
Cette section utilise `Grid3x3` pour afficher les icônes des applications (Mail, Docs, Moteur).
*   Chaque bouton est un lien qui utilise la fonction intelligente `navigateToApp`.
*   Sur Mobile (Capacitor), cette fonction utilise le router React (`navigate`).
*   Sur Web, elle force une redirection `window.location.href` vers le sous-domaine approprié (`docs.sivara.ca`), gérant ainsi le saut entre les applications isolées.

---

# 19. RÉFÉRENCE COMPLÈTE DU SCHÉMA DE DONNÉES

Le système repose sur PostgreSQL. Voici la définition exacte des structures de données manipulées par le code.

### 19.2. Dictionnaire des Tables Critiques

**19.2.1. `profiles` (Le Pivot Central)**
Stocke les données métier liées à un utilisateur Auth.
*   `id` (UUID, PK) : Lien direct vers `auth.users(id)`.
*   `first_name`, `last_name` (Text) : Identité civile.
*   `is_pro` (Boolean) : Flag maître contrôlant l'accès aux fonctionnalités Premium.
*   `stripe_customer_id` (Text) : Lien vers la plateforme de paiement.
*   `avatar_url` (Text) : URL publique du fichier dans Supabase Storage.

**19.2.2. `device_units` (Inventaire Matériel)**
Gère le parc informatique physique.
*   `id` (UUID) : Identifiant unique de l'unité.
*   `serial_number` (Text) : Numéro de série (ex: "SIV-24-XK9L").
*   `status` (Enum) : 'available', 'reserved', 'sold', 'maintenance'.
    *   *Logique :* Le code `DeviceLanding.tsx` ne montre que les 'available'. Le checkout passe en 'reserved'. Le webhook Stripe passe en 'sold'.
*   `specific_specs` (JSONB) : Stocke la RAM, le SSD, et les features (`touch`, `wifi`) sans schéma rigide, permettant de varier les modèles.
*   `sold_to_user_id` (UUID, FK) : Lien vers l'acheteur.

**19.2.3. `crawled_pages` (Le Cerveau du Moteur)**
*   `id` (UUID).
*   `url`, `title`, `description`, `content` (Text) : **Contenu Chiffré** (Illisible sans clé).
*   `blind_index` (Array of Text) : **Vecteur de Recherche**. Contient les tokens HMAC (`a8f9...`, `b2c3...`). C'est sur cette colonne que l'opérateur `&&` est utilisé pour la recherche.
*   `search_hash` (Text) : Hash SHA-256 de l'URL pour dédoublonnage rapide (Unicité).

**19.2.4. `identity_verifications` (Données Sensibles)**
*   `status` (Enum) : 'processing', 'approved', 'rejected'.
*   `risk_score` (Int) : 0 à 100. Calculé par l'Edge Function.
*   `verification_metadata` (JSONB) : Contient les logs bruts de l'IA ("Visual Age mismatch", "Screen detected"). *Note :* Ces données ne sont jamais montrées à l'utilisateur pour ne pas révéler les méthodes de détection.

### 19.3. Triggers et Automatisation SQL

Bien que non visibles dans le code React, l'application dépend de triggers pour son intégrité.
*   **`handle_new_user` :** Déclenché `AFTER INSERT ON auth.users`. Crée automatiquement une ligne dans `public.profiles`. Sans cela, le `Onboarding.tsx` échouerait s'il y a une latence réseau.
*   **`update_content_vector` :** Met à jour le `tsvector` (pour la recherche full-text admin) quand une page est modifiée.

---

# 20. GESTION DES ERREURS ET FEEDBACK UTILISATEUR

### 20.1. Le Système de "Toast" (`sonner`)

L'application utilise la librairie `sonner` encapsulée dans `src/utils/toast.ts`.
*   **Pourquoi une encapsulation ?** Pour pouvoir changer de librairie d'affichage (ex: passer de `react-hot-toast` à `sonner`) en ne modifiant qu'un seul fichier, sans toucher aux centaines d'appels `showSuccess()` dans les pages.
*   **Design :** Les toasts apparaissent en bas à droite, empilés, avec un fond noir (succès) ou rouge (erreur) pour un contraste maximal.

### 20.2. Écrans de Chargement

L'application combat le "Blank Screen of Death".
*   **État Global `loading` (AuthContext) :** Tant que Supabase n'a pas répondu, l'app affiche un loader plein écran centré.
*   **États Locaux `isLoading` :** Dans `Monitor.tsx` ou `DocEditor.tsx`, les zones de contenu (tableaux, éditeur) sont remplacées par des squelettes ou des spinners (`Loader2`) pendant le fetch de données, mais le header reste visible pour garder le contexte.

### 20.3. Pages d'Erreur (404)

Le fichier `NotFound.tsx` n'est pas une page statique.
*   Il logue l'erreur : `console.error("404 Error: User attempted...")`.
*   Il fournit un bouton "Retour" intelligent qui tente de ramener l'utilisateur à la racine de l'application courante (ex: `/` pour Docs, `/admin` pour Help), évitant de le perdre dans une boucle de navigation.

---

**FIN DU VOLUME 3**
*Cette documentation couvre désormais l'intégralité du code source fourni, de l'architecture serveur aux micro-interactions frontend.*