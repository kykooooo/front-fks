// screens/homeVNext/HomeVNextContainer.tsx
// =============================================================================
// LE CONTENEUR — CE QUI TRANSFORME UN PROTOTYPE EN ECRAN D'APPLICATION
// =============================================================================
//
// `HomeVNextScreen` ne lit aucun store et ne navigue nulle part : il recoit un
// ViewModel et des callbacks. Ce fichier est le seul endroit qui referme les
// deux bouts — il branche `useHomeVNextViewModel()` (les vrais stores, lot L2)
// sur `useNavigation()` (les vraies routes).
//
// IL NE CONTIENT AUCUNE REGLE D'AFFICHAGE, et c'est verifiable a l'oeil : il n'y
// a pas un seul libelle, pas un seul seuil, pas un seul `if` sur des donnees
// metier dans ce fichier. Tout ce qui se decide se decide ailleurs :
//   - QUOI afficher              -> `screens/homeVNext/viewModel.ts` (pur)
//   - OU va chaque action        -> `hooks/home/homeVNextNavigation.ts` (pur)
//   - COMMENT c'est rendu        -> `screens/homeVNext/HomeVNextScreen.tsx`
//
// LA VARIANTE EST FIGEE A "v2" ET LE DEMARRAGE A "A" : ce sont deux decisions
// fermees du fondateur, pas des options d'appelant. Elles sont posees une seule
// fois, dans `useHomeVNextViewModel`, pour que l'option du ViewModel et la prop
// de l'ecran ne puissent pas diverger (le piege D1 documente dans l'ecran).
// =============================================================================

import React, { useCallback, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";

import { HomeVNextScreen } from "./HomeVNextScreen";
import type { ActionTarget } from "./viewModel";
import { useHomeVNextViewModel } from "../../hooks/home/useHomeVNextViewModel";
import {
  resoudreDestinationHome,
  type ContexteNavigationHome,
} from "../../hooks/home/homeVNextNavigation";
import { useNavGuard } from "../../hooks/useNavGuard";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { showToast } from "../../utils/toast";

type Nav = { navigate: (route: string, params?: Record<string, unknown>) => void };

export function HomeVNextContainer() {
  const nav = useNavigation() as unknown as Nav;
  const guardNav = useNavGuard();

  const { vm, progression, entree } = useHomeVNextViewModel();

  // Le contenu `fks.next_session.v2` n'est PAS dans le ViewModel — une couche de
  // presentation n'a pas a transporter le JSON complet d'une seance. Il est donc
  // relu ici, au moment du tap, exactement comme le fait l'ancien Home.
  const sessions = useSessionsStore((s) => s.sessions);
  const lastAiSessionV2 = useSessionsStore((s) => s.lastAiSessionV2);

  const contexte = useMemo<ContexteNavigationHome>(
    () => ({
      pendingSessionId: entree.pendingSession?.id ?? null,
      sessions: sessions ?? [],
      lastAiSessionV2: (lastAiSessionV2 ?? null) as { v2: Record<string, unknown> } | null,
    }),
    [entree.pendingSession, sessions, lastAiSessionV2]
  );

  const executer = useCallback(
    (cible: ActionTarget) => {
      const instruction = resoudreDestinationHome(cible, contexte);
      switch (instruction.kind) {
        case "navigate":
          guardNav(() => nav.navigate(instruction.route, instruction.params));
          return;
        case "indisponible":
          // PAS de `guardNav` ici : la garde ne se rearme qu'au prochain focus
          // d'ecran, et on ne quitte pas l'ecran. L'y faire passer condamnerait
          // le CTA jusqu'a ce que le joueur aille ailleurs et revienne — la
          // regle est ecrite dans `hooks/useNavGuard.ts`.
          showToast({ type: "warn", title: instruction.titre, message: instruction.message });
          return;
        case "aucune":
          return;
      }
    },
    [contexte, guardNav, nav]
  );

  const ouvrirProgression = useCallback(() => {
    guardNav(() => nav.navigate("Progression"));
  }, [guardNav, nav]);

  return (
    <HomeVNextScreen
      vm={vm}
      variante="v2"
      progression={progression}
      onAction={executer}
      onSecondaryAction={executer}
      onExit={ouvrirProgression}
      // `reduceMotion` et `echelle` ne sont PAS passes : sans surcharge,
      // `HomeVNextPresentation` lit le reglage reel du telephone via
      // `hooks/useReduceMotion`, et rend l'echelle allegee imposee par le
      // fondateur. Passer une valeur ici, meme la bonne, couperait le joueur de
      // son propre reglage d'accessibilite.
      //
      // `largeurCourbe` non plus : dans l'app, `onLayout` mesure tout seul. La
      // prop n'existe que pour les rendus en une passe (captures serveur).
    />
  );
}
