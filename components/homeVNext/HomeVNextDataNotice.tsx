// components/homeVNext/HomeVNextDataNotice.tsx
// =============================================================================
// L'AVIS DE FIABILITE (hors-ligne)
// =============================================================================
//
// Ce n'est pas une section du contrat : c'est une qualification de TOUT ce qui
// suit. D'ou sa place, juste sous l'en-tete et AVANT le premier chiffre —
// personne ne doit lire une tendance puis apprendre en bas de page qu'elle
// peut dater.
//
// Le Home actuel ne lit jamais le reseau (defaut E9 de l'audit) : la banniere
// globale de `App.tsx` se contente de recouvrir le header, et les chiffres en
// dessous continuent de se presenter comme frais.
//
// Volontairement pas un aplat, pas une couleur d'alerte : etre hors-ligne n'est
// pas une erreur du joueur. Un cadre sobre, un texte lisible, rien de plus.
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../../constants/theme";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { stylesParEchelle, useStylesEchelle } from "./homeVNextPresentation";
import type { EchelleTypo } from "./homeVNextTypo";
import { couleurs, espacement, rayons } from "./homeVNextTokens";

export function HomeVNextDataNotice({ notice }: { notice: string }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View
      style={styles.cadre}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={notice}
      testID={MARQUEURS.avisDonnees}
    >
      <Text style={styles.texte} numberOfLines={2}>
        {notice}
      </Text>
    </View>
  );
}

const creerStyles = (t: EchelleTypo) =>
  StyleSheet.create({
    cadre: {
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: couleurs.bordure,
      borderRadius: rayons.carte,
      paddingVertical: espacement.interne,
      paddingHorizontal: espacement.interne,
    },
    texte: {
      // Couleur de texte PRINCIPALE, pas secondaire : c'est une information dont
      // depend la lecture de tout le reste de l'ecran. Et donc, pour la meme
      // raison, aucun plafond d'agrandissement.
      ...t.meta,
      color: couleurs.texte,
    },
  });

const STYLES = stylesParEchelle(creerStyles);
