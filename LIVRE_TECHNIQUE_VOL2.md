# SIVARA : ENCYCLOPÉDIE TECHNIQUE DU CODE SOURCE
## VOLUME 2 : INGÉNIERIE FRONTEND, INTERFACES COMPLEXES ET MOBILE

**Entité :** SIVARA CANADA INC.
**Système :** ECOSYSTEM V1
**Classification :** DOCUMENTATION CRITIQUE
**Date :** 2024

---

# SOMMAIRE GÉNÉRAL DU VOLUME 2

**SECTION 11 : INGÉNIERIE FRONTEND AVANCÉE (REACT)**
   11.1. Architecture des Composants UI (Shadcn/Radix)
   11.2. Système de Design et Thématisation (`globals.css`)
      11.2.1. Variables CSS et Mode Sombre
      11.2.2. Moteur d'Animation (`tailwind.config.ts`)
   11.3. Hooks Personnalisés Critiques
      11.3.1. `use-mobile.tsx` : Détection de Viewport
      11.3.2. `use-toast.ts` : Gestionnaire de Notifications

**SECTION 12 : MODULE SIVARA HELP (ADMINISTRATION & CMS)**
   12.1. Architecture du Dashboard Admin (`HelpAdmin.tsx`)
      12.1.1. Gestion d'État Hybride (Support vs Content)
      12.1.2. Synchronisation Temps Réel (Supabase Channels)
   12.2. Système de Gestion de Contenu (CMS)
      12.2.1. Implémentation Drag & Drop (`dnd-kit`)
      12.2.2. Algorithme de Réorganisation (Array Move)
   12.3. Interface de Chat Support
      12.3.1. Injection Optimiste des Messages
      12.3.2. Rendu HTML Sécurisé (`dangerouslySetInnerHTML`)

**SECTION 13 : MODULE SIVARA DEVICE (LOGIQUE CLIENT)**
   13.1. Configurateur de Matériel (`DeviceLanding.tsx`)
      13.1.1. Algorithme de Sélection "Smart Diversity"
      13.1.2. Filtrage Dynamique en Mémoire
   13.2. Visualisation de Données (`OraclePanel.tsx`)
      13.2.1. Intégration Recharts
      13.2.2. Construction des Courbes de Projection

**SECTION 14 : ARCHITECTURE MOBILE NATIVE (CAPACITOR)**
   14.1. Pont Natif/Web
      14.1.1. Configuration (`capacitor.config.ts`)
      14.1.2. Gestion du Cycle de Vie (`AppUrlOpen`)
   14.2. Deep Linking et OAuth Mobile
   14.3. Accès Matériel (Caméra et Géolocalisation)

**SECTION 15 : ENVIRONNEMENT DE DÉVELOPPEMENT**
   15.1. Le Portail Développeur (`DevPortal.tsx`)
   15.2. Stratégies de Mocking et Simulation

**SECTION 16 : DÉPLOIEMENT ET CI/CD**
   16.1. Pipeline de Build (Vite)
   16.2. Optimisation des Assets et Tree-Shaking

---

# DÉTAILS TECHNIQUES ET ANALYSE DE CODE

## 11. INGÉNIERIE FRONTEND AVANCÉE (REACT)

L'interface utilisateur de Sivara n'est pas un simple assemblage de pages HTML, mais une application JavaScript complexe (SPA) gérant des états lourds et des interactions temps réel.

### 11.1. Architecture des Composants UI (Shadcn/Radix)

Sivara utilise une approche "Headless UI" via la librairie **Radix UI**, stylisée avec **Tailwind CSS**. Les composants ne sont pas importés comme une boîte noire (ex: Material UI), mais le code source des composants vit directement dans `src/components/ui`.

**Avantage Architectural :** Cela donne un contrôle total sur le rendu DOM.
*   **Accessibilité (a11y) :** Les composants Radix (`Dialog`, `Dropdown`, `Tabs`) gèrent nativement le focus trap, la navigation au clavier (ARIA attributes) et les lecteurs d'écran.
*   **Performance :** Aucun CSS runtime n'est injecté. Tout est compilé par Tailwind au build time.

