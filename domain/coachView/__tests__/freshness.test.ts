// domain/coachView/__tests__/freshness.test.ts
// Fraîcheur des données : l'espace coach ne doit jamais laisser croire au temps réel.

import { buildFreshness, buildFreshnessLabel, FRAICHEUR_PERIMEE_MIN } from "../freshness";

const NOW = Date.parse("2026-07-27T14:32:00.000Z");
const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

describe("buildFreshness", () => {
  test("jamais synchronisé → dit tel quel", () => {
    expect(buildFreshness(null, NOW)).toEqual({
      libelle: "Données jamais synchronisées",
      ageMinutes: null,
      perimee: true,
    });
    expect(buildFreshness(0, NOW).ageMinutes).toBeNull();
    expect(buildFreshness(Number.NaN, NOW).ageMinutes).toBeNull();
  });

  test("moins d'une minute → à l'instant", () => {
    expect(buildFreshnessLabel(NOW - 10_000, NOW)).toBe("Mis à jour à l'instant");
  });

  test("quelques minutes → relatif", () => {
    expect(buildFreshnessLabel(NOW - 3 * MINUTE, NOW)).toBe("Mis à jour il y a 3 min");
    expect(buildFreshnessLabel(NOW - 59 * MINUTE, NOW)).toBe("Mis à jour il y a 59 min");
  });

  test("même journée mais plus d'une heure → heure exacte", () => {
    const updated = NOW - 3 * HEURE;
    const attendu = new Date(updated);
    const hhmm = `${String(attendu.getHours()).padStart(2, "0")}:${String(attendu.getMinutes()).padStart(2, "0")}`;
    // Peut basculer sur "hier" selon le fuseau : les deux formes restent honnêtes.
    expect(buildFreshnessLabel(updated, NOW)).toMatch(
      new RegExp(`^Mis à jour (hier )?à ${hhmm}$`),
    );
  });

  test("plusieurs jours → date + heure", () => {
    expect(buildFreshnessLabel(NOW - 5 * 24 * HEURE, NOW)).toMatch(
      /^Mis à jour le \d{2}\/\d{2} à \d{2}:\d{2}$/,
    );
  });

  test("âge en minutes et péremption", () => {
    expect(buildFreshness(NOW - 5 * MINUTE, NOW).ageMinutes).toBe(5);
    expect(buildFreshness(NOW - 5 * MINUTE, NOW).perimee).toBe(false);
    expect(buildFreshness(NOW - FRAICHEUR_PERIMEE_MIN * MINUTE, NOW).perimee).toBe(true);
  });

  test("horloge du téléphone en retard → jamais de mise à jour 'dans le futur'", () => {
    const res = buildFreshness(NOW + 10 * MINUTE, NOW);
    expect(res.libelle).toBe("Mis à jour à l'instant");
    expect(res.ageMinutes).toBe(0);
  });

  test("fonction pure : même entrée, même sortie", () => {
    expect(buildFreshness(NOW - 7 * MINUTE, NOW)).toEqual(buildFreshness(NOW - 7 * MINUTE, NOW));
  });
});
