import Constants from "expo-constants";
import * as Sentry from "sentry-expo";

const dsn = Constants.expoConfig?.extra?.SENTRY_DSN ?? "";

export const initSentry = () => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    enableInExpoDevelopment: false,
    debug: false,
  });
};

export const setSentryUser = (uid: string | null) => {
  if (!dsn) return;
  if (uid) {
    Sentry.Native.setUser({ id: uid });
  } else {
    Sentry.Native.setUser(null);
  }
};
