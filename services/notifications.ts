// services/notifications.ts
// Service de notifications pour FKS : permission, token push, préférences et
// rappels LOCAUX programmés.
//
// ─── TROIS CHOSES DISTINCTES, ET ELLES LE RESTENT ────────────────────────────
//  1. LA PERMISSION DU TÉLÉPHONE (`ensureNotificationPermission`) : accordée,
//     refusée, ou inconnue (web, lecture impossible). Elle seule décide si un
//     rappel local peut partir.
//  2. LA PRÉFÉRENCE DU JOUEUR (`useSettingsStore.notificationsEnabled` /
//     `sessionReminders`) : ce qu'il veut. Persistée par le store de réglages.
//  3. LA PROGRAMMATION EFFECTIVE (`applyNotificationPreferences`) : ce qui est
//     réellement posé dans le planificateur du système, dérivé des deux
//     précédentes. Toujours « on annule tout, puis on repose » : jamais de
//     doublon, jamais d'ancien rappel oublié.
//
// LE TOKEN PUSH N'EST PAS UNE QUATRIÈME CHOSE. `getExpoPushTokenAsync` peut
// échouer (projectId absent, réseau, Expo Go) alors que la permission est
// accordée : les rappels locaux ne dépendent PAS de lui. Son obtention est
// best-effort et n'a aucune influence sur les réglages ni sur les rappels.
//
// ─── UNE SEULE SOURCE POUR « ACTIVÉ » ────────────────────────────────────────
// Le fichier `fks_notif_prefs` (AsyncStorage) est le miroir que lisent les
// planificateurs. Il n'est plus écrit qu'ici, par `applyNotificationPreferences`,
// à partir des valeurs du store de réglages passées en argument : il ne peut
// donc plus diverger du store après un reset, une sauvegarde partielle ou une
// suite de bascules rapides (les applications sont sérialisées).

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ──────────────────────── Config ────────────────────────
const STORAGE_KEYS = {
  PUSH_TOKEN: "fks_push_token",
  NOTIF_PREFS: "fks_notif_prefs",
};

/** L'heure du rappel quotidien de séance — la seule que le service applique. */
export const SESSION_REMINDER_TIME = { hour: 18, minute: 0 } as const;

/** Préférences de notifications (miroir lu par les planificateurs). */
export type NotifPrefs = {
  enabled: boolean;
  sessionReminder: boolean; // Rappel quotidien séance
  streakReminder: boolean; // Rappel streak en danger (aucun appelant aujourd'hui)
  matchEve: boolean; // Rappel veille de match (aucun appelant aujourd'hui)
  weeklyRecap: boolean; // Recap hebdo
  reminderHour: number; // Heure du rappel (0-23)
  reminderMinute: number; // Minute du rappel (0-59)
};

const DEFAULT_PREFS: NotifPrefs = {
  enabled: true,
  sessionReminder: true,
  streakReminder: true,
  matchEve: true,
  weeklyRecap: true,
  reminderHour: SESSION_REMINDER_TIME.hour,
  reminderMinute: SESSION_REMINDER_TIME.minute,
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

export type NotificationPermission = "granted" | "denied" | "unknown";

/**
 * La permission du téléphone, demandée si elle ne l'a jamais été.
 * `unknown` = web ou lecture impossible : on ne conclut rien, on ne dégrade
 * aucun réglage sur un signal ambigu.
 */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === "web") return "unknown";
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return "granted";
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted" ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

/**
 * Statut RÉEL de la permission, SANS la demander — pour garder Réglages honnête.
 * `null` = on ne conclut rien (web, ou lecture impossible). Distinct du token
 * push : les rappels LOCAUX ne dépendent que de la permission, pas du token.
 */
export async function isNotificationPermissionGranted(): Promise<boolean | null> {
  if (Platform.OS === "web") return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return null;
  }
}

/**
 * Token push Expo, BEST-EFFORT : `null` si la permission manque OU si
 * l'obtention échoue. Ne jette jamais. Un `null` ne dit rien de la permission
 * — c'est `ensureNotificationPermission` qui la dit.
 */
export async function registerPushTokenBestEffort(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "FKS",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF7A1A",
      });
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenData.data;
    await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
    return token;
  } catch (err) {
    if (__DEV__) console.warn("[notifications] token push indisponible:", err);
    return null;
  }
}

/**
 * Demande la permission puis tente le token. Conservé pour compatibilité :
 * rend le token, ou `null` — mais `null` ne signifie PLUS « permission
 * refusée » (cf. registerPushTokenBestEffort). Ne jette jamais.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const permission = await ensureNotificationPermission();
  if (permission !== "granted") return null;
  return registerPushTokenBestEffort();
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

/** Programme toutes les notifications récurrentes (annule d'abord : jamais de doublon). */
export async function scheduleAllNotifications(): Promise<void> {
  await cancelAllScheduled();
  const prefs = await getNotifPrefs();
  if (!prefs.enabled) return;

  await scheduleSessionReminder(prefs.reminderHour, prefs.reminderMinute);
  await scheduleWeeklyRecap();
}

// ──────────────────────── Application des préférences ────────────────────────

export type NotificationPreferences = {
  /** Préférence du joueur (store de réglages). */
  enabled: boolean;
  /** Rappel quotidien de séance (store de réglages). */
  sessionReminder: boolean;
};

