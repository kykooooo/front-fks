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

module.exports = { POINTS };
