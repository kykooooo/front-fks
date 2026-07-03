import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import type { ExerciseVideoRef } from "../../engine/exerciseVideos";
import { YouTubePlayer } from "./YouTubePlayer";

type Props = {
  visible: boolean;
  videoRef: ExerciseVideoRef | null;
  label?: string;
  onClose: () => void;
};

function FksHostedVideo({
  visible,
  url,
  label,
  onClose,
}: {
  visible: boolean;
  url: string;
  label?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [hasError, setHasError] = useState(false);
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = true;
  });

  useEffect(() => {
    // Fallback propre en cas d'échec de lecture (source injoignable/corrompue).
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "error") setHasError(true);
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (visible && !hasError) player.play();
    else player.pause();
  }, [player, visible, hasError]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLabel}>
            <Ionicons name="videocam" size={20} color={theme.colors.accent} />
            <Text style={styles.title} numberOfLines={1}>
              {label || "Vidéo FKS"}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        {hasError ? (
          <View style={styles.errorBox}>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.sub} />
            <Text style={styles.errorTitle}>Vidéo indisponible</Text>
            <Text style={styles.hint}>
              La démonstration n’a pas pu être chargée. Réessaie plus tard.
            </Text>
          </View>
        ) : (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            fullscreenOptions={{ enable: true }}
          />
        )}
        <View style={styles.footer}>
          <Text style={styles.hint}>
            Démonstration officielle FKS. Regarde l’installation puis l’exécution.
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function ExerciseVideoPlayer({
  visible,
  videoRef,
  label,
  onClose,
}: Props) {
  if (videoRef?.kind === "fks_hosted") {
    return (
      <FksHostedVideo
        key={videoRef.url}
        visible={visible}
        url={videoRef.url}
        label={label}
        onClose={onClose}
      />
    );
  }
  return (
    <YouTubePlayer
      visible={visible && Boolean(videoRef)}
      url={videoRef?.url ?? null}
      label={label}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSoft,
  },
  headerLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: theme.colors.text },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.card,
  },
  video: { width: "100%", aspectRatio: 9 / 16, backgroundColor: "#000" },
  errorBox: {
    width: "100%",
    aspectRatio: 9 / 16,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  errorTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  footer: { padding: 20, gap: 18, alignItems: "center" },
  hint: {
    color: theme.colors.sub,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  doneButton: {
    paddingVertical: 13,
    paddingHorizontal: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
  },
  doneText: { color: "#fff", fontWeight: "800" },
});
