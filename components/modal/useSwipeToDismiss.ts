import { useCallback, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Params = {
  enabled?: boolean;
  threshold?: number;
  onDismiss?: () => void;
};

export function useSwipeToDismiss({
  enabled = true,
  threshold = 150,
  onDismiss,
}: Params) {
  const translateY = useSharedValue(0);
  const { height: screenHeight } = useWindowDimensions();

  const gesture = useMemo(() => {
    if (!enabled) return Gesture.Pan().enabled(false);
    return Gesture.Pan()
      // Le geste ne s'arme qu'après un vrai mouvement vertical, et échoue si le
      // doigt part à l'horizontale → plus de "j'appuie et l'écran bouge".
      .activeOffsetY(15)
      .failOffsetX([-20, 20])
      .onUpdate((event) => {
        const next = event.translationY;
        translateY.value = Math.max(0, next);
      })
      .onEnd((event) => {
        const shouldClose = event.translationY > threshold || event.velocityY > 1200;
        if (shouldClose) {
          translateY.value = withTiming(screenHeight, { duration: 180 }, () => {
            if (onDismiss) runOnJS(onDismiss)();
          });
        } else {
          translateY.value = withTiming(0, { duration: 180 });
        }
      });
  }, [enabled, onDismiss, threshold, translateY, screenHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Ramène la feuille à sa place après un dismiss ANNULÉ. Nécessaire pour les
  // écrans dont le onDismiss ouvre une confirmation : le geste a déjà envoyé la
  // feuille hors écran (withTiming(screenHeight) ci-dessus) — si l'utilisateur
  // choisit de rester, personne d'autre ne réécrit translateY.
  const reset = useCallback(() => {
    translateY.value = withTiming(0, { duration: 180 });
  }, [translateY]);

  return { gesture, animatedStyle, reset };
}
