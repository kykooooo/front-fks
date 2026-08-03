// hooks/home/homeVNextAdapter.ts
// =============================================================================
// L'ADAPTATEUR — DES VRAIS STORES VERS LES ENTREES DU HOME VNEXT
// =============================================================================
//
// CE QUE FAIT CE FICHIER
// -----------------------------------------------------------------------------
// Les deux selecteurs du Home vNext (`screens/homeVNext/viewModel.ts` et
// `progressionViewModel.ts`) sont PURS : ils recoivent une forme d'entree et
// decident ce que l'ecran a le droit d'afficher. Jusqu'ici cette forme n'etait
// remplie que par des fixtures. Ce module la remplit avec l'etat REEL de l'app.
//
// Il est PUR lui aussi (aucun hook, aucun store, aucune horloge implicite) :
// `hooks/home/useHomeVNextViewModel.ts` s'occupe de lire les stores et lui passe
// tout en parametres. C'est ce qui permet de le tester sur des formes de
// donnees reelles sans monter React.
//
// LA REGLE QUI GOUVERNE TOUT LE FICHIER
// -----------------------------------------------------------------------------
// DONNEE ABSENTE = `null`, JAMAIS UNE VALEUR.
//
// C'est le risque propre a un adaptateur : les ViewModels interdisent d'inventer,
// mais ils ne peuvent interdire que ce qu'ils voient. Un adaptateur qui ecrit
// `?? 0` ou `?? "Séance"` reintroduit exactement le defaut que le contrat
// existe pour empecher, et les selecteurs n'ont aucun moyen de s'en apercevoir :
// ils recoivent un chiffre, ils le croient. Les tests de ce module verrouillent
// donc l'absence autant que la presence.
//
// CE QUI N'EST PAS BRANCHE, ET POURQUOI (l'app ne le sait pas encore)
// -----------------------------------------------------------------------------
//   - `pendingSession.status === "commencee"` : rien ne trace aujourd'hui une
//     seance ouverte en live puis abandonnee. `Session.completed` est un booleen.
//   - `generationError` : `screens/newSession/` affiche un toast et oublie ;
//     aucun store ne conserve l'echec.
//   - `clubDirective` : `clubs/{clubId}/weekContexts/{weekKey}` n'est lu qu'a la
//     generation (`services/aiContext.ts`) et n'est stocke nulle part.
//   - `chargesClubCapturees` : rien ne capture les seances club REALISEES. Les
//     cases cochees au profil injectent une charge SUPPOSEE, ce qui n'est pas
//     une mesure.
// Ces quatre-la valent `null` / `false` en dur, avec ce commentaire pour seule
// justification. Le jour ou la source existe, c'est ici qu'on la branche.
// =============================================================================

import { canonicalizeMicrocycleGoal, type MicrocycleId } from "../../domain/microcycles";
import {
  compterJoursObserves,
  compterSeancesFksSurJours,
  estChargeExterneManuelle,
  estSeanceFksTerminee,
  FENETRES_RESUME,
  joursDeLaSemaine,
  resoudreObjectifHebdo,
  type DebutDeSemaine,
} from "../../domain/resumeCanonique";
import type { Session } from "../../domain/types";
import type { ExternalLoad } from "../../state/stores/types";
import { updateTrainingLoad } from "../../engine/loadModel";
import { getFootballLabel } from "../../config/trainingDefaults";
import { frIntensity, frFocus } from "../../utils/frLabels";
import { toDateKey } from "../../utils/dateHelpers";
import { getSessionDuration, selectPendingSession } from "../../utils/sessionHelpers";
import type { TestEntry } from "../../screens/tests/testConfig";
import type {
  HomeVNextCompletedSession,
  HomeVNextDemarrageInput,
  HomeVNextFormTrendInput,
  HomeVNextInput,
  HomeVNextNextMatch,
  HomeVNextPendingSession,
} from "../../screens/homeVNext/viewModel";
import type {
  ProgressionInput,
  ProgressionSeanceTerminee,
  ProgressionSemaineCourante,
} from "../../screens/homeVNext/progressionViewModel";

// =============================================================================
// 1. CE QUE L'ADAPTATEUR RECOIT
// =============================================================================

/**
 * L'etat des stores, a plat. Un champ = une lecture de store, nommee comme dans
 * le store d'origine pour que le branchement se relise sans aller-retour.
 */
