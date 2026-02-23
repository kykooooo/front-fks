import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import HomeCarouselCard from "../../components/home/HomeCarouselCard";
import HomeTestsNudge from "../../components/home/HomeTestsNudge";
import { theme } from "../../constants/theme";
import type { CarouselItem } from "../../components/home/HomeCarousel";

type Nav = {
  navigate: (screen: string, params?: any) => void;
};

type Params = {
  nav: Nav;
  weekSummary: { fksCount: number; extCount: number; message: string };
  weeklyGoal: number;
  activityStreak: number;
};

const palette = theme.colors;

export function useHomeCarouselItems({
  nav,
  weekSummary,
  weeklyGoal,
  activityStreak,
}: Params): CarouselItem[] {
  return useMemo<CarouselItem[]>(() => {
    const items: CarouselItem[] = [];

    items.push({
      id: "week",
      node: (
        <HomeCarouselCard title="Cette semaine" subtitle={weekSummary.message}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>FKS</Text>
              <Text style={styles.statValue}>{weekSummary.fksCount}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Club/Match</Text>
              <Text style={styles.statValue}>{weekSummary.extCount}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Objectif</Text>
              <Text style={styles.statValue}>{weeklyGoal}</Text>
            </View>
          </View>
        </HomeCarouselCard>
      ),
    });

    items.push({
      id: "tests",
      node: (
        <HomeTestsNudge
          title="Calibre tes progrès"
          sub="Des tests courts pour mieux personnaliser ton cycle."
          onPress={() => nav.navigate("Tests")}
        />
      ),
    });

    items.push({
      id: "progress",
      node: (
        <HomeCarouselCard title="Progression" subtitle="Charge & régularité">
          <View style={styles.progressRow}>
            <Ionicons name="flame" size={18} color={palette.accent} />
            <Text style={styles.progressText}>
              {activityStreak} jours d’affilée
            </Text>
          </View>
          <TouchableOpacity onPress={() => nav.navigate("Progression")} style={styles.link}>
            <Text style={styles.linkText}>Voir ma progression</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>
        </HomeCarouselCard>
      ),
    });

    return items;
  }, [activityStreak, nav, weekSummary, weeklyGoal]);
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  statLabel: {
    fontSize: 10,
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "800",
    color: palette.text,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressText: {
    fontSize: 13,
    color: palette.text,
    fontWeight: "700",
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.accent,
  },
  linkArrow: {
    fontSize: 14,
    color: palette.accent,
  },
});
