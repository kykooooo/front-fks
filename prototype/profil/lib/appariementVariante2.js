// prototype/home-vnext/lib/appariementVariante2.js
// =============================================================================
// VARIANTE 2 — APPARIEMENT, MESURE, AUDIT DE COHERENCE
// =============================================================================
//
// POURQUOI CE FICHIER EXISTE
// -----------------------------------------------------------------------------
// La variante 2 ne remplace pas l'ecran : elle remplace le BAS de l'ecran. Pour
// la regarder, il faut donc un ecran complet — un `HomeVNextInput` — ET une carte
// progression — un `ProgressionInput`. Or les sept cas de la carte
// (`PROGRESSION_FIXTURES_RENDU`) ont ete ecrits SEULS, sans ecran autour. Il faut
// les poser quelque part.
//
// Ce fichier decide ou, et surtout il DIT ce que l'appariement coute.
//
// CE QUE L'ECRAN FAIT REELLEMENT EN VARIANTE 2
// -----------------------------------------------------------------------------
// Lu dans `screens/homeVNext/HomeVNextScreen.tsx` (union discriminee
// `variante: "v2"` + `progression`), pas suppose :
//   - le bloc "MA FORME" (`vm.form`) N'EST PAS RENDU : la carte l'absorbe ;
//   - le lien flottant de sortie (`vm.exit`) N'EST PAS RENDU non plus ;
//   - tout le reste — en-tete, avis, action, "Ma semaine", conseil — est
//     RIGOUREUSEMENT identique a la variante 1.
// Consequence directe et importante : il n'y a jamais deux courbes sur l'ecran,
// et le bloc "Ma forme" ne peut pas contredire la carte. La question de
// composition que le ViewModel de la carte posait dans ses avertissements a donc
// ete tranchee par l'ecran — la carte gagne.
//
// LA REGLE QUI GOUVERNE LE RESTE DU FICHIER
// -----------------------------------------------------------------------------
// Deux jeux de donnees ecrits separement peuvent se contredire. Ici la
// contradiction ne peut PLUS apparaitre sur l'ecran de la variante 2 (le bloc
// concurrent n'y est pas), mais elle apparait dans la vue que le fondateur va
// justement utiliser : le COTE A COTE. A gauche, "Ma forme" dit une chose ; a
// droite, la carte en dit une autre.
//
// On ne corrige pas ca en silence et on ne le cache pas : on le MESURE a chaque
// generation, on le declare dans le tableau ci-dessous, et le visualiseur affiche
// un bandeau rouge sur les cas concernes. C'est le procede deja retenu pour la
// comparaison avec le Home de production (`lib/mapping.js`) : une qualite de
// correspondance, et l'ecart ecrit en toutes lettres.
//
// Mieux : l'audit est RECALCULE a chaque build a partir des deux ViewModels. Si
// une fixture bouge et cree une divergence non declaree ici, la generation leve
// une alerte au lieu de laisser passer une planche menteuse.
//
// CE FICHIER NE REQUIERT RIEN
// -----------------------------------------------------------------------------
// Aucun `require`. Il est donc chargeable aussi bien par `build.js` (qui a monte
// le hook babel) que par un test jest, sans rien tirer derriere lui.
// =============================================================================
"use strict";

