// screens/profile/InjuryZonesSection.tsx
//
// Section "Zones sensibles" du ProfileScreen.
// MVP blessures Jour 4 — composant AUTOPORTANT (aucune dépendance au
// contexte de ProfileScreen), importable et testable indépendamment.
//
// ─────────────────────────────────────────────────────────────────────────
// INTÉGRATION dans ProfileScreen.tsx (à faire manuellement lors du cleanup
// WIP) :
//
//   import { InjuryZonesSection } from "./profile/InjuryZonesSection";
//
//   // Dans le rendu du ProfileScreen, à l'endroit souhaité :
//   <InjuryZonesSection
//     onOpenInjuryForm={() => setInjuryFormVisible(true)}
//     onOpenPrivacyPolicy={() => navigation.navigate("PrivacyPolicy")}
//   />
//
//   // (Optionnel) pour le flow "Ajouter / Modifier", tu peux monter
//   // un modal qui contient <InjuryForm ... requireLegalConsent />.
// ─────────────────────────────────────────────────────────────────────────
//
// Props :
//   - `onOpenInjuryForm` : callback appelé quand le joueur veut ajouter
//     ou modifier une zone sensible. Le parent monte le formulaire
//     (InjuryForm) dans un modal.
//   - `onOpenPrivacyPolicy` : callback optionnel pour ouvrir la politique
//     de confidentialité depuis le lien inline. Transmis à InjuryForm via
//     le parent si besoin.
//
// Flow "Marquer résolue" (règle D du scope Jour 4) :
//   Question honnête : "Tu peux courir et sauter sans ressentir de gêne ?"
//   - Oui  → `markInjuryResolved(area)` (retire de activeInjuries)
//   - Non  → `downgradeInjury(area)` (passe en Gêne légère + reset
//            lastConfirm → recheck dans 7 jours via règle `injury_stale`)

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme, TYPE, RADIUS } from "../../constants/theme";
import { useInjuryActions } from "../../hooks/useInjuryActions";
import { INJURY_SEVERITY_LABELS } from "../../constants/injury";
import { showToast } from "../../utils/toast";
import type { ActiveInjuryParsed } from "../../schemas/firestoreSchemas";

type Props = {
  onOpenInjuryForm: () => void;
  onOpenPrivacyPolicy?: () => void;
};

type ConfirmState =
  | { kind: "idle" }
  | { kind: "resolve"; area: string };

const palette = theme.colors;

/**
 * Calcule "il y a X jours" depuis une date ISO.
 * Retourne 0 si parse impossible (injury fraîche).
 */
function daysSince(iso: string | undefined | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function severityLabel(severity: number): string {
  const key = Math.max(0, Math.min(3, Math.round(severity))) as 0 | 1 | 2 | 3;
  return INJURY_SEVERITY_LABELS[key];
}

export function InjuryZonesSection({ onOpenInjuryForm, onOpenPrivacyPolicy }: Props) {
  const { activeInjuries, loading, markInjuryResolved, downgradeInjury } = useInjuryActions();
  const [confirm, setConfirm] = useState<ConfirmState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);

  const openResolveConfirm = useCallback((area: string) => {
    setConfirm({ kind: "resolve", area });
  }, []);

  const closeConfirm = useCallback(() => {
    if (!submitting) setConfirm({ kind: "idle" });
  }, [submitting]);

  // Réponse "Oui, pas de gêne" → résolue
  const handleResolveYes = useCallback(async () => {
    if (confirm.kind !== "resolve") return;
    setSubmitting(true);
    try {
      await markInjuryResolved(confirm.area);
      showToast({
        type: "success",
        title: "Zone sensible résolue",
        message: "Belle nouvelle, on lève les précautions.",
      });
      setConfirm({ kind: "idle" });
    } catch (err) {
      if (__DEV__) console.error("[InjuryZonesSection] markInjuryResolved failed:", err);
      showToast({ type: "error", title: "Erreur", message: "Impossible de mettre à jour pour le moment." });
    } finally {
      setSubmitting(false);
    }
  }, [confirm, markInjuryResolved]);

  // Réponse "Un peu encore" → downgrade Gêne légère + recheck 7j
  const handleResolveSoft = useCallback(async () => {
    if (confirm.kind !== "resolve") return;
    setSubmitting(true);
    try {
      await downgradeInjury(confirm.area);
      showToast({
        type: "success",
        title: "Ajusté en Gêne légère",
        message: "On recheck dans 7 jours. En attendant, on continue de ménager.",
      });
      setConfirm({ kind: "idle" });
    } catch (err) {
      if (__DEV__) console.error("[InjuryZonesSection] downgradeInjury failed:", err);
      showToast({ type: "error", title: "Erreur", message: "Impossible de mettre à jour pour le moment." });
    } finally {
      setSubmitting(false);
    }
  }, [confirm, downgradeInjury]);

  // Note linter : onOpenPrivacyPolicy est accepté pour passation en cascade
  // vers InjuryForm depuis le parent. Non utilisé directement dans cette section.
  void onOpenPrivacyPolicy;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Ionicons name="medical-outline" size={18} color={palette.accent} />
        <Text style={styles.title}>Zones sensibles</Text>
      </View>

      {loading ? (
        <Text style={styles.muted}>Chargement…</Text>
      ) : activeInjuries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.muted}>Aucune zone sensible déclarée.</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={onOpenInjuryForm}
            accessibilityRole="button"
            accessibilityLabel="Déclarer une zone sensible"
          >
            <Ionicons name="add-circle-outline" size={16} color={palette.white} />
            <Text style={styles.primaryButtonText}>Déclarer une zone sensible</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {activeInjuries.map((inj) => (
            <InjuryCard
              key={inj.area}
              injury={inj}
              onEdit={onOpenInjuryForm}
              onResolve={() => openResolveConfirm(inj.area)}
            />
          ))}
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={onOpenInjuryForm}
            accessibilityRole="button"
            accessibilityLabel="Ajouter une autre zone sensible"
          >
            <Ionicons name="add-circle-outline" size={16} color={palette.accent} />
            <Text style={styles.secondaryButtonText}>Ajouter une autre zone</Text>
          </Pressable>
        </View>
      )}

      {/* Modal de confirmation "Marquer résolue" — question honnête */}
      <Modal
        visible={confirm.kind === "resolve"}
        transparent
        animationType="fade"
        onRequestClose={closeConfirm}
      >
        <SafeAreaView style={styles.backdrop} edges={["top", "right", "left", "bottom"]}>
          <View style={styles.confirmCard}>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
              <View style={styles.titleRow}>
                <Ionicons name="help-circle-outline" size={22} color={palette.accent} />
                <Text style={styles.confirmTitle}>Plus de gêne ?</Text>
              </View>
              <Text style={styles.confirmQuestion}>
                Tu peux courir et sauter sans ressentir de gêne ?
              </Text>
              <View style={{ gap: 10 }}>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, submitting && styles.buttonDisabled]}
                  onPress={handleResolveYes}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Oui, plus de gêne"
                >
                  <Text style={styles.primaryButtonText}>Oui, pas de gêne</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed, submitting && styles.buttonDisabled]}
                  onPress={handleResolveSoft}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Un peu encore, passer en gêne légère"
                >
                  <Text style={styles.secondaryButtonText}>Un peu encore</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.tertiaryButton, pressed && styles.buttonPressed, submitting && styles.buttonDisabled]}
                  onPress={closeConfirm}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Annuler"
                >
                  <Text style={styles.tertiaryButtonText}>Annuler</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/** Carte récap d'une injury active */
