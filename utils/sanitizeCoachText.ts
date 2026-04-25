// Défense en profondeur côté frontend : même si le backend oublie un nettoyage
// (ancien cache, rollback, nouveau few-shot toxique), le joueur ne voit JAMAIS
// une phrase culpabilisante ou médicalisante.
//
// Règles alignées avec INJURY_IA_CHARTER.md (repo backend) :
//  - jamais de ton brutal ("arrête de te blesser")
//  - jamais de diagnostic médical ("tendinite", "périostite")
//  - jamais de dramatisation ("cassé", "déchiré")
//
// Le filtre remplace par une variante coach neutre ; il ne supprime pas le
// message (pour ne pas créer de carte vide).

type Replacement = { pattern: RegExp; replacement: string };

const TOXIC_REPLACEMENTS: Replacement[] = [
  { pattern: /arr[eé]te?s? de te blesser[^.!?]*/gi, replacement: "Renforce tes tissus pour tenir la saison" },
  { pattern: /tu te blesses?( toujours| souvent)?/gi, replacement: "tu protèges tes tissus" },
  { pattern: /\bne te blesse pas\b/gi, replacement: "protège-toi" },
  { pattern: /p[eé]riostite[s]? tibiale[s]?/gi, replacement: "gêne tibiale" },
  { pattern: /tendinite[s]?/gi, replacement: "gêne" },
  { pattern: /d[eé]chirure[s]?/gi, replacement: "gêne musculaire" },
  { pattern: /fracture[s]? de fatigue/gi, replacement: "surcharge osseuse" },
  // Lexique médical interdit côté joueur (charte IA)
  { pattern: /\bl[eé]sion[s]?\b/gi, replacement: "gêne" },
  { pattern: /\bpathologie[s]?\b/gi, replacement: "gêne" },
  { pattern: /\bdiagnostic[s]?\b/gi, replacement: "évaluation" },
  { pattern: /\bsympt[oô]me[s]?\b/gi, replacement: "signal" },
  { pattern: /\btraiter\b/gi, replacement: "renforcer" },
  { pattern: /\btraitement[s]?\b/gi, replacement: "travail adapté" },
  { pattern: /\bsoigner\b/gi, replacement: "récupérer" },
  { pattern: /\br[eé]parer\b/gi, replacement: "renforcer" },
  { pattern: /\bcass[eé]\b/gi, replacement: "fatigué" },
  { pattern: /t[’']es nul/gi, replacement: "garde le rythme" },
  // Messages techniques qui ne doivent jamais atteindre l'UI joueur
  { pattern: /une erreur technique est survenue[^.!?]*/gi, replacement: "Séance facile préparée aujourd'hui" },
  { pattern: /\berreur technique\b/gi, replacement: "séance d'activation" },
  { pattern: /\bfallback(s)?\b/gi, replacement: "séance de secours" },
  { pattern: /\bopenai\b/gi, replacement: "" },
];

export function sanitizeCoachText(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  let out = value;
  for (const { pattern, replacement } of TOXIC_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\s+/g, " ").replace(/\s+([.!?,;:])/g, "$1").trim();
  return out || null;
}

export function sanitizeCoachTextList(values: readonly (string | null | undefined)[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    const cleaned = sanitizeCoachText(v ?? "");
    if (typeof cleaned === "string" && cleaned.trim().length > 0) {
      out.push(cleaned);
    }
  }
  return out;
}
