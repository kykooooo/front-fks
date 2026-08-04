// screens/homeVNext/viewModel.ts
// =============================================================================
// Home vNext — COUCHE CONTRAT (aucun composant, aucun rendu)
// =============================================================================
//
// Ce fichier definit ce que l'ecran a le DROIT d'afficher. Il encode la doctrine
// produit issue de l'audit `docs/home-audit-2026-07/` sous forme de TYPES, pour
// que les fautes constatees sur l'ancien Home deviennent impossibles a ecrire
// ici :
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
// STATUT — LU PAR LE JOUEUR, PLUS PAR UN VISUALISEUR.
// Ce fichier a ete ecrit comme un prototype et l'entete disait « ce n'est pas le
// Home de production ; `screens/HomeScreen.tsx` n'est pas touche ». Les deux
// phrases sont fausses depuis le lot de cablage : ce ViewModel alimente l'onglet
// Accueil (`navigation/RootNavigator.tsx`, via `HomeVNextContainer`), avec de
// vrais stores derriere (`hooks/home/homeVNextAdapter.ts`). L'ancien Home ne
// survit que comme repli d'un interrupteur (`config/homeFeatures.ts`).
//
// Ce que ca change pour qui edite ici : plus aucune approximation « on verra au
// branchement ». Un champ qu'on ne sait pas encore alimenter se declare `null`
// et se signale dans `protoWarnings` — jamais une valeur de remplissage.
// =============================================================================

import {
  MICROCYCLES,
  MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
  type MicrocycleId,
} from "../../domain/microcycles";
import { recommendMicrocycle } from "../../domain/recommendMicrocycle";
import { TRACKING_CONFIG } from "../../domain/tracking/config";
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
 * SOURCE UNIQUE (integration L2) — la valeur n'est plus ecrite ici : elle DERIVE
 * de `TRACKING_CONFIG.resumption.gapDaysSoft` (`domain/tracking/config.ts`), le
 * seuil que la boucle de suivi joueur utilise deja pour `detectTrainingGap`. Les
 * deux valaient 14 par coincidence documentaire, pas par construction : un
 * reglage moteur les aurait fait diverger, et l'app aurait dit « reprise » sur un
 * ecran et « tout va bien » sur l'autre, a un tap d'intervalle.
 *
 * Elle reste EXPORTEE, et c'est volontaire : le visualiseur l'affiche dans son
 * bloc SEUILS, et un lecteur du viewModel doit pouvoir lire le nombre sans
 * ouvrir `domain/tracking/`. On derive, on ne supprime pas.
 *
 * Ce seuil ne declenche AUCUNE adaptation de seance : le mode Application de la
 * boucle est OFF par defaut au pilote (cf. `protoWarnings`).
 */
export const JOURS_SANS_SEANCE_POUR_REPRISE: number = TRACKING_CONFIG.resumption.gapDaysSoft;

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

/**
 * Nombre de seances FKS terminees a partir duquel l'ecran N'EST PLUS un ecran
 * de demarrage.
 *
 * - En dessous (donc a zero, et a zero seulement) : le compte n'a encore rien
 *   produit. Aucune semaine, aucune tendance, aucune sortie — l'ecran se resume
 *   a son en-tete, son action et une carte qui dit que la tendance n'existe pas.
 *   C'est l'ecran mesure a 399 px sur 729 visibles, et c'est lui que les
 *   variantes de demarrage (V-A / V-B) reprennent.
 * - A partir de 1 : le cours normal de l'ecran reprend, et le bloc de demarrage
 *   disparait — sans transition speciale, sans "bravo", sans compteur.
 *
 * Pourquoi 1 et pas 2 ou 3 : parce que c'est la premiere seance terminee qui
 * fait passer `week` de `null` a un compteur (§5.8) et qui alimente le premier
 * point de charge reel. Le seuil n'est donc pas un choix de ton : c'est
 * l'instant ou l'ecran a enfin quelque chose de vrai a montrer.
 *
 * SEUIL D'AFFICHAGE DU PROTOTYPE — A VALIDER PAR LE FONDATEUR.
 * Ce seuil ne declenche AUCUNE adaptation de seance.
 */
