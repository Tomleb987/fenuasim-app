```text
PHASE
4F — ESIM TOPUP

ÉTAT
✅ (architecture + sécurité livrées et testées ; recette bout-en-bout avec vrai paiement volontairement non faite, cf FINANCE)


================================
MOBILE
================================

REPO
fenuasim-app

HEAD INITIAL
418e1a6

HEAD FINAL
8682ae2 (Phase 4F.1 — committé, voir addendum de clôture en fin de document)

================================
RECHARGE
================================

BOUTON RECHARGE
✅ — carte "Mes eSIM" (accueil), affiché si iccid connu et eSIM non expirée

CATALOGUE TOPUP RÉEL
✅ — GET https://partners-api.airalo.com/v2/sims/{iccid}/topups, en direct, jamais de catalogue local supposé

ESIM NON RECHARGEABLE
✅ — 422 Airalo ou liste vide → "Aucune recharge disponible" + CTA "Acheter une nouvelle eSIM"

PRIX RÉEL
✅ — recalculé serveur avec la même formule que sync-packages (déjà utilisée site+mobile) : ceil(prix_airalo × 1.12) × 0.83 USD→EUR

FAUX PRIX
0

================================
BACKEND
================================

TOPUP LIST ENDPOINT (Airalo, confirmé via doc officielle, pas supposé)
GET /v2/sims/{iccid}/topups

TOPUP ORDER ENDPOINT (Airalo)
POST /v2/orders/topups (package_id, iccid, description)

ENDPOINT LIST TOPUPS (nous)
Edge Function Supabase `list-esim-topups`

ENDPOINT CHECKOUT (nous)
Edge Function Supabase `create-topup-checkout`

ENDPOINT STATUS (nous)
Aucun endpoint dédié — lecture directe de `esim_topup_orders` par le client mobile (RLS scoped à l'utilisateur), même pattern que `insurances`/`airalo_orders`

AUTH JWT
✅ — verify_jwt Supabase + `auth.getUser()` dérivé du header Authorization ; jamais de user_id/email pris dans le body

PROPRIÉTÉ ESIM VÉRIFIÉE SERVEUR
✅ — via `app_esim_assignments` (user_id = auth.uid() AND iccid = :iccid), testé avec 2 vrais comptes jetables (voir SÉCURITÉ)

================================
STRIPE
================================

HOSTED CHECKOUT
✅

WEBHOOK AUTORITAIRE
✅ — `stripe-webhook` (Edge Function déjà active en production pour les eSIM) étendu avec une branche dédiée sur `metadata.source === 'mobile_topup'` ; le chemin eSIM historique n'a pas été modifié. Aucune nouvelle inscription de webhook Stripe n'était nécessaire — ce point évite le suivi manuel qu'avait demandé la Phase 4 pour les redirect URLs Supabase.

MOBILE FORCE PAID
NON

================================
AIRALO
================================

MOBILE POST /orders
NON — jamais. Seul le webhook (ou le job de reprise serveur) appelle POST /v2/orders/topups

TOPUP CRÉÉ CÔTÉ SERVEUR
✅

IDEMPOTENCE
✅ par conception — claim atomique (`UPDATE ... WHERE status = 'paid' ... RETURNING`) avant tout appel Airalo. Vérifié par tests directs de propriété/sécurité, PAS par un vrai rejeu de webhook Stripe (aucune session Stripe réelle créée dans cette phase, cf FINANCE)

1 STRIPE SESSION → MAXIMUM 1 TOPUP AIRALO
✅ par conception (idem)

RETRY
✅ — cron Supabase `esim-topup-retry-every-5-min` → `retry-topup-orders`. Reprend uniquement `failed` (retry_count < 5) et `paid` bloqué > 10 min (Airalo jamais appelé, donc sûr). Ne reprend jamais un `processing` bloqué : l'issue de l'appel Airalo y est alors inconnue, un retry aveugle risquerait une double recharge facturée — ces cas restent visibles pour une intervention support manuelle (limite assumée, documentée dans le code)

================================
UX
================================

PAYMENT SUCCESS
✅ — `app/topup-success.tsx`, jamais "Recharge effectuée" au seul retour Stripe

PAYMENT CANCEL
✅ — `app/topup-cancel.tsx`

PROCESSING
✅ — "Paiement reçu, nous appliquons votre recharge..."

COMPLETED
✅ — uniquement quand `esim_topup_orders.status = 'completed'` en base

FAILED / RETRY
✅ — statut `failed` traduit en "paiement reçu, finalisation en cours" (jamais "paiement échoué" si Stripe a réellement encaissé)

POLLING BORNÉ
✅ — 3 s d'intervalle, 45 s max, arrêt immédiat sur `completed`/`failed`

================================
SÉCURITÉ
================================

COMPTE A → ESIM B
BLOQUÉ — testé avec 2 vrais comptes Supabase jetables et une eSIM factice assignée à A :
  - A → sa propre eSIM : 200 (propriété acceptée, échec Airalo attendu ensuite car ICCID factice)
  - A → eSIM non assignée : 403
  - B → eSIM de A : 403 (sur list-esim-topups ET create-topup-checkout)
  - Aucun token : 401

PRIX CLIENT MODIFIABLE
NON — testé : champs `amount`/`price_eur`/`final_price_eur` envoyés dans le body sont silencieusement ignorés, le prix vient uniquement du recalcul serveur

AIRALO SECRET MOBILE
NON

STRIPE SECRET MOBILE
NON

SERVICE ROLE MOBILE
NON

IDOR
NON — RLS testée en direct sur `esim_topup_orders` : A lit sa ligne (200, 1 résultat), B ne la voit pas (200, 0 résultat), anon refusé (401, permission denied), INSERT direct par un client authentifié refusé (403, grants explicitement retirés — authenticated n'a que SELECT)

SELECT *
NON — colonnes explicites partout (mobile et Edge Functions)

================================
TESTS
================================

TYPECHECK
✅ — `npx tsc --noEmit`, 0 erreur

EXPO DOCTOR
18/18 ✅ (aucune régression vs Phase 5)

QUOTE / CATALOGUE
✅ — testé en conditions réelles (compte réel, eSIM factice, appel Airalo réel qui échoue proprement sur ICCID inconnu → 502 propre, pas de crash)

CHECKOUT SÉCURITÉ
✅ — voir SÉCURITÉ ci-dessus (tous les tests faits contre les Edge Functions déployées, pas des mocks)

DOUBLE WEBHOOK / DOUBLE CALLBACK / APP FERMÉE / NETWORK LOSS
⚠️ NON TESTÉS EN CONDITIONS RÉELLES — nécessiteraient un vrai paiement Stripe pour déclencher un vrai webhook, explicitement exclu de cette phase (voir FINANCE). La protection (claim atomique, webhook seul déclencheur) est vérifiée par relecture de code et par les tests RLS/propriété, pas par un scénario de paiement réel de bout en bout. C'est précisément l'objet de la Phase 4G.

================================
FINANCE
================================

VRAI PAIEMENT EFFECTUÉ
NON

VRAI TOPUP AIRALO DE TEST
NON

================================
V1
================================

ACHAT ESIM
✅ (inchangé)

MES ESIM
✅ (inchangé)

RECHARGE ESIM
✅ architecture/sécurité — ⚠️ non validée par un vrai paiement de bout en bout

ASSURANCE
HORS V1

================================
DÉCOUVERTE HORS PÉRIMÈTRE (signalée, non corrigée sur votre décision)
================================

`airalo_topups` (table préexistante, journal des recharges historiques) a la RLS désactivée et le rôle `anon` (clé publique embarquée dans l'app et le site) y a un accès complet SELECT/INSERT/UPDATE/DELETE/TRUNCATE, sans authentification. Vous avez choisi de ne pas la corriger dans cette phase. Cette table n'est utilisée en écriture que par le webhook/retry (service_role), jamais lue par le mobile — donc sans impact sur ce qui a été livré ici — mais reste une fuite réelle et exploitable en l'état.

================================
CONCLUSION
================================

RECHARGE ESIM PRÊTE
OUI, techniquement et en sécurité — sous réserve de la recette réelle bout-en-bout

BLOQUANTS
1. Aucune recette avec un vrai paiement Stripe → vraie recharge Airalo (volontairement exclu de cette phase)
2. `airalo_topups` RLS/grants toujours ouverts (signalé, non corrigé sur votre décision)
3. Je n'ai pas pu confirmer depuis cet environnement que l'endpoint `stripe-webhook` reçoit bien tous les événements `checkout.session.completed` en production (pas d'accès au dashboard Stripe) — c'est une forte présomption (il écrit déjà de vraies sessions `cs_live_` dans `orders` d'après l'audit Phase 4C), pas une certitude absolue

PRÊT POUR PHASE 4G
OUI
```

