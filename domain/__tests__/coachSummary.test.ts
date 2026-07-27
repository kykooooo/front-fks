// domain/__tests__/coachSummary.test.ts
// Parseur défensif + logique dashboard de la projection coach-safe.
import {
  parseCoachPlayerSummary,
  coachSessionStatusLabel,
  buildCoachRowStatus,
  sortCoachSummaries,
  summarizeCoachGroup,
  nextCoachDetailView,
  shouldApplyCoachDetailResponse,
  coachRosterDisplay,
  EMPTY_COACH_DETAIL_VIEW,
  type CoachDetailView,
  type CoachPlayerSummary,
} from "../coachSummary";

// Un DTO serveur complet et valide (aligné sur functions/src/dto.ts).
const validRaw = () => ({
  playerUid: "playerA1",
  firstName: "Anna",
  ageCategory: "U15",
  position: "Milieu",
  level: "Regional",
  profileComplete: true,
  latestSession: {
    dateKey: "2026-06-28",
    title: "Séance renfo / force",
    focusLabel: "Renfo / Force",
    intensityLabel: "Modérée",
    durationMin: 40,
    blockCount: 4,
    status: "done",
  },
  lastActivity: { dateKey: "2026-06-28", durationMin: 40 },
  adaptation: { adapted: true, labels: ["Contrôle appuis et alignement"] },
  // Enveloppe watermark — doit être IGNORÉE par le parseur.
  sourceEventAt: 1751133600000,
  sourceEventTime: "2026-06-28T18:00:00.000Z",
  sourceEventId: "seed-a1",
  updatedAt: "2026-06-28T18:00:00.000Z",
});

describe("parseCoachPlayerSummary — DTO valide", () => {
  test("parse tous les champs autorisés", () => {
    const s = parseCoachPlayerSummary(validRaw());
    expect(s).toEqual<CoachPlayerSummary>({
      playerUid: "playerA1",
      firstName: "Anna",
      ageCategory: "U15",
      position: "Milieu",
      level: "Regional",
      profileComplete: true,
      latestSession: {
        dateKey: "2026-06-28",
        title: "Séance renfo / force",
        focusLabel: "Renfo / Force",
        intensityLabel: "Modérée",
        durationMin: 40,
        blockCount: 4,
        status: "done",
      },
      lastActivity: { dateKey: "2026-06-28", durationMin: 40 },
      adaptation: { adapted: true, labels: ["Contrôle appuis et alignement"] },
      // Champs v2 absents du DTO serveur actuel → null (cas NOMINAL aujourd'hui).
      activity: null,
      lastPlanned: null,
      lastDone: null,
      execution: null,
    });
  });

  test("les watermarks ne sont jamais recopiés", () => {
    const s = parseCoachPlayerSummary(validRaw())!;
    const keys = Object.keys(s);
    expect(keys).not.toContain("sourceEventAt");
    expect(keys).not.toContain("sourceEventTime");
    expect(keys).not.toContain("sourceEventId");
    expect(keys).not.toContain("updatedAt");
  });
});

