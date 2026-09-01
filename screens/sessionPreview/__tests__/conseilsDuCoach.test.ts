// screens/sessionPreview/__tests__/conseilsDuCoach.test.ts
//
// RECETTE TÉLÉPHONE 01/09 — séance Force « maison ».
//
// Défaut 1 : « Conseil du coach » affichait LA MÊME phrase sur les 4 blocs
// (tous matchent « strength/force ») pendant que les VRAIS conseils d'Agent B
// (`coaching_tips`, niveau SÉANCE côté backend — fks/src/fksSchema.ts:121)
// n'étaient pas lus de façon défensive. Deux copies de `getCoachTip` vivaient
// en parallèle (sessionPreviewConfig + SessionLiveScreen).
//
// Défaut 2 : badge d'intensité en anglais brut. `frIntensity` existait déjà et
// était branché partout SAUF dans PrebuiltSessionDetailScreen, qui gardait sa
// propre table à 3 entrées.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  getCoachTip,
  coachTipsForBlocks,
  getCoachTipFamily,
  TIPS_PAR_FAMILLE,
  type Block,
} from "../sessionPreviewConfig";
import { readCoachingTips } from "../../newSession/helpers";
import { frIntensity } from "../../../utils/frLabels";

const racine = resolve(__dirname, "..", "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

const bloc = (over: Partial<Block>): Block => ({ type: "strength", ...over });

describe("getCoachTip — fallback local varié et déterministe", () => {
  test("déterministe : deux appels identiques rendent la même phrase", () => {
    const seance: Block[] = [bloc({ type: "strength", goal: "Force bas du corps" })];
    expect(getCoachTip(seance, 0)).toBe(getCoachTip(seance, 0));
    // Aucun tirage aléatoire appelé dans la source : sinon les rendus sautent
    // d'une frame à l'autre et aucun snapshot n'est stable.
    expect(lire("screens/sessionPreview/sessionPreviewConfig.ts")).not.toMatch(
      /Math\.random\(/
    );
  });

  test("une séance Force de 4 blocs n'affiche JAMAIS deux fois la même phrase", () => {
    const blocs: Block[] = [
      bloc({ type: "strength", goal: "Force bas du corps" }),
      bloc({ type: "strength", goal: "Force haut du corps" }),
      bloc({ type: "strength", goal: "Renfo unilatéral" }),
      bloc({ type: "strength", goal: "Prévention ischios" }),
    ];
    const tips = blocs.map((_, i) => getCoachTip(blocs, i));
    expect(new Set(tips).size).toBe(4);
    tips.forEach((t) => expect(t.length).toBeGreaterThan(0));
  });

  // ⚠️ CAS RÉFUTÉ EN ROUND 2, garde-fou du vrai invariant.
  // L'implémentation précédente piochait par INDEX GLOBAL du bloc
  // (`index % pool.length`, 6 phrases par pool). Une séance de 7 blocs — le
  // maximum contractuel du backend, `blocks` ... `.max(7)` — avec deux blocs
  // force aux index 0 et 6 retombait donc sur LA MÊME phrase (0 % 6 === 6 % 6),
  // exactement le défaut que la correction prétendait avoir supprimé. Le choix
  // se fait maintenant par RANG DANS LA FAMILLE, pas par index global : ce test
  // est ROUGE sur l'ancienne implémentation, vert sur la nouvelle.
  test("séance de 7 blocs : deux blocs force aux extrémités ont des phrases DIFFÉRENTES", () => {
    const seance: Block[] = [
      bloc({ type: "strength", goal: "Force bas du corps" }), // index 0, force #1
      bloc({ type: "mobility" }), // index 1
      bloc({ type: "speed" }), // index 2
      bloc({ type: "plyo" }), // index 3
      bloc({ type: "cod" }), // index 4
      bloc({ type: "run" }), // index 5
      bloc({ type: "strength", goal: "Prévention ischios" }), // index 6, force #2
    ];
    expect(seance).toHaveLength(7);

    const premierForce = getCoachTip(seance, 0);
    const dernierForce = getCoachTip(seance, 6);
    expect(dernierForce).not.toBe(premierForce);
    // Les deux phrases viennent bien du pool force, dans l'ordre du rang.
    expect(premierForce).toBe("Technique propre, amplitude contrôlée, tempo stable.");
    expect(dernierForce).toBe(
      "Descends lentement, remonte fort : la descente construit le muscle."
    );

    // Et par-dessus le marché : aucun doublon dans TOUTE la séance.
    const tips = coachTipsForBlocks(seance);
    expect(tips).toHaveLength(7);
    expect(new Set(tips).size).toBe(7);
  });

  test("le pool tient jusqu'à TIPS_PAR_FAMILLE blocs d'une même famille", () => {
    const seance: Block[] = Array.from({ length: TIPS_PAR_FAMILLE }, () =>
      bloc({ type: "strength" })
    );
    const tips = coachTipsForBlocks(seance);
    expect(new Set(tips).size).toBe(TIPS_PAR_FAMILLE);
    // Le pool couvre presque le plafond contractuel de 7 blocs par séance : il
    // faudrait 7 blocs de LA MÊME famille pour épuiser les phrases.
    expect(TIPS_PAR_FAMILLE).toBeGreaterThanOrEqual(6);
  });

  test("non-régression : le bloc 1 de chaque famille garde sa phrase historique", () => {
    expect(getCoachTip([bloc({ type: "strength" })], 0)).toBe(
      "Technique propre, amplitude contrôlée, tempo stable."
    );
    expect(getCoachTip([bloc({ type: "speed" })], 0)).toBe(
      "Explosivité max, récup complète, départs propres."
    );
    expect(getCoachTip([bloc({ type: "run" })], 0)).toBe(
      "Rythme constant, respiration posée, relâchement."
    );
    expect(getCoachTip([bloc({ type: "plyo" })], 0)).toBe(
      "Contacts courts, gainage actif, atterrissages doux."
    );
    expect(getCoachTip([bloc({ type: "cod" })], 0)).toBe(
      "Appuis bas, changements propres, regard haut."
    );
    expect(getCoachTip([bloc({ type: "mobility" })], 0)).toBe(
      "Amplitude progressive, aucune douleur, respiration lente."
    );
    // Famille `general` : SEUL changement de phrase assumé du lot. L'historique
    // était « Bloc N : qualité d'exécution avant volume. » ; le préfixe saute,
    // la carte du bloc affiche déjà son numéro et son titre au-dessus.
    expect(getCoachTip([bloc({ type: "core", goal: "Gainage" })], 0)).toBe(
      "Qualité d’exécution avant volume."
    );
  });

  test("famille détectée depuis type / focus / goal, comme l'ancienne cascade", () => {
    expect(getCoachTipFamily(bloc({ type: "strength" }))).toBe("force");
    expect(getCoachTipFamily(bloc({ type: "core", focus: "vitesse" }))).toBe("vitesse");
    expect(getCoachTipFamily(bloc({ type: "core", goal: "Endurance de base" }))).toBe(
      "endurance"
    );
  });

  test("fallback : bloc inconnu ou absent -> famille générale, jamais de vide", () => {
    expect(getCoachTipFamily(undefined)).toBe("general");
    expect(getCoachTipFamily(bloc({ type: "core", goal: "Gainage" }))).toBe("general");
    expect(getCoachTip(undefined, 0)).toBe("Qualité d’exécution avant volume.");
    expect(getCoachTip(undefined, 3).length).toBeGreaterThan(0);
    expect(coachTipsForBlocks(undefined)).toEqual([]);
    expect(coachTipsForBlocks(null)).toEqual([]);
    expect(coachTipsForBlocks([undefined])).toEqual(["Qualité d’exécution avant volume."]);
    // Index aberrants (NaN, négatif, hors séance) : on rend toujours une phrase.
    const seance = [bloc({ type: "strength" })];
    expect(getCoachTip(seance, Number.NaN).length).toBeGreaterThan(0);
    expect(getCoachTip(seance, -3).length).toBeGreaterThan(0);
    expect(getCoachTip(seance, 99).length).toBeGreaterThan(0);
  });

  test("une seule implémentation : SessionLiveScreen importe, ne redéfinit plus", () => {
    const live = lire("screens/SessionLiveScreen.tsx");
    expect(live).not.toMatch(/const getCoachTip = \(/);
    expect(live).toMatch(
      /import \{ getCoachTip \} from "\.\/sessionPreview\/sessionPreviewConfig"/
    );
  });
});

describe("coaching_tips d'Agent B — niveau SÉANCE, affichés pour de vrai", () => {
  test("extraction : payload backend réaliste (3 tips) -> les 3 conseils", () => {
    const v2 = {
      coachingTips: [
        "Sur le squat, descends jusqu'à la parallèle avant de remonter.",
        "Garde 2 répétitions en réserve : on construit, on ne se crame pas.",
        "Ce travail se transfère direct sur tes duels en pivot.",
      ],
    };
    expect(readCoachingTips(v2)).toEqual(v2.coachingTips);
  });

  test("extraction : absent / vide / entrées sales -> undefined ou liste propre", () => {
    expect(readCoachingTips(undefined)).toBeUndefined();
    expect(readCoachingTips(null)).toBeUndefined();
    expect(readCoachingTips({ coachingTips: [] })).toBeUndefined();
    expect(readCoachingTips({ coachingTips: ["   ", ""] })).toBeUndefined();
    expect(
      readCoachingTips({ coachingTips: ["  Bien placé.  ", 42, null, "Souffle."] as never })
    ).toEqual(["Bien placé.", "Souffle."]);
  });

  test("l'encart par bloc ne porte plus un intitulé quasi identique", () => {
    // « Conseil du coach » (local, par bloc) et « Conseils du coach » (tips IA,
    // par séance) ne se distinguaient que d'un « s » sur l'écran Preview.
    const card = lire("screens/sessionPreview/components/BlockCard.tsx");
    expect(card).toMatch(/Repère technique/);
    expect(card).not.toMatch(/>\s*Conseil du coach\s*</);
    // Le nom « Conseils du coach » reste réservé aux VRAIS conseils d'Agent B.
    for (const rel of ["screens/SessionPreviewScreen.tsx", "screens/SessionLiveScreen.tsx"]) {
      expect(lire(rel)).toContain('title="Conseils du coach"');
    }
    // Le bandeau du bloc actif de l'écran live garde son propre intitulé.
    expect(lire("screens/SessionLiveScreen.tsx")).toMatch(/Focus bloc \$\{/);
  });

  test("Preview et Live rendent la liste réelle, bornée en lignes", () => {
    for (const rel of ["screens/SessionPreviewScreen.tsx", "screens/SessionLiveScreen.tsx"]) {
      const source = lire(rel);
      expect(source).toContain("readCoachingTips");
      expect(source).toContain("Conseils du coach");
      expect(source).toMatch(/coachingTips\.map\(/);
      // Règle d'or CLAUDE.md : contenu backend => numberOfLines.
      expect(source).toMatch(/numberOfLines=\{4\}[\s\S]{0,120}?coaching-tip-/);
    }
  });
});

describe("badge d'intensité — plus un seul token anglais brut", () => {
  test("valeurs du contrat backend (easy/moderate/hard) + tolérances", () => {
    expect(frIntensity("easy")).toBe("Facile");
    expect(frIntensity("moderate")).toBe("Modéré");
    expect(frIntensity("hard")).toBe("Intense");
    expect(frIntensity("MODERATE")).toBe("Modéré");
    expect(frIntensity("max")).toBe("Max");
    expect(frIntensity("recovery")).toBe("Récup");
  });

  test("valeur inconnue : rendue telle quelle, jamais undefined ni vide", () => {
    expect(frIntensity("brutal")).toBe("brutal");
    expect(frIntensity(undefined)).toBe("");
    expect(frIntensity(null)).toBe("");
  });

  test("PrebuiltSessionDetailScreen ne garde plus sa table locale", () => {
    const source = lire("screens/PrebuiltSessionDetailScreen.tsx");
    expect(source).not.toMatch(/const INTENSITY_LABEL/);
    expect(source).toMatch(/frIntensity\(session\.intensity\)/);
  });
});
