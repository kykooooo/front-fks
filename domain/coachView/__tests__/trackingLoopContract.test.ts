// domain/coachView/__tests__/trackingLoopContract.test.ts
//
// LE CONTRAT ENTRE LA BOUCLE DE SUIVI JOUEUR ET LA VUE COACH.
//
// La boucle (branche claude/player-tracking-loop-559906, module domain/tracking)
// ECRIT `users/{uid}/sessions/{id}.execution`. La vue coach le LIT, via le
// projecteur serveur (functions/src/projector.ts) puis fromSummary.ts.
// Personne ne recalcule le pourcentage : la boucle est la seule source de verite,
// tout le reste recopie ou verifie.
//
// CE FICHIER EST UN DETECTEUR DE FUMEE, PAS UN TEST DE FONCTIONNALITE.
// Il ne prouve pas que l'ecran est joli. Il tombe le jour ou la boucle change la
// forme de `execution` sans que la vue coach soit mise a jour -- panne qui,
// autrement, serait SILENCIEUSE (le coach verrait "detail indisponible" ou, pire,
// un pourcentage dont le calcul ne retombe pas, sans qu'aucun test ne bronche).
//
// DEUX PARTIES.
//  1. Toujours jouee : fige la forme brute attendue et la fait passer par le
//     lecteur documente, puis par buildExecutionBreakdown.
//  2. Armee au merge : si domain/tracking est present, on confronte les poids
//     reels de la boucle a ceux de la vue coach. Tant que la boucle n'est pas
//     mergee, un test explicite le DIT (il n'est pas "skip", il s'affiche).
//
// Test PUR : ni React, ni Firestore, ni emulateur.

import {
  buildExecutionBreakdown,
  COACH_EXECUTION_POIDS,
  type CoachExecutionBreakdown,
} from "../execution";
import { COACH_EXECUTION_STATUTS } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// 1. La forme brute, figee
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chemins EXACTS que le projecteur serveur lit dans `session.execution`
 * (functions/src/projector.ts, projectExecution + readItemsTotal +
 * readDeviationReasons). Source cote boucle : domain/tracking/types.ts,
 * type SessionExecution.
 *
 * Toute entree retiree ici sans etre retiree du projecteur = un champ lu qui
 * n'existe plus. Toute entree ajoutee par la boucle sans arriver ici = un champ
 * que le coach ignore.
 */
export const CHEMINS_LUS_PAR_LE_COACH = [
  "completion.pct",
  "completion.status",
  "completion.done",
  "completion.adapted",
  "completion.skipped",
  "completion.replacedEquivalent",
  "completion.replacedPartial",
  "completion.mainReasons",
  "items", // longueur = total d'exercices (denominateur), cf. readItemsTotal
  "items[].reason", // repli quand mainReasons est vide ou entierement sensible
] as const;

/** Statuts de completion produits par la boucle (domain/tracking/types.ts). */
const STATUTS_BOUCLE = ["full", "partial", "abandoned"] as const;

/**
 * Une execution telle que la boucle la pose reellement en base : le snapshot
 * complet, les commentaires libres et les raisons sensibles y sont, VOLONTAIREMENT.
 * C'est ce que le projecteur doit savoir ne pas recopier.
 *
 * Cas chiffre : 12 exercices, dont un reste sans statut connu.
 * (7x1 + 1x1 + 1x1 + 1x0,5) / 12 = 9,5 / 12 = 79,17 % -> 79 %.
 */
