// components/signal/SignalController.tsx
//
// Écran Signal FKS (overlay plein écran). N'affiche AUCUN temps de réaction ni
// score. Le téléphone est supposé posé : pas d'animation obligeant à regarder.

import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import { useSignalController } from "../../hooks/useSignalController";
import type { SignalEngineConfig, SignalSnapshot } from "../../engine/signal/signalEngine";

const palette = theme.colors;

type Props = {
  visible: boolean;
  onClose: () => void;
  engineConfig: SignalEngineConfig;
  exerciseId: string;
  catalogVersion?: string | null;
};

const CHECKLIST = [
  { icon: "phone-portrait-outline", text: "Téléphone posé et sécurisé" },
  { icon: "resize-outline", text: "Espace dégagé autour de toi" },
  { icon: "volume-high-outline", text: "Volume monté et audible" },
];

function PrepView({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.kicker}>SIGNAL FKS</Text>
      <Text style={styles.title}>Prépare ta zone</Text>
      <View style={styles.checklist}>
        {CHECKLIST.map((row) => (
          <View key={row.text} style={styles.checkRow}>
            <Ionicons name={row.icon as any} size={20} color={palette.accent} />
            <Text style={styles.checkText}>{row.text}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={onStart} activeOpacity={0.85} style={styles.primaryButton}>
        <Ionicons name="play" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Démarrer la séquence</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.ghostButton}>
        <Text style={styles.ghostButtonText}>Fermer</Text>
      </TouchableOpacity>
    </View>
  );
}

const STATE_COPY: Record<string, { title: string; subtitle: string }> = {
  countdown: { title: "Prépare-toi", subtitle: "Le premier signal arrive." },
  waiting: { title: "Reste prêt", subtitle: "Écoute le signal." },
  recovery: { title: "Récupération", subtitle: "Reviens en marchant." },
  paused: { title: "En pause", subtitle: "Reprends quand tu es prêt." },
};

function ActiveView({
  snapshot,
  onPause,
  onResume,
  onStop,
}: {
  snapshot: SignalSnapshot;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const isCue = snapshot.state === "cue";
  const isPaused = snapshot.state === "paused";
  const copy = STATE_COPY[snapshot.state] ?? STATE_COPY.waiting;

  return (
    <View style={styles.center}>
      <Text style={styles.repCounter}>
        {snapshot.currentRep > 0
          ? `Répétition ${snapshot.currentRep}/${snapshot.totalReps}`
          : `${snapshot.totalReps} répétitions`}
      </Text>

      {isCue && snapshot.currentCue ? (
        <View style={styles.cueBox}>
          <Text style={styles.cueText}>{snapshot.currentCue.toUpperCase()}</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
      )}

      <View style={styles.controlsRow}>
        {isPaused ? (
          <TouchableOpacity onPress={onResume} activeOpacity={0.85} style={styles.primaryButton}>
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Reprendre</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onPause} activeOpacity={0.85} style={styles.secondaryButton}>
            <Ionicons name="pause" size={18} color={palette.text} />
            <Text style={styles.secondaryButtonText}>Pause</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onStop} activeOpacity={0.85} style={styles.stopButton}>
          <Ionicons name="stop" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Arrêter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CompletedView({ snapshot, onClose }: { snapshot: SignalSnapshot; onClose: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="checkmark-circle" size={56} color={palette.accent} />
      <Text style={styles.title}>Séquence terminée</Text>
      <Text style={styles.subtitle}>
        {snapshot.completedReps} signal{snapshot.completedReps > 1 ? "s" : ""} effectué
        {snapshot.completedReps > 1 ? "s" : ""}.
      </Text>
      <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Fermer</Text>
      </TouchableOpacity>
    </View>
  );
}

function ErrorView({ code, onClose }: { code: string | null; onClose: () => void }) {
  const message =
    code === "missing_audio_assets"
      ? "Les consignes vocales ne sont pas encore disponibles sur cette version."
      : "La lecture audio a échoué. Réessaie plus tard.";
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={52} color={palette.sub} />
      <Text style={styles.title}>Signal indisponible</Text>
      <Text style={styles.subtitle}>{message}</Text>
      <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Fermer</Text>
      </TouchableOpacity>
    </View>
  );
}

export function SignalController({
  visible,
  onClose,
  engineConfig,
  exerciseId,
  catalogVersion,
}: Props) {
  const { snapshot, start, pause, resume, stop } = useSignalController({
    engineConfig,
    exerciseId,
    catalogVersion,
  });

  const handleClose = () => {
    stop();
    onClose();
  };

  const renderBody = () => {
    switch (snapshot.state) {
      case "idle":
        return <PrepView onStart={start} onClose={onClose} />;
      case "completed":
        return <CompletedView snapshot={snapshot} onClose={handleClose} />;
      case "error":
        return <ErrorView code={snapshot.errorCode} onClose={handleClose} />;
      default:
        return (
          <ActiveView snapshot={snapshot} onPause={pause} onResume={resume} onStop={handleClose} />
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>{renderBody()}</SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.8,
    color: palette.sub,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: { fontSize: 24, fontWeight: "800", color: palette.text, textAlign: "center" },
  subtitle: { fontSize: 15, color: palette.sub, textAlign: "center", lineHeight: 21 },
  checklist: { gap: 14, marginVertical: 12, alignSelf: "stretch" },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  checkText: { fontSize: 15, color: palette.text, fontWeight: "600", flex: 1 },
  repCounter: { fontSize: 14, fontWeight: "800", color: palette.sub, letterSpacing: 0.5 },
  cueBox: {
    width: "100%",
    paddingVertical: 48,
    borderRadius: theme.radius.xl,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cueText: { fontSize: 52, fontWeight: "900", color: palette.accent, letterSpacing: 2 },
  controlsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.accent,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  secondaryButtonText: { color: palette.text, fontWeight: "800", fontSize: 15 },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.danger,
  },
  ghostButton: { paddingVertical: 10, paddingHorizontal: 20 },
  ghostButtonText: { color: palette.sub, fontWeight: "700", fontSize: 14 },
});
