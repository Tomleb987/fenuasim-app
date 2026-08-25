# Compte-rendu technique — Gestion multi-voyageurs / multi-appareils / multi-eSIM

_Rédigé le 2026-08-23. Aucune modification de code n'a été faite pendant la rédaction de ce document — il décrit l'état réel du dépôt tel qu'il existe au moment de sa rédaction, re-vérifié en direct (requêtes SQL sur le projet Supabase, `tsc`, `expo export`)._

---

## 1. Résumé exécutif

```text
Objectif :
Permettre à un utilisateur possédant plusieurs eSIM sous le même compte FENUASIM
d'attribuer chaque eSIM à un voyageur et éventuellement à un appareil,
sans modifier les tables historiques utilisées par le site web.

Résultat :
⚠️ Implémenté et vérifié techniquement (schéma DB, RLS, TypeScript, build Metro).
   NON testé fonctionnellement avec un vrai compte / navigateur dans cette session
   (environnement sans navigateur pilotable, pas d'identifiants de test fournis).
```

Principales fonctionnalités ajoutées :
- 3 nouvelles tables Supabase isolées (`app_travelers`, `app_devices`, `app_esim_assignments`), RLS activée
- Écrans Voyageurs (liste + création/édition/suppression) et Appareils (liste groupée + création/édition/suppression)
- Flux d'attribution eSIM en 3 étapes (`app/esim/assign.tsx`)
- Accueil enrichi : voyageur/appareil affichés par eSIM, état "non attribuée" avec CTA, ICCID masqué (4 derniers chiffres max)
- Proposition d'attribution après achat, non bloquante

Principal point restant à traiter avant mise en production : **aucun test fonctionnel réel n'a été exécuté** (voir sections 18, 19, 20).

---

## 2. Impact sur `fenuasim.com`

| Élément | Modifié ? | Détail |
|---|---|---|
| `airalo_orders` (table) | **Non** | Structure inchangée (15 colonnes, vérifié en direct). Aucune colonne ajoutée/supprimée, aucune policy touchée. |
| `orders` (table) | **Non** | Structure inchangée (49 colonnes, vérifié en direct). |
| `airalo_packages` (table) | **Non** | Structure inchangée (40 colonnes, vérifié en direct). Uniquement lue en `SELECT` par l'app (déjà le cas avant). |
| `insurances` (table) | **Non** | Structure inchangée (38 colonnes, vérifié en direct). |
| API `create-airalo-order` (fenuasim.com) | **Non** | Le fichier `app/esim/payment-success.tsx` qui l'appelle a été modifié, mais uniquement pour renommer une variable locale (`pkg` → `pkgData`, conflit de nom avec un nouveau `useState`). Le payload envoyé à l'API (`packageId`, `airalo_id`, `customerEmail`, `customerName`, `quantity`, `description`) est **strictement identique** à avant, endpoint identique. Voir diff exact section 15. |
| Edge Function `airalo-proxy` | **Non** | Vérifié en direct : version 2, `updated_at` inchangé depuis avant cette session. Non redéployée, non modifiée. |
| Edge Function `create-checkout-mobile` | **Non** | Vérifié en direct : version 3, `updated_at` inchangé. |
| Edge Function `create-airalo-order` | **Non** | Vérifié en direct : version 185, `updated_at` inchangé. Uniquement appelée en HTTP, jamais éditée. |
| Policies historiques Supabase (`airalo_orders`, `orders`, `insurances`, `airalo_packages`) | **Non** | Re-listées en direct après développement : identiques à avant (même noms, mêmes `qual`), y compris la policy `Enable read access for all users` sur `airalo_orders` — présente, non touchée (voir section 21). |
| Site `fenuasim.com` (code Next.js) | **Non** | Aucun accès à ce dépôt/hébergement dans cette session. Aucune requête d'écriture n'a été faite vers lui. |

**Conclusion section 2 :** aucun élément du site web ou du backend partagé n'a été modifié. Les seules écritures Supabase de cette session sont la création des 3 tables `app_*` (DDL) et, à l'exécution future de l'app, des lignes dans ces mêmes tables.

---

## 3. Nouvelles tables Supabase

### `app_travelers`
Rôle : voyageurs rattachés à un compte utilisateur (auth.uid()).

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| user_id | uuid | non | — |
| first_name | text | non | — |
| last_name | text | oui | — |
| nickname | text | oui | — |
| is_account_holder | boolean | non | `false` |
| created_at | timestamptz | non | `now()` |
| updated_at | timestamptz | non | `now()` |

Contraintes : `PRIMARY KEY (id)`, `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`.
Index : `app_travelers_user_id_idx (user_id)`.
Trigger : `app_travelers_set_updated_at` (met à jour `updated_at` avant chaque `UPDATE`).

### `app_devices`
Rôle : appareils, rattachés optionnellement à un voyageur.

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| user_id | uuid | non | — |
| traveler_id | uuid | oui | — |
| name | text | non | — |
| brand | text | oui | — |
| model | text | oui | — |
| created_at | timestamptz | non | `now()` |
| updated_at | timestamptz | non | `now()` |

