import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/ui/Card";
import { theme } from "../constants/theme";
import { LEGAL_NOTICE } from "../utils/legalContent";

const palette = theme.colors;

export default function LegalNoticeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["right", "left", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Mentions legales</Text>
        <Text style={styles.subtitle}>
          Informations legales sur l'editeur et l'hebergement.
        </Text>

        {LEGAL_NOTICE.map((section) => (
          <Card key={section.title} variant="surface" style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionBody}>
              {section.body.map((line, idx) => (
                <Text key={`${section.title}_${idx}`} style={styles.line}>
                  {line}
                </Text>
              ))}
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: "800", color: palette.text },
  subtitle: { fontSize: 12, color: palette.sub, marginTop: 4 },
  card: { padding: 14, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: palette.text },
  sectionBody: { gap: 6 },
  line: { fontSize: 12, color: palette.sub, lineHeight: 18 },
});
