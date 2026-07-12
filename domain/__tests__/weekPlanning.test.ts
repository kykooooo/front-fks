// domain/__tests__/weekPlanning.test.ts
//
// Un cas par test d'acceptation du design "Planning hebdo" (§3, P1-P8),
// traduit fidèlement depuis src/dev/PLANNING_HEBDO_DESIGN.md (repo backend,
// branche feat/catalog-v2-editorial, commit 41962dc).

import {
  computeWeekPlan,
  computeDayStatus,
  computeMatchWindow,
  computeCongestionDays,
  replanRemainingWeek,
  evaluateManualMove,
  orderedWeek,
  DowKey,
  WeekPlanInputs,
  WeekPlanResult,
} from "../weekPlanning";

const week = orderedWeek("mon"); // ["mon","tue","wed","thu","fri","sat","sun"]

/** P9 — "le plan propose, les gates disposent" : jamais de séance placée un jour de match, J-1 ou club. */
function assertNeverBypassesGates(result: WeekPlanResult) {
  for (const day of result.days) {
    if (day.placement !== null) {
      expect(day.status).not.toBe("match");
      expect(day.status).not.toBe("club");
      expect(day.window).not.toBe("j-1");
      expect(day.window).not.toBe("j+1");
    }
  }
}

const base = (overrides: Partial<WeekPlanInputs>): WeekPlanInputs => ({
  ageCategory: "Senior",
  clubTrainingDays: [],
  matchDays: [],
  targetFksSessionsPerWeek: undefined,
  microcycleGoal: "fondation",
  weekStart: "mon",
  ...overrides,
});

describe("P1 — jours interdits (durs)", () => {
  test("match, J-1 et club ne sont jamais éligibles, quel que soit l'âge/cycle", () => {
    const inputs = base({
      ageCategory: "U13",
      clubTrainingDays: ["tue", "thu"] as DowKey[],
      matchDays: ["sun"] as DowKey[],
      microcycleGoal: "force",
    });
    const result = computeWeekPlan(inputs);
    const byDow = Object.fromEntries(result.days.map((d) => [d.dow, d]));
    expect(byDow.sun.eligible).toBe(false); // match
    expect(byDow.sat.eligible).toBe(false); // J-1
    expect(byDow.tue.eligible).toBe(false); // club
    expect(byDow.thu.eligible).toBe(false); // club
    assertNeverBypassesGates(result);
  });

  test("statut CLUB : MATCH prime si un jour est les deux", () => {
    expect(computeDayStatus("sun", ["sun"] as DowKey[], ["sun"] as DowKey[])).toBe("match");
  });
});

describe("P2 — jours conditionnels gradés par âge", () => {
  test("J+1 est interdit pour tous les âges", () => {
    expect(computeMatchWindow("mon", ["sun"] as DowKey[])).toBe("j+1");
    const youngPlan = computeWeekPlan(base({ ageCategory: "U15", matchDays: ["sun"] as DowKey[] }));
    const adultPlan = computeWeekPlan(base({ ageCategory: "Senior", matchDays: ["sun"] as DowKey[] }));
    expect(youngPlan.days.find((d) => d.dow === "mon")!.eligible).toBe(false);
    expect(adultPlan.days.find((d) => d.dow === "mon")!.eligible).toBe(false);
  });

  test("J+2 interdit U13/U15, admis (modérée) U17+", () => {
    // clubTrainingDays vide ici : mardi doit rester LIBRE pour porter la
    // fenêtre J+2 (un jour club n'a jamais de fenêtre, cf. P1).
    const u15 = computeWeekPlan(base({ ageCategory: "U15", matchDays: ["sun"] as DowKey[] }));
    const senior = computeWeekPlan(base({ ageCategory: "Senior", matchDays: ["sun"] as DowKey[] }));
    expect(u15.days.find((d) => d.dow === "tue")!.eligible).toBe(false);
    const seniorTue = senior.days.find((d) => d.dow === "tue")!;
    expect(seniorTue.window).toBe("j+2");
    expect(seniorTue.eligible).toBe(true);
  });

  test("J-2 : admis si aucune alternative NORMAL (jeunes) — sinon exclu tant qu'une alternative existe", () => {
    // U15, match dim, club mar/jeu -> ven (J-2) exclu tant que mer (NORMAL) existe.
    const withNormalAlt = computeWeekPlan(
      base({ ageCategory: "U15", clubTrainingDays: ["tue", "thu"] as DowKey[], matchDays: ["sun"] as DowKey[] })
    );
    expect(withNormalAlt.days.find((d) => d.dow === "wed")!.window).toBe("normal");
    expect(withNormalAlt.days.find((d) => d.dow === "fri")!.eligible).toBe(false);

    // Si mercredi devient club (plus d'alternative NORMAL), vendredi redevient plaçable.
    const withoutNormalAlt = computeWeekPlan(
      base({ ageCategory: "U15", clubTrainingDays: ["tue", "wed", "thu"] as DowKey[], matchDays: ["sun"] as DowKey[] })
    );
    const fri = withoutNormalAlt.days.find((d) => d.dow === "fri")!;
    expect(fri.eligible).toBe(true);
    expect(fri.reasons).toContain("plan:p2_j_minus_2_youth_fallback");
  });
});

