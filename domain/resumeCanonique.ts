// domain/resumeCanonique.ts
// =============================================================================
// LE RESUME CANONIQUE — UNE SEULE SOURCE DE VERITE PAR METRIQUE
// =============================================================================
//
// POURQUOI CE FICHIER EXISTE
// -----------------------------------------------------------------------------
// L'audit du Home a releve trois contradictions qui ne viennent pas du design
// mais du fait que la meme phrase est calculee a deux endroits :
//
//   1. « X/Y seances cette semaine » a DEUX numerateurs et DEUX cibles.
//      - Home       : `useWeekSummary.fksCount` (jours de la semaine, reglage
//                     `weekStart` mon/sun) sur cible `useSettingsStore.weeklyGoal ?? 2` ;
//      - Ton suivi  : `countCompletedThisWeek` (`weekKeyOf`, lundi fixe) sur
//                     cible `useExternalStore.targetFksSessionsPerWeek`.
//      Deux ecrans a un tap d'intervalle pouvaient donc afficher deux fractions
//      differentes pour la meme semaine.
//
//   2. Les fenetres ne sont nommees NULLE PART. « 5 seances / 28 jours » vit
//      dans `TRACKING_CONFIG.window`, « depuis tes debuts » est un cumul, la
//      courbe regarde 30 jours : trois portees, aucun nom, et donc deux
//      compteurs qui se ressemblent a l'ecran sans mesurer la meme chose.
//
//   3. Le seuil de reprise etait ecrit deux fois (14 dans
//      `TRACKING_CONFIG.resumption.gapDaysSoft`, 14 dans le prototype). Corrige
//      a part : `JOURS_SANS_SEANCE_POUR_REPRISE` derive desormais du moteur
//      (voir `screens/homeVNext/viewModel.ts`).
//
// CE QUE CE FICHIER FAIT, ET CE QU'IL NE FAIT PAS
// -----------------------------------------------------------------------------
// Il fournit UNE implementation par metrique, PURE (aucun store, aucun hook,
// aucune horloge implicite — l'instant de reference est toujours un parametre).
// Les differences legitimes restent des PARAMETRES explicites, pas des
// algorithmes concurrents : le Home passe le `weekStart` du joueur, la boucle
// de suivi passe « lundi » parce que sa cle Firestore partagee coach/joueur
// (`weekKeyOf`) est a lundi fixe. Meme code, deux appels, ecart visible.
//
// Il NE change AUCUN affichage a lui seul. Les consommateurs actuels lui
// delegent leur calcul en gardant leur comportement au resultat pres ; la
// bascule des CIBLES (qui, elle, se voit) appartient aux lots d'ecran.
//
// IL NE TOUCHE PAS `weekKeyOf`. Cette fonction est l'identifiant de
// `clubs/{clubId}/weekContexts/{weekKey}` : la rendre dependante du reglage
// `weekStart` ferait diverger les semaines du coach et du joueur EN BASE.
// =============================================================================

import { TRACKING_CONFIG } from "./tracking/config";
import { toDateKey } from "../utils/dateHelpers";

// =============================================================================
// 1. LES FENETRES, NOMMEES
// =============================================================================

/**
 * Les portees de mesure de l'app, nommees une fois pour toutes.
 *
 * Un chiffre affiche sans sa portee est un chiffre qu'on ne peut pas verifier :
 * « 12 seances » ne veut rien dire tant qu'on ne sait pas si c'est cette
 * semaine, ce mois-ci ou depuis toujours. Chaque entree porte donc le libelle
 * exact a afficher a cote du chiffre.
 */
