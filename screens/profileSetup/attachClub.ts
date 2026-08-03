// screens/profileSetup/attachClub.ts
//
// Ordre de sauvegarde de l'inscription. Ce module minuscule existe pour une
// seule raison, et elle est chère : dans la version précédente, le code club
// était résolu AVANT l'écriture du profil. Un code refusé (ou une simple
// coupure réseau) faisait remonter l'erreur au catch global de l'écran, qui
// affichait « Impossible d'enregistrer le profil » — et le joueur perdait
// l'intégralité de son questionnaire, alors que son profil n'avait aucun
// problème.
//
// La règle est donc inversée et VERROUILLÉE par un test :
//   1. le profil est enregistré D'ABORD, toujours, indépendamment du club ;
//   2. le rattachement au club est TENTÉ ENSUITE, et son échec ne peut plus
//      annuler ni salir l'enregistrement du profil ;
//   3. un code refusé produit un message clair, en français, et le joueur
//      continue — avec ou sans club — sans ressaisir quoi que ce soit.

export type AttachClubStatus =
  | "skipped" // aucun code saisi : rien à tenter
  | "joined" // rattachement réussi
  | "failed"; // code refusé / réseau : le profil reste enregistré

export type AttachClubOutcome = {
  status: AttachClubStatus;
  clubId: string | null;
  clubName: string | null;
  /** Message FR à afficher au joueur quand `status === "failed"`. */
  message: string | null;
};

export type JoinAttempt =
  | { ok: true; clubId: string; clubName: string | null; alreadyMember: boolean }
  | { ok: false; reason: string; message: string };

export type SaveProfileThenAttachClubDeps = {
  /** Écriture du profil. Si elle échoue, l'erreur remonte : c'est le seul vrai échec bloquant. */
  saveProfile: () => Promise<void>;
  /** Appel serveur de rattachement. Ne doit jamais lever (cf. services/clubInvites). */
  joinClub: (code: string) => Promise<JoinAttempt>;
};

const FALLBACK_MESSAGE =
  "Ton profil est enregistré, mais le code club n'a pas pu être vérifié. Tu pourras réessayer depuis Profil.";

/**
 * Enregistre le profil PUIS tente le rattachement. Ne lève que si
 * l'enregistrement du profil échoue.
 */
export async function saveProfileThenAttachClub(
  deps: SaveProfileThenAttachClubDeps,
  rawCode: string,
): Promise<AttachClubOutcome> {
  // 1. Le profil d'abord. Sans exception : même quand un code est saisi.
  await deps.saveProfile();

  const code = String(rawCode ?? "").trim();
  if (!code) {
    return { status: "skipped", clubId: null, clubName: null, message: null };
  }

  // 2. Le club ensuite. Toute panne ici est contenue : elle ne peut plus
  //    remonter dans le catch global de l'écran et faire croire à une perte.
  let attempt: JoinAttempt;
  try {
    attempt = await deps.joinClub(code);
  } catch {
    return { status: "failed", clubId: null, clubName: null, message: FALLBACK_MESSAGE };
  }

  if (attempt.ok) {
    return {
      status: "joined",
      clubId: attempt.clubId,
      clubName: attempt.clubName,
      message: null,
    };
  }

  return {
    status: "failed",
    clubId: null,
    clubName: null,
    message: attempt.message || FALLBACK_MESSAGE,
  };
}
