// screens/WelcomeScreen.tsx
// Onboarding swipeable — 3 slides clairs (sans image), illustrés par icônes + CTA

import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  Pressable,
  type ViewToken,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";
import { STORAGE_KEYS } from "../constants/storage";
import { Screen } from "../components/ui/Screen";
import { Button } from "../components/ui/Button";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const palette = theme.colors;

/* ─── Slides data ─── */
const SLIDES = [
  {
    id: "1",
    icon: "football-outline" as const,
    title: "Ta prépa physique,\nton avantage",
    subtitle: "Des séances adaptées à ton niveau, ton calendrier et tes objectifs.",
  },
  {
    id: "2",
    icon: "trending-up-outline" as const,
    title: "Progresse à\nchaque séance",
    subtitle: "Force, vitesse, endurance — chaque programme te rapproche de ton meilleur niveau.",
  },
  {
    id: "3",
    icon: "shield-checkmark-outline" as const,
    title: "Prêt le jour\ndu match",
    subtitle: "L'app gère ta charge pour que tu arrives frais et performant.",
  },
] as const;

/* ─── Types ─── */
type SlideData = (typeof SLIDES)[number];

/**
 * CE QUE LE CARROUSEL REND À LA NAVIGATION, EN DEUX AXES SÉPARÉS.
 *
 *  . `entry`   : PAR OÙ on entre (créer un compte, ou se connecter) ;
 *  . `options.intentionCoach` : POUR QUI on entre.
 *
 * Les deux sont distincts parce qu'un coach s'inscrit avec le MÊME écran qu'un
 * joueur : ce n'est pas une porte séparée, c'est une intention qu'on retient le
 * temps de traverser l'inscription. Elle ne vaut RIEN comme droit — l'espace
 * coach reste dérivé de l'appartenance au club (domain/appSpace.ts), et cette
 * intention ne fait que choisir l'écran par lequel on commence.
 */
export type WelcomeCompleteOptions = { intentionCoach?: boolean };

type Props = {
  onComplete: (entry?: "login" | "register", options?: WelcomeCompleteOptions) => void;
};

/* ─── Slide component ─── */
function Slide({ item, width, bottomInset }: { item: SlideData; width: number; bottomInset: number }) {
  return (
    <View style={[styles.slide, { width, paddingBottom: bottomInset }]}>
      <View style={styles.iconCircle}>
        <Ionicons name={item.icon} size={40} color={palette.accent} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );
}

