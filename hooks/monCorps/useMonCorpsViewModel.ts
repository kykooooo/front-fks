// hooks/monCorps/useMonCorpsViewModel.ts
//
// CE QUE L'ECRAN « MON CORPS » A LE DROIT D'AFFICHER.
//
// L'ecran ne lit aucun store (CLAUDE.md regle 10) : il recoit ce ViewModel.
// Tout ce qui est ici est soit une donnee reelle, soit une absence dite comme
// telle. Il n'y a AUCUN compteur : ni « 0 blessure », ni « 3 gênes cette
// saison ». Un compteur sur des declarations faites au doigt mouille, c'est un
// chiffre faux qui a l'air vrai (decision D9).
//
// Il n'y a pas de DECOMPTE DE RELANCE affiche au joueur : la relance sait
// qu'une gene date de sept jours ; elle lui demande « où en es-tu ? », elle ne
// lui recite pas ce chiffre-la (voir `aRelancer`, sans age affiche). La DATE
// RELATIVE de declaration (`dateRelative`, « il y a 4 jours »), elle, EST
// affichee sur chaque carte — c'est un repere pour le joueur, pas un
// decompte qui pousse vers une echeance.

import { useMemo } from "react";

import type { BodyInjury } from "../../domain/types";
import {
  LIBELLE_GRAVITE,
  LIBELLE_GRAVITE_COURT,
  LIBELLE_SOURCE,
  LIBELLE_ZONE,
} from "../../domain/monCorps/zones";
import {
  genesARelancer,
  genesEnCours,
  genesPassees,
  useBlessures,
} from "../../state/selectors/blessures";
import { useDebugStore } from "../../state/stores/useDebugStore";
import { formatDateRelativeFR, toDateKey } from "../../utils/dateHelpers";

export type LigneGene = {
  id: string;
  zoneLabel: string;
  graviteLabel: string;
  graviteLabelCourt: string;
  gravite: 1 | 2 | 3;
  statut: BodyInjury["statut"];
  /** « hier », « il y a 4 jours »… ou `null` si la date est illisible. */
  dateRelative: string | null;
  sourceLabel: string;
  note: string | null;
  /** `true` quand cette gene attend une reponse du joueur (relance a 7 j). */
  aRelancer: boolean;
};

export type MonCorpsViewModel = {
  /** `true` quand rien n'est declare : l'ecran affiche un etat, pas un zero. */
  vide: boolean;
  enCours: LigneGene[];
  passees: LigneGene[];
  /** Les genes qui attendent une reponse. Vide = personne a relancer. */
  aRelancer: LigneGene[];
};

function versLigne(gene: BodyInjury, todayKey: string, idsARelancer: Set<string>): LigneGene {
  return {
    id: gene.id,
    zoneLabel: LIBELLE_ZONE[gene.zone] ?? gene.zone,
    graviteLabel: LIBELLE_GRAVITE[gene.gravite],
    graviteLabelCourt: LIBELLE_GRAVITE_COURT[gene.gravite],
    gravite: gene.gravite,
    statut: gene.statut,
    dateRelative: formatDateRelativeFR(gene.declaredAt, todayKey),
    sourceLabel: LIBELLE_SOURCE[gene.source],
    // Note ABSENTE = `null`, jamais une chaine vide affichee comme un contenu.
    note: gene.note && gene.note.trim() ? gene.note.trim() : null,
    aRelancer: idsARelancer.has(gene.id),
  };
}

/**
 * PURE : la construction du ViewModel, testable sans store ni rendu.
 * Le hook ci-dessous ne fait que lui donner l'etat courant.
 */
export function construireMonCorpsViewModel(
  blessures: readonly BodyInjury[],
  todayKey: string
): MonCorpsViewModel {
  const idsARelancer = new Set(genesARelancer(blessures, todayKey).map((b) => b.id));

  const enCours = genesEnCours(blessures).map((b) => versLigne(b, todayKey, idsARelancer));
  const passees = genesPassees(blessures).map((b) => versLigne(b, todayKey, idsARelancer));

  return {
    // `vide` est un ETAT a part entiere, pas un compteur a zero deguise :
    // l'ecran affiche une phrase, jamais « 0 gene ».
    vide: enCours.length === 0 && passees.length === 0,
    enCours,
    passees,
    aRelancer: enCours.filter((l) => l.aRelancer),
  };
}

export function useMonCorpsViewModel(): MonCorpsViewModel {
  const blessures = useBlessures();
  const devNowISO = useDebugStore((s) => s.devNowISO);

  return useMemo(
    () => construireMonCorpsViewModel(blessures, toDateKey(devNowISO ?? new Date())),
    [blessures, devNowISO]
  );
}
