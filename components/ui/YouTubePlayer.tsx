// components/ui/YouTubePlayer.tsx
// Mini-player YouTube intégré dans l'app — le joueur ne quitte jamais l'écran.
// Affiche une WebView en modal bottom-sheet avec le player YouTube embed.

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";

const palette = theme.colors;
const SCREEN_W = Dimensions.get("window").width;

type Props = {
  visible: boolean;
  url: string | null;
  label?: string;
  onClose: () => void;
};

/** Extrait l'ID YouTube d'une URL (watch, embed, youtu.be, search) */
function extractYouTubeId(url: string): string | null {
  // youtu.be/XXXXX
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/watch?v=XXXXX
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  // youtube.com/embed/XXXXX
  const embed = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];
  return null;
}

/** Vérifie si c'est une URL de recherche YouTube */
function isYouTubeSearch(url: string): boolean {
  return url.includes("youtube.com/results");
}

export function YouTubePlayer({ visible, url, label, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const embedUrl = useMemo(() => {
    if (!url) return null;

    // Si c'est une recherche YouTube → on ouvre la page de résultats
    if (isYouTubeSearch(url)) return url;

    // Sinon on extrait l'ID et on fait un embed
    const id = extractYouTubeId(url);
    if (!id) return url; // Fallback: ouvre l'URL telle quelle

    return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }, [url]);

  if (!embedUrl) return null;

  const playerHeight = Math.round(SCREEN_W * 9 / 16); // 16:9

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="play-circle" size={20} color={palette.accent} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {label || "Vidéo exercice"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={20} color={palette.text} />
          </TouchableOpacity>
        </View>

        {/* Player WebView */}
        <View style={[styles.playerWrap, { height: playerHeight }]}>
          <WebView
            source={{ uri: embedUrl }}
            style={styles.webview}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            allowsFullscreenVideo
            renderLoading={() => (
              <View style={styles.loading}>
                <Text style={styles.loadingText}>Chargement...</Text>
              </View>
            )}
          />
        </View>

        {/* Espace sous le player — le joueur peut fermer ou lire les instructions */}
        <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.hint}>
            Regarde la vidéo puis ferme pour continuer ta séance.
          </Text>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            style={styles.doneButton}
          >
            <Text style={styles.doneButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  playerWrap: {
    width: "100%",
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  bottomArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 20,
    alignItems: "center",
  },
  hint: {
    fontSize: 14,
    color: palette.sub,
    textAlign: "center",
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.accent,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
