# Déploiement — Suppression de compte

> **⚠️ Important : le bouton "Supprimer mon compte" dans l'app ne fonctionne
> qu'une fois la Cloud Function déployée** (étape 1). Tant qu'elle ne l'est
> pas, l'app affiche proprement "Service indisponible — la suppression de
> compte n'est pas encore activée côté serveur" (pas de crash), mais rien
> n'est supprimé. Donc : **déployer la function AVANT le merge + OTA.**

C'est comme un penalty : le tireur (l'app) est prêt, mais il faut d'abord
poser le ballon (la Cloud Function) sur le point.

---

## Étape 1 — Déployer la Cloud Function (une seule fois)

Depuis la racine du repo front (`C:\Users\Gamer\front-fks`) :

```
firebase deploy --only functions:deleteAccount
```

- Le build TypeScript se lance tout seul avant le déploiement (predeploy).
- La function part en région **europe-west4** (même région que la base).
- Les autres functions (projections coach) ne sont pas touchées.

Si la commande demande de te connecter : `firebase login` puis relance.

**Vérifier que c'est déployé** :

```
firebase functions:list
```

Tu dois voir `deleteAccount` dans la liste, en `europe-west4`, type `callable`.

## Étape 2 — Tester avec un compte jetable (recommandé)

1. Dans l'app (build dev ou TestFlight actuel après OTA), crée un compte
   poubelle (email bidon genre `test-suppression@fks-app.com`).
2. Fais 1 séance ou remplis le profil pour avoir des données.
3. Paramètres → Confidentialité → **Supprimer mon compte** → mot de passe →
   confirmation.
4. Résultats attendus :
   - Toast "Compte supprimé", retour à l'écran Welcome.
   - Console Firebase → Authentication : l'utilisateur a disparu.
   - Console Firebase → Firestore : `users/{uid}` n'existe plus (ni ses
     sous-collections `sessions` / `plannedSessions`).
   - Si le compte était dans un club : sa fiche a disparu de
     `clubs/{clubId}/members` et `clubs/{clubId}/playerSummaries`.
5. Essaie de te reconnecter avec ce compte → "identifiants invalides" (normal,
   le compte n'existe plus).

**Test de sécurité bonus** : entre un mauvais mot de passe à l'étape 3 →
message "Mot de passe incorrect", rien n'est supprimé.

## Étape 3 — Merge + OTA (comme d'habitude)

Une fois la function déployée et testée :

```
git checkout main
git pull
git merge feat/suppression-compte -m "feat(compte): suppression de compte (exigence stores)"
git push origin main
eas update --channel testflight
```

(Aucun fichier natif touché → OTA suffit, pas de rebuild EAS.)

---

## Ce que fait la suppression, dans l'ordre

1. **Ré-authentification** par mot de passe dans l'app (personne ne peut
   supprimer le compte d'un autre : la function ne lit QUE l'uid du token).
2. **Purge club** : `clubs/{clubId}/members/{uid}` +
   `clubs/{clubId}/playerSummaries/{uid}` (la fiche disparaît côté coach).
3. **Purge données** : `users/{uid}` + TOUTES ses sous-collections
   (`sessions`, `plannedSessions`, et toute future sous-collection —
   `recursiveDelete` ratisse tout).
4. **Compte Auth supprimé EN DERNIER** : si la purge des données échoue, le
   compte survit et l'utilisateur peut simplement réessayer.
5. **Purge locale** sur le téléphone : stores remis à zéro, snapshots,
   file offline, tests terrain, notifications planifiées annulées → retour
   à l'écran Welcome.

La function est **idempotente** : réessayer après un échec partiel est
toujours sans danger (les documents déjà supprimés sont ignorés).

## En cas de pépin

- **"Service indisponible" dans l'app** → la function n'est pas déployée
  (refais l'étape 1) ou pas encore propagée (attends 2 min).
- **"Suppression échouée. Réessaie."** → regarde les logs :
  `firebase functions:log --only deleteAccount`
  (les logs ne contiennent que l'uid et des compteurs, jamais de données perso).
- Le déploiement échoue sur le build → `yarn --cwd functions install` puis
  relance l'étape 1.
