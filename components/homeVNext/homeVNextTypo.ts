// components/homeVNext/homeVNextTypo.ts
// =============================================================================
// PROTOTYPE Home vNext — LES DEUX ECHELLES TYPOGRAPHIQUES
// =============================================================================
//
// POURQUOI CE FICHIER EXISTE
// -----------------------------------------------------------------------------
// Ressenti du fondateur sur l'iteration precedente : « la police parait parfois
// trop grosse ». La mesure ne confirme pas tout a fait le diagnostic : sur les
// 10 roles d'affichage de l'ecran, CINQ etaient en graisse 800 (salutation,
// titre d'action, titre de section, prefixe « Pourquoi : », titre de note). Ce
// n'est pas la taille qui pese, c'est l'ACCUMULATION DE POIDS.
//
// Ce fichier pose donc DEUX echelles completes, cote a cote :
//
//   - `ECHELLE_ACTUELLE` : exactement ce qui etait a l'ecran jusqu'ici. Aucune
//     valeur n'a bouge d'un dixieme — elle reste rendable pour que le fondateur
//     compare, comme la variante 1 garde sa pastille d'etat pour la meme raison.
//   - `ECHELLE_ALLEGEE`  : l'echelle imposee par le fondateur, appliquee telle
//     qu'elle a ete ecrite. C'est la valeur par defaut du prototype.
//
// AUCUNE TAILLE N'A ETE REDUITE POUR GAGNER DE LA HAUTEUR. C'est explicitement
// interdit : le defilement est accepte, l'objectif est un ecran EQUILIBRE, pas
// un ecran qui tient a tout prix sur une hauteur. La preuve se lit dans le
// tableau ci-dessous : le TEXTE COURANT GRANDIT (13 -> 14 px) pendant que sa
// graisse tombe (600 -> 500), et les liens grandissent aussi (13 -> 14 px).
//
// CE QUI EST HORS DE PORTEE DE CE FICHIER, ET QUI EST DIT PLUTOT QUE CACHE
// -----------------------------------------------------------------------------
// La pastille d'etat du jour de la VARIANTE 1 est rendue par `components/ui/
// Badge`, que le prototype n'a pas le droit de modifier : son texte garde donc
// sa propre metrique. Elle n'existe de toute facon PAS en variante 2 (decision
// D1 du fondateur : plus aucun jugement global tant que la charge club n'est pas
// reellement connue), donc l'ecran valide n'est pas concerne.
//
// LE TABLEAU AVANT / APRES, ROLE PAR ROLE
// -----------------------------------------------------------------------------
//  role            | ACTUELLE                       | ALLEGEE
//  ----------------|--------------------------------|------------------------------
//  salutation      | 22 / 800 / lh 28 / ls -0,3     | 20 / 700 / lh 26 / ls -0,3
//  titreAction     | 17 / 800 / lh 22 / ls +0,3     | 16 / 700 / lh 21 / ls +0,3
//  overline        | 13 / 800 / lh 16 / ls  1,2     | 12 / 700 / lh 16 / ls  0,8
//  valeur          | 16 / 700 / lh 20 / ls  0       | 16 / 700 / lh 20 / ls  0
//  corps           | 13 / 600 / lh 18 / ls  0       | 14 / 500 / lh 20 / ls  0
//  meta            | 12 / 500 / lh 16 / ls  0       | 12 / 500 / lh 16 / ls  0
//  lien            | 13 / 600 / lh 18 / ls  0       | 14 / 600 / lh 20 / ls  0
//  emphaseCorps    | 13 / 800 / lh 18 / ls  0       | 14 / 600 / lh 20 / ls  0
//  emphaseMeta     | 12 / 700 / lh 16 / ls  0       | 12 / 600 / lh 16 / ls  0
//  metaAppuyee     | 12 / 800 / lh 16 / ls  0       | 12 / 700 / lh 16 / ls  0
//
//  Roles en graisse 800 : 5 avant, ZERO apres. Graisse maximale de l'ecran : 700.
//
// LES TROIS DERNIERS ROLES NE FIGURENT PAS DANS LA LISTE DU FONDATEUR.
// Ce sont des fragments accentues a l'interieur d'un texte, pas des textes a
// part : le prefixe « Pourquoi : », le nom du cycle dans sa ligne de meta, le
// titre de la note et le numero d'etape. Ils etaient ecrits en dur dans les
// composants (`fontWeight: "800"`, `fontWeight: "700"`) et sont remontes ici
// pour qu'une echelle soit une echelle, et pas une liste a laquelle les
// composants ajoutent discretement leurs propres poids.
// Alignement retenu, et il est dit dans le compte rendu :
//   - `emphaseCorps` et `emphaseMeta` -> 600, la graisse des liens secondaires,
//     seule graisse d'appui de la nouvelle echelle ;
//   - `metaAppuyee` -> 700, la graisse des labels, parce que « À garder en tête »
//     et le numero d'etape sont des LABELS poses sur du contenu, pas des mots
//     appuyes dans une phrase.
// =============================================================================