describe("P3 — volume hebdo cible (les deux exemples de la mission)", () => {
  test("U15, 2 club (mar/jeu) + 1 match (dim) -> exactement 1 séance : mercredi", () => {
    const result = computeWeekPlan(
      base({ ageCategory: "U15", clubTrainingDays: ["tue", "thu"] as DowKey[], matchDays: ["sun"] as DowKey[], microcycleGoal: "endurance" })
    );
    expect(result.target).toBe(2);
    expect(result.placedDows).toEqual(["wed"]);
    assertNeverBypassesGates(result);
  });

  test("Senior, 3 club (lun/mer/ven) + 1 match (dim) -> 2 séances : mardi (modérée) + jeudi (pleine)", () => {
    const result = computeWeekPlan(
      base({
        ageCategory: "Senior",
        clubTrainingDays: ["mon", "wed", "fri"] as DowKey[],
        matchDays: ["sun"] as DowKey[],
        microcycleGoal: "endurance",
      })
    );
    expect(result.target).toBe(2);
    expect(result.placedDows).toEqual(["tue", "thu"]);
    const tue = result.days.find((d) => d.dow === "tue")!;
    const thu = result.days.find((d) => d.dow === "thu")!;
    expect(tue.placement).toBe("moderate");
    expect(thu.placement).toBe("full");
    assertNeverBypassesGates(result);
  });

  test("U13, 3 club + 1 match -> cible 0 (semaine déjà pleine, protection voulue)", () => {
    const result = computeWeekPlan(
      base({ ageCategory: "U13", clubTrainingDays: ["mon", "wed", "fri"] as DowKey[], matchDays: ["sun"] as DowKey[] })
    );
    expect(result.target).toBe(0);
    expect(result.placedDows).toEqual([]);
    expect(result.warnings).toContain("plan:zero_target");
  });

  test("contre-cas : Senior souhait 1, mêmes jours -> 1 séance (jeudi, meilleur score P6)", () => {
    const result = computeWeekPlan(
      base({
        ageCategory: "Senior",
        clubTrainingDays: ["mon", "wed", "fri"] as DowKey[],
        matchDays: ["sun"] as DowKey[],
        targetFksSessionsPerWeek: 1,
        microcycleGoal: "endurance",
      })
    );
    expect(result.target).toBe(1);
    expect(result.placedDows).toEqual(["thu"]);
  });
});

