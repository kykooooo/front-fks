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
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../services/firebase";
import { theme } from "../constants/theme";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
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

const MAX_INPUT_CHARS = 500;
const MAX_MESSAGES_PER_DAY = 30;
const SEND_COOLDOWN_MS = 2500;
const GUIDELINES_VERSION = 1;

const chatKey = (uid: string) => `fks_chat_v1:${uid}`;
const usageKey = (uid: string) => `fks_chat_usage_v1:${uid}`;
const guidelinesKey = (uid: string) => `fks_chat_guidelines_v${GUIDELINES_VERSION}:${uid}`;

const mkId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function Separator() {
  return <View style={styles.separator} />;
}

type UsageState = { dayKey: string; count: number; lastSentAt: number };

const todayKey = () => new Date().toISOString().slice(0, 10);

const extractReply = (data: any): string | null => {
  if (typeof data?.reply === "string") return data.reply;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.output === "string") return data.output;
  if (typeof data?.text === "string") return data.text;
  if (typeof data?.content === "string") return data.content;
  if (typeof data?.answer === "string") return data.answer;
  return null;
};

function Bubble({ role, content }: { role: ChatRole; content: string }) {
  const isUser = role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
      <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
        {content}
      </Text>
    </View>
  );
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
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
        "Je suis ton assistant FKS. Pose-moi tes questions sur ton programme, ta charge, tes séances, ta récup, etc.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);
  const [usage, setUsage] = useState<UsageState>({ dayKey: todayKey(), count: 0, lastSentAt: 0 });
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

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
        const raw = await AsyncStorage.getItem(chatKey(uid));
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
        await AsyncStorage.setItem(chatKey(uid), JSON.stringify(messages.slice(-50)));
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
            "Quels indicateurs surveiller pour éviter le surmenage ?",
            "Comment structurer une semaine avec match le samedi ?",
            "Quelles questions poser après une séance ?",
            "Explique-moi ATL/CTL/TSB simplement",
          ]
        : [
            "Qu’est-ce que je fais aujourd’hui ?",
            "Je suis fatigué, j’adapte comment ?",
            "Explique-moi la séance IA en 3 points",
            "Je dois jouer demain, je fais quoi ?",
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

  const quotaTone = useMemo(() => {
    if (remaining <= 3) return "danger";
    if (remaining <= 8) return "warn";
    return "default";
  }, [remaining]);

  const clearChat = async () => {
    if (!uid) return;
    setMessages([
      {
        id: mkId(),
        role: "assistant",
        content: "Ok. On repart de zéro. Quelle est ta question ?",
        createdAt: Date.now(),
      },
    ]);
    try {
      await AsyncStorage.removeItem(chatKey(uid));
    } catch {}
  };

  const openGuidelines = () => setShowGuidelines(true);
  const acceptGuidelines = async () => {
    if (!uid) return;
    try {
      await AsyncStorage.setItem(guidelinesKey(uid), "1");
    } catch {}
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
      Alert.alert("Message trop long", `Max ${MAX_INPUT_CHARS} caractères.`);
      return;
    }

    const day = todayKey();
    const countToday = usage.dayKey === day ? usage.count : 0;
    if (countToday >= MAX_MESSAGES_PER_DAY) {
      Alert.alert("Limite atteinte", `Tu as atteint la limite (${MAX_MESSAGES_PER_DAY} messages/jour).`);
      return;
    }
    const now = Date.now();
    if (usage.lastSentAt && now - usage.lastSentAt < SEND_COOLDOWN_MS) {
      Alert.alert("Doucement", "Attends une seconde avant d’envoyer un autre message.");
      return;
    }

    const nextUser: ChatMessage = { id: mkId(), role: "user", content: text, createdAt: Date.now() };
    setMessages((prev) => [...prev, nextUser]);
    setInput("");
    setSending(true);
    setUsage({ dayKey: day, count: countToday + 1, lastSentAt: now });

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

      const r = await fetch(`${BACKEND_URL}/api/fks/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const reply = extractReply(data) ?? "Je n’ai pas compris la réponse du backend.";
      setMessages((prev) => [...prev, { id: mkId(), role: "assistant", content: reply, createdAt: Date.now() }]);
    } catch (e: any) {
      const msg =
        typeof e?.message === "string"
          ? e.message
          : "Impossible d’envoyer le message (réseau/backend).";
      setMessages((prev) => [
        ...prev,
        { id: mkId(), role: "assistant", content: `Erreur: ${msg}`, createdAt: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!uid) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Assistant</Text>
          <Text style={styles.sub}>Connecte-toi pour utiliser le chat.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.header}>
          <Card variant="surface" style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <Ionicons name="chatbubble-ellipses" size={18} color={palette.accent} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.heroTitle}>Assistant</Text>
                <Text style={styles.heroSub}>Onglet Assistant • rôle : {appMode === "coach" ? "Coach" : "Joueur"}</Text>
              </View>
              <Badge label={`${remaining}/${MAX_MESSAGES_PER_DAY}`} tone={quotaTone as any} />
              <Pressable onPress={openGuidelines} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
                <Ionicons name="information-circle" size={18} color={palette.sub} />
              </Pressable>
              <Button
                label="Reset"
                variant="ghost"
                size="sm"
                onPress={() =>
                  Alert.alert("Réinitialiser", "Effacer la conversation ?", [
                    { text: "Annuler", style: "cancel" },
                    { text: "Effacer", style: "destructive", onPress: clearChat },
                  ])
                }
              />
            </View>
          </Card>

          <View style={styles.section}>
            <SectionHeader title="Questions rapides" />
            <View style={styles.chipsRow}>
              {suggestions.map((s) => (
                <QuickChip key={s} label={s} onPress={() => setInput(s)} />
              ))}
            </View>
          </View>
        </View>

        <FlatList
          ref={(r) => {
            listRef.current = r;
          }}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => (
            <View style={[styles.row, item.role === "user" ? styles.rowUser : styles.rowAssistant]}>
              <Bubble role={item.role} content={item.content} />
            </View>
          )}
          ListFooterComponent={
            sending ? (
              <View style={[styles.row, styles.rowAssistant]}>
                <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                  <ActivityIndicator color={palette.accent} />
                  <Text style={styles.typingText}>Réflexion…</Text>
                </View>
              </View>
            ) : (
              <View style={styles.footerSpacer} />
            )
          }
        />

        <Card variant="surface" style={styles.composer}>
          <View style={styles.flex1}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={guidelinesAccepted ? "Question sur ton programme FKS…" : "Lis les règles pour commencer…"}
              placeholderTextColor={palette.sub}
              style={styles.input}
              multiline
              maxLength={MAX_INPUT_CHARS}
            />
            <Text style={styles.counter}>
              {Math.min(MAX_INPUT_CHARS, input.length)}/{MAX_INPUT_CHARS} • {remaining} restant(s) aujourd’hui
            </Text>
          </View>
          <Pressable
            onPress={send}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.send,
              !canSend && styles.sendDisabled,
              pressed && canSend ? styles.pressed : null,
            ]}
          >
            <Ionicons name="arrow-up" size={18} color={palette.text} />
          </Pressable>
        </Card>

        <Modal visible={showGuidelines} transparent animationType="fade" onRequestClose={() => setShowGuidelines(false)}>
          <View style={styles.modalBackdrop}>
            <Card variant="surface" style={styles.modalCard}>
              <Text style={styles.modalTitle}>Assistant FKS — règles</Text>
              <Text style={styles.modalSub}>
                Pour garder l’expérience propre (et éviter l’abus), l’assistant est limité et orienté “programme”.
              </Text>

              <View style={styles.rules}>
                <Text style={styles.rule}>• Objectif : répondre à des questions sur ton programme, ta charge, ta récup.</Text>
                <Text style={styles.rule}>• Pas un avis médical : en cas de blessure/douleur importante → pro de santé.</Text>
                <Text style={styles.rule}>• Confidentialité : ne partage pas d’infos perso sur d’autres joueurs.</Text>
                <Text style={styles.rule}>• Messages : {MAX_MESSAGES_PER_DAY}/jour et {MAX_INPUT_CHARS} caractères max.</Text>
              </View>

              <View style={styles.modalActions}>
                <Button label="J’ai compris" fullWidth onPress={acceptGuidelines} />
                <Button
                  label="Plus tard"
                  fullWidth
                  variant="secondary"
                  onPress={() => {
                    setShowGuidelines(false);
                    setGuidelinesAccepted(false);
                  }}
                />
              </View>
            </Card>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 8 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 12 },
  heroCard: { padding: 14, overflow: "hidden" },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.95,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  heroTitle: { fontSize: 18, fontWeight: "900", color: palette.text },
  heroSub: { fontSize: 12, color: palette.sub, marginTop: 2 },
  title: { fontSize: 20, fontWeight: "900", color: palette.text },
  sub: { fontSize: 13, color: palette.sub, marginTop: 2 },
  section: { gap: 8 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  chipText: { color: palette.text, fontSize: 12, fontWeight: "600" },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: 16, paddingBottom: 12 },
  separator: { height: 10 },
  footerSpacer: { height: 6 },
  row: { flexDirection: "row" },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "86%",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  bubbleUser: { backgroundColor: palette.accent, borderColor: palette.accent },
  bubbleAssistant: { backgroundColor: palette.cardSoft, borderColor: palette.borderSoft },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: palette.text, fontWeight: "600" },
  bubbleTextAssistant: { color: palette.text },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText: { color: palette.sub, fontSize: 13, fontWeight: "600" },
  composer: {
    margin: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    minHeight: 40,
    maxHeight: 120,
    color: palette.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  counter: { color: palette.sub, fontSize: 11, marginTop: 6 },
  send: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 86,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: { color: palette.text, fontWeight: "800" },
  pressed: { opacity: 0.85 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: { width: "100%", maxWidth: 520, padding: 16, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: palette.text },
  modalSub: { fontSize: 13, color: palette.sub, lineHeight: 18 },
  rules: { gap: 8, marginTop: 4 },
  rule: { fontSize: 13, color: palette.text, lineHeight: 18 },
  modalActions: { gap: 10, marginTop: 8 },
});