Contraintes : `PRIMARY KEY (id)`, `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`, `FOREIGN KEY (traveler_id) REFERENCES app_travelers(id) ON DELETE SET NULL`.
Index : `app_devices_user_id_idx (user_id)`, `app_devices_traveler_id_idx (traveler_id)`.
Triggers : `app_devices_set_updated_at`, `app_devices_validate_ownership` (voir section 5 — empêche de rattacher un appareil à un voyageur d'un autre compte).

### `app_esim_assignments`
Rôle : lien entre une eSIM historique (`airalo_orders`, identifiée par ICCID) et un voyageur/appareil.

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| user_id | uuid | non | — |
| airalo_order_id | uuid | oui | — |
| iccid | text | non | — |
| traveler_id | uuid | oui | — |
| device_id | uuid | oui | — |
| label | text | oui | — |
| created_at | timestamptz | non | `now()` |
| updated_at | timestamptz | non | `now()` |

Contraintes : `PRIMARY KEY (id)`, `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`, `FOREIGN KEY (traveler_id) REFERENCES app_travelers(id) ON DELETE SET NULL`, `FOREIGN KEY (device_id) REFERENCES app_devices(id) ON DELETE SET NULL`, `UNIQUE (user_id, iccid)`.
**Pas de foreign key vers `airalo_orders`** (choix volontaire, cf. brief : `airalo_order_id` est stocké en `uuid` — type identique à `airalo_orders.id` — mais sans contrainte référentielle, pour ne prendre aucun risque sur la table historique).
Index : `app_esim_assignments_user_id_idx`, `app_esim_assignments_iccid_idx`, `app_esim_assignments_traveler_id_idx`, `app_esim_assignments_device_id_idx`.
Triggers : `app_esim_assignments_set_updated_at`, `app_esim_assignments_validate_ownership`.

Aucune autre table n'a été créée.

---

## 4. SQL réellement exécuté

Migration appliquée via `apply_migration` (nom : `app_travelers_devices_esim_assignments`) sur le projet `hptbhujyrhjsquckzckc` :

```sql
-- FENUASIM mobile app: multi-traveler / multi-device / eSIM assignment layer.
-- Isolated, app_-prefixed tables. No modification to existing tables/policies/functions.
-- Link to airalo_orders is by iccid value only (no FK), so existing order flow is never impacted.

create or replace function public.app_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.app_validate_ownership()
returns trigger
language plpgsql
as $$
begin
  if new.traveler_id is not null then
    if not exists (
      select 1 from public.app_travelers t
      where t.id = new.traveler_id and t.user_id = new.user_id
    ) then
      raise exception 'traveler_id does not belong to user_id';
    end if;
  end if;

  if TG_TABLE_NAME = 'app_esim_assignments' and new.device_id is not null then
    if not exists (
      select 1 from public.app_devices d
      where d.id = new.device_id and d.user_id = new.user_id
    ) then
      raise exception 'device_id does not belong to user_id';
    end if;
  end if;

  return new;
end;
$$;

-- 1. Travelers rattachés au compte connecté
create table public.app_travelers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  nickname text,
  is_account_holder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_travelers_user_id_idx on public.app_travelers(user_id);

create trigger app_travelers_set_updated_at
before update on public.app_travelers
for each row execute function public.app_touch_updated_at();

alter table public.app_travelers enable row level security;

create policy "app_travelers_select_own" on public.app_travelers
for select using (auth.uid() = user_id);

create policy "app_travelers_insert_own" on public.app_travelers
for insert with check (auth.uid() = user_id);

create policy "app_travelers_update_own" on public.app_travelers
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "app_travelers_delete_own" on public.app_travelers
for delete using (auth.uid() = user_id);

-- 2. Appareils rattachés à un voyageur (optionnel)
create table public.app_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  traveler_id uuid references public.app_travelers(id) on delete set null,
  name text not null,
  brand text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_devices_user_id_idx on public.app_devices(user_id);
create index app_devices_traveler_id_idx on public.app_devices(traveler_id);

create trigger app_devices_set_updated_at
before update on public.app_devices
for each row execute function public.app_touch_updated_at();

create trigger app_devices_validate_ownership
before insert or update on public.app_devices
for each row execute function public.app_validate_ownership();

alter table public.app_devices enable row level security;

create policy "app_devices_select_own" on public.app_devices
for select using (auth.uid() = user_id);

create policy "app_devices_insert_own" on public.app_devices
for insert with check (auth.uid() = user_id);

create policy "app_devices_update_own" on public.app_devices
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "app_devices_delete_own" on public.app_devices
for delete using (auth.uid() = user_id);

-- 3. Attribution des eSIM historiques (airalo_orders, référencées par iccid) à un voyageur / appareil
create table public.app_esim_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  airalo_order_id uuid,
  iccid text not null,
  traveler_id uuid references public.app_travelers(id) on delete set null,
  device_id uuid references public.app_devices(id) on delete set null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, iccid)
);

create index app_esim_assignments_user_id_idx on public.app_esim_assignments(user_id);
create index app_esim_assignments_iccid_idx on public.app_esim_assignments(iccid);
create index app_esim_assignments_traveler_id_idx on public.app_esim_assignments(traveler_id);
create index app_esim_assignments_device_id_idx on public.app_esim_assignments(device_id);

create trigger app_esim_assignments_set_updated_at
before update on public.app_esim_assignments
for each row execute function public.app_touch_updated_at();

create trigger app_esim_assignments_validate_ownership
before insert or update on public.app_esim_assignments
for each row execute function public.app_validate_ownership();

alter table public.app_esim_assignments enable row level security;

create policy "app_esim_assignments_select_own" on public.app_esim_assignments
for select using (auth.uid() = user_id);

create policy "app_esim_assignments_insert_own" on public.app_esim_assignments
for insert with check (auth.uid() = user_id);

create policy "app_esim_assignments_update_own" on public.app_esim_assignments
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "app_esim_assignments_delete_own" on public.app_esim_assignments
for delete using (auth.uid() = user_id);
```

Ce SQL est celui réellement envoyé à Supabase (`apply_migration`), reproduit ici sans modification.

---

## 5. Audit RLS

Policies re-listées en direct depuis `pg_policies` après développement (pas depuis la mémoire de la session) :

### `app_travelers`
- **SELECT** — `app_travelers_select_own` : `qual = (auth.uid() = user_id)`
- **INSERT** — `app_travelers_insert_own` : `with_check = (auth.uid() = user_id)`
- **UPDATE** — `app_travelers_update_own` : `qual = (auth.uid() = user_id)`, `with_check = (auth.uid() = user_id)`
- **DELETE** — `app_travelers_delete_own` : `qual = (auth.uid() = user_id)`

### `app_devices`
- **SELECT** — `app_devices_select_own` : `qual = (auth.uid() = user_id)`
- **INSERT** — `app_devices_insert_own` : `with_check = (auth.uid() = user_id)`
- **UPDATE** — `app_devices_update_own` : `qual = (auth.uid() = user_id)`, `with_check = (auth.uid() = user_id)`
- **DELETE** — `app_devices_delete_own` : `qual = (auth.uid() = user_id)`

### `app_esim_assignments`
- **SELECT** — `app_esim_assignments_select_own` : `qual = (auth.uid() = user_id)`
- **INSERT** — `app_esim_assignments_insert_own` : `with_check = (auth.uid() = user_id)`
- **UPDATE** — `app_esim_assignments_update_own` : `qual = (auth.uid() = user_id)`, `with_check = (auth.uid() = user_id)`
- **DELETE** — `app_esim_assignments_delete_own` : `qual = (auth.uid() = user_id)`

**Confirmation explicite demandée :** l'isolation repose sur `auth.uid() = user_id` (comparaison à l'UUID de session JWT), **pas** sur un e-mail envoyé par le client. Le `user_id` inséré vient de `session.user.id` côté app (jamais saisi par l'utilisateur), et même s'il était falsifié, la clause `with_check` côté `INSERT`/`UPDATE` rejette toute ligne où `user_id ≠ auth.uid()` — le serveur Postgres fait l'arbitrage, pas le client.

Vérifications demandées :
- **Lire les voyageurs d'un autre utilisateur** : impossible — `SELECT` filtré par `auth.uid() = user_id`, aucune policy `qual: true` sur ces 3 tables (contrairement à `airalo_orders`, voir section 21).
- **Modifier les appareils d'un autre utilisateur** : impossible — `UPDATE` a une clause `USING` (sélectionne uniquement ses propres lignes) et `WITH CHECK` (interdit de réécrire une ligne pour qu'elle appartienne à quelqu'un d'autre).
- **Attribuer une eSIM au compte d'un autre utilisateur** : impossible via `user_id` (même mécanisme). Point plus subtil, à connaître : rien n'empêche au niveau DB qu'un utilisateur A insère une ligne dans `app_esim_assignments` avec **son propre** `user_id` mais un `iccid` appartenant réellement à l'eSIM d'un utilisateur B (aucune vérification que l'ICCID appartient à une commande `airalo_orders` de l'e-mail de A). Cela ne permet pas à A de lire les données de B (RLS l'en empêche), mais A pourrait "s'auto-attribuer" un label sur un ICCID qui n'est pas le sien. Voir section 20 (🟠).
- **Injecter arbitrairement un autre `user_id`** : bloqué par les clauses `WITH CHECK` sur INSERT/UPDATE.
- Protection additionnelle allant au-delà de la demande initiale : le trigger `app_validate_ownership` empêche qu'un `traveler_id`/`device_id` référencé dans `app_devices`/`app_esim_assignments` appartienne à un autre `user_id` — même si ce `traveler_id` était un UUID valide appartenant à quelqu'un d'autre, l'`INSERT`/`UPDATE` lève une exception SQL.

