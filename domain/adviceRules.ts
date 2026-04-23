// domain/adviceRules.ts
// Règles déclaratives pour le système de conseils contextuels
// Chaque règle définit une condition et le conseil à afficher
// Les messages sont écrits en langage football-friendly (pas de jargon ATL/CTL/TSB)

import { getFootballLabel } from "../config/trainingDefaults";
import { SAFETY_PHRASES } from "../shared/SAFETY_PHRASES";

export type AdviceId =
  | "injury_pain_spike"
  | "match_today"
  | "match_tomorrow"
  | "tsb_extreme_fatigue"
  | "post_match"
  | "tsb_fatigue"
  | "injury_active"
  | "injury_stale"
  | "cycle_almost_done"
  | "no_mobility"
  | "routine_streak"
  | "club_today"
  | "recovery_needed"
  | "good_shape"
  | "injury_progress_detected"
  | "ready_default";

export type AdviceTone = "info" | "warn" | "danger" | "success";

export type Advice = {
  id: AdviceId;
  title: string;
  message: string;
  tone: AdviceTone;
  icon: string;
  actionLabel?: string;
  actionRoute?: string;
  actionParams?: Record<string, unknown>;
  /** Micro-tip éducatif football (optionnel) */
  tip?: string;
  /**
   * Actions complémentaires (ex: SAMU 15, Urgences 112) pour les règles
   * critiques comme `injury_pain_spike`. L'UI les affiche sous le message.
   */
  extraActions?: Array<{
    label: string;
    telNumber?: string;
    route?: string;
  }>;
  /**
   * Si `true`, la carte ne peut pas être dismissée par un swipe.
   * Utilisé par `injury_pain_spike` (règle 5 de INJURY_IA_CHARTER.md).
   */
  nonDismissable?: boolean;
  /**
   * Si défini, indique au consumer (HomeScreen) d'ouvrir un modal dédié
   * plutôt que de naviguer simplement. Valeurs supportées actuellement :
   *   - `"pain_spike"` : ouvre `components/PainSpikeModal.tsx` (3 boutons).
   */
  modal?: "pain_spike";
};

export type AdviceContext = {
  // Métriques charge
  tsb: number;
  atl: number;
  ctl: number;

  // Calendrier
  matchDays: string[];
  clubTrainingDays: string[];
  daysUntilMatch: number | null;
  isMatchToday: boolean;
  isPostMatch: boolean;
  isClubToday: boolean;

  // Cycle
  microcycleGoal: string | null;
  microcycleSessionIndex: number;
  cycleRemaining: number;

  // Routines / Historique
  daysSinceLastMobility: number | null;
  routineStreak: number;

  // Blessures
  hasActiveInjury: boolean;
  injuryArea?: string;
  /**
   * Max sévérité (0..3) parmi les `activeInjuries` du profil.
   * Nécessaire pour les règles `injury_progress_detected` (>= 2) et
   * `injury_pain_spike` (on ne déclenche que si le joueur a déjà une
   * zone sensible active — un pic de douleur chez un joueur sans
   * blessure déclarée n'est pas géré par ces règles).
   */
  injuryMaxSeverity?: number;
  /**
   * Scores de douleur (`feedback.pain`) des feedbacks renseignés dans
   * les 14 derniers jours (règle 4 mise à jour Jour 4 de
   * INJURY_IA_CHARTER.md). La règle `injury_progress_detected` se
   * déclenche si `length >= 3` ET pain moyen `<= 2` ET
   * `injuryMaxSeverity >= 2`. Plus robuste au skip de feedback que
   * l'ancienne "3 consécutifs".
   */
  recentInjuryPainScoresLast14Days?: number[];
  /**
   * Dernier feedback avec une douleur élevée (>= 7 sur l'échelle EVA
   * 0-10 unifiée). Si présent, dans les 24h, ET non-acquitté via
   * `lastSeenPainSpikeISO`, déclenche `injury_pain_spike`.
   */
  lastPainSpike?: { pain: number; dateISO: string } | null;
  /**
   * Timestamp ISO du dernier acquittement manuel d'un pic de douleur
   * (bouton "J'ai consulté" de PainSpikeModal). Si `>= lastPainSpike.dateISO`,
   * la règle `injury_pain_spike` ne se déclenche pas (évite re-trigger
   * infini sur le même feedback).
   */
  lastSeenPainSpikeISO?: string | null;
  /**
   * Injury dont `lastConfirm` date de plus de 7 jours mais moins de 14
   * jours (Jour 4 règle D). Si présent, déclenche `injury_stale` —
   * carte Home de confirmation "Ta [zone] est toujours sensible ?".
   * Au-delà de 14 jours, l'injury est auto-désactivée côté lecture
   * (filtrée avant d'atteindre ce champ).
   */
  staleInjury?: { area: string; daysSince: number } | null;

  // Date
  nowISO: string;
};

