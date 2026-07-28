// screens/homeVNext/viewModel.ts
// =============================================================================
// PROTOTYPE Home vNext — COUCHE CONTRAT (aucun composant, aucun rendu)
// =============================================================================
//
// Ce fichier definit ce que l'ecran a le DROIT d'afficher. Il encode la doctrine
// produit issue de l'audit `docs/home-audit-2026-07/` sous forme de TYPES, pour
// que les fautes constatees sur le Home de production deviennent impossibles a
// ecrire dans le prototype :
//
//   - `action` est UN objet (jamais un tableau)          -> deux CTA impossibles
//   - `why` est `WhyLine | null` (avec sa `source`)      -> raison inventee impossible
//   - `form` est une union discriminee                   -> courbe sans donnees impossible
//   - `form.available.scope` est OBLIGATOIRE             -> "mesure complete" impossible
//   - `cycle` en pause n'a pas de `phaseLabel`           -> "Montee en puissance" apres
//                                                           24 jours d'arret impossible
//   - aucun champ de compteur de jours consecutifs       -> "Serie" impossible
//   - `note` n'a AUCUN champ d'action                    -> 2e aplat en bas impossible
//   - `action.emphasis` n'a pas de variante "desactive"  -> bouton gris mort impossible
//
// Le selecteur `buildHomeVNextViewModel` est PUR : pas de store, pas de `new Date()`
// implicite (il lit `input.nowISO`), pas d'I/O, pas d'appel reseau, pas d'IA.
//
// Statut : PROTOTYPE destine a etre regarde et valide. Ce n'est pas le Home de
// production ; `screens/HomeScreen.tsx` n'est pas touche.
// =============================================================================

import {
  MICROCYCLES,
  MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
  type MicrocycleId,
} from "../../domain/microcycles";
import { getMicrocyclePhase } from "../../utils/microcycleUtils";
import { formatDayFR, toDateKey } from "../../utils/dateHelpers";

// =============================================================================
// 1. SEUILS D'AFFICHAGE
// =============================================================================
// Regle posee par le fondateur : "Ne fixe pas silencieusement un seuil sportif
// arbitraire." Donc chaque seuil est ici, exporte, nomme, commente, et affiche
// par le visualiseur du prototype.
//
// AUCUN de ces seuils n'est une regle sportive : aucun ne modifie une seance,
// une charge, une intensite ou une prescription. Ils decident uniquement de ce
// que l'ecran a le droit de MONTRER quand la donnee est maigre.
// =============================================================================

/**
 * Nombre de seances FKS **reellement terminees** requis avant d'afficher une
 * tendance de forme (courbe + libelle d'etat).
 *
 * - En dessous : `form.kind === "insufficient"` — on dit ce qui manque, on ne
 *   trace rien, et le chip d'etat du header reste `null`.
 * - A partir de ce seuil : `form.kind === "available"`, avec sa portee explicite.
 *
 * Pourquoi 4 : c'est exactement la premiere phase d'un cycle FKS ("Fondations",
 * seances 1 a 4, cf. `utils/microcycleUtils.ts`) — un repere que le joueur
 * comprend deja. Et en dessous de 4 seances, la moyenne mobile du modele de
 * charge (tau ATL 14 j / CTL 28 j, `config/trainingDefaults.ts`) est encore
 * dominee par ses valeurs d'amorcage : ce qu'on tracerait serait la constante
 * d'initialisation, pas le joueur. C'est precisement le defaut P0.1/P0.2 de
 * l'audit.
 *
 * SEUIL D'AFFICHAGE DU PROTOTYPE — A VALIDER PAR LE FONDATEUR.
 */
export const SEANCES_MIN_POUR_TENDANCE = 4;

/**
 * Nombre minimal de points pour tracer une courbe. Ce seuil est exige DEUX
 * fois, sur deux comptes differents :
 *   - `formTrend.points.length`      — combien de points on nous donne a tracer ;
 *   - `formTrend.observedDayCount`   — combien de jours ont vu une charge
 *                                      REELLEMENT enregistree.
 *
 * - En dessous de l'un OU de l'autre : pas de trace, meme si le seuil de
 *   seances est atteint (deux points font un segment, pas une tendance ; et
 *   sept points adosses a zero jour observe ne sont que la decroissance des
 *   constantes d'amorcage ATL0/CTL0).
 * - Au-dessus des deux : la courbe est tracee avec ces points-la, et aucun
 *   autre. Un jour sans donnee n'est pas un point a zero.
 *
 * SEUIL D'AFFICHAGE DU PROTOTYPE — A VALIDER PAR LE FONDATEUR.
 */
export const POINTS_MIN_POUR_COURBE = 3;

/**
 * Nombre de jours sans aucune seance FKS terminee a partir duquel l'ecran parle
 * de reprise plutot que de continuite.
 *
 * - En dessous : l'ecran reste dans son cours normal (pas de "content de te
 *   revoir" pour un joueur qui a saute 4 jours — ce serait un reproche deguise).
 * - A partir du seuil : etat de reprise, cycle affiche "en pause" (donc sans
 *   libelle de phase), et action "Reprendre mon programme".
 *
 * Pourquoi 14 : deux semaines pleines. En dessous, un trou est la vie normale
 * d'un amateur (vacances, examens, un match decale). A 14 jours, la moitie de la
 * memoire de fatigue du modele (tau ATL = 14 j) s'est dissipee : l'app ne sait
 * plus honnetement ou en est le joueur, et le dire est plus utile que de faire
 * comme si de rien n'etait (defaut P1.24 / etat E6 de l'audit).
 *
 * SEUIL D'AFFICHAGE DU PROTOTYPE — A VALIDER PAR LE FONDATEUR.
 * Ce seuil ne declenche AUCUNE adaptation de seance : le moteur de reprise
 * progressive n'est pas branche (cf. `protoWarnings`).
 */
export const JOURS_SANS_SEANCE_POUR_REPRISE = 14;

/**
 * Fenetre (en jours) dans laquelle un match declare est considere comme "proche"
 * et peut donc justifier la ligne "pourquoi".
 *
 * - En dehors : le match n'apparait nulle part sur le Home (l'audit P1.27
 *   reproche justement un "Match : Proche" permanent, sans date et sans lien).
 * - Dedans : une ligne factuelle, qui dit quel jour.
 *
 * SEUIL D'AFFICHAGE DU PROTOTYPE — A VALIDER PAR LE FONDATEUR.
 */
export const JOURS_MATCH_PROCHE = 2;

/**
 * Part maximale des mots significatifs d'un conseil pouvant deja avoir ete dits
 * ailleurs sur l'ecran (etat du jour, action, "pourquoi", semaine, forme).
 *
 * - Au-dessus de cette part : le conseil est SUPPRIME (`note === null`). Pas de
 *   conseil vaut mieux qu'un conseil qui repete l'ecran — c'est le defaut
 *   P1.14 de l'audit (le meme message ecrit jusqu'a 4 fois).
 * - En dessous : le conseil s'affiche, en note discrete, sans bouton.
 *
 * SEUIL D'AFFICHAGE DU PROTOTYPE — A VALIDER PAR LE FONDATEUR.
 */
export const NOTE_RECOUPEMENT_MAX = 0.5;

/** Toutes les constantes ci-dessus, pour affichage par le visualiseur. */
export const HOME_VNEXT_SEUILS = [
  {
    nom: "SEANCES_MIN_POUR_TENDANCE",
    valeur: SEANCES_MIN_POUR_TENDANCE,
    role: "Seances FKS terminees requises avant d'afficher une tendance de forme.",
  },
  {
    nom: "POINTS_MIN_POUR_COURBE",
    valeur: POINTS_MIN_POUR_COURBE,
    role: "Points reellement observes requis pour tracer une courbe.",
  },
  {
    nom: "JOURS_SANS_SEANCE_POUR_REPRISE",
    valeur: JOURS_SANS_SEANCE_POUR_REPRISE,
    role: "Jours sans seance terminee a partir desquels l'ecran passe en mode reprise.",
  },
  {
    nom: "JOURS_MATCH_PROCHE",
    valeur: JOURS_MATCH_PROCHE,
    role: "Fenetre dans laquelle un match declare peut justifier la ligne 'pourquoi'.",
  },
  {
    nom: "NOTE_RECOUPEMENT_MAX",
    valeur: NOTE_RECOUPEMENT_MAX,
    role: "Part de mots deja dits ailleurs au-dela de laquelle le conseil disparait.",
  },
] as const;

