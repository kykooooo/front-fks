// screens/profilVNext/viewModel.ts
// =============================================================================
// Profil vNext — COUCHE CONTRAT (aucun composant, aucun rendu)
// =============================================================================
//
// PROTOTYPE — cet ecran n'est PAS monte par la navigation. `screens/ProfileScreen.tsx`
// (le Profil de production) n'est pas touche. Le seul consommateur de ce fichier
// est le harnais `prototype/profil/` et les tests `__tests__/profilVNext/`.
//
// Ce fichier definit ce que l'onglet Profil refondu a le DROIT d'afficher. La
// direction est celle du fondateur (07/08) : « le Profil ne raconte plus, il
// controle » — zero stat dupliquee, zero chiffre fabrique, les trois usages
// reels en haut. Les fautes mesurees par AUDIT_PROFIL.md deviennent impossibles
// A ECRIRE ici :
//
//   - aucun champ de forme/TSB/tendance            -> P0-1 et P0-2 impossibles
//     (l'etat de forme vit au Home, qui le calcule honnetement)
//   - aucun champ de regularite/trophee/streak     -> P0-3 et P0-4 impossibles
//   - aucun champ de compteur hebdo                -> P1-7 impossible (le seul
//     compteur hebdo de l'app vit au Home, regle n° 11 du repo)
//   - aucun champ `phase`                          -> P1-8 impossible (« PLAYLIST »
//     etait un jeton interne fige, pas une donnee joueur)
//   - l'identite vient du doc `users/{uid}` OBSERVE EN TEMPS REEL, jamais de
//     `lastAiContext`                              -> P1-1 impossible : l'input
//     n'a pas de champ pour un instantane de generation
//   - `IdentiteBlock` est une union discriminee    -> pas de « Joueur » fabrique
//     pendant le chargement : l'ecran attend, il n'invente pas
//   - chaque fait d'une ligne de controle porte sa `source`  -> un chiffre sans
//     origine ne compile pas
//   - les nombres declares sont `number | null`    -> pas de `?? 2`, pas de
//     `Math.max(1, …)` : une donnee absente s'affiche « A definir »
//
// Le selecteur `buildProfilVNextViewModel` est PUR : pas de store, pas de
// `new Date()` implicite (il lit `input.nowISO`), pas d'I/O, pas d'appel reseau.
//
// Un champ qu'on ne sait pas encore alimenter se declare `null` et se signale
// dans `protoWarnings` — jamais une valeur de remplissage (regle n° 12).
// =============================================================================

import { MICROCYCLES } from "../../domain/microcycles";
import { getMicrocyclePhase } from "../../utils/microcycleUtils";
import { formatDayFR, toDateKey } from "../../utils/dateHelpers";

// =============================================================================
// 1. SEUILS D'AFFICHAGE
// =============================================================================
// Le Profil refondu n'en a AUCUN, et c'est une propriete du design, pas un oubli :
// un ecran de controle n'affiche que des faits d'etat (identite declaree, cycle
// choisi, dernier releve, appartenance club). Aucun d'eux n'exige un volume
// minimal de donnees pour etre honnete — contrairement a une tendance de forme.
// Le tableau est exporte VIDE pour que le visualiseur puisse l'afficher tel quel
// et que le jour ou un seuil apparait, il soit nomme ici et nulle part ailleurs.
// =============================================================================

export const PROFIL_VNEXT_SEUILS: ReadonlyArray<{
  nom: string;
  valeur: number;
  role: string;
}> = [];

