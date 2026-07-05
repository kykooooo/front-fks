// firestore-tests/rules.baseline.test.ts
//
// Tests Firestore Rules — comportement APRÈS fermeture de la frontière (PR-4).
//
// Ces tests sont VERTS contre firestore.rules PR-4. Ils couvrent :
//   - les comportements légitimes (inchangés) ;
//   - la frontière coach-safe FERMÉE : les anciens `CURRENT VULNERABILITY` de
//     lecture coach des docs bruts sont désormais INVERSÉS (assertSucceeds →
//     assertFails) — le coach ne lit plus profil/sessions/plannedSessions bruts ;
//   - les vulnérabilités HORS périmètre coach-safe (inviteCode lisible, création
//     de membership sans code) : NON traitées par PR-4, laissées telles quelles
//     et explicitement documentées comme dette de sécurité distincte.
//
// RÈGLE : ne JAMAIS masquer une fuite pour obtenir du vert. Un test vert ici =
// une vérité mesurée sur les rules réelles.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import {
  PROJECT_ID,
  CLUB_A,
  COACH_A,
  PLAYER_A1,
  COACH_B,
  STRANGER,
  WEEK_KEY,
  CLUB_A_INVITE,
  seed,
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
});

const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

// ─────────────────────────────────────────────────────────────────────────────
describe("Comportements légitimes (doivent RESTER verts après PR-4)", () => {
  test("joueuse lit son propre profil", async () => {
    await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1)));
  });

  test("joueuse lit sa propre séance", async () => {
    await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1, "sessions", "s1")));
  });

  test("coach lit la liste des members de SON club", async () => {
    await assertSucceeds(getDocs(collection(asUser(COACH_A), "clubs", CLUB_A, "members")));
  });

  test("membre lit le weekContext de son club", async () => {
    await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
  });

  test("non-membre NE lit PAS le weekContext d'un club", async () => {
    await assertFails(getDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
  });

  test("non authentifié NE lit PAS un club", async () => {
    await assertFails(getDoc(doc(asAnon(), "clubs", CLUB_A)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Frontière coach-safe FERMÉE (PR-4) — anciens CURRENT VULNERABILITY inversés", () => {
  // ⚠️ Chacun de ces `assertFails` passait en `assertSucceeds` AVANT PR-4 : c'était
  // la fuite. Les rules PR-4 retirent l'accès coach aux docs bruts → lecture refusée.

  test("coachA NE lit PLUS le profil BRUT de playerA1", async () => {
    await assertFails(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1)));
  });

  test("coachA NE lit PLUS la séance BRUTE (sessions) de playerA1", async () => {
    await assertFails(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1, "sessions", "s1")));
  });

  test("coachA NE lit PLUS la séance PLANIFIÉE brute de playerA1", async () => {
    await assertFails(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1, "plannedSessions", "p1")));
  });

  test("coachA NE peut PLUS atteindre le doc qui portait pain/comment/tsb/aiV2", async () => {
    // Preuve inverse : la lecture qui exposait ces champs sensibles est refusée.
    // (Le doc brut existe toujours ; seule la surface d'accès coach a été fermée.)
    await assertFails(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1, "sessions", "s1")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Vulnérabilités HORS périmètre coach-safe (NON traitées par PR-4)", () => {
  // ⚠️ Ces deux `assertSucceeds` restent VERTS : ce sont des fuites RÉELLES mais
  // DISTINCTES de la frontière coach-safe (pas de données joueuse exposées au coach
  // ici). Hors scope de PR-4 → laissées inchangées et tracées comme dette de sécu.
  // À traiter dans une PR dédiée (durcissement clubs/inviteCode + membership par code).

  test("HORS SCOPE: tout connecté lit clubs/{id} et donc l'inviteCode", async () => {
    const snap = await getDoc(doc(asUser(STRANGER), "clubs", CLUB_A));
    expect((snap.data() as Record<string, any>).inviteCode).toBe(CLUB_A_INVITE);
  });

  test("HORS SCOPE: un connecté crée son membership 'player' SANS code d'invitation", async () => {
    await assertSucceeds(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), { uid: STRANGER, role: "player" }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Contrôles d'isolation DÉJÀ conformes (ne seront PAS inversés)", () => {
  // Les rules actuelles bloquent déjà le cross-club : ces tests resteront
  // assertFails après PR-4. Ils bornent le périmètre de la fuite.

  test("coachB (autre club) NE lit PAS la séance brute de playerA1", async () => {
    await assertFails(getDoc(doc(asUser(COACH_B), "users", PLAYER_A1, "sessions", "s1")));
  });

  test("coachB (autre club) NE lit PAS le profil brut de playerA1", async () => {
    await assertFails(getDoc(doc(asUser(COACH_B), "users", PLAYER_A1)));
  });
});
