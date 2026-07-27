// components/homeVNext/HomeVNextForm.tsx
// =============================================================================
// SECTION 4 — MA FORME
// =============================================================================
//
// Deux etats, et un seul est une courbe.
//
// 1. `available` — la tendance existe vraiment. On trace, et on dit sa PORTEE.
//    Le champ `scope` est obligatoire dans le contrat pour une raison precise
//    (doctrine 6) : une tendance calculee sur les seules seances FKS n'est pas
//    une mesure complete de l'etat physique d'un joueur qui s'entraine aussi en
//    club. L'ecran l'ecrit, il ne le laisse pas deviner.
//
// 2. `insufficient` — la donnee manque. On ne trace rien, on ne colore rien, on
//    n'affirme rien. On dit ce qui manque et quand ca viendra. Le ton est fixe
//    par le contrat : "Ta tendance se construit", jamais un reproche.
//
// Le compteur "N seance(s) enregistree(s)" n'apparait que dans le cas
// `pas_assez_de_seances`, et seulement si ce nombre est superieur a zero :
//   - en `reprise_en_cours`, le joueur peut avoir 30 seances derriere lui, un
//     "5 sur 4" n'aurait aucun sens (le contrat le dit noir sur blanc) ;
//   - a zero seance, ecrire "0 seance enregistree" a la premiere ouverture est
//     un reproche adresse a quelqu'un qui n'a encore rien pu faire.
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { FormBlock } from "../../screens/homeVNext/viewModel";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { CarteSection } from "./HomeVNextPrimitives";
import { HomeVNextSparkline } from "./HomeVNextSparkline";
import { couleurs, espacement, typo } from "./homeVNextTokens";

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export type HomeVNextFormProps = {
  form: NonNullable<FormBlock>;
  /**
   * Largeur de trace imposee. A passer uniquement par un environnement qui rend
   * l'ecran en une seule passe (voir `HomeVNextSparkline`).
   */
  largeurCourbe?: number;
};

export function HomeVNextForm({ form, largeurCourbe }: HomeVNextFormProps) {
  if (form.kind === "available") {
    return (
      <CarteSection titre="MA FORME" legende={form.periodLabel}>
        <HomeVNextSparkline
          points={form.points}
          largeur={largeurCourbe}
          // Volontairement DESCRIPTIF, pas interpretatif : on annonce ce qui est
          // dessine et sur quoi c'est calcule. Dire "en baisse" ou "en hausse"
          // serait une affirmation produite par la vue — or c'est au ViewModel,
          // et a lui seul, de decider ce que l'app a le droit d'affirmer.
          accessibilityLabel={`Courbe de ta tendance de forme sur ${form.periodLabel}. ${form.scope}`}
        />
        <Text style={styles.portee} numberOfLines={2}>
          {form.scope}
        </Text>
      </CarteSection>
    );
  }

  const compteurAffichable =
    form.reason === "pas_assez_de_seances" && form.completedCount > 0;
  const compteur = compteurAffichable
    ? `${pluriel(form.completedCount, "séance")} ${form.completedCount > 1 ? "enregistrées" : "enregistrée"}.`
    : null;

  return (
    <CarteSection titre="MA FORME">
      <View
        accessible
        accessibilityLabel={`Ma forme. ${form.title}. ${form.message}${compteur ? ` ${compteur}` : ""}`}
        testID={MARQUEURS.formeInsuffisante}
      >
        <Text style={styles.titre} numberOfLines={2}>
          {form.title}
        </Text>
        <Text style={styles.message} numberOfLines={3}>
          {form.message}
        </Text>
        {compteur ? (
          <Text style={styles.compteur} numberOfLines={1}>
            {compteur}
          </Text>
        ) : null}
      </View>
    </CarteSection>
  );
}

const styles = StyleSheet.create({
  titre: {
    // Meme palier que "1 séance sur 2" dans Ma semaine : une seule convention de
    // titrage de contenu pour toutes les sections.
    ...typo.metricValue,
    color: couleurs.texte,
  },
  message: {
    ...typo.body,
    color: couleurs.texteSecondaire,
    marginTop: espacement.serre,
  },
  compteur: {
    ...typo.caption,
    color: couleurs.texteSecondaire,
    marginTop: espacement.serre,
  },
  portee: {
    ...typo.caption,
    color: couleurs.texteSecondaire,
    marginTop: espacement.serre,
  },
});
