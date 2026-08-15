// screens/CoachOnboardingScreen.tsx
// Création d'un club par un coach/staff.
// Le coach pilote le contexte du club ; il ne génère pas les séances (c'est FKS le prépa).

import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Keyboard, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";

import { ScreenContainer } from "../components/ui/ScreenContainer";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { coachColors, coachRadius } from "../components/coach/coachUi";
import { createClubAsCoach } from "../repositories/clubsRepo";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { withTimeout, TimeoutError } from "../utils/errorHandler";

const palette = coachColors;

type CoachOnboardingScreenProps = {
  /**
   * SORTIE DE SECOURS QUAND CET ÉCRAN EST LE POINT D'ARRIVÉE.
   *
   * Fournie par le gate d'onboarding lorsque l'intention coach a été déclarée sur
   * l'écran d'accueil : la création de club est alors la PREMIÈRE route de la
   * pile, donc `goBack()` ne mène nulle part et « Retour » serait un bouton qui
   * ment. Le geste devient « Je suis joueur finalement », et c'est le navigateur
   * qui décide où il repose la personne (questionnaire joueur).
   *
   * Absente quand l'écran est ouvert depuis le profil : il y a un écran derrière,
   * « Retour » suffit et reste le comportement d'origine.
   */
  onRetourJoueur?: () => void;
};

