# TOME 10 : GESTION D'INVENTAIRE MATÉRIEL
**CIBLE :** `src/pages/DeviceLanding.tsx`, `src/pages/DeviceAdmin.tsx`

## 10.1. ALGORITHME "SMART DIVERSITY"

Pour éviter que tous les clients ne se ruent sur la même unité "Best Seller", l'affichage est manipulé.
1.  Récupération de tout le stock disponible.
2.  Mélange aléatoire (`Fisher-Yates Shuffle`).
3.  Filtrage pour présenter 5 unités avec des specs *différentes* (16GB, 32GB, etc.).
4.  **Résultat :** Lissage de la demande sur l'ensemble du parc.

## 10.2. RÉSERVATION ATOMIQUE

Le processus de commande utilise une fonction RPC PostgreSQL `reserve_device`.
*   C'est une transaction atomique.
*   Elle vérifie `status = 'available'` et le passe à `reserved` en une seule instruction.
*   Cela empêche les "Race Conditions" (deux clients payant pour le même ordi à la milliseconde près).

## 10.3. LOGISTIQUE GÉOSPATIALE

Utilisation de l'API Google Maps Geometry.
*   Calcul de la distance géodésique entre l'entrepôt et le client.
*   Si `distance < 35km`, l'option "Livraison Flash" est activée automatiquement.