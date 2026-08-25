# Compte-rendu — Type de forfait, navigation centrale, anciens labels

_Rédigé le 2026-08-23. Application mobile uniquement._

## Méthode

Tout a été vérifié par **exécution réelle** contre les données de production (requêtes identiques à l'app) : les combinaisons `includes_voice`/`includes_sms` réelles, le fait que 100% des "doublons apparents" s'expliquent par le type, et la détection de labels techniques (14 cas testés). Le rendu visuel n'a pas pu être capturé (pas de navigateur/simulateur pilotable) — le tunnel Expo Go reste actif pour la validation avec vous.

---

## 1. Navigation centrale

`app/(tabs)/_layout.tsx` : le libellé `tabBarLabel` (précédemment forcé à `null`) est restauré à `"Explorer"`, exactement comme pour `Accueil` et `Compte`. La pastille garde son icône de recherche + texte `"eSIM"`, son dégradé et son action inchangés. La barre basse se lit désormais littéralement `Accueil / Explorer / Compte`.

## 2-4. Type de forfait — colonnes réellement utilisées

Inspection avant toute modification : `airalo_packages.includes_voice` et `includes_sms` (booléens). **Aucune autre colonne** ne porte cette information, aucune colonne inventée.

**Combinaisons réelles observées** (requête sur tout le catalogue actif) :

| includes_voice | includes_sms | Nombre d'offres |
|---|---|---|
| false | false | 1 953 |
| true | true | 47 |

**Seules 2 combinaisons existent réellement** — pas de "Internet + appels seuls" ni "Internet + SMS seuls" dans les données actuelles. La logique implémentée reste néanmoins générique (gère les 4 cas) pour ne pas casser si Airalo introduit une nouvelle combinaison plus tard.

Libellés retenus (français, sans jargon) :
- `false/false` → **Internet uniquement**
- `true/true` → **Internet + appels + SMS**
- (prévu si un jour observé : Internet + appels / Internet + SMS)

## 13-14. Vérification des doublons apparents — cause identifiée avec certitude

Analyse réelle sur `discover-global` (le vrai slug "Monde" — pas "monde", correction par rapport au rapport précédent), `united-states`, `europe`, `france` :

| Destination | Offres | Types distincts | Doublons apparents (même data+durée) | Cause |
|---|---|---|---|---|
| discover-global (Monde) | 19 | 2 | 6, **tous** expliqués | `includes_voice`/`includes_sms` — aucune autre cause trouvée |
| united-states | 27 | 2 | 5, **tous** expliqués | idem |
| europe | 16 | 1 | 0 | — |
| france | 6 | 1 | 0 | — |

**Aucun doublon inexpliqué trouvé.** Chaque paire "même data/même durée, prix différent" sur Monde et USA correspond exactement à une paire (Internet uniquement / Internet + appels + SMS), rien d'autre (pas de différence réseau, zone ou recharge identifiée après vérification systématique).

## 5-6. Rendu de la liste

`app/esim/[country].tsx` : chaque ligne de forfait affiche désormais 2 lignes — la ligne principale (radio + data + durée + prix) inchangée, puis une ligne badge : icône + `"Internet uniquement"` ou `"Internet + appels + SMS"`, complétée par la légende rassurante `"WhatsApp, Messenger, Maps…"` uniquement pour les offres Internet seul (jamais pour les offres avec appels/SMS classiques, pas de mention "illimité" ou "inclus" ambiguë).

## 7. Filtre par type

Ajouté, **local** (`useMemo`, aucune requête Supabase), combinable avec les filtres data/durée existants. **N'apparaît que si la destination propose réellement plus d'un type** — vérifié : caché sur France et Europe (1 seul type réel chacune), affiché sur Monde et USA (2 types réels).

## 8. "Data" → "Internet"

Renommé dans le bloc détail (`app/esim/[country].tsx`). Le "Go" continue de porter l'information de quantité, comme demandé.

## 9-11. Résumé permanent du forfait sélectionné

Ajouté dans la barre CTA fixe (donc déjà toujours visible, aucun `position: absolute` ajouté) : `"Votre choix"` + `"{data} • {durée} · {type}"`, sans redondance de prix (le prix reste uniquement dans le bouton `Acheter · {prix} XPF`, comme demandé section 10). Se met à jour immédiatement au changement de sélection (`sel` recalculé au rendu, aucun état supplémentaire, aucune requête).

## 12. Détail du forfait sélectionné

Ligne `Type` ajoutée (icône + libellé). `Appels`/`SMS` **toujours affichés désormais** (pas seulement pour les forfaits locaux comme dans la version précédente — car le type rend maintenant l'information pertinente pour toutes les destinations) et libellés `"Appels classiques"`/`"SMS classiques"` uniquement quand le forfait est Internet uniquement, avec une ligne `Applications` expliquant que WhatsApp/Messenger/réseaux sociaux fonctionnent via l'enveloppe Internet — jamais présentés comme "inclus" ou illimités.

---

## 15-18. Anciens labels techniques

### Cause du bug identifiée

`app_esim_assignments.label` a été enregistré **avant** la correction du fallback (tâche précédente) pour certaines eSIM déjà attribuées — le label stocké est littéralement `"elan-7days-1gb • Joeffray"`. Conformément à la consigne, **aucune donnée historique n'a été modifiée** : correction au rendu uniquement.

### Détection implémentée (`hooks/usePackageInfo.ts::looksLikeTechnicalSlug`)

Un label est considéré technique si :
1. il correspond exactement (ou en préfixe avant `" • "`) au `package_id` de la commande, **ou**
2. son premier segment (avant `" • "`) contient un tiret **ET** un marqueur technique explicite (`\d+days`, `\d+gb`, `\d+mb`, `unlimited`).

**Testé réellement sur 14 cas** :

| Cas | Attendu | Obtenu |
|---|---|---|
| `elan-7days-1gb`, `elan-7days-1gb • Joeffray`, `yes-go-30days-5gb`, `americanmex-in-30days-10gb`, `discover+-365days-20gb`, `change-in-3days-unlimited` | technique | ✅ 6/6 détectés |
| `France • Thomas`, `USA • Christelle`, `Téléphone pro USA`, `Nouvelle-Zélande • Thomas`, `iPhone de Joeffray`, `Vacances Japon 2026`, `Mon eSIM pro`, `Forfait voyage` | à préserver | ✅ 8/8 préservés (aucun faux positif, y compris pour un nom de destination réel contenant un tiret) |

### Nouvelle priorité d'affichage (`app/(tabs)/index.tsx`)

```text
SI label personnalisé existe ET n'est pas technique -> label
SINON, SI voyageur attribué -> "{destination résolue} • {voyageur}"
SINON -> "{destination résolue}"
```

`elan-7days-1gb • Joeffray` devient donc **`France • Joeffray`**, avec `1 Go • 7 jours` toujours affiché en sous-titre (déjà en place). Un vrai label comme `"Téléphone pro USA"` reste strictement inchangé.

---

## Vérifications techniques

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx expo export --platform web` | ✅ succès |
| Paramètres envoyés à `esim/payment.tsx` (`packageId`, `packageName`, `price`, `days`, `data`, `country`) | ✅ Vérifié inchangés ligne à ligne — seule la présentation change |

---

## Compte-rendu

```text
NAVIGATION CENTRALE
Corrigee : libelle "Explorer" restaure sous la pastille, coherent avec Accueil/Compte

LIBELLÉ CENTRAL
"Explorer" (sous l'icone), pastille "eSIM" conservee au-dessus, gradient/action inchanges

TYPES DE FORFAITS DÉTECTÉS
2 reels : Internet uniquement (1953 offres), Internet + appels + SMS (47 offres)

COLONNES AIRALO_PACKAGES UTILISÉES
includes_voice, includes_sms (aucune colonne inventee)

INTERNET UNIQUEMENT
✅ (badge + reassurance WhatsApp/Messenger/Maps, teste sur Monde/USA reels)

INTERNET + APPELS/SMS
✅ (badge distinct, teste sur Monde/USA reels)

AUTRES TYPES DÉTECTÉS
Aucun dans les donnees actuelles (logique geree si un jour introduits)

FILTRE TYPE
Local (useMemo), combinable avec data/duree, cache si un seul type reel (verifie sur France/Europe)

MONDE TESTÉ
✅ (slug reel "discover-global", 19 offres, 2 types, 6/6 doublons expliques)

USA TESTÉ
✅ (27 offres, 2 types, 5/5 doublons expliques)

EUROPE TESTÉE
✅ (16 offres, 1 seul type reel, filtre correctement masque)

FRANCE TESTÉE
✅ (6 offres, 1 seul type reel, interface simple preservee)

OFFRES MÊME DATA/DURÉE EXPLIQUÉES
✅ (0 cas inexplique trouve sur les 4 destinations testees)

RÉSUMÉ FORFAIT SÉLECTIONNÉ
Ajoute dans la barre CTA fixe (toujours visible), mise a jour instantanee, pas de prix duplique

CTA
Inchange dans son fonctionnement, params paiement verifies identiques

ANCIENS LABELS TECHNIQUES
Detection implementee et testee (6/6 cas techniques, 8/8 labels valides preserves)

SLUG elan-7days-1gb • Joeffray
RÉSULTAT : devient "France • Joeffray" (donnee historique non modifiee, correction au rendu uniquement)

VRAIS LABELS PERSONNALISÉS CONSERVÉS
✅ (8/8 testes, y compris destination avec tiret "Nouvelle-Zelande")

NOUVELLES REQUÊTES SUPABASE
0 (type/filtre/detection label = logique locale pure, aucune requete ajoutee)

AIRALO_ORDERS MODIFIÉ
NON

AIRALO_PACKAGES MODIFIÉ
NON

APP_ESIM_ASSIGNMENTS MODIFIÉ
NON (aucune donnee historique touchee, correction au rendu uniquement, comme demande)

TABLES SUPABASE MODIFIÉES
NON

SITE WEB MODIFIÉ
NON

TUNNEL DE PAIEMENT MODIFIÉ
NON (params verifies identiques)

TYPESCRIPT
✅

BUILD EXPO
✅

TEST VISUEL RÉEL
⏳ en attente (tunnel Expo Go toujours actif, reload recommande)

POINTS RESTANTS
1. Validation visuelle reelle sur iPhone (navigation centrale, badges, resume sticky, detail)
2. Le rapport precedent mentionnait un test "Monde" incertain (slug non trouve tel quel) :
   resolu ici, le vrai slug est "discover-global"
```
