// state/stores/storage.ts
// Migration-aware storage adapter for Zustand persist.
// Ensures legacy data is migrated before any store reads from AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage } from "zustand/middleware";
import { migrateFromLegacyStore } from "../migration/migrateFromLegacy";

// Start migration immediately at module load time.
// If no legacy data exists, this resolves instantly.
const migrationDone = migrateFromLegacyStore();

/**
 * Returns a Zustand-compatible storage that waits for legacy migration
 * to complete before the first read. This prevents a race condition where
 * stores hydrate with defaults before migration has written the split data.
 */
export const createMigratedStorage = () =>
  createJSONStorage(() => ({
    getItem: async (name: string) => {
      await migrationDone;
      return AsyncStorage.getItem(name);
    },
    setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
    removeItem: (name: string) => AsyncStorage.removeItem(name),
  }));
