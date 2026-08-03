// components/coach/__tests__/coachTheme.test.ts
//
// Ce que ces tests protègent : LES RATIOS DE CONTRASTE ANNONCÉS EN COMMENTAIRE.
// Un commentaire "5,71:1" ne vaut rien s'il n'est pas mesuré : il survit
// tranquillement à une couleur retouchée "juste un peu plus claire". Ici le
// ratio est recalculé à chaque exécution avec la formule WCAG 2.1.
//
// Seuils appliqués :
//   - texte normal                                   -> >= 4,5:1
//   - bordure porteuse de sens / composant graphique -> >= 3:1
// Les hairlines purement décoratives (`border`, `borderSoft`) sont exclues
// volontairement : elles ne portent aucune information.

import {
  COACH_PROVENANCES,
  COACH_STATUS_LEVELS,
  coachColors,
  coachLayout,
  coachType,
  provenanceTone,
  statusTone,
} from "../coachTheme";

// ─── Formule WCAG 2.1 (luminance relative + ratio) ──────────────────────────
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

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

describe("Contraste — surfaces principales", () => {
  const surfaces: [string, string][] = [
    ["card", coachColors.card],
    ["bg", coachColors.bg],
    ["cardAlt", coachColors.cardAlt],
  ];

  test.each(surfaces)("le texte principal reste lisible sur %s", (_name, surface) => {
    expect(contrast(coachColors.text, surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test.each(surfaces)("le texte secondaire reste lisible sur %s", (_name, surface) => {
    expect(contrast(coachColors.sub, surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // C'est LA régression corrigée : l'ancien `muted` (#8C8F99) tombait à 3,23:1
  // sur carte et 2,76:1 sur surface secondaire.
  test.each(surfaces)("le texte tertiaire (muted) reste lisible sur %s", (_name, surface) => {
    expect(contrast(coachColors.muted, surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test("l'accent est lisible sur carte, fond et son propre remplissage", () => {
    expect(contrast(coachColors.accent, coachColors.card)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(coachColors.accent, coachColors.bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(coachColors.accent, coachColors.accentSoft)).toBeGreaterThanOrEqual(AA_TEXT);
    // Bouton plein : blanc sur accent.
    expect(contrast("#FFFFFF", coachColors.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test("la bordure porteuse de sens atteint le seuil composant sur les 3 surfaces", () => {
    for (const [, surface] of surfaces) {
      expect(contrast(coachColors.borderStrong, surface)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    }
  });
});

describe("Contraste — les 4 tons de statut", () => {
  test.each(COACH_STATUS_LEVELS)("le libellé du niveau %s est lisible sur son fond", (level) => {
    const tone = statusTone(level);
    expect(contrast(tone.texte, tone.fond)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test.each(COACH_STATUS_LEVELS)(
    "le contour du niveau %s se détache du fond ET de la carte",
    (level) => {
      const tone = statusTone(level);
      expect(contrast(tone.bordure, tone.fond)).toBeGreaterThanOrEqual(AA_GRAPHIC);
      expect(contrast(tone.bordure, coachColors.card)).toBeGreaterThanOrEqual(AA_GRAPHIC);
      expect(contrast(tone.bordure, coachColors.bg)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    }
  );

  test("le badge 'Faite' (vert sur vert clair) repasse le seuil", () => {
    // Régression historique : #2E7D52 sur #E8F1EB = 4,37:1, sous le seuil.
    expect(contrast(coachColors.success, coachColors.successSoft)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test("les tons chauds restent lisibles sur toutes leurs surfaces", () => {
    expect(contrast(coachColors.warn, coachColors.warnSoft)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(coachColors.warn, coachColors.warnFaint)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(coachColors.warn, coachColors.card)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(coachColors.danger, coachColors.dangerSoft)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(coachColors.neutralText, coachColors.neutralSoft)).toBeGreaterThanOrEqual(
      AA_TEXT
    );
  });
});

describe("Tokens — garde-fous de structure", () => {
  test("l'échelle de statut compte exactement 4 niveaux, sans 'critique'", () => {
    expect(COACH_STATUS_LEVELS).toEqual(["normal", "watch", "check", "unknown"]);
    expect(COACH_STATUS_LEVELS as readonly string[]).not.toContain("critical");
    expect(COACH_STATUS_LEVELS as readonly string[]).not.toContain("critique");
  });

  test("chaque provenance a un libellé unique et explicite", () => {
    const libelles = COACH_PROVENANCES.map((p) => provenanceTone(p).libelle);
    expect(new Set(libelles).size).toBe(COACH_PROVENANCES.length);
    expect(libelles).toContain("Donnée absente");
  });

  test("les zones tactiles minimales respectent le seuil d'accessibilité", () => {
    expect(coachLayout.minTouchSize).toBeGreaterThanOrEqual(44);
    expect(coachLayout.rowMinHeight).toBeGreaterThanOrEqual(56);
  });

  test("chaque style de texte fournit une hauteur de ligne supérieure à sa taille", () => {
    for (const style of Object.values(coachType)) {
      expect(style.lineHeight).toBeGreaterThan(style.fontSize);
    }
  });

  test("le contenu est plafonné en largeur (tablette / web)", () => {
    expect(coachLayout.maxContentWidth).toBeLessThanOrEqual(760);
    expect(coachLayout.maxContentWidthWide).toBeGreaterThan(coachLayout.maxContentWidth);
    expect(coachLayout.twoColumnMinWidth).toBeGreaterThan(coachLayout.maxContentWidth);
  });
});
