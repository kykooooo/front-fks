// firestore-tests/rules.clubsInvitation.test.ts
//
// Chantier sécurité clubs/invitation : ferme les deux trous laissés "hors scope"
// par PR-4, désormais inacceptables (pilote = club de MINEURES) :
//   1. Énumération des clubs : `allow read: if isSignedIn()` sur clubs/{clubId}
//      permettait un getDocs(clubs) → noms + inviteCodes + ownerUids récoltables.
//   2. Self-join : n'importe quel connecté créait SON membership "player" dans
//      n'importe quel club dont il avait l'ID — sans code d'invitation.
//
// Design retenu (rules pures, pas de Cloud Function) :
//   - clubs : list interdite pour TOUS ; get par ID réservé membres + owner ;
//   - /inviteCodes/{code} : annuaire code→club (doc ID = code), get exact
//     autorisé aux connectés (connaître le code = capability), list interdite ;
//   - members create/update player : exige inviteCode EXACT du club dans le doc
//     (comparé via get() serveur au club réel) — preuve d'invitation.
//
// POURQUOI pas une query gatée sur clubs : les rules Firestore ne voient PAS les
// clauses `where` d'une list (seulement limit/offset/orderBy) — toute list
// autorisée resterait paginable doc par doc, donc énumérable. D'où l'annuaire.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  documentId,
} from "firebase/firestore";
import {
  PROJECT_ID,
  CLUB_A,
  COACH_A,
  PLAYER_A1,
  CLUB_A_INVITE,
  CLUB_B,
  COACH_B,
  PLAYER_B,
  CLUB_B_INVITE,
  STRANGER,
  WEEK_KEY,
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

// Doc membership player tel que produit par setClubMembership (client réel).
const memberDoc = (uid: string, inviteCode?: string) => ({
  uid,
  role: "player",
  ...(inviteCode ? { inviteCode } : {}),
});

// ─────────────────────────────────────────────────────────────────────────────
describe("1) Énumération des clubs FERMÉE (list interdite pour tous)", () => {
  test("stranger : getDocs(clubs) REFUSÉ", async () => {
    await assertFails(getDocs(collection(asUser(STRANGER), "clubs")));
  });

  test("stranger : pagination doc par doc (orderBy id + limit 1) REFUSÉE", async () => {
    // La technique d'énumération lente qu'une rule `list` laxiste laisserait
    // passer : une page d'un seul doc à la fois. Doit être refusée aussi.
    await assertFails(
      getDocs(query(collection(asUser(STRANGER), "clubs"), orderBy(documentId()), limit(1))),
    );
  });

  test("stranger : query where inviteCode == (ancien chemin client) REFUSÉE, même avec le BON code", async () => {
    // L'ancien findClubByInviteCode. Les rules ne savent pas distinguer cette
    // query d'une énumération → refusée en bloc. (Casse les VIEUX builds tant
    // que l'OTA n'est pas adopté — assumé et documenté dans le séquencement.)
    await assertFails(
      getDocs(
        query(collection(asUser(STRANGER), "clubs"), where("inviteCode", "==", CLUB_A_INVITE), limit(1)),
      ),
    );
  });

  test("même un MEMBRE ne liste pas la collection clubs", async () => {
    await assertFails(getDocs(collection(asUser(PLAYER_A1), "clubs")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("2) get clubs/{id} : réservé membres + owner", () => {
  test("membre player EXISTANT (doc member SANS inviteCode — cas pilote) lit son club", async () => {
    const snap = await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A)));
    expect((snap as any).data()?.name).toBe("Club A");
  });

  test("coach (membre) lit son club", async () => {
    await assertSucceeds(getDoc(doc(asUser(COACH_A), "clubs", CLUB_A)));
  });

  test("owner SANS doc member lit son club (resource.data.ownerUid)", async () => {
    const OWNER = "ownerNoMember";
    const CLUB = "clubOwnerOnly";
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB), {
        name: "Club C",
        ownerUid: OWNER,
        inviteCode: "CLBC-0001",
      });
    });
    await assertSucceeds(getDoc(doc(asUser(OWNER), "clubs", CLUB)));
  });

  test("connecté hors club REFUSÉ ; membre d'un AUTRE club REFUSÉ ; anonyme REFUSÉ", async () => {
    await assertFails(getDoc(doc(asUser(STRANGER), "clubs", CLUB_A)));
    await assertFails(getDoc(doc(asUser(PLAYER_B), "clubs", CLUB_A)));
    await assertFails(getDoc(doc(asAnon(), "clubs", CLUB_A)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("3) Annuaire /inviteCodes/{code} : get par code exact, jamais de list", () => {
  test("connecté qui CONNAÎT le code résout le club (chemin du flux 'rejoindre')", async () => {
    const snap = await assertSucceeds(getDoc(doc(asUser(STRANGER), "inviteCodes", CLUB_A_INVITE)));
    expect((snap as any).data()?.clubId).toBe(CLUB_A);
  });

  test("get d'un code INEXISTANT autorisé (exists=false) — nécessaire au check d'unicité de createClub", async () => {
    const snap = await assertSucceeds(getDoc(doc(asUser(STRANGER), "inviteCodes", "ZZZZ-0000")));
    expect((snap as any).exists()).toBe(false);
  });

  test("anonyme REFUSÉ même avec le bon code", async () => {
    await assertFails(getDoc(doc(asAnon(), "inviteCodes", CLUB_A_INVITE)));
  });

  test("list de l'annuaire REFUSÉE (pas de récolte de codes)", async () => {
    await assertFails(getDocs(collection(asUser(STRANGER), "inviteCodes")));
    await assertFails(
      getDocs(query(collection(asUser(STRANGER), "inviteCodes"), orderBy(documentId()), limit(1))),
    );
  });

  test("create : owner du club avec code cohérent OK (séquence createClub réelle)", async () => {
    const NEWCOACH = "newCoach";
    const dbC = asUser(NEWCOACH);
    // 1. le coach crée son club (rule create clubs inchangée)…
    const clubRef = doc(collection(dbC, "clubs"));
    await assertSucceeds(
      setDoc(clubRef, { name: "Club Neuf", inviteCode: "NEUF-1234", ownerUid: NEWCOACH }),
    );
    // 2. …puis enregistre le code dans l'annuaire.
    await assertSucceeds(
      setDoc(doc(dbC, "inviteCodes", "NEUF-1234"), { clubId: clubRef.id, name: "Club Neuf" }),
    );
  });

  test("create REFUSÉ : non-owner, code incohérent, écrasement d'un code existant", async () => {
    // Un stranger ne peut pas planter un annuaire vers le club d'un autre.
    await assertFails(
      setDoc(doc(asUser(STRANGER), "inviteCodes", "FAKE-0001"), { clubId: CLUB_A, name: "Piège" }),
    );
    // L'owner lui-même ne peut pas enregistrer un code ≠ clubs/{id}.inviteCode.
    await assertFails(
      setDoc(doc(asUser(COACH_A), "inviteCodes", "AUTRE-9999"), { clubId: CLUB_A, name: "Club A" }),
    );
    // Un code déjà pris ne peut être ni écrasé (update interdit) ni supprimé.
    await assertFails(
      setDoc(doc(asUser(COACH_B), "inviteCodes", CLUB_A_INVITE), { clubId: CLUB_B, name: "Club B" }),
    );
    await assertFails(deleteDoc(doc(asUser(COACH_A), "inviteCodes", CLUB_A_INVITE)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("4) Self-join GATÉ par la preuve d'invitation", () => {
  test("join AVEC le bon code : membership créé, puis le nouveau membre lit club + weekContext", async () => {
    const dbS = asUser(STRANGER);
    await assertSucceeds(
      setDoc(doc(dbS, "clubs", CLUB_A, "members", STRANGER), memberDoc(STRANGER, CLUB_A_INVITE)),
    );
    // Devenu membre, il obtient les lectures d'un membre légitime.
    await assertSucceeds(getDoc(doc(dbS, "clubs", CLUB_A)));
    await assertSucceeds(getDoc(doc(dbS, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
  });

  test("join SANS code REFUSÉ (l'ancien trou)", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), memberDoc(STRANGER)),
    );
  });

  test("join avec un code FAUX ou celui d'un AUTRE club REFUSÉ", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), memberDoc(STRANGER, "XXXX-0000")),
    );
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), memberDoc(STRANGER, CLUB_B_INVITE)),
    );
  });

  test("join avec code mais type invalide (non-string) REFUSÉ", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        role: "player",
        inviteCode: 1234,
      }),
    );
  });

  test("écrire le membership de QUELQU'UN D'AUTRE reste refusé, même avec le bon code", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", "victime"), memberDoc("victime", CLUB_A_INVITE)),
    );
  });

  test("s'auto-promouvoir coach avec le code REFUSÉ (coach = owner only, inchangé)", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        role: "coach",
        inviteCode: CLUB_A_INVITE,
      }),
    );
  });

  test("update legacy sans preuve REFUSÉ ; re-join avec code OK ; la preuve STOCKÉE couvre les updates suivants", async () => {
    const ref = doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1);
    // Doc member LEGACY (seedé sans inviteCode, cas pilote) : une réécriture sans
    // fournir la preuve est refusée (l'état futur fusionné ne porte aucun code).
    await assertFails(updateDoc(ref, { uid: PLAYER_A1 }));
    // Re-join via le flux normal (le client envoie toujours le code) : accepté.
    await assertSucceeds(setDoc(ref, memberDoc(PLAYER_A1, CLUB_A_INVITE), { merge: true }));
    // Sémantique ASSUMÉE : request.resource.data (update) = état FUTUR fusionné.
    // La preuve étant désormais stockée dans le doc, un update qui la CONSERVE
    // passe — le code reste exigé à l'ENTRÉE, un membre déjà prouvé le reste.
    await assertSucceeds(updateDoc(ref, { updatedAt: "2026-07-21" }));
    // Mais corrompre la preuve (code faux dans l'état futur) est refusé.
    await assertFails(updateDoc(ref, { inviteCode: "XXXX-0000" }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("5) Compat membres/coach EXISTANTS (pilote) — rien ne bouge", () => {
  test("membre existant (doc member sans inviteCode) : club + weekContext + son member doc lisibles", async () => {
    const dbP = asUser(PLAYER_A1);
    await assertSucceeds(getDoc(doc(dbP, "clubs", CLUB_A)));
    await assertSucceeds(getDoc(doc(dbP, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertSucceeds(getDoc(doc(dbP, "clubs", CLUB_A, "members", PLAYER_A1)));
  });

  test("membre existant peut toujours QUITTER le club (delete de son member doc)", async () => {
    await assertSucceeds(deleteDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1)));
  });

  test("coach : roster members lisible, weekContext écrivable, club doc (code à partager) lisible", async () => {
    const dbC = asUser(COACH_A);
    await assertSucceeds(getDocs(collection(dbC, "clubs", CLUB_A, "members")));
    await assertSucceeds(getDoc(doc(dbC, "clubs", CLUB_A)));
    await assertSucceeds(
      setDoc(
        doc(dbC, "clubs", CLUB_A, "weekContexts", "2026-07-20"),
        { weekKey: "2026-07-20", clubId: CLUB_A, createdBy: COACH_A, trainingIntensity: "normal", weekGoal: "freshness" },
        { merge: true },
      ),
    );
  });

  test("owner met à jour son club (teamGender) comme avant", async () => {
    await assertSucceeds(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A), { teamGender: "female" }, { merge: true }),
    );
  });
});
