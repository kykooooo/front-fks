import type { FKS_NextSessionV2 } from "./types";

type PlayerProfile = {
  position?: string | null;
  level?: string | null;
  dominant_foot?: string | null;
  main_objective?: string | null;
};

type Explain = {
  title: string;
  reasons: string[];
  examples: string[];
};

const normalize = (value?: string | null) => String(value ?? "").toLowerCase();

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

const pickCategory = (v2: FKS_NextSessionV2) => {
  const focus = normalize(v2.focus_primary);
  const intensity = normalize(v2.intensity);
  const archetype = normalize(v2.archetype_id);

  if (focus.includes("strength") || focus.includes("force")) return "strength";
  if (focus.includes("speed") || focus.includes("vitesse") || focus.includes("sprint")) return "speed";
  if (focus.includes("endurance") || focus.includes("engine") || focus.includes("tempo") || focus.includes("rsa")) return "endurance";
  if (focus.includes("plyo") || focus.includes("explos")) return "plyo";
  if (focus.includes("cod") || focus.includes("agility") || focus.includes("appui")) return "cod";
  if (focus.includes("mobility") || focus.includes("mobilite") || focus.includes("recovery")) return "mobility";

  if (archetype.includes("reset")) return "mobility";
  if (intensity.includes("easy")) return "mobility";

  return "general";
};

const formatIntensity = (raw?: string | null) => {
  const key = normalize(raw);
  if (key.includes("hard")) return "intense";
  if (key.includes("moderate")) return "modérée";
  if (key.includes("easy")) return "légère";
  return raw ?? "—";
};

const objectiveHint = (objective?: string | null) => {
  const key = normalize(objective);
  if (key.includes("vitesse") || key.includes("explos")) return "Objectif vitesse/explosivité.";
  if (key.includes("encaisser") || key.includes("charges")) return "Objectif résistance aux charges.";
  if (key.includes("blessure") || key.includes("reprise")) return "Objectif reprise progressive.";
  if (key.includes("forme")) return "Objectif forme sur la saison.";
  return null;
};

const positionLabel = (profile?: PlayerProfile | null) =>
  profile?.position?.trim() || "joueur";

const locationLabel = (loc?: string | null) => {
  if (!loc) return "terrain";
  if (loc === "gym") return "salle";
  if (loc === "pitch" || loc === "field") return "terrain";
  if (loc === "home") return "maison";
  return loc;
};

export function buildSessionExplain(v2: FKS_NextSessionV2, profile?: PlayerProfile | null): Explain {
  const category = pickCategory(v2);
  const reasons: string[] = [];

  if (v2.focus_primary) reasons.push(`Focus principal : ${v2.focus_primary}.`);
  if (v2.duration_min != null) reasons.push(`Durée : ${v2.duration_min} min.`);
  if (v2.intensity) reasons.push(`Intensité : ${formatIntensity(v2.intensity)}.`);
  const objective = objectiveHint(profile?.main_objective);
  if (objective) reasons.push(objective);

  const pos = positionLabel(profile);
  const place = locationLabel(v2.location);
  const duration = v2.duration_min != null ? `${v2.duration_min} min` : "20–30 min";
  const intensity = formatIntensity(v2.intensity);
  const seed = hashString(
    `${v2.archetype_id ?? ""}|${v2.focus_primary ?? ""}|${v2.intensity ?? ""}|${v2.duration_min ?? ""}|${pos}|${objective ?? ""}`
  );

  let pool: string[] = [];
  if (category === "strength") {
    pool = [
      `Exemple : ${pos} → force bas du corps pour tenir les duels.\nSéance : ${duration}, ${intensity} (${place}).\nBut : rester solide sur les contacts.`,
      `Exemple : ${pos} → force unilatérale pour accélérer et finir fort.\nSéance : ${duration}, ${intensity}.\nBut : gagner en stabilité et puissance.`,
      `Exemple : ${pos} → gainage + force pour rester solide à l'impact.\nSéance : ${duration}, ${intensity} (${place}).\nBut : mieux encaisser les chocs.`,
    ];
  } else if (category === "speed") {
    pool = [
      `Exemple : ${pos} → sprints courts + récup complète pour garder la vitesse.\nSéance : ${duration}, ${intensity} (${place}).\nBut : garder du jus sur les premières foulées.`,
      `Exemple : ${pos} → départs 10–20 m pour fermer les espaces.\nSéance : ${duration}, ${intensity}.\nBut : accélérer fort sur 2–3 appuis.`,
      `Exemple : ${pos} → accélérations courtes pour attaquer la profondeur.\nSéance : ${duration}, ${intensity} (${place}).\nBut : exploser sur les 10 premières mètres.`,
    ];
  } else if (category === "endurance") {
    pool = [
      `Exemple : ${pos} → blocs tempo pour tenir 90'.\nSéance : ${duration}, ${intensity}.\nBut : rester lucide en fin de match.`,
      `Exemple : ${pos} → efforts répétés montée/retour.\nSéance : ${duration}, ${intensity} (${place}).\nBut : répéter les efforts sans craquer.`,
      `Exemple : ${pos} → volume contrôlé pour rester propre techniquement.\nSéance : ${duration}, ${intensity}.\nBut : éviter la chute de niveau.`,
    ];
  } else if (category === "plyo") {
    pool = [
      `Exemple : ${pos} → sauts courts + appuis rapides pour le 1v1.\nSéance : ${duration}, ${intensity} (${place}).\nBut : gagner en explosivité.`,
      `Exemple : ${pos} → explosivité pour les appels en profondeur.\nSéance : ${duration}, ${intensity}.\nBut : accélérer sur les premiers appuis.`,
      `Exemple : ${pos} → puissance pour le duel aérien.\nSéance : ${duration}, ${intensity}.\nBut : sauts plus toniques et stables.`,
    ];
  } else if (category === "cod") {
    pool = [
      `Exemple : ${pos} → changements d'appuis propres en petit espace.\nSéance : ${duration}, ${intensity} (${place}).\nBut : tourner vite sans perdre l'équilibre.`,
      `Exemple : ${pos} → appuis bas pour défendre en 1v1.\nSéance : ${duration}, ${intensity}.\nBut : rester agressif et stable.`,
      `Exemple : ${pos} → relances rapides après changement de direction.\nSéance : ${duration}, ${intensity}.\nBut : repartir vite après un freinage.`,
    ];
  } else if (category === "mobility") {
    pool = [
      `Exemple : ${pos} → mobilité hanches/chevilles pour libérer le geste.\nSéance : ${duration}, ${intensity}.\nBut : bouger mieux sans douleur.`,
      `Exemple : ${pos} → lendemain de match : récup légère sans perdre le rythme.\nSéance : ${duration} (${place}).\nBut : relancer sans fatigue.`,
      `Exemple : ${pos} → reprise : séance légère pour relancer la machine.\nSéance : ${duration}, ${intensity}.\nBut : repartir proprement.`,
    ];
  } else {
    pool = [
      `Exemple : ${pos} → séance équilibrée pour rester complet.\nSéance : ${duration}, ${intensity} (${place}).\nBut : garder toutes les qualités.`,
      `Exemple : ${pos} → semaine chargée : volume contrôlé sans casser la récup.\nSéance : ${duration}, ${intensity}.\nBut : rester frais pour le match.`,
      `Exemple : ${pos} → retour de blessure : intensité adaptée.\nSéance : ${duration}, ${intensity}.\nBut : reprendre sans risque.`,
    ];
  }

  return {
    title: "Exemples concrets",
    reasons: reasons.slice(0, 3),
    examples: pickVaried(pool, 2, seed),
  };
}
