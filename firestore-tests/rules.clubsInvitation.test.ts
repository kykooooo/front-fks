// firestore-tests/rules.clubsInvitation.test.ts
//
// NOUVEAU CONTRAT D'INVITATION CLUB — vérification 100 % serveur.
//
// Ce fichier remplace intégralement la version précédente, qui prouvait la
// sécurité d'un contrat désormais abandonné (annuaire code→club lisible par
// tout compte connecté + membership "player" écrit par le client avec le code
// comme preuve). Ce que ce contrat-là ne pouvait pas faire, faute de serveur :
// compter les tentatives, cacher l'existence d'un club, expirer, révoquer,
// borner les usages.
//
// Ce qui est prouvé ici, côté RÈGLES uniquement :
//   1. les trois collections du contrat (inviteCodes, clubInviteMeta,
//      inviteAttempts) sont TOTALEMENT fermées aux clients — l'oracle
//      « ce code existe / n'existe pas » n'a plus de surface ;
//   2. un client ne peut PLUS créer ni modifier un membership "player" ;
//   3. les chemins légitimes existants ne sont pas cassés : le coach crée son
//      club et son propre membership coach, les membres lisent ce qu'ils
//      lisaient, un joueur peut toujours quitter son club.
//
// La validité d'un code (expiration, révocation, quota, limitation de
// tentatives, égalité des messages d'erreur) N'EST PAS testable ici : elle vit
// dans la Cloud Function. Ses tests sont dans functions/tests/inviteCodes.test.ts.

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
  orderBy,
  limit,
  documentId,
} from "firebase/firestore";
import {
  PROJECT_ID,
  CLUB_A,
  CLUB_A_CODE_HASH,
  COACH_A,
  PLAYER_A1,
  CLUB_B,
  COACH_B,
  PLAYER_B,
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

const playerMemberDoc = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid,
  role: "player",
  ...extra,
});