export const FENETRES_RESUME = {
  /** La semaine en cours, au sens du reglage du joueur. */
  semaine: {
    id: "semaine",
    libelle: "cette semaine",
  },
  /**
   * La fenetre de la boucle de suivi : les dernieres seances REELLEMENT
   * exploitees par le tracking live. Bornee des deux cotes.
   */
  suiviRecent: {
    id: "suivi_recent",
    seancesMax: TRACKING_CONFIG.window.sessions,
    jours: TRACKING_CONFIG.window.days,
    libelle: "séances suivies",
  },
  /** Tout l'historique, sans borne. */
  cumul: {
    id: "cumul",
    libelle: "séances terminées depuis tes débuts",
  },
  /**
   * La fenetre de la courbe de forme et du compte de jours observes.
   *
   * 30 jours : c'est la portee que la carte progression annonce au joueur, et
   * la seule qui soit tenable sans amorcage — au-dela, le modele de charge
   * n'aurait que ses constantes d'initialisation a montrer.
   */
  charge: {
    id: "charge",
    jours: 30,
    libelle: "sur 30 jours",
  },
} as const;

// =============================================================================
// 2. LA SEMAINE — UN SEUL NUMERATEUR
// =============================================================================

export type DebutDeSemaine = "mon" | "sun";

/** Ce que le resume a besoin de savoir d'une seance. Volontairement minimal. */
export type SeanceDatee = {
  completed?: boolean;
  dateISO?: string | null;
  date?: string | null;
};

/** Ce que le resume a besoin de savoir d'une charge externe. */
export type ChargeExterneDatee = {
  id?: string;
  dateISO?: string | null;
};

/**
 * UNE SEULE DEFINITION DE « SEANCE FKS TERMINEE » POUR TOUTE LA COUCHE DE CALCUL.
 *
 * POURQUOI ELLE EST STRICTE (`completed`, et pas `completed || feedback`)
 * ---------------------------------------------------------------------------
 * `utils/sessionHelpers.ts` expose `isSessionCompleted` = `completed || feedback`.
 * C'est un predicat plus large, utile la ou l'on veut « une seance sur laquelle
 * le joueur a fait quelque chose ». Il ne peut PAS servir ici, pour deux raisons
 * mesurables dans le depot :
 *
 *   1. `selectPendingSession` (`utils/sessionHelpers.ts`) filtre `!s.completed`.
 *      Une seance portant un `feedback` sans `completed` reste donc EN ATTENTE
 *      pour l'app. La compter comme terminee la rendrait simultanement « faite »
 *      et « a faire » dans le meme objet d'entree — deux verites contradictoires
 *      a une ligne d'intervalle, exactement le defaut que ce lot ferme.
 *   2. Le moteur de charge (`sumDailyWeightedLoad`, `engine/dailyAggregation.ts`)
 *      ignore lui aussi tout ce qui n'est pas `completed`. Compter large ici
 *      donnerait un nombre de seances que la courbe de charge ne refleterait
 *      pas : un compteur qui monte au-dessus d'une trajectoire qui ne bouge pas.
 *
 * Le chemin normal (`state/orchestrators/applyFeedback.ts`) ecrit `completed` et
 * `feedback` ENSEMBLE : sur les donnees produites par l'app, les deux predicats
 * rendent le meme resultat. L'ecart n'existe que sur de la donnee legacy, et sur
 * celle-la le choix strict est le seul qui reste coherent avec le reste du code.
 */
export function estSeanceFksTerminee(seance: SeanceDatee | null | undefined): boolean {
  return Boolean(seance?.completed);
}

/**
 * Les 7 cles de jour ("YYYY-MM-DD") de la semaine qui contient `nowISO`.
 *
 * Arithmetique de date LOCALE, comme `weekKeyOf` et comme `toDateKey` : un
 * joueur qui termine une seance a 23 h 30 la voit compter pour son jour, pas
 * pour le lendemain.
 *
 * @param debutDeSemaine "mon" (defaut de l'app) ou "sun". Pour la boucle de
 *   suivi, passer "mon" : c'est ce que fait `weekKeyOf`, dont la cle est
 *   partagee avec le coach.
 */
