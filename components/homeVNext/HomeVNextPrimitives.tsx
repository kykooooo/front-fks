// components/homeVNext/HomeVNextPrimitives.tsx
// =============================================================================
// PROTOTYPE Home vNext — BRIQUES PARTAGEES
// =============================================================================
//
// Trois regles gouvernent ce fichier :
//
//  1. AUCUNE POLICE D'ICONE. Le chevron et la coche sont dessines avec des
//     `View` et des bordures. Raison : le prototype doit rendre a l'identique
//     dans l'app ET dans le visualiseur web. Le harnais de l'audit rendait les
//     Ionicons en carres gris ; un chevron en bordure, lui, est exact partout.
//
//  2. TOUT ELEMENT TACTILE A UN ROLE. `components/ui/Button` ne transmet PAS
//     `accessibilityRole` a son `Pressable` (verifie ligne a ligne dans
//     `components/ui/Button.tsx`) : un lien construit dessus est annonce comme
//     du texte inerte par VoiceOver. C'est exactement la classe de defaut que
//     l'audit reproche au Home (zero propriete d'accessibilite). D'ou
//     `HomeVNextLink` ci-dessous, qui pose `accessibilityRole="link"` et le
//     plancher tactile de 44 pt.
//
//  3. AUCUN HAPTIC ICI — MAIS L'ECRAN VIBRE. La convention du projet est
//     `useHaptics()` et rien d'autre ; or ce hook importe `expo-haptics` et
//     `state/settingsStore` (donc AsyncStorage). Un composant qui doit aussi se
//     rendre hors de l'app ne peut pas embarquer ca.
//     Le rebranchement annonce ici A EU LIEU, a l'endroit prevu : dans les
//     callbacks passes en props, c'est-a-dire
//     `screens/homeVNext/HomeVNextContainer.tsx` — impulsion legere quand
//     l'action emmene quelque part, avertissement quand elle est indisponible,
//     silence quand elle ne fait rien. Verrouille par
//     `__tests__/homeVNext/haptiqueConteneur.test.tsx`.
//     DONC : ne pas ajouter d'appel haptique dans ce fichier, il en resulterait
//     une double vibration sur chaque tap.
//
//  4. LE TITRE DE SECTION EST DESSINE ICI, PLUS PAR `components/ui/SectionHeader`.
//     Ce composant du socle code sa typographie en dur (13 / 800 / tracking 1,2)
//     et n'accepte aucun style de texte. L'echelle demandee par le fondateur
//     pose ces labels a 12 / 700 / tracking 0,8 : il n'y avait aucun moyen de
//     l'appliquer sans modifier un fichier hors perimetre. `EnteteSection`
//     ci-dessous reprend donc EXACTEMENT sa structure — meme marque bleue de
//     3 x 14 px, meme rayon, meme espacement de 8, meme mise en capitales — et
//     ne change que ce que l'echelle change. En echelle « actuelle », le rendu
//     est identique a celui du socle.
// =============================================================================

import React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { theme } from "../../constants/theme";
import { Card } from "../ui/Card";
import {
  stylesParEchelle,
  usePressionAnimee,
  useStylesEchelle,
} from "./homeVNextPresentation";
import { plafondDuRole, type EchelleTypo } from "./homeVNextTypo";
import { couleurs, espacement, rayons, TAILLE_TACTILE_MIN } from "./homeVNextTokens";

// -----------------------------------------------------------------------------
// Chevron — dessine, jamais une police
// -----------------------------------------------------------------------------

type ChevronProps = {
  /** Cote du carre avant rotation. Le chevron visible fait environ `size` de haut. */
  size?: number;
  color: string;
  thickness?: number;
};

/** Chevron ">" : un carre dont on ne garde que deux bordures, pivote de 45 degres. */
export function Chevron({ size = 8, color, thickness = 2 }: ChevronProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderTopWidth: thickness,
        borderRightWidth: thickness,
        borderColor: color,
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}

// -----------------------------------------------------------------------------
// Coche — pastille de confirmation de l'accuse de reception
// -----------------------------------------------------------------------------

type CocheProps = { color: string; background: string };

/**
 * Coche dans une pastille. Volontairement sobre : pas de degrade, pas de
 * bordure, pas de "couture" — l'audit reproche au Home actuel un disque
 * decoratif dont l'assemblage se voit.
 */
export function Coche({ color, background }: CocheProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[stylesFixes.cocheDisque, { backgroundColor: background }]}
    >
      <View style={[stylesFixes.cocheTrait, { borderColor: color }]} />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Filet — separateur d'un cheveu
// -----------------------------------------------------------------------------

export function Filet({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[stylesFixes.filet, style]}
    />
  );
}

// -----------------------------------------------------------------------------
// Lien — la seule forme autorisee pour une action secondaire
// -----------------------------------------------------------------------------

type LienProps = {
  label: string;
  onPress?: () => void;
  /** Complete l'annonce vocale : "ouvre le detail de la seance". */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Marqueur stable pour les verifications automatiques. Rendu tel quel par
   * React Native (prop `testID`) et traduit en `data-testid` par
   * react-native-web : le meme marqueur sert donc dans les tests de composant
   * ET dans l'analyse du HTML genere par le harnais.
   */
  testID?: string;
};

/**
 * Lien texte + chevron. Jamais un aplat (doctrine 1 : une action secondaire est
 * visiblement moins forte que l'action principale).
 *
 * Plancher tactile : `minHeight` = 44 pt, garanti par le style, plus un
 * `hitSlop` lateral. L'audit releve 8 zones tactiles sur 8 sous 44 pt sur le
 * Home actuel.
 */
