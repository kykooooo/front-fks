// firestore-tests/fixtures.ts
//
// Identifiants + seed admin (règles DÉSACTIVÉES via withSecurityRulesDisabled)
// pour les tests Firestore Rules.
//
// ⚠️ AUCUNE donnée personnelle réelle — valeurs factices uniquement.
// Les champs "sensibles" (pain/comment/tsb/aiV2) sont présents VOLONTAIREMENT
// dans les docs bruts pour prouver la fuite actuelle : ils ne devront jamais
// transiter par la future projection coach-safe (clubs/{clubId}/playerSummaries).

import { doc, setDoc } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
// Source de vérité de la liste interdite (cf. FORBIDDEN_SUMMARY_KEYS plus bas).
import { FORBIDDEN_KEYS } from "../functions/src/dto";

export const PROJECT_ID = "demo-fks-rules";

// ── Club A ──────────────────────────────────────────────────────────────────
export const CLUB_A = "clubA";
export const COACH_A = "coachA"; // owner ET coach du club A
export const PLAYER_A1 = "playerA1";
export const PLAYER_A2 = "playerA2";
export const CLUB_A_INVITE = "CLBA-1234";

// Cas STALE / edge pour le durcissement isPlayerMember (PR-4 mini-hardening) :
//  - PLAYER_A_GONE : une projection existe encore sous club A mais la joueuse n'a
//    plus (ou n'a jamais eu) de doc members/ → summary orphelin, doit être illisible.
//  - BADROLE_A : membre du club A avec un rôle NON "player" (ni player ni coach) →
//    une projection à son nom ne doit pas être lisible via isPlayerMember.
export const PLAYER_A_GONE = "playerAgone";
export const BADROLE_A = "badroleA";

// ── Club B ──────────────────────────────────────────────────────────────────
export const CLUB_B = "clubB";
export const COACH_B = "coachB"; // owner ET coach du club B
export const PLAYER_B = "playerB";
export const CLUB_B_INVITE = "CLBB-9999";

// ── Utilisateur authentifié SANS club ───────────────────────────────────────
export const STRANGER = "stranger";

// weekKey coach = date du lundi "YYYY-MM-DD"
export const WEEK_KEY = "2026-06-29";

// Valeurs sensibles injectées dans la séance faite de playerA1 (preuve de fuite).
export const SENSITIVE = {
  pain: 3,
  comment: "j'ai mal au genou depuis samedi",
  tsb: -14.2,
  atl: 55.1,
  ctl: 40.9,
};

