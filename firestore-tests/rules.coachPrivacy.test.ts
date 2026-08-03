// firestore-tests/rules.coachPrivacy.test.ts
//
// LA SÉPARATION, PRONONCÉE PAR LA BASE.
//
// Deux concepts, deux collections, deux verdicts opposés — et c'est leur
// opposition qui fait la preuve :
//
//   clubs/{clubId}/coachNotes/{weekKey}  → NOTE PRIVÉE.
//       Aucun joueur ne la lit. Ni par `get`, ni par `list`, ni en devinant la
//       clé de semaine. Elle ne modifie aucune séance et ne sort d'aucun canal.
//
//   clubs/{clubId}/directives/{id}       → DIRECTIVE D'ENTRAÎNEMENT.
//       Le joueur DOIT pouvoir la lire : elle influence sa préparation. Ce qui
//       pèse sur l'entraînement de quelqu'un ne se cache pas.
//
// POURQUOI DES TEXTES SENSIBLES DANS LES FIXTURES. Un test qui écrirait « note
// de test » prouverait la permission, pas l'enjeu. On injecte donc ce qu'un
// coach écrit vraiment dans un pense-bête — un nom de blessure, une zone
// corporelle, un jugement personnel — et on vérifie que ce TEXTE ne franchit
// aucune frontière. Aucune donnée réelle : ces personnes n'existent pas.
//
// Le témoin en fin de fichier rejoue l'ANCIEN monde (la note dans le cadre de
// semaine) et prouve que le joueur y récoltait bien le texte sensible. Un test
// vert ne vaut que s'il aurait pu être rouge.

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
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import {
  PROJECT_ID,
  CLUB_A,
  COACH_A,
  PLAYER_A1,
  PLAYER_A2,
  PLAYER_B,
  COACH_B,
  STRANGER,
  WEEK_KEY,
  seed,
} from "./fixtures";

let testEnv: RulesTestEnvironment;

// Texte manifestement sensible : blessure nommée, zone corporelle, jugement.
const NOTE_SENSIBLE =
  "Rachid tendinite rotulienne genou droit, se plaint tout le temps, ne pas le titulariser dimanche";
const WEEK_PASSEE = "2026-06-22";
const DIRECTIVE_ID = "current";

// Une directive telle que le coach l'écrit : catégorie fermée + consigne courte.
const DIRECTIVE = {
  clubId: CLUB_A,
  objective: "prevention",
  instruction: "On garde les appuis, personne ne force sur les frappes cette semaine",
  validFrom: "2026-06-29",
  validUntil: "2026-07-13",
  active: true,
  createdBy: COACH_A,
};

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

type Db = ReturnType<typeof asUser>;
const noteRef = (db: Db, weekKey: string) => doc(db, "clubs", CLUB_A, "coachNotes", weekKey);
const noteCollection = (db: Db) => collection(db, "clubs", CLUB_A, "coachNotes");
const directiveRef = (db: Db, id = DIRECTIVE_ID) =>
  doc(db, "clubs", CLUB_A, "directives", id);
