// hooks/home/__tests__/primaryCtaKindEtDescription.test.ts
// =============================================================================
// AJOUTS PURS DE usePrimaryCta (SPEC_DA_ACCUEIL_SEANCE.md §2.3) — TESTÉS SANS
// RENDERER DE HOOK, même méthode que needsCycleChoice.test.ts.
// =============================================================================
//
// Deux garanties à tenir :
//   1. `computePrimaryCtaKind` désigne exactement la même branche que l'ancien
//      if/else en cascade de `primaryCta` (priorité : recovery > start_today >
//      start_pending > day_off > choose_cycle > prepare) ;
//   2. `decrireSeanceEnAttente` + `joindreTitreMeta` reconstruisent, au
//      caractère près, l'ancienne chaîne `upcomingSessionLabel` à bloc unique
//      (fixée ici en commentaire, jamais modifiée, pour servir de référence
//      de non-régression).
// =============================================================================

import {
  computePrimaryCtaKind,
  decrireSeanceEnAttente,
  joindreTitreMeta,
} from "../usePrimaryCta";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../../domain/microcycles";
import { frFocus, frIntensity } from "../../../utils/frLabels";
import type { Session } from "../../../domain/types";

// -----------------------------------------------------------------------------
// 1. computePrimaryCtaKind — priorité des 6 branches
// -----------------------------------------------------------------------------

describe("computePrimaryCtaKind — même priorité que l'ancien if/else", () => {
  const base = {
    tsb: 0,
    isPendingToday: false,
    hasPendingSession: false,
    hasAppliedToday: false,
    devModeEnabled: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 0,
  };

  test("tsb <= -15 gagne sur tout le reste (recovery)", () => {
    expect(
      computePrimaryCtaKind({ ...base, tsb: -15, isPendingToday: true, hasAppliedToday: true })
    ).toBe("recovery");
    expect(computePrimaryCtaKind({ ...base, tsb: -20 })).toBe("recovery");
    expect(computePrimaryCtaKind({ ...base, tsb: -14 })).not.toBe("recovery");
  });

  test("séance en attente aujourd'hui → start_today (avant start_pending)", () => {
    expect(
      computePrimaryCtaKind({ ...base, isPendingToday: true, hasPendingSession: true })
    ).toBe("start_today");
  });

  test("séance en attente pas aujourd'hui → start_pending", () => {
    expect(computePrimaryCtaKind({ ...base, hasPendingSession: true })).toBe("start_pending");
  });

  test("déjà fait aujourd'hui, hors mode dev → day_off", () => {
    expect(computePrimaryCtaKind({ ...base, hasAppliedToday: true })).toBe("day_off");
  });

  test("déjà fait aujourd'hui, EN mode dev → day_off ignoré (retombe sur le cycle)", () => {
    expect(computePrimaryCtaKind({ ...base, hasAppliedToday: true, devModeEnabled: true })).toBe(
      "prepare"
    );
  });

  test("aucun cycle actif → choose_cycle", () => {
    expect(computePrimaryCtaKind({ ...base, microcycleGoal: null })).toBe("choose_cycle");
  });

  test("cycle terminé → choose_cycle", () => {
    expect(
      computePrimaryCtaKind({
        ...base,
        microcycleSessionIndex: MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
      })
    ).toBe("choose_cycle");
  });

  test("cycle actif, rien en attente, rien fait → prepare", () => {
    expect(computePrimaryCtaKind(base)).toBe("prepare");
  });
});

// -----------------------------------------------------------------------------
// 2. decrireSeanceEnAttente + joindreTitreMeta === l'ancien upcomingSessionLabel
// -----------------------------------------------------------------------------

/**
 * L'ANCIENNE IMPLÉMENTATION, FIGÉE ICI TELLE QUELLE (avant l'ajout de `kind` /
 * `decrireSeanceEnAttente`) — sert de référence de non-régression. Ne JAMAIS
 * la faire évoluer pour « corriger » un désaccord : si elle diverge du nouveau
 * calcul, c'est le nouveau calcul qui a un bug.
 */
