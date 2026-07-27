// domain/coachView/__tests__/sessionTitle.test.ts
//
// INVARIANT TITRE / TYPE. Ces tests verrouillent la règle d'arbitrage : en cas
// de contradiction on garde le TYPE et on abandonne le TITRE. Ils verrouillent
// aussi la synchronisation de la table miroir avec FOCUS_MAP (serveur).

import {
  COACH_FOCUS_PAIRS,
  checkSessionTitleCoherence,
  expectedTitleForFocusLabel,
  reconcileSessionTitle,
} from "../sessionTitle";
import { toCoachPlayerView } from "../fromSummary";
import { makeSummary } from "./fixtures";

const TODAY = "2026-07-27";

describe("table miroir de FOCUS_MAP (serveur)", () => {
  test("un même type de séance ne peut avoir qu'UN titre attendu", () => {
    const parLabel = new Map<string, string>();
    for (const pair of COACH_FOCUS_PAIRS) {
      const connu = parLabel.get(pair.focusLabel);
      if (connu !== undefined) expect(connu).toBe(pair.title);
      parLabel.set(pair.focusLabel, pair.title);
    }
  });

  test("chaque couple de la table est déclaré cohérent (auto-cohérence)", () => {
    for (const pair of COACH_FOCUS_PAIRS) {
      expect(checkSessionTitleCoherence(pair.title, pair.focusLabel)).toBe("coherent");
      expect(expectedTitleForFocusLabel(pair.focusLabel)).toBe(pair.title);
    }
  });

  test("couvre les 9 focus de FOCUS_MAP, dont le doublon run/endurance", () => {
    expect(COACH_FOCUS_PAIRS.map((p) => p.focus)).toEqual([
      "strength",
      "run",
      "endurance",
      "speed",
      "plyo",
      "circuit",
      "mobility",
      "core",
      "cod",
    ]);
  });
});

describe("checkSessionTitleCoherence — les quatre cas", () => {
  test("couple COHÉRENT (titre et type issus du même focus)", () => {
    expect(checkSessionTitleCoherence("Séance renfo / force", "Renfo / Force")).toBe("coherent");
  });

  test("couple INCOHÉRENT (le cas remonté : titre explosivité, type force)", () => {
    expect(checkSessionTitleCoherence("Explosivité — Vmax + appuis", "Renfo / Force")).toBe(
      "incoherent",
    );
  });

  test("titre d'un AUTRE focus connu → incohérent aussi", () => {
    expect(checkSessionTitleCoherence("Séance vitesse", "Renfo / Force")).toBe("incoherent");
  });

  test("TITRE SEUL (type absent) → non vérifiable, on ne conclut rien", () => {
    expect(checkSessionTitleCoherence("Séance renfo / force", null)).toBe("non_verifiable");
    expect(checkSessionTitleCoherence("Un titre libre", "")).toBe("non_verifiable");
  });

  test("type INCONNU de la table (front en retard sur le serveur) → non vérifiable", () => {
    expect(checkSessionTitleCoherence("Séance agilité", "Agilité")).toBe("non_verifiable");
  });

  test("TYPE SEUL (titre absent) → titre_absent, rien à contredire", () => {
    expect(checkSessionTitleCoherence(null, "Renfo / Force")).toBe("titre_absent");
    expect(checkSessionTitleCoherence("   ", "Renfo / Force")).toBe("titre_absent");
  });

  test("LES DEUX ABSENTS → titre_absent", () => {
    expect(checkSessionTitleCoherence(null, null)).toBe("titre_absent");
    expect(checkSessionTitleCoherence(undefined, undefined)).toBe("titre_absent");
  });

  test("écart purement cosmétique (casse, espaces) → cohérent", () => {
    expect(checkSessionTitleCoherence("  SÉANCE   RENFO / FORCE ", "renfo / force")).toBe(
      "coherent",
    );
  });
});

