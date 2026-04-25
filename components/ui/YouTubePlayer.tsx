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
import { theme, TYPE, RADIUS } from "../../constants/theme";

const palette = theme.colors;
const SCREEN_W = Dimensions.get("window").width;

type Props = {
  visible: boolean;
  url: string | null;
  label?: string;
  onClose: () => void;
};

function extractYouTubeId(url: string): string | null {
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];

  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];

  const embed = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];

  const shorts = url.match(/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shorts) return shorts[1];

  return null;
}

function isYouTubeSearch(url: string): boolean {
  return url.includes("youtube.com/results");
}

export function YouTubePlayer({ visible, url, label, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const isSearchPage = useMemo(() => (url ? isYouTubeSearch(url) : false), [url]);
  const videoId = useMemo(() => (url ? extractYouTubeId(url) : null), [url]);

  // The native YouTube embed inside WebView is unreliable and often throws error 153.
  // On iOS/Android, we prefer the real YouTube page inside the app. On web, we can keep the embed.
  const useEmbeddedPlayer = Platform.OS === "web" && !!videoId && !isSearchPage;

  const playerUrl = useMemo(() => {
    if (!url) return null;

    if (!useEmbeddedPlayer) {
      if (videoId && !isSearchPage) {
        return url.includes("/shorts/")
          ? `https://www.youtube.com/shorts/${videoId}`
          : `https://www.youtube.com/watch?v=${videoId}&autoplay=1&playsinline=1`;
      }
      return url;
    }

    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }, [isSearchPage, url, useEmbeddedPlayer, videoId]);

  if (!playerUrl) return null;

  const playerHeight = Math.round((SCREEN_W * 9) / 16);
  const browserHint =
    videoId && !isSearchPage
      ? "La vidéo s'ouvre directement dans l'app. Ferme quand tu as fini."
      : "Choisis une vidéo puis ferme pour revenir à ta séance.";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="play-circle" size={20} color={palette.accent} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {label || "Vidéo de l'exercice"}
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

        {useEmbeddedPlayer ? (
          <>
            <View style={[styles.playerWrap, { height: playerHeight }]}>
              <WebView
                source={{ uri: playerUrl }}
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
          </>
        ) : (
          <>
            <View style={styles.browserHintRow}>
              <Text style={styles.browserHint}>{browserHint}</Text>
            </View>
            <View style={[styles.browserWrap, { paddingBottom: insets.bottom }]}>
              <WebView
                source={{ uri: playerUrl }}
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
          </>
        )}
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
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.lg,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  playerWrap: {
    width: "100%",
    backgroundColor: theme.colors.black,
  },
  browserWrap: {
    flex: 1,
    width: "100%",
    backgroundColor: theme.colors.black,
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: theme.colors.white50,
    fontSize: TYPE.caption.fontSize,
  },
  browserHintRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  browserHint: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    textAlign: "center",
  },
  bottomArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 20,
    alignItems: "center",
  },
  hint: {
    fontSize: TYPE.body.fontSize,
    color: palette.sub,
    textAlign: "center",
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.accent,
  },
  doneButtonText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: theme.colors.white,
  },
});
