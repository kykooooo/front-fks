// screens/prebuilt/parseStepLine.ts
// Parseur d'affichage pur pour les lignes de `detail[]` (prebuiltSessions.ts).
// Motif attendu : "Nom: dosage — consigne" (parfois sans consigne).
// Ne modifie jamais la donnée source — utilisé uniquement pour l'affichage.

export type ParsedStep = {
  name?: string;
  dosage?: string;
  consigne?: string;
  raw: string;
};

const DASH = "—";

export function parseStepLine(raw: string): ParsedStep {
  const line = raw.trim();
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return { raw: line };

  const dashIdx = line.indexOf(DASH);
  // Un tiret avant le ":" (ex: "ÉCHAUFFEMENT — 5 min : ...") signifie que le
  // ":" appartient à la consigne, pas au motif "Nom: dosage" -> repli.
  if (dashIdx !== -1 && dashIdx < colonIdx) return { raw: line };

  const name = line.slice(0, colonIdx).trim();
  if (!name) return { raw: line };

  const rest = line.slice(colonIdx + 1);
  if (dashIdx === -1) {
    const dosage = rest.trim();
    return dosage ? { name, dosage, raw: line } : { raw: line };
  }

  const dashInRest = rest.indexOf(DASH);
  const dosage = rest.slice(0, dashInRest).trim();
  if (!dosage) return { raw: line };
  const consigne = rest.slice(dashInRest + 1).trim();

  return { name, dosage, consigne: consigne || undefined, raw: line };
}
