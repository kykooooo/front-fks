// firestore-tests/rules.coachAccessPolicy.test.ts
//
// POLITIQUE D'ACCES COACH DU CLUB — permissions, contre les VRAIES regles
// jouees par l'emulateur.
//
// Ce que cette suite prouve :
//  A. un JOUEUR ne peut pas ecrire `coachAccessPolicy` — ni en creation, ni en
//     mise a jour PARTIELLE (le piege : ne toucher QUE ce champ), ni en
//     suppression du champ, ni en ecrasant tout le document ;
//  B. le COACH et l'OWNER du club le peuvent ;
//  C. le coach non-owner n'obtient RIEN d'autre au passage (il ne peut pas
//     renommer le club ni changer son proprietaire) ;
//  D. seules les deux valeurs reconnues sont acceptees ;
//  E. `coachAccess` (l'etat du joueur) reste inecrivable par TOUT client — la
//     politique s'ecrit, l'etat non. Les deux champs ne se confondent pas.
//
// Rappel de portee : ce fichier teste des PERMISSIONS. Ce que la politique
// PRODUIT (not_required / pending) vit dans la Cloud Function et ses tests
// unitaires (functions/tests/coachAccessPolicy.test.ts).

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { PROJECT_ID, CLUB_A, CLUB_B, COACH_A, COACH_B, PLAYER_A1, STRANGER, seed } from "./fixtures";

let testEnv: RulesTestEnvironment;

/** Coach du club A qui n'en est PAS le proprietaire (COACH_A, lui, est owner). */
const COACH_A_NON_OWNER = "coachAsecond";

const POLICY = "coachAccessPolicy";
const AUTO = "automatic_safe_projection";
const APPROVAL = "approval_required";

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST non defini — lancer via `npm run test:rules` (demarre l'emulateur Firestore).",
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

const clubRef = (db: ReturnType<typeof asUser>, clubId = CLUB_A) => doc(db, "clubs", clubId);

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv);
  // Un second coach du club A, SANS etre owner : c'est le cas qui distingue
  // "coach" de "owner" dans les regles.
  await admin(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A_NON_OWNER), {
      uid: COACH_A_NON_OWNER,
      role: "coach",
    });
  });
});

// ─── A. Le joueur ne peut PAS ──────────────────────────────────────────────

describe("A — un joueur ne peut jamais ecrire la politique de son club", () => {
  test("1) mise a jour PARTIELLE du seul champ : REFUSEE", async () => {
    await assertFails(updateDoc(clubRef(asUser(PLAYER_A1)), { [POLICY]: AUTO }));
    await assertFails(updateDoc(clubRef(asUser(PLAYER_A1)), { [POLICY]: APPROVAL }));
  });

  test("2) ecriture COMPLETE du document club : REFUSEE", async () => {
    await assertFails(
      setDoc(clubRef(asUser(PLAYER_A1)), {
        name: "Club A",
        ownerUid: COACH_A,
        [POLICY]: AUTO,
      }),
    );
  });

  test("3) ecriture par MERGE (le piege du set partiel) : REFUSEE", async () => {
    await assertFails(setDoc(clubRef(asUser(PLAYER_A1)), { [POLICY]: AUTO }, { merge: true }));
  });

  test("4) SUPPRESSION du champ : REFUSEE (revenir au defaut est aussi une decision)", async () => {
    await admin(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A),
        { [POLICY]: APPROVAL },
        { merge: true },
      );
    });
    await assertFails(updateDoc(clubRef(asUser(PLAYER_A1)), { [POLICY]: deleteField() }));
  });

  test("5) un joueur d'un AUTRE club, et un inconnu, ne peuvent rien non plus", async () => {
    await assertFails(updateDoc(clubRef(asUser(STRANGER)), { [POLICY]: AUTO }));
    await assertFails(updateDoc(clubRef(asUser(COACH_B)), { [POLICY]: AUTO }));
  });

  test("6) la valeur en base n'a pas bouge apres toutes ces tentatives", async () => {
    await admin(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), "clubs", CLUB_A));
      expect(snap.data()?.[POLICY]).toBeUndefined();
    });
  });

  test("7) un joueur reste capable de LIRE le club dont il est membre (non-regression)", async () => {
    await admin(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A),
        { [POLICY]: APPROVAL },
        { merge: true },
      );
    });
    const snap = await assertSucceeds(getDoc(clubRef(asUser(PLAYER_A1))));
    expect((snap as { data(): Record<string, unknown> | undefined }).data()?.[POLICY]).toBe(
      APPROVAL,
    );
  });
});

// ─── B/C. Le coach et l'owner le peuvent, et rien de plus ──────────────────

