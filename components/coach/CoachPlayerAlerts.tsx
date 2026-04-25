// components/coach/CoachPlayerAlerts.tsx
// Alertes joueurs - surcharge, inactivité, blessures

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../constants/theme";

const palette = theme.colors;

export type AlertType = "overload" | "inactive" | "injury";

export type PlayerAlert = {
  uid: string;
  firstName: string;
  type: AlertType;
  message: string;
  value?: number | string;
};

type Props = {
  alerts: PlayerAlert[];
  onPlayerPress?: (uid: string) => void;
  onDismiss?: (uid: string, type: AlertType) => void;
};

const ALERT_CONFIG: Record<AlertType, { icon: string; color: string; bg: string; label: string }> = {
  overload: {
    icon: "warning",
    color: theme.colors.red500,
    bg: theme.colors.redSoft10,
    label: "Surcharge",
  },
  inactive: {
    icon: "moon",
    color: theme.colors.amber500,
    bg: theme.colors.amberSoft10,
    label: "Inactif",
  },
  injury: {
    icon: "medkit",
    color: theme.colors.red600,
    bg: theme.colors.red600Soft10,
    label: "Blessure",
  },
};

export function CoachPlayerAlerts({ alerts, onPlayerPress, onDismiss }: Props) {
  if (alerts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.green500} />
        </View>
        <Text style={styles.emptyTitle}>Aucune alerte</Text>
        <Text style={styles.emptyText}>
          Tous tes joueurs sont en forme et actifs
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications" size={16} color={palette.accent} />
        <Text style={styles.headerTitle}>Alertes ({alerts.length})</Text>
      </View>
      {alerts.map((alert, index) => {
        const config = ALERT_CONFIG[alert.type];
        return (
          <Pressable
            key={`${alert.uid}-${alert.type}-${index}`}
            onPress={() => onPlayerPress?.(alert.uid)}
            style={({ pressed }) => [
              styles.alertRow,
              { backgroundColor: config.bg },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.alertIcon}>
              <Ionicons name={config.icon as any} size={18} color={config.color} />
            </View>
            <View style={styles.alertContent}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertName}>{alert.firstName}</Text>
                <View style={[styles.alertBadge, { backgroundColor: config.color }]}>
                  <Text style={styles.alertBadgeText}>{config.label}</Text>
                </View>
              </View>
              <Text style={styles.alertMessage}>{alert.message}</Text>
            </View>
            {onDismiss && (
              <Pressable
                onPress={() => onDismiss(alert.uid, alert.type)}
                style={styles.dismissButton}
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color={palette.sub} />
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
    gap: 6,
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xl,
    backgroundColor: theme.colors.green500Soft12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  emptyText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: palette.cardSoft,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  headerTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: theme.colors.white50,
    alignItems: "center",
    justifyContent: "center",
  },
  alertContent: {
    flex: 1,
    gap: 4,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertName: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  alertBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  alertBadgeText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "700",
    color: theme.colors.white,
    textTransform: "uppercase",
  },
  alertMessage: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    lineHeight: 16,
  },
  dismissButton: {
    padding: 4,
  },
});