describe("reconcileSessionTitle — arbitrage", () => {
  test("couple cohérent → titre conservé tel quel", () => {
    expect(reconcileSessionTitle("Séance vitesse", "Vitesse")).toBe("Séance vitesse");
  });

  test("couple incohérent → titre ABANDONNÉ (le type, lui, est gardé par l'appelant)", () => {
    expect(reconcileSessionTitle("Explosivité — Vmax + appuis", "Renfo / Force")).toBeNull();
  });

  test("non vérifiable → titre conservé (absence de preuve ≠ preuve)", () => {
    expect(reconcileSessionTitle("Titre libre", null)).toBe("Titre libre");
  });

  test("titre absent ou vide → null", () => {
    expect(reconcileSessionTitle(null, "Vitesse")).toBeNull();
    expect(reconcileSessionTitle("   ", "Vitesse")).toBeNull();
  });

  test("en développement, une incohérence est signalée en console", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      reconcileSessionTitle("Explosivité — Vmax + appuis", "Renfo / Force");
      expect(spy).toHaveBeenCalledTimes(1);
      const message = String(spy.mock.calls[0][0]);
      expect(message).toContain("Explosivité — Vmax + appuis");
      expect(message).toContain("Renfo / Force");
      expect(message).toContain("Séance renfo / force");
    } finally {
      spy.mockRestore();
    }
  });

  test("un couple cohérent n'émet AUCUN avertissement", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      reconcileSessionTitle("Séance renfo / force", "Renfo / Force");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("invariant appliqué au modèle de lecture (bout en bout)", () => {
  const spyWarn = () => jest.spyOn(console, "warn").mockImplementation(() => {});

  test("séance PRÉVUE contradictoire → type conservé, titre abandonné", () => {
    const spy = spyWarn();
    try {
      const view = toCoachPlayerView(
        makeSummary({
          lastPlanned: {
            dateKey: "2026-07-28",
            title: "Explosivité — Vmax + appuis",
            focusLabel: "Renfo / Force",
            intensityLabel: "Modérée",
            durationMin: 40,
            blockCount: 4,
          },
        }),
        TODAY,
      );
      expect(view.seancePrevue?.titre).toBeNull();
      expect(view.seancePrevue?.focus).toBe("Renfo / Force");
      // Le reste de la séance reste affichable : on n'a retiré QUE le mensonge.
      expect(view.seancePrevue?.dureeMin).toBe(40);
    } finally {
      spy.mockRestore();
    }
  });

  test("séance FAITE contradictoire (slot legacy latestSession) → même arbitrage", () => {
    const spy = spyWarn();
    try {
      const view = toCoachPlayerView(
        makeSummary({
          latestSession: {
            dateKey: "2026-07-26",
            title: "Explosivité — Vmax + appuis",
            focusLabel: "Renfo / Force",
            intensityLabel: "Modérée",
            durationMin: 40,
            blockCount: 4,
            status: "done",
          },
        }),
        TODAY,
      );
      expect(view.seanceFaite?.titre).toBeNull();
      expect(view.seanceFaite?.focus).toBe("Renfo / Force");
    } finally {
      spy.mockRestore();
    }
  });

  test("séance dont le titre était la SEULE information → plus rien à afficher", () => {
    const spy = spyWarn();
    try {
      const view = toCoachPlayerView(
        makeSummary({
          lastPlanned: {
            dateKey: null,
            title: "Explosivité — Vmax + appuis",
            focusLabel: null,
            intensityLabel: null,
            durationMin: null,
            blockCount: null,
          },
        }),
        TODAY,
      );
      // Type absent → invariant non vérifiable → le titre est conservé.
      expect(view.seancePrevue?.titre).toBe("Explosivité — Vmax + appuis");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  test("couple cohérent → titre affiché normalement", () => {
    const view = toCoachPlayerView(
      makeSummary({
        lastDone: {
          dateKey: "2026-07-26",
          title: "Séance appuis",
          focusLabel: "Appuis / Changements de direction",
          intensityLabel: "Modérée",
          durationMin: 35,
          blockCount: 4,
        },
      }),
      TODAY,
    );
    expect(view.seanceFaite?.titre).toBe("Séance appuis");
  });
});
