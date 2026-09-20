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

## 4. Points restants (hors périmètre de cette correction, non traités)

- ⚠️ **`app/esim/index.tsx:157`** — le bouton « Recharger » s'affiche sur toute eSIM
  non expirée possédant un ICCID, sans consulter `available_topup`. L'utilisateur
  d'un forfait non rechargeable arrive donc sur l'écran de recharge pour y lire
  « Recharge non disponible pour ce forfait ». Ce n'est **pas** une promesse fausse
  avant achat (le seul point signalé par le document), et la dégradation est propre,
  mais le parcours pourrait être raccourci. Non corrigé faute de demande explicite.
- ⚠️ La correction n'est vérifiée qu'en statique (`tsc` + SQL de production). Le
  test visuel sur appareil — ouvrir le **catalogue du Qatar** et comparer un forfait
  Go et un forfait illimité — reste à faire, ainsi que la publication d'un build.

---

## 5. Fichiers modifiés

- `app/esim/[country].tsx` — badge « Rechargeable » conditionné à `available_topup === true`.

Aucune table, policy RLS, Edge Function ni donnée de production n'a été modifiée.
