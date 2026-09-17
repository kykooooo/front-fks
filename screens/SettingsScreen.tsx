// screens/SettingsScreen.tsx
//
// PARAMÈTRES — chaque ligne visible produit l'effet qu'elle annonce.
//
// Cinq groupes, dans l'ordre où un joueur les cherche :
//   Mon compte · Notifications · Préférences de l'application ·
//   Données et confidentialité · Aide et informations.
//
// Ce qui a été RETIRÉ de l'écran (2026-09), et pourquoi :
//   - « Mode privé », « Distance km/mi », « Poids kg/lb » : aucun consommateur,
//     aucune conversion — des interrupteurs qui ne faisaient rien. Les valeurs
//     persistées restent dans le store (dépréciées), rien n'est effacé.
//   - le badge « Vérifié » : il dépendait d'un `displayName`, pas d'une
//     vérification de compte.
//   - « Sons » en natif : le bip de repos n'existe que sur le web (AudioContext),
//     la ligne n'apparaît donc que là.
//   - la carte d'en-tête décorative et ses badges d'état (« Local », etc.).
//
// RÉGLAGES DU JOUEUR vs RÉGLAGES DE L'APPAREIL : l'objectif hebdo est une donnée
// du joueur (Firestore, via services/objectifHebdo) et vit sous « Mon compte » ;
// tout le reste est une préférence de CE téléphone (store de réglages, non lié
// au compte) — « Réinitialiser » ne touche que ces dernières, et jamais la
// préférence de collecte (cf. RESET_PRESERVED_KEYS).

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useFeedbackStore } from "../state/stores/useFeedbackStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { lireBlessures } from "../state/selectors/blessures";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useSettingsStore, type SettingsState } from "../state/settingsStore";
import { resoudreObjectifHebdo } from "../domain/resumeCanonique";
import { enregistrerObjectifHebdo } from "../services/objectifHebdo";
import { setAnalyticsEnabled } from "../services/analytics";
import { DEV_FLAGS } from "../config/devFlags";
import { showToast } from "../utils/toast";
import { buildLocalExport, nomFichierExport } from "../utils/exportLocal";
import { SESSION_REMINDER_TIME } from "../services/notifications";
import { purgeNotifications, reconcileNotifications } from "../services/notificationSync";

const palette = theme.colors;

/** Adresse déjà utilisée par les écrans d'inscription et de suppression de compte. */
export const SUPPORT_EMAIL = "kyllian@fks-app.com";

const heureRappel = `${SESSION_REMINDER_TIME.hour}h${String(SESSION_REMINDER_TIME.minute).padStart(2, "0")}`;

type SegmentedOption = { value: string; label: string };

function SegmentedControl({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: string;
  options: SegmentedOption[];
  onChange: (next: string) => void;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.segmentRow} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentChip, selected && styles.segmentChipActive]}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.label}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]} maxFontSizeMultiplier={1.4}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Une ligne de réglage. Avec `onPress`, TOUTE la ligne est tapable (chevron à
 * droite) : pas de petit bouton « Voir » à viser.
 */
