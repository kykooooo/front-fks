// domain/__tests__/coachLabels.test.ts
import {
  guardrailToCoachLabel,
  toCoachAdaptationLabels,
  collectAdaptationTokens,
  readableIntensity,
  readableFocus,
  readableSessionStatus,
  pickCoachSessionToDisplay,
  buildCoachPlayerRowStatus,
  sortCoachPlayersForDashboard,
} from "../coachLabels";

describe("guardrailToCoachLabel — exemples du cahier des charges", () => {
  test("contexte club intense", () => {
    expect(guardrailToCoachLabel("club:heavy_week_adjustment")).toBe("Semaine club intense : charge FKS réduite");
  });
  test("catégorie d'âge : durée plafonnée", () => {
    expect(guardrailToCoachLabel("age:U15_duration_cap")).toBe("Catégorie U15 : durée plafonnée");
  });
  test("veille de match", () => {
    expect(guardrailToCoachLabel("intent:j_minus_1_cap_level_easy")).toBe("Veille de match : activation uniquement");
  });
  test("séance allégée (tier)", () => {
    expect(guardrailToCoachLabel("tier:easy_plus")).toBe("Séance allégée");
  });
});

describe("guardrailToCoachLabel — sécurité / confidentialité", () => {
  test("blessure → message générique, jamais de détail médical", () => {
    expect(guardrailToCoachLabel("injury:severity_3_force_easy")).toBe("Adaptation sécurité appliquée");
    expect(guardrailToCoachLabel("injury:severity_2_cap_moderate_light")).toBe("Adaptation sécurité appliquée");
  });
  test("ne révèle ni zone ni sévérité", () => {
    const label = guardrailToCoachLabel("injury:severity_3_force_easy") ?? "";
    expect(label.toLowerCase()).not.toContain("severity");
    expect(label).not.toMatch(/genou|cheville|3/);
  });
  test("chaîne héritée qui fuite le TSB → traduite, TSB masqué", () => {
    const label = guardrailToCoachLabel("TSB < -10 → easy/modéré et volume -20%");
    expect(label).toBe("Joueur chargé : séance allégée");
    expect(label).not.toContain("TSB");
  });
  test("bruit interne masqué (null)", () => {
    expect(guardrailToCoachLabel("tier:volume_scale:0.75")).toBeNull();
    expect(guardrailToCoachLabel("volume:phase:build_2")).toBeNull();
    expect(guardrailToCoachLabel("foundation_phase:2")).toBeNull();
    expect(guardrailToCoachLabel("")).toBeNull();
    expect(guardrailToCoachLabel(undefined)).toBeNull();
    expect(guardrailToCoachLabel("un_token_totalement_inconnu")).toBeNull();
  });
});

describe("labels U15 féminin — neutres, non médicaux", () => {
  test("freinage/réception + contrôle appuis", () => {
    expect(guardrailToCoachLabel("age:U15_youth_deceleration_substitute")).toBe("Focus freinage / réception contrôlée");
    expect(guardrailToCoachLabel("team:female_neuromuscular_focus")).toBe("Contrôle appuis et alignement");
  });
  test("aucun terme féminin / médical / cycle dans les labels", () => {
    for (const tok of ["age:U15_youth_deceleration_substitute", "team:female_neuromuscular_focus"]) {
      const label = (guardrailToCoachLabel(tok) ?? "").toLowerCase();
      expect(label).not.toMatch(/fémin|femin|menstru|règles|cycle|lca|blessure|girl|fille/);
    }
  });
});

describe("tokens client stables + héritage FR", () => {
  test("tokens client:* traduits sans fuite TSB", () => {
    expect(guardrailToCoachLabel("client:club_proximity_reduction")).toBe("Entraînement club proche : charge réduite");
    expect(guardrailToCoachLabel("client:load_high_forced_easy")).toBe("Joueur chargé : séance allégée");
    expect(guardrailToCoachLabel("client:load_negative_intensity_reduced")).toBe("Joueur chargé : intensité réduite");
  });
  test("anciennes chaînes FR héritées encore traduites (rétrocompat vieux docs)", () => {
    expect(guardrailToCoachLabel("TSB < -10 → easy/modéré et volume -20%")).toBe("Joueur chargé : séance allégée");
    expect(guardrailToCoachLabel("Réduction club (jour/veille)")).toBe("Entraînement club proche : charge réduite");
  });
});