describe("parseCoachPlayerSummary — robustesse", () => {
  test("non-objet → null", () => {
    expect(parseCoachPlayerSummary(null)).toBeNull();
    expect(parseCoachPlayerSummary(undefined)).toBeNull();
    expect(parseCoachPlayerSummary("x")).toBeNull();
    expect(parseCoachPlayerSummary(42)).toBeNull();
    expect(parseCoachPlayerSummary([])).toBeNull();
  });

  test("playerUid absent/invalide → null (inutilisable)", () => {
    expect(parseCoachPlayerSummary({ firstName: "Anna" })).toBeNull();
    expect(parseCoachPlayerSummary({ playerUid: 123 })).toBeNull();
    expect(parseCoachPlayerSummary({ playerUid: "   " })).toBeNull();
  });

  test("champs absents → défauts sûrs", () => {
    const s = parseCoachPlayerSummary({ playerUid: "u1" })!;
    expect(s.firstName).toBeNull();
    expect(s.ageCategory).toBeNull();
    expect(s.position).toBeNull();
    expect(s.level).toBeNull();
    expect(s.profileComplete).toBe(false);
    expect(s.latestSession).toBeNull();
    expect(s.lastActivity).toBeNull();
    expect(s.adaptation).toEqual({ adapted: false, labels: [] });
    expect(s.activity).toBeNull();
    expect(s.lastPlanned).toBeNull();
    expect(s.lastDone).toBeNull();
    expect(s.execution).toBeNull();
  });

  test("types invalides → null / défaut", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      firstName: 42,
      ageCategory: "U99", // hors allowlist
      position: {},
      level: [],
      profileComplete: "yes", // pas booléen strict
      latestSession: "nope",
      lastActivity: 7,
      adaptation: "nope",
    })!;
    expect(s.firstName).toBeNull();
    expect(s.ageCategory).toBeNull();
    expect(s.position).toBeNull();
    expect(s.level).toBeNull();
    expect(s.profileComplete).toBe(false);
    expect(s.latestSession).toBeNull();
    expect(s.lastActivity).toBeNull();
    expect(s.adaptation).toEqual({ adapted: false, labels: [] });
  });

  test("status inconnu → 'unknown', dateKey invalide → null, hors-bornes → null", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      latestSession: {
        dateKey: "28/06/2026", // mauvais format
        title: "x",
        status: "en_cours", // hors allowlist
        durationMin: 99999, // hors 1..240 → null (aligné serveur)
        blockCount: -3, // hors 1..20 → null
      },
    })!;
    expect(s.latestSession!.status).toBe("unknown");
    expect(s.latestSession!.dateKey).toBeNull();
    expect(s.latestSession!.durationMin).toBeNull();
    expect(s.latestSession!.blockCount).toBeNull();
  });

  test("durationMin : arrondi entier, plage 1..240 (boundDurationMin serveur)", () => {
    const dur = (v: unknown) =>
      parseCoachPlayerSummary({ playerUid: "u1", latestSession: { durationMin: v } })!.latestSession!.durationMin;
    expect(dur(40.6)).toBe(41); // arrondi
    expect(dur(1)).toBe(1);
    expect(dur(240)).toBe(240);
    expect(dur(0.5)).toBeNull(); // < 1
    expect(dur(240.4)).toBeNull(); // > 240
    expect(dur(500)).toBeNull();
    expect(dur("40")).toBeNull(); // pas un nombre
  });

  test("blockCount : ENTIER strict, plage 1..20 (boundBlockCount serveur)", () => {
    const blk = (v: unknown) =>
      parseCoachPlayerSummary({ playerUid: "u1", latestSession: { blockCount: v } })!.latestSession!.blockCount;
    expect(blk(4)).toBe(4);
    expect(blk(20)).toBe(20);
    expect(blk(1)).toBe(1);
    expect(blk(4.5)).toBeNull(); // non entier (pas d'arrondi)
    expect(blk(0)).toBeNull();
    expect(blk(21)).toBeNull();
  });

  test("dateKey : vraie date calendaire (rejette 2026-02-30 / 2026-13-01)", () => {
    const dk = (v: unknown) =>
      parseCoachPlayerSummary({ playerUid: "u1", latestSession: { dateKey: v } })!.latestSession!.dateKey;
    expect(dk("2026-06-30")).toBe("2026-06-30");
    expect(dk("2026-02-28")).toBe("2026-02-28");
    expect(dk("2026-02-30")).toBeNull(); // février n'a pas 30 jours
    expect(dk("2026-13-01")).toBeNull(); // mois 13
    expect(dk("2026-06-31")).toBeNull(); // juin n'a pas 31 jours
    expect(dk("2026-00-10")).toBeNull(); // mois 0
  });

  test("labels bornés : non-chaînes filtrées, dédupliquées, plafonnées", () => {
    const many = Array.from({ length: 30 }, (_, i) => `label ${i}`);
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      adaptation: { adapted: true, labels: [123, null, "  ok  ", "ok", ...many] },
    })!;
    expect(s.adaptation.labels).toContain("ok");
    expect(s.adaptation.labels.filter((l) => l === "ok").length).toBe(1); // dédup
    expect(s.adaptation.labels.length).toBeLessThanOrEqual(12); // plafonné
    expect(s.adaptation.labels.every((l) => typeof l === "string")).toBe(true);
  });

  test("adapted = booléen serveur ET au moins un label valide", () => {
    const adapt = (v: unknown) => parseCoachPlayerSummary({ playerUid: "u1", adaptation: v })!.adaptation;
    // adapted=true sans label → false (aligné serveur : adapted = labels.length > 0)
    expect(adapt({ adapted: true, labels: [] })).toEqual({ adapted: false, labels: [] });
    expect(adapt({ adapted: true, labels: "nope" })).toEqual({ adapted: false, labels: [] });
    expect(adapt({ adapted: true, labels: [123, null] })).toEqual({ adapted: false, labels: [] });
    // adapted=true AVEC label → true
    expect(adapt({ adapted: true, labels: ["x"] })).toEqual({ adapted: true, labels: ["x"] });
    // adapted=false même avec label → false
    expect(adapt({ adapted: false, labels: ["x"] })).toEqual({ adapted: false, labels: ["x"] });
  });

  test("aucune clé sensible additionnelle ne fuit (pain/rpe/tsb/comment/aiV2/metrics)", () => {
    const s = parseCoachPlayerSummary({
      ...validRaw(),
      pain: 3,
      rpe: 8,
      tsb: -14.2,
      atl: 55,
      ctl: 41,
      comment: "mal au genou",
      aiV2: { blocks: [] },
      feedback: { rpe: 8 },
      metrics: { tsb: -14 },
    })!;
    const serialized = JSON.stringify(s);
    for (const forbidden of ["pain", "rpe", "tsb", "atl", "ctl", "comment", "aiV2", "feedback", "metrics"]) {
      expect(Object.keys(s)).not.toContain(forbidden);
    }
    expect(serialized).not.toContain("mal au genou");
    expect(serialized).not.toContain("-14");
  });

  test("lastActivity sans donnée exploitable → null", () => {
    const s = parseCoachPlayerSummary({ playerUid: "u1", lastActivity: { dateKey: "bad", durationMin: "x" } })!;
    expect(s.lastActivity).toBeNull();
  });
});