describe("B/C — coach et owner configurent la politique, et seulement elle", () => {
  test("8) l'OWNER du club pose la politique", async () => {
    await assertSucceeds(updateDoc(clubRef(asUser(COACH_A)), { [POLICY]: APPROVAL }));
    await assertSucceeds(updateDoc(clubRef(asUser(COACH_A)), { [POLICY]: AUTO }));
  });

  test("9) un COACH non-owner pose la politique", async () => {
    await assertSucceeds(updateDoc(clubRef(asUser(COACH_A_NON_OWNER)), { [POLICY]: APPROVAL }));
    await admin(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), "clubs", CLUB_A));
      expect(snap.data()?.[POLICY]).toBe(APPROVAL);
    });
  });

  test("10) un coach non-owner ne gagne AUCUN autre pouvoir sur le club", async () => {
    const db = asUser(COACH_A_NON_OWNER);
    // Renommer le club : toujours refuse.
    await assertFails(updateDoc(clubRef(db), { name: "Club pirate" }));
    // Changer le proprietaire : toujours refuse.
    await assertFails(updateDoc(clubRef(db), { ownerUid: COACH_A_NON_OWNER }));
    // Glisser la politique AVEC autre chose : refuse en bloc (hasOnly).
    await assertFails(updateDoc(clubRef(db), { [POLICY]: AUTO, name: "Club pirate" }));
    // Supprimer le club : refuse pour tout le monde (non-regression).
    await assertFails(updateDoc(clubRef(db), { ownerUid: deleteField() }));
  });

  test("11) l'owner garde ses autres droits d'ecriture (non-regression)", async () => {
    await assertSucceeds(
      setDoc(clubRef(asUser(COACH_A)), { teamGender: "female" }, { merge: true }),
    );
  });

  test("12) coach et owner peuvent revenir au defaut en supprimant le champ", async () => {
    await assertSucceeds(updateDoc(clubRef(asUser(COACH_A)), { [POLICY]: APPROVAL }));
    await assertSucceeds(
      updateDoc(clubRef(asUser(COACH_A_NON_OWNER)), { [POLICY]: deleteField() }),
    );
    await admin(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), "clubs", CLUB_A));
      expect(snap.data()?.[POLICY]).toBeUndefined();
    });
  });
});

// ─── D. Valeurs ────────────────────────────────────────────────────────────

describe("D — seules les deux valeurs reconnues passent", () => {
  test("13) une politique inventee est REFUSEE, meme au proprietaire", async () => {
    const db = asUser(COACH_A);
    for (const valeur of [
      "AUTOMATIC_SAFE_PROJECTION",
      "Approval_Required",
      "approval",
      "strict",
      "",
      true,
      1,
      { mode: APPROVAL },
      [APPROVAL],
    ]) {
      await assertFails(updateDoc(clubRef(db), { [POLICY]: valeur }));
    }
  });

  test("14) a la CREATION d'un club, la politique doit etre reconnue si elle est posee", async () => {
    const db = asUser(STRANGER);
    await assertFails(
      setDoc(doc(db, "clubs", "clubNeufInvalide"), {
        name: "Neuf",
        ownerUid: STRANGER,
        [POLICY]: "strict",
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "clubs", "clubNeufValide"), {
        name: "Neuf",
        ownerUid: STRANGER,
        [POLICY]: APPROVAL,
      }),
    );
    // Sans le champ : creation possible comme avant (le defaut serveur joue).
    await assertSucceeds(
      setDoc(doc(db, "clubs", "clubNeufSansChamp"), { name: "Neuf", ownerUid: STRANGER }),
    );
  });

  test("15) une valeur ILLISIBLE deja en base ne bloque pas les autres mises a jour", async () => {
    // Cas de vieille donnee : un champ pourri ne doit pas geler le document.
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A), { [POLICY]: "bidon" }, { merge: true });
    });
    await assertSucceeds(
      setDoc(clubRef(asUser(COACH_A)), { teamGender: "male" }, { merge: true }),
    );
    // …mais la corriger exige quand meme une valeur reconnue.
    await assertFails(updateDoc(clubRef(asUser(COACH_A)), { [POLICY]: "toujours bidon" }));
    await assertSucceeds(updateDoc(clubRef(asUser(COACH_A)), { [POLICY]: AUTO }));
  });
});

// ─── E. La politique n'est pas l'etat ──────────────────────────────────────

describe("E — configurer la politique n'ouvre AUCUN droit sur l'etat du joueur", () => {
  test("16) coach, owner et joueur restent incapables d'ecrire coachAccess", async () => {
    for (const uid of [COACH_A, COACH_A_NON_OWNER, PLAYER_A1]) {
      await assertFails(
        updateDoc(doc(asUser(uid), "clubs", CLUB_A, "members", PLAYER_A1), {
          coachAccess: "approved",
        }),
      );
    }
  });

  test("17) poser approval_required ne retire RIEN a un membre deja consultable", async () => {
    // Le serveur ne reevalue pas les membres existants ; les regles, elles, ne
    // lisent que `coachAccess`. Le summary de PLAYER_A1 (seede "approved")
    // reste donc lisible apres le changement de politique.
    await assertSucceeds(updateDoc(clubRef(asUser(COACH_A)), { [POLICY]: APPROVAL }));
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_A1), {
        playerUid: PLAYER_A1,
        firstName: "Anna",
      });
    });
    await assertSucceeds(
      getDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "playerSummaries", PLAYER_A1)),
    );
  });

  test("18) la politique d'un club ne fuit pas vers un autre club", async () => {
    await assertFails(updateDoc(clubRef(asUser(COACH_A), CLUB_B), { [POLICY]: APPROVAL }));
  });
});
