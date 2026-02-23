# TestFlight (EAS) — Setup rapide

## Pré‑requis
- Un compte Apple Developer actif.
- App créée dans App Store Connect (même si elle ne sera pas publiée).
- EAS CLI installé.

## 1) Backend public rapide (Render)
1. Pousse le repo backend sur GitHub.
2. Va sur Render et crée un **Web Service** depuis le repo.
3. Render détecte `render.yaml` et configure automatiquement build + start.
4. Ajoute les variables d’environnement :
   - `OPENAI_API_KEY`
   - `FKS_API_KEY`
   - `FKS_CORS_ORIGINS` (optionnel, laisser vide si tu n’utilises pas le web)
5. Récupère l’URL publique Render (ex: `https://fks-backend.onrender.com`).

## 2) Secrets EAS (pour TestFlight)
Dans le repo app :
```bash
cd /Users/macbookair/fks-apps
npx eas-cli@latest login
npx eas-cli@latest secret:create --name EXPO_PUBLIC_BACKEND_URL --value https://ton-backend.render.com
npx eas-cli@latest secret:create --name EXPO_PUBLIC_BACKEND_API_KEY --value TA_CLE_BACKEND
```

## 3) Build TestFlight
```bash
npx eas-cli@latest build -p ios --profile testflight
```

## 4) Submit TestFlight
```bash
npx eas-cli@latest submit -p ios --profile testflight
```

## 5) Ajouter des testeurs
Dans App Store Connect > TestFlight :
1. Crée un groupe de testeurs internes.
2. Ajoute leurs emails.
3. Active la build.

---

## Notes
- TestFlight = **tests uniquement**. L’app **n’apparaît pas** sur l’App Store tant que tu ne soumets pas une version publique.
- Pour le backend, l’URL locale ne marche pas sur TestFlight : **il faut une URL publique**.
