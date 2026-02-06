
# Phase 1 - Transformation SaaS Multi-Entreprises

## Vue d'ensemble

Transformer Stock Management d'une application single-tenant en une plateforme SaaS multi-entreprises avec :
- Isolation complete des donnees par entreprise
- Nouveau role `super_admin` pour gerer la plateforme
- Inscription libre des entreprises avec essai gratuit de 30 jours
- Migration des donnees existantes vers une entreprise par defaut
- Tableau de bord Super Admin

---

## Portee de la Phase 1

| Element | Inclus | Phase suivante |
|---------|--------|---------------|
| Table `companies` + multi-tenant | Oui | - |
| Role `super_admin` (manuel en base) | Oui | - |
| Inscription libre des entreprises | Oui | - |
| Essai gratuit 30 jours | Oui | - |
| Plans d'abonnement (Basic/Pro/Premium) | Structure de base | Paiements Phase 2 |
| Blocage si abonnement expire | Oui | - |
| Dashboard Super Admin | Oui | - |
| Migration donnees existantes | Oui | - |
| Paiements MonCash/NatCash/Stripe | Non | Phase 2 |
| Multi-boutiques | Non | Phase 3 |
| Comptabilite simplifiee | Non | Phase 3 |

---

## Etape 1 : Schema de base de donnees

### 1.1 Nouveau role `super_admin`

Ajouter `super_admin` a l'enum `app_role` existant :
```
ALTER TYPE app_role ADD VALUE 'super_admin';
```

### 1.2 Table `companies`

