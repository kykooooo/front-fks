// screens/prebuilt/components/BadgesCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, TYPE, RADIUS } from "../../../constants/theme";

const palette = theme.colors;

type BadgesData = {
  total: number;
  thisMonth: number;
  streak: number;
  favoriteCategory?: string | null;
};

type Props = {
  badges: BadgesData;
};

export function BadgesCard({ badges }: Props) {
  return (
    <View style={styles.badgesCard}>
      <View style={styles.badgesHeader}>
        <View style={styles.badgesIconCircle}>
          <Ionicons name="medal" size={18} color={theme.colors.amber500} />
        </View>
        <Text style={styles.badgesTitle}>Tes stats routines</Text>
      </View>
      <View style={styles.badgesGrid}>
        <View style={styles.badgeItem}>
          <LinearGradient
            colors={[theme.colors.emerald500, theme.colors.emerald400]}
            style={styles.badgeIconBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="calendar" size={16} color={theme.colors.white} />
          </LinearGradient>
          <Text style={styles.badgeValue}>{badges.thisMonth}</Text>
          <Text style={styles.badgeLabel}>ce mois</Text>
        </View>
        <View style={styles.badgeItem}>
          <LinearGradient
            colors={[theme.colors.amber500, theme.colors.amber400]}
            style={styles.badgeIconBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="flame" size={16} color={theme.colors.white} />
          </LinearGradient>
          <Text style={styles.badgeValue}>{badges.streak}</Text>
          <Text style={styles.badgeLabel}>jours streak</Text>
        </View>
        <View style={styles.badgeItem}>
          <LinearGradient
            colors={[theme.colors.violet500, theme.colors.violet400]}
            style={styles.badgeIconBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="trophy" size={16} color={theme.colors.white} />
          </LinearGradient>
          <Text style={styles.badgeValue}>{badges.total}</Text>
          <Text style={styles.badgeLabel}>total</Text>
        </View>
      </View>
      {badges.favoriteCategory && (
        <View style={styles.favCategoryRow}>
          <Ionicons name="heart" size={12} color={theme.colors.red500} />
          <Text style={styles.favCategoryText}>
            Ta catégorie préférée : <Text style={styles.favCategoryName}>{badges.favoriteCategory}</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badgesCard: {
    padding: 16,
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 14,
  },
  badgesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badgesIconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: theme.colors.amberSoft15,
    justifyContent: "center",
    alignItems: "center",
  },
  badgesTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  badgesGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  badgeItem: {
    alignItems: "center",
    gap: 6,
  },
  badgeIconBg: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeValue: {
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  badgeLabel: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
    fontWeight: "500",
  },
  favCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },
  favCategoryText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
  },
  favCategoryName: {
    color: palette.text,
    fontWeight: "600",
  },
});
