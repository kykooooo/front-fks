// firestore-tests/rules.weekContexts.test.ts
//
// FUITE FERMÉE (2026-07) : la RÉCOLTE EN MASSE des cadres de semaine du coach.
//
// Ce qui était ouvert. `clubs/{clubId}/weekContexts` était couverte par un seul
// `allow read`, qui vaut pour `get` ET pour `list`. La condition ne portait ni
// sur le contenu du document ni sur la weekKey : n'importe quel membre du club
// pouvait donc faire UN getDocs et repartir avec TOUTES les semaines — intensité,
// objectif, match, et la note libre de 200 caractères écrite par le coach —
// y compris les semaines passées. Un intrus devenu membre (ou un joueur curieux)
// obtenait l'historique complet du staff en une requête.
//
// Ce qui est fermé. `list` est désormais refusée à TOUT LE MONDE, coach et owner
// compris : aucun chemin de l'application n'énumère cette collection (vérifié —
// clubsRepo, aiContext et l'écran coach lisent tous UN document par sa clé).
//
// Ce qui reste ouvert, et pourquoi. Le `get` d'UN cadre par un membre du club :
// c'est le geste dont la génération de séance a besoin (le cadre du coach entre
// dans le contexte envoyé au backend). La note libre y reste lisible : une règle
// Firestore autorise ou refuse un DOCUMENT, elle ne masque pas un champ. Cette
// limite est écrite noir sur blanc dans la section « à trancher » de
// docs/coach-pilote-2026-07/MATRICE_DROITS_COACH.md — elle n'est pas maquillée
// par un test complaisant : le dernier test de ce fichier la PROUVE.

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
  PLAYER_B,
  COACH_B,
  STRANGER,
  WEEK_KEY,
  seed,
} from "./fixtures";

let testEnv: RulesTestEnvironment;

// Semaines PASSÉES, seedées en admin : c'est ce qu'un membre pouvait aspirer.
const WEEK_PAST_1 = "2026-06-22";
const WEEK_PAST_2 = "2026-06-15";
const NOTE_STAFF = "gros match dimanche, garder les jambes fraiches";

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

const weekRef = (db: ReturnType<typeof asUser>, weekKey: string) =>
  doc(db, "clubs", CLUB_A, "weekContexts", weekKey);
