// screens/__tests__/feedbackNonFaite.test.ts
//
// L'ISSUE « JE NE L'AI PAS FAITE » EST-ELLE CÂBLÉE, ET AU BON ENDROIT ?
//
// P1-08 inventaire clubs (décision Kyllian 15/08) : une séance générée mais
// jamais ouverte exigeait un ressenti le lendemain — le joueur honnête devait
// mentir au feedback (fausse charge) ou attendre la fermeture de fenêtre.
// Tests-source (même méthode/limite que onboardingTactile.test.ts) : la
// mécanique elle-même est exécutée dans markSessionNotDone.test.ts.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

describe("FeedbackScreen — l'issue existe et respecte les règles actées", () => {
  const source = lire("screens/FeedbackScreen.tsx");

  test("le lien « Je ne l'ai pas faite » est rendu sous le CTA Valider", () => {
    expect(source).toContain("Je ne l'ai pas faite");
    expect(source).toMatch(/canDeclareNotDone \?/);
  });

  test("réservée aux séances sans exécution réelle et non complétées", () => {
    expect(source).toMatch(
      /canDeclareNotDone = Boolean\(\s*targetSession && !targetSession\.completed && !executionSummary\s*\)/
    );
  });

  test("confirmation avant d'archiver, avec la promesse « sans charge »", () => {
    expect(source).toContain("Tu n'as pas fait cette séance ?");
    expect(source).toContain(
      "Elle sera archivée sans charge d'entraînement. Ça arrive — ta prochaine séance n'en tiendra pas compte."
    );
    expect(source).toMatch(/text: 'Annuler', style: 'cancel'/);
    expect(source).toMatch(/text: 'Oui, pas faite'/);
  });

  test("l'archivage passe par l'orchestrateur (jamais par applyFeedback)", () => {
    expect(source).toMatch(/markSessionNotDone\(targetSessionId\)/);
    // Le chemin « pas faite » ne doit jamais fabriquer un feedback.
    const blocOnNotDone = source.slice(
      source.indexOf("const onNotDone"),
      source.indexOf("// Callbacks pour suggestions")
    );
    expect(blocOnNotDone).not.toContain("applyFeedback");
    expect(blocOnNotDone).not.toContain("onSave");
  });
});

describe("Historique — « Pas faite » se distingue de « Non validée »", () => {
  const source = lire("screens/SessionHistoryScreen.tsx");

  test("badge et sous-titre dédiés", () => {
    expect(source).toMatch(/isNotDone \? 'Pas faite' : 'Non validée'/);
    expect(source).toContain("archivée sans charge");
  });
});

describe("Durée réelle (P1-15) — la valeur n'est plus détruite, le repli est dit", () => {
  const metricsSource = lire("screens/feedback/components/MetricsRow.tsx");

  test("selectTextOnFocus a remplacé le vidage au focus", () => {
    expect(metricsSource).toContain("selectTextOnFocus");
    expect(metricsSource).not.toMatch(/onFocus=\{\(\) => \{[\s\S]*?onDurationChange\(""\)/);
  });

  test("champ vide → le repli sur la durée prévue est affiché, plus silencieux", () => {
    expect(metricsSource).toContain("Vide : on garde la durée prévue");
    expect(metricsSource).toMatch(/plannedFallbackMin/);
    expect(lire("screens/FeedbackScreen.tsx")).toMatch(/plannedFallbackMin=\{durationPrefill\}/);
  });
});
