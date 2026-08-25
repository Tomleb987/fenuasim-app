# PHASE 5 — Préparation EAS + premier build TestFlight

_Rédigé le 2026-08-23. Phase de build/configuration native, aucune fonctionnalité métier ajoutée._

---

## 1. Audit avant build — état initial constaté

```text
app.json        : name="fenuasim-app" (≠ marque affichée voulue), slug="fenuasim-app",
                   version="1.0.0", scheme="fenuasim", icon/splash/adaptiveIcon présents,
                   ios.bundleIdentifier="com.fenuasim.app" (déjà présent), aucun buildNumber,
                   android.package="com.fenuasim.app" (déjà présent), aucun versionCode,
                   plugins=["expo-router","expo-font"]
app.config.*    : absent (app.json seul, pas de config JS)
eas.json        : absent
package.json    : voir section 6 (dépendances désalignées du SDK + natives inutilisées)
lib/supabase.ts : flowType pkce, detectSessionInUrl false, persistSession true,
                   SecureStore — inchangé depuis Phase 4B, toujours correct
constants/      : support.ts (WhatsApp/email inchangés), theme.ts
app/_layout.tsx : guard PASSWORD_RECOVERY inchangé depuis Phase 4B
.env            : EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (les deux
                   seules variables réellement utilisées côté client, confirmé par grep)
ios/, android/  : absents — projet 100% managed workflow, prebuild géré par EAS Build
```

## 2. Identité application — corrigé

`name` était `"fenuasim-app"` (ce qui serait littéralement affiché sous l'icône sur l'iPhone). **Corrigé en `"FenuaSIM"`**. `scheme` était déjà `"fenuasim"`, inchangé. `slug` laissé à `"fenuasim-app"` (identifiant technique Expo, non visible utilisateur, aucune raison de le changer). Deep link `fenuasim://reset-password` non affecté par ce changement.

## 3-4. Bundle ID iOS / Package Android

`com.fenuasim.app` existait déjà des deux côtés (iOS et Android), cohérents entre eux. **Conservé tel quel**, aucun nouveau Bundle ID créé. Impossible de vérifier l'absence de conflit côté Apple Developer réel depuis cet environnement (aucun accès aux identifiants Apple) — à confirmer par vous au moment du premier `eas build`/`eas submit`, EAS le signalera explicitement s'il existe un conflit.

## 5. Version et numéros de build

`version` déjà à `1.0.0`. **Ajouté** : `ios.buildNumber: "1"`, `android.versionCode: 1` (absents auparavant). `eas.json` créé avec `"appVersionSource": "local"` (les numéros sont gérés depuis `app.json`, pas de double système — le profil `production` utilise `"autoIncrement": true` pour les builds suivants).

---

## 6. Dépendances Expo — anomalie réelle trouvée et corrigée

`npx expo-doctor` (état initial) : **2 échecs sur 18 vérifications**.

```text
✖ expo-linking@55.0.15 installé alors que le SDK 54 attend ~8.0.12
  (décalage de version MAJEURE, pas un simple retard de patch — risque réel
  d'échec de build natif ou de comportement runtime incorrect)
✖ expo-constants dupliqué (18.0.13 à la racine + 55.0.16 imbriqué via
  l'ancien expo-linking)
✖ 4 autres paquets Expo légèrement en retard de patch (expo, expo-constants,
  expo-font, expo-router)
```

