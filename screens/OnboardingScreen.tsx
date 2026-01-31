import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const palette = theme.colors;

type Slide = { title: string; body: string };

const slides: Slide[] = [
  {
    title: "Séances IA",
    body: "Choisis ou génère une séance adaptée à ton contexte (charge club, douleurs, matériel).",
  },
  {
    title: "Suivi des tests",
    body: "Passe par “Tests terrain” pour mesurer ta vitesse, sauts, endurance et suivre ta progression.",
  },
  {
    title: "Pendant la séance",
    body: "Lis les attentes de l’IA, lance le chrono intégré et coche les blocs dans l’ordre, qualité avant volume.",
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  const next = () => {
    if (isLast) return onDone();
    setIndex((i) => Math.min(i + 1, slides.length - 1));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["right", "left", "bottom"]}>
      <View style={styles.container}>
        <Card variant="surface" style={styles.card}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </Card>

        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <Button
          label={isLast ? "Commencer" : "Suivant"}
          onPress={next}
          size="lg"
          fullWidth
        />
        <TouchableOpacity onPress={onDone} style={styles.skip} activeOpacity={0.8}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    gap: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
  },
  body: {
    color: palette.sub,
    fontSize: 15,
    lineHeight: 22,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 999, borderWidth: 1, borderColor: palette.border },
  dotActive: { backgroundColor: palette.accent },
  dotInactive: { backgroundColor: "transparent" },
  skip: { alignItems: "center" },
  skipText: { color: palette.sub, fontSize: 14 },
});
