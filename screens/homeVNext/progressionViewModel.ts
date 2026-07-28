// screens/homeVNext/progressionViewModel.ts
// =============================================================================
// PROTOTYPE Home vNext — VARIANTE 2 : LE RESUME DE PROGRESSION
// =============================================================================
//
// Ce fichier est la SOURCE CANONIQUE du resume de progression. Il est ecrit pour
// devenir un jour la source PARTAGEE du Home et de la page Progression — mais il
// ne refond PAS `screens/ProgressScreen.tsx` aujourd'hui. Il vit a cote, propre,
// concu pour l'absorber plus tard.
//
// Il ne contient AUCUN composant, AUCUN rendu, AUCUN acces store, AUCUNE horloge.
// `buildProgressionViewModel` est une fonction PURE.
//
// -----------------------------------------------------------------------------
// LA DOCTRINE, ENCODEE DANS LES TYPES
// -----------------------------------------------------------------------------
// R1  Aucun defaut artificiel      -> les faits sont une LISTE : un fait inconnu
//                                     n'y entre pas. Il n'existe aucun champ
//                                     "valeur par defaut", aucun "--", aucun 0
//                                     de remplissage.
// R2  Chiffres reellement mesures  -> chaque fait est calcule depuis un champ
//                                     structure de l'entree. Aucune estimation,
//                                     aucune division commode.
// R3  Portee obligatoire           -> `ProgressionCourbe.portee` est un `string`
//                                     NON nullable : une courbe sans sa portee
//                                     est impossible a construire.
// R4  AUCUN etat global, point.    -> DECISION DU FONDATEUR (D1, 2026-07-28) :
//                                     plus aucun jugement global sur la forme du
//                                     joueur dans cette carte. Il n'existe plus
//                                     ni champ d'entree pour en fournir un
//                                     (`libelleEtatGlobal` a ete SUPPRIME), ni
//                                     champ de sortie pour en porter un
//                                     (`etatGlobal` a ete SUPPRIME). Ce n'est
//                                     donc plus un verrou conditionnel qu'un
//                                     booleen pourrait rouvrir : « En forme » ou
//                                     « Pret a performer » n'a plus aucun chemin
//                                     jusqu'a l'ecran. Voir §2 bis.
// R5  Courbe = vrais points        -> `courbe` est type `null` (litteral) dans
//                                     les etats "empty" et "collecting" : un
//                                     graphique y est impossible a rendre.
// R6  "Serie"/"streak" banni       -> aucun champ, aucun libelle, aucun compteur
//                                     de jours consecutifs n'existe ici.
// R7  Pas de doublon avec la semaine -> tout fait dont le NOMBRE est celui que
//                                     "Ma semaine" affiche deja est retire, et
//                                     la carte change de fait affiche.
// R8  Un seul aplat par ecran      -> `detail.emphasis` vaut le litteral
//                                     "lien_secondaire" et rien d'autre : un
//                                     deuxieme aplat colore est impossible.
// R9  Le repere de test n'est       -> la fonction qui choisit LE test affiche ne
//     JAMAIS choisi sur le             recoit que `{ champ, apresTs }`
//     resultat                         (`ProgressionCandidatRepere`). Ni l'ecart,
//                                      ni son signe, ni son sens ne sont dans son
//                                      type d'entree : trier par "meilleure
//                                      progression" est impossible a ecrire sans
//                                      changer la signature. Voir §5 bis.
//
// -----------------------------------------------------------------------------
// CE QUE L'ON NE REPREND PAS DE `screens/ProgressScreen.tsx`
// -----------------------------------------------------------------------------
// Releve fait en lisant le fichier, pour le jour de la fusion :
//
//   1. LES AMORCES ATL0 / CTL0
//      ProgressScreen.tsx:251-252 — `let atlSeed = TRAINING_DEFAULTS.ATL0;`
//      `let ctlSeed = TRAINING_DEFAULTS.CTL0;` puis 45 jours de chauffe
//      (:246-273). Sur un compte sans charge enregistree, la totalite de la
//      courbe EST la decroissance de ces deux constantes. Le hero (:467-479)
//      lit `getFootballLabel(tsb)` issu de la meme mecanique.
//      -> Ici : aucune amorce. Les points viennent de l'entree, et on exige en
//         plus `joursObserves` (des jours de charge REELLEMENT enregistree).
//
//   2. UNE COURBE POTENTIELLEMENT ARTIFICIELLE
//      ProgressScreen.tsx:257 — `const load = Number(dailyApplied[key] ?? 0) || 0;`
//      Un jour sans donnee devient un jour a charge zero, donc un point trace.
//      Et la legende (:547-549) dit "Ta forme sur 30 jours" sans jamais dire sur
//      QUOI c'est calcule.
//      -> Ici : un jour sans donnee n'est pas un point (R5), et `portee` est
//         obligatoire (R3).
//
//   3. TROIS NOTIONS DE "JOURS CONSECUTIFS" QUI COHABITENT
//      `globalMaxStreak` (:333-348, tous jours confondus, seances + charges
//      externes), `maxStreakThisMonth` (:350-365, borne au mois courant), et le
//      palier `streak_7` (:88-94) qui consomme la premiere pendant que la carte
//      "Stats du mois" (:736-739) affiche la seconde sous le meme mot. Deux
//      chiffres differents, un seul mot.
//      -> Ici : la metrique n'existe pas du tout (R6).
//
//   4. LE NOMBRE DE CYCLES ESTIME PAR UNE DIVISION
//      ProgressScreen.tsx:400 — `const estimatedCycles = Math.floor(completedSessions.length / 12);`
//      Le commentaire de la ligne 399 l'admet : "Proxy". 12 seances faites hors
//      cycle affichent "Cycle termine".
//      -> Ici : aucun compteur de cycles. Rien ne le mesure, donc rien ne le dit.
//
//   5. DES ACCOMPLISSEMENTS DE FIABILITE INEGALE
//      `computeMilestones` (:56-112) melange du mesure ("Premiere seance"), du
//      derive douteux ("Cycle termine" via la division ci-dessus) et du
//      contradictoire ("7 jours d'affilee"). Sur un compte neuf, les SIX sont
//      verrouilles (:553-599) : "0 / 1", "0 / 10", "0 / 50", "0 / 7", "0 / 1",
//      "0 / 30".
//      -> Ici : aucun palier. Des faits, ou rien.
//
//   6. DES PLACEHOLDERS "—" A LA PLACE DE L'ABSENCE
//      ProgressScreen.tsx:724-734 — `{avgRpe ? ... : "—"}`, `{avgDuration ? ... : "—"}`.
//      -> Ici : R1. Le fait disparait, il n'est pas remplace par un tiret.
//
//   7. LA LECTURE DES TESTS QUI CONTOURNE LA NORMALISATION
//      ProgressScreen.tsx:226-236 fait `JSON.parse(readTestsRaw())` brut, alors
//      que `useTestsStorage` (screens/tests/hooks/useTestsStorage.ts) valide le
//      `ts`, recanonicalise la playlist, trie et borne a 30 entrees.
//      -> Ici : l'entree recoit des `TestEntry` deja normalises (charge de
//         l'appelant, documentee sur le champ).
//
//   8. UNE LISTE DE CHAMPS DE TESTS DUPLIQUEE ET AMPUTEE
//      ProgressScreen.tsx:144-160 redeclare `TEST_FIELDS` a la main : 9 champs
//      alors que `FIELD_DEFS` en compte 17. Manquent `tripleJumpCm`,
//      `lateralBoundCm`, `tTest_s`, `test505_s`, `gobletReps`, `splitKg`,
//      `splitReps`, `trapbar3rmKg`. Un joueur qui ameliore son T-test ne voit
//      rien. Le type `TestEntry` y est lui aussi redeclare (:115-130), avec un
//      `[key: string]: any` qui desactive toute verification.
//      -> Ici : on IMPORTE `FIELD_DEFS` / `TestEntry` / `FieldKey` depuis
//         `screens/tests/testConfig.ts`, la source canonique.
//
//   9. UNE COMPARAISON QUI NE VERIFIE PAS LES DATES
//      `computeTestComparisons` (:169-203) prend les deux valeurs les plus
//      recentes d'un champ sans jamais verifier qu'elles viennent de deux JOURS
//      differents : deux saisies du meme jour produisent une "progression".
//      Et un ecart de exactement 0 tombe dans `improved: false` (:189), donc
//      s'affiche en rouge avec une fleche descendante (:645-647).
//      -> Ici : deux jours distincts exiges, et un `sens` a trois valeurs
//         ("amelioration" / "regression" / "identique") au lieu d'un booleen.
//
// -----------------------------------------------------------------------------
// Statut : PROTOTYPE destine a etre regarde et valide.
// `screens/ProgressScreen.tsx` et `screens/HomeScreen.tsx` ne sont pas touches.
// =============================================================================

import { MICROCYCLES, type MicrocycleId } from "../../domain/microcycles";
import {
  CORE_FIELD_KEYS,
  FIELD_BY_KEY,
  FIELD_DEFS,
  type FieldKey,
  type TestEntry,
} from "../tests/testConfig";
import {
  formatStatValue,
  formatStatValueForField,
  shouldHideUnitSuffix,
} from "../tests/testHelpers";
import { POINTS_MIN_POUR_COURBE, SEANCES_MIN_POUR_TENDANCE } from "./viewModel";

// =============================================================================
// 1. SEUILS D'AFFICHAGE
// =============================================================================
// AUCUN de ces seuils n'est une regle sportive : aucun ne modifie une seance,
// une charge, une intensite ou une prescription. Ils decident uniquement de ce
// que la carte a le droit de MONTRER quand la donnee est maigre.
//
// SEUILS D'AFFICHAGE DU PROTOTYPE — A VALIDER PAR LE FONDATEUR.
// =============================================================================

