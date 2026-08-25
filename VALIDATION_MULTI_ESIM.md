# Phase de validation — Gestion multi-eSIM

_Rédigé le 2026-08-23. Tests exécutés réellement contre le projet Supabase de production (`hptbhujyrhjsquckzckc`), via de vrais comptes Supabase Auth créés pour l'occasion, avec de vrais tokens JWT et de vrais appels PostgREST — pas une lecture de code. Aucune fonctionnalité produit nouvelle n'a été développée pendant cette phase. Aucun paiement Stripe réel, aucune navigation UI réelle (pas de navigateur pilotable dans cet environnement)._

---

## Méthode de test

Aucun outil de pilotage de navigateur n'étant disponible (`chromium-cli` indisponible, confirmé), les écrans React Native n'ont pas pu être cliqués un par un. À la place, le test a porté sur la **couche qui fait réellement fonctionner ces écrans** : de vrais comptes Supabase Auth ont été créés (`fenuasim.qa.*@example.com`, tous supprimés en fin de session), avec de vrais tokens de session, utilisés pour exécuter exactement les mêmes requêtes PostgREST que celles que le code de l'app (`hooks/useTravelers.ts`, `hooks/useDevices.ts`, `hooks/useEsimAssignments.ts`) envoie réellement — mêmes tables, mêmes filtres, mêmes `upsert`. C'est un test réel de bout en bout côté données et sécurité, mais **pas** un test de rendu visuel des composants React Native (non vérifiable sans navigateur).

`airalo_orders` n'a reçu aucune écriture pendant les tests : les deux eSIM du scénario ont été simulées avec des ICCID factices (`TESTQA-ICCID-A-0001`, `TESTQA-ICCID-B-0002`) directement dans `app_esim_assignments`, ce qui suffit à valider toute la logique d'attribution/isolation/persistance sans toucher à la table historique.

---

## 🐛 Bug critique trouvé et corrigé pendant les tests

