# Pages App Store — hébergement

Ce dossier contient les deux pages statiques exigées par Apple/Google avant publication :

- `privacy.html` — politique de confidentialité (contenu repris de `utils/legalContent.ts`)
- `legal.html` — mentions légales (contenu repris de `utils/legalContent.ts`)

Elles doivent être accessibles publiquement, idéalement sur :
- `https://fks-app.com/privacy`
- `https://fks-app.com/legal`

⚠️ **Avant de publier** : les deux pages contiennent un marqueur `[CODE POSTAL ET VILLE À COMPLÉTER]` à la place de l'adresse complète (le fichier source `utils/legalContent.ts` a la même adresse incomplète). Complète l'adresse aux deux endroits (page HTML + fichier source) avant la mise en ligne définitive.

## Option 1 — Firebase Hosting (recommandé, déjà dans l'écosystème du projet)

Le projet utilise déjà Firebase (auth + Firestore), donc pas de nouveau compte à créer.

```bash
# Depuis la racine du repo front (une seule fois)
firebase init hosting
# Répondre :
#   - "What do you want to use as your public directory?" -> docs/appstore
#   - "Configure as a single-page app?" -> No
#   - "Set up automatic builds and deploys with GitHub?" -> No (sauf si tu veux du CI/CD)

# Déployer
firebase deploy --only hosting
```

Ensuite, dans la config DNS de `fks-app.com` (chez l'hébergeur du domaine), ajoute le domaine personnalisé dans la console Firebase Hosting (**Hosting > Ajouter un domaine personnalisé**) et suis les instructions de vérification (enregistrements TXT/A fournis par Firebase). Firebase gère le certificat HTTPS automatiquement.

Résultat visé : `https://fks-app.com/privacy.html` (ou une redirection propre vers `/privacy`, voir `firebase.json` > `rewrites` si besoin de retirer le `.html`).

## Option 2 — Hébergeur actuel du domaine fks-app.com

Si le domaine `fks-app.com` est déjà chez un hébergeur (OVH, Google Domains, Namecheap, etc.) avec un espace web basique :

1. Se connecter à l'espace client de l'hébergeur.
2. Uploader `privacy.html` et `legal.html` via le gestionnaire de fichiers / FTP, à la racine du site ou dans un sous-dossier.
3. Vérifier que les URLs `https://fks-app.com/privacy.html` et `https://fks-app.com/legal.html` répondent bien (HTTPS actif).

C'est l'option la plus rapide si un site web existe déjà sur ce domaine — pas besoin de toucher à Firebase.

## Option 3 — Solution temporaire pour ne pas bloquer la soumission

Si `fks-app.com` n'est pas encore prêt à héberger ces pages, une page statique gratuite (GitHub Pages, Vercel, Netlify) peut servir de solution de secours le temps de configurer l'hébergement définitif. Il faudra alors mettre à jour les URLs dans App Store Connect / Play Console une fois `fks-app.com` prêt (les stores acceptent qu'on modifie ces URLs après soumission).

## Ce que Kyllian doit faire à la main

1. Choisir une option ci-dessus (Firebase Hosting recommandé).
2. Compléter le code postal + ville dans `privacy.html`, `legal.html` ET `utils/legalContent.ts` (marqueur `[CODE POSTAL ET VILLE À COMPLÉTER]`).
3. Déployer/uploader les pages.
4. Vérifier que les deux URLs publiques répondent en HTTPS.
5. Coller ces URLs dans App Store Connect (App Privacy / Support URL) et Google Play Console (Politique de confidentialité).