export function joursDeLaSemaine(
  nowISO: string | Date,
  debutDeSemaine: DebutDeSemaine
): string[] {
  const base = nowISO instanceof Date ? new Date(nowISO) : new Date(nowISO);
  if (Number.isNaN(base.getTime())) return [];

  const premierJourIndex = debutDeSemaine === "sun" ? 0 : 1;
  const dow = base.getDay(); // 0 = dimanche … 6 = samedi (local)
  const recul = (dow - premierJourIndex + 7) % 7;

  const debut = new Date(base);
  debut.setHours(12, 0, 0, 0); // midi : aucun basculement de jour a l'heure d'ete
  debut.setDate(debut.getDate() - recul);

  const jours: string[] = [];
  for (let i = 0; i < 7; i++) {
    const j = new Date(debut);
    j.setDate(debut.getDate() + i);
    jours.push(toDateKey(j));
  }
  return jours;
}

/**
 * Nombre de seances FKS **terminees** tombant sur les jours donnes.
 *
 * L'UNIQUE implementation de ce comptage dans l'app. Elle prend une liste de
 * jours plutot qu'un instant : c'est ce qui permet au Home (semaine du joueur)
 * et a la boucle de suivi (semaine lundi-fixe) d'appeler le MEME code avec deux
 * fenetres, au lieu d'ecrire deux algorithmes qui finissent par diverger.
 *
 * Ne comptent pas : les seances planifiees non faites, et les charges
 * club/match — y compris auto-injectees. Une seance FKS est une seance FKS.
 */
export function compterSeancesFksSurJours(
  seances: readonly SeanceDatee[],
  jours: Iterable<string>
): number {
  const ensemble = jours instanceof Set ? jours : new Set(jours);
  if (ensemble.size === 0) return 0;
  let total = 0;
  for (const s of seances) {
    if (!estSeanceFksTerminee(s)) continue;
    const cle = toDateKey(s.dateISO ?? s.date);
    if (cle && ensemble.has(cle)) total += 1;
  }
  return total;
}

// =============================================================================
// 3. LA SEMAINE — UNE SEULE CIBLE
// =============================================================================

/**
 * L'objectif hebdomadaire du joueur, resolu une fois pour toutes.
 *
 * ORDRE, ET IL EST MOTIVE :
 *   1. `targetFksSessionsPerWeek` — le rythme que le joueur a DECLARE au setup
 *      profil. C'est la seule des deux valeurs qu'il a lui-meme donnee.
 *   2. `weeklyGoal` — le reglage modifiable dans les Parametres.
 *   3. `null` — non declare. PAS « 2 ».
 *
 * Le `?? 2` du Home actuel (`HomeScreen.tsx`) est le defaut P1.10 de l'audit :
 * une valeur inventee qui ecrase le declare et qui affiche « 0 sur 2 » a un
 * joueur qui n'a jamais dit vouloir deux seances. `null` remonte donc jusqu'a
 * l'ecran, a charge pour lui de ne rien afficher plutot que d'inventer.
 *
 * Zero et negatif sont traites comme « non declare » : un objectif de zero
 * seance n'est pas un objectif, c'est un champ vide.
 */
export function resoudreObjectifHebdo(entree: {
  targetFksSessionsPerWeek: number | null | undefined;
  weeklyGoalReglage: number | null | undefined;
}): number | null {
  const candidats = [entree.targetFksSessionsPerWeek, entree.weeklyGoalReglage];
  for (const brut of candidats) {
    if (typeof brut !== "number" || !Number.isFinite(brut)) continue;
    const n = Math.trunc(brut);
    if (n > 0) return n;
  }
  return null;
}

// =============================================================================
// 4. LES JOURS OBSERVES — LA CHARGE REELLEMENT ENREGISTREE
// =============================================================================

/**
 * `true` si cette charge externe a ete SAISIE par le joueur, `false` si elle a
 * ete injectee automatiquement d'apres le rythme club/match du profil.
 *
 * Le marquage existe deja et n'a pas eu besoin d'etre cree :
 * `state/orchestrators/applyExternalLoad.ts` ecrit les charges automatiques avec
 * `id = "auto_<source>_<jour>"`, les saisies manuelles passant par `genId()`
 * (`screens/ExternalLoadScreen.tsx`).
 */
