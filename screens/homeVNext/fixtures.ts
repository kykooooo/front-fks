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

import type { HomeVNextInput } from "./viewModel";

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
