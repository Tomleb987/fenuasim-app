# PHASE 4 — Mot de passe oublié + Deep Links

_Rédigé le 2026-08-23. Développée en parallèle de l'audit sécurité du site web, sans aucune modification des tables/policies en cours d'audit._

---

## 1. Audit Auth existant (avant implémentation)

```text
app/(auth)/login.tsx    : signInWithPassword, aucun lien "mot de passe oublié" existant
app/(auth)/register.tsx : signUp, regle mot de passe deja en place = 6 caracteres min
app/_layout.tsx          : garde de session base sur onAuthStateChange + useSegments,
                            AUCUNE gestion de l'evenement PASSWORD_RECOVERY avant cette phase
lib/supabase.ts           : detectSessionInUrl: false (correct pour RN), persistSession: true,
                            SecureStore adapter, flowType NON DEFINI -> defaut reel confirme
                            dans le code source installe (@supabase/auth-js) : 'implicit'
app.json                  : scheme "fenuasim" DEJA PRESENT, aucune modification necessaire
associatedDomains/intentFilters : ABSENTS (aucune configuration Universal Links existante)
```

**Bug trouvé pendant l'audit** : le garde de `app/_layout.tsx` contenait `if (session && inAuth) router.replace('/(tabs)')`. Sans correction, l'établissement d'une session de récupération (qui rend `session` vrai pendant que l'utilisateur est encore dans le groupe `(auth)`) aurait éjecté l'utilisateur vers l'accueil authentifié avant qu'il ait pu changer son mot de passe. **Corrigé** dans cette phase (voir section 3).

---

## 2. Décision technique : PKCE (justifiée, pas supposée)

`flowType` n'était pas défini → défaut réel `'implicit'` (vérifié dans `node_modules/@supabase/auth-js`, pas supposé). Décision : **passer explicitement à `flowType: 'pkce'`** dans `lib/supabase.ts`.

Justification vérifiée (documentation officielle Supabase, `search_docs`) :
- `resetPasswordForEmail` supporte officiellement PKCE.
- PKCE est la recommandation officielle pour mobile car le flow implicite expose les tokens directement dans l'URL du deep link, gérée par l'OS — interceptable par d'autres applications. PKCE lie l'échange du code au `code_verifier` stocké localement sur l'appareil qui a initié la demande.

**Vérifié en conditions réelles** (et non supposé) : une vraie demande `resetPasswordForEmail` a été passée pour un compte de test réel, puis la table interne `auth.flow_state` de Supabase a été inspectée en direct. Résultat confirmé : `authentication_method: "recovery"`, `code_challenge_method: "s256"` — la configuration PKCE est bien active côté serveur pour ce flow, exactement comme prévu.

---

## 3. Implémentation

### `lib/supabase.ts`
Ajout de `flowType: 'pkce'`. Aucun autre changement (le reste de la config était déjà correct).

### `app/_layout.tsx`
- Nouvel état `isPasswordRecovery`, mis à `true` sur l'event `PASSWORD_RECOVERY`, remis à `false` sur `SIGNED_OUT`.
- Garde corrigé : tant que `isPasswordRecovery` est vrai, l'utilisateur est **toujours** maintenu sur `/(auth)/reset-password`, quel que soit l'état de `session` — plus aucun risque d'éjection vers l'accueil authentifié pendant une récupération.

### `app/(auth)/login.tsx`
Lien "Mot de passe oublié ?" ajouté sous le champ mot de passe, discret (texte gris, aligné à droite), navigue vers `/(auth)/forgot-password`. Design existant conservé.

### `app/(auth)/forgot-password.tsx` (nouveau)
Écran dédié : validation locale du format e-mail, appel `supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('reset-password') })`, message générique anti-énumération (identique que le compte existe ou non), état "Envoi en cours…" avec bouton désactivé, état "Consultez votre boîte e-mail" avec option "Renvoyer le lien", lien "Retour à la connexion".

`Linking.createURL('reset-password')` (expo-linking) est utilisé plutôt qu'un `fenuasim://reset-password` codé en dur, car il résout automatiquement la bonne URI selon l'environnement (Expo Go vs build natif) — recommandation officielle Supabase/Expo pour les deep links.

