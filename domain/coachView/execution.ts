// domain/coachView/execution.ts
//
// AFFICHER LE CALCUL, PAS SEULEMENT SON RÉSULTAT.
//
// LE DÉFAUT CORRIGÉ. La fiche joueur montrait « Exercices réalisés : 79 % » à
// côté de quatre compteurs (faits / adaptés / sautés / remplacés) qui, mis bout
// à bout, ne redonnaient pas 79. Un coach qui essaie de refaire le calcul de
// tête n'y arrive pas : le pourcentage devient un score opaque, exactement ce
// que l'espace coach s'interdit partout ailleurs.
//
// CE QUE CE MODULE PRODUIT. Une décomposition en catégories EXCLUSIVES — un
// exercice n'est rangé que dans une seule — dont la somme vaut le TOTAL de la
// séance, plus la règle de pondération en français simple. Avec ça, le coach
// refait le calcul : 7 + 1 + 1 + 0,5 = 9,5 sur 12, soit 79 %.
//
// TROIS GARDE-FOUS QUI NE SE NÉGOCIENT PAS.
//  1. On n'invente AUCUN chiffre. Total absent, nature des remplacements
//     inconnue, compteur non transmis : on ne complète pas, on dit que le détail
//     n'est pas disponible et on laisse le pourcentage seul avec sa mention
//     prudente. Une absence ne se maquille pas en mesure.
//  2. On ne montre JAMAIS un calcul qui ne retombe pas sur le nombre affiché.
//     Si les compteurs dépassent le total, ou si la somme pondérée ne reproduit
//     pas le pourcentage transmis, la décomposition est déclarée non vérifiable.
//     Mieux vaut un détail en moins qu'une démonstration fausse.
//  3. Aucune donnée de santé n'entre ici : ce sont des comptages d'exercices,
//     pas une mesure d'effort ni une note de performance.
//
// Module PUR : ni React, ni Firestore, ni horloge.

import type { CoachExecutionView } from "./types";

// ─── Catégories exclusives ───────────────────────────────────────────────────

export const COACH_EXECUTION_CATEGORIES = [
  "fait",
  "adapte",
  "remplace_equivalent",
  "remplace_partiel",
  "saute",
  "non_renseigne",
] as const;
export type CoachExecutionCategorie = (typeof COACH_EXECUTION_CATEGORIES)[number];

/** Libellé coach de chaque catégorie. Vocabulaire du JOUEUR (jamais du moteur). */
export const COACH_EXECUTION_CATEGORIE_LABEL: Record<CoachExecutionCategorie, string> = {
  fait: "Faits",
  adapte: "Adaptés",
  remplace_equivalent: "Remplacés par un équivalent",
  remplace_partiel: "Remplacés en partie",
  saute: "Sautés",
  non_renseigne: "Non renseignés",
};

/**
 * Poids d'UN exercice de chaque catégorie dans le pourcentage.
 *
 * ⚠️ MIROIR de la règle serveur (functions/src/projector.ts) : un remplacement
 * équivalent pèse 1, un remplacement partiel 0,5. Le test de preuve côté
 * functions recalcule 79 % à partir de ces poids ; s'ils changent là-bas, ils
 * changent ici, sinon l'écran affiche une règle que le serveur n'applique pas.
 */
export const COACH_EXECUTION_POIDS: Record<CoachExecutionCategorie, number> = {
  fait: 1,
  adapte: 1,
  remplace_equivalent: 1,
  remplace_partiel: 0.5,
  saute: 0,
  non_renseigne: 0,
};

export type CoachExecutionLigne = {
  cle: CoachExecutionCategorie;
  libelle: string;
  nombre: number;
  /** Poids d'un exercice de cette catégorie (1 / 0,5 / 0). */
  poids: number;
};

// ─── Raisons de ne PAS afficher le calcul ────────────────────────────────────

export const COACH_EXECUTION_OPAQUE_MOTIFS = [
  "compteurs_absents",
  "total_absent",
  "remplacements_indetermines",
  "somme_superieure_au_total",
  "pourcentage_non_reproduit",
] as const;
export type CoachExecutionOpaqueMotif = (typeof COACH_EXECUTION_OPAQUE_MOTIFS)[number];

