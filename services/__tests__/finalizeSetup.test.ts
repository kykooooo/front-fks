// services/__tests__/finalizeSetup.test.ts
//
// LA FINALISATION RÉELLEMENT APPELÉE PAR L'ÉCRAN (`finaliserQuestionnaire`),
// exécutée avec des dépendances espionnées. Aucune écriture — ni gêne locale,
// ni profil distant, ni preuve d'accord — ne doit précéder la validation de
// TOUTES les étapes.

import { readFileSync } from "fs";
import { resolve } from "path";
import { finaliserQuestionnaire, type FinalizeDeps, type FinalizeInput } from "../finalizeSetup";

function harnais(over: Partial<FinalizeDeps> = {}) {
  const journal: string[] = [];
  const profils: Array<Record<string, unknown>> = [];
  const genes: Array<{ zone: string; gravite: number }> = [];
  const deps: FinalizeDeps = {
    ecrireGene: (g) => { journal.push("gene"); genes.push(g); },
    onGeneEcrite: () => void journal.push("geneEcrite"),
    ecrireProfil: async (_uid, data) => { journal.push("profil"); profils.push(data); },
    effacerBrouillon: async () => void journal.push("brouillonEfface"),
    serverTimestamp: () => "TS",
    ...over,
  };
  return { deps, journal, profils, genes };
}

const reponsesCompletes: FinalizeInput["reponses"] = {
  firstName: "Lina",
  position: "Milieu",
  ageCategory: "U17",
  level: "Regional",
  dominantFoot: "Pied droit",
  mainObjective: "Etre en forme toute la saison",
  targetFksSessionsPerWeek: "2",
  selfReportedGapOption: "",
  hasClubTrainings: "oui",
  clubTrainingDays: ["tue", "thu"],
  matchDays: ["sat"],
  hasGymAccess: "non",
  geneSetup: "oui",
  geneZone: "genou",
  geneGravite: 2,
  parentalConsentChecked: false,
};

const entree = (over: Partial<FinalizeInput["reponses"]> = {}, reste: Partial<FinalizeInput> = {}): FinalizeInput => ({
  uid: "uid-1",
  reponses: { ...reponsesCompletes, ...over },
  storedParentalConsent: null,
  passthrough: { gymEquipment: [], hasHomeEquipment: false, homeEquipment: [] },
  autoCycleId: "fondation",
  geneDejaEcrite: false,
  ...reste,
});

describe("reprise d'un brouillon à la dernière étape", () => {
  test("U15 SANS accord coché : ni profil, ni gêne, ni preuve — retour à l'étape 1", async () => {
    const h = harnais();
    // Exactement l'état d'un brouillon U15 repris à l'étape 4 : la case n'est
    // jamais conservée dans le brouillon, elle vaut donc `false`.
    const issue = await finaliserQuestionnaire(h.deps, entree({ ageCategory: "U15", parentalConsentChecked: false }));
    expect(issue).toMatchObject({ status: "invalid", step: 0, title: "Accord parental requis" });
    expect(h.journal).toEqual([]);
    expect(h.profils).toEqual([]);
    expect(h.genes).toEqual([]);
  });

  test("l'accord ne se déduit PAS d'une preuve d'une autre catégorie ni de la seule catégorie", async () => {
    const h = harnais();
    const issue = await finaliserQuestionnaire(
      h.deps,
      entree({ ageCategory: "U15", parentalConsentChecked: false }, {
        storedParentalConsent: { accepted: true, acceptedAt: "2026-01-01T00:00:00.000Z", ageCategoryAtConsent: "U15" },
      }),
    );
    // Même avec une preuve en base, c'est la CASE qui fait foi (l'écran la
    // pré-coche quand la preuve vaut pour cette catégorie ; décochée = refus).
    expect(issue.status).toBe("invalid");
    expect(h.journal).toEqual([]);
  });

  test("U15 avec accord coché et preuve existante valide : la preuve d'ORIGINE est réutilisée", async () => {
    const h = harnais();
    const preuve = { accepted: true as const, acceptedAt: "2026-01-01T00:00:00.000Z", ageCategoryAtConsent: "U15" };
    const issue = await finaliserQuestionnaire(
      h.deps,
      entree({ ageCategory: "U15", parentalConsentChecked: true }, { storedParentalConsent: preuve }),
    );
    expect(issue).toEqual({ status: "saved" });
    expect(h.profils[0].parentalConsent).toEqual(preuve);
  });

  test("U17 : aucune preuve d'accord n'est écrite", async () => {
    const h = harnais();
    await finaliserQuestionnaire(h.deps, entree());
    expect("parentalConsent" in h.profils[0]).toBe(false);
  });

  test.each([
    [{ firstName: "  " }, 0],
    [{ position: "" }, 0],
    [{ mainObjective: "" }, 1],
    [{ targetFksSessionsPerWeek: "" }, 1],
    [{ hasClubTrainings: "" }, 2],
    [{ hasClubTrainings: "oui", clubTrainingDays: [] as string[] }, 2],
    [{ hasGymAccess: "" }, 3],
    [{ geneSetup: "oui", geneZone: null }, 3],
  ])("réponse obligatoire manquante %j → étape %i, et rien n'est écrit", async (manque, etape) => {
    const h = harnais();
    const issue = await finaliserQuestionnaire(h.deps, entree(manque as Partial<FinalizeInput["reponses"]>));
    expect(issue).toMatchObject({ status: "invalid", step: etape });
    expect(h.journal).toEqual([]);
  });

  test("plusieurs manques : c'est la PREMIÈRE étape invalide qui est rendue", async () => {
    const h = harnais();
    const issue = await finaliserQuestionnaire(h.deps, entree({ hasGymAccess: "", mainObjective: "" }));
    expect(issue).toMatchObject({ status: "invalid", step: 1 });
  });
});

