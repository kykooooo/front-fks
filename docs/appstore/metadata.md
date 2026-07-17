# App Store / Play Console — Metadata

## Nom de l'app
FKS

## Identifiants (bundle / package)
- iOS `bundleIdentifier` : `com.fks.app`
- Android `package` : `com.fks.app`
- EAS project id : `607ef5fa-ce96-4c07-9643-b79885aa28a3`
- Apple Team ID : `2Z868K5P3V`
- App Store Connect App ID (ascAppId) : `6746264443`

## Sous‑titre
Prépa physique football, simple et efficace

## Description (FR)
FKS propose des séances de préparation physique personnalisées pour les footballeurs.
Choisis ton cycle, ton lieu d'entraînement et ton matériel, l'app génère une séance claire et exploitable.

Points clés :
- Cycles spécialisés (Fondation, Force, Endurance, Explosivité, Saison/Maintien)
- Séances adaptées au lieu (terrain / salle / maison)
- Ajustements selon fatigue, charge et contraintes
- Interface simple et actionnable

## Mots‑clés
football, préparation physique, entraînement, vitesse, force, endurance, sprint, plyo

## Support URL
https://fks-app.com (ou une adresse email de contact : kyllian@fks-app.com)

## Marketing URL
https://fks-app.com

## Politique de confidentialité
https://fks-app.com/privacy

## Mentions légales
https://fks-app.com/legal

> ⚠️ Ces deux URLs supposent que `docs/appstore/privacy.html` et `docs/appstore/legal.html` sont hébergées sur `fks-app.com` (voir `docs/appstore/README.md` pour les options d'hébergement). Tant que ce n'est pas fait, ces liens ne fonctionnent pas — ne pas soumettre avant d'avoir une URL publique valide.

## Notes TestFlight
Application de prépa physique football avec cycles personnalisés. Merci de tester la génération et la cohérence des séances selon lieu.

## Contact / éditeur
- Nom : Le Bris Kyllian
- Email : kyllian@fks-app.com
- Adresse : 12 rue Julius et Ethel Rosenberg, **[CODE POSTAL ET VILLE À COMPLÉTER]**

---

## Questionnaires "confidentialité" (App Store Connect / Play Console)

À recopier tel quel dans les questionnaires de confidentialité des deux stores. Ce résumé reflète ce que l'app collecte réellement aujourd'hui (Firebase Auth + Firestore, Amplitude, OpenAI côté backend).

### Données collectées

| Catégorie | Donnée précise | Finalité | Liée à l'identité ? |
|---|---|---|---|
| Identifiants | Email, UID Firebase | Authentification, synchronisation du compte | Oui |
| Infos utilisateur | Prénom / nom, poste, niveau | Personnalisation des séances | Oui |
| Santé & fitness | RPE (perception d'effort), fatigue, douleur/blessure déclarées, tests terrain (temps, répétitions) | Calcul de charge (ATL/CTL/TSB), adaptation des séances, sécurité (garde-fous génération) | Oui (liée à l'UID) |
| Usage produit | Écrans visités, actions dans l'app, événements produit | Analytics (Amplitude), amélioration du produit | Oui (liée à l'UID) |

### Ce qui n'est PAS collecté
- Pas de géolocalisation précise.
- Pas de données financières / paiement.
- Pas d'identifiant publicitaire (IDFA) ni de tracking cross-app/cross-site.
- Pas de partage de données avec des tiers à des fins publicitaires.

### App Tracking Transparency (ATT) — iOS
**Non requis.** L'app ne fait pas de tracking cross-app/cross-site au sens d'Apple (pas d'IDFA, pas de partage à des fins publicitaires avec des tiers). Amplitude est utilisé en 1st-party (analytics produit lié à l'UID interne), pas pour du tracking publicitaire.

### Réponses type par service tiers
- **Firebase (Google)** : authentification + base de données (Firestore). Données transmises : email, UID, toutes les données de profil/séances. Hébergement UE.
- **Amplitude** : analytics d'usage. Données transmises : UID (pseudonymisé côté produit), événements d'usage, éventuellement RPE/fatigue/douleur si trackés comme propriétés d'événement.
- **OpenAI** : génération des séances côté backend (le contenu envoyé est le contexte d'entraînement, pas l'identité directe de l'utilisateur — pas d'email/nom transmis à OpenAI).

### Suppression de compte
Nécessaire pour Google Play (obligatoire depuis 2023) et recommandé pour Apple. **En place dans l'app** : Paramètres → Confidentialité → « Supprimer mon compte » (ré-authentification par mot de passe, puis Cloud Function `deleteAccount` qui purge la fiche club, `users/{uid}` et toutes ses sous-collections, et supprime le compte Auth en dernier). ⚠️ Le bouton ne fonctionne qu'une fois la Cloud Function déployée (`firebase deploy --only functions:deleteAccount` — cf. `DEPLOIEMENT_SUPPRESSION_COMPTE.md` à la racine du repo) : déployer la function AVANT de soumettre aux stores.

### Mineurs & consentement parental (questionnaires « Public cible » / classification d'âge)
- L'app ne cible pas les moins de 13 ans : la catégorie U13 n'est plus proposée à l'inscription (plus jeune catégorie sélectionnable : U15). Ne pas déclarer de tranche d'âge < 13 ans — pas de programme Apple « Kids » ni Play « Conçu pour les familles ».
- Consentement parental obligatoire dans l'app pour les joueurs de moins de 15 ans (RGPD, droit français) : case à cocher bloquante au setup profil, preuve horodatée stockée dans le profil utilisateur (`parentalConsent` : accepted / acceptedAt / ageCategoryAtConsent).
- La politique de confidentialité (app + `privacy.html`) contient une section « Mineurs de moins de 15 ans » : les droits du mineur (accès, rectification, effacement) s'exercent via le parent ou responsable légal à kyllian@fks-app.com.
- Play Console (questionnaire « Public cible et contenu ») : déclarer uniquement des tranches d'âge 13 ans et plus, en cohérence avec ce qui précède.

---

## Création de la clé de service Google Play (pour `eas submit` Android)

Le fichier `eas.json` référence désormais `submit.production.android.serviceAccountKeyPath` (placeholder : `./google-play-service-account.json`, **ce fichier n'existe pas encore** et est ignoré par git). Pour pouvoir soumettre l'app Android via `eas submit`, il faut créer cette clé une seule fois :

1. Créer l'app dans la [Google Play Console](https://play.google.com/console) (nécessite un compte développeur Google Play, ~25$ à vie, un compte par personne/organisation).
2. Dans Play Console : **Configuration > Accès à l'API** (Setup > API access).
3. Lier un projet Google Cloud (Play Console peut en créer un automatiquement).
4. Créer un compte de service ("Service Account") depuis ce lien, avec le rôle **"Release manager"** (ou un rôle custom avec les permissions de release/publication).
5. Dans Google Cloud Console, générer une clé JSON pour ce compte de service (**IAM & Admin > Comptes de service > Clés > Ajouter une clé > JSON**) — le fichier se télécharge automatiquement.
6. Renommer ce fichier `google-play-service-account.json` et le placer à la racine du repo front (**ne jamais le commiter** — il est dans `.gitignore`).
7. Vérifier dans Play Console que le compte de service a bien accès à l'app (inviter le compte de service si besoin, onglet "Utilisateurs et autorisations").
8. Le premier envoi doit obligatoirement se faire manuellement (upload d'un `.aab`) une fois sur Play Console pour créer la fiche — `eas submit` ne peut pas créer la toute première version, seulement les suivantes.