**Exemple : Le Composant `Dialog` (`src/components/ui/dialog.tsx`)**
Il utilise `DialogPrimitive.Portal` pour téléporter le contenu de la modale à la racine du `body` HTML. Cela évite les conflits de `z-index` et de positionnement CSS (`overflow: hidden`) dans les conteneurs parents complexes comme le Dashboard Admin.

### 11.2. Système de Design et Thématisation

Le fichier `src/globals.css` est le registre central des jetons de design (Design Tokens).

**11.2.1. Variables CSS (Theming Dynamique)**
L'application utilise des variables CSS natives (`--primary`, `--background`) définies en valeurs HSL (Hue, Saturation, Lightness).
*   Avantage : Permet de changer l'opacité d'une couleur dans Tailwind (`bg-primary/50`) sans redéfinir la couleur.
*   **Mode Sombre :** La classe `.dark` redéfinit ces variables. Le basculement se fait instantanément sans rechargement de page ni recalcul JS complexe.

**11.2.2. Moteur d'Animation (`tailwind.config.ts`)**
Des animations CSS complexes sont définies directement dans la configuration Tailwind pour assurer la fluidité (GPU acceleration).
*   **`wave-undulate` :** Utilisée sur la page `DeviceLanding`. Elle combine une rotation (`rotate`), une translation Y et un changement d'échelle (`scaleY`) pour simuler un mouvement de liquide ou de ruban flottant.
*   **`accordion-down/up` :** Utilisées pour les menus dépliants. Elles utilisent la propriété CSS `height` interpolée de `0` à `var(--radix-accordion-content-height)`, une variable calculée dynamiquement par Radix au moment du rendu.

### 11.3. Hooks Personnalisés Critiques

**11.3.1. `use-mobile.tsx`**
Ce hook écoute les changements de taille de fenêtre (`window.matchMedia`).
*   **Optimisation :** Il utilise un listener d'événement plutôt qu'un polling, ce qui ne consomme aucune ressource CPU tant que l'utilisateur ne redimensionne pas la fenêtre.
*   **Seuil de rupture :** Défini à `768px` (iPad Portrait). En dessous, l'application bascule en mode "Mobile", changeant radicalement la navigation (Sidebar devient Drawer).

**11.3.2. `use-toast.ts`**
Un gestionnaire d'état local complexe pour les notifications flottantes.
*   **File d'attente :** Gère une liste de notifications (`toasts`) avec une limite (`TOAST_LIMIT = 1` pour éviter le spam visuel).
*   **Auto-Dismiss :** Chaque toast a un timer interne. Le hook gère le cycle de vie (montage, affichage, suppression) pour éviter les fuites de mémoire.

---

## 12. MODULE SIVARA HELP (ADMINISTRATION & CMS)

Le fichier `src/pages/HelpAdmin.tsx` est une application dans l'application. Il contient à la fois un outil de chat support et un CMS (Content Management System).

### 12.1. Architecture du Dashboard Admin

**12.1.1. Gestion d'État Hybride**
Le composant maintient deux états parallèles majeurs :
*   `activeTab` : Détermine si l'admin voit les Tickets ou le Contenu.
*   **État Tickets :** Liste des tickets, ticket sélectionné, messages du ticket. Ces données sont très volatiles (changent chaque seconde).
*   **État Contenu :** Arborescence des catégories et articles. Ces données sont stables.

**12.1.2. Synchronisation Temps Réel (Channels)**
L'effet `useEffect` (lignes 130-180) ouvre un canal Supabase `admin-support`.
*   `postgres_changes` sur `support_tickets` : Si un client crée un ticket, la liste se met à jour instantanément sans recharger.
*   `postgres_changes` sur `support_messages` : Si un client répond dans le chat, le message apparaît immédiatement.
*   **Optimisation :** Le listener filtre les messages entrants. Si le message ne concerne pas le ticket *actuellement ouvert* (`selectedTicketId`), il est ignoré pour éviter de re-rendre inutilement la zone de chat.

