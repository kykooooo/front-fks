// screens/tests/components/OptionalTestsSection.tsx
// "Aller plus loin" — tous les tests hors socle, repliés par défaut (pour les
// motivés). Chaque ligne se saisit individuellement : un tap ouvre une saisie
// à un seul champ (réutilise EntryFormCard, cf. TestsScreen). Le module salle
// (goblet/split) et le trap bar 3RM (Senior + salle) restent gated, mais à
// l'intérieur de cette section (plus de playlist "force"/"explosivité" dédiée).
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { formatEntryTimestamp, formatEntryValue, getUnitForField, shouldHideUnitSuffix, type FieldSample } from "../testHelpers";
import { FIELD_BY_KEY, GROUP_TITLES, getGroupConfig, type FieldConfig, type FieldKey } from "../testConfig";

const palette = theme.colors;

type Props = {
  optionalKeys: FieldKey[];
  fieldSamples: Partial<Record<FieldKey, FieldSample[]>>;
  open: boolean;
  onToggle: () => void;
  onSelectField: (key: FieldKey) => void;
  onHaptic: () => void;
  cardAnim: Animated.Value;
};

export function OptionalTestsSection({
  optionalKeys, fieldSamples, open, onToggle, onSelectField, onHaptic, cardAnim,
}: Props) {
  if (optionalKeys.length === 0) return null;

  const groups: { title: string; fields: FieldConfig[] }[] = [];
  const byGroup: Partial<Record<FieldConfig["group"], FieldConfig[]>> = {};
  for (const key of optionalKeys) {
    const field = FIELD_BY_KEY[key];
    if (!field) continue;
    if (!byGroup[field.group]) byGroup[field.group] = [];
    (byGroup[field.group] as FieldConfig[]).push(field);
  }
  (Object.keys(byGroup) as FieldConfig["group"][]).forEach((groupId) => {
    groups.push({ title: GROUP_TITLES[groupId], fields: byGroup[groupId] as FieldConfig[] });
  });

  return (
    <Animated.View
      style={{
        opacity: cardAnim,
        transform: [
          {
            translateY: cardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
        ],
      }}
    >
      <View style={styles.section}>
        <SectionHeader title="Aller plus loin" right={<Badge label={`${optionalKeys.length} tests`} />} />
        <Card variant="surface" style={styles.card}>
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => { onToggle(); onHaptic(); }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={open ? "Replier la section aller plus loin" : "Déplier la section aller plus loin"}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Tests complémentaires</Text>
              <Text style={styles.toggleSub}>
                Pour les motivés : sprint 20/30 m, sauts, agilité, 1 km, et plus si tu as des charges.
              </Text>
            </View>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={palette.sub} />
          </TouchableOpacity>

          {open ? (
            <View style={styles.body}>
              {groups.map((group) => (
                <View key={group.title} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.fields.map((field, idx) => {
                    const samples = fieldSamples[field.key];
                    const cfg = getGroupConfig(field.group);
                    const hideUnit = shouldHideUnitSuffix(field.key);
                    const unit = hideUnit ? "" : getUnitForField(field.key);
                    const statusLabel = samples?.length
                      ? `${formatEntryValue(field.key, samples[0].value)}${unit ? ` ${unit}` : ""} · ${formatEntryTimestamp(samples[0].ts, "dd/MM")}`
                      : "Pas encore testé";
                    return (
                      <TouchableOpacity
                        key={field.key}
                        style={[styles.itemRow, idx === 0 && styles.itemRowFirst]}
                        onPress={() => { onSelectField(field.key); onHaptic(); }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Saisir ${field.label}`}
                      >
                        <View style={[styles.itemIcon, { backgroundColor: cfg.tintSoft }]}>
                          <Ionicons name={cfg.icon} size={13} color={cfg.tint} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{field.label}</Text>
                          <Text style={styles.itemStatus}>{statusLabel}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={palette.sub} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  card: {
    borderRadius: theme.radius.lg,
    padding: 14,
    gap: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  toggleSub: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  body: {
    gap: 14,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    color: palette.sub,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },
  itemRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: { color: palette.text, fontSize: 13, fontWeight: "600" },
  itemStatus: { color: palette.sub, fontSize: 11, marginTop: 2 },
});
