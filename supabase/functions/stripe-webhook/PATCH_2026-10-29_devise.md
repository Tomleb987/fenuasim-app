# stripe-webhook — patch devise (2026-10-29)

L'edge function `stripe-webhook` (version 51 en production) n'est pas versionnée. Ce fichier décrit la seule modification nécessaire à la facturation en XPF des achats eSIM depuis l'app. Au déploiement, on repart du code **téléchargé à ce moment-là** et on applique ce remplacement, rien d'autre.

## Pourquoi

`claimAndProcessPurchase` recopie chaque achat mobile dans `orders` (tableau de bord du site) en écrivant `currency: 'EUR'` en dur et `amount` en centimes. Avec un achat payé en XPF, `esim_purchase_orders.amount` vaut par exemple `716` (XPF) : sans ce patch, la ligne `orders` annoncerait 716 € au lieu de 716 XPF (≈ 6 €).

Convention déjà utilisée par le site pour les commandes XPF de `orders` : `currency = 'XPF'`, `price` = montant en XPF, `amount` = le même entier (le XPF n'a pas de centimes). La vue `v_esim_sales` convertit ensuite avec `to_eur(price, currency)`.

La comptabilité (`stripe_balance_transactions`, `v_ca_mensuel`, `v_marge_esim_mensuelle`) n'est pas concernée : elle lit les montants convertis en EUR par Stripe.

## Remplacement (dans `claimAndProcessPurchase`, insertion dans `orders`)

Avant :

```ts
        amount: Math.round(Number(claimedOrder.amount) * 100),
        price: Number(claimedOrder.amount),
        currency: 'EUR',
        package_id: claimedOrder.package_id,
        package_name: claimedOrder.package_name ?? null,
        source: 'mobile_app',
```

Après :

```ts
        // 2026-10-29 : la devise suit esim_purchase_orders.currency ('eur' ou
        // 'xpf', voir create-checkout-mobile). XPF = devise sans centimes :
        // amount et price valent le meme entier, convention des commandes XPF
        // du site. Une commande sans devise reste en EUR, comme avant.
        amount: String(claimedOrder.currency ?? 'eur').toUpperCase() === 'XPF'
          ? Math.round(Number(claimedOrder.amount))
          : Math.round(Number(claimedOrder.amount) * 100),
        price: Number(claimedOrder.amount),
        currency: String(claimedOrder.currency ?? 'eur').toUpperCase() === 'XPF' ? 'XPF' : 'EUR',
        package_id: claimedOrder.package_id,
        package_name: claimedOrder.package_name ?? null,
        source: 'mobile_app',
```

Le chemin des recharges (`source: 'mobile_topup'`) et celui du site ne changent pas.

## Effet sur les commandes existantes

Aucun : toutes les lignes `esim_purchase_orders` actuelles ont `currency = 'eur'`, le résultat est identique à aujourd'hui.

## Retour arrière

Redéployer le code téléchargé avant le patch (sauvegardé à côté au moment du déploiement).
