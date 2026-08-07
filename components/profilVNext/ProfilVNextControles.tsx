// components/profilVNext/ProfilVNextControles.tsx
// =============================================================================
// PROTOTYPE Profil vNext — LA LISTE DE CONTROLES
// =============================================================================
// Le coeur de l'ecran : la ou le joueur AGIT. Une carte, six lignes, un filet
// entre chaque. L'ordre vient du ViewModel (les trois usages reels d'abord),
// l'ecran le rend tel quel.
//
// Chaque ligne :
//   - libelle (gauche) + chevron dessine (droite, jamais une police d'icone) ;
//   - en variante « informee », le fait d'etat du ViewModel en dessous — un fait
//     SOURCE, jamais un calcul local (le composant ne sait meme pas calculer) ;
//   - Pressable avec role, label vocal complet (libelle + fait) et plancher
//     tactile de 44 pt — l'audit du Home relevait 8 zones sur 8 sous 44 pt.
//
// AUCUN haptic ici : la convention (`useHaptics` importe les stores) interdit
// d'en appeler depuis un composant qui doit aussi se rendre dans le harnais.
// Comme au Home, le conteneur de cablage les posera dans les callbacks.
// =============================================================================

import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import type { CibleControle, ControleLigne } from "../../screens/profilVNext/viewModel";
import { Card } from "../ui/Card";
import { Chevron, Filet } from "../homeVNext/HomeVNextPrimitives";
import {
  stylesParEchelle,
  usePressionAnimee,
  useStylesEchelle,
} from "../homeVNext/homeVNextPresentation";
import { plafondDuRole, type EchelleTypo } from "../homeVNext/homeVNextTypo";
import { couleurs, espacement, rayons, TAILLE_TACTILE_MIN } from "../homeVNext/homeVNextTokens";
import { PROFIL_MARQUEURS } from "./profilVNextMarqueurs";
import {
  ACCENTS_PAR_DEFAUT,
  paletteAccents,
  type AccentsId,
  type PaletteAccents,
} from "./profilVNextAccents";

type Props = {
  controles: ControleLigne[];
  /** Sans callback : aucun effet (tests, fixtures, harnais). */
  onControle?: (cible: CibleControle, id: ControleLigne["id"]) => void;
  accents?: AccentsId;
};

function LigneControle({
  ligne,
  onControle,
  palette,
}: {
  ligne: ControleLigne;
  onControle?: Props["onControle"];
  palette: PaletteAccents;
}) {
  const styles = useStylesEchelle(STYLES);
  const { pression, onPressIn, onPressOut } = usePressionAnimee();
  // Un estompement, pas un mouvement : actif meme en « reduire les animations »
  // (le systeme lui-meme remplace ses transitions par des fondus).
  const opacity = pression.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });

  const annonce = ligne.fait != null ? `${ligne.label}. ${ligne.fait.texte}` : ligne.label;

  return (
    <Pressable
      onPress={onControle ? () => onControle(ligne.cible, ligne.id) : undefined}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={annonce}
      testID={`${PROFIL_MARQUEURS.controle}-${ligne.id}`}
      style={styles.ligne}
    >
      <Animated.View style={[styles.ligneContenu, { opacity }]}>
        <View style={styles.ligneTextes}>
          {/*
            AUCUN plafond d'agrandissement : le libelle dit ou mene la ligne,
            c'est une information. La cible tactile a son plancher via minHeight.
          */}
          <Text style={styles.libelle} numberOfLines={1} {...plafondDuRole("lien")}>
            {ligne.label}
          </Text>
          {ligne.fait != null ? (
            <Text
              style={[
                styles.fait,
                palette.piluleFond != null && styles.faitPilule,
                palette.piluleFond != null && { backgroundColor: palette.piluleFond },
                palette.piluleTexte != null && { color: palette.piluleTexte },
              ]}
              numberOfLines={2}
              testID={PROFIL_MARQUEURS.fait}
            >
              {ligne.fait.texte}
            </Text>
          ) : null}
        </View>
        <Chevron color={palette.chevron ?? couleurs.texteSecondaire} size={8} thickness={1.8} />
      </Animated.View>
    </Pressable>
  );
}

export function ProfilVNextControles({ controles, onControle, accents = ACCENTS_PAR_DEFAUT }: Props) {
  const styles = useStylesEchelle(STYLES);
  const palette = paletteAccents(accents);
  return (
    <Card variant="surface" style={styles.carte}>
      {controles.map((ligne, i) => (
        <React.Fragment key={ligne.id}>
          {i > 0 ? <Filet /> : null}
          <LigneControle ligne={ligne} onControle={onControle} palette={palette} />
        </React.Fragment>
      ))}
    </Card>
  );
}

const creerStyles = (t: EchelleTypo) =>
  StyleSheet.create({
    carte: {
      borderRadius: rayons.carte,
      padding: espacement.carte,
    },
    ligne: {
      // Plancher tactile, jamais `height` : la ligne grandit avec son fait et
      // avec le texte agrandi.
      minHeight: TAILLE_TACTILE_MIN,
      justifyContent: "center",
    },
    ligneContenu: {
      flexDirection: "row",
      alignItems: "center",
      gap: espacement.interne,
      paddingVertical: espacement.serre,
    },
    ligneTextes: {
      flex: 1,
      gap: 2,
    },
    libelle: {
      ...t.emphaseCorps,
      color: couleurs.texte,
    },
    fait: {
      ...t.meta,
      color: couleurs.texteSecondaire,
    },
    // En mode colore, le fait devient une pilule teintee (famille accent du
    // Home) — memes mots, jamais un caractere de plus.
    faitPilule: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: "hidden",
      marginTop: 2,
    },
  });

const STYLES = stylesParEchelle(creerStyles);
