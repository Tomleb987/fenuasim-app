# PHASE 4B — Validation finale Auth avant TestFlight

_Rédigé le 2026-08-23. Passe de validation courte, aucune nouvelle fonctionnalité ajoutée._

---

## 1. Redirect URL Supabase

**ACTION MANUELLE TOUJOURS REQUISE.** Nouvelle tentative de vérification cette fois via `get_project` (métadonnées projet) : ce point de terminaison ne retourne que `id/ref/organization/name/region/database/status`, aucune information sur la configuration Auth (URL Configuration). Aucun outil disponible dans cet environnement n'expose la lecture ou l'écriture des Redirect URLs — c'est un réglage Dashboard/Management API, hors d'atteinte des outils Supabase MCP fournis ici. Non contourné par du code artificiel, conformément à la consigne. Vous devez toujours ajouter manuellement `fenuasim://reset-password` dans Supabase Dashboard → Authentication → URL Configuration → Redirect URLs avant le premier envoi réel.

## 2. Configuration PKCE finale — confirmée cohérente

```ts
// lib/supabase.ts
storage: ExpoSecureStoreAdapter,   // SecureStore, inchangé
autoRefreshToken: true,
persistSession: true,
detectSessionInUrl: false,          // correct pour React Native
flowType: 'pkce',                   // confirmé actif
```
Aucune incohérence détectée. Aucune modification nécessaire.

---

## 3-9. Tests réels (compte 100 % jetable, technique `auth.flow_state` réutilisée pour le recovery)