### 12.2. Système de Gestion de Contenu (CMS)

Pour permettre aux admins de réorganiser l'aide, le module intègre **DnD Kit**.

**12.2.1. Implémentation Drag & Drop**
*   **`SortableContext` :** Définit une zone où les éléments peuvent être triés.
*   **`useSortable` :** Hook appliqué à chaque ligne (`SortableItem`). Il gère les coordonnées CSS `transform` pendant le glissement.
*   **Capteurs (Sensors) :** Configurés pour ignorer les petits mouvements (delta < 8px) afin de ne pas déclencher un drag par erreur lors d'un simple clic.

**12.2.2. Algorithme de Réorganisation**
Lors de l'événement `onDragEnd` :
1.  Le code calcule le nouvel index dans le tableau local via `arrayMove`.
2.  **Mise à jour Optimiste :** L'interface est mise à jour immédiatement (`setArticles(newItems)`).
3.  **Persistance Asynchrone :** Une boucle parcourt le nouveau tableau et envoie une requête SQL `UPDATE help_articles SET order = X WHERE id = Y` pour chaque élément modifié.

### 12.3. Interface de Chat Support

**12.3.1. Injection Optimiste**
Lors de l'envoi d'une réponse (`sendReply`) :
*   Le message n'est pas ajouté manuellement à la liste locale `messages`.
*   Le code fait confiance à la souscription Realtime : l'insertion en base déclenche l'événement `INSERT` reçu par le listener, qui met alors à jour l'UI. Cela garantit que l'agent voit exactement ce qui a été enregistré sur le serveur (Single Source of Truth).

**12.3.2. Sécurité HTML**
Les messages sont rendus via `dangerouslySetInnerHTML`.
*   **Risque XSS :** En théorie, cela permet d'injecter du script.
*   **Mitigation :** Le contenu provient de l'email parser (backend) qui nettoie les balises script. De plus, React échappe par défaut les contenus non explicites.

---

## 13. MODULE SIVARA DEVICE (LOGIQUE CLIENT)

### 13.1. Configurateur de Matériel (`DeviceLanding.tsx`)

Cette page gère l'inventaire des ordinateurs disponibles à la location.

**13.1.1. Algorithme "Smart Diversity"**
Le problème : Si on affiche simplement `SELECT * FROM units`, les utilisateurs voient tous le même ordinateur "le moins cher" en premier et cliquent tous dessus, créant des conflits de réservation.
La solution : La fonction `getSmartUnits` (lignes 130+).
1.  **Filtrage par Produit :** Isole les unités du modèle sélectionné (ex: "Sivara Book Pro").
2.  **Mélange (Shuffle) :** Applique un mélange aléatoire (Fisher-Yates) sur la liste.
3.  **Dé-doublonnage des Specs :** L'algorithme itère sur la liste mélangée et tente de sélectionner 5 unités ayant des configurations *différentes* (ex: une 16GB, une 32GB, une "Reconditionnée").
4.  **Résultat :** Chaque utilisateur voit une sélection variée et différente, répartissant la charge de la demande sur tout le stock.

