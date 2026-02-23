import type { FKS_NextSessionV2 } from "./types";

type PlayerProfile = {
  position?: string | null;
  level?: string | null;
  dominant_foot?: string | null;
  main_objective?: string | null;
};

type SelectionDebug = {
  cap?: "easy" | "moderate" | "hard";
  available_time_min?: number | null;
  matchToday?: boolean;
  matchTomorrow?: boolean;
  clubToday?: boolean;
  clubTomorrow?: boolean;
  feedback?: { cap_override?: "easy" | "moderate" | null } | null;
  fatigue_trend?: string | null;
  pool_health_failures?: Array<unknown>;
  reasons?: string[];
};

export type ResetExplain = {
  title: string;
  subtitle: string;
  reasons: string[];
  examples: string[];
};

const normalizeReasons = (input: unknown): string[] =>
  Array.isArray(input) ? input.map((r) => String(r)) : [];

const hasPrefix = (reasons: string[], prefix: string) =>
  reasons.some((r) => r.startsWith(prefix));

const hashString = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const pickVaried = (items: string[], count: number, seed: number) => {
  if (!items.length) return [];
  if (items.length <= count) return items.slice(0, count);
  const start = seed % items.length;
  const rotated = [...items.slice(start), ...items.slice(0, start)];
  return rotated.slice(0, count);
};

const locationLabel = (loc?: string | null) => {
  if (!loc) return "terrain";
  if (loc === "gym") return "salle";
  if (loc === "pitch" || loc === "field") return "terrain";
  if (loc === "home") return "maison";
  return loc;
};

export function buildResetExplain(
  v2: FKS_NextSessionV2,
  debug?: any,
  location?: string,
  profile?: PlayerProfile | null
): ResetExplain {
  const selection: SelectionDebug | null =
    (v2?.selection_debug as SelectionDebug | undefined) ??
    (debug?.v2?.selection_debug as SelectionDebug | undefined) ??
    (debug?.debug?.output_parsed?.selection_debug as SelectionDebug | undefined) ??
    (debug?.debug?.selection_debug as SelectionDebug | undefined) ??
    null;

  const reasonsRaw = normalizeReasons(selection?.reasons ?? v2?.selection_debug?.reasons);

  const capEasy = selection?.cap === "easy" || reasonsRaw.includes("intensity_cap:easy");
  const capModerate = selection?.cap === "moderate" || reasonsRaw.includes("intensity_cap:moderate");
  const feedbackCap =
    Boolean(selection?.feedback?.cap_override) || hasPrefix(reasonsRaw, "feedback:cap_override");
  const match = Boolean(selection?.matchToday || selection?.matchTomorrow || reasonsRaw.includes("match_window_safe"));
  const club = Boolean(selection?.clubToday || selection?.clubTomorrow || reasonsRaw.includes("club_today_micro"));
  const poolIssue =
    (Array.isArray(selection?.pool_health_failures) && selection?.pool_health_failures.length > 0) ||
    hasPrefix(reasonsRaw, "pool_health");
  const timeLow =
    typeof selection?.available_time_min === "number" && selection.available_time_min <= 20;
  const fatigueTrend = selection?.fatigue_trend;

  const reasons: string[] = [];
  if (capEasy) reasons.push("Fatigue élevée : séance légère pour récupérer.");
  else if (capModerate) reasons.push("Charge modérée : on évite d'en rajouter trop aujourd'hui.");

  if (feedbackCap) reasons.push("Tes derniers retours étaient durs, on allège.");
  if (match) reasons.push("Match proche : priorité à la fraîcheur.");
  if (club) reasons.push("Entraînement club proche : on protège la récup.");
  if (timeLow) reasons.push("Temps dispo court : format reset plus court.");
  if (poolIssue) reasons.push("Contraintes de matériel/contraintes trop fortes : reset sûr.");

  if (!reasons.length) {
    reasons.push("Reset choisi pour sécuriser ta progression aujourd'hui.");
  }

  const position = profile?.position?.trim() || "joueur";
  const objective = (profile?.main_objective ?? "").toString().toLowerCase();
  const place = locationLabel(location || v2.location);
  const duration = v2.duration_min != null ? `${v2.duration_min} min` : "12–16 min";
  const seed = hashString(
    `${v2.archetype_id ?? ""}|${selection?.cap ?? ""}|${position}|${objective}|${duration}`
  );

  const pool: string[] = [];
  if (match) {
    pool.push(
      `Exemple : ${position} avec match demain → reset pour garder du jus.\nSéance : ${duration} (${place}).\nBut : arriver frais au match.`
    );
  }
  if (capEasy || fatigueTrend) {
    pool.push(
      `Exemple : ${position} qui enchaîne 3 grosses séances → on allège.\nSéance : ${duration}, légère.\nBut : recharger sans perdre le rythme.`
    );
  }
  if (feedbackCap) {
    pool.push(
      `Exemple : ${position} qui a mis RPE 9-10 deux fois → reset.\nSéance : ${duration} (${place}).\nBut : éviter le surmenage.`
    );
  }
  if (poolIssue || timeLow) {
    pool.push(
      `Exemple : ${position} avec peu de matériel ou 15 min dispo → reset court.\nSéance : ${duration} (${place}).\nBut : rester actif sans risque.`
    );
  }
  if (objective.includes("blessure") || objective.includes("reprise")) {
    pool.push(
      `Exemple : ${position} en reprise → reset pour éviter le surmenage.\nSéance : ${duration}, légère.\nBut : reprendre proprement.`
    );
  }
  if (!pool.length) {
    pool.push(
      `Exemple : ${position} en semaine chargée → reset contrôlé.\nSéance : ${duration} (${place}).\nBut : garder la récup.`
    );
  }

  const locationText = place ? `(${place})` : "";

  return {
    title: "Pourquoi reset ?",
    subtitle: locationText
      ? `Séance légère pensée pour protéger ta récup ${locationText}.`
      : "Séance légère pensée pour protéger ta récup.",
    reasons: reasons.slice(0, 3),
    examples: pickVaried(pool, 2, seed),
  };
}
