// state/migration/__tests__/migrateInjuries.test.ts
//
// LA REPRISE DES BLESSURES HISTORIQUES DOIT ETRE REJOUABLE SANS DEGATS.
//
// Le risque reel n'est pas qu'elle rate : c'est qu'elle tourne DEUX FOIS. Le
// store se rehydrate en parallele des autres, `resetForUser` la rappelle apres
// un changement de compte, et un joueur peut lancer l'app dix fois par jour.
// Une reprise non idempotente, c'est la meme entorse listee cinq fois dans
// « Mon corps » — et cinq fois la meme contrainte envoyee au moteur.

import { migrerDayStatesVersMonCorps, lancerMigrationBlessures } from "../migrateInjuries";
import { useBodyStore, getBodyDefaults } from "../../stores/useBodyStore";
import { useFeedbackStore } from "../../stores/useFeedbackStore";
import { useDebugStore } from "../../stores/useDebugStore";
import { INJURY_ACTIVE_WINDOW_DAYS } from "../../../services/aiContextHelpers";
import { lastNDates } from "../../../utils/dateHelpers";
import type { DayState, InjuryArea, InjuryRecord } from "../../../domain/types";

const TODAY = "2026-07-11";
const JOURS = lastNDates(TODAY, INJURY_ACTIVE_WINDOW_DAYS + 3);

function injury(area: InjuryArea, severity: 0 | 1 | 2 | 3, note?: string): InjuryRecord {
  return {
    area,
    severity,
    type: "aigu",
    restrictions: {},
    startDate: `${TODAY}T08:00:00.000Z`,
    lastConfirm: `${TODAY}T08:00:00.000Z`,
    ...(note ? { note } : {}),
  };
}

function jour(date: string, blessure: InjuryRecord | null): DayState {
  return {
    date,
    feedback: { fatigue: 3, injury: blessure, timestamp: `${date}T20:00:00.000Z` },
    adaptive: { fatigueFactor: 1, painFactor: 1, combined: 1, fatigueSmoothed: 3 },
  };
}

describe("migrerDayStatesVersMonCorps — ce qui est repris, et ce qui ne l'est pas", () => {
  test("une déclaration dans la fenêtre devient une gêne active, source feedback", () => {
    const reprises = migrerDayStatesVersMonCorps(
      { [JOURS[1]]: jour(JOURS[1], injury("genou", 2, "ça tire à la descente")) },
      TODAY
    );
    expect(reprises).toHaveLength(1);
    expect(reprises[0]).toMatchObject({
      zone: "genou",
      gravite: 2,
      statut: "active",
      source: "feedback",
      note: "ça tire à la descente",
    });
    expect(reprises[0].declaredAt.slice(0, 10)).toBe(JOURS[1]);
  });

  test("hors fenêtre (J-7) : rien. On ne réveille pas une gêne que l'app avait déjà oubliée", () => {
    const passe = JOURS[INJURY_ACTIVE_WINDOW_DAYS];
    expect(migrerDayStatesVersMonCorps({ [passe]: jour(passe, injury("cheville", 3)) }, TODAY)).toEqual([]);
  });

  test("sévérité 0 (l'ancien « OK » = levée explicite) ne crée aucune gêne", () => {
    expect(
      migrerDayStatesVersMonCorps({ [JOURS[0]]: jour(JOURS[0], injury("genou", 0)) }, TODAY)
    ).toEqual([]);
  });

  test("par zone, la déclaration la plus récente fait foi", () => {
    const reprises = migrerDayStatesVersMonCorps(
      {
        [JOURS[4]]: jour(JOURS[4], injury("genou", 3)),
        [JOURS[1]]: jour(JOURS[1], injury("genou", 1)),
      },
      TODAY
    );
    expect(reprises).toHaveLength(1);
    expect(reprises[0].gravite).toBe(1);
  });

  test("une levée récente l'emporte sur une déclaration plus ancienne de la même zone", () => {
    expect(
      migrerDayStatesVersMonCorps(
        {
          [JOURS[3]]: jour(JOURS[3], injury("genou", 2)),
          [JOURS[1]]: jour(JOURS[1], injury("genou", 0)),
        },
        TODAY
      )
    ).toEqual([]);
  });

  test("zone inconnue : ignorée, jamais rangée dans « autre » à la place du joueur", () => {
    const bidon = { ...injury("genou", 2), area: "orteil" as InjuryArea };
    expect(migrerDayStatesVersMonCorps({ [JOURS[0]]: jour(JOURS[0], bidon) }, TODAY)).toEqual([]);
  });

  test("aucun dayState → liste VIDE (pas un objet de remplissage)", () => {
    expect(migrerDayStatesVersMonCorps({}, TODAY)).toEqual([]);
    expect(migrerDayStatesVersMonCorps(undefined, TODAY)).toEqual([]);
    expect(migrerDayStatesVersMonCorps({ [JOURS[0]]: jour(JOURS[0], null) }, TODAY)).toEqual([]);
  });

  test("plusieurs zones simultanées : toutes reprises (l'objet unique était une limite front)", () => {
    const reprises = migrerDayStatesVersMonCorps(
      {
        [JOURS[2]]: jour(JOURS[2], injury("mollet", 1)),
        [JOURS[0]]: jour(JOURS[0], injury("dos", 3)),
      },
      TODAY
    );
    expect(reprises.map((r) => r.zone).sort()).toEqual(["dos", "mollet"]);
  });

  test("identifiant DÉTERMINISTE : deux appels produisent exactement la même liste", () => {
    const dayStates = { [JOURS[1]]: jour(JOURS[1], injury("genou", 2)) };
    expect(migrerDayStatesVersMonCorps(dayStates, TODAY)).toEqual(
      migrerDayStatesVersMonCorps(dayStates, TODAY)
    );
  });
});