// ── Projection coach-safe CIBLE (clubs/{clubId}/playerSummaries/{playerUid}) ──
// DTO minimal EXCLUSIVEMENT coach-safe. Aucun champ médical / intime / charge
// brute / commentaire. Labels déjà lisibles (pré-traduits), pas de token brut.
// Utilisé par rules.target.test.ts (tests skip). En prod, `updatedAt` sera un
// serverTimestamp() posé par la Cloud Function ; ici une valeur fixe (déterminisme).
// Aligné EXACTEMENT sur le DTO produit par la Cloud Function (functions/src/dto.ts) :
//  - position/level = allowlists front réelles ("Milieu"/"Regional") ;
//  - title = dérivé du focus allowlisté ("Séance renfo / force"), jamais un titre libre ;
//  - PAS d'`id` de séance (retiré du contrat public : doc ID = texte client arbitraire) ;
//  - enveloppe watermark réellement persistée (sourceEventAt/Time/Id + updatedAt).
export const SUMMARY = {
  playerUid: PLAYER_A1,
  firstName: "Anna",
  ageCategory: "U15",
  position: "Milieu",
  level: "Regional",
  profileComplete: true,
  latestSession: {
    dateKey: "2026-06-28",
    title: "Séance renfo / force",
    focusLabel: "Renfo / Force",
    intensityLabel: "Modérée",
    durationMin: 40,
    blockCount: 4,
    status: "done",
  },
  lastActivity: {
    dateKey: "2026-06-28",
    durationMin: 40,
    // ⚠️ PAS de RPE — retiré du dashboard coach (décision produit verrouillée).
  },
  adaptation: {
    adapted: true,
    labels: ["Contrôle appuis et alignement"],
  },
  // Extension v2 : prévu ET fait coexistent, dates d'activité brutes, exécution
  // réelle. Rien de sensible — les raisons d'écart sont déjà traduites par
  // l'allowlist fermée du serveur (douleur/fatigue/inconnu → "Autre raison").
  activity: {
    doneDateKeys: ["2026-06-28", "2026-06-25", "2026-06-23"],
  },
  lastPlanned: {
    dateKey: "2026-07-02",
    title: "Séance vitesse",
    focusLabel: "Vitesse",
    intensityLabel: "Intense",
    durationMin: 35,
    blockCount: 3,
  },
  lastDone: {
    dateKey: "2026-06-28",
    title: "Séance renfo / force",
    focusLabel: "Renfo / Force",
    intensityLabel: "Modérée",
    durationMin: 40,
    blockCount: 4,
  },
  // Bloc RECALCULABLE : (9 faits + 1 adapté + 0 remplacé) / 12 exercices = 83 %.
  // Le 12e exercice est resté sans statut connu : il compte dans le total et pèse
  // 0 — c'est pourquoi les compteurs ne somment pas au total.
  execution: {
    completionPct: 83,
    completionStatus: "partial",
    itemsDone: 9,
    itemsAdapted: 1,
    itemsSkipped: 1,
    itemsReplaced: 0,
    itemsReplacedEquivalent: 0,
    itemsReplacedPartial: 0,
    itemsTotal: 12,
    deviationLabels: ["Manque de temps", "Autre raison"],
  },
  // Enveloppe watermark (idempotence/ordre). En prod `updatedAt` = serverTimestamp() ;
  // ici valeurs fixes pour le déterminisme des tests Rules (TARGET, skip en PR-4).
  sourceEventAt: 1751133600000,
  sourceEventTime: "2026-06-28T18:00:00.000Z",
  sourceEventId: "seed-a1",
  updatedAt: "2026-06-28T18:00:00.000Z",
};

// Champs STRICTEMENT interdits dans la projection — servent d'assertion négative
// (aucune de ces clés ne doit exister dans un summary).
//
// RESYNCHRONISÉ sur `functions/src/dto.FORBIDDEN_KEYS` : les deux listes étaient
// censées être LE MÊME contrat, mais elles avaient divergé (13 entrées ici contre
// 31 côté serveur — donc `severity`, `menstruation`, `guardrails`, `prompt`… n'étaient
// pas testés côté Rules). On importe désormais la source de vérité au lieu de la
// recopier : la liste ne peut plus dériver en silence.
//
// On y ajoute les variantes camelCase réellement écrites par le client (la liste
// serveur est normalisée en minuscules pour son propre comparateur, alors qu'ici
// on teste des noms de clés Firestore tels quels).

const CAMEL_CASE_VARIANTS = [
  "aiV2",
  "painZone",
  "painZones",
  "recoveryPerceived",
  "guardrailsApplied",
  "clientGuardrailsApplied",
  "selectionDebug",
];

export const FORBIDDEN_SUMMARY_KEYS: string[] = [
  ...new Set([...FORBIDDEN_KEYS, ...CAMEL_CASE_VARIANTS]),
];

// Seed de la projection coach-safe (règles désactivées). À appeler APRÈS seed().
export async function seedPlayerSummary(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "clubs", CLUB_A, "playerSummaries", PLAYER_A1), SUMMARY);
  });
}