export function HomeVNextLink({ label, onPress, accessibilityHint, style, testID }: LienProps) {
  const styles = useStylesEchelle(STYLES);
  // Animation partagee : elle ne demarre qu'au contact du doigt, et il n'y a
  // aucune boucle nulle part (voir `REGLE_MOUVEMENT`).
  const { pression, onPressIn, onPressOut } = usePressionAnimee();

  // Un estompement, pas un mouvement : ce retour reste donc actif meme quand le
  // joueur a demande « reduire les animations ». Le systeme lui-meme remplace
  // ses transitions glissees par des fondus pour cette raison.
  const opacity = pression.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
      testID={testID}
      style={[styles.lien, style]}
    >
      <Animated.View style={[styles.lienContenu, { opacity }]}>
        {/*
          AUCUN plafond d'agrandissement : le libelle d'un lien dit ou il mene.
          C'est une information, elle doit grandir autant que le systeme le
          demande. La cible, elle, garde son plancher de 44 pt.
        */}
        <Text style={styles.lienTexte} numberOfLines={1} {...plafondDuRole("lien")}>
          {label}
        </Text>
        <Chevron color={couleurs.lien} size={7} thickness={1.8} />
      </Animated.View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Entete de section — l'unique convention de titrage
// -----------------------------------------------------------------------------

/**
 * Reprise fidele de `components/ui/SectionHeader`, avec la typographie de
 * l'echelle en cours.
 *
 * Ce qui est identique au socle, au pixel pres : la marque bleue (3 x 14, rayon
 * pilule, `theme.colors.accent`), l'espacement de 8 entre la marque et le titre,
 * la mise en capitales, la disposition en ligne avec la legende poussee a droite.
 * Ce qui change : la taille, la graisse et le tracking du titre viennent de
 * l'echelle au lieu d'etre ecrits en dur.
 */
function EnteteSection({ titre, legende }: { titre: string; legende?: React.ReactNode }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View style={styles.enteteLigne}>
      <View style={styles.enteteGroupe}>
        <View
          style={styles.enteteMarque}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        {/*
          Label decoratif en capitales : PLAFONNE a x1,15. Il annonce une
          section, il ne porte aucune information — le contenu qu'il annonce,
          lui, n'est borne nulle part.
        */}
        <Text style={styles.enteteTitre} numberOfLines={1} {...plafondDuRole("overline")}>
          {titre}
        </Text>
      </View>
      {legende ? <View>{legende}</View> : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Carte de section — UNE seule convention de titrage pour tout l'ecran
// -----------------------------------------------------------------------------

type CarteSectionProps = {
  /** Titre en capitales. Rendu par `components/ui/SectionHeader`. */
  titre: string;
  /** Legende alignee a droite du titre (ex : "7 derniers jours"). */
  legende?: string | null;
  children: React.ReactNode;
};

/**
 * L'audit releve 4 conventions de titrage differentes pour 4 blocs qui se
 * suivent. Ici il n'y en a qu'une : capitales + marque bleue, via le
 * `SectionHeader` du socle, strictement identique d'une section a l'autre.
 */
export function CarteSection({ titre, legende, children }: CarteSectionProps) {
  const styles = useStylesEchelle(STYLES);
  return (
    <Card variant="surface" style={styles.carte}>
      <EnteteSection
        titre={titre}
        legende={
          legende ? (
            // Metadonnee ("7 derniers jours") : aucun plafond.
            <Text style={styles.legende} numberOfLines={1}>
              {legende}
            </Text>
          ) : null
        }
      />
      <View style={styles.carteContenu}>{children}</View>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Les styles, une fois par echelle (voir `stylesParEchelle`).
// -----------------------------------------------------------------------------

/**
 * Ce qui ne depend d'AUCUNE echelle : des formes dessinees, sans une lettre.
 * Elles restent au niveau du module — les dupliquer par echelle donnerait deux
 * objets identiques et laisserait croire qu'ils peuvent diverger.
 */
const stylesFixes = StyleSheet.create({
  cocheDisque: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cocheTrait: {
    // Un "L" pivote de 45 degres : c'est toute la coche. `marginTop` negatif
    // pour la recentrer optiquement dans son disque apres rotation.
    width: 11,
    height: 6,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: "-45deg" }],
    marginTop: -3,
  },
  filet: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: couleurs.bordure,
  },
});

const creerStyles = (t: EchelleTypo) =>
  StyleSheet.create({
    lien: {
      // Plancher tactile. `minHeight`, jamais `height` : le bloc doit pouvoir
      // grandir si le systeme agrandit le texte — et son libelle n'est pas
      // plafonne, donc il grandit vraiment.
      minHeight: TAILLE_TACTILE_MIN,
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    lienContenu: {
      flexDirection: "row",
      alignItems: "center",
      gap: espacement.serre,
    },
    lienTexte: {
      ...t.lien,
      color: couleurs.lien,
      flexShrink: 1,
    },
    // --- Entete de section (reprise de components/ui/SectionHeader) ----------
    enteteLigne: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    enteteGroupe: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    enteteMarque: {
      // Element a taille intrinseque, identique au socle : 3 x 14, rayon pilule.
      width: 3,
      height: 14,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    enteteTitre: {
      ...t.overline,
      color: couleurs.texte,
      // Le titre cede la place a la legende si les deux ne tiennent pas.
      flexShrink: 1,
    },
    carte: {
      borderRadius: rayons.carte,
      padding: espacement.carte,
    },
    carteContenu: {
      marginTop: espacement.interne,
    },
    legende: {
      ...t.meta,
      color: couleurs.texteSecondaire,
    },
  });

const STYLES = stylesParEchelle(creerStyles);
