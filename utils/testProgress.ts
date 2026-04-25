// utils/testProgress.ts
// Extrait les 3 tests les plus récemment mis à jour avec leur delta vs l'avant-dernière mesure.
// Utilisé par HomeProgressHero pour afficher la progression concrète en hero du Home.

import {
  FIELD_BY_KEY,
  SHORT_LABELS,
  getGroupConfig,
  type FieldKey,
  type TestEntry,
} from "../screens/tests/testConfig";

export type ProgressItem = {
  fieldKey: FieldKey;
  label: string;
  shortLabel: string;
  unit: string;
  group: string;
  groupIcon: string;
  groupTint: string;
  currentValue: number;
  previousValue: number | null;
  delta: number | null;
  /** true = progression (meilleur qu'avant), false = régression, null = pas de comparatif */
  isImprovement: boolean | null;
  /** true si la mesure courante est un record personnel (meilleure que toutes les précédentes) */
  isPersonalRecord: boolean;
  /** timestamp de la mesure la plus récente */
  updatedAt: number;
};

function getFieldValue(entry: TestEntry, key: FieldKey): number | undefined {
  const value = entry[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Retourne les `limit` tests les plus récemment enregistrés avec leur delta.
 * Pour chaque test (FieldKey) on prend la dernière mesure et on compare à la précédente.
 * Les entries DOIVENT être triées par ts décroissant (plus récent d'abord).
 */
export function computeTopProgress(entries: TestEntry[], limit = 3): ProgressItem[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => b.ts - a.ts);
  const seen = new Set<FieldKey>();
  const result: ProgressItem[] = [];

  // Parcours par entry (du plus récent au plus ancien) — première occurrence = mesure la plus récente.
  for (const entry of sorted) {
    for (const key of Object.keys(FIELD_BY_KEY) as FieldKey[]) {
      if (seen.has(key)) continue;
      const current = getFieldValue(entry, key);
      if (current === undefined) continue;

      // Cherche la valeur précédente dans les entries plus anciennes.
      let previous: number | null = null;
      for (const olderEntry of sorted) {
        if (olderEntry.ts >= entry.ts) continue;
        const v = getFieldValue(olderEntry, key);
        if (v !== undefined) {
          previous = v;
          break;
        }
      }

      const def = FIELD_BY_KEY[key];
      const group = def.group;
      const groupCfg = getGroupConfig(group);
      const delta = previous !== null ? current - previous : null;
      const isImprovement =
        delta === null
          ? null
          : def.lowerIsBetter
            ? delta < 0
            : delta > 0;

      // Record personnel : le current bat toutes les mesures précédentes pour ce field.
      // Nécessite au moins 1 mesure antérieure (sinon "nouveau", pas "record").
      let isPersonalRecord = false;
      if (previous !== null) {
        const historicalValues: number[] = [];
        for (const olderEntry of sorted) {
          if (olderEntry.ts >= entry.ts) continue;
          const v = getFieldValue(olderEntry, key);
          if (v !== undefined) historicalValues.push(v);
        }
        if (historicalValues.length > 0) {
          isPersonalRecord = def.lowerIsBetter
            ? current < Math.min(...historicalValues)
            : current > Math.max(...historicalValues);
        }
      }

      result.push({
        fieldKey: key,
        label: def.label,
        shortLabel: SHORT_LABELS[key] ?? def.label,
        unit: def.unit,
        group,
        groupIcon: groupCfg.icon,
        groupTint: groupCfg.tint,
        currentValue: current,
        previousValue: previous,
        delta,
        isImprovement,
        isPersonalRecord,
        updatedAt: entry.ts,
      });

      seen.add(key);
      if (result.length >= limit) return result;
    }
    if (result.length >= limit) break;
  }

  return result;
}

/**
 * Formatte une valeur selon son unité (cm, s, m, kg).
 * Règle : secondes à 2 décimales, kg/cm/m entiers.
 */
export function formatValue(value: number, unit: string): string {
  if (unit === "s") return value.toFixed(2);
  if (unit === "") return String(Math.round(value));
  return `${Math.round(value)}`;
}

/**
 * Formatte un delta avec signe. Pour lowerIsBetter, un delta négatif = progression,
 * donc on inverse visuellement le signe pour que le joueur voie "−0.12s (↓)" comme un gain.
 */
export function formatDelta(delta: number, unit: string, lowerIsBetter: boolean): string {
  const abs = Math.abs(delta);
  const formatted = unit === "s" ? abs.toFixed(2) : String(Math.round(abs));
  // Pour lowerIsBetter, un delta négatif (temps réduit) = mieux → on affiche avec flèche vers le bas
  const arrow = lowerIsBetter
    ? delta < 0
      ? "↓"
      : delta > 0
        ? "↑"
        : "="
    : delta > 0
      ? "↑"
      : delta < 0
        ? "↓"
        : "=";
  return `${arrow}${formatted}${unit}`;
}
