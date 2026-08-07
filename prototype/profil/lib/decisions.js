// prototype/profil/lib/decisions.js
// =============================================================================
// LA LISTE FERMEE DES DECISIONS — ce que le fondateur doit trancher, rien d'autre
// =============================================================================
// Cinq decisions, chacune avec ses options, ses consequences et une
// recommandation argumentee. Le visualiseur les affiche dans l'onglet
// « Décisions » ; pour D1 il pose la bascule de variante d'un clic.
//
// Chaque `cout` cite la mesure quand elle existe (le « ~700 pt » de la carte
// club vient d'AUDIT_PROFIL.md, section 2). Quand il n'y a pas de mesure, le
// cout est nomme sans chiffre — on ne fabrique pas un nombre pour faire serieux.
// =============================================================================
"use strict";

const DECISIONS = [
  {
    id: "D1",
    titre: "Lignes de contrôle : pures ou informées ?",
    question:
      "Une ligne de contrôle (« Mon cycle », « Tests terrain », « Mon club ») porte-t-elle un " +
      "fait d'état sous son libellé, ou seulement le libellé et sa flèche ? Se juge sur la " +
      "bascule de variante du visualiseur : mêmes données, deux rendus.",
    options: [
      {
        id: "pur",
        libelle: "Contrôle pur",
        consequences:
          "Zéro chiffre sur l'écran, zéro redite possible avec le Home. Coût : « Mon cycle » ne " +
          "dit pas où on en est, « Tests terrain » ne dit pas de quand date le dernier relevé — " +
          "il faut taper pour savoir.",
      },
      {
        id: "informe",
        libelle: "Contrôle informé",
        consequences:
          "Un fait par ligne, calculé par l'implémentation qui fait foi ailleurs — l'arithmétique " +
          "du Home pour le cycle (getMicrocyclePhase), la source canonique des tests " +
          "(useTestsStorage), la résolution serveur du club. Coût : redite assumée avec le Home, " +
          "mais jamais divergente par construction — les deux écrans appellent le même code.",
      },
    ],
    recommandation: "informe",
    cout:
      "Pas de mesure chiffrée : le coût du « pur » est une information en moins par ligne, celui " +
      "de l'« informé » une ligne un peu plus haute. La bascule du visualiseur montre les deux " +
      "sur les mêmes données.",
  },
  {
    id: "D2",
    titre: "La carte Rythme doit-elle taper vers le setup quand une valeur est « À définir » ?",
    question:
      "Quand « FKS / sem », « Club / sem » ou « Matchs / sem » n'est pas déclaré, la tuile " +
      "doit-elle être tappable et mener au setup — ou l'édition passe-t-elle uniquement par la " +
      "ligne « Modifier mon profil » ?",
    options: [
      {
        id: "non-tappable",
        libelle: "Non tappable",
        consequences:
          "Une seule porte d'édition : la ligne « Modifier mon profil ». L'écran est plus " +
          "prévisible, mais une valeur manquante ne se répare pas là où on la voit.",
      },
      {
        id: "tappable-si-vide",
        libelle: "Tappable quand la valeur manque",
        consequences:
          "Le pattern actuel du ProfileScreen (« Mon rythme »), jugé exemplaire par l'audit : " +
          "« À définir » quand c'est null, jamais un zéro, tap vers le setup. On répare la " +
          "donnée à l'endroit où son absence se lit.",
      },
    ],
    recommandation: "tappable-si-vide",
    cout:
      "À câbler en Phase 3 : le prototype rend non-tappable (aucune navigation dans le harnais). " +
      "La recommandation reprend le seul pattern que l'audit a blanchi et cité en modèle.",
  },
  {
    id: "D3",
    titre: "Où vit le club ?",
    question:
      "Le club du joueur apparaît-il comme une ligne de contrôle qui renvoie aux Réglages, ou " +
      "remonte-t-on la carte club des Réglages dans le Profil ?",
    options: [
      {
        id: "ligne",
        libelle: "Une ligne de contrôle (rendu actuel du prototype)",
        consequences:
          "Une ligne « Mon club » (nom + badge en variante informée) qui mène aux Réglages, où " +
          "la carte complète vit déjà. Le Profil reste court ; la gestion reste à un tap.",
      },
      {
        id: "carte-remontee",
        libelle: "Remonter la carte club des Réglages",
        consequences:
          "La gestion du club devient visible au Profil — au prix de la carte la plus lourde de " +
          "l'app : ~700 pt mesurés par l'audit (28 % de l'écran des Réglages).",
      },
    ],
    recommandation: "ligne",
    cout:
      "La carte club coûte ~700 pt (AUDIT_PROFIL.md). Le pilote a peu de clubs : une ligne " +
      "suffit, la carte reste accessible en un tap.",
  },
  {
    id: "D4",
    titre: "Une entrée Progression au Profil ?",
    question:
      "Faut-il une 7e ligne de contrôle « Ma progression » — alors que le Home porte déjà la " +
      "sortie « Voir ma progression » ?",
    options: [
      {
        id: "aucune",
        libelle: "Aucune entrée",
        consequences:
          "Le Home reste la seule porte vers la Progression. Une deuxième porte serait une " +
          "redite de navigation, pour un écran déjà accessible à un tap du même onglet racine.",
      },
      {
        id: "ligne-progression",
        libelle: "Une 7e ligne de contrôle",
        consequences:
          "La Progression devient joignable depuis deux onglets. Coût : deux portes pour la même " +
          "pièce, et une liste de contrôles qui s'allonge.",
      },
    ],
    recommandation: "aucune",
    cout:
      "Pas de mesure chiffrée : le coût est une redite de navigation, pas des points d'écran. " +
      "La règle du repo (un chiffre = une implémentation) vaut aussi pour les portes.",
  },
  {
    id: "D5",
    titre: "L'e-mail et la déconnexion restent aux Réglages ?",
    question:
      "Le Profil doit-il afficher un bloc compte (e-mail, badge, déconnexion) — ou tout cela " +
      "reste-t-il aux Réglages, où il vit aujourd'hui ?",
    options: [
      {
        id: "oui",
        libelle: "Oui — tout reste aux Réglages",
        consequences:
          "Zéro redite : le Profil n'affiche pas l'e-mail, la ligne « Réglages » y mène. " +
          "L'écran parle du joueur, pas du compte.",
      },
      {
        id: "bloc-compte",
        libelle: "Un bloc compte au Profil",
        consequences:
          "E-mail et déconnexion visibles sans passer par les Réglages. Coût : une section de " +
          "plus sur l'écran, et deux endroits qui affichent le même compte — dont un badge " +
          "« Vérifié » que l'audit a montré vide de sens (P1-14).",
      },
    ],
    recommandation: "oui",
    cout:
      "Pas de mesure chiffrée : le coût du bloc compte est une section de plus et une double " +
      "vérité de compte — le genre de redite que la refonte supprime.",
  },
];

module.exports = { DECISIONS };
