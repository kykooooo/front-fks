// firestore-tests/rules.baseline.test.ts
//
// Tests Firestore Rules — BASELINE.
//
// Ces tests sont VERTS contre firestore.rules ACTUEL (non modifié dans cette PR).
// Objectif : documenter le comportement de sécurité PRÉSENT, y compris les fuites.
//
// Les tests marqués `CURRENT VULNERABILITY` affirment le comportement DANGEREUX
// réel (une lecture sensible RÉUSSIT aujourd'hui). Ils seront INVERSÉS
// (assertSucceeds → assertFails) lors de la PR de fermeture des rules (PR-4).
//
// RÈGLE : ne JAMAIS masquer une fuite pour obtenir du vert. Un test vert ici =
// une vérité mesurée sur les rules de production actuelles.

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
  SENSITIVE,
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
describe("CURRENT VULNERABILITY — comportement dangereux ACTUEL (à INVERSER en PR-4)", () => {
  // ⚠️ Chaque `assertSucceeds` ci-dessous passe AUJOURD'HUI et deviendra un
  // `assertFails` après la fermeture des rules (PR-4).

  test("CURRENT VULNERABILITY: coachA lit le profil BRUT de playerA1", async () => {
    await assertSucceeds(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1)));
  });

  test("CURRENT VULNERABILITY: coachA lit la séance BRUTE (sessions) de playerA1", async () => {
    await assertSucceeds(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1, "sessions", "s1")));
  });

  test("CURRENT VULNERABILITY: coachA lit la séance PLANIFIÉE brute de playerA1", async () => {
    await assertSucceeds(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1, "plannedSessions", "p1")));
  });

  test("CURRENT VULNERABILITY: coachA récupère pain/comment/tsb/aiV2 depuis le doc brut", async () => {
    const snap = await getDoc(doc(asUser(COACH_A), "users", PLAYER_A1, "sessions", "s1"));
    const data = snap.data() as Record<string, any>;
    // Preuve CONCRÈTE de l'exposition des données sensibles au coach.
    expect(data.feedback.pain).toBe(SENSITIVE.pain);
    expect(data.feedback.comment).toBe(SENSITIVE.comment);
    expect(data.metrics.tsb).toBe(SENSITIVE.tsb);
    expect(data.aiV2).toBeDefined();
  });

  test("CURRENT VULNERABILITY: tout connecté lit clubs/{id} et donc l'inviteCode", async () => {
    const snap = await getDoc(doc(asUser(STRANGER), "clubs", CLUB_A));
    expect((snap.data() as Record<string, any>).inviteCode).toBe(CLUB_A_INVITE);
  });

  test("CURRENT VULNERABILITY: un connecté crée son membership 'player' SANS code d'invitation", async () => {
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