/* ─── Main ─── */
export default function WelcomeScreen({ onComplete }: Props) {
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData>>(null);

  // Espace réservé en bas de chaque slide pour ne pas passer sous le bloc CTA.
  // 216 (et non 180) : le bloc CTA a gagné ~36px avec la ligne « Je suis coach ».
  const bottomBlock = Math.max(insets.bottom, 20) + 216;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleStart = useCallback(async () => {
    haptics.impactMedium();
    await AsyncStorage.setItem(STORAGE_KEYS.WELCOME_DONE, "true");
    onComplete("register");
  }, [haptics, onComplete]);

  const handleLogin = useCallback(async () => {
    haptics.impactLight();
    await AsyncStorage.setItem(STORAGE_KEYS.WELCOME_DONE, "true");
    onComplete("login");
  }, [haptics, onComplete]);

  // ENTRÉE COACH (recette 03/08 : « comment un coach est obligé de faire
  // l'inscription ?! »). Un coach passait par le questionnaire JOUEUR entier
  // (poste, pied fort, jours de match…) avant de trouver, en pied d'étape 1, le
  // lien « Tu fais partie du staff ? ». Il crée maintenant son compte par le même
  // écran que tout le monde — c'est l'ARRIVÉE qui change, pas l'inscription.
  //
  // DISCRET, mais TROUVABLE : lien texte sous les deux CTA joueur, jamais un
  // second bouton. Le joueur reste le chemin principal (un seul CTA primaire par
  // écran, règle d'or) ; le coach, lui, sait qu'il est coach et cherche sa porte.
  const handleCoach = useCallback(async () => {
    haptics.impactLight();
    await AsyncStorage.setItem(STORAGE_KEYS.WELCOME_DONE, "true");
    onComplete("register", { intentionCoach: true });
  }, [haptics, onComplete]);

  // Dots rendus tappables (DA Polish) : `flatListRef` était déclaré mais
  // jamais câblé — le swipe était le seul moyen d'avancer.
  const goToSlide = useCallback(
    (index: number) => {
      haptics.impactLight();
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setActiveIndex(index);
    },
    [haptics]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SlideData>) => (
      <Slide item={item} width={SCREEN_W} bottomInset={bottomBlock} />
    ),
    [SCREEN_W, bottomBlock]
  );

  return (
    <Screen bottomInset={false} style={styles.container}>
      {/* Lien "Passer" (DA Polish) : le carrousel n'avait aucun moyen d'accès
          direct au compte hors swipe complet des 3 slides. */}
      <Pressable
        onPress={handleStart}
        style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Passer l'introduction"
      >
        <Text style={styles.skipText}>Passer</Text>
      </Pressable>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES as unknown as SlideData[]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        snapToInterval={SCREEN_W}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {/* Bottom — dots + CTA */}
      <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
        {/* Dots — tappables, contour visible (DA Polish : #E2E7EE 1,16:1 -> borderStrong 3,04:1) */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => goToSlide(i)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Aller à la slide ${i + 1}`}
            >
              <View style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
            </Pressable>
          ))}
        </View>

        {/* CTA — composant Button unique du parcours (DA Polish §1.5) */}
        <Button
          label="Commencer"
          onPress={handleStart}
          variant="primary"
          size="lg"
          fullWidth
          style={styles.ctaShadowOff}
          accessibilityLabel="Commencer l'inscription"
        />
        <Pressable
          onPress={handleLogin}
          style={({ pressed }) => [styles.loginLink, pressed && styles.loginLinkPressed]}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="J'ai déjà un compte, me connecter"
        >
          <Text style={styles.loginLinkText}>J'ai déjà un compte</Text>
        </Pressable>

        {/* Entrée coach — voir handleCoach. Caption + icône, sous les deux CTA
            joueur : elle se lit sans se disputer la hiérarchie avec eux. */}
        <Pressable
          onPress={handleCoach}
          style={({ pressed }) => [styles.coachLink, pressed && styles.loginLinkPressed]}
          hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Je suis coach, créer mon club"
        >
          <Ionicons name="people-outline" size={14} color={palette.sub} />
          <Text style={styles.coachLinkText}>Je suis coach</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.bg,
  },
  skip: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.xl2,
    zIndex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipPressed: {
    opacity: 0.7,
  },
  skipText: {
    ...theme.typography.caption,
    color: palette.sub,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl2,
    gap: 4,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.display,
    color: palette.text,
    textAlign: "center",
    maxWidth: 320,
  },
  subtitle: {
    ...theme.typography.body,
    color: palette.sub,
    textAlign: "center",
    marginTop: theme.spacing.md,
    maxWidth: 320,
  },

  // ─── Bottom ───
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.xl2,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 10,
    marginBottom: theme.spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
  },
  dotActive: {
    backgroundColor: palette.accent,
    width: 24,
  },
  dotInactive: {
    backgroundColor: palette.borderStrong,
  },
  // Neutralise le halo orange de Button.primary (theme.shadow.accent porte
  // l'orange du dark, `#ff7a1a` — DA Polish lot0 §1.4). Local à cet écran :
  // Button.tsx garde son ombre par défaut pour ses 17 autres appelants.
  ctaShadowOff: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  loginLink: {
    paddingVertical: 12,
    marginTop: 4,
  },
  // Retour visuel au press (audit tactile 2026-07) : ce lien n'avait aucun
  // feedback pendant l'appui, contrairement au CTA principal juste au-dessus.
  loginLinkPressed: {
    opacity: 0.7,
  },
  loginLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.sub,
  },
  // Entrée coach : un cran SOUS "J'ai déjà un compte" (caption vs 14/600), avec
  // la même couleur lisible `sub` — discret ne veut pas dire illisible (les 6
  // échecs de contraste de l'audit DA venaient précisément de `muted` sur fond
  // sombre). La zone tactile, elle, reste pleine (paddingVertical + hitSlop).
  coachLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  coachLinkText: {
    ...theme.typography.caption,
    color: palette.sub,
    fontWeight: "600",
  },
});