// ---------------------------------------------------------------------------
// 1. LES SEPT APPARIEMENTS
// ---------------------------------------------------------------------------
// `progression` — identifiant dans `PROGRESSION_FIXTURES_RENDU`.
// `hote`        — identifiant dans `HOME_VNEXT_FIXTURES_RENDU` : l'ecran qui
//                 accueille la carte.
// `id`          — identifiant de l'etat dans le visualiseur. PREFIXE `v2-` :
//                 deux cas de carte portent le meme identifiant qu'une fixture
//                 Home (`nouveau-joueur`, `tendance-disponible`), et le
//                 visualiseur indexe ses etats par identifiant unique.
// `qualite`     — "exact" | "approximatif", au sens de lib/mapping.js.
// `ecart`       — ce que l'appariement introduit de faux, et OU ca se voit.
//                 `null` si "exact".
// `pourquoiCetHote` — pourquoi cet ecran-la et pas un autre.
//
// Le choix de l'hote suit un ordre de priorite strict :
//   1. « Ma semaine » doit afficher EXACTEMENT le nombre que la carte a suppose
//      (`semaineCourante.seancesAffichees`). Sans ca, le garde-fou R7 de la carte
//      a ete calcule contre un nombre absent de l'ecran : il ne protege plus
//      rien. Les six appariements respectent cette condition.
//   2. Ce que le bloc « Ma forme » de la VARIANTE 1 raconte doit concorder avec
//      la carte — sinon la comparaison cote a cote se contredit.
// Le point 2 n'est pas toujours tenable : c'est exactement ce que dit `ecart`.
// ---------------------------------------------------------------------------
const APPARIEMENTS = [
  {
    id: "v2-nouveau-joueur",
    progression: "nouveau-joueur",
    hote: "nouveau-joueur",
    qualite: "exact",
    ecart: null,
    pourquoiCetHote:
      "Meme fixture des deux cotes : l'entree de la carte est DERIVEE de l'entree du Home " +
      "(progressionInputDepuisHome). Rien ne peut diverger, ni sur l'ecran ni en comparaison.",
  },
  {
    id: "v2-deux-seances-tendance-indisponible",
    progression: "deux-seances-tendance-indisponible",
    hote: "tendance-indisponible",
    qualite: "exact",
    ecart: null,
    pourquoiCetHote:
      "Tout concorde sans arrangement : deux seances terminees des deux cotes, la meme " +
      "trajectoire de cinq points, le meme manque annonce (« encore 2 »). C'est aussi un etat " +
      "ou la variante 1 n'affiche AUCUN lien de sortie : la comparaison montre donc exactement " +
      "ce que la carte apporte la ou il n'y avait qu'un bloc de patience.",
  },
  {
    id: "v2-tendance-disponible",
    progression: "tendance-disponible",
    hote: "tendance-disponible",
    qualite: "exact",
    ecart: null,
    pourquoiCetHote:
      "Meme fixture des deux cotes, entree derivee. La courbe de gauche (« Ma forme », " +
      "variante 1) et celle de droite (la carte, variante 2) tracent donc la MEME serie : la " +
      "comparaison porte sur la mise en page, pas sur des donnees differentes. C'est l'etat de " +
      "reference pour juger ce que la carte ajoute a une courbe qu'on avait deja.",
  },
  {
    id: "v2-test-physique-ameliore",
    progression: "test-physique-ameliore",
    hote: "seance-terminee",
    qualite: "approximatif",
    ecart:
      "Visible UNIQUEMENT en cote a cote, pas sur l'ecran de la variante 2. A gauche, le bloc " +
      "« Ma forme » de la variante 1 trace la trajectoire de la fixture Home ; a droite, la " +
      "carte trace celle de la fixture de carte. Sept points de part et d'autre, memes jours, " +
      "valeurs differentes. Aucune des deux n'est fausse en soi : les deux fixtures ont ete " +
      "ecrites separement, et c'est leur mise en regard ici qui est un artefact du prototype. " +
      "Compare la PLACE et le POIDS des deux blocs, pas la forme des traces.",
    pourquoiCetHote:
      "Seul ecran ou « Ma semaine » affiche 2 — le nombre contre lequel la carte s'est protegee " +
      "— ET ou le nombre de seances terminees concorde (6 des deux cotes). Aucun hote ne " +
      "permettait en plus d'aligner les trajectoires.",
  },
  {
    id: "v2-test-physique-en-recul",
    progression: "test-physique-en-recul",
    hote: "tendance-indisponible",
    qualite: "exact",
    ecart: null,
    pourquoiCetHote:
      "Entree DERIVEE de cette fixture Home (progressionInputDepuisHome) : memes seances, meme " +
      "semaine, ET surtout le meme cycle actif — Fondation. C'est le cycle qui, volontairement, " +
      "n'a aucun test associe : la carte tombe donc sur la regle 2 puis sur le departage, et " +
      "affiche un RECUL alors que deux ameliorations existaient dans la meme batterie. Un hote " +
      "au cycle different aurait fait mentir la demonstration : la regle de selection lit le " +
      "cycle actif, et l'ecran d'accueil l'affiche.",
  },
  {
    id: "v2-aucune-comparaison-de-test",
    progression: "aucune-comparaison-de-test",
    hote: "seance-prevue-aujourdhui",
    qualite: "approximatif",
    ecart:
      "Visible UNIQUEMENT en cote a cote, pas sur l'ecran de la variante 2. Les deux courbes ne " +
      "tracent pas la meme serie : 7 points a gauche (« Ma forme »), 6 a droite (la carte), " +
      "valeurs differentes. Meme cause que pour l'etat precedent : deux fixtures ecrites " +
      "separement. Ne juge pas la forme des traces sur cet etat.",
    pourquoiCetHote:
      "C'est l'ecran de reference du prototype — la journee ordinaire, celle sur laquelle la " +
      "variante 1 a ete validee. « Ma semaine » y affiche 1, comme la carte le suppose, et le " +
      "nombre de seances terminees concorde (5 des deux cotes).",
  },
  {
    id: "v2-donnee-manquante",
    progression: "donnee-manquante",
    hote: "tendance-indisponible",
    qualite: "approximatif",
    ecart:
      "Visible UNIQUEMENT en cote a cote, pas sur l'ecran de la variante 2. A gauche, le bloc " +
      "« Ma forme » compte 2 seances terminees et annonce qu'il en manque 2 ; a droite, la carte " +
      "en compte 3 et annonce qu'il en manque 1. La fixture de carte a ete ecrite pour prouver " +
      "une seule chose — qu'un fait sans donnee DISPARAIT au lieu d'afficher 0 — et aucune " +
      "fixture Home ne porte 3 seances terminees. Sur l'ecran de la variante 2 pris seul, " +
      "aucune contradiction : le bloc « Ma forme » n'y est pas.",
    pourquoiCetHote:
      "Le moins mauvais des hotes possibles : le seul ou « Ma semaine » affiche 1 ET ou la " +
      "variante 1 n'affiche aucune courbe. Sur tout autre hote, la colonne de gauche aurait " +
      "trace une trajectoire pendant que la carte annonce qu'il n'y en a pas encore — une " +
      "contradiction plus voyante que l'ecart de comptage.",
  },
];

/**
 * Regroupement pour la liste laterale du visualiseur.
 * Les six cas demandes d'un cote, la preuve d'honnetete de l'autre : ce n'est
 * pas un etat du produit, il ne doit pas se melanger aux six.
 */
const GROUPES_VARIANTE2 = [
  {
    titre: "Variante 2 — la carte progression",
    aide:
      "Le bas de l'ecran : une vraie carte a la place du lien flottant. Choisir un de ces cas " +
      "bascule automatiquement sur la variante 2.",
    etats: [
      "v2-nouveau-joueur",
      "v2-deux-seances-tendance-indisponible",
      "v2-tendance-disponible",
      "v2-test-physique-ameliore",
      "v2-test-physique-en-recul",
      "v2-aucune-comparaison-de-test",
    ],
  },
  {
    titre: "Variante 2 — preuve d'honnetete",
    aide:
      "Hors des six cas : ce qui s'affiche quand une donnee n'existe pas. Ni 0, ni tiret — le " +
      "fait disparait.",
    etats: ["v2-donnee-manquante"],
  },
];

const parId = (id) => APPARIEMENTS.find((a) => a.id === id) || null;
const parProgression = (id) => APPARIEMENTS.find((a) => a.progression === id) || null;

