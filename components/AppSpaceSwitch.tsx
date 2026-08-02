// components/AppSpaceSwitch.tsx
//
// LE SELECTEUR JOUEUR / COACH.
//
// Il ne s'affiche QUE pour les comptes qui ont reellement les deux espaces —
// un entraineur-joueur. Pour tous les autres, ce composant rend `null` : pas de
// carte vide, pas de bouton grise, rien. Un reglage qui ne sert a personne est
// un reglage qu'on n'affiche pas.
//
// ─── IL NE DECIDE RIEN ──────────────────────────────────────────────────────
// La condition d'affichage (`peutChoisir`) vient du serveur, relayee par
// `state/appSpaceGate`. Le choix, lui, est memorise localement
// (`hooks/useAppSpacePreference`) et ne fait que trancher entre deux espaces
// DEJA autorises. Si les permissions d'encadrement disparaissent, ce composant
// disparait avec elles et l'application bascule seule vers l'espace joueur —
// la preference memorisee n'y peut rien.
//
// ─── DEUX PALETTES, UN SEUL COMPOSANT ───────────────────────────────────────
// L'espace joueur est sombre (`constants/theme`), l'espace coach est clair
// (`components/coach/coachTheme`). Le meme selecteur doit vivre dans les deux
// sans jurer. On passe donc `variant`, et les couleurs sont choisies ICI, une
// seule fois : deux composants jumeaux auraient diverge des la premiere
// retouche.

import React, { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../constants/theme";
import { coachColors } from "./coach/coachTheme";
import { useHaptics } from "../hooks/useHaptics";
import type { AppSpace } from "../domain/appSpace";
import {
  onAppSpaceSwitchChange,
  readAppSpaceSwitch,
  type AppSpaceSwitchState,
} from "../state/appSpaceGate";

/** Libelles, ecrits une seule fois. Le mot « espace » est celui de l'app. */
const OPTIONS: Array<{ espace: AppSpace; libelle: string; a11y: string; icone: "barbell" | "clipboard" }> = [
  {
    espace: "player",
    libelle: "Joueur",
    a11y: "Afficher mon espace joueur : mes séances et ma progression",
    icone: "barbell",
  },
  {
    espace: "coach",
    libelle: "Coach",
    a11y: "Afficher mon espace coach : l'effectif et le cadre de la semaine",
    icone: "clipboard",
  },
];

const TITRE = "Espace affiché";
const AIDE =
  "Tu encadres ce club et tu y joues. Choisis l'espace que l'application ouvre : ce choix est gardé sur ce téléphone.";

/**
 * S'abonne au portillon. Aucun abonnement Firestore ici : on relaie, c'est tout.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` + `useEffect` : c'est l'outil
 * fait pour une source externe au rendu (ici, un singleton de module). Il lit la
 * valeur PENDANT le rendu, donc une publication survenue entre le premier rendu
 * et l'abonnement n'est jamais manquée — et il n'y a aucun `setState` dans un
 * effet, donc aucun rendu en cascade.
 */
export function useAppSpaceSwitch(): AppSpaceSwitchState {
  return useSyncExternalStore(onAppSpaceSwitchChange, readAppSpaceSwitch, readAppSpaceSwitch);
}

export type AppSpaceSwitchProps = {
  /** Palette. `joueur` = thème sombre, `coach` = thème clair. */
  variant: "joueur" | "coach";
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AppSpaceSwitch({ variant, style, testID }: AppSpaceSwitchProps) {
  const { peutChoisir, espace, choisir } = useAppSpaceSwitch();
  const haptics = useHaptics();

  // LA CONDITION D'AFFICHAGE, ET ELLE EST UNIQUE. Pas de repli, pas de « au cas
  // où » : sans droit aux deux espaces, il n'y a rien à choisir.
  if (!peutChoisir) return null;

  const c = variant === "coach" ? PALETTE_COACH : PALETTE_JOUEUR;

  return (
    <View
      testID={testID}
      style={[styles.carte, { backgroundColor: c.fond, borderColor: c.bordure }, style]}
    >
      <Text style={[styles.titre, { color: c.texte }]} numberOfLines={1}>
        {TITRE}
      </Text>
      <Text style={[styles.aide, { color: c.sub }]} numberOfLines={3}>
        {AIDE}
      </Text>

      <View style={[styles.piste, { backgroundColor: c.piste }]}>
        {OPTIONS.map((option) => {
          const actif = option.espace === espace;
          return (
            <Pressable
              key={option.espace}
              testID={`app-space-switch-${option.espace}`}
              accessibilityRole="button"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={option.a11y}
              onPress={() => {
                if (actif) return;
                haptics.impactLight();
                choisir(option.espace);
              }}
              style={[
                styles.option,
                actif && { backgroundColor: c.actifFond, borderColor: c.actifBordure },
              ]}
            >
              <Ionicons
                name={actif ? option.icone : (`${option.icone}-outline` as never)}
                size={16}
                color={actif ? c.actifTexte : c.sub}
              />
              <Text
                style={[styles.optionTexte, { color: actif ? c.actifTexte : c.sub }]}
                numberOfLines={1}
              >
                {option.libelle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const PALETTE_JOUEUR = {
  fond: theme.colors.card,
  bordure: theme.colors.border,
  texte: theme.colors.text,
  sub: theme.colors.sub,
  piste: theme.colors.bg,
  actifFond: theme.colors.accent,
  actifBordure: theme.colors.accent,
  actifTexte: theme.colors.bg,
};

const PALETTE_COACH = {
  fond: coachColors.card,
  bordure: coachColors.border,
  texte: coachColors.text,
  sub: coachColors.sub,
  piste: coachColors.cardAlt,
  actifFond: coachColors.card,
  actifBordure: coachColors.borderStrong,
  actifTexte: coachColors.text,
};

const styles = StyleSheet.create({
  carte: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  // `minHeight` et jamais `height` (règle d'or) : ces textes sont traduits et
  // peuvent grossir avec les réglages d'accessibilité du téléphone.
  titre: { fontSize: 15, fontWeight: "700", minHeight: 20 },
  aide: { fontSize: 13, lineHeight: 18, minHeight: 18 },
  piste: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 36,
  },
  optionTexte: { fontSize: 14, fontWeight: "600" },
});
