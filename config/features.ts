import Constants from "expo-constants";

const extra: Record<string, unknown> = Constants.expoConfig?.extra ?? {};

const enabled = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

export const FKS_CATALOG_V2_ENABLED = enabled(
  process.env.EXPO_PUBLIC_FKS_CATALOG_V2 ?? extra.FKS_CATALOG_V2
);

export const FKS_SIGNAL_V1_ENABLED = enabled(
  process.env.EXPO_PUBLIC_FKS_SIGNAL_V1 ?? extra.FKS_SIGNAL_V1
);