// =============================================================================
// 2. LES DEUX VARIANTES A TRANCHER (Phase 2, sur maquette)
// =============================================================================
// La ou un vrai choix produit existe : que porte une ligne de controle ?
//
//   - "pur"     : la ligne ne porte QUE son libelle et sa fleche. Zero chiffre
//                 sur l'ecran, aucune redite possible avec le Home. Le prix :
//                 « Mon cycle » ne dit pas ou on en est, « Tests terrain » ne dit
//                 pas de quand date le dernier releve.
//   - "informe" : chaque ligne porte UN fait d'etat, calcule par la MEME
//                 implementation que l'ecran qui fait foi (cycle : l'arithmetique
//                 du Home via getMicrocyclePhase ; tests : la source canonique
//                 useTestsStorage ; club : la resolution serveur). Redite
//                 assumee mais jamais divergente par construction.
//
// La variante par defaut est "informe" : c'est l'hypothese de travail, pas la
// decision. Le visualiseur bascule entre les deux avec les memes donnees.
// =============================================================================

export type ProfilVarianteId = "pur" | "informe";

export const PROFIL_VARIANTES: ReadonlyArray<{
  id: ProfilVarianteId;
  libelle: string;
  description: string;
}> = [
  {
    id: "pur",
    libelle: "Controle pur",
    description:
      "Les lignes de controle ne portent aucun fait. Zero chiffre sur l'ecran, " +
      "zero redite possible avec le Home.",
  },
  {
    id: "informe",
    libelle: "Controle informe",
    description:
      "Chaque ligne porte un fait d'etat calcule par l'implementation qui fait " +
      "foi ailleurs (arithmetique cycle du Home, source canonique des tests, " +
      "resolution serveur du club).",
  },
];

export const PROFIL_VARIANTE_PAR_DEFAUT: ProfilVarianteId = "informe";

// =============================================================================
// 3. LES TYPES DU CONTRAT
// =============================================================================

/**
 * L'identite du joueur, lue du doc `users/{uid}` observe en temps reel.
 *
 * Union discriminee : tant que l'observation n'a pas rendu son premier
 * instantane, l'ecran est en "chargement" et n'affiche RIEN d'identitaire —
 * jamais un « Joueur » de remplissage (le defaut P1-1 venait de la : une copie
 * `lastAiContext` vide avant la premiere generation).
 *
 * Dans "prete", chaque champ vaut le LIBELLE D'AFFICHAGE (avec accents) derive
 * de la valeur persistee (sans accents), ou `null` si le doc ne porte pas le
 * champ. `null` s'affiche « A definir » et la ligne navigue vers le setup —
 * le patron « Mon rythme », juge exemplaire par l'audit.
 */
export type IdentiteBlock =
  | {
      kind: "prete";
      /** Prenom du doc, sinon displayName Firebase, sinon null — jamais un placeholder. */
      prenom: string | null;
      poste: string | null;
      niveau: string | null;
      pied: string | null;
      objectif: string | null;
    }
  | { kind: "chargement" };

/**
 * Les trois declarations de rythme (seances FKS visees, entrainements club,
 * matchs par semaine). `null` = non declare, affiche « A definir », tap vers le
 * setup. JAMAIS un zero de remplissage ni un defaut invente.
 */
export type RythmeBlock = {
  fksParSemaine: number | null;
  clubParSemaine: number | null;
  matchsParSemaine: number | null;
};

/** D'ou vient le fait affiche sur une ligne de controle. Obligatoire : un chiffre sans origine ne compile pas. */
export type FaitSource = "store_cycle" | "tests_canonique" | "club_serveur";

export type FaitDeLigne = {
  texte: string;
  source: FaitSource;
};

/** Ou mene chaque ligne. Union fermee : pas de navigation inventee par l'ecran. */
export type CibleControle =
  | "profil_setup"
  | "reglages"
  | "historique"
  | "tests"
  | "cycle_modal";

export type ControleId =
  | "modifier_profil"
  | "reglages"
  | "historique"
  | "tests"
  | "cycle"
  | "club";

export type ControleLigne = {
  id: ControleId;
  label: string;
  /**
   * Le fait d'etat de la ligne. `null` en variante "pur", et en variante
   * "informe" quand la donnee est absente (pas de cycle actif, aucun test,
   * pas de club) — l'absence est un etat, pas un zero.
   */
  fait: FaitDeLigne | null;
  cible: CibleControle;
};

