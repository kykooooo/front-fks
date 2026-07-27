// components/homeVNext/HomeVNextHeader.tsx
// =============================================================================
// SECTION 1 — EN-TETE
// =============================================================================
//
// Trois informations, pas une de plus : a qui on parle, quel jour on est, et —
// seulement si l'app a le droit de l'affirmer — l'etat du jour.
//
// L'audit compte l'etat du jour ecrit TROIS fois sur le Home actuel (chip du
// header + titre de la carte "TON ETAT" + titre du Conseil), souvent mot pour
// mot. Ici il n'existe qu'a un seul endroit : cette pastille. Le ViewModel le
// dit explicitement — "Le chip d'etat est la SEULE mention de l'etat du jour de
// tout l'ecran" — et il le met a `null` des que la tendance n'est pas
// disponible. Un compte neuf ne peut donc plus lire "En forme" produit par
// CTL0=15 / ATL0=12.
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "../ui/Badge";
import type { HomeVNextHeader as HeaderData } from "../../screens/homeVNext/viewModel";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { couleurs, espacement, typo } from "./homeVNextTokens";

export function HomeVNextHeader({ header }: { header: HeaderData }) {
  return (
    <View style={styles.ligne}>
      <View style={styles.colonneTexte}>
        <Text style={styles.salutation} numberOfLines={1} accessibilityRole="header">
          {header.greeting}
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {header.dateLabel}
        </Text>
      </View>

      {header.stateChip ? (
        <View
          style={styles.pastille}
          accessible
          accessibilityLabel={`État du jour : ${header.stateChip.label}`}
          testID={MARQUEURS.etatDuJour}
        >
          {/*
            Ton NEUTRE volontaire (`tone="default"`), jamais vert ni rouge.
            Le ViewModel fournit un libelle ("En forme", "Un peu chargé",
            "À alléger") mais aucune notion de bon ou mauvais : colorier serait
            porter un jugement que la donnee ne contient pas. C'est la pastille
            verte sur des chiffres fabriques que l'audit epingle en P0.1.
          */}
          <Badge label={header.stateChip.label} tone="default" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: espacement.interne,
  },
  colonneTexte: {
    // `flex: 1` + `numberOfLines={1}` sur le prenom : a 320 px c'est le prenom
    // qui se tronque, jamais l'etat du jour.
    flex: 1,
    minWidth: 0,
  },
  salutation: {
    ...typo.screenTitle,
    color: couleurs.texte,
  },
  date: {
    ...typo.caption,
    color: couleurs.texteSecondaire,
    marginTop: 2,
  },
  pastille: {
    flexShrink: 0,
  },
});
