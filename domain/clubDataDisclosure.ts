// domain/clubDataDisclosure.ts
//
// CE QUE LE JOUEUR VOIT AVANT DE REJOINDRE UN CLUB.
//
// Depuis juillet 2026, rejoindre un club avec une invitation valide active la
// projection coach non sensible sans validation administrative (politique
// `automatic_safe_projection`, cf. functions/src/joinAccessPolicy.ts). La
// contrepartie, exigée par Kyllian : le joueur doit SAVOIR, au moment où il
// saisit son code, quelles catégories d'informations sportives son encadrement
// verra.
//
// ⚠️ CE TEXTE N'EST PAS UNE PROMESSE MARKETING : il est écrit à partir du
// contrat coach-safe RÉEL (functions/src/dto.ts, `CoachPlayerSummaryCore`, et
// son miroir front domain/coachSummary.ts, `CoachPlayerSummary`). Chaque item
// déclare les CLÉS du contrat qu'il couvre, et un test compare cette couverture
// aux clés réellement produites par `parseCoachPlayerSummary`. Ajouter un champ
// à la projection sans l'annoncer ici fait échouer la suite — c'est le seul
// moyen d'éviter qu'une divulgation devienne mensongère en six mois.
//
// TON : simple, factuel, court. Ce n'est ni un formulaire de consentement, ni
// une politique de confidentialité, ni un avis médical. Elle INFORME et ne
// bloque rien : elle ne demande aucune case à cocher et n'empêche jamais de
// rejoindre un club.

/** Un élément de la liste « ce que ton coach voit ». */
export type ClubDisclosureItem = {
  /** Clés de `CoachPlayerSummary` couvertes par cette phrase. */
  cles: readonly string[];
  texte: string;
};

/**
 * Ce qui EST transmis.
 *
 * `playerUid` est couvert par le premier item sans être nommé dans la phrase :
 * ce n'est pas une information sportive, c'est le lien technique entre la fiche
 * et le compte. Le nommer alourdirait le texte sans rien apprendre au joueur.
 */
export const CLUB_DISCLOSURE_SHARED: readonly ClubDisclosureItem[] = [
  {
    cles: ["playerUid", "firstName", "ageCategory", "position", "level", "profileComplete"],
    texte: "Ton prénom, ta catégorie d'âge, ton poste et ton niveau.",
  },
  {
    cles: ["latestSession", "lastPlanned", "lastDone"],
    texte:
      "Tes séances FKS : titre, date, durée, type de travail, intensité — la prochaine comme la dernière.",
  },
  {
    cles: ["activity", "lastActivity"],
    texte: "Les dates de tes séances terminées et la durée de la dernière.",
  },
  {
    cles: ["adaptation"],
    texte: "Quand FKS allège ta séance : qu'elle a été adaptée, et sur quel point.",
  },
  {
    cles: ["execution"],
    texte:
      "Dans ta dernière séance : les exercices faits, adaptés, sautés ou remplacés.",
  },
];

/**
 * Ce qui n'est JAMAIS transmis. Liste volontairement concrète : le joueur doit
 * y reconnaître ce qu'il tape lui-même dans l'app après une séance.
 */
export const CLUB_DISCLOSURE_NEVER: readonly string[] = [
  "Tes douleurs et les zones du corps concernées.",
  "Ta fatigue et ton ressenti après une séance.",
  "Tes commentaires libres et tes notes perso.",
  "Tes chiffres de charge : effort ressenti, forme, fraîcheur.",
];

export const CLUB_DISCLOSURE = {
  titre: "Ce que ton club verra",
  intro:
    "Tu apparais dans l'effectif de ton coach avec une fiche de suivi. Voici son contenu.",
  partageTitre: "Ton coach voit",
  partage: CLUB_DISCLOSURE_SHARED,
  jamaisTitre: "Ton coach ne voit jamais",
  jamais: CLUB_DISCLOSURE_NEVER,
  /**
   * Point le plus délicat, dit franchement : les raisons d'écart SONT
   * transmises, mais passées par une liste fermée où douleur, fatigue et
   * « autre » produisent tous le même libellé (functions/src/coachLabels.ts,
   * `toCoachDeviationLabels`). Taire cette nuance rendrait la ligne « ton coach
   * ne voit jamais tes douleurs » approximative.
   */
  note: "Si tu sautes un exercice pour une douleur ou de la fatigue, ton coach lit « Autre raison » : la cause ne lui est pas transmise.",
  sortie: "Tu peux quitter ton club quand tu veux, depuis ton profil.",
} as const;

/** Union des clés du contrat coach-safe couvertes par la divulgation. */
export const CLUB_DISCLOSURE_COVERED_KEYS: readonly string[] = [
  ...new Set(CLUB_DISCLOSURE_SHARED.flatMap((item) => item.cles)),
];

/** Toutes les phrases affichées, pour les vérifications de ton. */
export function clubDisclosureTexts(): string[] {
  return [
    CLUB_DISCLOSURE.titre,
    CLUB_DISCLOSURE.intro,
    CLUB_DISCLOSURE.partageTitre,
    ...CLUB_DISCLOSURE_SHARED.map((i) => i.texte),
    CLUB_DISCLOSURE.jamaisTitre,
    ...CLUB_DISCLOSURE_NEVER,
    CLUB_DISCLOSURE.note,
    CLUB_DISCLOSURE.sortie,
  ];
}
