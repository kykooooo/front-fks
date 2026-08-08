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
  {
    id: "D6",
    titre: "À 320 px, deux des trois usages réels passent sous la ligne de flottaison",
    question:
      "Mesure du vérificateur (contrôle e) : sur un iPhone SE (320 px, 499 px lisibles), " +
      "« Réglages » commence à ~546 px et « Mes séances passées » à ~591 px — seul « Modifier " +
      "mon profil » tient au-dessus de la flottaison. À 375 et 390 px, les trois passent " +
      "partout. Que fait-on du petit écran ?",
    options: [
      {
        id: "accepter-le-defilement",
        libelle: "Accepter le défilement à 320 px",
        consequences:
          "L'écran garde une seule forme à toutes les largeurs (la leçon du Home : pas d'état " +
          "spécial fragile). Sur SE, un demi-geste de pouce révèle les contrôles — l'écran " +
          "entier fait ~820-880 px, soit à peine 1,7 hauteur d'écran.",
      },
      {
        id: "rythme-apres-controles",
        libelle: "Passer « Mon rythme » sous les contrôles",
        consequences:
          "Ordre : identité → contrôles → rythme. L'identité garde l'ouverture (c'est le sens " +
          "de l'écran), les trois usages remontent d'~130 px et passent au-dessus de la " +
          "flottaison à 320 px aussi. Une seule forme, tous formats. Coût : le rythme, donnée " +
          "de même nature que l'identité, s'en retrouve séparé.",
      },
      {
        id: "controles-en-tete",
        libelle: "Les contrôles avant tout",
        consequences:
          "La lecture la plus littérale du cap (« les trois usages réels en haut ») : la liste " +
          "de contrôles ouvre l'écran, l'identité suit. Coût : l'écran s'ouvre sur des boutons, " +
          "pas sur le joueur — le Profil perd son ouverture d'identité.",
      },
    ],
    recommandation: "rythme-apres-controles",
    cout:
      "Chiffres du vérificateur : flottaison 519 px à 320 (499 lisibles), Réglages à 546-554, " +
      "Historique à 591-599 dans l'ordre actuel. Le réordonnancement est un déplacement de " +
      "section dans l'écran (aucun changement de contrat) — montrable en une itération si choisi.",
  },
  {
    id: "D7",
    titre: "Le Profil retrouve-t-il de la couleur ?",
    question:
      "Retour du fondateur : l'ancien Profil avait de la vie visuelle (badges, couleurs), mais " +
      "elle jurait avec le langage des autres écrans. Le refondu sobre est-il trop austère — et " +
      "si oui, la couleur revient-elle DANS le langage du Home ? Se juge à la bascule " +
      "« Accents » du visualiseur : mêmes données, mêmes mots, deux habillages.",
    options: [
      {
        id: "sobre",
        libelle: "Sobre (rendu de référence)",
        consequences:
          "La couleur ne vit que dans les marques de section. Zéro risque de patchwork, écran le " +
          "plus court. Coût : austère à côté de rien — c'est précisément le reproche du fondateur.",
      },
      {
        id: "colore",
        libelle: "Coloré (famille d'accents du Home)",
        consequences:
          "La même information, habillée dans la famille d'accents du Home : avatar dessiné (un " +
          "glyphe, jamais des initiales), faits en pilules teintées accentSoft, valeurs de rythme " +
          "accentuées, chevrons accent. Jamais un texte ajouté ni retiré (verrouillé par test), " +
          "jamais l'orange d'action — il reste réservé à l'unique aplat du Home. Coût : l'avatar " +
          "grandit la carte identité (~44-56 px estimés, mesure ci-dessous).",
      },
    ],
    recommandation: "colore",
    cout:
      "Mesuré par le vérificateur (Chrome headless, page entière, informé à 375 px), APRÈS le " +
      "correctif de l'avatar : l'avatar en ligne tronquait l'objectif long à 320 px et en " +
      "texte agrandi (contrôle i) — il a donc SA PROPRE RANGÉE, le coût passe en hauteur, " +
      "visible et mesuré : de +24 à +76 px selon l'état (joueur-complet +76, compte-neuf +60, " +
      "profil-partiel +68, chargement +24, propriétaire-club +76, sans-cycle +68, stress +76). " +
      "Zéro troncature sur les états produit ; contrastes des pilules 6,18:1 et 5,22:1 " +
      "(seuil 4,5). Attention au couplage avec D6 : à 320 px en coloré, cette hauteur en plus " +
      "pousse les TROIS usages réels sous la ligne de flottaison (553-651 px pour 519) — si " +
      "« coloré » est retenu, la réponse de D6 (rythme après les contrôles) devient d'autant " +
      "plus importante.",
  },
];

// =============================================================================
// TRANCHE PAR LE FONDATEUR — 08/08/2026 (« vas-y reste sobre et le reste comme
// tu proposes / oui et ok pour tes recos »)
// =============================================================================
// D1 « oui » = informe ; D7 « reste sobre » = sobre (l'axe accents ne part PAS
// en integration : le module profilVNextAccents et la prop `accents` restent
// dans le prototype pour memoire, ils ne seront pas cables) ; D2-D6 = les
// recommandations. La maquette est GELEE sur ces choix.
// =============================================================================
const TRANCHES = {
  D1: "informe",
  D2: "tappable-si-vide",
  D3: "ligne",
  D4: "aucune",
  D5: "oui",
  D6: "rythme-apres-controles",
  D7: "sobre",
};
for (const d of DECISIONS) {
  d.tranchee = { option: TRANCHES[d.id], date: "2026-08-08" };
}

module.exports = { DECISIONS, TRANCHES };
