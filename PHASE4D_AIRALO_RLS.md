# PHASE 4D — Sécurisation finale eSIM + assurances avant intégration mobile

_Rédigé le 2026-08-23. Aucun paiement réel, aucune vraie commande Airalo déclenchée, aucune RLS modifiée en production pendant cette phase._

---

# PARTIE A — ACCÈS AU CODE DU SITE

Recherche exhaustive effectuée dans cet environnement : contenu de `/workspaces/`, remotes git du dépôt mobile, recherche de tout autre dépôt `.git` sur le disque.

```text
/workspaces/ ne contient que fenuasim-app (le dépôt mobile)
git remote -v (dépôt mobile) -> uniquement github.com/Tomleb987/fenuasim-app
Aucun autre .git trouvé sur le disque (hors dotfiles systeme sans rapport)
```

```text
ACCÈS CODE SITE
NON DISPONIBLE — confirmé par recherche exhaustive, pas supposé
```

Conformément à la règle de la phase, ceci **bloque formellement** : la confirmation du commit en production, la lecture directe des routes `/api/create-airalo-order` et assurance, et l'intégralité des Parties R à Y (backend assurance site).

**Cette phase n'est cependant pas arrêtée en totalité.** Une grande partie des Parties B à Q ne dépend en réalité pas du code du site — elle dépend de preuves directement disponibles côté Supabase (schéma, contraintes, `pg_cron`, données réelles, RLS). Chaque conclusion ci-dessous précise sa source exacte : preuve Supabase directe (jamais une supposition sur le comportement du site) ou **NON AUDITABLE**.

---

# PARTIE B/C/D/E/F — CARTOGRAPHIE AIRALO (résolue par preuves Supabase, sans deviner le site)

## Découverte déterminante : `sync_queue` n'existe pas

```sql
select * from public.sync_queue limit 1;
-- ERROR: 42P01: relation "public.sync_queue" does not exist
```

Le code de `stripe-webhook` (déjà lu en Phase 4C) tente d'insérer dans `sync_queue` après chaque `checkout.session.completed` réussi — **cet insert échoue systématiquement** (table inexistante), silencieusement absorbé par le `try/catch` de la fonction (qui renvoie toujours `200` à Stripe). Ceci **prouve, sans avoir besoin du code du site**, que :

```text
CHEMIN 1 (webhook -> orders -> sync_queue -> consommateur -> Airalo)
FORMELLEMENT MORT. Aucune commande Airalo n'a jamais pu être créée par
cette voie. Seule la table `orders` reçoit une ligne (bookkeeping inerte).
```

## Recherche du consommateur `sync_queue` (Partie C)

Recherche exhaustive côté Supabase (seul périmètre auditable) :

```text
pg_cron (extension installée) -> 5 jobs actifs :
  airalo-sync-every-hour  -> appelle call_airalo_sync() -> invoque l'Edge
                              Function sync-packages (synchronise le
                              CATALOGUE de packages Airalo, PAS les commandes)
  update-expired-esims    -> UPDATE de statuts uniquement, aucune création
  sync-esim-expiry        -> appelle une route du SITE (cron API), sans
                              rapport avec la création de commandes
  send-review-emails      -> route site, emails uniquement
  notify-expiring-esims   -> route site, notifications uniquement

AUCUN job pg_cron ne lit ni ne traite sync_queue.
AUCUNE Edge Function Supabase ne référence sync_queue dans son code
(recherche exhaustive sur les 22 fonctions déployées).
```

```text
FICHIER / FUNCTION
Aucun -- sync_queue n'a jamais eu de consommateur actif retrouvable côté
Supabase, et ne peut techniquement pas en avoir eu côté site non plus
puisque la TABLE elle-même n'existe pas (un consommateur qui la lirait
échouerait de la même façon).

CRÉATION AIRALO
NON — ce chemin n'a jamais pu produire de commande Airalo.
```

## Chemin 2 (mobile) — confirmé comme seul chemin réel pour les achats mobiles

