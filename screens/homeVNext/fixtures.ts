// screens/homeVNext/fixtures.ts
// =============================================================================
// PROTOTYPE Home vNext — 14 ETATS FICTIFS
// =============================================================================
//
// AUCUNE de ces donnees ne vient d'un joueur reel, d'un compte de production ou
// d'un appel backend. Chaque fixture porte `__fictif: true`.
//
// Chaque fixture est un `HomeVNextInput` COMPLET (aucun champ omis, aucun spread
// qui masquerait une incoherence) et COHERENT :
//   - `daysSinceLastSession` correspond toujours a la derniere entree de
//     `completedSessions` (le selecteur verifie et signale tout ecart) ;
//   - `fksSessionsCompletedThisWeek` ne compte que des seances presentes dans
//     `completedSessions` et datees de la semaine courante (lundi 2026-07-27) ;
//   - les points de tendance sont toujours posterieurs a la premiere seance
//     reellement terminee : aucun point d'amorcage ATL0/CTL0.
//
// Reference temporelle commune : jeudi 30 juillet 2026, 9h15 (heure locale).
// L'ISO est volontairement ECRIT SANS FUSEAU pour que `toDateKey` renvoie
// "2026-07-30" sur n'importe quelle machine — les captures du prototype doivent
// etre reproductibles.
// =============================================================================

import type { TestEntry } from "../tests/testConfig";
import { buildHomeVNextViewModel, type HomeVNextInput } from "./viewModel";
import type { ProgressionInput, ProgressionSeanceTerminee } from "./progressionViewModel";

/** Instant de reference de toutes les fixtures : jeudi 30 juillet 2026. */
export const FIXTURE_NOW_ISO = "2026-07-30T09:15:00";

/** Jour de reference, en cle locale. */
export const FIXTURE_TODAY_KEY = "2026-07-30";

export type HomeVNextFixture = {
  /** Identifiant stable, utilise par le visualiseur et les tests. */
  id: string;
  /** Titre lisible par un non-developpeur. */
  titre: string;
  /** Une ligne : ce que cet etat raconte. */
  resume: string;
  /** Marqueur explicite : donnees inventees pour la demonstration. */
  __fictif: true;
  input: HomeVNextInput;
};

// -----------------------------------------------------------------------------
// 1 — Nouveau joueur
// -----------------------------------------------------------------------------
const nouveauJoueur: HomeVNextFixture = {
  id: "nouveau-joueur",
  titre: "Nouveau joueur",
  resume: "Compte tout neuf : aucun historique, aucun cycle, rien à mesurer.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [],
    pendingSession: null,
    hasAppliedToday: false,
    microcycleGoal: null,
    microcycleSessionIndex: 0,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 0,
    daysSinceLastSession: null,
    formTrend: null,
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 2 — Seance prevue aujourd'hui
// -----------------------------------------------------------------------------
const seancePrevueAujourdhui: HomeVNextFixture = {
  id: "seance-prevue-aujourdhui",
  titre: "Séance prévue aujourd'hui",
  resume: "La prescription du jour est là, pas encore commencée.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-08", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-13", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-17", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-22", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-27", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: {
      id: "p-2026-07-30",
      dateKey: "2026-07-30",
      status: "non_commencee",
      feedbackGiven: false,
      title: "Force bas du corps",
      durationMin: 45,
      focusPrimaryLabel: "Force",
      intensityLabel: "Modérée",
      sessionTheme:
        "Tu as deux jours de charge dans les jambes : on garde le volume, on baisse l'intensité",
      rationale: "Maintien du volume hebdomadaire avec réduction de la contrainte neuromusculaire",
      playerContextTitle: "Semaine chargée",
      playerContextSummary:
        "Deux entraînements club depuis lundi, on protège les appuis tout en gardant le travail de force",
      coachingTips: [
        "Garde 90 secondes de récupération entre les gros efforts, sinon la qualité tombe.",
        "Pose bien le talon au sol sur les fentes.",
      ],
    },
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 3,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 3,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: 1.8 },
        { dateKey: "2026-07-25", value: 0.4 },
        { dateKey: "2026-07-26", value: -0.9 },
        { dateKey: "2026-07-27", value: -6.2 },
        { dateKey: "2026-07-28", value: -4.7 },
        { dateKey: "2026-07-29", value: -6.8 },
        { dateKey: "2026-07-30", value: -5.9 },
      ],
      stateLabel: "Un peu chargé",
      observedDayCount: 6,
      autoClubDaysExcluded: 2,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 3 — Seance commencee, non terminee
// -----------------------------------------------------------------------------
const seanceAReprendre: HomeVNextFixture = {
  id: "seance-a-reprendre",
  titre: "Séance à reprendre",
  resume: "Le joueur a lancé sa séance ce matin et s'est arrêté en cours de route.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-08", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-13", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-17", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-22", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-27", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: {
      id: "p-2026-07-30",
      dateKey: "2026-07-30",
      status: "commencee",
      feedbackGiven: false,
      title: "Force bas du corps",
      durationMin: 45,
      focusPrimaryLabel: "Force",
      intensityLabel: "Modérée",
      sessionTheme:
        "Tu as deux jours de charge dans les jambes : on garde le volume, on baisse l'intensité",
      rationale: null,
      playerContextTitle: null,
      playerContextSummary: null,
      coachingTips: ["Pose bien le talon au sol sur les fentes."],
    },
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 3,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 3,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: 1.8 },
        { dateKey: "2026-07-25", value: 0.4 },
        { dateKey: "2026-07-26", value: -0.9 },
        { dateKey: "2026-07-27", value: -6.2 },
        { dateKey: "2026-07-28", value: -4.7 },
        { dateKey: "2026-07-29", value: -6.8 },
        { dateKey: "2026-07-30", value: -5.9 },
      ],
      stateLabel: "Un peu chargé",
      observedDayCount: 6,
      autoClubDaysExcluded: 2,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 4 — Seance terminee aujourd'hui, retour donne