import type { TextStyle } from "react-native";

// -----------------------------------------------------------------------------
// 1. LES ROLES
// -----------------------------------------------------------------------------

/**
 * Les 10 roles d'affichage de l'ecran. Union FERMEE : un composant ne peut pas
 * inventer un 11e palier sans passer par ici, ce qui est precisement ce qui a
 * produit les 21 couples taille/graisse du Home de production.
 */
export type RoleTypo =
  /** « Salut, Yanis ». Le seul texte de rang 1 de l'ecran. */
  | "salutation"
  /** Libelle de l'action du jour (aplat) et de l'accuse de reception. */
  | "titreAction"
  /** Titre de section en capitales : « MA SEMAINE », « MA PROGRESSION ». */
  | "overline"
  /** Valeur mise en avant : « 1 séance sur 2 », « 76 min », un ecart de test. */
  | "valeur"
  /** Texte courant : sous-titre d'action, ligne « pourquoi », messages. */
  | "corps"
  /** Metadonnee : portee d'une mesure, periode, date, ligne de cycle. */
  | "meta"
  /** Lien secondaire (« Voir le détail », « Voir ma progression »). */
  | "lien"
  /** Fragment accentue DANS un texte courant : le prefixe « Pourquoi : ». */
  | "emphaseCorps"
  /** Fragment accentue DANS une metadonnee : le nom du cycle. */
  | "emphaseMeta"
  /** Petit label pose sur du contenu : titre de note, numero d'etape. */
  | "metaAppuyee";

/**
 * Un palier complet. `textTransform` n'existe que sur l'overline — c'est la
 * seule mise en capitales de l'ecran, et elle appartient au palier, pas au
 * composant qui l'utilise.
 */
export type StyleTypo = {
  fontSize: number;
  lineHeight: number;
  fontWeight: NonNullable<TextStyle["fontWeight"]>;
  letterSpacing: number;
  textTransform?: NonNullable<TextStyle["textTransform"]>;
};

/** Une echelle complete : un style par role, aucun role manquant. */
export type EchelleTypo = Readonly<Record<RoleTypo, StyleTypo>>;

// -----------------------------------------------------------------------------
// 2. ECHELLE ACTUELLE — CE QUI ETAIT A L'ECRAN, AU DIXIEME PRES
// -----------------------------------------------------------------------------
// Chaque valeur est celle qui etait deja rendue. Les provenances d'origine sont
// conservees : ce sont elles qui justifiaient l'echelle, et elles restent vraies.
// -----------------------------------------------------------------------------

