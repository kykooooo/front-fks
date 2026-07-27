// firestore-tests/rules.clubOwnershipTransfer.test.ts
//
// LE TRANSFERT DE PROPRIÉTÉ — versant RÈGLES, contre les VRAIES règles jouées
// par l'émulateur.
//
// Le cœur de décision est testé ailleurs (`functions/tests/clubOwnership.test.ts`,
// sur un faux magasin). Ce fichier-ci répond à une autre question, et une seule :
//
//   « Ne simule pas une sécurité avec une simple écriture Firestore côté
//     client. » — est-ce qu'un client peut FABRIQUER un transfert, ou une partie
//     de transfert, sans passer par la Cloud Function ?
//
// La réponse doit être non, sur les DEUX écritures qui composent un transfert :
//   1. la DÉSIGNATION (`clubs/{clubId}.ownerUid`) ;
//   2. le RÔLE propriétaire d'autrui (`clubs/{clubId}/members/{autre}.role`).
//
// C'était un vrai trou avant ce lot : `allow update` sur le document club
// autorisait le propriétaire à écrire n'importe quel champ, `ownerUid` compris.
// Une seule requête cliente suffisait donc à fabriquer les DEUX incohérences que
// l'invariant refuse — désignation sans appartenance d'un côté, appartenance sans
// désignation de l'autre. La section A est ce trou, fermé et prouvé.
//
// Sections :
//   A. la désignation n'est plus écrivable par aucun client ;
//   B. le rôle propriétaire d'autrui ne l'est pas davantage (rappel + geste complet) ;
//   C. APRÈS un transfert : l'ancien perd exactement les droits du propriétaire
//      et garde exactement ceux de l'encadrant ; le nouveau les gagne ;
//   D. aucun droit ne survit par une désignation ORPHELINE.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { PROJECT_ID, CLUB_A, COACH_A, PLAYER_A1, PLAYER_A2, STRANGER, WEEK_KEY, seed } from "./fixtures";

let testEnv: RulesTestEnvironment;

/** Coach ordinaire du club A (jamais propriétaire). */
const COACH_A2 = "coachTransfertBis";

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST non défini — lancer via `npm run test:rules` (démarre l'émulateur Firestore).",
    );
  }
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, "..", "firestore.rules"), "utf8") },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const admin = (fn: Parameters<RulesTestEnvironment["withSecurityRulesDisabled"]>[0]) =>
  testEnv.withSecurityRulesDisabled(fn);

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv);
  await admin(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "clubs", CLUB_A, "members", COACH_A2), { uid: COACH_A2, role: "coach" });
    // Une directive existante : c'est le geste RÉSERVÉ au propriétaire (delete)
    // qui sert de témoin dans la section C.
    await setDoc(doc(db, "clubs", CLUB_A, "directives", "current"), {
      clubId: CLUB_A,
      objective: "prevention",
      instruction: "Consigne de test",
      createdBy: COACH_A,
    });
  });
});

/**
 * Pose, par l'admin (donc sans passer par les règles), l'état EXACT que la Cloud
 * Function produit : désignation + rôle du nouveau + rôle explicite de l'ancien.
 * C'est ce que la section C interroge — pas la façon dont on y arrive, mais ce
 * que la base autorise UNE FOIS qu'on y est.
 */
async function poseEtatApresTransfert(nouveau: string, ancien: string): Promise<void> {
  await admin(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "clubs", CLUB_A), { ownerUid: nouveau }, { merge: true });
    await setDoc(
      doc(db, "clubs", CLUB_A, "members", nouveau),
      { uid: nouveau, role: "owner", coachAccess: "revoked" },
      { merge: true },
    );
    await setDoc(
      doc(db, "clubs", CLUB_A, "members", ancien),
      { uid: ancien, role: "coach" },
      { merge: true },
    );
  });
}

/** Les gestes réservés au PROPRIÉTAIRE (au sens du prédicat complet). */
function gestesProprietaire(uid: string) {
  const db = asUser(uid);
  return {
    modifieClub: () => setDoc(doc(db, "clubs", CLUB_A), { teamGender: "male" }, { merge: true }),
    supprimeDirective: () => deleteDoc(doc(db, "clubs", CLUB_A, "directives", "current")),
    supprimeCadre: () => deleteDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)),
  };
}