/**
 * Seances FKS **reellement terminees** requises avant de passer de l'etat
 * "collecting" a l'etat "ready" (donc avant d'afficher une courbe).
 *
 * Volontairement REPRIS de `SEANCES_MIN_POUR_TENDANCE` (viewModel.ts) plutot que
 * redefini : le bloc "Ma forme" et cette carte vivent sur le meme ecran. Deux
 * seuils differents produiraient un ecran qui se contredit lui-meme — exactement
 * le defaut que le prototype corrige.
 *
 * SEUIL D'AFFICHAGE — A VALIDER PAR LE FONDATEUR.
 */
export const PROGRESSION_SEANCES_MIN_POUR_TENDANCE = SEANCES_MIN_POUR_TENDANCE;

/**
 * Points requis pour tracer la courbe. Repris de `POINTS_MIN_POUR_COURBE`
 * (viewModel.ts), meme raison : une seule verite par chiffre sur un ecran.
 *
 * SEUIL D'AFFICHAGE — A VALIDER PAR LE FONDATEUR.
 */
export const PROGRESSION_POINTS_MIN_POUR_COURBE = POINTS_MIN_POUR_COURBE;

/**
 * Jours ayant vu une charge REELLEMENT enregistree, requis en plus du nombre de
 * points. Deux comptes distincts, exiges tous les deux (R5) : sept points
 * adosses a zero jour observe ne dessinent pas un joueur, ils dessinent la
 * decroissance d'une constante d'amorcage.
 *
 * SEUIL D'AFFICHAGE — A VALIDER PAR LE FONDATEUR.
 */
export const PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE = POINTS_MIN_POUR_COURBE;

/**
 * Nombre de JOURS DISTINCTS portant une valeur d'un meme champ de test, requis
 * pour qu'une comparaison avant/apres existe.
 *
 * Deux, et pas deux entrees : deux saisies du meme jour ne sont pas une
 * progression (defaut 9 releve dans l'en-tete de ce fichier).
 *
 * SEUIL D'AFFICHAGE — A VALIDER PAR LE FONDATEUR.
 */
export const PROGRESSION_TESTS_MIN_JOURS_PAR_CHAMP = 2;

/** Toutes les constantes ci-dessus, pour affichage par le visualiseur. */
export const PROGRESSION_SEUILS = [
  {
    nom: "PROGRESSION_SEANCES_MIN_POUR_TENDANCE",
    valeur: PROGRESSION_SEANCES_MIN_POUR_TENDANCE,
    role: "Seances terminees requises pour passer de 'collecting' a 'ready'.",
  },
  {
    nom: "PROGRESSION_POINTS_MIN_POUR_COURBE",
    valeur: PROGRESSION_POINTS_MIN_POUR_COURBE,
    role: "Points fournis requis pour tracer la courbe.",
  },
  {
    nom: "PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE",
    valeur: PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE,
    role: "Jours de charge reellement enregistree requis, en plus des points.",
  },
  {
    nom: "PROGRESSION_TESTS_MIN_JOURS_PAR_CHAMP",
    valeur: PROGRESSION_TESTS_MIN_JOURS_PAR_CHAMP,
    role: "Jours distincts portant un meme champ de test, requis pour comparer.",
  },
] as const;

// =============================================================================
// 2. ENTREE — `ProgressionInput`
// =============================================================================
// Chaque champ est tracable a une source reelle de l'app. Quand une source
// n'existe pas encore, c'est ecrit noir sur blanc : PAS ENCORE BRANCHE.
// =============================================================================

/**
 * Une seance FKS **reellement terminee**.
 *
 * `dureeMin` et `ressentiEnregistre` sont DEUX informations distinctes : une
 * seance peut etre terminee avec un ressenti mais sans duree (le joueur a rempli
 * son retour sans chronometre), ou l'inverse. Les melanger produirait exactement
 * le genre de chiffre commode que R2 interdit.
 */
export type ProgressionSeanceTerminee = {
  /** SOURCE : `Session.id` (`state/stores/useSessionsStore.ts`). */
  id: string;
  /**
   * Jour local "YYYY-MM-DD".
   * SOURCE : `toDateKey(session.dateISO ?? session.date)` (`utils/dateHelpers.ts`).
   */
  dateKey: string;
  /**
   * Duree REELLE de la seance, en minutes.
   * SOURCE : `getSessionDuration(session)` (`utils/sessionHelpers.ts`), qui lit
   * `session.feedback.durationMin ?? session.durationMin`.
   * `null` = duree INCONNUE. Jamais 0, jamais la duree prescrite a la place de
   * la duree realisee (R1 + R2).
   */
  dureeMin: number | null;
  /**
   * `true` si le joueur a REELLEMENT enregistre un retour sur cette seance.
   * SOURCE : `Boolean(session.feedback)` (`utils/sessionHelpers.ts`,
   * `isSessionCompleted` lit `session.completed || session.feedback` — ici on ne
   * veut QUE la seconde moitie, sinon on compterait comme "ressenti" une seance
   * simplement marquee terminee).
   */
  ressentiEnregistre: boolean;
};

/** Un point de trajectoire REELLEMENT observe. */
export type ProgressionPointTendance = {
  /** Jour local "YYYY-MM-DD". */
  dateKey: string;
  /**
   * Indice relatif, echelle interne. N'est JAMAIS affiche comme un chiffre au
   * joueur : sert uniquement a dessiner la trajectoire.
   */
  value: number;
};

/**
 * La trajectoire fournie a la carte.
 *
 * `null` en entree = l'appelant n'a AUCUNE trajectoire a proposer. Ce n'est pas
 * la meme chose qu'une trajectoire vide : `null` dit "je n'ai rien calcule",
 * `points: []` dirait "j'ai calcule, et il n'y a rien".
 */
export type ProgressionTendanceInput = {
  /**
   * SOURCE (a construire) : la MEME serie de valeurs que celle qui alimente le
   * bloc "Ma forme" du Home (`HomeVNextInput.formTrend.points`). Un seul calcul
   * pour les deux blocs — sinon l'ecran affiche deux courbes qui ne racontent
   * pas la meme chose.
   * Aucun point d'amorcage, aucun jour bouche a zero.
   */
  points: readonly ProgressionPointTendance[];
  /**
   * Nombre de jours DISTINCTS ou une charge reelle a ete enregistree.
   * SOURCE : cles de `useLoadStore.dailyApplied` alimentees par un retour de
   * seance ou une charge externe saisie a la main — jamais par une injection
   * automatique club/match (`applyAutoExternalLoads`).
   */
  joursObserves: number;
};

/**
 * Ce que le bloc "Ma semaine" affiche deja, a cet instant, sur le meme ecran.
 * Sert uniquement a appliquer R7 sans rien deviner.
 */
export type ProgressionSemaineCourante = {
  /**
   * `true` uniquement si le bloc "Ma semaine" est REELLEMENT rendu.
   * SOURCE : `buildHomeVNextViewModel(input).week !== null` (`./viewModel`).
   * S'il ne l'est pas, aucun doublon n'est possible et le garde-fou ne s'applique pas.
   */
  blocAffiche: boolean;
  /**
   * Le nombre que "Ma semaine" affiche.
   * SOURCE : `buildHomeVNextViewModel(input).week?.doneCount`.
   * Ignore quand `blocAffiche` est faux.
   */
  seancesAffichees: number;
};

// =============================================================================
// 2 bis. R4 — CE QUI A ETE RETIRE, ET POURQUOI IL NE PEUT PAS REVENIR
// =============================================================================
//
// DECISION DU FONDATEUR (D1, 2026-07-28), mot pour mot :
//   « La pastille d'etat global est RETIREE COMPLETEMENT de la variante
//     "Progression integree". Aucun de ces libelles, ni aucun autre jugement
//     global : "En forme", "Frais", "Pret a performer", "Un peu charge",
//     "Charge moderee".
//     Motif : le modele de charge utilise encore des valeurs initiales
//     artificielles et ne connait pas les entrainements club. Une pastille
//     "Charge FKS" ne pourra revenir que le jour ou son calcul reposera sur des
//     donnees entierement reelles avec une portee expliquee. »
//
// CE QUI EXISTAIT AVANT, ET QUI A DISPARU DU FICHIER :
//   - le type d'entree `ProgressionChargesGlobales`, une union dont la branche
//     `chargesClubCapturees: true` portait un champ `libelleEtatGlobal` ;
//   - le type de sortie `ProgressionEtatGlobal` et le champ `etatGlobal`, present
//     dans les trois etats du ViewModel.
//
// POURQUOI LA SUPPRESSION PLUTOT QUE LE VERROU. L'ancien montage etait un verrou
// CONDITIONNEL : passer `chargesClubCapturees: true` avec un libelle suffisait a
// faire ressortir « En forme ». C'etait defendable tant que la question etait
// « les charges club sont-elles connues ? ». Ce n'est plus la question : le
// fondateur constate que le modele de charge lui-meme part de valeurs initiales
// artificielles (ATL0 / CTL0), donc qu'AUCUN booleen d'entree ne peut rendre ce
// libelle honnete aujourd'hui. Un verrou qu'un drapeau rouvre serait un libelle
// interdit a une ligne de distance. Le champ est donc parti, des deux cotes.
//
// CE QUI RESTE, ET QUI N'EST PAS UN JUGEMENT : `chargesClubCapturees` reste un
// champ d'entree ORDINAIRE (un booleen, sans libelle associe). Il ne sert plus
// qu'a UNE chose : ecrire la PORTEE exacte de la courbe (R3) — « Calcule sur tes
// seances FKS uniquement — tes entrainements club n'y sont pas comptes. ». Dire
// ce qu'une mesure contient n'est pas porter un jugement sur un joueur ; c'est
// meme l'inverse, et c'est la condition posee par le fondateur pour qu'une
// mesure ait le droit d'etre affichee.
// =============================================================================

