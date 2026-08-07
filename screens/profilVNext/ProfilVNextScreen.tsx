// screens/profilVNext/ProfilVNextScreen.tsx
// =============================================================================
// Profil vNext — L'ECRAN (PROTOTYPE, non monte par la navigation)
// =============================================================================
// Le Profil de production (`screens/ProfileScreen.tsx`) n'est pas touche. Cet
// ecran n'est rendu que par le harnais `prototype/profil/` et par les tests.
//
// Comme au Home : il ne lit AUCUN store, n'appelle AUCUN hook metier, ne fait
// AUCUN fetch. Il recoit un `ProfilVNextViewModel` et le rend. Il ne peut rien
// affirmer que le ViewModel n'ait pas autorise — et le ViewModel du Profil
// n'autorise NI etat de forme, NI trophee, NI compteur : « le Profil ne raconte
// plus, il controle ».
//
// L'ORDRE, ET POURQUOI IL EST COURT
// -----------------------------------------------------------------------------
//   titre · identite · rythme · controles — c'est tout.
//
// Les deux variantes (« pur » / « informe ») sont decidees PAR LE VIEWMODEL
// (option du selecteur), jamais par une prop d'ecran : l'ecran a UNE forme, et
// une ligne dont le fait est `null` est simplement plus courte. Pas d'etat
// special fragile (lecon du Home : l'app ne change pas de forme).
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../components/ui/Screen";
import { ProfilVNextIdentite } from "../../components/profilVNext/ProfilVNextIdentite";
import { ProfilVNextRythme } from "../../components/profilVNext/ProfilVNextRythme";
import { ProfilVNextControles } from "../../components/profilVNext/ProfilVNextControles";
import { PROFIL_MARQUEURS } from "../../components/profilVNext/profilVNextMarqueurs";
import { HomeVNextPresentation } from "../../components/homeVNext/homeVNextPresentation";
import {
  stylesParEchelle,
  useStylesEchelle,
} from "../../components/homeVNext/homeVNextPresentation";
import { plafondDuRole, type EchelleTypo, type EchelleTypoId } from "../../components/homeVNext/homeVNextTypo";
import { couleurs, espacement } from "../../components/homeVNext/homeVNextTokens";
import type { CibleControle, ControleLigne, ProfilVNextViewModel } from "./viewModel";

export type ProfilVNextScreenProps = {
  /** Tout ce que l'ecran a le droit d'afficher. Seule entree. */
  vm: ProfilVNextViewModel;
  /** Tap sur une ligne de controle. Sans callback : aucun effet. */
  onControle?: (cible: CibleControle, id: ControleLigne["id"]) => void;
  /** Echelle typographique (defaut : celle du Home, « allegee »). */
  echelle?: EchelleTypoId;
  /** Surcharge « reduire les animations » — tests et visualiseur uniquement. */
  reduceMotion?: boolean;
};

export function ProfilVNextScreen({ vm, onControle, echelle, reduceMotion }: ProfilVNextScreenProps) {
  // `<Screen>` est la SEULE source de verite de la safe area (regle d'or n° 13).
  // Aucun SafeAreaView, aucun paddingTop magique, aucune StatusBar locale.
  return (
    <Screen scroll contentContainerStyle={styles.contenu}>
      <HomeVNextPresentation echelle={echelle} reduceMotion={reduceMotion}>
        <Corps vm={vm} onControle={onControle} />
      </HomeVNextPresentation>
    </Screen>
  );
}

/**
 * Le corps est separe pour que `useStylesEchelle` s'execute SOUS le provider de
 * presentation (le hook lit le contexte pose par `HomeVNextPresentation`).
 */
function Corps({
  vm,
  onControle,
}: {
  vm: ProfilVNextViewModel;
  onControle?: ProfilVNextScreenProps["onControle"];
}) {
  const stylesEchelle = useStylesEchelle(STYLES);
  return (
    <View testID={PROFIL_MARQUEURS.ecran}>
      {/*
        Le titre de l'onglet. Role accessibilite "header" : VoiceOver annonce la
        structure. Plafond x1,2 comme la salutation du Home (label de rang 1,
        l'information vit dans les cartes).
      */}
      <Text
        style={stylesEchelle.titre}
        accessibilityRole="header"
        {...plafondDuRole("salutation")}
      >
        Profil
      </Text>

      <View style={styles.section}>
        <ProfilVNextIdentite identite={vm.identite} />
      </View>

      <View style={styles.section}>
        <ProfilVNextRythme rythme={vm.rythme} />
      </View>

      <View style={styles.section}>
        <ProfilVNextControles controles={vm.controles} onControle={onControle} />
      </View>
    </View>
  );
}

// Styles independants de l'echelle : la structure.
const styles = StyleSheet.create({
  contenu: {
    paddingHorizontal: espacement.ecranX,
    paddingBottom: espacement.finDEcran,
  },
  section: {
    marginTop: espacement.entreSections,
  },
});

// Styles dependant de l'echelle : le texte.
const creerStyles = (t: EchelleTypo) =>
  StyleSheet.create({
    titre: {
      ...t.salutation,
      color: couleurs.texte,
      marginTop: espacement.serre,
    },
  });

const STYLES = stylesParEchelle(creerStyles);