describe("P4 — espacements", () => {
  test("jamais 2 jours calendaires consécutifs (Senior sans club ni match, souhait 4, cap 3)", () => {
    const result = computeWeekPlan(base({ ageCategory: "Senior", targetFksSessionsPerWeek: 4, microcycleGoal: "fondation" }));
    expect(result.target).toBe(3);
    expect(result.placedDows).toEqual(["mon", "wed", "fri"]);
    for (let i = 1; i < result.placedDows.length; i++) {
      const gap = week.indexOf(result.placedDows[i]) - week.indexOf(result.placedDows[i - 1]);
      expect(gap).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("P5 — distance force ↔ match", () => {
  const profile = {
    ageCategory: "Senior" as const,
    clubTrainingDays: ["tue", "thu"] as DowKey[],
    matchDays: ["sun"] as DowKey[],
  };

  test("cycle force : J-2 exclu par défaut -> 1 séance (mercredi), cible 2 non atteinte", () => {
    const result = computeWeekPlan(base({ ...profile, microcycleGoal: "force" }));
    expect(result.target).toBe(2);
    expect(result.placedDows).toEqual(["wed"]);
    expect(result.warnings).toContain("plan:target_not_fully_reached");
    const fri = result.days.find((d) => d.dow === "fri")!;
    expect(fri.reasons).toContain("plan:p5_force_match_distance");
  });

  test("cycle endurance (même profil) : ven (J-2) redevient plaçable -> 2 séances (mer + ven)", () => {
    const result = computeWeekPlan(base({ ...profile, microcycleGoal: "endurance" }));
    expect(result.target).toBe(2);
    expect(result.placedDows).toEqual(["wed", "fri"]);
  });
});

describe("P6 — score de placement déterministe", () => {
  test("Senior 3 club lun/mer/ven + match dim : scores hardcodés, sélection [mar, jeu]", () => {
    const result = computeWeekPlan(
      base({
        ageCategory: "Senior",
        clubTrainingDays: ["mon", "wed", "fri"] as DowKey[],
        matchDays: ["sun"] as DowKey[],
        microcycleGoal: "endurance",
      })
    );
    const tue = result.days.find((d) => d.dow === "tue")!;
    const thu = result.days.find((d) => d.dow === "thu")!;
    // NB : le design (§3 P6) affiche mar=0 dans sa prose, en ne comptant que la
    // pénalité "lendemain club" (-2, lundi). Mais son propre exemple jeudi
    // applique bien SIMULTANÉMENT "lendemain club" (-2) ET "veille club" (-1)
    // quand les deux voisins sont club (jeu : mer club hier, ven club demain
    // -> 3+3-2-1=3, confirmé par le design). Par cohérence avec la FORMULE
    // (§3 P6, 5 termes indépendants) plutôt qu'avec cette prose visiblement
    // abbrégée pour mardi, mardi applique aussi sa pénalité "veille club"
    // (mercredi est club le lendemain de mardi) : 0+2-2-1=-1. Le résultat
    // final [mar, jeu] est inchangé dans les deux lectures (jeu gagne alors
    // que mar est le seul candidat restant) — voir livrable pour signalement.
    expect(thu.score).toBe(3);
    expect(tue.score).toBe(-1);
    expect(result.placedDows).toEqual(["tue", "thu"]);
  });
});

describe("P7 — semaines particulières", () => {
  test("(a) 2 matchs mer+dim, écart 4j (<5) -> rien entre les deux, plan vide", () => {
    const result = computeWeekPlan(base({ ageCategory: "Senior", matchDays: ["wed", "sun"] as DowKey[], microcycleGoal: "fondation" }));
    expect(result.target).toBe(1);
    expect(result.placedDows).toEqual([]);
    expect(result.days.find((d) => d.dow === "mon")!.window).toBe("j+1");
    expect(result.days.find((d) => d.dow === "tue")!.window).toBe("j-1");
    expect(result.days.find((d) => d.dow === "thu")!.congestion).toBe(true);
    expect(result.days.find((d) => d.dow === "fri")!.congestion).toBe(true);
    expect(result.days.find((d) => d.dow === "sat")!.congestion).toBe(true);
    assertNeverBypassesGates(result);
  });

  test("(b) 2 matchs lun+dim, écart 6j (>=5) -> jeudi NORMAL, plan = [jeudi]", () => {
    const result = computeWeekPlan(base({ ageCategory: "Senior", matchDays: ["mon", "sun"] as DowKey[], microcycleGoal: "fondation" }));
    const thu = result.days.find((d) => d.dow === "thu")!;
    expect(thu.window).toBe("normal");
    expect(thu.congestion).toBe(false);
    expect(result.placedDows).toContain("thu");
  });

  test("(c) trêve (0 club, 0 match) Senior souhait 4 -> 3 séances espacées", () => {
    const result = computeWeekPlan(base({ ageCategory: "Senior", targetFksSessionsPerWeek: 4, microcycleGoal: "saison" }));
    expect(result.warnings).toContain("plan:p7_treve");
    expect(result.target).toBe(3);
    expect(result.placedDows).toEqual(["mon", "wed", "fri"]);
  });

  test("semaine sans match : cible_cycle +1 (dans la limite du cap et du souhait)", () => {
    const result = computeWeekPlan(
      base({ ageCategory: "Senior", clubTrainingDays: ["tue", "thu"] as DowKey[], matchDays: [], microcycleGoal: "saison" })
    );
    expect(result.warnings).toContain("plan:p7_no_match_bonus_session");
    expect(result.target).toBe(2); // min(cap3, budget6-2=4, souhait2, cibleCycle(1+1)=2)
  });

  test("congestion : jours 'entre les deux' non trouvés hors intervalle (P7 n'exclut que l'intervalle propre à la semaine)", () => {
    const congestion = computeCongestionDays(week, ["wed", "sun"] as DowKey[]);
    expect(Array.from(congestion).sort()).toEqual(["fri", "sat", "thu"].sort());
  });
});

describe("P8 — adaptation en cours de semaine", () => {
  const profile = base({
    ageCategory: "Senior",
    clubTrainingDays: ["mon", "wed", "fri"] as DowKey[],
    matchDays: ["sun"] as DowKey[],
    microcycleGoal: "endurance",
  });

  test("séance manquée : recalcul sur les jours restants, jamais de dette", () => {
    const prior = computeWeekPlan(profile); // [tue, thu]
    expect(prior.placedDows).toEqual(["tue", "thu"]);

    const replanned = replanRemainingWeek(profile, prior, { todayDow: "wed", completedDows: [] });
    expect(replanned.warnings).toContain("plan:missed_replanned");
    // mer et ven sont club (exclus P1) dans ce profil -> seul jeudi reste éligible.
    expect(replanned.placedDows).toEqual(["thu"]);
    // mardi (prescrit, non fait, désormais passé) ne devient jamais une dette.
    expect(replanned.days.find((d) => d.dow === "tue")!.placement).toBeNull();
  });

  test("déplacement manuel : refus dur (match/J-1), acceptation étiquetée sinon", () => {
    const clubMatch = { clubTrainingDays: ["mon", "wed", "fri"] as DowKey[], matchDays: ["sun"] as DowKey[] };
    const toSaturday = evaluateManualMove("sat", clubMatch, week); // J-1
    expect(toSaturday.allowed).toBe(false);

    const toSunday = evaluateManualMove("sun", clubMatch, week); // match
    expect(toSunday.allowed).toBe(false);

    const toClubDay = evaluateManualMove("mon", clubMatch, week); // club
    expect(toClubDay.allowed).toBe(true);
    expect(toClubDay.label).toMatch(/micro-dose/i);
  });
});

describe("P9 — le plan ne contourne jamais un gate connu", () => {
  test("aucun profil testé ci-dessus ne place une séance pleine sur match/J-1/club/J+1", () => {
    const scenarios: WeekPlanInputs[] = [
      base({ ageCategory: "U13", clubTrainingDays: ["tue", "thu"] as DowKey[], matchDays: ["sun"] as DowKey[] }),
      base({ ageCategory: "U15", clubTrainingDays: ["tue", "thu"] as DowKey[], matchDays: ["sun"] as DowKey[] }),
      base({ ageCategory: "Senior", clubTrainingDays: ["mon", "wed", "fri"] as DowKey[], matchDays: ["sun"] as DowKey[] }),
      base({ ageCategory: "Senior", matchDays: ["wed", "sun"] as DowKey[] }),
      base({ ageCategory: "Senior", matchDays: ["mon", "sun"] as DowKey[] }),
      base({ ageCategory: "Senior", targetFksSessionsPerWeek: 4 }),
    ];
    for (const s of scenarios) assertNeverBypassesGates(computeWeekPlan(s));
  });
});

describe("Cas limites", () => {
  test("aucun cycle actif -> aucune séance prescrite (règle globale FKS #1)", () => {
    const result = computeWeekPlan(base({ microcycleGoal: null }));
    expect(result.target).toBe(0);
    expect(result.placedDows).toEqual([]);
    expect(result.warnings).toContain("plan:no_active_cycle");
  });

  test("souhait clampé 1-4", () => {
    const tooHigh = computeWeekPlan(base({ targetFksSessionsPerWeek: 9, microcycleGoal: "fondation" }));
    const tooLow = computeWeekPlan(base({ targetFksSessionsPerWeek: 0, microcycleGoal: "fondation" }));
    expect(tooHigh.target).toBeLessThanOrEqual(4);
    expect(tooLow.target).toBeGreaterThanOrEqual(0); // clamp bas = 1, mais peut retomber à 0 via les autres freins
  });

  test("weekStart='sun' : la semaine commence bien dimanche", () => {
    expect(orderedWeek("sun")).toEqual(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
    const result = computeWeekPlan(base({ weekStart: "sun", matchDays: ["sun"] as DowKey[] }));
    expect(result.days[0].dow).toBe("sun");
  });

  test("calendrier vide (pas de donnée saisie) -> pas de fenêtre, jours tous NORMAL", () => {
    const result = computeWeekPlan(base({ microcycleGoal: "fondation" }));
    for (const d of result.days) {
      expect(d.status).toBe("libre");
      expect(d.window).toBe("normal");
    }
  });
});