/** Tout ce que la carte recoit. */
export type ProgressionInput = {
  /**
   * Les entrainements club REELLEMENT REALISES sont-ils captures ?
   *
   * `false` est l'etat reel de l'app aujourd'hui, et PAS ENCORE BRANCHE : rien
   * ne capture les seances club faites. `useExternalStore.clubDays` ne fait
   * qu'injecter une charge SUPPOSEE a partir de cases cochees au setup profil
   * (`applyAutoExternalLoads`), ce qui n'est pas une mesure.
   *
   * SEUL EFFET DE CE CHAMP : la phrase de portee de la courbe (R3). Il ne peut
   * plus produire, ni autoriser, le moindre libelle d'etat (§2 bis).
   */
  chargesClubCapturees: boolean;
  /**
   * Seances FKS **reellement terminees**, du plus ancien au plus recent.
   * SOURCE : `useSessionsStore.sessions` filtre par `isSessionCompleted`
   * (`utils/sessionHelpers.ts`). Ni les seances planifiees, ni les charges
   * club/match auto-injectees n'entrent ici.
   */
  seancesTerminees: readonly ProgressionSeanceTerminee[];
  /**
   * Entrees de tests terrain, VRAI type canonique.
   * SOURCE : `useTestsStorage()` (`screens/tests/hooks/useTestsStorage.ts`), qui
   * valide le `ts`, recanonicalise la playlist, trie desc et borne a 30 entrees.
   * NE PAS passer le resultat brut de `readTestsRaw()` : c'est ce que fait
   * `ProgressScreen` (:226-236) et cela contourne toute la normalisation.
   */
  testsTerrain: readonly TestEntry[];
  /**
   * Cycle ACTUELLEMENT actif, deja canonicalise.
   * SOURCE : `canonicalizeMicrocycleGoal(useSessionsStore.microcycleGoal)`
   * (`domain/microcycles.ts`) — exactement le champ que le Home lit deja
   * (`HomeVNextInput.microcycleGoal`, `./viewModel`). Un seul cycle actif a la
   * fois (regle produit n5, CLAUDE.md). `null` = aucun cycle choisi.
   *
   * A NE PAS CONFONDRE avec `TestEntry.playlist`, qui note quel cycle etait actif
   * AU MOMENT du test : celui-la est une PROVENANCE (un tag d'historique), il ne
   * selectionne rien. La regle 1 (§5 bis) lit CE champ-ci, jamais celui-la.
   */
  microcycleGoal: MicrocycleId | null;
  /** Trajectoire fournie. `null` = rien de calcule. */
  tendance: ProgressionTendanceInput | null;
  /** Ce que "Ma semaine" affiche deja sur le meme ecran (R7). */
  semaineCourante: ProgressionSemaineCourante;
};

/**
 * @deprecated Alias de `ProgressionInput`, conserve le temps que le visualiseur
 * et les scripts du prototype suivent. Le decoupage `Base` + variante n'a plus
 * lieu d'etre : il n'existait que pour porter la contrainte R4 dans le type, et
 * R4 est desormais tenue par l'ABSENCE du champ (§2 bis).
 */
export type ProgressionInputBase = ProgressionInput;

// =============================================================================
// 3. SORTIE — `ProgressionViewModel`
// =============================================================================

/**
 * Un fait REELLEMENT MESURE, pret a etre affiche tel quel.
 *
 * Exactement trois champs : le composant n'a AUCUNE logique a faire. Il affiche
 * `valeur` en gros, `libelle` en petit, et `cle` ne lui sert qu'a poser une
 * icone ou un `testID`. Il n'y a pas de champ optionnel a tester, pas de nombre
 * a formater, pas de pluriel a accorder.
 *
 * Un fait dont la donnee est inconnue N'EST PAS DANS LA LISTE (R1).
 */
export type ProgressionFait = {
  cle: ProgressionFaitCle;
  /** Ce que le chiffre mesure. Ex : "Minutes realisees". */
  libelle: string;
  /** Le chiffre, deja formate et accorde. Ex : "76 min". */
  valeur: string;
};

/** Union FERMEE : rien d'autre ne peut devenir un fait de cette carte. */
export type ProgressionFaitCle =
  /** Cumul de seances FKS terminees, depuis toujours. */
  | "seances_terminees"
  /** Cumul des minutes REELLEMENT connues. */
  | "minutes_realisees"
  /** Cumul des retours de seance enregistres par le joueur. */
  | "ressentis_enregistres"
  /** Jours distincts ayant vu au moins une seance terminee. */
  | "jours_actifs"
  /** Ce qui manque avant qu'une tendance soit affichable. Calcule depuis le seuil. */
  | "avant_tendance";

/**
 * Sens d'une comparaison de test.
 *
 * Trois valeurs, pas un booleen : `ProgressScreen` (:189) fait tomber l'ecart
 * exactement nul dans "pas ameliore", donc l'affiche en rouge avec une fleche
 * descendante. Une valeur identique n'est pas une regression.
 */
export type ProgressionSensTest = "amelioration" | "regression" | "identique";

/** Une comparaison avant/apres REELLEMENT possible sur un champ de test. */
export type ProgressionComparaisonTest = {
  /** Cle canonique (`screens/tests/testConfig.ts`). */
  champ: FieldKey;
  /** Libelle canonique, deja en FR (`FIELD_DEFS[].label`). */
  label: string;
  /** Unite canonique (`FIELD_DEFS[].unit`). Chaine vide pour les repetitions. */
  unite: string;
  /** `FIELD_DEFS[].lowerIsBetter` — sur un sprint, mieux = plus petit. */
  plusPetitEstMieux: boolean;
  /** Valeur brute la plus ancienne des deux. */
  avant: number;
  /** Valeur brute la plus recente des deux. */
  apres: number;
  /** `apres - avant`, brut. Le SIGNE ne dit pas le sens : c'est `sens` qui le dit. */
  ecart: number;
  /** Jour "YYYY-MM-DD" (UTC) de la valeur `avant`. */
  avantJour: string;
  /** Jour "YYYY-MM-DD" (UTC) de la valeur `apres`. */
  apresJour: string;
  /** Horodatage de la valeur `apres` — sert a ordonner les comparaisons. */
  apresTs: number;
  /** Prete a afficher, mm:ss pour le 1 km, unite suffixee sinon. */
  avantAffiche: string;
  /** Idem. */
  apresAffiche: string;
  /** Ecart signe, deja formate. Ex : "-0.13 s", "+9 cm", "12 s". */
  ecartAffiche: string;
  sens: ProgressionSensTest;
};

/** Pourquoi aucune comparaison n'est possible. Union fermee. */
export type ProgressionComparaisonImpossible =
  /** Le joueur n'a jamais enregistre le moindre test. */
  | "aucun_test_enregistre"
  /** Une seule entree de test : rien a comparer, par definition. */
  | "un_seul_test_enregistre"
  /**
   * Plusieurs entrees, mais aucun champ ne porte deux valeurs a deux JOURS
   * differents. Couvre aussi le cas de deux saisies du meme jour.
   */
  | "aucune_paire_comparable";

/**
 * Comparaison de tests : reellement possible, ou impossible AVEC SA RAISON.
 * Union discriminee -> le composant ne peut pas afficher une comparaison vide.
 */
export type ProgressionComparaisonsTests =
  | { possible: true; comparaisons: readonly ProgressionComparaisonTest[] }
  | {
      possible: false;
      raison: ProgressionComparaisonImpossible;
      /** Phrase honnete, affichable telle quelle. Jamais un reproche. */
      explication: string;
    };

/** Pourquoi la tendance n'est pas affichable. Union fermee. */
export type ProgressionTendanceIndisponible = {
  raison:
    /** Pas encore assez de seances terminees. */
    | "pas_assez_de_seances"
    /** Assez de seances, mais pas assez de jours de charge reellement enregistree. */
    | "pas_assez_de_jours_observes"
    /** L'appelant n'a fourni aucune trajectoire (ou pas assez de points). */
    | "aucun_point_fourni";
  /** Ce qui manque, en clair. Jamais un reproche. */
  explication: string;
  /**
   * Combien il manque, sur le compte qui bloque. `null` quand il n'y a rien de
   * quantifiable a annoncer (aucune trajectoire fournie : on ne sait pas combien
   * de jours seront observes).
   */
  manque: number | null;
};

/**
 * La courbe. `portee` est un `string` NON nullable : impossible de construire
 * une courbe sans dire sur quoi elle est calculee (R3).
 */
export type ProgressionCourbe = {
  /** Uniquement de vrais points observes, dans l'ordre chronologique (R5). */
  points: readonly number[];
  /**
   * PORTEE EXACTE de la mesure. Champ obligatoire. Interdit de faire passer une
   * tendance calculee sur les seules seances FKS pour l'etat physique global du
   * joueur (R3).
   */
  portee: string;
  /** Periode couverte, deduite des points. Ex : "7 derniers jours". */
  periodeLabel: string;
  /** Jours de charge reellement enregistree derriere ces points. */
  joursObserves: number;
};

/**
 * Le pied de carte qui mene a l'ecran Progression (« Voir ma progression »). La
 * decision d'affichage est prise ICI, dans le ViewModel, jamais dans le
 * composant, et le libelle exact vient de `LIBELLE_DETAIL` (§7).
 *
 * `emphasis` est le litteral "lien_secondaire" et rien d'autre : un deuxieme
 * aplat colore sur l'ecran est impossible a produire (R8).
 */