export const ECHELLE_ACTUELLE: EchelleTypo = {
  /** PROVENANCE : `screens/HomeScreen.tsx` > `greeting`. */
  salutation: { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.3 },
  /** PROVENANCE : `components/ui/Button.tsx` > `labelLg` (taille `size="lg"`). */
  titreAction: { fontSize: 17, lineHeight: 22, fontWeight: "800", letterSpacing: 0.3 },
  /** PROVENANCE : `components/ui/SectionHeader.tsx`, copie a l'identique. */
  overline: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  /** PROVENANCE : `HeroCard.heroStatValue` et `RoutineScreen.heroStatValue`. */
  valeur: { fontSize: 16, lineHeight: 20, fontWeight: "700", letterSpacing: 0 },
  /** PROVENANCE : `HeroCard.subtitle` (13) et `CategoryTile.tileTitle` (13 / 700). */
  corps: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: 0 },
  /** PROVENANCE : `HeroCard.progressLabel` (12) et `RoutineScreen.heroSubtitle` (12). */
  meta: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0 },
  /** Les liens partageaient exactement le palier `corps` : c'est reproduit tel quel. */
  lien: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: 0 },
  /** Ecrit en dur dans `HomeVNextAction.pourquoiPrefixe` (`fontWeight: "800"`). */
  emphaseCorps: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0 },
  /** Ecrit en dur dans `HomeVNextAction.cycleLabel` (`fontWeight: "700"`). */
  emphaseMeta: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0 },
  /** Ecrit en dur dans `HomeVNextNote.titre` et `HomeVNextProgression.pastilleTexte`. */
  metaAppuyee: { fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0 },
};

// -----------------------------------------------------------------------------
// 3. ECHELLE ALLEGEE — CELLE DU FONDATEUR
// -----------------------------------------------------------------------------
// Les valeurs qu'il a fixees sont reprises telles quelles. Les choix qui
// restaient a faire, et ils sont tous du meme genre — une fourchette, ou une
// valeur qu'il n'a pas eu a citer — sont documentes ligne a ligne.
// -----------------------------------------------------------------------------

export const ECHELLE_ALLEGEE: EchelleTypo = {
  /**
   * Fondateur : 20 px, 700, interligne 26.
   * `letterSpacing` non specifie -> la valeur en place (-0,3) est conservee :
   * rien n'autorise a la changer, et un leger resserrement reste juste a 20 px.
   */
  salutation: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3 },
  /**
   * Fondateur : 16 px, 700, interligne 21.
   * `letterSpacing` non specifie -> la valeur en place (+0,3, heritee de
   * `Button.labelLg`) est conservee, pour la meme raison.
   */
  titreAction: { fontSize: 16, lineHeight: 21, fontWeight: "700", letterSpacing: 0.3 },
  /**
   * Fondateur : 12 px, 700, tracking ~0,8.
   * `lineHeight` non specifie -> 16 conserve, ce qui garde la hauteur de la
   * ligne de titre EXACTEMENT identique. Baisser l'interligne ici aurait ete
   * une reduction de hauteur deguisee, et c'est interdit.
   */
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  /**
   * Fondateur : 16-17 px, 700. Retenu : **16**, le bas de la fourchette.
   * Motif : c'est exactement ce qui est deja a l'ecran. Monter a 17 aurait
   * GROSSI un texte sur un ecran dont on vient de dire qu'il paraissait trop
   * gros ; l'interligne 20 est conserve pour la meme raison.
   */
  valeur: { fontSize: 16, lineHeight: 20, fontWeight: "700", letterSpacing: 0 },
  /**
   * Fondateur : 14 px, 400 ou 500, interligne 20. Retenu : **500**.
   * Motif : ce palier porte surtout du texte secondaire (`couleurs.texteSecondaire`,
   * mesure a 6,08:1 sur carte). A 400 sur du gris, la lecture en plein soleil au
   * bord d'un terrain se degrade nettement ; 500 tient la lisibilite tout en
   * quittant le 600 actuel. C'est la ligne qui GRANDIT : 13 -> 14 px.
   */
  corps: { fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: 0 },
  /**
   * Fondateur : 12-13 px. Retenu : **12**, le bas de la fourchette, c'est-a-dire
   * la valeur deja en place. Rien ne bouge, ni la taille ni l'interligne.
   */
  meta: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0 },
  /**
   * Fondateur : 14 px, 600. `lineHeight` non specifie -> 20, aligne sur le
   * texte courant de la meme taille. Ce palier grandit lui aussi (13 -> 14).
   */
  lien: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0 },
  /**
   * HORS LISTE. Fragment accentue dans un texte courant (« Pourquoi : »).
   * Aligne sur `corps` pour la metrique, et sur la graisse 600 des liens
   * secondaires — la seule graisse d'appui de cette echelle. C'est ce role qui
   * portait l'un des cinq 800.
   */
  emphaseCorps: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0 },
  /**
   * HORS LISTE. Nom du cycle dans sa ligne de metadonnee.
   * Aligne sur `meta` pour la metrique, graisse 600 pour la meme raison.
   */
  emphaseMeta: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0 },
  /**
   * HORS LISTE. Petit LABEL pose sur du contenu : « À garder en tête », et le
   * numero d'une etape. Aligne sur `meta` pour la metrique, et sur la graisse
   * 700 des labels — un label n'est pas un mot appuye dans une phrase.
   */
  metaAppuyee: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0 },
};

