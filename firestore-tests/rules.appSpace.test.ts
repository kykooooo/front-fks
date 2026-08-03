// firestore-tests/rules.appSpace.test.ts
//
// LA BASE PERMET-ELLE VRAIMENT LA DÉRIVATION DE L'ESPACE AFFICHÉ ?
//
// L'application ne décide plus de l'espace (coach ou joueur) sur
// `users/{uid}.role` — un champ que son titulaire écrit lui-même — mais sur son
// APPARTENANCE au club : `clubs/{clubId}/members/{uid}.role`
// (cf. domain/appSpace.ts, hooks/useAppSpace.ts).
//
// Cette suite vérifie contre les VRAIES règles les deux conditions qui rendent
// ce choix possible, et honnête :
//
//   A. TOUT LE MONDE LIT SA PROPRE APPARTENANCE — propriétaire, coach, joueur,
//      pierre tombale. Sans ça, la dérivation demanderait un droit
//      supplémentaire ; elle n'en demande AUCUN, elle lit ce qui était déjà
//      lisible (`allow read: if isOwner(memberId)`).
//
//   B. PERSONNE NE S'ÉCRIT ENCADRANT. Un joueur ne peut fabriquer ni un rôle
//      "coach", ni un rôle "owner", ni sur lui-même ni sur autrui. C'est ce qui
//      fait de l'appartenance une autorité, et du champ applicatif un simple
//      affichage.
//
//   C. ET LE CHAMP APPLICATIF, LUI, N'EST MÊME PLUS ÉCRIVABLE.
//      Ce point a CHANGÉ (lot « écritures libres dans users/{uid} »). Il disait
//      auparavant : « le champ reste librement écrivable, c'est pourquoi il ne
//      peut pas porter une autorité — on a donc changé de source ». La source a
//      bien changé (l'appartenance), et depuis, le document utilisateur est
//      passé en LISTE BLANCHE : `role` fait partie des champs d'autorité gelés
//      (cf. rules.userDocument.test.ts). Les deux protections se doublent, et
//      c'est volontaire : l'espace ne dépend plus de ce champ, ET ce champ n'est
//      plus falsifiable.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { PROJECT_ID, CLUB_A, COACH_A, PLAYER_A1, PLAYER_A2, STRANGER, seed } from "./fixtures";

let testEnv: RulesTestEnvironment;

/** Membre du club A porteur d'une pierre tombale (retrait serveur). */
const RETIRE_A = "retireA";

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
    // Pierre tombale : le membre a été retiré par le serveur. Elle n'ouvre rien,
    // mais elle doit rester LISIBLE par son titulaire — c'est ce qui referme son
    // espace coach au lieu de le laisser sur un écran vide.
    await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", RETIRE_A), {
      uid: RETIRE_A,
      accessRole: null, playerStatus: "inactive",
    });
  });
});

// ── A. Chacun lit sa propre appartenance ───────────────────────────────────

describe("A. la dérivation ne demande AUCUN droit nouveau", () => {
  // LES DEUX AXES sont relus depuis le MÊME document : `accessRole` (permissions
  // d'encadrement) décide de l'espace coach, `playerStatus` (statut de joueur)
  // décide de l'espace joueur. C'est ce qui permet aux deux de coexister.
  test.each([
    ["propriétaire", COACH_A, "owner", null],
    ["joueur", PLAYER_A1, null, "active"],
    ["membre retiré (pierre tombale)", RETIRE_A, null, "inactive"],
  ])(
    "%s lit sa propre appartenance, et y trouve ses deux axes",
    async (_nom, uid, accessRole, playerStatus) => {
      const snap = await assertSucceeds(getDoc(doc(asUser(uid), "clubs", CLUB_A, "members", uid)));
      expect(snap.data()?.accessRole ?? null).toBe(accessRole);
      expect(snap.data()?.playerStatus ?? null).toBe(playerStatus);
    },
  );

  test("un ENTRAÎNEUR-JOUEUR lit les DEUX axes à la fois, dans un seul document", async () => {
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", "entraineurJoueur"), {
        uid: "entraineurJoueur",
        accessRole: "coach",
        playerStatus: "active",
        coachAccess: "approved",
      });
    });
    const snap = await assertSucceeds(
      getDoc(doc(asUser("entraineurJoueur"), "clubs", CLUB_A, "members", "entraineurJoueur")),
    );
    expect(snap.data()?.accessRole).toBe("coach");
    expect(snap.data()?.playerStatus).toBe("active");
  });

  test("un coach ordinaire lit la sienne aussi (c'est l'ancien propriétaire après transfert)", async () => {
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", "ancienProprio"), {
        uid: "ancienProprio",
        accessRole: "coach",
      });
    });
    const snap = await assertSucceeds(
      getDoc(doc(asUser("ancienProprio"), "clubs", CLUB_A, "members", "ancienProprio")),
    );
    expect(snap.data()?.accessRole).toBe("coach");
  });

  test("un compte sans appartenance lit un document ABSENT, pas un refus", async () => {
    // La différence compte : un refus serait indiscernable d'une panne, et
    // l'application afficherait « illisible » là où la vérité est « pas membre ».
    const snap = await assertSucceeds(
      getDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER)),
    );
    expect(snap.exists()).toBe(false);
  });

  test("mais personne ne lit l'appartenance d'AUTRUI sans être encadrant", async () => {
    await assertFails(getDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A2)));
  });
});

