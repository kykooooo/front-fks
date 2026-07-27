// components/club/ClubDataDisclosure.tsx
//
// Divulgation affichée LÀ OÙ LE JOUEUR SAISIT SON CODE CLUB (setup de profil et
// carte « Mon club » des réglages). Elle dit quelles catégories d'informations
// sportives son encadrement verra, et lesquelles ne sortent jamais.
//
// TROIS RÈGLES DE CONCEPTION, dans l'ordre :
//  1. elle N'EMPÊCHE RIEN. Aucune case à cocher, aucun bouton, aucun état : elle
//     ne peut pas bloquer un rattachement, ni retarder l'onboarding ;
//  2. elle est TOUJOURS VISIBLE (pas de repli, pas d'accordéon). Une information
//     qu'il faut déplier n'est pas une information donnée ;
//  3. le contenu vit dans `domain/clubDataDisclosure.ts`, aligné par test sur le
//     contrat coach-safe réel. Ce fichier ne fait que le dessiner.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import { CLUB_DISCLOSURE } from "../../domain/clubDataDisclosure";

const palette = theme.colors;

type Props = {
  /** Style d'espacement du conteneur (marges gérées par l'écran hôte). */
  style?: object;
};

function Ligne({ icone, couleur, texte }: { icone: keyof typeof Ionicons.glyphMap; couleur: string; texte: string }) {
  return (
    <View style={styles.ligne}>
      <Ionicons name={icone} size={14} color={couleur} style={styles.puce} />
      {/* minHeight (jamais height) : les phrases s'allongent en grande police. */}
      <Text style={styles.ligneTexte}>{texte}</Text>
    </View>
  );
}

export function ClubDataDisclosure({ style }: Props) {
  return (
    <View style={[styles.bloc, style]} accessibilityRole="summary">
      <View style={styles.entete}>
        <Ionicons name="eye-outline" size={16} color={palette.sub} />
        <Text style={styles.titre}>{CLUB_DISCLOSURE.titre}</Text>
      </View>

      <Text style={styles.intro}>{CLUB_DISCLOSURE.intro}</Text>

      <Text style={styles.sousTitre}>{CLUB_DISCLOSURE.partageTitre}</Text>
      {CLUB_DISCLOSURE.partage.map((item) => (
        <Ligne key={item.texte} icone="checkmark" couleur={palette.sub} texte={item.texte} />
      ))}

      <Text style={styles.sousTitre}>{CLUB_DISCLOSURE.jamaisTitre}</Text>
      {CLUB_DISCLOSURE.jamais.map((texte) => (
        <Ligne key={texte} icone="close" couleur={palette.sub} texte={texte} />
      ))}

      <Text style={styles.note}>{CLUB_DISCLOSURE.note}</Text>
      <Text style={styles.note}>{CLUB_DISCLOSURE.sortie}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titre: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  intro: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.sub,
  },
  sousTitre: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.text,
    marginTop: 4,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  puce: {
    marginTop: 2,
  },
  ligneTexte: {
    flex: 1,
    minHeight: 17,
    fontSize: 12,
    lineHeight: 17,
    color: palette.sub,
  },
  note: {
    fontSize: 11,
    lineHeight: 16,
    color: palette.muted,
    marginTop: 4,
  },
});