export const SEANCES_POUR_SORTIR_DU_DEMARRAGE = 1;

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
  {
    nom: "SEANCES_POUR_SORTIR_DU_DEMARRAGE",
    valeur: SEANCES_POUR_SORTIR_DU_DEMARRAGE,
    role: "Seances terminees a partir desquelles l'ecran n'est plus un ecran de demarrage (V-A / V-B).",
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
   * SOURCE : `compterJoursObserves` (`domain/resumeCanonique.ts`) — seances FKS
   * terminees + charges externes SAISIES a la main. Ce sont exactement les deux
   * sources qui alimentent `points` : un jour observe est un jour qui apporte
   * une charge a la trajectoire, jamais un jour qu'on aurait devine.
   * PAS les cles de `useLoadStore.dailyApplied` : ce total melange les charges
   * club auto-injectees a celles du joueur.
   */
  observedDayCount: number;
  /**
   * Jours de la periode tracee qui portaient une charge club/match
   * AUTO-INJECTEE (`applyAutoExternalLoads`, id `auto_*`), deduite de cases
   * cochees au setup profil et jamais confirmee par le joueur. Ces charges-la
   * n'entrent pas dans `points` : une charge supposee ne doit pas etre
   * presentee comme realisee (defaut P0.3 de l'audit).
   *
   * ATTENTION AU SENS : ce compteur ne RETIRE rien du jour. La seance FKS que le
   * joueur a faite le soir d'un entrainement club reste dans la courbe — c'est
   * la charge club qui n'y est pas. Ce champ sert uniquement a declencher la
   * mention « tes entrainements club n'y sont pas comptes ».
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

/**
 * CE QUE L'APP SAIT DEJA D'UN COMPTE QUI N'A ENCORE RIEN FAIT.
 * =============================================================================
 *
 * Ces trois champs existent TOUS les trois dans l'app d'aujourd'hui, ils sont
 * TOUS les trois deja lus par au moins un ecran, et aucun n'a besoin d'etre
 * cree cote backend. C'est la condition posee pour les variantes de demarrage :
 * donner plus de presence a l'ecran du nouveau joueur SANS inventer une donnee.
 *
 * Ce groupe est OPTIONNEL, et c'est un choix de prudence, pas de confort :
 *   - absent (`undefined`) ou `null` -> le bloc de demarrage ne peut pas etre
 *     construit. Le selecteur ne devine RIEN, n'affiche RIEN, et pose un
 *     `protoWarning` qui dit precisement ce qui manque ;
 *   - les 14 autres etats du prototype le laissent a `null` : ils ne servent
 *     pas les variantes de demarrage, et leur ViewModel ne bouge donc pas d'un
 *     champ.
 */
export type HomeVNextDemarrageInput = {
  /**
   * Objectif principal DECLARE par le joueur a l'etape 1 du setup profil.
   *
   * SOURCE : `users/{uid}.mainObjective` (Firestore), ecrit par
   * `screens/ProfileSetupScreen.tsx` (§save) et deja relu par
   * `screens/ProfileScreen.tsx` et `screens/CycleModalScreen.tsx`.
   *
   * VALEUR BRUTE, SANS ACCENT : les 4 valeurs possibles sont persistees telles
   * quelles et comparees a des allowlists sans accent cote Cloud Functions
   * (`functions/src/coachLabels.ts`). Ce selecteur ne les affiche JAMAIS
   * directement — il les passe a `recommendMicrocycle`, qui rend un LIBELLE DE
   * CYCLE deja propre. Aucune table d'accents n'est donc recopiee ici.
   *
   * `null` = objectif pas encore choisi (profil incomplet ou compte legacy).
   */
  mainObjective: string | null;
  /**
   * Nombre d'entrees de tests terrain enregistrees pour ce joueur.
   *
   * SOURCE : `useTestsStorage().entries` (`screens/tests/hooks/useTestsStorage.ts`),
   * c'est-a-dire les entrees VALIDEES (`ts` fini et positif), recanonicalisees
   * (playlist), triees et bornees a 30.
   *
   * PAS `readTestsRaw()`, que citait le prototype : c'est la lecture BRUTE, et
   * la parser soi-meme est exactement ce que font `ProfileScreen.tsx:129`,
   * `CycleModalScreen.tsx:146` et `ProgressScreen.tsx:228` — un contournement de
   * toute la normalisation, qui laisse passer des entrees sans horodatage
   * valide. `ProgressionInput.testsTerrain` (`./progressionViewModel`) pose deja
   * la meme exigence ; les deux entrees lisent donc la meme source.
   *
   * 0 = aucun test passe. Ce compte ne sert QU'A repondre par oui ou par non :
   * il n'est jamais affiche comme un chiffre.
   */
  testEntryCount: number;
  /**
   * Cycle de l'entree de tests la plus recente, deja canonicalise.
   *
   * SOURCE : `TestEntry.playlist` de l'entree la plus recente, normalisee par
   * `canonicalizeMicrocycleGoal` — c'est ce que `CycleModalScreen` appelle
   * `lastTestPlaylist` et passe a `recommendMicrocycle`.
   *
   * `null` = aucun test, ou test sans cycle attache.
   */
  lastTestPlaylist: MicrocycleId | null;
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
   * SOURCE : `useSessionsStore.sessions` filtre par `estSeanceFksTerminee`
   * (`domain/resumeCanonique.ts`) — LE MEME predicat que `compterSeancesFksSurJours`
   * et `compterJoursObserves`, pour que le cumul, le compteur hebdo et la courbe
   * parlent des memes seances. Ni les seances planifiees, ni les charges
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
   * SOURCE : `compterSeancesFksSurJours(sessions, joursDeLaSemaine(...))`
   * (`domain/resumeCanonique.ts`) — l'unique implementation de ce comptage dans
   * l'app, celle que `useWeekSummary`, `buildTrackingProgress` et `RoutineScreen`
   * appellent aussi. Les charges club auto n'y entrent pas.
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

  /**
   * Ce que l'app sait deja d'un compte qui n'a encore rien fait.
   *
   * OPTIONNEL a dessein : sans lui, les variantes de demarrage ne construisent
   * RIEN plutot que de deviner. Voir `HomeVNextDemarrageInput`.
   */
  demarrage?: HomeVNextDemarrageInput | null;
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

// =============================================================================
// 3 bis. LE BLOC DE DEMARRAGE — LES DEUX VARIANTES DE L'ECRAN NOUVEAU JOUEUR
// =============================================================================
//
// LE PROBLEME MESURE
// -----------------------------------------------------------------------------
// L'ecran du compte neuf fait 399 px sur 729 visibles a 375 px. Il est juste,
// il est honnete, et il est TIMIDE : un en-tete, un bouton, une carte qui dit
// qu'il n'y a rien a mesurer. Decision du fondateur (03/08) : « sobre ne doit
// pas dire timide » — plus de presence, sans rien inventer.
//
// LA REGLE QUI NE BOUGE PAS
// -----------------------------------------------------------------------------
// Chaque element de ces deux variantes sort d'une donnee que l'app POSSEDE
// DEJA. Aucun champ n'est fabrique, aucun chiffre n'est place en attendant,
// aucune courbe n'est dessinee. Le contrat l'impose par ses types :
//
//   - `PremierPas.fait` est DERIVE (booleen calcule), et `PremierPas.source`
//     nomme le champ d'entree qui l'a decide. Un pas dont l'etat n'est pas
//     derivable N'ENTRE PAS dans la liste ;
//   - `PourquoiCeCycle` n'a pas de champ libre : sa phrase est composee autour
//     d'un LIBELLE DE CYCLE rendu par `recommendMicrocycle`, la fonction que
//     `ProfileSetupScreen` et `CycleModalScreen` utilisent deja ;
//   - `ApercuSection` porte un `seuil` qui est une CONSTANTE EXPORTEE de ce
//     fichier : la promesse « tu verras ca ici » est adossee au chiffre qui la
//     declenchera vraiment, et le visualiseur affiche les deux.
//
// AUCUNE des deux variantes n'ajoute une seconde action : il n'y a toujours
// qu'un `action`, et ni les pas ni les apercus ne portent de destination. C'est
// volontaire — voir `PremierPas` ci-dessous.
// =============================================================================

/**
 * Les trois premiers pas d'un compte neuf. Union FERMEE : rien d'autre ne peut
 * devenir un « premier pas », donc la liste ne peut pas se transformer en menu.
 */
export type PremierPasId =
  /** Le profil est renseigne (poste, niveau, objectif, charge club). */
  | "profil"
  /** Les premiers tests terrain sont passes. */
  | "test_terrain"
  /** La premiere seance FKS est terminee. */
  | "premiere_seance";

/**
 * Un pas, et l'etat verifiable qui decide s'il est fait.
 *
 * IL N'Y A AUCUN CHAMP D'ACTION, ET C'EST LE POINT LE PLUS IMPORTANT DU TYPE.
 * Une checklist dont chaque ligne est tapable, c'est trois boutons de plus a
 * cote du seul qui compte — exactement la faute que tout ce prototype corrige
 * (doctrine 1 : une seule action par ecran). Ces lignes DISENT le chemin, elles
 * ne le proposent pas. Le seul point d'entree reste l'action du jour.
 */
export type PremierPas = {
  id: PremierPasId;
  /** Le pas, formule pareil qu'il soit fait ou non. */
  label: string;
  /**
   * Precision courte. Change selon `fait`, jamais un reproche, jamais une
   * promesse que le produit ne tient pas.
   */
  detail: string;
  /**
   * DERIVE d'une donnee d'entree. Le rendu ne le decide jamais, et aucune
   * valeur par defaut ne l'invente : un pas dont l'etat n'est pas derivable est
   * absent de la liste.
   */
  fait: boolean;
  /**
   * Le champ d'entree qui a decide de `fait`, ecrit tel qu'il se lit dans le
   * code. Sert au visualiseur (onglet « Cet etat »), jamais a l'ecran.
   */
  source: string;
};

/**
 * Pourquoi ce cycle-la est propose a ce joueur-la.
 *
 * PRODUIT PAR `recommendMicrocycle` (`domain/recommendMicrocycle.ts`) — la
 * meme fonction que celle qui pre-selectionne deja le cycle a la fin du setup
 * profil et dans la modale de choix de cycle. L'ecran ne recalcule rien et ne
 * propose rien de different de ce que le joueur trouvera en tapant sur l'action.
 */
export type PourquoiCeCycle = {
  /** La phrase telle qu'elle sera lue. */
  text: string;
  /** Le libelle du cycle recommande (`MICROCYCLES[id].label`). */
  cycleLabel: string;
  /** Quelles donnees ont pese. Union fermee -> pas de source inventable. */
  source: "objectif_declare" | "objectif_declare_et_tests";
};

/**
 * Une section que l'ecran n'affiche PAS ENCORE, et la condition exacte de son
 * apparition.
 *
 * C'est la seule facon honnete d'occuper une place vide : dire ce qui viendra,
 * et a partir de quand. Aucun chiffre d'attente, aucune courbe grisee, aucun
 * « — » a la place d'une valeur.
 */
export type ApercuSection = {
  /** Le titre EXACT que la section portera quand elle existera. */
  titre: string;
  /** Ce qui apparaitra la, et a partir de quand. */
  message: string;
  /**
   * Le seuil qui declenchera l'apparition, en seances terminees. C'est une
   * CONSTANTE EXPORTEE de ce fichier, jamais un nombre ecrit dans une phrase.
   */
  seuil: number;
  /** Le nom de cette constante, pour que le visualiseur puisse la retrouver. */
  seuilNom: string;
};

/**
 * Le bloc de demarrage. `null` partout ailleurs que sur un compte neuf, et
 * `null` aussi quand la variante n'est pas demandee : la variante 1 validee par
 * le fondateur ne gagne donc pas un seul champ.
 */
export type DemarrageBlock =
  | {
      /** V-A « Premiere mission » : les premiers pas, et pourquoi ce cycle. */
      kind: "premiere_mission";
      titre: string;
      premiersPas: readonly PremierPas[];
      /** `null` quand aucun objectif n'est declare, ou qu'un cycle est deja actif. */
      pourquoiCeCycle: PourquoiCeCycle | null;
    }
  | {
      /** V-B « Anticipation honnete » : ce qui viendra, et quand. */
      kind: "anticipation";
      titre: string;
      apercus: readonly ApercuSection[];
    }
  | null;

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

  /**
   * Variante de l'ecran de DEMARRAGE (compte sans aucune seance terminee).
   *
   * Defaut : absente — le ViewModel se comporte alors exactement comme avant
   * l'ajout de ce parametre, `demarrage` vaut `null`, et les 14 autres etats ne
   * peuvent pas etre touches meme par accident (le bloc exige zero seance
   * terminee, ce qu'aucun d'eux ne remplit).
   *
   * Cette option est ORTHOGONALE a `variante` : elle ne decrit pas le meme axe.
   * `variante` dit quelle proposition d'ecran on rend ; `demarrage` dit comment
   * on traite le seul etat ou l'ecran n'a presque rien a dire.
   */
  demarrage?: DemarrageVarianteId;
};

/**
 * Les deux traitements proposes pour l'ecran du nouveau joueur.
 * Union FERMEE : le visualiseur ne peut pas demander un traitement qui
 * n'existe pas, et le selecteur ne peut pas en inventer un troisieme.
 */
export type DemarrageVarianteId =
  /** V-A « Premiere mission ». */
  | "A"
  /** V-B « Anticipation honnete ». */
  | "B";

/** Libelles lisibles par un non-developpeur, pour la bascule du visualiseur. */
export const DEMARRAGE_VARIANTES: readonly {
  id: DemarrageVarianteId;
  titre: string;
  resume: string;
}[] = [
  {
    id: "A",
    titre: "V-A — Première mission",
    resume:
      "L'action passe en traitement hero, et l'écran dit les trois premiers pas — chaque pas coché depuis un état réel du compte.",
  },
  {
    id: "B",
    titre: "V-B — Anticipation honnête",
    resume:
      "L'action passe en traitement hero, et l'écran annonce ce qui apparaîtra ici — avec le seuil exact qui le déclenchera.",
  },
];

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
  /**
   * Le bloc de demarrage (V-A / V-B). `null` sans l'option `demarrage`, `null`
   * des la premiere seance terminee, `null` si l'entree de demarrage manque.
   */
  demarrage: DemarrageBlock;
  note: Note;
  exit: ExitLink;
  /**
   * Messages de diagnostic, JAMAIS affiches au joueur — aucun composant ne lit
   * ce champ, seuls les tests l'inspectent.
   *
   * Le nom vient du prototype ; ce qu'ils disent a change de nature depuis le
   * branchement. Ils ne racontent plus « ce que le prototype ne sait pas faire »
   * mais **ce que l'ecran ne peut pas encore savoir** : les entrees qu'aucun
   * store n'alimente aujourd'hui (`generationError`, statut « commencee »,
   * directive club) et les situations ou le ViewModel a volontairement tu une
   * information plutot que de l'inventer.
   *
   * REGLE D'ENTRETIEN : un avertissement qui a cesse d'etre vrai se supprime, il
   * ne se laisse pas trainer. Deux l'ont ete au lot de nettoyage — `connectivity`
   * (branche depuis `hooks/home/useEtatStoresHome.ts`) et la liste de champs que
   * l'ancienne page Progression ne savait pas comparer (elle lit desormais ce
   * meme ViewModel). Un diagnostic faux est pire que pas de diagnostic.
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
      "storeHydrated=false. Le rendu doit squeletter TOUS les blocs, action comprise — aucun texte de ce ViewModel ne doit etre lu a l'ecran tant que l'hydratation n'est pas finie (defaut P0.4 de l'audit)."
    );
  }
  // `connectivity` AVAIT son avertissement ici — « le Home ne lit jamais le
  // reseau, champ a brancher ». Il est parti au lot de nettoyage parce qu'il
  // etait devenu faux : `hooks/home/useEtatStoresHome.ts` appelle bien
  // `useNetworkStatus()` et l'adaptateur remplit le champ. Le laisser aurait
  // fait crier « pas branche » a chaque passage hors ligne d'un joueur reel,
  // c'est-a-dire exactement quand le champ FAIT son travail.
  if (input.generationError) {
    protoWarnings.push(
      "Non branche : aucun store ne conserve aujourd'hui l'echec d'une generation (screens/newSession/ affiche un toast puis oublie) — champ generationError a creer."
    );
  }
  if (input.pendingSession?.status === "commencee") {
    protoWarnings.push(
      "Non branche : l'app ne trace pas une seance ouverte en live puis abandonnee (Session.completed est binaire) — statut 'commencee' a brancher dans SessionLiveScreen."
    );
  }
  if (input.clubDirective) {
    protoWarnings.push(
      `Non branche : la directive club (semaine ${input.clubDirective.weekKey}) n'a aucune source cote Home — clubs/{clubId}/weekContexts n'est lu qu'au moment de la generation (services/aiContext.ts) et n'est stocke dans aucun store.`
    );
    if (!input.clubDirective.appliedToPrescription) {
      protoWarnings.push(
        "Cette directive club n'a PAS ete consommee par la prescription du jour. Elle est volontairement absente de l'ecran produit (voir la decision documentee dans viewModel.ts) — l'ecran n'affirme donc nulle part que la seance en tient compte."
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
      // FUTUR assume, et pour une raison qui a change de nature — voir
      // l'avertissement juste en dessous.
      sublabel: "On te préparera une remise en route progressive.",
      secondary: null,
    };
    protoWarnings.push(
      "Le moteur SAIT alleger apres une interruption (domain/tracking/apply.ts, branche dans services/aiContext.ts), mais le mode Application est OFF par defaut au pilote (domain/tracking/modes.ts, DEFAULT_TRACKING_MODES.apply=false ; pilotable par joueur via users/{uid}.trackingConfig.apply). Le futur du sous-titre ('on te preparera') reste donc exact tant que l'interrupteur est ferme : c'est une decision, pas une piece manquante."
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
        "Approximation assumee : ce match vient d'un jour de semaine coche au profil (useExternalStore.matchDays), pas d'un match reel date. Le texte dit donc 'tu as note un match', jamais 'ton match' (defaut P1.27)."
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
    // La phrase doit decrire EXACTEMENT ce qui a ete calcule. La courbe est
    // construite sur les deux seules choses que le joueur a enregistrees : ses
    // seances FKS terminees et les charges qu'il a saisies a la main
    // (`construireChargesEnregistreesParJour`). Les entrainements club deduits
    // des cases du setup profil n'y sont pas — on ne le dit que quand il y en a.
    const portee =
      trend.autoClubDaysExcluded > 0
        ? "Calculé sur tes séances FKS et les charges que tu as saisies — tes entraînements club notés au profil n'y sont pas comptés."
        : "Calculé sur tes séances FKS et les charges que tu as saisies.";
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
  // 5.8 bis LE DEMARRAGE — plus de presence, zero donnee inventee
  // ---------------------------------------------------------------------------
  // TROIS CONDITIONS, TOUTES OBLIGATOIRES, ET AUCUNE N'EST UN GOUT :
  //
  //   1. `options.demarrage` est demande. Sans option, ce bloc n'existe pas :
  //      la variante 1 validee par le fondateur ne gagne pas un champ.
  //   2. ZERO seance terminee (`SEANCES_POUR_SORTIR_DU_DEMARRAGE`). Des la
  //      premiere seance faite, l'ecran a de vraies choses a dire et le bloc
  //      disparait tout seul — sans "bravo", sans transition.
  //   3. `input.demarrage` est fourni. Sinon on ne devine pas : le bloc reste
  //      `null` et un `protoWarning` nomme le champ manquant.
  //
  // CE QUE LE BLOC ABSORBE, ET POURQUOI
  // -----------------------------------------------------------------------------
  // Quand il existe, il REMPLACE la carte "MA FORME" (§5.6, cas
  // `pas_assez_de_seances` a zero seance). Les deux parlent de la meme chose —
  // "il n'y a pas encore de tendance, voila ce qui la declenchera" — et les
  // garder toutes les deux ecrirait deux fois la meme phrase sur un ecran qui
  // en compte cinq. C'est exactement la regle anti-redite deja appliquee au
  // conseil (`NOTE_RECOUPEMENT_MAX`), appliquee ici a un bloc entier.
  //
  // Ce retrait est fait A LA SOURCE, ici, et pas dans l'ecran : c'est le
  // ViewModel qui decide de ce qui a le droit d'etre affiche.
  // ---------------------------------------------------------------------------
  let demarrage: DemarrageBlock = null;
  const varianteDemarrage = options.demarrage ?? null;
  const compteAuDemarrage = nbSeancesTerminees < SEANCES_POUR_SORTIR_DU_DEMARRAGE;

  if (varianteDemarrage !== null && compteAuDemarrage) {
    const entree = input.demarrage ?? null;
    if (entree === null) {
      protoWarnings.push(
        "Variante de demarrage demandee, mais `input.demarrage` est absent : ni l'objectif declare (users/{uid}.mainObjective) ni le nombre de tests terrain (useTestsStorage) ne sont fournis. Le bloc n'est PAS construit — le selecteur ne devine aucun de ces etats."
      );
    } else if (varianteDemarrage === "A") {
      demarrage = {
        kind: "premiere_mission",
        titre: "TES PREMIERS PAS",
        premiersPas: construirePremiersPas(entree, nbSeancesTerminees),
        pourquoiCeCycle: construirePourquoiCeCycle(entree, input.microcycleGoal),
      };
      if (input.microcycleGoal !== null) {
        protoWarnings.push(
          "V-A : un cycle est deja actif sur ce compte, donc la ligne « pourquoi ce cycle » est retiree. Recommander un cycle a cote de celui qui tourne deja ferait s'affronter deux verites dans le meme ecran."
        );
      } else if (entree.mainObjective === null) {
        protoWarnings.push(
          "V-A : aucun objectif declare (users/{uid}.mainObjective est vide), donc la ligne « pourquoi ce cycle » est retiree. `recommendMicrocycle` rendrait bien « Reprise & bases », mais par DEFAUT — le presenter comme un choix fonde sur le joueur serait une raison inventee."
        );
      }
    } else {
      demarrage = {
        kind: "anticipation",
        titre: "CE QUI VA APPARAÎTRE ICI",
        apercus: construireApercus(input.weeklyGoalDeclared),
      };
    }
  }

  if (demarrage !== null) {
    // Le bloc absorbe "MA FORME" : voir l'explication ci-dessus.
    form = null;
  }

  if (varianteDemarrage !== null && !compteAuDemarrage) {
    protoWarnings.push(
      `Variante de demarrage « ${varianteDemarrage} » demandee sur un compte qui a deja ${nbSeancesTerminees} seance(s) terminee(s). Le bloc n'est pas construit : le seuil SEANCES_POUR_SORTIR_DU_DEMARRAGE vaut ${SEANCES_POUR_SORTIR_DU_DEMARRAGE}. L'ecran rendu est donc rigoureusement celui de la variante 1.`
    );
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
    // Le bloc de demarrage entre dans le corpus au meme titre que les autres :
    // un conseil qui redirait ce que les premiers pas viennent de dire serait
    // supprime par la meme regle, sans exception pour le nouveau venu.
    ...(demarrage !== null && demarrage.kind === "premiere_mission"
      ? demarrage.premiersPas.map((p) => `${p.label} ${p.detail}`)
      : []),
    ...(demarrage !== null && demarrage.kind === "premiere_mission" && demarrage.pourquoiCeCycle
      ? [demarrage.pourquoiCeCycle.text]
      : []),
    ...(demarrage !== null && demarrage.kind === "anticipation"
      ? demarrage.apercus.map((a) => a.message)
      : []),
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
    demarrage,
    note,
    exit,
    protoWarnings,
  };
}

// =============================================================================
// 6. LES TROIS DERIVATIONS DU DEMARRAGE
// =============================================================================
// Fonctions PURES, sorties du selecteur pour une raison : chacune est le seul
// endroit ou une phrase de demarrage peut naitre. Les lire, c'est lire la
// totalite de ce que ces deux variantes ont le droit d'afficher.
// =============================================================================

/**
 * Les trois premiers pas, et l'etat verifiable de chacun.
 *
 * AUCUN pas n'est ajoute "pour faire trois". Chacun sort d'un champ d'entree
 * que l'app remplit deja, et son etat `fait` est le resultat d'une comparaison,
 * jamais une valeur ecrite a la main.
 */
function construirePremiersPas(
  entree: HomeVNextDemarrageInput,
  nbSeancesTerminees: number
): readonly PremierPas[] {
  const profilFait = texteOuNull(entree.mainObjective) !== null;
  const testsFaits = Math.max(0, Math.trunc(entree.testEntryCount)) > 0;
  const seanceFaite = nbSeancesTerminees > 0;

  return [
    {
      id: "profil",
      label: "Ton objectif",
      // LIBELLE RESTREINT A CE QUI EST VERIFIE (integration L2).
      //
      // Le prototype cochait ce pas sur `mainObjective` SEUL, mais l'annoncait
      // au joueur comme « Poste, niveau, objectif : c'est enregistré ». Un
      // compte legacy portant un objectif sans poste ni niveau lisait donc une
      // coche verte pour deux champs que personne n'avait verifies — la faute
      // exacte que le contrat interdit partout ailleurs (« pas de valeur
      // affirmee sans source »).
      //
      // Deux sorties etaient possibles : faire deriver la coche des trois
      // champs, ou restreindre ce qu'elle dit. C'est la seconde qui est prise :
      // elle ne fabrique aucun champ d'entree, et le poste et le niveau ne
      // manquent jamais a l'arrivee du setup profil (les trois sont ecrits d'un
      // seul `saveProfile`) — ils ne meritent donc pas une coche a eux.
      detail: profilFait
        ? "Ton objectif principal est enregistré."
        : "Il manque ton objectif principal : c'est lui qui oriente tes séances.",
      fait: profilFait,
      source: "users/{uid}.mainObjective (Firestore, ecrit par ProfileSetupScreen)",
    },
    {
      id: "test_terrain",
      label: "Tes tests terrain",
      // Formulation reprise MOT POUR MOT de screens/CycleModalScreen.tsx : c'est
      // deja la promesse faite au joueur ailleurs dans l'app, et deux promesses
      // differentes pour la meme chose, c'est une de trop.
      detail: testsFaits
        ? "Tes repères sont enregistrés."
        : "Ils affinent tes séances, mais tu peux commencer sans.",
      fait: testsFaits,
      // SOURCE VALIDEE, jamais le brut : `useTestsStorage()` valide le `ts`,
      // recanonicalise la playlist, trie desc et borne a 30 entrees. Le
      // `readTestsRaw()` que citait le prototype est la lecture NON normalisee
      // que fait `ProgressScreen.tsx:228` — precisement le defaut que la
      // refonte doit corriger, pas recopier.
      source: "useTestsStorage().entries (screens/tests/hooks/useTestsStorage.ts)",
    },
    {
      id: "premiere_seance",
      label: "Ta première séance",
      // Le seuil est la CONSTANTE, pas un chiffre choisi pour la phrase.
      detail: seanceFaite
        ? "C'est fait."
        : `C'est elle qui lance tout : ta tendance de forme démarre à ${SEANCES_MIN_POUR_TENDANCE} séances.`,
      fait: seanceFaite,
      source: "useSessionsStore.sessions filtre par isSessionCompleted",
    },
  ];
}

/**
 * Pourquoi ce cycle-la.
 *
 * DEUX VERROUS, tous deux dans le sens de la prudence :
 *   - un cycle deja actif -> `null`. Recommander a cote de ce qui tourne deja
 *     mettrait deux verites dans le meme ecran (defaut E12/E13 de l'audit) ;
 *   - aucun objectif declare -> `null`. `recommendMicrocycle` rendrait bien
 *     « Reprise & bases », mais avec `confidence: "low"` et la raison
 *     « Recommandation par defaut » : le presenter comme un choix fonde sur le
 *     joueur serait precisement la raison inventee que la doctrine 4 interdit.
 */
function construirePourquoiCeCycle(
  entree: HomeVNextDemarrageInput,
  cycleActif: MicrocycleId | null
): PourquoiCeCycle | null {
  if (cycleActif !== null) return null;
  const objectif = texteOuNull(entree.mainObjective);
  if (objectif === null) return null;

  // La MEME fonction que celle qui pre-selectionne deja le cycle a la fin du
  // setup profil (`ProfileSetupScreen`, auto-assign) et dans la modale de choix
  // de cycle. L'ecran ne peut donc pas proposer autre chose que ce que le
  // joueur trouvera en tapant sur l'action.
  const reco = recommendMicrocycle({
    mainObjective: objectif,
    lastTestPlaylist: entree.lastTestPlaylist,
  });
  const cycleLabel = MICROCYCLES[reco.id].label;
  const testsOntPese = entree.lastTestPlaylist !== null;

  return {
    text: testsOntPese
      ? `D'après l'objectif que tu as choisi et tes derniers tests, c'est « ${cycleLabel} » qui te correspond.`
      : `D'après l'objectif que tu as choisi, c'est « ${cycleLabel} » qui te correspond.`,
    cycleLabel,
    source: testsOntPese ? "objectif_declare_et_tests" : "objectif_declare",
  };
}

/**
 * Ce que l'ecran affichera plus tard, et a partir de quand.
 *
 * Chaque apercu porte le TITRE EXACT de la section qu'il annonce et le SEUIL
 * qui la declenchera vraiment. Un apercu dont la section ne pourra jamais
 * apparaitre est ecarte : promettre « Ma semaine » a un joueur qui n'a declare
 * aucun objectif hebdo serait une promesse que le produit ne tient pas (§5.8
 * exige `weeklyGoalDeclared !== null`).
 */
function construireApercus(weeklyGoalDeclared: number | null): readonly ApercuSection[] {
  const apercus: ApercuSection[] = [];

  const objectif = weeklyGoalDeclared;
  if (objectif !== null && objectif > 0) {
    apercus.push({
      titre: "MA SEMAINE",
      message: `Après ta première séance, tu verras ici où tu en es de tes ${objectif} séance${objectif > 1 ? "s" : ""} par semaine.`,
      seuil: SEANCES_POUR_SORTIR_DU_DEMARRAGE,
      seuilNom: "SEANCES_POUR_SORTIR_DU_DEMARRAGE",
    });
  }

  apercus.push({
    titre: "MA FORME",
    message: `Ta tendance se dessinera ici à partir de ${SEANCES_MIN_POUR_TENDANCE} séances enregistrées — pas avant, parce qu'avant elle ne dirait rien de toi.`,
    seuil: SEANCES_MIN_POUR_TENDANCE,
    seuilNom: "SEANCES_MIN_POUR_TENDANCE",
  });

  apercus.push({
    titre: "MA PROGRESSION",
    message: `Le lien vers ton suivi détaillé s'ouvrira au même moment : ${SEANCES_MIN_POUR_TENDANCE} séances, et il y aura vraiment quelque chose à regarder.`,
    seuil: SEANCES_MIN_POUR_TENDANCE,
    seuilNom: "SEANCES_MIN_POUR_TENDANCE",
  });

  return apercus;
}
