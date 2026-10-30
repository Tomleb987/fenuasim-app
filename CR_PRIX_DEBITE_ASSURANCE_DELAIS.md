# CR — Prix débité, paiement assurance dans l'app, délais réseau (2026-10-25)

Branche : `fix/prix-assurance-delais`. Livrable en mise à jour OTA (aucun module natif ajouté).

## Pourquoi

Audit du 25/10 : en octobre, 24 paiements eSIM ouverts depuis l'app sur 48 ne sont pas allés au bout (34 sur 53 en septembre). Trois causes identifiées dans le code :

1. **Prix affiché ≠ montant débité.** Stripe débite `final_price_eur` (toujours en EUR). L'écran de paiement dérivait le prix du XPF catalogue : en mode XPF il annonçait 673 XPF quand la carte était débitée de 6 € (≈ 716 XPF) ; en mode EUR il affichait 1 € de trop sur 385 forfaits (prix EUR et XPF arrondis séparément en base). Rien n'indiquait que le débit se fait en euros.
2. **Assurance payée hors de l'app.** `Linking.openURL` envoyait le client dans le navigateur du téléphone, sans retour. De plus le code promo assurance était affiché mais **jamais transmis** au site : remise visible, plein tarif facturé.
3. **Aucun délai sur les appels au site** : roue de chargement sans fin sur réseau faible.

## Ce qui change

| Fichier | Changement |
|---|---|
| `lib/http.ts` (nouveau) | `fetchWithTimeout` : 20 s par défaut, message « Le serveur ne répond pas… ». |
| `app/esim/[country].tsx` | Lit `final_price_eur` (Airalo et ORA FLY) et le passe à l'écran de paiement (`priceEur`). |
| `app/esim/payment.tsx` | Total = montant réellement débité (même calcul de remise que `create-checkout-mobile`). Mention « Montant débité en euros : X € » ; bouton « Payer X € ». Libellés d'accessibilité. Repli sur l'ancien calcul si `priceEur` absent. |
| `app/esim/topup.tsx` | Recharges affichées à l'euro exact (plus d'arrondi à l'euro supérieur en mode EUR). |
| `hooks/useInsuranceQuote.ts` | Délais (30 s devis, 70 s création du paiement — la route du site crée le contrat AVA avant de répondre). Envoi du `promoCode`. Remise calculée comme le site (`insuranceFeesAfterPromo` : montant ou %). `returnTo: 'app'`. |
| `app/insurance/form.tsx` | `openCheckout` (navigateur intégré) au lieu de `Linking.openURL`. |
| `app/insurance-success.tsx` (nouveau) | Retour `fenuasim://insurance-success` : vérifie le paiement via `/api/assurance/mark-paid` (lecture seule), affiche le n° d'adhésion et les PDF AVA quand ils sont prêts. |
| `app/insurance-cancel.tsx` (nouveau) | Retour `fenuasim://insurance-cancel` → écran d'annulation existant. |
| `lib/oraFly.ts`, `app/support/chat.tsx` | Délais (20 s ; 45 s pour l'assistant). |

## Dépendance site

Le retour dans l'app nécessite la branche site `fix/assurance-retour-app` (`/api/insurance-checkout` accepte `returnTo: 'app'`). **Ordre : fusionner le site d'abord, puis publier l'OTA.** Si l'OTA part avant, rien ne casse : le site ignore `returnTo` et le client termine sur la page web, comme avant.

## Vérifications

- `npx tsc --noEmit` : 0 erreur (avant et après).
- `npx expo config --type public` : OK.
- `npx expo-doctor` : 16/18, les 2 échecs sont des contrôles réseau (exp.host injoignable depuis l'environnement de travail).
- Pas de test sur appareil : à faire sur TestFlight / build interne avant l'OTA (achat eSIM en XPF et en EUR, code promo, souscription assurance avec retour dans l'app, annulation).

## Reste à faire

- Mesurer le taux d'abandon (`esim_purchase_orders.status = 'pending_payment'`) 2 à 3 semaines après l'OTA.
- Option à décider : facturer en XPF quand le client a choisi le XPF (modification de l'edge function `create-checkout-mobile`, non versionnée — accord requis).
- Les listes de forfaits affichent toujours le prix XPF catalogue ; l'écran de paiement indique le débit exact.