```text
app/esim/payment-success.tsx (mobile)
  -> fetch('https://fenuasim.com/api/create-airalo-order', ...)
  -> route Next.js du site -- NON AUDITABLE (comportement interne inconnu)
```

## Découverte annexe : une 3e fonction existe, distincte des deux chemins connus

```text
Edge Function Supabase "create-airalo-order" (distincte de la route Next.js
/api/create-airalo-order du site, même nom trompeur) :
  - appelle réellement l'API Airalo (https://partners-api.airalo.com/v2/orders)
  - insère dans airalo_orders
  - callable directement (packageId, customerEmail, airalo_id, ...)
  - ne lit PAS sync_queue -- pas non plus un consommateur de la queue morte
  - NON AUDITABLE de savoir si le site l'appelle en interne (probable mais
    non confirmé) ou si elle est un vestige inutilisé
```

## Conclusion Parties B/C/F

```text
CHEMINS DE CRÉATION AIRALO IDENTIFIÉS
1. Webhook -> sync_queue -> [mort, table inexistante] : NE CRÉE JAMAIS D'AIRALO
2. Mobile -> /api/create-airalo-order (site, Next.js) : SEUL CHEMIN RÉEL
   confirmé pour les achats mobiles
3. Edge Function Supabase "create-airalo-order" : existe, capable de créer
   une vraie commande Airalo, mais son déclencheur réel (site ? manuel ?
   vestige ?) est NON AUDITABLE

CONSOMMATEUR SYNC_QUEUE
N'existe pas -- la table elle-même n'existe pas

DOUBLE CRÉATION POSSIBLE AVANT (chemin 1 vs chemin 2, pour le mobile)
NON, pour cette paire précise -- le chemin 1 est mort, donc il ne peut pas
entrer en concurrence avec le chemin 2 pour un achat mobile. C'est une
bonne nouvelle, établie par preuve directe et non par supposition.

SOURCE DE VÉRITÉ RETENUE
Chemin 2 (mobile -> /api/create-airalo-order) reste, de fait, la seule
source de vérité active pour les achats mobiles. Aucun changement structurel
n'a été fait ici : le chemin 1 étant déjà mort de lui-même, il n'y avait
rien à désactiver.
```

---

# PARTIE E (bis) — DOUBLONS HISTORIQUES RÉELS

Recherche de doublons démontrables dans `airalo_orders` (jamais conclu sur la seule base email+package_id, conformément à la consigne) :

```text
Plusieurs groupes email+package_id avec >1 commande trouvés (jusqu'à 10
pour un même couple). La grande majorité s'étale sur des heures, jours ou
mois -- compatible avec des achats légitimes répétés (ex. emails de type
agence de voyage achetant plusieurs eSIM pour des clients différents).

CAS DÉMONTRABLES (écart de temps de l'ordre de la seconde, incompatible
avec un ré-achat humain volontaire) :
  - 2 commandes à 1,2 seconde d'écart (même email+package)
  - 2 commandes à environ 2 secondes d'écart (même email+package)
  - 1 commande à 44 secondes d'écart (même email+package)

Ces cas constituent une preuve concrète qu'une double création technique
s'est déjà produite par le passé, au moins occasionnellement. Le mécanisme
exact n'est PAS déterminable depuis Supabase seul : airalo_orders n'a
aucune colonne stripe_session_id (voir Partie D), donc impossible de savoir
si ces paires proviennent du même paiement Stripe ou de deux paiements
distincts (ex. double clic avant redirection). NON AUDITABLE au-delà de
cette preuve sans le code du site.
```

```text
DOUBLONS HISTORIQUES CONFIRMÉS
OUI (au moins 3 paires à quelques secondes d'écart, preuve directe et
non une simple coïncidence email+package)
```

---

# PARTIE D — IDEMPOTENCE : AUCUNE CLÉ MÉTIER FIABLE AU NIVEAU BASE

