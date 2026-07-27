# Prototype Home vNext — à regarder

---

## POUR LANCER

Ouvre un terminal, place-toi dans le dossier du worktree, et lance ces deux lignes :

```
cd C:\Users\Gamer\front-fks\.claude\worktrees\home-vnext-prototype
node prototype/home-vnext/serve.js
```

## PUIS OUVRE

# http://127.0.0.1:8140/

C'est tout. Pas d'installation, pas de téléphone, pas de compte, pas de connexion.
Si le port 8140 est déjà pris, le terminal affiche l'URL réelle à utiliser.

> Si les pages n'existent pas encore (dossier `prototype/home-vnext/out/` vide),
> lance d'abord `node prototype/home-vnext/build.js`, puis relance le serveur.

Pour arrêter : `Ctrl+C` dans le terminal.

---

## Ce que c'est

Une **maquette qui fonctionne** de l'écran d'accueil proposé, en 14 situations de jeu
différentes, à côté du Home actuel, avec les vrais composants et le vrai thème du projet.

C'est le prolongement direct de l'audit de juillet
(`docs/home-audit-2026-07/` dans l'autre worktree) : l'audit disait ce qui ne va pas,
ce prototype montre à quoi ça ressemblerait si on le réparait.

## Ce que ce n'est PAS

- **Ce n'est pas en production.** Le Home actuel de l'app n'a pas bougé d'un octet.
  La preuve chiffrée est dans [`FICHIERS_NON_MODIFIES.md`](FICHIERS_NON_MODIFIES.md).
- **Ce n'est pas branché.** Aucune donnée réelle, aucun Firestore, aucun backend,
  aucune génération de séance. Tous les chiffres et tous les textes sont inventés,
  et chaque page le dit en toutes lettres.
- **Ce n'est pas l'implémentation finale.** C'est une proposition à valider ou à
  refuser, écran par écran, avant qu'une ligne de code de production soit écrite.
- **Ce n'est pas un test sur téléphone.** C'est un rendu dans un navigateur.
  Ce qu'il ne peut pas prouver est listé dans [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md).

---

## Comment naviguer dans le visualiseur

L'écran se lit en trois colonnes.

**À gauche — la liste des situations.** Les 14 situations produit, rangées par famille :
le quotidien, les premiers pas et le retour, ce que l'app sait mesurer, quand ça casse,
avec ou sans club. Plus une 15ᵉ entrée, « Textes longs », qui n'est pas une situation
produit mais un test de résistance de la mise en page.

**Au milieu — l'écran.** Le cadre représente tout l'écran physique du téléphone.
Trois repères sont dessinés par l'outil (ils n'existent pas dans l'app) :

| Repère | Ce que ça veut dire |
|---|---|
| trait gris pointillé en haut | fin de la zone système (heure, batterie, encoche) |
| **trait rouge** | **la ligne de flottaison** : en dessous, il faut faire défiler |
| rectangle hachuré rouge en bas | la barre d'onglets — ce qui est dessous est masqué |

**En haut — les boutons de bascule.**

- **Variante** : `Proposition vNext` / `Home actuel` / `Côte à côte 375`.
  C'est le bouton le plus utile : `Côte à côte` met les deux versions l'une à côté
  de l'autre, même situation, mêmes réglages.
- **Largeur** : `320` (vieil iPhone SE) · `375` (iPhone 13 mini, la référence) ·
  `390` (iPhone récent) · `768` (tablette).
- **Vue** : `Zone visible sans défilement` (ce que le joueur voit vraiment en ouvrant
  l'app — **c'est la vue honnête**) / `Page entière` (tout le contenu, rien n'est coupé —
  vue d'exploration, elle ne montre pas ce que voit le joueur).
- **Texte** : `x1` / `x1.3` — simulation d'un joueur qui a grossi la police de son téléphone.

**À droite — les panneaux.** Quatre onglets : *Points à valider* (les 12 questions sur
lesquelles tu dois te prononcer), *Seuils et limites*, *Cet état* (ce que la maquette
affirme et pourquoi), *Hauteurs*.

Raccourcis clavier : `↑` `↓` changent de situation, `v` change de variante,
`e` change de vue, `p` masque les panneaux.

---

## Les 14 situations, une ligne chacune

| # | Situation | Ce qu'on y regarde |
|---|---|---|
| 1 | **Nouveau joueur** | Compte tout neuf. L'app n'a rien mesuré : elle ne doit rien affirmer. |
| 2 | **Séance prévue aujourd'hui** | Le cas normal. La séance est là, et l'écran dit *pourquoi celle-là*. |
| 3 | **Séance à reprendre** | Séance lancée puis abandonnée en cours de route. |
| 4 | **Séance terminée** | La journée est faite. L'écran doit accuser réception, pas s'éteindre. |
| 5 | **Jour de récupération** | La récup est **prescrite** par le programme, pas devinée par l'écran. |
| 6 | **Jour sans séance prévue** | Rien de prêt, et un match noté demain. |
| 7 | **Reprise après 24 jours** | Le cas le plus fréquent chez un amateur, et le pire aujourd'hui. |
| 8 | **Tendance indisponible** | 2 séances : assez pour agir, pas assez pour tracer une courbe. |
| 9 | **Tendance disponible** | 5 séances : la courbe s'affiche, avec ce sur quoi elle est calculée. |
| 10 | **Erreur de génération** | La préparation a échoué. L'écran le dit et propose de réessayer. |
| 11 | **Hors-ligne** | Ça marche quand même, mais l'écran prévient que ça peut dater. |
| 12 | **Aucune directive club** | Joueur sans club : l'écran est complet, aucun trou. |
| 13 | **Directive club non appliquée** | Le coach a donné une consigne que le moteur n'a pas prise. |
| 14 | **Joueur autonome sans club** | Ni club ni coach : l'écran tient tout seul. |

Le détail — ce que chaque situation **prouve** et l'action attendue — est dans
[`FIXTURES.md`](FIXTURES.md).

---

## Les 4 choses à regarder en priorité

### 1. Le nouveau joueur (situation 1) — c'est le cœur du sujet

Aujourd'hui, un joueur qui vient de s'inscrire lit : « **En forme — prêt à performer** »,
voit une courbe de forme sur 7 jours, et reçoit un reproche sur sa mobilité.
**Rien de tout ça n'est vrai** : ce sont les valeurs d'usine du modèle de charge
(`CTL0 = 15`, `ATL0 = 12`), pas des mesures.

La proposition affiche : *« Ta tendance se construit — fais ta première séance et
dis-nous comment ça s'est passé. »* Une action, une phrase honnête, rien d'autre.

**Mais regarde aussi le vide.** À 375 px, cet écran fait 399 px de contenu dans
729 px disponibles : il reste **330 px de fond nu**. C'est le manque le plus visible
du prototype, et il est assumé — pas comblé avec du remplissage. Voir
[`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md), question ouverte n° 1.

### 2. Le côte à côte sur « Séance prévue » (situation 2)

C'est là qu'on voit la répétition disparaître. À gauche, le Home actuel affiche
**le même bouton deux fois** (le CTA orange en haut, la carte « Prochaine séance » en bas :
même libellé, même destination, même état désactivé — c'est littéralement le même bouton).
Il écrit aussi l'état du jour **trois fois**. À droite, une action, une seule.

Et surtout : la proposition ajoute la ligne qui manque le plus à l'app —
**« Pourquoi : tu as deux jours de charge dans les jambes… »**

### 3. La reprise après 24 jours (situation 7)

Aujourd'hui, après 24 jours sans rien, le Home dit « **Frais — bien reposé** », trace une
courbe parfaitement plate où le trou de 24 jours est invisible, et affiche le cycle figé
sur « Montée en puissance ».

La proposition dit qu'elle ne sait plus, met le cycle en pause, et propose
« Reprendre mon programme ». **Attention à une chose** : le sous-titre est au futur
(« On te préparera une remise en route progressive ») parce que le moteur de reprise
**n'existe pas encore**. C'est honnête, mais ça reste une promesse à tenir avant toute
mise en production.

### 4. La couleur du bouton d'action — à trancher

Le bouton principal actuel est du blanc sur l'orange FKS `#F2741B` :
**contraste 2,88 pour 1**, là où la norme d'accessibilité demande 4,5. C'est le bouton
n° 1 de l'application, et c'est le moins lisible de l'écran.

La proposition utilise `#B4530C` — **le même orange, simplement assombri**
(teinte 25,4° contre 24,8°), mesuré à **5,02 pour 1**. C'est un choix d'identité,
pas une correction technique : **regarde-le et tranche**. Le fichier de couleurs du
projet (`constants/theme.ts`) n'a pas été modifié.

---

## Les autres documents

| Fichier | Ce qu'il contient |
|---|---|
| [`COMPARAISON.md`](COMPARAISON.md) | Actuel contre proposition, chiffres mesurés : hauteurs, blocs, répétitions supprimées |
| [`DECISIONS_VISUELLES.md`](DECISIONS_VISUELLES.md) | Chaque choix de design et sa raison |
| [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md) | Ce qui n'est pas branché, ce que l'outil ne peut pas prouver, les questions ouvertes |
| [`FIXTURES.md`](FIXTURES.md) | Les 14 situations : ce que chacune prouve, l'action attendue |
| [`FICHIERS_NON_MODIFIES.md`](FICHIERS_NON_MODIFIES.md) | La preuve que le produit est intact |
| [`mesures-hauteurs.md`](mesures-hauteurs.md) | Le tableau brut des 60 mesures de hauteur |
| [`captures/`](captures/) | 60 images, si tu veux regarder sans lancer le serveur |

---

## Si tu ne veux pas lancer le serveur

Le dossier [`captures/`](captures/) contient les images. Les plus parlantes :

- `comparaison-seance-prevue-aujourdhui-actuel-vs-vnext-375.png` — le côte à côte
- `comparaison-nouveau-joueur-actuel-vs-vnext-375.png` — l'écran qui arrête d'inventer
- `etat-01` à `etat-14-…-vnext-375-page-entiere.png` — les 14 situations proposées
- `outil-visualiseur-vue-cote-a-cote.png` — à quoi ressemble l'outil

Le détail du nommage est en bas de [`COMPARAISON.md`](COMPARAISON.md).

---

*Prototype produit le 27 juillet 2026 sur la branche `feat/home-vnext-prototype`,
à partir du commit `724c062`. Rien n'est commité, rien n'est poussé, rien n'est fusionné.*