// =============================================================================
// 2. ENTREE — `HomeVNextInput`
// =============================================================================
// Chaque champ est tracable a une source reelle de l'app. Quand une source
// n'existe pas encore, c'est ecrit noir sur blanc : PAS ENCORE BRANCHE.
// =============================================================================

/** Etat d'avancement d'une seance prescrite, du point de vue du joueur. */
export type HomeVNextPendingStatus =
  /** Prescrite, jamais ouverte en mode live. */
  | "non_commencee"
  /** Ouverte en live, pas menee a son terme. */
  | "commencee"
  /** Menee a son terme en live (le retour du joueur peut manquer encore). */
  | "terminee";

/** Seance FKS reellement terminee — projection minimale pour l'affichage. */
export type HomeVNextCompletedSession = {
  /** SOURCE : `Session.id` (`state/stores/useSessionsStore.ts`). */
  id: string;
  /** SOURCE : `toDateKey(session.dateISO ?? session.date)` (`utils/dateHelpers.ts`). */
  dateKey: string;
  /** SOURCE : `Session.title` ou `aiV2.title`. `null` si absent — jamais invente. */
  title: string | null;
  /** SOURCE : `getSessionDuration(session)` (`utils/sessionHelpers.ts`). */
  durationMin: number | null;
  /**
   * Effort ressenti donne PAR LE JOUEUR, 1 a 10.
   * SOURCE : `Session.feedback.rpe` (`domain/types.ts`). `null` si pas de retour.
   * Jamais estime, jamais derive d'une charge auto.
   */
  perceivedEffort: number | null;
};

/** Seance prescrite en attente (ou terminee du jour), avec tout ce qui justifie l'action. */
export type HomeVNextPendingSession = {
  /** SOURCE : `selectPendingSession(sessions, todayKey).id` (`utils/sessionHelpers.ts`). */
  id: string;
  /** SOURCE : `toDateKey(session.dateISO ?? session.date)`. */
  dateKey: string;
  /**
   * PAS ENCORE BRANCHE pour la valeur "commencee".
   * L'app distingue aujourd'hui seulement `completed` / pas `completed`
   * (`Session.completed`, `domain/types.ts`). Rien ne trace une seance ouverte
   * en live puis abandonnee. A brancher dans `screens/SessionLiveScreen.tsx`.
   * "non_commencee" et "terminee" sont, eux, derivables de l'existant.
   */
  status: HomeVNextPendingStatus;
  /**
   * `true` uniquement si le joueur a rempli son retour (RPE / fatigue / gene).
   * SOURCE : `Boolean(session.completed || session.feedback)` (`isSessionCompleted`).
   */
  feedbackGiven: boolean;
  /** SOURCE : `aiV2.title` (`FKS_NextSessionV2.title`, `screens/newSession/types.ts`). */
  title: string | null;
  /** SOURCE : `FKS_NextSessionV2.durationMin`. */
  durationMin: number | null;
  /** SOURCE : `frFocus(FKS_NextSessionV2.focusPrimary)` (`utils/frLabels.ts`). Deja en FR. */
  focusPrimaryLabel: string | null;
  /** SOURCE : `frIntensity(FKS_NextSessionV2.intensity)` (`utils/frLabels.ts`). Deja en FR. */
  intensityLabel: string | null;
  /**
   * SOURCE : `FKS_NextSessionV2.sessionTheme` — ecrit par l'agent B du pipeline
   * Force. Existe deja, n'est lu que par `SessionPreviewScreen` (defaut P1.25).
   */
  sessionTheme: string | null;
  /** SOURCE : `FKS_NextSessionV2.analytics.rationale`. */
  rationale: string | null;
  /** SOURCE : `FKS_NextSessionV2.playerContext.title`. */
  playerContextTitle: string | null;
  /** SOURCE : `FKS_NextSessionV2.playerContext.summary`. */
  playerContextSummary: string | null;
  /** SOURCE : `FKS_NextSessionV2.coachingTips` (tableau vide si absent). */
  coachingTips: readonly string[];
};

/**
 * Un point de la trajectoire de forme, pour un jour donne.
 *
 * NUANCE IMPORTANTE, et c'est elle qui justifie `observedDayCount` plus bas :
 * un point n'est PAS forcement un jour ou le joueur a fait quelque chose. Un
 * indice de forme evolue aussi les jours de repos (la fatigue se dissipe), donc
 * une trajectoire de 7 jours peut n'etre ancree que sur 4 jours de charge
 * reelle. Ce qui est interdit, c'est de tracer une trajectoire qui n'est ancree
 * sur RIEN : c'est `observedDayCount` qui compte les ancrages, et le selecteur
 * lui applique `POINTS_MIN_POUR_COURBE` au meme titre qu'a `points.length`.
 *
 * Ce qui reste vrai sans nuance : aucun point n'est fabrique pour boucher un
 * trou. Un jour sans valeur n'est pas un point a zero.
 */
export type HomeVNextTrendPoint = {
  /** Cle de jour local "YYYY-MM-DD". */
  dateKey: string;
  /**
   * Indice de forme relatif, echelle interne. N'est JAMAIS affiche comme un
   * chiffre au joueur : sert uniquement a dessiner la trajectoire (l'audit P2.7
   * demande la suppression des reperes bruts "0" / "-10").
   */
  value: number;
};

/** Tendance de forme — construite uniquement sur de l'activite confirmee. */
export type HomeVNextFormTrendInput = {
  /**
   * SOURCE (a construire) : meme serie que celle qui produit le libelle d'etat,
   * une seule fois. L'audit P0.2 reproche a `hooks/home/useLoadSeries.ts` de
   * reamorcer la serie a J-28 avec ATL0/CTL0 alors que le libelle affiche
   * juste au-dessus vient de `rebuildLoad` : deux verites dans la meme carte.
   * Ici : une seule source, et zero point d'amorcage.
   */
  points: readonly HomeVNextTrendPoint[];
  /**
   * Libelle d'etat du jour, deja calcule par l'app.
   * SOURCE : `getFootballLabel(tsb).label` (`config/trainingDefaults.ts`).
   * Le selecteur ne le calcule pas — il decide seulement s'il a le DROIT de
   * l'afficher. `null` = l'app elle-meme n'a pas d'etat a proposer.
   */
  stateLabel: string | null;
  /**
   * Nombre de jours distincts ou une charge REELLE a ete enregistree.
   * SOURCE : cles de `useLoadStore.dailyApplied` alimentees par un feedback de
   * seance ou une charge externe saisie a la main.
   */
  observedDayCount: number;
  /**
   * Jours ecartes de la serie parce que leur charge venait d'une injection
   * automatique club/match (cases du setup profil), jamais confirmee par le
   * joueur. SOURCE : `applyAutoExternalLoads`. Defaut P0.3 de l'audit :
   * une charge supposee ne doit pas etre presentee comme realisee.
   */
  autoClubDaysExcluded: number;
};

/** Match declare a venir. */
export type HomeVNextNextMatch = {
  /** Cle de jour "YYYY-MM-DD" du match. Sans date, on n'affiche rien (P1.27). */
  dateKey: string;
  /**
   * D'ou vient cette date. `profil_jour_recurrent` = deduit d'un jour de semaine
   * coche au setup (`useExternalStore.matchDays`) — c'est ce que l'app a
   * aujourd'hui, et c'est pour cela qu'on ne dira jamais "un match" mais
   * "tu as note un match". `date_confirmee` : PAS ENCORE BRANCHE (aucun
   * calendrier de matchs reels n'existe cote app).
   */
  source: "profil_jour_recurrent" | "date_confirmee";
};