export type EtatStoresHome = {
  /** `auth.currentUser?.displayName`. */
  displayName: string | null;
  /** `useDebugStore.devNowISO ?? todayISO()`. Jamais l'horloge systeme ici. */
  nowISO: string;
  /** `useSyncStore.storeHydrated`. */
  storeHydrated: boolean;
  /** `useSessionsStore.sessions`. */
  sessions: readonly Session[];
  /** `useExternalStore.externalLoads`. */
  chargesExternes: readonly ExternalLoad[];
  /** `useLoadStore.dailyApplied`. */
  dailyApplied: Record<string, number> | null | undefined;
  /** `useLoadStore.lastAppliedDate`. */
  lastAppliedDate: string | null | undefined;
  /** `useSessionsStore.lastAiSessionV2` (payload de la derniere generation). */
  lastAiSessionV2: Record<string, unknown> | null | undefined;
  /** `useSessionsStore.microcycleGoal` (brut, canonicalise ici). */
  microcycleGoal: string | null;
  /** `useSessionsStore.microcycleSessionIndex`. */
  microcycleSessionIndex: number;
  /** `useExternalStore.targetFksSessionsPerWeek` — le rythme DECLARE au setup. */
  targetFksSessionsPerWeek: number | null;
  /** `useSettingsStore.weeklyGoal` — le reglage. LU BRUT : pas de `?? 2` ici. */
  weeklyGoalReglage: number | null;
  /** `useSettingsStore.weekStart`. */
  debutDeSemaine: DebutDeSemaine;
  /** `useExternalStore.matchDays` — jours de semaine coches au profil. */
  matchDays: readonly string[];
  /** `useNetworkStatus().isOnline`. */
  enLigne: boolean;
  /** `useTestsStorage().entries` — VALIDE, trie, borne. Jamais `readTestsRaw()`. */
  testsTerrain: readonly TestEntry[];
  /** `users/{uid}.mainObjective` (Firestore). */
  mainObjective: string | null;
};

// =============================================================================
// 2. LA SERIE DE FORME — SANS AUCUNE AMORCE
// =============================================================================

/**
 * La trajectoire de forme, construite SANS constante d'amorcage.
 *
 * CE QUI CHANGE PAR RAPPORT A `hooks/home/useLoadSeries.ts`
 * ---------------------------------------------------------------------------
 * L'actuel demarre a `TRAINING_DEFAULTS.ATL0` / `CTL0` et fait tourner 21 jours
 * de chauffe avant d'afficher quoi que ce soit. Consequence : un compte NEUF, qui
 * n'a rien enregistre, obtient malgre tout une courbe — la decroissance des
 * constantes d'initialisation. C'est le defaut P0.1 / P0.2 de l'audit : une
 * courbe qui ne parle que d'elle-meme, et un « TSB initial = +3 » qui donne un
 * etat du jour a quelqu'un qui n'a jamais rien fait.
 *
 * Ici : ATL et CTL partent de ZERO, et la serie ne COMMENCE qu'au premier jour
 * reellement observe de la fenetre. Avant ce jour-la, il n'y a rien a dire, donc
 * on ne dit rien — pas un point, pas un zero.
 *
 * CE QUI EST EXCLU, ET COMMENT
 * ---------------------------------------------------------------------------
 * Les jours dont la charge vient d'une injection automatique club/match ne sont
 * PAS traces comme de l'entrainement : `dailyApplied` est un
 * `Record<jour, number>` sans distinction de source, donc un jour portant une
 * charge auto est indecomposable — on ne peut pas savoir quelle part vient du
 * joueur. Ces jours sont donc comptes comme des jours SANS charge FKS, et
 * signales par `autoClubDaysExcluded`.
 *
 * C'est exactement ce que la phrase de portee promet au joueur : « calculé sur
 * tes séances FKS uniquement — tes entraînements club n'y sont pas comptés ».
 * Une charge supposee ne doit pas etre presentee comme realisee (P0.3).
 *
 * D'OU VIENT LE LIBELLE D'ETAT, ET POURQUOI PAS DU STORE
 * ---------------------------------------------------------------------------
 * `stateLabel` est calcule ICI, sur le dernier point de la serie purgee — et
 * surtout PAS a partir de `useLoadStore.tsb`. Ce champ-la est initialise a
 * `CTL0 - ATL0`, c'est-a-dire au fameux « TSB initial = +3 » : un joueur qui
 * vient de creer son compte y lit deja un etat de forme. Le prendre reviendrait
 * a purger la courbe tout en gardant l'amorce dans la phrase posee juste au-
 * dessus — deux verites dans la meme carte, le defaut P0.2 a l'identique.
 *
 * Le selecteur, lui, ne calcule pas ce libelle : il decide seulement s'il a le
 * DROIT de l'afficher.
 */
