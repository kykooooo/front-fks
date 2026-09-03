// screens/newSession/echecGeneration.ts
//
// DOCTRINE : une erreur technique ne devient JAMAIS une prescription sportive.
// Quand la génération échoue, il ne s'est rien passé — aucune séance créée,
// aucune ligne d'historique, aucune progression avancée. Ce module traduit un
// échec en un état d'erreur affichable, et rien d'autre.
//
// TAXONOMIE : celle du backend (docs/CONTRAT_ERREUR_FRONT.md §2 et §3). Aucun
// code n'est inventé ici. Quand la réponse ne porte pas le contrat (coupure
// réseau, 401 ou 429 des intergiciels d'entrée — §2.2), on retombe sur la
// classification client déjà en place (utils/errorHandler.ts), pas sur une
// seconde liste de codes concurrente.

import type { Session } from "../../domain/types";
import { ErrorType, classifyError } from "../../utils/errorHandler";
import { estSeanceArtificielle, selectPendingSession } from "../../utils/sessionHelpers";
import type { FKS_NextSessionV2 } from "./types";

/**
 * Catégories du contrat backend (§2.1). Jamais affichées au joueur.
 *
 * `securite` n'est PAS une panne : c'est un refus délibéré du moteur quand le
 * joueur a déclaré une douleur récente forte ou une blessure grave. Elle est
 * déduite du code `safety_no_session` (le backend n'envoie pas de `category`
 * sur ce corps-là), et elle ne propose jamais de ré-essai — relancer ne
 * change rien tant que la déclaration est là, et le laisser croire le
 * contraire pousserait le joueur à s'entraîner blessé.
 */
export type CategorieEchec = "transitoire" | "sportif" | "technique" | "securite";

/** Code du refus de sécurité (contrat backend, HTTP 422). */
export const CODE_REFUS_SECURITE = "safety_no_session";

/** Sorties proposées au joueur. La première du tableau est la principale. */
export type ActionEchec =
  | "reessayer"
  | "reessayer_enregistrement"
  | "modifier_contraintes"
  | "choisir_cycle"
  | "se_reconnecter"
  | "reprendre_seance"
  | "ouvrir_mon_corps"
  | "retour_accueil";

/**
 * Sorties d'un refus de sécurité — les MÊMES sur le chemin normal
 * (`actionsDuContrat`) et sur le corps abîmé (`lireRefusSecuriteDegrade`) :
 * un refus de sécurité reste un refus de sécurité, que le backend ait ou non
 * réussi à joindre un `message`. « Ouvrir Mon corps » avant « Revenir à
 * l'accueil » (P1 round 2) : le joueur bloqué par une gêne déclarée a une
 * porte de sortie nommée, pas seulement la sortie de l'écran.
 */
const ACTIONS_REFUS_SECURITE: ActionEchec[] = ["ouvrir_mon_corps", "retour_accueil"];

export type EchecGeneration = {
  /** "contrat" = corps typé du backend ; "client" = panne avant/hors contrat. */
  source: "contrat" | "client";
  /** Code du contrat backend, ou null quand la réponse n'en portait pas. */
  code: string | null;
  categorie: CategorieEchec;
  /** Indication machine du backend : un ré-essai identique a une chance. */
  retryable: boolean;
  /** Le seul texte montré au joueur. Aucun détail technique. */
  messageJoueur: string;
  /** Identifiant support, affiché discrètement. Jamais un message d'erreur. */
  requestId: string | null;
  /** Secondes à patienter (429 avec en-tête retry-after). */
  attendreS: number | null;
  actions: ActionEchec[];
};

/* ─── Panne APRÈS une génération payée (persistance / affichage) ──────────
 * `orchestrator.ts` appelle `persistPlanned(payload)` PUIS `pushSession` /
 * `navigate`. Une panne à ce stade n'est pas une panne de génération : le
 * backend a déjà répondu (l'appel est payé), donc "aucune séance n'a été
 * enregistrée" serait FAUX dès que `persistPlanned` a réussi. On distingue
 * les deux étapes pour ne jamais mentir sur ce que Firestore contient déjà,
 * et pour permettre un nouvel essai qui rejoue seulement l'étape ratée —
 * jamais un nouvel appel de génération. */

