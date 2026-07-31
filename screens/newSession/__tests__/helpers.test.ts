// screens/newSession/__tests__/helpers.test.ts
//
// LOT 3 (P1) — supprime RESET_VARIANT_FALLBACKS : si le backend ne fournit
// pas de variantes de reset exploitables, on n'en invente pas les titres.
// resolveResetVariants() est le seul point qui décide quelles variantes
// arrivent jusqu'à ResetVariantModal — ces tests prouvent qu'il ne fabrique
// jamais rien, et qu'un backend sans variante produit un tableau vide (donc
// pas de carte de choix affichée, voir NewSessionScreen.tsx).

import { resolveResetVariants } from "../helpers";
import type { FKS_NextSessionV2 } from "../types";

describe("resolveResetVariants — jamais de variante inventee", () => {
  test("aucune variante backend (champ absent) : tableau vide, pas de fallback fabrique", () => {
    const v2 = {} as Pick<FKS_NextSessionV2, "resetVariants">;
    expect(resolveResetVariants(v2)).toEqual([]);
  });

  test("resetVariants vide explicitement : tableau vide aussi", () => {
    expect(resolveResetVariants({ resetVariants: [] })).toEqual([]);
  });

  test("le texte des anciens fallbacks n'apparait jamais, quoi qu'il arrive", () => {
    const ANCIENS_TITRES_INVENTES = [
      "Prime — Appuis nets",
      "Prime — Hanches libres",
      "Prime — Core duel",
      "Prime — Épaules stables",
      "Prime reset",
    ];
    const cas: Array<Pick<FKS_NextSessionV2, "resetVariants">> = [
      {},
      { resetVariants: [] },
      { resetVariants: [{ id: "reset_reel", title: "Reset réel du backend" }] },
      { resetVariants: [{ id: "sans_titre_backend" }] },
    ];
    for (const v2 of cas) {
      const serialise = JSON.stringify(resolveResetVariants(v2));
      for (const titre of ANCIENS_TITRES_INVENTES) {
        expect(serialise).not.toContain(titre);
      }
    }
  });

  test("variantes REELLES fournies par le backend : reprises telles quelles", () => {
    const v2: Pick<FKS_NextSessionV2, "resetVariants"> = {
      resetVariants: [
        { id: "reset_hanches", title: "Hanches (backend)", subtitle: "Sous-titre backend", durationMin: 14 },
        { id: "reset_appuis", title: "Appuis (backend)" },
      ],
    };
    const variants = resolveResetVariants(v2);
    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({ id: "reset_hanches", title: "Hanches (backend)", subtitle: "Sous-titre backend", durationMin: 14 });
    expect(variants[1].title).toBe("Appuis (backend)");
  });

  test("variante backend SANS titre : dernier recours = son id reel, jamais un titre invente", () => {
    const v2: Pick<FKS_NextSessionV2, "resetVariants"> = {
      resetVariants: [{ id: "reset_sans_titre_9f2" }],
    };
    const variants = resolveResetVariants(v2);
    expect(variants).toHaveLength(1);
    expect(variants[0].title).toBe("reset_sans_titre_9f2");
  });

  test("variante backend sans id : ecartee (rien d'exploitable pour la selectionner)", () => {
    const v2: Pick<FKS_NextSessionV2, "resetVariants"> = {
      resetVariants: [{ id: "" } as any, { id: "reset_valide" }],
    };
    const variants = resolveResetVariants(v2);
    expect(variants.map((v) => v.id)).toEqual(["reset_valide"]);
  });
});

describe("resolveResetVariants — sous-titre jamais fabrique (RPE/fatigue invente)", () => {
  test("backend fournit un subtitle explicite : repris tel quel, meme avec un durationMin different", () => {
    const v2: Pick<FKS_NextSessionV2, "resetVariants"> = {
      resetVariants: [{ id: "reset_epaules", title: "Épaules", subtitle: "Sous-titre backend", durationMin: 22 }],
    };
    const variants = resolveResetVariants(v2);
    expect(variants[0].subtitle).toBe("Sous-titre backend");
  });

  test("pas de subtitle backend mais un durationMin reel : sous-titre sobre '~X min', jamais de RPE invente", () => {
    const v2: Pick<FKS_NextSessionV2, "resetVariants"> = {
      resetVariants: [{ id: "reset_core", title: "Core", durationMin: 9 }],
    };
    const variants = resolveResetVariants(v2);
    expect(variants[0].subtitle).toBe("~9 min");
  });

  test("ni subtitle ni durationMin backend : PAS de sous-titre du tout (pas de RPE ni de 'zero fatigue' invente)", () => {
    const v2: Pick<FKS_NextSessionV2, "resetVariants"> = {
      resetVariants: [{ id: "reset_appuis", title: "Appuis (backend)" }],
    };
    const variants = resolveResetVariants(v2);
    expect(variants[0].subtitle).toBeUndefined();
  });

  test("durationMin a 0 ou negatif : traite comme absent, pas de '~0 min'", () => {
    const v2: Pick<FKS_NextSessionV2, "resetVariants"> = {
      resetVariants: [
        { id: "reset_zero", title: "Zero", durationMin: 0 },
        { id: "reset_neg", title: "Neg", durationMin: -5 },
      ],
    };
    const variants = resolveResetVariants(v2);
    expect(variants[0].subtitle).toBeUndefined();
    expect(variants[1].subtitle).toBeUndefined();
  });

  test("aucun sous-titre genere ne contient jamais de RPE ni 'zero fatigue' invente", () => {
    const cas: Array<Pick<FKS_NextSessionV2, "resetVariants">> = [
      { resetVariants: [{ id: "a", title: "A" }] },
      { resetVariants: [{ id: "b", title: "B", durationMin: 16 }] },
      { resetVariants: [{ id: "c", title: "C", durationMin: 12 }] },
    ];
    for (const v2 of cas) {
      const serialise = JSON.stringify(resolveResetVariants(v2));
      expect(serialise).not.toContain("RPE");
      expect(serialise).not.toContain("fatigue");
    }
  });
});
