// firestore-tests/rules.userDocument.test.ts
//
// LES ÉCRITURES LIBRES DANS `users/{uid}` SONT FERMÉES.
//
// Avant ce lot : `allow create, update: if isOwner(userId)`. Chacun écrivait
// n'importe quel champ de son propre document. Après : liste blanche explicite,
// interdiction par défaut de tout champ inconnu, gel des champs d'autorité /
// d'accès / de pilotage / de facturation / d'administration.
//
// CE QUE CETTE SUITE PROUVE, DANS L'ORDRE :
//   A. TÉMOINS POSITIFS — tous les parcours réels passent toujours. Sans eux,
//      une règle qui refuserait TOUT donnerait une suite entièrement verte.
//   B. MUTATIONS NÉGATIVES CHAMP PAR CHAMP — pour CHAQUE champ protégé :
//      l'écrire, le modifier, le supprimer par merge partiel. Trois refus.
//   C. CHAMPS INCONNUS — le futur champ que personne n'a prévu est refusé.
//   D. UTILISATEURS ANCIENS — un document porteur de champs hors liste blanche
//      reste MODIFIABLE. C'est le piège qui casse en production et pas en test.
//   E. IDENTITÉ — `uid` ne peut pas mentir, `createdAt`/`email` sont posés une
//      fois puis gelés.
//   F. RATTACHEMENT — `clubId` : effacement libre, écho libre, nouvelle valeur
//      seulement vers un club où l'appartenance est réelle.
//   G. DIVERGENCE — la liste blanche des règles et l'inventaire tenu ici ne
//      peuvent plus dériver en silence.

import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative, resolve, sep } from "path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc, deleteField, getDoc } from "firebase/firestore";
import { PROJECT_ID, CLUB_A, CLUB_B, COACH_A, PLAYER_A1, STRANGER, seed } from "./fixtures";

const RULES_PATH = resolve(__dirname, "..", "firestore.rules");
const RULES_SOURCE = readFileSync(RULES_PATH, "utf8");

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST non défini — lancer via `yarn test:rules` (démarre l'émulateur Firestore).",
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

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv);
});

const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();

/** Écrit un document utilisateur EN ADMIN (règles désactivées) — état de départ. */
async function seedUserDoc(uid: string, data: Record<string, unknown>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", uid), data);
  });
}

/** Supprime un document utilisateur EN ADMIN — pour rejouer une CRÉATION. */
async function removeUserDoc(uid: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), "users", uid));
  });
}

/**
 * Profil PROPRE : aucun champ protégé, aucun champ hérité.
 *
 * Nécessaire parce que les fixtures communes écrivent `playerStatus: "active"`
 * (et `accessRole` pour les coachs) DANS le document utilisateur — un résidu
 * d'ancien modèle, précisément le genre de champ que ce lot gèle. Sans ce
 * nettoyage, un test qui croit « POSER » un champ protégé réécrirait en fait la
 * même valeur, ce qui est permis : le test passerait au vert sans rien prouver.
 */