// -----------------------------------------------------------------------------
const seanceTerminee: HomeVNextFixture = {
  id: "seance-terminee",
  titre: "Séance terminée aujourd'hui",
  resume: "La journée est faite et le retour du joueur est enregistré : plus rien à faire.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-08", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-13", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-17", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-22", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-27", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
      { id: "s6", dateKey: "2026-07-30", title: "Force bas du corps", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: null,
    hasAppliedToday: true,
    microcycleGoal: "force",
    microcycleSessionIndex: 4,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 2,
    daysSinceLastSession: 0,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: 1.8 },
        { dateKey: "2026-07-25", value: 0.4 },
        { dateKey: "2026-07-26", value: -0.9 },
        { dateKey: "2026-07-27", value: -6.2 },
        { dateKey: "2026-07-28", value: -4.7 },
        { dateKey: "2026-07-29", value: -6.8 },
        { dateKey: "2026-07-30", value: -9.4 },
      ],
      stateLabel: "Un peu chargé",
      observedDayCount: 7,
      autoClubDaysExcluded: 2,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 5 — Jour de recuperation
// -----------------------------------------------------------------------------
// Choix assume : la recuperation n'est PAS un mode devine par le Home a partir
// d'un indicateur de charge (c'est ce que faisait `usePrimaryCta` avec
// `tsb <= -15`, en effacant au passage la seance deja prete). Ici, la journee
// legere est une SEANCE PRESCRITE comme une autre : elle a un titre, une duree
// et son propre "pourquoi". L'ecran ne decide rien, il montre la prescription.
// -----------------------------------------------------------------------------
const jourRecuperation: HomeVNextFixture = {
  id: "jour-recuperation",
  titre: "Jour de récupération",
  resume: "La séance du jour est une récupération prescrite, pas un mode deviné par l'écran.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-14", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s2", dateKey: "2026-07-18", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s3", dateKey: "2026-07-22", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
      { id: "s4", dateKey: "2026-07-25", title: "Force haut du corps", durationMin: 45, perceivedEffort: 7 },
      { id: "s5", dateKey: "2026-07-27", title: "Appuis & changements de direction", durationMin: 40, perceivedEffort: 8 },
      { id: "s6", dateKey: "2026-07-29", title: "Force bas du corps", durationMin: 50, perceivedEffort: 9 },
    ],
    pendingSession: {
      id: "p-2026-07-30",
      dateKey: "2026-07-30",
      status: "non_commencee",
      feedbackGiven: false,
      title: "Récup active",
      durationMin: 25,
      focusPrimaryLabel: "Mobilité",
      intensityLabel: "Facile",
      sessionTheme:
        "Grosse charge sur les trois derniers jours : aujourd'hui on relâche pour absorber",
      rationale: "Journée de décharge planifiée après trois jours consécutifs",
      playerContextTitle: null,
      playerContextSummary: null,
      coachingTips: [
        "Si tu ne peux pas tenir une conversation en bougeant, c'est déjà trop rapide.",
      ],
    },
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 6,
    weeklyGoalDeclared: 3,
    fksSessionsCompletedThisWeek: 2,
    daysSinceLastSession: 1,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: -2.1 },
        { dateKey: "2026-07-25", value: -7.4 },
        { dateKey: "2026-07-26", value: -6.1 },
        { dateKey: "2026-07-27", value: -11.3 },
        { dateKey: "2026-07-28", value: -9.8 },
        { dateKey: "2026-07-29", value: -14.6 },
        { dateKey: "2026-07-30", value: -12.9 },
      ],
      stateLabel: "À alléger",
      observedDayCount: 7,
      autoClubDaysExcluded: 1,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 6 — Jour sans seance prevue, avec un match declare demain
// -----------------------------------------------------------------------------
// Cet etat porte aussi la demonstration du defaut P1.5 de l'audit : aujourd'hui
// le CTA propose de generer AU-DESSUS d'un conseil qui dit de ne pas le faire.
// Ici le calendrier entre dans la ligne "pourquoi", il n'y a donc qu'une voix.
// -----------------------------------------------------------------------------
const jourSansSeance: HomeVNextFixture = {
  id: "jour-sans-seance",
  titre: "Jour sans séance prévue",
  resume: "Rien n'est prescrit aujourd'hui, et un match est noté demain.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-10", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-15", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-20", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-24", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-28", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: null,
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 5,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 2,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: -3.6 },
        { dateKey: "2026-07-25", value: -1.9 },
        { dateKey: "2026-07-26", value: 0.7 },
        { dateKey: "2026-07-27", value: 2.1 },
        { dateKey: "2026-07-28", value: -3.4 },
        { dateKey: "2026-07-29", value: -1.2 },
        { dateKey: "2026-07-30", value: 0.9 },
      ],
      stateLabel: "En forme",
      observedDayCount: 5,
      autoClubDaysExcluded: 2,
    },
    nextMatch: { dateKey: "2026-07-31", source: "profil_jour_recurrent" },
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 7 — Reprise apres interruption longue
// -----------------------------------------------------------------------------
// La tendance est volontairement FOURNIE en entree (avec son libelle "Frais")
// pour prouver que le selecteur REFUSE de l'afficher apres une interruption :
// c'est exactement l'etat E6 de l'audit ("Frais — bien repose, comme apres une
// coupure", courbe plate, cycle fige sur "Montee en puissance").
// -----------------------------------------------------------------------------
const repriseLongueInterruption: HomeVNextFixture = {
  id: "reprise-longue-interruption",
  titre: "Reprise après interruption longue",
  resume: "24 jours sans rien : l'écran ne fait pas semblant de savoir où en est le joueur.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-06-18", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-06-23", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-06-27", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-02", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-06", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: null,
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 4,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 0,
    daysSinceLastSession: 24,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: 8.9 },
        { dateKey: "2026-07-25", value: 9.1 },
        { dateKey: "2026-07-26", value: 9.2 },
        { dateKey: "2026-07-27", value: 9.4 },
        { dateKey: "2026-07-28", value: 9.5 },
        { dateKey: "2026-07-29", value: 9.6 },
        { dateKey: "2026-07-30", value: 9.7 },
      ],
      stateLabel: "Frais",
      observedDayCount: 0,
      autoClubDaysExcluded: 0,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 8 — Tendance indisponible (assez pour agir, pas assez pour mesurer)
