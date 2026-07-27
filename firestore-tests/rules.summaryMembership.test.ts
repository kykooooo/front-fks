// firestore-tests/rules.summaryMembership.test.ts
//
// Mini-hardening PR-4 : la lecture d'une projection coach-safe
//   clubs/{clubId}/playerSummaries/{playerUid}
// exige désormais, EN PLUS d'un lecteur coach/owner du club, que la JOUEUSE
// ciblée soit TOUJOURS membre `player` du club (isPlayerMember).
//
// But : fermer la fuite d'un summary STALE. Après le départ de la joueuse (member
// doc supprimé) ou si son rôle n'est plus `player`, sa projection résiduelle
// devient illisible (fail-closed) — y compris via une lecture de collection, qui
// échoue en bloc plutôt que de divulguer le doc orphelin.
//
// L'écriture reste `write: if false` : seule la Cloud Function (admin SDK, hors
// rules) produit/nettoie les projections. Aucun client n'écrit.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection } from "firebase/firestore";
import {
  PROJECT_ID,
  CLUB_A,
  COACH_A,
  PLAYER_A1,
  PLAYER_A2,
  PLAYER_B,
  PLAYER_A_GONE,
  BADROLE_A,
  SUMMARY,
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
  await seedPlayerSummary(testEnv); // summary VALIDE de playerA1 (membre player)
});

const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();

// Écriture admin (règles DÉSACTIVÉES) = comportement exact de la Cloud Function.
const admin = (fn: Parameters<RulesTestEnvironment["withSecurityRulesDisabled"]>[0]) =>
  testEnv.withSecurityRulesDisabled(fn);

// Projection valide au nom d'un uid arbitraire (playerUid aligné sur l'ID du doc).
const mkSummary = (uid: string) => ({ ...SUMMARY, playerUid: uid });

const summaryRef = (db: ReturnType<typeof asUser>, uid: string) =>
  doc(db, "clubs", CLUB_A, "playerSummaries", uid);

