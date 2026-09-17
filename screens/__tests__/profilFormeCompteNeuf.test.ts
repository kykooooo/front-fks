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

  test("la puce ÉTAT d'un compte neuf affiche « — », jamais un verdict", () => {
    // Le texte d'état vide de l'ancienne carte « Ta forme » est parti avec
    // elle ; la porte reste sur la seule lecture du TSB qui subsiste (le héro).
    expect(source).toMatch(/\{tsbLabel\}/);
    // Aucun libellé de forme n'est écrit en dur dans l'écran : tout vient de
    // getFootballLabel, derrière la porte.
    expect(source).not.toMatch(/label: ['"]En forme/);
  });
});

describe("Profil — le graphe de forme n'y vit plus (2026-09)", () => {
  test("le motif `tsbHistory[idx] ?? tsb` a disparu, et le graphe avec lui", () => {
    // C'était LA ligne qui inventait une semaine d'historique (P0-2). La carte
    // « Ta forme » (TSB + intensité 7 jours) faisait doublon avec la page
    // Progression, qui porte la seule courbe honnête : le Profil y mène.
    expect(source).not.toMatch(/tsbHistory\[\w+\]\s*\?\?\s*tsb/);
    expect(source).not.toContain("tsbHistory");
    expect(source).not.toContain("formBars");
    expect(source).not.toContain('title="Ta forme"');
    expect(source).not.toContain('title="Ta régularité"');
    expect(source).toContain("nav.navigate('Progression')");
  });
});