// ---------------------------------------------------------------------------
// 2. LE SAC DE PROPS
// ---------------------------------------------------------------------------
// `screens/homeVNext/HomeVNextScreen.tsx` declare une union discriminee :
//     { variante?: "v1" } | { variante: "v2"; progression: ProgressionViewModel }
// On passe donc EXACTEMENT ce contrat, rien de plus. Pas de sac de variantes
// devinees « au cas ou » : si le contrat changeait, un sac de synonymes ferait
// passer le changement inapercu, alors que la detection de la section 5 le
// signale immediatement, avec la marche a suivre.
//
// Les callbacks sont inertes : un prototype ne navigue pas.
// `largeurCourbe` n'est volontairement PAS passe — la variante 1 ne le passe pas
// non plus, la largeur vient du `onLayout` bouchonne (lib/dom.js). Les deux
// variantes doivent traverser exactement la meme chaine, sinon un ecart de rendu
// pourrait venir du harnais et non du produit.
// ---------------------------------------------------------------------------
const VALEUR_VARIANTE = "v2";

/**
 * Options passees a `buildHomeVNextViewModel` pour un ecran de VARIANTE 2.
 *
 * Ce n'est pas un detail de harnais : c'est ce qui active, DANS LE VIEWMODEL, le
 * verrou qui retire la pastille d'etat du jour tant que les entrainements club
 * ne sont pas captures. Sans ces options, l'ecran de la variante 2 continuerait
 * d'annoncer « En forme » a 200 px au-dessus d'une carte qui ecrit « tes
 * entrainements club n'y sont pas comptes ».
 *
 * `chargesClubCapturees` n'est PAS repete ici : le defaut du ViewModel est
 * `false`, et c'est l'etat reel de l'app. Le forcer a la main donnerait
 * l'illusion d'un reglage du prototype alors que c'est un fait du produit.
 */
const OPTIONS_VM_VARIANTE2 = { variante: VALEUR_VARIANTE };

/**
 * @param {object} o
 * @param {?object} o.presentation props `echelle` / `reduceMotion` de l'axe
 *   presentation (voir lib/presentations.js). VIDE pour la combinaison par
 *   defaut : on ne pose alors AUCUNE des deux props, et l'ecran applique ses
 *   propres valeurs par defaut — exactement comme avant l'ajout de cet axe.
 */
function propsVariante2({ homeVm, progVm, nav, presentation }) {
  const rien = () => {};
  return {
    vm: homeVm,
    variante: VALEUR_VARIANTE,
    progression: progVm,
    onAction: rien,
    onSecondaryAction: rien,
    onExit: rien,
    navigation: nav,
    route: { key: "harnais", name: "HomeVNext", params: { variante: VALEUR_VARIANTE } },
    ...(presentation || {}),
  };
}

/** Les cles reellement passees, pour les afficher quand la carte n'est pas trouvee. */
function clesDuSac(presentation) {
  return Object.keys(
    propsVariante2({ homeVm: null, progVm: null, nav: null, presentation })
  );
}

// ---------------------------------------------------------------------------
// 3. LES MARQUEURS STRUCTURELS
// ---------------------------------------------------------------------------
// Poses par les composants (components/homeVNext/homeVNextMarqueurs.ts). Les
// compter, c'est prouver ; les lire a l'oeil sur des dizaines de pages, c'est se
// tromper.
//
// ATTENTION, DEUX ATTRIBUTS DIFFERENTS — verifie dans le HTML genere, pas
// suppose :
//   - `testID`   -> react-native-web ecrit `data-testid="..."` ;
//   - `nativeID` -> react-native-web ecrit `id="..."`.
// `HomeVNextAction.tsx` utilise `nativeID` pour l'aplat et l'accuse de
// reception. Les chercher en `data-testid` renvoie donc 0 — un compteur toujours
// a zero qui ressemble a une regle respectee. C'est exactement le genre de
// mesure fausse que ce harnais ne doit pas produire.
// ---------------------------------------------------------------------------
const MARQUEURS = {
  // --- poses par testID -> data-testid ---
  actionPrincipale: "home-vnext-action-principale",
  lienSecondaire: "home-vnext-lien-secondaire",
  lienSortie: "home-vnext-lien-sortie",
  courbe: "home-vnext-courbe",
  formeInsuffisante: "home-vnext-forme-insuffisante",
  semaine: "home-vnext-semaine",
  conseil: "home-vnext-conseil",
  progression: "home-vnext-progression",
  progressionDetail: "home-vnext-progression-detail",
  progressionFait: "home-vnext-progression-fait",
  progressionTest: "home-vnext-progression-test",
  progressionPortee: "home-vnext-progression-portee",
  /**
   * La pastille d'etat du jour, dans l'en-tete. Bloc de la variante 1, mais
   * MESURE ici : en variante 2, elle ne doit plus exister tant que les charges
   * club ne sont pas capturees. Sans ce marqueur, la seule facon de la chercher
   * serait une liste de mots — et une liste de mots se perime en silence.
   */
  etatDuJour: "home-vnext-etat-du-jour",
};

/** Poses par nativeID -> id. Separes pour qu'on ne les cherche jamais du mauvais cote. */
const MARQUEURS_ID = {
  aplat: "home-vnext-aplat",
  accuseReception: "home-vnext-accuse-reception",
};

