import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../services/firebase";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAppModeStore, type AppMode } from "../state/appModeStore";
import { showToast } from "../utils/toast";

const palette = theme.colors;

export default function ModeSelectScreen() {
  const storeUid = useAppModeStore((s) => s.uid);
  const setModeForUid = useAppModeStore((s) => s.setModeForUid);
  const [selecting, setSelecting] = useState(false);

  // Toujours récupérer l'uid depuis auth.currentUser en priorité
  const pick = useCallback(async (mode: AppMode) => {
    if (selecting) return; // Éviter double-tap

    const currentUid = auth.currentUser?.uid ?? storeUid;
    if (!currentUid) {
      showToast({
        type: "error",
        title: "Connexion requise",
        message: "Impossible de récupérer ton compte. Reconnecte-toi.",
      });
      return;
    }

    try {
      setSelecting(true);
      await setModeForUid(currentUid, mode);
      // Le RootNavigator naviguera automatiquement via le store
    } catch (error) {
      if (__DEV__) console.error("[ModeSelect] Error setting mode:", error);
      showToast({ type: "error", title: "Erreur", message: "Impossible de sélectionner le mode." });
      setSelecting(false);
    }
  }, [selecting, storeUid, setModeForUid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choisis ton mode</Text>
          <Text style={styles.subtitle}>
            Tu peux changer plus tard dans Paramètres.
          </Text>
        </View>

        <Card variant="surface" style={styles.card}>
          <Text style={styles.cardTitle}>Joueur</Text>
          <Text style={styles.cardSub}>
            Planifie et réalise tes séances, suis ta forme et ton historique.
          </Text>
          <Button
            label={selecting ? "Chargement..." : "Continuer en joueur"}
            fullWidth
            onPress={() => pick("player")}
            disabled={selecting}
          />
        </Card>

        <Card variant="surface" style={styles.card}>
          <Text style={styles.cardTitle}>Coach</Text>
          <Text style={styles.cardSub}>
            Consulte l'activité des joueurs de ton club (séances, planning).
          </Text>
          <Button
            label={selecting ? "Chargement..." : "Accéder à l'espace coach"}
            fullWidth
            variant="secondary"
            onPress={() => pick("coach")}
            disabled={selecting}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 14 },
  header: { gap: 6, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: "900", color: palette.text },
  subtitle: { fontSize: 14, color: palette.sub },
  card: { padding: 16, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: palette.text },
  cardSub: { fontSize: 13, color: palette.sub, lineHeight: 18 },
});
