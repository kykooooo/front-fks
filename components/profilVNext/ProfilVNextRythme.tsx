// components/profilVNext/ProfilVNextRythme.tsx
// =============================================================================
// PROTOTYPE Profil vNext — LA CARTE RYTHME
// =============================================================================
// Les trois declarations hebdomadaires du joueur (seances FKS visees,
// entrainements club, matchs). Ce sont des DECLARATIONS, pas des mesures :
// aucune n'est comptee, aucune n'est comparee a du realise (le compteur hebdo
// vit au Home et nulle part ailleurs — regle n° 11).
//
// `null` s'affiche « A definir » (le patron juge exemplaire par l'audit).
// `0` s'affiche « 0 » : un joueur peut declarer zero match par semaine.
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { RythmeBlock } from "../../screens/profilVNext/viewModel";
import { CarteSection } from "../homeVNext/HomeVNextPrimitives";
import { stylesParEchelle, useStylesEchelle } from "../homeVNext/homeVNextPresentation";
import type { EchelleTypo } from "../homeVNext/homeVNextTypo";
import { couleurs, espacement } from "../homeVNext/homeVNextTokens";
import { PROFIL_MARQUEURS } from "./profilVNextMarqueurs";
import { ACCENTS_PAR_DEFAUT, paletteAccents, type AccentsId } from "./profilVNextAccents";

type Props = { rythme: RythmeBlock; accents?: AccentsId };

export function ProfilVNextRythme({ rythme, accents = ACCENTS_PAR_DEFAUT }: Props) {
  const styles = useStylesEchelle(STYLES);
  const palette = paletteAccents(accents);

  const colonnes: ReadonlyArray<{ cle: string; label: string; valeur: number | null }> = [
    { cle: "fks", label: "Séances FKS / sem", valeur: rythme.fksParSemaine },
    { cle: "club", label: "Club / sem", valeur: rythme.clubParSemaine },
    { cle: "matchs", label: "Matchs / sem", valeur: rythme.matchsParSemaine },
  ];

  return (
    <CarteSection titre="Mon rythme">
      <View style={styles.rangee} testID={PROFIL_MARQUEURS.rythme}>
        {colonnes.map((c) => (
          <View key={c.cle} style={styles.colonne}>
            {c.valeur != null ? (
              <Text style={[styles.valeur, palette.valeur != null && { color: palette.valeur }]}>
                {c.valeur}
              </Text>
            ) : (
              <Text style={styles.aDefinir} testID={PROFIL_MARQUEURS.aDefinir}>
                À définir
              </Text>
            )}
            <Text style={styles.label} numberOfLines={2}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>
    </CarteSection>
  );
}

const creerStyles = (t: EchelleTypo) =>
  StyleSheet.create({
    rangee: {
      flexDirection: "row",
      gap: espacement.interne,
    },
    colonne: {
      flex: 1,
      alignItems: "flex-start",
      gap: 2,
    },
    valeur: {
      ...t.valeur,
      color: couleurs.texte,
    },
    aDefinir: {
      ...t.corps,
      color: couleurs.texteSecondaire,
      fontStyle: "italic",
    },
    label: {
      ...t.meta,
      color: couleurs.texteSecondaire,
    },
  });

const STYLES = stylesParEchelle(creerStyles);
