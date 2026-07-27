// components/homeVNext/HomeVNextNote.tsx
// =============================================================================
// SECTION 5 — LE CONSEIL
// =============================================================================
//
// Ce bloc n'existe que quand il apporte du neuf : le ViewModel le supprime des
// que plus de la moitie de ses mots ont deja ete dits ailleurs sur l'ecran
// (`NOTE_RECOUPEMENT_MAX`). C'est la reponse au defaut P1.14 de l'audit — le
// meme message ecrit jusqu'a quatre fois sur un ecran de recuperation.
//
// Rendu volontairement MINEUR :
//   - pas de carte, pas de bordure, pas de fond : une marque et du texte ;
//   - AUCUN BOUTON. Le type `Note` du contrat n'a d'ailleurs aucun champ
//     d'action, ce qui rend impossible le second aplat pleine largeur que le
//     Home actuel place en bas d'ecran, en concurrence directe avec le CTA.
//
// La marque de 3 px reprend exactement celle de `components/ui/SectionHeader`
// (meme largeur, meme rayon, meme bleu) : le conseil se lit comme une note en
// marge du meme systeme, pas comme un cinquieme style importe d'ailleurs.
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Note } from "../../screens/homeVNext/viewModel";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { couleurs, espacement, typo } from "./homeVNextTokens";

export function HomeVNextNote({ note }: { note: NonNullable<Note> }) {
  return (
    <View
      style={styles.ligne}
      accessible
      accessibilityLabel={`${note.title}. ${note.message}`}
      testID={MARQUEURS.conseil}
    >
      <View
        style={styles.marque}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.contenu} importantForAccessibility="no-hide-descendants">
        <Text style={styles.titre} numberOfLines={1}>
          {note.title}
        </Text>
        {/* Contenu backend (`coachingTips`) : borne, toujours. */}
        <Text style={styles.message} numberOfLines={3}>
          {note.message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row",
    gap: espacement.interne,
  },
  marque: {
    width: 3,
    // `alignSelf: "stretch"` plutot qu'une hauteur fixe : la marque suit le
    // texte, y compris quand le systeme l'agrandit.
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: couleurs.lien,
  },
  contenu: {
    flex: 1,
    minWidth: 0,
  },
  titre: {
    ...typo.caption,
    fontWeight: "800",
    color: couleurs.texte,
  },
  message: {
    ...typo.body,
    color: couleurs.texteSecondaire,
    marginTop: 2,
  },
});
