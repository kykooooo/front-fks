// utils/nameHelpers.ts
//
// Revue web post-É1.5 (point 4) : un compte a affiché "Kyllian dnkxjeb" sur
// le Home. Le champ d'inscription (RegisterScreen.tsx) est un "Prénom" (un
// seul mot attendu), mais rien ne l'empêchait de contenir plus — saisie
// libre, copier/coller, ou autofill OS qui insère un second mot inattendu
// (le champ n'avait pas de `textContentType` iOS scopé, corrigé en même
// temps que cet helper). Peu importe la cause exacte de CE compte précis :
// on n'affiche plus jamais qu'un seul mot, nulle part, donc aucun fragment
// (id, alias email, etc.) ne peut plus fuiter dans l'UI.
export function getFirstName(name?: string | null, fallback = "joueur"): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0];
}
