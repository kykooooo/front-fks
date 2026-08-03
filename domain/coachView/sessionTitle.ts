// domain/coachView/sessionTitle.ts
//
// INVARIANT TITRE / TYPE d'une séance coach.
//
// LE PROBLÈME OBSERVÉ. Sur une fiche joueur de démonstration, un titre
// « Explosivité — Vmax + appuis » cohabitait avec un type « Force ». Deux
// informations qui se contredisent à l'écran : le coach ne peut plus savoir
// laquelle croire, et rien dans le code ne l'empêchait.
//
// CE QUE FAIT LE SERVEUR (vérifié). `functions/src/coachLabels.ts` expose
// `FOCUS_MAP`, qui associe chaque focus à un COUPLE `{ label, title }` ; puis
// `functions/src/projector.ts` dérive `title = focusTitle(focusSrc)` et
// `focusLabel = readableFocus(focusSrc)` À PARTIR DE LA MÊME SOURCE. En
// production, les deux champs ne PEUVENT donc pas se contredire : la
// contradiction observée vient d'un bouchon de démonstration qui les posait
// indépendamment.
//
// POURQUOI CE FICHIER EXISTE QUAND MÊME. « Impossible aujourd'hui » n'est pas
// « impossible demain » : un bug serveur, un document Firestore modifié à la
// main, une migration ratée ou un jeu de démonstration suffisent à faire
// remonter un couple incohérent. On rend donc l'invariant EXPLICITE et
// VÉRIFIABLE côté lecture, au lieu de le supposer.
//
// LA RÈGLE D'ARBITRAGE. En cas de contradiction, on garde le TYPE (`focusLabel`,
// l'information la plus grossière donc la plus fiable) et on ABANDONNE le titre.
// Un titre absent est un cas déjà géré partout dans l'espace coach ; un titre
// MENTEUR, lui, ne l'est nulle part.
//
// ⚠️ MIROIR. `COACH_FOCUS_PAIRS` ci-dessous est un MIROIR de `FOCUS_MAP`
// (functions/src/coachLabels.ts). Les deux fichiers sont tenus synchronisés À LA
// MAIN, exactement comme le reste du projet le fait déjà entre le port serveur
// (functions/src/coachLabels.ts) et le domaine front (domain/). Toute
// modification d'un libellé côté serveur DOIT être reportée ici.
//
// Module PUR : aucune dépendance React / Firestore / horloge.

/** Un focus serveur et le couple d'affichage qu'il produit. */
export type CoachFocusPair = {
  /** Clé de focus côté serveur (FOCUS_MAP), gardée pour la traçabilité. */
  readonly focus: string;
  /** Ce que le coach lit comme TYPE de séance. */
  readonly focusLabel: string;
  /** Ce que le coach lit comme TITRE de séance. */
  readonly title: string;
};

/**
 * MIROIR EXACT de `FOCUS_MAP` (functions/src/coachLabels.ts, section
 * « Focus : ALLOWLIST serveur stricte »). `run` et `endurance` produisent
 * volontairement le MÊME couple côté serveur : on le recopie tel quel plutôt
 * que de le « simplifier », pour que la comparaison des deux fichiers reste
 * immédiate.
 */
export const COACH_FOCUS_PAIRS: readonly CoachFocusPair[] = [
  { focus: "strength", focusLabel: "Renfo / Force", title: "Séance renfo / force" },
  { focus: "run", focusLabel: "Course / Endurance", title: "Séance course / endurance" },
  { focus: "endurance", focusLabel: "Course / Endurance", title: "Séance course / endurance" },
  { focus: "speed", focusLabel: "Vitesse", title: "Séance vitesse" },
  { focus: "plyo", focusLabel: "Pliométrie", title: "Séance pliométrie" },
  { focus: "circuit", focusLabel: "Circuit", title: "Séance circuit" },
  { focus: "mobility", focusLabel: "Mobilité", title: "Séance mobilité" },
  { focus: "core", focusLabel: "Gainage", title: "Séance gainage" },
  {
    focus: "cod",
    focusLabel: "Appuis / Changements de direction",
    title: "Séance appuis",
  },
];