async function seedProfilPropre(uid: string): Promise<void> {
  await seedUserDoc(uid, {
    uid,
    firstName: "Anna",
    clubId: CLUB_A,
    profileCompleted: true,
    updatedAt: 1_753_600_000_000,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// INVENTAIRE — source de vérité côté test, comparée aux règles en G.
// ═════════════════════════════════════════════════════════════════════════════
//
// Chaque entrée dit QUI écrit le champ et À QUEL MOMENT du parcours. Les
// entrées `boucle` viennent de la branche claude/player-tracking-loop-559906
// (boucle de suivi joueur), qui sera MERGÉE AVANT nous et écrit déjà dans
// `users/{uid}`. Elles sont pré-autorisées : sans elles, le merge produirait
// deux refus SILENCIEUX côté joueur (ces écritures sont « best-effort »).

type Origine = "register" | "setup" | "cycle" | "feedback" | "sync" | "club" | "boucle";

const INVENTAIRE_MUTABLE: Record<string, Origine[]> = {
  // Identité applicative
  uid: ["setup", "club"],
  firstName: ["register", "setup", "club"],
  profileCompleted: ["register", "setup", "club"],
  updatedAt: ["register", "setup", "cycle", "feedback", "sync", "club"],
  // Profil sportif
  position: ["setup"],
  ageCategory: ["setup"],
  level: ["setup"],
  dominantFoot: ["setup"],
  mainObjective: ["setup"],
  parentalConsent: ["setup"],
  // Rythme club et match
  targetFksSessionsPerWeek: ["setup"],
  clubTrainingsPerWeek: ["setup"],
  matchesPerWeek: ["setup"],
  hasClubTrainings: ["setup"],
  clubTrainingDays: ["setup"],
  matchDay: ["setup"],
  matchDays: ["setup"],
  // Lieu et matériel
  hasGymAccess: ["setup"],
  gymEquipment: ["setup"],
  hasHomeEquipment: ["setup"],
  homeEquipment: ["setup"],
  // Cycle en cours
  microcycleGoal: ["setup", "cycle", "feedback", "sync"],
  goal: ["setup", "cycle", "feedback"],
  programGoal: ["setup", "cycle", "feedback"],
  microcycleStatus: ["setup", "cycle", "feedback"],
  microcycleTotalSessions: ["setup", "cycle", "feedback"],
  microcycleSessionIndex: ["setup", "cycle", "feedback", "sync"],
  microcycleStartedAt: ["setup", "cycle", "feedback"],
  microcycleAbandonedAt: ["cycle"],
  microcycleAbandonReason: ["cycle"],
  // Parcours
  activePathwayId: ["cycle", "feedback", "sync"],
  activePathwayIndex: ["cycle", "feedback", "sync"],
  // Trace d'activité
  lastSessionDate: ["sync"],
  lastSessionAt: ["sync"],
  // Rattachement (valeur gouvernée séparément)
  clubId: ["setup", "club"],
  // Boucle de suivi joueur — branche à merger AVANT nous
  selfReportedGapDays: ["boucle"],
  lastTrackingDecision: ["boucle"],
};

const INVENTAIRE_CREATE_ONLY = ["createdAt", "email", "displayName"];

const INVENTAIRE_SERVEUR = [
  "role", "accessRole", "playerStatus", "coachAccess",
  "roles", "claims", "permissions", "isAdmin", "admin",
  "trackingConfig", "featureFlags",
  "subscription", "subscriptionStatus", "plan", "entitlements",
  "premium", "billing", "stripeCustomerId", "trialEndsAt",
];

/** Valeur d'essai plausible pour chaque champ protégé (mutations négatives). */
const VALEUR_HOSTILE: Record<string, unknown> = {
  role: "coach",
  accessRole: "owner",
  playerStatus: "active",
  coachAccess: "approved",
  roles: ["admin"],
  claims: { admin: true },
  permissions: ["all"],
  isAdmin: true,
  admin: true,
  trackingConfig: { collect: true, shadow: true, apply: true },
  featureFlags: { WEEK_PLAN: true },
  subscription: "pro",
  subscriptionStatus: "active",
  plan: "premium",
  entitlements: ["coach"],
  premium: true,
  billing: { paid: true },
  stripeCustomerId: "cus_faux",
  trialEndsAt: 4102444800000,
};

// ═════════════════════════════════════════════════════════════════════════════
// A. TÉMOINS POSITIFS — les parcours réels passent toujours
// ═════════════════════════════════════════════════════════════════════════════
describe("A. Témoins positifs — aucun parcours légitime n'est cassé", () => {
  test("onboarding : l'inscription crée le document (RegisterScreen)", async () => {
    await removeUserDoc(STRANGER);
    await assertSucceeds(
      setDoc(
        doc(asUser(STRANGER), "users", STRANGER),
        {
          email: "joueur@exemple.test",
          displayName: "Joueur",
          firstName: "Joueur",
          profileCompleted: false,
          createdAt: 1_753_600_000_000,
          updatedAt: 1_753_600_000_000,
        },
        { merge: true },
      ),
    );
  });

  test("onboarding dégradé : le setup profil CRÉE le document quand l'inscription a échoué", async () => {
    // Chemin réel « Compte créé — petit souci réseau » de RegisterScreen : le
    // compte Firebase existe, le document non. Le setup profil doit pouvoir le
    // créer de toutes pièces.
    await removeUserDoc(STRANGER);
    await assertSucceeds(
      setDoc(
        doc(asUser(STRANGER), "users", STRANGER),
        {
          uid: STRANGER,
          firstName: "Joueur",
          clubId: null,
          position: "MIL",
          ageCategory: "U18",
          level: "R1",
          dominantFoot: "droit",
          mainObjective: "force",
          targetFksSessionsPerWeek: 3,
          clubTrainingsPerWeek: 2,
          matchesPerWeek: 1,
          hasClubTrainings: true,
          clubTrainingDays: ["mardi", "jeudi"],
          matchDay: "samedi",
          matchDays: ["samedi"],
          hasGymAccess: "none",
          gymEquipment: [],
          hasHomeEquipment: false,
          homeEquipment: [],
          profileCompleted: true,
          microcycleGoal: "fondation",
          goal: "fondation",
          programGoal: "fondation",
          microcycleStatus: "active",
          microcycleTotalSessions: 12,
          microcycleSessionIndex: 0,
          microcycleStartedAt: 1_753_600_000_000,
          updatedAt: 1_753_600_000_000,
        },
        { merge: true },
      ),
    );
  });

  test("édition de profil : le setup profil réenregistre un profil existant", async () => {
    await assertSucceeds(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        {
          uid: PLAYER_A1,
          firstName: "Anna",
          // Écho du club déjà rattaché — exactement ce qu'écrit ProfileSetupScreen.
          clubId: CLUB_A,
          position: "DEF",
          ageCategory: "U15",
          level: "R2",
          dominantFoot: "gauche",
          mainObjective: "endurance",
          targetFksSessionsPerWeek: 2,
          clubTrainingsPerWeek: 3,
          matchesPerWeek: 1,
          hasClubTrainings: true,
          clubTrainingDays: ["lundi"],
          matchDay: "dimanche",
          matchDays: ["dimanche"],
          hasGymAccess: "occasional",
          gymEquipment: [],
          hasHomeEquipment: true,
          homeEquipment: ["elastique"],
          parentalConsent: { accepted: true, acceptedAt: "2026-07-01", ageCategoryAtConsent: "U15" },
          profileCompleted: true,
          updatedAt: 1_753_600_001_000,
        },
        { merge: true },
      ),
    );
  });

  test("cycle : démarrage puis abandon (CycleModalScreen)", async () => {
    const db = asUser(PLAYER_A1);
    await assertSucceeds(
      setDoc(
        doc(db, "users", PLAYER_A1),
        {
          microcycleGoal: "force", goal: "force", programGoal: "force",
          microcycleStatus: "active", microcycleTotalSessions: 12,
          microcycleSessionIndex: 0, microcycleStartedAt: 1_753_600_000_000,
          activePathwayId: null, activePathwayIndex: 0,
          updatedAt: 1_753_600_000_000,
        },
        { merge: true },
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(db, "users", PLAYER_A1),
        {
          microcycleGoal: null, goal: null, programGoal: null,
          microcycleStatus: "abandoned", microcycleSessionIndex: 0,
          microcycleAbandonedAt: 1_753_600_002_000,
          microcycleAbandonReason: "Trop dur",
          activePathwayId: null, activePathwayIndex: 0,
          updatedAt: 1_753_600_002_000,
        },
        { merge: true },
      ),
    );
  });

  test("fin de séance : la trace d'activité est écrite (useSyncStore)", async () => {
    await assertSucceeds(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        {
          updatedAt: 1_753_600_003_000,
          lastSessionDate: "2026-07-26",
          lastSessionAt: 1_753_600_003_000,
          microcycleGoal: "force",
          microcycleSessionIndex: 4,
          activePathwayId: "prepa",
          activePathwayIndex: 1,
        },
        { merge: true },
      ),
    );
  });

  test("réglages : quitter le club efface la référence (ClubManagementCard)", async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { clubId: null }),
    );
  });

  test("boucle de suivi (branche à merger) : les deux écritures best-effort passent", async () => {
    const db = asUser(PLAYER_A1);
    // Posé au setup profil (screens/ProfileSetupScreen.tsx).
    await assertSucceeds(
      setDoc(doc(db, "users", PLAYER_A1), { selfReportedGapDays: 21 }, { merge: true }),
    );
    // Posé après chaque feedback (state/orchestrators/applyFeedback.ts).
    await assertSucceeds(
      setDoc(
        doc(db, "users", PLAYER_A1),
        { lastTrackingDecision: { kind: "hold", rulesVersion: "v1" } },
        { merge: true },
      ),
    );
  });

  test("création de club : le fondateur pose son clubId juste après son appartenance", async () => {
    // Reproduit repositories/clubsRepo.createClubAsCoach dans l'ordre réel.
    const db = asUser(STRANGER);
    await assertSucceeds(setDoc(doc(db, "clubs", "clubNeuf"), { name: "Neuf", ownerUid: STRANGER }));
    await assertSucceeds(
      setDoc(doc(db, "clubs", "clubNeuf", "members", STRANGER), { uid: STRANGER, accessRole: "owner" }),
    );
    await assertSucceeds(
      setDoc(
        doc(db, "users", STRANGER),
        { uid: STRANGER, clubId: "clubNeuf", firstName: "Fondateur", profileCompleted: true, updatedAt: 1 },
        { merge: true },
      ),
    );
  });

  test("suppression de compte : toujours refusée au client (Cloud Function seule)", async () => {
    await assertFails(deleteDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1)));
  });

  test("lecture inchangée : chacun lit son document, personne ne lit celui d'un autre", async () => {
    await assertSucceeds(getDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1)));
    await assertFails(getDoc(doc(asUser(COACH_A), "users", PLAYER_A1)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. MUTATIONS NÉGATIVES CHAMP PAR CHAMP
// ═════════════════════════════════════════════════════════════════════════════
describe("B. Champs protégés — écrire, modifier, supprimer : trois refus", () => {
  describe.each(INVENTAIRE_SERVEUR)("champ protégé « %s »", (champ) => {
    const valeur = VALEUR_HOSTILE[champ];

    test("ne peut pas être POSÉ sur un document existant", async () => {
      await seedProfilPropre(PLAYER_A1);
      await assertFails(
        setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { [champ]: valeur }, { merge: true }),
      );
    });

    test("ne peut pas être posé À LA CRÉATION du document", async () => {
      await removeUserDoc(STRANGER);
      await assertFails(
        setDoc(doc(asUser(STRANGER), "users", STRANGER), {
          firstName: "Intrus",
          updatedAt: 1,
          [champ]: valeur,
        }),
      );
    });

    test("ne peut pas être MODIFIÉ quand il existe déjà", async () => {
      await seedUserDoc(PLAYER_A1, { uid: PLAYER_A1, firstName: "Anna", [champ]: valeur });
      await assertFails(
        setDoc(
          doc(asUser(PLAYER_A1), "users", PLAYER_A1),
          { [champ]: "autre-valeur-quelconque" },
          { merge: true },
        ),
      );
    });

    test("ne peut pas être SUPPRIMÉ par merge partiel", async () => {
      await seedUserDoc(PLAYER_A1, { uid: PLAYER_A1, firstName: "Anna", [champ]: valeur });
      await assertFails(
        updateDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { [champ]: deleteField() }),
      );
    });

    test("ne peut pas être glissé dans une écriture de profil par ailleurs légitime", async () => {
      await seedProfilPropre(PLAYER_A1);
      await assertFails(
        setDoc(
          doc(asUser(PLAYER_A1), "users", PLAYER_A1),
          { firstName: "Anna", position: "ATT", updatedAt: 2, [champ]: valeur },
          { merge: true },
        ),
      );
    });

    test("réécrire la MÊME valeur est permis — un document ancien reste modifiable", async () => {
      await seedUserDoc(PLAYER_A1, { uid: PLAYER_A1, firstName: "Anna", [champ]: valeur });
      await assertSucceeds(
        setDoc(
          doc(asUser(PLAYER_A1), "users", PLAYER_A1),
          { firstName: "Anna Marie", [champ]: valeur, updatedAt: 3 },
          { merge: true },
        ),
      );
    });
  });

  test("l'interrupteur distant du suivi ne s'active pas tout seul (trackingConfig.apply)", async () => {
    // Cas nommé : ce champ décide si la boucle de suivi APPLIQUE ses décisions
    // aux séances (domain/tracking/modes.ts, lu par services/aiContext.ts).
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        { trackingConfig: { collect: true, shadow: true, apply: true } },
        { merge: true },
      ),
    );
  });

  test("s'auto-déclarer coach dans son profil est désormais REFUSÉ par la base", async () => {
    // Ce champ ne décidait plus de rien (l'espace est dérivé de l'appartenance),
    // mais il RESSEMBLAIT à une autorité. Il n'est plus écrivable du tout.
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { role: "coach" }, { merge: true }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. CHAMPS INCONNUS — interdiction PAR DÉFAUT
// ═════════════════════════════════════════════════════════════════════════════
describe("C. Tout champ inconnu est refusé, même inoffensif", () => {
  const INCONNUS = ["champInvente", "notes", "credits", "coachUid", "clubIds", "vipUntil"];

  test.each(INCONNUS)("« %s » est refusé en mise à jour", async (champ) => {
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { [champ]: "x" }, { merge: true }),
    );
  });

  test.each(INCONNUS)("« %s » est refusé à la création", async (champ) => {
    await removeUserDoc(STRANGER);
    await assertFails(
      setDoc(doc(asUser(STRANGER), "users", STRANGER), { firstName: "X", [champ]: "x" }),
    );
  });

  test("un champ inconnu glissé au milieu de champs légitimes fait tomber TOUTE l'écriture", async () => {
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        { firstName: "Anna", position: "ATT", updatedAt: 4, champInvente: true },
        { merge: true },
      ),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. UTILISATEURS ANCIENS — le piège qui casse en production, pas en test
// ═════════════════════════════════════════════════════════════════════════════
describe("D. Un document ancien porteur de champs hors liste blanche reste modifiable", () => {
  // Champs réellement présents en base et PLUS ÉCRITS par aucun chemin : ils ne
  // sont donc pas dans la liste blanche. Vérifié par recherche exhaustive des
  // écritures (setDoc/updateDoc) : ils ne sont plus que LUS.
  const CHAMPS_HERITES = {
    available_time_min: 45,
    availableTimeMin: 45,
    explosivite_playlist_len: 12,
    explosivitePlaylistLen: 12,
    clubTypicalRPE: 7,
    clubTypicalDurationMin: 90,
    matchTypicalRPE: 8,
    matchTypicalDurationMin: 80,
    role: "player",
    accessRole: "coach",
    playerStatus: "active",
  };

  beforeEach(async () => {
    await seedUserDoc(PLAYER_A1, {
      uid: PLAYER_A1,
      firstName: "Anna",
      clubId: CLUB_A,
      profileCompleted: true,
      ...CHAMPS_HERITES,
    });
  });

  test("il peut éditer son profil : les champs hérités ne sont pas touchés", async () => {
    await assertSucceeds(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        {
          uid: PLAYER_A1,
          firstName: "Anna",
          clubId: CLUB_A,
          position: "ATT",
          ageCategory: "U15",
          profileCompleted: true,
          updatedAt: 5,
        },
        { merge: true },
      ),
    );
  });

  test("il peut démarrer un cycle et enregistrer une séance", async () => {
    const db = asUser(PLAYER_A1);
    await assertSucceeds(
      setDoc(
        doc(db, "users", PLAYER_A1),
        { microcycleGoal: "force", microcycleStatus: "active", microcycleSessionIndex: 0, updatedAt: 6 },
        { merge: true },
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(db, "users", PLAYER_A1),
        { lastSessionDate: "2026-07-26", lastSessionAt: 7, updatedAt: 7 },
        { merge: true },
      ),
    );
  });

  test("il peut quitter son club", async () => {
    await assertSucceeds(updateDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { clubId: null }));
  });

  test("mais il ne peut toujours pas TOUCHER un champ hérité d'autorité", async () => {
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { role: "coach" }, { merge: true }),
    );
    await assertFails(
      updateDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { accessRole: deleteField() }),
    );
  });

  test("ni RÉÉCRIRE un champ hérité NON sensible — il devrait passer par une revue des règles", async () => {
    // Ces champs sont hors liste blanche : les toucher est refusé. C'est
    // volontaire — les réintroduire est une décision, pas un effet de bord.
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { available_time_min: 30 }, { merge: true }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. IDENTITÉ — création ≠ mise à jour
// ═════════════════════════════════════════════════════════════════════════════
describe("E. Identité de compte : posée une fois, gelée ensuite", () => {
  test.each(INVENTAIRE_CREATE_ONLY)("« %s » est posable à la CRÉATION", async (champ) => {
    await removeUserDoc(STRANGER);
    await assertSucceeds(
      setDoc(doc(asUser(STRANGER), "users", STRANGER), {
        firstName: "Joueur",
        updatedAt: 1,
        [champ]: champ === "createdAt" ? 1_753_600_000_000 : "valeur@exemple.test",
      }),
    );
  });

  test.each(INVENTAIRE_CREATE_ONLY)("« %s » n'est plus MODIFIABLE ensuite", async (champ) => {
    await seedUserDoc(PLAYER_A1, { uid: PLAYER_A1, firstName: "Anna", [champ]: "valeur-origine" });
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { [champ]: "valeur-neuve" }, { merge: true }),
    );
  });

  test.each(INVENTAIRE_CREATE_ONLY)("« %s » n'est plus SUPPRIMABLE ensuite", async (champ) => {
    await seedUserDoc(PLAYER_A1, { uid: PLAYER_A1, firstName: "Anna", [champ]: "valeur-origine" });
    await assertFails(
      updateDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { [champ]: deleteField() }),
    );
  });

  test("`uid` ne peut pas désigner quelqu'un d'autre, ni à la création ni ensuite", async () => {
    await removeUserDoc(STRANGER);
    await assertFails(
      setDoc(doc(asUser(STRANGER), "users", STRANGER), { uid: PLAYER_A1, firstName: "Intrus" }),
    );
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { uid: COACH_A }, { merge: true }),
    );
  });

  test("`uid` absent reste accepté — l'inscription ne l'écrit pas", async () => {
    await seedUserDoc(PLAYER_A1, { firstName: "Anna", profileCompleted: true });
    await assertSucceeds(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { firstName: "Anna B", updatedAt: 8 }, { merge: true }),
    );
  });

  test("écrire dans le document de QUELQU'UN D'AUTRE reste refusé", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "users", PLAYER_A1), { firstName: "Pirate" }, { merge: true }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F. RATTACHEMENT — clubId : effacement libre, écho libre, rattachement contrôlé
