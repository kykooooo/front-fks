// components/homeVNext/homeVNextPresentation.tsx
// =============================================================================
// PROTOTYPE Home vNext — LES PREFERENCES DE PRESENTATION
// =============================================================================
//
// Deux reglages, et un seul endroit ou ils vivent :
//
//   - `echelle`      : laquelle des deux echelles typographiques est rendue ;
//   - `reduceMotion` : le joueur a-t-il demande « reduire les animations » ?
//
// POURQUOI ILS NE SONT PAS DANS LE VIEWMODEL
// -----------------------------------------------------------------------------
// `screens/homeVNext/viewModel.ts` repond a une seule question : « qu'est-ce que
// l'ecran a le DROIT d'afficher ? ». Elle porte sur la DONNEE — combien de
// seances, quelle tendance, quelle portee. Aucune de ces deux preferences ne
// change un mot de ce qui est affiche : elles changent comment c'est pose.
// Les melanger obligerait a ajouter deux champs a `HomeVNextInput` et donc a
// modifier les 15 fixtures, qui sont des donnees de JOUEUR — un reglage
// d'accessibilite du telephone n'est pas une donnee de joueur.
//
// COMMENT `reduceMotion` SERA ALIMENTE EN VRAI
// -----------------------------------------------------------------------------
// Le prototype n'a pas d'API systeme : c'est la fixture (ou le visualiseur) qui
// pilote le drapeau. A l'integration, le branchement est celui que
// `screens/HomeScreen.tsx` (lignes 72-73) fait deja pour son fondu d'entree :
//
//     const [reduceMotion, setReduceMotion] = React.useState(false);
//     React.useEffect(() => {
//       let vivant = true;
//       AccessibilityInfo.isReduceMotionEnabled().then((v) => {
//         if (vivant) setReduceMotion(v);
//       });
//       const abo = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
//       return () => { vivant = false; abo.remove(); };
//     }, []);
//
// L'ecoute de `reduceMotionChanged` est en plus : le Home de production ne lit
// la preference qu'une fois, au montage. Un joueur qui active le reglage pendant
// que l'app tourne n'est donc pas servi tant qu'il ne quitte pas l'ecran.
//
// CE QUE CE FICHIER INTERDIT, ET C'EST LE POINT
// -----------------------------------------------------------------------------
// `components/home/HomePrimaryCTA.tsx` (lignes 39-49) lance un `Animated.loop`
// INFINI — une pulsation d'echelle 1 -> 1,015, 900 ms dans chaque sens — SANS
// jamais consulter `reduceMotion`, alors que l'ecran qui l'accueille le consulte
// pour son fondue d'entree. Un joueur qui a demande « reduire les animations »
// voit donc son bouton principal pulser en permanence. C'est un vrai defaut de
// production, hors du perimetre de ce prototype : il n'est pas corrige ici.
//
// LE PROTOTYPE, LUI, N'A AUCUNE BOUCLE — ni pulsation d'attention, ni respiration,
// ni clignotement — et ne doit jamais en gagner une. Ses seules animations sont
// des reponses au doigt (l'enfoncement d'un bouton), qui n'existent pas tant que
// personne ne touche l'ecran. La regle et son test vivent ci-dessous.
// =============================================================================

import React from "react";
import { Animated } from "react-native";

import { ECHELLE_PAR_DEFAUT, ECHELLES, type EchelleTypo, type EchelleTypoId } from "./homeVNextTypo";

// -----------------------------------------------------------------------------
// 1. LE CONTRAT
// -----------------------------------------------------------------------------

export type PreferencesPresentation = {
  /** Echelle typographique rendue. */
  echelle: EchelleTypoId;
  /**
   * `true` quand le joueur a active « reduire les animations » sur son
   * telephone. Consequence sur cet ecran : AUCUN mouvement. Voir `REGLE_MOUVEMENT`.
   */
  reduceMotion: boolean;
};

/**
 * Ce que rend le prototype quand personne ne precise rien.
 *
 * `reduceMotion: false` est le defaut du SYSTEME, pas un souhait : la grande
 * majorite des telephones n'a pas le reglage actif. Le prototype se comporte
 * donc comme un telephone ordinaire tant qu'on ne lui dit pas le contraire.
 */
export const PRESENTATION_PAR_DEFAUT: PreferencesPresentation = {
  echelle: ECHELLE_PAR_DEFAUT,
  reduceMotion: false,
};

