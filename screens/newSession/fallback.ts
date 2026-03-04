import type { Exercise, Session } from "../../domain/types";

export function buildFallbackSession(
  dateISO: string,
  phase: Session["phase"]
): { session: Session; aiV2: Record<string, unknown> } {
  const fallbackId = `fallback_${dateISO}_${Math.random().toString(36).slice(2, 6)}`;
  const exercises: Exercise[] = [
    {
      id: `${fallbackId}_wu`,
      name: "Échauffement dynamique",
      modality: "mobility",
      intensity: "easy",
      sets: 1,
      durationSec: 480,
    },
    {
      id: `${fallbackId}_run`,
      name: "Footing Z2",
      modality: "run",
      intensity: "moderate" as Exercise["intensity"],
      sets: 1,
      durationSec: 1200,
      notes: "Course facile en continu ~20 min",
    },
    {
      id: `${fallbackId}_mob`,
      name: "Mobilité / retour au calme",
      modality: "mobility",
      intensity: "easy",
      sets: 1,
      durationSec: 600,
    },
  ];
  const session: Session = {
    id: fallbackId,
    date: dateISO,
    dateISO: `${dateISO}T00:00:00.000Z`,
    phase,
    focus: "run" as Session["focus"],
    intensity: "moderate" as Session["intensity"],
    volumeScore: 45,
    exercises,
    completed: false,
  };

  const aiV2 = {
    version: "fks.next_session.v2",
    title: "Fallback FKS",
    subtitle: "Cardio facile + mobilité",
    intensity: "moderate",
    focusPrimary: "run",
    durationMin: 45,
    rpeTarget: 6,
    blocks: [
      {
        id: "warmup",
        type: "warmup",
        goal: "Réveil articulaire",
        intensity: "easy",
        durationMin: 8,
        items: [{ name: "Mobilité dynamique full body", sets: 1, workS: 480, restS: 0 }],
      },
      {
        id: "run",
        type: "run",
        goal: "Footing Z2",
        intensity: "moderate",
        durationMin: 20,
        items: [{ name: "Footing continu", sets: 1, workS: 1200, restS: 0 }],
      },
      {
        id: "mobility",
        type: "mobility",
        goal: "Retour au calme",
        intensity: "easy",
        durationMin: 10,
        items: [{ name: "Étirements hanches/dos", sets: 1, workS: 600, restS: 0 }],
      },
    ],
    guardrailsApplied: ["fallback_safe"],
    analytics: {
      targetMetrics: { distance_m: 2000, total_reps: null, tonnage_kg: null },
      rationale: "Fallback local suite à erreur IA",
    },
  };

  return { session, aiV2 };
}