export type ProfilVNextViewModel = {
  variante: ProfilVarianteId;
  identite: IdentiteBlock;
  rythme: RythmeBlock;
  /**
   * Les lignes de controle, DANS L'ORDRE DE RENDU. Les trois usages reels
   * (modifier le profil, les reglages, l'historique) viennent en tete —
   * c'est la direction du fondateur, encodee par le selecteur, pas par l'ecran.
   */
  controles: ControleLigne[];
  /** Notes de chantier. Affichees par le visualiseur, JAMAIS par l'ecran. */
  protoWarnings: string[];
};

// =============================================================================
// 4. L'ENTREE DU SELECTEUR — au format REEL persiste
// =============================================================================
// Chaque champ correspond a une source reelle, nommee, dans le format que le
// produit ecrit vraiment (rapport formats du 07/08) :
//   - `profil`      : doc Firestore users/{uid}, via un onSnapshot DEDIE du
//                     conteneur (le watcher global ne pousse pas l'identite
//                     vers les stores — divergence n° 2 du rapport)
//   - `displayNameAuth` : auth.currentUser.displayName (repli du prenom)
//   - `cycle`       : useSessionsStore (goal canonicalise par le store)
//   - `tests`       : useTestsStorage() — la source canonique, JAMAIS readTestsRaw
//   - `club`        : resolution cote conteneur (clubs/{id}.name +
//                     clubMembershipCopy sur members/{uid}) — le ViewModel recoit
//                     le resultat, il ne connait pas Firestore
// =============================================================================

export type ProfilVNextInput = {
  /** Instant de reference. Le selecteur ne lit JAMAIS l'horloge. */
  nowISO: string;

  profil: {
    etat: "pret" | "chargement";
    /** users/{uid}.firstName — string persistee, ou null si absente. */
    firstName: string | null;
    /** Valeur PERSISTEE sans accents : "Gardien" | "Defenseur" | "Milieu" | "Attaquant". */
    position: string | null;
    /** Valeur PERSISTEE : "Amateur" | "Regional" | "National" | "Semi-pro" | "Pro". */
    level: string | null;
    /** Valeur PERSISTEE : "Pied droit" | "Pied gauche" | "Ambidextre". */
    dominantFoot: string | null;
    /** Valeur PERSISTEE exacte, ex. "Gagner en vitesse / explosivite". */
    mainObjective: string | null;
    targetFksSessionsPerWeek: number | null;
    clubTrainingsPerWeek: number | null;
    matchesPerWeek: number | null;
  };

  /** auth.currentUser?.displayName ?? null. */
  displayNameAuth: string | null;

  cycle: {
    /** useSessionsStore.microcycleGoal — canonicalise par le store, ou null. */
    microcycleGoal: string | null;
    /** useSessionsStore.microcycleSessionIndex — seances FAITES du cycle. */
    microcycleSessionIndex: number;
  };

  tests: {
    /** Nombre d'entrees CANONIQUES (useTestsStorage : ts valide, tri, cap 30). */
    count: number;
    /** ts (ms) de l'entree la plus recente, ou null si aucune. */
    lastTs: number | null;
  };

  club: {
    clubId: string | null;
    /** clubs/{clubId}.name, ou null (pas de club, ou nom illisible). */
    nom: string | null;
    /** Badge de clubMembershipCopy (ex. "Joueur", "Proprietaire-joueur"), ou null. */
    badge: string | null;
  };
};

export type ProfilVNextOptions = {
  variante?: ProfilVarianteId;
};

