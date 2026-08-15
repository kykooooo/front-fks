// screens/tests/hooks/useTestsStorage.ts
import { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../constants/storage";
import { auth } from "../../../services/firebase";
import { type TestEntry, isPlaylistId } from "../testConfig";
import { canonicalizeMicrocycleGoal } from "../../../domain/microcycles";

const LEGACY_STORAGE_KEY = STORAGE_KEYS.TESTS_V1;

// Borne de sécurité du stockage, PAS une fenêtre d'affichage. L'ancien cap de
// 30 détruisait physiquement les données : la 31e sauvegarde réécrivait
// AsyncStorage sans les entrées les plus anciennes (records de début de saison
// compris, aucune copie Firestore — perte irréversible, P0-5 audit Profil).
// Une entrée = une batterie OU un test rapide : 30 arrivait en ~3 journées de
// tests. 500 = ~2 Mo max en JSON, inatteignable en usage réel sur une saison,
// tout en gardant un garde-fou contre un stockage qui enflerait sans fin.
export const TESTS_MAX_ENTRIES = 500;

/** Applique la borne SANS réordonner : l'appelant garde le plus récent en tête. */
export const capTestEntries = <T,>(list: T[]): T[] => list.slice(0, TESTS_MAX_ENTRIES);

// ─── Bus « les tests ont changé » (P1-19) ───
// Les onglets restent MONTÉS (tab bar) : une batterie enregistrée sur l'écran
// Tests n'existait pas pour le Home et le Profil déjà rendus, figés sur « zéro
// test » toute la session d'app. Même mécanique que le bus de toast
// (DeviceEventEmitter) : chaque écriture émet, chaque lecteur se re-lit.
export const TESTS_UPDATED_EVENT = "fks:tests-updated";
export const emitTestsUpdated = () =>
  DeviceEventEmitter.emit(TESTS_UPDATED_EVENT);
/** Abonne un lecteur ; retourne le désabonnement. */
export const onTestsUpdated = (cb: () => void): (() => void) => {
  const sub = DeviceEventEmitter.addListener(TESTS_UPDATED_EVENT, cb);
  return () => sub.remove();
};

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
  // Re-lecture quand une AUTRE instance du hook écrit (P1-19) : re-parcourir
  // le même storage est idempotent, l'écho de sa propre écriture est inoffensif.
  const [version, setVersion] = useState(0);
  useEffect(() => onTestsUpdated(() => setVersion((v) => v + 1)), []);

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
                .slice(0, TESTS_MAX_ENTRIES))
            : [];
          setEntries(normalized as TestEntry[]);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn("load tests", e);
        }
      }
    })();
  }, [version]);

  const persistEntries = async (next: TestEntry[]) => {
    setEntries(next);
    await AsyncStorage.setItem(getTestsStorageKey(), JSON.stringify(next));
    // Réveille les autres lecteurs (Home, Profil) — APRÈS l'écriture, pour
    // qu'une re-lecture immédiate voie déjà la nouvelle donnée.
    emitTestsUpdated();
  };

  return { entries, persistEntries };
}
