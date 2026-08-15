// screens/__tests__/profilFormeCompteNeuf.test.ts
//
// LE PROFIL PRÉTEND-IL ENCORE CONNAÎTRE LA FORME D'UN COMPTE NEUF ?
//
// Deux mensonges relevés par l'audit Profil (07/08, P0-1/P0-2) et re-prouvés
// par exécution à l'inventaire clubs (15/08) :
//  1. TSB compte neuf = CTL0−ATL0 = +3 (constantes d'amorçage) → la puce ÉTAT
//     et la carte « Ta forme » affichaient « En forme — Prêt à performer,
//     c'est le moment d'envoyer. » à un joueur inscrit depuis 2 minutes.
//     Scénario club : 15 joueurs installent, 15 profils identiques « En
//     forme » vert — le chiffre est visiblement inventé.
//  2. Le graphe bouchait chaque trou d'historique avec le TSB du jour
//     (`tsbHistory[idx] ?? tsb`) : compte neuf = 7 barres identiques à +3,
//     étiquetées J…J-6 comme si c'étaient des jours vécus.
//
// Le correctif suit la règle 12 (donnée absente = absente, jamais une amorce)
// avec la même porte que la carte Progression du Home : rien ne s'affirme
// avant la première séance validée. Ces tests lisent la SOURCE pour empêcher
// les deux motifs de revenir (le rendu réel = recette téléphone).

import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "..", "ProfileScreen.tsx"),
  "utf8"
);

describe("Profil — la forme n'existe qu'après une séance validée (règle 12)", () => {
  test("la porte hasFormData repose sur les séances validées", () => {
    expect(source).toMatch(/const hasFormData = completedCount > 0/);
  });

  test("la puce ÉTAT et sa couleur passent par la porte", () => {
    expect(source).toMatch(/const tsbLabel = hasFormData \? footballStatus\.label : '—'/);
    expect(source).toMatch(/const tsbColor = hasFormData \? footballStatus\.color :/);
  });

  test("l'état vide est un état à part entière, pas un zéro déguisé", () => {
    expect(source).toContain("Pas encore de données");
    expect(source).toContain(
      "Ta forme se calcule sur tes séances validées. Termine ta première séance pour la voir ici."
    );
  });
});

describe("Profil — le graphe de forme ne fabrique plus de barres", () => {
  test("le motif `tsbHistory[idx] ?? tsb` a disparu", () => {
    // C'était LA ligne qui inventait une semaine d'historique (P0-2).
    expect(source).not.toMatch(/tsbHistory\[\w+\]\s*\?\?\s*tsb/);
  });

  test("les barres viennent des relevés réels du store", () => {
    expect(source).toMatch(/const formBars = useMemo\(\(\) => tsbHistory\.slice\(0, 7\)/);
    expect(source).toMatch(/formBars\.length >= 2/);
    expect(source).toContain("Encore trop peu de relevés pour tracer une tendance.");
  });

  test("plus d'étiquettes calendaires J…J-6 sur une série par événement", () => {
    // barLbl reste légitime sur « Intensité 7 jours » (série par jour réel,
    // zéros vrais) — mais le graphe de FORME ne doit plus s'en servir.
    const blocForme = source.match(/Ta forme — derniers relevés[\s\S]*?<\/View>\s*\)\s*:/);
    expect(blocForme).not.toBeNull();
    expect(blocForme![0]).not.toContain("barLbl(");
  });

  test("une tendance exige au moins 2 relevés réels", () => {
    expect(source).toMatch(/const showTrend = hasFormData && tsbHistory\.length >= 2/);
    // Le badge de tendance ne coiffe plus « Ta régularité » (mislabel) :
    // il ne vit que sur « Ta forme », derrière showTrend.
    expect(source).toMatch(/<SectionHeader title="Ta régularité" \/>/);
  });
});
