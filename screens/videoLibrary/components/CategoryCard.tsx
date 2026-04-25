// screens/videoLibrary/components/CategoryCard.tsx
import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Badge } from "../../../components/ui/Badge";
import { MODALITY_CONFIG } from "../videoLibraryConfig";
import type { BankModality } from "../../../engine/exerciseBank";

const palette = theme.colors;

type Props = {
  modality: BankModality | "favorites";
  label: string;
  description: string;
  count: number;
  onPress: () => void;
  animDelay: number;
};

export function CategoryCard({ modality, label, description, count, onPress, animDelay }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      delay: animDelay,
      useNativeDriver: true,
    }).start();
  }, []);

  const config = MODALITY_CONFIG[modality];
  return (
    <Animated.View
      style={{
        width: "48%",
        opacity: anim,
        transform: [{
          translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
        }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[styles.categoryCard, { borderColor: config.tint + "30" }]}
      >
        <View style={[styles.categoryIcon, { backgroundColor: config.tintSoft }]}>
          <Ionicons name={config.icon as any} size={20} color={config.tint} />
        </View>
        <View style={styles.categoryContent}>
          <Text style={styles.categoryLabel}>{label}</Text>
          <Text style={styles.categoryDescription} numberOfLines={1}>
            {description}
          </Text>
        </View>
        <Badge
          label={`${count}`}
          tone={modality === "favorites" && count > 0 ? "ok" : "default"}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: palette.card,
    gap: 10,
    minHeight: 130,
    justifyContent: "space-between",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryContent: { gap: 2 },
  categoryLabel: { fontSize: TYPE.body.fontSize, fontWeight: "700", color: palette.text },
  categoryDescription: { fontSize: TYPE.micro.fontSize, color: palette.sub },
});
