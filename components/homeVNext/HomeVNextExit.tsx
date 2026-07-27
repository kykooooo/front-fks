// components/homeVNext/HomeVNextExit.tsx
// =============================================================================
// SECTION 6 — LA SORTIE
// =============================================================================
//
// Une ligne, et c'est fini. Doctrine 9 : le bas de l'ecran finit TOT — pas de
// grande carte finale, pas de deuxieme action principale, pas de repetition du
// cycle, pas de metrique de remplissage.
//
// Ce lien n'apparait pas toujours : le ViewModel met `exit` a `null` tant que la
// destination n'a rien a montrer. C'est le defaut E8 de l'audit — "Voir ma
// progression" toujours actif, menant a un ecran ou tout est verrouille.
// =============================================================================

import React from "react";
import type { ExitLink } from "../../screens/homeVNext/viewModel";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { HomeVNextLink } from "./HomeVNextPrimitives";

export type HomeVNextExitProps = {
  exit: NonNullable<ExitLink>;
  onPress?: (target: "progression") => void;
};

export function HomeVNextExit({ exit, onPress }: HomeVNextExitProps) {
  return (
    <HomeVNextLink
      label={exit.label}
      onPress={() => onPress?.(exit.target)}
      accessibilityHint="Ouvre ton écran de progression"
      testID={MARQUEURS.lienSortie}
    />
  );
}