// -----------------------------------------------------------------------------
// 5 points de tendance sont fournis (donc le seuil de POINTS est franchi), mais
// seulement 2 seances terminees : c'est le seuil de SEANCES qui bloque, et le
// message doit dire combien il en manque.
// -----------------------------------------------------------------------------
const tendanceIndisponible: HomeVNextFixture = {
  id: "tendance-indisponible",
  titre: "Tendance indisponible",
  resume: "Deux séances au compteur : assez pour agir, pas assez pour montrer une tendance.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-25", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-28", title: "Force bas du corps", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: null,
    hasAppliedToday: false,
    microcycleGoal: "fondation",
    microcycleSessionIndex: 2,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 2,
    formTrend: {
      points: [
        { dateKey: "2026-07-26", value: -1.4 },
        { dateKey: "2026-07-27", value: -0.2 },
        { dateKey: "2026-07-28", value: -5.8 },
        { dateKey: "2026-07-29", value: -3.9 },
        { dateKey: "2026-07-30", value: -2.1 },
      ],
      stateLabel: "En forme",
      observedDayCount: 2,
      autoClubDaysExcluded: 0,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 9 — Tendance disponible
// -----------------------------------------------------------------------------
// Vraies valeurs de fixture : une trajectoire qui descend pendant la semaine
// chargee puis remonte apres les jours calmes. Surtout pas une droite plate.
// -----------------------------------------------------------------------------
const tendanceDisponible: HomeVNextFixture = {
  id: "tendance-disponible",
  titre: "Tendance disponible",
  resume: "Assez de séances terminées : la tendance s'affiche, avec sa portée.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-06", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-09", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-13", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-17", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-21", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
      { id: "s6", dateKey: "2026-07-27", title: "Appuis & changements de direction", durationMin: 40, perceivedEffort: 8 },
      { id: "s7", dateKey: "2026-07-29", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
    ],
    pendingSession: null,
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 7,
    weeklyGoalDeclared: 3,
    fksSessionsCompletedThisWeek: 2,
    daysSinceLastSession: 1,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: -2.4 },
        { dateKey: "2026-07-25", value: -5.1 },
        { dateKey: "2026-07-26", value: -7.8 },
        { dateKey: "2026-07-27", value: -4.2 },
        { dateKey: "2026-07-28", value: 0.6 },
        { dateKey: "2026-07-29", value: 2.9 },
        { dateKey: "2026-07-30", value: -1.5 },
      ],
      stateLabel: "En forme",
      observedDayCount: 7,
      autoClubDaysExcluded: 3,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 10 — La derniere generation a echoue
// -----------------------------------------------------------------------------
const erreurGeneration: HomeVNextFixture = {
  id: "erreur-generation",
  titre: "Erreur de génération",
  resume: "La préparation de la séance a échoué : l'écran le dit et propose de réessayer.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-10", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-15", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-20", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-24", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-28", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: null,
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 5,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 2,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: -3.6 },
        { dateKey: "2026-07-25", value: -1.9 },
        { dateKey: "2026-07-26", value: 0.7 },
        { dateKey: "2026-07-27", value: 2.1 },
        { dateKey: "2026-07-28", value: -3.4 },
        { dateKey: "2026-07-29", value: -1.2 },
        { dateKey: "2026-07-30", value: 0.9 },
      ],
      stateLabel: "En forme",
      observedDayCount: 5,
      autoClubDaysExcluded: 2,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: { cause: "serveur", whenISO: "2026-07-30T09:11:00" },
  },
};

// -----------------------------------------------------------------------------
// 11 — Hors-ligne
// -----------------------------------------------------------------------------
const horsLigne: HomeVNextFixture = {
  id: "hors-ligne",
  titre: "Hors-ligne",
  resume: "Pas de réseau : l'écran fonctionne mais prévient que les chiffres peuvent dater.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-08", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-13", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-17", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-22", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-27", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: {
      id: "p-2026-07-30",
      dateKey: "2026-07-30",
      status: "non_commencee",
      feedbackGiven: false,
      title: "Force bas du corps",
      durationMin: 45,
      focusPrimaryLabel: "Force",
      intensityLabel: "Modérée",
      sessionTheme: "On garde le volume et on baisse l'intensité après deux jours chargés",
      rationale: null,
      playerContextTitle: null,
      playerContextSummary: null,
      coachingTips: ["Pose bien le talon au sol sur les fentes."],
    },
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 3,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 3,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: 1.8 },
        { dateKey: "2026-07-25", value: 0.4 },
        { dateKey: "2026-07-26", value: -0.9 },
        { dateKey: "2026-07-27", value: -6.2 },
        { dateKey: "2026-07-28", value: -4.7 },
        { dateKey: "2026-07-29", value: -6.8 },
        { dateKey: "2026-07-30", value: -5.9 },
      ],
      stateLabel: "Un peu chargé",
      observedDayCount: 6,
      autoClubDaysExcluded: 2,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "offline",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 12 — Aucun club
// -----------------------------------------------------------------------------
// Preuve n1 : sans club, l'ecran est COMPLET. Rien n'est vide, rien n'attend.
// -----------------------------------------------------------------------------
const directiveClubAbsente: HomeVNextFixture = {
  id: "directive-club-absente",
  titre: "Aucune directive club",
  resume: "Joueur sans club : l'écran est complet, aucun bloc en attente.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-08", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-13", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-17", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-22", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-27", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: {
      id: "p-2026-07-30",
      dateKey: "2026-07-30",
      status: "non_commencee",
      feedbackGiven: false,
      title: "Force bas du corps",
      durationMin: 45,
      focusPrimaryLabel: "Force",
      intensityLabel: "Modérée",
      sessionTheme: "On garde le volume et on baisse l'intensité après deux jours chargés",
      rationale: null,
      playerContextTitle: null,
      playerContextSummary: null,
      coachingTips: [
        "Garde 90 secondes de récupération entre les gros efforts, sinon la qualité tombe.",
      ],
    },
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 3,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 3,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: 1.8 },
        { dateKey: "2026-07-25", value: 0.4 },
        { dateKey: "2026-07-26", value: -0.9 },
        { dateKey: "2026-07-27", value: -6.2 },
        { dateKey: "2026-07-28", value: -4.7 },
        { dateKey: "2026-07-29", value: -6.8 },
        { dateKey: "2026-07-30", value: -5.9 },
      ],
      stateLabel: "Un peu chargé",
      observedDayCount: 6,
      autoClubDaysExcluded: 0,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 13 — Directive club presente mais NON appliquee par le moteur
