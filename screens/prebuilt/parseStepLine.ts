// screens/prebuilt/parseStepLine.ts
// Parseur d'affichage pur pour les lignes de `detail[]` (prebuiltSessions.ts).
// Motifs supportés : "Nom: dosage — consigne" (parfois sans consigne)
// et "Nom — consigne" (sans dosage, fréquent dans les circuits).
// Ne modifie jamais la donnée source — utilisé uniquement pour l'affichage.

export type ParsedStep = {
  name?: string;
  dosage?: string;
  consigne?: string;
  raw: string;
};

const DASH = "—";
// Au-delà, la partie avant le tiret n'est plus un "nom" mais une phrase :
// on préfère le repli brut plutôt qu'un titre interminable.
const MAX_DASH_NAME_LENGTH = 60;

export function parseStepLine(raw: string): ParsedStep {
  const line = raw.trim();
  const colonIdx = line.indexOf(":");
  const dashIdx = line.indexOf(DASH);

  // Pas de ":" exploitable (absent, ou situé après le premier tiret donc
  // appartenant à la consigne) : tenter le motif "Nom — consigne".
  if (colonIdx === -1 || (dashIdx !== -1 && dashIdx < colonIdx)) {
    if (dashIdx !== -1) {
      const name = line.slice(0, dashIdx).trim();
      const consigne = line.slice(dashIdx + 1).trim();
      if (name && name.length <= MAX_DASH_NAME_LENGTH && consigne) {
        return { name, consigne, raw: line };
      }
    }
    return { raw: line };
  }

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
