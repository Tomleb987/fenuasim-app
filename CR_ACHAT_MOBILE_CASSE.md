# Achat eSIM mobile — chaîne de livraison cassée

_2026-09-04. Constats vérifiés en direct (appels réels aux endpoints, lecture des Edge Functions
déployées, requêtes SQL). Aucune modification de code ni de configuration n'a été faite._

## 1. Ce qui s'est passé

Paiement réel de 1,00 € effectué depuis le build 5 sur le compte
`fenuasim.qa.applereview@example.com`. Stripe a encaissé. **Aucune eSIM n'a été créée**, et l'app
a affiché un écran d'erreur.

## 2. Les quatre maillons, testés un par un

| # | Maillon | État | Preuve |
|---|---|---|---|
| 1 | `create-checkout-mobile` crée la session Stripe | ✅ | `sessionId` = `cs_live_…` |
| 2 | Retour dans l'app via `fenuasim://payment-success` | ✅ | l'écran s'affiche |
| 3 | L'app appelle `fenuasim.com/api/create-airalo-order` | ❌ | **401 Unauthorized** |
| 4 | Le webhook Stripe crée la commande côté serveur | ❌ | aucune ligne dans `orders` |

### Maillon 3 — l'appel de l'app est rejeté

`app/esim/payment-success.tsx:66` envoie un POST avec pour seul en-tête `Content-Type`.
Testé à l'instant sur l'endpoint réel :

- sans en-tête d'autorisation → `401 {"error":"Unauthorized"}`
- avec le JWT Supabase de l'utilisateur → `403 {"error":"Forbidden"}`

L'endpoint attend un secret ou un rôle privilégié que l'app n'a pas et ne doit pas avoir.
Accessoirement, l'app appelle `fenuasim.com` sans `www`, ce qui provoque une redirection 307
vers `www.fenuasim.com` (le chat IA, lui, utilise bien `www.`).

### Maillon 4 — le webhook ne peut pas prendre le relais

Deux défauts indépendants, l'un et l'autre bloquants :

**a) Le webhook n'a pas été déclenché.** Aucune ligne dans `orders` pour ce paiement. Cause la
plus probable : les endpoints webhook Stripe sont propres à chaque mode. Le passage de la clé en
`live` aujourd'hui n'a pas créé d'endpoint webhook live, et `STRIPE_WEBHOOK_SECRET` est
vraisemblablement resté celui du mode test — auquel cas la vérification de signature échouerait
même si un événement arrivait.

**b) Même déclenché, il ne créerait aucune eSIM.** `handleCheckoutSession` insère la commande
dans `orders` puis empile une tâche dans **`sync_queue`** — table qui **n'existe pas**
(`to_regclass('public.sync_queue')` → `null`). L'insertion échoue, et son erreur n'est même pas
vérifiée. Ce constat confirme la Phase 4D.

### La fonction Supabase homonyme est désactivée volontairement

L'Edge Function `create-airalo-order` existe mais renvoie `410`. Elle a été neutralisée le
2026-08-24 (Phase 4E) parce qu'elle créait une commande Airalo **facturée** pour n'importe quel
appelant authentifié, sans vérification de paiement. **Ne pas la réactiver** : ce serait rouvrir
une faille permettant à un client de se faire livrer des eSIM sans payer.

## 3. Portée

L'app mobile n'a jamais été distribuée publiquement (TestFlight uniquement) : **aucun client réel
n'est affecté**. Le site `fenuasim.com` a son propre chemin de livraison, décrit comme
fonctionnel dans le commentaire de la Phase 4E (`createAiraloOrder()` dans
`src/lib/airaloOrderCreation.ts`), et n'est pas concerné.

Le seul débit à traiter est le 1,00 € du test, à rembourser depuis le tableau de bord Stripe.

## 4. Effet de bord du passage en live à surveiller

`STRIPE_SECRET_KEY` est un secret **partagé par toutes les Edge Functions** du projet :
`create-checkout`, `create-checkout-mobile`, `create-topup-checkout` et `stripe-webhook`. Le
basculer en live a donc aussi fait passer le parcours de **recharge d'eSIM** en live. C'est
probablement souhaitable, mais ce n'était pas explicite au moment du changement, et le webhook
de recharge — lui, fonctionnel — dépend du même `STRIPE_WEBHOOK_SECRET` potentiellement obsolète.

## 5. Correction proposée — reproduire ce qui marche déjà

La recharge d'eSIM (Phase 4F) fonctionne de bout en bout, entièrement dans Supabase, sans
dépendre du site. Son architecture est le modèle à copier :