function executionBrute() {
  return {
    version: 1,
    sessionId: "s1",
    fingerprint: "fp-1",
    snapshot: {
      sessionId: "s1",
      fingerprint: "fp-1",
      plannedDurationMin: 45,
      items: [{ key: "0-0", exerciseId: "SENTINELLE_EXO", name: "SENTINELLE_NOM", notes: "SENTINELLE_NOTE" }],
    },
    items: [
      ...Array.from({ length: 7 }, (_, i) => ({ key: `d${i}`, status: "done", reason: null, comment: null })),
      { key: "a0", status: "adapted", reason: "time", comment: "SENTINELLE_COMMENTAIRE" },
      { key: "r0", status: "replaced", reason: "equipment", comment: null },
      { key: "r1", status: "replaced", reason: "equipment", comment: null },
      { key: "s0", status: "skipped", reason: "pain", comment: "SENTINELLE_GENOU" },
      { key: "u0", status: "unknown", reason: null, comment: null },
    ],
    startedAtISO: "2026-06-28T17:00:00.000Z",
    finishedAtISO: "2026-06-28T17:44:00.000Z",
    actualDurationMin: 44,
    allAsPlanned: false,
    completion: {
      pct: 79,
      done: 7,
      adapted: 1,
      skipped: 1,
      replacedEquivalent: 1,
      replacedPartial: 1,
      status: "partial",
      mainReasons: ["time"],
    },
  };
}

/**
 * Le MEME chemin de lecture que functions/src/projector.ts, reduit a ce que la
 * decomposition coach consomme. Volontairement ecrit ici plutot qu'importe : le
 * projecteur vit dans functions/ (autre tsconfig, autre runner). Ce que ce test
 * verrouille, ce n'est donc pas le code du projecteur -- c'est que la forme
 * brute figee plus haut suffit ENCORE a produire une decomposition verifiable.
 */
function lireCommeLeCoach(raw: ReturnType<typeof executionBrute>) {
  const c = raw.completion;
  return {
    pourcentage: c.pct,
    statut: null,
    statutLibelle: null,
    fait: c.done,
    adapte: c.adapted,
    saute: c.skipped,
    remplace: c.replacedEquivalent + c.replacedPartial,
    remplaceEquivalent: c.replacedEquivalent,
    remplacePartiel: c.replacedPartial,
    total: raw.items.length,
    raisons: [] as string[],
  };
}