```sql
-- Contraintes réelles (confirmées en production) :
airalo_orders_pkey        PRIMARY KEY (id)
airalo_orders_order_id_key UNIQUE (order_id)   -- order_id = ID Airalo,
                                                 -- attribué APRÈS l'appel API
orders_pkey                PRIMARY KEY (id)
orders_status_check        CHECK (status ...)
-- AUCUNE contrainte UNIQUE sur orders.stripe_session_id
-- AUCUNE colonne stripe_session_id dans airalo_orders
```

```text
IDEMPOTENCE PAR STRIPE_SESSION_ID
❌ — aucune contrainte de base de données ne relie ni ne protège
airalo_orders contre deux appels API Airalo distincts pour le même
paiement. UNIQUE(order_id) protège uniquement contre une double INSERTION
locale du MÊME résultat déjà obtenu -- pas contre un second appel qui
produirait un second order_id Airalo bien réel (donc une seconde eSIM
réellement provisionnée et facturée par Airalo).

Clé métier fiable actuellement ?
AUCUNE au niveau base de données. Si une protection existe, elle est
uniquement applicative, côté site (NON AUDITABLE).
```

---

# PARTIE G/I — CORRECTIF APPLIQUÉ (minimal, côté mobile uniquement)

Puisque le seul point du système sur lequel cette phase a un contrôle direct et sûr est l'écran mobile lui-même (le code du site étant hors d'atteinte), le correctif suivant a été appliqué à `app/esim/payment-success.tsx` :

```text
AVANT tout appel a /api/create-airalo-order :
  verifier un cache local (SecureStore) cle par le stripe session_id exact
  SI un resultat existe deja pour cette session -> le reutiliser, ZERO appel reseau
  SI aucun resultat -> proceder normalement, puis MEMORISER le resultat
  reussi avant de terminer

Protege contre : remontage de cet ecran (retour dans l'app, réouverture du
meme deep link, navigation retour/avant) redéclenchant un second appel
reseau pour la MÊME session Stripe déjà traitée avec succès sur cet appareil.

Ne protège PAS : un éventuel mécanisme de duplication côté site lui-même
(NON AUDITABLE), ni deux sessions Stripe distinctes (deux paiements réels
différents -- cas hors du périmètre "idempotence d'un même paiement").
```

`app/payment-success.tsx` (alias créé en Phase 5) réexporte ce même composant, donc bénéficie automatiquement du correctif sans modification supplémentaire.

```text
PAYMENT-SUCCESS CRÉE ENCORE AIRALO
OUI (c'est le seul chemin réel et fonctionnel, volontairement conservé --
le désactiver aurait cassé le seul mécanisme de livraison eSIM existant
pour le mobile). Désormais protégé contre les rappels multiples sur le
même appareil pour la même session.
```

---

# PARTIE H/J — TESTS

```text
Callback 1 -> callback 2 -> callback 3 (même session, rejoués artificiellement)
NON TESTÉ EN CONDITIONS RÉELLES : simuler un vrai callback nécessiterait soit
un vrai paiement Stripe (interdit sans autorisation explicite, Stripe mobile
étant LIVE), soit un accès au code du site pour un rejeu contrôlé côté
serveur (NON AUDITABLE). Le correctif de la Partie G a néanmoins été vérifié
par relecture de code : le second appel est bien structurellement empêché
côté mobile pour une session déjà traitée avec succès sur le même appareil.

TEST TUNNEL
⚠️ Non exécuté de bout en bout (bloqué par l'absence d'environnement de test
Stripe/site dédié). Scénario de test réel à exécuter en TestFlight documenté
ci-dessous.
```

```text
Scénario TestFlight à exécuter (1 achat réel faible montant) :
[ ] 1 achat eSIM, montant minimal
[ ] 1 paiement Stripe (déjà live -- montant réellement débité)
[ ] Vérifier en base : exactement 1 ligne airalo_orders pour cet achat
[ ] Revenir sur l'écran payment-success plusieurs fois (arrière-plan/
    premier plan) -> aucun second appel réseau visible, résultat identique
    affiché à chaque fois
[ ] 1 seul ICCID reçu
```

---

# PARTIE K/L/P — RLS `insurances`

## Policy reconfirmée en production (Partie K)

