// firestore-tests/rules.coachAccess.test.ts
//
// AUTORISATION D'ACCÈS AUX DONNÉES DE SUIVI D'UN JOUEUR — couche 1 sur 4 (règles).
//
// Ce que cette suite prouve, contre les VRAIES règles jouées par l'émulateur :
//  A. la lecture de clubs/{clubId}/playerSummaries/{playerUid} exige que
//     members/{playerUid}.coachAccess vaille "approved" ou "not_required" ;
//  B. champ ABSENT = REFUS (fail-closed) — c'est le cas des membership écrits
//     avant l'existence du champ, qui ne doivent rien ouvrir ;
//  C. "pending" et "revoked" refusent, y compris avec une projection déjà en base ;
//  D. AUCUN client ne peut écrire ce champ : ni le joueur, ni le coach, ni
//     l'owner du club, ni en création, ni en mise à jour PARTIELLE, ni en
//     suppression du champ.
//
// Rappel de portée : ce fichier teste des PERMISSIONS. Le calcul de l'état
// initial (pending quand l'âge est inconnu) vit dans la Cloud Function et ses
// tests unitaires (functions/tests/coachAccess.test.ts).

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { PROJECT_ID, CLUB_A, COACH_A, PLAYER_A1, SUMMARY, seed, seedPlayerSummary } from "./fixtures";

let testEnv: RulesTestEnvironment;

// Joueurs dédiés à cette suite (les fixtures partagées restent inchangées).
const PLAYER_PENDING = "playerPending"; // étape supplémentaire non faite
const PLAYER_REVOKED = "playerRevoked"; // accès retiré
const PLAYER_LEGACY = "playerLegacy"; // membership ANCIEN, sans le champ
const PLAYER_NOTREQ = "playerNotRequired"; // aucune étape supplémentaire requise
const PLAYER_JUNK = "playerJunk"; // valeur non reconnue

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

const mkSummary = (uid: string) => ({ ...SUMMARY, playerUid: uid });

/** Seed serveur d'un joueur : membership (avec ou sans champ) + projection présente. */
async function seedPlayer(uid: string, coachAccess: string | null): Promise<void> {
  await admin(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "clubs", CLUB_A, "members", uid), {
      uid,
      role: "player",
      // `null` = champ VOLONTAIREMENT absent (membership ancien).
      ...(coachAccess === null ? {} : { coachAccess }),
    });
    await setDoc(doc(db, "users", uid), {
      uid, clubId: CLUB_A, role: "player", firstName: "Test", ageCategory: "U15", profileCompleted: true,
    });
    // La projection EXISTE : sans elle, un refus ne prouverait rien (on refuserait
    // un document inexistant). C'est bien un accès à de la donnée réelle qu'on ferme.
    await setDoc(doc(db, "clubs", CLUB_A, "playerSummaries", uid), mkSummary(uid));
  });
}

const summaryRef = (db: ReturnType<typeof asUser>, uid: string) =>
  doc(db, "clubs", CLUB_A, "playerSummaries", uid);

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv);
  await seedPlayerSummary(testEnv);
});

describe("A/B/C — la lecture du suivi dépend de l'état serveur d'autorisation", () => {
  test("1) coachAccess ABSENT (membership ancien) → lecture REFUSÉE", async () => {
    await seedPlayer(PLAYER_LEGACY, null);
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_LEGACY)));
  });

  test("2) coachAccess = \"pending\" → lecture REFUSÉE", async () => {
    await seedPlayer(PLAYER_PENDING, "pending");
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_PENDING)));
  });

  test("3) coachAccess = \"revoked\" → lecture REFUSÉE", async () => {
    await seedPlayer(PLAYER_REVOKED, "revoked");
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_REVOKED)));
  });

  test("4) coachAccess = \"approved\" → lecture AUTORISÉE", async () => {
    // PLAYER_A1 est seedé "approved" par les fixtures partagées.
    const snap = await assertSucceeds(getDoc(summaryRef(asUser(COACH_A), PLAYER_A1)));
    expect((snap as any).data()?.playerUid).toBe(PLAYER_A1);
  });

  test("5) coachAccess = \"not_required\" → lecture AUTORISÉE", async () => {
    await seedPlayer(PLAYER_NOTREQ, "not_required");
    const snap = await assertSucceeds(getDoc(summaryRef(asUser(COACH_A), PLAYER_NOTREQ)));
    expect((snap as any).data()?.playerUid).toBe(PLAYER_NOTREQ);
  });

  test("6) valeur NON RECONNUE (casse, drapeau booléen, autre mot) → lecture REFUSÉE", async () => {
    // Default-deny littéral : seules les deux chaînes exactes ouvrent.
    for (const valeur of ["APPROVED", "Approved", "ok", "true", "granted", ""]) {
      await seedPlayer(PLAYER_JUNK, valeur);
      await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_JUNK)));
    }
  });

  test("7) l'owner du club est soumis à la MÊME règle que le coach", async () => {
    // COACH_A est owner ET coach du club A : on prouve que le second chemin
    // d'autorisation (isClubOwner) ne contourne pas le verrou.
    await seedPlayer(PLAYER_PENDING, "pending");
    await admin(async (ctx) => {
      // On retire son membership coach : il ne reste QUE la qualité d'owner.
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A), {
        uid: COACH_A, role: "staff",
      });
    });
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_PENDING)));
  });

  test("8) le passage de \"approved\" à \"revoked\" ferme la lecture immédiatement", async () => {
    await assertSucceeds(getDoc(summaryRef(asUser(COACH_A), PLAYER_A1)));
    await admin(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", PLAYER_A1), {
        coachAccess: "revoked",
      });
    });
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_A1)));
  });

  test("9) le membership reste LISIBLE : être membre n'est pas être consultable", async () => {
    // Les 3 notions sont séparées. Le coach doit pouvoir compter son effectif
    // (et voir qu'un joueur est en attente) sans lire la moindre donnée de suivi.
    await seedPlayer(PLAYER_PENDING, "pending");
    const snap = await assertSucceeds(
      getDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", PLAYER_PENDING)),
    );
    expect((snap as any).data()?.coachAccess).toBe("pending");
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_PENDING)));
  });
});

