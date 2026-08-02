import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Reflète le réglage système « Réduire les animations » (iOS) / « Supprimer les
 * animations » (Android), et reste à jour si l'utilisateur le change en cours de session.
 * Pattern repris de useHaptics (même garde anti-setState-après-unmount).
 */
export function useReduceMotion(): boolean {
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

  return reduceMotionEnabled;
}