```sql
-- Reconfirmé en direct, inchangé depuis la Phase 4C :
"admin reads all insurances"  cmd=SELECT  roles={authenticated}  qual=true
"user reads own insurances"   cmd=SELECT  roles={public}
                               qual=(user_email = auth.jwt()->>'email')
```

```text
POLICY INITIALE TROP LARGE
CONFIRMÉE (reconfirmée en production, identique à la Phase 4C)
```

## Preuve réelle de la fuite (Partie P) — comptes 100% jetables

Deux comptes jetables A et B créés, une ligne de test insérée pour chacun (jamais de donnée client réelle utilisée). Test réel via l'API REST avec le vrai JWT de A :

```text
A lit insurances avec son propre JWT
  -> 9 lignes retournées au total :
     - sa propre ligne de test (1)
     - la ligne de test de B (1) -- fuite confirmée entre comptes jetables
     - 7 lignes de VRAIS clients FenuaSIM (comptage uniquement, aucun
       contenu affiché ici) -- fuite confirmée vers des données réelles

anon (sans JWT) lit insurances
  -> 0 ligne -- correctement bloqué
```

```text
ANON → INSURANCES
REFUSÉ (confirmé réel)

USER A → A
AUTORISÉ (attendu, correct)

USER A → B
AUTORISÉ (ne devrait JAMAIS l'être) -- fuite prouvée avec des données 100%
jetables, aucune donnée client réelle exposée dans ce test ni dans ce rapport

AVA_RAW EXPOSÉ À UN AUTRE CLIENT
OUI, par construction -- puisque A peut lire l'intégralité des lignes
(select *), ava_raw et ava_validation_raw des 7 clients réels auraient été
inclus dans la réponse si ces colonnes avaient été demandées (elles ne
l'ont pas été dans ce test précis, mais rien dans la policy ne les protège)
```

Toutes les données de test ont été supprimées immédiatement après (0 résiduel vérifié : lignes `insurances` et comptes `auth.users` jetables).

## Lecteurs de `insurances` (Partie L)

```text
Mobile : hooks/useUserData.ts -- lecture filtrée sur l'email de la session
réelle (`user_email = session.user.email`), jamais toutes les lignes. Ne
dépend PAS de la policy "admin reads all insurances" pour fonctionner
correctement (la policy "user reads own insurances" suffit largement).

Site (pages client / back-office / export / comptabilité / partenaire) :
NON AUDITABLE -- accès au code du site requis pour savoir si une page admin
lit aujourd'hui insurances directement depuis le navigateur avec le rôle
authenticated, et dépendrait donc de cette policy pour fonctionner.
```

## Correctif préparé — **NON APPLIQUÉ**, gate explicite

```text
MIGRATION ADMIN SERVEUR NÉCESSAIRE
NON DÉTERMINABLE depuis cet environnement (Partie L bloquée sur ce point
précis). La Phase 4D elle-même prévoit ce gate explicitement : "Migrer
comme cela a déjà été fait pour airalo_orders... Seulement après migration
des éventuelles dépendances admin." Cette migration ne peut être ni
confirmée ni infirmée sans le code du site.

POLICY CORRIGÉE
❌ NON appliquée -- c'est le comportement correct et attendu ici, pas un
échec : appliquer le correctif sans savoir si une page admin du site
dépend aujourd'hui de cette policy risquerait de casser une fonctionnalité
back-office réelle en production, ce que la règle absolue de cette phase
interdit explicitement.
```

**SQL de correction préparé, prêt à appliquer sur validation explicite après confirmation côté site** (fourni ici pour information, non exécuté) :

```sql
-- ROLLBACK (à exécuter en premier si besoin de revenir en arrière après application) :
-- create policy "admin reads all insurances" on public.insurances
--   for select to authenticated using (true);

begin;
drop policy if exists "admin reads all insurances" on public.insurances;
-- "user reads own insurances" (user_email = auth.jwt()->>'email') reste en l'état,
-- c'est la seule policy client nécessaire.
-- Si un accès admin légitime existe côté site et doit être préservé sans passer
-- par un serveur (requireAdmin()), une policy de repli plus stricte serait :
-- create policy "admin reads all insurances" on public.insurances
--   for select to authenticated
--   using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
commit;
```