/**
 * Phrase affichée à la place du calcul. Chacune NOMME ce qui manque : « détail
 * indisponible » tout court laisserait croire à une panne, alors que dans les
 * trois premiers cas c'est simplement une projection qui ne transmet pas encore
 * l'information.
 */
export const COACH_EXECUTION_OPAQUE_TEXTE: Record<CoachExecutionOpaqueMotif, string> = {
  compteurs_absents:
    "Le détail par exercice n'a pas été transmis : le calcul de ce pourcentage ne peut pas être affiché.",
  total_absent:
    "Le nombre total d'exercices de la séance n'a pas été transmis : le calcul de ce pourcentage ne peut pas être affiché.",
  remplacements_indetermines:
    "La nature des remplacements (équivalent ou partiel) n'a pas été transmise : le calcul de ce pourcentage ne peut pas être affiché.",
  somme_superieure_au_total:
    "Les compteurs transmis dépassent le nombre total d'exercices : le calcul n'est pas affiché, plutôt que d'en montrer un faux.",
  pourcentage_non_reproduit:
    "Le pourcentage transmis ne se retrouve pas à partir des compteurs : le calcul n'est pas affiché, plutôt que d'en montrer un faux.",
};

// ─── Règle de calcul, en français simple ─────────────────────────────────────

/**
 * Deux lignes, et pas une de plus. Elles doivent permettre de REFAIRE le calcul
 * de tête : c'est le seul critère de rédaction retenu ici.
 */
export const COACH_EXECUTION_REGLE: readonly string[] = [
  "Un exercice adapté ou remplacé par un équivalent compte comme fait, un remplacement partiel compte pour moitié, un exercice sauté ou non renseigné ne compte pas.",
  "Le pourcentage est cette somme divisée par le nombre total d'exercices de la séance.",
];

// ─── Résultat ────────────────────────────────────────────────────────────────

export type CoachExecutionBreakdown =
  | {
      verifiable: true;
      /** Catégories exclusives affichées, dans l'ordre de lecture. */
      lignes: CoachExecutionLigne[];
      /** Dénominateur : nombre d'exercices de la séance. */
      total: number;
      /** Somme pondérée (ex. 9,5). */
      sommePonderee: number;
      /** Pourcentage TRANSMIS par le serveur (jamais un chiffre fabriqué ici). */
      pourcentage: number | null;
      /** "7 + 1 + 1 + 0,5 = 9,5 sur 12 exercices, soit 79 %". */
      calcul: string;
      regle: readonly string[];
    }
  | {
      verifiable: false;
      motif: CoachExecutionOpaqueMotif;
      /** Phrase prête à afficher (cf. COACH_EXECUTION_OPAQUE_TEXTE). */
      texte: string;
    };

/**
 * Écart toléré entre le pourcentage transmis et celui qu'on retrouve à partir
 * des compteurs. 1 point : les deux côtés arrondissent, on ne veut pas déclarer
 * incohérent un 78,5 arrondi en 79 d'un côté et en 78 de l'autre.
 */
const TOLERANCE_POURCENTAGE = 1;