```sql
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  address text,
  city text,
  phone text,
  email text,
  logo_url text,
  tva_rate numeric DEFAULT 10.0,
  usd_htg_rate numeric DEFAULT 132.00,
  default_display_currency text DEFAULT 'HTG',
  payment_terms text,
  is_active boolean DEFAULT true,
  subscription_plan text DEFAULT 'trial',    -- trial, basic, pro, premium
  subscription_start date DEFAULT CURRENT_DATE,
  subscription_end date DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  max_users integer DEFAULT 5,
  max_products integer DEFAULT 100,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 1.3 Table `subscription_plans`

```sql
CREATE TABLE public.subscription_plans (
  id text PRIMARY KEY,           -- 'trial', 'basic', 'pro', 'premium'
  name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 5,
  max_products integer NOT NULL DEFAULT 100,
  features jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

Donnees initiales :
| Plan | Prix | Max Users | Max Produits |
|------|------|-----------|-------------|
| trial | 0 $ | 3 | 50 |
| basic | 19 $ | 5 | 200 |
| pro | 39 $ | 15 | 1000 |
| premium | 59 $ | Illimite | Illimite |

### 1.4 Ajouter `company_id` a toutes les tables existantes

Les tables suivantes recevront une colonne `company_id` :
- `profiles`
- `user_roles`
- `products`
- `sales`
- `sale_items` (via la relation avec `sales`)
- `stock_movements`
- `activity_logs`
- `categories`
- `sous_categories`
- `specifications_modeles`
- `proformas`
- `seller_authorized_categories`

La table `company_settings` sera **remplacee** par les champs dans `companies` (logo, TVA, devise, etc. sont maintenant par entreprise).

### 1.5 Migration des donnees existantes

1. Creer une entreprise par defaut avec les donnees actuelles de `company_settings`
2. Associer tous les enregistrements existants a cette entreprise
3. Rendre `company_id` NOT NULL apres la migration

### 1.6 Nouvelles politiques RLS

Toutes les tables auront des politiques RLS basees sur :
- L'utilisateur appartient a la meme entreprise que les donnees
- Le `super_admin` a acces a tout
- Isolation stricte : une entreprise ne voit jamais les donnees d'une autre

Exemple de politique type :
```sql
-- Fonction helper pour obtenir le company_id de l'utilisateur
CREATE FUNCTION get_user_company_id(_user_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Politique RLS pour products
CREATE POLICY "Users see their company products" ON products
FOR SELECT USING (
  company_id = get_user_company_id(auth.uid())
  OR has_role(auth.uid(), 'super_admin')
);
```

---

## Etape 2 : Flux d'inscription entreprise

### 2.1 Nouveau parcours d'inscription

```
Page /auth
  -> Onglet "Connexion" (existant)
  -> Onglet "Inscription" (modifie)
     -> Choix : "Creer mon entreprise" / "Rejoindre une entreprise"
       -> Creer : Formulaire nom entreprise + infos utilisateur
       -> Rejoindre : Code d'invitation + infos utilisateur
```

### 2.2 Logique de creation d'entreprise

Quand un utilisateur cree une entreprise :
1. Creer l'enregistrement `companies` avec plan `trial` et expiration J+30
2. Creer le profil utilisateur avec `company_id`
3. Attribuer le role `admin` (actif) a ce premier utilisateur
4. Creer les categories par defaut pour cette entreprise

### 2.3 Logique pour rejoindre une entreprise

L'admin d'une entreprise peut generer un code d'invitation. Un nouveau vendeur entre ce code pour rejoindre l'entreprise avec le role `seller` (inactif, en attente d'approbation).

---

## Etape 3 : Verification d'abonnement

### 3.1 Middleware de verification

Un hook `useSubscription` verifiera a chaque chargement :
- Si l'entreprise est active (`is_active = true`)
- Si l'abonnement n'est pas expire (`subscription_end >= today`)
- Si les limites ne sont pas depassees (nombre d'utilisateurs, produits)

### 3.2 Ecran de blocage

Si l'abonnement est expire, l'utilisateur voit un ecran :
- "Votre periode d'essai est terminee"
- Boutons pour choisir un plan (interface seulement, paiement en Phase 2)
- Seul le Super Admin peut prolonger manuellement

---

## Etape 4 : Adaptation du code frontend

### 4.1 Contexte d'entreprise

Creer un nouveau hook `useCompany` qui :
- Charge les informations de l'entreprise de l'utilisateur connecte
- Remplace `useCompanySettings` pour les parametres specifiques a l'entreprise
- Fournit le `company_id` a toutes les requetes

### 4.2 Modifications des requetes Supabase

Toutes les requetes existantes qui interrogent `products`, `sales`, etc. n'ont **pas besoin** d'ajouter manuellement `.eq('company_id', ...)` car le filtrage sera fait par les politiques RLS. Cependant, les **insertions** devront inclure le `company_id`.

Fichiers principaux a modifier :
- `useAuth.ts` : Charger le `company_id` depuis le profil
- `useCompanySettings.ts` : Lire depuis `companies` au lieu de `company_settings`
- `ResponsiveDashboardLayout.tsx` : Utiliser les settings de l'entreprise
- `ProductManagement.tsx` : Ajouter `company_id` aux insertions
- `SellerWorkflow.tsx` : Ajouter `company_id` aux ventes
- `process-sale/index.ts` : Ajouter `company_id` aux enregistrements
- `CompanySettings.tsx` : Modifier la table `companies` au lieu de `company_settings`
- `UserManagementPanel.tsx` : Filtrer par entreprise
- Tous les composants Dashboard et Reports (le RLS gere le filtrage)

### 4.3 Hook `useAuth` mis a jour

```typescript
export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string;
  role?: 'admin' | 'seller' | 'super_admin';
  is_active?: boolean;
  company_id?: string;     // NOUVEAU
  company_name?: string;   // NOUVEAU
}
```

---

## Etape 5 : Dashboard Super Admin

### 5.1 Nouvelle page `/super-admin`

Accessible uniquement aux utilisateurs avec le role `super_admin`. Contient :

- **KPIs principaux** :
  - Nombre total d'entreprises
  - Entreprises actives / en essai / expirees
  - Nombre total d'utilisateurs sur la plateforme
  - Revenus mensuels potentiels (MRR base sur les plans)

- **Liste des entreprises** :
  - Nom, plan, statut, date d'expiration
  - Nombre d'utilisateurs / produits
  - Actions : Activer/Suspendre, Changer le plan, Prolonger l'essai

- **Graphique d'evolution** :
  - Nouvelles inscriptions par mois
  - Repartition des plans

### 5.2 Nouvelles routes

```tsx
<Route path="/super-admin" element={<SuperAdminDashboard />} />
```

---

## Etape 6 : Edge Functions

### 6.1 `process-sale/index.ts`

Ajouter `company_id` lors de la creation de la vente et des mouvements de stock. Recuperer le `company_id` depuis le profil de l'utilisateur authentifie.

### 6.2 `delete-sale/index.ts`

Verifier que la vente appartient a la meme entreprise que l'utilisateur.

---

## Resume des fichiers a creer

| Fichier | Description |
|---------|------------|
| Migration SQL | Tables companies, subscription_plans, ajout company_id, migration donnees, RLS |
| `src/pages/SuperAdminDashboard.tsx` | Dashboard Super Admin |
| `src/hooks/useCompany.ts` | Hook pour le contexte d'entreprise |
| `src/hooks/useSubscription.ts` | Hook pour la verification d'abonnement |
| `src/components/Auth/CompanySignup.tsx` | Formulaire de creation d'entreprise |
| `src/components/SuperAdmin/CompanyList.tsx` | Liste et gestion des entreprises |
| `src/components/SuperAdmin/SaasKPIs.tsx` | KPIs de la plateforme |
| `src/components/Subscription/ExpiredScreen.tsx` | Ecran de blocage abonnement expire |

## Resume des fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `src/App.tsx` | Ajouter route /super-admin |
| `src/hooks/useAuth.ts` | Ajouter company_id au profil, role super_admin |
| `src/hooks/useCompanySettings.ts` | Lire depuis companies |
| `src/pages/Index.tsx` | Redirection super_admin |
| `src/pages/Auth.tsx` | Onglet creation entreprise |
| `src/components/Layout/ResponsiveDashboardLayout.tsx` | Support super_admin |
| `src/components/Settings/CompanySettings.tsx` | Ecrire dans companies |
| `src/components/Products/ProductManagement.tsx` | company_id dans insertions |
| `supabase/functions/process-sale/index.ts` | company_id dans vente |
| `supabase/functions/delete-sale/index.ts` | Verifier company_id |
| `supabase/config.toml` | Eventuelles nouvelles fonctions |

---

## Details techniques importants

### Securite

- Le `company_id` n'est **jamais** passe depuis le frontend dans les requetes SELECT (le RLS le gere)
- Pour les INSERT, le `company_id` est lu depuis le profil de l'utilisateur connecte cote serveur (edge functions) ou verifie par RLS
- Le Super Admin est cree manuellement en base, impossible de devenir Super Admin via l'interface
- La fonction `get_user_company_id()` est `SECURITY DEFINER` pour eviter les boucles RLS

### Compatibilite

- Les donnees existantes sont migrees vers une entreprise par defaut
- L'application continue de fonctionner normalement pour les utilisateurs existants
- Les nouveaux utilisateurs passent par le flux d'inscription entreprise

### Limites de la Phase 1

- Pas de paiement en ligne (les plans sont geres manuellement par le Super Admin)
- Pas de multi-boutiques
- Pas de facturation automatique SaaS
- Le Super Admin prolonge/change les plans manuellement

---

## Ordre d'implementation recommande

1. **Migration SQL** : Tables, colonnes, migration donnees, RLS (le plus critique)
2. **useAuth + useCompany** : Fondation pour tout le reste
3. **Auth page** : Inscription entreprise
4. **useSubscription + ExpiredScreen** : Blocage abonnement
5. **Adaptation des insertions** : company_id partout
6. **Edge functions** : process-sale, delete-sale
7. **CompanySettings** : Lire/ecrire depuis companies
8. **Super Admin Dashboard** : Interface de gestion
9. **Tests end-to-end** : Verifier l'isolation des donnees

Cette Phase 1 represente un travail consequent qui sera decoupe en plusieurs iterations pour garantir la stabilite de l'application existante a chaque etape.