describe("coachSessionStatusLabel", () => {
  test("mappe le statut", () => {
    expect(coachSessionStatusLabel("planned")).toBe("Prête");
    expect(coachSessionStatusLabel("done")).toBe("Faite");
    expect(coachSessionStatusLabel("unknown")).toBe("Inconnue");
  });
});

// ─── Helper de construction de summary pour les tests dashboard ──
const mk = (over: Partial<CoachPlayerSummary> & { playerUid: string }): CoachPlayerSummary => ({
  playerUid: over.playerUid,
  firstName: over.firstName ?? null,
  ageCategory: over.ageCategory ?? null,
  position: over.position ?? null,
  level: over.level ?? null,
  profileComplete: over.profileComplete ?? false,
  latestSession: over.latestSession ?? null,
  lastActivity: over.lastActivity ?? null,
  adaptation: over.adaptation ?? { adapted: false, labels: [] },
  // Champs v2 : absents par défaut, comme dans la projection serveur actuelle.
  activity: over.activity ?? null,
  lastPlanned: over.lastPlanned ?? null,
  lastDone: over.lastDone ?? null,
  execution: over.execution ?? null,
});

const session = (status: "planned" | "done", dateKey: string) => ({
  dateKey,
  title: "S",
  focusLabel: "Renfo / Force",
  intensityLabel: "Modérée",
  durationMin: 40,
  blockCount: 4,
  status,
});

describe("buildCoachRowStatus — dashboard", () => {
  const TODAY = "2026-06-10";

  test("planifiée future → Prête", () => {
    const r = buildCoachRowStatus(mk({ playerUid: "u", latestSession: session("planned", "2026-06-12") }), TODAY);
    expect(r.sessionStatusLabel).toBe("Prête");
    expect(r.tone).toBe("default");
  });

  test("faite aujourd'hui → Faite / Aujourd'hui", () => {
    const r = buildCoachRowStatus(
      mk({ playerUid: "u", latestSession: session("done", "2026-06-10"), lastActivity: { dateKey: "2026-06-10", durationMin: 40 } }),
      TODAY,
    );
    expect(r.sessionStatusLabel).toBe("Faite");
    expect(r.activityLabel).toBe("Aujourd'hui");
    expect(r.tone).toBe("ok");
  });

  test("rien fait depuis 8j + pas de planifiée → À relancer", () => {
    const r = buildCoachRowStatus(
      mk({ playerUid: "u", latestSession: session("done", "2026-06-02"), lastActivity: { dateKey: "2026-06-02", durationMin: 40 } }),
      TODAY,
    );
    expect(r.sessionStatusLabel).toBe("À relancer");
    expect(r.activityLabel).toBe("Il y a 8 jours");
    expect(r.tone).toBe("warn");
  });

  test("summary sans séance → Sans séance / Jamais / adaptationLabel vide", () => {
    const r = buildCoachRowStatus(mk({ playerUid: "u" }), TODAY);
    expect(r.sessionStatusLabel).toBe("Sans séance");
    expect(r.activityLabel).toBe("Jamais");
    expect(r.adaptationLabel).toBe("");
  });

  test("adaptation serveur → Adaptée ; sinon Standard", () => {
    const adapted = buildCoachRowStatus(
      mk({ playerUid: "u", latestSession: session("planned", "2026-06-12"), adaptation: { adapted: true, labels: ["x"] } }),
      TODAY,
    );
    expect(adapted.adaptationLabel).toBe("Adaptée");
    const std = buildCoachRowStatus(
      mk({ playerUid: "u", latestSession: session("planned", "2026-06-12"), adaptation: { adapted: false, labels: [] } }),
      TODAY,
    );
    expect(std.adaptationLabel).toBe("Standard");
  });

  test("planifiée passée non faite → À relancer (pas Prête)", () => {
    const r = buildCoachRowStatus(mk({ playerUid: "u", latestSession: session("planned", "2026-06-01") }), TODAY);
    expect(r.sessionStatusLabel).toBe("À relancer");
  });
});

