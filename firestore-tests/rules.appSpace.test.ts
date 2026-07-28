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
//   C. ET LE CHAMP APPLICATIF, LUI, EST BEL ET BIEN ÉCRIVABLE PAR SON TITULAIRE.
//      Ce test-là ne dénonce pas un trou à combler : il DOCUMENTE pourquoi ce
//      champ ne peut pas porter une autorité. Les règles autorisent chacun à
//      écrire tout son document `users/{uid}` (profil, préférences…) ; le
//      restreindre champ par champ serait un autre chantier, et ce ne serait de
//      toute façon pas une source d'autorité. On a donc changé de source.

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
      role: "removed",
    });
  });
});

// ── A. Chacun lit sa propre appartenance ───────────────────────────────────

describe("A. la dérivation ne demande AUCUN droit nouveau", () => {
  test.each([
    ["propriétaire", COACH_A, "owner"],
    ["joueur", PLAYER_A1, "player"],
    ["membre retiré (pierre tombale)", RETIRE_A, "removed"],
  ])("%s lit sa propre appartenance, et y trouve son rôle", async (_nom, uid, role) => {
    const snap = await assertSucceeds(
      getDoc(doc(asUser(uid), "clubs", CLUB_A, "members", uid)),
    );
    expect(snap.data()?.role).toBe(role);
  });

  test("un coach ordinaire lit la sienne aussi (c'est l'ancien propriétaire après transfert)", async () => {
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", "ancienProprio"), {
        uid: "ancienProprio",
        role: "coach",
      });
    });
    const snap = await assertSucceeds(
      getDoc(doc(asUser("ancienProprio"), "clubs", CLUB_A, "members", "ancienProprio")),
    );
    expect(snap.data()?.role).toBe("coach");
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
        { uid: PLAYER_A1, role: "coach" },
        { merge: true },
      ),
    );
  });

  test("un joueur ne peut pas se promouvoir propriétaire", async () => {
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1),
        { uid: PLAYER_A1, role: "owner" },
        { merge: true },
      ),
    );
  });

  test("un joueur ne peut pas promouvoir quelqu'un d'autre", async () => {
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A2),
        { uid: PLAYER_A2, role: "coach" },
        { merge: true },
      ),
    );
  });

  test("un membre retiré ne peut pas ressusciter son appartenance", async () => {
    await assertFails(
      setDoc(
        doc(asUser(RETIRE_A), "clubs", CLUB_A, "members", RETIRE_A),
        { uid: RETIRE_A, role: "coach" },
        { merge: true },
      ),
    );
  });

  test("un étranger ne s'écrit pas membre d'un club qu'il ne possède pas", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        role: "owner",
      }),
    );
  });
});

// ── C. Pourquoi le champ applicatif ne peut pas porter l'autorité ──────────

describe("C. `users/{uid}.role` est écrivable par son titulaire — donc il ne décide plus rien", () => {
  test("un joueur peut s'écrire role:\"coach\" sur son propre document", async () => {
    // C'était LA faille : la navigation lisait ce champ. Elle ne le lit plus.
    // L'écriture reste permise (chacun écrit son profil), elle n'ouvre plus rien.
    await assertSucceeds(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { role: "coach" }, { merge: true }),
    );
  });

  test("et ce mensonge ne lui donne AUCUN accès d'encadrement", async () => {
    await setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { role: "coach" }, { merge: true });

    // Les surfaces d'encadrement restent fermées : son appartenance, elle, dit
    // toujours « player », et c'est elle que la base et l'application lisent.
    const db = asUser(PLAYER_A1);
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "coachNotes", "2026-06-29")));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A2)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A2)));

    const membership = await assertSucceeds(
      getDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1)),
    );
    expect(membership.data()?.role).toBe("player");
  });
});
