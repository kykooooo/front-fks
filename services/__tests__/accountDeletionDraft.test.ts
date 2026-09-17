// services/__tests__/accountDeletionDraft.test.ts
//
// SUPPRESSION DE COMPTE ET BROUILLON DU QUESTIONNAIRE.
//
// La purge locale retirait la clé du brouillon DIRECTEMENT du stockage : une
// sauvegarde encore en vol pouvait la recréer juste après. Elle passe
// maintenant d'abord par la suppression COORDONNÉE (`setupDraft.clear`), qui
// attend les écritures engagées. Aucune suppression réelle : tout est mocké.

const ordre: string[] = [];
let libererClear: (() => void) | null = null;

jest.mock("firebase/functions", () => ({
  __esModule: true,
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(async () => ({}))),
}));
jest.mock("../firebase", () => ({ __esModule: true, app: {}, auth: {}, db: {} }));
jest.mock("../notificationSync", () => ({
  __esModule: true,
  purgeNotifications: jest.fn(async () => {
    ordre.push("purgeNotifications");
    return { status: "purged" };
  }),
}));
jest.mock("../../state/stores/useSyncStore", () => ({
  __esModule: true,
  useSyncStore: { getState: () => ({ resetForUser: jest.fn(async () => void ordre.push("resetForUser")) }) },
}));
jest.mock("../setupDraft", () => ({
  __esModule: true,
  setupDraft: {
    clear: jest.fn(
      (uid: string) =>
        new Promise<void>((resolve) => {
          ordre.push(`draft.clear:${uid}:demande`);
          libererClear = () => {
            ordre.push("draft.clear:fini");
            resolve();
          };
        }),
    ),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { finalizeLocalAccountDeletion } from "../accountDeletion";
import { STORAGE_KEYS } from "../../constants/storage";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("la purge directe des clés ATTEND la suppression coordonnée du brouillon de CE compte", async () => {
  const multiRemove = jest.spyOn(AsyncStorage, "multiRemove").mockImplementation(async () => {
    ordre.push("multiRemove");
  });

  const p = finalizeLocalAccountDeletion("uid-A");
  for (let i = 0; i < 5; i += 1) await tick();

  // La suppression coordonnée est demandée, pas encore finie : la purge directe n'a pas tourné.
  expect(ordre).toContain("draft.clear:uid-A:demande");
  expect(ordre).not.toContain("multiRemove");

  libererClear!();
  await p;

  expect(ordre.indexOf("draft.clear:fini")).toBeLessThan(ordre.indexOf("multiRemove"));
  // Ceinture : la clé du brouillon fait toujours partie de la purge directe.
  const cles = multiRemove.mock.calls[0][0] as string[];
  expect(cles).toContain(STORAGE_KEYS.SETUP_DRAFT("uid-A"));
  expect(cles).not.toContain(STORAGE_KEYS.SETUP_DRAFT("uid-B"));
  // Et les rappels sont purgés en tout premier, comme avant.
  expect(ordre[0]).toBe("purgeNotifications");
});
