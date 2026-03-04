// screens/WelcomeScreen.tsx
// Écrans de présentation pro avant inscription - style dark sport/fitness

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHaptics } from '../hooks/useHaptics';
import { authColors } from '../theme/authColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ====== SLIDES DATA ======
type Slide = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string[];
  title: string;
  subtitle: string;
  highlight?: string;
};

const SLIDES: Slide[] = [
  {
    id: 'hero',
    icon: 'fitness-outline',
    iconBg: ['#ff7a1a', '#ff9a4a'],
    title: 'FKS',
    subtitle: 'Ta prépa physique football,\noptimisée par l\'IA',
    highlight: 'Entraîne-toi comme un pro.',
  },
  {
    id: 'ai',
    icon: 'bulb-outline',
    iconBg: ['#8b5cf6', '#a78bfa'],
    title: 'Séances intelligentes',
    subtitle: 'L\'IA génère des séances adaptées à ta charge, ton calendrier club et tes objectifs.',
    highlight: 'Personnalisé. Chaque jour.',
  },
  {
    id: 'tracking',
    icon: 'trending-up-outline',
    iconBg: ['#06b6d4', '#22d3ee'],
    title: 'Suivi complet',
    subtitle: 'Forme, fatigue, tests terrain... ta progression est visible semaine après semaine.',
    highlight: 'Mesure. Progresse. Domine.',
  },
  {
    id: 'cycles',
    icon: 'layers-outline',
    iconBg: ['#16a34a', '#4ade80'],
    title: 'Programmes structurés',
    subtitle: 'Force, Explosivité, Endurance, RSA... Des cycles de 12 séances pour progresser vraiment.',
    highlight: '12 séances. 1 objectif.',
  },
  {
    id: 'cta',
    icon: 'rocket-outline',
    iconBg: ['#ff7a1a', '#ff9a4a'],
    title: 'Prêt à passer au\nniveau supérieur ?',
    subtitle: 'Rejoins les footballeurs qui prennent leur prépa physique au sérieux.',
    highlight: '',
  },
];

type Props = {
  onComplete: (entry?: "login" | "register") => void;
};

export default function WelcomeScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Animations d'entrée par slide
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const handleComplete = useCallback(async (entry: "login" | "register" = "login") => {
    haptics.impactMedium();
    await AsyncStorage.setItem('fks_welcome_done', 'true');
    onComplete(entry);
  }, [onComplete, haptics]);

  const goToSlide = useCallback((index: number) => {
    haptics.impactLight();
    // Fade out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setCurrentIndex(index);
      // Fade in
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      handleComplete("register");
    } else {
      goToSlide(currentIndex + 1);
    }
  }, [isLastSlide, currentIndex, goToSlide, handleComplete]);

  const handleSkip = useCallback(() => {
    handleComplete("login");
  }, [handleComplete]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = ({ item, index }: { item: Slide; index: number }) => {
    const isHero = index === 0;
    const isCta = index === SLIDES.length - 1;

    return (
      <View style={styles.slide}>
        <View style={styles.slideCard}>
          {/* Icon avec gradient */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={item.iconBg as [string, string]}
              style={styles.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={item.icon} size={isHero ? 56 : 48} color="#fff" />
            </LinearGradient>
          </View>

          {/* Title */}
          <Text style={[styles.title, isHero && styles.titleHero]}>
            {item.title}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>{item.subtitle}</Text>

          {/* Highlight */}
          {item.highlight ? (
            <View style={styles.highlightContainer}>
              <Text style={styles.highlight}>{item.highlight}</Text>
            </View>
          ) : null}

          {/* CTA buttons on last slide */}
          {isCta ? (
            <View style={styles.ctaContainer}>
              <TouchableOpacity
                style={styles.ctaPrimary}
                onPress={() => handleComplete("register")}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#ff7a1a', '#ff9a4a']}
                  style={styles.ctaPrimaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.ctaPrimaryText}>Créer un compte</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ctaSecondary}
                onPress={() => handleComplete("login")}
                activeOpacity={0.7}
              >
                <Text style={styles.ctaSecondaryText}>J'ai déjà un compte</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.slideCardEdge} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={["#0b1120", "#111827", "#1f2937"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />
      <View style={[styles.pitchTag, { top: insets.top + 4 }]}>
        <Ionicons name="football-outline" size={12} color="rgba(255,255,255,0.9)" />
        <Text style={styles.pitchTagText}>Football Performance System</Text>
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Skip button (hidden on last slide) */}
        {!isLastSlide ? (
          <TouchableOpacity
            style={[styles.skipButton, { top: insets.top + 8 }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        ) : null}

        {/* Slides */}
        <Animated.View
          style={[
            styles.slidesContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            renderItem={renderSlide}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            scrollEventThrottle={16}
            bounces={false}
          />
        </Animated.View>

        {/* Bottom section: dots + next button */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
          {/* Pagination dots */}
          <View style={styles.dotsContainer}>
            {SLIDES.map((_, index) => {
              const inputRange = [
                (index - 1) * SCREEN_WIDTH,
                index * SCREEN_WIDTH,
                (index + 1) * SCREEN_WIDTH,
              ];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 24, 8],
                extrapolate: 'clamp',
              });
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => goToSlide(index)}
                  activeOpacity={0.7}
                >
                  <Animated.View
                    style={[
                      styles.dot,
                      {
                        width: dotWidth,
                        opacity: dotOpacity,
                        backgroundColor: authColors.accent,
                      },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Next button (hidden on last slide) */}
          {!isLastSlide ? (
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#ff7a1a', '#ff9a4a']}
                style={styles.nextButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.nextButtonText}>Suivant</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ====== STYLES ======
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: authColors.bg,
  },
  bgGlowTop: {
    position: 'absolute',
    top: -160,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: 'rgba(255,122,26,0.22)',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -220,
    right: -170,
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundColor: 'rgba(14,165,233,0.15)',
  },
  safeArea: {
    flex: 1,
  },
  pitchTag: {
    position: 'absolute',
    left: 16,
    zIndex: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(6,8,14,0.55)',
  },
  pitchTagText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: authColors.sub,
    fontSize: 14,
    fontWeight: '600',
  },
  slidesContainer: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 120,
  },
  slideCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(8,12,20,0.72)',
    overflow: 'hidden',
  },
  slideCardEdge: {
    position: 'absolute',
    top: -80,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: 'rgba(255,122,26,0.16)',
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff7a1a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: authColors.text,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  titleHero: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#d8deea',
    textAlign: 'center',
    lineHeight: 24,
  },
  highlightContainer: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: authColors.accentSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.3)',
  },
  highlight: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.accent,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  ctaContainer: {
    marginTop: 40,
    width: '100%',
    gap: 16,
  },
  ctaPrimary: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ff7a1a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  ctaPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  ctaSecondary: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  ctaSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.sub,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(5,8,14,0.62)',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ff7a1a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