// -----------------------------------------------------------------------------
// Entree strictement identique a la fixture 12, a une exception : la directive
// club existe. Le ViewModel produit doit etre le MEME cote ecran produit
// (aucun champ ne peut porter la directive), et signaler la situation dans
// `protoWarnings`. Voir la decision documentee dans `viewModel.ts`.
// -----------------------------------------------------------------------------
const directiveClubNonAppliquee: HomeVNextFixture = {
  id: "directive-club-non-appliquee",
  titre: "Directive club non appliquée",
  resume: "Le coach a posé une consigne, le moteur ne l'a pas encore prise en compte.",
  __fictif: true,
  input: {
    displayName: "Yanis",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-08", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-13", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-17", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-22", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-27", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: {
      id: "p-2026-07-30",
      dateKey: "2026-07-30",
      status: "non_commencee",
      feedbackGiven: false,
      title: "Force bas du corps",
      durationMin: 45,
      focusPrimaryLabel: "Force",
      intensityLabel: "Modérée",
      sessionTheme: "On garde le volume et on baisse l'intensité après deux jours chargés",
      rationale: null,
      playerContextTitle: null,
      playerContextSummary: null,
      coachingTips: [
        "Garde 90 secondes de récupération entre les gros efforts, sinon la qualité tombe.",
      ],
    },
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 3,
    weeklyGoalDeclared: 2,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 3,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: 1.8 },
        { dateKey: "2026-07-25", value: 0.4 },
        { dateKey: "2026-07-26", value: -0.9 },
        { dateKey: "2026-07-27", value: -6.2 },
        { dateKey: "2026-07-28", value: -4.7 },
        { dateKey: "2026-07-29", value: -6.8 },
        { dateKey: "2026-07-30", value: -5.9 },
      ],
      stateLabel: "Un peu chargé",
      observedDayCount: 6,
      autoClubDaysExcluded: 0,
    },
    nextMatch: null,
    clubDirective: {
      weekKey: "2026-07-27",
      trainingIntensityLabel: "Semaine lourde",
      weekGoalLabel: "Fraîcheur",
      note: "Grosse charge mardi et jeudi, on lève le pied côté physique.",
      appliedToPrescription: false,
    },
    connectivity: "online",
    generationError: null,
  },
};

// -----------------------------------------------------------------------------
// 14 — Joueur autonome, sans club, sans coach
// -----------------------------------------------------------------------------
// Preuve n2 : le Home ne depend jamais d'un suivi club. Ce joueur seul obtient
// l'ecran le plus complet du lot (action + pourquoi + cycle + semaine + forme
// + conseil + sortie), sans qu'aucun club n'existe nulle part.
// -----------------------------------------------------------------------------
const joueurAutonomeSansClub: HomeVNextFixture = {
  id: "joueur-autonome-sans-club",
  titre: "Joueur autonome sans club",
  resume: "Aucun club, aucun coach : l'écran est au complet quand même.",
  __fictif: true,
  input: {
    displayName: "Marvin",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-05", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-09", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-13", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-17", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-22", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
      { id: "s6", dateKey: "2026-07-28", title: "Appuis & changements de direction", durationMin: 40, perceivedEffort: 7 },
    ],
    pendingSession: {
      id: "p-2026-07-30",
      dateKey: "2026-07-30",
      status: "non_commencee",
      feedbackGiven: false,
      title: "Vitesse & démarrages",
      durationMin: 40,
      focusPrimaryLabel: "Vitesse",
      intensityLabel: "Élevée",
      sessionTheme: "Trois jours de calme derrière toi : c'est le bon moment pour du vif",
      rationale: "Fenêtre de fraîcheur exploitable pour du travail de qualité",
      playerContextTitle: "Fenêtre favorable",
      playerContextSummary: "Charge basse depuis mardi, aucune gêne déclarée",
      coachingTips: [
        "Marche entre chaque sprint, la récupération complète fait toute la différence.",
      ],
    },
    hasAppliedToday: false,
    microcycleGoal: "explosivite",
    microcycleSessionIndex: 8,
    weeklyGoalDeclared: 3,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 2,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: -6.3 },
        { dateKey: "2026-07-25", value: -4.1 },
        { dateKey: "2026-07-26", value: -1.7 },
        { dateKey: "2026-07-27", value: 0.8 },
        { dateKey: "2026-07-28", value: -3.2 },
        { dateKey: "2026-07-29", value: -0.6 },
        { dateKey: "2026-07-30", value: 1.9 },
      ],
      stateLabel: "En forme",
      observedDayCount: 6,
      autoClubDaysExcluded: 0,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

/** Les 14 etats du prototype, dans l'ordre de demonstration. */
export const HOME_VNEXT_FIXTURES: readonly HomeVNextFixture[] = [
  nouveauJoueur,
  seancePrevueAujourdhui,
  seanceAReprendre,
  seanceTerminee,
  jourRecuperation,
  jourSansSeance,
  repriseLongueInterruption,
  tendanceIndisponible,
  tendanceDisponible,
  erreurGeneration,
  horsLigne,
  directiveClubAbsente,
  directiveClubNonAppliquee,
  joueurAutonomeSansClub,
];

