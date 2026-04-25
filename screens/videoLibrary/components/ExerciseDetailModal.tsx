// screens/videoLibrary/components/ExerciseDetailModal.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { ModalContainer } from "../../../components/modal/ModalContainer";
import { EXERCISE_BY_ID, type ExerciseDef } from "../../../engine/exerciseBank";
import { EXERCISE_INSTRUCTIONS } from "../../../engine/exerciseInstructions";
import { getExerciseVideoRef } from "../../../engine/exerciseVideos";
import {
  MODALITY_CONFIG,
  MODALITY_LABELS,
  INTENSITY_LABELS,
  TAG_LABELS,
  EQUIPMENT_LABELS,
  formatDefaults,
  inferEquipment,
  type EquipmentKey,
} from "../videoLibraryConfig";

const palette = theme.colors;

type Props = {
  visible: boolean;
  exerciseId: string | null;
  onClose: () => void;
  onToggleFavorite: (exerciseId: string) => void;
  isFavorite: (exerciseId: string) => boolean;
  onOpenVideo: (exerciseId: string) => void;
  onOpenVariant: (exerciseId: string) => void;
  getVariants: (item: ExerciseDef) => ExerciseDef[];
  getNoEquipmentVariants: (item: ExerciseDef) => ExerciseDef[];
};

export function ExerciseDetailModal({
  visible,
  exerciseId,
  onClose,
  onToggleFavorite,
  isFavorite,
  onOpenVideo,
  onOpenVariant,
  getVariants,
  getNoEquipmentVariants,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [exerciseId]);

  const exercise = exerciseId ? EXERCISE_BY_ID[exerciseId] : undefined;
  if (!exercise) return null;

  const instruction = EXERCISE_INSTRUCTIONS[exercise.id];
  const videoRef = getExerciseVideoRef(exercise.id);
  const variants = getVariants(exercise);
  const noEquip = getNoEquipmentVariants(exercise);
  const equipment = inferEquipment(exercise);
  const favorite = isFavorite(exercise.id);
  const config = MODALITY_CONFIG[exercise.modality];

  const cues = instruction?.cues ?? [];
  const visibleCues = expanded ? cues : cues.slice(0, 2);
  const hasMoreCues = cues.length > 2;

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      animationType="slide"
      blurIntensity={40}
      allowBackdropDismiss
      allowSwipeDismiss
      showHandle={false}
      contentStyle={styles.modalSheet}
    >
      <View>
        <View style={[styles.modalAccentStrip, { backgroundColor: config.tint }]} />
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.modalModalityIcon, { backgroundColor: config.tintSoft }]}>
                <Ionicons name={config.icon as any} size={14} color={config.tint} />
              </View>
              <Text style={styles.modalTitle}>{exercise.name}</Text>
            </View>
            <Text style={styles.modalSub}>
              {MODALITY_LABELS[exercise.modality]} · {INTENSITY_LABELS[exercise.intensity]}
              {formatDefaults(exercise) ? ` · ${formatDefaults(exercise)}` : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.modalCloseButton}>
            <Ionicons name="close" size={18} color={palette.sub} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 6 }}>
            <Text style={styles.modalRowTitle}>Description</Text>
            <Text style={styles.modalRowText}>{exercise.description}</Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={() => onToggleFavorite(exercise.id)}
              activeOpacity={0.85}
              style={styles.modalActionButton}
            >
              <Ionicons
                name={favorite ? "star" : "star-outline"}
                size={16}
                color={favorite ? palette.accent : palette.sub}
              />
              <Text style={[styles.modalActionText, favorite && styles.modalActionTextActive]}>
                {favorite ? "En favori" : "Ajouter favori"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onOpenVideo(exercise.id)}
              activeOpacity={0.85}
              style={styles.modalActionButton}
            >
              <Ionicons name="logo-youtube" size={16} color={palette.sub} />
              <Text style={styles.modalActionText}>
                {videoRef.kind === "vetted" ? "Voir vidéo" : "Rechercher"}
              </Text>
            </TouchableOpacity>
          </View>

          {videoRef.kind === "vetted" ? (
            <Text style={[styles.modalRowText, { color: palette.muted }]}>
              Source : {videoRef.label}
            </Text>
          ) : null}

          {instruction ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Comment faire</Text>
              <Text style={styles.modalRowText}>{instruction.howTo}</Text>
              {visibleCues.length > 0 ? (
                <View style={{ gap: 4 }}>
                  {visibleCues.map((cue) => (
                    <Text key={`${exercise.id}_${cue}`} style={styles.modalRowText}>
                      • {cue}
                    </Text>
                  ))}
                </View>
              ) : null}
              {hasMoreCues ? (
                <TouchableOpacity
                  onPress={() => setExpanded((v) => !v)}
                  activeOpacity={0.85}
                  style={[styles.modalActionButton, { alignSelf: "flex-start" }]}
                >
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={palette.sub}
                  />
                  <Text style={styles.modalActionText}>{expanded ? "Voir moins" : "Voir plus"}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {equipment.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Matériel</Text>
              <View style={styles.modalChips}>
                {equipment.map((eq) => (
                  <View key={`${exercise.id}_${eq}`} style={styles.modalChip}>
                    <Text style={styles.modalChipText}>{EQUIPMENT_LABELS[eq]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {exercise.tags.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Tags</Text>
              <View style={styles.modalChips}>
                {exercise.tags.map((tag) => (
                  <View key={`${exercise.id}_${tag}`} style={styles.modalChip}>
                    <Text style={styles.modalChipText}>{TAG_LABELS[tag]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {variants.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Alternatives</Text>
              <View style={styles.modalChips}>
                {variants.map((variant) => (
                  <TouchableOpacity
                    key={`${exercise.id}_${variant.id}`}
                    onPress={() => onOpenVariant(variant.id)}
                    activeOpacity={0.85}
                    style={styles.modalChip}
                  >
                    <Text style={styles.modalChipText}>{variant.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {noEquip.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Alternatives (sans matériel)</Text>
              <View style={styles.modalChips}>
                {noEquip.map((variant) => (
                  <TouchableOpacity
                    key={`${exercise.id}_${variant.id}_bw`}
                    onPress={() => onOpenVariant(variant.id)}
                    activeOpacity={0.85}
                    style={[styles.modalChip, styles.modalChipAlt]}
                  >
                    <Text style={styles.modalChipTextAlt}>{variant.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  modalSheet: {
    backgroundColor: palette.bg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    maxHeight: "88%",
    overflow: "hidden",
  },
  modalAccentStrip: {
    height: 3,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.borderSoft,
    marginTop: 10,
    marginBottom: 10,
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modalModalityIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { flex: 1, fontSize: TYPE.body.fontSize, fontWeight: "800", color: palette.text },
  modalSub: { marginTop: 4, fontSize: TYPE.caption.fontSize, color: palette.sub, lineHeight: 16 },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: { paddingHorizontal: 14, paddingBottom: 18, gap: 12 },
  modalRowTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "800",
    color: palette.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modalRowText: { fontSize: TYPE.caption.fontSize, color: palette.sub, lineHeight: 18 },
  modalActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  modalActionText: { fontSize: TYPE.caption.fontSize, fontWeight: "800", color: palette.sub },
  modalActionTextActive: { color: palette.accent },
  modalChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  modalChipText: { fontSize: TYPE.caption.fontSize, color: palette.sub, fontWeight: "700" },
  modalChipAlt: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  modalChipTextAlt: { fontSize: TYPE.caption.fontSize, color: palette.accent, fontWeight: "800" },
});
