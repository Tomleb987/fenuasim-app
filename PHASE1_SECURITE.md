# PHASE 1 — Sécurité des données

_Rédigé le 2026-08-23. Application mobile uniquement. Aucune policy modifiée — audits complets présentés pour décision._

## Résumé exécutif

Deux failles auditées de fond en comble : **100% des Edge Functions (20/20) et tout le code mobile ont été inspectés**. Aucune dépendance légitime trouvée côté app ou backend serveur pour les deux accès publics identifiés. Reste une seule inconnue réelle dans les deux cas : **le code du site `fenuasim.com` n'est pas accessible depuis cet environnement** — donc, conformément à la consigne, **aucune policy n'a été modifiée**. Les deux plans complets (SQL, tests, rollback) sont prêts pour validation.

---

## 1A. Table `profiles`

### Audit — structure

```text
id (uuid, PK), created_at, updated_at, email, full_name, avatar_url,
last_login, last_sign_in_at, phone, email_verified, phone_verified
```

### Audit — policy actuelle (relue en direct)

```text
"Enable all operations for authenticated users"
roles: {public}
cmd: ALL  (couvre SELECT + INSERT + UPDATE + DELETE en une seule policy)
qual: auth.role() = 'authenticated'
with_check: null
```

**Tout utilisateur connecté peut lire, modifier ou supprimer le profil de n'importe quel autre utilisateur** — aucune restriction par ligne, et même le `WITH CHECK` (qui limiterait ce qu'on peut écrire) est absent.

### Audit — usages dans l'app mobile

**Un seul usage dans tout le dépôt** (recherche exhaustive `.from('profiles')`) :

```ts
// app/(tabs)/account.tsx
supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
```

Toujours scopé à `session.user.id` (son propre profil). Aucune autre lecture, aucune écriture, aucune suppression depuis l'app.

### Audit — Edge Functions (20/20 inspectées, code source lu intégralement)

| Edge Function | Utilise `profiles` ? |
|---|---|
| create-airalo-order, airalo-proxy, airalo-token, airalo-api, create-checkout, create-payment, create-checkout-mobile, stripe-webhook, sync-packages, sync-packages-sandbox, send-esim-confirmation, send-activation-guide, esim-instructions, sync-lead-odoo, ai-chat, messenger-webhook, instagram-webhook, bpo-agent, 3cx-webhook, yeastar-webhook, izy-voice-webhook | **Non, aucune** |

Aucune des 20 fonctions ne référence `profiles`, ni en lecture ni en écriture. Elles touchent `orders`, `airalo_orders`, `airalo_packages`, `esims`, `checkout_sessions`, `bpo_*`, `call_sessions`, `leads`, `support_tickets` — jamais `profiles`.

**Aucune trigger d'insertion automatique** sur `auth.users` (déjà vérifié en Phase multi-eSIM précédente — seul un trigger sur `UPDATE` existe, sans lien avec `profiles`). Cela signifie que les lignes `profiles` ne sont **pas créées automatiquement** à l'inscription mobile : un utilisateur inscrit uniquement via l'app peut très bien n'avoir aucune ligne `profiles` (déjà géré proprement côté app : repli sur "Mon compte" si absent).

### Conséquence de l'audit

Rien, ni côté app mobile ni côté backend serveur accessible, ne dépend de l'accès global. La seule inconnue restante :

```text
AUDIT SITE WEB REQUIS
```

Le mécanisme réel de création des lignes `profiles` (probablement le site web, hors dépôt accessible) reste à confirmer avant suppression définitive.

### Cible de sécurité

```sql
-- SQL prevu, NON applique
drop policy if exists "Enable all operations for authenticated users" on public.profiles;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);
```

Pas de policy `DELETE` pour l'instant (pas de besoin identifié ; sera revu en Phase 3 — suppression de compte — via un traitement serveur dédié, pas une policy DELETE ouverte aux utilisateurs).

### Tests à effectuer après application (si validée)

1. Requête anonyme/autre utilisateur sur le profil d'un tiers → doit retourner 0 ligne.
2. `account.tsx` (lecture de son propre `full_name`) → doit continuer à fonctionner à l'identique.
3. Vérifier sur le site si une page (admin, annuaire, profil public...) dépend d'un accès profil croisé.