function ancienUpcomingSessionLabel(pendingSession: Session | null | undefined): string {
  if (!pendingSession) return "Pas de séance prévue";
  const v2 = pendingSession.aiV2 ?? pendingSession.ai;
  if (v2) {
    const title = (v2.title as string) || "Séance FKS";
    const focusVal = v2.focusPrimary ?? v2.focus_primary;
    const focus = focusVal ? ` · ${frFocus(String(focusVal))}` : "";
    const intens = v2.intensity ? ` · ${frIntensity(String(v2.intensity))}` : "";
    const durVal = v2.durationMin ?? v2.duration_min;
    const dur = typeof durVal === "number" ? ` · ${Math.round(durVal)} min` : "";
    return `${title}${focus}${intens}${dur}`;
  }
  const focus = frFocus(pendingSession.focus ?? pendingSession.modality) || "-";
  const intens = frIntensity(pendingSession.intensity) || "-";
  return `Séance prévue · ${intens} · ${focus}`;
}

function nouveauUpcomingSessionLabel(pendingSession: Session | null | undefined): string {
  const { titre, meta } = decrireSeanceEnAttente(pendingSession);
  return joindreTitreMeta(titre, meta);
}

function sessionMinimale(overrides: Partial<Session>): Session {
  return {
    date: "2026-09-17",
    id: "s1",
    dateISO: "2026-09-17",
    focus: "mixed",
    phase: "Playlist",
    intensity: "moderate",
    volumeScore: 1,
    exercises: [],
    ...overrides,
  };
}

describe("decrireSeanceEnAttente + joindreTitreMeta — identiques à l'ancienne chaîne", () => {
  test("aucune séance en attente", () => {
    expect(nouveauUpcomingSessionLabel(null)).toBe(ancienUpcomingSessionLabel(null));
    expect(nouveauUpcomingSessionLabel(null)).toBe("Pas de séance prévue");
  });

  test("aiV2 complet (titre + focus + intensité + durée)", () => {
    const s = sessionMinimale({
      aiV2: {
        title: "Fractionné court",
        focusPrimary: "speed",
        intensity: "hard",
        durationMin: 42.6,
      },
    });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
    expect(nouveauUpcomingSessionLabel(s)).toBe("Fractionné court · Vitesse · Intense · 43 min");
  });

  test("aiV2 partiel — durée seule", () => {
    const s = sessionMinimale({ aiV2: { title: "Séance du jour", durationMin: 30 } });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
  });

  test("aiV2 partiel — focus seul, pas d'intensité ni de durée", () => {
    const s = sessionMinimale({ aiV2: { title: "Séance du jour", focusPrimary: "core" } });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
  });

  test("aiV2 partiel — intensité seule (milieu de chaîne)", () => {
    const s = sessionMinimale({ aiV2: { title: "Séance du jour", intensity: "easy" } });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
  });

  test("aiV2 sans titre → repli « Séance FKS »", () => {
    const s = sessionMinimale({ aiV2: { durationMin: 20 } });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
    expect(nouveauUpcomingSessionLabel(s)).toBe("Séance FKS · 20 min");
  });

  test("aiV2 sans aucun champ secondaire → titre seul", () => {
    const s = sessionMinimale({ aiV2: { title: "Séance sèche" } });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
    expect(nouveauUpcomingSessionLabel(s)).toBe("Séance sèche");
  });

  test("champs snake_case (focus_primary/duration_min) — repli backend legacy", () => {
    const s = sessionMinimale({
      aiV2: { title: "Séance", focus_primary: "run", duration_min: 55 },
    });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
  });

  test("ai (legacy) au lieu de aiV2", () => {
    const s = sessionMinimale({ ai: { title: "Ancienne séance", intensity: "hard" } });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
  });

  test("sans aiV2 ni ai — repli sur focus/modality/intensity de la séance", () => {
    const s = sessionMinimale({ focus: "strength", intensity: "hard" });
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
    expect(nouveauUpcomingSessionLabel(s)).toBe("Séance prévue · Intense · Force");
  });

  test("sans aiV2 ni ai, focus/intensity inconnus → tirets", () => {
    // Le type `Session` déclare `focus`/`intensity` obligatoires ; ce cas défend
    // contre des données legacy qui ne le respecteraient pas — cast volontaire.
    const s = { ...sessionMinimale({}), focus: undefined, intensity: undefined } as unknown as Session;
    expect(nouveauUpcomingSessionLabel(s)).toBe(ancienUpcomingSessionLabel(s));
    expect(nouveauUpcomingSessionLabel(s)).toBe("Séance prévue · - · -");
  });
});