Aucune faiblesse structurelle identifiée sur les 3 nouvelles tables, hormis le point ICCID non validé ci-dessus (impact limité, pas de fuite de données).

---

## 6. Liaison avec `airalo_orders`

Le lien se fait **uniquement par la valeur texte de l'ICCID**, jamais par modification de `airalo_orders`.

```text
airalo_orders (table historique, non modifiée)
  sim_iccid = "8943XXXXXXXX1234"
  package_id, expires_at, data_balance, apple_installation_url, ...

                    ↓ (lu en SELECT par email, comme avant)

hooks/useDataUsage.ts, app/(tabs)/index.tsx
  charge la liste des eSIM du compte via airalo_orders.sim_iccid

                    ↓ (recherche par valeur d'ICCID, aucune écriture dans airalo_orders)

hooks/useEsimAssignments.ts → byIccid(iccid)
  cherche dans app_esim_assignments une ligne où iccid = "8943XXXXXXXX1234"

app_esim_assignments
  iccid = "8943XXXXXXXX1234"
  traveler_id = <uuid de app_travelers>
  device_id = <uuid de app_devices, ou null>
  label = "USA • Thomas"
```

`airalo_order_id` (le champ `uuid`, distinct de l'ICCID) est également stocké dans `app_esim_assignments` quand disponible — envoyé par l'app comme `e.id` (le `id` uuid de la ligne `airalo_orders`) — mais **il n'est pas utilisé pour la recherche/jointure applicative actuelle** ; c'est l'ICCID qui sert de clé de recherche (`byIccid()` dans `hooks/useEsimAssignments.ts`). `airalo_order_id` est conservé en traçabilité pour un usage futur éventuel.

**Détection d'une eSIM non attribuée** (`app/(tabs)/index.tsx`) : pour chaque commande de `airalo_orders` chargée, l'app appelle `getAssignment(iccid)` ; si aucune ligne `app_esim_assignments` ne correspond à cet ICCID pour l'utilisateur courant, l'eSIM est affichée comme "Non attribuée" avec un CTA "Attribuer".

---

## 7. Gestion des eSIM existantes

- Les eSIM déjà présentes dans `airalo_orders` **n'ont fait l'objet d'aucune migration, aucun script de rattrapage, aucune écriture**. Elles restent lues exactement comme avant (`SELECT * FROM airalo_orders WHERE email = ...`).
- Elles apparaissent dans l'app exactement comme avant le développement (même requête, même affichage de base), avec en **ajout** : le rattachement voyageur/appareil s'il existe dans `app_esim_assignments`, ou un bandeau "Non attribuée" sinon.
- Une eSIM non attribuée est détectée par **absence** de ligne dans `app_esim_assignments` pour son ICCID — pas par un champ de statut dans `airalo_orders`.
- L'attribution se fait volontairement, écran par écran (`app/esim/assign.tsx`), jamais automatiquement.
- **Confirmé : aucune modification dans `airalo_orders`.** Résultat conforme à l'exigence : *aucune migration destructrice des anciennes commandes*.

---

## 8. Parcours utilisateur implémenté

### Attribution d'une eSIM depuis l'accueil

```text
app/(tabs)/index.tsx  (bloc "Mes eSIM")
↓ eSIM sans ligne dans app_esim_assignments → bandeau "Non attribuee"
↓ tap sur "Attribuer"
app/esim/assign.tsx  (etape 1/3)
↓ selection d'un voyageur existant (app_travelers) ou creation inline ("+ Ajouter une personne")
app/esim/assign.tsx  (etape 2/3)
↓ selection d'un appareil du voyageur (app_devices), creation inline, ou "Je choisirai plus tard"
app/esim/assign.tsx  (etape 3/3)
↓ nom auto-suggere ("USA • Thomas"), modifiable
↓ tap "Confirmer" → assignEsim() → upsert dans app_esim_assignments
app/esim/assign.tsx  (etape 4 : succes)
↓ tap "Retour a l'accueil" → router.replace('/(tabs)')
```

### Attribution après achat

```text
esim/[country].tsx → esim/payment.tsx → Stripe Checkout (externe) →
esim/payment-success.tsx (appelle fenuasim.com/api/create-airalo-order)
↓ si order.sim_iccid disponible : bouton "Attribuer cette eSIM" (→ esim/assign) ou "Plus tard" (→ accueil)
```

Toutes les routes ci-dessus existent réellement dans `app/` et ont été vérifiées par `expo export` (voir section 17).

---

## 9. Voyageurs

| Action | Implémenté | Fichier(s) |
|---|---|---|
| Création | ✅ code écrit | `app/travelers/edit.tsx` (mode sans `id`), `hooks/useTravelers.ts::addTraveler` |
| Modification | ✅ code écrit | `app/travelers/edit.tsx` (mode avec `id`), `hooks/useTravelers.ts::updateTraveler` |
| Suppression | ✅ code écrit | `app/travelers/edit.tsx` (bouton + confirmation `Alert`), `hooks/useTravelers.ts::deleteTraveler` |
| Affichage liste | ✅ code écrit | `app/travelers/index.tsx` |
| Attribution d'eSIM | ✅ code écrit | `app/esim/assign.tsx` (étape 1) |
| Plusieurs voyageurs par compte | ✅ pas de limite dans le code ni la table | — |

Suppression d'un voyageur : les eSIM/appareils qui le référencent passent à `traveler_id = NULL` (`ON DELETE SET NULL`), ils redeviennent "sans voyageur" — pas de suppression en cascade des attributions elles-mêmes.

---

## 10. Appareils

| Action | Implémenté | Fichier(s) |
|---|---|---|
| Création | ✅ code écrit | `app/devices/edit.tsx` (mode sans `id`), `hooks/useDevices.ts::addDevice` |
| Modification | ✅ code écrit | `app/devices/edit.tsx` (mode avec `id`), `hooks/useDevices.ts::updateDevice` |
| Suppression | ✅ code écrit | `app/devices/edit.tsx`, `hooks/useDevices.ts::deleteDevice` |
| Rattachement à un voyageur | ✅ code écrit | sélecteur par "chips" dans `app/devices/edit.tsx` et `app/esim/assign.tsx` |
| Plusieurs appareils | ✅ pas de limite | — |
| Appareil facultatif lors de l'attribution | ✅ | bouton "Je choisirai plus tard" à l'étape 2 de `app/esim/assign.tsx`, `device_id` nullable |

---

## 11. Écran "Mes eSIM"

### `app/(tabs)/index.tsx`
Modifications (diff complet section 15) :
- Import et appel de `useTravelers`, `useDevices`, `useEsimAssignments`
- Pour chaque commande `airalo_orders` affichée : recherche de l'attribution via `getAssignment(iccid)`
- Titre de la carte = `label` de l'attribution si présent, sinon `package_id` (comportement identique à avant si pas d'attribution)
- Nouveau bandeau de chips (icône personne + icône téléphone) affichant le prénom/surnom du voyageur et le nom de l'appareil, si attribués
- Nouveau bandeau "Non attribuée · ••••XXXX" + bouton "Attribuer" si aucune attribution — **seuls les 4 derniers chiffres de l'ICCID sont affichés**, jamais l'ICCID complet
- La jauge de consommation, le statut actif/expiré, le bouton d'installation Apple : **inchangés**

