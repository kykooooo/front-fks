// components/home/HomeProgressionCard.tsx
// =============================================================================
// LE CONTENU ENRICHI DE LA CARTE « Progression » DE L'ANCIEN HOME (decision
// fondateur 15/08 : « Enrichir sur place »).
// =============================================================================
//
// CE QUE CE FICHIER EST : les CHILDREN du HomeCarouselCard "Progression" de
// `screens/HomeScreen.tsx` — le cadre (Card soft, padding 14, radius 20) et la
// position (cardsStack, bas d'ecran) ne bougent pas, seul le contenu change.
//
// D'OU VIENT LE CONTENU : `useHomeVNextViewModel().progression`, le ViewModel
// canonique de la carte progression (`screens/homeVNext/progressionViewModel.ts`).
// Tous les textes affiches ici en sortent VERBATIM — ce composant ne fabrique
// aucune chaine, il ne pose que la ponctuation de mise en page (« . » apres un
// numero, « → » entre deux valeurs pre-formatees, parentheses autour de
// l'ecart pre-formate).
//
// CE QUI EST VOLONTAIREMENT OMIS, et pourquoi :
//   - `vm.courbe` : la tendance vit dans HomeReadinessHero juste au-dessus
//     (serie tsbHistory du store). Rendre `vm.courbe` ajouterait une SECONDE
//     serie DIFFERENTE (reconstruite sans amorcage) : deux courbes
//     contradictoires sur le meme ecran.
//   - `comparaisonsTests` complet : matiere de la page Progression.
//   - `protoWarnings` : artefact du visualiseur, jamais rendu.
//   - `vm.repereTest` en "collecting" : perimetre valide = faits + « encore N »
//     seulement.
//   - la ligne serie (flamme + « N jours d'affilee ») de l'ancienne carte :
//     doublon de la stat « Série » de la ligne stats au-dessus (H3).
//
// LE PIED : strictement `vm.detail` — la decision d'affichage du lien est prise
// par le ViewModel (decisionDetail, §7), jamais ici. `affiche` ne vaut `true`
// qu'en "ready" aujourd'hui.
//
// TYPO (17/09/2026, SPEC_DA_ACCUEIL_SEANCE.md §2.6) : jetons `da` — tailles
// 14-16, couleurs `da.colors.*`, lien en `actionText`, cible tactile 44.
// AUCUN import de homeVNextTokens. Couleurs NEUTRES sur la comparaison de
// test : un recul s'affiche comme un progres (esprit R9 — le VM pre-formate,
// la carte ne juge pas).
// =============================================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import { da, PLAFOND_TEXTE, TOUCHE_MIN } from "../../constants/daJoueur";
import type {
  ProgressionFait,
  ProgressionViewModel,
} from "../../screens/homeVNext/progressionViewModel";

type Props = {
  vm: ProgressionViewModel;
  onVoirProgression: () => void;
};

/** Un fait compact : valeur pre-formatee en tete, libelle du VM a la suite. */
function FaitRow({ fait }: { fait: ProgressionFait }) {
  return (
    <View style={styles.faitRow}>
      <Text style={styles.faitValeur} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
        {fait.valeur}
      </Text>
      <Text style={styles.faitLibelle} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
        {fait.libelle}
      </Text>
    </View>
  );
}

export default function HomeProgressionCard({ vm, onVoirProgression }: Props) {
  return (
    <>
      {vm.state === "empty" ? (
        <>
          <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
            {vm.titre}
          </Text>
          {vm.reperes.map((repere) => (
            <View key={repere.numero} style={styles.repereRow}>
              <Text style={styles.repereNumero} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
                {repere.numero}.
              </Text>
              <Text style={styles.repereTexte} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
                {repere.texte}
              </Text>
            </View>
          ))}
          <Text style={styles.mention} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={3}>
            {vm.mention}
          </Text>
        </>
      ) : null}

      {vm.state === "collecting" ? (
        <>
          {vm.faits
            .filter((fait) => fait.cle !== "avant_tendance")
            .map((fait) => (
              <FaitRow key={fait.cle} fait={fait} />
            ))}
          {/* 3 lignes : la plus longue explication (« Ta tendance s'affichera dès
              que tes charges seront enregistrées sur assez de jours. ») tient en
              2 lignes sur 320 px, la 3e est une marge — tronquer un message
              d'honnetete en couperait le sens. */}
          <Text style={styles.mention} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={3}>
            {vm.tendanceIndisponible.explication}
          </Text>
        </>
      ) : null}

      {vm.state === "ready" ? (
        <>
          <FaitRow fait={vm.resume} />
          {vm.repereTest ? (
            <View style={styles.testRow}>
              <Text style={styles.testLabel} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
                {vm.repereTest.comparaison.label}
              </Text>
              <Text style={styles.testValeurs} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
                {vm.repereTest.comparaison.avantAffiche} →{" "}
                {vm.repereTest.comparaison.apresAffiche} (
                {vm.repereTest.comparaison.ecartAffiche})
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      {vm.detail.affiche && vm.detail.label ? (
        <TouchableOpacity onPress={onVoirProgression} style={styles.link} accessibilityRole="button">
          <Text style={styles.linkText} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
            {vm.detail.label}
          </Text>
          <Text style={styles.linkArrow} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
            →
          </Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Ligne de tete de l'etat vide — habillee en petit libelle (F4) : vm.titre
  // arrive deja en CAPITALES depuis le VM (texte canonique, on n'y touche
  // pas) ; un second style 15/700 sous l'en-tete "Ta progression" ferait deux
  // titres qui crient, d'ou le passage a kicker/sub. `textTransform: "none"`
  // ANNULE l'uppercase de da.typography.kicker : le texte est deja tel que
  // voulu par le VM, on ne le retransforme pas.
  titre: {
    ...da.typography.kicker,
    textTransform: "none",
    color: da.colors.sub,
  },
  repereRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  repereNumero: {
    fontSize: 14,
    fontWeight: "700",
    color: da.colors.sub,
  },
  repereTexte: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: da.colors.sub,
  },
  // Mention honnete / phrase « encore N ».
  mention: {
    fontSize: 14,
    color: da.colors.sub,
  },
  faitRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  faitValeur: {
    fontSize: 15,
    fontWeight: "700",
    color: da.colors.text,
  },
  faitLibelle: {
    flexShrink: 1,
    fontSize: 14,
    color: da.colors.sub,
  },
  testRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  testLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "600",
    color: da.colors.sub,
  },
  // Couleur neutre voulue (esprit R9) : jamais de vert/rouge selon le sens.
  testValeurs: {
    fontSize: 15,
    fontWeight: "700",
    color: da.colors.text,
  },
  // Lien — cible tactile 44, texte en actionText (orange).
  link: {
    minHeight: TOUCHE_MIN,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  linkText: {
    fontSize: 15,
    fontWeight: "700",
    color: da.colors.actionText,
  },
  linkArrow: {
    fontSize: 16,
    color: da.colors.actionText,
  },
});