export default function CoachOnboardingScreen({ onRetourJoueur }: CoachOnboardingScreenProps = {}) {
  const navigation = useNavigation<any>();
  const haptics = useHaptics();

  const [clubName, setClubName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = clubName.trim().length >= 2 && !loading;

  // Un seul geste de sortie affiché, celui qui est VRAI ici : revenir en arrière
  // s'il y a un arrière, renoncer à l'espace coach sinon.
  const peutRevenir = navigation.canGoBack?.() ?? false;
  const sortie = peutRevenir
    ? { label: "Retour", icon: "chevron-back" as const, onPress: () => navigation.goBack() }
    : onRetourJoueur
      ? { label: "Je suis joueur finalement", icon: "person-outline" as const, onPress: onRetourJoueur }
      : null;

  const handleSortie = () => {
    haptics.impactLight();
    sortie?.onPress();
  };

  const handleLogout = async () => {
    haptics.impactLight();
    try {
      await signOut(getAuth());
      // Le listener auth du RootNavigator renvoie vers la connexion.
    } catch (e) {
      if (__DEV__) console.warn("[CoachOnboarding] signOut failed", e);
      showToast({ type: "error", title: "Erreur", message: "Déconnexion impossible. Réessaie." });
    }
  };

  // Confirmation OBLIGATOIRE avant la création (décision Kyllian 15/08,
  // P1-07 inventaire clubs) : créer un club bascule TOUT le compte en espace
  // coach, sans retour possible sans le support. Deux boutons explicites,
  // aucun « oui » par défaut — le choix mis en avant est « Annuler ».
  const handleCreate = () => {
    if (!canSubmit) return;
    Keyboard.dismiss();

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      haptics.error();
      showToast({ type: "error", title: "Connexion requise", message: "Reconnecte-toi pour créer ton club." });
      return;
    }

    Alert.alert(
      "Créer un espace entraîneur ?",
      "Tu crées un espace ENTRAÎNEUR pour gérer des joueurs. Cette action est définitive sur ce compte.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Créer mon espace entraîneur", onPress: () => void doCreate(user.uid) },
      ],
      { cancelable: true }
    );
  };

  const doCreate = async (uid: string) => {
    try {
      setLoading(true);
      // Délai de garde 15 s (P1-27) : hors réseau, l'écriture Firestore pend
      // sans fin et l'overlay « Création de ton club... » gelait à jamais. Au
      // timeout : toast honnête, la saisie reste en place. Si l'écriture
      // atterrit après coup, le RootNavigator dérive l'espace coach tout seul.
      await withTimeout(createClubAsCoach({
        name: clubName.trim(),
        uid,
        coachName: coachName.trim() || null,
      }), 15000);
      haptics.success();
      // Plus de code annoncé ici : il n'est plus créé avec le club. Le coach le
      // génère quand il en a besoin (onglet Semaine), et il ne s'affiche qu'à
      // ce moment-là — le dire tout de suite évite de le chercher.
      showToast({
        type: "success",
        title: "Club créé !",
        message: "Génère ton code d'invitation depuis l'onglet Semaine.",
      });
      // Le RootNavigator bascule tout seul : il lit `users/{uid}.clubId`, s'abonne
      // à l'appartenance `clubs/{clubId}/members/{uid}` (écrite juste avant avec
      // le rôle propriétaire) et en dérive l'espace coach. Rien d'autre à faire ici.
    } catch (error) {
      if (error instanceof TimeoutError) {
        haptics.warning();
        showToast({
          type: "warn",
          title: "Impossible de créer le club pour le moment",
          message: "Vérifie ta connexion. Ta saisie est conservée — réessaie dans un instant.",
        });
        return;
      }
      if (__DEV__) console.error("[CoachOnboarding] create club failed:", error);
      haptics.error();
      showToast({ type: "error", title: "Erreur", message: "Impossible de créer le club. Réessaie." });
    } finally {
      setLoading(false);
    }
  };

  return (
    // AUDIT TACTILE (recette 03/08, même défaut que b708fe9 sur Register/Login) :
    // un TouchableWithoutFeedback enveloppait TOUT ce sous-arbre pour fermer le
    // clavier. Il pose un responder sur l'ensemble des descendants — les deux
    // champs de saisie et les trois boutons de cet écran compris — et avale les
    // taps au lieu de les laisser passer. Il est supprimé ; le clavier se ferme
    // par glissement (`keyboardDismissMode: "on-drag"`), et `handleCreate` fait
    // toujours son `Keyboard.dismiss()` explicite à la validation.
    <ScreenContainer
      keyboardAvoiding
      safeAreaStyle={styles.screenBg}
      contentContainerStyle={styles.screenBg}
      scrollProps={{ keyboardDismissMode: "on-drag" }}
    >
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          {sortie ? (
            <TouchableOpacity
              style={styles.backRow}
              onPress={handleSortie}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={sortie.label}
            >
              <Ionicons name={sortie.icon} size={20} color={palette.sub} />
              <Text style={styles.backText}>{sortie.label}</Text>
            </TouchableOpacity>
          ) : (
            // Aucun geste de sortie honnête ici : on garde la place pour que
            // « Se déconnecter » reste à droite, sans afficher de faux bouton.
            <View />
          )}
          <TouchableOpacity
            style={styles.backRow}
            onPress={handleLogout}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
          >
            <Ionicons name="log-out-outline" size={18} color={palette.sub} />
            <Text style={styles.backText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={26} color={palette.accent} />
          </View>
          <Text style={styles.title}>Espace coach</Text>
          <Text style={styles.subtitle}>
            Crée ton club, partage le code à tes joueurs, suis leur préparation. FKS construit la prépa, toi tu donnes
            le terrain.
          </Text>
        </View>

        <Card variant="soft" style={styles.card}>
          <Text style={styles.label}>Nom du club</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: FC Exemple U17"
            placeholderTextColor={palette.muted}
            value={clubName}
            onChangeText={setClubName}
            autoCapitalize="words"
            maxLength={60}
          />

          <Text style={styles.label}>Ton nom (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Coach Marvin"
            placeholderTextColor={palette.muted}
            value={coachName}
            onChangeText={setCoachName}
            autoCapitalize="words"
            maxLength={40}
          />

          <Button
            label={loading ? "Création..." : "Créer mon club"}
            onPress={handleCreate}
            disabled={!canSubmit}
            fullWidth
            style={styles.primaryBtn}
          />
        </Card>

        <Text style={styles.note}>
          Tu généreras ensuite un code d'invitation, valable 14 jours. Tes joueurs le saisissent à
          l'inscription pour rejoindre le club.
        </Text>
      </View>

      <LoadingOverlay visible={loading} message="Création de ton club..." />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenBg: {
    backgroundColor: palette.bg,
  },
  wrap: {
    flex: 1,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  backText: {
    color: palette.sub,
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.sub,
  },
  card: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: coachRadius.card,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
    marginTop: 10,
    letterSpacing: 0.1,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: coachRadius.chip,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.card,
  },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
    shadowColor: palette.accent,
    borderRadius: 10,
    marginTop: 8,
  },
  note: {
    fontSize: 12.5,
    lineHeight: 17,
    color: palette.muted,
  },
});