const ContextePresentation = React.createContext<PreferencesPresentation>(
  PRESENTATION_PAR_DEFAUT
);

/**
 * Les quatre reglages a comparer, pretes a etre servies par le visualiseur.
 *
 * L'agent qui branche la bascule n'a besoin de rien d'autre : chaque entree se
 * passe telle quelle a `HomeVNextScreen` (`echelle` et `reduceMotion` sont deux
 * props de l'ecran) ou a `HomeVNextPresentation`.
 *
 * Elles vivent ICI et non dans `screens/homeVNext/fixtures.ts` : une fixture
 * decrit un JOUEUR (ses seances, sa charge, ses tests). Un reglage
 * d'accessibilite du telephone n'est pas une donnee de joueur, et le melanger
 * aux fixtures obligerait a en inventer une par combinaison.
 */
export const PRESENTATIONS_A_COMPARER: readonly {
  id: string;
  titre: string;
  resume: string;
  preferences: PreferencesPresentation;
}[] = [
  {
    id: "allegee",
    titre: "Échelle allégée",
    resume:
      "Ce que le fondateur a demandé, et ce que le prototype rend par défaut. Aucune graisse 800 sur l'écran.",
    preferences: { echelle: "allegee", reduceMotion: false },
  },
  {
    id: "actuelle",
    titre: "Échelle actuelle (comparaison)",
    resume:
      "L'écran exactement tel qu'il était à l'itération précédente. Cinq rôles en graisse 800.",
    preferences: { echelle: "actuelle", reduceMotion: false },
  },
  {
    id: "allegee-mouvement-reduit",
    titre: "Échelle allégée + « réduire les animations »",
    resume:
      "Le réglage d'accessibilité est actif : plus aucun mouvement, et l'action du jour reste identifiable à l'arrêt.",
    preferences: { echelle: "allegee", reduceMotion: true },
  },
  {
    id: "actuelle-mouvement-reduit",
    titre: "Échelle actuelle + « réduire les animations »",
    resume:
      "Le même réglage sur l'ancienne échelle : les deux axes sont indépendants, on peut les regarder séparément.",
    preferences: { echelle: "actuelle", reduceMotion: true },
  },
];

export type HomeVNextPresentationProps = {
  /** Defaut : `ECHELLE_PAR_DEFAUT` (« allegee »). */
  echelle?: EchelleTypoId;
  /** Defaut : `false`. */
  reduceMotion?: boolean;
  children: React.ReactNode;
};

/**
 * Pose les preferences pour tout le sous-arbre. L'ecran l'installe lui-meme a
 * partir de ses props : un composant monte seul (dans un test, dans le
 * visualiseur) recoit les valeurs par defaut sans rien avoir a declarer.
 */
export function HomeVNextPresentation({
  echelle,
  reduceMotion,
  children,
}: HomeVNextPresentationProps) {
  const valeur = React.useMemo<PreferencesPresentation>(
    () => ({
      echelle: echelle ?? PRESENTATION_PAR_DEFAUT.echelle,
      reduceMotion: reduceMotion ?? PRESENTATION_PAR_DEFAUT.reduceMotion,
    }),
    [echelle, reduceMotion]
  );
  return (
    <ContextePresentation.Provider value={valeur}>{children}</ContextePresentation.Provider>
  );
}

export function usePresentation(): PreferencesPresentation {
  return React.useContext(ContextePresentation);
}

/** Identifiant de l'echelle en cours. */
export function useEchelleId(): EchelleTypoId {
  return usePresentation().echelle;
}

/** Les valeurs de l'echelle en cours (rarement utile : preferer `useStylesEchelle`). */
export function useEchelle(): EchelleTypo {
  return ECHELLES[usePresentation().echelle];
}

/**
 * `true` quand le joueur a demande moins d'animations.
 *
 * Utilise a UN seul endroit dans le prototype : decider si l'enfoncement de
 * l'action du jour se traduit par un mouvement d'echelle ou non.
 */
export function useReduceMotion(): boolean {
  return usePresentation().reduceMotion;
}

// -----------------------------------------------------------------------------
// 2. LES STYLES, UNE FOIS PAR ECHELLE
// -----------------------------------------------------------------------------