export type ApplyResult = {
  permission: NotificationPermission;
  /** Ce qui est RÉELLEMENT programmé après l'application. */
  scheduled: { sessionReminder: boolean; weeklyRecap: boolean };
  /** `true` : l'opération a été abandonnée avant d'écrire, le contexte ayant changé (cf. services/notificationSync). */
  stale?: boolean;
};

export type ApplyOptions = {
  requestPermission?: boolean;
  /**
   * « Ce que je m'apprête à écrire est-il encore voulu ? » Relu AVANT chaque
   * écriture (miroir, annulation, programmation). Une opération lancée avant
   * une déconnexion ou une bascule OFF s'arrête ici au lieu de reposer des
   * rappels que plus personne ne veut.
   */
  isStale?: () => boolean;
};

// Les applications sont SÉRIALISÉES : deux bascules rapides ne peuvent pas
// s'entrelacer (annulation de l'une pendant la programmation de l'autre) — la
// dernière demandée est toujours celle qui reste posée.
let fileApplications: Promise<unknown> = Promise.resolve();

/**
 * LA fonction qui rend le planificateur cohérent avec la préférence du joueur.
 *
 *  - `enabled: false` → miroir à OFF, tout est annulé, aucune permission demandée ;
 *  - `enabled: true`  → la permission est vérifiée SANS être redemandée (`requestPermission`
 *    à `true` pour la demander, cas de la bascule manuelle ON) ; refusée → rien
 *    n'est programmé et `permission: "denied"` le dit ; inconnue (web) → le
 *    miroir est écrit, la programmation est tentée sans promesse.
 *
 * Le token push n'entre pas dans cette décision.
 */
export function applyNotificationPreferences(
  prefs: NotificationPreferences,
  options: ApplyOptions = {},
): Promise<ApplyResult> {
  const tache = fileApplications.then(() => appliquer(prefs, options), () => appliquer(prefs, options));
  fileApplications = tache;
  return tache;
}

async function appliquer(
  prefs: NotificationPreferences,
  options: ApplyOptions,
): Promise<ApplyResult> {
  const eteint: ApplyResult["scheduled"] = { sessionReminder: false, weeklyRecap: false };
  const perime = (): ApplyResult => ({ permission: "unknown", scheduled: eteint, stale: true });
  const isStale = options.isStale ?? (() => false);

  // Une demande périmée avant même d'avoir commencé (elle attendait derrière
  // une autre) n'écrit rien.
  if (isStale()) return perime();

  if (!prefs.enabled) {
    await saveNotifPrefs({ enabled: false, sessionReminder: false });
    await cancelAllScheduled();
    return { permission: "unknown", scheduled: eteint };
  }

  const permission = options.requestPermission
    ? await ensureNotificationPermission()
    : await lirePermissionSansDemander();

  // La lecture/demande de permission a pu durer (popup système) : le monde a
  // pu changer entre-temps.
  if (isStale()) return perime();

  if (permission === "denied") {
    // Le joueur veut, le téléphone refuse : rien ne peut partir. On ne touche
    // pas au miroir pour ne pas confondre « refusé » et « désactivé » — c'est
    // l'appelant qui décide quoi afficher (Réglages repasse le réglage à OFF).
    await cancelAllScheduled();
    return { permission, scheduled: eteint };
  }

  await saveNotifPrefs({ enabled: true, sessionReminder: prefs.sessionReminder });
  // Contrôle juste avant de poser les rappels : c'est CETTE écriture qu'une
  // opération périmée ne doit jamais faire.
  if (isStale()) return perime();
  await scheduleAllNotifications();
  // L'appel natif était peut-être déjà en vol quand le contexte a changé
  // (déconnexion, suppression, bascule OFF) : ce qu'on vient de poser n'est
  // plus voulu, on le RETIRE nous-mêmes. Une opération plus récente, si elle
  // existe, est derrière nous dans la file et reposera ce qu'il faut.
  if (isStale()) {
    await cancelAllScheduled();
    return perime();
  }
  const courant = await getNotifPrefs();
  return {
    permission,
    scheduled: { sessionReminder: prefs.sessionReminder, weeklyRecap: courant.weeklyRecap },
  };
}

async function lirePermissionSansDemander(): Promise<NotificationPermission> {
  const granted = await isNotificationPermissionGranted();
  if (granted === null) return "unknown";
  return granted ? "granted" : "denied";
}

/**
 * ANNULATION TERMINALE, DANS LA FILE. Contrairement à `cancelAllScheduled`
 * (immédiate), celle-ci attend que toute application déjà engagée — y compris
 * un appel natif en vol — soit terminée avant d'annuler : rien d'antérieur ne
 * peut donc réapparaître après elle. `isStale` protège l'inverse : si un
 * contexte plus récent est apparu entre-temps (nouveau compte), on ne touche
 * pas à ce qu'il a posé ou va poser. Rend `true` si l'annulation a eu lieu.
 */
export function cancelAllScheduledQueued(options: { isStale?: () => boolean } = {}): Promise<boolean> {
  const run = async () => {
    if (options.isStale?.()) return false;
    await cancelAllScheduled();
    return true;
  };
  const tache = fileApplications.then(run, run);
  fileApplications = tache;
  return tache;
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