// -----------------------------------------------------------------------------
// 4. LES DEUX JEUX, EXPOSES PROPREMENT
// -----------------------------------------------------------------------------

export type EchelleTypoId = "actuelle" | "allegee";

/**
 * Les deux echelles, indexees. C'est CETTE table que la bascule du visualiseur
 * doit lire : ajouter une troisieme echelle ne demanderait qu'une entree ici.
 */
export const ECHELLES: Readonly<Record<EchelleTypoId, EchelleTypo>> = {
  actuelle: ECHELLE_ACTUELLE,
  allegee: ECHELLE_ALLEGEE,
};

/** Libelle lisible par un non-developpeur, pour la bascule du visualiseur. */
export const ECHELLES_LIBELLES: Readonly<Record<EchelleTypoId, string>> = {
  actuelle: "Échelle actuelle (celle de l'itération précédente)",
  allegee: "Échelle allégée (celle demandée)",
};

/**
 * Ce que le prototype rend quand personne ne demande rien.
 *
 * C'est l'echelle ALLEGEE : le fondateur l'a imposee, donc c'est elle qui doit
 * etre a l'ecran. L'actuelle reste atteignable par la bascule, jamais par
 * defaut — un defaut qui montre l'ancienne version ferait valider l'ancienne.
 */
export const ECHELLE_PAR_DEFAUT: EchelleTypoId = "allegee";

/** Toutes les valeurs, a plat, pour affichage par le visualiseur. */
export const COMPARAISON_ECHELLES: readonly {
  role: RoleTypo;
  usage: string;
  actuelle: StyleTypo;
  allegee: StyleTypo;
}[] = (
  [
    ["salutation", "« Salut, Yanis »"],
    ["titreAction", "Libellé de l'action du jour"],
    ["overline", "Titres de section (MA SEMAINE, MA PROGRESSION)"],
    ["valeur", "Valeurs mises en avant"],
    ["corps", "Texte courant et explications"],
    ["meta", "Métadonnées (portée, période, cycle)"],
    ["lien", "Liens secondaires"],
    ["emphaseCorps", "Fragment accentué dans un texte (« Pourquoi : »)"],
    ["emphaseMeta", "Fragment accentué dans une métadonnée (nom du cycle)"],
    ["metaAppuyee", "Petit label posé sur du contenu"],
  ] as const
).map(([role, usage]) => ({
  role,
  usage,
  actuelle: ECHELLE_ACTUELLE[role],
  allegee: ECHELLE_ALLEGEE[role],
}));