export async function seed(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Clubs (avec inviteCode volontairement lisible)
    await setDoc(doc(db, "clubs", CLUB_A), {
      name: "Club A",
      inviteCode: CLUB_A_INVITE,
      ownerUid: COACH_A,
      teamGender: "female",
    });
    await setDoc(doc(db, "clubs", CLUB_B), {
      name: "Club B",
      inviteCode: CLUB_B_INVITE,
      ownerUid: COACH_B,
      teamGender: "male",
    });

    // Annuaire code→club (/inviteCodes/{code}, doc ID = code). Créé par
    // createClub côté client ; seedé ici en admin (backfill pour clubs existants).
    await setDoc(doc(db, "inviteCodes", CLUB_A_INVITE), { clubId: CLUB_A, name: "Club A" });
    await setDoc(doc(db, "inviteCodes", CLUB_B_INVITE), { clubId: CLUB_B, name: "Club B" });

    // Members — VOLONTAIREMENT sans champ inviteCode : c'est le cas réel des
    // membres EXISTANTS (pilote) créés avant le durcissement. Les tests de
    // compat prouvent qu'ils gardent toutes leurs lectures.
    await setDoc(doc(db, "clubs", CLUB_A, "members", COACH_A), { uid: COACH_A, role: "coach" });
    await setDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A1), { uid: PLAYER_A1, role: "player" });
    await setDoc(doc(db, "clubs", CLUB_A, "members", PLAYER_A2), { uid: PLAYER_A2, role: "player" });
    await setDoc(doc(db, "clubs", CLUB_B, "members", COACH_B), { uid: COACH_B, role: "coach" });
    await setDoc(doc(db, "clubs", CLUB_B, "members", PLAYER_B), { uid: PLAYER_B, role: "player" });

    // Users (le profil brut porte clubId → utilisé par isCoachOfUser dans les rules)
    await setDoc(doc(db, "users", COACH_A), {
      uid: COACH_A, clubId: CLUB_A, role: "coach", firstName: "CoachA", profileCompleted: true,
    });
    await setDoc(doc(db, "users", COACH_B), {
      uid: COACH_B, clubId: CLUB_B, role: "coach", firstName: "CoachB", profileCompleted: true,
    });
    await setDoc(doc(db, "users", PLAYER_A1), {
      uid: PLAYER_A1, clubId: CLUB_A, role: "player", firstName: "Anna",
      position: "MIL", level: "R1", ageCategory: "U15", profileCompleted: true,
    });
    await setDoc(doc(db, "users", PLAYER_A2), {
      uid: PLAYER_A2, clubId: CLUB_A, role: "player", firstName: "Bea",
      ageCategory: "U15", profileCompleted: true,
    });
    await setDoc(doc(db, "users", PLAYER_B), {
      uid: PLAYER_B, clubId: CLUB_B, role: "player", firstName: "Clea",
      ageCategory: "U18", profileCompleted: true,
    });

    // Séance FAITE de playerA1 — contient feedback (pain/comment) + metrics (tsb) + aiV2
    await setDoc(doc(db, "users", PLAYER_A1, "sessions", "s1"), {
      date: "2026-06-28",
      dateISO: "2026-06-28",
      title: "Renfo bas du corps",
      feedback: { pain: SENSITIVE.pain, comment: SENSITIVE.comment, fatigue: 4, rpe: 8 },
      metrics: { atl: SENSITIVE.atl, ctl: SENSITIVE.ctl, tsb: SENSITIVE.tsb },
      aiV2: { title: "Renfo bas du corps", focusPrimary: "strength", blocks: [{ token: "strength_force_lower_main" }] },
    });

    // Séance PLANIFIÉE de playerA1 — blueprint IA brut sous `ai` (+ selection_debug)
    await setDoc(doc(db, "users", PLAYER_A1, "plannedSessions", "p1"), {
      date: "2026-07-02",
      title: "Explosivite",
      focus: "speed",
      ai: { title: "Explosivite", blocks: [{ token: "explosivite_accel_main" }], selection_debug: { seed: 42 } },
    });

    // Contexte de semaine du club A (posé par coachA)
    await setDoc(doc(db, "clubs", CLUB_A, "weekContexts", WEEK_KEY), {
      weekKey: WEEK_KEY,
      clubId: CLUB_A,
      createdBy: COACH_A,
      trainingIntensity: "heavy",
      weekGoal: "freshness",
      note: null,
      matchThisWeekend: true,
    });
  });
}
