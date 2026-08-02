// prototype/home-vnext/lib/iteration.js
// =============================================================================
// « PROGRESSION INTEGREE » — CE QUI A CHANGE DEPUIS L'ITERATION PRECEDENTE
// =============================================================================
//
// LA DEMANDE, ET LA DIFFICULTE
// -----------------------------------------------------------------------------
// Le fondateur veut comparer la carte AVANT et APRES. Un harnais honnete doit
// alors dire une chose desagreable : il ne peut pas TOUT rejouer.
//
// Une bascule ne peut rendre que du code PRESENT sur le disque. Sur les cinq
// changements de cette iteration, un seul a ete conserve en double — la
// typographie, parce que `ECHELLE_ACTUELLE` garde volontairement les valeurs
// d'avant. Les quatre autres ont REMPLACE ce qui existait : l'ancienne fonction
// de selection a ete supprimee, les anciennes dates de fixture aussi.
//
// LA REGLE APPLIQUEE ICI
// -----------------------------------------------------------------------------
// Ce qui est rejouable est RENDU. Ce qui ne l'est pas est DIT, avec la preuve
// chiffree a cote, et jamais mis en scene comme si c'etait une page.
//
// Fabriquer une fausse page « avant » — en recopiant a la main le comportement
// suppose de l'ancien code — serait exactement l'erreur que cette iteration
// corrige : une demonstration arrangee. On ne la refait pas dans l'outil qui sert
// a la juger.
//
// LA PREUVE CHIFFREE POUR LE CHANGEMENT LE PLUS IMPORTANT
// -----------------------------------------------------------------------------
// Le repere de test change de regle. Pour montrer l'effet SANS recoder l'ancien
// selecteur, le harnais appelle la fonction du produit avec `cycleActif = null` :
// la regle 1 ne mord alors pas, et le resultat est celui de la regle 2 seule — la
// mesure la plus recente, exactement la question que l'ancienne version posait.
// Le calcul est donc fait PAR LE PRODUIT, pas par une reconstitution du harnais.
// Ce n'est pas l'ancien code au bit pres (son departage suivait l'ordre du
// tableau d'entree, le nouveau suit un ordre fige), et c'est ecrit ci-dessous.
// =============================================================================
"use strict";

/**
 * `rejouable` :
 *   "oui"     — une bascule du visualiseur rend reellement les deux versions ;
 *   "mesure"  — non rejouable, mais l'effet est CHIFFRE et affiche a cote ;
 *   "non"     — non rejouable et non chiffrable : seul le texte en rend compte.
 */