---

## ADDENDUM — PHASE 4F.1 (CLÔTURE / HARDENING), 2026-08-25

```text
1. USAGES DE airalo_topups
   Audité : stripe-webhook (branche mobile_topup) et retry-topup-orders sont
   les SEULS écrivains (tous deux service_role). 3 autres Edge Functions
   plausibles (create-payment, esim-instructions, send-esim-confirmation)
   vérifiées individuellement : aucune référence. Aucun code mobile ne lit
   ni n'écrit cette table.

2. BESOIN CLIENT DIRECT
   Aucun trouvé. esim_topup_orders (RLS scoped) couvre déjà le besoin de
   lecture utilisateur pour le mobile.

3. RLS ACTIVÉE
   ✅ — relrowsecurity = true (vérifié par requête directe)

4. GRANTS anon/authenticated RETIRÉS
   ✅ — INSERT/SELECT/UPDATE/DELETE/TRUNCATE retirés ; seuls postgres et
   service_role conservent des privilèges (vérifié via information_schema)

5. ÉCRITURES RÉSERVÉES AU service_role
   ✅ — confirmé par pg_roles.rolbypassrls = true pour service_role (garantie
   de plateforme, vérifiée en direct, pas supposée) : le webhook/retry
   continueront d'écrire normalement quelle que soit la RLS

6. POLICY CLIENT
   Aucune ajoutée (aucun besoin identifié à l'étape 2) — RLS activée + 0
   policy = accès refusé par défaut à tout rôle ne bypassant pas RLS

7. TEST anon
   SELECT → 401 permission denied
   INSERT → 401 permission denied

8. TEST utilisateur authentifié (compte jetable réel, créé/nettoyé)
   SELECT → 403 permission denied
   INSERT → 403 permission denied
   UPDATE → 403 permission denied
   DELETE → 403 permission denied

9. TEST écriture privilégiée (équivalent service_role, bypass RLS confirmé)
   INSERT réel réussi, puis nettoyé (0 résidu)

10. COMMIT
    8682ae2 — 7 fichiers (les livrables mobiles de la Phase 4F uniquement ;
    le reste du backlog préexistant dans ce repo n'a pas été touché, hors
    périmètre de cette clôture)

11. TYPECHECK
    ✅ npx tsc --noEmit, 0 erreur

12. EXPO DOCTOR
    ✅ 18/18

CONCLUSION 4F.1
airalo_topups fermée à tout accès client (anon et authenticated), écriture
service_role intacte et vérifiée, 0 régression. Travail mobile de la Phase 4F
committé. Aucune donnée de test résiduelle.
```