// ─────────────────────────────────────────────────────────────────────────────
describe("1) inviteCodes : FERMÉE à tous les clients (l'oracle disparaît)", () => {
  // Le doc seedé EXISTE : un refus prouve donc bien la règle, pas l'absence.
  test("get d'une empreinte EXISTANTE refusé : connecté, membre, coach, owner, anonyme", async () => {
    for (const db of [asUser(STRANGER), asUser(PLAYER_A1), asUser(COACH_A), asAnon()]) {
      await assertFails(getDoc(doc(db, "inviteCodes", CLUB_A_CODE_HASH)));
    }
  });

  test("get d'une empreinte INEXISTANTE refusé aussi — aucune différence observable", async () => {
    // C'était LE trou : l'ancien contrat répondait exists()=false sans erreur,
    // ce qui distinguait « code inconnu » de « code connu ». Les deux chemins
    // renvoient désormais la même chose : un refus.
    await assertFails(getDoc(doc(asUser(STRANGER), "inviteCodes", "0".repeat(64))));
  });

  test("list refusée (aucune récolte d'empreintes, même paginée)", async () => {
    await assertFails(getDocs(collection(asUser(STRANGER), "inviteCodes")));
    await assertFails(
      getDocs(query(collection(asUser(COACH_A), "inviteCodes"), orderBy(documentId()), limit(1))),
    );
  });

  test("create / update / delete refusés, y compris à l'owner du club", async () => {
    await assertFails(
      setDoc(doc(asUser(COACH_A), "inviteCodes", "f".repeat(64)), { clubId: CLUB_A, uses: 0 }),
    );
    await assertFails(updateDoc(doc(asUser(COACH_A), "inviteCodes", CLUB_A_CODE_HASH), { uses: 0 }));
    await assertFails(deleteDoc(doc(asUser(COACH_A), "inviteCodes", CLUB_A_CODE_HASH)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("2) clubInviteMeta / inviteAttempts : fermées elles aussi", () => {
  test("clubInviteMeta illisible et non écrivable (l'empreinte active reste hors de portée)", async () => {
    await assertFails(getDoc(doc(asUser(COACH_A), "clubInviteMeta", CLUB_A)));
    await assertFails(getDoc(doc(asUser(PLAYER_A1), "clubInviteMeta", CLUB_A)));
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubInviteMeta", CLUB_A), { activeCodeHash: "x" }),
    );
  });

  test("inviteAttempts illisible et non écrivable, y compris par le compte concerné", async () => {
    // Sinon un attaquant lirait son propre quota (« combien d'essais me
    // reste-t-il ? ») et pourrait remettre son compteur à zéro.
    await assertFails(getDoc(doc(asUser(STRANGER), "inviteAttempts", `uid_${STRANGER}`)));
    await assertFails(
      setDoc(doc(asUser(STRANGER), "inviteAttempts", `uid_${STRANGER}`), {
        failures: [],
        blockedUntil: null,
      }),
    );
    await assertFails(deleteDoc(doc(asUser(STRANGER), "inviteAttempts", `uid_${STRANGER}`)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("3) Membership player : plus AUCUNE écriture cliente", () => {
  test("self-join refusé, avec ou sans champ inviteCode résiduel", async () => {
    const db = asUser(STRANGER);
    await assertFails(
      setDoc(doc(db, "clubs", CLUB_A, "members", STRANGER), playerMemberDoc(STRANGER)),
    );
    // Un vieux build qui enverrait encore un code est refusé de la même façon :
    // le champ n'est plus une preuve, il n'est plus rien.
    await assertFails(
      setDoc(
        doc(db, "clubs", CLUB_A, "members", STRANGER),
        playerMemberDoc(STRANGER, { inviteCode: "CLBA-1234" }),
      ),
    );
  });

  test("un membre player EXISTANT ne peut plus réécrire son propre membership", async () => {
    // Écriture serveur seulement : le seul geste client qui reste sur son
    // membership, c'est de le supprimer (quitter le club).
    const ref = doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1);
    await assertFails(updateDoc(ref, { updatedAt: "2026-07-27" }));
    await assertFails(setDoc(ref, playerMemberDoc(PLAYER_A1), { merge: true }));
  });

  test("écrire le membership de QUELQU'UN D'AUTRE reste refusé", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", "victime"), playerMemberDoc("victime")),
    );
  });

  test("s'auto-promouvoir coach reste refusé (coach = owner du club uniquement)", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        role: "coach",
      }),
    );
    // Même un membre player du club ne peut pas se promouvoir.
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1), {
        uid: PLAYER_A1,
        role: "coach",
      }),
    );
  });

  test("le membership écrit par le SERVEUR ouvre bien les lectures du membre", async () => {
    // Simule ce que fait la Cloud Function (Admin SDK, hors règles).
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        role: "player",
        joinedAt: 1_753_600_000_000,
      });
    });
    const db = asUser(STRANGER);
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A)));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "members", STRANGER)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("4) Chemins légitimes préservés", () => {
  test("création de club + son propre membership PROPRIÉTAIRE (séquence createClubAsCoach)", async () => {
    // L'AMORÇAGE. À cet instant précis, le prédicat complet ne PEUT PAS être
    // vrai : le document de membre propriétaire n'existe pas encore. C'est la
    // seule règle qui s'appuie sur la désignation seule, et elle est bornée à
    // « j'écris mon propre document, avec le rôle owner, dans un club qui me
    // désigne déjà ».
    const NEWCOACH = "newCoach";
    const db = asUser(NEWCOACH);
    const clubRef = doc(collection(db, "clubs"));
    // Le club ne porte PLUS de code d'invitation : la Function l'émet à part.
    await assertSucceeds(setDoc(clubRef, { name: "Club Neuf", ownerUid: NEWCOACH }));
    await assertSucceeds(
      setDoc(doc(db, "clubs", clubRef.id, "members", NEWCOACH), { uid: NEWCOACH, role: "owner" }),
    );
    // Et le voilà encadrant : le rôle propriétaire ouvre le cadre de semaine.
    await assertSucceeds(
      setDoc(doc(db, "clubs", clubRef.id, "weekContexts", WEEK_KEY), {
        weekKey: WEEK_KEY,
        clubId: clubRef.id,
        createdBy: NEWCOACH,
        trainingIntensity: "normal",
        weekGoal: "freshness",
      }),
    );
  });

  test("le créateur ne peut PAS s'écrire en 'coach' : ce serait un club incohérent dès sa naissance", async () => {
    // `ownerUid` le désignerait sans que son appartenance le confirme —
    // exactement l'état que le prédicat d'autorité refuse. La règle ferme la
    // porte à la source plutôt que de laisser naître l'anomalie.
    const NEWCOACH = "newCoachBis";
    const db = asUser(NEWCOACH);
    const clubRef = doc(collection(db, "clubs"));
    await assertSucceeds(setDoc(clubRef, { name: "Club Neuf 2", ownerUid: NEWCOACH }));
    await assertFails(
      setDoc(doc(db, "clubs", clubRef.id, "members", NEWCOACH), { uid: NEWCOACH, role: "coach" }),
    );
  });

  test("TENTATIVE HOSTILE : s'écrire propriétaire dans le club d'un autre", async () => {
    // Le cœur de l'exception d'amorçage : elle se fonde sur `ownerUid`, donc
    // quelqu'un que le club ne désigne pas n'y entre jamais. Testé depuis un
    // inconnu ET depuis un membre EXISTANT du club — le second est le plus
    // tentant, puisqu'il a déjà un pied dedans.
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        role: "owner",
      }),
    );
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1), {
        uid: PLAYER_A1,
        role: "owner",
      }),
    );
    // Et on ne promeut pas non plus QUELQU'UN D'AUTRE au rôle propriétaire.
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", PLAYER_A1), {
        uid: PLAYER_A1,
        role: "owner",
      }),
    );
  });

  test("un non-owner ne peut pas se créer un membership coach dans le club d'un autre", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        role: "coach",
      }),
    );
  });

  test("membre existant : club, cadre de semaine et son propre membership lisibles", async () => {
    const db = asUser(PLAYER_A1);
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A)));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1)));
  });

  test("le document club ne transporte plus de code d'invitation", async () => {
    // Vérifie le CONTRAT DE DONNÉES : ce qu'un membre lit ne contient aucun
    // secret partageable. Avant, tout joueur pouvait recopier le code du club.
    const snap = await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A)));
    expect((snap as any).data()).not.toHaveProperty("inviteCode");
  });

  test("un joueur peut toujours QUITTER son club ; retirer QUELQU'UN D'AUTRE est serveur-seul", async () => {
    // Départ volontaire : inchangé, c'est le geste du joueur sur son propre doc.
    await assertSucceeds(deleteDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1)));
    // Retrait d'un AUTRE membre : REFUSÉ côté client, même au propriétaire. Une
    // suppression cliente ne saurait ni supprimer la projection déjà produite, ni
    // révoquer l'accès coach, ni nettoyer users/{uid}.clubId — elle n'en ferait
    // que le premier quart. Le geste complet vit dans la Cloud Function
    // `removeClubMember` (functions/src/clubMembers.ts).
    await assertFails(deleteDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", "playerA2")));
  });

  test("coach : roster lisible, cadre de semaine écrivable, club modifiable par l'owner", async () => {
    const db = asUser(COACH_A);
    await assertSucceeds(getDocs(collection(db, "clubs", CLUB_A, "members")));
    await assertSucceeds(
      setDoc(
        doc(db, "clubs", CLUB_A, "weekContexts", "2026-07-20"),
        {
          weekKey: "2026-07-20",
          clubId: CLUB_A,
          createdBy: COACH_A,
          trainingIntensity: "normal",
          weekGoal: "freshness",
        },
        { merge: true },
      ),
    );
    await assertSucceeds(setDoc(doc(db, "clubs", CLUB_A), { teamGender: "female" }, { merge: true }));
  });

  test("cloisonnement inter-clubs inchangé : membre du club B refusé sur le club A", async () => {
    await assertFails(getDoc(doc(asUser(PLAYER_B), "clubs", CLUB_A)));
    await assertFails(getDoc(doc(asUser(COACH_B), "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertFails(getDocs(collection(asUser(STRANGER), "clubs")));
    await assertFails(getDoc(doc(asAnon(), "clubs", CLUB_B)));
  });
});