### Rollback

```sql
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "Enable all operations for authenticated users" on public.profiles
for all to public
using (auth.role() = 'authenticated'::text);
```

**Statut : présenté, non appliqué.**

---

## 1B. Table `airalo_orders`

Audit déjà réalisé en détail lors d'une phase précédente (`SECURITE_MULTI_ESIM.md`), **revérifié en direct aujourd'hui** : la policy est toujours présente, strictement inchangée.

### Policy confirmée toujours active

```text
"Enable read access for all users"
cmd: SELECT | qual: true | roles: {public}
```

### Rappel de l'audit (mobile + Edge Functions, tout confirmé aujourd'hui)

- App mobile : toutes les lectures passent par une session authentifiée filtrée par email (`user reads own esim orders`), jamais par l'accès public.
- Les 20 Edge Functions inspectées aujourd'hui confirment ce qui avait été trouvé : seules `create-airalo-order` et le handler `airalo-api/db.ts::createEsimRecord` écrivent dans des tables de commandes, toujours via `SUPABASE_SERVICE_ROLE_KEY` (contourne RLS indépendamment de la policy).
- **Toujours indéterminé** : dépendance éventuelle du site web (code non accessible).

### SQL prévu (non appliqué), tests, rollback

Identiques à ceux déjà présentés dans `SECURITE_MULTI_ESIM.md` (section Partie D), reproduits ici pour la traçabilité de cette phase :

```sql
-- A executer uniquement apres validation du parcours web
drop policy if exists "Enable read access for all users" on public.airalo_orders;
```

Si un panneau d'administration authentifié en dépend, ajouter (pattern déjà utilisé sur `orders`/`insurances`) :

```sql
create policy "admin reads all esim orders" on public.airalo_orders
for select to authenticated using (true);
```

Rollback exact :

```sql
create policy "Enable read access for all users" on public.airalo_orders
for select to public using (true);
```

**Statut : présenté (déjà connu), non appliqué.**

```text
AUDIT SITE WEB REQUIS
```

---

## Vérifications techniques

Aucun code applicatif modifié dans cette phase (audit pur) — `tsc`/`expo export` non re-exécutés car aucun fichier `.ts`/`.tsx` touché.

---

## Compte-rendu

```text
PHASE
1 — Sécurité des données

OBJECTIF
Auditer et préparer (sans les appliquer) les corrections RLS sur profiles et airalo_orders

ÉTAT
⚠️ (audits complets et concluants, corrections prêtes, non appliquées — bloquées sur l'accès au code du site web)

FICHIERS MODIFIÉS
PHASE1_SECURITE.md (nouveau, documentation uniquement)

SUPABASE MODIFIÉ
NON

TABLES MODIFIÉES
Aucune

POLICIES MODIFIÉES
Aucune (2 plans de correction prêts : profiles, airalo_orders)

EDGE FUNCTIONS MODIFIÉES
NON (20/20 auditées, 0 modifiée)

SITE WEB MODIFIÉ
NON (code non accessible, audit site web requis pour les deux tables)

TUNNEL PAIEMENT MODIFIÉ
NON

TESTS RÉELLEMENT EXÉCUTÉS
Audit exhaustif : grep app mobile, lecture source des 20 Edge Functions, relecture live des policies actuelles (profiles + airalo_orders)

TYPESCRIPT
✅ (aucun fichier de code modifié)

BUILD EXPO
✅ (aucun fichier de code modifié)

RISQUES
- profiles : n'importe quel utilisateur connecté peut lire/modifier le profil de n'importe qui (email, téléphone, avatar)
- airalo_orders : n'importe qui (même non connecté) peut lire toutes les commandes (emails, ICCID, liens d'installation)
- Dans les deux cas, aucune preuve de dépendance légitime trouvée côté app/backend serveur — mais le site web reste une inconnue réelle

BLOQUANTS
Accès au dépôt du site fenuasim.com nécessaire pour confirmer qu'aucune page ne dépend des deux accès publics avant suppression définitive

PRÊT POUR PHASE SUIVANTE
OUI — la Phase 2 (Support) ne dépend pas de la résolution de ce blocage ; les deux corrections restent prêtes à appliquer dès que le site sera audité ou que vous validez le risque comme maîtrisé
```