function InjuryCard({
  injury,
  onEdit,
  onResolve,
}: {
  injury: ActiveInjuryParsed;
  onEdit: () => void;
  onResolve: () => void;
}) {
  const days = daysSince(injury.lastConfirm || injury.startDate);
  const daysLabel = days === 0 ? "aujourd'hui" : `il y a ${days} jour${days > 1 ? "s" : ""}`;

  return (
    <View style={styles.injuryCard}>
      <View style={styles.injuryHeader}>
        <Text style={styles.injuryArea}>{injury.area}</Text>
        <Text style={styles.injurySeverity}>{severityLabel(injury.severity)}</Text>
      </View>
      <Text style={styles.injuryMeta}>Signalée {daysLabel}</Text>
      {injury.note ? <Text style={styles.injuryNote}>{injury.note}</Text> : null}
      <View style={styles.injuryActions}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Ajuster la zone ${injury.area}`}
        >
          <Ionicons name="create-outline" size={14} color={palette.accent} />
          <Text style={styles.actionButtonText}>Ajuster</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
          onPress={onResolve}
          accessibilityRole="button"
          accessibilityLabel={`Marquer la zone ${injury.area} comme résolue`}
        >
          <Ionicons name="checkmark-circle-outline" size={14} color={palette.accent} />
          <Text style={styles.actionButtonText}>Marquer résolue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  muted: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
  },
  emptyState: {
    gap: 10,
    paddingVertical: 12,
    alignItems: "flex-start",
  },

  injuryCard: {
    padding: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    gap: 6,
  },
  injuryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  injuryArea: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
    textTransform: "capitalize",
  },
  injurySeverity: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.accent,
  },
  injuryMeta: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
  },
  injuryNote: {
    fontSize: TYPE.caption.fontSize,
    color: palette.text,
    fontStyle: "italic",
  },
  injuryActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
    minHeight: 36,
  },
  actionButtonText: {
    color: palette.accent,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: palette.accent,
    minHeight: 44,
  },
  primaryButtonText: {
    color: palette.white,
    fontWeight: "800",
    fontSize: TYPE.body.fontSize,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: "transparent",
    minHeight: 44,
  },
  secondaryButtonText: {
    color: palette.accent,
    fontWeight: "700",
    fontSize: TYPE.body.fontSize,
  },
  tertiaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    minHeight: 40,
  },
  tertiaryButtonText: {
    color: palette.sub,
    fontWeight: "600",
    fontSize: TYPE.caption.fontSize,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: RADIUS.xl,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmTitle: {
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  confirmQuestion: {
    fontSize: TYPE.body.fontSize,
    lineHeight: 22,
    color: palette.text,
  },
});

export default InjuryZonesSection;
