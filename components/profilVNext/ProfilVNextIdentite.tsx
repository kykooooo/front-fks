// components/profilVNext/ProfilVNextIdentite.tsx
// =============================================================================
// PROTOTYPE Profil vNext — LA CARTE IDENTITE
// =============================================================================
// Cinq lignes etiquetees : Prenom, Poste, Niveau, Pied fort, Objectif. Le patron
// visuel est celui de « Mon rythme » (l'unique bloc du Profil actuel juge
// exemplaire par l'audit) : une valeur absente s'affiche « A definir », en
// retrait — jamais un placeholder qui se fait passer pour une donnee.
//
// La carte N'EST PAS tappable : l'action d'edition vit sur la ligne de controle
// « Modifier mon profil », et nulle part ailleurs (une action = un endroit).
//
// En chargement (le onSnapshot du doc joueur n'a pas encore rendu son premier
// instantane), la carte affiche des barres neutres et l'annonce a VoiceOver —
// elle n'invente NI « Joueur », NI des champs vides (defaut P1-1 de l'audit).
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { IdentiteBlock } from "../../screens/profilVNext/viewModel";
import { CarteSection, Filet } from "../homeVNext/HomeVNextPrimitives";
import { stylesParEchelle, useStylesEchelle } from "../homeVNext/homeVNextPresentation";
import type { EchelleTypo } from "../homeVNext/homeVNextTypo";
import { couleurs, espacement } from "../homeVNext/homeVNextTokens";
import { PROFIL_MARQUEURS } from "./profilVNextMarqueurs";
import { ACCENTS_PAR_DEFAUT, paletteAccents, type AccentsId } from "./profilVNextAccents";

type Props = { identite: IdentiteBlock; accents?: AccentsId };

/**
 * Avatar DESSINE (tete + epaules en bordures), jamais des initiales : une
 * lettre serait un texte que le mode sobre n'a pas, et les accents n'ont pas
 * le droit d'ajouter un caractere (regle du module profilVNextAccents).
 */
function AvatarGlyphe({ fond, trait }: { fond: string; trait: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[stylesAvatar.disque, { backgroundColor: fond }]}
    >
      <View style={[stylesAvatar.tete, { backgroundColor: trait }]} />
      <View style={[stylesAvatar.epaules, { backgroundColor: trait }]} />
    </View>
  );
}

const stylesAvatar = StyleSheet.create({
  disque: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tete: { width: 12, height: 12, borderRadius: 6, marginBottom: 2 },
  epaules: { width: 22, height: 12, borderTopLeftRadius: 11, borderTopRightRadius: 11, marginBottom: -6 },
});

const LIGNES: ReadonlyArray<{
  cle: "prenom" | "poste" | "niveau" | "pied" | "objectif";
  label: string;
}> = [
  { cle: "prenom", label: "Prénom" },
  { cle: "poste", label: "Poste" },
  { cle: "niveau", label: "Niveau" },
  { cle: "pied", label: "Pied fort" },
  { cle: "objectif", label: "Objectif" },
];

export function ProfilVNextIdentite({ identite, accents = ACCENTS_PAR_DEFAUT }: Props) {
  const styles = useStylesEchelle(STYLES);
  const palette = paletteAccents(accents);

  if (identite.kind === "chargement") {
    return (
      <CarteSection titre="Identité">
        <View
          testID={PROFIL_MARQUEURS.identiteChargement}
          accessibilityLabel="Profil en cours de chargement"
        >
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.barreAttente, i > 0 && styles.barreAttenteSuivante]} />
          ))}
        </View>
      </CarteSection>
    );
  }

  const lignes = LIGNES.map(({ cle, label }, i) => {
    const valeur = identite[cle];
    return (
      <React.Fragment key={cle}>
        {i > 0 ? <Filet /> : null}
        <View style={styles.ligne}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {valeur != null ? (
            <Text style={styles.valeur} numberOfLines={2}>
              {valeur}
            </Text>
          ) : (
            <Text
              style={[
                styles.aDefinir,
                palette.aDefinirFond != null && styles.aDefinirPilule,
                palette.aDefinirFond != null && { backgroundColor: palette.aDefinirFond },
              ]}
              testID={PROFIL_MARQUEURS.aDefinir}
            >
              À définir
            </Text>
          )}
        </View>
      </React.Fragment>
    );
  });

  return (
    <CarteSection titre="Identité">
      <View testID={PROFIL_MARQUEURS.identite}>
        {palette.avatarFond != null && palette.avatarTrait != null ? (
          <View style={styles.rangeeAvatar}>
            <AvatarGlyphe fond={palette.avatarFond} trait={palette.avatarTrait} />
            <View style={styles.colonneApresAvatar}>{lignes}</View>
          </View>
        ) : (
          lignes
        )}
      </View>
    </CarteSection>
  );
}

const creerStyles = (t: EchelleTypo) =>
  StyleSheet.create({
    ligne: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: espacement.interne,
      // `minHeight`, jamais `height` : la valeur peut passer sur deux lignes
      // (l'objectif le plus long fait 46 caracteres) et grandir avec le texte.
      minHeight: 40,
      paddingVertical: espacement.serre / 2,
    },
    label: {
      ...t.corps,
      color: couleurs.texteSecondaire,
      // L'etiquette ne cede JAMAIS sa place : c'est la valeur (bornee a 2
      // lignes) qui se replie. Sans ce 0 explicite, react-native-web laisse le
      // defaut flex-shrink:1 du web sur Text et « Objectif » se fait ecraser
      // par une valeur longue — mesure par le verificateur (controle i), pas
      // reproduit par Yoga sur telephone (defaut 0) : on aligne les deux mondes.
      flexShrink: 0,
    },
    valeur: {
      ...t.emphaseCorps,
      color: couleurs.texte,
      flexShrink: 1,
      textAlign: "right",
    },
    aDefinir: {
      ...t.corps,
      color: couleurs.texteSecondaire,
      fontStyle: "italic",
    },
    // En mode colore, « A definir » devient une pilule NEUTRE (fond bordure) :
    // on invite a completer, on ne celebre pas une absence avec l'accent.
    aDefinirPilule: {
      fontStyle: "normal",
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: "hidden",
    },
    rangeeAvatar: {
      flexDirection: "row",
      gap: espacement.interne,
      alignItems: "flex-start",
    },
    colonneApresAvatar: {
      flex: 1,
    },
    barreAttente: {
      height: 14,
      borderRadius: 7,
      backgroundColor: couleurs.bordure,
      width: "62%",
    },
    barreAttenteSuivante: {
      marginTop: espacement.interne,
      width: "46%",
    },
  });

const STYLES = stylesParEchelle(creerStyles);
