// screens/tests/hooks/useTestsStorage.ts
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../constants/storage";
import { auth } from "../../../services/firebase";
import { type TestEntry, isPlaylistId } from "../testConfig";
import { canonicalizeMicrocycleGoal } from "../../../domain/microcycles";

const LEGACY_STORAGE_KEY = STORAGE_KEYS.TESTS_V1;

export const getTestsStorageKey = () => {
  const uid = auth.currentUser?.uid ?? null;
  return uid ? `${LEGACY_STORAGE_KEY}_${uid}` : LEGACY_STORAGE_KEY;
};

export async function readTestsRaw(): Promise<string | null> {
  const key = getTestsStorageKey();
  const raw = await AsyncStorage.getItem(key);
  if (raw != null) return raw;
  if (key !== LEGACY_STORAGE_KEY) return AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  return null;
}

export function useTestsStorage() {
  const [entries, setEntries] = useState<TestEntry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const key = getTestsStorageKey();
        let raw = await AsyncStorage.getItem(key);
        if (raw == null && key !== LEGACY_STORAGE_KEY) {
          const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy != null) {
            await AsyncStorage.setItem(key, legacy);
            await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
            raw = legacy;
          }
        }
        if (raw) {
          const parsed = JSON.parse(raw) as TestEntry[];
          const normalized = Array.isArray(parsed)
            ? (parsed
                .map((entry) => {
                  const rawTs = Number((entry as any)?.ts);
                  if (!Number.isFinite(rawTs) || rawTs <= 0) return null;
                  // Remap des anciens cycles (reactivite/explosif → explosivite, rsa → endurance, offseason → fondation)
                  const playlist = canonicalizeMicrocycleGoal((entry as any)?.playlist);
                  return {
                    ...entry,
                    ts: rawTs,
                    playlist: playlist && isPlaylistId(playlist) ? playlist : undefined,
                  } as TestEntry;
                })
                .filter((entry): entry is TestEntry => entry !== null)
                .sort((a, b) => b.ts - a.ts)
                .slice(0, 30))
            : [];
          setEntries(normalized as TestEntry[]);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn("load tests", e);
        }
      }
    })();
  }, []);

  const persistEntries = async (next: TestEntry[]) => {
    setEntries(next);
    await AsyncStorage.setItem(getTestsStorageKey(), JSON.stringify(next));
  };

  return { entries, persistEntries };
}