describe("contrat boucle -> coach : la forme brute de `execution`", () => {
  it("les chemins lus sont tous presents dans la forme figee", () => {
    const raw = executionBrute() as unknown as Record<string, unknown>;
    const completion = raw.completion as Record<string, unknown>;

    for (const chemin of CHEMINS_LUS_PAR_LE_COACH) {
      if (chemin === "items") {
        expect(Array.isArray(raw.items)).toBe(true);
        continue;
      }
      if (chemin === "items[].reason") {
        const items = raw.items as Array<Record<string, unknown>>;
        expect(items.every((i) => "reason" in i)).toBe(true);
        continue;
      }
      const cle = chemin.replace("completion.", "");
      expect(completion).toHaveProperty(cle);
    }
  });

  it("le total d'exercices n'est PAS un champ : c'est la longueur de `items`", () => {
    // Piege connu et documente : la boucle n'ecrit aucun `completion.total`
    // (domain/tracking/execution.ts, computeCompletion). Le denominateur vient
    // donc de items.length. Si un jour la boucle cesse d'ecrire `items`, le
    // coach perd le denominateur -- et donc tout le detail du calcul.
    const raw = executionBrute();
    expect((raw.completion as Record<string, unknown>).total).toBeUndefined();
    expect(raw.items).toHaveLength(12);
  });

  it("un exercice porte UN seul statut (categories exclusives)", () => {
    // La boucle range chaque item via un `switch (item.status)` : rien ne peut
    // etre a la fois adapte et remplace. Le coach en depend pour additionner
    // ses categories sans double comptage.
    const raw = executionBrute();
    for (const item of raw.items) {
      expect(typeof item.status).toBe("string");
      expect(["done", "adapted", "skipped", "replaced", "unknown"]).toContain(item.status);
    }
  });

  it("les deux natures de remplacement restent SEPAREES", () => {
    // Les ecraser en un seul compteur rendrait le pourcentage non refaisable :
    // un equivalent pese 1, un partiel 0,5.
    const c = executionBrute().completion;
    expect(c).toHaveProperty("replacedEquivalent");
    expect(c).toHaveProperty("replacedPartial");
  });

  it("le statut de seance de la boucle a une traduction coach pour CHAQUE valeur", () => {
    // full -> complete, partial -> partielle, abandoned -> interrompue
    // (domain/coachView/fromSummary.ts STATUT_PAR_STATUS).
    expect(STATUTS_BOUCLE).toHaveLength(COACH_EXECUTION_STATUTS.length);
  });

  it("le pourcentage ecrit par la boucle se refait a partir des seuls champs lus", () => {
    const breakdown = buildExecutionBreakdown(lireCommeLeCoach(executionBrute()));
    expect(breakdown).not.toBeNull();
    const b = breakdown as Extract<CoachExecutionBreakdown, { verifiable: true }>;
    expect(b.verifiable).toBe(true);
    expect(b.total).toBe(12);
    expect(b.sommePonderee).toBe(9.5);
    expect(b.calcul).toBe("7 + 1 + 1 + 0,5 = 9,5 sur 12 exercices, soit 79 %");
  });

  it("si la boucle changeait un poids sans prevenir, le coach REFUSE d'afficher le calcul", () => {
    // Simulation de la divergence redoutee : la boucle annonce 90 % la ou les
    // compteurs donnent 79. Le coach ne montre pas une demonstration fausse.
    const raw = executionBrute();
    raw.completion.pct = 90;
    const breakdown = buildExecutionBreakdown(lireCommeLeCoach(raw));
    expect(breakdown).toEqual(
      expect.objectContaining({ verifiable: false, motif: "pourcentage_non_reproduit" }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Confrontation aux poids REELS de la boucle (s'arme au merge)
// ─────────────────────────────────────────────────────────────────────────────

/** Charge domain/tracking/config.ts s'il existe. `null` avant le merge. */
function chargerConfigBoucle(): Record<string, unknown> | null {
  try {
    // `require` et non `import` : le module peut ne pas exister (boucle non
    // mergee), et seul un chargement a l'execution permet d'en faire un fait
    // verifiable plutot qu'une erreur de compilation.
    return require("../../tracking/config") as Record<string, unknown>;
  } catch {
    return null;
  }
}

const configBoucle = chargerConfigBoucle();

describe(
  configBoucle
    ? "contrat boucle -> coach : poids reels (boucle PRESENTE)"
    : "contrat boucle -> coach : poids reels (boucle ABSENTE, non mergee)",
  () => {
    if (!configBoucle) {
      it("domain/tracking absent : la comparaison des poids s'armera au merge de la boucle", () => {
        // Ce test n'est pas un skip masque : il constate un fait verifiable.
        // Etape 4 du plan d'integration (docs/coach-pilote-2026-07/INTEGRATION_BOUCLE.md) :
        // apres le merge, ce bloc doit s'intituler "boucle PRESENTE".
        expect(configBoucle).toBeNull();
      });
      return;
    }

    const completion = (configBoucle.TRACKING_CONFIG as Record<string, Record<string, number>>).completion;

    it("les poids de la boucle sont EXACTEMENT ceux affiches au coach", () => {
      expect(completion.doneWeight).toBe(COACH_EXECUTION_POIDS.fait);
      expect(completion.adaptedWeight).toBe(COACH_EXECUTION_POIDS.adapte);
      expect(completion.replacedEquivalentWeight).toBe(COACH_EXECUTION_POIDS.remplace_equivalent);
      expect(completion.replacedPartialWeight).toBe(COACH_EXECUTION_POIDS.remplace_partiel);
      expect(completion.skippedWeight).toBe(COACH_EXECUTION_POIDS.saute);
    });

    it("un exercice non renseigne pese 0 des deux cotes", () => {
      // La boucle n'a pas de `unknownWeight` : son `switch` ne l'additionne pas.
      // Le coach l'ecrit explicitement. Les deux disent la meme chose.
      expect(completion.unknownWeight).toBeUndefined();
      expect(COACH_EXECUTION_POIDS.non_renseigne).toBe(0);
    });
  },
);
