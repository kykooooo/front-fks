// components/progress/TonSuiviSection.tsx
// Section "Ton suivi" (ProgressScreen, Lot 6 -- boucle de suivi joueur).
// Repond a : ou j'en suis / est-ce que je progresse / pourquoi ma prochaine
// seance est maintenue-adaptee. Toute la logique vit dans useTrackingProgress
// (hooks/useTrackingProgress.ts) -- ce composant ne fait qu'afficher, honnete
// sur les donnees manquantes (jamais de valeur inventee).
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../constants/theme";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { SectionHeader } from "../ui/SectionHeader";
import { useTrackingProgress } from "../../hooks/useTrackingProgress";
import type { ExerciseEvolution } from "../../hooks/trackingProgress/buildTrackingProgress";
import type { TrackingDecisionKind } from "../../domain/tracking/types";
import { trackEvent } from "../../services/analytics";

const palette = theme.colors;

function toneForKind(kind: TrackingDecisionKind): "default" | "ok" | "warn" | "danger" {
  switch (kind) {
    case "block_increase_pain":
      return "danger";
    case "reduce_volume_light":
    case "reduce_intensity_light":
    case "resume_mode":
      return "warn";
    case "continue_planned":
      return "ok";
    default:
      return "default";
  }
}

function formatEvolution(e: ExerciseEvolution): string {
  return e.metric === "loadKg" ? `${e.label} : ${e.from} kg → ${e.to} kg` : `${e.label} : ${e.from} → ${e.to} reps`;
}

export function TonSuiviSection() {
  const progress = useTrackingProgress();

  // Observabilité : progress_tracking_viewed, une seule fois au mount de la section.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackEvent("progress_tracking_viewed", {
      hasDecision: !!progress.lastDecisionView,
      sessionsTracked: progress.completion.sessionsTracked,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card variant="surface" style={styles.card}>
      <SectionHeader title="Ton suivi" />

      {/* Cycle / phase */}
      <View style={styles.cycleRow}>
        <View style={[styles.cycleDot, { backgroundColor: progress.cycleTheme.strong }]} />
        <Text style={styles.cycleText} numberOfLines={1}>
          {progress.hasCycle
            ? `${progress.cycleTheme.label} · ${progress.sessionLabel} · ${progress.phaseLabel}`
            : "Aucun cycle actif"}
        </Text>
      </View>

      {/*
        LE BANDEAU DE REPRISE N'EST PLUS ICI. Il a monte en haut de
        `screens/ProgressScreen.tsx`, au-dessus du resume canonique : un joueur
        qui revient apres trois semaines d'arret doit apprendre que ses chiffres
        datent AVANT de les lire, pas apres. `useTrackingProgress().resumption`
        reste la source, l'ecran la consomme.
      */}

      {/* Complétion — fenêtre 28 j de la boucle de suivi */}
      <View style={styles.row}>
        <Ionicons name="checkmark-done-outline" size={16} color={palette.accent} />
        <Text style={styles.rowText} numberOfLines={2}>
          {progress.completion.hasData
            ? `${progress.completion.sessionsTracked} séance${progress.completion.sessionsTracked > 1 ? "s" : ""} suivie${
                progress.completion.sessionsTracked > 1 ? "s" : ""
              } — complétion moyenne ${progress.completion.completionAvgPct}%`
            : "Pas encore assez de données sur tes dernières séances."}
        </Text>
      </View>
      {/*
        « SÉANCES SUIVIES », ET PAS « TERMINÉES ». Le resume canonique affiche
        juste au-dessus « Séances terminées depuis tes débuts » — un cumul, sans
        borne. Ce compte-ci est autre chose : les séances de la fenêtre de suivi
        (5 séances / 28 j, `domain/tracking/config.ts`) pour lesquelles une
        exécution a été enregistrée. Deux mesures, deux périmètres, et c'est le
        LIBELLÉ qui porte la différence.

        LA LIGNE « X/Y séances cette semaine » A ÉTÉ RETIRÉE. Elle était le
        troisième compteur hebdomadaire de l'app, avec sa propre semaine (lundi
        fixe) et sa propre cible (`targetFksSessionsPerWeek`), à côté de celui du
        Home (semaine du joueur, cible `weeklyGoal`). Le compteur hebdomadaire
        vit désormais au Home, seul.
      */}

      {/* RPE ressenti vs prévu */}
      <View style={styles.row}>
        <Ionicons name="speedometer-outline" size={16} color={palette.warn} />
        <Text style={styles.rowText} numberOfLines={2}>
          {progress.rpe.hasSignal && progress.rpe.deltaAvg != null
            ? `Effort ressenti vs prévu : ${progress.rpe.deltaAvg > 0 ? "+" : ""}${progress.rpe.deltaAvg} en moyenne`
            : "Pas encore assez de données sur ton effort ressenti."}
        </Text>
      </View>

      {/* Évolution charges / reps */}
      {progress.exerciseEvolutions.length > 0 ? (
        <View style={styles.miniBlock}>
          <Text style={styles.miniHeader}>Évolution charges / reps</Text>
          {progress.exerciseEvolutions.map((e) => (
            <Text key={e.exerciseId} style={styles.evoLine} numberOfLines={1}>
              {formatEvolution(e)}
            </Text>
          ))}
        </View>
      ) : null}

      {/* Qualités travaillées */}
      {progress.focusBadges.length > 0 ? (
        <View style={styles.miniBlock}>
          <Text style={styles.miniHeader}>Qualités travaillées (28 j)</Text>
          <View style={styles.badgeRow}>
            {progress.focusBadges.map((b) => (
              <Badge key={b.focus} label={`${b.label} × ${b.count}`} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Dernière décision */}
      {progress.lastDecisionView ? (
        <View style={styles.decisionBlock}>
          <View style={styles.decisionHeader}>
            <Badge label={progress.lastDecisionView.kindLabel} tone={toneForKind(progress.lastDecisionView.kind)} />
            <Text style={styles.decisionDate}>{progress.lastDecisionView.dateLabel}</Text>
          </View>
          <Text style={styles.decisionText} numberOfLines={4}>
            {progress.lastDecisionView.explanation}
          </Text>
        </View>
      ) : null}

      {/* Prochaine étape */}
      <Text style={styles.nextStepText} numberOfLines={2}>
        {progress.nextStepLabel}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 24,
    gap: 12,
  },
  cycleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cycleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cycleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: palette.text,
    minHeight: 18,
  },
  miniBlock: {
    gap: 4,
  },
  miniHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  evoLine: {
    fontSize: 13,
    color: palette.text,
    fontWeight: "600",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  decisionBlock: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    gap: 6,
  },
  decisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  decisionDate: {
    fontSize: 11,
    color: palette.sub,
    fontWeight: "600",
  },
  decisionText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.text,
    minHeight: 18,
  },
  nextStepText: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
    minHeight: 16,
  },
});
