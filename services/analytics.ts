import Constants from "expo-constants";
import { init, track, setUserId } from "@amplitude/analytics-react-native";

const apiKey = Constants.expoConfig?.extra?.AMPLITUDE_API_KEY ?? "";
let analyticsReady = false;

export const initAnalytics = () => {
  if (!apiKey || analyticsReady) return;
  init(apiKey, undefined, { trackingSessionEvents: true });
  analyticsReady = true;
};

export const trackEvent = (name: string, props?: Record<string, any>) => {
  if (!analyticsReady) return;
  track(name, props);
};

export const setAnalyticsUserId = (uid: string | null) => {
  if (!analyticsReady) return;
  setUserId(uid ?? undefined);
};
