// hooks/useNotificationHandler.ts
// Handles notification taps (foreground + cold-start) and navigates to the correct screen.
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { navigationRef } from "../navigation/navigationRef";
import { toDateKey } from "../utils/dateHelpers";

/** Known notification payload types (mirrors services/notifications.ts data.type values). */
type NotifType =
  | "session_reminder"
  | "streak_reminder"
  | "match_eve"
  | "weekly_recap"
  | "session_planned"
  | "feedback_pending";

function navigateFromPayload(data: Record<string, unknown> | undefined): void {
  if (!data?.type) return;
  if (!navigationRef.isReady()) return;

  const type = data.type as NotifType;

  switch (type) {
    case "session_reminder":
    case "streak_reminder":
    case "match_eve":
      // All these lead to the home dashboard where the user can act
      navigationRef.navigate("Tabs", { screen: "Home" });
      break;

    case "weekly_recap":
      navigationRef.navigate("Progression");
      break;

    case "session_planned": {
      // Future: notification carries v2 + date payload for direct session preview
      const v2 = data.v2 as any;
      const plannedDateISO = (data.plannedDateISO as string) ?? toDateKey(new Date());
      const sessionId = data.sessionId as string | undefined;
      if (v2) {
        navigationRef.navigate("SessionPreview", { v2, plannedDateISO, sessionId });
      } else {
        navigationRef.navigate("Tabs", { screen: "Home" });
      }
      break;
    }

    case "feedback_pending": {
      const sessionId = data.sessionId as string | undefined;
      navigationRef.navigate("Feedback", { sessionId });
      break;
    }

    default:
      // Unknown type — go home
      navigationRef.navigate("Tabs", { screen: "Home" });
      break;
  }
}

/**
 * Hook to register notification-tap listeners.
 * Call once at app root (inside NavigationContainer).
 *
 * Handles two scenarios:
 * 1. App is open (foreground/background) → addNotificationResponseReceivedListener
 * 2. App was killed (cold start) → getLastNotificationResponseAsync
 */
export function useNotificationHandler(): void {
  const handledColdStart = useRef(false);

  // 1. Foreground / background tap
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      navigateFromPayload(data as Record<string, unknown>);
    });
    return () => sub.remove();
  }, []);

  // 2. Cold-start tap (app was killed, user tapped notification)
  useEffect(() => {
    if (handledColdStart.current) return;
    handledColdStart.current = true;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      // Small delay to ensure NavigationContainer is mounted
      setTimeout(() => {
        navigateFromPayload(data as Record<string, unknown>);
      }, 500);
    });
  }, []);
}