// =============================================================================
// 5. POLITIQUE D'AGRANDISSEMENT SYSTEME
// =============================================================================
//
// LA REGLE, DANS L'ORDRE OU ELLE S'APPLIQUE
// -----------------------------------------------------------------------------
// 1. L'agrandissement systeme n'est JAMAIS desactive. `allowFontScaling={false}`
//    n'apparait nulle part dans le prototype, et un test le verifie sur les 15
//    etats : un joueur qui a agrandi ses textes doit voir l'ecran grandir.
//
// 2. Seuls les textes d'AFFICHAGE sont bornes. Un texte d'affichage est un
//    texte dont la fonction est de poser une hierarchie : la salutation, le
//    titre de l'action, les labels decoratifs en capitales. Les borner ne
//    retire aucune information — ils ne portent qu'un mot ou deux, deja lisibles.
//
// 3. Tout ce qui PORTE UNE INFORMATION n'est jamais borne : valeurs, texte
//    courant, metadonnees, liens, portee de la mesure, messages d'explication.
//    Ce sont exactement les textes qu'un joueur malvoyant a besoin de voir
//    grandir. Ils continuent donc au-dela de x1,3, sans plafond du tout.
//
// 4. REGLE QUI PRIME SUR TOUT : borner un libelle ne doit jamais rapetisser sa
//    zone tactile. Verifie sur les deux seules cibles de l'ecran :
//      - l'aplat d'action : `minHeight: 76` pt, pose par le conteneur et non par
//        son texte. Son sous-titre, lui, N'EST PAS borne : le bloc grandit donc
//        avec le contenu, et 76 pt est deja 1,7 fois le plancher de 44 pt ;
//      - les liens : `minHeight: 44` pt, et leur libelle (`lien`) n'est PAS
//        borne. Aucun des deux ne peut retrecir.
//    Un test monte les 15 etats et verifie que toute cible contenant un texte
//    borne tient au moins 44 pt.
// =============================================================================

/**
 * Plancher que doit atteindre tout texte NON borne. Sert de reference au test :
 * un role sans plafond doit pouvoir depasser cette valeur, donc valoir `null`.
 * Ce n'est pas un reglage : c'est la limite en dessous de laquelle le fondateur
 * a interdit de brider quoi que ce soit.
 */
export const AGRANDISSEMENT_LIBRE_MINIMAL = 1.3;

/**
 * Plafond d'agrandissement par role. `null` = AUCUN plafond, le texte grandit
 * autant que le systeme le demande.
 *
 * Les trois valeurs bornees, et leur raison :
 *   - `salutation` 1,2 : deux mots, une seule ligne bornee par `numberOfLines`.
 *     Au-dela de x1,2 elle mange la hauteur d'une carte entiere sans rien
 *     apprendre a personne — la date en dessous, elle, continue de grandir.
 *   - `titreAction` 1,2 : « C'est parti », « Réessayer ». Le sous-titre juste
 *     en dessous porte l'information reelle (titre de seance, duree, intensite)
 *     et n'est pas borne : c'est LUI qui doit grandir dans ce bloc.
 *   - `overline` 1,15 : « MA SEMAINE » est un repere de structure, pas une
 *     information. En capitales, avec du tracking, il occupe deja beaucoup de
 *     largeur ; un plafond legerement plus bas que les titres evite qu'un
 *     simple intitule de section passe a deux lignes avant le contenu qu'il
 *     annonce.
 *
 * Tous les autres roles valent `null`, y compris `valeur` : « 1 séance sur 2 »
 * est une information, pas une decoration.
 */
export const PLAFOND_AGRANDISSEMENT: Readonly<Record<RoleTypo, number | null>> = {
  salutation: 1.2,
  titreAction: 1.2,
  overline: 1.15,
  valeur: null,
  corps: null,
  meta: null,
  lien: null,
  emphaseCorps: null,
  emphaseMeta: null,
  metaAppuyee: null,
};

