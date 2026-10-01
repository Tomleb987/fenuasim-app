# Tuto — Publier FenuaSIM sur Google Play

_Rédigé le 2026-08-27. Guide pratique à suivre vous-même dans Google Play Console. Le build Android de production existe déjà (généré via EAS le 2026-08-26) — il ne reste que les étapes côté Console._

**Build `.aab` déjà généré :**
`https://expo.dev/artifacts/eas/WA8jud0flLL4YVc2baPyw7iFymZvGgEauwBn43NdxnE.aab`
Page du build : `https://expo.dev/accounts/tomleb987/projects/fenuasim-app/builds/c05a638a-6463-4f29-9a3f-8dbd31ae2393`

**Identité de l'app (déjà dans `app.json`, ne pas retaper ailleurs) :**
- Nom affiché : `FenuaSIM`
- Package Android : `com.fenuasim.app`
- `versionCode` : EAS l'a déjà incrémenté à `2` côté serveur au dernier build (le fichier local `app.json` peut afficher autre chose, c'est normal — EAS est la source de vérité tant que `appVersionSource: local` n'est pas resynchronisé manuellement)

---

## Étape 1 — Créer l'application (fait)

Play Console → **Créer une application** :
- Nom : `FenuaSIM`
- Langue par défaut : Français (France)
- Type : Application
- Gratuite

⚠️ Rappel important : le paiement des recharges eSIM passe par **Stripe** (checkout hébergé), pas par Google Play Billing. Si Google requalifie l'eSIM en "bien numérique consommé dans l'app", il peut exiger Play Billing. À surveiller au moment de la review (voir Étape 4, "Fonctionnalités financières").

---

## Étape 2 — Compte de service (pour l'upload automatique)

Nécessaire pour que je puisse lancer `eas submit` à votre place plutôt que vous fassiez un upload manuel à chaque build.

1. Play Console → **Configuration** → **Accès à l'API**
2. Si ce n'est pas déjà fait, lier un projet Google Cloud (Play Console le propose automatiquement)
3. **Créer un compte de service** → ça ouvre Google Cloud Console → **IAM et administration** → **Comptes de service** → **Créer un compte de service**
   - Nom : `fenuasim-eas-submit` (ou ce que vous voulez, indifférent)
   - Rôle : pas besoin de rôle IAM particulier ici, l'accès se gère côté Play Console (étape suivante)
4. Une fois créé, ouvrir le compte de service → onglet **Clés** → **Ajouter une clé** → **Créer une clé** → format **JSON** → téléchargement automatique du fichier
5. Retour dans Play Console → **Accès à l'API** → le compte de service apparaît → cliquer **Gérer les autorisations Play Console**
6. Donner le rôle **Gestionnaire de version** (Release Manager) — accès minimal suffisant pour uploader des builds

**⚠️ Sécurité — important :**
- Ne jamais commiter ce fichier JSON dans git (il donne un accès direct à la publication de l'app)
- Le stocker localement, par exemple `secrets/google-play-service-account.json`, et vérifier qu'il est bien ignoré par `.gitignore`
- Une fois ce fichier prêt, donnez-le-moi (le chemin local suffit, pas besoin de me coller le contenu) et je configure `eas.json` :

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./secrets/google-play-service-account.json",
      "track": "internal"
    }
  }
}
```

---

## Étape 3 — Checklist "Contenu de l'app" (obligatoire avant toute diffusion, même en test)

Play Console → menu de gauche → **Contenu de l'app**. Chaque section doit être marquée complète :

| Section | Ce qu'il faut fournir |
|---|---|
| **Politique de confidentialité** | Une URL publique (ex. `https://fenuasim.com/confidentialite`). Si elle n'existe pas encore, c'est un vrai bloquant — dites-le-moi. |
| **Classification du contenu** | Questionnaire Google (IARC). Pour une app eSIM sans contenu généré par les utilisateurs ni contenu adulte, les réponses sont simples — je peux vous guider en direct si besoin. |
| **Public cible** | Précisez que l'app n'est pas destinée aux enfants (13+ ou tranche équivalente) |
| **Sécurité des données** | Déclarer les données collectées : email (auth Supabase), données de paiement (transitent par Stripe, non stockées côté app), identifiant eSIM/appareil. Préciser si chiffrées en transit (oui, HTTPS/TLS) |
| **Accès à l'app** | Comme l'app nécessite un compte, fournir un identifiant/mot de passe de test pour les reviewers Google |
| **Annonces** | Répondre "Non, mon application ne contient pas d'annonces" |
| **Fonctionnalités financières** | Déclarer les achats in-app (recharges eSIM via Stripe). C'est ici que Google peut soulever la question Play Billing — répondez factuellement, sans anticiper de refus |
| **Apps gouvernementales / COVID** | Non concerné, répondre "non" |