/** Étape où la panne est survenue, une fois la génération déjà obtenue. */
export type EtapeEchecPostGeneration = "persistance" | "affichage";

/**
 * Tout ce qu'il faut pour rejouer l'étape ratée sans regénérer : le payload
 * déjà construit (même id) et la séance locale déjà transformée. Traversée
 * telle quelle par `decisionApresEchec`, jamais inspectée ni modifiée ici.
 */
export type SeancePayeeEnAttente = {
  payload: Record<string, unknown>;
  sessionWithAi: Session;
  v2: FKS_NextSessionV2;
  plannedDateISO: string;
  deferredToTomorrow: boolean;
};

/**
 * Levée par l'orchestrateur quand `persistPlanned` échoue (étape
 * "persistance", rien en base) ou quand `persistPlanned` a RÉUSSI mais
 * l'étape suivante — store local / navigation — échoue (étape "affichage",
 * la séance existe déjà côté Firestore).
 */
export class EchecPostGeneration extends Error {
  readonly etape: EtapeEchecPostGeneration;
  readonly causeOriginale: unknown;
  readonly seance: SeancePayeeEnAttente;

  constructor(etape: EtapeEchecPostGeneration, causeOriginale: unknown, seance: SeancePayeeEnAttente) {
    super(causeOriginale instanceof Error ? causeOriginale.message : String(causeOriginale));
    this.name = "EchecPostGeneration";
    this.etape = etape;
    this.causeOriginale = causeOriginale;
    this.seance = seance;
  }
}

/** Messages honnêtes pour une panne post-génération : jamais "aucune séance
 * n'a été enregistrée" quand `persistance` (donc Firestore) a réussi. */
function lireEchecPostGeneration(erreur: EchecPostGeneration): EchecGeneration {
  const messageJoueur =
    erreur.etape === "persistance"
      ? "Ta séance a bien été générée, mais elle n'a pas encore pu être enregistrée. Réessaie l'enregistrement : elle ne sera pas régénérée, seulement enregistrée."
      : "Ta séance a été générée et déjà enregistrée. On n'a pas réussi à te l'afficher. Réessaie l'affichage : rien ne sera régénéré ni ré-enregistré.";

  return {
    source: "client",
    code: null,
    categorie: "transitoire",
    retryable: true,
    messageJoueur,
    requestId: null,
    attendreS: null,
    actions: ["reessayer_enregistrement", "retour_accueil"],
  };
}

/**
 * Budget de ré-essai AUTOMATIQUE côté écran : ZÉRO, sans exception.
 *
 * Le contrat (§5.2) autorise au plus UN ré-essai automatique, et il est déjà
 * dépensé dans `fetchV2` (réveil du serveur Render). Après lui, seul le joueur
 * relance : chaque relance peut coûter jusqu'à quatre appels payants. Pas de
 * boucle, pas de backoff, pas de rejeu au retour du réseau, rien en file
 * d'attente hors-ligne.
 */
export const REESSAIS_AUTOMATIQUES_ECRAN = 0;

/* ─── Messages joueur pour les pannes SANS contrat backend ─────────────────
 * Le contrat impose d'afficher `message` tel quel quand il existe (§6). Ces
 * textes ne servent donc que quand le backend n'a rien pu dire : ils gardent
 * la même promesse — rien n'a été enregistré. */
const MESSAGES = {
  reseau:
    "Impossible de préparer ta séance : tu n'es pas connecté à internet. Aucune séance n'a été enregistrée. Réessaie une fois la connexion revenue.",
  indisponible:
    "Le service est momentanément indisponible. Aucune séance n'a été enregistrée. Tu peux réessayer dans quelques instants.",
  authentification:
    "Reconnecte-toi pour préparer ta séance. Aucune séance n'a été enregistrée.",
  tropVite:
    "Tu as lancé plusieurs générations coup sur coup. Aucune séance n'a été enregistrée. Laisse passer quelques secondes et réessaie.",
  reglages:
    "Nous n'avons pas réussi à préparer ta séance avec ces réglages. Aucune séance n'a été enregistrée. Modifie ton lieu ou ton matériel, puis réessaie.",
  inconnu:
    "Impossible de préparer ta séance pour le moment. Aucune séance n'a été enregistrée. Tu peux réessayer.",
} as const;

