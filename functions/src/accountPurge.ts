// functions/src/accountPurge.ts
//
// Logique PURE de la suppression de compte : quels documents CLUB purger pour
// un uid donné. Aucune dépendance Firebase — testée unitairement
// (tests/accountPurge.test.ts). La purge users/{uid} + sous-collections passe,
// elle, par recursiveDelete (voir deleteAccount.ts) et n'a pas besoin de liste.

/**
 * Nettoie et déduplique des candidats clubId (clubId du profil + memberships
 * découverts par collection group). Tolérant par construction : non-string,
 * vide, blanc ou pseudo-chemin (contient "/") → ignoré.
 */
export function collectClubIds(candidates: ReadonlyArray<unknown>): string[] {
  const out: string[] = [];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const id = candidate.trim();
    if (!id) continue;
    // Un clubId est un ID de document, jamais un chemin.
    if (id.includes("/")) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Chemins de documents CLUB à supprimer pour un joueur : son membership
 * (clubs/{clubId}/members/{uid}) et sa projection coach-safe
 * (clubs/{clubId}/playerSummaries/{uid}), dans chaque club découvert.
 * Les documents absents sont tolérés (un delete Firestore sur un doc
 * inexistant est un no-op) → fonction idempotente par nature.
 */
export function buildClubPurgePaths(
  uid: string,
  clubIdCandidates: ReadonlyArray<unknown>,
): string[] {
  const cleanUid = typeof uid === "string" ? uid.trim() : "";
  if (!cleanUid || cleanUid.includes("/")) return [];
  const paths: string[] = [];
  for (const clubId of collectClubIds(clubIdCandidates)) {
    paths.push(`clubs/${clubId}/members/${cleanUid}`);
    paths.push(`clubs/${clubId}/playerSummaries/${cleanUid}`);
  }
  return paths;
}
