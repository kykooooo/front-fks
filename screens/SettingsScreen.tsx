// screens/SettingsScreen.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  DevSettings,
} from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SectionHeader } from "../components/ui/SectionHeader";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useFeedbackStore } from "../state/stores/useFeedbackStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { useSettingsStore, type SettingsState } from "../state/settingsStore";
import { useAppModeStore, type AppMode } from "../state/appModeStore";
import { DEV_FLAGS } from "../config/devFlags";
import { ClubManagementCard } from "../components/settings/ClubManagementCard";
import { showToast } from "../utils/toast";
import {
  saveNotifPrefs,
  scheduleAllNotifications,
  cancelAllScheduled,
  registerForPushNotifications,
} from "../services/notifications";

const palette = theme.colors;
type SegmentedOption = {
  value: string;
  label: string;
};

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SegmentedOption[];
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentChip, selected && styles.segmentChipActive]}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.segmentText, selected && styles.segmentTextActive]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SettingRow({
  title,
  subtitle,
  right,
  showDivider = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showDivider?: boolean;
}) {
  return (
    <View>
      <View style={styles.settingRow}>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.settingRight}>{right}</View> : null}
      </View>
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const nav = useNavigation<any>();
  const resetTrainingStore = useSyncStore((s) => s.resetForUser);
  const resetLoadMetrics = useLoadStore((s) => s.resetLoadMetrics);
  const ignoreFatigueCap = useLoadStore((s) => s.ignoreFatigueCap);
  const setIgnoreFatigueCap = useLoadStore((s) => s.setIgnoreFatigueCap);
  const autoExternalEnabled = useExternalStore((s) => s.autoExternalEnabled);
  const setAutoExternalEnabled = useExternalStore((s) => s.setAutoExternalEnabled);
  const settings = useSettingsStore((s) => s);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const mode = useAppModeStore((s) => s.mode);
  const setModeForUid = useAppModeStore((s) => s.setModeForUid);
  const clearModeForUid = useAppModeStore((s) => s.clearForUid);

  const initials = useMemo(() => {
    const name =
      auth.currentUser?.displayName ||
      auth.currentUser?.email ||
      "Utilisateur";
    return name
      .split(" ")
      .map((part: string) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert(
      "Réinitialiser les préférences",
      "Tu veux revenir aux réglages par défaut ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Oui, reset",
          style: "destructive",
          onPress: () => resetSettings(),
        },
      ]
    );
  }, [resetSettings]);

  const handleResetLoad = useCallback(() => {
    Alert.alert(
      "Réinitialiser la charge",
      "Remet ta charge d'entraînement à zéro et efface les charges externes locales.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Oui, reset",
          style: "destructive",
          onPress: () => resetLoadMetrics(),
        },
      ]
    );
  }, [resetLoadMetrics]);

  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        load: (() => {
          const { setManualLoad, resetLoadMetrics, setIgnoreFatigueCap, getResilience, computeLoadDeltas, advanceDays, restUntil, ...rest } = useLoadStore.getState();
          return rest;
        })(),
        sessions: (() => {
          const { pushSession, setPhase, updateWeekly, getSessionById, latestSessionId, setMicrocycleGoal, setMicrocycleSessionIndex, setActivePathway, setLastAiContext, setLastAiSessionV2, completeSession, ...rest } = useSessionsStore.getState();
          return rest;
        })(),
        feedback: (() => {
          const { getPrevFatigueSmoothed, setDailyFeedback, setInjury, getAdaptiveFactorsForDate, ...rest } = useFeedbackStore.getState();
          return rest;
        })(),
        external: (() => {
          const { addCompletedRoutine, toggleFavoriteExercise, addRecentExercise, setClubTrainingDays, setMatchDays, setAutoExternalEnabled, ...rest } = useExternalStore.getState();
          return rest;
        })(),
        settings: useSettingsStore.getState(),
      };
      const json = JSON.stringify(data, null, 2);
      const fileName = `fks-export-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File(Paths.cache, fileName);
      file.write(json);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Exporter mes données FKS" });
      } else {
        showToast({ type: "warn", title: "Export", message: "Le partage n'est pas disponible sur cet appareil." });
      }
    } catch (err) {
      if (__DEV__) console.warn("[Settings] Export error:", err);
      showToast({ type: "error", title: "Export", message: "Échec de l'export. Réessaie." });
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const handleLogout = useCallback(async () => {
    try {
      const uid = auth.currentUser?.uid ?? null;
      await signOut(auth);
      resetTrainingStore(null);
      if (uid) {
        await clearModeForUid(uid);
      }
    } catch {
      showToast({ type: "error", title: "Déconnexion", message: "Échec de la déconnexion. Réessaie." });
    }
  }, [clearModeForUid, resetTrainingStore]);

  const triggerReload = useCallback(async () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    try {
      await Updates.reloadAsync();
    } catch {
      // reloadAsync peut échouer en dev ou si expo-updates n'est pas configuré
      if (DevSettings?.reload) {
        DevSettings.reload();
        return;
      }
      showToast({ type: "info", title: "Redémarrage requis", message: "Ferme et rouvre l'app pour appliquer le thème." });
    }
  }, []);

  const handleThemeChange = useCallback(
    (nextMode: SettingsState["themeMode"]) => {
      if (nextMode === settings.themeMode) return;
      updateSettings({ themeMode: nextMode });
      Alert.alert(
        "Appliquer le thème",
        "Le thème clair/sombre nécessite un redémarrage pour être appliqué partout.",
        [
          { text: "Plus tard", style: "cancel" },
          {
            text: "Appliquer maintenant",
            onPress: () => triggerReload(),
          },
        ]
      );
    },
    [settings.themeMode, updateSettings, triggerReload]
  );

  const handleModeChange = useCallback(
    async (next: string) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      if (next !== "player" && next !== "coach") return;
      await setModeForUid(uid, next as AppMode);
      nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
    },
    [nav, setModeForUid]
  );

  const handleNotificationsToggle = useCallback(
    async (value: boolean) => {
      updateSettings({ notificationsEnabled: value });
      try {
        await saveNotifPrefs({ enabled: value });
        if (value) {
          await registerForPushNotifications();
          await scheduleAllNotifications();
        } else {
          await cancelAllScheduled();
        }
      } catch {
        updateSettings({ notificationsEnabled: !value });
        showToast({ type: "error", title: "Notifications", message: "Impossible de mettre à jour les notifications." });
      }
    },
    [updateSettings]
  );

  const handleSessionReminderToggle = useCallback(
    async (value: boolean) => {
      updateSettings({ sessionReminders: value });
      try {
        await saveNotifPrefs({ sessionReminder: value });
        await scheduleAllNotifications();
      } catch {
        updateSettings({ sessionReminders: !value });
        showToast({ type: "error", title: "Rappel séance", message: "Impossible de mettre à jour les rappels." });
      }
    },
    [updateSettings]
  );

  return (
    <ScreenContainer contentContainerStyle={styles.container}>
        <Card variant="surface" style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Paramètres</Text>
              <Text style={styles.heroSubtitle}>
                Personnalise ton expérience FKS
              </Text>
            </View>
            <Badge label="Local" />
          </View>
          <View style={styles.heroQuick}>
            <Badge
              label={settings.notificationsEnabled ? "Notifs activées" : "Notifs coupées"}
              tone={settings.notificationsEnabled ? "ok" : "default"}
            />
            <Badge
              label={settings.hapticsEnabled ? "Vibrations actives" : "Vibrations coupées"}
              tone={settings.hapticsEnabled ? "ok" : "default"}
            />
            <Badge
              label={settings.soundsEnabled ? "Sons actifs" : "Sons coupés"}
              tone={settings.soundsEnabled ? "ok" : "default"}
            />
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Compte" />
          <Card variant="soft" style={styles.sectionCard}>
            <SettingRow
              title="Identité"
              subtitle={auth.currentUser?.email ?? "Compte FKS"}
              right={<Badge label={auth.currentUser?.displayName ? "Vérifié" : "Standard"} />}
            />
            <SettingRow
              title="Mode"
              subtitle="Basculer entre joueur et coach"
              right={
                <SegmentedControl
                  value={mode ?? "player"}
                  options={[
                    { value: "player", label: "Joueur" },
                    { value: "coach", label: "Coach" },
                  ]}
                  onChange={handleModeChange}
                />
              }
            />
            <SettingRow
              title="Profil joueur"
              subtitle="Poste, niveau, objectif, équipements"
              right={
                <Button
                  label="Modifier"
                  size="sm"
                  variant="secondary"
                  onPress={() => nav.navigate("ProfileSetup")}
                />
              }
            />
            <SettingRow
              title="Déconnexion"
              subtitle="Se déconnecter de l'application"
              right={
                <Button
                  label="Se déconnecter"
                  size="sm"
                  variant="ghost"
                  onPress={handleLogout}
                />
              }
              showDivider={false}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Club" />
          <ClubManagementCard />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Préférences" />
          <Card variant="soft" style={styles.sectionCard}>
            <SettingRow
              title="Charges externes auto"
              subtitle="Ajoute club/match automatiquement"
              right={
                <Switch
                  value={autoExternalEnabled}
                  onValueChange={(value) => setAutoExternalEnabled(value)}
                  trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                  thumbColor={autoExternalEnabled ? palette.accent : palette.textMuted}
                />
              }
            />
            <SettingRow
              title="Notifications"
              subtitle="Activer les alertes et rappels"
              right={
                <Switch
                  value={settings.notificationsEnabled}
                  onValueChange={handleNotificationsToggle}
                  trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                  thumbColor={settings.notificationsEnabled ? palette.accent : palette.textMuted}
                />
              }
            />
            <SettingRow
              title="Rappel séance"
              subtitle={
                settings.notificationsEnabled
                  ? "Push auto avant la séance du jour"
                  : "Active les notifications pour déverrouiller."
              }
              right={
                <Switch
                  value={settings.sessionReminders}
                  onValueChange={handleSessionReminderToggle}
                  trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                  thumbColor={settings.sessionReminders ? palette.accent : palette.textMuted}
                  disabled={!settings.notificationsEnabled}
                />
              }
            />
            <SettingRow
              title="Stratégie rappel"
              subtitle="Quand prévenir avant la séance"
              right={
                <SegmentedControl
                  value={settings.reminderStrategy}
                  options={[
                    { value: "prev_evening", label: "Veille 20h" },
                    { value: "same_morning", label: "Jour 9h" },
                    { value: "two_hours", label: "2h avant" },
                  ]}
                  onChange={(value) =>
                    updateSettings({
                      reminderStrategy: value as SettingsState["reminderStrategy"],
                    })
                  }
                />
              }
            />
            <SettingRow
              title="Sons"
              subtitle="Bips et signaux audio en séance"
              right={
                <Switch
                  value={settings.soundsEnabled}
                  onValueChange={(value) => updateSettings({ soundsEnabled: value })}
                  trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                  thumbColor={settings.soundsEnabled ? palette.accent : palette.textMuted}
                />
              }
            />
            <SettingRow
              title="Vibrations"
              subtitle="Haptics sur fin de repos et transitions"
              right={
                <Switch
                  value={settings.hapticsEnabled}
                  onValueChange={(value) => updateSettings({ hapticsEnabled: value })}
                  trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                  thumbColor={settings.hapticsEnabled ? palette.accent : palette.textMuted}
                />
              }
            />
            <SettingRow
              title="Objectif FKS hebdo"
              subtitle="Nombre de séances FKS par semaine"
              right={
                <SegmentedControl
                  value={String(settings.weeklyGoal)}
                  options={[
                    { value: "1", label: "1" },
                    { value: "2", label: "2" },
                    { value: "3", label: "3" },
                    { value: "4", label: "4" },
                  ]}
                  onChange={(value) =>
                    updateSettings({ weeklyGoal: Number(value) })
                  }
                />
              }
            />
            <SettingRow
              title="Feedback auto"
              subtitle="Ouvrir le feedback en fin de séance"
              right={
                <Switch
                  value={settings.autoFeedbackEnabled}
                  onValueChange={(value) =>
                    updateSettings({ autoFeedbackEnabled: value })
                  }
                  trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                  thumbColor={settings.autoFeedbackEnabled ? palette.accent : palette.textMuted}
                />
              }
              showDivider={false}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Apparence" />
          <Card variant="soft" style={styles.sectionCard}>
            <SettingRow
              title="Thème"
              subtitle="Clair ou sombre"
              right={
                <SegmentedControl
                  value={settings.themeMode}
                  options={[
                    { value: "light", label: "Clair" },
                    { value: "dark", label: "Sombre" },
                  ]}
                  onChange={(value) =>
                    handleThemeChange(value as SettingsState["themeMode"])
                  }
                />
              }
              showDivider={false}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Unités & formats" />
          <Card variant="soft" style={styles.sectionCard}>
            <SettingRow
              title="Distance"
              subtitle="Km ou miles"
              right={
                <SegmentedControl
                  value={settings.distanceUnit}
                  options={[
                    { value: "km", label: "km" },
                    { value: "mi", label: "mi" },
                  ]}
                  onChange={(value) =>
                    updateSettings({ distanceUnit: value as SettingsState["distanceUnit"] })
                  }
                />
              }
            />
            <SettingRow
              title="Poids"
              subtitle="Kg ou livres"
              right={
                <SegmentedControl
                  value={settings.weightUnit}
                  options={[
                    { value: "kg", label: "kg" },
                    { value: "lb", label: "lb" },
                  ]}
                  onChange={(value) =>
                    updateSettings({ weightUnit: value as SettingsState["weightUnit"] })
                  }
                />
              }
            />
            <SettingRow
              title="Semaine"
              subtitle="Jour de début"
              right={
                <SegmentedControl
                  value={settings.weekStart}
                  options={[
                    { value: "mon", label: "Lun" },
                    { value: "sun", label: "Dim" },
                  ]}
                  onChange={(value) =>
                    updateSettings({ weekStart: value as SettingsState["weekStart"] })
                  }
                />
              }
              showDivider={false}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Confidentialité" />
          <Card variant="soft" style={styles.sectionCard}>
            <SettingRow
              title="Mode privé"
              subtitle="Masquer le nom et les infos visibles"
              right={
                <Switch
                  value={settings.privateMode}
                  onValueChange={(value) => updateSettings({ privateMode: value })}
                  trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                  thumbColor={settings.privateMode ? palette.accent : palette.textMuted}
                />
              }
            />
            <SettingRow
              title="Données anonymisées"
              subtitle="Aider à améliorer FKS"
              right={
                <Switch
                  value={settings.privacyAnalytics}
                  onValueChange={(value) => updateSettings({ privacyAnalytics: value })}
                  trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                  thumbColor={settings.privacyAnalytics ? palette.accent : palette.textMuted}
                />
              }
            />
            <SettingRow
              title="Mentions légales"
              subtitle="Éditeur, hébergement, contact"
              right={
                <Button
                  label="Voir"
                  size="sm"
                  variant="secondary"
                  onPress={() => nav.navigate("LegalNotice")}
                />
              }
            />
            <SettingRow
              title="Politique de confidentialité"
              subtitle="Données collectées, usage, droits"
              right={
                <Button
                  label="Voir"
                  size="sm"
                  variant="secondary"
                  onPress={() => nav.navigate("PrivacyPolicy")}
                />
              }
              showDivider={false}
            />
          </Card>
        </View>

        {DEV_FLAGS.ENABLED && (
          <View style={styles.section}>
            <SectionHeader title="Debug" />
            <Card variant="soft" style={styles.sectionCard}>
              <SettingRow
                title="Ignorer fatigue (debug)"
                subtitle="Désactive le cap fatigue côté backend"
                right={
                  <Switch
                    value={ignoreFatigueCap}
                    onValueChange={(value) => setIgnoreFatigueCap(value)}
                    trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                    thumbColor={ignoreFatigueCap ? palette.accent : palette.textMuted}
                  />
                }
              />
              <SettingRow
                title="Reset charge"
                subtitle="Charge d'entraînement + charges externes"
                right={
                  <Button
                    label="Reset"
                    size="sm"
                    variant="ghost"
                    onPress={handleResetLoad}
                  />
                }
                showDivider={false}
              />
            </Card>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="Données & support" />
          <Card variant="soft" style={styles.sectionCard}>
            <SettingRow
              title="Exporter mes données"
              subtitle="Fichier JSON de toutes tes données"
              right={
                <Button
                  label="Exporter"
                  size="sm"
                  variant="secondary"
                  onPress={handleExport}
                />
              }
            />
            <SettingRow
              title="Réinitialiser préférences"
              subtitle="Revenir aux réglages par défaut"
              right={
                <Button
                  label="Reset"
                  size="sm"
                  variant="ghost"
                  onPress={handleReset}
                />
              }
              showDivider={false}
            />
          </Card>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>FKS · v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
        </View>
      </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, gap: 16 },
  section: { gap: 8 },
  sectionCard: { padding: 14, gap: 6 },

  heroCard: { padding: 16, gap: 12, overflow: "hidden" },
  heroGlow: {
    position: "absolute",
    top: -50,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  avatarText: { color: palette.text, fontSize: TYPE.subtitle.fontSize, fontWeight: "800" },
  heroTitle: { color: palette.text, fontSize: TYPE.subtitle.fontSize, fontWeight: "800" },
  heroSubtitle: { color: palette.sub, fontSize: TYPE.caption.fontSize, marginTop: 2 },
  heroQuick: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingText: { flex: 1 },
  settingTitle: { color: palette.text, fontSize: TYPE.caption.fontSize, fontWeight: "600" },
  settingSubtitle: { color: palette.sub, fontSize: TYPE.micro.fontSize, marginTop: 2 },
  settingRight: { alignItems: "flex-end" },
  rowDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginVertical: 10,
  },

  segmentRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  segmentChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  segmentChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  segmentText: { color: palette.sub, fontSize: TYPE.micro.fontSize, fontWeight: "600" },
  segmentTextActive: { color: palette.accent },

  footer: { alignItems: "center", paddingBottom: 12 },
  footerText: { color: palette.sub, fontSize: TYPE.micro.fontSize },
});
