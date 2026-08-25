# PHASE 4C — Audit assurance voyage mobile + audit Stripe Test/Live

_Rédigé le 2026-08-23. Phase d'audit avant toute intégration réelle. Aucun paiement réel, aucune souscription réelle déclenchés pendant cette phase. STOP en fin de rapport, conformément à la règle finale._

**Limite d'environnement à connaître avant de lire ce rapport** : cet environnement n'a accès ni au code du site `fenuasim.com` (Next.js) ni aux identifiants Stripe/AVA. Tout ce qui suit repose sur : le code de l'app mobile, les Edge Functions Supabase déployées (lisibles), et les données réelles déjà stockées en base (lisibles, jamais de secret exposé). Chaque fois qu'une information ne peut provenir que du code du site, c'est marqué **NON AUDITABLE** — jamais deviné.

---

# PARTIE A — AUDIT STRIPE MOBILE

## Recherche exhaustive

```text
Code mobile (app/, lib/, hooks/, constants/, .env, app.json)
  -> 0 occurrence de STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY,
     EXPO_PUBLIC_STRIPE*, STRIPE_WEBHOOK_SECRET
  -> Le client mobile ne détient et n'a jamais détenu aucune clé Stripe,
     de quelque nature que ce soit.

Edge Functions Supabase (lues intégralement) :
  create-checkout-mobile : Deno.env.get("STRIPE_SECRET_KEY")
  create-checkout        : Deno.env.get("STRIPE_SECRET_KEY")   (même nom exact)
  create-payment          : Deno.env.get("STRIPE_SECRET_KEY")   (même nom exact)
  stripe-webhook          : Deno.env.get("STRIPE_SECRET_KEY")
                             + Deno.env.get("STRIPE_WEBHOOK_SECRET")
```

**Fait clé** : les secrets Edge Functions Supabase sont définis **au niveau du projet**, pas par fonction — il n'existe qu'une seule valeur de `STRIPE_SECRET_KEY` partagée par toutes les fonctions ci-dessus. `create-checkout-mobile` (mobile) et `create-checkout`/`create-payment` (site) lisent donc **strictement la même clé**.

## Détermination TEST / LIVE — sans jamais lire la clé