const CATEGORIES: readonly string[] = ["transitoire", "sportif", "technique"];

type CorpsContrat = {
  code: string;
  categorie: CategorieEchec;
  retryable: boolean;
  message: string;
  requestId: string | null;
  /** Drapeaux du refus de sécurité (`safety_flags`). Vide sinon. */
  drapeauxSecurite: string[];
  /** Avertissement santé rédigé par le backend, quand il en fournit un. */
  disclaimer: string | null;
};

/** Décode le corps HTTP brut porté par `error.message`, sans rien interpréter. */
function analyserCorpsBrut(brut: unknown): Record<string, unknown> | null {
  if (typeof brut !== "string") return null;
  const texte = brut.trim();
  if (!texte.startsWith("{")) return null;

  let analyse: unknown;
  try {
    analyse = JSON.parse(texte);
  } catch {
    return null;
  }
  if (!analyse || typeof analyse !== "object" || Array.isArray(analyse)) return null;
  return analyse as Record<string, unknown>;
}

function lireTexte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** `safety_flags` : liste de chaînes, toujours rendue comme un tableau. */
function lireDrapeauxSecurite(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.map((d) => lireTexte(d)).filter((d) => d.length > 0);
}

/**
 * Lit le corps d'erreur typé du backend (§2.1 : huit champs, jamais un
 * neuvième). Retourne null si la réponse n'obéit pas au contrat — c'est le cas
 * des 401 et 429 d'entrée (§2.2), dont le `message` est un jeton technique
 * qu'il ne faut surtout pas montrer au joueur.
 */
function lireCorpsContrat(brut: unknown): CorpsContrat | null {
  const analyse = analyserCorpsBrut(brut);
  if (!analyse) return null;

  const code = lireTexte(analyse.code);
  const message = lireTexte(analyse.message);
  if (!code || !message) return null;

  const drapeauxSecurite = lireDrapeauxSecurite(analyse.safety_flags);
  const disclaimerBackend = lireTexte(analyse.disclaimer);
  const refusSecurite = code === CODE_REFUS_SECURITE;

  // Un refus de sécurité n'est jamais retryable, quoi que dise le corps :
  // le moteur refusera à l'identique tant que la déclaration est récente.
  const retryable = refusSecurite ? false : analyse.retryable === true;
  const categorie: CategorieEchec = refusSecurite
    ? "securite"
    : typeof analyse.category === "string" && CATEGORIES.includes(analyse.category)
    ? (analyse.category as CategorieEchec)
    : retryable
    ? "transitoire"
    : "technique";

  const requestId = lireTexte(analyse.requestId) || null;

  return {
    code,
    categorie,
    retryable,
    message,
    requestId,
    drapeauxSecurite,
    disclaimer: disclaimerBackend || null,
  };
}

/* ─── Refus de sécurité : le texte montré au joueur ────────────────────────
 * Le backend écrit la phrase de tête (la raison sportive, rédigée d'avance).
 * Le front n'y ajoute que ce qu'il sait de source sûre : QUELLE déclaration
 * du joueur a déclenché la prudence, et ce qu'il fait aujourd'hui. Aucun
 * nombre de jours n'est affiché — le front ne connaît pas la fenêtre appliquée
 * par le moteur, donc il n'en invente pas. Les identifiants de drapeaux
 * (RF1…, RF2…) ne sortent JAMAIS de ce fichier. */

