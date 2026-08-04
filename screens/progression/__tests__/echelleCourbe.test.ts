// screens/progression/__tests__/echelleCourbe.test.ts
// =============================================================================
// LA COURBE NE MENT PAS SUR SES VALEURS
// =============================================================================
//
// Ce fichier verrouille la correction d'un defaut que ni tsc, ni eslint, ni un
// test de rendu ne pouvaient voir : la page Progression dessinait sa courbe sur
// un axe FIGE (-20 a +20) et rabotait les valeurs qui en sortaient.
//
// Le rabotage etait inoffensif TANT QUE la serie etait amorcee sur ATL0/CTL0 :
// elle vivait au milieu de l'intervalle. La serie purgee part de zero, le CTL
// monte deux fois plus lentement que l'ATL, et un joueur assidu passe donc
// regulierement sous -20 — ou l'ecran dessinait -20 a sa place.
//
// Les tests ci-dessous ECHOUENT sur l'ancienne forme :
//   - `axe fige` reproduit exactement l'ancien calcul et montre deux valeurs
//     distinctes ecrasees sur le meme pixel ;
//   - la sentinelle de fin lit le fichier de l'ecran et refuse le retour des
//     bornes en dur.
// =============================================================================

import { readFileSync } from "fs";
import { join } from "path";

import { updateTrainingLoad } from "../../../engine/loadModel";
import {
  calculerEchelleCourbe,
  versYCourbe,
  zeroEstDansLEchelle,
  type GeometrieCourbe,
} from "../echelleCourbe";

/** La geometrie reelle du trace de `screens/ProgressScreen.tsx`. */
const GEOMETRIE: GeometrieCourbe = { hauteur: 110, marge: 8 };

/** L'ancien calcul, recopie tel quel, pour montrer ce qu'il produisait. */
function ancienVersY(valeur: number): number {
  const tsbMin = -20;
  const tsbMax = 20;
  const borne = Math.max(tsbMin, Math.min(tsbMax, valeur));
  const ratio = (borne - tsbMin) / (tsbMax - tsbMin);
  return GEOMETRIE.marge + (1 - ratio) * (GEOMETRIE.hauteur - GEOMETRIE.marge * 2);
}

/**
 * Une trajectoire de joueur assidu, calculee avec les VRAIES constantes du
 * depot : trois seances par semaine, charge quotidienne plausible, ATL et CTL
 * partant de zero comme le fait `construireSerieForme`.
 */
function serieJoueurAssidu(jours = 30): number[] {
  let atl = 0;
  let ctl = 0;
  const points: number[] = [];
  for (let i = 0; i < jours; i++) {
    // Lundi / mercredi / vendredi, comme le rythme declare le plus courant.
    const charge = i % 7 === 0 || i % 7 === 2 || i % 7 === 4 ? 173.5 : 0;
    const suivant = updateTrainingLoad(atl, ctl, charge, { dtDays: 1 });
    atl = suivant.atl;
    ctl = suivant.ctl;
    points.push(Number(suivant.tsb.toFixed(1)));
  }
  return points;
}

// -----------------------------------------------------------------------------
// 1. Le defaut lui-meme
// -----------------------------------------------------------------------------

describe("l'ancien axe fige ecrasait des valeurs reelles", () => {
  test("une serie de joueur assidu descend bel et bien sous l'ancien plancher", () => {
    const serie = serieJoueurAssidu();
    const sousLePlancher = serie.filter((v) => v < -20);
    // Si ce compte tombait a zero, la correction n'aurait plus d'objet : le test
    // le dit franchement plutot que de le supposer.
    expect(sousLePlancher.length).toBeGreaterThan(0);
  });

  test("deux jours differents finissaient sur le MEME pixel", () => {
    const a = -21.2;
    const b = -25.4;
    expect(a).not.toBe(b);
    // L'ancien calcul : deux mesures distinctes, un seul point dessine.
    expect(ancienVersY(a)).toBe(ancienVersY(b));

    // Le nouveau : deux valeurs distinctes, deux positions distinctes.
    const echelle = calculerEchelleCourbe([a, b, -10])!;
    expect(versYCourbe(a, echelle, GEOMETRIE)).not.toBe(versYCourbe(b, echelle, GEOMETRIE));
  });

  test("aucun point d'une serie reelle n'est plus ecrase sur un voisin", () => {
    const serie = serieJoueurAssidu();
    const echelle = calculerEchelleCourbe(serie)!;
    const distinctes = new Set(serie);
    const positions = new Set(
      Array.from(distinctes).map((v) => versYCourbe(v, echelle, GEOMETRIE).toFixed(6))
    );
    expect(positions.size).toBe(distinctes.size);
  });
});

