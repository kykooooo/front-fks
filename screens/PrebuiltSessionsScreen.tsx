// screens/PrebuiltSessionsScreen.tsx — orchestrator (refactored from 1838 → ~200 lines)
import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRoutineBadges } from "../hooks/useRoutineBadges";
import { Ionicons } from "@expo/vector-icons";
import { useHaptics } from "../hooks/useHaptics";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { Card } from "../components/ui/Card";

import {
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
  intensityRank,
  type Prebuilt,
  type RoutineCategory,
} from "./prebuilt/prebuiltConfig";
import { PREBUILT_SESSIONS } from "./prebuilt/prebuiltSessions";
import { AnimatedCategoryCard } from "./prebuilt/components/AnimatedCategoryCard";
import { CategorySection } from "./prebuilt/components/CategorySection";
import { BadgesCard } from "./prebuilt/components/BadgesCard";
import { isSessionCompleted } from "../utils/sessionStatus";

const palette = theme.colors;

export default function PrebuiltSessionsScreen() {
  const sessions = useSessionsStore((s) => s.sessions);
  const pending = sessions.filter((s) => !isSessionCompleted(s));
  const nav = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [animationKey, setAnimationKey] = useState(0);
  const badges = useRoutineBadges();
  const haptics = useHaptics();

  useFocusEffect(
    useCallback(() => {
      setAnimationKey((k) => k + 1);
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
          const durA = a.durationMin ?? 0;
          const durB = b.durationMin ?? 0;
          if (durA !== durB) return durA - durB;
          return a.title.localeCompare(b.title);
        });
        return [category, sorted] as const;
      })
      .sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a[0] as RoutineCategory);
        const idxB = CATEGORY_ORDER.indexOf(b[0] as RoutineCategory);
        if (idxA === -1 && idxB === -1) return a[0].localeCompare(b[0]);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
  }, []);

  const categories = useMemo(() => {
    const fromSessions = grouped.map(([category, list]) => ({
      category,
      count: list.length,
      config: CATEGORY_CONFIG[category as RoutineCategory] ?? {
        icon: "sparkles" as keyof typeof Ionicons.glyphMap,
        gradient: [theme.colors.gray500, theme.colors.gray400] as [string, string],
        tagline: "",
      },
    }));
    return [
      {
        category: "Tous",
        count: PREBUILT_SESSIONS.length,
        config: {
          icon: "apps" as keyof typeof Ionicons.glyphMap,
          gradient: [theme.colors.accent, theme.colors.accentAlt] as [string, string],
          tagline: "Toutes les routines",
        },
      },
      ...fromSessions,
    ];
  }, [grouped]);

  const handleRoutinePress = useCallback((routine: Prebuilt) => {
    haptics.impactLight();
    nav.navigate("PrebuiltSessionDetail", { session: routine });
  }, [haptics, nav]);

  const filteredGroups = useMemo(
    () =>
      grouped.filter(([category]) =>
        selectedCategory === "Tous" ? true : selectedCategory === category
      ),
    [grouped, selectedCategory]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "right", "left", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
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
                <Ionicons name="bulb" size={20} color={theme.colors.amber500} />
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
            <Ionicons name="layers" size={14} color={theme.colors.teal500} />
            <Text style={styles.statText}>
              <Text style={styles.statHighlight}>{grouped.length}</Text> catégories
            </Text>
          </View>
        </View>

        {/* Category filter */}
        <View style={styles.filtersSection}>
          <Text style={styles.filtersSectionTitle}>Catégories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
            key={animationKey}
          >
            {categories.map((item, index) => (
              <AnimatedCategoryCard
                key={item.category}
                category={item.category}
                count={item.count}
                config={item.config}
                index={index}
                isActive={selectedCategory === item.category}
                onPress={() => setSelectedCategory(item.category)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Routines by category */}
        <View style={styles.routinesContainer} key={`${animationKey}-${selectedCategory}`}>
          {filteredGroups.map(([category, list], idx) => (
            <CategorySection
              key={category}
              category={category}
              routines={list}
              baseIndex={idx}
              onRoutinePress={handleRoutinePress}
            />
          ))}
        </View>

        {/* Tip */}
        <View style={styles.tipContainer}>
          <Ionicons name="information-circle-outline" size={14} color={palette.sub} />
          <Text style={styles.tipText}>
            Ces routines sont des compléments à ton entraînement principal. Utilise-les pour t'échauffer, récupérer ou prévenir les blessures.
          </Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
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
    fontSize: TYPE.hero.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  headerSubtitle: {
    fontSize: TYPE.body.fontSize,
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
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statText: {
    fontSize: TYPE.caption.fontSize,
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
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.amberSoft15,
    justifyContent: "center",
    alignItems: "center",
  },
  introTextContainer: {
    flex: 1,
  },
  introTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  introDescription: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    marginTop: 4,
    lineHeight: 18,
  },
  filtersSection: {
    gap: 8,
  },
  filtersSectionTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filtersRow: {
    gap: 8,
    paddingVertical: 4,
  },
  routinesContainer: {
    gap: 20,
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: palette.cardSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tipText: {
    flex: 1,
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    lineHeight: 16,
  },
});