// ── B. Personne ne s'écrit encadrant ───────────────────────────────────────

describe("B. l'appartenance est une autorité : aucun client ne l'accorde", () => {
  test("un joueur ne peut pas se promouvoir coach", async () => {
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1),
        { uid: PLAYER_A1, accessRole: "coach" },
        { merge: true },
      ),
    );
  });

  test("un joueur ne peut pas se promouvoir propriétaire", async () => {
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1),
        { uid: PLAYER_A1, accessRole: "owner" },
        { merge: true },
      ),
    );
  });

  test("un joueur ne peut pas promouvoir quelqu'un d'autre", async () => {
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A2),
        { uid: PLAYER_A2, accessRole: "coach" },
        { merge: true },
      ),
    );
  });

  test("un membre retiré ne peut pas ressusciter son appartenance", async () => {
    await assertFails(
      setDoc(
        doc(asUser(RETIRE_A), "clubs", CLUB_A, "members", RETIRE_A),
        { uid: RETIRE_A, accessRole: "coach" },
        { merge: true },
      ),
    );
  });

  test("un étranger ne s'écrit pas membre d'un club qu'il ne possède pas", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        accessRole: "owner",
      }),
    );
  });
});

// ── C. Pourquoi le champ applicatif ne peut pas porter l'autorité ──────────

describe("C. `users/{uid}.role` ne décide plus rien — ET n'est plus écrivable du tout", () => {
  test("un joueur ne peut PLUS s'écrire role:\"coach\" sur son propre document", async () => {
    // C'était LA faille : la navigation lisait ce champ. Elle ne le lit plus —
    // c'est ce que prouve le test suivant, et c'était déjà vrai avant ce lot.
    // Ce qui CHANGE ici : le champ n'est même plus écrivable. Le document
    // utilisateur est passé en liste blanche (cf. rules.userDocument.test.ts),
    // et `role` fait partie des champs d'autorité gelés. Une surface qui
    // n'ouvrait plus rien restait une surface : elle est fermée.
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { role: "coach" }, { merge: true }),
    );
  });

  test("et même si le champ était déjà en base, il ne donne AUCUN accès d'encadrement", async () => {
    // On pose le mensonge EN ADMIN : un document ancien peut parfaitement le
    // porter (le champ était librement écrivable avant ce lot). Ce qui compte
    // est qu'il n'ouvre rien — hier comme aujourd'hui.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "users", PLAYER_A1),
        { uid: PLAYER_A1, clubId: CLUB_A, firstName: "Anna", role: "coach" },
      );
    });

    // Les surfaces d'encadrement restent fermées : son appartenance, elle, dit
    // toujours « player », et c'est elle que la base et l'application lisent.
    const db = asUser(PLAYER_A1);
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "coachNotes", "2026-06-29")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A2)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A2)));

    const membership = await assertSucceeds(
      getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1)),
    );
    // Son appartenance ne porte AUCUNE permission d'encadrement, et c'est elle
    // que la base et l'application lisent.
    expect(membership.data()?.accessRole ?? null).toBeNull();
    expect(membership.data()?.playerStatus).toBe("active");
  });
});

// ── D. Le statut de joueur est SERVEUR, comme coachAccess ──────────────────
// Sans ce verrou, n'importe qui s'inscrirait tout seul dans l'effectif suivi
// d'un club — c'est-à-dire contournerait le code d'invitation, son expiration,
// sa révocation, son quota d'usages ET la limitation de tentatives.

describe("D. `playerStatus` n'est écrivable par AUCUN client", () => {
  test("un joueur ne peut pas se poser lui-même un statut de joueur", async () => {
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1),
        { playerStatus: "active" },
        { merge: true },
      ),
    );
  });

  test("le PROPRIÉTAIRE non plus, pas même sur son propre document d'amorçage", async () => {
    await assertFails(
      setDoc(
        doc(asUser(COACH_A), "clubs", CLUB_A, "members", COACH_A),
        { uid: COACH_A, accessRole: "owner", playerStatus: "active" },
        { merge: true },
      ),
    );
  });

  test("un membre retiré ne peut pas se redonner un statut actif", async () => {
    await assertFails(
      setDoc(
        doc(asUser(RETIRE_A), "clubs", CLUB_A, "members", RETIRE_A),
        { playerStatus: "active" },
        { merge: true },
      ),
    );
  });
});
