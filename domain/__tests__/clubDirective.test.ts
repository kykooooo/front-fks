// domain/__tests__/clubDirective.test.ts
//
// Les DEUX contrats de la séparation, testés côte à côte parce que c'est leur
// opposition qui fait le sens : ce qui reste privé ne modifie rien, ce qui
// modifie quelque chose est lisible par celui qu'il concerne.

import {
  CLUB_DIRECTIVE_INSTRUCTION_MAX,
  CLUB_DIRECTIVE_LABEL,
  CLUB_DIRECTIVE_OBJECTIVES,
  CLUB_DIRECTIVE_OBJECTIVE_LABELS,
  CLUB_DIRECTIVE_WRITE_WARNING,
  clampDirectiveInstruction,
  clubDirectiveNotice,
  isClubDirectiveApplicable,
  normalizeClubDirectiveObjective,
  parseClubDirective,
} from "../clubDirective";
import {
  COACH_PRIVATE_NOTE_LABEL,
  COACH_PRIVATE_NOTE_MAX,
  clampCoachPrivateNote,
  parseCoachPrivateNote,
} from "../clubCoachNote";
import { CLUB_WEEK_GOALS } from "../types";

const TODAY = "2026-07-27";

const brut = (over: Record<string, unknown> = {}) => ({
  objective: "prevention",
  instruction: "On garde les appuis",
  validFrom: "2026-07-20",
  validUntil: "2026-08-10",
  active: true,
  createdBy: "coachA",
  ...over,
});

