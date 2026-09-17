// constants/__tests__/daJoueurContraste.test.ts
//
// Ce que ce test protège : les ratios WCAG annoncés en commentaire dans
// `daJoueur.ts` ne valent rien s'ils ne sont pas mesurés à chaque run (cf.
// `components/coach/__tests__/coachTheme.test.ts`, même méthode). On
// recalcule ici, pour la palette CLAIRE et la palette SOMBRE, chaque paire
// texte/fond utile listée par la spec DA (SPEC_DA_ACCUEIL_SEANCE.md §1.1) :
// seuil 4,5:1 pour le texte, 3:1 pour un contour de contrôle porteur de sens.

import { daClair, daSombre, type DaTokens } from "../daJoueur";

// ─── Formule WCAG 2.1 (luminance relative + ratio), reprise telle quelle ────
function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA_TEXTE = 4.5;
const AA_CONTOUR = 3;

// Paires texte/fond exigées par la mission SOCLE, telles quelles.
const PAIRES_TEXTE: [string, keyof DaTokens["colors"], keyof DaTokens["colors"]][] = [
  ["texte principal / fond", "text", "bg"],
  ["texte principal / carte", "text", "card"],
  ["texte secondaire / fond", "sub", "bg"],
  ["texte secondaire / carte", "sub", "card"],
  ["texte secondaire / fond de sélection", "sub", "actionSoft"],
  ["texte principal / fond de sélection", "text", "actionSoft"],
  ["texte sur action / action", "onAction", "action"],
  ["lien orange / fond", "actionText", "bg"],
  ["lien orange / carte", "actionText", "card"],
  ["lien orange / fond de sélection", "actionText", "actionSoft"],
  ["texte désactivé / fond désactivé", "disabledText", "disabledBg"],
  ["texte attention / carte", "warnText", "card"],
  ["texte attention / fond attention", "warnText", "warnSoft"],
  ["texte erreur / carte", "dangerText", "card"],
  ["texte erreur / fond erreur", "dangerText", "dangerSoft"],
  ["texte positif / carte", "successText", "card"],
  ["texte positif / fond positif", "successText", "successSoft"],
];

const PAIRES_CONTOUR: [string, keyof DaTokens["colors"], keyof DaTokens["colors"]][] = [
  ["contour de contrôle / carte", "controlBorder", "card"],
  ["contour de contrôle / fond", "controlBorder", "bg"],
];

describe.each([
  ["claire", daClair],
  ["sombre", daSombre],
] as const)("Contraste DA joueur — palette %s", (_nom, jetons) => {
  test.each(PAIRES_TEXTE)("%s ≥ 4,5:1", (_libelle, avant, fond) => {
    const ratio = contrast(jetons.colors[avant], jetons.colors[fond]);
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXTE);
  });

  test.each(PAIRES_CONTOUR)("%s ≥ 3:1", (_libelle, avant, fond) => {
    const ratio = contrast(jetons.colors[avant], jetons.colors[fond]);
    expect(ratio).toBeGreaterThanOrEqual(AA_CONTOUR);
  });
});

describe("Contraste DA joueur — garde-fous de structure", () => {
  test("les deux palettes exposent exactement les mêmes clés de couleur", () => {
    expect(Object.keys(daSombre.colors).sort()).toEqual(Object.keys(daClair.colors).sort());
  });

  test("l'action garde la même teinte claire/sombre (identité de marque)", () => {
    expect(daSombre.colors.action).toBe(daClair.colors.action);
  });

  test("zone tactile et rayons ne dépendent pas du mode", () => {
    expect(daSombre.radius).toEqual(daClair.radius);
    expect(daSombre.spacing).toEqual(daClair.spacing);
    expect(daSombre.gutter).toBe(daClair.gutter);
  });
});