const weekCollection = (db: ReturnType<typeof asUser>) =>
  collection(db, "clubs", CLUB_A, "weekContexts");

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv);
  // Historique du staff : deux semaines de plus, dont une avec la note libre.
  // Les documents EXISTENT vraiment — sans cela, un refus de `list` ne prouverait
  // rien (on refuserait une collection vide).
  await admin(async (ctx) => {
    const db = ctx.firestore();
    for (const [weekKey, note] of [
      [WEEK_PAST_1, NOTE_STAFF],
      [WEEK_PAST_2, null],
    ] as const) {
      await setDoc(doc(db, "clubs", CLUB_A, "weekContexts", weekKey), {
        weekKey,
        clubId: CLUB_A,
        createdBy: COACH_A,
        trainingIntensity: "normal",
        weekGoal: "freshness",
        note,
        matchThisWeekend: false,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("La récolte en masse est fermée (list)", () => {
  test("1) un JOUEUR du club ne peut plus aspirer la collection des cadres", async () => {
    await assertFails(getDocs(weekCollection(asUser(PLAYER_A1))));
  });

  test("2) la pagination ne rouvre rien : orderBy/limit(1) refusé aussi", async () => {
    // Le contournement classique d'une collection fermée : la lire document par
    // document en paginant. La règle ne dépend d'aucun contenu, donc rien à
    // grappiller — le refus porte sur l'opération `list` elle-même.
    await assertFails(
      getDocs(query(weekCollection(asUser(PLAYER_A1)), orderBy(documentId()), limit(1))),
    );
  });

  test("3) une recherche filtrée est refusée elle aussi (where sur weekKey)", async () => {
    await assertFails(
      getDocs(query(weekCollection(asUser(PLAYER_A1)), where("weekKey", "==", WEEK_PAST_1))),
    );
  });

  test("4) le COACH et l'OWNER non plus : personne n'énumère cette collection", async () => {
    // Choix délibéré : aucun chemin de l'application ne fait de getDocs ici.
    // Une porte que personne n'emprunte est une porte qu'on ferme.
    await assertFails(getDocs(weekCollection(asUser(COACH_A))));
  });

  test("5) un membre d'un AUTRE club et un inconnu : refusés, list comme get", async () => {
    for (const uid of [COACH_B, PLAYER_B, STRANGER]) {
      await assertFails(getDocs(weekCollection(asUser(uid))));
      await assertFails(getDoc(weekRef(asUser(uid), WEEK_KEY)));
    }
    await assertFails(getDocs(weekCollection(asAnon())));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Le geste légitime reste possible (get d'UN cadre)", () => {
  test("6) le joueur lit le cadre de la semaine par sa clé exacte (génération de séance)", async () => {
    // services/aiContext.ts fait exactement ce getDoc pour la semaine courante.
    // Le casser aurait retiré le cadre du coach de la génération, en silence.
    const snap = await assertSucceeds(getDoc(weekRef(asUser(PLAYER_A1), WEEK_KEY)));
    expect((snap as any).data()?.weekKey).toBe(WEEK_KEY);
  });

  test("7) le coach lit et écrit le cadre de la semaine affichée", async () => {
    const db = asUser(COACH_A);
    await assertSucceeds(getDoc(weekRef(db, WEEK_KEY)));
    await assertSucceeds(
      setDoc(
        weekRef(db, "2026-07-20"),
        {
          weekKey: "2026-07-20",
          clubId: CLUB_A,
          createdBy: COACH_A,
          trainingIntensity: "light",
          weekGoal: "freshness",
        },
        { merge: true },
      ),
    );
  });

  test("8) un joueur n'écrit jamais un cadre, même le sien", async () => {
    await assertFails(
      setDoc(weekRef(asUser(PLAYER_A1), WEEK_KEY), { trainingIntensity: "light" }, { merge: true }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Ce qui RESTE ouvert — prouvé, pas masqué", () => {
  test("9) une weekKey PASSÉE reste lisible par un membre, un document à la fois", async () => {
    // Limite assumée : une weekKey est une date de lundi, donc devinable. La
    // récolte en masse est fermée, l'accès unitaire ne l'est pas. Ce test existe
    // pour que cette vérité soit VISIBLE dans la suite, et pas seulement dans un
    // document. Le jour où on la ferme, ce test devra devenir un assertFails.
    await assertSucceeds(getDoc(weekRef(asUser(PLAYER_A1), WEEK_PAST_1)));
  });

  test("10) la note libre du coach est lisible par le joueur (une règle ne masque pas un champ)", async () => {
    const snap = await assertSucceeds(getDoc(weekRef(asUser(PLAYER_A1), WEEK_PAST_1)));
    // Fait mesuré, pas souhaité : la note écrite par le coach arrive telle quelle
    // sur l'appareil du joueur. L'écran joueur ne l'affiche pas — mais ne rien
    // afficher n'est PAS une protection (cf. section « à trancher » du rapport).
    expect((snap as any).data()?.note).toBe(NOTE_STAFF);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN. Un test vert ne vaut que s'il aurait pu être rouge. Celui-ci rejoue la
// règle TELLE QU'ELLE ÉTAIT (un seul `allow read`) dans un projet émulateur
// séparé, et prouve que la récolte en masse y réussissait. Si quelqu'un remet un
// jour `allow read` à la place du couple get/list, le test 1 redeviendra rouge —
// et voici la preuve qu'il ne s'agissait pas d'un refus obtenu par hasard.
describe("Témoin : la règle d'avant laissait vraiment passer la récolte", () => {
  const WITNESS_PROJECT = "demo-fks-rules-temoin-weekcontexts";

  test("11) avec l'ancien `allow read`, un joueur aspirait TOUTES les semaines d'un coup", async () => {
    const current = readFileSync(resolve(__dirname, "..", "firestore.rules"), "utf8");
    // On restaure LITTÉRALEMENT la formulation d'avant sur ce seul bloc.
    // La fin de ligne est laissée libre (\r\n possible selon le checkout Windows) :
    // un témoin qui dépendrait de l'historique git ne prouverait rien.
    const before = current.replace(
      /allow get: if isClubMember\(clubId\) \|\| isClubOwner\(clubId\);\s*\r?\n\s*allow list: if false;/,
      "allow read: if isClubMember(clubId) || isClubOwner(clubId);",
    );
    expect(before).not.toBe(current); // le remplacement a bien eu lieu

    const witnessEnv = await initializeTestEnvironment({
      projectId: WITNESS_PROJECT,
      firestore: { rules: before },
    });
    try {
      await witnessEnv.clearFirestore();
      await witnessEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, "clubs", CLUB_A), { name: "Club A", ownerUid: COACH_A });
        await setDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1), {
          uid: PLAYER_A1,
          role: "player",
        });
        for (const weekKey of [WEEK_KEY, WEEK_PAST_1, WEEK_PAST_2]) {
          await setDoc(doc(db, "clubs", CLUB_A, "weekContexts", weekKey), {
            weekKey,
            clubId: CLUB_A,
            createdBy: COACH_A,
            note: NOTE_STAFF,
          });
        }
      });

      const db = witnessEnv.authenticatedContext(PLAYER_A1).firestore();
      const snap = await assertSucceeds(
        getDocs(collection(db, "clubs", CLUB_A, "weekContexts")),
      );
      // Trois semaines récoltées en UNE requête, notes comprises. C'était ça, la fuite.
      expect((snap as any).docs).toHaveLength(3);
      expect((snap as any).docs.map((d: any) => d.data().note)).toEqual([
        NOTE_STAFF,
        NOTE_STAFF,
        NOTE_STAFF,
      ]);
    } finally {
      await witnessEnv.cleanup();
    }
  });
});