function SettingRow({
  title,
  subtitle,
  right,
  onPress,
  danger = false,
  showDivider = true,
  accessibilityLabel,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  showDivider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const contenu = (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]} maxFontSizeMultiplier={1.6}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.settingSubtitle} maxFontSizeMultiplier={1.6}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.settingRight}>{right}</View> : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={danger ? palette.danger : palette.sub} />
      ) : null}
    </View>
  );
  return (
    <View>
      {onPress ? (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          accessibilityHint={subtitle}
          testID={testID}
          style={styles.settingTouch}
        >
          {contenu}
        </TouchableOpacity>
      ) : (
        <View testID={testID}>{contenu}</View>
      )}
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
      thumbColor={value ? palette.accent : palette.textMuted}
      accessibilityLabel={accessibilityLabel}
    />
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

  // ─── Notifications : ce que le téléphone a répondu la dernière fois ───
  // `denied` n'est posé que sur un refus RÉEL du système (jamais sur un token
  // absent) : c'est ce qui change le sous-titre de la ligne.
  const [permissionRefusee, setPermissionRefusee] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // L'OBJECTIF HEBDO — LE CHAMP CANONIQUE, PAS LE REGLAGE LOCAL
  //
  // Ce curseur edite `users/{uid}.targetFksSessionsPerWeek`, lecture ET
  // ecriture, avec la meme persistance que le setup. Voir services/objectifHebdo.ts.
  // ───────────────────────────────────────────────────────────────────────────
  const targetFksSessionsPerWeek = useExternalStore((s) => s.targetFksSessionsPerWeek);
  const objectifHebdo = resoudreObjectifHebdo({
    targetFksSessionsPerWeek,
    weeklyGoalReglage: settings.weeklyGoal,
  });

  const changerObjectifHebdo = useCallback(async (valeur: string) => {
    const issue = await enregistrerObjectifHebdo(Number(valeur));
    if (issue === "refuse") {
      showToast({ type: "error", title: "Objectif non enregistré", message: "Réessaie dans un instant." });
    } else if (issue === "hors-ligne") {
      showToast({ type: "info", title: "Objectif enregistré", message: "Il sera synchronisé à la reconnexion." });
    }
  }, []);

  // ─── Notifications ───
  const handleNotificationsToggle = useCallback(
    async (value: boolean) => {
      const previous = {
        notificationsEnabled: settings.notificationsEnabled,
        sessionReminders: settings.sessionReminders,
      };
      updateSettings({ notificationsEnabled: value });
      try {
        // Une seule coordination (services/notificationSync) : elle relit le
        // store et le compte courants, périme toute opération en vol, et ne
        // demande la permission que pour une bascule ON.
        const result = await reconcileNotifications({ requestPermission: value });
        if (result.status === "failed") throw result.error;
        if (result.status === "cancelled" && result.reason === "permission-denied") {
          // Le joueur veut, le téléphone refuse : on ne laisse pas un
          // interrupteur ON sur des notifications qui ne partiront jamais.
          updateSettings({ notificationsEnabled: false });
          setPermissionRefusee(true);
          showToast({
            type: "warn",
            title: "Notifications bloquées",
            message: "Autorise FKS dans les réglages de ton téléphone, puis réactive-les ici.",
          });
          return;
        }
        if (value) setPermissionRefusee(false);
      } catch {
        updateSettings(previous);
        showToast({ type: "error", title: "Notifications", message: "Impossible de mettre à jour les notifications." });
      }
    },
    [settings.notificationsEnabled, settings.sessionReminders, updateSettings],
  );

  const handleSessionReminderToggle = useCallback(
    async (value: boolean) => {
      updateSettings({ sessionReminders: value });
      try {
        const result = await reconcileNotifications();
        if (result.status === "failed") throw result.error;
      } catch {
        updateSettings({ sessionReminders: !value });
        showToast({ type: "error", title: "Rappel de séance", message: "Impossible de mettre à jour le rappel." });
      }
    },
    [updateSettings],
  );

  // ─── Statistiques d'utilisation ───
  const handleAnalyticsToggle = useCallback(
    (value: boolean) => {
      updateSettings({ privacyAnalytics: value });
      // Appliqué tout de suite au SDK (opt-out), pas seulement au prochain démarrage.
      setAnalyticsEnabled(value);
    },
    [updateSettings],
  );

  // ─── Réinitialiser les préférences de l'appareil ───
  const handleReset = useCallback(() => {
    Alert.alert(
      "Réinitialiser les préférences",
      "Revenir aux réglages par défaut de l'application sur ce téléphone ? Ton compte, ton profil, tes séances et ton choix sur les statistiques d'utilisation ne bougent pas.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          style: "destructive",
          onPress: async () => {
            resetSettings();
            // Les rappels suivent la préférence remise par défaut (ON) — mais
            // seulement si le téléphone l'autorise. Sinon le réglage repasse à
            // OFF tout de suite : jamais un interrupteur ON pour rien.
            try {
              const result = await reconcileNotifications({
                onPermissionDenied: () => {
                  updateSettings({ notificationsEnabled: false });
                  setPermissionRefusee(true);
                },
              });
              if (result.status === "failed") throw result.error;
              showToast({ type: "success", title: "Préférences réinitialisées", message: "Réglages de l'appareil remis par défaut." });
            } catch {
              showToast({
                type: "warn",
                title: "Préférences réinitialisées",
                message: "Les rappels n'ont pas pu être reprogrammés. Ouvre Notifications pour vérifier.",
              });
            }
          },
        },
      ],
    );
  }, [resetSettings, updateSettings]);

  const handleResetLoad = useCallback(() => {
    Alert.alert(
      "Réinitialiser la charge",
      "Remet ATL/CTL/TSB à zéro et efface les charges externes locales.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Réinitialiser", style: "destructive", onPress: () => resetLoadMetrics() },
      ],
    );
  }, [resetLoadMetrics]);

  // ─── Export des données locales ───
  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const exportedAtISO = new Date().toISOString();
      const data = buildLocalExport({
        exportedAtISO,
        appVersion: Constants.expoConfig?.version ?? null,
        stores: {
          load: useLoadStore.getState() as unknown as Record<string, unknown>,
          sessions: useSessionsStore.getState() as unknown as Record<string, unknown>,
          feedback: useFeedbackStore.getState() as unknown as Record<string, unknown>,
          external: useExternalStore.getState() as unknown as Record<string, unknown>,
          // « Mon corps » passe par SA lecture unique (state/selectors/blessures).
          body: { bodyInjuries: lireBlessures() },
          settings: useSettingsStore.getState() as unknown as Record<string, unknown>,
        },
      });
      const json = JSON.stringify(data, null, 2);
      const file = new File(Paths.cache, nomFichierExport(exportedAtISO));
      file.write(json);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Exporter mes données locales FKS" });
      } else {
        showToast({ type: "warn", title: "Export impossible", message: "Le partage de fichier n'est pas disponible sur cet appareil." });
      }
    } catch (err) {
      if (__DEV__) console.warn("[Settings] Export error:", err);
      showToast({ type: "error", title: "Export échoué", message: "Le fichier n'a pas pu être créé. Réessaie." });
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // ─── Compte ───
  const performLogout = useCallback(async () => {
    try {
      // Nettoyage terminal AVANT de couper la session : périme toute
      // programmation en vol, attend les écritures engagées, puis annule. Rien
      // de plus ancien ne peut reposer un rappel ; la prochaine connexion
      // réconcilie (App.tsx suit l'état auth).
      await purgeNotifications();
      await signOut(auth);
      resetTrainingStore(null);
    } catch {
      showToast({ type: "error", title: "Déconnexion", message: "Échec de la déconnexion. Réessaie." });
    }
  }, [resetTrainingStore]);

  const handleLogout = useCallback(() => {
    Alert.alert("Déconnexion", "Tu veux vraiment te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => performLogout() },
    ]);
  }, [performLogout]);

  const handleContact = useCallback(async () => {
    const sujet = encodeURIComponent(`FKS — question (v${Constants.expoConfig?.version ?? "?"})`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${sujet}`;
    try {
      // Ouvre un BROUILLON dans l'app mail du téléphone : rien n'est envoyé d'ici.
      await Linking.openURL(url);
    } catch {
      showToast({ type: "info", title: "Nous écrire", message: `Écris-nous à ${SUPPORT_EMAIL}.` });
    }
  }, []);

  // ─── Thème ───
  // La palette est appliquée au démarrage (`setThemeMode` dans App.tsx) : les
  // feuilles de style sont figées au chargement des écrans, un redémarrage est
  // donc nécessaire. En production, `Updates.reloadAsync` relance l'app ;
  // s'il n'est pas disponible (Expo Go, web), on le dit au lieu de faire semblant.
  const triggerReload = useCallback(async () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    try {
      await Updates.reloadAsync();
    } catch {
      showToast({ type: "info", title: "Redémarrage nécessaire", message: "Ferme et rouvre l'app pour voir le nouveau thème." });
    }
  }, []);

  const handleThemeChange = useCallback(
    (nextMode: SettingsState["themeMode"]) => {
      if (nextMode === settings.themeMode) return;
      updateSettings({ themeMode: nextMode });
      Alert.alert(
        "Thème enregistré",
        "Il s'appliquera au prochain démarrage de l'app. Redémarrer maintenant ?",
        [
          { text: "Plus tard", style: "cancel" },
          { text: "Redémarrer", onPress: () => void triggerReload() },
        ],
      );
    },
    [settings.themeMode, updateSettings, triggerReload],
  );

  const sousTitreNotifications = !settings.notificationsEnabled
    ? permissionRefusee
      ? "Bloquées par le téléphone. Autorise FKS dans ses réglages, puis réactive ici."
      : "Aucune notification ne sera envoyée."
    : "Rappel de séance et récap du dimanche soir.";

  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      {/* ─── MON COMPTE ─── */}
      <View style={styles.section}>
        <SectionHeader title="Mon compte" />
        <Card variant="soft" style={styles.sectionCard}>
          <SettingRow title="Connecté avec" subtitle={auth.currentUser?.email ?? "Compte FKS"} />
          <SettingRow
            title="Modifier mon profil"
            subtitle="Poste, niveau, objectif, entraînements club et matchs, accès salle"
            onPress={() => nav.navigate("ProfileSetup")}
            testID="settings-edit-profile"
          />
          <SettingRow
            title="Séances FKS par semaine"
            subtitle="Ton objectif, enregistré sur ton compte"
            right={
              <SegmentedControl
                value={objectifHebdo === null ? "" : String(objectifHebdo)}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                  { value: "4", label: "4" },
                ]}
                onChange={changerObjectifHebdo}
                accessibilityLabel="Nombre de séances FKS par semaine"
              />
            }
          />
          <SettingRow
            title="Se déconnecter"
            subtitle="Tes données restent sur ton compte"
            onPress={handleLogout}
            showDivider={false}
            testID="settings-logout"
          />
        </Card>
      </View>

      {/* ─── NOTIFICATIONS ─── */}
      <View style={styles.section}>
        <SectionHeader title="Notifications" />
        <Card variant="soft" style={styles.sectionCard}>
          <SettingRow
            title="Notifications"
            subtitle={sousTitreNotifications}
            right={
              <Toggle
                value={settings.notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                accessibilityLabel="Activer les notifications"
              />
            }
          />
          <SettingRow
            title="Rappel de séance"
            subtitle={
              settings.notificationsEnabled
                ? `Tous les jours à ${heureRappel}`
                : "Active les notifications pour le recevoir."
            }
            right={
              <Toggle
                value={settings.sessionReminders}
                onValueChange={handleSessionReminderToggle}
                disabled={!settings.notificationsEnabled}
                accessibilityLabel="Rappel quotidien de séance"
              />
            }
            showDivider={false}
          />
        </Card>
      </View>

      {/* ─── PRÉFÉRENCES DE L'APPLICATION ─── */}
      <View style={styles.section}>
        <SectionHeader title="Préférences de l'application" />
        <Card variant="soft" style={styles.sectionCard}>
          <SettingRow
            title="Charges club et match automatiques"
            subtitle="Ajoute la charge de tes entraînements club et de tes matchs déclarés"
            right={
              <Toggle
                value={autoExternalEnabled}
                onValueChange={(value) => setAutoExternalEnabled(value)}
                accessibilityLabel="Charges club et match automatiques"
              />
            }
          />
          <SettingRow
            title="Ressenti en fin de séance"
            subtitle="Ouvre le questionnaire dès que la séance est terminée"
            right={
              <Toggle
                value={settings.autoFeedbackEnabled}
                onValueChange={(value) => updateSettings({ autoFeedbackEnabled: value })}
                accessibilityLabel="Ouvrir le ressenti en fin de séance"
              />
            }
          />
          <SettingRow
            title="Vibrations"
            subtitle="Fin de repos, transitions et boutons"
            right={
              <Toggle
                value={settings.hapticsEnabled}
                onValueChange={(value) => updateSettings({ hapticsEnabled: value })}
                accessibilityLabel="Vibrations"
              />
            }
          />
          {Platform.OS === "web" ? (
            // Le bip de repos n'existe QUE sur le web (AudioContext) : la ligne
            // n'apparaît pas sur un téléphone, où elle ne ferait rien.
            <SettingRow
              title="Sons"
              subtitle="Bip à la fin d'un repos"
              right={
                <Toggle
                  value={settings.soundsEnabled}
                  onValueChange={(value) => updateSettings({ soundsEnabled: value })}
                  accessibilityLabel="Sons de séance"
                />
              }
            />
          ) : null}
          <SettingRow
            title="Début de semaine"
            subtitle="Pour le compteur et les calendriers"
            right={
              <SegmentedControl
                value={settings.weekStart}
                options={[
                  { value: "mon", label: "Lundi" },
                  { value: "sun", label: "Dimanche" },
                ]}
                onChange={(value) => updateSettings({ weekStart: value as SettingsState["weekStart"] })}
                accessibilityLabel="Jour de début de semaine"
              />
            }
          />
          <SettingRow
            title="Thème"
            subtitle="Appliqué au prochain démarrage"
            right={
              <SegmentedControl
                value={settings.themeMode}
                options={[
                  { value: "light", label: "Clair" },
                  { value: "dark", label: "Sombre" },
                ]}
                onChange={(value) => handleThemeChange(value as SettingsState["themeMode"])}
                accessibilityLabel="Thème de l'application"
              />
            }
            showDivider={false}
          />
        </Card>
      </View>

      {/* ─── DONNÉES ET CONFIDENTIALITÉ ─── */}
      <View style={styles.section}>
        <SectionHeader title="Données et confidentialité" />
        <Card variant="soft" style={styles.sectionCard}>
          <SettingRow
            title="Statistiques d'utilisation"
            subtitle="Envoie à FKS les écrans utilisés et les actions faites, associés à ton compte, pour améliorer l'app. Jamais tes douleurs."
            right={
              <Toggle
                value={settings.privacyAnalytics}
                onValueChange={handleAnalyticsToggle}
                accessibilityLabel="Statistiques d'utilisation"
              />
            }
          />
          <SettingRow
            title={exporting ? "Préparation du fichier…" : "Exporter mes données locales"}
            subtitle="Fichier JSON de ce qui est enregistré sur ce téléphone : séances, charges, ressentis, planning, « Mon corps ». Pas une sauvegarde restaurable."
            onPress={exporting ? undefined : handleExport}
            testID="settings-export"
          />
          <SettingRow
            title="Réinitialiser les préférences"
            subtitle="Réglages de l'appareil uniquement. Ne touche ni ton compte, ni ton profil, ni ton choix sur les statistiques."
            onPress={handleReset}
          />
          <SettingRow
            title="Politique de confidentialité"
            subtitle="Données collectées, usage, droits"
            onPress={() => nav.navigate("PrivacyPolicy")}
            testID="settings-privacy"
          />
          <SettingRow
            title="Supprimer mon compte"
            subtitle="Définitif : compte, profil, séances et historique"
            onPress={() => nav.navigate("DeleteAccount")}
            danger
            showDivider={false}
            testID="settings-delete-account"
          />
        </Card>
      </View>

      {/* ─── AIDE ET INFORMATIONS ─── */}
      <View style={styles.section}>
        <SectionHeader title="Aide et informations" />
        <Card variant="soft" style={styles.sectionCard}>
          <SettingRow
            title="Nous écrire"
            subtitle={`Ouvre un brouillon vers ${SUPPORT_EMAIL}`}
            onPress={handleContact}
            testID="settings-contact"
          />
          <SettingRow
            title="Mentions légales"
            subtitle="Éditeur, hébergement, contact"
            onPress={() => nav.navigate("LegalNotice")}
            testID="settings-legal"
          />
          <SettingRow
            title="Version"
            subtitle={`FKS ${Constants.expoConfig?.version ?? "1.0.0"}`}
            showDivider={false}
          />
        </Card>
      </View>

      {DEV_FLAGS.ENABLED && (
        <View style={styles.section}>
          <SectionHeader title="Outils de développement" />
          <Card variant="soft" style={styles.sectionCard}>
            <SettingRow
              title="Ignorer le plafond de fatigue"
              subtitle="Désactive le cap fatigue côté backend"
              right={
                <Toggle
                  value={ignoreFatigueCap}
                  onValueChange={(value) => setIgnoreFatigueCap(value)}
                  accessibilityLabel="Ignorer le plafond de fatigue"
                />
              }
            />
            <SettingRow
              title="Réinitialiser la charge"
              subtitle="ATL/CTL/TSB + charges externes"
              onPress={handleResetLoad}
              showDivider={false}
            />
          </Card>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 8 },
  sectionCard: { padding: 14, gap: 6 },

  settingTouch: { minHeight: 44, justifyContent: "center" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 32,
  },
  settingText: { flex: 1, minWidth: 0 },
  settingTitle: { color: palette.text, fontSize: 14, fontWeight: "600" },
  settingTitleDanger: { color: palette.danger },
  settingSubtitle: { color: palette.sub, fontSize: 12, lineHeight: 16, marginTop: 2 },
  settingRight: { alignItems: "flex-end", flexShrink: 0 },
  rowDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginVertical: 10,
  },

  segmentRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  segmentChip: {
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    justifyContent: "center",
  },
  segmentChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  segmentText: { color: palette.sub, fontSize: 12, fontWeight: "600" },
  segmentTextActive: { color: palette.accent },
});