/**
 * Normalisation de comparaison : espaces normalisés + minuscules. On ne touche
 * NI aux accents NI à la ponctuation — un libellé serveur est une constante, pas
 * une saisie utilisateur : le seul écart qu'on tolère est cosmétique (casse,
 * espaces), tout le reste est une vraie divergence qu'il faut voir.
 */
const normalize = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();

/** focusLabel normalisé → titre attendu (construit une seule fois). */
const TITLE_BY_LABEL: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const pair of COACH_FOCUS_PAIRS) map.set(normalize(pair.focusLabel), pair.title);
  return map;
})();

/**
 * Résultat de la vérification du couple. Quatre cas EXPLICITES : on ne prétend
 * jamais avoir « vérifié » ce qu'on n'a pas pu vérifier.
 *
 *  - `coherent`      : titre et type se correspondent (couple connu).
 *  - `incoherent`    : le type est connu et le titre n'est PAS celui du type.
 *  - `titre_absent`  : pas de titre → rien à contredire (cas fréquent, normal).
 *  - `non_verifiable`: type absent, ou type inconnu de la table miroir (front en
 *                      retard sur un focus ajouté côté serveur). On ne conclut
 *                      RIEN : une absence de preuve n'est pas une preuve.
 */
export const COACH_TITLE_COHERENCES = [
  "coherent",
  "incoherent",
  "titre_absent",
  "non_verifiable",
] as const;
export type CoachTitleCoherence = (typeof COACH_TITLE_COHERENCES)[number];

/** Titre attendu pour un type de séance donné, ou `null` si le type est inconnu. */
export function expectedTitleForFocusLabel(focusLabel: string | null | undefined): string | null {
  if (typeof focusLabel !== "string" || !focusLabel.trim()) return null;
  return TITLE_BY_LABEL.get(normalize(focusLabel)) ?? null;
}

/** Vérifie la cohérence du couple (titre, type). Fonction PURE, sans effet de bord. */
export function checkSessionTitleCoherence(
  title: string | null | undefined,
  focusLabel: string | null | undefined,
): CoachTitleCoherence {
  const hasTitle = typeof title === "string" && title.trim().length > 0;
  if (!hasTitle) return "titre_absent";

  const expected = expectedTitleForFocusLabel(focusLabel);
  if (expected === null) return "non_verifiable";

  return normalize(title as string) === normalize(expected) ? "coherent" : "incoherent";
}

/**
 * Avertissement de DÉVELOPPEMENT uniquement. En production on corrige l'affichage
 * en silence (le coach n'a rien à faire d'un message technique) ; en dev on veut
 * que la contradiction saute aux yeux de celui qui l'a introduite.
 */
function avertirIncoherence(title: string, focusLabel: string, expected: string): void {
  // `__DEV__` est une globale React Native : `typeof` protège les contextes
  // (tests Node purs, outillage) où elle n'est pas définie.
  const enDev = typeof __DEV__ !== "undefined" && __DEV__;
  if (!enDev) return;
  console.warn(
    `[coachView] Titre incohérent avec le type de séance : titre "${title}" pour le type ` +
      `"${focusLabel}" (titre attendu : "${expected}"). Le titre est abandonné, le type est ` +
      `conservé. Vérifier la projection serveur (FOCUS_MAP) ou le document Firestore.`,
  );
}

/**
 * Titre à AFFICHER pour un couple (titre, type) : le titre tel quel, sauf s'il
 * contredit le type — auquel cas `null` (on préfère une information en moins à
 * une information fausse).
 */
export function reconcileSessionTitle(
  title: string | null | undefined,
  focusLabel: string | null | undefined,
): string | null {
  const coherence = checkSessionTitleCoherence(title, focusLabel);
  if (coherence === "incoherent") {
    avertirIncoherence(
      String(title),
      String(focusLabel),
      expectedTitleForFocusLabel(focusLabel) ?? "",
    );
    return null;
  }
  return typeof title === "string" && title.trim() ? title : null;
}
