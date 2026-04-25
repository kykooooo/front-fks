// screens/videoLibrary/components/ExerciseListCard.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { getExerciseVideoRef } from "../../../engine/exerciseVideos";
import type { ExerciseDef } from "../../../engine/exerciseBank";
import {
  MODALITY_CONFIG,
  MODALITY_LABELS,
  INTENSITY_LABELS,
  intensityTone,
  formatDefaults,
} from "../videoLibraryConfig";

const palette = theme.colors;

type Props = {
  item: ExerciseDef;
  isFavorite: boolean;
  isHighlighted: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onOpenVideo: () => void;
};

export const ExerciseListCard = React.memo(function ExerciseListCard({
  item,
  isFavorite,
  isHighlighted,
  onPress,
  onToggleFavorite,
  onOpenVideo,
}: Props) {
  const config = MODALITY_CONFIG[item.modality];
  const hasVettedVideo = getExerciseVideoRef(item.id).kind === "vetted";

  return (
    <Card
      variant="surface"
      style={[styles.exerciseCard, isHighlighted && styles.exerciseCardHighlight]}
    >
      <View style={[styles.accentBar, { backgroundColor: config.tint }]} />
      <View style={styles.exerciseInner}>
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.exercisePressArea}>
          <View style={styles.exerciseTitleRow}>
            <View style={styles.exerciseNameRow}>
              <Ionicons name={config.icon as any} size={14} color={config.tint} />
              <Text style={styles.exerciseName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Badge label={INTENSITY_LABELS[item.intensity]} tone={intensityTone(item.intensity)} />
          </View>
          <Text style={styles.exerciseMeta} numberOfLines={1}>
            {MODALITY_LABELS[item.modality]}
            {formatDefaults(item) ? ` · ${formatDefaults(item)}` : ""}
          </Text>
        </TouchableOpacity>

        <View style={styles.exerciseFooter}>
          {hasVettedVideo ? (
            <View style={styles.videoPill}>
              <Ionicons name="videocam" size={11} color={palette.accent} />
              <Text style={styles.videoPillText}>Vidéo</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.footerActions}>
            <TouchableOpacity
              onPress={onToggleFavorite}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.iconButton, isFavorite && styles.iconButtonActive]}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={15}
                color={isFavorite ? palette.accent : palette.sub}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onOpenVideo}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.iconButton}
            >
              <Ionicons name="logo-youtube" size={15} color={palette.sub} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  exerciseCard: { padding: 0, overflow: "hidden", flexDirection: "row" },
  exerciseCardHighlight: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  accentBar: {
    width: 4,
    borderTopLeftRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.lg,
  },
  exerciseInner: { flex: 1 },
  exercisePressArea: { paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  exerciseTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  exerciseNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  exerciseName: { fontSize: TYPE.body.fontSize, fontWeight: "700", color: palette.text, flex: 1 },
  exerciseMeta: { fontSize: TYPE.caption.fontSize, color: palette.sub },
  exerciseFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  videoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.accentSoft,
  },
  videoPillText: { fontSize: TYPE.micro.fontSize, fontWeight: "700", color: palette.accent },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
});