const TEXTES_SECURITE = {
  /** Utilisé seulement si le backend n'a pas fourni de `message` (corps abîmé). */
  entete:
    "On ne te propose pas de séance aujourd'hui : ta dernière déclaration demande de la prudence.",
  douleur:
    "C'est la douleur que tu as indiquée à ton dernier feedback qui déclenche cette prudence.",
  blessure:
    "C'est la blessure que tu as déclarée (gravité forte) qui déclenche cette prudence.",
  /** Partie commune, quel que soit le drapeau. */
  sortieRepos: "Le repos est la séance du jour.",
  /**
   * RF1 (douleur du feedback) : la fenêtre est côté backend
   * (`INJURY_ACTIVE_WINDOW_DAYS`, 7 jours glissants côté `pains[]`/
   * `injury_max_severity` — RF1 lui-même n'a PAS de fenêtre, cf. erratum 1 du
   * design, mais le front ne le sait pas et ne l'invente pas). Formule neutre,
   * sans promettre une expiration que le front ne peut pas garantir.
   */
  sortieRf1: "Cette prudence s'applique tant que ta dernière déclaration est récente.",
  /**
   * RF2 (blessure gravité 3) : CONTRAIREMENT à RF1, il existe une vraie porte
   * de sortie que le front connaît et peut nommer — baisser la gravité ou
   * changer le statut dans « Mon corps » (D12 : une gêne en reprise part en
   * gravité 1, une gêne guérie ne part plus du tout). Dire « récente » ici
   * serait faux : la déclaration ne s'efface jamais toute seule (D12), seul
   * un geste du joueur dans Mon corps la fait bouger.
   */
  sortieRf2: "Cette prudence s'applique tant que tu n'as pas mis à jour cette gêne dans Mon corps.",
  disclaimer: "Si la douleur persiste, consulte un professionnel de santé.",
} as const;

/**
 * Assemble le message d'un refus de sécurité : phrase du backend, explication
 * honnête selon les drapeaux, voie de sortie, avertissement santé (celui du
 * backend s'il en envoie un, plutôt qu'un texte écrit ici).
 *
 * La voie de sortie n'est PAS un texte unique : RF1 (douleur du feedback) et
 * RF2 (gravité 3 dans Mon corps) ne se lèvent pas de la même façon (erratum 1
 * du design, P1 round 2). Quand RF2 est présent — seul ou avec RF1 — c'est SA
 * phrase qui sort : c'est la plus exigeante (rien ne bouge sans un geste
 * explicite dans Mon corps), et c'est aussi la seule des deux qui offre une
 * vraie action au joueur.
 */
export function messageRefusSecurite(params: {
  message?: string | null;
  drapeaux?: string[];
  disclaimer?: string | null;
}): string {
  const drapeaux = params.drapeaux ?? [];
  const douleur = drapeaux.some((d) => d.toUpperCase().startsWith("RF1"));
  const blessure = drapeaux.some((d) => d.toUpperCase().startsWith("RF2"));

  const paragraphes = [lireTexte(params.message) || TEXTES_SECURITE.entete];
  if (douleur) paragraphes.push(TEXTES_SECURITE.douleur);
  if (blessure) paragraphes.push(TEXTES_SECURITE.blessure);
  paragraphes.push(`${TEXTES_SECURITE.sortieRepos} ${blessure ? TEXTES_SECURITE.sortieRf2 : TEXTES_SECURITE.sortieRf1}`);
  paragraphes.push(lireTexte(params.disclaimer) || TEXTES_SECURITE.disclaimer);

  return paragraphes.join("\n\n");
}

/**
 * Refus de sécurité dont le corps est incomplet (`message` manquant ou vide) :
 * on ne retombe PAS sur la classification client, qui dirait « modifie ton
 * lieu ou ton matériel, puis réessaie ». Ce serait pousser un joueur douloureux
 * à retaper contre un refus qui ne bougera pas.
 */
function lireRefusSecuriteDegrade(brut: unknown): EchecGeneration | null {
  const analyse = analyserCorpsBrut(brut);
  if (!analyse) return null;
  const code = lireTexte(analyse.code) || lireTexte(analyse.error);
  if (code !== CODE_REFUS_SECURITE) return null;

  return {
    source: "contrat",
    code: CODE_REFUS_SECURITE,
    categorie: "securite",
    retryable: false,
    messageJoueur: messageRefusSecurite({
      message: lireTexte(analyse.message),
      drapeaux: lireDrapeauxSecurite(analyse.safety_flags),
      disclaimer: lireTexte(analyse.disclaimer),
    }),
    requestId: lireTexte(analyse.requestId) || null,
    attendreS: null,
    actions: ACTIONS_REFUS_SECURITE,
  };
}