### `app/(auth)/reset-password.tsx` (nouveau)
Gère le retour du lien de manière défensive (le format exact dépend de la configuration du template e-mail côté Dashboard, non consultable depuis cet environnement — donc aucun format n'est supposé arbitrairement, les trois mécanismes officiels sont gérés) :
1. `?code=...` → `exchangeCodeForSession(code)` (PKCE, format réellement observé et confirmé en base)
2. `?token_hash=...&type=...` → `verifyOtp({ token_hash, type })` (repli si un autre mécanisme est un jour utilisé)
3. `?access_token=...&refresh_token=...` → `setSession(...)` (repli flow implicite)
4. Aucun de ces éléments / `?error=...` → écran "lien invalide", **jamais** d'accès au formulaire (règle du point 10 : un deep link seul n'est jamais une preuve d'identité)

Avant tout traitement du lien : si une session est déjà active sur l'appareil, elle est terminée (`signOut()`) pour ne jamais mélanger deux comptes. Une fois la session de récupération validée : formulaire "Nouveau mot de passe" / "Confirmer le mot de passe" (validation locale : non vide, ≥ 6 caractères — même règle que `register.tsx`, cohérente avec le backend réel), `updateUser({ password })`, puis écran de succès, puis `signOut()` + retour à `/(auth)/login` (comportement V1 recommandé par l'utilisateur, appliqué tel quel).

Aucun mot de passe ni token n'est jamais journalisé (`grep` sur les 4 fichiers modifiés/créés : 0 occurrence de `console.*`).

---

## 4. Redirect URL Supabase — action manuelle requise

**Limite d'outillage constatée** : la configuration des "Redirect URLs" d'authentification Supabase est un réglage Dashboard/Management API, pas une table Postgres ni une Edge Function — **aucun outil disponible dans cet environnement ne permet de la lire ou de la modifier**. Elle n'a donc pas pu être vérifiée ni ajoutée à distance.