export function construireSerieForme(entree: {
  nowISO: string;
  dailyApplied: Record<string, number> | null | undefined;
  seances: readonly Session[];
  chargesExternes: readonly ExternalLoad[];
  fenetreJours?: number;
}): HomeVNextFormTrendInput | null {
  const fenetre = Math.max(1, Math.trunc(entree.fenetreJours ?? FENETRES_RESUME.charge.jours));
  const fin = new Date(entree.nowISO);
  if (Number.isNaN(fin.getTime())) return null;

  // Les jours de la fenetre, du plus ancien au plus recent.
  const jours: string[] = [];
  const curseur = new Date(fin);
  curseur.setHours(12, 0, 0, 0);
  curseur.setDate(curseur.getDate() - (fenetre - 1));
  for (let i = 0; i < fenetre; i++) {
    jours.push(toDateKey(curseur));
    curseur.setDate(curseur.getDate() + 1);
  }

  // Jours ou une charge AUTOMATIQUE club/match a ete injectee.
  const joursAuto = new Set<string>();
  for (const c of entree.chargesExternes) {
    if (estChargeExterneManuelle(c)) continue;
    const cle = toDateKey(c.dateISO);
    if (cle) joursAuto.add(cle);
  }

  // Jours ou l'app a VU quelque chose de reel (seance terminee ou charge saisie).
  const joursObservesSet = new Set<string>();
  for (const s of entree.seances) {
    if (!estSeanceFksTerminee(s)) continue;
    const cle = toDateKey(s.dateISO ?? s.date);
    if (cle) joursObservesSet.add(cle);
  }
  for (const c of entree.chargesExternes) {
    if (!estChargeExterneManuelle(c)) continue;
    const cle = toDateKey(c.dateISO);
    if (cle) joursObservesSet.add(cle);
  }

  const premierIndex = jours.findIndex((j) => joursObservesSet.has(j));
  if (premierIndex < 0) {
    // Rien d'observe dans la fenetre : aucune serie. Le selecteur affichera
    // l'etat de construction, pas une courbe plate.
    return null;
  }

  let atl = 0;
  let ctl = 0;
  const points: { dateKey: string; value: number }[] = [];
  let autoClubDaysExcluded = 0;

  for (let i = premierIndex; i < jours.length; i++) {
    const jour = jours[i];
    const porteUneChargeAuto = joursAuto.has(jour);
    if (porteUneChargeAuto) autoClubDaysExcluded += 1;
    const charge = porteUneChargeAuto ? 0 : Number(entree.dailyApplied?.[jour] ?? 0) || 0;
    const suivant = updateTrainingLoad(atl, ctl, charge, { dtDays: 1 });
    atl = suivant.atl;
    ctl = suivant.ctl;
    points.push({ dateKey: jour, value: Number(suivant.tsb.toFixed(1)) });
  }

  const dernier = points[points.length - 1] ?? null;

  return {
    points,
    stateLabel: dernier ? getFootballLabel(dernier.value).label : null,
    observedDayCount: compterJoursObserves({
      nowISO: entree.nowISO,
      fenetreJours: fenetre,
      seances: entree.seances,
      chargesExternes: entree.chargesExternes,
    }),
    autoClubDaysExcluded,
  };
}

// =============================================================================
// 3. LES PETITES DERIVATIONS
// =============================================================================

/** Texte non vide, sinon `null`. Aucune valeur de remplacement, jamais. */
function texteOuNull(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const t = valeur.trim();
  return t.length > 0 ? t : null;
}

