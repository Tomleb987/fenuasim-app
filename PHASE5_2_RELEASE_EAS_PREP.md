```text
PHASE
5.2 — RELEASE / EAS PREPARATION

ÉTAT
⚠️ (code techniquement prêt, mais 2 blocages hors-code : EAS non authentifié, git non propre)

================================
GIT
================================

REPO
fenuasim-app

BRANCH
main

HEAD INITIAL
8682ae2 (déjà poussé sur origin/main)

HEAD FINAL
8682ae2 (inchangé — aucun commit fait pendant cet audit, voir ci-dessous)

WORKTREE CLEAN
NON

COMMITS
1 seul commit depuis le début de cette session (8682ae2, Phase 4F/4F.1), déjà poussé.

MODIFICATIONS COMMITÉES
Tout jusqu'à 8682ae2 inclus : Phases 1 à 4D (sécurité, support, suppression compte,
mot de passe oublié), 4F (recharge eSIM) et 4F.1 (hardening airalo_topups).

MODIFICATIONS NON COMMITÉES (fichiers déjà trackés, modifiés)
app.json, app/(auth)/login.tsx, app/(auth)/register.tsx, app/(tabs)/_layout.tsx,
app/(tabs)/account.tsx, app/(tabs)/explore.tsx, app/_layout.tsx,
app/esim/[country].tsx, app/esim/payment-success.tsx, app/esim/payment.tsx,
app/insurance/confirm.tsx, app/insurance/form.tsx, hooks/useDataUsage.ts,
hooks/useUserData.ts, lib/supabase.ts, package.json, package-lock.json,
PHASE4F_RECHARGE_ESIM.md

FICHIERS NON TRACKÉS
app/(auth)/forgot-password.tsx, app/(auth)/reset-password.tsx, app/account/,
app/devices/, app/esim/assign.tsx, app/support/, app/travelers/,
constants/support.ts, eas.json, hooks/useDevices.ts, hooks/useEsimAssignments.ts,
hooks/usePackageInfo.ts, hooks/useTravelers.ts, lib/regionNames.ts,
+ 17 rapports PHASE*/CR_*/ETAT_DES_LIEUX*.md, + 1 capture d'écran.

CE QUE C'EST RÉELLEMENT
Ce n'est pas du travail expérimental ou risqué : chacun de ces changements
correspond à une phase déjà terminée et déjà rapportée (PHASE1_SECURITE.md,
PHASE2_SUPPORT.md, PHASE3B_SUPPRESSION_COMPTE.md, PHASE4_MOT_DE_PASSE_OUBLIE.md,
PHASE5_EAS_TESTFLIGHT.md, COMPTE_RENDU_MULTI_ESIM.md, + le polish 5.1 fait
aujourd'hui) — juste jamais commité, y compris avant cette conversation.
app.json en fait partie : name "FenuaSIM" + iOS buildNumber + Android versionCode
(exactement ce que demande la Section 3-5 de cette phase) sont déjà corrigés dans
l'arbre de travail, mais le commit HEAD actuel a encore l'ancien nom "fenuasim-app"
et aucun build number.

POURQUOI JE N'AI PAS RENDU LE GIT PROPRE MOI-MÊME
Plusieurs fichiers (app/_layout.tsx, app/insurance/form.tsx, hooks/useDataUsage.ts,
app/(auth)/register.tsx, app/(tabs)/account.tsx...) mélangent des modifications de
sessions antérieures ET mes retouches d'aujourd'hui (5.1) dans les MÊMES lignes —
impossible de les séparer proprement par un simple choix de fichiers à ajouter.
Une séparation fiable demanderait une chirurgie ligne par ligne (git add -p) sur des
fichiers sensibles (auth, suppression de compte, paiement) que je ne veux pas faire
sans validation. → Question posée séparément sur comment committer.
```

================================
VERSION
================================

```text
APP NAME
FenuaSIM (arbre de travail) — ⚠️ toujours "fenuasim-app" dans le dernier commit

VERSION
1.0.0

IOS BUNDLE ID
com.fenuasim.app

IOS BUILD NUMBER
1 (arbre de travail) — ⚠️ absent dans le dernier commit

ANDROID PACKAGE
com.fenuasim.app

ANDROID VERSION CODE
1 (arbre de travail) — ⚠️ absent dans le dernier commit
```

Aucune build store n'a jamais été envoyée (confirmé par la Phase 5 précédente :
`eas whoami` déjà "not logged in" à l'époque) → buildNumber/versionCode = 1 est
correct, pas une supposition.

================================
EAS
================================

```text
EAS PROJECT ID
ABSENT (aucun extra.eas.projectId dans app.json, confirmé via `expo config --type public`)

EAS AUTH
❌ (`eas whoami` → "Not logged in")

PROFILE DEVELOPMENT
présent — developmentClient:true, distribution:internal (correct pour du dev)

PROFILE PREVIEW
présent — distribution:internal (correct pour du preview interne)

PROFILE PRODUCTION
présent — autoIncrement:true, ni developmentClient ni distribution:internal
(distribution "store" par défaut = correct pour une vraie build store)

PRODUCTION DISTRIBUTION
store (par défaut, non internal) ✅

AUTO INCREMENT
✅ activé sur le profil production uniquement, appVersionSource: "local"
(cohérent : buildNumber/versionCode gérés localement dans app.json, incrémentés
automatiquement par EAS à chaque build production)
```

================================
ENV
================================