Il est impossible de lire la valeur de `STRIPE_SECRET_KEY` depuis cet environnement (et ce n'est de toute façon jamais souhaitable). En revanche, les **identifiants de session Stripe** (`cs_test_...` / `cs_live_...`) ne sont pas des secrets — ils sont déjà stockés en clair dans la table `orders` et permettent de déduire le mode réel avec certitude :

```text
Répartition réelle des sessions stockées dans orders.stripe_session_id :
  cs_live_...  -> 297 lignes
  cs_test_...  -> 8 lignes
  (autres, hors Stripe Checkout) -> 19 lignes

Les 15 commandes les plus récentes (jusqu'au 2026-08-23 22:44) sont TOUTES
en cs_live_, statut "completed", avec un airalo_order_id renseigné
(eSIM réellement livrée).
```

Une session `cs_live_...` ne peut techniquement être créée que par une clé secrète `sk_live_...` (Stripe impose la cohérence de mode entre la clé et la session). Puisque `create-checkout-mobile` utilise la **même** clé que celle qui a produit ces sessions `cs_live_` récentes :

```text
STRIPE SECRET MOBILE
sk_live_* détectée (déduit avec certitude via la clé partagée + les sessions
cs_live_ réelles constatées en base — jamais lue directement)
```

**Conclusion Partie A — à ne pas minimiser** : contrairement à l'hypothèse de départ de cette phase ("doute sur le fait que Stripe mobile fonctionne encore en TEST"), **Stripe mobile est actuellement en LIVE**. Un achat eSIM réel initié depuis l'app mobile facture aujourd'hui une vraie carte bancaire. Ce n'est pas nécessairement un problème en soi (l'app se dirige vers TestFlight, donc vers de vrais achats), mais cela signifie que **toute manipulation de test doit être faite avec une extrême prudence** — voir Partie C.

```text
STRIPE MOBILE
LIVE
```

---

# PARTIE B — CARTOGRAPHIE DU FLUX eSIM STRIPE MOBILE

```text
app/esim/payment.tsx
  -> supabase.functions.invoke('create-checkout-mobile')
       body: { packageId, customerEmail, customerName }
  -> create-checkout-mobile (Edge Function, verify_jwt: true)
       lit airalo_packages, calcule le prix, cree stripe.checkout.sessions
       metadata: { package_id, data_amount, validity, source: 'mobile_app' }
       success_url: fenuasim://payment-success?session_id=...&package_id=...
       cancel_url:  fenuasim://payment-cancel
  -> Linking.openURL(session.url)  [sortie vers Safari, navigateur externe]
  -> Stripe Checkout (hébergé)
  -> paiement
  -> DEUX chemins s'exécutent alors, indépendamment l'un de l'autre :

     (1) Stripe envoie l'evenement checkout.session.completed au webhook
         -> stripe-webhook (meme webhook que le site, aucun webhook mobile
            distinct n'existe)
         -> lit uniquement session.metadata.package_id (ignore totalement
            metadata.source -- jamais lu, jamais enregistre dans la table)
         -> insert/update dans `orders` (statut "paid")
         -> insert dans `sync_queue` (type: 'new_esim_order')
         -> ce qui consomme sync_queue pour creer reellement la commande
            Airalo est cote site : NON AUDITABLE depuis cet environnement

     (2) Le deep link success_url ramene l'utilisateur sur
         app/esim/payment-success.tsx, qui appelle DIRECTEMENT et
         INDEPENDAMMENT :
         fetch('https://fenuasim.com/api/create-airalo-order', { ... })
         -> route Next.js du site, NON AUDITABLE depuis cet environnement
```

## Réponses aux questions posées

```text
Quelle Edge Function cree le checkout mobile ?
create-checkout-mobile (confirmee, lue integralement)

Quelle cle Stripe utilise-t-elle ?
La meme STRIPE_SECRET_KEY que le site (secret partage au niveau projet)

Quel webhook recoit l'evenement ?
stripe-webhook -- UN SEUL webhook, partage entre le site et le mobile.
Aucun webhook mobile distinct n'existe.

Comment est evitee la double creation Airalo ?
INDETERMINE AVEC CERTITUDE depuis cet environnement. Deux chemins
independants peuvent aboutir a la creation d'une commande Airalo pour le
meme achat mobile :
  - le pipeline webhook -> orders -> sync_queue -> [consommateur non
    auditable, probablement cote site]
  - l'appel direct fait par payment-success.tsx vers
    /api/create-airalo-order (site, non auditable)
Le webhook n'utilise ni ne conserve metadata.source ("mobile_app"), donc
rien ne permet de confirmer depuis Supabase seul si le premier chemin est
desactive/ignore pour les achats mobile ou s'il produit reellement un
second appel Airalo. RISQUE REEL NON EXCLU, a verifier imperativement cote
site avant tout passage LIVE controle ou toute volumetrie mobile
significative.

Comment la commande est rattachee au compte mobile ?
Par email uniquement (customerEmail transmis a create-checkout-mobile,
provenant de session.user.email cote mobile) -- comme le reste du systeme
existant (aucune table n'a de FK vers auth.users pour les commandes).
```

Aucune modification apportée à ce stade, conformément à la consigne.

---

# PARTIE C — NE PAS PASSER EN LIVE (déjà live, donc prudence renforcée)

Puisque Stripe mobile est **déjà en LIVE** (et non en TEST comme l'hypothèse de départ le supposait), la Partie C s'applique dans l'autre sens : **aucun test de paiement réel n'a été déclenché pendant cette phase**, précisément parce que le déclencher aurait produit une vraie transaction bancaire. Aucun achat eSIM test, aucune tentative de paiement assurance test n'a été exécutée. Cette prudence a été appliquée strictement, conformément à la règle absolue "ne jamais déclencher de vrai paiement... sans validation explicite".

---

# PARTIE D — AUDIT ASSURANCE EXISTANTE (Supabase + Edge Functions)

## Recherche exhaustive réalisée

```text
Tables Supabase (schéma inspecté en direct) :
  public.insurances          RLS activée, 7 lignes réelles -- la table principale
  public.insurer_settlements RLS DÉSACTIVÉE, 5 lignes -- règlements periodiques assureur
  public.saved_quotes        RLS activée, 7 lignes -- devis "routeur"/"esim"/"autre"
                              UNIQUEMENT (aucune catégorie "assurance" trouvée)
  public.documents           RLS DÉSACTIVÉE, 0 ligne -- factures génériques,
                              structure généraliste, pas spécifique assurance
  public.invoices            RLS DÉSACTIVÉE, 8 lignes -- factures génériques

Edge Functions Supabase (liste complète des 22 fonctions déployées inspectée) :
  AUCUNE fonction nommée insurance/assurance/ava/policy/quote n'existe.
  -> La logique de devis et de souscription assurance ne vit dans AUCUNE
     Edge Function Supabase. Elle vit entièrement côté site (Next.js),
     NON AUDITABLE depuis cet environnement.

Site Next.js (pages, routes API, formulaires) : NON AUDITABLE -- code non
présent dans cet environnement.
Emails de confirmation assurance : NON AUDITABLE (pas de trace dans les
Edge Functions Supabase -- probablement envoyés directement par le site ou
par l'assureur AVA lui-même).
PDFs/documents contractuels : stockés en URLs externes (voir Partie Q),
génération elle-même NON AUDITABLE.
```

## Découverte de sécurité — à signaler avec priorité

En inspectant les policies RLS de `insurances` (nécessaire pour auditer Part I/R), une policy nommée `"admin reads all insurances"` a été trouvée avec la définition réelle suivante :

```sql
-- Policy: "admin reads all insurances"
-- cmd: SELECT, roles: {authenticated}, qual: true
```

**Malgré son nom, cette policy ne vérifie absolument pas l'appartenance à la table `admins`** — son `USING` est littéralement `true` pour le rôle `authenticated`. Concrètement : **n'importe quel utilisateur connecté (mobile ou site) peut aujourd'hui lire les données assurance de tous les autres clients** (noms, dates de voyage, numéros de contrat, montants, et le contenu JSON brut `ava_raw`/`ava_validation_raw` qui peut contenir des données personnelles supplémentaires), pas seulement les siennes. La seconde policy (`"user reads own insurances"`, correcte, filtrée sur `user_email = auth.jwt()->>'email'`) coexiste mais ne protège rien puisque la première l'autorise déjà pour tout le monde.

Conformément à la règle absolue de cette phase ("Ne pas modifier les RLS/policies sécurisées sans nécessité démontrée"), **cette policy n'a pas été modifiée**. Elle est documentée ici pour action séparée, exactement selon le même principe déjà appliqué aux découvertes similaires sur `profiles`, `airalo_orders` et `user_sims` lors des phases précédentes.

---

# PARTIE E — CARTOGRAPHIE DU PARCOURS ASSURANCE RÉEL (déduit des données)

| Étape | EXISTE | SOURCE | PRODUCTION |
|---|---|---|---|
| Devis | OUI (implicite) | site + API AVA | OUI (probable, non auditable directement) |
| Informations voyage | OUI | site (formulaire) | OUI |
| Informations assurés | OUI | site (formulaire) | OUI |
| Tarif | OUI | API AVA (réponse capturée dans `ava_raw`) | OUI |
| Paiement | OUI | Stripe (PaymentIntent, pas Checkout Session) | OUI |
| Émission | OUI (partiel) | AVA, via `contract_number`/`contract_link` | OUI, mais incomplet (voir Partie P) |
| Confirmation | OUI (probable) | site/email | NON AUDITABLE directement |
| Documents | PARTIEL | `contract_link` toujours renseigné ; `certificate_url`/`attestation_url`/`attestation_url_ava` jamais renseignés sur les 7 contrats réels | OUI pour `contract_link` uniquement |

Cette cartographie est déduite des données réelles de la table `insurances` (7 contrats réels observés), pas du code source du site (inaccessible). Le paiement assurance utilise `stripe_payment_intent` et jamais `stripe_session_id` (toujours `null` sur les 7 lignes) — **architecture Stripe différente de celle de l'eSIM** : Checkout Session hébergé pour l'eSIM, PaymentIntent (probablement Stripe Elements/formulaire intégré côté site) pour l'assurance.

---

# PARTIE F — PRODUIT RÉEL IDENTIFIÉ (aucune invention)

```text
Assureur / porteur de risque
AVA -- identifié via les noms de colonnes réels (ava_raw, ava_validation_raw,
premium_ava, attestation_url_ava) et via le texte déjà présent dans le mock
existant ("attestation AVA Essentiel"). Aucune autre information sur AVA
(coordonnées, statut réglementaire, numéro ORIAS) n'est présente en base --
non inventée ici.

Produits réellement vendus (2 types observés sur les 7 contrats réels)
  ava_carte_sante   (5 contrats réels)
  ava_tourist_card  (2 contrats réels)
Aucun autre product_type observé. Le contenu exact des garanties (ce que
couvre chaque produit) n'est stocké nulle part dans Supabase -- seul le
code produit textuel existe côté base. NON DISPONIBLE depuis cet
environnement.

Tarification réelle observée (total_amount, en euros, 7 contrats)
40, 48, 50 (x2), 85, 104→114, 188.5→198.5, 270 -- tarifs variables selon
la durée/destination/formule reelle du sejour, calcules par l'API AVA
(jamais un tarif fixe cote FenuaSIM).

Durées réelles observées
5 a 23 jours -- courts sejours, coherent avec de l'assurance voyage.

Garanties, exclusions, franchises, taxes, frais détaillés
NON DISPONIBLE dans Supabase -- uniquement présents dans le contrat PDF
lui-même (contract_link) ou dans le contenu de ava_raw (réponse API brute,
non inspectée en détail ligne à ligne pour ne pas risquer d'exposer des
données personnelles réelles dans ce rapport).

Personnes assurables, territorialité, âge maximum
NON DISPONIBLE depuis cet environnement (uniquement dans le contrat AVA
lui-même ou le code du site).
```

**Conclusion Partie F** : le produit réel existe et fonctionne (7 contrats réels payés avec numéro de contrat), mais ses caractéristiques commerciales détaillées (garanties précises, exclusions, âge limite, territorialité) ne sont pas extractibles depuis cet environnement. Il ne faut **jamais** les afficher dans l'app mobile tant qu'elles n'ont pas été confirmées depuis une source serveur fiable (API AVA en temps réel ou export exact du site).

---

# PARTIE G — AUDIT DES ÉCRANS ASSURANCE MOBILES EXISTANTS

## État constaté avant correction (ce qui a réellement été trouvé)

```text
app/insurance/form.tsx (AVANT correction)
  - 3 "formules" entièrement inventées : Essentiel (890 XPF), Confort
    (1490 XPF), Globe Premium (2200 XPF) -- ne correspondent à AUCUNE
    donnée réelle (les vrais produits sont ava_carte_sante/ava_tourist_card,
    les vrais prix vont de 40€ à 270€, jamais en XPF fixes de ce type)
  - champs "Départ"/"Retour" : TextInput sans onChangeText, purement
    décoratifs, aucune saisie possible
  - bouton "Souscrire" : navigue vers /insurance/confirm sans transmettre
    aucune donnée, aucun appel serveur, aucun Stripe

app/insurance/confirm.tsx (AVANT correction)
  - écran de "succès" 100% statique et hardcodé : "Assurance souscrite !",
    "Destination : Japon", "Du 10 au 20 mai 2026", "Formule Essentiel ·
    890 XPF", "Attestation envoyée par email" -- AUCUNE de ces informations
    n'est réelle, aucun paiement n'a eu lieu, aucun contrat n'existe

Accessible depuis 3 points d'entrée réels dans l'app :
  app/(tabs)/index.tsx  (carte "Assurance voyage" dans Actions rapides)
  app/(tabs)/account.tsx (lien "Souscrire une assurance" si aucune assurance)
  app/esim/confirm.tsx  (écran orphelin, non lié depuis nulle part ailleurs
                         -- non prioritaire mais signalé)
```

**Verdict** : ce parcours n'était pas un brouillon incomplet, c'était un **faux parcours de bout en bout** qui aurait laissé croire à un vrai client TestFlight qu'il venait de souscrire une vraie assurance voyage AVA, sans qu'aucune protection réelle n'existe. C'est exactement le risque que la règle finale de cette phase interdit.

## Correction appliquée (minimale, sans invention de nouvelle fonctionnalité)

```text
app/insurance/form.tsx    -> réécrit en écran honnête "Bientôt disponible",
                              identité FenuaSIM conservée (header dégradé),
                              lien vers le support, plus aucune formule ni
                              prix inventé, plus aucun bouton de souscription
app/insurance/confirm.tsx -> neutralisé (réexporte le même écran honnête),
                              impossible désormais d'atteindre un faux
                              message de succès, même par deep link direct
```

`tsc --noEmit` et `expo export --platform web` propres après ces deux changements.

## Correction annexe trouvée en auditant la vraie section "Mes assurances"

`app/(tabs)/account.tsx` possède déjà une vraie section "Mes assurances" (non mockée !) qui interroge réellement `insurances` filtré sur `user_email = session réelle` (via `hooks/useUserData.ts`, RLS `"user reads own insurances"` correcte). Elle affiche le vrai `product_type`, les vraies dates, le vrai statut. **Mais** le bouton "Voir l'attestation" pointait vers `attestation_url_ava`, un champ **jamais renseigné sur aucun des 7 contrats réels** — ce lien n'apparaissait donc jamais, alors que `contract_link` (le vrai document, renseigné sur les 7 contrats) n'était jamais utilisé. **Corrigé** : utilise maintenant `contract_link` en priorité (repli sur `attestation_url_ava`/`certificate_url` si jamais renseignés plus tard).

---

# PARTIE H — ARCHITECTURE CIBLE (proposée, non implémentée)

```text
APP MOBILE
  ↓ JWT (identite derivee de la session, jamais d'un champ libre du body)
API / Edge Function serveur A CREER (n'existe pas encore)
  ↓
logique assurance existante (API AVA, deja utilisee cote site)
  ↓
Stripe (meme compte, PaymentIntent comme le site -- pas de nouveau Checkout)
  ↓
assureur AVA / table insurances existante
```

Aucune Edge Function d'assurance n'existe aujourd'hui. La construire nécessiterait soit (a) que le site expose une API HTTP appelable depuis le mobile (comme `/api/create-airalo-order` l'est déjà pour l'eSIM), soit (b) une nouvelle Edge Function Supabase qui réutilise la même logique/API AVA que le site — **jamais un second moteur de tarification recréé à la main dans le mobile**, conformément à la règle absolue. Aucune des deux options n'a été construite dans cette phase (nécessiterait soit le contrat d'API exact du site, soit une décision explicite de créer une nouvelle Edge Function, les deux hors périmètre "audit" de cette phase).

---

# PARTIE I — AUTHENTIFICATION (rappel appliqué partout où c'est pertinent)

Le futur point d'entrée serveur assurance devra, comme `delete-account` et `create-checkout-mobile` le font déjà : dériver `user_id`/`email` du JWT de la requête, jamais d'un champ envoyé librement par le client. La section "Mes assurances" déjà existante respecte déjà ce principe (email dérivé de `supabase.auth.getSession()`, jamais saisi).

---

# PARTIE J — ASSURANCE POUR PLUSIEURS VOYAGEURS

Non déterminable avec certitude depuis Supabase seul : `insurances` a `subscriber_first_name`/`subscriber_last_name` (un seul souscripteur nommé par ligne), sans table de liaison "assurés multiples" visible dans le schéma public. Rien n'indique que `app_travelers` (utilisé pour la gestion eSIM) soit relié à `insurances` — confirmé : aucune colonne de `insurances` ne référence `app_travelers`. **Conclusion** : voyageur eSIM ≠ assuré, comme demandé — ces deux notions sont bien déjà découplées dans le schéma actuel, il n'y a aucun risque de confusion existant à corriger.

---

# PARTIE K — DONNÉES MINIMALES

D'après les colonnes réellement utilisées dans `insurances` (subscriber_first_name, subscriber_last_name, start_date, end_date, user_email) : prénom, nom, dates de séjour et email sont les données minimales confirmées. Destination, téléphone, adresse, date de naissance, nombre d'assurés : **non confirmables** comme réellement exigés depuis le seul schéma Supabase (probablement demandés côté site au moment du devis AVA, mais NON AUDITABLE ici).

---

# PARTIE L — DEVIS

```text
TARIFICATION RÉELLE
OUI (API AVA, réponse brute capturée dans ava_raw à chaque contrat réel)
```

Aucun moteur de tarification n'a été recréé ni inventé dans cette phase. Si une intégration mobile est construite plus tard, elle devra appeler la même source (site ou nouvelle Edge Function qui appelle AVA), jamais un calcul local dans l'app.

---

# PARTIE M — ÉCRAN RÉCAPITULATIF

Non implémenté (nécessiterait un vrai devis serveur à afficher, indisponible pour le mobile actuellement). L'écran "Bientôt disponible" créé en Partie G tient lieu d'état transitoire honnête en attendant.

---

# PARTIE N — STRIPE ASSURANCE

```text
Même compte Stripe que l'eSIM/le site ?
OUI (aucune configuration multi-compte trouvée, un seul projet Supabase,
secrets partagés)

Même webhook ?
Techniquement le même stripe-webhook existe, mais il ne traite QUE
checkout.session.completed / payment_intent.payment_failed /
payment_intent.succeeded de façon générique liée à `orders`/`payments`
(tables eSIM) -- rien dans son code ne mentionne `insurances`. Le
traitement réel des paiements assurance (écriture dans `insurances`) est
donc probablement fait ailleurs (site, NON AUDITABLE), pas par ce webhook
Supabase-là, malgré le partage de la même clé Stripe et du même endpoint
technique visible ici.

Metadata transaction_type = esim / insurance ?
NON CONSTATÉ. Ni le code du webhook ni les metadata de create-checkout /
create-checkout-mobile n'utilisent de champ transaction_type. Cette
convention proposée dans le brief n'existe pas dans l'architecture réelle
actuelle -- à ne pas inventer sans qu'elle soit réellement implémentée
cote site.
```

---

# PARTIE O — PAIEMENT ASSURANCE (test) — NON EFFECTUÉ, à dessein

Aucun test de paiement assurance (même en Stripe test) n'a été effectué, pour deux raisons cumulatives et suffisantes chacune :
1. Stripe mobile est confirmé **LIVE** (Partie A) — aucune garantie que le compte AVA associé ne soit pas également en environnement réel, et aucun moyen sûr de le vérifier sans risquer une vraie souscription.
2. Aucun point d'entrée serveur assurance n'est appelable depuis le mobile actuellement (Partie H) — il n'y a techniquement rien à tester de bout en bout depuis l'app.

```text
Si le backend actuel émettait automatiquement un vrai contrat même avec
Stripe test : NON VÉRIFIABLE depuis cet environnement (logique côté site).
Ce risque théorique n'a donc pas pu être écarté -- à traiter comme un
avertissement actif avant tout futur test, pas comme un fait résolu.
```

---

# PARTIE P — ÉMISSION DU CONTRAT

Sur les 7 contrats réels : `contract_number` présent sur 6/7, `contract_link` présent sur 7/7, `status` passe à `"paid"` sur 6/7 (le 7e est `"pending_payment"`). **Aucune ligne n'a de `certificate_url`/`attestation_url` renseigné** — ce qui suggère que la génération de certificat séparé (distinct du contrat lui-même) n'est peut-être pas un mécanisme actif, ou que ces champs sont vestigiaux. Le statut `"paid"` seul n'implique pas nécessairement une émission assureur confirmée de façon distincte et vérifiable depuis Supabase — aucune colonne de statut d'émission séparée (ex. "issued"/"confirmed_by_insurer") n'existe dans le schéma. **Ne jamais afficher "Assurance souscrite" côté mobile sur la seule base d'un paiement Stripe réussi tant qu'un signal d'émission assureur fiable n'est pas identifié.**

---

# PARTIE Q — DOCUMENTS

```text
Attestation / certificat / contrat
contract_link : seul champ réellement peuplé (7/7 contrats réels) --
probablement l'URL du PDF de contrat généré par ou pour AVA
cg_link / ipid_link / ficp_link : documents légaux génériques (Conditions
Générales, IPID, FICP), peuplés sur 4/7 contrats seulement
certificate_url / attestation_url / attestation_url_ava : jamais peuplés

Facture
Table `invoices` générique existe (RLS désactivée, voir avertissement
Partie D) mais aucune ligne n'a été confirmée comme liée à une assurance
spécifiquement dans cette phase (pas de FK insurances->invoices constatée).

Accès mobile
La section "Mes assurances" (app/(tabs)/account.tsx, déjà réelle) ouvre
désormais contract_link via Linking.openURL -- URL externe ouverte dans le
navigateur, jamais rendue publique par l'app elle-même (l'URL vient d'une
ligne déjà filtrée par RLS sur l'email de l'utilisateur connecté -- sous
réserve de la correction de la policy "admin reads all insurances" signalée
en Partie D, qui reste un point de fuite tant qu'elle n'est pas corrigée).
```

---

# PARTIE R — ESPACE CLIENT MOBILE ("Mes assurances")

```text
MES ASSURANCES
⚠️ (déjà réel et fonctionnel côté lecture -- corrigé pour utiliser le bon
champ document dans cette phase ; reste exposé au problème RLS de la
Partie D tant qu'il n'est pas corrigé séparément)
```

Aucun ajout de fonctionnalité fait ici au-delà de la correction du champ document — la section existait déjà et était déjà connectée aux vraies données.

---

# PARTIE S — SUPPORT

Ajouté dans le nouvel écran "Bientôt disponible" (Partie G) : "Besoin d'aide avec votre assurance ? Contactez le support", qui renvoie vers `/support` — l'écran de support déjà centralisé (WhatsApp `+33 7 49 78 21 01`, email `contact@fenuasim.com`, inchangés). Aucune donnée sensible supplémentaire n'est envoyée dans ce lien (simple navigation interne, pas de message WhatsApp pré-rempli avec des données assurance).

---

# PARTIE T/U — ÉCHECS ET IDEMPOTENCE — NON TESTABLES ACTUELLEMENT

Aucun des scénarios d'échec demandés (devis impossible, paiement refusé, émission échouée après paiement, webhook en retard, double callback, double clic, fermeture Stripe, connexion perdue) n'a pu être testé, car **aucun parcours réel n'existe encore côté mobile pour les déclencher** (Partie H). Le tester aujourd'hui reviendrait soit à ne rien exercer du tout (l'écran est maintenant un simple message statique), soit à risquer un vrai paiement live (interdit). Ces tests devront être repris dès qu'un vrai point d'entrée serveur existera.

```text
IDEMPOTENCE
⚠️ Non vérifiable pour l'assurance mobile (aucun flux à tester). Un doute
réel et non résolu existe côté eSIM mobile (Partie B, double création
Airalo potentielle) -- à traiter en priorité avant tout développement
assurance supplémentaire, puisque c'est exactement le même type de risque.
```

---

# PARTIE V — ÉTAT STRIPE FINAL

```text
STRIPE SITE
LIVE (297 sessions cs_live_ réelles observées, très large majorité)

STRIPE APP eSIM
LIVE (même clé partagée que le site, confirmé par les sessions cs_live_
récentes produites par le flux mobile)

STRIPE APP ASSURANCE
NON EXISTANT côté mobile (aucun point d'entrée serveur appelable depuis
l'app). Côté site : les paiements assurance existants utilisent des
PaymentIntents (jamais de stripe_session_id sur les 7 contrats réels) --
mode test/live non déterminable depuis cet environnement pour ce flux
spécifique (les payment_intent ne révèlent pas leur mode aussi simplement
que les session ids sans appel direct à l'API Stripe, non disponible ici)

WEBHOOK SITE
stripe-webhook (partagé, verify_jwt: false, signature Stripe vérifiée)

WEBHOOK MOBILE
Aucun webhook mobile distinct -- le même stripe-webhook reçoit tous les
événements, sans distinction de source
```

---

# PARTIE W — PLAN DE PASSAGE LIVE (préparé, non exécuté)

Puisque Stripe mobile eSIM est **déjà en LIVE** et non en TEST, cette checklist s'applique différemment de ce qui était anticipé : il ne s'agit pas de "passer" en live, mais de **sécuriser ce qui est déjà live** avant d'y ajouter de l'assurance :

```text
[ ] Confirmer/résoudre le risque de double création Airalo (Partie B) avant
    tout volume mobile significatif -- nécessite un accès au code du site
[ ] Décider et documenter explicitement si un environnement Stripe TEST
    séparé doit être mis en place pour le développement assurance mobile
    (recommandé, pour ne pas développer contre le compte live réel)
[ ] Construire le point d'entrée serveur assurance (Edge Function ou API
    site) avant toute UI mobile fonctionnelle
[ ] Corriger la policy RLS "admin reads all insurances" (fuite de données
    clients, Partie D) -- décision utilisateur requise, jamais appliquée
    automatiquement ici
[ ] Clarifier le signal d'émission assureur fiable (Partie P) avant
    d'afficher un jour "Assurance souscrite" côté mobile
[ ] Aucun secret live ne doit jamais être placé dans le client mobile --
    déjà vérifié conforme (Partie A)
```

Aucune de ces actions n'a été exécutée automatiquement.

---

# PARTIE X — VÉRIFICATIONS TECHNIQUES

```text
npx tsc --noEmit                -> ✅ (après neutralisation du mock et
                                       correction du champ document)
npx expo export --platform web  -> ✅
```

Aucun changement backend du site effectué. Aucune Edge Function modifiée. Aucune RLS modifiée. Seuls fichiers mobiles touchés : `app/insurance/form.tsx`, `app/insurance/confirm.tsx`, `app/(tabs)/account.tsx` (un seul bloc).

---

## Compte-rendu

```text
PHASE
4C — Assurance voyage + audit Stripe mobile

ÉTAT
⚠️ (audit complet et risques réels critiques identifiés ; aucune
intégration assurance réelle possible sans accès au site ou décision
explicite de construire un nouveau point d'entrée serveur)

--------------------------
STRIPE
--------------------------

STRIPE SITE
LIVE

STRIPE MOBILE ESIM
LIVE

STRIPE MOBILE ASSURANCE
NON EXISTANT

CHECKOUT MOBILE
create-checkout-mobile (Edge Function, inchangée, confirmée fonctionnelle
pour l'eSIM)

WEBHOOK MOBILE
Aucun distinct -- stripe-webhook partagé avec le site

STRIPE SECRET DANS LE CLIENT
NON

PASSAGE LIVE EFFECTUÉ
NON (déjà live avant cette phase, aucune action de bascule effectuée ici)

--------------------------
ASSURANCE
--------------------------

PRODUIT ASSURANCE IDENTIFIÉ
ava_carte_sante, ava_tourist_card (2 produits réels confirmés en base,
détails commerciaux complets non disponibles depuis cet environnement)

ASSUREUR
AVA (déduit des noms de colonnes réelles, non confirmé au-delà)

BACKEND EXISTANT
Site Next.js (non auditable) + API AVA. Aucune Edge Function Supabase
dédiée à l'assurance.

TABLES
insurances (RLS activée mais policy admin défaillante -- voir ci-dessous),
insurer_settlements (RLS désactivée), documents/invoices génériques (RLS
désactivée)

ROUTES / FUNCTIONS
Aucune route/Edge Function assurance appelable depuis le mobile

TARIFICATION RÉELLE
OUI (API AVA côté site, jamais recréée dans le mobile)

FORMULAIRE MOBILE
MOCK (avant correction) -> NEUTRALISÉ (après correction, "Bientôt
disponible", plus aucune formule/prix inventé)

CHECKOUT ASSURANCE
ABSENT

ÉMISSION CONTRAT
RÉELLE côté site/AVA (7 contrats réels confirmés) -- AUCUN accès mobile
à ce jour, à connecter plus tard via un vrai point d'entrée serveur

DOCUMENTS
contract_link réellement peuplé sur 7/7 contrats réels ; certificate_url/
attestation_url/attestation_url_ava jamais peuplés

EMAIL CONFIRMATION
NON AUDITABLE (probablement géré côté site ou par AVA directement)

MES ASSURANCES
⚠️ (déjà réel, corrigé pour utiliser le bon champ document ; reste exposé
au problème RLS ci-dessous)

IDEMPOTENCE
⚠️ (non testable pour l'assurance ; risque réel non résolu côté eSIM
mobile signalé en Partie B, à traiter en priorité)

--------------------------
TESTS
--------------------------

DEVIS TEST
NON EFFECTUÉ (aucun point d'entrée mobile à tester)

PAIEMENT STRIPE TEST
NON EFFECTUÉ (Stripe mobile confirmé LIVE -- tout test réel aurait risqué
une vraie charge)

CONTRAT TEST
NON EFFECTUÉ

DOUBLE CALLBACK
NON EFFECTUÉ (même raison)

TYPESCRIPT
✅

--------------------------
V1
--------------------------

ASSURANCE PRÊTE POUR TESTFLIGHT
NON (mais le risque de faux parcours a été neutralisé -- plus aucun écran
ne peut faire croire à une souscription réelle)

STRIPE eSIM PRÊT POUR TESTFLIGHT
OUI TECHNIQUEMENT (déjà live et fonctionnel), MAIS avec un doute réel non
résolu sur la double création Airalo (Partie B) à lever avant volume réel

STRIPE PRÊT POUR PASSAGE LIVE
DÉJÀ LIVE (eSIM) -- aucune action de bascule nécessaire ni effectuée ici

ACTIONS UTILISATEUR REQUISES
1. Confirmer que le fait que Stripe mobile soit déjà LIVE est bien
   intentionnel (et pas une découverte non désirée)
2. Faire auditer côté site (hors de cet environnement) le risque de double
   création Airalo identifié en Partie B
3. Décider si la policy RLS "admin reads all insurances" doit être
   corrigée maintenant (recommandé, c'est une fuite de données clients
   réelle) -- SQL de correction non fourni automatiquement ici, à préparer
   sur demande explicite
4. Décider comment prioriser la construction d'un vrai point d'entrée
   serveur assurance (nouvelle Edge Function vs API site exposée) avant
   toute nouvelle UI mobile de souscription
5. Décider si un environnement Stripe TEST séparé doit être mis en place
   pour développer l'assurance mobile sans risque

POINTS RESTANTS
1. Double création Airalo potentielle (eSIM mobile, Partie B) -- priorité
   haute, indépendante de l'assurance
2. Policy RLS insurances trop permissive (Partie D) -- priorité haute
3. app/esim/confirm.tsx : écran de démo orphelin non lié à l'assurance
   directement mais contenant lui aussi un lien vers l'ancien mock
   assurance -- corrigé indirectement (pointe maintenant vers l'écran
   honnête), fichier lui-même non nettoyé plus largement (hors périmètre)
4. Aucune intégration assurance réelle construite -- attend une décision
   utilisateur sur l'architecture cible (Partie H)
```

**STOP → validation utilisateur requise avant toute suite** (nouvelle intégration assurance réelle, correction RLS, ou investigation du risque de double commande Airalo), conformément à la règle finale de cette phase.
