// screens/feedback/components/HeroReadinessCard.tsx
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../../constants/theme';

const COLORS = theme.colors;

type Props = {
  readiness: number;
  readinessLabel: string;
  todayKey: string;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
};

export function HeroReadinessCard({ readiness, readinessLabel, todayKey, fadeAnim, slideAnim }: Props) {
  return (
    <Animated.View
      style={[styles.heroCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.heroGlow} />
      <View style={styles.heroHeaderRow}>
        <View style={styles.heroTitleRow}>
          <LinearGradient
            colors={['#ff7a1a', '#ff9a4a']}
            style={styles.heroIcon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="heart-outline" size={18} color="#fff" />
          </LinearGradient>
          <Text style={styles.heroTitle}>État du joueur</Text>
        </View>
        <View style={styles.heroDateBadge}>
          <Text style={styles.heroDate}>{todayKey}</Text>
        </View>
      </View>
      <View style={styles.heroBodyRow}>
        <View style={styles.heroScoreCircle} accessibilityRole="text" accessibilityLabel={`Score de readiness : ${readiness} sur 100, ${readinessLabel}`}>
          <Text style={styles.heroScore}>{readiness}</Text>
          <Text style={styles.heroScoreSuffix}>/100</Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroTag}>Readiness</Text>
          <Text style={styles.heroLabel}>{readinessLabel}</Text>
          <Text style={styles.heroSub}>
            FKS ajuste la prochaine séance en fonction de ton état réel.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    opacity: 0.9,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  heroDateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroDate: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  heroBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  heroScoreCircle: {
    width: 110,
    height: 110,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  heroScore: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.text,
  },
  heroScoreSuffix: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  heroInfo: {
    flex: 1,
  },
  heroTag: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.accent,
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
