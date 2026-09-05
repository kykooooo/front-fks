// services/__tests__/reservationClub.test.ts
//
// UN RÉESSAI NE DOIT PAS CRÉER UN DEUXIÈME CLUB.
//
// Scénario mesuré (audit d'inscription 2026-09, P1-03) : 4G médiocre, la garde
// de 15 s expire alors que le club et l'appartenance EXISTENT déjà. Le coach
// retape « Créer mon club » — et l'ancien code tirait un nouvel identifiant
// automatique à chaque appel : second club, puis troisième. Le premier, lui,
// restait orphelin, invisible et impossible à retrouver.
//
// Le `writeBatch` que l'audit recommandait d'abord CASSERAIT la création
// (erratum 2) : les règles évaluent chaque opération d'un batch contre l'état
// antérieur au batch, l'appartenance propriétaire écrite dans le même batch
// serait invisible, et `users/{uid}.clubId` serait refusé — plus aucun coach ne
// pourrait créer de club. D'où l'idempotence, qui est la seule réponse
// disponible côté client.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { libererIdClub, reserverIdClub } from "../reservationClub";
import { STORAGE_KEYS } from "../../constants/storage";

afterEach(async () => {
  await AsyncStorage.clear();
});

describe("reserverIdClub", () => {
  test("deux réessais du MÊME compte réutilisent le MÊME identifiant", async () => {
    let compteur = 0;
    const generer = jest.fn(() => `club-${++compteur}`);

    const premier = await reserverIdClub("coachA", generer);
    const deuxieme = await reserverIdClub("coachA", generer);
    const troisieme = await reserverIdClub("coachA", generer);

    expect(premier).toBe("club-1");
    expect(deuxieme).toBe("club-1");
    expect(troisieme).toBe("club-1");
    // Un seul identifiant tiré, donc un seul club écrit, quoi qu'il arrive.
    expect(generer).toHaveBeenCalledTimes(1);
  });

  test("la réservation est PAR COMPTE : deux comptes ne se la disputent pas", async () => {
    let compteur = 0;
    const generer = () => `club-${++compteur}`;
    const a = await reserverIdClub("coachA", generer);
    const b = await reserverIdClub("coachB", generer);
    expect(a).not.toBe(b);
    // Et chacun retrouve le sien.
    expect(await reserverIdClub("coachA", generer)).toBe(a);
    expect(await reserverIdClub("coachB", generer)).toBe(b);
  });

  test("elle est écrite sur le disque avant tout, sous une clé nommée une seule fois", async () => {
    await reserverIdClub("coachA", () => "club-1");
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"))).toBe("club-1");
    expect(STORAGE_KEYS.CLUB_CREATION_ID("coachA")).toBe("fks_club_creation_coachA");
  });

  test("libérée au succès : le club suivant sera un VRAI nouveau club", async () => {
    let compteur = 0;
    const generer = () => `club-${++compteur}`;
    const premier = await reserverIdClub("coachA", generer);
    await libererIdClub("coachA");
    const suivant = await reserverIdClub("coachA", generer);
    expect(suivant).not.toBe(premier);
  });

  test("un disque en panne ne bloque pas la création — elle perd juste son idempotence", async () => {
    const stockage = AsyncStorage as unknown as Record<string, unknown>;
    const originaux = { getItem: stockage.getItem, setItem: stockage.setItem };
    stockage.getItem = jest.fn().mockRejectedValue(new Error("illisible"));
    stockage.setItem = jest.fn().mockRejectedValue(new Error("plein"));
    try {
      await expect(reserverIdClub("coachA", () => "club-1")).resolves.toBe("club-1");
      await expect(libererIdClub("coachA")).resolves.toBeUndefined();
    } finally {
      Object.assign(stockage, originaux);
    }
  });

  test("une réservation blanche en base locale ne compte pas", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"), "   ");
    expect(await reserverIdClub("coachA", () => "club-neuf")).toBe("club-neuf");
  });
});
