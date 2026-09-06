# Page « Suppression de compte » à publier sur fenuasim.com

**Pourquoi cette page est obligatoire.** Le formulaire « Sécurité des données » de Google
Play exige une **URL de suppression de compte** publiquement accessible. Google impose
trois choses à cette page : qu'elle nomme l'application ou l'éditeur tel qu'il figure sur
la fiche Play, qu'elle expose clairement la marche à suivre, et qu'elle précise quelles
données sont supprimées, lesquelles sont conservées, et pendant combien de temps.

La politique de confidentialité existante (`/confidentialite`) ne suffit pas : vérifiée le
2026-09-06, elle ne mentionne le droit d'effacement RGPD que de façon générique, sans
procédure ni détail de conservation.

**URL recommandée :** `https://www.fenuasim.com/suppression-compte`

---

## Ce que le code fait réellement

Établi en lisant la fonction `delete-account` (Supabase Edge Function, version 3), pas
supposé.

**Supprimé immédiatement** — la suppression de `auth.users` déclenche les CASCADE déjà en
place :

| Donnée | Table |
|---|---|
| Le compte et ses identifiants | `auth.users` |
| Le profil (nom, e-mail) | `profiles` |
| Les fiches voyageurs | `app_travelers` |
| Les appareils enregistrés | `app_devices` |
| Les attributions d'eSIM à un voyageur ou un appareil | `app_esim_assignments` |

**Conservé** — la fonction ne lit ni ne modifie jamais ces données, par choix explicite :

commandes eSIM (`airalo_orders`, `orders`), recharges (`airalo_topups`), remboursements
(`airalo_refunds`), transactions Stripe (`stripe_transactions`), factures et documents
(`invoices`, `documents`), contrats d'assurance (`insurances`), historique du support
(`support_tickets`, logs), e-mails envoyés (`emails_sent*`), et le journal de la demande de
suppression elle-même (`account_deletion_requests`).

**Un compte administrateur ne peut pas être supprimé depuis l'application** (refus explicite
avec le code `ADMIN_ACCOUNT`).

---

## Texte de la page, prêt à publier

> ⚠️ **À confirmer avant publication** : la durée de conservation de 10 ans indiquée
> ci-dessous correspond à l'obligation comptable française usuelle (Code de commerce,
> art. L123-22). Vérifiez qu'elle correspond bien à votre politique réelle et à votre
> statut, et ajustez si besoin. Ne publiez pas une durée que vous ne tenez pas.

---

### Supprimer votre compte FenuaSIM

FenuaSIM vous permet de supprimer votre compte et les données personnelles associées à
tout moment, directement depuis l'application ou en nous écrivant.

#### Depuis l'application

1. Ouvrez l'application **FenuaSIM**
2. Allez dans l'onglet **Compte**
3. Choisissez **Supprimer mon compte**
4. Confirmez la suppression

La suppression est immédiate et définitive. Vous serez déconnecté et ne pourrez plus
accéder à votre compte.

#### Par e-mail

Si vous n'avez plus accès à l'application, écrivez à **contact@fenuasim.com** depuis
l'adresse e-mail de votre compte, en indiquant que vous demandez la suppression de votre
compte FenuaSIM. Nous traitons ces demandes sous 30 jours.

#### Données supprimées

Sont effacées immédiatement et définitivement :

- votre compte et vos identifiants de connexion ;
- votre profil (nom, prénom, adresse e-mail) ;
- les fiches voyageurs que vous avez créées ;
- les appareils que vous avez enregistrés ;
- les attributions de vos eSIM à un voyageur ou à un appareil.

#### Données conservées, et pourquoi

Certaines données sont conservées après la suppression de votre compte, parce que la loi
nous y oblige ou parce qu'elles sont nécessaires à la preuve d'une transaction :

- **l'historique de vos commandes d'eSIM et de recharges**, les factures et les
  transactions de paiement — conservés **10 ans** au titre des obligations comptables et
  fiscales (Code de commerce, article L123-22) ;
- **vos contrats d'assurance voyage** éventuels — conservés pendant la durée légale
  applicable au contrat d'assurance ;
- **l'historique de vos échanges avec notre support** et les e-mails que nous vous avons
  envoyés — conservés le temps nécessaire au traitement des litiges éventuels ;
- **la trace de votre demande de suppression** elle-même, sans donnée personnelle
  identifiante, afin de pouvoir prouver que nous y avons donné suite.

Ces données ne sont plus rattachées à un compte actif et ne servent qu'à ces finalités.
Elles ne sont ni utilisées à des fins commerciales, ni transmises à des tiers à d'autres
fins que celles décrites dans notre [politique de
confidentialité](https://www.fenuasim.com/confidentialite).

#### Vos autres droits

Conformément au RGPD, vous disposez également d'un droit d'accès, de rectification, de
limitation, d'opposition et de portabilité sur vos données. Pour les exercer, écrivez-nous
à **contact@fenuasim.com**.

---

_FenuaSIM — contact@fenuasim.com — https://www.fenuasim.com_

---

## Après publication

1. Vérifiez que l'URL répond publiquement, **sans connexion** (Google la teste depuis
   l'extérieur)
2. Collez-la dans Play Console → Sécurité des données → **URL de suppression de compte**
3. Le lien apparaîtra publiquement sur votre fiche Play Store