/** Directive de semaine posee par le coach du club. */
export type HomeVNextClubDirective = {
  /** SOURCE : `weekKeyOf(nowISO)` (`utils/dateHelpers.ts`). */
  weekKey: string;
  /** Libelle FR de `ClubContextPayload.training_intensity` (`services/aiContextHelpers.ts`). */
  trainingIntensityLabel: string | null;
  /** Libelle FR de `ClubContextPayload.week_goal`. */
  weekGoalLabel: string | null;
  /** SOURCE : `ClubContextPayload.note` (borne a 200 caracteres cote app). */
  note: string | null;
  /**
   * `true` UNIQUEMENT si la prescription du jour a effectivement consomme cette
   * directive. Tant que c'est `false`, la directive n'entre PAS dans le
   * ViewModel : voir la decision documentee sous `buildHomeVNextViewModel`.
   * PAS ENCORE BRANCHE : rien ne renvoie aujourd'hui cette confirmation.
   */
  appliedToPrescription: boolean;
};

/** Echec de la derniere tentative de generation. */
export type HomeVNextGenerationError = {
  /** Cause classee — pilote le texte affiche, jamais un message brut technique. */
  cause: "reseau" | "serveur" | "inconnue";
  /** Horodatage ISO de l'echec. */
  whenISO: string;
};

/**
 * ENTREE DU SELECTEUR — la forme des donnees telles qu'elles existent (ou
 * existeront) dans les stores. Aucune donnee nouvelle a inventer cote backend.
 */
export type HomeVNextInput = {
  /**
   * Prenom affiche. SOURCE : `auth.currentUser?.displayName` (`services/firebase.ts`).
   * `null` = pas de prenom connu -> on salue sans nom, jamais "Salut, joueur".
   */
  displayName: string | null;

  /**
   * Instant de reference, en ISO. Le selecteur ne lit JAMAIS l'horloge systeme.
   * SOURCE : `useDebugStore.devNowISO ?? new Date().toISOString()`
   * (`state/stores/useDebugStore.ts` — meme convention que `usePrimaryCta`).
   */
  nowISO: string;

  /**
   * `false` tant que les stores n'ont pas repondu.
   * SOURCE : `useSyncStore.storeHydrated` (`state/stores/useSyncStore.ts`).
   * Existe deja et n'est PAS utilise pour l'affichage aujourd'hui (defaut P0.4).
   */
  storeHydrated: boolean;

  /**
   * Seances FKS **reellement terminees**, du plus ancien au plus recent.
   * SOURCE : `useSessionsStore.sessions` filtre par `isSessionCompleted`
   * (`utils/sessionHelpers.ts`). Ni les seances planifiees, ni les charges
   * club/match auto-injectees n'entrent ici.
   */
  completedSessions: readonly HomeVNextCompletedSession[];

  /**
   * Seance prescrite en attente (fenetre J-2..J+1).
   * SOURCE : `selectPendingSession(sessions, todayKey)` (`utils/sessionHelpers.ts`).
   */
  pendingSession: HomeVNextPendingSession | null;

  /**
   * Une charge a-t-elle ete appliquee aujourd'hui (seance validee) ?
   * SOURCE : `useLoadStore.dailyApplied` + `lastAppliedDate` compares a `nowISO`
   * (meme calcul que `screens/HomeScreen.tsx`).
   */
  hasAppliedToday: boolean;

  /**
   * Cycle actif, deja canonicalise.
   * SOURCE : `canonicalizeMicrocycleGoal(useSessionsStore.microcycleGoal)`
   * (`domain/microcycles.ts`). `null` = aucun cycle choisi.
   */
  microcycleGoal: MicrocycleId | null;

  /**
   * Nombre de seances du cycle deja validees (0-based).
   * SOURCE : `useSessionsStore.microcycleSessionIndex`.
   */
  microcycleSessionIndex: number;

  /**
   * Objectif hebdo DECLARE par le joueur.
   * SOURCE : `useExternalStore.targetFksSessionsPerWeek` (pose au setup profil),
   * repli `useSettingsStore.weeklyGoal`. `null` = non declare -> le bloc semaine
   * ne s'affiche pas (defaut P1.10 : la valeur 2 par defaut ecrase le declare).
   */
  weeklyGoalDeclared: number | null;

  /**
   * Seances FKS terminees dans la semaine courante.
   * SOURCE : `useWeekSummary.fksCount` (`hooks/home/useWeekSummary.ts`), qui ne
   * compte que `s.completed` — les charges club auto n'y entrent pas.
   */
  fksSessionsCompletedThisWeek: number;

  /**
   * Jours ecoules depuis la derniere seance FKS terminee. `null` = aucune.
   * SOURCE : derive de `completedSessions` + `nowISO`. Fourni en entree pour que
   * l'appelant reste maitre du calcul, MAIS le selecteur verifie la coherence
   * avec `completedSessions` et corrige (+ avertissement) en cas d'ecart :
   * deux verites contradictoires dans le meme ecran, c'est exactement le defaut
   * P0.2 de l'audit.
   */
  daysSinceLastSession: number | null;

  /** Tendance de forme. `null` = aucune serie exploitable. */
  formTrend: HomeVNextFormTrendInput | null;

  /**
   * Prochain match declare. `null` = aucun.
   * SOURCE : `useExternalStore.matchDays` (jours de semaine coches au profil),
   * projete sur une date reelle par l'appelant.
   */
  nextMatch: HomeVNextNextMatch | null;

  /**
   * Directive club de la semaine.
   * PAS ENCORE BRANCHE cote Home : aujourd'hui `clubs/{clubId}/weekContexts/{weekKey}`
   * n'est lu QU'AU MOMENT DE LA GENERATION, dans `services/aiContext.ts`, et
   * n'est stocke dans aucun store. Aucun selecteur ne l'expose a un ecran joueur.
   */
  clubDirective: HomeVNextClubDirective | null;

  /**
   * Etat reseau.
   * SOURCE : `useNetworkStatus().isOnline` (`hooks/useNetworkStatus.ts`).
   * Le Home ne lit JAMAIS le reseau aujourd'hui (defaut E9 de l'audit) : la
   * banniere globale d'App.tsx se contente de recouvrir le header.
   */
  connectivity: "online" | "offline";

  /**
   * Echec de la derniere generation.
   * PAS ENCORE BRANCHE : `screens/newSession/` affiche un toast et oublie ;
   * aucun store ne conserve l'echec, donc le Home ne peut pas proposer de
   * reessayer. Champ a creer (store sessions ou store sync).
   */
  generationError: HomeVNextGenerationError | null;
};

// =============================================================================
// 3. SORTIE — `HomeVNextViewModel`
// =============================================================================

/** Les 7 actions possibles. Union FERMEE : rien d'autre ne peut etre l'action du jour. */
export type ActionKind =
  /** Lancer la seance prescrite pour aujourd'hui. */
  | "commencer"
  /** Reprendre une seance ouverte et laissee en plan. */
  | "reprendre_seance"
  /** Accuser reception d'une seance faite : rien a faire aujourd'hui. */
  | "voir_seance_terminee"
  /** Preparer / consulter la seance suivante. */
  | "preparer_prochaine"
  /** Revenir apres une interruption longue. */
  | "reprendre_programme"
  /** Completer une information qui manque (retour de seance, choix de cycle). */
  | "completer_info"
  /** Relancer ce qui vient d'echouer. */
  | "reessayer";

/** Destination de l'action. Union fermee : le visualiseur affiche ou ca mene vraiment. */
export type ActionTarget =
  | "session_live"
  | "session_preview"
  | "generation"
  | "choix_cycle"
  | "feedback"
  /** Aucune navigation : l'action est un accuse de reception. */
  | "aucune";

/**
 * Force visuelle de l'action.
 * Il n'existe volontairement PAS de variante "desactive" : un bouton gris mort
 * (defaut E3 de l'audit) est donc impossible a produire.
 */
export type ActionEmphasis =
  /** Le SEUL aplat colore de l'ecran. */
  | "aplat"
  /** Carte de confirmation, sans bouton : la journee est faite. */
  | "accuse_reception";

