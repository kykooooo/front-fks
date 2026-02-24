import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export const initSentry = () => {
  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ??
    (Constants.expoConfig?.extra?.SENTRY_DSN as string | undefined) ??
    '';
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',
  });
};

export const setSentryUser = (uid: string | null) => {
  Sentry.setUser(uid ? { id: uid } : null);
};
