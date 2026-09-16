# Documents du pilote 2026 (sauvegarde du 16/09/2026)

Documents de travail qui vivaient hors git, eparpilles dans cinq worktrees.
Regroupes ici pour ne plus dependre d'un disque. Les dates sont celles du contenu.

| Fichier | Origine | Contenu |
|---|---|---|
| PITCH_CLUBS.md | RC pilote 03/08 | pitch 30 s, script demo 5 min, FAQ honnete, liste des non-promesses |
| PREPARATION_CLUBS.md | prepa clubs 18/08 | preparation des clubs, 31 correctifs |
| CHECKLIST_TELEPHONE.md | prepa clubs 18/08 | recette telephone |
| RAPPORT_NON_SOLO.md | verification 11/08 | garde solo, badge « A deux », stubs rsa_* |
| AUDIT_BIBLIOTHEQUE.md | audit 11-12/08 | audit de la bibliotheque d'exercices |
| RAPPORT_BIBLIOTHEQUE_FIX.md | audit 11-12/08 | rapport des correctifs de la bibliotheque |

## Encore hors git, a ajouter par le fondateur

Ces deux fichiers ne contiennent que les contacts des fondateurs ou des comptes de
test, mais la session automatisee n'a pas le droit de les copier. A copier a la main
depuis leur worktree, puis `git add docs/pilote-2026 && git commit` :

| Fichier | Ou il est | Ce qu'il contient de sensible |
|---|---|---|
| REGISTRE_RC.md | worktree `fks-pilot-rc-scope-4be2f5` | 2 emails de comptes de test Firebase |
| MARKETING_PILOTE.md | worktree `onboarding-flow-design-6070a5` | numero de Marvin + email pro (deja dans CLAUDE.md) |

## Volontairement hors git

`LISTE_APPELS.md` et `SCRIPT_APPELS.md` (decisions 07/08) contiennent les numeros
de telephone d'une trentaine de contacts de clubs. Des donnees personnelles de tiers
ne vont pas dans un depot de code. Ils restent sur le disque, dans le worktree
`onboarding-flow-design-6070a5`, a sauvegarder ailleurs (Drive du compte pro).
