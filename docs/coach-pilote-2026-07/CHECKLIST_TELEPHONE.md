# Checklist téléphone — espace coach

**Date** : 27 juillet 2026
**Pour** : Kyllian
**À faire** : sur un **vrai téléphone**, une case à la fois, en cochant.
**Durée** : environ 25 minutes si tout va bien.

---

## Avant de commencer : ce qu'un navigateur ne prouve PAS

L'aperçu web (`react-native-web`) sert à voir la structure d'un écran. Il ne
prouve **rien** sur iOS ou Android. Ce n'est pas une précaution de principe,
c'est une liste de choses qui diffèrent réellement :

| Ce que le web montre | Ce que le téléphone fait vraiment |
|---|---|
| une police de bureau substituée | San Francisco (iOS) / Roboto (Android) — **les textes ne se coupent pas au même endroit** |
| des retours à la ligne « à peu près » | quelques pourcents d'écart suffisent à faire passer un libellé de 2 à 3 lignes, donc à le tronquer |
| pas de vrai en-tête natif | encoche, barre d'état, geste de retour, barre du bas : autant de hauteur en moins |
| pas de « tirer pour actualiser » | le geste existe et peut entrer en conflit avec un défilement |
| animations figées ou instantanées | durées réelles, et le rendu pendant l'animation |
| souris | **le doigt**, qui mesure 44 points de large et cache ce qu'il touche |

> **Règle** : si une ligne de cette checklist est cochée depuis un navigateur,
> elle n'est pas cochée.

**Préparer avant** : un club pilote avec au moins **3 joueurs**, dont **un
mineur en attente d'autorisation** et **un joueur sans aucune séance**.

---

## A. Le socle — 8 vérifications sur tous les écrans coach

À faire sur **Aujourd'hui**, **Effectif**, **Semaine** et **une fiche joueur**.

| # | Ce qu'on fait | Ce qu'on doit voir | Ce qui serait un échec |
|---|---|---|---|
| A1 | Ouvrir chaque écran sur un **téléphone étroit** (iPhone SE ou équivalent) | Tout tient en largeur, rien ne déborde | Un texte coupé au milieu d'un mot, un chiffre à moitié sorti de sa carte |
| A2 | Régler la police système sur **normale**, faire le tour | Lecture confortable, titres sur 1 ou 2 lignes | — |
| A3 | Régler la police sur **la plus grande** (Réglages → Affichage → Taille du texte), refaire le tour | Les textes s'agrandissent, les cartes s'étirent en hauteur | Un texte **écrasé** ou tronqué avec « … » alors qu'il tenait avant ; deux lignes qui se chevauchent ; un bouton qui sort de l'écran |
| A4 | **Faire défiler les filtres horizontaux** de l'Effectif jusqu'au bout | On sent qu'il y a une suite (voile sur le bord droit), et on atteint la dernière puce | Des filtres invisibles sans aucun indice qu'ils existent — c'est le défaut corrigé, il faut vérifier qu'il l'est |
| A5 | **Scroller jusqu'en bas** de chaque écran | On atteint réellement le dernier élément, rien n'est coincé sous la barre d'onglets | Une carte à moitié cachée derrière la barre du bas |
| A6 | Appuyer sur **chaque bouton et chaque ligne cliquable** | Chaque appui répond du premier coup | Devoir viser ; deux zones tactiles collées ; une carte qui a l'air cliquable mais ne l'est pas |
| A7 | Regarder les écrans **en plein soleil ou en luminosité basse** | Tous les textes restent lisibles, y compris les mentions grises | Une mention en gris clair sur fond sombre illisible |
| A8 | Vérifier qu'**aucune information n'est masquée** : chaque chiffre affiché a son libellé et son unité visibles en entier | « Exercices réalisés · 79 % · part des exercices prévus » entièrement lisible | Le libellé tronqué à « Exercices réali… » |

---

## B. La fiche joueur — le cœur du sujet

| # | Ce qu'on fait | Ce qu'on doit voir | Ce qui serait un échec |
|---|---|---|---|
| B1 | Ouvrir la **fiche complète** d'un joueur actif | Prénom, catégorie, statut, séance prévue, séance faite, provenance de chaque information | Un bloc vide sans explication |
| B2 | Comparer **prévu vs réalisé** | Les deux séances apparaissent côte à côte et sont clairement nommées (« prévue » / « faite ») | Une seule des deux, ou impossible de dire laquelle est laquelle |
| B3 | Lire le bloc **« Détail du réalisé »** | Aujourd'hui, avant la boucle de suivi : « **Détail du réalisé pas encore disponible** » + explication + provenance | Des compteurs à **zéro** — un « 0 exercice sauté » se lit comme « il n'a rien fait » alors qu'on ne sait rien |
| B4 | *(après merge de la boucle uniquement)* Refaire **le calcul de tête** à partir des chiffres affichés | Les catégories + le total + la phrase de règle redonnent le pourcentage affiché | Le calcul ne retombe pas — dans ce cas l'écran est censé refuser d'afficher la formule, pas en montrer une fausse |
| B5 | Ouvrir la fiche d'un joueur **sans aucune donnée** | Un état franc qui distingue « pas encore de donnée » de « erreur » | « 0 séance » présenté comme une mesure |
| B6 | Vérifier la ligne de **fraîcheur** (« Mis à jour à … ») | Elle existe, et elle **bouge** quand on laisse l'écran ouvert quelques minutes | Un « Mis à jour à l'instant » figé pendant 20 minutes |
| B7 | Chercher un signal lié à la **douleur ou la fatigue** | **On ne doit en trouver aucun**, nulle part | La moindre mention de douleur, de fatigue, de RPE ou de forme |

