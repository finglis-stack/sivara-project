# TOME 14 : GOUVERNANCE DES DONNÉES (SQL)
**CIBLE :** PostgreSQL Schema, Migrations

## 14.1. ROW LEVEL SECURITY (RLS)

C'est la barrière ultime.
*   Chaque table (`documents`, `profiles`) a le RLS activé.
*   **Policy :** `auth.uid() = owner_id`.
*   Même si l'API est exposée, un utilisateur ne peut physiquement pas voir les lignes qui ne lui appartiennent pas. Le moteur SQL filtre en amont.

## 14.2. TYPES JSONB AVANCÉS

La table `device_units` utilise une colonne `specific_specs` en JSONB.
*   Permet de stocker des configurations hétérogènes (Mac vs PC) sans multiplier les colonnes.
*   Indexation GIN (Generalized Inverted Index) pour permettre des requêtes rapides à l'intérieur du JSON (ex: "Trouver tous les PC avec 32GB de RAM").

## 14.3. TRIGGERS D'AUTOMATISATION

*   `handle_new_user` : Crée automatiquement un profil public lors de l'inscription Auth.
*   `update_content_vector` : Met à jour les vecteurs de recherche (si applicable) lors de la modification d'un article d'aide.