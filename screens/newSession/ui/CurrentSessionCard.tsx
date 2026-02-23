import React from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { palette } from "../theme";
import type { Exercise, Session } from "../../../domain/types";
import { toDateKey } from "../../../utils/dateHelpers";

type Props = {
  current: Session;
  nextAllowedISO?: string | null;
  alreadyAppliedToday: boolean;
  onFeedback: () => void;
  onAdvanceDay: () => void;
  onRestTwoDays: () => void;
};

export function CurrentSessionCard({
  current,
  nextAllowedISO,
  alreadyAppliedToday,
  onFeedback,
  onAdvanceDay,
  onRestTwoDays,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Séance déjà générée</Text>
      <Text style={styles.cardSubtitle}>
        Complète-la et donne ton feedback avant de générer la suivante.
      </Text>

      <Text style={styles.meta}>
        Phase : {current.phase} · Intensité : {current.intensity} · Volume : {current.volumeScore}
      </Text>

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

      <View style={[styles.buttonRow, { marginTop: 10 }]}>
        <TouchableOpacity style={[styles.cta, styles.ctaSecondaryGreen]} onPress={onAdvanceDay}>
          <Text style={styles.ctaSecondaryGreenText}>Jour OFF (+1j)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cta, styles.ctaSecondaryOrange]} onPress={onRestTwoDays}>
          <Text style={styles.ctaSecondaryOrangeText}>Repos 2 jours</Text>
        </TouchableOpacity>
      </View>

      {nextAllowedISO ? (
        <Text style={styles.helper}>
          Prochaine séance autorisée à partir du {toDateKey(nextAllowedISO)}
        </Text>
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
  ctaSecondaryOrange: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  ctaSecondaryOrangeText: {
    color: palette.accent,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: palette.sub,
  },
};