// -----------------------------------------------------------------------------
// 2. L'echelle
// -----------------------------------------------------------------------------

describe("calculerEchelleCourbe", () => {
  test("prend ses bornes dans la serie, pas dans une constante", () => {
    expect(calculerEchelleCourbe([-31.4, -22, -18.5])).toEqual({
      min: -31.4,
      max: -18.5,
      plate: false,
    });
  });

  test("une serie plate est signalee comme telle", () => {
    const echelle = calculerEchelleCourbe([-4, -4, -4])!;
    expect(echelle.plate).toBe(true);
  });

  test("rend null plutot qu'une echelle batie sur du vide ou du NaN", () => {
    expect(calculerEchelleCourbe([])).toBeNull();
    expect(calculerEchelleCourbe([1, Number.NaN, 3])).toBeNull();
    expect(calculerEchelleCourbe([1, Number.POSITIVE_INFINITY])).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 3. Le placement
// -----------------------------------------------------------------------------

describe("versYCourbe", () => {
  test("le minimum touche le bas de la zone utile, le maximum le haut", () => {
    const echelle = calculerEchelleCourbe([-31.4, -18.5])!;
    expect(versYCourbe(-18.5, echelle, GEOMETRIE)).toBeCloseTo(GEOMETRIE.marge, 6);
    expect(versYCourbe(-31.4, echelle, GEOMETRIE)).toBeCloseTo(
      GEOMETRIE.hauteur - GEOMETRIE.marge,
      6
    );
  });

  test("tous les points d'une serie reelle tiennent dans la zone de dessin", () => {
    const serie = serieJoueurAssidu();
    const echelle = calculerEchelleCourbe(serie)!;
    for (const valeur of serie) {
      const y = versYCourbe(valeur, echelle, GEOMETRIE);
      expect(y).toBeGreaterThanOrEqual(GEOMETRIE.marge - 1e-9);
      expect(y).toBeLessThanOrEqual(GEOMETRIE.hauteur - GEOMETRIE.marge + 1e-9);
    }
  });

  test("une serie plate se pose a mi-hauteur, sans division par zero", () => {
    const echelle = calculerEchelleCourbe([-4, -4])!;
    const y = versYCourbe(-4, echelle, GEOMETRIE);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeCloseTo(GEOMETRIE.hauteur / 2, 6);
  });

  test("l'ordre est respecte : une valeur plus haute est dessinee plus haut", () => {
    const echelle = calculerEchelleCourbe([-30, -10])!;
    expect(versYCourbe(-10, echelle, GEOMETRIE)).toBeLessThan(
      versYCourbe(-30, echelle, GEOMETRIE)
    );
  });
});

// -----------------------------------------------------------------------------
// 4. Le seul repere qui subsiste
// -----------------------------------------------------------------------------

describe("zeroEstDansLEchelle", () => {
  test("le zero ne se dessine que s'il est reellement traverse", () => {
    expect(zeroEstDansLEchelle(calculerEchelleCourbe([-8, 4])!)).toBe(true);
    expect(zeroEstDansLEchelle(calculerEchelleCourbe([-31, -12])!)).toBe(false);
    expect(zeroEstDansLEchelle(calculerEchelleCourbe([2, 9])!)).toBe(false);
  });

  test("une serie de joueur assidu ne recoit donc aucune ligne d'equilibre", () => {
    const echelle = calculerEchelleCourbe(serieJoueurAssidu())!;
    expect(zeroEstDansLEchelle(echelle)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// 5. La sentinelle sur l'ecran
// -----------------------------------------------------------------------------

describe("screens/ProgressScreen.tsx", () => {
  const ecran = readFileSync(join(__dirname, "..", "..", "ProgressScreen.tsx"), "utf8");

  test("n'a plus de bornes d'axe en dur, ni de rabotage", () => {
    expect(ecran).not.toMatch(/tsbMin\s*=\s*-?\d/);
    expect(ecran).not.toMatch(/tsbMax\s*=\s*-?\d/);
    expect(ecran).not.toMatch(/Math\.max\(\s*tsbMin/);
  });

  test("passe par le module d'echelle plutot que par son propre calcul", () => {
    expect(ecran).toMatch(/from\s*"\.\/progression\/echelleCourbe"/);
    expect(ecran).toContain("calculerEchelleCourbe");
    expect(ecran).toContain("versYCourbe");
  });

  test("n'ecrit plus les reperes bruts de l'echelle interne au joueur", () => {
    // La regle est posee dans components/homeVNext/HomeVNextSparkline.tsx : la
    // courbe montre une trajectoire, jamais un chiffre du modele de charge.
    expect(ecran).not.toMatch(/>\s*-10\s*</);
    expect(ecran).not.toMatch(/repereAxe/);
  });
});
