// domain/monCorps/zones.ts
// =============================================================================
// LE REFERENTIEL DES ZONES DE « MON CORPS » — ET POURQUOI IL VIT ICI
// =============================================================================
//
// La source de verite des zones reste `shared/injuryMapping.ts`, qui DOIT
// rester byte-identique a sa copie backend (`src/shared/injuryMapping.ts`) ;
// un test le verifie (`shared/__tests__/injuryMapping.parity.test.ts`).
//
// La decision D11 demande d'ajouter la zone « aine / adducteurs » (pubalgie,
// blessure tres frequente au football). Le jeton backend correspondant,
// `groin_pain`, EXISTE DEJA cote moteur : il est declare dans
// `BackendPainToken` du fichier partage et dans `Contraindication` de la banque
// d'exercices backend, et des exercices sont deja annotes avec. Ce qui manquait
// n'etait pas le moteur : c'etait la zone francaise que le joueur peut cocher.
//
// Le lot 1 est **front uniquement** (perimetre §7 du design). Ecrire
// `aine: "groin_pain"` DANS le fichier partage ferait diverger le front du
// backend et casserait la parite byte-a-byte. Ce fichier ajoute donc la zone
// DU COTE QUI PRESERVE LA PARITE : une couche front qui etend le mapping
// partage sans y toucher. Le contrat reseau est inchange — le backend recoit
// `groin_pain`, un jeton qu'il connait deja.
//
// Le jour ou une PR backend jumelle ajoutera `aine` au fichier partage, ce
// fichier se reduira a `BODY_AREAS` + les libelles : le `...INJURY_AREA_TO_
// BACKEND_PAIN` recouvrira deja l'entree, et rien d'autre ne bougera.
// =============================================================================

import type { BodyArea, BodyInjurySeverity } from "../types";
import {
  INJURY_AREA_TO_BACKEND_PAIN,
  type BackendPainToken,
} from "../../shared/injuryMapping";

/**
 * Les zones proposees au joueur, dans l'ordre d'affichage : du bas du corps
 * (ce qu'un footballeur se blesse) vers le haut, « autre » en dernier.
 */
export const BODY_AREAS: readonly BodyArea[] = [
  "cheville",
  "mollet",
  "genou",
  "ischio",
  "quadriceps",
  "aine",
  "hanche",
  "dos",
  "épaule",
  "poignet",
  "autre",
];

/**
 * Les 10 zones du referentiel PARTAGE avec le backend (= `InjuryAreaFR`).
 * « aine » en est exclue : elle est front-only tant que la PR backend jumelle
 * n'a pas ajoute la zone au fichier partage (cf. en-tete).
 */
export const ZONES_PARTAGEES: readonly BodyArea[] = BODY_AREAS.filter((z) => z !== "aine");

/**
 * Mapping zone -> jeton backend. Reprend le mapping partage a l'identique et
 * y ajoute la seule entree front (`aine`), cf. en-tete.
 * « autre » reste volontairement absent : sans zone precise, aucun filtre
 * d'exercice ne peut s'appliquer — seul le plafond d'intensite protege.
 */
export const BODY_AREA_TO_BACKEND_PAIN: Partial<Record<BodyArea, BackendPainToken>> = {
  ...INJURY_AREA_TO_BACKEND_PAIN,
  aine: "groin_pain",
};

/** Conversion tolerante (casse, espaces). `null` = zone non filtrable. */
export function mapBodyAreaToPain(zone: string | null | undefined): BackendPainToken | null {
  if (!zone) return null;
  const cle = String(zone).trim().toLowerCase() as BodyArea;
  return BODY_AREA_TO_BACKEND_PAIN[cle] ?? null;
}

/** `true` si la valeur est une zone declarable. */
export function estZoneConnue(valeur: unknown): valeur is BodyArea {
  return typeof valeur === "string" && (BODY_AREAS as readonly string[]).includes(valeur);
}

/** Libelle affiche au joueur pour chaque zone. */
export const LIBELLE_ZONE: Readonly<Record<BodyArea, string>> = {
  cheville: "Cheville",
  mollet: "Mollet",
  genou: "Genou",
  ischio: "Ischio-jambiers",
  quadriceps: "Quadriceps",
  aine: "Aine / adducteurs",
  hanche: "Hanche",
  dos: "Dos",
  "épaule": "Épaule",
  poignet: "Poignet",
  autre: "Autre",
};

/**
 * L'echelle de gravite en mots de joueur (decision D7). Chaque cran dit ce
 * qu'il declenche : le 3 annonce honnetement qu'il n'y aura pas de seance.
 * Les VALEURS envoyees au moteur restent 1/2/3.
 */
export const LIBELLE_GRAVITE: Readonly<Record<BodyInjurySeverity, string>> = {
  1: "Gêne légère — je peux jouer",
  2: "Douleur nette — je m'adapte",
  3: "Blessure — je ne peux pas jouer",
};

/** Version courte, pour une ligne de carte deja chargee. */
export const LIBELLE_GRAVITE_COURT: Readonly<Record<BodyInjurySeverity, string>> = {
  1: "Gêne légère",
  2: "Douleur nette",
  3: "Blessure",
};

export const LIBELLE_STATUT = {
  active: "Toujours là",
  recovering: "En reprise",
  healed: "C'est guéri",
} as const;

/**
 * Ce qu'on dit franchement de « autre » : FKS pourra alleger la seance, mais
 * ne pourra ecarter aucun exercice precis (aucun jeton backend, §T6).
 */
export const AVERTISSEMENT_ZONE_AUTRE =
  "Sans zone précise, FKS peut alléger ta séance mais pas écarter d'exercice en particulier.";

/**
 * Ce qu'on dit franchement du cran 3 (P1 round 2) : une gêne `active` de
 * gravité 3 déclenche le refus de sécurité du moteur (blessure grave), SANS expiration
 * (le payload suit le statut, pas une fenêtre — décision D12). Le laisser
 * deviner serait le piège identique à celui de l'erratum 2 du design : inviter
 * à déclarer une gêne forte sans dire ce que ça produit. La sortie existe et
 * est nommée : baisser la gravité ou passer en reprise/guéri, ici même.
 */
export const AVERTISSEMENT_GRAVITE_3 =
  "Pas de séance tant que cette gêne reste à ce niveau.";

/**
 * Ce qui reste vrai sur le stockage, et rien de plus (erratum 3 du design) :
 * le DETAIL des blessures ne quitte pas l'appareil. La douleur 0-5 du feedback,
 * elle, est synchronisee — cette phrase ne la couvre pas et ne doit jamais
 * etre reutilisee ailleurs que sur l'ecran « Mon corps ».
 */
export const LIGNE_STOCKAGE_LOCAL =
  "Ces informations restent sur ton téléphone. Ton coach ne les voit pas.";

/** Les libelles de source, pour la ligne de meta d'une carte. */
export const LIBELLE_SOURCE = {
  feedback: "depuis un feedback",
  manual: "déclarée ici",
  setup: "déclarée à l'inscription",
} as const;

