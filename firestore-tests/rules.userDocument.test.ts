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
// BOUCLE DE SUIVI — LA FORME RÉELLE, RECOPIÉE, JAMAIS INVENTÉE
// ═════════════════════════════════════════════════════════════════════════════
//
// Tout ce qui suit est transcrit de la branche claude/player-tracking-loop-559906,
// fichier par fichier. C'est LA garantie anti-casse de ce lot : ces deux
// écritures sont « best-effort » (leur refus est avalé par un `catch` dans
// `state/orchestrators/applyFeedback.ts`), donc un contrat trop strict ne
// casserait pas bruyamment — il ferait disparaître la donnée sans un message.
//
// Sources exactes :
//   domain/tracking/types.ts       → TrackingDecision (8 champs) + les 10 `kind`
//   domain/tracking/rulesEngine.ts → l'objet réellement construit par `build()`
//   domain/tracking/explain.ts     → `explanation` ajoutée par decorateDecision
//   domain/tracking/config.ts      → rulesVersion "tracking-rules/1.0.0"
//   screens/ProfileSetupScreen.tsx → SELF_REPORTED_GAP_OPTIONS (0/21/60/120)
//
// ⚠️ `ruleIndex` : ce champ N'EST PAS dans le type `TrackingDecision`, et il
// arrive pourtant en base. `decideAdjustment` retourne un objet construit avec
// `ruleIndex` derrière une signature annotée `TrackingDecision` — l'annotation
// l'efface pour le compilateur, pas à l'exécution — puis `decorateDecision`
// fait `{ ...decision, explanation }` et `setDoc` écrit le tout.

/** Les 10 `TrackingDecisionKind`, dans l'ordre du type. */
const KINDS_BOUCLE = [
  "continue_planned",
  "hold_dose",
  "reduce_volume_light",
  "reduce_intensity_light",
  "suggest_variant",
  "prefer_replacement",
  "resume_mode",
  "keep_despite_time",
  "block_increase_pain",
  "standard_insufficient_data",
] as const;

const RULES_VERSION_BOUCLE = "tracking-rules/1.0.0";

type DecisionBrute = Record<string, unknown>;

/**
 * Décision telle que la boucle l'écrit. Défauts = règle 11 (cas nominal
 * « tout s'est bien passé »), surchargeables champ par champ pour les
 * mutations négatives.
 */
function decisionReelle(patch: DecisionBrute = {}): DecisionBrute {
  return {
    version: 1,
    rulesVersion: RULES_VERSION_BOUCLE,
    decidedAtISO: "2026-07-28T09:12:33.481Z",
    kind: "continue_planned",
    targets: [],
    explanation:
      "Tes 4 dernières séances ont été réalisées comme prévu, avec un effort proche de la cible et sans douleur. La progression prévue continue.",
    signalsDigest: {
      completionRateAvg: 96.5,
      rpeDeltaAvg: 0.25,
      painActive: false,
      gapDays: 2,
      dataQuality: "ok",
    },
    mode: "shadow",
    ruleIndex: 11,
    ...patch,
  };
}

/** Même chose pour le digest seul (mutations négatives imbriquées). */
function digestReel(patch: DecisionBrute = {}): DecisionBrute {
  return {
    completionRateAvg: 96.5,
    rpeDeltaAvg: 0.25,
    painActive: false,
    gapDays: 2,
    dataQuality: "ok",
    ...patch,
  };
}

/** Écrit `lastTrackingDecision` en tant que titulaire, en merge partiel. */
function ecrireDecision(uid: string, valeur: unknown): Promise<void> {
  return setDoc(
    doc(asUser(uid), "users", uid),
    { lastTrackingDecision: valeur },
    { merge: true },
  );
}

