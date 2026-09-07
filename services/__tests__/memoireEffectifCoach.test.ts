// services/__tests__/memoireEffectifCoach.test.ts
//
// CE QUE CES TESTS PROTÈGENT.
// Cette mémoire n'affiche rien : elle sert uniquement au portillon
// d'atterrissage coach à choisir son onglet sans attendre 26 requêtes. Le
// danger n'est donc pas d'afficher un faux chiffre — c'est d'appliquer à un
// club la mémoire d'un AUTRE club, ou de survivre à un compte auquel elle
// n'appartient plus. Les deux sont vérifiés ici, ainsi que le refus de toute
// valeur qui ne vient pas de nous.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../constants/storage";
import {
  lireEffectifMemorise,
  memoriserEffectifCoach,
  oublierEffectifCoach,
} from "../memoireEffectifCoach";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe("mémoire de la taille d'effectif coach", () => {
  test("ce qui est mémorisé pour un club se relit pour ce club", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 25);
    expect(await lireEffectifMemorise("coach-1", "club-1")).toBe(25);
  });

  test("un effectif vide se mémorise comme tel : 0 est une mesure, pas une absence", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 0);
    expect(await lireEffectifMemorise("coach-1", "club-1")).toBe(0);
  });

  // LE CAS QUI COMPTE. Le club est dans la VALEUR, pas dans la clé : une mémoire
  // écrite pour un club ne doit jamais décider de l'écran d'un autre.
  test("changement de club : la valeur d'avant est inutilisable, pas « périmée mais appliquée »", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 25);
    expect(await lireEffectifMemorise("coach-1", "club-2")).toBeNull();
  });

  test("chaque compte a la sienne : rien n'est hérité sur un téléphone partagé", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 25);
    expect(await lireEffectifMemorise("coach-2", "club-1")).toBeNull();
  });

  test("un club réécrit remplace la valeur, il ne s'y ajoute pas", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 25);
    await memoriserEffectifCoach("coach-1", "club-2", 0);
    expect(await lireEffectifMemorise("coach-1", "club-1")).toBeNull();
    expect(await lireEffectifMemorise("coach-1", "club-2")).toBe(0);
  });

  test("oublier efface la mémoire du compte visé, et de lui seul", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 25);
    await memoriserEffectifCoach("coach-2", "club-9", 3);
    await oublierEffectifCoach("coach-1");
    expect(await lireEffectifMemorise("coach-1", "club-1")).toBeNull();
    expect(await lireEffectifMemorise("coach-2", "club-9")).toBe(3);
  });

  test("sans compte ou sans club, on n'écrit rien et on ne lit rien", async () => {
    await memoriserEffectifCoach(null, "club-1", 4);
    await memoriserEffectifCoach("coach-1", null, 4);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.COACH_ROSTER_SIZE("coach-1"))).toBeNull();
    expect(await lireEffectifMemorise(null, "club-1")).toBeNull();
    expect(await lireEffectifMemorise("coach-1", null)).toBeNull();
  });

  // TOUT CE QUI NE VIENT PAS DE NOUS EST JETÉ. Décider avec un « effectif » de
  // -3, de 2,5 ou de NaN serait décider sur du bruit.
  test.each([
    ["pas du JSON", "n'importe quoi"],
    ["un JSON qui n'est pas un objet", '"25"'],
    ["un club manquant", '{"memberCount":25}'],
    ["un nombre manquant", '{"clubId":"club-1"}'],
    ["un nombre négatif", '{"clubId":"club-1","memberCount":-3}'],
    ["un nombre décimal", '{"clubId":"club-1","memberCount":2.5}'],
    ["un nombre qui n'en est pas un", '{"clubId":"club-1","memberCount":"25"}'],
  ])("une valeur corrompue (%s) vaut « rien de mémorisé »", async (_cas, brut) => {
    await AsyncStorage.setItem(STORAGE_KEYS.COACH_ROSTER_SIZE("coach-1"), brut);
    expect(await lireEffectifMemorise("coach-1", "club-1")).toBeNull();
  });

  test("un effectif invalide n'est jamais écrit", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", -1);
    await memoriserEffectifCoach("coach-1", "club-1", 1.5);
    await memoriserEffectifCoach("coach-1", "club-1", Number.NaN);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.COACH_ROSTER_SIZE("coach-1"))).toBeNull();
  });

  // UN STOCKAGE EN PANNE NE BLOQUE RIEN. La mémoire est un confort de démarrage :
  // son échec doit valoir « rien de mémorisé », jamais une exception qui
  // remonterait jusqu'au portillon.
  test("un stockage en panne ne lève jamais et vaut « rien de mémorisé »", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("disque"));
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("disque"));
    jest.spyOn(AsyncStorage, "removeItem").mockRejectedValue(new Error("disque"));
    await expect(memoriserEffectifCoach("coach-1", "club-1", 25)).resolves.toBeUndefined();
    await expect(lireEffectifMemorise("coach-1", "club-1")).resolves.toBeNull();
    await expect(oublierEffectifCoach("coach-1")).resolves.toBeUndefined();
  });
});
