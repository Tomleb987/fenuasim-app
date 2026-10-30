j'ai 
# Vérification de l'app mobile après les modifications du 20/09/2026

2026-09-20 · @Someone

## Ce qui a changé côté serveur

Toutes les modifications du 20/09/2026 sont déjà en production. L'application mobile (`com.fenuasim.app`) partage la base Supabase et les Edge Functions du site, mais son code vit dans un autre dépôt : ce document liste ce qu'il faut y vérifier.

| Changement | L'app est-elle concernée ? |
| --- | --- |
| `orders` : nouvelle colonne `partner_markup_share` | **Oui, à vérifier** — voir la section suivante |
| `airalo_packages.available_topup` : valeur passée de `NULL` à booléen | **Oui, à vérifier** — la structure n'a pas changé, seule la valeur |
| Edge Function `sync-packages` : écrit avant de purger | Non, mais une fragilité disparaît pour l'app aussi |
| Partage 70/30 de la majoration partenaire | Non — aucune commande mobile ne porte de code partenaire |
| Badges, bulle des destinations, écrans admin | Non — pages web uniquement |
| `create-checkout-mobile`, `create-topup-checkout`, `list-esim-topups` | Non — aucune de ces fonctions n'a été touchée |

Deux points seulement demandent une vérification dans le dépôt de l'app. Ils sont détaillés ci-dessous, avec les commandes à lancer.

## Point 1 : la nouvelle colonne sur `orders`

C'est le seul risque réel, et il ne vient pas de la colonne elle-même mais de la façon dont l'app décode les réponses.

Si l'app lit les commandes avec `select('*')` et un décodeur **strict**, une clé inconnue dans le JSON peut faire échouer tout le décodage — donc l'écran « mes commandes ».

- **Swift** : `Codable` ignore les clés inconnues par défaut. Aucun risque, sauf décodeur custom.
- **Kotlin** : `kotlinx.serialization` **lève une exception** sur une clé inconnue, sauf si `ignoreUnknownKeys = true` est explicitement posé.

### À lancer dans le dépôt de l'app

```bash
# Kotlin : le réglage doit exister quelque part
grep -rn "ignoreUnknownKeys" --include=*.kt .

# Swift : un décodeur custom qui exigerait toutes les clés
grep -rn "CodingKeys\|JSONDecoder()" --include=*.swift .

# Qui lit la table orders, et avec quelles colonnes
grep -rn "from(\"orders\")\|\.from('orders')" --include=*.kt --include=*.swift .
```

**Ce qu'il faut voir** : soit `ignoreUnknownKeys = true` dans la configuration du `Json`, soit une requête qui énumère ses colonnes au lieu de `select("*")`.

**Ce qui doit alerter** : un `Json { }` sans `ignoreUnknownKeys` côté Android, combiné à un `select("*")` sur `orders`.

### Un détail qui rassure à moitié

Ce risque n'est pas nouveau : la PR de la veille (19/09) avait déjà ajouté **cinq** colonnes `partner_*` à la même table, et elles sont en production depuis. Si le décodeur était strict, l'app Android serait donc déjà cassée. Mais aucune commande mobile n'a été passée depuis le 18/09 : ce n'est pas une preuve, juste un indice. Le `grep` tranche en dix secondes.

## Point 2 : `available_topup` n'est plus `NULL`

La colonne existait déjà dans `airalo_packages`, mais elle valait `NULL` sur les 2 060 forfaits. Elle contient maintenant un vrai booléen : **2 012 rechargeables, 48 non**.

La structure de la table n'a donc pas bougé — seule la valeur. Le changement va plutôt dans le bon sens : si l'app décode ce champ en `Bool` **non-nullable**, elle plantait déjà sur le `NULL` et cesse de planter. Mais si elle affichait quelque chose à partir d'un `NULL` interprété comme `false`, ce qu'elle affiche change.

```bash
grep -rn "available_topup\|rechargeab\|topup" --include=*.kt --include=*.swift .
```

### Le piège à chercher en priorité

