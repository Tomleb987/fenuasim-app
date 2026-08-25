# PHASE 2 — Support FenuaSIM V1

_Rédigé le 2026-08-23. Application mobile uniquement._

## Objectif

Brancher un véritable espace Aide & Support (WhatsApp, e-mail, aide contextuelle par eSIM, FAQ), jusqu'ici un bouton "Support" non fonctionnel.

## Numéro WhatsApp

**Confirmé par vous** : `+33 7 49 78 21 01` (jamais inventé, demandé avant implémentation). Stocké dans `constants/support.ts`, seul endroit de l'app où ce numéro est défini.

## E-mail de support

**Confirmé et validé par vous** : `contact@fenuasim.com`, adresse officielle de support FenuaSIM. Centralisée dans `constants/support.ts`, jamais dupliquée ailleurs (vérifié : aucune autre occurrence de cette adresse dans le code).

## Écrans créés

| Fichier | Rôle |
|---|---|
| `constants/support.ts` | Numéro WhatsApp, e-mail, générateurs d'URL/message (aucune donnée sensible dans les messages) |
| `app/support/index.tsx` | Écran principal Aide & Support |
| `app/support/faq.tsx` | FAQ locale (9 questions) |

## Écran principal

Boutons WhatsApp / E-mail / FAQ, plus une section "Problème avec une eSIM" qui liste les eSIM du compte (résolues avec la même logique fiable que l'accueil — jamais de slug technique) : taper sur une eSIM ouvre WhatsApp avec un message pré-rempli spécifique à cette eSIM.

Accessible depuis :
- `Compte` → section Aide → `Support` (désormais branché, ne faisait rien auparavant)
- Chaque **carte eSIM de l'accueil** → nouveau lien `Besoin d'aide ?` en bas de carte, qui ouvre directement l'écran Support **contextualisé** sur cette eSIM précise (label + ICCID transmis en paramètre de navigation interne, jamais envoyés tels quels à WhatsApp/e-mail)

## Message WhatsApp pré-rempli — exemple réel généré et vérifié

```text
Bonjour FenuaSIM,

J'ai besoin d'aide avec mon eSIM France • Joeffray.

Référence : eSIM se terminant par 4587.
```

## Sécurité — vérifiée

- **Jamais l'ICCID complet** dans un message WhatsApp ou un sujet d'e-mail — uniquement `.slice(-4)`, à chaque appel de `buildEsimWhatsappMessage`/`buildEsimMailSubject`.
- Aucun identifiant interne, token ou donnée technique transmis.
- L'ICCID complet ne transite que dans les **paramètres de navigation internes** à l'app (`router.push` entre deux écrans de l'app elle-même), jamais dans une URL externe (`wa.me`/`mailto:`).

## FAQ — contenu et sources

**Aucune réponse inventée.** Les réponses techniques réutilisent des éléments déjà réels et vérifiés dans le projet plutôt que des affirmations nouvelles :
- Le script de diagnostic "eSIM ne se connecte pas" reprend **mot pour mot** la procédure déjà utilisée par l'agent IA de support FenuaSIM existant (`ai-chat` Edge Function, section DIAGNOSTIC TECHNIQUE de son system prompt — trouvée pendant l'audit Phase 1).
- La liste de compatibilité (iPhone XS+, Android eSIM) reprend le texte déjà affiché dans l'écran destination de l'app (`app/esim/[country].tsx`).
- La question "Puis-je recharger mon eSIM ?" répond honnêtement **"pas encore"** — la recharge est planifiée en Phase 7, non développée ici. Aucune fonctionnalité inexistante n'est présentée comme disponible.
- "Internet uniquement + WhatsApp" reprend exactement l'explication déjà validée et implémentée dans l'écran destination (`INTERNET_ONLY_EXPLANATION`).

## Vérifications techniques

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx expo export --platform web` | ✅ succès |
| URLs WhatsApp/mailto générées | ✅ vérifiées (encodage correct, testé en Node) |

---

## Compte-rendu

```text
PHASE
2 — Support FenuaSIM V1

OBJECTIF
Brancher un vrai espace Aide & Support (WhatsApp, e-mail, FAQ, aide par eSIM)

ÉTAT
✅ (WhatsApp confirmé et fonctionnel ; e-mail à confirmer, voir ci-dessus)

FICHIERS MODIFIÉS
Crees : constants/support.ts, app/support/index.tsx, app/support/faq.tsx
Modifies : app/(tabs)/account.tsx (bouton Support branche), app/(tabs)/index.tsx (lien "Besoin d'aide ?" par carte eSIM)

SUPABASE MODIFIÉ
NON

TABLES MODIFIÉES
Aucune

POLICIES MODIFIÉES
Aucune

EDGE FUNCTIONS MODIFIÉES
NON

SITE WEB MODIFIÉ
NON

TUNNEL PAIEMENT MODIFIÉ
NON

TESTS RÉELLEMENT EXÉCUTÉS
Generation reelle des URLs WhatsApp/mailto verifiee (encodage, message pre-rempli) ; recherche exhaustive de coordonnees support existantes (aucune trouvee) ; verification que le contenu FAQ reprend des sources reelles du projet (ai-chat, ecran destination)

TYPESCRIPT
✅

BUILD EXPO
✅

RISQUES
- E-mail de support non confirme explicitement (hypothese : contact@fenuasim.com)
- Pas de test visuel reel effectue (pas de navigateur/simulateur pilotable) — tunnel Expo Go toujours actif pour validation avec vous

BLOQUANTS
Aucun bloquant critique. Confirmation de l'e-mail recommandee avant mise en production.

PRÊT POUR PHASE SUIVANTE
OUI
```

---

## Finalisation (2026-08-23, suite)

### A1-A2. ICCID complet retiré des routes

`app/(tabs)/index.tsx` : le lien "Besoin d'aide ?" ne transmet plus `iccid`, uniquement `{ label, last4 }` (Option 2, le libellé étant déjà résolu à cet endroit, pas besoin d'un `assignment_id` supplémentaire). `app/support/index.tsx` adapté en conséquence (`contextLast4` vient directement du paramètre `last4`, plus de `.slice(-4)` sur un ICCID reçu par la route).

**Recherche exhaustive `iccid`/`sim_iccid`** dans `app/support/`, `constants/support.ts`, tous les `router.push` vers `/support` : les seules occurrences restantes sont dans `app/support/index.tsx`, pour la liste "Problème avec une eSIM" — `e.sim_iccid` y est lu directement depuis Supabase (propre compte de l'utilisateur, jamais via une route) et n'est **jamais** utilisé autrement que via `.slice(-4)` avant d'être inséré dans un message. **Vérifié par exécution réelle** (Node) : le message WhatsApp et l'URL `mailto:` générés à partir de `{label, last4}` ne contiennent à aucun moment un ICCID complet simulé.

### A5. FAQ compatibilité — reformulée

Ancienne formulation absolue remplacée par une formulation prudente ("La plupart des iPhone XR/XS et modèles plus récents... sous réserve du modèle, de la région de commercialisation et d'éventuelles restrictions opérateur").

### A6. Vérification fonctionnelle

Comme pour toutes les phases précédentes : pas de navigateur/simulateur pilotable dans cet environnement, donc pas de clic réel possible. Vérifié à la place, par exécution réelle : génération des URLs WhatsApp/mailto (encodage correct), absence de fuite d'ICCID complet, `tsc`/`expo export` propres. Le test visuel réel reste à faire avec vous via le tunnel Expo Go.

### A7. Compte-rendu final

```text
PHASE 2 SUPPORT

ICCID COMPLET DANS ROUTES
NON (corrige - label + last4 uniquement)

IDENTIFIANT UTILISÉ À LA PLACE
label (deja resolu, jamais technique) + last4 (4 derniers caracteres)

ICCID COMPLET DANS WHATSAPP
NON

ICCID COMPLET DANS EMAIL
NON

LAST4 UNIQUEMENT
✅

EMAIL SUPPORT
contact@fenuasim.com (confirme, centralise dans constants/support.ts)

WHATSAPP SUPPORT
+33 7 49 78 21 01 (confirme, centralise dans constants/support.ts)

FAQ COMPATIBILITÉ
Reformulee prudemment, plus d'affirmation absolue

TEST SUPPORT DEPUIS COMPTE
⏳ (logique verifiee par lecture/execution de code ; test visuel reel non fait, pas d'outil disponible)

TEST SUPPORT DEPUIS ESIM
⏳ (idem — generation de message/URL verifiee reellement en Node, pas de clic reel possible)

TYPESCRIPT
✅

BUILD EXPO
✅

PHASE 2 FIGÉE
OUI
```
