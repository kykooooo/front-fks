// components/homeVNext/HomeVNextWeek.tsx
// =============================================================================
// SECTION 3 — MA SEMAINE
// =============================================================================
//
// Le ViewModel a deja fait le tri : ce bloc est `null` quand l'objectif hebdo
// n'est pas declare, et quand le joueur n'a encore aucune seance terminee
// (afficher "0 sur 2" a la premiere ouverture est un reproche avant meme
// d'avoir commence). Ici on ne fait que le rendre.
//
// Un seul choix de rendu, et il corrige le defaut P1.11 de l'audit :
// quand l'objectif est DEPASSE, l'ecran n'ecrit pas "3 séances sur 2" — une
// fraction dont le numerateur depasse le denominateur se lit comme une erreur.
// Il ecrit "3 séances cette semaine", et le message du ViewModel dit le reste.
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { WeekBlock } from "../../screens/homeVNext/viewModel";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { CarteSection } from "./HomeVNextPrimitives";
import { couleurs, espacement, typo } from "./homeVNextTokens";

/**
 * Au-dela de ce nombre de seances visees, les segments deviennent des echardes
 * illisibles : on les supprime et on garde le chiffre, qui dit deja tout.
 */
const MAX_SEGMENTS_LISIBLES = 7;

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function HomeVNextWeek({ week }: { week: NonNullable<WeekBlock> }) {
  const titreValeur = week.goalExceeded
    ? `${pluriel(week.doneCount, "séance")} cette semaine`
    : `${pluriel(week.doneCount, "séance")} sur ${week.goalCount}`;

  const segmentsLisibles = week.goalCount > 0 && week.goalCount <= MAX_SEGMENTS_LISIBLES;

  return (
    <CarteSection titre="MA SEMAINE">
      <View
        accessible
        accessibilityLabel={`Ma semaine. ${titreValeur}. ${week.message}`}
        testID={MARQUEURS.semaine}
      >
        <Text style={styles.valeur} numberOfLines={2}>
          {titreValeur}
        </Text>

        {segmentsLisibles ? (
          <View
            style={styles.jauge}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: week.goalCount }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  i < week.doneCount ? styles.segmentFait : styles.segmentVide,
                ]}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.message} numberOfLines={2}>
          {week.message}
        </Text>
      </View>
    </CarteSection>
  );
}

const styles = StyleSheet.create({
  valeur: {
    ...typo.metricValue,
    color: couleurs.texte,
  },
  jauge: {
    flexDirection: "row",
    // Largeurs en flex : la jauge s'adapte de 320 a 430 px sans une seule
    // valeur en dur.
    gap: 6,
    marginTop: espacement.serre,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  segmentFait: {
    // Le bleu ambient du theme, pas l'orange : l'orange reste reserve a l'unique
    // aplat d'action de l'ecran.
    backgroundColor: couleurs.lien,
  },
  segmentVide: {
    backgroundColor: couleurs.bordure,
  },
  message: {
    ...typo.body,
    color: couleurs.texteSecondaire,
    marginTop: espacement.serre,
  },
});