/** Les gestes d'ENCADREMENT (propriétaire ET coach les ont). */
function gestesEncadrement(uid: string) {
  const db = asUser(uid);
  return {
    listeEffectif: () => getDocs(collection(db, "clubs", CLUB_A, "members")),
    litNotePrivee: () => getDoc(doc(db, "clubs", CLUB_A, "coachNotes", WEEK_KEY)),
    ecritCadre: () =>
      setDoc(
        doc(db, "clubs", CLUB_A, "weekContexts", "2026-07-20"),
        {
          weekKey: "2026-07-20",
          clubId: CLUB_A,
          createdBy: uid,
          trainingIntensity: "normal",
          weekGoal: "freshness",
        },
        { merge: true },
      ),
    ecritDirective: () =>
      setDoc(
        doc(db, "clubs", CLUB_A, "directives", "current"),
        { clubId: CLUB_A, objective: "prevention", instruction: "Test", createdBy: uid },
        { merge: true },
      ),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// A. LA DÉSIGNATION N'EST PLUS ÉCRIVABLE PAR UN CLIENT
// ═════════════════════════════════════════════════════════════════════════════

describe("A — clubs/{clubId}.ownerUid, fermé à tous les clients", () => {
  test("LE PROPRIÉTAIRE lui-même ne peut pas désigner quelqu'un d'autre", async () => {
    // C'était LE trou : une seule requête, et le club désignait un compte sans
    // appartenance propriétaire pendant que l'ancien gardait le rôle.
    await assertFails(updateDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { ownerUid: PLAYER_A1 }));
  });

  test("… ni par un merge, ni en se redésignant lui-même explicitement", async () => {
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { ownerUid: PLAYER_A1 }, { merge: true }),
    );
    // Réécrire la MÊME valeur passe (le résultat est inchangé) : la règle porte
    // sur le résultat, pas sur les clés touchées.
    await assertSucceeds(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { ownerUid: COACH_A }, { merge: true }),
    );
  });

  test("… ni l'EFFACER (un club sans propriétaire est aussi un état interdit)", async () => {
    await assertFails(updateDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { ownerUid: deleteField() }));
  });

  test("… ni en écrasant le document entier (setDoc sans merge)", async () => {
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { name: "Club A", ownerUid: PLAYER_A1 }),
    );
  });

  test("un COACH non propriétaire : refusé lui aussi", async () => {
    await assertFails(updateDoc(doc(asUser(COACH_A2), "clubs", CLUB_A), { ownerUid: COACH_A2 }));
  });

  test("un JOUEUR du club, et un inconnu : refusés", async () => {
    await assertFails(updateDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A), { ownerUid: PLAYER_A1 }));
    await assertFails(updateDoc(doc(asUser(STRANGER), "clubs", CLUB_A), { ownerUid: STRANGER }));
  });

  test("NON-RÉGRESSION : le propriétaire modifie toujours son club sans toucher la désignation", async () => {
    await assertSucceeds(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { teamGender: "male" }, { merge: true }),
    );
    await assertSucceeds(
      setDoc(
        doc(asUser(COACH_A), "clubs", CLUB_A),
        { coachAccessPolicy: "approval_required" },
        { merge: true },
      ),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. LE RÔLE PROPRIÉTAIRE D'AUTRUI NE L'EST PAS DAVANTAGE
// ═════════════════════════════════════════════════════════════════════════════

describe("B — le rôle propriétaire ne se donne pas depuis un client", () => {
  test("le propriétaire ne peut pas promouvoir un joueur", async () => {
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", PLAYER_A1), {
        uid: PLAYER_A1,
        role: "owner",
      }),
    );
  });

  test("le propriétaire ne peut pas se rétrograder lui-même en coach", async () => {
    // Ce serait fabriquer l'incohérence « désignation sans appartenance » à la main.
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", COACH_A), {
        uid: COACH_A,
        role: "coach",
      }),
    );
  });

  test("LE GESTE COMPLET, joué à la main dans les deux ordres : les deux moitiés échouent", async () => {
    // Moitié 1 d'abord : la désignation.
    await assertFails(updateDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { ownerUid: PLAYER_A1 }));
    // Moitié 2 d'abord : le rôle.
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", PLAYER_A1), {
        uid: PLAYER_A1,
        role: "owner",
      }),
    );
    // Et l'état n'a pas bougé d'un pouce.
    const club = await getDoc(doc(asUser(COACH_A), "clubs", CLUB_A));
    expect(club.data()?.ownerUid).toBe(COACH_A);
  });

  test("un joueur ne peut pas se promouvoir propriétaire d'un club qui ne le désigne pas", async () => {
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1), {
        uid: PLAYER_A1,
        role: "owner",
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. APRÈS LE TRANSFERT : les droits ont réellement changé de main
// ═════════════════════════════════════════════════════════════════════════════

describe("C — une fois le transfert appliqué par le serveur", () => {
  beforeEach(async () => {
    await poseEtatApresTransfert(PLAYER_A1, COACH_A);
  });

  test("le NOUVEAU propriétaire gagne les gestes du propriétaire", async () => {
    const g = gestesProprietaire(PLAYER_A1);
    await assertSucceeds(g.modifieClub());
    await assertSucceeds(g.supprimeDirective());
  });

  test("le NOUVEAU propriétaire est aussi encadrant (le rôle owner ouvre l'encadrement)", async () => {
    const g = gestesEncadrement(PLAYER_A1);
    await assertSucceeds(g.listeEffectif());
    await assertSucceeds(g.litNotePrivee());
    await assertSucceeds(g.ecritCadre());
    await assertSucceeds(g.ecritDirective());
  });

  test("l'ANCIEN propriétaire perd IMMÉDIATEMENT les gestes du propriétaire", async () => {
    const g = gestesProprietaire(COACH_A);
    await assertFails(g.modifieClub());
    await assertFails(g.supprimeDirective());
    await assertFails(g.supprimeCadre());
  });

  test("… mais garde EXACTEMENT ses gestes d'encadrant : c'est le rôle explicite qu'il a reçu", async () => {
    const g = gestesEncadrement(COACH_A);
    await assertSucceeds(g.listeEffectif());
    await assertSucceeds(g.litNotePrivee());
    await assertSucceeds(g.ecritCadre());
    await assertSucceeds(g.ecritDirective());
  });

  test("l'ANCIEN propriétaire peut désormais quitter le club lui-même", async () => {
    // Avant le transfert, cette suppression est interdite (elle fabriquerait une
    // désignation orpheline). Après, il n'est plus le `ownerUid` : le geste
    // redevient celui d'un membre ordinaire.
    await assertSucceeds(deleteDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", COACH_A)));
  });

  test("le NOUVEAU propriétaire, lui, ne peut plus quitter le club (il faudrait transférer)", async () => {
    await assertFails(deleteDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1)));
  });

  test("le NOUVEAU propriétaire ne peut pas rétrograder l'ancien à la main", async () => {
    // Le retrait passe par la Cloud Function `removeClubMember`, jamais par une
    // écriture cliente sur le document d'un autre.
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", COACH_A), {
        uid: COACH_A,
        role: "player",
      }),
    );
  });

  test("le NOUVEAU propriétaire ne peut pas re-transférer depuis le client", async () => {
    await assertFails(updateDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A), { ownerUid: PLAYER_A2 }));
  });

  test("l'ancien propriétaire ne peut pas se re-désigner", async () => {
    await assertFails(updateDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { ownerUid: COACH_A }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. AUCUN DROIT NE SURVIT PAR UNE DÉSIGNATION ORPHELINE
// ═════════════════════════════════════════════════════════════════════════════

describe("D — un `ownerUid` resté seul n'ouvre rien", () => {
  test("désignation SANS appartenance propriétaire : aucun geste de propriétaire", async () => {
    await admin(async (ctx) => {
      // COACH_A reste `ownerUid`, mais son appartenance ne dit plus "owner".
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A), {
        uid: COACH_A,
        role: "coach",
      });
    });
    const g = gestesProprietaire(COACH_A);
    await assertFails(g.modifieClub());
    await assertFails(g.supprimeDirective());
  });

  test("appartenance propriétaire ORPHELINE (sans désignation) : aucun geste de propriétaire", async () => {
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A2), {
        uid: COACH_A2,
        role: "owner",
      });
    });
    const g = gestesProprietaire(COACH_A2);
    await assertFails(g.modifieClub());
    await assertFails(g.supprimeDirective());
    // Il reste encadrant — « owner » est un rôle d'encadrement, et ça, c'est vrai
    // sans la désignation. C'est exactement la limite de ce que l'incohérence
    // laisse ouvert : de l'encadrement, jamais de la propriété.
    await assertSucceeds(gestesEncadrement(COACH_A2).ecritCadre());
  });

  test("le club reste LISIBLE par son ownerUid : une incohérence n'est pas une disparition muette", async () => {
    await admin(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A));
    });
    await assertSucceeds(getDoc(doc(asUser(COACH_A), "clubs", CLUB_A)));
    // …mais il n'y écrit rien.
    await assertFails(gestesProprietaire(COACH_A).modifieClub());
  });
});