describe("sortCoachSummaries — priorité actionnable", () => {
  const TODAY = "2026-06-10";
  const relance = mk({ playerUid: "relance", firstName: "Zoe", latestSession: session("done", "2026-06-01"), lastActivity: { dateKey: "2026-06-01", durationMin: 40 } });
  const noSession = mk({ playerUid: "nodata", firstName: "Zoe" });
  const prevue = mk({ playerUid: "prevue", firstName: "Zoe", latestSession: session("planned", "2026-06-12") });
  const adaptee = mk({ playerUid: "adaptee", firstName: "Zoe", latestSession: session("done", "2026-06-09"), lastActivity: { dateKey: "2026-06-09", durationMin: 40 }, adaptation: { adapted: true, labels: ["x"] } });
  const faite = mk({ playerUid: "faite", firstName: "Zoe", latestSession: session("done", "2026-06-09"), lastActivity: { dateKey: "2026-06-09", durationMin: 40 } });

  const order = (arr: CoachPlayerSummary[]) => sortCoachSummaries(arr, TODAY).map((r) => r.summary.playerUid);

  test("ordre complet haute → basse priorité", () => {
    expect(order([faite, relance, noSession, prevue, adaptee])).toEqual([
      "relance",
      "nodata",
      "prevue",
      "adaptee",
      "faite",
    ]);
  });

  test("égalité → prénom alphabétique (fr)", () => {
    const a = mk({ playerUid: "u1", firstName: "Yanis", latestSession: session("done", "2026-06-01"), lastActivity: { dateKey: "2026-06-01", durationMin: 40 } });
    const b = mk({ playerUid: "u2", firstName: "Adam", latestSession: session("done", "2026-06-01"), lastActivity: { dateKey: "2026-06-01", durationMin: 40 } });
    expect(order([a, b])).toEqual(["u2", "u1"]);
  });

  test("égalité, prénom absent → playerUid stable", () => {
    const a = mk({ playerUid: "zzz", latestSession: session("done", "2026-06-01"), lastActivity: { dateKey: "2026-06-01", durationMin: 40 } });
    const b = mk({ playerUid: "aaa", latestSession: session("done", "2026-06-01"), lastActivity: { dateKey: "2026-06-01", durationMin: 40 } });
    expect(order([a, b])).toEqual(["aaa", "zzz"]);
  });
});

describe("summarizeCoachGroup — compteurs", () => {
  const TODAY = "2026-06-10";
  const prevue = mk({ playerUid: "p", firstName: "A", latestSession: session("planned", "2026-06-12") });
  const faite = mk({ playerUid: "f", firstName: "B", latestSession: session("done", "2026-06-09"), lastActivity: { dateKey: "2026-06-09", durationMin: 40 } });
  const adaptee = mk({ playerUid: "a", firstName: "C", latestSession: session("done", "2026-06-09"), lastActivity: { dateKey: "2026-06-09", durationMin: 40 }, adaptation: { adapted: true, labels: ["x"] } });
  const relance = mk({ playerUid: "r", firstName: "D", latestSession: session("done", "2026-06-01"), lastActivity: { dateKey: "2026-06-01", durationMin: 40 } });
  const noSession = mk({ playerUid: "n", firstName: "E" });

  test("compte prête / faite / à relancer / adaptée / sans séance", () => {
    const res = summarizeCoachGroup(sortCoachSummaries([prevue, faite, adaptee, relance, noSession], TODAY));
    expect(res).toEqual({ total: 5, planned: 1, done: 2, toRelance: 1, adapted: 1, noSession: 1 });
  });

  test("liste vide → tout à zéro", () => {
    expect(summarizeCoachGroup([])).toEqual({ total: 0, planned: 0, done: 0, toRelance: 0, adapted: 0, noSession: 0 });
  });
});

