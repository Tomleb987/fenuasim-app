# PHASE 4E — Dossier de transmission pour exécution dans le dépôt du site

_Ce document est destiné à être exécuté (ou fourni à un agent/développeur) dans un environnement ayant accès au dépôt `fenuasim.com` (Next.js). Il consolide tout ce que les Phases 4C et 4D ont déjà établi côté Supabase/mobile, pour éviter de refaire cet audit. Toutes les mentions "NON AUDITABLE" ci-dessous sont exactement ce que cette phase doit résoudre._

---

## Ce qui est déjà prouvé (Supabase, réel, pas à revérifier)

```text
sync_queue n'existe pas comme table (ERROR 42P01, confirmé en direct).
  -> stripe-webhook (Edge Function Supabase) tente d'y insérer après chaque
     checkout.session.completed, échoue silencieusement (try/catch avale
     l'erreur, renvoie 200 à Stripe quand même), ne crée donc jamais de
     commande Airalo par cette voie. Chemin mort, confirmé, pas une
     supposition sur le site.

Pour les achats mobiles, le SEUL chemin réel de création Airalo est :
  app/esim/payment-success.tsx (mobile)
    -> fetch POST https://fenuasim.com/api/create-airalo-order
       body: { packageId, airalo_id, customerEmail, customerName,
                customerFirstname: '', quantity: 1, description }
  Cette route reçoit UNIQUEMENT ces champs -- PAS de stripe_session_id
  actuellement transmis par le mobile. À vérifier/corriger en Partie B/D.

Aucune contrainte DB ne protège contre un double appel Airalo pour le même
paiement :
  - orders.stripe_session_id : aucune contrainte UNIQUE
  - airalo_orders : aucune colonne stripe_session_id du tout
  - airalo_orders_order_id_key UNIQUE(order_id) protège seulement contre
    une double INSERTION locale d'un résultat DÉJÀ obtenu d'Airalo -- pas
    contre un second appel API réel (qui produirait un second order_id
    bien réel, donc une seconde eSIM réellement facturée)

Doublons historiques réels trouvés dans airalo_orders (preuve directe, pas
une coïncidence email+package) :
  - au moins 3 paires créées 1 à 44 secondes d'écart pour le même
    email+package_id -- incompatible avec un ré-achat humain volontaire
  Mécanisme exact non déterminable sans le code du site -- c'est
  précisément la Partie B/C de cette phase qui doit le résoudre.

Édge Function Supabase "create-airalo-order" existe (distincte de la route
Next.js du même nom), appelle réellement l'API Airalo, écrit dans
airalo_orders. Son déclencheur réel côté site est NON AUDITABLE -- à
vérifier : le site l'appelle-t-il, ou est-elle un vestige inutilisé ?

pg_cron (5 jobs actifs) et les 22 Edge Functions Supabase ont été
intégralement passés en revue : aucun ne consomme/traite une éventuelle
file d'attente de commandes eSIM. Rien côté Supabase ne remplace le rôle
attendu de /api/create-airalo-order.
```

## Correctif mobile déjà en place (ne pas dupliquer côté site)

```text
app/esim/payment-success.tsx (dépôt mobile, déjà modifié et déployé) :
  avant tout appel à /api/create-airalo-order, vérifie un cache local
  (SecureStore, clé = session_id Stripe exact) ; si un résultat existe déjà
  pour cette session sur cet appareil, le réutilise sans rappel réseau.

  C'est une protection UX/client uniquement -- elle ne protège pas contre
  un mécanisme de duplication interne au site lui-même, ni contre deux
  appareils/onglets différents. La vraie protection doit être serveur
  (c'est l'objet des Parties E à M de cette phase).
```

## RLS `insurances` — fuite prouvée, correctif prêt, NON appliqué

```sql
-- Policies réelles en production (reconfirmées 2 fois, Phases 4C et 4D) :
"admin reads all insurances"  cmd=SELECT  roles={authenticated}  qual=true
"user reads own insurances"   cmd=SELECT  roles={public}
                               qual=(user_email = auth.jwt()->>'email')
```

```text
Fuite prouvée réellement (Phase 4D) avec 2 comptes 100% jetables : un
compte A sans aucun lien avec l'assurance a pu lire, via son propre JWT
authentifié : sa propre ligne de test, la ligne de test d'un compte B, ET
les 7 lignes de vrais clients FenuaSIM (comptage vérifié, aucun contenu
affiché). anon (sans JWT) correctement bloqué (0 ligne).
```

