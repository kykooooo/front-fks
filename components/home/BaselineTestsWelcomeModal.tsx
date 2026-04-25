// components/home/BaselineTestsWelcomeModal.tsx
// Modale de bienvenue affichée 1× au 1er Home quand le joueur n'a encore fait aucun test.
// Incite fortement à faire une baseline pour alimenter HomeProgressHero.

import React from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ModalContainer } from "../modal/ModalContainer";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { theme, TYPE, RADIUS } from "../../constants/theme";

const palette = theme.colors;

type Props = {
  visible: boolean;
  onStart: () => void;
  onLater: () => void;
};

export function BaselineTestsWelcomeModal({ visible, onStart, onLater }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onLater}
    >
      <ModalContainer
        visible={visible}
        onClose={onLater}
        animationType="fade"
        blurIntensity={40}
        allowBackdropDismiss={false}
        allowSwipeDismiss={false}
        showHandle={false}
        contentStyle={styles.modalContent}
      >
        <Card variant="surface" style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="analytics" size={32} color={palette.accent} />
          </View>
          <Text style={styles.title}>Mesure ton niveau de départ</Text>
          <Text style={styles.subtitle}>
            Avant ta 1ère séance, fais 3 tests rapides (10 min).{"\n"}
            Sans point de départ, tu ne verras pas tes progrès.
          </Text>

          <View style={styles.pointsList}>
            <PointRow icon="flash-outline" text="Ton sprint 30m (explosivité)" color={palette.accent} />
            <PointRow icon="rocket-outline" text="Ton CMJ (puissance jambes)" color={palette.violet500} />
            <PointRow icon="heart-outline" text="Ton Yo-Yo ou 6 min (endurance)" color={palette.info} />
          </View>

          <View style={styles.actions}>
            <Button label="Faire mes 3 tests (10 min)" onPress={onStart} fullWidth size="lg" />
            <Button label="Plus tard" onPress={onLater} variant="ghost" fullWidth size="md" />
          </View>
        </Card>
      </ModalContainer>
    </Modal>
  );
}

function PointRow({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <View style={styles.pointRow}>
      <View style={[styles.pointIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 40,
  },
  card: {
    padding: 22,
    gap: 16,
    alignItems: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.accentSoft28,
  },
  title: {
    fontSize: TYPE.title.fontSize,
    fontWeight: "900",
    color: palette.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: TYPE.body.fontSize,
    color: palette.sub,
    textAlign: "center",
    lineHeight: 22,
  },
  pointsList: {
    width: "100%",
    gap: 10,
    paddingVertical: 8,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: {
    flex: 1,
    fontSize: TYPE.body.fontSize,
    color: palette.text,
    fontWeight: "600",
  },
  actions: {
    width: "100%",
    gap: 8,
    marginTop: 4,
  },
});