describe("nextCoachDetailView — refresh défensif fiche joueuse", () => {
  const summary = mk({ playerUid: "u1", firstName: "Anna" });
  const withSummary: CoachDetailView = { summary, unavailable: false };
  const unavailableRes: CoachDetailView = { summary: null, unavailable: true };
  const absentRes: CoachDetailView = { summary: null, unavailable: false };

  test("premier chargement en échec → applique 'indisponible' (pas de toast)", () => {
    const r = nextCoachDetailView(EMPTY_COACH_DETAIL_VIEW, unavailableRes, {
      isRefresh: false,
      prevMatchesRoute: false,
    });
    expect(r.view).toEqual({ summary: null, unavailable: true });
    expect(r.keptStale).toBe(false);
  });

  test("premier chargement OK → applique le summary", () => {
    const r = nextCoachDetailView(EMPTY_COACH_DETAIL_VIEW, withSummary, {
      isRefresh: false,
      prevMatchesRoute: false,
    });
    expect(r.view.summary).toBe(summary);
    expect(r.keptStale).toBe(false);
  });

  test("refresh OK → remplace par le nouveau summary", () => {
    const next = mk({ playerUid: "u1", firstName: "Anna v2" });
    const r = nextCoachDetailView(
      withSummary,
      { summary: next, unavailable: false },
      { isRefresh: true, prevMatchesRoute: true },
    );
    expect(r.view.summary).toBe(next);
    expect(r.keptStale).toBe(false);
  });

  test("refresh en échec + summary aligné route → GARDE l'ancien contenu + keptStale", () => {
    const r = nextCoachDetailView(withSummary, unavailableRes, { isRefresh: true, prevMatchesRoute: true });
    expect(r.view).toBe(withSummary); // conserve exactement l'ancienne vue
    expect(r.view.summary).toBe(summary);
    expect(r.view.unavailable).toBe(false); // pas de bascule en 'indisponible'
    expect(r.keptStale).toBe(true); // → l'écran affiche un toast non bloquant
  });

  test("refresh en échec mais route CHANGÉE → applique 'indisponible' (jamais garder un autre joueur)", () => {
    const r = nextCoachDetailView(withSummary, unavailableRes, { isRefresh: true, prevMatchesRoute: false });
    expect(r.view).toEqual({ summary: null, unavailable: true });
    expect(r.keptStale).toBe(false);
  });

  test("refresh en échec sans contenu préalable → applique 'indisponible' (pas de toast)", () => {
    const r = nextCoachDetailView(EMPTY_COACH_DETAIL_VIEW, unavailableRes, {
      isRefresh: true,
      prevMatchesRoute: true,
    });
    expect(r.view).toEqual({ summary: null, unavailable: true });
    expect(r.keptStale).toBe(false);
  });

  test("refresh renvoyant un doc absent (succès, summary null) → reflète l'absence, pas de conservation", () => {
    const r = nextCoachDetailView(withSummary, absentRes, { isRefresh: true, prevMatchesRoute: true });
    expect(r.view).toEqual({ summary: null, unavailable: false });
    expect(r.keptStale).toBe(false);
  });
});

