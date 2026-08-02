// domain/coachView/__tests__/week.test.ts
// Synthèse hebdo : tout compteur annoncé "cette semaine" DOIT être calculé sur
// les bornes réelles lundi→dimanche, jamais sur une fenêtre glissante de 7 jours.

import { buildWeekDigest, weekDayKeys } from "../week";
import { makeView } from "./fixtures";

const LUNDI = "2026-07-27";
const MERCREDI = "2026-07-29";

describe("weekDayKeys", () => {
  test("7 jours du lundi au dimanche", () => {
    expect(weekDayKeys(LUNDI)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  test("semaine à cheval sur deux mois", () => {
    expect(weekDayKeys("2026-06-29")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
  });

  test("clé de semaine invalide → aucune journée (pas de semaine inventée)", () => {
    expect(weekDayKeys("2026-02-30")).toEqual([]);
  });
});

describe("buildWeekDigest — bornes réelles de la semaine", () => {
  test("une séance de la semaine PRÉCÉDENTE ne compte pas, même à 5 jours", () => {
    // 24 juillet = vendredi de la semaine d'avant : dans les 7 jours glissants,
    // hors de la semaine en cours. C'est exactement le défaut à ne pas reproduire.
    const view = makeView(
      { playerUid: "u1", activity: { doneDateKeys: ["2026-07-28", "2026-07-24"] } },
      MERCREDI,
    );
    const digest = buildWeekDigest([view], LUNDI, MERCREDI);
    expect(digest.seancesFaites).toBe(1);
    expect(digest.membresActifs).toBe(1);
  });

  test("jours écoulés bornés à aujourd'hui", () => {
    const digest = buildWeekDigest([], LUNDI, MERCREDI);
    expect(digest.jours).toHaveLength(7);
    expect(digest.joursEcoules).toEqual(["2026-07-27", "2026-07-28", "2026-07-29"]);
    expect(digest.debut).toBe("2026-07-27");
    expect(digest.fin).toBe("2026-08-02");
  });

  test("semaine à cheval sur deux mois : les deux mois comptent", () => {
    const view = makeView(
      { playerUid: "u1", activity: { doneDateKeys: ["2026-06-30", "2026-07-02"] } },
      "2026-07-05",
    );
    const digest = buildWeekDigest([view], "2026-06-29", "2026-07-05");
    expect(digest.seancesFaites).toBe(2);
  });
});

describe("buildWeekDigest — honnêteté des compteurs", () => {
  test("sans fenêtre d'activité, un joueur n'est PAS compté à zéro séance", () => {
    const sansDonnees = makeView(
      { playerUid: "u1", lastActivity: { dateKey: "2026-07-28", durationMin: 40 } },
      MERCREDI,
    );
    const digest = buildWeekDigest([sansDonnees], LUNDI, MERCREDI);
    expect(digest.membres).toBe(1);
    expect(digest.membresAvecDonnees).toBe(0);
    expect(digest.membresSansDonnees).toBe(1);
    expect(digest.seancesFaites).toBe(0);
    expect(digest.membresSansSeance).toBe(0); // on ne l'accuse pas d'être inactif
    expect(digest.phrases.join(" ")).toContain("Aucune donnée d'activité disponible");
  });

  test("groupe mixte : suivis, actifs, inactifs, sans données", () => {
    const actif = makeView(
      { playerUid: "actif", activity: { doneDateKeys: ["2026-07-28", "2026-07-27"] } },
      MERCREDI,
    );
    const inactif = makeView(
      { playerUid: "inactif", activity: { doneDateKeys: ["2026-07-10"] } },
      MERCREDI,
    );
    const aveugle = makeView({ playerUid: "aveugle" }, MERCREDI);

    const digest = buildWeekDigest([actif, inactif, aveugle], LUNDI, MERCREDI);
    expect(digest.membres).toBe(3);
    expect(digest.membresAvecDonnees).toBe(2);
    expect(digest.membresSansDonnees).toBe(1);
    expect(digest.seancesFaites).toBe(2);
    expect(digest.membresActifs).toBe(1);
    expect(digest.membresSansSeance).toBe(1);
    expect(digest.phrases[1]).toBe("2 séances réalisées cette semaine par 1 joueur sur 2 suivis.");
  });

  test("les états instantanés sont annoncés 'Aujourd'hui', jamais 'cette semaine'", () => {
    // Séance prévue lundi, dernière séance faite le 20 → à vérifier aujourd'hui.
    const aVerifier = makeView(
      {
        playerUid: "u1",
        activity: { doneDateKeys: ["2026-07-20"] },
        lastPlanned: {
          dateKey: "2026-07-27",
          title: null,
          focusLabel: null,
          intensityLabel: null,
          durationMin: null,
          blockCount: null,
        },
      },
      MERCREDI,
    );
    const aSurveiller = makeView({ playerUid: "u2", profileComplete: false }, MERCREDI);
    const digest = buildWeekDigest([aVerifier, aSurveiller], LUNDI, MERCREDI);
    expect(digest.aVerifier).toBe(1);
    expect(digest.aSurveiller).toBe(1);
    const phrase = digest.phrases.find((p) => p.startsWith("Aujourd'hui"));
    expect(phrase).toBeDefined();
    expect(phrase).not.toContain("cette semaine");
  });

  test("historique saturé → couverture annoncée comme possiblement incomplète", () => {
    // Le coach consulte une semaine ANCIENNE (29 juin → 5 juillet) alors que
    // l'historique disponible ne remonte qu'au 6 juillet : le "0 séance" affiché
    // n'est pas une mesure, et l'écran doit le dire.
    const dates = Array.from({ length: 14 }, (_, i) => `2026-07-${String(6 + i).padStart(2, "0")}`);
    const view = makeView({ playerUid: "u1", activity: { doneDateKeys: dates } }, MERCREDI);
    expect(view.datesSeancesFaites).toHaveLength(14);

    const digest = buildWeekDigest([view], "2026-06-29", MERCREDI);
    expect(digest.seancesFaites).toBe(0);
    expect(digest.couvertureIncomplete).toBe(true);
    expect(digest.phrases.join(" ")).toContain("possiblement incomplet");
  });

  test("groupe vide → phrase honnête, aucun chiffre inventé", () => {
    const digest = buildWeekDigest([], LUNDI, MERCREDI);
    expect(digest.membres).toBe(0);
    expect(digest.seancesFaites).toBe(0);
    expect(digest.phrases.join(" ")).toContain("Aucun membre");
  });

  test("mot de membre configurable (clubs féminins)", () => {
    const view = makeView({ playerUid: "u1" }, MERCREDI);
    const digest = buildWeekDigest([view], LUNDI, MERCREDI, { memberWord: "joueuse" });
    expect(digest.phrases.join(" ")).toContain("1 joueuse");
  });

  test("aucune formulation prédictive ni jargon", () => {
    const view = makeView(
      { playerUid: "u1", activity: { doneDateKeys: ["2026-07-28"] } },
      MERCREDI,
    );
    const texte = buildWeekDigest([view], LUNDI, MERCREDI).phrases.join(" ").toLowerCase();
    for (const mot of ["risque", "prédiction", "va ", "devrait", "tsb", "atl", "ctl", "rpe"]) {
      expect(texte).not.toContain(mot);
    }
  });
});