/** Nombre à la française : 9.5 → "9,5", 9 → "9". */
function fr(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function opaque(motif: CoachExecutionOpaqueMotif): CoachExecutionBreakdown {
  return { verifiable: false, motif, texte: COACH_EXECUTION_OPAQUE_TEXTE[motif] };
}

/**
 * Compteur exploitable, ou `null`.
 *
 * DÉFENSIF ET ASSUMÉ. Le contrat de type dit « number | null », mais ce module
 * est le dernier rempart avant un chiffre affiché à un entraîneur : une valeur
 * absente d'un document ancien arrive en `undefined`, et `undefined > 0` est
 * faux sans lever, ce qui produirait un « NaN sur undefined exercices » à
 * l'écran. On ramène donc tout ce qui n'est pas un entier positif fini à
 * « inconnu » — état déjà géré, contrairement à NaN.
 */
function compteur(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

/**
 * Décompose une exécution en catégories exclusives + règle de calcul.
 *
 * @returns `null` si aucune exécution n'est connue (l'écran affiche déjà son
 *          état dégradé dans ce cas), sinon une décomposition vérifiable ou la
 *          raison explicite pour laquelle elle ne l'est pas.
 */
export function buildExecutionBreakdown(
  execution: CoachExecutionView | null,
): CoachExecutionBreakdown | null {
  if (!execution) return null;

  const fait = compteur(execution.fait);
  const adapte = compteur(execution.adapte);
  const saute = compteur(execution.saute);
  if (fait === null || adapte === null || saute === null) return opaque("compteurs_absents");

  const total = compteur(execution.total);
  // Un total nul serait un dénominateur impossible : inconnu, pas zéro.
  if (total === null || total <= 0) return opaque("total_absent");

  // Nature des remplacements : connue, ou PROUVÉE nulle. `remplace === 0` est la
  // somme de deux compteurs positifs ou nuls : chacun vaut donc zéro. C'est une
  // déduction arithmétique, pas une supposition — d'où l'exception.
  let equivalent = compteur(execution.remplaceEquivalent);
  let partiel = compteur(execution.remplacePartiel);
  if (equivalent === null || partiel === null) {
    if (compteur(execution.remplace) === 0) {
      equivalent = 0;
      partiel = 0;
    } else {
      return opaque("remplacements_indetermines");
    }
  }

  const comptes = fait + adapte + equivalent + partiel + saute;
  // Des catégories exclusives ne peuvent pas dépasser le total. Si elles le font,
  // c'est qu'elles ne sont pas exclusives (ou que le total est faux) : dans les
  // deux cas la démonstration serait mensongère.
  if (comptes > total) return opaque("somme_superieure_au_total");

  // Le reste du total : des exercices que la séance contenait sans qu'on sache ce
  // que le joueur en a fait. Ils comptent dans le dénominateur, jamais au numérateur.
  const nonRenseigne = total - comptes;

  const sommePonderee =
    fait * COACH_EXECUTION_POIDS.fait +
    adapte * COACH_EXECUTION_POIDS.adapte +
    equivalent * COACH_EXECUTION_POIDS.remplace_equivalent +
    partiel * COACH_EXECUTION_POIDS.remplace_partiel;

  const recalcule = Math.round((sommePonderee / total) * 100);
  const pourcentage = compteur(execution.pourcentage);
  if (pourcentage !== null && Math.abs(pourcentage - recalcule) > TOLERANCE_POURCENTAGE) {
    return opaque("pourcentage_non_reproduit");
  }

  const nombres: Record<CoachExecutionCategorie, number> = {
    fait,
    adapte,
    remplace_equivalent: equivalent,
    remplace_partiel: partiel,
    saute,
    non_renseigne: nonRenseigne,
  };

  const cles: CoachExecutionCategorie[] = [
    "fait",
    "adapte",
    "remplace_equivalent",
    "remplace_partiel",
    "saute",
  ];
  // « Non renseignés » n'apparaît que s'il y en a : afficher un zéro de plus
  // n'apprend rien, alors qu'un nombre non nul explique pourquoi la somme des
  // autres catégories ne fait pas le total.
  if (nonRenseigne > 0) cles.push("non_renseigne");

  const lignes: CoachExecutionLigne[] = cles.map((cle) => ({
    cle,
    libelle: COACH_EXECUTION_CATEGORIE_LABEL[cle],
    nombre: nombres[cle],
    poids: COACH_EXECUTION_POIDS[cle],
  }));

  // Ligne de calcul : uniquement les termes qui pèsent quelque chose. Un
  // « + 0 » pour les sautés alourdirait la lecture sans rien prouver.
  const termes: string[] = [];
  if (fait > 0) termes.push(fr(fait * COACH_EXECUTION_POIDS.fait));
  if (adapte > 0) termes.push(fr(adapte * COACH_EXECUTION_POIDS.adapte));
  if (equivalent > 0) termes.push(fr(equivalent * COACH_EXECUTION_POIDS.remplace_equivalent));
  if (partiel > 0) termes.push(fr(partiel * COACH_EXECUTION_POIDS.remplace_partiel));
  if (termes.length === 0) termes.push("0");

  const base = `${termes.join(" + ")} = ${fr(sommePonderee)} sur ${total} exercices`;
  const calcul = pourcentage !== null ? `${base}, soit ${pourcentage} %` : base;

  return {
    verifiable: true,
    lignes,
    total,
    sommePonderee,
    pourcentage,
    calcul,
    regle: COACH_EXECUTION_REGLE,
  };
}