/** Action secondaire : toujours un lien texte, jamais un aplat (doctrine 1). */
export type HomeVNextSecondaryAction = {
  label: string;
  target: ActionTarget;
};

/** L'action du jour. UN objet, jamais un tableau -> deux CTA sont impossibles. */
export type HomeVNextAction = {
  kind: ActionKind;
  target: ActionTarget;
  emphasis: ActionEmphasis;
  /** Libelle court. Le rendu doit le borner (`numberOfLines`). */
  label: string;
  /** Sous-titre. Peut contenir du texte backend -> a borner au rendu. `null` = pas de sous-titre. */
  sublabel: string | null;
  /** Au plus UNE action secondaire, et elle est un lien. */
  secondary: HomeVNextSecondaryAction | null;
};

/** D'ou vient la ligne "pourquoi". Union fermee -> pas de source inventable. */
export type WhySource =
  /** `FKS_NextSessionV2.sessionTheme` */
  | "session_theme"
  /** `FKS_NextSessionV2.playerContext.summary` */
  | "player_context"
  /** `FKS_NextSessionV2.analytics.rationale` */
  | "rationale"
  /** Match declare dans la fenetre `JOURS_MATCH_PROCHE` */
  | "match_proche";

/** La ligne "pourquoi cette seance". `null` quand aucune source ne la fournit. */
export type WhyLine = {
  /** Phrase telle qu'elle sera lue. Le prefixe "Pourquoi :" est un choix de rendu. */
  text: string;
  /** Tracabilite : quelle donnee d'entree a produit cette phrase. */
  source: WhySource;
};

/**
 * Bloc "Ma forme". Union discriminee : il est impossible de rendre une courbe
 * sans donnees, et impossible d'oublier la portee quand il y en a.
 */
export type FormBlock =
  | {
      kind: "available";
      /** Points reels, dans l'ordre chronologique. Aucun point d'amorcage. */
      points: readonly number[];
      /**
       * PORTEE de la mesure — champ obligatoire. Interdit de faire passer une
       * tendance calculee sur les seules seances FKS pour une mesure complete
       * de l'etat physique du joueur (doctrine 6).
       */
      scope: string;
      /** Periode couverte, deduite des points ("7 derniers jours"). */
      periodLabel: string;
    }
  | {
      kind: "insufficient";
      /**
       * Pourquoi il n'y a pas de tendance :
       *  - `pas_assez_de_seances` : le compteur `completedCount/requiredCount`
       *    a du sens et peut etre affiche ("1 seance enregistree").
       *  - `reprise_en_cours` : le compteur n'a AUCUN sens (le joueur peut avoir
       *    30 seances derriere lui) — le rendu ne doit pas l'afficher. Champ
       *    prevu pour que ce cas ne puisse pas produire un "5 sur 4" absurde.
       */
      reason: "pas_assez_de_seances" | "reprise_en_cours";
      /** Ton valide : "Ta tendance se construit". */
      title: string;
      /** Ce qui manque et quand ca viendra. Jamais un reproche. */
      message: string;
      /** Seances terminees a ce jour. */
      completedCount: number;
      /** Seances necessaires (= `SEANCES_MIN_POUR_TENDANCE`). */
      requiredCount: number;
    }
  | null;

/**
 * Repere de cycle. La variante "en_pause" n'a PAS de `phaseLabel` : afficher
 * "Montee en puissance" apres trois semaines d'arret devient impossible (E6).
 */
export type CycleBlock =
  | {
      kind: "en_cours";
      cycleLabel: string;
      sessionNumber: number;
      totalSessions: number;
      phaseLabel: string;
    }
  | {
      kind: "en_pause";
      cycleLabel: string;
      sessionNumber: number;
      totalSessions: number;
      pausedDays: number;
    }
  | null;

/** Bloc "Ma semaine". `null` quand l'objectif n'est pas declare ou qu'il n'y a rien a dire. */
export type WeekBlock = {
  /** Seances FKS terminees cette semaine (non borne). */
  doneCount: number;
  /** Objectif declare par le joueur. */
  goalCount: number;
  /** Phrase actionnable, jamais un reproche. */
  message: string;
  /** `true` = objectif depasse -> le rendu change de formulation (defaut P1.11 "Semaine 3/2"). */
  goalExceeded: boolean;
} | null;

/**
 * Le conseil. Aucun champ d'action : impossible d'y coller un 2e aplat en bas
 * d'ecran (doctrine 9). `null` des qu'il recoupe le reste de l'ecran.
 */
export type Note = {
  title: string;
  message: string;
  tone: "info" | "prudence";
} | null;

/** Ligne de sortie discrete. `null` quand la destination n'a rien a montrer. */
export type ExitLink = {
  label: string;
  target: "progression";
} | null;

/** Fiabilite de ce que l'ecran affiche a cet instant. */
export type HomeVNextDataState =
  /** Stores pas encore hydrates : le rendu doit squeletter TOUS les blocs, action comprise. */
  | "hydrating"
  /** Donnees a jour. */
  | "ready"
  /** Hors-ligne : ce qui est affiche peut dater. */
  | "stale_offline";

/** En-tete. Le chip d'etat est la SEULE mention de l'etat du jour de tout l'ecran. */
export type HomeVNextHeader = {
  /** "Salut, Yanis" ou "Salut" si aucun prenom connu. */
  greeting: string;
  /** "Jeu. 30 juil." */
  dateLabel: string;
  /** `null` tant que les donnees ne permettent pas d'affirmer un etat. */
  stateChip: { label: string } | null;
};

/**
 * Ordre de rendu des sections. Fige le "Ordre cible" de l'option B de l'audit.
 * Les deux agents de rendu doivent suivre cet ordre.
 */
export const HOME_VNEXT_SECTION_ORDER = [
  "header",
  "action", // action + why + cycle forment UN bloc visuel
  "week",
  "form",
  "note",
  "exit",
] as const;

export type HomeVNextSection = (typeof HOME_VNEXT_SECTION_ORDER)[number];

// =============================================================================
// OPTIONS DE CONSTRUCTION — CE QUI DEPEND DE LA VARIANTE, ET RIEN D'AUTRE
// =============================================================================
//
// POURQUOI CETTE OPTION EXISTE
// -----------------------------------------------------------------------------
// La variante 2 pose une carte qui ecrit, en toutes lettres, « Calculé sur tes
// séances FKS uniquement — tes entraînements club n'y sont pas comptés ». Sur
// le meme ecran, ~200 px plus haut, la pastille d'en-tete annoncait un ETAT
// PHYSIQUE GLOBAL (« En forme », « Un peu chargé »). Un joueur qui lit de haut
// en bas apprend donc son etat, puis apprend qu'on ne peut pas le connaitre.
//
// Le fondateur a tranche apres avoir regarde l'ecran (D1, 2026-07-28) : en
// variante 2, la pastille est retiree COMPLETEMENT, et pas seulement quand les
// charges club manquent. Motif : le modele de charge lui-meme part de valeurs
// initiales artificielles (ATL0 / CTL0) — aucune condition d'entree ne peut
// rendre le libelle honnete aujourd'hui.
//
// La regle est donc appliquee A LA SOURCE, ici (§5.7) — pas dans le composant
// d'en-tete, qui ne doit jamais decider de ce que l'app a le droit d'affirmer.
//
// POURQUOI ELLE EST PILOTEE PAR LA VARIANTE ET NON APPLIQUEE PARTOUT
// -----------------------------------------------------------------------------
// La VARIANTE 1 est celle que le fondateur a deja regardee. Elle ne bouge pas
// d'un pixel, PASTILLE COMPRISE : c'est precisement l'ECART entre les deux qu'il
// doit pouvoir voir cote a cote. Sans option, le ViewModel se comporte donc
// EXACTEMENT comme avant l'ajout de ce parametre.
// =============================================================================

/** Laquelle des deux propositions ce ViewModel alimente. */
export type HomeVNextVarianteVm = "v1" | "v2";

