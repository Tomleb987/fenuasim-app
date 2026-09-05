# Rejet Apple « Guideline 2.1 — Information Needed » — réponse prête

_Rédigé le 2026-09-04. Aucune modification de code. Toutes les affirmations ci-dessous
sont vérifiées sur le dépôt réel et sur le projet Supabase `hptbhujyrhjsquckzckc`
(requêtes SQL en direct), pas déduites._

---

## 1. Nature du rejet

Ce n'est **pas** un rejet fonctionnel : Apple n'a trouvé aucun bug, aucun crash, aucune
violation. C'est le questionnaire standard envoyé aux comptes développeurs sans historique
de review (« limited App Review history »). Le build est intact — **aucun nouveau build
n'est nécessaire**. Il faut répondre dans le Resolution Center **et** recopier la réponse
dans App Store Connect → App Review Information → Notes.

Le seul livrable réellement bloquant de votre côté est **l'enregistrement vidéo sur un
iPhone physique** (point 1 de leur liste).

---

## 2. Points de vigilance identifiés avant de répondre

| # | Constat vérifié | Risque | Action |
|---|---|---|---|
| A | Le compte démo `fenuasim.qa.applereview@example.com` existe, est confirmé (`email_confirmed_at` non nul) et s'est déjà connecté le 2026-09-03 → **la connexion fonctionne**. | Aucun | RAS |
| B | Ce compte a **0 commande** (`airalo_orders` filtré sur son e-mail = 0). Le révisateur se connecte et voit un écran d'accueil **vide**. | **Élevé** — Apple demande explicitement de montrer « accessing paid content or features ». Un compte vide donne l'impression d'une app non fonctionnelle → 2.1 à nouveau. | Passer **une vraie commande eSIM sur ce compte** (le forfait le moins cher) avant de répondre, pour que le révisateur voie un vrai eSIM, un QR code et un historique. |
| C | Le paiement mobile passe par l'Edge Function `create-checkout-mobile` en **mode Stripe LIVE** (constat Phase 4C, non corrigé depuis). | Moyen | L'achat du point B **débitera réellement** votre carte. Prenez le forfait le moins cher, c'est le prix d'une soumission propre. |
| D | L'assurance est **réservée aux résidents de Polynésie française** (`app/(tabs)/insurance.tsx:44`, case de confirmation de résidence dans `app/insurance/form.tsx:398`). | Moyen | C'est une **différence régionale** (leur point 5) **et** un **secteur régulé** (leur point 6). Ne pas le cacher : c'est déclaré explicitement dans la réponse ci-dessous. |
| E | Point 6 « highly regulated industry » : eSIM (télécom) + assurance voyage. Chaîne réelle confirmée par vous le 2026-09-04 : **Airalo = contrat de revendeur signé** ; **assurance = vous êtes mandataire d'ANSET Assurances**, qui distribue les produits AVA. Vous n'avez donc **aucun lien contractuel direct avec AVA**. | Moyen | Tenir prêts le contrat Airalo signé et le mandat ANSET. La réponse section 3 décrit désormais la chaîne exacte à trois maillons — ne la simplifiez pas en « accord avec AVA », ce serait faux et vérifiable. |

---

## 3. Réponse à coller dans le Resolution Center (et dans les Notes)

> Texte en anglais, structuré point par point comme Apple le demande. À copier tel quel.

**Version courte (< 4000 caractères, sous la limite du champ Notes / Resolution Center — la version longue ci-dessus a été refusée pour dépassement) :**

```text
Hello,

Thank you for the review. Requested information below (also added to App Review Information > Notes).

1) SCREEN RECORDING
Attached: a recording on a physical iPhone (latest iOS), starting at launch, showing registration, login, browsing and purchasing an eSIM (paid feature), the eSIM QR code, top-up, the travel insurance flow, the AI support assistant, and in-app account deletion. No user-generated content, so no moderation tools needed.

2) PURPOSE AND AUDIENCE
FenuaSIM sells prepaid travel eSIM data plans and travel insurance, mainly for residents of French Polynesia travelling abroad and travellers visiting French Polynesia. It solves high roaming costs by letting users buy and install an eSIM remotely in a few taps, with transparent XPF/EUR pricing, multi-eSIM/traveller management, top-up, and optional travel insurance. Audience: adult travellers (4+), French language.

3) SETUP AND ACCESS
No special setup needed; standard iPhone with internet.
Demo account (already in App Review Information):
  Email: fenuasim.qa.applereview@example.com
  Password: FenuaReview2026!
This account has an existing eSIM order, so the full signed-in experience is visible immediately. Single account type, no admin role.
Main tabs after sign-in: Home (active eSIMs, QR codes), Explore (browse/buy plans), Insurance (quote/subscribe), Account (profile, history, support, "Supprimer mon compte").
Account deletion: Account > "Supprimer mon compte" > type SUPPRIMER > confirm. Self-service, deletes server-side data and signs out. No contact required.

4) EXTERNAL SERVICES
Supabase (backend: auth, database, functions) - Stripe (payment, Checkout, no card data stored by us) - Airalo (wholesale eSIM provider; resold under a signed agreement) - insurance chain: FenuaSIM is an appointed agent of ANSET Assurances, a licensed insurance intermediary, distributing AVA's travel insurance products - fenuasim.com (our backend for orders and the AI assistant) - AI assistant only answers support questions about our own service, no open-ended content - Expo/EAS (build tooling). No ads, no analytics/tracking SDK, no location/contacts/photos/health data access.

5) REGIONAL DIFFERENCES
Same features everywhere, two labelled exceptions:
a) eSIM catalogue is identical worldwide; prices shown in XPF by default (switchable to EUR), charge always in EUR.
b) Travel insurance is restricted to French Polynesia residents (territory our mandate covers), a legal/contractual restriction stated on-screen with an explicit residency confirmation, not a geo-block - the screen stays visible everywhere for transparency.
All other features behave identically everywhere.

6) REGULATED INDUSTRY / THIRD-PARTY MATERIAL
FenuaSIM is not a network operator and not an insurer; it acts strictly as an authorised intermediary under written agreements:
- eSIM: profiles are provisioned by Airalo (licensed provider); FenuaSIM distributes under a signed reseller agreement and operates no network.
- Insurance: FenuaSIM is an appointed agent (mandataire) of ANSET Assurances, a licensed intermediary, under a written mandate; ANSET distributes AVA's products. The contract is between customer and insurer through this chain - FenuaSIM does not underwrite, carry risk, or issue certificates. AVA is named only to identify the distributed product range.
Our signed Airalo agreement and ANSET mandate can be provided on request. Brand names, plans, prices and content shown come from these partners' official catalogues under the above agreements.

NOTE ON PAYMENTS
All purchases are real-world telecom connectivity and insurance contracts consumed outside the app. Under Guideline 3.1.3(e) these are not digital content/virtual goods, so Stripe is used, consistent with comparable eSIM apps. No In-App Purchase products used.

Thank you,
The FenuaSIM team
```

