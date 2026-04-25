// components/home/HomeProgressHero.tsx
// Card hero affichant 3 tests récents avec leur progression (delta coloré).
// Objectif : donner au joueur des chiffres CONCRETS qui bougent à chaque ouverture du Home.

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { theme, TYPE, RADIUS } from "../../constants/theme";
import { FIELD_BY_KEY } from "../../screens/tests/testConfig";
import { useTestsStorage } from "../../screens/tests/hooks/useTestsStorage";
import { computeTopProgress, formatValue, formatDelta, type ProgressItem } from "../../utils/testProgress";

const palette = theme.colors;

type Props = {
  onPress: () => void;
};

function DeltaBadge({ item }: { item: ProgressItem }) {
  // Record personnel : prime sur delta normal.
  if (item.isPersonalRecord) {
    return (
      <View style={[styles.deltaBadge, styles.prBadge]}>
        <Text style={styles.prBadgeText}>🏆 PR</Text>
      </View>
    );
  }

  if (item.delta === null || item.isImprovement === null) {
    return (
      <View style={[styles.deltaBadge, { backgroundColor: palette.cardSoft, borderColor: palette.borderSoft }]}>
        <Text style={[styles.deltaText, { color: palette.sub }]}>Nouveau</Text>
      </View>
    );
  }

  const isStable = Math.abs(item.delta) < 0.005;
  if (isStable) {
    return (
      <View style={[styles.deltaBadge, { backgroundColor: palette.cardSoft, borderColor: palette.borderSoft }]}>
        <Text style={[styles.deltaText, { color: palette.sub }]}>= stable</Text>
      </View>
    );
  }

  const def = FIELD_BY_KEY[item.fieldKey];
  const tone = item.isImprovement ? "success" : "warn";
  const color = tone === "success" ? palette.success : palette.warn;
  const bg = tone === "success" ? palette.greenSoft12 : palette.amberSoft12;

  return (
    <View style={[styles.deltaBadge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.deltaText, { color }]}>
        {formatDelta(item.delta, item.unit, def.lowerIsBetter === true)}
      </Text>
    </View>
  );
}

function ProgressRow({ item }: { item: ProgressItem }) {
  return (
    <View style={styles.row}>
      <View style={[styles.groupIcon, { backgroundColor: `${item.groupTint}22` }]}>
        <Ionicons name={item.groupIcon as any} size={16} color={item.groupTint} />
      </View>
      <View style={styles.rowLabel}>
        <Text style={styles.rowLabelText} numberOfLines={1}>
          {item.shortLabel}
        </Text>
      </View>
      <Text style={styles.rowValue}>
        {formatValue(item.currentValue, item.unit)}
        <Text style={styles.rowUnit}>{item.unit ? ` ${item.unit}` : ""}</Text>
      </Text>
      <DeltaBadge item={item} />
    </View>
  );
}

function HomeProgressHeroInner({ onPress }: Props) {
  const { entries } = useTestsStorage();
  const items = useMemo(() => computeTopProgress(entries, 3), [entries]);
  const hasData = items.length > 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <Card variant="soft" style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>TA PROGRESSION</Text>
            <Text style={styles.title}>
              {hasData ? "Tes chiffres qui bougent" : "Tes 1ers tests"}
            </Text>
          </View>
          <View style={styles.iconWrap}>
            <Ionicons name="trending-up-outline" size={18} color={palette.accent} />
          </View>
        </View>

        {hasData ? (
          <View style={styles.rows}>
            {items.map((item) => (
              <ProgressRow key={item.fieldKey} item={item} />
            ))}
          </View>
        ) : (
          <Text style={styles.emptySub}>
            Mesure ton 30m, ton CMJ, ton Yo-Yo. Tu verras tes progrès à chaque test.
          </Text>
        )}

        <View style={styles.cta}>
          <Text style={styles.ctaText}>
            {hasData ? "Voir tous mes tests" : "Faire mon 1er test"}
          </Text>
          <Text style={styles.ctaArrow}>→</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kicker: {
    fontSize: TYPE.micro.fontSize,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.sub,
    fontWeight: "800",
  },
  title: {
    marginTop: 4,
    fontSize: TYPE.body.fontSize,
    fontWeight: "900",
    color: palette.text,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 32,
  },
  groupIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
  },
  rowLabelText: {
    fontSize: TYPE.body.fontSize,
    color: palette.text,
    fontWeight: "600",
  },
  rowValue: {
    fontSize: TYPE.body.fontSize,
    color: palette.text,
    fontWeight: "800",
  },
  rowUnit: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    fontWeight: "600",
  },
  deltaBadge: {
    minWidth: 58,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  deltaText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "800",
  },
  prBadge: {
    backgroundColor: palette.goldSoft14,
    borderColor: palette.goldSoft50,
    minWidth: 62,
  },
  prBadgeText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "900",
    color: palette.amber500,
    letterSpacing: 0.5,
  },
  emptySub: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    lineHeight: 18,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  ctaText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  ctaArrow: {
    fontSize: TYPE.caption.fontSize,
    color: palette.accent,
  },
});

export default React.memo(HomeProgressHeroInner);
