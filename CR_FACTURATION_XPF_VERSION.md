# CR — Facturation en XPF, prix débité dans les listes, version dans Compte (2026-10-29)

Branche : `feat/facturation-xpf`. Côté app : livrable en mise à jour OTA (aucun module natif ajouté : `expo-updates` et `expo-constants` sont déjà dans le build 1.0.4).

## Pourquoi

En octobre, 39 paiements eSIM ouverts depuis l'app sur 66 n'ont pas abouti (34 sur 53 en septembre). Après la mise à jour du 29/10 (prix débité affiché à l'écran de paiement), deux écarts restaient :

1. Un client qui choisit le XPF voit des prix en XPF mais sa carte est débitée **en euros** : autre montant sur son relevé, frais de change de sa banque.
2. En mode EUR, la liste des forfaits affichait `final_price_xpf / 119,33` arrondi à l'euro supérieur, souvent 1 € de plus que le débit réel.

Enfin, rien ne permettait de savoir sur un téléphone quelle mise à jour OTA est installée.

## Ce qui change

| Fichier | Changement |
|---|---|
| `supabase/functions/create-checkout-mobile/index.ts` | Versionnée pour la première fois (commit de sauvegarde = version 7 en production). Nouveau champ `currency` : `'XPF'` → Stripe débite `final_price_xpf` en `xpf` (devise sans centimes), remise en % arrondie à l'unité, remise en montant convertie au taux fixe 119,33. Absent ou autre valeur → euros, comme avant. `esim_purchase_orders.amount` dans la devise débitée. La réponse renvoie `currency`. |
| `supabase/functions/stripe-webhook/PATCH_2026-10-29_devise.md` | Patch décrit (la fonction n'est pas versionnée) : la ligne `orders` reprend la devise de `esim_purchase_orders` au lieu de `'EUR'` en dur. Sans effet sur les commandes existantes (toutes en `eur`). |
| `app/esim/payment.tsx` | En XPF (hors ORA FLY) : total, remise, « Montant débité : X XPF » et bouton « Payer X XPF », calculés comme le serveur. Envoie `currency`. Garde-fou : si le serveur répond une autre devise, alerte « Paiement en euros » avant d'ouvrir Stripe. |
| `app/esim/[country].tsx` | Cartes des forfaits et bouton « Acheter » : en EUR, `final_price_eur` exact ; en XPF, `final_price_xpf` (désormais débité tel quel). |
| `components/AppVersion.tsx` (nouveau), `app/(tabs)/account.tsx` | Ligne « Version 1.0.4 · mise à jour du JJ/MM/AAAA (identifiant) » en bas de l'onglet Compte, connecté ou non. |
| `tsconfig.json` | Exclut `supabase/` (code Deno) du contrôle TypeScript de l'app. |

Inchangé : ORA FLY (débité en euros par le site), recharges et assurance (euros), prix « Dès … » de l'accueil et d'Explorer (arrondis, ce sont des prix d'appel).

## Ordre de déploiement (important)

1. **stripe-webhook** : appliquer le patch sur le code téléchargé au moment du déploiement (sauvegarde de la version 51 à côté).
2. **create-checkout-mobile** : déployer `supabase/functions/create-checkout-mobile/index.ts`.
3. Un achat test en XPF (petit forfait) : vérifier Stripe (devise XPF), `esim_purchase_orders` (`currency = xpf`), livraison, ligne `orders` en XPF.
4. **Mise à jour OTA** de l'app.

Si l'OTA partait avant l'étape 2, rien ne casse : le serveur facture en euros et l'app l'annonce par l'alerte « Paiement en euros ».

## Vérifications

- `npx tsc --noEmit` : 0 erreur.
- `npx expo config --type public` : OK.
- `npx expo export --platform ios` : bundle OK (1 171 modules).
- `create-checkout-mobile` : syntaxe TypeScript valide (contrôle Deno complet impossible depuis l'environnement de travail, pas d'accès à deno.land).
- Catalogue : 2 075 forfaits, tous avec un `final_price_xpf` entier (minimum 113 XPF, au-dessus du minimum Stripe de 60 XPF).
- Codes promo actifs : remises en % et en montant (SAVE5EUR, FENUA30-TUIANU) calculées par la même formule côté app et serveur.

## Retour arrière

- `create-checkout-mobile` : redéployer le fichier du commit `3ec2f9b` (version 7).
- `stripe-webhook` : redéployer la sauvegarde prise avant le patch.
- App : `eas update:rollback`.
