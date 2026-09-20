# Compte-rendu — Vérification app mobile après les modifications du site du 20/09/2026

Date : 2026-09-20 · Branche : `fix/livraison-esim-mobile`

## 0. Correction d'une hypothèse du document source

Le document reçu raisonne sur une app **native Kotlin/Swift** (`ignoreUnknownKeys`,
`CodingKeys`, `JSONDecoder`). L'app FenuaSIM est en réalité **React Native / Expo,
en TypeScript** : aucun fichier `.kt` ni `.swift` applicatif, le décodage JSON est
celui de JavaScript, qui **ignore les clés inconnues par construction**.

Les `grep` de la checklist étaient donc sans objet tels quels ; ils ont été
retranscrits sur `*.ts` / `*.tsx`.

---

## 1. Point 1 — nouvelle colonne `orders.partner_markup_share`

**Statut : ✅ aucun risque. Aucune action.**

Deux raisons indépendantes, chacune suffisante :

1. **L'app ne lit jamais la table `orders`.**
   `grep -rn "from('orders')" --include=*.ts --include=*.tsx` → 0 résultat.
   Les tables de commandes réellement lues sont :

   | Fichier | Table |
   | --- | --- |
   | `app/esim/index.tsx:37` | `airalo_orders` |
   | `app/support/index.tsx:42` | `airalo_orders` |
   | `app/(tabs)/index.tsx:149` | `airalo_orders` |
   | `app/esim/install.tsx:38` | `airalo_orders` |
   | `app/esim/payment-success.tsx:71` | `esim_purchase_orders` |
   | `app/esim/payment-success.tsx:83` | `airalo_orders` |
   | `hooks/useEsimTopups.ts:54` | `esim_topup_orders` |

   Vérifié en base : `orders`, `airalo_orders`, `esim_purchase_orders` et
   `esim_topup_orders` sont **quatre BASE TABLE distinctes** (pas des vues l'une
   de l'autre). L'écran « mes eSIM » ne peut donc pas être affecté.

2. **Même si elle la lisait**, le décodage TypeScript/JS ignore les clés inconnues.

**Côté écriture (serveur)** : les 6 colonnes `partner_*` de `orders`, y compris
`partner_markup_share`, sont toutes `is_nullable = YES` sans `NOT NULL` ni défaut
contraignant. Un `INSERT` issu du tunnel mobile ne peut pas échouer dessus.
Dernière commande `mobile_app` en base : 2026-09-18 15:24 UTC (6 au total),
`mobile_topup` : 2026-09-06 (1).

---

## 2. Point 2 — `available_topup` passé de `NULL` à booléen

**Statut : ❌ bug réel confirmé → ✅ corrigé dans ce commit.**

L'intuition du document était juste : **l'app portait bien la promesse en dur.**

`app/esim/[country].tsx` (écran détail destination, panneau du forfait sélectionné) :

```tsx
{['QR code en 2 min', 'Activable avant le départ', 'Rechargeable'].map((f, i) => (
```

Les trois puces étaient affichées avec une coche verte **sur tous les forfaits,
sans condition**, alors que `available_topup` était bien récupéré par la requête
(`[country].tsx:103`) et typé (`boolean | null`, ligne 36) — mais **jamais lu**.

### Correction appliquée

```tsx
{[
  'QR code en 2 min',
  'Activable avant le départ',
  /* Tous les forfaits ne sont pas rechargeables (ex. Qatar : 6 sur 12).
     On n'affiche la promesse que si Airalo la confirme ; un champ absent
     (null) n'est pas un "non" et ne doit donc rien afficher. */
  ...(sel.available_topup === true ? ['Rechargeable'] : []),
].map((f, i) => (
```

Le test est `=== true`, conformément à la mise en garde du document : `NULL`
n'est pas `false`, et un champ absent n'affiche simplement rien plutôt que
d'inventer une limitation.

### Vérification sur données réelles

`npx tsc --noEmit` : ✅ 0 erreur.

Requête SQL de production sur les 12 forfaits du Qatar (seule destination mixte),
rendu attendu après correction :

| Forfaits | `available_topup` | Badge « Rechargeable » |
| --- | --- | --- |
| 1 / 2 / 3 / 5 / 10 / 20 Go | `true` | affiché ✅ |
| illimité 3 / 5 / 7 / 10 / 15 / 30 j | `false` | masqué ✅ |

Confirme au passage l'avertissement du document : « illimité » n'est pas un
substitut, c'est ici exactement l'inverse (les 6 illimités sont les non-rechargeables).

### Portée du bug en production

9 destinations concernées, **48 forfaits** sur lesquels l'app affichait une
promesse fausse avant achat :

| Destination | Non rechargeables / total |
| --- | --- |
| Kirghizistan | 6 / 12 |
| Turquie | 6 / 15 |
| Qatar | 6 / 12 |
| Taïwan | 6 / 12 |
| Jersey | 6 / 12 |
| Guam | 5 / 5 |
| Afghanistan | 5 / 5 |
| Émirats arabes unis | 5 / 12 |
| Maroc | 3 / 7 |

Aucun autre `available_topup` n'est `NULL` en base (0 inconnu sur l'ensemble).