Informations désormais affichées : destination/label, statut, consommation (barre + %), voyageur (chip), appareil (chip), ICCID masqué (4 derniers chiffres, uniquement si non attribuée).

### `app/(tabs)/account.tsx`
Ajout d'une section "Mon profil voyage" avec 3 liens : Mes voyageurs (`/travelers`), Mes appareils (`/devices`), Mes eSIM (renvoie vers l'accueil `/(tabs)`). Aucune donnée `airalo_orders`/`insurances` existante n'a été touchée dans ce fichier, à l'exception d'une icône invalide corrigée (`sim-card-outline` → `hardware-chip-outline`, correction déjà faite lors de la session précédente sur ce même fichier, reconfirmée inchangée ici).

---

## 12. Suivi de consommation

**`hooks/useDataUsage.ts` n'a pas été modifié.** Vérifié explicitement : `git diff` et `git status` sur ce fichier ne retournent aucune sortie — le fichier est strictement identique à avant le développement multi-eSIM.

Chaîne confirmée :

```text
ICCID (airalo_orders.sim_iccid)
↓
hooks/useDataUsage.ts → edge function airalo-proxy (/sims/{iccid}/usage) — inchangée, version 2
↓
usage Airalo (Mo/Go utilisés, restants, illimité ou non)
↓
affiché sur la carte eSIM dans app/(tabs)/index.tsx
↓
la même carte affiche maintenant, en plus (ajout, pas remplacement) :
  voyageur = app_esim_assignments.traveler_id → app_travelers
  appareil = app_esim_assignments.device_id → app_devices
```

