// prototype/home-vnext/lib/presentations.js
// =============================================================================
// L'AXE « PRESENTATION » — TYPOGRAPHIE x MOUVEMENT
// =============================================================================
//
// CE QUE C'EST
// -----------------------------------------------------------------------------
// Un MEME etat, un MEME ecran, rendu avec deux reglages qui ne changent aucune
// donnee : quelle echelle typographique est posee, et si le joueur a demande
// « reduire les animations » sur son telephone.
//
// Les deux reglages sont des PROPS de `screens/homeVNext/HomeVNextScreen.tsx`
// (`echelle`, `reduceMotion`). Le harnais ne fabrique rien : il passe les memes
// valeurs que l'app passera, et rend le resultat.
//
// D'OU VIENNENT LES COMBINAISONS
// -----------------------------------------------------------------------------
// De `components/homeVNext/homeVNextPresentation.tsx`
// (`PRESENTATIONS_A_COMPARER`), pas d'une liste recopiee ici. Si le produit en
// ajoute une, elle apparait dans le visualiseur sans qu'on touche a ce fichier ;
// s'il en retire une, elle disparait. Ce fichier n'ajoute qu'une chose, qui est
// une decision de HARNAIS et pas de produit : a quelles largeurs et sur quelles
// variantes chaque combinaison est reellement generee.
//
// POURQUOI TOUTES LES COMBINAISONS NE SONT PAS GENEREES PARTOUT
// -----------------------------------------------------------------------------
// Le lot par defaut fait deja 156 rendus. Multiplier par quatre porterait la
// generation a plus d'un quart d'heure pour un gain nul : les deux largeurs que
// le fondateur a nommees sont 320 et 375, et c'est la que la typographie se
// joue. Les combinaisons non generees ne sont pas cachees — le visualiseur
// desactive le bouton et DIT pourquoi, comme il le fait deja pour le texte x1,3.
//
// CE QUE LE HOME DE PRODUCTION NE PEUT PAS FAIRE
// -----------------------------------------------------------------------------
// `screens/HomeScreen.tsx` n'a ni prop `echelle` ni prop `reduceMotion` : il n'a
// qu'une typographie, la sienne. La colonne « Home actuel » reste donc toujours
// sur la presentation par defaut. Ce n'est pas un oubli du harnais, c'est un
// fait du produit, et le visualiseur l'ecrit.
// =============================================================================
"use strict";

/**
 * Largeurs auxquelles les presentations NON PAR DEFAUT sont generees.
 * Ce sont les deux que le fondateur a nommees : le plus petit telephone encore
 * utilise, et la largeur de reference des captures.
 */
const LARGEURS_COMPARAISON = [320, 375];

/**
 * Variantes concernees par l'axe. Le Home de production n'en fait pas partie.
 *
 * `vnextA` / `vnextB` sont les deux variantes de DEMARRAGE (l'ecran du nouveau
 * joueur). Elles y figurent pour une raison precise : leur traitement hero pose
 * le libelle de l'action au palier `salutation`, qui vaut 20/700 en echelle
 * allegee et 22/800 en echelle actuelle. C'est exactement l'ecart que la
 * bascule typographique existe pour montrer — les exclure reviendrait a ne
 * jamais regarder le seul palier que le traitement hero deplace.
 */
const VARIANTES_AVEC_PRESENTATION = ["vnext", "vnext2", "vnextA", "vnextB"];

/**
 * Suffixe de nom de fichier par combinaison.
 *
 * La combinaison par defaut a un suffixe VIDE, et c'est deliberé : les pages
 * deja validees a l'iteration precedente gardent EXACTEMENT le meme nom. Une
 * generation ne peut donc pas deplacer sous les pieds du fondateur une page
 * qu'il avait ouverte, et deux builds successifs restent comparables au bit pres.
 */
const SUFFIXES = {
  allegee: "",
  actuelle: "-typo-actuelle",
  "allegee-mouvement-reduit": "-anim-reduites",
  "actuelle-mouvement-reduit": "-typo-actuelle-anim-reduites",
};

/** Nom court, pour un bouton de barre d'outils qui doit rester lisible. */
const COURTS = {
  allegee: "Allegee",
  actuelle: "Actuelle",
  "allegee-mouvement-reduit": "Allegee + anim. reduites",
  "actuelle-mouvement-reduit": "Actuelle + anim. reduites",
};

