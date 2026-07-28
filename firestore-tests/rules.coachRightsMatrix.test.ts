// firestore-tests/rules.coachRightsMatrix.test.ts
//
// MATRICE DES DROITS COACH — les 10 tentatives hostiles, une par test.
//
// Ce fichier ne teste PAS le chemin nominal (il vit dans les autres suites) : il
// teste ce qu'un attaquant essaierait, contre les VRAIES règles jouées par
// l'émulateur. Le tableau lisible correspondant est dans
// docs/coach-pilote-2026-07/MATRICE_DROITS_COACH.md.
//
// La promesse à prouver, mot pour mot : un coach ne peut lire QUE
//   son club · les joueurs de son club · dont l'accès est autorisé ·
//   et uniquement les données que le projecteur serveur a écrites.
//
// Les scénarios 1 à 8 et 10 sont des questions de RÈGLES : ils vivent ici. Le
// scénario 9 (appel direct à une Cloud Function) ne se joue pas contre les
// règles — l'Admin SDK les contourne par construction — il se joue contre la
// décision d'autorisation de la Function elle-même : functions/tests/
// callableRights.test.ts. Ce qui est prouvé ICI pour le scénario 9, c'est le
// versant règles : aucun client ne peut IMITER l'écriture que seule la Function
// a le droit de faire.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  PROJECT_ID,
  CLUB_A,
  CLUB_B,
  COACH_A,
  COACH_B,
  PLAYER_A1,
  PLAYER_A2,
  PLAYER_B,
  STRANGER,
  WEEK_KEY,
  SUMMARY,
  seed,
  seedPlayerSummary,
} from "./fixtures";

let testEnv: RulesTestEnvironment;

// Second coach du club A, NON owner : c'est le seul profil qui permet de tester
// un retrait réel (retirer l'owner ne lui retire pas la propriété du club).
const COACH_A2 = "coachA2";
// Joueurs dédiés aux états d'accès non autorisants.
const PLAYER_PENDING = "playerMatricePending"; // mineur, étape non faite
const PLAYER_REVOKED = "playerMatriceRevoked"; // accès retiré
// Club qui n'existe pas : sert à prouver qu'un identifiant deviné ne dit rien.
const CLUB_INEXISTANT = "clubQuiNExistePas";

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
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const admin = (fn: Parameters<RulesTestEnvironment["withSecurityRulesDisabled"]>[0]) =>
  testEnv.withSecurityRulesDisabled(fn);

const mkSummary = (uid: string) => ({ ...SUMMARY, playerUid: uid });