```text
PRODUCTION ENV
✅ — 2 variables seulement, toutes deux publiques :
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY

SUPABASE PROD
✅ — URL vérifiée = hptbhujyrhjsquckzckc.supabase.co (le bon projet, confirmé)

SECRETS PRIVÉS DANS MOBILE
0 — recherche faite pour SERVICE_ROLE / STRIPE_SECRET / CLIENT_SECRET /
AVA_PASSWORD / CRON_SECRET / API_KEY dans tout le code source : aucun résultat

SECRET COMMITÉ
NON — .env non tracké par git (confirmé), correctement listé dans .gitignore
```

Bonus corrigé aujourd'hui (5.1) : une clé anon Supabase codée en dur dans
`hooks/useDataUsage.ts` a été retirée (remplacée par le client Supabase déjà
configuré) — ce n'était pas un vrai secret (clé publique) mais une duplication
inutile, maintenant nettoyée.

================================
BRANDING
================================

```text
APP NAME
✅ (arbre de travail) / ⚠️ non encore commité

ICON
✅ — assets/icon.png présent, 1024×1024, PNG valide

ANDROID ADAPTIVE ICON
✅ présent (1024×1024) — ⚠️ backgroundColor blanc générique, pas la marque
violet/orange de l'app ; décision produit à confirmer, non modifié ici

SPLASH
✅ fonctionnel — le flash blanc→dégradé au démarrage froid déjà repéré en
Phase 5.1 n'a pas été retouché (hors périmètre 5.2, qui ne doit pas refaire le
polish)
```

================================
NATIVE
================================

```text
IOS PERMISSIONS
Aucune — aucun package caméra/photos/notifications/localisation/contacts dans
les dépendances (expo-device et expo-secure-store ne déclenchent aucune
demande de permission)

ANDROID PERMISSIONS
Même constat — rien au-delà de l'accès réseau standard

DEEP LINKS
✅ — scheme "fenuasim" confirmé dans app.json

RESET PASSWORD LINK
✅ — app/(auth)/reset-password.tsx présent

PAYMENT LINKS
✅ — app/payment-success.tsx, app/payment-cancel.tsx présents

TOPUP LINKS
✅ — app/topup-success.tsx, app/topup-cancel.tsx présents
```

================================
QUALITY
================================

```text
TYPECHECK
✅ npx tsc --noEmit — 0 erreur

EXPO DOCTOR
18/18 ✅ (aucune régression)

EXPO CONFIG
✅ `npx expo config --type public` résout proprement, aucune erreur

DEV FLAGS
0 — recherche __DEV__/mock/testMode/bypass/fixture : aucun résultat

PRODUCTION LOCALHOST URLS
0 — aucune URL localhost/127.0.0.1/http:// non sécurisée trouvée

SENSITIVE LOGS
0 — 1 seul console.error dans tout le code (hooks/useDataUsage.ts, message
générique, aucune donnée sensible/token/session affichée)
```

`npx expo install --check` : dépendances à jour, aucune incompatibilité.
Aucun secret Airalo/Stripe côté client ; aucun appel direct
`partners-api.airalo.com` depuis le bundle mobile (recherché, confirmé 0
résultat) — toutes les opérations mutatives (POST orders/topups) restent
serveur, conformément à la Phase 4F.
`@stripe/stripe-react-native` toujours absent des dépendances ✅.

================================
IOS
================================

```text
APPLE CREDENTIALS
ACTION UTILISATEUR — non vérifiable tant qu'EAS n'est pas authentifié

APPLE TEAM
NON VÉRIFIABLE

IOS BUILD
NOT STARTED

BUILD ID
-
```

================================
ANDROID
================================

```text
KEYSTORE
NON VÉRIFIABLE (EAS non authentifié)

ANDROID BUILD CONFIG
READY — profils eas.json corrects, package/versionCode présents

ANDROID BUILD
NON REQUISE POUR L'INSTANT — priorité iOS/TestFlight (Phase 7 pour Android)
```

================================
V1 SCOPE
================================

```text
ACHAT ESIM
✅

MES ESIM
✅

RECHARGE ESIM
✅ CODE

ASSURANCE
HORS V1 — écran "Bientôt disponible" assumé, aucun parcours cassé/accessible
qui ferait croire à une vraie souscription

PHASE 4G RECHARGE RÉELLE
À FAIRE
```

================================
CONCLUSION
================================

```text
BUILD IOS TECHNIQUEMENT PRÊTE
NON — uniquement bloquée par eas login + décision git, pas par le code
(typecheck, expo-doctor, config, secrets, deep links : tout est vert)

BUILD ANDROID TECHNIQUEMENT PRÊTE
NON (même blocage) — non prioritaire, Phase 7

BLOQUANTS
1. EAS non authentifié (`eas whoami` → Not logged in)
2. Projet EAS jamais initialisé (extra.eas.projectId absent)
3. Git non propre — décision nécessaire sur comment committer le backlog
   pré-existant (voir section GIT ci-dessus)
4. Aucun lien CGV/confidentialité trouvé dans l'app — pas bloquant pour le
   build lui-même, mais sera exigé par App Store Connect en Phase 6

ACTION UTILISATEUR
1. Choisir comment committer (voir question posée séparément)
2. `eas login` (dans ce terminal, ou confirmez que c'est déjà fait ailleurs)
3. Une fois fait, je relance : `eas init` (lier le projet) puis
   `eas build --platform ios --profile production`

PRÊT POUR PHASE 6 TESTFLIGHT
NON — dépend du build iOS réussi ; la 4G (recette réelle) reste par ailleurs
en attente pour une validation fonctionnelle complète avant diffusion large
```