---

## C. Recherche et clavier (Effectif)

| # | Ce qu'on fait | Ce qu'on doit voir | Ce qui serait un échec |
|---|---|---|---|
| C1 | Toucher le champ de recherche | Le clavier monte **sans cacher le champ** ni la première ligne de résultats | Le champ passe sous le clavier |
| C2 | Taper 2-3 lettres d'un prénom | La liste se filtre au fur et à mesure | Un temps mort perceptible, ou un clignotement de la liste complète |
| C3 | Taper une recherche **sans résultat** | Un message qui dit **ce qui a été cherché** et où retrouver les autres | « Aucun résultat » tout court, qui laisse croire à un effectif vide |
| C4 | Fermer le clavier (bouton « OK » / geste vers le bas) | Il se ferme, la liste reste filtrée | La recherche se vide toute seule |
| C5 | Chercher un prénom **accentué** (Rémi, Noé) | Trouvé | Non trouvé à cause de l'accent |

---

## D. Cartes longues, données absentes, réseau

| # | Ce qu'on fait | Ce qu'on doit voir | Ce qui serait un échec |
|---|---|---|---|
| D1 | Trouver (ou provoquer) une carte au **titre de séance long** | Le titre se coupe proprement sur 2 lignes maximum | Le titre pousse le reste de la carte hors de l'écran |
| D2 | Passer le téléphone en **mode avion**, rouvrir l'espace coach | Un message d'erreur **en français**, qui distingue « pas de réseau » de « pas autorisé » | Un texte anglais type *Missing or insufficient permissions* |
| D3 | Repasser en ligne, **tirer pour actualiser** | Les données reviennent, la ligne de fraîcheur se met à jour | Le geste ne fait rien, ou déclenche un défilement au lieu d'actualiser |
| D4 | Depuis une fiche joueur, faire **retour arrière** (geste ET bouton) | On revient sur la liste, au même endroit du défilement, avec le même filtre | Retour à la première ligne, ou filtre réinitialisé |
| D5 | Quitter l'app, la rouvrir | On retrouve l'espace coach dans un état cohérent | Un écran blanc, ou un chargement infini |

---

## E. Spécifique à ce chantier — les 4 points à ne pas rater

### E1. Le code club ne s'affiche **qu'une seule fois**

C'est le changement le plus visible pour un coach, et le plus facile à rater.

| Ce qu'on fait | Ce qu'on doit voir | Ce qui serait un échec |
|---|---|---|
| Onglet **Semaine** → carte « Code club », avant toute génération | « Aucun code affiché. Un code n'est visible qu'au moment où tu le génères… » | Un ancien code affiché — il ne devrait plus être lisible nulle part |
| Appuyer sur **« Générer un code »** | Le code apparaît en grand, avec **« Note-le ou partage-le maintenant : il ne sera plus affiché. »**, la date de validité et le nombre d'usages | Le code apparaît sans cet avertissement |
| **Copier le code** : appui long sur le code, puis « Partager » | L'appui long sélectionne le texte (le code est `selectable`) **et** le bouton Partager ouvre le partage système avec le code dedans | Impossible de sélectionner, et bouton Partager qui n'ouvre rien → **le coach ne peut pas récupérer son code, il est perdu** |
| Quitter l'onglet, y revenir | Le code a **disparu** (c'est voulu) et l'écran le dit | Le code réapparaît (ce serait la fuite qu'on vient de fermer) |
| Générer un **deuxième** code | « L'ancien code ne fonctionne plus. Les joueurs déjà dans l'effectif y restent. » | Aucun avertissement sur la révocation du précédent |

### E2. Un joueur **en attente d'autorisation**

| Ce qu'on fait | Ce qu'on doit voir | Ce qui serait un échec |
|---|---|---|
| Ouvrir l'**Effectif** avec au moins un joueur non autorisé | Un bandeau dédié qui explique, et le joueur **compté dans l'effectif** | Le joueur disparu sans un mot — le coach croirait qu'il a quitté le club |
| Lire le texte du bandeau | Il dit que le joueur **fait partie de l'effectif** et **peut s'entraîner normalement** | Un ton alarmant, un vocabulaire juridique ou médical, ou quoi que ce soit qui laisse croire que le joueur ne s'entraîne pas |
| Ouvrir la fiche de ce joueur | Un état neutre « accès non autorisé », **de la couleur neutre** de la hiérarchie existante | Une cinquième couleur, une alerte rouge |
| Cas extrême : **tout l'effectif** non autorisé | Le bandeau, et **surtout pas** « Aucun joueur dans l'effectif » | Le message « effectif vide » — il serait faux |