/**
 * Repli utilise UNIQUEMENT si `components/homeVNext/homeVNextPresentation.tsx`
 * est illisible. Il ne contient que la combinaison par defaut : mieux vaut un
 * visualiseur sans l'axe qu'un visualiseur qui invente des reglages que le
 * produit ne connait pas.
 */
const REPLI = [
  {
    id: "allegee",
    titre: "Echelle par defaut",
    resume:
      "Le module de presentation du produit n'a pas pu etre lu : seule la combinaison par defaut " +
      "est generee, et l'axe typographie / mouvement est indisponible.",
    preferences: { echelle: "allegee", reduceMotion: false },
  },
];

/**
 * Fabrique la liste des presentations a generer.
 *
 * @param {?Array} presentationsProduit `PRESENTATIONS_A_COMPARER`, lu dans
 *   components/homeVNext/homeVNextPresentation.tsx. `null` -> repli.
 * @param {number[]} largeursDisponibles les largeurs reellement generees par ce
 *   build (elles peuvent etre filtrees par FKS_LARGEURS).
 */
function construirePresentations(presentationsProduit, largeursDisponibles) {
  const source =
    Array.isArray(presentationsProduit) && presentationsProduit.length > 0
      ? presentationsProduit
      : REPLI;

  return source.map((p, index) => {
    const parDefaut = index === 0;
    const prefs = p.preferences || {};
    const largeursVoulues = parDefaut ? largeursDisponibles : LARGEURS_COMPARAISON;
    return {
      id: p.id,
      titre: p.titre,
      court: COURTS[p.id] || p.titre,
      resume: p.resume,
      echelle: prefs.echelle,
      reduceMotion: Boolean(prefs.reduceMotion),
      parDefaut,
      // Suffixe inconnu = combinaison ajoutee par le produit apres coup. On lui
      // en fabrique un plutot que d'ecraser les fichiers d'une autre.
      suffixe: SUFFIXES[p.id] != null ? SUFFIXES[p.id] : "-" + String(p.id).replace(/[^a-z0-9-]/gi, "-"),
      variantes: VARIANTES_AVEC_PRESENTATION.slice(),
      largeurs: largeursDisponibles.filter((w) => largeursVoulues.indexOf(w) !== -1),
      pourquoiPasPartout: parDefaut
        ? null
        : "Genere en " +
          LARGEURS_COMPARAISON.join(" et ") +
          " px seulement — les deux largeurs sur lesquelles la typographie se joue. " +
          "Les autres largeurs restent sur la presentation par defaut.",
    };
  });
}

/**
 * Les props de presentation a passer a l'ecran.
 *
 * Pour la combinaison PAR DEFAUT, on ne passe RIEN : l'ecran applique alors ses
 * propres valeurs par defaut, exactement comme quand personne ne precise. C'est
 * ce qui garantit que les pages deja validees sont rendues par le meme chemin
 * qu'avant l'ajout de cet axe — pas par un chemin « equivalent ».
 */
function propsDePresentation(presentation) {
  if (!presentation || presentation.parDefaut) return {};
  return { echelle: presentation.echelle, reduceMotion: presentation.reduceMotion };
}

// ---------------------------------------------------------------------------
// LA MESURE DU MOUVEMENT
// ---------------------------------------------------------------------------
// Une capture est IMMOBILE : « reduire les animations » ne se voit pas sur une
// image, puisque au repos les deux rendus sont identiques a l'oeil. C'est
// exactement le comportement voulu — mais ca veut dire qu'une planche ne peut
// pas le PROUVER.
//
// Ce qui se prouve, en revanche, est dans le balisage : le conteneur anime de
// l'action du jour porte un `transform` quand le mouvement est autorise, et RIEN
// du tout quand il ne l'est pas (`transformDePression` renvoie `null`, pas un
// transform neutre). On compte donc les deux, et le visualiseur affiche le
// resultat au lieu de demander au fondateur de deviner ce qu'il ne peut pas voir.
// ---------------------------------------------------------------------------

/** Marqueur pose par `components/homeVNext/HomeVNextAction.tsx`. */
const MARQUEUR_MOUVEMENT = "home-vnext-mouvement-action";

/**
 * @param {string} html balisage rendu de l'ecran entier
 * @returns {{conteneurs:number, avecTransform:number, sansTransform:number, transforms:string[]}}
 */