export type HomeVNextOptions = {
  /**
   * Variante rendue. Defaut `"v1"` : sans option, le ViewModel se comporte
   * exactement comme avant l'ajout de ce parametre (zero diff sur la variante 1).
   *
   * SEULE option de ce ViewModel, et c'est voulu. Il y en avait une deuxieme,
   * `chargesClubCapturees`, qui autorisait la pastille d'etat du jour en
   * variante 2 quand les charges club etaient capturees. Elle a ete SUPPRIMEE
   * par la decision D1 du fondateur (voir §5.7) : la pastille ne doit pas
   * pouvoir revenir en variante 2 par un drapeau.
   */
  variante?: HomeVNextVarianteVm;
};

/** Ce que l'ecran affiche. */
export type HomeVNextViewModel = {
  dataState: HomeVNextDataState;
  /** Phrase de degradation honnete (hors-ligne). `null` sinon. */
  dataNotice: string | null;
  header: HomeVNextHeader;
  action: HomeVNextAction;
  why: WhyLine | null;
  cycle: CycleBlock;
  week: WeekBlock;
  form: FormBlock;
  note: Note;
  exit: ExitLink;
  /**
   * Messages destines AU VISUALISEUR DU PROTOTYPE, jamais a l'ecran produit.
   * Ils disent ce qui n'est pas branche, ce qui a ete masque, et ce qui doit
   * etre fait avant toute mise en production.
   */
  protoWarnings: string[];
};

// =============================================================================
// 4. HELPERS PURS
// =============================================================================

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/**
 * Ecart en jours entre deux cles "YYYY-MM-DD". Positif si `b` est apres `a`.
 * Passe par midi UTC pour eviter tout decalage d'heure d'ete.
 */