---

## 3. Points vérifiés sans action nécessaire

**Edge Functions de l'app — non touchées.** Vérifié sur le déploiement réel
(`list_edge_functions`), pas sur une intention :

| Fonction | Dernier déploiement |
| --- | --- |
| `sync-packages` | **2026-09-20 01:15 UTC** ← seule redéployée aujourd'hui |
| `create-checkout-mobile` | 2026-09-09 |
| `airalo-proxy` | 2026-09-06 |
| `create-topup-checkout` | 2026-09-05 |
| `list-esim-topups` | 2026-09-05 |
| `stripe-webhook` | 2026-09-05 |
| `delete-account` | 2026-08-23 |

**Catalogue vide aléatoire.** Le correctif de `sync-packages` (écrire avant purger)
bénéficie directement à `app/(tabs)/index.tsx:129`, `app/(tabs)/explore.tsx:58` et
`app/esim/[country].tsx:103`, qui interrogent `airalo_packages` sans cache. Rien à
changer côté app.

**Partage 70/30 partenaire.** Sans objet : l'app ne lit pas `orders` et n'envoie
aucun code partenaire.

**Écrans après achat.** `app/esim/topup.tsx:68` gère déjà proprement le cas :
« Recharge non disponible pour ce forfait » + bouton vers l'achat d'une nouvelle
eSIM. `app/support/faq.tsx:36` est également conditionnel et correct.

---

## 4. Correctif complementaire — bouton « Recharger » apres achat

**Statut : ✅ corrige (commit `7b7143d`), sur demande.**

`app/esim/index.tsx:157` et `app/(tabs)/index.tsx:458` affichaient « Recharger »
des qu'une eSIM avait un ICCID et n'etait pas expiree, sans consulter
`available_topup`.

`usePackageInfo` expose desormais `getPackageTopup(packageId): boolean | null`,
qui renvoie `null` tant que l'information est inconnue (forfait en cours de
chargement, ou `package_id` disparu de `airalo_packages` — les parcours de
secours de `getPackageDisplay` retrouvent une destination, jamais cette
information). Les deux ecrans masquent le bouton **sur un `false` explicite
uniquement**.

### Verification sur les 383 commandes reelles de `airalo_orders`

| Effet du correctif | Commandes |
| --- | --- |
| Forfait rechargeable → bouton conserve | 206 |
| `package_id` disparu du catalogue → bouton conserve (inconnu) | 177 |
| Forfait non rechargeable → bouton masque | **0** |

Deux enseignements :
- Le changement **ne retire le bouton a personne aujourd'hui** : aucune eSIM
  vendue a ce jour ne porte un forfait non rechargeable. Risque de regression nul.
