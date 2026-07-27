// domain/clubDirective.ts
//
// DIRECTIVE D'ENTRAÎNEMENT — l'objet, distinct de la note privée, qui a le droit
// d'influencer la préparation.
//
// ─── POURQUOI UN OBJET SÉPARÉ, ET NON UN CHAMP DE PLUS ──────────────────────
// Le cadre de semaine (`weekContexts/{weekKey}`) porte déjà trois informations
// destinées à peser sur les séances : `trainingIntensity`, `weekGoal` et
// `matchThisWeekend`. Elles ne sont PAS privées et ne le deviennent pas.
// La directive ne les remplace pas : elle les COMPLÈTE, sur les trois points
// que le cadre de semaine ne sait pas exprimer.
//   1. Une PHRASE. Le cadre n'offre que des catégories ; le coach n'a aucun
//      moyen d'écrire « on garde les appuis, personne ne force sur les frappes ».
//      C'est précisément ce qu'il écrivait dans la note — sans savoir que tout
//      le vestiaire la recevait.
//   2. Une DURÉE DE VALIDITÉ. Le cadre expire avec la semaine (une clé = un
//      lundi). Une consigne de reprise vaut souvent trois semaines.
//   3. Un STATUT explicite. Un cadre non renseigné et un cadre levé se
//      ressemblent ; une directive dit `active: false`, sans ambiguïté.
//
// ─── PAS DE SECOND VOCABULAIRE ──────────────────────────────────────────────
// `objective` est une catégorie FERMÉE, et c'est EXACTEMENT celle du cadre de
// semaine (`CLUB_WEEK_GOALS`). Inventer une seconde liste d'objectifs aurait
// donné deux vocabulaires concurrents pour la même idée — le coach aurait dû
// choisir deux fois, et le backend arbitrer entre les deux. L'objectif club
// joue déjà ce rôle : la directive s'y branche au lieu de l'empiler.
//
// ─── CE QUE LA DIRECTIVE NE PEUT PAS FAIRE ──────────────────────────────────
//  - Elle ne contourne AUCUNE règle de sécurité sportive : elle entre dans le
//    contexte envoyé au backend comme une préférence, jamais comme un ordre.
//    Les garde-fous (douleurs, âge, caps de durée, deload) restent devant.
//  - Elle ne doit contenir aucune donnée médicale, ni rien qui permette d'en
//    déduire une. C'est écrit au coach AVANT enregistrement, parce que la
//    directive est LUE PAR LE JOUEUR : ce qu'on y met, tout l'effectif le voit.
//  - Elle n'est JAMAIS créée automatiquement à partir d'une note privée. Aucune
//    heuristique, aucune proposition, aucune reprise « pour rendre service ».

import {
  CLUB_WEEK_GOALS,
  normalizeClubWeekGoal,
  type ClubWeekGoal,
} from "./types";

// ─── Catégorie fermée ───────────────────────────────────────────────────────
// Alias volontaire : l'objectif d'une directive EST un objectif club. Le jour
// où les deux devraient diverger, c'est ici que la séparation se ferait — et il
// faudrait une raison métier, pas un réflexe de copie.
export const CLUB_DIRECTIVE_OBJECTIVES = CLUB_WEEK_GOALS;
export type ClubDirectiveObjective = ClubWeekGoal;

/** Allowlist serveur : tout ce qui n'est pas dans la liste vaut `null`. */
export function normalizeClubDirectiveObjective(value: unknown): ClubDirectiveObjective | null {
  return normalizeClubWeekGoal(value);
}

/**
 * Libellés des objectifs. Source UNIQUE : l'écran coach (cadre de semaine ET
 * directive) et l'écran joueur lisent tous les trois cette table. Deux copies
 * auraient fini par diverger, et le joueur aurait lu un mot que le coach n'a
 * jamais choisi.
 */
export const CLUB_DIRECTIVE_OBJECTIVE_LABELS: Record<ClubDirectiveObjective, string> = {
  freshness: "Fraîcheur",
  prevention: "Appuis & freinage",
  speed: "Vitesse contrôlée",
  strength: "Renfo terrain",
  comeback: "Reprise",
};

// ─── Bornes du texte libre ──────────────────────────────────────────────────
/**
 * `instruction` est du texte libre, donc borné — et court. 160 caractères :
 * une consigne, pas un paragraphe. Elle est LUE PAR LE JOUEUR sur une carte de
 * séance ; au-delà, elle n'est plus lue du tout.
 */
export const CLUB_DIRECTIVE_INSTRUCTION_MAX = 160;

/** Nom de la collection. Recopié tel quel dans firestore.rules. */
export const CLUB_DIRECTIVES_COLLECTION = "directives";

/**
 * Identifiant de LA directive en cours.
 *
 * Une seule directive à la fois, à une clé connue d'avance. Ce n'est pas une
 * limitation technique : c'est ce qui permet au joueur de la lire par un `get`
 * direct, sans jamais énumérer la collection — la même doctrine que celle qui a
 * fermé `list` sur les cadres de semaine.
 */
export const CLUB_DIRECTIVE_CURRENT_ID = "current";

// ─── Libellés d'écran, au mot près ──────────────────────────────────────────
/**
 * Affiché dans l'écran coach AVANT enregistrement. Il dit ce que le coach doit
 * savoir au moment où il écrit, pas après : le joueur lira ce texte.
 */
export const CLUB_DIRECTIVE_LABEL =
  "Directive d'entraînement — visible par le joueur et susceptible d'influencer ses prochaines séances.";

