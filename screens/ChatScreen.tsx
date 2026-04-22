import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Pressable,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getEncryptedItem, setEncryptedItem, removeEncryptedItem } from "../services/encryptedStorage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "../services/firebase";
import { showToast } from "../utils/toast";
import { toDateKey } from "../utils/dateHelpers";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ModalContainer } from "../components/modal/ModalContainer";
import { Card } from "../components/ui/Card";
import { BACKEND_URL } from "../config/backend";
import { buildAIPromptContext } from "../services/aiContext";
import { useAppModeStore } from "../state/appModeStore";

type ChatRole = "user" | "assistant";
type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

const palette = theme.colors;

const MAX_INPUT_CHARS = 800;
const MAX_MESSAGES_PER_DAY = 25;
const SEND_COOLDOWN_MS = 1500;
const GUIDELINES_VERSION = 1;

const chatKey = (uid: string) => `fks_chat_v1:${uid}`;
const usageKey = (uid: string) => `fks_chat_usage_v1:${uid}`;
const guidelinesKey = (uid: string) => `fks_chat_guidelines_v${GUIDELINES_VERSION}:${uid}`;

const mkId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

type UsageState = { dayKey: string; count: number; lastSentAt: number };

const todayKey = () => toDateKey(new Date());

const extractReply = (data: any): string | null => {
  if (typeof data?.reply === "string") return data.reply;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.output === "string") return data.output;
  if (typeof data?.text === "string") return data.text;
  if (typeof data?.content === "string") return data.content;
  if (typeof data?.answer === "string") return data.answer;
  return null;
};

// Assistant avatar component
function AssistantAvatar({ size = 32 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[theme.colors.blue500, theme.colors.violet500]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.assistantAvatar, { width: size, height: size, borderRadius: RADIUS.pill }]}
    >
      <Ionicons name="sparkles" size={size * 0.5} color={theme.colors.white} />
    </LinearGradient>
  );
}

// Message bubble
function Bubble({ role, content }: { role: ChatRole; content: string }) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <View style={styles.userBubble}>
        <Text style={styles.userBubbleText}>{content}</Text>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <AssistantAvatar size={28} />
      <View style={styles.assistantBubble}>
        <Text style={styles.assistantBubbleText}>{content}</Text>
      </View>
    </View>
  );
}

