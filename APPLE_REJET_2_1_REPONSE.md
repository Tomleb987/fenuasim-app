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

```text
Hello,

Thank you for the review. Please find below the requested information. The same
text has been added to the Notes field in App Review Information.

--------------------------------------------------------------------
1) SCREEN RECORDING
--------------------------------------------------------------------
A screen recording captured on a physical iPhone running the latest iOS is
attached to this message. It starts from app launch and shows, in order:
account registration, login, browsing and purchasing an eSIM data plan
(paid feature), retrieving the eSIM QR code, the travel insurance flow, the
AI support assistant, and the in-app account deletion flow.

The app contains NO user-generated content, so no content reporting or
blocking mechanism is required or present.

--------------------------------------------------------------------
2) PURPOSE AND TARGET AUDIENCE
--------------------------------------------------------------------
FenuaSIM sells prepaid travel eSIM mobile data plans and travel insurance,
primarily for residents of French Polynesia travelling abroad and for
travellers visiting French Polynesia.

Problem solved: travellers arriving in or leaving French Polynesia face very
high roaming charges and often cannot easily obtain a local SIM card. FenuaSIM
lets them buy a data plan in a few taps and install it remotely as an eSIM,
before departure, with no physical SIM card and no store visit.

Value provided: transparent pricing displayed in the local currency (XPF) or
in EUR, instant delivery of the eSIM QR code, the ability to top up an
existing eSIM, to manage several eSIMs for several travellers or devices under
one account, and optional travel insurance.

Target audience: adult travellers (rating 4+, no age-sensitive content). The
app is available in French, the language of our market.

--------------------------------------------------------------------
3) SETUP AND ACCESS INSTRUCTIONS
--------------------------------------------------------------------
No special setup, hardware, or sample file is required. The app works on a
standard iPhone with an internet connection.

Demo account (already entered in App Review Information):
  Email:    fenuasim.qa.applereview@example.com
  Password: FenuaReview2026!

This account has an existing eSIM order so you can immediately see the full
signed-in experience (eSIM list, QR code, top-up, order history). There is
only one account type in the app; there is no admin or business role.

How to reach the main features after signing in:
  - Home tab: your active eSIMs, their remaining data and their QR code.
  - Explore tab: browse destinations and data plans, then purchase.
  - Insurance tab: travel insurance quote and subscription.
  - Account tab: profile, order history, travellers/devices, support, and
    "Supprimer mon compte" (Delete my account) at the bottom of the screen.

Account deletion: Account tab -> "Supprimer mon compte" -> confirmation screen
-> type the word "SUPPRIMER" -> the account and its personal data are deleted
server-side and the user is signed out. This is fully self-service inside the
app and requires no email or phone contact.

--------------------------------------------------------------------
4) EXTERNAL SERVICES USED
--------------------------------------------------------------------
  - Supabase (supabase.com): user authentication, database, and serverless
    functions. This is our own backend.
  - Stripe: payment processing (Stripe Checkout). No card data is ever stored
    by the app.
  - Airalo: wholesale eSIM provider. FenuaSIM is a reseller/distributor of
    Airalo data plans; Airalo provisions the eSIM profile and the QR code.
  - Travel insurance distribution chain: FenuaSIM acts as an appointed agent
    of ANSET Assurances, a licensed insurance intermediary, which distributes
    the travel insurance products of AVA. AVA is the product provider; ANSET
    is our contractual counterparty. FenuaSIM neither underwrites nor carries
    any insurance risk.
  - fenuasim.com: our own website, which hosts two endpoints the app calls —
    order creation and the AI support assistant.
  - AI service: the in-app support assistant is an AI chatbot answering
    questions about eSIM compatibility, installation and orders. It runs on
    our own fenuasim.com backend. It only answers customer-support questions
    about our own service and does not generate open-ended or user-published
    content.
  - Expo / EAS (expo.dev): the framework used to build the app.

There is no advertising SDK, no analytics SDK, no tracking, and the app never
requests location, contacts, photos, or health data.

--------------------------------------------------------------------
5) REGIONAL DIFFERENCES
--------------------------------------------------------------------
The app's features are the same in every region, with two intentional,
clearly labelled differences:

  a) eSIM data plans: the catalogue of destinations is identical worldwide.
     Prices are displayed in XPF (French Polynesian franc) by default and can
     be switched to EUR by the user; the actual charge is always in EUR.

  b) Travel insurance: this product is contractually restricted to residents
     of French Polynesia, because that is the territory covered by the
     insurance products we are mandated to distribute. This restriction is stated
     on the insurance screen and the user must explicitly confirm French
     Polynesian residency before subscribing. The restriction is a legal and
     contractual one from the insurer, not a technical geo-block: the screen
     remains visible and readable everywhere so that the limitation is
     transparent to every user.

All other features - account, eSIM purchase, top-up, QR code, support - behave
identically in all regions.

--------------------------------------------------------------------
6) REGULATED INDUSTRY / THIRD-PARTY MATERIAL
--------------------------------------------------------------------
FenuaSIM does not operate as a mobile network operator and is not an
insurer. In both regulated areas we act strictly as an authorised
intermediary, under written agreements:

  - Mobile data / eSIM: the eSIM profiles are provisioned by Airalo, a
    licensed eSIM provider. FenuaSIM distributes Airalo data plans under a
    signed reseller agreement. FenuaSIM does not own or operate any mobile
    network and does not issue SIM profiles itself.

  - Travel insurance: FenuaSIM is an appointed agent (mandataire) of ANSET
    Assurances, a licensed insurance intermediary, under a written mandate.
    ANSET distributes the travel insurance products of AVA. The insurance
    contract is therefore concluded between the customer and the insurer
    through this chain; FenuaSIM does not underwrite policies, does not carry
    any insurance risk, and does not issue insurance certificates itself. The
    certificate delivered in the app is the one produced by the insurer.
    The AVA name appears in the app only to identify the product range being
    distributed, which our mandate authorises us to distribute.

We can provide, immediately on request:
  - our signed reseller agreement with Airalo;
  - our written mandate from ANSET Assurances.

All brand names, plan names, prices and product content shown in the app come
from these partners' official catalogues, which we are authorised to
distribute under the agreements above.

--------------------------------------------------------------------
NOTE ON PAYMENTS
--------------------------------------------------------------------
All purchases in the app are real-world telecom services (mobile data
connectivity delivered over physical mobile networks) and insurance contracts,
both consumed outside the app. Under Guideline 3.1.3(e) these are not digital
content or virtual goods, so payment is processed via Stripe, consistent with
comparable eSIM apps on the App Store. No In-App Purchase products are used.

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