### E3. Un **code refusé** ne doit PAS faire perdre le questionnaire

À faire **côté joueur**, sur un compte de test neuf.

| Ce qu'on fait | Ce qu'on doit voir | Ce qui serait un échec |
|---|---|---|
| Remplir tout le questionnaire d'inscription, saisir un **code volontairement faux**, valider | Le profil est **enregistré**, et un message français dit que **seul le code** n'a pas fonctionné, avec où réessayer | « Impossible d'enregistrer le profil » — et le questionnaire perdu. C'est exactement le défaut corrigé, il faut le vérifier |
| Recommencer avec le **téléphone en mode avion** | Même résultat : profil enregistré, message sur le code seul | Une perte de saisie |
| Depuis Profil → réglages, ressaisir un **bon** code | Rattachement au club sans avoir à ressaisir quoi que ce soit | Devoir refaire le questionnaire |
| Regarder le message d'un code **expiré** vs **inexistant** | Les deux messages sont **identiques** (le serveur ne dit pas pourquoi, par conception) | Un message qui distingue les deux — ça aiderait un fraudeur |

### E4. Les libellés qui ont **changé** — le coach pilote verra la différence

Certaines mentions **ont disparu de l'écran coach**, volontairement : toutes
celles dont l'origine pouvait trahir une douleur, une fatigue ou un ressenti du
joueur. Les fourre-tout historiques (« intensité plafonnée », « durée réduite »)
n'existent plus, parce qu'ils attrapaient aussi bien un plafond lié à l'âge qu'un
plafond lié à la fatigue.

| Ce qu'on fait | Ce qu'on doit voir | Ce qui serait un échec |
|---|---|---|
| Ouvrir plusieurs fiches et l'onglet Semaine | Les seules adaptations affichées sont celles dont la cause est **nommée** : calendrier de match, entraînement club, catégorie d'âge, décharge de cycle, consigne du coach | Une mention vague type « séance allégée » sans cause nommée |
| Vérifier le vocabulaire | « **Séance ajustée par FKS** » quand c'est le moteur ; « le joueur a adapté / sauté / remplacé » quand ce sera le joueur | Les deux confondus — le coach lirait un comportement du joueur là où c'est FKS qui a décidé |
| Comparer avec ce que le coach pilote voyait avant | **Il y a moins de lignes qu'avant.** C'est normal | Le prendre pour une régression : à expliquer au coach **avant** la bascule |

> **Note pour l'appel au coach pilote** : trois choses changent pour lui le même
> jour — le code club ne se relit plus, certains joueurs deviennent temporairement
> non consultables, et certaines mentions d'adaptation disparaissent. Les trois
> sont volontaires. Les annoncer avant coûte cinq minutes ; les laisser découvrir
> coûte la confiance.

---

## F. Ce qu'on ne peut PAS valider ici

À dire franchement plutôt qu'à laisser croire coché :

1. **Tablette et web** : la mise en page s'y adapte, mais cette checklist est
   écrite pour un téléphone. Une passe tablette est un exercice séparé.
2. **L'approbation d'un joueur mineur** : elle se fait **à la main dans la
   console Firebase**, il n'existe aucun écran. Ce qui se vérifie ici, c'est
   seulement que l'app **réagit** correctement au changement (le joueur apparaît
   sans avoir à rafraîchir).
3. **La boucle de suivi joueur** : tant qu'elle n'est pas mergée, les lignes B4
   et une partie de E4 ne peuvent pas être cochées — c'est le cas nominal, pas
   une panne.
4. **Le vrai volume** : trois joueurs de test ne disent rien du confort de
   lecture d'un effectif de trente. À revérifier dès qu'un club réel est chargé.

---

## Feuille de score

```
A. Socle            A1 ☐  A2 ☐  A3 ☐  A4 ☐  A5 ☐  A6 ☐  A7 ☐  A8 ☐
B. Fiche joueur     B1 ☐  B2 ☐  B3 ☐  B4 ☐  B5 ☐  B6 ☐  B7 ☐
C. Recherche        C1 ☐  C2 ☐  C3 ☐  C4 ☐  C5 ☐
D. Cartes/réseau    D1 ☐  D2 ☐  D3 ☐  D4 ☐  D5 ☐
E. Ce chantier      E1 ☐  E2 ☐  E3 ☐  E4 ☐
```

**Une seule case rouge suffit à ne pas déployer.** C'est l'étape 5 du plan
d'intégration (`docs/coach-pilote-2026-07/INTEGRATION_BOUCLE.md` §4).
