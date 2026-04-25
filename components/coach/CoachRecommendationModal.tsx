// components/coach/CoachRecommendationModal.tsx
// Modal pour envoyer une recommandation à un joueur

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../constants/theme";
import { MICROCYCLES, MicrocycleId, isMicrocycleId } from "../../domain/microcycles";
import {
  RECOMMENDATION_TYPES,
  RECOMMENDATION_TEMPLATES,
  type RecommendationType,
} from "../../domain/coachRecommendations";
import { sendRecommendation } from "../../repositories/coachRecommendationsRepo";
import { auth } from "../../services/firebase";
import { showToast } from "../../utils/toast";

const palette = theme.colors;

type Props = {
  visible: boolean;
  playerId: string;
  playerName: string;
  onClose: () => void;
  onSent?: () => void;
};

export function CoachRecommendationModal({
  visible,
  playerId,
  playerName,
  onClose,
  onSent,
}: Props) {
  const [type, setType] = useState<RecommendationType>("custom");
  const [message, setMessage] = useState("");
  const [selectedCycle, setSelectedCycle] = useState<MicrocycleId | null>(null);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      showToast({ type: "warn", title: "Message requis", message: "Écris un message pour le joueur." });
      return;
    }

    setSending(true);
    try {
      const coachId = auth.currentUser?.uid ?? "";
      const coachName = auth.currentUser?.displayName ?? "Coach";

      await sendRecommendation({
        coachId,
        coachName,
        playerId,
        type,
        message: message.trim(),
        suggestedCycleId: selectedCycle,
      });

      showToast({ type: "success", title: "Envoyé", message: `Ta recommandation a été envoyée à ${playerName}.` });
      setMessage("");
      setType("custom");
      setSelectedCycle(null);
      onSent?.();
      onClose();
    } catch (e: any) {
      showToast({ type: "error", title: "Erreur", message: e?.message ?? "Impossible d'envoyer la recommandation." });
    } finally {
      setSending(false);
    }
  };

  const handleTypeSelect = (newType: RecommendationType) => {
    setType(newType);
    // Auto-fill with template if available
    const templates = RECOMMENDATION_TEMPLATES[newType];
    if (templates.length > 0 && !message.trim()) {
      setMessage(templates[0]);
    }
  };

  const handleCycleSelect = (cycleId: MicrocycleId) => {
    setSelectedCycle(cycleId);
    if (type === "cycle_suggestion") {
      const cycle = MICROCYCLES[cycleId];
      setMessage(`Je te conseille de commencer le cycle ${cycle.label}. ${cycle.description}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Recommandation</Text>
              <Text style={styles.headerSub}>Pour {playerName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Type selection */}
            <Text style={styles.label}>Type de recommandation</Text>
            <View style={styles.typesRow}>
              {RECOMMENDATION_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => handleTypeSelect(t.id)}
                  style={[styles.typeChip, type === t.id && styles.typeChipActive]}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={16}
                    color={type === t.id ? theme.colors.white : palette.text}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      type === t.id && styles.typeChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cycle selection (if suggesting a cycle) */}
            {type === "cycle_suggestion" && (
              <>
                <Text style={styles.label}>Cycle suggéré</Text>
                <View style={styles.cyclesGrid}>
                  {(Object.keys(MICROCYCLES) as MicrocycleId[]).map((cycleId) => {
                    const cycle = MICROCYCLES[cycleId];
                    const isSelected = selectedCycle === cycleId;
                    return (
                      <TouchableOpacity
                        key={cycleId}
                        onPress={() => handleCycleSelect(cycleId)}
                        style={[
                          styles.cycleChip,
                          isSelected && styles.cycleChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cycleChipText,
                            isSelected && styles.cycleChipTextActive,
                          ]}
                        >
                          {cycle.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Message */}
            <Text style={styles.label}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Écris ton conseil pour le joueur..."
              placeholderTextColor={palette.sub}
              style={styles.textInput}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Quick templates */}
            {RECOMMENDATION_TEMPLATES[type].length > 0 && (
              <>
                <Text style={styles.labelSmall}>Suggestions</Text>
                {RECOMMENDATION_TEMPLATES[type].map((template, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setMessage(template)}
                    style={styles.templateChip}
                  >
                    <Text style={styles.templateText}>{template}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSend}
              disabled={sending || !message.trim()}
              style={[
                styles.sendButton,
                (sending || !message.trim()) && styles.sendButtonDisabled,
              ]}
            >
              {sending ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color={theme.colors.white} />
                  <Text style={styles.sendText}>Envoyer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.black50,
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: palette.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPE.subtitle.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  headerSub: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  scroll: {
    padding: 16,
  },
  label: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.text,
    marginBottom: 8,
    marginTop: 12,
  },
  labelSmall: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    color: palette.sub,
    marginBottom: 6,
    marginTop: 16,
  },
  typesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  typeChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  typeChipText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    color: palette.text,
  },
  typeChipTextActive: {
    color: theme.colors.white,
  },
  cyclesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cycleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  cycleChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  cycleChipText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    color: palette.text,
  },
  cycleChipTextActive: {
    color: theme.colors.white,
  },
  textInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: RADIUS.md,
    padding: 12,
    color: palette.text,
    backgroundColor: palette.card,
    minHeight: 100,
    fontSize: TYPE.body.fontSize,
  },
  templateChip: {
    padding: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: palette.cardSoft,
    marginBottom: 6,
  },
  templateText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cancelText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  sendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: palette.accent,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: theme.colors.white,
  },
});