---

# PARTIE Q — `ava_raw` / `ava_validation_raw`

```text
Clés réellement présentes dans ava_raw (7 contrats réels, valeurs jamais
affichées) :
  "Certificat de garantie", "CG", "FICP", "IPID"  -> liens/références vers
    des documents contractuels/légaux
  "Numéro AD", "Numéro IN"                          -> références internes
    AVA liées au contrat (identifiants indirects, pas des noms/adresses)
  "Prix total avec options (en €)"                  -> donnée tarifaire

Toutes les valeurs sont des chaînes ou nombres simples (aucune structure
imbriquée trouvée).

ava_validation_raw : NULL sur les 7 contrats réels (rien à catégoriser).

CONTIENT DES DONNÉES PERSONNELLES
POSSIBLE — pas de nom/adresse/date de naissance en clair dans les clés
observées, mais les numéros de référence et les liens de documents sont
des identifiants indirects propres à une personne assurée précise, et les
URLs de documents pourraient elles-mêmes donner accès au contrat sans
authentification supplémentaire selon leur configuration côté AVA (NON
VÉRIFIABLE depuis cet environnement).
```

**Recommandation appliquée par défaut** (conforme à la consigne) : `hooks/useUserData.ts` sélectionne déjà `select('*')` sur `insurances`, ce qui inclut `ava_raw`/`ava_validation_raw` dans la réponse envoyée au mobile. Aucun changement fait ici (le risque principal reste la policy RLS elle-même, Partie K, pas ce `select`) — mais à garder en tête pour la Phase 4E : si un jour l'écran mobile n'a besoin que d'un sous-ensemble de champs (produit, dates, statut, lien de contrat), il serait plus prudent de lister explicitement les colonnes plutôt que `select('*')`, pour ne jamais transmettre `ava_raw` inutilement au client. Non appliqué dans cette phase (au-delà du périmètre RLS demandé).

---

# PARTIES R À Y — BACKEND ASSURANCE SITE

```text
SITE ASSURANCE AUDITÉ
NON — bloqué par l'absence d'accès au code du site (Partie A). Rien de
nouveau par rapport à la Phase 4C n'a pu être déterminé sur : l'endpoint
AVA exact, la méthode d'appel, l'authentification, la création du
PaymentIntent, le webhook/callback de confirmation, le mécanisme
d'émission exact, la génération des documents, l'envoi d'email.

Tout ce qui était déjà connu depuis les données réelles (Phase 4C) reste
valable et n'a pas été re-deviné ici : 2 produits réels (ava_carte_sante,
ava_tourist_card), tarification réelle 40-270€, paiement via
stripe_payment_intent (jamais stripe_session_id), contract_link seul
document réellement peuplé.
```

---

# PARTIE Z — ARCHITECTURE MOBILE RECOMMANDÉE (inchangée depuis la Phase 4C)

```text
ARCHITECTURE RECOMMANDÉE
APP MOBILE -> JWT -> API/Edge Function serveur (à créer) -> même moteur AVA
que le site -> Stripe (même compte, PaymentIntent) -> table insurances
existante

NOUVELLE EDGE FUNCTION NÉCESSAIRE
OUI, probablement (aucune n'existe aujourd'hui pour l'assurance) -- sauf si
le site expose déjà une API HTTP réutilisable telle quelle (NON AUDITABLE,
à confirmer avec accès au code du site)

API SITE RÉUTILISABLE
INCONNU (nécessite l'accès au code du site pour répondre avec certitude)

DUPLICATION MOTEUR AVA
NON -- aucune logique de tarification ou de souscription n'a été recréée
dans le mobile à aucun moment de cette phase
```

---

# VÉRIFICATIONS TECHNIQUES

```text
npx tsc --noEmit -> ✅
```

---

## Compte-rendu