describe("shouldApplyCoachDetailResponse — garde anti réponse tardive/concurrente", () => {
  const base = {
    mounted: true,
    requestId: 5,
    latestRequestId: 5,
    requestKey: "clubX/playerA",
    currentKey: "clubX/playerA" as string | null,
  };

  test("dernier requestId + monté + route inchangée → accepté", () => {
    expect(shouldApplyCoachDetailResponse(base)).toBe(true);
  });

  test("requestId dépassé (une requête plus récente a été émise) → rejeté", () => {
    // Deux requêtes concurrentes sur la MÊME route : l'ancienne (5) revient après
    // qu'une plus récente (6) a été lancée → on l'ignore.
    expect(shouldApplyCoachDetailResponse({ ...base, requestId: 5, latestRequestId: 6 })).toBe(false);
  });

  test("composant démonté → rejeté", () => {
    expect(shouldApplyCoachDetailResponse({ ...base, mounted: false })).toBe(false);
  });

  test("route changée pendant le fetch (currentKey ≠ requestKey) → rejeté", () => {
    expect(shouldApplyCoachDetailResponse({ ...base, currentKey: "clubX/playerB" })).toBe(false);
  });

  test("plus aucune route courante (currentKey null) → rejeté", () => {
    expect(shouldApplyCoachDetailResponse({ ...base, currentKey: null })).toBe(false);
  });
});

describe("coachRosterDisplay — jamais 'Aucun membre' si des projections sont en cours", () => {
  test("indisponible → 'unavailable' (prioritaire, même avec des compteurs)", () => {
    expect(coachRosterDisplay({ readyCount: 3, pendingCount: 2, unavailable: true })).toBe("unavailable");
    expect(coachRosterDisplay({ readyCount: 0, pendingCount: 0, unavailable: true })).toBe("unavailable");
  });

  test("aucune projection prête ni en cours → 'empty' (vrai 'Aucun membre')", () => {
    expect(coachRosterDisplay({ readyCount: 0, pendingCount: 0, unavailable: false })).toBe("empty");
  });

  test("roster VIDE mais pending > 0 → 'list' (JAMAIS 'empty'/'Aucun membre')", () => {
    expect(coachRosterDisplay({ readyCount: 0, pendingCount: 2, unavailable: false })).toBe("list");
  });

  test("au moins une projection prête → 'list'", () => {
    expect(coachRosterDisplay({ readyCount: 3, pendingCount: 0, unavailable: false })).toBe("list");
    expect(coachRosterDisplay({ readyCount: 3, pendingCount: 2, unavailable: false })).toBe("list");
  });
});

// ─── Contrat v2 : faits datés de la boucle de suivi joueur ───────────────────
// Rappel : ces champs sont ABSENTS du DTO serveur AUJOURD'HUI. Le parseur doit
// donc traiter leur absence comme un état NORMAL, et leur présence future sans
// modification de code côté écrans.
describe("parseCoachPlayerSummary — activity (fenêtre d'activité)", () => {
  test("dates dédupliquées, triées du plus récent au plus ancien, bornées à 14", () => {
    const brut = Array.from({ length: 20 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      activity: { doneDateKeys: [...brut, "2026-07-05"] },
    })!;
    expect(s.activity!.doneDateKeys).toHaveLength(14);
    expect(s.activity!.doneDateKeys[0]).toBe("2026-07-20");
    expect(s.activity!.doneDateKeys[13]).toBe("2026-07-07");
  });

  test("dates invalides ignorées, jamais remplacées", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      activity: { doneDateKeys: ["2026-02-30", 42, null, "2026-07-04"] },
    })!;
    expect(s.activity!.doneDateKeys).toEqual(["2026-07-04"]);
  });

  test("activity absente ou malformée → null (pas de fenêtre vide inventée)", () => {
    expect(parseCoachPlayerSummary({ playerUid: "u1" })!.activity).toBeNull();
    expect(parseCoachPlayerSummary({ playerUid: "u1", activity: "nope" })!.activity).toBeNull();
    expect(
      parseCoachPlayerSummary({ playerUid: "u1", activity: { doneDateKeys: "nope" } })!.activity,
    ).toBeNull();
  });

  test("tableau présent mais vide → fenêtre vide (le serveur affirme : rien de fait)", () => {
    const s = parseCoachPlayerSummary({ playerUid: "u1", activity: { doneDateKeys: [] } })!;
    expect(s.activity).toEqual({ doneDateKeys: [] });
  });
});