describe("chemin valide", () => {
  test("ordre : gêne locale, profil, puis suppression du brouillon", async () => {
    const h = harnais();
    expect(await finaliserQuestionnaire(h.deps, entree())).toEqual({ status: "saved" });
    expect(h.journal).toEqual(["gene", "geneEcrite", "profil", "brouillonEfface"]);
    expect(h.genes).toEqual([{ zone: "genou", gravite: 2 }]);
    expect(h.profils[0]).toMatchObject({
      uid: "uid-1",
      profileCompleted: true,
      ageCategory: "U17",
      clubTrainingDays: ["tue", "thu"],
      matchDays: ["sat"],
      microcycleGoal: "fondation",
      microcycleSessionIndex: 0,
    });
    // La gêne ne part JAMAIS dans le profil distant, et `clubId` n'est jamais écrit.
    expect(JSON.stringify(h.profils[0])).not.toMatch(/genou|geneZone|clubId/);
  });

  test("écriture du profil en échec : ça JETTE, le brouillon reste, et un nouvel essai ne double pas la gêne", async () => {
    let essais = 0;
    const h = harnais({
      ecrireProfil: async () => {
        essais += 1;
        if (essais === 1) throw new Error("unavailable");
      },
    });
    await expect(finaliserQuestionnaire(h.deps, entree())).rejects.toThrow("unavailable");
    expect(h.journal).toEqual(["gene", "geneEcrite"]);
    // L'écran a noté que la gêne est écrite (onGeneEcrite) et le repasse :
    expect(await finaliserQuestionnaire(h.deps, entree({}, { geneDejaEcrite: true }))).toEqual({ status: "saved" });
    expect(h.genes).toHaveLength(1);
    expect(h.journal).toEqual(["gene", "geneEcrite", "brouillonEfface"]);
  });

  test("cycle déjà actif : aucun champ de cycle n'est réécrit", async () => {
    const h = harnais();
    await finaliserQuestionnaire(h.deps, entree({}, { autoCycleId: null }));
    expect("microcycleGoal" in h.profils[0]).toBe(false);
  });
});

describe("câblage — l'écran passe par ce service, sans valider seulement l'étape affichée", () => {
  const ecran = readFileSync(resolve(__dirname, "..", "..", "screens", "ProfileSetupScreen.tsx"), "utf8");
  test("`enregistrerProfil` appelle finaliserQuestionnaire et n'écrit plus rien lui-même avant", () => {
    const corps = ecran.slice(ecran.indexOf("const enregistrerProfil = async () => {"), ecran.indexOf("/* ─── Render helpers ─── */"));
    expect(corps).toContain("await finaliserQuestionnaire(");
    expect(corps).not.toContain("validateStep()");
    expect(corps.indexOf("ajouterGene(")).toBeGreaterThan(corps.indexOf("finaliserQuestionnaire("));
    expect(corps).toContain("animateTransition(issue.step)");
    // L'état RÉEL de la case est transmis, jamais une déduction.
    expect(ecran).toMatch(/parentalConsentChecked,\r?\n\s+\}\);/);
  });
});
