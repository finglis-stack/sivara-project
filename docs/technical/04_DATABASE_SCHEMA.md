# VOLUME 4 : GOUVERNANCE DES DONNÉES (POSTGRESQL)
**VERSION SCHÉMA :** V1.4
**MOTEUR :** POSTGRESQL 15+ (SUPABASE)

---

## 1. VUE D'ENSEMBLE DU SCHÉMA

Le modèle de données de Sivara est conçu pour la **ségrégation stricte**. Il n'y a pas de "Super Admin" applicatif ayant accès à toutes les données en clair.

### 1.1. Table `profiles` (Extension d'Identité)
Cette table étend la table système `auth.users` de Supabase.

| Colonne | Type | Description | Sécurité |
| :--- | :--- | :--- | :--- |
| `id` | UUID (PK) | FK vers `auth.users(id)`. | **Cascade Delete** |
| `first_name` | Text | Prénom de l'utilisateur. | Public (Admin) |
| `last_name` | Text | Nom de l'utilisateur. | Public (Admin) |
| `is_pro` | Boolean | Statut de l'abonnement. | **Service Role Only** |
| `stripe_id` | Text | ID Client Stripe. | **Service Role Only** |
| `avatar_url` | Text | URL vers le Bucket Storage. | Public |

**Automatisation :**
Un trigger `handle_new_user` est attaché à `auth.users`. À chaque inscription (SignUp), il insère automatiquement une ligne correspondante dans `public.profiles`. Cela garantit que chaque utilisateur a un profil, évitant les erreurs de jointure `LEFT JOIN` nulles dans l'application.

---

### 1.2. Table `documents` (Le Coffre-fort)
C'est ici que résident les données chiffrées de l'application Docs.

| Colonne | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identifiant unique. |
| `owner_id` | UUID (FK) | Propriétaire du document. |
| `parent_id` | UUID (FK) | Dossier parent (Structure Arborescente). |
| `title` | Text | **Donnée Chiffrée (Base64)**. |
| `content` | Text | **Donnée Chiffrée (Base64)**. |
| `encryption_iv` | Text | Vecteur d'initialisation (Base64). Indispensable pour déchiffrer. |
| `type` | Enum | 'file' ou 'folder'. |

**Politique de Sécurité (RLS) - SELECT :**
```sql
CREATE POLICY "Access via document_access" ON documents
FOR SELECT USING (
  -- Cas 1 : Je suis le propriétaire
  (owner_id = auth.uid()) 
  OR 
  -- Cas 2 : Le document est public
  (visibility = 'public') 
  OR 
  -- Cas 3 : J'ai une permission explicite dans la table de liaison
  (EXISTS (
    SELECT 1 FROM document_access da 
    WHERE da.document_id = documents.id 
    AND da.email = auth.email()
  ))
);
```
**Analyse :** Cette politique est appliquée par le noyau PostgreSQL à chaque requête. Un développeur frontend ne peut pas "oublier" de filtrer par utilisateur. Si `auth.uid()` ne matche pas, la base de données retourne 0 ligne, comme si les données n'existaient pas.

---

### 1.3. Table `device_units` (Inventaire Matériel)
Utilise des types de données avancés pour gérer l'hétérogénéité du matériel.

| Colonne | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK. |
| `serial_number` | Text | Numéro de série unique. |
| `status` | Enum | 'available', 'reserved', 'sold', 'maintenance'. |
| `specific_specs` | **JSONB** | Spécifications techniques flexibles. |

**Pourquoi JSONB ?**
Les ordinateurs ont des caractéristiques différentes. Un MacBook a "Unified Memory", un PC a "DDR5 RAM". Un écran peut être "Retina" ou "OLED 120Hz".
Plutôt que de créer 50 colonnes (`ram_type`, `screen_type`...), nous stockons un document JSON structuré :
```json
{
  "ram_size": "16",
  "storage": "512",
  "features": { "touch": false, "wifi6e": true }
}
```
L'indexation GIN (`CREATE INDEX ON device_units USING GIN (specific_specs)`) permet de requêter ce JSON aussi vite qu'une colonne relationnelle classique (ex: trouver tous les PCs avec > 16GB RAM).

---

### 1.4. Table `crawled_pages` (Index de Recherche)

| Colonne | Type | Description |
| :--- | :--- | :--- |
| `url` | Text | URL Chiffrée. |
| `content` | Text | Contenu HTML Chiffré. |
| `blind_index` | **Text[]** | Tableau de hashs HMAC (Tokens de recherche). |
| `search_hash` | Text | Hash SHA-256 de l'URL (Dédoublonnage). |

**Stratégie d'Indexation Aveugle :**
La colonne `blind_index` est la clé de voûte du moteur de recherche privé. Elle ne contient aucun mot lisible, seulement des signatures cryptographiques (`hmac('pomme')`).
L'opérateur PostgreSQL `&&` (Overlap) est utilisé pour trouver les lignes qui contiennent les tokens recherchés.

---

## 2. AUTOMATISATION ET TRIGGERS

### 2.1. Trigger `update_content_vector`
Bien que le contenu principal soit chiffré, certaines métadonnées (si disponibles en clair pour des documents publics) peuvent être indexées pour la recherche native Postgres Full-Text Search.

```sql
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON crawled_pages FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(content_vector, 'pg_catalog.french', title, description);
```
Ce trigger met à jour automatiquement une colonne `tsvector` invisible chaque fois que le titre ou la description change, maintenant l'index de recherche à jour sans intervention du code applicatif.

### 2.2. Trigger `on_auth_user_created`
```sql
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');
  return new;
end;
$$ language plpgsql security definer;
```
Ce trigger est défini avec `SECURITY DEFINER`. Cela signifie qu'il s'exécute avec les privilèges de l'admin (postgres), ce qui lui permet d'écrire dans la table `profiles` même si l'utilisateur n'a pas encore les droits explicites via RLS. C'est le seul moyen fiable d'initialiser les données utilisateur à la création du compte.

---

## 3. SÉCURITÉ RÉSEAU ET API

Supabase expose les tables via une API REST (PostgREST).
*   **Exposition :** Par défaut, toutes les tables du schéma `public` sont exposées.
*   **Protection :** Le RLS est la *seule* barrière. Si le RLS est désactivé sur une table, elle est publiquement accessible en lecture/écriture par n'importe qui possédant la clé anonyme (`anon_key`).
*   **Audit :** Toutes les tables critiques (`documents`, `profiles`, `emails`) ont `RLS ENABLED` et des politiques strictes définies. Les tables système (`crawled_pages` pour l'écriture) sont verrouillées pour n'autoriser l'écriture que par le `service_role` (nos Edge Functions), empêchant un utilisateur d'injecter du faux contenu dans l'index de recherche.