**Le tout premier test réel (création d'un appareil) a échoué immédiatement**, alors que `tsc` et `expo export` étaient passés au vert sans rien détecter — la preuve concrète que la compilation ne vaut pas une validation fonctionnelle.

```text
Bug :
INSERT sur app_devices → erreur Postgres "record NEW has no field device_id"

Cause :
Le trigger partagé app_validate_ownership() référençait NEW.device_id même
lorsqu'il s'exécutait sur app_devices, table dont le NEW ne possède pas ce
champ. PL/pgSQL ne garantit pas l'évaluation en court-circuit d'un AND
lorsqu'il contient un accès à un champ de record dynamique — l'expression
"TG_TABLE_NAME = 'app_esim_assignments' and new.device_id is not null"
levait donc une erreur même quand la première condition était fausse.

Correction :
Scission en deux fonctions dédiées : app_validate_device_ownership()
(ne référence que traveler_id) et app_validate_assignment_ownership()
(référence traveler_id et device_id), chacune n'accédant qu'aux champs
qui existent réellement sur la table à laquelle elle est attachée.

Fichier modifié :
Migration Supabase "fix_app_validate_ownership_trigger" (DDL distant,
aucun fichier du dépôt). Périmètre strictement limité aux tables app_* :
DROP/CREATE de fonctions et triggers app_*, zéro impact sur airalo_orders,
orders, airalo_packages, insurances ou toute policy/fonction historique.

Impact :
Sans ce correctif, la création de tout appareil échouait à 100% —
fonctionnalité "Mes appareils" et flux d'attribution avec appareil
totalement non opérationnels en production.

Test après correction :
✅ Re-exécution du scénario complet (création de 2 voyageurs, 2 appareils,
2 attributions eSIM) : succès total, aucune erreur.
```

## 🐛 Bug secondaire trouvé et corrigé pendant les tests

```text
Bug :
Après suppression d'un voyageur, la carte eSIM sur l'accueil continuait
d'afficher l'ancien libellé (ex. "USA • Thomas") sans bandeau "Non
attribuée" et sans chip voyageur/appareil — un état visuellement trompeur
(l'eSIM semble toujours appartenir à Thomas alors qu'il n'existe plus).

Cause :
app/(tabs)/index.tsx traitait une eSIM comme "non attribuée" uniquement
si aucune ligne app_esim_assignments n'existait (`!assignment`). Or la
suppression d'un voyageur ne supprime pas la ligne d'attribution : elle
met seulement traveler_id à NULL (ON DELETE SET NULL). La ligne existe
donc toujours, avec son label figé, ce qui contournait le bandeau
"Non attribuée".

Correction :
La condition "non attribuée" est passée de `!assignment` à
`!assignment?.traveler_id`, et le titre de la carte retombe sur
`package_id` (au lieu du label figé) dès que traveler_id est vide.

Fichier modifié :
app/(tabs)/index.tsx

Impact :
Correction d'affichage uniquement, aucun impact sur les données ni sur
airalo_orders. Confirmé par test réel (re-lecture après suppression).

Test après correction :
⚠️ Logique vérifiée par lecture du nouveau code + `tsc` propre + les
données réelles observées (traveler_id bien à null après suppression).
Le rendu visuel de la carte n'a pas pu être capturé par capture d'écran
(pas de navigateur), donc non "vu" à l'œil — voir section Bloquants.
```

---

## 1–2. Scénario multi-eSIM réel exécuté

Compte de test A (`fenuasim.qa.multiesim.…@example.com`, supprimé en fin de session) :
1. Création voyageurs **Thomas** et **Christelle**
2. Création appareils **iPhone Thomas** (rattaché à Thomas) et **iPhone Christelle** (rattaché à Christelle)
3. Attribution eSIM `TESTQA-ICCID-A-0001` → Thomas / iPhone Thomas, label `USA • Thomas`
4. Attribution eSIM `TESTQA-ICCID-B-0002` → Christelle / iPhone Christelle, label `USA • Christelle`
5. Relecture croisée : **aucune inversion** — `TESTQA-ICCID-A-0001` pointe bien vers Thomas/iPhone Thomas, `TESTQA-ICCID-B-0002` vers Christelle/iPhone Christelle. Vérifié programmatiquement (`noMixup: true`).
6. Les deux eSIM ont été créées sous **le même compte / la même adresse e-mail** (une seule contrainte `UNIQUE(user_id, iccid)` couvrant les deux lignes distinctes) — aucun conflit, aucun écrasement.

Ce que ce test prouve réellement : la logique serveur (RLS + upsert + jointures par ICCID) ne mélange jamais deux eSIM d'un même compte. Ce qu'il ne prouve pas : le rendu visuel des deux cartes sur l'écran d'accueil (non vérifiable sans navigateur) — voir section Bloquants.

---

## 3. Persistance

Testé avec une **vraie déconnexion/reconnexion** : fermeture du premier client Supabase, création d'un second client indépendant, nouvel appel `signInWithPassword` (nouveau token JWT, nouvelle session, aucun état en mémoire partagé avec le premier).

Résultat relu après reconnexion :
- Christelle : présente, données intactes
- iPhone Christelle : toujours rattaché à Christelle
- Attribution eSIM B : intacte (traveler, device, label inchangés)
- Attribution eSIM A : traveler_id et device_id à `null` (suite à la suppression de Thomas, testée juste avant), label toujours `USA • Thomas` (texte figé, comportement corrigé côté affichage seulement, pas en base)

**Confirmé : les données proviennent bien de `app_travelers` / `app_devices` / `app_esim_assignments` en base, pas d'un état React temporaire** — puisque le second client n'a jamais partagé de mémoire avec le premier processus Node.

---

## 4. Création / modification / suppression

| Élément | Testé | Résultat |
|---|---|---|
| Créer un voyageur | ✅ | OK |
| Modifier son prénom | ⏳ | Non testé isolément (mécanisme UPDATE identique testé sur `nickname`, `traveler_id` d'un appareil — même code path) |
| Modifier son surnom | ✅ | Thomas → nickname "Tom", confirmé |
| Supprimer un voyageur | ✅ | Thomas supprimé ; `app_devices.traveler_id` et `app_esim_assignments.traveler_id` passés à `null` (ON DELETE SET NULL confirmé en conditions réelles, pas seulement lu dans la définition de contrainte) |
| Comportement du label après suppression | ✅ testé, ⚠️ bug trouvé et corrigé | Voir bug secondaire ci-dessus |
| Créer un appareil | ✅ (après correctif) | OK |
| Modifier un appareil (changement de voyageur) | ✅ | Appareil réattribué de "Voyageur1" à "Voyageur2", confirmé |
| Supprimer un appareil | ✅ | Création puis suppression confirmées, ligne absente après coup |
| Attribution sans appareil ("Je choisirai plus tard") | ✅ | `device_id: null` accepté, ré-upsert ultérieur sur le même ICCID confirmé sans doublon (`countRowsForIccidA === 1`) |

---

## 5. eSIM non attribuée

Testé : recherche d'une attribution pour un ICCID qui n'a **jamais** existé dans `app_esim_assignments` → résultat `null` confirmé (`maybeSingle()` retourne bien aucune ligne, pas d'erreur).

C'est exactement la condition que `app/(tabs)/index.tsx` utilise (`getAssignment(iccid)` retourne `undefined`) pour afficher le bandeau "Non attribuée". Le mécanisme de détection est donc **prouvé correct côté données**.

⏳ Non vérifié visuellement : que le bandeau s'affiche bien à l'écran avec seulement les 4 derniers chiffres de l'ICCID, et que le bouton "Attribuer" ouvre effectivement `app/esim/assign.tsx` avec les bons paramètres — nécessite un navigateur/simulateur, indisponible ici. Le code (`router.push({ pathname: '/esim/assign', params: {...} })`) a été relu et n'a pas changé depuis le développement initial.

---

## 6. Attribution après achat

**⏳ Non testé.** Aucun paiement Stripe (réel ou test) n'a été déclenché dans cette session : cela nécessiterait de piloter un navigateur pour suivre la redirection Stripe Checkout, ce qui n'est pas possible ici, et déclencher un vrai paiement même en mode test n'a pas été jugé pertinent sans confirmation explicite de l'existence d'un environnement Stripe de test configuré pour ce projet.

Ce qui a été re-vérifié par lecture de code (pas par exécution) : la création de l'eSIM (`fetch('https://fenuasim.com/api/create-airalo-order')`) et la proposition d'attribution sont deux blocs de code strictement séquentiels et non liés par un `try/catch` commun dans `app/esim/payment-success.tsx` — une erreur dans l'attribution ultérieure ne peut techniquement pas remonter jusqu'à annuler l'appel de création déjà terminé. Ce point reste une garantie **de conception**, pas une garantie **testée en exécution**.

---

## 7. Consommation

`hooks/useDataUsage.ts` n'a subi **aucune modification** pendant cette phase (vérifié : `git diff hooks/useDataUsage.ts` ne retourne toujours rien).

⏳ **Non testé en conditions réelles** : la consommation Airalo (`airalo-proxy`) ne peut être vérifiée qu'avec de vrais ICCID Airalo actifs, associés à de vraies commandes payées. Les ICCID factices utilisés pour ce test (`TESTQA-ICCID-A-0001`/`B-0002`) n'existent pas côté Airalo — les interroger via `airalo-proxy` aurait simplement renvoyé une erreur/absence de données, sans rien prouver côté consommation réelle. Tester cela nécessiterait un vrai compte avec deux eSIM Airalo réellement achetées.

Ce qui **a** été confirmé par le test réel : `useDataUsage.ts` interroge la consommation uniquement par ICCID (`fetchUsage(iccid)`), sans aucune dépendance vers `app_esim_assignments` — le code source de ce hook est identique à avant le développement multi-eSIM, donc son fonctionnement pour deux ICCID différents n'a structurellement pas pu être cassé par cette fonctionnalité. C'est une garantie de non-régression par absence de modification, pas un test d'exécution de la consommation elle-même.

---

## 8. Vérification RLS réelle (test d'isolation A/B)

**Testé avec deux vrais comptes distincts**, chacun avec son propre JWT :

| Tentative de l'utilisateur B | Résultat |
|---|---|
| Lire les voyageurs de A (`SELECT * FROM app_travelers`) | ✅ 0 ligne retournée |
| Lire les appareils de A | ✅ 0 ligne retournée |
| Lire les attributions de A | ✅ 0 ligne retournée |
| Modifier le voyageur "Christelle" de A (`UPDATE ... SET nickname = 'HACKED'`) | ✅ 0 ligne affectée (silencieusement filtré par `USING`, pas d'erreur) |
| Supprimer l'attribution eSIM B de A | ✅ 0 ligne affectée |
| Insérer une ligne avec `user_id` = celui de A | ✅ **Rejeté explicitement** : `"new row violates row-level security policy for table app_travelers"` |

Vérification post-attaque : les données de A (nickname de Christelle, existence de l'attribution eSIM B) sont **restées intactes** après ces 6 tentatives.

**C'est un test réel, pas une lecture de policy** — deux comptes authentifiés distincts, 6 tentatives d'accès croisé, toutes bloquées par Postgres lui-même.

---

## 9. Tables historiques — confirmation finale

Re-vérifié en direct, après la phase de test complète (y compris après le correctif de bug) :

- `airalo_orders` : 15 colonnes (inchangé), 3 policies identiques à avant (dont la policy publique, section 10)
- `orders` : 49 colonnes (inchangé), policies identiques
- `airalo_packages` : 40 colonnes (inchangé), policies identiques
- `insurances` : 38 colonnes (inchangé), policies identiques
- Aucune ligne n'a été insérée, modifiée ou supprimée dans ces 4 tables pendant toute la phase de test.

Aucune modification nécessaire n'a été identifiée sur ces tables — la règle "stopper et signaler" (section 9 de la demande) n'a donc pas eu à s'appliquer.

---

## 10. Audit complémentaire — policy publique `airalo_orders`

Test non destructif exécuté : requête `SELECT` sur `airalo_orders` avec **uniquement la clé anonyme publique, sans aucune authentification** (aucun `Authorization` header, exactement comme un client anonyme le ferait).

Résultat :

1. **Colonnes accessibles testées** : `id`, `email`, `sim_iccid`, `apple_installation_url`, `package_id` — les 5 demandées sont revenues sans erreur. Par extension, comme la policy a `qual: true` sans restriction de colonnes, **les 15 colonnes de la table sont accessibles**, pas seulement celles testées.
2. **Une requête avec seulement la clé anon peut réellement récupérer des commandes** : **oui, confirmé** — 3 lignes retournées sans authentification.
3. **Les e-mails sont accessibles** : **oui, confirmé** (champ non vide sur la ligne testée).
4. **Les ICCID sont accessibles** : **oui, confirmé** (champ non vide sur la ligne testée).
5. **Les liens d'installation eSIM sont accessibles** : **oui, confirmé** (`apple_installation_url` non vide sur la ligne testée) — ce lien permet, sur un appareil Apple, d'installer directement l'eSIM d'un client.
6. **Authentification nécessaire ?** **Non** — aucune authentification, aucune session, aucun compte requis.

*Les valeurs réelles (e-mails, ICCID, liens) obtenues pendant ce test n'ont volontairement pas été reproduites dans ce document ni affichées en clair pendant la session — seule leur présence/absence a été vérifiée, pour éviter de re-diffuser des données personnelles de clients réels.*

### Recommandation (non appliquée, à valider séparément)

Remplacer la policy `Enable read access for all users` (`qual: true`) par sa suppression pure — la policy `user reads own esim orders` (`email = auth.jwt()->>'email'`) suffit déjà à couvrir l'usage légitime (site + app). En RLS Postgres, la policy la plus permissive l'emporte : tant que `qual: true` existe, la restriction par e-mail de l'autre policy est **totalement neutralisée** pour la lecture. **Aucune action prise** — décision et test à faire séparément côté site avant toute suppression, pour vérifier qu'aucune fonctionnalité du site (page de confirmation de commande sans session, par exemple) ne dépend de cette lecture publique.

**FAILLE CONFIRMÉE, pas seulement suspectée.**

---

## 11. ICCID arbitraire dans `app_esim_assignments` — analyse du risque

Le test réel de la section 1-2 a confirmé concrètement le risque déjà pressenti : **rien n'a empêché l'insertion d'un ICCID totalement fictif** (`TESTQA-ICCID-A-0001`) dans `app_esim_assignments` sous mon propre `user_id` de test — aucune vérification contre `airalo_orders` n'a eu lieu, ni au niveau RLS ni au niveau trigger.

Risque réel : un utilisateur authentifié pourrait créer une ligne `app_esim_assignments` avec **son propre `user_id`** mais un `iccid` appartenant à la commande d'un autre client. Cela ne permet **pas** de lire les données de cet autre client (RLS bloque toujours la lecture croisée, confirmé section 8), mais pollue la table avec une association non vérifiée (label arbitraire sur un ICCID qui n'est pas le sien).

### Solutions possibles (aucune développée, à valider avant implémentation)

**Option recommandée — RPC Postgres `SECURITY DEFINER`** (ex. `app_assign_esim(p_iccid, p_traveler_id, p_device_id, p_label)`) :
- Fonctionnement : la fonction, exécutée avec des privilèges élevés, vérifie en interne `exists (select 1 from airalo_orders where sim_iccid = p_iccid and email = auth.jwt()->>'email')` avant d'insérer/mettre à jour `app_esim_assignments`. L'app appellerait `supabase.rpc('app_assign_esim', {...})` au lieu d'un `upsert` direct sur la table.
- Complexité : **faible à moyenne** — une seule fonction SQL supplémentaire (~20 lignes), un changement dans `hooks/useEsimAssignments.ts` (remplacer l'appel `.upsert()` par `.rpc()`).
- Impact sur le site : **nul** — lecture seule de `airalo_orders`, déjà autorisée aujourd'hui par plusieurs policies existantes (y compris celle de la section 10). Aucune écriture, aucune modification de `airalo_orders`.
- Limites : nécessite de fixer `SET search_path = public, pg_temp` sur la fonction pour éviter tout risque de détournement de recherche de schéma (bonne pratique standard pour `SECURITY DEFINER`) ; repose sur la correspondance e-mail JWT ↔ `airalo_orders.email`, donc hérite du même modèle de confiance que la policy historique `user reads own esim orders` — cohérent avec l'existant, pas un nouveau risque.

**Option alternative — Edge Function dédiée** (ex. `app-assign-esim`) :
- Même logique de vérification, mais côté edge function avec la clé de service.
- Complexité : **moyenne** — nouveau service à déployer et maintenir, un appel réseau supplémentaire (latence additionnelle par rapport au RPC direct).
- Impact sur le site : nul (fonction isolée, ne touche pas les edge functions existantes `airalo-proxy` / `create-checkout-mobile` / `create-airalo-order`).
- Limites : plus lourd à opérer que l'option RPC pour un gain de sécurité équivalent.

**Recommandation : l'option RPC**, plus simple, sans nouveau service à déployer, et cohérente avec les patterns déjà en place dans le projet. Non implémentée dans cette phase, conformément à la consigne.

---

## 12. Appels réseau (`useTravelers`, `useDevices`, `useEsimAssignments`)

**⏳ Non mesuré** : aucune observation réelle du trafic réseau n'a pu être faite (pas de devtools navigateur disponible dans cet environnement).

Constat par lecture de code, à prendre comme un raisonnement et non une mesure : ces 3 hooks font chacun **un seul appel `SELECT`** à leur montage (`useEffect` avec tableau de dépendances vide), sans polling ni souscription temps réel. Ils sont actuellement appelés de façon indépendante depuis 4 écrans (`app/(tabs)/index.tsx`, `app/(tabs)/account.tsx` — indirectement via les liens, `app/esim/assign.tsx`, `app/travelers/index.tsx`/`app/devices/index.tsx`), donc changer d'écran déclenche un nouveau fetch à chaque fois plutôt que de réutiliser un état partagé. Pour le volume de données attendu (quelques voyageurs/appareils par foyer), cela ne devrait pas être perceptible, mais **aucune mesure réelle de latence ou de nombre de requêtes n'a été faite** — conformément à la consigne, aucun Context/cache n'a été ajouté, ce point reste une observation de code, pas un bug constaté.

---

## 13. Vérifications techniques finales

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` (après les 2 correctifs) | ✅ Exit code 0, aucune erreur |
| `npx expo export --platform web` (après les 2 correctifs) | ✅ Succès, bundle unique généré, aucune erreur de compilation ni de résolution de module. `dist/` supprimé après vérification. |
| `npx expo start` (lancement normal) | ⏳ Non exécuté dans cette phase (redondant avec `expo export`, qui est plus strict — compile toutes les routes en un seul passage ; déjà validé lors de la session de développement précédente sans erreur) |

Aucun warning nouveau significatif introduit par les deux correctifs de cette phase.

---

## 14. Corrections effectuées pendant cette phase

Voir le détail complet en haut de ce document ("🐛 Bug critique" et "🐛 Bug secondaire"). Résumé :

1. **Migration Supabase `fix_app_validate_ownership_trigger`** — corrige un bug bloquant (création d'appareil impossible), périmètre strictement `app_*`, documenté avec le SQL exact.
2. **`app/(tabs)/index.tsx`** — corrige l'affichage trompeur d'une eSIM dont le voyageur a été supprimé, périmètre strictement l'écran d'accueil, aucune donnée modifiée.

Aucune refonte architecturale. Aucune autre correction n'a été jugée nécessaire.

---

## 15. Tests réellement exécutés

| Test | Résultat |
|---|---|
| Création voyageur | ✅ |
| Modification voyageur | ✅ (surnom testé ; prénom non testé isolément, même mécanisme) |
| Suppression voyageur | ✅ (a révélé et permis de corriger le bug d'affichage) |
| Création appareil | ✅ (après correction du bug bloquant) |
| Modification appareil | ✅ (changement de voyageur testé) |
| Suppression appareil | ✅ |
| Attribution eSIM 1 | ✅ |
| Attribution eSIM 2 | ✅ |
| Même email / deux eSIM | ✅ |
| Consommation ICCID A | ⏳ non testé (nécessite un vrai ICCID Airalo actif) |
| Consommation ICCID B | ⏳ non testé (idem) |
| Persistance après fermeture | ✅ (nouveau client, nouvelle session) |
| Persistance après reconnexion | ✅ (signInWithPassword réel, nouveau token) |
| eSIM non attribuée | ✅ côté données ; ⏳ rendu visuel non vérifié (pas de navigateur) |
| Attribution sans appareil | ✅ |
| Attribution après achat | ⏳ non testé (pas de paiement Stripe déclenché) |
| RLS utilisateur A/B | ✅ (6 tentatives d'accès croisé, toutes bloquées, une explicitement rejetée par Postgres) |

---

## 16. Bugs rencontrés

### Bug 1 — Critique, corrigé
```text
Bug : INSERT sur app_devices échoue à 100% ("record NEW has no field device_id")
Cause : trigger app_validate_ownership() référençait NEW.device_id sur une table qui n'a pas ce champ
Correction : scission en 2 fonctions dédiées (app_validate_device_ownership / app_validate_assignment_ownership)
Fichier modifié : migration SQL distante "fix_app_validate_ownership_trigger" (aucun fichier du dépôt)
Impact : bloquant total sur la création d'appareils avant correction ; nul sur le site/tables historiques
Test après correction : ✅ scénario complet re-exécuté avec succès
```

### Bug 2 — Mineur, corrigé
```text
Bug : le label d'une eSIM reste affiché après suppression du voyageur attribué, sans bandeau "non attribuée"
Cause : condition d'affichage basée sur l'existence de la ligne d'attribution, pas sur la présence d'un traveler_id
Correction : condition basée sur assignment?.traveler_id, titre retombe sur package_id si absent
Fichier modifié : app/(tabs)/index.tsx
Impact : cosmétique/UX uniquement, aucune donnée affectée
Test après correction : ⚠️ logique + données vérifiées réellement, rendu visuel non capturé (pas de navigateur)
```

Aucun autre bug détecté pendant cette phase.

---

## 17. Fichiers modifiés pendant cette phase

| Fichier | Modifié | Rôle |
|---|---|---|
| Migration Supabase `fix_app_validate_ownership_trigger` | Oui (DDL distant) | Corrige le trigger cassé sur `app_devices`/`app_esim_assignments` |
| `app/(tabs)/index.tsx` | Oui | Corrige l'affichage d'une eSIM dont le voyageur a été supprimé |
| `VALIDATION_MULTI_ESIM.md` | Créé | Ce document |

Confirmation explicite, re-vérifiée en direct après ces deux correctifs :

```text
airalo_orders          : INCHANGÉ (15 colonnes, policies identiques)
orders                 : INCHANGÉ (49 colonnes, policies identiques)
airalo_packages        : INCHANGÉ (40 colonnes, policies identiques)
insurances              : INCHANGÉ (38 colonnes, policies identiques)
API fenuasim.com        : INCHANGÉE (aucun appel de test ne l'a sollicitée)
Edge Functions historiques : INCHANGÉES (non re-déployées, non modifiées)
Policies historiques    : INCHANGÉES (y compris la policy publique airalo_orders, non touchée)
```

---

## 18. Conclusion

```text
VALIDATION MULTI-ESIM
⚠️ (le cœur fonctionnel est testé et validé réellement au niveau données/sécurité ;
    le rendu visuel des écrans React Native n'a pas pu être vérifié, faute de navigateur)

TEST AVEC 2 ESIM
✅ (aucune inversion, même compte/même email, confirmé par test réel)

TEST AVEC 2 VOYAGEURS
✅ (création, modification, suppression, cascade — tous testés réellement)

TEST AVEC 2 APPAREILS
✅ (création, modification, suppression, changement de voyageur — tous testés réellement,
    après correction du bug bloquant trouvé en cours de test)

CONSOMMATION PAR ICCID
⏳ (hook non modifié et non impacté par conception, mais non testé avec de vrais
    ICCID Airalo actifs — impossible sans compte de test possédant de vraies eSIM)

PERSISTANCE
✅ (testée avec une vraie déconnexion/reconnexion, deux sessions distinctes)

RLS NOUVELLES TABLES
✅ (isolation A/B testée réellement avec 2 comptes et 6 tentatives d'accès croisé,
    toutes bloquées ; injection de user_id étranger explicitement rejetée par Postgres)

SITE WEB MODIFIÉ
NON

TABLES HISTORIQUES MODIFIÉES
NON

FAILLE AIRALO_ORDERS CONFIRMÉE
OUI — testée réellement avec la seule clé anonyme, sans authentification :
     e-mails, ICCID et liens d'installation eSIM de vrais clients accessibles publiquement.
     Non corrigée (hors périmètre, décision à prendre séparément).

PRÊT POUR MISE EN PRODUCTION
NON — deux blocages restent :
  1. Le rendu visuel réel des écrans (accueil, voyageurs, appareils, flux d'attribution)
     n'a jamais été vu à l'écran dans cette session ni les précédentes ; à valider
     manuellement sur un appareil/simulateur avant diffusion.
  2. La consommation par ICCID en présence d'une vraie attribution n'a pas été testée
     avec de vraies eSIM Airalo actives.

BLOQUANTS RESTANTS
1. Validation visuelle manuelle des écrans sur simulateur/appareil réel (aucun outil
   de capture d'écran/navigateur disponible dans cet environnement).
2. Test de bout en bout avec 2 vraies eSIM Airalo actives pour confirmer la
   consommation affichée par ICCID en présence d'attributions.
3. Décision produit/sécurité séparée sur la policy publique airalo_orders (section 10).
4. Décision sur l'implémentation de la validation ICCID recommandée (section 11) avant
   une mise en production à grande échelle — actuellement, un utilisateur peut associer
   n'importe quel ICCID à son propre compte sans vérification serveur.
```
