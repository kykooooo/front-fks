// components/ui/LoadingOverlay.tsx
// Overlay de chargement premium avec étapes animées

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Modal, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  submessage?: string;
  /** Étapes qui défilent automatiquement (cycle toutes les ~4s) */
  steps?: string[];
  /** Durée estimée en ms pour la barre de progression (défaut: 25000) */
  estimatedDurationMs?: number;
}

// ─── Bouncing Dots ───
function BouncingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -8, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    bounce(dot1, 0).start();
    bounce(dot2, 150).start();
    bounce(dot3, 300).start();
  }, [dot1, dot2, dot3]);

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

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotation]);

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
  estimatedDurationMs = 25000,
}: LoadingOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  const [currentStep, setCurrentStep] = useState(0);

  // Fade in/out overlay
  useEffect(() => {
    if (visible) {
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

      // Icon pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(iconPulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, fadeAnim, progressWidth, iconPulse, estimatedDurationMs]);

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

  if (!visible) return null;

  const hasSteps = steps && steps.length > 0;
  const displayMessage = hasSteps ? steps[currentStep] : message;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Glow circles */}
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.container}>
          {/* Icon + Ring */}
          <View style={styles.iconArea}>
            <GlowRing />
            <Animated.View style={[styles.iconCircle, { transform: [{ scale: iconPulse }] }]}>
              <Ionicons name="flash" size={32} color={theme.colors.accent} />
            </Animated.View>
          </View>

          {/* Message */}
          {displayMessage && (
            <Animated.Text style={[styles.message, hasSteps && { opacity: stepFade }]}>
              {displayMessage}
            </Animated.Text>
          )}

          {/* Submessage (mode simple) */}
          {!hasSteps && submessage && (
            <Text style={styles.submessage}>{submessage}</Text>
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

          {/* Progress bar */}
          <View style={styles.progressTrack}>
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