/** Écrit `selfReportedGapDays` en tant que titulaire, en merge partiel. */
function ecrireGap(uid: string, valeur: unknown): Promise<void> {
  return setDoc(
    doc(asUser(uid), "users", uid),
    { selfReportedGapDays: valeur },
    { merge: true },
  );
}

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
    // ⚠️ FORME RÉELLE, recopiée de la branche — pas un objet d'illustration :
    // le contrat fermé refuse désormais un `{ kind: "hold", rulesVersion: "v1" }`
    // inventé. Le rejeu exhaustif est en section J.
    await assertSucceeds(
      setDoc(
        doc(db, "users", PLAYER_A1),
        { lastTrackingDecision: decisionReelle() },
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
  test("les trois énumérations du contrat de suivi sont bien celles des règles", () => {
    expect(champsDeLaRegle("trackingDecisionKinds").sort()).toEqual([...KINDS_BOUCLE].sort());
    expect(champsDeLaRegle("trackingDataQualities").sort()).toEqual(
      ["ok", "insufficient", "inconsistent"].sort(),
    );
    expect(champsDeLaRegle("trackingDecisionRequiredKeys").sort()).toEqual(
      [
        "version", "rulesVersion", "decidedAtISO", "kind",
        "targets", "explanation", "signalsDigest", "mode",
      ].sort(),
    );
    // La liste TOLÉRÉE = les exigées + `ruleIndex`, et rien d'autre.
    expect(champsDeLaRegle("trackingDecisionAllowedKeys")).toEqual(["ruleIndex"]);
  });

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

// ═════════════════════════════════════════════════════════════════════════════
// H. `selfReportedGapDays` — SIGNAL DÉCLARÉ : type, bornes, suppression
// ═════════════════════════════════════════════════════════════════════════════
//
// Le joueur a le droit de DÉCLARER depuis quand il ne s'entraîne plus. On ne
// valide donc pas la véracité — on valide qu'il déclare un NOMBRE DE JOURS
// PLAUSIBLE, et rien d'autre.
describe("H. `selfReportedGapDays` — ce que le joueur a le droit de déclarer", () => {
  // ── TÉMOINS POSITIFS ──────────────────────────────────────────────────────
  // Les QUATRE valeurs réellement proposées par l'écran (SELF_REPORTED_GAP_OPTIONS,
  // screens/ProfileSetupScreen.tsx) + `null`, qui est ce qu'écrit le setup quand
  // la question est passée. Sans ces témoins, une règle qui refuserait tout
  // rendrait cette section entièrement verte.
  test.each([0, 21, 60, 120])("la valeur réellement proposée %i est acceptée", async (jours) => {
    await assertSucceeds(ecrireGap(PLAYER_A1, jours));
  });

  test("`null` est accepté — c'est « je n'ai pas répondu », écrit tel quel par le setup", async () => {
    await assertSucceeds(ecrireGap(PLAYER_A1, null));
  });

  test("la borne haute exacte (3650 jours) est acceptée", async () => {
    await assertSucceeds(ecrireGap(PLAYER_A1, 3650));
  });

  test("il est posable À LA CRÉATION du document", async () => {
    await removeUserDoc(STRANGER);
    await assertSucceeds(
      setDoc(doc(asUser(STRANGER), "users", STRANGER), {
        firstName: "Joueur",
        selfReportedGapDays: 60,
        updatedAt: 1,
      }),
    );
  });

  // ── SUPPRESSION : PERMISE, ET C'EST UNE DÉCISION ─────────────────────────
  test("le joueur peut EFFACER sa déclaration (deleteField)", async () => {
    await seedUserDoc(PLAYER_A1, {
      uid: PLAYER_A1, firstName: "Anna", clubId: CLUB_A, selfReportedGapDays: 60,
    });
    await assertSucceeds(
      updateDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), {
        selfReportedGapDays: deleteField(),
      }),
    );
  });

  test("effacer ce champ ne fait pas passer un champ d'autorité au passage", async () => {
    await seedUserDoc(PLAYER_A1, {
      uid: PLAYER_A1, firstName: "Anna", clubId: CLUB_A, selfReportedGapDays: 60,
    });
    await assertFails(
      updateDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), {
        selfReportedGapDays: deleteField(),
        role: "coach",
      }),
    );
  });

  // ── TYPE ─────────────────────────────────────────────────────────────────
  const TYPES_REFUSES: Array<[string, unknown]> = [
    ["une chaîne", "21"],
    ["un flottant", 21.5],
    ["un booléen", true],
    ["une map", { jours: 21 }],
    ["une liste", [21]],
  ];

  test.each(TYPES_REFUSES)("%s est refusé", async (_libelle, valeur) => {
    await assertFails(ecrireGap(PLAYER_A1, valeur));
  });

  test.each(TYPES_REFUSES)("%s est refusé À LA CRÉATION aussi", async (_libelle, valeur) => {
    await removeUserDoc(STRANGER);
    await assertFails(
      setDoc(doc(asUser(STRANGER), "users", STRANGER), {
        firstName: "Joueur",
        selfReportedGapDays: valeur,
      }),
    );
  });

  // ── BORNES ───────────────────────────────────────────────────────────────
  test.each([-1, -365, 3651, 100000])("la valeur hors bornes %i est refusée", async (jours) => {
    await assertFails(ecrireGap(PLAYER_A1, jours));
  });

  // ── LE PIÈGE QUI NE CASSE QU'EN PRODUCTION ───────────────────────────────
  test("un document portant DÉJÀ une valeur non conforme reste modifiable par ailleurs", async () => {
    // Scénario : une valeur déposée par l'Admin SDK (qui contourne ces règles).
    // La validation ne porte QUE sur les clés touchées : sans ça, le titulaire
    // ne pourrait plus jamais éditer son profil — et ça ne se verrait qu'en prod.
    await seedUserDoc(PLAYER_A1, {
      uid: PLAYER_A1, firstName: "Anna", clubId: CLUB_A, selfReportedGapDays: "trois semaines",
    });
    await assertSucceeds(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        { firstName: "Anna B", position: "ATT", updatedAt: 12 },
        { merge: true },
      ),
    );
    // Mais il ne peut pas la REMPLACER par une autre valeur non conforme.
    await assertFails(ecrireGap(PLAYER_A1, "deux mois"));
    // Il peut en revanche la remettre d'aplomb.
    await assertSucceeds(ecrireGap(PLAYER_A1, 21));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// I. `lastTrackingDecision` — DÉCISION DÉRIVÉE : contrat fermé, une contrainte
//    à la fois
// ═════════════════════════════════════════════════════════════════════════════
describe("I. `lastTrackingDecision` — contrat fermé", () => {
  // ── TÉMOINS POSITIFS ──────────────────────────────────────────────────────
  test("la décision nominale (règle 11) est acceptée", async () => {
    await assertSucceeds(ecrireDecision(PLAYER_A1, decisionReelle()));
  });

  test("les DIX décisions possibles sont acceptées, une par une", async () => {
    for (const kind of KINDS_BOUCLE) {
      await assertSucceeds(ecrireDecision(PLAYER_A1, decisionReelle({ kind })));
    }
  });

  test("sans `ruleIndex` (les 8 champs du type seuls) : accepté", async () => {
    const sansRuleIndex = decisionReelle();
    delete sansRuleIndex.ruleIndex;
    await assertSucceeds(ecrireDecision(PLAYER_A1, sansRuleIndex));
  });

  test("digest entièrement à `null` (données insuffisantes) : accepté", async () => {
    await assertSucceeds(
      ecrireDecision(
        PLAYER_A1,
        decisionReelle({
          kind: "standard_insufficient_data",
          ruleIndex: 4,
          explanation:
            "Pas encore assez de données sur tes dernières séances : programme standard, en toute transparence.",
          signalsDigest: digestReel({
            completionRateAvg: null,
            rpeDeltaAvg: null,
            gapDays: null,
            dataQuality: "insufficient",
          }),
        }),
      ),
    );
  });

  test("moyennes HORS ÉCHELLE avec dataQuality « inconsistent » : accepté, et c'est voulu", async () => {
    // La boucle ne CORRIGE pas une valeur aberrante, elle la SIGNALE
    // (domain/tracking/signals.ts). Borner ces deux moyennes à 0-100 / ±10
    // refuserait exactement les décisions qui portent l'anomalie — donc
    // effacerait la trace de l'anomalie, en silence. Reste nommé dans
    // docs/coach-pilote-2026-07/INTEGRATION_BOUCLE.md.
    await assertSucceeds(
      ecrireDecision(
        PLAYER_A1,
        decisionReelle({
          kind: "standard_insufficient_data",
          ruleIndex: 4,
          signalsDigest: digestReel({
            completionRateAvg: 150,
            rpeDeltaAvg: -12.5,
            dataQuality: "inconsistent",
          }),
        }),
      ),
    );
  });

  test("le mode « applied » est accepté — c'est l'autre valeur du type, pas un droit", async () => {
    await assertSucceeds(ecrireDecision(PLAYER_A1, decisionReelle({ mode: "applied" })));
  });

  test("un `rulesVersion` BUMPÉ passe — on valide la forme, jamais un numéro figé", async () => {
    await assertSucceeds(
      ecrireDecision(PLAYER_A1, decisionReelle({ rulesVersion: "tracking-rules/2.13.4" })),
    );
  });

  test("`targets` peuplé (règles 5 et 6) est accepté", async () => {
    await assertSucceeds(
      ecrireDecision(
        PLAYER_A1,
        decisionReelle({
          kind: "suggest_variant",
          ruleIndex: 6,
          targets: ["split_squat_bulgare", "fente_marchee"],
          explanation:
            "Tu as trouvé split_squat_bulgare, fente_marchee trop difficile au moins 2 fois. La prochaine séance proposera une variante plus accessible, sans réduire le reste du programme.",
        }),
      ),
    );
  });

  test("elle est posable À LA CRÉATION du document", async () => {
    await removeUserDoc(STRANGER);
    await assertSucceeds(
      setDoc(doc(asUser(STRANGER), "users", STRANGER), {
        firstName: "Joueur",
        lastTrackingDecision: decisionReelle(),
        updatedAt: 1,
      }),
    );
  });

  test("le miroir peut être EFFACÉ (deleteField) — ce n'est pas la source", async () => {
    await seedUserDoc(PLAYER_A1, {
      uid: PLAYER_A1, firstName: "Anna", clubId: CLUB_A, lastTrackingDecision: decisionReelle(),
    });
    await assertSucceeds(
      updateDoc(doc(asUser(PLAYER_A1), "users", PLAYER_A1), {
        lastTrackingDecision: deleteField(),
      }),
    );
  });

  // ── LA VALEUR N'EST PAS UN OBJET ─────────────────────────────────────────
  test.each([
    ["une chaîne", "hold_dose"],
    ["un nombre", 1],
    ["un booléen", true],
    ["une liste", [{ kind: "hold_dose" }]],
    ["null", null],
  ])("%s à la place de la décision est refusé", async (_libelle, valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, valeur));
  });

  test("un objet vide est refusé — un contrat fermé l'est dans les deux sens", async () => {
    await assertFails(ecrireDecision(PLAYER_A1, {}));
  });

  test("un objet arbitraire est refusé", async () => {
    await assertFails(ecrireDecision(PLAYER_A1, { peuImporte: "n'importe quoi", taille: 4200 }));
  });

  // ── CLÉS : chacune manquante, une par une ────────────────────────────────
  const CLES_EXIGEES = [
    "version", "rulesVersion", "decidedAtISO", "kind",
    "targets", "explanation", "signalsDigest", "mode",
  ];

  test.each(CLES_EXIGEES)("la décision AMPUTÉE de « %s » est refusée", async (cle) => {
    const ampute = decisionReelle();
    delete ampute[cle];
    await assertFails(ecrireDecision(PLAYER_A1, ampute));
  });

  test.each(["note", "coachUid", "premium", "explication2"])(
    "une clé SUPPLÉMENTAIRE « %s » fait tomber toute l'écriture",
    async (cle) => {
      await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ [cle]: "x" })));
    },
  );

  // ── VERSION ──────────────────────────────────────────────────────────────
  test.each([[2], ["1"], [null], [1.0001]])("`version` = %p est refusée", async (valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ version: valeur })));
  });

  // ── VERSION DE RÈGLE ─────────────────────────────────────────────────────
  test.each([
    ["texte libre", "la version de juillet"],
    ["chaîne vide", ""],
    ["préfixe absent", "1.0.0"],
    ["forme incomplète", "tracking-rules/1.0"],
    ["préfixe usurpé", "autre-rules/1.0.0"],
    ["suffixe collé", "tracking-rules/1.0.0-et-du-texte"],
    ["pas une chaîne", 1],
  ])("`rulesVersion` %s est refusée", async (_libelle, valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ rulesVersion: valeur })));
  });

  // ── DATE ─────────────────────────────────────────────────────────────────
  test("la forme date seule « AAAA-MM-JJ » est acceptée (repli d'un feedback ancien)", async () => {
    await assertSucceeds(
      ecrireDecision(PLAYER_A1, decisionReelle({ decidedAtISO: "2026-07-28" })),
    );
  });

  test.each([
    ["texte libre", "hier soir"],
    ["chaîne vide", ""],
    ["date à l'envers", "28/07/2026"],
    ["horodatage numérique", 1_753_600_000_000],
    ["date noyée dans du texte", "le 2026-07-28T09:12:33.481Z exactement"],
  ])("`decidedAtISO` %s est refusée", async (_libelle, valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ decidedAtISO: valeur })));
  });

  // ── KIND ─────────────────────────────────────────────────────────────────
  test.each([
    ["inventé", "augmente_tout"],
    ["proche mais faux", "hold"],
    ["vide", ""],
    ["pas une chaîne", 3],
  ])("`kind` %s est refusé", async (_libelle, valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ kind: valeur })));
  });

  // ── TARGETS ──────────────────────────────────────────────────────────────
  test.each([
    ["une chaîne", "squat"],
    ["une map", { a: "squat" }],
    ["null", null],
  ])("`targets` %s est refusé", async (_libelle, valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ targets: valeur })));
  });

  test("`targets` au-delà de la taille bornée (51) est refusé", async () => {
    const trop = Array.from({ length: 51 }, (_, i) => `exo_${i}`);
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ targets: trop })));
  });

  test("`targets` à la taille limite exacte (50) est accepté", async () => {
    const limite = Array.from({ length: 50 }, (_, i) => `exo_${i}`);
    await assertSucceeds(ecrireDecision(PLAYER_A1, decisionReelle({ targets: limite })));
  });

  // ── EXPLICATION ──────────────────────────────────────────────────────────
  test("`explanation` non-chaîne est refusée", async () => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ explanation: { fr: "x" } })));
  });

  test("`explanation` au-delà de 1000 caractères est refusée", async () => {
    await assertFails(
      ecrireDecision(PLAYER_A1, decisionReelle({ explanation: "x".repeat(1001) })),
    );
  });

  test("`explanation` à la limite exacte (1000) est acceptée", async () => {
    await assertSucceeds(
      ecrireDecision(PLAYER_A1, decisionReelle({ explanation: "x".repeat(1000) })),
    );
  });

  // ── MODE ─────────────────────────────────────────────────────────────────
  test.each([
    ["inventé", "force"],
    ["vide", ""],
    ["pas une chaîne", true],
  ])("`mode` %s est refusé", async (_libelle, valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ mode: valeur })));
  });

  // ── DIGEST ───────────────────────────────────────────────────────────────
  test.each([
    ["une chaîne", "rien"],
    ["une liste", []],
    ["null", null],
  ])("`signalsDigest` %s est refusé", async (_libelle, valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ signalsDigest: valeur })));
  });

  test.each(["completionRateAvg", "rpeDeltaAvg", "painActive", "gapDays", "dataQuality"])(
    "le digest AMPUTÉ de « %s » est refusé",
    async (cle) => {
      const digest = digestReel();
      delete digest[cle];
      await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ signalsDigest: digest })));
    },
  );

  test("une clé SUPPLÉMENTAIRE dans le digest est refusée", async () => {
    await assertFails(
      ecrireDecision(
        PLAYER_A1,
        decisionReelle({ signalsDigest: digestReel({ commentaireLibre: "au genou" }) }),
      ),
    );
  });

  test.each([
    ["painActive non booléen", { painActive: "oui" }],
    ["gapDays négatif", { gapDays: -1 }],
    ["gapDays flottant", { gapDays: 2.5 }],
    ["gapDays chaîne", { gapDays: "2" }],
    ["gapDays absurde", { gapDays: 40000 }],
    ["dataQuality inventée", { dataQuality: "parfaite" }],
    ["dataQuality non-chaîne", { dataQuality: 1 }],
    ["completionRateAvg non numérique", { completionRateAvg: "96" }],
    ["rpeDeltaAvg non numérique", { rpeDeltaAvg: true }],
  ])("digest — %s : refusé", async (_libelle, patch) => {
    await assertFails(
      ecrireDecision(PLAYER_A1, decisionReelle({ signalsDigest: digestReel(patch) })),
    );
  });

  // ── RULEINDEX ────────────────────────────────────────────────────────────
  test.each([[0], [-1], [100], ["11"], [11.5]])("`ruleIndex` = %p est refusé", async (valeur) => {
    await assertFails(ecrireDecision(PLAYER_A1, decisionReelle({ ruleIndex: valeur })));
  });

  // ── AUCUNE MODIFICATION D'UN CHAMP D'AUTORITÉ ────────────────────────────
  test("une décision PARFAITEMENT valide ne fait pas passer un champ d'autorité", async () => {
    await seedProfilPropre(PLAYER_A1);
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        { lastTrackingDecision: decisionReelle(), role: "coach" },
        { merge: true },
      ),
    );
    await assertFails(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        {
          lastTrackingDecision: decisionReelle(),
          trackingConfig: { collect: true, shadow: true, apply: true },
        },
        { merge: true },
      ),
    );
  });

  test("on n'écrit pas une décision dans le document de quelqu'un d'autre", async () => {
    await assertFails(
      setDoc(
        doc(asUser(STRANGER), "users", PLAYER_A1),
        { lastTrackingDecision: decisionReelle() },
        { merge: true },
      ),
    );
  });

  // ── LE PIÈGE QUI NE CASSE QU'EN PRODUCTION ───────────────────────────────
  test("un document portant DÉJÀ une décision non conforme reste modifiable par ailleurs", async () => {
    await seedUserDoc(PLAYER_A1, {
      uid: PLAYER_A1, firstName: "Anna", clubId: CLUB_A,
      lastTrackingDecision: { kind: "vieille_forme" },
    });
    await assertSucceeds(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        { firstName: "Anna B", position: "ATT", updatedAt: 13 },
        { merge: true },
      ),
    );
    await assertFails(ecrireDecision(PLAYER_A1, { kind: "encore_une_vieille_forme" }));
    await assertSucceeds(ecrireDecision(PLAYER_A1, decisionReelle()));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// J. REJEU EXACT DES ÉCRITURES DES DEUX BRANCHES
// ═════════════════════════════════════════════════════════════════════════════
//
// LA garantie anti-casse. Les tests ci-dessus prouvent que le contrat REFUSE
// ce qu'il doit refuser ; celui-ci prouve qu'il ACCEPTE ce que la boucle écrit
// réellement. Sans lui, un contrat dérivé de la documentation plutôt que du
// code ferait disparaître la donnée en production, sans un message — ces deux
// écritures sont « best-effort ».
describe("J. Rejeu exact des écritures de la branche boucle de suivi", () => {
  test("ProfileSetupScreen : l'objet de setDoc complet, avec la question reprise", async () => {
    // Transcription de screens/ProfileSetupScreen.tsx (branche boucle), avec la
    // résolution du conflit décrite dans INTEGRATION_BOUCLE.md §3 : le bloc
    // d'enregistrement du coach, plus les deux lignes de la boucle.
    await assertSucceeds(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        {
          uid: PLAYER_A1,
          firstName: "Anna",
          clubId: CLUB_A,
          position: "DEF",
          ageCategory: "U18",
          level: "R1",
          dominantFoot: "droit",
          mainObjective: "force",
          targetFksSessionsPerWeek: 3,
          selfReportedGapDays: 60,
          clubTrainingsPerWeek: 2,
          matchesPerWeek: 1,
          hasClubTrainings: "oui",
          clubTrainingDays: ["mardi", "jeudi"],
          matchDay: "samedi",
          matchDays: ["samedi"],
          hasGymAccess: "occasional",
          gymEquipment: [],
          hasHomeEquipment: false,
          homeEquipment: [],
          profileCompleted: true,
          microcycleGoal: "force",
          goal: "force",
          programGoal: "force",
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

  test("ProfileSetupScreen : la question PASSÉE écrit `null`, et ça passe aussi", async () => {
    await assertSucceeds(
      setDoc(
        doc(asUser(PLAYER_A1), "users", PLAYER_A1),
        {
          uid: PLAYER_A1,
          firstName: "Anna",
          clubId: CLUB_A,
          targetFksSessionsPerWeek: 3,
          selfReportedGapDays: null,
          profileCompleted: true,
          updatedAt: 1_753_600_000_001,
        },
        { merge: true },
      ),
    );
  });

  // Les ONZE positions de RULE_ORDER (domain/tracking/rulesEngine.ts), avec
  // pour chacune le `kind` produit, le `ruleIndex` réellement écrit, les
  // `targets` et l'explication FR telle que `explain.ts` la fabrique.
  const REJEU_ONZE_REGLES: Array<{ nom: string; decision: DecisionBrute }> = [
    {
      nom: "règle 1 — douleur, priorité absolue",
      decision: decisionReelle({
        kind: "block_increase_pain",
        ruleIndex: 1,
        explanation:
          "Une gêne a été signalée (signalée 2 fois récemment). L'application n'augmente pas la charge et adapte la suite avec prudence.",
        signalsDigest: digestReel({ painActive: true, gapDays: 1 }),
      }),
    },
    {
      nom: "règle 2 — coupure longue",
      decision: decisionReelle({
        kind: "resume_mode",
        ruleIndex: 2,
        explanation:
          "Ta dernière séance terminée remonte à 41 jours. On repart en douceur avec les fondations avant de retrouver ton niveau.",
        signalsDigest: digestReel({ gapDays: 41 }),
      }),
    },
    {
      nom: "règle 3 — coupure courte",
      decision: decisionReelle({
        kind: "resume_mode",
        ruleIndex: 3,
        explanation:
          "Ta dernière séance terminée remonte à 18 jours. Reprise en douceur recommandée avant de retrouver ton niveau.",
        signalsDigest: digestReel({ gapDays: 18 }),
      }),
    },
    {
      nom: "règle 4 — données insuffisantes",
      decision: decisionReelle({
        kind: "standard_insufficient_data",
        ruleIndex: 4,
        explanation:
          "Pas encore assez de données sur tes dernières séances : programme standard, en toute transparence.",
        signalsDigest: digestReel({
          completionRateAvg: null,
          rpeDeltaAvg: null,
          gapDays: null,
          dataQuality: "insufficient",
        }),
      }),
    },
    {
      nom: "règle 5 — matériel durablement indisponible",
      decision: decisionReelle({
        kind: "prefer_replacement",
        ruleIndex: 5,
        targets: ["hip_thrust_barre", "tirage_poulie_haute"],
        explanation:
          "Tu as remplacé hip_thrust_barre, tirage_poulie_haute au moins 2 fois faute de matériel. La prochaine séance utilisera directement une variante compatible.",
      }),
    },
    {
      nom: "règle 6 — difficulté répétée",
      decision: decisionReelle({
        kind: "suggest_variant",
        ruleIndex: 6,
        targets: ["split_squat_bulgare"],
        explanation:
          "Tu as trouvé split_squat_bulgare trop difficile au moins 2 fois. La prochaine séance proposera une variante plus accessible, sans réduire le reste du programme.",
      }),
    },
    {
      nom: "règle 7 — effort trop élevé (intensité)",
      decision: decisionReelle({
        kind: "reduce_intensity_light",
        ruleIndex: 7,
        explanation:
          "Tu as ressenti un effort en moyenne +2.3 point(s) au-dessus de la cible sur tes 4 dernières séances. La charge reste stable pour consolider avant d'augmenter.",
        signalsDigest: digestReel({ rpeDeltaAvg: 2.3333333333333335, completionRateAvg: 94 }),
      }),
    },
    {
      nom: "règle 7 bis — effort trop élevé (volume)",
      decision: decisionReelle({
        kind: "reduce_volume_light",
        ruleIndex: 7,
        explanation:
          "Tu as ressenti un effort en moyenne +2.5 point(s) au-dessus de la cible sur tes 3 dernières séances. La charge reste stable pour consolider avant d'augmenter.",
        signalsDigest: digestReel({ rpeDeltaAvg: 2.5, completionRateAvg: 62.5 }),
      }),
    },
    {
      nom: "règle 8 — incomplète par manque de temps",
      decision: decisionReelle({
        kind: "keep_despite_time",
        ruleIndex: 8,
        explanation:
          "Tu as raccourci la séance par manque de temps, sans difficulté physique. Ta progression reste inchangée.",
        signalsDigest: digestReel({ completionRateAvg: 71.25 }),
      }),
    },
    {
      nom: "règle 9 — cas isolé, on maintient",
      decision: decisionReelle({
        kind: "hold_dose",
        ruleIndex: 9,
        explanation:
          "Ta dernière séance ne s'est pas déroulée comme prévu, mais c'est un cas isolé. La charge ne change pas, on continue comme prévu.",
        signalsDigest: digestReel({ completionRateAvg: 58 }),
      }),
    },
    {
      nom: "règle 10 — marge confirmée, petit pas",
      decision: decisionReelle({
        kind: "continue_planned",
        ruleIndex: 10,
        explanation:
          "Tes 5 dernières séances ont été plus faciles que prévu (effort moyen -2.4 par rapport à la cible), sans douleur. Le programme prévu peut avancer d'un petit pas, toujours dans ses limites.",
        signalsDigest: digestReel({ rpeDeltaAvg: -2.4, completionRateAvg: 100 }),
      }),
    },
    {
      nom: "règle 11 — défaut, tout s'est bien passé",
      decision: decisionReelle(),
    },
  ];

  test.each(REJEU_ONZE_REGLES.map((c) => [c.nom, c.decision] as const))(
    "applyFeedback écrit la décision de la %s : ACCEPTÉE",
    async (_nom, decision) => {
      await assertSucceeds(ecrireDecision(PLAYER_A1, decision));
    },
  );

  test("applyFeedback : le merge partiel réel ne touche QUE ce champ", async () => {
    // setDoc(doc(db, "users", uid), { lastTrackingDecision: decision }, { merge: true })
    // — l'écriture exacte de state/orchestrators/applyFeedback.ts, sur un
    // document déjà peuplé. Elle ne doit rien entraîner d'autre.
    await seedProfilPropre(PLAYER_A1);
    await assertSucceeds(ecrireDecision(PLAYER_A1, decisionReelle()));
    // Puis une seconde décision par-dessus, comme au feedback suivant.
    await assertSucceeds(
      ecrireDecision(
        PLAYER_A1,
        decisionReelle({
          kind: "hold_dose",
          ruleIndex: 9,
          decidedAtISO: "2026-07-29T18:44:02.007Z",
        }),
      ),
    );
  });

  // ── VERROU ARMÉ AU MERGE ─────────────────────────────────────────────────
  // Tant que la boucle n'est pas mergée, ces fichiers n'existent pas ici et le
  // verrou le DIT (pas de skip masqué). Une fois mergée, il compare le contrat
  // des règles au code réel — si la boucle change de forme, il rougit ici
  // plutôt qu'en silence en production.
  describe("verrou de forme contre le code réel de la boucle", () => {
    const RACINE_BOUCLE = resolve(__dirname, "..");
    const TYPES_BOUCLE = join(RACINE_BOUCLE, "domain", "tracking", "types.ts");
    const CONFIG_BOUCLE = join(RACINE_BOUCLE, "domain", "tracking", "config.ts");
    const boucleMergee = existsSync(TYPES_BOUCLE) && existsSync(CONFIG_BOUCLE);

    test(`la boucle est ${boucleMergee ? "PRÉSENTE" : "ABSENTE (non mergée)"}`, () => {
      expect(typeof boucleMergee).toBe("boolean");
    });

    (boucleMergee ? test : test.skip)(
      "les 10 kinds du contrat sont EXACTEMENT ceux de TrackingDecisionKind",
      () => {
        const src = readFileSync(TYPES_BOUCLE, "utf8");
        const debut = src.indexOf("export type TrackingDecisionKind");
        const fin = src.indexOf(";", debut);
        const bloc = src.slice(debut, fin);
        const reels = (bloc.match(/"[a-z_]+"/g) ?? []).map((s) => s.slice(1, -1)).sort();
        expect(reels).toEqual([...KINDS_BOUCLE].sort());
      },
    );

    (boucleMergee ? test : test.skip)(
      "le rulesVersion réel du moteur satisfait la forme exigée par les règles",
      () => {
        const src = readFileSync(CONFIG_BOUCLE, "utf8");
        const trouve = src.match(/rulesVersion:\s*"([^"]+)"/);
        expect(trouve).not.toBeNull();
        expect(trouve?.[1]).toMatch(/^tracking-rules\/[0-9]+\.[0-9]+\.[0-9]+$/);
      },
    );
  });

  // Le champ auto-déclaré : mêmes valeurs que l'écran, vérifiées contre le code
  // une fois la boucle mergée.
  test("les valeurs proposées par l'écran tiennent toutes dans les bornes de la règle", () => {
    const ECRAN = resolve(__dirname, "..", "screens", "ProfileSetupScreen.tsx");
    const src = readFileSync(ECRAN, "utf8");
    const debut = src.indexOf("SELF_REPORTED_GAP_OPTIONS = [");
    if (debut < 0) {
      // Boucle non mergée : l'écran ne porte pas encore la question. On le DIT
      // plutôt que de laisser un test vide passer au vert.
      expect(debut).toBe(-1);
      return;
    }
    const fin = src.indexOf("]", debut);
    const jours = (src.slice(debut, fin).match(/days:\s*(-?[0-9]+)/g) ?? []).map((s) =>
      Number(s.replace(/days:\s*/, "")),
    );
    expect(jours.length).toBeGreaterThan(0);
    for (const j of jours) {
      expect(Number.isInteger(j)).toBe(true);
      expect(j).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThanOrEqual(3650);
    }
  });
});