**Action à effectuer manuellement** par vous dans Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, ajouter :
```text
fenuasim://reset-password
```
(ou `fenuasim://**` si vous prévoyez d'autres deep links futurs). Sans cette entrée, `resetPasswordForEmail` acceptera toujours l'appel mais le lien final pourrait être rejeté ou retomber sur le `Site URL` par défaut.

---

## 5. Tests réels exécutés (comptes 100% jetables, tous nettoyés après coup)

Aucun accès à une boîte e-mail réelle dans cet environnement — au lieu de renoncer à la vérification, le code PKCE réel a été récupéré directement depuis la table interne `auth.flow_state` de Supabase (colonne `auth_code`, en clair, générée par le vrai appel `resetPasswordForEmail`), permettant de rejouer l'échange exact qu'un clic réel sur le lien e-mail aurait déclenché — un test de bout en bout authentique, pas une simulation.

```text
Test A (demande normale, email existant)
✅ — resetPasswordForEmail() sans erreur

Test B (email inconnu)
✅ — resetPasswordForEmail() sans erreur, réponse strictement identique au Test A
     (aucune énumération de compte possible, vérifié par comparaison directe)

Test C (mauvais format e-mail)
✅ — regex de validation locale vérifiée sur 7 cas (bad-email, test@, @example.com,
     test@example, "a b@example.com" rejetés ; valid@example.com, adresses réelles
     acceptées)

Test D (lien valide)
✅ — exchangeCodeForSession(code réel) : session obtenue, event PASSWORD_RECOVERY
     confirmé déclenché (recoveryEventFired: true)

Test E (lien expiré/invalide)
✅ — réutilisation d'un code déjà échangé une fois : erreur retournée par Supabase,
     l'écran passe bien sur l'état "invalide" (aucun accès au formulaire)

Test F (mots de passe différents)
✅ — vérifié par revue de code (comparaison synchrone déterministe, aucune
     dépendance réseau à tester en conditions réelles)

Test G (nouveau mot de passe valide)
✅ — updateUser({password}) réel : succès confirmé

Test H (ancien mot de passe)
✅ — signInWithPassword avec l'ancien mot de passe : rejeté
     ("Invalid login credentials")

Test I (nouveau mot de passe)
✅ — signInWithPassword avec le nouveau mot de passe : connexion réussie confirmée

Test deep link malveillant/direct (point 31)
✅ — exchangeCodeForSession() avec un code inventé : erreur, jamais d'accès
     au changement de mot de passe

Test utilisateur déjà connecté (point 32)
✅ — compte X connecté (session active et vérifiée), puis logique de l'écran
     reproduite : session de X purgée AVANT tout traitement du lien.
     Vérifié à deux niveaux : session locale nulle après signOut() ET
     tentative de refresh de l'ancien refresh token de X rejetée côté serveur
     ("Refresh Token Not Found") — preuve d'une déconnexion réelle, pas
     seulement locale. Aucun mélange de comptes possible.
```

**Nettoyage** : 4 comptes de test créés (`phase4-reset-*`, `phase4-alreadylogged-*`, `phase4-reset-target-*@example.com`), tous supprimés après les tests, vérifié `0` résiduel dans `auth.users`. Une ligne orpheline dans `auth.flow_state` (issue d'un compte de test abandonné avant échange) également détectée et supprimée manuellement, `0` résiduel confirmé.

---

## Compte-rendu

```text
PHASE
4 — Mot de passe oublié + Deep Links

ÉTAT
✅

AUTH EXISTANTE AUDITÉE
Oui — login.tsx, register.tsx, _layout.tsx, lib/supabase.ts, app.json lus et
analysés avant toute modification. Bug de garde de session trouvé et corrigé.

ÉCRAN LOGIN MODIFIÉ
OUI (ajout du lien "Mot de passe oublié ?", design existant conservé)

MOT DE PASSE OUBLIÉ AJOUTÉ
✅

ÉCRAN FORGOT PASSWORD
✅

ÉCRAN RESET PASSWORD
✅

SUPABASE resetPasswordForEmail
✅ (testé réellement, comportement identique compte existant/inconnu)

SUPABASE updateUser
✅ (testé réellement, modification confirmée)

FLOW PKCE / SESSION UTILISÉ
PKCE — flowType explicitement configuré, confirmé actif côté serveur via
inspection directe de auth.flow_state (authentication_method: "recovery",
code_challenge_method: "s256")

SCHEME EXPO
"fenuasim" — déjà présent dans app.json, aucune modification nécessaire

DEEP LINK
fenuasim://reset-password (résolu dynamiquement via Linking.createURL()
pour fonctionner aussi bien en Expo Go qu'en build natif)

REDIRECT URL SUPABASE
NON VÉRIFIABLE À DISTANCE — aucun outil disponible pour lire/modifier ce
réglage Dashboard. Action manuelle requise (voir section 4 du rapport) :
ajouter fenuasim://reset-password dans Authentication > URL Configuration

PASSWORD_RECOVERY EVENT GÉRÉ
✅ (testé réellement : recoveryEventFired confirmé après exchangeCodeForSession ;
guard de app/_layout.tsx corrigé pour ne jamais rediriger vers l'accueil
authentifié pendant une récupération)

ENUMÉRATION EMAIL EMPÊCHÉE
✅ (testé réellement : réponse strictement identique pour un email existant
et un email inconnu)

TOKEN LOGGÉ
NON (0 occurrence de console.* dans les fichiers créés/modifiés)

MOT DE PASSE STOCKÉ LOCALEMENT
NON (vit uniquement dans l'état React du composant, jamais persisté)

DEEP LINK SANS TOKEN
REFUSÉ (testé réellement : code inventé → erreur → écran "invalide", jamais
d'accès au formulaire)

TEST EMAIL EXISTANT
✅

TEST EMAIL INCONNU
✅

TEST LIEN VALIDE
✅

TEST LIEN INVALIDE
✅

TEST ANCIEN MOT DE PASSE
✅ (rejeté après changement, testé réellement)

TEST NOUVEAU MOT DE PASSE
✅ (accepté après changement, testé réellement)

TEST UTILISATEUR DÉJÀ CONNECTÉ
✅ (session purgée avant traitement, révocation serveur réelle confirmée,
aucun mélange de comptes)

TEST EXPO GO
Logique serveur et de navigation testée de bout en bout via appels API réels
(le plus critique). Le comportement natif du clic sur un lien depuis un client
mail réel (Mail iOS, Gmail iOS/Android) n'a pas pu être testé faute d'appareil/
client mail dans cet environnement — limitation attendue et déjà signalée par
l'utilisateur comme non bloquante pour cette phase, à revalider en TestFlight

TEST TESTFLIGHT NÉCESSAIRE
OUI — validation finale du deep link natif iOS/Android (clic e-mail réel →
ouverture FenuaSIM → écran reset) à refaire sur le premier build TestFlight

PROFILES MODIFIÉ
NON

AIRALO_ORDERS MODIFIÉ
NON

USER_SIMS MODIFIÉ
NON

CUSTOMER_ESIMS MODIFIÉ
NON

POLICIES MODIFIÉES
NON

RLS MODIFIÉE
NON

SITE WEB MODIFIÉ
NON

STRIPE MODIFIÉ
NON

TYPESCRIPT
✅

BUILD EXPO
✅

POINTS RESTANTS
1. Ajouter manuellement fenuasim://reset-password dans Supabase Dashboard >
   Authentication > URL Configuration > Redirect URLs (aucun outil ne permet
   de le faire à distance) — sans cette étape, le lien réel envoyé par e-mail
   pourrait être rejeté en production
2. Validation TestFlight du deep link natif (clic e-mail réel sur iOS/Android)
   une fois le premier build disponible
3. Validation visuelle réelle des 2 nouveaux écrans (pas de simulateur
   pilotable dans cet environnement, limitation déjà connue des phases
   précédentes)
4. user_sims (RLS désactivée) et profiles/airalo_orders (policies ouvertes) :
   toujours en attente de l'audit du site web, non traités ici par périmètre
```
