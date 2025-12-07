# TOME 13 : APPLICATIONS MÉTIER (DOCS & MAIL)
**CIBLE :** `src/pages/Docs.tsx`, `src/pages/DocEditor.tsx`, `src/pages/MailInbox.tsx`

## 13.1. ÉDITEUR TIPTAP SÉCURISÉ

*   **Stockage :** Le contenu HTML est chiffré avant d'être sauvegardé.
*   **Collaboration P2P :** Les curseurs des autres utilisateurs sont transmis via WebSocket (Supabase Realtime Broadcast). Ils ne sont pas stockés en DB (trop de volume).
*   **Mises à jour de contenu :** Lorsqu'un collaborateur tape, le delta est chiffré et envoyé via le canal Broadcast. Les autres clients déchiffrent et appliquent le patch.

## 13.2. SYSTÈME DE FICHIERS VIRTUEL

Dans `Docs.tsx` :
*   Utilisation de `@dnd-kit` pour le Drag & Drop.
*   Gestion d'une arborescence via `parent_id` (Adjacency List).
*   Fil d'ariane (Breadcrumbs) dynamique.

## 13.3. CLIENT MAIL CHIFFRÉ

`MailInbox` simule une interface native.
*   Le corps des emails est chiffré en base.
*   Au clic, `EncryptionService` déchiffre le contenu à la volée pour l'affichage.
*   Sidebar responsive avec état persistant.