/**
 * Rappel affiché juste au-dessus du champ de saisie. Le libellé ci-dessus dit
 * QUI lit ; celui-ci dit CE QU'ON N'ÉCRIT PAS. Les deux sont nécessaires : un
 * coach averti que « le joueur voit » peut encore écrire une blessure.
 */
export const CLUB_DIRECTIVE_WRITE_WARNING =
  "Tout l'effectif peut lire cette directive. N'y mets aucune information de santé, ni rien qui permette de deviner l'état d'un joueur.";

// ─── Le contrat ─────────────────────────────────────────────────────────────

export type ClubTrainingDirective = {
  /** Catégorie FERMÉE (allowlist serveur), jamais du texte libre. */
  objective: ClubDirectiveObjective;
  /** Consigne courte, texte libre borné. VISIBLE PAR LE JOUEUR. */
  instruction: string;
  /** Premier jour de validité, clé de date "YYYY-MM-DD". */
  validFrom: string;
  /** Dernier jour de validité inclus, clé de date "YYYY-MM-DD". */
  validUntil: string;
  /** Statut explicite. `false` = levée, sans avoir à la supprimer. */
  active: boolean;
  createdBy: string;
  /** ISO 8601, ou `null` si la base ne l'a pas encore matérialisé. */
  createdAt: string | null;
  updatedAt: string | null;
};

/** Une clé de date, et rien d'autre : "YYYY-MM-DD". */
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function readDateKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return DATE_KEY_RE.test(v) ? v : null;
}

/**
 * Horodatage tolérant. Firestore renvoie un `Timestamp` (objet à `toDate()`),
 * l'émulateur et les tests parfois une chaîne ISO. Tout le reste vaut `null` :
 * un horodatage inventé serait pire qu'un horodatage absent.
 */
function readTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }
  return null;
}

/** Borne une instruction saisie (trim + troncature). "" si inexploitable. */
export function clampDirectiveInstruction(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, CLUB_DIRECTIVE_INSTRUCTION_MAX);
}

/**
 * Lit un document `directives/{id}` brut.
 *
 * Lecture 100 % défensive, et fail-closed : il manque un morceau du contrat →
 * `null`. On ne complète JAMAIS une directive incomplète par des valeurs par
 * défaut : une consigne à moitié lue qui influencerait une séance serait pire
 * qu'une absence de consigne.
 *
 * `active` absent vaut `false` (un document ancien ou tronqué n'active rien).
 */
export function parseClubDirective(
  raw: Record<string, unknown> | null | undefined,
): ClubTrainingDirective | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const objective = normalizeClubDirectiveObjective(r.objective);
  if (!objective) return null;

  const instruction = clampDirectiveInstruction(r.instruction);
  if (!instruction) return null;

  const validFrom = readDateKey(r.validFrom);
  const validUntil = readDateKey(r.validUntil);
  if (!validFrom || !validUntil) return null;
  // Fenêtre inversée = document incohérent. On refuse plutôt que de « corriger ».
  if (validUntil < validFrom) return null;

  return {
    objective,
    instruction,
    validFrom,
    validUntil,
    active: r.active === true,
    createdBy: typeof r.createdBy === "string" ? r.createdBy : "",
    createdAt: readTimestamp(r.createdAt),
    updatedAt: readTimestamp(r.updatedAt),
  };
}

/**
 * La directive s'applique-t-elle le jour `dateKey` ?
 *
 * Comparaison de chaînes : sur du "YYYY-MM-DD", l'ordre lexicographique EST
 * l'ordre chronologique. Aucune conversion en `Date`, donc aucun décalage de
 * fuseau à la frontière de minuit.
 */
export function isClubDirectiveApplicable(
  directive: ClubTrainingDirective | null | undefined,
  dateKey: string,
): boolean {
  if (!directive || !directive.active) return false;
  if (!DATE_KEY_RE.test(dateKey)) return false;
  return directive.validFrom <= dateKey && dateKey <= directive.validUntil;
}

// ─── Ce que le joueur lit ───────────────────────────────────────────────────

export type ClubDirectiveNoticeCopy = {
  titre: string;
  objectif: string;
  instruction: string;
  /**
   * Phrase d'honnêteté affichée sous la consigne : elle dit d'où vient la
   * directive ET ce qu'elle ne peut pas faire. Un joueur qui lit « Renfo
   * terrain » sans cette phrase peut croire que son club a écrit sa séance.
   */
  precision: string;
};

/** Rendu joueur d'une directive. `null` si elle ne s'applique pas ce jour-là. */
export function clubDirectiveNotice(
  directive: ClubTrainingDirective | null | undefined,
  dateKey: string,
): ClubDirectiveNoticeCopy | null {
  if (!isClubDirectiveApplicable(directive, dateKey)) return null;
  const d = directive as ClubTrainingDirective;
  return {
    titre: "Directive du club",
    objectif: CLUB_DIRECTIVE_OBJECTIVE_LABELS[d.objective],
    instruction: d.instruction,
    precision:
      "Ton club a posé cette directive. FKS en tient compte pour tes séances, sans jamais passer devant les règles de sécurité.",
  };
}

/**
 * Phrase à afficher sur une séance construite alors qu'une directive
 * s'appliquait. Elle énonce un FAIT (« une directive était active »), jamais un
 * effet mesuré (« ta séance a été modifiée ») : le front ne sait pas ce que le
 * moteur en a fait, et ne doit pas le prétendre.
 */
export const CLUB_DIRECTIVE_SESSION_NOTICE =
  "Une directive du club était active lors de la construction de cette séance et a été transmise à FKS.";
