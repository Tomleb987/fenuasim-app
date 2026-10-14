# CR — Code promo sur la recharge eSIM (2026-10-14)

## Besoin
Partenariat AVA : AVA offre une eSIM FENUA SIM à certains assurés ; l'assuré peut ensuite la recharger avec le code **AVA5** (−5 %). L'écran de recharge de l'appli n'avait pas de champ code promo.

## Changements
- `app/esim/topup.tsx` : champ « Code promo » + bouton « Appliquer » (validation `hooks/usePromoCode`, identique à l'achat initial) ; prix des options et du bouton affichés remisés.
- `hooks/useEsimTopups.ts` : `createCheckout(iccid, packageId, promoCode?)` ; remonte le message d'erreur du serveur (code refusé).
- Serveur : edge function `create-topup-checkout` (versionnée dans `fenu-esim/supabase/functions`) accepte `promoCode`, le revalide et l'applique au montant Stripe. Rétrocompatible : sans code, comportement inchangé.

## Ordre de mise en production
1. Déployer l'edge function `create-topup-checkout` (sans risque pour les versions actuelles de l'appli).
2. Publier l'appli : changement JS uniquement → **mise à jour OTA possible** (`eas update --channel production`, runtimeVersion = appVersion 1.0.4), sans nouvelle review store.

## Vérifié
- `npx tsc --noEmit` : 0 erreur.
- Non testé sur appareil (pas de simulateur ici) : à tester avec une vraie recharge + code AVA5 avant annonce.
