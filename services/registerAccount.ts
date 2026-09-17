// services/registerAccount.ts
//
// LA CRÉATION DE COMPTE, SORTIE DE L'ÉCRAN POUR ÊTRE EXÉCUTÉE EN TEST.
//
// Trois issues, et l'écran doit les DIRE différemment :
//   - `failed`            : le compte N'EXISTE PAS (erreur Firebase Auth) ;
//   - `created`           : compte créé ET document de départ écrit ;
//   - `created-degraded`  : le compte EXISTE, une opération secondaire a échoué
//                           (nom d'affichage, document de départ, chrono). Le
//                           questionnaire rattrape : ce n'est PAS un échec.
//
// ─── L'ÉCRITURE TARDIVE QUI N'ÉCRASE RIEN ──────────────────────────────────
// Dès que le compte existe, le navigateur racine bascule sur le questionnaire :
// cet appel continue de tourner derrière un écran démonté. Deux protections :
//
//  1. ORDRE. Le document de départ est mis en file IMMÉDIATEMENT après la
//     création du compte, avant toute attente (`updateProfile`, chrono). Le SDK
//     Firestore envoie les écritures d'un client dans l'ordre : celle du
//     questionnaire, forcément postérieure, passe après. Avant, elle n'était
//     lancée qu'APRÈS `await updateProfile` — un `updateProfile` lent la
//     faisait partir après la saisie du joueur.
//  2. CONTENU. Le document ne porte que ce que l'inscription SAIT (email, date
//     de création, prénom s'il a été donné). Il ne pose plus
//     `profileCompleted: false` ni un prénom `null` : même s'il atterrissait
//     tard, il ne pourrait ni rouvrir le questionnaire d'un profil finalisé, ni
//     effacer un prénom corrigé. (Absent = non complété : le navigateur lit
//     `!!data?.profileCompleted`.)
//
// Aucune saisie personnelle ne part en analytics : l'appelant ne reçoit qu'un
// statut et, en cas d'échec, le CODE Firebase.

export type RegisterDeps = {
  createUser: (email: string, password: string) => Promise<{ uid: string; email: string | null; raw: unknown }>;
  updateDisplayName: (user: unknown, displayName: string) => Promise<void>;
  writeStartDoc: (uid: string, data: Record<string, unknown>) => Promise<void>;
  markOnboardingStart: () => Promise<void>;
  serverTimestamp: () => unknown;
};

export type RegisterInput = { email: string; password: string; firstName: string };

export type RegisterOutcome =
  | { status: "created"; uid: string }
  | { status: "created-degraded"; uid: string; echecs: Array<"doc" | "displayName" | "chrono"> }
  | { status: "failed"; code: string };

const codeDe = (e: unknown): string =>
  e != null && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string"
    ? (e as { code: string }).code
    : "unknown";

export async function registerAccount(deps: RegisterDeps, input: RegisterInput): Promise<RegisterOutcome> {
  let compte: { uid: string; email: string | null; raw: unknown };
  try {
    compte = await deps.createUser(input.email, input.password);
  } catch (e) {
    return { status: "failed", code: codeDe(e) };
  }

  const prenom = input.firstName.trim();
  const echecs: Array<"doc" | "displayName" | "chrono"> = [];

  // 1. Mis en file TOUT DE SUITE (synchrone après la création) — cf. en-tête.
  const ecritureDoc = deps
    .writeStartDoc(compte.uid, {
      email: compte.email ?? input.email,
      ...(prenom ? { displayName: prenom, firstName: prenom } : {}),
      createdAt: deps.serverTimestamp(),
      updatedAt: deps.serverTimestamp(),
    })
    .catch(() => {
      echecs.push("doc");
    });

  // 2. Le reste, en parallèle : aucune de ces attentes ne retarde l'écriture.
  const chrono = deps.markOnboardingStart().catch(() => {
    echecs.push("chrono");
  });
  const nom = prenom
    ? deps.updateDisplayName(compte.raw, prenom).catch(() => {
        echecs.push("displayName");
      })
    : Promise.resolve();

  await Promise.all([ecritureDoc, chrono, nom]);

  // Le chrono seul est une mesure interne : son échec ne dégrade rien pour le joueur.
  const visibles = echecs.filter((e) => e !== "chrono");
  return visibles.length === 0
    ? { status: "created", uid: compte.uid }
    : { status: "created-degraded", uid: compte.uid, echecs };
}

/** Garde anti double-soumission, partagée par l'inscription et la finalisation. */
export function createSubmitGuard() {
  let enCours = false;
  return {
    /** Exécute `fn` sauf si une soumission est déjà en cours. Rend `undefined` si ignorée. */
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (enCours) return undefined;
      enCours = true;
      try {
        return await fn();
      } finally {
        enCours = false;
      }
    },
    get busy() {
      return enCours;
    },
  };
}