describe("collectAdaptationTokens", () => {
  test("fusionne camelCase + snake_case + client + legacy, dédupliqué", () => {
    const merged = collectAdaptationTokens(
      ["club:heavy_week_adjustment"], // ai.guardrailsApplied (camel)
      ["age:U15_duration_cap"], // ai.guardrails_applied (snake)
      ["client:club_proximity_reduction"], // clientGuardrailsApplied
      ["club:heavy_week_adjustment", "Réduction club (jour/veille)"], // legacy top-level (doublon + FR)
    );
    expect(merged).toEqual([
      "club:heavy_week_adjustment",
      "age:U15_duration_cap",
      "client:club_proximity_reduction",
      "Réduction club (jour/veille)",
    ]);
  });
  test("sources non-array ignorées, pas de crash", () => {
    expect(collectAdaptationTokens(undefined, null, ["tier:easy_plus"])).toEqual(["tier:easy_plus"]);
  });
});

describe("toCoachAdaptationLabels", () => {
  test("filtre le bruit, traduit, déduplique", () => {
    const labels = toCoachAdaptationLabels([
      "club:heavy_week_adjustment",
      "tier:volume_scale:0.75", // masqué
      "age:U15_duration_cap",
      "age:U15_intensity_cap",
      "club:heavy_week_adjustment", // doublon
      "injury:severity_2_cap_moderate_light",
    ]);
    expect(labels).toEqual([
      "Semaine club intense : charge FKS réduite",
      "Catégorie U15 : durée plafonnée",
      "Catégorie U15 : intensité plafonnée",
      "Adaptation sécurité appliquée",
    ]);
  });
  test("entrée non-array → []", () => {
    expect(toCoachAdaptationLabels(undefined)).toEqual([]);
    expect(toCoachAdaptationLabels(null)).toEqual([]);
  });
});

describe("guardrailToCoachLabel — honnêteté objectifs coach", () => {
  test("freshness adapte vraiment → libellé affirmatif", () => {
    expect(guardrailToCoachLabel("club:goal_freshness")).toBe("Objectif coach : fraîcheur (séance allégée si besoin)");
  });
  test("objectifs trace-only → 'renseigné' (ne survend pas)", () => {
    expect(guardrailToCoachLabel("club:goal_strength")).toBe("Objectif coach renseigné : force");
    expect(guardrailToCoachLabel("club:goal_speed")).toBe("Objectif coach renseigné : vitesse");
    expect(guardrailToCoachLabel("club:goal_prevention")).toBe("Objectif coach renseigné : prévention");
    expect(guardrailToCoachLabel("club:goal_comeback")).toBe("Objectif coach renseigné : reprise");
  });
});

describe("pickCoachSessionToDisplay — choix planned vs completed", () => {
  const planned = (over = {}) => ({ id: "p1", dateKey: "2026-06-10", status: "planned", ...over });
  const completed = (over = {}) => ({ id: "c1", dateKey: "2026-06-03", status: "done", ...over });

  test("1. planned future + completed passée → planned", () => {
    expect(pickCoachSessionToDisplay(planned({ dateKey: "2026-06-12" }), completed({ dateKey: "2026-06-03" }))?.status).toBe("planned");
  });
  test("2. planned ancienne + completed récente → completed", () => {
    expect(pickCoachSessionToDisplay(planned({ dateKey: "2026-05-01" }), completed({ dateKey: "2026-06-03" }))?.status).toBe("done");
  });
  test("3. planned même date que completed → completed", () => {
    expect(pickCoachSessionToDisplay(planned({ dateKey: "2026-06-03" }), completed({ dateKey: "2026-06-03" }))?.status).toBe("done");
  });
  test("4. planned même id que completed → completed", () => {
    expect(pickCoachSessionToDisplay(planned({ id: "same", dateKey: "2026-06-20" }), completed({ id: "same", dateKey: "2026-06-03" }))?.status).toBe("done");
  });
  test("5. only planned → planned", () => {
    expect(pickCoachSessionToDisplay(planned(), null)?.status).toBe("planned");
  });
  test("6. only completed → completed", () => {
    expect(pickCoachSessionToDisplay(null, completed())?.status).toBe("done");
  });
  test("7. aucune → null", () => {
    expect(pickCoachSessionToDisplay(null, null)).toBeNull();
  });
  test("fallback prudent : date manquante → completed (vérité terrain)", () => {
    expect(pickCoachSessionToDisplay(planned({ dateKey: null }), completed({ dateKey: null }))?.status).toBe("done");
    expect(pickCoachSessionToDisplay(planned({ dateKey: "2026-06-20" }), completed({ dateKey: null }))?.status).toBe("done");
  });
});

