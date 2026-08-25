# PHASE 3B — Implémentation sécurisée de la suppression de compte

_Rédigé le 2026-08-23. Décisions Phase 3 considérées comme validées. Tests exécutés réellement contre la fonction déployée en production, avec des comptes 100% jetables — toutes les traces supprimées et vérifiées après coup (0 résiduel)._

---

## PARTIE 1 — Derniers audits avant implémentation

### 1. `customer_esims`

```text
USAGE RÉEL
0 ligne dans la table (vérifié en direct). Aucun trigger, aucune fonction SQL,
aucune vue ne la référence. Le seul code qui la mentionne est un handler
(airalo-api/db.ts::createEsimRecord) qui appartient à un chemin de création
d'eSIM alternatif et non actif dans le tunnel actuel (l'app utilise
create-airalo-order, pas airalo-api).

UTILISÉ PAR APP MOBILE
NON

UTILISÉ PAR EDGE FUNCTIONS
Un seul handler non actif dans le tunnel courant (airalo-api), jamais appelé
par le code audité

UTILISÉ PAR SITE
INCONNU (mais 0 ligne = pas de données réelles à risque de toute façon)

PII CONTENUE
Aucune actuellement (table vide)

ACTION RECOMMANDÉE LORS SUPPRESSION COMPTE
CONSERVER (ne rien faire) — table vide, aucun risque, aucune action nécessaire
```

### 2. `user_sims`

```text
USAGE RÉEL
350 lignes réelles et actives (status: expired/expiring_soon/completed).
Contrairement à customer_esims, cette table est manifestement utilisée en
production. Aucune référence trouvée dans l'app mobile ni dans les 20 Edge
Functions déjà auditées — très probablement écrite directement par le site web.

UTILISÉ PAR APP MOBILE
NON

UTILISÉ PAR EDGE FUNCTIONS
NON (aucune des 20 fonctions ne la référence)

UTILISÉ PAR SITE
PROBABLE mais non confirmable depuis cet environnement

PII CONTENUE
user_email, iccid, name (nom donné à la SIM)

ACTION RECOMMANDÉE LORS SUPPRESSION COMPTE
CONSERVER — même traitement que airalo_orders/orders : liée par email, pas
de FK vers auth.users, à ne jamais toucher automatiquement sans confirmation
du rôle exact côté site.

⚠️ DÉCOUVERTE ANNEXE (non corrigée, signalée) : RLS est désactivée sur cette
table (rowsecurity = false), tout comme sur customer_esims. C'est une faille
distincte de celles déjà connues (profiles, airalo_orders) — n'importe quel
client avec la clé anon peut lire les 350 lignes réelles. Non corrigée dans
cette phase (hors périmètre suppression de compte), mais à traiter séparément.
```

### 3. `stripe_transactions.raw_data` — catégories de PII (aucune valeur exposée)

Format identifié : export CSV Stripe Dashboard importé tel quel en JSON (194 lignes, clés type "Amount", "Created date (UTC)"...).

```text
raw_data contient (noms de champs uniquement, jamais de valeur affichée) :
- email client (Customer Email) : OUI
- identifiant client Stripe (Customer ID) : OUI
- nom client : POSSIBLE (champ libre "Customer Description", non garanti)
- adresse (billing/shipping) : NON — aucune clé de ce type présente
- données de carte complètes : NON — uniquement "Card ID" (référence/token,
  jamais le numéro complet)
- IP : NON
- téléphone : NON
- montants, statut, devise, frais : OUI (données financières, pas des PII directes)
```

