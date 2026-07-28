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
//
// ─── DEUX PALETTES, UN SEUL COMPOSANT (juillet 2026) ────────────────────────
// Depuis le bouton « Je m'entraîne aussi », cette divulgation s'affiche AUSSI
// dans l'espace coach — un encadrant qui entre dans son propre effectif suivi
// doit lire exactement ce que ses collègues verront de lui, mot pour mot.
//
// Or l'espace coach est CLAIR (`coachTheme`), tandis que l'espace joueur suit le
// thème de l'app, qui peut être SOMBRE. Rendre ce bloc avec la palette joueur
// sur une carte coach donnait, en mode sombre, du texte quasi blanc sur fond
// blanc : une divulgation illisible n'est pas une divulgation.
//
// On passe donc `variant`, et la palette est choisie ICI, une seule fois — même
// parti pris que `components/AppSpaceSwitch.tsx`. Deux composants jumeaux
// auraient divergé dès la première retouche, et l'une des deux copies aurait
// fini par dire autre chose que le contrat réel.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import { coachColors } from "../coach/coachTheme";
import { CLUB_DISCLOSURE } from "../../domain/clubDataDisclosure";

/** Les seules couleurs employées par ce bloc. Aucune teinte inventée ici. */
type DisclosurePalette = { border: string; text: string; sub: string; muted: string };

type Props = {
  /** Style d'espacement du conteneur (marges gérées par l'écran hôte). */
  style?: object;
  /**
   * Palette. `joueur` (défaut) = thème de l'app, `coach` = thème coach clair.
   * Le défaut laisse les deux écrans hôtes d'origine strictement inchangés.
   */
  variant?: "joueur" | "coach";
};

function Ligne({ icone, couleur, texte }: { icone: keyof typeof Ionicons.glyphMap; couleur: string; texte: string }) {
  return (
    <View style={styles.ligne}>
      <Ionicons name={icone} size={14} color={couleur} style={styles.puce} />
      {/* minHeight (jamais height) : les phrases s'allongent en grande police. */}
      <Text style={[styles.ligneTexte, { color: couleur }]}>{texte}</Text>
    </View>
  );
}

export function ClubDataDisclosure({ style, variant = "joueur" }: Props) {
  // Lue À CHAQUE RENDU, et non une fois au chargement du module : `theme.colors`
  // est MUTÉ par `setThemeMode`, donc une capture au niveau du module figerait
  // la palette du démarrage (c'est ce que faisait la version précédente).
  const palette: DisclosurePalette =
    variant === "coach"
      ? {
          border: coachColors.border,
          text: coachColors.text,
          sub: coachColors.sub,
          muted: coachColors.muted,
        }
      : {
          border: theme.colors.border,
          text: theme.colors.text,
          sub: theme.colors.sub,
          muted: theme.colors.muted,
        };

  return (
    <View style={[styles.bloc, { borderColor: palette.border }, style]} accessibilityRole="summary">
      <View style={styles.entete}>
        <Ionicons name="eye-outline" size={16} color={palette.sub} />
        <Text style={[styles.titre, { color: palette.text }]}>{CLUB_DISCLOSURE.titre}</Text>
      </View>

      <Text style={[styles.intro, { color: palette.sub }]}>{CLUB_DISCLOSURE.intro}</Text>

      <Text style={[styles.sousTitre, { color: palette.text }]}>
        {CLUB_DISCLOSURE.partageTitre}
      </Text>
      {CLUB_DISCLOSURE.partage.map((item) => (
        <Ligne key={item.texte} icone="checkmark" couleur={palette.sub} texte={item.texte} />
      ))}

      <Text style={[styles.sousTitre, { color: palette.text }]}>{CLUB_DISCLOSURE.jamaisTitre}</Text>
      {CLUB_DISCLOSURE.jamais.map((texte) => (
        <Ligne key={texte} icone="close" couleur={palette.sub} texte={texte} />
      ))}

      <Text style={[styles.note, { color: palette.muted }]}>{CLUB_DISCLOSURE.note}</Text>
      <Text style={[styles.note, { color: palette.muted }]}>{CLUB_DISCLOSURE.sortie}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Les COULEURS ne sont plus dans cette feuille : elles dépendent du `variant`
  // et sont posées au rendu. Ne restent ici que la géométrie et la typographie,
  // identiques dans les deux espaces.
  titre: {
    fontSize: 13,
    fontWeight: "700",
  },
  intro: {
    fontSize: 12,
    lineHeight: 17,
  },
  sousTitre: {
    fontSize: 12,
    fontWeight: "700",
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
  },
  note: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});