Confirmé préexistant à cette session (`git log` : `expo-linking` n'a jamais été commité avec une version correcte — présent uniquement dans les modifications locales non commitées). **Corrigé** via `npx expo install --fix` : toutes les versions réalignées sur celles attendues par Expo SDK 54. `npx expo-doctor` → **18/18 après correction**. `Linking.createURL()` (utilisé par le flow de reset password de la Phase 4) revérifié fonctionnel après ce changement majeur de version (`tsc` + `expo export --platform web` propres).

## 7. React / react-dom

Toujours alignés sur `19.1.0` exact des deux côtés (correctif de la Phase 4B non modifié, reconfirmé).

## 8. SecureStore sur web

Non touché, conformément à la consigne — la cible de cette phase est le natif iOS, pas le web.

---

## 9-10. Variables d'environnement et audit secrets

```text
Variables réellement utilisées côté client (grep exhaustif app/lib/hooks/constants) :
  EXPO_PUBLIC_SUPABASE_URL       -> PUBLIC, acceptable dans le bundle
  EXPO_PUBLIC_SUPABASE_ANON_KEY  -> PUBLIC, acceptable dans le bundle (protégé par RLS)

Recherche exhaustive (service_role, sk_live, sk_test, secrets Stripe/Airalo/Anthropic/
Brevo/webhook/admin) dans app/, lib/, hooks/, constants/, .env*, app.json, eas.json :
  0 occurrence

Fichiers .pem/.p8/.key à la racine : aucun
```

```text
SECRET EMBARQUÉ DANS LE CLIENT
NON
```

---

## 11. Icône, splash, permissions, ATS

**Icône** (`assets/icon.png`) : 1024×1024, PNG indexé, **sans canal de transparence** (chunk `tRNS` absent, vérifié en lisant les chunks PNG directement) — conforme aux exigences App Store (Apple rejette les icônes avec transparence). `adaptive-icon.png` et `splash-icon.png` ont bien une transparence (chunk `tRNS` présent), ce qui est normal et attendu pour ces deux usages (icône adaptative Android composée sur un fond, logo détouré sur fond blanc pour le splash). **Rien à corriger.**

**Splash** : `resizeMode: "contain"` + `backgroundColor: "#ffffff"` — configuration universelle qui s'adapte par construction à toutes les tailles d'écran (image centrée, jamais déformée ni coupée). Pas de test visuel par appareil possible depuis cet environnement (limitation déjà connue, cf. Phase 4B), mais aucun défaut de configuration identifié dans le code.

**Permissions** : recherche exhaustive de `expo-camera`, `expo-contacts`, `expo-location`, `expo-media-library`, `expo-image-picker`, tracking transparency, `requestPermissionsAsync` → **aucun usage**, confirmé. Deux dépendances natives installées mais **jamais utilisées** dans le code ont été trouvées et retirées :
- `expo-notifications` — aurait pu introduire silencieusement la capacité Push Notifications dans le build iOS sans jamais être exercée (prévu pour la Phase 8, sera réinstallé et configuré correctement à ce moment-là)
- `@stripe/stripe-react-native` — SDK natif Stripe jamais importé (le parcours réel utilise le Checkout hébergé via URL, pas le SDK natif), conforme à la consigne de ne pas introduire le SDK natif dans cette phase

`expo-device` reste présent (aucune permission associée, simple lecture d'informations sur l'appareil) — non utilisé non plus mais sans impact sur les permissions, laissé en l'état (pas de risque, hors périmètre de nettoyage strict permissions).

**ATS** : tous les endpoints réellement appelés par le code (`grep` exhaustif) sont en HTTPS : Supabase, `fenuasim.com`, `esims.cloud`, `wa.me`. Aucune exception ATS nécessaire, aucune ajoutée.

---

## 21-22. Stripe checkout et retour après paiement — anomalie réelle trouvée et corrigée

Architecture réelle confirmée (lecture du code + de l'Edge Function déployée `create-checkout-mobile`) :

```text
app/esim/payment.tsx
  -> invoke('create-checkout-mobile')
  -> Linking.openURL(session.url)   [sortie complète vers Safari, pattern standard
                                      pour un Checkout Stripe hébergé sans SDK natif]
Edge Function create-checkout-mobile (déjà déployée, non modifiée) :
  success_url = fenuasim://payment-success?session_id=...&package_id=...
  cancel_url  = fenuasim://payment-cancel
```

**Anomalie trouvée** : ces deux deep links de retour existaient déjà côté Stripe/Edge Function, mais **aucune route de l'app ne les résolvait réellement** :
- `fenuasim://payment-success` route vers le chemin `/payment-success` — or l'écran réel et déjà complet se trouve à `/esim/payment-success` (fichier `app/esim/payment-success.tsx`, groupe non racine). Le deep link n'aurait donc jamais atteint cet écran.
- `fenuasim://payment-cancel` route vers `/payment-cancel` — **aucun fichier n'existait à aucun chemin** pour cette route.

Sans correction, un vrai paiement en TestFlight aurait laissé l'utilisateur bloqué sur une route non trouvée après son paiement (le risque exact anticipé au point 22 de cette phase).

**Correctif appliqué, strictement minimal, 100% côté client mobile** (aucune Edge Function, aucun Stripe, aucun site touché) :
- `app/payment-success.tsx` créé — réexporte simplement l'écran déjà existant et complet `app/esim/payment-success.tsx` (0 nouvelle logique), pour que le chemin réellement ciblé par le deep link résolve enfin vers lui.
- `app/payment-cancel.tsx` créé — écran minimal (icône, message "Paiement annulé, aucun montant débité", bouton retour à l'accueil), pour que le `cancel_url` déjà existant et déjà envoyé à Stripe cesse de pointer vers une route inexistante.

`tsc --noEmit` propre après ajout de ces deux fichiers.

---

## 23-24. Support et suppression de compte

`constants/support.ts` : WhatsApp `+33 7 49 78 21 01` et e-mail `contact@fenuasim.com` toujours corrects, inchangés. `delete-account` : la fonction est appelée via `supabase.functions.invoke()`, un simple appel HTTPS standard de `supabase-js` — son fonctionnement ne dépend d'aucune spécificité Expo Go vs natif, donc aucune différence de comportement attendue entre les deux environnements (confirmé par la nature de l'appel, pas re-testé en conditions réelles ici puisque déjà testé exhaustivement en Phase 3B avec 8 scénarios réels).

## 25. Password reset

Aucun nouveau test serveur : déjà entièrement validé en Phase 4/4B. Seul le clic réel depuis un client mail natif reste à faire en TestFlight (checklist section 17 ci-dessous).

---

## 26-28. Build iOS

`eas.json` créé manuellement (profils `development`/`preview`/`production`, structure standard EAS). Tentative réelle de build :

```text
$ eas build --platform ios --profile production
→ "An Expo user account is required to proceed.
   Either log in with eas login or set the EXPO_TOKEN environment variable..."
```

**ACTION UTILISATEUR REQUISE** : aucun compte Expo n'est connecté dans cet environnement (`eas whoami` → "Not logged in"), et aucun identifiant Apple Developer/App Store Connect n'y est configurable par un outil automatisé. Deux options pour débloquer, au choix :
1. Exécuter `eas login` (et `eas build --platform ios --profile production`) vous-même depuis un poste où vous êtes déjà authentifié Expo + Apple Developer.
2. Fournir un `EXPO_TOKEN` (jeton d'accès programmatique Expo, généré depuis votre compte — jamais un mot de passe) utilisable dans cet environnement pour lancer le build à votre place.

Aucun mot de passe Apple ni Expo n'a été demandé ni ne le sera. Aucune tentative de contournement (pas de build local sans signature, pas de simulateur substitué à un vrai build signé).

## 29. Checklist TestFlight (à exécuter une fois le build disponible)

```text
Installation
[ ] Installation depuis TestFlight
[ ] Lancement app, icône correcte, splash correct, aucun crash

Auth
[ ] Inscription / Connexion / fermeture+réouverture (session conservée)
[ ] Déconnexion / reconnexion

Password reset (nouveau test réel non fait avant TestFlight)
[ ] Mot de passe oublié -> e-mail reçu -> clic depuis Mail iOS
[ ] FenuaSIM s'ouvre -> écran reset-password -> nouveau mot de passe -> login
[ ] Vérifier aussi depuis Gmail iOS / Gmail Android si possible

Catalogue
[ ] Explorer : France / Europe / USA / Monde, forfaits corrects

Achat (nouveau test réel non fait avant TestFlight)
[ ] Choisir un forfait -> Stripe -> paiement réel faible montant
[ ] Retour automatique vers l'app (fenuasim://payment-success) -- point corrigé
    dans cette phase, à confirmer en conditions réelles
[ ] eSIM créée correctement, aucun mélange de commande
[ ] Annulation d'un paiement -> retour propre (fenuasim://payment-cancel) --
    également corrigé dans cette phase

eSIM / Multi-eSIM
[ ] eSIM visible sur accueil, destination/data/durée corrects
[ ] 2 eSIM / 2 voyageurs : aucune confusion, persistance après logout/login

Support / Compte
[ ] WhatsApp, email, FAQ
[ ] Suppression de compte avec un compte jetable (jamais un compte réel)
```

## 30-31. Test multi-eSIM et intégrité backend

Rappel : le test multi-eSIM complet (2 eSIM/2 voyageurs, aucune confusion) doit être rejoué en conditions réelles sur le premier build TestFlight avant toute publication — déjà validé par le passé en environnement de test, non re-vérifié ici (hors périmètre de cette phase de build). Aucun affaiblissement de RLS/Auth/validation ICCID/suppression de compte n'a été fait ni ne sera fait pour faciliter un test.

## 32. Android

Non lancé dans cette phase, conformément à la priorité iOS/TestFlight. `eas.json` et `app.json` sont déjà prêts pour un futur `eas build --platform android` (package `com.fenuasim.app`, `versionCode` défini).

---

## 33-34. Vérifications techniques et git

```text
npx tsc --noEmit          -> ✅ (avant et après tous les changements de cette phase)
npx expo-doctor            -> ✅ 18/18 (2 échecs initiaux corrigés)
npx expo export --platform web -> ✅
```

`git status` : nombreux fichiers modifiés/non suivis, mais tous rattachés à des phases déjà autorisées de ce même projet mobile (Phases 1 à 4B : sécurité, support, suppression de compte, password reset, plus les fichiers de cette Phase 5). Le chantier de sécurisation du site web est un dépôt/système entièrement séparé — aucun risque de contamination croisée par construction. Aucun fichier expérimental ou accidentel identifié.

---

## Compte-rendu

```text
PHASE
5 — EAS + premier build TestFlight

ÉTAT
⚠️ (préparation entièrement terminée et vérifiée ; build réel bloqué uniquement
par l'absence de credentials Expo/Apple, hors de portée des outils disponibles)

APP NAME
FenuaSIM (corrigé, était "fenuasim-app")

EXPO SLUG
fenuasim-app (inchangé)

SCHEME
fenuasim (inchangé)

BUNDLE IDENTIFIER IOS
com.fenuasim.app (déjà existant, conservé)

PACKAGE ANDROID
com.fenuasim.app (déjà existant, conservé)

VERSION
1.0.0

BUILD NUMBER IOS
1 (ajouté, était absent)

VERSION CODE ANDROID
1 (ajouté, était absent)

EXPO SDK
54 (54.0.37 après correction des versions)

EAS CONFIGURÉ
✅ (eas.json créé manuellement : development/preview/production)

APPLE DEVELOPER
ACTION UTILISATEUR REQUISE (aucun accès aux credentials Apple depuis cet environnement)

APP STORE CONNECT
ACTION UTILISATEUR REQUISE (dépend du build EAS, lui-même bloqué sur le login Expo)

REDIRECT URL SUPABASE
✅ fenuasim://reset-password (ajoutée manuellement par vous, confirmée en Phase 4B)

PKCE
✅ (inchangé depuis Phase 4B)

SECRET EMBARQUÉ DANS LE CLIENT
NON

SERVICE ROLE DANS LE CLIENT
NON

STRIPE SECRET DANS LE CLIENT
NON

AIRALO SECRET DANS LE CLIENT
NON

ICÔNE
✅ (1024×1024, sans transparence, conforme App Store)

SPLASH
✅ (configuration universelle contain + fond blanc, aucun défaut identifié dans le code)

PERMISSIONS IOS
Aucune permission sensible demandée (caméra/contacts/localisation/tracking/photos :
0 usage). expo-notifications et @stripe/stripe-react-native retirés car installés
mais jamais utilisés, réduisant la surface de capacités inutiles du premier build.

DEEP LINK NATIF CONFIGURÉ
✅ (scheme fenuasim déjà en place ; anomalie de routing du retour paiement
   trouvée et corrigée, voir section 21-22)

BUILD IOS
❌ (bloqué : "An Expo user account is required to proceed" — action utilisateur requise)

BUILD ID EAS
N/A (build non lancé)

SOUMIS APP STORE CONNECT
NON

DISPONIBLE TESTFLIGHT
NON (en attente de l'action utilisateur ci-dessus)

TYPESCRIPT
✅

EXPO DOCTOR
✅ 18/18 (2 anomalies réelles trouvées et corrigées : expo-linking en version
majeure incorrecte + expo-constants dupliqué)

MODIFICATIONS BACKEND
NON

MODIFICATIONS SITE
NON

MODIFICATIONS RLS
NON

POINTS À TESTER SUR IPHONE
Voir checklist complète section "29. Checklist TestFlight" de ce rapport —
en particulier le retour automatique après paiement Stripe (fenuasim://payment-success
et fenuasim://payment-cancel), corrigé dans cette phase mais jamais testé en
conditions réelles faute de build natif, et le clic sur le lien de reset password
depuis un vrai client mail.

ACTION UTILISATEUR REQUISE
1. eas login (ou fournir un EXPO_TOKEN) pour permettre le lancement du build
2. Compte Apple Developer actif + accès App Store Connect pour la signature et
   la soumission TestFlight (EAS guide normalement ce processus une fois connecté)
3. Vérifier qu'aucun autre Bundle ID "com.fenuasim.app" n'existe déjà côté Apple
   sous un autre compte (non vérifiable depuis cet environnement)

PRÊT POUR TESTFLIGHT
NON — préparation et corrections terminées, build réel en attente des
credentials Expo/Apple (points ci-dessus)
```
