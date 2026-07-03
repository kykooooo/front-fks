// screens/videoLibrary/components/ExerciseDetailModal.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { ModalContainer } from "../../../components/modal/ModalContainer";
import { EXERCISE_BY_ID, type ExerciseDef } from "../../../engine/exerciseBank";
import { EXERCISE_INSTRUCTIONS } from "../../../engine/exerciseInstructions";
import {
  getExerciseVideoRef,
  isDirectVideo,
  type ExerciseVideoRef,
} from "../../../engine/exerciseVideos";
import {
  catalogExerciseToView,
  type CatalogExercise,
  type ExerciseCatalogManifest,
} from "../../../engine/exerciseCatalogV2";
import { FKS_CATALOG_V2_ENABLED } from "../../../config/features";
import {
  resolveExerciseCatalogId,
  useExerciseCatalog,
} from "../../../services/exerciseCatalog";
import {
  MODALITY_CONFIG,
  MODALITY_LABELS,
  INTENSITY_LABELS,
  TAG_LABELS,
  EQUIPMENT_LABELS,
  formatDefaults,
  inferEquipment,
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

const videoStatusLabel = (ref: ExerciseVideoRef): string => {
  if (ref.kind === "fks_hosted") return "Vidéo officielle FKS";
  if (ref.kind === "vetted") {
    return ref.alternative ? "Vidéo alternative (variante)" : "Vidéo vérifiée";
  }
  return "Recherche vidéo";
};

const DOSAGE_FORMATTERS: Record<string, (v: number) => string> = {
  sets: (v) => `${v} série${v > 1 ? "s" : ""}`,
  repetitions: (v) => `${v} rép.`,
  reps: (v) => `${v} rép.`,
  restSec: (v) => `${v}s récup`,
  workSec: (v) => `${v}s effort`,
  durationMin: (v) => `${v} min`,
  durationSec: (v) => `${v}s`,
  distanceM: (v) => `${v} m`,
  contacts: (v) => `${v} contacts`,
  rounds: (v) => `${v} tours`,
};

const formatDosageDefaults = (entry: CatalogExercise): string[] =>
  Object.entries(entry.dosage.defaults).map(([key, value]) => {
    const fmt = DOSAGE_FORMATTERS[key];
    return fmt ? fmt(value) : `${key}: ${value}`;
  });

/** En-tête partagé (bandeau + titre + sous-titre + close). */
function DetailHeader({
  title,
  subtitle,
  tint,
  tintSoft,
  icon,
  onClose,
}: {
  title: string;
  subtitle: string;
  tint: string;
  tintSoft: string;
  icon: string;
  onClose: () => void;
}) {
  return (
    <>
      <View style={[styles.modalAccentStrip, { backgroundColor: tint }]} />
      <View style={styles.modalHandle} />
      <View style={styles.modalHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.modalModalityIcon, { backgroundColor: tintSoft }]}>
              <Ionicons name={icon as any} size={14} color={tint} />
            </View>
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <Text style={styles.modalSub}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.modalCloseButton}
        >
          <Ionicons name="close" size={18} color={palette.sub} />
        </TouchableOpacity>
      </View>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.modalRowTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// V2 : rendu 100% issu du catalogue (aucune dépendance à EXERCISE_BY_ID legacy)
// ─────────────────────────────────────────────────────────────────────────────
function CatalogDetailBody({
  entry,
  catalog,
  onClose,
  onToggleFavorite,
  isFavorite,
  onOpenVideo,
  onOpenVariant,
}: {
  entry: CatalogExercise;
  catalog: ExerciseCatalogManifest;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  onOpenVideo: (id: string) => void;
  onOpenVariant: (id: string) => void;
}) {
  const view = catalogExerciseToView(entry);
  const config = MODALITY_CONFIG[view.modality];
  const favorite = isFavorite(entry.id);
  const equipment = inferEquipment(view);
  const videoRef = getExerciseVideoRef(entry.id);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of catalog.exercises) map.set(e.id, e.name);
    return map;
  }, [catalog]);
  const labelFor = (id: string) => nameById.get(id) ?? id;

  const cues = entry.execution.cues.slice(0, 3);
  const dosage = formatDosageDefaults(entry);
  const progressions = entry.progression.progressions;
  const regressions = entry.progression.regressions;
  const dims = [entry.setup.dimensions, entry.setup.trajectory].filter(Boolean) as string[];

  return (
    <View>
      <DetailHeader
        title={entry.name}
        subtitle={`${MODALITY_LABELS[view.modality]} · ${INTENSITY_LABELS[view.intensity]}`}
        tint={config.tint}
        tintSoft={config.tintSoft}
        icon={config.icon}
        onClose={onClose}
      />

      <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
        {entry.description ? (
          <Section title="Description">
            <Text style={styles.modalRowText}>{entry.description}</Text>
          </Section>
        ) : null}

        {entry.footballContext ? (
          <Section title="Pourquoi c'est utile au foot">
            <Text style={styles.modalRowText}>{entry.footballContext}</Text>
          </Section>
        ) : null}

        <View style={styles.modalActions}>
          <TouchableOpacity
            onPress={() => onToggleFavorite(entry.id)}
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
            onPress={() => onOpenVideo(entry.id)}
            activeOpacity={0.85}
            style={styles.modalActionButton}
          >
            <Ionicons
              name={videoRef.kind === "fks_hosted" ? "videocam" : "logo-youtube"}
              size={16}
              color={palette.sub}
            />
            <Text style={styles.modalActionText}>
              {videoRef.kind === "search" ? "Rechercher" : "Voir vidéo"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.modalRowText, { color: palette.muted }]}>
          Statut vidéo : {videoStatusLabel(videoRef)}
          {isDirectVideo(videoRef) ? "" : " — pas de démo directe"}
        </Text>

        {entry.setup.instructions.length > 0 ? (
          <Section title="Installation">
            {entry.setup.instructions.map((line, idx) => (
              <Text key={`setup_${idx}`} style={styles.modalRowText}>• {line}</Text>
            ))}
          </Section>
        ) : null}

        {dims.length > 0 ? (
          <Section title="Dimensions / trajectoire">
            {dims.map((line, idx) => (
              <Text key={`dim_${idx}`} style={styles.modalRowText}>• {line}</Text>
            ))}
          </Section>
        ) : null}

        {entry.execution.steps.length > 0 ? (
          <Section title="Étapes">
            {entry.execution.steps.map((line, idx) => (
              <Text key={`step_${idx}`} style={styles.modalRowText}>{idx + 1}. {line}</Text>
            ))}
          </Section>
        ) : null}

        {cues.length > 0 ? (
          <Section title="Repères clés">
            {cues.map((cue, idx) => (
              <Text key={`cue_${idx}`} style={styles.modalRowText}>• {cue}</Text>
            ))}
          </Section>
        ) : null}

        {entry.execution.commonMistakes.length > 0 ? (
          <Section title="Erreurs fréquentes">
            {entry.execution.commonMistakes.map((line, idx) => (
              <Text key={`mistake_${idx}`} style={styles.modalRowText}>✕ {line}</Text>
            ))}
          </Section>
        ) : null}

        {dosage.length > 0 ? (
          <Section title="Dosage">
            <View style={styles.modalChips}>
              {dosage.map((part, idx) => (
                <View key={`dosage_${idx}`} style={styles.modalChip}>
                  <Text style={styles.modalChipText}>{part}</Text>
                </View>
              ))}
            </View>
            {entry.dosage.presets && entry.dosage.presets.length > 0 ? (
              <View style={styles.modalChips}>
                {entry.dosage.presets.map((preset) => (
                  <View key={`preset_${preset.id}`} style={[styles.modalChip, styles.modalChipAlt]}>
                    <Text style={styles.modalChipTextAlt}>{preset.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Section>
        ) : null}

        {equipment.length > 0 ? (
          <Section title="Matériel">
            <View style={styles.modalChips}>
              {equipment.map((eq) => (
                <View key={`eq_${eq}`} style={styles.modalChip}>
                  <Text style={styles.modalChipText}>{EQUIPMENT_LABELS[eq]}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {progressions.length > 0 ? (
          <Section title="Progressions">
            <View style={styles.modalChips}>
              {progressions.map((id) => (
                <TouchableOpacity
                  key={`prog_${id}`}
                  onPress={() => onOpenVariant(id)}
                  activeOpacity={0.85}
                  style={styles.modalChip}
                >
                  <Text style={styles.modalChipText}>{labelFor(id)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        ) : null}

        {regressions.length > 0 ? (
          <Section title="Régressions">
            <View style={styles.modalChips}>
              {regressions.map((id) => (
                <TouchableOpacity
                  key={`reg_${id}`}
                  onPress={() => onOpenVariant(id)}
                  activeOpacity={0.85}
                  style={[styles.modalChip, styles.modalChipAlt]}
                >
                  <Text style={styles.modalChipTextAlt}>{labelFor(id)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// V1 legacy : comportement inchangé
// ─────────────────────────────────────────────────────────────────────────────
function LegacyDetailBody({
  exercise,
  onClose,
  onToggleFavorite,
  isFavorite,
  onOpenVideo,
  onOpenVariant,
  getVariants,
  getNoEquipmentVariants,
}: {
  exercise: ExerciseDef;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  onOpenVideo: (id: string) => void;
  onOpenVariant: (id: string) => void;
  getVariants: (item: ExerciseDef) => ExerciseDef[];
  getNoEquipmentVariants: (item: ExerciseDef) => ExerciseDef[];
}) {
  // Remonté (via `key={exercise.id}`) à chaque changement d'exo : l'état `expanded`
  // repart naturellement à false, sans setState synchrone dans un effet.
  const [expanded, setExpanded] = useState(false);

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
    <View>
      <DetailHeader
        title={exercise.name}
        subtitle={`${MODALITY_LABELS[exercise.modality]} · ${INTENSITY_LABELS[exercise.intensity]}${
          formatDefaults(exercise) ? ` · ${formatDefaults(exercise)}` : ""
        }`}
        tint={config.tint}
        tintSoft={config.tintSoft}
        icon={config.icon}
        onClose={onClose}
      />

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
              {videoRef.kind === "search" ? "Rechercher" : "Voir vidéo"}
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
  );
}

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
  const catalog = useExerciseCatalog();

  const catalogEntry = useMemo(() => {
    if (!FKS_CATALOG_V2_ENABLED || !exerciseId) return null;
    const canonical = resolveExerciseCatalogId(exerciseId);
    return catalog.exercises.find((entry) => entry.id === canonical) ?? null;
  }, [exerciseId, catalog]);

  const legacyExercise = exerciseId ? EXERCISE_BY_ID[exerciseId] : undefined;
  if (!catalogEntry && !legacyExercise) return null;

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
      {catalogEntry ? (
        <CatalogDetailBody
          entry={catalogEntry}
          catalog={catalog}
          onClose={onClose}
          onToggleFavorite={onToggleFavorite}
          isFavorite={isFavorite}
          onOpenVideo={onOpenVideo}
          onOpenVariant={onOpenVariant}
        />
      ) : (
        <LegacyDetailBody
          key={legacyExercise!.id}
          exercise={legacyExercise!}
          onClose={onClose}
          onToggleFavorite={onToggleFavorite}
          isFavorite={isFavorite}
          onOpenVideo={onOpenVideo}
          onOpenVariant={onOpenVariant}
          getVariants={getVariants}
          getNoEquipmentVariants={getNoEquipmentVariants}
        />
      )}
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
    borderRadius: 999,
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
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: palette.text },
  modalSub: { marginTop: 4, fontSize: 12, color: palette.sub, lineHeight: 16 },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: { paddingHorizontal: 14, paddingBottom: 18, gap: 12 },
  modalRowTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modalRowText: { fontSize: 13, color: palette.sub, lineHeight: 18 },
  modalActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  modalActionText: { fontSize: 12, fontWeight: "800", color: palette.sub },
  modalActionTextActive: { color: palette.accent },
  modalChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  modalChipText: { fontSize: 12, color: palette.sub, fontWeight: "700" },
  modalChipAlt: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  modalChipTextAlt: { fontSize: 12, color: palette.accent, fontWeight: "800" },
});
