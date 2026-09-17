// screens/newSession/resumeContexte.ts
//
// Helper PUR pour la ligne récapitulative du pied collant (GenerationActions,
// SPEC_DA_ACCUEIL_SEANCE.md §3.7) : résume lieu(x) + matériel en une phrase
// courte, à partir des mêmes données que le formulaire — jamais une nouvelle
// source de vérité sur le matériel (les ids/labels restent ceux du catalogue
// existant, voir screens/NewSessionScreen.tsx et
// screens/newSession/ui/EquipmentSelector.tsx).

import type { EnvironmentSelection } from "./types";

type LocKey = "gym" | "pitch" | "home";

const LABEL_LIEU: Record<LocKey, string> = {
  gym: "Salle",
  pitch: "Terrain",
  home: "Maison",
};

/** Table id -> libellé consultée par `resumerContexte`. */
export type LibellesEquipement = Record<string, string>;

/**
 * Ids volontairement ABSENTS de la table de libellés : ce ne sont pas de
 * vrais éléments cochables par le joueur (`gym_full` est injecté par
 * `handleGenerate` quand la salle est validée sans sélection explicite,
 * `bodyweight` est le fallback "aucun matériel"). Les compter comme un
 * "élément réel" ferait dire au récap "Équipement standard + Poids du corps"
 * alors que le joueur n'a rien coché.
 */
const IDS_IGNORES = new Set(["gym_full", "bodyweight"]);

/**
 * Construit la table id -> libellé à partir des catalogues existants
 * (EQUIPMENT_CATALOG, HOME_EQUIPMENT, GYM_SPECIAL_EQUIPMENT). Pure : ne fait
 * que fusionner des listes déjà déclarées ailleurs, aucune donnée inventée.
 */
export function construireLibelles(
  ...catalogues: Array<ReadonlyArray<{ id: string; label: string }>>
): LibellesEquipement {
  const table: LibellesEquipement = {};
  for (const catalogue of catalogues) {
    for (const item of catalogue) {
      if (IDS_IGNORES.has(item.id)) continue;
      table[item.id] = item.label;
    }
  }
  return table;
}

export type ResumerContexteParams = {
  environment: EnvironmentSelection;
  selectedEquipment: string[];
  libelles: LibellesEquipement;
};

/**
 * Résume le contexte choisi en une phrase courte pour le pied collant :
 * "Terrain + Maison · Cônes, plots +2", "Salle · Équipement standard", etc.
 * Voir SPEC_DA_ACCUEIL_SEANCE.md §3.7 pour la règle exacte.
 */
export function resumerContexte({
  environment,
  selectedEquipment,
  libelles,
}: ResumerContexteParams): string {
  if (environment.length === 0) return "Choisis un lieu pour continuer.";

  const lieuxTexte = environment.map((lieu) => LABEL_LIEU[lieu as LocKey]).join(" + ");
  const enSalle = environment.includes("gym");

  const connus = selectedEquipment
    .filter((id) => Boolean(libelles[id]))
    .map((id) => libelles[id]);

  let equipementTexte: string;
  if (connus.length === 0) {
    equipementTexte = enSalle ? "Équipement standard" : "Poids du corps";
  } else {
    const premiers = connus.slice(0, 2).join(" + ");
    const reste = connus.length - 2;
    const base = reste > 0 ? `${premiers} +${reste}` : premiers;
    equipementTexte = enSalle ? `Équipement standard + ${base}` : base;
  }

  return `${lieuxTexte} · ${equipementTexte}`;
}
