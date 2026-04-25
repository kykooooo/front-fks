// screens/prebuilt/prebuiltConfig.ts
import { Ionicons } from "@expo/vector-icons";

// ─── Types ────────────────────────────────────────────────────────

/** Exercice structuré dans une routine */
export type RoutineExercise = {
  name: string;              // Nom FR cohérent avec exerciseBank
  sets?: number;
  reps?: number | string;    // 8, "8-10", "30s", "max"
  rest_s?: number;
  tempo?: string;            // "3-1-1-0"
  notes?: string;            // Consigne coaching courte
};

/** Bloc regroupant des exercices liés */
export type RoutineBlock = {
  title: string;             // "Activation bas du corps"
  exercises: RoutineExercise[];
};

export type RoutineCategory =
  | "AVANT L'EFFORT"
  | "APRÈS L'EFFORT"
  | "JOUR DE MATCH"
  | "MOBILITÉ"
  | "PRÉVENTION"
  | "CIRCUITS";

export type Prebuilt = {
  id: string;                               // "avant-reveil-express" (unique, stable)
  category: RoutineCategory;
  title: string;
  intensity: "easy" | "moderate" | "hard";
  durationMin: number;                      // nombre exact en minutes
  objective: string;
  blocks: RoutineBlock[];                   // exercices structurés
  focus?: "run" | "strength" | "speed" | "circuit" | "plyo" | "mobility";
  location?: "gym" | "pitch" | "home";
  equipment?: string[];
  tags?: string[];
  level?: string;
  coaching?: string[];                      // conseils coaching (ex-expectations)
  impactsTsb: boolean;                      // true = compte dans la charge
  rpeTarget?: number;                       // obligatoire si impactsTsb
};

// ─── Catégories ───────────────────────────────────────────────────

export type CategoryConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  tagline: string;
};

export const CATEGORY_CONFIG: Record<RoutineCategory, CategoryConfig> = {
  "AVANT L'EFFORT": {
    icon: "flash",
    gradient: ["#f59e0b", "#fbbf24"],
    tagline: "Prépare ton corps avant l'effort",
  },
  "APRÈS L'EFFORT": {
    icon: "leaf",
    gradient: ["#10b981", "#34d399"],
    tagline: "Récupère mieux, progresse plus vite",
  },
  "JOUR DE MATCH": {
    icon: "football",
    gradient: ["#3b82f6", "#60a5fa"],
    tagline: "Le bon geste au bon moment",
  },
  "MOBILITÉ": {
    icon: "body",
    gradient: ["#8b5cf6", "#a78bfa"],
    tagline: "Gagne en amplitude, évite les raideurs",
  },
  "PRÉVENTION": {
    icon: "shield-checkmark",
    gradient: ["#ef4444", "#f87171"],
    tagline: "Protège-toi des blessures classiques",
  },
  "CIRCUITS": {
    icon: "barbell",
    gradient: ["#e11d48", "#fb7185"],
    tagline: "Vrais entraînements complémentaires",
  },
};

export const CATEGORY_ORDER: RoutineCategory[] = [
  "AVANT L'EFFORT",
  "APRÈS L'EFFORT",
  "JOUR DE MATCH",
  "MOBILITÉ",
  "PRÉVENTION",
  "CIRCUITS",
];

// ─── Helpers ──────────────────────────────────────────────────────

export const INTENSITY_LABEL: Record<string, string> = {
  easy: "Facile",
  moderate: "Modéré",
  hard: "Intense",
};

export const INTENSITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  easy: "sunny-outline",
  moderate: "flame-outline",
  hard: "flash",
};

export const INTENSITY_COLOR: Record<string, string> = {
  easy: "#10b981",
  moderate: "#f59e0b",
  hard: "#ef4444",
};

export const LOCATION_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  gym: "barbell-outline",
  pitch: "football-outline",
  home: "home-outline",
};

export const LOCATION_LABEL: Record<string, string> = {
  gym: "Salle",
  pitch: "Terrain",
  home: "Maison",
};

export const intensityRank: Record<Prebuilt["intensity"], number> = {
  hard: 0,
  moderate: 1,
  easy: 2,
};