**13.1.2. Filtrage Dynamique**
En mode "Recherche Avancée" (`step === 'search'`), le filtrage se fait **côté client**.
*   L'inventaire complet est chargé une seule fois (`allUnits`).
*   Le `useMemo` recalcule la liste affichée instantanément à chaque frappe dans l'input de recherche ou changement de selecteur RAM/Stockage. C'est possible car le stock (quelques centaines d'unités) tient largement en mémoire navigateur.

### 13.2. Visualisation de Données (`OraclePanel.tsx`)

Ce composant utilise la librairie **Recharts** pour dessiner les graphiques financiers.

**13.2.1. Construction des Courbes**
Les données ne sont pas passées brutes à Recharts. Le composant transforme le tableau de projection (généré par `DeviceCustomerDetails`) en un format consommable.
*   Utilisation de `AreaChart` pour superposer les zones de probabilité (Optimiste/Pessimiste).
*   Utilisation de `linearGradient` (SVG) pour créer des effets de dégradé sous les courbes, renforçant l'aspect visuel "FinTech".

---

## 14. ARCHITECTURE MOBILE NATIVE (CAPACITOR)

Sivara utilise Capacitor pour transformer l'application Web en application iOS/Android native.

### 14.1. Pont Natif/Web

**14.1.1. Configuration (`capacitor.config.ts`)**
*   `appId`: `com.example.sivara`. Identifiant unique sur l'App Store / Play Store.
*   `webDir`: `dist`. Indique à Capacitor d'embarquer le dossier de build Vite compilé.
*   `server`: En développement, peut pointer vers l'IP locale. En production, est désactivé pour servir les fichiers locaux (mode hors ligne possible pour certaines parties).

**14.1.2. Gestion du Cycle de Vie (`AppUrlOpen`)**
Dans `src/App.tsx`, un écouteur `CapacitorApp.addListener('appUrlOpen', ...)` est installé.
*   Il intercepte les ouvertures de l'application via des liens profonds (Deep Links).
*   Si l'URL contient `login-callback`, il extrait les tokens d'authentification (access/refresh) de l'URL et les injecte dans Supabase. C'est ce qui permet le "Login with Google" ou le "Magic Link" de fonctionner sur une app mobile installée.

### 14.3. Accès Matériel

Dans `src/pages/IdentityVerification.tsx`, l'accès caméra est géré de manière polymorphe.
*   **Web :** `navigator.mediaDevices.getUserMedia`.
*   **Mobile (Native) :** Capacitor injecte les permissions natives. Si l'utilisateur est sur l'app native, le navigateur WebView demande la permission OS (iOS/Android).
*   **Canvas Capture :** L'image n'est pas prise par l'OS, mais "grabée" depuis le flux vidéo HTML5 sur un `<canvas>`. Cela permet de redimensionner et compresser l'image en JPEG 80% *avant* l'upload, économisant la data mobile de l'utilisateur.

---

## 15. ENVIRONNEMENT DE DÉVELOPPEMENT

### 15.1. Le Portail Développeur (`DevPortal.tsx`)

Cette page est un outil interne accessible uniquement en `localhost`.
*   Elle présente des cartes pour chaque "micro-app" (Docs, Mail, Account).
*   Au clic, elle force le rechargement de la page avec le paramètre `?app=...`.
*   **Utilité :** Permet de développer et tester l'isolation des modules sans avoir à déployer sur les sous-domaines de production.

### 15.2. Simulation des Données
Dans plusieurs composants (ex: `MailInbox.tsx`), des constantes `MOCK_DATA` sont définies.
*   Si la requête Supabase échoue ou si l'utilisateur est hors ligne, l'interface peut (dans certaines versions) basculer sur ces données pour permettre le travail sur l'UI sans backend.

---

## 16. DÉPLOIEMENT ET CI/CD

### 16.1. Pipeline de Build (Vite)

Le script `npm run build` déclenche Vite (`vite.config.ts`).
1.  **TypeScript Compilation :** Vérifie l'intégrité des types sur tout le projet.
2.  **Bundling (Rollup) :** Vite utilise Rollup sous le capot.
3.  **Code Splitting :** Vite découpe automatiquement le bundle JS en plusieurs morceaux (`chunks`) basés sur les routes dynamiques (`lazy`).
    *   Le code de l'éditeur de texte (Tiptap, lourd) n'est chargé que si l'utilisateur va sur `/docs`.
    *   Le code de la caméra n'est chargé que sur `/id`.
    *   Cela garantit un chargement initial ultra-rapide (< 1s) de la page d'accueil.

### 16.2. Optimisation des Assets
*   Les images dans `/public` sont servies statiquement.
*   Les polices sont chargées via Google Fonts avec `display=swap` pour éviter le texte invisible.
*   Tailwind purge (Tree-Shaking) toutes les classes CSS non utilisées dans les fichiers `.tsx`, générant un fichier CSS final minuscule (< 50kb).

---

**FIN DU VOLUME 2**