// prototype/home-vnext/lib/axesAValider.js
// =============================================================================
// LES SEPT AXES SUR LESQUELS LE FONDATEUR SE PRONONCE, SEPAREMENT
// =============================================================================
//
// POURQUOI PAR AXE ET PLUS PAR ECRAN
// -----------------------------------------------------------------------------
// La liste precedente (`pointsAValider.js`) est organisee par QUESTION D'ECRAN :
// « l'action principale », « la fin de l'ecran »… Elle reste, elle est bonne pour
// relire l'ecran de bout en bout.
//
// Mais ce n'est pas ce qu'on demande cette fois. Cette fois il faut pouvoir dire
// OUI a la typographie et NON a la hauteur sans que les deux verdicts se
// contaminent. Un axe = un jugement isole, avec :
//   - la BASCULE a manipuler (c'est le point neuf : un axe se juge en changeant
//     UN reglage et rien d'autre) ;
//   - les CIBLES, qui sont des combinaisons completes (etat + variante + largeur
//     + vue + echelle de texte + presentation). Le visualiseur en fait des
//     boutons : un clic pose la combinaison entiere, on ne cherche pas les
//     reglages a la main.
//   - ce qui vaut OUI et ce qui vaut NON, separement — pas une phrase unique ou
//     les deux se melangent.
//
// CE QU'IL N'Y A PAS ICI
// -----------------------------------------------------------------------------
// Aucun nom de fichier, aucun nom de composant, aucun jargon. Kyllian n'ecrit pas
// de code : un axe qu'il ne peut pas juger a l'oeil n'a rien a faire dans cette
// liste.
// =============================================================================
"use strict";

/**
 * Une cible = une combinaison complete du visualiseur.
 * Les champs omis prennent le defaut : variante deduite de l'etat, 375 px, vue
 * « zone visible », texte x1, presentation par defaut.
 */
