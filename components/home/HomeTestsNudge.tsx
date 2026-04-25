import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { theme, TYPE, RADIUS } from "../../constants/theme";

const palette = theme.colors;

type Props = {
  title: string;
  sub: string;
  onPress: () => void;
};

function HomeTestsNudgeInner({ title, sub, onPress }: Props) {
  if (__DEV__) console.log("[RENDER] HomeTestsNudge");
  return (
    <Card variant="soft" style={styles.testsNudgeCard}>
      <View style={styles.testsNudgeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.testsNudgeKicker}>TESTS TERRAIN</Text>
          <Text style={styles.testsNudgeTitle}>{title}</Text>
          <Text style={styles.testsNudgeSub}>{sub}</Text>
        </View>
        <View style={styles.testsNudgeIcon}>
          <Ionicons name="analytics-outline" size={18} color={palette.accent} />
        </View>
      </View>
      <View style={styles.testsNudgeActions}>
        <TouchableOpacity onPress={onPress} style={styles.testsNudgeButton} activeOpacity={0.9}>
          <Text style={styles.testsNudgeButtonText}>Faire mes tests</Text>
          <Text style={styles.testsNudgeButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  testsNudgeCard: {
    borderRadius: RADIUS.xl,
    padding: 14,
    gap: 10,
  },
  testsNudgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  testsNudgeKicker: {
    fontSize: TYPE.micro.fontSize,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.sub,
    fontWeight: "800",
  },
  testsNudgeTitle: {
    marginTop: 4,
    fontSize: TYPE.body.fontSize,
    fontWeight: "900",
    color: palette.text,
  },
  testsNudgeSub: {
    marginTop: 2,
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    lineHeight: 17,
  },
  testsNudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  testsNudgeActions: {
    flexDirection: "row",
  },
  testsNudgeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  testsNudgeButtonText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  testsNudgeButtonArrow: {
    fontSize: TYPE.caption.fontSize,
    color: palette.accent,
  },
});

export default React.memo(HomeTestsNudgeInner);