export function estChargeExterneManuelle(charge: ChargeExterneDatee): boolean {
  const id = typeof charge?.id === "string" ? charge.id : "";
  return id.length > 0 && !id.startsWith("auto_");
}

/**
 * Nombre de JOURS DISTINCTS, dans la fenetre demandee, ou une charge reelle a
 * ete enregistree.
 *
 * C'est le compte qui autorise (ou interdit) la courbe de forme : sept points
 * adosses a zero jour observe ne sont que la decroissance des constantes
 * d'amorcage ATL0/CTL0 — une courbe qui ne parle que d'elle-meme.
 *
 * DEUX SOURCES, ET SEULEMENT DEUX :
 *   - les seances FKS terminees ;
 *   - les charges externes MANUELLES.
 *
 * Les charges club/match auto-injectees sont exclues DELIBEREMENT : elles sont
 * deduites du rythme declare au profil, pas d'un fait constate. Les compter
 * ferait « observer » des jours ou l'app n'a rien vu du tout, ce qui suffirait a
 * debloquer une courbe sur un compte qui n'a jamais rien enregistre.
 *
 * `dailyApplied` n'est pas utilisable ici : c'est un `Record<jour, number>` sans
 * distinction de source, ou l'auto et le reel sont deja melanges.
 */
export function compterJoursObserves(entree: {
  nowISO: string;
  fenetreJours?: number;
  seances: readonly SeanceDatee[];
  chargesExternes: readonly ChargeExterneDatee[];
}): number {
  const fenetre = Math.max(1, Math.trunc(entree.fenetreJours ?? FENETRES_RESUME.charge.jours));
  const fin = new Date(entree.nowISO);
  if (Number.isNaN(fin.getTime())) return 0;

  const joursAutorises = new Set<string>();
  const curseur = new Date(fin);
  curseur.setHours(12, 0, 0, 0);
  for (let i = 0; i < fenetre; i++) {
    joursAutorises.add(toDateKey(curseur));
    curseur.setDate(curseur.getDate() - 1);
  }

  const observes = new Set<string>();
  for (const s of entree.seances) {
    if (!estSeanceFksTerminee(s)) continue;
    const cle = toDateKey(s.dateISO ?? s.date);
    if (cle && joursAutorises.has(cle)) observes.add(cle);
  }
  for (const c of entree.chargesExternes) {
    if (!estChargeExterneManuelle(c)) continue;
    const cle = toDateKey(c.dateISO);
    if (cle && joursAutorises.has(cle)) observes.add(cle);
  }
  return observes.size;
}

// =============================================================================
// 5. LE RESUME HEBDO, ASSEMBLE
// =============================================================================

export type ResumeHebdo = {
  /** Seances FKS terminees cette semaine. Jamais borne a l'objectif. */
  faites: number;
  /** Objectif declare. `null` = non declare : l'ecran n'affiche pas de fraction. */
  objectif: number | null;
  /** Fenetre utilisee, pour que l'ecran puisse la nommer. */
  jours: readonly string[];
};

/**
 * Le compteur hebdomadaire, d'un bloc : meme numerateur et meme cible pour tous
 * les ecrans qui l'affichent.
 */
export function construireResumeHebdo(entree: {
  nowISO: string;
  debutDeSemaine: DebutDeSemaine;
  seances: readonly SeanceDatee[];
  targetFksSessionsPerWeek: number | null | undefined;
  weeklyGoalReglage: number | null | undefined;
}): ResumeHebdo {
  const jours = joursDeLaSemaine(entree.nowISO, entree.debutDeSemaine);
  return {
    faites: compterSeancesFksSurJours(entree.seances, jours),
    objectif: resoudreObjectifHebdo({
      targetFksSessionsPerWeek: entree.targetFksSessionsPerWeek,
      weeklyGoalReglage: entree.weeklyGoalReglage,
    }),
    jours,
  };
}