/**
 * Props a poser sur un `<Text>` pour respecter la politique de son role.
 *
 * Retourne un objet VIDE quand le role n'est pas borne : on ne pose pas
 * `maxFontSizeMultiplier={undefined}`, on ne pose rien du tout. La difference
 * compte pour le test, qui verifie qu'aucun texte d'information ne porte de
 * plafond — meme indefini.
 *
 * `allowFontScaling` n'est jamais renvoye : le laisser a son defaut (`true`)
 * est precisement la regle.
 */
export function plafondDuRole(role: RoleTypo): { maxFontSizeMultiplier?: number } {
  const plafond = PLAFOND_AGRANDISSEMENT[role];
  return plafond === null ? {} : { maxFontSizeMultiplier: plafond };
}

/** La politique, a plat, pour affichage par le visualiseur. */
export const POLITIQUE_AGRANDISSEMENT: readonly {
  role: RoleTypo;
  texteConcerne: string;
  plafond: number | null;
  raison: string;
}[] = [
  {
    role: "salutation",
    texteConcerne: "« Salut, Yanis »",
    plafond: 1.2,
    raison:
      "Texte d'affichage : deux mots, une seule ligne. Au-delà de x1,2 il mange la hauteur d'une carte sans rien apprendre. La date juste en dessous, elle, n'est pas bornée.",
  },
  {
    role: "titreAction",
    texteConcerne: "« C'est parti », « Réessayer », « Séance faite »",
    plafond: 1.2,
    raison:
      "Texte d'affichage : c'est le sous-titre en dessous qui porte l'information (titre de séance, durée, intensité), et lui n'est pas borné. La zone tactile ne bouge pas : elle tient à 76 pt de minHeight, posés par le conteneur.",
  },
  {
    role: "overline",
    texteConcerne: "« MA SEMAINE », « MA PROGRESSION », « MA FORME »",
    plafond: 1.15,
    raison:
      "Label décoratif en majuscules : un repère de structure, pas une information. Plafond légèrement plus bas que les titres pour qu'un intitulé de section ne passe pas à deux lignes avant le contenu qu'il annonce.",
  },
  {
    role: "valeur",
    texteConcerne: "« 1 séance sur 2 », « 76 min », l'écart d'un test",
    plafond: null,
    raison: "Information chiffrée : doit grandir sans limite. Aucune borne.",
  },
  {
    role: "corps",
    texteConcerne:
      "Sous-titre de l'action, ligne « pourquoi », messages de semaine, explications",
    plafond: null,
    raison:
      "Texte explicatif : c'est exactement ce qu'un joueur malvoyant a besoin de voir grandir. Aucune borne.",
  },
  {
    role: "meta",
    texteConcerne: "Portée de la mesure, période, date, ligne de cycle",
    plafond: null,
    raison:
      "La portée (« calculé sur tes séances FKS et les charges que tu as saisies ») est une information, et pas la moins importante. Aucune borne.",
  },
  {
    role: "lien",
    texteConcerne: "« Voir le détail », « Voir ma progression »",
    plafond: null,
    raison:
      "Libellé d'une destination : il doit rester lisible pour qui agrandit. Aucune borne — et la cible garde son plancher de 44 pt.",
  },
  {
    role: "emphaseCorps",
    texteConcerne: "Le préfixe « Pourquoi : »",
    plafond: null,
    raison:
      "Fragment imbriqué dans un texte courant : il suit son parent, qui n'est pas borné.",
  },
  {
    role: "emphaseMeta",
    texteConcerne: "Le nom du cycle dans sa ligne",
    plafond: null,
    raison: "Fragment imbriqué dans une métadonnée : il suit son parent, non borné.",
  },
  {
    role: "metaAppuyee",
    texteConcerne: "« À garder en tête », le numéro d'une étape",
    plafond: null,
    raison:
      "Petit label, mais posé sur du contenu utile et jamais seul sur sa ligne : rien ne justifie de le brider.",
  },
];
