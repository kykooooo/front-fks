import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type AppMode = "player" | "coach";

type AppModeStore = {
  uid: string | null;
  mode: AppMode | null;
  loading: boolean;
  loadForUid: (uid: string | null) => Promise<void>;
  setModeForUid: (uid: string, mode: AppMode) => Promise<void>;
  clearForUid: (uid: string) => Promise<void>;
};

const MODE_KEY_PREFIX = "fks_app_mode_v1:";

const parseMode = (raw: string | null): AppMode | null => {
  if (raw === "player" || raw === "coach") return raw;
  return null;
};

export const useAppModeStore = create<AppModeStore>((set, get) => ({
  uid: null,
  mode: null,
  loading: false,

  loadForUid: async (uid) => {
    if (!uid) {
      set({ uid: null, mode: null, loading: false });
      return;
    }

    const currentUid = get().uid;
    if (currentUid === uid && get().loading === false) return;

    set({ uid, mode: null, loading: true });
    try {
      const raw = await AsyncStorage.getItem(`${MODE_KEY_PREFIX}${uid}`);
      set({ uid, mode: parseMode(raw), loading: false });
    } catch {
      set({ uid, mode: null, loading: false });
    }
  },

  setModeForUid: async (uid, mode) => {
    set({ uid, mode, loading: false });
    try {
      await AsyncStorage.setItem(`${MODE_KEY_PREFIX}${uid}`, mode);
    } catch {
      // best effort
    }
  },

  clearForUid: async (uid) => {
    const currentUid = get().uid;
    if (currentUid === uid) set({ mode: null });
    try {
      await AsyncStorage.removeItem(`${MODE_KEY_PREFIX}${uid}`);
    } catch {
      // best effort
    }
  },
}));
