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
// LA VARIANTE EST FIGEE A "v2", ET LE DEMARRAGE EST PILOTE PAR LE DRAPEAU
// `HOME_FEATURES.DEMARRAGE_PREMIERE_MISSION` (OFF depuis la decision Kyllian
// du 04/08 : ecran normal des le jour 1, config/homeFeatures.ts) : ce sont
// deux decisions fermees du fondateur, pas des options d'appelant. Elles sont
// posees une seule fois, dans `useHomeVNextViewModel`, pour que l'option du
// ViewModel et la prop de l'ecran ne puissent pas diverger (le piege D1
// documente dans l'ecran).
//
// C'EST AUSSI ICI QUE VIT LE RETOUR HAPTIQUE, ET NULLE PART AILLEURS.
// `components/homeVNext/HomeVNextPrimitives.tsx` (regle 3 de son entete) refuse
// d'importer `useHaptics` : le hook tire `expo-haptics` et `state/settingsStore`
// (donc AsyncStorage), ce qu'un composant qui doit aussi se rendre hors de
// l'app ne peut pas embarquer. Son entete annonce le rebranchement « dans les
// callbacks passes en props ». Ces callbacks sont les trois ci-dessous : c'est
// donc ici, et la reprise en production etait le moment prevu.
//
// Sans ca, le nouvel accueil serait le seul ecran muet de l'app : l'ancien CTA
// vibrait (`components/home/HomePrimaryCTA.tsx`), et tout ce qui passe par
// `components/ui/Button` vibre — le vNext, lui, ne passe par aucun des deux
// (Pressable brut, pour porter `accessibilityRole`).
//
// UN ECART ASSUME AVEC L'ANCIEN ACCUEIL : il vibrait a `onPressIn` (au contact),
// ici c'est a `onPress` (au relachement, puisque c'est la que le callback
// arrive). Quelques dizaines de millisecondes plus tard, et seulement si le
// doigt ne glisse pas hors de la cible — ce qui est le comportement correct :
// un tap annule ne doit rien declencher du tout, vibration comprise.
//
// `useHaptics()` porte deja les deux garde-fous, on ne les redemande pas ici :
// il se tait si le joueur a coupe les vibrations dans les Reglages, et il se
// tait si « reduire les animations » est actif.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigation } from "@react-navigation/native";

import { HomeVNextScreen } from "./HomeVNextScreen";
import type { ActionTarget } from "./viewModel";
import { useHomeVNextViewModel } from "../../hooks/home/useHomeVNextViewModel";
import {
  resoudreDestinationHome,
  type ContexteNavigationHome,
} from "../../hooks/home/homeVNextNavigation";
import { useHaptics } from "../../hooks/useHaptics";
import { useNavGuard } from "../../hooks/useNavGuard";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { showToast } from "../../utils/toast";

type Nav = { navigate: (route: string, params?: Record<string, unknown>) => void };

export function HomeVNextContainer() {
  const nav = useNavigation() as unknown as Nav;
  const guardNav = useNavGuard();
  const haptics = useHaptics();

  const { vm, progression, entree } = useHomeVNextViewModel();

  // Le contenu `fks.next_session.v2` n'est PAS dans le ViewModel — une couche de
  // presentation n'a pas a transporter le JSON complet d'une seance. Il est donc
  // relu ici, au moment du tap, exactement comme le fait l'ancien Home.
  const sessions = useSessionsStore((s) => s.sessions);
  const lastAiSessionV2 = useSessionsStore((s) => s.lastAiSessionV2);

  // `useHaptics()` reconstruit son objet a CHAQUE rendu (il renvoie un litteral
  // de six fonctions fleches). Le mettre en dependance de `useCallback` recreerait
  // `executer` a chaque rendu et viderait la memoisation de son sens, alors que
  // ce callback descend loin dans l'arbre. On tient donc une reference stable,
  // mise a jour dans un effet — jamais pendant le rendu, `react-hooks/refs`
  // l'interdit et le depot s'est deja fait mordre par la (voir le commentaire de
  // `components/homeVNext/homeVNextPresentation.tsx`).
  const hapticsRef = useRef(haptics);
  useEffect(() => {
    hapticsRef.current = haptics;
  }, [haptics]);

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
          // Le doigt part quelque part : meme impulsion legere que l'ancien CTA.
          hapticsRef.current.impactLight();
          guardNav(() => nav.navigate(instruction.route, instruction.params));
          return;
        case "indisponible":
          // Le doigt ne part nulle part et un bandeau d'avertissement s'affiche :
          // la vibration doit le DIRE, sinon le joueur croit avoir mal tape et
          // retape. C'est le seul endroit de l'ecran ou le retour n'est pas une
          // simple impulsion.
          hapticsRef.current.warning();
          // PAS de `guardNav` ici : la garde ne se rearme qu'au prochain focus
          // d'ecran, et on ne quitte pas l'ecran. L'y faire passer condamnerait
          // le CTA jusqu'a ce que le joueur aille ailleurs et revienne — la
          // regle est ecrite dans `hooks/useNavGuard.ts`.
          showToast({ type: "warn", title: instruction.titre, message: instruction.message });
          return;
        case "aucune":
          // Rien ne se passe, donc rien ne vibre : une vibration qui ne mene a
          // rien apprend au joueur a s'en mefier.
          return;
      }
    },
    [contexte, guardNav, nav]
  );

  const ouvrirProgression = useCallback(() => {
    hapticsRef.current.impactLight();
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