---

## 4. Le screen recording — script exact à filmer

Contrainte Apple : **iPhone physique**, **iOS le plus récent**, ça doit **commencer par le
lancement de l'app**. Un enregistrement de simulateur est refusé. Durée visée : 3 à 5 min.

Enregistrement iOS natif : Réglages → Centre de contrôle → ajouter « Enregistrement de
l'écran », puis bouton rond depuis le Centre de contrôle.

Ordre à respecter (c'est l'ordre de leur liste, les révisateurs cochent au fur et à mesure) :

1. **Lancement** — depuis l'écran d'accueil iOS, taper l'icône FenuaSIM. Filmer le splash.
2. **Inscription** — créer un compte neuf en direct (e-mail jetable), montrer l'écran de
   confirmation. *Obligatoire : ils l'ont demandé explicitement.*
3. **Connexion** — se déconnecter, se reconnecter avec le compte démo
   `fenuasim.qa.applereview@example.com`.
4. **Achat d'un forfait payant** — Explorer → une destination → un forfait → paiement
   Stripe → écran de succès → **montrer le QR code de l'eSIM**. C'est le point « accessing
   paid content » ; c'est celui qu'ils regardent le plus.
5. **Recharge** — ouvrir un eSIM existant et montrer l'écran de recharge (pas besoin de
   payer une 2e fois, montrer l'écran suffit).
6. **Assurance** — onglet Assurance, montrer la mention « réservé aux résidents de
   Polynésie française », ouvrir le formulaire. Ne pas souscrire.
7. **Support IA** — Compte → Support → poser une question au chat, montrer la réponse.
8. **Suppression de compte** — Compte → « Supprimer mon compte » → écran d'info → taper
   `SUPPRIMER` → confirmer → **montrer le retour à l'écran de connexion**. Faites-le sur le
   compte créé à l'étape 2, **jamais** sur le compte démo.

⚠️ Ne coupez pas la vidéo entre les étapes : Apple veut un flux continu. Une seule prise.

Où la déposer : le Resolution Center accepte les pièces jointes (bouton trombone). Si le
fichier est trop lourd, mettez-le sur un lien non listé (Google Drive / YouTube non
répertorié) et collez l'URL dans la réponse — c'est accepté et courant.

---

## 5. Ordre des opérations recommandé

1. Passer une vraie commande eSIM sur le compte démo (point B ci-dessus) — **avant** de filmer.
2. Filmer l'enregistrement selon le script section 4.
3. Coller la réponse section 3 dans **App Review Information → Notes** (App Store Connect).
4. Répondre dans le **Resolution Center** avec le même texte + la vidéo.
5. Vérifier au passage que les captures d'écran de la fiche montrent bien l'app en usage et
   non le splash/login (ils rappellent la guideline 2.3.3 en prévention).
6. Renvoyer pour review. **Ne pas recompiler** : le build actuel est valide.

---

## Ce qui reste incertain

- **Point 6 / documents.** Chaîne confirmée par vous le 2026-09-04 : contrat Airalo signé,
  et mandat d'ANSET Assurances (qui revend AVA) côté assurance. Je n'ai vu ni l'un ni l'autre
  des documents — la réponse affirme qu'ils sont fournissables sur demande. Vérifiez que le
  mandat ANSET est bien un écrit produisible avant d'envoyer.
- **ANSET n'apparaît nulle part dans l'app** (0 occurrence dans tout le dépôt) : l'écran
  assurance affiche « by FENUASIM · AVA ». Ce n'est pas bloquant pour Apple, mais c'est un
  écart possible avec vos obligations d'information en distribution d'assurance — à voir avec
  ANSET, hors périmètre de cette soumission.
- **Mode Stripe.** Le constat « LIVE » vient de l'audit Phase 4C ; je n'ai pas relu la clé
  déployée dans `create-checkout-mobile` dans cette session.
- Aucun test fonctionnel de l'app n'a été relancé aujourd'hui — ce document décrit l'état du
  dépôt et de la base, pas un nouveau passage de recette.