// -----------------------------------------------------------------------------
// 15 (hors serie) — TEXTES LONGS
// -----------------------------------------------------------------------------
// Ce n'est PAS un etat produit : c'est un cas de RESISTANCE de la mise en page.
// Il ne fait donc pas partie des 14 etats de demonstration (`HOME_VNEXT_FIXTURES`
// reste a 14, et le test du contrat qui le verifie reste vrai) ; il est expose
// separement et le harnais de rendu le genere en plus.
//
// Ce qui est pousse a la limite, et pourquoi :
//   - un PRENOM de 24 caracteres      -> l'en-tete doit tronquer le prenom, jamais
//                                        la pastille d'etat ;
//   - un TITRE DE SEANCE tres long    -> le sous-titre de l'aplat est du contenu
//                                        backend : il doit se borner, pas pousser
//                                        le chevron hors du bouton ;
//   - un THEME de seance tres long    -> la ligne "pourquoi" est bornee a 3 lignes ;
//   - un CONSEIL tres long            -> borne a 3 lignes lui aussi ;
//   - un LIBELLE D'ETAT long          -> la pastille ne doit pas ecraser le prenom ;
//   - un OBJECTIF HEBDO de 9 seances  -> au-dela de 7 la jauge segmentee disparait
//                                        (des echardes de 2 px ne se lisent pas).
//
// Les longueurs sont plausibles : le backend ecrit reellement des `sessionTheme`
// et des `coachingTips` de cette taille (pipeline 2-agents, agent B).
// -----------------------------------------------------------------------------
const stressTextesLongs: HomeVNextFixture = {
  id: "stress-textes-longs",
  titre: "Textes longs (test de résistance)",
  resume:
    "Prénom, titre de séance, raison et conseil poussés à la limite : rien ne doit déborder ni pousser la mise en page.",
  __fictif: true,
  input: {
    displayName: "Jean-Christophe-Alexandre",
    nowISO: FIXTURE_NOW_ISO,
    storeHydrated: true,
    completedSessions: [
      { id: "s1", dateKey: "2026-07-08", title: "Appuis & gainage", durationMin: 40, perceivedEffort: 6 },
      { id: "s2", dateKey: "2026-07-13", title: "Force bas du corps", durationMin: 50, perceivedEffort: 7 },
      { id: "s3", dateKey: "2026-07-17", title: "Intervalles courts", durationMin: 35, perceivedEffort: 8 },
      { id: "s4", dateKey: "2026-07-22", title: "Force haut du corps", durationMin: 45, perceivedEffort: 6 },
      { id: "s5", dateKey: "2026-07-27", title: "Duels & stabilité", durationMin: 45, perceivedEffort: 7 },
    ],
    pendingSession: {
      id: "p-2026-07-30",
      dateKey: "2026-07-30",
      status: "non_commencee",
      feedbackGiven: false,
      title:
        "Renforcement complet du bas du corps avec travail de stabilité unipodale et prévention des ischio-jambiers",
      durationMin: 45,
      focusPrimaryLabel: "Force",
      intensityLabel: "Modérée à élevée selon ton ressenti",
      sessionTheme:
        "Tu enchaînes depuis lundi deux entraînements club et un match amical, donc on garde exactement le même volume de travail que la semaine dernière mais on baisse nettement la contrainte sur les appuis pour laisser les tendons récupérer",
      rationale:
        "Maintien du volume hebdomadaire avec réduction marquée de la contrainte neuromusculaire sur les chaînes postérieures",
      playerContextTitle: "Semaine très chargée côté club",
      playerContextSummary:
        "Deux entraînements club et un match amical depuis lundi, on protège les appuis tout en gardant le travail de force",
      coachingTips: [
        // NOTE DE REDACTION : le mot « série » est banni du prototype, y compris
        // dans son sens musculation — le verificateur automatique le cherche sans
        // distinction de sens, et c'est voulu : une regle absolue se verifie, une
        // regle a exceptions se contourne.
        "Prends vraiment quatre-vingt-dix secondes de récupération entre chaque effort lourd : si tu rognes dessus, la qualité du mouvement tombe et tu travailles la fatigue au lieu de travailler la force.",
      ],
    },
    hasAppliedToday: false,
    microcycleGoal: "force",
    microcycleSessionIndex: 3,
    weeklyGoalDeclared: 9,
    fksSessionsCompletedThisWeek: 1,
    daysSinceLastSession: 3,
    formTrend: {
      points: [
        { dateKey: "2026-07-24", value: 1.8 },
        { dateKey: "2026-07-25", value: 0.4 },
        { dateKey: "2026-07-26", value: -0.9 },
        { dateKey: "2026-07-27", value: -6.2 },
        { dateKey: "2026-07-28", value: -4.7 },
        { dateKey: "2026-07-29", value: -6.8 },
        { dateKey: "2026-07-30", value: -5.9 },
      ],
      stateLabel: "Un peu chargé",
      observedDayCount: 6,
      autoClubDaysExcluded: 2,
    },
    nextMatch: null,
    clubDirective: null,
    connectivity: "online",
    generationError: null,
  },
};

/**
 * Cas de resistance de la mise en page, hors des 14 etats de demonstration.
 * Le harnais le rend en plus ; le contrat, lui, ne compte que les 14.
 */
export const HOME_VNEXT_FIXTURE_STRESS: HomeVNextFixture = stressTextesLongs;

/**
 * Tout ce que le harnais de rendu doit generer : les 14 etats produit + le cas
 * de resistance. A ne PAS utiliser pour raisonner sur les etats du produit.
 */
export const HOME_VNEXT_FIXTURES_RENDU: readonly HomeVNextFixture[] = [
  ...HOME_VNEXT_FIXTURES,
  HOME_VNEXT_FIXTURE_STRESS,
];

/** Recupere une fixture par son identifiant. `null` si inconnue. */
export function getHomeVNextFixture(id: string): HomeVNextFixture | null {
  return HOME_VNEXT_FIXTURES_RENDU.find((f) => f.id === id) ?? null;
}

// =============================================================================
// VARIANTE 2 — FIXTURES DE LA CARTE PROGRESSION
// =============================================================================
//
// Meme regle que ci-dessus : AUCUNE de ces donnees ne vient d'un joueur reel,
// d'un compte de production ou d'un appel backend. Chaque fixture porte
// `__fictif: true`.
//
// Les entrees de tests sont de VRAIS `TestEntry` (`screens/tests/testConfig.ts`) :
// memes cles, memes unites que la batterie de l'app. Aucune cle inventee.
//
// Les horodatages sont construits en UTC explicite (`tsUTC`) pour que le jour
// calcule par le ViewModel soit le meme sur toutes les machines — les captures
// du prototype doivent etre reproductibles.
// =============================================================================

export type ProgressionFixture = {
  /** Identifiant stable, utilise par le visualiseur et les tests. */
  id: string;
  /** Titre lisible par un non-developpeur. */
  titre: string;
  /** Une ligne : ce que cet etat demontre. */
  resume: string;
  /** Marqueur explicite : donnees inventees pour la demonstration. */
  __fictif: true;
  input: ProgressionInput;
};

/**
 * Horodatage UTC explicite. `mois` est humain (1 = janvier).
 *
 * Les MINUTES comptent : une batterie de tests ne se passe pas en une seule
 * seconde, et le ViewModel departage deux comparaisons a egalite d'horodatage
 * par l'ordre canonique de `FIELD_DEFS`. Des exercices qui partageaient tous le
 * meme `ts` rendaient donc ce tri arbitraire — et toujours gagnant pour le
 * premier champ de la liste. Voir P4 plus bas.
 */