describe("buildCoachPlayerRowStatus — dashboard coach", () => {
  const TODAY = "2026-06-10";

  test("1. planned future → Prévue", () => {
    const r = buildCoachPlayerRowStatus(
      { session: { status: "planned", dateKey: "2026-06-12", adaptationTokens: [] }, lastActivity: null, detailsUnavailable: false },
      TODAY,
    );
    expect(r.sessionStatusLabel).toBe("Prévue");
    expect(r.tone).toBe("default");
  });

  test("2. completed today → Faite / Aujourd'hui", () => {
    const r = buildCoachPlayerRowStatus(
      { session: { status: "done", dateKey: "2026-06-10", adaptationTokens: [] }, lastActivity: { dateISO: "2026-06-10" } },
      TODAY,
    );
    expect(r.sessionStatusLabel).toBe("Faite");
    expect(r.tone).toBe("ok");
    expect(r.activityLabel).toBe("Aujourd'hui");
  });

  test("3. completed 3 days ago → Faite / Il y a 3 jours", () => {
    const r = buildCoachPlayerRowStatus(
      { session: { status: "done", dateKey: "2026-06-07", adaptationTokens: [] }, lastActivity: { dateISO: "2026-06-07" } },
      TODAY,
    );
    expect(r.sessionStatusLabel).toBe("Faite");
    expect(r.activityLabel).toBe("Il y a 3 jours");
  });

  test("4. no session → Aucune donnée / Jamais", () => {
    const r = buildCoachPlayerRowStatus({ session: null, lastActivity: null }, TODAY);
    expect(r.sessionStatusLabel).toBe("Aucune donnée");
    expect(r.activityLabel).toBe("Jamais");
    expect(r.adaptationLabel).toBe("");
  });

  test("5. no activity 8 days + no planned → À relancer", () => {
    const r = buildCoachPlayerRowStatus(
      { session: { status: "done", dateKey: "2026-06-02", adaptationTokens: [] }, lastActivity: { dateISO: "2026-06-02" } },
      TODAY,
    );
    expect(r.sessionStatusLabel).toBe("À relancer");
    expect(r.tone).toBe("warn");
    expect(r.activityLabel).toBe("Il y a 8 jours");
  });

  test("6. adaptation tokens present → Adaptée", () => {
    const r = buildCoachPlayerRowStatus(
      {
        session: { status: "planned", dateKey: "2026-06-12", adaptationTokens: ["club:heavy_week_adjustment"] },
        lastActivity: null,
      },
      TODAY,
    );
    expect(r.adaptationLabel).toBe("Adaptée");
  });

  test("6bis. session sans token traduisible → Standard", () => {
    const r = buildCoachPlayerRowStatus(
      { session: { status: "planned", dateKey: "2026-06-12", adaptationTokens: ["tier:volume_scale:0.75"] }, lastActivity: null },
      TODAY,
    );
    expect(r.adaptationLabel).toBe("Standard");
  });

  test("7. detailsUnavailable → Détails indispo", () => {
    const r = buildCoachPlayerRowStatus({ session: null, lastActivity: null, detailsUnavailable: true }, TODAY);
    expect(r.adaptationLabel).toBe("Détails indispo");
    expect(r.sessionStatusLabel).toBe("Aucune donnée");
  });

  test("planifiée passée non faite → À relancer (pas Prévue)", () => {
    const r = buildCoachPlayerRowStatus(
      { session: { status: "planned", dateKey: "2026-06-01", adaptationTokens: [] }, lastActivity: null },
      TODAY,
    );
    expect(r.sessionStatusLabel).toBe("À relancer");
  });
});