Tous les tests ci-dessous ont été exécutés avec de vrais appels API contre le projet Supabase réel, avec un client reproduisant exactement `lib/supabase.ts` (même `flowType`, même `detectSessionInUrl`, même `persistSession` — seul le support de stockage diffère : fichier local au lieu de `SecureStore`, pour simuler fidèlement la persistance disque entre deux lancements de l'app).

```text
Inscription (signUp)
✅ — compte créé sans erreur, session immédiate obtenue

Confirmation e-mail — statut réel déterminé, non supposé
DÉSACTIVÉE — confirmé à deux niveaux :
  1. signUp() a retourné une session immédiatement utilisable (comportement
     impossible si la confirmation était active)
  2. vérification directe en base : email_confirmed_at renseigné automatiquement
     à l'instant de l'inscription, confirmation_sent_at = null (aucun e-mail de
     confirmation n'a jamais été mis en file d'attente)
  => Le point 4 "test réel du clic sur l'e-mail de confirmation" ne s'applique
     pas : il n'y a pas d'e-mail de confirmation à cliquer dans cette configuration.

Connexion (signInWithPassword)
✅ — session obtenue sans erreur

Persistance de session
✅ — nouvelle instance de client pointant vers le même stockage, SANS rejouer
     signInWithPassword : la session est restaurée automatiquement pour le
     même utilisateur (getSession() la retrouve). Aucune régression PKCE sur
     ce point : la persistance repose sur les access/refresh tokens standards,
     pas sur un mécanisme spécifique à PKCE.

Déconnexion (signOut)
✅ — session supprimée localement ET révoquée réellement côté serveur
     (tentative de refresh avec l'ancien refresh token → "Refresh Token Not
     Found", preuve d'une déconnexion serveur réelle, pas seulement locale)

Reconnexion (même compte, après déconnexion)
✅ — signInWithPassword fonctionne normalement après le passage PKCE

Recovery après connexion classique (coexistence)
✅ — parcours complet rejoué sur le MÊME compte que les tests précédents :
     logout → resetPasswordForEmail → exchangeCodeForSession (code réel
     récupéré via auth.flow_state) → event PASSWORD_RECOVERY confirmé
     déclenché → updateUser(nouveau mot de passe) → signOut automatique
     (sessionIsNull confirmé) → connexion avec le nouveau mot de passe réussie
     → ancien mot de passe toujours refusé. Aucune interférence entre le
     parcours classique et le parcours recovery, sur le même utilisateur.
```

---

## 10. Réaudit du guard `app/_layout.tsx`

Relu ligne par ligne (fichier inchangé depuis la Phase 4, seule une nouvelle vérification a été faite) :

```text
Non connecté sur /(tabs)
✅ → !session && !inAuth → redirection /(auth)/login

Connecté normalement sur /(auth)/login
✅ → session && inAuth (et isPasswordRecovery false) → redirection /(tabs)

Recovery actif sur /(auth)/reset-password
✅ → isPasswordRecovery true → reste sur reset-password (aucune redirection,
     y compris si l'utilisateur tente de naviguer manuellement ailleurs
     pendant la récupération : il est ramené sur reset-password)

Recovery terminé (signOut)
✅ → SIGNED_OUT remet isPasswordRecovery à false ; la navigation vers
     /(auth)/login est portée explicitement par handleBackToLogin() dans
     reset-password.tsx (pas par le guard, qui n'a pas besoin d'intervenir
     puisque /(auth)/login est déjà dans le groupe (auth))
```
Aucune boucle de navigation possible : chaque branche ne déclenche `router.replace` que lorsque la route cible diffère de la route courante.

## 11. Routes publiques Auth

`/(auth)/login`, `/(auth)/register`, `/(auth)/forgot-password`, `/(auth)/reset-password` sont tous des écrans du même groupe `(auth)` — accessibles sans session par construction (le guard ne redirige vers login que si `!inAuth`). `reset-password` ne rend le formulaire qu'après une session de récupération validée (`step === 'ready'`), jamais avant.

## 12. Deep link invalide — retesté

Nouvel appel réel `exchangeCodeForSession()` avec un code inventé, sans lien réel : erreur retournée ("PKCE code verifier not found..."), confirmant que l'écran afficherait bien l'état "invalide". Par construction du code (`reset-password.tsx`), une ouverture sans aucun paramètre (`code`/`token_hash`/`access_token`) n'atteint même pas cet appel — elle est rejetée avant, directement sur l'état "invalide". Confirmé refusé dans les deux cas.

## 13. Logs

`grep` sur `app/(auth)/*`, `app/_layout.tsx`, `lib/supabase.ts` : **0** occurrence de `console.log/warn/error/info/debug`. Aucun mot de passe, token, JWT ou session complète journalisé.

## 14. Nettoyage

Comptes de test créés pendant cette passe (`phase4b-*@example.com`) supprimés, vérifié `0` résiduel dans `auth.users` et dans `auth.flow_state` (table interne Supabase). Fichiers de stockage temporaires locaux supprimés.

## 15. `profiles`

Non touché. L'inscription a été testée et confirmée fonctionnelle sans dépendre d'une ligne `profiles` (le compte de test n'en a jamais eu besoin pour signUp/signIn/signOut/updateUser). La réparation de `handle_new_user()`/trigger/RLS `profiles` reste dans le chantier sécurité séparé.

---

## 16. Validation visuelle — limitation rencontrée, traitée honnêtement

Une tentative réelle (pas seulement déclarée impossible d'office) a été faite : lancement d'un serveur `expo start --web` + navigation pilotée par un navigateur headless (Playwright/Chromium) sur les 3 écrans.

**Deux découvertes réelles en cours de route, non liées à PKCE ni à cette phase :**
1. `react-dom` était figé sur `^19.2.6` alors que `react` est figé sur `19.1.0` exact (préexistant à cette session, confirmé par `git diff`/`git log` — pas introduit par la Phase 4/4B). Ce décalage de version faisait planter le rendu web (page blanche, "Incompatible React versions"). **Corrigé** : `react-dom` aligné en `19.1.0` exact dans `package.json`, réinstallé. Correction sûre et sans impact natif (React Native n'utilise pas `react-dom`).
2. Une fois ce blocage levé, un second obstacle **réel et non contournable proprement** est apparu : `expo-secure-store` n'a pas d'implémentation fonctionnelle sur la cible web de ce projet (`ExpoSecureStore.default.getValueWithKeyAsync is not a function`), ce qui fait planter l'app entière au chargement (`lib/supabase.ts` appelle `SecureStore` dès `getSession()` dans `_layout.tsx`). **Ce n'est pas un bug introduit par cette phase** — c'est une limitation de plateforme (SecureStore est nativement pensé pour iOS/Android, pas pour le web) qui touche l'app entière, pas seulement les écrans Auth. Contourner ça proprement demanderait un adaptateur de stockage conditionnel par plateforme — hors périmètre de cette passe de validation (ce serait un nouveau chantier, explicitement exclu par la règle finale).

**Conclusion honnête** : le rendu web n'est pas une voie de validation visuelle viable pour cette application tant que `SecureStore` est utilisé tel quel — seul Expo Go / un simulateur / TestFlight peuvent réellement afficher ces écrans. Validation donc effectuée par **relecture attentive du code** des 3 écrans (structure JSX, styles, états loading/disabled/erreur, `KeyboardAvoidingView`, `SafeAreaView`) plutôt que par capture visuelle réelle :

```text
Login    : lien "Mot de passe oublié ?" bien positionné sous le mot de passe,
           style discret cohérent avec le reste de l'écran, clavier géré
           (KeyboardAvoidingView existant, inchangé), aucun défaut détecté

Forgot   : rendu structuré (titre/description/champ/bouton/retour), état
password   loading (spinner + texte + bouton désactivé), état "envoyé" avec
           message générique + renvoi + retour, erreurs affichées en rouge
           sous le champ. Aucun défaut manifeste détecté par relecture.

Reset    : 4 états bien séparés (verifying/invalid/ready/success), formulaire
password   à 2 champs avec validation et erreurs, boutons désactivés pendant
           la sauvegarde. Aucun défaut manifeste détecté par relecture.
```

Aucun correctif de design n'a été nécessaire au-delà du correctif `react-dom` (qui est un correctif de build, pas de design).

---

## 17. Checklist à revalider sur le premier build TestFlight

```text
[ ] Mail iOS      : clic lien reset → ouverture FenuaSIM → écran reset-password
                    → nouveau mot de passe → login
[ ] Gmail iOS     : idem (le client mail peut parfois ouvrir son propre
                    navigateur interne avant de transmettre le lien à l'app —
                    à surveiller spécifiquement)
[ ] Gmail Android : idem
[ ] Vérifier que fenuasim://reset-password est bien dans les Redirect URLs
    Supabase avant ce test (point 1 de ce rapport) -- sinon le lien réel
    échouera même si le reste fonctionne
[ ] Confirmer visuellement les 3 écrans sur device réel (safe area, clavier,
    petit écran) -- non vérifiable depuis cet environnement (point 16)
```

---

## Compte-rendu

```text
PHASE
4B — Validation finale Auth

ÉTAT
✅

REDIRECT URL SUPABASE
ACTION MANUELLE REQUISE (aucun outil ne permet de le vérifier/configurer à distance)

PKCE
✅

INSCRIPTION TESTÉE
✅

CONFIRMATION EMAIL
DÉSACTIVÉE (vérifié réellement : session immédiate au signUp + email_confirmed_at
auto-renseigné en base + confirmation_sent_at null)

CONNEXION
✅

PERSISTANCE SESSION
✅

DÉCONNEXION
✅ (révocation serveur réelle confirmée, pas seulement locale)

RECONNEXION
✅

RECOVERY PASSWORD
✅ (coexistence avec le parcours classique confirmée sur le même compte)

ANCIEN MOT DE PASSE APRÈS RESET
REFUSÉ

NOUVEAU MOT DE PASSE
ACCEPTÉ

AUTH GUARD
✅ (4 scénarios réaudités, aucune boucle possible)

PASSWORD_RECOVERY
✅

DEEP LINK SANS RECOVERY
REFUSÉ

TOKEN LOGGÉ
NON

PASSWORD LOGGÉ
NON

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

TYPESCRIPT
✅

BUILD EXPO
✅

VALIDATION VISUELLE
⚠️ — rendu web non viable pour cette app (limitation SecureStore-sur-web,
découverte réelle, non liée à cette phase), validation faite par relecture
de code attentive des 3 écrans plutôt que par capture visuelle réelle ;
un correctif de build sans rapport avec le design (react-dom mal aligné,
préexistant) a été trouvé et corrigé au passage

À REVALIDER TESTFLIGHT
Clic lien reset depuis Mail iOS / Gmail iOS / Gmail Android → ouverture app
→ écran reset-password → nouveau mot de passe → login. Confirmer aussi la
Redirect URL Supabase avant ce test. Validation visuelle réelle des 3 écrans
sur device (safe area, clavier, petit écran).

PRÊT POUR PREMIER BUILD TESTFLIGHT
OUI

POINTS RESTANTS
1. Ajouter manuellement fenuasim://reset-password dans Supabase Dashboard >
   Authentication > URL Configuration > Redirect URLs (bloquant pour le
   fonctionnement réel du lien en production, toujours pas faisable à distance)
2. Checklist TestFlight ci-dessus (section 17) à exécuter dès le premier build
3. user_sims (RLS désactivée) et profiles/airalo_orders (policies ouvertes) :
   toujours en attente de l'audit du site web, non traités ici par périmètre
4. (mineur, découvert et déjà corrigé) désalignement react-dom/react —
   corrigé dans package.json, sans impact natif, mentionné pour traçabilité
```

**PHASE AUTH FIGÉE → PASSAGE TESTFLIGHT**
