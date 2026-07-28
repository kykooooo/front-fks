// prototype/home-vnext/lib/pointsAValider.js
// =============================================================================
// LES POINTS SUR LESQUELS LE FONDATEUR DOIT SE PRONONCER
// =============================================================================
// Ce fichier est du CONTENU, pas du code : c'est la liste de questions que le
// visualiseur pose, dans un panneau separe de l'ecran produit.
//
// Chaque point dit trois choses :
//   `regarder` — quoi regarder, concretement, a l'ecran ;
//   `etats`    — dans quel(s) etat(s) le regarder (le visualiseur en fait des
//                boutons qui basculent directement dessus) ;
//   `tranche`  — ce qui vaut « c'est bon » et ce qui vaut « non ».
//
// Ecrit pour quelqu'un qui n'ecrit pas de code. Pas de jargon, pas de nom de
// fichier, pas de nom de composant.
// =============================================================================
"use strict";

const POINTS = [
  {
    id: "action-principale",
    titre: "L'action principale",
    regarder:
      "Compte les boutons pleins (fond colore) sur l'ecran. Il doit y en avoir UN, jamais deux. " +
      "Regarde ensuite si ce bouton propose bien la seule chose qui a du sens aujourd'hui.",
    etats: ["seance-prevue-aujourdhui", "seance-a-reprendre", "seance-terminee", "jour-sans-seance"],
    tranche:
      "OUI si un seul bouton plein, et si la meme action n'est jamais proposee une deuxieme " +
      "fois plus bas. NON si tu vois deux aplats colores, ou si l'action du haut est repetee " +
      "en bas sous un autre nom.",
  },
  {
    id: "hierarchie",
    titre: "Ce que tu vois au premier regard",
    regarder:
      "Ouvre l'ecran, regarde-le une seconde, puis detourne les yeux. Qu'est-ce qui est reste ? " +
      "Le bon ordre attendu : ce que je fais aujourd'hui, pourquoi, ou j'en suis.",
    etats: ["seance-prevue-aujourdhui", "jour-recuperation"],
    tranche:
      "OUI si la premiere chose retenue est l'action du jour. NON si c'est un chiffre, une " +
      "courbe, ou si rien ne ressort parce que tout a le meme poids.",
  },
  {
    id: "avant-defilement",
    titre: "La quantite d'information avant de faire defiler",
    regarder:
      "Mets-toi en vue « zone visible sans defilement », largeur 375. Ce qui est au-dessus de " +
      "la ligne rouge, c'est tout ce que le joueur voit en ouvrant l'app.",
    etats: ["seance-prevue-aujourdhui", "tendance-disponible"],
    tranche:
      "OUI si l'action et son « pourquoi » tiennent au-dessus de la ligne, sans que l'ecran " +
      "soit charge. NON s'il faut defiler pour savoir quoi faire, ou si tout est tasse.",
  },
  {
    id: "repetitions",
    titre: "Les repetitions ont disparu",
    regarder:
      "Cherche la meme information ecrite deux fois : le cycle affiche en haut ET en bas, le " +
      "compteur de la semaine repete, la prochaine seance annoncee a deux endroits.",
    etats: ["seance-prevue-aujourdhui", "joueur-autonome-sans-club"],
    tranche:
      "OUI si chaque information n'apparait qu'une fois. NON si tu retrouves un doublon — " +
      "compare avec l'onglet « Home actuel », c'est la que se voit la difference.",
  },
  {
    id: "pourquoi",
    titre: "Le « pourquoi cette seance »",
    regarder:
      "Lis la ligne sous l'action. Elle doit expliquer la seance d'aujourd'hui avec des mots " +
      "qui viennent vraiment de la seance preparee. Elle disparait quand il n'y a rien a dire.",
    etats: ["seance-prevue-aujourdhui", "jour-recuperation", "hors-ligne", "jour-sans-seance"],
    tranche:
      "OUI si la phrase t'apprend quelque chose et sonne comme un coach. NON si elle est " +
      "generique (« reste regulier »), si elle repete le titre de la seance, ou si elle est " +
      "presente alors que l'app n'a rien a dire.",
  },
  {
    id: "ma-semaine",
    titre: "« Ma semaine »",
    regarder:
      "Le bloc de la semaine doit repondre a une seule question : ou j'en suis par rapport a ce " +
      "que je me suis fixe. Verifie qu'il ne compte QUE des seances FKS terminees, et qu'il ne " +
      "reproche rien quand le compte est bas.",
    etats: ["seance-prevue-aujourdhui", "seance-terminee", "jour-recuperation"],
    tranche:
      "OUI si un joueur a 0 sur 2 un lundi matin ne se sent pas en faute. NON si le ton est " +
      "accusateur, ou si le chiffre melange des seances club supposees et des seances faites.",
  },
  {
    id: "sans-donnees",
    titre: "L'etat quand l'app ne sait pas encore",
    regarder:
      "Regarde l'etat « Nouveau joueur » et « Tendance indisponible ». L'app doit dire " +
      "franchement qu'elle n'a pas encore de quoi mesurer, sans courbe inventee et sans " +
      "etiquette de forme.",
    etats: ["nouveau-joueur", "tendance-indisponible"],
    tranche:
      "OUI si tu lis quelque chose comme « ta tendance se construit » et qu'aucune courbe ne " +
      "s'affiche. NON si une courbe apparait quand meme, ou si l'app annonce « En forme » " +
      "alors qu'elle ne sait rien.",
  },
  {
    id: "reprise",
    titre: "La reprise apres une coupure",
    regarder:
      "Etat « Reprise apres interruption longue » : 24 jours sans rien. L'ecran ne doit ni " +
      "annoncer que le joueur est frais, ni reprendre le programme la ou il s'etait arrete " +
      "comme si de rien n'etait, ni faire la morale.",
    etats: ["reprise-longue-interruption"],
    tranche:
      "OUI si l'action propose de reprendre le programme et si l'app annonce qu'une reprise " +
      "progressive SERA preparee (au futur : le moteur n'est pas branche). NON si tu lis " +
      "« bien repose », ou si le cycle continue comme avant, ou si le ton culpabilise.",
  },
  {
    id: "moitie-basse",
    titre: "La moitie basse de l'ecran",
    regarder:
      "Passe en vue « page entiere » et regarde uniquement ce qui est sous la ligne rouge. " +
      "Chaque bloc doit meriter sa place.",
    etats: ["seance-prevue-aujourdhui", "tendance-disponible", "joueur-autonome-sans-club"],
    tranche:
      "OUI si tout ce qui est en bas apporte quelque chose de neuf. NON si tu tombes sur du " +
      "remplissage, une metrique de decoration, ou une repetition du haut.",
  },
  {
    id: "fin-ecran",
    titre: "La fin de l'ecran",
    regarder:
      "Descends jusqu'en bas. L'ecran doit finir TOT et NET : pas de grande carte finale, pas " +
      "de deuxieme bouton plein, pas de vide enorme, rien qui passe sous la barre d'onglets.",
    etats: ["seance-terminee", "directive-club-absente", "tendance-disponible"],
    tranche:
      "OUI si la derniere chose est un simple lien texte et que l'ecran s'arrete la. NON s'il " +
      "reste une grande zone vide, ou si un contenu se fait couper par la barre du bas.",
  },
  {
    id: "coherence",
    titre: "La coherence avec le reste de l'app",
    regarder:
      "Compare l'allure generale (coins des cartes, taille des titres, couleur des liens) avec " +
      "les ecrans que tu connais : preparation de seance, routines. Le prototype doit avoir " +
      "l'air du meme produit, pas d'une autre app.",
    etats: ["seance-prevue-aujourdhui", "joueur-autonome-sans-club"],
    tranche:
      "OUI si ca ressemble a FKS en plus propre. NON si l'orange a change au point de ne plus " +
      "etre reconnaissable, ou si les cartes ont une forme inhabituelle. Le panneau « Seuils et " +
      "limites » donne l'orange propose et son ecart avec l'actuel.",
  },
  {
    id: "petit-ecran",
    titre: "Le comportement en 320 px",
    regarder:
      "Bascule la largeur sur 320. C'est le plus petit telephone encore utilise. Regarde les " +
      "textes longs, les pastilles, le bouton principal.",
    etats: ["seance-prevue-aujourdhui", "jour-recuperation", "reprise-longue-interruption"],
    tranche:
      "OUI si rien ne deborde, si aucun mot n'est coupe bizarrement et si le bouton reste " +
      "lisible. NON si un element sort du cadre ou si un texte devient illisible. Regarde aussi " +
      "la variante « texte x1,3 » en 375 : c'est le meme test, pour un joueur qui a grossi la " +
      "police de son telephone.",
  },
];