Le site affichait **en dur**, à deux endroits, la phrase « tous les forfaits sont rechargeables » — ce qui est faux pour neuf destinations (Qatar, Taïwan, Jersey, Kirghizistan, Turquie, Afghanistan, Guam, Émirats, Maroc). Les deux ont été corrigés aujourd'hui.

Il est très probable que **l'app porte la même promesse en dur**, copiée du site à l'époque. C'est le vrai sujet de cette section : pas un plantage, mais une affirmation commerciale fausse sur un écran d'achat.

```bash
grep -rni "rechargeable\|recharge" --include=*.kt --include=*.swift --include=*.xml --include=*.strings .
```

Si une chaîne du type « Tous les forfaits sont rechargeables » ou « Rechargeable » apparaît sans condition, elle devrait désormais dépendre de `available_topup`.

### Deux piquûres de rappel

- `NULL` n'est pas `false`. Un champ absent ne doit rien afficher, surtout pas « non rechargeable », qui inventerait une limitation et ferait fuir un client sans raison.
- « Illimité » n'est pas un substitut : **760 forfaits illimités sont rechargeables** et **5 forfaits limités ne le sont pas**. Seul le champ fait foi.

## Ce qui ne demande aucune vérification

Autant économiser le temps passé à chercher : ces points ont déjà été vérifiés en base ou dans le code du site.

**Le partage 70/30 de la majoration partenaire.** Sur les 7 commandes `mobile_app` et `mobile_topup` en base, **aucune ne porte de code partenaire** : le calcul partenaire n'est même pas déclenché. Et si l'une en portait un, la majoration y vaudrait zéro, donc la rémunération resterait la commission seule, exactement comme avant.

**Les Edge Functions de l'app.** `create-checkout-mobile`, `create-topup-checkout` et `list-esim-topups` n'ont pas été touchées. Seule `sync-packages` a été redéployée, et elle écrit le catalogue sans servir de client.

**Les vues Postgres.** Sous Postgres, la liste de colonnes d'une vue est figée à sa création : une colonne ajoutée à `orders` ne se propage pas dans `support_orders_view`, `partner_orders_view` ou les autres. Si l'app lit une vue plutôt que la table, le point 1 ne la concerne même pas.

### Une bonne nouvelle au passage

La synchro vidait la table `airalo_packages` pendant quelques secondes à chaque heure ronde — je l'ai mesurée à zéro ligne en l'interrogeant pendant un passage. L'app y était exposée autant que le site : interroger le catalogue à cet instant précis renvoyait une liste vide.

C'est corrigé : la synchro écrit désormais avant de purger, et la table ne descend plus jamais en dessous de son contenu précédent. **Si des utilisateurs de l'app avaient déjà signalé un catalogue vide de façon aléatoire, c'était probablement ça.**

## La checklist

- [ ] `grep -rn "ignoreUnknownKeys"` côté Kotlin — présent, ou requêtes à colonnes énumérées
- [ ] `grep -rn "from(\"orders\")"` — repérer les `select("*")` sur cette table
- [ ] `grep -rni "rechargeable"` — traquer une promesse de recharge écrite en dur
- [ ] `grep -rn "available_topup"` — vérifier qu'il n'est pas décodé en `Bool` non-nullable

### Le test qui vaut tous les greps

Ouvrir l'app, aller dans **« mes commandes »**, et vérifier que l'historique s'affiche. C'est l'écran qui lit `orders` : s'il se charge, le point 1 est réglé, décodeur strict ou non.

Puis ouvrir le **catalogue du Qatar**, seule destination mixte : 6 forfaits rechargeables, 6 qui ne le sont pas. Si l'app affiche une promesse de recharge identique sur les douze, c'est le point 2.

### Si quelque chose cloche

Remonte-moi le message d'erreur exact et l'écran concerné. Dans le cas du décodeur strict, la correction côté app tient en une ligne (`ignoreUnknownKeys = true`), mais on peut aussi la traiter côté serveur en figeant la liste des colonnes renvoyées — à arbitrer selon qui peut publier une mise à jour de l'app le plus vite.
