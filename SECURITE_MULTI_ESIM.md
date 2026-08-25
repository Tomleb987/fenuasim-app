# Phase sécurité — validation ICCID + audit `airalo_orders`

_Rédigé le 2026-08-23. Tests exécutés réellement (comptes Supabase jetables, vraies requêtes PostgREST/RPC), tous supprimés en fin de session. Aucune régression introduite sur le site web : `airalo_orders` n'a subi qu'une insertion puis suppression de 2 lignes de test temporaires (données, pas structure), la policy publique n'a **pas** été touchée (conformément à la consigne)._

---

# PARTIE A — Audit d'impact `airalo_orders`

## 1. Dépendances identifiées (code accessible)

**Limite à annoncer d'emblée : ce dépôt ne contient pas le code du site `fenuasim.com`** (Next.js, hébergé séparément). L'audit ci-dessous couvre tout ce qui est réellement accessible — l'app mobile et les Edge Functions Supabase — et est honnête sur ce qui reste **indéterminé** côté site.

| Emplacement | Lecture/écriture | Authentifié ? | Dépend de la policy publique ? | Risque si suppression |
|---|---|---|---|---|
| `hooks/useUserData.ts:23` (app mobile) | Lecture (`.select('*').eq('email', userEmail)`) | Oui (session Supabase active) | **Non** — passe par `user reads own esim orders` (email = JWT) | Aucun |
| `app/(tabs)/index.tsx` (app mobile, bloc "Mes eSIM") | Lecture (`.eq('email', session.user.email)`) | Oui | **Non** | Aucun |
| Edge Function `create-airalo-order` (source inspectée) | Écriture (`insert`) | N/A — utilise `SUPABASE_SERVICE_ROLE_KEY` | **Non** — le service role contourne RLS indépendamment des policies | Aucun |
| Edge Function `airalo-proxy` (source inspectée) | Ne touche pas `airalo_orders` (interroge l'API Airalo directement par ICCID) | N/A | Non concerné | Aucun |
| Edge Function `stripe-webhook` (source inspectée) | Écrit dans `orders` et `payments`, jamais dans `airalo_orders` | N/A — service role | Non concerné | Aucun |
| Edge Function `send-esim-confirmation`, `esim-instructions` (source inspectée) | Ne touchent pas `airalo_orders` | N/A | Non concerné | Aucun |
| RPC `app_assign_esim` (créée aujourd'hui, Partie B) | Lecture seule, `SECURITY DEFINER` | Oui, mais contourne RLS par conception (nécessaire) | **Non** — un `SECURITY DEFINER` continue de lire la table quelle que soit la policy | Aucun |
| **Site web `fenuasim.com` (Next.js)** | **Inconnu — code non accessible depuis cet environnement** | **Indéterminé** | **INDÉTERMINÉ** | **Inconnu, voir ci-dessous** |

## Parcours "Paiement → retour Stripe → page de succès" : dépend-il d'un accès anonyme ?

Je ne peux pas l'affirmer avec certitude (code du site non accessible), mais un indice architectural fort a été trouvé : la table sœur `orders` possède une policy `"read order by session_id"` (`roles: {anon}`, `qual: true`) — c'est-à-dire un accès anonyme **existant et déjà utilisé** pour ce type de parcours, mais scindé par nature de la table `orders`. **`airalo_orders` n'a aucun équivalent scopé** : sa policy publique est un `qual: true` généralisé, sans restriction par `session_id` ou autre clé non devinable. Si le site avait besoin d'un accès invité équivalent spécifiquement pour `airalo_orders` (ICCID, lien d'installation), on s'attendrait à trouver le même type de policy scopée que sur `orders` — **elle n'existe pas**. Cela suggère que la policy `qual: true` sur `airalo_orders` est probablement un oubli plutôt qu'une fonctionnalité voulue, mais ce n'est qu'une déduction, pas une preuve.

**Deuxième risque identifié, plus concret** : contrairement à `orders` et `insurances`, `airalo_orders` **n'a pas** de policy `"admin reads all orders"` (`roles: {authenticated}`, `qual: true`). Si un panneau d'administration interne lit `airalo_orders` avec un compte authentifié (staff) dont l'e-mail ne correspond pas à celui du client, **il dépend forcément aujourd'hui de la policy publique** puisqu'aucune autre policy ne l'autoriserait. C'est le risque de régression le plus probable si la policy est supprimée sans vérification préalable.

## 2. Policies actuelles sur `airalo_orders` (relu en direct)

| Policy | Rôle | Commande | USING (`qual`) | WITH CHECK |
|---|---|---|---|---|
| `Service role can insert orders` | `public` | INSERT | — | `null` (aucune restriction visible dans `pg_policies`, à traiter comme permissive) |
| `user reads own esim orders` | `public` | SELECT | `email = (auth.jwt() ->> 'email')` | — |
| `Enable read access for all users` | `public` | SELECT | `true` | — |

`user reads own esim orders` fonctionne en comparant la colonne `email` de la ligne au champ `email` du JWT de la requête (`auth.jwt()->>'email'`) — donc un utilisateur authentifié dont l'adresse e-mail correspond à celle enregistrée sur la commande peut la lire. **En RLS Postgres, plusieurs policies `SELECT` sur la même table sont combinées en `OR`** : tant que `Enable read access for all users` (`qual: true`) existe, elle rend `user reads own esim orders` totalement inopérante pour la restriction — n'importe qui peut lire n'importe quelle ligne, avec ou sans le filtre par e-mail.

## 3. Cible de sécurité (conçue, non appliquée)

```text
Utilisateur non authentifié  → aucune lecture de airalo_orders
Utilisateur authentifié      → uniquement ses propres commandes (email = JWT)
Backend serveur (service_role) → accès complet, déjà le cas aujourd'hui, inchangé
RPC app_assign_esim (SECURITY DEFINER) → lecture seule ciblée, déjà en place, inchangée par cette modification
```

## 4. Si le site dépend réellement d'une lecture anonyme

**Non appliqué.** Recommandation si un besoin réel est confirmé côté site : ne jamais revenir à `qual: true`. Utiliser un accès scopé par une clé non devinable, sur le modèle déjà en place sur `orders` (`read order by session_id`) : par exemple une policy `SELECT` filtrée sur une colonne de corrélation Stripe non prédictible, ou mieux, faire porter cet accès invité par une route serveur (API Next.js du site, avec `SUPABASE_SERVICE_ROLE_KEY` côté serveur uniquement) plutôt que par une lecture directe client-side avec la clé anon — c'est l'option la plus simple et la plus cohérente avec l'architecture existante (le site a déjà des routes API serveur, ex. `create-airalo-order`).

---

# PARTIE B — Validation serveur des ICCID

## 5–8. RPC `app_assign_esim` — implémentée et déployée

Migration appliquée : `app_assign_esim_rpc`, sur le projet `hptbhujyrhjsquckzckc`. SQL exact :

```sql
create or replace function public.app_assign_esim(
  p_iccid text,
  p_airalo_order_id uuid default null,
  p_traveler_id uuid default null,
  p_device_id uuid default null,
  p_label text default null
)
returns public.app_esim_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_result public.app_esim_assignments;
begin
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  if p_iccid is null or length(trim(p_iccid)) = 0 then
    raise exception 'ICCID invalide' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.airalo_orders o
    where o.sim_iccid = p_iccid
      and lower(o.email) = lower(coalesce(v_email, ''))
  ) then
    raise exception 'Cette eSIM ne correspond a aucune commande de ce compte' using errcode = '42501';
  end if;

  if p_traveler_id is not null then
    if not exists (
      select 1 from public.app_travelers t
      where t.id = p_traveler_id and t.user_id = v_user_id
    ) then
      raise exception 'Ce voyageur n''appartient pas a ce compte' using errcode = '42501';
    end if;
  end if;

  if p_device_id is not null then
    if not exists (
      select 1 from public.app_devices d
      where d.id = p_device_id and d.user_id = v_user_id
    ) then
      raise exception 'Cet appareil n''appartient pas a ce compte' using errcode = '42501';
    end if;
  end if;

  insert into public.app_esim_assignments (user_id, airalo_order_id, iccid, traveler_id, device_id, label)
  values (v_user_id, p_airalo_order_id, p_iccid, p_traveler_id, p_device_id, p_label)
  on conflict (user_id, iccid) do update set
    airalo_order_id = excluded.airalo_order_id,
    traveler_id = excluded.traveler_id,
    device_id = excluded.device_id,
    label = excluded.label,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.app_assign_esim(text, uuid, uuid, uuid, text) from public;
grant execute on function public.app_assign_esim(text, uuid, uuid, uuid, text) to authenticated;

revoke insert, update on public.app_esim_assignments from authenticated;
revoke insert, update on public.app_esim_assignments from anon;
```

Points clés, conformes à la demande :
- `user_id` n'est **jamais** un paramètre — la fonction le déduit exclusivement de `auth.uid()`, impossible à falsifier depuis le frontend.
- `SECURITY DEFINER` + `SET search_path = public, pg_temp` : bonne pratique standard, empêche un détournement du chemin de recherche de schéma.
- **Au-delà de la demande initiale** : j'ai révoqué les privilèges `INSERT`/`UPDATE` directs sur `app_esim_assignments` pour `authenticated` et `anon` (confirmé par `information_schema.role_table_grants` — seuls `SELECT`/`DELETE` restent). Sans cela, un appel direct à `.from('app_esim_assignments').upsert(...)` depuis l'app (ou n'importe quel client REST) aurait continué à fonctionner en contournant totalement la RPC — la vulnérabilité serait restée ouverte pour quiconque n'utilise pas le code de l'app tel quel. Cette extension est documentée ici explicitement pour que vous puissiez la remettre en cause si elle n'était pas voulue.
- Permissions d'exécution limitées au rôle `authenticated` uniquement (`revoke all from public` puis `grant ... to authenticated`).

## 9. `hooks/useEsimAssignments.ts` — modifié

`assignEsim()` appelle désormais `supabase.rpc('app_assign_esim', {...})` au lieu de `.from('app_esim_assignments').upsert(...)`. Les lectures (`fetchAssignments`, `byIccid`) restent un `.select('*')` classique sous RLS, inchangées, comme demandé.

## 10. Test de sécurité — 6 cas, exécutés réellement

Deux comptes réels créés (`fenuasim.qa.rpc.a.…`, `fenuasim.qa.rpc.b.…`), avec un voyageur et un appareil chacun, et **une commande réelle temporaire par compte** insérée dans `airalo_orders` (nécessaire pour tester "ICCID appartenant à A/B" — impossible autrement) puis **supprimée immédiatement après le test** (confirmé : 0 ligne restante).

| Cas | Attendu | Obtenu | Conforme |
|---|---|---|---|
| 1 — ICCID de A + session A | ✅ autorisé | ✅ autorisé | ✅ |
| 2 — ICCID de B + session A | ❌ refusé | ❌ refusé (*"Cette eSIM ne correspond a aucune commande de ce compte"*) | ✅ |
| 3 — ICCID inexistant | ❌ refusé | ❌ refusé (même message, cohérent) | ✅ |
| 4 — ICCID de A + voyageur de B | ❌ refusé | ❌ refusé (*"Ce voyageur n'appartient pas a ce compte"*) | ✅ |
| 5 — ICCID de A + appareil de B | ❌ refusé | ❌ refusé (*"Cet appareil n'appartient pas a ce compte"*) | ✅ |
| 6 — ICCID de A + aucun appareil | ✅ autorisé | ✅ autorisé | ✅ |
| Bonus — écriture directe (contournement RPC) | ❌ refusé | ❌ refusé (*"permission denied for table app_esim_assignments"*) | ✅ |

**6/6 cas conformes, plus la vérification que le contournement de la RPC est bien bloqué.**

---

# PARTIE C — Validation réelle de l'application

## 11. Test sur appareil réel / simulateur

**⏳ Non réalisé.** Aucun navigateur ni simulateur pilotable n'est disponible dans cet environnement (confirmé : pas de `chromium-cli`, pas d'accès à un simulateur iOS/Android). Les écrans listés (connexion, accueil, Mes eSIM, voyageur, appareil, attribution, modification, suppression, eSIM non attribuée, retour après fermeture) n'ont **jamais été vus à l'écran**, ni dans cette phase ni dans les précédentes. C'est un vrai bloquant pour la mise en production, pas une formalité — voir conclusion.

## 12. Test avec 2 vraies eSIM Airalo

**⏳ Non réalisé.** Nécessite un compte FENUASIM réel avec deux eSIM Airalo effectivement achetées et actives — aucun paiement réel n'a été déclenché dans cette session (aucune raison de dépenser de l'argent réel juste pour ce test, et aucun mode test Stripe confirmé disponible pour ce projet). Ce test reste à faire manuellement.

---

# PARTIE D — Plan pour `airalo_orders` (non appliqué)

Conformément à la consigne, **rien n'a été exécuté**. Voici les 4 éléments demandés avant toute décision :

### 1. SQL exact envisagé

```sql
-- A exécuter uniquement après validation du parcours web (voir ci-dessous)
drop policy if exists "Enable read access for all users" on public.airalo_orders;
```

Si l'audit du site confirme qu'un panneau d'administration authentifié (mais avec un e-mail différent du client) a besoin de lire toutes les commandes, ajouter en complément (pattern identique à `orders`/`insurances`, rien de nouveau architecturalement) :

```sql
create policy "admin reads all esim orders" on public.airalo_orders
for select
to authenticated
using (true);
```

### 2. Parcours web concernés (à vérifier par vous ou l'équipe site, code non accessible ici)

- Toute page de confirmation de commande eSIM affichée **sans session utilisateur active** (parcours invité) après retour de Stripe.
- Tout panneau d'administration/support interne qui affiche des commandes eSIM d'un client autre que l'utilisateur connecté.
- Toute intégration tierce (CRM, outil support) qui interrogerait directement Supabase avec la clé anon.

### 3. Tests à effectuer après modification

1. Immédiatement : relancer une requête anonyme (clé anon seule, sans session) sur `airalo_orders` → doit retourner 0 ligne.
2. Tester en navigation privée le parcours complet d'achat d'eSIM sur `fenuasim.com` jusqu'à la page de confirmation → doit toujours afficher les bonnes informations.
3. Vérifier qu'un panneau d'administration existant (s'il y en a un) peut toujours lister les commandes des clients.
4. Vérifier que l'app mobile (accueil, compte) continue de fonctionner (elle est authentifiée, ne devrait pas être affectée — déjà confirmé par l'audit Partie A).
5. Vérifier que la création de commande (edge function `create-airalo-order`, `stripe-webhook`) continue de fonctionner (utilise le service role, ne devrait pas être affectée).

### 4. Rollback prévu

```sql
create policy "Enable read access for all users" on public.airalo_orders
for select
to public
using (true);
```

(Recrée exactement la policy actuelle, à l'identique — capturé depuis `pg_policies` avant toute modification.)

**Statut : présenté, non exécuté. En attente de votre validation, en particulier sur le point admin (section 1) que je ne peux pas trancher sans voir le code du site.**

---

# Compte-rendu — analysé / implémenté / testé

| Élément | Statut |
|---|---|
| Audit des dépendances `airalo_orders` (code accessible) | Analysé |
| Dépendance du site web à la policy publique | Analysé, **indéterminé** (code du site non accessible) |
| RPC `app_assign_esim` | Implémenté et testé réellement |
| Verrou des écritures directes sur `app_esim_assignments` | Implémenté et testé réellement |
| `hooks/useEsimAssignments.ts` basculé vers la RPC | Implémenté, vérifié par `tsc`/`expo export` |
| 6 cas de sécurité RPC | Testés réellement, 6/6 conformes |
| Plan de sécurisation `airalo_orders` | Analysé et rédigé, **non implémenté** |
| Test UI sur appareil réel | Non testé (pas d'outil disponible) |
| Test avec 2 vraies eSIM Airalo | Non testé (pas de paiement réel déclenché) |

---

## Conclusion

```text
RPC VALIDATION ICCID
✅

ICCID AUTRE UTILISATEUR BLOQUÉ
✅

ICCID FICTIF BLOQUÉ
✅

VALIDATION VOYAGEUR
✅

VALIDATION APPAREIL
✅

RLS APP_*
✅ (inchangée sur SELECT/DELETE, écriture directe désormais bloquée en plus)

FAILLE AIRALO_ORDERS
CONFIRMÉE (re-testée aujourd'hui, toujours présente — non corrigée volontairement, voir Partie D)

DÉPENDANCE DU SITE À LA POLICY PUBLIQUE
INDÉTERMINÉE (code du site non accessible depuis cet environnement ; un risque concret identifié : un éventuel panneau d'administration authentifié)

SITE WEB MODIFIÉ
NON

TABLE AIRALO_ORDERS MODIFIÉE
NON (structure et policies inchangées ; 2 lignes de test insérées puis supprimées pendant la validation, 0 trace restante)

POLICY AIRALO_ORDERS MODIFIÉE
NON

TEST UI APPAREIL RÉEL
⏳ (aucun outil de pilotage disponible dans cet environnement)

TEST 2 VRAIES ESIM AIRALO
⏳ (nécessite un achat réel, non déclenché)

PRÊT POUR PRODUCTION
NON — la couche serveur (RLS, RPC, isolation, validation ICCID) est maintenant testée et solide,
mais aucun écran n'a jamais été vu à l'écran, et la policy airalo_orders reste une faille ouverte
en attendant une décision sur la dépendance du site.
```
