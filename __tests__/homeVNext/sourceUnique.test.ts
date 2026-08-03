// __tests__/homeVNext/sourceUnique.test.ts
// =============================================================================
// INTEGRATION L2 — UNE SEULE SOURCE DE VERITE PAR REGLE
// =============================================================================
//
// Le prototype vivait seul : il redeclarait des seuils que le moteur possede
// deja, et calculait le jour d'un test en UTC pour rendre ses captures
// reproductibles. Les deux se voient a l'ecran, et les deux se contredisent avec
// le reste de l'app des qu'on les branche pour de vrai.
//
// Ce fichier verrouille les deux corrections, et il est ecrit pour ECHOUER si
// quelqu'un les defait :
//
//  1. LE SEUIL DE REPRISE DERIVE DU MOTEUR. Deux constantes qui valent 14
//     aujourd'hui « par hasard documentaire » n'est pas une source unique : un
//     reglage moteur les ferait diverger en silence, et l'app dirait « reprise »
//     sur un ecran et « tout va bien » sur l'autre, a un tap d'intervalle. Le
//     test compare les deux valeurs A L'EXECUTION, il ne recopie pas 14.
//
//  2. LE JOUR D'UN TEST EST LE JOUR VECU. La regle « deux jours distincts »
//     protege d'un faux progres fabrique par deux essais du meme jour. Calculee
//     en UTC, elle se retournait contre elle-meme : en fuseau France, un test
//     passe apres minuit tombait la VEILLE, donc deux essais de la meme journee
//     devenaient « deux dates differentes » et produisaient une comparaison.
//     Le cas est construit en heure LOCALE (`new Date(annee, mois, jour, h)`),
//     donc le test dit la meme chose quel que soit le fuseau de la machine.
// =============================================================================

import { TRACKING_CONFIG } from "../../domain/tracking/config";
import { toDateKey } from "../../utils/dateHelpers";
import type { TestEntry } from "../../screens/tests/testConfig";
import { construireComparaisonsTests } from "../../screens/homeVNext/progressionViewModel";
import { JOURS_SANS_SEANCE_POUR_REPRISE, HOME_VNEXT_SEUILS } from "../../screens/homeVNext/viewModel";

describe("le seuil de reprise a une seule source", () => {
  it("derive de TRACKING_CONFIG.resumption.gapDaysSoft, pas d'un nombre recopie", () => {
    expect(JOURS_SANS_SEANCE_POUR_REPRISE).toBe(TRACKING_CONFIG.resumption.gapDaysSoft);
  });

  it("reste expose au visualiseur : deriver n'est pas supprimer", () => {
    const seuil = HOME_VNEXT_SEUILS.find((s) => s.nom === "JOURS_SANS_SEANCE_POUR_REPRISE");
    expect(seuil).toBeDefined();
    expect(seuil!.valeur).toBe(TRACKING_CONFIG.resumption.gapDaysSoft);
  });

  it("reste en deca du seuil dur du moteur : une reprise douce n'est pas une reprise longue", () => {
    expect(JOURS_SANS_SEANCE_POUR_REPRISE).toBeLessThan(TRACKING_CONFIG.resumption.gapDaysHard);
  });
});

describe("le jour d'un test est le jour LOCAL", () => {
  /** Horodatage d'un instant donne en heure LOCALE de la machine. */
  const localTs = (an: number, moisZeroBase: number, jour: number, h: number, min = 0) =>
    new Date(an, moisZeroBase, jour, h, min, 0, 0).getTime();

  it("deux essais de la MEME journee locale ne font pas une progression, meme a cheval sur minuit UTC", () => {
    // 00 h 30 puis 22 h 00, le meme jour vecu par le joueur.
    // En fuseau France, le premier tombe la VEILLE en UTC : l'ancienne regle y
    // voyait deux dates differentes et fabriquait une comparaison.
    const tests: TestEntry[] = [
      { ts: localTs(2026, 6, 20, 0, 30), broadJumpCm: 210 },
      { ts: localTs(2026, 6, 20, 22, 0), broadJumpCm: 240 },
    ];
    const etat = construireComparaisonsTests(tests);
    expect(etat.possible).toBe(false);
    if (etat.possible) throw new Error("inatteignable");
    // Deux tests sont bien enregistres : ce qui manque, c'est la PAIRE — parce
    // qu'un champ mesure deux fois le meme jour ne se compare pas a lui-meme.
    expect(etat.raison).toBe("aucune_paire_comparable");
  });

  it("deux journees locales distinctes restent comparables", () => {
    const tests: TestEntry[] = [
      { ts: localTs(2026, 6, 20, 22, 0), broadJumpCm: 210 },
      { ts: localTs(2026, 6, 21, 0, 30), broadJumpCm: 240 },
    ];
    const etat = construireComparaisonsTests(tests);
    if (!etat.possible) throw new Error("comparaison attendue possible");
    expect(etat.comparaisons).toHaveLength(1);
    expect(etat.comparaisons[0].sens).toBe("amelioration");
  });

  it("les jours affiches sont ceux de toDateKey, le helper partage du depot", () => {
    const tsAvant = localTs(2026, 6, 20, 22, 0);
    const tsApres = localTs(2026, 6, 21, 0, 30);
    const etat = construireComparaisonsTests([
      { ts: tsAvant, broadJumpCm: 210 },
      { ts: tsApres, broadJumpCm: 240 },
    ]);
    if (!etat.possible) throw new Error("comparaison attendue possible");
    expect(etat.comparaisons[0].avantJour).toBe(toDateKey(new Date(tsAvant)));
    expect(etat.comparaisons[0].apresJour).toBe(toDateKey(new Date(tsApres)));
  });
});