- Un test `=== true` aurait supprime le bouton a tort sur **177 commandes (46 %)**,
  celles dont le `package_id` n'est plus au catalogue. Le `!== false` etait
  le bon choix, et cette repartition le demontre plutot qu'elle ne le suppose.

`npx tsc --noEmit` : ✅ 0 erreur.

---

## 5. Points restants

- ⚠️ **Vérification statique uniquement** (`tsc` + SQL de production). Le test
  visuel sur appareil reste a faire : ouvrir le **catalogue du Qatar** et comparer
  un forfait en Go (badge « Rechargeable » attendu) et un forfait illimite (badge
  absent attendu).
- ⚠️ **Rien n'atteint les utilisateurs sans un nouveau build.** `expo-updates`
  n'est pas installe et `app.json` ne declare aucun bloc `updates` : l'app n'a
  **pas** de mise a jour OTA. Voir section 6.

---

## 6. Faut-il redeposer sur Google Play et l'App Store ?

**Oui, pour les deux — il n'y a pas d'alternative.**

Ces corrections sont du JavaScript pur, donc techniquement « OTA-ables » sur un
projet Expo classique. Mais ce projet ne l'est pas :

| Verification | Resultat |
| --- | --- |
| `expo-updates` dans `package.json` | absent |
| Bloc `updates` dans `app.json` | absent |
| `runtimeVersion` dans `app.json` | absent |

Sans ces trois elements, `eas update` n'a aucun canal pour livrer quoi que ce
soit : le binaire installe ne va jamais chercher de mise a jour. Un **nouveau
build + une soumission sur chaque store** est donc la seule voie.

### Etat des versions

- `app.json` : `version` 1.0.2, `ios.buildNumber` 13, `android.versionCode` 10.
- `eas.json` a `autoIncrement: true` sur le profil `production` : les numeros de
  build s'incrementeront seuls.
- ⚠️ `app.json` porte une modification **non commitee** anterieure a cette session
  (`versionCode` 9 → 10). Elle n'a pas ete touchee ici, mais elle doit etre
  arbitree avant la build.

### A verifier avant de lancer

- ⚠️ **Quota EAS iOS.** Le plan gratuit plafonne a 15 builds iOS/mois, sans achat
  de credits a l'unite, et le quota iOS etait epuise au 2026-09-09 avec une
  remise a zero annoncee au 2026-10-01. A reverifier avant de compter dessus.
- ⚠️ **Cle de compte de service Google Play.** `eas.json` pointe vers
  `./secrets/google-play-service-account.json` ; les depots Android precedents
  ont du etre faits a la main faute de cette cle.

### Le point de calendrier qui compte

La promesse fausse est **avant achat** (section 2) : elle continue de s'afficher
sur les 48 forfaits concernes tant qu'aucun build n'est publie. La revue Apple
prend generalement 24-48 h. Si l'urgence commerciale prime, le badge peut aussi
etre neutralise cote serveur en attendant, mais ce n'est pas necessaire : le
bug existe depuis l'origine de l'ecran et ne s'est pas aggrave le 20/09 —
seules les donnees permettant de le corriger sont apparues.

---

## 7. Fichiers modifies

| Commit | Fichier | Changement |
| --- | --- | --- |
| `a0cc01c` | `app/esim/[country].tsx` | badge « Rechargeable » conditionne a `available_topup === true` |
| `7b7143d` | `hooks/usePackageInfo.ts` | `available_topup` remonte dans `PackageInfo` + `getPackageTopup()` |
| `7b7143d` | `app/esim/index.tsx` | bouton « Recharger » masque sur un `false` explicite |
| `7b7143d` | `app/(tabs)/index.tsx` | idem sur la liste d'accueil |

Aucune table, policy RLS, Edge Function ni donnee de production n'a ete modifiee.
