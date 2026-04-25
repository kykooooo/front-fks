// services/notifications.ts
// Service de notifications push pour FKS
// Gère permissions, enregistrement token, et notifications programmées

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ──────────────────────── Config ────────────────────────
const STORAGE_KEYS = {
  PUSH_TOKEN: "fks_push_token",
  NOTIF_PREFS: "fks_notif_prefs",
};

/** Préférences de notifications */
export type NotifPrefs = {
  enabled: boolean;
  sessionReminder: boolean; // Rappel quotidien séance
  streakReminder: boolean; // Rappel streak en danger
  matchEve: boolean; // Rappel veille de match
  weeklyRecap: boolean; // Recap hebdo
  retestReminder: boolean; // Rappel re-test 30j après fin de cycle
  reminderHour: number; // Heure du rappel (0-23)
  reminderMinute: number; // Minute du rappel (0-59)
};

const DEFAULT_PREFS: NotifPrefs = {
  enabled: true,
  sessionReminder: true,
  streakReminder: true,
  matchEve: true,
  weeklyRecap: true,
  retestReminder: true,
  reminderHour: 18,
  reminderMinute: 0,
};

// ──────────────────────── Handler par défaut ────────────────────────
// Affiche la notification en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ──────────────────────── Permissions & Token ────────────────────────

/** Demande les permissions et retourne le push token Expo */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Android : canal par défaut
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "FKS",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF7A1A",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenData.data;

  await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
  return token;
}

// ──────────────────────── Préférences ────────────────────────

export async function getNotifPrefs(): Promise<NotifPrefs> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_PREFS);
  if (!raw) return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotifPrefs(prefs: Partial<NotifPrefs>): Promise<void> {
  const current = await getNotifPrefs();
  const merged = { ...current, ...prefs };
  await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_PREFS, JSON.stringify(merged));
}

// ──────────────────────── Notifications locales programmées ────────────────────────

/** Annule toutes les notifications programmées FKS */
export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Programme le rappel quotidien de séance */
export async function scheduleSessionReminder(
  hour: number,
  minute: number
): Promise<string | null> {
  const prefs = await getNotifPrefs();
  if (!prefs.enabled || !prefs.sessionReminder) return null;

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "C'est l'heure de ta séance !",
      body: "Ta prépa physique t'attend. Lance ta séance du jour.",
      data: { type: "session_reminder" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/** Programme un rappel de streak en danger (lendemain matin) */
export async function scheduleStreakReminder(
  currentStreak: number
): Promise<string | null> {
  const prefs = await getNotifPrefs();
  if (!prefs.enabled || !prefs.streakReminder || currentStreak < 3) return null;

  // Rappel le lendemain à 10h si le joueur n'a pas bougé
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: `${currentStreak} jours d'affilée !`,
      body: "Ne casse pas ta série ! Une séance rapide suffit.",
      data: { type: "streak_reminder", streak: currentStreak },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 86400, // 24h
    },
  });
}

/** Programme un rappel veille de match */
export async function scheduleMatchEveReminder(
  matchDate: Date
): Promise<string | null> {
  const prefs = await getNotifPrefs();
  if (!prefs.enabled || !prefs.matchEve) return null;

  // Veille du match à 20h
  const eve = new Date(matchDate);
  eve.setDate(eve.getDate() - 1);
  eve.setHours(20, 0, 0, 0);

  if (eve.getTime() <= Date.now()) return null;

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "Match demain !",
      body: "Repose-toi bien ce soir. Pas de séance FKS, garde ton énergie pour demain.",
      data: { type: "match_eve" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: eve,
    },
  });
}

/** Programme le récap hebdo (dimanche soir) */
export async function scheduleWeeklyRecap(): Promise<string | null> {
  const prefs = await getNotifPrefs();
  if (!prefs.enabled || !prefs.weeklyRecap) return null;

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "Récap de la semaine",
      body: "Découvre ton bilan de la semaine et prépare la suivante.",
      data: { type: "weekly_recap" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Dimanche
      hour: 20,
      minute: 0,
    },
  });
}

/** Programme toutes les notifications récurrentes */
export async function scheduleAllNotifications(): Promise<void> {
  await cancelAllScheduled();
  const prefs = await getNotifPrefs();
  if (!prefs.enabled) return;

  if (prefs.sessionReminder) {
    await scheduleSessionReminder(prefs.reminderHour, prefs.reminderMinute);
  }
  if (prefs.streakReminder) {
    // Le streak sera calculé à la prochaine ouverture de l'app (useActivityStreak)
    // On planifie avec un streak de 3 comme minimum pour déclencher
    await scheduleStreakReminder(3);
  }
  if (prefs.weeklyRecap) {
    await scheduleWeeklyRecap();
  }
}

/**
 * Programme un rappel re-test 30 jours après la fin d'un cycle.
 * Invite le joueur à refaire ses tests pour voir les gains du cycle qu'il vient de finir.
 * Appelé depuis useFeedbackSave quand shouldPromptCycleEnd passe à true.
 */
export async function scheduleRetestReminder(
  cycleLabel: string,
  daysDelay = 30,
): Promise<string | null> {
  const prefs = await getNotifPrefs();
  if (!prefs.enabled || !prefs.retestReminder) return null;

  const seconds = Math.max(60, Math.floor(daysDelay * 86400));

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "Mesure tes progrès 🏆",
      body: `Ça fait ${daysDelay} jours que t'as terminé ton cycle ${cycleLabel}. C'est le moment de retester ton 30m, ton CMJ ou ton Yo-Yo — tu vas voir tes gains.`,
      data: { type: "retest_reminder", cycleLabel },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}

// ──────────────────────── Notification immédiate ────────────────────────

/** Envoie une notification locale immédiate */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}