function tsUTC(annee: number, mois: number, jour: number, heure: number, minute = 0): number {
  return Date.UTC(annee, mois - 1, jour, heure, minute, 0, 0);
}

/**
 * Adaptateur de DEMONSTRATION : derive une entree de carte progression depuis
 * une entree de Home deja ecrite, pour que les deux cartes du meme ecran
 * racontent exactement la meme chose.
 *
 * Deux points a savoir avant de s'en servir ailleurs :
 *
 *  - `semaineCourante` est rempli en appelant reellement `buildHomeVNextViewModel`.
 *    Le garde-fou R7 compare donc la carte au nombre que "Ma semaine" AFFICHE,
 *    pas a une valeur recopiee a la main qui pourrait deriver.
 *  - `ressentiEnregistre` est deduit ici de la presence d'un `perceivedEffort`,
 *    parce que c'est la seule trace de retour joueur que porte
 *    `HomeVNextCompletedSession`. Dans l'app reelle, lire `Boolean(session.feedback)` :
 *    c'est l'information exacte, et un retour peut exister sans RPE.
 *
 * PROTOTYPE : cet adaptateur sert a construire des fixtures, ce n'est PAS un
 * branchement de production.
 */
export function progressionInputDepuisHome(
  home: HomeVNextInput,
  extras: { testsTerrain?: readonly TestEntry[] } = {}
): ProgressionInput {
  const seancesTerminees: ProgressionSeanceTerminee[] = home.completedSessions.map((s) => ({
    id: s.id,
    dateKey: s.dateKey,
    dureeMin: s.durationMin,
    ressentiEnregistre: s.perceivedEffort !== null,
  }));
  const week = buildHomeVNextViewModel(home).week;
  return {
    chargesClubCapturees: false,
    seancesTerminees,
    testsTerrain: extras.testsTerrain ?? [],
    tendance: home.formTrend
      ? {
          points: home.formTrend.points.map((p) => ({ dateKey: p.dateKey, value: p.value })),
          joursObserves: home.formTrend.observedDayCount,
        }
      : null,
    semaineCourante: {
      blocAffiche: week !== null,
      seancesAffichees: week?.doneCount ?? 0,
    },
  };
}

// -----------------------------------------------------------------------------
// P1 — Nouveau joueur (enrichit la fixture Home du meme identifiant)
// -----------------------------------------------------------------------------
// Aucune seance terminee, aucun test, aucune trajectoire : etat "empty".
// Rien a mesurer, donc rien de mesure n'est affiche.
// -----------------------------------------------------------------------------
const progNouveauJoueur: ProgressionFixture = {
  id: "nouveau-joueur",
  titre: "Nouveau joueur",
  resume:
    "Compte tout neuf : trois repères et une mention honnête, aucun graphique, aucun bouton vers la page Progression.",
  __fictif: true,
  input: progressionInputDepuisHome(nouveauJoueur.input),
};

// -----------------------------------------------------------------------------
// P2 — Deux seances, tendance indisponible
// -----------------------------------------------------------------------------
// L'etat "collecting" du cahier des charges, avec ses quatre faits :
//   2 seances terminees / 76 minutes realisees / 2 ressentis enregistres /
//   Encore 2 seances avant d'afficher une tendance.
// Le dernier fait est CALCULE depuis PROGRESSION_SEANCES_MIN_POUR_TENDANCE (4).
//
// Les deux seances tombent sur deux semaines differentes (samedi 25 juillet,
// mardi 28 juillet) : "Ma semaine" affiche donc 1, la carte affiche 2. Aucun
// doublon, le garde-fou R7 n'a rien a retirer.
// -----------------------------------------------------------------------------
const progDeuxSeances: ProgressionFixture = {
  id: "deux-seances-tendance-indisponible",
  titre: "Deux séances, tendance indisponible",
  resume:
    "Assez de faits réels pour dire quelque chose, pas assez pour tracer une tendance : la carte liste, elle ne dessine pas.",
  __fictif: true,
  input: {
    chargesClubCapturees: false,
    seancesTerminees: [
      { id: "s1", dateKey: "2026-07-25", dureeMin: 40, ressentiEnregistre: true },
      { id: "s2", dateKey: "2026-07-28", dureeMin: 36, ressentiEnregistre: true },
    ],
    testsTerrain: [],
    // Une trajectoire EST fournie, et volontairement suffisante en points :
    // c'est le seuil de SEANCES qui bloque, et le message doit le dire.
    tendance: {
      points: [
        { dateKey: "2026-07-26", value: -1.4 },
        { dateKey: "2026-07-27", value: -0.2 },
        { dateKey: "2026-07-28", value: -5.8 },
        { dateKey: "2026-07-29", value: -3.9 },
        { dateKey: "2026-07-30", value: -2.1 },
      ],
      joursObserves: 2,
    },
    semaineCourante: { blocAffiche: true, seancesAffichees: 1 },
  },
};

