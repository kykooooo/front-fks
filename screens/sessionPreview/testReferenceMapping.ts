// screens/sessionPreview/testReferenceMapping.ts
//
// Mapping PUR "valeur de test terrain -> ligne de reference sous un exercice".
// Affichage seul : jamais de recommandation inventee ("mets X kg"), uniquement
// le dernier chiffre mesure par le joueur ("Ta reference test : ..."). Coach
// honnete : en cas de doute sur le lien exercice <-> test, on n'affiche rien
// (silence > fausse association).
//
// Mapping volontairement conservateur (cf. chantier E3 individualisation) :
//  - Force : goblet squat / split squat (inclut bulgarian split squat) -> la
//    charge/reps testees pour ce mouvement precis.
//  - Vitesse : sprints/accelerations qui portent une distance EXPLICITE
//    (10/20/30 m) dans leur id ou leur nom -> le chrono teste pour cette
//    distance. Aucun autre mouvement (CMJ, agilite, endurance...) n'a de regle
//    ici : ce sont des tests "affichage/suivi seulement" cote moteur (design
//    doc §4.2), donc on ne leur invente pas de lien exercice non plus.

import type { BlockItem } from "./sessionPreviewConfig";

/** Sous-ensemble de TestEntry pertinent pour l'affichage des references. */
export type TestReferenceValues = {
  gobletKg?: number;
  gobletReps?: number;
  splitKg?: number;
  splitReps?: number;
  sprint10s?: number;
  sprint20s?: number;
  sprint30s?: number;
};

const SPRINT_KEYS: Record<"10" | "20" | "30", keyof TestReferenceValues> = {
  "10": "sprint10s",
  "20": "sprint20s",
  "30": "sprint30s",
};

const isPositiveFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/** Formate un temps en secondes avec la virgule francaise ("1,90"). */
const formatSecondsFr = (value: number): string => value.toFixed(2).replace(".", ",");

const itemSearchText = (item: BlockItem): string =>
  `${item?.exerciseId ?? ""} ${item?.id ?? ""} ${item?.name ?? ""}`.toLowerCase();

/**
 * Retourne la ligne de reference de test a afficher sous un exercice de seance,
 * ou `null` si aucun lien evident n'existe (mouvement non couvert, pas de test
 * enregistre pour ce mouvement, ou distance sprint ambigue).
 *
 * Pure : ne lit aucun store, aucune horloge. `tests` est deja la derniere
 * valeur connue par cle (cf. `pickLatestTestValues`).
 */
export function getItemTestReference(
  item: BlockItem | null | undefined,
  tests: TestReferenceValues | null | undefined
): string | null {
  if (!item || !tests) return null;
  const text = itemSearchText(item);
  if (!text.trim()) return null;

  // Force : goblet squat (verifie avant "split" : aucun recouvrement possible,
  // mais l'ordre documente la priorite si jamais un id combinait les deux mots).
  if (text.includes("goblet")) {
    if (!isPositiveFiniteNumber(tests.gobletKg)) return null;
    const reps = isPositiveFiniteNumber(tests.gobletReps) ? tests.gobletReps : null;
    return `Ta référence test : ${tests.gobletKg} kg${reps ? ` × ${reps}` : ""}`;
  }

  // Force : split squat (classique ou bulgarian split squat -> meme test).
  if (text.includes("split")) {
    if (!isPositiveFiniteNumber(tests.splitKg)) return null;
    const reps = isPositiveFiniteNumber(tests.splitReps) ? tests.splitReps : null;
    return `Ta référence test : ${tests.splitKg} kg${reps ? ` × ${reps}` : ""}`;
  }

  // Vitesse : sprint/acceleration avec distance EXPLICITE 10/20/30 m dans l'id/nom.
  // Les ids backend sont en snake_case ("sprint_accel_10m") : le "m" peut donc
  // suivre directement un underscore, pas seulement un espace -> pas de \b classique.
  // Lookbehind/lookahead pour eviter les faux positifs sur des distances plus
  // longues qui contiendraient la sous-chaine ("110m", "230m", "50m"...).
  if (text.includes("sprint") || text.includes("accel") || text.includes("flying") || text.includes("vitesse")) {
    const match = text.match(/(?<![0-9])(10|20|30)m(?![a-z0-9])/);
    if (!match) return null; // distance ambigue (cotes, ins&outs 50m...) -> silence
    const distance = match[1] as "10" | "20" | "30";
    const key = SPRINT_KEYS[distance];
    const value = tests[key];
    if (!isPositiveFiniteNumber(value)) return null;
    return `Ton chrono test ${distance} m : ${formatSecondsFr(value)} s`;
  }

  return null;
}

/**
 * Reduit une liste d'entrees de tests terrain (triees ou non) vers la derniere
 * valeur connue par cle pertinente pour l'affichage. `entries` peut venir tel
 * quel du hook `useTestsStorage` (deja triee desc par ts) ou d'une source non
 * triee -> on trie nous-memes par `ts` desc pour rester correct dans tous les cas.
 */
export function pickLatestTestValues(
  entries: ReadonlyArray<{ ts?: number } & Partial<TestReferenceValues>> | null | undefined
): TestReferenceValues {
  const result: TestReferenceValues = {};
  if (!Array.isArray(entries) || entries.length === 0) return result;

  const keys: (keyof TestReferenceValues)[] = [
    "gobletKg",
    "gobletReps",
    "splitKg",
    "splitReps",
    "sprint10s",
    "sprint20s",
    "sprint30s",
  ];

  const sorted = [...entries].sort((a, b) => (Number(b?.ts) || 0) - (Number(a?.ts) || 0));
  for (const entry of sorted) {
    for (const key of keys) {
      if (result[key] !== undefined) continue;
      const value = entry?.[key];
      if (isPositiveFiniteNumber(value)) result[key] = value;
    }
  }
  return result;
}