// ═════════════════════════════════════════════════════════════════════════════
describe("F. `clubId` — on peut partir, on ne s'invite pas", () => {
  test("effacer son clubId est toujours permis", async () => {
    await assertSucceeds(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { clubId: null, updatedAt: 9 }, { merge: true }),
    );
  });

  test("repasser le MÊME clubId est toujours permis (écho du setup profil)", async () => {
    await assertSucceeds(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { clubId: CLUB_A, updatedAt: 10 }, { merge: true }),
    );
  });

  test("se déclarer membre d'un club où l'on n'est pas est REFUSÉ", async () => {
    await assertFails(
      setDoc(doc(asUser(STRANGER), "users", STRANGER), { uid: STRANGER, clubId: CLUB_A }, { merge: true }),
    );
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { clubId: CLUB_B }, { merge: true }),
    );
  });

  test("un membre dont le SUIVI a été désactivé peut toujours éditer son profil", async () => {
    // Piège de production : `deactivateClubPlayer` pose playerStatus "inactive"
    // et NE nettoie PAS users/{uid}.clubId. Le joueur repasse donc un clubId
    // vers un club où il n'est plus actif — l'écho doit rester permis, sinon il
    // ne peut plus jamais toucher son profil.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "clubs", CLUB_A, "members", PLAYER_A1),
        { uid: PLAYER_A1, playerStatus: "inactive", coachAccess: "revoked" },
      );
    });
    await assertSucceeds(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        { uid: PLAYER_A1, firstName: "Anna", clubId: CLUB_A, position: "ATT", updatedAt: 11 },
        { merge: true },
      ),
    );
  });

  test("un clubId d'un type inattendu est refusé", async () => {
    await assertFails(
      setDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), { clubId: 42 }, { merge: true }),
    );
  });

  test("mentir sur son clubId n'ouvrirait de toute façon rien — et n'est plus possible", async () => {
    const db = asUser(STRANGER);
    await assertFails(setDoc(doc(db, "users", STRANGER), { uid: STRANGER, clubId: CLUB_A }, { merge: true }));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A)));
    await assertFails(getDoc(doc(db, "clubs", CLUB_A, "playerSummaries", PLAYER_A1)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G. DIVERGENCE — les règles et l'inventaire ne peuvent plus dériver en silence
// ═════════════════════════════════════════════════════════════════════════════
describe("G. Verrou anti-dérive entre l'inventaire et la liste blanche", () => {
  /** Extrait les chaînes littérales du corps d'une fonction des règles. */
  function champsDeLaRegle(nomFonction: string): string[] {
    const debut = RULES_SOURCE.indexOf(`function ${nomFonction}()`);
    if (debut < 0) throw new Error(`Fonction ${nomFonction} absente de firestore.rules`);
    const fin = RULES_SOURCE.indexOf("\n    }", debut);
    if (fin < 0) throw new Error(`Fin de ${nomFonction} introuvable`);
    const corps = RULES_SOURCE.slice(debut, fin);
    return (corps.match(/"[^"]+"/g) ?? []).map((s) => s.slice(1, -1));
  }

  test("la liste mutable des règles == l'inventaire tenu ici", () => {
    expect(champsDeLaRegle("userMutableFields").sort()).toEqual(
      Object.keys(INVENTAIRE_MUTABLE).sort(),
    );
  });

  test("la liste création-seulement des règles == l'inventaire tenu ici", () => {
    expect(champsDeLaRegle("userCreateOnlyFields").sort()).toEqual(
      [...INVENTAIRE_CREATE_ONLY].sort(),
    );
  });

  test("la liste des champs serveur des règles == l'inventaire tenu ici", () => {
    expect(champsDeLaRegle("userServerOnlyFields").sort()).toEqual([...INVENTAIRE_SERVEUR].sort());
  });

  test("aucun champ n'est à la fois mutable et réservé au serveur", () => {
    const collision = Object.keys(INVENTAIRE_MUTABLE).filter((c) => INVENTAIRE_SERVEUR.includes(c));
    expect(collision).toEqual([]);
  });

  test("chaque champ protégé a une valeur d'essai — sinon les mutations négatives seraient vides", () => {
    const sansValeur = INVENTAIRE_SERVEUR.filter((c) => !(c in VALEUR_HOSTILE));
    expect(sansValeur).toEqual([]);
  });

  test("aucun champ mutable n'est orphelin : chacun est écrit par un chemin identifié", () => {
    const orphelins = Object.entries(INVENTAIRE_MUTABLE)
      .filter(([, origines]) => origines.length === 0)
      .map(([champ]) => champ);
    expect(orphelins).toEqual([]);
  });

  // ── LE VERROU QUI COMPTE VRAIMENT ────────────────────────────────────────
  // Les tests ci-dessus attrapent une dérive entre DEUX DOCUMENTS. Celui-ci
  // attrape la dérive entre le CODE et les règles : si demain un fichier se met
  // à écrire dans `users/{uid}` sans que personne n'ait relu la liste blanche,
  // il apparaît ici et la suite échoue. Le geste attendu n'est pas d'allonger
  // la liste ci-dessous, c'est de vérifier que les champs écrits sont autorisés.
  test("aucun fichier ne touche users/{uid} en dehors des chemins inventoriés", () => {
    // Chemins connus, chacun classé. `boucle: true` = fichier de la branche
    // claude/player-tracking-loop-559906, absent tant qu'elle n'est pas mergée :
    // il est PRÉ-DÉCLARÉ pour que le merge ne fasse pas rougir cette suite sur
    // un chemin déjà relu ici.
    const CHEMINS_CONNUS: Record<string, { role: "ecriture" | "lecture"; boucle?: boolean }> = {
      "components/settings/ClubManagementCard.tsx": { role: "ecriture" },
      "repositories/clubsRepo.ts": { role: "ecriture" },
      "screens/CycleModalScreen.tsx": { role: "ecriture" },
      "screens/ProfileSetupScreen.tsx": { role: "ecriture" },
      "screens/RegisterScreen.tsx": { role: "ecriture" },
      "screens/feedback/hooks/useFeedbackSave.ts": { role: "ecriture" },
      "state/stores/useSyncStore.ts": { role: "ecriture" },
      // Sous-collections users/{uid}/sessions et /plannedSessions — hors sujet
      // de ce lot (leurs règles sont inchangées), listées pour que le scan soit
      // exhaustif plutôt que filtré.
      "repositories/sessionsRepo.ts": { role: "ecriture" },
      "services/plannedSessionsRepo.ts": { role: "ecriture" },
      // Lectures seules.
      "hooks/coach/useCoachClub.ts": { role: "lecture" },
      "hooks/useClubDirective.ts": { role: "lecture" },
      "navigation/RootNavigator.tsx": { role: "lecture" },
      "screens/CoachHomeScreen.tsx": { role: "lecture" },
      "screens/DeleteAccountScreen.tsx": { role: "lecture" },
      "services/aiContext.ts": { role: "lecture" },
      // Branche boucle de suivi joueur (pré-déclarée, cf. ci-dessus).
      "hooks/useSelfReportedGapDays.ts": { role: "lecture", boucle: true },
      "state/orchestrators/applyFeedback.ts": { role: "ecriture", boucle: true },
    };

    const RACINE = resolve(__dirname, "..");
    const DOSSIERS = ["screens", "state", "repositories", "services", "components", "hooks", "navigation"];

    const trouves: string[] = [];
    const parcourir = (dir: string): void => {
      for (const entree of readdirSync(dir, { withFileTypes: true })) {
        const complet = join(dir, entree.name);
        if (entree.isDirectory()) {
          if (entree.name === "__tests__" || entree.name === "node_modules") continue;
          parcourir(complet);
          continue;
        }
        if (!/\.tsx?$/.test(entree.name)) continue;
        const source = readFileSync(complet, "utf8");
        if (/\bdoc\(\s*[A-Za-z_$][\w$]*\s*,\s*["']users["']/.test(source)) {
          trouves.push(relative(RACINE, complet).split(sep).join("/"));
        }
      }
    };

    for (const dossier of DOSSIERS) {
      const complet = join(RACINE, dossier);
      if (existsSync(complet)) parcourir(complet);
    }

    // 1. Aucun chemin INCONNU : c'est la dérive qu'on veut voir rougir.
    const inconnus = trouves.filter((f) => !(f in CHEMINS_CONNUS)).sort();
    expect(inconnus).toEqual([]);

    // 2. Aucun chemin déclaré DISPARU (hors branche boucle, encore absente).
    const attendusPresents = Object.entries(CHEMINS_CONNUS)
      .filter(([, meta]) => !meta.boucle)
      .map(([f]) => f)
      .sort();
    const manquants = attendusPresents.filter((f) => !trouves.includes(f));
    expect(manquants).toEqual([]);
  });
});
