// components/auth/CoachEntryLink.tsx
//
// L'ENTRÉE COACH, SUR TOUS LES ÉCRANS D'ENTRÉE — PAS SEULEMENT L'ACCUEIL.
//
// L'accueil (WelcomeScreen) porte ce lien depuis le 03/08. Problème trouvé par
// l'audit d'inscription du 05/09 : cet écran est INATTEIGNABLE dès le deuxième
// lancement de l'app (`fks_welcome_done` posé par ses trois boutons, aucun
// `navigate("Welcome")` nulle part). Un coach qui installe l'app, la ferme,
// puis revient, n'a plus AUCUNE porte coach — il tombe sur la connexion.
//
// Ce composant remet la porte là où elle manque : sous les formulaires de
// connexion et d'inscription. Même grammaire visuelle que le lien de l'accueil
// (icône + caption `sub`, jamais un second bouton primaire : un seul CTA par
// écran, règle d'or).
//
// IL EST RÉVERSIBLE, et c'est délibéré : un joueur qui tape par curiosité doit
// pouvoir revenir d'un geste, au même endroit, sans avoir à traverser un écran
// de création de club pour y trouver « Je suis joueur finalement ».

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../constants/theme";
import { useHaptics } from "../../hooks/useHaptics";
import { showToast } from "../../utils/toast";
import {
  effacerIntentionCoach,
  lireIntentionCoach,
  poserIntentionCoach,
} from "../../services/coachIntent";

const palette = theme.colors;

/** Plafond d'agrandissement : ce bloc vit sous un formulaire, en bas d'écran. */
const PLAFOND_TITRE = 1.2;

export const TEXTE_LIEN_COACH = "Vous êtes coach ?";
export const TEXTE_INTENTION_POSEE = "Compte coach — tu créeras ton club juste après";
export const TEXTE_ANNULER = "Finalement, je suis joueur";

type Props = {
  /** Rendu de test : permet de vérifier l'état affiché sans AsyncStorage réel. */
  testID?: string;
};

export function CoachEntryLink({ testID }: Props) {
  const haptics = useHaptics();
  const [intention, setIntention] = useState(false);

  // Relecture au montage : l'intention peut avoir été posée sur l'accueil, sur
  // l'autre écran d'entrée, ou lors d'un lancement précédent.
  useEffect(() => {
    let vivant = true;
    void (async () => {
      const posee = await lireIntentionCoach();
      if (vivant) setIntention(posee);
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const basculer = async () => {
    haptics.impactLight();
    if (intention) {
      setIntention(false);
      await effacerIntentionCoach();
      showToast({
        type: "info",
        title: "Parcours joueur",
        message: "On repart sur l'inscription joueur.",
      });
      return;
    }
    setIntention(true);
    await poserIntentionCoach();
    showToast({
      type: "success",
      title: "Espace coach",
      message: "Tu créeras ton club juste après la connexion.",
    });
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        onPress={() => void basculer()}
        style={({ pressed }) => [styles.lien, pressed && styles.lienPresse]}
        hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityState={{ selected: intention }}
        accessibilityLabel={
          intention
            ? "Espace coach activé, revenir au parcours joueur"
            : "Vous êtes coach, créer votre club"
        }
      >
        <Ionicons
          name={intention ? "checkmark-circle" : "people-outline"}
          size={14}
          color={intention ? palette.accent : palette.sub}
        />
        <Text
          style={[styles.lienTexte, intention && styles.lienTexteActif]}
          maxFontSizeMultiplier={PLAFOND_TITRE}
        >
          {intention ? TEXTE_INTENTION_POSEE : TEXTE_LIEN_COACH}
        </Text>
      </Pressable>
      {intention ? (
        <Pressable
          onPress={() => void basculer()}
          style={({ pressed }) => [styles.annuler, pressed && styles.lienPresse]}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={TEXTE_ANNULER}
        >
          <Text style={styles.annulerTexte} maxFontSizeMultiplier={PLAFOND_TITRE}>
            {TEXTE_ANNULER}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  lien: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  // Même opacité de press que le reste du parcours (DA Polish lot0 §1.3).
  lienPresse: { opacity: 0.7 },
  lienTexte: {
    ...theme.typography.caption,
    color: palette.sub,
    fontWeight: "600",
    textAlign: "center",
  },
  lienTexteActif: { color: palette.accent },
  annuler: { paddingVertical: 6 },
  annulerTexte: {
    ...theme.typography.caption,
    color: palette.sub,
    textDecorationLine: "underline",
  },
});
