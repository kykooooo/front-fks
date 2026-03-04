// screens/prebuilt/prebuiltConfig.ts
import { Ionicons } from "@expo/vector-icons";

export type CategoryConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  tagline: string;
};

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  ACTIVATION: {
    icon: "flash",
    gradient: ["#f59e0b", "#fbbf24"],
    tagline: "Réveille ton corps avant l'effort",
  },
  RÉCUPÉRATION: {
    icon: "leaf",
    gradient: ["#10b981", "#34d399"],
    tagline: "Récupère mieux, progresse plus vite",
  },
  "MOBILITÉ EXPRESS": {
    icon: "body",
    gradient: ["#8b5cf6", "#a78bfa"],
    tagline: "Gagne en amplitude en quelques minutes",
  },
  PRÉVENTION: {
    icon: "shield-checkmark",
    gradient: ["#ef4444", "#f87171"],
    tagline: "Protège-toi des blessures classiques",
  },
  "MATCH DAY": {
    icon: "football",
    gradient: ["#3b82f6", "#60a5fa"],
    tagline: "Routines spéciales jour de match",
  },
  "PACK 7 JOURS": {
    icon: "calendar",
    gradient: ["#14b8a6", "#2dd4bf"],
    tagline: "Programme mobilité complet sur 7 jours",
  },
  DÉFIS: {
    icon: "trophy",
    gradient: ["#ff7a1a", "#ff9a4a"],
    tagline: "Teste tes limites et progresse",
  },
};

export type Prebuilt = {
  category: string;
  title: string;
  intensity: "easy" | "moderate" | "hard";
  duration: string;
  objective: string;
  detail: string[];
  focus?: "run" | "strength" | "speed" | "circuit" | "plyo" | "mobility";
  location?: "gym" | "pitch" | "home";
  equipment?: string[];
  tags?: string[];
  level?: string;
  expectations?: string[];
  rpe_target?: number;
};

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

export const CATEGORY_ORDER = [
  "ACTIVATION",
  "RÉCUPÉRATION",
  "MOBILITÉ EXPRESS",
  "PRÉVENTION",
  "MATCH DAY",
  "PACK 7 JOURS",
  "DÉFIS",
];

export const intensityRank: Record<Prebuilt["intensity"], number> = {
  hard: 0,
  moderate: 1,
  easy: 2,
};

export const parseDurationMin = (raw?: string) => {
  if (!raw) return undefined;
  const matches = raw.match(/\d+/g);
  if (!matches || matches.length === 0) return undefined;
  const values = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
  if (!values.length) return undefined;
  if (values.length === 1) return values[0];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg);
};
