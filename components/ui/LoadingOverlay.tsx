// components/ui/LoadingOverlay.tsx
// Overlay de chargement premium avec étapes animées

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Modal, Easing, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  submessage?: string;
  /** Étapes qui défilent automatiquement (cycle toutes les ~4s) */
  steps?: string[];
  /** Si fourni, remplace temporairement steps/message (ex: réveil serveur en cours) */
  overrideMessage?: string;
  /** Durée estimée en ms pour la barre de progression (défaut: 25000) */
  estimatedDurationMs?: number;
  /** Si fourni, affiche un bouton texte discret pour annuler l'opération */
  onCancel?: () => void;
  /** Libellé du bouton d'annulation (défaut: "Annuler") */
  cancelLabel?: string;
  /**
   * DA Polish : ce composant est partagé avec NewSessionScreen/FeedbackScreen/
   * CoachOnboardingScreen (dark, hors périmètre) — défaut "dark" = zéro diff
   * ailleurs. ProfileSetupScreen (seul écran clair du parcours) passe "light"
   * explicitement pour ne plus être une île noire dans une app blanche.
   */
  variant?: "dark" | "light";
}

// ─── Bouncing Dots ───
function BouncingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    // Réduire les animations (OS) : dots statiques, pas de rebond en boucle.
    if (reduceMotion) {
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
      return;
    }
    const bounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -8, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const loops = [bounce(dot1, 0), bounce(dot2, 150), bounce(dot3, 300)];
    loops.forEach((loop) => loop.start());
    return () => {
      loops.forEach((loop) => loop.stop());
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
    };
  }, [dot1, dot2, dot3, reduceMotion]);

  return (
    <View style={dotStyles.row}>
      {[dot1, dot2, dot3].map((anim, i) => (
        <Animated.View key={i} style={[dotStyles.dot, { transform: [{ translateY: anim }] }]} />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
});

// ─── Rotating Glow Ring ───
function GlowRing() {
  const rotation = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    // Réduire les animations (OS) : anneau fixe, pas de rotation en boucle.
    if (reduceMotion) {
      rotation.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      rotation.setValue(0);
    };
  }, [rotation, reduceMotion]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[ringStyles.ring, { transform: [{ rotate: spin }] }]}>
      <View style={ringStyles.arc} />
    </Animated.View>
  );
}

const ringStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: theme.colors.accentSoft,
  },
  arc: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: theme.colors.accent,
  },
});

// ─── Main Component ───
export function LoadingOverlay({
  visible,
  message,
  submessage,
  steps,
  overrideMessage,
  estimatedDurationMs = 25000,
  onCancel,
  cancelLabel = 'Annuler',
  variant = 'dark',
}: LoadingOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  const [currentStep, setCurrentStep] = useState(0);
  // Reste monté le temps du fade-out (sinon le unmount court-circuite l'anim)
  const [rendered, setRendered] = useState(visible);
  const reduceMotion = useReduceMotion();

  // Fade in/out overlay
  useEffect(() => {
    if (visible) {
      setRendered(true);
      setCurrentStep(0);
      progressWidth.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();

      // Progress bar
      Animated.timing(progressWidth, {
        toValue: 1,
        duration: estimatedDurationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();

      // Icon pulse — réduire les animations (OS) : icône figée, pas de pulsation en boucle.
      if (reduceMotion) {
        iconPulse.setValue(1);
      } else {
        Animated.loop(
          Animated.sequence([
            Animated.timing(iconPulse, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(iconPulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        ).start();
      }
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, fadeAnim, progressWidth, iconPulse, estimatedDurationMs, reduceMotion]);

  // Auto-rotate steps
  useEffect(() => {
    if (!visible || !steps || steps.length <= 1) return;
    const interval = setInterval(() => {
      // Fade out → change → fade in
      Animated.timing(stepFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setCurrentStep((prev) => (prev + 1) % steps.length);
        Animated.timing(stepFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [visible, steps, stepFade]);

  if (!rendered) return null;

  const hasSteps = steps && steps.length > 0;
  const displayMessage = overrideMessage ?? (hasSteps ? steps[currentStep] : message);

  const v = variantStyles[variant];

  return (
    <Modal transparent visible={rendered} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, v.overlay, { opacity: fadeAnim }]}>
        {/* Glow circles */}
        <View style={[styles.glowTop, v.glowTop]} />
        <View style={[styles.glowBottom, v.glowBottom]} />

        <View style={[styles.container, v.container]}>
          {/* Icon + Ring */}
          <View style={styles.iconArea}>
            <GlowRing />
            <Animated.View style={[styles.iconCircle, { transform: [{ scale: iconPulse }] }]}>
              <Ionicons name="flash" size={32} color={theme.colors.accent} />
            </Animated.View>
          </View>

          {/* Message */}
          {displayMessage && (
            <Animated.Text style={[styles.message, v.message, hasSteps && { opacity: stepFade }]}>
              {displayMessage}
            </Animated.Text>
          )}

          {/* Submessage (mode simple) */}
          {!hasSteps && submessage && (
            <Text style={[styles.submessage, v.submessage]}>{submessage}</Text>
          )}

          {/* Step dots (mode steps) */}
          {hasSteps && (
            <View style={styles.stepDots}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.stepDot, i === currentStep && styles.stepDotActive]} />
              ))}
            </View>
          )}

          {/* Bouncing dots */}
          <BouncingDots />

          {/* Bouton annuler (optionnel) */}
          {onCancel ? (
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            >
              <Text style={[styles.cancelText, v.cancelText]}>{cancelLabel}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Progress bar */}
          <View style={[styles.progressTrack, v.progressTrack]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '95%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,7,12,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowTop: {
    position: 'absolute',
    top: '15%',
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(255,122,26,0.12)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: '10%',
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(14,165,233,0.08)',
  },
  container: {
    backgroundColor: 'rgba(17,20,28,0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 32,
    paddingTop: 40,
    alignItems: 'center',
    minWidth: 300,
    maxWidth: '85%',
    gap: 20,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconArea: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  submessage: {
    fontSize: 13,
    color: '#9fb0c8',
    textAlign: 'center',
    lineHeight: 19,
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stepDotActive: {
    width: 18,
    backgroundColor: theme.colors.accent,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9fb0c8',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
  },
});

// DA Polish : variante "light" pour ProfileSetupScreen (seul appelant clair
// du parcours). Le variant "dark" ci-dessous est un NO-OP volontaire — un
// objet vide par clé ne change rien au style de base (`styles` ci-dessus),
// donc les 3 autres écrans (NewSession/Feedback/CoachOnboarding) gardent un
// rendu strictement identique à avant ce changement.
const variantStyles = {
  dark: {
    overlay: {},
    glowTop: {},
    glowBottom: {},
    container: {},
    message: {},
    submessage: {},
    cancelText: {},
    progressTrack: {},
  },
  light: StyleSheet.create({
    overlay: {
      backgroundColor: 'rgba(20,26,36,0.5)',
    },
    glowTop: {
      backgroundColor: 'rgba(42,77,143,0.10)',
    },
    glowBottom: {
      backgroundColor: 'rgba(200,80,20,0.08)',
    },
    container: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.borderSoft,
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 2,
    },
    message: {
      color: theme.colors.text,
    },
    submessage: {
      color: theme.colors.sub,
    },
    cancelText: {
      color: theme.colors.sub,
    },
    progressTrack: {
      backgroundColor: theme.colors.borderSoft,
    },
  }),
} as const;