Le rattachement voyageur/appareil est un **habillage d'affichage superposé** à la carte existante — la requête de consommation elle-même (appel à `airalo-proxy`) ne dépend d'aucune donnée `app_*` et continue de fonctionner à l'identique, y compris si aucune attribution n'existe.

---

## 13. Achat d'une nouvelle eSIM

```text
Stripe Checkout (externe, inchangé)
↓
esim/payment-success.tsx
  → appelle fenuasim.com/api/create-airalo-order (payload identique à avant)
  → l'eSIM est créée côté Airalo/airalo_orders exactement comme avant
  → order.sim_iccid est récupéré depuis la réponse de cette API (inchangé)
↓
SI order.sim_iccid existe : bouton "Attribuer cette eSIM" proposé (en plus du bouton existant, renommé "Plus tard")
SI l'utilisateur tape "Plus tard" ou back : rien n'est écrit dans app_esim_assignments, l'eSIM reste "non attribuée" et réapparaîtra comme telle sur l'accueil
```

Points de conception importants :
- L'appel `create-airalo-order` (création réelle de l'eSIM) se termine et réussit **avant** que l'UI d'attribution soit même affichée. L'attribution (`assignEsim`) n'est déclenchée que par une action explicite de l'utilisateur sur l'écran `esim/assign.tsx`, qui est un écran séparé, atteint **après** la confirmation de la commande.
- Une erreur dans `app_esim_assignments` (ex. réseau coupé pendant l'attribution) ne peut techniquement pas annuler ou affecter une commande déjà créée dans `airalo_orders` — les deux opérations sont découplées dans le temps et dans le code, aucun `try/catch` commun ne les lie.

**Confirmation :** l'attribution est une surcouche et ne peut pas faire échouer la commande Airalo existante — c'est garanti par construction (séquencement des écrans), pas seulement par un `try/catch` défensif.

---

## 14. Liste exacte des fichiers créés ou modifiés

| Fichier | Créé / Modifié | Rôle |
|---|---|---|
| Migration SQL `app_travelers_devices_esim_assignments` (appliquée via Supabase, pas un fichier du dépôt) | Créé (DDL distant) | 3 tables + RLS + triggers |
| `types/index.ts` | Modifié | Ajout des types `Traveler`, `Device`, `EsimAssignment` |
| `hooks/useTravelers.ts` | Créé | CRUD voyageurs |
| `hooks/useDevices.ts` | Créé | CRUD appareils |
| `hooks/useEsimAssignments.ts` | Créé | CRUD + recherche d'attribution par ICCID |
| `app/travelers/index.tsx` | Créé | Liste des voyageurs |
| `app/travelers/edit.tsx` | Créé | Création / édition / suppression d'un voyageur |
| `app/devices/index.tsx` | Créé | Liste des appareils, groupés par voyageur |
| `app/devices/edit.tsx` | Créé | Création / édition / suppression d'un appareil |
| `app/esim/assign.tsx` | Créé | Flux d'attribution en 3 étapes |
| `app/(tabs)/index.tsx` | Modifié | Enrichissement du bloc "Mes eSIM" |
| `app/(tabs)/account.tsx` | Modifié | Ajout section "Mon profil voyage" |
| `app/esim/payment-success.tsx` | Modifié | Proposition d'attribution après achat |
| `ETAT_DES_LIEUX.md` | Créé (session précédente) | Documentation d'état, non lié au dev multi-eSIM |
| `COMPTE_RENDU_MULTI_ESIM.md` | Créé (ce fichier) | Ce compte-rendu |

Aucun fichier n'a été supprimé.

---

## 15. Fichiers existants modifiés — détail

### `app/(tabs)/index.tsx`
- **Raison** : afficher voyageur/appareil sur les cartes eSIM et l'état "non attribuée"
- **Portée** : ajout de 3 imports de hooks, ajout de variables dérivées (`assignment`, `traveler`, `device`, `cardTitle`, `last4`) dans la boucle `.map()`, ajout de 2 blocs JSX conditionnels, ajout de 6 styles. Aucune ligne existante de logique métier (fetch `airalo_orders`, `useDataUsage`) supprimée ou altérée, à l'exception d'une correction de typage déjà faite lors de la session précédente (`width: pct + '%'` → template literal), reconfirmée présente et inchangée.
- **Risque** : faible — modifications additives, le rendu de base (sans attribution) reste identique à avant.

### `app/(tabs)/account.tsx`
- **Raison** : donner accès aux écrans Voyageurs/Appareils
- **Portée** : ajout d'un bloc JSX (3 liens) entre la liste des assurances et les "Actions rapides", ajout de 2 styles. Rien retiré.
- **Risque** : nul — purement additif.

### `app/esim/payment-success.tsx`
- **Raison** : proposer l'attribution après création réussie de l'eSIM
- **Portée** : renommage d'une variable locale (`pkg` → `pkgData`) pour éviter un conflit avec un nouveau `useState('pkg')`, ajout d'un `setPkg(pkgData)`, ajout d'un bouton conditionnel et modification du texte du bouton existant (`"Retour a l'accueil"` devient `"Plus tard"` uniquement si une eSIM a été créée avec succès, sinon texte inchangé).
- **Risque** : faible — le payload envoyé à l'API externe est strictement identique (mêmes clés, mêmes valeurs, juste une variable renommée côté client). Vérifié ligne à ligne dans le diff (section 2).

### `types/index.ts`
- **Raison** : typage des nouvelles entités
- **Portée** : ajout pur en fin de fichier (3 nouveaux `type`), aucun type existant modifié.
- **Risque** : nul.

---

## 16. Dépendances

**Aucune nouvelle dépendance ajoutée pendant ce développement multi-eSIM.** Aucune commande `npm install` n'a été exécutée dans cette session.

Pour mémoire (session précédente, non liée à cette fonctionnalité) : `@expo/vector-icons` avait été ajouté en dépendance directe car utilisé par le code mais absent de `package.json` — déjà présent avant le début de ce développement, non re-touché ici.

---

## 17. Vérifications techniques

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ Exit code 0, aucune sortie (aucune erreur ni warning) |
| `npx expo export --platform web` | ✅ Succès — "Bundled 30609ms index.ts (841 modules)", bundle unique généré (`dist/`), aucune erreur de résolution de module ni de syntaxe. Ce bundle inclut **toutes** les routes du dossier `app/` (expo-router les découvre automatiquement), donc les 5 nouveaux écrans ont été compilés avec succès. Dossier `dist/` supprimé après vérification (artefact de build, non versionné). |
| `npx expo start --web` (bundle dev, lazy) | ✅ Succès sur deux lancements distincts (908→916 puis 841/854 modules selon le cache) — la variation de compte de modules est due au mode `lazy=true` du bundler dev (routes chargées à la demande), pas à une erreur. Aucune erreur de compilation dans les deux cas. |

Aucune erreur n'a été rencontrée nécessitant une correction pendant cette phase de vérification finale.

---

## 18. Tests fonctionnels réalisés

**Aucun test fonctionnel réel n'a été exécuté** dans cette session : l'environnement ne dispose pas d'outil de pilotage de navigateur (`chromium-cli` indisponible, vérifié) et aucun identifiant de compte de test n'a été fourni. Toutes les colonnes ci-dessous reflètent honnêtement cet état.

| Test | Résultat |
|---|---|
| Login | ⏳ Non testé (code inchangé depuis la session précédente, jamais exécuté avec un vrai compte dans cet environnement) |
| Lecture des eSIM historiques | ⚠️ Requête et schéma vérifiés statiquement (colonnes, RLS confirmées en direct sur Supabase), jamais exécutée avec une session utilisateur réelle |
| Création voyageur | ⏳ Non testé — code écrit, jamais exécuté |
| Création appareil | ⏳ Non testé |
| Attribution eSIM | ⏳ Non testé |
| Modification attribution | ⏳ Non testé (mécanisme `upsert(onConflict: 'user_id,iccid')` vérifié par lecture de code, pas par exécution) |
| Deux eSIM avec même mail | ⏳ Non testé |
| Deux voyageurs différents | ⏳ Non testé |
| Suivi consommation eSIM 1 | ⚠️ Chaîne technique vérifiée (edge function active), non ré-exécutée dans cette session |
| Suivi consommation eSIM 2 | ⏳ Non testé (scénario multi-eSIM jamais déclenché) |
| Déconnexion/reconnexion | ⏳ Non testé |
| Persistance attribution | ⏳ Non testé en conditions réelles (garantie par la persistance Postgres + policy SELECT own, mais jamais vérifiée par un cycle écriture→relecture réel) |
| Achat nouvelle eSIM | ⏳ Non testé (flux Stripe réel non déclenché) |
| Attribution après achat | ⏳ Non testé |

---

## 19. Test spécifique multi-eSIM

**Ce scénario n'a pas été exécuté.** Aucun compte de test (`client@test.com` ou autre) n'a été créé, aucune eSIM USA fictive n'a été attribuée à Thomas ni à Christelle, et l'affichage séparé des deux cartes (consommation distincte par ICCID) n'a pas été vérifié visuellement.

Ce que garantit uniquement la conception du code, sans validation d'exécution :
- La contrainte `UNIQUE(user_id, iccid)` garantit qu'un même ICCID ne peut avoir qu'une seule ligne d'attribution par utilisateur (donc pas de conflit entre deux eSIM différentes du même compte, chacune ayant son propre ICCID).
- `useDataUsage.ts` interroge la consommation par ICCID individuellement (`fetchUsage(iccid)` appelé pour chaque commande dans une boucle), donc deux eSIM du même compte ont chacune leur propre appel et leur propre état de consommation en mémoire — ce mécanisme préexistait et n'a pas été modifié.

**Recommandation explicite : ce scénario doit être exécuté manuellement (ou via une session de test pilotée par navigateur) avant toute mise en production**, avec un vrai compte à deux eSIM.

---

## 20. Risques / anomalies détectées

### 🔴 Critique
- **Aucun test fonctionnel réel effectué.** Le code compile et le schéma DB est correct, mais rien ne prouve à ce stade que le parcours complet (création voyageur → attribution → affichage) fonctionne réellement en conditions d'usage. C'est le principal risque avant mise en production.

### 🟠 Important
- **ICCID non validé contre la propriété réelle de la commande** : `app_esim_assignments.iccid` n'est vérifié contre aucune donnée de `airalo_orders` au niveau base (pas de FK, choix volontaire du brief). Un utilisateur pourrait, en théorie, envoyer n'importe quelle chaîne comme `iccid` (y compris l'ICCID réel d'un autre client) dans sa propre ligne d'attribution. Cela ne permet pas de lire les données d'autrui (RLS l'empêche), mais pollue potentiellement la table avec des associations non vérifiées. Aucune conséquence côté site web ou côté `airalo_orders`.
- **Pas de cache/contexte partagé** : `useTravelers`, `useDevices`, `useEsimAssignments` sont ré-instanciés (et re-fetchent Supabase) à chaque montage d'écran (accueil, compte, assign, travelers, devices). Fonctionnellement correct mais générera des appels réseau redondants à l'usage — non bloquant pour un MVP mais à surveiller si le nombre de voyageurs/appareils grandit.

### 🟡 À améliorer
- Si un voyageur est supprimé, les eSIM qui lui étaient attribuées passent à `traveler_id = NULL`, mais le `label` texte (ex. "USA • Thomas") n'est pas régénéré automatiquement — il peut afficher un prénom qui n'est plus rattaché.
- Pas de pull-to-refresh sur les nouvelles listes (`travelers/index.tsx`, `devices/index.tsx`).
- Pas de test automatisé (unitaire ou end-to-end) pour cette fonctionnalité.

### 🟢 Cosmétique
- `app/travelers/` et `app/devices/` ne suivent pas de `_layout.tsx` dédié — cohérent avec le style déjà en place pour `app/esim/` et `app/insurance/`, mais à mentionner par souci d'exhaustivité.

---

## 21. Alerte sécurité historique — hors périmètre

Re-vérifiée en direct après ce développement : la policy suivante existe **toujours**, inchangée, sur `airalo_orders` :

```text
policyname: "Enable read access for all users"
cmd: SELECT
qual: true
roles: {public}
```

**Risque** : cette policy autorise n'importe quel client (authentifié ou non, avec la seule clé anonyme publique) à lire **l'intégralité** de la table `airalo_orders` — commandes, e-mails clients, ICCID, liens d'installation Apple de tous les clients FENUASIM, pas seulement les siennes. Elle coexiste avec la policy plus restrictive `user reads own esim orders` (`email = auth.jwt()->>'email'`), mais en RLS Postgres, **la policy la plus permissive l'emporte** — donc cette policy `qual: true` neutralise de fait la restriction par e-mail pour la lecture.

**Classement : hors périmètre du développement multi-eSIM.** Cette policy pré-existait avant toute intervention de cette session (confirmée présente dès le premier audit du 23/08, avant tout développement) et n'a été ni créée ni modifiée par ce travail. Elle n'a pas été touchée, conformément à la consigne. Une décision doit être prise séparément par l'équipe FENUASIM sur son maintien ou sa suppression.

---

## 22. Dette technique restante (non traitée dans cette étape)

- `app/esim/confirm.tsx` : écran orphelin (aucune navigation ne pointe vers lui), contenu 100% statique/mock
- Flux `app/insurance/form.tsx` → `app/insurance/confirm.tsx` : UI seule, aucune écriture réelle, données en dur
- `App.tsx` à la racine : fichier mort, jamais utilisé (point d'entrée réel = `index.ts` → `expo-router/entry`)
- Fichier vide `7` à la racine, origine inconnue
- Dépendance `"claude": "^0.1.1"` dans `package.json`, origine non identifiée (présente avant les sessions de développement de cet agent)
- Pas de "mot de passe oublié"
- Bouton "Support" sans action branchée (accueil et compte)
- Avertissements de versions de packages Expo légèrement désynchronisées du SDK 54 (non bloquant, signalé au démarrage de `expo start`)
- Carrousel "Destinations populaires" de l'accueil : liste statique, pas dynamique

Ces points ne sont pas corrigés dans cette étape, conformément à la consigne.

---

## 23. Fonctionnalités volontairement non développées

Confirmé : cette version **ne comprend pas** :
- `app_trips` (voyages) — table non créée
- Famille/groupe avancé
- FenuaSIM Business
- Partage d'une eSIM entre plusieurs comptes
- Détection automatique de l'appareil/eSIM installée (iOS/Android)
- Abonnement
- Fidélité
- Recharge avancée depuis l'app

Rien de tout cela n'a été implémenté, y compris partiellement — l'architecture (tables `app_*` isolées, hooks séparés) permet de les ajouter plus tard sans migration destructrice, mais aucun code ni table ne les anticipe au-delà de cette compatibilité de principe.

---

## 24. Recommandations pour la prochaine version

Par ordre de priorité, sans lancement de développement :

1. **Exécuter le scénario de test multi-eSIM réel** (section 19) avec un compte de test à deux eSIM avant toute mise en production — c'est le risque 🔴 le plus important actuellement.
2. **Trancher sur la policy `airalo_orders` en lecture publique** (section 21) — décision métier/sécurité indépendante de ce développement.
3. **Nettoyer les écrans maquettes** (`esim/confirm.tsx` orphelin, flux assurance non branché) pour éviter toute confusion lors des prochains développements.
4. **Ajouter un partage d'état (contexte React) pour voyageurs/appareils/attributions** afin d'éviter les refetch redondants entre écrans, avant que le nombre d'appels réseau ne devienne perceptible.
5. **Envisager `app_trips`** si le besoin de grouper les eSIM par voyage (plutôt que par voyageur seul) est confirmé par les retours utilisateurs.

---

## 25. Conclusion

```text
STATUT GLOBAL
⚠️ (implémenté et vérifié techniquement, non testé fonctionnellement)

SITE WEB MODIFIÉ
NON

TABLES HISTORIQUES MODIFIÉES
NON

NOUVELLES TABLES APP
app_travelers, app_devices, app_esim_assignments

GESTION MULTI-ESIM
⚠️ (implémenté, non testé en conditions réelles)

GESTION MULTI-VOYAGEURS
⚠️ (implémenté, non testé en conditions réelles)

GESTION APPAREILS
⚠️ (implémenté, non testé en conditions réelles)

SUIVI CONSOMMATION CONSERVÉ
✅ (hooks/useDataUsage.ts confirmé inchangé, edge function airalo-proxy confirmée inchangée)

RLS NOUVELLES TABLES
✅ (vérifié par introspection SQL directe post-développement : auth.uid() = user_id sur les 4 opérations, 3 tables)

TYPESCRIPT
✅ (tsc --noEmit : exit 0, aucune erreur)

BUILD EXPO/METRO
✅ (expo export --platform web : succès, 841 modules, aucune erreur)

PRÊT POUR TEST UTILISATEUR
OUI (le code est prêt à être testé ; il n'a pas encore été testé)
```