// ────────────────────────────────────────────────────────────────────────────
describe("Les libellés promis au coach sont exactement ceux du produit", () => {
  test("la note privée annonce QUI lit et CE QU'ELLE NE FAIT PAS", () => {
    expect(COACH_PRIVATE_NOTE_LABEL).toBe(
      "Note privée — visible uniquement par l'encadrement autorisé. Cette note ne modifie pas les séances.",
    );
  });

  test("la directive annonce sa visibilité joueur AVANT la saisie", () => {
    expect(CLUB_DIRECTIVE_LABEL).toBe(
      "Directive d'entraînement — visible par le joueur et susceptible d'influencer ses prochaines séances.",
    );
    // Le second avertissement est ce qui protège la donnée de santé : le coach
    // sait que le joueur lit, encore faut-il lui dire ce qu'il n'écrit pas.
    expect(CLUB_DIRECTIVE_WRITE_WARNING).toContain("santé");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("objective : catégorie FERMÉE, branchée sur le vocabulaire existant", () => {
  test("l'allowlist EST celle des objectifs club (aucun second vocabulaire)", () => {
    expect([...CLUB_DIRECTIVE_OBJECTIVES]).toEqual([...CLUB_WEEK_GOALS]);
  });

  test("chaque objectif a un libellé — aucun trou d'affichage possible", () => {
    for (const o of CLUB_DIRECTIVE_OBJECTIVES) {
      expect(typeof CLUB_DIRECTIVE_OBJECTIVE_LABELS[o]).toBe("string");
      expect(CLUB_DIRECTIVE_OBJECTIVE_LABELS[o].length).toBeGreaterThan(0);
    }
  });

  test("hors allowlist → null (texte libre refusé)", () => {
    for (const v of ["muscu", "PREVENTION", "", null, 3, {}]) {
      expect(normalizeClubDirectiveObjective(v)).toBeNull();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("parseClubDirective : fail-closed, jamais de valeur par défaut", () => {
  test("document complet → directive lue", () => {
    expect(parseClubDirective(brut())).toEqual({
      objective: "prevention",
      instruction: "On garde les appuis",
      validFrom: "2026-07-20",
      validUntil: "2026-08-10",
      active: true,
      createdBy: "coachA",
      createdAt: null,
      updatedAt: null,
    });
  });

  test("un morceau manquant → null (aucune moitié de consigne n'influence une séance)", () => {
    expect(parseClubDirective(null)).toBeNull();
    expect(parseClubDirective(brut({ objective: undefined }))).toBeNull();
    expect(parseClubDirective(brut({ instruction: "  " }))).toBeNull();
    expect(parseClubDirective(brut({ validFrom: undefined }))).toBeNull();
    expect(parseClubDirective(brut({ validUntil: "pas-une-date" }))).toBeNull();
  });

  test("fenêtre inversée → refus, jamais de correction silencieuse", () => {
    expect(parseClubDirective(brut({ validFrom: "2026-08-10", validUntil: "2026-07-20" }))).toBeNull();
  });

  test("`active` absent ou non booléen vaut false (un vieux document n'active rien)", () => {
    expect(parseClubDirective(brut({ active: undefined })!)?.active).toBe(false);
    expect(parseClubDirective(brut({ active: "true" }))?.active).toBe(false);
    expect(parseClubDirective(brut({ active: 1 }))?.active).toBe(false);
  });

  test("horodatage Firestore (objet toDate) ou ISO, sinon null", () => {
    const ts = { toDate: () => new Date("2026-07-20T08:00:00.000Z") };
    expect(parseClubDirective(brut({ createdAt: ts }))?.createdAt).toBe("2026-07-20T08:00:00.000Z");
    expect(parseClubDirective(brut({ updatedAt: "2026-07-21T09:00:00.000Z" }))?.updatedAt).toBe(
      "2026-07-21T09:00:00.000Z",
    );
    expect(parseClubDirective(brut({ createdAt: 1234 }))?.createdAt).toBeNull();
  });

  test("instruction bornée à la valeur du domaine", () => {
    expect(clampDirectiveInstruction("x".repeat(1000)).length).toBe(CLUB_DIRECTIVE_INSTRUCTION_MAX);
    expect(clampDirectiveInstruction(42)).toBe("");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("isClubDirectiveApplicable : bornes incluses, aucun calcul de fuseau", () => {
  const d = parseClubDirective(brut());

  test("dans la fenêtre → applicable, bornes comprises", () => {
    expect(isClubDirectiveApplicable(d, TODAY)).toBe(true);
    expect(isClubDirectiveApplicable(d, "2026-07-20")).toBe(true);
    expect(isClubDirectiveApplicable(d, "2026-08-10")).toBe(true);
  });

  test("hors fenêtre, levée, absente ou date illisible → non applicable", () => {
    expect(isClubDirectiveApplicable(d, "2026-07-19")).toBe(false);
    expect(isClubDirectiveApplicable(d, "2026-08-11")).toBe(false);
    expect(isClubDirectiveApplicable(parseClubDirective(brut({ active: false })), TODAY)).toBe(false);
    expect(isClubDirectiveApplicable(null, TODAY)).toBe(false);
    expect(isClubDirectiveApplicable(d, "27/07/2026")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("clubDirectiveNotice : ce que le JOUEUR lit", () => {
  test("directive applicable → consigne rendue, avec la précision d'honnêteté", () => {
    const notice = clubDirectiveNotice(parseClubDirective(brut()), TODAY);
    expect(notice).not.toBeNull();
    expect(notice?.titre).toBe("Directive du club");
    expect(notice?.objectif).toBe("Appuis & freinage");
    expect(notice?.instruction).toBe("On garde les appuis");
    // Elle dit d'où ça vient ET ce que ça ne peut pas faire : sans cette phrase,
    // un joueur croirait que son club écrit ses séances.
    expect(notice?.precision).toContain("sécurité");
  });

  test("directive non applicable → rien à afficher (jamais un cadre vide)", () => {
    expect(clubDirectiveNotice(parseClubDirective(brut({ active: false })), TODAY)).toBeNull();
    expect(clubDirectiveNotice(null, TODAY)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("Note privée : bornes et lecture", () => {
  test("plafond conservé à 200 (aucune note existante tronquée par le déménagement)", () => {
    expect(COACH_PRIVATE_NOTE_MAX).toBe(200);
    expect(clampCoachPrivateNote("x".repeat(500)).length).toBe(200);
  });

  test("vide, blanc ou non-chaîne → chaîne vide, jamais null/undefined", () => {
    expect(clampCoachPrivateNote("   ")).toBe("");
    expect(clampCoachPrivateNote(undefined)).toBe("");
    expect(clampCoachPrivateNote(12)).toBe("");
  });

  test("document sans note exploitable → null (pas de note fantôme)", () => {
    expect(parseCoachPrivateNote(null, "2026-07-27")).toBeNull();
    expect(parseCoachPrivateNote({ note: "   " }, "2026-07-27")).toBeNull();
    expect(parseCoachPrivateNote({ note: "jambes lourdes" }, "2026-07-27")).toEqual({
      weekKey: "2026-07-27",
      note: "jambes lourdes",
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("AUCUNE PASSERELLE note → directive", () => {
  test("le module directive n'expose aucune fonction de conversion", () => {
    // Une note privée ne devient jamais une directive « automatiquement ». La
    // seule façon d'en créer une est un geste explicite du coach dans l'écran.
    // Ce test verrouille l'API : ajouter un `directiveFromNote` le fera tomber.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = Object.keys(require("../clubDirective"));
    const suspects = api.filter((k) => /fromNote|convert|migrat|suggest|infer/i.test(k));
    expect(suspects).toEqual([]);
  });

  test("une note passée à parseClubDirective ne produit rien", () => {
    // Même en forçant : un document de note n'a ni objectif ni fenêtre.
    expect(parseClubDirective({ note: "tendinite genou droit" })).toBeNull();
  });
});
