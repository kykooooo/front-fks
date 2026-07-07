import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { homeColors } from "./homeUi";

const palette = homeColors;

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export default function HomeCarouselCard({ title, subtitle, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 12,
    color: palette.sub,
  },
  content: {
    gap: 8,
  },
});