// =============================================================================
// VARIANTE 2 — LA CARTE PROGRESSION
// =============================================================================
// Meme forme que ci-dessus, meme public. Ces points ne portent QUE sur le bas de
// l'ecran : la variante 2 ne change rien au-dessus de « Ma semaine ».
//
// Les identifiants d'etats sont ceux de la variante 2 (prefixe `v2-`) : les
// boutons du visualiseur basculent donc directement sur le bon ecran, avec la
// bonne variante.
// =============================================================================
const POINTS_PROGRESSION = [
  {
    id: "carte-remplace-lien",
    titre: "La carte remplace-t-elle vraiment le lien flottant ?",
    regarder:
      "Mets-toi en « Cote a cote », paire « vNext / Progression integree », largeur 375. A gauche, " +
      "tout en bas : un petit lien texte « Voir ma progression » qui flotte sous le dernier bloc. " +
      "A droite : une carte a la place. Descends jusqu'en bas des deux colonnes et compare la fin " +
      "des deux ecrans.",
    etats: ["v2-tendance-disponible", "v2-aucune-comparaison-de-test", "v2-deux-seances-tendance-indisponible"],
    tranche:
      "Les MEMES MOTS des deux cotes, ce n'est pas un oubli : le lien mene au meme ecran, il a " +
      "donc garde son libelle. Ce qui change est sa PLACE. OUI si, a droite, plus rien ne flotte " +
      "sous les cartes — le lien est devenu le pied d'une carte, dans la meme surface — et si ce " +
      "qui l'entoure t'apprend quelque chose que tu ne savais pas en regardant le haut de " +
      "l'ecran. NON si les deux coexistent (un lien flottant ET la carte : on aurait ajoute au " +
      "lieu de remplacer), ou si la carte ne fait que renvoyer ailleurs sans rien dire — dans ce " +
      "cas le lien texte faisait le meme travail pour dix fois moins de place. Le panneau « Cet " +
      "etat » compte le lien flottant pour toi.",
  },
  {
    id: "detail-secondaire",
    titre: "Le pied « Voir ma progression » reste-t-il secondaire ?",
    regarder:
      "Sur les etats qui l'affichent, compare le poids visuel du pied « Voir ma progression », " +
      "en bas de la carte, et celui du bouton d'action du jour, tout en haut. Puis compte les " +
      "aplats colores de l'ecran entier. Sur « Aucune comparaison », lis aussi le lien « Voir le " +
      "detail » place sous l'action du jour : lui ouvre LA SEANCE, le pied ouvre LA PROGRESSION. " +
      "Deux destinations, deux libelles — ils portaient les memes mots il y a une version.",
    etats: ["v2-tendance-disponible", "v2-test-physique-ameliore", "v2-aucune-comparaison-de-test"],
    tranche:
      "OUI s'il n'y a qu'UN SEUL aplat colore sur tout l'ecran (celui du haut), si le pied est un " +
      "simple lien texte, et si tu sais ou chaque lien t'emmene SANS avoir a taper dessus. NON " +
      "des qu'un deuxieme fond colore apparait en bas, meme discret — l'oeil irait vers lui au " +
      "lieu d'aller vers l'action du jour — ou si deux liens du meme ecran te semblent encore " +
      "dire la meme chose.",
  },
  {
    id: "detail-absent",
    titre: "L'absence de bouton quand la page ne vaut pas le voyage",
    regarder:
      "Sur « Nouveau joueur » et « Deux seances », il ne doit y avoir AUCUN bouton vers la page " +
      "Progression. C'est volontaire : sur ces deux etats, cette page n'affiche que des chiffres " +
      "faux (une forme calculee sur des valeurs de demarrage, six accomplissements tous " +
      "verrouilles, un calendrier vide). Le panneau « Cet etat » donne le motif exact.",
    etats: ["v2-nouveau-joueur", "v2-deux-seances-tendance-indisponible", "v2-donnee-manquante"],
    tranche:
      "OUI si tu ne trouves aucun lien vers le detail sur ces etats, et si tu es d'accord avec le " +
      "motif. NON si tu penses qu'il faut quand meme laisser le joueur y aller — dis-le, c'est " +
      "une decision de produit, elle se change en une ligne.",
  },
  {
    id: "collecting-dense",
    titre: "L'etat « ca se construit » : des faits, pas du decor",
    regarder:
      "Etat « Deux seances ». Lis la carte ligne par ligne. Chaque ligne doit etre un CHIFFRE " +
      "reellement mesure : 2 seances terminees, 76 minutes realisees, 2 ressentis enregistres, " +
      "encore 2 seances avant une tendance. Rien d'autre.",
    etats: ["v2-deux-seances-tendance-indisponible", "v2-donnee-manquante"],
    tranche:
      "OUI si tout ce que tu lis est un fait verifiable, et si le « encore 2 » te dit clairement " +
      "ce qui debloquera la suite. NON si tu trouves une image, une barre de progression " +
      "decorative, un encouragement generique, ou une metrique que rien ne mesure vraiment.",
  },
  {
    id: "empty-sans-inventer",
    titre: "L'etat « compte tout neuf » : promettre sans inventer",
    regarder:
      "Etat « Nouveau joueur ». La carte doit expliquer ce qui APPARAITRA, en trois reperes " +
      "numerotes, et dire franchement qu'il n'y a encore rien. Cherche un chiffre : il ne doit y " +
      "en avoir aucun, sauf le « 0 seance terminee » de la mention.",
    etats: ["v2-nouveau-joueur"],
    tranche:
      "OUI si tu comprends en trois secondes ce que la carte te montrera dans deux semaines, sans " +
      "qu'elle affiche une seule mesure fabriquee. NON si tu vois un graphique gris en attente, " +
      "un « -- », un « 0 min », une jauge a zero ou un objectif que personne n'a fixe.",
  },
  {
    id: "r1-donnee-manquante",
    titre: "Quand une donnee n'existe pas, le fait disparait",
    regarder:
      "Etat « Donnee manquante ». Trois seances terminees, mais aucune duree connue et aucun " +
      "ressenti enregistre. Compare avec « Deux seances », qui a les quatre lignes.",
    etats: ["v2-donnee-manquante", "v2-deux-seances-tendance-indisponible"],
    tranche:
      "OUI s'il ne reste que deux lignes, et si les lignes « minutes » et « ressentis » ont " +
      "purement disparu. NON si tu lis « 0 min », « -- », « 0 ressenti » ou une ligne vide : un " +
      "zero affiche a la place d'une donnee absente, c'est un chiffre faux.",
  },
  {
    id: "portee-tendance",
    titre: "La courbe dit sur quoi elle est calculee",
    regarder:
      "Sur les etats qui tracent une courbe, cherche la phrase de portee juste a cote : elle doit " +
      "dire que le calcul ne porte QUE sur les seances FKS et que les entrainements club n'y sont " +
      "pas comptes. Le panneau « Seuils et limites » la rappelle pour l'etat courant.",
    etats: ["v2-tendance-disponible", "v2-test-physique-ameliore", "v2-aucune-comparaison-de-test"],
    tranche:
      "OUI si la phrase est lisible sans effort, a cote de la courbe. NON si elle est absente, " +
      "reduite a une note minuscule, ou si la carte annonce un etat de forme general (« en " +
      "forme », « pret a performer ») : tant que les entrainements club ne sont pas captures, " +
      "l'app ne sait pas dans quel etat tu es.",
  },
  {
    id: "deux-courbes",
    titre: "Deux courbes sur le meme ecran",
    regarder:
      "Sur « Tendance disponible », l'ecran porte le bloc « Ma forme » ET la carte progression. " +
      "Les deux tracent une trajectoire. Regarde l'ecran en entier et demande-toi laquelle des " +
      "deux tu garderais.",
    etats: ["v2-tendance-disponible", "v2-test-physique-ameliore"],
    tranche:
      "Ce point n'a pas de bonne reponse ecrite d'avance : c'est a toi de trancher. Les trois " +
      "options sont : garder les deux (l'une resume la semaine, l'autre le cumul), retirer la " +
      "courbe du haut, ou retirer celle de la carte. ATTENTION sur « Test physique ameliore » : " +
      "les deux courbes n'y tracent pas la meme serie, c'est un artefact d'assemblage du " +
      "prototype signale en rouge. Juge la place des blocs, pas la forme des traces.",
  },
  {
    id: "comparaison-tests",
    titre: "La comparaison de tests, dans les deux sens",
    regarder:
      "Trois ecrans, dans cet ordre. « Test physique ameliore » : la carte affiche le SPRINT " +
      "10 m, 1,85 s -> 1,78 s, soit « -0,07 s » — un chiffre negatif qui est une bonne nouvelle, " +
      "parce que sur un sprint mieux veut dire plus petit. « Tendance disponible » : l'autre " +
      "sens, un saut en longueur 205 -> 214 cm, « +9 cm ». Puis « Aucune comparaison » : quatre " +
      "tests enregistres et pourtant rien a comparer, parce qu'aucun exercice n'a ete refait un " +
      "autre jour.",
    etats: ["v2-test-physique-ameliore", "v2-tendance-disponible", "v2-aucune-comparaison-de-test"],
    tranche:
      "OUI si le « -0,07 s » du sprint se lit sans hesiter comme une AMELIORATION — c'est le mot " +
      "« en progres » qui doit faire ce travail, jamais une fleche —, si le « +9 cm » se lit " +
      "aussi clairement, et si l'etat sans comparaison explique ce qui manque au lieu d'afficher " +
      "un bloc vide. NON si un chiffre negatif ressemble a une regression, ou si l'absence de " +
      "comparaison passe pour un bug.",
  },
  {
    id: "pastille-etat-du-jour",
    titre: "La pastille « En forme » de l'en-tete — retiree en variante 2",
    regarder:
      "Mets-toi en « Cote a cote » sur « Tendance disponible », largeur 375, et regarde le HAUT " +
      "des deux colonnes. A gauche (variante 1), une pastille annonce ton etat du jour : « En " +
      "forme ». A droite (variante 2), elle n'y est plus. Descends ensuite jusqu'a la courbe de " +
      "la colonne de droite et lis la phrase sous le trace : « Calcule sur tes seances FKS " +
      "uniquement — tes entrainements club n'y sont pas comptes. »",
    etats: ["v2-tendance-disponible", "v2-test-physique-ameliore", "v2-aucune-comparaison-de-test"],
    tranche:
      "C'est TA regle, appliquee telle que tu l'as ecrite : ne pas annoncer un etat physique " +
      "global tant que les entrainements club et les autres charges ne sont pas reellement " +
      "connus. La variante 1 la garde, pour que tu puisses comparer. OUI si l'ecran de droite te " +
      "parait plus honnete sans elle. NON si l'en-tete te semble desormais trop nu — dans ce cas " +
      "une 3e voie existe, et elle n'a PAS ete prise a ta place : une pastille reformulee, " +
      "explicitement limitee aux seances FKS (par exemple « Charge FKS : moderee »), qui " +
      "n'affirmerait plus rien sur ton etat global. Ce serait un libelle nouveau, donc une " +
      "decision de produit, pas une correction technique.",
  },
  {
    id: "fin-ecran-variante2",
    titre: "La fin de l'ecran, avec la carte",
    regarder:
      "Vue « page entiere », largeur 375, puis 320. La carte est le dernier bloc : regarde ce qui " +
      "se passe apres elle. Compare avec la variante 1, dont l'ecran finissait sur un simple lien.",
    etats: ["v2-tendance-disponible", "v2-test-physique-ameliore", "v2-nouveau-joueur"],
    tranche:
      "OUI si l'ecran finit net juste apres la carte, sans grand vide et sans rien qui passe sous " +
      "la barre d'onglets. NON si la carte rallonge tellement l'ecran qu'il faut defiler " +
      "longtemps pour l'atteindre — dans ce cas elle coute plus qu'elle ne rapporte. Le panneau " +
      "« Hauteurs » chiffre la difference entre les deux variantes.",
  },
  {
    id: "petit-ecran-variante2",
    titre: "La carte en 320 px et en texte x1,3",
    regarder:
      "Passe chacun des cinq cas en largeur 320, puis reviens en 375 avec « Texte x1.3 ». Regarde " +
      "les lignes de faits (libelle a gauche, chiffre a droite), la courbe et le lien de detail.",
    etats: [
      "v2-deux-seances-tendance-indisponible",
      "v2-test-physique-ameliore",
      "v2-tendance-disponible",
      "v2-nouveau-joueur",
      "v2-aucune-comparaison-de-test",
    ],
    tranche:
      "OUI si aucun chiffre ne passe a la ligne tout seul, si aucun libelle n'est coupe et si la " +
      "courbe garde une hauteur lisible. NON si une ligne de fait se casse en deux, si un ecart " +
      "de test deborde, ou si la carte devient plus haute que l'ecran a elle seule.",
  },
];

module.exports = { POINTS, POINTS_PROGRESSION };
