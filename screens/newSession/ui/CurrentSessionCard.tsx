import React from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { palette } from "../theme";
import type { Exercise, Session } from "../../../domain/types";
import { toDateKey } from "../../../utils/dateHelpers";
import { frIntensity } from "../../../utils/frLabels";
import { useSessionsStore } from "../../../state/stores/useSessionsStore";
import { useNavGuard } from "../../../hooks/useNavGuard";

type Props = {
  current: Session;
  /** Phase d'affichage dérivée du cycle (ex: "Pic de forme"). Voir utils/microcycleUtils. */
  phaseLabel?: string | null;
  /** Phrase de sens de la phase courante (optionnelle). */
  phaseMeaning?: string | null;
  alreadyAppliedToday: boolean;
  onFeedback: () => void;
  onAdvanceDay: () => void;
};

export function CurrentSessionCard({
  current,
  phaseLabel,
  phaseMeaning,
  alreadyAppliedToday,
  onFeedback,
  onAdvanceDay,
}: Props) {
  const nav = useNavigation<any>();
  const guardNav = useNavGuard();
  const lastAiSessionV2 = useSessionsStore((s) => s.lastAiSessionV2);
  // S22 — v2 de la séance en cours (même source que usePrimaryCta) pour
  // pouvoir la rouvrir en preview, pas seulement donner le feedback.
  const pendingV2 = current.aiV2 ?? current.ai ?? lastAiSessionV2?.v2 ?? null;
  const openSession = () => {
    if (!pendingV2) return;
    guardNav(() =>
      nav.navigate("SessionPreview", {
        v2: pendingV2,
        plannedDateISO: toDateKey(current.dateISO ?? current.date),
        sessionId: current.id,
      })
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Séance déjà générée</Text>
      <Text style={styles.cardSubtitle}>
        Complète-la et donne ton feedback avant de générer la suivante.
      </Text>

      <Text style={styles.meta}>
        {phaseLabel ? `Phase : ${phaseLabel} · ` : ""}Intensité : {frIntensity(current.intensity) || "—"} · Volume : {current.volumeScore}
      </Text>
      {phaseLabel && phaseMeaning ? (
        <Text style={styles.phaseMeaning}>{phaseMeaning}</Text>
      ) : null}

      <FlatList<Exercise>
        data={Array.isArray(current.exercises) ? current.exercises : []}
        keyExtractor={(e) => e.id}
        style={styles.list}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.exerciseItem}>
            <Text style={styles.exerciseName}>{item.name}</Text>
            <Text style={styles.exerciseDetail}>
              {item.sets ? `${item.sets} séries` : ""}
              {item.sets && (item.reps || item.durationSec) ? " · " : ""}
              {typeof item.reps === "number" ? `${item.reps} reps` : ""}
              {typeof item.durationSec === "number" ? ` ${Math.round(item.durationSec)} s` : ""}
              {item.restSec ? ` · repos ${item.restSec}s` : ""}
              {item.intensity ? ` · ${item.intensity}` : ""}
            </Text>
            {item.notes ? <Text style={styles.exerciseNotes}>{item.notes}</Text> : null}
          </View>
        )}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.cta, styles.ctaPrimary]} onPress={onFeedback}>
          <Text style={styles.ctaPrimaryText}>Donner mon feedback</Text>
        </TouchableOpacity>
      </View>

      {pendingV2 ? (
        <View style={[styles.buttonRow, { marginTop: 10 }]}>
          <TouchableOpacity style={[styles.cta, styles.ctaSecondaryGreen]} onPress={openSession}>
            <Text style={styles.ctaSecondaryGreenText}>Voir la séance</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Outil d'horloge DEV — gaté __DEV__, voir GenerationActions (P1-10). */}
      {__DEV__ ? (
        <View style={[styles.buttonRow, { marginTop: 10 }]}>
          <TouchableOpacity style={[styles.cta, styles.ctaSecondaryGreen]} onPress={onAdvanceDay}>
            <Text style={styles.ctaSecondaryGreenText}>Jour OFF (+1j)</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {alreadyAppliedToday ? (
        <Text style={[styles.helper, { marginTop: 4 }]}>
          Info : tu as déjà validé une séance aujourd’hui — cette séance est probablement datée demain.
        </Text>
      ) : null}
    </View>
  );
}

const styles = {
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.card,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 4,
    color: palette.sub,
  },
  meta: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 8,
  },
  phaseMeaning: {
    fontSize: 11.5,
    color: palette.sub,
    marginTop: 4,
    lineHeight: 16,
    fontStyle: "italic" as const,
  },
  list: { marginTop: 10 },
  exerciseItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: palette.text,
  },
  exerciseDetail: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  exerciseNotes: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: "row" as const,
    gap: 10,
    marginTop: 14,
  },
  cta: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ctaPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  ctaPrimaryText: {
    color: palette.bg,
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    fontSize: 13,
  },
  ctaSecondaryGreen: {
    backgroundColor: palette.cardSoft,
    borderColor: palette.borderSoft,
  },
  ctaSecondaryGreenText: {
    color: palette.text,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: palette.sub,
  },
};
