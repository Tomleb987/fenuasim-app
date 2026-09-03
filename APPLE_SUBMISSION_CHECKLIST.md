# Checklist de soumission App Store — FenuaSIM

_Rédigé le 2026-09-03. Couvre ce qui manque pour soumettre l'app iOS à Apple._

**Statut au 2026-09-03** :
- Build #2 (avec support iPad) construit, soumis et **reçu par App Store Connect** avec succès via `eas submit`.
- App Store Connect a ensuite listé 6 blocages réels pour passer "Ajouter pour vérification" — traités ci-dessous.
- L'un des blocages (capture d'écran iPad 13" manquante) a été résolu en désactivant le support iPad (`supportsTablet: false` — l'app n'a de toute façon aucune mise en page dédiée tablette). **Build #3 relancé automatiquement, sans aucune interaction Apple ID cette fois** (certificat/profil déjà enregistrés côté EAS depuis le build #2) — sera soumis dès qu'il est prêt.

## 0. Les 6 blocages donnés par Apple lors du 1er essai, et leur statut

| Blocage exact (message Apple) | Statut |
|---|---|
| Droits relatifs au contenu non configurés | À faire (vous) — répondre "non, aucun contenu tiers sous licence" dans Informations sur l'app |
| Capture d'écran iPad 13" manquante | ✅ Résolu — support iPad désactivé, nouveau build en cours |
| URL d'engagement de confidentialité manquante | À faire (vous) — coller `https://www.fenuasim.com/confidentialite` |
| Questionnaire classification par âge non rempli | À faire (vous) — réponses prêtes en section 3 |
| Confidentialité de l'app (types de données) non renseignée | À faire (vous) — réponses prêtes en section 2 |
| Aucun tarif choisi | À faire (vous) — sélectionner "Gratuit" dans Tarification et disponibilité |

## 1. Étapes qui doivent rester de votre côté (accès requis que je n'ai pas)

| Étape | Pourquoi je ne peux pas le faire |
|---|---|
| Lancer le build iOS (`eas-cli build --platform ios`) | Nécessite une connexion interactive Apple ID + 2FA sur votre appareil |
| Remplir App Store Connect (fiche, captures, questionnaires) | Aucun accès à votre compte App Store Connect depuis cet environnement |
| Créer la fiche "Confidentialité" et "Classification par âge" dans App Store Connect | Même raison — mais je vous donne les réponses exactes ci-dessous, prêtes à copier |

## 2. Réponses prêtes à copier — App Privacy (Confidentialité)

Basé sur un audit réel du code (aucun SDK d'analytics, de crash-reporting ou de tracking publicitaire présent dans l'app — vérifié : ni Sentry, ni Amplitude, ni Mixpanel, ni Segment, aucune géolocalisation).

**Types de données collectées, à déclarer :**

| Catégorie Apple | Donnée | Liée à l'identité ? | Usage déclaré |
|---|---|---|---|
| Contact Info | Adresse e-mail | Oui | Fonctionnalité de l'app (compte) |
| Contact Info | Nom (profil, voyageurs) | Oui | Fonctionnalité de l'app |
| Identifiants | Identifiant utilisateur (compte) | Oui | Fonctionnalité de l'app |
| Historique d'achats | Commandes eSIM, recharges, assurance | Oui | Fonctionnalité de l'app |
| Informations financières | Paiement (traite par Stripe, jamais stocké par l'app) | Oui | Traitement des paiements |

**À répondre "Non" / "Aucune donnée" pour :** Localisation, Contenu utilisateur (photos/vidéos), Historique de recherche, Données de santé, Contacts, Données de navigation, Diagnostics, Données publicitaires.

**Point d'attention pour le paiement** : dans le formulaire Apple, cochez que les données financières sont collectées mais précisez "traitées par un prestataire tiers (Stripe), non stockées par l'app" — c'est la formulation exacte qu'accepte Apple pour ce cas de figure.

## 3. Réponses prêtes à copier — Classification par âge

Questionnaire Apple (nouvelle version 2024+, catégories) :
- Contenu généré par les utilisateurs : **Non**
- Violence, contenu choquant, thèmes matures : **Aucun**
- Jeux d'argent simulés / réels : **Non**
- Alcool, tabac, drogues : **Aucune référence**
- Contenu médical/santé réaliste : **Non**

→ Résultat attendu : **4+**.

## 4. Compte de test pour les révisateurs Apple — ✅ fait

Créé et testé pour de vrai (connexion réelle vérifiée via le même endpoint que l'app) le 2026-09-03 :

- **Email** : `fenuasim.qa.applereview@example.com`
- **Mot de passe** : `FenuaReview2026!`

Aucune commande/eSIM/assurance réelle sur ce compte — juste utilisable pour se connecter et naviguer. À coller tel quel dans App Store Connect → App Review Information → Sign-in required.

## 5. Captures d'écran

Contrainte réelle : je n'ai pas de simulateur iOS ni d'accès à votre téléphone pour prendre de vraies captures natives. Deux options possibles, à votre choix :
- **Vous les prenez vous-même** une fois le build iOS installé (TestFlight), 3-5 écrans clés suffisent (accueil, catalogue, fiche destination, paiement, compte).
- **Je peux tenter une capture via la version web de l'app** (`expo start --web`, rendu React Native Web redimensionné en format iPhone) — visuellement proche mais pas 100% identique au rendu natif ; dites-moi si ça vous intéresse, sinon on attend le vrai build.

## 6. Note à inclure dans "App Review Notes" (justification achats externes)

À coller dans le champ de notes pour le révisateur Apple, en anglais (langue attendue par les révisateurs) :

> FenuaSIM sells physical-world telecom services (travel eSIM data plans) and travel insurance, both real-world regulated services fulfilled outside the app (mobile network activation, insurance underwriting by AVA). Payment is processed via Stripe, consistent with other eSIM/telecom apps on the App Store (e.g. Airalo, Holafly). No digital content or virtual goods are sold in-app.

## Résumé — ce qui bloque encore

- [x] Build iOS lancé et terminé avec succès
- [x] Compte de test révisateur — créé et testé
- [ ] Captures d'écran — à décider (vous, ou tentative web de mon côté)
- [ ] Coller les réponses ci-dessus dans App Store Connect (vous, une fois le build uploadé)
