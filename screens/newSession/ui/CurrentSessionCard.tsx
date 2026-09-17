// screens/newSession/ui/CurrentSessionCard.tsx
//
// Restylage DA joueur (SPEC_DA_ACCUEIL_SEANCE.md §3.8) : MÊME contenu (liste
// d'exercices, méta, phase), seul le gabarit change.
import React from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { da, PLAFOND_TEXTE } from "../../../constants/daJoueur";
import { DaCard } from "../../../components/ui/da/DaCard";
import { DaPrimaryButton } from "../../../components/ui/da/DaPrimaryButton";
import { DaTextButton } from "../../../components/ui/da/DaTextButton";
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
    <DaCard>
      <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TEXTE}>
        Séance déjà générée
      </Text>
      <Text style={styles.sousTitre} maxFontSizeMultiplier={PLAFOND_TEXTE}>
        Complète-la et donne ton feedback avant de générer la suivante.
      </Text>

      <Text style={styles.meta} maxFontSizeMultiplier={PLAFOND_TEXTE}>
        {phaseLabel ? `Phase : ${phaseLabel} · ` : ""}Intensité : {frIntensity(current.intensity) || "—"} · Volume : {current.volumeScore}
      </Text>
      {phaseLabel && phaseMeaning ? (
        <Text style={styles.phaseMeaning} maxFontSizeMultiplier={PLAFOND_TEXTE}>
          {phaseMeaning}
        </Text>
      ) : null}

      <FlatList<Exercise>
        data={Array.isArray(current.exercises) ? current.exercises : []}
        keyExtractor={(e) => e.id}
        style={styles.liste}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.exerciceLigne}>
            <Text style={styles.exerciceNom} maxFontSizeMultiplier={PLAFOND_TEXTE}>
              {item.name}
            </Text>
            <Text style={styles.exerciceDetail} maxFontSizeMultiplier={PLAFOND_TEXTE}>
              {item.sets ? `${item.sets} séries` : ""}
              {item.sets && (item.reps || item.durationSec) ? " · " : ""}
              {typeof item.reps === "number" ? `${item.reps} reps` : ""}
              {typeof item.durationSec === "number" ? ` ${Math.round(item.durationSec)} s` : ""}
              {item.restSec ? ` · repos ${item.restSec}s` : ""}
              {item.intensity ? ` · ${item.intensity}` : ""}
            </Text>
            {item.notes ? (
              <Text style={styles.exerciceNotes} maxFontSizeMultiplier={PLAFOND_TEXTE}>
                {item.notes}
              </Text>
            ) : null}
          </View>
        )}
      />

      <View style={styles.actions}>
        <DaPrimaryButton label="Donner mon feedback" onPress={onFeedback} arrow={false} />
        {pendingV2 ? <DaTextButton label="Voir la séance" onPress={openSession} /> : null}
      </View>

      {/* Outil d'horloge DEV — gaté __DEV__, voir GenerationActions (P1-10). */}
      {__DEV__ ? (
        <Pressable
          onPress={onAdvanceDay}
          accessibilityRole="button"
          style={styles.devButton}
        >
          <Text style={styles.devButtonText} maxFontSizeMultiplier={PLAFOND_TEXTE}>
            Jour OFF (+1j)
          </Text>
        </Pressable>
      ) : null}

      {alreadyAppliedToday ? (
        <Text style={styles.helper} maxFontSizeMultiplier={PLAFOND_TEXTE}>
          Info : tu as déjà validé une séance aujourd’hui — cette séance est probablement datée demain.
        </Text>
      ) : null}
    </DaCard>
  );
}

const styles = StyleSheet.create({
  titre: {
    ...da.typography.section,
    color: da.colors.text,
  },
  sousTitre: {
    ...da.typography.secondary,
    color: da.colors.sub,
    marginTop: da.spacing.xxs,
  },
  meta: {
    ...da.typography.secondary,
    color: da.colors.sub,
    marginTop: da.spacing.sm,
  },
  phaseMeaning: {
    ...da.typography.secondary,
    fontStyle: "italic",
    color: da.colors.sub,
    marginTop: da.spacing.xxs,
  },
  liste: {
    marginTop: da.spacing.sm,
  },
  exerciceLigne: {
    paddingVertical: da.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: da.colors.border,
  },
  exerciceNom: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
  },
  exerciceDetail: {
    ...da.typography.secondary,
    color: da.colors.sub,
    marginTop: 2,
  },
  exerciceNotes: {
    fontSize: 12,
    color: da.colors.sub,
    marginTop: 2,
  },
  actions: {
    gap: da.spacing.xs,
    marginTop: da.spacing.md,
  },
  devButton: {
    alignSelf: "center",
    minHeight: 32,
    paddingHorizontal: da.spacing.sm,
    marginTop: da.spacing.xs,
    justifyContent: "center",
  },
  devButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: da.colors.sub,
  },
  helper: {
    ...da.typography.secondary,
    color: da.colors.sub,
    marginTop: da.spacing.xs,
  },
});