/**
 * Sorties proposées selon le contrat (§4.3 et §5.3) : « Réessayer », plus
 * « Modifier mes contraintes » quand la catégorie est sportive — relancer à
 * l'identique une demande impossible ne la rendra pas possible.
 */
function actionsDuContrat(corps: CorpsContrat): ActionEchec[] {
  // Refus de sécurité : jamais « Réessayer » (modifier son matériel ne lève
  // pas une douleur déclarée), mais une vraie porte de sortie vers Mon corps.
  if (corps.categorie === "securite") {
    return ACTIONS_REFUS_SECURITE;
  }
  if (corps.code === "missing_goal") {
    return ["choisir_cycle", "reessayer", "retour_accueil"];
  }
  if (corps.categorie === "sportif") {
    return ["modifier_contraintes", "reessayer", "retour_accueil"];
  }
  return ["reessayer", "retour_accueil"];
}

function echecAuthentification(): EchecGeneration {
  return {
    source: "client",
    code: null,
    categorie: "technique",
    retryable: false,
    messageJoueur: MESSAGES.authentification,
    requestId: null,
    attendreS: null,
    actions: ["se_reconnecter", "retour_accueil"],
  };
}

/** Panne survenue avant (ou en dehors de) la frontière d'erreur du backend. */
function echecCote(erreur: unknown): EchecGeneration {
  const classee = classifyError(erreur);
  const attendreS =
    typeof (erreur as { retryAfterS?: number })?.retryAfterS === "number" &&
    (erreur as { retryAfterS: number }).retryAfterS > 0
      ? (erreur as { retryAfterS: number }).retryAfterS
      : null;

  const base = {
    source: "client" as const,
    code: null,
    requestId: null,
    attendreS: null as number | null,
  };

  switch (classee.type) {
    case ErrorType.NETWORK:
      return {
        ...base,
        categorie: "transitoire",
        retryable: true,
        messageJoueur: MESSAGES.reseau,
        actions: ["reessayer", "retour_accueil"],
      };
    case ErrorType.TIMEOUT:
    case ErrorType.SERVER:
      return {
        ...base,
        categorie: "transitoire",
        retryable: true,
        messageJoueur: MESSAGES.indisponible,
        actions: ["reessayer", "retour_accueil"],
      };
    case ErrorType.RATE_LIMIT:
      return {
        ...base,
        categorie: "transitoire",
        retryable: true,
        messageJoueur: MESSAGES.tropVite,
        attendreS,
        actions: ["reessayer", "retour_accueil"],
      };
    case ErrorType.AUTH:
      return echecAuthentification();
    case ErrorType.VALIDATION:
      return {
        ...base,
        categorie: "sportif",
        retryable: false,
        messageJoueur: MESSAGES.reglages,
        actions: ["modifier_contraintes", "reessayer", "retour_accueil"],
      };
    default:
      return {
        ...base,
        categorie: "technique",
        retryable: false,
        messageJoueur: MESSAGES.inconnu,
        actions: ["reessayer", "retour_accueil"],
      };
  }
}