describe("Mini-hardening PR-4 — playerSummaries exige un membership player ACTIF", () => {
  test("1) coach même club + joueuse membre player → lecture AUTORISÉE", async () => {
    const snap = await assertSucceeds(getDoc(summaryRef(asUser(COACH_A), PLAYER_A1)));
    expect((snap as any).data()?.playerUid).toBe(PLAYER_A1);
  });

  test("2) summary présent mais membership joueuse SUPPRIMÉ → lecture REFUSÉE", async () => {
    // Départ de la joueuse : on retire son doc members/ (projection non nettoyée).
    await admin(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", PLAYER_A1));
    });
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_A1)));

    // Variante : projection orpheline (jamais/plus de membership) → refusée aussi.
    await admin(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_A_GONE),
        mkSummary(PLAYER_A_GONE),
      );
    });
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_A_GONE)));
  });

  test("3) summary présent mais membership role coach / invalide → lecture REFUSÉE", async () => {
    await admin(async (ctx) => {
      const db = ctx.firestore();
      // Membre role coach (COACH_A est bien membre coach du club A).
      await setDoc(doc(db, "clubs", CLUB_A, "playerSummaries", COACH_A), mkSummary(COACH_A));
      // Membre avec un rôle NON player/coach.
      await setDoc(doc(db, "clubs", CLUB_A, "members", BADROLE_A), { uid: BADROLE_A, role: "staff" });
      await setDoc(doc(db, "clubs", CLUB_A, "playerSummaries", BADROLE_A), mkSummary(BADROLE_A));
    });
    await assertFails(getDoc(summaryRef(asUser(COACH_A), COACH_A)));
    await assertFails(getDoc(summaryRef(asUser(COACH_A), BADROLE_A)));
  });

  test("4) joueuse membre d'un AUTRE club → lecture REFUSÉE", async () => {
    // playerB est membre player du club B, PAS du club A : une projection à son nom
    // placée sous club A ne doit pas être lisible (isPlayerMember(clubA, playerB) = false).
    await admin(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_B),
        mkSummary(PLAYER_B),
      );
    });
    await assertFails(getDoc(summaryRef(asUser(COACH_A), PLAYER_B)));
  });

  test("5) toute lecture de COLLECTION est fail-closed → un summary stale ne fuite jamais", async () => {
    // isPlayerMember() fait un get()/exists() sur clubs/{clubId}/members/{playerUid}.
    // En opération `list`, {playerUid} n'est PAS lié (null) → l'évaluation de la règle
    // ERREURE ("Null value error") → la list est REFUSÉE en bloc. Conséquence : un
    // summary STALE ne peut JAMAIS être divulgué via une requête de collection.
    //
    // ⚠️ Corollaire d'impact (voir rapport) : la collection n'est lisible par AUCUN
    // client, même 100 % membres valides. Le roster coach doit donc se lire
    // joueur-par-joueur (getDoc du membership player → getDoc du summary), pas via un
    // getDocs de collection.

    // Collection avec SEULEMENT un membre valide (playerA1) : la list échoue déjà.
    await assertFails(getDocs(collection(asUser(COACH_A), "clubs", CLUB_A, "playerSummaries")));

    // Avec un summary orphelin en plus : toujours refusée (aucune fuite du stale).
    await admin(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_A_GONE),
        mkSummary(PLAYER_A_GONE),
      );
    });
    await assertFails(getDocs(collection(asUser(COACH_A), "clubs", CLUB_A, "playerSummaries")));
  });

  test("6) Cloud Function/Admin SDK reste hors rules ; écriture cliente REFUSÉE", async () => {
    // La Function (admin SDK) écrit une projection malgré `write: if false`…
    await admin(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_A2),
        mkSummary(PLAYER_A2),
      );
    });
    // …et le coach la lit (playerA2 est un membre player valide).
    await assertSucceeds(getDoc(summaryRef(asUser(COACH_A), PLAYER_A2)));

    // Aucun CLIENT ne peut écrire/altérer une projection (ni coach, ni joueuse).
    await assertFails(setDoc(summaryRef(asUser(COACH_A), PLAYER_A1), { ...mkSummary(PLAYER_A1), firstName: "Hack" }));
    await assertFails(setDoc(summaryRef(asUser(PLAYER_A1), PLAYER_A1), { ...mkSummary(PLAYER_A1), firstName: "Hack" }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Séquence RÉELLE du lecteur front (repositories/clubsRepo.ts fetchClubPlayerSummaries) :
// getDocs(members) → filtre role player → getDoc(playerSummaries/{id}) un par un.
// Prouve, contre les VRAIES rules émulateur (pas un mock), que ce chemin d'accès
// est autorisé — et fail-closed quand la joueuse part entre les deux étapes.
describe("Séquence réelle members → summaries (chemin du lecteur coach)", () => {
  test("7) coach liste members (role player) puis get chaque summary : lisible, pending permis", async () => {
    const db = asUser(COACH_A);

    // 1. Effectif : coach lit members ; on ne garde que role player (coach exclu).
    const membersSnap = await assertSucceeds(getDocs(collection(db, "clubs", CLUB_A, "members")));
    const playerIds = (membersSnap as any).docs
      .filter((d: any) => d.data().role === "player")
      .map((d: any) => d.id)
      .sort();
    expect(playerIds).toEqual([PLAYER_A1, PLAYER_A2].sort());

    // 2. get direct de chaque summary player.
    //    playerA1 : summary seedé → lisible.
    const a1 = await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
    expect((a1 as any).exists()).toBe(true);
    //    playerA2 : membre player SANS summary → lecture AUTORISÉE, doc absent (= pending,
    //    et non un refus : la distinction "non prête" vs "indisponible" est réelle).
    const a2 = await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A2)));
    expect((a2 as any).exists()).toBe(false);
  });

  test("8) départ ENTRE le listing members et le get summary → get refusé (aucune fuite)", async () => {
    const db = asUser(COACH_A);
    const membersSnap = await assertSucceeds(getDocs(collection(db, "clubs", CLUB_A, "members")));
    expect((membersSnap as any).docs.some((d: any) => d.id === PLAYER_A1)).toBe(true);

    // La joueuse quitte le club juste après le listing (member supprimé)…
    await admin(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", PLAYER_A1));
    });
    // …le get de sa projection résiduelle est refusé → le lecteur marquera unavailable.
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
  });

  test("9) owner SANS membership coach : liste members + lit le summary d'une joueuse player", async () => {
    // Cas limite (req 8) : un club dont l'OWNER n'a AUCUN doc members (ni coach ni
    // player). L'alignement `isClubOwner` sur members + playerSummaries doit lui
    // permettre le même chemin de lecture roster (members → get summary).
    const OWNER = "ownerNoCoach";
    const CLUB = "clubOwnerOnly";
    const PLAYER = "playerC1";
    await admin(async (ctx) => {
      const fdb = ctx.firestore();
      await setDoc(doc(fdb, "clubs", CLUB), { name: "Club C", ownerUid: OWNER });
      await setDoc(doc(fdb, "clubs", CLUB, "members", PLAYER), { uid: PLAYER, role: "player" });
      await setDoc(doc(fdb, "clubs", CLUB, "playerSummaries", PLAYER), { ...SUMMARY, playerUid: PLAYER });
    });
    const db = asUser(OWNER);
    // isClubOwner autorise la lecture members même sans être membre coach…
    const membersSnap = await assertSucceeds(getDocs(collection(db, "clubs", CLUB, "members")));
    expect((membersSnap as any).docs.map((d: any) => d.id)).toEqual([PLAYER]);
    // …et la lecture du summary d'une joueuse membre player (isClubOwner && isPlayerMember).
    const snap = await assertSucceeds(getDoc(doc(db, "clubs", CLUB, "playerSummaries", PLAYER)));
    expect((snap as any).exists()).toBe(true);
  });
});
