# PHASE 3 — Audit suppression de compte (AUCUNE suppression effectuée)

_Rédigé le 2026-08-23. Audit pur, aucune donnée modifiée ou supprimée, aucune fonction créée. Toutes les contraintes réelles (FK, cascades) ont été relues en direct sur le schéma de production, pas déduites des noms de colonnes._

## Méthode et périmètre

Recherche exhaustive sur les 46+ tables du schéma `public` : toute colonne `user_id`, `email`/`*_email`, `customer_id`, `stripe_customer_id`, `order_id`, `phone`, `nom/prenom/first_name/last_name/full_name`, `address`. **37 tables/vues** contiennent au moins une de ces colonnes. Les documenter toutes avec le même niveau de détail produirait un document ingérable ; j'ai donc trié :

- **Documentation complète** (bloc demandé en B2) pour les tables directement liées à un **client final** de l'app mobile (celui qui aurait un bouton "Supprimer mon compte").
- **Traitement groupé bref** pour les tables liées à d'autres types d'acteurs (partenaires B2B, prospects commerciaux jamais devenus clients, staff interne) — hors périmètre d'une suppression de compte client, sauf cas particulier signalé.

---

## B1-B2. Tables directement liées à un compte client — documentation complète

### `auth.users`
```text
DONNÉE UTILISATEUR : identité d'authentification (email, mot de passe hashé, métadonnées)
CLÉ DE LIAISON : id (uuid), racine de toute la hiérarchie
RÔLE MÉTIER : compte de connexion
PEUT ÊTRE SUPPRIMÉE ? À CONFIRMER — uniquement en toute dernière étape (voir B4/B12)
PEUT ÊTRE ANONYMISÉE ? Non pertinent (le compte disparaît, pas de conservation de l'identité de connexion)
DOIT ÊTRE CONSERVÉE ? Non, une fois le processus de suppression terminé
RISQUE SI SUPPRESSION PRÉMATURÉE : bloque toute future action liée (voir cascades B4/B5) ; irréversible immédiatement
DÉPENDANCES : voir carte complète en B5
```

### `profiles`
```text
DONNÉE UTILISATEUR : full_name, avatar_url, phone, email, statuts de vérification
CLÉ DE LIAISON : id (uuid) = auth.users.id, FK réelle CASCADE
RÔLE MÉTIER : profil applicatif affiché dans Compte
PEUT ÊTRE SUPPRIMÉE ? OUI
PEUT ÊTRE ANONYMISÉE ? Non nécessaire (supprimable directement)
DOIT ÊTRE CONSERVÉE ? NON
RISQUE SI SUPPRESSION : aucun — écran Compte gère déjà l'absence de profil (repli "Mon compte")
DÉPENDANCES : CASCADE automatique si auth.users est supprimé en dernier (aucune action manuelle nécessaire)
```

### `app_travelers`, `app_devices`, `app_esim_assignments`
```text
DONNÉE UTILISATEUR : prénoms/noms de voyageurs, noms d'appareils, attributions eSIM (label, ICCID, liens vers voyageur/appareil)
CLÉ DE LIAISON : user_id (uuid) = auth.users.id, FK réelle CASCADE sur les 3 tables
RÔLE MÉTIER : fonctionnalités mobiles développées cette année (multi-voyageurs/appareils/eSIM)
PEUT ÊTRE SUPPRIMÉE ? OUI
PEUT ÊTRE ANONYMISÉE ? Non nécessaire (supprimable directement)
DOIT ÊTRE CONSERVÉE ? NON
RISQUE SI SUPPRESSION : aucun — données 100% applicatives, aucune valeur comptable/légale
DÉPENDANCES : CASCADE automatique déjà en place, vérifié réellement lors de la Phase multi-eSIM (test de suppression d'un voyageur avec 2 comptes de test)
```
→ **Catégorie A (suppression immédiate)**, la plus simple de tout l'audit : la base fait déjà le travail via `ON DELETE CASCADE` dès que `auth.users` est supprimé en dernière étape.