// -----------------------------------------------------------------------------
// P3 — Tendance disponible (enrichit la fixture Home du meme identifiant)
// -----------------------------------------------------------------------------
// 7 seances terminees, 7 points, 7 jours observes : etat "ready".
// "Ma semaine" affiche 2, la carte affiche le CUMUL 7 : deux nombres, deux sens.
//
// LE SENS « PLUS GRAND = MIEUX », VISIBLE A L'ECRAN
// -----------------------------------------------------------------------------
// Depuis que "Test physique ameliore" met en avant le sprint (plus PETIT =
// mieux), il fallait qu'un cas « plus GRAND = mieux » reste lisible quelque part :
// les deux sens doivent etre observables, sinon la demonstration ne montre qu'une
// moitie du probleme. C'est ici : saut en longueur 205 -> 214 cm, +9 cm.
//
// Le joueur s'entraine du 6 au 29 juillet ; la batterie est passee le 4 juillet
// (avant la premiere seance) puis refaite le 25. Deux dates distinctes, un
// exercice commun : c'est exactement ce que la comparaison exige.
//
// POURQUOI CET ETAT-LA :
//   - c'est le seul autre etat "ready" ou une comparaison peut apparaitre sans
//     detruire ce que la fixture demontre. « Aucune comparaison de test » doit
//     precisement n'en avoir aucune ; « Donnee manquante » est la preuve de R1 ;
//   - la carte y remplacait une phrase d'absence (« Tes tests terrain
//     apparaitront ici des que... ») par une ligne de vide utile. Elle porte
//     maintenant un fait mesure. L'absence, elle, reste montree sur « Aucune
//     comparaison de test », avec sa raison la plus interessante (deux essais le
//     meme jour ne sont pas une progression) ;
//   - COUT EN HAUTEUR quasi nul, et c'etait un critere : deux lignes de
//     comparaison remplacent trois lignes d'explication. Le surcout de la
//     variante 2 — l'arbitrage que le fondateur doit rendre — n'est pas deplace
//     par ce choix. Les chiffres exacts sont dans mesures-hauteurs-variante2.md.
// -----------------------------------------------------------------------------
const testsCycleFondation: readonly TestEntry[] = [
  { ts: tsUTC(2026, 7, 4, 10, 15), playlist: "fondation", broadJumpCm: 205 },
  { ts: tsUTC(2026, 7, 25, 10, 20), playlist: "fondation", broadJumpCm: 214 },
];

const progTendanceDisponible: ProgressionFixture = {
  id: "tendance-disponible",
  titre: "Tendance disponible",
  resume:
    "Assez de séances ET assez de jours enregistrés : la courbe s'affiche avec sa portée exacte, le test refait (205 → 214 cm) donne un écart mesuré, et le lien vers le détail apparaît.",
  __fictif: true,
  input: progressionInputDepuisHome(tendanceDisponible.input, {
    testsTerrain: testsCycleFondation,
  }),
};

// -----------------------------------------------------------------------------
// P4 — Test physique ameliore
// -----------------------------------------------------------------------------
// Deux batteries a deux dates, avec de vraies ameliorations dans les DEUX sens
// de `lowerIsBetter` :
//   - saut en longueur   218 -> 227 cm  (plus grand = mieux)     -> amelioration
//   - test 505          2.55 -> 2.48 s  (plus PETIT = mieux)     -> amelioration
//   - sprint 10 m       1.85 -> 1.78 s  (plus PETIT = mieux)     -> amelioration
// Le 6 min n'existe que dans la batterie recente : il n'est donc PAS compare.
//
// UNE ENTREE PAR EXERCICE, AVEC SON HEURE REELLE — ET POURQUOI CA CHANGE TOUT
// -----------------------------------------------------------------------------
// Avant, les quatre mesures d'une meme batterie partageaient un seul `ts`. Or
// `choisirDerniereComparaison` (progressionViewModel.ts) prend la comparaison la
// plus RECENTE, et departage une egalite d'horodatage par l'ordre canonique de
// `FIELD_DEFS` — ou `broadJumpCm` arrive en premier. Consequence : sur les 60
// pages de la variante 2, le seul ecart JAMAIS AFFICHE etait « +9 cm », le cas
// facile, celui ou le signe du chiffre et le sens sportif vont dans le meme sens.
// Le cas qui compte — un CHRONO QUI BAISSE et qui est un PROGRES — existait dans
// la donnee sans jamais atteindre l'ecran.
//
// La logique de departage n'a pas ete touchee (elle est juste, et volontairement
// aveugle au sens : choisir la comparaison la plus flatteuse serait le chiffre
// arrange que la doctrine interdit). Ce sont les DONNEES qui ont ete corrigees :
// une batterie s'etale sur une heure, chaque exercice a son horaire, et
// l'exercice mesure en DERNIER est celui que la carte met en avant.
//
// Ordre retenu, le meme aux deux dates : saut en longueur, 505, sprint 10 m,
// puis l'endurance qui ferme la marche (elle fatigue, on ne mesure plus rien
// apres). Le sprint 10 m est donc le dernier exercice COMPARABLE : c'est lui que
// la carte affiche, avec « -0.07 s » et le mot « en progres ».
//
// Le test 505 est volontairement present : `screens/ProgressScreen.tsx` ne le
// compare pas (sa liste locale `TEST_FIELDS`, l.144-160, ignore 8 champs de
// FIELD_DEFS). La carte le montre, la page Progression non — le ViewModel le
// signale dans `protoWarnings`.
// -----------------------------------------------------------------------------
const testsAmeliores: readonly TestEntry[] = [
  // --- batterie du 15 juin 2026 (~40 min de terrain) ---
  { ts: tsUTC(2026, 6, 15, 10, 5), playlist: "fondation", broadJumpCm: 218 },
  { ts: tsUTC(2026, 6, 15, 10, 25), playlist: "fondation", test505_s: 2.55 },
  { ts: tsUTC(2026, 6, 15, 10, 45), playlist: "fondation", sprint10s: 1.85 },
  // --- batterie du 24 juillet 2026 (~1 h, endurance en dernier) ---
  { ts: tsUTC(2026, 7, 24, 10, 10), playlist: "force", broadJumpCm: 227 },
  { ts: tsUTC(2026, 7, 24, 10, 30), playlist: "force", test505_s: 2.48 },
  { ts: tsUTC(2026, 7, 24, 10, 50), playlist: "force", sprint10s: 1.78 },
  { ts: tsUTC(2026, 7, 24, 11, 15), playlist: "force", endurance6min_m: 1385 },
];

const progTestAmeliore: ProgressionFixture = {
  id: "test-physique-ameliore",
  titre: "Test physique amélioré",
  resume:
    "Deux batteries à deux dates. La carte affiche le sprint 10 m : 1,85 s → 1,78 s, soit −0,07 s, et elle écrit « en progrès ». Un chiffre négatif qui est une bonne nouvelle.",
  __fictif: true,
  input: {
    chargesClubCapturees: false,
    seancesTerminees: [
      { id: "s1", dateKey: "2026-07-08", dureeMin: 45, ressentiEnregistre: true },
      { id: "s2", dateKey: "2026-07-12", dureeMin: 50, ressentiEnregistre: true },
      { id: "s3", dateKey: "2026-07-16", dureeMin: 40, ressentiEnregistre: true },
      { id: "s4", dateKey: "2026-07-20", dureeMin: 45, ressentiEnregistre: true },
      { id: "s5", dateKey: "2026-07-25", dureeMin: 50, ressentiEnregistre: true },
      { id: "s6", dateKey: "2026-07-29", dureeMin: 40, ressentiEnregistre: false },
    ],
    testsTerrain: testsAmeliores,
    tendance: {
      points: [
        { dateKey: "2026-07-24", value: -4.8 },
        { dateKey: "2026-07-25", value: -8.1 },
        { dateKey: "2026-07-26", value: -5.4 },
        { dateKey: "2026-07-27", value: -2.2 },
        { dateKey: "2026-07-28", value: 1.1 },
        { dateKey: "2026-07-29", value: -3.6 },
        { dateKey: "2026-07-30", value: -1.0 },
      ],
      joursObserves: 6,
    },
    semaineCourante: { blocAffiche: true, seancesAffichees: 2 },
  },
};