// ---------------------------------------------------------------------------
// 4. NORMALISATION DE TEXTE
// ---------------------------------------------------------------------------
// Chercher une phrase du ViewModel dans un rendu HTML demande de neutraliser
// tout ce qui peut differer sans changer le sens : accents, casse, espaces
// multiples, apostrophes typographiques, tirets longs, espaces insecables.
// Sans ca, « Encore 2 seances avant d'afficher une tendance. » (apostrophe
// U+2019 dans le ViewModel) ne se retrouverait pas dans un rendu qui l'a
// normalisee.
// ---------------------------------------------------------------------------
function decoderEntites(s) {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

// Les classes de caracteres sont ecrites en ECHAPPEMENTS UNICODE et non en
// caracteres litteraux : un fichier source qui voyage entre encodages peut
// perdre un signe diacritique combinant sans que personne le voie, et la
// detection deviendrait alors silencieusement inoperante.
const DIACRITIQUES = /[\u0300-\u036f]/g; // signes combinants laisses par NFD
const APOSTROPHES = /[\u2018\u2019\u02bc]/g; // guillemets simples courbes
const TIRETS = /[\u2013\u2014\u2212]/g; // demi-cadratin, cadratin, moins
const ESPACES_SPECIAUX = /[\u00a0\u202f\u2009]/g; // insecable, insecable fine, fine

function normaliser(s) {
  return decoderEntites(s == null ? "" : s)
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .replace(APOSTROPHES, "'")
    .replace(TIRETS, "-")
    .replace(ESPACES_SPECIAUX, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Texte visible d'un balisage d'ecran (le HTML rendu, sans les balises). */
function texteDe(html) {
  return normaliser(String(html || "").replace(/<[^>]*>/g, " "));
}

// ---------------------------------------------------------------------------
// 5. LES MARQUEURS DE TEXTE
// ---------------------------------------------------------------------------
// Le marqueur structurel prouve que la CARTE est la. Ces marqueurs-ci prouvent
// autre chose, et c'est complementaire : que les phrases decidees par le
// ViewModel arrivent bien A L'ECRAN, mot pour mot. Une carte presente mais qui
// reformulerait ses chiffres serait une carte qui n'obeit plus au contrat.
//
// Ils sont DERIVES du ViewModel, jamais ecrits en dur : si le contrat change ses
// libelles, la verification suit toute seule.
//
// DEUX NIVEAUX, ET LA DISTINCTION EST DECISIVE
// -----------------------------------------------------------------------------
// `requis: true` — la phrase porte un CHIFFRE MESURE ou la portee de la courbe.
//   Son absence n'est pas un choix de redaction : c'est un fait promis par le
//   contrat qui n'atteint pas le joueur. C'est ce que compte le controle.
//
// `requis: false` — formulation editoriale que le composant peut legitimement
//   dire autrement ou fondre ailleurs. Verifiee et affichee, mais sans verdict.
//
// Deux cas reels, tous deux LUS dans le composant et non supposes :
//   - en etat "ready", `titre` ("TA PROGRESSION") n'est pas rendu : il
//     repeterait mot pour mot le titre de section imprime juste au-dessus
//     (HomeVNextProgression.tsx, note l.379-381). L'exiger ferait echouer une
//     decision de mise en page saine ;
//   - en etat "collecting", l'explication complete ("Encore 2 seances avant
//     d'afficher une tendance.") est rendue sous forme de ligne de fait
//     (« Avant d'afficher une tendance / Encore 2 seances »), qui porte le meme
//     nombre. Le CHIFFRE reste exige — c'est la ligne de fait qui le prouve.
// ---------------------------------------------------------------------------
function marqueursDe(progVm) {
  if (!progVm) return [];
  const m = [{ cle: "titre", requis: false, texte: progVm.titre, quoi: "titre de la carte" }];

  if (progVm.state === "empty") {
    m.push({ cle: "mention", requis: true, texte: progVm.mention, quoi: "mention « 0 seance terminee »" });
    (progVm.reperes || []).forEach((r) => {
      m.push({ cle: `repere-${r.numero}`, requis: true, texte: r.texte, quoi: `repere ${r.numero}` });
    });
  }

  if (progVm.state === "collecting") {
    (progVm.faits || []).forEach((f) => {
      m.push({ cle: `fait-${f.cle}`, requis: true, texte: f.valeur, quoi: `fait « ${f.libelle} »` });
    });
    if (progVm.tendanceIndisponible) {
      m.push({
        cle: "tendance-indisponible",
        requis: false,
        texte: progVm.tendanceIndisponible.explication,
        quoi: "explication complete de l'absence de tendance",
      });
    }
  }

  if (progVm.state === "ready") {
    if (progVm.resume) {
      m.push({
        cle: "resume",
        requis: true,
        texte: progVm.resume.valeur,
        quoi: `fait « ${progVm.resume.libelle} »`,
      });
    }
    if (progVm.courbe) {
      m.push({
        cle: "portee",
        requis: true,
        texte: progVm.courbe.portee,
        quoi: "portee de la tendance (R3)",
      });
    }
  }

  const cmp = progVm.repereTest ? progVm.repereTest.comparaison : null;
  if (cmp) {
    m.push({
      cle: "comparaison",
      requis: true,
      texte: cmp.ecartAffiche,
      quoi: `ecart du test « ${cmp.label} »`,
    });
  } else if (progVm.comparaisonsTests && progVm.comparaisonsTests.possible === false) {
    m.push({
      cle: "comparaison-impossible",
      requis: false,
      texte: progVm.comparaisonsTests.explication,
      quoi: "explication de l'absence de comparaison",
    });
  }

  if (progVm.detail && progVm.detail.affiche && progVm.detail.label) {
    m.push({
      cle: "detail",
      requis: true,
      texte: progVm.detail.label,
      quoi: "lien secondaire vers le detail",
    });
  }
  return m;
}

// ---------------------------------------------------------------------------
// 6. MESURE D'UN RENDU DE VARIANTE 2
// ---------------------------------------------------------------------------
// Chaque mesure repond a une regle du cadre ou a la question que le fondateur
// pose. Aucune n'est une opinion. Chacune porte son ATTENDU, pour que le
// visualiseur puisse afficher un verdict et pas seulement un nombre.
// ---------------------------------------------------------------------------

/** Le mot « serie » sous toutes ses formes (R6). Meme motif que verifier.js. */
const MOTIF_SERIE = /s[ée]rie|streak|jours? d['’]affil[ée]e|flamme|🔥/i;

/**
 * Libelles d'etat physique global interdits tant que les charges club sont
 * inconnues (R4).
 *
 * LISTE CORRIGEE PAR L'AUDIT. Elle ne contenait que « EN FORME » comme vrai
 * libelle ; les trois autres entrees sont des fragments de MESSAGE
 * (`FOOTBALL_LABELS[].message`), pas des libelles. Cinq des six libelles
 * reellement produits par `getFootballLabel` (`config/trainingDefaults.ts`:145-152)
 * n'etaient donc pas cherches du tout — dont « Un peu charge », qui est celui
 * effectivement rendu sur deux des six ecrans de la variante 2.
 *
 * Source canonique des six libelles : `FOOTBALL_LABELS` (trainingDefaults.ts).
 * Ils sont recopies ici en forme normalisee (majuscules, sans diacritiques)
 * parce que ce harnais est du JavaScript et ne peut pas importer le module TS.
 *
 * « FRAIS » est volontairement ABSENT : la comparaison se fait par
 * `String.includes`, et ce mot de cinq lettres declencherait des faux positifs
 * sur du texte ordinaire. Le controle exact de la pastille ne repose de toute
 * facon plus sur cette liste — il lit le marqueur `etatDuJour` directement.
 */
const ETATS_GLOBAUX_INTERDITS = [
  // Les libelles reels de FOOTBALL_LABELS.
  "EN FORME",
  "UN PEU CHARGE",
  "A ALLEGER",
  "JOURNEE LEGERE",
  "REPRISE DOUCE",
  // Fragments de message historiques, conserves : ils ne doivent pas plus
  // apparaitre dans la carte que les libelles eux-memes.
  "PRET A PERFORMER",
  "PRETE A PERFORMER",
  "BIEN REPOSE",
];

/** Premier entier d'une valeur affichee. "76 min" -> 76 ; "Encore 2 seances" -> 2. */
function premierEntier(valeur) {
  const m = String(valeur == null ? "" : valeur).match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * @param {string} html      balisage rendu de l'ecran entier, en variante 2
 * @param {object} homeVm    ViewModel du Home
 * @param {object} progVm    ViewModel de la carte
 * @param {?string} htmlCarte balisage de la SEULE carte, extrait par l'appelant.
 *   Indispensable pour les regles qui portent sur la carte et pas sur l'ecran :
 *   « En forme » lu dans la pastille d'en-tete du Home n'est pas la carte qui
 *   annonce un etat global. Sans cette distinction, la mesure accuserait le
 *   mauvais bloc. Si l'appelant ne peut pas l'extraire, ces controles sont
 *   marques indisponibles plutot que devines.
 */
function mesurerVariante2(html, homeVm, progVm, htmlCarte) {
  const brut = String(html || "");
  const texte = texteDe(brut);
  const texteCarte = htmlCarte == null ? null : texteDe(htmlCarte);
  const compter = (id) => (brut.match(new RegExp(`data-testid="${id}"`, "g")) || []).length;
  const compterId = (id) => (brut.match(new RegExp(`id="${id}"`, "g")) || []).length;
  const contient = (s) => (s ? texte.includes(normaliser(s)) : false);
  const carteContient = (s) => (s && texteCarte != null ? texteCarte.includes(normaliser(s)) : false);

  // Les phrases du contrat sont cherchees DANS LA CARTE quand on a su l'isoler :
  // les retrouver ailleurs sur l'ecran ne prouverait rien.
  const chercher = texteCarte != null ? carteContient : contient;
  const marqueurs = marqueursDe(progVm).map((m) => ({ ...m, trouve: chercher(m.texte) }));

  // R6 : on cherche dans le texte NON normalise — les accents disparus
  // rendraient le motif inoperant.
  const texteBrut = decoderEntites(brut.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
  const serie = texteBrut.match(MOTIF_SERIE);

  const nombreSemaine = homeVm && homeVm.week ? homeVm.week.doneCount : null;

  // R7 : « Ma semaine » parle de la semaine, la carte parle du cumul. On ne
  // compare QUE les faits qui comptent des seances — un compte a rebours
  // (« Encore 1 seance ») n'est pas le meme genre de nombre et n'a jamais ete
  // concerne par la regle.
  const comptesDeSeances = [];
  if (progVm && progVm.state === "collecting") {
    (progVm.faits || [])
      .filter((f) => f.cle === "seances_terminees")
      .forEach((f) => comptesDeSeances.push({ ou: "fait", valeur: f.valeur, n: premierEntier(f.valeur) }));
  }
  if (progVm && progVm.state === "ready" && progVm.resume && progVm.resume.cle === "seances_terminees") {
    comptesDeSeances.push({ ou: "resume", valeur: progVm.resume.valeur, n: premierEntier(progVm.resume.valeur) });
  }

  const faitsAttendus =
    progVm && progVm.state === "collecting" ? progVm.faits.length : progVm && progVm.state === "ready" ? 1 : 0;

  // Ce que l'en-tete de CE rendu affiche (le ViewModel du Home a ete construit
  // avec les options de la variante 2, donc cette valeur est celle de la colonne
  // de droite, jamais celle de la variante 1).
  const chipHomeV2 =
    homeVm && homeVm.header && homeVm.header.stateChip ? homeVm.header.stateChip.label : null;

  const controles = [
    {
      cle: "carte",
      question: "La carte progression est-elle a l'ecran ?",
      valeur: compter(MARQUEURS.progression),
      attendu: 1,
      pourquoi: "Sans elle, ce qui s'affiche est la variante 1 sous une fausse etiquette.",
    },
    {
      cle: "lien_flottant",
      question: "Le lien de sortie qui flottait en bas d'ecran a-t-il disparu ?",
      valeur: compter(MARQUEURS.lienSortie),
      attendu: 0,
      pourquoi:
        "C'est la demande meme du fondateur : remplacer, pas ajouter. S'il vaut 1, la carte " +
        "s'est ajoutee au lieu de prendre la place. On compte le MARQUEUR du bloc de sortie de la " +
        "variante 1, pas son texte : le pied de la carte porte desormais les memes mots (« Voir ma " +
        "progression »), puisqu'il mene au meme ecran.",
    },
    {
      cle: "bloc_forme",
      question: "Le bloc « Ma forme » a-t-il bien ete absorbe ?",
      valeur: compter(MARQUEURS.formeInsuffisante) + compter(MARQUEURS.courbe),
      attendu: progVm && progVm.state === "ready" ? 1 : 0,
      pourquoi:
        "En variante 2, la carte remplace « Ma forme ». Une valeur superieure a l'attendu " +
        "signifie deux blocs de tendance sur le meme ecran.",
    },
    {
      cle: "action_principale",
      question: "Combien d'actions principales ?",
      valeur: compter(MARQUEURS.actionPrincipale),
      attendu: 1,
      pourquoi: "Doctrine 1 : une seule chose a faire aujourd'hui.",
    },
    {
      cle: "aplat",
      question: "Combien d'aplats colores sur tout l'ecran ? (R8)",
      valeur: compterId(MARQUEURS_ID.aplat),
      attendu: homeVm && homeVm.action && homeVm.action.emphasis === "aplat" ? 1 : 0,
      pourquoi:
        "« Voir le detail » doit rester un lien texte. Si la carte ajoutait un fond colore en bas " +
        "d'ecran, ce compteur passerait a 2 et l'oeil irait vers lui au lieu de l'action du jour. " +
        "L'attendu vaut 0 sur les etats ou l'action du jour est un accuse de reception et non un " +
        "bouton.",
    },
    {
      cle: "detail",
      question: "Le pied « Voir le detail » suit-il le contrat ?",
      valeur: compter(MARQUEURS.progressionDetail),
      attendu: progVm && progVm.detail && progVm.detail.affiche ? 1 : 0,
      pourquoi:
        "Le ViewModel decide seul d'envoyer ou non vers la page Progression, et dit pourquoi " +
        "dans les deux sens.",
    },
    {
      cle: "faits",
      question: "Combien de lignes de fait mesure ? (R1)",
      valeur: compter(MARQUEURS.progressionFait),
      attendu: faitsAttendus,
      pourquoi:
        "Un fait sans donnee doit DISPARAITRE. Sur « Donnee manquante », l'attendu tombe a 2 : " +
        "si l'ecran en affiche 4, deux d'entre eux valent 0 ou un tiret.",
    },
    {
      cle: "portee",
      question: "La portee de la tendance est-elle a l'ecran ? (R3)",
      valeur: compter(MARQUEURS.progressionPortee),
      attendu: progVm && progVm.state === "ready" ? 1 : 0,
      pourquoi:
        "Une courbe sans sa portee laisse croire qu'elle mesure l'etat physique global du " +
        "joueur. Elle ne mesure que les seances FKS.",
    },
    {
      cle: "phrases",
      question: "Les chiffres du contrat arrivent-ils mot pour mot ?",
      valeur: marqueurs.filter((m) => m.requis && m.trouve).length,
      attendu: marqueurs.filter((m) => m.requis).length,
      pourquoi:
        "Ne compte que les phrases porteuses d'un chiffre mesure ou de la portee de la courbe. " +
        "Une carte presente mais qui reformulerait ses chiffres serait une carte qui n'obeit plus " +
        "au contrat. Les formulations editoriales, elles, peuvent legitimement etre dites " +
        "autrement : elles sont listees a part, sans verdict.",
    },
    {
      cle: "mot_interdit",
      question: "Le mot « serie » apparait-il ? (R6)",
      valeur: serie ? 1 : 0,
      attendu: 0,
      pourquoi: "Ni le mot, ni la metrique, ni la flamme. Regle absolue.",
      trouve: serie ? serie[0] : null,
    },
    {
      cle: "etat_global_carte",
      question: "La CARTE annonce-t-elle un etat physique global ? (R4)",
      valeur:
        texteCarte == null ? 0 : ETATS_GLOBAUX_INTERDITS.filter((e) => texteCarte.includes(e)).length,
      attendu: 0,
      indisponible: texteCarte == null,
      pourquoi:
        "Tant que les entrainements club ne sont pas captures, l'app ne sait pas dans quel etat " +
        "est le joueur. Le contrat de la carte l'interdit par le type ; on verifie le RENDU.",
      trouve:
        texteCarte == null
          ? "carte non isolee : controle indisponible"
          : ETATS_GLOBAUX_INTERDITS.filter((e) => texteCarte.includes(e)).join(", ") || null,
    },
    {
      cle: "etat_global_entete",
      question: "L'ECRAN annonce-t-il un etat physique global ? (D1, ecran entier)",
      // DEUX FILETS, PAS UN. Le marqueur seul ne suffit plus : depuis que
      // `HomeVNextScreen` retire lui-meme le stateChip en variante 2, il vaut 0
      // par construction et le controle passerait au vert meme si un libelle
      // d'etat reapparaissait ailleurs sur l'ecran (dans un message, un conseil,
      // un sous-titre). On compte donc AUSSI les libelles interdits dans le
      // texte rendu de l'ecran entier.
      valeur:
        compter(MARQUEURS.etatDuJour) +
        ETATS_GLOBAUX_INTERDITS.filter((libelle) => texte.includes(libelle)).length,
      // ATTENDU 0, EN DUR, ET C'EST VOULU. Il etait auparavant derive de
      // `progVm.etatGlobal.connu` — un champ SUPPRIME du contrat (decision D1
      // du fondateur, 2026-07-28). L'expression valait donc toujours 0 : le
      // controle etait trivialement vrai et ne protegeait plus rien. D1 ne dit
      // pas « tant que les charges club ne sont pas capturees », elle dit
      // « aucun jugement global, point » — l'attendu ne depend donc plus
      // d'aucune donnee d'entree.
      attendu: 0,
      pourquoi:
        "Le controle precedent ne regarde que la carte. Celui-ci regarde l'ECRAN : c'est la ou le " +
        "defaut se voyait. Annoncer « En forme » dans l'en-tete, puis ecrire 200 px plus bas " +
        "« tes entrainements club n'y sont pas comptes », c'est un ecran qui se contredit lui-meme. " +
        "Decision D1 : en variante 2 il n'y a plus de pastille du tout, et plus aucun libelle " +
        "d'etat global nulle part sur l'ecran ; la variante 1 garde la sienne pour que l'ecart " +
        "reste visible.",
      trouve:
        compter(MARQUEURS.etatDuJour) > 0 && chipHomeV2
          ? `pastille rendue : « ${chipHomeV2} »`
          : ETATS_GLOBAUX_INTERDITS.filter((libelle) => texte.includes(libelle)).join(", ") ||
            "aucune pastille d'etat, aucun libelle d'etat global sur l'ecran",
    },
    {
      cle: "doublon_semaine",
      question: "La carte reaffiche-t-elle le nombre de « Ma semaine » ? (R7)",
      valeur: nombreSemaine != null && comptesDeSeances.some((c) => c.n === nombreSemaine) ? 1 : 0,
      attendu: 0,
      pourquoi:
        "« Ma semaine » parle de la semaine en cours, la carte du cumul. Le meme nombre aux " +
        "deux endroits ferait croire a une redite.",
      trouve:
        nombreSemaine != null
          ? `« Ma semaine » affiche ${nombreSemaine} ; la carte compte ` +
            (comptesDeSeances.map((c) => c.valeur).join(", ") || "aucune seance")
          : "aucun bloc « Ma semaine » a l'ecran",
    },
  ];

  const echecs = controles.filter((c) => !c.indisponible && c.valeur !== c.attendu);

  // ---------------------------------------------------------------------------
  // Observations : ce que la mesure a vu SANS que ce soit un defaut de la
  // variante 2. On les separe des controles pour ne pas melanger « la carte a un
  // probleme » et « l'ecran d'accueil en a un ». Les taire serait pire : le
  // fondateur regarde bien l'ecran entier.
  // ---------------------------------------------------------------------------
  const observations = [];
  marqueurs
    .filter((m) => !m.requis && !m.trouve)
    .forEach((m) => {
      observations.push({
        cle: `phrase-${m.cle}`,
        texte:
          `Formulation non retrouvee dans la carte : ${m.quoi} — « ${m.texte} ». Ce n'est pas un ` +
          "defaut en soi : cette phrase ne porte aucun chiffre mesure, le composant peut l'avoir " +
          "dite autrement ou fondue dans un autre element. A lire une fois pour verifier que rien " +
          "d'utile ne s'est perdu.",
      });
    });

  // FILET DE SECURITE, ET RIEN D'AUTRE.
  //
  // La pastille d'en-tete est desormais mesuree par un CONTROLE (`etat_global_entete`),
  // sur son marqueur : c'est exact, et aucune liste de mots ne peut le perimer.
  // Cette observation-ci sert au cas restant : un libelle d'etat global qui
  // apparaitrait AILLEURS sur l'ecran — ni dans la carte, ni dans la pastille.
  // On le signale au lieu de le laisser passer, sans en faire un verdict : la
  // comparaison se fait par `includes`, elle peut mordre sur du texte ordinaire.
  const etatsSurEcran = ETATS_GLOBAUX_INTERDITS.filter((e) => texte.includes(e));
  const etatsDansLaPastille =
    chipHomeV2 != null ? etatsSurEcran.filter((e) => normaliser(chipHomeV2).includes(e)) : [];
  const etatsAilleurs = etatsSurEcran.filter((e) => !etatsDansLaPastille.includes(e));
  if (etatsAilleurs.length) {
    observations.push({
      cle: "etat_global_ecran",
      texte:
        `L'ecran affiche « ${etatsAilleurs.join(", ")} » hors de la carte et hors de la pastille ` +
        "d'etat du jour. Origine a identifier : soit un troisieme endroit annonce un etat physique " +
        "global, soit ces mots apparaissent dans une phrase ordinaire. A lire une fois.",
    });
  }

  return {
    carteDetectee: compter(MARQUEURS.progression) === 1,
    carteIsolee: texteCarte != null,
    controles,
    observations,
    echecs: echecs.length,
    clesEnEchec: echecs.map((c) => c.cle),
    marqueurs,
    marqueursTrouves: marqueurs.filter((m) => m.trouve).length,
    marqueursTotal: marqueurs.length,
    longueurTexte: texte.length,
    longueurTexteCarte: texteCarte == null ? null : texteCarte.length,
  };
}

// ---------------------------------------------------------------------------
// 7. AUDIT DE COHERENCE DE L'APPARIEMENT
// ---------------------------------------------------------------------------
// Recalcule a chaque generation. Ne regarde QUE des choses affichees, et dit OU
// elles s'affichent — la distinction est decisive : depuis que l'ecran absorbe
// le bloc « Ma forme », une contradiction entre les deux fixtures ne peut plus
// apparaitre sur l'ecran de la variante 2, mais elle saute aux yeux dans la vue
// cote a cote, qui est justement celle que le fondateur va utiliser.
//
// `ou` :
//   "ecran_v2"   — se voit sur l'ecran de la variante 2, seul.
//   "cote_a_cote"— ne se voit qu'en comparant les deux colonnes.
//
// Verdicts :
//   "coherent"   — les deux cotes disent la meme chose.
//   "divergent"  — ils se contredisent. C'est un defaut, il doit etre declare.
//   "sans_objet" — la question ne se pose pas dans cet etat.
// ---------------------------------------------------------------------------
function auditerCoherence({ homeVm, progVm, progressionInput }) {
  const points = [];
  const ajouter = (cle, libelle, ou, verdict, detail) =>
    points.push({ cle, libelle, ou, verdict, detail });

  // --- 1. « Ma semaine » : le nombre suppose est-il celui affiche ? ---------
  const semaineAffichee = homeVm && homeVm.week ? homeVm.week.doneCount : null;
  const suppose = progressionInput ? progressionInput.semaineCourante : null;
  if (!suppose) {
    ajouter("semaine", "« Ma semaine » et le garde-fou R7", "ecran_v2", "sans_objet",
      "Entree de carte sans hypothese de semaine.");
  } else if (suppose.blocAffiche !== (homeVm && homeVm.week != null)) {
    ajouter("semaine", "« Ma semaine » et le garde-fou R7", "ecran_v2", "divergent",
      `La carte suppose le bloc « Ma semaine » ${suppose.blocAffiche ? "affiche" : "absent"}, ` +
        `l'ecran l'affiche ${homeVm && homeVm.week ? "bien" : "pas"}.`);
  } else if (suppose.blocAffiche && suppose.seancesAffichees !== semaineAffichee) {
    ajouter("semaine", "« Ma semaine » et le garde-fou R7", "ecran_v2", "divergent",
      `La carte a calcule son garde-fou R7 contre ${suppose.seancesAffichees}, l'ecran affiche ` +
        `${semaineAffichee}. Le garde-fou ne protege donc rien ici.`);
  } else {
    ajouter("semaine", "« Ma semaine » et le garde-fou R7", "ecran_v2", "coherent",
      suppose.blocAffiche
        ? `Le bloc affiche ${semaineAffichee} — exactement le nombre contre lequel la carte s'est protegee.`
        : "Aucun bloc « Ma semaine » a l'ecran, et la carte le sait.");
  }

  // --- 2. Ce que la carte remplace ------------------------------------------
  const formeV1 = homeVm && homeVm.form ? homeVm.form : null;
  ajouter("absorption", "Ce que la carte remplace", "ecran_v2", "coherent",
    (formeV1
      ? formeV1.kind === "available"
        ? `Le bloc « Ma forme » de la variante 1 (courbe de ${formeV1.points.length} points) n'est pas rendu.`
        : `Le bloc « Ma forme » de la variante 1 (« ${formeV1.title} ») n'est pas rendu.`
      : "La variante 1 n'affichait aucun bloc « Ma forme » sur cet etat.") +
      " " +
      (homeVm && homeVm.exit
        ? `Le lien flottant « ${homeVm.exit.label} » n'est pas rendu non plus.`
        : "La variante 1 n'affichait aucun lien de sortie sur cet etat.") +
      " " +
      (progVm && progVm.detail && progVm.detail.affiche
        ? `La carte propose « ${progVm.detail.label} » a la place.`
        : "La carte ne propose aucun voyage vers la page Progression, et dit pourquoi."));

  // --- 3. Les deux colonnes du cote a cote ----------------------------------
  const courbeV1 = Boolean(formeV1 && formeV1.kind === "available");
  const courbeV2 = Boolean(progVm && progVm.state === "ready" && progVm.courbe);
  if (courbeV1 && courbeV2) {
    const a = formeV1.points.map((v) => Number(v).toFixed(4)).join(",");
    const b = progVm.courbe.points.map((v) => Number(v).toFixed(4)).join(",");
    ajouter("meme_serie", "Les deux colonnes tracent-elles la meme serie ?", "cote_a_cote",
      a === b ? "coherent" : "divergent",
      a === b
        ? `Oui : ${progVm.courbe.points.length} points identiques de part et d'autre.`
        : `Non. Variante 1 : ${formeV1.points.length} points. Variante 2 : ` +
          `${progVm.courbe.points.length} points, autres valeurs. ARTEFACT DE L'APPARIEMENT du ` +
          "prototype : les deux fixtures ont ete ecrites separement.");
    ajouter("meme_portee", "La portee annoncee est-elle la meme ?", "cote_a_cote",
      formeV1.scope === progVm.courbe.portee ? "coherent" : "divergent",
      formeV1.scope === progVm.courbe.portee
        ? "Oui, mot pour mot — les deux blocs disent la meme chose de ce qu'ils mesurent."
        : `Variante 1 : « ${formeV1.scope} ». Variante 2 : « ${progVm.courbe.portee} ».`);
  } else {
    ajouter("meme_serie", "Les deux colonnes tracent-elles la meme serie ?", "cote_a_cote", "sans_objet",
      courbeV1
        ? "Seule la variante 1 trace une courbe sur cet etat."
        : courbeV2
        ? "Seule la variante 2 trace une courbe sur cet etat."
        : "Aucune des deux colonnes ne trace de courbe.");
  }

  // --- 4. Le compte de seances annonce de part et d'autre -------------------
  const insuffisantV1 = Boolean(formeV1 && formeV1.kind === "insufficient");
  const nbCarte = progressionInput ? progressionInput.seancesTerminees.length : null;
  if (insuffisantV1 && nbCarte != null && typeof formeV1.completedCount === "number") {
    ajouter("compte_seances", "Le nombre de seances terminees", "cote_a_cote",
      formeV1.completedCount === nbCarte ? "coherent" : "divergent",
      formeV1.completedCount === nbCarte
        ? `Les deux colonnes comptent ${nbCarte} seances terminees.`
        : `La variante 1 en compte ${formeV1.completedCount}, la variante 2 en compte ${nbCarte}. ` +
          "Deux nombres contradictoires d'une colonne a l'autre.");
  } else {
    ajouter("compte_seances", "Le nombre de seances terminees", "cote_a_cote", "sans_objet",
      "La variante 1 n'annonce pas de compte de seances sur cet etat.");
  }

  // --- 5. Le manque annonce avant la tendance -------------------------------
  const manqueV2 =
    progVm && progVm.state === "collecting" && progVm.tendanceIndisponible
      ? progVm.tendanceIndisponible.manque
      : null;
  if (insuffisantV1 && manqueV2 != null && typeof formeV1.requiredCount === "number") {
    const manqueV1 = formeV1.requiredCount - formeV1.completedCount;
    ajouter("manque_annonce", "Ce qu'il manque avant une tendance", "cote_a_cote",
      manqueV1 === manqueV2 ? "coherent" : "divergent",
      manqueV1 === manqueV2
        ? `Les deux colonnes annoncent le meme manque : ${manqueV2}.`
        : `La variante 1 annonce ${manqueV1}, la variante 2 annonce ${manqueV2}.`);
  } else {
    ajouter("manque_annonce", "Ce qu'il manque avant une tendance", "cote_a_cote", "sans_objet",
      "Aucun manque annonce des deux cotes.");
  }

  const divergentes = points.filter((p) => p.verdict === "divergent");
  return {
    points,
    divergences: divergentes.length,
    divergencesEcran: divergentes.filter((p) => p.ou === "ecran_v2").length,
    divergencesCoteACote: divergentes.filter((p) => p.ou === "cote_a_cote").length,
    qualiteCalculee: divergentes.length === 0 ? "exact" : "approximatif",
  };
}

module.exports = {
  APPARIEMENTS,
  GROUPES_VARIANTE2,
  parId,
  parProgression,
  VALEUR_VARIANTE,
  OPTIONS_VM_VARIANTE2,
  propsVariante2,
  clesDuSac,
  MARQUEURS,
  MARQUEURS_ID,
  normaliser,
  texteDe,
  marqueursDe,
  mesurerVariante2,
  auditerCoherence,
  MOTIF_SERIE,
  ETATS_GLOBAUX_INTERDITS,
};
