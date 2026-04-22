# FKS — Application de Préparation Physique Football

Application mobile React Native (Expo) pour footballeurs amateurs.
L'IA génère des séances personnalisées, modélise la charge d'entraînement (ATL/CTL/TSB)
et guide le joueur sur des cycles de 12 séances.

---

## Prérequis

- **Node.js >= 18** — [nodejs.org](https://nodejs.org)
- **Yarn** — `npm install -g yarn` (gestionnaire de paquets utilisé sur ce projet)
- **Expo Go** sur iOS ou Android pour tester sans build natif
- **Compte Expo** (optionnel, pour les builds EAS)

---

## Installation

```bash
# Cloner le repo
git clone <url-du-repo>
cd front-fks

# Installer les dépendances
yarn install

# Copier le fichier d'environnement et remplir les valeurs
cp .env.local.example .env.local
# Éditer .env.local avec tes clés (voir section Variables d'env ci-dessous)
```

---

## Lancer l'application

```bash
yarn start        # Expo dev server (scan le QR avec Expo Go)
yarn ios          # Simulateur iOS (macOS uniquement)
yarn android      # Émulateur Android
```

---

## Variables d'environnement

Copier `.env.local.example` → `.env.local` et remplir :

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | URL de l'API backend (ex: `https://fks-backend-xmnb.onrender.com`) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Clé API Firebase Web (Firebase Console > Paramètres du projet) |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN Sentry (optionnel, crash reporting) |

> `.env.local` est dans `.gitignore` — ne jamais commiter les vraies valeurs.
>
> ⚠️ `EXPO_PUBLIC_BACKEND_API_KEY` a été retirée (avril 2026) : elle était
> embarquée dans le bundle JS et donc extractible. L'auth backend se fait
> désormais uniquement via Firebase ID token (`Authorization: Bearer ...`),
> et n'est acceptée que sur les endpoints user-facing (`/api/fks/generate`,
> `/api/fks/chat`). La clé `FKS_API_KEY` côté serveur sert uniquement aux
> endpoints internes (`/api/fks/metrics/*`).
>
> Pour les builds EAS (cloud) :
> ```bash
> eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value "..."
> eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."
> ```

---

## Commandes utiles

```bash
yarn typecheck    # Vérifie les types TypeScript (0 erreur attendu)
yarn lint         # ESLint sur tous les .ts/.tsx
yarn format       # Prettier (reformate les fichiers)
yarn test         # Lance les tests unitaires (Jest)
```

---

## Architecture (5 points clés)

- **Navigation** : `navigation/RootNavigator.tsx` — machine à états auth → onboarding → app
- **State** : `state/trainingStore.ts` — Zustand 5 avec slices (load, firestore, planning...) + sync Firestore temps réel
- **Modèle charge** : `engine/loadModel.ts` — EWMA Banister (ATL/CTL/TSB) sur 14/28 jours
- **Cycles** : `domain/microcycles.ts` — 8 cycles + 4 parcours guidés (ex: "Je reprends de zéro")
- **Génération IA** : `screens/newSession/` — orchestrateur → backend Node.js (OpenAI 2-agents) → JSON `fks.next_session.v2`

---

## Structure des dossiers

```
config/        # Backend URL, Firebase config, dev flags, constantes training
constants/     # Design system (theme), feedback limits, warmups
domain/        # Types métier, microcycles, recommandation de cycle
engine/        # Modèle de charge (EWMA), banque d'exercices
state/         # Stores Zustand (training, settings, appMode)
services/      # Firebase, IA context, analytics, notifications
screens/       # 29 écrans (Home, Session, Feedback, Chat, Progress...)
components/    # UI components, modal system, home cards
hooks/         # Hooks métier Home (CTA, carousel, streak, TSB series)
utils/         # dateHelpers, errorHandler, toast, offlineQueue
navigation/    # RootNavigator (auth + app + modals)
```

---

## Notes de développement

- App créée sans développeur professionnel (IA-assisted). Le code est fonctionnel et propre mais n'a pas de tests exhaustifs.
- `DEV_FLAGS.ENABLED = false` en prod. Passer à `true` pour activer les outils de debug (horloge virtuelle, bypass feedback...).
- Le backend est sur Render (cold start ~15s) — le front a un retry automatique.
- Expo SDK 54, React Native 0.81, React 19, new architecture activée.
