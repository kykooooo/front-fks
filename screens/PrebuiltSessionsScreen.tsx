// screens/PrebuiltSessionsScreen.tsx — orchestrator (refactored from 1838 → ~200 lines)
import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Screen } from "../components/ui/Screen";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRoutineBadges } from "../hooks/useRoutineBadges";
import { Ionicons } from "@expo/vector-icons";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";

import {
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
  intensityRank,
  parseDurationMin,
  type Prebuilt,
} from "./prebuilt/prebuiltConfig";
import { PREBUILT_SESSIONS } from "./prebuilt/prebuiltSessions";
import { CategoryTile } from "./prebuilt/components/CategoryTile";
import { CategorySection } from "./prebuilt/components/CategorySection";
import { BadgesCard } from "./prebuilt/components/BadgesCard";

const palette = theme.colors;

export default function PrebuiltSessionsScreen() {
  const nav = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const badges = useRoutineBadges();
  const haptics = useHaptics();

  useFocusEffect(
    useCallback(() => {
      setAnimationKey((k) => k + 1);
      return () => setSelectedCategory(null);
    }, [])
  );

  const grouped = useMemo(() => {
    const map: Record<string, Prebuilt[]> = {};
    for (const s of PREBUILT_SESSIONS) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return Object.entries(map)
      .map(([category, list]) => {
        const sorted = [...list].sort((a, b) => {
          const rankDiff = intensityRank[a.intensity] - intensityRank[b.intensity];
          if (rankDiff !== 0) return rankDiff;
          const durA = parseDurationMin(a.duration) ?? 0;
          const durB = parseDurationMin(b.duration) ?? 0;
          if (durA !== durB) return durA - durB;
          return a.title.localeCompare(b.title);
        });
        return [category, sorted] as const;
      })
      .sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a[0]);
        const idxB = CATEGORY_ORDER.indexOf(b[0]);
        if (idxA === -1 && idxB === -1) return a[0].localeCompare(b[0]);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
  }, []);

  const categories = useMemo(
    () =>
      grouped.map(([category, list]) => ({
        category,
        count: list.length,
        config: CATEGORY_CONFIG[category] ?? {
          icon: "sparkles" as keyof typeof Ionicons.glyphMap,
          gradient: ["#6b7280", "#9ca3af"] as [string, string],
          tagline: "",
        },
      })),
    [grouped]
  );

  const handleRoutinePress = useCallback((routine: Prebuilt) => {
    haptics.impactLight();
    nav.navigate("PrebuiltSessionDetail", { session: routine });
  }, [haptics, nav]);

  const handleCategoryPress = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleBack = useCallback(() => {
    haptics.impactLight();
    setSelectedCategory(null);
  }, [haptics]);

  const selectedGroup = useMemo(
    () => grouped.find(([category]) => category === selectedCategory) ?? null,
    [grouped, selectedCategory]
  );

  return (
    <Screen style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {selectedGroup === null ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Routines & extras</Text>
              <Text style={styles.headerSubtitle}>
                Compléments express à ton cycle
              </Text>
            </View>

            {/* Badges or Intro */}
            {badges.total > 0 ? (
              <BadgesCard badges={badges} />
            ) : (
              <Card variant="soft" style={styles.introCard}>
                <View style={styles.introHeader}>
                  <View style={styles.introIconCircle}>
                    <Ionicons name="bulb" size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.introTextContainer}>
                    <Text style={styles.introTitle}>Compléments intelligents</Text>
                    <Text style={styles.introDescription}>
                      Ces routines s'ajoutent à ton cycle pour optimiser ta prépa : échauffement, récup, prévention des blessures...
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Quick stats */}
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Ionicons name="sparkles" size={14} color={palette.accent} />
                <Text style={styles.statText}>
                  <Text style={styles.statHighlight}>{PREBUILT_SESSIONS.length}</Text> routines
                </Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="layers" size={14} color="#14b8a6" />
                <Text style={styles.statText}>
                  <Text style={styles.statHighlight}>{grouped.length}</Text> catégories
                </Text>
              </View>
            </View>

            {/* Category grid */}
            <View style={styles.categoryGrid} key={animationKey}>
              {categories.map((item, index) => (
                <CategoryTile
                  key={item.category}
                  category={item.category}
                  count={item.count}
                  config={item.config}
                  index={index}
                  onPress={() => handleCategoryPress(item.category)}
                />
              ))}
            </View>

            {/* Tip */}
            <View style={styles.tipContainer}>
              <Ionicons name="information-circle-outline" size={14} color={palette.sub} />
              <Text style={styles.tipText}>
                Ces routines sont des compléments à ton entraînement principal. Choisis une catégorie pour voir les routines disponibles.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Back */}
            <TouchableOpacity style={styles.backRow} onPress={handleBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={palette.sub} />
              <Text style={styles.backText}>Toutes les catégories</Text>
            </TouchableOpacity>

            <CategorySection
              category={selectedGroup[0]}
              routines={selectedGroup[1]}
              baseIndex={0}
              onRoutinePress={handleRoutinePress}
            />
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    padding: 16,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: palette.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: palette.sub,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: palette.cardSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statText: {
    fontSize: 13,
    color: palette.sub,
  },
  statHighlight: {
    color: palette.text,
    fontWeight: "700",
  },
  introCard: {
    padding: 14,
    gap: 12,
  },
  introHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  introIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  introTextContainer: {
    flex: 1,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  introDescription: {
    fontSize: 13,
    color: palette.sub,
    marginTop: 4,
    lineHeight: 18,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.sub,
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: palette.cardSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: palette.sub,
    lineHeight: 16,
  },
});
