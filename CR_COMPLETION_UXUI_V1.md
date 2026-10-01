# Compte-rendu — Phase UX Completion V1

_Rédigé le 2026-08-28. Application mobile uniquement (`fenuasim-app`). Aucune modification backend/paiement/webhook/RLS._

## Méthode

Audit complet de tous les écrans réels de l'app (navigation, home, explore, fiche destination, checkout, payment success/cancel, topup, assign, mes eSIM, compte, voyageurs, appareils, support, FAQ, auth). Les données régionales ajoutées à l'accueil ont été vérifiées par **requête SQL réelle contre Supabase production** (`airalo_packages`, projet `hptbhujyrhjsquckzckc`), jamais inventées. `npx tsc --noEmit` et `npx expo-doctor` exécutés après chaque étape.

Constat de départ : une passe UX précédente (2026-08-23, `CR_PASSE_UXUI_V1.md`) avait déjà mis l'app dans un état solide (liste forfaits, tri, filtres, français, écran Compte restructuré). Cette phase est donc une **complétion**, pas une refonte : l'essentiel du travail a consisté à auditer, retirer ce qui contredisait le nouveau périmètre V1 (assurance hors-scope) et combler des trous ciblés (bouton mort, donnée technique mal placée, absence de forfaits régionaux).

---

## Points corrigés

### 1. Assurance — sortie effective du parcours V1
Le brief V1 exclut explicitement l'assurance (souscription, tarification, "Mes assurances" comme feature active) mais l'app l'exposait encore à trois endroits :
- **Accueil** : tuile "Assurance voyage" dans les actions rapides → **retirée**.
- **Écran de connexion** : sous-titre "Votre eSIM **et assurance voyage**" → remplacé par "Votre eSIM pour voyager connecté" (aligné sur le positionnement voyage/connexion demandé).
- **Écran Compte** : la carte "Mes assurances" et son état vide "Aucune assurance… En savoir plus →" poussaient tout utilisateur, même sans historique, vers l'écran "Bientôt disponible". La section **n'apparaît plus du tout si l'utilisateur n'a aucune assurance réelle** ; si des enregistrements réels existent déjà (achat passé), ils restent visibles (aucune donnée ni aucun accès à un contrat existant n'est supprimé — retirer l'accès à un document déjà payé aurait été une régression, pas une amélioration).
- L'écran `insurance/form.tsx` ("Bientôt disponible") est **conservé tel quel** : c'est une décision produit déjà actée (Phase 4C, 2026-08-23), honnête, sans faux CTA — conforme à la règle "pas de Bientôt disponible sauf décision déjà existante".

### 2. Écran mort et entièrement fictif supprimé
`app/esim/confirm.tsx` : aucune route de l'app ne pointait vers cet écran (recherche exhaustive confirmée) — c'était un reliquat du tout premier commit, avant le branchement Supabase. Il affichait un **forfait Japon 5 Go inventé, un code d'accès fixe `4872` et une URL `esims.cloud/fenua-sim/demo`**, plus un lien "+ Ajouter une assurance voyage". L'écran réellement utilisé après paiement est `app/esim/payment-success.tsx` (déjà branché sur les vraies données de commande). **Supprimé.**

### 3. Bouton mort corrigé
Sur l'accueil, la tuile "Support" des actions rapides n'avait **aucun `onPress`** — appui sans effet. Corrigé : navigue maintenant vers `/support`.

### 4. Donnée technique déplacée (écran Installation/Payment success)
L'ICCID complet était affiché en clair dans le bloc d'info principal de l'écran de confirmation d'achat, au même niveau que "QR code envoyé par email". Conforme à la règle "pas de donnée technique en premier niveau" : déplacé dans une section repliable "Informations techniques" (fermée par défaut).

