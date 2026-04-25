// utils/useBaselinePromptSeen.ts
// Gère le flag AsyncStorage "baseline prompt déjà vu" (1× par user).
// Utilisé par HomeScreen pour afficher une seule fois la modale baseline.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/storage";

type Status = "unknown" | "seen" | "not_seen";

export function useBaselinePromptSeen(uid: string | null | undefined) {
  const [status, setStatus] = useState<Status>("unknown");

  useEffect(() => {
    if (!uid) {
      setStatus("unknown");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.BASELINE_PROMPT_SEEN(uid));
        if (cancelled) return;
        setStatus(raw === "1" ? "seen" : "not_seen");
      } catch (err) {
        if (cancelled) return;
        if (__DEV__) {
          console.warn("[useBaselinePromptSeen] load error:", err);
        }
        setStatus("not_seen");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const markSeen = useCallback(async () => {
    if (!uid) return;
    setStatus("seen");
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BASELINE_PROMPT_SEEN(uid), "1");
    } catch (err) {
      if (__DEV__) {
        console.warn("[useBaselinePromptSeen] persist error:", err);
      }
    }
  }, [uid]);

  return { status, markSeen };
}