1. **Table `esim_purchase_orders`** calquée sur `esim_topup_orders` : `stripe_session_id` unique,
   statuts `pending_payment → paid → processing → completed | failed`. C'est ce qui donne
   l'idempotence — `airalo_orders` n'a aucune colonne `stripe_session_id`, donc aucun moyen
   aujourd'hui de reconnaître un rejeu.
2. **`create-checkout-mobile`** écrit la ligne `pending_payment` avant de rendre l'URL Stripe.
   Fonction propre au mobile, rayon d'action nul sur le site.
3. **`stripe-webhook`** reçoit une branche `metadata.source === 'mobile_app'`, exactement comme
   la branche `mobile_topup` ajoutée sans toucher au chemin historique. Réclamation atomique,
   appel Airalo `POST /v2/orders`, puis insertion dans `airalo_orders` — ainsi tous les écrans
   existants de l'app fonctionnent sans modification.
4. **`app/esim/payment-success.tsx`** cesse d'appeler le site et se contente d'interroger le
   statut de la commande. L'app ne déclenche plus rien : elle constate.

**Prérequis, côté tableaux de bord (vous) :** créer l'endpoint webhook Stripe en mode **live**
pointant vers la fonction `stripe-webhook`, et mettre son secret de signature dans
`STRIPE_WEBHOOK_SECRET`.

## 6. Autorisation nécessaire avant d'agir

Le point 3 modifie `stripe-webhook`, fonction **partagée avec le site**. C'est le seul élément à
fort rayon d'action de la proposition. Rien ne sera touché sans accord explicite.

## 7. Conséquence immédiate sur la soumission Apple

La vidéo est suspendue. Elle doit montrer un achat qui aboutit à un QR code — impossible tant
que la livraison ne fonctionne pas. Et une app qui encaisse sans livrer serait de toute façon
rejetée, cette fois à juste titre.

---

# Correction appliquée — 2026-09-04

Autorisée explicitement par l'utilisateur (modification de `stripe-webhook`, fonction partagée).

## Ce qui a été déployé

| Élément | Action | Vérification |
|---|---|---|
| Table `esim_purchase_orders` | créée (migration `create_esim_purchase_orders`) | RLS activée, 1 policy SELECT propriétaire, `stripe_session_id` UNIQUE |
| `create-checkout-mobile` | v5 — authentifie l'appelant, écrit la ligne `pending_payment` avant Stripe | testé : session `cs_live_…` + ligne créée ; appel non authentifié → `401` |
| `stripe-webhook` | v42 — branche `source === 'mobile_app'` ajoutée | chemins site et recharge laissés strictement inchangés |
| `app/esim/payment-success.tsx` | ne déclenche plus rien, interroge le statut | `tsc` passe ; plus aucun appel au site |

## Faille corrigée au passage

`create-checkout-mobile` prenait `customerEmail` **dans le corps de la requête**, sans le
recouper avec le compte connecté. N'importe quel compte authentifié pouvait donc faire livrer une
eSIM à l'adresse d'un tiers, ou salir l'historique d'un autre client — `airalo_orders` étant
indexée par email. L'identité vient désormais du JWT, et d'aucune autre source.

## Isolation vérifiée sur la nouvelle table

| Test | Résultat |
|---|---|
| Le propriétaire lit sa commande | 1 ligne ✅ |
| Un appelant anonyme lit les commandes | 0 ligne ✅ |
| Le propriétaire tente d'écrire une ligne | `HTTP 403` ✅ |

Seules les Edge Functions écrivent, via `service_role`. Un client ne peut ni créer une commande,
ni la faire avancer vers un statut livré.

Ligne de test supprimée après vérification : `esim_purchase_orders` est à 0 ligne.

## Ce qui reste — et qui bloque encore la livraison

**L'endpoint webhook Stripe en mode live n'existe pas.** Sans lui, aucun événement n'atteint la
fonction et rien ne sera jamais livré. À créer dans le tableau de bord Stripe, **en mode live** :

- URL : `https://hptbhujyrhjsquckzckc.supabase.co/functions/v1/stripe-webhook`
- Événement minimal : `checkout.session.completed`
- Puis coller le secret de signature (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET`
  (Supabase → Edge Functions → Secrets)

Attention : ce secret est partagé avec le parcours de recharge, lui aussi passé en live ce matin.

## Non testé

La seconde moitié de la chaîne — webhook reçu, appel Airalo, insertion dans `airalo_orders` —
n'a pas pu être vérifiée : elle exige un endpoint webhook live et un vrai paiement. Le premier
achat réel après configuration fera office de test, et doit être surveillé.
