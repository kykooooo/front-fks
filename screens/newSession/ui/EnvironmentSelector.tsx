import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "../theme";
import type { EnvironmentSelection } from "../types";
import { MICROCYCLES, isMicrocycleId, type MicrocycleId } from "../../../domain/microcycles";
import { theme, TYPE, RADIUS } from "../../../constants/theme";


type Props = {
  environment: EnvironmentSelection;
  setEnvironment: React.Dispatch<React.SetStateAction<EnvironmentSelection>>;
  allowed?: Array<"gym" | "pitch" | "home">;
  currentCycleId?: MicrocycleId | string | null;
};

type LocationConfig = {
  id: "gym" | "pitch" | "home";
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  defaultDescription: string;
  features: string[];
};

const LOCATIONS: LocationConfig[] = [
  {
    id: "gym",
    label: "Salle",
    icon: "barbell",
    color: theme.colors.violet500,
    bgColor: theme.colors.violetSoft12,
    defaultDescription: "Machines, charges lourdes, haltères",
    features: ["Force max", "Machines guidées", "Charges progressives"],
  },
  {
    id: "pitch",
    label: "Terrain",
    icon: "football",
    color: theme.colors.green500,
    bgColor: theme.colors.green500Soft12,
    defaultDescription: "Gazon, synthé, stabilisé",
    features: ["Sprints", "Appuis", "Travail spécifique"],
  },
  {
    id: "home",
    label: "Maison",
    icon: "home",
    color: theme.colors.amber500,
    bgColor: theme.colors.amberSoft12,
    defaultDescription: "Salon, jardin, peu de matériel",
    features: ["Poids de corps", "Core", "Mobilité"],
  },
];

export function EnvironmentSelector({
  environment,
  setEnvironment,
  allowed,
  currentCycleId,
}: Props) {
  const allowedSet = new Set(allowed ?? ["gym", "pitch", "home"]);

  // Get cycle-specific descriptions if available
  const cycle = currentCycleId && isMicrocycleId(currentCycleId)
    ? MICROCYCLES[currentCycleId]
    : null;

  const toggle = (key: "gym" | "pitch" | "home") => {
    if (!allowedSet.has(key)) return;
    setEnvironment((prev) => {
      const has = prev.includes(key);
      const next = has
        ? prev.filter((e) => e !== key)
        : ([...prev, key].slice(0, 2) as EnvironmentSelection);
      return next;
    });
  };

  const filteredLocations = LOCATIONS.filter((loc) => allowedSet.has(loc.id));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="location" size={18} color={palette.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Où t'entraînes-tu ?</Text>
          <Text style={styles.subtitle}>
            Choisis ton lieu pour adapter la séance
          </Text>
        </View>
      </View>

      <View style={styles.locationsGrid}>
        {filteredLocations.map((location) => {
          const selected = environment.includes(location.id);
          const cycleDescription = cycle?.locationDescriptions?.[location.id];

          return (
            <TouchableOpacity
              key={location.id}
              onPress={() => toggle(location.id)}
              activeOpacity={0.85}
              style={[
                styles.locationCard,
                selected && styles.locationCardSelected,
                selected && { borderColor: location.color },
              ]}
            >
              {/* Header with icon and label */}
              <View style={styles.locationHeader}>
                <View
                  style={[
                    styles.locationIconWrap,
                    { backgroundColor: selected ? location.bgColor : palette.cardSoft },
                  ]}
                >
                  <Ionicons
                    name={location.icon as any}
                    size={22}
                    color={selected ? location.color : palette.sub}
                  />
                </View>
                <View style={styles.locationLabelWrap}>
                  <Text
                    style={[
                      styles.locationLabel,
                      selected && { color: location.color },
                    ]}
                  >
                    {location.label}
                  </Text>
                  {selected && (
                    <View style={[styles.selectedBadge, { backgroundColor: location.bgColor }]}>
                      <Ionicons name="checkmark" size={10} color={location.color} />
                    </View>
                  )}
                </View>
              </View>

              {/* Cycle-specific focus (if available) */}
              {cycleDescription && (
                <View style={[styles.focusBadge, { backgroundColor: location.bgColor }]}>
                  <Ionicons name="flash" size={12} color={location.color} />
                  <Text style={[styles.focusText, { color: location.color }]}>
                    {cycleDescription}
                  </Text>
                </View>
              )}

              {/* Features */}
              <View style={styles.featuresWrap}>
                {location.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <View
                      style={[
                        styles.featureDot,
                        { backgroundColor: selected ? location.color : palette.borderSoft },
                      ]}
                    />
                    <Text
                      style={[
                        styles.featureText,
                        selected && { color: palette.text },
                      ]}
                    >
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {environment.length > 0 && (
        <View style={styles.selectionSummary}>
          <Ionicons name="checkmark-circle" size={16} color={palette.accent} />
          <Text style={styles.selectionText}>
            {environment.length === 1
              ? `Séance ${environment[0] === "gym" ? "salle" : environment[0] === "pitch" ? "terrain" : "maison"}`
              : `Séance mixte (${environment.map(e => e === "gym" ? "salle" : e === "pitch" ? "terrain" : "maison").join(" + ")})`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.blueSoft12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: TYPE.subtitle.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    marginTop: 2,
  },
  locationsGrid: {
    gap: 12,
  },
  locationCard: {
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    gap: 12,
  },
  locationCardSelected: {
    backgroundColor: palette.cardSoft,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  locationLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationLabel: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  selectedBadge: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  focusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  focusText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
  featuresWrap: {
    gap: 6,
    paddingLeft: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: RADIUS.xs,
  },
  featureText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
  },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
    backgroundColor: theme.colors.blueSoft08,
  },
  selectionText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    color: palette.accent,
  },
});