// =============================================================================
// 5. LIBELLES D'AFFICHAGE — persiste (sans accents) -> affiche (avec accents)
// =============================================================================
// Les valeurs persistees sont SANS accents (allowlists Cloud Functions). Les
// libelles avec accents n'existent aujourd'hui que dans des maps privees de
// ProfileSetupScreen. Le prototype porte les siennes ; AU CABLAGE, les deux
// devront etre factorisees dans un module partage (a inscrire au dossier
// d'integration — ne pas laisser deux verites de libelles).
//
// Une valeur persistee inconnue est AFFICHEE TELLE QUELLE (pas de « ? », pas de
// masquage) et signalee dans protoWarnings : mieux vaut montrer la donnee brute
// que la remplacer.
// =============================================================================

const POSTE_LABELS: Record<string, string> = {
  Gardien: "Gardien",
  Defenseur: "Défenseur",
  Milieu: "Milieu",
  Attaquant: "Attaquant",
};

const NIVEAU_LABELS: Record<string, string> = {
  Amateur: "Amateur",
  Regional: "Régional",
  National: "National",
  "Semi-pro": "Semi-pro",
  Pro: "Pro",
};

const PIED_LABELS: Record<string, string> = {
  "Pied droit": "Pied droit",
  "Pied gauche": "Pied gauche",
  Ambidextre: "Ambidextre",
};

const OBJECTIF_LABELS: Record<string, string> = {
  "Etre en forme toute la saison": "Être en forme toute la saison",
  "Gagner en vitesse / explosivite": "Gagner en vitesse / explosivité",
  // Seule valeur persistee qui porte un accent (le « i » circonflexe) — reelle,
  // ne pas « corriger ».
  "Mieux encaisser les entraînements et les matchs":
    "Mieux encaisser les entraînements et les matchs",
  "Reprendre apres une blessure": "Reprendre après une blessure",
};

function labelDepuisPersiste(
  valeur: string | null,
  table: Record<string, string>,
  champ: string,
  warnings: string[]
): string | null {
  if (valeur == null) return null;
  const label = table[valeur];
  if (label != null) return label;
  warnings.push(
    `identite: valeur persistee inconnue pour ${champ} (« ${valeur} ») — affichee telle quelle`
  );
  return valeur;
}

// =============================================================================
// 6. LE SELECTEUR
// =============================================================================