describe("sortCoachPlayersForDashboard — priorité actionnable", () => {
  const TODAY = "2026-06-10";
  // helpers de construction d'overview
  const ovRelancer = { session: { status: "done", dateKey: "2026-06-01", adaptationTokens: [] }, lastActivity: { dateISO: "2026-06-01" } };
  const ovNoData = { session: null, lastActivity: null };
  const ovIndispo = { session: null, lastActivity: null, detailsUnavailable: true };
  const ovPrevue = { session: { status: "planned", dateKey: "2026-06-12", adaptationTokens: [] }, lastActivity: null };
  const ovAdaptee = { session: { status: "done", dateKey: "2026-06-09", adaptationTokens: ["club:heavy_week_adjustment"] }, lastActivity: { dateISO: "2026-06-09" } };
  const ovFaiteStd = { session: { status: "done", dateKey: "2026-06-09", adaptationTokens: [] }, lastActivity: { dateISO: "2026-06-09" } };

  const order = (players: any[], overviews: any) =>
    sortCoachPlayersForDashboard(players, overviews, TODAY).map((r) => r.player.uid);

  test("1. À relancer avant Faite", () => {
    const res = order(
      [{ uid: "faite", firstName: "Zoe" }, { uid: "relance", firstName: "Zoe" }],
      { faite: ovFaiteStd, relance: ovRelancer },
    );
    expect(res).toEqual(["relance", "faite"]);
  });

  test("2. Aucune donnée avant Faite", () => {
    const res = order(
      [{ uid: "faite", firstName: "Zoe" }, { uid: "nodata", firstName: "Zoe" }],
      { faite: ovFaiteStd, nodata: ovNoData },
    );
    expect(res).toEqual(["nodata", "faite"]);
  });

  test("3. Détails indispo avant Standard", () => {
    const res = order(
      [{ uid: "std", firstName: "Zoe" }, { uid: "indispo", firstName: "Zoe" }],
      { std: ovFaiteStd, indispo: ovIndispo },
    );
    expect(res).toEqual(["indispo", "std"]);
  });

  test("4. Prévue avant Faite standard", () => {
    const res = order(
      [{ uid: "faite", firstName: "Zoe" }, { uid: "prevue", firstName: "Zoe" }],
      { faite: ovFaiteStd, prevue: ovPrevue },
    );
    expect(res).toEqual(["prevue", "faite"]);
  });

  test("5. Adaptée avant Standard", () => {
    const res = order(
      [{ uid: "std", firstName: "Zoe" }, { uid: "adaptee", firstName: "Zoe" }],
      { std: ovFaiteStd, adaptee: ovAdaptee },
    );
    expect(res).toEqual(["adaptee", "std"]);
  });

  test("6. à égalité → prénom alphabétique", () => {
    const res = order(
      [{ uid: "u1", firstName: "Yanis" }, { uid: "u2", firstName: "Adam" }],
      { u1: ovRelancer, u2: ovRelancer },
    );
    expect(res).toEqual(["u2", "u1"]); // Adam avant Yanis
  });

  test("7. à égalité, prénom absent → uid stable", () => {
    const res = order(
      [{ uid: "zzz" }, { uid: "aaa" }],
      { zzz: ovRelancer, aaa: ovRelancer },
    );
    expect(res).toEqual(["aaa", "zzz"]);
  });

  test("8. aucun overview chargé → fallback alphabétique, pas de faux statut", () => {
    const rows = sortCoachPlayersForDashboard(
      [{ uid: "u1", firstName: "Bob" }, { uid: "u2", firstName: "Alice" }],
      {}, // rien chargé
      TODAY,
    );
    expect(rows.map((r) => r.player.uid)).toEqual(["u2", "u1"]); // Alice avant Bob
    expect(rows.every((r) => r.status === null)).toBe(true); // aucun statut inventé
  });

  test("ordre complet haute→basse priorité", () => {
    const players = [
      { uid: "faite", firstName: "A" },
      { uid: "relance", firstName: "A" },
      { uid: "nodata", firstName: "A" },
      { uid: "prevue", firstName: "A" },
      { uid: "adaptee", firstName: "A" },
    ];
    const res = order(players, {
      faite: ovFaiteStd, relance: ovRelancer, nodata: ovNoData, prevue: ovPrevue, adaptee: ovAdaptee,
    });
    expect(res).toEqual(["relance", "nodata", "prevue", "adaptee", "faite"]);
  });
});

describe("readable helpers", () => {
  test("intensité", () => {
    expect(readableIntensity("easy")).toBe("Légère");
    expect(readableIntensity("hard")).toBe("Intense");
    expect(readableIntensity(undefined)).toBe("—");
  });
  test("focus", () => {
    expect(readableFocus("strength")).toBe("Renfo / Force");
    expect(readableFocus("run")).toBe("Course / Endurance");
  });
  test("statut", () => {
    expect(readableSessionStatus("planned")).toBe("Prévue");
    expect(readableSessionStatus("done")).toBe("Faite");
    expect(readableSessionStatus("whatever")).toBe("Inconnue");
  });
});
