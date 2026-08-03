// firestore-tests/rules.clubAuthority.test.ts
//
// LE PRÉDICAT D'AUTORITÉ — versant RÈGLES, contre les VRAIES règles jouées par
// l'émulateur.
//
// C'est le jumeau de functions/tests/clubAuthority.test.ts : les DEUX suites
// exercent les MÊMES cas, parce que le prédicat vit à deux endroits (les règles
// ne peuvent pas importer de TypeScript) et qu'aucun verrou automatique ne les
// maintient égales. C'est la même duplication assumée, et le même remède, que
// pour la liste des états d'accès coach.
//
// L'invariant, mot pour mot : « un propriétaire est autorisé uniquement si
// ownerUid le désigne ET s'il possède encore une appartenance active avec le
// rôle propriétaire ».
//
// Ce que cette suite prouve :
//   A. prédicat vrai  → l'encadrement complet fonctionne ;
//   B. désignation seule → REFUS (et pas un refus muet : le club reste lisible) ;
//   C. appartenance seule → REFUS ;
//   D. amorçage à la création du club → la SEULE exception, et elle est étroite ;
//   E. tentative hostile de s'écrire propriétaire → REFUS ;
//   F. le propriétaire est de fait ENCADRANT (élargissement d'`isCoach`) ;
//   G. la pierre tombale du retrait ferme tout ce que l'appartenance ouvrait ;
//   H. VERROU ANTI-DÉRIVE — les listes recopiées à la main (rôles, statut actif)
//      sont comparées littéralement à functions/src/clubAuthority.ts.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import {
  PROJECT_ID,
  CLUB_A,
  COACH_A,
  PLAYER_A1,
  STRANGER,
  WEEK_KEY,
  SUMMARY,
  seed,
  seedPlayerSummary,
} from "./fixtures";
import { CLUB_ACCESS_ROLES, PLAYER_STATUS_ACTIVE } from "../functions/src/clubAuthority";

const RULES_PATH = resolve(__dirname, "..", "firestore.rules");
const RULES_SOURCE = readFileSync(RULES_PATH, "utf8");

/** Extrait les chaînes littérales du corps d'une fonction des règles. */
function champsDeLaRegle(nomFonction: string): string[] {
  const debut = RULES_SOURCE.indexOf(`function ${nomFonction}()`);
  if (debut < 0) throw new Error(`Fonction ${nomFonction} absente de firestore.rules`);
  const fin = RULES_SOURCE.indexOf("\n    }", debut);
  if (fin < 0) throw new Error(`Fin de ${nomFonction} introuvable`);
  const corps = RULES_SOURCE.slice(debut, fin);
  return (corps.match(/"[^"]+"/g) ?? []).map((s) => s.slice(1, -1));
}

let testEnv: RulesTestEnvironment;

/** Coach ordinaire du club A (jamais propriétaire) — le témoin de la section F. */
const COACH_A2 = "coachAuthoriteBis";

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST non défini — lancer via `npm run test:rules` (démarre l'émulateur Firestore).",
    );
  }
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES_SOURCE },
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
  await seedPlayerSummary(testEnv);
  await admin(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A2), {
      uid: COACH_A2,
      accessRole: "coach",
    });
  });
});

/** Pose le rôle du membre COACH_A (le propriétaire des fixtures) par l'admin. */
/** Pose (ou retire) la PERMISSION D'ENCADREMENT du compte proprietaire. */
async function setOwnerRole(accessRole: string | null): Promise<void> {
  await admin(async (ctx) => {
    const ref = doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A);
    if (accessRole === null) await deleteDoc(ref);
    else await setDoc(ref, { uid: COACH_A, accessRole });
  });
}

/** Le paquet complet des gestes d'ENCADREMENT, joué d'un bloc. */
async function gestesEncadrement(uid: string) {
  const db = asUser(uid);
  return {
    listeEffectif: () => getDocs(collection(db, "clubs", CLUB_A, "members")),
    litProjection: () => getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)),
    litNotePrivee: () => getDoc(doc(db, "clubs", CLUB_A, "coachNotes", WEEK_KEY)),
    ecritCadre: () =>
      setDoc(
        doc(db, "clubs", CLUB_A, "weekContexts", "2026-07-20"),
        {
          weekKey: "2026-07-20",
          clubId: CLUB_A,
          createdBy: uid,
          trainingIntensity: "normal",
          weekGoal: "freshness",
        },
        { merge: true },
      ),
    ecritDirective: () =>
      setDoc(doc(db, "clubs", CLUB_A, "directives", "current"), {
        clubId: CLUB_A,
        objective: "prevention",
        instruction: "Test",
        createdBy: uid,
      }),
    modifieClub: () => setDoc(doc(db, "clubs", CLUB_A), { teamGender: "male" }, { merge: true }),
    litClub: () => getDoc(doc(db, "clubs", CLUB_A)),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// A. PRÉDICAT VRAI