const CHANGEMENTS = [
  {
    id: "typographie",
    titre: "La typographie s'est allegee",
    rejouable: "oui",
    quoi:
      "Cinq roles de texte etaient en graisse maximale (800) : la salutation, le libelle du bouton " +
      "du jour, les titres de section en petites capitales, et deux emphases dans les phrases. Il " +
      "n'en reste AUCUN — la graisse la plus lourde de l'ecran est desormais 700.",
    aSavoir:
      "Rien n'a ete reduit pour gagner de la hauteur : le texte qui se LIT a grandi (13 -> 14 px, " +
      "interligne 18 -> 20), les liens aussi (13 -> 14 px). Les chiffres et les metadonnees n'ont " +
      "pas perdu un pixel. C'etait bien l'accumulation de poids, pas la taille.",
    ouLeVoir:
      "Bascule PRESENTATION : « Allegee » (ce qui est propose) contre « Actuelle » (l'ecran tel " +
      "qu'il etait). Meme etat, meme largeur, memes mots — seule la typographie change.",
  },
  {
    id: "repere-test",
    titre: "Le test mis en avant obeit maintenant a une regle",
    rejouable: "mesure",
    quoi:
      "AVANT : la carte affichait la comparaison la plus RECENTE, sans autre critere. APRES : une " +
      "regle a trois etages — l'objectif du cycle actif d'abord, la mesure la plus recente ensuite, " +
      "et un ordre fige pour departager (une batterie de tests etant enregistree en UNE fois, ses " +
      "trois tests ont le meme horodatage : l'egalite est le cas normal, pas l'exception).",
    aSavoir:
      "Non rejouable : l'ancienne fonction a ete supprimee, pas mise de cote. Ce que le " +
      "visualiseur affiche a la place, dans l'onglet « La regle », est le resultat de la regle 2 " +
      "SEULE — obtenu en appelant la fonction du produit avec « aucun cycle actif ». C'est la " +
      "meme question que posait l'ancienne version (« quelle est la mesure la plus recente ? »), " +
      "calculee par le produit et non reconstituee. Une seule difference connue : a egalite " +
      "d'horodatage, l'ancienne version suivait l'ordre du tableau d'entree, celle-ci suit un " +
      "ordre fige et documente.",
    ouLeVoir:
      "Onglet « La regle », sur « Chrono ameliore » : la carte affiche le sprint 10 m parce que " +
      "c'est la qualite du cycle actif ; la regle 2 seule aurait affiche le test 505, enregistre " +
      "plus tard le meme jour. La ligne « ce que la regle 2 seule aurait designe » le montre.",
  },
  {
    id: "cas-en-recul",
    titre: "Un septieme cas : un resultat MOINS BON",
    rejouable: "non",
    quoi:
      "Un cas de carte a ete AJOUTE : un joueur qui revient de coupure et dont le sprint est passe " +
      "de 1,81 s a 1,88 s. Dans la meme batterie, son saut avait gagne 3 cm et son 6 min 25 m.",
    aSavoir:
      "C'est une preuve, pas une illustration : deux bonnes nouvelles etaient disponibles et n'ont " +
      "pas ete preferees. Rien a comparer avec l'avant — ce cas n'existait pas.",
    ouLeVoir: "Etat « Resultat moins bon » (v2-test-physique-en-recul), dans la liste de gauche.",
  },
  {
    id: "fixture-reparee",
    titre: "La demonstration du chrono ne repose plus sur des dates fabriquees",
    rejouable: "non",
    quoi:
      "A l'iteration precedente, l'etat « chrono ameliore » affichait le bon test parce que ses " +
      "dates avaient ete arrangees pour ca. Les dates ont ete refaites au format que l'ecran de " +
      "tests produit reellement, et c'est desormais la REGLE qui designe le sprint.",
    aSavoir:
      "Non rejouable, et c'est voulu : les anciennes dates ont ete supprimees. Les rejouer " +
      "reviendrait a remettre en ligne la version arrangee.",
    ouLeVoir:
      "Etat « Chrono ameliore ». La preuve que la regle mord vraiment est dans l'onglet « La " +
      "regle » : sans elle, c'est un autre test qui sortirait.",
  },
  {
    id: "mouvement",
    titre: "« Reduire les animations » est desormais respecte",
    rejouable: "oui",
    quoi:
      "AVANT : le conteneur de l'action du jour portait TOUJOURS son animation d'enfoncement, quel " +
      "que soit le reglage du telephone. APRES : quand le joueur a demande moins d'animations, il " +
      "n'y a plus aucun mouvement — l'enfoncement reste signale par un assombrissement, qui est un " +
      "fondu et non un deplacement.",
    aSavoir:
      "Une capture ne peut pas le montrer : au repos, les deux rendus sont identiques a l'oeil, et " +
      "c'est precisement le resultat voulu. Ce qui se prouve est dans le balisage, et le " +
      "visualiseur le compte : l'onglet « Cet etat » affiche « conteneur anime : transform present " +
      "/ absent ». Ni avant ni maintenant le prototype n'a la moindre animation en boucle.",
    ouLeVoir:
      "Bascule PRESENTATION : « Allegee » puis « Allegee + anim. reduites ». La page est la meme ; " +
      "c'est le compteur du panneau qui change.",
  },
  {
    id: "premier-ecran",
    titre: "L'ecran du nouveau joueur recoit deux propositions (03/08)",
    rejouable: "oui",
    quoi:
      "L'ecran d'un compte tout neuf mesurait 401 px sur 729 visibles : un en-tete, un bouton, une " +
      "carte qui dit qu'il n'y a rien a mesurer. Decision du fondateur : « sobre ne doit pas dire " +
      "timide ». Deux traitements sont proposes, V-A « Premiere mission » (615 px) et V-B " +
      "« Anticipation honnete » (598 px). Dans les deux, le bouton du jour passe en traitement hero " +
      "— meme mot, meme couleur, palier typographique du rang 1, 24 px de respiration, plancher " +
      "104 pt.",
    aSavoir:
      "AUCUNE donnee nouvelle. Les trois premiers pas de V-A sont coches depuis l'objectif declare " +
      "au setup, le nombre de tests terrain enregistres et le nombre de seances terminees — trois " +
      "champs que l'app possede deja et lit deja ailleurs. La ligne « pourquoi ce cycle » sort de la " +
      "fonction qui pre-selectionne deja le cycle en fin de setup. Chaque promesse de V-B porte la " +
      "constante exportee qui la declenchera. Un test ET le verificateur echouent si le ViewModel du " +
      "nouveau joueur gagne le moindre champ.",
    ouLeVoir:
      "Selecteur de VARIANTE, sur l'etat « Nouveau joueur » : « Proposition vNext » (aujourd'hui), " +
      "« V-A », « V-B ». En cote a cote : les paires « Actuelle / V-A » et « V-A / V-B ». Le detail " +
      "ligne par ligne, avec la source de chacune, est dans l'onglet « Cet etat ».",
  },
];

/** Ce qui n'a PAS bouge, et qu'il ne faut donc pas chercher dans la comparaison. */
const INCHANGE = [
  "La pastille d'etat du jour etait DEJA retiree de cette variante a l'iteration precedente. La " +
    "decision D1 la confirme et l'etend : elle ne reviendra pas tant que le calcul de charge partira " +
    "de valeurs de demarrage artificielles et ignorera les entrainements club.",
  "La carte remplace toujours le bloc « Ma forme » et le lien flottant de sortie : elle ne s'ajoute " +
    "pas, elle prend leur place.",
  "Les seuils d'affichage n'ont pas bouge : quatre seances avant une tendance, cinq points de " +
    "courbe, cinq jours reellement enregistres, deux JOURS differents pour comparer deux tests.",
  "LES 616 PAGES DEJA VALIDEES N'ONT PAS BOUGE D'UN OCTET. Mesure, pas affirmee : deux generations " +
    "completes, l'une sur le code d'avant les variantes de demarrage, l'autre apres, empreintes " +
    "SHA-1 comparees fichier par fichier (la marque de fraicheur ?v=, derivee des dates de " +
    "modification, est neutralisee). Resultat : 420 pages « Proposition vNext » et 196 pages " +
    "« Progression integree » RIGOUREUSEMENT identiques. La feuille de style a gagne 6 regles " +
    "(le padding et la hauteur du traitement hero, le cercle vide d'un premier pas, le filet de la " +
    "ligne « pourquoi ce cycle ») et n'en a perdu ni modifie AUCUNE.",
  "Les 158 pages du Home de production qui different entre les deux generations ne sont PAS une " +
    "regression : exactement les 158 memes different entre deux generations du MEME code. C'est la " +
    "pulsation infinie de components/home/HomePrimaryCTA.tsx, qui ne consulte jamais « reduire les " +
    "animations » — deja mesuree et publiee a l'iteration precedente.",
];

module.exports = { CHANGEMENTS, INCHANGE };