**Conclusion** : `stripe_transactions.raw_data` contient bien de la PII (email, ID client Stripe), confirmant son classement en **Catégorie C** (conservation, validation comptable requise) déjà retenu en Phase 3 — mais **aucune donnée de paiement sensible** (pas de numéro de carte, pas d'adresse).

### 4-5. Tables e-mail et support — conservées telles quelles

`emails_sent`, `review_emails_sent`, `upsell_emails_sent`, `support_tickets`, `support_conversation_logs` : **non touchées** par cette implémentation. Confirmé par lecture directe du code source réellement déployé (voir Partie 4) — aucune de ces tables n'y est référencée.

### 6. Vérification compte administrateur — conçue et testée réellement

Voir Partie 4 (implémentation) et Partie 6 (tests réels, section "Test admin").

---

## PARTIE 2-4 — Architecture, table, Edge Function

### Table `account_deletion_requests` — créée

```sql
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_reference uuid not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_code text
);

create index account_deletion_requests_user_reference_idx on public.account_deletion_requests(user_reference);

alter table public.account_deletion_requests enable row level security;
-- Aucune policy definie : RLS activee + 0 policy = aucun acces pour anon/authenticated,
-- uniquement service_role (qui contourne RLS par nature).
```

**Aucune FK vers `auth.users`** (conforme à la consigne — le journal survit à la suppression, vérifié réellement : après suppression de T1/T2/A4, leurs lignes de journal existaient toujours jusqu'au nettoyage manuel de fin de tests).

**RLS vérifiée en direct** : `rowsecurity = true`, `0 policy` — confirmé après création.

### Edge Function `delete-account` — créée et déployée

`verify_jwt: true` au niveau plateforme (rejette les JWT invalides/absents **avant** que le code de la fonction s'exécute — confirmé par test réel, voir Partie 6).

Flux réellement implémenté (identique à l'architecture demandée) :

```text
JWT (Authorization: Bearer ...)
  ↓ admin.auth.getUser(jwt) -- SEULE source d'identite, jamais le body
  ↓ admin.auth.admin.getUserById(userId) -- idempotence : deja supprime ?
  ↓ select admins where user_id = userId -- bloque si admin
  ↓ insert account_deletion_requests (status: pending)
  ↓ admin.auth.admin.deleteUser(userId) -- SERVICE ROLE, jamais expose au client
  ↓ CASCADE automatique (profiles/app_travelers/app_devices/app_esim_assignments)
  ↓ update account_deletion_requests (status: completed)
```

Le corps de la requête (`req.json()`) **n'est jamais lu** — un `user_id` envoyé par le client n'a donc littéralement aucun effet possible, pas seulement "ignoré par logique" mais absent du code exécuté.

---

## PARTIE 5 — UX mobile — implémentée

- `app/(tabs)/account.tsx` : section discrète "Gestion du compte" tout en bas, lien texte rouge sobre "Supprimer mon compte" (pas de bouton mis en avant).
- `app/account/delete.tsx` : écran en 2 étapes.
  - Étape 1 (info) : texte exact demandé, boutons Annuler / Continuer.
  - Étape 2 (confirmation) : question de certitude, champ de saisie "SUPPRIMER" (bouton destructif désactivé tant que le texte ne correspond pas exactement, comparaison insensible à la casse), état de chargement ("Suppression de votre compte…", bouton désactivé pendant l'appel, empêche le double-clic côté UI), gestion d'erreur (message générique, distinction du cas `admin_account`), succès → `supabase.auth.signOut()` + `router.replace('/(auth)/login')`.

---

## PARTIE 6 — Tests réels exécutés (comptes 100% jetables, tous nettoyés après coup)

### Test 23 — Cas normal

Compte réel créé avec : 1 ligne `profiles`, 2 `app_travelers`, 2 `app_devices`, 2 `app_esim_assignments`. Appel réel à la fonction déployée.

**Résultat après suppression (vérifié en base) :**
```text
auth.users        : 0 (supprimé)
profiles          : 0 (CASCADE confirmé)
app_travelers     : 0 (CASCADE confirmé, les 2 lignes)
app_devices       : 0 (CASCADE confirmé, les 2 lignes)
app_esim_assignments : 0 (CASCADE confirmé, les 2 lignes)
account_deletion_requests : 1 ligne, status=completed
```
✅ **Conforme à 100%.**

### Test 24 — Données historiques conservées

1 ligne de test dans `airalo_orders` + 1 dans `orders`, liées par e-mail à un compte de test. Compte supprimé.

**Résultat :**
```text
auth.users      : 0 (supprimé)
airalo_orders   : 1 (TOUJOURS PRÉSENT)
orders          : 1 (TOUJOURS PRÉSENT)
```
✅ **Conforme.** Données de test nettoyées manuellement ensuite (comme prévu, elles n'avaient pas vocation à rester).

### Test 25 — Compte administrateur

Ligne insérée dans `admins` pour un compte de test. Appel réel à la fonction.

**Résultat :**
```text
Réponse HTTP : 403
Corps : {"error":"admin_account","message":"Ce compte dispose de droits administrateur et ne peut pas etre supprime depuis l'application. Veuillez contacter l'administration FenuaSIM."}
auth.users (compte test) : 1 (TOUJOURS PRÉSENT, non supprimé)
admins (ligne test)      : 1 (TOUJOURS PRÉSENT, non supprimée)
account_deletion_requests : 1 ligne, status=failed, error_code=ADMIN_ACCOUNT
```
✅ **Conforme à 100%.** Aucune cascade déclenchée, aucune donnée touchée.

### Test 26 — Idempotence

Couvert conjointement par le test 29 (voir ci-dessous) : deux appels sur le même compte n'ont jamais produit d'erreur serveur ni d'état incohérent.

### Test 27 — JWT invalide

```text
Sans JWT       -> HTTP 401, code UNAUTHORIZED_NO_AUTH_HEADER
JWT malformé   -> HTTP 401, code UNAUTHORIZED_INVALID_JWT_FORMAT
```
✅ **Conforme.** Rejeté au niveau plateforme (`verify_jwt: true`), le code de la fonction ne s'exécute même pas.

### Test 28 — Tentative cross-user (A tente de cibler B)

Appel réel avec le JWT de A4, corps de requête contenant `{"user_id": "<id de B4>"}`.

**Résultat :**
```text
A4 (JWT holder)  : supprimé (auth.users = 0) -- la fonction a bien agi sur A4
B4 (id dans body): TOUJOURS PRÉSENT (auth.users = 1) -- le body a ete totalement ignore
```
✅ **Conforme à 100%.** Preuve directe qu'un utilisateur ne peut jamais faire supprimer un autre compte via le corps de la requête.

### Test 29 — Double appel quasi simultané

Deux appels `Promise.all` sur le même compte de test.

**Résultat réel :**
```text
Appel 1 -> {"status":"already_deleted"}
Appel 2 -> {"status":"completed"}
```
Aucun crash, aucune erreur 500, état final cohérent (compte supprimé une seule fois).

⚠️ **Observation honnête, non bloquante** : la course a produit **2 lignes** dans `account_deletion_requests` pour cette unique suppression logique (les deux appels ont chacun inséré leur propre ligne `pending` avant que le second `deleteUser` échoue proprement). Les deux lignes finissent à `status=completed` — **aucune incohérence de données réelle**, juste une duplication du journal dans ce cas de figure précis (double appel dans la même fraction de seconde). Signalé pour transparence, pas corrigé dans cette V1 (n'affecte ni la sécurité ni l'intégrité des données utilisateur).

### Test 30 — `insurances` jamais touchée

Vérifié par audit du **code source réellement déployé** (récupéré depuis Supabase, pas une copie locale) : les seuls appels `.from(...)` du fichier sont `admins` et `account_deletion_requests`. Aucune mention de `insurances` (ni d'aucune autre table historique) dans le code exécuté.

---

## PARTIE 7 — Rappel Phase 1 (non modifiée)

Confirmé : aucune policy `profiles` ni `airalo_orders` modifiée dans cette intervention. Ces deux sujets restent ouverts, en attente de l'audit du site web, comme convenu — non mélangés avec la suppression de compte.

---

## Vérifications techniques

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx expo export --platform web` | ✅ succès |
| Déploiement `delete-account` | ✅ actif, `verify_jwt: true`, vérifié via lecture directe du code déployé |
| Secrets Supabase requis | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — auto-injectés par Supabase pour toute Edge Function, aucune configuration manuelle nécessaire |

---

## Compte-rendu

```text
PHASE
3B + Implémentation suppression de compte

ÉTAT
✅

CUSTOMER_ESIMS
Usage réel : table vide (0 ligne), chemin de code non actif
Décision : conserver (aucune action, aucun risque)

USER_SIMS
Usage réel : 350 lignes reelles actives, probablement site web, jamais referencee par app/edge functions
Décision : conserver (meme traitement que airalo_orders/orders)

STRIPE_TRANSACTIONS.RAW_DATA
PII détectée : email client (OUI), ID client Stripe (OUI), nom possible (champ libre),
adresse (NON), carte complete (NON), IP (NON), telephone (NON)

EMAILS_SENT
Décision V1 : CONSERVÉ

SUPPORT_TICKETS
Décision V1 : CONSERVÉ

ACCOUNT_DELETION_REQUESTS
CRÉÉE : OUI

FK VERS AUTH.USERS
NON (par conception, journal doit survivre)

RLS
Activee, 0 policy => aucun acces anon/authenticated, uniquement service_role

EDGE FUNCTION DELETE-ACCOUNT
CRÉÉE : OUI (deployee, active, verify_jwt=true)

JWT UTILISÉ COMME SOURCE D'IDENTITÉ
✅ (verifie reellement : admin.auth.getUser(jwt), jamais le body)

USER_ID DU BODY IGNORÉ
✅ (verifie reellement, test 28 : A4 supprime, B4 intact malgre body.user_id=B4)

SERVICE ROLE EXPOSÉ AU CLIENT
NON

VÉRIFICATION ADMIN
✅ (testee reellement, test 25 : refus 403, aucune donnee touchee)

AUTH.USERS SUPPRIMÉ EN DERNIER
✅

SUPPRESSION MANUELLE APP_* AVANT AUTH
NON (CASCADE naturel uniquement, confirme reellement test 23)

CASCADE PROFILES
✅ (verifie reellement)

CASCADE APP_TRAVELERS
✅ (verifie reellement, 2 lignes)

CASCADE APP_DEVICES
✅ (verifie reellement, 2 lignes)

CASCADE APP_ESIM_ASSIGNMENTS
✅ (verifie reellement, 2 lignes)

AIRALO_ORDERS MODIFIÉ
NON (verifie reellement, test 24 : ligne toujours presente apres suppression)

ORDERS MODIFIÉ
NON (idem)

INSURANCES MODIFIÉ
NON (verifie par audit du code source reellement deploye : 0 reference)

INVOICES MODIFIÉ
NON (0 reference dans le code deploye)

STRIPE_TRANSACTIONS MODIFIÉ
NON (0 reference dans le code deploye)

SUPPORT MODIFIÉ
NON (0 reference dans le code deploye)

DONNÉES HISTORIQUES CONSERVÉES
✅

TEST COMPTE NORMAL
✅ (test reel complet, cascade verifiee ligne par ligne)

TEST COMPTE ADMIN
✅ (test reel, refus confirme, aucune donnee touchee)

TEST JWT INVALIDE
✅ (test reel, 401 sur les 2 cas : absent et malforme)

TEST UTILISATEUR A → B
✅ (test reel, A supprime, B intact)

TEST DOUBLE APPEL
✅ (test reel, aucun crash, etat final coherent)

TEST IDEMPOTENCE
✅ (couvert par le test double appel : deuxieme resultat "already_deleted" propre)

JOURNAL CONSERVÉ APRÈS SUPPRESSION
✅ (verifie reellement avant nettoyage manuel de fin de tests)

UX DOUBLE CONFIRMATION
✅ (2 ecrans distincts implementes)

SAISIE SUPPRIMER
✅ (bouton desactive tant que le texte ne correspond pas exactement)

SESSION NETTOYÉE
✅ (signOut() implemente avant redirection)

RETOUR LOGIN
✅ (router.replace vers /(auth)/login implemente)

TYPESCRIPT
✅

BUILD EXPO
✅

TEST VISUEL RÉEL
⏳ (logique serveur testee reellement de bout en bout via appels HTTP directs a la
fonction deployee -- le plus important et le plus risque ; le clic reel sur les
2 ecrans mobiles n'a pas pu etre teste faute de navigateur/simulateur pilotable
dans cet environnement)

PROFILES RLS
INCHANGÉE

AIRALO_ORDERS RLS
INCHANGÉE

POINTS RESTANTS
1. Validation visuelle reelle des 2 ecrans mobiles (Compte -> Gestion du compte ->
   Supprimer mon compte -> saisie SUPPRIMER -> suppression -> retour login)
2. user_sims : RLS desactivee decouverte pendant cet audit (350 lignes reelles
   exposees a la cle anon) -- nouvelle faille, non corrigee, hors perimetre de
   cette tache, a traiter separement comme profiles/airalo_orders
3. Duplication mineure du journal en cas de double appel quasi simultane
   (observee reellement, sans impact sur la securite ou l'integrite des donnees)
4. Phases 1 (policies profiles/airalo_orders) et audit du site web toujours en attente
```