// ═════════════════════════════════════════════════════════════════════════════
describe("A — prédicat vrai : ownerUid désigne ET appartenance propriétaire", () => {
  test("le propriétaire cohérent fait TOUT ce qu'un encadrant fait, plus le club", async () => {
    // COACH_A est `ownerUid` du club A et porte le rôle "owner" (fixtures).
    const g = await gestesEncadrement(COACH_A);
    await assertSucceeds(g.litClub());
    await assertSucceeds(g.listeEffectif());
    await assertSucceeds(g.litProjection());
    await assertSucceeds(g.ecritCadre());
    await assertSucceeds(g.ecritDirective());
    await assertSucceeds(g.litNotePrivee());
    // Le document club : réservé au prédicat COMPLET.
    await assertSucceeds(g.modifieClub());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. DÉSIGNATION SEULE → REFUS
// ═════════════════════════════════════════════════════════════════════════════
describe("B — ownerUid seul : incohérent, donc refus", () => {
  test("appartenance ABSENTE : plus aucun droit d'encadrement, ni sur le club", async () => {
    await setOwnerRole(null);
    const g = await gestesEncadrement(COACH_A);
    await assertFails(g.listeEffectif());
    await assertFails(g.litProjection());
    await assertFails(g.litNotePrivee());
    await assertFails(g.ecritCadre());
    await assertFails(g.ecritDirective());
    await assertFails(g.modifieClub());
  });

  test("appartenance qui dit 'coach' (l'état historique) : le CLUB lui est refusé", async () => {
    // Ce cas est celui que produisait l'ancienne création de club. Il reste
    // ENCADRANT (rôle coach), c'est voulu — mais `ownerUid` ne lui donne plus
    // les droits de propriétaire, qui exigent l'appartenance correspondante.
    await setOwnerRole("coach");
    const g = await gestesEncadrement(COACH_A);
    await assertSucceeds(g.listeEffectif()); // encadrant : oui
    await assertFails(g.modifieClub()); // propriétaire : non
  });

  test("PAS DE DISPARITION MUETTE : le document club reste lisible", async () => {
    // C'est ce qui permet à l'application de constater l'écart et de le dire
    // (`useCoachClub.ownerAuthority`) au lieu d'afficher un club évaporé.
    await setOwnerRole(null);
    await assertSucceeds(getDoc(doc(asUser(COACH_A), "clubs", CLUB_A)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. APPARTENANCE SEULE → REFUS
// ═════════════════════════════════════════════════════════════════════════════
describe("C — appartenance propriétaire seule : incohérent, donc refus", () => {
  test("rôle 'owner' dans un club qui désigne quelqu'un d'autre : pas de droit propriétaire", async () => {
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A2), {
        uid: COACH_A2,
        accessRole: "owner",
      });
    });
    const g = await gestesEncadrement(COACH_A2);
    // Encadrant : oui (l'appartenance suffit, et elle n'a qu'une source).
    await assertSucceeds(g.listeEffectif());
    // Propriétaire : non — `ownerUid` désigne COACH_A.
    await assertFails(g.modifieClub());
    // Et il ne peut pas non plus supprimer le cadre (geste propriétaire).
    await assertFails(
      deleteDoc(doc(asUser(COACH_A2), "clubs", CLUB_A, "weekContexts", WEEK_KEY)),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. AMORÇAGE — LA SEULE EXCEPTION
// ═════════════════════════════════════════════════════════════════════════════
describe("D — amorçage à la création du club", () => {
  test("le créateur pose les DEUX sources dans le même mouvement", async () => {
    const NOUVEAU = "fondateur";
    const db = asUser(NOUVEAU);
    const clubRef = doc(collection(db, "clubs"));
    await assertSucceeds(setDoc(clubRef, { name: "Club Amorce", ownerUid: NOUVEAU }));
    // À CET INSTANT, le prédicat complet est FAUX (pas encore d'appartenance) :
    // la règle d'amorçage se fonde donc sur `ownerUid` lu dans le document club,
    // et sur lui seul.
    await assertSucceeds(
      setDoc(doc(db, "clubs", clubRef.id, "members", NOUVEAU), { uid: NOUVEAU, accessRole: "owner" }),
    );
    // Et le prédicat devient vrai : le club est modifiable par son propriétaire.
    await assertSucceeds(setDoc(clubRef, { teamGender: "mixed" }, { merge: true }));
  });

  test("l'exception ne laisse pas passer `coachAccess` en contrebande", async () => {
    const NOUVEAU = "fondateurBis";
    const db = asUser(NOUVEAU);
    const clubRef = doc(collection(db, "clubs"));
    await assertSucceeds(setDoc(clubRef, { name: "Club Amorce 2", ownerUid: NOUVEAU }));
    await assertFails(
      setDoc(doc(db, "clubs", clubRef.id, "members", NOUVEAU), {
        uid: NOUVEAU,
        accessRole: "owner",
        coachAccess: "approved",
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. TENTATIVE HOSTILE
// ═════════════════════════════════════════════════════════════════════════════
describe("E — s'écrire propriétaire dans un club dont on n'est pas le ownerUid", () => {
  test("un inconnu : REFUSÉ", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "clubs", CLUB_A, "members", STRANGER), {
        uid: STRANGER,
        accessRole: "owner",
      }),
    );
  });

  test("un membre EXISTANT du club (le plus tentant) : REFUSÉ", async () => {
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "clubs", CLUB_A, "members", PLAYER_A1), {
        uid: PLAYER_A1,
        accessRole: "owner",
      }),
    );
  });

  test("un COACH du club, qui a pourtant déjà des droits d'encadrement : REFUSÉ", async () => {
    await assertFails(
      setDoc(doc(asUser(COACH_A2), "clubs", CLUB_A, "members", COACH_A2), {
        uid: COACH_A2,
        accessRole: "owner",
      }),
    );
  });

  test("promouvoir QUELQU'UN D'AUTRE propriétaire, même en étant le vrai propriétaire : REFUSÉ", async () => {
    // L'exception est bornée à « j'écris MON PROPRE document ». Le transfert de
    // propriété n'est donc pas un geste client — et c'est bien ainsi : il doit
    // changer `ownerUid`, l'ancien rôle et le nouveau dans UNE transaction.
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", PLAYER_A1), {
        uid: PLAYER_A1,
        accessRole: "owner",
      }),
    );
  });

  test("le propriétaire ne peut pas non plus se rétrograder en 'coach'", async () => {
    // Ce serait fabriquer l'incohérence à la main.
    await assertFails(
      setDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "members", COACH_A), {
        uid: COACH_A,
        accessRole: "coach",
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F. LE PROPRIÉTAIRE EST DE FAIT ENCADRANT
// ═════════════════════════════════════════════════════════════════════════════
describe("F — élargissement de l'encadrement au rôle propriétaire", () => {
  test("propriétaire et coach ont EXACTEMENT les mêmes gestes d'encadrement", async () => {
    const proprietaire = await gestesEncadrement(COACH_A);
    const coach = await gestesEncadrement(COACH_A2);
    for (const g of [proprietaire, coach]) {
      await assertSucceeds(g.listeEffectif());
      await assertSucceeds(g.litProjection());
      await assertSucceeds(g.litNotePrivee());
      await assertSucceeds(g.ecritCadre());
      await assertSucceeds(g.ecritDirective());
    }
  });

  test("sans cet élargissement, le propriétaire aurait perdu le cadre et la directive", async () => {
    // Preuve par le témoin : un membre du club SANS rôle d'encadrement (joueur)
    // se voit refuser exactement ces deux écritures. Si "owner" n'était pas dans
    // la liste d'encadrement, le propriétaire tomberait dans ce cas-là.
    const db = asUser(PLAYER_A1);
    await assertFails(
      setDoc(doc(db, "clubs", CLUB_A, "weekContexts", "2026-07-20"), {
        weekKey: "2026-07-20",
        clubId: CLUB_A,
        createdBy: PLAYER_A1,
        trainingIntensity: "normal",
        weekGoal: "freshness",
      }),
    );
    await assertFails(
      setDoc(doc(db, "clubs", CLUB_A, "directives", "current"), {
        clubId: CLUB_A,
        objective: "prevention",
        instruction: "Test",
        createdBy: PLAYER_A1,
      }),
    );
  });

  test("un rôle INCONNU n'encadre rien (default-deny sur la valeur du champ)", async () => {
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "members", COACH_A2), {
        uid: COACH_A2,
        role: "Owner", // casse différente = valeur inconnue
      });
    });
    const g = await gestesEncadrement(COACH_A2);
    await assertFails(g.listeEffectif());
    await assertFails(g.litProjection());
    // Et ce n'est même plus un membre actif : le club lui est fermé.
    await assertFails(g.litClub());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G. RETRAIT : LA PIERRE TOMBALE FERME TOUT
// ═════════════════════════════════════════════════════════════════════════════
describe("G — appartenance révoquée par le retrait serveur", () => {
  /** Rejoue EXACTEMENT ce que la Cloud Function `removeClubMember` écrit. */
  async function retirer(uid: string): Promise<void> {
    await admin(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A, "members", uid),
        {
          uid,
          accessRole: null, playerStatus: "inactive",
          coachAccess: "revoked",
          removedAt: 1_753_600_000_000,
          removedBy: COACH_A,
        },
        { merge: true },
      );
    });
  }

  test("le joueur retiré ne lit plus NI le club, NI le cadre, NI la directive", async () => {
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "directives", "current"), {
        clubId: CLUB_A,
        objective: "prevention",
        instruction: "Renfo léger cette semaine",
        createdBy: COACH_A,
      });
    });
    const db = asUser(PLAYER_A1);
    // Avant : tout cela lui est ouvert (sinon le test d'après ne prouverait rien).
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A)));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "directives", "current")));

    await retirer(PLAYER_A1);

    await assertFails(getDoc(doc(db, "clubs", CLUB_A)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "directives", "current")));
  });

  test("PROJECTION EXISTANTE : illisible par le coach dès le retrait", async () => {
    const db = asUser(COACH_A);
    await assertSucceeds(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));

    await retirer(PLAYER_A1);

    // La projection est encore EN BASE ici (on ne l'a pas supprimée) : c'est
    // volontaire. On mesure que même dans ce cas — donc même si un trigger en vol
    // la réécrivait juste après le retrait — plus personne ne peut la lire.
    await admin(async (ctx) => {
      const snap = await getDoc(
        doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_A1),
      );
      expect(snap.exists()).toBe(true);
    });
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
  });

  test("TRIGGER EXÉCUTÉ APRÈS LE RETRAIT : une projection recréée reste illisible", async () => {
    await retirer(PLAYER_A1);
    // Simulation de la course : le serveur réécrit la projection après coup.
    await admin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_A1), {
        ...SUMMARY,
        playerUid: PLAYER_A1,
      });
    });
    // Le refus vient de l'ÉTAT de l'appartenance, pas de l'absence du document.
    await assertFails(
      getDoc(doc(asUser(COACH_A), "clubs", CLUB_A, "playerSummaries", PLAYER_A1)),
    );
  });

  test("le membre retiré ne peut pas se réécrire une appartenance", async () => {
    await retirer(PLAYER_A1);
    const db = asUser(PLAYER_A1);
    await assertFails(
      setDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1), { uid: PLAYER_A1, playerStatus: "active" }),
    );
    await assertFails(
      setDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1), { uid: PLAYER_A1, accessRole: "owner" }),
    );
  });

  test("AUCUN AUTRE MEMBRE n'est affecté", async () => {
    await retirer(PLAYER_A1);
    // Le coach garde tout, et l'autre joueuse du club aussi.
    const g = await gestesEncadrement(COACH_A);
    await assertSucceeds(g.listeEffectif());
    await assertSucceeds(getDoc(doc(asUser("playerA2"), "clubs", CLUB_A)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H. VERROU ANTI-DÉRIVE — le prédicat des règles == l'inventaire de clubAuthority.ts
// ═════════════════════════════════════════════════════════════════════════════
describe("H. Verrou anti-dérive entre clubAuthority.ts et firestore.rules", () => {
  test("les permissions d'encadrement qui rendent `isClubStaff` vrai sont identiques des deux côtés", () => {
    expect(champsDeLaRegle("clubAccessRoles").sort()).toEqual([...CLUB_ACCESS_ROLES].sort());
  });

  test("le statut de joueur qui ouvre un droit (`isPlayerMember`/`isActiveMember`) est identique des deux côtés", () => {
    // Pas de comparaison à CLUB_PLAYER_STATUSES ici : aucune règle ne teste
    // jamais l'égalité à "inactive", seulement la DIFFÉRENCE avec "active"
    // (une pierre tombale ouvre un droit en cessant d'être active, pas en
    // valant explicitement "inactive"). Le seul littéral à verrouiller est donc
    // PLAYER_STATUS_ACTIVE, cf. le commentaire de `activePlayerStatus` dans
    // firestore.rules.
    expect(champsDeLaRegle("activePlayerStatus")).toEqual([PLAYER_STATUS_ACTIVE]);
  });
});