---

## Étape 4 — Fiche du Store (Store listing)

Play Console → **Présence sur le Store** → **Fiche Store principale**.

**Textes obligatoires :**
- Titre de l'app (30 car. max) : `FenuaSIM`
- Description courte (80 car. max)
- Description complète (4000 car. max)

**Visuels obligatoires :**
| Asset | Format |
|---|---|
| Icône de l'app | 512×512 px, PNG 32 bits |
| Image "feature graphic" | 1024×500 px, JPG ou PNG 24 bits |
| Captures d'écran téléphone | Minimum 2, format PNG/JPG, ratio 16:9 ou 9:16 |

Vous avez déjà `assets/icon.png` et `assets/adaptive-icon.png` dans le repo — à vérifier s'ils respectent la résolution 512×512 exigée par le Store (l'icône `app.json` pour Expo n'a pas forcément la même résolution que celle exigée par Play Console).

---

## Étape 5 — Créer une piste de test interne

Recommandé avant de passer en production : pas de review Google, disponible en quelques minutes.

1. Play Console → **Test** → **Test interne** → **Créer une version**
2. Uploader le `.aab` (téléchargez-le depuis le lien EAS ci-dessus, ou attendez l'Étape 2 pour que je le pousse automatiquement via `eas submit`)
3. Renseigner les notes de version
4. **Testeurs** → ajouter les adresses Gmail des testeurs (vous-même, l'équipe)
5. Publier la version de test → un lien d'inscription est généré, à partager aux testeurs pour installer l'app

---

## Étape 6 — Envoyer le build

**Option A — automatique (une fois l'Étape 2 faite) :**
```bash
eas submit --platform android
```
Pousse directement le dernier build de production vers la piste configurée dans `eas.json` (`internal` recommandé au départ).

**Option B — manuel, dès maintenant, sans attendre le compte de service :**
Télécharger le fichier `.aab` depuis le lien EAS ci-dessus, puis l'uploader à la main dans Play Console → **Test interne** → **Créer une version**.

---

## Étape 7 — Tester, puis passer en production

1. Installer l'app via le lien de test interne, vérifier le parcours complet (inscription, achat eSIM, paiement Stripe, retour dans l'app — cf. bug de routing corrigé en Phase 5)
2. Une fois satisfait, Play Console → **Production** → **Créer une version** → promouvoir le build testé
3. Soumettre pour review Google (délai typique : quelques heures à quelques jours pour une première soumission)

---

## Résumé — ce qui bloque encore

- [ ] URL de politique de confidentialité (si absente)
- [ ] Fichier JSON du compte de service (pour automatiser via `eas submit`)
- [ ] Icône Store 512×512 + feature graphic 1024×500 + captures d'écran
- [ ] Textes de la fiche Store (descriptions courte/longue)
- [ ] Identifiants de test à fournir à Google (Étape 3, "Accès à l'app")

Tout le reste (build Android, config EAS, corrections de bugs pré-publication) est déjà fait — voir [[fenuasim-phase5-progress]].
