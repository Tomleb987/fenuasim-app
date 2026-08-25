# État des lieux — FENUASIM App (mobile)

_Dernière mise à jour : 2026-08-23_

Application Expo / React Native, séparée du site web (`fenuasim.com`), mais branchée sur le **même backend Supabase** (`FENUA SIM WEBSITE`, projet `hptbhujyrhjsquckzckc`) et sur une API du site (`fenuasim.com/api/...`) pour la création d'eSIM. Rien n'a été modifié côté site web.

## Stack

- Expo SDK 54 / React Native 0.81 / React 19, routing via `expo-router` (fichiers dans `app/`)
- Auth + data : Supabase (`@supabase/supabase-js`, session stockée via `expo-secure-store`)
- Paiement : Stripe (redirection vers checkout hébergé, pas de SDK natif Stripe branché dans les écrans actuels)
- UI : composants React Native stylés à la main (StyleSheet), pas de librairie de design system

## 1. Authentification — ✅ fonctionnelle

- `app/(auth)/login.tsx` : connexion email/mot de passe via `supabase.auth.signInWithPassword`
- `app/(auth)/register.tsx` : création de compte via `supabase.auth.signUp` (+ email de confirmation Supabase)
- `app/_layout.tsx` : garde d'auth globale — redirige vers `/(auth)/login` si pas de session, vers `/(tabs)` sinon, écoute `onAuthStateChange`
- Déconnexion depuis l'écran Compte (`supabase.auth.signOut`)
- Pas de mot de passe oublié, pas de connexion sociale (Google/Apple), pas de vérification téléphone

## 2. Écran d'accueil — ✅ fonctionnel

`app/(tabs)/index.tsx` :
- Header avec salutation + accès rapide au compte
- CTA principal vers l'explorateur eSIM
- Carrousel "Destinations populaires" (liste statique de 6 pays en dur dans le code, pas depuis Supabase)
- Bloc "Mes eSIM" : les 3 dernières commandes (`airalo_orders`) de l'utilisateur connecté, avec statut actif/expiré et bouton d'installation (lien Apple)
- Jauge de consommation intégrée par eSIM (voir section suivante)
- Grille "Actions rapides" (assurance, commandes, support, compte — le bouton support n'a pas d'action branchée)

## 3. Suivi conso — ✅ fonctionnel

- `hooks/useDataUsage.ts` : appelle l'edge function Supabase `airalo-proxy` (`/sims/{iccid}/usage`) avec le token de session, met en cache la conso par ICCID
- Affichage sur l'accueil : Mo/Go utilisés, restants, barre de progression colorée selon le %, badge "% utilisé"
- Gère le cas illimité (`is_unlimited`)
- Pas encore de vue dédiée "historique de conso" — uniquement la jauge du jour sur l'accueil

## 4. Autres écrans existants (au-delà des 3 priorités)

| Écran | Fichier | État |
|---|---|---|
| Explorer eSIM (catalogue + recherche) | `app/(tabs)/explore.tsx` | ✅ fonctionnel — lit `airalo_packages`, regroupe par destination, filtre local/global |
| Détail destination + choix forfait | `app/esim/[country].tsx` | ✅ fonctionnel — onglets Forfaits/Infos, sélection de plan |
| Paiement eSIM | `app/esim/payment.tsx` | ✅ fonctionnel — appelle l'edge function `create-checkout-mobile`, ouvre le checkout Stripe dans le navigateur |
| Succès paiement + création eSIM | `app/esim/payment-success.tsx` | ✅ fonctionnel — appelle `fenuasim.com/api/create-airalo-order` après paiement, affiche le code d'installation |
| ~~Confirmation eSIM (autre écran)~~ | `app/esim/confirm.tsx` | ⚠️ **orphelin** — aucune navigation ne pointe vers cette route ; contenu 100% statique (Japon, 5 Go, faux code "4872", faux lien `esims.cloud/fenua-sim/demo`). Doublon obsolète de `payment-success.tsx` |
| Compte (mes eSIM / assurances) | `app/(tabs)/account.tsx` | ✅ fonctionnel — lit `airalo_orders` + `insurances` de l'utilisateur |
| Formulaire assurance voyage | `app/insurance/form.tsx` | ⚠️ **UI seule** — aucun champ n'est validé, aucune date réelle saisie n'est utilisée, pas d'appel API/Supabase : le bouton "Souscrire" navigue directement vers l'écran de confirmation |
| Confirmation assurance | `app/insurance/confirm.tsx` | ⚠️ **100% statique/mock** — "Japon", "890 XPF", dates en dur, aucune commande réelle créée |

## 5. Backend Supabase (vérifié aujourd'hui)

Tables utilisées par l'app et confirmées alignées avec le code : `airalo_orders`, `orders`, `insurances`, `airalo_packages`.

RLS activée sur les 3 tables utilisateur avec policies `user reads own X` (par email) → un utilisateur connecté ne voit que ses propres données. Un point à surveiller (pas modifié) :

> ⚠️ `airalo_orders` a aussi une policy `Enable read access for all users` (`qual: true`) qui rend **toutes** les commandes eSIM lisibles publiquement, même sans authentification. C'est un réglage backend partagé avec le site — à corriger uniquement si vous le décidez, car ça sort du périmètre "app mobile".

Edge function `airalo-proxy` (conso) et `create-checkout-mobile` (paiement app) : actives et déployées.

## 6. Corrections apportées aujourd'hui (blocages techniques)

L'app ne pouvait pas démarrer avant ces correctifs :

1. **`.env` manquant** → créé avec `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mêmes valeurs que le site, lecture seule)
2. **`@expo/vector-icons` non déclaré** en dépendance directe (icônes cassées) → ajouté via `expo install`
3. **2 erreurs TypeScript** : icône `sim-card-outline` invalide → `hardware-chip-outline` ; typage de la largeur de la jauge de conso corrigé
4. Build Metro web vérifié : compile sans erreur (908 modules)

## 7. Dette technique / points d'attention non traités

- `App.tsx` à la racine est un résidu du scaffold Expo par défaut, **jamais utilisé** (le vrai point d'entrée est `index.ts` → `expo-router/entry`) — supprimable
- Fichier vide `7` à la racine du repo, présent depuis le commit initial, origine inconnue
- `package.json` contient une dépendance `"claude": "^0.1.1"` dont l'origine n'est pas claire (déjà présente avant la session actuelle)
- Écrans `esim/confirm.tsx` et tout le flux `insurance/` sont des maquettes non branchées au backend — à clarifier si l'assurance voyage doit devenir une vraie fonctionnalité ou reste hors périmètre
- Le carrousel "Destinations populaires" de l'accueil est une liste statique, pas dynamique
- Aucune gestion "mot de passe oublié"
- Versions de quelques packages Expo légèrement en retard par rapport à ce qu'attend le SDK 54 (avertissement non bloquant au démarrage)

## Résumé priorités demandées

| Priorité | État |
|---|---|
| Accès par login | ✅ Fonctionnel |
| Écran d'accueil | ✅ Fonctionnel |
| Suivi conso | ✅ Fonctionnel |