/** Traduit n'importe quelle erreur de génération en état d'erreur affichable. */
export function lireEchecGeneration(erreur: unknown): EchecGeneration {
  // Panne survenue APRÈS une génération payée : ce n'est jamais "aucune
  // séance n'a été enregistrée" tel quel, prioritaire sur toute autre lecture.
  if (erreur instanceof EchecPostGeneration) {
    return lireEchecPostGeneration(erreur);
  }

  const brut = (erreur ?? {}) as {
    code?: string;
    status?: number;
    message?: string;
    retryAfterS?: number;
  };

  // Authentification : le front écrit son propre texte (§2.2), le `message`
  // du backend valant ici un jeton technique (missing_auth, invalid_id_token…).
  if (brut.code === "AUTH_REQUIRED" || brut.status === 401) {
    return echecAuthentification();
  }

  // Le contrat backend, quand il est là, fait foi.
  const corps = lireCorpsContrat(brut.message);
  if (corps) {
    // Un 429 peut porter À LA FOIS un corps typé (§2.1) ET un en-tête
    // Retry-After (posé par safeFetch sur `retryAfterS`) : le corps typé ne
    // doit pas écraser cette information à `null`, sinon le joueur perd le
    // délai à respecter alors que le backend l'a bien communiqué.
    const attendreS =
      typeof brut.retryAfterS === "number" && brut.retryAfterS > 0 ? brut.retryAfterS : null;
    const refusSecurite = corps.categorie === "securite";
    return {
      source: "contrat",
      code: corps.code,
      categorie: corps.categorie,
      retryable: corps.retryable,
      // §6 : le message backend est affiché tel quel. Pour un refus de
      // sécurité, il reste la phrase de tête — le front ajoute seulement
      // l'explication et la voie de sortie, jamais un chiffre.
      messageJoueur: refusSecurite
        ? messageRefusSecurite({
            message: corps.message,
            drapeaux: corps.drapeauxSecurite,
            disclaimer: corps.disclaimer,
          })
        : corps.message,
      requestId: corps.requestId,
      // Un refus de sécurité n'a pas de délai à faire patienter : il n'y a
      // rien à relancer une fois le compteur écoulé.
      attendreS: refusSecurite ? null : attendreS,
      actions: actionsDuContrat(corps),
    };
  }

  // Refus de sécurité au corps abîmé : traité avant la classification client,
  // qui en ferait un « modifie tes réglages et réessaie » trompeur.
  const refusDegrade = lireRefusSecuriteDegrade(brut.message);
  if (refusDegrade) return refusDegrade;

  return echecCote(erreur);
}

/* ─── Réouverture d'une VRAIE séance ───────────────────────────────────────
 * Rouvrir une séance déjà prescrite, validée et persistée n'est PAS un repli :
 * rien de neuf n'est fabriqué. Mais il faut prouver que c'en est bien une. */

/** Motifs de refus, utiles aux tests et à la relecture. Jamais affichés. */
export type MotifRefusReprise =
  | "aucune_seance"
  | "seance_artificielle"
  | "autre_joueur"
  | "snapshot_invalide"
  | "seance_remplacee";

export type Reprise =
  | { reouvrable: true; seance: Session }
  | { reouvrable: false; seance: null; motif: MotifRefusReprise };

function estRemplacee(seance: Session | any): boolean {
  return Boolean(seance?.replacedBy || seance?.invalidatedAt || seance?.invalidated);
}

/**
 * Le snapshot doit contenir la prescription réellement servie (`aiV2`) et au
 * moins un exercice : sans ça, l'écran de séance n'aurait rien à ouvrir.
 */
function snapshotValide(seance: Session | any): boolean {
  const v2 = seance?.aiV2;
  if (!v2 || typeof v2 !== "object") return false;
  const blocs = (v2 as { blocks?: unknown }).blocks;
  const aDesBlocs = Array.isArray(blocs) && blocs.length > 0;
  const aDesExercices = Array.isArray(seance?.exercises) && seance.exercises.length > 0;
  return aDesBlocs || aDesExercices;
}

/**
 * Cherche une vraie séance rouvrable pour ce joueur, à cette date.
 * `uid` est facultatif : le store est déjà cloisonné par joueur, ce contrôle
 * est un garde-fou de plus quand la séance porte son propriétaire.
 */