export type AdviceRule = {
  id: AdviceId;
  priority: number;
  condition: (ctx: AdviceContext) => boolean;
  build: (ctx: AdviceContext) => Advice;
};

export const ADVICE_RULES: AdviceRule[] = [
  // Priorité 0 (CRITIQUE, passe avant tout) : pic de douleur signalé.
  // Règle 5 de INJURY_IA_CHARTER.md : non-dismissable jusqu'à action.
  // Trigger : dernier feedback avec `pain >= 7` dans les 24h, ET non
  // acquitté via PainSpikeModal (lastSeenPainSpikeISO < lastPainSpike.dateISO).
  // Le consumer (HomeScreen) détecte `modal: "pain_spike"` et ouvre
  // `components/PainSpikeModal.tsx` (Jour 4).
  {
    id: "injury_pain_spike",
    priority: 0,
    condition: (ctx) => {
      const spike = ctx.lastPainSpike;
      if (!spike || typeof spike.pain !== "number" || spike.pain < 7) return false;
      const spikeTime = new Date(spike.dateISO).getTime();
      if (!Number.isFinite(spikeTime)) return false;
      const nowTime = new Date(ctx.nowISO).getTime();
      const ageMs = nowTime - spikeTime;
      if (ageMs < 0 || ageMs > 24 * 60 * 60 * 1000) return false;

      // Déjà acquitté manuellement via PainSpikeModal ?
      if (ctx.lastSeenPainSpikeISO) {
        const ackTime = new Date(ctx.lastSeenPainSpikeISO).getTime();
        if (Number.isFinite(ackTime) && ackTime >= spikeTime) return false;
      }
      return true;
    },
    build: () => ({
      id: "injury_pain_spike",
      title: "Ta douleur a nettement augmenté",
      message: SAFETY_PHRASES.PAIN_SPIKE_ALERT,
      tone: "danger",
      icon: "alert-circle",
      nonDismissable: true,
      modal: "pain_spike",
      extraActions: [
        { label: "SAMU 15", telNumber: "15" },
        { label: "Urgences 112", telNumber: "112" },
        { label: "Modifier ma zone sensible", route: "Profile" },
      ],
    }),
  },

  // Priorité 1: Match aujourd'hui
  {
    id: "match_today",
    priority: 1,
    condition: (ctx) => ctx.isMatchToday,
    build: () => ({
      id: "match_today",
      title: "Jour de match",
      message: "Pas de séance FKS aujourd'hui. Focus sur ton match, une activation légère suffit.",
      tone: "warn",
      icon: "football-outline",
      actionLabel: "Activation Express",
      actionRoute: "PrebuiltSessions",
      tip: "Les pros font une activation de 15 min max le jour du match : mobilité + quelques sprints courts.",
    }),
  },

  // Priorité 2: Match demain
  {
    id: "match_tomorrow",
    priority: 2,
    condition: (ctx) => ctx.daysUntilMatch === 1,
    build: () => ({
      id: "match_tomorrow",
      title: "Match demain",
      message: "Garde tes jambes fraîches. Mobilité ou activation légère, pas plus.",
      tone: "info",
      icon: "calendar-outline",
      actionLabel: "Routine pré-match",
      actionRoute: "PrebuiltSessions",
      tip: "La veille de match, les pros privilégient la mobilité et la visualisation plutôt que la force.",
    }),
  },

  // Priorité 3: Fatigue extrême (surcharge)
  {
    id: "tsb_extreme_fatigue",
    priority: 3,
    condition: (ctx) => ctx.tsb <= -20,
    build: (ctx) => {
      const label = getFootballLabel(ctx.tsb);
      return {
        id: "tsb_extreme_fatigue",
        title: "Tu es cramé",
        message: `Ton corps accumule trop de fatigue. Privilégie récup ou mobilité, pas de grosse séance aujourd'hui.`,
        tone: "danger",
        icon: "battery-dead-outline",
        actionLabel: "Routine récupération",
        actionRoute: "PrebuiltSessions",
        tip: "En foot pro, quand un joueur est cramé, il sort de l'entraînement collectif pour faire de la récup individuelle.",
      };
    },
  },

  // Priorité 4: Post-match (J+1)
  {
    id: "post_match",
    priority: 4,
    condition: (ctx) => ctx.isPostMatch,
    build: () => ({
      id: "post_match",
      title: "Récupération J+1",
      message: "Lendemain de match. Récup active et mobilité pour bien relancer le corps.",
      tone: "info",
      icon: "fitness-outline",
      actionLabel: "Routine J+1",
      actionRoute: "PrebuiltSessions",
      tip: "Après un match, tes muscles mettent 48-72h à récupérer. La récup active accélère le processus.",
    }),
  },

  // Priorité 5: Fatigue modérée
  {
    id: "tsb_fatigue",
    priority: 5,
    condition: (ctx) => ctx.tsb > -20 && ctx.tsb <= -12,
    build: (ctx) => {
      const label = getFootballLabel(ctx.tsb);
      return {
        id: "tsb_fatigue",
        title: "Fatigue dans les jambes",
        message: `Tu es ${label.label.toLowerCase()}. Tu peux t'entraîner, mais évite d'envoyer trop lourd.`,
        tone: "info",
        icon: "battery-half-outline",
        tip: "La fatigue accumulée augmente le risque de blessure. Comme en milieu de semaine, adapte l'intensité.",
      };
    },
  },

  // Priorité 6: Entraînement club aujourd'hui
  {
    id: "club_today",
    priority: 6,
    condition: (ctx) => ctx.isClubToday && !ctx.isMatchToday,
    build: () => ({
      id: "club_today",
      title: "Entraînement club",
      message: "Tu as entraînement avec ton club. Si tu veux une séance FKS, garde-la courte et légère.",
      tone: "info",
      icon: "people-outline",
      tip: "Doubler les entraînements sans adapter l'effort, c'est le meilleur moyen de se blesser. Qualité > quantité.",
    }),
  },

  // Priorité 7: Blessure active
  {
    id: "injury_active",
    priority: 7,
    condition: (ctx) => ctx.hasActiveInjury,
    build: (ctx) => ({
      id: "injury_active",
      title: `Douleur ${ctx.injuryArea ?? ""} signalée`,
      message: "Évite les exercices avec impact sur cette zone. FKS adapte ta séance automatiquement.",
      tone: "warn",
      icon: "medkit-outline",
      tip: "Forcer sur une douleur peut transformer une gêne de 3 jours en blessure de 3 semaines.",
    }),
  },

  // Priorité 8: Cycle bientôt terminé
  {
    id: "cycle_almost_done",
    priority: 8,
    condition: (ctx) =>
      ctx.microcycleGoal !== null && ctx.cycleRemaining <= 2 && ctx.cycleRemaining > 0,
    build: (ctx) => ({
      id: "cycle_almost_done",
      title: "Fin de cycle en vue",
      message: `Plus que ${ctx.cycleRemaining} séance${ctx.cycleRemaining > 1 ? "s" : ""} pour boucler ton cycle. Tu tiens le bon bout !`,
      tone: "success",
      icon: "trophy-outline",
      tip: "Finir un cycle complet, c'est comme finir une saison : les progrès se voient sur la durée, pas sur un match.",
    }),
  },

  // Priorité 9: Récupération négligée (TSB entre -8 et -12, pas de récup récente)
  {
    id: "recovery_needed",
    priority: 9,
    condition: (ctx) => ctx.tsb <= -8 && ctx.tsb > -12 && (ctx.daysSinceLastMobility ?? 999) >= 3,
    build: () => ({
      id: "recovery_needed",
      title: "Pense à récupérer",
      message: "Un peu de fatigue et pas de récup récente. Une routine mobilité peut faire la différence.",
      tone: "info",
      icon: "heart-outline",
      actionLabel: "Routine récup",
      actionRoute: "PrebuiltSessions",
      tip: "La récup, c'est pas du temps perdu. C'est là que ton corps s'adapte et devient plus fort.",
    }),
  },

  // Priorité 10: Pas de mobilité depuis longtemps
  {
    id: "no_mobility",
    priority: 10,
    condition: (ctx) => (ctx.daysSinceLastMobility ?? 999) >= 5,
    build: (ctx) => ({
      id: "no_mobility",
      title: "Mobilité oubliée",
      message: `${ctx.daysSinceLastMobility} jours sans mobilité. Tes articulations te remercieront.`,
      tone: "info",
      icon: "body-outline",
      actionLabel: "Flow Mobilité",
      actionRoute: "PrebuiltSessions",
      tip: "La mobilité, c'est comme l'échauffement : personne aime ça, mais ceux qui le font se blessent moins.",
    }),
  },

  // Priorité 11: Streak routines (positif)
  {
    id: "routine_streak",
    priority: 11,
    condition: (ctx) => ctx.routineStreak >= 5,
    build: (ctx) => ({
      id: "routine_streak",
      title: "Belle série",
      message: `${ctx.routineStreak} jours d'affilée avec une routine ! La régularité, c'est la clé.`,
      tone: "success",
      icon: "flame-outline",
      tip: "Les meilleurs joueurs ne sont pas ceux qui s'entraînent le plus dur, mais ceux qui sont les plus réguliers.",
    }),
  },

  // Priorité 12: En bonne forme
  {
    id: "good_shape",
    priority: 12,
    condition: (ctx) => ctx.tsb >= 0,
    build: () => ({
      id: "good_shape",
      title: "En forme",
      message: "Tu es frais et dispo. C'est le moment d'envoyer une séance de qualité.",
      tone: "success",
      icon: "rocket-outline",
      tip: "Quand tu es frais, c'est le meilleur moment pour travailler la vitesse et la puissance.",
    }),
  },

  // Priorité 12 : progression d'une zone sensible détectée.
  // Règle 4 de INJURY_IA_CHARTER.md (rescalée Jour 4) :
  //   ≥ 3 feedbacks renseignés dans les 14 derniers jours
  //   ET pain moyen ≤ 2
  //   ET injuryMaxSeverity >= 2.
  // Plus robuste au skip de feedback que l'ancienne version "3 consécutifs".
  // L'IA ne modifie JAMAIS activeInjuries automatiquement : la carte propose
  // au joueur d'ajuster son statut (bouton "Ajuster" → Profile).
  {
    id: "injury_progress_detected",
    priority: 12,
    condition: (ctx) => {
      if ((ctx.injuryMaxSeverity ?? 0) < 2) return false;
      const scores = ctx.recentInjuryPainScoresLast14Days ?? [];
      if (scores.length < 3) return false;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return avg <= 2;
    },
    build: () => ({
      id: "injury_progress_detected",
      title: "Bonne nouvelle",
      message: SAFETY_PHRASES.INJURY_PROGRESS_SUGGESTION,
      tone: "success",
      icon: "trending-up-outline",
      actionLabel: "Ajuster",
      actionRoute: "Profile",
    }),
  },

  // Priorité 11 : zone sensible sans confirmation depuis 7-14 jours.
  // Règle D du scope Jour 4. Au-delà de 14 jours, l'injury est filtrée
  // côté hook `useContextualAdvice` (auto-désactivation en lecture), donc
  // `ctx.staleInjury` ne sera pas défini pour les cas > 14j.
  {
    id: "injury_stale",
    priority: 11,
    condition: (ctx) => ctx.staleInjury != null,
    build: (ctx) => {
      const stale = ctx.staleInjury!;
      return {
        id: "injury_stale",
        title: `Ta ${stale.area} — on fait le point ?`,
        message: `Signalée il y a ${stale.daysSince} jour${stale.daysSince > 1 ? "s" : ""}. Toujours sensible ou plus besoin de précaution ?`,
        tone: "info",
        icon: "time-outline",
        actionLabel: "Vérifier",
        actionRoute: "Profile",
      };
    },
  },

  // Priorité 13: État neutre (fallback)
  {
    id: "ready_default",
    priority: 13,
    condition: () => true,
    build: (ctx) => {
      const label = getFootballLabel(ctx.tsb);
      return {
        id: "ready_default",
        title: "Prêt à t'entraîner",
        message: ctx.tsb < 0
          ? `Tu es ${label.label.toLowerCase()}, mais tu peux y aller. Adapte juste l'intensité.`
          : "Aucune alerte. Lance ta séance quand tu veux.",
        tone: "info",
        icon: "checkmark-circle-outline",
      };
    },
  },
];
