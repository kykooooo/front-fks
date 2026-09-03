// screens/newSession/__tests__/echecGeneration.test.ts
//
// Tests adverses du chemin d'échec de génération.
//
// Règle prouvée ici : quand la génération rate, il ne s'est RIEN passé.
// Aucune séance créée, aucune séance générique proposée, aucune progression,
// aucun ré-essai automatique. Et une ancienne "séance de secours" (fabriquée
// par l'app avant le 27/07/2026) est reconnue et refusée à la réouverture.

import type { Session } from "../../../domain/types";
import { BackendError } from "../../../utils/errorHandler";
import {
  EchecPostGeneration,
  REESSAIS_AUTOMATIQUES_ECRAN,
  chercherRepriseSeance,
  creerVerrouGeneration,
  decisionApresEchec,
  lireEchecGeneration,
  type SeancePayeeEnAttente,
} from "../echecGeneration";

const AUJOURDHUI = "2026-07-27";

/* ─── Fabriques d'erreurs, calquées sur ce que jette réellement safeFetch ─── */

const erreurReseau = () =>
  Object.assign(new Error("Network request failed"), { code: "NETWORK_ERROR" });

const erreurTimeout = () =>
  Object.assign(new Error("Request timeout"), { code: "ETIMEDOUT" });

/** Corps typé du backend (docs/CONTRAT_ERREUR_FRONT.md §2.1, huit champs). */
const corpsContrat = (params: {
  code: string;
  category: "transitoire" | "sportif" | "technique";
  retryable: boolean;
  message: string;
  failedStep?: string | null;
  requestId?: string;
}) =>
  JSON.stringify({
    error: params.code,
    code: params.code,
    category: params.category,
    retryable: params.retryable,
    message: params.message,
    failedStep: params.failedStep ?? null,
    requestId: params.requestId ?? "req-0001",
    traceId: params.requestId ?? "req-0001",
  });

const erreurContrat = (
  status: number,
  params: Parameters<typeof corpsContrat>[0],
  retryAfterS?: number
) => new BackendError(status, "Unprocessable Entity", corpsContrat(params), undefined, retryAfterS);

/* ─── Fabriques de séances ─────────────────────────────────────────────── */

const vraieSeance = (extra: Partial<Session> = {}): Session =>
  ({
    id: "sess_reelle_1",
    date: AUJOURDHUI,
    dateISO: AUJOURDHUI,
    phase: "Playlist",
    focus: "force",
    intensity: "moderate",
    volumeScore: 60,
    completed: false,
    exercises: [
      { id: "squat", name: "Squat barre", modality: "strength", intensity: "moderate", sets: 4 },
    ],
    aiV2: {
      title: "Force bas du corps",
      blocks: [{ id: "main", type: "strength", items: [{ name: "Squat barre" }] }],
      guardrailsApplied: ["age:u17"],
    },
    ...extra,
  }) as unknown as Session;

/** Ce que l'ancienne fabrique locale produisait : id `fallback_*` + `fallback_safe`. */
const ancienneSeanceDeSecours = (): Session =>
  ({
    id: `fallback_${AUJOURDHUI}_ab12`,
    date: AUJOURDHUI,
    dateISO: AUJOURDHUI,
    phase: "Playlist",
    focus: "run",
    intensity: "moderate",
    volumeScore: 45,
    completed: false,
    exercises: [
      { id: "x_run", name: "Footing Z2", modality: "run", intensity: "moderate", sets: 1 },
    ],
    aiV2: {
      title: "Fallback FKS",
      blocks: [{ id: "run", type: "run", items: [{ name: "Footing continu" }] }],
      guardrailsApplied: ["fallback_safe"],
    },
  }) as unknown as Session;

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. Lecture de l'échec — les cas adverses, un par un
 * ═══════════════════════════════════════════════════════════════════════ */

describe("lireEchecGeneration — pannes sans contrat backend", () => {
  test("erreur reseau : message honnete, aucune donnee technique", () => {
    const echec = lireEchecGeneration(erreurReseau());
    expect(echec.source).toBe("client");
    expect(echec.categorie).toBe("transitoire");
    expect(echec.messageJoueur).toContain("Aucune séance n'a été enregistrée");
    expect(echec.actions[0]).toBe("reessayer");
    expect(echec.actions).toContain("retour_accueil");
  });

  test("timeout : service momentanement indisponible", () => {
    const echec = lireEchecGeneration(erreurTimeout());
    expect(echec.categorie).toBe("transitoire");
    expect(echec.messageJoueur).toContain("momentanément indisponible");
  });

  test("erreur serveur sans corps lisible : message generique, jamais le corps brut", () => {
    const echec = lireEchecGeneration(
      new BackendError(500, "Internal Server Error", "<html>Bad Gateway</html>")
    );
    expect(echec.categorie).toBe("transitoire");
    expect(echec.messageJoueur).not.toContain("html");
    expect(echec.messageJoueur).not.toContain("Bad Gateway");
  });

  test("401 : le jeton technique du backend n'est JAMAIS affiche", () => {
    const erreur = new BackendError(
      401,
      "Unauthorized",
      JSON.stringify({ error: "unauthorized", message: "missing_auth", requestId: "r-9" })
    );
    const echec = lireEchecGeneration(erreur);
    expect(echec.messageJoueur).not.toContain("missing_auth");
    expect(echec.messageJoueur).toContain("Reconnecte-toi");
    expect(echec.actions[0]).toBe("se_reconnecter");
  });

  test("AUTH_REQUIRED (persistance Firestore) : meme traitement que le 401", () => {
    const echec = lireEchecGeneration(Object.assign(new Error("no auth"), { code: "AUTH_REQUIRED" }));
    expect(echec.actions[0]).toBe("se_reconnecter");
  });

  test("429 d'entree : on patiente, retry-after respecte, corps jamais affiche", () => {
    const erreur = new BackendError(
      429,
      "Too Many Requests",
      JSON.stringify({ error: "rate_limited", kind: "cooldown", source: "uid" }),
      undefined,
      12
    );
    const echec = lireEchecGeneration(erreur);
    expect(echec.attendreS).toBe(12);
    expect(echec.messageJoueur).not.toContain("rate_limited");
    expect(echec.messageJoueur).toContain("Aucune séance n'a été enregistrée");
  });

  test("erreur inconnue : comportement sur, aucun plantage", () => {
    expect(lireEchecGeneration(undefined).categorie).toBe("technique");
    expect(lireEchecGeneration("boom").messageJoueur).toContain("Aucune séance n'a été enregistrée");
    expect(lireEchecGeneration(new Error("truc bizarre")).actions).toContain("reessayer");
  });
});

