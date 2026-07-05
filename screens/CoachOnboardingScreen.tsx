// screens/CoachOnboardingScreen.tsx
// Création d'un club par un coach/staff.
// Le coach pilote le contexte du club ; il ne génère pas les séances (c'est FKS le prépa).

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
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

const palette = coachColors;

export default function CoachOnboardingScreen() {
  const navigation = useNavigation<any>();
  const haptics = useHaptics();

  const [clubName, setClubName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = clubName.trim().length >= 2 && !loading;

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

  const handleCreate = async () => {
    if (!canSubmit) return;
    Keyboard.dismiss();

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      haptics.error();
      showToast({ type: "error", title: "Connexion requise", message: "Reconnecte-toi pour créer ton club." });
      return;
    }

    try {
      setLoading(true);
      const club = await createClubAsCoach({
        name: clubName.trim(),
        uid: user.uid,
        coachName: coachName.trim() || null,
      });
      haptics.success();
      showToast({
        type: "success",
        title: "Club créé !",
        message: `Code d'invitation : ${club.inviteCode}`,
      });
      // Le listener du profil (RootNavigator) détecte role="coach" et bascule
      // automatiquement vers l'espace coach. Rien d'autre à faire ici.
    } catch (error) {
      if (__DEV__) console.error("[CoachOnboarding] create club failed:", error);
      haptics.error();
      showToast({ type: "error", title: "Erreur", message: "Impossible de créer le club. Réessaie." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer keyboardAvoiding safeAreaStyle={styles.screenBg} contentContainerStyle={styles.screenBg}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.wrap}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={palette.sub} />
              <Text style={styles.backText}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backRow} onPress={handleLogout} activeOpacity={0.7}>
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
            Un code d'invitation unique sera généré. Tes joueurs le saisissent à l'inscription pour rejoindre le club.
          </Text>
        </View>
      </TouchableWithoutFeedback>

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