export function chercherRepriseSeance(params: {
  sessions: Session[];
  todayKey: string;
  uid?: string | null;
}): Reprise {
  const { sessions, todayKey, uid = null } = params;

  // selectPendingSession écarte déjà : séances terminées, hors fenêtre du jour,
  // et séances artificielles (ancienne séance de secours).
  const candidate = selectPendingSession(Array.isArray(sessions) ? sessions : [], todayKey);
  if (!candidate) {
    // On distingue « rien du tout » de « quelque chose, mais artificiel » pour
    // que le refus d'une ancienne séance de secours reste explicite.
    const artificielleDansLeLot = (Array.isArray(sessions) ? sessions : []).some(
      (s) => !s?.completed && estSeanceArtificielle(s)
    );
    return {
      reouvrable: false,
      seance: null,
      motif: artificielleDansLeLot ? "seance_artificielle" : "aucune_seance",
    };
  }

  if (estSeanceArtificielle(candidate)) {
    return { reouvrable: false, seance: null, motif: "seance_artificielle" };
  }

  const proprietaire =
    typeof (candidate as any).userId === "string"
      ? (candidate as any).userId
      : typeof (candidate as any).uid === "string"
      ? (candidate as any).uid
      : null;
  if (uid && proprietaire && proprietaire !== uid) {
    return { reouvrable: false, seance: null, motif: "autre_joueur" };
  }

  if (estRemplacee(candidate)) {
    return { reouvrable: false, seance: null, motif: "seance_remplacee" };
  }

  if (!snapshotValide(candidate)) {
    return { reouvrable: false, seance: null, motif: "snapshot_invalide" };
  }

  return { reouvrable: true, seance: candidate };
}

/* ─── Décision complète ─────────────────────────────────────────────────── */

export type DecisionApresEchec = {
  echec: EchecGeneration;
  /**
   * INVARIANT : une panne ne crée jamais de séance. Ce champ vaut toujours
   * `null`, et son type l'impose — il n'existe aucune branche capable de le
   * remplir.
   */
  seanceCreee: null;
  reprise: Reprise;
  actions: ActionEchec[];
  /**
   * Séance déjà générée (payée) en attente d'enregistrement ou d'affichage —
   * renseignée uniquement quand `erreur` est une `EchecPostGeneration`.
   * Porte l'étape ratée ET la séance pour que l'appelant puisse rejouer
   * exactement cette étape (voir `orchestrator.rejouerApresEchecPostGeneration`)
   * sans relancer d'appel payant. `null` dans tous les autres cas.
   */
  postGeneration: { etape: EtapeEchecPostGeneration; seance: SeancePayeeEnAttente } | null;
};

/**
 * Seule porte de sortie du `catch` de génération : elle rend un état d'erreur
 * et, éventuellement, une vraie séance à rouvrir. Elle n'écrit rien.
 */
export function decisionApresEchec(params: {
  erreur: unknown;
  sessions: Session[];
  todayKey: string;
  uid?: string | null;
}): DecisionApresEchec {
  const echec = lireEchecGeneration(params.erreur);
  const reprise = chercherRepriseSeance({
    sessions: params.sessions,
    todayKey: params.todayKey,
    uid: params.uid ?? null,
  });

  // Refus de sécurité : on ne propose pas non plus de rouvrir une séance déjà
  // prescrite. « Le repos est la séance du jour » et un bouton « Reprendre ma
  // séance » juste en dessous se contrediraient — et c'est le bouton qui
  // gagnerait.
  const actions: ActionEchec[] =
    reprise.reouvrable && echec.categorie !== "securite"
      ? [...echec.actions.slice(0, 1), "reprendre_seance", ...echec.actions.slice(1)]
      : [...echec.actions];

  const postGeneration =
    params.erreur instanceof EchecPostGeneration
      ? { etape: params.erreur.etape, seance: params.erreur.seance }
      : null;

  return { echec, seanceCreee: null, reprise, actions, postGeneration };
}

/* ─── Verrou anti double-clic ───────────────────────────────────────────────
 * Une génération coûte de l'argent : deux appuis ne doivent jamais produire
 * deux requêtes concurrentes. Le verrou est synchrone (pas un état React, qui
 * serait périmé dans le même tick). */

export type VerrouGeneration = {
  /** true si le verrou vient d'être pris ; false s'il était déjà tenu. */
  prendre: () => boolean;
  rendre: () => void;
  estPris: () => boolean;
};

export function creerVerrouGeneration(): VerrouGeneration {
  let pris = false;
  return {
    prendre: () => {
      if (pris) return false;
      pris = true;
      return true;
    },
    rendre: () => {
      pris = false;
    },
    estPris: () => pris,
  };
}