describe("lireEchecGeneration — codes types du contrat backend", () => {
  test("SESSION_GENERATION_FAILED (503, transitoire) : message backend affiche tel quel", () => {
    const message =
      "Nous n'avons pas réussi à créer une séance suffisamment fiable avec tes contraintes actuelles. Rien n'a été ajouté à ton programme. Tu peux réessayer dans quelques instants.";
    const echec = lireEchecGeneration(
      erreurContrat(503, {
        code: "SESSION_GENERATION_FAILED",
        category: "transitoire",
        retryable: true,
        message,
        failedStep: "planner.openai",
      })
    );
    expect(echec.source).toBe("contrat");
    expect(echec.code).toBe("SESSION_GENERATION_FAILED");
    expect(echec.retryable).toBe(true);
    expect(echec.messageJoueur).toBe(message);
    expect(echec.actions[0]).toBe("reessayer");
  });

  test("NO_VALID_PRESCRIPTION (422, sportif) : jamais retentable automatiquement", () => {
    const echec = lireEchecGeneration(
      erreurContrat(422, {
        code: "NO_VALID_PRESCRIPTION",
        category: "sportif",
        retryable: false,
        message:
          "Nous n'avons pas réussi à construire une séance fiable pour ton objectif du jour. Rien n'a été ajouté à ton programme.",
        failedStep: "force_2agent.emphases",
      })
    );
    expect(echec.code).toBe("NO_VALID_PRESCRIPTION");
    expect(echec.retryable).toBe(false);
    expect(echec.actions[0]).toBe("modifier_contraintes");
    expect(echec.actions).toContain("reessayer");
  });

  test("SESSION_CONTRACT_FAILED (422, sportif) : refus assume, rien de propose a la place", () => {
    const message =
      "La séance construite ne correspondait pas à l'objectif demandé : nous préférons ne rien te proposer plutôt que t'envoyer autre chose. Rien n'a été ajouté à ton programme.";
    const echec = lireEchecGeneration(
      erreurContrat(422, {
        code: "SESSION_CONTRACT_FAILED",
        category: "sportif",
        retryable: false,
        message,
        failedStep: "verification_finale",
      })
    );
    expect(echec.code).toBe("SESSION_CONTRACT_FAILED");
    expect(echec.messageJoueur).toBe(message);
    expect(echec.retryable).toBe(false);
  });

  test("SESSION_CONSTRAINTS_UNRESOLVED : l'action utile est Modifier, pas Reessayer", () => {
    const echec = lireEchecGeneration(
      erreurContrat(422, {
        code: "SESSION_CONSTRAINTS_UNRESOLVED",
        category: "sportif",
        retryable: false,
        message:
          "Avec tes contraintes du jour (matériel, douleurs, temps disponible), nous n'avons pas trouvé de séance à la fois utile et sûre. Rien n'a été ajouté à ton programme.",
        failedStep: "pools.token",
      })
    );
    expect(echec.actions[0]).toBe("modifier_contraintes");
  });

  test("missing_goal : l'action utile est de choisir un cycle", () => {
    const echec = lireEchecGeneration(
      erreurContrat(400, {
        code: "missing_goal",
        category: "sportif",
        retryable: false,
        message: "Choisis ton cycle avant de générer une séance.",
      })
    );
    expect(echec.actions[0]).toBe("choisir_cycle");
  });

  test("generation_budget_exceeded : jamais de relance automatique (facture)", () => {
    const echec = lireEchecGeneration(
      erreurContrat(503, {
        code: "generation_budget_exceeded",
        category: "technique",
        retryable: false,
        message: "Nous n'avons pas réussi à créer ta séance. Rien n'a été ajouté à ton programme.",
      })
    );
    expect(echec.retryable).toBe(false);
    expect(REESSAIS_AUTOMATIQUES_ECRAN).toBe(0);
  });

  test("code inconnu du front : lu quand meme, sans plantage ni invention", () => {
    const echec = lireEchecGeneration(
      erreurContrat(500, {
        code: "un_code_qui_nexiste_pas_encore",
        category: "technique",
        retryable: false,
        message: "Nous n'avons pas réussi à créer ta séance. Rien n'a été ajouté à ton programme.",
      })
    );
    expect(echec.code).toBe("un_code_qui_nexiste_pas_encore");
    expect(echec.actions).toContain("reessayer");
  });

  test("requestId conserve pour le support, jamais le failedStep", () => {
    const echec = lireEchecGeneration(
      erreurContrat(422, {
        code: "SESSION_SCHEMA_INVALID",
        category: "technique",
        retryable: false,
        message: "Nous n'avons pas réussi à créer une séance suffisamment fiable aujourd'hui.",
        failedStep: "schema.validation",
        requestId: "5e9b0f31",
      })
    );
    expect(echec.requestId).toBe("5e9b0f31");
    expect(echec.messageJoueur).not.toContain("schema.validation");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 1ter. LOT 4 (c) — un 429 TYPÉ garde son Retry-After
 * Avant ce fix, le chemin "corps contrat présent" forçait attendreS à null
 * quoi qu'il arrive — un 429 qui portait À LA FOIS un corps typé ET un
 * en-tête Retry-After perdait ce délai, alors que le §2.2 (429 SANS corps)
 * le respectait déjà correctement.
 * ═══════════════════════════════════════════════════════════════════════ */

describe("lireEchecGeneration — 429 type conserve le Retry-After (lot 4c)", () => {
  test("429 avec corps type ET Retry-After : attendreS preserve, pas ecrase a null", () => {
    const echec = lireEchecGeneration(
      erreurContrat(
        429,
        {
          code: "SESSION_GENERATION_RATE_LIMITED",
          category: "transitoire",
          retryable: true,
          message: "Tu as lancé plusieurs générations coup sur coup. Rien n'a été ajouté à ton programme.",
        },
        15
      )
    );
    expect(echec.source).toBe("contrat");
    expect(echec.code).toBe("SESSION_GENERATION_RATE_LIMITED");
    expect(echec.attendreS).toBe(15);
  });

  test("corps type SANS Retry-After (ex: 422 sportif) : attendreS reste null, comportement inchange", () => {
    const echec = lireEchecGeneration(
      erreurContrat(422, {
        code: "NO_VALID_PRESCRIPTION",
        category: "sportif",
        retryable: false,
        message: "Rien n'a été ajouté à ton programme.",
      })
    );
    expect(echec.attendreS).toBeNull();
  });

  test("Retry-After a 0 ou negatif : traite comme absent (jamais 'patiente 0 seconde')", () => {
    const echecZero = lireEchecGeneration(
      erreurContrat(
        429,
        { code: "RATE_LIMITED", category: "transitoire", retryable: true, message: "Rien n'a été ajouté à ton programme." },
        0
      )
    );
    expect(echecZero.attendreS).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 1bis. Panne APRÈS une génération payée (persistance / affichage)
 * — LOT 1 (P0) : une panne Firestore APRÈS une génération réussie ne doit
 * jamais dire "aucune séance n'a été enregistrée", et une panne d'affichage
 * (pushSession/navigate) après une persistance RÉUSSIE ne doit jamais
 * relancer une génération payante.
 * ═══════════════════════════════════════════════════════════════════════ */

const seancePayeeEnAttente = (): SeancePayeeEnAttente => ({
  payload: { id: "planned_2026-07-27_ab12", title: "Force bas du corps" },
  sessionWithAi: vraieSeance(),
  v2: {
    version: "v2",
    title: "Force bas du corps",
    intensity: "moderate",
    focusPrimary: "strength",
    durationMin: 30,
    rpeTarget: 6,
    blocks: [],
  } as any,
  plannedDateISO: AUJOURDHUI,
  deferredToTomorrow: false,
});

describe("lireEchecGeneration — panne APRES une generation payee", () => {
  test("etape persistance : la seance N'EST PAS encore enregistree, jamais 'aucune seance'", () => {
    const echec = lireEchecGeneration(
      new EchecPostGeneration("persistance", new Error("firestore/unavailable"), seancePayeeEnAttente())
    );
    expect(echec.source).toBe("client");
    expect(echec.messageJoueur).toContain("générée");
    expect(echec.messageJoueur).not.toContain("Aucune séance n'a été enregistrée");
    expect(echec.actions[0]).toBe("reessayer_enregistrement");
  });

  test("etape affichage : la seance EST DEJA enregistree (Firestore l'a) — le dire honnetement", () => {
    const echec = lireEchecGeneration(
      new EchecPostGeneration("affichage", new Error("navigation KO"), seancePayeeEnAttente())
    );
    expect(echec.messageJoueur).toContain("déjà enregistrée");
    // L'INVARIANT du lot 1 : jamais ce mensonge quand Firestore a la séance.
    expect(echec.messageJoueur).not.toContain("Aucune séance n'a été enregistrée");
    expect(echec.actions[0]).toBe("reessayer_enregistrement");
    expect(echec.retryable).toBe(true);
  });

  test("l'action 'reessayer_enregistrement' ne propose jamais de relancer une generation (pas de 'reessayer' seul en tete)", () => {
    const echecPersistance = lireEchecGeneration(
      new EchecPostGeneration("persistance", new Error("x"), seancePayeeEnAttente())
    );
    expect(echecPersistance.actions).not.toContain("reessayer");
  });
});

describe("decisionApresEchec — postGeneration (lot 1)", () => {
  test("erreur EchecPostGeneration : postGeneration porte l'etape ET la seance a rejouer", () => {
    const seance = seancePayeeEnAttente();
    const decision = decisionApresEchec({
      erreur: new EchecPostGeneration("persistance", new Error("firestore down"), seance),
      sessions: [],
      todayKey: AUJOURDHUI,
    });
    expect(decision.postGeneration).not.toBeNull();
    expect(decision.postGeneration?.etape).toBe("persistance");
    expect(decision.postGeneration?.seance).toBe(seance);
    // Toujours l'invariant : aucune séance "créée" par la décision elle-même.
    expect(decision.seanceCreee).toBeNull();
  });

  test("erreur ordinaire (reseau, timeout, contrat) : postGeneration reste null", () => {
    const decision = decisionApresEchec({
      erreur: erreurReseau(),
      sessions: [],
      todayKey: AUJOURDHUI,
    });
    expect(decision.postGeneration).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 1quater. REFUS DE SÉCURITÉ (P0 du 01/09/2026)
 *
 * Le moteur refuse une séance quand le joueur a déclaré une douleur récente
 * forte (drapeau RF1) ou une blessure grave (RF2). Ce refus arrivait en 500
 * `{ok:false,error:"invalid_version"}` : sans `code` ni `message`, le front
 * le lisait comme une panne serveur et affichait « Le service est
 * momentanément indisponible… réessaie ». Le joueur croyait à une panne et
 * retapait — contre un mur, sans jamais savoir que c'est SA douleur qui
 * bloquait.
 *
 * Nouveau contrat : HTTP 422, `code: "safety_no_session"`, `message`,
 * `safety_flags[]`, `disclaimer?`. Ce n'est pas une panne : catégorie
 * dédiée, aucun ré-essai proposé, et une explication qui nomme la
 * déclaration en cause — jamais le code du drapeau, jamais un nombre de
 * jours que le front ne connaît pas.
 * ═══════════════════════════════════════════════════════════════════════ */

/** Corps du refus de sécurité, tel que le backend le renvoie en 422. */
const corpsRefusSecurite = (params: {
  message?: string | null;
  flags?: string[];
  disclaimer?: string;
  requestId?: string;
}) =>
  JSON.stringify({
    ok: false,
    code: "safety_no_session",
    error: "safety_no_session",
    ...(params.message === undefined ? {} : { message: params.message }),
    ...(params.flags ? { safety_flags: params.flags } : {}),
    ...(params.disclaimer ? { disclaimer: params.disclaimer } : {}),
    ...(params.requestId ? { requestId: params.requestId } : {}),
  });

const erreurRefusSecurite = (
  params: Parameters<typeof corpsRefusSecurite>[0],
  retryAfterS?: number
) =>
  new BackendError(
    422,
    "Unprocessable Entity",
    corpsRefusSecurite(params),
    undefined,
    retryAfterS
  );

const PHRASE_BACKEND =
  "On ne te propose pas de séance aujourd'hui : tu as signalé une douleur importante après ta dernière séance.";

const PHRASE_DOULEUR =
  "C'est la douleur que tu as indiquée à ton dernier feedback qui déclenche cette prudence.";
const PHRASE_BLESSURE =
  "C'est la blessure que tu as déclarée (gravité forte) qui déclenche cette prudence.";
const PHRASE_SORTIE = "Le repos est la séance du jour.";
// La suite de la phrase de sortie dépend du drapeau (P1 round 2, erratum 1) :
// RF1 n'a pas de vraie fin (le backend lit `recentSessions[0].feedback.pain`
// sans fenêtre) ; RF2, lui, a une porte de sortie nommée dans Mon corps.
const PHRASE_SORTIE_RF1 = "Cette prudence s'applique tant que ta dernière déclaration est récente.";
const PHRASE_SORTIE_RF2 =
  "Cette prudence s'applique tant que tu n'as pas mis à jour cette gêne dans Mon corps.";
const PHRASE_SANTE = "Si la douleur persiste, consulte un professionnel de santé.";

/** Ce qu'un refus de sécurité ne doit JAMAIS contenir, quel que soit le cas. */
function verifierInterditsSecurite(messageJoueur: string) {
  const minuscule = messageJoueur.toLowerCase();
  expect(minuscule).not.toContain("réessai"); // « réessaie », « réessayer »…
  expect(minuscule).not.toContain("reessai");
  expect(minuscule).not.toContain("indisponible");
  expect(minuscule).not.toContain("erreur");
  // Jargon interne : les identifiants de drapeaux ne sortent jamais.
  expect(messageJoueur).not.toContain("RF1");
  expect(messageJoueur).not.toContain("RF2");
  expect(messageJoueur).not.toContain("safety");
  // Aucun compteur inventé : le front ignore la fenêtre appliquée au moteur.
  expect(messageJoueur).not.toMatch(/\d+\s*jour/i);
}

describe("lireEchecGeneration — refus de securite (422 safety_no_session)", () => {
  test("RF1 (douleur recente forte) : categorie dediee, phrase backend + explication douleur, AUCUN re-essai", () => {
    const echec = lireEchecGeneration(
      erreurRefusSecurite({ message: PHRASE_BACKEND, flags: ["RF1_pain_recent_high"] })
    );

    expect(echec.source).toBe("contrat");
    expect(echec.code).toBe("safety_no_session");
    // Ni SERVER ni RESEAU : ce n'est pas une panne.
    expect(echec.categorie).toBe("securite");
    expect(echec.retryable).toBe(false);

    // La phrase du backend est en tête, puis l'explication honnête.
    expect(echec.messageJoueur.startsWith(PHRASE_BACKEND)).toBe(true);
    expect(echec.messageJoueur).toContain(PHRASE_DOULEUR);
    expect(echec.messageJoueur).not.toContain(PHRASE_BLESSURE);
    expect(echec.messageJoueur).toContain(PHRASE_SORTIE);
    expect(echec.messageJoueur).toContain(PHRASE_SORTIE_RF1);
    // RF1 seul : la phrase RF2 (mise à jour dans Mon corps) ne doit PAS
    // apparaître — elle promettrait une action que RF1 seul ne concerne pas.
    expect(echec.messageJoueur).not.toContain(PHRASE_SORTIE_RF2);
    expect(echec.messageJoueur).toContain(PHRASE_SANTE);
    verifierInterditsSecurite(echec.messageJoueur);

    // « Ouvrir Mon corps » en premier, jamais « Réessayer ».
    expect(echec.actions).toEqual(["ouvrir_mon_corps", "retour_accueil"]);
    expect(echec.actions).not.toContain("reessayer");
    expect(echec.actions).not.toContain("modifier_contraintes");
  });

  test("RF2 (blessure severite 3) : explication blessure, sortie vers Mon corps (pas 'declaration recente')", () => {
    const echec = lireEchecGeneration(
      erreurRefusSecurite({
        message: "Aucune séance tant que ta blessure est déclarée.",
        flags: ["RF2_severite_3"],
      })
    );

    expect(echec.categorie).toBe("securite");
    expect(echec.messageJoueur).toContain(PHRASE_BLESSURE);
    expect(echec.messageJoueur).not.toContain(PHRASE_DOULEUR);
    expect(echec.messageJoueur).toContain(PHRASE_SORTIE);
    // RF2 : contrairement à RF1, il existe une vraie sortie que le front peut
    // nommer — la déclaration ne s'efface jamais toute seule (D12), dire
    // "récente" serait donc faux (erratum 1 du design).
    expect(echec.messageJoueur).toContain(PHRASE_SORTIE_RF2);
    expect(echec.messageJoueur).not.toContain(PHRASE_SORTIE_RF1);
    verifierInterditsSecurite(echec.messageJoueur);
    expect(echec.actions).toEqual(["ouvrir_mon_corps", "retour_accueil"]);
  });

  test("RF1 + RF2 : les DEUX explications, mais la phrase de sortie est celle de RF2 (la plus exigeante)", () => {
    const echec = lireEchecGeneration(
      erreurRefusSecurite({
        message: PHRASE_BACKEND,
        flags: ["RF2_severite_3", "RF1_pain_recent_high"],
      })
    );

    expect(echec.messageJoueur).toContain(PHRASE_DOULEUR);
    expect(echec.messageJoueur).toContain(PHRASE_BLESSURE);
    expect(echec.messageJoueur.indexOf(PHRASE_DOULEUR)).toBeLessThan(
      echec.messageJoueur.indexOf(PHRASE_BLESSURE)
    );
    // RF2 gagne sur la phrase de sortie : dire "récente" (RF1) laisserait
    // croire à une expiration alors que RF2, présent aussi, n'en a aucune.
    expect(echec.messageJoueur).toContain(PHRASE_SORTIE_RF2);
    expect(echec.messageJoueur).not.toContain(PHRASE_SORTIE_RF1);
    verifierInterditsSecurite(echec.messageJoueur);
    expect(echec.actions).toEqual(["ouvrir_mon_corps", "retour_accueil"]);
  });

  test("disclaimer fourni par le backend : repris tel quel, le front n'en ecrit pas un second", () => {
    const disclaimer = "En cas de douleur qui dure, prends l'avis d'un kiné ou d'un médecin.";
    const echec = lireEchecGeneration(
      erreurRefusSecurite({
        message: PHRASE_BACKEND,
        flags: ["RF1_pain_recent_high"],
        disclaimer,
      })
    );

    expect(echec.messageJoueur).toContain(disclaimer);
    expect(echec.messageJoueur).not.toContain(PHRASE_SANTE);
  });

  test("sans drapeau : pas d'explication inventee, mais la voie de sortie reste (repli RF1, le moins engageant)", () => {
    const echec = lireEchecGeneration(erreurRefusSecurite({ message: PHRASE_BACKEND }));

    expect(echec.categorie).toBe("securite");
    expect(echec.messageJoueur).not.toContain(PHRASE_DOULEUR);
    expect(echec.messageJoueur).not.toContain(PHRASE_BLESSURE);
    expect(echec.messageJoueur).toContain(PHRASE_SORTIE);
    // Sans savoir QUEL drapeau a motivé le refus, le front ne peut pas
    // affirmer qu'une mise à jour dans Mon corps rouvrira la génération : il
    // retombe sur la formule la plus prudente, pas la plus engageante.
    expect(echec.messageJoueur).toContain(PHRASE_SORTIE_RF1);
    expect(echec.messageJoueur).not.toContain(PHRASE_SORTIE_RF2);
    expect(echec.actions).toEqual(["ouvrir_mon_corps", "retour_accueil"]);
  });

  test("drapeau inconnu du front : ignore, jamais affiche, jamais de plantage", () => {
    const echec = lireEchecGeneration(
      erreurRefusSecurite({ message: PHRASE_BACKEND, flags: ["RF9_futur_drapeau"] })
    );

    expect(echec.categorie).toBe("securite");
    expect(echec.messageJoueur).not.toContain("RF9");
    expect(echec.messageJoueur).toContain(PHRASE_SORTIE);
  });

  test("corps 422 abime (safety_no_session SANS message) : repli sur, jamais 'modifie tes reglages'", () => {
    const echec = lireEchecGeneration(
      erreurRefusSecurite({ message: undefined, flags: ["RF1_pain_recent_high"] })
    );

    expect(echec.categorie).toBe("securite");
    expect(echec.code).toBe("safety_no_session");
    expect(echec.messageJoueur).toContain("On ne te propose pas de séance aujourd'hui");
    expect(echec.messageJoueur).toContain(PHRASE_DOULEUR);
    verifierInterditsSecurite(echec.messageJoueur);
    expect(echec.actions).toEqual(["ouvrir_mon_corps", "retour_accueil"]);
    expect(echec.messageJoueur).not.toContain("Modifie ton lieu");
  });

  test("message vide : meme repli sur, aucune chaine vide affichee", () => {
    const echec = lireEchecGeneration(
      erreurRefusSecurite({ message: "   ", flags: ["RF2_severite_3"] })
    );
    expect(echec.categorie).toBe("securite");
    expect(echec.messageJoueur.trim().length).toBeGreaterThan(0);
    expect(echec.messageJoueur).toContain(PHRASE_BLESSURE);
  });

  test("retryable:true dans le corps ne rend PAS le refus retryable", () => {
    const corps = JSON.stringify({
      ok: false,
      code: "safety_no_session",
      error: "safety_no_session",
      retryable: true,
      message: PHRASE_BACKEND,
      safety_flags: ["RF1_pain_recent_high"],
    });
    const echec = lireEchecGeneration(new BackendError(422, "Unprocessable Entity", corps));

    expect(echec.retryable).toBe(false);
    expect(echec.actions).not.toContain("reessayer");
  });

  test("un Retry-After sur un refus de securite n'affiche aucun compte a rebours", () => {
    const echec = lireEchecGeneration(
      erreurRefusSecurite({ message: PHRASE_BACKEND, flags: ["RF1_pain_recent_high"] }, 30)
    );
    expect(echec.attendreS).toBeNull();
  });

  test("une seance rouvrable ne transforme pas le refus en 'Reprendre ma seance'", () => {
    const decision = decisionApresEchec({
      erreur: erreurRefusSecurite({ message: PHRASE_BACKEND, flags: ["RF1_pain_recent_high"] }),
      sessions: [vraieSeance()],
      todayKey: AUJOURDHUI,
    });

    expect(decision.echec.categorie).toBe("securite");
    expect(decision.actions).toEqual(["ouvrir_mon_corps", "retour_accueil"]);
    expect(decision.actions).not.toContain("reprendre_seance");
    expect(decision.seanceCreee).toBeNull();
  });

  test("REGRESSION : un vrai 500 sans contrat reste une panne 'indisponible'", () => {
    // Forme exacte du bug de prod (01/09) : tant que le backend répond ça, le
    // front n'a AUCUN moyen de savoir que c'est un refus — et il ne doit pas
    // deviner. Ce test verrouille la frontière : c'est le 422 typé, et lui
    // seul, qui déclenche le message de sécurité.
    const echec = lireEchecGeneration(
      new BackendError(500, "Internal Server Error", JSON.stringify({ ok: false, error: "invalid_version" }))
    );
    expect(echec.categorie).toBe("transitoire");
    expect(echec.messageJoueur).toContain("momentanément indisponible");
    expect(echec.messageJoueur).not.toContain(PHRASE_DOULEUR);
  });

  test("422 sportif ordinaire (sans safety_no_session) : comportement inchange", () => {
    const echec = lireEchecGeneration(
      erreurContrat(422, {
        code: "NO_VALID_PRESCRIPTION",
        category: "sportif",
        retryable: false,
        message: "Rien n'a été ajouté à ton programme.",
      })
    );
    expect(echec.categorie).toBe("sportif");
    expect(echec.actions[0]).toBe("modifier_contraintes");
    expect(echec.actions).toContain("reessayer");
  });
});

describe("lireEchecGeneration — missing_goal, enfin lu (le contrat porte code ET message)", () => {
  test("missing_goal : message backend affiche tel quel, 'Choisir un cycle' en tete", () => {
    const message = "Choisis d'abord un cycle : sans objectif, on ne prépare pas de séance.";
    const corps = JSON.stringify({
      ok: false,
      code: "missing_goal",
      error: "missing_goal",
      message,
    });
    const echec = lireEchecGeneration(new BackendError(422, "Unprocessable Entity", corps));

    expect(echec.source).toBe("contrat");
    expect(echec.code).toBe("missing_goal");
    expect(echec.messageJoueur).toBe(message);
    expect(echec.actions[0]).toBe("choisir_cycle");
    expect(echec.actions).toContain("retour_accueil");
  });

  test("missing_goal sans message : le corps ne fait pas foi, repli client (aucun texte vide)", () => {
    const corps = JSON.stringify({ ok: false, code: "missing_goal", error: "missing_goal" });
    const echec = lireEchecGeneration(new BackendError(400, "Bad Request", corps));

    expect(echec.source).toBe("client");
    expect(echec.messageJoueur.trim().length).toBeGreaterThan(0);
    expect(echec.messageJoueur).toContain("Aucune séance n'a été enregistrée");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. Réouverture : une VRAIE séance oui, une séance artificielle jamais
 * ═══════════════════════════════════════════════════════════════════════ */

describe("chercherRepriseSeance", () => {
  test("vraie seance deja prescrite et persistee : rouvrable", () => {
    const reprise = chercherRepriseSeance({
      sessions: [vraieSeance()],
      todayKey: AUJOURDHUI,
    });
    expect(reprise.reouvrable).toBe(true);
    expect(reprise.seance?.id).toBe("sess_reelle_1");
  });

  test("aucune seance persistee : rien a rouvrir", () => {
    const reprise = chercherRepriseSeance({ sessions: [], todayKey: AUJOURDHUI });
    expect(reprise.reouvrable).toBe(false);
    expect(reprise.seance).toBeNull();
    expect(reprise).toMatchObject({ motif: "aucune_seance" });
  });

  test("ancienne seance de secours (id fallback_*) : RECONNUE et REFUSEE", () => {
    const reprise = chercherRepriseSeance({
      sessions: [ancienneSeanceDeSecours()],
      todayKey: AUJOURDHUI,
    });
    expect(reprise.reouvrable).toBe(false);
    expect(reprise).toMatchObject({ motif: "seance_artificielle" });
  });

  test("garde-fou fallback_safe sans prefixe d'id : refusee aussi", () => {
    const camouflee = vraieSeance({ id: "sess_camouflee" }) as any;
    camouflee.aiV2 = { ...camouflee.aiV2, guardrailsApplied: ["fallback_safe"] };
    const reprise = chercherRepriseSeance({ sessions: [camouflee], todayKey: AUJOURDHUI });
    expect(reprise.reouvrable).toBe(false);
    expect(reprise).toMatchObject({ motif: "seance_artificielle" });
  });

  test("garde-fou pose a la racine de la seance persistee : refusee aussi", () => {
    const persistee = vraieSeance({ id: "sess_persistee" }) as any;
    persistee.guardrailsApplied = ["fallback_safe"];
    const reprise = chercherRepriseSeance({ sessions: [persistee], todayKey: AUJOURDHUI });
    expect(reprise.reouvrable).toBe(false);
  });

  test("seance d'un autre joueur : refusee", () => {
    const autre = vraieSeance() as any;
    autre.userId = "uid_autre_joueur";
    const reprise = chercherRepriseSeance({
      sessions: [autre],
      todayKey: AUJOURDHUI,
      uid: "uid_moi",
    });
    expect(reprise.reouvrable).toBe(false);
    expect(reprise).toMatchObject({ motif: "autre_joueur" });
  });

  test("snapshot vide (pas de prescription servie) : refuse", () => {
    const sansSnapshot = vraieSeance() as any;
    delete sansSnapshot.aiV2;
    const reprise = chercherRepriseSeance({ sessions: [sansSnapshot], todayKey: AUJOURDHUI });
    expect(reprise.reouvrable).toBe(false);
    expect(reprise).toMatchObject({ motif: "snapshot_invalide" });
  });

  test("seance remplacee ou invalidee : refusee", () => {
    const remplacee = vraieSeance() as any;
    remplacee.replacedBy = "sess_reelle_2";
    const reprise = chercherRepriseSeance({ sessions: [remplacee], todayKey: AUJOURDHUI });
    expect(reprise.reouvrable).toBe(false);
    expect(reprise).toMatchObject({ motif: "seance_remplacee" });
  });

  test("seance deja terminee : pas une reprise", () => {
    const reprise = chercherRepriseSeance({
      sessions: [vraieSeance({ completed: true })],
      todayKey: AUJOURDHUI,
    });
    expect(reprise.reouvrable).toBe(false);
  });

  test("seance hors fenetre (trop ancienne) : pas une reprise", () => {
    const reprise = chercherRepriseSeance({
      sessions: [vraieSeance({ date: "2026-06-01", dateISO: "2026-06-01" })],
      todayKey: AUJOURDHUI,
    });
    expect(reprise.reouvrable).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. Décision complète — l'invariant qui compte
 * ═══════════════════════════════════════════════════════════════════════ */

/** Termes qui trahiraient une séance générique fabriquée côté app. */
const TERMES_INTERDITS = ["Footing Z2", "Fallback FKS", "fallback_safe", "Séance de secours"];

const decisionSansSeanceInventee = (decision: unknown) => {
  const serialisee = JSON.stringify(decision);
  for (const terme of TERMES_INTERDITS) {
    expect(serialisee).not.toContain(terme);
  }
};

describe("decisionApresEchec — une panne ne fabrique jamais de seance", () => {
  const casAdverses: Array<[string, unknown]> = [
    ["reseau", erreurReseau()],
    ["timeout", erreurTimeout()],
    ["serveur", new BackendError(500, "Internal Server Error", "boom")],
    [
      "NO_VALID_PRESCRIPTION",
      erreurContrat(422, {
        code: "NO_VALID_PRESCRIPTION",
        category: "sportif",
        retryable: false,
        message: "Rien n'a été ajouté à ton programme.",
      }),
    ],
    [
      "SESSION_CONTRACT_FAILED",
      erreurContrat(422, {
        code: "SESSION_CONTRACT_FAILED",
        category: "sportif",
        retryable: false,
        message: "Rien n'a été ajouté à ton programme.",
      }),
    ],
    ["authentification", Object.assign(new Error("x"), { code: "AUTH_REQUIRED" })],
    ["inconnu", new Error("???")],
  ];

  test.each(casAdverses)("%s : aucune seance creee, aucun exercice propose", (_nom, erreur) => {
    const decision = decisionApresEchec({ erreur, sessions: [], todayKey: AUJOURDHUI });
    expect(decision.seanceCreee).toBeNull();
    expect(decision.reprise.reouvrable).toBe(false);
    expect(decision.actions).toContain("retour_accueil");
    decisionSansSeanceInventee(decision);
  });

  test("JOUEUR AVEC DOULEUR : aucun footing ni exercice generique n'est propose", () => {
    // Le backend refuse parce que douleur + matériel + durée ne laissent aucune
    // séance sûre. C'est exactement le cas où l'ancienne app poussait un footing
    // Z2 de 20 min sans rien savoir de la douleur déclarée.
    const decision = decisionApresEchec({
      erreur: erreurContrat(422, {
        code: "SESSION_CONSTRAINTS_UNRESOLVED",
        category: "sportif",
        retryable: false,
        message:
          "Avec tes contraintes du jour (matériel, douleurs, temps disponible), nous n'avons pas trouvé de séance à la fois utile et sûre. Rien n'a été ajouté à ton programme.",
        failedStep: "pools.token",
      }),
      sessions: [],
      todayKey: AUJOURDHUI,
    });

    expect(decision.seanceCreee).toBeNull();
    expect(decision.reprise.reouvrable).toBe(false);
    expect(decision.actions[0]).toBe("modifier_contraintes");
    decisionSansSeanceInventee(decision);
    expect(JSON.stringify(decision)).not.toContain("exercises");
  });

  test("JOUEUR FATIGUE : meme refus, aucune seance allegee inventee cote app", () => {
    const decision = decisionApresEchec({
      erreur: erreurContrat(422, {
        code: "NO_VALID_PRESCRIPTION",
        category: "sportif",
        retryable: false,
        message:
          "Nous n'avons pas réussi à construire une séance fiable pour ton objectif du jour. Rien n'a été ajouté à ton programme.",
      }),
      sessions: [],
      todayKey: AUJOURDHUI,
    });
    expect(decision.seanceCreee).toBeNull();
    decisionSansSeanceInventee(decision);
  });

  test("reprise hors ligne : une VRAIE seance deja persistee reste rouvrable", () => {
    const decision = decisionApresEchec({
      erreur: erreurReseau(),
      sessions: [vraieSeance()],
      todayKey: AUJOURDHUI,
    });
    expect(decision.seanceCreee).toBeNull();
    expect(decision.reprise.reouvrable).toBe(true);
    expect(decision.actions).toContain("reprendre_seance");
    // La reprise vient après l'action principale, jamais devant.
    expect(decision.actions.indexOf("reprendre_seance")).toBe(1);
  });

  test("hors ligne avec UNIQUEMENT une ancienne seance de secours : rien a rouvrir", () => {
    const decision = decisionApresEchec({
      erreur: erreurReseau(),
      sessions: [ancienneSeanceDeSecours()],
      todayKey: AUJOURDHUI,
    });
    expect(decision.reprise.reouvrable).toBe(false);
    expect(decision.actions).not.toContain("reprendre_seance");
  });

  test("aucune seance persistee du tout : pas de bouton de reprise", () => {
    const decision = decisionApresEchec({
      erreur: erreurTimeout(),
      sessions: [],
      todayKey: AUJOURDHUI,
    });
    expect(decision.actions).not.toContain("reprendre_seance");
  });

  test("NAVIGATION ARRIERE : la decision est pure, l'historique du joueur est intact", () => {
    const sessions = [vraieSeance()];
    const avant = JSON.stringify(sessions);

    const premiere = decisionApresEchec({ erreur: erreurReseau(), sessions, todayKey: AUJOURDHUI });
    const seconde = decisionApresEchec({ erreur: erreurReseau(), sessions, todayKey: AUJOURDHUI });

    // Rien n'a bougé dans les données du joueur entre les deux passages.
    expect(JSON.stringify(sessions)).toBe(avant);
    expect(sessions).toHaveLength(1);
    // Et l'échec ne s'est pas retransformé en succès au second passage.
    expect(premiere.seanceCreee).toBeNull();
    expect(seconde.seanceCreee).toBeNull();
    expect(seconde.echec.messageJoueur).toBe(premiere.echec.messageJoueur);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. Idempotence — le double-clic ne doit jamais payer deux fois
 * ═══════════════════════════════════════════════════════════════════════ */

describe("creerVerrouGeneration — anti double-clic", () => {
  test("DOUBLE CLIC SUR REESSAYER : la seconde tentative n'entre pas", () => {
    const verrou = creerVerrouGeneration();
    expect(verrou.prendre()).toBe(true);
    expect(verrou.prendre()).toBe(false);
    expect(verrou.prendre()).toBe(false);
    expect(verrou.estPris()).toBe(true);
  });

  test("une fois la requete retombee, le joueur peut relancer", () => {
    const verrou = creerVerrouGeneration();
    verrou.prendre();
    verrou.rendre();
    expect(verrou.estPris()).toBe(false);
    expect(verrou.prendre()).toBe(true);
  });

  test("dix appuis rapides = une seule requete", () => {
    const verrou = creerVerrouGeneration();
    const entrees = Array.from({ length: 10 }, () => verrou.prendre()).filter(Boolean);
    expect(entrees).toHaveLength(1);
  });

  test("budget de re-essai automatique de l'ecran : zero, sans exception", () => {
    // Le seul ré-essai automatique autorisé est déjà dépensé dans fetchV2
    // (réveil du serveur). Aucune relance silencieuse au-delà.
    expect(REESSAIS_AUTOMATIQUES_ECRAN).toBe(0);
  });
});