// Quick suggestion chip
function SuggestionChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.suggestionChip, pressed && styles.chipPressed]}
    >
      <Ionicons name="chatbubble-outline" size={14} color={palette.accent} />
      <Text style={styles.suggestionText} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <View style={styles.assistantRow}>
      <AssistantAvatar size={28} />
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
        <Text style={styles.typingText}>Réflexion en cours…</Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const uid = auth.currentUser?.uid ?? null;
  const appMode = useAppModeStore((s) => s.mode) ?? "player";
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: mkId(),
      role: "assistant",
      content:
        "Salut ! Je suis ton assistant FKS. Pose-moi tes questions sur ton programme, ta forme, tes séances ou ta récupération.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);
  const [usage, setUsage] = useState<UsageState>({ dayKey: todayKey(), count: 0, lastSentAt: 0 });
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const ok = await AsyncStorage.getItem(guidelinesKey(uid));
        if (ok === "1") {
          setGuidelinesAccepted(true);
          return;
        }
        setGuidelinesAccepted(false);
        setShowGuidelines(true);
      } catch {
        setGuidelinesAccepted(false);
        setShowGuidelines(true);
      }
    })();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(usageKey(uid));
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return;
        const dayKey = typeof parsed.dayKey === "string" ? parsed.dayKey : todayKey();
        const count = typeof parsed.count === "number" ? parsed.count : 0;
        const lastSentAt = typeof parsed.lastSentAt === "number" ? parsed.lastSentAt : 0;
        const t = todayKey();
        setUsage(dayKey === t ? { dayKey, count, lastSentAt } : { dayKey: t, count: 0, lastSentAt: 0 });
      } catch {
        setUsage({ dayKey: todayKey(), count: 0, lastSentAt: 0 });
      }
    })();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        await AsyncStorage.setItem(usageKey(uid), JSON.stringify(usage));
      } catch {
        // ignore
      }
    })();
  }, [uid, usage]);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const raw = await getEncryptedItem(chatKey(uid));
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const safe = parsed
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map(
            (m) =>
              ({
                id: typeof m.id === "string" ? m.id : mkId(),
                role: m.role as ChatRole,
                content: String(m.content),
                createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
              }) satisfies ChatMessage
          );
        if (safe.length) setMessages(safe);
      } catch {
        // ignore
      }
    })();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        await setEncryptedItem(chatKey(uid), JSON.stringify(messages.slice(-50)));
      } catch {
        // ignore
      }
    })();
  }, [messages, uid]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const suggestions = useMemo(
    () =>
      appMode === "coach"
        ? [
            "Quels indicateurs surveiller ?",
            "Structurer une semaine match",
            "Explique la charge d'entraînement",
          ]
        : [
            "Qu'est-ce que je fais aujourd'hui ?",
            "Je suis fatigué, j'adapte ?",
            "J'ai match demain, je fais quoi ?",
          ],
    [appMode]
  );

  const canSend = useMemo(() => {
    const t = input.trim();
    return !!uid && guidelinesAccepted && !sending && t.length > 0 && t.length <= MAX_INPUT_CHARS;
  }, [guidelinesAccepted, input, sending, uid]);

  const remaining = useMemo(() => {
    const t = todayKey();
    const count = usage.dayKey === t ? usage.count : 0;
    return Math.max(0, MAX_MESSAGES_PER_DAY - count);
  }, [usage.count, usage.dayKey]);

  const clearChat = async () => {
    if (!uid) return;
    setMessages([
      {
        id: mkId(),
        role: "assistant",
        content: "Conversation effacée. Quelle est ta question ?",
        createdAt: Date.now(),
      },
    ]);
    try {
      await removeEncryptedItem(chatKey(uid));
    } catch (err) {
      if (__DEV__) console.warn("[Chat] clearChat storage error:", err);
    }
  };

  const openGuidelines = () => setShowGuidelines(true);
  const acceptGuidelines = async () => {
    if (!uid) return;
    try {
      await AsyncStorage.setItem(guidelinesKey(uid), "1");
    } catch (err) {
      if (__DEV__) console.warn("[Chat] acceptGuidelines storage error:", err);
    }
    setGuidelinesAccepted(true);
    setShowGuidelines(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!uid || !text || sending) return;
    if (!guidelinesAccepted) {
      setShowGuidelines(true);
      return;
    }
    if (text.length > MAX_INPUT_CHARS) {
      showToast({ type: "warn", title: "Message trop long", message: `Max ${MAX_INPUT_CHARS} caractères.` });
      return;
    }

    const day = todayKey();
    const countToday = usage.dayKey === day ? usage.count : 0;
    if (countToday >= MAX_MESSAGES_PER_DAY) {
      showToast({ type: "warn", title: "Limite atteinte", message: `Tu as atteint la limite (${MAX_MESSAGES_PER_DAY} messages/jour).` });
      return;
    }
    const now = Date.now();
    if (usage.lastSentAt && now - usage.lastSentAt < SEND_COOLDOWN_MS) {
      showToast({ type: "warn", title: "Doucement", message: "Attends une seconde avant d'envoyer un autre message." });
      return;
    }

    const nextUser: ChatMessage = { id: mkId(), role: "user", content: text, createdAt: Date.now() };
    setMessages((prev) => [...prev, nextUser]);
    setInput("");
    setSending(true);
    setUsage({ dayKey: day, count: countToday, lastSentAt: now });

    try {
      let context: any = null;
      try {
        context = await buildAIPromptContext();
      } catch {
        context = null;
      }

      const history = [...messages, nextUser]
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        // Backend refusera sans Firebase token (requireUserAuth strict).
        throw new Error("firebase_auth_required");
      }
      const r = await fetch(`${BACKEND_URL}/api/fks/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: uid,
          messages: history,
          context,
          meta: {
            tab: "assistant_chat",
            appMode,
            guidelinesVersion: GUIDELINES_VERSION,
            constraints: {
              scope: "FKS_training_assistant_only",
              medical: "not_a_medical_device",
              privacy: "avoid_personal_data_about_others",
            },
          },
        }),
      });

      if (!r.ok) {
        throw new Error(`Backend error ${r.status}`);
      }

      const data: any = await r.json();
      const reply = extractReply(data) ?? "Je n'ai pas compris la réponse du backend.";
      setMessages((prev) => [...prev, { id: mkId(), role: "assistant", content: reply, createdAt: Date.now() }]);
      setUsage((prev) => ({ ...prev, count: prev.count + 1 }));
    } catch (e: any) {
      if (__DEV__) console.error("[Chat] API error:", e?.message ?? e);
      showToast({ type: "error", title: "Erreur réseau", message: "Message non envoyé, réessaie." });
      setMessages((prev) => [
        ...prev,
        { id: mkId(), role: "assistant", content: "Une erreur est survenue, réessaie dans quelques instants.", createdAt: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!uid) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <AssistantAvatar size={64} />
          <Text style={styles.emptyTitle}>Assistant FKS</Text>
          <Text style={styles.emptySubtitle}>Connecte-toi pour utiliser l'assistant.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showSuggestions = messages.length <= 2 && !sending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AssistantAvatar size={40} />
            <View>
              <Text style={styles.headerTitle}>Assistant FKS</Text>
              <Text style={styles.headerSubtitle}>
                {remaining}/{MAX_MESSAGES_PER_DAY} messages restants
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={openGuidelines}
              style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            >
              <Ionicons name="information-circle-outline" size={22} color={palette.sub} />
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert("Nouvelle conversation", "Effacer l'historique ?", [
                  { text: "Annuler", style: "cancel" },
                  { text: "Effacer", style: "destructive", onPress: clearChat },
                ])
              }
              style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={20} color={palette.sub} />
            </Pressable>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.messageRow}>
              <Bubble role={item.role} content={item.content} />
            </View>
          )}
          ListHeaderComponent={
            showSuggestions ? (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Suggestions</Text>
                <View style={styles.suggestionsGrid}>
                  {suggestions.map((s) => (
                    <SuggestionChip key={s} label={s} onPress={() => setInput(s)} />
                  ))}
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            sending ? <TypingIndicator /> : <View style={styles.footerSpacer} />
          }
        />

        {/* Composer */}
        <View style={styles.composerContainer}>
          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={guidelinesAccepted ? "Pose ta question…" : "Accepte les règles pour commencer"}
              placeholderTextColor={palette.sub}
              style={styles.input}
              multiline
              maxLength={MAX_INPUT_CHARS}
            />
            <Pressable
              onPress={send}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.sendButton,
                !canSend && styles.sendDisabled,
                pressed && canSend && styles.pressed,
              ]}
            >
              <Ionicons name="arrow-up" size={20} color={theme.colors.white} />
            </Pressable>
          </View>
          <Text style={styles.composerHint}>
            {input.length}/{MAX_INPUT_CHARS} caractères
          </Text>
        </View>

        {/* Guidelines Modal — wrapped in native Modal for proper portal rendering in release builds (new arch) */}
        <Modal
          visible={showGuidelines}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => setShowGuidelines(false)}
        >
        <ModalContainer
          visible={showGuidelines}
          onClose={() => setShowGuidelines(false)}
          animationType="fade"
          blurIntensity={40}
          allowBackdropDismiss
          allowSwipeDismiss={false}
          showHandle={false}
          contentStyle={styles.modalContent}
        >
          <Card variant="surface" style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <AssistantAvatar size={48} />
              <Text style={styles.modalTitle}>Assistant FKS</Text>
              <Text style={styles.modalSubtitle}>Quelques règles avant de commencer</Text>
            </View>

            <View style={styles.rulesList}>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleIcon, { backgroundColor: theme.colors.green500Soft15 }]}>
                  <Ionicons name="fitness" size={16} color={theme.colors.green500} />
                </View>
                <Text style={styles.ruleText}>Questions sur ton programme, ta forme, ta récup uniquement</Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleIcon, { backgroundColor: theme.colors.redSoft15 }]}>
                  <Ionicons name="medical" size={16} color={theme.colors.red500} />
                </View>
                <Text style={styles.ruleText}>Pas un avis médical — consulte un pro si besoin</Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleIcon, { backgroundColor: theme.colors.blue500Soft15 }]}>
                  <Ionicons name="shield-checkmark" size={16} color={theme.colors.blue500} />
                </View>
                <Text style={styles.ruleText}>Tes données restent privées et sécurisées</Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleIcon, { backgroundColor: theme.colors.violetSoft15 }]}>
                  <Ionicons name="timer" size={16} color={theme.colors.violet500} />
                </View>
                <Text style={styles.ruleText}>{MAX_MESSAGES_PER_DAY} messages/jour • {MAX_INPUT_CHARS} car. max</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button label="C'est compris !" fullWidth onPress={acceptGuidelines} />
            </View>
          </Card>
        </ModalContainer>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  emptyTitle: { fontSize: TYPE.title.fontSize, fontWeight: "800", color: palette.text },
  emptySubtitle: { fontSize: TYPE.body.fontSize, color: palette.sub, textAlign: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
    backgroundColor: palette.bg,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: { fontSize: TYPE.subtitle.fontSize, fontWeight: "800", color: palette.text },
  headerSubtitle: { fontSize: TYPE.caption.fontSize, color: palette.sub, marginTop: 1 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  // Messages
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  messageRow: { marginBottom: 16 },
  footerSpacer: { height: 8 },

  // Bubbles
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    backgroundColor: palette.accent,
    borderRadius: RADIUS.xl,
    borderBottomRightRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userBubbleText: {
    fontSize: TYPE.body.fontSize,
    color: theme.colors.white,
    lineHeight: 22,
  },
  assistantRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  assistantAvatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  assistantBubble: {
    maxWidth: "80%",
    backgroundColor: palette.cardSoft,
    borderRadius: RADIUS.xl,
    borderBottomLeftRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  assistantBubbleText: {
    fontSize: TYPE.body.fontSize,
    color: palette.text,
    lineHeight: 22,
  },

  // Typing
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.cardSoft,
    borderRadius: RADIUS.xl,
    borderBottomLeftRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  typingDots: { flexDirection: "row", gap: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.xs,
    backgroundColor: palette.accent,
    opacity: 0.4,
  },
  dot1: { opacity: 0.8 },
  dot2: { opacity: 0.5 },
  dot3: { opacity: 0.3 },
  typingText: { fontSize: TYPE.caption.fontSize, color: palette.sub, fontStyle: "italic" },

  // Suggestions
  suggestionsContainer: {
    marginBottom: 20,
    gap: 12,
  },
  suggestionsTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    maxWidth: "100%",
  },
  chipPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  suggestionText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.text,
    fontWeight: "600",
    flexShrink: 1,
  },

  // Composer
  composerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
    backgroundColor: palette.bg,
    gap: 6,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: palette.cardSoft,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 18,
    paddingVertical: 12,
    paddingRight: 14,
    fontSize: TYPE.body.fontSize,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.xl,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  composerHint: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
    marginLeft: 4,
  },
  pressed: { opacity: 0.8 },

  // Modal
  modalContent: {
    alignSelf: "center",
    width: "92%",
    maxWidth: 400,
  },
  modalCard: {
    padding: 24,
    gap: 20,
    borderRadius: RADIUS.xl,
  },
  modalHeader: {
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  modalSubtitle: {
    fontSize: TYPE.body.fontSize,
    color: palette.sub,
    textAlign: "center",
  },
  rulesList: { gap: 14 },
  ruleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleText: {
    flex: 1,
    fontSize: TYPE.body.fontSize,
    color: palette.text,
    lineHeight: 20,
  },
  modalActions: { marginTop: 4 },
});
