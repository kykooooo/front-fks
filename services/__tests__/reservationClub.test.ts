// services/__tests__/reservationClub.test.ts
//
// UN RÉESSAI NE DOIT NI CRÉER UN DEUXIÈME CLUB, NI SE FAIRE REFUSER.
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
//
// SECOND TEMPS (R2, contre-vérification du 05/09) : l'identifiant réservé seul
// fermait le club en double et ouvrait pire. Réécrire `clubs/{clubId}` sur un
// document déjà écrit est une UPDATE, que les règles n'acceptent que d'un
// propriétaire déjà inscrit comme membre (firestore.rules:783 → `:79-83`). Dans
// l'entrelacement exact d'un timeout — écriture 1 passée, écriture 2 pas
// passée — chaque réessai était refusé, la réservation jamais libérée, et le
// coach bloqué à vie sur son compte. La réservation porte donc la PROGRESSION.

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  enregistrerEtapeClub,
  estRefusPermission,
  libererIdClub,
  remplacerReservationClub,
  reserverIdClub,
} from "../reservationClub";
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

    expect(premier.clubId).toBe("club-1");
    expect(deuxieme.clubId).toBe("club-1");
    expect(troisieme.clubId).toBe("club-1");
    // Un seul identifiant tiré, donc un seul club écrit, quoi qu'il arrive.
    expect(generer).toHaveBeenCalledTimes(1);
  });

  test("une réservation neuve part de l'étape 0 : rien n'est supposé écrit", async () => {
    expect((await reserverIdClub("coachA", () => "club-1")).etape).toBe(0);
  });

  test("la réservation est PAR COMPTE : deux comptes ne se la disputent pas", async () => {
    let compteur = 0;
    const generer = () => `club-${++compteur}`;
    const a = await reserverIdClub("coachA", generer);
    const b = await reserverIdClub("coachB", generer);
    expect(a.clubId).not.toBe(b.clubId);
    // Et chacun retrouve le sien.
    expect((await reserverIdClub("coachA", generer)).clubId).toBe(a.clubId);
    expect((await reserverIdClub("coachB", generer)).clubId).toBe(b.clubId);
  });

  test("elle est écrite sur le disque avant tout, sous une clé nommée une seule fois", async () => {
    await reserverIdClub("coachA", () => "club-1");
    const brut = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"));
    expect(JSON.parse(String(brut))).toEqual({ clubId: "club-1", etape: 0 });
    expect(STORAGE_KEYS.CLUB_CREATION_ID("coachA")).toBe("fks_club_creation_coachA");
  });

  test("libérée au succès : le club suivant sera un VRAI nouveau club", async () => {
    let compteur = 0;
    const generer = () => `club-${++compteur}`;
    const premier = await reserverIdClub("coachA", generer);
    await libererIdClub("coachA");
    const suivant = await reserverIdClub("coachA", generer);
    expect(suivant.clubId).not.toBe(premier.clubId);
    expect(suivant.etape).toBe(0);
  });

  test("un disque en panne ne bloque pas la création — elle perd juste son idempotence", async () => {
    const stockage = AsyncStorage as unknown as Record<string, unknown>;
    const originaux = { getItem: stockage.getItem, setItem: stockage.setItem };
    stockage.getItem = jest.fn().mockRejectedValue(new Error("illisible"));
    stockage.setItem = jest.fn().mockRejectedValue(new Error("plein"));
    try {
      await expect(reserverIdClub("coachA", () => "club-1")).resolves.toEqual({
        clubId: "club-1",
        etape: 0,
      });
      await expect(libererIdClub("coachA")).resolves.toBeUndefined();
      await expect(enregistrerEtapeClub("coachA", "club-1", 1)).resolves.toBeUndefined();
    } finally {
      Object.assign(stockage, originaux);
    }
  });

  test("une réservation blanche en base locale ne compte pas", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"), "   ");
    expect((await reserverIdClub("coachA", () => "club-neuf")).clubId).toBe("club-neuf");
  });

  test("une réservation illisible ne fait pas deviner un identifiant", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"), "{pas du json");
    expect((await reserverIdClub("coachA", () => "club-neuf")).clubId).toBe("club-neuf");
  });

  test("la forme HISTORIQUE (identifiant nu) est relue comme étape 0", async () => {
    // Une installation qui avait une création en cours au moment de la mise à
    // jour : on garde son identifiant, et on repart du début — exactement ce
    // que faisait le lot A. Rien de perdu, rien de supposé.
    await AsyncStorage.setItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"), "club-legacy");
    expect(await reserverIdClub("coachA", () => "club-neuf")).toEqual({
      clubId: "club-legacy",
      etape: 0,
    });
  });
});

describe("enregistrerEtapeClub — la progression, notée au fur et à mesure", () => {
  test("relue par le réessai suivant", async () => {
    await reserverIdClub("coachA", () => "club-1");
    await enregistrerEtapeClub("coachA", "club-1", 1);
    expect(await reserverIdClub("coachA", () => "jamais")).toEqual({
      clubId: "club-1",
      etape: 1,
    });
  });

  test("jamais en arrière : une note plus ancienne ne fait pas rejouer une écriture", async () => {
    await reserverIdClub("coachA", () => "club-1");
    await enregistrerEtapeClub("coachA", "club-1", 2);
    await enregistrerEtapeClub("coachA", "club-1", 1);
    expect((await reserverIdClub("coachA", () => "jamais")).etape).toBe(2);
  });

  test("une note qui parle d'un AUTRE club ne touche pas la réservation en cours", async () => {
    await reserverIdClub("coachA", () => "club-1");
    await enregistrerEtapeClub("coachA", "club-autre", 3);
    expect(await reserverIdClub("coachA", () => "jamais")).toEqual({
      clubId: "club-1",
      etape: 0,
    });
  });
});

describe("remplacerReservationClub — sortir d'un refus, pas s'y enfermer", () => {
  test("un identifiant NEUF, à l'étape 0", async () => {
    const premiere = await reserverIdClub("coachA", () => "club-1");
    await enregistrerEtapeClub("coachA", "club-1", 1);
    const remplacante = await remplacerReservationClub("coachA", () => "club-2");
    expect(remplacante).toEqual({ clubId: "club-2", etape: 0 });
    expect(remplacante.clubId).not.toBe(premiere.clubId);
    // Et c'est bien elle qu'on relit ensuite.
    expect(await reserverIdClub("coachA", () => "jamais")).toEqual({
      clubId: "club-2",
      etape: 0,
    });
  });
});

describe("estRefusPermission — le seul code qui doit faire jeter la réservation", () => {
  test("reconnaît le refus des règles, préfixé ou non", () => {
    expect(estRefusPermission({ code: "permission-denied" })).toBe(true);
    expect(estRefusPermission({ code: "firestore/permission-denied" })).toBe(true);
  });

  test("une panne passagère n'est PAS un refus : reprendre est la bonne réponse", () => {
    expect(estRefusPermission({ code: "unavailable" })).toBe(false);
    expect(estRefusPermission(new Error("timeout"))).toBe(false);
    expect(estRefusPermission(null)).toBe(false);
    expect(estRefusPermission(undefined)).toBe(false);
  });
});