/**
 * Construit les deux jeux de styles d'un composant, UNE SEULE FOIS, au
 * chargement du module.
 *
 * `StyleSheet.create` est evalue a l'import : des styles figes ne peuvent pas
 * basculer d'une echelle a l'autre au moment du rendu. On prepare donc les deux
 * jeux, et le composant lit celui de l'echelle en cours — sans reconstruire quoi
 * que ce soit a chaque rendu.
 *
 * @example
 *   const STYLES = stylesParEchelle((t) => StyleSheet.create({ titre: { ...t.salutation } }));
 *   // dans le composant :
 *   const styles = useStylesEchelle(STYLES);
 */
export function stylesParEchelle<T>(fabrique: (echelle: EchelleTypo) => T): Record<
  EchelleTypoId,
  T
> {
  return {
    actuelle: fabrique(ECHELLES.actuelle),
    allegee: fabrique(ECHELLES.allegee),
  };
}

/** Le jeu de styles correspondant a l'echelle en cours. */
export function useStylesEchelle<T>(table: Record<EchelleTypoId, T>): T {
  return table[useEchelleId()];
}

// =============================================================================
// 3. LE MOUVEMENT
// =============================================================================

/**
 * La regle, en toutes lettres. Elle est exportee pour que le visualiseur puisse
 * l'afficher au fondateur, et pour qu'un futur lecteur du code n'ait pas a la
 * deviner.
 */
export const REGLE_MOUVEMENT = [
  "Aucune boucle d'animation, jamais, quel que soit le reglage du telephone. Le prototype n'a ni pulsation d'attention, ni respiration, ni clignotement : un bouton qui bouge tout seul demande de l'attention sans rien apprendre.",
  "Les seules animations sont des reponses au doigt : elles commencent au contact et se terminent au relachement. Rien ne bouge tant que personne ne touche l'ecran.",
  "Quand « reduire les animations » est actif : AUCUN deplacement, AUCUN changement d'echelle. L'enfoncement reste signale par un assombrissement (un fondu n'est pas un mouvement — c'est d'ailleurs ce que le systeme lui-meme substitue aux transitions glissees).",
  "Aucune information n'est portee par un mouvement : l'action du jour reste identifiable a l'arret, par son aplat colore, son libelle et son chevron.",
] as const;

/**
 * L'animation d'enfoncement, partagee par les trois elements tapables du
 * prototype (l'aplat d'action, le lien secondaire, le pied de la carte
 * progression).
 *
 * Retourne une valeur animee de 0 (au repos) a 1 (enfonce) et ses deux
 * declencheurs. Ce que le composant en fait — assombrir, estomper, reduire —
 * lui appartient ; ce hook garantit seulement qu'il n'y a rien d'autre.
 *
 * IL N'Y A AUCUN `useEffect` ICI, ET C'EST VOLONTAIRE : rien ne se declenche au
 * montage, donc aucune animation ne peut demarrer toute seule.
 */
export function usePressionAnimee(): {
  pression: Animated.Value;
  onPressIn: () => void;
  onPressOut: () => void;
} {
  // `useState` avec initialiseur paresseux plutot que `useRef(...).current` :
  // meme stabilite, mais on ne lit pas un ref pendant le rendu (regle
  // `react-hooks/refs`, que le pattern de `components/ui/Button.tsx` enfreint).
  const [pression] = React.useState(() => new Animated.Value(0));

  const onPressIn = React.useCallback(() => {
    Animated.timing(pression, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, [pression]);

  const onPressOut = React.useCallback(() => {
    Animated.timing(pression, { toValue: 0, duration: 100, useNativeDriver: true }).start();
  }, [pression]);

  return { pression, onPressIn, onPressOut };
}

/**
 * Le style de reduction d'echelle a l'enfoncement — ou RIEN si le joueur a
 * demande moins d'animations.
 *
 * `null` et non un transform neutre : un `transform: [{ scale: 1 }]` resterait
 * un transform, il serait present dans l'arbre rendu, et le test ne pourrait
 * plus distinguer « aucun mouvement » de « un mouvement qui ne bouge pas ».
 */
export function transformDePression(
  pression: Animated.Value,
  reduceMotion: boolean,
  echelleEnfoncee: number
): { transform: [{ scale: Animated.AnimatedInterpolation<number> }] } | null {
  if (reduceMotion) return null;
  return {
    transform: [
      { scale: pression.interpolate({ inputRange: [0, 1], outputRange: [1, echelleEnfoncee] }) },
    ],
  };
}
