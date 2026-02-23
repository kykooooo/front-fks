import { useCallback, useEffect, useMemo, useState } from "react";
import * as Haptics from "expo-haptics";
import { AccessibilityInfo, Platform } from "react-native";
import { useSettingsStore } from "../state/settingsStore";

export function useHaptics() {
  const enabled = useSettingsStore((s) => s.hapticsEnabled);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotionEnabled(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduceMotionEnabled(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

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
