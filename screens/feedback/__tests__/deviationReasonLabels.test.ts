// screens/feedback/__tests__/deviationReasonLabels.test.ts
// Fix P2-f : deux tables de libelles FR DeviationReason existaient (une dans
// components/session/liveTrackingHelpers.ts pour l'ecran Live, une autre ICI
// pour le feedback), avec des libelles/casse differents. Source canonique
// unique desormais : DEVIATION_REASON_LABELS (liveTrackingHelpers.ts) --
// deviationReasonLabels.ts est un simple re-export sous son API historique
// (DEVIATION_REASON_LABEL_FR), pour ne rien casser cote FeedbackScreen/
// ExecutionSummaryCard.
import { DEVIATION_REASON_LABEL_FR } from "../deviationReasonLabels";
import { DEVIATION_REASON_LABELS, DEVIATION_REASON_ORDER } from "../../../components/session/liveTrackingHelpers";

describe("DEVIATION_REASON_LABEL_FR (feedback) — alignement sur la source canonique Live", () => {
  test("est exactement la table canonique de components/session/liveTrackingHelpers.ts", () => {
    expect(DEVIATION_REASON_LABEL_FR).toBe(DEVIATION_REASON_LABELS);
  });

  test("porte un libelle non vide en casse debut-de-phrase pour chaque raison", () => {
    DEVIATION_REASON_ORDER.forEach((reason) => {
      const label = DEVIATION_REASON_LABEL_FR[reason];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
      // Casse harmonisee (brief P2-f) : majuscule initiale, comme sur l'ecran Live.
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    });
  });

  test("libelles harmonises attendus (brief P2-f)", () => {
    expect(DEVIATION_REASON_LABEL_FR).toEqual({
      time: "Manque de temps",
      equipment: "Matériel indisponible",
      too_difficult: "Trop difficile",
      fatigue: "Fatigue",
      pain: "Douleur ou gêne",
      technical: "Problème technique",
      space: "Manque de place",
      no_partner: "Partenaire indisponible",
      other: "Autre",
    });
  });
});