export function buildProfilVNextViewModel(
  input: ProfilVNextInput,
  options: ProfilVNextOptions = {}
): ProfilVNextViewModel {
  const variante: ProfilVarianteId = options.variante ?? PROFIL_VARIANTE_PAR_DEFAUT;
  const protoWarnings: string[] = [];
  const informe = variante === "informe";

  // --- Identite -------------------------------------------------------------
  let identite: IdentiteBlock;
  if (input.profil.etat === "chargement") {
    identite = { kind: "chargement" };
  } else {
    const prenom =
      (input.profil.firstName && input.profil.firstName.trim()) ||
      (input.displayNameAuth && input.displayNameAuth.trim()) ||
      null;
    identite = {
      kind: "prete",
      prenom,
      poste: labelDepuisPersiste(input.profil.position, POSTE_LABELS, "position", protoWarnings),
      niveau: labelDepuisPersiste(input.profil.level, NIVEAU_LABELS, "level", protoWarnings),
      pied: labelDepuisPersiste(
        input.profil.dominantFoot,
        PIED_LABELS,
        "dominantFoot",
        protoWarnings
      ),
      objectif: labelDepuisPersiste(
        input.profil.mainObjective,
        OBJECTIF_LABELS,
        "mainObjective",
        protoWarnings
      ),
    };
  }

  // --- Rythme ---------------------------------------------------------------
  // Passe-plat volontaire : null reste null (« A definir »), zero reste zero
  // (un joueur peut declarer 0 match par semaine — c'est une declaration, pas
  // une absence).
  const rythme: RythmeBlock = {
    fksParSemaine: nombreOuNull(input.profil.targetFksSessionsPerWeek),
    clubParSemaine: nombreOuNull(input.profil.clubTrainingsPerWeek),
    matchsParSemaine: nombreOuNull(input.profil.matchesPerWeek),
  };

  // --- Faits des lignes (variante informee uniquement) ----------------------

  // Cycle : LA MEME arithmetique que le Home (getMicrocyclePhase, seance en
  // cours = index + 1). Pas de fraction nue : le mot « Seance » porte le sens
  // (defaut P1-11 : le « 3/12 » du Hub se lisait comme le « 4/12 » du Home).
  let faitCycle: FaitDeLigne | null = null;
  let labelCycle = "Choisir mon cycle";
  const goal = input.cycle.microcycleGoal;
  if (goal != null && MICROCYCLES[goal as keyof typeof MICROCYCLES] != null) {
    const def = MICROCYCLES[goal as keyof typeof MICROCYCLES];
    labelCycle = "Mon cycle";
    if (informe) {
      const phase = getMicrocyclePhase(input.cycle.microcycleSessionIndex);
      faitCycle = {
        texte: `${def.label} · Séance ${phase.sessionNumber} sur ${phase.total}`,
        source: "store_cycle",
      };
    }
  } else if (goal != null) {
    // Le store canonicalise a l'ecriture : un id inconnu ici est un bug amont,
    // pas un etat a habiller.
    protoWarnings.push(`cycle: id de cycle inconnu (« ${goal} ») — ligne rendue sans fait`);
    labelCycle = "Mon cycle";
  }

  // Tests : la date du dernier releve CANONIQUE, en jour LOCAL (toDateKey /
  // formatDayFR — pas d'arithmetique de millisecondes, defaut P2-8).
  let faitTests: FaitDeLigne | null = null;
  if (informe && input.tests.count > 0 && input.tests.lastTs != null) {
    faitTests = {
      texte: `Dernier relevé : ${formatDayFR(toDateKey(new Date(input.tests.lastTs)))}`,
      source: "tests_canonique",
    };
  }
  if (input.tests.count > 0 && input.tests.lastTs == null) {
    protoWarnings.push(
      "tests: count > 0 mais lastTs absent — entree incoherente, aucun fait affiche"
    );
  }

  // Club : le nom resolu cote serveur, et le badge d'appartenance si connu.
  let faitClub: FaitDeLigne | null = null;
  if (informe && input.club.clubId != null && input.club.nom != null) {
    faitClub = {
      texte: input.club.badge != null ? `${input.club.nom} · ${input.club.badge}` : input.club.nom,
      source: "club_serveur",
    };
  }
  if (input.club.clubId != null && input.club.nom == null) {
    protoWarnings.push("club: clubId present mais nom irresolu — ligne rendue sans fait");
  }

  // --- Les lignes, dans l'ordre de rendu ------------------------------------
  // Les trois usages reels d'abord (modifier / reglages / historique), puis les
  // controles de programme (tests, cycle), puis le club. L'ordre est une
  // decision du contrat : l'ecran le rend tel quel.
  const controles: ControleLigne[] = [
    { id: "modifier_profil", label: "Modifier mon profil", fait: null, cible: "profil_setup" },
    { id: "reglages", label: "Réglages", fait: null, cible: "reglages" },
    { id: "historique", label: "Mes séances passées", fait: null, cible: "historique" },
    { id: "tests", label: "Tests terrain", fait: faitTests, cible: "tests" },
    { id: "cycle", label: labelCycle, fait: faitCycle, cible: "cycle_modal" },
    {
      id: "club",
      label: input.club.clubId != null ? "Mon club" : "Rejoindre un club",
      fait: faitClub,
      cible: "reglages",
    },
  ];

  return { variante, identite, rythme, controles, protoWarnings };
}

/** Nombre fini, sinon null. Zero est une valeur (declaration), pas une absence. */
function nombreOuNull(valeur: number | null | undefined): number | null {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return null;
  return valeur;
}