// -----------------------------------------------------------------------------
// P5 — Aucune comparaison de test possible
// -----------------------------------------------------------------------------
// Quatre entrees de tests EXISTENT, et pourtant aucune paire n'est comparable :
//   - chaque batterie porte un exercice different (longueur, puis 10 m, puis 6 min) ;
//   - les deux dernieres entrees portent bien le MEME exercice (6 min), mais le
//     MEME JOUR — deux essais du 22 juillet, a deux heures differentes.
//
// Ce dernier cas est exactement celui que `computeTestComparisons`
// (`screens/ProgressScreen.tsx`:169-203) traite mal : il ne verifie pas les
// dates et afficherait une "progression" de +35 m entre deux essais du meme
// apres-midi. Ici : aucune comparaison, et on dit pourquoi.
// -----------------------------------------------------------------------------
const testsSansPaire: readonly TestEntry[] = [
  { ts: tsUTC(2026, 6, 10, 10), playlist: "fondation", broadJumpCm: 214 },
  { ts: tsUTC(2026, 7, 2, 10), playlist: "fondation", sprint10s: 1.83 },
  { ts: tsUTC(2026, 7, 22, 10), playlist: "endurance", endurance6min_m: 1420 },
  { ts: tsUTC(2026, 7, 22, 16), playlist: "endurance", endurance6min_m: 1455 },
];

const progAucuneComparaison: ProgressionFixture = {
  id: "aucune-comparaison-de-test",
  titre: "Aucune comparaison de test",
  resume:
    "Des tests existent, mais aucun n'a été refait un autre jour : la carte l'explique au lieu d'inventer une progression.",
  __fictif: true,
  input: {
    chargesClubCapturees: false,
    seancesTerminees: [
      { id: "s1", dateKey: "2026-07-09", dureeMin: 40, ressentiEnregistre: true },
      { id: "s2", dateKey: "2026-07-14", dureeMin: 50, ressentiEnregistre: true },
      { id: "s3", dateKey: "2026-07-18", dureeMin: 35, ressentiEnregistre: true },
      { id: "s4", dateKey: "2026-07-23", dureeMin: 45, ressentiEnregistre: true },
      { id: "s5", dateKey: "2026-07-28", dureeMin: 45, ressentiEnregistre: true },
    ],
    testsTerrain: testsSansPaire,
    tendance: {
      points: [
        { dateKey: "2026-07-25", value: 0.9 },
        { dateKey: "2026-07-26", value: 2.4 },
        { dateKey: "2026-07-27", value: 1.7 },
        { dateKey: "2026-07-28", value: -3.8 },
        { dateKey: "2026-07-29", value: -1.5 },
        { dateKey: "2026-07-30", value: 0.4 },
      ],
      joursObserves: 4,
    },
    semaineCourante: { blocAffiche: true, seancesAffichees: 1 },
  },
};

/** Les 5 cas de demonstration de la carte progression, dans l'ordre. */
export const PROGRESSION_FIXTURES: readonly ProgressionFixture[] = [
  progNouveauJoueur,
  progDeuxSeances,
  progTendanceDisponible,
  progTestAmeliore,
  progAucuneComparaison,
];

// -----------------------------------------------------------------------------
// P6 (hors serie) — DONNEE MANQUANTE
// -----------------------------------------------------------------------------
// Ce n'est PAS un des 5 cas de demonstration : c'est la preuve visuelle de R1.
//
// Trois seances terminees, AUCUNE duree connue, AUCUN ressenti enregistre.
// La carte ne doit afficher ni "0 minute", ni "-- min", ni "0 ressenti" : ces
// deux faits DISPARAISSENT, purement. Il ne reste que le cumul de seances et ce
// qui manque avant la tendance.
// -----------------------------------------------------------------------------
const progDonneeManquante: ProgressionFixture = {
  id: "donnee-manquante",
  titre: "Donnée manquante (preuve R1)",
  resume:
    "Trois séances sans durée ni ressenti connus : les faits correspondants disparaissent au lieu d'afficher 0 ou un tiret.",
  __fictif: true,
  input: {
    chargesClubCapturees: false,
    seancesTerminees: [
      { id: "s1", dateKey: "2026-07-18", dureeMin: null, ressentiEnregistre: false },
      { id: "s2", dateKey: "2026-07-23", dureeMin: null, ressentiEnregistre: false },
      { id: "s3", dateKey: "2026-07-28", dureeMin: null, ressentiEnregistre: false },
    ],
    testsTerrain: [],
    tendance: null,
    semaineCourante: { blocAffiche: true, seancesAffichees: 1 },
  },
};

/** Preuve de R1, hors des 5 cas de demonstration. */
export const PROGRESSION_FIXTURE_DONNEE_MANQUANTE: ProgressionFixture = progDonneeManquante;

/**
 * Tout ce que le harnais de rendu doit generer : les 5 cas de demonstration +
 * la preuve R1. A ne PAS utiliser pour raisonner sur les cas du produit.
 */
export const PROGRESSION_FIXTURES_RENDU: readonly ProgressionFixture[] = [
  ...PROGRESSION_FIXTURES,
  PROGRESSION_FIXTURE_DONNEE_MANQUANTE,
];

/** Recupere une fixture de progression par son identifiant. `null` si inconnue. */
export function getProgressionFixture(id: string): ProgressionFixture | null {
  return PROGRESSION_FIXTURES_RENDU.find((f) => f.id === id) ?? null;
}
