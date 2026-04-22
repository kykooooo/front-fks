# Build testeurs joueurs

Objectif : sortir une vraie version utilisateur de FKS a faire tester a des joueurs, sans dev menu et sans dev client Expo.

## Ce qui est deja prepare

- `FORCE_WELCOME` est desactive dans `config/devFlags.ts`
- le profil EAS `testers` existe dans `eas.json`
- des scripts simples existent dans `package.json`

## Commandes

```bash
yarn build:testers:android
yarn build:testers:ios
```

Si tu veux passer par TestFlight :

```bash
yarn build:testflight
```

## Secrets a verifier avant build cloud

- `EXPO_PUBLIC_BACKEND_URL`
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` si tu veux le monitoring
- `AMPLITUDE_API_KEY` si tu veux l'analytics

⚠️ `EXPO_PUBLIC_BACKEND_API_KEY` **retirée** (avril 2026, raison sécurité).
L'auth backend se fait désormais via Firebase ID token uniquement.

## Resultat attendu

- build utilisateur
- pas de dev client Expo
- pas de welcome force a chaque lancement
- app partageable a des joueurs pour tests terrain
