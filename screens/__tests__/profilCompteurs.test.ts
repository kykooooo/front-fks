// screens/__tests__/profilCompteurs.test.ts
//
// LES DEUX COMPTEURS MENTEURS DE « TA RÉGULARITÉ » (audit Profil P0-3/P0-4,
// re-scopés P1 à l'inventaire clubs 15/08) :
//
//  1. « Club / match : 0 sem » à vie — computeStreakStats recevait un tableau
//     vide CODÉ EN DUR à la place des charges externes, alors que le store les
//     contient (auto-appliquées depuis les jours déclarés au setup).
//  2. « Tests ce mois » ne comptait AUCUN test terrain : il comptait les
//     séances de course (une batterie faite → 0 ; un footing → 1).
//
// Partie exécutée : computeStreakStats avec de vraies charges prouve que le
// câblage suffit. Partie source : le câblage reste en place côté écran.

import { readFileSync } from "fs";
import { resolve } from "path";
import { computeStreakStats } from "../../utils/streakStats";

const source = readFileSync(
  resolve(__dirname, "..", "ProfileScreen.tsx"),
  "utf8"
);

describe("« Club / match » — câblé sur les charges réelles", () => {
  test("EXÉCUTÉ : la fonction sait compter dès qu'on lui passe les données", () => {
    const nowISO = "2026-08-15T12:00:00.000Z";
    // Le tableau vide d'avant : 0 pour toujours.
    expect(computeStreakStats([] as any, [] as any, nowISO).weeksClubMatch).toBe(0);
    // Les charges qu'a réellement le store d'un joueur à jours déclarés.
    const charges = [
      { source: "club", dateISO: "2026-08-11T18:00:00.000Z" },
      { source: "match", dateISO: "2026-08-08T15:00:00.000Z" },
    ];
    expect(
      computeStreakStats([] as any, charges as any, nowISO).weeksClubMatch
    ).toBeGreaterThanOrEqual(1);
  });

  test("SOURCE : l'écran passe externalLoads, plus jamais [] en dur", () => {
    expect(source).toMatch(/computeStreakStats\(sessions as any, externalLoads as any/);
    expect(source).not.toMatch(/computeStreakStats\([^)]*\[\] as any/);
    expect(source).toMatch(/useExternalStore\(\(s\) => s\.externalLoads \?\? \[\]\)/);
  });
});

describe("« Tests ce mois » — la vraie source, pas l'heuristique course", () => {
  test("la ligne et le trophée lisent monthlyTestsCount (relevés de tests)", () => {
    expect(source).toMatch(/label: 'Tests ce mois', value: monthlyTestsCount/);
    expect(source).toMatch(/make\('vma', 'Tests du mois', monthlyTestsCount/);
    // L'heuristique « VMA-like » ne pilote plus aucun affichage du Profil.
    expect(source).not.toMatch(/streaks\.monthlyVmaCount/);
  });

  test("le compte du mois est borné au mois local courant", () => {
    expect(source).toMatch(/new Date\(now\.getFullYear\(\), now\.getMonth\(\), 1\)/);
  });
});