/** Membership + profil + projection présente, avec l'état d'accès demandé. */
async function seedPlayerWithAccess(uid: string, coachAccess: string): Promise<void> {
  await admin(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "clubs", CLUB_A, "members", uid), { uid, playerStatus: "active", coachAccess });
    await setDoc(doc(db, "users", uid), {
      uid,
      clubId: CLUB_A,
      playerStatus: "active",
      firstName: "Test",
      ageCategory: "U15",
      profileCompleted: true,
    });
    // La projection EXISTE : refuser un document absent ne prouverait rien.
    await setDoc(doc(db, "clubs", CLUB_A, "playerSummaries", uid), mkSummary(uid));
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv);
  await seedPlayerSummary(testEnv);
  // Second coach du club A (non owner) + projection pour playerA2, pour que les
  // refus portent tous sur de la donnée RÉELLE.
  await admin(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "clubs", CLUB_A, "members", COACH_A2), { uid: COACH_A2, accessRole: "coach" });
    await setDoc(doc(db, "users", COACH_A2), {
      uid: COACH_A2,
      clubId: CLUB_A,
      accessRole: "coach",
      firstName: "CoachBis",
      profileCompleted: true,
    });
    await setDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A2), mkSummary(PLAYER_A2));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. COACH D'UN AUTRE CLUB
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 1 — coach d'un autre club", () => {
  test("coachB, coach légitime de son club, ne lit RIEN du club A", async () => {
    const db = asUser(COACH_B);
    // Le club lui-même…
    await assertFails(getDoc(doc(db, "clubs", CLUB_A)));
    // …son effectif (en bloc et joueur par joueur)…
    await assertFails(getDocs(collection(db, "clubs", CLUB_A, "members")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1)));
    // …les projections de suivi (pourtant parfaitement autorisées côté joueur)…
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
    // …et le cadre de semaine du staff.
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));

    // Contrôle POSITIF : il n'est pas cassé, il est cloisonné — chez lui tout marche.
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_B)));
    await assertSucceeds(getDocs(collection(db, "clubs", CLUB_B, "members")));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. UTILISATEUR SANS RÔLE COACH
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 2 — utilisateur sans rôle Coach", () => {
  test("un joueur, membre du club, ne lit ni l'effectif ni le suivi de ses coéquipiers", async () => {
    const db = asUser(PLAYER_A1);
    // Surface coach : effectif complet.
    await assertFails(getDocs(collection(db, "clubs", CLUB_A, "members")));
    // Membership d'un coéquipier (il verrait son état d'autorisation).
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A2)));
    // Projection de suivi d'un coéquipier…
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A2)));
    // …ET LA SIENNE : la projection est faite POUR le coach, elle n'est pas une
    // surface de lecture joueur (le joueur a ses documents bruts pour cela).
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));

    // Contrôle POSITIF : ce qui lui revient marche toujours.
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1)));
    await assertSucceeds(getDoc(doc(db, "users", PLAYER_A1)));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A)));
  });

  test("s'auto-déclarer coach ne donne rien : le rôle n'est pas écrivable par le joueur", async () => {
    // La seule façon d'être coach est d'être l'owner du club (règle members).
    const db = asUser(PLAYER_A1);
    await assertFails(
      setDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1), { uid: PLAYER_A1, accessRole: "coach" }),
    );
    // Et mentir dans son PROPRE profil (users/{uid}.role = "coach") — écriture
    // autorisée puisque c'est son document — n'ouvre aucune porte : les règles
    // club ne lisent jamais ce champ.
    await assertSucceeds(setDoc(doc(db, "users", PLAYER_A1), { role: "coach" }, { merge: true }));
    await assertFails(getDocs(collection(db, "clubs", CLUB_A, "members")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A2)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. ANCIEN COACH RETIRÉ DU CLUB
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 3 — ancien coach retiré du club", () => {
  test("un coach dont le membership est supprimé perd tout accès, immédiatement", async () => {
    const db = asUser(COACH_A2);
    // Avant : il voit ce qu'un coach voit.
    await assertSucceeds(getDocs(collection(db, "clubs", CLUB_A, "members")));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));

    // Le retrait d'un AUTRE membre n'est plus un geste client : il passe par la
    // Cloud Function `removeClubMember` (Admin SDK, qui contourne ces règles).
    // On rejoue donc ici ce que le SERVEUR écrit, et on mesure l'effet sur les
    // règles — c'est exactement ce que ce fichier doit prouver.
    await admin(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A2));
    });

    // Après : plus rien, sans aucune autre action (pas de révocation de jeton,
    // pas d'attente). Y compris les projections DÉJÀ écrites.
    await assertFails(getDocs(collection(db, "clubs", CLUB_A, "members")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A)));
  });

  test("la PIERRE TOMBALE du retrait ferme autant qu'une suppression", async () => {
    // Le retrait serveur ne supprime pas le document : il le désactive
    // (`accessRole: null, playerStatus: "inactive"`), pour que le refus vienne de l'ÉTAT et non de l'ordre
    // d'arrivée des événements. Ce test vérifie que « désactivé » vaut bien
    // « parti » du point de vue des règles — sinon la pierre tombale serait un
    // trou déguisé en trace d'audit.
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A2), {
        uid: COACH_A2,
        accessRole: null, playerStatus: "inactive",
        coachAccess: "revoked",
        removedAt: 1_753_600_000_000,
        removedBy: COACH_A,
      });
    });
    const db = asUser(COACH_A2);
    await assertFails(getDocs(collection(db, "clubs", CLUB_A, "members")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "directives", "current")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A)));
    // Son PROPRE document reste lisible : il n'a rien à cacher, et c'est ce qui
    // permet à l'application de comprendre son propre état.
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "members", COACH_A2)));
  });

  test("LIMITE FERMÉE : retirer le propriétaire de l'effectif lui retire bien ses droits", async () => {
    // CE TEST AFFIRMAIT L'INVERSE JUSQU'À CE LOT, et le disait sans détour :
    // « `isClubOwner` ne dépend pas du membership mais de clubs/{id}.ownerUid »,
    // donc un fondateur écarté gardait TOUT tant que `ownerUid` n'avait pas
    // changé. C'était la limite portée dans la section « à trancher » du rapport.
    //
    // Le prédicat d'autorité la ferme : la désignation ne suffit plus, il faut
    // AUSSI l'appartenance propriétaire. Ce qui reste ouvert est délibéré et
    // borné : la lecture du document club, pour que l'anomalie soit constatable
    // au lieu de faire disparaître le club en silence.
    await admin(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A));
    });
    const db = asUser(COACH_A);
    await assertFails(getDocs(collection(db, "clubs", CLUB_A, "members")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "coachNotes", WEEK_KEY)));
    await assertFails(
      setDoc(doc(db, "clubs", CLUB_A), { teamGender: "male" }, { merge: true }),
    );
    // Seule survivance, VOULUE : le club se lit encore.
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A)));
  });

  test("le PROPRIÉTAIRE ne peut pas se retirer lui-même de l'effectif", async () => {
    // Sa disparition fabriquerait exactement l'état incohérent que l'invariant
    // refuse. Le geste à faire est le transfert de propriété — la Cloud Function
    // le dit avec OWNER_TRANSFER_REQUIRED, la règle le rend impossible même en
    // passant à côté de l'écran.
    await assertFails(
      deleteDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", COACH_A)),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. MEMBRE RÉVOQUÉ
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 4 — membre révoqué", () => {
  test("un joueur dont l'accès est retiré n'est plus consultable, même avec une projection en base", async () => {
    await seedPlayerWithAccess(PLAYER_REVOKED, "revoked");
    const db = asUser(COACH_A);

    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_REVOKED)));
    // Le membership, lui, reste lisible : le coach doit pouvoir compter son
    // effectif sans lire la moindre donnée de suivi. Trois notions, trois portes.
    const member = await assertSucceeds(
      getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_REVOKED)),
    );
    expect((member as any).data()?.coachAccess).toBe("revoked");
  });

  test("la révocation d'un joueur DÉJÀ consultable ferme la porte sans délai", async () => {
    const db = asUser(COACH_A);
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
    await admin(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", PLAYER_A1), {
        coachAccess: "revoked",
      });
    });
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. MINEUR EN ATTENTE
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 5 — mineur en attente", () => {
  test("un joueur en attente est membre du club mais n'est pas consultable", async () => {
    await seedPlayerWithAccess(PLAYER_PENDING, "pending");
    const db = asUser(COACH_A);

    // Il EXISTE pour le coach (effectif)…
    const member = await assertSucceeds(
      getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_PENDING)),
    );
    expect((member as any).data()?.playerStatus).toBe("active");
    // …mais aucune donnée de suivi ne sort, alors que la projection est en base.
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_PENDING)));
  });

  test("un membership ANCIEN, écrit avant l'existence du champ, ne consulte rien non plus", async () => {
    // Fail-closed sur champ absent : c'est ce qui protège les rattachements
    // antérieurs au mécanisme d'autorisation.
    await admin(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "clubs", CLUB_A, "members", "playerAncien"), {
        uid: "playerAncien",
        playerStatus: "active",
      });
      await setDoc(
        doc(db, "clubs", CLUB_A, "playerSummaries", "playerAncien"),
        mkSummary("playerAncien"),
      );
    });
    await assertFails(
      getDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "playerSummaries", "playerAncien")),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. IDENTIFIANT DE CLUB DEVINÉ
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 6 — identifiant de club deviné", () => {
  test("un inconnu qui connaît l'identifiant d'un club n'en tire rien, et n'apprend même pas s'il existe", async () => {
    const db = asUser(STRANGER);
    // Club RÉEL, identifiant exact.
    await assertFails(getDoc(doc(db, "clubs", CLUB_A)));
    await assertFails(getDocs(collection(db, "clubs", CLUB_A, "members")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));

    // Club INEXISTANT : mêmes refus. Aucune différence observable entre
    // « ce club existe mais tu n'y es pas » et « ce club n'existe pas » — donc
    // aucun oracle d'existence côté base.
    await assertFails(getDoc(doc(db, "clubs", CLUB_INEXISTANT)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_INEXISTANT, "members", PLAYER_A1)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_INEXISTANT, "playerSummaries", PLAYER_A1)));

    // Et il ne peut pas non plus se fabriquer une entrée.
    await assertFails(
      setDoc(doc(db, "clubs", CLUB_A, "members", STRANGER), { uid: STRANGER, playerStatus: "active" }),
    );
    // Non authentifié : identique.
    await assertFails(getDoc(doc(asAnon(), "clubs", CLUB_A)));
  });

  test("se déclarer membre du club A dans son PROPRE profil ne rattache à rien", async () => {
    // users/{uid} est écrivable par son propriétaire : un intrus peut donc y
    // écrire clubId = clubA. Les règles club ne lisent JAMAIS ce champ (elles
    // vérifient le membership réel), donc ce mensonge n'ouvre aucune porte.
    const db = asUser(STRANGER);
    await assertSucceeds(
      setDoc(doc(db, "users", STRANGER), { uid: STRANGER, clubId: CLUB_A }, { merge: true }),
    );
    await assertFails(getDoc(doc(db, "clubs", CLUB_A)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. IDENTIFIANT DE JOUEUR CONNU MAIS NON AUTORISÉ
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 7 — identifiant de joueur connu mais non autorisé", () => {
  test("connaître l'uid d'un joueur ne sert à rien : la décision est prise document par document", async () => {
    await seedPlayerWithAccess(PLAYER_PENDING, "pending");
    const db = asUser(COACH_A);

    // Le coach connaît l'uid — il l'a lu dans son propre effectif.
    const members = await assertSucceeds(getDocs(collection(db, "clubs", CLUB_A, "members")));
    const ids = (members as any).docs.map((d: any) => d.id);
    expect(ids).toContain(PLAYER_PENDING);

    // Il ne peut pourtant pas lire son suivi.
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_PENDING)));
    // Ni ses documents bruts (le nom du joueur, ses séances) par un autre chemin.
    await assertFails(getDoc(doc(db, "users", PLAYER_PENDING)));

    // Un uid d'un AUTRE club, même connu, ne donne rien non plus — y compris si
    // une projection à son nom a été déposée sous le club A.
    await admin(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_B),
        mkSummary(PLAYER_B),
      );
    });
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_B)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. LECTURE DIRECTE FIRESTORE
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 8 — lecture directe Firestore", () => {
  test("le coach ne touche AUCUN document brut : profil, séances faites, séances prévues", async () => {
    const db = asUser(COACH_A);
    // Ces documents contiennent douleur, commentaire libre, RPE, ATL/CTL/TSB et
    // le blueprint IA. Ils sont la raison d'être de la projection coach-safe.
    await assertFails(getDoc(doc(db, "users", PLAYER_A1)));
    await assertFails(getDoc(doc(db, "users", PLAYER_A1, "sessions", "s1")));
    await assertFails(getDoc(doc(db, "users", PLAYER_A1, "plannedSessions", "p1")));
    await assertFails(getDocs(collection(db, "users", PLAYER_A1, "sessions")));
    await assertFails(getDocs(collection(db, "users", PLAYER_A1, "plannedSessions")));
  });

  test("les surfaces 100 % serveur du contrat d'invitation restent fermées au coach", async () => {
    const db = asUser(COACH_A);
    await assertFails(getDoc(doc(db, "clubInviteMeta", CLUB_A)));
    await assertFails(getDocs(collection(db, "inviteCodes")));
    await assertFails(getDocs(collection(db, "inviteAttempts")));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. APPEL DIRECT À UNE FUNCTION — versant règles
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 9 — versant règles : imiter l'écriture serveur est impossible", () => {
  test("aucun client ne peut écrire ce que seule la Cloud Function a le droit d'écrire", async () => {
    // La Function (Admin SDK) contourne les règles PAR CONSTRUCTION. La question
    // n'est donc pas « les règles arrêtent-elles la Function ? » (non, et c'est
    // voulu) mais « un client peut-il produire le même effet sans elle ? ».
    // La décision d'autorisation de la Function est testée dans
    // functions/tests/callableRights.test.ts.

    // a) le membership player (rattachement) — réservé au serveur.
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        playerStatus: "active",
      }),
    );
    // b) l'état d'autorisation d'accès — ni le joueur, ni le coach, ni l'owner.
    await assertFails(
      updateDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1), {
        coachAccess: "approved",
      }),
    );
    await assertFails(
      updateDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", PLAYER_A1), {
        coachAccess: "approved",
      }),
    );
    // c) la projection elle-même — write: if false pour tout le monde.
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "playerSummaries", PLAYER_A1), {
        ...mkSummary(PLAYER_A1),
        firstName: "Hack",
      }),
    );
    // d) les compteurs de tentatives (remettre son quota à zéro).
    await assertFails(
      setDoc(doc(asUser(STRANGER), "inviteAttempts", `uid_${STRANGER}`), {
        failures: [],
        blockedUntil: null,
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. PAGINATION OU RECHERCHE CONTOURNANT LE FILTRE
// ═════════════════════════════════════════════════════════════════════════════
describe("Scénario 10 — pagination ou recherche contournant le filtre", () => {
  test("playerSummaries : aucune lecture de COLLECTION, quelle qu'en soit la forme", async () => {
    // La règle dépend de l'ID du document (le joueur est-il encore membre ? son
    // accès est-il autorisé ?). Une opération `list` ne peut pas l'évaluer par
    // document : elle est donc refusée EN BLOC — y compris pour un coach
    // parfaitement légitime dont tous les joueurs sont autorisés. C'est le
    // comportement voulu, et c'est pour cela que le lecteur front lit
    // l'effectif puis CHAQUE projection par son identifiant.
    const db = asUser(COACH_A);
    const col = collection(db, "clubs", CLUB_A, "playerSummaries");
    await assertFails(getDocs(col));
    await assertFails(getDocs(query(col, limit(1))));
    await assertFails(getDocs(query(col, orderBy(documentId()), limit(1))));
    await assertFails(getDocs(query(col, where("playerUid", "==", PLAYER_A1))));
    await assertFails(getDocs(query(col, orderBy("firstName"), limit(50))));

    // Contrôle POSITIF : le chemin légitime (par identifiant) fonctionne.
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
  });

  test("collection group : le préfixe de chemin ne peut pas être contourné", async () => {
    // Le plus subtil des contournements : une requête collectionGroup interroge
    // TOUTES les sous-collections du même nom, tous clubs confondus, sans passer
    // par le chemin /clubs/{clubId}/. Si les règles s'appuyaient sur autre chose
    // que ce préfixe, tout le cloisonnement tomberait ici.
    for (const uid of [COACH_A, COACH_B, PLAYER_A1, STRANGER]) {
      const db = asUser(uid);
      await assertFails(getDocs(collectionGroup(db, "playerSummaries")));
      await assertFails(getDocs(collectionGroup(db, "members")));
      await assertFails(getDocs(collectionGroup(db, "weekContexts")));
    }
  });

  test("collection group : chercher SON PROPRE uid ne révèle pas les autres clubs", async () => {
    // Tentative crédible : « où suis-je membre ? » via une recherche sur le champ
    // uid. Refusée — l'appartenance ne se découvre pas par requête.
    const db = asUser(PLAYER_A1);
    await assertFails(
      getDocs(query(collectionGroup(db, "members"), where("uid", "==", PLAYER_A1))),
    );
    await assertFails(
      getDocs(query(collectionGroup(db, "playerSummaries"), where("playerUid", "==", PLAYER_A1))),
    );
  });

  test("collection group : les séances brutes d'autrui restent hors d'atteinte", async () => {
    for (const uid of [COACH_A, STRANGER]) {
      const db = asUser(uid);
      await assertFails(getDocs(collectionGroup(db, "sessions")));
      await assertFails(getDocs(collectionGroup(db, "plannedSessions")));
    }
  });

  test("users : impossible de retrouver les profils bruts d'un club par recherche", async () => {
    // La tentation côté coach : « donne-moi tous les users dont clubId == monClub ».
    // Le profil brut porte tout ce que la projection filtre — cette porte n'existe pas.
    const db = asUser(COACH_A);
    await assertFails(getDocs(collection(db, "users")));
    await assertFails(getDocs(query(collection(db, "users"), where("clubId", "==", CLUB_A))));
    await assertFails(getDocs(query(collection(db, "users"), orderBy(documentId()), limit(5))));
  });

  test("clubs : l'annuaire reste fermé, même paginé une entrée à la fois", async () => {
    for (const uid of [COACH_A, PLAYER_A1, STRANGER]) {
      const db = asUser(uid);
      await assertFails(getDocs(collection(db, "clubs")));
      await assertFails(getDocs(query(collection(db, "clubs"), orderBy(documentId()), limit(1))));
      await assertFails(getDocs(query(collection(db, "clubs"), where("name", "==", "Club A"))));
    }
  });

  test("members : une list donne au coach exactement ce qu'un get lui donnerait, et rien de plus", async () => {
    // Seul endroit où la lecture de collection est ouverte. On vérifie donc deux
    // choses : elle ne dépasse pas le club du chemin, et elle est fermée au joueur
    // (qui ne peut lire que SON document — ici, `list` ouvre STRICTEMENT MOINS
    // que la somme des `get` autorisés, jamais plus).
    const coachDb = asUser(COACH_A);
    const snap = await assertSucceeds(getDocs(collection(coachDb, "clubs", CLUB_A, "members")));
    const clubsTouches = new Set(
      (snap as any).docs.map((d: any) => d.ref.parent.parent?.id as string),
    );
    expect([...clubsTouches]).toEqual([CLUB_A]);
    // Le document member ne transporte que de l'appartenance : jamais de suivi.
    for (const d of (snap as any).docs) {
      const data = d.data();
      for (const cleInterdite of ["pain", "fatigue", "rpe", "tsb", "atl", "ctl", "comment"]) {
        expect(data).not.toHaveProperty(cleInterdite);
      }
    }

    const playerDb = asUser(PLAYER_A1);
    await assertFails(getDocs(collection(playerDb, "clubs", CLUB_A, "members")));
    await assertFails(
      getDocs(query(collection(playerDb, "clubs", CLUB_A, "members"), limit(1))),
    );
    await assertSucceeds(getDoc(doc(playerDb, "clubs", CLUB_A, "members", PLAYER_A1)));
  });

  test("weekContexts : la récolte en masse est fermée (détail dans rules.weekContexts.test.ts)", async () => {
    // Rappel dans la matrice : c'était la seule collection où une `list` ouvrait
    // davantage qu'un `get` — tout l'historique des cadres du staff d'un coup.
    await assertFails(getDocs(collection(asUser(PLAYER_A1), "clubs", CLUB_A, "weekContexts")));
    await assertFails(getDocs(collection(asUser(COACH_A), "clubs", CLUB_A, "weekContexts")));
    await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
  });
});