/** Nombre fini strictement positif, sinon `null`. Jamais 0 pour « inconnu ». */
function nombreOuNull(valeur: unknown): number | null {
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const JOURS_SEMAINE_CLES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Le prochain match declare, projete sur une VRAIE date.
 *
 * L'app ne connait que des jours de semaine coches au setup profil
 * (`useExternalStore.matchDays`) : il n'existe aucun calendrier de matchs reels.
 * D'ou `source: "profil_jour_recurrent"` — c'est ce qui autorise l'ecran a dire
 * « tu as noté un match » et jamais « tu as un match ».
 *
 * Sans jour coche : `null`. On ne devine pas un match.
 */
export function construireProchainMatch(
  matchDays: readonly string[],
  nowISO: string
): HomeVNextNextMatch | null {
  if (matchDays.length === 0) return null;
  const base = new Date(nowISO);
  if (Number.isNaN(base.getTime())) return null;

  const curseur = new Date(base);
  curseur.setHours(12, 0, 0, 0);
  for (let i = 0; i <= 7; i++) {
    const cle = JOURS_SEMAINE_CLES[curseur.getDay()];
    if (matchDays.includes(cle)) {
      return { dateKey: toDateKey(curseur), source: "profil_jour_recurrent" };
    }
    curseur.setDate(curseur.getDate() + 1);
  }
  return null;
}

/** Projection minimale d'une seance terminee, pour le Home. */
function projeterSeanceTerminee(s: Session): HomeVNextCompletedSession {
  const aiV2 = (s.aiV2 ?? null) as Record<string, unknown> | null;
  return {
    id: s.id,
    dateKey: toDateKey(s.dateISO ?? s.date),
    title: texteOuNull(s.title) ?? texteOuNull(aiV2?.title),
    durationMin: nombreOuNull(getSessionDuration(s)),
    perceivedEffort: nombreOuNull(s.feedback?.rpe),
  };
}

/**
 * La seance prescrite en attente.
 *
 * `status` ne vaut jamais « commencee » : l'app ne distingue aujourd'hui que
 * `completed` / pas `completed`, rien ne trace une seance ouverte en live puis
 * laissee en plan. Ecrire « commencee » ici serait deviner.
 */
export function construireSeanceEnAttente(
  seances: readonly Session[],
  nowISO: string,
  lastAiSessionV2: Record<string, unknown> | null | undefined
): HomeVNextPendingSession | null {
  const todayKey = toDateKey(new Date(nowISO));
  const pending = selectPendingSession([...seances], todayKey);
  if (!pending) return null;

  // Le payload complet de la generation n'est conserve que pour la DERNIERE
  // seance generee : on ne s'en sert que s'il decrit bien celle-ci.
  const aiSeance = (pending.aiV2 ?? null) as Record<string, unknown> | null;
  const aiDernier = (lastAiSessionV2 ?? null) as Record<string, unknown> | null;
  const ai = aiSeance ?? aiDernier;
  const analytics = (ai?.analytics ?? null) as Record<string, unknown> | null;
  const playerContext = (ai?.playerContext ?? null) as Record<string, unknown> | null;
  const coachingTips = Array.isArray(ai?.coachingTips)
    ? (ai!.coachingTips as unknown[]).filter((t): t is string => typeof t === "string" && t.trim() !== "")
    : [];

  const focusBrut = texteOuNull(ai?.focusPrimary) ?? texteOuNull(pending.focus);
  const intensiteBrute = texteOuNull(ai?.intensity) ?? texteOuNull(pending.intensity);

  return {
    id: pending.id,
    dateKey: toDateKey(pending.dateISO ?? pending.date),
    status: "non_commencee",
    feedbackGiven: Boolean(pending.feedback),
    title: texteOuNull(pending.title) ?? texteOuNull(ai?.title),
    durationMin: nombreOuNull(ai?.durationMin) ?? nombreOuNull(pending.durationMin),
    focusPrimaryLabel: focusBrut ? frFocus(focusBrut) : null,
    intensityLabel: intensiteBrute ? frIntensity(intensiteBrute) : null,
    sessionTheme: texteOuNull(ai?.sessionTheme),
    rationale: texteOuNull(analytics?.rationale),
    playerContextTitle: texteOuNull(playerContext?.title),
    playerContextSummary: texteOuNull(playerContext?.summary),
    coachingTips,
  };
}

/**
 * Ce que l'app sait deja d'un compte qui n'a encore rien fait.
 *
 * Les trois champs existent tous, aucun n'est a creer cote backend. Ils
 * alimentent le bloc de demarrage (variante V-A « Première mission »).
 */
export function construireEntreeDemarrage(etat: {
  mainObjective: string | null;
  testsTerrain: readonly TestEntry[];
}): HomeVNextDemarrageInput {
  const trie = [...etat.testsTerrain].sort((a, b) => Number(b?.ts ?? 0) - Number(a?.ts ?? 0));
  const dernier = trie[0] ?? null;
  const playlist = canonicalizeMicrocycleGoal(dernier?.playlist ?? null);
  return {
    mainObjective: texteOuNull(etat.mainObjective),
    testEntryCount: etat.testsTerrain.length,
    lastTestPlaylist: (playlist as MicrocycleId | null) ?? null,
  };
}

// =============================================================================
// 4. LES DEUX ENTREES
// =============================================================================

/** L'entree du selecteur Home, remplie a partir des stores. */
export function construireEntreeHome(etat: EtatStoresHome): HomeVNextInput {
  const seancesTerminees = etat.sessions
    .filter(estSeanceFksTerminee)
    .map(projeterSeanceTerminee)
    .filter((s) => s.dateKey !== "")
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const todayKey = toDateKey(new Date(etat.nowISO));
  const derniere = seancesTerminees[seancesTerminees.length - 1] ?? null;

  return {
    displayName: texteOuNull(etat.displayName),
    nowISO: etat.nowISO,
    storeHydrated: etat.storeHydrated,
    completedSessions: seancesTerminees,
    pendingSession: construireSeanceEnAttente(etat.sessions, etat.nowISO, etat.lastAiSessionV2),
    hasAppliedToday: Boolean(
      etat.dailyApplied &&
        etat.lastAppliedDate &&
        toDateKey(etat.lastAppliedDate) === todayKey
    ),
    microcycleGoal: (canonicalizeMicrocycleGoal(etat.microcycleGoal) as MicrocycleId | null) ?? null,
    microcycleSessionIndex: Math.max(0, Math.trunc(etat.microcycleSessionIndex ?? 0)),
    weeklyGoalDeclared: resoudreObjectifHebdo({
      targetFksSessionsPerWeek: etat.targetFksSessionsPerWeek,
      weeklyGoalReglage: etat.weeklyGoalReglage,
    }),
    fksSessionsCompletedThisWeek: compterSeancesFksSurJours(
      etat.sessions,
      joursDeLaSemaine(etat.nowISO, etat.debutDeSemaine)
    ),
    daysSinceLastSession: derniere ? ecartEnJours(derniere.dateKey, todayKey) : null,
    formTrend: construireSerieForme({
      nowISO: etat.nowISO,
      dailyApplied: etat.dailyApplied,
      seances: etat.sessions,
      chargesExternes: etat.chargesExternes,
    }),
    nextMatch: construireProchainMatch(etat.matchDays, etat.nowISO),
    // PAS ENCORE BRANCHE — voir l'entete du fichier.
    clubDirective: null,
    connectivity: etat.enLigne ? "online" : "offline",
    generationError: null,
    demarrage: construireEntreeDemarrage(etat),
  };
}

/** L'entree de la carte progression, remplie a partir des memes stores. */
export function construireEntreeProgression(
  etat: EtatStoresHome,
  semaineCourante: ProgressionSemaineCourante
): ProgressionInput {
  const seancesTerminees: ProgressionSeanceTerminee[] = etat.sessions
    .filter(estSeanceFksTerminee)
    .map((s) => ({
      id: s.id,
      dateKey: toDateKey(s.dateISO ?? s.date),
      dureeMin: nombreOuNull(getSessionDuration(s)),
      // « Terminee » et « le joueur a donne son ressenti » sont deux faits
      // distincts : une seance peut etre cochee terminee sans qu'aucun retour
      // n'ait ete saisi. Ce champ ne parle QUE du second.
      ressentiEnregistre: Boolean(s.feedback),
    }))
    .filter((s) => s.dateKey !== "")
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const forme = construireSerieForme({
    nowISO: etat.nowISO,
    dailyApplied: etat.dailyApplied,
    seances: etat.sessions,
    chargesExternes: etat.chargesExternes,
  });

  return {
    // PAS ENCORE BRANCHE — rien ne capture les seances club REALISEES.
    chargesClubCapturees: false,
    seancesTerminees,
    testsTerrain: etat.testsTerrain,
    microcycleGoal:
      (canonicalizeMicrocycleGoal(etat.microcycleGoal) as MicrocycleId | null) ?? null,
    tendance: forme
      ? { points: forme.points, joursObserves: forme.observedDayCount }
      : null,
    semaineCourante,
  };
}

/** Ecart en jours entre deux cles "YYYY-MM-DD". `null` si l'une est illisible. */
function ecartEnJours(depuis: string, jusqua: string): number | null {
  const a = Date.parse(`${depuis}T12:00:00`);
  const b = Date.parse(`${jusqua}T12:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}
