// components/homeVNext/HomeVNextDemarrage.tsx
// =============================================================================
// SECTION DE DEMARRAGE — L'ECRAN DU NOUVEAU JOUEUR (V-A / V-B)
// =============================================================================
//
// LE PROBLEME QU'IL RESOUT
// -----------------------------------------------------------------------------
// L'ecran d'un compte neuf tient en 399 px sur 729 visibles : un en-tete, un
// bouton, une carte qui dit qu'il n'y a rien a mesurer. Il est juste. Il est
// timide. Decision du fondateur (03/08) : « sobre ne doit pas dire timide ».
//
// CE QU'IL N'AJOUTE PAS
// -----------------------------------------------------------------------------
// Pas une courbe grise. Pas un chiffre d'attente. Pas un « — » a la place d'une
// valeur. Pas un badge de progression. Pas un deuxieme bouton. Chaque phrase
// affichee ici vient du `DemarrageBlock` du ViewModel, qui la tient lui-meme
// d'un champ que l'app remplit deja (voir §3 bis de `viewModel.ts`).
//
// DEUX VARIANTES, UN SEUL COMPOSANT
// -----------------------------------------------------------------------------
//   V-A « Premiere mission »   -> `kind: "premiere_mission"`
//        Les trois premiers pas, chacun coche depuis un etat REEL du compte, et
//        la ligne « pourquoi ce cycle » derivee de l'objectif declare.
//
//   V-B « Anticipation honnete » -> `kind: "anticipation"`
//        Ce qui apparaitra ici plus tard, avec le seuil exact qui le
//        declenchera. L'ecran assume qu'il est en construction au lieu de faire
//        semblant d'etre plein.
//
// AUCUNE LIGNE N'EST TAPABLE — ET C'EST LE POINT
// -----------------------------------------------------------------------------
// Ni un pas, ni un apercu ne porte de `Pressable`, de chevron ou de couleur de
// lien. Le contrat le rend impossible : ni `PremierPas` ni `ApercuSection` n'a
// de champ de destination. Une checklist tapable, ce serait trois boutons de
// plus a cote du seul qui compte, et l'ecran retomberait exactement dans le
// defaut que tout ce prototype corrige (doctrine 1 : une seule action).
//
// La pastille d'un pas fait est une TEINTE (fond tres dilue, texte sombre),
// jamais un aplat colore : la regle « un seul aplat sur tout l'ecran » tient,
// et le verificateur qui compte les aplats continue de trouver 1.
// =============================================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../../constants/theme";
import type {
  ApercuSection,
  DemarrageBlock,
  PremierPas,
  PourquoiCeCycle,
} from "../../screens/homeVNext/viewModel";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { stylesParEchelle, useStylesEchelle } from "./homeVNextPresentation";
import { CarteSection, Coche } from "./HomeVNextPrimitives";
import { plafondDuRole, type EchelleTypo } from "./homeVNextTypo";
import { couleurs, espacement } from "./homeVNextTokens";

/**
 * Teintes de la coche « fait ». Reprises TELLES QUELLES de l'accuse de
 * reception (`HomeVNextAction.tsx`) : c'est le meme signal — « ceci est fait » —
 * et deux verts differents pour la meme idee seraient une incoherence de plus.
 *
 * C'est une TEINTE, pas un aplat : le texte reste sombre sur fond clair.
 */
const FAIT_PASTILLE = "rgba(21,128,61,0.12)";

/**
 * La puce d'un pas PAS ENCORE FAIT. Un cercle vide, dessine — jamais une police
 * d'icone (regle 1 de `HomeVNextPrimitives`), jamais une croix : une croix dit
 * « rate », or ce joueur n'a encore rien pu rater.
 */
function CercleVide() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={stylesFixes.cercleVide}
    />
  );
}

export type HomeVNextDemarrageProps = {
  demarrage: NonNullable<DemarrageBlock>;
};

export function HomeVNextDemarrage({ demarrage }: HomeVNextDemarrageProps) {
  if (demarrage.kind === "premiere_mission") {
    return (
      <CarteSection titre={demarrage.titre}>
        <View testID={MARQUEURS.demarrage}>
          {demarrage.premiersPas.map((pas, i) => (
            <LignePas key={pas.id} pas={pas} premier={i === 0} />
          ))}
          {demarrage.pourquoiCeCycle ? (
            <LignePourquoiCeCycle pourquoi={demarrage.pourquoiCeCycle} />
          ) : null}
        </View>
      </CarteSection>
    );
  }

  return (
    <CarteSection titre={demarrage.titre}>
      <View testID={MARQUEURS.demarrage}>
        {demarrage.apercus.map((apercu, i) => (
          <LigneApercu key={apercu.titre} apercu={apercu} premier={i === 0} />
        ))}
      </View>
    </CarteSection>
  );
}

// -----------------------------------------------------------------------------
// V-A — un premier pas
// -----------------------------------------------------------------------------