**SQL de correction prêt, jamais exécuté** (à appliquer seulement après la Partie P de cette phase, c'est-à-dire après avoir confirmé qu'aucune page admin du site ne dépend de cette policy ouverte pour lire `insurances` directement depuis le navigateur) :

```sql
-- ROLLBACK si besoin de revenir en arrière :
-- create policy "admin reads all insurances" on public.insurances
--   for select to authenticated using (true);

begin;
drop policy if exists "admin reads all insurances" on public.insurances;
-- Si un accès admin légitime doit être préservé sans passer par un serveur,
-- repli possible (à valider selon l'architecture admin réelle du site) :
-- create policy "admin reads all insurances" on public.insurances
--   for select to authenticated
--   using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
commit;
```

## Backend assurance AVA — ce qu'on sait déjà depuis les données réelles Supabase

```text
Table insurances (7 contrats réels observés) :
  Produits réels : ava_carte_sante (5), ava_tourist_card (2) -- pas
    d'autre product_type observé, mais Partie X doit confirmer si d'autres
    produits existent dans le code/l'API sans avoir encore de contrat
  Tarifs réels observés : 40€ à 270€ (variable, via l'API AVA, jamais fixe)
  Durées réelles observées : 5 à 23 jours
  Paiement : stripe_payment_intent renseigné sur la quasi-totalité des
    lignes, stripe_session_id TOUJOURS null -- l'assurance n'utilise PAS
    Stripe Checkout Session comme l'eSIM, mais un PaymentIntent direct
    (probablement Stripe Elements côté site)
  contract_link : seul champ document réellement peuplé (7/7)
  certificate_url / attestation_url / attestation_url_ava : jamais peuplés
    sur aucun contrat réel -- soit vestiges, soit mécanisme non actif
  ava_raw (jsonb, réponse API brute) : présent sur 7/7, contient
    Certificat de garantie / CG / FICP / IPID (liens documents),
    Numéro AD / Numéro IN (références internes AVA), Prix total avec
    options -- valeurs jamais des objets imbriqués, jamais de nom/adresse
    en clair trouvé à ce niveau
  ava_validation_raw : toujours null sur les 7 contrats réels -- une étape
    de validation existe peut-être dans le code sans jamais avoir été
    déclenchée, ou n'est pas utilisée
  settlement_id : toujours null -- aucun contrat encore rapproché d'un
    règlement assureur

Aucune Edge Function Supabase n'existe pour l'assurance (22 fonctions
passées en revue). La logique de devis/souscription vit entièrement dans
le code du site -- c'est tout l'objet des Parties V à AI de cette phase.
```

## Checklist exacte pour l'environnement qui a accès au site

```text
[ ] Partie A : confirmer repo/branch/HEAD/URL production
[ ] Partie B : lire /api/create-airalo-order intégralement, répondre
    précisément : peut-elle appeler Airalo deux fois pour le même paiement ?
[ ] Partie D : vérifier que la route revalide stripe_session_id auprès de
    Stripe (payment_status=paid) au lieu de faire confiance aux champs
    envoyés par le client mobile
[ ] Parties E-K : idempotence serveur réelle (clé = stripe_session_id),
    protection contre appels concurrents, contrainte UNIQUE si justifiée
[ ] Partie O/P : identifier si une page admin lit insurances directement
    depuis le navigateur -- c'est LE point qui débloque le correctif RLS
    déjà préparé ci-dessus
[ ] Partie Q/S : créer/réutiliser une route /api/admin/insurances avec
    requireAdmin(), puis seulement alors supprimer la policy ouverte
[ ] Parties V-AI : cartographier le backend AVA reel (endpoint, formulaire,
    ordre paiement/émission, signal fiable d'émission, documents, email,
    idempotence assurance, environnement de test)
[ ] Partie AG : conclure si l'API site est réutilisable telle quelle par
    le mobile, ou si une nouvelle Edge Function doit être créée
```

## Rappels de règles absolues (valables aussi dans le nouvel environnement)

```text
Ne pas modifier l'UI mobile dans cette phase (déjà figée, "Bientôt disponible")
Ne pas déclencher de vrai paiement/vraie commande Airalo/vrai contrat AVA
sans validation explicite
Ne jamais exposer de clé Stripe/AVA/service_role
Ne pas recréer un second moteur assurance
Ne pas remettre une policy globale authenticated USING(true)
```
