// components/homeVNext/HomeVNextSkeleton.tsx
// =============================================================================
// L'ETAT D'HYDRATATION
// =============================================================================
//
// Defaut P0.4 de l'audit : `storeHydrated` existe, est lu, et ne pilote QUE le
// declenchement du watcher Firestore. A chaque ouverture, le Home affiche donc
// l'ecran complet avec les valeurs d'usine — un joueur en surcharge peut lire
// "En forme, c'est le moment d'envoyer" pendant une seconde, avant que l'ecran
// ne bascule sur "Charge haute".
//
// Le ViewModel emet explicitement cet avertissement quand `dataState` vaut
// "hydrating" : "le rendu doit squeletter TOUS les blocs, ACTION COMPRISE".
// C'est ce que fait ce composant. Aucun texte n'est rendu — donc aucune phrase
// de ce ViewModel ne peut etre lue avant que la donnee soit la, et aucune
// action ne peut etre declenchee sur des valeurs d'amorcage.
//
// Aucune animation : les captures du prototype doivent etre reproductibles a
// l'identique. En production, une pulsation discrete est evidemment souhaitable.
// =============================================================================

import React from "react";
import { StyleSheet, View } from "react-native";

import { theme } from "../../constants/theme";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { espacement, rayons } from "./homeVNextTokens";

/** Bloc gris neutre. Purement decoratif, masque a la synthese vocale. */
function Forme({
  largeur,
  hauteur,
  rayon = 6,
}: {
  largeur: number | `${number}%`;
  hauteur: number;
  rayon?: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: largeur,
        height: hauteur,
        borderRadius: rayon,
        backgroundColor: theme.colors.cardSoft,
      }}
    />
  );
}

export function HomeVNextSkeleton() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de ton accueil"
      testID={MARQUEURS.squelette}
    >
      {/* En-tete */}
      <View style={styles.header}>
        <View style={styles.headerTextes}>
          <Forme largeur="55%" hauteur={22} />
          <View style={{ height: espacement.serre }} />
          <Forme largeur="35%" hauteur={12} />
        </View>
        <Forme largeur={96} hauteur={24} rayon={999} />
      </View>

      {/* Bloc d'action — squelette lui aussi : aucune action possible avant la donnee. */}
      <View style={styles.section}>
        <Forme largeur="100%" hauteur={76} rayon={rayons.carte} />
      </View>

      {/* Deux cartes de section */}
      <View style={styles.section}>
        <Forme largeur="100%" hauteur={116} rayon={rayons.carte} />
      </View>
      <View style={styles.section}>
        <Forme largeur="100%" hauteur={148} rayon={rayons.carte} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: espacement.interne,
  },
  headerTextes: {
    flex: 1,
    minWidth: 0,
  },
  section: {
    marginTop: espacement.entreSections,
  },
});