describe("parseCoachPlayerSummary — lastPlanned / lastDone", () => {
  test("les deux slots coexistent, mêmes bornes que latestSession", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      lastPlanned: {
        dateKey: "2026-07-27",
        title: "Force bas du corps",
        focusLabel: "Renfo / Force",
        intensityLabel: "Élevée",
        durationMin: 45.4,
        blockCount: 5,
      },
      lastDone: {
        dateKey: "2026-07-25",
        title: "Explosivité",
        focusLabel: "Vitesse",
        intensityLabel: "Modérée",
        durationMin: 35,
        blockCount: 4,
      },
    })!;
    expect(s.lastPlanned).toEqual({
      dateKey: "2026-07-27",
      title: "Force bas du corps",
      focusLabel: "Renfo / Force",
      intensityLabel: "Élevée",
      durationMin: 45, // arrondi, comme boundDurationMin serveur
      blockCount: 5,
    });
    expect(s.lastDone!.dateKey).toBe("2026-07-25");
  });

  test("aucun champ `status` n'est introduit (le slot dit déjà prévue/faite)", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      lastDone: { dateKey: "2026-07-25", status: "done" },
    })!;
    expect(Object.keys(s.lastDone!)).not.toContain("status");
  });

  test("valeurs hors bornes → null, jamais une valeur voisine", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      lastPlanned: { dateKey: "2026-13-01", durationMin: 9999, blockCount: 0 },
    })!;
    expect(s.lastPlanned).toEqual({
      dateKey: null,
      title: null,
      focusLabel: null,
      intensityLabel: null,
      durationMin: null,
      blockCount: null,
    });
  });
});

describe("parseCoachPlayerSummary — execution", () => {
  test("bloc complet parsé et borné", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      execution: {
        completionPct: 72.6,
        completionStatus: "partial",
        itemsDone: 8,
        itemsAdapted: 2,
        itemsSkipped: 1,
        itemsReplaced: 0,
        deviationLabels: ["Manque de temps", "Autre raison", "Manque de temps"],
      },
    })!;
    expect(s.execution).toEqual({
      completionPct: 73,
      completionStatus: "partial",
      itemsDone: 8,
      itemsAdapted: 2,
      itemsSkipped: 1,
      itemsReplaced: 0,
      // Détail du calcul non transmis par cette projection → null, jamais 0 :
      // une absence de nuance n'est pas une preuve d'absence de remplacement.
      itemsReplacedEquivalent: null,
      itemsReplacedPartial: null,
      itemsTotal: null,
      deviationLabels: ["Manque de temps", "Autre raison"], // dédupliqués
    });
  });

  test("statut hors allowlist → null (jamais deviné)", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      execution: { completionStatus: "en_cours" },
    })!;
    expect(s.execution!.completionStatus).toBeNull();
  });

  test("compteurs : entiers 0..100, sinon null", () => {
    const items = (v: unknown) =>
      parseCoachPlayerSummary({ playerUid: "u1", execution: { itemsSkipped: v } })!.execution!
        .itemsSkipped;
    expect(items(0)).toBe(0);
    expect(items(12)).toBe(12);
    expect(items(2.5)).toBeNull();
    expect(items(-1)).toBeNull();
    expect(items(1000)).toBeNull();
    expect(items("2")).toBeNull();
  });

  test("pourcentage : 0..100 arrondi, sinon null", () => {
    const pct = (v: unknown) =>
      parseCoachPlayerSummary({ playerUid: "u1", execution: { completionPct: v } })!.execution!
        .completionPct;
    expect(pct(0)).toBe(0);
    expect(pct(100)).toBe(100);
    expect(pct(101)).toBeNull();
    expect(pct(-5)).toBeNull();
    expect(pct(Number.NaN)).toBeNull();
  });

  test("libellés d'écart : bornés à 12, tronqués, jamais ré-interprétés", () => {
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      execution: {
        deviationLabels: [
          ...Array.from({ length: 15 }, (_, i) => `Raison ${i}`),
          "x".repeat(400),
        ],
      },
    })!;
    expect(s.execution!.deviationLabels).toHaveLength(12);
    expect(s.execution!.deviationLabels.every((l) => l.length <= 160)).toBe(true);
  });

  test("le front ne tente JAMAIS de deviner ce que cache « Autre raison »", () => {
    // La non-inversibilité est garantie côté serveur ; ici on vérifie qu'aucune
    // ré-écriture ne la casse : le libellé ressort à l'identique.
    const s = parseCoachPlayerSummary({
      playerUid: "u1",
      execution: { deviationLabels: ["Autre raison"] },
    })!;
    expect(s.execution!.deviationLabels).toEqual(["Autre raison"]);
  });

  test("execution absente ou malformée → null", () => {
    expect(parseCoachPlayerSummary({ playerUid: "u1" })!.execution).toBeNull();
    expect(parseCoachPlayerSummary({ playerUid: "u1", execution: 7 })!.execution).toBeNull();
  });
});
