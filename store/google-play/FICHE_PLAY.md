# Fiche Google Play — FenuaSIM

_Préparé le 2026-09-06. Tout ce qui suit est à recopier tel quel dans la Play Console.
Les réponses « Sécurité des données » et « Classification du contenu » sont déduites du
code réel de l'application, pas d'hypothèses — les sources sont citées à chaque fois._

---

## 1. Identité (Play Console → Fiche Store principale)

| Champ | Valeur | Limite |
|---|---|---|
| Nom de l'application | `FenuaSIM` | 30 car. — utilisé : 8 |
| Package | `com.fenuasim.app` | — |
| Catégorie | **Voyages et infos locales** (Travel & Local) | — |
| Catégorie secondaire éventuelle | Outils | — |
| Langue par défaut | Français (France) | — |
| Type | Application, gratuite | — |
| Site web | `https://www.fenuasim.com` | — |
| E-mail de support | `contact@fenuasim.com` | — |
| Politique de confidentialité | `https://www.fenuasim.com/confidentialite` | vérifiée en ligne le 2026-09-06 |

---

## 2. Description courte (80 caractères max)

```
Votre eSIM pour voyager connecté. Achat, installation et recharge en direct.
```

_76 caractères._

**Variante plus courte si vous préférez :**

```
Achetez, installez et rechargez votre eSIM de voyage en quelques minutes.
```

_73 caractères._

---

## 3. Description complète (4000 caractères max)

_Longueur du texte ci-dessous : 2 295 caractères._

```
FenuaSIM, votre eSIM pour voyager connecté.

Fini les frais d'itinérance et la recherche d'une boutique à l'arrivée. Avec FenuaSIM,
vous achetez votre forfait data avant de partir et vous êtes connecté dès l'atterrissage,
sans changer la carte SIM de votre téléphone.

CE QUE VOUS POUVEZ FAIRE

• Trouver votre forfait — Parcourez les destinations et comparez les forfaits data
  disponibles, avec le prix affiché dans votre devise.

• Acheter en quelques minutes — Paiement sécurisé par carte bancaire via Stripe. Votre
  eSIM est créée automatiquement après le paiement.

• Installer votre eSIM — L'application vous guide pas à pas selon votre téléphone :
  installation directe sur iPhone, ou saisie de l'adresse SM-DP+ et du code d'activation
  sur Android, avec un bouton de copie pour chaque information. Votre QR code reste
  disponible à tout moment, et vous le recevez aussi par e-mail.

• Retrouver toutes vos eSIM — « Mes eSIM » regroupe vos forfaits, leur destination et
  leur statut. Vous pouvez rouvrir les informations d'installation quand vous voulez.

• Suivre votre consommation — Consultez les données restantes et le temps de validité
  de chaque eSIM, directement dans l'application.

• Recharger sans racheter — Quand votre forfait s'épuise, rechargez la même eSIM en
  quelques instants, sans réinstaller quoi que ce soit.

• Organiser vos voyages à plusieurs — Attribuez une eSIM à un voyageur et à un appareil
  pour savoir qui utilise quoi, pratique en famille ou en groupe.

• Être aidé rapidement — Une assistance dans l'application, une foire aux questions, et
  un contact direct par WhatsApp ou par e-mail.

COMPATIBILITÉ — À LIRE AVANT L'ACHAT

Une eSIM nécessite un téléphone compatible eSIM et déverrouillé, c'est-à-dire non bloqué
par un opérateur. La plupart des téléphones récents le sont, mais pas tous. En cas de
doute, vérifiez auprès de votre opérateur ou contactez-nous avant d'acheter : nous
répondons vite et nous préférons vous le dire avant.

POURQUOI FENUASIM

FenuaSIM est un service français, pensé depuis la Polynésie pour les voyageurs. Les prix
sont affichés clairement, sans abonnement et sans engagement : vous payez le forfait que
vous choisissez, une fois.

BESOIN D'AIDE ?

E-mail : contact@fenuasim.com
Site : https://www.fenuasim.com
```

**Paragraphe optionnel — à ajouter UNIQUEMENT si l'onglet Assurance reste dans la version
publiée** (voir §8, décision en attente) :

```
• Assurer votre voyage — Souscrivez une assurance voyage AVA (frais médicaux, annulation,
  bagages) depuis l'application. Offre réservée aux résidents de Polynésie française.
```

---

## 4. Sécurité des données (Data safety)

Déduit du code réel. Aucun SDK d'analyse, de publicité ou de rapport de plantage n'est
présent dans `package.json` — vérifié.

### Questions transverses

