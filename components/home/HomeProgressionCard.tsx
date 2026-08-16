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
// TYPO : celle de l'ancien Home uniquement (progressText 13/700 palette.text,
// famille statLabel/sub 11-12 palette.sub, lien accent). AUCUN import de
// homeVNextTokens. Couleurs NEUTRES sur la comparaison de test : un recul
// s'affiche comme un progres (esprit R9 — le VM pre-formate, la carte ne juge
// pas).
// =============================================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import { theme } from "../../constants/theme";
import type {
  ProgressionFait,
  ProgressionViewModel,
} from "../../screens/homeVNext/progressionViewModel";

const palette = theme.colors;

type Props = {
  vm: ProgressionViewModel;
  onVoirProgression: () => void;
};

/** Un fait compact : valeur pre-formatee en tete, libelle du VM a la suite. */
function FaitRow({ fait }: { fait: ProgressionFait }) {
  return (
    <View style={styles.faitRow}>
      <Text style={styles.faitValeur} numberOfLines={1}>
        {fait.valeur}
      </Text>
      <Text style={styles.faitLibelle} numberOfLines={2}>
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
          <Text style={styles.titre} numberOfLines={2}>
            {vm.titre}
          </Text>
          {vm.reperes.map((repere) => (
            <View key={repere.numero} style={styles.repereRow}>
              <Text style={styles.repereNumero}>{repere.numero}.</Text>
              <Text style={styles.repereTexte} numberOfLines={2}>
                {repere.texte}
              </Text>
            </View>
          ))}
          <Text style={styles.mention} numberOfLines={3}>
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
          <Text style={styles.mention} numberOfLines={3}>
            {vm.tendanceIndisponible.explication}
          </Text>
        </>
      ) : null}

      {vm.state === "ready" ? (
        <>
          <FaitRow fait={vm.resume} />
          {vm.repereTest ? (
            <View style={styles.testRow}>
              <Text style={styles.testLabel} numberOfLines={1}>
                {vm.repereTest.comparaison.label}
              </Text>
              <Text style={styles.testValeurs} numberOfLines={1}>
                {vm.repereTest.comparaison.avantAffiche} →{" "}
                {vm.repereTest.comparaison.apresAffiche} (
                {vm.repereTest.comparaison.ecartAffiche})
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      {vm.detail.affiche && vm.detail.label ? (
        <TouchableOpacity onPress={onVoirProgression} style={styles.link}>
          <Text style={styles.linkText} numberOfLines={1}>
            {vm.detail.label}
          </Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Ligne de tete de l'etat vide — meme gabarit que l'ancien progressText.
  titre: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  repereRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  repereNumero: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.sub,
  },
  repereTexte: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
  },
  // Mention honnete / phrase « encore N » — famille sub de l'ancien Home.
  mention: {
    fontSize: 12,
    color: palette.sub,
  },
  faitRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  faitValeur: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  faitLibelle: {
    flexShrink: 1,
    fontSize: 12,
    color: palette.sub,
  },
  testRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  testLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
  },
  // Couleur neutre voulue (esprit R9) : jamais de vert/rouge selon le sens.
  testValeurs: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  // Lien — clone exact du pied de l'ancienne carte (HomeScreen styles.link*).
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.accent,
  },
  linkArrow: {
    fontSize: 14,
    color: palette.accent,
  },
});
