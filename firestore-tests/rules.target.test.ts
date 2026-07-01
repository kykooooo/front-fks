// firestore-tests/rules.target.test.ts
//
// Tests CIBLES pour la future projection coach-safe :
//   clubs/{clubId}/playerSummaries/{playerUid}
//
// Ces tests contiennent de VRAIES fixtures / actions / assertions. Ils restent
// `test.skip` car les rules ACTUELLES (firestore.rules non modifié en PR-1) ne
// satisfont PAS encore toutes les cibles :
//   - playerSummaries n'a AUCUNE règle → toute lecture y est refusée par défaut
//     (donc "coach lit summary" échouerait aujourd'hui) ;
//   - le coach lit ENCORE les docs bruts (donc "coach ne lit plus" échouerait).
//
// Activation en PR-4 : retirer UNIQUEMENT `.skip` (aucune autre modification).
// Cette PR NE touche PAS firestore.rules.
//
// Décisions produit verrouillées (Codex) reflétées ici :
//   - projection écrite par Cloud Function (trigger) → écriture cliente REFUSÉE ;
//   - aucun champ médical / intime / charge brute / commentaire dans le summary ;
//   - RPE brut retiré du dashboard coach.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  PROJECT_ID,
  CLUB_A,
  COACH_A,
  PLAYER_A1,
  COACH_B,
  PLAYER_B,
  STRANGER,
  SUMMARY,
  FORBIDDEN_SUMMARY_KEYS,
  seed,
  seedPlayerSummary,
} from "./fixtures";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST non défini — lancer via `yarn test:rules` (démarre l'émulateur Firestore).",
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

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv);
  await seedPlayerSummary(testEnv);
});

const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

const summaryRef = (db: ReturnType<typeof asUser>) =>
  doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1);

describe("TARGET — clubs/{clubId}/playerSummaries (à ACTIVER en PR-4 en retirant .skip)", () => {
  test.skip("TARGET 1: coach même club LIT le summary — et il ne contient AUCUN champ interdit", async () => {
    const snap = await assertSucceeds(getDoc(summaryRef(asUser(COACH_A))));
    const data = (snap as any).data() as Record<string, unknown>;
    // Le summary expose bien les champs coach-safe…
    expect(data.playerUid).toBe(PLAYER_A1);
    expect(data.firstName).toBe(SUMMARY.firstName);
    expect((data.lastActivity as any)?.rpe).toBeUndefined(); // pas de RPE
    // …et AUCUN champ interdit (pain/comment/tsb/metrics/aiV2…).
    for (const key of FORBIDDEN_SUMMARY_KEYS) {
      expect(data[key]).toBeUndefined();
    }
  });

  test.skip("TARGET 2: coach même club NE LIT PLUS le profil brut (users/{uid})", async () => {
    await assertFails(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1)));
  });

  test.skip("TARGET 3: coach même club NE LIT PLUS les sessions brutes", async () => {
    await assertFails(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1, "sessions", "s1")));
  });

  test.skip("TARGET 4: coach même club NE LIT PLUS les plannedSessions brutes", async () => {
    await assertFails(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1, "plannedSessions", "p1")));
  });

  test.skip("TARGET 5: coach d'un AUTRE club NE lit PAS le summary", async () => {
    await assertFails(getDoc(summaryRef(asUser(COACH_B))));
  });

  test.skip("TARGET 6: joueuse d'un AUTRE club NE lit PAS le summary", async () => {
    await assertFails(getDoc(summaryRef(asUser(PLAYER_B))));
  });

  test.skip("TARGET 7: non-membre (connecté sans club) NE lit PAS le summary", async () => {
    await assertFails(getDoc(summaryRef(asUser(STRANGER))));
  });

  test.skip("TARGET 8: non authentifié NE lit PAS le summary", async () => {
    await assertFails(getDoc(summaryRef(asAnon())));
  });

  test.skip("TARGET 9: écriture CLIENTE du summary REFUSÉE (projection = trigger serveur only)", async () => {
    // Ni le coach du club, ni la joueuse elle-même ne peuvent écrire la projection.
    await assertFails(setDoc(summaryRef(asUser(COACH_A)), { ...SUMMARY, firstName: "Hack" }));
    await assertFails(setDoc(summaryRef(asUser(PLAYER_A1)), { ...SUMMARY, firstName: "Hack" }));
  });

  test.skip("TARGET 10: la joueuse CONSERVE l'accès à ses propres docs bruts", async () => {
    await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1)));
    await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1, "sessions", "s1")));
    await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1, "plannedSessions", "p1")));
  });
});