| Question | Réponse | Justification |
|---|---|---|
| Vos données sont-elles chiffrées en transit ? | **Oui** | 100 % des appels en `https://`, zéro URL `http://` dans le code ; le manifeste Android n'autorise pas le trafic en clair |
| Les utilisateurs peuvent-ils demander la suppression de leurs données ? | **Oui** | Suppression de compte directement dans l'app (`app/account/delete.tsx` → Edge Function `delete-account`) |
| Collectez-vous des données ? | **Oui** | voir tableau ci-dessous |
| Partagez-vous des données avec des tiers ? | **Oui** | Stripe (paiement), Airalo (fourniture de l'eSIM), Brevo (e-mail de confirmation) |

### Données COLLECTÉES

Pour chacune : **collectée**, **liée à l'utilisateur**, **non utilisée pour le suivi
publicitaire**, et **obligatoire** sauf mention contraire.

| Catégorie Google | Donnée | Finalité | Source dans le code |
|---|---|---|---|
| Informations personnelles → Adresse e-mail | E-mail du compte | Gestion du compte, envoi du QR code | Auth Supabase, table `profiles` |
| Informations personnelles → Nom | Nom et prénom | Fonctionnalité de l'app | Inscription + fiches voyageurs (`travelers`) |
| Informations financières → Historique des achats | Forfait acheté, montant, statut | Fonctionnalité, gestion des commandes | `esim_purchase_orders`, `esim_topup_orders`, `orders` |
| ID de l'appareil ou autres ID | ICCID de l'eSIM ; nom, marque et modèle d'appareil **saisis à la main par l'utilisateur** | Fonctionnalité (identifier quelle eSIM sur quel appareil) | `airalo_orders.sim_iccid`, table `devices` |

> ⚠️ Précision importante à ne pas oublier dans le formulaire : **aucun identifiant
> publicitaire ni identifiant matériel n'est lu automatiquement.** Les informations
> d'appareil sont tapées par l'utilisateur lui-même dans un formulaire.

### Données NON collectées — répondre « Non » à toutes

- **Informations de paiement** — le numéro de carte est saisi sur la page Stripe Checkout,
  dans le navigateur, hors de l'application. FenuaSIM ne le voit ni ne le stocke jamais.
  C'est la distinction à faire dans le formulaire : *historique d'achats* oui,
  *informations de paiement* non.
- Position géographique — aucune permission, aucun code
- Photos, vidéos, fichiers, contacts, agenda, micro, caméra — aucune permission
- Activité dans l'application / analytics — aucun SDK
- Diagnostics, plantages, performances — aucun SDK
- Messages, historique de recherche web, santé, sport

---

## 5. Classification du contenu (questionnaire IARC)

Éléments techniques établis à partir du code. **Le questionnaire doit être rempli par
vous** — ne répondez pas au hasard aux questions sensibles.

| Question type | Réponse |
|---|---|
| Violence, sang, contenu sexuel, nudité | Non |
| Langage grossier, drogues, alcool, tabac | Non |
| Jeux d'argent, loteries, jeux de hasard | Non |
| Peur, horreur | Non |
| Contenu généré par les utilisateurs, partagé publiquement | **Non** — le chat d'assistance est un échange privé entre l'utilisateur et un agent, jamais publié ni visible par d'autres utilisateurs |
| Achats numériques | **Oui** — forfaits eSIM et recharges |
| Partage de position entre utilisateurs | Non |
| Accès non filtré à Internet | **Non** — pas de navigateur intégré libre ; seuls des liens maîtrisés (site FenuaSIM, page de paiement Stripe, WhatsApp) s'ouvrent |

Classement attendu : **Tout public / 3+**, avec la mention « achats numériques ».

---

## 6. Public cible et contenu

| Champ | Réponse |
|---|---|
| Tranche d'âge cible | **18 ans et plus** |
| L'app est-elle destinée aux enfants ? | **Non** |
| Attire-t-elle involontairement les enfants ? | Non — aucun élément graphique enfantin, aucun jeu, sujet strictement utilitaire |

> Motif du 18+ : l'application permet des transactions financières par carte bancaire.
> Ne jamais déclarer FenuaSIM comme app destinée aux enfants — cela déclencherait les
> obligations « Families » (Designed for Families) sans aucun bénéfice.

---

## 7. Publicités

| Champ | Réponse |
|---|---|
| L'application contient-elle des annonces ? | **Non** |

Vérifié : aucun SDK publicitaire dans `package.json`, aucune régie, aucun code de
monétisation par la publicité.

---

## 8. Fonctionnalités financières

Déclarer : **achats numériques** (forfaits eSIM et recharges), payés par **Stripe
Checkout hébergé**, pas par Google Play Billing.

**Point de vigilance réel, à connaître avant la review :** Google peut demander pourquoi
Play Billing n'est pas utilisé. L'argument factuel est que l'eSIM est un **service de
télécommunication consommé hors de l'application** — au même titre qu'un forfait mobile
ou un titre de transport — et non un bien numérique consommé dans l'app. Les services
du monde réel sont explicitement hors périmètre de Play Billing. Répondez factuellement,
sans anticiper un refus.

---

## 9. Accès à l'application (App access)

L'application **exige un compte** : un garde d'authentification renvoie vers l'écran de
connexion tant que l'utilisateur n'est pas identifié (`app/_layout.tsx`).

Il faut donc fournir des identifiants à Google. Texte à coller dans « Accès à l'application » :

```
Toutes les fonctionnalités nécessitent un compte. Identifiants de test fournis ci-dessous.

Compte de démonstration :
  E-mail : <à créer>
  Mot de passe : <à créer>

Ce compte contient déjà une eSIM de démonstration, ce qui permet d'accéder directement à
« Mes eSIM », à l'écran d'installation (adresse SM-DP+, code d'activation, QR code) et à
l'écran de recharge, sans avoir à effectuer d'achat.

L'achat passe par une page de paiement Stripe hébergée, ouverte dans un onglet de
navigateur intégré. Il n'est pas nécessaire de finaliser un paiement pour évaluer
l'application.
```

> 🔴 **Action à faire avant de soumettre : le compte reviewer doit contenir au moins une
> eSIM.** Un compte vide affiche un accueil et un « Mes eSIM » vides — le testeur ne voit
> alors ni installation, ni consommation, ni recharge, c'est-à-dire l'essentiel de l'app.
> C'est exactement ce qui a valu le rejet Apple 2.1. Ne pas réutiliser un compte client réel.

---

## 10. Visuels

| Asset | État | Emplacement / action |
|---|---|---|
| Icône 512×512 PNG 32 bits | ✅ **prêt** | `store/google-play/store-icon-512.png` |
| Feature graphic 1024×500 | ✅ **prêt** | `store/google-play/feature-graphic-1024x500.png` |
| Captures téléphone (min. 2, idéalement 6) | ❌ **à faire** | voir ci-dessous |
| Captures tablette 7" / 10" | non requis | l'app est en portrait et non optimisée tablette |

### Captures d'écran Android à prendre

À prendre sur un **vrai téléphone Android**, depuis la build de production, en portrait.
Format accepté : PNG ou JPEG, entre 320 et 3840 px de côté, ratio entre 16:9 et 9:16.
Une capture plein écran d'un téléphone récent convient directement.

1. **Accueil** — avec au moins une eSIM active visible sur la carte
2. **Catalogue eSIM** (onglet eSIM) — la liste des destinations
3. **Détail d'un forfait** — prix et caractéristiques
4. **Mes eSIM** — la liste avec les boutons Installer / Recharger
5. **Installer mon eSIM** — l'écran Android avec l'adresse SM-DP+ et le code d'activation
6. **Recharger mon eSIM** — le choix des recharges

> ⚠️ Ne pas réutiliser les captures iOS : elles montrent la barre d'état et l'interface
> d'iPhone. Les 3 PNG présents à la racine du dépôt ne sont pas non plus utilisables —
> ce sont des captures de la Play Console elle-même, pas de l'application.

---

## 11. Décision en attente

**L'onglet « Assurance » est présent dans la navigation de l'application.** Le parcours
est fonctionnel (assurance voyage AVA, réservée aux résidents de Polynésie française).

Deux options, à trancher avant de soumettre :

- **Le garder** → ajouter le paragraphe optionnel du §3, et vérifier que la restriction
  géographique est claire pour un testeur Google qui n'est pas en Polynésie (sinon il
  verra une fonctionnalité qui refuse de s'exécuter, ce qui se lit comme un bug).
- **Le masquer pour la V1** → l'onglet disparaît, la description reste telle quelle.
  Demande une modification de code et une nouvelle build.

---

## 12. Rappel de parcours de publication

Ne **pas** publier directement en production.

1. Play Console → **Test** → **Test interne** → créer une version
2. Déposer le `.aab` (versionCode 5, à télécharger depuis EAS)
3. Compléter « Contenu de l'application » (les §4 à §9 de ce document)
4. Compléter la fiche Store (les §1 à §3 et §10)
5. Ajouter les testeurs internes, installer, vérifier sur un vrai appareil
6. Seulement ensuite : promotion en test fermé, puis en production

> Si le compte développeur est un **compte personnel créé après novembre 2023**, Google
> impose un test fermé de **12 testeurs pendant 14 jours consécutifs** avant toute mise
> en production. Ce point n'est pas vérifiable depuis le dépôt — à confirmer dans la
> Play Console.