export type ProgressionDetail = {
  /** `true` = le lien a le droit d'exister dans cet etat. */
  affiche: boolean;
  /** Libelle exact. `null` quand `affiche` vaut `false`. */
  label: string | null;
  /** Destination. `null` quand `affiche` vaut `false`. */
  target: "progression" | null;
  /** Fige. Jamais un aplat, jamais un bouton plein (R8). */
  emphasis: "lien_secondaire";
  /** Le verdict et sa raison, dans les DEUX sens. Toujours renseigne. */
  motif: string;
  /**
   * Ce que la destination affiche encore de faux MEME quand on y envoie le
   * joueur. `null` quand il n'y a rien a signaler (donc quand `affiche` est
   * faux : on n'y envoie personne).
   */
  reserve: string | null;
};

/** Un repere numerote de l'etat vide. */
export type ProgressionRepere = {
  numero: 1 | 2 | 3;
  texte: string;
};

/**
 * Ce que la carte affiche. Union discriminee sur `state`.
 *
 * `courbe: null` est un type LITTERAL dans "empty" et "collecting" : un
 * graphique y est impossible a rendre (R5).
 *
 * AUCUN DES TROIS ETATS NE PORTE D'ETAT PHYSIQUE GLOBAL (§2 bis) : le champ
 * `etatGlobal` a ete supprime. La carte peut dire ce qu'elle a mesure ; elle ne
 * peut plus dire dans quel etat est le joueur.
 */
export type ProgressionViewModel =
  | {
      state: "empty";
      titre: string;
      reperes: readonly ProgressionRepere[];
      /** Mention honnete de l'absence de donnees. */
      mention: string;
      courbe: null;
      detail: ProgressionDetail;
      protoWarnings: readonly string[];
    }
  | {
      state: "collecting";
      titre: string;
      /** Faits reellement mesures. Un fait inconnu n'y est pas (R1). */
      faits: readonly ProgressionFait[];
      courbe: null;
      tendanceIndisponible: ProgressionTendanceIndisponible;
      comparaisonsTests: ProgressionComparaisonsTests;
      /** LE repere affiche, designe par la regle du §5 bis. `null` = aucun. */
      repereTest: ProgressionRepereTest | null;
      detail: ProgressionDetail;
      protoWarnings: readonly string[];
    }
  | {
      state: "ready";
      titre: string;
      courbe: ProgressionCourbe;
      /** UN fait complementaire reel, choisi pour ne pas doubler "Ma semaine" (R7). */
      resume: ProgressionFait;
      comparaisonsTests: ProgressionComparaisonsTests;
      /** LE repere affiche, designe par la regle du §5 bis. `null` = aucun. */
      repereTest: ProgressionRepereTest | null;
      detail: ProgressionDetail;
      protoWarnings: readonly string[];
    };

/** Les trois etats possibles, pour le visualiseur et les tests. */
export type ProgressionState = ProgressionViewModel["state"];

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

/**
 * Jour "YYYY-MM-DD" d'un horodatage de test.
 *
 * UTC volontairement, et non `toDateKey` (qui est LOCAL) : les captures du
 * prototype doivent etre identiques sur n'importe quelle machine. Au branchement
 * reel, la question "jour local ou jour UTC pour un test terrain" devra etre
 * tranchee avec le fondateur — un test fait a 23 h ne doit pas basculer au
 * lendemain. C'est signale dans `protoWarnings`.
 */
