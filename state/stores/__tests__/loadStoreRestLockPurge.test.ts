// state/stores/__tests__/loadStoreRestLockPurge.test.ts
//
// RETRAIT "REPOS 2 JOURS" (décision produit 17/07) — le bouton posait
// nextAllowedDateISO via restUntil(2) et VERROUILLAIT la génération 48h sans
// confirmation ni annulation. Le bouton et le mur "Repos programmé" sont
// retirés (le repos est géré par la jauge de forme + CTA intelligent), mais des
// profils existants peuvent avoir un verrou DÉJÀ persisté avant la mise à jour.
// Sans purge, ils resteraient bloqués sans aucun moyen de débloquer.
//
// Ces tests prouvent que la migration v2 du persist (useLoadStore) purge le
// verrou hérité à la réhydratation, sans toucher au reste de la charge.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLoadStore } from "../useLoadStore";

const KEY = "fks-load-v1";

/** État legacy plausible d'un joueur actif (v1, avant retrait du bouton). */
const legacyLoadState = (nextAllowedDateISO: string | null) => ({
  atl: 120,
  ctl: 100,
  tsb: -20,
  tsbHistory: [-20, -15, -10],
  lastRpe: 7,
  lastUpdateISO: "2026-07-16T18:00:00.000Z",
  lastLoadDayKey: "2026-07-16",
  dailyApplied: { "2026-07-16": 45 },
  ignoreFatigueCap: false,
  lastAppliedDate: "2026-07-16T18:00:00.000Z",
  nextAllowedDateISO,
});

/** Réplique exacte de l'ancien prédicat de blocage de NewSessionScreen. */
const wouldBlockGeneration = (nextAllowedDateISO: string | null) =>
  nextAllowedDateISO ? Date.now() < new Date(nextAllowedDateISO).getTime() : false;

beforeEach(async () => {
  // Laisse finir l'hydratation initiale déclenchée à l'import du module,
  // pour qu'elle ne recouvre pas l'état seedé ensuite.
  await new Promise((r) => setTimeout(r, 0));
  await AsyncStorage.clear();
});

describe("useLoadStore v2 — purge du verrou 'Repos 2 jours' hérité", () => {
  test("profil legacy (v1) avec nextAllowedDateISO futur → n'est PLUS bloqué après réhydratation", async () => {
    // Verrou posé "hier" pour 2 jours → encore actif 36h dans le futur.
    const futureLock = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    // Sanity check : ce profil ÉTAIT bloqué par l'ancien prédicat.
    expect(wouldBlockGeneration(futureLock)).toBe(true);

    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ state: legacyLoadState(futureLock), version: 1 })
    );

    await useLoadStore.persist.rehydrate();

    const s = useLoadStore.getState();
    // Le verrou est purgé…
    expect(s.nextAllowedDateISO).toBeNull();
    // …donc plus aucun blocage possible, même avec l'ancienne formule.
    expect(wouldBlockGeneration(s.nextAllowedDateISO)).toBe(false);
    // Et la charge du joueur est intacte (pas de perte de données).
    expect(s.atl).toBe(120);
    expect(s.ctl).toBe(100);
    expect(s.tsb).toBe(-20);
    expect(s.tsbHistory).toEqual([-20, -15, -10]);
    expect(s.dailyApplied).toEqual({ "2026-07-16": 45 });
    expect(s.lastAppliedDate).toBe("2026-07-16T18:00:00.000Z");
  });

  test("profil legacy (v1) sans verrou → migration neutre, charge conservée", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ state: legacyLoadState(null), version: 1 })
    );

    await useLoadStore.persist.rehydrate();

    const s = useLoadStore.getState();
    expect(s.nextAllowedDateISO).toBeNull();
    expect(s.atl).toBe(120);
    expect(s.ctl).toBe(100);
  });

  test("état déjà en v2 → réhydratation sans migration, pas de crash", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ state: legacyLoadState(null), version: 2 })
    );

    await useLoadStore.persist.rehydrate();

    const s = useLoadStore.getState();
    expect(s.nextAllowedDateISO).toBeNull();
    expect(s.tsb).toBe(-20);
  });

  test("restUntil reste dans l'API du store (pas de suppression risquée) mais plus aucun déclencheur UI", () => {
    // L'action existe toujours — SettingsScreen la déstructure pour l'exclure
    // de l'export de données. On vérifie juste qu'elle est bien là.
    expect(typeof useLoadStore.getState().restUntil).toBe("function");
  });
});