describe("D — aucun client ne peut écrire l'état d'autorisation", () => {
  test("10) le JOUEUR ne peut ni poser, ni changer, ni supprimer son coachAccess", async () => {
    await seedPlayer(PLAYER_PENDING, "pending");
    const db = asUser(PLAYER_PENDING);
    const ref = doc(db, "clubs", CLUB_A, "members", PLAYER_PENDING);
    // Écriture complète…
    await assertFails(setDoc(ref, { uid: PLAYER_PENDING, role: "player", coachAccess: "approved" }));
    // …mise à jour PARTIELLE (le piège : ne toucher QUE ce champ)…
    await assertFails(updateDoc(ref, { coachAccess: "approved" }));
    // …et suppression du champ (qui ne doit pas non plus rouvrir quoi que ce soit).
    await assertFails(updateDoc(ref, { coachAccess: deleteField() }));
  });

  test("11) le COACH ne peut pas approuver un joueur depuis l'app", async () => {
    await seedPlayer(PLAYER_PENDING, "pending");
    const db = asUser(COACH_A);
    const ref = doc(db, "clubs", CLUB_A, "members", PLAYER_PENDING);
    await assertFails(updateDoc(ref, { coachAccess: "approved" }));
    await assertFails(setDoc(ref, { uid: PLAYER_PENDING, role: "player", coachAccess: "approved" }));
  });

  test("12) l'OWNER du club non plus, même sur son PROPRE document member", async () => {
    // COACH_A est propriétaire : c'est le seul client qui a le droit d'écrire un
    // member (son propre rôle "owner", l'amorçage). Ce droit ne doit pas
    // emporter `coachAccess`.
    const db = asUser(COACH_A);
    const ref = doc(db, "clubs", CLUB_A, "members", COACH_A);
    // Écriture légitime SANS le champ : toujours autorisée (non-régression).
    await assertSucceeds(setDoc(ref, { uid: COACH_A, role: "owner" }));
    // La même écriture AVEC le champ : refusée.
    await assertFails(setDoc(ref, { uid: COACH_A, role: "owner", coachAccess: "approved" }));
    // Mise à jour partielle du seul champ : refusée.
    await assertFails(updateDoc(ref, { coachAccess: "not_required" }));
  });

  test("13) une mise à jour légitime qui NE TOUCHE PAS le champ reste possible", async () => {
    // Preuve que la règle interdit le champ, pas l'écriture du document.
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A), {
        uid: COACH_A, role: "owner", coachAccess: "not_required",
      });
    });
    const ref = doc(asUser(COACH_A), "clubs", CLUB_A, "members", COACH_A);
    await assertSucceeds(updateDoc(ref, { updatedAt: 123 }));
    // …et le champ n'a pas bougé.
    await admin(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A));
      expect(snap.data()?.coachAccess).toBe("not_required");
    });
  });

  test("14) la projection elle-même reste inécrivable par tout client (rappel)", async () => {
    await assertFails(
      setDoc(summaryRef(asUser(COACH_A), PLAYER_A1), { ...mkSummary(PLAYER_A1), firstName: "Hack" }),
    );
  });
});