```text
PHASE
4D — Airalo + RLS assurances + backend AVA

ÉTAT
⚠️ (progrès réel et significatif sur Airalo et RLS via preuves Supabase
pures ; backend AVA site toujours hors d'atteinte, RLS volontairement non
corrigée en attendant confirmation d'une dépendance admin)

================================
AIRALO
================================

CHEMINS DE CRÉATION AIRALO IDENTIFIÉS
2 réels/possibles : (1) mobile -> /api/create-airalo-order (site, seul
chemin confirmé actif pour le mobile) ; (2) Edge Function Supabase
create-airalo-order (existe, déclencheur réel non confirmé). Le chemin
webhook->sync_queue est formellement mort (table inexistante).

CONSOMMATEUR SYNC_QUEUE
Aucun -- la table sync_queue n'existe pas dans la base (confirmé par erreur
Postgres directe, pas une supposition)

DOUBLE CRÉATION POSSIBLE AVANT
NON, entre les deux chemins historiquement envisagés (webhook vs mobile),
puisque le chemin webhole est mort. Un doute résiduel subsiste néanmoins
sur d'éventuels doubles appels internes au site lui-même (NON AUDITABLE).

CAUSE
Chemin webhook mort par absence de table (probable reliquat d'une
architecture antérieure jamais nettoyée ou jamais terminée)

SOURCE DE VÉRITÉ RETENUE
Mobile -> /api/create-airalo-order (site) -- de facto, aucun changement
structurel nécessaire puisque c'était déjà le seul chemin fonctionnel

CORRECTIF
Cache local (SecureStore) côté mobile, scopé par session Stripe, empêchant
tout second appel réseau pour une même session déjà traitée avec succès
sur le même appareil (app/esim/payment-success.tsx)

IDEMPOTENCE PAR STRIPE_SESSION_ID
❌ (aucune contrainte DB ne l'impose ; le correctif mobile réduit le risque
sans le supprimer complètement, faute d'accès au site)

DOUBLE CALLBACK
Non testable en conditions réelles (bloqué par Stripe live + absence
d'environnement de test dédié) ; protégé par construction côté mobile pour
le cas du remontage d'écran

DOUBLONS HISTORIQUES CONFIRMÉS
OUI (au moins 3 paires à quelques secondes d'écart, preuve directe)

PAYMENT-SUCCESS CRÉE ENCORE AIRALO
OUI (volontairement conservé, seul chemin réel), désormais protégé contre
les rappels multiples sur le même appareil

TEST TUNNEL
⚠️ Non exécuté de bout en bout (nécessite un vrai paiement ou un accès site) ;
scénario de test réel documenté pour le premier build TestFlight

================================
RLS INSURANCES
================================

POLICY INITIALE TROP LARGE
CONFIRMÉE (reconfirmée en production)

LECTURE CLIENT DIRECTE
Mobile : correcte, filtrée par email de session réelle, ne dépend pas de
la policy défaillante pour fonctionner

LECTURE ADMIN
NON AUDITABLE (code site requis)

MIGRATION ADMIN SERVEUR NÉCESSAIRE
NON DÉTERMINABLE depuis cet environnement -- bloque volontairement
l'application du correctif

POLICY CORRIGÉE
❌ (délibérément non appliquée, SQL de correction + rollback préparés et
documentés ci-dessus, prêts sur validation)

ANON → INSURANCES
REFUSÉ (testé réellement)

USER A → A
AUTORISÉ (testé réellement)

USER A → B
AUTORISÉ (ne devrait jamais l'être -- testé réellement avec données 100%
jetables)

ADMIN
⚠️ (fonctionnement actuel non auditable, à préserver lors d'une future
correction)

AVA_RAW EXPOSÉ À UN AUTRE CLIENT
OUI par construction de la policy (démontré, pas supposé)

================================
BACKEND ASSURANCE
================================

SITE ASSURANCE AUDITÉ
NON (bloqué, code du site inaccessible)

PRODUITS AVA
ava_carte_sante, ava_tourist_card (inchangé depuis la Phase 4C, aucune
nouvelle donnée disponible)

ROUTE DEVIS
NON AUDITABLE

MOTEUR TARIFAIRE
NON AUDITABLE (confirmé réel côté site via les données de la Phase 4C,
détails d'implémentation hors d'atteinte)

DONNÉES FORMULAIRE
NON AUDITABLE au-delà de ce qui était déjà su (Phase 4C)

STRIPE ASSURANCE
PaymentIntent (confirmé, inchangé)

MODE STRIPE ASSURANCE
INCONNU (les payment_intent ne révèlent pas leur mode aussi simplement que
les session ids sans appel direct à l'API Stripe, non disponible ici)

AVA SANDBOX
NON DÉTERMINÉ (nécessite le code/la config du site)

ÉMISSION CONTRAT
NON AUDITABLE au-delà des données déjà connues

SIGNAL FIABLE D'ÉMISSION
NON IDENTIFIÉ (aucune colonne de statut d'émission assureur distincte du
statut de paiement trouvée dans le schéma)

DOCUMENT
contract_link (seul champ réellement peuplé, inchangé depuis la Phase 4C)

EMAIL
NON AUDITABLE

IDEMPOTENCE ASSURANCE
⚠️ NON VÉRIFIABLE (code site requis)

================================
ARCHITECTURE MOBILE
================================

ARCHITECTURE RECOMMANDÉE
APP MOBILE -> JWT -> API/Edge Function serveur -> même moteur AVA que le
site -> Stripe -> table insurances existante (inchangé depuis la Phase 4C)

NOUVELLE EDGE FUNCTION NÉCESSAIRE
OUI probablement, à confirmer avec le code du site

API SITE RÉUTILISABLE
INCONNU

DUPLICATION MOTEUR AVA
NON

================================
TECHNIQUE
================================

RLS MODIFIÉE
NON (délibérément, voir gate ci-dessus)

SITE MODIFIÉ
NON

MOBILE MODIFIÉ
OUI (app/esim/payment-success.tsx uniquement -- cache d'idempotence local)

STRIPE MODIFIÉ
NON

AVA MODIFIÉ
NON

PAIEMENT RÉEL EFFECTUÉ
NON

CONTRAT RÉEL ÉMIS
NON

ROLLBACKS
✅ (SQL de rollback pour la policy RLS préparé et documenté, bien que la
policy elle-même n'ait pas été modifiée)

TYPESCRIPT
✅

BUILD
✅ (tsc uniquement exécuté ; pas de nouvelle vérification expo-export jugée
nécessaire pour un changement aussi limité, cohérent avec les vérifications
déjà faites en Phase 5)

================================
SUITE
================================

ESIM PRÊTE TESTFLIGHT
OUI, avec le risque de duplication mieux compris et partiellement réduit
côté mobile ; le doute résiduel côté site (Partie E bis, cas à quelques
secondes d'écart) doit être communiqué avant un volume réel important

ASSURANCE PRÊTE À ÊTRE INTÉGRÉE MOBILE
NON (backend site toujours hors d'atteinte)

BLOQUANTS
1. Accès au code du site fenuasim.com nécessaire pour : confirmer la
   dépendance admin de la policy insurances (débloque le correctif RLS),
   documenter le backend AVA (Parties R-Y), et clarifier le mécanisme
   exact des doublons Airalo à quelques secondes d'écart (Partie E bis)
2. Décision utilisateur sur le correctif RLS insurances (SQL prêt, non
   appliqué)

PHASE 4E RECOMMANDÉE
Phase 4E (intégration réelle assurance mobile) reste prématurée tant que
le blocage d'accès au code du site n'est pas levé. Recommandation : fournir
l'accès au dépôt du site (lecture seule suffit) avant de lancer la Phase 4E,
plutôt que de la tenter à nouveau sans cet accès.
```

**STOP → validation utilisateur requise**, conformément aux critères de sortie de cette phase (double création Airalo réduite mais pas formellement exclue côté site ; policy `insurances` toujours ouverte, corrective prête mais non appliquée ; backend AVA site toujours insuffisamment documenté pour la Phase 4E).
