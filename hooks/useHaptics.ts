import { useCallback, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useSettingsStore } from "../state/settingsStore";
import { useReduceMotion } from "./useReduceMotion";

export function useHaptics() {
  const enabled = useSettingsStore((s) => s.hapticsEnabled);
  const reduceMotionEnabled = useReduceMotion();

  const canHaptics = useMemo(
    () => enabled && Platform.OS !== "web" && !reduceMotionEnabled,
    [enabled, reduceMotionEnabled]
  );

  const impact = useCallback(
    async (style: Haptics.ImpactFeedbackStyle) => {
      if (!canHaptics) return;
      Haptics.impactAsync(style);
    },
    [canHaptics]
  );

  const notify = useCallback(
    async (type: Haptics.NotificationFeedbackType) => {
      if (!canHaptics) return;
      Haptics.notificationAsync(type);
    },
    [canHaptics]
  );

  return {
    impactLight: () => impact(Haptics.ImpactFeedbackStyle.Light),
    impactMedium: () => impact(Haptics.ImpactFeedbackStyle.Medium),
    impactHeavy: () => impact(Haptics.ImpactFeedbackStyle.Heavy),
    success: () => notify(Haptics.NotificationFeedbackType.Success),
    warning: () => notify(Haptics.NotificationFeedbackType.Warning),
    error: () => notify(Haptics.NotificationFeedbackType.Error),
  };
}
