// domain/coachView/__tests__/statusLabel.test.ts
//
// Ce que ces tests protègent : le silence de l'app ne doit jamais se lire comme
// un constat. « Rien à signaler » affirme que l'app a regardé ; tant qu'il
// manque des données, elle n'a regardé qu'une partie, et le libellé le dit.
//
// Et ce qu'ils protègent AUSSI, à l'inverse : la hiérarchie de statut reste à
// QUATRE niveaux. La nuance est un mot en plus, jamais un cinquième cran.
//
// Lancement depuis un worktree : npx jest --config jest.coach.config.js

import {
  coachDonneesPartiellesNote,
  coachStatusLabel,
  coachStatusPrecision,
} from "../statusLabel";
import { COACH_STATUS_LABEL, COACH_STATUS_LEVELS } from "../types";
import { makeView } from "./fixtures";

describe("coachStatusLabel — « rien à signaler » n'est pas « tout va bien »", () => {
  test("données complètes : le libellé standard, mot pour mot", () => {
    for (const niveau of COACH_STATUS_LEVELS) {
      expect(coachStatusLabel(niveau, false)).toBe(COACH_STATUS_LABEL[niveau]);
    }
  });

  test("données partielles : seul « Rien à signaler » est nuancé", () => {
    expect(coachStatusLabel("normal", true)).toBe("Rien à signaler parmi les données disponibles");
    // Les trois autres disent déjà quelque chose de vrai : à surveiller, à
    // vérifier, indisponible. Les alourdir ferait du bruit sans rien corriger.
    expect(coachStatusLabel("watch", true)).toBe(COACH_STATUS_LABEL.watch);
    expect(coachStatusLabel("check", true)).toBe(COACH_STATUS_LABEL.check);
    expect(coachStatusLabel("unknown", true)).toBe(COACH_STATUS_LABEL.unknown);
  });

  test("la nuance est un LIBELLÉ, jamais un cinquième niveau", () => {
    // Le libellé nuancé contient toujours le libellé d'origine : un coach qui
    // connaît « Rien à signaler » reconnaît la même chose, précisée.
    expect(coachStatusLabel("normal", true)).toContain(COACH_STATUS_LABEL.normal);
    expect(COACH_STATUS_LEVELS).toHaveLength(4);
  });
});

describe("coachStatusPrecision — ce qu'on écrit à côté d'une pastille courte", () => {
  test("rien à préciser quand le libellé court dit déjà tout", () => {
    expect(coachStatusPrecision("normal", false)).toBeNull();
    expect(coachStatusPrecision("check", true)).toBeNull();
    expect(coachStatusPrecision("unknown", true)).toBeNull();
  });

  test("la phrase entière est fournie, pas un fragment", () => {
    expect(coachStatusPrecision("normal", true)).toBe(
      "Rien à signaler parmi les données disponibles",
    );
  });
});

describe("coachDonneesPartiellesNote — la carte dit ce qu'elle ne sait pas", () => {
  test("aucune note quand rien ne manque : pas de bruit par défaut", () => {
    expect(coachDonneesPartiellesNote(false)).toBeNull();
  });

  test("note explicite quand des données manquent", () => {
    const note = coachDonneesPartiellesNote(true);
    expect(note).toContain("n'a pas été transmise");
    expect(note).toContain("ce qui est connu");
  });
});

describe("branchement sur le modèle de lecture", () => {
  // Cas NOMINAL d'aujourd'hui : ni exécution, ni fenêtre d'activité, ni séance
  // prévue ne sont projetées. Le drapeau est donc levé pour tout le monde — et
  // c'est précisément pour ça que le libellé devait changer.
  test("une projection d'aujourd'hui produit un « Rien à signaler » nuancé", () => {
    const view = makeView({
      profileComplete: true,
      latestSession: {
        dateKey: "2026-07-26",
        title: null,
        focusLabel: null,
        intensityLabel: null,
        durationMin: 40,
        blockCount: 4,
        status: "done",
      },
      lastActivity: { dateKey: "2026-07-26", durationMin: 40 },
    });

    // Aucun signal : l'ancienne fiche affichait donc « Rien à signaler » sec.
    expect(view.statut).toBe("normal");
    expect(view.signaux).toHaveLength(0);
    // Alors qu'on ne sait ni ce qu'il a fait de sa séance, ni son assiduité.
    expect(view.donneesPartielles).toBe(true);
    expect(coachStatusLabel(view.statut, view.donneesPartielles)).toBe(
      "Rien à signaler parmi les données disponibles",
    );
  });
});