function mesurerMouvement(html) {
  const brut = String(html || "");
  // On capture la BALISE OUVRANTE complete du conteneur, dans les deux ordres
  // d'attributs possibles : react-native-web ecrit `style` avant `data-testid`
  // quand le style existe, et n'ecrit pas `style` du tout quand il n'y a rien.
  const motif = new RegExp('<div[^>]*data-testid="' + MARQUEUR_MOUVEMENT + '"[^>]*>', "g");
  const balises = brut.match(motif) || [];
  const transforms = [];
  let avecTransform = 0;
  balises.forEach((b) => {
    const m = b.match(/style="([^"]*transform[^"]*)"/);
    if (m) {
      avecTransform += 1;
      transforms.push(m[1]);
    }
  });
  return {
    conteneurs: balises.length,
    avecTransform,
    sansTransform: balises.length - avecTransform,
    transforms,
  };
}

/**
 * Le verdict lisible, avec son attendu. `attenduReduceMotion` vient de la
 * presentation, jamais d'une supposition sur le rendu.
 */
function controleMouvement(mesure, attenduReduceMotion) {
  const attendu = attenduReduceMotion ? 0 : mesure.conteneurs;
  return {
    cle: "mouvement",
    question: attenduReduceMotion
      ? "Le bouton du jour a-t-il bien perdu toute consigne de mouvement ?"
      : "Le bouton du jour porte-t-il bien sa consigne de mouvement ?",
    valeur: mesure.avecTransform,
    attendu,
    pourquoi: attenduReduceMotion
      ? "Le joueur a demande moins d'animations : le bouton ne doit plus porter la moindre " +
        "consigne de mouvement. Pas « un mouvement de zero » — RIEN. La difference compte : un " +
        "mouvement immobile resterait un mouvement, et on ne saurait plus dire si le reglage est " +
        "respecte ou si le bouton a simplement oublie de bouger."
      : "Le reglage n'est pas actif : le bouton doit bien porter sa consigne de mouvement. C'est " +
        "cette ligne qui donne son sens a l'autre — une absence ne prouve rien si la presence " +
        "n'est jamais constatee.",
    trouve:
      mesure.conteneurs === 0
        ? "aucun element anime dans ce rendu — sur cet etat, l'action du jour n'est pas un bouton " +
          "mais un accuse de reception, qui ne s'enfonce pas"
        : mesure.transforms.length
        ? "consigne trouvee dans le balisage : " + mesure.transforms.join(" · ")
        : "aucune consigne de mouvement dans le balisage",
  };
}

// ---------------------------------------------------------------------------
// LA PULSATION DU HOME DE PRODUCTION
// ---------------------------------------------------------------------------
// Trouvee en verifiant que deux generations produisent bien les memes fichiers :
// elles les produisent, SAUF pour les pages du Home de production, ou une valeur
// change a chaque fois (1,01479… puis 1,01488…).
//
// La cause est connue et documentee : `components/home/HomePrimaryCTA.tsx`
// (lignes 39-49) lance une pulsation EN BOUCLE INFINIE sur son bouton principal
// — echelle 1 -> 1,015, 900 ms dans chaque sens — sans jamais consulter le
// reglage « reduire les animations » du telephone. La capture attrape donc la
// boucle a un endroit different a chaque generation.
//
// CE QUE CA PROUVE, ET POURQUOI ON LE MESURE
// Le harnais FORCE « mouvement reduit » avant tout rendu (lib/render.js). Si le
// bouton de production consultait ce reglage, il serait immobile et les deux
// generations seraient identiques. Il pulse quand meme : c'est la demonstration
// directe, sur un fichier, que la preference d'accessibilite n'est pas respectee
// en production aujourd'hui.
//
// Hors perimetre (components/home/** n'est pas modifiable ici) : on ne corrige
// pas, on MESURE et on affiche. Le prototype, lui, n'a aucune boucle.
// ---------------------------------------------------------------------------

/**
 * Les echelles de transformation differentes de 1 trouvees dans un rendu.
 * Une valeur ≠ 1 au repos = une animation qui tourne toute seule au moment de la
 * capture.
 */
function mesurerPulsation(html) {
  const valeurs = [];
  const motif = /transform:\s*scale\(([0-9.]+)\)/g;
  let m;
  while ((m = motif.exec(String(html || ""))) !== null) {
    const v = Number(m[1]);
    if (Number.isFinite(v) && Math.abs(v - 1) > 1e-9) valeurs.push(v);
  }
  return valeurs;
}

module.exports = {
  LARGEURS_COMPARAISON,
  mesurerPulsation,
  VARIANTES_AVEC_PRESENTATION,
  MARQUEUR_MOUVEMENT,
  construirePresentations,
  propsDePresentation,
  mesurerMouvement,
  controleMouvement,
};