const directiveCollection = (db: Db) => collection(db, "clubs", CLUB_A, "directives");

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv);
  // Les documents EXISTENT vraiment. Sans cela, un refus de lecture ne
  // prouverait rien : on refuserait un document inexistant.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const weekKey of [WEEK_KEY, WEEK_PASSEE]) {
      await setDoc(doc(db, "clubs", CLUB_A, "coachNotes", weekKey), {
        weekKey,
        clubId: CLUB_A,
        createdBy: COACH_A,
        note: NOTE_SENSIBLE,
      });
    }
    await setDoc(doc(db, "clubs", CLUB_A, "directives", DIRECTIVE_ID), DIRECTIVE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("NOTE PRIVÉE — aucun joueur ne la lit, par aucun chemin", () => {
  test("1) un JOUEUR du club se voit refuser la note de la semaine courante (get)", async () => {
    await assertFails(getDoc(noteRef(asUser(PLAYER_A1), WEEK_KEY)));
  });

  test("2) deviner une semaine passée ne sert à rien : refusé aussi", async () => {
    // La faille résiduelle des cadres de semaine (clé = date de lundi, donc
    // devinable) ne s'applique pas ici : c'est la collection entière qui est
    // fermée au joueur, pas seulement une clé.
    await assertFails(getDoc(noteRef(asUser(PLAYER_A1), WEEK_PASSEE)));
  });

  test("3) la récolte en masse est fermée au joueur (list), pagination et filtre compris", async () => {
    const db = asUser(PLAYER_A1);
    await assertFails(getDocs(noteCollection(db)));
    await assertFails(getDocs(query(noteCollection(db), orderBy(documentId()), limit(1))));
    await assertFails(getDocs(query(noteCollection(db), where("weekKey", "==", WEEK_KEY))));
  });

  test("4) un autre joueur du club, un joueur d'un AUTRE club, un inconnu, un anonyme : tous refusés", async () => {
    for (const uid of [PLAYER_A2, PLAYER_B, COACH_B, STRANGER]) {
      await assertFails(getDoc(noteRef(asUser(uid), WEEK_KEY)));
      await assertFails(getDocs(noteCollection(asUser(uid))));
    }
    await assertFails(getDoc(noteRef(asAnon(), WEEK_KEY)));
  });

  test("5) un joueur ne peut pas non plus ÉCRIRE une note (ni s'en fabriquer une à lire)", async () => {
    await assertFails(
      setDoc(noteRef(asUser(PLAYER_A1), WEEK_KEY), { note: "test" }, { merge: true }),
    );
    await assertFails(
      setDoc(noteRef(asUser(PLAYER_A1), "2026-08-03"), { note: "test" }),
    );
  });

  test("6) le COACH du club, lui, lit et écrit sa note — c'est bien la sienne", async () => {
    const db = asUser(COACH_A);
    const snap = await assertSucceeds(getDoc(noteRef(db, WEEK_KEY)));
    // Contrôle par ÉGALITÉ DE CONTENU : le coach reçoit exactement son texte.
    // C'est ce qui donne du poids aux refus ci-dessus (le texte existe bien).
    expect((snap as any).data()?.note).toBe(NOTE_SENSIBLE);
    await assertSucceeds(
      setDoc(
        noteRef(db, "2026-08-03"),
        { weekKey: "2026-08-03", clubId: CLUB_A, createdBy: COACH_A, note: "jambes lourdes" },
      ),
    );
  });

  test("7) même le coach n'ÉNUMÈRE pas la collection (personne ne le fait dans le code)", async () => {
    await assertFails(getDocs(noteCollection(asUser(COACH_A))));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("DIRECTIVE — le joueur la lit, et lui seul ne l'écrit pas", () => {
  test("8) un JOUEUR du club lit la directive en cours, mot pour mot", async () => {
    const snap = await assertSucceeds(getDoc(directiveRef(asUser(PLAYER_A1))));
    expect((snap as any).data()?.instruction).toBe(DIRECTIVE.instruction);
    expect((snap as any).data()?.objective).toBe("prevention");
  });

  test("9) le coach lit et écrit la directive", async () => {
    const db = asUser(COACH_A);
    await assertSucceeds(getDoc(directiveRef(db)));
    await assertSucceeds(
      setDoc(directiveRef(db), { ...DIRECTIVE, instruction: "Reprise progressive" }),
    );
  });

  test("10) un joueur ne se prescrit PAS de directive", async () => {
    await assertFails(
      setDoc(directiveRef(asUser(PLAYER_A1)), { ...DIRECTIVE, objective: "speed" }),
    );
    await assertFails(
      setDoc(directiveRef(asUser(PLAYER_A1)), { active: false }, { merge: true }),
    );
  });

  test("11) un membre d'un AUTRE club et un inconnu ne lisent rien", async () => {
    for (const uid of [PLAYER_B, COACH_B, STRANGER]) {
      await assertFails(getDoc(directiveRef(asUser(uid))));
    }
    await assertFails(getDoc(directiveRef(asAnon())));
  });

  test("12) l'historique ne s'aspire pas : `list` fermée à tous, joueur comme coach", async () => {
    await assertFails(getDocs(directiveCollection(asUser(PLAYER_A1))));
    await assertFails(getDocs(directiveCollection(asUser(COACH_A))));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LA PREUVE PAR L'OPPOSITION. Les deux documents vivent sous le MÊME club, le
// même joueur les demande dans la même seconde : l'un est refusé, l'autre non.
// Ce n'est donc ni le club, ni le compte, ni le réseau qui décide — c'est la
// nature de la donnée.
describe("Le même joueur, deux verdicts opposés", () => {
  test("13) refus sur la note privée, succès sur la directive", async () => {
    const db = asUser(PLAYER_A1);
    await assertFails(getDoc(noteRef(db, WEEK_KEY)));
    const snap = await assertSucceeds(getDoc(directiveRef(db)));
    // Et le texte sensible n'a fui par aucun des deux canaux ouverts : ni par
    // la directive, ni par le cadre de semaine que le joueur a le droit de lire.
    const directiveBrute = JSON.stringify((snap as any).data());
    for (const mot of ["tendinite", "rotulienne", "Rachid", "titulariser"]) {
      expect(directiveBrute).not.toContain(mot);
    }
    const cadre = await assertSucceeds(
      getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)),
    );
    const cadreBrut = JSON.stringify((cadre as any).data());
    for (const mot of ["tendinite", "rotulienne", "Rachid", "titulariser"]) {
      expect(cadreBrut).not.toContain(mot);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN. On rejoue le monde d'AVANT — la note dans le cadre de semaine — et on
// prouve que le joueur y récupérait bien le texte sensible. Sans ce témoin, les
// refus ci-dessus pourraient n'être qu'un accident de configuration.
describe("Témoin : avant la séparation, le texte sensible arrivait vraiment au joueur", () => {
  const WITNESS_PROJECT = "demo-fks-rules-temoin-coachnote";

  test("14) note logée dans weekContexts → le joueur la lit intégralement", async () => {
    const witnessEnv = await initializeTestEnvironment({
      projectId: WITNESS_PROJECT,
      firestore: { rules: readFileSync(resolve(__dirname, "..", "firestore.rules"), "utf8") },
    });
    try {
      await witnessEnv.clearFirestore();
      // Écriture ADMIN : c'est exactement la situation d'un document rédigé
      // avant le bannissement du champ (la règle actuelle refuserait ce write
      // côté client — c'est justement ce que prouve rules.weekContexts).
      await witnessEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, "clubs", CLUB_A), { name: "Club A", ownerUid: COACH_A });
        await setDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1), {
          uid: PLAYER_A1,
          playerStatus: "active",
        });
        await setDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY), {
          weekKey: WEEK_KEY,
          trainingIntensity: "normal",
          note: NOTE_SENSIBLE,
        });
      });

      const db = witnessEnv.authenticatedContext(PLAYER_A1).firestore();
      const snap = await assertSucceeds(
        getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)),
      );
      // Voilà ce que recevait le téléphone de chaque joueur. Le même texte, dans
      // la collection coachNotes, lui est aujourd'hui refusé (tests 1 à 4).
      expect((snap as any).data()?.note).toBe(NOTE_SENSIBLE);
    } finally {
      await witnessEnv.cleanup();
    }
  });
});