### `airalo_orders`
```text
DONNÉE UTILISATEUR : email, nom, prenom, sim_iccid, liens d'installation
CLÉ DE LIAISON : email (text) — AUCUNE FK vers auth.users (confirmé : absent de la carte des FK réelles)
RÔLE MÉTIER : commandes eSIM historiques, preuve d'achat, support, gestion fournisseur Airalo
PEUT ÊTRE SUPPRIMÉE ? NON
PEUT ÊTRE ANONYMISÉE ? À CONFIRMER (remplacer email/nom/prenom par des valeurs anonymisées tout en gardant sim_iccid/dates/statut pour la compta/support fournisseur)
DOIT ÊTRE CONSERVÉE ? OUI — VALIDATION MÉTIER / COMPTABLE REQUISE
RISQUE SI SUPPRESSION : perte de preuve d'achat, rupture du rapprochement avec Airalo (factures fournisseur), casse le support sur des eSIM encore actives
DÉPENDANCES : `app_esim_assignments.iccid` référence ces lignes par valeur (pas de FK) — une anonymisation de l'email ici n'affecte pas les attributions mobiles (elles utilisent l'ICCID, pas l'email)
```
→ **Catégorie C**, avec un sous-cas possible de Catégorie B (anonymisation du nom/email en conservant l'ICCID/statut/dates) **si validé** par vous.

### `orders`
```text
DONNÉE UTILISATEUR : email, first_name/last_name/nom/prenom, customer_phone, billing_address, customer_address, siret/company_name éventuels
CLÉ DE LIAISON : email (text) — AUCUNE FK vers auth.users
RÔLE MÉTIER : commandes site + mobile, facturation, marges, rapprochement Stripe
PEUT ÊTRE SUPPRIMÉE ? NON
PEUT ÊTRE ANONYMISÉE ? À CONFIRMER (nom/adresse/téléphone anonymisables, montants/dates/statuts à garder pour la compta)
DOIT ÊTRE CONSERVÉE ? OUI — VALIDATION COMPTABLE/RÉGLEMENTAIRE REQUISE (obligations de conservation des factures, généralement plusieurs années selon la juridiction)
RISQUE SI SUPPRESSION : perte de preuve de transaction, rupture des vues `v_order_margins`/`v_esim_sales` (calculs de marge), casse potentielle des `documents`/factures liées (FK réelle documents.order_id → orders.id, ON DELETE SET NULL — une suppression ne casserait pas le document mais le désolidariserait de la commande d'origine)
DÉPENDANCES : `documents.order_id` (FK réelle, SET NULL), `stripe_webhook` y écrit en continu, `airalo-api/db.ts` y écrit aussi
```
→ **Catégorie C.**

### `insurances`
```text
DONNÉE UTILISATEUR : user_email, subscriber_first_name, subscriber_last_name, montants, dates de contrat
CLÉ DE LIAISON : user_email (text) — AUCUNE FK vers auth.users
RÔLE MÉTIER : contrats d'assurance voyage (AVA), attestations, obligations assureur
PEUT ÊTRE SUPPRIMÉE ? NON
PEUT ÊTRE ANONYMISÉE ? NON sans validation externe — un contrat d'assurance a des obligations de conservation propres à l'assureur partenaire (AVA), pas seulement à FenuaSIM
DOIT ÊTRE CONSERVÉE ? OUI — VALIDATION RÉGLEMENTAIRE REQUISE (obligations contractuelles de l'assureur, potentiellement hors du contrôle de FenuaSIM seul)
RISQUE SI SUPPRESSION : rupture de contrat d'assurance en cours, perte de preuve en cas de sinistre, non-conformité vis-à-vis du partenaire assureur
DÉPENDANCES : aucune FK sortante identifiée
```
→ **Catégorie C, la plus sensible de tout l'audit.** À ne jamais toucher sans validation du partenaire assureur.

### `customer_esims`
```text
DONNÉE UTILISATEUR : user_id (uuid, colonne présente mais SANS AUCUNE contrainte FK — confirmé), customer_email
CLÉ DE LIAISON : customer_email (fiable) ; user_id semble être une colonne héritée/non connectée (aucune FK, jamais peuplée par le code audité)
RÔLE MÉTIER : trouvé uniquement référencé par le handler `airalo-api/db.ts::createEsimRecord` — un chemin de création d'eSIM alternatif, distinct de `create-airalo-order` utilisé par l'app mobile actuelle
PEUT ÊTRE SUPPRIMÉE ? À CONFIRMER (semble être une table historique/parallèle, pas utilisée par le tunnel mobile actuel)
PEUT ÊTRE ANONYMISÉE ? À CONFIRMER
DOIT ÊTRE CONSERVÉE ? À CONFIRMER
RISQUE SI SUPPRESSION : inconnu sans confirmation de son usage réel côté site
DÉPENDANCES : aucune FK identifiée
```
→ **Table à statut incertain**, à clarifier avec l'équipe technique avant toute décision — je ne l'ai jamais vue utilisée par le code que j'ai audité (mobile + 20 Edge Functions), hormis un handler qui semble être un chemin alternatif non actif dans le tunnel actuel.

### `user_sims`
```text
DONNÉE UTILISATEUR : user_email, name (nom donné à la SIM), iccid
CLÉ DE LIAISON : user_email (text) — AUCUNE FK vers auth.users
RÔLE MÉTIER : usage exact non identifié dans le code audité (jamais référencée par l'app mobile ni les 20 Edge Functions)
PEUT ÊTRE SUPPRIMÉE ? À CONFIRMER
DOIT ÊTRE CONSERVÉE ? À CONFIRMER
RISQUE SI SUPPRESSION : inconnu — probablement liée au site web (non auditable ici)
```
→ **Table à statut incertain**, probablement côté site web uniquement.

### `invoices`
```text
DONNÉE UTILISATEUR : customer_email, customer_name
CLÉ DE LIAISON : customer_email — AUCUNE FK vers auth.users ; order_id est un uuid mais SANS contrainte FK réelle vers orders.id (vérifié)
RÔLE MÉTIER : factures PDF générées, envoi email
PEUT ÊTRE SUPPRIMÉE ? NON
PEUT ÊTRE ANONYMISÉE ? À CONFIRMER (nom anonymisable, montant/numéro de facture à conserver)
DOIT ÊTRE CONSERVÉE ? OUI — VALIDATION COMPTABLE REQUISE (obligation légale de conservation des factures)
RISQUE SI SUPPRESSION : perte de justificatif comptable
```
→ **Catégorie C.**

### `stripe_transactions`
```text
DONNÉE UTILISATEUR : aucune donnée personnelle directe (montants, ids Stripe, order_id/insurance_id/rental_id en uuid sans FK réelle vérifiée)
RÔLE MÉTIER : rapprochement comptable des paiements Stripe
PEUT ÊTRE SUPPRIMÉE ? NON
DOIT ÊTRE CONSERVÉE ? OUI — VALIDATION COMPTABLE REQUISE
RISQUE SI SUPPRESSION : perte de rapprochement bancaire/comptable
```
→ **Catégorie C**, mais impact vie privée faible (pas de PII directe dans les colonnes auditées, hors `raw_data` jsonb non inspecté en détail — à vérifier si ce champ contient des données personnelles brutes de Stripe).

### `support_tickets` / `support_conversation_logs`
```text
DONNÉE UTILISATEUR : user_email / customer_identifier (email ou téléphone selon canal), messages échangés (potentiellement du texte libre contenant des données personnelles)
CLÉ DE LIAISON : email/identifiant texte — AUCUNE FK vers auth.users
RÔLE MÉTIER : historique support (agent IA Tere + tickets escaladés)
PEUT ÊTRE SUPPRIMÉE ? NON directement — utile pour litiges/qualité de service
PEUT ÊTRE ANONYMISÉE ? OUI, recommandé (remplacer l'identifiant client, garder le contenu du ticket pour l'analyse qualité)
DOIT ÊTRE CONSERVÉE ? À CONFIRMER selon politique de conservation support de FenuaSIM
RISQUE SI SUPPRESSION : perte d'historique en cas de litige ou de réclamation ultérieure
```
→ **Catégorie B (anonymisation recommandée)**, sous réserve de votre politique de conservation support.

### `emails_sent`, `review_emails_sent`, `upsell_emails_sent`
```text
DONNÉE UTILISATEUR : email, parfois order_id/sim_iccid, contenu HTML de l'email envoyé
RÔLE MÉTIER : traçabilité des envois marketing/transactionnels (anti-spam, éviter les doublons)
PEUT ÊTRE SUPPRIMÉE ? OUI (valeur métier faible une fois le compte fermé)
PEUT ÊTRE ANONYMISÉE ? OUI (alternative si vous voulez garder un compteur d'envois sans l'identité)
DOIT ÊTRE CONSERVÉE ? NON identifié comme nécessaire
RISQUE SI SUPPRESSION : faible — risque de renvoyer un email déjà envoyé à une adresse réutilisée dans le futur (mineur)
```
→ **Catégorie A ou B au choix**, faible enjeu.

### `airalo_topups`, `airalo_refunds`
```text
DONNÉE UTILISATEUR : email/client_email, order_id, sim_iccid
RÔLE MÉTIER : recharges et remboursements Airalo — preuve de transaction fournisseur
PEUT ÊTRE SUPPRIMÉE ? NON
PEUT ÊTRE ANONYMISÉE ? À CONFIRMER (email anonymisable, order_id/sim_iccid/montant à garder pour rapprochement fournisseur)
DOIT ÊTRE CONSERVÉE ? OUI — VALIDATION COMPTABLE/FOURNISSEUR REQUISE
```
→ **Catégorie C.**

### `documents`
```text
DONNÉE UTILISATEUR : client_name, client_address, client_city, client_country
CLÉ DE LIAISON : order_id (FK réelle → orders.id, ON DELETE SET NULL), rental_id (FK réelle → router_rentals.id, ON DELETE SET NULL)
RÔLE MÉTIER : devis/factures/documents commerciaux formels
PEUT ÊTRE SUPPRIMÉE ? NON
PEUT ÊTRE ANONYMISÉE ? À CONFIRMER (nom/adresse anonymisables si le document lui-même n'a plus de valeur légale active)
DOIT ÊTRE CONSERVÉE ? OUI — VALIDATION COMPTABLE/RÉGLEMENTAIRE REQUISE
RISQUE SI SUPPRESSION : perte de document commercial/comptable formel
```
→ **Catégorie C.**

---

## Tables hors périmètre client (traitement groupé)

| Table(s) | Type d'acteur | Justification exclusion |
|---|---|---|
| `admins` | Staff FenuaSIM | FK réelle vers `auth.users` **sans** `ON DELETE CASCADE` (aucune clause = comportement RESTRICT) — si un client était aussi admin, la suppression de son compte échouerait tant que la ligne `admins` existe. **Cas à surveiller explicitement dans la future Edge Function.** |
| `partners`, `partner_profiles`, `partner_orders`, `partner_orders_view`, `partner_commissions` | Partenaires B2B (revendeurs) | Relation contractuelle distincte d'un compte client final ; `partner_profiles.user_id` a une FK réelle `ON DELETE SET NULL` (donc sûre par défaut, ne bloque jamais une suppression) |
| `prospects`, `prospect_notes`, `prospect_tasks`, `leads` | Prospects CRM/marketing | Jamais nécessairement devenus clients ; pas de compte `auth.users` associé |
| `participations` | Jeu concours / opération marketing | Hors tunnel d'achat, pas de compte associé identifié |
| `promo_codes`, `promo_code_usage`, `referrals` | Codes promo / parrainage | **À vérifier séparément** : un client supprimé peut être `referrer_email` — un cas limite non couvert par cet audit, à traiter si la fonctionnalité de parrainage devient active |
| `router_rentals`, `v_router_rentals` | Location de routeur | Même famille que `orders`/`documents` (preuve de location) — **à documenter avec le même niveau de rigueur que `orders` si un client mobile peut louer un routeur depuis l'app** ; non utilisé par l'app mobile actuelle (aucune route trouvée) |
| `saved_quotes` | Devis enregistrés (site) | Pas de lien avec l'app mobile identifié |
| Vues (`v_esim_sales`, `v_insurance_sales`, `v_order_margins`, `support_orders_view`, `partner_orders_view`) | Vues de reporting | Recalculées à la volée depuis les tables sources ; rien à supprimer directement dedans |

---

## B4-B5. `auth.users` — cascades réelles (vérifiées, pas déduites)

```text
auth.users
  |
  +--CASCADE--> profiles (profiles.id)
  |
  +--CASCADE--> app_travelers (user_id)
  |
  +--CASCADE--> app_devices (user_id)
  |
  +--CASCADE--> app_esim_assignments (user_id)
  |
  +--SET NULL--> partner_profiles (user_id)
  |
  +--RESTRICT (aucune clause)--> admins (user_id)   ⚠️ bloque la suppression si présent
  |
  +--AUCUNE FK--> airalo_orders, orders, insurances, customer_esims,
                  user_sims, invoices, documents, stripe_transactions,
                  support_tickets, emails_sent* (liaison par email uniquement,
                  jamais supprimée ni modifiée automatiquement)
```

**Conclusion clé** : supprimer `auth.users` en dernier (comme demandé en B15) est non seulement une bonne pratique, c'est **la seule option qui fonctionne** — sinon la ligne `admins` (si présente) bloquerait la suppression avec une erreur de contrainte, et les 4 tables `app_*`/`profiles` disparaîtraient silencieusement avant qu'un éventuel traitement métier ait pu les utiliser.

## B6-B7. Liaison par email, pas par `user_id` — confirmé

`airalo_orders`, `orders`, `insurances`, `customer_esims`, `user_sims`, `invoices`, `airalo_topups`, `airalo_refunds`, `support_tickets`, `emails_sent*` : **aucune de ces 10+ tables n'a de FK vers `auth.users`**. Supprimer `auth.users` (même avec la meilleure cascade du monde) **ne touchera jamais ces tables** — c'est exactement le comportement souhaité pour la Catégorie C, mais cela signifie aussi qu'une anonymisation de ces tables (si validée) devra être un **traitement explicite et séparé**, jamais automatique.

## B7. Stripe

Aucun `stripe_customer_id` trouvé stocké localement (recherche exhaustive, 0 résultat pour ce nom de colonne précis). Seuls des identifiants de session/transaction (`stripe_session_id`, `payment_intent_id`, `stripe_id` dans `stripe_transactions`) sont stockés. **L'historique Stripe lui-même (côté Stripe) n'est pas et ne doit pas être supprimé** — hors du contrôle de cette base de données, non concerné par cet audit.

---

## B10. Stratégie recommandée (3 niveaux)

```text
NIVEAU 1 — Suppression immédiate (Catégorie A)
app_travelers, app_devices, app_esim_assignments, profiles
→ Déjà automatique via CASCADE dès que auth.users est supprimé.
→ emails_sent / review_emails_sent / upsell_emails_sent : suppression manuelle
  additionnelle recommandée (pas de FK, ne partent pas automatiquement).

NIVEAU 2 — Anonymisation (Catégorie B, à valider avant implémentation)
airalo_orders, orders, insurances (email/nom/prenom uniquement, JAMAIS
  sim_iccid/montants/dates/statuts), support_tickets/support_conversation_logs,
  invoices, airalo_topups, airalo_refunds, documents.
→ Exemple : email → deleted-user-{uuid}@anonymized.fenuasim.local,
  nom/prenom → NULL ou "Utilisateur supprimé", téléphone/adresse → NULL.
→ NE MODIFIE PAS sim_iccid, montants, dates, statuts, numéros de facture/contrat.

NIVEAU 3 — Conservation intégrale (Catégorie C, si Niveau 2 non validé)
Mêmes tables que Niveau 2, mais conservées telles quelles si l'anonymisation
n'est pas validée juridiquement/comptablement — dissociées de tout compte
actif puisque auth.users aura disparu, mais aucune donnée modifiée.

TABLES AU STATUT INCERTAIN (à trancher avant implémentation)
customer_esims, user_sims — usage réel non confirmé dans le code audité.
```

## B11. UX cible (reprise telle quelle, non implémentée)

```text
Compte → Mon compte → Supprimer mon compte

"Supprimer mon compte
La suppression de votre compte désactivera définitivement votre accès FenuaSIM.
Certaines informations liées à vos achats, paiements ou contrats peuvent devoir
être conservées conformément à nos obligations légales et contractuelles.
[Annuler] [Continuer]"

puis

"Confirmer la suppression
Cette action est irréversible.
[Supprimer définitivement mon compte]"
```
**Non implémenté** dans cette phase — audit uniquement, conformément à la consigne.

## B12. Architecture cible (proposée, non déployée)

```text
App mobile (bouton "Supprimer mon compte")
  ↓ appel authentifie (JWT utilisateur, verifie cote Edge Function)
Edge Function dediee "delete-account" (nouvelle, non creee dans cette phase)
  ↓ 1. verifie que le JWT correspond bien a auth.uid()
  ↓ 2. NIVEAU 1 : supprime app_travelers/app_devices/app_esim_assignments/profiles
  ↓    (ou laisse la cascade faire le travail a l'etape 5)
  ↓ 3. NIVEAU 2 (si valide) : anonymise airalo_orders/orders/insurances/... par email
  ↓ 4. ecrit un log minimal (voir B14)
  ↓ 5. supprime auth.users en tout dernier via service role
       (jamais supabase.auth.admin.deleteUser() depuis le client mobile)
  ↓ 6. retourne succes/echec a l'app
```

## B13. Idempotence (à prévoir, non implémentée)

Vérifier en tout début de fonction si `auth.users` existe encore pour cet id : si déjà supprimé, retourner un succès immédiat (l'état final souhaité est déjà atteint) plutôt qu'une erreur. Chaque étape d'anonymisation doit utiliser une condition (`WHERE email = X AND email NOT LIKE '%@anonymized.fenuasim.local'`) pour ne jamais ré-anonymiser une ligne déjà traitée.

## B14. Logs (à prévoir, non implémentée)

Table proposée `account_deletion_requests` (non créée) : `user_id`, `requested_at`, `executed_at`, `status` (`pending`/`completed`/`failed`), sans copie des données personnelles supprimées — uniquement l'identifiant et les timestamps.

## B15-B16. Gestion d'échec et garde-fous (à prévoir, non implémentée)

- Si l'anonymisation Niveau 2 échoue : ne pas supprimer `auth.users`, remonter l'erreur, statut `failed` dans le log.
- Si `admins.user_id` référence encore ce compte : bloquer explicitement avec un message clair plutôt que de laisser la contrainte SQL échouer silencieusement.
- Aucune policy `DELETE` globale ajoutée ; toute suppression passe uniquement par la future Edge Function avec la clé de service.

---

## Vérifications techniques

Aucun code applicatif modifié (audit pur) — `tsc`/`expo export` non ré-exécutés, aucun fichier `.ts`/`.tsx` touché dans cette partie B.

---

## Compte-rendu

```text
PHASE
3 — Audit suppression de compte

ÉTAT
⚠️ Audit complet, stratégie prête, EN ATTENTE DE VALIDATION avant toute implémentation

TABLES LIÉES À L'UTILISATEUR
37 tables/vues contiennent une colonne pertinente ; 15 documentées en detail
(liees a un client final), le reste hors perimetre ou a statut incertain (voir ci-dessus)

AUTH.USERS
Racine de la hierarchie. A supprimer en tout dernier (RESTRICT via admins,
CASCADE via profiles/app_*, SET NULL via partner_profiles, aucune FK ailleurs)

PROFILES
Categorie A - suppression immediate (CASCADE deja en place)

APP_TRAVELERS
Categorie A - suppression immediate (CASCADE deja en place, teste reellement en Phase multi-eSIM)

APP_DEVICES
Categorie A - suppression immediate (CASCADE deja en place)

APP_ESIM_ASSIGNMENTS
Categorie A - suppression immediate (CASCADE deja en place)

AIRALO_ORDERS
Categorie C - conservation, anonymisation possible en Categorie B sous validation.
Aucune FK vers auth.users, liaison par email uniquement

ORDERS
Categorie C - VALIDATION COMPTABLE REQUISE. Documents lies via FK reelle (SET NULL)

ESIMS
customer_esims : statut incertain, usage reel non confirme dans le code audite (20 Edge Functions)
user_sims : statut incertain, probablement lie au site web uniquement

INSURANCES
Categorie C - VALIDATION RÉGLEMENTAIRE REQUISE (obligations assureur partenaire), la plus sensible

STRIPE / PAIEMENTS
Aucun stripe_customer_id stocke localement. stripe_transactions : Categorie C,
VALIDATION COMPTABLE REQUISE, PII directe faible

AUTRES TABLES DÉTECTÉES
invoices, documents, airalo_topups, airalo_refunds (Categorie C) ;
support_tickets, support_conversation_logs (Categorie B recommandee) ;
emails_sent/review_emails_sent/upsell_emails_sent (Categorie A/B, faible enjeu) ;
admins/partners*/prospects*/leads/participations/router_rentals/saved_quotes
(hors perimetre client final, traites brievement ci-dessus)

FK / CASCADES
Carte complete fournie (section B4-B5), verifiee en direct sur pg_constraint,
pas deduite des noms de colonnes

DONNÉES SUPPRIMABLES
profiles, app_travelers, app_devices, app_esim_assignments (Categorie A)

DONNÉES ANONYMISABLES
airalo_orders, orders, insurances, invoices, documents, airalo_topups,
airalo_refunds, support_tickets/logs — SOUS VALIDATION uniquement, rien applique

DONNÉES À CONSERVER
Memes tables que ci-dessus si l'anonymisation n'est pas validee (Niveau 3)

VALIDATION RÉGLEMENTAIRE REQUISE
insurances (assureur partenaire), orders/invoices/stripe_transactions (comptable),
airalo_orders/airalo_topups/airalo_refunds (rapprochement fournisseur Airalo)

STRATÉGIE RECOMMANDÉE
3 niveaux : suppression immediate (Categorie A) / anonymisation sous validation
(Categorie B) / conservation integrale (Categorie C) — detail complet section B10

ORDRE D'EXÉCUTION FUTUR
1. Verification JWT authentifie
2. Suppression donnees applicatives (ou delegue a la cascade)
3. Anonymisation des tables Categorie B (si validee)
4. Log de la demande
5. Suppression auth.users en tout dernier, via service role, jamais depuis le client
6. Retour du resultat a l'app

ARCHITECTURE EDGE FUNCTION
Edge Function dediee "delete-account", non creee, proposee section B12.
Idempotence, logs et gestion d'echec proposes (B13-B15), non implementes.

RISQUES
- admins.user_id sans CASCADE : bloquerait la suppression si le compte est aussi admin
- customer_esims/user_sims au statut incertain, a clarifier avant d'implementer
- insurances necessite une validation externe (assureur), hors controle FenuaSIM seul
- Aucun stripe_customer_id local, mais l'historique Stripe cote Stripe reste hors de portee de cet audit

SUPABASE MODIFIÉ
NON

DONNÉES SUPPRIMÉES
NON

AUTH.USERS SUPPRIMÉ
NON

EDGE FUNCTION CRÉÉE
NON

PRÊT À IMPLÉMENTER APRÈS VALIDATION
OUI, sous reserve de vos reponses sur : (1) anonymisation vs conservation pour
la Categorie B, (2) statut reel de customer_esims/user_sims, (3) validation du
partenaire assureur pour insurances
```