function jourDeTest(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** "1 seance" / "2 seances" — accord fait ici, pas dans le composant. */
function accord(n: number, singulier: string, pluriel: string): string {
  return n > 1 ? pluriel : singulier;
}

/** Lit une valeur numerique exploitable d'une entree de test. `null` sinon. */
function lireValeurChamp(entry: TestEntry, champ: FieldKey): number | null {
  const brut = (entry as Record<string, unknown>)[champ];
  if (brut === undefined || brut === null || brut === "") return null;
  const n = Number(brut);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Valeur d'un test, telle qu'elle sera lue (mm:ss pour le 1 km, unite sinon). */
function afficherValeurTest(champ: FieldKey, valeur: number): string {
  const corps = formatStatValueForField(champ, valeur);
  if (shouldHideUnitSuffix(champ)) return corps;
  const unite = FIELD_BY_KEY[champ]?.unit ?? "";
  return unite ? `${corps} ${unite}` : corps;
}

/**
 * Ecart signe, deja formate.
 * Le 1 km est stocke en secondes mais lu en mm:ss : son ECART, lui, reste plus
 * clair en secondes entieres ("-12 s") qu'en mm:ss.
 */
function afficherEcartTest(champ: FieldKey, ecart: number): string {
  const unite = FIELD_BY_KEY[champ]?.unit ?? "";
  const abs = Math.abs(ecart);
  const nombre = champ === "run1km_s" ? String(Math.round(abs)) : formatStatValue(abs, unite);
  const corps = unite ? `${nombre} ${unite}` : nombre;
  if (ecart === 0) return corps;
  return `${ecart > 0 ? "+" : "-"}${corps}`;
}

// =============================================================================
// 5. LA COMPARAISON DE TESTS
// =============================================================================

/**
 * Construit les comparaisons avant/apres reellement possibles.
 *
 * Reecriture de `computeTestComparisons` (`screens/ProgressScreen.tsx`:169-203),
 * qui n'est pas importable sans modifier un fichier interdit. Trois differences
 * assumees :
 *   1. on balaie `FIELD_DEFS` en entier (17 champs) et non une liste locale de 9 ;
 *   2. on exige deux JOURS distincts, pas seulement deux valeurs ;
 *   3. un ecart nul donne `sens: "identique"`, pas une regression.
 *
 * Fonction pure, exportee pour etre testee directement.
 */
export function construireComparaisonsTests(
  tests: readonly TestEntry[]
): ProgressionComparaisonsTests {
  const entrees = [...tests]
    .filter((e) => Number.isFinite(Number(e?.ts)) && Number(e.ts) > 0)
    .sort((a, b) => Number(b.ts) - Number(a.ts));

  if (entrees.length === 0) {
    return {
      possible: false,
      raison: "aucun_test_enregistre",
      explication:
        "Tes tests terrain apparaîtront ici dès que tu en auras enregistré deux, à deux dates différentes.",
    };
  }
  if (entrees.length === 1) {
    return {
      possible: false,
      raison: "un_seul_test_enregistre",
      explication:
        "Un seul test enregistré : refais-le plus tard pour voir ton écart entre les deux.",
    };
  }

  const comparaisons: ProgressionComparaisonTest[] = [];

  for (const def of FIELD_DEFS) {
    let apres: { valeur: number; jour: string; ts: number } | null = null;
    let avant: { valeur: number; jour: string; ts: number } | null = null;

    for (const entree of entrees) {
      const valeur = lireValeurChamp(entree, def.key);
      if (valeur === null) continue;
      const ts = Number(entree.ts);
      const jour = jourDeTest(ts);
      if (jour === "") continue;
      if (apres === null) {
        apres = { valeur, jour, ts };
        continue;
      }
      // Le "avant" doit venir d'un AUTRE jour : deux saisies du meme jour ne
      // sont pas une progression.
      if (jour !== apres.jour) {
        avant = { valeur, jour, ts };
        break;
      }
    }

    if (apres === null || avant === null) continue;

    // Arrondi a 4 decimales : 1.78 - 1.85 donne -0.07000000000000006 en binaire.
    // Ce n'est pas une mesure, c'est un artefact de representation — on ne le
    // laisse pas fuir dans le ViewModel.
    const ecart = Number((apres.valeur - avant.valeur).toFixed(4));
    const plusPetitEstMieux = Boolean(def.lowerIsBetter);
    const sens: ProgressionSensTest =
      ecart === 0
        ? "identique"
        : (plusPetitEstMieux ? ecart < 0 : ecart > 0)
          ? "amelioration"
          : "regression";

    comparaisons.push({
      champ: def.key,
      label: def.label,
      unite: def.unit,
      plusPetitEstMieux,
      avant: avant.valeur,
      apres: apres.valeur,
      ecart,
      avantJour: avant.jour,
      apresJour: apres.jour,
      apresTs: apres.ts,
      avantAffiche: afficherValeurTest(def.key, avant.valeur),
      apresAffiche: afficherValeurTest(def.key, apres.valeur),
      ecartAffiche: afficherEcartTest(def.key, ecart),
      sens,
    });
  }

  if (comparaisons.length === 0) {
    return {
      possible: false,
      raison: "aucune_paire_comparable",
      explication:
        "Tes tests ne portent pas encore deux fois le même exercice à deux dates différentes : c'est ce qui permet de mesurer un écart.",
    };
  }

  return { possible: true, comparaisons };
}

// =============================================================================
// 5 bis. LE REPERE DE TEST AFFICHE — LA REGLE DE SELECTION
// =============================================================================
//
// Le Home affiche UN SEUL repere de test. Le choisir, c'est deja une decision
// produit : le joueur ne verra que celui-la.
//
// LA REGLE, DANS L'ORDRE (posee par le fondateur) :
//   1. le test qui correspond a l'OBJECTIF DU CYCLE ACTIF ;
//   2. sinon, la mesure comparable la PLUS RECENTE ;
//   3. a egalite d'horodatage, un ordre stable et documente (§5 bis.3).
//
// CE QUE LA REGLE NE FAIT JAMAIS
// -----------------------------------------------------------------------------
// Elle ne regarde ni le signe, ni l'amplitude du resultat. « La meilleure
// progression » serait du cherry-picking : l'ecran montrerait le chiffre le plus
// flatteur du joueur et tairait les autres. Un repere en RECUL doit s'afficher
// exactement comme un repere en progres.
//
// Ce n'est pas une intention, c'est un TYPE (R9) : `choisirChampRepere` ne recoit
// que `{ champ, apresTs }`. `ecart`, `sens`, `avant`, `apres`,
// `plusPetitEstMieux` ne sont pas dans sa signature — les trier est impossible
// sans changer le type d'entree, ce qui se voit en une ligne dans une revue.
// =============================================================================

/** Une ligne du mapping cycle -> test. Documentee, pas devinee. */
export type ProgressionCycleRepere = {
  cycle: MicrocycleId;
  /** Libelle joueur du cycle. SOURCE : `MICROCYCLES[cycle].label`. */
  libelleCycle: string;
  /**
   * Le champ de test que ce cycle designe.
   * `null` = AUCUNE correspondance evidente. La regle 1 ne mord pas, on tombe
   * sur la regle 2. Forcer une correspondance ferait dire a l'ecran que le cycle
   * travaille une qualite qu'il ne promet pas.
   */
  champ: FieldKey | null;
  /** La ou les citations du depot qui fondent la ligne. */
  fondement: string;
  /** Ce qui a ete envisage puis ecarte, et pourquoi. `null` = rien de serieux en face. */
  ecarte: string | null;
};

/**
 * §5 bis.1 — LE MAPPING CYCLE -> TEST.
 *
 * DECISION PRODUIT — A VALIDER PAR LE FONDATEUR. Rien ici n'est deduit
 * automatiquement : chaque ligne est un choix, et chaque choix cite le texte du
 * depot qui le fonde.
 *
 * Le type est un `Record<MicrocycleId, ...>` : le jour ou un sixieme cycle entre
 * dans `domain/microcycles.ts`, ce fichier NE COMPILE PLUS tant que sa ligne
 * n'est pas ecrite. Un cycle ne peut donc pas arriver sans que quelqu'un ait
 * tranche — ni tomber en silence sur un repli.
 *
 * Le repere se prend dans le SOCLE (`CORE_FIELD_KEYS`) : ce sont les 3 tests que
 * tout le monde passe, "identiques pour tous, quel que soit le cycle actif"
 * (`screens/tests/testConfig.ts`:283-296). Un repere pioche dans les tests
 * optionnels n'existerait que pour les joueurs qui les font.
 */
export const PROGRESSION_TEST_PAR_CYCLE: Readonly<Record<MicrocycleId, ProgressionCycleRepere>> = {
  fondation: {
    cycle: "fondation",
    libelleCycle: MICROCYCLES.fondation.label,
    champ: null,
    fondement:
      "Aucune correspondance evidente. `MICROCYCLES.fondation.highlights` = [\"Appuis & controle\", \"Gainage\", \"Cardio leger\"] (domain/microcycles.ts:65) : aucun des 3 tests du socle ne mesure le gainage ni la qualite d'appui, et \"cardio leger\" decrit une INTENSITE de travail, pas une performance a battre. `PLAYLISTS.fondation.subtitle` = \"Base physique / S&C + endurance\" (testConfig.ts:274) est une base large, pas une qualite ciblee.",
    ecarte:
      "endurance6min_m, au motif du mot \"endurance\" dans le sous-titre. Ecarte : le cycle dit \"cardio leger\" (un moyen), pas \"tenir 90 min\" (un objectif). Accrocher la VMA a Fondation ferait promettre a l'ecran une progression que le cycle ne cherche pas.",
  },
  force: {
    cycle: "force",
    libelleCycle: MICROCYCLES.force.label,
    champ: "broadJumpCm",
    fondement:
      "`MICROCYCLES.force.highlights` contient \"Puissance\" (domain/microcycles.ts:83) et `CORE_FIELD_WHY.broadJumpCm` dit \"Ta puissance de jambes, mesurable sans le moindre materiel.\" (testConfig.ts:300). Meme mot, meme qualite — et c'est le seul test du socle qui mesure une production de force.",
    ecarte:
      "gobletKg / splitKg, plus proches de \"Force max + charges lourdes\" (PLAYLISTS.force.subtitle, testConfig.ts:275). Ecartes pour deux raisons : leur protocole dit \"Choisis une charge que tu peux lever 8-10 fois\" (testConfig.ts:222) — comparer deux dates compare deux CHOIX de charge autant que deux capacites ; et ils n'existent que si le profil declare du materiel (`EQUIPMENT_OPTIONAL_FIELD_KEYS`). trapbar3rmKg est un vrai maximum (\"la charge maximale que tu peux soulever 3 fois\", :262) mais il est reserve aux Seniors avec salle (`SENIOR_EQUIPMENT_OPTIONAL_FIELD_KEYS`) : en faire LE repere du cycle Force priverait de repere tous les autres joueurs.",
  },
  endurance: {
    cycle: "endurance",
    libelleCycle: MICROCYCLES.endurance.label,
    champ: "endurance6min_m",
    fondement:
      "`PLAYLISTS.endurance.subtitle` = \"Tenir 90 min + sprints repetes\" (testConfig.ts:277) et `MICROCYCLES.endurance.label` = \"Tenir tout le match\" (domain/microcycles.ts:95). En face, `CORE_FIELD_WHY.endurance6min_m` : \"L'IA s'en sert pour calibrer les allures de course de tes seances (ta VMA)\" (testConfig.ts:302), protocole \"l'allure la plus rapide que tu peux tenir sur toute la duree\" (:191). C'est la meme question : combien de temps tu tiens.",
    ecarte:
      "sprint10s, au motif de \"sprints repetes\". Ecarte : un 10 m unique mesure UN demarrage, pas la capacite a le repeter. Aucun test du socle ne mesure la repetition — le Yo-Yo IR1, qui s'en approcherait, est volontairement retire du produit (testConfig.ts:315-317).",
  },
  explosivite: {
    cycle: "explosivite",
    libelleCycle: MICROCYCLES.explosivite.label,
    champ: "sprint10s",
    fondement:
      "`MICROCYCLES.explosivite.description` : \"Tu travailles la vitesse de demarrage, les changements de direction et la detente. Les premiers metres et le saut font la difference.\" (domain/microcycles.ts:116). Le protocole du sprint 10 m est litteralement ces premiers metres : \"Pose deux reperes a 10 m... Depart arrete\" (testConfig.ts:137). Et `CORE_FIELD_WHY.sprint10s` ajoute \"Ta vitesse, la qualite n1 en foot\" (:301).",
    ecarte:
      "broadJumpCm, au motif de \"la detente\" dans la meme phrase (et cmjCm, plus direct encore pour la detente, mais hors socle). Ecarte parce que la citation du demarrage est litterale la ou celle de la detente est partagee ; le saut reste calcule et visible dans la liste complete des comparaisons, il n'est simplement pas LE repere du Home.",
  },
  saison: {
    cycle: "saison",
    libelleCycle: MICROCYCLES.saison.label,
    champ: null,
    fondement:
      "Aucune correspondance, et c'est volontaire. `MICROCYCLES.saison.description` : \"en pleine saison, l'objectif c'est rester performant le jour du match : juste ce qu'il faut a l'entrainement, pas plus.\" (domain/microcycles.ts:134), `PLAYLISTS.saison.subtitle` = \"Maintenir la forme sans se cramer\" (testConfig.ts:278). Un cycle de MAINTIEN ne promet d'ameliorer aucune qualite en particulier.",
    ecarte:
      "Rien. Y accrocher un test ferait dire a l'ecran que le cycle travaille cette qualite-la, alors qu'il travaille la fraicheur du week-end.",
  },
};

/**
 * Le mapping en liste, dans l'ordre de declaration de `MICROCYCLES` — pour le
 * visualiseur et le compte rendu. Derive du `Record` ci-dessus : impossible
 * qu'une ligne affichee dise autre chose que la ligne appliquee.
 */
export const PROGRESSION_MAPPING_CYCLES: readonly ProgressionCycleRepere[] = (
  Object.keys(MICROCYCLES) as MicrocycleId[]
).map((id) => PROGRESSION_TEST_PAR_CYCLE[id]);

/**
 * §5 bis.3 — L'ORDRE DE DEPARTAGE, JUSTIFIE LIGNE A LIGNE.
 *
 * POURQUOI IL SERT VRAIMENT, ET SOUVENT : une batterie du socle est enregistree
 * en UNE SEULE entree, avec UN SEUL horodatage (`screens/TestsScreen.tsx`:241,
 * `const cleanEntry: TestEntry = { ts: Date.now() }`). Les 3 tests du socle
 * partagent donc leur date A LA SECONDE PRES. L'egalite n'est pas un cas rare :
 * c'est le cas NORMAL. Un departage bancal se verrait tous les jours.
 *
 * L'iteration precedente SUBISSAIT l'ordre de `FIELD_DEFS` (l'ordre de
 * declaration du formulaire de saisie). Voici un ordre choisi, chaque rang tenu
 * par une phrase du depot :
 *
 *   1. `sprint10s` — c'est le seul des trois que le produit CLASSE lui-meme :
 *      "Ta vitesse, la qualite n1 en foot" (`CORE_FIELD_WHY`, testConfig.ts:301).
 *      Aucune autre ligne de `CORE_FIELD_WHY` ne revendique un rang. A egalite
 *      stricte, on montre ce que le produit dit etre le plus important en foot.
 *   2. le reste du SOCLE, dans l'ordre documente de `CORE_FIELD_KEYS`
 *      ("Ordre = ordre d'execution conseille", testConfig.ts:288-296) : ce sont
 *      les tests que TOUS les joueurs passent.
 *   3. les tests optionnels, dans l'ordre de `FIELD_DEFS` — le seul ordre total
 *      que le depot definisse sur les 17 champs. Ils passent APRES le socle :
 *      un repere du socle est comparable d'un joueur a l'autre et present chez
 *      tout le monde.
 *
 * EFFET DE BORD, ASSUME ET VERIFIE : ce classement fait passer le sprint devant
 * le saut en longueur. Il est FIGE dans le code, calcule une fois au chargement,
 * et ne lit aucune valeur de test : un sprint en RECUL sort exactement pareil (
 * c'est la fixture « test-physique-en-recul », et c'est un test).
 */
const CHAMP_QUALITE_N1: FieldKey = "sprint10s";

export const PROGRESSION_ORDRE_DEPARTAGE: readonly FieldKey[] = [
  CHAMP_QUALITE_N1,
  ...(CORE_FIELD_KEYS as readonly FieldKey[]).filter((k) => k !== CHAMP_QUALITE_N1),
  ...FIELD_DEFS.map((d) => d.key).filter(
    (k) => !(CORE_FIELD_KEYS as readonly FieldKey[]).includes(k)
  ),
];

/** Rang de departage d'un champ. Table figee, aucune valeur de test n'y entre. */
const RANG_DEPARTAGE: Readonly<Record<string, number>> = PROGRESSION_ORDRE_DEPARTAGE.reduce<
  Record<string, number>
>((acc, champ, index) => {
  acc[champ] = index;
  return acc;
}, {});

/**
 * §5 bis.2 — CE QUE LA SELECTION A LE DROIT DE VOIR (R9).
 *
 * Deux champs, pas trois. Ni l'ecart, ni son signe, ni son sens ne sont ici :
 * un tri par "meilleure progression" ne peut pas etre ecrit sans changer cette
 * definition, et changer cette definition se voit.
 */
export type ProgressionCandidatRepere = {
  champ: FieldKey;
  /** Horodatage de la mesure la plus recente du champ. Une DATE, pas un score. */
  apresTs: number;
};

/** Laquelle des regles a designe le repere affiche. */
export type ProgressionRegleRepere = "objectif_du_cycle" | "mesure_la_plus_recente";

/** Le verdict de la selection, sans la comparaison elle-meme. */
export type ProgressionChoixRepere = {
  champ: FieldKey;
  regle: ProgressionRegleRepere;
  /**
   * `true` quand plusieurs mesures partageaient l'horodatage le plus recent et
   * que l'ordre de departage a tranche (le cas normal apres une batterie).
   */
  departageApplique: boolean;
};

/**
 * LA REGLE, DANS L'ORDRE. Fonction pure, exportee pour etre testee seule.
 *
 * Son entree ne porte AUCUN resultat (R9) : elle ne peut pas favoriser un bon
 * chiffre, meme par accident, meme en la modifiant sans faire attention.
 */
export function choisirChampRepere(
  candidats: readonly ProgressionCandidatRepere[],
  cycleActif: MicrocycleId | null
): ProgressionChoixRepere | null {
  if (candidats.length === 0) return null;

  // REGLE 1 — l'objectif du cycle actif.
  const champDuCycle = cycleActif === null ? null : PROGRESSION_TEST_PAR_CYCLE[cycleActif].champ;
  if (champDuCycle !== null) {
    const surLObjectif = candidats.find((c) => c.champ === champDuCycle);
    if (surLObjectif !== undefined) {
      return { champ: surLObjectif.champ, regle: "objectif_du_cycle", departageApplique: false };
    }
  }

  // REGLE 2 — la mesure comparable la plus recente.
  const tsMax = candidats.reduce((max, c) => (c.apresTs > max ? c.apresTs : max), candidats[0].apresTs);
  const exAequo = candidats.filter((c) => c.apresTs === tsMax);
  if (exAequo.length === 1) {
    return { champ: exAequo[0].champ, regle: "mesure_la_plus_recente", departageApplique: false };
  }

  // REGLE 3 — le departage, table figee (§5 bis.3).
  const rang = (champ: FieldKey): number =>
    RANG_DEPARTAGE[champ] ?? PROGRESSION_ORDRE_DEPARTAGE.length;
  const gagnant = [...exAequo].sort((a, b) => rang(a.champ) - rang(b.champ))[0];
  return { champ: gagnant.champ, regle: "mesure_la_plus_recente", departageApplique: true };
}

/** Le repere REELLEMENT affiche par la carte, avec la regle qui l'a designe. */
export type ProgressionRepereTest = {
  /** La comparaison a afficher, telle quelle. */
  comparaison: ProgressionComparaisonTest;
  regle: ProgressionRegleRepere;
  departageApplique: boolean;
  /**
   * Pourquoi CE repere-la. Destine au VISUALISEUR, au compte rendu et aux tests
   * — ce n'est pas un texte d'ecran joueur (aucune ligne de l'app ne le rend
   * aujourd'hui, et l'ajouter serait une decision de contenu a part).
   */
  motif: string;
};

/**
 * Applique la regle a un etat de comparaisons.
 *
 * Le passage par `candidats` n'est pas une precaution de style : c'est la
 * PROJECTION qui prive la selection de tout acces au resultat (R9). La
 * comparaison complete n'est retrouvee qu'APRES que le champ a ete choisi.
 */
export function choisirRepereTest(
  etat: ProgressionComparaisonsTests,
  cycleActif: MicrocycleId | null
): ProgressionRepereTest | null {
  if (!etat.possible || etat.comparaisons.length === 0) return null;

  const candidats: ProgressionCandidatRepere[] = etat.comparaisons.map((c) => ({
    champ: c.champ,
    apresTs: c.apresTs,
  }));
  const choix = choisirChampRepere(candidats, cycleActif);
  if (choix === null) return null;

  const comparaison = etat.comparaisons.find((c) => c.champ === choix.champ);
  if (comparaison === undefined) return null;

  const libelleCycle =
    cycleActif === null ? null : PROGRESSION_TEST_PAR_CYCLE[cycleActif].libelleCycle;
  const motif =
    choix.regle === "objectif_du_cycle"
      ? `Regle 1 : c'est le test que vise le cycle actif (${libelleCycle ?? cycleActif}).`
      : choix.departageApplique
        ? "Regle 2 : la mesure comparable la plus recente. Plusieurs tests partageaient cet horodatage (une batterie est enregistree en une seule fois) — l'ordre de departage fige a tranche."
        : "Regle 2 : la mesure comparable la plus recente.";

  return {
    comparaison,
    regle: choix.regle,
    departageApplique: choix.departageApplique,
    motif,
  };
}

// =============================================================================
// 6. LE SELECTEUR
// =============================================================================

/**
 * Construit le resume de progression.
 *
 * FONCTION PURE : meme entree -> meme sortie. Pas de store, pas d'horloge (elle
 * ne lit ni `Date.now()` ni `new Date()` sans argument), pas d'I/O, pas d'IA.
 */
export function buildProgressionViewModel(input: ProgressionInput): ProgressionViewModel {
  const protoWarnings: string[] = [];

  // ---------------------------------------------------------------------------
  // 6.1 Les faits bruts, tous mesures depuis les champs structures
  // ---------------------------------------------------------------------------
  const seances = input.seancesTerminees;
  const nbSeances = seances.length;

  const seancesAvecDuree = seances.filter(
    (s) => typeof s.dureeMin === "number" && Number.isFinite(s.dureeMin) && s.dureeMin > 0
  );
  const minutesConnues = seancesAvecDuree.reduce((total, s) => total + (s.dureeMin ?? 0), 0);
  const dureeToutesConnues = nbSeances > 0 && seancesAvecDuree.length === nbSeances;

  const nbRessentis = seances.filter((s) => s.ressentiEnregistre).length;
  const joursActifs = new Set(seances.map((s) => s.dateKey).filter((k) => k.length > 0)).size;

  // ---------------------------------------------------------------------------
  // 6.2 R4 — l'etat physique global : il n'y en a plus (§2 bis)
  // ---------------------------------------------------------------------------
  // Il n'y a rien a calculer ici, et c'est le point : aucun champ d'entree ne
  // porte de libelle d'etat, aucun champ de sortie ne peut en recevoir un. Ce
  // paragraphe ne fait qu'emettre l'avertissement destine au visualiseur, pour
  // que la decision soit LISIBLE a l'ecran de validation et pas seulement dans
  // le code.
  protoWarnings.push(
    "D1 (decision du fondateur, 2026-07-28) : cette carte n'affiche AUCUN etat physique global — ni « En forme », ni « Frais », ni « Pret a performer », ni « Un peu charge », ni « Charge moderee ». Ce n'est plus un verrou conditionnel : le champ d'entree (libelleEtatGlobal) et le champ de sortie (etatGlobal) ont ete SUPPRIMES du contrat. Motif : le modele de charge part encore de valeurs initiales artificielles (ATL0/CTL0) et ignore les entrainements club. Une pastille « Charge FKS » ne pourra revenir que le jour ou son calcul reposera sur des donnees entierement reelles, avec une portee expliquee."
  );

  // ---------------------------------------------------------------------------
  // 6.3 Les tests terrain
  // ---------------------------------------------------------------------------
  const comparaisonsTests = construireComparaisonsTests(input.testsTerrain);
  const repereTest = choisirRepereTest(comparaisonsTests, input.microcycleGoal);

  if (repereTest !== null) {
    const ligne =
      input.microcycleGoal === null ? null : PROGRESSION_TEST_PAR_CYCLE[input.microcycleGoal];
    protoWarnings.push(
      `Repere de test affiche : ${repereTest.comparaison.label} — ${repereTest.motif} Le mapping cycle -> test (PROGRESSION_TEST_PAR_CYCLE) est une DECISION PRODUIT a valider par le fondateur${
        ligne === null
          ? " ; aucun cycle actif ici, la regle 1 ne pouvait pas s'appliquer."
          : ligne.champ === null
            ? ` ; le cycle "${ligne.libelleCycle}" n'a volontairement AUCUN test associe, la regle 2 s'applique.`
            : "."
      }`
    );
  }

  if (input.testsTerrain.length > 0) {
    protoWarnings.push(
      "Prototype : le jour d'un test est calcule en UTC pour que les captures soient reproductibles. Au branchement reel, trancher avec le fondateur (un test fait a 23 h ne doit pas basculer au lendemain) — l'app utilise partout ailleurs `toDateKey`, qui est LOCAL."
    );
  }
  if (comparaisonsTests.possible) {
    // Champs que `screens/ProgressScreen.tsx` ne compare pas : sa liste locale
    // `TEST_FIELDS` (:144-160) est amputee de 8 champs de FIELD_DEFS.
    const CHAMPS_VUS_PAR_PROGRESS_SCREEN: readonly FieldKey[] = [
      "broadJumpCm",
      "cmjCm",
      "sprint10s",
      "sprint20s",
      "sprint30s",
      "endurance6min_m",
      "yoYoIR1_m",
      "run1km_s",
      "gobletKg",
    ];
    const invisibles = comparaisonsTests.comparaisons
      .filter((c) => !CHAMPS_VUS_PAR_PROGRESS_SCREEN.includes(c.champ))
      .map((c) => c.label);
    if (invisibles.length > 0) {
      protoWarnings.push(
        `Prototype : ${invisibles.join(", ")} — ces comparaisons n'existent PAS sur screens/ProgressScreen.tsx (liste locale TEST_FIELDS, l.144-160, amputee de 8 champs de FIELD_DEFS). Le joueur ne les verrait pas en allant sur la page Progression.`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 6.4 R7 — le garde-fou anti-doublon avec "Ma semaine"
  // ---------------------------------------------------------------------------
  // "Ma semaine" parle de la SEMAINE en cours ; cette carte parle du CUMUL. Tant
  // que les deux nombres different, tout va bien. Des qu'un fait de la carte
  // afficherait exactement le nombre que "Ma semaine" affiche deja, il est
  // retire et la carte change de fait.
  //
  // R7 BIS — LE LIBELLE DIT DE QUELLE PERIODE ON PARLE (demande du fondateur).
  // Le garde-fou ci-dessus empeche deux nombres IDENTIQUES de se suivre. Il
  // n'empeche pas un joueur de lire « Seances terminees : 12 » juste sous
  // « 1 seance sur 2 » et de se demander laquelle compte quoi. Les deux nombres
  // coexistent sur le meme ecran : la difference doit donc etre portee par le
  // LIBELLE, pas par la taille du texte.
  //
  // D'ou le suffixe ci-dessous, applique au SEUL compteur de seances : c'est le
  // seul fait de la carte qui compte la meme chose que "Ma semaine". Les minutes,
  // les ressentis et les jours d'entrainement ne comptent pas des seances — les
  // qualifier tous alourdirait quatre lignes pour lever une ambiguite qui
  // n'existe que sur une seule.
  //
  // Formulation retenue : « depuis tes debuts » plutot que « au total ». Elle
  // nomme la PERIODE, qui est exactement l'axe de la confusion (cette semaine vs
  // depuis le debut), la ou « au total » nomme une operation.
  const DEPUIS_LE_DEBUT = "depuis tes débuts";
  //
  // Portee du garde-fou : tous les faits COMPTABLES de la carte. Seul
  // `avant_tendance` y echappe — ce n'est pas un compteur d'etat mais un reste a
  // parcourir, son libelle le dit explicitement, et le fondateur l'a demande
  // dans cet etat.
  const semaine = input.semaineCourante;
  const nombreDejaAffiche = semaine.blocAffiche ? Math.trunc(semaine.seancesAffichees) : null;
  const faitEnDoublon = (nombre: number): boolean =>
    nombreDejaAffiche !== null && nombre === nombreDejaAffiche;

  const faitSeances: ProgressionFait | null =
    nbSeances > 0
      ? {
          cle: "seances_terminees",
          // R7 bis : le libelle dit lui-meme que c'est un CUMUL. Sans ce
          // suffixe, "Séances terminées : 12" et "1 séance sur 2" sont deux
          // comptes de seances a 300 px l'un de l'autre, distingues par rien.
          libelle: `${accord(nbSeances, "Séance terminée", "Séances terminées")} ${DEPUIS_LE_DEBUT}`,
          valeur: String(nbSeances),
        }
      : null;
  const faitMinutes: ProgressionFait | null =
    minutesConnues > 0
      ? {
          cle: "minutes_realisees",
          libelle: dureeToutesConnues
            ? "Minutes réalisées"
            : `Minutes réalisées (sur ${seancesAvecDuree.length} ${accord(seancesAvecDuree.length, "séance chronométrée", "séances chronométrées")})`,
          valeur: `${Math.round(minutesConnues)} min`,
        }
      : null;
  const faitRessentis: ProgressionFait | null =
    nbRessentis > 0
      ? {
          cle: "ressentis_enregistres",
          libelle: accord(nbRessentis, "Ressenti enregistré", "Ressentis enregistrés"),
          valeur: String(nbRessentis),
        }
      : null;
  const faitJoursActifs: ProgressionFait | null =
    joursActifs > 0
      ? {
          cle: "jours_actifs",
          libelle: accord(joursActifs, "Jour d'entraînement", "Jours d'entraînement"),
          valeur: String(joursActifs),
        }
      : null;

  /** Valeur comptable de chaque fait, pour le garde-fou R7. */
  const nombreDuFait: Record<Exclude<ProgressionFaitCle, "avant_tendance">, number> = {
    seances_terminees: nbSeances,
    minutes_realisees: Math.round(minutesConnues),
    ressentis_enregistres: nbRessentis,
    jours_actifs: joursActifs,
  };

  const retirerLesDoublons = (candidats: readonly (ProgressionFait | null)[]): ProgressionFait[] => {
    const gardes: ProgressionFait[] = [];
    for (const fait of candidats) {
      if (fait === null) continue;
      if (fait.cle === "avant_tendance") {
        gardes.push(fait);
        continue;
      }
      const nombre = nombreDuFait[fait.cle];
      if (faitEnDoublon(nombre)) {
        protoWarnings.push(
          `R7 : le fait "${fait.libelle}" a ete retire — il afficherait ${nombre}, exactement ce que "Ma semaine" affiche deja.`
        );
        continue;
      }
      gardes.push(fait);
    }
    return gardes;
  };

  // ---------------------------------------------------------------------------
  // 6.5 Peut-on afficher une tendance ?
  // ---------------------------------------------------------------------------
  const tendance = input.tendance;
  const points = tendance ? tendance.points.map((p) => p.value) : [];
  const joursObserves = tendance ? Math.max(0, Math.trunc(tendance.joursObserves)) : 0;

  const assezDeSeances = nbSeances >= PROGRESSION_SEANCES_MIN_POUR_TENDANCE;
  const assezDePoints = points.length >= PROGRESSION_POINTS_MIN_POUR_COURBE;
  const assezDeJoursObserves = joursObserves >= PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE;
  const tendanceAffichable = tendance !== null && assezDeSeances && assezDePoints && assezDeJoursObserves;

  /**
   * Ce qui bloque, calcule depuis les seuils — JAMAIS code en dur.
   * `court` alimente la valeur du fait, `explication` la phrase complete : les
   * deux sortent du meme calcul, ils ne peuvent donc pas se contredire.
   */
  function decrireIndisponibilite(): ProgressionTendanceIndisponible & { court: string } {
    if (!assezDeSeances) {
      const manque = PROGRESSION_SEANCES_MIN_POUR_TENDANCE - nbSeances;
      const court = `Encore ${manque} ${accord(manque, "séance", "séances")}`;
      return {
        raison: "pas_assez_de_seances",
        manque,
        court,
        explication: `${court} avant d'afficher une tendance.`,
      };
    }
    if (tendance === null || !assezDePoints) {
      return {
        raison: "aucun_point_fourni",
        manque: null,
        court: "Pas encore mesurable",
        explication:
          "Ta tendance s'affichera dès que tes charges seront enregistrées sur assez de jours.",
      };
    }
    const manque = PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE - joursObserves;
    const court = `Encore ${manque} ${accord(manque, "jour enregistré", "jours enregistrés")}`;
    return {
      raison: "pas_assez_de_jours_observes",
      manque,
      court,
      explication: `${court} avant d'afficher une tendance.`,
    };
  }

  if (tendance !== null && !tendanceAffichable && assezDeSeances) {
    protoWarnings.push(
      `Prototype : une trajectoire est fournie (${points.length} ${accord(points.length, "point", "points")}, ${joursObserves} ${accord(joursObserves, "jour observe", "jours observes")}) mais elle n'est PAS tracee — seuils ${PROGRESSION_POINTS_MIN_POUR_COURBE} points ET ${PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE} jours observes. Une courbe adossee a trop peu de jours reels dessine une constante d'amorcage, pas un joueur (R5).`
    );
  }

  // ---------------------------------------------------------------------------
  // 6.6 Rappel de composition — hors perimetre de ce ViewModel
  // ---------------------------------------------------------------------------
  protoWarnings.push(
    "Composition : cette carte et le bloc \"Ma forme\" du Home (HomeVNextViewModel.form) parlent tous les deux de la tendance. En variante 2, un seul des deux doit rester a l'ecran — arbitrage de mise en page, hors perimetre de ce ViewModel."
  );

  // ---------------------------------------------------------------------------
  // 6.7 ETAT 1 — "empty" : aucune seance terminee
  // ---------------------------------------------------------------------------
  if (nbSeances === 0) {
    if (input.testsTerrain.length > 0) {
      protoWarnings.push(
        `Prototype : ${input.testsTerrain.length} ${accord(input.testsTerrain.length, "entree de test existe", "entrees de tests existent")} alors qu'aucune seance n'est terminee. L'etat "empty" n'expose volontairement AUCUNE comparaison (son contenu a ete fige par le fondateur : titre + 3 reperes + mention). A rediscuter si le cas se presente reellement.`
      );
    }
    return {
      state: "empty",
      titre: "TA PROGRESSION DÉMARRE ICI",
      reperes: [
        { numero: 1, texte: "Termine ta première séance." },
        { numero: 2, texte: "Partage ton ressenti." },
        { numero: 3, texte: "Compare tes prochains tests." },
      ],
      mention: "0 séance terminée — tes premiers repères apparaîtront ici.",
      courbe: null,
      detail: decisionDetail("empty", protoWarnings),
      protoWarnings,
    };
  }

  // ---------------------------------------------------------------------------
  // 6.8 ETAT 2 — "collecting" : des seances, pas encore de tendance
  // ---------------------------------------------------------------------------
  if (!tendanceAffichable) {
    const { court, ...indisponibilite } = decrireIndisponibilite();
    const faits = retirerLesDoublons([
      faitSeances,
      faitMinutes,
      faitRessentis,
      {
        cle: "avant_tendance",
        libelle: "Avant d'afficher une tendance",
        valeur: court,
      },
    ]);

    if (faitMinutes === null) {
      protoWarnings.push(
        "R1 : le fait \"minutes realisees\" est absent — aucune des seances terminees ne porte de duree connue. Rien n'est affiche a la place (ni 0, ni tiret)."
      );
    } else if (!dureeToutesConnues) {
      protoWarnings.push(
        `R2 : ${seancesAvecDuree.length} ${accord(seancesAvecDuree.length, "seance sur", "seances sur")} ${nbSeances} portent une duree connue. Le total affiche ne couvre que celles-la, et le libelle le dit.`
      );
    }

    return {
      state: "collecting",
      titre: "TA PROGRESSION SE CONSTRUIT",
      faits,
      courbe: null,
      tendanceIndisponible: indisponibilite,
      comparaisonsTests,
      repereTest,
      detail: decisionDetail("collecting", protoWarnings),
      protoWarnings,
    };
  }

  // ---------------------------------------------------------------------------
  // 6.9 ETAT 3 — "ready" : assez de donnees pour une tendance
  // ---------------------------------------------------------------------------
  const premier = tendance.points[0]?.dateKey ?? "";
  const dernier = tendance.points[tendance.points.length - 1]?.dateKey ?? "";
  const etendue =
    premier && dernier ? Math.max(1, diffJours(premier, dernier) + 1) : points.length;

  // R3 : la portee dit exactement ce qui est dedans, et ce qui n'y est pas.
  const portee = input.chargesClubCapturees
    ? "Calculé sur tes séances FKS et tes charges club enregistrées."
    : "Calculé sur tes séances FKS uniquement — tes entraînements club n'y sont pas comptés.";

  // R7 : on descend la liste jusqu'au premier fait qui ne double pas "Ma semaine".
  const candidatsResume = retirerLesDoublons([
    faitSeances,
    faitMinutes,
    faitJoursActifs,
    faitRessentis,
  ]);
  let resume = candidatsResume[0] ?? null;
  if (resume === null) {
    // Cas pathologique : tous les faits comptables affichent le meme nombre que
    // "Ma semaine". Impossible en pratique a partir de 4 seances terminees, mais
    // le type exige un resume : on prend le cumul de seances et on le dit.
    resume = faitSeances ?? {
      cle: "jours_actifs",
      libelle: accord(joursActifs, "Jour d'entraînement", "Jours d'entraînement"),
      valeur: String(joursActifs),
    };
    protoWarnings.push(
      "R7 : aucun fait complementaire ne peut eviter le doublon avec \"Ma semaine\" sur cette entree. Le cumul est affiche quand meme — a regarder si ce cas se presente reellement."
    );
  }

  return {
    state: "ready",
    titre: "TA PROGRESSION",
    courbe: {
      points,
      portee,
      periodeLabel: `${etendue} derniers jours`,
      joursObserves,
    },
    resume,
    comparaisonsTests,
    repereTest,
    detail: decisionDetail("ready", protoWarnings),
    protoWarnings,
  };
}

// =============================================================================
// 7. LA DECISION DU PIED "Voir ma progression"
// =============================================================================
//
// Regle du fondateur : ce lien n'existe QUE si `screens/ProgressScreen.tsx` peut
// afficher un contenu honnete pour cet etat. Verdict pris etat par etat, en
// lisant le fichier :
//
// -- "empty" ----------------------------------------------------------------
//   Ce que le joueur y trouverait, dans l'ordre de la page :
//     1. un libelle d'etat physique + une courbe de 30 jours integralement
//        produits par les amorces ATL0/CTL0 (:243-273, :467-479) ;
//     2. SIX accomplissements, TOUS verrouilles (:56-112 rendus :553-599) :
//        "0 / 1", "0 / 10", "0 / 50", "0 / 7", "0 / 1", "0 / 30" ;
//     3. un calendrier du mois sans un seul jour actif (:665-710) ;
//     4. des stats du mois a "0", "—", "—", "0 j" (:713-740).
//   La carte "Evolution tests" (:602) ne s'affiche meme pas.
//   -> Pas une seule ligne vraie sur ce joueur. VERDICT : PAS DE BOUTON.
//
// -- "collecting" -----------------------------------------------------------
//   Le haut de la page reste le hero adosse aux amorces : c'est precisement la
//   raison d'etre du seuil de 4 seances. Le mur d'accomplissements est encore
//   verrouille a 5 sur 6 au mieux. Et les "Stats du mois" reaffichent le nombre
//   de seances et la duree moyenne, c'est-a-dire les faits que cette carte vient
//   deja d'enoncer (R7).
//   Le seul bloc honnete de la page est "Evolution tests" — mais ce ViewModel
//   calcule lui-meme la comparaison (`comparaisonsTests`), et en mieux : 17
//   champs contre 9, et deux jours distincts exiges. La carte peut donc la
//   montrer sur place. Le voyage n'apporte rien et coute deux blocs faux.
//   -> VERDICT : PAS DE BOUTON.
//
// -- "ready" ----------------------------------------------------------------
//   A partir de 4 seances terminees et 3 jours de charge reellement enregistree,
//   la page porte enfin des blocs que cette carte ne peut pas contenir :
//     - le calendrier du mois, jour par jour, alimente par de vraies seances
//       terminees et de vraies charges saisies (:368-396) ;
//     - les stats du mois et l'ecart avec le mois precedent, comptes sur des
//       seances reelles (:294-330, :457-458) ;
//     - la liste COMPLETE des comparaisons de tests, la ou la carte n'en montre
//       qu'une.
//   Le hero reste faux — il ne devient pas vrai a 4 seances. Mais la page cesse
//   d'etre integralement fausse, et ce qu'elle apporte en plus est reel.
//   -> VERDICT : BOUTON AFFICHE, en lien secondaire, avec la reserve enregistree
//      dans `detail.reserve` et repetee dans `protoWarnings`.
// =============================================================================

/**
 * LIBELLE DU PIED DE CARTE — pourquoi ce n'est plus « Voir le detail ».
 *
 * Defaut trouve en regardant l'ECRAN ENTIER, pas la carte : sur une journee
 * ordinaire, deux cibles tactiles portaient le meme texte visible « Voir le
 * detail » a quelques centimetres l'une de l'autre —
 *   - le lien secondaire sous l'action du jour, qui ouvre LA SEANCE
 *     (`viewModel.ts`, action.secondary) ;
 *   - le pied de cette carte, qui ouvre LA PROGRESSION.
 * Les libelles vocaux differaient (le pied annonce « Ma progression, ... »), donc
 * un lecteur d'ecran s'en sortait ; un joueur qui LIT l'ecran, non.
 *
 * C'est le libelle de la CARTE qui change, pas celui de la seance : la variante 1
 * doit rester exactement telle que le fondateur l'a validee, et c'est aussi le
 * bon choix sur le fond — « Voir ma progression » nomme sa destination, comme le
 * lien de sortie de la variante 1 qui menait deja au meme ecran, avec les memes
 * mots. Les deux variantes ne different donc plus que par la PLACE du lien.
 */
const LIBELLE_DETAIL = "Voir ma progression";

/** Reserve attachee au seul etat qui envoie reellement le joueur sur la page. */
const RESERVE_PROGRESS_SCREEN =
  "screens/ProgressScreen.tsx affiche en haut de page un libelle d'etat et une courbe de 30 jours reamorces sur ATL0/CTL0 (:251-252, :243-273), sans jamais dire sur quoi ils sont calcules (:547-549). Ce bloc doit etre corrige avant toute mise en production de ce lien.";

function decisionDetail(state: ProgressionState, protoWarnings: string[]): ProgressionDetail {
  if (state === "empty") {
    return {
      affiche: false,
      label: null,
      target: null,
      emphasis: "lien_secondaire",
      motif:
        "Aucun bouton : sur un compte sans seance terminee, la page Progression n'affiche que des faits faux — un etat de forme et une courbe issus des amorces ATL0/CTL0, six accomplissements tous verrouilles, un calendrier vide et des stats a 0 / tiret.",
      reserve: null,
    };
  }
  if (state === "collecting") {
    return {
      affiche: false,
      label: null,
      target: null,
      emphasis: "lien_secondaire",
      motif:
        "Aucun bouton : la page Progression ouvre toujours sur le hero adosse aux amorces, le mur d'accomplissements reste verrouille, et ses stats du mois repetent les faits que cette carte vient d'enoncer. Son seul bloc honnete (l'evolution des tests) est deja calcule ici, et sur plus de champs.",
      reserve: null,
    };
  }
  protoWarnings.push(`Reserve sur la destination : ${RESERVE_PROGRESS_SCREEN}`);
  return {
    affiche: true,
    label: LIBELLE_DETAIL,
    target: "progression",
    emphasis: "lien_secondaire",
    motif:
      "Bouton affiche : a partir de ce seuil, la page Progression porte des blocs reels que cette carte ne contient pas — le calendrier du mois jour par jour, les stats du mois comparees au mois precedent, et la liste complete des comparaisons de tests.",
    reserve: RESERVE_PROGRESS_SCREEN,
  };
}