function LignePas({ pas, premier }: { pas: PremierPas; premier: boolean }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View
      style={[styles.ligne, premier ? null : styles.ligneSuivante]}
      accessible
      // L'etat est ANNONCE, pas seulement dessine : sans ca, un lecteur d'ecran
      // lit trois lignes identiques et le joueur ne sait pas ou il en est.
      accessibilityLabel={`${pas.fait ? "Fait" : "À faire"}. ${pas.label}. ${pas.detail}`}
      testID={MARQUEURS.demarragePas}
    >
      <View style={styles.puce}>
        {pas.fait ? (
          <View testID={MARQUEURS.demarragePasFait}>
            <Coche color={theme.colors.success} background={FAIT_PASTILLE} />
          </View>
        ) : (
          <CercleVide />
        )}
      </View>
      <View style={styles.ligneTextes} importantForAccessibility="no-hide-descendants">
        {/*
          Le libelle du pas est une INFORMATION, pas une decoration : aucun
          plafond d'agrandissement, et `numberOfLines` pour qu'un texte long
          borne au lieu de pousser la carte.
        */}
        <Text style={styles.pasLabel} numberOfLines={2}>
          {pas.label}
        </Text>
        <Text style={styles.pasDetail} numberOfLines={3}>
          {pas.detail}
        </Text>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// V-A — pourquoi ce cycle
// -----------------------------------------------------------------------------

/**
 * La phrase vient de `recommendMicrocycle`, la fonction qui pre-selectionne
 * deja le cycle en fin de setup profil. L'ecran ne recalcule rien : il ne peut
 * donc pas proposer autre chose que ce que le joueur trouvera en tapant sur
 * l'action.
 *
 * Elle est posee SOUS les trois pas, separee par un filet, parce qu'elle
 * repond a la question qui vient apres la liste : « d'accord, mais quoi
 * d'abord ? ».
 */
function LignePourquoiCeCycle({ pourquoi }: { pourquoi: PourquoiCeCycle }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View style={styles.pourquoiBloc} testID={MARQUEURS.demarragePourquoiCycle}>
      <Text style={styles.pourquoi} numberOfLines={3}>
        {pourquoi.text}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// V-B — un apercu de section a venir
// -----------------------------------------------------------------------------

/**
 * Le titre est celui que la section portera VRAIMENT (« MA SEMAINE », « MA
 * FORME »), au meme palier `overline` que les vrais titres de section — mais en
 * gris secondaire, parce que la section n'existe pas encore. Le joueur
 * reconnaitra l'intitule le jour ou il apparaitra pour de bon.
 */
function LigneApercu({ apercu, premier }: { apercu: ApercuSection; premier: boolean }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View
      style={[styles.apercu, premier ? null : styles.ligneSuivante]}
      accessible
      accessibilityLabel={`${apercu.titre}. ${apercu.message}`}
      testID={MARQUEURS.demarrageApercu}
    >
      {/*
        Label decoratif en capitales : meme plafond d'agrandissement (x1,15) que
        les vrais titres de section, parce que c'est exactement le meme role.
        Le message en dessous, lui, porte l'information et n'est pas borne.
      */}
      <Text style={styles.apercuTitre} numberOfLines={1} {...plafondDuRole("overline")}>
        {apercu.titre}
      </Text>
      <Text style={styles.apercuMessage} numberOfLines={4}>
        {apercu.message}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------

/** Formes dessinees, sans une lettre : elles ne dependent d'aucune echelle. */
const stylesFixes = StyleSheet.create({
  cercleVide: {
    // Meme diametre que la pastille de la coche (28 pt) : les trois puces sont
    // alignees sur une seule colonne, faites ou non.
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: couleurs.bordure,
  },
});

const creerStyles = (t: EchelleTypo) =>
  StyleSheet.create({
    ligne: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: espacement.interne,
    },
    ligneSuivante: {
      marginTop: espacement.interne,
    },
    puce: {
      // La puce ne bouge pas quand le texte grandit : elle reste alignee sur la
      // premiere ligne, sans se centrer sur un bloc de trois lignes.
      width: 28,
    },
    ligneTextes: {
      // Largeur en flex, jamais en px : a 320 px un bloc fixe ferait deborder.
      flex: 1,
      minWidth: 0,
    },
    pasLabel: {
      // Meme palier que « 1 séance sur 2 » : une seule convention de titrage de
      // contenu pour toutes les sections de l'ecran.
      ...t.valeur,
      color: couleurs.texte,
    },
    pasDetail: {
      ...t.corps,
      color: couleurs.texteSecondaire,
      marginTop: 2,
    },

    pourquoiBloc: {
      marginTop: espacement.interne,
      paddingTop: espacement.interne,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: couleurs.bordure,
    },
    pourquoi: {
      ...t.corps,
      color: couleurs.texte,
    },

    apercu: {
      // Rien a gauche : un apercu n'a pas de puce. Une puce vide devant une
      // section a venir laisserait croire a une case a cocher.
      width: "100%",
    },
    apercuTitre: {
      ...t.overline,
      // Gris secondaire : le titre est reconnaissable, mais il n'est pas encore
      // un titre de section — il n'annonce rien qui existe aujourd'hui.
      color: couleurs.texteSecondaire,
    },
    apercuMessage: {
      ...t.corps,
      color: couleurs.texte,
      marginTop: 2,
    },
  });

const STYLES = stylesParEchelle(creerStyles);