function diffJours(a: string, b: string): number {
  const ta = Date.parse(`${a}T12:00:00.000Z`);
  const tb = Date.parse(`${b}T12:00:00.000Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.round((tb - ta) / MS_PAR_JOUR);
}

// Formats FR courts. Volontairement locaux et non `Intl` : le selecteur doit
// produire exactement la meme chaine dans un test, sur un Mac et sur Hermes
// (ou les donnees de locale peuvent manquer). Les formes longues, elles, sont
// prises dans `utils/dateHelpers.formatDayFR` (helper partage, regle 9).
const FR_JOURS_COURTS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const FR_MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** "2026-07-30" -> "Jeu. 30 juil." */
function libelleDateCourte(dateKey: string): string {
  const t = Date.parse(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(t)) return dateKey;
  const d = new Date(t);
  const jour = FR_JOURS_COURTS[d.getUTCDay()] ?? "";
  const mois = FR_MOIS_COURTS[d.getUTCMonth()] ?? "";
  return `${jour} ${d.getUTCDate()} ${mois}`.trim();
}

/** Nettoie une chaine venue du backend : trim, et `null` si vide. */
function texteOuNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

/** Force la premiere lettre en minuscule (pour enchainer apres "Pourquoi : "). */
function phrasePropre(value: string): string {
  const v = value.trim().replace(/\s+/g, " ");
  return v.endsWith(".") || v.endsWith("!") || v.endsWith("?") ? v : `${v}.`;
}

// --- Recoupement de textes (utilise pour supprimer un conseil redondant) ------

const MOTS_VIDES = new Set([
  "avec",
  "sans",
  "pour",
  "dans",
  "cette",
  "tout",
  "tous",
  "toute",
  "plus",
  "moins",
  "mais",
  "donc",
  "elle",
  "nous",
  "vous",
  "leur",
  "meme",
  "aussi",
  "bien",
  "deja",
  "encore",
  "faire",
  "fait",
  "peux",
  "peut",
  "sera",
  "etre",
  "aujourd",
  "hui",
]);

/**
 * Minuscules, sans accents, sans ponctuation, espaces normalises.
 * Les marques diacritiques combinantes (U+0300..U+036F) sont retirees par code
 * de caractere plutot que par une classe regex : le fichier reste correct quel
 * que soit l'encodage dans lequel il est relu.
 */
export function normaliserTexte(value: string): string {
  const sansAccents = value
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
  return sansAccents
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots porteurs de sens (>= 4 lettres, hors mots vides). */
function motsSignificatifs(value: string): string[] {
  return normaliserTexte(value)
    .split(" ")
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m));
}

/**
 * Part des mots significatifs de `candidat` deja presents dans `corpus`.
 * 0 = rien en commun, 1 = tout a deja ete dit.
 * Exporte pour que le test et le visualiseur puissent le montrer.
 */
export function tauxDeRecoupement(candidat: string, corpus: readonly string[]): number {
  const mots = motsSignificatifs(candidat);
  if (mots.length === 0) return 1; // rien de significatif a apporter -> considere redondant
  const corpusMots = new Set(corpus.flatMap((c) => motsSignificatifs(c)));
  if (corpusMots.size === 0) return 0;
  const dejaDits = mots.filter((m) => corpusMots.has(m)).length;
  return dejaDits / mots.length;
}

/** Assemble "Force bas du corps · 45 min · Moderee" en sautant les trous. */
function ligneMeta(parts: readonly (string | null)[]): string | null {
  const clean = parts.map(texteOuNull).filter((p): p is string => p !== null);
  return clean.length > 0 ? clean.join(" · ") : null;
}

// =============================================================================
// 5. LE SELECTEUR
// =============================================================================

/**
 * Construit le ViewModel du Home vNext.
 *
 * FONCTION PURE : meme entree -> meme sortie. Pas de store, pas d'horloge
 * implicite (`input.nowISO` fait foi), pas d'I/O, pas d'IA.
 *
 * -----------------------------------------------------------------------------
 * DECISION — DIRECTIVE CLUB NON APPLIQUEE (fixture 13)
 * -----------------------------------------------------------------------------
 * Choix retenu : la directive est MASQUEE de l'ecran produit tant que
 * `appliedToPrescription === false`, et elle ne laisse qu'un `protoWarning`.
 * Elle n'a d'ailleurs aucun champ dans le ViewModel : l'afficher est impossible.
 *
 * Pourquoi masquer plutot qu'afficher "pas encore appliquee" :
 *   1. Doctrine 4 : le "pourquoi" ne sort que des champs de la prescription.
 *      Une consigne que le moteur n'a pas lue n'est pas la raison de CETTE seance.
 *   2. Afficher une consigne de coach a cote d'une seance qui ne la respecte pas
 *      recree exactement le defaut E12/E13 de l'audit : deux blocs qui se
 *      contredisent, et c'est le joueur qui doit arbitrer entre son coach et l'app.
 *   3. Doctrine 10 : le Home ne depend jamais d'un suivi club. Un ecran qui
 *      reserve une place a un bloc club devient un ecran a trou pour les 90 % de
 *      joueurs sans club.
 *   4. Le jour ou le moteur consommera la directive, elle remontera d'elle-meme
 *      par `sessionTheme` / `playerContext` — les champs que le moteur ecrit.
 *      Aucun bloc d'interface supplementaire n'est necessaire.
 * -----------------------------------------------------------------------------
 */
export function buildHomeVNextViewModel(
  input: HomeVNextInput,
  options: HomeVNextOptions = {}
): HomeVNextViewModel {
  const protoWarnings: string[] = [];
  const todayKey = toDateKey(input.nowISO);
  // Defauts choisis pour que `buildHomeVNextViewModel(input)` — la forme
  // utilisee partout jusqu'ici — produise le MEME ViewModel qu'avant.
  const variante: HomeVNextVarianteVm = options.variante ?? "v1";

  // ---------------------------------------------------------------------------
  // 5.1 Coherence des entrees (une seule verite par chiffre)
  // ---------------------------------------------------------------------------
  const derniereSeance =
    input.completedSessions.length > 0
      ? input.completedSessions.reduce((acc, s) => (s.dateKey > acc.dateKey ? s : acc))
      : null;

  const joursDepuisCalcules = derniereSeance
    ? Math.max(0, diffJours(derniereSeance.dateKey, todayKey))
    : null;

  let daysSinceLastSession = input.daysSinceLastSession;
  if (daysSinceLastSession !== joursDepuisCalcules) {
    protoWarnings.push(
      `Incoherence d'entree : daysSinceLastSession=${String(input.daysSinceLastSession)} alors que les seances terminees donnent ${String(joursDepuisCalcules)}. Le selecteur retient la valeur derivee des seances (une seule verite par chiffre).`
    );
    daysSinceLastSession = joursDepuisCalcules;
  }

  const nbSeancesTerminees = input.completedSessions.length;

  // ---------------------------------------------------------------------------
  // 5.2 Fiabilite globale
  // ---------------------------------------------------------------------------
  const dataState: HomeVNextDataState = !input.storeHydrated
    ? "hydrating"
    : input.connectivity === "offline"
      ? "stale_offline"
      : "ready";

  const dataNotice =
    dataState === "stale_offline"
      ? "Tu es hors connexion : ce que tu vois ici peut dater de ta dernière synchro."
      : null;

  if (dataState === "hydrating") {
    protoWarnings.push(
      "Prototype : storeHydrated=false. Le rendu doit squeletter TOUS les blocs, action comprise — aucun texte de ce ViewModel ne doit etre lu a l'ecran tant que l'hydratation n'est pas finie (defaut P0.4 de l'audit)."
    );
  }
  if (input.connectivity === "offline") {
    protoWarnings.push(
      "Prototype : le Home ne lit jamais le reseau aujourd'hui (hooks/useNetworkStatus.ts n'est pas appele par screens/HomeScreen.tsx) — champ connectivity a brancher."
    );
  }
  if (input.generationError) {
    protoWarnings.push(
      "Prototype : aucun store ne conserve aujourd'hui l'echec d'une generation (screens/newSession/ affiche un toast puis oublie) — champ generationError a creer avant mise en production."
    );
  }
  if (input.pendingSession?.status === "commencee") {
    protoWarnings.push(
      "Prototype : l'app ne trace pas une seance ouverte en live puis abandonnee (Session.completed est binaire) — statut 'commencee' a brancher dans SessionLiveScreen."
    );
  }
  if (input.clubDirective) {
    protoWarnings.push(
      `Prototype : la directive club (semaine ${input.clubDirective.weekKey}) n'a aucune source cote Home — clubs/{clubId}/weekContexts n'est lu qu'au moment de la generation (services/aiContext.ts) et n'est stocke dans aucun store.`
    );
    if (!input.clubDirective.appliedToPrescription) {
      protoWarnings.push(
        "Prototype : cette directive club n'a PAS ete consommee par la prescription du jour. Elle est volontairement absente de l'ecran produit (voir la decision documentee dans viewModel.ts) — l'ecran n'affirme donc nulle part que la seance en tient compte."
      );
    }
  }
  // ---------------------------------------------------------------------------
  // 5.3 Cycle
  // ---------------------------------------------------------------------------
  const cycleId = input.microcycleGoal;
  const cycleDef = cycleId ? MICROCYCLES[cycleId] : null;
  const indexCycle = Math.max(0, Math.trunc(input.microcycleSessionIndex));
  const cycleTermine = Boolean(cycleId) && indexCycle >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const enReprise =
    daysSinceLastSession !== null && daysSinceLastSession >= JOURS_SANS_SEANCE_POUR_REPRISE;

  let cycle: CycleBlock = null;
  if (cycleDef && !cycleTermine) {
    const phase = getMicrocyclePhase(indexCycle);
    cycle = enReprise
      ? {
          // Variante SANS phaseLabel : apres une interruption, l'ecran ne peut
          // pas affirmer une montee en charge qui n'a pas eu lieu.
          kind: "en_pause",
          cycleLabel: cycleDef.label,
          sessionNumber: phase.sessionNumber,
          totalSessions: phase.total,
          pausedDays: daysSinceLastSession ?? 0,
        }
      : {
          kind: "en_cours",
          cycleLabel: cycleDef.label,
          sessionNumber: phase.sessionNumber,
          totalSessions: phase.total,
          phaseLabel: phase.label,
        };
  }

  // ---------------------------------------------------------------------------
  // 5.4 LA CASCADE DE L'ACTION — une seule action, ordre explicite
  // ---------------------------------------------------------------------------
  // Ordre choisi pour corriger les defauts d'ordonnancement releves dans
  // ETATS_HOME.md > "La cascade du CTA" :
  //
  //   * la bascule "recuperation" derivee du TSB N'EXISTE PLUS du tout. Elle
  //     effacait la seance du jour (P1.2) et, sur un compte neuf, elle se
  //     declenchait sur un TSB issu de CTL0=15 / ATL0=12. Un jour de recuperation
  //     n'est plus un etat devine par le Home : c'est une seance prescrite comme
  //     une autre, avec son propre titre et son propre "pourquoi".
  //   * l'ERREUR DE GENERATION passe en 1 : proposer "Preparer ma seance" juste
  //     apres un echec, c'est renvoyer le joueur dans le mur sans rien dire.
  //   * le RETOUR DE SEANCE DU passe en 2 : c'est l'action qui debloque tout, et
  //     elle etait le dernier element de la page, en gris, a 93 % de la hauteur
  //     (P1.31). Le haut ne peut plus dire "vas-y" pendant que le bas dit
  //     "raconte-moi" (P1.3).
  //   * la SEANCE COMMENCEE passe en 3 : reprendre ce qui est ouvert prime sur
  //     tout le reste.
  //   * la SEANCE DU JOUR passe en 4, avant la reprise longue : un joueur qui
  //     vient de generer sa seance ne doit pas se voir proposer de "reprendre".
  //   * la REPRISE LONGUE passe en 5, avant le cours normal.
  //   * une seance datee de DEMAIN n'est jamais annoncee "prete" : elle devient
  //     "Voir ma seance de demain", avec sa date (P1.4 / E5c).
  // ---------------------------------------------------------------------------

  const pending = input.pendingSession;
  const pendingAujourdhui = pending !== null && pending.dateKey === todayKey;
  const pendingDemain = pending !== null && pending.dateKey > todayKey;
  const retourDu =
    pending !== null &&
    !pending.feedbackGiven &&
    (pending.status === "terminee" || pending.dateKey < todayKey);

  // Titre · duree · intensite. Le focus n'y figure pas : il est deja dans le
  // titre de seance ("Force bas du corps · Force" etait une redite).
  const metaSeance = pending
    ? ligneMeta([
        pending.title,
        pending.durationMin !== null ? `${Math.round(pending.durationMin)} min` : null,
        pending.intensityLabel,
      ])
    : null;

  let action: HomeVNextAction;

  if (input.generationError) {
    // 1 — l'echec d'abord, sinon l'ecran propose une action qui vient d'echouer.
    const raison =
      input.generationError.cause === "reseau"
        ? "La connexion a lâché pendant la préparation."
        : input.generationError.cause === "serveur"
          ? "Le service n'a pas répondu."
          : "La préparation ne s'est pas terminée.";
    action = {
      kind: "reessayer",
      target: "generation",
      emphasis: "aplat",
      label: "Réessayer",
      sublabel: raison,
      secondary: null,
    };
  } else if (retourDu && pending) {
    // 2 — le retour de seance : c'est ce qui debloque la suite.
    const quand = formatDayFR(pending.dateKey);
    action = {
      kind: "completer_info",
      target: "feedback",
      emphasis: "aplat",
      label: "Dis-nous comment ça s'est passé",
      sublabel: quand
        ? `Ta séance du ${quand} attend ton retour.`
        : "Ta dernière séance attend ton retour.",
      secondary: { label: "Revoir la séance", target: "session_preview" },
    };
  } else if (pending && pending.status === "commencee") {
    // 3 — une seance ouverte prime sur tout.
    action = {
      kind: "reprendre_seance",
      target: "session_live",
      emphasis: "aplat",
      label: "Reprendre ma séance",
      sublabel: metaSeance,
      secondary: { label: "Revoir le détail", target: "session_preview" },
    };
  } else if (pendingAujourdhui && pending) {
    // 4 — la seance du jour, AVANT toute idee de reprise.
    action = {
      kind: "commencer",
      target: "session_live",
      emphasis: "aplat",
      label: "C'est parti",
      sublabel: metaSeance,
      secondary: { label: "Voir le détail", target: "session_preview" },
    };
  } else if (input.hasAppliedToday) {
    // 5 — journee faite : accuse de reception, jamais un bouton gris.
    const faiteAujourdhui = input.completedSessions.filter((s) => s.dateKey === todayKey);
    const derniereDuJour = faiteAujourdhui[faiteAujourdhui.length - 1] ?? null;
    action = {
      kind: "voir_seance_terminee",
      target: "aucune",
      emphasis: "accuse_reception",
      label: "Séance faite",
      sublabel: derniereDuJour
        ? ligneMeta([
            derniereDuJour.title,
            derniereDuJour.durationMin !== null
              ? `${Math.round(derniereDuJour.durationMin)} min`
              : null,
            derniereDuJour.perceivedEffort !== null
              ? `effort ${derniereDuJour.perceivedEffort}/10`
              : null,
          ])
        : null,
      secondary: null,
    };
  } else if (enReprise) {
    // 6 — reprise apres interruption longue.
    action = {
      kind: "reprendre_programme",
      target: "generation",
      emphasis: "aplat",
      label: "Reprendre mon programme",
      // FUTUR assume : le moteur de reprise progressive n'est pas branche.
      sublabel: "On te préparera une remise en route progressive.",
      secondary: null,
    };
    protoWarnings.push(
      "Prototype : branchement du moteur de reprise progressive requis avant mise en production. Aujourd'hui la generation ne sait pas qu'elle doit alleger apres une interruption — d'ou le futur dans le sous-titre ('on te preparera'), qui annonce une intention, pas un fait."
    );
  } else if (pendingDemain && pending) {
    // 7 — seance de demain : datee, jamais annoncee "prete".
    const quand = formatDayFR(pending.dateKey);
    action = {
      kind: "preparer_prochaine",
      target: "session_preview",
      emphasis: "aplat",
      label: "Voir ma séance de demain",
      sublabel: ligneMeta([metaSeance, quand ? `prévue ${quand}` : null]),
      secondary: null,
    };
  } else if (!cycleId || cycleTermine) {
    // 8 — il manque une information avant de pouvoir preparer quoi que ce soit.
    const nbCycles = Object.keys(MICROCYCLES).length;
    action = cycleTermine && cycleDef
      ? {
          kind: "completer_info",
          target: "choix_cycle",
          emphasis: "aplat",
          label: "Choisir mon prochain cycle",
          sublabel: `Tu as bouclé les ${MICROCYCLE_TOTAL_SESSIONS_DEFAULT} séances du cycle ${cycleDef.label}.`,
          secondary: null,
        }
      : {
          kind: "completer_info",
          target: "choix_cycle",
          emphasis: "aplat",
          label: "Choisir mon cycle",
          sublabel: `${nbCycles} cycles, ${MICROCYCLE_TOTAL_SESSIONS_DEFAULT} séances chacun.`,
          secondary: null,
        };
  } else {
    // 9 — cours normal : preparer la seance du jour.
    action = {
      kind: "preparer_prochaine",
      target: "generation",
      emphasis: "aplat",
      label: "Préparer ma séance",
      sublabel: "On l'adapte à ton contexte du jour.",
      secondary: null,
    };
  }

  // ---------------------------------------------------------------------------
  // 5.5 LE "POURQUOI" — uniquement depuis des champs fournis
  // ---------------------------------------------------------------------------
  // Ordre : le theme de seance (ecrit par l'agent B), puis le resume de contexte
  // joueur, puis la justification analytique, puis la proximite d'un match.
  // Aucune de ces phrases n'est composee par le selecteur : il choisit laquelle
  // afficher, il n'en invente aucune. Si rien n'est fourni -> `null`.
  // ---------------------------------------------------------------------------
  const joursAvantMatch =
    input.nextMatch !== null ? diffJours(todayKey, input.nextMatch.dateKey) : null;
  const matchProche =
    joursAvantMatch !== null && joursAvantMatch >= 0 && joursAvantMatch <= JOURS_MATCH_PROCHE;

  let why: WhyLine | null = null;
  const seanceConcernee =
    action.kind === "commencer" ||
    action.kind === "reprendre_seance" ||
    action.kind === "preparer_prochaine";

  if (seanceConcernee && pending) {
    const theme = texteOuNull(pending.sessionTheme);
    const contexte = texteOuNull(pending.playerContextSummary);
    const rationale = texteOuNull(pending.rationale);
    if (theme) why = { text: phrasePropre(theme), source: "session_theme" };
    else if (contexte) why = { text: phrasePropre(contexte), source: "player_context" };
    else if (rationale) why = { text: phrasePropre(rationale), source: "rationale" };
  }

  if (!why && matchProche && input.nextMatch && joursAvantMatch !== null) {
    // Formulation calee sur la source : un jour coche au profil, ce n'est pas un
    // match confirme. On dit ce qu'on sait : "tu as note".
    const quand =
      joursAvantMatch === 0
        ? "aujourd'hui"
        : joursAvantMatch === 1
          ? "demain"
          : `dans ${joursAvantMatch} jours`;
    const verbe =
      input.nextMatch.source === "profil_jour_recurrent" ? "Tu as noté un match" : "Tu as un match";
    why = { text: `${verbe} ${quand}.`, source: "match_proche" };
    if (input.nextMatch.source === "profil_jour_recurrent") {
      // Avertissement emis SEULEMENT quand la phrase est reellement affichee :
      // il explique la formulation choisie, il n'a pas de sens sinon.
      protoWarnings.push(
        "Prototype : ce match vient d'un jour de semaine coche au profil (useExternalStore.matchDays), pas d'un match reel date. Le texte dit donc 'tu as note un match', jamais 'ton match' (defaut P1.27)."
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 5.6 LA FORME — jamais de courbe sous le seuil
  // ---------------------------------------------------------------------------
  let form: FormBlock = null;
  const trend = input.formTrend;
  const assezDeSeances = nbSeancesTerminees >= SEANCES_MIN_POUR_TENDANCE;
  const points = trend ? trend.points.map((p) => p.value) : [];
  // DEUX conditions, pas une.
  //   - `points.length`      : combien de points on nous DONNE a tracer ;
  //   - `observedDayCount`   : combien de jours ont vu une charge REELLEMENT
  //                            enregistree (retour de seance ou charge saisie).
  // Sans la seconde, il restait possible de tracer sept points adosses a zero
  // jour observe : on dessinerait alors la decroissance des constantes
  // d'amorcage ATL0=12 / CTL0=15, pas le joueur. C'est exactement le defaut
  // P0.1/P0.2 de l'audit, et `observedDayCount` etait declare dans le contrat
  // sans etre lu nulle part.
  const joursObserves = trend ? Math.max(0, Math.trunc(trend.observedDayCount)) : 0;
  const assezDePoints =
    points.length >= POINTS_MIN_POUR_COURBE && joursObserves >= POINTS_MIN_POUR_COURBE;

  if (enReprise) {
    // Apres une interruption longue : aucune tendance, aucun etat affirme.
    // `reason: "reprise_en_cours"` interdit au rendu d'afficher un compteur
    // (le joueur peut avoir 30 seances derriere lui : "5 sur 4" n'a aucun sens).
    form = {
      kind: "insufficient",
      reason: "reprise_en_cours",
      title: "Ta tendance se construit",
      message: "Ta forme sera de nouveau mesurée après ta première séance de reprise.",
      completedCount: nbSeancesTerminees,
      requiredCount: SEANCES_MIN_POUR_TENDANCE,
    };
  } else if (trend && assezDeSeances && assezDePoints) {
    const premier = trend.points[0]?.dateKey ?? todayKey;
    const dernier = trend.points[trend.points.length - 1]?.dateKey ?? todayKey;
    const etendue = Math.max(1, diffJours(premier, dernier) + 1);
    const portee =
      trend.autoClubDaysExcluded > 0
        ? "Calculé sur tes séances FKS uniquement — tes entraînements club n'y sont pas comptés."
        : "Calculé sur tes séances FKS uniquement.";
    form = {
      kind: "available",
      points,
      scope: portee,
      periodLabel: `${etendue} derniers jours`,
    };
  } else {
    const manquantes = Math.max(0, SEANCES_MIN_POUR_TENDANCE - nbSeancesTerminees);
    const message =
      nbSeancesTerminees === 0
        ? "Fais ta première séance et dis-nous comment ça s'est passé : c'est de là que part ta tendance."
        : manquantes > 0
          ? `Termine ${manquantes} séance${manquantes > 1 ? "s" : ""} de plus et partage ton ressenti pour obtenir un repère plus utile.`
          : "Termine quelques séances et partage ton ressenti pour obtenir un repère plus utile.";
    form = {
      kind: "insufficient",
      reason: "pas_assez_de_seances",
      title: "Ta tendance se construit",
      message,
      completedCount: nbSeancesTerminees,
      requiredCount: SEANCES_MIN_POUR_TENDANCE,
    };
  }

  // ---------------------------------------------------------------------------
  // 5.7 L'ETAT DU JOUR — une seule fois, dans le header, et seulement s'il est su
  // ---------------------------------------------------------------------------
  // DEUX VERROUS, ET LE SECOND DEPEND DE LA VARIANTE.
  //
  // VERROU 1 (les deux variantes) — la tendance doit etre reellement disponible :
  // le meme verrou protege donc la courbe et le libelle. Un compte neuf ne peut
  // plus lire "En forme" produit par CTL0=15 / ATL0=12 (defaut P0.1).
  const tendanceDisponible = form !== null && form.kind === "available";
  const libelleEtat = trend ? texteOuNull(trend.stateLabel) : null;

  // VERROU 2 (VARIANTE 2 UNIQUEMENT) — IL N'Y A PLUS DE PASTILLE. DU TOUT.
  //
  // DECISION DU FONDATEUR (D1, 2026-07-28), apres avoir regarde la variante 2 :
  //   « La pastille d'etat global est RETIREE COMPLETEMENT de la variante
  //     "Progression integree". Aucun de ces libelles, ni aucun autre jugement
  //     global : "En forme", "Frais", "Pret a performer", "Un peu charge",
  //     "Charge moderee". Motif : le modele de charge utilise encore des valeurs
  //     initiales artificielles et ne connait pas les entrainements club. Une
  //     pastille "Charge FKS" ne pourra revenir que le jour ou son calcul
  //     reposera sur des donnees entierement reelles avec une portee expliquee. »
  //
  // CE QUI A CHANGE DEPUIS L'ITERATION PRECEDENTE. La condition etait
  // `variante === "v1" ? true : chargesClubCapturees` : un appelant qui passait
  // `chargesClubCapturees: true` faisait revenir « En forme » en variante 2. La
  // question posee n'etait donc pas la bonne — elle supposait qu'il suffisait de
  // connaitre les charges club. Le fondateur tranche autrement : le calcul
  // lui-meme part de valeurs initiales artificielles (`TRAINING_DEFAULTS.ATL0` /
  // `CTL0`, ProgressScreen.tsx:251-252), donc aucun drapeau d'entree ne peut
  // rendre ce libelle honnete aujourd'hui. L'option a ete supprimee avec la
  // condition : il n'y a plus de drapeau a passer.
  //
  // LA VARIANTE 1 GARDE SA PASTILLE, et uniquement pour ca : rendre l'ecart
  // visible cote a cote. C'est le seul endroit du prototype ou un libelle d'etat
  // peut encore etre produit.
  const etatAutorise = variante === "v1" && tendanceDisponible;

  const stateChip =
    etatAutorise && libelleEtat !== null ? { label: libelleEtat } : null;

  // L'avertissement n'est emis QUE lorsque la regle retire quelque chose de
  // reellement affichable : sinon il decrirait une suppression qui n'a pas eu
  // lieu, et le visualiseur afficherait du bruit sur des etats non concernes.
  if (variante === "v2" && tendanceDisponible && libelleEtat !== null) {
    protoWarnings.push(
      `D1 (decision du fondateur, 2026-07-28) : la pastille d'etat du jour (« ${libelleEtat} ») est RETIREE de l'en-tete en variante 2, sans condition. Elle n'est plus derriere un drapeau : l'option chargesClubCapturees a ete supprimee de ce ViewModel. Motif : le modele de charge part encore de valeurs initiales artificielles (ATL0/CTL0) et ne connait pas les entrainements club. La variante 1 l'affiche toujours — c'est l'ecart a regarder.`
    );
  }

  // ---------------------------------------------------------------------------
  // 5.8 LA SEMAINE
  // ---------------------------------------------------------------------------
  let week: WeekBlock = null;
  const objectif = input.weeklyGoalDeclared;
  if (objectif !== null && objectif > 0 && !enReprise) {
    const faites = Math.max(0, Math.trunc(input.fksSessionsCompletedThisWeek));
    const reste = Math.max(0, objectif - faites);
    // Un nouveau joueur (0 seance au total) ne recoit pas de compteur : "0 sur 2"
    // des la premiere ouverture est un reproche avant meme d'avoir commence.
    if (nbSeancesTerminees > 0) {
      const message =
        faites > objectif
          ? "Objectif de la semaine dépassé."
          : reste === 0
            ? "Objectif de la semaine atteint."
            : reste === 1
              ? "Plus qu'une séance pour atteindre ton objectif."
              : `Encore ${reste} séances pour atteindre ton objectif.`;
      week = {
        doneCount: faites,
        goalCount: objectif,
        message,
        goalExceeded: faites > objectif,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 5.9 LE CONSEIL — supprime des qu'il recoupe le reste de l'ecran
  // ---------------------------------------------------------------------------
  // Source unique : `coachingTips` de la prescription (donnee reelle, deja
  // produite par l'agent B, jamais affichee sur le Home aujourd'hui). Aucune
  // regle fourre-tout du type `ready_default` qui se declenche toujours.
  // ---------------------------------------------------------------------------
  const corpusDejaDit: string[] = [
    stateChip?.label ?? "",
    action.label,
    action.sublabel ?? "",
    action.secondary?.label ?? "",
    why?.text ?? "",
    week?.message ?? "",
    form && form.kind === "insufficient" ? `${form.title} ${form.message}` : "",
    form && form.kind === "available" ? form.scope : "",
    cycle ? cycle.cycleLabel : "",
    cycle && cycle.kind === "en_cours" ? cycle.phaseLabel : "",
  ].filter((s) => s.length > 0);

  let note: Note = null;
  // Le conseil ne parle que quand une seance est le sujet de l'ecran. Sur un
  // echec de generation, un retour de seance du ou un accuse de reception, un
  // conseil d'execution n'apporte rien et parasite l'action.
  if (pending && seanceConcernee) {
    for (const tip of pending.coachingTips) {
      const texte = texteOuNull(tip);
      if (!texte) continue;
      if (tauxDeRecoupement(texte, corpusDejaDit) > NOTE_RECOUPEMENT_MAX) continue;
      note = { title: "À garder en tête", message: phrasePropre(texte), tone: "info" };
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // 5.10 LA SORTIE — une ligne, et seulement si la destination a quelque chose
  // ---------------------------------------------------------------------------
  // Defaut E8 de l'audit : le lien "Voir ma progression" est toujours actif et
  // mene a un ecran ou tout est verrouille. Ici il n'apparait que quand il y a
  // vraiment de quoi regarder.
  const exit: ExitLink =
    nbSeancesTerminees >= SEANCES_MIN_POUR_TENDANCE
      ? { label: "Voir ma progression", target: "progression" }
      : null;

  // ---------------------------------------------------------------------------
  // 5.11 Header
  // ---------------------------------------------------------------------------
  const prenom = texteOuNull(input.displayName);
  const header: HomeVNextHeader = {
    greeting: prenom ? `Salut, ${prenom}` : "Salut",
    dateLabel: libelleDateCourte(todayKey),
    stateChip,
  };

  return {
    dataState,
    dataNotice,
    header,
    action,
    why,
    cycle,
    week,
    form,
    note,
    exit,
    protoWarnings,
  };
}
