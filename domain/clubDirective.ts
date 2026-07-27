// domain/clubDirective.ts
//
// DIRECTIVE D'ENTRAÎNEMENT — l'objet, distinct de la note privée, DESTINÉ à
// influencer la préparation le jour où le moteur saura la lire.
//
// ─── ⚠️ CE QU'ELLE NE FAIT PAS ENCORE, ET QU'AUCUN TEXTE NE DOIT PROMETTRE ──
// Le backend de génération NE LIT PAS la directive aujourd'hui. Elle voyage bien
// dans le contexte envoyé (services/aiContextHelpers.ts), mais rien, côté
// moteur, ne s'en sert : aucune séance n'est adaptée parce qu'une directive
// existe.
//
// Conséquence, décidée par Kyllian (lot correctif B2.2) : AUCUN texte affiché —
// ni au coach, ni au joueur — ne doit dire ou laisser entendre qu'elle influence
// une séance, qu'elle a été « prise en compte », ou que « FKS en tient compte ».
// Les anciennes formulations disaient vrai sur le transport (« transmise à
// FKS ») et faux sur l'effet : un lecteur en déduisait que sa séance avait été
// construite avec. C'est la promesse interdite.
//
// La phrase honnête, la seule, est `CLUB_DIRECTIVE_PREPARATION_NOTICE`. Un test
// balaie toutes les constantes de texte exportées d'ici et fait échouer la suite
// si une promesse d'influence réapparaît
// (domain/__tests__/clubDirectivePromesse.test.ts).
//
// Le jour où le moteur lira réellement la directive : ce sera un chantier à
// part, avec ses propres preuves, et c'est SEULEMENT à ce moment-là que ces
// phrases changeront.
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
//  - Elle ne modifie AUCUNE séance aujourd'hui (cf. en-tête). Le jour où le
//    moteur la lira, elle entrera dans le contexte comme une préférence, jamais
//    comme un ordre : les garde-fous (douleurs, âge, caps de durée, deload)
//    resteront devant.
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
 *
 * Il disait aussi « et susceptible d'influencer ses prochaines séances ». La
 * moitié VRAIE (le joueur lit) est gardée ; la moitié FAUSSE (l'influence) est
 * retirée, et remplacée par `CLUB_DIRECTIVE_PREPARATION_NOTICE` qui dit la
 * situation réelle.
 */
export const CLUB_DIRECTIVE_LABEL =
  "Directive d'entraînement — visible par le joueur, dans l'application, dès qu'elle est enregistrée.";

/**
 * LA phrase d'honnêteté, au caractère près (verrouillée par un test d'égalité
 * stricte). Elle est affichée AU COACH au moment où il écrit, et AU JOUEUR au
 * moment où il lit : les deux doivent savoir la même chose.
 *
 * Tant que le moteur ne lit pas la directive, c'est la seule formulation
 * autorisée à parler de séances.
 */
export const CLUB_DIRECTIVE_PREPARATION_NOTICE =
  "Fonction en préparation — cette directive n'est pas encore appliquée aux séances";

/**
 * Rappel affiché juste au-dessus du champ de saisie. Le libellé ci-dessus dit
 * QUI lit ; celui-ci dit CE QU'ON N'ÉCRIT PAS. Les deux sont nécessaires : un
 * coach averti que « le joueur voit » peut encore écrire une blessure.
 */
export const CLUB_DIRECTIVE_WRITE_WARNING =
  "Tout l'effectif peut lire cette directive. N'y mets aucune information de santé, ni rien qui permette de deviner l'état d'un joueur.";

/**
 * Fin de la fenêtre de validité, dite au coach.
 *
 * Elle disait « la directive cesse d'être transmise » — vrai sur le transport,
 * mais « transmise » laissait entendre qu'elle servait à quelque chose de
 * l'autre côté. Ce qui est OBSERVABLE, et donc ce qu'on annonce : passé le
 * délai, les joueurs ne la voient plus.
 */
export const CLUB_DIRECTIVE_DURATION_HINT =
  "À partir d'aujourd'hui. Passé ce délai, tes joueurs ne la voient plus.";

/**
 * Confirmation affichée au coach APRÈS enregistrement.
 *
 * Elle disait « FKS en tient compte pour leurs prochaines séances » : c'était
 * la promesse mensongère la plus directe du chantier — annoncée au moment
 * précis où le coach a le plus de raisons d'y croire. Elle ne parle plus que de
 * ce qui a réellement eu lieu : le message est enregistré, et lisible.
 *
 * Exportée (plutôt qu'écrite dans l'écran) pour être balayée par le test
 * anti-promesse : un texte de succès non exporté échapperait à la vérification.
 */
export const CLUB_DIRECTIVE_SAVED_TOAST = {
  titre: "Directive enregistrée",
  message: "Tes joueurs peuvent la lire depuis leur application.",
} as const;

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
   * directive ET ce qu'elle ne fait pas. Un joueur qui lit « Renfo terrain »
   * sans cette phrase peut croire que son club a écrit sa séance.
   *
   * Elle disait « FKS en tient compte pour tes séances » : c'était faux, le
   * moteur ne la lit pas (cf. en-tête). Elle dit maintenant la consigne pour ce
   * qu'elle est — un message de son club, à appliquer par lui-même.
   */
  precision: string;
  /**
   * L'état RÉEL de la fonction, dit au joueur avec les mêmes mots qu'au coach
   * (`CLUB_DIRECTIVE_PREPARATION_NOTICE`).
   */
  preparation: string;
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
    precision: "Ton club a posé cette consigne pour toi. C'est un message de ton coach.",
    preparation: CLUB_DIRECTIVE_PREPARATION_NOTICE,
  };
}
