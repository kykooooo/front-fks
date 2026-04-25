// components/PainSpikeModal.tsx
//
// Modal critique (règle 5 de INJURY_IA_CHARTER.md) déclenché depuis la carte
// advice Home `injury_pain_spike` (pain >= 7 sur un feedback).
//
// 3 boutons d'action :
//   1. "Modifier ma zone sensible"    → callback `onModifyInjury` (le parent
//                                        ouvre InjuryForm / InjuryZonesSection).
//   2. "J'ai consulté, la déclaration → callback `onAcknowledge` (le parent
//       reste active"                   persiste `lastSeenPainSpike: nowISO`
//                                       dans le profil, ce qui empêche la
//                                       carte de re-déclencher).
//   3. "Appeler le SAMU"              → tel:15 via Linking (silent fallback).
//
// Design :
//   - Overlay rouge léger non-dismissable (pas de swipe-down). Le joueur DOIT
//     choisir une action.
//   - Boutons stackés, large touch target (≥ 48px).
//   - Phrase principale sourcée depuis shared/SAFETY_PHRASES.ts.
//
// ── Intégration dans HomeScreen.tsx (à faire plus tard, fichier WIP) ──
//
//   import { PainSpikeModal } from "../components/PainSpikeModal";
//
//   const [painSpikeVisible, setPainSpikeVisible] = useState(false);
//   const advice = useContextualAdvice();
//   useEffect(() => {
//     if (advice?.id === "injury_pain_spike") setPainSpikeVisible(true);
//   }, [advice?.id]);
//
//   <PainSpikeModal
//     visible={painSpikeVisible}
//     onClose={() => setPainSpikeVisible(false)}
//     onModifyInjury={() => {
//       setPainSpikeVisible(false);
//       navigation.navigate("Profile"); // ou ouvrir InjuryForm inline
//     }}
//     onAcknowledge={acknowledgePainSpike} // depuis useInjuryActions()
//   />

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Linking,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { SAFETY_PHRASES } from "../shared/SAFETY_PHRASES";

type Props = {
  visible: boolean;
  /**
   * Ferme le modal sans action. NON utilisé pour dismiss silencieux — la
   * règle charte exige une action explicite (un des 3 boutons). Passé
   * quand-même pour hook standard parent.
   */
  onClose: () => void;
  /**
   * Bouton "Modifier ma zone sensible". Le parent gère la navigation vers
   * l'écran profil (section Zones sensibles) ou l'ouverture d'InjuryForm.
   */
  onModifyInjury: () => void;
  /**
   * Bouton "J'ai consulté". Le parent persiste `lastSeenPainSpike: nowISO`
   * dans le profil Firestore (via `useInjuryActions.acknowledgePainSpike`).
   */
  onAcknowledge: () => void | Promise<void>;
};

export function PainSpikeModal({ visible, onClose, onModifyInjury, onAcknowledge }: Props) {
  // `submitting` désactive les 3 boutons pendant l'appel `acknowledgePainSpike`
  // (évite double-clic / spam). Reset quel que soit le résultat (succès ou
  // échec). Le modal reste ouvert en cas d'échec — c'est le parent qui gère
  // le toast d'erreur (cf. HomeScreen.handlePainSpikeAcknowledge).
  const [submitting, setSubmitting] = useState(false);

  const callEmergency = useCallback(() => {
    Linking.openURL("tel:15").catch(() => {
      // Silent fallback (tablette / simulateur) : le joueur voit le n° dans
      // le label du bouton et peut appeler manuellement.
    });
  }, []);

  const handleAcknowledge = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAcknowledge();
      // Succès : on ferme.
      onClose();
    } catch {
      // Échec : on GARDE le modal ouvert pour que le joueur retente.
      // Le parent (HomeScreen) a déjà toasté l'erreur — on ne duplique pas.
    } finally {
      setSubmitting(false);
    }
  }, [submitting, onAcknowledge, onClose]);

  const handleModify = useCallback(() => {
    if (submitting) return;
    onModifyInjury();
    onClose();
  }, [submitting, onModifyInjury, onClose]);

  const handleEmergency = useCallback(() => {
    if (submitting) return;
    callEmergency();
  }, [submitting, callEmergency]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      // Pas d'`onRequestClose` qui appelle `onClose` silencieusement : la
      // règle exige action explicite. On laisse la prop pour compat Android
      // back button (ne valide pas, affiche juste le modal encore).
      onRequestClose={() => { /* no-op: force user to pick action */ }}
    >
      <SafeAreaView style={styles.backdrop} edges={["top", "right", "left", "bottom"]}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <Ionicons name="alert-circle" size={24} color={theme.colors.red} />
              <Text style={styles.title}>Ta douleur a nettement augmenté</Text>
            </View>

            <Text style={styles.message}>{SAFETY_PHRASES.PAIN_SPIKE_ALERT}</Text>

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonPrimary,
                  pressed && styles.buttonPressed,
                  submitting && styles.buttonDisabled,
                ]}
                onPress={handleEmergency}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Appeler le SAMU au 15"
              >
                <Ionicons name="call" size={18} color={theme.colors.white} />
                <Text style={styles.buttonPrimaryText}>Appeler le SAMU 15</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonSecondary,
                  pressed && styles.buttonPressed,
                  submitting && styles.buttonDisabled,
                ]}
                onPress={handleModify}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Modifier ma zone sensible"
              >
                <Ionicons name="body-outline" size={18} color={theme.colors.text} />
                <Text style={styles.buttonSecondaryText}>Modifier ma zone sensible</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonTertiary,
                  pressed && styles.buttonPressed,
                  submitting && styles.buttonDisabled,
                ]}
                onPress={handleAcknowledge}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="J'ai consulté, la déclaration reste active"
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.sub} />
                <Text style={styles.buttonTertiaryText}>
                  {submitting ? "Enregistrement…" : "J'ai consulté, ma déclaration reste active"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const palette = theme.colors;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: RADIUS.xl,
    backgroundColor: palette.bg,
    borderWidth: 2,
    borderColor: palette.redSoft18,
    overflow: "hidden",
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  message: {
    fontSize: TYPE.body.fontSize,
    lineHeight: 22,
    color: palette.text,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    minHeight: 48,
  },
  buttonPrimary: {
    backgroundColor: palette.red,
  },
  buttonPrimaryText: {
    color: palette.white,
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
  },
  buttonSecondary: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  buttonSecondaryText: {
    color: palette.text,
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
  },
  buttonTertiary: {
    backgroundColor: "transparent",
  },
  buttonTertiaryText: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
