export type Warmup = {
  title: string;
  duration: string;
  steps: string[];
};

// Base library (sans matériel spécifique, mini-band facultatif)
const WARMUPS: Record<string, Warmup> = {
  strength: {
    title: "Échauffement muscu (force)",
    duration: "8-10 min",
    steps: [
      "Cardio 2 min : vélo ou jog léger",
      "Mobilité 2 min : ankle rocks 10/10 + hip opener 6/6",
      "Activation 2 min : glute bridge 10 + dead bug 6/6",
      "Ramp sets 2-4 min : 2-3 séries de montée en charge sur le lift principal",
    ],
  },
  run: {
    title: "Échauffement course",
    duration: "8-10 min",
    steps: [
      "Footing 5-6 min (progressif)",
      "Drills 2 min : leg swings 10/10 + A-skips 2×15 m",
      "Strides 1-2 min : 2-3 accélérations de 15-20 s (récup marche 40-60 s)",
    ],
  },
  plyo: {
    title: "Échauffement plyo / COD",
    duration: "8-10 min",
    steps: [
      "Jog + déplacements 3 min (avant/arrière/latéral)",
      "Tendon/cheville 2 min : pogo 2×20 s + calf raises 10",
      "Activation 2 min : band lateral walk 10/10 + single-leg hinge 5/5",
      "Décélération 1-3 min : 3-5 reps (10 m accel → freinage propre en 3-4 appuis)",
    ],
  },
  circuit: {
    title: "Échauffement circuit / cardio mix",
    duration: "8-10 min",
    steps: [
      "Cardio 3 min : vélo ou jog léger",
      "Mobilité 2 min : ankle rocks 10/10 + thoracique (T-spine) 6/6",
      "Activation 2 min : glute bridge 10 + dead bug 6/6",
      "Mouvements dynamiques 2-3 min : squats aériens + fentes marchées",
    ],
  },
  mobility: {
    title: "Échauffement mobilité / core",
    duration: "5-8 min",
    steps: [
      "Cardio léger 2 min : marche rapide ou jog doux",
      "Mobilité 3 min : hanches/chevilles/T-spine en contrôle",
      "Core léger 1-2 min : dead bug 6/6 + side plank 20-30 s/side",
    ],
  },
};

type Focus =
  | "run"
  | "strength"
  | "speed"
  | "circuit"
  | "plyo"
  | "mobility"
  | "core";

export function getWarmupForSession(session: { focus_primary?: string | null; focus_secondary?: string | null }):
  | Warmup
  | null {
  const focus = (session.focus_primary ?? "").toLowerCase() as Focus;
  const secondary = (session.focus_secondary ?? "").toLowerCase() as Focus;

  if (focus === "strength") return WARMUPS.strength;
  if (focus === "run") return WARMUPS.run;
  if (focus === "plyo" || focus === "speed") return WARMUPS.plyo;
  if (focus === "circuit") return WARMUPS.circuit;
  if (focus === "mobility" || focus === "core") return WARMUPS.mobility;

  // fallback sur secondary si primary non reconnu
  if (secondary === "strength") return WARMUPS.strength;
  if (secondary === "run") return WARMUPS.run;
  if (secondary === "plyo" || secondary === "speed") return WARMUPS.plyo;
  if (secondary === "circuit") return WARMUPS.circuit;
  if (secondary === "mobility" || secondary === "core") return WARMUPS.mobility;

  return null;
}