const AXES = [
  // ---------------------------------------------------------------------------
  {
    id: "hierarchie-typo",
    titre: "Hierarchie typographique",
    question:
      "Sans aucun texte en graisse maximale, l'ecran garde-t-il un ordre de lecture evident ?",
    bascule:
      "Le reglage PRESENTATION, en haut : « Allegee » puis « Actuelle ». Ne change RIEN d'autre — " +
      "meme etat, meme largeur, meme vue. Les deux pages portent exactement les memes mots : la " +
      "seule difference est le poids et la taille des caracteres.",
    regarder:
      "Bascule d'une presentation a l'autre trois ou quatre fois de suite en fixant le milieu de " +
      "l'ecran. Ce qui saute d'un coup, c'est ce que l'ancienne echelle criait. Regarde en " +
      "particulier les titres de section en petites capitales (MA SEMAINE, MA PROGRESSION), le " +
      "libelle du bouton du jour, et le texte courant sous l'action.",
    oui:
      "Tu retrouves sans effort les trois niveaux — le titre de section, le chiffre, la phrase " +
      "d'explication — alors que plus AUCUN texte n'est en graisse 800. La salutation reste la " +
      "premiere chose lue sans ecraser la date qui la suit.",
    non:
      "Tout se vaut et l'oeil ne sait plus par ou commencer ; ou au contraire un titre de section " +
      "est devenu si discret qu'on ne voit plus que le contenu commence. Dis LEQUEL : chaque role " +
      "se regle separement, le tableau complet est dans l'onglet « La regle ».",
    cibles: [
      { libelle: "Tendance disponible — allegee", etat: "v2-tendance-disponible", presentation: "allegee" },
      { libelle: "Tendance disponible — actuelle", etat: "v2-tendance-disponible", presentation: "actuelle" },
      { libelle: "Deux seances — allegee", etat: "v2-deux-seances-tendance-indisponible", presentation: "allegee" },
      { libelle: "Deux seances — actuelle", etat: "v2-deux-seances-tendance-indisponible", presentation: "actuelle" },
      { libelle: "Nouveau joueur — allegee", etat: "v2-nouveau-joueur", presentation: "allegee" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "densite",
    titre: "Densite",
    question:
      "Chaque ligne de la carte porte-t-elle un fait mesure, ou y a-t-il du remplissage ?",
    bascule:
      "Aucun reglage : c'est l'ETAT qui change. Compare « Deux seances » (quatre lignes de faits) " +
      "et « Donnee manquante » (deux lignes seulement, sur trois seances terminees). Puis bascule " +
      "la PRESENTATION pour voir si l'echelle allegee a aere ou dilue.",
    regarder:
      "Lis la carte ligne par ligne, a voix basse. Chaque ligne doit etre un chiffre que l'app a " +
      "vraiment mesure. Sur « Donnee manquante », les lignes « minutes realisees » et « ressentis " +
      "enregistres » doivent avoir PURPEMENT DISPARU — pas affiche 0, pas affiche un tiret.",
    oui:
      "Tout ce que tu lis est verifiable, rien n'est la pour remplir, et l'ecart de longueur entre " +
      "les deux etats se justifie par la donnee disponible. L'echelle allegee (texte courant plus " +
      "grand, interligne plus large) rend la lecture plus calme sans etirer la carte pour rien.",
    non:
      "Tu trouves un « 0 min », un « — », une jauge a zero, une barre decorative ou un " +
      "encouragement generique ; ou bien l'echelle allegee a tellement aere que la carte parait " +
      "vide alors qu'elle dit la meme chose.",
    cibles: [
      { libelle: "Deux seances (4 faits)", etat: "v2-deux-seances-tendance-indisponible" },
      { libelle: "Donnee manquante (2 faits)", etat: "v2-donnee-manquante" },
      { libelle: "Donnee manquante — actuelle", etat: "v2-donnee-manquante", presentation: "actuelle" },
      { libelle: "Nouveau joueur (aucun chiffre)", etat: "v2-nouveau-joueur" },
      { libelle: "Aucune comparaison possible", etat: "v2-aucune-comparaison-de-test" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "hauteur",
    titre: "Hauteur",
    question:
      "Ce qu'il faut pour AGIR aujourd'hui tient-il au-dessus de la ligne, et ce qui passe dessous " +
      "merite-t-il qu'on defile ?",
    bascule:
      "La VUE (« zone visible » / « page entiere »), la LARGEUR (320 puis 375) et le TEXTE (x1 puis " +
      "x1,3). L'onglet « Mesures » chiffre, pour la combinaison affichee, la hauteur de la page et " +
      "la liste exacte des blocs qui passent sous la ligne rouge.",
    regarder:
      "En vue « zone visible », ce qui est au-dessus du trait rouge est tout ce que le joueur voit " +
      "en ouvrant l'app. Verifie que l'action du jour et sa ligne « pourquoi » y sont. Passe " +
      "ensuite en « page entiere » et regarde ce qui vient apres.",
    oui:
      "L'action du jour et son explication sont au-dessus de la ligne dans les deux largeurs. Ce " +
      "qui passe dessous est du BILAN — la semaine, la progression — c'est-a-dire ce qu'on va " +
      "chercher, pas ce dont on a besoin tout de suite. Defiler pour atteindre le pied de la carte " +
      "en texte agrandi ne te derange pas.",
    non:
      "L'action du jour, ou la phrase qui l'explique, tombe sous la ligne ; ou le chemin jusqu'a la " +
      "fin de l'ecran est si long que la carte coute plus qu'elle ne rapporte. Attention : « il " +
      "reste quelques pixels sous la ligne » n'est pas un defaut en soi — c'est ce qui se trouve " +
      "dessous qui compte.",
    cibles: [
      { libelle: "Tendance disponible — 375, visible", etat: "v2-tendance-disponible", largeur: 375, vue: "visible" },
      { libelle: "Tendance disponible — 375, page entiere", etat: "v2-tendance-disponible", largeur: 375, vue: "entiere" },
      { libelle: "Tendance disponible — 320, visible", etat: "v2-tendance-disponible", largeur: 320, vue: "visible" },
      { libelle: "Tendance disponible — 375, texte x1,3", etat: "v2-tendance-disponible", largeur: 375, x13: true, vue: "visible" },
      { libelle: "Test ameliore — 375, page entiere", etat: "v2-test-physique-ameliore", largeur: 375, vue: "entiere" },
      { libelle: "Nouveau joueur — 320, page entiere", etat: "v2-nouveau-joueur", largeur: 320, vue: "entiere" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "lisibilite",
    titre: "Lisibilite",
    question:
      "Le texte reste-t-il confortable sur le plus petit telephone, et pour un joueur qui a grossi " +
      "la police de son telephone ?",
    bascule:
      "La LARGEUR 320, puis le TEXTE x1,3 en 375. Ces deux reglages se cumulent avec la " +
      "PRESENTATION : le texte courant est passe en graisse plus legere ET plus grand, c'est " +
      "exactement le compromis a juger.",
    regarder:
      "Cherche trois choses precises : un mot coupe ou qui deborde ; un chiffre qui part seul a la " +
      "ligne, separe de son libelle ; et le gris du texte secondaire — la phrase de portee sous la " +
      "courbe, la date sous la salutation. C'est lui qui souffre en plein soleil.",
    oui:
      "Rien ne deborde en 320, aucun chiffre ne se detache de son libelle, et le texte gris reste " +
      "lisible a bout de bras. En x1,3 la mise en page s'allonge mais rien ne se casse.",
    non:
      "Un libelle est coupe, un ecart de test deborde de sa ligne, ou le texte courant te parait " +
      "trop pale depuis que sa graisse a baisse. A SAVOIR AVANT DE TRANCHER SUR LE x1,3 : les " +
      "pages « x1,3 » de ce visualiseur montrent le PIRE CAS, sans aucun plafond. Sur telephone, " +
      "trois textes d'affichage cessent de grandir plus tot (la salutation, le libelle du bouton, " +
      "les titres de section) — la vraie page sera donc moins etiree que celle-ci.",
    cibles: [
      { libelle: "Test en recul — 320 px", etat: "v2-test-physique-en-recul", largeur: 320 },
      { libelle: "Test en recul — 375, texte x1,3", etat: "v2-test-physique-en-recul", largeur: 375, x13: true },
      { libelle: "Deux seances — 320 px", etat: "v2-deux-seances-tendance-indisponible", largeur: 320 },
      { libelle: "Deux seances — 320, typo actuelle", etat: "v2-deux-seances-tendance-indisponible", largeur: 320, presentation: "actuelle" },
      { libelle: "Tendance disponible — 375, x1,3, page entiere", etat: "v2-tendance-disponible", largeur: 375, x13: true, vue: "entiere" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "carte-progression",
    titre: "Carte Progression",
    question:
      "Sur CHACUN des sept cas, la carte t'apprend-elle quelque chose que le haut de l'ecran ne " +
      "disait pas deja ?",
    bascule:
      "L'ETAT, dans le groupe « Variante 2 » de la liste de gauche. Les sept cas sont la, et " +
      "chacun repond a une situation differente. Pour comparer avec ce qu'il y avait avant, passe " +
      "en « Cote a cote », paire « vNext / Progression ».",
    regarder:
      "Sur chaque cas, couvre le haut de l'ecran avec la main et lis la carte seule. Puis " +
      "demande-toi : est-ce que je savais deja ca ? Regarde aussi QUEL test est mis en avant — la " +
      "carte n'en affiche qu'un, choisi par une regle. L'onglet « La regle » dit lequel et " +
      "pourquoi, pour l'etat affiche.",
    oui:
      "Chacun des sept cas apporte un fait neuf, et l'etat sans donnee dit franchement qu'il n'a " +
      "rien plutot que d'afficher un graphique gris. Le test mis en avant est bien celui que tu " +
      "voudrais voir en premier dans ce cycle-la.",
    non:
      "Sur au moins un cas, la carte ne fait que renvoyer ailleurs — le petit lien texte de la " +
      "variante 1 faisait alors le meme travail pour dix fois moins de place. Ou bien le test mis " +
      "en avant n'est pas le bon : dis lequel tu voudrais, la ligne du tableau se change en une " +
      "minute.",
    cibles: [
      { libelle: "Nouveau joueur", etat: "v2-nouveau-joueur" },
      { libelle: "Deux seances, pas de tendance", etat: "v2-deux-seances-tendance-indisponible" },
      { libelle: "Tendance disponible (regle 1)", etat: "v2-tendance-disponible" },
      { libelle: "Chrono ameliore (regle 1)", etat: "v2-test-physique-ameliore" },
      { libelle: "Resultat moins bon (regles 2+3)", etat: "v2-test-physique-en-recul" },
      { libelle: "Aucune comparaison possible", etat: "v2-aucune-comparaison-de-test" },
      { libelle: "Donnee manquante", etat: "v2-donnee-manquante" },
      { libelle: "Cote a cote — avant / avec la carte", etat: "v2-tendance-disponible", variante: "duo", paire: "v1v2" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "pied-secondaire",
    titre: "Pied secondaire",
    question:
      "« Voir ma progression », en bas de la carte, reste-t-il un LIEN — et pas un deuxieme bouton " +
      "qui concurrence l'action du jour ?",
    bascule:
      "L'ETAT : trois cas affichent ce pied, trois autres ne l'affichent volontairement PAS. " +
      "Compare les deux familles. L'onglet « Cet etat » compte pour toi les aplats colores de " +
      "l'ecran entier — l'attendu est toujours 1, celui du haut.",
    regarder:
      "Recule d'un metre de l'ecran et plisse les yeux. Il ne doit rester qu'UNE tache de couleur, " +
      "en haut. Puis lis les deux liens de l'ecran quand ils coexistent : « Voir le detail » sous " +
      "l'action ouvre LA SEANCE, « Voir ma progression » en bas de la carte ouvre LA PROGRESSION.",
    oui:
      "Un seul aplat colore sur tout l'ecran, le pied est un simple lien texte, et tu sais ou " +
      "chaque lien t'emmene sans avoir a taper dessus. Sur les etats ou le pied est absent, tu es " +
      "d'accord avec le motif donne dans « Cet etat ».",
    non:
      "Une deuxieme tache de couleur apparait en bas, meme discrete — l'oeil ira vers elle au lieu " +
      "d'aller vers l'action du jour. Ou bien tu penses qu'il faut laisser le joueur aller voir sa " +
      "progression meme quand la page n'a rien a lui montrer : c'est une decision de produit, " +
      "elle t'appartient.",
    cibles: [
      { libelle: "Avec le pied — tendance disponible", etat: "v2-tendance-disponible" },
      { libelle: "Avec le pied — chrono ameliore", etat: "v2-test-physique-ameliore" },
      { libelle: "Avec le pied — aucune comparaison", etat: "v2-aucune-comparaison-de-test" },
      { libelle: "Sans le pied — nouveau joueur", etat: "v2-nouveau-joueur" },
      { libelle: "Sans le pied — deux seances", etat: "v2-deux-seances-tendance-indisponible" },
      { libelle: "Sans le pied — donnee manquante", etat: "v2-donnee-manquante" },
      { libelle: "320 px — le pied tient-il ?", etat: "v2-tendance-disponible", largeur: 320, vue: "entiere" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "pastille-absente",
    titre: "Absence de pastille globale",
    question:
      "L'en-tete sans pastille d'etat te parait-il plus honnete, ou trop nu ?",
    bascule:
      "« Cote a cote », paire « vNext / Progression », 375 px. A GAUCHE l'ecran garde sa pastille " +
      "(« En forme », « Un peu charge »…), A DROITE elle n'existe plus. La gauche ne la garde que " +
      "pour rendre l'ecart visible : ce n'est pas une proposition concurrente.",
    regarder:
      "Le haut des deux colonnes, cote a cote. Puis descends dans la colonne de droite jusqu'a la " +
      "phrase sous la courbe : « calcule sur tes seances FKS uniquement — tes entrainements club " +
      "n'y sont pas comptes ». C'est cette phrase-la qui rendait la pastille intenable : un ecran " +
      "ne peut pas annoncer un etat global en haut et ecrire 200 px plus bas qu'il ne sait pas le " +
      "calculer.",
    oui:
      "La colonne de droite te parait plus honnete sans elle, et l'en-tete garde assez de tenue " +
      "avec la seule salutation et la date.",
    non:
      "L'en-tete te semble desormais vide. Une troisieme voie existe mais elle est CONDITIONNEE, " +
      "et elle n'a pas ete prise a ta place : une pastille reformulee, limitee aux seules seances " +
      "FKS et disant sa portee (par exemple « Charge FKS : moderee »), ne pourra revenir que le " +
      "jour ou son calcul reposera sur des donnees entierement reelles — aujourd'hui il part " +
      "encore de valeurs de demarrage artificielles et ignore les entrainements club.",
    cibles: [
      { libelle: "Cote a cote — tendance disponible", etat: "v2-tendance-disponible", variante: "duo", paire: "v1v2" },
      { libelle: "Cote a cote — chrono ameliore", etat: "v2-test-physique-ameliore", variante: "duo", paire: "v1v2" },
      { libelle: "Cote a cote — aucune comparaison", etat: "v2-aucune-comparaison-de-test", variante: "duo", paire: "v1v2" },
      { libelle: "L'ecran seul, sans pastille", etat: "v2-tendance-disponible", variante: "vnext2" },
      { libelle: "L'ecran seul, avec pastille", etat: "tendance-disponible", variante: "vnext" },
    ],
  },
];

// =============================================================================
// LA COUVERTURE DEMANDEE
// =============================================================================
// Les huit situations que le fondateur a nommees, et OU chacune se regarde.
// Publie tel quel dans le visualiseur : si une situation n'etait pas atteignable,
// c'est ici que ca se verrait, avec l'explication a la place du bouton.
//
// Aucune ne manque : les sept cas de carte couvrent sept des huit situations, et
// la huitieme n'est pas une donnee de joueur mais un reglage du telephone — elle
// se regarde donc sur n'importe quel etat, par la bascule de presentation.
// =============================================================================
const COUVERTURE = [
  {
    situation: "Nouveau joueur",
    cible: { etat: "v2-nouveau-joueur" },
    ceQuOnVoit:
      "Aucune seance, aucun test : trois reperes numerotes qui annoncent ce qui apparaitra, une " +
      "mention « 0 seance terminee », et aucun bouton vers la page Progression.",
  },
  {
    situation: "Deux seances, sans tendance",
    cible: { etat: "v2-deux-seances-tendance-indisponible" },
    ceQuOnVoit:
      "Quatre lignes de faits mesures et le compte a rebours « encore 2 seances ». Aucune courbe : " +
      "le seuil n'est pas atteint, et l'ecran le dit au lieu d'en tracer une.",
  },
  {
    situation: "Tendance disponible",
    cible: { etat: "v2-tendance-disponible" },
    ceQuOnVoit:
      "La courbe, sa periode, sa portee ecrite en toutes lettres, et un repere de test : le saut " +
      "en longueur, 205 -> 214 cm.",
  },
  {
    situation: "Test aligne sur l'objectif du cycle",
    cible: { etat: "v2-test-physique-ameliore" },
    ceQuOnVoit:
      "Le cycle actif est « Vitesse & detente » : c'est le SPRINT 10 m qui est mis en avant, par " +
      "la regle 1. Un autre test (le 505) avait pourtant ete enregistre plus tard le meme jour — " +
      "sans la regle 1, c'est lui qui serait a l'ecran. L'onglet « La regle » le montre.",
  },
  {
    situation: "Chrono en amelioration",
    cible: { etat: "v2-test-physique-ameliore" },
    ceQuOnVoit:
      "1,85 s -> 1,78 s, soit « -0,07 s » : un chiffre negatif qui est une bonne nouvelle. C'est " +
      "le mot « en progres » qui doit faire ce travail, jamais une fleche ni une couleur.",
  },
  {
    situation: "Resultat moins bon",
    cible: { etat: "v2-test-physique-en-recul" },
    ceQuOnVoit:
      "Sprint 1,81 s -> 1,88 s, « en retrait ». Dans la MEME batterie, le saut avait gagne 3 cm et " +
      "le 6 min 25 m : deux bonnes nouvelles etaient disponibles et n'ont pas ete preferees. " +
      "C'est la preuve a l'ecran que la selection ne regarde pas le resultat.",
  },
  {
    situation: "Donnees manquantes",
    cible: { etat: "v2-donnee-manquante" },
    ceQuOnVoit:
      "Trois seances terminees, aucune duree connue, aucun ressenti enregistre. Les deux lignes " +
      "correspondantes DISPARAISSENT au lieu d'afficher 0 ou un tiret.",
  },
  {
    situation: "Reduction des animations active",
    cible: { etat: "v2-tendance-disponible", presentation: "allegee-mouvement-reduit" },
    ceQuOnVoit:
      "L'ecran est VISUELLEMENT IDENTIQUE, et c'est exactement le resultat voulu : au repos, un " +
      "ecran sans animation ressemble a un ecran avec animation. Ce qui change est dans le " +
      "balisage, et le visualiseur le compte pour toi dans l'onglet « Cet etat » : le conteneur de " +
      "l'action du jour perd son transform. Ce reglage n'est pas une donnee de joueur mais un " +
      "reglage du telephone : il se regarde sur n'importe quel etat, par la bascule de presentation.",
  },
];

module.exports = { AXES, COUVERTURE };