describe("lancerMigrationBlessures — idempotence sur les stores réels", () => {
  beforeEach(() => {
    useBodyStore.setState({ ...getBodyDefaults() } as any);
    useFeedbackStore.setState({ dayStates: {} } as any);
    useDebugStore.setState({ devNowISO: `${TODAY}T10:00:00.000Z` } as any);
  });

  test("la rejouer trois fois produit exactement la même liste", () => {
    useFeedbackStore.setState({
      dayStates: {
        [JOURS[1]]: jour(JOURS[1], injury("genou", 2)),
        [JOURS[3]]: jour(JOURS[3], injury("cheville", 1)),
      },
    } as any);

    lancerMigrationBlessures();
    const apresUn = useBodyStore.getState().bodyInjuries;
    lancerMigrationBlessures();
    lancerMigrationBlessures();

    expect(useBodyStore.getState().bodyInjuries).toEqual(apresUn);
    expect(apresUn).toHaveLength(2);
    expect(useBodyStore.getState().migrationFeedbackAt).toBeTruthy();
  });

  test("même si le marqueur est perdu, la clé zone + jour empêche le doublon", () => {
    useFeedbackStore.setState({ dayStates: { [JOURS[1]]: jour(JOURS[1], injury("genou", 2)) } } as any);
    lancerMigrationBlessures();
    expect(useBodyStore.getState().bodyInjuries).toHaveLength(1);

    // Marqueur effacé à la main : la deuxième garde doit tenir seule.
    useBodyStore.setState({ migrationFeedbackAt: null } as any);
    lancerMigrationBlessures();

    expect(useBodyStore.getState().bodyInjuries).toHaveLength(1);
  });

  test("aucun dayState : le marqueur est posé, la liste reste vide", () => {
    lancerMigrationBlessures();
    expect(useBodyStore.getState().bodyInjuries).toEqual([]);
    expect(useBodyStore.getState().migrationFeedbackAt).toBeTruthy();
  });

  test("une gêne déclarée à la main AVANT la reprise n'est jamais écrasée", () => {
    useBodyStore.getState().ajouterBlessure({
      zone: "dos",
      gravite: 3,
      source: "manual",
      nowISO: `${TODAY}T09:00:00.000Z`,
    });
    useFeedbackStore.setState({ dayStates: { [JOURS[1]]: jour(JOURS[1], injury("genou", 2)) } } as any);

    lancerMigrationBlessures();

    const zones = useBodyStore.getState().bodyInjuries.map((b) => b.zone).sort();
    expect(zones).toEqual(["dos", "genou"]);
    expect(useBodyStore.getState().bodyInjuries.find((b) => b.zone === "dos")?.gravite).toBe(3);
  });
});