### 5. Forfaits régionaux ajoutés à l'accueil (absent jusqu'ici)
Le brief demande une section "Forfaits régionaux" sur l'accueil ; elle n'existait nulle part (seul l'Explorer avait un filtre Régional/Monde). Ajoutée avec des **données réelles vérifiées par SQL** : Europe (16 offres, dès 337 XPF), Asie (15 offres, dès 172 XPF), Amérique du Nord (11 offres, dès 616 XPF), Océanie (10 offres, dès 505 XPF), Monde (19 offres, dès 113 XPF, slug `global`). Au passage, `lib/regionNames.ts` traduisait déjà "Discover Global"→"Monde" mais pas "Global" (le libellé réellement utilisé par les offres actives) : la traduction manquante a été ajoutée pour ne plus jamais afficher le mot anglais "Global" à un utilisateur FR.

---

## Points audités et volontairement non touchés

- **Home / Explore / Fiche destination / Checkout / Topup / Assign / Support / Voyageurs / Appareils / Auth** : déjà conformes (états loading/vide/erreur présents, CTA unique par écran, safe area respectée, aucun CTA fixe ne recouvre du contenu, français correct, aucune donnée inventée). Aucune réécriture de composants pour produire du nouveau code.
- **`payment-success.tsx` / `payment-cancel.tsx` / `topup-success.tsx` / `topup-cancel.tsx`** (racine) : ce sont des cibles de deep link Stripe réelles (re-export ou écrans dédiés), pas des doublons — laissés intacts.
- **`insurances` RLS gap** (mentionné en Phase 4C) : hors périmètre, non retouché, déjà signalé précédemment.

---

## Compte-rendu

```text
PHASE
UX COMPLETION V1

REPO
fenuasim-app

HEAD INITIAL
91c00c5

HEAD FINAL
(non commité — modifications en attente de votre validation, comme convenu)

================================
AUDIT
================================

ÉCRANS AUDITÉS
Accueil, Explorer, Fiche destination, Paiement, Payment success/cancel (racine + esim),
Topup, Topup success/cancel, Assign eSIM, Confirm (mort), Compte, Voyageurs, Appareils,
Support, FAQ, Assurance (form/confirm), Login, Register, Forgot/Reset password,
Suppression compte, Layout racine/splash, Tab bar

ÉCRANS CONSERVÉS SANS MODIFICATION
Explorer, Fiche destination, Paiement, Topup, Topup success/cancel, Assign eSIM,
Voyageurs, Appareils, Support, FAQ, Register, Forgot/Reset password, Suppression compte,
Layout racine/splash, insurance/form (déjà honnête, décision déjà actée)

ÉCRANS AMÉLIORÉS
Accueil (tuile assurance retirée, bouton Support corrigé, forfaits régionaux ajoutés),
Login (sous-titre assurance retiré), Compte (section assurance conditionnelle),
Payment success (ICCID déplacé en info technique repliable)

ÉCRANS AJOUTÉS
Aucun nouvel écran (section "Forfaits régionaux" = ajout dans l'écran Accueil existant)

ÉCRANS SUPPRIMÉS
esim/confirm.tsx (mort, inaccessible, entièrement fictif)

================================
HOME
================================

RECHERCHE DESTINATION
✅ (déjà présent : CTA "Trouver une eSIM" visible sans scroll)

ESIM ACTIVE MISE EN AVANT
✅ (déjà présent : section "Mes eSIM" avec conso, statut, recharge, installation)

DESTINATIONS POPULAIRES
✅ (déjà présent)

RÉGIONS
✅ (ajouté cette phase, données réelles vérifiées SQL : Europe/Asie/Amérique du Nord/Océanie/Monde)

================================
ACHAT
================================

PARCOURS CLAIR
✅ (Où → Quel forfait → Combien → Paiement, déjà en place)

HIÉRARCHIE FORFAITS
✅ (liste verticale triée, filtres si >8 offres, déjà en place)

CTA
✅ (un CTA principal par écran, bouton Support de l'accueil corrigé cette phase)

FAUX PRIX
0

================================
MES ESIM
================================

CARTE ESIM
✅

CONSOMMATION
✅ (jauge + états "pas encore disponible" si donnée non fiable)

INSTALLATION
✅ (ICCID déplacé en section technique repliable cette phase)

RECHARGE
✅ (catalogue réel, non rechargeable géré proprement, statuts serveur réels)

================================
UX
================================

LOADING STATES
✅

EMPTY STATES
✅ (assurance : état vide retiré volontairement pour ne plus promouvoir une feature hors V1)

ERROR STATES
✅

OFFLINE
⚠️ pas de détection réseau dédiée (hors scope de cette passe, aucune régression introduite)

SUPPORT
✅ (bouton mort de l'accueil corrigé cette phase)

PETITS ÉCRANS
✅ (non re-testé visuellement cet environnement, aucun changement de layout structurel)

SAFE AREA
✅ (inchangé, déjà conforme)

================================
DESIGN
================================

CHARTE FENUASIM CONSERVÉE
OUI

COPIE NOMAD
NON

DESIGN SYSTEM RÉUTILISÉ
OUI (mêmes cartes/CTA/couleurs que le reste de l'app, aucun nouveau composant générique)

NOUVELLE DÉPENDANCE UI
NON

================================
V1
================================

ACHAT ESIM
✅

MES ESIM
✅

INSTALLATION
✅

CONSOMMATION
✅

RECHARGE
✅

COMPTE
✅

SUPPORT
✅

ASSURANCE
HORS V1 — retirée de l'accueil, du login, et de l'état vide du compte ; écran "Bientôt disponible" conservé (décision déjà actée) ; historique réel non supprimé pour les utilisateurs concernés

================================
QUALITÉ
================================

TYPECHECK
✅ 0 erreur (`npx tsc --noEmit`)

EXPO DOCTOR
18/18 (aucune régression)

RÉGRESSION FONCTIONNELLE
NON — aucune table Supabase, Edge Function, RLS, webhook ni tunnel de paiement modifié ;
aucun vrai paiement/commande/recharge déclenché durant cette passe

================================
CONCLUSION
================================

APP V1 COHÉRENTE
OUI

P0 RESTANTS
Aucun identifié

P1 RESTANTS
Validation visuelle réelle sur appareil (Expo Go/TestFlight) — non réalisable dans cet
environnement, aucun simulateur/navigateur pilotable disponible ici

P2 REPORTÉS
- Détection offline dédiée (message générique "vérifiez votre connexion")
- Regroupement des réseaux partenaires par pays (déjà documenté comme non fiable en base,
  inchangé depuis la passe précédente)

PRÊT POUR 5.2 / BUILD
OUI (sous réserve de la validation visuelle réelle ci-dessus)
```
